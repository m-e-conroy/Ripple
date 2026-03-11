import { useAudioStore, TrackFX } from '../store/useAudioStore';
import toWav from 'audiobuffer-to-wav';

class TrackFXChain {
  public input: GainNode;
  public output: GainNode;
  
  private eqLow: BiquadFilterNode;
  private eqMid: BiquadFilterNode;
  private eqHigh: BiquadFilterNode;
  
  private delayNode: DelayNode;
  private delayFeedback: GainNode;
  private delayWet: GainNode;
  
  private reverbNode: ConvolverNode;
  private reverbWet: GainNode;
  private currentReverbDecay: number = 0;
  private ctx: BaseAudioContext;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    // EQ
    this.eqLow = ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 250;

    this.eqMid = ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 1;

    this.eqHigh = ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 4000;

    // Delay
    this.delayNode = ctx.createDelay(5.0);
    this.delayFeedback = ctx.createGain();
    this.delayWet = ctx.createGain();

    // Reverb
    this.reverbNode = ctx.createConvolver();
    this.reverbWet = ctx.createGain();

    // Connect EQ
    this.input.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);

    // Dry signal path
    this.eqHigh.connect(this.output);

    // Delay path
    this.eqHigh.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayWet);
    this.delayWet.connect(this.output);

    // Reverb path
    this.eqHigh.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbWet);
    this.reverbWet.connect(this.output);
  }

  private generateImpulseResponse(duration: number): AudioBuffer {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, sampleRate * duration);
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / (sampleRate * (duration / 5))); 
        channelData[i] = (Math.random() * 2 - 1) * decay;
      }
    }
    return impulse;
  }

  public applySettings(fx: TrackFX) {
    // EQ
    if (fx.eq.enabled) {
      this.eqLow.gain.value = fx.eq.low;
      this.eqMid.gain.value = fx.eq.mid;
      this.eqHigh.gain.value = fx.eq.high;
    } else {
      this.eqLow.gain.value = 0;
      this.eqMid.gain.value = 0;
      this.eqHigh.gain.value = 0;
    }

    // Delay
    if (fx.delay.enabled) {
      this.delayNode.delayTime.value = fx.delay.time;
      this.delayFeedback.gain.value = fx.delay.feedback;
      this.delayWet.gain.value = fx.delay.mix;
    } else {
      this.delayWet.gain.value = 0;
      this.delayFeedback.gain.value = 0;
    }

    // Reverb
    if (fx.reverb.enabled) {
      this.reverbWet.gain.value = fx.reverb.mix;
      if (this.currentReverbDecay !== fx.reverb.decay) {
        this.reverbNode.buffer = this.generateImpulseResponse(fx.reverb.decay);
        this.currentReverbDecay = fx.reverb.decay;
      }
    } else {
      this.reverbWet.gain.value = 0;
    }
  }
}

class AudioEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private trackChains: Map<string, { fxChain: TrackFXChain; trackGain: GainNode }> = new Map();
  private activeSources: Map<string, AudioBufferSourceNode[]> = new Map();
  private playStartTime: number = 0;
  private playheadOffset: number = 0;
  private animationFrameId: number | null = null;
  private analyser: AnalyserNode;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  public async resume() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public play() {
    this.resume();
    const state = useAudioStore.getState();
    if (state.isPlaying) return;

    this.playheadOffset = state.playheadPosition;
    this.playStartTime = this.ctx.currentTime;
    
    this.schedulePlayback(state);
    
    useAudioStore.getState().setIsPlaying(true);
    this.updatePlayhead();
  }

  public stop() {
    const state = useAudioStore.getState();
    if (!state.isPlaying) return;

    // Stop all active sources
    this.activeSources.forEach((sources) => {
      sources.forEach((source) => {
        try {
          source.stop();
          source.disconnect();
        } catch (e) {
          // Ignore errors if already stopped
        }
      });
    });
    this.activeSources.clear();

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    useAudioStore.getState().setIsPlaying(false);
    
    // Update playhead position to where it stopped
    const elapsed = this.ctx.currentTime - this.playStartTime;
    useAudioStore.getState().setPlayheadPosition(this.playheadOffset + elapsed);
  }

  private schedulePlayback(state: ReturnType<typeof useAudioStore.getState>) {
    const { tracks, clips, playheadPosition } = state;

    // Determine if any track is soloed
    const isAnySolo = tracks.some((t) => t.solo);

    tracks.forEach((track) => {
      // Create or update track chain
      let chain = this.trackChains.get(track.id);
      if (!chain) {
        const fxChain = new TrackFXChain(this.ctx);
        const trackGain = this.ctx.createGain();
        fxChain.output.connect(trackGain);
        trackGain.connect(this.masterGain);
        chain = { fxChain, trackGain };
        this.trackChains.set(track.id, chain);
      }

      // Apply FX
      chain.fxChain.applySettings(track.fx);

      // Apply volume, mute, solo
      const isMuted = track.muted || (isAnySolo && !track.solo);
      chain.trackGain.gain.value = isMuted ? 0 : track.volume;

      const sources: AudioBufferSourceNode[] = [];

      track.regions.forEach((region) => {
        const clip = clips[region.sourceClipId];
        if (!clip || !clip.buffer) return;

        // Check if region is in the future relative to playhead, or currently playing
        const regionEnd = region.startTime + region.duration;
        if (regionEnd <= playheadPosition) return; // Already played

        const source = this.ctx.createBufferSource();
        source.buffer = clip.buffer;
        
        // Create Region Gain for Fades
        const regionGain = this.ctx.createGain();
        source.connect(regionGain);
        regionGain.connect(chain!.fxChain.input);

        let startDelay = 0;
        let offset = region.clipOffset;
        let duration = region.duration;
        let playheadOffsetInRegion = 0;

        if (region.startTime < playheadPosition) {
          // Region started before playhead, so start immediately with an offset
          playheadOffsetInRegion = playheadPosition - region.startTime;
          offset += playheadOffsetInRegion;
          duration -= playheadOffsetInRegion;
        } else {
          // Region starts in the future
          startDelay = region.startTime - playheadPosition;
        }

        const scheduledStartTime = this.ctx.currentTime + startDelay;
        const scheduledEndTime = scheduledStartTime + duration;
        
        const fadeIn = region.fadeInDuration || 0;
        const fadeOut = region.fadeOutDuration || 0;

        // Apply Fades
        if (playheadOffsetInRegion > 0) {
          // Playback started inside the region
          if (playheadOffsetInRegion < fadeIn) {
            // Started inside fade-in
            const currentGain = playheadOffsetInRegion / fadeIn;
            regionGain.gain.setValueAtTime(currentGain, this.ctx.currentTime);
            regionGain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + (fadeIn - playheadOffsetInRegion));
            
            // Apply fade out at the end
            regionGain.gain.setValueAtTime(1, scheduledEndTime - fadeOut);
            regionGain.gain.linearRampToValueAtTime(0, scheduledEndTime);
          } else if (playheadOffsetInRegion > region.duration - fadeOut) {
            // Started inside fade-out
            const fadeOutProgress = playheadOffsetInRegion - (region.duration - fadeOut);
            const currentGain = 1 - (fadeOutProgress / fadeOut);
            regionGain.gain.setValueAtTime(currentGain, this.ctx.currentTime);
            regionGain.gain.linearRampToValueAtTime(0, scheduledEndTime);
          } else {
            // Started in the middle (full volume)
            regionGain.gain.setValueAtTime(1, this.ctx.currentTime);
            // Apply fade out at the end
            regionGain.gain.setValueAtTime(1, scheduledEndTime - fadeOut);
            regionGain.gain.linearRampToValueAtTime(0, scheduledEndTime);
          }
        } else {
          // Playback started before the region, apply normal fades
          regionGain.gain.setValueAtTime(0, scheduledStartTime);
          if (fadeIn > 0) {
            regionGain.gain.linearRampToValueAtTime(1, scheduledStartTime + fadeIn);
          } else {
            regionGain.gain.setValueAtTime(1, scheduledStartTime);
          }
          
          if (fadeOut > 0) {
            regionGain.gain.setValueAtTime(1, scheduledEndTime - fadeOut);
            regionGain.gain.linearRampToValueAtTime(0, scheduledEndTime);
          }
        }

        source.start(scheduledStartTime, offset, duration);
        sources.push(source);
      });

      this.activeSources.set(track.id, sources);
    });
  }

  private getProjectDuration(state: ReturnType<typeof useAudioStore.getState>): number {
    const maxTime = Math.max(
      state.duration,
      ...state.tracks.flatMap(t => t.regions.map(r => r.startTime + r.duration))
    );
    return maxTime;
  }

  private updatePlayhead = () => {
    const state = useAudioStore.getState();
    if (!state.isPlaying) return;

    const elapsed = this.ctx.currentTime - this.playStartTime;
    const currentPosition = this.playheadOffset + elapsed;
    
    const projectDuration = this.getProjectDuration(state);

    // Stop if we reached the end of the project duration
    if (currentPosition >= projectDuration) {
      this.stop();
      useAudioStore.getState().setPlayheadPosition(0);
      return;
    }

    useAudioStore.getState().setPlayheadPosition(currentPosition);
    this.animationFrameId = requestAnimationFrame(this.updatePlayhead);
  };

  public setPlayhead(position: number) {
    const state = useAudioStore.getState();
    if (state.isPlaying) {
      this.stop();
      useAudioStore.getState().setPlayheadPosition(position);
      this.play();
    } else {
      useAudioStore.getState().setPlayheadPosition(position);
    }
  }

  public updateTrackVolume(trackId: string, volume: number, muted: boolean, solo: boolean, isAnySolo: boolean) {
    const chain = this.trackChains.get(trackId);
    if (chain) {
      const isMuted = muted || (isAnySolo && !solo);
      chain.trackGain.gain.value = isMuted ? 0 : volume;
    }
  }

  public updateTrackFX(trackId: string, fx: TrackFX) {
    const chain = this.trackChains.get(trackId);
    if (chain) {
      chain.fxChain.applySettings(fx);
    }
  }

  public async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return await this.ctx.decodeAudioData(arrayBuffer);
  }

  public async exportWav(customDuration?: number): Promise<Blob> {
    const state = useAudioStore.getState();
    const duration = customDuration !== undefined ? customDuration : this.getProjectDuration(state);
    
    const offlineCtx = new OfflineAudioContext(2, 44100 * duration, 44100);
    const isAnySolo = state.tracks.some((t) => t.solo);

    state.tracks.forEach((track) => {
      const fxChain = new TrackFXChain(offlineCtx);
      fxChain.applySettings(track.fx);
      
      const trackGain = offlineCtx.createGain();
      const isMuted = track.muted || (isAnySolo && !track.solo);
      trackGain.gain.value = isMuted ? 0 : track.volume;
      
      fxChain.output.connect(trackGain);
      trackGain.connect(offlineCtx.destination);

      track.regions.forEach((region) => {
        const clip = state.clips[region.sourceClipId];
        if (!clip || !clip.buffer) return;

        // Skip regions that start after the custom duration
        if (region.startTime >= duration) return;

        const source = offlineCtx.createBufferSource();
        source.buffer = clip.buffer;
        
        // Create Region Gain for Fades
        const regionGain = offlineCtx.createGain();
        source.connect(regionGain);
        regionGain.connect(fxChain.input);
        
        // Calculate how much of the region fits within the duration
        const availableDuration = duration - region.startTime;
        const actualDuration = Math.min(region.duration, availableDuration);
        
        const fadeIn = region.fadeInDuration || 0;
        const fadeOut = region.fadeOutDuration || 0;
        
        // Apply Fades
        regionGain.gain.setValueAtTime(0, region.startTime);
        if (fadeIn > 0) {
          regionGain.gain.linearRampToValueAtTime(1, region.startTime + fadeIn);
        } else {
          regionGain.gain.setValueAtTime(1, region.startTime);
        }
        
        if (fadeOut > 0) {
          regionGain.gain.setValueAtTime(1, region.startTime + actualDuration - fadeOut);
          regionGain.gain.linearRampToValueAtTime(0, region.startTime + actualDuration);
        }

        source.start(region.startTime, region.clipOffset, actualDuration);
      });
    });

    const renderedBuffer = await offlineCtx.startRendering();
    const wavArrayBuffer = toWav(renderedBuffer);
    return new Blob([new DataView(wavArrayBuffer)], { type: 'audio/wav' });
  }

  public async exportMp3(customDuration?: number): Promise<Blob> {
    const state = useAudioStore.getState();
    const duration = customDuration !== undefined ? customDuration : this.getProjectDuration(state);
    
    // Render to mono for simplicity with lamejs in this example, or mix down
    const offlineCtx = new OfflineAudioContext(1, 44100 * duration, 44100);
    const isAnySolo = state.tracks.some((t) => t.solo);

    state.tracks.forEach((track) => {
      const fxChain = new TrackFXChain(offlineCtx);
      fxChain.applySettings(track.fx);
      
      const trackGain = offlineCtx.createGain();
      const isMuted = track.muted || (isAnySolo && !track.solo);
      trackGain.gain.value = isMuted ? 0 : track.volume;
      
      fxChain.output.connect(trackGain);
      trackGain.connect(offlineCtx.destination);

      track.regions.forEach((region) => {
        const clip = state.clips[region.sourceClipId];
        if (!clip || !clip.buffer) return;

        // Skip regions that start after the custom duration
        if (region.startTime >= duration) return;

        const source = offlineCtx.createBufferSource();
        source.buffer = clip.buffer;
        
        // Create Region Gain for Fades
        const regionGain = offlineCtx.createGain();
        source.connect(regionGain);
        regionGain.connect(fxChain.input);
        
        // Calculate how much of the region fits within the duration
        const availableDuration = duration - region.startTime;
        const actualDuration = Math.min(region.duration, availableDuration);
        
        const fadeIn = region.fadeInDuration || 0;
        const fadeOut = region.fadeOutDuration || 0;
        
        // Apply Fades
        regionGain.gain.setValueAtTime(0, region.startTime);
        if (fadeIn > 0) {
          regionGain.gain.linearRampToValueAtTime(1, region.startTime + fadeIn);
        } else {
          regionGain.gain.setValueAtTime(1, region.startTime);
        }
        
        if (fadeOut > 0) {
          regionGain.gain.setValueAtTime(1, region.startTime + actualDuration - fadeOut);
          regionGain.gain.linearRampToValueAtTime(0, region.startTime + actualDuration);
        }

        source.start(region.startTime, region.clipOffset, actualDuration);
      });
    });

    const renderedBuffer = await offlineCtx.startRendering();
    const channelData = renderedBuffer.getChannelData(0);

    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./mp3Worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const { mp3Data } = e.data;
        const blob = new Blob(mp3Data, { type: 'audio/mp3' });
        resolve(blob);
        worker.terminate();
      };
      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };
      worker.postMessage({ channelData, sampleRate: 44100 });
    });
  }
}

export const engine = new AudioEngine();

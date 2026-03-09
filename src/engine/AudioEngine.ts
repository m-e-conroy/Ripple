import { useAudioStore } from '../store/useAudioStore';
import toWav from 'audiobuffer-to-wav';

class AudioEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private trackGains: Map<string, GainNode> = new Map();
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
      // Create or update track gain
      let trackGain = this.trackGains.get(track.id);
      if (!trackGain) {
        trackGain = this.ctx.createGain();
        trackGain.connect(this.masterGain);
        this.trackGains.set(track.id, trackGain);
      }

      // Apply volume, mute, solo
      const isMuted = track.muted || (isAnySolo && !track.solo);
      trackGain.gain.value = isMuted ? 0 : track.volume;

      const sources: AudioBufferSourceNode[] = [];

      track.regions.forEach((region) => {
        const clip = clips[region.sourceClipId];
        if (!clip || !clip.buffer) return;

        // Check if region is in the future relative to playhead, or currently playing
        const regionEnd = region.startTime + region.duration;
        if (regionEnd <= playheadPosition) return; // Already played

        const source = this.ctx.createBufferSource();
        source.buffer = clip.buffer;
        source.connect(trackGain);

        let startDelay = 0;
        let offset = region.clipOffset;
        let duration = region.duration;

        if (region.startTime < playheadPosition) {
          // Region started before playhead, so start immediately with an offset
          offset += (playheadPosition - region.startTime);
          duration -= (playheadPosition - region.startTime);
        } else {
          // Region starts in the future
          startDelay = region.startTime - playheadPosition;
        }

        source.start(this.ctx.currentTime + startDelay, offset, duration);
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
    const trackGain = this.trackGains.get(trackId);
    if (trackGain) {
      const isMuted = muted || (isAnySolo && !solo);
      trackGain.gain.value = isMuted ? 0 : volume;
    }
  }

  public async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return await this.ctx.decodeAudioData(arrayBuffer);
  }

  public async exportWav(): Promise<Blob> {
    const state = useAudioStore.getState();
    const duration = this.getProjectDuration(state);
    
    const offlineCtx = new OfflineAudioContext(2, 44100 * duration, 44100);
    const isAnySolo = state.tracks.some((t) => t.solo);

    state.tracks.forEach((track) => {
      const trackGain = offlineCtx.createGain();
      const isMuted = track.muted || (isAnySolo && !track.solo);
      trackGain.gain.value = isMuted ? 0 : track.volume;
      trackGain.connect(offlineCtx.destination);

      track.regions.forEach((region) => {
        const clip = state.clips[region.sourceClipId];
        if (!clip || !clip.buffer) return;

        const source = offlineCtx.createBufferSource();
        source.buffer = clip.buffer;
        source.connect(trackGain);
        source.start(region.startTime, region.clipOffset, region.duration);
      });
    });

    const renderedBuffer = await offlineCtx.startRendering();
    const wavArrayBuffer = toWav(renderedBuffer);
    return new Blob([new DataView(wavArrayBuffer)], { type: 'audio/wav' });
  }

  public async exportMp3(): Promise<Blob> {
    const state = useAudioStore.getState();
    const duration = this.getProjectDuration(state);
    
    // Render to mono for simplicity with lamejs in this example, or mix down
    const offlineCtx = new OfflineAudioContext(1, 44100 * duration, 44100);
    const isAnySolo = state.tracks.some((t) => t.solo);

    state.tracks.forEach((track) => {
      const trackGain = offlineCtx.createGain();
      const isMuted = track.muted || (isAnySolo && !track.solo);
      trackGain.gain.value = isMuted ? 0 : track.volume;
      trackGain.connect(offlineCtx.destination);

      track.regions.forEach((region) => {
        const clip = state.clips[region.sourceClipId];
        if (!clip || !clip.buffer) return;

        const source = offlineCtx.createBufferSource();
        source.buffer = clip.buffer;
        source.connect(trackGain);
        source.start(region.startTime, region.clipOffset, region.duration);
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

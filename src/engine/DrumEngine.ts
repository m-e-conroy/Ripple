export const DRUM_INSTRUMENTS = ['Kick', 'Snare', 'Hi-Hat', 'Clap', 'Low Tom', 'Mid Tom', 'Hi Tom', 'Ride', 'Crash'];

// Reliable public URLs for drum samples (Wes Bos JS30 Drum Kit + some extras)
const SAMPLE_URLS: Record<string, string> = {
  'Kick': 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/kick.wav',
  'Snare': 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/snare.wav',
  'Hi-Hat': 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/hihat.wav',
  'Clap': 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/clap.wav',
  'Low Tom': 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/boom.wav',
  'Mid Tom': 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/tom.wav',
  'Hi Tom': 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/tom.wav', // We will pitch this up
  'Ride': 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/ride.wav',
  'Crash': 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/openhat.wav' // Using openhat as a crash fallback
};

export class DrumEngine {
  static sampleBuffers: Record<string, AudioBuffer> = {};
  static isLoaded = false;

  static async loadSamples(audioCtx: BaseAudioContext) {
    if (this.isLoaded) return;
    
    const promises = Object.entries(SAMPLE_URLS).map(async ([name, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        this.sampleBuffers[name] = audioBuffer;
      } catch (e) {
        console.warn(`Failed to load sample for ${name}, will fallback to synthesis.`, e);
      }
    });

    await Promise.all(promises);
    this.isLoaded = true;
  }

  static async renderLoop(pattern: boolean[][], bpm: number): Promise<AudioBuffer> {
    const stepDuration = 60 / bpm / 4;
    const loopDuration = 16 * stepDuration;
    const ctx = new OfflineAudioContext(2, 44100 * loopDuration, 44100);

    await this.loadSamples(ctx);

    for (let step = 0; step < 16; step++) {
      const time = step * stepDuration;
      if (pattern[0][step]) this.playSampleOrSynth(ctx, 'Kick', time, () => this.createKick(ctx, time));
      if (pattern[1][step]) this.playSampleOrSynth(ctx, 'Snare', time, () => this.createSnare(ctx, time));
      if (pattern[2][step]) this.playSampleOrSynth(ctx, 'Hi-Hat', time, () => this.createHiHat(ctx, time));
      if (pattern[3][step]) this.playSampleOrSynth(ctx, 'Clap', time, () => this.createClap(ctx, time));
      if (pattern[4]?.[step]) this.playSampleOrSynth(ctx, 'Low Tom', time, () => this.createTom(ctx, time, 100));
      if (pattern[5]?.[step]) this.playSampleOrSynth(ctx, 'Mid Tom', time, () => this.createTom(ctx, time, 150));
      if (pattern[6]?.[step]) this.playSampleOrSynth(ctx, 'Hi Tom', time, () => this.createTom(ctx, time, 200), 1.5); // Pitch up Hi Tom sample
      if (pattern[7]?.[step]) this.playSampleOrSynth(ctx, 'Ride', time, () => this.createRide(ctx, time));
      if (pattern[8]?.[step]) this.playSampleOrSynth(ctx, 'Crash', time, () => this.createCrash(ctx, time), 0.8); // Pitch down openhat for crash
    }

    return await ctx.startRendering();
  }

  static playSampleOrSynth(ctx: BaseAudioContext, name: string, time: number, synthFallback: () => void, playbackRate: number = 1.0) {
    const buffer = this.sampleBuffers[name];
    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      source.connect(ctx.destination);
      source.start(time);
    } else {
      synthFallback();
    }
  }

  static createKick(ctx: BaseAudioContext, time: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  static createSnare(ctx: BaseAudioContext, time: number) {
    // Tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.frequency.setValueAtTime(250, time);
    osc.frequency.exponentialRampToValueAtTime(150, time + 0.2);
    oscGain.gain.setValueAtTime(0.5, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    osc.start(time);
    osc.stop(time + 0.2);

    // Noise
    const noise = this.createNoiseBuffer(ctx);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;
    const noiseGain = ctx.createGain();

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseGain.gain.setValueAtTime(1, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

    noiseSource.start(time);
    noiseSource.stop(time + 0.25);
  }

  static createHiHat(ctx: BaseAudioContext, time: number) {
    const noise = this.createNoiseBuffer(ctx);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 10000;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 7000;

    const gain = ctx.createGain();

    noiseSource.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    noiseSource.start(time);
    noiseSource.stop(time + 0.1);
  }

  static createClap(ctx: BaseAudioContext, time: number) {
    const noise = this.createNoiseBuffer(ctx);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;

    const gain = ctx.createGain();

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(1, time + 0.01);
    gain.gain.linearRampToValueAtTime(0, time + 0.02);
    gain.gain.linearRampToValueAtTime(1, time + 0.03);
    gain.gain.linearRampToValueAtTime(0, time + 0.04);
    gain.gain.linearRampToValueAtTime(1, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    noiseSource.start(time);
    noiseSource.stop(time + 0.2);
  }

  static createTom(ctx: BaseAudioContext, time: number, freq: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.5);

    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  static createRide(ctx: BaseAudioContext, time: number) {
    // Metallic cluster
    const freqs = [300, 450, 600, 850, 1200, 1800];
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.5, time);
    masterGain.gain.exponentialRampToValueAtTime(0.01, time + 1.5);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;
    filter.connect(masterGain);

    freqs.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + 1.5);
    });

    // Ping
    const pingOsc = ctx.createOscillator();
    const pingGain = ctx.createGain();
    pingOsc.type = 'sine';
    pingOsc.frequency.value = 3500;
    pingOsc.connect(pingGain);
    pingGain.connect(ctx.destination);
    pingGain.gain.setValueAtTime(0.8, time);
    pingGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    pingOsc.start(time);
    pingOsc.stop(time + 0.1);
  }

  static createCrash(ctx: BaseAudioContext, time: number) {
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.8, time);
    masterGain.gain.exponentialRampToValueAtTime(0.01, time + 2.0);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4000;
    filter.connect(masterGain);

    // Noise
    const noise = this.createNoiseBuffer(ctx);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    noiseSource.connect(filter);
    noiseSource.start(time);
    noiseSource.stop(time + 2.0);

    // Metallic cluster
    const freqs = [400, 550, 800, 1000, 1500, 2000];
    freqs.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + 2.0);
    });
  }

  static createNoiseBuffer(ctx: BaseAudioContext) {
    const bufferSize = ctx.sampleRate * 2; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}

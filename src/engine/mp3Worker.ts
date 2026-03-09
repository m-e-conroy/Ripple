import './setupLame';
import lamejs from 'lamejs';

self.onmessage = function (e) {
  const { channelData, sampleRate } = e.data;
  
  // Convert Float32Array to Int16Array
  const samples = new Int16Array(channelData.length);
  for (let i = 0; i < channelData.length; i++) {
    let s = Math.max(-1, Math.min(1, channelData[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const mp3Data = [];

  const sampleBlockSize = 1152;
  for (let i = 0; i < samples.length; i += sampleBlockSize) {
    const sampleChunk = samples.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }
  
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }

  self.postMessage({ mp3Data });
};

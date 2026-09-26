// Mono samples (Float32, -1 to 1) to a 16-bit PCM WAV at the rate speech-to-text wants.
// No browser APIs, so scripts/check-stt.js builds its test clip with the very same code as the game.

/** Resample mono samples: averaging going down (a cheap low-pass), linear interpolation going up. */
export function resample(samples, from, to) {
  if (from === to) return samples;
  const ratio = from / to, n = Math.floor(samples.length / ratio), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * ratio, a = Math.floor(p);
    if (ratio > 1) {
      const b = Math.min(samples.length, Math.max(a + 1, Math.floor(p + ratio)));
      let sum = 0;
      for (let j = a; j < b; j++) sum += samples[j];
      out[i] = sum / (b - a);
    } else {
      const t = p - a;
      out[i] = samples[a] * (1 - t) + samples[Math.min(a + 1, samples.length - 1)] * t;
    }
  }
  return out;
}

/** A 16-bit PCM mono WAV file (ArrayBuffer) of these samples at this rate. */
export function encodeWav(samples, rate) {
  const bytes = samples.length * 2, buf = new ArrayBuffer(44 + bytes), v = new DataView(buf);
  const text = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + bytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); // bytes per second
  v.setUint16(32, 2, true); // bytes per frame
  v.setUint16(34, 16, true); // bits per sample
  text(36, 'data');
  v.setUint32(40, bytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

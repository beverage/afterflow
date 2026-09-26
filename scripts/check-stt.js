// npm run check:stt -> one real Gradium speech-to-text round trip, the way the game hears scroll incantations.
// Gradium's TTS says an incantation, the clip is re-encoded exactly like the game's mic clips (src/wav.js:
// 16-bit mono WAV at LISTEN.rate), then transcribed by the /api/stt handler with and without the words boosted.
// Usage: npm run check:stt [-- "Galene Thalassa"]. Without GRADIUM_API_KEY it says so and exits 0.
import { handleTTS } from '../server/tts.js';
import { handleSTT } from '../server/stt.js';
import { LISTEN } from '../src/config.js';
import { encodeWav, resample } from '../src/wav.js';

try {
  process.loadEnvFile?.('.env');
} catch {
  /* no .env file */
}

const env = process.env;
const line = process.argv[2] || 'Galene Thalassa';
if (!env.GRADIUM_API_KEY) {
  console.log('No GRADIUM_API_KEY: /api/stt runs in mock mode and the game hears incantations with the browser\'s own recognizer.');
  process.exit(0);
}

// The first channel of a 16-bit PCM or 32-bit float WAV, as Float32 samples.
function decodeWav(buf) {
  let at = 12, fmt = null;
  while (at + 8 <= buf.length) {
    const id = buf.toString('ascii', at, at + 4), size = buf.readUInt32LE(at + 4), body = at + 8;
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    if (id === 'data' && fmt) {
      const step = (fmt.bits / 8) * fmt.channels, end = size && body + size <= buf.length ? body + size : buf.length;
      const n = Math.floor((end - body) / step), out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = fmt.format === 3 ? buf.readFloatLE(body + i * step) : buf.readInt16LE(body + i * step) / 32768;
      if (fmt.format !== 1 && fmt.format !== 3 && fmt.format !== 0xfffe) return null;
      if (fmt.format !== 3 && fmt.bits !== 16) return null;
      return { samples: out, rate: fmt.rate };
    }
    at = body + size + (size % 2);
  }
  return null;
}

let t0 = Date.now();
const tts = await handleTTS({ text: `${line}.` }, env);
if (!tts.audio) {
  console.log(`TTS failed: ${tts.json.error}`);
  process.exit(1);
}
const wav = decodeWav(tts.audio);
console.log(`TTS said "${line}" in ${Date.now() - t0} ms: ${tts.audio.length} bytes${wav ? `, ${wav.rate} Hz, ${(wav.samples.length / wav.rate).toFixed(2)} s` : ' (not a WAV this script can read: sending it as is)'}`);
const clip = wav ? Buffer.from(encodeWav(resample(wav.samples, wav.rate, LISTEN.rate), LISTEN.rate)) : tts.audio;
if (wav) console.log(`Clip like the game's: ${clip.length} bytes, 16-bit mono at ${LISTEN.rate} Hz`);

let failures = 0;
for (const words of [line.split(/\s+/), []]) {
  t0 = Date.now();
  const out = await handleSTT(clip, { words }, env);
  const label = words.length ? `boosting ${words.join(', ')}` : 'no boost';
  console.log(`STT (${label}): HTTP ${out.status} in ${Date.now() - t0} ms -> ${out.json.ok ? JSON.stringify(out.json.text) : out.json.error}`);
  if (!out.json.ok || out.json.mock) failures++;
}
process.exit(failures ? 1 : 0);

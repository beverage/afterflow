// npm run check:ai -> verifies the Gemini (AI Studio) and Gradium keys with one real call each.
import { DEFAULT_MODEL, handleGemini } from '../server/gemini.js';
import { handleTTS, ttsStatus } from '../server/tts.js';

try {
  process.loadEnvFile?.('.env');
} catch {
  /* no .env file */
}

const env = process.env;
let failures = 0;

// Gemini
console.log('== Gemini (Google AI Studio) ==');
if (!env.GEMINI_API_KEY) {
  console.log('No GEMINI_API_KEY: the game runs in mock AI mode. Get a key at https://aistudio.google.com/apikey');
} else {
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const base = (env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/models?pageSize=200`, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
    const names = (body.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((n) => /flash|pro/.test(n));
    console.log(`Key OK. Text models on this key (${names.length}): ${names.join(', ')}`);
    if (!names.includes(model.replace(/^models\//, ''))) console.log(`Heads up: GEMINI_MODEL "${model}" isn't in that list.`);
  } catch (err) {
    console.log(`Could not list models: ${err.message}`);
  }
  const t0 = Date.now();
  const { status, json } = await handleGemini(
    { prompt: 'Give a 6-word hype line for a hackathon game demo.', schema: { type: 'object', properties: { line: { type: 'string' } }, required: ['line'] } },
    env,
  );
  console.log(`Test call to ${model}: HTTP ${status} in ${Date.now() - t0} ms -> ${json.ok ? JSON.stringify(json.data) : json.error}`);
  if (!json.ok) failures++;
}

// Gradium
console.log('\n== Gradium (voice) ==');
if (!env.GRADIUM_API_KEY) {
  console.log('No GRADIUM_API_KEY: the game falls back to the browser\'s built-in speech.');
} else {
  const t0 = Date.now();
  const out = await handleTTS({ text: 'Plumbing check. Voice is live.' }, env);
  if (out.audio) console.log(`TTS OK with voice ${ttsStatus(env).voice}: ${out.audio.length} bytes of ${out.contentType} in ${Date.now() - t0} ms`);
  else {
    console.log(`TTS failed: ${out.json.error}`);
    failures++;
  }
}

process.exit(failures ? 1 : 0);

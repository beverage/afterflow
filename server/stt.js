// Server-side Gradium speech-to-text proxy. The API key never reaches the browser.
// The browser records a short clip (one phrase, cut at a pause) and POSTs it here as a 16-bit mono WAV.
// Shared by the Vite dev server, Vercel (api/stt.js) and server.js. Uses only Node built-ins.
// Docs: https://docs.gradium.ai/guides/speech-to-text-rest and https://docs.gradium.ai/guides/transcription-settings
import { gradiumBase } from './tts.js';

export const MAX_AUDIO_BYTES = 2 * 1024 * 1024; // a clip is at most ~4 s of 24 kHz 16-bit mono: ~200 KB
const TIMEOUT_MS = 10000;
const MAX_WORDS = 12;
const KEYWORD_BOOST = 3; // Gradium's recommended default (range -6 to 6, log-probability)
// The model's lookahead in 80 ms frames. Its default (50) took ~2.6 s per clip; 16 (the docs' own example) takes ~1.4 s
// and still spelled "Galene Thalassa" right; 8 began to slip ("Galeen"), and 4 isn't accepted.
const DELAY_FRAMES = 16;

/** GET /api/stt -> is speech-to-text live, or in mock mode (the browser's own recognizer is used instead)? */
export function sttStatus(env = process.env) {
  return { ok: true, mode: env.GRADIUM_API_KEY ? 'live' : 'mock' };
}

// The incantation words to boost: plain letters only, no duplicates, a dozen at most.
function keywords(words) {
  const list = Array.isArray(words) ? words : String(words || '').split(/[\s,]+/);
  const seen = new Set(), out = [];
  for (const w of list) {
    const word = String(w || '').replace(/[^A-Za-z]/g, '');
    if (word.length < 2 || word.length > 24 || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    out.push(word);
    if (out.length >= MAX_WORDS) break;
  }
  return out;
}

// One call to Gradium. The reply is application/x-ndjson: one JSON object per line (ready, step, text, end_text,
// end_of_stream or error). A config Gradium doesn't accept comes back as HTTP 200 with an empty body.
async function transcribe(audio, config, env, signal) {
  const url = `${gradiumBase(env)}/api/post/speech/asr?json_config=${encodeURIComponent(JSON.stringify(config))}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'audio/wav', 'x-api-key': env.GRADIUM_API_KEY },
    body: audio,
    signal,
  });
  const body = await res.text();
  const messages = [];
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    try {
      messages.push(JSON.parse(line));
    } catch {
      /* not a JSON line: skip it */
    }
  }
  return { res, body, messages };
}

/**
 * POST /api/stt
 * audio: Buffer, a WAV clip. opts.words: words to boost (the carried incantations).
 * returns { status, json }: { ok: true, text } on success, { ok: true, mock: true } without a key, or { ok: false, error }
 */
export async function handleSTT(audio, { words } = {}, env = process.env) {
  if (!audio?.length) return { status: 400, json: { ok: false, error: 'Missing audio (a WAV body).' } };
  if (audio.length > MAX_AUDIO_BYTES) return { status: 413, json: { ok: false, error: `Audio too long (max ${MAX_AUDIO_BYTES} bytes).` } };

  // No key: mock mode. The browser falls back to its own speech recognition.
  if (!env.GRADIUM_API_KEY) return { status: 200, json: { ok: true, mock: true } };

  const config = { language: 'en', delay_in_frames: DELAY_FRAMES };
  const boost = keywords(words);
  if (boost.length) config.keywords = { words: boost, boost: KEYWORD_BOOST };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let { res, body, messages } = await transcribe(audio, config, env, controller.signal);
    // Rejected config (an empty reply, or a 400/422): once more with the plain one, slower but safe.
    if (!messages.length && (res.ok || res.status === 400 || res.status === 422)) ({ res, body, messages } = await transcribe(audio, { language: 'en' }, env, controller.signal));
    if (!res.ok) return { status: 502, json: { ok: false, error: `Gradium error (HTTP ${res.status}): ${body.slice(0, 300) || 'no transcript'}` } };
    if (!messages.length) return { status: 502, json: { ok: false, error: 'Gradium returned an empty reply.' } };
    const pieces = messages.filter((m) => m.type === 'text' && typeof m.text === 'string').map((m) => m.text.trim());
    const error = messages.find((m) => m.type === 'error');
    if (!pieces.length && error) return { status: 502, json: { ok: false, error: `Gradium error: ${String(error.message || error.error || 'unknown').slice(0, 300)}` } };
    return { status: 200, json: { ok: true, text: pieces.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() } };
  } catch (err) {
    const timedOut = err?.name === 'AbortError';
    return {
      status: timedOut ? 504 : 502,
      json: { ok: false, error: timedOut ? `Gradium timed out after ${TIMEOUT_MS} ms.` : `Gradium request failed: ${err?.message || err}` },
    };
  } finally {
    clearTimeout(timer);
  }
}

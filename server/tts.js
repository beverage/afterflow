// Server-side Gradium text-to-speech proxy. The API key never reaches the browser.
// Shared by the Vite dev server, Vercel (api/tts.js) and server.js. Uses only Node built-ins.
// Docs: https://docs.gradium.ai/guides/text-to-speech-rest

const DEFAULT_BASE = 'https://api.gradium.ai';
export const DEFAULT_VOICE_ID = 'YTpq7expH9539ERJ'; // "Emma", a Gradium catalog voice
const MAX_TEXT_CHARS = 1500;
const TIMEOUT_MS = 20000;
const VOICE_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

export const gradiumBase = (env = process.env) => (env.GRADIUM_API_BASE || DEFAULT_BASE).replace(/\/$/, '');

/** GET /api/tts -> is voice live or in mock mode (browser speech fallback)? */
export function ttsStatus(env = process.env) {
  const live = Boolean(env.GRADIUM_API_KEY);
  return { ok: true, mode: live ? 'live' : 'mock', voice: live ? env.GRADIUM_VOICE_ID || DEFAULT_VOICE_ID : null };
}

/**
 * POST /api/tts
 * body: { text: string, voice?: gradium voice id, config?: object (Gradium json_config, e.g. { temp: 0.7 }) }
 * returns { status, audio: Buffer, contentType } on success, or { status, json } (mock mode or error)
 */
export async function handleTTS(body, env = process.env) {
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return { status: 400, json: { ok: false, error: 'Missing "text" (string).' } };
  if (text.length > MAX_TEXT_CHARS) return { status: 413, json: { ok: false, error: `Text too long (max ${MAX_TEXT_CHARS} chars).` } };
  const voice = body.voice || env.GRADIUM_VOICE_ID || DEFAULT_VOICE_ID;
  if (!VOICE_ID_RE.test(voice)) return { status: 400, json: { ok: false, error: 'Invalid voice id.' } };

  // No key: mock mode. The browser helper falls back to built-in speech.
  if (!env.GRADIUM_API_KEY) return { status: 200, json: { ok: true, mock: true } };

  const payload = { text, voice_id: voice, output_format: 'wav', only_audio: true };
  if (body.config && typeof body.config === 'object' && !Array.isArray(body.config)) payload.json_config = body.config;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${gradiumBase(env)}/api/post/speech/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.GRADIUM_API_KEY },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('audio/')) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      return { status: 502, json: { ok: false, error: `Gradium error (HTTP ${res.status}): ${detail || 'no audio returned'}` } };
    }
    const audio = Buffer.from(await res.arrayBuffer());
    if (!audio.length) return { status: 502, json: { ok: false, error: 'Gradium returned empty audio.' } };
    return { status: 200, audio, contentType: type };
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

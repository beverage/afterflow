// Tiny request/response helpers shared by the dev server, Vercel and server.js.
import { aiStatus, handleGemini } from './gemini.js';
import { handleTTS, ttsStatus } from './tts.js';
import { MAX_AUDIO_BYTES, handleSTT, sttStatus } from './stt.js';

const MAX_BODY_BYTES = 64 * 1024;

export async function readJson(req) {
  // Vercel pre-parses JSON bodies; plain Node and Vite do not.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    return JSON.parse(String(req.body) || '{}');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

/** A binary body (an audio clip) as a Buffer, at most limit bytes. */
export async function readRaw(req, limit) {
  const tooBig = () => Object.assign(new Error(`Body too large (max ${limit} bytes).`), { status: 413 });
  // Vercel hands an application/octet-stream body over as a Buffer (and has already read the stream); Node and Vite stream it.
  const pre = req.body;
  if (pre !== undefined && pre !== null) {
    const buf = Buffer.isBuffer(pre) ? pre : pre instanceof Uint8Array ? Buffer.from(pre) : null;
    if (buf) {
      if (buf.length > limit) throw tooBig();
      return buf;
    }
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw tooBig();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

function sendAudio(res, audio, contentType) {
  res.statusCode = 200;
  res.setHeader('content-type', contentType);
  res.setHeader('content-length', String(audio.length));
  res.setHeader('cache-control', 'no-store');
  res.end(audio);
}

// GET -> status, POST -> handler. Works on any Node-style req/res (Vite, Vercel, node:http).
function makeRoute(getStatus, handle) {
  return async function route(req, res, env = process.env) {
    try {
      if (req.method === 'GET') return sendJson(res, 200, getStatus(env));
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Use GET or POST.' });
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err?.status || 400, { ok: false, error: err?.status ? err.message : 'Body must be JSON.' });
      }
      const out = await handle(body, env);
      if (out.audio) return sendAudio(res, out.audio, out.contentType);
      return sendJson(res, out.status, out.json);
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: `Server error: ${err?.message || err}` });
    }
  };
}

export const geminiRoute = makeRoute(aiStatus, handleGemini); // /api/gemini
export const ttsRoute = makeRoute(ttsStatus, handleTTS); // /api/tts

// /api/stt: GET -> status, POST -> the raw WAV clip as the body (sent as application/octet-stream), the words to
// boost in the query string (?words=Galene,Thalassa), and { ok, text } back.
export async function sttRoute(req, res, env = process.env) {
  try {
    if (req.method === 'GET') return sendJson(res, 200, sttStatus(env));
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Use GET or POST.' });
    let audio;
    try {
      audio = await readRaw(req, MAX_AUDIO_BYTES);
    } catch (err) {
      return sendJson(res, err?.status || 400, { ok: false, error: err?.status ? err.message : 'Could not read the audio.' });
    }
    const words = new URL(req.url || '/', 'http://x').searchParams.get('words') || '';
    const out = await handleSTT(audio, { words: words.split(',') }, env);
    return sendJson(res, out.status, out.json);
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: `Server error: ${err?.message || err}` });
  }
}

// Server-side Gemini proxy. The API key never reaches the browser.
// Shared by: the Vite dev server (vite.config.js), Vercel (api/gemini.js)
// and the plain Node server (server.js). Uses only Node built-ins.

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'; // fast + cheap; override with GEMINI_MODEL
const MAX_PROMPT_CHARS = 8000;
const TIMEOUT_MS = 20000;

const modelName = (env) => String(env.GEMINI_MODEL || DEFAULT_MODEL).replace(/^models\//, '');

/** GET /api/gemini -> is the AI live or in mock mode? */
export function aiStatus(env = process.env) {
  const live = Boolean(env.GEMINI_API_KEY);
  return { ok: true, mode: live ? 'live' : 'mock', model: live ? modelName(env) : null };
}

/**
 * POST /api/gemini
 * body: { prompt: string, system?: string, json?: boolean, schema?: JSONSchema, temperature?: number }
 * returns { status, json } where json = { ok, mock, model, text, data, error? }
 */
export async function handleGemini(body, env = process.env) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return reply(400, { ok: false, error: 'Missing "prompt" (string).' });
  if (prompt.length > MAX_PROMPT_CHARS) return reply(413, { ok: false, error: `Prompt too long (max ${MAX_PROMPT_CHARS} chars).` });

  const wantJson = body.json === true || isObject(body.schema);

  // No key: mock mode, so the game always runs. Callers show their fallback.
  if (!env.GEMINI_API_KEY) {
    return reply(200, { ok: true, mock: true, model: null, text: wantJson ? null : `[mock AI] ${prompt.slice(0, 80)}`, data: null });
  }

  const model = modelName(env);
  const payload = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  if (typeof body.system === 'string' && body.system.trim()) {
    payload.systemInstruction = { parts: [{ text: body.system.trim() }] };
  }
  const gen = {};
  if (wantJson) gen.responseMimeType = 'application/json';
  if (isObject(body.schema)) gen.responseJsonSchema = body.schema;
  if (typeof body.temperature === 'number') gen.temperature = body.temperature;
  if (Object.keys(gen).length) payload.generationConfig = gen;

  const base = (env.GEMINI_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  const post = (p) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify(p),
      signal: controller.signal,
    });

  try {
    let res = await post(payload);
    let raw = await res.json().catch(() => null);
    // If this model/API version rejects the schema field, retry with the schema spelled out in the prompt.
    if (res.status === 400 && gen.responseJsonSchema && /schema|unknown name/i.test(raw?.error?.message || '')) {
      delete gen.responseJsonSchema;
      payload.contents[0].parts[0].text = `${prompt}\n\nReply with JSON only, matching this JSON Schema:\n${JSON.stringify(body.schema)}`;
      res = await post(payload);
      raw = await res.json().catch(() => null);
    }
    if (!res.ok) {
      const msg = raw?.error?.message || `HTTP ${res.status}`;
      return reply(502, { ok: false, model, error: `Gemini error: ${msg}` });
    }
    const candidate = raw?.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => typeof p?.text === 'string' && !p.thought) // skip thought summaries
      .map((p) => p.text)
      .join('')
      .trim();
    if (!text) {
      const why = candidate?.finishReason || raw?.promptFeedback?.blockReason || 'unknown';
      return reply(502, { ok: false, model, error: `Gemini returned no text (reason: ${why}).` });
    }
    let data = null;
    if (wantJson) {
      data = parseJsonLoose(text);
      if (data === undefined) return reply(502, { ok: false, model, text, error: 'Gemini returned invalid JSON.' });
    }
    return reply(200, { ok: true, mock: false, model, text, data, ms: Date.now() - started });
  } catch (err) {
    const timedOut = err?.name === 'AbortError';
    return reply(timedOut ? 504 : 502, {
      ok: false,
      model,
      error: timedOut ? `Gemini timed out after ${TIMEOUT_MS} ms.` : `Gemini request failed: ${err?.message || err}`,
    });
  } finally {
    clearTimeout(timer);
  }
}

function reply(status, json) {
  return { status, json };
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Accepts plain JSON or JSON wrapped in ```json fences. Returns undefined if unparseable.
function parseJsonLoose(text) {
  const attempts = [text, text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')];
  for (const t of attempts) {
    try {
      return JSON.parse(t);
    } catch {
      /* try next */
    }
  }
  return undefined;
}

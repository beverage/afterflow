// Browser-side helper for the /api/gemini proxy (the key stays on the server).
// Rule: every call passes a `fallback`, so a slow network, missing key or API hiccup
// can never freeze or crash the demo. Check `source` to know what you got.

/**
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {string} [opts.system]       system instruction (persona, rules)
 * @param {boolean} [opts.json]        ask for JSON (implied when `schema` is given)
 * @param {object} [opts.schema]       JSON Schema for the reply
 * @param {number} [opts.temperature]
 * @param {number} [opts.timeoutMs]
 * @param {string|object} [opts.fallback] used on mock mode, errors and timeouts
 * @returns {Promise<{source: 'ai'|'mock'|'fallback', text: string|null, data: any, error?: string, ms: number}>}
 */
export async function askAI({ prompt, system, json = false, schema, temperature, timeoutMs = 12000, fallback = null } = {}) {
  const wantJson = json || Boolean(schema);
  const started = performance.now();
  const ms = () => Math.round(performance.now() - started);
  const fallbackText = typeof fallback === 'string' ? fallback : null;
  const fallbackData = fallback && typeof fallback === 'object' ? fallback : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, system, json: wantJson, schema, temperature }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
    if (body.mock) return { source: 'mock', text: fallbackText ?? body.text, data: wantJson ? fallbackData : null, ms: ms() };
    return { source: 'ai', text: body.text, data: body.data, model: body.model, ms: ms() };
  } catch (err) {
    const error = err?.name === 'AbortError' ? `AI timed out after ${timeoutMs} ms` : String(err?.message || err);
    console.warn('[askAI] using fallback:', error);
    return { source: 'fallback', text: fallbackText, data: fallbackData, error, ms: ms() };
  } finally {
    clearTimeout(timer);
  }
}

/** Is the server's AI live, mocked (no key) or unreachable? */
export async function getAIStatus() {
  try {
    const res = await fetch('/api/gemini', { signal: AbortSignal.timeout(3000) });
    const body = await res.json();
    return body?.ok ? body : { ok: false, mode: 'offline', model: null };
  } catch {
    return { ok: false, mode: 'offline', model: null };
  }
}

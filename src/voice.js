// Browser-side voice helper for the /api/tts proxy (Gradium). The key stays on the server.
// speak() never throws and never hangs: no key or an error -> the browser's built-in speech,
// and every promise resolves even if the audio never gets to play.
import { VOICES } from './voices.js';

let ctx = null; // one AudioContext for all voice lines
let current = null; // the line playing right now
const cache = new Map(); // "voice|text" -> Promise<AudioBuffer | null>

function audioContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Browsers only start audio after a user gesture. Unlock on the first taps/keys (iOS needs touchend).
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'];
function unlock() {
  const c = audioContext();
  if (!c) return;
  if (c.state === 'running') return UNLOCK_EVENTS.forEach((e) => window.removeEventListener(e, unlock, true));
  c.resume().catch(() => {});
  try {
    const s = c.createBufferSource(); // silent blip, needed by older iOS
    s.buffer = c.createBuffer(1, 1, 22050);
    s.connect(c.destination);
    s.start(0);
  } catch {
    /* ignore */
  }
}
UNLOCK_EVENTS.forEach((e) => window.addEventListener(e, unlock, true));

/**
 * Speak a line. Resolves when it finishes (or right away if it can't play).
 * @param {string} text  keep it short: one or two sentences
 * @param {object} [opts]
 * @param {string} [opts.voice]      key from src/voices.js (e.g. 'narrator') or a raw Gradium voice id
 * @param {'browser'|'none'} [opts.fallback='browser']  used in mock mode and on errors
 * @param {string} [opts.lang='en-US'] language for the browser fallback
 * @param {boolean} [opts.interrupt=true] stop whatever line is playing first
 * @param {number} [opts.volume=1]
 * @returns {Promise<{source: 'gradium'|'browser'|'none', error?: string}>}
 */
export async function speak(text, { voice, fallback = 'browser', lang = 'en-US', interrupt = true, volume = 1 } = {}) {
  if (!text) return { source: 'none' };
  if (interrupt) stopSpeaking();
  try {
    const buffer = await prepareSpeech(text, { voice });
    if (buffer) return await playBuffer(buffer, volume);
    return await browserSpeak(text, fallback, lang); // mock mode: no Gradium key on the server
  } catch (err) {
    console.warn('[speak] using fallback:', err?.message || err);
    return { ...(await browserSpeak(text, fallback, lang)), error: String(err?.message || err) };
  }
}

/** Fetch and decode a line ahead of time so speak() plays it instantly later. */
export function prepareSpeech(text, { voice } = {}) {
  const voiceId = VOICES[voice] || voice || undefined;
  const key = `${voiceId || 'default'}|${text}`;
  if (!cache.has(key)) {
    const p = fetchAndDecode(text, voiceId);
    p.catch(() => cache.delete(key)); // retry next time instead of caching the failure
    cache.set(key, p);
  }
  return cache.get(key);
}

export function stopSpeaking() {
  try {
    current?.stop();
  } catch {
    /* already stopped */
  }
  current = null;
  if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel();
}

/** Is Gradium live, mocked (browser speech) or unreachable? */
export async function getVoiceStatus() {
  try {
    const res = await fetch('/api/tts', { signal: AbortSignal.timeout(3000) });
    const body = await res.json();
    return body?.ok ? body : { ok: false, mode: 'offline' };
  } catch {
    return { ok: false, mode: 'offline' };
  }
}

async function fetchAndDecode(text, voiceId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceId }),
      signal: controller.signal,
    });
    if ((res.headers.get('content-type') || '').startsWith('audio/')) {
      const data = await res.arrayBuffer();
      const c = audioContext();
      if (!c) throw new Error('Web Audio not supported');
      return await c.decodeAudioData(data);
    }
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.mock) return null;
    throw new Error(body.error || `HTTP ${res.status}`);
  } catch (err) {
    throw err?.name === 'AbortError' ? new Error('Voice timed out') : err;
  } finally {
    clearTimeout(timer);
  }
}

function playBuffer(buffer, volume) {
  const c = audioContext();
  if (c.state !== 'running') c.resume().catch(() => {});
  return new Promise((resolve) => {
    const src = c.createBufferSource();
    const gain = c.createGain();
    gain.gain.value = volume;
    src.buffer = buffer;
    src.connect(gain).connect(c.destination);
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(safety);
      if (current === src) current = null;
      resolve({ source: 'gradium' });
    };
    const safety = setTimeout(done, (buffer.duration + 1) * 1000); // resolves even if audio is still locked
    src.onended = done;
    current = src;
    src.start();
  });
}

function browserSpeak(text, fallback, lang) {
  const synth = window.speechSynthesis;
  if (fallback !== 'browser' || !synth || typeof SpeechSynthesisUtterance === 'undefined') {
    return Promise.resolve({ source: 'none' });
  }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve({ source: 'browser' });
      }
    };
    u.onend = done;
    u.onerror = done;
    setTimeout(done, Math.min(15000, 1500 + text.length * 90)); // never hang
    synth.speak(u);
  });
}

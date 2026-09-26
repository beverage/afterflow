// Listens for scroll incantations with Gradium speech-to-text. A simple voice detector cuts the mic into short
// clips at pauses, and each clip goes to our /api/stt route (the key stays on the server) with the words of the
// carried incantations boosted. Echo cancellation keeps the gods' voices from the speakers out of the clips.
// The browser's built-in recognizer (Chrome, Edge, Safari; Chrome sends the audio to Google) takes over when the
// server has no Gradium key (mock mode) or Gradium keeps failing. A player can refuse the mic: the scroll panel
// then reads scrolls with keys or taps.
import { LISTEN } from './config.js';
import { encodeWav, resample } from './wav.js';

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const AC = window.AudioContext || window.webkitAudioContext;

let engine = navigator.mediaDevices?.getUserMedia && AC ? 'gradium' : Recognition ? 'browser' : null;
let status = engine ? 'off' : 'unsupported'; // 'off' | 'listening' | 'denied' | 'unsupported'
let want = false; // the game wants to hear right now
let onHeard = null;
let carried = []; // the carried incantations (strings or nulls): their words are boosted

/** 'off', 'listening', 'denied' (mic refused or not a secure page) or 'unsupported' (no way to hear). */
export const listenStatus = () => status;

/** False when scrolls must be read with keys or taps instead. */
export const canListen = () => status === 'off' || status === 'listening';

/**
 * Start or stop listening. heard(candidates) gets what was said since the last useHeard(), as a few
 * alternatives { all, last, final }: all the words, the latest phrase on its own, and whether that phrase is
 * finished. words: the incantations being carried, to help the recognizer spell them.
 * The first start asks for the mic: do it from a click or key.
 */
export function setListening(on, heard, words) {
  if (heard) onHeard = heard;
  if (words) carried = words;
  want = on && canListen();
  if (engine === 'gradium') {
    if (want && !stream && !opening) record();
    else if (!want && (stream || queued)) stopRecording();
  } else if (engine === 'browser') {
    if (want && !running && !restartTimer) begin();
    else if (!want) {
      clearTimeout(restartTimer);
      restartTimer = 0;
      if (running) rec.abort();
    }
  }
}

/** Forget what was heard so far, so the same words can't use a second scroll. */
export function useHeard() {
  said = []; // Gradium clips never overlap: only phrases joined together could bring the same words back
  from = latest + 1;
}

// Is Gradium configured on the server? If not (mock mode), the browser's recognizer hears from the start.
if (engine === 'gradium') {
  fetch('/api/stt')
    .then((r) => r.json())
    .then((s) => s?.mode === 'mock' && fallBack())
    .catch(() => {}); // unknown: try Gradium, and fall back if clips fail
}

// No Gradium for the rest of the session: hand over to the browser's recognizer, if there is one.
function fallBack() {
  if (engine !== 'gradium') return;
  stopRecording();
  engine = Recognition ? 'browser' : null;
  if (status !== 'denied') status = engine ? 'off' : 'unsupported';
  if (!engine) want = false;
  else if (want) begin();
}

/* ---------- Gradium: the mic cut into clips at pauses, each one sent to /api/stt ---------- */

let ctx = null; // kept for the session: a new one can only start from a click or key
let stream = null, source = null, proc = null, silent = null;
let opening = false; // waiting for the mic (and maybe the permission prompt)
let floor = 0.01; // the room's noise level, learned while nobody speaks
let pre = []; // the last moments before speech started
let clip = null; // the phrase being recorded: { frames, len, spoken, quiet } in seconds
let said = []; // phrases heard lately: { text, at }
let fails = 0; // failed clips in a row
let busy = false; // a clip is being transcribed
let queued = null; // the next clip, sent when that one is back (only the latest waits)

// Browsers may suspend audio when you switch apps: wake it on the next tap or key, like the sound effects.
for (const type of ['pointerup', 'touchend', 'keydown']) {
  window.addEventListener(type, () => ctx && ctx.state !== 'running' && ctx.resume().catch(() => {}), true);
}

async function record() {
  opening = true;
  try {
    ctx ||= new AC(); // created before the await, so the first one still counts as the player's click or key
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  } catch {
    opening = false;
    return fallBack();
  }
  let mic;
  try {
    mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
  } catch {
    opening = false;
    status = 'denied'; // refused, no mic, or not a secure page
    want = false;
    return;
  }
  opening = false;
  if (!want || engine !== 'gradium') return mic.getTracks().forEach((t) => t.stop());
  try {
    stream = mic;
    source = ctx.createMediaStreamSource(mic);
    proc = ctx.createScriptProcessor(LISTEN.frame, 1, 1);
    silent = ctx.createGain();
    silent.gain.value = 0; // the processor only runs when connected to the speakers: at zero volume
    proc.onaudioprocess = (e) => hear(e.inputBuffer.getChannelData(0));
    source.connect(proc);
    proc.connect(silent).connect(ctx.destination);
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    mic.getTracks().forEach((t) => (t.onended = () => stream === mic && stopRecording())); // unplugged: reopen next time
    status = 'listening';
  } catch {
    stopRecording();
    fallBack();
  }
}

function stopRecording() {
  if (stream) stream.getTracks().forEach((t) => t.stop()); // releases the mic (and the browser's recording light)
  try {
    source?.disconnect();
    proc?.disconnect();
    silent?.disconnect();
  } catch {
    /* already disconnected */
  }
  if (proc) proc.onaudioprocess = null;
  stream = source = proc = silent = null;
  clip = null;
  pre = [];
  queued = null;
  if (status === 'listening') status = 'off';
}

// One mic frame: a simple voice detector. Speech starts well above the room's noise floor and ends after a pause.
function hear(data) {
  const frame = new Float32Array(data); // the browser reuses its buffer
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  const level = Math.sqrt(sum / frame.length), dt = frame.length / ctx.sampleRate;
  if (!clip) {
    if (level > Math.max(floor * LISTEN.startRatio, LISTEN.minLevel)) {
      clip = { frames: [...pre, frame], len: dt, spoken: dt, quiet: 0 };
      pre = [];
      return;
    }
    floor = Math.max(LISTEN.floorMin, floor + (level - floor) * (level < floor ? 0.3 : 0.03)); // falls fast, rises slowly
    pre.push(frame);
    if (pre.length * dt > LISTEN.preRoll) pre.shift();
    return;
  }
  clip.frames.push(frame);
  clip.len += dt;
  if (level > Math.max(floor * LISTEN.stayRatio, LISTEN.minLevel)) {
    clip.spoken = clip.len;
    clip.quiet = 0;
  } else clip.quiet += dt;
  floor += (level - floor) * 0.002; // a room that stays loud slowly becomes the new quiet
  if (clip.quiet >= LISTEN.endQuiet || clip.len >= LISTEN.maxClip) {
    const done = clip;
    clip = null;
    if (done.spoken >= LISTEN.minSpeech) send(done);
  }
}

function send({ frames }) {
  const samples = new Float32Array(frames.reduce((n, f) => n + f.length, 0));
  let at = 0;
  for (const f of frames) {
    samples.set(f, at);
    at += f.length;
  }
  const wav = encodeWav(resample(samples, ctx.sampleRate, LISTEN.rate), LISTEN.rate);
  if (busy) queued = wav;
  else post(wav);
}

async function post(wav) {
  busy = true;
  const words = carried.filter(Boolean).join(' ').split(/\s+/).filter(Boolean);
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), LISTEN.timeoutMs);
  let out = null;
  try {
    const res = await fetch(`/api/stt?words=${encodeURIComponent(words.join(','))}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' }, // Vercel hands this over as raw bytes
      body: wav,
      signal: abort.signal,
    });
    out = await res.json();
  } catch {
    out = null; // network error, timeout, or not JSON
  } finally {
    clearTimeout(timer);
    busy = false;
  }
  if (engine !== 'gradium') return;
  if (out?.mock) return fallBack();
  if (out?.ok && typeof out.text === 'string') {
    fails = 0;
    if (out.text.trim()) deliver(out.text.trim());
  } else if (++fails >= LISTEN.maxFails) return fallBack();
  if (queued) {
    const next = queued;
    queued = null;
    post(next);
  }
}

// A phrase came back: phrases from the last few seconds are matched together, so a pause between the words is fine.
function deliver(text) {
  if (!want || !onHeard) return;
  const now = performance.now();
  said = said.filter((s) => now - s.at < LISTEN.joinSeconds * 1000);
  said.push({ text, at: now });
  onHeard([{ all: said.map((s) => s.text).join(' '), last: text, final: true }]);
}

/* ---------- the browser's own recognizer: the fallback without Gradium ---------- */
// Chrome ends a session after a stretch of silence, so it restarts on its own while the game wants to hear.

let rec = null;
let running = false; // a recognition session is open
let from = 0; // results before this index were already used
let latest = -1; // index of the newest result in this session
let recFails = 0;
let restartTimer = 0;

function begin() {
  clearTimeout(restartTimer);
  restartTimer = 0;
  if (!rec) {
    rec = new Recognition();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true; // match while the player is still speaking
    rec.maxAlternatives = 3;
    rec.onstart = () => {
      if (status === 'off') status = 'listening';
    };
    rec.onresult = (e) => {
      recFails = 0;
      latest = e.results.length - 1;
      const words = [];
      for (let i = from; i < e.results.length; i++) words.push(e.results[i][0].transcript);
      if (!onHeard || !words.length) return;
      const last = e.results[latest], head = words.slice(0, -1).join(' ');
      const candidates = [];
      for (let a = 0; a < last.length; a++) {
        const phrase = last[a].transcript.trim();
        if (phrase) candidates.push({ all: `${head} ${phrase}`.trim(), last: phrase, final: last.isFinal });
      }
      if (candidates.length) onHeard(candidates);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        status = 'denied';
        want = false;
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') recFails++;
    };
    rec.onend = () => {
      running = false;
      if (status === 'listening') status = 'off';
      if (want) restartTimer = setTimeout(begin, Math.min(4000, 120 * 2 ** recFails));
    };
  }
  from = 0;
  latest = -1;
  try {
    rec.start();
    running = true;
  } catch {
    running = true; // already started: onend will follow
  }
}

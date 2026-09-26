// Plays the gods' recorded lines in the game (public/npc-voices/, listed in manifest.js).
//   prepareGodVoices();                 // downloads every line; call it again once sound is unlocked to decode them
//   const line = godSay('ares', 'shout'); // { text, seconds, ... } to show on screen, or null: the god stays quiet
// One line at a time: a line only cuts in on a less urgent one (verdict, then smite and run start, then the
// 80% and 50% rage warnings, then small talk), and small talk (shout, hurry, streak) also waits VOICE.gap
// seconds after the last line.
// The audio goes through the sound effects' output (src/sfx.js), so M mutes it. A muted or not yet downloaded
// line is still returned, so the caller shows it anyway: phones are often muted.
import { AUDIO } from './manifest.js';
import { getHeroAudio } from './picker.js';
import { voiceOut } from '../sfx.js';
import { VOICE } from '../config.js';

const PRIORITY = { verdict: 4, smite: 3, run_start: 3, rage_80: 2, rage_50: 1 }; // anything else is small talk: 0
const ORDER = ['run_start', 'rage_50', 'rage_80', 'smite', 'hurry', 'shout', 'streak', 'verdict']; // download order: the long verdicts last

function rank(moment) {
  const i = ORDER.indexOf(moment);
  return i < 0 ? ORDER.length : i;
}

const PATHS = Object.values(AUDIO)
  .flatMap((moments) => Object.entries(moments))
  .sort(([a], [b]) => rank(a) - rank(b))
  .flatMap(([, lines]) => lines.map((l) => l.path));

const bytes = new Map(); // path -> Promise<ArrayBuffer | null>
const buffers = new Map(); // path -> decoded AudioBuffer
const decoding = new Set();
let current = null; // the line playing now
let busyUntil = 0; // performance.now() when the current line ends
let busyPriority = -1;
let quietUntil = 0; // small talk waits until then

/** Download every line in the background, and decode them once sound is unlocked (the title's tap). Safe to call again. */
export function prepareGodVoices() {
  for (const path of PATHS) {
    if (!bytes.has(path)) bytes.set(path, fetch(path).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
  }
  const out = voiceOut();
  if (!out) return;
  for (const path of PATHS) {
    if (buffers.has(path) || decoding.has(path)) continue;
    decoding.add(path);
    bytes
      .get(path)
      .then((data) => data && out.ac.decodeAudioData(data.slice(0))) // a copy: decoding empties the buffer it's given
      .then((buffer) => buffer && buffers.set(path, buffer))
      .catch(() => {})
      .finally(() => decoding.delete(path));
  }
}

/**
 * A god says a line for this moment, if it may speak now. Never throws and never waits.
 * @param {string} name   'athena', 'ares', 'poseidon' or 'hades'
 * @param {string} moment run_start, shout, hurry, rage_50, rage_80, streak, smite, verdict (Hades)
 * @returns {{ text: string, seconds: number } | null} the line to show on screen, or null if the god stays quiet
 */
export function godSay(name, moment) {
  const now = performance.now(), priority = PRIORITY[moment] ?? 0;
  if (now < busyUntil && priority <= busyPriority) return null; // someone is speaking
  if (!priority && now < quietUntil) return null; // small talk leaves room between lines
  // Warnings, smites and Hades must play: they skip the picker's per-god cooldown.
  const line = getHeroAudio(name, moment, { cooldown: priority ? 0 : undefined, now });
  if (!line) return null;
  play(line.path);
  busyUntil = now + line.seconds * 1000;
  busyPriority = priority;
  quietUntil = busyUntil + VOICE.gap * 1000;
  return line;
}

/** Silence the line playing now: the player moved on from the game-over screen. */
export function stopGodVoice() {
  stopSource();
  busyUntil = 0;
  busyPriority = -1;
}

/** For the console: how many lines can play right now, and whether a god is speaking. */
export const godVoiceStatus = () => ({ ready: buffers.size, total: PATHS.length, speaking: performance.now() < busyUntil });

function play(path) {
  stopSource();
  const out = voiceOut(), buffer = buffers.get(path);
  if (!out || !buffer) return; // not downloaded yet: the line still shows on screen
  if (out.ac.state !== 'running') out.ac.resume().catch(() => {});
  const src = out.ac.createBufferSource();
  src.buffer = buffer;
  src.connect(out.bus);
  src.onended = () => current === src && (current = null);
  src.start();
  current = src;
}

function stopSource() {
  try {
    current?.stop();
  } catch {
    /* already stopped */
  }
  current = null;
}

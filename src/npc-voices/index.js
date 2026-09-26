// NPC voices: gods speak their lines through the existing speak() helper (src/voice.js),
// which calls our /api/tts proxy (Gradium). The key stays on the server; without it,
// the browser's built-in speech reads the line instead.
//   import { npcSay, prepareNpc } from './npc-voices/index.js';
//   prepareNpc('ares');                        // at scene start: fetch every line ahead of time
//   const { text } = npcSay('ares', 'rage_80'); // plays a random line, show `text` on screen
// Try it from the browser console on the dev server:
//   (await import('/src/npc-voices/index.js')).npcSay('ares', 'run_start')
// Pre-recorded lines (public/npc-voices/, no network at play time): getHeroAudio() in picker.js picks one,
// godSay() in player.js plays it in the game (RiverScene, GameOverScene).
import { speak, prepareSpeech } from '../voice.js';
import { NPCS } from './heroes.js';

export { NPCS, heroKey } from './heroes.js';
export { getHeroAudio, resetHeroAudio, COOLDOWN_S } from './picker.js';
export { godSay, prepareGodVoices, stopGodVoice, godVoiceStatus } from './player.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * Speak a random line for an NPC event. Never throws and never blocks gameplay.
 * @returns {{ text: string|null, done: Promise }} text to show on screen, and when the line ends
 */
export function npcSay(npcKey, event, opts = {}) {
  const npc = NPCS[npcKey];
  const list = npc?.lines[event];
  if (!list?.length) {
    console.warn(`[npc-voices] no line for ${npcKey}.${event}`);
    return { text: null, done: Promise.resolve({ source: 'none' }) };
  }
  const text = pick(list);
  return { text, done: speak(text, { ...opts, voice: npc.voiceId || undefined }) };
}

// Gradium allows only 2 requests at a time: preload one line after another,
// which leaves the other slot free for a line the game needs right now.
let queue = Promise.resolve();

/** Fetch and decode every line of an NPC in the background so npcSay plays instantly. */
export function prepareNpc(npcKey) {
  const npc = NPCS[npcKey];
  if (!npc) return;
  for (const text of Object.values(npc.lines).flat()) {
    queue = queue.then(() => prepareSpeech(text, { voice: npc.voiceId || undefined }).catch(() => {}));
  }
}

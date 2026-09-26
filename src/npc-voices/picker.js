// Picks which pre-recorded line a god says, from the generated manifest (npm run npc:audio).
//   getHeroAudio('ares')                          -> { path: '/npc-voices/ares/shout_fool.mp3', text: 'Fool!', id: 5 }
//   getHeroAudio('ares', 'hurry')                 -> only hurry_… lines
//   getHeroAudio('ares', 'smite', { cooldown: 0 }) -> ignores the cooldown, for moments that must play
//   getHeroAudio('hades', 'verdict', { id: 3 })    -> exactly the 3rd verdict line (special events)
// id: 1-based, in the order of the lines in src/npc-voices/<god>.js. It ignores the cooldown and
// leaves the shuffle bag alone. A wrong id returns null and warns with the valid range.
// Shuffle bag: every line of a god's moment plays once before any comes back, never twice in a row.
// Cooldown: a god who just spoke stays quiet for COOLDOWN_S (other gods can still speak).
// Returns null (never throws) for an unknown god or moment, no audio yet, or while cooling down:
// the caller then shows the text only, or nothing.
import { AUDIO } from './manifest.js';
import { heroKey } from './heroes.js';

export const COOLDOWN_S = 3;

const bags = new Map(); // 'ares/shout' -> { queue: [entries], last: entry | null }
const lastSpoke = new Map(); // 'ares' -> ms timestamp

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function draw(key, files) {
  let bag = bags.get(key);
  if (!bag) bags.set(key, (bag = { queue: [], last: null }));
  if (bag.queue.length === 0) {
    bag.queue = shuffle([...files]);
    // No repeat where one bag ends and the next begins.
    if (bag.queue.length > 1 && bag.queue[0].path === bag.last?.path) {
      [bag.queue[0], bag.queue[1]] = [bag.queue[1], bag.queue[0]];
    }
  }
  bag.last = bag.queue.shift();
  return bag.last;
}

/**
 * @param {string} name      god name, any case or spelling in ALIASES ("Ares", "athene")
 * @param {string} [moment='shout'] shout, hurry, run_start, rage_50, rage_80, streak, smite, verdict (Hades)
 * @param {{ id?: number, cooldown?: number, now?: number }} [opts]
 *   id: a specific line (1 = first); cooldown in seconds; now (ms) is for tests
 * @returns {{ id: number, path: string, text: string, seconds: number } | null}
 */
export function getHeroAudio(name, moment = 'shout', { id, cooldown = COOLDOWN_S, now = performance.now() } = {}) {
  const hero = heroKey(name);
  const files = hero && AUDIO[hero]?.[moment];
  if (!files?.length) return null;

  let entry;
  if (id !== undefined) {
    entry = Number.isInteger(id) ? files[id - 1] : undefined;
    if (!entry) {
      console.warn(`[npc-voices] ${hero}/${moment} has no line ${id} (valid: 1-${files.length})`);
      return null;
    }
  } else {
    const last = lastSpoke.get(hero);
    if (last !== undefined && now - last < cooldown * 1000) return null;
    entry = draw(`${hero}/${moment}`, files);
  }

  lastSpoke.set(hero, now);
  const { path, text, seconds } = entry;
  return { id: files.indexOf(entry) + 1, path, text, seconds };
}

/** Forget bags and cooldowns (tests, or a fresh run). */
export function resetHeroAudio() {
  bags.clear();
  lastSpoke.clear();
}

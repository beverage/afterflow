// Every god with a voice, by key. No browser code here: scripts/npc-audio.js reads it in Node too.
import { ARES } from './ares.js';
import { HADES } from './hades.js';
import { ATHENA } from './athena.js';

export const NPCS = { ares: ARES, hades: HADES, athena: ATHENA };

// Other spellings players and teammates use -> key in NPCS.
export const ALIASES = { athene: 'athena' };

/** "Ares", " ARES ", "Athéné" -> 'ares' / 'athena'. null if unknown. */
export function heroKey(name) {
  const key = String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  const hero = ALIASES[key] || key;
  return Object.hasOwn(NPCS, hero) ? hero : null;
}

/** "You worm!" -> "you-worm": the file name part of a line. */
export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

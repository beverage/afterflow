// Scrolls from Hermes' stall: one per god, each with a short incantation. Say it aloud to calm that god.
// Gemini writes fresh incantations in the background; canned ones cover mock mode, errors and timeouts.
// Incantations stick to plain everyday words, because the browser's speech recognition has to catch them.
import { askAI } from './ai.js';
import { GODS, SCROLLS } from './config.js';

const CANNED = {
  athena: ['Wise owl, guide my boat', 'Grey eyes, forgive the ferryman', 'Olive and owl, be calm', 'Goddess of wisdom, hear me', 'Silver owl, watch over me'],
  ares: ['Lord of war, lower your spear', 'Iron and fire, rest now', 'Red shield, sleep tonight', 'Bronze spear, stay your hand', 'Soldier god, drop your sword'],
  poseidon: ['Salt and thunder, calm the tide', 'King of the sea, hush the waves', 'Trident down, the water sleeps', 'White horses, ride away', 'Deep blue king, be gentle'],
};

const SYMBOLS = {
  athena: 'owl, wisdom, grey eyes, olive tree, weaving, silver',
  ares: 'spear, war, bronze, shield, fire, blood',
  poseidon: 'trident, sea, tide, waves, salt, storm, horses',
};

const ready = {}; // god key -> the next incantation, written ahead so buying one is instant
const used = new Set(); // lines already sold this run, so they don't repeat

/** Start of a run: forget old lines and have Gemini write one per god in the background. */
export function prepareIncantations() {
  used.clear();
  for (const god of GODS) {
    ready[god.key] = null;
    write(god);
  }
}

/** The incantation for a scroll being bought right now (never waits), and a fresh one is written for next time. */
export function takeIncantation(godIndex) {
  const god = GODS[godIndex];
  let line = ready[god.key];
  if (!line || used.has(line)) line = CANNED[god.key].find((l) => !used.has(l)) || CANNED[god.key][0];
  used.add(line);
  ready[god.key] = null;
  write(god);
  return line;
}

async function write(god) {
  const { data } = await askAI({
    system: 'You write incantations for a game about ferrying souls down the river of the dead, past the shrines of Greek gods.',
    prompt:
      `Write one incantation a ferryman says aloud to calm ${god.name}: a plea like a line from a hymn, ` +
      `calling on the god and asking for something, such as ${examples(god)}. ` +
      `3 to 6 plain, everyday English words that a speech recognizer will catch, vivid and easy to remember. ` +
      `Draw on ${god.name}'s symbols: ${SYMBOLS[god.key]}. No names of other gods, no invented or ancient words, ` +
      `no punctuation except one comma. Don't use any of these: ${[...used].join('; ') || 'none'}.`,
    schema: { type: 'object', properties: { incantation: { type: 'string' } }, required: ['incantation'] },
    temperature: 1,
    timeoutMs: 8000,
    fallback: { incantation: null },
  });
  const line = tidy(data?.incantation);
  if (line && !used.has(line) && !ready[god.key]) ready[god.key] = line;
}

// Two canned lines from the other gods, as a model of the shape without handing over this god's lines.
const examples = (god) =>
  GODS.filter((g) => g !== god)
    .map((g) => `"${CANNED[g.key][0]}"`)
    .join(' or ');

// Keep only lines a player can say and the recognizer can hear: 3 to 7 words of plain letters.
function tidy(text) {
  if (typeof text !== 'string') return null;
  const line = text.replace(/[.!?;:"“”]/g, '').replace(/\s+/g, ' ').trim();
  const n = words(line).length;
  if (n < 3 || n > 7 || !/^[A-Za-z' ,-]+$/.test(line)) return null;
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/* ---------- hearing: does what the player said match a scroll they carry? ---------- */

const SMALL = new Set(['a', 'an', 'the', 'of', 'my', 'your', 'and', 'to', 'me', 'o', 'oh', 'be', 'in', 'on', 'for', 'is', 'it', 'at', 'now']);

const words = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z' ]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/'/g, ''))
    .filter(Boolean);

const stem = (w) => w.replace(/(ing|ed|es|s)$/, '');

function edits(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// Close enough: recognizers drop plurals and swap a letter or two ("spear" / "spears", "hush" / "husch").
function same(a, b) {
  if (a === b || stem(a) === stem(b)) return true;
  const d = edits(a, b);
  return (Math.min(a.length, b.length) >= 4 && d <= 1) || (Math.min(a.length, b.length) >= 6 && d <= 2);
}

/** Share (0-1) of an incantation's words found among what was heard. Small words count for little. */
export function matchScore(incantation, heard) {
  const want = words(incantation), got = words(heard).slice(-16);
  let total = 0, found = 0;
  for (const w of want) {
    const weight = SMALL.has(w) ? 0.25 : 1;
    total += weight;
    if (got.some((g) => same(w, g))) found += weight;
  }
  return total ? found / total : 0;
}

/** Which carried scroll (god index) did the player just say, or -1. carried: incantation or null, per god. */
export function heardScroll(carried, candidates) {
  let best = -1, bestScore = SCROLLS.match;
  carried.forEach((line, god) => {
    if (!line) return;
    for (const heard of candidates) {
      const s = matchScore(line, heard);
      if (s >= bestScore) {
        best = god;
        bestScore = s;
      }
    }
  });
  return best;
}

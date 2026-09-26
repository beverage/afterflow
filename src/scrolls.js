// Scrolls from Hermes' stall: one per god, each with a two-word incantation in crypto-Greek (like the
// crypto-Latin spells of Harry Potter, built from real Greek roots tied to the god). Say it aloud to calm that god.
// Gemini writes fresh incantations in the background; canned ones cover mock mode, errors and timeouts.
// The recognizer hears invented words as English ("Thalassa" -> "the lasso"), so matching goes by sound.
import { askAI } from './ai.js';
import { GODS, SCROLLS } from './config.js';

// [incantation, meaning]
const CANNED = {
  athena: [['Glaukos Eirena', 'grey-eyed one, grant peace'], ['Noesis Glaukra', 'mind of the owl'], ['Metira Pallada', 'Pallas, counsel me'], ['Parthena Sophos', 'wise maiden, hear me'], ['Aigidos Sophren', 'aegis, keep me wise']],
  ares: [['Polemos Pausa', 'war, cease'], ['Doru Hypnos', 'spear, sleep'], ['Aspida Hesychos', 'shield, be still'], ['Chalkeos Eirene', 'bronze, find peace'], ['Phobos Katheudo', 'fear, lie down']],
  poseidon: [['Galene Thalassa', 'calm, O sea'], ['Triana Galenos', 'trident, bring calm'], ['Kymata Hesyche', 'waves, be still'], ['Bythos Galena', 'deep one, be calm'], ['Pontos Eudia', 'open sea, fair skies']],
};

// Real Greek roots for Gemini to build on, in forms an English speaker can say.
const ROOTS = {
  athena: 'glaux (owl), glaukos (grey-eyed), sophia (wisdom), noos (mind), elai- (olive), metis (counsel), aigis (aegis), pallas, parthenos (maiden)',
  ares: 'polemos (war), doru (spear), aspis (shield), chalkos (bronze), haima (blood), phobos (fear), eirene (peace), pausis (a stop), hypnos (sleep)',
  poseidon: 'thalassa (sea), pontos (open sea), kyma (wave), galene (calm sea), trian- (trident), hippos (horse), seismos (quake), bythos (the deep)',
};

const ready = {}; // god key -> the next incantation, written ahead so buying one is instant
const used = new Set(); // incantations already sold this run, so they don't repeat
const meanings = new Map(); // incantation -> its meaning in English, shown at the stall

/** Start of a run: forget old incantations and have Gemini write one per god in the background. */
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
  if (!line || used.has(line)) {
    const [words, meaning] = CANNED[god.key].find(([l]) => !used.has(l)) || CANNED[god.key][0];
    line = words;
    meanings.set(line, meaning);
  }
  used.add(line);
  ready[god.key] = null;
  write(god);
  return line;
}

/** What an incantation means, in a few English words ('' if unknown). */
export const meaningOf = (line) => meanings.get(line) || '';

async function write(god, tries = 2) {
  const other = GODS.find((g) => g !== god);
  const [example, exampleMeaning] = CANNED[other.key][0];
  const { data } = await askAI({
    system: 'You write incantations for a game about ferrying souls down the river of the dead, past the shrines of Greek gods.',
    prompt:
      `Invent a two-word incantation a ferryman speaks aloud to calm ${god.name}. Write it in crypto-Greek, the way the ` +
      `spells in Harry Potter are crypto-Latin: real ancient Greek roots tied to ${god.name}, bent into solemn, spell-like ` +
      `words. Roots to draw on: ${ROOTS[god.key]}. Each word 2 to 4 syllables, plain letters a-z with no accents. ` +
      `An English speaker must be able to read every word aloud at first sight: simple syllables like Ga-le-ne or ` +
      `Po-le-mos, never three vowels in a row, no "ao" or "uo", no openings like ps, pn, mn, gn or chth ("Pauo" or ` +
      `"Chthonios" would be too hard). Solemn and ancient, never silly. For ${other.name}, one would be "${example}" (${exampleMeaning}). ` +
      `Also give its meaning in 2 to 5 English words. Don't use any of these: ${[...used].join('; ') || 'none'}.`,
    schema: {
      type: 'object',
      properties: { incantation: { type: 'string' }, meaning: { type: 'string' } },
      required: ['incantation', 'meaning'],
    },
    temperature: 1,
    timeoutMs: 8000,
    fallback: { incantation: null, meaning: null },
  });
  const line = tidy(data?.incantation);
  if (!line && tries > 1 && !ready[god.key]) return write(god, tries - 1); // one more go before the canned ones
  if (!line || used.has(line) || ready[god.key]) return;
  ready[god.key] = line;
  meanings.set(line, typeof data.meaning === 'string' ? data.meaning.trim().replace(/[.!]+$/, '').toLowerCase().slice(0, 40) : '');
}

// Two sayable words of 4 to 11 plain letters, with enough consonants to be told apart by sound.
function tidy(text) {
  if (typeof text !== 'string') return null;
  const parts = text.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/);
  if (parts.length !== 2 || parts.some((w) => w.length < 4 || w.length > 11)) return null;
  const line = parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return pronounceable(line) && consonants(sound(line)) >= 5 ? line : null;
}

/**
 * Can an English speaker read it aloud at first sight? Plain syllables only: no three vowels in a row or hard
 * vowel pairs ("Pauo", "Triaina"), no pile-ups of consonants, no Greek openings English never uses ("Pneuma", "Chthonios").
 */
export function pronounceable(line) {
  return String(line)
    .toLowerCase()
    .split(/\s+/)
    .every((w) => {
      if (/^(ps|pn|pt|mn|gn|kn|tl|dm|ks|x|ts|tz|chth|phth|bd)/.test(w)) return false;
      if (/[aeiouy]{3}|ao|uo|uu|ii|aa/.test(w)) return false;
      const runs = w.replace(/th|ph|ch|kh|sh|rh/g, 'T').match(/[^aeiouy]+/g) || [];
      if (runs.some((r) => r.length > 3 || (r.length === 3 && !/[srl]/.test(r)))) return false;
      const syllables = (w.match(/[aeiouy]+/g) || []).length;
      return syllables >= 2 && syllables <= 4;
    });
}

/* ---------- hearing: does what the player said sound like a scroll they carry? ---------- */

const VOWEL = /[aeiou]/;
const consonants = (key) => key.replace(/[aeiou]/g, '').length;

// A rough sound key: spellings that sound alike collapse ("Thalassa" and "the lasso" both give "talasa" / "telaso"),
// voiced and unvoiced consonants merge (accents and recognizers swap them), and a run of vowels counts as one.
function sound(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/[ckg]h/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/[cqg]/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/b/g, 'p')
    .replace(/d/g, 't')
    .replace(/[vw]/g, 'f')
    .replace(/z/g, 's')
    .replace(/y/g, 'i')
    .replace(/h/g, '')
    .replace(/[aeiou]+/g, (v) => v[0])
    .replace(/(.)\1+/g, '$1');
}

const NEAR = ['mn', 'lr', 'pf', 'sk'];
function swap(a, b) {
  if (a === b) return 0;
  const va = VOWEL.test(a), vb = VOWEL.test(b);
  if (va && vb) return 0.35;
  if (va !== vb) return 1.2;
  return NEAR.some((p) => p.includes(a) && p.includes(b)) ? 0.6 : 1;
}
const gap = (c) => (VOWEL.test(c) ? 0.45 : 1);

const weight = (key) => [...key].reduce((w, c) => w + gap(c), 0);

// Align a sound key against the best-matching stretch of what was heard: talk before or after it costs nothing.
function align(want, got) {
  if (!want || !got) return 0;
  let prev = new Array(got.length + 1).fill(0);
  for (let i = 1; i <= want.length; i++) {
    const cur = [prev[0] + gap(want[i - 1])];
    for (let j = 1; j <= got.length; j++) {
      cur[j] = Math.min(prev[j - 1] + swap(want[i - 1], got[j - 1]), prev[j] + gap(want[i - 1]), cur[j - 1] + gap(got[j - 1]));
    }
    prev = cur;
  }
  return Math.max(0, 1 - Math.min(...prev) / weight(want));
}

/**
 * Did this (one alternative of what the mic heard) say the incantation? Two ways to succeed:
 * both words came through, even garbled; or one word came through clearly as a short phrase of its own.
 * Other people and the room tend to talk in longer stretches, which can only use a scroll with both words in them.
 * score (0-1) is how close the nearest part came, to decide whether what was heard is worth showing.
 */
export function judge(incantation, heard) {
  const got = sound(heard.all.split(/\s+/).slice(-10).join(''));
  const whole = align(sound(incantation), got);
  const words = incantation.split(/\s+/).map(sound);
  const each = words.map((w) => align(w, got));
  const both = whole >= SCROLLS.match && each.every((e) => e >= SCROLLS.wordMatch);
  const phrase = heard.last.split(/\s+/).filter(Boolean);
  const alone = heard.final && phrase.length <= SCROLLS.oneWordPhrase;
  const one = alone && words.some((w) => align(w, sound(heard.last)) >= (weight(w) >= 3.5 ? SCROLLS.oneWord : SCROLLS.oneShortWord));
  return { pass: both || one, score: Math.max(whole, ...each) };
}

/** Which carried scroll the player just said: { god, pass, score } for the closest one, or null if none is carried. */
export function heardScroll(carried, candidates) {
  let best = null;
  carried.forEach((line, god) => {
    if (!line) return;
    for (const heard of candidates) {
      const j = { god, ...judge(line, heard) };
      if (!best || j.pass > best.pass || (j.pass === best.pass && j.score > best.score)) best = j;
    }
  });
  return best;
}

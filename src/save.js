// What this device remembers between runs: the best run, the last one and lifetime totals. No accounts.
// One versioned localStorage record. If storage is blocked (private browsing), the game works the same
// and forgets on reload. Add ?fresh to the URL to start over, as on a first visit.
import { GODS } from './config.js';

const KEY = 'soul-drift-save';
const VERSION = 1;

const blank = () => ({
  v: VERSION,
  runs: 0,
  souls: 0, // delivered, all runs
  clutches: 0,
  obols: 0, // earned, all runs
  distance: 0, // px travelled, all runs
  deaths: GODS.map(() => 0), // times each god sank you
  best: null, // the run that went furthest: { distance, delivered, earned, bestStreak, clutches, god }
  last: null, // the latest run, same shape
});

let data = load();
let counted = { id: null, delivered: 0, clutches: 0, earned: 0, distance: 0 }; // what the current run already added

function load() {
  try {
    if (new URLSearchParams(location.search).has('fresh')) localStorage.removeItem(KEY);
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.v === VERSION) return { ...blank(), ...saved };
  } catch {
    // blocked or unreadable: start blank
  }
  return blank();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // private browsing: kept in memory until reload
  }
}

/** The save, read-only by convention. */
export const getSave = () => data;

/**
 * Records a sinking. Charon's fee can revive the run, so the same run can sink again: calls with the
 * same `id` only add what's new to the totals. Returns the best distance before this call.
 */
export function recordRun(id, run) {
  const previousBest = data.best?.distance ?? 0;
  if (counted.id !== id) {
    data.runs += 1;
    counted = { id, delivered: 0, clutches: 0, earned: 0, distance: 0 };
  }
  data.souls += run.delivered - counted.delivered;
  data.clutches += run.clutches - counted.clutches;
  data.obols += run.earned - counted.earned;
  data.distance += run.distance - counted.distance;
  counted = { id, delivered: run.delivered, clutches: run.clutches, earned: run.earned, distance: run.distance };
  if (run.god !== undefined) data.deaths[run.god] += 1;
  data.last = { distance: run.distance, delivered: run.delivered, earned: run.earned, bestStreak: run.bestStreak, clutches: run.clutches, god: run.god };
  if (run.distance > previousBest) data.best = data.last;
  persist();
  return previousBest;
}

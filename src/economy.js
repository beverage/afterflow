// Obols, prices and upgrade effects. Prices climb exponentially, so soul value grows with distance too.
import { TUNING, UPGRADES } from './config.js';

const U = Object.fromEntries(UPGRADES.map((u) => [u.key, u]));

/** Obols one soul is worth after travelling `distance` px, before streak and clutch. */
export const soulValue = (distance) => Math.max(1, Math.round(TUNING.soulValue * Math.exp(distance / TUNING.soulValueGrowth)));

/** Price of the next level of an upgrade, rounded to a friendly number. */
export function price(upgrade, level) {
  const raw = upgrade.basePrice * Math.pow(TUNING.priceGrowth, level);
  const step = raw < 100 ? 5 : raw < 1000 ? 10 : raw < 10000 ? 50 : 500;
  return Math.round(raw / step) * step;
}

/** What the boat and river do at the current upgrade levels. */
export function statsFor(levels) {
  return {
    scrollSpeed: TUNING.scrollSpeed * Math.pow(1 + U.speed.perLevel, levels.speed),
    boatMaxSpeed: TUNING.boatMaxSpeed + U.handling.maxSpeedPerLevel * levels.handling,
    boatAccel: TUNING.boatAccel + U.handling.accelPerLevel * levels.handling,
    capacity: TUNING.holdStart + U.hold.perLevel * levels.hold,
  };
}

/** 1,234 then 12.3K, 123K, 1.23M... */
export function formatObols(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('en-US');
  if (n < 1e6) return (n / 1000).toFixed(n < 1e5 ? 1 : 0) + 'K';
  return (n / 1e6).toFixed(n < 1e7 ? 2 : 1) + 'M';
}

export const formatMeters = (px) => `${Math.floor(px / TUNING.pxPerMeter).toLocaleString('en-US')} m`;

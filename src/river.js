import { RIVER } from './config.js';

// Each bank wanders in and out on its own, so the shoreline is uneven (about ±bankWander px).
const wander = (wy, k) => (RIVER.bankWander / 15) * (7 * Math.sin(wy * 0.013 + k) + 5 * Math.sin(wy * 0.031 + k * 2.3) + 3 * Math.sin(wy * 0.071 + k * 4.1));

/** River shape at a world y (screen y = world y + distance scrolled): centre, half width, left and right banks. */
export function riverAt(wy) {
  let cx = RIVER.centerX;
  let hw = RIVER.halfWidth;
  for (const [a, f, p] of RIVER.meander) cx += a * Math.sin(wy * f + p);
  for (const [a, f, p] of RIVER.wobble) hw += a * Math.sin(wy * f + p);
  return { cx, hw, l: cx - hw - wander(wy, 1.3), r: cx + hw + wander(wy, 4.7) };
}

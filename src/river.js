import { RIVER } from './config.js';

/** River shape at a world y (screen y = world y + distance scrolled): centre, half width, left and right banks. */
export function riverAt(wy) {
  let cx = RIVER.centerX;
  let hw = RIVER.halfWidth;
  for (const [a, f, p] of RIVER.meander) cx += a * Math.sin(wy * f + p);
  for (const [a, f, p] of RIVER.wobble) hw += a * Math.sin(wy * f + p);
  return { cx, hw, l: cx - hw, r: cx + hw };
}

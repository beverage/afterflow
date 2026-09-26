// Small helpers for 0xRRGGBB colors.

export const rgbOf = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
export const hexCss = (c) => '#' + c.toString(16).padStart(6, '0');

export function mixColor(a, b, t) {
  const [ar, ag, ab] = rgbOf(a);
  const [br, bg, bb] = rgbOf(b);
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export const lighten = (c, t) => mixColor(c, 0xffffff, t);

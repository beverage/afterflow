// Shared bits of UI styling: spaced small caps and the Greek key border.

export const spaced = (text) => text.split('').join(' ');

/** Draws a Greek key (meander) strip into a Phaser Graphics. u = size of one step in px. */
export function drawMeander(g, x, y, w, u = 1.6, color = 0xdce6e2, alpha = 0.22) {
  const cell = u * 5;
  const n = Math.floor(w / cell);
  const x0 = x + (w - n * cell) / 2;
  g.lineStyle(1, color, alpha);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * cell;
    g.moveTo(cx, y + 4 * u);
    g.lineTo(cx, y);
    g.lineTo(cx + 3 * u, y);
    g.lineTo(cx + 3 * u, y + 3 * u);
    g.lineTo(cx + u, y + 3 * u);
    g.lineTo(cx + u, y + u);
    g.lineTo(cx + 2 * u, y + u);
    g.lineTo(cx + 2 * u, y + 2 * u);
  }
  g.moveTo(x0, y + 4 * u);
  g.lineTo(x0 + n * cell - u, y + 4 * u);
  g.strokePath();
}

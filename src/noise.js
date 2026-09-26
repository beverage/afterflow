// Seeded random and periodic value noise, from Ines's river study (afterflow-riviere.html).
// Used to generate the water surface and the banks.

/** A seeded random number generator (mulberry32): rng(seed)() -> [0, 1). */
export function rng(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise on a gx x gy lattice that wraps, so it tiles seamlessly over u, w in [0, 1). */
export function lattice(gx, gy, seed) {
  const r = rng(seed), v = new Float32Array(gx * gy);
  for (let i = 0; i < v.length; i++) v[i] = r();
  return (u, w) => {
    const x = u * gx, y = w * gy, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const X0 = ((x0 % gx) + gx) % gx, X1 = (X0 + 1) % gx, Y0 = ((y0 % gy) + gy) % gy, Y1 = (Y0 + 1) % gy;
    const a = v[Y0 * gx + X0], b = v[Y0 * gx + X1], c = v[Y1 * gx + X0], d = v[Y1 * gx + X1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/** Fractal noise: `oct` octaves of lattice noise, each twice as fine. Also tiles seamlessly. */
export function fbm(gx, gy, oct, seed) {
  const L = [];
  for (let i = 0; i < oct; i++) L.push(lattice(gx << i, gy << i, seed + i * 97));
  return (u, w) => {
    let s = 0, a = 0.5, n = 0;
    for (const f of L) {
      s += f(u, w) * a;
      n += a;
      a *= 0.5;
    }
    return s / n;
  };
}

export const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Rocks and dead trees in the river, after Ines's obstacle study (afterflow-riviere-obstacles.html),
// darker and craggier. No Phaser here: shapes, placement and collision circles.
//
// No walls: before any obstacle goes in, a safe path is drawn down the river (150 px wide, drifting at
// most 0.5 px sideways per px of river) and nothing is ever placed on it. Every obstacle also keeps
// 90 px of clear water from every other one, so nothing chains, and none sits near a dock.
// Test render with the wall hunt: https://claude.ai/artifact/KARkfTrezx5vH6wbGHuhhx
import { OBSTACLES as O, RIVER } from './config.js';
import { riverAt } from './river.js';
import { rng } from './noise.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const Y0 = 720; // the safe path's first row: the bottom of the screen at the start of a run

export function makeRand(seed) {
  const r = rng(seed >>> 0 || 1);
  const f = () => r();
  f.range = (a, b) => a + r() * (b - a);
  f.int = (n) => (r() * n) | 0;
  return f;
}

/* ---------- rocks: two to five angular chunks, slabs and shards, with bites broken out of the edge ---------- */

// < 1 inside a chunk (a polygon of uneven faces, maybe stretched), 0 at its heart.
export function lobeU(L, px, py) {
  const dx = px - L.x, dy = py - L.y, c = Math.cos(L.rot), s = Math.sin(L.rot);
  const qx = dx * c + dy * s, qy = (-dx * s + dy * c) / L.aspect;
  let u = -Infinity;
  for (let e = 0; e < L.n.length; e++) u = Math.max(u, (qx * L.n[e][0] + qy * L.n[e][1]) / L.d[e]);
  return u;
}
export function biteU(sh, px, py) {
  let u = Infinity;
  for (const B of sh.bites) u = Math.min(u, lobeU(B, px, py));
  return u; // < 1 inside a bite: no rock there
}
function shapeU(sh, px, py) {
  let u = Infinity;
  for (const L of sh.lobes) u = Math.min(u, lobeU(L, px, py));
  return Math.max(u, 2 - biteU(sh, px, py));
}
function makeLobe(R, rr, faces, aspect) {
  const base = R() * TAU, n = [], d = [], jit = 0.3 * (6 / (faces + 3));
  for (let e = 0; e < faces; e++) {
    const ang = base + (e / faces) * TAU + R.range(-jit, jit);
    n.push([Math.cos(ang), Math.sin(ang)]);
    d.push(rr * R.range(0.6, 1.2));
  }
  return { x: 0, y: 0, r: rr, n, d, aspect, rot: R() * TAU, h: 1 };
}
// Each new chunk is set on the edge of the ones before it; a shape that falls apart returns null.
function tryCrag(R, withBites) {
  const r0 = R.range(15, 25), lobes = [], bites = [], sh = { r0, lobes, bites };
  const edgeAt = (a) => {
    let rr = 0;
    while (rr < r0 * 5 && shapeU(sh, Math.cos(a) * rr, Math.sin(a) * rr) < 1) rr += 0.5;
    return rr;
  };
  lobes.push(makeLobe(R, r0, 3 + R.int(4), R.range(0.4, 0.9)));
  for (let k = 1 + (R() < 0.85 ? 1 : 0) + (R() < 0.55 ? 1 : 0) + (R() < 0.25 ? 1 : 0); k > 0; k--) {
    const shard = R() < 0.35, rr = r0 * (shard ? R.range(0.45, 0.7) : R.range(0.4, 0.75)), a = R() * TAU;
    const L = makeLobe(R, rr, 3 + R.int(4), shard ? R.range(0.34, 0.52) : R.range(0.55, 1));
    if (shard) L.rot = a + R.range(-0.5, 0.5); // a shard points outward
    const off = edgeAt(a) + rr * (shard ? R.range(0.1, 0.5) : R.range(-0.25, 0.3));
    L.x = Math.cos(a) * off;
    L.y = Math.sin(a) * off;
    L.h = shard ? R.range(0.4, 0.7) : R.range(0.55, 0.95);
    lobes.push(L);
  }
  if (withBites) {
    for (let k = 1 + (R() < 0.5 ? 1 : 0); k > 0; k--) {
      const a = R() * TAU, br = r0 * R.range(0.3, 0.55), B = makeLobe(R, br, 3 + R.int(3), R.range(0.6, 1)), e = edgeAt(a) + br * R.range(0.05, 0.4);
      B.x = Math.cos(a) * e;
      B.y = Math.sin(a) * e;
      bites.push(B);
    }
  }
  // the footprint on a 2 px grid: centre it, and throw the shape away if it fell into pieces
  const G = 2, span = Math.ceil((r0 * 5) / G), side = span * 2 + 1, N = side * side, inside = new Uint8Array(N);
  const gx = (j) => ((j % side) - span) * G, gy = (j) => (Math.floor(j / side) - span) * G;
  let mx = 0, my = 0, cnt = 0;
  for (let j = 0; j < N; j++) {
    if (shapeU(sh, gx(j), gy(j)) < 1) {
      inside[j] = 1;
      mx += gx(j);
      my += gy(j);
      cnt++;
    }
  }
  if (!cnt) return null;
  const seen = new Uint8Array(N), stack = [inside.indexOf(1)];
  let reached = 0;
  seen[stack[0]] = 1;
  while (stack.length) {
    const j = stack.pop(), x = j % side;
    reached++;
    for (const k of [x > 0 ? j - 1 : -1, x < side - 1 ? j + 1 : -1, j - side, j + side]) {
      if (k >= 0 && k < N && inside[k] && !seen[k]) {
        seen[k] = 1;
        stack.push(k);
      }
    }
  }
  if (reached < cnt * 0.98) return null;
  for (const L of [...lobes, ...bites]) {
    L.x -= mx / cnt;
    L.y -= my / cnt;
  }
  // the outline, walking in from outside along 64 rays, with outward normals
  const M = 64, pts = [];
  for (let j = 0; j < M; j++) {
    const a = (j / M) * TAU, cx = Math.cos(a), cy = Math.sin(a);
    let rr = r0 * 5;
    while (rr > 0 && shapeU(sh, cx * rr, cy * rr) >= 1) rr -= 0.5;
    pts.push([cx * rr, cy * rr]);
  }
  sh.outline = pts.map(([x, y], j) => {
    const [ax, ay] = pts[(j + M - 1) % M], [bx, by] = pts[(j + 1) % M];
    let nx = by - ay, ny = -(bx - ax);
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    if (nx * x + ny * y < 0) {
      nx = -nx;
      ny = -ny;
    }
    return [x, y, nx, ny];
  });
  sh.ext = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
  sh.size = Math.ceil(sh.ext * 2.7 + 16); // the sprite, centred on the rock
  sh.left = sh.outline.reduce((m, p) => (p[0] < m[0] ? p : m));
  sh.right = sh.outline.reduce((m, p) => (p[0] > m[0] ? p : m));
  sh.bottom = Math.max(...pts.map((p) => p[1]));
  // collision: the distance to the edge (a chamfer transform on the grid), then the largest free
  // circle again and again; slivers thinner than 10 px stay soft
  const dist = new Float32Array(N), D1 = G, D2 = G * Math.SQRT2;
  for (let j = 0; j < N; j++) {
    inside[j] = shapeU(sh, gx(j), gy(j)) < 1 ? 1 : 0;
    dist[j] = inside[j] ? 1e9 : 0;
  }
  const relax = (j, k, w) => {
    if (k >= 0 && k < N && dist[k] + w < dist[j]) dist[j] = dist[k] + w;
  };
  for (let j = 0; j < N; j++) {
    if (!dist[j]) continue;
    const x = j % side;
    relax(j, x > 0 ? j - 1 : -1, D1);
    relax(j, j - side, D1);
    relax(j, x > 0 ? j - side - 1 : -1, D2);
    relax(j, x < side - 1 ? j - side + 1 : -1, D2);
  }
  for (let j = N - 1; j >= 0; j--) {
    if (!dist[j]) continue;
    const x = j % side;
    relax(j, x < side - 1 ? j + 1 : -1, D1);
    relax(j, j + side, D1);
    relax(j, x < side - 1 ? j + side + 1 : -1, D2);
    relax(j, x > 0 ? j + side - 1 : -1, D2);
  }
  sh.circles = [];
  const covered = new Uint8Array(N);
  for (let k = 0; k < 8; k++) {
    let bi = -1, bd = 0;
    for (let j = 0; j < N; j++) {
      if (inside[j] && !covered[j] && dist[j] > bd) {
        bd = dist[j];
        bi = j;
      }
    }
    if (bi < 0 || bd < 5) break;
    const cx = gx(bi), cy = gy(bi);
    sh.circles.push({ lx: cx, ly: cy, r: (bd - 1) / O.collide });
    for (let j = 0; j < N; j++) if (inside[j] && Math.hypot(gx(j) - cx, gy(j) - cy) < bd * 1.15) covered[j] = 1;
  }
  return sh;
}
function cragShape(i) {
  const R = makeRand(4001 + i * 37);
  for (let t = 0; t < 30; t++) {
    const sh = tryCrag(R, true);
    if (sh) return sh;
  }
  let sh = null;
  while (!sh) sh = tryCrag(R, false);
  return sh;
}
export const CRAGS = Array.from({ length: 16 }, (_, i) => cragShape(i)); // textures crag0 to crag15

/* ---------- dead trees fallen from the banks: five kinds, two of each, in three greys ---------- */

export const SNAG_TONES = [
  { dark: '#141518', mid: '#4a4e52', light: '#7a7e82', edge: '#6f7377' }, // charcoal
  { dark: '#232427', mid: '#686c6f', light: '#9a9ea1', edge: '#8e9295' }, // bleached
  { dark: '#191715', mid: '#524e49', light: '#807a73', edge: '#746f68' }, // ash, a warmer grey
];
const SNAG_KINDS = ['snag', 'fork', 'pole', 'uprooted', 'pine'];

// A point along a tree's trunk: [x, y, half width, direction].
export function spineAt(s, f) {
  const k = clamp(f * (s.spine.length - 1), 0, s.spine.length - 1.001), i = Math.floor(k), t = k - i, a = s.spine[i], b = s.spine[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
}

// Root at (0, 0), trunk along +x, gently bent: a snag with a crown of bare branches, a forked trunk,
// a stripped pole, an uprooted tree showing its root plate, or a dead pine with its whorls.
function snagShape(i) {
  const R = makeRand(7001 + i * 31), kind = SNAG_KINDS[i % SNAG_KINDS.length];
  const L = kind === 'uprooted' ? R.range(130, 175) : kind === 'pole' ? R.range(160, 220) : R.range(175, 238);
  const hw0 = R.range(11, 17), hw1 = kind === 'pole' ? R.range(6, 8) : R.range(3.5, 6), bend = R.range(-0.16, 0.16), wob = R() * TAU;
  const forkAt = kind === 'fork' ? R.range(0.5, 0.66) : 2, spine = [];
  for (let k = 0; k <= 14; k++) {
    const f = k / 14;
    spine.push([f * L, Math.sin(f * Math.PI) * bend * L * 0.35 + Math.sin(f * 9 + wob) * 1.8, (hw0 + (hw1 - hw0) * Math.pow(f, 0.8)) * (f > forkAt ? 0.78 : 1)]);
  }
  const s = { kind, L, spine, limbs: [], branches: [], stubs: [], tone: SNAG_TONES[R.int(SNAG_TONES.length)] };
  const side = () => (R() < 0.5 ? -1 : 1);
  // a bare branch leaving the wood at p in direction ang, bowed a little, with a few twigs
  const branch = (p, ang, len, w) => {
    const x1 = p[0] + Math.cos(ang) * len, y1 = p[1] + Math.sin(ang) * len, twigs = [];
    for (let m = R.int(3); m > 0; m--) {
      const f = R.range(0.4, 0.85), sx = p[0] + (x1 - p[0]) * f, sy = p[1] + (y1 - p[1]) * f, ta = ang + R.range(0.3, 0.8) * side(), tl = R.range(7, 16);
      twigs.push([sx, sy, sx + Math.cos(ta) * tl, sy + Math.sin(ta) * tl]);
    }
    s.branches.push({ x0: p[0], y0: p[1], cx: (p[0] + x1) / 2 + R.range(-5, 5), cy: (p[1] + y1) / 2 + R.range(-5, 5), x1, y1, w, twigs });
  };
  const along = (n, from, to, len, w) => {
    for (let k = n; k > 0; k--) {
      const q = spineAt(s, R.range(from, to));
      branch(q, q[3] + side() * R.range(0.45, 1.1), R.range(...len), R.range(...w));
    }
  };
  if (kind === 'fork') {
    const p = spineAt(s, forkAt), a = p[3] + side() * R.range(0.35, 0.6), len = (1 - forkAt) * L * R.range(0.75, 1), limb = [];
    for (let k = 0; k <= 6; k++) {
      const f = k / 6;
      limb.push([p[0] + Math.cos(a) * len * f, p[1] + Math.sin(a) * len * f + Math.sin(f * 5) * 2, p[2] * 0.75 * (1 - f) + hw1 * f]);
    }
    s.limbs.push(limb);
    for (let k = 0; k < 3; k++) branch(limb[2 + R.int(4)], a + side() * R.range(0.5, 1.1), R.range(16, 34), R.range(1.8, 3));
    along(3, 0.35, 0.95, [18, 40], [2, 3.4]);
  } else if (kind === 'snag') along(5 + R.int(3), 0.3, 0.97, [20, 48], [2, 3.6]);
  else if (kind === 'pole') along(R.int(2), 0.4, 0.8, [14, 26], [2, 3]);
  else if (kind === 'uprooted') along(2 + R.int(3), 0.45, 0.97, [18, 38], [2, 3.2]);
  else {
    // whorls of short branches, alternating sides, shorter toward the tip and raked toward it
    let sd = side();
    for (let f = R.range(0.22, 0.3); f < 0.96; f += R.range(0.055, 0.085)) {
      const q = spineAt(s, f);
      branch(q, q[3] + sd * R.range(0.85, 1.2), (1 - f) * R.range(30, 42) + 8, R.range(1.4, 2.4));
      sd = -sd;
    }
  }
  for (let k = kind === 'pole' ? 4 + R.int(4) : 1 + R.int(3); k > 0; k--) {
    const q = spineAt(s, R.range(0.15, 0.9)), a = q[3] + side() * R.range(0.8, 1.5), len = q[2] + R.range(4, 10);
    s.stubs.push({ x0: q[0], y0: q[1], ex: q[0] + Math.cos(a) * len, ey: q[1] + Math.sin(a) * len, w: R.range(3, 5.5) });
  }
  s.plate = kind === 'uprooted' ? R.range(30, 40) : 22;
  s.roots = Array.from({ length: kind === 'uprooted' ? 16 : 9 }, () => {
    const a = kind === 'uprooted' ? R.range(1.2, 5.1) : R.range(1.8, 4.5), l = kind === 'uprooted' ? s.plate * R.range(1.05, 1.45) : R.range(26, 40);
    return { a, l1: l, l2: l * R.range(0.9, 1.1), w: R.range(1.6, 3.4) };
  });
  s.bark = Array.from({ length: 18 }, () => [R.range(0.05, 0.85), R.range(-1, 1), R.range(16, 46)]);
  s.notch = Array.from({ length: 30 }, () => R.range(-1.8, 1.8));
  s.tip = kind === 'pole' ? [R.range(6, 14), R.range(-6, 6), R.range(6, 12)] : [R.range(4, 10), R.range(-5, 5), R.range(3, 8)];
  s.limbTips = s.limbs.map(() => [R.range(3, 7), R.range(-3, 3), R.range(3, 6)]);
  // the upstream edge of the trunk, where foam gathers
  s.foam = spine.slice(1).map((p, k) => {
    const a = Math.atan2(p[1] - spine[k][1], p[0] - spine[k][0]);
    return [p[0] + Math.sin(a) * (p[2] + 2), p[1] - Math.cos(a) * (p[2] + 2)];
  });
  // collision circles along the trunk, limbs, branches and stubs
  const cs = [{ lx: 0, ly: 0, r: s.plate }];
  const run = (pts) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0, h0] = pts[k], [x1, y1, h1] = pts[k + 1], seg = Math.hypot(x1 - x0, y1 - y0);
      for (let t = 0; t < seg; ) {
        const f = t / seg, h = h0 + (h1 - h0) * f;
        cs.push({ lx: x0 + (x1 - x0) * f, ly: y0 + (y1 - y0) * f, r: h });
        t += Math.max(4, h * 1.1);
      }
    }
    const e = pts[pts.length - 1];
    cs.push({ lx: e[0], ly: e[1], r: Math.max(5, e[2]) });
  };
  run(spine);
  for (const l of s.limbs) run(l);
  for (const b of s.branches) {
    cs.push({ lx: 0.25 * b.x0 + 0.5 * b.cx + 0.25 * b.x1, ly: 0.25 * b.y0 + 0.5 * b.cy + 0.25 * b.y1, r: Math.max(4.5, b.w + 1.5) });
    cs.push({ lx: b.x1, ly: b.y1, r: Math.max(4, b.w) });
  }
  for (const st of s.stubs) cs.push({ lx: st.ex, ly: st.ey, r: Math.max(4, st.w) });
  s.circles = cs;
  s.reach = Math.max(...cs.map((c) => c.lx + c.r)); // how far it sticks out into the river
  // the sprite: bounds of everything drawn, and where the root sits on it
  let x0 = -48, x1 = 0, y0 = -48, y1 = 48;
  for (const c of cs) {
    x0 = Math.min(x0, c.lx - c.r);
    x1 = Math.max(x1, c.lx + c.r);
    y0 = Math.min(y0, c.ly - c.r);
    y1 = Math.max(y1, c.ly + c.r);
  }
  for (const rt of s.roots) {
    x0 = Math.min(x0, Math.cos(rt.a) * rt.l1);
    y0 = Math.min(y0, Math.sin(rt.a) * rt.l2);
    y1 = Math.max(y1, Math.sin(rt.a) * rt.l2);
  }
  const pad = 24;
  s.box = { w: Math.ceil(x1 - x0 + pad * 2), h: Math.ceil(y1 - y0 + pad * 2), ox: Math.ceil(pad - x0), oy: Math.ceil(pad - y0) };
  return s;
}
export const SNAGS = Array.from({ length: 10 }, (_, i) => snagShape(i)); // textures snag0 to snag9

// Tree-local to world: mirrored on the right bank (dir -1), turned by ang (positive = tip downstream), scaled by sc.
export const snagToWorld = (t, lx, ly) => ({
  x: t.x + t.dir * t.sc * (lx * Math.cos(t.ang) - ly * Math.sin(t.ang)),
  y: t.y + t.sc * (lx * Math.sin(t.ang) + ly * Math.cos(t.ang)),
});

/* ---------- the field: placed a little ahead of the screen as the river scrolls ---------- */

export class ObstacleField {
  constructor(seed) {
    this.R = makeRand(seed);
    this.path = []; // the safe path's x, every pathStep px of river from Y0 upstream
    this.pathV = 0;
    this.pathTarget = null;
    this.retargetAt = 0;
    this.buckets = new Map(); // collision circles by world y
    this.treeCursor = -O.treeFrom; // world y of the next tree slot (smaller = further upstream)
    this.rockCursor = -O.startAfter;
    this.fresh = []; // placed since the scene last took them
    this.features = [];
  }

  // Obstacles up to world y `top` (trees a little further ahead, so rocks fit around them).
  // features: the bank's shrines and stalls, already placed further ahead; no obstacle near their docks.
  generateTo(top, features) {
    this.features = features;
    this.extendPath(top - O.treeLead - 400);
    while (O.trees && this.treeCursor > top - O.treeLead) {
      this.placeTree(this.treeCursor);
      this.treeCursor -= this.lerp(O.treeEvery, this.treeCursor) * this.R.range(0.75, 1.25);
    }
    while (this.rockCursor > top) {
      const expect = this.lerp(O.perPx, this.rockCursor) * 100;
      for (let m = Math.floor(expect) + (this.R() < expect % 1 ? 1 : 0); m > 0; m--) this.placeRocks(this.rockCursor);
      this.rockCursor -= 100;
    }
  }

  // Obstacles placed since the last call, for the scene to draw.
  take() {
    const out = this.fresh;
    this.fresh = [];
    return out;
  }

  // Drop the collision circles that have floated off below world y `bottom`.
  prune(bottom) {
    for (const k of this.buckets.keys()) if (k * 64 > bottom) this.buckets.delete(k);
  }

  nearby(y, reach, fn) {
    for (let k = Math.floor((y - reach) / 64), e = Math.floor((y + reach) / 64); k <= e; k++) {
      const b = this.buckets.get(k);
      if (b) for (const c of b) fn(c);
    }
  }

  // True if a circle at (x, y) of radius r would overlap an obstacle as drawn.
  hits(x, y, r) {
    let hit = false;
    this.nearby(y, r + 60, (c) => {
      if (!hit && Math.hypot(c.x - x, c.y - y) < c.r + r) hit = true;
    });
    return hit;
  }

  pathAt(wy) {
    this.extendPath(wy);
    const f = clamp((Y0 - wy) / O.pathStep, 0, this.path.length - 1.001), i = Math.floor(f), t = f - i;
    return this.path[i] + (this.path[i + 1] - this.path[i]) * t;
  }

  /* ---------- placement ---------- */

  lerp([a, b], wy) {
    return a + (b - a) * clamp((-wy - O.startAfter) / O.rampOver, 0, 1);
  }

  // The safe path: a wandering line that never drifts faster than pathSlope, kept off the banks.
  extendPath(wy) {
    const s = O.pathStep, R = this.R;
    while (this.path.length < 2 || Y0 - (this.path.length - 1) * s > wy - s) {
      const i = this.path.length, y = Y0 - i * s, q = riverAt(y);
      const lo = q.cx - q.hw + RIVER.bankWander + O.pathHalfWidth + 6, hi = q.cx + q.hw - RIVER.bankWander - O.pathHalfWidth - 6;
      let x = i ? this.path[i - 1] : q.cx;
      if (this.pathTarget === null || y < this.retargetAt) {
        this.pathTarget = R.range(lo, hi);
        this.retargetAt = y - R.range(260, 900);
      }
      this.pathV += (clamp((this.pathTarget - x) / 140, -1, 1) * O.pathSlope - this.pathV) * 0.14;
      x = clamp(x + this.pathV * s, lo, hi);
      this.path.push(x);
    }
  }

  clearOfPath(x, y, r) {
    this.extendPath(y - r - O.pathStep * 2);
    const a = Math.max(0, Math.floor((Y0 - (y + r)) / O.pathStep) - 1), b = Math.min(this.path.length - 1, Math.ceil((Y0 - (y - r)) / O.pathStep) + 1);
    for (let i = a; i <= b; i++) if (Math.abs(this.path[i] - x) < O.pathHalfWidth + r) return false;
    return true;
  }

  // Calm water around every dock: its whole pool of light and a margin, bank to bank.
  inPool(y, r) {
    return this.features.some((f) => y + r > f.wy - O.poolHalf - 30 && y - r < f.wy + 70 + O.poolHalf);
  }

  // Nothing touches: gapMin of clear water from every obstacle already placed.
  gapOK(c) {
    const reach = c.r + 46 + O.gapMin;
    for (let k = Math.floor((c.y - reach) / 64), e = Math.floor((c.y + reach) / 64); k <= e; k++) {
      const b = this.buckets.get(k);
      if (b) for (const o of b) if (Math.hypot(o.x - c.x, o.y - c.y) - o.r - c.r < O.gapMin) return false;
    }
    return true;
  }

  // A rock sits in the water, touching a bank or leaving a real channel beside it, never a squeeze.
  bankOK(c) {
    let gl = Infinity, gr = Infinity;
    for (const y of [c.y - c.r, c.y, c.y + c.r]) {
      const q = riverAt(y);
      gl = Math.min(gl, c.x - c.r - q.l);
      gr = Math.min(gr, q.r - c.x - c.r);
    }
    if (gl < -c.r * 0.4 || gr < -c.r * 0.4) return false;
    return !((gl > 0 && gl < O.gapMin) || (gr > 0 && gr < O.gapMin));
  }

  fits(circles, attached) {
    for (const c of circles) {
      if (this.inPool(c.y, c.r) || !this.clearOfPath(c.x, c.y, c.r) || (!attached && !this.bankOK(c)) || !this.gapOK(c)) return false;
      // a pair's two rocks keep clear of each other too
      if (c.part) for (const o of circles) if (o.part !== c.part && Math.hypot(c.x - o.x, c.y - o.y) - c.r - o.r < O.gapMin) return false;
    }
    return true;
  }

  add(circles, item) {
    for (const c of circles) {
      c.item = item;
      const k = Math.floor(c.y / 64);
      let b = this.buckets.get(k);
      if (!b) this.buckets.set(k, (b = []));
      b.push(c);
    }
    this.fresh.push(item);
  }

  // One rock, sometimes two with clear water between them.
  placeRocks(top) {
    const R = this.R;
    for (let tries = 0; tries < 8; tries++) {
      const y = top - R() * 100, q = riverAt(y), rocks = [], circles = [];
      const put = (x, ry, v) => {
        const part = rocks.length;
        rocks.push({ kind: 'rock', x, y: ry, v, ph: R() * TAU });
        for (const c of CRAGS[v].circles) circles.push({ x: x + c.lx, y: ry + c.ly, r: c.r, part });
      };
      const v = R.int(CRAGS.length), e = CRAGS[v].ext;
      put(R.range(q.l + e + 10, q.r - e - 10), y, v);
      if (R() < O.pairChance) {
        const v2 = R.int(CRAGS.length), e2 = CRAGS[v2].ext, side = R() < 0.5 ? -1 : 1;
        put(rocks[0].x + side * (e + e2 + O.gapMin + R.range(10, 150)), y + R.range(-40, 40), v2);
      }
      if (!this.fits(circles, false)) continue;
      rocks.forEach((rock, i) => this.add(circles.filter((c) => c.part === i), rock));
      return;
    }
  }

  // A dead tree fallen from the bank on the wider side of the safe path, scaled down to fit if need be.
  // Pointing downstream it leaves a pocket against the bank; sometimes a soul waits in it as bait.
  placeTree(top) {
    const R = this.R;
    for (let tries = 0; tries < 12; tries++) {
      const y = top - R() * 260, q = riverAt(y), px = this.pathAt(y), bank = px - q.l > q.r - px ? 'left' : 'right';
      const v = R.int(SNAGS.length), s = SNAGS[v], maxSc = Math.min(1, ((q.r - q.l) * O.treeReach) / s.reach), ang = R.range(-0.3, 0.3), ph = R() * TAU;
      for (const sc of [maxSc, maxSc * 0.82, maxSc * 0.66]) {
        if (sc < 0.5) break;
        const t = { kind: 'tree', x: bank === 'left' ? q.l + 6 : q.r - 6, y, dir: bank === 'left' ? 1 : -1, v, sc, ang, ph };
        const circles = s.circles.map((c) => ({ ...snagToWorld(t, c.lx, c.ly), r: c.r * sc }));
        if (!this.fits(circles, true)) continue;
        this.add(circles, t);
        if (ang > 0.05 && R() < O.baitChance) {
          for (const f of [0.3, 0.45, 0.6]) {
            const sp = spineAt(s, f), p = snagToWorld(t, sp[0], sp[1] + sp[2] + 38), pq = riverAt(p.y);
            if (p.x > pq.l + 26 && p.x < pq.r - 26 && !this.hits(p.x, p.y, 17 + 12)) {
              t.bait = p;
              break;
            }
          }
        }
        return;
      }
    }
  }
}

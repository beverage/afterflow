// The river's water, ported from Ines's "Afterflow" river study (afterflow-riviere.html):
// a shallow-to-deep body, a flowing surface of noise sheets bent to follow the river,
// current lines that run faster mid-stream, serpentine lifestream ribbons, glints, and foam
// sliding along the banks. Drawn with Canvas 2D into one texture each frame, clipped to the river.
import { WIDTH as W, HEIGHT as H } from './config.js';
import { rng, fbm, sstep, mixRGB } from './noise.js';

const SW = 1024; // surface sheet width (texels)
const SH = 1024; // surface sheet height: the surface repeats along the flow every SH px
const S = 4; // strip height: the surface is drawn in 4 px rows, each bent to the river

const R = rng(20260926);
const rnd = (a, b) => a + R() * (b - a);

// Built once and shared by every run (a few hundred ms at boot).
let assets = null;
function buildAssets() {
  const norm = (f, w, h) => {
    let lo = 1, hi = 0;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const v = f(x / w, y / h);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    return (u, v) => (f(u, v) - lo) / (hi - lo);
  };
  // A surface sheet, plus S extra rows so a strip read near the bottom wraps cleanly.
  const sheet = (fn) => {
    const c = document.createElement('canvas');
    c.width = SW;
    c.height = SH + S;
    const x = c.getContext('2d'), im = x.createImageData(SW, SH + S);
    for (let y = 0; y < SH + S; y++) {
      const yy = y % SH;
      for (let X = 0; X < SW; X++) {
        const o = fn(X / SW, yy / SH), i = (y * SW + X) * 4;
        im.data[i] = o[0];
        im.data[i + 1] = o[1];
        im.data[i + 2] = o[2];
        im.data[i + 3] = o[3];
      }
    }
    x.putImageData(im, 0, 0);
    return c;
  };
  const fA = norm(fbm(48, 5, 4, 31), SW, SH), fB = norm(fbm(26, 16, 3, 32), SW, SH);
  // A: bright crests and dark troughs. B: mostly dark troughs with faint highlights.
  const sheetA = sheet((u, v) => {
    const n = fA(u, v);
    return n < 0.4 ? [14, 10, 32, sstep(0.4, 0.1, n) * 120] : [214, 206, 248, sstep(0.66, 0.92, n) * 130];
  });
  const sheetB = sheet((u, v) => {
    const n = fB(u, v);
    return n < 0.42 ? [10, 8, 26, sstep(0.46, 0.1, n) * 130] : [200, 205, 240, sstep(0.8, 0.97, n) * 30];
  });

  // Cross-section of the water body, bank to bank: blue-grey shallows, violet, deep indigo mid-stream,
  // darker within ~34 px of the bank and muddy right at the waterline.
  const body = document.createElement('canvas');
  body.width = 256;
  body.height = 1;
  const bctx = body.getContext('2d'), bim = bctx.createImageData(256, 1);
  const SHAL = [70, 78, 96], MID = [46, 42, 78], DEEP = [23, 20, 44], MUD = [36, 35, 30];
  const halfPx = 272; // our river's typical half width, to size the edge bands in px
  for (let x = 0; x < 256; x++) {
    const depthFrac = 1 - Math.abs(x + 0.5 - 128) / 128, depthPx = depthFrac * halfPx;
    const t = sstep(0, 0.85, depthFrac);
    let col = t < 0.5 ? mixRGB(SHAL, MID, t * 2) : mixRGB(MID, DEEP, (t - 0.5) * 2);
    if (depthPx < 34) col = col.map((k) => k * (1 - (1 - depthPx / 34) * 0.32));
    if (depthPx < 10) col = mixRGB(col, MUD, (1 - depthPx / 10) * 0.5);
    bim.data[x * 4] = col[0];
    bim.data[x * 4 + 1] = col[1];
    bim.data[x * 4 + 2] = col[2];
    bim.data[x * 4 + 3] = 255;
  }
  bctx.putImageData(bim, 0, 0);

  // Glints: a few soft points of light, tiled across the water.
  const glint = document.createElement('canvas');
  glint.width = glint.height = 256;
  const gg = glint.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = rnd(0, 256), y = rnd(0, 256), r = rnd(0.8, 1.6);
    const q = gg.createRadialGradient(x, y, 0, x, y, r * 3);
    q.addColorStop(0, 'rgba(240,235,255,.9)');
    q.addColorStop(1, 'rgba(240,235,255,0)');
    gg.fillStyle = q;
    gg.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }
  // Foam density, one field per bank: along the flow (repeats every FOAM_P px) and over time.
  const foam = [fbm(48, 6, 4, 51), fbm(48, 6, 4, 52)];
  return { sheetA, sheetB, body, glint, foam };
}

// The lifestream's colors: violet, cyan, pink, periwinkle, teal.
const RIB = [[185, 150, 255], [120, 225, 255], [240, 170, 225], [160, 140, 255], [140, 235, 240]];

// Foam bubbles: [noise offset, spacing px, inset px, inset spread px, density low, density high, max alpha, max radius].
// Clumps at the waterline, then loose flecks drifting further out. A soft band under the clumps holds them together.
const FOAM = [[0, 2.5, 1, 7, 0.44, 0.66, 0.75, 1.9], [0.23, 6, 8, 18, 0.58, 0.74, 0.5, 1.3]];
const FOAM_P = 2400;
// Stable per-bubble random in [0, 1), so each bubble keeps its place as it drifts.
const hash = (n) => {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

export class Water {
  /** riverAt(worldY) -> { cx, hw }. The water texture is shown by an Image at `depth`. */
  constructor(scene, riverAt, depth = 1) {
    if (!assets) assets = buildAssets();
    this.riverAt = riverAt;
    this.tex = scene.textures.exists('water_live') ? scene.textures.get('water_live') : scene.textures.createCanvas('water_live', W, H);
    this.ctx = this.tex.getContext();
    this.image = scene.add.image(0, 0, 'water_live').setOrigin(0).setDepth(depth);
    this.wat = 0;
    this.t = 0;
    this.flows = Array.from({ length: 150 }, () => ({ y: rnd(-200, H), o: rnd(-0.85, 0.85), L: rnd(30, 110), a: rnd(0.06, 0.22), w: rnd(0.6, 1.6), v: rnd(0.85, 1.2), ph: rnd(0, 6) }));
    this.ribbons = Array.from({ length: 16 }, (_, i) => ({
      y: rnd(-300, H + 300), L: rnd(260, 520), o: rnd(-0.5, 0.5), A: rnd(0.2, 0.45), f: rnd(0.006, 0.013), ph: rnd(0, 6.28), c: RIB[i % RIB.length], w: rnd(1.2, 2.6), a: rnd(0.35, 0.7), v: rnd(0.9, 1.25),
    }));
  }

  // Wobble of the surface and current lines: three waves, churning over time.
  turb(y, k) {
    const t = this.t;
    return 7 * Math.sin(y * 0.021 + t * 1.6 + k) + 4 * Math.sin(y * 0.053 - t * 2.4 + k * 2) + 2 * Math.sin(y * 0.11 + t * 3.1);
  }

  /** Draw one frame. scroll = px travelled (world y + scroll = screen y), waterSpeed = px/s of the current. */
  update(dt, scroll, waterSpeed, rocks = []) {
    const b = this.ctx, riverAt = this.riverAt;
    this.t += dt;
    this.wat += waterSpeed * dt;
    const t = this.t, wat = this.wat;

    // River rows for this frame.
    const rows = [];
    for (let y = 0; y < H; y += S) {
      const q = riverAt(y + S / 2 - scroll);
      rows.push({ y, cx: q.cx, hw: q.hw, l: q.l, r: q.r });
    }

    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, W, H);

    // The water body, bank to bank.
    for (const r of rows) b.drawImage(assets.body, 0, 0, 256, 1, r.l, r.y, r.r - r.l, S);

    // The surface: sheets drawn in strips centred on the river and wobbled by the turbulence.
    const strips = (sheet, spd, alpha, k, comp) => {
      b.globalCompositeOperation = comp;
      b.globalAlpha = alpha;
      for (const r of rows) {
        const sc = r.hw / 360, sy = ((((r.y - spd) % SH) + SH) % SH) | 0;
        b.drawImage(sheet, 0, sy, SW, S, r.cx - (SW / 2) * sc + this.turb(r.y, k) * sc, r.y, SW * sc, S);
      }
    };
    strips(assets.sheetB, wat * 0.85, 1, 0, 'source-over');
    strips(assets.sheetB, wat * 0.6 + 500, 0.6, 2.2, 'source-over');
    strips(assets.sheetA, wat, 0.42, 1.7, 'lighter');
    strips(assets.sheetA, wat * 1.4 + 300, 0.22, 3.1, 'lighter');

    // Glints drifting with the current.
    b.globalCompositeOperation = 'lighter';
    b.globalAlpha = 0.12 + 0.12 * Math.sin(t * 2.1);
    const pat = b.createPattern(assets.glint, 'repeat');
    pat.setTransform(new DOMMatrix().translate(0, wat * 1.1));
    b.fillStyle = pat;
    b.fillRect(0, 0, W, H);

    // Current lines hugging the banks, faster mid-stream than at the edges.
    b.globalAlpha = 1;
    b.lineCap = 'round';
    for (const f of this.flows) {
      const v = waterSpeed * (1.15 - 0.55 * f.o * f.o) * f.v;
      f.y += v * dt;
      if (f.y - f.L > H) {
        f.y = -rnd(0, 200);
        f.o = rnd(-0.85, 0.85);
      }
      b.strokeStyle = `rgba(222,215,250,${f.a})`;
      b.lineWidth = f.w;
      b.beginPath();
      for (let j = 0; j <= 6; j++) {
        const y = f.y - (f.L * j) / 6, q = riverAt(y - scroll);
        const x = q.cx + (f.o + 0.08 * Math.sin(y * 0.01 + f.ph + t * 0.7)) * q.hw * 0.92 + this.turb(y, f.ph) * 0.8;
        j ? b.lineTo(x, y) : b.moveTo(x, y);
      }
      b.stroke();
    }

    // The lifestream: glowing ribbons that snake across the river and cross, tapering at their ends.
    b.globalCompositeOperation = 'lighter';
    b.lineCap = 'butt';
    b.lineJoin = 'round';
    for (const r of this.ribbons) {
      r.y += waterSpeed * r.v * dt;
      if (r.y - r.L > H + 20) {
        r.y = -rnd(20, 300);
        r.o = rnd(-0.5, 0.5);
      }
      const N = 26, pts = [];
      for (let j = 0; j <= N; j++) {
        const y = r.y - (r.L * j) / N, q = riverAt(y - scroll);
        const o = r.o + r.A * Math.sin(y * r.f + r.ph + t * 0.9);
        pts.push([q.cx + o * q.hw * 0.85, y]);
      }
      const [cr, cg, cb] = r.c;
      for (let j = 0; j < N; j++) {
        const k = j / N, tp = Math.sin(Math.PI * Math.min(1, k * 1.15)) * (1 - k * 0.3), a = r.a * tp;
        if (a < 0.01) continue;
        b.strokeStyle = `rgba(${cr},${cg},${cb},${a * 0.28})`;
        b.lineWidth = r.w * 9 * tp + 1;
        b.beginPath();
        b.moveTo(pts[j][0], pts[j][1]);
        b.lineTo(pts[j + 1][0], pts[j + 1][1]);
        b.stroke();
        b.strokeStyle = `rgba(${Math.min(255, cr + 40)},${Math.min(255, cg + 30)},${Math.min(255, cb + 20)},${a})`;
        b.lineWidth = r.w * tp + 0.3;
        b.beginPath();
        b.moveTo(pts[j][0], pts[j][1]);
        b.lineTo(pts[j + 1][0], pts[j + 1][1]);
        b.stroke();
      }
    }

    // Eddies behind rocks on the waterline: turning arcs and a wake curling off downstream.
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    b.lineWidth = 1.2;
    for (const rk of rocks) {
      b.strokeStyle = 'rgba(230,228,250,.32)';
      for (let j = 0; j < 2; j++) {
        const a = t * 2.2 + j * 3.14 + rk.x;
        b.beginPath();
        b.arc(rk.x + rk.side * rk.r * 0.6, rk.y + rk.r * 1.8, rk.r * (0.5 + 0.25 * j), a, a + 2);
        b.stroke();
      }
      b.strokeStyle = 'rgba(230,228,250,.22)';
      b.beginPath();
      b.moveTo(rk.x + rk.side * rk.r, rk.y);
      b.quadraticCurveTo(rk.x + rk.side * rk.r * 2.2, rk.y + rk.r * 2.5, rk.x + rk.side * rk.r * 2.6, rk.y + rk.r * 5);
      b.stroke();
    }

    // Foam along both banks: gathers, thins and breaks up as it drifts with the slower edge current.
    // Its density is noise along the flow (moving with the water) and over time. Drawn in LV
    // levels of strength, one path each, to keep the draw calls down.
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    b.lineCap = 'butt';
    const LV = 6, fu = wat * 0.8, fw = (t / 40) % 1, [, , , , lo, hi] = FOAM[0];
    const band = Array.from({ length: LV }, () => new Path2D());
    const dots = FOAM.map(() => Array.from({ length: LV }, () => new Path2D()));
    for (const side of [-1, 1]) {
      const n = assets.foam[side < 0 ? 0 : 1], edge = (q) => (side < 0 ? q.l : q.r);
      // The soft band.
      let px = 0, py = 0, pd = 0;
      for (let y = -3; y <= H + 3; y += 3) {
        const d = sstep(lo, hi, n((y - fu) / FOAM_P, fw)), x = edge(riverAt(y - scroll)) - side * 3;
        const l = Math.round(((d + pd) / 2) * LV);
        if (y > -3 && l > 0) {
          band[l - 1].moveTo(px, py);
          band[l - 1].lineTo(x, y);
        }
        px = x;
        py = y;
        pd = d;
      }
      // The bubbles, on a grid that moves with the water.
      FOAM.forEach(([off, sp, inset, spread, blo, bhi, , rmax], li) => {
        const seed = (side + 2) * 7919 + li * 104729;
        for (let k = Math.floor((-4 - fu) / sp), k1 = Math.ceil((H + 4 - fu) / sp); k <= k1; k++) {
          const y = k * sp + fu, d = sstep(blo, bhi, n((k * sp) / FOAM_P + off, fw));
          if (d < 0.05) continue;
          const h1 = hash(k * 3 + seed), h2 = hash(k * 3 + seed + 1), h3 = hash(k * 3 + seed + 2);
          const x = edge(riverAt(y - scroll)) - side * (inset + spread * h1 * (0.4 + 0.6 * d));
          const by = y + (h2 - 0.5) * sp, r = (0.4 + rmax * d) * (0.5 + h2), p = dots[li][Math.ceil(d * (0.5 + 0.5 * h3) * LV) - 1];
          p.moveTo(x + r, by);
          p.arc(x, by, r, 0, Math.PI * 2);
        }
      });
    }
    band.forEach((p, i) => {
      b.strokeStyle = `rgba(225,222,245,${(0.2 * (i + 1)) / LV})`;
      b.lineWidth = 1 + (6 * (i + 1)) / LV;
      b.stroke(p);
    });
    dots.forEach((lv, li) => lv.forEach((p, i) => {
      b.fillStyle = `rgba(232,230,250,${(FOAM[li][6] * (i + 1)) / LV})`;
      b.fill(p);
    }));

    // A soft violet glow over the water.
    b.globalCompositeOperation = 'soft-light';
    const lg = b.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, 'rgba(150,125,220,.22)');
    lg.addColorStop(1, 'rgba(70,62,130,.16)');
    b.fillStyle = lg;
    b.fillRect(0, 0, W, H);

    // Clip everything to the river.
    b.globalCompositeOperation = 'destination-in';
    b.fillStyle = '#fff';
    b.beginPath();
    for (let y = -S; y <= H + S; y += S) {
      const q = riverAt(y - scroll);
      y === -S ? b.moveTo(q.l, y) : b.lineTo(q.l, y);
    }
    for (let y = H + S; y >= -S; y -= S) {
      const q = riverAt(y - scroll);
      b.lineTo(q.r, y);
    }
    b.closePath();
    b.fill();
    b.globalCompositeOperation = 'source-over';

    this.tex.refresh();
  }
}

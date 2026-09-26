// Procedural placeholder art, drawn once at boot under the asset manifest keys.
// A texture is only drawn when no real file was loaded for its key: put the PNG in
// public/assets/, add one line to src/assets.js, and it replaces the placeholder.
// The water, light, glows and portal swirls are drawn live by RiverScene, not here.
import { GODS, WIDTH as W, HEIGHT as H } from './config.js';
import { rgbOf } from './color.js';
import { fbm, sstep, mixRGB } from './noise.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// Ines's bank plants and rocks, in a few sizes each (radius in px). RiverScene scatters them along the banks.
const PINE_R = [26, 32, 40];
const FERN_R = [14, 19, 24];
export const ROCK_R = [6, 8, 10, 12, 15];
const pineSize = (r) => Math.ceil(2 * (1.35 * r + 14));
export const pineCentre = (r) => pineSize(r) / 2 - 7; // the trunk sits up-left of centre; the shadow falls down-right
const rockSize = (r) => Math.ceil(2 * (r * 1.05 + 6));

function make(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  draw(tex.getContext(), w, h);
  tex.refresh();
}

export function makeArt(scene) {
  make(scene, 'bank', W, H, drawBank);
  PINE_R.forEach((r, i) => make(scene, `pine${i + 1}`, pineSize(r), pineSize(r), (g) => drawPine(g, r, pineCentre(r))));
  FERN_R.forEach((r, i) => make(scene, `fern${i + 1}`, Math.ceil(r * 2 + 16), Math.ceil(r * 2 + 16), (g) => drawFern(g, r)));
  for (let i = 1; i <= 3; i++) make(scene, `lily${i}`, 32, 36, drawLily);
  ROCK_R.forEach((r, i) => make(scene, `rock${i + 1}`, rockSize(r), rockSize(r), (g) => drawRock(g, r)));
  make(scene, 'glow', 64, 64, drawGlow);
  make(scene, 'ring', 64, 64, drawRing);
  make(scene, 'rim', 44, 44, drawRim);
  for (const god of GODS) {
    const c = rgbOf(god.color);
    make(scene, `soul_${god.key}`, 40, 40, (g) => drawSoul(g, c, god.glyph));
    make(scene, `medal_${god.key}`, 34, 34, (g) => drawMedal(g, c, god.glyph));
    make(scene, `glyph_${god.key}`, 48, 48, (g) => drawGlyph(g, god.glyph, 24, 24, 1.8, 'rgba(0,0,0,.35)', '#ffffff', 1.6));
    make(scene, `scroll_${god.key}`, 88, 64, (g) => drawScroll(g, c, god.glyph));
  }
  make(scene, 'arch', 150, 150, drawArch);
  make(scene, 'portal_fill', 52, 96, drawPortalFill);
  make(scene, 'swirl', 72, 72, drawSwirl);
  make(scene, 'beam', 64, 256, drawBeam);
  make(scene, 'pier', 100, 34, drawPier);
  make(scene, 'shop', 150, 150, drawShop);
  make(scene, 'boat', 100, 170, drawBoat);
  make(scene, 'obol', 40, 40, (g) => drawObol(g, 20, 20, 17));
  make(scene, 'icon_speed', 96, 96, drawIconSpeed);
  make(scene, 'icon_handling', 96, 96, drawIconHandling);
  make(scene, 'icon_hold', 96, 96, drawIconHold);
  make(scene, 'vignette', W, H, drawVignette);
  make(scene, 'fog', 256, 256, drawFog);
  make(scene, 'haze', W, H, drawHaze);
  make(scene, 'shade', W, H, drawShade);
}

/* ---------- god symbols (owl, spear, trident) on a 20-unit grid ---------- */
function glyphPath(g, type) {
  g.beginPath();
  if (type === 'owl') {
    g.moveTo(0.2, -1);
    g.arc(-4, -1, 4.2, 0, TAU);
    g.moveTo(8.4, -1);
    g.arc(4.2, -1, 4.2, 0, TAU);
    g.moveTo(-1.6, 3.8);
    g.lineTo(0, 6.8);
    g.lineTo(1.6, 3.8);
    g.moveTo(-7.4, -4.6);
    g.lineTo(-8.8, -9.4);
    g.moveTo(7.6, -4.6);
    g.lineTo(9, -9.4);
  } else if (type === 'spear') {
    g.moveTo(0, 10);
    g.lineTo(0, -3);
    g.moveTo(0, -10.5);
    g.lineTo(3.4, -4.2);
    g.lineTo(0, -2.2);
    g.lineTo(-3.4, -4.2);
    g.closePath();
    g.moveTo(-3.8, 1.5);
    g.lineTo(3.8, 1.5);
  } else {
    g.moveTo(0, 10);
    g.lineTo(0, -10);
    g.moveTo(-6.5, -8.5);
    g.lineTo(-6.5, -2);
    g.quadraticCurveTo(0, 2.8, 6.5, -2);
    g.lineTo(6.5, -8.5);
    g.moveTo(-1.8, -8);
    g.lineTo(0, -10.4);
    g.lineTo(1.8, -8);
  }
}

export function drawGlyph(g, type, x, y, s, under, over, lw) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  glyphPath(g, type);
  g.strokeStyle = under;
  g.lineWidth = (lw * 2.4) / s;
  g.stroke();
  g.strokeStyle = over;
  g.lineWidth = lw / s;
  g.stroke();
  g.restore();
}

/* ---------- banks, after Ines's river study ---------- */
// Ground for both banks, seamless top to bottom: mossy greens with bare-earth patches and grain,
// then grass, soft moss and tiny pale flowers. The water is drawn over the middle by code.
function drawBank(g) {
  const nBase = fbm(11, 6, 5, 1), nPatch = fbm(5, 3, 3, 2);
  const MOSS0 = [30, 42, 37], MOSS1 = [54, 72, 58], EARTH = [72, 68, 52];
  const img = g.createImageData(W, H), D = img.data;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W, i = (y * W + x) * 4;
      let col = mixRGB(MOSS0, MOSS1, sstep(0.3, 0.75, nBase(u, v)));
      col = mixRGB(col, EARTH, sstep(0.55, 0.8, nPatch(u, v)) * 0.45);
      const k = 0.9 + Math.random() * 0.12;
      D[i] = col[0] * k;
      D[i + 1] = col[1] * k;
      D[i + 2] = col[2] * k;
      D[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const wrap = (y, r, fn) => {
    fn(y);
    if (y < r) fn(y + H);
    if (y > H - r) fn(y - H);
  };
  for (let i = 0; i < 5900; i++) {
    const x = rnd(0, W), y = rnd(0, H), L = rnd(3, 8), a = rnd(-0.8, 0.8);
    const col = `rgba(${(80 + rnd(0, 40)) | 0},${(105 + rnd(0, 40)) | 0},${(75 + rnd(0, 25)) | 0},${rnd(0.25, 0.6)})`, lw = rnd(0.6, 1.3);
    wrap(y, 10, (yy) => {
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(x, yy);
      g.lineTo(x + Math.sin(a) * L, yy - Math.cos(a) * L);
      g.stroke();
    });
  }
  for (let i = 0; i < 300; i++) {
    const x = rnd(-20, W + 20), y = rnd(0, H), r = rnd(10, 30);
    const c = `${(70 + rnd(0, 20)) | 0},${(95 + rnd(0, 20)) | 0},${(70 + rnd(0, 15)) | 0}`;
    wrap(y, 32, (yy) => {
      const q = g.createRadialGradient(x, yy, 0, x, yy, r);
      q.addColorStop(0, `rgba(${c},.22)`);
      q.addColorStop(1, 'rgba(60,85,60,0)');
      g.fillStyle = q;
      g.fillRect(x - r, yy - r, r * 2, r * 2);
    });
  }
  for (let i = 0; i < 100; i++) {
    const x = rnd(0, W), y = rnd(0, H), n = rnd(4, 10) | 0, col = Math.random() < 0.5 ? '215,210,235' : '235,232,220';
    for (let k = 0; k < n; k++) {
      const xx = x + rnd(-10, 10), yy0 = y + rnd(-10, 10), rr = rnd(0.7, 1.5), a = rnd(0.35, 0.7);
      wrap(yy0, 12, (yy) => {
        g.fillStyle = `rgba(${col},${a})`;
        g.beginPath();
        g.arc(xx, yy, rr, 0, TAU);
        g.fill();
      });
    }
  }
}

// A pine seen from above: a soft shadow, a dark disc, and three layers of radiating needles.
function drawPine(g, r, c) {
  const sh = g.createRadialGradient(c + 12, c + 14, 2, c + 12, c + 14, r * 1.35);
  sh.addColorStop(0, 'rgba(6,10,9,.45)');
  sh.addColorStop(1, 'rgba(6,10,9,0)');
  g.fillStyle = sh;
  g.beginPath();
  g.arc(c + 12, c + 14, r * 1.35, 0, TAU);
  g.fill();
  const base = g.createRadialGradient(c - r * 0.2, c - r * 0.2, 2, c, c, r);
  base.addColorStop(0, 'rgba(58,82,64,.95)');
  base.addColorStop(0.7, 'rgba(30,46,38,.95)');
  base.addColorStop(1, 'rgba(22,34,28,0)');
  g.fillStyle = base;
  g.beginPath();
  g.arc(c, c, r, 0, TAU);
  g.fill();
  [[1, '38,58,45', 70], [0.72, '52,76,58', 55], [0.45, '72,98,74', 38]].forEach(([s, col, n], k) => {
    const rr = r * s, ox = -k * 2, oy = -k * 2.3;
    for (let j = 0; j < n; j++) {
      const a = rnd(0, TAU), l = rr * rnd(0.55, 1);
      g.strokeStyle = `rgba(${col},${rnd(0.45, 0.8)})`;
      g.lineWidth = rnd(0.8, 1.8);
      g.beginPath();
      g.moveTo(c + ox + Math.cos(a) * l * 0.15, c + oy + Math.sin(a) * l * 0.15);
      g.lineTo(c + ox + Math.cos(a + rnd(-0.08, 0.08)) * l, c + oy + Math.sin(a + rnd(-0.08, 0.08)) * l);
      g.stroke();
    }
  });
  g.fillStyle = 'rgba(120,145,115,.35)';
  g.beginPath();
  g.arc(c - 5, c - 6, r * 0.12, 0, TAU);
  g.fill();
}

// A fern from above: curved fronds with small leaflets along each one.
function drawFern(g, r) {
  const x = r + 8, y = r + 8, fr = rnd(5, 8) | 0, rot = rnd(0, TAU);
  const col = `${(55 + rnd(0, 25)) | 0},${(85 + rnd(0, 25)) | 0},${(58 + rnd(0, 15)) | 0}`;
  for (let f = 0; f < fr; f++) {
    const a = rot + (f / fr) * TAU + rnd(-0.2, 0.2), L = r * rnd(0.75, 1), bend = rnd(-0.35, 0.35);
    const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L, mx = x + Math.cos(a + bend) * L * 0.55, my = y + Math.sin(a + bend) * L * 0.55;
    g.strokeStyle = `rgba(${col},.75)`;
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(mx, my, ex, ey);
    g.stroke();
    for (let k = 1; k < 8; k++) {
      const t = k / 8, px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * ex, py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * my + t * t * ey;
      const ll = (1 - t) * L * 0.28 + 1;
      for (const sd of [-1, 1]) {
        const aa = a + sd * 1.1;
        g.fillStyle = `rgba(${col},.55)`;
        g.beginPath();
        g.ellipse(px + Math.cos(aa) * ll * 0.5, py + Math.sin(aa) * ll * 0.5, ll * 0.5, ll * 0.18, aa, 0, TAU);
        g.fill();
      }
    }
  }
}

// A red spider lily, the flower of the dead: a stem, seven curled petals and long pale stamens.
function drawLily(g) {
  const x = 16, y = 15, s = rnd(5.5, 7.5);
  g.strokeStyle = 'rgba(40,70,40,.6)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + rnd(-3, 3), y + s * 1.4);
  g.stroke();
  for (let j = 0; j < 7; j++) {
    const a = (j / 7) * TAU + rnd(-0.2, 0.2);
    g.strokeStyle = `rgba(${(165 + rnd(0, 40)) | 0},${(35 + rnd(0, 20)) | 0},${(38 + rnd(0, 15)) | 0},.85)`;
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.9, x + Math.cos(a + 0.5) * s, y + Math.sin(a + 0.5) * s);
    g.stroke();
    g.strokeStyle = 'rgba(235,120,110,.55)';
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a - 0.15) * s * 1.5, y + Math.sin(a - 0.15) * s * 1.5);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,170,150,.8)';
  g.beginPath();
  g.arc(x, y, 1.1, 0, TAU);
  g.fill();
}

// A rounded grey stone with a shadow and a patch of moss.
function drawRock(g, r) {
  const c = rockSize(r) / 2 - 2, ry = r * rnd(0.6, 0.9);
  g.fillStyle = 'rgba(8,10,10,.4)';
  g.beginPath();
  g.ellipse(c + 3, c + 4, r * 1.05, ry * 1.05, 0, 0, TAU);
  g.fill();
  const gr = g.createRadialGradient(c - r * 0.35, c - ry * 0.4, 1, c, c, r * 1.1);
  gr.addColorStop(0, '#6f7874');
  gr.addColorStop(0.55, '#454d4a');
  gr.addColorStop(1, '#232927');
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(c, c, r, ry, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(90,120,80,.45)';
  g.beginPath();
  g.ellipse(c + r * 0.2, c + ry * 0.3, r * 0.45, ry * 0.3, 0, 0, TAU);
  g.fill();
}

/* ---------- light and effects (white, tinted in game) ---------- */
function drawGlow(g, w) {
  const r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,255,255,.3)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, w);
}

function drawRing(g, w) {
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(w / 2, w / 2, w / 2 - 3, 0, TAU);
  g.stroke();
}

// Two arcs that spin around a soul.
function drawRim(g) {
  g.strokeStyle = 'rgba(255,255,255,.45)';
  g.lineWidth = 1.3;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(22, 22, 14, 0, 1.9);
  g.stroke();
  g.beginPath();
  g.arc(22, 22, 14, Math.PI, Math.PI + 1.1);
  g.stroke();
}

// A soul: a glowing bubble in its god's color with the god's symbol. The halo is a separate glow.
function drawSoul(g, c, glyph) {
  const x = 20, y = 20, R = 17;
  const gr = g.createRadialGradient(x - R * 0.32, y - R * 0.36, R * 0.05, x, y, R);
  gr.addColorStop(0, 'rgba(255,255,255,.9)');
  gr.addColorStop(0.3, rgba(c, 0.7));
  gr.addColorStop(0.8, rgba(c, 0.28));
  gr.addColorStop(1, rgba(c, 0.5));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, R, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(245,242,255,.4)';
  g.lineWidth = 1.1;
  g.stroke();
  drawGlyph(g, glyph, x, y + R * 0.04, R * 0.043, 'rgba(24,16,44,.5)', 'rgba(255,255,255,.95)', 1.15);
  g.fillStyle = 'rgba(255,255,255,.7)';
  g.beginPath();
  g.ellipse(x - R * 0.56, y - R * 0.56, R * 0.13, R * 0.07, -0.7, 0, TAU);
  g.fill();
}

// HUD medallion: the god's symbol in a dark coin ringed with their color.
function drawMedal(g, c, glyph) {
  g.fillStyle = 'rgba(14,14,24,.92)';
  g.beginPath();
  g.arc(17, 17, 14, 0, TAU);
  g.fill();
  g.strokeStyle = rgba(c, 0.9);
  g.lineWidth = 1.8;
  g.stroke();
  drawGlyph(g, glyph, 17, 17.5, 14 / 15, rgba(c, 0.45), 'rgba(255,255,255,.95)', 1.2);
}

// A scroll from Hermes' stall: parchment between two rolled ends, sealed in the god's color.
function drawScroll(g, c, glyph) {
  const paper = g.createLinearGradient(0, 10, 0, 54);
  paper.addColorStop(0, '#efe3c2');
  paper.addColorStop(1, '#c9b27f');
  g.fillStyle = paper;
  g.fillRect(16, 12, 56, 40);
  g.strokeStyle = 'rgba(90,64,30,.35)';
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(24, 20 + i * 8);
    g.lineTo(i === 3 ? 44 : 60, 20 + i * 8);
    g.stroke();
  }
  for (const x of [12, 76]) {
    const roll = g.createLinearGradient(x - 6, 0, x + 6, 0);
    roll.addColorStop(0, '#9c8352');
    roll.addColorStop(0.5, '#f4e9cc');
    roll.addColorStop(1, '#8a7145');
    g.fillStyle = roll;
    g.beginPath();
    g.roundRect(x - 6, 6, 12, 52, 6);
    g.fill();
  }
  g.fillStyle = rgba(c, 1);
  g.beginPath();
  g.arc(58, 44, 12, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = 1.5;
  g.stroke();
  drawGlyph(g, glyph, 58, 44.5, 0.75, 'rgba(0,0,0,.25)', 'rgba(255,255,255,.95)', 1.1);
}

/* ---------- shrines ---------- */
// Stone arch, base centre at (75, 138). The opening stays transparent: the portal shows through.
function drawArch(g) {
  g.translate(75, 138);
  const stone = (x0, x1) => {
    const l = g.createLinearGradient(x0, 0, x1, 0);
    l.addColorStop(0, '#a3b0aa');
    l.addColorStop(0.5, '#7b8984');
    l.addColorStop(1, '#4e5a56');
    return l;
  };
  const block = (x, y, w, h) => {
    g.fillStyle = stone(x, x + w);
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(16,22,20,.45)';
    g.fillRect(x, y + h - 1.3, w, 1.3);
    g.fillStyle = 'rgba(235,242,238,.16)';
    g.fillRect(x, y, w, 1);
  };
  const sh = g.createRadialGradient(0, 2, 4, 0, 2, 70);
  sh.addColorStop(0, 'rgba(8,12,11,.55)');
  sh.addColorStop(1, 'rgba(8,12,11,0)');
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(0, 3, 70, 13, 0, 0, TAU);
  g.fill();
  block(-50, -8, 100, 8);
  for (const sx of [-1, 1]) {
    const x = sx < 0 ? -41 : 24;
    let y = -8;
    for (let i = 0; y > -64; i++) {
      const h = i % 2 ? 10 : 12;
      block(x, y - h, 17, h);
      y -= h;
    }
    block(sx < 0 ? -44 : 21, -68, 23, 5);
  }
  const R0 = 24, R1 = 41, cy = -68;
  for (let i = 0; i < 9; i++) {
    const a0 = Math.PI + (i * Math.PI) / 9, a1 = a0 + Math.PI / 9, key = i === 4;
    const r0 = key ? R0 - 2 : R0, r1 = key ? R1 + 5 : R1;
    g.beginPath();
    g.arc(0, cy, r1, a0 + 0.012, a1 - 0.012);
    g.arc(0, cy, r0, a1 - 0.012, a0 + 0.012, true);
    g.closePath();
    const m = (a0 + a1) / 2;
    g.fillStyle = stone(Math.cos(m) * R1 - 10, Math.cos(m) * R1 + 10);
    g.fill();
    g.strokeStyle = 'rgba(18,24,22,.5)';
    g.lineWidth = 0.8;
    g.stroke();
  }
  for (let i = 0; i < 24; i++) {
    g.fillStyle = `rgba(${(78 + rnd(0, 30)) | 0},${(108 + rnd(0, 30)) | 0},${(78 + rnd(0, 20)) | 0},${rnd(0.25, 0.55)})`;
    g.beginPath();
    g.ellipse(rnd(-50, 50), rnd(-9, 0), rnd(2, 6), rnd(1, 2.4), 0, 0, TAU);
    g.fill();
  }
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 700; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.1)';
    g.fillRect(rnd(-55, 55), rnd(-120, 2), rnd(0.5, 1.5), rnd(0.5, 1.5));
  }
  g.globalCompositeOperation = 'source-over';
}

function openingPath(g) {
  g.beginPath();
  g.moveTo(-24, -8);
  g.lineTo(-24, -68);
  g.arc(0, -68, 24, Math.PI, 0);
  g.lineTo(24, -8);
  g.closePath();
}

// The portal inside the arch: bright at the heart, dark at the stones. Tinted with the god's color.
function drawPortalFill(g) {
  g.translate(26, 96);
  openingPath(g);
  const gr = g.createRadialGradient(0, -46, 2, 0, -46, 58);
  gr.addColorStop(0, 'rgba(255,255,255,.95)');
  gr.addColorStop(0.5, 'rgba(90,90,104,.95)');
  gr.addColorStop(1, 'rgba(16,16,24,.97)');
  g.fillStyle = gr;
  g.fill();
}

function drawSwirl(g) {
  g.translate(36, 36);
  g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k * 0.22)})`;
    g.lineWidth = 2.2 - k * 0.5;
    g.beginPath();
    for (let j = 0; j <= 40; j++) {
      const q = j / 40, ang = q * Math.PI * 3 + k * 2.1, rr = 3 + q * 30;
      j ? g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : g.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    g.stroke();
  }
}

function drawBeam(g, w, h) {
  const gr = g.createLinearGradient(0, h, 0, 0);
  gr.addColorStop(0, 'rgba(255,255,255,.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(w / 2 - 13, h);
  g.lineTo(w / 2 + 13, h);
  g.lineTo(w - 2, 0);
  g.lineTo(2, 0);
  g.closePath();
  g.fill();
}

// Wooden pier, 96 px of planks with posts at the water end (right). Stretched to length in game.
function drawPier(g) {
  g.fillStyle = 'rgba(4,4,10,.45)';
  g.fillRect(4, 8, 96, 24);
  g.fillStyle = '#4b3b2f';
  g.fillRect(0, 2, 96, 24);
  g.strokeStyle = 'rgba(18,12,8,.55)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 5; x < 96; x += 6) {
    g.moveTo(x, 2);
    g.lineTo(x, 26);
  }
  g.stroke();
  g.fillStyle = 'rgba(235,205,165,.13)';
  g.fillRect(0, 2, 96, 1.5);
  g.fillStyle = '#271d16';
  for (const y of [2, 26]) {
    g.beginPath();
    g.arc(92, y, 3.4, 0, TAU);
    g.fill();
  }
}

// Hermes' stall, base centre at (75, 138): a wooden booth with a striped awning and a coin sign.
function drawShop(g) {
  g.translate(75, 138);
  const sh = g.createRadialGradient(0, 2, 4, 0, 2, 70);
  sh.addColorStop(0, 'rgba(8,12,11,.55)');
  sh.addColorStop(1, 'rgba(8,12,11,0)');
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(0, 3, 70, 13, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#3b2e24';
  g.fillRect(-54, -8, 108, 8);
  const wall = g.createLinearGradient(-44, 0, 44, 0);
  wall.addColorStop(0, '#4a372a');
  wall.addColorStop(0.5, '#634a37');
  wall.addColorStop(1, '#3d2d22');
  g.fillStyle = wall;
  g.fillRect(-44, -80, 88, 72);
  g.strokeStyle = 'rgba(20,14,10,.5)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = -36; x < 44; x += 8) {
    g.moveTo(x, -80);
    g.lineTo(x, -8);
  }
  g.stroke();
  g.fillStyle = '#140f14';
  g.fillRect(-32, -68, 64, 30);
  const warm = g.createRadialGradient(0, -53, 2, 0, -53, 42);
  warm.addColorStop(0, 'rgba(255,196,120,.6)');
  warm.addColorStop(1, 'rgba(255,196,120,0)');
  g.fillStyle = warm;
  g.fillRect(-32, -68, 64, 30);
  for (const [x, c] of [[-20, '#8fd6c0'], [-8, '#e0a45a'], [4, '#b9a0ff']]) {
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(x, -43, 4, 5.5, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#e8dcc0';
  g.fillRect(12, -47, 14, 5);
  g.fillStyle = '#7a5c43';
  g.fillRect(-48, -38, 96, 8);
  g.fillStyle = 'rgba(255,230,190,.2)';
  g.fillRect(-48, -38, 96, 1.5);
  g.fillStyle = '#5a4331';
  g.fillRect(-48, -30, 96, 22);
  g.fillStyle = '#2e2219';
  g.fillRect(-52, -104, 6, 96);
  g.fillRect(46, -104, 6, 96);
  // striped awning
  g.save();
  g.beginPath();
  g.moveTo(-60, -80);
  g.lineTo(60, -80);
  g.lineTo(48, -104);
  g.lineTo(-48, -104);
  g.closePath();
  g.fillStyle = '#5e2a3c';
  g.fill();
  g.clip();
  g.fillStyle = '#7a3a50';
  for (let x = -60; x < 60; x += 20) g.fillRect(x, -106, 10, 28);
  g.restore();
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#7a3a50' : '#5e2a3c';
    g.beginPath();
    g.arc(-52.5 + i * 15, -80, 7.5, 0, Math.PI);
    g.fill();
  }
  // lantern and coin sign
  g.fillStyle = '#ffd28a';
  g.beginPath();
  g.arc(-49, -84, 3.5, 0, TAU);
  g.fill();
  g.strokeStyle = '#2e2219';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(52, -96);
  g.lineTo(60, -96);
  g.lineTo(60, -86);
  g.stroke();
  drawObol(g, 60, -74, 11);
}

/* ---------- boat ---------- */
function hullPath(g) {
  g.beginPath();
  g.moveTo(0, -66);
  g.bezierCurveTo(17, -52, 29, -26, 29, 2);
  g.lineTo(27, 46);
  g.quadraticCurveTo(26, 59, 13, 60);
  g.lineTo(-13, 60);
  g.quadraticCurveTo(-26, 59, -27, 46);
  g.lineTo(-29, 2);
  g.bezierCurveTo(-29, -26, -17, -52, 0, -66);
  g.closePath();
}

// Charon's ferry from above, bow up. The hull's centre sits at (40, 72) of the 100x170 canvas.
function drawBoat(g) {
  g.translate(40, 72);
  g.save();
  g.translate(7, 10);
  hullPath(g);
  g.fillStyle = 'rgba(0,0,8,.5)';
  g.fill();
  g.restore();
  g.strokeStyle = '#5e4a36';
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(9, 38);
  g.lineTo(42, 91);
  g.stroke();
  hullPath(g);
  const hg = g.createLinearGradient(-30, 0, 30, 0);
  hg.addColorStop(0, '#271d17');
  hg.addColorStop(0.5, '#473629');
  hg.addColorStop(1, '#211813');
  g.fillStyle = hg;
  g.fill();
  g.strokeStyle = 'rgba(220,186,146,.3)';
  g.lineWidth = 1.5;
  g.stroke();
  g.save();
  g.scale(0.8, 0.86);
  g.translate(0, 3);
  hullPath(g);
  g.restore();
  g.fillStyle = '#30251e';
  g.fill();
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(0,0,0,.3)';
  g.lineWidth = 1;
  g.beginPath();
  for (let y = -58; y < 60; y += 9) {
    g.moveTo(-30, y);
    g.lineTo(30, y);
  }
  g.stroke();
  g.restore();
  g.fillStyle = '#2a1e15';
  g.fillRect(-1.2, -66, 2.4, 9);
  g.fillStyle = '#ffe2a8';
  g.beginPath();
  g.arc(0, -67, 3.6, 0, TAU);
  g.fill();
  // Charon, hooded, at the stern
  g.fillStyle = '#0e0c14';
  g.beginPath();
  g.ellipse(0, 43, 18, 11, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#1a1622';
  g.beginPath();
  g.moveTo(-10, 40);
  g.quadraticCurveTo(0, 22, 10, 40);
  g.quadraticCurveTo(0, 50, -10, 40);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(175,155,255,.38)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.ellipse(0, 43, 18, 11, 0, Math.PI * 1.08, Math.PI * 1.92);
  g.stroke();
  g.fillStyle = 'rgba(222,214,200,.55)';
  g.beginPath();
  g.arc(8, 37, 2.2, 0, TAU);
  g.fill();
}

// An obol, stamped with Athena's owl like the real Athenian coins.
function drawObol(g, x, y, r) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, '#f3d79a');
  gr.addColorStop(0.55, '#c49a52');
  gr.addColorStop(1, '#7d5c2c');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(70,48,18,.7)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(x, y, r * 0.78, 0, TAU);
  g.stroke();
  drawGlyph(g, 'owl', x, y + 0.5, r / 17, 'rgba(0,0,0,0)', 'rgba(80,55,20,.85)', 1.1);
}

/* ---------- shop icons ---------- */
function drawIconSpeed(g) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 6;
  [30, 50, 70].forEach((y, i) => {
    g.strokeStyle = `rgba(241,230,200,${0.45 + i * 0.25})`;
    g.beginPath();
    g.moveTo(26, y - 10);
    g.lineTo(48, y + 4);
    g.lineTo(70, y - 10);
    g.stroke();
  });
}

function drawIconHandling(g) {
  g.translate(48, 48);
  g.strokeStyle = '#f1e6c8';
  g.fillStyle = '#f1e6c8';
  g.lineCap = 'round';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(0, 0, 22, 0, TAU);
  g.stroke();
  g.lineWidth = 3.5;
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8;
    g.beginPath();
    g.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
    g.lineTo(Math.cos(a) * 33, Math.sin(a) * 33);
    g.stroke();
    g.beginPath();
    g.arc(Math.cos(a) * 34, Math.sin(a) * 34, 3.5, 0, TAU);
    g.fill();
  }
  g.beginPath();
  g.arc(0, 0, 6, 0, TAU);
  g.fill();
}

function drawIconHold(g) {
  g.translate(48, 50);
  g.save();
  g.scale(0.62, 0.62);
  hullPath(g);
  g.restore();
  g.strokeStyle = '#f1e6c8';
  g.lineWidth = 3.5;
  g.stroke();
  GODS.forEach((god, i) => {
    g.fillStyle = rgba(rgbOf(god.color), 0.95);
    g.beginPath();
    g.arc(0, -16 + i * 14, 5.5, 0, TAU);
    g.fill();
  });
}

// Atmosphere, after Ines's river study. A fog bank: soft all the way out (tinted grey-blue in game).
function drawFog(g, w) {
  const r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.6, 'rgba(255,255,255,.5)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, w);
}

// Haze fading in at the top and bottom of the screen, for a sense of distance (tinted in game).
function drawHaze(g) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(255,255,255,.28)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0)');
  gr.addColorStop(0.8, 'rgba(255,255,255,0)');
  gr.addColorStop(1, 'rgba(255,255,255,.18)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
}

// Darkened corners and edges.
function drawShade(g) {
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 1.01);
  gr.addColorStop(0, 'rgba(8,10,12,0)');
  gr.addColorStop(1, 'rgba(8,10,12,.55)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
}

// Screen-edge glow for danger, tinted red in game.
function drawVignette(g) {
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, W * 0.62);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(1, 'rgba(255,255,255,.95)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
}

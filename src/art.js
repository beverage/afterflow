// Procedural placeholder art, drawn once at boot under the asset manifest keys.
// A texture is only drawn when no real file was loaded for its key: put the PNG in
// public/assets/, add one line to src/assets.js, and it replaces the placeholder.
// The water, light, glows and portal swirls are drawn live by RiverScene, not here.
import { GODS, STALL, OBSTACLES, WIDTH as W, HEIGHT as H } from './config.js';
import { rgbOf } from './color.js';
import { fbm, sstep, mixRGB } from './noise.js';
import { CRAGS, SNAGS, makeRand, lobeU, biteU, spineAt } from './obstacles.js';

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
  make(scene, 'shop', STALL.frameWidth, STALL.frameHeight, drawStall);
  make(scene, 'medal_hermes', 34, 34, (g) => drawMedal(g, [255, 196, 120], 'caduceus'));
  make(scene, 'boat', 100, 170, drawBoat);
  make(scene, 'obol', 40, 40, (g) => drawObol(g, 20, 20, 17));
  make(scene, 'icon_speed', 96, 96, drawIconSpeed);
  make(scene, 'icon_handling', 96, 96, drawIconHandling);
  make(scene, 'icon_hold', 96, 96, drawIconHold);
  make(scene, 'vignette', W, H, drawVignette);
  make(scene, 'fog', 256, 256, drawFog);
  make(scene, 'haze', W, H, drawHaze);
  make(scene, 'shade', W, H, drawShade);
  // obstacles in the river: drawn from the same shapes as their collision (src/obstacles.js)
  CRAGS.forEach((sh, i) => make(scene, `crag${i}`, sh.size, sh.size, (g) => drawCrag(g, sh, 3001 + i * 17)));
  if (OBSTACLES.trees) SNAGS.forEach((s, i) => make(scene, `snag${i}`, s.box.w, s.box.h, (g) => drawSnag(g, s, 5001 + i)));
}

/* ---------- god symbols (owl, spear, trident, and Hermes' caduceus) on a 20-unit grid ---------- */
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
  } else if (type === 'caduceus') {
    g.moveTo(0, 10);
    g.lineTo(0, -7.5);
    g.moveTo(1.5, -9.2);
    g.arc(0, -9.2, 1.5, 0, TAU);
    g.moveTo(-1.2, -6.6);
    g.quadraticCurveTo(-5, -10, -9.4, -8.6);
    g.quadraticCurveTo(-6, -5.6, -1.2, -5);
    g.moveTo(1.2, -6.6);
    g.quadraticCurveTo(5, -10, 9.4, -8.6);
    g.quadraticCurveTo(6, -5.6, 1.2, -5);
    g.moveTo(-3.4, 8);
    g.bezierCurveTo(4.6, 5.4, 4.6, 1.6, 0, 0.4);
    g.bezierCurveTo(-4.6, -1, -4.2, -3.6, 0, -4.2);
    g.moveTo(3.4, 8);
    g.bezierCurveTo(-4.6, 5.4, -4.6, 1.6, 0, 0.4);
    g.bezierCurveTo(4.6, -1, 4.2, -3.6, 0, -4.2);
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

// Hermes' stall, a stand-in until Ines draws hers: a striped awning over a wooden counter of wares on a
// stone slab, a jetty out to the water and a pool of warm light where you dock. Seen at her portals' angle
// (facing right, toward the water) in the same 327x299 frame, its base point at STALL.anchor.
function drawStall(g) {
  const [ox, oy] = STALL.anchor;
  // u runs along the counter (up-right on screen), n out toward the water (down-right), h straight up.
  const P = (u, n, h = 0) => [ox + 0.92 * (u + n), oy + 0.39 * (n - u) - h];
  const quad = (pts, fill) => {
    g.beginPath();
    pts.forEach(([u, n, h], i) => g[i ? 'lineTo' : 'moveTo'](...P(u, n, h)));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  // A box shows its left end (-u), its front (+n, facing the water) and its top.
  const box = (u0, u1, n0, n1, h0, h1, top, front, side) => {
    quad([[u0, n0, h0], [u0, n1, h0], [u0, n1, h1], [u0, n0, h1]], side);
    quad([[u0, n1, h0], [u1, n1, h0], [u1, n1, h1], [u0, n1, h1]], front);
    quad([[u0, n0, h1], [u1, n0, h1], [u1, n1, h1], [u0, n1, h1]], top);
  };
  const line = (a, b, style, w) => {
    g.strokeStyle = style;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(...P(...a));
    g.lineTo(...P(...b));
    g.stroke();
  };

  // The pool of warm light on the water, and faint rays, like the light at Ines's portals.
  const ang = Math.atan2(0.39, 0.92), [cx, cy] = P(12, 112);
  g.save();
  g.translate(cx, cy);
  g.rotate(ang);
  g.scale(1, 0.42);
  const pool = g.createRadialGradient(0, 0, 4, 0, 0, 108);
  pool.addColorStop(0, 'rgba(255,200,130,.30)');
  pool.addColorStop(0.6, 'rgba(255,190,120,.12)');
  pool.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = pool;
  g.beginPath();
  g.arc(0, 0, 108, 0, TAU);
  g.fill();
  g.restore();
  g.lineCap = 'round';
  for (const u of [-6, 16, 38]) line([u, 70, 0], [u + 6, 196, 0], 'rgba(255,214,150,.10)', 5);

  // Stone slab, in the portals' stone.
  box(-62, 62, -34, 16, 0, 8, '#7b8476', '#5e6764', '#3a4340');
  // Back posts, then the counter in front of them.
  const wood = ['#8a6848', '#5f432e', '#3f2c20'];
  box(-47, -42, -24, -19, 8, 104, ...wood);
  box(42, 47, -24, -19, 8, 104, ...wood);
  box(-46, 46, -22, 6, 8, 40, '#977354', '#6b4b33', '#4a3324');
  for (let u = -38; u <= 38; u += 8) line([u, 6, 10], [u, 6, 39], 'rgba(30,20,14,.45)', 1);
  line([-46, 6, 40], [46, 6, 40], 'rgba(255,230,190,.35)', 1.2);
  // A banner on the counter with the caduceus, skewed onto the counter's face.
  quad([[-15, 6.2, 18], [15, 6.2, 18], [15, 6.2, 39], [-15, 6.2, 39]], '#8e4a2c');
  g.save();
  const [bx, by] = P(0, 6.2, 28.5);
  g.transform(0.92, -0.39, 0, 1, bx, by);
  drawGlyph(g, 'caduceus', 0, 0, 0.72, 'rgba(0,0,0,.3)', '#f3d38a', 1.1);
  g.restore();
  // Wares on the counter: amphorae in the gods' colors, scrolls, a pile of obols.
  GODS.forEach((god, i) => {
    const [x, y] = P(-34 + i * 11, -9, 40), c = rgbOf(god.color);
    g.fillStyle = rgba(c.map((v) => v * 0.62), 1);
    g.beginPath();
    g.ellipse(x, y - 6, 4.2, 6, 0, 0, TAU);
    g.fill();
    g.fillRect(x - 1.6, y - 14, 3.2, 4);
    g.fillStyle = 'rgba(255,255,255,.25)';
    g.beginPath();
    g.ellipse(x - 1.5, y - 8, 1.2, 2.6, 0, 0, TAU);
    g.fill();
  });
  for (let i = 0; i < 3; i++) {
    const [x, y] = P(8 + i * 3, -12 + i * 5, 40 + (i === 1 ? 3 : 0));
    g.fillStyle = '#e8dcbc';
    g.beginPath();
    g.ellipse(x, y - 2.5, 8, 2.6, -0.4, 0, TAU);
    g.fill();
    g.fillStyle = '#b89a62';
    g.beginPath();
    g.ellipse(x + 7, y - 5.2, 1.6, 2.4, 0, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 6; i++) {
    const [x, y] = P(30 + (i % 3) * 3, -10 + (i > 2 ? 4 : 0), 40 + (i === 5 ? 2 : 0));
    g.fillStyle = i % 2 ? '#d9a441' : '#f0c865';
    g.beginPath();
    g.ellipse(x, y - 1.5, 3.4, 1.6, 0, 0, TAU);
    g.fill();
  }
  // Front posts, and the awning over everything: cream and ochre stripes sloping down toward the water.
  box(-47, -42, 1, 6, 8, 90, ...wood);
  box(42, 47, 1, 6, 8, 90, ...wood);
  const back = -32, front = 14, hb = 108, hf = 88;
  for (let i = 0; i < 8; i++) {
    const u0 = -56 + i * 14, u1 = u0 + 14, col = i % 2 ? '#e6d6b0' : '#b8743a';
    quad([[u0, back, hb], [u1, back, hb], [u1, front, hf], [u0, front, hf]], col);
    // the scalloped valance hanging along the front edge
    quad([[u0, front, hf], [u1, front, hf], [u1, front, hf - 7], [u0, front, hf - 7]], i % 2 ? '#cdbd96' : '#9a5f2e');
    const [sx, sy] = P(u0 + 7, front, hf - 7);
    g.fillStyle = i % 2 ? '#cdbd96' : '#9a5f2e';
    g.beginPath();
    g.ellipse(sx, sy, 6.2, 3.4, -ang, 0, Math.PI);
    g.fill();
  }
  quad([[-56, back, hb], [-56, front, hf], [-56, front, hf - 7], [-56, back, hb - 7]], '#6e4523');
  line([-56, back, hb], [56, back, hb], 'rgba(255,240,210,.35)', 1);

  // A lantern hanging from the front corner, warm light spilling round it.
  const [lx, ly] = P(50, 16, 70);
  const lg = g.createRadialGradient(lx, ly, 1, lx, ly, 30);
  lg.addColorStop(0, 'rgba(255,214,150,.55)');
  lg.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = lg;
  g.beginPath();
  g.arc(lx, ly, 30, 0, TAU);
  g.fill();
  line([50, 16, 81], [50, 16, 75], '#2a211a', 1);
  g.fillStyle = '#2a211a';
  g.fillRect(lx - 3.5, ly - 6, 7, 11);
  g.fillStyle = '#ffd98f';
  g.fillRect(lx - 2, ly - 4, 4, 7);

  // The jetty out over the water, planks across it, two posts at its end.
  box(4, 30, 16, 84, 2, 6, '#8a6a4c', '#5a4330', '#4a3627');
  for (let n = 22; n < 84; n += 7) line([4, n, 6], [30, n, 6], 'rgba(30,20,14,.4)', 1);
  box(2, 6, 80, 85, -6, 12, ...wood);
  box(28, 32, 80, 85, -6, 12, ...wood);
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

/* ---------- obstacles in the river, after Ines's obstacle study, darker and craggier ---------- */

// A rock after Ines's makeRock (a lit height field with ridged noise): cold slate, angular chunks
// that meet in creases, chipped edges, faces freshly broken where a bite was taken, deep black cracks.
function drawCrag(g, sh, seed) {
  const R = makeRand(seed), r0 = sh.r0, S = sh.size, cx = S / 2, cy = S / 2;
  const n1 = fbm(5, 5, 4, R.int(1e6)), n2 = fbm(14, 14, 3, R.int(1e6)), n3 = fbm(24, 24, 2, R.int(1e6)), tone = fbm(3, 3, 3, R.int(1e6)), chip = fbm(9, 9, 3, R.int(1e6));
  const ridge = (v) => 1 - Math.abs(2 * v - 1);
  // height, "u" (< 1 inside) and nearness to a bite, at a pixel: the tallest chunk wins
  const field = (x, y) => {
    const px = x - cx, py = y - cy, nick = (chip(x / S, y / S) - 0.5) * 0.32, ub = biteU(sh, px, py) - nick;
    let h = -1, u = Infinity;
    for (const L of sh.lobes) {
      const lu = lobeU(L, px, py) + nick;
      u = Math.min(u, lu);
      if (lu < 1) h = Math.max(h, Math.sqrt(1 - lu * lu) * L.r * 0.62 * L.h + (1 - lu) * L.r * 0.16);
    }
    u = Math.max(u, 2 - ub);
    if (h < 0 || u >= 1) return [-1, u, 1];
    const broken = Math.min(1, (ub - 1) / 0.3);
    return [h * (0.55 + 0.45 * broken) + ridge(n1(x / S, y / S)) * r0 * 0.42 + ridge(n3(x / S, y / S)) * r0 * 0.14 + n2(x / S, y / S) * r0 * 0.1, u, broken];
  };
  const Hf = (x, y) => field(x, y)[0];
  // a soft shadow in the rock's own shape, falling down-right
  g.fillStyle = 'rgba(4,3,12,.14)';
  for (let k = 0; k < 5; k++) {
    const sc = 1 + k * 0.07;
    g.beginPath();
    sh.outline.forEach(([ox, oy], j) => (j ? g.lineTo(cx + r0 * 0.28 + ox * sc, cy + r0 * 0.38 + oy * sc) : g.moveTo(cx + r0 * 0.28 + ox * sc, cy + r0 * 0.38 + oy * sc)));
    g.closePath();
    g.fill();
  }
  const im = g.getImageData(0, 0, S, S), D = im.data, Lx = -0.52, Ly = -0.62, Lz = 0.59;
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const [h, u, broken] = field(x, y);
      if (h < 0) continue;
      let nx = -(Hf(x + 1, y) - Hf(x - 1, y)), ny = -(Hf(x, y + 1) - Hf(x, y - 1)), nz = 1.6;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const dif = Math.max(0, nx * Lx + ny * Ly + nz * Lz), spec = Math.pow(Math.max(0, nz * 0.9 + dif * 0.1), 14) * 0.05;
      const tn = tone(x / S, y / S), crev = ridge(n1(x / S, y / S));
      let k = (0.16 + 0.82 * dif + spec) * (0.8 + 0.28 * tn);
      k *= 0.5 + 0.5 * Math.min(1, crev * 1.7); // deep dark cracks
      k *= 0.65 + 0.35 * broken;
      const wet = Math.max(0, (y - cy) / sh.ext) * Math.max(0, u - 0.35) * 1.3; // the wet foot, darker
      const [cr, cg, cb] = tn > 0.64 ? [88, 86, 84] : [96, 100, 108];
      const wk = 1 - Math.min(0.7, wet), i = (y * S + x) * 4;
      let rr = cr * k * wk, gg = cg * k * wk, bb = cb * k * wk * (1 + wet * 0.12);
      if (ny > 0.3 && n2(x / S + 0.3, y / S) > 0.7) {
        rr = rr * 0.7 + 12; // a little dark moss on the shaded faces
        gg = gg * 0.7 + 16;
        bb = bb * 0.7 + 13;
      }
      D[i] = rr;
      D[i + 1] = gg;
      D[i + 2] = bb;
      D[i + 3] = Math.min(255, (1 - u) * r0 * 120);
    }
  }
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = S;
  tmp.getContext('2d').putImageData(im, 0, 0);
  g.drawImage(tmp, 0, 0);
  for (let i = 0; i < 4; i++) {
    const [ox, oy, onx, ony] = sh.outline[R.int(sh.outline.length)], pr = R.range(1.6, 3.2), px = cx + ox + onx * 2, py = cy + oy + ony * 2;
    const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, 0.5, px, py, pr);
    pg.addColorStop(0, '#4a5053');
    pg.addColorStop(1, '#15181a');
    g.fillStyle = pg;
    g.beginPath();
    g.ellipse(px, py, pr, pr * 0.78, R.range(0, 3), 0, TAU);
    g.fill();
  }
}

// A fallen dead tree after Ines's makeTree: grey, leafless, snapped. The root sits at (box.ox, box.oy).
function drawSnag(g, s, seed) {
  const R = makeRand(seed), tn = s.tone;
  // the two edges of a tapering run of wood, a little jagged
  const edges = (pts, off) => {
    const top = [], bot = [];
    pts.forEach((p, k) => {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, j1 = s.notch[(k + off) % s.notch.length], j2 = s.notch[(k + off + 7) % s.notch.length];
      top.push([p[0] - nx * (p[2] + j1), p[1] - ny * (p[2] + j1)]);
      bot.push([p[0] + nx * (p[2] - j2), p[1] + ny * (p[2] - j2)]);
    });
    return { top, bot };
  };
  const woodPath = (pts, off, tip, dx = 0, dy = 0) => {
    const { top, bot } = edges(pts, off), e = pts[pts.length - 1], p = pts[pts.length - 2], a = Math.atan2(e[1] - p[1], e[0] - p[0]);
    g.beginPath();
    top.forEach(([x, y], k) => (k ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy)));
    if (tip) for (const [u, v] of [[tip[0], tip[1] - 3], [tip[2] * 0.4, tip[1] + 1], [tip[2], 4]]) g.lineTo(e[0] + u * Math.cos(a) - v * Math.sin(a) + dx, e[1] + u * Math.sin(a) + v * Math.cos(a) + dy);
    for (let k = bot.length - 1; k >= 0; k--) g.lineTo(bot[k][0] + dx, bot[k][1] + dy);
    g.closePath();
  };
  // wood: a mid-grey body, a dark rim upstream and underside downstream, a dull bleached band on top
  const wood = (pts, off, tip) => {
    woodPath(pts, off, tip);
    g.fillStyle = tn.mid;
    g.fill();
    g.save();
    woodPath(pts, off, tip);
    g.clip();
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay, ah] = pts[k], [bx, by, bh] = pts[k + 1], l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l, ny = (bx - ax) / l, h = (ah + bh) / 2;
      for (const [o, w, col, al] of [[0.8, 0.9, tn.dark, 1], [-0.92, 0.35, tn.dark, 1], [-0.35, 0.42, tn.light, 0.55]]) {
        g.globalAlpha = al;
        g.strokeStyle = col;
        g.lineWidth = h * w;
        g.beginPath();
        g.moveTo(ax + nx * ah * o, ay + ny * ah * o);
        g.lineTo(bx + nx * bh * o, by + ny * bh * o);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    g.restore();
    woodPath(pts, off, tip);
    g.strokeStyle = 'rgba(8,8,10,.7)';
    g.lineWidth = 1;
    g.stroke();
  };
  g.translate(s.box.ox, s.box.oy);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.fillStyle = 'rgba(5,4,12,.42)'; // shadow on the water, falling down-right
  woodPath(s.spine, 0, s.tip, 3, 8);
  g.fill();
  s.limbs.forEach((l, k) => {
    woodPath(l, 11 + k * 5, s.limbTips[k], 3, 8);
    g.fill();
  });
  // roots, or the whole root plate of an uprooted tree
  for (const rt of s.roots) {
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(Math.cos(rt.a) * rt.l1 * 0.55, Math.sin(rt.a) * rt.l2 * 0.6, Math.cos(rt.a) * rt.l1, Math.sin(rt.a) * rt.l2);
    g.strokeStyle = '#2a2b2e';
    g.lineWidth = rt.w + 1;
    g.stroke();
    g.strokeStyle = tn.edge;
    g.lineWidth = rt.w * 0.45;
    g.stroke();
  }
  g.fillStyle = '#1e1d20';
  g.beginPath();
  if (s.kind === 'uprooted') {
    // seen from above, the root plate stands up across the trunk: a narrow, tall wall of earth
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU, rr = s.plate * R.range(0.82, 1.05);
      k ? g.lineTo(Math.cos(a) * rr * 0.45, Math.sin(a) * rr * 1.1) : g.moveTo(Math.cos(a) * rr * 0.45, Math.sin(a) * rr * 1.1);
    }
  } else g.ellipse(0, 0, 24, 30, 0, 0, TAU);
  g.fill();
  for (let k = s.kind === 'uprooted' ? 12 : 3; k > 0; k--) {
    g.fillStyle = `rgba(${(110 + R.range(0, 30)) | 0},${(106 + R.range(0, 26)) | 0},${(98 + R.range(0, 20)) | 0},.2)`; // clods of dry earth
    g.beginPath();
    g.ellipse(R.range(-0.3, 0.25) * s.plate, R.range(-0.9, 0.9) * s.plate, R.range(3, 7), R.range(2, 5), R.range(0, 3), 0, TAU);
    g.fill();
  }
  // broken stubs and bare branches, under the trunk
  for (const st of s.stubs) {
    g.beginPath();
    g.moveTo(st.x0, st.y0);
    g.lineTo(st.ex, st.ey);
    g.strokeStyle = tn.dark;
    g.lineWidth = st.w + 1.6;
    g.stroke();
    g.strokeStyle = tn.edge;
    g.lineWidth = st.w * 0.55;
    g.stroke();
    g.fillStyle = tn.light; // the pale broken end
    g.beginPath();
    g.arc(st.ex, st.ey, st.w * 0.45, 0, TAU);
    g.fill();
  }
  for (const b of s.branches) {
    for (const [col, w] of [['#242629', b.w + 1.6], [tn.edge, b.w * 0.6]]) {
      g.beginPath();
      g.moveTo(b.x0, b.y0);
      g.quadraticCurveTo(b.cx, b.cy, b.x1, b.y1);
      g.strokeStyle = col;
      g.lineWidth = w;
      g.stroke();
    }
    for (const [ax, ay, bx, by] of b.twigs) {
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.strokeStyle = '#282a2d';
      g.lineWidth = 1.8;
      g.stroke();
      g.strokeStyle = tn.light;
      g.lineWidth = 0.7;
      g.stroke();
    }
  }
  // the limbs, then the trunk over them, snapped off at the tip
  s.limbs.forEach((l, k) => wood(l, 11 + k * 5, s.limbTips[k]));
  wood(s.spine, 0, s.tip);
  // long cracks and bleached streaks in the bark, knots where the branches leave
  g.save();
  woodPath(s.spine, 0, s.tip);
  g.clip();
  for (const [f, o, len] of s.bark) {
    const [x, y, h, a] = spineAt(s, f), px = x - Math.sin(a) * o * h * 0.7, py = y + Math.cos(a) * o * h * 0.7;
    g.strokeStyle = 'rgba(6,6,8,.6)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    g.stroke();
    g.strokeStyle = 'rgba(210,214,218,.13)';
    g.beginPath();
    g.moveTo(px + 2, py - 2);
    g.lineTo(px + Math.cos(a) * len * 0.7, py - 2 + Math.sin(a) * len * 0.7);
    g.stroke();
  }
  for (const b of s.branches) {
    g.fillStyle = '#1b1c1f';
    g.beginPath();
    g.ellipse(b.x0 + (b.x1 - b.x0) * 0.08, b.y0 + (b.y1 - b.y0) * 0.08, 3.5, 2.2, Math.atan2(b.y1 - b.y0, b.x1 - b.x0), 0, TAU);
    g.fill();
  }
  g.restore();
  for (let k = 0; k < 14; k++) {
    const [x, y, h, a] = spineAt(s, R.range(0.05, 0.75)), o = R.range(-0.6, 0.6) * h;
    g.fillStyle = `rgba(${(140 + R.range(0, 25)) | 0},${(150 + R.range(0, 20)) | 0},${(140 + R.range(0, 15)) | 0},.3)`; // grey lichen
    g.beginPath();
    g.ellipse(x - Math.sin(a) * o, y + Math.cos(a) * o, R.range(1.5, 4), R.range(1, 2.4), a, 0, TAU);
    g.fill();
  }
}

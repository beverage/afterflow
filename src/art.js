// Procedural placeholder art, drawn once at boot under the asset manifest keys.
// A texture is only drawn when no real file was loaded for its key: put the PNG in
// public/assets/, add one line to src/assets.js, and it replaces the placeholder.
// The water, light, glows and portal swirls are drawn live by RiverScene, not here.
import { GODS, WIDTH as W, HEIGHT as H } from './config.js';
import { rgbOf, mixColor, hexCss } from './color.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// Shore rocks, smallest to largest. RiverScene lines both banks with them.
export const SHORE_SIZES = [16, 20, 24, 28, 34, 40, 50, 60];
const STONE = [0x444d4a, 0x3c4442, 0x4a5350, 0x3a4046, 0x44445a, 0x4e5652, 0x353b3a];

function make(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  draw(tex.getContext(), w, h);
  tex.refresh();
}

export function makeArt(scene) {
  make(scene, 'bank', W, H, drawBank);
  [34, 40, 28].forEach((size, i) => make(scene, `pine${i + 1}`, size * 2, size * 2, (g) => drawPine(g, size)));
  for (let i = 1; i <= 3; i++) make(scene, `lily${i}`, 44, 44, drawLily);
  make(scene, 'rock', 26, 22, drawRock);
  make(scene, 'reeds', 26, 24, drawReeds);
  SHORE_SIZES.forEach((size, i) => {
    make(scene, `shore_l${i + 1}`, size, size, (g) => drawShoreRock(g, size, true)); // left bank: water on its right
    make(scene, `shore_r${i + 1}`, size, size, (g) => drawShoreRock(g, size, false));
  });
  for (let i = 1; i <= 3; i++) make(scene, `gravel${i}`, 44, 28, drawGravel);
  make(scene, 'glow', 64, 64, drawGlow);
  make(scene, 'ring', 64, 64, drawRing);
  make(scene, 'rim', 44, 44, drawRim);
  for (const god of GODS) {
    const c = rgbOf(god.color);
    make(scene, `soul_${god.key}`, 40, 40, (g) => drawSoul(g, c, god.glyph));
    make(scene, `medal_${god.key}`, 34, 34, (g) => drawMedal(g, c, god.glyph));
    make(scene, `glyph_${god.key}`, 48, 48, (g) => drawGlyph(g, god.glyph, 24, 24, 1.8, 'rgba(0,0,0,.35)', '#ffffff', 1.6));
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

/* ---------- banks ---------- */
// Ground for both banks, seamless top to bottom. The water is drawn over it by code.
function drawBank(g) {
  const base = g.createLinearGradient(0, 0, W, 0);
  base.addColorStop(0, '#1d2723');
  base.addColorStop(0.28, '#27332e');
  base.addColorStop(0.5, '#2b3732');
  base.addColorStop(0.72, '#27332e');
  base.addColorStop(1, '#1d2723');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const wrap = (y, r, fn) => {
    fn(y);
    if (y - r < 0) fn(y + H);
    if (y + r > H) fn(y - H);
  };
  for (let i = 0; i < 70; i++) {
    const x = rnd(0, W), y = rnd(0, H), r = rnd(40, 120), dark = Math.random() < 0.55;
    wrap(y, r, (yy) => {
      const gr = g.createRadialGradient(x, yy, 0, x, yy, r);
      gr.addColorStop(0, dark ? 'rgba(14,19,17,.3)' : 'rgba(72,94,78,.16)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, yy - r, r * 2, r * 2);
    });
  }
  g.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const x = rnd(0, W), y = rnd(0, H), s = rnd(3, 7);
    const col = pick(['rgba(84,110,90,.5)', 'rgba(64,86,70,.55)', 'rgba(104,128,106,.35)']);
    wrap(y, 10, (yy) => {
      g.strokeStyle = col;
      g.lineWidth = 1;
      g.beginPath();
      for (let k = -2; k <= 2; k++) {
        g.moveTo(x + k * 1.2, yy);
        g.lineTo(x + k * 2.4, yy - s);
      }
      g.stroke();
    });
  }
  for (let i = 0; i < 140; i++) {
    const x = rnd(0, W), y = rnd(0, H), rx = rnd(1.5, 4), ry = rx * rnd(0.6, 0.9), col = pick(['#5d6863', '#6b7672', '#4f5a55']);
    wrap(y, 6, (yy) => {
      g.fillStyle = 'rgba(12,16,15,.4)';
      g.beginPath();
      g.ellipse(x + 1, yy + 1.2, rx, ry, 0, 0, TAU);
      g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(x, yy, rx, ry, 0, 0, TAU);
      g.fill();
    });
  }
  for (let i = 0; i < 16000; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)';
    g.fillRect(rnd(0, W), rnd(0, H), 1.2, 1.2);
  }
}

// A pine seen from above: layered stars with a shadow falling down-right.
function drawPine(g, size) {
  g.translate(size, size);
  g.fillStyle = 'rgba(6,10,9,.38)';
  g.beginPath();
  g.ellipse(size * 0.2, size * 0.24, size * 0.76, size * 0.6, 0.3, 0, TAU);
  g.fill();
  for (const [col, k] of [['#17241f', 0.94], ['#1d2e27', 0.76], ['#25392f', 0.58], ['#2e4637', 0.4], ['#3a5543', 0.22]]) {
    const R = size * k, pts = 9, rot = rnd(0, TAU);
    g.fillStyle = col;
    g.beginPath();
    for (let i = 0; i <= pts * 2; i++) {
      const a = rot + (i * Math.PI) / pts, rr = i % 2 ? R * 0.62 : R;
      i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  const hl = g.createRadialGradient(-size * 0.3, -size * 0.35, 0, -size * 0.3, -size * 0.35, size * 0.8);
  hl.addColorStop(0, 'rgba(160,200,170,.14)');
  hl.addColorStop(1, 'rgba(160,200,170,0)');
  g.fillStyle = hl;
  g.beginPath();
  g.arc(0, 0, size * 0.94, 0, TAU);
  g.fill();
}

// Red spider lily, the flower of the dead in the River Flow painting.
function drawLily(g) {
  const s = 22;
  g.translate(s, s);
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, s);
  glow.addColorStop(0, 'rgba(230,60,50,.22)');
  glow.addColorStop(1, 'rgba(230,60,50,0)');
  g.fillStyle = glow;
  g.fillRect(-s, -s, s * 2, s * 2);
  g.lineCap = 'round';
  const rot = rnd(0, TAU);
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * TAU) / 6, ex = Math.cos(a + 0.25) * s * 0.9, ey = Math.sin(a + 0.25) * s * 0.9;
    g.strokeStyle = 'rgba(240,90,80,.85)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5, ex, ey);
    g.stroke();
    g.fillStyle = '#ffb0a0';
    g.beginPath();
    g.arc(ex, ey, 0.9, 0, TAU);
    g.fill();
    g.strokeStyle = '#d93a30';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(Math.cos(a - 0.3) * s * 0.45, Math.sin(a - 0.3) * s * 0.45, Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55);
    g.stroke();
  }
  g.fillStyle = '#7a1c18';
  g.beginPath();
  g.arc(0, 0, 2, 0, TAU);
  g.fill();
}

function drawRock(g) {
  g.fillStyle = 'rgba(8,11,10,.45)';
  g.beginPath();
  g.ellipse(14, 13, 9, 6.5, 0, 0, TAU);
  g.fill();
  g.fillStyle = pick(['#5b6661', '#68736e', '#4d5853']);
  g.beginPath();
  g.ellipse(12, 10, 9, 6.5, 0.3, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(230,240,236,.14)';
  g.beginPath();
  g.ellipse(9.5, 8, 4, 2.3, 0.3, 0, TAU);
  g.fill();
}

function drawReeds(g) {
  g.strokeStyle = 'rgba(96,122,100,.85)';
  g.lineWidth = 1.3;
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < 7; i++) {
    const x = 4 + i * 3, y = 22 - ((i * 7) % 4);
    g.moveTo(x, y);
    g.lineTo(x + rnd(-3, 3), y - 9 - (i % 3) * 3);
  }
  g.stroke();
}

// A shore stone seen from above: faceted, wet and dark at the waterline, lit violet by the river on one side.
function drawShoreRock(g, size, waterOnRight) {
  const c = size / 2, R = size * 0.4;
  const n = 7 + ((Math.random() * 3) | 0);
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU + rnd(-0.22, 0.22), r = R * rnd(0.74, 1);
    return [c + Math.cos(a) * r, c + Math.sin(a) * r * 0.84];
  });
  const outline = (dx, dy) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy)));
    g.closePath();
  };
  outline(size * 0.07, size * 0.09);
  g.fillStyle = 'rgba(3,4,8,.55)';
  g.fill();
  const base = pick(STONE);
  const body = g.createLinearGradient(c - R, c - R, c + R, c + R);
  body.addColorStop(0, hexCss(mixColor(base, 0xdfe8e4, 0.16)));
  body.addColorStop(0.55, hexCss(base));
  body.addColorStop(1, hexCss(mixColor(base, 0x06070b, 0.62)));
  outline(0, 0);
  g.fillStyle = body;
  g.fill();
  g.save();
  g.clip();
  for (let k = 0; k < 3; k++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${rnd(0.04, 0.09)})` : `rgba(0,0,0,${rnd(0.06, 0.12)})`;
    g.beginPath();
    g.moveTo(c + rnd(-R, R), c - R);
    g.lineTo(c + rnd(-R, R), c + R);
    g.lineTo(c + rnd(-R, R) * 1.2, c + rnd(-R, R));
    g.closePath();
    g.fill();
  }
  const wet = g.createLinearGradient(0, c + R * 0.9, 0, c - R * 0.1);
  wet.addColorStop(0, 'rgba(6,6,16,.55)');
  wet.addColorStop(1, 'rgba(8,8,18,0)');
  g.fillStyle = wet;
  g.fillRect(0, 0, size, size);
  const rim = g.createLinearGradient(waterOnRight ? c + R : c - R, 0, c, 0);
  rim.addColorStop(0, 'rgba(165,135,255,.38)');
  rim.addColorStop(1, 'rgba(165,135,255,0)');
  g.fillStyle = rim;
  g.fillRect(0, 0, size, size);
  for (let k = 0; k < 4; k++) {
    g.fillStyle = `rgba(${(88 + rnd(0, 30)) | 0},${(116 + rnd(0, 30)) | 0},${(84 + rnd(0, 20)) | 0},${rnd(0.2, 0.45)})`;
    g.beginPath();
    g.ellipse(c + rnd(-R * 0.6, R * 0.3), c - rnd(0, R * 0.6), rnd(1.2, R * 0.32), rnd(0.8, R * 0.18), 0, 0, TAU);
    g.fill();
  }
  for (let k = 0; k < size * 3; k++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.12)';
    g.fillRect(rnd(0, size), rnd(0, size), 1, 1);
  }
  g.restore();
  const edge = g.createLinearGradient(c - R, c - R, c + R, c + R);
  edge.addColorStop(0, 'rgba(230,240,236,.22)');
  edge.addColorStop(0.5, 'rgba(230,240,236,.05)');
  edge.addColorStop(1, 'rgba(0,0,0,.45)');
  outline(0, 0);
  g.strokeStyle = edge;
  g.lineWidth = 1.1;
  g.stroke();
}

// A scatter of pebbles for the gaps between shore rocks.
function drawGravel(g, w, h) {
  for (let i = 0; i < 16; i++) {
    const x = rnd(4, w - 4), y = rnd(4, h - 4), rx = rnd(1.2, 3.2), ry = rx * rnd(0.6, 0.9);
    g.fillStyle = 'rgba(4,6,8,.45)';
    g.beginPath();
    g.ellipse(x + 0.8, y + 1, rx, ry, 0, 0, TAU);
    g.fill();
    g.fillStyle = hexCss(pick(STONE));
    g.beginPath();
    g.ellipse(x, y, rx, ry, rnd(0, 3), 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(230,240,236,.18)';
    g.beginPath();
    g.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.4, ry * 0.3, 0, 0, TAU);
    g.fill();
  }
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

// Screen-edge glow for danger, tinted red in game.
function drawVignette(g) {
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, W * 0.62);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(1, 'rgba(255,255,255,.95)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
}

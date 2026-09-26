import Phaser from 'phaser';
import { WIDTH as W, HEIGHT as H, GODS, TUNING, FONT, DISPLAY_FONT } from '../config.js';
import { riverAt } from '../river.js';
import { soulValue, statsFor, formatObols, formatMeters } from '../economy.js';
import { moveVector, onAction, clearKeys } from '../controls.js';
import { sfx, toggleMute } from '../sfx.js';
import { rgbOf, hexCss, mixColor, lighten } from '../color.js';
import { drawMeander, spaced } from '../ui.js';
import { SHORE_SIZES } from '../art.js';

const TAU = Math.PI * 2;
const clamp = Phaser.Math.Clamp;
const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
const pickOne = (a) => a[(Math.random() * a.length) | 0];
const DEBUG = new URLSearchParams(location.search).has('debug'); // ?debug draws the hull and dock zones

// Light on the water: fine streaks and wide ribbons in the river's violet palette.
const STREAK_HUES = [0x9670ff, 0x7686ff, 0xb880ff, 0x866ef0, 0x9670ff, 0xe8a0d6];
const RIBBON_HUES = [0x9670ff, 0x7896ff, 0xc882ff, 0xec96d2];
const HUD_RIGHT = W - 148;

// The game: an endless top-down river. Scoop up souls, deliver them to their god's shrine,
// spend obols at Hermes' stall, and never let a god's rage fill up.
// Started without { play: true } it runs in attract mode behind the title: the boat steers itself
// and nothing counts.
export class RiverScene extends Phaser.Scene {
  constructor() {
    super('River');
  }

  create(data = {}) {
    this.playing = Boolean(data.play);
    this.t = 0;
    this.scroll = 0; // px travelled this run: world y + scroll = screen y
    this.levels = { speed: 0, handling: 0, hold: 0 };
    this.stats = statsFor(this.levels);
    this.run = { obols: 0, earned: 0, delivered: 0, clutches: 0, streak: 0, bestStreak: 0 };
    this.rage = GODS.map(() => 0);
    this.rageFlash = GODS.map(() => 0);
    this.rageWarned = GODS.map(() => false);
    this.ended = false;
    this.hints = {};
    this.souls = [];
    this.hold = [];
    this.features = [];
    this.props = [];
    this.godBag = [];
    this.featureCount = 0;
    this.nextSide = Math.random() < 0.5 ? 'left' : 'right';
    this.featureCursor = 150; // world y of the next bank feature (smaller = further downstream)
    this.propCursor = H + 80;
    this.shoreCursor = H + 60;
    this.nextSoulAt = 0;

    this.buildWorld();
    this.buildBoat();
    this.buildEffects();
    if (this.playing) this.buildHud();
    this.spawnAhead();
    for (const k of this.playing ? [0.1, 0.3] : [0.15, 0.35, 0.55]) this.spawnSoul(H * k);

    onAction(this, (action) => this.handleAction(action));
    const onBlur = () => this.pauseGame();
    this.game.events.on('blur', onBlur);
    this.events.once('shutdown', () => this.game.events.off('blur', onBlur));

    if (this.playing) this.startHints();
    else this.scene.launch('Title');
  }

  get speed() {
    return this.stats.scrollSpeed;
  }

  update(_time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.t += dt;
    this.scroll += this.speed * dt * (this.ended ? 0.3 : 1);
    this.bank.tilePositionY = -this.scroll;
    this.spawnAhead();
    this.updateSurface(dt);
    this.drawRiver();
    this.drawLight();
    for (const p of this.props) p.y = p.wy + this.scroll;
    this.updateFeatures(dt);
    this.updateSouls(dt);
    if (!this.ended) this.updateBoat(dt);
    this.updateHold(dt);
    this.drawWake(dt);
    if (this.playing) this.updateHud(dt);
    if (DEBUG) this.drawDebug();
  }

  /* ---------- the river itself ---------- */

  buildWorld() {
    this.bank = this.add.tileSprite(0, 0, W, H, 'bank').setOrigin(0).setDepth(0);
    this.waterG = this.add.graphics().setDepth(1);
    // Wavelets on the surface: two layers drifting at different speeds, clipped to the river.
    this.waterMask = this.make.graphics({}, false);
    const mask = this.waterMask.createGeometryMask();
    this.surface = [
      this.add.tileSprite(0, 0, W, H, 'ripples').setOrigin(0).setDepth(1.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setMask(mask),
      this.add.tileSprite(0, 0, W, H, 'ripples').setOrigin(0).setDepth(1.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.32).setTileScale(1.7, 1.35).setMask(mask),
    ];
    this.lightG = this.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    // The lifestream: wide soft bands and fine streaks of light, each a rope so it bends smoothly with no seams.
    this.ribbons = Array.from({ length: 8 }, () => this.newRibbon(false));
    for (const r of this.ribbons) r.rope = this.bandRope(pickOne(['band_s', 'band_m', 'band_m', 'band_l']), 17, r.c);
    this.streaks = Array.from({ length: 90 }, () => this.newStreak(false));
    for (const r of this.streaks) r.rope = this.bandRope('band_xs', 8, r.c);
    this.glints = Array.from({ length: 40 }, () => ({ sy: rnd(-20, H + 20), o: clamp(gauss() * 0.85, -0.9, 0.9), ph: rnd(0, TAU), sp: rnd(1.4, 1.9) }));
    this.foam = Array.from({ length: 150 }, () => this.newFoam(rnd(-20, H + 20)));
    this.drift = Array.from({ length: 45 }, () => this.newDrift(rnd(-20, H + 20)));
    this.eddies = Array.from({ length: 5 }, (_, i) => {
      const e = this.newEddy(-60 + (i + rnd(0.2, 0.8)) * ((H + 120) / 5)); // spread down the screen
      e.dark = this.add.image(0, 0, 'glow').setTint(0x07050f).setDepth(1.55);
      e.whirl = this.add.image(0, 0, 'swirl').setTint(0xbfb0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(1.6);
      e.ph = i * 1.7;
      return e;
    });
    this.fog = Array.from({ length: 8 }, (_, i) => {
      const f = this.add.image(rnd(0, W), rnd(-100, H + 100), 'glow').setTint(0xc8d6d2).setScale(rnd(4.6, 8.6)).setDepth(i < 5 ? 9 : 26);
      f.setAlpha(rnd(0.05, 0.09) * (i < 5 ? 1 : 0.7));
      f.vx = rnd(4, 11) * (Math.random() < 0.5 ? -1 : 1);
      return f;
    });
    this.rows = [];
  }

  newStreak(fromTop) {
    return { sy: fromTop ? -rnd(0, 260) : rnd(-60, H + 160), o: clamp(gauss() * 0.9, -0.93, 0.93), ph: rnd(0, TAU), len: rnd(90, 230), lw: rnd(1, 2.2), a: rnd(0.06, 0.2), c: pickOne(STREAK_HUES), sp: rnd(0.7, 1.4) };
  }

  newRibbon(fromTop) {
    return { sy: fromTop ? -rnd(0, 400) : rnd(-100, H + 300), o: clamp(gauss() * 0.7, -0.75, 0.75), ph: rnd(0, TAU), len: rnd(300, 520), a: rnd(0.07, 0.12), c: pickOne(RIBBON_HUES), sp: rnd(1.0, 1.6) };
  }

  // Foam churning along the shore, a few px to ~20 px out from the stones.
  newFoam(sy) {
    return { sy, side: Math.random() < 0.5 ? -1 : 1, off: rnd(1, 20), ph: rnd(0, TAU), sp: rnd(1.02, 1.3), r: rnd(0.8, 2.4), len: rnd(0, 8), a: rnd(0.12, 0.36) };
  }

  // Foam flecks carried in the current, stretched along the flow.
  newDrift(sy) {
    return { sy, o: clamp(gauss() * 0.8, -0.9, 0.9), ph: rnd(0, TAU), sp: rnd(0.95, 1.4), r: rnd(0.8, 1.8), len: rnd(3, 12), a: rnd(0.08, 0.22) };
  }

  // An eddy: a slowly turning whirl that drifts downstream and bends everything that passes it.
  newEddy(sy) {
    return { sy, o: rnd(-0.55, 0.55), r: rnd(45, 95), spin: Math.random() < 0.5 ? -1 : 1, power: rnd(0.5, 0.9), sp: rnd(1.0, 1.35), rot: rnd(0, TAU), x: 0, y: sy };
  }

  // Lateral wander of a flow line: waves at three scales, drifting with the current and churning over time.
  turb(yy, ph, amp) {
    const u = yy - this.scroll * TUNING.currentFactor, t = this.t;
    return amp * (Math.sin(u * 0.011 + ph + t * 0.6) + 0.55 * Math.sin(u * 0.027 - ph * 1.3 + t * 1.3) + 0.3 * Math.sin(u * 0.063 + ph * 2.1 - t * 2.1));
  }

  // Bend a point around the eddies it passes: strongest at an eddy's heart, fading out by ~2 radii.
  swirlPoint(p, k = 1) {
    for (const e of this.eddies) {
      const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy, r2 = e.r * e.r * 2.2;
      if (d2 > r2 * 2.5) continue;
      const a = e.spin * e.power * k * Math.exp(-d2 / r2), c = Math.cos(a), sn = Math.sin(a);
      p.x = e.x + dx * c - dy * sn;
      p.y = e.y + dx * sn + dy * c;
    }
    return p;
  }

  bandRope(key, n, color) {
    const rope = this.add.rope(0, 0, key, null, Array.from({ length: n }, () => new Phaser.Math.Vector2()), false);
    rope.setBlendMode(Phaser.BlendModes.ADD).setDepth(2);
    rope.setColors(color);
    rope.setAlphas(Array.from({ length: n }, (_, j) => Math.pow(Math.sin((Math.PI * j) / (n - 1)), 0.8))); // fade in and out at the ends
    return rope;
  }

  // Lay a rope along the current, from the band's head (s.sy) back along its length, through the turbulence.
  layRope(rope, s, amp, limit) {
    const pts = rope.points, n = pts.length;
    for (let j = 0; j < n; j++) {
      const yy = s.sy - (s.len * j) / (n - 1), q = riverAt(yy - this.scroll);
      const o = clamp(s.o + this.turb(yy, s.ph, amp), -limit, limit);
      pts[j].x = q.cx + o * q.hw;
      pts[j].y = yy;
      this.swirlPoint(pts[j]);
    }
    rope.updateVertices();
  }

  updateSurface(dt) {
    const v = this.speed;
    for (const s of this.streaks) {
      s.sy += v * TUNING.currentFactor * s.sp * dt;
      if (s.sy - s.len > H + 10) {
        Object.assign(s, this.newStreak(true));
        s.rope.setColors(s.c);
      }
    }
    for (const s of this.ribbons) {
      s.sy += v * s.sp * dt;
      if (s.sy - s.len > H + 10) {
        Object.assign(s, this.newRibbon(true));
        s.rope.setColors(s.c);
      }
    }
    for (const s of this.glints) {
      s.sy += v * s.sp * dt;
      if (s.sy > H + 10) {
        s.sy = -10;
        s.o = clamp(gauss() * 0.85, -0.9, 0.9);
      }
    }
    for (const f of this.foam) {
      f.sy += v * f.sp * dt;
      if (f.sy > H + 20) Object.assign(f, this.newFoam(-20));
    }
    for (const f of this.drift) {
      f.sy += v * TUNING.currentFactor * 0.75 * f.sp * dt;
      if (f.sy > H + 20) Object.assign(f, this.newDrift(-20));
    }
    for (const e of this.eddies) {
      e.sy += v * e.sp * dt;
      e.rot += e.spin * dt * 1.3;
      if (e.sy - e.r > H + 20) Object.assign(e, this.newEddy(Math.min(-60, ...this.eddies.map((o) => o.sy)) - rnd(160, 300)));
      const q = riverAt(e.sy - this.scroll);
      e.x = q.cx + e.o * q.hw;
      e.y = e.sy;
      const breathe = 0.85 + 0.15 * Math.sin(this.t * 0.9 + e.ph);
      e.dark.setPosition(e.x, e.y).setScale(e.r / 30).setAlpha(0.3 * breathe);
      e.whirl.setPosition(e.x, e.y).setScale(e.r / 34).setRotation(e.rot).setAlpha(0.16 * breathe);
    }
    for (const f of this.fog) {
      const r = f.displayWidth / 2;
      f.x += f.vx * dt;
      f.y += v * 0.9 * dt;
      if (f.y - r > H) {
        f.y = -r;
        f.x = rnd(0, W);
      }
      if (f.x > W + r) f.x = -r;
      if (f.x < -r) f.x = W + r;
    }
  }

  drawRiver() {
    const rows = this.rows;
    rows.length = 0;
    for (let sy = -16; sy <= H + 16; sy += 8) {
      const q = riverAt(sy - this.scroll);
      rows.push({ sy, cx: q.cx, hw: q.hw });
    }
    const edge = (side, px) => rows.map((r) => ({ x: r.cx + side * (r.hw + px), y: r.sy }));
    const g = this.waterG;
    g.clear();
    for (const side of [-1, 1]) {
      g.lineStyle(16, 0x0a0d0c, 0.55);
      g.strokePoints(edge(side, 6));
    }
    const water = this.band(1);
    g.fillStyle(0x130f26, 1);
    g.fillPoints(water, true);
    this.waterMask.clear().fillStyle(0xffffff, 1).fillPoints(water, true);
    for (const [k, color, alpha] of [[0.82, 0x2e2462, 0.2], [0.58, 0x3e3080, 0.14], [0.32, 0x5442a0, 0.1]]) {
      g.fillStyle(color, alpha);
      g.fillPoints(this.band(k), true);
    }
    for (const side of [-1, 1]) {
      g.lineStyle(10, 0x04030c, 0.5);
      g.strokePoints(edge(side, -5));
    }
    for (const f of this.foam) {
      const q = riverAt(f.sy - this.scroll);
      g.fillStyle(0xdcd4ff, f.a * (0.7 + 0.3 * Math.sin(this.t * 3 + f.ph)));
      g.fillEllipse(q.cx + f.side * (q.hw - f.off), f.sy, f.r * 2, f.r * 2 + f.len);
    }
    for (const f of this.drift) {
      const q = riverAt(f.sy - this.scroll);
      const p = this.swirlPoint({ x: q.cx + (f.o + this.turb(f.sy, f.ph, 0.06)) * q.hw, y: f.sy });
      g.fillStyle(0xdcd4ff, f.a * (0.75 + 0.25 * Math.sin(this.t * 2.6 + f.ph)));
      g.fillEllipse(p.x, p.y, f.r * 2, f.r * 2 + f.len);
    }
    const [near, far] = this.surface;
    near.tilePositionY = -this.scroll * 1.2;
    near.tilePositionX = 14 * Math.sin(this.t * 0.23);
    far.tilePositionY = -this.scroll * 0.62;
    far.tilePositionX = this.t * 4 + 10 * Math.sin(this.t * 0.17 + 1);
  }

  // The river's outline, inset to k of its half width.
  band(k) {
    const pts = [];
    for (const r of this.rows) pts.push({ x: r.cx - r.hw * k, y: r.sy });
    for (let i = this.rows.length - 1; i >= 0; i--) pts.push({ x: this.rows[i].cx + this.rows[i].hw * k, y: this.rows[i].sy });
    return pts;
  }

  drawLight() {
    const g = this.lightG;
    g.clear();
    for (const s of this.ribbons) {
      this.layRope(s.rope, s, 0.08, 0.9);
      s.rope.setAlpha(s.a * (0.8 + 0.2 * Math.sin(this.t * 1.1 + s.ph)));
    }
    for (const s of this.streaks) {
      this.layRope(s.rope, s, 0.05, 0.96);
      const a = s.a * (0.75 + 0.25 * Math.sin(this.t * 2 + s.ph));
      s.rope.setAlpha(a * 0.45);
      g.lineStyle(s.lw, s.c, a);
      g.strokePoints(s.rope.points);
    }
    // Glints: light catching the surface for a moment.
    for (const s of this.glints) {
      const a = Math.pow(Math.max(0, Math.sin(this.t * 2.3 + s.ph)), 4) * 0.7;
      if (a < 0.02) continue;
      const q = riverAt(s.sy - this.scroll);
      const p = this.swirlPoint({ x: q.cx + (s.o + this.turb(s.sy, s.ph, 0.04)) * q.hw, y: s.sy });
      g.fillStyle(0xf2ecff, a);
      g.fillEllipse(p.x, p.y, 8, 1.8);
    }
  }

  /* ---------- spawning: bank features, props, souls ---------- */

  spawnAhead() {
    const top = -this.scroll; // world y at the top edge of the screen
    while (this.featureCursor > top - 1800) {
      this.spawnFeature(this.featureCursor);
      this.featureCursor -= Math.min(TUNING.featureGapMax, TUNING.featureGapStart + this.scroll * TUNING.featureGapGrowth) * rnd(0.9, 1.1);
    }
    while (this.propCursor > top - 140) {
      this.spawnPropRow(this.propCursor);
      this.propCursor -= rnd(24, 46);
    }
    while (this.shoreCursor > top - 80) {
      this.spawnShoreRow(this.shoreCursor);
      this.shoreCursor -= rnd(9, 17);
    }
    for (let i = this.props.length - 1; i >= 0; i--) {
      if (this.props[i].wy + this.scroll > H + 120) {
        this.props[i].destroy();
        this.props.splice(i, 1);
      }
    }
    if (this.scroll >= this.nextSoulAt) {
      this.spawnSoul();
      const gap = Math.max(TUNING.soulGapMin, TUNING.soulGapStart - this.scroll * TUNING.soulGapRamp);
      this.nextSoulAt = this.scroll + gap * rnd(0.7, 1.3);
    }
  }

  spawnFeature(wy) {
    this.featureCount += 1;
    const side = this.nextSide;
    this.nextSide = side === 'left' ? 'right' : 'left';
    const isShop = this.featureCount % TUNING.shopEvery === 0;
    this.features.push(isShop ? this.makeShop(wy, side) : this.makeShrine(wy, side, this.nextGod()));
  }

  // Shrines come in shuffled rounds of all three gods, so none is ever too far away.
  nextGod() {
    if (!this.godBag.length) this.godBag = Phaser.Utils.Array.Shuffle(GODS.map((_, i) => i));
    return this.godBag.pop();
  }

  bankSpot(wy, side) {
    const q = riverAt(wy);
    return side === 'left' ? { x: q.l - 74, tip: q.l + 22 } : { x: q.r + 74, tip: q.r - 22 };
  }

  attach(f, obj, dy) {
    obj.dy = dy;
    obj.y = f.wy + this.scroll + dy;
    f.parts.push(obj);
    return obj;
  }

  makePier(x, tip, side) {
    const dir = side === 'left' ? 1 : -1, from = x + dir * 28, to = tip + dir * 8;
    return this.add.image(Math.min(from, to), 0, 'pier').setOrigin(0, 14 / 34).setScale(Math.abs(to - from) / 96, 1).setFlipX(side === 'right').setDepth(4);
  }

  makeShrine(wy, side, god) {
    const { x, tip } = this.bankSpot(wy, side);
    const { key, color } = GODS[god];
    const f = { kind: 'shrine', wy, side, god, x, tip, pulse: 0, parts: [] };
    this.attach(f, this.makePier(x, tip, side), -6);
    f.glow = this.attach(f, this.add.image(x, 0, 'glow').setTint(color).setBlendMode('ADD').setScale(4).setAlpha(0.3).setDepth(5), -44);
    f.dockGlow = this.attach(f, this.add.image(tip, 0, 'glow').setTint(color).setBlendMode('ADD').setScale(2.8).setAlpha(0.25).setDepth(5), -6);
    this.attach(f, this.add.image(x, 0, 'portal_fill').setOrigin(0.5, 0).setTint(color).setDepth(6), -96);
    f.swirl = this.attach(f, this.add.image(x, 0, 'swirl').setTint(color).setBlendMode('ADD').setAlpha(0.85).setDepth(6), -46);
    this.attach(f, this.add.image(x, 0, `glyph_${key}`).setScale(0.6).setAlpha(0.35).setDepth(6), -46);
    this.attach(f, this.add.image(x, 0, 'arch').setOrigin(0.5, 138 / 150).setDepth(7), 0);
    this.attach(f, this.add.image(x, 0, `glyph_${key}`).setScale(0.25).setDepth(7), -101);
    f.beam = this.attach(f, this.add.image(x, 0, 'beam').setOrigin(0.5, 1).setTint(color).setBlendMode('ADD').setAlpha(0).setDepth(7), -112);
    return f;
  }

  makeShop(wy, side) {
    const { x, tip } = this.bankSpot(wy, side);
    const f = { kind: 'shop', wy, side, x, tip, used: false, parts: [] };
    this.attach(f, this.makePier(x, tip, side), -6);
    f.glow = this.attach(f, this.add.image(x, 0, 'glow').setTint(0xffc478).setBlendMode('ADD').setScale(3.6).setAlpha(0.35).setDepth(5), -58);
    f.dockGlow = this.attach(f, this.add.image(tip, 0, 'glow').setTint(0xffc478).setBlendMode('ADD').setScale(2.6).setAlpha(0.3).setDepth(5), -6);
    this.attach(f, this.add.image(x, 0, 'shop').setOrigin(0.5, 138 / 150).setDepth(7), 0);
    f.label = this.attach(f, this.add.text(x, 0, spaced('HERMES'), { fontFamily: FONT, fontSize: '12px', fontStyle: '600', color: '#f1e6c8' }).setOrigin(0.5).setAlpha(0.85).setDepth(7), -122);
    return f;
  }

  spawnPropRow(wy) {
    const q = riverAt(wy);
    for (const side of ['left', 'right']) {
      if (Math.random() < 0.3) continue;
      const near = this.features.some((f) => f.side === side && Math.abs(f.wy - wy) < 130);
      const edge = side === 'left' ? q.l : q.r, dir = side === 'left' ? -1 : 1, roll = Math.random();
      if (roll < 0.4) {
        const a = side === 'left' ? 12 : edge + 46, b = side === 'left' ? edge - 46 : W - 12;
        if (near || b - a < 20) continue;
        this.addProp(this.add.image(rnd(a, b), 0, `pine${1 + ((Math.random() * 3) | 0)}`).setScale(rnd(0.8, 1.15)).setDepth(8), wy + rnd(-10, 10));
      } else if (roll < 0.58) {
        const a = side === 'left' ? 12 : edge + 20, b = side === 'left' ? edge - 20 : W - 12;
        this.addProp(this.add.image(rnd(a, b), 0, 'rock').setScale(rnd(0.5, 1.1)).setRotation(rnd(0, TAU)).setDepth(3), wy);
      } else if (roll < 0.84) {
        if (near) continue;
        const n = 2 + ((Math.random() * 3) | 0);
        for (let i = 0; i < n; i++) {
          this.addProp(this.add.image(edge + dir * rnd(14, 44), 0, `lily${1 + ((Math.random() * 3) | 0)}`).setScale(rnd(0.5, 0.8)).setDepth(3), wy + rnd(-16, 16));
        }
      } else if (!near) {
        this.addProp(this.add.image(edge + dir * rnd(1, 6), 0, 'reeds').setFlipX(side === 'right').setDepth(3), wy);
      }
    }
  }

  // A rocky shore: a waterline of small stones half in the water, bigger rocks and boulders set back
  // into the bank, gravel between. Lower rocks overlap higher ones, as in the 3/4 view.
  spawnShoreRow(wy) {
    const q = riverAt(wy), n = SHORE_SIZES.length;
    const rock = (side, edge, dir, i, from, to, y) => {
      const img = this.add.image(0, 0, `shore_${side}${i + 1}`).setRotation(rnd(-0.35, 0.35)).setFlipY(Math.random() < 0.3);
      img.x = edge + dir * rnd(from, to);
      img.setDepth(2.6 + y * 1e-7);
      this.addProp(img, y);
    };
    for (const [side, edge, dir] of [['l', q.l, -1], ['r', q.r, 1]]) {
      rock(side, edge, dir, Math.floor(Math.pow(Math.random(), 1.4) * 5), -5, 7, wy + rnd(-3, 3));
      if (Math.random() < 0.6) rock(side, edge, dir, 2 + Math.floor(Math.random() * (n - 3)), 14, 40, wy + rnd(-6, 6));
      if (Math.random() < 0.12) rock(side, edge, dir, n - 1 - ((Math.random() * 2) | 0), 22, 38, wy + rnd(-6, 6));
      if (Math.random() < 0.4) {
        this.addProp(this.add.image(edge + dir * rnd(8, 34), 0, `gravel${1 + ((Math.random() * 3) | 0)}`).setFlipX(Math.random() < 0.5).setDepth(2.5), wy + rnd(-8, 8));
      }
    }
  }

  addProp(img, wy) {
    img.wy = wy;
    img.y = wy + this.scroll;
    this.props.push(img);
  }

  /* ---------- shrines and shops on the banks ---------- */

  updateFeatures(dt) {
    for (let i = this.features.length - 1; i >= 0; i--) {
      const f = this.features[i], base = f.wy + this.scroll;
      if (base > H + 240) {
        f.parts.forEach((p) => p.destroy());
        this.features.splice(i, 1);
        continue;
      }
      if (base < -200) continue; // still far downstream
      for (const p of f.parts) p.y = base + p.dy;
      if (f.kind === 'shrine') {
        f.pulse = Math.max(0, f.pulse - dt * 1.6);
        f.swirl.rotation += dt * (1.4 + f.pulse * 4);
        f.glow.setAlpha(0.28 + 0.4 * f.pulse + 0.05 * Math.sin(this.t * 1.8 + f.wy)).setScale(4 + 1.4 * f.pulse);
        f.dockGlow.setAlpha(0.22 + 0.3 * f.pulse);
      } else if (!f.used && base > 60) {
        this.hint('shop', "Dock at Hermes' stall to spend your obols");
      }
      if (this.ended || this.hullDist(f.tip, base - 6) > TUNING.dockReach) continue;
      if (f.kind === 'shrine') this.deliver(f);
      else if (!f.used && this.playing) this.openShop(f);
    }
  }

  // The gods of the next n shrines the boat hasn't reached yet, nearest first.
  upcomingGods(n) {
    const line = this.boat.y - 30;
    return this.features
      .filter((f) => f.kind === 'shrine' && f.wy + this.scroll - 6 < line)
      .sort((a, b) => b.wy - a.wy)
      .slice(0, n)
      .map((f) => f.god);
  }

  /* ---------- souls ---------- */

  spawnSoul(sy = -36) {
    const god = this.pickSoulGod();
    const { key, color } = GODS[god];
    const s = { sy, god, o: clamp(gauss() * 0.62, -0.78, 0.78), ph: rnd(0, TAU), sp: rnd(0.96, 1.08), x: 0, y: sy, trailAt: null };
    s.halo = this.add.image(0, 0, 'glow').setTint(color).setBlendMode('ADD').setScale(1.6).setDepth(10);
    s.body = this.add.image(0, 0, `soul_${key}`).setDepth(11);
    s.rim = this.add.image(0, 0, 'rim').setRotation(rnd(0, TAU)).setDepth(12);
    this.souls.push(s);
    this.placeSoul(s);
  }

  // Half the souls match one of the next two shrines, so a delivery is usually in reach.
  pickSoulGod() {
    const next = this.upcomingGods(2);
    if (next.length && Math.random() < TUNING.soulBias) return pickOne(next);
    return (Math.random() * GODS.length) | 0;
  }

  placeSoul(s) {
    const q = riverAt(s.sy - this.scroll);
    s.x = q.cx + (s.o + 0.07 * Math.sin(this.t * 0.8 + s.ph)) * q.hw + 4 * Math.sin(this.t * 1.7 + s.ph);
    s.y = s.sy + 3 * Math.cos(this.t * 1.3 + s.ph);
    this.swirlPoint(s, 0.5);
    const fade = clamp((s.sy + 40) / 60, 0, 1);
    s.halo.setPosition(s.x, s.y).setAlpha(0.36 * fade);
    s.body.setPosition(s.x, s.y).setAlpha(fade).setScale(1 + 0.05 * Math.sin(this.t * 2.4 + s.ph));
    s.rim.setPosition(s.x, s.y).setAlpha(fade);
    if (!s.trailAt || Math.hypot(s.x - s.trailAt.x, s.y - s.trailAt.y) > 6) {
      this.trails[s.god].emitParticleAt(s.x, s.y);
      s.trailAt = { x: s.x, y: s.y };
    }
  }

  updateSouls(dt) {
    for (let i = this.souls.length - 1; i >= 0; i--) {
      const s = this.souls[i];
      s.sy += this.speed * s.sp * dt;
      s.rim.rotation += dt * 1.6;
      this.placeSoul(s);
      s.ringT = (s.ringT ?? rnd(0, 1.2)) - dt;
      if (s.ringT <= 0 && s.sy > 0) {
        s.ringT = rnd(1.1, 1.7);
        this.waterRing(s.x, s.y);
      }
      if (s.sy > H + 40) {
        this.removeSoul(i);
        this.skipped(s.god);
      } else if (!this.ended && this.hold.length < this.stats.capacity && this.hullDist(s.x, s.y) < TUNING.soulRadius + TUNING.hullRadius) {
        this.removeSoul(i);
        this.collect(s);
      }
    }
  }

  removeSoul(i) {
    const s = this.souls[i];
    s.halo.destroy();
    s.body.destroy();
    s.rim.destroy();
    this.souls.splice(i, 1);
  }

  collect(s) {
    const { key, color, name } = GODS[s.god];
    this.hold.push({ god: s.god, life: 1, img: this.add.image(s.x, s.y, `soul_${key}`).setDepth(22) });
    this.ringFx(s.x, s.y, color);
    this.sparks[s.god].explode(14, s.x, s.y);
    if (!this.playing) return;
    sfx.pickup(s.god);
    this.hint('pickup', `Deliver it to ${name}'s shrine`, color);
    if (this.hold.length >= this.stats.capacity) this.hint('full', 'Hold full: deliver to free a slot');
    else if (this.run.delivered > 0) this.hint('next', 'Top right: the next shrines coming your way');
  }

  skipped(god) {
    if (!this.playing || this.ended) return;
    sfx.skip();
    this.addRage(god, TUNING.ragePerSkip);
    this.hint('skip', `Missed souls anger ${GODS[god].name}`, GODS[god].color);
  }

  addRage(god, amount) {
    this.rage[god] = Math.min(1, this.rage[god] + amount);
    this.rageFlash[god] = 1;
    if (this.rage[god] >= 1) {
      this.smite(god);
      return;
    }
    if (!this.rageWarned[god] && this.rage[god] >= TUNING.rageWarn) {
      this.rageWarned[god] = true;
      sfx.rageWarn();
      this.toast(`${GODS[god].name} is furious`, GODS[god].color, true);
    }
  }

  /* ---------- the hold: souls aboard, each fading on its own timer ---------- */

  slot(i, cap) {
    if (cap <= 4) return this.local(0, cap === 1 ? -8 : -32 + (48 * i) / (cap - 1));
    const rows = Math.ceil(cap / 2), row = Math.floor(i / 2);
    return this.local(i % 2 ? 9 : -9, -32 + (50 * row) / Math.max(1, rows - 1));
  }

  updateHold(dt) {
    const cap = this.stats.capacity, small = cap > 4, g = this.ringsG;
    for (let i = this.hold.length - 1; i >= 0; i--) {
      if (!this.ended) this.hold[i].life -= dt / TUNING.lifespan;
      if (this.hold[i].life <= 0) this.burnOut(i);
    }
    g.clear();
    this.hold.forEach((o, i) => {
      const p = this.slot(i, cap), k = Math.min(1, dt * 16);
      o.img.x += (p.x - o.img.x) * k;
      o.img.y += (p.y - o.img.y) * k;
      const r = small ? 9.5 : 12.5, low = o.life < 0.25;
      o.img.setScale((small ? 0.38 : 0.5) * (0.55 + 0.45 * o.life));
      o.img.setAlpha(low ? 0.55 + 0.45 * Math.abs(Math.sin(this.t * 19 + i)) : 1); // gutters like a candle before it burns out
      g.lineStyle(2, 0xffffff, 0.12);
      g.strokeCircle(o.img.x, o.img.y, r);
      g.lineStyle(2, low ? 0xff6e5a : GODS[o.god].color, low ? 0.55 + 0.45 * Math.sin(this.t * 16) : 0.9);
      g.beginPath();
      g.arc(o.img.x, o.img.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * o.life);
      g.strokePath();
    });
  }

  burnOut(i) {
    const o = this.hold[i], { x, y } = o.img;
    this.hold.splice(i, 1);
    o.img.destroy();
    this.burnOutFx(x, y, o.god);
    if (!this.playing) return;
    sfx.burnOut();
    if (this.run.streak > 1) sfx.streakBreak();
    this.run.streak = 0;
    this.hint('burnout', 'Souls burn out: deliver them before their ring runs out');
    this.addRage(o.god, TUNING.ragePerBurnOut);
  }

  deliver(f) {
    const souls = this.hold.filter((o) => o.god === f.god);
    if (!souls.length) return;
    this.hold = this.hold.filter((o) => o.god !== f.god);
    const { color } = GODS[f.god];
    const clutch = souls.filter((o) => o.life < TUNING.clutchBelow).length;
    this.rage[f.god] = Math.max(0, this.rage[f.god] - TUNING.calmPerSoul * souls.length);
    if (this.rage[f.god] < TUNING.rageWarn - 0.1) this.rageWarned[f.god] = false;
    this.run.streak += 1;
    this.run.bestStreak = Math.max(this.run.bestStreak, this.run.streak);
    const mult = Math.min(this.run.streak, TUNING.streakCap);
    const gain = soulValue(this.scroll) * mult * (souls.length + clutch * (TUNING.clutchMultiplier - 1));
    souls.forEach((o, i) => {
      this.moteFx(o.img.x, o.img.y, f, color, i * 80, i === 0 ? () => this.arrived(f, gain, clutch > 0, souls.length) : null);
      o.img.destroy();
    });
    if (!this.playing) return;
    this.run.delivered += souls.length;
    this.run.clutches += clutch;
    this.run.obols += gain;
    this.run.earned += gain;
    this.streakPulse = 1;
    sfx.deliver(this.run.streak);
    if (clutch) sfx.clutch();
    if (this.run.streak === 3) this.hint('streak', 'Back-to-back deliveries build your streak');
  }

  arrived(f, gain, clutch, count) {
    const base = f.wy + this.scroll, { color } = GODS[f.god];
    f.pulse = 1;
    this.ringFx(f.x, base - 46, color, 0.9, 30);
    this.tweens.add({ targets: f.beam, alpha: { from: 0.85, to: 0 }, duration: 1600, ease: 'Quad.easeOut' });
    if (!this.playing) return;
    this.popup('+' + formatObols(gain), f.x, base - 150, color, 30);
    if (clutch) {
      this.popup('CLUTCH!', f.x, base - 194, color, 46, true);
      this.cameras.main.shake(180, 0.004);
    } else if (count >= 3) this.cameras.main.shake(140, 0.003);
    this.coinFx(f.x, base - 46, Math.min(6, 2 + count));
  }

  /* ---------- the boat ---------- */

  buildBoat() {
    this.boat = { x: W / 2, y: TUNING.boatStartY, vx: 0, vy: 0, tilt: 0, wakeT: 0 };
    this.wake = [];
    this.boatImg = this.add.image(this.boat.x, this.boat.y, 'boat').setOrigin(0.4, 72 / 170).setDepth(20);
    this.lantern = this.add.image(0, 0, 'glow').setTint(0xffc478).setBlendMode('ADD').setScale(3.3).setAlpha(0.5).setDepth(21);
    this.lanternCore = this.add.image(0, 0, 'glow').setTint(0xffe6aa).setBlendMode('ADD').setScale(0.5).setAlpha(0.9).setDepth(21);
    this.ringsG = this.add.graphics().setDepth(23);
  }

  // A point on the boat (bow is up, local y negative) in screen coordinates.
  local(lx, ly) {
    const b = this.boat, c = Math.cos(b.tilt), s = Math.sin(b.tilt);
    return { x: b.x + lx * c - ly * s, y: b.y + lx * s + ly * c };
  }

  // Distance from a point to the hull's centre line: pickups and docking use this capsule.
  hullDist(px, py) {
    const b = this.boat, c = Math.cos(b.tilt), s = Math.sin(b.tilt), dx = px - b.x, dy = py - b.y;
    const lx = dx * c + dy * s, ly = -dx * s + dy * c;
    return Math.hypot(lx, ly - clamp(ly, TUNING.hullFront, TUNING.hullBack));
  }

  updateBoat(dt) {
    const b = this.boat;
    if (this.playing) {
      const m = moveVector(), s = this.stats;
      b.vx += m.x * s.boatAccel * dt;
      b.vy += m.y * s.boatAccel * dt;
      const damp = Math.exp(-TUNING.boatDrag * dt);
      if (!m.x) b.vx *= damp;
      if (!m.y) b.vy *= damp;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > s.boatMaxSpeed) {
        b.vx *= s.boatMaxSpeed / sp;
        b.vy *= s.boatMaxSpeed / sp;
      }
    } else this.autopilot(dt);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < TUNING.boatTop) {
      b.y = TUNING.boatTop;
      b.vy = Math.max(0, b.vy);
    }
    if (b.y > TUNING.boatBottom) {
      b.y = TUNING.boatBottom;
      b.vy = Math.min(0, b.vy);
    }
    const q = riverAt(b.y - this.scroll), lo = q.l + TUNING.boatEdgeMargin, hi = q.r - TUNING.boatEdgeMargin;
    if (b.x < lo) {
      b.x = lo;
      b.vx = Math.max(0, b.vx);
    }
    if (b.x > hi) {
      b.x = hi;
      b.vx = Math.min(0, b.vx);
    }
    b.tilt += (clamp(b.vx * 0.0011, -0.3, 0.3) - b.tilt) * Math.min(1, dt * 7);
    this.boatImg.setPosition(b.x, b.y).setRotation(b.tilt);
    const bow = this.local(0, -66);
    this.lantern.setPosition(bow.x, bow.y);
    this.lanternCore.setPosition(bow.x, bow.y - 1);
    b.wakeT -= dt;
    if (b.wakeT <= 0) {
      b.wakeT = 0.03;
      const st = this.local(0, 56);
      for (const side of [-1, 1]) this.wake.push({ x: st.x + side * 11, y: st.y, vx: side * rnd(16, 36) + b.vx * 0.2, t: 0, d: rnd(0.8, 1.3), r: rnd(0.9, 2) });
    }
  }

  // Attract mode: chase the nearest soul, or the next shrine that matches what's aboard.
  autopilot(dt) {
    const b = this.boat, aboard = new Set(this.hold.map((o) => o.god));
    let tx = null, bestDy = Infinity;
    for (const f of this.features) {
      if (f.kind !== 'shrine' || !aboard.has(f.god)) continue;
      const dy = b.y - (f.wy + this.scroll - 6);
      if (dy > -40 && dy < 340 && dy < bestDy) {
        bestDy = dy;
        tx = f.tip;
      }
    }
    if (tx === null && this.hold.length < this.stats.capacity) {
      let best = Infinity;
      for (const s of this.souls) {
        const dy = b.y - s.y;
        if (dy < 26 || dy > 430) continue;
        const cost = Math.abs(s.x - b.x) + dy * 0.55;
        if (cost < best) {
          best = cost;
          tx = s.x;
        }
      }
    }
    if (tx === null) tx = riverAt(b.y - this.scroll).cx + 70 * Math.sin(this.t * 0.45);
    b.vx = clamp(b.vx + ((tx - b.x) * 7 - b.vx * 5) * dt, -430, 430);
    b.vy = (TUNING.boatStartY + 10 * Math.sin(this.t * 0.55) - b.y) * 4;
  }

  drawWake(dt) {
    const g = this.wakeG;
    g.clear();
    for (let i = this.wake.length - 1; i >= 0; i--) {
      const w = this.wake[i];
      w.t += dt;
      w.x += w.vx * dt;
      w.vx *= 0.985;
      w.y += this.speed * 1.02 * dt * (this.ended ? 0.3 : 1);
      if (w.t >= w.d) {
        this.wake.splice(i, 1);
        continue;
      }
      const k = w.t / w.d;
      g.fillStyle(0xd7cdff, (1 - k) * 0.4);
      g.fillCircle(w.x, w.y, w.r * (1 + k));
    }
  }

  /* ---------- effects ---------- */

  buildEffects() {
    const soft = { blendMode: 'ADD', emitting: false };
    this.trails = GODS.map((god) => this.add.particles(0, 0, 'glow', { ...soft, lifespan: 480, scale: { start: 0.42, end: 0.08 }, alpha: { start: 0.2, end: 0 }, tint: god.color }).setDepth(10));
    this.sparks = GODS.map((god) =>
      this.add.particles(0, 0, 'glow', { ...soft, lifespan: { min: 350, max: 700 }, speed: { min: 60, max: 190 }, angle: { min: 0, max: 360 }, scale: { start: 0.16, end: 0 }, alpha: { start: 1, end: 0 }, tint: god.color }).setDepth(30),
    );
    this.embers = GODS.map((god) =>
      this.add.particles(0, 0, 'glow', { ...soft, lifespan: { min: 700, max: 1200 }, speed: { min: 20, max: 70 }, angle: { min: 235, max: 305 }, gravityY: -30, scale: { start: 0.12, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [god.color, 0xffe2a8] }).setDepth(31),
    );
    this.wakeG = this.add.graphics().setDepth(19).setBlendMode(Phaser.BlendModes.ADD);
  }

  // A ring spreading on the water under a floating soul, drifting with the current.
  waterRing(x, y) {
    const img = this.add.image(x, y, 'ring').setTint(0xcfc6ff).setBlendMode('ADD').setAlpha(0.2).setScale(12 / 29, 9 / 29).setDepth(9.5);
    this.tweens.add({ targets: img, scaleX: 44 / 29, scaleY: 32 / 29, alpha: 0, y: y + this.speed * 1.4, duration: 1400, ease: 'Sine.easeOut', onComplete: () => img.destroy() });
  }

  ringFx(x, y, color, dur = 0.5, radius = 17) {
    const img = this.add.image(x, y, 'ring').setTint(color).setBlendMode('ADD').setScale(radius / 29).setDepth(30);
    this.tweens.add({ targets: img, scale: (radius * 3.2) / 29, alpha: { from: 0.9, to: 0 }, duration: dur * 1000, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
  }

  // A soul burning out: a white-hot flash in its god's color, a quick shockwave and a spray of embers.
  burnOutFx(x, y, god) {
    const { color } = GODS[god];
    const flare = this.add.image(x, y, 'glow').setTint(color).setBlendMode('ADD').setScale(0.3).setDepth(31);
    const core = this.add.image(x, y, 'glow').setBlendMode('ADD').setScale(0.15).setDepth(32);
    this.tweens.add({ targets: flare, scale: 3.2, alpha: { from: 1, to: 0 }, duration: 500, ease: 'Cubic.easeOut', onComplete: () => flare.destroy() });
    this.tweens.add({ targets: core, scale: 1.5, alpha: { from: 1, to: 0 }, duration: 260, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
    this.ringFx(x, y, color, 0.35, 12);
    this.sparks[god].explode(22, x, y);
    this.embers[god].explode(14, x, y);
  }

  // Motes of light arcing from the hold into the (moving) shrine.
  moteFx(x, y, f, color, delay, onArrive) {
    const img = this.add.image(x, y, 'glow').setTint(color).setBlendMode('ADD').setScale(0.45).setDepth(30);
    const cx = (x + f.x) / 2 + rnd(-60, 60), cy = y - rnd(90, 160);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 620,
      delay,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const e = tw.getValue(), u = 1 - e, ty = f.wy + this.scroll - 46;
        img.setPosition(u * u * x + 2 * u * e * cx + e * e * f.x, u * u * y + 2 * u * e * Math.min(cy, ty - 30) + e * e * ty);
      },
      onComplete: () => {
        img.destroy();
        if (onArrive) onArrive();
      },
    });
  }

  // Obols flying from the shrine into the HUD counter.
  coinFx(x, y, n) {
    const tx = HUD_RIGHT + 25, ty = 70;
    for (let i = 0; i < n; i++) {
      const img = this.add.image(x, y, 'obol').setScale(0.55).setDepth(55);
      const cx = x + rnd(-90, 90), cy = y - rnd(60, 170);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: rnd(650, 900),
        delay: i * 70,
        ease: 'Cubic.easeIn',
        onUpdate: (tw) => {
          const e = tw.getValue(), u = 1 - e;
          img.setPosition(u * u * x + 2 * u * e * cx + e * e * tx, u * u * y + 2 * u * e * cy + e * e * ty);
        },
        onComplete: () => {
          img.destroy();
          this.obolPulse = 1;
          sfx.coin();
        },
      });
    }
  }

  popup(text, x, y, color, size, display = false) {
    const t = this.add
      .text(x, y, text, { fontFamily: display ? DISPLAY_FONT : FONT, fontSize: `${size}px`, fontStyle: display ? 'italic 600' : '600', color: display ? '#ffffff' : hexCss(lighten(color, 0.35)) })
      .setOrigin(0.5)
      .setDepth(40)
      .setScale(1.4);
    t.setShadow(0, 0, hexCss(color), 14, true, true);
    this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 1300, delay: 150, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
  }

  /* ---------- HUD ---------- */

  buildHud() {
    const d = 50;
    const panel = this.add.graphics().setDepth(d);
    for (const x of [14, HUD_RIGHT]) {
      panel.fillStyle(0x080b0a, 0.64).fillRoundedRect(x, 14, 134, 238, 10);
      panel.lineStyle(1, 0xdce6e2, 0.12).strokeRoundedRect(x, 14, 134, 238, 10);
      drawMeander(panel, x + 12, 24, 110);
    }
    const label = (text, x, y) => this.add.text(x, y, spaced(text), { fontFamily: FONT, fontSize: '11px', fontStyle: '600', color: '#dce6e2' }).setAlpha(0.55).setDepth(d + 1);
    label('RAGE', 26, 38);
    GODS.forEach((god, i) => {
      const y = 76 + i * 46;
      this.add.image(38, y, `medal_${god.key}`).setDepth(d + 1);
      this.add.text(60, y - 17, god.name, { fontFamily: DISPLAY_FONT, fontSize: '19px', fontStyle: 'italic 600', color: '#e6eeea' }).setDepth(d + 1);
    });
    this.hudG = this.add.graphics().setDepth(d + 1);
    label('DISTANCE', 26, 204);
    this.distText = this.add.text(26, 220, '0 m', { fontFamily: FONT, fontSize: '19px', fontStyle: '600', color: '#e6eeea' }).setDepth(d + 1);
    label('OBOLS', HUD_RIGHT + 12, 38);
    this.add.image(HUD_RIGHT + 25, 70, 'obol').setScale(0.62).setDepth(d + 1);
    this.obolText = this.add.text(HUD_RIGHT + 44, 70, '0', { fontFamily: FONT, fontSize: '25px', fontStyle: '600', color: '#f1e6c8' }).setOrigin(0, 0.5).setDepth(d + 1);
    label('STREAK', HUD_RIGHT + 12, 98);
    this.streakText = this.add.text(HUD_RIGHT + 12, 128, '×1', { fontFamily: DISPLAY_FONT, fontSize: '32px', fontStyle: 'italic 600', color: '#ffffff' }).setOrigin(0, 0.5).setDepth(d + 1);
    label('HOLD', HUD_RIGHT + 12, 152);
    label('NEXT', HUD_RIGHT + 12, 196);
    this.nextIcons = [0, 1, 2].map((i) => this.add.image(HUD_RIGHT + 26 + i * 34, 229, `medal_${GODS[0].key}`).setScale(0.8).setDepth(d + 1));
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setTint(0xff2a1a).setAlpha(0).setDepth(45);
    this.obolShown = 0;
    this.obolPulse = 0;
    this.streakPulse = 0;
  }

  updateHud(dt) {
    const g = this.hudG;
    g.clear();
    GODS.forEach((god, i) => {
      const y = 76 + i * 46, v = this.rage[i], bx = 60, by = y + 6, bw = 76, bh = 6;
      const hot = clamp((v - 0.66) / 0.3, 0, 1);
      g.fillStyle(0xffffff, 0.09).fillRoundedRect(bx, by, bw, bh, 3);
      if (v > 0.01) g.fillStyle(mixColor(god.color, 0xff5a46, hot * 0.55), 0.95).fillRoundedRect(bx, by, Math.max(bh, bw * v), bh, 3);
      const alarm = Math.max(hot * (0.5 + 0.5 * Math.sin(this.t * 8)), this.rageFlash[i]) * 0.6;
      if (alarm > 0.01) g.lineStyle(2, 0xff5a46, alarm).strokeRoundedRect(bx - 2, by - 2, bw + 4, bh + 4, 4);
      this.rageFlash[i] = Math.max(0, this.rageFlash[i] - dt * 2);
    });
    const cap = this.stats.capacity;
    for (let i = 0; i < cap; i++) {
      const cx = HUD_RIGHT + 18 + i * 14, o = this.hold[i];
      if (o) g.fillStyle(GODS[o.god].color, 0.95).fillCircle(cx, 172, 5);
      else g.lineStyle(1.5, 0xdce6e2, 0.35).strokeCircle(cx, 172, 5);
    }
    this.obolShown += (this.run.obols - this.obolShown) * Math.min(1, dt * 6);
    if (Math.abs(this.run.obols - this.obolShown) < 0.5) this.obolShown = this.run.obols;
    this.obolText.setText(formatObols(this.obolShown)).setScale(1 + 0.25 * this.obolPulse);
    this.obolPulse = Math.max(0, this.obolPulse - dt * 2.5);
    this.streakText.setText('×' + clamp(this.run.streak, 1, TUNING.streakCap)).setScale(1 + 0.3 * this.streakPulse).setAlpha(this.run.streak ? 1 : 0.45);
    this.streakPulse = Math.max(0, this.streakPulse - dt * 2.5);
    this.distText.setText(formatMeters(this.scroll));
    const next = this.upcomingGods(3);
    this.nextIcons.forEach((icon, i) => {
      icon.setVisible(i < next.length);
      if (i < next.length) icon.setTexture(`medal_${GODS[next[i]].key}`);
    });
    const danger = clamp((Math.max(...this.rage) - TUNING.rageWarn) / (1 - TUNING.rageWarn), 0, 1);
    this.vignette.setAlpha(danger * (0.3 + 0.12 * Math.sin(this.t * 6)));
  }

  toast(text, color = 0xe6eeea, big = false) {
    if (this.toastText) {
      this.tweens.killTweensOf(this.toastText);
      this.toastText.destroy();
    }
    const t = this.add
      .text(W / 2, 100, text, { fontFamily: big ? DISPLAY_FONT : FONT, fontSize: big ? '30px' : '19px', fontStyle: big ? 'italic 600' : '600', color: hexCss(color), backgroundColor: 'rgba(8,11,10,0.62)', padding: { x: 16, y: 9 } })
      .setOrigin(0.5)
      .setDepth(60)
      .setAlpha(0);
    this.toastText = t;
    this.tweens.add({ targets: t, alpha: 1, y: 88, duration: 220, ease: 'Quad.easeOut' });
    this.tweens.add({
      targets: t,
      alpha: 0,
      duration: 400,
      delay: 2800,
      onComplete: () => {
        t.destroy();
        if (this.toastText === t) this.toastText = null;
      },
    });
  }

  // One-time tips, shown the first time something happens.
  hint(id, text, color, big) {
    if (!this.playing || this.ended || this.hints[id]) return;
    this.hints[id] = true;
    this.toast(text, color, big);
  }

  startHints() {
    this.toast('Steer with WASD, ZQSD or the arrow keys');
    this.time.delayedCall(3300, () => this.hint('touch', 'Touch a soul to take it aboard'));
  }

  /* ---------- flow: pause, shop, death ---------- */

  handleAction(action) {
    if (!this.playing || this.ended) return;
    if (action === 'pause') this.pauseGame();
    else if (action === 'mute') this.toast(toggleMute() ? 'Sound off' : 'Sound on');
  }

  pauseGame() {
    if (!this.playing || this.ended || !this.sys.isActive()) return;
    clearKeys();
    this.scene.launch('Pause');
    this.scene.pause();
  }

  openShop(f) {
    f.used = true;
    f.glow.setAlpha(0.12);
    f.dockGlow.setAlpha(0.08);
    f.label.setAlpha(0.35);
    this.boat.vx = 0;
    this.boat.vy = 0;
    clearKeys();
    sfx.shopOpen();
    this.scene.launch('Shop');
    this.scene.pause();
  }

  // Called by the shop after a purchase.
  applyLevels() {
    this.stats = statsFor(this.levels);
  }

  smite(god) {
    if (this.ended) return;
    this.ended = true;
    const { color } = GODS[god], b = this.boat;
    sfx.smite();
    const bolt = this.add.graphics().setDepth(35).setBlendMode(Phaser.BlendModes.ADD);
    const pts = [];
    let x = b.x + rnd(-60, 60);
    for (let y = -20; y < b.y; y += rnd(28, 46)) {
      pts.push({ x, y });
      x += rnd(-26, 26) + (b.x - x) * 0.18;
    }
    pts.push({ x: b.x, y: b.y });
    bolt.lineStyle(14, color, 0.35).strokePoints(pts);
    bolt.lineStyle(5, color, 0.9).strokePoints(pts);
    bolt.lineStyle(2, 0xffffff, 1).strokePoints(pts);
    this.tweens.add({ targets: bolt, alpha: 0, duration: 700, delay: 120, onComplete: () => bolt.destroy() });
    const [r, g, bl] = rgbOf(color);
    this.cameras.main.flash(260, r, g, bl);
    this.cameras.main.shake(420, 0.012);
    this.ringFx(b.x, b.y, color, 0.9, 40);
    this.boatImg.setTint(color);
    this.tweens.add({ targets: this.boatImg, scale: 0.6, alpha: 0, angle: '+=40', duration: 900, delay: 200, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: [this.lantern, this.lanternCore], alpha: 0, duration: 400 });
    this.hold.forEach((o) => {
      this.burnOutFx(o.img.x, o.img.y, o.god);
      o.img.destroy();
    });
    this.hold = [];
    const result = { god, distance: this.scroll, delivered: this.run.delivered, earned: this.run.earned, bestStreak: this.run.bestStreak, clutches: this.run.clutches };
    this.time.delayedCall(1100, () => {
      this.scene.pause();
      this.scene.launch('GameOver', result);
    });
  }

  drawDebug() {
    if (!this.debugG) this.debugG = this.add.graphics().setDepth(99);
    const g = this.debugG, a = this.local(0, TUNING.hullFront), b = this.local(0, TUNING.hullBack);
    g.clear().lineStyle(1, 0x00ff88, 0.9);
    g.lineBetween(a.x, a.y, b.x, b.y);
    g.strokeCircle(a.x, a.y, TUNING.hullRadius).strokeCircle(b.x, b.y, TUNING.hullRadius);
    for (const f of this.features) g.strokeCircle(f.tip, f.wy + this.scroll - 6, TUNING.dockReach);
  }
}

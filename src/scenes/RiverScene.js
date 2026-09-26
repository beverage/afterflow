import Phaser from 'phaser';
import { WIDTH as W, HEIGHT as H, GODS, TUNING, LANTERNS, SCROLLS, PORTAL, STALL, FONT, DISPLAY_FONT } from '../config.js';
import { riverAt } from '../river.js';
import { tutorialPending } from './TutorialScene.js';
import { soulValue, statsFor, charonFee, formatObols, formatMeters } from '../economy.js';
import { getSave, recordRun } from '../save.js';
import { moveVector, onAction, onAway, clearKeys, isTouch } from '../controls.js';
import { sfx, toggleMute } from '../sfx.js';
import { rgbOf, hexCss, mixColor, lighten } from '../color.js';
import { drawMeander, spaced } from '../ui.js';
import { Water } from '../water.js';
import { ROCK_R } from '../art.js';
import { setListening, useHeard, canListen, listenStatus } from '../listen.js';
import { prepareIncantations, takeIncantation, heardScroll } from '../scrolls.js';

const TAU = Math.PI * 2;
const clamp = Phaser.Math.Clamp;
const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
const pickOne = (a) => a[(Math.random() * a.length) | 0];
const DEBUG = new URLSearchParams(location.search).has('debug'); // ?debug draws the hull and dock zones

const HUD_RIGHT = W - 148;
const SCROLLS_Y = 322; // the scrolls panel, under the left panel (rage bars, lanterns, distance)

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
    this.run = { obols: 0, earned: 0, delivered: 0, clutches: 0, streak: 0, bestStreak: 0, feesPaid: 0, scrolls: GODS.map(() => null) };
    this.rage = GODS.map(() => 0);
    this.rageFlash = GODS.map(() => 0);
    this.rageWarned = GODS.map(() => false);
    this.lanterns = LANTERNS.start;
    this.graceUntil = 0; // after a smite, until this.t, missed souls anger no one
    this.mark = null; // your best distance on the river, if you have one
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
    this.nextSoulAt = 0;

    this.buildWorld();
    this.buildBoat();
    this.buildEffects();
    if (this.playing) {
      this.runId = Date.now(); // lets the save tell a run revived by Charon's fee from a new one
      this.buildHud();
      const best = getSave().best?.distance ?? 0;
      if (best >= TUNING.markFrom) this.buildMark(best);
    }
    this.spawnAhead();
    for (const k of this.playing ? [0.1, 0.3] : [0.15, 0.35, 0.55]) this.spawnSoul(H * k);

    onAction(this, (action) => this.handleAction(action));
    onAway(this, () => this.pauseGame());

    if (!this.playing) this.scene.launch('Title');
    else if (tutorialPending()) this.events.once('postupdate', () => this.showTutorial()); // after one frame, so the river is drawn under it
    else this.startHints();
    if (this.playing) prepareIncantations(); // Gemini writes this run's first incantations in the background
    this.events.once('shutdown', () => setListening(false));
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
    this.updateAtmosphere(dt);
    this.drawShore();
    const eddyRocks = [];
    for (const p of this.props) {
      p.y = p.wy + this.scroll;
      if (p.nearWater && p.y > -40 && p.y < H + 60) eddyRocks.push({ x: p.x, y: p.y, r: p.rr, side: p.side });
    }
    this.water.update(dt, this.scroll, this.speed * TUNING.currentFactor * (this.ended ? 0.3 : 1), eddyRocks);
    this.updateFeatures(dt);
    this.updateSouls(dt);
    if (this.mark) this.updateMark();
    if (!this.ended) this.updateBoat(dt);
    this.updateHold(dt);
    this.drawWake(dt);
    if (this.playing) {
      this.updateHud(dt);
      this.updateScrolls(dt);
    }
    if (DEBUG) this.drawDebug();
  }

  /* ---------- the river itself ---------- */

  buildWorld() {
    this.bank = this.add.tileSprite(0, 0, W, H, 'bank').setOrigin(0).setDepth(0);
    this.shoreG = this.add.graphics().setDepth(0.5);
    this.water = new Water(this, riverAt, 1); // Ines's water: body, flowing surface, current lines, lifestream, foam
    this.buildAtmosphere();
  }

  // Ines's atmosphere. Fog, tint and haze sit over the river and banks but under the souls and boat,
  // so those stay crisp; a few lighter fog banks and the spores drift above everything but the HUD.
  buildAtmosphere() {
    const fog = TUNING.fogAmount;
    this.add.rectangle(0, 0, W, H, 0x8c96a2, 0.05 * fog).setOrigin(0).setDepth(9.2);
    this.fog = Array.from({ length: 16 }, (_, i) => {
      const f = this.add.image(rnd(-100, W + 100), rnd(0, H), 'fog').setTint(0x9ea8b2).setDepth(i < 11 ? 9.3 : 26);
      f.r = rnd(180, 400);
      f.sx = rnd(1, 2.4); // stretched sideways
      f.vx = rnd(-9, 9);
      f.vy = rnd(-4, 4);
      f.setScale((f.r * 2 * f.sx) / 256, (f.r * 2) / 256).setAlpha(rnd(0.07, 0.16) * fog * 1.35 * (i < 11 ? 1 : 0.6));
      return f;
    });
    this.add.image(0, 0, 'haze').setOrigin(0).setTint(0xaab2c3).setAlpha(fog).setDepth(9.4);
    this.spores = Array.from({ length: 70 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.8, 2.2), a: rnd(0.15, 0.45), ph: rnd(0, TAU), v: rnd(8, 22) }));
    this.sporeG = this.add.graphics().setDepth(27);
    this.add.image(0, 0, 'shade').setOrigin(0).setDepth(44);
  }

  updateAtmosphere(dt) {
    const v = this.speed;
    for (const f of this.fog) {
      const half = f.r * f.sx;
      f.x += f.vx * dt;
      f.y += (f.vy + v * 0.6) * dt;
      if (f.y - f.r > H) f.y = -f.r;
      if (f.x > W + half) f.x = -half;
      if (f.x < -half) f.x = W + half;
    }
    const g = this.sporeG;
    g.clear();
    for (const s of this.spores) {
      s.y += (s.v + v * 0.5) * dt;
      s.x += Math.sin(this.t * 0.8 + s.ph) * 15 * dt;
      if (s.y > H + 5) {
        s.y = -5;
        s.x = rnd(0, W);
      }
      g.fillStyle(0xe1e4f0, s.a * (0.7 + 0.3 * Math.sin(this.t * 2 + s.ph)));
      g.fillCircle(s.x, s.y, s.r);
    }
  }

  // The shore, after Ines's banks: a muddy strip at the waterline and ground that darkens toward the water.
  drawShore() {
    const g = this.shoreG;
    g.clear();
    const edges = [];
    for (let sy = -16; sy <= H + 16; sy += 8) {
      const q = riverAt(sy - this.scroll);
      edges.push({ sy, l: q.l, r: q.r });
    }
    for (const side of [-1, 1]) {
      // [from px, to px] out from the water, color, alpha
      for (const [a, b, color, alpha] of [[0, 7, 0x24231e, 0.7], [7, 16, 0x24231e, 0.35], [16, 28, 0x0c100e, 0.12], [28, 40, 0x0c100e, 0.06]]) {
        const pts = edges.map((e) => ({ x: (side < 0 ? e.l : e.r) + side * a, y: e.sy }));
        for (let i = edges.length - 1; i >= 0; i--) pts.push({ x: (side < 0 ? edges[i].l : edges[i].r) + side * b, y: edges[i].sy });
        g.fillStyle(color, alpha).fillPoints(pts, true);
      }
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

  // Ines's angled portal: an animated gate on the waterline whose light pools into the river.
  // The dock is that pool of light: sail into it to deliver. Falls back to the stone arch without the sheet.
  makeShrine(wy, side, god) {
    const { key, color } = GODS[god], sheet = `portal_${key}`;
    if (!this.textures.exists(sheet) || !this.anims.exists(sheet)) return this.makeArchShrine(wy, side, god);
    const q = riverAt(wy), dir = side === 'left' ? 1 : -1, s = PORTAL.scale;
    const ax = side === 'left' ? q.l - 8 : q.r + 8;
    const at = ([dx, dy]) => ({ x: ax + dir * dx * s, dy: dy * s });
    const swirl = at(PORTAL.swirl), dock = at(PORTAL.dock), medal = at(PORTAL.medal);
    const f = { kind: 'shrine', portal: true, wy, side, god, x: swirl.x, tip: dock.x, dockDy: dock.dy, swirlDy: swirl.dy, popDy: medal.dy - 55, pulse: 0, parts: [] };
    f.dockZone = PORTAL.dockZone.map(at);
    f.dockReach = PORTAL.dockReach * s;
    f.glow = this.attach(f, this.add.image(f.x, 0, 'glow').setTint(color).setBlendMode('ADD').setScale(3).setAlpha(0).setDepth(6.4), swirl.dy);
    const gate = this.add.sprite(ax, 0, sheet).setOrigin(PORTAL.anchor[0] / PORTAL.frameWidth, PORTAL.anchor[1] / PORTAL.frameHeight).setScale(dir * s, s).setDepth(6.5);
    gate.play({ key: sheet, startFrame: (Math.random() * PORTAL.frames) | 0 });
    this.attach(f, gate, 0);
    this.attach(f, this.add.image(medal.x, 0, `medal_${key}`).setScale(1.45 * s).setDepth(6.6), medal.dy);
    f.beam = this.attach(f, this.add.image(f.x, 0, 'beam').setOrigin(0.5, 1).setTint(color).setBlendMode('ADD').setAlpha(0).setDepth(6.7), swirl.dy - 75);
    return f;
  }

  makeArchShrine(wy, side, god) {
    const { x, tip } = this.bankSpot(wy, side);
    const { key, color } = GODS[god];
    const f = { kind: 'shrine', wy, side, god, x, tip, dockDy: -6, swirlDy: -46, popDy: -150, pulse: 0, parts: [] };
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

  // Hermes' stall, at the portals' angle: its base on the bank's edge, facing the water, the dock at the jetty's end.
  makeShop(wy, side) {
    const q = riverAt(wy), dir = side === 'left' ? 1 : -1;
    const ax = side === 'left' ? q.l - 8 : q.r + 8;
    const at = ([dx, dy]) => ({ x: ax + dir * dx, dy });
    const dock = at(STALL.dock), lamp = at(STALL.lamp), medal = at(STALL.medal);
    const f = { kind: 'shop', wy, side, x: ax, tip: dock.x, dockDy: dock.dy, used: false, parts: [] };
    f.dockZone = STALL.dockZone.map(at);
    f.dockReach = STALL.dockReach;
    f.glow = this.attach(f, this.add.image(lamp.x, 0, 'glow').setTint(0xffc478).setBlendMode('ADD').setScale(2.2).setAlpha(0.35).setDepth(6.4), lamp.dy);
    f.dockGlow = this.attach(f, this.add.image(dock.x, 0, 'glow').setTint(0xffc478).setBlendMode('ADD').setScale(2.6).setAlpha(0.3).setDepth(5), dock.dy);
    this.attach(f, this.add.image(ax, 0, 'shop').setOrigin(STALL.anchor[0] / STALL.frameWidth, STALL.anchor[1] / STALL.frameHeight).setScale(dir, 1).setDepth(6.5), 0);
    this.attach(f, this.add.image(medal.x, 0, 'medal_hermes').setScale(1.45).setDepth(6.6), medal.dy);
    f.label = this.attach(f, this.add.text(medal.x, 0, spaced('HERMES'), { fontFamily: FONT, fontSize: '12px', fontStyle: '600', color: '#f1e6c8' }).setOrigin(0.5).setAlpha(0.85).setDepth(6.6), medal.dy - 36);
    return f;
  }

  // True if (x, wy) would sit on a shrine or stall, or on its pier.
  blocked(x, wy, pad = 0) {
    return this.features.some(
      (f) =>
        (Math.abs(x - f.x) < 80 + pad && wy > f.wy - 150 - pad && wy < f.wy + 20 + pad) ||
        (x > Math.min(f.x, f.tip) - pad && x < Math.max(f.x, f.tip) + pad && Math.abs(wy - (f.wy + f.dockDy)) < (f.portal || f.kind === 'shop' ? 50 : 18) + pad),
    );
  }

  // Ines's banks: pines, ferns, rocks (half of them on the waterline) and spider lilies, at her densities.
  spawnPropRow(wy) {
    const q = riverAt(wy), count = (m) => Math.floor(m + Math.random()), pickTex = (base, n) => `${base}${1 + ((Math.random() * n) | 0)}`;
    for (const [edge, dir] of [[q.l, -1], [q.r, 1]]) {
      for (let i = count(0.5); i > 0; i--) {
        const x = edge + dir * rnd(80, 340), y = wy + rnd(-12, 12);
        if (x < -30 || x > W + 30 || this.blocked(x, y, 30)) continue;
        const pine = this.add.image(x, 0, pickTex('pine', 3)).setDepth(8);
        pine.setOrigin((pine.width / 2 - 7) / pine.width);
        this.addProp(pine, y);
      }
      for (let i = count(1.4); i > 0; i--) {
        const x = edge + dir * rnd(16, 300), y = wy + rnd(-14, 14);
        if (x < -20 || x > W + 20 || this.blocked(x, y, 10)) continue;
        this.addProp(this.add.image(x, 0, pickTex('fern', 3)).setDepth(3.2), y);
      }
      for (let i = count(0.42); i > 0; i--) {
        const k = (Math.random() * ROCK_R.length) | 0, x = edge + dir * rnd(-8, 10), y = wy + rnd(-12, 12);
        if (this.blocked(x, y, 8)) continue;
        const rock = this.add.image(x, 0, `rock${k + 1}`).setRotation(rnd(0, 3)).setDepth(3.4);
        rock.setOrigin((rock.width / 2 - 2) / rock.width);
        rock.nearWater = true;
        rock.rr = ROCK_R[k];
        rock.side = -dir; // eddies curl off toward mid-stream
        this.addProp(rock, y);
      }
      for (let i = count(0.52); i > 0; i--) {
        const k = (Math.random() * 4) | 0, x = edge + dir * rnd(14, 220), y = wy + rnd(-12, 12);
        if (x < -20 || x > W + 20 || this.blocked(x, y, 8)) continue;
        const rock = this.add.image(x, 0, `rock${k + 1}`).setRotation(rnd(0, 3)).setDepth(3.1);
        rock.setOrigin((rock.width / 2 - 2) / rock.width);
        this.addProp(rock, y);
      }
      if (Math.random() < 0.28) {
        for (let i = 2 + ((Math.random() * 4) | 0); i > 0; i--) {
          const x = edge + dir * rnd(4, 34), y = wy + rnd(-16, 16);
          if (this.blocked(x, y, 6)) continue;
          this.addProp(this.add.image(x, 0, pickTex('lily', 3)).setOrigin(0.5, 15 / 36).setDepth(3.3), y);
        }
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
        if (f.portal) f.glow.setAlpha(0.55 * f.pulse).setScale(3 + 2 * f.pulse); // the sheet animates itself; flare on delivery
        else {
          f.swirl.rotation += dt * (1.4 + f.pulse * 4);
          f.glow.setAlpha(0.28 + 0.4 * f.pulse + 0.05 * Math.sin(this.t * 1.8 + f.wy)).setScale(4 + 1.4 * f.pulse);
          f.dockGlow.setAlpha(0.22 + 0.3 * f.pulse);
        }
      } else if (!f.used && base > 60) {
        this.hint('shop', "Dock at Hermes' stall to spend your obols");
      }
      if (this.ended || this.dockDist(f, base) > (f.dockReach ?? TUNING.dockReach)) continue;
      if (f.kind === 'shrine') this.deliver(f);
      else if (!f.used && this.playing) this.openShop(f);
    }
  }

  // The gods of the next n shrines the boat hasn't reached yet, nearest first.
  upcomingGods(n) {
    const line = this.boat.y - 30;
    return this.features
      .filter((f) => f.kind === 'shrine' && f.wy + this.scroll + f.dockDy < line)
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
    if (!this.playing || this.ended || this.t < this.graceUntil) return;
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
    if (this.run.streak % LANTERNS.streakForLantern === 0) this.gainLantern();
  }

  arrived(f, gain, clutch, count) {
    const base = f.wy + this.scroll, { color } = GODS[f.god];
    f.pulse = 1;
    this.ringFx(f.x, base + f.swirlDy, color, 0.9, 30);
    this.tweens.add({ targets: f.beam, alpha: { from: 0.85, to: 0 }, duration: 1600, ease: 'Quad.easeOut' });
    if (!this.playing) return;
    this.popup('+' + formatObols(gain), f.x, base + f.popDy, color, 30);
    if (clutch) {
      this.popup('CLUTCH!', f.x, base + f.popDy - 44, color, 46, true);
      this.cameras.main.shake(180, 0.004);
    } else if (count >= 3) this.cameras.main.shake(140, 0.003);
    this.coinFx(f.x, base + f.swirlDy, Math.min(6, 2 + count));
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

  // How far the hull is from a feature's dock: its tip, or anywhere along its dock zone (the pool of light at a portal or stall).
  dockDist(f, base) {
    if (!f.dockZone) return this.hullDist(f.tip, base + f.dockDy);
    const [a, b] = f.dockZone, n = Math.ceil(Math.hypot(b.x - a.x, b.dy - a.dy) / 12);
    let d = Infinity;
    for (let i = 0; i <= n; i++) d = Math.min(d, this.hullDist(a.x + ((b.x - a.x) * i) / n, base + a.dy + ((b.dy - a.dy) * i) / n));
    return d;
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
    const blink = this.t < this.graceUntil && Math.sin(this.t * 38) > 0; // the boat flickers through the grace after a smite
    this.boatImg.setPosition(b.x, b.y).setRotation(b.tilt).setAlpha(blink ? 0.35 : 1);
    const bow = this.local(0, -66);
    const gutter = this.playing && this.lanterns === 1 ? 0.45 + 0.55 * Math.abs(Math.sin(this.t * 7.3) * Math.sin(this.t * 3.1)) : 1; // on the last lantern the bow light gutters
    this.lantern.setPosition(bow.x, bow.y).setAlpha(0.5 * gutter);
    this.lanternCore.setPosition(bow.x, bow.y - 1).setAlpha(0.9 * gutter);
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
      const dy = b.y - (f.wy + this.scroll + f.dockDy);
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
        const e = tw.getValue(), u = 1 - e, ty = f.wy + this.scroll + f.swirlDy;
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
    for (const [x, h] of [[14, 298], [HUD_RIGHT, 238]]) {
      panel.fillStyle(0x080b0a, 0.64).fillRoundedRect(x, 14, 134, h, 10);
      panel.lineStyle(1, 0xdce6e2, 0.12).strokeRoundedRect(x, 14, 134, h, 10);
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
    // Lanterns: small copies of the boat's bow lantern. The frames are drawn in updateHud, the flames are glows.
    label('LANTERNS', 26, 204);
    this.lanternIcons = Array.from({ length: LANTERNS.max }, (_, i) => {
      const x = 38 + i * 30, y = 238;
      const glow = this.add.image(x, y + 1, 'glow').setTint(0xffc478).setBlendMode('ADD').setDepth(d + 1);
      const core = this.add.image(x, y + 1, 'glow').setTint(0xffe6aa).setBlendMode('ADD').setDepth(d + 1);
      return { x, y, glow, core };
    });
    this.lanternPulse = this.lanternIcons.map(() => 0);
    label('DISTANCE', 26, 262);
    this.distText = this.add.text(26, 278, '0 m', { fontFamily: FONT, fontSize: '19px', fontStyle: '600', color: '#e6eeea' }).setDepth(d + 1);
    label('OBOLS', HUD_RIGHT + 12, 38);
    this.add.image(HUD_RIGHT + 25, 70, 'obol').setScale(0.62).setDepth(d + 1);
    this.obolText = this.add.text(HUD_RIGHT + 44, 70, '0', { fontFamily: FONT, fontSize: '25px', fontStyle: '600', color: '#f1e6c8' }).setOrigin(0, 0.5).setDepth(d + 1);
    label('STREAK', HUD_RIGHT + 12, 98);
    this.streakText = this.add.text(HUD_RIGHT + 12, 128, '×1', { fontFamily: DISPLAY_FONT, fontSize: '32px', fontStyle: 'italic 600', color: '#ffffff' }).setOrigin(0, 0.5).setDepth(d + 1);
    label('HOLD', HUD_RIGHT + 12, 152);
    label('NEXT', HUD_RIGHT + 12, 196);
    this.nextIcons = [0, 1, 2].map((i) => this.add.image(HUD_RIGHT + 26 + i * 34, 229, `medal_${GODS[0].key}`).setScale(0.8).setDepth(d + 1));
    if (isTouch()) this.buildPauseButton(d);
    this.buildScrolls(d);
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setTint(0xff2a1a).setAlpha(0).setDepth(45);
    this.obolShown = 0;
    this.obolPulse = 0;
    this.streakPulse = 0;
  }

  // No Esc key on a phone: a pause button beside the top of the right panel, out of the thumbs' way.
  buildPauseButton(depth) {
    const x = HUD_RIGHT - 36, y = 42, g = this.add.graphics().setDepth(depth);
    g.fillStyle(0x080b0a, 0.64).fillCircle(x, y, 22);
    g.lineStyle(1, 0xdce6e2, 0.12).strokeCircle(x, y, 22);
    g.fillStyle(0xdce6e2, 0.8).fillRect(x - 7, y - 8, 5, 16).fillRect(x + 2, y - 8, 5, 16);
    this.add.zone(x, y, 88, 88).setInteractive().on('pointerdown', () => this.pauseGame());
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
    this.lanternIcons.forEach((l, i) => {
      const lit = i < this.lanterns, p = this.lanternPulse[i];
      const flicker = this.lanterns === 1 ? 0.5 + 0.5 * Math.abs(Math.sin(this.t * 9)) : 1; // the last one gutters
      g.lineStyle(1.5, 0xf1e6c8, lit ? 0.7 : 0.22).strokeRoundedRect(l.x - 7, l.y - 8, 14, 18, 4);
      g.beginPath();
      g.arc(l.x, l.y - 8, 4, Math.PI, TAU);
      g.strokePath();
      l.glow.setVisible(lit).setScale(0.6 * (1 + 0.6 * p)).setAlpha((0.5 + 0.08 * Math.sin(this.t * 3 + i * 2)) * flicker);
      l.core.setVisible(lit).setScale(0.17 * (1 + 0.6 * p)).setAlpha(0.95 * flicker);
      this.lanternPulse[i] = Math.max(0, p - dt * 2.5);
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
    const touch = isTouch(); // on a phone, "touch a soul" would read as "tap it"
    this.toast(touch ? 'Slide a thumb anywhere to steer' : 'Steer with WASD, ZQSD or the arrow keys');
    this.time.delayedCall(3300, () => this.hint('touch', touch ? 'Steer into a soul to take it aboard' : 'Touch a soul to take it aboard'));
  }

  /* ---------- flow: pause, shop, death ---------- */

  handleAction(action) {
    if (!this.playing || this.ended) return;
    if (action === 'pause') this.pauseGame();
    else if (action === 'mute') this.toast(toggleMute() ? 'Sound off' : 'Sound on');
    else if (action === 'confirm') this.toggleScrolls();
    else if (/^buy[123]$/.test(action)) this.readScroll(Number(action.slice(3)) - 1);
    else if (action === 'help') this.showTutorial();
  }

  pauseGame() {
    if (!this.playing || this.ended || !this.sys.isActive()) return;
    setListening(false);
    clearKeys();
    this.scene.launch('Pause');
    this.scene.pause();
  }

  // The how-to-play tour: on the first run of a session, or on H. It resumes the river when it closes.
  showTutorial() {
    if (!this.playing || this.ended || !this.sys.isActive()) return;
    clearKeys();
    this.scene.launch('Tutorial');
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

  /* ---------- your best, marked on the river ---------- */

  // A line of floating lanterns across the water where your best run sank, labelled on the bank.
  // It crosses the boat's usual line just as the distance counter reaches your best.
  buildMark(best) {
    const m = { best, wy: TUNING.boatStartY - best, passed: false };
    m.lights = Array.from({ length: 7 }, (_, i) => ({
      k: 0.08 + (0.84 * i) / 6,
      ph: rnd(0, TAU),
      glow: this.add.image(0, 0, 'glow').setTint(0xffe6aa).setBlendMode('ADD').setScale(0.9).setAlpha(0.45).setDepth(13),
      core: this.add.image(0, 0, 'glow').setBlendMode('ADD').setScale(0.2).setAlpha(0.9).setDepth(13),
    }));
    m.label = this.add
      .text(0, 0, `${spaced('YOUR BEST')}   ${formatMeters(best)}`, { fontFamily: FONT, fontSize: '13px', fontStyle: '600', color: '#f1e6c8' })
      .setOrigin(1, 0.5)
      .setAlpha(0.85)
      .setDepth(9);
    m.label.setShadow(0, 0, '#000000', 6, true, true);
    this.mark = m;
  }

  updateMark() {
    const m = this.mark, y = m.wy + this.scroll, q = riverAt(m.wy);
    for (const l of m.lights) {
      const x = q.l + (q.r - q.l) * l.k, by = y + 3 * Math.sin(this.t * 1.6 + l.ph);
      l.glow.setPosition(x, by);
      l.core.setPosition(x, by);
    }
    m.label.setPosition(q.l - 14, y);
    if (m.passed || this.ended || this.scroll < m.best) return;
    // Passing it: the lanterns flare and drift off, one after another.
    m.passed = true;
    sfx.newBest();
    this.popup('New best!', this.boat.x, this.boat.y - 96, 0xffe6aa, 40, true);
    m.lights.forEach((l, i) => {
      this.tweens.add({ targets: l.glow, scale: 2.2, alpha: 0, duration: 700, delay: i * 70, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: l.core, scale: 0.5, alpha: 0, duration: 700, delay: i * 70, ease: 'Quad.easeOut' });
    });
    this.tweens.add({ targets: m.label, alpha: 0, duration: 900, delay: 400 });
    this.time.delayedCall(1400, () => {
      for (const l of m.lights) {
        l.glow.destroy();
        l.core.destroy();
      }
      m.label.destroy();
      if (this.mark === m) this.mark = null;
    });
  }

  /* ---------- lanterns: the boat's lives ---------- */

  // A god's rage is full: lightning strikes the boat and puts out a lantern.
  smite(god) {
    if (this.ended) return;
    const { name, color } = GODS[god], b = this.boat;
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
    this.loseLantern({ god });
    if (this.ended) return;
    this.appease(god);
    this.time.delayedCall(400, () => !this.ended && this.boatImg.clearTint());
    this.toast(`${name} struck: ${this.lanterns === 1 ? 'one lantern left' : `${this.lanterns} lanterns left`}`, color, true);
  }

  // After a smite you survive: the god who struck is appeased and the others cool off a little.
  appease(god) {
    this.rage = this.rage.map((v, i) => (i === god ? 0 : Math.max(0, v - LANTERNS.coolOthers)));
    this.rageWarned = this.rageWarned.map((w, i) => w && this.rage[i] >= TUNING.rageWarn - 0.1);
  }

  // A lantern goes out: a god's smite, and a wrecked hull once there are obstacles. The souls aboard
  // and the streak go with it, then a few seconds of grace. The last one ends the run.
  loseLantern(cause) {
    this.lanterns = Math.max(0, this.lanterns - 1);
    this.lanternOutFx(this.lanterns);
    this.hold.forEach((o) => {
      this.burnOutFx(o.img.x, o.img.y, o.god);
      o.img.destroy();
    });
    this.hold = [];
    this.run.streak = 0;
    if (this.lanterns === 0) this.sink(cause);
    else this.graceUntil = this.t + LANTERNS.graceSeconds;
  }

  // The last lantern is out: the boat goes under and the run ends, unless Charon's fee is paid.
  sink(cause) {
    this.ended = true;
    this.sunkBy = cause;
    setListening(false);
    this.showScrolls(false);
    this.tweens.add({ targets: this.boatImg, scale: 0.6, alpha: 0, angle: '+=40', duration: 900, delay: 200, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: [this.lantern, this.lanternCore], alpha: 0, duration: 400 });
    const result = {
      god: cause.god,
      distance: this.scroll,
      delivered: this.run.delivered,
      earned: this.run.earned,
      bestStreak: this.run.bestStreak,
      clutches: this.run.clutches,
      obols: this.run.obols,
      fee: charonFee(this.run.feesPaid),
    };
    result.previousBest = recordRun(this.runId, result);
    this.time.delayedCall(1100, () => {
      this.scene.pause();
      this.scene.launch('GameOver', result);
    });
  }

  // Called by the game-over screen once Charon's fee is paid: back on the water with one lantern.
  revive() {
    this.run.feesPaid += 1;
    this.ended = false;
    this.lanterns = 1;
    this.graceUntil = this.t + LANTERNS.graceSeconds;
    if (this.sunkBy.god !== undefined) this.appease(this.sunkBy.god);
    this.tweens.killTweensOf([this.boatImg, this.lantern, this.lanternCore]);
    this.boatImg.setScale(1).clearTint();
    this.lanternPulse[0] = 1;
    sfx.lanternLit();
    this.ringFx(this.boat.x, this.boat.y, 0xffc478, 0.9, 40);
    this.toast('Charon takes his fee: one lantern lit', 0xffc478, true);
    this.scene.resume();
  }

  // Every 8th delivery in a row lights a lantern, up to the max.
  gainLantern() {
    if (this.lanterns >= LANTERNS.max) return;
    this.lanternPulse[this.lanterns] = 1;
    this.lanterns += 1;
    sfx.lanternLit();
    const bow = this.local(0, -66);
    this.ringFx(bow.x, bow.y, 0xffc478, 0.7, 24);
    this.popup('+1 lantern', this.boat.x + 64, this.boat.y - 50, 0xffc478, 24);
    this.hint('lantern', `Every ${LANTERNS.streakForLantern} deliveries in a row light a lantern`, 0xffc478);
  }

  // A lantern in the HUD goes out: a last flare, then a wisp of smoke.
  lanternOutFx(i) {
    const l = this.lanternIcons?.[i];
    if (!l) return;
    const flare = this.add.image(l.x, l.y, 'glow').setTint(0xffc478).setBlendMode('ADD').setScale(0.9).setDepth(52);
    this.tweens.add({ targets: flare, scale: 1.8, alpha: { from: 0.9, to: 0 }, duration: 450, ease: 'Quad.easeOut', onComplete: () => flare.destroy() });
    for (let k = 0; k < 4; k++) {
      const puff = this.add.image(l.x + rnd(-3, 3), l.y - 6, 'glow').setTint(0x9a96a8).setScale(rnd(0.12, 0.2)).setAlpha(0.5).setDepth(52);
      this.tweens.add({ targets: puff, x: puff.x + rnd(-10, 10), y: puff.y - rnd(22, 36), scale: puff.scale * 2.4, alpha: 0, duration: rnd(700, 1000), delay: k * 90, ease: 'Quad.easeOut', onComplete: () => puff.destroy() });
    }
  }

  /* ---------- scrolls: say a carried scroll's incantation aloud to calm its god ---------- */

  // A small panel under the rage bars shows which scrolls you carry. Space (or a tap on it) unrolls them
  // for a few seconds so you can re-read the words, over the bank, while the river keeps going.
  buildScrolls(d) {
    const x = 14, y = SCROLLS_Y, g = this.add.graphics().setDepth(d);
    g.fillStyle(0x080b0a, 0.64).fillRoundedRect(x, y, 134, 84, 10);
    g.lineStyle(1, 0xdce6e2, 0.12).strokeRoundedRect(x, y, 134, 84, 10);
    this.add.text(26, y + 12, spaced('SCROLLS'), { fontFamily: FONT, fontSize: '11px', fontStyle: '600', color: '#dce6e2' }).setAlpha(0.55).setDepth(d + 1);
    this.micDot = this.add.circle(134, y + 19, 4, 0x4ade80).setDepth(d + 1);
    this.scrollIcons = GODS.map((god, i) => this.add.image(36 + i * 45, y + 45, `scroll_${god.key}`).setScale(0.42).setDepth(d + 1));
    this.scrollKey = this.add
      .text(81, y + 70, isTouch() ? 'tap to read' : 'Space to read', { fontFamily: FONT, fontSize: '11px', fontStyle: '600', color: '#dce6e2' })
      .setOrigin(0.5)
      .setAlpha(0.5)
      .setDepth(d + 1);
    this.add.zone(x + 67, y + 42, 134, 84).setInteractive().on('pointerdown', () => this.toggleScrolls());

    // The unrolled panel: every scroll's words, and how long until it rolls up again.
    const p = (this.scrollPanel = this.add.container(0, 0).setDepth(d + 3).setVisible(false));
    const bg = this.add.graphics();
    bg.fillStyle(0x080b0a, 0.9).fillRoundedRect(x, y, 330, 214, 10);
    bg.lineStyle(1, 0xf1e6c8, 0.25).strokeRoundedRect(x, y, 330, 214, 10);
    p.add(bg);
    p.add(this.add.text(26, y + 12, spaced('SCROLLS'), { fontFamily: FONT, fontSize: '11px', fontStyle: '600', color: '#dce6e2' }).setAlpha(0.55));
    this.scrollRows = GODS.map((god, i) => {
      const ry = y + 56 + i * 50;
      const medal = this.add.image(40, ry, `medal_${god.key}`);
      const words = this.add.text(64, ry, '', { fontFamily: DISPLAY_FONT, fontSize: '21px', fontStyle: 'italic 600', color: hexCss(lighten(god.color, 0.35)), wordWrap: { width: 270 }, lineSpacing: -4 }).setOrigin(0, 0.5);
      p.add([medal, words]);
      return { medal, words };
    });
    this.scrollFoot = this.add.text(26, y + 196, '', { fontFamily: FONT, fontSize: '12px', fontStyle: '600', color: '#dce6e2' }).setOrigin(0, 0.5).setAlpha(0.6);
    this.scrollTimer = this.add.graphics();
    p.add([this.scrollFoot, this.scrollTimer]);
    // Taps on the panel: read a scroll when there's no mic, otherwise roll it up.
    this.add
      .zone(x + 165, y + 107, 330, 214)
      .setInteractive()
      .on('pointerdown', (ptr) => {
        if (!this.scrollPanel.visible) return;
        const row = Math.floor((ptr.worldY - (y + 31)) / 50);
        if (!canListen() && row >= 0 && row < 3 && this.run.scrolls[row]) this.readScroll(row);
        else this.showScrolls(false);
      });
    this.scrollOpenFor = 0;

    // What the mic caught, like a subtitle under the river.
    this.heardText = this.add
      .text(W / 2, H - 30, '', { fontFamily: FONT, fontSize: '17px', fontStyle: '600', color: '#dce6e2', backgroundColor: 'rgba(8,11,10,0.55)', padding: { x: 12, y: 5 } })
      .setOrigin(0.5)
      .setDepth(d + 2)
      .setAlpha(0);
    this.heardFor = 0;
  }

  updateScrolls(dt) {
    const carried = this.run.scrolls, any = carried.some(Boolean);
    setListening(!this.ended && any && this.sys.isActive(), (c) => this.heard(c));
    const mic = listenStatus();
    this.micPulse = Math.max(0, (this.micPulse || 0) - dt * 3);
    this.micDot.setFillStyle(mic === 'listening' ? 0x4ade80 : canListen() ? 0x97aaa2 : 0xf87171).setAlpha(any ? (mic === 'listening' ? 0.6 + 0.4 * Math.sin(this.t * 4) : 0.7) : 0.25);
    this.micDot.setScale(1 + 0.9 * this.micPulse);
    const open = this.scrollPanel.visible;
    this.scrollIcons.forEach((icon, i) => icon.setVisible(!open).setAlpha(carried[i] ? 1 : 0.22).setScale(carried[i] ? 0.42 + 0.02 * Math.sin(this.t * 3 + i) : 0.42));
    this.scrollKey.setVisible(!open);
    // First scroll aboard: once the mic has answered, say how to use it.
    if (any && !this.hints.scroll && (mic === 'listening' || !canListen())) {
      this.hint('scroll', canListen() ? "Say a scroll's words aloud to calm its god" : 'No mic: press Space, then 1, 2 or 3, to read a scroll', GODS[carried.findIndex(Boolean)].color);
    }
    if (this.scrollPanel.visible) {
      this.scrollOpenFor -= dt;
      if (this.scrollOpenFor <= 0) this.showScrolls(false);
      const left = clamp(this.scrollOpenFor / SCROLLS.panelSeconds, 0, 1);
      this.scrollTimer.clear().fillStyle(0xf1e6c8, 0.5).fillRect(24, SCROLLS_Y + 207, 310 * left, 2);
    }
    this.heardFor -= dt;
    this.heardText.setAlpha(clamp(this.heardFor / 0.5, 0, 1));
  }

  toggleScrolls() {
    this.showScrolls(!this.scrollPanel.visible);
  }

  showScrolls(open) {
    if (!this.scrollPanel || this.scrollPanel.visible === open) return;
    if (open && (this.ended || !this.sys.isActive())) return;
    this.scrollPanel.setVisible(open);
    if (!open) return;
    this.scrollOpenFor = SCROLLS.panelSeconds;
    sfx.scrollOpen();
    const touch = isTouch();
    this.run.scrolls.forEach((words, i) => {
      const row = this.scrollRows[i];
      row.words.setText(words || 'no scroll').setFontSize(words ? 24 : 14).setAlpha(words ? 1 : 0.35);
      row.medal.setAlpha(words ? 1 : 0.35);
    });
    const any = this.run.scrolls.some(Boolean);
    this.scrollFoot.setText(
      !any ? "Buy scrolls at Hermes' stall" : canListen() ? 'Say the words aloud. The river won\'t wait' : touch ? 'No mic: tap a scroll to read it' : 'No mic: press 1, 2 or 3 to read one',
    );
  }

  // Called by the shop: carry this god's scroll, with a fresh incantation. The first one asks for the mic,
  // while the stall has the game paused.
  takeScroll(god) {
    this.run.scrolls[god] = takeIncantation(god);
    setListening(true, (c) => this.heard(c));
  }

  // The mic caught some words: show them, and use a carried scroll if they match its incantation.
  heard(candidates) {
    if (!this.playing || this.ended || !this.sys.isActive()) return;
    this.micPulse = 1; // the dot flares on any speech, so you can tell it's listening
    const best = heardScroll(this.run.scrolls, candidates);
    if (!best) return;
    // Only attempts show as a subtitle; other people's chatter stays off screen (all of it shows with ?debug).
    if (best.score >= SCROLLS.showHeard || DEBUG) {
      const tail = candidates[0].all.split(/\s+/).slice(-9).join(' ');
      this.heardText.setText(DEBUG ? `“${tail}” ${best.score.toFixed(2)}` : `“${tail}”`).setColor('#dce6e2');
      this.heardFor = SCROLLS.heardSeconds;
    }
    if (best.pass) this.readScroll(best.god, true);
  }

  // Use a carried scroll: spoken aloud, or with a key or tap when there's no mic.
  readScroll(god, spoken = false) {
    const words = this.run.scrolls[god];
    if (!words || this.ended || !this.sys.isActive()) return;
    if (!spoken && (canListen() || !this.scrollPanel.visible)) return; // with a mic, the words are the only way
    const { color, name } = GODS[god];
    this.run.scrolls[god] = null;
    useHeard();
    this.rage[god] = Math.max(0, this.rage[god] - SCROLLS.calm);
    if (this.rage[god] < TUNING.rageWarn - 0.1) this.rageWarned[god] = false;
    sfx.appease(god);
    this.heardText.setColor(hexCss(lighten(color, 0.4)));
    this.popup(words, W / 2, 230, color, 40, true);
    this.toast(`${name} is appeased`, color, true);
    const barY = 76 + god * 46 + 9;
    this.ringFx(98, barY, color, 0.8, 26);
    this.sparks[god].explode(26, 98, barY);
    this.ringFx(this.boat.x, this.boat.y, color, 0.9, 36);
    this.embers[god].explode(24, this.boat.x, this.boat.y);
    if (this.scrollPanel.visible) this.showScrolls(false);
  }

  drawDebug() {
    if (!this.debugG) this.debugG = this.add.graphics().setDepth(99);
    const g = this.debugG, a = this.local(0, TUNING.hullFront), b = this.local(0, TUNING.hullBack);
    g.clear().lineStyle(1, 0x00ff88, 0.9);
    g.lineBetween(a.x, a.y, b.x, b.y);
    g.strokeCircle(a.x, a.y, TUNING.hullRadius).strokeCircle(b.x, b.y, TUNING.hullRadius);
    for (const f of this.features) {
      const base = f.wy + this.scroll;
      if (!f.dockZone) {
        g.strokeCircle(f.tip, base + f.dockDy, TUNING.dockReach);
        continue;
      }
      const [a, b] = f.dockZone, r = f.dockReach;
      g.lineBetween(a.x, base + a.dy, b.x, base + b.dy).strokeCircle(a.x, base + a.dy, r).strokeCircle(b.x, base + b.dy, r);
    }
  }
}

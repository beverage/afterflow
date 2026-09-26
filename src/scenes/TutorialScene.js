import Phaser from 'phaser';
import { WIDTH as W, HEIGHT as H, GODS, TUTORIAL, FONT, DISPLAY_FONT } from '../config.js';
import { onAction, clearKeys, isTouch } from '../controls.js';
import { sfx, toggleMute } from '../sfx.js';
import { hexCss } from '../color.js';

// How to play, after Ines's tour for the River Flow prototype: over the paused river, the screen dims
// and a spotlight moves from the boat to a soul, a shrine and the HUD, with a caption card for each.
// Each step moves on when its bar fills; Space, a click or a tap moves on sooner, Esc or Skip ends it.
// It opens on the first run of a browser session; H or the pause screen's How to play brings it back.

const TAU = Math.PI * 2;
const DIM = 0x080c0e;
const DIM_ALPHA = 0.58;
const HOLE = 256; // size of the spotlight texture: dim all round a soft hole of radius HOLE_R
const HOLE_R = 112;
const OPEN = { x: W / 2, y: H / 2, r: 900 }; // a hole wider than the screen: no dim at all
const CLOSED = { x: W / 2, y: H / 2, r: 0 }; // nothing to point at: dim everything
const CARD_W = 600;
const PAD = 22;
const SEEN_KEY = 'soul-drift-tutorial';

// The HUD panels drawn by RiverScene.buildHud: rage bars top left, obols and streak top right.
const RAGE_SPOT = { x: 81, y: 106, r: 108 };
const OBOLS_SPOT = { x: W - 81, y: 90, r: 90 };

// touch: the words on a phone, where there are no keys and "touch a soul" would read as "tap it".
const STEPS = [
  { title: 'Your ferry', body: 'Steer anywhere on the water with WASD, ZQSD or the arrow keys.', touch: 'Slide a thumb anywhere on the screen to steer.', spot: (river) => ({ x: river.boat.x, y: river.boat.y - 6, r: 86 }) },
  { title: 'Scoop up souls', body: 'Touch a soul to take it aboard. Its color and symbol show which god it belongs to.', touch: 'Steer into a soul to take it aboard. Its color and symbol show which god it belongs to.', spot: soulSpot, pulse: true },
  { title: 'Three gods, three shrines', body: "Sail into the light at a shrine to deliver its god's souls. Be quick: souls aboard don't last.", spot: shrineSpot, legend: true },
  { title: "The gods' rage", body: 'Every soul that floats past uncaught angers its god. When a bar fills, that god puts out one of your lanterns.', spot: () => RAGE_SPOT },
  { title: 'Obols and streaks', body: "Deliveries earn obols, and back-to-back ones build a streak. Spend obols at Hermes' stall.", spot: () => OBOLS_SPOT },
  { title: 'Your turn', body: 'Press H anytime to see this again.', touch: 'Pause, then tap How to play to see this again.', seconds: TUTORIAL.lastStepSeconds },
];

let seen = false; // kept in memory too, for browsers that block sessionStorage

/** True until the tutorial has been seen in this browser session (a new tab shows it again). */
export function tutorialPending() {
  if (seen) return false;
  try {
    return sessionStorage.getItem(SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

function markSeen() {
  seen = true;
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // private mode: the in-memory flag still covers restarts
  }
}

// Launched over the paused river (RiverScene.showTutorial, or H on the pause screen); resumes it on close.
export class TutorialScene extends Phaser.Scene {
  constructor() {
    super('Tutorial');
  }

  create() {
    this.river = this.scene.get('River');
    this.clock = 0;
    this.closing = false;
    this.card = null;
    this.spot = { ...OPEN }; // starts wide open and closes in on the first target, like an iris
    makeHoleTexture(this);
    this.dimG = this.add.graphics();
    this.hole = this.add.image(0, 0, 'tutorial_hole').setAlpha(DIM_ALPHA);
    this.fxG = this.add.graphics();

    onAction(this, (action) => {
      if (action === 'confirm') this.next();
      else if (action === 'pause') this.skip();
      else if (action === 'mute') toggleMute();
    });
    this.input.on('pointerdown', (_pointer, over) => over.length || this.next());
    this.show(0);
  }

  update(_time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.clock += dt;
    this.t += dt;
    if (!this.closing && this.t > this.duration) this.advance();
    const k = 1 - Math.exp(-5 * dt), s = this.spot, g = this.target;
    s.x += (g.x - s.x) * k;
    s.y += (g.y - s.y) * k;
    s.r += (g.r - s.r) * k;
    this.drawDim();
    this.drawRing();
    this.drawBar();
  }

  /* ---------- steps ---------- */

  show(i) {
    const step = STEPS[i], found = step.spot ? step.spot(this.river) : null;
    this.i = i;
    this.t = 0;
    this.duration = step.seconds ?? TUTORIAL.stepSeconds;
    this.lit = Boolean(found); // the dashed ring only circles something real
    this.target = found || (step.spot ? CLOSED : OPEN);
    const old = this.card;
    if (old) this.tweens.add({ targets: old, alpha: 0, duration: 160, onComplete: () => old.destroy() });
    // The card keeps clear of the spotlight: at the bottom when it points high, at the top when low.
    const card = this.buildCard(step), h = this.cardH;
    const y = !found ? Math.round((H - h) / 2) - 24 : found.y < H * 0.55 ? H - 34 - h : 34;
    card.setPosition((W - CARD_W) / 2, y + 8).setAlpha(0);
    this.tweens.add({ targets: card, alpha: 1, y, duration: 420, delay: old ? 120 : 160, ease: 'Quad.easeOut' });
    this.card = card;
  }

  // Space, Enter or a click. Not in the first moments, so the key that started the run doesn't skip a step.
  next() {
    if (this.closing || this.clock < 0.35) return;
    sfx.tap();
    this.advance();
  }

  advance() {
    if (this.i + 1 < STEPS.length) this.show(this.i + 1);
    else this.finish();
  }

  skip() {
    if (this.closing) return;
    sfx.tap();
    this.finish();
  }

  finish() {
    if (this.closing) return;
    this.closing = true;
    markSeen();
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 240, ease: 'Quad.easeIn', onComplete: () => this.close() });
  }

  close() {
    clearKeys();
    this.scene.stop();
    this.scene.resume('River');
  }

  /* ---------- the caption card ---------- */

  buildCard(step) {
    const c = this.add.container(0, 0), touch = isTouch();
    const title = this.add.text(PAD, 14, step.title, { fontFamily: DISPLAY_FONT, fontSize: '32px', fontStyle: 'italic 500', color: '#f3f6f5' });
    const body = this.add.text(PAD, 14 + title.height, (touch && step.touch) || step.body, { fontFamily: FONT, fontSize: '19px', color: '#d3dcd9', lineSpacing: 6, wordWrap: { width: CARD_W - 2 * PAD } });
    c.add([title, body]);
    let y = body.y + body.height;
    if (step.legend) {
      let x = PAD;
      for (const god of GODS) {
        const icon = this.add.image(x + 11, y + 23, `soul_${god.key}`).setScale(0.55);
        const name = this.add.text(x + 28, y + 23, god.name, { fontFamily: DISPLAY_FONT, fontSize: '21px', fontStyle: 'italic 600', color: hexCss(god.color) }).setOrigin(0, 0.5);
        c.add([icon, name]);
        x += 28 + name.width + 26;
      }
      y += 36;
    }
    // Footer: which step this is, and how to move on.
    const fy = y + 22, text = { fontFamily: FONT, fontSize: '14px', color: '#d3dcd9' };
    const dots = this.add.graphics();
    STEPS.forEach((_, k) => dots.fillStyle(k === this.i ? 0xe8eeec : 0xd3dcd9, k === this.i ? 1 : 0.3).fillCircle(PAD + 3 + k * 11, fy, 3));
    const skip = this.add.text(CARD_W - PAD, fy, touch ? 'Skip' : 'Esc to skip', text).setOrigin(1, 0.5).setAlpha(0.85);
    const prompt = this.add.text(skip.x - skip.width, fy, touch ? 'Tap to continue  ·  ' : 'Click or Space to continue  ·  ', text).setOrigin(1, 0.5).setAlpha(0.7);
    const underline = this.add.graphics().lineStyle(1, 0xd3dcd9, 0.6).lineBetween(skip.x - skip.width, fy + 9, skip.x, fy + 9);
    // A hit area much bigger than the words, so a thumb can find it.
    const skipZone = this.add.zone(skip.x - skip.width / 2, fy, skip.width + 36, 56).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.skip());
    const h = fy + 22;
    // Behind it all, as in Ines's card: a faint violet glow, a dark rim, the panel and its thin border.
    const bg = this.add.graphics();
    for (let k = 0; k < 6; k++) {
      const o = 6 + k * 4;
      bg.lineStyle(4, 0x8c78ff, 0.11 * (1 - k / 6)).strokeRoundedRect(-o, -o, CARD_W + 2 * o, h + 2 * o, 6 + o);
    }
    bg.lineStyle(4, 0x221d1b, 0.55).strokeRoundedRect(-2, -2, CARD_W + 4, h + 4, 8);
    bg.fillStyle(0x221d1b, 0.9).fillRoundedRect(0, 0, CARD_W, h, 6);
    bg.lineStyle(1, 0xc9d2d6, 0.55).strokeRoundedRect(0.5, 0.5, CARD_W - 1, h - 1, 6);
    this.bar = this.add.graphics();
    c.addAt(bg, 0);
    c.add([dots, prompt, skip, underline, skipZone, this.bar]);
    this.cardH = h;
    return c;
  }

  // Fills along the card's bottom edge as the step's time runs out.
  drawBar() {
    const w = CARD_W - 12, y = this.cardH - 3, p = Math.min(1, this.t / this.duration);
    this.bar.clear().fillStyle(0xffffff, 0.08).fillRect(6, y, w, 2);
    if (p > 0) this.bar.fillGradientStyle(0x9b6cff, 0x6fe6ff, 0x9b6cff, 0x6fe6ff, 1).fillRect(6, y, w * p, 2);
  }

  /* ---------- the spotlight ---------- */

  // Dim everything but a soft round hole: the hole texture, framed by four plain rectangles.
  drawDim() {
    const h = Math.round((this.spot.r * HOLE) / 2 / HOLE_R), x = Math.round(this.spot.x), y = Math.round(this.spot.y);
    this.hole.setPosition(x, y).setDisplaySize(2 * h, 2 * h).setVisible(h > 0);
    const top = Phaser.Math.Clamp(y - h, 0, H), bottom = Phaser.Math.Clamp(y + h, 0, H), left = Phaser.Math.Clamp(x - h, 0, W), right = Phaser.Math.Clamp(x + h, 0, W);
    const g = this.dimG.clear().fillStyle(DIM, DIM_ALPHA);
    g.fillRect(0, 0, W, top).fillRect(0, bottom, W, H - bottom);
    if (bottom > top) g.fillRect(0, top, left, bottom - top).fillRect(right, top, W - right, bottom - top);
  }

  // A dashed ring that slowly turns and breathes around the spotlight; ripples on the soul to catch.
  drawRing() {
    const g = this.fxG.clear();
    if (!this.lit || this.closing) return;
    const { x, y, r } = this.spot, n = Math.max(12, Math.floor((TAU * r) / 18)), step = TAU / n, turn = (this.clock * 20) / r;
    g.lineStyle(2, 0xe6f0f5, 0.45 + 0.25 * Math.sin(this.clock * 4));
    for (let i = 0; i < n; i++) {
      const a = i * step + turn;
      g.beginPath();
      g.arc(x, y, r, a, a + step * (10 / 18));
      g.strokePath();
    }
    if (!STEPS[this.i].pulse) return;
    for (let i = 0; i < 2; i++) {
      const p = (this.clock * 0.9 + i * 0.5) % 1;
      g.lineStyle(3, 0xffffff, (1 - p) * 0.9).strokeCircle(this.target.x, this.target.y, 14 + p * 30);
    }
  }
}

/* ---------- where each step points ---------- */

// The soul on screen nearest the boat.
function soulSpot(river) {
  const b = river.boat, dist = (s) => Math.hypot(s.x - b.x, s.y - b.y);
  const best = river.souls.filter((s) => s.y > 50 && s.y < H - 50).sort((p, q) => dist(p) - dist(q))[0];
  return best ? { x: best.x, y: best.y, r: 46 } : null;
}

// The shrine on screen nearest the middle, with its arch and dock both in the light.
function shrineSpot(river) {
  const mid = (f) => f.wy + river.scroll - 58;
  const best = river.features.filter((f) => f.kind === 'shrine' && mid(f) > 40 && mid(f) < H - 60).sort((p, q) => Math.abs(mid(p) - H / 2) - Math.abs(mid(q) - H / 2))[0];
  return best ? { x: best.x + Math.sign(best.tip - best.x) * 20, y: mid(best), r: 110 } : null;
}

// A square of dim with a soft round hole in it, stretched to the spotlight's size.
function makeHoleTexture(scene) {
  if (scene.textures.exists('tutorial_hole')) return;
  const tex = scene.textures.createCanvas('tutorial_hole', HOLE, HOLE), g = tex.getContext(), c = HOLE / 2;
  g.fillStyle = hexCss(DIM);
  g.fillRect(0, 0, HOLE, HOLE);
  g.globalCompositeOperation = 'destination-out';
  const soft = g.createRadialGradient(c, c, HOLE_R * 0.84, c, c, HOLE_R);
  soft.addColorStop(0, '#000');
  soft.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = soft;
  g.beginPath();
  g.arc(c, c, HOLE_R, 0, TAU);
  g.fill();
  tex.refresh();
}

import Phaser from 'phaser';
import { WIDTH as W, HEIGHT as H, GODS, COLORS, FONT, DISPLAY_FONT } from '../config.js';
import { onAction, isTouch } from '../controls.js';
import { unlockAudio, startAmbient, sfx } from '../sfx.js';
import { hexCss } from '../color.js';
import { formatMeters } from '../economy.js';
import { getSave } from '../save.js';

// Title card over the river running in attract mode. A click, tap or key starts a run
// (and unlocks audio, which browsers only allow after a user gesture).
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.started = false;
    this.add.rectangle(0, 0, W, H, 0x05040c, 0.5).setOrigin(0);
    this.add
      .text(W / 2, 176, 'Soul Drift', { fontFamily: DISPLAY_FONT, fontSize: '124px', fontStyle: 'italic 600', color: '#f3eefe' })
      .setOrigin(0.5)
      .setShadow(0, 0, '#9670ff', 30, true, true);
    this.add.text(W / 2, 262, 'Ferry the dead. Keep the gods happy.', { fontFamily: DISPLAY_FONT, fontSize: '30px', fontStyle: 'italic 500', color: COLORS.text }).setOrigin(0.5);
    GODS.forEach((god, i) => {
      const x = W / 2 + (i - 1) * 180;
      this.add.image(x - 46, 334, `soul_${god.key}`);
      this.add.text(x - 22, 334, god.name, { fontFamily: DISPLAY_FONT, fontSize: '26px', fontStyle: 'italic 600', color: hexCss(god.color) }).setOrigin(0, 0.5);
    });
    const touch = isTouch();
    [
      touch ? 'Slide a thumb anywhere to steer' : 'Steer with WASD, ZQSD or the arrow keys',
      'Touch a soul to take it aboard',
      "Dock at its god's shrine before it burns out",
      'Missed souls anger their god. A full rage bar puts out one of your lanterns',
    ].forEach((line, i) => this.add.text(W / 2, 400 + i * 30, line, { fontFamily: FONT, fontSize: '18px', color: COLORS.dim }).setOrigin(0.5));
    const play = this.add.text(W / 2, 572, touch ? 'Tap to play' : 'Click or press Space to play', { fontFamily: FONT, fontSize: '22px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5);
    this.tweens.add({ targets: play, alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });
    const { best, souls } = getSave(); // remembered on this device
    if (best) {
      this.add
        .text(W / 2, 628, `Your best ${formatMeters(best.distance)}  ·  ${souls.toLocaleString('en-US')} soul${souls === 1 ? '' : 's'} ferried`, { fontFamily: FONT, fontSize: '16px', fontStyle: '600', color: '#f1e6c8' })
        .setOrigin(0.5)
        .setAlpha(0.8);
    }
    if (new URLSearchParams(location.search).has('debug')) this.addStatusBadge();

    onAction(this, (action) => action === 'confirm' && this.start());
    // On release, not press: phones only allow sound and fullscreen from the end of a tap.
    this.input.once('pointerup', (pointer) => this.start(pointer.wasTouch));
  }

  start(fullscreen = false) {
    if (this.started) return;
    this.started = true;
    unlockAudio();
    if (fullscreen) this.goFullscreen();
    startAmbient();
    sfx.tap();
    this.scene.stop();
    this.scene.get('River').scene.restart({ play: true });
  }

  // Android: fill the screen and stay sideways. iPhones can't, short of Add to Home Screen.
  goFullscreen() {
    const scale = this.scale;
    if (!scale.fullscreen.available || scale.isFullscreen) return;
    scale.once('enterfullscreen', () => screen.orientation?.lock?.('landscape')?.catch(() => {}));
    scale.startFullscreen();
  }

  // ?debug: is the server's AI and voice live, mocked, or offline? (v2 uses them.)
  addStatusBadge() {
    const ai = this.registry.get('ai') || { mode: 'offline' };
    const voice = this.registry.get('voice') || { mode: 'offline' };
    const aiLabel = {
      live: [`AI live · ${ai.model}`, COLORS.live],
      mock: ['AI mock · add GEMINI_API_KEY', COLORS.warn],
      offline: ['AI offline · is the server running?', COLORS.bad],
    }[ai.mode] || ['AI ?', COLORS.bad];
    const voiceLabel = {
      live: ['Voice live · Gradium', COLORS.live],
      mock: ['Voice mock · add GRADIUM_API_KEY', COLORS.warn],
      offline: ['Voice offline', COLORS.bad],
    }[voice.mode] || ['Voice ?', COLORS.bad];
    [aiLabel, voiceLabel].forEach(([text, color], i) => this.add.text(16, H - 60 + i * 26, text, { fontFamily: FONT, fontSize: '18px', color }).setAlpha(0.85));
  }
}

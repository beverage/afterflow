import Phaser from 'phaser';
import { WIDTH as W, HEIGHT as H, GODS, COLORS, FONT, DISPLAY_FONT } from '../config.js';
import { formatObols, formatMeters } from '../economy.js';
import { onAction, clearKeys } from '../controls.js';
import { toggleMute } from '../sfx.js';
import { hexCss } from '../color.js';
import { spaced } from '../ui.js';

// The run is over: the god whose rage filled up smote the boat. v2 adds their spoken verdict.
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data) {
    const god = GODS[data.god ?? 0];
    this.add.rectangle(0, 0, W, H, 0x05040c, 0.72).setOrigin(0);
    this.add.text(W / 2, 150, spaced('THE GODS HAVE SPOKEN'), { fontFamily: FONT, fontSize: '14px', fontStyle: '600', color: COLORS.dim }).setOrigin(0.5);
    this.add
      .text(W / 2, 218, `${god.name} smote you.`, { fontFamily: DISPLAY_FONT, fontSize: '78px', fontStyle: 'italic 600', color: hexCss(god.color) })
      .setOrigin(0.5)
      .setShadow(0, 0, hexCss(god.color), 24, true, true);
    const stats = [
      ['DISTANCE', formatMeters(data.distance)],
      ['SOULS DELIVERED', String(data.delivered)],
      ['OBOLS EARNED', formatObols(data.earned)],
      ['BEST STREAK', String(data.bestStreak)],
      ['CLUTCHES', String(data.clutches)],
    ];
    stats.forEach(([label, value], i) => {
      const x = W / 2 + (i - 2) * 200;
      this.add.text(x, 336, value, { fontFamily: FONT, fontSize: '34px', fontStyle: '600', color: COLORS.text }).setOrigin(0.5);
      this.add.text(x, 372, spaced(label), { fontFamily: FONT, fontSize: '11px', fontStyle: '600', color: COLORS.dim }).setOrigin(0.5);
    });
    const again = this.add.text(W / 2, 500, 'Press Space to drift again', { fontFamily: DISPLAY_FONT, fontSize: '34px', fontStyle: 'italic 600', color: '#ffffff' }).setOrigin(0.5);
    this.tweens.add({ targets: again, alpha: 0.35, duration: 800, yoyo: true, repeat: -1 });

    // Short delay so the key that was held when you died doesn't restart instantly.
    this.ready = false;
    this.time.delayedCall(800, () => (this.ready = true));
    onAction(this, (action) => {
      if (action === 'confirm' && this.ready) this.restart();
      else if (action === 'mute') toggleMute();
    });
    this.input.on('pointerdown', () => this.ready && this.restart());
  }

  restart() {
    clearKeys();
    this.scene.stop();
    this.scene.get('River').scene.restart({ play: true });
  }
}

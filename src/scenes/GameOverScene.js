import Phaser from 'phaser';
import { WIDTH as W, HEIGHT as H, GODS, TUNING, COLORS, FONT, DISPLAY_FONT } from '../config.js';
import { formatObols, formatMeters } from '../economy.js';
import { onAction, clearKeys, isTouch } from '../controls.js';
import { sfx, toggleMute } from '../sfx.js';
import { hexCss } from '../color.js';
import { spaced } from '../ui.js';

// The last lantern is out: the god whose rage filled up smote the boat. Charon offers to take you back
// for a fee (1, or a click or tap on his offer); Space or a tap anywhere else starts a fresh run.
// v2 adds the god's spoken verdict.
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data) {
    const god = GODS[data.god ?? 0];
    const touch = isTouch();
    this.add.rectangle(0, 0, W, H, 0x05040c, 0.72).setOrigin(0);
    this.add.text(W / 2, 150, spaced('THE GODS HAVE SPOKEN'), { fontFamily: FONT, fontSize: '14px', fontStyle: '600', color: COLORS.dim }).setOrigin(0.5);
    this.add
      .text(W / 2, 218, `${god.name} smote you.`, { fontFamily: DISPLAY_FONT, fontSize: '78px', fontStyle: 'italic 600', color: hexCss(god.color) })
      .setOrigin(0.5)
      .setShadow(0, 0, hexCss(god.color), 24, true, true);
    this.addBestLine(data);
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
    this.fee = data.fee;
    this.canPay = data.fee > 0 && data.obols >= data.fee;
    this.feeZone = this.feeText = null; // the scene object is reused from one game over to the next
    if (data.fee > 0) this.addFeeOffer(data, touch);
    const again = this.add
      .text(W / 2, data.fee > 0 ? 548 : 500, touch ? 'Tap to drift again' : 'Press Space to drift again', { fontFamily: DISPLAY_FONT, fontSize: this.canPay ? '26px' : '34px', fontStyle: 'italic 600', color: '#ffffff' })
      .setOrigin(0.5);
    this.tweens.add({ targets: again, alpha: 0.35, duration: 800, yoyo: true, repeat: -1 });

    // Short delay so the key that was held when you died doesn't restart instantly.
    this.ready = false;
    this.time.delayedCall(800, () => (this.ready = true));
    onAction(this, (action) => {
      if (action === 'confirm' && this.ready) this.restart();
      else if (action === 'buy1' && this.ready) this.payFee();
      else if (action === 'mute') toggleMute();
    });
    this.input.on('pointerdown', (_pointer, over) => {
      if (!this.ready) return;
      if (this.feeZone && over.includes(this.feeZone)) this.payFee();
      else this.restart();
    });
  }

  // How this run compares with your best on this device: a new best, the first mark, or how far short.
  addBestLine({ distance, previousBest = 0 }) {
    const y = 284;
    if (distance > previousBest) {
      const text = previousBest ? `New best: ${formatMeters(distance)}` : `Your mark on the river: ${formatMeters(distance)}. Beat it next time`;
      this.add.text(W / 2, y, text, { fontFamily: DISPLAY_FONT, fontSize: '28px', fontStyle: 'italic 600', color: '#ffe6aa' }).setOrigin(0.5).setShadow(0, 0, '#ffc478', 14, true, true);
      return;
    }
    const short = previousBest - distance;
    const text = short < TUNING.pxPerMeter ? `Just short of your best, ${formatMeters(previousBest)}` : `${formatMeters(short)} short of your best, ${formatMeters(previousBest)}`;
    this.add.text(W / 2, y, text, { fontFamily: FONT, fontSize: '18px', color: COLORS.dim }).setOrigin(0.5);
  }

  // Charon's offer: one row, "Pay Charon (obol) 200 to return", in a button. Out of reach, it says what you'd need.
  addFeeOffer(data, touch) {
    const y = 452, gold = '#f1e6c8';
    if (!this.canPay) {
      this.feeText = this.add
        .text(W / 2, y, `Charon would take you back for ${formatObols(data.fee)} obols. You have ${formatObols(data.obols)}.`, { fontFamily: FONT, fontSize: '18px', color: COLORS.dim })
        .setOrigin(0.5);
      return;
    }
    const box = this.add.graphics(); // created first so it draws under the row
    const words = { fontFamily: DISPLAY_FONT, fontSize: '30px', fontStyle: 'italic 600', color: gold };
    const parts = [
      this.add.text(0, y, 'Pay Charon', words).setOrigin(0, 0.5),
      this.add.image(0, y + 1, 'obol').setScale(0.6),
      this.add.text(0, y, formatObols(data.fee), { fontFamily: FONT, fontSize: '26px', fontStyle: '600', color: gold }).setOrigin(0, 0.5),
      this.add.text(0, y, 'to return', words).setOrigin(0, 0.5),
    ];
    const gaps = [14, 8, 14];
    const rowW = parts.reduce((sum, p) => sum + p.displayWidth, 0) + gaps.reduce((a, b) => a + b, 0);
    let x = W / 2 - rowW / 2;
    parts.forEach((p, i) => {
      p.x = p.type === 'Image' ? x + p.displayWidth / 2 : x;
      x += p.displayWidth + (gaps[i] ?? 0);
    });
    const w = rowW + 72, h = 64, left = W / 2 - w / 2, top = y - h / 2;
    box.fillStyle(0x16201c, 0.95).fillRoundedRect(left, top, w, h, 14);
    box.lineStyle(1.5, 0xf1e6c8, 0.55).strokeRoundedRect(left, top, w, h, 14);
    if (!touch) {
      this.add.text(left + w - 10, top + 10, '1', { fontFamily: FONT, fontSize: '13px', fontStyle: '600', color: '#0b100e', backgroundColor: '#dce6e2', padding: { x: 6, y: 2 } }).setOrigin(1, 0);
    }
    this.feeZone = this.add.zone(W / 2, y, w, h).setInteractive({ useHandCursor: true });
  }

  payFee() {
    if (!this.canPay) {
      sfx.cantAfford();
      if (this.feeText) this.tweens.add({ targets: this.feeText, x: '+=6', duration: 45, yoyo: true, repeat: 2 });
      return;
    }
    clearKeys();
    sfx.buy();
    const river = this.scene.get('River');
    river.run.obols -= this.fee;
    this.scene.stop();
    river.revive();
  }

  restart() {
    clearKeys();
    this.scene.stop();
    this.scene.get('River').scene.restart({ play: true });
  }
}

import Phaser from 'phaser';
import { WIDTH as W, HEIGHT as H, UPGRADES, FONT, DISPLAY_FONT } from '../config.js';
import { price, formatObols } from '../economy.js';
import { onAction, clearKeys } from '../controls.js';
import { sfx, toggleMute } from '../sfx.js';
import { drawMeander } from '../ui.js';

// Hermes' stall: opens over the paused river when the boat docks at a shop.
// Buy with 1 / 2 / 3 or a click, cast off with Space or Esc.
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create() {
    this.river = this.scene.get('River');
    const pw = 780, ph = 440, px = (W - pw) / 2, py = (H - ph) / 2;
    this.add.rectangle(0, 0, W, H, 0x05040c, 0.62).setOrigin(0);
    const g = this.add.graphics();
    g.fillStyle(0x0b100e, 0.95).fillRoundedRect(px, py, pw, ph, 14);
    g.lineStyle(1, 0xdce6e2, 0.16).strokeRoundedRect(px, py, pw, ph, 14);
    drawMeander(g, px + 24, py + 16, pw - 48, 2);
    this.add.text(W / 2, py + 66, "Hermes' Stall", { fontFamily: DISPLAY_FONT, fontSize: '46px', fontStyle: 'italic 600', color: '#f1e6c8' }).setOrigin(0.5);
    this.add.text(W / 2, py + 104, 'Spend your obols. The river waits.', { fontFamily: FONT, fontSize: '16px', color: '#97aaa2' }).setOrigin(0.5);
    this.add.image(px + pw - 150, py + 66, 'obol').setScale(0.7);
    this.obolText = this.add.text(px + pw - 128, py + 66, '', { fontFamily: FONT, fontSize: '26px', fontStyle: '600', color: '#f1e6c8' }).setOrigin(0, 0.5);
    this.cards = UPGRADES.map((u, i) => this.makeCard(u, i, W / 2 + (i - 1) * 244, py + 262));
    const leave = this.add
      .text(W / 2, py + ph - 30, 'Space or Esc to cast off', { fontFamily: FONT, fontSize: '16px', fontStyle: '600', color: '#dce6e2' })
      .setOrigin(0.5)
      .setAlpha(0.75)
      .setInteractive({ useHandCursor: true });
    leave.on('pointerdown', () => this.close());

    onAction(this, (action) => {
      if (action === 'buy1') this.buy(0);
      else if (action === 'buy2') this.buy(1);
      else if (action === 'buy3') this.buy(2);
      else if (action === 'confirm' || action === 'pause') this.close();
      else if (action === 'mute') toggleMute();
    });
    this.refresh();
  }

  makeCard(u, i, x, y) {
    const w = 224, h = 236;
    const card = { u, i, x, y, w, h, hover: false };
    card.bg = this.add.graphics();
    card.icon = this.add.image(x, y - 66, u.icon).setScale(0.7);
    card.name = this.add.text(x, y - 16, u.name, { fontFamily: DISPLAY_FONT, fontSize: '30px', fontStyle: 'italic 600', color: '#e6eeea' }).setOrigin(0.5);
    card.level = this.add.text(x, y + 12, '', { fontFamily: FONT, fontSize: '13px', fontStyle: '600', color: '#97aaa2' }).setOrigin(0.5);
    card.desc = this.add.text(x, y + 46, u.desc, { fontFamily: FONT, fontSize: '14px', color: '#97aaa2', align: 'center', wordWrap: { width: w - 36 } }).setOrigin(0.5);
    card.coin = this.add.image(x - 32, y + 92, 'obol').setScale(0.55);
    card.cost = this.add.text(x - 16, y + 92, '', { fontFamily: FONT, fontSize: '22px', fontStyle: '600', color: '#f1e6c8' }).setOrigin(0, 0.5);
    this.add
      .text(x + w / 2 - 12, y - h / 2 + 12, String(i + 1), { fontFamily: FONT, fontSize: '13px', fontStyle: '600', color: '#0b100e', backgroundColor: '#dce6e2', padding: { x: 6, y: 2 } })
      .setOrigin(1, 0);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      card.hover = true;
      this.drawCard(card);
    });
    zone.on('pointerout', () => {
      card.hover = false;
      this.drawCard(card);
    });
    zone.on('pointerdown', () => this.buy(i));
    return card;
  }

  drawCard(c) {
    const left = c.x - c.w / 2, top = c.y - c.h / 2;
    c.bg.clear();
    c.bg.fillStyle(0x16201c, c.hover ? 1 : 0.8).fillRoundedRect(left, top, c.w, c.h, 12);
    c.bg.lineStyle(1.5, c.affordable ? 0xf1e6c8 : 0xdce6e2, c.affordable ? 0.5 : 0.12).strokeRoundedRect(left, top, c.w, c.h, 12);
  }

  refresh() {
    const r = this.river;
    this.obolText.setText(formatObols(r.run.obols));
    for (const c of this.cards) {
      const lvl = r.levels[c.u.key], maxed = lvl >= c.u.maxLevel, cost = price(c.u, lvl);
      c.affordable = !maxed && r.run.obols >= cost;
      c.level.setText(maxed ? `Level ${lvl} · max` : `Level ${lvl} → ${lvl + 1}`);
      c.cost.setText(maxed ? 'Sold out' : formatObols(cost)).setColor(c.affordable ? '#f1e6c8' : '#857c84');
      c.coin.setVisible(!maxed);
      c.icon.setAlpha(maxed ? 0.4 : 1);
      this.drawCard(c);
    }
  }

  buy(i) {
    const c = this.cards[i], r = this.river, lvl = r.levels[c.u.key];
    const cost = price(c.u, lvl);
    if (lvl >= c.u.maxLevel || r.run.obols < cost) {
      sfx.cantAfford();
      this.tweens.add({ targets: [c.icon, c.name], x: '+=6', duration: 45, yoyo: true, repeat: 2 });
      return;
    }
    r.run.obols -= cost;
    r.levels[c.u.key] += 1;
    r.applyLevels();
    sfx.buy();
    this.tweens.add({ targets: c.icon, scale: { from: 0.95, to: 0.7 }, duration: 280, ease: 'Back.easeOut' });
    this.refresh();
  }

  close() {
    sfx.tap();
    clearKeys();
    this.scene.stop();
    this.scene.resume('River');
  }
}

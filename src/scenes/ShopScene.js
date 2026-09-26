import Phaser from 'phaser';
import { WIDTH as W, HEIGHT as H, UPGRADES, GODS, SCROLLS, FONT, DISPLAY_FONT } from '../config.js';
import { price, scrollPrice, formatObols } from '../economy.js';
import { onAction, clearKeys, isTouch } from '../controls.js';
import { sfx, toggleMute } from '../sfx.js';
import { canListen } from '../listen.js';
import { hexCss, lighten } from '../color.js';
import { drawMeander } from '../ui.js';

const KEYS = ['buy1', 'buy2', 'buy3', 'buy4', 'buy5', 'buy6'];

// Hermes' stall: opens over the paused river when the boat docks at a shop. Two rows of three:
// upgrades on top, one scroll per god below. Buy with 1-6 or a click or tap, cast off with Space, Esc or the button.
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create() {
    this.river = this.scene.get('River');
    this.touch = isTouch();
    // Clicks and taps count after a moment, so a thumb that was steering as you docked can't buy or cast off.
    this.armed = false;
    this.time.delayedCall(400, () => (this.armed = true));
    const pw = 800, ph = 600, px = (W - pw) / 2, py = (H - ph) / 2;
    this.add.rectangle(0, 0, W, H, 0x05040c, 0.62).setOrigin(0);
    const g = this.add.graphics();
    g.fillStyle(0x0b100e, 0.95).fillRoundedRect(px, py, pw, ph, 14);
    g.lineStyle(1, 0xdce6e2, 0.16).strokeRoundedRect(px, py, pw, ph, 14);
    drawMeander(g, px + 24, py + 16, pw - 48, 2);
    this.add.text(W / 2, py + 58, "Hermes' Stall", { fontFamily: DISPLAY_FONT, fontSize: '44px', fontStyle: 'italic 600', color: '#f1e6c8' }).setOrigin(0.5);
    this.add.text(W / 2, py + 94, 'Spend your obols. The river waits.', { fontFamily: FONT, fontSize: '16px', color: '#97aaa2' }).setOrigin(0.5);
    this.add.image(px + pw - 150, py + 58, 'obol').setScale(0.7);
    this.obolText = this.add.text(px + pw - 128, py + 58, '', { fontFamily: FONT, fontSize: '26px', fontStyle: '600', color: '#f1e6c8' }).setOrigin(0, 0.5);
    const col = (i) => W / 2 + (i - 1) * 252, top = py + 216;
    this.cards = [
      ...UPGRADES.map((u, i) => this.makeUpgradeCard(u, i, col(i), top)),
      ...GODS.map((god, i) => this.makeScrollCard(god, i, col(i), top + 200)),
    ];
    this.hintText = this.add.text(W / 2, py + ph - 70, '', { fontFamily: FONT, fontSize: '15px', color: '#97aaa2', align: 'center' }).setOrigin(0.5);
    const ly = py + ph - 32;
    if (this.touch) {
      g.lineStyle(1.5, 0xdce6e2, 0.35).strokeRoundedRect(W / 2 - 100, ly - 21, 200, 42, 21);
      this.add.text(W / 2, ly, 'Cast off', { fontFamily: FONT, fontSize: '20px', fontStyle: '600', color: '#dce6e2' }).setOrigin(0.5);
    } else {
      this.add.text(W / 2, ly, 'Space or Esc to cast off', { fontFamily: FONT, fontSize: '16px', fontStyle: '600', color: '#dce6e2' }).setOrigin(0.5).setAlpha(0.75);
    }
    this.add
      .zone(W / 2, ly, 300, 44)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.armed && this.close());

    onAction(this, (action) => {
      const i = KEYS.indexOf(action);
      if (i >= 0) this.buy(i);
      else if (action === 'confirm' || action === 'pause') this.close();
      else if (action === 'mute') toggleMute();
    });
    this.refresh();
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.refresh() }); // the mic answer arrives later
  }

  makeCard(i, x, y, h) {
    const w = 232;
    const card = { i, x, y, w, h, hover: false };
    card.bg = this.add.graphics();
    if (!this.touch) {
      this.add
        .text(x + w / 2 - 10, y - h / 2 + 10, String(i + 1), { fontFamily: FONT, fontSize: '13px', fontStyle: '600', color: '#0b100e', backgroundColor: '#dce6e2', padding: { x: 6, y: 2 } })
        .setOrigin(1, 0)
        .setDepth(1);
    }
    card.coin = this.add.image(x - 32, y + h / 2 - 22, 'obol').setScale(0.5);
    card.cost = this.add.text(x - 16, y + h / 2 - 22, '', { fontFamily: FONT, fontSize: '21px', fontStyle: '600', color: '#f1e6c8' }).setOrigin(0, 0.5);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      card.hover = true;
      this.drawCard(card);
    });
    zone.on('pointerout', () => {
      card.hover = false;
      this.drawCard(card);
    });
    zone.on('pointerdown', () => this.armed && this.buy(i));
    return card;
  }

  makeUpgradeCard(u, i, x, y) {
    const card = this.makeCard(i, x, y, 188);
    card.u = u;
    card.icon = this.add.image(x, y - 58, u.icon).setScale(0.46);
    card.name = this.add.text(x, y - 18, u.name, { fontFamily: DISPLAY_FONT, fontSize: '27px', fontStyle: 'italic 600', color: '#e6eeea' }).setOrigin(0.5);
    card.level = this.add.text(x, y + 6, '', { fontFamily: FONT, fontSize: '13px', fontStyle: '600', color: '#97aaa2' }).setOrigin(0.5);
    card.desc = this.add.text(x, y + 20, u.desc, { fontFamily: FONT, fontSize: '13px', color: '#97aaa2', align: 'center', wordWrap: { width: 200 } }).setOrigin(0.5, 0);
    return card;
  }

  makeScrollCard(god, i, x, y) {
    const card = this.makeCard(i + 3, x, y, 188);
    const light = hexCss(lighten(god.color, 0.3));
    card.god = i;
    card.icon = this.add.image(x, y - 58, `scroll_${god.key}`).setScale(0.72);
    card.name = this.add.text(x, y - 20, `${god.name}${god.name.endsWith('s') ? "'" : "'s"} scroll`, { fontFamily: DISPLAY_FONT, fontSize: '25px', fontStyle: 'italic 600', color: light }).setOrigin(0.5);
    card.desc = this.add
      .text(x, y + 2, `Say its words aloud to calm ${god.name}: ${Math.round(SCROLLS.calm * 100)}% less rage`, { fontFamily: FONT, fontSize: '13px', color: '#97aaa2', align: 'center', wordWrap: { width: 196 } })
      .setOrigin(0.5, 0);
    card.words = this.add
      .text(x, y + 22, '', { fontFamily: DISPLAY_FONT, fontSize: '22px', fontStyle: 'italic 600', color: '#ffffff', align: 'center', wordWrap: { width: 204 } })
      .setOrigin(0.5)
      .setShadow(0, 0, hexCss(god.color), 10, true, true);
    card.carried = this.add.text(x, y + 72, 'Carried · say it on the river', { fontFamily: FONT, fontSize: '13px', fontStyle: '600', color: light }).setOrigin(0.5);
    return card;
  }

  drawCard(c) {
    const left = c.x - c.w / 2, top = c.y - c.h / 2;
    const edge = c.god !== undefined && this.river.run.scrolls[c.god] ? GODS[c.god].color : c.affordable ? 0xf1e6c8 : 0xdce6e2;
    c.bg.clear();
    c.bg.fillStyle(0x16201c, c.hover ? 1 : 0.8).fillRoundedRect(left, top, c.w, c.h, 12);
    c.bg.lineStyle(1.5, edge, c.affordable || edge !== 0xdce6e2 ? 0.5 : 0.12).strokeRoundedRect(left, top, c.w, c.h, 12);
  }

  refresh() {
    const r = this.river;
    this.obolText.setText(formatObols(r.run.obols));
    for (const c of this.cards) {
      if (c.u) {
        const lvl = r.levels[c.u.key], maxed = lvl >= c.u.maxLevel, cost = price(c.u, lvl);
        c.affordable = !maxed && r.run.obols >= cost;
        c.level.setText(maxed ? `Level ${lvl} · max` : `Level ${lvl} → ${lvl + 1}`);
        c.cost.setText(maxed ? 'Sold out' : formatObols(cost)).setColor(c.affordable ? '#f1e6c8' : '#857c84');
        c.coin.setVisible(!maxed);
        c.icon.setAlpha(maxed ? 0.4 : 1);
      } else {
        const words = r.run.scrolls[c.god], cost = scrollPrice(r.scroll);
        c.affordable = !words && r.run.obols >= cost;
        c.desc.setVisible(!words);
        c.words.setVisible(Boolean(words)).setText(words ? `“${words}”` : '');
        c.carried.setVisible(Boolean(words));
        c.cost.setVisible(!words).setText(formatObols(cost)).setColor(c.affordable ? '#f1e6c8' : '#857c84');
        c.coin.setVisible(!words);
      }
      this.drawCard(c);
    }
    const carrying = r.run.scrolls.some(Boolean);
    const read = this.touch ? 'Tap the scrolls panel' : 'Space';
    this.hintText.setText(
      canListen()
        ? `One scroll per god. On the river, say its words aloud to use it.\n${read} shows your scrolls, but the river won't wait while you read.`
        : `No mic here: on the river, ${this.touch ? 'tap the scrolls panel, then a scroll' : 'press Space, then 1, 2 or 3'} to read one.`,
    ).setAlpha(carrying || canListen() ? 1 : 0.8);
  }

  buy(i) {
    const c = this.cards[i];
    if (!c) return;
    if (c.u) this.buyUpgrade(c);
    else this.buyScroll(c);
  }

  refuse(c) {
    sfx.cantAfford();
    this.tweens.add({ targets: [c.icon, c.name], x: '+=6', duration: 45, yoyo: true, repeat: 2 });
  }

  buyUpgrade(c) {
    const r = this.river, lvl = r.levels[c.u.key];
    const cost = price(c.u, lvl);
    if (lvl >= c.u.maxLevel || r.run.obols < cost) return this.refuse(c);
    r.run.obols -= cost;
    r.levels[c.u.key] += 1;
    r.applyLevels();
    sfx.buy();
    this.tweens.add({ targets: c.icon, scale: { from: 0.66, to: 0.46 }, duration: 280, ease: 'Back.easeOut' });
    this.refresh();
  }

  buyScroll(c) {
    const r = this.river, cost = scrollPrice(r.scroll);
    if (r.run.scrolls[c.god] || r.run.obols < cost) return this.refuse(c);
    r.run.obols -= cost;
    r.takeScroll(c.god); // also asks for the mic the first time, while the game is paused
    sfx.buy();
    this.tweens.add({ targets: c.icon, scale: { from: 0.95, to: 0.72 }, duration: 280, ease: 'Back.easeOut' });
    this.refresh();
    this.tweens.add({ targets: c.words, scale: { from: 1.25, to: 1 }, alpha: { from: 0, to: 1 }, duration: 420, ease: 'Back.easeOut' });
  }

  close() {
    sfx.tap();
    clearKeys();
    this.scene.stop();
    this.scene.resume('River');
  }
}

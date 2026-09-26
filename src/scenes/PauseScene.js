import Phaser from 'phaser';
import { WIDTH as W, HEIGHT as H, COLORS, FONT, DISPLAY_FONT } from '../config.js';
import { onAction, clearKeys } from '../controls.js';
import { toggleMute } from '../sfx.js';

// Shown over the paused river on Esc / P, or when the window loses focus.
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    this.add.rectangle(0, 0, W, H, 0x05040c, 0.6).setOrigin(0);
    this.add.text(W / 2, H / 2 - 30, 'Paused', { fontFamily: DISPLAY_FONT, fontSize: '76px', fontStyle: 'italic 600', color: COLORS.text }).setOrigin(0.5);
    this.muteText = this.add.text(W / 2, H / 2 + 40, 'Esc or P to resume · M to mute', { fontFamily: FONT, fontSize: '18px', color: COLORS.dim }).setOrigin(0.5);
    onAction(this, (action) => {
      if (action === 'pause' || action === 'confirm') this.resume();
      else if (action === 'mute') this.muteText.setText(toggleMute() ? 'Sound off · M to unmute' : 'Sound on · M to mute');
    });
    this.input.once('pointerdown', () => this.resume());
  }

  resume() {
    clearKeys();
    this.scene.stop();
    this.scene.resume('River');
  }
}

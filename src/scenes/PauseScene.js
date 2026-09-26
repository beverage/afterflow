import Phaser from 'phaser';
import { WIDTH as W, HEIGHT as H, COLORS, FONT, DISPLAY_FONT } from '../config.js';
import { onAction, clearKeys, isTouch } from '../controls.js';
import { toggleMute, isMuted } from '../sfx.js';

// Shown over the paused river on Esc / P or the pause button, or when the player looks away.
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    const touch = isTouch();
    this.add.rectangle(0, 0, W, H, 0x05040c, 0.6).setOrigin(0);
    this.add.text(W / 2, H / 2 - 30, 'Paused', { fontFamily: DISPLAY_FONT, fontSize: '76px', fontStyle: 'italic 600', color: COLORS.text }).setOrigin(0.5);
    this.muteText = this.add.text(W / 2, H / 2 + 40, touch ? 'Tap to resume' : 'Esc or P to resume · M to mute', { fontFamily: FONT, fontSize: '18px', color: COLORS.dim }).setOrigin(0.5);
    // No M key on a phone: a sound button instead, and a tap anywhere else resumes.
    const sound = touch && this.add.text(W / 2, H / 2 + 120, isMuted() ? 'Sound off' : 'Sound on', { fontFamily: FONT, fontSize: '20px', fontStyle: '600', color: COLORS.text, backgroundColor: 'rgba(8,11,10,0.62)', padding: { x: 24, y: 12 } }).setOrigin(0.5);
    const mute = () => {
      const off = toggleMute();
      if (sound) sound.setText(off ? 'Sound off' : 'Sound on');
      else this.muteText.setText(off ? 'Sound off · M to unmute' : 'Sound on · M to mute');
    };
    if (sound) this.add.zone(W / 2, H / 2 + 120, 240, 90).setInteractive().on('pointerdown', mute);
    onAction(this, (action) => {
      if (action === 'pause' || action === 'confirm') this.resume();
      else if (action === 'mute') mute();
    });
    this.input.on('pointerdown', (_pointer, over) => over.length || this.resume());
  }

  resume() {
    clearKeys();
    this.scene.stop();
    this.scene.resume('River');
  }
}

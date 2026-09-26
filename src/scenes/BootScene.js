import Phaser from 'phaser';
import { IMAGES, AUDIO } from '../assets.js';
import { getAIStatus } from '../ai.js';
import { getVoiceStatus } from '../voice.js';

// Loads everything in the asset manifest, checks whether AI and voice are live, then starts the game.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, 404, 16).setStrokeStyle(2, 0xffffff, 0.4);
    const bar = this.add.rectangle(width / 2 - 200, height / 2, 0, 12, 0xffffff).setOrigin(0, 0.5);
    this.load.on('progress', (p) => (bar.width = 400 * p));

    for (const [key, path] of Object.entries(IMAGES)) this.load.image(key, path);
    for (const [key, path] of Object.entries(AUDIO)) this.load.audio(key, path);
  }

  create() {
    Promise.all([getAIStatus(), getVoiceStatus()]).then(([ai, voice]) => {
      this.registry.set('ai', ai); // read by the in-game status badge
      this.registry.set('voice', voice);
      this.scene.start('Game');
    });
  }
}

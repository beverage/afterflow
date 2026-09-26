import Phaser from 'phaser';
import { IMAGES, SHEETS, AUDIO } from '../assets.js';
import { PORTAL } from '../config.js';
import { getAIStatus } from '../ai.js';
import { getVoiceStatus } from '../voice.js';
import { makeArt } from '../art.js';

// Loads whatever real art is in the manifest, draws placeholders for the rest,
// waits (briefly) for the web fonts, then starts the river behind the title.
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
    for (const [key, s] of Object.entries(SHEETS)) this.load.spritesheet(key, s.path, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    for (const [key, path] of Object.entries(AUDIO)) this.load.audio(key, path);
  }

  create() {
    makeArt(this);
    // One looping animation per portal sheet that loaded, named after its texture.
    for (const key of Object.keys(SHEETS)) {
      if (this.textures.exists(key) && !this.anims.exists(key)) {
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(key, { start: 0, end: PORTAL.frames - 1 }), frameRate: PORTAL.fps, repeat: -1 });
      }
    }
    // Not needed in v1, but the ?debug badge shows whether AI and voice are ready for v2.
    getAIStatus().then((ai) => this.registry.set('ai', ai));
    getVoiceStatus().then((voice) => this.registry.set('voice', voice));
    fontsReady().then(() => this.scene.start('River'));
  }
}

// Canvas text only uses a web font once it has loaded, so wait for it (but never more than 2.5 s).
function fontsReady() {
  if (!document.fonts?.load) return Promise.resolve();
  const faces = ["italic 600 64px 'Cormorant Garamond'", "italic 500 32px 'Cormorant Garamond'", "400 18px 'Source Sans 3'", "600 18px 'Source Sans 3'"];
  const loaded = Promise.all(faces.map((f) => document.fonts.load(f))).catch(() => {});
  return Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 2500))]);
}

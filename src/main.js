import Phaser from 'phaser';
import { WIDTH, HEIGHT, COLORS } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { RiverScene } from './scenes/RiverScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: COLORS.bg,
  // Fullscreen takes the whole page, so the touch ring and "turn your phone sideways" still show.
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, fullscreenTarget: document.documentElement },
  input: { activePointers: 3 }, // steer with one thumb, tap pause with the other
  scene: [BootScene, RiverScene, TitleScene, ShopScene, PauseScene, GameOverScene], // later scenes draw on top
});

window.game = game; // handy in the console: game.scene.getScene('River')

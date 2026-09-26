import Phaser from 'phaser';
import { WIDTH, HEIGHT, COLORS } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

const debug = new URLSearchParams(location.search).has('debug'); // add ?debug to see hitboxes

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: COLORS.bg,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug } },
  input: { activePointers: 2 },
  scene: [BootScene, GameScene, GameOverScene], // later scenes draw on top
});

window.game = game; // handy in the console: game.scene.getScene('Game')

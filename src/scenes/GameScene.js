import Phaser from 'phaser';
import { COLORS, FONT, TUNING } from '../config.js';
import { stopSpeaking } from '../voice.js';

// EXAMPLE LOOP: a one-thumb dodge game, here to prove the plumbing works end to end
// (input, physics, spawning, score, game over, AI call). Replace it with your game.
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    const { width, height } = this.scale;
    stopSpeaking(); // cut off the last run's game-over line
    this.elapsed = 0;
    this.score = 0;
    this.over = false;
    this.nextSpawnMs = 400;
    this.targetX = width / 2;

    this.player = this.physics.add.image(width / 2, TUNING.playerY, 'player');
    this.player.body.setSize(this.player.width * 0.7, this.player.height * 0.7); // forgiving hitbox
    this.player.setCollideWorldBounds(true);

    this.hazards = this.physics.add.group();
    this.physics.add.overlap(this.player, this.hazards, () => this.gameOver());

    // One-thumb control: touch or drag anywhere, the player follows your finger.
    this.input.on('pointerdown', (p) => (this.targetX = p.x));
    this.input.on('pointermove', (p) => p.isDown && (this.targetX = p.x));
    this.cursors = this.input.keyboard?.createCursorKeys(); // desktop fallback

    this.scoreText = this.add
      .text(width / 2, 110, '0', { fontFamily: FONT, fontSize: '88px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5)
      .setDepth(10);

    const hint = this.add
      .text(width / 2, height * 0.46, 'Drag to dodge', { fontFamily: FONT, fontSize: '44px', color: COLORS.dim })
      .setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0, delay: 1400, duration: 500 });

    this.addAIBadge();
  }

  update(_time, delta) {
    if (this.over) return;
    const dt = delta / 1000;
    this.elapsed += dt;

    if (this.cursors?.left.isDown) this.targetX -= TUNING.keyboardSpeed * dt;
    if (this.cursors?.right.isDown) this.targetX += TUNING.keyboardSpeed * dt;
    this.targetX = Phaser.Math.Clamp(this.targetX, 0, this.scale.width);
    const follow = 1 - Math.pow(1 - TUNING.playerFollow, delta / (1000 / 60)); // frame-rate independent
    this.player.x = Phaser.Math.Linear(this.player.x, this.targetX, follow);

    this.nextSpawnMs -= delta;
    if (this.nextSpawnMs <= 0) {
      this.spawnHazard();
      this.nextSpawnMs = Math.max(TUNING.spawnEveryMinMs, TUNING.spawnEveryMs - this.elapsed * TUNING.spawnRampPerSec);
    }

    for (const h of this.hazards.getChildren().slice()) {
      if (h.y > this.scale.height + 80) {
        h.destroy();
        this.score += 1;
        this.scoreText.setText(String(this.score));
      }
    }
  }

  spawnHazard() {
    const x = Phaser.Math.Between(40, this.scale.width - 40);
    const h = this.hazards.create(x, -60, 'hazard');
    h.setCircle(h.width * 0.42, h.width * 0.08, h.height * 0.08); // round hitbox, slightly inset
    h.setVelocityY(TUNING.hazardSpeedStart + TUNING.hazardSpeedGrowth * this.elapsed);
    h.setAngularVelocity(Phaser.Math.Between(-200, 200));
  }

  gameOver() {
    if (this.over) return;
    this.over = true;
    this.physics.pause();
    this.player.setTint(0xff5a5a);
    this.cameras.main.shake(220, 0.012);
    this.time.delayedCall(380, () =>
      this.scene.launch('GameOver', { score: this.score, seconds: Math.floor(this.elapsed) }),
    );
  }

  // Small corner badge so nobody is surprised at demo time: live, mock mode, or offline.
  addAIBadge() {
    const ai = this.registry.get('ai') || { mode: 'offline' };
    const voice = this.registry.get('voice') || { mode: 'offline' };
    const aiLabel = {
      live: [`AI live · ${ai.model}`, COLORS.live],
      mock: ['AI mock · add GEMINI_API_KEY', COLORS.warn],
      offline: ['AI offline · is the server running?', COLORS.bad],
    }[ai.mode] || ['AI ?', COLORS.bad];
    const voiceLabel = {
      live: ['Voice live · Gradium', COLORS.live],
      mock: ['Voice mock · add GRADIUM_API_KEY', COLORS.warn],
      offline: ['Voice offline', COLORS.bad],
    }[voice.mode] || ['Voice ?', COLORS.bad];
    [aiLabel, voiceLabel].forEach(([text, color], i) =>
      this.add
        .text(16, 16 + i * 28, text, { fontFamily: FONT, fontSize: '22px', color })
        .setAlpha(0.85)
        .setDepth(20),
    );
  }
}

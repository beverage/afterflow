import Phaser from 'phaser';
import { askAI } from '../ai.js';
import { speak } from '../voice.js';
import { COLORS, FONT } from '../config.js';

// EXAMPLE AI HOOK: Gemini reviews the run and returns structured JSON { rank, comment },
// then Gradium reads the verdict out loud.
// The pattern to copy: draw a placeholder, call askAI with a fallback, fill in when it answers, then speak.
const RUN_REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    rank: { type: 'string', description: 'A funny rank title, 2 to 4 words' },
    comment: { type: 'string', description: 'One playful sentence about the run, 14 words max' },
  },
  required: ['rank', 'comment'],
};

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ score = 0, seconds = 0 } = {}) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const style = (size, color = COLORS.text, extra = {}) => ({ fontFamily: FONT, fontSize: `${size}px`, color, ...extra });

    this.add.rectangle(0, 0, width, height, 0x000000, 0.74).setOrigin(0);
    this.add.text(cx, height * 0.25, 'GAME OVER', style(64, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5);
    this.add.text(cx, height * 0.34, String(score), style(120, COLORS.accent, { fontStyle: 'bold' })).setOrigin(0.5);

    const rank = this.add.text(cx, height * 0.45, '…', style(46, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5);
    const comment = this.add
      .text(cx, height * 0.5, 'The AI is judging your run…', style(34, COLORS.dim, { align: 'center', wordWrap: { width: width * 0.82 } }))
      .setOrigin(0.5, 0);
    const source = this.add.text(cx, height * 0.64, '', style(22, COLORS.dim)).setOrigin(0.5).setAlpha(0.8);

    askAI({
      system: 'You are the snarky announcer of a tiny arcade game. Playful, never mean. No emojis.',
      prompt: `The player dodged ${score} falling hazards and survived ${seconds} seconds. Review the run.`,
      schema: RUN_REVIEW_SCHEMA,
      fallback: { rank: fallbackRank(score), comment: 'The AI stepped out, but we saw that. Respect.' },
    }).then(({ data, source: from }) => {
      if (!rank.active) return; // player already restarted
      rank.setText(data?.rank ?? '');
      comment.setText(data?.comment ?? '');
      source.setText({ ai: 'judged by Gemini', mock: 'mock AI (no key yet)', fallback: 'AI unavailable, fallback line' }[from]);
      speak(`${data?.rank ?? ''}. ${data?.comment ?? ''}`, { voice: 'narrator' }); // text stays on screen for muted phones
    });

    const again = this.add.text(cx, height * 0.8, 'Tap to play again', style(40, COLORS.text)).setOrigin(0.5);
    this.tweens.add({ targets: again, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    // Short delay so the tap that ended the run doesn't instantly restart it.
    this.time.delayedCall(450, () => {
      this.input.once('pointerdown', () => this.scene.start('Game'));
      this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('Game'));
    });
  }
}

function fallbackRank(score) {
  if (score >= 60) return 'Untouchable';
  if (score >= 30) return 'Certified Dodger';
  if (score >= 10) return 'Promising Rookie';
  return 'Brave Beginner';
}

// Tuning knobs live here so anyone (or any agent) can tweak feel without touching game logic.

// Portrait phone canvas; Phaser scales it to fit any screen (letterboxed on desktop).
export const WIDTH = 720;
export const HEIGHT = 1280;

export const COLORS = {
  bg: '#14121f',
  text: '#f8fafc',
  dim: '#94a3b8',
  accent: '#fde047',
  live: '#4ade80',
  warn: '#fbbf24',
  bad: '#f87171',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Example loop tuning (delete with the example).
export const TUNING = {
  playerY: 1090,
  playerFollow: 0.22, // 0..1 per frame at 60fps: how snappily the player follows your finger
  keyboardSpeed: 900, // px/s with arrow keys on desktop
  hazardSpeedStart: 430, // px/s
  hazardSpeedGrowth: 16, // px/s added per second survived
  spawnEveryMs: 620,
  spawnEveryMinMs: 240,
  spawnRampPerSec: 11, // ms shaved off the spawn interval per second survived
};

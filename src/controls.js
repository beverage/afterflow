// All input goes through here: a move vector plus named actions.
// Keys are read by physical position (event.code), so the WASD keys also work as ZQSD on
// French AZERTY keyboards. On a touch screen a floating stick steers: put a thumb down anywhere
// and slide. Add ?touch to the URL to try the phone controls on a laptop, dragging with the mouse.
import { STICK } from './config.js';

const MOVE = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

const ACTION_BY_CODE = {
  Escape: 'pause',
  KeyP: 'pause',
  KeyM: 'mute',
  KeyH: 'help',
  Space: 'confirm',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Digit1: 'buy1',
  Numpad1: 'buy1',
  Digit2: 'buy2',
  Numpad2: 'buy2',
  Digit3: 'buy3',
  Numpad3: 'buy3',
  Digit4: 'buy4',
  Numpad4: 'buy4',
  Digit5: 'buy5',
  Numpad5: 'buy5',
  Digit6: 'buy6',
  Numpad6: 'buy6',
};

const CAPTURE = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const GAME_KEYS = new Set([...Object.values(MOVE).flat(), ...Object.keys(ACTION_BY_CODE)]);
const FORCE_TOUCH = new URLSearchParams(location.search).has('touch');
const down = new Set();
const handlers = new Set();
let touch = FORCE_TOUCH || matchMedia('(pointer: coarse)').matches;

window.addEventListener('keydown', (e) => {
  if (CAPTURE.has(e.code)) e.preventDefault();
  if (GAME_KEYS.has(e.code)) touch = FORCE_TOUCH; // playing on keys: show key prompts
  down.add(e.code);
  const action = ACTION_BY_CODE[e.code];
  if (!action || e.repeat) return;
  // Only scenes running when the key went down hear it, so closing an overlay with Esc
  // doesn't also pause the scene underneath.
  const listening = [...handlers].filter((h) => h.scene.sys.isActive());
  listening.forEach((h) => h.fn(action, e));
});
window.addEventListener('keyup', (e) => down.delete(e.code));

const held = (codes) => codes.some((c) => down.has(c));

/* ---------- touch: a floating stick ---------- */

// The newest finger on the screen steers; lift it and a finger still down takes over.
const fingers = new Map(); // pointerId -> { x, y }, in CSS px
const stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 }; // the ring's centre, and the thumb's offset from it
let lastRead = -Infinity; // when a scene last asked for moveVector(): the ring only shows while a run steers
let hideTimer = 0;

// The ring under the thumb is a DOM element, so it still shows when the thumb rests on the bars beside the game.
const R = STICK.radius;
const ring = document.createElement('div');
const knob = document.createElement('div');
ring.style.cssText = `position:fixed;left:${-R}px;top:${-R}px;width:${2 * R}px;height:${2 * R}px;box-sizing:border-box;border:1.5px solid rgba(220,230,226,0.35);border-radius:50%;pointer-events:none;display:none;z-index:5`;
knob.style.cssText = 'position:fixed;left:-12px;top:-12px;width:24px;height:24px;border-radius:50%;background:rgba(220,230,226,0.3);pointer-events:none;display:none;z-index:5';
document.body.append(ring, knob);

function drawStick() {
  const show = stick.id !== null && performance.now() - lastRead < 200;
  ring.style.display = knob.style.display = show ? 'block' : 'none';
  if (!show) return;
  ring.style.transform = `translate(${stick.ox}px, ${stick.oy}px)`;
  knob.style.transform = `translate(${stick.ox + stick.dx}px, ${stick.oy + stick.dy}px)`;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(drawStick, 250); // hides it once the run stops steering (a smite, a menu)
}

function grab(id, x, y) {
  Object.assign(stick, { id, ox: x, oy: y, dx: 0, dy: 0 });
  drawStick();
}

function drag(x, y) {
  const dx = x - stick.ox, dy = y - stick.oy, d = Math.hypot(dx, dy);
  if (d > STICK.radius) {
    // The ring trails the thumb, so sliding back the other way reverses at once.
    stick.ox = x - (dx * STICK.radius) / d;
    stick.oy = y - (dy * STICK.radius) / d;
  }
  stick.dx = x - stick.ox;
  stick.dy = y - stick.oy;
  drawStick();
}

function release() {
  stick.id = null;
  drawStick();
}

const steers = (e) => e.pointerType !== 'mouse' || FORCE_TOUCH;

window.addEventListener('pointerdown', (e) => {
  if (!steers(e)) return;
  touch = true;
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  grab(e.pointerId, e.clientX, e.clientY);
});
window.addEventListener('pointermove', (e) => {
  const f = fingers.get(e.pointerId);
  if (!f) return;
  f.x = e.clientX;
  f.y = e.clientY;
  if (e.pointerId === stick.id) drag(f.x, f.y);
});
const lift = (e) => {
  if (!fingers.delete(e.pointerId) || e.pointerId !== stick.id) return;
  const rest = [...fingers];
  if (!rest.length) return release();
  const [id, f] = rest[rest.length - 1];
  grab(id, f.x, f.y);
};
window.addEventListener('pointerup', lift);
window.addEventListener('pointercancel', lift);
window.addEventListener('blur', () => {
  fingers.clear();
  clearKeys();
});

// Full speed toward the thumb, like a held key. Slides near straight count as straight,
// because the boat only brakes its sideways drift when there is no sideways input.
function stickVector() {
  const d = Math.hypot(stick.dx, stick.dy);
  if (stick.id === null || d < STICK.deadZone) return { x: 0, y: 0 };
  const x = stick.dx / d, y = stick.dy / d;
  if (Math.abs(x) < STICK.axisSnap) return { x: 0, y: Math.sign(y) };
  if (Math.abs(y) < STICK.axisSnap) return { x: Math.sign(x), y: 0 };
  return { x, y };
}

/* ---------- what scenes use ---------- */

/** Unit-length move direction from the keys held right now, or the touch stick ({x: 0, y: 0} when idle). */
export function moveVector() {
  lastRead = performance.now();
  let x = (held(MOVE.right) ? 1 : 0) - (held(MOVE.left) ? 1 : 0);
  let y = (held(MOVE.down) ? 1 : 0) - (held(MOVE.up) ? 1 : 0);
  if (!x && !y) return stickVector();
  if (x && y) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}

/** True on a touch screen (or once the player touches one): show "tap" prompts instead of keys. */
export const isTouch = () => touch;

/** Calls fn(action) for pause, mute, confirm, help, buy1-6 while the scene is running. Cleaned up on shutdown. */
export function onAction(scene, fn) {
  const h = { scene, fn };
  handlers.add(h);
  scene.events.once('shutdown', () => handlers.delete(h));
  scene.events.once('destroy', () => handlers.delete(h));
}

// A phone held upright: index.html covers the game with "turn your phone sideways" (same media query there).
const upright = matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 700px)');

/** Calls fn when the player looks away: the window loses focus, the tab is hidden, or the phone turns upright. */
export function onAway(scene, fn) {
  const events = scene.game.events;
  const turned = (e) => e.matches && fn();
  events.on('blur', fn);
  events.on('hidden', fn); // phones switch apps without a window blur
  upright.addEventListener('change', turned);
  scene.events.once('shutdown', () => {
    events.off('blur', fn);
    events.off('hidden', fn);
    upright.removeEventListener('change', turned);
  });
}

/** Forget held keys and the touch stick (after a pause or a menu, so the boat doesn't keep moving). */
export function clearKeys() {
  down.clear();
  release();
}

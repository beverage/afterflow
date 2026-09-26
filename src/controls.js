// All input goes through here: a move vector plus named actions.
// Keys are read by physical position (event.code), so the WASD keys also work as ZQSD on
// French AZERTY keyboards. Touch can plug in here later (mobile, v3) without touching game logic.

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
  Space: 'confirm',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Digit1: 'buy1',
  Numpad1: 'buy1',
  Digit2: 'buy2',
  Numpad2: 'buy2',
  Digit3: 'buy3',
  Numpad3: 'buy3',
};

const CAPTURE = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const down = new Set();
const handlers = new Set();

window.addEventListener('keydown', (e) => {
  if (CAPTURE.has(e.code)) e.preventDefault();
  down.add(e.code);
  const action = ACTION_BY_CODE[e.code];
  if (!action || e.repeat) return;
  // Only scenes running when the key went down hear it, so closing an overlay with Esc
  // doesn't also pause the scene underneath.
  const listening = [...handlers].filter((h) => h.scene.sys.isActive());
  listening.forEach((h) => h.fn(action, e));
});
window.addEventListener('keyup', (e) => down.delete(e.code));
window.addEventListener('blur', () => down.clear());

const held = (codes) => codes.some((c) => down.has(c));

/** Unit-length move direction from the keys held right now ({x: 0, y: 0} when idle). */
export function moveVector() {
  let x = (held(MOVE.right) ? 1 : 0) - (held(MOVE.left) ? 1 : 0);
  let y = (held(MOVE.down) ? 1 : 0) - (held(MOVE.up) ? 1 : 0);
  if (x && y) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}

/** Calls fn(action) for pause, mute, confirm, buy1-3 while the scene is running. Cleaned up on shutdown. */
export function onAction(scene, fn) {
  const h = { scene, fn };
  handlers.add(h);
  scene.events.once('shutdown', () => handlers.delete(h));
  scene.events.once('destroy', () => handlers.delete(h));
}

/** Forget held keys (after a pause or a menu, so the boat doesn't keep moving). */
export function clearKeys() {
  down.clear();
}

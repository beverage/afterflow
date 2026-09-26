// Asset manifest. Scenes only ever refer to art by key.
// Every key already has a placeholder drawn by code (src/art.js), so the game runs with no files at all.
// Real art: put the PNG in public/assets/, add one line below, refresh. Sizes and notes are in GAME.md.
// Keys: bank, boat, arch, shop, pier, obol, pine1-pine3, fern1-fern3, lily1-lily3, rock1-rock5,
//       soul_athena, soul_ares, soul_poseidon, icon_speed, icon_handling, icon_hold,
//       scroll_athena, scroll_ares, scroll_poseidon

export const IMAGES = {
  // bank: 'assets/bank.png',
};

// Animated sprite sheets: key -> file and frame size. Ines's angled portals, one per god, matched by color:
// Athena uses her gold (Apollo) sheet, Ares her red (Persephone) sheet, Poseidon hers shifted to seafoam.
// If a sheet is missing or fails to load, that god's shrine falls back to the stone arch drawn by code.
export const SHEETS = {
  portal_athena: { path: 'assets/portal_athena.webp', frameWidth: 327, frameHeight: 299 },
  portal_ares: { path: 'assets/portal_ares.webp', frameWidth: 327, frameHeight: 299 },
  portal_poseidon: { path: 'assets/portal_poseidon.webp', frameWidth: 327, frameHeight: 299 },
};

export const AUDIO = {
  // music: 'assets/music.mp3',
};

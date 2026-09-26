// Sizes, colors and tuning knobs. Put magic numbers here so anyone can tweak feel without touching game logic.

// Landscape canvas; Phaser scales it to fit any screen.
export const WIDTH = 1280;
export const HEIGHT = 720;

export const COLORS = {
  bg: '#0e0c1c',
  text: '#e6eeea',
  dim: '#97aaa2',
  obol: '#f1e6c8',
  live: '#4ade80',
  warn: '#fbbf24',
  bad: '#f87171',
};

export const FONT = "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const DISPLAY_FONT = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";

// The three gods, in rage-bar order. Each soul carries its god's color and symbol.
export const GODS = [
  { key: 'athena', name: 'Athena', color: 0xffc44d, glyph: 'owl' },
  { key: 'ares', name: 'Ares', color: 0xff4e3a, glyph: 'spear' },
  { key: 'poseidon', name: 'Poseidon', color: 0x3df2b0, glyph: 'trident' },
];

// River shape: a band down the middle that meanders as it scrolls. [amplitude px, frequency per px, phase]
export const RIVER = {
  centerX: 640,
  halfWidth: 272,
  meander: [
    [42, 0.0021, 0.7],
    [16, 0.0057, 2.1],
  ],
  wobble: [
    [22, 0.0033, 1.3],
    [8, 0.0091, 0.4],
  ],
  bankWander: 15, // each bank wanders in and out by about this many px on its own (Ines's uneven banks)
};

export const TUNING = {
  // River flow
  scrollSpeed: 110, // px/s the banks scroll at Speed level 0
  fogAmount: 0.75, // Ines's fog slider: 0 clear, 1 thick (fog banks, grey tint, haze)
  currentFactor: 1.75, // the current (water surface, lifestream) runs this much faster than the banks scroll
  pxPerMeter: 20, // for the distance readout

  // Boat: free 2D movement
  boatStartY: 540,
  boatTop: 110,
  boatBottom: 650,
  boatEdgeMargin: 30, // keep the hull's centre this far inside the banks
  boatMaxSpeed: 330, // px/s at Handling level 0
  boatAccel: 2400, // px/s² at Handling level 0
  boatDrag: 7, // how quickly the boat glides to a stop when you let go
  hullRadius: 20, // pickup and docking capsule around the hull's centre line
  hullFront: -52,
  hullBack: 46,

  // Souls
  holdStart: 3,
  lifespan: 16, // seconds a soul lasts in the hold before it burns out
  clutchBelow: 0.2, // delivering a soul with less life than this is a CLUTCH
  soulRadius: 17,
  soulGapStart: 150, // px of river between soul spawns at the start
  soulGapMin: 58,
  soulGapRamp: 0.0022, // the gap shrinks by this many px per px travelled
  soulBias: 0.5, // chance a new soul matches one of the next two shrines

  // Banks: shrines and shops
  featureGapStart: 540, // px between bank features
  featureGapGrowth: 0.0015, // shrines drift further apart as you go
  featureGapMax: 760,
  shopEvery: 4, // every Nth bank feature is Hermes' stall
  dockReach: 34, // how close the hull must come to a dock's tip

  // Rage
  ragePerSkip: 0.14, // a soul floats past uncaught
  ragePerBurnOut: 0.14, // a soul burns out in your hold
  calmPerSoul: 0.04, // each soul delivered to its god
  rageWarn: 0.75,

  // Economy: prices climb exponentially, so soul value does too
  soulValue: 10,
  soulValueGrowth: 16000, // px travelled per e-fold of soul value
  streakCap: 8,
  clutchMultiplier: 2,
  priceGrowth: 1.8,

  // Your best distance (saved on this device) is marked on the river
  markFrom: 1000, // px: a best shorter than this (50 m) isn't marked
};

// Lanterns are lives. A god's smite puts one out (a wrecked hull will too, once there are obstacles);
// when the last one goes out, the run ends.
export const LANTERNS = {
  start: 2,
  max: 3,
  graceSeconds: 3, // after a smite, souls that float past anger no one and the boat flickers
  coolOthers: 0.25, // a smite appeases the god who struck (rage to 0) and cools the others by this much
  streakForLantern: 8, // every 8th delivery in a row lights one
};

// How-to-play tour on the first run (TutorialScene): each step moves on by itself after this long.
export const TUTORIAL = {
  stepSeconds: 4.5,
  lastStepSeconds: 1.8, // "Your turn"
};

// Charon's fee: when the last lantern goes out, pay it on the game-over screen to return with one.
// Priced like one of Hermes' upgrades: basePrice, climbing by TUNING.priceGrowth each time it's paid in a run.
export const CHARON = { basePrice: 150 };

// Hermes' stall. Each level costs basePrice * priceGrowth^level.
export const UPGRADES = [
  {
    key: 'speed',
    name: 'Speed',
    icon: 'icon_speed',
    basePrice: 60,
    maxLevel: 8,
    perLevel: 0.12,
    desc: 'The river runs 12% faster: more souls and obols, more risk',
  },
  {
    key: 'handling',
    name: 'Handling',
    icon: 'icon_handling',
    basePrice: 50,
    maxLevel: 8,
    maxSpeedPerLevel: 45,
    accelPerLevel: 400,
    desc: 'A quicker, snappier boat',
  },
  { key: 'hold', name: 'Hold', icon: 'icon_hold', basePrice: 80, maxLevel: 5, perLevel: 1, desc: 'Carry one more soul' },
];

// Scrolls, the stall's bottom row: one per god, carried one at a time, used by saying the incantation aloud.
export const SCROLLS = {
  calm: 0.5, // share of a full rage bar that one scroll takes away
  priceSouls: 6, // a scroll costs this many souls' worth at your distance, so it stays worth the same effort
  panelSeconds: 5, // Space shows your scrolls this long; the river never slows
  match: 0.72, // how closely (0-1) what the mic heard must sound like the whole incantation
  wordMatch: 0.7, // ...and each of its two words
  oneWord: 0.86, // or just one word, said clearly as a short phrase of its own
  oneShortWord: 0.97, // ...nearly exact for short words like "Doru", which everyday talk brushes against
  oneWordPhrase: 3, // longest phrase (in words) where one word is enough: other people and the room talk longer
  showHeard: 0.55, // what the mic heard only shows on screen when it comes this close to a scroll, so chatter stays off
  heardSeconds: 2.5, // the words the mic caught stay on screen this long
};

// Touch steering on phones: a floating stick under the thumb, in screen px (see controls.js).
export const STICK = {
  deadZone: 10, // a slide shorter than this doesn't move the boat, so taps don't steer
  radius: 34, // the ring trails the thumb beyond this, so sliding back reverses at once
  axisSnap: 0.38, // slides within ~22° of straight count as straight, like a single arrow key
};

// Ines's angled portals (sprite sheets portal_<god>.webp in public/assets): 8x4 frames of 327x299, a 4 s loop.
// Offsets are px from the gate's base point (on the bank, 8 px from the water), mirrored on the right bank.
export const PORTAL = {
  frameWidth: 327,
  frameHeight: 299,
  frames: 32,
  fps: 8,
  anchor: [80, 195.2], // the gate's base point inside a frame
  swirl: [-1, -45], // centre of the swirl, where delivered souls fly
  dock: [95, 28], // the brightest part of the light pooling on the water: sail in here to deliver
  medal: [-16, -160], // her medallion, which ours covers so the symbol matches the souls
  scale: 1,
};

// Hermes' stall (`shop`), drawn by code at the portals' angle and in the same frame, so Ines's file can replace it.
// Offsets are from the base point, facing right (toward the water on the left bank; mirrored on the right).
export const STALL = {
  frameWidth: 327,
  frameHeight: 299,
  anchor: [80, 195], // the counter's base point inside the frame
  dock: [95, 28], // the end of the jetty, in the warm light on the water: sail in here to shop
  lamp: [50, -86], // the lantern hanging from the awning
  medal: [8, -152], // the caduceus medallion above the awning
};

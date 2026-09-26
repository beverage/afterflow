# GAME.md: living design doc

Single source of truth for humans and agents. Keep it short and current: when a decision changes, change it here and log the why in `DECISIONS.md`.

## One-liner

_Name: **Soul Drift** (for now)._ Ferry the dead down the river: scoop up drifting souls and deliver each to its god's shrine before it burns out, or the gods' rage sinks you.

## Core loop (v1: what the player does every few seconds)

1. **Scoop.** The river scrolls down the middle of the screen. Move the boat anywhere on the water with WASD and touch drifting souls to take them aboard. Each soul has its god's color and slowly shrinks; when its lifespan runs out it burns out in a flash.
2. **Deliver.** Shrines drift by on the left and right banks (a strip shows the next 3). Steer into a shrine's dock to hand over every soul of its color for obols. Back-to-back deliveries build a **streak** (x2, x3, x4...). Delivering a soul that was about to burn out is a **CLUTCH**, with its own sound and a bonus.
3. **Upgrade or die.** Every soul that floats past uncaught fills its god's rage bar; if any bar fills, that god smites you and the run ends. Riverside shops pause the game when you dock: spend obols on upgrades whose prices climb exponentially.

## Rules (v1)

- One continuous run. Nothing is saved: no accounts, no best score. Game over, press a key, fresh run.
- 3 gods, one rage bar each in the HUD: **Athena** (gold, owl), **Ares** (crimson, spear), **Poseidon** (seafoam, trident). Souls carry their god's symbol too, not just a color.
- Rage: only skipped souls fill it (a soul that leaves the bottom of the screen uncaught, including when your hold is full). Any bar at 100% = death.
- Souls shrink and flicker over their lifespan and burn out in a flash at zero, which forces regular deliveries.
- The streak resets when a soul burns out. Skipped souls already cost rage, so they don't also break it.
- Shops: a riverside dock every ~20 s, alternating banks. Docking pauses the game. Items:
  - **Speed**: the river scrolls faster, so more souls and shrines per minute (more money, more risk).
  - **Handling**: quicker, snappier boat movement.
  - **Hold**: +1 soul capacity (starts at 3).
- Economy: upgrade prices grow exponentially per level. Soul value also grows the further downstream you get, then streak and clutch multiply it, so income keeps pace and the numbers keep climbing. Big numbers shown as 1.2K, 3.4M.
- Difficulty ramps through density: more souls per second, shrines further apart.

## Tuning targets

- A first-timer dies after 60-90 s; a good run lasts 3-5 min.
- At every shop you can afford about one upgrade, sometimes two.
- All numbers live in `src/config.js`.

## Open questions (defaults in use until someone decides)

- Does a soul that burns out in your hold anger its god? Default: yes, it counts as skipped.
- Does a delivery calm its god's rage? Default: yes, a little per soul.
- Does a soul's lifespan start when you catch it? Default: yes.

## The AI hook (v2, after the river works)

- What Gemini generates: the gods' voiced reactions (run start, rage at 50% and 80%, big streaks), fresh prayers written for the god and the moment, a death verdict from the god who sank you, a one-line life story for each soul.
- Prayers: prayer scrolls (bought at shops) let you pick a god (1 / 2 / 3, or click its rage bar) and read the prayer aloud while still steering at full speed. Speech-to-text scores the words and lowers that god's rage.
- When it is called: run start, shop docks, game over, in the background. Never per frame. Lines are prepared ahead so they play instantly.
- If the AI is slow or offline: canned lines per god; prayers fall back to holding Space.

## Controls

- Laptop first. **WASD** (the same keys are ZQSD on French AZERTY keyboards: keys are read by position) or the **arrow keys** move the boat freely on the water, shoot-'em-up style: across the river to reach souls and banks, forward and back to rush or wait. Diagonals are not faster. Quick acceleration with a slight glide; Handling makes it snappier.
- Deliver: automatic when the boat touches a shrine's dock.
- Shop: touching a shop's dock pauses the game and opens it. **1 / 2 / 3** or a click buys, **Space** or **Esc** casts off.
- **Esc** or **P** pauses, **M** mutes, **Space** or **Enter** restarts after game over (after a short delay, so a held key doesn't restart instantly).
- A "click to play" screen gives the game keyboard focus and unlocks audio. The game pauses when the window loses focus, so keys can't get stuck.
- Never require more than 2 held keys plus 1 tap: laptop keyboards drop keys.
- v2 prayers: **1 / 2 / 3** (or a click on a rage bar) prays to that god; hold **Space** if there's no mic. Mic permission is asked on the title screen, never mid-run.
- v3, maybe mobile: all input goes through one controls module (a move vector plus actions), so drag-to-move can plug in later, and the 16:9 canvas fits a phone held sideways.

## Look and sound

- View: 3/4 top-down 2D (2.5D) on a landscape 1280x720 canvas.
- Art direction: the River Flow prototype's look. A glowing violet river on dark water, misty grey-green banks with pines and red spider lilies, souls as glowing bubbles, shrines drawn as stone-arch portals with a swirl in their god's color. Animated look preview: https://claude.ai/artifact/BrqevqKY2V8ADoYP1JQCK3
- Layout: the river (~560 px wide) runs down the middle. The banks (~360 px each side) hold shrines and shops at the water's edge. HUD panels sit on the outer edges: rage bars on the left; obols, streak and next shrines on the right. The boat faces up the screen and everything drifts from top to bottom.
- Art owner: Ines. Every key below already has a placeholder drawn by code (`src/art.js`), so real art is optional and drops in by key with no code change.
- Drawn by code, not art: the water, light streaks, glows, portal swirls, soul trails, sparks, and the rocky shore (stones and gravel lining both banks).
- Assets (PNG with transparency in `public/assets/`, one line each in `src/assets.js`):

| Key | Size (px) | Notes |
|---|---|---|
| `bank` | 1280x720 | Ground for both banks, no water (the river is drawn over it). Loops top to bottom |
| `boat` | 100x170 | Charon's ferry from above, bow up, hull centred at (40, 72) |
| `arch` | 150x150 | Shrine arch, base centre at (75, 138). Leave the opening transparent: the portal shows through |
| `shop` | 150x150 | Hermes' stall, base centre at (75, 138) |
| `pier` | 100x34 | Planks with posts at the right (water) end, stretched to length |
| `pine1`, `pine2`, `pine3` | 56 to 80 square | Pines seen from above |
| `lily1`, `lily2`, `lily3` | 44x44 | Red spider lilies |
| `rock`, `reeds` | about 26x22 | Bank details |
| `soul_athena`, `soul_ares`, `soul_poseidon` | 40x40 | The soul bubble with its god's symbol (halo and trail are code) |
| `obol` | 40x40 | Coin with Athena's owl |
| `icon_speed`, `icon_handling`, `icon_hold` | 96x96 | Shop icons |

- Sounds: all synthesized in code (`src/sfx.js`): pickup, deliver (pitch climbs with the streak), streak break, **clutch (unique)**, burn-out, skip, coin, shop open, buy, can't afford, rage warning, smite, and a quiet flowing-water ambience with the odd droplet. Real audio can replace them later. Owner: TBD.

## Voices (Gradium, v2)

| Character | Key in `src/voices.js` | Voice | Design prompt / notes |
|---|---|---|---|
| Narrator | `narrator` | Emma (catalog) | Placeholder until we design our own |
| Athena | `athena` | to design | Cool, precise, disappointed |
| Ares | `ares` | to design | Booming, hot-tempered god of war |
| Poseidon | `poseidon` | to design | Deep and rolling, moody as the sea |

## Scope

- Hack rule: use at least 2 of Gemini, Gradium, Devin, Voodoo (use during development counts).
- v1, must have for the demo: river runner, 3 gods, souls with a lifespan, shrines and deliveries, rage bars and death, riverside shops with exponential prices (Speed, Handling, Hold), streaks, clutch with its own sound, juice (pops, obol bursts, screen shake), game over and instant restart.
- v2, after v1 is solid: AI gods (reactions, fresh prayers, death verdict, soul stories), prayer scrolls read aloud (speech-to-text), obstacles and damage, saving and best score, bullet-hell arena when a god's rage fills, weapons.
- v3, maybe: mobile (touch controls, phone held sideways).
- Stretch: voice cloning (the ferryman repeats your prayer in your own voice).
- Considered, not chosen: golden hero souls, underworld zones, missions, leaderboard.
- Cut: Unity and Voodoo.

## v1 status

Built and playable: title over a self-steering river, the river runner, souls with a lifespan, shrines and deliveries, streaks and clutches, rage bars and death, Hermes' stall with exponential prices, pause, game over and instant restart, one-time tips, placeholder art and synthesized sound.

Next: playtest and tune the numbers in `src/config.js` against the targets above, then drop in Ines's art.

## Team

| Who | Owns |
|---|---|
| Alex | Repo, integration, AI wiring, deploy, the demo build |
| Gleb | Game design, pitch |
| Ines | Art, UI |
| Fede | Backend, jack of all trades |

## Clock (Paris time)

- 12:52 design locked (this doc)
- 14:30 v1 river loop playable on the public URL, placeholder art
- 15:30 v1 complete with Ines's art, v2 starts
- 17:30 feature freeze: only fixes and polish after this
- 18:30 record a backup demo video of a good run
- 19:00 competition opt-in deadline
- 20:00 live demo

## Demo (2 minutes, rehearse once at 18:45)

1. Hook, one sentence:
2. Play it live:
3. The AI moment:

## Decisions

This file is the current state. The why behind each choice lives in `DECISIONS.md`.

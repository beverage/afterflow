# GAME.md: living design doc

Single source of truth for humans and agents. Keep it short and current: when a decision changes, change it here and log the why in `DECISIONS.md`.

## One-liner

_Name: **Soul Drift** (for now)._ Ferry the dead down the river: scoop up drifting souls and deliver each to its god's shrine before it burns out, or the gods' rage sinks you.

## Core loop (v1: what the player does every few seconds)

1. **Scoop.** The river scrolls down the middle of the screen. Move the boat anywhere on the water with WASD and touch drifting souls to take them aboard. Each soul has its god's color and slowly shrinks; when its lifespan runs out it burns out in a flash.
2. **Deliver.** Shrines drift by on the left and right banks (a strip shows the next 3). Steer into a shrine's dock to hand over every soul of its color for obols. Back-to-back deliveries build a **streak** (x2, x3, x4...). Delivering a soul that was about to burn out is a **CLUTCH**, with its own sound and a bonus.
3. **Upgrade or die.** Every soul that floats past uncaught fills its god's rage bar; if any bar fills, that god smites you and one of your lanterns goes out; when the last one goes out, the run ends. Riverside shops pause the game when you dock: spend obols on upgrades whose prices climb exponentially.
4. **Remember and recite.** Each scroll has a two-word incantation in crypto-Greek. Say it aloud on the river and the scroll calms its god. You can glance at your scrolls, but the river never slows: learn the words.

## Rules (v1)

- One continuous run: game over, press a key, fresh run. No accounts, but this device remembers your best run and lifetime totals (localStorage); `?fresh` in the URL forgets them.
- 3 gods, one rage bar each in the HUD: **Athena** (gold, owl), **Ares** (crimson, spear), **Poseidon** (seafoam, trident). Souls carry their god's symbol too, not just a color.
- Rage: only skipped souls fill it (a soul that leaves the bottom of the screen uncaught, including when your hold is full). Any bar at 100%: that god smites you and a lantern goes out.
- **Lanterns** are your lives: you start with 2 and can hold 3 (small lanterns under the rage bars). A smite puts one out and takes the souls aboard and the streak with it; the god who struck is appeased (rage back to 0) and the others cool by 25%, then for 3 s the boat flickers and passing souls anger no one. When the last lantern goes out, the run ends. Every 8th delivery in a row lights one. Obstacles (v2) will put them out too.
- **Charon's fee:** when the last lantern goes out, the game-over screen offers to pay Charon to return with one lantern (the god who struck is appeased, as after any smite). The fee starts at 150 obols and climbs on the same curve as Hermes' prices, ×1.8 each time it's paid in a run (150, 270, 490, 870...), so obols not spent at Hermes' stall are a way back. Out of reach, the screen shows the fee next to your obols.
- **Your best:** your best distance is marked on the river, a line of floating lights across the water labelled on the bank; crossing it pops "New best!". The game-over screen says how the run compares (a new best, your first mark, or how far short), and the title shows your best and the souls you've ferried.
- Souls shrink and flicker over their lifespan and burn out in a flash at zero, which forces regular deliveries.
- The streak resets when a soul burns out. Skipped souls already cost rage, so they don't also break it.
- Shops: a riverside dock every ~20 s, alternating banks. Docking pauses the game. Hermes' stall is 3x2: upgrades on top, one scroll per god below.
  - **Speed**: the river scrolls faster, so more souls and shrines per minute (more money, more risk).
  - **Handling**: quicker, snappier boat movement.
  - **Hold**: +1 soul capacity (starts at 3).
  - **Scrolls** (Athena, Ares, Poseidon): usables. You carry at most one per god. Each has a two-word incantation in crypto-Greek, like the crypto-Latin spells of Harry Potter but built from Greek roots tied to its god, solemn and never silly ("Galene Thalassa": calm, O sea). Every word must be easy for an English speaker to read aloud at first sight. It's shown on its card with its meaning; say it aloud on the river and the scroll is used at once: that god loses half its rage. Price: 6 souls' worth at your distance.
- Scrolls are a memory game: Space (or a tap on the scrolls panel) shows your scrolls for 5 s, over the left bank, and the river never slows.
- Economy: upgrade prices grow exponentially per level. Soul value also grows the further downstream you get, then streak and clutch multiply it, so income keeps pace and the numbers keep climbing. Big numbers shown as 1.2K, 3.4M.
- Difficulty ramps through density: more souls per second, shrines further apart.

## Tuning targets

- A first-timer loses a first lantern after 60-90 s; a good run lasts 3-5 min.
- At every shop you can afford about one upgrade, sometimes two.
- All numbers live in `src/config.js`.

## Open questions (defaults in use until someone decides)

- Does a soul that burns out in your hold anger its god? Default: yes, it counts as skipped.
- Does a delivery calm its god's rage? Default: yes, a little per soul.
- Does a soul's lifespan start when you catch it? Default: yes.

## The AI hook (v2, after the river works)

- What Gemini generates: scroll incantations (built), the gods' voiced reactions (run start, rage at 50% and 80%, big streaks), a death verdict from the god who sank you, a one-line life story for each soul.
- Scrolls (built): Gemini writes each scroll's incantation (two crypto-Greek words and their meaning), prepared in the background so buying never waits. The browser's speech recognition listens while you carry a scroll. It hears invented words as English ("Thalassa" comes back as "the lasso"), so incantations are matched by sound. Both words, even garbled, use the scroll; so does one word heard clearly as a short phrase of its own (up to 3 words). Other people and the room talk in longer stretches, which need both words. What the mic heard shows as a subtitle only when it comes close to a scroll, so chatter stays off screen; the mic dot flares on any speech. `?debug` shows everything heard, with its match score. What the mic heard shows like a subtitle under the river.
- When it is called: run start, shop docks, game over, in the background. Never per frame. Lines are prepared ahead so they play instantly.
- If the AI is slow or offline: canned lines and canned incantations per god. With no mic (Firefox, mic refused), Space then 1 / 2 / 3 reads a scroll.

## Controls

- Laptop first. **WASD** (the same keys are ZQSD on French AZERTY keyboards: keys are read by position) or the **arrow keys** move the boat freely on the water, shoot-'em-up style: across the river to reach souls and banks, forward and back to rush or wait. Diagonals are not faster. Quick acceleration with a slight glide; Handling makes it snappier.
- Deliver: automatic when the boat touches a shrine's dock.
- Shop: touching a shop's dock pauses the game and opens it. **1 to 6** or a click buys (1-3 upgrades, 4-6 scrolls), **Space** or **Esc** casts off.
- **Esc** or **P** pauses, **M** mutes, **Space** or **Enter** restarts after game over (after a short delay, so a held key doesn't restart instantly); **1** or a click on Charon's offer pays his fee instead.
- A "click to play" screen gives the game keyboard focus and unlocks audio. The game pauses when the window loses focus or the tab is hidden, so keys can't get stuck.
- How to play: the first run of a browser session opens with a tour over the paused river (restarts and reloads skip it, a new tab shows it again). A spotlight moves from the boat to a soul, a shrine, the rage bars and the obols, with a caption card for each. Each step moves on by itself after 4.5 s; **Space**, **Enter**, a click or a tap moves on sooner, **Esc** or Skip ends it. **H**, or How to play on the pause screen, brings it back.
- Never require more than 2 held keys plus 1 tap: laptop keyboards drop keys.
- Scrolls: say a carried scroll's words aloud to use it. **Space** shows your scrolls for 5 s while you keep steering. No mic: Space, then **1 / 2 / 3** (or a tap on a scroll) reads one. The browser asks for the mic when you buy your first scroll, while the stall has the game paused.
- Phones, held sideways: a floating stick. Put a thumb down anywhere (the bars beside the game too) and slide: the boat heads that way at full speed, as if holding the key, and glides to a stop when you lift. A faint ring shows under the thumb and trails it, so sliding back reverses at once.
- On a phone, taps do everything else: start, buy, cast off (a button), resume, pay Charon (his offer is a button), restart. A pause button sits top right, and the pause screen has a sound toggle. Prompts say "tap" instead of naming keys.
- A phone held upright shows "turn your phone sideways" and pauses the run. Android goes fullscreen on the first tap; iPhones can't, short of Add to Home Screen.
- Add `?touch` to the URL to try the phone controls on a laptop, dragging with the mouse.
- Add `?fresh` to the URL to forget saved runs, as on a first visit (for playtests and demos).

## Look and sound

- View: 3/4 top-down 2D (2.5D) on a landscape 1280x720 canvas.
- Art direction: the River Flow prototype's look. A glowing violet river on dark water, misty grey-green banks with pines and red spider lilies, souls as glowing bubbles, shrines drawn as stone-arch portals with a swirl in their god's color. Animated look preview: https://claude.ai/artifact/BrqevqKY2V8ADoYP1JQCK3
- Layout: the river (~560 px wide) runs down the middle. The banks (~360 px each side) hold shrines and shops at the water's edge. HUD panels sit on the outer edges: rage bars, lanterns and distance on the left; obols, streak and next shrines on the right. The boat faces up the screen and everything drifts from top to bottom.
- Art owner: Ines. Every key below already has a placeholder drawn by code (`src/art.js`), so real art is optional and drops in by key with no code change.
- Atmosphere after Ines's river study: drifting fog banks, a grey tint and haze at the top and bottom (under souls and the boat so they stay crisp), floating spores, darkened edges. `fogAmount` in `src/config.js` sets the fog (her slider; default 0.75).
- Banks after Ines's river study too: uneven shoreline with a muddy strip, and pines, ferns, rocks and spider lilies scattered at her densities, clear of shrines and stalls.
- How-to-play tour: Ines's tutorial design from her River Flow prototype. The screen dims except a soft round spotlight circled by a slowly turning dashed ring; a dark caption card with a faint violet glow (Cormorant title, Source Sans text, step dots, a violet-to-cyan bar that fills as the step runs out) sits at the top or bottom, away from the spotlight.
- Drawn by code, not art: the water (ported from Ines's river study `afterflow-riviere.html`: shallow-to-deep body, flowing surface, current lines faster mid-stream, serpentine lifestream ribbons, glints, foam along the banks), glows, portal swirls, soul trails and sparks.
- Assets (PNG with transparency in `public/assets/`, one line each in `src/assets.js`):

| Key | Size (px) | Notes |
|---|---|---|
| `bank` | 1280x720 | Ground for both banks, no water (the river is drawn over it). Loops top to bottom. Placeholder: Ines's mossy ground with grass, moss and pale flowers |
| `boat` | 100x170 | Charon's ferry from above, bow up, hull centred at (40, 72) |
| `arch` | 150x150 | Shrine arch, base centre at (75, 138). Leave the opening transparent: the portal shows through |
| `shop` | 150x150 | Hermes' stall, base centre at (75, 138) |
| `pier` | 100x34 | Planks with posts at the right (water) end, stretched to length |
| `pine1`, `pine2`, `pine3` | about 98 to 136 square | Pines seen from above (Ines's radiating needles); trunk up-left of centre, shadow down-right |
| `fern1`, `fern2`, `fern3` | about 44 to 64 square | Ferns seen from above |
| `lily1`, `lily2`, `lily3` | 32x36 | Red spider lilies, flower at (16, 15) |
| `rock1` to `rock5` | about 25 to 44 square | Mossy stones; some sit on the waterline with eddies behind them |
| `soul_athena`, `soul_ares`, `soul_poseidon` | 40x40 | The soul bubble with its god's symbol (halo and trail are code) |
| `obol` | 40x40 | Coin with Athena's owl |
| `icon_speed`, `icon_handling`, `icon_hold` | 96x96 | Shop icons |
| `scroll_athena`, `scroll_ares`, `scroll_poseidon` | 88x64 | A scroll sealed in its god's color, for the stall and the HUD |

- Sounds: all synthesized in code (`src/sfx.js`): pickup, deliver (pitch climbs with the streak), streak break, **clutch (unique)**, burn-out, skip, coin, shop open, buy, can't afford, rage warning, smite, lantern lit, new best, scrolls unrolling and a scroll calming its god. No background ambience: silence between effects. Real audio can replace them later. Owner: TBD.

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
- v2, after v1 is solid: AI gods (reactions, death verdict, soul stories), obstacles and damage, bullet-hell arena when a god's rage fills, weapons. Scrolls with spoken incantations are built.
- Phones, alongside v1: touch controls for a phone held sideways (see Controls). Scrolls on phones: a tap on the scrolls panel shows them; the mic is untested on phones.
- Stretch: voice cloning (the ferryman repeats your incantation in your own voice).
- Considered, not chosen: golden hero souls, underworld zones, missions, leaderboard.
- Cut: Unity and Voodoo.

## v1 status

Built and playable: title over a self-steering river, a how-to-play tour on the first run, the river runner, souls with a lifespan, shrines and deliveries, streaks and clutches, rage bars, lanterns (lives), death and Charon's fee, Hermes' stall with exponential prices, scrolls with spoken incantations written by Gemini, pause, game over and instant restart, your best run saved on this device and marked on the river, one-time tips, placeholder art and synthesized sound, and touch controls for phones held sideways.

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
- 18:30 feature freeze: only fixes and polish after this
- 18:30 record a backup demo video of a good run
- 19:00 competition opt-in deadline
- 20:00 live demo

## Demo (2 minutes, rehearse once at 18:45)

1. Hook, one sentence:
2. Play it live:
3. The AI moment:

## Decisions

This file is the current state. The why behind each choice lives in `DECISIONS.md`.

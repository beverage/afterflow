# Afterflow: design and development

The write-up of Afterflow as we demo it: what the game is, how every system works and with which numbers, how the AI and voice fit in, how the code is laid out, and how a team of four built it in a day with coding agents.
Made at the {Tech: Europe} AI Gaming Hack, Paris, 26 September 2026.

This is a snapshot of the demo build. The living files win if they ever disagree: `GAME.md` holds the current rules in short form, `DECISIONS.md` the reason behind every call (with times), `AGENTS.md` the rules and file map for coding agents, and `src/config.js` every number.

## 1. The game

**Pitch.** You are Charon, ferrying the dead down the rivers of the underworld. Souls drift toward you, each glowing with the color and symbol of one of three gods. Scoop them up and sail them into their god's shrine before they burn out. Every soul you let float past fills its god's rage, and a full bar brings down a smite. Buy scrolls at Hermes' stall and read their incantations aloud to calm the gods, while the river keeps coming.

**Platform.** A web game: a link anyone can open, nothing to install. Laptop first (keyboard), and phones held sideways (a touch stick). One 1280x720 landscape canvas, scaled to fit any screen.

**Pillars.** Each one traces back to a call in `DECISIONS.md`:

- **One more run.** Streaks, clutches, an exponential shop, and your best distance marked on the river as a target to beat. Lanterns and Charon's fee give second chances without ending the tension.
- **One thing gets harder at a time.** Levels bring the souls closer together; a new river runs faster but spreads them back out.
- **Speak to the gods.** Scrolls are used by saying their words aloud. The river never slows, so it doubles as a memory game.
- **Never wait on the network.** Every AI and voice path has a fallback, the game is fully playable without keys, and every spoken line is on screen too.

## 2. The loop

What the player does every few seconds:

1. **Scoop.** Steer anywhere on the water and touch drifting souls to take them aboard (3 at first). A soul starts burning down the moment you catch it: a ring around it shows its life, and it flickers near the end.
2. **Deliver.** Shrines drift by on both banks, and the HUD shows the gods of the next three. Sail into the pool of light at a shrine's portal to hand over every soul of its color for obols.
3. **Survive.** Missed and burnt-out souls fill their god's rage bar. A full bar is a smite: a lantern goes out. The last lantern ends the run, unless you pay Charon to return.
4. **Spend.** Every fourth bank feature is Hermes' stall. Docking pauses the river: buy Speed, Handling, Hold, or a scroll per god.
5. **Recite.** Carry a scroll, learn its two words, and say them aloud when its god is angry. Its rage drops by half a bar at once.

Underneath it all, every 6 souls delivered is a level, and every 3 levels the boat reaches a new, faster river.

## 3. Rules and numbers

Every number below lives in `src/config.js`. Distances are in screen pixels; the HUD shows metres (20 px = 1 m).

### The river and the boat

- The river (~545 px wide, meandering, each bank wandering on its own) scrolls down the middle at 110 px/s at the start. Its current runs 1.75x faster than the banks, for the look.
- The boat moves freely, shoot-'em-up style: 330 px/s top speed, 2400 px/s² acceleration, a slight glide when you let go (drag 7). Diagonals are not faster. It stays between the banks and within a band of the screen.
- Pickups and docking are distance checks against a capsule along the hull. There is no physics engine.

### Souls

- A new soul appears every 150 px of river on the first level; each level multiplies the gap by 0.88, each new river starts 0.93x tighter than the last, and it never drops below 58 px.
- Half the souls belong to one of the next two shrines, so a delivery is usually in reach. Shrines come in shuffled rounds of all three gods.
- A soul's lifespan is river travelled, not seconds: 16 s at the starting pace (1,760 px). On faster rivers it burns out sooner in seconds, so speed-ups really are harder.

### Deliveries, streaks and clutches

- A delivery hands over every soul aboard of that shrine's god. Each is worth `10 × e^(distance / 16,000 px)` obols (the value doubles about every 550 m), times the streak.
- Back-to-back deliveries build a streak: ×2, ×3, up to ×8. A soul that burns out resets it. Skipped souls don't: they already cost rage.
- A soul delivered with less than 20% of its life left is a **CLUTCH**: it counts double, with its own sound, a banner and a screen shake.

### Rage, smites and lanterns

- A missed soul (it leaves the bottom of the screen) or one that burns out in your hold adds 14% to its god's rage bar. Each soul delivered calms its god by 4%. At 75% the god warns you. From 50%, the screen edges glow in the angriest god's color, stronger and faster as its bar nears full, and if you carry that god's scroll its words float over the boat.
- A full bar is a smite: lightning strikes the boat and one lantern goes out, taking the souls aboard and the streak with it. The god who struck is appeased (rage to 0), the other two cool by 25%, and for 3 s the boat flickers and missed souls anger no one.
- Lanterns are lives: you start with 2 and can hold 3. Every 8th delivery in a row lights one.
- When the last lantern goes out, the boat sinks and the run is over.

### Charon's fee

The game-over screen offers to pay Charon to return with one lantern. The fee starts at 150 obols and climbs ×1.8 each time it's paid in a run (150, 270, 490, 870...), so obols held back at the stall are a way back. Out of reach, the screen shows the fee next to your obols.

### Levels and rivers

Tetris style: every 6 souls delivered is a level; every 3 levels, a new river of the underworld, each running 25% faster than the last.

| Levels | River | Pace |
|---|---|---|
| 1-3 | Acheron | ×1 |
| 4-6 | Styx | ×1.25 |
| 7-9 | Lethe | ×1.56 |
| 10-12 | Cocytus | ×1.95 |
| 13+ | Phlegethon | ×2.44, then ×1.25 more every 3 levels, like Tetris's kill screen |

A new river gets a banner ("II · Styx · the river quickens"), a rising whoosh, 1.5 s with no new souls, and its speed eases in over 1.5 s. A panel under the obols shows the river, the level and a bar of souls to the next one.

### Hermes' stall

The stall shows up every fourth bank feature (about every 20 s at the starting pace). Bank features alternate sides, so within a run the stall always stands on the same bank (which one is random). Dock anywhere along its jetty and pool of light; the river pauses. It is 3x2: upgrades on top, one scroll per god below. An upgrade costs `base × 1.8^level`, rounded to a friendly number.

| Item | Base price | Max level | Per level |
|---|---|---|---|
| Speed | 60 | 4 | The river runs 12% faster, on top of the rivers' own pace: more souls and obols per minute, more risk |
| Handling | 50 | 8 | +45 px/s top speed, +400 px/s² acceleration |
| Hold | 80 | 5 | +1 soul aboard (3 to 8) |
| Scroll (one per god) | 6 souls' worth at your distance | carry one per god | Its god's rage drops by half a bar (50%) when you say the words |

### Scrolls and incantations

- Each scroll carries a two-word incantation in crypto-Greek, the way Harry Potter's spells are crypto-Latin: real Greek roots tied to its god, solemn, never silly, and easy for an English speaker to read aloud ("Galene Thalassa": calm, O sea). The stall shows its meaning.
- Say it on the river and the scroll is used at once. Space (or a tap on the scrolls panel) shows your scrolls for 5 s over the left bank, but the river never slows: learn the words.
- Matching is by sound, not spelling, since any recognizer hears invented words as English ones ("Thalassa" as "the lasso"). Both words together pass at a 0.72 match, each word at least 0.7. One word alone is enough when it's said as a short phrase of its own (up to 3 words) at 0.86 (0.97 for short words like "Doru"); other people and the room talk in longer stretches.
- What the mic heard shows as a subtitle only when it comes close to a scroll, so chatter stays off screen. The mic dot in the scrolls panel flares on any speech.
- No mic (refused, or no way to listen): Space, then 1 / 2 / 3, or a tap on a scroll, reads one.

### Your best

This device remembers your best run, your last run and lifetime totals (runs, souls, clutches, obols, distance, deaths per god) in localStorage; there are no accounts. Your best distance is a line of floating lights across the river, labelled on the bank; crossing it pops "New best!". The game-over screen says how the run compares, and the title shows your best and the souls you've ferried. A run revived by Charon's fee counts once. `?fresh` in the URL forgets it all.

## 4. Controls

Laptop first. Keys are read by physical position (`event.code`), so WASD works as ZQSD on French AZERTY keyboards with one binding. Never more than 2 held keys plus 1 tap: laptop keyboards drop keys.

| Action | Keyboard | Phone held sideways |
|---|---|---|
| Steer | WASD / ZQSD or the arrow keys | Put a thumb down anywhere and slide: the boat heads that way at full speed, and glides to a stop when you lift |
| Start | Click, Space or Enter | Tap (Android also goes fullscreen) |
| Show your scrolls | Space | Tap the scrolls panel |
| Use a scroll | Say its words | Say its words |
| Use a scroll, no mic | Space, then 1 / 2 / 3 | Tap the panel, then a scroll |
| Buy at the stall | 1-6 or a click (1-3 upgrades, 4-6 scrolls) | Tap an item |
| Cast off | Space or Esc | The Cast off button |
| Pause | Esc or P | The pause button, top right |
| Mute (voices too) | M | The sound toggle on the pause screen |
| How to play | H, or the button on the pause screen | The button on the pause screen |
| Pay Charon | 1, or a click on his offer | Tap his offer |
| Drift again | Space or Enter (after a short delay) | Tap anywhere else |

The run pauses when the window loses focus, the tab is hidden, or a phone turns upright ("turn your phone sideways"), so keys can't get stuck. All input goes through `src/controls.js` as one move vector plus named actions; `?touch` tries the phone controls on a laptop with a mouse drag.

## 5. Screens and flow

```
Boot ──> River (attract mode: the boat steers itself) + Title
            │ click, Space/Enter or tap: sound unlocks, the run starts
            v
         River (the run) ──> Tutorial (first run of a browser session, or H)
            │        ├──> Shop (dock at Hermes' stall)       the river pauses
            │        └──> Pause (Esc / P / button / looked away)  under each
            │ the last lantern goes out
            v
         GameOver ──> pay Charon: back to the same run with one lantern
                  └─> drift again: a fresh run (no title, no tour)
```

- **Title.** The river runs behind it in attract mode: the boat chases souls and delivers them by itself. The first click, Space, Enter or tap starts the run and unlocks audio (browsers only allow sound after a user gesture; phones only at the end of a tap).
- **How-to-play tour.** Ines's tutorial design from her River Flow prototype. Over the paused river, the screen dims except a spotlight that moves from the boat to a soul, a shrine, the rage bars, the obols and the scrolls, each with a caption card. Steps move on after 4.5 s (the last after 1.8 s), or on Space, Enter, a click or a tap; Esc or Skip ends it. It opens once per browser session (sessionStorage), and on the first run it replaces the opening tips.
- **One-time tips.** The first time something happens (first pickup, full hold, first streak, first lantern, first level...), a short toast explains it.
- **Game over.** "Athena smote you.", then your level, river, souls, obols earned, best streak and clutches, how the run compares with your best, Charon's offer, and Hades's spoken verdict.

## 6. AI and voice

The hack asked for at least two partner tools. Afterflow uses Gemini while you play and Gradium in three ways: to design the gods' voices, to record their lines, and to hear the player. All keys stay on our server.

### Gemini writes the incantations

- Every scroll's two words and their meaning are written by Gemini (`gemini-3.5-flash-lite` by default) through `askAI()`, with a JSON schema. The prompt gives real Greek roots per god in sayable forms (glaux, polemos, thalassa...).
- They're written in the background: one per god at the start of a run, and a fresh one after each purchase. Buying never waits.
- Each answer must pass a pronounceability check in code (2 to 4 syllables a word, never three vowels in a row, no "ao" or "uo", no consonant pile-ups, no openings like "ps" or "chth"), with one retry. A prompt alone couldn't guarantee it.
- Fallback: five canned incantations per god, used in mock mode, on errors, on timeouts (8 s), and when Gemini's words fail the check. The game never shows a missing word.

### Gradium speaks: the gods' recorded voices

- Fede designed the gods' voices with Gradium Voice Design, each from a written description, and the four were chosen from his candidates: Athena (a calm, precise, disappointed teacher), Ares (an enraged low Viking warlord), Poseidon (a storm king) and Hades (a cold aristocrat, Charon's master). The prompts and lines live in `src/npc-voices/<god>.js`.
- `npm run npc:audio` recorded every line with Gradium text-to-speech ahead of time: 89 lines, shipped as mono 64 kbps MP3 in `public/npc-voices/<god>/` (about 1.5 MB in all). Nothing is generated at play time, so voices cost no credits, no network and no wait during the demo.
- When they speak: Hades at run start; the god whose soul you lose shouts half the time; a soul about to burn out makes its god say hurry (once per soul); a god speaks up as its rage passes 50% and again at 75%; streaks of 3, 5 and every 8th earn praise; every smite; and Hades's verdict on the game-over screen (five monologues of 9 to 13 s), which stops when you pay Charon or drift again.
- One line at a time: a more urgent line cuts in (verdict, then smite and run start, then the rage warnings), and small talk (shouts, hurries, streaks) waits 2.5 s after the last line. A shuffle bag per god and moment means no line repeats until the others have played.
- While the mic listens for an incantation, shouts and hurries stay quiet: the gods' voices from the speakers could reach it.
- Every line is on screen too, in a bubble pointing at its god's rage bar (Hades's over the river, and under the game-over screen). Voices play through the game's own audio output, so M mutes them with everything else.

### Gradium listens: incantations heard with speech-to-text

- While you carry a scroll, the game listens. A small voice detector in the browser learns the room's noise floor and cuts the mic into short clips at pauses: speech starts at 3x the floor, a clip ends after 0.6 s of quiet or at 4 s, keeps 0.25 s from just before the first sound, and anything under 0.3 s (a cough, a knock) is dropped.
- Each clip goes to our `/api/stt` route as a 16-bit mono WAV at 24 kHz, and from there to Gradium's speech-to-text, with the carried incantations' words boosted as keywords so they come back spelled right. A shorter model lookahead brings a clip back in about 1.4 s.
- Phrases heard within 6 s of each other are matched together, so a pause between the two words is fine. The mic runs with echo cancellation, noise suppression and auto gain.
- The mic is asked for when you buy your first scroll, while the stall has the game paused, so the permission prompt never interrupts a run.
- Fallback: with no Gradium key on the server (mock mode), or after 3 failed clips in a row, the browser's own speech recognition takes over (Chrome, Edge, Safari). With no mic at all, scrolls are read with keys or taps.

### When things fail

| What fails | What the player gets |
|---|---|
| No Gemini key, a Gemini error or a timeout | Canned incantations, same scroll flow |
| No Gradium key | Recorded voices still play (they're files); the browser's recognizer hears incantations |
| Gradium speech-to-text keeps failing | The browser's recognizer takes over for the session |
| Mic refused, or no way to listen | Scrolls are read with Space then 1 / 2 / 3, or taps |
| Sound muted or phone on silent | Every line and every tip is on screen |
| A portal sprite sheet fails to load | That god's shrine falls back to a stone arch drawn by code |
| localStorage blocked (private browsing) | The game works the same and forgets on reload |

## 7. Look and sound

### Art

- View: 3/4 top-down 2D on the landscape canvas. The river (about 545 px wide) runs down the middle; the banks hold shrines and the stall at the water's edge; the HUD sits on the outer edges (rage bars, lanterns, distance and scrolls on the left; obols, streak, hold, next shrines and the level on the right).
- Art direction: Ines's River Flow prototype. A glowing violet river on dark water, misty grey-green banks with pines, ferns and red spider lilies, souls as glowing bubbles with their god's symbol.
- Ines's pieces in the game:
  - **Water**, ported from her river study (`afterflow-riviere.html`): a shallow-to-deep body, a flowing surface, current lines faster mid-stream, serpentine lifestream ribbons, glints, and foam along the banks. Drawn with Canvas 2D into one texture per frame (`src/water.js`, about 2 ms a frame), which kept her look exactly.
  - **Banks**, drawn by code after her study: her ground, an uneven shoreline with a muddy strip, and her pines, ferns, rocks (half of them on the waterline, with eddies) and spider lilies, at her densities.
  - **Atmosphere**: drifting fog banks, a grey tint, haze at the top and bottom, floating spores and darkened edges. Most of the fog, the tint and the haze sit under the souls and the boat so gameplay stays crisp; a few lighter fog banks and the spores drift above (`fogAmount` 0.75).
  - **Portals**: her animated Afterflow gates, as sprite sheets (8x4 frames of 327x299, 8 fps), set at an angle on the bank and spilling a pool of light in their god's color onto the water. Matched by color: her gold sheet is Athena, red is Ares, and her Poseidon sheet shifted to seafoam is Poseidon, with our owl, spear and trident medallions over her symbols.
  - **The tour**: her spotlight-and-caption tutorial design.
- Everything else is drawn by code at boot (`src/art.js`) under the asset manifest's keys: the boat, souls, obols, Hermes' stall (a stand-in at the portals' angle and in their frame), shop icons, scrolls, props. A PNG in `public/assets/` plus one line in `src/assets.js` replaces any of them with no other code change. Glows, trails, sparks, burn-out flashes, lightning and the best-distance lights are always code.
- Type: Cormorant Garamond (display, italic) and Source Sans 3 (UI), from the prototype.

### Sound

- Effects are synthesized with Web Audio (`src/sfx.js`), with no files: pickup, deliver (its pitch climbs with the streak), streak break, **clutch** (its own sound), burn-out, skip, coin, shop open, buy, can't afford, rage warning, smite, lantern lit, level up, new river, new best, scrolls unrolling, and a scroll calming its god.
- Under them, one recorded ambient track, "Sacred River Echoes" (reevee, made with Suno, 3.5 min), plays from the first click and on through restarts. It loops whole, its last 8 s blended into its first 8 s, and downloads in the background at low priority so it never delays the title.
- Three buses under one master volume: effects, music and voices. M mutes all of it. A hidden tab goes silent.

## 8. Architecture

### Stack

- **Phaser 3.90**, pinned (coding agents know v3 far better than v4), with no physics engine.
- **Vite** for dev and build. Plain JavaScript ES modules: no TypeScript, no UI framework. Phaser is the only runtime dependency.
- **A small Node server layer** with no dependencies: the API proxies, shared by the Vite dev server, Vercel functions and a plain Node server.

### Keys stay on the server

```
browser (no keys)                                   server (keys live here only)
askAI()        src/ai.js      --> /api/gemini --> server/gemini.js --> Gemini generateContent
listen.js      mic clips, WAV --> /api/stt    --> server/stt.js    --> Gradium speech-to-text
speak()        src/voice.js   --> /api/tts    --> server/tts.js    --> Gradium text-to-speech
godSay()       recorded lines <-- public/npc-voices/<god>/*.mp3 (static files, made by npm run npc:audio)
                     (routes mounted by vite.config.js in dev, api/*.js on Vercel, server.js elsewhere)
```

| Route | GET | POST |
|---|---|---|
| `/api/gemini` | `live` or `mock`, and the model | `{ prompt, system?, schema?, temperature? }` → `{ text, data }` |
| `/api/stt` | `live` or `mock` | a WAV clip (`?words=` to boost) → `{ ok, text }`, or `{ ok, mock }` without a key |
| `/api/tts` | `live` or `mock` | `{ text, voice? }` → WAV audio. Not used during play (the gods' lines are recorded); `speak()` and `npcSay()` (from the console) use it |

Browser code never calls Google or Gradium directly, no key is in client code, and no env var is prefixed `VITE_` (that would ship it to every player).

### The code

| Where | What |
|---|---|
| `src/main.js` | Phaser config and the scene list |
| `src/config.js` | Every size, color and tuning number |
| `src/scenes/RiverScene.js` | The game itself: river, souls, shrines, the stall, the boat, rage, lanterns, levels, scrolls, voices and the HUD. Attract mode behind the title |
| `src/scenes/` | Boot (loads the manifest, draws placeholder art, waits for fonts), then overlays over the river: Title, Tutorial, Shop, Pause, GameOver |
| `src/river.js`, `src/water.js`, `src/noise.js` | The river's shape at any point; Ines's water; the seeded noise both use |
| `src/art.js`, `src/assets.js` | Placeholder art drawn at boot; the manifest of real files by key |
| `src/economy.js`, `src/save.js` | Soul value, prices, upgrade stats, Charon's fee, number formats; what the device remembers |
| `src/controls.js` | All input: one move vector plus named actions, from keys or the touch stick |
| `src/sfx.js` | Synthesized effects, the ambient track, and the voice output |
| `src/ai.js`, `src/scrolls.js` | `askAI()` with its fallback rule; incantations (written, checked, canned, matched by sound) |
| `src/listen.js`, `src/wav.js` | Hearing incantations: the voice detector, clips to `/api/stt`, the browser fallback; WAV encoding |
| `src/npc-voices/` | The gods' lines and voice prompts per god, the generated manifest, the picker (shuffle bags, cooldowns) and the player (one line at a time) |
| `src/voice.js`, `src/voices.js` | `speak()` with live Gradium TTS and the browser voice as its fallback; voice ids by key |
| `server/`, `api/`, `server.js` | The proxies; Vercel adapters; the Node server for any other host |
| `scripts/` | `check-ai`, `check-stt`, `npc-audio`, `test-npc-audio`, `voice` (list, design, keep), `decide` |

`AGENTS.md` has the full file map.

### Deploy

- **Vercel**, connected to GitHub: `main` deploys to production, and every pull request gets its own preview link to playtest before merging. `api/*.js` become the serverless proxies. Speech-to-text goes through short REST clips because Vercel functions can't hold a streaming WebSocket.
- **Any Node host**: `npm run build && npm start` serves the game and the proxies on `$PORT`. The Dockerfile does the same for Fly.io.
- Keys: `GEMINI_API_KEY` and `GRADIUM_API_KEY` (plus optional `GEMINI_MODEL` and `GRADIUM_VOICE_ID`), set as host secrets. Without them, everything runs in mock mode.

### Performance

- The water is one Canvas 2D texture redrawn each frame, about 2 ms.
- The ambient track downloads at low priority and is decoded once, into one buffer, so its loop is sample-exact.
- The gods' lines download behind the title and are decoded once sound is unlocked, so they play instantly.
- Nothing touches the network per frame: Gemini runs at run start and after purchases; speech-to-text runs once per spoken phrase, only while you carry a scroll.

## 9. How we built it

### The team

| Who | What they did |
|---|---|
| Alex | Repo, integration, AI wiring, deploy, the demo build |
| Gleb | Game design, pitch |
| Ines | Art and UI: the water, banks, atmosphere, portals and tour design, from her River Flow prototype and Afterflow studies |
| Fede | The gods' voices: Gradium voice design, the lines and their recordings; backend |

### The process

- **Design first.** At 12:52 the design was locked in `GAME.md`: a downstream runner, three gods, rage bars, souls that burn out, exponential shops. The river had to be fun before any AI went in.
- **Coding agents in parallel.** Most code was written by Claude Code sessions running side by side, each in its own git worktree on its own branch, one feature per pull request. Every session reads `AGENTS.md`, `GAME.md` and `DECISIONS.md` first.
- **main always playable.** Every pull request gets its own Vercel preview link, to playtest before it merges, and `npm run build` must pass before every commit.
- **Every call logged.** `DECISIONS.md` is append-only: one line per decision with its time, its reason and who made it. It now holds about a hundred lines, from "web game, not native" to how many milliseconds of pre-roll the voice detector keeps. Reversals are new lines, so the log reads as the story of the day.
- **Placeholders that look finished.** Art was drawn by code under the manifest's keys from the start, so the game looked whole early and Ines's pieces dropped in by key.

### Timeline (Paris time)

| Time | What landed |
|---|---|
| 12:52 | Design locked |
| 15:04 | v1: the river runner, playable end to end with placeholder art and synthesized sound (#1) |
| 16:11 | Phones: touch stick, tap prompts, pause button, turn-sideways screen (#3) |
| 16:21 - 16:38 | Ines's water, souls burning out with a flash, Ines's banks (#4, #5, #7) |
| 17:03 | The first-run how-to-play tour (#8) |
| 17:19 | Ines's atmosphere (#10) |
| 17:24 - 17:51 | Scrolls with spoken incantations written by Gemini, lanterns and Charon's fee, saves and the best-distance mark, sayable incantations (#11, #9, #13, #12) |
| 17:53 - 18:13 | Ines's animated portals, a tour step for scrolls, Hermes' stall at the portals' angle, levels and rivers, docking anywhere in the pool of light (#14, #15, #18, #16, #20) |
| 18:21 - 18:29 | The ambient track, the gods' recorded voices and Hades's verdict, incantations heard by Gradium speech-to-text (#17, #19, #21) |
| 18:30 | Feature freeze: only fixes and polish after this |

### Tools

| Tool | Used for |
|---|---|
| Gemini (Google AI Studio keys) | Writing every scroll's incantation, live, at run start and after each purchase |
| Gradium Voice Design | The four gods' voices, from written descriptions |
| Gradium text-to-speech | Recording the gods' 89 lines ahead of time (`npm run npc:audio`) |
| Gradium speech-to-text | Hearing the player's incantations, live |
| Claude Code | Most of the code, in parallel sessions, one pull request per feature |
| Suno | The ambient track (by reevee) |
| Vercel | Hosting, with a preview per pull request |

## 10. Not built, and what's next

- **Designed, not built:** obstacles that wreck the hull (lanterns are ready for them), a bullet-hell arena when a god's rage fills, weapons, a one-line life story for each soul, god reactions written fresh by Gemini (the recorded lines stand in), voice cloning (the ferryman repeating your incantation in your own voice).
- **Considered, not chosen:** golden hero souls, underworld zones, missions, a leaderboard or accounts.
- **Cut:** Unity and Voodoo; we built for the web.
- **Art still to come:** Ines's own drawn files for the boat, souls, stall, obol, icons and scrolls would replace the code-drawn ones by key (the banks and props are code ports of her study).
- **Tuning:** the targets are a first lantern lost after 60 to 90 s for a first-timer, a good run lasting 3 to 5 minutes, the Styx after about a minute of decent play, and about one upgrade affordable at each stall.

## 11. Known limits

- The mic on phones is untested. Phones steer, shop and read scrolls by tap either way.
- iPhones can't go fullscreen from the browser, short of Add to Home Screen; Android does on the first tap.
- Without a Gradium key, Firefox has no way to hear incantations (it has no built-in recognizer); scrolls are read with keys.
- The browser's fallback recognizer in Chrome sends audio to Google.
- Preview deployments sit behind Vercel's login; production doesn't.

## 12. Credits

- Game design: Gleb. Art and UI: Ines. Voices: Fede. Integration and deploy: Alex. Code: the team with Claude Code.
- Ambient track: "Sacred River Echoes" by reevee, made with Suno.
- Fonts: Cormorant Garamond and Source Sans 3 (Google Fonts).
- Built with Phaser 3 and Vite. Voices and speech-to-text by Gradium; incantations by Gemini.

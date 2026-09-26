# AGENTS.md: rules for every coding agent on this repo

Before any task, read `GAME.md` (what we are building, right now) and `DECISIONS.md` (why things are the way they are).
If a request conflicts with either, ask the human. Don't quietly undo a logged decision.

## The one rule

The game must be playable at every commit on `main`. The live demo is at 20:00, and a broken main costs the whole team the demo.

## Team tools

- **Google AI Studio**: Gemini keys and prompt prototyping. Prompts that work in AI Studio move into `askAI()` calls.
- **Gradium**: text-to-speech and voice design (new voices from a text description).
- **Voodoo**: not used, we are a web game (see DECISIONS.md).
- **Devin**: autonomous coding agent for bounded tasks, works through PRs.

## Stack

- Phaser **3.90** (no physics engine: pickups and docking are simple distance checks). Pinned on purpose: agents know Phaser 3 best. Do not upgrade to Phaser 4 today.
- Vite for dev and build. Plain JavaScript ES modules. No TypeScript, no UI framework, no new build tools.
- Landscape 1280x720 logical canvas, scaled with `Phaser.Scale.FIT`. Laptop first: WASD, ZQSD (French AZERTY) and arrow keys; phones held sideways steer with a floating touch stick. Read input only through the controls module (a move vector plus actions), which turns both into the same move vector. Anything new the player does needs a tap path too, and its prompt should check `isTouch()` ("tap" instead of a key name).
- Hosting: Vercel, connected to GitHub. `main` deploys to production and every PR gets its own preview link: playtest the preview before merging.
- All keys stay on the server. Browser code calls `askAI()` (`src/ai.js`, Gemini) and `speak()` (`src/voice.js`, Gradium), which hit our own `/api/gemini` and `/api/tts` routes. Never call Google or Gradium from the browser, never put a key in client code, never prefix env vars with `VITE_` (that would ship the key to every player).

## Where things live

| Path | What |
|---|---|
| `GAME.md` | The design, current state only |
| `DECISIONS.md` | Append-only log of decisions and why |
| `src/main.js` | Phaser config and scene list |
| `src/config.js` | Sizes, colors, the gods, tuning knobs and shop upgrades. Put magic numbers here |
| `src/assets.js` | Asset manifest: key -> file in `public/assets/`. A real file replaces that key's placeholder |
| `src/art.js` | Placeholder art drawn by code at boot, under the same keys as the manifest |
| `src/controls.js` | All input: `moveVector()` (keys, or the touch stick) plus actions (pause, mute, confirm, help, buy1-6) by physical key; `isTouch()`, `onAway()` |
| `src/sfx.js` | Sound effects synthesized with Web Audio, and the looping ambient track (`public/assets/ambient.mp3`); `voiceOut()`, where the gods' recorded lines play |
| `src/save.js` | What this device remembers between runs (localStorage): best run, last run, lifetime totals. `?fresh` forgets it |
| `src/river.js`, `src/economy.js` | River shape; soul value, prices, upgrade stats, Charon's fee, number formats |
| `src/ai.js` | `askAI({ prompt, system, schema, fallback })`, `getAIStatus()` |
| `src/scrolls.js` | Scroll incantations (Gemini, canned fallback) and matching what the player said |
| `src/listen.js` | `setListening()`, `useHeard()`, `canListen()`: the browser's speech recognition for incantations |
| `src/voice.js` | `speak(text, { voice })`, `prepareSpeech()`, `stopSpeaking()`, `getVoiceStatus()` |
| `src/voices.js` | Voice manifest: character key -> Gradium voice id |
| `src/npc-voices/` | Gods' voice lines (`ares.js`...), `getHeroAudio(name, moment)` picks a pre-recorded line from `manifest.js` (generated), `godSay(name, moment)` plays it in the game, one line at a time (`player.js`). Audio in `public/npc-voices/<god>/` |
| `src/scenes/BootScene.js` | Loads the manifest, draws placeholder art, waits for fonts |
| `src/scenes/RiverScene.js` | The game: river, souls, shrines, shops, boat, rage, lanterns (lives), HUD. Attract mode behind the title |
| `src/scenes/TitleScene.js`, `TutorialScene.js`, `ShopScene.js`, `PauseScene.js`, `GameOverScene.js` | Overlays on top of the river (the tutorial is the first-run how-to-play tour, its steps at the top of the file) |
| `server/gemini.js`, `server/tts.js` | The proxies, shared by the dev server, Vercel and `server.js` |
| `api/*.js`, `server.js` | Deploy adapters (Vercel, and Node/Docker for Fly) |
| `scripts/` | `check-ai`, `decide`, `voice` (list, design, keep voices) |

## Conventions

- Every `askAI` call passes a `fallback`, and the game must work with it (mock mode, errors, timeouts). Show a placeholder while waiting. Never block input on AI.
- Use `schema` (JSON) for anything game logic reads. Plain text only for flavor.
- Keep AI off the hot path: call it on scene start, level transitions, game over or in the background. Never per frame.
- Voice lines: one or two sentences. Anything the player needs must also be on screen (phones are often muted). Never make gameplay wait on audio. If you know a line in advance, `prepareSpeech()` it so it plays instantly.
- Voices are referred to by key from `src/voices.js`, never by raw id in scenes.
- Refer to art only by manifest key. New art = a file in `public/assets/` + one line in `src/assets.js`.
- Small, focused changes: one feature per commit. Run `npm run build` before committing.
- Ask before adding a dependency.
- When a human makes or changes a call (mechanic, scope, controls, tech), in the same commit: update GAME.md to the new state, and append one line to DECISIONS.md as `- HH:MM · decision · why · who`. Never edit old lines; a reversal is a new line.
- Log your own notable technical choices the same way (a new dependency, a workaround, something cut for time).

## Commands

- `make up` / `make down` / `make re`: start, stop and restart the dev server in the background (output in `dev.log`, `make logs` to follow it); `make update` pulls `main`, reinstalls dependencies and restarts the server if it was running
- `npm run dev`: dev server with the API routes at http://localhost:5173 (also on the LAN for phone testing)
- `npm run build`: production build, must pass before every commit
- `npm run check:ai`: one real call each to Gemini and Gradium
- `npm run voices`, `npm run voice:design -- "description"`, `npm run voice:keep -- <id> "Name"`: Gradium voices
- `npm run npc:audio`: records every god's lines into `public/npc-voices/` as MP3 and rewrites the manifest (skips existing files; needs ffmpeg, WAV originals kept in `voice-candidates/masters/`); `npm run test:npc` checks the picker
- `npm run decide -- "Cut the leaderboard · no time"`: appends a timestamped line to DECISIONS.md
- Add `?debug` to the URL to see the hull and dock zones, and whether AI and voice are live. `window.game` is exposed in the console.
- Add `?touch` to the URL to try the phone controls on a laptop: tap prompts, and a mouse drag steers.
- Add `?fresh` to the URL to forget saved runs (best, mark on the river, totals), as on a first visit.

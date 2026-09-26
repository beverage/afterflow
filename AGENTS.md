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

- Phaser **3.90** with Arcade physics. Pinned on purpose: agents know Phaser 3 best. Do not upgrade to Phaser 4 today.
- Vite for dev and build. Plain JavaScript ES modules. No TypeScript, no UI framework, no new build tools.
- Landscape 1280x720 logical canvas, scaled with `Phaser.Scale.FIT`. Laptop first: WASD, ZQSD (French AZERTY) and arrow keys. Read input only through the controls module (a move vector plus actions) so touch can be added later for mobile.
- Hosting: Vercel, connected to GitHub. `main` deploys to production and every PR gets its own preview link: playtest the preview before merging.
- All keys stay on the server. Browser code calls `askAI()` (`src/ai.js`, Gemini) and `speak()` (`src/voice.js`, Gradium), which hit our own `/api/gemini` and `/api/tts` routes. Never call Google or Gradium from the browser, never put a key in client code, never prefix env vars with `VITE_` (that would ship the key to every player).

## Where things live

| Path | What |
|---|---|
| `GAME.md` | The design, current state only |
| `DECISIONS.md` | Append-only log of decisions and why |
| `src/main.js` | Phaser config and scene list |
| `src/config.js` | Sizes, colors and tuning knobs. Put magic numbers here |
| `src/assets.js` | Asset manifest: key -> file in `public/assets/` |
| `src/ai.js` | `askAI({ prompt, system, schema, fallback })`, `getAIStatus()` |
| `src/voice.js` | `speak(text, { voice })`, `prepareSpeech()`, `stopSpeaking()`, `getVoiceStatus()` |
| `src/voices.js` | Voice manifest: character key -> Gradium voice id |
| `src/scenes/BootScene.js` | Loads the manifest, checks AI and voice status |
| `src/scenes/GameScene.js` | Example loop (to be replaced by our game) |
| `src/scenes/GameOverScene.js` | Example AI + voice hook: Gemini JSON verdict, read out by Gradium |
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

- `npm run dev`: dev server with the API routes at http://localhost:5173 (also on the LAN for phone testing)
- `npm run build`: production build, must pass before every commit
- `npm run check:ai`: one real call each to Gemini and Gradium
- `npm run voices`, `npm run voice:design -- "description"`, `npm run voice:keep -- <id> "Name"`: Gradium voices
- `npm run decide -- "Cut the leaderboard · no time"`: appends a timestamped line to DECISIONS.md
- Add `?debug` to the URL to see hitboxes. `window.game` is exposed in the console.

# Afterflow

Ferry the dead down the rivers of the underworld. Scoop up drifting souls and sail each one into its god's shrine before it burns out, or the gods' rage sinks you. Buy scrolls at Hermes' stall and read their incantations aloud to calm the gods, while the river keeps coming.

A web game made in one day at the {Tech: Europe} AI Gaming Hack, Paris, 26 September 2026, by Alex, Gleb, Ines and Fede.
Phaser 3 and Vite, with Gemini writing the incantations and Gradium giving the gods their voices and hearing yours.

## Play

- **Steer** with WASD (ZQSD on AZERTY) or the arrow keys. On a phone held sideways, slide a thumb anywhere.
- **Touch a soul** to take it aboard. Its color and symbol say which god it belongs to: Athena (gold owl), Ares (crimson spear), Poseidon (seafoam trident).
- **Sail into the light** at a god's shrine to deliver its souls for obols. Back-to-back deliveries build a streak; a soul saved at the last moment is a CLUTCH.
- **Don't let souls float past.** Each one fills its god's rage bar. A full bar puts out one of your lanterns; the last one sinks you, unless you pay Charon's fee.
- **Dock at Hermes' stall** to buy Speed, Handling, Hold, or a scroll. Say a scroll's two words aloud and its god calms down. Space shows your scrolls, but the river won't wait.
- Every 6 souls is a level, and every 3 levels a new, faster river: the Acheron, the Styx, the Lethe, the Cocytus, the Phlegethon.

Esc pauses, M mutes, H replays the how-to-play tour.

## Run it (60 seconds)

```bash
npm install
cp .env.example .env    # paste GEMINI_API_KEY and GRADIUM_API_KEY (both optional: mock mode without them)
npm run dev             # http://localhost:5173, plus a Network URL for phones on the same Wi-Fi
```

Needs Node 20.19+ (or 22.12+). `make up` / `make down` run the dev server in the background instead.

Without keys the game is fully playable: incantations come from a canned list, the gods' voices are recorded files anyway, and the browser's own speech recognition hears the incantations (Chrome, Edge, Safari). With no mic at all, Space then 1 / 2 / 3 reads a scroll.

Useful URL flags: `?debug` (hull and dock zones, whether AI and voice are live, what the mic hears), `?touch` (phone controls on a laptop), `?fresh` (forget saved runs, as on a first visit).

## How it's wired

```
browser (no keys)                                   server (keys live here only)
askAI()        src/ai.js      --> /api/gemini --> server/gemini.js --> Gemini generateContent
listen.js      mic clips, WAV --> /api/stt    --> server/stt.js    --> Gradium speech-to-text
speak()        src/voice.js   --> /api/tts    --> server/tts.js    --> Gradium text-to-speech
godSay()       recorded lines <-- public/npc-voices/<god>/*.mp3 (made ahead by npm run npc:audio)
                     (routes mounted by vite.config.js in dev, api/*.js on Vercel, server.js elsewhere)
```

- `GET` on each route reports `live` or `mock`. Without a key, a route answers in mock mode and the browser uses its fallback.
- `POST /api/gemini` with `{ prompt, system?, schema?, temperature? }` returns `{ text, data }`. With a `schema`, `data` is parsed JSON. Default model `gemini-3.5-flash-lite`; set `GEMINI_MODEL` to change it.
- `POST /api/stt?words=...` with a WAV clip returns `{ ok, text }`, the listed words boosted so invented ones come back spelled right.
- `POST /api/tts` with `{ text, voice? }` returns WAV audio (48 kHz mono).

## Tools

```bash
npm run build           # production build, must pass before every commit
npm run check:ai        # one real call to Gemini and one to Gradium TTS
npm run check:stt       # one real Gradium speech-to-text round trip
npm run npc:audio       # record the gods' lines with Gradium into public/npc-voices/ (needs ffmpeg)
npm run voices          # the Gradium voices your key can use
npm run decide -- "Cut the leaderboard · no time"   # log a decision in DECISIONS.md
```

New voice from a description (Gradium Voice Design): `npm run voice:design -- "a gravelly old pirate captain, theatrical" --n 3` saves an audition WAV per candidate in `voice-candidates/`; `npm run voice:keep -- <id> "Pirate Captain"` prints the permanent id.

## Deploy

- **Vercel** (what we use): connected to GitHub, `main` deploys to production and every pull request gets a preview link. Set `GEMINI_API_KEY` and `GRADIUM_API_KEY` in the project's environment variables; `api/` becomes the proxies.
- **Fly.io:** `fly launch` (uses the Dockerfile), `fly secrets set GEMINI_API_KEY=... GRADIUM_API_KEY=...`, `fly deploy`.
- **Any Node host:** `npm run build && npm start` (serves on `$PORT`, default 8080).

## The docs

| File | What |
|---|---|
| [`DESIGN.md`](DESIGN.md) | The design and development write-up: every system and its numbers, AI and voice, architecture, how we built it |
| [`GAME.md`](GAME.md) | The living design doc: current rules, controls, look and sound, scope |
| [`DECISIONS.md`](DECISIONS.md) | Every call we made today, with its time, its reason and who made it |
| [`AGENTS.md`](AGENTS.md) | Rules and the file map for coding agents (Claude Code gets it through `CLAUDE.md`) |

## Demo-day checklist

- `?debug` on the deployed URL shows **AI live** and **Voice live** on the title, not mock.
- Tested on a real phone, with the sound on.
- Backup video of a good run recorded by 18:30.
- `?fresh` for a clean first run on stage (the tour opens on the first run of each browser tab).
- After the event, delete the API keys or cap their budgets.

## Credits

Game design: Gleb. Art and UI: Ines (water, banks, atmosphere, portals and tour, from her River Flow prototype and Afterflow studies). The gods' voices: Fede, with Gradium. Integration and deploy: Alex. Code written with Claude Code.
Ambient track: "Sacred River Echoes" by reevee, made with Suno. Fonts: Cormorant Garamond and Source Sans 3.

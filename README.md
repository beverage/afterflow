# Hack game starter

Phaser 3 + Vite, portrait and touch first, with server-side proxies for Gemini (Google AI Studio) and Gradium (voice).
Made for the {Tech: Europe} AI Gaming Hack, Paris, 26 September 2026.
It plays out of the box: a tiny one-thumb dodge game whose game-over screen asks Gemini for a verdict and has Gradium read it out. Without keys, both run in mock mode.

## Start (60 seconds)

```bash
npm install
cp .env.example .env    # paste GEMINI_API_KEY and GRADIUM_API_KEY (both optional: mock mode without them)
npm run dev             # http://localhost:5173, plus a Network URL for phones on the same Wi-Fi
npm run check:ai        # one real call to Gemini and one to Gradium
```

Needs Node 20.19+ (or 22.12+). The top-left badge shows whether AI and voice are live or mocked.

## Share it with the team (first 10 minutes)

```bash
git init && git add -A && git commit -m "Starter"
gh repo create our-hack-game --private --source=. --push
```

Add teammates as collaborators. Every coding agent reads `AGENTS.md` (Claude Code gets it through `CLAUDE.md`, which also loads `GAME.md` and `DECISIONS.md`).
If a tool doesn't pick it up, start its prompt with "Read AGENTS.md, GAME.md and DECISIONS.md first."

When the team makes a call, log it in one line: `npm run decide -- "Cut the leaderboard · no time to secure it"`.
It saves re-arguing at 17:00, and the log doubles as the "how we built it" part of the demo.

## Voice (Gradium)

```js
import { speak, prepareSpeech } from './voice.js';
speak('Round two. Faster this time!', { voice: 'narrator' }); // resolves when the line ends, never throws
prepareSpeech('You win!', { voice: 'narrator' });              // fetch ahead so it plays instantly later
```

- Characters map to voice ids in `src/voices.js`. `npm run voices` lists the voices your key can use.
- New voice from a description (Gradium voice design, languages en, fr, es, pt, de):
  1. `npm run voice:design -- "a gravelly old pirate captain, theatrical" --n 3` saves an audition WAV per candidate in `voice-candidates/`
  2. `afplay voice-candidates/<id>.wav` to listen
  3. `npm run voice:keep -- <id> "Pirate Captain"` prints the permanent voice id for `src/voices.js`
- Browsers only play sound after the first tap, so trigger the first line after the player has touched the screen.
- Keep lines short. Anything the player needs should also be on screen, since phones are often muted.

## Deploy (get a public URL before lunch)

- **Vercel, fastest:** `npx vercel`, then `npx vercel env add GEMINI_API_KEY` and `npx vercel env add GRADIUM_API_KEY`, then `npx vercel --prod`. The `api/` folder becomes the proxies automatically.
- **Fly.io:** `fly launch` (uses the Dockerfile), `fly secrets set GEMINI_API_KEY=... GRADIUM_API_KEY=...`, `fly deploy`.
- **Any Node host:** `npm run build && npm start` (serves on `$PORT`, default 8080).

Venue Wi-Fi often blocks phone-to-laptop traffic. If the Network URL doesn't load on your phone, test on the deployed URL instead.

## How it's wired

```
browser (no keys)                        server (keys live here only)
askAI()  src/ai.js    --> /api/gemini --> server/gemini.js --> Gemini generateContent
speak()  src/voice.js --> /api/tts    --> server/tts.js    --> Gradium TTS (WAV)
                             (vite dev, api/*.js on Vercel, server.js elsewhere)
```

- `GET /api/gemini` and `GET /api/tts` report `live` or `mock`, shown in the corner badge.
- `POST /api/gemini` with `{ prompt, system?, schema?, temperature? }` returns `{ text, data }`. With a `schema`, `data` is parsed JSON.
- `POST /api/tts` with `{ text, voice? }` returns WAV audio (48 kHz mono).
- No key means mock mode: `askAI` returns the caller's `fallback`, and `speak` uses the browser's built-in voice.
- Default Gemini model is `gemini-3.5-flash-lite` (fast and cheap). Set `GEMINI_MODEL` to change it.

## Swap in your game

1. Fill in `GAME.md` together (10 minutes). Agents build from it.
2. Replace `src/scenes/GameScene.js` with your loop. Keep BootScene and the status badge.
3. Replace the example in `GameOverScene.js` with your game's real AI moment, copying the `askAI` + `speak` pattern.
4. Designers overwrite files in `public/assets/` (same names) and refresh.

## Demo-day checklist

- The corner badge on the deployed URL says **AI live** and **Voice live**, not mock.
- Tested on a real phone, with the sound on.
- Backup video of a good run recorded by 18:30.
- After the event, delete the API keys or cap their budgets.

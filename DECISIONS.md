# DECISIONS.md: why we chose what we chose

Append-only, newest at the bottom. One line per decision: `time · decision · why · who`.
Never edit or delete a line. To reverse a decision, add a new line that says so.
Fastest way to add one: `npm run decide -- "Cut the leaderboard · no time to secure it"`

## Starter defaults (made before the event, reverse with a new line if the team disagrees)

- starter · Web game, not native · the demo is a link anyone can open on a phone
- starter · Portrait, one-thumb touch controls · Voodoo publishes mobile hyper-casual games
- starter · Phaser 3.90, pinned · coding agents know v3 far better than v4
- starter · Gemini only through the server proxy · keeps the API key out of the browser
- starter · Default model gemini-3.5-flash-lite · fastest and cheapest, enough for in-game text
- starter · Every AI call has a fallback · a slow network or missing key must never break the demo
- starter · Gradium TTS through the server proxy, WAV output · key stays server-side, WAV plays in every browser
- starter · Browser speech as the voice fallback, text always on screen too · no key, no network or a muted phone still works

## Today

- 10:54 · Tools: Google AI Studio (Gemini), Gradium (TTS, voice design), Voodoo · chosen with the team · team
- 11:12 · Public GitHub repo (beverage/par-hack-game) · the hack needs a public repo · Alex
- 12:52 · Phaser web game, no Unity or Voodoo · team of 3-4 with a 2D artist, a link anyone can open, no engine install · team
- 12:52 · Game: ferry souls down a river to their gods' shrines, downstream runner, 3/4 top-down 2D · Gleb's design, the simplest shape for one thumb · team
- 12:52 · v1 is one continuous run: no saving, accounts or best score · scope; continuity comes in v2 · team
- 12:52 · One rage bar per god, only skipped souls fill it, any full bar ends the run · a single fail meter is easy to read · team
- 12:52 · Souls shrink and poof when their lifespan ends · forces regular deliveries · team
- 12:52 · Shops are riverside docks that pause the game, prices climb exponentially, Speed = faster river = more money and risk · the economy is a core stickiness hook · team
- 12:52 · Must-have hooks: streaks, clutch with its own sound, exponential shop · we expect to be judged on stickiness · team
- 12:52 · v2: AI gods (reactions, prayers, verdict, soul stories), prayers read aloud at full speed, obstacles, bullet hell · the river must be fun first · team
- 12:52 · Voice cloning is a stretch goal, only after spoken prayers work · biggest wow, biggest risk · team
- 13:03 · Laptop first: landscape 1280x720, keyboard controls; replaces the starter's portrait one-thumb default · Voodoo is out, we build for laptops · team
- 13:03 · Mobile maybe in v3; all input goes through one controls module so touch can plug in later · keeps the door open at almost no cost · team
- 13:03 · River flows top to bottom down the middle, shrines and shops on the side banks, HUD on the outer edges · keeps the vertical runner design on a wide screen · team
- 13:03 · Free 2D boat movement, shoot-'em-up style · control over timing, and the v2 bullet hell needs it · team
- 13:03 · Stay on Phaser 3 + Vite + plain JS; host on Vercel via GitHub with a preview link per PR · already wired, previews keep main playable · team
- 13:03 · Bind ZQSD next to WASD and the arrows · French AZERTY laptops at a Paris event · Claude

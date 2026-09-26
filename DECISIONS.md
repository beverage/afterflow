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

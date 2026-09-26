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
- 14:22 · Name: Soul Drift, for now · simple, catchy, has "soul" in it · team
- 14:22 · Art direction: the River Flow prototype's look on a top-down endless river, WASD runner mechanics unchanged · the team's strongest visual · team
- 14:22 · Gods: Athena gold (owl), Ares crimson (spear), Poseidon seafoam (trident) · blue souls vanish into the violet river; the team asked Claude to pick · Claude
- 14:58 · Placeholder art is drawn by code under the manifest keys; a PNG in public/assets replaces it with no code change · the game looks finished now and Ines's art drops in by key · Claude
- 14:58 · Water, light, glows and portal swirls are code; Ines's list is bank ground, boat, arch, stall, pier and props · matches the look preview and saves art time · Claude
- 14:58 · Sound effects and ambient drone synthesized with Web Audio, no audio files · no audio owner yet, nothing to download · Claude
- 14:58 · Fonts: Cormorant Garamond and Source Sans 3 from Google Fonts · the River Flow prototype's typefaces · Claude
- 14:58 · Keys read by physical position (event.code), so WASD works as ZQSD on AZERTY with one binding · simpler than binding both letter sets · Claude
- 14:58 · The streak resets when a soul poofs, not on skipped souls · skips already cost rage; breaking the streak too felt like double punishment · Claude
- 16:02 · Phones now, not v3: touch controls for a phone held sideways, built on the side in its own PR · no presentation to give, so we build to the buzzer · Alex
- 16:02 · Touch steering is a floating stick: slide anywhere and the boat heads that way at full speed, like a held key; lift to glide · keeps the boat's physics, so Handling still matters (1:1 finger drag would bypass it) · Alex
- 16:02 · Stick feel: 10 px dead zone, the ring trails the thumb past 34 px, slides within ~22° of straight snap straight (STICK in config.js) · taps don't steer, reversing is instant, and the keyboard-tuned braking still applies · Claude
- 16:02 · The title starts the run on tap release, and sound also wakes on touchend · phones only allow audio and fullscreen from the end of a tap, so sound was likely silent on phones · Claude
- 16:02 · The run also pauses when the tab is hidden or a phone turns upright, not just on window blur · phones switch apps without a blur · Claude

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
- 16:14 · Shelve PR #2 (turbulent river, rocky shore, burn-out flash, water ambience) · the team is taking Ines's water instead; revisit the rest later · team
- 16:14 · Water ported from Ines's river study (afterflow-riviere.html): body, flowing surface, current lines, lifestream ribbons, glints, bank foam; banks and atmosphere unchanged for now · the team liked her water; banks and atmosphere to be considered separately · team
- 16:14 · Ines's water is drawn with Canvas 2D into one texture per frame (src/water.js), not rebuilt in WebGL · keeps her look exactly and costs ~2 ms a frame · Claude
- 16:23 · Souls burn out with a flash (flare, shockwave, embers, fizzle) instead of going poof, and flicker first; brought over from shelved PR #2 · team's call · team
- 16:23 · The ambient hum was a synth drone; replaced by quiet flowing water with the odd droplet (AMBIENCE_VOLUME in sfx.js, 0 turns it off); brought over from shelved PR #2 · the hum sounded like a fault · team
- 16:28 · No background ambience: the flowing-water bed read as a constant hiss; silence between sound effects (AMBIENCE_VOLUME = 0 in sfx.js) · team
- 16:37 · Banks from Ines's river study: her ground (moss, earth, grass, pale flowers), uneven shoreline with a muddy strip, her pines, ferns, rocks (half on the waterline, with eddies) and spider lilies; reeds dropped · the team liked her banks · team
- 16:41 · Feature freeze moves from 17:30 to 18:30 · one more hour of feature work before the demo · Alex
- 16:43 · First-run how-to-play tour in Ines's design (her River Flow tutorial): over the paused river a spotlight moves from the boat to a soul, a shrine, the rage bars and the obols, each with a caption card; steps move on by themselves after 4.5 s, Space, a click or a tap moves on, Esc or Skip ends it · first-timers need the rules before the souls start floating past · Alex
- 16:43 · The tour shows once per browser session (sessionStorage): restarts and reloads skip it, a new tab shows it again; H, or How to play on the pause screen, replays it in place of Ines's "?" button · "first run of a fresh session"; a "?" in the HUD corner would sit where the phone pause button is · Claude
- 16:43 · The river pauses under the tour, where Ines's prototype kept flowing · uncaught souls would fill the rage bars while the player reads · Claude
- 16:43 · On the first run the tour replaces the "steer" and "touch a soul" toasts · they would repeat what the tour just said · Claude
- 16:49 · Lanterns are lives: start with 2, hold at most 3; a full rage bar puts one out instead of ending the run, and the last one ends it · second chances and stickiness, and a safety net for the live demo; obstacles will put out the same lanterns later · Alex
- 16:49 · After a smite the god who struck is appeased (rage to 0), the others cool by 25%, the souls aboard and the streak are lost, then 3 s of grace (the boat flickers, passing souls anger no one) · stops one full bar from chaining straight into the next, while the smite still costs something · Claude
- 16:49 · Every 8th delivery in a row lights a lantern · the streak multiplier caps at ×8, so long streaks had nothing left to chase · Claude
- 16:49 · HUD lanterns are small copies of the boat's bow lantern, under the rage bars; on the last one they and the bow light gutter · reads as lives without new art · Claude
- 16:56 · Rituals are scrolls, which are usables: Hermes' stall is 3x2 (upgrades on top, one scroll per god below), you carry one scroll per god at a time, each has a short incantation, and saying it into the mic uses it to calm that god; a key brings up your scrolls to re-read, but the game never slows, so it's a memory game too · replaces picking a god and reading a prayer off the screen · team
- 17:05 · Charon's fee: when the last lantern goes out, pay obols on the game-over screen to return with one lantern · unspent obols get a use at death, and a reason to hold some back at Hermes' stall · Alex
- 17:05 · At game over 1, or a click or tap on Charon's offer, pays; Space or a tap anywhere else starts a fresh run; out of reach, the screen shows the fee next to your obols · 1 is already the buy key and a held Space can't spend obols; showing the price teaches saving for it · Claude
- 17:05 · Atmosphere from Ines's river study: 16 drifting fog banks, grey tint, top/bottom haze, floating spores, vignette; fog, tint and haze sit under souls and the boat so gameplay stays readable; fogAmount 0.75 in config · the team liked her atmosphere · team
- 17:10 · Scroll details: Space (or a tap on the scrolls panel) shows them for 5 s; a scroll takes away half its god's rage; it costs 6 souls' worth at your distance; the mic is asked for at the first scroll purchase, not on the title screen · the stall has the game paused, so the permission prompt never interrupts a run · Claude
- 17:10 · Incantations heard with the browser's speech recognition (Web Speech API) and a fuzzy word match; no mic (Firefox, mic refused) → Space, then 1 / 2 / 3 reads a scroll · free and live, no new server route or key, and the game must work without a mic · Claude
- 17:10 · Gemini writes each incantation in the background (3 to 6 plain words, at run start and after each purchase), with canned lines per god as the fallback · plain words survive speech recognition, and buying never waits on AI · Claude
- 17:13 · The fee starts at 150 obols and climbs on the upgrades' curve, ×1.8 each time it's paid in a run (CHARON.basePrice in config.js, priced by the shop's own price()) · one price curve across the economy · Alex
- 17:20 · Incantations are two words of crypto-Greek, like the crypto-Latin spells of Harry Potter but built from Greek roots tied to the god, and not silly · Alex
- 17:23 · Incantations are matched by sound, not spelling (a sound key and a fuzzy alignment; SCROLLS.match 0.72, and each word 0.7 on its own), and the stall shows each one's meaning · the English recognizer hears invented words as English ones; requiring both words keeps table talk from using a scroll; the meaning helps players remember · Claude
- 17:47 · Shrines are Ines's angled, animated portals from her Afterflow sheets, matched by color: her gold (Apollo) sheet is Athena, red (Persephone) is Ares, her Poseidon hue-shifted to seafoam is Poseidon, with our owl, spear and trident medallions over her symbols · her portals face the river instead of the player; matching by color keeps our three gods, their colors and the HUD · team
- 17:47 · A shrine's dock is the pool of light in front of its portal (no pier), mirrored on the right bank; the code-drawn stone arch stays as a fallback if a sheet fails to load · the light is where boat and portal meet at her angle · Claude

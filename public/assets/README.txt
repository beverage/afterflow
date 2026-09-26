Drop-in art folder.

Every art key already has a placeholder drawn by code (src/art.js), so the game runs with no files here.
To use real art: put a PNG here, add one line to src/assets.js with its key, refresh.
The real file replaces the placeholder for that key; no other code changes.

Keys, sizes and notes: see the asset table in GAME.md (bank, boat, arch, shop, pier, obol, pines,
ferns, lilies, rocks, soul_<god>, icon_speed / icon_handling / icon_hold).
Keep files small (under ~500 KB each) so the game loads fast.

Not art: ambient.mp3 is the ambient track, played and looped by src/sfx.js. It downloads in the
background at low priority, so its size doesn't slow the start.

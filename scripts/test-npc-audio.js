// Checks getHeroAudio(): name aliases, shuffle bag (no repeats) and the per-god cooldown.
//   npm run test:npc
// Needs the manifest from `npm run npc:audio` with at least Ares recorded.
import assert from 'node:assert/strict';
import { AUDIO } from '../src/npc-voices/manifest.js';
import { getHeroAudio, resetHeroAudio } from '../src/npc-voices/picker.js';

const shouts = AUDIO.ares?.shout || [];
assert.ok(shouts.length > 1, 'run `npm run npc:audio` first: Ares needs at least 2 shouts');
const n = shouts.length;
let t = 0;
const next = (name = 'ares', moment = 'shout') => getHeroAudio(name, moment, { now: (t += 5000) }); // 5 s apart

// Names: any case, spaces, aliases. Unknown gods and moments return null.
resetHeroAudio();
assert.ok(next('Ares') && next(' ARES '));
assert.equal(getHeroAudio('zeus', 'shout', { now: (t += 5000) }), null);
assert.equal(next('ares', 'no_such_moment'), null);
if (AUDIO.athena) assert.ok(next('Athene'), '"athene" is an alias of athena');
else assert.equal(next('athene'), null, 'no Athena audio yet: null, not a crash');

// Shuffle bag: every block of n draws holds each shout once, never the same line twice in a row.
resetHeroAudio();
let previous = null;
for (let block = 0; block < 100; block++) {
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const { path } = next();
    assert.notEqual(path, previous, 'same line twice in a row');
    seen.add(path);
    previous = path;
  }
  assert.equal(seen.size, n, 'a block of draws repeated a line before playing them all');
}

// Cooldown: the same god within 3 s -> null, and the blocked call doesn't use up a line.
resetHeroAudio();
const first = getHeroAudio('ares', 'shout', { now: 0 });
assert.equal(getHeroAudio('ares', 'shout', { now: 1000 }), null);
assert.equal(getHeroAudio('ares', 'hurry', { now: 2000 }), null, 'cooldown is per god, not per moment');
const afterWait = getHeroAudio('ares', 'shout', { now: 3000 });
assert.ok(afterWait, 'speaks again once the cooldown is over');
assert.notEqual(afterWait.path, first.path);
assert.ok(getHeroAudio('ares', 'shout', { now: 3001, cooldown: 0 }), 'cooldown: 0 always plays');

// Blocked calls don't consume the bag: n successful draws still cover every shout.
resetHeroAudio();
const covered = new Set();
for (let i = 0, now = 0; covered.size < n && i < n * 4; i++, now += 1500) {
  const pick = getHeroAudio('ares', 'shout', { now }); // every other call lands in the cooldown
  if (pick) covered.add(pick.path);
}
assert.equal(covered.size, n);

console.log(`getHeroAudio OK: ${n} Ares shouts, aliases, shuffle bag and cooldown checked.`);

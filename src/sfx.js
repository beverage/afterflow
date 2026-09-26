// Sound effects synthesized with Web Audio, over one recorded ambient track (public/assets/ambient.mp3).
// Browsers only start audio after a click or key press, so call unlockAudio() from one.

let ac = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let ambience = null;

const AMBIENCE_VOLUME = 0.23; // the ambient track, well under the effects; 0 turns it off (and skips the download)
let muted = false;

export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ac.destination);
    sfxBus = ac.createGain();
    sfxBus.gain.value = 0.55;
    sfxBus.connect(master);
    musicBus = ac.createGain();
    musicBus.gain.value = 0.35;
    musicBus.connect(master);
  }
  if (ac.state !== 'running') ac.resume().catch(() => {});
}

// Phones only let audio start at the end of a tap, and iOS suspends it when you switch apps:
// wake it again on the next tap or key.
for (const type of ['pointerup', 'touchend', 'keydown']) {
  window.addEventListener(type, () => ac && ac.state !== 'running' && ac.resume().catch(() => {}), true);
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.03);
  return muted;
}

export const isMuted = () => muted;

function tone(freq, { type = 'sine', dur = 0.2, vol = 0.3, attack = 0.005, at = 0, slide = 0 } = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(sfxBus);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.3, vol = 0.3, freq = 1200, q = 0.8, type = 'bandpass', at = 0, sweep = 0 } = {}) {
  if (!ac) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ac.currentTime + at;
  const src = ac.createBufferSource();
  const f = ac.createBiquadFilter();
  const g = ac.createGain();
  src.buffer = noiseBuf;
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t0, Math.random() * 1.5);
  src.stop(t0 + dur + 0.05);
}

const GOD_NOTE = [880, 659.25, 783.99]; // Athena A5, Ares E5, Poseidon G5

export const sfx = {
  pickup(god = 0) {
    const f = GOD_NOTE[god] || 880;
    tone(f, { dur: 0.18, vol: 0.22 });
    tone(f * 1.5, { dur: 0.22, vol: 0.12, at: 0.05 });
  },
  // One chime whose pitch climbs with the streak.
  deliver(streak = 1) {
    const base = 392 * Math.pow(2, (Math.min(streak - 1, 10) * 2) / 12);
    [1, 1.25, 1.5].forEach((m, i) => tone(base * m, { type: 'triangle', dur: 0.4, vol: 0.18, at: i * 0.045 }));
    tone(base * 2, { dur: 0.5, vol: 0.08, at: 0.12 });
  },
  streakBreak() {
    tone(330, { type: 'triangle', dur: 0.35, vol: 0.18, slide: 0.5 });
  },
  // The one sound nothing else makes: a bright rising arpeggio, a shimmer and a low thump.
  clutch() {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.5, vol: 0.2, at: i * 0.06 }));
    noise({ dur: 0.6, vol: 0.12, freq: 6000, type: 'highpass', at: 0.05 });
    tone(110, { dur: 0.5, vol: 0.3, slide: 0.5 });
  },
  // A soul burning out: a bright fizzle, a falling ping and a soft thump.
  burnOut() {
    noise({ dur: 0.3, vol: 0.2, freq: 2500, type: 'highpass', sweep: 0.35 });
    tone(1760, { type: 'triangle', dur: 0.32, vol: 0.14, slide: 0.45 });
    tone(95, { dur: 0.28, vol: 0.2, slide: 0.6 });
  },
  skip() {
    tone(196, { dur: 0.25, vol: 0.12, slide: 0.8 });
  },
  coin() {
    tone(2093 * (0.97 + Math.random() * 0.06), { type: 'square', dur: 0.05, vol: 0.035 });
  },
  shopOpen() {
    noise({ dur: 0.08, vol: 0.3, freq: 300, type: 'lowpass' });
    tone(1318.5, { dur: 0.6, vol: 0.12, at: 0.05 });
    tone(1975.5, { dur: 0.7, vol: 0.08, at: 0.1 });
  },
  buy() {
    tone(1567.98, { type: 'square', dur: 0.08, vol: 0.08 });
    tone(2093, { type: 'square', dur: 0.12, vol: 0.07, at: 0.07 });
  },
  cantAfford() {
    tone(140, { type: 'sawtooth', dur: 0.18, vol: 0.12 });
  },
  rageWarn() {
    tone(98, { type: 'sawtooth', dur: 0.5, vol: 0.14, slide: 0.9 });
    tone(92, { type: 'sawtooth', dur: 0.5, vol: 0.1 });
  },
  smite() {
    noise({ dur: 0.15, vol: 0.4, freq: 4000, type: 'highpass' });
    noise({ dur: 1.6, vol: 0.5, freq: 900, type: 'lowpass', sweep: 0.15 });
    tone(80, { dur: 1.2, vol: 0.45, slide: 0.4 });
  },
  // A lantern is lit: a match strike, then a warm rising swell.
  lanternLit() {
    noise({ dur: 0.07, vol: 0.18, freq: 3200, q: 1.2 });
    [392, 587.33, 783.99].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.7, vol: 0.13, attack: 0.03, at: 0.05 + i * 0.07 }));
    tone(1567.98, { dur: 0.9, vol: 0.05, attack: 0.08, at: 0.2 });
  },
  // Passing your best: a warm rising fanfare, lower and longer than the clutch.
  newBest() {
    [392, 493.88, 587.33, 783.99].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.8, vol: 0.16, attack: 0.02, at: i * 0.09 }));
    tone(1174.66, { dur: 1.2, vol: 0.06, attack: 0.1, at: 0.35 });
    noise({ dur: 0.9, vol: 0.06, freq: 5000, type: 'highpass', at: 0.3 });
  },
  tap() {
    tone(1200, { dur: 0.05, vol: 0.08 });
  },
  // A level: two soft rising notes.
  levelUp() {
    tone(587.33, { type: 'triangle', dur: 0.3, vol: 0.14 });
    tone(880, { type: 'triangle', dur: 0.5, vol: 0.12, at: 0.09 });
  },
  // A new river: a rush of water rising in pitch over a low swell, then a bright chord.
  newRiver() {
    noise({ dur: 1.4, vol: 0.22, freq: 400, q: 0.7, sweep: 5 });
    tone(55, { dur: 1.6, vol: 0.32, attack: 0.35, slide: 2 });
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { type: 'triangle', dur: 1.2, vol: 0.1, attack: 0.04, at: 0.55 + i * 0.08 }));
  },
  // A scroll read aloud: a slow chord in the god's key swelling up, with a breath of air on top.
  appease(god = 0) {
    const f = (GOD_NOTE[god] || 880) / 2;
    [1, 1.25, 1.5, 2].forEach((m, i) => tone(f * m, { type: 'triangle', dur: 1.4, vol: 0.13, attack: 0.18, at: i * 0.07 }));
    tone(f / 2, { dur: 1.2, vol: 0.2, attack: 0.1 });
    noise({ dur: 1.1, vol: 0.07, freq: 5000, type: 'highpass', at: 0.1 });
  },
  // Space: the scrolls unroll.
  scrollOpen() {
    noise({ dur: 0.16, vol: 0.12, freq: 2400, q: 0.6, sweep: 1.6 });
  },
};

// The ambient track ("Sacred River Echoes", 3.5 min) fades in over its first seconds and out over its last.
// It loops whole, its last LOOP_FADE seconds blended with its first, so the fade-out flows back into the intro.
const AMBIENT_URL = 'assets/ambient.mp3';
const LOOP_FADE = 8; // seconds

// Fetched while the game loads (at low priority, so the art comes first), decoded on the first tap.
// Decoding holds the whole track in memory (about 80 MB for 3.5 min of stereo), so keep it to a few minutes.
const ambientFile = AMBIENCE_VOLUME > 0 ? fetch(AMBIENT_URL, { priority: 'low' }).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null) : null;

/** The ambient track under everything: fades in, then loops for good. Safe to call twice. */
export function startAmbient() {
  if (!ac || ambience || !ambientFile) return;
  const out = ac.createGain();
  out.gain.value = 0;
  out.connect(musicBus);
  ambience = { out };
  ambientFile
    .then((bytes) => bytes && ac.decodeAudioData(bytes))
    .then((buffer) => {
      if (!buffer) return;
      const track = ac.createBufferSource();
      track.buffer = buffer;
      loopWhole(track);
      track.connect(out);
      const t = ac.currentTime;
      out.gain.setValueAtTime(0, t);
      out.gain.linearRampToValueAtTime(AMBIENCE_VOLUME, t + 2);
      track.start(t);
    })
    .catch(() => {}); // no track (offline, or it won't decode): the effects play on over silence
}

// Loops the whole track without a gap: its first LOOP_FADE seconds are blended into its last, and the loop
// restarts just after them, so when playback jumps back it lands where the music already is.
function loopWhole(track) {
  const buf = track.buffer;
  const rate = buf.sampleRate;
  const fade = Math.round(LOOP_FADE * rate);
  const end = Math.floor((buf.duration - 0.1) * rate); // short of the padding at the end of an mp3
  track.loop = true;
  if (end < 2 * fade) return; // too short to blend: a plain loop
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < fade; i++) {
      // Equal power: the fade-out and the intro are different music, and a straight crossfade would dip between them.
      const k = ((i + 1) / fade) * (Math.PI / 2);
      d[end - fade + i] = d[end - fade + i] * Math.cos(k) + d[i] * Math.sin(k);
    }
  }
  track.loopStart = fade / rate;
  track.loopEnd = end / rate;
}

// A hidden tab goes silent, so the music doesn't play on behind other tabs; it comes back with the tab.
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend().catch(() => {});
  else ac.resume().catch(() => {});
});

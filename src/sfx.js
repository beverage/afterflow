// Synthesized sound effects, all Web Audio: no audio files to load. No background ambience by default.
// Browsers only start audio after a click or key press, so call unlockAudio() from one.

let ac = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let ambience = null;

const AMBIENCE_VOLUME = 0; // flowing-water bed under everything; off (the team prefers silence between effects), ~0.12 turns it on
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
  tap() {
    tone(1200, { dur: 0.05, vol: 0.08 });
  },
};

/** The river under everything: soft water noise that slowly swells, and now and then a droplet. Safe to call twice. */
export function startAmbient() {
  if (!ac || ambience || AMBIENCE_VOLUME <= 0) return;
  const t = ac.currentTime;
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(AMBIENCE_VOLUME, t + 3);
  out.connect(musicBus);
  const flow = ac.createBufferSource();
  flow.buffer = pinkNoise();
  flow.loop = true;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 900;
  band.Q.value = 0.5;
  flow.connect(band).connect(out);
  const lfo = ac.createOscillator();
  const depth = ac.createGain();
  lfo.frequency.value = 0.08;
  depth.gain.value = 350;
  lfo.connect(depth).connect(band.frequency);
  lfo.start();
  flow.start();
  const drip = () => {
    tone(1400 + Math.random() * 1200, { dur: 0.12, vol: 0.02, slide: 1.6 });
    ambience.timer = setTimeout(drip, 800 + Math.random() * 1700);
  };
  ambience = { out, flow, lfo, timer: setTimeout(drip, 1500) };
}

// Pink noise sounds like moving water; white noise sounds like static.
function pinkNoise() {
  const len = ac.sampleRate * 4;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
  }
  return buf;
}

// Listens for scroll incantations with the browser's built-in speech recognition (Chrome, Edge, Safari).
// No key and no server route: Chrome sends the audio to Google to transcribe it. Firefox has no
// recognizer, and a player can refuse the mic: the scroll panel then reads scrolls with keys or taps.
// Chrome ends a session after a stretch of silence, so it restarts on its own while the game wants to hear.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let rec = null;
let want = false; // the game wants to hear right now
let running = false; // a recognition session is open
let status = Recognition ? 'off' : 'unsupported'; // 'off' | 'listening' | 'denied' | 'unsupported'
let onHeard = null;
let from = 0; // results before this index were already used
let latest = -1; // index of the newest result in this session
let fails = 0;
let restartTimer = 0;

/** 'off', 'listening', 'denied' (mic refused or not a secure page) or 'unsupported' (no recognizer). */
export const listenStatus = () => status;

/** False when scrolls must be read with keys or taps instead. */
export const canListen = () => status === 'off' || status === 'listening';

/**
 * Start or stop listening. heard(candidates) gets the words said since the last useHeard(),
 * as a few alternative transcripts. The first start asks for the mic: do it from a click or key.
 */
export function setListening(on, heard) {
  if (heard) onHeard = heard;
  want = on && canListen();
  if (want && !running && !restartTimer) begin();
  else if (!want) {
    clearTimeout(restartTimer);
    restartTimer = 0;
    if (running) rec.abort();
  }
}

/** Forget what was heard so far, so the same words can't use a second scroll. */
export function useHeard() {
  from = latest + 1;
}

function begin() {
  clearTimeout(restartTimer);
  restartTimer = 0;
  if (!rec) {
    rec = new Recognition();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true; // match while the player is still speaking
    rec.maxAlternatives = 3;
    rec.onstart = () => {
      if (status === 'off') status = 'listening';
    };
    rec.onresult = (e) => {
      fails = 0;
      latest = e.results.length - 1;
      const words = [];
      for (let i = from; i < e.results.length; i++) words.push(e.results[i][0].transcript);
      const last = e.results[e.results.length - 1];
      const head = words.slice(0, -1).join(' ');
      const candidates = [words.join(' ')];
      for (let a = 1; a < last.length; a++) candidates.push(`${head} ${last[a].transcript}`);
      if (onHeard && words.length) onHeard(candidates.map((c) => c.trim()).filter(Boolean));
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        status = 'denied';
        want = false;
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') fails++;
    };
    rec.onend = () => {
      running = false;
      if (status === 'listening') status = 'off';
      if (want) restartTimer = setTimeout(begin, Math.min(4000, 120 * 2 ** fails));
    };
  }
  from = 0;
  latest = -1;
  try {
    rec.start();
    running = true;
  } catch {
    running = true; // already started: onend will follow
  }
}

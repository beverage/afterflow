// Poseidon, god of the sea (seafoam, trident): deep and rolling, moody as the sea.
// Calm like a swell one moment, a storm the next. Distinct from Ares (enraged) and Hades (quiet, cold).
// Voice Design prompts (npm run voice:design, max 500 characters):
//   A, rolling sea king: "Older man in his sixties, warm Mediterranean Greek accent. Very deep, rich bass pitch.
//     Rolling, resonant, rounded timbre, full and smooth like a wave, slightly weathered. Slow, rolling pace that
//     rises and falls like a swell. Moody energy: calm and heavy, then suddenly stormy and loud on key words. Proud,
//     brooding, unpredictable. The voice of Poseidon, god of the sea, in a dark video game."
//   B, storm king: "Powerful man in his fifties, rough seafarer's accent, faintly Greek. Deep booming bass pitch with
//     huge open resonance, like thunder over water. Strong, weathered, salty timbre, but clear, not gravelly. Steady,
//     commanding pace with rolling emphasis. High, stormy energy held back, erupting into roars on key words. Moody,
//     proud, wrathful king of the seas. The voice of Poseidon, god of the sea, in a dark video game."
// voiceId: the Gradium voice kept with `npm run voice:keep -- <id> "Poseidon"`.
// Lines stay around 3 words (under ~2.5 s of audio). Callers show the text on screen too.

export const POSEIDON = {
  name: 'Poseidon',
  voiceId: 'Dd8EiWWMQldQ7SeM', // "Poseidon", kept from Voice Design candidate vox_emb_72pwLzIK4pr17avK (prompt B)
  lines: {
    run_start: [
      'Sail, ferryman.',
      'The tide is turning.',
    ],
    rage_50: [
      'The sea grows restless.',
      'You lost one of mine.',
    ],
    rage_80: [
      'A storm is coming!',
      'I will drown you!',
    ],
    hurry: [
      'Faster, ferryman!',
      'The tide waits for no one.',
    ],
    shout: [
      'Ferryman!',
      'Sink!',
      'Faster!',
      'Mine!',
      'Fool!',
      'Drown!',
      'Enough!',
      'Row!',
    ],
    streak: [
      'Calm waters.',
      'The sea approves.',
    ],
    smite: [
      'The sea takes you.',
      'Down you go.',
    ],
  },
};

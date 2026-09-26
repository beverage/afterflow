// Hades, king of the dead and Charon's master: cold, calm, ancient. Menace through control, not volume.
// Voice Design prompt (npm run voice:design): "Ancient male ruler of the underworld, ageless. Very deep, dark,
//   velvety bass voice with a cold hollow echo, like a voice from a tomb. Speaks slowly, quietly and precisely,
//   with long heavy pauses. Calm, icy, regal and utterly contemptuous; menace through control, never shouting.
//   Every word sounds final. The voice of Hades, king of the dead, in a dark video game."
// voiceId: the Gradium voice kept with `npm run voice:keep -- <id> "Hades"`.
// null = the server's default voice until Hades's own voice is kept.
// Lines stay under ~5 words (about 2.5 s of audio). Periods and "..." slow him down. Callers show the text too.

export const HADES = {
  name: 'Hades',
  voiceId: null,
  lines: {
    run_start: [
      'Charon. Row.',
      'The dead are waiting.',
    ],
    rage_50: [
      'You are losing my dead.',
      'I am watching, Charon.',
    ],
    rage_80: [
      'One more... and you join them.',
      'My patience ends here.',
    ],
    hurry: [
      'Faster, Charon.',
      'The dead do not wait.',
    ],
    shout: [
      'Charon!',
      'Row.',
      'Faster.',
      'Mine.',
      'Careless.',
      'Pathetic.',
      'Lost. Again.',
      'Enough!',
    ],
    streak: [
      'Good.',
      'The underworld is fed.',
    ],
    smite: [
      'Enough. Your river ends.',
      'You belong to me now.',
    ],
  },
};

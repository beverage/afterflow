// Hades, king of the dead and Charon's master: cold, calm, ancient. Menace through control, not volume.
// Voice Design prompt (npm run voice:design, "cold aristocrat"): "Ancient male aristocrat, sounds late fifties,
//   refined precise British RP accent with a faint Greek lilt. Deep bass-baritone pitch. Smooth, dry, velvety timbre,
//   close to the mic, almost a murmur, yet every consonant crisp and clear. Slow, measured pace with deliberate
//   pauses. Very low energy, perfectly controlled, never raises his voice. Cold, regal, bored, contemptuous, quietly
//   threatening. The voice of Hades, king of the underworld, speaking to his servant in a dark video game."
// voiceId: the Gradium voice kept with `npm run voice:keep -- <id> "Hades"`.
// Lines stay under ~5 words (about 2.5 s of audio). Periods and "..." slow him down. Callers show the text too.

export const HADES = {
  name: 'Hades',
  voiceId: 'oyNt5tAW0wzf4qMN', // "Hades", kept from Voice Design candidate vox_emb_2ujaclR0AtSsHdcv
  lines: {
    run_start: [
      'Charon. Row.',
      'The dead are waiting.',
    ],
    rage_50: [
      'Losing my dead?',
      'I am watching, Charon.',
    ],
    rage_80: [
      'Careful, Charon.',
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
      'Your river ends.',
      'You belong to me now.',
    ],
  },
};

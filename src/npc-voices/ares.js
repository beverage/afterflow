// Ares, god of war (crimson, spear): a Viking warlord's voice, deep, slow and barely holding his rage.
// Voice Design prompt (npm run voice:design): "Male warlord in his fifties with a Scandinavian Viking accent.
//   Extremely low, cavernous bass voice, the deepest possible pitch, rough and gravelly with a growl in the throat,
//   huge chest resonance. Speaks slowly and deliberately, every word heavy. Enraged: seething, snarling fury,
//   teeth clenched, barely holding back violence, explosive on the key words. Aggressive, intimidating and
//   impatient. The voice of Ares, the enraged god of war, in a dark video game."
// voiceId: the Gradium voice kept with `npm run voice:keep -- <id> "Ares"`.
// He speaks slowly: lines stay around 3 words (under ~2.5 s of audio). Periods slow him down;
// save "!" for the peaks so he doesn't shout every line.
// Callers show the text on screen too.

export const ARES = {
  name: 'Ares',
  voiceId: 'bYo8Un6hIP7WoPZ2', // "Ares", kept from Voice Design candidate vox_emb_Lj6O0QnvD2LOI4GM
  lines: {
    run_start: [
      'Row, ferryman.',
      'My warriors wait.',
    ],
    rage_50: [
      'I saw that.',
      'Careful, ferryman.',
    ],
    rage_80: [
      'Last warning!',
      'Deliver them now!',
    ],
    hurry: [
      'Hurry!',
      'HURRY, ferryman!',
      'Row faster! Hurry!',
      'Souls can wait!',
    ],
    shout: [
      'Row!',
      'Faster!',
      'Ferryman!',
      'Now!',
      'Fool!',
      'Coward!',
      'Mine!',
      'You worm!',
      'Row. Now!',
      'Move, ferryman!',
    ],
    streak: [
      'Better.',
      'Keep rowing.',
    ],
    smite: [
      'Enough! You sink.',
      'The river takes you.',
    ],
  },
};

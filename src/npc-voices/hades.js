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
    // Game over monologue, the "death verdict" in GAME.md: long on purpose (9-13 s), not for gameplay.
    // Special events ask for one by number: getHeroAudio('hades', 'verdict', { id: 3 }). The id is the
    // position below (1 = first), so add new lines at the end and never reorder, or ids will change.
    verdict: [
      'You managed to lose that which was already dead. Those souls belong to me, yet you scattered them like loose coins in the River Styx.',
      'For millennia, this boat has ferried all manner of sinners, but only you found a way to drop my cargo. What a pathetic display.',
      'I entrusted you with the simplest of tasks: ferrying shadows across the river. It seems even the dead would rather drown again than sail with you.',
      'The Underworld is a realm of absolute accounting, and you have dared to bring me a deficit. I demand souls, not your worthless apologies.',
      'They have no bodies to swim with and nowhere to run, yet you let them slip into the eternal currents. Did you mistake my ferry for a pleasure cruise?',
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

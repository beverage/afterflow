// Athena, goddess of wisdom and strategy (gold, owl): cool, precise, disappointed. She never needs to shout;
// her anger is a teacher's cold disappointment that sharpens into a warrior's command.
// Voice Design prompts (npm run voice:design, max 500 characters):
//   A, cool teacher: "Woman in her late thirties, refined neutral English accent. Low-medium alto pitch. Clear, cool,
//     smooth timbre, close to the mic, every consonant crisp. Measured, precise pace with short pointed pauses. Low,
//     controlled energy, never shouts. Cool, intelligent, stern and deeply disappointed, like a brilliant teacher
//     whose patience is ending. The voice of Athena, goddess of wisdom, in a dark video game."
//   B, warrior general: "Woman in her forties, formal English accent with a faint Greek lilt. Rich, firm alto pitch
//     with strong chest resonance. Clean, bright, commanding timbre, not raspy. Steady, deliberate pace. Controlled
//     but forceful energy, a warrior general giving orders; calm, then sharp when angered. Regal, proud, cold and
//     disappointed. The voice of Athena, goddess of wisdom and war, in a dark video game."
// voiceId: the Gradium voice kept with `npm run voice:keep -- <id> "Athena"`.
// null = the server's default voice until Athena's own voice is kept.
// Lines stay under ~5 words (about 2.5 s of audio). Periods keep her precise; save "!" for the rare moment
// she snaps. Callers show the text on screen too.

export const ATHENA = {
  name: 'Athena',
  voiceId: null,
  lines: {
    run_start: [
      'Think before you row.',
      'Ferryman. Be precise.',
    ],
    rage_50: [
      'That soul was mine.',
      'Careless. I expected more.',
    ],
    rage_80: [
      'One more mistake. I am counting.',
      'Last warning, ferryman.',
    ],
    hurry: [
      'Hurry, Charon.',
      'My souls are fading. Move.',
    ],
    shout: [
      'Ferryman!',
      'Focus.',
      'Wrong.',
      'Careless.',
      'Think!',
      'Mine.',
      'Again?',
      'Enough!',
    ],
    streak: [
      'Good. You are learning.',
      'Precise.',
    ],
    smite: [
      'You wasted every chance.',
      'A foolish end, ferryman.',
    ],
  },
};

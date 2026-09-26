// Gradium voice tools (needs GRADIUM_API_KEY in .env):
//   npm run voices                                    list the voices your key can use
//   npm run voice:design -- "a gravelly old pirate captain, theatrical" [--lang en] [--n 3] [--say "Arr, welcome aboard!"]
//                                                     generate candidates, save an audition WAV of each in voice-candidates/
//   npm run voice:keep -- <embedding_id> "Pirate Captain"
//                                                     keep a candidate as a permanent voice, prints its voice id
// Docs: https://docs.gradium.ai/guides/voices/voice-design
import { mkdirSync, writeFileSync } from 'node:fs';
import { gradiumBase } from '../server/tts.js';

try {
  process.loadEnvFile?.('.env');
} catch {
  /* no .env file */
}

const key = process.env.GRADIUM_API_KEY;
const base = gradiumBase(process.env);
const [cmd, ...args] = process.argv.slice(2);
const USAGE = `Usage:
  npm run voices
  npm run voice:design -- "voice description" [--lang en|fr|es|pt|de] [--n 3] [--say "audition line"]
  npm run voice:keep -- <embedding_id> "Character name"`;

if (!key) {
  console.log('No GRADIUM_API_KEY in .env (copy .env.example to .env and paste the key).');
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'x-api-key': key, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const type = res.headers.get('content-type') || '';
  return type.includes('json') ? res.json() : Buffer.from(await res.arrayBuffer());
}

function parseArgs(list) {
  const out = { words: [] };
  for (let i = 0; i < list.length; i++) {
    if (list[i].startsWith('--')) out[list[i].slice(2)] = list[++i];
    else out.words.push(list[i]);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const AUDITION = {
  en: 'Welcome, challenger. Show me what you can do!',
  fr: 'Bienvenue, challenger. Montre-moi ce que tu sais faire !',
  es: 'Bienvenido, retador. Muéstrame lo que sabes hacer.',
  pt: 'Bem-vindo, desafiante. Mostra-me o que sabes fazer!',
  de: 'Willkommen, Herausforderer. Zeig mir, was du kannst!',
};

try {
  if (cmd === 'list') {
    const voices = await api('GET', '/api/voices/?include_catalog=true&limit=200');
    for (const v of voices) {
      const lang = v.language ? ` (${v.language})` : '';
      const mine = v.is_catalog ? '' : '  [yours]';
      console.log(`${v.uid}  ${v.name}${lang}${mine}${v.description ? `  ${v.description}` : ''}`);
    }
    console.log('\nUse one: add  someCharacter: \'<id>\',  to src/voices.js');
  } else if (cmd === 'design') {
    const { words, lang = 'en', n = '3', say } = parseArgs(args);
    const prompt = words.join(' ').trim();
    if (!prompt) throw new Error(USAGE);
    const { embeddings = [] } = await api('POST', '/api/voice-generator/generate', {
      prompt,
      language: lang,
      n_samples: Math.min(5, Math.max(1, Number(n) || 3)),
    });
    console.log(`Generated ${embeddings.length} candidate(s), auditioning (they take a few seconds to be ready)...`);
    mkdirSync('voice-candidates', { recursive: true });
    const line = (say || AUDITION[lang] || AUDITION.en).slice(0, 100); // candidates accept 100 chars max
    for (const { embedding_id: id } of embeddings) {
      let wav;
      for (let attempt = 1; !wav; attempt++) {
        try {
          wav = await api('POST', '/api/post/speech/tts', { text: line, voice_id: id, output_format: 'wav', only_audio: true });
        } catch (err) {
          if (attempt >= 8) throw err;
          await sleep(1500);
        }
      }
      writeFileSync(`voice-candidates/${id}.wav`, wav);
      console.log(`  ${id}  ->  voice-candidates/${id}.wav`);
    }
    console.log('\nListen on a Mac:  afplay voice-candidates/<id>.wav');
    console.log('Keep one:         npm run voice:keep -- <id> "Character name"');
  } else if (cmd === 'keep') {
    const [id, ...nameWords] = args;
    if (!id) throw new Error(USAGE);
    const name = nameWords.join(' ') || 'Game voice';
    const v = await api('POST', '/api/voices/from-embedding', { voxium_embedding_id: id, name, description: 'Made for our hackathon game' });
    console.log(`Saved "${v.name}" as voice id ${v.uid}`);
    console.log(`Add to src/voices.js:  someCharacter: '${v.uid}', // ${v.name}`);
  } else {
    console.log(USAGE);
    process.exit(cmd ? 1 : 0);
  }
} catch (err) {
  console.log(err.message);
  process.exit(1);
}

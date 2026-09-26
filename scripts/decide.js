// npm run decide -- "Cut the leaderboard · no time to secure it"
// Appends a timestamped line to DECISIONS.md (local time, author from git).
import { appendFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const text = process.argv.slice(2).join(' ').trim();
if (!text) {
  console.log('Usage: npm run decide -- "What we decided · why"');
  process.exit(1);
}

let who = process.env.USER || 'someone';
try {
  who = execSync('git config user.name', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || who;
} catch {
  /* not a git repo yet */
}

const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const file = new URL('../DECISIONS.md', import.meta.url);
const line = `- ${time} · ${text} · ${who}`;
appendFileSync(file, `${readFileSync(file, 'utf8').endsWith('\n') ? '' : '\n'}${line}\n`);
console.log(`Logged: ${line}`);

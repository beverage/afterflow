// Production server for any Node host (Fly.io via the Dockerfile, Render, Railway, a VM...).
// Serves the built game from dist/ and the Gemini proxy at /api/gemini. No dependencies.
// Usage: npm run build && npm start
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { geminiRoute, ttsRoute } from './server/http.js';

try {
  process.loadEnvFile?.('.env'); // local convenience; on hosts, set real env vars/secrets
} catch {
  /* no .env file */
}

const DIST = resolve('dist');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(DIST, urlPath));
  if (file !== DIST && !file.startsWith(DIST + sep)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    // Unknown path: real files 404, app routes fall back to index.html
    if (extname(urlPath)) {
      res.statusCode = 404;
      return res.end('Not found');
    }
    file = join(DIST, 'index.html');
  }
  try {
    const body = await readFile(file);
    const ext = extname(file).toLowerCase();
    res.setHeader('content-type', TYPES[ext] || 'application/octet-stream');
    res.setHeader('cache-control', file.includes(`${sep}assets${sep}`) && ext === '.js' ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.statusCode = 404;
    res.end('Not found (did you run `npm run build`?)');
  }
}

createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (pathname === '/api/gemini') return geminiRoute(req, res, process.env);
  if (pathname === '/api/tts') return ttsRoute(req, res, process.env);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }
  return serveStatic(req, res);
}).listen(PORT, () => {
  const ai = process.env.GEMINI_API_KEY ? 'live' : 'MOCK (no GEMINI_API_KEY)';
  const voice = process.env.GRADIUM_API_KEY ? 'live' : 'browser fallback (no GRADIUM_API_KEY)';
  console.log(`Game on http://localhost:${PORT}  |  AI: ${ai}  |  Voice: ${voice}`);
});

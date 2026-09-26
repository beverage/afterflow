import { defineConfig, loadEnv } from 'vite';
import { geminiRoute, sttRoute, ttsRoute } from './server/http.js';

// Mounts the same /api routes used in production on the dev and preview servers,
// so `npm run dev` is the only command you need. Env vars are read server-side only:
// never prefix a key with VITE_, or it would be bundled into the browser code.
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
  const mountApi = (server) => {
    server.middlewares.use('/api/gemini', (req, res) => geminiRoute(req, res, env));
    server.middlewares.use('/api/tts', (req, res) => ttsRoute(req, res, env));
    server.middlewares.use('/api/stt', (req, res) => sttRoute(req, res, env));
  }; // must return nothing: Vite treats a returned function as a post-middleware hook

  return {
    server: { host: true, port: 5173 }, // host: true -> test on your phone over the venue Wi-Fi
    preview: { host: true, port: 4173 },
    build: { chunkSizeWarningLimit: 2000 }, // Phaser is one big chunk; that's fine
    plugins: [
      {
        name: 'game-api',
        configureServer: mountApi,
        configurePreviewServer: mountApi,
      },
    ],
  };
});

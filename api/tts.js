// Vercel serverless function: GET/POST /api/tts (Gradium text-to-speech).
// Set GRADIUM_API_KEY (and optionally GRADIUM_VOICE_ID) in the Vercel project env.
import { ttsRoute } from '../server/http.js';

export default function handler(req, res) {
  return ttsRoute(req, res, process.env);
}

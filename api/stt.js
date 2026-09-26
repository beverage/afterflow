// Vercel serverless function: GET/POST /api/stt (Gradium speech-to-text for the scroll incantations).
// Uses the same GRADIUM_API_KEY as /api/tts. The browser sends each clip as application/octet-stream,
// which Vercel hands over as a Buffer.
import { sttRoute } from '../server/http.js';

export default function handler(req, res) {
  return sttRoute(req, res, process.env);
}

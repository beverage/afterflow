// Vercel serverless function: GET/POST /api/gemini.
// Set GEMINI_API_KEY (and optionally GEMINI_MODEL) in the Vercel project env.
import { geminiRoute } from '../server/http.js';

export default function handler(req, res) {
  return geminiRoute(req, res, process.env);
}

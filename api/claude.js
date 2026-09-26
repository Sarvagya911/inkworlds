// Vercel Function: POST /api/claude
import { handleClaude } from '../server/claude-core.js';
export async function POST(request) {
  return handleClaude(request, process.env);
}

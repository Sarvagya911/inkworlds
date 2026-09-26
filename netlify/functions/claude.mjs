// Netlify Function: POST /api/claude
import { handleClaude } from '../../server/claude-core.js';
export default async request => handleClaude(request, process.env);
export const config = { path: '/api/claude' };

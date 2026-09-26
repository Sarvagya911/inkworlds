// Calls the /api/claude serverless function.
import { sb } from './client.js';

export async function askClaude(body) {
  const { data } = await sb().auth.getSession();
  const token = data.session && data.session.access_token;
  if (!token) throw { code: 'signin', message: 'Sign in to use this.' };
  const r = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body)
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw { code: out.code || 'error', message: out.message || 'The AI request failed.' };
  return out;
}

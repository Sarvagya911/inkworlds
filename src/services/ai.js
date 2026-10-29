// Calls the /api/claude serverless function.
import { Capacitor } from '@capacitor/core';
import { sb } from './client.js';

// In the web app, /api/claude is served by Vercel on the same origin.
// In the Android Capacitor app, the WebView origin is local, so a relative
// /api/claude URL would never reach the Vercel function.
const AI_API_URL = Capacitor.isNativePlatform()
  ? 'https://inkworlds.vercel.app/api/claude'
  : '/api/claude';

export async function askClaude(body) {
  const { data } = await sb().auth.getSession();
  const token = data.session && data.session.access_token;
  if (!token) throw { code: 'signin', message: 'Sign in to use this.' };

  const r = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + token
    },
    body: JSON.stringify(body)
  });

  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw { code: out.code || 'error', message: out.message || 'The AI request failed.' };
  return out;
}

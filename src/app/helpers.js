// Small UI helpers shared by every page: formatting, avatars, errors, busy overlay, downloads.
import { rememberDestination } from '../auth/session.js';
import { $, applyUiTheme, esc, toast } from '../lib/utils.js';
import { myId } from '../services/session.js';

export const AI_ENABLED = import.meta.env.VITE_AI_ENABLED === 'true';

export const app = $('app');

applyUiTheme();

export const enc = encodeURIComponent;

export const signedIn = () => !!myId();

export const aiReady = () => AI_ENABLED && signedIn();

export function nl(s) {
  return esc(s);
}

export function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 604800) return Math.floor(s / 86400) + ' d ago';
  return new Date(t).toLocaleDateString();
}

export const ts = v => (typeof v === 'number' ? v : new Date(v).getTime());

export function initials(n) {
  return (n || '?')
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function avatarURL(p) {
  if (p && p.avatar_url) return p.avatar_url;
  const n = esc(initials(p && p.display_name));
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='#8a6526'/><text x='16' y='21' font-size='13' text-anchor='middle' fill='#fff' font-family='Georgia'>${n}</text></svg>`)}`;
}

export function nameOf(ppl, id) {
  if (!id) return 'Inkworlds';
  if (id === myId()) return 'You';
  return (ppl[id] && ppl[id].display_name) || 'A reader';
}

export function whoHTML(ppl, id) {
  return `<span class="who"><img src="${esc(avatarURL(id ? ppl[id] : { display_name: 'Inkworlds' }))}" alt="" referrerpolicy="no-referrer">${esc(nameOf(ppl, id))}</span>`;
}

export function errMsg(e) {
  const c = e && (e.code || ''),
    m = (e && e.message) || '';
  if (c === 'not_configured') return "This site isn't connected to its database yet.";
  if (c === '42501' || /row-level security|permission/i.test(m))
    return "You don't have permission to do that.";
  if (/JWT|not signed in/i.test(m)) return 'Your session expired. Sign in again.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'No connection. Check your internet and try again.';
  return m || 'Something went wrong. Try again.';
}

export const fail = e => toast(errMsg(e), 6000);

export function busy(on, text, frac) {
  $('busy').hidden = !on;
  if (text) $('busyText').textContent = text;
  if (frac != null) $('busyBar').style.width = Math.round(frac * 100) + '%';
}

export function signInGate(what) {
  return `<div class="empty-box gate" style="margin:1.4rem 0">Sign in to ${what}. Your data is saved to your account, so it's there on every device.<div class="actions" style="justify-content:center;margin-top:1rem"><a class="btn" href="#/signin" data-remember>Sign in</a><a class="btn ghost" href="#/signup" data-remember>Create an account</a></div></div>`;
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-remember]');
  if (a) rememberDestination(location.hash);
});

export function download(filename, data, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

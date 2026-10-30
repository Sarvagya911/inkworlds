// Tracks who is signed in and notifies the app when that changes.
import { loadProfile } from '../services/profiles.js';
import { session } from '../services/session.js';
import { supabase } from '../services/supabase.js';

export const listeners = new Set();

export const onAuthChange = fn => listeners.add(fn);

export const AFTER = 'iw:after';
const OFFLINE_USER = 'iw:offline-user';

function cachedUser() {
  try {
    const raw = localStorage.getItem(OFFLINE_USER);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function rememberUser(u) {
  try {
    if (u) {
      localStorage.setItem(
        OFFLINE_USER,
        JSON.stringify({
          id: u.id,
          email: u.email || null,
          user_metadata: u.user_metadata || {},
          app_metadata: u.app_metadata || {}
        })
      );
    } else {
      localStorage.removeItem(OFFLINE_USER);
    }
  } catch (e) {}
}

export function rememberDestination(hash) {
  try {
    sessionStorage.setItem(AFTER, hash || location.hash || '#/library');
  } catch (e) {}
}

export function destination() {
  let h = '#/library';
  try {
    h = sessionStorage.getItem(AFTER) || h;
    sessionStorage.removeItem(AFTER);
  } catch (e) {}
  return /^#\/(signin|signup|verify|forgot|code)/.test(h) ? '#/library' : h;
}

export async function setUser(u) {
  const changed = (u && u.id) !== (session.user && session.user.id);
  session.user = u;
  rememberUser(u);
  if (u) {
    try {
      await loadProfile();
    } catch (e) {}
  } else session.profile = null;
  if (changed) listeners.forEach(fn => fn(u));
}

export async function initAuth() {
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await setUser(data.session.user);
    } else {
      // If the network is unavailable and Supabase cannot restore its
      // session, keep the last known identity so the local app remains usable.
      const cached = cachedUser();
      if (cached) await setUser(cached);
      else await setUser(null);
    }
  } catch (e) {
    const cached = cachedUser();
    if (cached) await setUser(cached);
  }
  supabase.auth.onAuthStateChange((event, s) => {
    // Supabase recommends not awaiting other calls inside this callback.
    setTimeout(async () => {
      const wasOut = !session.user;
      await setUser(s ? s.user : null);
      if (event === 'PASSWORD_RECOVERY') {
        location.hash = '#/reset';
        return;
      }
      if (event === 'SIGNED_IN' && wasOut && /^#\/(signin|signup|verify|code)?$|^$/.test(location.hash))
        location.hash = destination();
    }, 0);
  });
  if (/[?&]code=/.test(location.search)) {
    const back = destination();
    history.replaceState(null, '', location.pathname + back);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
  rememberUser(null);
  session.user = null;
  session.profile = null;
}

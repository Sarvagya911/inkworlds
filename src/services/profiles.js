// Profiles, with a small cache for names and avatars.
import { must, sb } from './client.js';
import { myId, session } from './session.js';
import { supabase } from './supabase.js';

export async function loadProfile() {
  if (!myId()) return (session.profile = null);
  const data = must(await sb().from('profiles').select('*').eq('id', myId()).maybeSingle());
  session.profile = data;
  return data;
}

export async function saveProfile(patch) {
  must(await sb().from('profiles').update(patch).eq('id', myId()));
  Object.assign(session.profile || {}, patch);
}

export const people = new Map();

export async function profiles(ids) {
  const uniq = [...new Set(ids.filter(Boolean))],
    need = uniq.filter(i => !people.has(i));
  if (need.length && supabase) {
    try {
      const data = must(await supabase.from('profiles').select('id,display_name,avatar_url').in('id', need));
      data.forEach(p => people.set(p.id, p));
    } catch (e) {}
    need.forEach(i => {
      if (!people.has(i)) people.set(i, { id: i, display_name: '', avatar_url: null });
    });
  }
  return Object.fromEntries(uniq.map(i => [i, people.get(i)]));
}

export function rememberProfile(p) {
  if (p && p.id) people.set(p.id, p);
}

// Keeps reading progress, reading time and preferences in sync with the account (batched writes).
import { signedIn } from './helpers.js';
import { dayKey, lsGet, lsSet, prefs, savePrefs } from '../lib/utils.js';
import * as cloud from '../services/index.js';

export const progOf = id => lsGet('iw:prog:' + id, null);

export const setProg = (id, p) => lsSet('iw:prog:' + id, p);

export async function syncProgressDown() {
  if (!signedIn()) return;
  try {
    for (const p of await cloud.allProgress()) {
      const l = progOf(p.bookId);
      if (!l || (l.updated || 0) < p.updated) setProg(p.bookId, p);
    }
  } catch (e) {}
}

export let progTimer = 0,
  progDirty = null;

export function queueProgress(id, p) {
  setProg(id, p);
  if (!signedIn()) return;
  progDirty = { id, p };
  clearTimeout(progTimer);
  progTimer = setTimeout(flushProgress, 4000);
}

export async function flushProgress() {
  clearTimeout(progTimer);
  const d = progDirty;
  progDirty = null;
  if (d && signedIn()) {
    try {
      await cloud.saveProgress(d.id, d.p);
    } catch (e) {
      progDirty = progDirty || d;
    }
  }
}

export let pending = { secs: 0, words: 0, bookId: null, world: null };

export function addReading(secs, w, bookId, world) {
  if (!signedIn()) return;
  if (bookId && pending.bookId && pending.bookId !== bookId) flushReading();
  pending.secs += secs;
  pending.words += w;
  if (bookId) pending.bookId = bookId;
  if (world) pending.world = world;
}

export async function flushReading() {
  if (!signedIn() || (!pending.secs && !pending.words)) return;
  const p = pending;
  pending = { secs: 0, words: 0, bookId: p.bookId, world: p.world };
  try {
    await cloud.addReading(dayKey(), p.secs, p.words, p.bookId, p.world);
  } catch (e) {
    pending.secs += p.secs;
    pending.words += p.words;
  }
}

setInterval(flushReading, 30000);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    flushReading();
    flushProgress();
  }
});

addEventListener('pagehide', () => {
  flushReading();
  flushProgress();
});

export let prefTimer = 0;

export function changePrefs(patch) {
  Object.assign(prefs, patch);
  savePrefs();
  if (!signedIn()) return;
  clearTimeout(prefTimer);
  prefTimer = setTimeout(() => cloud.saveProfile({ prefs: { ...prefs } }).catch(() => {}), 1500);
}

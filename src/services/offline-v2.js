// Offline-first user-data layer. Supabase remains authoritative when reachable.
import * as booksCloud from './books.js';
import * as readingCloud from './reading.js';
import { myId } from './session.js';

const key = name => `iw:offline:${myId() || 'guest'}:${name}`;
const online = () => navigator.onLine !== false;

function get(name, fallback) {
  try { const v = localStorage.getItem(key(name)); return v == null ? fallback : JSON.parse(v); }
  catch (e) { return fallback; }
}
function set(name, value) {
  try { localStorage.setItem(key(name), JSON.stringify(value)); } catch (e) {}
  return value;
}
function uuid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }

/* Library */
export async function myBooks() {
  const cached = get('library', []);
  if (!online()) return cached;
  try { return set('library', await booksCloud.myBooks()); }
  catch (e) { return cached; }
}

export async function bookMeta(id) {
  const cached = get('library', []).find(b => b.id === id) || null;
  if (!online()) return cached;
  try {
    const b = await booksCloud.bookMeta(id);
    if (!b) return cached;
    set('library', [b, ...get('library', []).filter(x => x.id !== id)]);
    return b;
  } catch (e) { return cached; }
}

export async function createBook(...args) {
  const b = await booksCloud.createBook(...args);
  set('library', [b, ...get('library', []).filter(x => x.id !== b.id)]);
  return b;
}

/* Progress */
export async function getProgress(bookId) {
  const cached = get(`progress:${bookId}`, null);
  if (!online()) return cached;
  try {
    const p = await readingCloud.getProgress(bookId);
    if (p) set(`progress:${bookId}`, p);
    return p || cached;
  } catch (e) { return cached; }
}

export async function allProgress() {
  const cached = [];
  const prefix = key('progress:');
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const p = JSON.parse(localStorage.getItem(k));
      if (p) cached.push({ ...p, bookId: k.slice(prefix.length) });
    }
  } catch (e) {}
  if (!online()) return cached;
  try {
    const remote = await readingCloud.allProgress();
    remote.forEach(p => set(`progress:${p.bookId}`, p));
    return remote.length ? remote : cached;
  } catch (e) { return cached; }
}

/* Highlights */
function allLocalHighlights() {
  const out = [], prefix = key('highlights:');
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(...(JSON.parse(localStorage.getItem(k)) || []));
    }
  } catch (e) {}
  return out;
}

async function flushHighlightQueue() {
  if (!online()) return;
  const queue = get('highlight-queue', []), remaining = [];
  for (const op of queue) {
    try {
      if (op.type === 'add') {
        const remote = await readingCloud.addHighlight(op.data);
        const list = get(`highlights:${op.data.bookId}`, []);
        set(`highlights:${op.data.bookId}`, list.map(h => h.id === op.localId ? remote : h));
      } else if (op.type === 'update') {
        await readingCloud.updateHighlight(op.id, op.note);
      } else if (op.type === 'delete') {
        await readingCloud.deleteHighlight(op.id);
      }
    } catch (e) { remaining.push(op); }
  }
  set('highlight-queue', remaining);
}

export async function highlights(bookId) {
  await flushHighlightQueue();
  const cached = get(`highlights:${bookId}`, []);
  if (!online()) return cached;
  try {
    const remote = await readingCloud.highlights(bookId);
    const pending = cached.filter(h => h._pending);
    return set(`highlights:${bookId}`, [...remote, ...pending.filter(h => !remote.some(r => r.id === h.id))]);
  } catch (e) { return cached; }
}

export async function addHighlight(h) {
  const id = uuid();
  const local = { id, bookId: h.bookId, ch: h.ch, si: h.si, start: h.start, end: h.end, text: h.text, note: h.note || '', chTitle: h.chTitle || '', created: Date.now(), _pending: true };
  set(`highlights:${h.bookId}`, [local, ...get(`highlights:${h.bookId}`, [])]);
  if (!online()) {
    set('highlight-queue', [...get('highlight-queue', []), { type: 'add', localId: id, data: h }]);
    return local;
  }
  try {
    const remote = await readingCloud.addHighlight(h);
    set(`highlights:${h.bookId}`, get(`highlights:${h.bookId}`, []).map(x => x.id === id ? remote : x));
    return remote;
  } catch (e) {
    set('highlight-queue', [...get('highlight-queue', []), { type: 'add', localId: id, data: h }]);
    return local;
  }
}

export async function updateHighlight(id, note) {
  const h = allLocalHighlights().find(x => x.id === id);
  if (h) {
    h.note = note;
    set(`highlights:${h.bookId}`, get(`highlights:${h.bookId}`, []).map(x => x.id === id ? h : x));
  }
  const queue = get('highlight-queue', []);
  const pendingAdd = queue.find(x => x.type === 'add' && x.localId === id);
  if (pendingAdd) { pendingAdd.data.note = note; set('highlight-queue', queue); return; }
  if (!online()) {
    set('highlight-queue', [...queue.filter(x => !(x.type === 'update' && x.id === id)), { type: 'update', id, note }]);
    return;
  }
  try { await readingCloud.updateHighlight(id, note); }
  catch (e) { set('highlight-queue', [...queue.filter(x => !(x.type === 'update' && x.id === id)), { type: 'update', id, note }]); }
}

export async function deleteHighlight(id) {
  const queue = get('highlight-queue', []);
  const pendingAdd = queue.find(x => x.type === 'add' && x.localId === id);
  const h = allLocalHighlights().find(x => x.id === id);
  if (h) set(`highlights:${h.bookId}`, get(`highlights:${h.bookId}`, []).filter(x => x.id !== id));
  if (pendingAdd) { set('highlight-queue', queue.filter(x => x !== pendingAdd)); return; }
  if (!online()) { set('highlight-queue', [...queue, { type: 'delete', id }]); return; }
  try { await readingCloud.deleteHighlight(id); }
  catch (e) { set('highlight-queue', [...queue, { type: 'delete', id }]); }
}

/* Bookmarks */
export async function bookmarks(bookId) {
  const cached = get(`bookmarks:${bookId}`, []);
  if (!online()) return cached;
  try { return set(`bookmarks:${bookId}`, await readingCloud.bookmarks(bookId)); }
  catch (e) { return cached; }
}

export async function addBookmark(b) {
  const local = { id: uuid(), ...b, created: Date.now(), _pending: true };
  set(`bookmarks:${b.bookId}`, [local, ...get(`bookmarks:${b.bookId}`, [])]);
  if (!online()) { set('bookmark-queue', [...get('bookmark-queue', []), { type: 'add', localId: local.id, data: b }]); return local; }
  try {
    const remote = await readingCloud.addBookmark(b);
    set(`bookmarks:${b.bookId}`, get(`bookmarks:${b.bookId}`, []).map(x => x.id === local.id ? remote : x));
    return remote;
  } catch (e) { set('bookmark-queue', [...get('bookmark-queue', []), { type: 'add', localId: local.id, data: b }]); return local; }
}

export async function deleteBookmark(id) {
  const queue = get('bookmark-queue', []);
  const add = queue.find(x => x.type === 'add' && x.localId === id);
  const all = [];
  const prefix = key('bookmarks:');
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const list = JSON.parse(localStorage.getItem(k)) || [];
        if (list.some(x => x.id === id)) set(k.slice(key('').length), list.filter(x => x.id !== id));
      }
    }
  } catch (e) {}
  if (add) { set('bookmark-queue', queue.filter(x => x !== add)); return; }
  if (!online()) { set('bookmark-queue', [...queue, { type: 'delete', id }]); return; }
  try { await readingCloud.deleteBookmark(id); } catch (e) { set('bookmark-queue', [...queue, { type: 'delete', id }]); }
}

/* Reading stats */
function mergeDays(base, pending) {
  const map = new Map((base || []).map(d => [d.day, { ...d, books: { ...(d.books || {}) }, worlds: { ...(d.worlds || {}) } }]));
  for (const p of pending || []) {
    const d = map.get(p.day) || { day: p.day, secs: 0, words: 0, books: {}, worlds: {} };
    d.secs += p.secs || 0; d.words += p.words || 0;
    for (const [k,v] of Object.entries(p.books || {})) d.books[k] = (d.books[k] || 0) + v;
    for (const [k,v] of Object.entries(p.worlds || {})) d.worlds[k] = (d.worlds[k] || 0) + v;
    map.set(p.day, d);
  }
  return [...map.values()].sort((a,b) => String(b.day).localeCompare(String(a.day)));
}

export async function addReading(day, secs, words, bookId, world) {
  const queue = get('reading-queue', []);
  let p = queue.find(x => x.day === day && x.bookId === (bookId || null));
  if (!p) { p = { day, secs: 0, words: 0, books: {}, worlds: {}, bookId: bookId || null }; queue.push(p); }
  p.secs += Math.round(secs || 0); p.words += Math.round(words || 0);
  if (bookId) p.books[bookId] = (p.books[bookId] || 0) + Math.round(secs || 0);
  if (world) p.worlds[world] = (p.worlds[world] || 0) + Math.round(secs || 0);
  set('reading-queue', queue);
  if (!online()) return;
  await flushReadingQueue();
}

async function flushReadingQueue() {
  if (!online()) return;
  const queue = get('reading-queue', []), remaining = [];
  for (const p of queue) {
    try { await readingCloud.addReading(p.day, p.secs, p.words, p.bookId, Object.keys(p.worlds || {})[0] || null); }
    catch (e) { remaining.push(p); }
  }
  set('reading-queue', remaining);
}

export async function readingDays() {
  await flushReadingQueue();
  const cached = get('reading-days', []), pending = get('reading-queue', []);
  if (!online()) return mergeDays(cached, pending);
  try { const remote = await readingCloud.readingDays(); set('reading-days', remote); return mergeDays(remote, pending); }
  catch (e) { return mergeDays(cached, pending); }
}

addEventListener('online', () => { flushHighlightQueue().catch(() => {}); flushReadingQueue().catch(() => {}); });

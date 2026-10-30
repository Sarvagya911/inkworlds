// Offline-first cache layer for user library, annotations, reading stats, and progress.
// Supabase remains the source of truth when online; cached data keeps the app useful offline.
import * as booksCloud from './books.js';
import * as readingCloud from './reading.js';
import { myId } from './session.js';

const key = (name) => `iw:offline:${myId() || 'guest'}:${name}`;

function read(name, fallback) {
  try {
    const raw = localStorage.getItem(key(name));
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function write(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch (e) {}
  return value;
}

function online() {
  return navigator.onLine !== false;
}

function mergeById(remote, local) {
  const out = new Map();
  for (const x of remote || []) out.set(String(x.id), x);
  for (const x of local || []) {
    if (x && x.id && !out.has(String(x.id))) out.set(String(x.id), x);
  }
  return [...out.values()];
}

/* ---------- Library ---------- */

export async function myBooks() {
  const cached = read('library', []);
  if (!online()) return cached;
  try {
    const remote = await booksCloud.myBooks();
    return write('library', remote);
  } catch (e) {
    return cached;
  }
}

export async function bookMeta(id) {
  const cached = read('library', []).find(b => b.id === id) || null;
  if (!online()) return cached;
  try {
    const remote = await booksCloud.bookMeta(id);
    if (!remote) return cached;
    const list = read('library', []);
    const next = [remote, ...list.filter(b => b.id !== id)];
    write('library', next);
    return remote;
  } catch (e) {
    return cached;
  }
}

export async function createBook(...args) {
  const book = await booksCloud.createBook(...args);
  const list = read('library', []);
  write('library', [book, ...list.filter(b => b.id !== book.id)]);
  return book;
}

/* ---------- Progress ---------- */

export async function getProgress(bookId) {
  const cached = read(`progress:${bookId}`, null);
  if (!online()) return cached;
  try {
    const remote = await readingCloud.getProgress(bookId);
    if (remote) write(`progress:${bookId}`, remote);
    return remote || cached;
  } catch (e) {
    return cached;
  }
}

export async function allProgress() {
  const cached = [];
  try {
    const prefix = key('progress:');
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const value = JSON.parse(localStorage.getItem(k));
      if (value) cached.push({ ...value, bookId: k.slice(prefix.length) });
    }
  } catch (e) {}

  if (!online()) return cached;
  try {
    const remote = await readingCloud.allProgress();
    for (const p of remote) write(`progress:${p.bookId}`, p);
    return remote.length ? remote : cached;
  } catch (e) {
    return cached;
  }
}

/* ---------- Highlights ---------- */

async function flushHighlights() {
  if (!online()) return;
  const pending = read('pending-highlights', []);
  if (!pending.length) return;

  const remaining = [];
  for (const op of pending) {
    try {
      if (op.type === 'add') {
        const created = await readingCloud.addHighlight(op.data);
        const local = read('highlights:' + op.data.bookId, []);
        write('highlights:' + op.data.bookId, [created, ...local.filter(h => h.id !== op.localId)]);
      } else if (op.type === 'update') {
        await readingCloud.updateHighlight(op.id, op.note);
      } else if (op.type === 'delete') {
        await readingCloud.deleteHighlight(op.id);
      }
    } catch (e) {
      remaining.push(op);
    }
  }
  write('pending-highlights', remaining);
}

export async function highlights(bookId) {
  await flushHighlights();
  const cached = read('highlights:' + bookId, []);
  if (!online()) return cached;
  try {
    const remote = await readingCloud.highlights(bookId);
    const localPending = cached.filter(h => h && h._pending);
    return write('highlights:' + bookId, mergeById(remote, localPending));
  } catch (e) {
    return cached;
  }
}

export async function addHighlight(h) {
  const localId = crypto.randomUUID();
  const local = {
    id: localId,
    bookId: h.bookId,
    ch: h.ch,
    si: h.si,
    start: h.start,
    end: h.end,
    text: h.text,
    note: h.note || '',
    chTitle: h.chTitle || '',
    created: Date.now(),
    _pending: true
  };
  const list = read('highlights:' + h.bookId, []);
  write('highlights:' + h.bookId, [local, ...list]);

  if (!online()) {
    const pending = read('pending-highlights', []);
    write('pending-highlights', [...pending, { type: 'add', localId, data: h }]);
    return local;
  }

  try {
    const remote = await readingCloud.addHighlight(h);
    const next = read('highlights:' + h.bookId, []).map(x => x.id === localId ? remote : x);
    write('highlights:' + h.bookId, next);
    return remote;
  } catch (e) {
    const pending = read('pending-highlights', []);
    write('pending-highlights', [...pending, { type: 'add', localId, data: h }]);
    return local;
  }
}

export async function updateHighlight(id, note) {
  const all = readAllHighlights();
  const found = all.find(h => h.id === id);
  if (found) {
    found.note = note;
    found._pending = true;
    write('highlights:' + found.bookId, read('highlights:' + found.bookId, []).map(h => h.id === id ? found : h));
  }

  if (!online()) {
    const pending = read('pending-highlights', []);
    const next = pending.filter(op => !(op.type === 'update' && op.id === id));
    next.push({ type: 'update', id, note });
    write('pending-highlights', next);
    return;
  }

  try {
    await readingCloud.updateHighlight(id, note);
    if (found) {
      found._pending = false;
      write('highlights:' + found.bookId, read('highlights:' + found.bookId, []).map(h => h.id === id ? found : h));
    }
  } catch (e) {
    const pending = read('pending-highlights', []);
    const next = pending.filter(op => !(op.type === 'update' && op.id === id));
    next.push({ type: 'update', id, note });
    write('pending-highlights', next);
  }
}

export async function deleteHighlight(id) {
  const all = readAllHighlights();
  const found = all.find(h => h.id === id);
  if (found) write('highlights:' + found.bookId, read('highlights:' + found.bookId, []).filter(h => h.id !== id));

  if (!online()) {
    const pending = read('pending-highlights', []);
    write('pending-highlights', [...pending.filter(op => !(op.type === 'add' && op.localId === id)), { type: 'delete', id }]);
    return;
  }

  try {
    await readingCloud.deleteHighlight(id);
  } catch (e) {
    const pending = read('pending-highlights', []);
    write('pending-highlights', [...pending, { type: 'delete', id }]);
  }
}

function readAllHighlights() {
  const out = [];
  try {
    const prefix = key('highlights:');
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const list = JSON.parse(localStorage.getItem(k));
      if (Array.isArray(list)) out.push(...list);
    }
  } catch (e) {}
  return out;
}

/* ---------- Bookmarks ---------- */

export async function bookmarks(bookId) {
  const cached = read('bookmarks:' + bookId, []);
  if (!online()) return cached;
  try {
    const remote = await readingCloud.bookmarks(bookId);
    return write('bookmarks:' + bookId, remote);
  } catch (e) {
    return cached;
  }
}

export async function addBookmark(b) {
  const local = {
    id: crypto.randomUUID(),
    bookId: b.bookId,
    ch: b.ch,
    si: b.si,
    snippet: b.snippet,
    created: Date.now(),
    _pending: true
  };
  const list = read('bookmarks:' + b.bookId, []);
  write('bookmarks:' + b.bookId, [local, ...list]);

  if (!online()) return local;
  try {
    const remote = await readingCloud.addBookmark(b);
    write('bookmarks:' + b.bookId, read('bookmarks:' + b.bookId, []).map(x => x.id === local.id ? remote : x));
    return remote;
  } catch (e) {
    return local;
  }
}

export async function deleteBookmark(id) {
  let bookId = null;
  try {
    const prefix = key('bookmarks:');
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const list = JSON.parse(localStorage.getItem(k)) || [];
      if (list.some(x => x.id === id)) {
        bookId = k.slice(prefix.length);
        write('bookmarks:' + bookId, list.filter(x => x.id !== id));
        break;
      }
    }
  } catch (e) {}
  if (!online()) return;
  try { await readingCloud.deleteBookmark(id); } catch (e) {}
}

/* ---------- Reading stats ---------- */

export async function addReading(day, secs, words, bookId, world) {
  const pending = read('pending-reading', []);
  const idx = pending.findIndex(x => x.day === day && x.bookId === (bookId || null));
  const item = idx >= 0 ? pending[idx] : { day, secs: 0, words: 0, books: {}, worlds: {}, bookId: bookId || null };
  item.secs += Math.round(secs || 0);
  item.words += Math.round(words || 0);
  if (bookId) item.books[bookId] = (item.books[bookId] || 0) + Math.round(secs || 0);
  if (world) item.worlds[world] = (item.worlds[world] || 0) + Math.round(secs || 0);
  if (idx >= 0) pending[idx] = item; else pending.push(item);
  write('pending-reading', pending);

  if (!online()) return;
  try {
    await readingCloud.addReading(day, secs, words, bookId, world);
    const next = read('pending-reading', []).filter(x => !(x.day === day && x.bookId === (bookId || null)));
    write('pending-reading', next);
  } catch (e) {}
}

export async function readingDays() {
  const cached = read('reading-days', []);
  if (!online()) return mergeReadingDays(cached, read('pending-reading', []));
  try {
    const remote = await readingCloud.readingDays();
    write('reading-days', remote);
    return mergeReadingDays(remote, read('pending-reading', []));
  } catch (e) {
    return mergeReadingDays(cached, read('pending-reading', []));
  }
}

function mergeReadingDays(base, pending) {
  const map = new Map((base || []).map(d => [d.day, { ...d, books: { ...(d.books || {}) }, worlds: { ...(d.worlds || {}) } }]));
  for (const p of pending || []) {
    const d = map.get(p.day) || { day: p.day, secs: 0, words: 0, books: {}, worlds: {} };
    d.secs += p.secs || 0;
    d.words += p.words || 0;
    for (const [k, v] of Object.entries(p.books || {})) d.books[k] = (d.books[k] || 0) + v;
    for (const [k, v] of Object.entries(p.worlds || {})) d.worlds[k] = (d.worlds[k] || 0) + v;
    map.set(p.day, d);
  }
  return [...map.values()].sort((a, b) => String(b.day).localeCompare(String(a.day)));
}

async function flushAll() {
  await flushHighlights();
  if (!online()) return;
  const pending = read('pending-reading', []);
  if (!pending.length) return;
  for (const p of pending) {
    try {
      await readingCloud.addReading(p.day, p.secs, p.words, p.bookId, Object.keys(p.worlds || {})[0] || null);
      write('pending-reading', read('pending-reading', []).filter(x => x !== p));
    } catch (e) {}
  }
}

addEventListener('online', () => {
  flushAll().catch(() => {});
});

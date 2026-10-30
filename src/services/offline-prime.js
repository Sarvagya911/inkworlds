// Bootstraps the local offline cache from Supabase while the account is online.
import * as libraryCloud from './library.js';
import * as readingCloud from './reading.js';
import { myId } from './session.js';

const key = name => `iw:offline:${myId() || 'guest'}:${name}`;

function set(name, value) {
  try { localStorage.setItem(key(name), JSON.stringify(value)); } catch (e) {}
}

export async function primeOfflineCache() {
  if (!myId() || navigator.onLine === false) return;

  try {
    const books = await libraryCloud.myBooks();
    set('library', books || []);

    const [progress, days] = await Promise.all([
      readingCloud.allProgress().catch(() => []),
      readingCloud.readingDays().catch(() => [])
    ]);

    for (const p of progress || []) {
      if (p?.bookId) set(`progress:${p.bookId}`, p);
    }
    set('reading-days', days || []);

    await Promise.all((books || []).map(async book => {
      if (!book?.id) return;
      const [highlights, bookmarks] = await Promise.all([
        readingCloud.highlights(book.id).catch(() => []),
        readingCloud.bookmarks(book.id).catch(() => [])
      ]);
      set(`highlights:${book.id}`, highlights || []);
      set(`bookmarks:${book.id}`, bookmarks || []);
    }));
  } catch (e) {
    // Offline cache is an enhancement; never block app startup on it.
  }
}

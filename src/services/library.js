// Saved Discover books. A library entry points to the original book; it never copies ownership.
import * as booksCloud from './books.js';
import { sb } from './client.js';
import { myId } from './session.js';

const cacheKey = () => `iw:offline:${myId() || 'guest'}:library`;

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(cacheKey()) || '[]');
  } catch (e) {
    return [];
  }
}

function writeCache(value) {
  try { localStorage.setItem(cacheKey(), JSON.stringify(value)); } catch (e) {}
  return value;
}

export async function myLibraryIds() {
  if (!myId()) return [];
  if (navigator.onLine === false) return readCache().filter(b => b.libraryAdded).map(b => b.id);
  try {
    const { data, error } = await sb()
      .from('book_library')
      .select('book_id')
      .eq('user_id', myId());
    if (error) throw error;
    return (data || []).map(r => r.book_id);
  } catch (e) {
    return readCache().filter(b => b.libraryAdded).map(b => b.id);
  }
}

export async function isInLibrary(bookId) {
  if (!myId() || !bookId) return false;
  return (await myLibraryIds()).includes(bookId);
}

export async function addToLibrary(bookId) {
  if (!myId()) throw new Error('Sign in to add books to your library.');
  if (!bookId) throw new Error('Book not found.');

  const { error } = await sb()
    .from('book_library')
    .insert({ user_id: myId(), book_id: bookId });

  if (error && error.code !== '23505') throw error;

  const book = await booksCloud.bookMeta(bookId).catch(() => null);
  if (book) {
    writeCache([
      { ...book, libraryAdded: true, added: Date.now() },
      ...readCache().filter(b => b.id !== bookId)
    ]);
  }

  return true;
}

export async function removeFromLibrary(bookId) {
  if (!myId()) return;
  const { error } = await sb()
    .from('book_library')
    .delete()
    .eq('user_id', myId())
    .eq('book_id', bookId);
  if (error) throw error;
  writeCache(readCache().filter(b => b.id !== bookId));
}

export async function myBooks() {
  const cached = readCache();
  if (!myId()) return [];
  if (navigator.onLine === false) return cached;

  try {
    const owned = await booksCloud.myBooks();
    const { data, error } = await sb()
      .from('book_library')
      .select('book_id, added_at')
      .eq('user_id', myId())
      .order('added_at', { ascending: false });
    if (error) throw error;

    const added = [];
    for (const row of data || []) {
      const book = await booksCloud.bookMeta(row.book_id).catch(() => null);
      if (!book || book.own) continue;
      added.push({ ...book, libraryAdded: true, added: new Date(row.added_at).getTime() });
    }

    const mine = owned.map(b => ({ ...b, libraryAdded: false }));
    return writeCache([...mine, ...added]);
  } catch (e) {
    return cached;
  }
}

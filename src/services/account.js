// Export and bulk delete of your data.
import { Cache } from '../lib/cache.js';
import { deleteBook, myBooks } from './books.js';
import { must, sb } from './client.js';
import { allProgress, highlights, readingDays } from './reading.js';
import { myId, session } from './session.js';

export async function exportMyData() {
  const [books, hl, prog, days] = await Promise.all([myBooks(), highlights(), allProgress(), readingDays()]);
  const bm = must(await sb().from('bookmarks').select('*').eq('user_id', myId()));
  return {
    app: 'inkworlds',
    exported: new Date().toISOString(),
    profile: session.profile,
    books,
    highlights: hl,
    bookmarks: bm,
    progress: prog,
    readingDays: days
  };
}

export async function deleteAllMyBooks() {
  for (const b of await myBooks()) await deleteBook(b);
  await Cache.clear();
}

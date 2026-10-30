// Explicit offline downloads. Normal books/EPUBs are already normalized to chapter data,
// so downloading warms the same IndexedDB cache used by the reader.
import { Cache } from '../lib/cache.js';
import { bookText } from './books.js';

const key = id => `iw:downloaded:${id}`;

export function isDownloaded(id) {
  try {
    return localStorage.getItem(key(id)) === '1';
  } catch (e) {
    return false;
  }
}

function mark(id, value) {
  try {
    if (value) localStorage.setItem(key(id), '1');
    else localStorage.removeItem(key(id));
  } catch (e) {}
}

export async function downloadBook(meta, onProgress = () => {}) {
  if (!meta?.id) throw new Error('Book not found.');

  if (meta.contentType === 'manga') {
    throw new Error('Manga offline downloads are not enabled yet.');
  }

  onProgress(0.1, 'Downloading book…');
  const chapters = await bookText(meta);
  await Cache.put({
    id: meta.id,
    path: meta.textPath,
    chapters,
    downloaded: true,
    downloadedAt: Date.now()
  });
  mark(meta.id, true);
  onProgress(1, 'Available offline.');
  return true;
}

export async function removeDownload(id) {
  if (!id) return;
  await Cache.del(id);
  mark(id, false);
}

// Every call to Supabase lives in this folder, one file per area.
export * from './session.js';
export * from './profiles.js';
export * from './books.js';
export * from './reading.js';
export * from './communities.js';
export * from './comments.js';
export * from './ai.js';
export * from './account.js';
export * from './downloads.js';
export * from './library.js';

// Explicit exports from the offline layer override the same named star exports above.
export {
  bookMeta,
  createBook,
  getProgress,
  allProgress,
  highlights,
  addHighlight,
  updateHighlight,
  deleteHighlight,
  bookmarks,
  addBookmark,
  deleteBookmark,
  addReading,
  readingDays
} from './offline-v2.js';

// Library loading has its own online/offline cache because it combines
// books owned by the user with public books the user has added.
export { myBooks } from './library.js';

export { primeOfflineCache } from './offline-prime.js';

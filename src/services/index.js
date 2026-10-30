// Every call to Supabase lives in this folder, one file per area.
export * from './session.js';
export * from './profiles.js';
export * from './books.js';
export * from './reading.js';
export * from './communities.js';
export * from './comments.js';
export * from './ai.js';
export * from './account.js';

// Explicit exports from the offline layer override the same named star exports above.
export {
  myBooks,
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

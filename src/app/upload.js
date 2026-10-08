// Shared state for the book upload flow.

import { CONTENT_TYPES } from '../services/books.js';

let selectedContentType = CONTENT_TYPES.BOOK;

export function setUploadContentType(type) {
  if (
    type === CONTENT_TYPES.BOOK ||
    type === CONTENT_TYPES.LIGHT_NOVEL ||
    type === CONTENT_TYPES.MANGA
  ) {
    selectedContentType = type;
  } else {
    selectedContentType = CONTENT_TYPES.BOOK;
  }
}

export function getUploadContentType() {
  return selectedContentType;
}
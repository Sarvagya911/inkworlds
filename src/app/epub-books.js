// EPUB upload path kept separate from the mature PDF/TXT pipeline.
import { busy, enc, errMsg, signedIn } from './helpers.js';
import { rememberDestination } from '../auth/session.js';
import { detectTheme } from '../engine/parser/detect.js';
import { extractEpub } from '../engine/parser/epub.js';
import { toast, words } from '../lib/utils.js';
import * as cloud from '../services/index.js';
import { CONTENT_TYPES } from '../services/books.js';
import { getUploadContentType } from './upload.js';

export async function addEpubFile(file) {
  if (!file) return;

  if (!signedIn()) {
    rememberDestination('#/library');
    toast('Sign in to add books to your library.');
    location.hash = '#/signin';
    return;
  }

  if (getUploadContentType() === CONTENT_TYPES.MANGA) {
    toast('Manga must be uploaded as a PDF so the original pages can be preserved.');
    return;
  }

  busy(true, `Opening “${file.name}”…`, 0);

  try {
    const result = await extractEpub(file, (progress, text) => busy(true, text, progress));
    const total = words(result.chapters.flatMap(c => c.paras).join(' '));

    if (total < 60) {
      throw new Error('This EPUB does not contain enough readable text to make a book.');
    }

    busy(true, 'Preparing the story world…', 0.9);
    const det = detectTheme(result.chapters);

    const meta = await cloud.createBook(
      {
        title: result.title?.trim() || file.name.replace(/\.epub$/i, ''),
        author: result.author?.trim() || '',
        contentType: getUploadContentType(),
        auto: det.theme,
        hits: det.hits,
        words: total
      },
      result.chapters,
      result.cover
    );

    busy(false);
    location.hash = '#/book/' + enc(meta.id);
  } catch (e) {
    busy(false);
    toast(e.message ? errMsg(e) : 'Something went wrong while reading this EPUB.', 6500);
  }
}

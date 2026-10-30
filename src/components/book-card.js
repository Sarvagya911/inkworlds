// Book card used on Discover and community pages.
import { themeOf } from '../app/books.js';
import { enc, nameOf, nl, signedIn } from '../app/helpers.js';
import { rememberDestination } from '../auth/session.js';
import { contentTypeLabel } from '../services/books.js';
import {
  addToLibrary,
  downloadBook,
  isDownloaded,
  removeDownload
} from '../services/index.js';
import { THEMES, fontStack } from '../config/themes.js';
import { esc, toast } from '../lib/utils.js';

const cardBooks = new Map();

function installCardActions() {
  if (window.__inkworldsBookCardActions) return;
  window.__inkworldsBookCardActions = true;

  document.addEventListener('click', async e => {
    const button = e.target.closest?.('[data-book-action]');
    if (!button) return;

    e.preventDefault();
    e.stopPropagation();

    const id = button.dataset.bookId;
    const action = button.dataset.bookAction;
    const book = cardBooks.get(id);
    if (!book) return;

    if (!signedIn()) {
      rememberDestination(location.hash);
      location.hash = '#/signin';
      return;
    }

    button.disabled = true;

    try {
      if (action === 'library') {
        await addToLibrary(id);
        book.inLibrary = true;
        button.textContent = '✓ In Library';
        button.dataset.bookAction = 'library-remove';
        toast('Added to your library.');
      } else if (action === 'library-remove') {
        const { removeFromLibrary } = await import('../services/library.js');
        await removeFromLibrary(id);
        book.inLibrary = false;
        button.textContent = '+ Add to Library';
        button.dataset.bookAction = 'library';
        toast('Removed from your library.');
      } else if (action === 'download') {
        if (!book.inLibrary && !book.own) {
          await addToLibrary(id);
          book.inLibrary = true;
        }
        await downloadBook(book);
        button.textContent = '✓ Offline';
        button.dataset.bookAction = 'download-remove';
        toast('Book downloaded for offline reading.');
      } else if (action === 'download-remove') {
        await removeDownload(id);
        button.textContent = '↓ Download';
        button.dataset.bookAction = 'download';
        toast('Offline copy removed.');
      }
    } catch (err) {
      toast(err?.message || 'Could not update this book.');
    } finally {
      button.disabled = false;
    }
  });
}

export function bookCard(b, ppl, showContentType = true) {
  installCardActions();
  cardBooks.set(b.id, b);

  const key = themeOf(b);
  const th = THEMES[key];

  const cover = b.coverUrl
    ? `<div class="bcover bcover-real"><img src="${esc(b.coverUrl)}" alt="" loading="lazy"></div>`
    : `<div class="bcover" style="--s1:${th.spine[0]};--s2:${th.spine[1]};--s3:${th.spine[2]};--sf:${esc(fontStack(th.title, 'title'))}">${esc(b.title)}</div>`;

  const typeBadge = showContentType
    ? `<span class="content-type">${esc(contentTypeLabel(b.contentType))}</span>`
    : '';

  const own = !!b.own;
  const inLibrary = own || !!b.inLibrary;
  const downloaded = isDownloaded(b.id);

  const actions = !b.sample
    ? `<div class="bcard-actions">
        ${own
          ? '<span class="bcard-state">Your book</span>'
          : `<button class="btn ghost small" type="button" data-book-action="${inLibrary ? 'library-remove' : 'library'}" data-book-id="${esc(b.id)}">${inLibrary ? '✓ In Library' : '+ Add to Library'}</button>`}
        <button class="btn ghost small" type="button" data-book-action="${downloaded ? 'download-remove' : 'download'}" data-book-id="${esc(b.id)}">${downloaded ? '✓ Offline' : '↓ Download'}</button>
      </div>`
    : '';

  return `
    <a class="bcard" href="#/book/${enc(b.id)}">
      ${cover}
      <div class="binfo">
        <b>${esc(b.title)}</b>
        ${typeBadge}
        <span class="by">${b.author ? esc(b.author) + '. ' : ''}${esc(th.name)}</span>
        <span class="by">${b.sample ? 'Inkworlds sample' : `Shared by ${esc(nameOf(ppl, b.ownerId))}`}${b.likeCount ? `. ${b.likeCount} like${b.likeCount === 1 ? '' : 's'}` : ''}${b.commentCount ? `. ${b.commentCount} comment${b.commentCount === 1 ? '' : 's'}` : ''}</span>
        ${b.desc ? `<p>${nl(b.desc)}</p>` : ''}
      </div>
      ${actions}
    </a>
  `;
}

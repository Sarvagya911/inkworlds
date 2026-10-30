import { getBook } from '../app/books.js';
import { rememberDestination } from '../auth/session.js';
import { addToLibrary, downloadBook, isDownloaded } from '../services/index.js';
import { signedIn } from '../app/helpers.js';
import { toast } from '../lib/utils.js';

let mountedFor = '';

const utilityStyle = `
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:.35rem 1rem;
  margin-top:.65rem;
`;

const buttonStyle = `
  appearance:none;
  border:0;
  padding:0;
  background:none;
  color:inherit;
  font:inherit;
  font-size:.88rem;
  opacity:.78;
  cursor:pointer;
  text-decoration:none;
  transition:opacity .15s ease;
`;

export async function mountBookActions(id) {
  if (mountedFor === id) return;

  const host = document.querySelector('.book-grid .actions');
  if (!host) return;

  const book = await getBook(id).catch(() => null);
  if (!book) return;

  const meta = book.meta;
  if (meta.sample) return;

  mountedFor = id;

  const wrap = document.createElement('div');
  wrap.className = 'book-utility-actions';
  wrap.style.cssText = utilityStyle;

  const parts = [];

  if (!meta.own) {
    parts.push(`
      <button
        id="bookLibraryAction"
        type="button"
        style="${buttonStyle}"
        aria-label="Add this book to your library"
      >＋ Add to library</button>
    `);
  }

  parts.push(`
    <button
      id="bookDownloadAction"
      type="button"
      style="${buttonStyle}"
      aria-label="Download this book for offline reading"
    ></button>
  `);

  wrap.innerHTML = parts.join('<span class="muted" aria-hidden="true">·</span>');
  host.insertAdjacentElement('afterend', wrap);

  const libraryButton = wrap.querySelector('#bookLibraryAction');
  const downloadButton = wrap.querySelector('#bookDownloadAction');
  let inLibrary = !!meta.own;

  const paintDownload = () => {
    const downloaded = isDownloaded(id);
    downloadButton.textContent = downloaded
      ? '✓ Available offline'
      : '↓ Download for offline';
    downloadButton.setAttribute(
      'aria-label',
      downloaded
        ? 'Remove offline copy'
        : 'Download this book for offline reading'
    );
  };

  if (libraryButton) {
    libraryButton.addEventListener('mouseenter', () => (libraryButton.style.opacity = '1'));
    libraryButton.addEventListener('mouseleave', () => (libraryButton.style.opacity = '.78'));
    libraryButton.addEventListener('click', async () => {
      if (!meta.own && !inLibrary) {
        if (!signedIn()) {
          rememberDestination(location.hash);
          location.hash = '#/signin';
          return;
        }
        libraryButton.disabled = true;
        try {
          await addToLibrary(id);
          inLibrary = true;
          libraryButton.textContent = '✓ In your library';
          toast('Added to your library.');
        } catch (e) {
          toast(e?.message || 'Could not add this book to your library.');
        } finally {
          libraryButton.disabled = false;
        }
      }
    });
  }

  downloadButton.addEventListener('mouseenter', () => (downloadButton.style.opacity = '1'));
  downloadButton.addEventListener('mouseleave', () => (downloadButton.style.opacity = '.78'));
  downloadButton.addEventListener('click', async () => {
    if (!signedIn()) {
      rememberDestination(location.hash);
      location.hash = '#/signin';
      return;
    }

    downloadButton.disabled = true;
    try {
      if (!inLibrary && !meta.own) {
        await addToLibrary(id);
        inLibrary = true;
        if (libraryButton) libraryButton.textContent = '✓ In your library';
      }

      if (isDownloaded(id)) {
        const { removeDownload } = await import('../services/downloads.js');
        await removeDownload(id);
        toast('Offline copy removed.');
      } else {
        await downloadBook(meta);
        toast('Book downloaded for offline reading.');
      }
      paintDownload();
    } catch (e) {
      toast(e?.message || 'Could not update the offline copy.');
    } finally {
      downloadButton.disabled = false;
    }
  });

  paintDownload();
}

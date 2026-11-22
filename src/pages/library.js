// // Your library shelf.
// import { sampleMeta, themeOf } from '../app/books.js';
// import { app, enc, errMsg, signInGate, signedIn } from '../app/helpers.js';
// import { routeId, subs } from '../app/router.js';
// import { progOf } from '../app/sync.js';
// import { rememberDestination } from '../auth/session.js';
// import { THEMES, fontStack } from '../config/themes.js';
// import { SAMPLES } from '../content/samples.js';
// import { $, clamp, esc } from '../lib/utils.js';
// import * as cloud from '../services/index.js';

// export function spineHTML(book) {
//   const th = THEMES[themeOf(book)],
//     hash = [...book.id].reduce((a, ch) => a + ch.charCodeAt(0), 0),
//     pct = Math.round(((progOf(book.id) || {}).pct || 0) * 100);
//   const style = `height:${196 + (hash % 6) * 11}px;width:${clamp(46 + (book.words || 3000) / 5000, 48, 84)}px;--s1:${th.spine[0]};--s2:${th.spine[1]};--s3:${th.spine[2]};--sf:${esc(fontStack(th.title, 'title'))}`;
//   const pub = book.visibility === 'public' && !book.sample;
//   return `<a class="spine" href="#/book/${enc(book.id)}" style="${style}" aria-label="${esc(book.title)}${pub ? ', public' : ''}${pct ? `, ${pct}% read` : ''}">${pub ? '<span class="pub" title="Public"></span>' : ''}<span class="t">${esc(book.title)}</span>${pct ? `<span class="pct">${pct}%</span>` : ''}</a>`;
// }

// export async function viewLibrary() {
//   const rid = routeId;
//   app.innerHTML = `<section class="view">
//     <h1 class="page-title">Library</h1>
//     <p class="lede">Your books, saved to your account. Add a PDF or a plain-text book, or drop a file anywhere on this page.</p>
//     <div class="actions"><button class="btn" id="addBtn" type="button">Add a book</button><span class="muted" style="font-size:.95rem">Free classics like <em>Dracula</em> are on Project Gutenberg as .txt and PDF.</span></div>
//     <div class="shelf-block"><h2 class="section-title">Your shelf</h2><div id="mine"><p class="muted">Loading your books…</p></div></div>
//     <div class="shelf-block"><h2 class="section-title">Samples</h2><p class="sub">Two short original stories that show how the reader changes with each book.</p>
//       <div class="shelf">${SAMPLES.map(s => spineHTML(sampleMeta(s))).join('')}</div></div>
//   </section>`;
//   $('addBtn').addEventListener('click', () => {
//     if (!signedIn()) {
//       rememberDestination('#/library');
//       location.hash = '#/signin';
//       return;
//     }
//     $('fileIn').click();
//   });
//   if (!signedIn()) {
//     $('mine').innerHTML = signInGate('build your library');
//     return;
//   }
//   let mine = [];
//   try {
//     mine = await cloud.myBooks();
//   } catch (e) {
//     if (rid === routeId) $('mine').innerHTML = `<div class="empty-box">${esc(errMsg(e))}</div>`;
//     return;
//   }
//   if (rid !== routeId) return;
//   $('mine').innerHTML =
//     `<div class="lib-tools"><input class="input" id="libSearch" type="search" placeholder="Search by title or author" aria-label="Search your shelf">
//       <select class="input" id="libSort" aria-label="Sort books"><option value="recent">Recently added</option><option value="read">Recently read</option><option value="title">Title</option><option value="progress">Progress</option></select></div>
//     <p class="sub">Pick a book to see its world and chapters. A dot on the spine means it's public.</p><div class="shelf" id="shelfMine"></div>`;
//   const draw = () => {
//     const q = $('libSearch').value.trim().toLowerCase(),
//       sort = $('libSort').value,
//       p = b => progOf(b.id) || {};
//     const list = mine.filter(b => !q || (b.title + ' ' + b.author).toLowerCase().includes(q));
//     list.sort((a, b) =>
//       sort === 'title'
//         ? a.title.localeCompare(b.title)
//         : sort === 'progress'
//           ? (p(b).pct || 0) - (p(a).pct || 0)
//           : sort === 'read'
//             ? (p(b).updated || 0) - (p(a).updated || 0)
//             : b.added - a.added
//     );
//     $('shelfMine').innerHTML = list.length
//       ? list.map(spineHTML).join('')
//       : `<p class="empty">${mine.length ? 'No books match that search.' : 'Your shelf is empty. Add a PDF or text file to start, or open a sample below.'}</p>`;
//   };
//   $('libSearch').addEventListener('input', draw);
//   $('libSort').addEventListener('change', draw);
//   draw();
// }


// Your library shelves.

import {
  sampleMeta,
  themeOf
} from '../app/books.js';

import {
  app,
  enc,
  errMsg,
  signInGate,
  signedIn
} from '../app/helpers.js';

import { routeId, subs } from '../app/router.js';
import { progOf } from '../app/sync.js';
import { rememberDestination } from '../auth/session.js';

import {
  setUploadContentType
} from '../app/upload.js';

import {
  CONTENT_TYPES,
  contentTypeLabel
} from '../services/books.js';

import {
  THEMES,
  fontStack
} from '../config/themes.js';

import { SAMPLES } from '../content/samples.js';

import {
  $,
  clamp,
  esc
} from '../lib/utils.js';

import * as cloud from '../services/index.js';

const TYPE_TABS = [
  {
    id: '',
    label: 'All'
  },
  {
    id: CONTENT_TYPES.BOOK,
    label: 'Novels'
  },
  {
    id: CONTENT_TYPES.LIGHT_NOVEL,
    label: 'Light Novels'
  },
  {
    id: CONTENT_TYPES.MANGA,
    label: 'Manga'
  }
];

function typeOf(book) {
  return (
    book.contentType ||
    CONTENT_TYPES.BOOK
  );
}

export function getTitleTypography(title, spineW, spineH) {
  const clean = (title || '').trim();
  const len = clean.length;
  const words = clean.split(/\s+/);
  const longestWord = Math.max(...words.map(w => w.length), 0);

  let fontSize = 0.98;
  let lineHeight = 1.14;

  if (len <= 14) {
    fontSize = spineW >= 56 ? 1.02 : 0.94;
    lineHeight = 1.15;
  } else if (len <= 24) {
    fontSize = spineW >= 60 ? 0.94 : (spineW >= 52 ? 0.88 : 0.82);
    lineHeight = 1.12;
  } else if (len <= 34) {
    if (spineW >= 64) fontSize = 0.88;
    else if (spineW >= 54) fontSize = 0.80;
    else if (spineW >= 46) fontSize = 0.74;
    else fontSize = 0.68;
    lineHeight = 1.10;
  } else {
    // 35+ characters (e.g. "Harry Potter and the Chamber of Secrets")
    if (spineW >= 64) fontSize = 0.82;
    else if (spineW >= 54) fontSize = 0.74;
    else if (spineW >= 46) fontSize = 0.68;
    else fontSize = 0.64;
    lineHeight = 1.06;
  }

  if (spineW < 46 && (len > 20 || longestWord > 8)) {
    fontSize = Math.min(fontSize, 0.65);
    lineHeight = 1.04;
  }

  return {
    fontSize: `${fontSize}rem`,
    lineHeight: `${lineHeight}`,
  };
}

export function spineHTML(book) {
  const th = THEMES[themeOf(book)];

  const hash = [...book.id].reduce(
    (a, ch) => a + ch.charCodeAt(0),
    0
  );

  const pct = Math.round(
    ((progOf(book.id) || {}).pct || 0) * 100
  );

  const pages =
    book.pages ||
    Math.max(70, Math.round((book.words || 3000) / 280));
  // Proportional height: thicker volumes stand taller like hardcover omnibuses (212px - 246px)
  const baseH = 212 + clamp(Math.round(pages * 0.036), 0, 30);
  const spineH = clamp(baseH + ((hash % 5) - 2) * 3, 208, 246);
  const spineW = getSpineWidth(book);
  const typo = getTitleTypography(book.title, spineW, spineH);

  const style = `
    height:${spineH}px;
    width:${spineW}px;
    --s1:${th.spine[0]};
    --s2:${th.spine[1]};
    --s3:${th.spine[2]};
    --sf:${esc(fontStack(th.title, 'title'))};
    --tf:${typo.fontSize};
    --tlh:${typo.lineHeight};
  `;

  const pub =
    book.visibility === 'public' &&
    !book.sample;

  return `
    <a
      class="spine"
      href="#/book/${enc(book.id)}"
      style="${style}"
      aria-label="${esc(book.title)}${
        pub ? ', public' : ''
      }${
        pct ? `, ${pct}% read` : ''
      }"
    >
      ${
        pub
          ? '<span class="pub" title="Public"></span>'
          : ''
      }

      <span class="t">
        ${esc(book.title)}
      </span>

      ${
        pct
          ? `<span class="pct">${pct}%</span>`
          : ''
      }
    </a>
  `;
}

function showUploadTypePicker() {
  const existing =
    document.getElementById(
      'uploadTypePicker'
    );

  if (existing) {
    existing.remove();
  }

  const overlay =
    document.createElement('div');

  overlay.id = 'uploadTypePicker';
  overlay.className =
    'upload-type-overlay';

  overlay.innerHTML = `
    <div
      class="upload-type-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="uploadTypeTitle"
    >
      <button
        class="upload-type-close"
        id="uploadTypeClose"
        type="button"
        aria-label="Close"
      >
        ×
      </button>

      <div class="upload-type-heading">
        <span class="upload-type-kicker">
          Add to your library
        </span>

        <h2 id="uploadTypeTitle">
          What are you adding?
        </h2>

        <p>
          Choose the kind of story you're about to
          upload.
        </p>
      </div>

      <div
        class="upload-type-options"
        role="list"
      >
        <button
          class="upload-type-option"
          type="button"
          data-upload-type="${CONTENT_TYPES.BOOK}"
        >
          <span class="upload-type-icon">
            📖
          </span>

          <span class="upload-type-copy">
            <strong>Novel</strong>
            <small>
              Traditional prose fiction
            </small>
          </span>

          <span class="upload-type-arrow">
            →
          </span>
        </button>

        <button
          class="upload-type-option"
          type="button"
          data-upload-type="${CONTENT_TYPES.LIGHT_NOVEL}"
        >
          <span class="upload-type-icon">
            ✨
          </span>

          <span class="upload-type-copy">
            <strong>Light Novel</strong>
            <small>
              Japanese-style light fiction
            </small>
          </span>

          <span class="upload-type-arrow">
            →
          </span>
        </button>

        <button
          class="upload-type-option"
          type="button"
          data-upload-type="${CONTENT_TYPES.MANGA}"
        >
          <span class="upload-type-icon">
            🖼️
          </span>

          <span class="upload-type-copy">
            <strong>Manga</strong>
            <small>
              Manga and illustrated stories
            </small>
          </span>

          <span class="upload-type-arrow">
            →
          </span>
        </button>
      </div>

      <button
        class="upload-type-cancel"
        id="uploadTypeCancel"
        type="button"
      >
        Cancel
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.classList.add('is-closing');

    setTimeout(() => {
      overlay.remove();
    }, 150);
  };

  const openFilePicker = type => {
    setUploadContentType(type);
    close();

    setTimeout(() => {
      $('fileIn').click();
    }, 120);
  };

  overlay
    .querySelectorAll(
      '[data-upload-type]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          openFilePicker(
            button.dataset.uploadType
          );
        }
      );
    });

  $('uploadTypeClose').addEventListener(
    'click',
    close
  );

  $('uploadTypeCancel').addEventListener(
    'click',
    close
  );

  overlay.addEventListener(
    'click',
    e => {
      if (e.target === overlay) {
        close();
      }
    }
  );

  const onKeyDown = e => {
    if (e.key === 'Escape') {
      close();

      document.removeEventListener(
        'keydown',
        onKeyDown
      );
    }
  };

  document.addEventListener(
    'keydown',
    onKeyDown
  );
}

/* ---------- Shelf rendering ---------- */

const expandedShelves = new Set();

export function getSpineWidth(book) {
  // Estimated pages: ~280 words per page (or book.pages if present)
  const pages =
    book.pages ||
    Math.max(70, Math.round((book.words || 3000) / 280));
  // Elegant width curve: slender novellas 40-44px, medium 48-56px, substantial 58-64px, thickest tomes 66-68px
  // Capped at 68px so thick volumes stay slender, stately, and never look stubby!
  const baseW = 34 + Math.round(Math.sqrt(pages) * 1.15);
  return clamp(baseW, 40, 68);
}

function chunkBooksIntoShelves(books, containerWidth, reserveSpace = 0) {
  if (!books.length) return [];
  // Use actual container width minus shelf side padding (1rem left + 1rem right = 32px, allow snug fill)
  const baseAvail = Math.max(320, (containerWidth || 960) - 24);
  const gap = 6;
  const shelves = [];
  let currentShelf = [];
  let currentWidth = 0;

  for (const book of books) {
    const spineW = getSpineWidth(book);
    const needed = currentShelf.length === 0 ? spineW : spineW + gap;
    const avail =
      shelves.length === 0 && reserveSpace > 0
        ? baseAvail - reserveSpace
        : baseAvail;

    if (currentShelf.length > 0 && currentWidth + needed > avail) {
      shelves.push(currentShelf);
      currentShelf = [book];
      currentWidth = spineW;
    } else {
      currentShelf.push(book);
      currentWidth += needed;
    }
  }

  if (currentShelf.length > 0) {
    shelves.push(currentShelf);
  }

  return shelves;
}

function secretTomeHTML(categoryId, isExpanded, extraBooksCount, totalBooks) {
  return `
    <button
      type="button"
      class="spine secret-tome-spine ${isExpanded ? 'is-expanded' : 'is-collapsed'}"
      data-shelf-toggle="${esc(categoryId)}"
      aria-expanded="${isExpanded ? 'true' : 'false'}"
      aria-label="${isExpanded ? 'Fold lower shelves' : `Secret archive: pull book to reveal ${extraBooksCount} more tomes`}"
      title="${isExpanded ? 'Secret archive: push book to fold shelves' : `Secret archive: pull book to reveal ${extraBooksCount} more tomes`}"
    >
      <span class="secret-tome-ribbon" aria-hidden="true"></span>
      <svg class="secret-spine-pattern" viewBox="0 0 34 180" width="26" height="170" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <!-- Top Tooling Band -->
        <line x1="2" y1="6" x2="32" y2="6" stroke-width="1.3"/>
        <line x1="4" y1="9" x2="30" y2="9" stroke-width="0.8" stroke-dasharray="1.5 1.5"/>

        <!-- Compartment 1: Gilded Crown & Scrollwork -->
        <path d="M17 14c-1.5 2.5-4 4-4 6.5 0 2 1.8 3.5 4 3.5s4-1.5 4-3.5c0-2.5-2.5-4-4-6.5z" stroke-width="1" fill="currentColor" fill-opacity="0.18"/>
        <path d="M11 22c-2 2-3 4-1 5.5 2.5 1.5 5-1 7-3.5M23 22c2 2 3 4 1 5.5-2.5 1.5-5-1-7-3.5" stroke-width="0.9"/>
        <circle cx="17" cy="20" r="1.5" fill="currentColor"/>

        <!-- Rib 1 -->
        <line x1="2" y1="36" x2="32" y2="36" stroke-width="1.4"/>
        <line x1="2" y1="39" x2="32" y2="39" stroke-width="0.8"/>

        <!-- Compartment 2: Upper Arabesque Foliage -->
        <path d="M17 46c-4.5 2.5-8 7-8 11.5 0 4 3.5 7 8 9 4.5-2 8-5 8-9 0-4.5-3.5-9-8-11.5z" stroke-width="0.9" fill="currentColor" fill-opacity="0.08"/>
        <circle cx="17" cy="57" r="2.8" stroke-width="0.9" fill="currentColor" fill-opacity="0.25"/>
        <path d="M13 57h8M17 53v8" stroke-width="0.8"/>
        <path d="M10 52c2-1 4-1 5 1M24 52c-2-1-4-1-5 1" stroke-width="0.8"/>

        <!-- Rib 2 (Centerpiece Frame) -->
        <line x1="2" y1="73" x2="32" y2="73" stroke-width="1.4"/>
        <line x1="4" y1="76" x2="30" y2="76" stroke-width="0.8" stroke-dasharray="1.5 1.5"/>

        <!-- Compartment 3 (Centerpiece): The Gilded Secret Keyhole Medallion -->
        <circle cx="17" cy="92" r="10" stroke-width="1.2" fill="currentColor" fill-opacity="0.12"/>
        <circle cx="17" cy="92" r="7.5" stroke-width="0.8" stroke-dasharray="1.5 1.5"/>
        <!-- Keyhole in center -->
        <circle cx="17" cy="90.5" r="2.2" fill="currentColor" stroke="none"/>
        <path d="M15.8 91.5l-1 5h4.4l-1-5z" fill="currentColor" stroke="none"/>
        <!-- Laurel leaves embracing the keyhole -->
        <path d="M5 92c0-4.5 3.5-8 6-9M29 92c0-4.5-3.5-8-6-9M5 92c0 4.5 3.5 8 6 9M29 92c0 4.5-3.5 8-6 9" stroke-width="0.9"/>

        <!-- Rib 3 -->
        <line x1="4" y1="108" x2="30" y2="108" stroke-width="0.8" stroke-dasharray="1.5 1.5"/>
        <line x1="2" y1="111" x2="32" y2="111" stroke-width="1.4"/>

        <!-- Compartment 4: Lower Arabesque Foliage -->
        <path d="M17 118c-4.5 2.5-8 7-8 11.5 0 4 3.5 7 8 9 4.5-2 8-5 8-9 0-4.5-3.5-9-8-11.5z" stroke-width="0.9" fill="currentColor" fill-opacity="0.08"/>
        <circle cx="17" cy="129" r="2.8" stroke-width="0.9" fill="currentColor" fill-opacity="0.25"/>
        <path d="M13 129h8M17 125v8" stroke-width="0.8"/>
        <path d="M10 134c2 1 4 1 5-1M24 134c-2 1-4 1-5-1" stroke-width="0.8"/>

        <!-- Rib 4 -->
        <line x1="2" y1="145" x2="32" y2="145" stroke-width="0.8"/>
        <line x1="2" y1="148" x2="32" y2="148" stroke-width="1.4"/>

        <!-- Compartment 5: Base Tailpiece & Flourish -->
        <path d="M17 155c-1.5-2.5-4-4-4-6.5 0-2 1.8-3.5 4-3.5s4 1.5 4 3.5c0 2.5-2.5 4-4 6.5z" stroke-width="1" fill="currentColor" fill-opacity="0.18"/>
        <path d="M11 150c-2-2-3-4-1-5.5 2.5-1.5 5 1 7 3.5M23 150c2-2 3-4 1-5.5-2.5-1.5-5 1-7 3.5" stroke-width="0.9"/>
        <circle cx="17" cy="152" r="1.5" fill="currentColor"/>

        <!-- Bottom Tooling Band -->
        <line x1="4" y1="168" x2="30" y2="168" stroke-width="0.8" stroke-dasharray="1.5 1.5"/>
        <line x1="2" y1="171" x2="32" y2="171" stroke-width="1.3"/>
      </svg>
    </button>
  `;
}

function renderShelf(
  title,
  books,
  emptyMessage = '',
  categoryId = ''
) {
  if (!books.length) {
    if (!emptyMessage) {
      return '';
    }

    return `
      <div class="shelf-block">
        <h2 class="section-title">
          ${esc(title)}
        </h2>

        <div class="shelf">
          <p class="empty">
            ${esc(emptyMessage)}
          </p>
        </div>
      </div>
    `;
  }

  // Mobile: Keep untouched single horizontal-scrolling shelf!
  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 600px)').matches;

  if (isMobile) {
    return `
      <div class="shelf-block">
        <h2 class="section-title">
          ${esc(title)}
        </h2>

        <div class="shelf">
          ${books.map(spineHTML).join('')}
        </div>
      </div>
    `;
  }

  // Desktop / Tablet: multi-row physical bookcase tiers
  const libraryShelvesEl = $('libraryShelves');
  const containerWidth =
    (libraryShelvesEl && libraryShelvesEl.clientWidth) ||
    Math.min(window.innerWidth - 64, 1152) ||
    960;

  // First check if category overflows into multiple tiers
  const previewTiers = chunkBooksIntoShelves(books, containerWidth, 0);
  const previewOverflow = previewTiers.slice(1).reduce((sum, t) => sum + t.length, 0);
  const willOverflow = previewTiers.length > 1 && previewOverflow > 1;

  // If it will overflow, reserve exact width (46px: 40px tome + 6px gap) on tier 0 for the Secret Tome spine
  const tiers = willOverflow ? chunkBooksIntoShelves(books, containerWidth, 46) : previewTiers;
  const extraBooksCount = tiers.slice(1).reduce((sum, t) => sum + t.length, 0);
  const canCollapse = willOverflow && extraBooksCount > 0;

  const isExpanded = !canCollapse || expandedShelves.has(categoryId);

  const firstTier = tiers[0] || [];
  const extraTiers = tiers.slice(1);

  return `
    <div class="shelf-block" data-category="${esc(categoryId)}">
      <div class="shelf-header">
        <h2 class="section-title">
          ${esc(title)}
        </h2>
      </div>

      <div class="shelf-tiers">
        <div class="shelf shelf-tier">
          ${firstTier.map(spineHTML).join('')}
          ${canCollapse ? secretTomeHTML(categoryId, isExpanded, extraBooksCount, books.length) : ''}
        </div>

        ${
          extraTiers.length
            ? `
          <div class="shelf-extra-tiers ${isExpanded ? 'expanded' : 'collapsed'}" id="shelf-extra-${esc(categoryId)}">
            ${extraTiers
              .map(
                tier => `
              <div class="shelf shelf-tier">
                ${tier.map(spineHTML).join('')}
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>
    </div>
  `;
}

export async function viewLibrary() {
  const rid = routeId;

  let contentType = '';

  app.innerHTML = `
    <section class="view">

      <h1 class="page-title">
        Library
      </h1>

      <p class="lede">
        Your books, saved to your account.
        Add a PDF or a plain-text book,
        or drop a file anywhere on this page.
      </p>

      <div class="actions">

        <button
          class="btn"
          id="addBtn"
          type="button"
        >
          Add a book
        </button>

        <span
          class="muted"
          style="font-size:.95rem"
        >
          Free classics like
          <em>Dracula</em>
          are on Project Gutenberg as
          .txt and PDF.
        </span>

      </div>

      <div class="shelf-block">

        <h2 class="section-title">
          Your library
        </h2>

        <div
          class="content-tabs"
          role="tablist"
          aria-label="Library content type"
        >
          ${TYPE_TABS
            .map(
              tab => `
                <button
                  type="button"
                  role="tab"
                  data-lib-type="${esc(tab.id)}"
                  aria-selected="${tab.id === ''}"
                >
                  ${esc(tab.label)}
                </button>
              `
            )
            .join('')}
        </div>

        <div id="mine">
          <p class="muted">
            Loading your books…
          </p>
        </div>

      </div>

      <div class="shelf-block">

        <h2 class="section-title">
          Samples
        </h2>

        <p class="sub">
          Two short original stories that show
          how the reader changes with each book.
        </p>

        <div class="shelf">
          ${SAMPLES
            .map(s => spineHTML(sampleMeta(s)))
            .join('')}
        </div>

      </div>

    </section>
  `;

  $('addBtn').addEventListener(
    'click',
    () => {
      if (!signedIn()) {
        rememberDestination('#/library');
        location.hash = '#/signin';
        return;
      }

      showUploadTypePicker();
    }
  );

  if (!signedIn()) {
    $('mine').innerHTML =
      signInGate('build your library');
    return;
  }

  let mine = [];

  try {
    mine = await cloud.myBooks();
  } catch (e) {
    if (rid === routeId) {
      $('mine').innerHTML = `
        <div class="empty-box">
          ${esc(errMsg(e))}
        </div>
      `;
    }

    return;
  }

  if (rid !== routeId) {
    return;
  }

  $('mine').innerHTML = `
    <div class="lib-tools">

      <input
        class="input"
        id="libSearch"
        type="search"
        placeholder="Search by title or author"
        aria-label="Search your library"
      >

      <select
        class="input"
        id="libSort"
        aria-label="Sort books"
      >
        <option value="recent">
          Recently added
        </option>

        <option value="read">
          Recently read
        </option>

        <option value="title">
          Title
        </option>

        <option value="progress">
          Progress
        </option>
      </select>

    </div>

    <p class="sub">
      Pick a title to see its world and chapters.
      A dot on the spine means it's public.
    </p>

    <div id="libraryShelves"></div>
  `;

  const sortBooks = books => {
    const sort = $('libSort').value;
    const p = b => progOf(b.id) || {};

    const list = [...books];

    list.sort(
      (a, b) =>
        sort === 'title'
          ? a.title.localeCompare(b.title)
          : sort === 'progress'
            ? (p(b).pct || 0) -
              (p(a).pct || 0)
            : sort === 'read'
              ? (p(b).updated || 0) -
                (p(a).updated || 0)
              : b.added - a.added
    );

    return list;
  };

  const draw = () => {
    const q = $('libSearch')
      .value
      .trim()
      .toLowerCase();

    const searched = !q
      ? mine
      : mine.filter(book =>
          (
            (book.title || '') +
            ' ' +
            (book.author || '')
          )
            .toLowerCase()
            .includes(q)
        );

    const sorted = sortBooks(searched);

    const novels = sorted.filter(
      book =>
        typeOf(book) ===
        CONTENT_TYPES.BOOK
    );

    const lightNovels = sorted.filter(
      book =>
        typeOf(book) ===
        CONTENT_TYPES.LIGHT_NOVEL
    );

    const manga = sorted.filter(
      book =>
        typeOf(book) ===
        CONTENT_TYPES.MANGA
    );

    const shelves =
      $('libraryShelves');

    /*
     * ALL:
     * Show three separate physical shelves.
     * Empty categories are hidden.
     */
    if (contentType === '') {
      if (!sorted.length) {
        shelves.innerHTML = `
          <div class="shelf-block">
            <div class="shelf">
              <p class="empty">
                ${
                  mine.length
                    ? 'No titles match that search.'
                    : 'Your library is empty. Add a PDF or text file to start, or open a sample below.'
                }
              </p>
            </div>
          </div>
        `;

        return;
      }

      const attachToggleListeners = () => {
        shelves.querySelectorAll('[data-shelf-toggle]').forEach(btn => {
          btn.addEventListener('click', () => {
            const cat = btn.dataset.shelfToggle;
            if (expandedShelves.has(cat)) {
              expandedShelves.delete(cat);
            } else {
              expandedShelves.add(cat);
            }
            draw();
          });
        });
      };

      shelves.innerHTML = [
        renderShelf(
          'Novels',
          novels,
          '',
          'novels'
        ),
        renderShelf(
          'Light Novels',
          lightNovels,
          '',
          'light-novels'
        ),
        renderShelf(
          'Manga',
          manga,
          '',
          'manga'
        )
      ]
        .filter(Boolean)
        .join('');

      attachToggleListeners();
      return;
    }

    /*
     * CATEGORY:
     * Show only the selected category.
     * No category label is placed under
     * individual books.
     */
    let selected = [];
    let selectedTitle = '';

    if (
      contentType ===
      CONTENT_TYPES.BOOK
    ) {
      selected = novels;
      selectedTitle = 'Novels';
    } else if (
      contentType ===
      CONTENT_TYPES.LIGHT_NOVEL
    ) {
      selected = lightNovels;
      selectedTitle = 'Light Novels';
    } else if (
      contentType ===
      CONTENT_TYPES.MANGA
    ) {
      selected = manga;
      selectedTitle = 'Manga';
    }

    shelves.innerHTML = renderShelf(
      selectedTitle,
      selected,
      `You don't have any ${selectedTitle.toLowerCase()} yet.`,
      contentType || 'selected'
    );

    shelves.querySelectorAll('[data-shelf-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.shelfToggle;
        if (expandedShelves.has(cat)) {
          expandedShelves.delete(cat);
        } else {
          expandedShelves.add(cat);
        }
        draw();
      });
    });
  };

  document
    .querySelectorAll(
      '[data-lib-type]'
    )
    .forEach(btn => {
      btn.addEventListener(
        'click',
        () => {
          contentType =
            btn.dataset.libType || '';

          document
            .querySelectorAll(
              '[data-lib-type]'
            )
            .forEach(tab => {
              tab.setAttribute(
                'aria-selected',
                String(tab === btn)
              );
            });

          draw();
        }
      );
    });

  $('libSearch').addEventListener(
    'input',
    draw
  );

  $('libSort').addEventListener(
    'change',
    draw
  );

  draw();

  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (rid === routeId && $('libraryShelves')) {
        draw();
      }
    }, 150);
  };
  window.addEventListener('resize', onResize);
  subs.push(() => {
    clearTimeout(resizeTimer);
    window.removeEventListener('resize', onResize);
  });
}
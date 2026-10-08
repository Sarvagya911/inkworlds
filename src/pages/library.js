// // Your library shelf.
// import { sampleMeta, themeOf } from '../app/books.js';
// import { app, enc, errMsg, signInGate, signedIn } from '../app/helpers.js';
// import { routeId } from '../app/router.js';
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


// Your library shelf.

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

import { routeId } from '../app/router.js';
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

export function spineHTML(
  book,
  showCategory = false
) {
  const th = THEMES[themeOf(book)];

  const hash = [...book.id].reduce(
    (a, ch) =>
      a + ch.charCodeAt(0),
    0
  );

  const pct = Math.round(
    ((progOf(book.id) || {}).pct || 0) *
      100
  );

  const style = `
    height:${196 + (hash % 6) * 11}px;
    width:${clamp(
      46 + (book.words || 3000) / 5000,
      48,
      84
    )}px;
    --s1:${th.spine[0]};
    --s2:${th.spine[1]};
    --s3:${th.spine[2]};
    --sf:${esc(
      fontStack(th.title, 'title')
    )};
  `;

  const pub =
    book.visibility === 'public' &&
    !book.sample;

  const spine = `
    <a
      class="spine"
      href="#/book/${enc(book.id)}"
      style="${style}"
      aria-label="${esc(book.title)}${
        pub ? ', public' : ''
      }${
        pct
          ? `, ${pct}% read`
          : ''
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

  if (!showCategory) {
    return spine;
  }

  return `
    <div class="spine-item">
      ${spine}

      <span class="spine-category">
        ${esc(
          contentTypeLabel(
            typeOf(book)
          )
        )}
      </span>
    </div>
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

  overlay.id =
    'uploadTypePicker';

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
    overlay.classList.add(
      'is-closing'
    );

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

  $('uploadTypeClose')
    .addEventListener(
      'click',
      close
    );

  $('uploadTypeCancel')
    .addEventListener(
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
          Your shelf
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
                  aria-selected="${
                    tab.id === ''
                  }"
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
            .map(s =>
              spineHTML(
                sampleMeta(s),
                true
              )
            )
            .join('')}
        </div>

      </div>

    </section>
  `;

  $('addBtn').addEventListener(
    'click',
    () => {
      if (!signedIn()) {
        rememberDestination(
          '#/library'
        );

        location.hash =
          '#/signin';

        return;
      }

      showUploadTypePicker();
    }
  );

  if (!signedIn()) {
    $('mine').innerHTML =
      signInGate(
        'build your library'
      );

    return;
  }

  let mine = [];

  try {
    mine =
      await cloud.myBooks();
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
        aria-label="Search your shelf"
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

    <div
      class="shelf"
      id="shelfMine"
    ></div>
  `;

  const draw = () => {
    const q =
      $('libSearch')
        .value
        .trim()
        .toLowerCase();

    const sort =
      $('libSort').value;

    const p =
      b => progOf(b.id) || {};

    const list =
      mine.filter(book => {
        const matchesType =
          !contentType ||
          typeOf(book) ===
            contentType;

        const matchesSearch =
          !q ||
          (
            book.title +
            ' ' +
            book.author
          )
            .toLowerCase()
            .includes(q);

        return (
          matchesType &&
          matchesSearch
        );
      });

    list.sort(
      (a, b) =>
        sort === 'title'
          ? a.title.localeCompare(
              b.title
            )

          : sort === 'progress'
            ? (p(b).pct || 0) -
              (p(a).pct || 0)

            : sort === 'read'
              ? (p(b).updated || 0) -
                (p(a).updated || 0)

              : b.added - a.added
    );

    const showCategory =
      contentType === '';

    $('shelfMine').innerHTML =
      list.length
        ? list
            .map(book =>
              spineHTML(
                book,
                showCategory
              )
            )
            .join('')

        : `
          <p class="empty">
            ${
              mine.length
                ? 'No titles match that search or category.'
                : 'Your shelf is empty. Add a PDF or text file to start, or open a sample below.'
            }
          </p>
        `;
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
            btn.dataset.libType ||
            '';

          document
            .querySelectorAll(
              '[data-lib-type]'
            )
            .forEach(tab =>
              tab.setAttribute(
                'aria-selected',
                String(
                  tab === btn
                )
              )
            );

          draw();
        }
      );
    });

  $('libSearch')
    .addEventListener(
      'input',
      draw
    );

  $('libSort')
    .addEventListener(
      'change',
      draw
    );

  draw();
}
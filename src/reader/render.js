// // Turns chapters into the page: paragraphs, drop caps, handwritten letters, diaries, telegrams, newspapers.
// import { themeOf } from '../app/books.js';
// import { THEMES } from '../config/themes.js';
// import { buildBlocks, reDiaryDate } from '../engine/parser/structure.js';
// import { $, prefs, reduceMotion, titleCase, upperRatio } from '../lib/utils.js';
// import { paintHighlight } from './highlight-paint.js';
// import { paintBadges } from './passage-comments.js';
// import { cur } from './reader.js';

// export const prettyLabel = s => (upperRatio(s) > 0.6 ? titleCase(s) : s);

// export function renderDoc(b) {
//   const d = document.createElement('div');
//   d.className = 'doc ' + b.type;
//   const ink = document.createElement('div');
//   ink.className = 'ink';
//   if (b.type === 'telegram') {
//     const hd = document.createElement('div');
//     hd.className = 'tg-head';
//     const a = document.createElement('span');
//     a.textContent = 'Telegram';
//     const who = document.createElement('span');
//     who.textContent = prettyLabel(b.label.replace(/^telegram[,.:\s]*/i, '').replace(/\.$/, ''));
//     hd.append(a, who);
//     d.appendChild(hd);
//   } else if (b.type === 'news') {
//     const mast = document.createElement('div');
//     mast.className = 'mast';
//     mast.textContent = prettyLabel(b.label.replace(/^cutting from\s*/i, '').replace(/\.$/, ''));
//     d.appendChild(mast);
//   } else if (b.label) {
//     const l = document.createElement('p');
//     l.className = 'label';
//     l.textContent = prettyLabel(b.label);
//     d.appendChild(l);
//   }
//   for (const p of b.paras) {
//     const el = document.createElement('p');
//     el.dataset.si = p.si;
//     if (b.type === 'diary' && reDiaryDate.test(p.t)) {
//       const cut = p.t.indexOf('—');
//       if (cut > 0 && cut < 70) {
//         const dt = document.createElement('span');
//         dt.className = 'date';
//         dt.textContent = p.t.slice(0, cut + 1);
//         el.append(dt, document.createTextNode(p.t.slice(cut + 1)));
//       } else el.textContent = p.t;
//     } else el.textContent = p.t;
//     if (p.cls) el.className = p.cls;
//     ink.appendChild(el);
//   }
//   d.appendChild(ink);
//   if (prefs.motion && !reduceMotion) d.classList.add('will-ink');
//   return d;
// }

// export let inkObs = null;

// export function renderReaderBook() {
//   const pages = $('pages');
//   pages.innerHTML = '';
//   const th = THEMES[themeOf(cur.meta)];
//   if (inkObs) inkObs.disconnect();
//   inkObs = new IntersectionObserver(
//     es =>
//       es.forEach(e => {
//         if (e.isIntersecting) {
//           e.target.classList.add('inked');
//           inkObs.unobserve(e.target);
//         }
//       }),
//     { rootMargin: '0px 0px -12% 0px' }
//   );
//   cur.sections = cur.chapters.map((ch, i) => {
//     const sec = document.createElement('section');
//     sec.className = 'chapter';
//     sec.id = 'ch' + i;
//     sec.dataset.ch = i;
//     sec.setAttribute('aria-label', ch.title);
//     const h = document.createElement('h2');
//     h.className = 'ch-title';
//     h.textContent = ch.title;
//     sec.appendChild(h);
//     if (ch.sub) {
//       const s = document.createElement('p');
//       s.className = 'ch-sub';
//       s.textContent = prettyLabel(ch.sub);
//       sec.appendChild(s);
//     } else {
//       const g = document.createElement('div');
//       g.className = 'ch-gap';
//       sec.appendChild(g);
//     }
//     let lead = true;
//     for (const b of buildBlocks(ch.paras)) {
//       if (b.kind === 'p') {
//         const p = document.createElement('p');
//         p.textContent = b.text;
//         p.dataset.si = b.si;
//         if (lead && b.text.length > 60) {
//           p.className = 'lead';
//           lead = false;
//         }
//         sec.appendChild(p);
//       } else {
//         const d = renderDoc(b);
//         sec.appendChild(d);
//         if (d.classList.contains('will-ink')) inkObs.observe(d);
//         lead = false;
//       }
//     }
//     const o = document.createElement('div');
//     o.className = 'ornament';
//     o.setAttribute('aria-hidden', 'true');
//     o.textContent = th.orn;
//     sec.appendChild(o);
//     pages.appendChild(sec);
//     return sec;
//   });
//   cur.hls.forEach(paintHighlight);
//   paintBadges();
// }

// export const paraEl = (ch, si) => document.querySelector(`#ch${ch} [data-si="${si}"]`);

// Turns chapters into the page:
// paragraphs, drop caps, handwritten letters,
// diaries, telegrams, newspapers and manga pages.

// Turns chapters into reader pages.
// Normal books use extracted text.
// Manga uses the original PDF and renders each page directly.

import {
  themeOf
} from '../app/books.js';

import {
  CONTENT_TYPES
} from '../services/books.js';

import {
  sb
} from '../services/client.js';

import {
  loadPdfJs
} from '../engine/parser/pdf.js';

import {
  THEMES
} from '../config/themes.js';

import {
  buildBlocks,
  reDiaryDate
} from '../engine/parser/structure.js';

import {
  $,
  prefs,
  reduceMotion,
  titleCase,
  upperRatio
} from '../lib/utils.js';

import {
  paintHighlight
} from './highlight-paint.js';

import {
  paintBadges
} from './passage-comments.js';

import {
  cur
} from './reader.js';


export const prettyLabel = s =>
  upperRatio(s) > 0.6
    ? titleCase(s)
    : s;


/* =========================================================
   NORMAL DOCUMENT RENDERING
   ========================================================= */

export function renderDoc(b) {
  const d =
    document.createElement('div');

  d.className =
    'doc ' + b.type;

  const ink =
    document.createElement('div');

  ink.className = 'ink';

  if (b.type === 'telegram') {
    const hd =
      document.createElement('div');

    hd.className = 'tg-head';

    const a =
      document.createElement('span');

    a.textContent = 'Telegram';

    const who =
      document.createElement('span');

    who.textContent =
      prettyLabel(
        b.label
          .replace(
            /^telegram[,.:\\s]*/i,
            ''
          )
          .replace(
            /\.$/,
            ''
          )
      );

    hd.append(
      a,
      who
    );

    d.appendChild(hd);

  } else if (b.type === 'news') {
    const mast =
      document.createElement('div');

    mast.className = 'mast';

    mast.textContent =
      prettyLabel(
        b.label
          .replace(
            /^cutting from\s*/i,
            ''
          )
          .replace(
            /\.$/,
            ''
          )
      );

    d.appendChild(mast);

  } else if (b.label) {
    const l =
      document.createElement('p');

    l.className = 'label';

    l.textContent =
      prettyLabel(b.label);

    d.appendChild(l);
  }

  for (const p of b.paras) {
    const el =
      document.createElement('p');

    el.dataset.si = p.si;

    if (
      b.type === 'diary' &&
      reDiaryDate.test(p.t)
    ) {
      const cut =
        p.t.indexOf('—');

      if (
        cut > 0 &&
        cut < 70
      ) {
        const dt =
          document.createElement('span');

        dt.className = 'date';

        dt.textContent =
          p.t.slice(
            0,
            cut + 1
          );

        el.append(
          dt,
          document.createTextNode(
            p.t.slice(cut + 1)
          )
        );

      } else {
        el.textContent = p.t;
      }

    } else {
      el.textContent = p.t;
    }

    if (p.cls) {
      el.className = p.cls;
    }

    ink.appendChild(el);
  }

  d.appendChild(ink);

  if (
    prefs.motion &&
    !reduceMotion
  ) {
    d.classList.add('will-ink');
  }

  return d;
}


/* =========================================================
   NORMAL BOOK RENDERER
   ========================================================= */

export let inkObs = null;


function renderNormalBook() {
  const pages =
    $('pages');

  pages.innerHTML = '';

  const th =
    THEMES[
      themeOf(cur.meta)
    ];

  if (inkObs) {
    inkObs.disconnect();
  }

  inkObs =
    new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add(
            'inked'
          );

          inkObs.unobserve(
            entry.target
          );
        });
      },
      {
        rootMargin:
          '0px 0px -12% 0px'
      }
    );

  cur.sections =
    cur.chapters.map(
      (ch, i) => {
        const sec =
          document.createElement(
            'section'
          );

        sec.className =
          'chapter';

        sec.id =
          'ch' + i;

        sec.dataset.ch =
          i;

        sec.setAttribute(
          'aria-label',
          ch.title
        );

        const h =
          document.createElement(
            'h2'
          );

        h.className =
          'ch-title';

        h.textContent =
          ch.title;

        sec.appendChild(h);

        if (ch.sub) {
          const s =
            document.createElement(
              'p'
            );

          s.className =
            'ch-sub';

          s.textContent =
            prettyLabel(ch.sub);

          sec.appendChild(s);

        } else {
          const g =
            document.createElement(
              'div'
            );

          g.className =
            'ch-gap';

          sec.appendChild(g);
        }

        let lead = true;

        for (
          const b of buildBlocks(
            ch.paras
          )
        ) {
          if (
            b.kind === 'p'
          ) {
            const p =
              document.createElement(
                'p'
              );

            p.textContent =
              b.text;

            p.dataset.si =
              b.si;

            if (
              lead &&
              b.text.length > 60
            ) {
              p.className =
                'lead';

              lead = false;
            }

            sec.appendChild(p);

          } else {
            const d =
              renderDoc(b);

            sec.appendChild(d);

            if (
              d.classList.contains(
                'will-ink'
              )
            ) {
              inkObs.observe(d);
            }

            lead = false;
          }
        }

        const o =
          document.createElement(
            'div'
          );

        o.className =
          'ornament';

        o.setAttribute(
          'aria-hidden',
          'true'
        );

        o.textContent =
          th.orn;

        sec.appendChild(o);

        pages.appendChild(sec);

        return sec;
      }
    );

  cur.hls.forEach(
    paintHighlight
  );

  paintBadges();
}


/* =========================================================
   MANGA
   ========================================================= */

function installMangaStyles() {
  if (
    document.getElementById(
      'inkworldsMangaStyles'
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      'style'
    );

  style.id =
    'inkworldsMangaStyles';

  style.textContent = `
    #reader .manga-pages {
      width: 100%;
      max-width: 100%;
      margin: 0;
      padding: 5.5rem 0 40vh;
    }

    #reader .manga-page {
      display: block !important;
      width: min(100%, 70rem);
      min-height: 100px;
      margin: 0 auto 2rem;
      padding: 0 !important;
      background: transparent !important;
      color: transparent !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      overflow: visible !important;
      font-size: 0 !important;
      line-height: 0 !important;
      hyphens: none !important;
      -webkit-hyphens: none !important;

      /*
       * IMPORTANT:
       * Do not use content-visibility here.
       * PDF canvas rendering must remain paintable.
       */
      content-visibility: visible !important;
      contain: none !important;
    }

    #reader .manga-page-frame {
      position: relative;
      display: block;
      width: 100%;
      min-height: 100px;

      margin: 0 auto;

      background: #fff;

      overflow: hidden;

      border: 0;
      border-radius: 0;

      box-shadow:
        0 18px 55px rgba(0, 0, 0, 0.28);
    }

    #reader .manga-page-frame canvas {
      display: block !important;

      width: 100% !important;
      height: auto !important;

      max-width: 100% !important;

      margin: 0 !important;
      padding: 0 !important;

      background: #fff;

      opacity: 1 !important;
      visibility: visible !important;
    }

    #reader .manga-loading {
      position: absolute;
      inset: 0;

      display: grid;
      place-items: center;

      color: rgba(0, 0, 0, 0.45);

      font:
        500 0.85rem
        var(--ui, system-ui, sans-serif);

      pointer-events: none;
    }

    #reader .manga-page-rendered
      .manga-loading {
      display: none;
    }

    #reader .manga-error {
      position: absolute;
      inset: 0;

      display: grid;
      place-items: center;

      padding: 2rem;

      color: #7a2020;

      background:
        rgba(255, 245, 235, 0.96);

      font:
        500 0.9rem/1.5
        var(--ui, system-ui, sans-serif);

      text-align: center;
    }

    @media (max-width: 700px) {
      #reader .manga-pages {
        padding:
          5rem 0 30vh;
      }

      #reader .manga-page {
        width: 100%;
        margin-bottom: 1rem;
      }

      #reader .manga-page-frame {
        box-shadow:
          0 10px 30px
          rgba(0, 0, 0, 0.22);
      }
    }
  `;

  document.head.appendChild(style);
}


async function renderMangaBook() {
  installMangaStyles();

  const pages =
    $('pages');

  /*
   * Give Manga its own container so the normal
   * .chapter parchment styling cannot interfere.
   */
  pages.className =
    'pages manga-pages';

  pages.innerHTML = '';

  let blob;

  try {
    /*
     * The Manga file is stored as the ORIGINAL PDF.
     */
    const result =
      await sb()
        .storage
        .from('book-texts')
        .download(
          cur.meta.textPath
        );

    if (result.error) {
      throw result.error;
    }

    blob = result.data;

    if (!blob) {
      throw new Error(
        'The Manga PDF could not be downloaded.'
      );
    }

  } catch (e) {
    console.error(
      '[Inkworlds Manga] PDF download failed:',
      e
    );

    pages.innerHTML = `
      <div style="
        max-width:44rem;
        margin:8rem auto;
        padding:2rem;
        color:#7a2020;
        background:rgba(255,245,235,.96);
        border-radius:8px;
        font:500 1rem/1.6 system-ui,sans-serif;
      ">
        <strong>Could not load the Manga PDF.</strong>
        <br><br>
        ${String(
          e?.message ||
          e ||
          'Unknown error'
        )}
      </div>
    `;

    return;
  }

  let pdf;

  try {
    await loadPdfJs();

    const bytes =
      new Uint8Array(
        await blob.arrayBuffer()
      );

    pdf =
      await window.pdfjsLib
        .getDocument({
          data: bytes,
          isEvalSupported: false
        })
        .promise;

  } catch (e) {
    console.error(
      '[Inkworlds Manga] PDF opening failed:',
      e
    );

    pages.innerHTML = `
      <div style="
        max-width:44rem;
        margin:8rem auto;
        padding:2rem;
        color:#7a2020;
        background:rgba(255,245,235,.96);
        border-radius:8px;
        font:500 1rem/1.6 system-ui,sans-serif;
      ">
        <strong>Could not open the Manga PDF.</strong>
        <br><br>
        ${String(
          e?.message ||
          e ||
          'Unknown error'
        )}
      </div>
    `;

    return;
  }


  /*
   * Store sections for the reader's navigation system.
   */
  cur.sections = [];


  /*
   * Render a single original PDF page.
   */
  async function renderPage(
    pageNumber,
    sec,
    frame,
    canvas,
    loading
  ) {
    if (
      frame.dataset.rendered ===
      'true'
    ) {
      return;
    }

    if (
      frame.dataset.rendering ===
      'true'
    ) {
      return;
    }

    frame.dataset.rendering =
      'true';

    try {
      const page =
        await pdf.getPage(
          pageNumber
        );

      const base =
        page.getViewport({
          scale: 1
        });

      /*
       * Use the actual available width.
       *
       * IMPORTANT:
       * We don't rely on an aspect-ratio
       * placeholder for the canvas itself.
       */
      const availableWidth =
        Math.max(
          320,
          Math.min(
            1400,
            pages.clientWidth ||
              window.innerWidth ||
              1000
          )
        );

      const scale =
        availableWidth /
        base.width;

      const viewport =
        page.getViewport({
          scale
        });

      const dpr =
        Math.min(
          window.devicePixelRatio ||
            1,
          2
        );

      /*
       * Set the REAL canvas dimensions.
       */
      canvas.width =
        Math.ceil(
          viewport.width *
          dpr
        );

      canvas.height =
        Math.ceil(
          viewport.height *
          dpr
        );

      /*
       * Explicit CSS dimensions.
       */
      canvas.style.width =
        `${viewport.width}px`;

      canvas.style.height =
        `${viewport.height}px`;

      frame.style.width =
        `${viewport.width}px`;

      frame.style.height =
        `${viewport.height}px`;

      frame.style.maxWidth =
        '100%';

      canvas.style.maxWidth =
        '100%';

      const ctx =
        canvas.getContext(
          '2d',
          {
            alpha: false
          }
        );

      if (!ctx) {
        throw new Error(
          'Could not create the PDF canvas.'
        );
      }

      /*
       * White page background.
       */
      ctx.save();
      ctx.fillStyle =
        '#ffffff';

      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.restore();

      await page
        .render({
          canvasContext: ctx,
          viewport,
          transform:
            dpr !== 1
              ? [
                  dpr,
                  0,
                  0,
                  dpr,
                  0,
                  0
                ]
              : null
        })
        .promise;

      frame.dataset.rendered =
        'true';

      frame.classList.add(
        'manga-page-rendered'
      );

      loading.hidden = true;

      page.cleanup();

      console.log(
        `[Inkworlds Manga] Rendered page ${pageNumber}`
      );

    } catch (e) {
      console.error(
        `[Inkworlds Manga] Page ${pageNumber} failed:`,
        e
      );

      loading.hidden = true;

      const error =
        document.createElement(
          'div'
        );

      error.className =
        'manga-error';

      error.textContent =
        `Could not render page ${pageNumber}: ${
          e?.message || e
        }`;

      frame.appendChild(error);

    } finally {
      frame.dataset.rendering =
        'false';
    }
  }


  /*
   * Create page shells.
   *
   * We intentionally do NOT extract text.
   */
  for (
    let i = 1;
    i <= pdf.numPages;
    i++
  ) {
    const sec =
      document.createElement(
        'section'
      );

    sec.className =
      'manga-page';

    sec.id =
      'ch' + (i - 1);

    sec.dataset.ch =
      i - 1;

    sec.setAttribute(
      'aria-label',
      `Page ${i}`
    );


    const frame =
      document.createElement(
        'div'
      );

    frame.className =
      'manga-page-frame';


    const canvas =
      document.createElement(
        'canvas'
      );

    canvas.setAttribute(
      'aria-label',
      `Manga page ${i}`
    );


    const loading =
      document.createElement(
        'div'
      );

    loading.className =
      'manga-loading';

    loading.textContent =
      'Loading page…';


    frame.append(
      canvas,
      loading
    );

    sec.appendChild(
      frame
    );

    pages.appendChild(
      sec
    );

    /*
     * Save for navigation/progress.
     */
    cur.sections.push(
      sec
    );


    /*
     * Store renderer on section.
     */
    sec._renderMangaPage =
      () =>
        renderPage(
          i,
          sec,
          frame,
          canvas,
          loading
        );
  }


  /*
   * Render page 1 immediately.
   *
   * This is deliberately NOT lazy.
   * If the first page works, we know the
   * entire PDF pipeline is alive.
   */
  if (
    cur.sections.length
  ) {
    await cur.sections[0]
      ._renderMangaPage();
  }


  /*
   * Render nearby pages lazily.
   */
  const observer =
    new IntersectionObserver(
      entries => {
        entries.forEach(
          entry => {
            if (
              !entry.isIntersecting
            ) {
              return;
            }

            const sec =
              entry.target;

            sec
              ._renderMangaPage?.();

            observer.unobserve(
              sec
            );
          }
        );
      },
      {
        rootMargin:
          '1800px 0px'
      }
    );


  /*
   * Observe pages 2 onward.
   */
  cur.sections
    .slice(1)
    .forEach(
      sec =>
        observer.observe(sec)
    );


  /*
   * If the user resizes the browser,
   * rerendering is not necessary because
   * the canvas is already constrained to
   * the available width.
   */

  return pdf;
}


/* =========================================================
   PUBLIC ENTRY POINT
   ========================================================= */

export async function renderReaderBook() {
  const pages =
    $('pages');

  pages.innerHTML = '';

  /*
   * Reset any class left by a previous Manga book.
   */
  pages.className =
    'pages';

  if (
    cur.meta.contentType ===
    CONTENT_TYPES.MANGA
  ) {
    await renderMangaBook();
    return;
  }

  renderNormalBook();
}


/* =========================================================
   PARAGRAPH LOOKUP
   ========================================================= */

export const paraEl =
  (ch, si) =>
    document.querySelector(
      `#ch${ch} [data-si="${si}"]`
    );
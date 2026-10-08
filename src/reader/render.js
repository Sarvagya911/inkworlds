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

export const prettyLabel =
  s =>
    upperRatio(s) > 0.6
      ? titleCase(s)
      : s;

export function renderDoc(b) {
  const d =
    document.createElement(
      'div'
    );

  d.className =
    'doc ' + b.type;

  const ink =
    document.createElement(
      'div'
    );

  ink.className =
    'ink';

  if (
    b.type ===
    'telegram'
  ) {
    const hd =
      document.createElement(
        'div'
      );

    hd.className =
      'tg-head';

    const a =
      document.createElement(
        'span'
      );

    a.textContent =
      'Telegram';

    const who =
      document.createElement(
        'span'
      );

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

  } else if (
    b.type ===
    'news'
  ) {
    const mast =
      document.createElement(
        'div'
      );

    mast.className =
      'mast';

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
      document.createElement(
        'p'
      );

    l.className =
      'label';

    l.textContent =
      prettyLabel(
        b.label
      );

    d.appendChild(l);
  }

  for (const p of b.paras) {
    const el =
      document.createElement(
        'p'
      );

    el.dataset.si =
      p.si;

    if (
      b.type ===
        'diary' &&
      reDiaryDate.test(p.t)
    ) {
      const cut =
        p.t.indexOf('—');

      if (
        cut > 0 &&
        cut < 70
      ) {
        const dt =
          document.createElement(
            'span'
          );

        dt.className =
          'date';

        dt.textContent =
          p.t.slice(
            0,
            cut + 1
          );

        el.append(
          dt,
          document.createTextNode(
            p.t.slice(
              cut + 1
            )
          )
        );

      } else {
        el.textContent =
          p.t;
      }

    } else {
      el.textContent =
        p.t;
    }

    if (p.cls) {
      el.className =
        p.cls;
    }

    ink.appendChild(el);
  }

  d.appendChild(ink);

  if (
    prefs.motion &&
    !reduceMotion
  ) {
    d.classList.add(
      'will-ink'
    );
  }

  return d;
}

export let inkObs = null;

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
    #reader .manga-page {
      max-width: 58rem;
      margin: 0 auto 2rem;
      padding: 0;
      background: transparent !important;
      color: transparent;
      border: 0 !important;
      border-radius: 0;
      box-shadow: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      overflow: visible;
      font-size: 0;
      line-height: 0;
      hyphens: none;
      contain: content;
    }

    #reader .manga-page-frame {
      width: 100%;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      background: #fff;
      overflow: hidden;
      box-shadow:
        0 18px 55px rgba(0, 0, 0, .28);
    }

    #reader .manga-page-frame canvas {
      display: block;
      width: 100%;
      height: auto;
      max-width: 100%;
    }

    #reader .manga-page-loading {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: rgba(0,0,0,.45);
      font: 500 .8rem var(--ui, system-ui);
      pointer-events: none;
    }

    #reader .manga-page-rendered
      .manga-page-loading {
      display: none;
    }

    @media (max-width: 700px) {
      #reader .manga-page {
        margin-bottom: 1rem;
      }

      #reader .manga-page-frame {
        box-shadow:
          0 10px 30px rgba(0, 0, 0, .22);
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

async function renderMangaBook() {
  installMangaStyles();

  const pages =
    $('pages');

  pages.innerHTML =
    '';

  await loadPdfJs();

  const blob =
    await sb()
      .storage
      .from('book-texts')
      .download(
        cur.meta.textPath
      );

  const bytes =
    new Uint8Array(
      await blob.arrayBuffer()
    );

  const pdf =
    await window.pdfjsLib
      .getDocument({
        data: bytes,
        isEvalSupported:
          false
      })
      .promise;

  /*
   * A Manga book uses one reader section per
   * original PDF page.
   */
  cur.sections = [];

  /*
   * Keep a small render queue so opening a large
   * manga does not immediately render hundreds
   * of full-resolution pages.
   */
  const renderPage =
    async (
      pageNumber,
      frame,
      canvas
    ) => {
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
         * Render at roughly 1400 CSS pixels wide,
         * with HiDPI support, while preserving the
         * PDF's exact aspect ratio.
         */
        const available =
          Math.min(
            1400,
            Math.max(
              320,
              pages.clientWidth ||
                1000
            )
          );

        const scale =
          available /
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

        const ctx =
          canvas.getContext(
            '2d'
          );

        await page
          .render({
            canvasContext:
              ctx,
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

        page.cleanup();

      } finally {
        frame.dataset.rendering =
          'false';
      }
    };

  /*
   * Create all page shells first.
   * We fetch only each page's dimensions here;
   * no text extraction happens.
   */
  for (
    let i = 1;
    i <= pdf.numPages;
    i++
  ) {
    const page =
      await pdf.getPage(i);

    const viewport =
      page.getViewport({
        scale: 1
      });

    page.cleanup();

    const sec =
      document.createElement(
        'section'
      );

    sec.className =
      'chapter manga-page';

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

    frame.style.aspectRatio =
      `${viewport.width} / ${viewport.height}`;

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
      'manga-page-loading';

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

    cur.sections.push(
      sec
    );

    /*
     * Store page rendering information without
     * changing the original PDF.
     */
    sec._mangaRender =
      () =>
        renderPage(
          i,
          frame,
          canvas
        );
  }

  /*
   * Lazy render pages near the viewport.
   */
  const obs =
    new IntersectionObserver(
      entries => {
        for (
          const entry of entries
        ) {
          if (
            !entry.isIntersecting
          ) {
            continue;
          }

          const sec =
            entry.target;

          sec._mangaRender?.();

          obs.unobserve(sec);
        }
      },
      {
        rootMargin:
          '1200px 0px'
      }
    );

  cur.sections.forEach(
    sec => obs.observe(sec)
  );

  /*
   * Render the first couple of pages immediately.
   */
  for (
    let i = 0;
    i < Math.min(2, cur.sections.length);
    i++
  ) {
    cur.sections[i]
      ._mangaRender?.();
  }

  /*
   * Manga doesn't have text highlights or
   * passage comments yet, so don't paint those
   * systems onto the page images.
   */

  return pdf;
}

export async function renderReaderBook() {
  const pages =
    $('pages');

  pages.innerHTML =
    '';

  if (
    cur.meta.contentType ===
    CONTENT_TYPES.MANGA
  ) {
    await renderMangaBook();
    return;
  }

  const th =
    THEMES[
      themeOf(cur.meta)
    ];

  if (inkObs) {
    inkObs.disconnect();
  }

  inkObs =
    new IntersectionObserver(
      es =>
        es.forEach(
          e => {
            if (
              e.isIntersecting
            ) {
              e.target.classList.add(
                'inked'
              );

              inkObs.unobserve(
                e.target
              );
            }
          }
        ),
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
            prettyLabel(
              ch.sub
            );

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
            b.kind ===
            'p'
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
              b.text.length >
                60
            ) {
              p.className =
                'lead';

              lead = false;
            }

            sec.appendChild(
              p
            );

          } else {
            const d =
              renderDoc(b);

            sec.appendChild(
              d
            );

            if (
              d.classList.contains(
                'will-ink'
              )
            ) {
              inkObs.observe(
                d
              );
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

        sec.appendChild(
          o
        );

        pages.appendChild(
          sec
        );

        return sec;
      }
    );

  cur.hls.forEach(
    paintHighlight
  );

  paintBadges();
}

export const paraEl =
  (ch, si) =>
    document.querySelector(
      `#ch${ch} [data-si="${si}"]`
    );
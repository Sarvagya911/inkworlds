// // Loading, saving and adding books (samples, your own books, public books).
// import { busy, enc, errMsg, fail, signedIn } from './helpers.js';
// import { rememberDestination } from '../auth/session.js';
// import { THEMES } from '../config/themes.js';
// import { SAMPLES, sampleCache, sampleData } from '../content/samples.js';
// import { detectTheme } from '../engine/parser/detect.js';
// import { extractPdf, loadPdfJs, pagesToParas } from '../engine/parser/pdf.js';
// import { chaptersFromParas } from '../engine/parser/structure.js';
// import { textToParas } from '../engine/parser/text.js';
// import { lsSet, toast, words } from '../lib/utils.js';
// import * as cloud from '../services/index.js';
// import { supabase } from '../services/supabase.js';

// export function themeOf(book) {
//   return book.theme && book.theme !== 'auto' && THEMES[book.theme]
//     ? book.theme
//     : THEMES[book.auto]
//       ? book.auto
//       : 'parchment';
// }

// export function sampleMeta(s) {
//   const m = sampleData(s).meta;
//   m.visibility = 'public';
//   m.ownerId = null;
//   return m;
// }

// export async function getBook(id) {
//   const s = SAMPLES.find(x => x.id === id);
//   if (s) {
//     const d = sampleData(s);
//     const meta = sampleMeta(s);
//     if (supabase) {
//       try {
//         const m = await cloud.bookMeta(id);
//         if (m) {
//           meta.likeCount = m.likeCount;
//           meta.commentCount = m.commentCount;
//         }
//       } catch (e) {}
//     }
//     return { meta, chapters: d.chapters };
//   }
//   if (!supabase) return null;
//   const meta = await cloud.bookMeta(id).catch(() => null);
//   if (!meta) return null;
//   const chapters = await cloud.bookText(meta);
//   return { meta, chapters };
// }

// export async function saveMeta(meta) {
//   if (meta.sample) {
//     lsSet('iw:sampletheme:' + meta.id, meta.theme === 'auto' ? null : meta.theme);
//     const d = sampleCache.get(meta.id);
//     if (d) d.meta.theme = meta.theme;
//     return;
//   }
//   if (meta.remote) {
//     lsSet('iw:remotetheme:' + meta.id, meta.theme === 'auto' ? null : meta.theme);
//     return;
//   }
//   try {
//     await cloud.updateBook(meta.id, { theme: meta.theme, ai_reason: meta.aiReason || '' });
//   } catch (e) {
//     fail(e);
//   }
// }

// export function titleFromFile(name) {
//   return name
//     .replace(/\.[^.]+$/, '')
//     .replace(/[_-]+/g, ' ')
//     .replace(/\s+/g, ' ')
//     .trim()
//     .replace(/^./, c => c.toUpperCase());
// }

// export async function addFile(file) {
//   if (!file) return;
//   if (!signedIn()) {
//     rememberDestination('#/library');
//     toast('Sign in to add books to your library.');
//     location.hash = '#/signin';
//     return;
//   }
//   const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf',
//     isTxt = /\.txt$/i.test(file.name) || file.type === 'text/plain';
//   if (!isPdf && !isTxt) {
//     toast('Inkworlds reads PDF and plain text files. Try a .pdf or .txt book.');
//     return;
//   }
//   busy(true, `Opening “${file.name}”…`, 0);
//   try {
//     const buf = await file.arrayBuffer();
//     let paras,
//       title = '',
//       author = '';
//     if (isPdf) {
//       try {
//         await loadPdfJs();
//       } catch (e) {
//         throw new Error("The PDF reader couldn't load. Check your internet connection and try again.");
//       }
//       let r;
//       try {
//         r = await extractPdf(new Uint8Array(buf), (f, i, n) => busy(true, `Reading page ${i} of ${n}`, f));
//       } catch (e) {
//         if (e && e.name === 'PasswordException')
//           throw new Error('This PDF is password-protected. Remove the password and add it again.');
//         throw new Error("This file couldn't be read as a PDF. It may be damaged.");
//       }
//       paras = pagesToParas(r.pages);
//       const mt = (r.title || '').trim();
//       title = mt.length > 2 && !/^untitled|\.pdf$|^microsoft|^document/i.test(mt) ? mt : '';
//       author = (r.author || '').trim();
//     } else {
//       const text = new TextDecoder().decode(buf);
//       paras = textToParas(text);
//       const head = text.slice(0, 6000),
//         mt = head.match(/^Title:\s*(.+)$/m),
//         ma = head.match(/^Author:\s*(.+)$/m);
//       if (mt) title = mt[1].trim();
//       if (ma) author = ma[1].trim();
//     }
//     const chapters = chaptersFromParas(paras),
//       total = words(chapters.flatMap(c => c.paras).join(' '));
//     if (total < 60)
//       throw new Error(
//         "This PDF has no selectable text, so it's probably a scanned book. Try a PDF with a text layer, or a .txt version."
//       );
//     busy(true, 'Saving to your library…', 1);
//     const det = detectTheme(chapters);
//     const meta = await cloud.createBook(
//       { title: title || titleFromFile(file.name), author, auto: det.theme, hits: det.hits, words: total },
//       chapters
//     );
//     busy(false);
//     location.hash = '#/book/' + enc(meta.id);
//   } catch (e) {
//     busy(false);
//     toast(e.message ? errMsg(e) : 'Something went wrong while reading this book.', 6500);
//   }
// }

// Loading, saving and adding books
// (samples, your own books, public books).

import {
  busy,
  enc,
  errMsg,
  fail,
  signedIn
} from './helpers.js';

import {
  rememberDestination
} from '../auth/session.js';

import {
  THEMES
} from '../config/themes.js';

import {
  SAMPLES,
  sampleCache,
  sampleData
} from '../content/samples.js';

import {
  detectTheme
} from '../engine/parser/detect.js';

import {
  extractPdf,
  loadPdfJs,
  pagesToParas
} from '../engine/parser/pdf.js';

import {
  chaptersFromParas
} from '../engine/parser/structure.js';

import {
  textToParas
} from '../engine/parser/text.js';

import {
  lsSet,
  toast,
  words
} from '../lib/utils.js';

import * as cloud
  from '../services/index.js';

import {
  supabase
} from '../services/supabase.js';

import {
  CONTENT_TYPES
} from '../services/books.js';

import {
  getUploadContentType
} from './upload.js';


export function themeOf(book) {
  return book.theme &&
    book.theme !== 'auto' &&
    THEMES[book.theme]
    ? book.theme
    : THEMES[book.auto]
      ? book.auto
      : 'parchment';
}


export function sampleMeta(s) {
  const m =
    sampleData(s).meta;

  m.visibility = 'public';
  m.ownerId = null;

  return m;
}


export async function getBook(id) {
  const s =
    SAMPLES.find(
      x => x.id === id
    );

  if (s) {
    const d =
      sampleData(s);

    const meta =
      sampleMeta(s);

    if (supabase) {
      try {
        const m =
          await cloud.bookMeta(id);

        if (m) {
          meta.likeCount =
            m.likeCount;

          meta.commentCount =
            m.commentCount;
        }
      } catch (e) {}
    }

    return {
      meta,
      chapters:
        d.chapters
    };
  }

  if (!supabase) {
    return null;
  }

  const meta =
    await cloud
      .bookMeta(id)
      .catch(() => null);

  if (!meta) {
    return null;
  }

  const chapters =
    await cloud.bookText(meta);

  return {
    meta,
    chapters
  };
}


export async function saveMeta(meta) {
  if (meta.sample) {
    lsSet(
      'iw:sampletheme:' +
        meta.id,
      meta.theme === 'auto'
        ? null
        : meta.theme
    );

    const d =
      sampleCache.get(
        meta.id
      );

    if (d) {
      d.meta.theme =
        meta.theme;
    }

    return;
  }

  if (meta.remote) {
    lsSet(
      'iw:remotetheme:' +
        meta.id,
      meta.theme === 'auto'
        ? null
        : meta.theme
    );

    return;
  }

  try {
    await cloud.updateBook(
      meta.id,
      {
        theme:
          meta.theme,
        ai_reason:
          meta.aiReason || ''
      }
    );
  } catch (e) {
    fail(e);
  }
}


export function titleFromFile(name) {
  return name
    .replace(
      /\.[^.]+$/,
      ''
    )
    .replace(
      /[_-]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim()
    .replace(
      /^./,
      c => c.toUpperCase()
    );
}


/*
 * Render the first PDF page into a small JPEG.
 *
 * This is used only for Manga because Manga bypasses
 * the normal text/cover extraction pipeline.
 */
async function mangaCover(pdf) {
  const page =
    await pdf.getPage(1);

  const base =
    page.getViewport({
      scale: 1
    });

  const maxDimension =
    1800;

  const scale =
    Math.min(
      maxDimension /
        base.width,
      maxDimension /
        base.height
    );

  const viewport =
    page.getViewport({
      scale
    });

  const canvas =
    document.createElement(
      'canvas'
    );

  const dpr =
    Math.min(
      window.devicePixelRatio ||
        1,
      2
    );

  canvas.width =
    Math.ceil(
      viewport.width * dpr
    );

  canvas.height =
    Math.ceil(
      viewport.height * dpr
    );

  const ctx =
    canvas.getContext(
      '2d'
    );

  if (!ctx) {
    throw new Error(
      'Could not create a canvas for the Manga cover.'
    );
  }

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

  page.cleanup();

  return new Promise(
    (resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (!blob) {
            reject(
              new Error(
                'Could not create the Manga cover image.'
              )
            );
            return;
          }

          resolve(blob);
        },
        'image/jpeg',
        0.92
      );
    }
  );
}


export async function addFile(file) {
  if (!file) {
    return;
  }

  if (!signedIn()) {
    rememberDestination(
      '#/library'
    );

    toast(
      'Sign in to add books to your library.'
    );

    location.hash =
      '#/signin';

    return;
  }

  const isPdf =
    /\.pdf$/i.test(
      file.name
    ) ||
    file.type ===
      'application/pdf';

  const isTxt =
    /\.txt$/i.test(
      file.name
    ) ||
    file.type ===
      'text/plain';

  const contentType =
    getUploadContentType();


  /*
   * Manga is intentionally PDF-only.
   *
   * A text file cannot preserve Manga artwork/pages.
   */
  if (
    contentType ===
      CONTENT_TYPES.MANGA &&
    !isPdf
  ) {
    toast(
      'Manga must be uploaded as a PDF so the original pages can be preserved.'
    );

    return;
  }


  if (!isPdf && !isTxt) {
    toast(
      'Inkworlds reads PDF and plain text files. Try a .pdf or .txt book.'
    );

    return;
  }


  busy(
    true,
    `Opening “${file.name}”…`,
    0
  );


  try {
    /*
     * Keep the original uploaded File object.
     *
     * IMPORTANT:
     * PDF.js can detach/transfer the ArrayBuffer passed
     * to getDocument(). Therefore the original File must
     * be used when saving Manga instead of reconstructing
     * a Blob from the PDF.js buffer.
     */
    const buf =
      await file.arrayBuffer();

    let paras;

    let title = '';

    let author = '';

    let cover = null;

    let chapters = [];


    /*
     * =====================================================
     * MANGA
     * =====================================================
     *
     * Do NOT call extractPdf().
     *
     * We only open the PDF enough to:
     *
     * - read metadata
     * - know the page count
     * - make a cover preview
     *
     * The original uploaded PDF File is stored unchanged.
     */
    if (
      contentType ===
      CONTENT_TYPES.MANGA
    ) {
      try {
        await loadPdfJs();
      } catch (e) {
        throw new Error(
          "The PDF reader couldn't load. Check your internet connection and try again."
        );
      }


      let pdf;


      try {
        pdf =
          await window.pdfjsLib
            .getDocument({
              data:
                new Uint8Array(
                  buf
                ),
              isEvalSupported:
                false
            })
            .promise;

      } catch (e) {
        if (
          e &&
          e.name ===
            'PasswordException'
        ) {
          throw new Error(
            'This PDF is password-protected. Remove the password and add it again.'
          );
        }

        throw new Error(
          "This file couldn't be read as a PDF. It may be damaged."
        );
      }


      let info = {};


      try {
        info =
          (
            await pdf.getMetadata()
          ).info || {};
      } catch (e) {}


      const mt =
        (
          info.Title || ''
        ).trim();


      title =
        mt.length > 2 &&
        !/^untitled|\.pdf$|^microsoft|^document/i.test(
          mt
        )
          ? mt
          : '';


      author =
        (
          info.Author || ''
        ).trim();


      const pageCount =
        pdf.numPages;


      /*
       * Create lightweight page records.
       *
       * There is deliberately:
       *
       * - no extractPdf()
       * - no getTextContent()
       * - no OCR
       * - no paragraph conversion
       */
      chapters =
        Array.from(
          {
            length:
              pageCount
          },
          (_, i) => ({
            title:
              `Page ${i + 1}`,
            paras: []
          })
        );


      busy(
        true,
        `Preparing ${pageCount} manga pages…`,
        0.5
      );


      cover =
        await mangaCover(
          pdf
        );


      /*
       * We no longer need this PDF.js document.
       *
       * IMPORTANT:
       * We do NOT use its ArrayBuffer to save the file.
       */
      await pdf.destroy();


      /*
       * IMPORTANT FIX:
       *
       * Use the ORIGINAL uploaded File directly.
       *
       * Do NOT do:
       *
       * new Blob([buf], ...)
       *
       * because PDF.js may have detached the ArrayBuffer.
       */
      const sourceBlob =
        file;


      if (!sourceBlob.size) {
        throw new Error(
          'The original Manga PDF is empty.'
        );
      }


      busy(
        true,
        'Saving the original manga PDF…',
        1
      );


      const meta =
        await cloud.createBook(
          {
            title:
              title ||
              titleFromFile(
                file.name
              ),

            author,

            contentType,

            /*
             * Manga has no extracted text,
             * so don't detect a world from OCR/text.
             */
            auto:
              'parchment',

            hits: [],

            words: 0
          },

          chapters,

          cover,

          sourceBlob
        );


      busy(false);


      location.hash =
        '#/book/' +
        enc(meta.id);


      return;
    }


    /*
     * =====================================================
     * NORMAL NOVEL / LIGHT NOVEL
     * =====================================================
     *
     * Existing text extraction pipeline remains unchanged.
     */
    if (isPdf) {
      try {
        await loadPdfJs();
      } catch (e) {
        throw new Error(
          "The PDF reader couldn't load. Check your internet connection and try again."
        );
      }


      let r;


      try {
        r =
          await extractPdf(
            new Uint8Array(buf),
            (f, i, n) =>
              busy(
                true,
                `Reading page ${i} of ${n}`,
                f
              )
          );

      } catch (e) {
        if (
          e &&
          e.name ===
            'PasswordException'
        ) {
          throw new Error(
            'This PDF is password-protected. Remove the password and add it again.'
          );
        }

        throw new Error(
          "This file couldn't be read as a PDF. It may be damaged."
        );
      }


      paras =
        pagesToParas(
          r.pages
        );


      const mt =
        (
          r.title || ''
        ).trim();


      title =
        mt.length > 2 &&
        !/^untitled|\.pdf$|^microsoft|^document/i.test(
          mt
        )
          ? mt
          : '';


      author =
        (
          r.author || ''
        ).trim();


      cover =
        r.cover || null;

    } else {
      const text =
        new TextDecoder()
          .decode(buf);


      paras =
        textToParas(text);


      const head =
        text.slice(
          0,
          6000
        );


      const mt =
        head.match(
          /^Title:\s*(.+)$/m
        );


      const ma =
        head.match(
          /^Author:\s*(.+)$/m
        );


      if (mt) {
        title =
          mt[1].trim();
      }


      if (ma) {
        author =
          ma[1].trim();
      }
    }


    chapters =
      chaptersFromParas(
        paras
      );


    const total =
      words(
        chapters
          .flatMap(
            c => c.paras
          )
          .join(' ')
      );


    if (total < 60) {
      throw new Error(
        "This PDF has no selectable text, so it's probably a scanned book. Try a PDF with a text layer, or a .txt version."
      );
    }


    busy(
      true,
      'Saving to your library…',
      1
    );


    const det =
      detectTheme(
        chapters
      );


    const meta =
      await cloud.createBook(
        {
          title:
            title ||
            titleFromFile(
              file.name
            ),

          author,

          contentType,

          auto:
            det.theme,

          hits:
            det.hits,

          words:
            total
        },

        chapters,

        cover
      );


    busy(false);


    location.hash =
      '#/book/' +
      enc(meta.id);

  } catch (e) {
    busy(false);

    toast(
      e.message
        ? errMsg(e)
        : 'Something went wrong while reading this book.',
      6500
    );
  }
}
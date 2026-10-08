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

// Loading, saving and adding books (samples, your own books, public books).

import { busy, enc, errMsg, fail, signedIn } from './helpers.js';
import { rememberDestination } from '../auth/session.js';
import { THEMES } from '../config/themes.js';
import { SAMPLES, sampleCache, sampleData } from '../content/samples.js';
import { detectTheme } from '../engine/parser/detect.js';
import { extractPdf, loadPdfJs, pagesToParas } from '../engine/parser/pdf.js';
import { chaptersFromParas } from '../engine/parser/structure.js';
import { textToParas } from '../engine/parser/text.js';
import { lsSet, toast, words } from '../lib/utils.js';
import * as cloud from '../services/index.js';
import { supabase } from '../services/supabase.js';
import { getUploadContentType } from './upload.js';

export function themeOf(book) {
  return book.theme && book.theme !== 'auto' && THEMES[book.theme]
    ? book.theme
    : THEMES[book.auto]
      ? book.auto
      : 'parchment';
}

export function sampleMeta(s) {
  const m = sampleData(s).meta;
  m.visibility = 'public';
  m.ownerId = null;
  return m;
}

export async function getBook(id) {
  const s = SAMPLES.find(x => x.id === id);

  if (s) {
    const d = sampleData(s);
    const meta = sampleMeta(s);

    if (supabase) {
      try {
        const m = await cloud.bookMeta(id);
        if (m) {
          meta.likeCount = m.likeCount;
          meta.commentCount = m.commentCount;
        }
      } catch (e) {}

    }

    return { meta, chapters: d.chapters };
  }

  if (!supabase) return null;

  const meta = await cloud.bookMeta(id).catch(() => null);
  if (!meta) return null;

  const chapters = await cloud.bookText(meta);

  return { meta, chapters };
}

export async function saveMeta(meta) {
  if (meta.sample) {
    lsSet(
      'iw:sampletheme:' + meta.id,
      meta.theme === 'auto' ? null : meta.theme
    );

    const d = sampleCache.get(meta.id);

    if (d) d.meta.theme = meta.theme;

    return;
  }

  if (meta.remote) {
    lsSet(
      'iw:remotetheme:' + meta.id,
      meta.theme === 'auto' ? null : meta.theme
    );

    return;
  }

  try {
    await cloud.updateBook(meta.id, {
      theme: meta.theme,
      ai_reason: meta.aiReason || ''
    });
  } catch (e) {
    fail(e);
  }
}

export function titleFromFile(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[\_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase());
}

export async function addFile(file) {
  if (!file) return;

  if (!signedIn()) {
    rememberDestination('#/library');
    toast('Sign in to add books to your library.');
    location.hash = '#/signin';
    return;
  }

  const isPdf =
    /\.pdf$/i.test(file.name) ||
    file.type === 'application/pdf';

  const isTxt =
    /\.txt$/i.test(file.name) ||
    file.type === 'text/plain';

  if (!isPdf && !isTxt) {
    toast(
      'Inkworlds reads PDF and plain text files. Try a .pdf or .txt book.'
    );
    return;
  }

  const contentType = getUploadContentType();

  busy(true, `Opening “${file.name}”…`, 0);

  try {
    const buf = await file.arrayBuffer();

    let paras;
    let title = '';
    let author = '';
    let cover = null;

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
        r = await extractPdf(
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
          e.name === 'PasswordException'
        ) {
          throw new Error(
            'This PDF is password-protected. Remove the password and add it again.'
          );
        }

        throw new Error(
          "This file couldn't be read as a PDF. It may be damaged."
        );
      }

      paras = pagesToParas(r.pages);

      const mt = (r.title || '').trim();

      title =
        mt.length > 2 &&
        !/^untitled|\.pdf$|^microsoft|^document/i.test(mt)
          ? mt
          : '';

      author = (r.author || '').trim();

      cover = r.cover || null;
    } else {
      const text = new TextDecoder().decode(buf);

      paras = textToParas(text);

      const head = text.slice(0, 6000);

      const mt = head.match(
        /^Title:\s*(.+)$/m
      );

      const ma = head.match(
        /^Author:\s*(.+)$/m
      );

      if (mt) title = mt[1].trim();
      if (ma) author = ma[1].trim();
    }

    const chapters = chaptersFromParas(paras);

    const total = words(
      chapters
        .flatMap(c => c.paras)
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

    const det = detectTheme(chapters);

    const meta = await cloud.createBook(
      {
        title:
          title ||
          titleFromFile(file.name),

        author,

        contentType,

        auto: det.theme,

        hits: det.hits,

        words: total
      },
      chapters,
      cover
    );

    busy(false);

    location.hash =
      '#/book/' + enc(meta.id);

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
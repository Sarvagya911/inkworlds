// // Reads PDFs in the browser with pdf.js and rebuilds paragraphs.
// export const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

// export let pdfReady = null;

// export function loadScript(src) {
//   return new Promise((res, rej) => {
//     const s = document.createElement('script');
//     s.src = src;
//     s.onload = res;
//     s.onerror = () => rej(new Error('load ' + src));
//     document.head.appendChild(s);
//   });
// }

// export function loadPdfJs() {
//   if (!pdfReady) {
//     pdfReady = loadScript(PDFJS + 'pdf.min.js')
//       .then(() => loadScript(PDFJS + 'pdf.worker.min.js'))
//       .then(() => {
//         window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
//       });
//     pdfReady.catch(() => {
//       pdfReady = null;
//     });
//   }
//   return pdfReady;
// }

// export async function extractPdf(bytes, onProgress) {
//   const pdf = await window.pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
//   let info = {};
//   try {
//     info = (await pdf.getMetadata()).info || {};
//   } catch (e) {}
//   const pages = [];
//   for (let i = 1; i <= pdf.numPages; i++) {
//     const page = await pdf.getPage(i),
//       tc = await page.getTextContent();
//     const lines = [];
//     let cur = null;
//     const flush = () => {
//       if (cur && cur.text.trim()) {
//         cur.text = cur.text.replace(/\s+/g, ' ').trim();
//         lines.push(cur);
//       }
//       cur = null;
//     };
//     for (const it of tc.items) {
//       if (typeof it.str !== 'string') continue;
//       const x = it.transform[4],
//         y = it.transform[5],
//         h = Math.abs(it.transform[3]) || it.height || 10;
//       if (cur && Math.abs(y - cur.y) > h * 0.45) flush();
//       if (!cur) cur = { text: '', x, y, maxH: h, endX: x };
//       if (cur.text && it.str && !/\s$/.test(cur.text) && !/^\s/.test(it.str) && x - cur.endX > h * 0.15)
//         cur.text += ' ';
//       cur.text += it.str;
//       cur.endX = Math.max(cur.endX, x + (it.width || 0));
//       cur.maxH = Math.max(cur.maxH, h);
//       if (it.hasEOL) flush();
//     }
//     flush();
//     pages.push(lines);
//     page.cleanup();
//     onProgress(i / pdf.numPages, i, pdf.numPages);
//     if (i % 8 === 0) await new Promise(r => setTimeout(r, 0));
//   }
//   return { pages, title: info.Title, author: info.Author };
// }

// export function modeOf(arr) {
//   const m = new Map();
//   let best = arr[0],
//     bc = 0;
//   for (const v of arr) {
//     const c = (m.get(v) || 0) + 1;
//     m.set(v, c);
//     if (c > bc) {
//       bc = c;
//       best = v;
//     }
//   }
//   return best;
// }

// export function pagesToParas(pages) {
//   const all = pages.flat();
//   if (!all.length) return [];
//   const hs = all.map(l => l.maxH).sort((a, b) => a - b);
//   const bodyH = hs[Math.floor(hs.length / 2)] || 10;
//   const key = s =>
//     s
//       .toLowerCase()
//       .replace(/\d+/g, '#')
//       .replace(/[^a-z#]/g, '');
//   const cnt = new Map();
//   pages.forEach(ls => {
//     new Set([...ls.slice(0, 2), ...ls.slice(-2)].map(l => key(l.text))).forEach(k => {
//       if (k) cnt.set(k, (cnt.get(k) || 0) + 1);
//     });
//   });
//   const thr = Math.max(3, pages.length * 0.2);
//   const paras = [];
//   let cur = null;
//   const push = () => {
//     if (cur && cur.text.trim()) paras.push({ text: cur.text.trim(), big: cur.big });
//     cur = null;
//   };
//   for (const raw of pages) {
//     const ls = raw.filter((l, i) => {
//       const edge = i < 2 || i >= raw.length - 2;
//       if (!edge) return true;
//       if (/^(page\s*)?\d{1,4}$/i.test(l.text)) return false;
//       const k = key(l.text);
//       if (k && cnt.get(k) >= thr && l.text.length < 90) return false;
//       return true;
//     });
//     if (!ls.length) continue;
//     const left = modeOf(ls.map(l => Math.round(l.x))),
//       lw = Math.max(...ls.map(l => l.endX - l.x)) || 400;
//     const gaps = [];
//     for (let i = 1; i < ls.length; i++) {
//       const g = ls[i - 1].y - ls[i].y;
//       if (g > 0) gaps.push(g);
//     }
//     gaps.sort((a, b) => a - b);
//     const mg = gaps[Math.floor(gaps.length / 2)] || bodyH * 1.3;
//     ls.forEach((l, i) => {
//       const big = l.maxH > bodyH * 1.3,
//         width = l.endX - l.x;
//       const centered = l.x > left + bodyH * 2 && width < lw * 0.8;
//       const indented = l.x > left + bodyH * 0.6 && l.x < left + bodyH * 6;
//       let brk = !cur || cur.solo || centered || big !== (cur && cur.big);
//       if (!brk) {
//         if (i === 0) brk = /[.!?”"’':;)\]—]$/.test(cur.text) && (indented || cur.lastShort);
//         else {
//           const g = ls[i - 1].y - l.y;
//           brk = g > mg * 1.45 || indented || (cur.lastShort && /[.!?”"’]$/.test(cur.text));
//         }
//       }
//       if (brk) {
//         push();
//         cur = { text: l.text, big, solo: centered };
//       } else
//         cur.text =
//           /[A-Za-z]-$/.test(cur.text) && /^[a-z]/.test(l.text)
//             ? cur.text.slice(0, -1) + l.text
//             : cur.text + ' ' + l.text;
//       cur.lastShort = width < lw * 0.72;
//     });
//   }
//   push();
//   return paras;
// }


// Reads PDFs in the browser with pdf.js and rebuilds paragraphs.
export const PDFJS =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

export let pdfReady = null;

export function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('load ' + src));
    document.head.appendChild(s);
  });
}

export function loadPdfJs() {
  if (!pdfReady) {
    pdfReady = loadScript(PDFJS + 'pdf.min.js')
      .then(() => loadScript(PDFJS + 'pdf.worker.min.js'))
      .then(() => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          PDFJS + 'pdf.worker.min.js';
      });

    pdfReady.catch(() => {
      pdfReady = null;
    });
  }

  return pdfReady;
}

/* =========================================================
   COVER DETECTION
   ========================================================= */

const NOT_COVER_PATTERNS = [
  /\btable\s+of\s+contents\b/i,
  /^\s*contents\s*$/i,
  /\bcopyright\b/i,
  /\ball\s+rights\s+reserved\b/i,
  /\bisbn[\s:-]/i,
  /\bpublished\s+by\b/i,
  /\bprinted\s+in\b/i,
  /\bfirst\s+edition\b/i,
  /\bsecond\s+edition\b/i,
  /\bthird\s+edition\b/i,
  /\bchapter\s+1\b/i,
  /\bchapter\s+one\b/i,
  /\bchapter\s+i\b/i,
  /\bcontents\b/i
];

const CHAPTER_PATTERN =
  /\bchapter\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|i|ii|iii|iv|v)\b/i;

function cleanText(text = '') {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

function normalized(text = '') {
  return cleanText(text).toLowerCase();
}

function containsAny(text, patterns) {
  return patterns.some(re => re.test(text));
}

function textLinesToString(lines) {
  return cleanText(
    lines
      .map(l => l.text || '')
      .join(' ')
  );
}

function metadataMatch(text, value) {
  if (!value) return false;

  const t = normalized(text);
  const v = normalized(value);

  if (!v || v.length < 3) {
    return false;
  }

  return t.includes(v);
}

/* =========================================================
   TEXT EXTRACTION FOR COVER ANALYSIS
   ========================================================= */

async function getPageLines(page) {
  const tc =
    await page.getTextContent();

  const lines = [];
  let cur = null;

  const flush = () => {
    if (
      cur &&
      cleanText(cur.text)
    ) {
      cur.text =
        cleanText(cur.text);

      lines.push(cur);
    }

    cur = null;
  };

  for (const it of tc.items) {
    if (
      typeof it.str !== 'string'
    ) {
      continue;
    }

    const x =
      it.transform[4];

    const y =
      it.transform[5];

    const h =
      Math.abs(
        it.transform[3]
      ) ||
      it.height ||
      10;

    if (
      cur &&
      Math.abs(y - cur.y) >
        h * 0.45
    ) {
      flush();
    }

    if (!cur) {
      cur = {
        text: '',
        x,
        y,
        maxH: h,
        endX: x
      };
    }

    if (
      cur.text &&
      it.str &&
      !/\s$/.test(cur.text) &&
      !/^\s/.test(it.str) &&
      x - cur.endX >
        h * 0.15
    ) {
      cur.text += ' ';
    }

    cur.text += it.str;

    cur.endX =
      Math.max(
        cur.endX,
        x + (it.width || 0)
      );

    cur.maxH =
      Math.max(
        cur.maxH,
        h
      );

    if (it.hasEOL) {
      flush();
    }
  }

  flush();

  return lines;
}

/* =========================================================
   LOW-RES PAGE RENDER
   ========================================================= */

async function renderPagePreview(
  page,
  maxDimension = 360
) {
  let canvas = null;

  try {
    const base =
      page.getViewport({
        scale: 1
      });

    const largest =
      Math.max(
        base.width,
        base.height
      );

    const scale =
      largest > maxDimension
        ? maxDimension / largest
        : 1;

    const viewport =
      page.getViewport({
        scale
      });

    canvas =
      document.createElement(
        'canvas'
      );

    canvas.width =
      Math.max(
        1,
        Math.round(
          viewport.width
        )
      );

    canvas.height =
      Math.max(
        1,
        Math.round(
          viewport.height
        )
      );

    const ctx =
      canvas.getContext(
        '2d',
        {
          alpha: false,
          willReadFrequently: true
        }
      );

    if (!ctx) {
      return null;
    }

    /*
     * White background is important because transparent
     * PDF artwork should still be measured correctly.
     */
    ctx.fillStyle = '#ffffff';

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    await page.render({
      canvasContext: ctx,
      viewport
    }).promise;

    return {
      canvas,
      ctx,
      width: canvas.width,
      height: canvas.height
    };
  } catch (error) {
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }

    return null;
  }
}

/* =========================================================
   VISUAL PAGE ANALYSIS
   ========================================================= */

function analyzeRenderedPage(preview) {
  if (!preview) {
    return {
      nonWhiteRatio: 0,
      darkRatio: 0,
      colorRatio: 0,
      variance: 0,
      edgeRatio: 0
    };
  }

  const {
    ctx,
    width,
    height
  } = preview;

  let imageData;

  try {
    imageData =
      ctx.getImageData(
        0,
        0,
        width,
        height
      );
  } catch (_) {
    return {
      nonWhiteRatio: 0,
      darkRatio: 0,
      colorRatio: 0,
      variance: 0,
      edgeRatio: 0
    };
  }

  const data =
    imageData.data;

  /*
   * Sample pixels instead of inspecting every pixel.
   * This keeps large PDFs cheap to analyze.
   */
  const step =
    Math.max(
      1,
      Math.floor(
        Math.sqrt(
          (width * height) /
            12000
        )
      )
    );

  let samples = 0;
  let nonWhite = 0;
  let dark = 0;
  let colorful = 0;

  let sum = 0;
  let sumSq = 0;

  /*
   * Store a tiny luminance grid for edge estimation.
   */
  const grid = [];

  for (
    let y = 0;
    y < height;
    y += step
  ) {
    const row = [];

    for (
      let x = 0;
      x < width;
      x += step
    ) {
      const index =
        (y * width + x) * 4;

      const r =
        data[index];

      const g =
        data[index + 1];

      const b =
        data[index + 2];

      const luminance =
        0.2126 * r +
        0.7152 * g +
        0.0722 * b;

      row.push(
        luminance
      );

      samples++;

      if (
        r < 245 ||
        g < 245 ||
        b < 245
      ) {
        nonWhite++;
      }

      if (
        luminance < 100
      ) {
        dark++;
      }

      const max =
        Math.max(r, g, b);

      const min =
        Math.min(r, g, b);

      /*
       * Strong difference between RGB channels
       * means the page contains actual color.
       */
      if (
        max - min > 35
      ) {
        colorful++;
      }

      sum += luminance;
      sumSq +=
        luminance *
        luminance;
    }

    grid.push(row);
  }

  if (!samples) {
    return {
      nonWhiteRatio: 0,
      darkRatio: 0,
      colorRatio: 0,
      variance: 0,
      edgeRatio: 0
    };
  }

  const mean =
    sum / samples;

  const variance =
    Math.max(
      0,
      sumSq / samples -
        mean * mean
    );

  /*
   * Estimate edge/detail density.
   *
   * Text pages have lots of thin edges but cover art
   * generally has much more continuous visual variation.
   */
  let edgeCount = 0;
  let edgeSamples = 0;

  for (
    let y = 0;
    y < grid.length;
    y++
  ) {
    const row =
      grid[y];

    for (
      let x = 0;
      x < row.length;
      x++
    ) {
      if (
        x + 1 <
        row.length
      ) {
        const diff =
          Math.abs(
            row[x] -
              row[x + 1]
          );

        if (diff > 25) {
          edgeCount++;
        }

        edgeSamples++;
      }

      if (
        y + 1 <
        grid.length
      ) {
        const diff =
          Math.abs(
            row[x] -
              grid[y + 1][x]
          );

        if (diff > 25) {
          edgeCount++;
        }

        edgeSamples++;
      }
    }
  }

  return {
    nonWhiteRatio:
      nonWhite / samples,

    darkRatio:
      dark / samples,

    colorRatio:
      colorful / samples,

    variance,

    edgeRatio:
      edgeSamples
        ? edgeCount /
          edgeSamples
        : 0
  };
}

/* =========================================================
   COVER SCORE
   ========================================================= */

function scoreVisualCover(
  visual
) {
  let score = 0;

  /*
   * A real cover usually occupies a large amount
   * of the page visually.
   */
  if (
    visual.nonWhiteRatio >
    0.70
  ) {
    score += 30;
  } else if (
    visual.nonWhiteRatio >
    0.50
  ) {
    score += 20;
  } else if (
    visual.nonWhiteRatio >
    0.30
  ) {
    score += 8;
  } else if (
    visual.nonWhiteRatio <
    0.12
  ) {
    score -= 30;
  }

  /*
   * Color is a very useful signal for illustrated covers.
   */
  if (
    visual.colorRatio >
    0.45
  ) {
    score += 35;
  } else if (
    visual.colorRatio >
    0.25
  ) {
    score += 22;
  } else if (
    visual.colorRatio >
    0.10
  ) {
    score += 8;
  }

  /*
   * Strong luminance variation usually means
   * artwork or a designed page rather than paragraphs.
   */
  if (
    visual.variance >
    5000
  ) {
    score += 20;
  } else if (
    visual.variance >
    2500
  ) {
    score += 12;
  } else if (
    visual.variance <
    500
  ) {
    score -= 10;
  }

  /*
   * Some detail is expected.
   */
  if (
    visual.edgeRatio >
    0.20
  ) {
    score += 12;
  } else if (
    visual.edgeRatio <
    0.05
  ) {
    score -= 8;
  }

  return score;
}

/* =========================================================
   COVER CANDIDATE
   ========================================================= */

async function scoreCoverCandidate(
  page,
  lines,
  pageNumber,
  totalPages,
  title,
  author
) {
  const text =
    textLinesToString(lines);

  const lower =
    normalized(text);

  let score = 0;

  const lineCount =
    lines.filter(
      l => cleanText(l.text)
    ).length;

  const textLength =
    text.length;

  /*
   * Render the actual page.
   *
   * This is now the primary visual signal.
   */
  const preview =
    await renderPagePreview(
      page,
      360
    );

  const visual =
    analyzeRenderedPage(
      preview
    );

  score +=
    scoreVisualCover(
      visual
    );

  /* -----------------------------------------
     Strong negative signals
     ----------------------------------------- */

  if (
    containsAny(
      lower,
      NOT_COVER_PATTERNS
    )
  ) {
    score -= 90;
  }

  if (
    CHAPTER_PATTERN.test(
      lower
    )
  ) {
    score -= 100;
  }

  /*
   * Interior pages generally have lots of text.
   */
  if (
    textLength > 4000
  ) {
    score -= 100;
  } else if (
    textLength > 2500
  ) {
    score -= 70;
  } else if (
    textLength > 1500
  ) {
    score -= 35;
  } else if (
    textLength > 1000
  ) {
    score -= 15;
  }

  if (
    lineCount > 80
  ) {
    score -= 80;
  } else if (
    lineCount > 50
  ) {
    score -= 45;
  } else if (
    lineCount > 30
  ) {
    score -= 20;
  }

  /* -----------------------------------------
     Positive text signals
     ----------------------------------------- */

  if (
    metadataMatch(
      text,
      title
    )
  ) {
    score += 35;
  }

  if (
    metadataMatch(
      text,
      author
    )
  ) {
    score += 20;
  }

  if (
    textLength === 0
  ) {
    score += 5;
  } else if (
    textLength < 300
  ) {
    score += 18;
  } else if (
    textLength < 700
  ) {
    score += 10;
  }

  if (
    lineCount <= 8
  ) {
    score += 12;
  } else if (
    lineCount <= 18
  ) {
    score += 8;
  }

  /* -----------------------------------------
     Page dimensions
     ----------------------------------------- */

  try {
    const viewport =
      page.getViewport({
        scale: 1
      });

    const ratio =
      viewport.width /
      viewport.height;

    /*
     * Portrait pages are much more common for covers.
     */
    if (
      ratio >= 0.50 &&
      ratio <= 0.85
    ) {
      score += 15;
    }

    if (
      ratio > 1.15
    ) {
      score -= 15;
    }
  } catch (_) {}

  /* -----------------------------------------
     Position
     ----------------------------------------- */

  /*
   * Earlier pages are more likely, but this is only
   * a small tie-breaker. It cannot force page 1.
   */
  if (
    pageNumber === 1
  ) {
    score += 5;
  } else if (
    pageNumber === 2
  ) {
    score += 4;
  } else if (
    pageNumber === 3
  ) {
    score += 3;
  } else if (
    pageNumber === 4
  ) {
    score += 2;
  }

  if (
    totalPages <= 5
  ) {
    score += 2;
  }

  /*
   * Debug information.
   *
   * This is VERY useful for your current PDF.
   */
  console.log(
    `[Inkworlds Cover] Page ${pageNumber}:`,
    {
      score,
      textLength,
      lineCount,
      nonWhite:
        Number(
          visual.nonWhiteRatio.toFixed(
            3
          )
        ),
      color:
        Number(
          visual.colorRatio.toFixed(
            3
          )
        ),
      variance:
        Math.round(
          visual.variance
        ),
      edge:
        Number(
          visual.edgeRatio.toFixed(
            3
          )
        )
    }
  );

  if (preview?.canvas) {
    preview.canvas.width = 1;
    preview.canvas.height = 1;
  }

  return {
    score,
    pageNumber,
    textLength,
    lineCount,
    visual
  };
}

/* =========================================================
   HIGH-QUALITY COVER RENDER
   ========================================================= */

async function renderCoverPage(
  pdf,
  pageNumber
) {
  let page = null;
  let canvas = null;

  try {
    page =
      await pdf.getPage(
        pageNumber
      );

    let scale = 1.8;

    const initialViewport =
      page.getViewport({
        scale
      });

    const maxDimension =
      1800;

    const largest =
      Math.max(
        initialViewport.width,
        initialViewport.height
      );

    if (
      largest >
      maxDimension
    ) {
      scale *=
        maxDimension /
        largest;
    }

    const viewport =
      page.getViewport({
        scale
      });

    canvas =
      document.createElement(
        'canvas'
      );

    canvas.width =
      Math.max(
        1,
        Math.ceil(
          viewport.width
        )
      );

    canvas.height =
      Math.max(
        1,
        Math.ceil(
          viewport.height
        )
      );

    const ctx =
      canvas.getContext(
        '2d',
        {
          alpha: false
        }
      );

    if (!ctx) {
      return null;
    }

    ctx.fillStyle =
      '#ffffff';

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    await page.render({
      canvasContext: ctx,
      viewport
    }).promise;

    const blob =
      await new Promise(
        resolve => {
          canvas.toBlob(
            resolve,
            'image/jpeg',
            0.92
          );
        }
      );

    console.log(
      `[Inkworlds Cover] Rendered page ${pageNumber}: ${canvas.width}x${canvas.height}`
    );

    return blob || null;
  } catch (error) {
    console.error(
      `[Inkworlds Cover] Failed rendering page ${pageNumber}:`,
      error
    );

    return null;
  } finally {
    try {
      if (page) {
        page.cleanup();
      }
    } catch (_) {}

    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
}

/* =========================================================
   FIND COVER
   ========================================================= */

export async function extractCover(
  pdf,
  options = {}
) {
  if (
    !pdf ||
    !pdf.numPages
  ) {
    console.log(
      '[Inkworlds Cover] No PDF pages available'
    );

    return null;
  }

  const maxPages =
    Math.min(
      pdf.numPages,
      options.maxPages || 8
    );

  const title =
    options.title || '';

  const author =
    options.author || '';

  const candidates = [];

  console.log(
    `[Inkworlds Cover] Inspecting first ${maxPages} pages of ${pdf.numPages}`
  );

  for (
    let pageNumber = 1;
    pageNumber <= maxPages;
    pageNumber++
  ) {
    let page = null;

    try {
      page =
        await pdf.getPage(
          pageNumber
        );

      const lines =
        await getPageLines(
          page
        );

      const candidate =
        await scoreCoverCandidate(
          page,
          lines,
          pageNumber,
          pdf.numPages,
          title,
          author
        );

      candidates.push(
        candidate
      );
    } catch (error) {
      console.error(
        `[Inkworlds Cover] Failed inspecting page ${pageNumber}:`,
        error
      );
    } finally {
      try {
        if (page) {
          page.cleanup();
        }
      } catch (_) {}
    }

    /*
     * Let the browser breathe between pages.
     */
    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          0
        )
    );
  }

  if (
    !candidates.length
  ) {
    console.log(
      '[Inkworlds Cover] No candidate pages found'
    );

    return null;
  }

  candidates.sort(
    (a, b) =>
      b.score -
      a.score
  );

  const best =
    candidates[0];

  const second =
    candidates[1] || null;

  console.log(
    '[Inkworlds Cover] Candidates:',
    candidates
      .map(
        c =>
          `page ${c.pageNumber}=${c.score}`
      )
      .join(', ')
  );

  console.log(
    `[Inkworlds Cover] Best candidate: page ${best.pageNumber}, score ${best.score}`
  );

  /*
   * Confidence rules.
   *
   * We deliberately DO NOT default to page 1.
   */
  const minimumScore =
    45;

  if (
    best.score <
    minimumScore
  ) {
    console.log(
      `[Inkworlds Cover] No confident cover found. Best score ${best.score} < ${minimumScore}`
    );

    return null;
  }

  /*
   * If two pages are extremely close and neither has
   * strong visual evidence, don't guess.
   */
  if (
    second &&
    Math.abs(
      best.score -
        second.score
    ) < 5 &&
    best.visual.colorRatio <
      0.20 &&
    best.visual.nonWhiteRatio <
      0.50
  ) {
    console.log(
      '[Inkworlds Cover] Candidate scores are too close; refusing to guess'
    );

    return null;
  }

  console.log(
    `[Inkworlds Cover] Selected page: ${best.pageNumber}`
  );

  return renderCoverPage(
    pdf,
    best.pageNumber
  );
}

/* =========================================================
   PDF TEXT EXTRACTION
   ========================================================= */

export async function extractPdf(
  bytes,
  onProgress
) {
  const pdf =
    await window.pdfjsLib.getDocument({
      data: bytes,
      isEvalSupported: false
    }).promise;

  let info = {};

  try {
    info =
      (
        await pdf.getMetadata()
      ).info || {};
  } catch (_) {}

  const pages = [];

  /*
   * Existing normal PDF extraction.
   */
  for (
    let i = 1;
    i <= pdf.numPages;
    i++
  ) {
    const page =
      await pdf.getPage(i);

    const lines =
      await getPageLines(
        page
      );

    pages.push(lines);

    page.cleanup();

    if (onProgress) {
      onProgress(
        i / pdf.numPages,
        i,
        pdf.numPages
      );
    }

    if (i % 8 === 0) {
      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            0
          )
      );
    }
  }

  /*
   * Cover detection is intentionally separate from
   * normal text extraction.
   */
  const cover =
    await extractCover(
      pdf,
      {
        maxPages: 8,
        title:
          info.Title || '',
        author:
          info.Author || ''
      }
    );

  return {
    pages,
    title:
      info.Title,
    author:
      info.Author,
    cover
  };
}

/* =========================================================
   EXISTING PARAGRAPH REBUILDER
   ========================================================= */

export function modeOf(arr) {
  const m =
    new Map();

  let best =
    arr[0];

  let bc = 0;

  for (
    const v of arr
  ) {
    const c =
      (m.get(v) || 0) +
      1;

    m.set(
      v,
      c
    );

    if (c > bc) {
      bc = c;
      best = v;
    }
  }

  return best;
}

export function pagesToParas(
  pages
) {
  const all =
    pages.flat();

  if (!all.length) {
    return [];
  }

  const hs =
    all
      .map(
        l => l.maxH
      )
      .sort(
        (a, b) =>
          a - b
      );

  const bodyH =
    hs[
      Math.floor(
        hs.length / 2
      )
    ] || 10;

  const key =
    s =>
      s
        .toLowerCase()
        .replace(
          /\d+/g,
          '#'
        )
        .replace(
          /[^a-z#]/g,
          ''
        );

  const cnt =
    new Map();

  pages.forEach(
    ls => {
      new Set(
        [
          ...ls.slice(
            0,
            2
          ),
          ...ls.slice(
            -2
          )
        ]
          .map(
            l =>
              key(
                l.text
              )
          )
      ).forEach(
        k => {
          if (k) {
            cnt.set(
              k,
              (cnt.get(k) ||
                0) + 1
            );
          }
        }
      );
    }
  );

  const thr =
    Math.max(
      3,
      pages.length *
        0.2
    );

  const paras = [];

  let cur = null;

  const push = () => {
    if (
      cur &&
      cur.text.trim()
    ) {
      paras.push({
        text:
          cur.text.trim(),
        big:
          cur.big
      });
    }

    cur = null;
  };

  for (
    const raw of pages
  ) {
    const ls =
      raw.filter(
        (l, i) => {
          const edge =
            i < 2 ||
            i >=
              raw.length - 2;

          if (!edge) {
            return true;
          }

          if (
            /^(page\s*)?\d{1,4}$/i.test(
              l.text
            )
          ) {
            return false;
          }

          const k =
            key(
              l.text
            );

          if (
            k &&
            cnt.get(k) >=
              thr &&
            l.text.length <
              90
          ) {
            return false;
          }

          return true;
        }
      );

    if (!ls.length) {
      continue;
    }

    const left =
      modeOf(
        ls.map(l =>
          Math.round(
            l.x
          )
        )
      );

    const lw =
      Math.max(
        ...ls.map(
          l =>
            l.endX -
            l.x
        )
      ) || 400;

    const gaps = [];

    for (
      let i = 1;
      i < ls.length;
      i++
    ) {
      const g =
        ls[i - 1].y -
        ls[i].y;

      if (g > 0) {
        gaps.push(g);
      }
    }

    gaps.sort(
      (a, b) =>
        a - b
    );

    const mg =
      gaps[
        Math.floor(
          gaps.length / 2
        )
      ] ||
      bodyH * 1.3;

    ls.forEach(
      (l, i) => {
        const big =
          l.maxH >
          bodyH * 1.3;

        const width =
          l.endX -
          l.x;

        const centered =
          l.x >
            left +
              bodyH * 2 &&
          width <
            lw * 0.8;

        const indented =
          l.x >
            left +
              bodyH * 0.6 &&
          l.x <
            left +
              bodyH * 6;

        let brk =
          !cur ||
          cur.solo ||
          centered ||
          big !==
            (cur &&
              cur.big);

        if (!brk) {
          if (i === 0) {
            brk =
              /[.!?”"’':;)\]—]$/.test(
                cur.text
              ) &&
              (indented ||
                cur.lastShort);
          } else {
            const g =
              ls[i - 1].y -
              l.y;

            brk =
              g >
                mg * 1.45 ||
              indented ||
              (cur.lastShort &&
                /[.!?”"’]$/.test(
                  cur.text
                ));
          }
        }

        if (brk) {
          push();

          cur = {
            text:
              l.text,
            big,
            solo:
              centered
          };
        } else {
          cur.text =
            /[A-Za-z]-$/.test(
              cur.text
            ) &&
            /^[a-z]/.test(
              l.text
            )
              ? cur.text.slice(
                  0,
                  -1
                ) +
                l.text
              : cur.text +
                ' ' +
                l.text;
        }

        cur.lastShort =
          width <
          lw * 0.72;
      }
    );
  }

  push();

  return paras;
}
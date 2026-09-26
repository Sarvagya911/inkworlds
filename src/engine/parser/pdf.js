// Reads PDFs in the browser with pdf.js and rebuilds paragraphs.
export const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

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
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
      });
    pdfReady.catch(() => {
      pdfReady = null;
    });
  }
  return pdfReady;
}

export async function extractPdf(bytes, onProgress) {
  const pdf = await window.pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
  let info = {};
  try {
    info = (await pdf.getMetadata()).info || {};
  } catch (e) {}
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i),
      tc = await page.getTextContent();
    const lines = [];
    let cur = null;
    const flush = () => {
      if (cur && cur.text.trim()) {
        cur.text = cur.text.replace(/\s+/g, ' ').trim();
        lines.push(cur);
      }
      cur = null;
    };
    for (const it of tc.items) {
      if (typeof it.str !== 'string') continue;
      const x = it.transform[4],
        y = it.transform[5],
        h = Math.abs(it.transform[3]) || it.height || 10;
      if (cur && Math.abs(y - cur.y) > h * 0.45) flush();
      if (!cur) cur = { text: '', x, y, maxH: h, endX: x };
      if (cur.text && it.str && !/\s$/.test(cur.text) && !/^\s/.test(it.str) && x - cur.endX > h * 0.15)
        cur.text += ' ';
      cur.text += it.str;
      cur.endX = Math.max(cur.endX, x + (it.width || 0));
      cur.maxH = Math.max(cur.maxH, h);
      if (it.hasEOL) flush();
    }
    flush();
    pages.push(lines);
    page.cleanup();
    onProgress(i / pdf.numPages, i, pdf.numPages);
    if (i % 8 === 0) await new Promise(r => setTimeout(r, 0));
  }
  return { pages, title: info.Title, author: info.Author };
}

export function modeOf(arr) {
  const m = new Map();
  let best = arr[0],
    bc = 0;
  for (const v of arr) {
    const c = (m.get(v) || 0) + 1;
    m.set(v, c);
    if (c > bc) {
      bc = c;
      best = v;
    }
  }
  return best;
}

export function pagesToParas(pages) {
  const all = pages.flat();
  if (!all.length) return [];
  const hs = all.map(l => l.maxH).sort((a, b) => a - b);
  const bodyH = hs[Math.floor(hs.length / 2)] || 10;
  const key = s =>
    s
      .toLowerCase()
      .replace(/\d+/g, '#')
      .replace(/[^a-z#]/g, '');
  const cnt = new Map();
  pages.forEach(ls => {
    new Set([...ls.slice(0, 2), ...ls.slice(-2)].map(l => key(l.text))).forEach(k => {
      if (k) cnt.set(k, (cnt.get(k) || 0) + 1);
    });
  });
  const thr = Math.max(3, pages.length * 0.2);
  const paras = [];
  let cur = null;
  const push = () => {
    if (cur && cur.text.trim()) paras.push({ text: cur.text.trim(), big: cur.big });
    cur = null;
  };
  for (const raw of pages) {
    const ls = raw.filter((l, i) => {
      const edge = i < 2 || i >= raw.length - 2;
      if (!edge) return true;
      if (/^(page\s*)?\d{1,4}$/i.test(l.text)) return false;
      const k = key(l.text);
      if (k && cnt.get(k) >= thr && l.text.length < 90) return false;
      return true;
    });
    if (!ls.length) continue;
    const left = modeOf(ls.map(l => Math.round(l.x))),
      lw = Math.max(...ls.map(l => l.endX - l.x)) || 400;
    const gaps = [];
    for (let i = 1; i < ls.length; i++) {
      const g = ls[i - 1].y - ls[i].y;
      if (g > 0) gaps.push(g);
    }
    gaps.sort((a, b) => a - b);
    const mg = gaps[Math.floor(gaps.length / 2)] || bodyH * 1.3;
    ls.forEach((l, i) => {
      const big = l.maxH > bodyH * 1.3,
        width = l.endX - l.x;
      const centered = l.x > left + bodyH * 2 && width < lw * 0.8;
      const indented = l.x > left + bodyH * 0.6 && l.x < left + bodyH * 6;
      let brk = !cur || cur.solo || centered || big !== (cur && cur.big);
      if (!brk) {
        if (i === 0) brk = /[.!?”"’':;)\]—]$/.test(cur.text) && (indented || cur.lastShort);
        else {
          const g = ls[i - 1].y - l.y;
          brk = g > mg * 1.45 || indented || (cur.lastShort && /[.!?”"’]$/.test(cur.text));
        }
      }
      if (brk) {
        push();
        cur = { text: l.text, big, solo: centered };
      } else
        cur.text =
          /[A-Za-z]-$/.test(cur.text) && /^[a-z]/.test(l.text)
            ? cur.text.slice(0, -1) + l.text
            : cur.text + ' ' + l.text;
      cur.lastShort = width < lw * 0.72;
    });
  }
  push();
  return paras;
}

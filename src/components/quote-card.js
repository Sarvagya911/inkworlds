// Turns a highlight into a shareable image styled in the book's world.
import { themeOf } from '../app/books.js';
import { busy, download } from '../app/helpers.js';
import { THEMES, ensureFonts } from '../config/themes.js';
import { mk } from '../engine/scenes/draw-utils.js';
import { Renderer } from '../engine/scenes/renderer.js';
import { $ } from '../lib/utils.js';

export function wrapLines(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

export let cardBlob = null;

export async function showQuoteCard(h, meta) {
  const key = themeOf(meta),
    th = THEMES[key];
  ensureFonts([th.body]);
  busy(true, 'Making your quote card…', 1);
  try {
    await Promise.all([
      document.fonts.load(`40px "${th.title}"`),
      document.fonts.load(`40px "${th.body}"`),
      document.fonts.load(`italic 30px "${th.body}"`)
    ]);
  } catch (e) {}
  const W = 1080,
    H = 1350,
    cv = mk(W, H),
    r = new Renderer(cv, { fixed: [W, H] });
  r.set(key);
  for (let i = 0; i < 20; i++) r.frame(0.12);
  const c = cv.getContext('2d'),
    m = 90;
  c.fillStyle = th.panel;
  c.beginPath();
  if (c.roundRect) c.roundRect(m, m, W - 2 * m, H - 2 * m, 18);
  else c.rect(m, m, W - 2 * m, H - 2 * m);
  c.fill();
  c.fillStyle = th.accent;
  c.font = `160px "${th.title}", Georgia, serif`;
  c.textBaseline = 'top';
  c.fillText('“', m + 60, m + 30);
  let size = 60,
    lines;
  const maxW = W - 2 * m - 140;
  do {
    c.font = `${size}px "${th.body}", Georgia, serif`;
    lines = wrapLines(c, h.text, maxW);
    size -= 2;
  } while (lines.length * size * 1.45 > H * 0.52 && size > 26);
  size += 2;
  c.font = `${size}px "${th.body}", Georgia, serif`;
  c.fillStyle = th.text;
  c.textBaseline = 'alphabetic';
  let y = m + 260;
  for (const l of lines) {
    c.fillText(l, m + 70, y);
    y += size * 1.45;
  }
  y = Math.max(y + 40, H - m - 190);
  c.fillStyle = th.accent;
  c.fillRect(m + 70, y, 120, 3);
  c.font = `44px "${th.title}", Georgia, serif`;
  const tl = wrapLines(c, meta.title, maxW);
  c.fillText(tl[0] + (tl.length > 1 ? '…' : ''), m + 70, y + 70);
  c.fillStyle = th.text;
  c.globalAlpha = 0.8;
  c.font = `italic 30px "${th.body}", Georgia, serif`;
  c.fillText([meta.author, h.chTitle].filter(Boolean).join(', ').slice(0, 60), m + 70, y + 118);
  c.globalAlpha = 1;
  cardBlob = await new Promise(res => cv.toBlob(res, 'image/png'));
  $('cardImg').src = cv.toDataURL('image/png');
  $('cardImg').dataset.name =
    (meta.title
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40) || 'quote') + '-quote.png';
  busy(false);
  $('cardDlg').showModal();
}

$('cardClose').addEventListener('click', () => $('cardDlg').close());

$('cardSave').addEventListener('click', () => {
  if (cardBlob) {
    download($('cardImg').dataset.name, cardBlob);
    $('cardDlg').close();
  }
});

// All your highlights and notes.
import { sampleMeta, themeOf } from '../app/books.js';
import { app, enc, errMsg, fail, signInGate, signedIn } from '../app/helpers.js';
import { route, routeId } from '../app/router.js';
import { showQuoteCard } from '../components/quote-card.js';
import { THEMES, ensureFonts, fontStack } from '../config/themes.js';
import { SAMPLES } from '../content/samples.js';
import { $, esc, lsSet } from '../lib/utils.js';
import * as cloud from '../services/index.js';

export async function viewHighlights() {
  const rid = routeId;
  app.innerHTML = `<section class="view"><h1 class="page-title">Highlights</h1>
    <p class="lede">Lines you've marked while reading, with your notes. Turn any of them into a quote card in the book's own style.</p><div id="hl"></div></section>`;
  if (!signedIn()) {
    $('hl').innerHTML = signInGate('save highlights and notes');
    return;
  }
  $('hl').innerHTML = '<p class="muted">Loading highlights…</p>';
  let hls = [],
    books = [];
  try {
    [hls, books] = await Promise.all([cloud.highlights(), cloud.myBooks()]);
  } catch (e) {
    if (rid === routeId) $('hl').innerHTML = `<div class="empty-box">${esc(errMsg(e))}</div>`;
    return;
  }
  if (rid !== routeId) return;
  const byId = Object.fromEntries([...books, ...SAMPLES.map(sampleMeta)].map(b => [b.id, b]));
  const missing = [...new Set(hls.map(h => h.bookId))].filter(id => !byId[id]);
  for (const id of missing) {
    try {
      const m = await cloud.bookMeta(id);
      if (m) byId[id] = m;
    } catch (e) {}
  }
  if (rid !== routeId) return;
  hls = hls.filter(h => byId[h.bookId]);
  const only = new URLSearchParams(location.hash.split('?')[1] || '').get('book');
  const ids = [...new Set(hls.map(h => h.bookId))],
    list = only ? hls.filter(h => h.bookId === only) : hls;
  ensureFonts(ids.map(id => THEMES[themeOf(byId[id])].body));
  $('hl').innerHTML =
    `${hls.length ? `<div class="lib-tools"><select class="input" id="hlFilter" aria-label="Filter by book" style="flex:0 1 22rem"><option value="">All books</option>${ids.map(id => `<option value="${esc(id)}"${only === id ? ' selected' : ''}>${esc(byId[id].title)}</option>`).join('')}</select></div>` : ''}
    <div class="hl-list">${
      list.length
        ? list
            .map(h => {
              const b = byId[h.bookId],
                t = THEMES[themeOf(b)];
              return `<article class="hl-item" style="--acc:${t.accent}">
      <blockquote style="font-family:${esc(fontStack(t.body, 'body'))}">${esc(h.text)}</blockquote>${h.note ? `<p class="note">${esc(h.note)}</p>` : ''}
      <p class="meta"><span>${esc(b.title)}, ${esc(h.chTitle || '')}</span><span class="sp"></span>
        <a class="btn ghost small" href="#/read/${enc(h.bookId)}" data-jump="${esc(h.id)}">Open in book</a>
        <button class="btn ghost small" type="button" data-card="${esc(h.id)}">Quote card</button>
        <button class="btn ghost small" type="button" data-del="${esc(h.id)}">Delete</button></p></article>`;
            })
            .join('')
        : `<div class="empty-box">No highlights yet. While reading, select any text and choose Highlight or Add note.</div>`
    }</div>`;
  const f = $('hlFilter');
  if (f)
    f.addEventListener('change', e => {
      location.hash = '#/highlights' + (e.target.value ? '?book=' + enc(e.target.value) : '');
    });
  app.querySelectorAll('[data-jump]').forEach(a =>
    a.addEventListener('click', () => {
      const h = hls.find(x => x.id === a.dataset.jump);
      lsSet('iw:jump', { id: h.bookId, ch: h.ch, si: h.si });
    })
  );
  app.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', async () => {
      try {
        await cloud.deleteHighlight(b.dataset.del);
        route();
      } catch (e) {
        fail(e);
      }
    })
  );
  app.querySelectorAll('[data-card]').forEach(b =>
    b.addEventListener('click', () => {
      const h = hls.find(x => x.id === b.dataset.card);
      showQuoteCard(h, byId[h.bookId]);
    })
  );
}

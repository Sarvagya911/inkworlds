// Side drawer: contents, bookmarks, highlights and search.
import { fail, signedIn } from '../app/helpers.js';
import { $, esc } from '../lib/utils.js';
import { scrollToPara } from './position.js';
import { closePanels, cur } from './reader.js';
import { prettyLabel } from './render.js';
import * as cloud from '../services/index.js';

export let tab = 'toc';

export function renderTab() {
  document
    .querySelectorAll('.tabs [data-tab]')
    .forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'));
  const body = $('tabBody');
  if (tab === 'toc') {
    body.innerHTML = `<ul class="dlist">${cur.chapters.map((c, i) => `<li><button class="item" type="button" data-toc="${i}" aria-current="${i === cur.ci}"><span>${esc(c.title)}${c.sub ? ': ' + esc(prettyLabel(c.sub)) : ''}</span><span class="mood">${cur.moods[i].label}</span></button></li>`).join('')}</ul>`;
    body.querySelectorAll('[data-toc]').forEach(b =>
      b.addEventListener('click', () => {
        closePanels();
        scrollToPara(+b.dataset.toc, null);
      })
    );
  } else if (tab === 'marks') {
    if (!signedIn()) {
      body.innerHTML =
        '<p class="dempty"><a href="#/signin" data-remember>Sign in</a> to save bookmarks.</p>';
      return;
    }
    const ms = [...cur.marks].sort((a, b) => a.ch - b.ch || a.si - b.si);
    body.innerHTML = ms.length
      ? `<ul class="dlist">${ms.map(m => `<li style="display:flex;gap:.3rem;align-items:flex-start"><button class="item" type="button" data-bm="${esc(m.id)}"><span>${esc(cur.chapters[m.ch]?.title || '')}<span class="snip">${esc(m.snippet)}</span></span></button><button class="tb" type="button" data-bmdel="${esc(m.id)}" aria-label="Delete bookmark">✕</button></li>`).join('')}</ul>`
      : '<p class="dempty">No bookmarks yet. Use the Bookmark button at the top to save your place.</p>';
    body.querySelectorAll('[data-bm]').forEach(b =>
      b.addEventListener('click', () => {
        const m = cur.marks.find(x => x.id === b.dataset.bm);
        closePanels();
        scrollToPara(m.ch, m.si, true);
      })
    );
    body.querySelectorAll('[data-bmdel]').forEach(b =>
      b.addEventListener('click', async () => {
        try {
          await cloud.deleteBookmark(b.dataset.bmdel);
          cur.marks = cur.marks.filter(x => x.id !== b.dataset.bmdel);
          renderTab();
        } catch (e) {
          fail(e);
        }
      })
    );
  } else if (tab === 'hls') {
    if (!signedIn()) {
      body.innerHTML =
        '<p class="dempty"><a href="#/signin" data-remember>Sign in</a> to save highlights.</p>';
      return;
    }
    const hs = [...cur.hls].sort((a, b) => a.ch - b.ch || a.si - b.si || a.start - b.start);
    body.innerHTML = hs.length
      ? `<ul class="dlist">${hs.map(h => `<li><button class="item" type="button" data-hj="${esc(h.id)}"><span>${esc(h.text.length > 140 ? h.text.slice(0, 140) + '…' : h.text)}${h.note ? `<span class="snip">Note: ${esc(h.note)}</span>` : ''}</span></button></li>`).join('')}</ul>`
      : '<p class="dempty">No highlights yet. Select any text in the book to highlight it or add a note.</p>';
    body.querySelectorAll('[data-hj]').forEach(b =>
      b.addEventListener('click', () => {
        const h = cur.hls.find(x => x.id === b.dataset.hj);
        closePanels();
        scrollToPara(h.ch, h.si, true);
      })
    );
  } else {
    body.innerHTML =
      '<input class="input" id="findIn" type="search" placeholder="Search this book" aria-label="Search this book"><p class="dempty" id="findInfo">Type at least 3 letters.</p><ul class="dlist" id="findRes"></ul>';
    const inp = $('findIn');
    inp.focus();
    let t = 0;
    inp.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => runSearch(inp.value), 200);
    });
  }
}

export function runSearch(q) {
  q = q.trim();
  const res = $('findRes'),
    info = $('findInfo');
  res.innerHTML = '';
  if (q.length < 3) {
    info.textContent = 'Type at least 3 letters.';
    return;
  }
  const ql = q.toLowerCase(),
    out = [];
  cur.chapters.forEach((c, ch) =>
    c.paras.forEach((p, si) => {
      const i = p.toLowerCase().indexOf(ql);
      if (i >= 0 && out.length < 80) out.push({ ch, si, i, p });
    })
  );
  info.textContent = out.length
    ? `${out.length >= 80 ? '80+' : out.length} match${out.length === 1 ? '' : 'es'}`
    : 'No matches in this book.';
  res.innerHTML = out
    .map((r, k) => {
      const a = Math.max(0, r.i - 50),
        pre = (a ? '…' : '') + r.p.slice(a, r.i),
        hit = r.p.slice(r.i, r.i + q.length),
        post = r.p.slice(r.i + q.length, r.i + q.length + 70) + '…';
      return `<li><button class="item" type="button" data-fr="${k}"><span>${esc(cur.chapters[r.ch].title)}<span class="snip">${esc(pre)}<mark>${esc(hit)}</mark>${esc(post)}</span></span></button></li>`;
    })
    .join('');
  res.querySelectorAll('[data-fr]').forEach(b =>
    b.addEventListener('click', () => {
      const r = out[+b.dataset.fr];
      closePanels();
      scrollToPara(r.ch, r.si, true);
    })
  );
}

document.querySelectorAll('.tabs [data-tab]').forEach(b =>
  b.addEventListener('click', () => {
    tab = b.dataset.tab;
    renderTab();
  })
);

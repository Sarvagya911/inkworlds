// Turns chapters into the page: paragraphs, drop caps, handwritten letters, diaries, telegrams, newspapers.
import { themeOf } from '../app/books.js';
import { THEMES } from '../config/themes.js';
import { buildBlocks, reDiaryDate } from '../engine/parser/structure.js';
import { $, prefs, reduceMotion, titleCase, upperRatio } from '../lib/utils.js';
import { paintHighlight } from './highlight-paint.js';
import { paintBadges } from './passage-comments.js';
import { cur } from './reader.js';

export const prettyLabel = s => (upperRatio(s) > 0.6 ? titleCase(s) : s);

export function renderDoc(b) {
  const d = document.createElement('div');
  d.className = 'doc ' + b.type;
  const ink = document.createElement('div');
  ink.className = 'ink';
  if (b.type === 'telegram') {
    const hd = document.createElement('div');
    hd.className = 'tg-head';
    const a = document.createElement('span');
    a.textContent = 'Telegram';
    const who = document.createElement('span');
    who.textContent = prettyLabel(b.label.replace(/^telegram[,.:\s]*/i, '').replace(/\.$/, ''));
    hd.append(a, who);
    d.appendChild(hd);
  } else if (b.type === 'news') {
    const mast = document.createElement('div');
    mast.className = 'mast';
    mast.textContent = prettyLabel(b.label.replace(/^cutting from\s*/i, '').replace(/\.$/, ''));
    d.appendChild(mast);
  } else if (b.label) {
    const l = document.createElement('p');
    l.className = 'label';
    l.textContent = prettyLabel(b.label);
    d.appendChild(l);
  }
  for (const p of b.paras) {
    const el = document.createElement('p');
    el.dataset.si = p.si;
    if (b.type === 'diary' && reDiaryDate.test(p.t)) {
      const cut = p.t.indexOf('—');
      if (cut > 0 && cut < 70) {
        const dt = document.createElement('span');
        dt.className = 'date';
        dt.textContent = p.t.slice(0, cut + 1);
        el.append(dt, document.createTextNode(p.t.slice(cut + 1)));
      } else el.textContent = p.t;
    } else el.textContent = p.t;
    if (p.cls) el.className = p.cls;
    ink.appendChild(el);
  }
  d.appendChild(ink);
  if (prefs.motion && !reduceMotion) d.classList.add('will-ink');
  return d;
}

export let inkObs = null;

export function renderReaderBook() {
  const pages = $('pages');
  pages.innerHTML = '';
  const th = THEMES[themeOf(cur.meta)];
  if (inkObs) inkObs.disconnect();
  inkObs = new IntersectionObserver(
    es =>
      es.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('inked');
          inkObs.unobserve(e.target);
        }
      }),
    { rootMargin: '0px 0px -12% 0px' }
  );
  cur.sections = cur.chapters.map((ch, i) => {
    const sec = document.createElement('section');
    sec.className = 'chapter';
    sec.id = 'ch' + i;
    sec.dataset.ch = i;
    sec.setAttribute('aria-label', ch.title);
    const h = document.createElement('h2');
    h.className = 'ch-title';
    h.textContent = ch.title;
    sec.appendChild(h);
    if (ch.sub) {
      const s = document.createElement('p');
      s.className = 'ch-sub';
      s.textContent = prettyLabel(ch.sub);
      sec.appendChild(s);
    } else {
      const g = document.createElement('div');
      g.className = 'ch-gap';
      sec.appendChild(g);
    }
    let lead = true;
    for (const b of buildBlocks(ch.paras)) {
      if (b.kind === 'p') {
        const p = document.createElement('p');
        p.textContent = b.text;
        p.dataset.si = b.si;
        if (lead && b.text.length > 60) {
          p.className = 'lead';
          lead = false;
        }
        sec.appendChild(p);
      } else {
        const d = renderDoc(b);
        sec.appendChild(d);
        if (d.classList.contains('will-ink')) inkObs.observe(d);
        lead = false;
      }
    }
    const o = document.createElement('div');
    o.className = 'ornament';
    o.setAttribute('aria-hidden', 'true');
    o.textContent = th.orn;
    sec.appendChild(o);
    pages.appendChild(sec);
    return sec;
  });
  cur.hls.forEach(paintHighlight);
  paintBadges();
}

export const paraEl = (ch, si) => document.querySelector(`#ch${ch} [data-si="${si}"]`);

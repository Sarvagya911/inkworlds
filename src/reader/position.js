// Scroll position: restoring your place, tracking the current chapter, saving progress.
import { themeOf } from '../app/books.js';
import { addReading, progOf, queueProgress } from '../app/sync.js';
import { Ambience } from '../engine/ambience.js';
import { Main } from '../engine/scenes/stage.js';
import { $, clamp, lsGet } from '../lib/utils.js';
import { cur } from './reader.js';
import { paraEl } from './render.js';

export function scrollToPara(ch, si, flash) {
  const sec = cur.sections[ch];
  if (!sec) return;
  const go = () => {
    const el = si != null ? paraEl(ch, si) : null,
      t = el || sec;
    window.scrollTo(0, t.getBoundingClientRect().top + scrollY - (el ? innerHeight * 0.3 : 70));
  };
  go();
  requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(() => {
    go();
    if (flash && si != null) {
      const el = paraEl(ch, si);
      if (el) {
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
      }
    }
  }, 350);
}

export function restorePos() {
  const jump = lsGet('iw:jump', null);
  try {
    localStorage.removeItem('iw:jump');
  } catch (e) {}
  if (jump && jump.id === cur.meta.id && cur.sections[jump.ch]) {
    scrollToPara(jump.ch, jump.si, jump.si != null);
    return;
  }
  const p = progOf(cur.meta.id);
  if (!p || !cur.sections[p.ch]) {
    window.scrollTo(0, 0);
    return;
  }
  const sec = cur.sections[p.ch],
    go = () =>
      window.scrollTo(
        0,
        sec.getBoundingClientRect().top + scrollY + (p.frac || 0) * sec.offsetHeight - innerHeight * 0.35
      );
  go();
  requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(go, 350);
}

export function probeEl() {
  let el = document.elementFromPoint(innerWidth / 2, innerHeight * 0.35);
  while (el && !(el.dataset && el.dataset.si != null) && el !== document.body) el = el.parentElement;
  return el && el.dataset && el.dataset.si != null ? el : null;
}

export let lastY = 0,
  ticking = false,
  saveT = 0,
  lastActive = Date.now();

export function resetScroll() {
  lastY = 0;
}

export function onScroll() {
  lastActive = Date.now();
  if (!cur || ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    if (!cur) return;
    const y = scrollY,
      max = Math.max(1, document.documentElement.scrollHeight - innerHeight),
      pct = clamp(y / max, 0, 1);
    $('progBar').style.width = pct * 100 + '%';
    const tb = $('topbar');
    if (y > lastY + 6 && y > 120) tb.classList.add('away');
    else if (y < lastY - 6) tb.classList.remove('away');
    lastY = y;
    const probe = innerHeight * 0.35;
    let ci = 0;
    for (let i = 0; i < cur.sections.length; i++) {
      if (cur.sections[i].getBoundingClientRect().top <= probe) ci = i;
      else break;
    }
    if (ci !== cur.ci) {
      cur.ci = ci;
      $('chapTitle').textContent = cur.chapters[ci].title;
      Main.setMood(cur.moods[ci]);
      Ambience.applyMood(cur.moods[ci]);
      document
        .querySelectorAll('#tabBody [data-toc]')
        .forEach(b => b.setAttribute('aria-current', +b.dataset.toc === ci ? 'true' : 'false'));
    }
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      if (!cur) return;
      const r = cur.sections[cur.ci].getBoundingClientRect(),
        prev = progOf(cur.meta.id) || {},
        maxPct = Math.max(prev.maxPct || 0, pct);
      if (prev.maxPct != null && pct > prev.maxPct)
        addReading(0, (pct - prev.maxPct) * cur.meta.words, null, null);
      queueProgress(cur.meta.id, {
        ch: cur.ci,
        frac: clamp((probe - r.top) / Math.max(1, r.height), 0, 1),
        pct,
        maxPct,
        updated: Date.now()
      });
    }, 400);
  });
}

['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev =>
  addEventListener(
    ev,
    () => {
      lastActive = Date.now();
    },
    { passive: true }
  )
);

setInterval(() => {
  if (cur && !document.hidden && Date.now() - lastActive < 90000)
    addReading(5, 0, cur.meta.id, themeOf(cur.meta));
}, 5000);

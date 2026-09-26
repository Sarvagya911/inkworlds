// The reader: opening and closing books, theme, sound, progress and panels.
import { getBook, themeOf } from '../app/books.js';
import { aiReady, app, busy, signedIn } from '../app/helpers.js';
import { flushProgress, flushReading, progOf, setProg } from '../app/sync.js';
import { THEMES, ensureFonts, fontStack } from '../config/themes.js';
import { Ambience } from '../engine/ambience.js';
import { chapterMood } from '../engine/parser/detect.js';
import { Main } from '../engine/scenes/stage.js';
import { $, esc, prefs, toast } from '../lib/utils.js';
import { hideSelPop } from './annotations.js';
import { startPassageComments, stopPassageComments } from './passage-comments.js';
import { onScroll, resetScroll, restorePos } from './position.js';
import { renderReaderBook } from './render.js';
import * as cloud from '../services/index.js';

export let cur = null;

export function applyTheme(key) {
  const th = THEMES[key],
    r = $('reader');
  ensureFonts([th.body, th.hand, 'Special Elite', 'Old Standard TT']);
  const set = (k, v) => r.style.setProperty(k, v);
  set('--panel', th.panel);
  set('--text', th.text);
  set('--accent', th.accent);
  set('--bar', th.bar);
  set('--edge', th.edge);
  set('--hl', th.hl);
  set('--paper', th.paper);
  set('--paper-ink', th.ink);
  set('--rule', th.rule);
  set('--hs', th.hs);
  set('--title-font', fontStack(th.title, 'title'));
  set('--body-font', fontStack(th.body, 'body'));
  set('--hand-font', fontStack(th.hand, 'hand'));
  document.querySelectorAll('.ornament').forEach(o => (o.textContent = th.orn));
  Main.set(key);
  if (prefs.motion) Main.start();
  if (cur && cur.moods) Main.setMood(cur.moods[Math.max(0, cur.ci)] || { storm: 0, dark: 0, warm: 0 });
  if (Ambience.playing) Ambience.play(key);
}

export function fillThemeSelect() {
  $('themeSel').innerHTML =
    `<option value="auto">Automatic: ${esc(THEMES[cur.meta.auto].name)}</option>` +
    Object.entries(THEMES)
      .map(([k, t]) => `<option value="${k}">${esc(t.name)}</option>`)
      .join('');
  $('themeSel').value = cur.meta.theme || 'auto';
  updateWhy();
}

export function updateWhy() {
  const m = cur.meta;
  $('themeWhy').textContent =
    m.aiReason && m.theme !== 'auto'
      ? 'Claude chose this world: ' + m.aiReason
      : (m.theme || 'auto') === 'auto'
        ? m.remote
          ? "The owner's choice of world."
          : m.hits && m.hits.length
            ? `Picked from words in the book like ${m.hits.map(h => '“' + h + '”').join(', ')}.`
            : 'No strong clues in the text, so the classic look is used.'
        : 'You picked this world.';
}

export async function openReader(id) {
  if (cur && cur.meta.id === id) return;
  busy(true, 'Opening book…', 1);
  let book = null;
  try {
    book = await getBook(id);
  } catch (e) {}
  busy(false);
  if (!book) {
    toast("That book isn't in your library or shared publicly.");
    location.hash = '#/library';
    return;
  }
  if (cur) closeReader();
  if (signedIn()) {
    try {
      const sp = await cloud.getProgress(id),
        lp = progOf(id);
      if (sp && (!lp || (lp.updated || 0) < sp.updated)) setProg(id, sp);
    } catch (e) {}
  }
  let hls = [],
    marks = [];
  if (signedIn()) {
    try {
      [hls, marks] = await Promise.all([cloud.highlights(id), cloud.bookmarks(id)]);
    } catch (e) {}
  }
  cur = {
    meta: book.meta,
    chapters: book.chapters,
    moods: book.chapters.map(chapterMood),
    sections: [],
    ci: -1,
    hls,
    marks
  };
  document.body.classList.add('reading');
  app.hidden = true;
  $('reader').hidden = false;
  $('bookTitle').textContent = cur.meta.title;
  $('chapTitle').textContent = cur.chapters[0] ? cur.chapters[0].title : '';
  $('compBtn').hidden = !aiReady();
  $('aiField').hidden = !(aiReady() && cur.meta.own);
  $('answer').textContent = '';
  applyReaderPrefs();
  applyTheme(themeOf(cur.meta));
  renderReaderBook();
  fillThemeSelect();
  resetScroll();
  restorePos();
  setTimeout(onScroll, 60);
  document.title = cur.meta.title + ' · Inkworlds';
  if (prefs.sound) pendingSound = true;
  updateSoundBtn();
  startPassageComments();
}

export let pendingSound = false;

addEventListener(
  'pointerdown',
  e => {
    if (e.target.closest && e.target.closest('#soundBtn')) return;
    if (pendingSound && cur) {
      pendingSound = false;
      if (Ambience.play(themeOf(cur.meta))) Ambience.applyMood(cur.moods[Math.max(0, cur.ci)], true);
      updateSoundBtn();
    }
  },
  true
);

export function updateSoundBtn() {
  $('soundBtn').setAttribute('aria-pressed', Ambience.playing || pendingSound ? 'true' : 'false');
}

export function closeReader() {
  flushProgress();
  flushReading();
  stopPassageComments();
  Main.stop();
  Main.name = null;
  Ambience.stopAll();
  pendingSound = false;
  updateSoundBtn();
  cur = null;
  closePanels();
  hideSelPop();
  document.body.classList.remove('reading');
  $('reader').hidden = true;
  app.hidden = false;
  $('pages').innerHTML = '';
}

export function applyReaderPrefs() {
  const r = $('reader');
  r.style.setProperty('--fs', prefs.fs + 'px');
  r.classList.toggle('hand-all', !!prefs.handAll);
  $('fsRange').value = prefs.fs;
  $('volRange').value = prefs.vol;
  $('handAll').checked = !!prefs.handAll;
  $('motionOn').checked = !!prefs.motion;
}

export function closePanels() {
  $('drawer').classList.remove('open');
  ['sheet', 'comp', 'pcSheet'].forEach(id => ($(id).hidden = true));
  $('scrim').hidden = true;
  ['tocBtn', 'setBtn', 'compBtn'].forEach(b => $(b).setAttribute('aria-expanded', 'false'));
}

$('soundBtn').addEventListener('click', () => {
  if (!cur) return;
  pendingSound = false;
  if (Ambience.playing) Ambience.pause();
  else if (Ambience.play(themeOf(cur.meta))) Ambience.applyMood(cur.moods[Math.max(0, cur.ci)], true);
  else toast("This browser can't play generated sound.");
  updateSoundBtn();
});

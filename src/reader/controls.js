// Reader toolbar and settings panel wiring.
import { saveMeta, themeOf } from '../app/books.js';
import { enc } from '../app/helpers.js';
import { changePrefs } from '../app/sync.js';
import { Ambience } from '../engine/ambience.js';
import { Main } from '../engine/scenes/stage.js';
import { $, prefs } from '../lib/utils.js';
import { hideSelPop } from './annotations.js';
import { renderTab } from './drawer.js';
import { onScroll } from './position.js';
import { applyReaderPrefs, applyTheme, closePanels, cur, updateWhy } from './reader.js';

$('backBtn').addEventListener('click', () => {
  location.hash = '#/book/' + enc(cur.meta.id);
});

$('tocBtn').addEventListener('click', () => {
  const open = !$('drawer').classList.contains('open');
  closePanels();
  if (open) {
    $('drawer').classList.add('open');
    $('scrim').hidden = false;
    $('tocBtn').setAttribute('aria-expanded', 'true');
    renderTab();
    const f =
      $('tabBody').querySelector('[aria-current="true"]') || $('tabBody').querySelector('button,input');
    f && f.focus();
  }
});

$('setBtn').addEventListener('click', () => {
  const open = $('sheet').hidden;
  closePanels();
  if (open) {
    $('sheet').hidden = false;
    $('scrim').hidden = false;
    $('setBtn').setAttribute('aria-expanded', 'true');
    $('themeSel').focus();
  }
});

$('scrim').addEventListener('click', closePanels);

addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closePanels();
    hideSelPop();
  }
});

addEventListener(
  'scroll',
  () => {
    onScroll();
    if (!$('selpop').hidden) hideSelPop();
  },
  { passive: true }
);

$('themeSel').addEventListener('change', async e => {
  cur.meta.theme = e.target.value;
  cur.meta.aiReason = '';
  await saveMeta(cur.meta);
  applyTheme(themeOf(cur.meta));
  updateWhy();
});

$('fsRange').addEventListener('input', e => {
  changePrefs({ fs: +e.target.value });
  applyReaderPrefs();
});

$('volRange').addEventListener('input', e => {
  changePrefs({ vol: +e.target.value });
  Ambience.volume();
});

$('handAll').addEventListener('change', e => {
  changePrefs({ handAll: e.target.checked });
  applyReaderPrefs();
});

$('motionOn').addEventListener('change', e => {
  changePrefs({ motion: e.target.checked });
  if (prefs.motion) Main.start();
  else Main.stop();
});

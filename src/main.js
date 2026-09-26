// Entry point: loads styles and reader wiring, handles file drops, starts auth and the router.
// Entry point: loads styles, wires start-up behaviour, then hands off to the router.
import './styles/index.css';
// Reader modules that only attach event listeners (the rest are pulled in by the router)
import './reader/controls.js';
import './reader/companion.js';
import { addFile } from './app/books.js';
import { renderAccountChip, route } from './app/router.js';
import { syncProgressDown } from './app/sync.js';
import { initAuth, onAuthChange } from './auth/session.js';
import { $, applyUiTheme, prefs, savePrefs } from './lib/utils.js';
import { cur } from './reader/reader.js';
import { session } from './services/session.js';

$('fileIn').addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  addFile(f);
});

let dragDepth = 0;

addEventListener('dragenter', e => {
  if (cur) return;
  if ([...(e.dataTransfer?.types || [])].includes('Files')) {
    dragDepth++;
    $('dropVeil').hidden = false;
    e.preventDefault();
  }
});

addEventListener('dragover', e => {
  if (!cur) e.preventDefault();
});

addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) $('dropVeil').hidden = true;
});

addEventListener('drop', e => {
  if (cur) return;
  e.preventDefault();
  dragDepth = 0;
  $('dropVeil').hidden = true;
  const f = e.dataTransfer?.files?.[0];
  if (f) addFile(f);
});

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

onAuthChange(async u => {
  renderAccountChip();
  if (u) {
    const saved = session.profile && session.profile.prefs;
    if (saved && Object.keys(saved).length) {
      Object.assign(prefs, saved);
      savePrefs();
      applyUiTheme();
    }
    await syncProgressDown();
  }
  if (started && !cur) route();
});

let started = false;

(async () => {
  await initAuth();
  renderAccountChip();
  started = true;
  route();
})();

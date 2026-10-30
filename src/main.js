// Entry point: loads styles, wires start-up behaviour, then hands off to the router.

import './styles/index.css';
import './reader/controls.js';
import './reader/companion.js';

import { Capacitor } from '@capacitor/core';

import { addFile } from './app/books.js';
import { addEpubFile } from './app/epub-books.js';
import {
  renderAccountChip,
  route
} from './app/router.js';
import { syncProgressDown } from './app/sync.js';
import { initAuth, onAuthChange } from './auth/session.js';
import {
  $,
  applyUiTheme,
  prefs,
  savePrefs
} from './lib/utils.js';
import { cur } from './reader/reader.js';
import { session } from './services/session.js';
import { primeOfflineCache } from './services/index.js';
import { initNativeApp } from './native/app.js';

const fileInput = $('fileIn');
if (fileInput) {
  fileInput.accept = `${fileInput.accept || ''},.epub,application/epub+zip`;
}

function handleFile(file) {
  if (!file) return;
  if (/\.epub$/i.test(file.name) || file.type === 'application/epub+zip') {
    addEpubFile(file);
    return;
  }
  addFile(file);
}

fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  handleFile(f);
});

async function handleNativeFile(detail) {
  if (!detail) return;
  if (detail.error) {
    const { toast } = await import('./lib/utils.js');
    toast(detail.error, 6000);
    return;
  }
  if (!detail.url) return;

  try {
    const url = Capacitor.convertFileSrc(detail.url);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not open the selected file.');

    const blob = await response.blob();
    const type = detail.type || blob.type || 'application/octet-stream';
    const file = new File([blob], detail.name || 'book', { type });
    handleFile(file);
  } catch (e) {
    const { toast } = await import('./lib/utils.js');
    toast(e?.message || 'Could not open the selected file.', 6000);
  }
}

window.addEventListener('inkworlds-native-file', e => {
  handleNativeFile(e.detail);
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
  if (f) handleFile(f);
});

if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

onAuthChange(async u => {
  renderAccountChip();

  if (u) {
    const saved = session.profile && session.profile.prefs;
    if (saved && Object.keys(saved).length) {
      Object.assign(prefs, saved);
      savePrefs();
      applyUiTheme();
    }

    syncProgressDown().catch(() => {});

    if (navigator.onLine !== false) {
      primeOfflineCache().catch(() => {});
    }
  }

  if (started && !cur) route();
});

let started = false;

(async () => {
  await initNativeApp();
  started = true;
  renderAccountChip();
  route();
  initAuth().catch(() => {});
})();
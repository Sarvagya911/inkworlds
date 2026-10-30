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
import { CONTENT_TYPES } from './services/books.js';
import {
  getUploadContentType,
  setUploadContentType
} from './app/upload.js';
import { initNativeApp } from './native/app.js';

const fileInput = $('fileIn');
if (fileInput) {
  fileInput.accept = `${fileInput.accept || ''},.epub,application/epub+zip`;
}

function handleFile(file, options = {}) {
  if (!file) return;
  if (/\.epub$/i.test(file.name) || file.type === 'application/epub+zip') {
    addEpubFile(file);
    return;
  }
  addFile(file, options);
}

fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  handleFile(f);
});

function pickExternalContentType(fileName, mimeType) {
  const isPdf = /\.pdf$/i.test(fileName || '') || mimeType === 'application/pdf';
  const isEpub = /\.epub$/i.test(fileName || '') || mimeType === 'application/epub+zip';
  const isTxt = /\.txt$/i.test(fileName || '') || mimeType === 'text/plain';
  const mangaAllowed = isPdf;

  return new Promise(resolve => {
    const existing = document.getElementById('uploadTypePicker');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'uploadTypePicker';
    overlay.className = 'upload-type-overlay';

    overlay.innerHTML = `
      <div
        class="upload-type-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="uploadTypeTitle"
      >
        <button
          class="upload-type-close"
          id="uploadTypeClose"
          type="button"
          aria-label="Close"
        >×</button>

        <div class="upload-type-heading">
          <span class="upload-type-kicker">Add to your library</span>
          <h2 id="uploadTypeTitle">What are you adding?</h2>
          <p>Choose how Inkworlds should treat this file.</p>
        </div>

        <div class="upload-type-options" role="list">
          <button class="upload-type-option" type="button" data-upload-type="${CONTENT_TYPES.BOOK}">
            <span class="upload-type-icon">📖</span>
            <span class="upload-type-copy">
              <strong>Novel</strong>
              <small>Traditional prose fiction</small>
            </span>
            <span class="upload-type-arrow">→</span>
          </button>

          <button class="upload-type-option" type="button" data-upload-type="${CONTENT_TYPES.LIGHT_NOVEL}">
            <span class="upload-type-icon">✨</span>
            <span class="upload-type-copy">
              <strong>Light Novel</strong>
              <small>Japanese-style light fiction</small>
            </span>
            <span class="upload-type-arrow">→</span>
          </button>

          <button
            class="upload-type-option"
            type="button"
            data-upload-type="${CONTENT_TYPES.MANGA}"
            ${mangaAllowed ? '' : 'disabled aria-disabled="true"'}
          >
            <span class="upload-type-icon">🖼️</span>
            <span class="upload-type-copy">
              <strong>Manga</strong>
              <small>${mangaAllowed ? 'Manga and illustrated stories' : 'Manga imports require a PDF'}</small>
            </span>
            <span class="upload-type-arrow">${mangaAllowed ? '→' : '—'}</span>
          </button>
        </div>

        <button class="upload-type-cancel" id="uploadTypeCancel" type="button">Cancel</button>
      </div>
    `;

    document.body.appendChild(overlay);

    let settled = false;

    const finish = type => {
      if (settled) return;
      settled = true;
      overlay.classList.add('is-closing');
      setTimeout(() => overlay.remove(), 150);
      document.removeEventListener('keydown', onKeyDown);
      resolve(type);
    };

    const onKeyDown = event => {
      if (event.key === 'Escape') finish(null);
    };

    overlay.querySelectorAll('[data-upload-type]').forEach(button => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        finish(button.dataset.uploadType);
      });
    });

    overlay.querySelector('#uploadTypeClose').addEventListener('click', () => finish(null));
    overlay.querySelector('#uploadTypeCancel').addEventListener('click', () => finish(null));
    overlay.addEventListener('click', event => {
      if (event.target === overlay) finish(null);
    });
    document.addEventListener('keydown', onKeyDown);

    const firstOption = overlay.querySelector('[data-upload-type]');
    if (firstOption) requestAnimationFrame(() => firstOption.focus());
  });
}

async function handleNativeFile(detail) {
  if (!detail) return;
  if (detail.error) {
    const { toast } = await import('./lib/utils.js');
    toast(detail.error, 6000);
    return;
  }
  if (!detail.url) return;

  const selectedType = await pickExternalContentType(
    detail.name || 'book',
    detail.type || ''
  );

  if (!selectedType) return;

  try {
    const url = Capacitor.convertFileSrc(detail.url);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not open the selected file.');

    const blob = await response.blob();
    const type = detail.type || blob.type || 'application/octet-stream';
    const file = new File([blob], detail.name || 'book', { type });

    // External Android imports must use the user's explicit choice, not the
    // last type selected in the desktop Library uploader. Reset immediately
    // afterwards so normal desktop/mobile uploads keep their existing state.
    setUploadContentType(selectedType);
    try {
      handleFile(file, {
        preferredTitle: detail.native ? detail.name : ''
      });
    } finally {
      setUploadContentType(CONTENT_TYPES.BOOK);
    }
  } catch (e) {
    const { toast } = await import('./lib/utils.js');
    toast(e?.message || 'Could not open the selected file.', 6000);
  }
}

window.addEventListener('inkworlds-native-file', e => {
  handleNativeFile(e.detail);
});

// Native Android waits for this flag before dispatching a file opened via
// ACTION_VIEW. This avoids losing the event during a cold start while main.js
// is still being evaluated.
window.__inkworldsNativeReady = true;

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

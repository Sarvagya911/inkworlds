// Entry point: loads styles, wires start-up behaviour, then hands off to the router.

import './styles/index.css';

// Reader modules that only attach event listeners
// (the rest are pulled in by the router)
import './reader/controls.js';
import './reader/companion.js';

import { addFile } from './app/books.js';
import { addEpubFile } from './app/epub-books.js';
import {
  renderAccountChip,
  route
} from './app/router.js';

import {
  syncProgressDown
} from './app/sync.js';

import {
  initAuth,
  onAuthChange
} from './auth/session.js';

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

function handleFile(file) {
  if (!file) return;
  if (/\.epub$/i.test(file.name) || file.type === 'application/epub+zip') {
    addEpubFile(file);
    return;
  }
  addFile(file);
}

$('fileIn').addEventListener(
  'change',
  e => {
    const f = e.target.files[0];

    e.target.value = '';

    handleFile(f);
  }
);

let dragDepth = 0;

addEventListener(
  'dragenter',
  e => {
    if (cur) return;

    if (
      [
        ...(e.dataTransfer?.types || [])
      ].includes('Files')
    ) {
      dragDepth++;

      $('dropVeil').hidden =
        false;

      e.preventDefault();
    }
  }
);

addEventListener(
  'dragover',
  e => {
    if (!cur) {
      e.preventDefault();
    }
  }
);

addEventListener(
  'dragleave',
  () => {
    dragDepth =
      Math.max(
        0,
        dragDepth - 1
      );

    if (!dragDepth) {
      $('dropVeil').hidden =
        true;
    }
  }
);

addEventListener(
  'drop',
  e => {
    if (cur) return;

    e.preventDefault();

    dragDepth = 0;

    $('dropVeil').hidden =
      true;

    const f =
      e.dataTransfer?.files?.[0];

    if (f) {
      handleFile(f);
    }
  }
);

if (
  navigator.storage &&
  navigator.storage.persist
) {
  navigator.storage
    .persist()
    .catch(() => {});
}

onAuthChange(
  async u => {
    renderAccountChip();

    if (u) {
      const saved =
        session.profile &&
        session.profile.prefs;

      if (
        saved &&
        Object.keys(saved).length
      ) {
        Object.assign(
          prefs,
          saved
        );

        savePrefs();

        applyUiTheme();
      }

      // Cloud sync is secondary to making the app usable.
      // Never let a network outage block the local app shell.
      syncProgressDown().catch(() => {});

      // While online, take a complete snapshot of the user's library,
      // progress, stats, highlights and bookmarks for the next offline run.
      if (navigator.onLine !== false) {
        primeOfflineCache().catch(() => {});
      }
    }

    if (
      started &&
      !cur
    ) {
      route();
    }
  }
);

let started = false;

(async () => {
  await initNativeApp();

  // Render immediately from local assets/state. Auth and cloud data
  // are allowed to finish in the background so offline startup works.
  started = true;
  renderAccountChip();
  route();

  initAuth().catch(() => {});
})();
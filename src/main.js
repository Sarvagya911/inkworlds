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
import { setUploadContentType } from './app/upload.js';
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

function looksLikeTransportName(name) {
  const base = (name || '')
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[{}]/g, '');

  return /^(?:book|untitled book)$/i.test(base)
    || /^[0-9a-f]{8}[- ]?[0-9a-f]{4}[- ]?[0-9a-f]{4}[- ]?[0-9a-f]{4}[- ]?[0-9a-f]{12}$/i.test(base)
    || /^(?:DOC|DOCUMENT|IMG|WA)[ _-]?\d+/i.test(base);
}

function usablePdfTitle(title) {
  const value = (title || '').replace(/\s+/g, ' ').trim();
  if (value.length < 3 || value.length > 160) return '';
  if (/\.pdf$/i.test(value)) return value.replace(/\.pdf$/i, '').trim();
  if (/^(?:untitled|microsoft|document|img|wa|doc(?:ument)?)(?:[ _-]*\d+.*)?$/i.test(value)) return '';
  if (looksLikeTransportName(value)) return '';
  return value;
}

async function inferPdfTitle(blob) {
  try {
    const { loadPdfJs } = await import('./engine/parser/pdf.js');
    await loadPdfJs();

    const pdf = await window.pdfjsLib.getDocument({
      data: new Uint8Array(await blob.arrayBuffer()),
      isEvalSupported: false
    }).promise;

    try {
      const metadata = await pdf.getMetadata();
      const info = metadata?.info || {};
      const xmpTitle = (() => {
        try {
          const value = metadata?.metadata?.get?.('dc:title');
          if (typeof value === 'string') return value;
          if (value && typeof value === 'object') return value['rdf:li'] || value['@value'] || '';
        } catch (_) {}
        return '';
      })();

      const metadataTitle = usablePdfTitle(info.Title) || usablePdfTitle(xmpTitle);
      if (metadataTitle) return metadataTitle;

      const maxPages = Math.min(pdf.numPages, 8);
      let best = null;

      const isBadTitleLine = text =>
        /^(?:to|for)\s+(?:my|the|a|an|all|you)\b/i.test(text)
        || /^dedicated\s+to\b/i.test(text)
        || /^in\s+memory\s+of\b/i.test(text)
        || /^because\s+you\b/i.test(text)
        || /^this\s+(?:book|story)\s+(?:is|was)\b/i.test(text)
        || /^(?:contents|table of contents|copyright|isbn|published by|printed in|first edition|second edition|third edition)$/i.test(text);

      const cleanCandidate = text => {
        const value = usablePdfTitle(text);
        if (!value || isBadTitleLine(value)) return '';
        if (/^(?:chapter|part|volume|prologue|epilogue)\b/i.test(value)) return '';
        if (/^\d{1,4}$/.test(value)) return '';
        return value;
      };

      for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        try {
          const tc = await page.getTextContent();
          const lines = [];
          let current = null;

          const flush = () => {
            if (!current || !current.text.trim()) return;
            current.text = current.text.replace(/\s+/g, ' ').trim();
            lines.push(current);
            current = null;
          };

          for (const item of tc.items || []) {
            if (typeof item.str !== 'string' || !item.str.trim()) continue;
            const x = item.transform?.[4] || 0;
            const y = item.transform?.[5] || 0;
            const h = Math.abs(item.transform?.[3] || item.height || 10);

            if (current && Math.abs(y - current.y) > h * 0.45) flush();
            if (!current) current = { text: '', x, y, maxH: h, endX: x };

            if (
              current.text &&
              !/\s$/.test(current.text) &&
              !/^\s/.test(item.str) &&
              x - current.endX > h * 0.15
            ) current.text += ' ';

            current.text += item.str;
            current.endX = Math.max(current.endX, x + (item.width || 0));
            current.maxH = Math.max(current.maxH, h);
          }
          flush();

          // Many ebook PDFs put the real title immediately before a copyright
          // notice. Prefer that deterministic signal over a large dedication.
          for (let i = 0; i < lines.length; i++) {
            const raw = lines[i].text;
            const copyrightIndex = raw.search(/\bcopyright\b/i);

            if (copyrightIndex > 0) {
              const candidate = cleanCandidate(raw.slice(0, copyrightIndex));
              if (candidate && candidate.split(/\s+/).length >= 2) return candidate;
            }

            if (copyrightIndex >= 0) {
              for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
                const candidate = cleanCandidate(lines[j].text);
                if (candidate && candidate.split(/\s+/).length >= 2) return candidate;
              }
            }
          }

          for (const line of lines) {
            const text = cleanCandidate(line.text);
            if (!text) continue;

            let score = line.maxH * 10;
            if (pageNumber <= 2) score += 10;
            if (pageNumber === 1) score += 4;
            if (text.length >= 5 && text.length <= 70) score += 5;
            if (text.split(/\s+/).length >= 2) score += 3;
            if (/^[A-Z0-9 .,'’'&-]+$/.test(text)) score += 2;
            if (/[.!?]$/.test(text)) score -= 12;
            if (text.split(/\s+/).length > 12) score -= 15;
            if (/\b(?:because|when|while|although|really|very|please)\b/i.test(text)) score -= 8;

            if (!best || score > best.score) best = { score, text };
          }
        } finally {
          page.cleanup();
        }
      }

      return best?.text || '';
    } finally {
      await pdf.destroy();
    }
  } catch (_) {
    return '';
  }
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
    let importName = detail.name || 'book';

    // WhatsApp/Android providers can expose a transport UUID instead of the
    // real filename. MainActivity intentionally sanitizes that case to "book",
    // so treat that fallback as a transport name too. For PDFs, recover the
    // title from embedded metadata or the document's title page before handing
    // the file to the normal importer.
    if (type === 'application/pdf' && looksLikeTransportName(importName)) {
      const inferredTitle = await inferPdfTitle(blob);
      if (inferredTitle) importName = `${inferredTitle}.pdf`;
      else importName = 'Untitled Book.pdf';
    }

    const file = new File([blob], importName, { type });
    const isEpub = /\.epub$/i.test(file.name) || file.type === 'application/epub+zip';

    // External Android imports use the user's explicit choice. Keep it selected
    // until the asynchronous import finishes, then restore the normal default.
    setUploadContentType(selectedType);
    try {
      if (isEpub) {
        await addEpubFile(file);
      } else {
        await addFile(file);
      }
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

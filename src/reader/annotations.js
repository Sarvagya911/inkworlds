// Text selection, highlights, notes and bookmarks.
import { fail, signedIn } from '../app/helpers.js';
import { $, clamp, toast } from '../lib/utils.js';
import { commentsEnabled, openPcSheet } from './passage-comments.js';
import { paintHighlight, unpaintHighlight } from './highlight-paint.js';
import { probeEl } from './position.js';
import { cur } from './reader.js';
import * as cloud from '../services/index.js';

export let selInfo = null,
  selT = 0;

export function hideSelPop() {
  $('selpop').hidden = true;
  selInfo = null;
}

document.addEventListener('selectionchange', () => {
  clearTimeout(selT);
  selT = setTimeout(checkSelection, 280);
});

export function checkSelection() {
  if (!cur) return;
  const sel = getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) {
    hideSelPop();
    return;
  }
  const range = sel.getRangeAt(0),
    text = range.toString().replace(/\s+/g, ' ').trim();
  const host = n => {
    let e = n.nodeType === 1 ? n : n.parentElement;
    while (e && !(e.dataset && e.dataset.si != null)) e = e.parentElement;
    return e;
  };
  const a = host(range.startContainer),
    b = host(range.endContainer);
  if (!a || a !== b || !text || text.length < 2 || !$('pages').contains(a)) {
    hideSelPop();
    return;
  }
  const pre = document.createRange();
  pre.selectNodeContents(a);
  pre.setEnd(range.startContainer, range.startOffset);
  const raw = range.toString();
  let start = pre.toString().length + (raw.length - raw.trimStart().length);
  const end = start + raw.trim().length;
  selInfo = {
    ch: +a.closest('.chapter').dataset.ch,
    si: +a.dataset.si,
    start,
    end,
    text: a.textContent.slice(start, end)
  };
  $('cmtBtn').hidden = !commentsEnabled();
  const rect = range.getBoundingClientRect(),
    pop = $('selpop');
  pop.hidden = false;
  const pw = pop.offsetWidth,
    top = rect.top > 70 ? rect.top - pop.offsetHeight - 8 : rect.bottom + 8;
  pop.style.top = Math.max(8, top) + 'px';
  pop.style.left = clamp(rect.left + rect.width / 2 - pw / 2, 8, innerWidth - pw - 8) + 'px';
}

export async function saveHighlight(note) {
  if (!selInfo || !cur) return;
  if (!signedIn()) {
    hideSelPop();
    toast('Sign in to save highlights and notes.');
    return;
  }
  try {
    const h = await cloud.addHighlight({
      bookId: cur.meta.id,
      ch: selInfo.ch,
      si: selInfo.si,
      start: selInfo.start,
      end: selInfo.end,
      text: selInfo.text,
      note,
      chTitle: cur.chapters[selInfo.ch].title
    });
    cur.hls.push(h);
    paintHighlight(h);
    getSelection().removeAllRanges();
    hideSelPop();
  } catch (e) {
    fail(e);
  }
}

['hlBtn', 'noteBtn', 'cmtBtn'].forEach(id => $(id).addEventListener('mousedown', e => e.preventDefault()));

$('hlBtn').addEventListener('click', () => saveHighlight(''));

export let noteCtx = null;

$('noteBtn').addEventListener('click', () => {
  if (!selInfo) return;
  if (!signedIn()) {
    hideSelPop();
    toast('Sign in to save highlights and notes.');
    return;
  }
  noteCtx = { mode: 'new', sel: { ...selInfo } };
  $('noteTitle').textContent = 'Add a note';
  $('noteQuote').textContent = '“' + selInfo.text.slice(0, 200) + '”';
  $('noteText').value = '';
  $('noteDel').hidden = true;
  hideSelPop();
  $('noteDlg').showModal();
  $('noteText').focus();
});

$('pages').addEventListener('click', e => {
  const badge = e.target.closest('.pc');
  if (badge) {
    e.stopPropagation();
    openPcSheet(badge.dataset.k, '');
    return;
  }
  const m = e.target.closest('mark.hl');
  if (!m || !getSelection().isCollapsed) return;
  const h = cur.hls.find(x => x.id === m.dataset.hid);
  if (!h) return;
  noteCtx = { mode: 'edit', h };
  $('noteTitle').textContent = 'Highlight';
  $('noteQuote').textContent = '“' + h.text.slice(0, 200) + '”';
  $('noteText').value = h.note || '';
  $('noteDel').hidden = false;
  $('noteDlg').showModal();
});

$('noteCancel').addEventListener('click', () => $('noteDlg').close());

$('noteSave').addEventListener('click', async () => {
  const txt = $('noteText').value.trim();
  if (noteCtx && noteCtx.mode === 'new') {
    selInfo = noteCtx.sel;
    await saveHighlight(txt);
  } else if (noteCtx && noteCtx.mode === 'edit') {
    const h = noteCtx.h;
    try {
      await cloud.updateHighlight(h.id, txt);
      h.note = txt;
      unpaintHighlight(h.id);
      paintHighlight(h);
    } catch (e) {
      fail(e);
    }
  }
  $('noteDlg').close();
  noteCtx = null;
});

$('noteDel').addEventListener('click', async () => {
  if (!noteCtx || noteCtx.mode !== 'edit') return;
  const h = noteCtx.h;
  try {
    await cloud.deleteHighlight(h.id);
    cur.hls = cur.hls.filter(x => x.id !== h.id);
    unpaintHighlight(h.id);
    toast('Highlight removed.');
  } catch (e) {
    fail(e);
  }
  $('noteDlg').close();
  noteCtx = null;
});

$('markBtn').addEventListener('click', async () => {
  if (!cur) return;
  if (!signedIn()) {
    toast('Sign in to save bookmarks.');
    return;
  }
  const el = probeEl(),
    ch = Math.max(0, cur.ci),
    si = el ? +el.dataset.si : 0;
  if (cur.marks.some(m => m.ch === ch && m.si === si)) {
    toast('This spot is already bookmarked.');
    return;
  }
  const text = (el ? el.textContent : cur.chapters[ch].paras[0] || '').replace(/\s+/g, ' ').trim();
  try {
    cur.marks.push(
      await cloud.addBookmark({
        bookId: cur.meta.id,
        ch,
        si,
        snippet: text.slice(0, 90) + (text.length > 90 ? '…' : '')
      })
    );
    toast('Bookmarked. Find it under Contents.');
  } catch (e) {
    fail(e);
  }
});

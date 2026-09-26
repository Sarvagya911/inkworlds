// Comments on individual passages of public books.
import { ago, avatarURL, errMsg, fail, nameOf, nl, signedIn, ts } from '../app/helpers.js';
import { $, esc } from '../lib/utils.js';
import { hideSelPop, selInfo } from './annotations.js';
import { closePanels, cur } from './reader.js';
import { paraEl } from './render.js';
import * as cloud from '../services/index.js';
import { myId } from '../services/session.js';
import { supabase } from '../services/supabase.js';

export let passage = new Map(),
  passUnsub = null,
  pcKey = null,
  pcQuote = '';

export const commentsEnabled = () => !!supabase && !!cur && cur.meta.visibility === 'public';

export async function startPassageComments() {
  if (!commentsEnabled()) return;
  const id = cur.meta.id;
  try {
    const rows = await cloud.passageCounts(id);
    if (!cur || cur.meta.id !== id) return;
    passage = new Map();
    rows.forEach(r => {
      const k = r.ch + ':' + r.si;
      if (!passage.has(k)) passage.set(k, new Set());
      passage.get(k).add(r.id);
    });
    paintBadges();
  } catch (e) {}
  passUnsub = cloud.watchComments('book_id', id, c => {
    if (!cur || cur.meta.id !== id || c.target_type !== 'para') return;
    const k = c.ch + ':' + c.si;
    if (!passage.has(k)) passage.set(k, new Set());
    passage.get(k).add(c.id);
    paintBadges();
    if (!$('pcSheet').hidden && pcKey === k) drawPcSheet();
  });
}

export function stopPassageComments() {
  if (passUnsub) {
    passUnsub();
    passUnsub = null;
  }
  passage = new Map();
  pcKey = null;
}

export const ICON_CMT =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/></svg>';

export function paintBadges() {
  document.querySelectorAll('#pages .pc').forEach(b => b.remove());
  for (const [k, set] of passage) {
    if (!set.size) continue;
    const [ch, si] = k.split(':'),
      el = paraEl(ch, si);
    if (!el) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pc';
    b.dataset.k = k;
    b.dataset.n = set.size;
    b.setAttribute('aria-label', `${set.size} comment${set.size === 1 ? '' : 's'} on this passage`);
    b.innerHTML = ICON_CMT;
    el.appendChild(b);
  }
}

export function openPcSheet(k, quote) {
  pcKey = k;
  pcQuote = quote || '';
  closePanels();
  $('pcSheet').hidden = false;
  $('scrim').hidden = false;
  $('pcText').value = '';
  $('pcPost').hidden = !signedIn();
  $('pcText').parentElement.hidden = !signedIn();
  $('pcNote').innerHTML = signedIn()
    ? 'Everyone reading this book can see passage comments.'
    : '<a href="#/signin" data-remember>Sign in</a> to add a comment.';
  drawPcSheet();
  if (signedIn()) $('pcText').focus();
}

export async function drawPcSheet() {
  const [ch, si] = pcKey.split(':').map(Number);
  $('pcList').innerHTML = '<p class="why">Loading…</p>';
  let list = [];
  try {
    list = await cloud.comments({ bookId: cur.meta.id, type: 'para', ch, si });
  } catch (e) {
    $('pcList').innerHTML = `<p class="why">${esc(errMsg(e))}</p>`;
    return;
  }
  const q = pcQuote || (list.find(c => c.quote) || {}).quote || '';
  $('pcQuote').hidden = !q;
  $('pcQuote').textContent = q ? '“' + q.slice(0, 240) + (q.length > 240 ? '…' : '') + '”' : '';
  const ppl = await cloud.profiles(list.map(c => c.author_id));
  $('pcList').innerHTML = list.length
    ? list
        .map(
          c => `<div class="cmt"><img src="${esc(avatarURL(ppl[c.author_id]))}" alt="" referrerpolicy="no-referrer"><div><div class="cn"><b>${esc(nameOf(ppl, c.author_id))}</b><span>${ago(ts(c.created_at))}</span></div>
    ${c.quote && c.quote !== q ? `<div class="cq">“${esc(c.quote.slice(0, 120))}”</div>` : ''}<div class="cbody">${nl(c.body)}</div>${c.author_id === myId() || cur.meta.own ? `<div class="cacts"><button type="button" data-pcdel="${esc(c.id)}">Delete</button></div>` : ''}</div></div>`
        )
        .join('')
    : '<p class="why">No comments on this passage yet.</p>';
}

$('pcList').addEventListener('click', async e => {
  const d = e.target.closest('[data-pcdel]');
  if (!d) return;
  try {
    await cloud.deleteComment(d.dataset.pcdel);
    const s = passage.get(pcKey);
    if (s) s.delete(d.dataset.pcdel);
    paintBadges();
    drawPcSheet();
  } catch (err) {
    fail(err);
  }
});

$('pcPost').addEventListener('click', async () => {
  const body = $('pcText').value.trim();
  if (!body || !pcKey || !cur) {
    $('pcText').focus();
    return;
  }
  const [ch, si] = pcKey.split(':').map(Number),
    btn = $('pcPost');
  btn.disabled = true;
  try {
    const c = await cloud.addComment({ type: 'para', bookId: cur.meta.id, ch, si, quote: pcQuote, body });
    if (!passage.has(pcKey)) passage.set(pcKey, new Set());
    passage.get(pcKey).add(c.id);
    paintBadges();
    $('pcText').value = '';
    pcQuote = '';
    drawPcSheet();
  } catch (e) {
    fail(e);
  } finally {
    btn.disabled = false;
  }
});

$('cmtBtn').addEventListener('click', () => {
  if (!selInfo) return;
  const k = selInfo.ch + ':' + selInfo.si,
    q = selInfo.text;
  getSelection().removeAllRanges();
  hideSelPop();
  openPcSheet(k, q);
});

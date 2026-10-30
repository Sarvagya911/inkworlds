// Public books, with search, world filter, content-type filter and paging.
import { app, errMsg } from '../app/helpers.js';
import { routeId } from '../app/router.js';
import { bookCard } from '../components/book-card.js';
import { CONTENT_TYPES } from '../services/books.js';
import { THEMES } from '../config/themes.js';
import { $, esc } from '../lib/utils.js';
import * as cloud from '../services/index.js';
import { supabase } from '../services/supabase.js';

const TYPE_TABS = [
  { id: '', label: 'All' },
  { id: CONTENT_TYPES.BOOK, label: 'Novels' },
  { id: CONTENT_TYPES.LIGHT_NOVEL, label: 'Light Novels' },
  { id: CONTENT_TYPES.MANGA, label: 'Manga' }
];

function offlineMessage() {
  $('dg').innerHTML = `<div class="empty-box" style="grid-column:1/-1">Discover needs an internet connection to load public books. Your downloaded and local books are still available from your library.</div>`;
  $('dinfo').textContent = '';
  $('more').hidden = true;
}

export async function viewDiscover() {
  const rid = routeId;

  app.innerHTML = `
    <section class="view">
      <h1 class="page-title">Discover</h1>
      <p class="lede">Books readers have made public. Open one to read it in its world and join the conversation in its margins. No account needed to read.</p>
      <div class="content-tabs" role="tablist" aria-label="Content type">
        ${TYPE_TABS.map(tab => `<button type="button" role="tab" data-content-type="${esc(tab.id)}" aria-selected="${tab.id === ''}">${esc(tab.label)}</button>`).join('')}
      </div>
      <div class="lib-tools">
        <input class="input" id="dq" type="search" placeholder="Search by title or author" aria-label="Search shared books">
        <select class="input" id="dw" aria-label="Filter by world" style="flex:0 1 14rem">
          <option value="">All worlds</option>
          ${Object.entries(THEMES).map(([k, t]) => `<option value="${esc(k)}">${esc(t.name)}</option>`).join('')}
        </select>
      </div>
      <p class="muted" style="margin:.4rem 0 0;font-size:.92rem">To share one of your own books, open it from your <a href="#/library">library</a> and choose Make public.</p>
      <div class="bgrid" id="dg"></div>
      <div class="actions" style="justify-content:center;margin-top:1.4rem"><button class="btn ghost" id="more" type="button" hidden>Show more</button></div>
      <p class="muted" id="dinfo" style="text-align:center"></p>
    </section>
  `;

  if (!supabase) {
    $('dg').innerHTML = `<div class="empty-box" style="grid-column:1/-1">${esc(errMsg({ code: 'not_configured' }))}</div>`;
    return;
  }

  let page = 0;
  let items = [];
  let seq = 0;
  let contentType = '';
  let offline = false;

  const tabs = document.querySelectorAll('[data-content-type]');

  const load = async reset => {
    if (navigator.onLine === false) {
      offline = true;
      offlineMessage();
      return;
    }

    offline = false;
    const my = ++seq;

    if (reset) {
      page = 0;
      items = [];
    }

    $('dinfo').textContent = 'Loading…';

    try {
      const request = cloud.publicBooks({
        q: $('dq').value,
        world: $('dw').value,
        contentType,
        page
      });
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Discover timed out')), 3500)
      );
      const { items: got, total } = await Promise.race([request, timeout]);

      if (my !== seq || rid !== routeId) return;

      items = items.concat(got);
      const ppl = await Promise.race([
        cloud.profiles(items.map(b => b.ownerId)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Profile lookup timed out')), 3500))
      ]);

      if (my !== seq || rid !== routeId) return;

      const showContentType = contentType === '';
      $('dg').innerHTML = items.length
        ? items.map(b => bookCard(b, ppl, showContentType)).join('')
        : `<div class="empty-box" style="grid-column:1/-1">No shared titles match. Try another search or filter.</div>`;
      $('more').hidden = items.length >= total;
      $('dinfo').textContent = total ? `Showing ${items.length} of ${total}` : '';
    } catch (e) {
      if (my !== seq || rid !== routeId) return;
      offline = true;
      offlineMessage();
    }
  };

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      contentType = btn.dataset.contentType || '';
      tabs.forEach(tab => tab.setAttribute('aria-selected', String(tab === btn)));
      load(true);
    });
  });

  let t = 0;
  $('dq').addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => load(true), 300);
  });
  $('dw').addEventListener('change', () => load(true));
  $('more').addEventListener('click', () => {
    page++;
    load(false);
  });

  addEventListener('online', () => {
    if (offline && location.hash === '#/discover') load(true);
  }, { once: true });

  load(true);
}

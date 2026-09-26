// Public books, with search, world filter and paging.
import { app, errMsg } from '../app/helpers.js';
import { routeId } from '../app/router.js';
import { bookCard } from '../components/book-card.js';
import { THEMES } from '../config/themes.js';
import { $, esc } from '../lib/utils.js';
import * as cloud from '../services/index.js';
import { supabase } from '../services/supabase.js';

export async function viewDiscover() {
  const rid = routeId;
  app.innerHTML = `<section class="view"><h1 class="page-title">Discover</h1>
    <p class="lede">Books readers have made public. Open one to read it in its world and join the conversation in its margins. No account needed to read.</p>
    <div class="lib-tools"><input class="input" id="dq" type="search" placeholder="Search by title or author" aria-label="Search shared books">
    <select class="input" id="dw" aria-label="Filter by world" style="flex:0 1 14rem"><option value="">All worlds</option>${Object.entries(
      THEMES
    )
      .map(([k, t]) => `<option value="${k}">${esc(t.name)}</option>`)
      .join('')}</select></div>
    <p class="muted" style="margin:.4rem 0 0;font-size:.92rem">To share one of your own books, open it from your <a href="#/library">library</a> and choose Make public.</p>
    <div class="bgrid" id="dg"></div><div class="actions" style="justify-content:center;margin-top:1.4rem"><button class="btn ghost" id="more" type="button" hidden>Show more</button></div>
    <p class="muted" id="dinfo" style="text-align:center"></p></section>`;
  if (!supabase) {
    $('dg').innerHTML =
      `<div class="empty-box" style="grid-column:1/-1">${esc(errMsg({ code: 'not_configured' }))}</div>`;
    return;
  }
  let page = 0,
    items = [],
    seq = 0;
  const load = async reset => {
    const my = ++seq;
    if (reset) {
      page = 0;
      items = [];
    }
    $('dinfo').textContent = 'Loading…';
    try {
      const { items: got, total } = await cloud.publicBooks({ q: $('dq').value, world: $('dw').value, page });
      if (my !== seq || rid !== routeId) return;
      items = items.concat(got);
      const ppl = await cloud.profiles(items.map(b => b.ownerId));
      if (my !== seq || rid !== routeId) return;
      $('dg').innerHTML = items.length
        ? items.map(b => bookCard(b, ppl)).join('')
        : `<div class="empty-box" style="grid-column:1/-1">No shared books match. Try another search or world.</div>`;
      $('more').hidden = items.length >= total;
      $('dinfo').textContent = total ? `Showing ${items.length} of ${total}` : '';
    } catch (e) {
      $('dinfo').textContent = errMsg(e);
    }
  };
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
  load(true);
}

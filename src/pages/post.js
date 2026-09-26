// A single discussion with its comments.
import { ago, app, enc, errMsg, fail, nl, ts, whoHTML } from '../app/helpers.js';
import { routeId } from '../app/router.js';
import { mountThread } from '../components/comment-thread.js';
import { $, esc } from '../lib/utils.js';
import * as cloud from '../services/index.js';
import { myId } from '../services/session.js';
import { supabase } from '../services/supabase.js';

export async function viewPost(cid, pid) {
  const rid = routeId;
  app.innerHTML = `<section class="view"><div id="pv"><p class="muted">Loading discussion…</p></div></section>`;
  if (!supabase) {
    $('pv').innerHTML = `<div class="empty-box">${esc(errMsg({ code: 'not_configured' }))}</div>`;
    return;
  }
  let c = null,
    p = null;
  try {
    [c, p] = await Promise.all([cloud.community(cid), cloud.post(pid)]);
  } catch (e) {}
  if (rid !== routeId) return;
  if (!c || !p) {
    $('pv').innerHTML =
      `<h1 class="page-title">Discussion not found</h1><p class="lede">It may have been deleted.</p><a class="btn" href="#/c/${enc(cid)}">Back to the community</a>`;
    return;
  }
  document.title = p.title + ' · Inkworlds';
  const ppl = await cloud.profiles([p.author_id]);
  if (rid !== routeId) return;
  const canDelete = p.author_id === myId() || c.owner_id === myId();
  $('pv').innerHTML = `<p style="margin:0"><a href="#/c/${enc(cid)}">${esc(c.name)}</a></p>
    <article class="post-full"><h1 class="page-title" style="font-size:clamp(1.8rem,4.5vw,2.6rem)">${esc(p.title)}</h1>
      <div class="meta">${whoHTML(ppl, p.author_id)}<span>${ago(ts(p.created_at))}</span>${p.book ? `<a class="pill" href="#/book/${enc(p.book.id)}">${esc(p.book.title)}</a>` : ''}
      ${canDelete ? '<button class="btn ghost small" id="delPost" type="button">Delete discussion</button>' : ''}</div>
      ${p.body ? `<div class="pb">${nl(p.body)}</div>` : ''}</article>
    <div class="sub-block"><h2>Comments</h2><div id="postThread"></div></div>`;
  mountThread($('postThread'), { postId: pid });
  const dp = $('delPost');
  if (dp)
    dp.addEventListener('click', async () => {
      if (!confirm('Delete this discussion and its comments?')) return;
      try {
        await cloud.deletePost(pid);
        location.hash = '#/c/' + enc(cid);
      } catch (e) {
        fail(e);
      }
    });
}

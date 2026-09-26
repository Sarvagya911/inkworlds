// Threaded comments with replies and live updates (books and discussions).
import { ago, avatarURL, errMsg, fail, nameOf, nl, signedIn, ts } from '../app/helpers.js';
import { subs } from '../app/router.js';
import { esc } from '../lib/utils.js';
import * as cloud from '../services/index.js';
import { myId } from '../services/session.js';

export function mountThread(el, o) {
  let list = [],
    replyTo = null;
  el.innerHTML = `<div class="thread" aria-live="polite"><p class="muted">Loading comments…</p></div>
    ${
      signedIn()
        ? `<div class="form"><label>Your comment<textarea class="input" maxlength="2000" placeholder="Share a thought…"></textarea></label>
      <div class="actions"><span class="muted replying" hidden></span><button class="btn small post" type="button">Post comment</button></div></div>`
        : `<p class="muted"><a href="#/signin" data-remember>Sign in</a> to join the conversation.</p>`
    }`;
  const th = el.querySelector('.thread'),
    ta = el.querySelector('textarea'),
    rp = el.querySelector('.replying'),
    pb = el.querySelector('.post');
  const draw = async () => {
    const ppl = await cloud.profiles(list.map(c => c.author_id));
    const top = list.filter(c => !c.parent_id),
      kids = id => list.filter(c => c.parent_id === id);
    const one =
      c => `<div class="cmt"><img src="${esc(avatarURL(ppl[c.author_id]))}" alt="" referrerpolicy="no-referrer"><div><div class="cn"><b>${esc(nameOf(ppl, c.author_id))}</b><span>${ago(ts(c.created_at))}</span></div>
      <div class="cbody">${nl(c.body)}</div><div class="cacts">${!c.parent_id && signedIn() ? `<button type="button" data-reply="${esc(c.id)}">Reply</button>` : ''}${c.author_id === myId() ? `<button type="button" data-cdel="${esc(c.id)}">Delete</button>` : ''}</div>
      ${!c.parent_id && kids(c.id).length ? `<div class="replies">${kids(c.id).map(one).join('')}</div>` : ''}</div></div>`;
    th.innerHTML = top.length
      ? top.map(one).join('')
      : `<p class="muted">No comments yet. Start the conversation.</p>`;
  };
  const q = o.postId ? { postId: o.postId } : { bookId: o.bookId, type: o.type };
  cloud
    .comments(q)
    .then(r => {
      list = r;
      draw();
    })
    .catch(e => {
      th.innerHTML = `<p class="muted">${esc(errMsg(e))}</p>`;
    });
  subs.push(
    cloud.watchComments(o.postId ? 'post_id' : 'book_id', o.postId || o.bookId, c => {
      if (o.postId || c.target_type === o.type) {
        if (!list.some(x => x.id === c.id)) {
          list.push(c);
          draw();
        }
      }
    })
  );
  th.addEventListener('click', async e => {
    const r = e.target.closest('[data-reply]'),
      d = e.target.closest('[data-cdel]');
    if (r && ta) {
      replyTo = r.dataset.reply;
      const c = list.find(x => x.id === replyTo),
        ppl = await cloud.profiles([c.author_id]);
      rp.hidden = false;
      rp.innerHTML = `Replying to ${esc(nameOf(ppl, c.author_id))} <button type="button" class="btn ghost small" style="margin-left:.4rem">Cancel</button>`;
      rp.querySelector('button').onclick = () => {
        replyTo = null;
        rp.hidden = true;
      };
      ta.focus();
    }
    if (d) {
      if (!confirm('Delete this comment?')) return;
      try {
        await cloud.deleteComment(d.dataset.cdel);
        list = list.filter(x => x.id !== d.dataset.cdel && x.parent_id !== d.dataset.cdel);
        draw();
      } catch (err) {
        fail(err);
      }
    }
  });
  if (pb)
    pb.addEventListener('click', async () => {
      const body = ta.value.trim();
      if (!body) {
        ta.focus();
        return;
      }
      pb.disabled = true;
      try {
        const c = await cloud.addComment({
          type: o.postId ? 'post' : o.type,
          bookId: o.bookId,
          postId: o.postId,
          body,
          parentId: replyTo
        });
        if (!list.some(x => x.id === c.id)) list.push(c);
        draw();
        ta.value = '';
        replyTo = null;
        rp.hidden = true;
      } catch (e) {
        fail(e);
      } finally {
        pb.disabled = false;
      }
    });
}

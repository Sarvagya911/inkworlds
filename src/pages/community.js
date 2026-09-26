// A community: discussions, shared books and members.
import { sampleMeta } from '../app/books.js';
import { ago, app, enc, errMsg, fail, nameOf, nl, signedIn, ts, whoHTML } from '../app/helpers.js';
import { routeId } from '../app/router.js';
import { rememberDestination } from '../auth/session.js';
import { bookCard } from '../components/book-card.js';
import { THEMES, fontStack } from '../config/themes.js';
import { SAMPLES } from '../content/samples.js';
import { mountMini } from '../engine/scenes/stage.js';
import { $, esc, toast } from '../lib/utils.js';
import * as cloud from '../services/index.js';
import { supabase } from '../services/supabase.js';

export async function viewCommunity(cid) {
  const rid = routeId;
  app.innerHTML = `<section class="view"><div id="cv"><p class="muted">Loading community…</p></div></section>`;
  if (!supabase) {
    $('cv').innerHTML = `<div class="empty-box">${esc(errMsg({ code: 'not_configured' }))}</div>`;
    return;
  }
  let c = null,
    mine = [];
  try {
    [c, mine] = await Promise.all([cloud.community(cid), cloud.myCommunityIds()]);
  } catch (e) {}
  if (rid !== routeId) return;
  if (!c) {
    $('cv').innerHTML =
      `<h1 class="page-title">Community not found</h1><p class="lede">It may have been deleted.</p><a class="btn" href="#/communities">See all communities</a>`;
    return;
  }
  document.title = c.name + ' · Inkworlds';
  const key = THEMES[c.theme] ? c.theme : 'parchment',
    th = THEMES[key];
  let member = mine.includes(cid),
    count = c.member_count,
    tab = 'talk',
    posts = [],
    page = 0,
    more = false,
    books = null,
    mems = null;
  $('cv').innerHTML =
    `<div class="banner"><canvas id="cBan" aria-hidden="true"></canvas><h1 class="bn" style="background:${th.panel};color:${th.accent};font-family:${esc(fontStack(th.title, 'title'))}">${esc(c.name)}</h1></div>
    <p class="lede" style="margin-top:1.2rem">${nl(c.description)}</p>
    <div class="actions"><button class="btn" id="joinBtn" type="button"></button><span class="muted" id="memCount"></span><span class="muted" id="startedBy"></span></div>
    <div class="ctabs" role="tablist"><button role="tab" data-ct="talk" aria-selected="true">Discussions</button><button role="tab" data-ct="books" aria-selected="false">Books</button><button role="tab" data-ct="people" aria-selected="false">Members</button></div>
    <div id="ctBody"></div>`;
  mountMini($('cBan'), key);
  const op = await cloud.profiles([c.owner_id]);
  if (rid !== routeId) return;
  $('startedBy').textContent = 'Started by ' + nameOf(op, c.owner_id);
  const drawJoin = () => {
    const jb = $('joinBtn');
    jb.textContent = !signedIn() ? 'Sign in to join' : member ? 'Leave community' : 'Join community';
    jb.classList.toggle('ghost', member);
    $('memCount').textContent = `${count} member${count === 1 ? '' : 's'}`;
  };
  drawJoin();
  $('joinBtn').addEventListener('click', async () => {
    if (!signedIn()) {
      rememberDestination(location.hash);
      location.hash = '#/signin';
      return;
    }
    const jb = $('joinBtn');
    jb.disabled = true;
    try {
      if (member) {
        await cloud.leaveCommunity(cid);
        member = false;
        count--;
      } else {
        await cloud.joinCommunity(cid);
        member = true;
        count++;
      }
      mems = null;
      drawJoin();
      if (tab !== 'books') drawTab();
    } catch (e) {
      fail(e);
    }
    jb.disabled = false;
  });
  const loadPosts = async reset => {
    if (reset) {
      page = 0;
      posts = [];
    }
    const got = await cloud.posts(cid, page);
    posts = posts.concat(got);
    more = got.length === 20;
  };
  const drawTab = async () => {
    const body = $('ctBody');
    if (!body) return;
    app
      .querySelectorAll('[data-ct]')
      .forEach(b => b.setAttribute('aria-selected', b.dataset.ct === tab ? 'true' : 'false'));
    if (tab === 'talk') {
      const ppl = await cloud.profiles(posts.map(p => p.author_id));
      if (tab !== 'talk' || rid !== routeId) return;
      let myShared = [];
      if (member) {
        try {
          myShared = (await cloud.myBooks()).filter(b => b.visibility === 'public');
        } catch (e) {}
      }
      const pick = [...SAMPLES.map(sampleMeta), ...myShared];
      body.innerHTML = `${
        !signedIn()
          ? `<p class="muted"><a href="#/signin" data-remember>Sign in</a> and join to start a discussion.</p>`
          : member
            ? `<details class="form" id="npWrap"><summary style="cursor:pointer;font-weight:500">Start a discussion</summary>
          <label>Title<input class="input" id="npTitle" maxlength="120" placeholder="Who do you think carried the thirteenth lantern?"></label>
          <label>What's on your mind?<textarea class="input" id="npBody" maxlength="4000"></textarea></label>
          <label>About a book (optional)<select class="input" id="npBook"><option value="">No book</option>${pick.map(b => `<option value="${esc(b.id)}">${esc(b.title)}</option>`).join('')}</select></label>
          <div class="actions"><button class="btn small" id="npPost" type="button">Post discussion</button></div></details>`
            : `<p class="muted">Join this community to start a discussion.</p>`
      }
        <div class="plist">${
          posts.length
            ? posts
                .map(
                  p => `<a class="post" href="#/c/${enc(cid)}/p/${enc(p.id)}"><h3>${esc(p.title)}</h3><p>${esc((p.body || '').slice(0, 220))}${(p.body || '').length > 220 ? '…' : ''}</p>
          <div class="meta">${whoHTML(ppl, p.author_id)}<span>${ago(ts(p.created_at))}</span><span>${p.comment_count} comment${p.comment_count === 1 ? '' : 's'}</span>${p.book ? `<span class="pill">${esc(p.book.title)}</span>` : ''}</div></a>`
                )
                .join('')
            : `<div class="empty-box">No discussions yet.${member ? ' Start the first one above.' : ''}</div>`
        }</div>
        ${more ? `<div class="actions" style="justify-content:center;margin-top:1rem"><button class="btn ghost" id="morePosts" type="button">Show older discussions</button></div>` : ''}`;
      const mp = $('morePosts');
      if (mp)
        mp.addEventListener('click', async () => {
          page++;
          await loadPosts(false);
          drawTab();
        });
      const pb = $('npPost');
      if (pb)
        pb.addEventListener('click', async () => {
          const title = $('npTitle').value.trim();
          if (title.length < 3) {
            toast('Give the discussion a title of at least 3 characters.');
            $('npTitle').focus();
            return;
          }
          pb.disabled = true;
          try {
            const p = await cloud.createPost({
              cid,
              title: title.slice(0, 120),
              body: $('npBody').value.trim().slice(0, 4000),
              bookId: $('npBook').value
            });
            location.hash = `#/c/${enc(cid)}/p/${enc(p.id)}`;
          } catch (e) {
            fail(e);
            pb.disabled = false;
          }
        });
    } else if (tab === 'books') {
      if (books === null) {
        body.innerHTML = '<p class="muted">Loading books…</p>';
        try {
          books = await cloud.communityBooks(cid);
        } catch (e) {
          books = [];
        }
        if (tab !== 'books' || rid !== routeId) return;
      }
      const ppl = await cloud.profiles(books.map(b => b.ownerId));
      if (tab !== 'books') return;
      body.innerHTML = books.length
        ? `<div class="bgrid">${books.map(b => bookCard(b, ppl)).join('')}</div>`
        : `<div class="empty-box">No books shared here yet. Members can add a public book to this community from the book's page.</div>`;
    } else {
      if (mems === null) {
        body.innerHTML = '<p class="muted">Loading members…</p>';
        try {
          mems = await cloud.members(cid);
        } catch (e) {
          mems = [];
        }
        if (tab !== 'people' || rid !== routeId) return;
      }
      const ppl = await cloud.profiles(mems.map(m => m.user_id));
      if (tab !== 'people') return;
      body.innerHTML = mems.length
        ? `<div class="plist" style="grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))">${mems.map(m => `<div class="post">${whoHTML(ppl, m.user_id)}<div class="meta" style="margin-top:.3rem">Joined ${ago(ts(m.joined_at))}</div></div>`).join('')}</div>`
        : `<div class="empty-box">No members yet.</div>`;
    }
  };
  app.querySelectorAll('[data-ct]').forEach(b =>
    b.addEventListener('click', () => {
      tab = b.dataset.ct;
      drawTab();
    })
  );
  try {
    await loadPosts(true);
  } catch (e) {}
  if (rid === routeId) drawTab();
}

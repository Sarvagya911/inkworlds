// Book page: details, mood timeline, sharing, likes and discussion.
import { getBook, saveMeta, themeOf } from '../app/books.js';
import { app, busy, enc, fail, nl, signedIn, whoHTML } from '../app/helpers.js';
import { route, routeId } from '../app/router.js';
import { progOf } from '../app/sync.js';
import { rememberDestination } from '../auth/session.js';
import { mountThread } from '../components/comment-thread.js';
import { THEMES, ensureFonts, fontStack } from '../config/themes.js';
import { chapterMood } from '../engine/parser/detect.js';
import { buildBlocks } from '../engine/parser/structure.js';
import { mountMini } from '../engine/scenes/stage.js';
import { $, esc, fmtMins, fmtNum, lsSet, toast, words } from '../lib/utils.js';
import * as cloud from '../services/index.js';
import { supabase } from '../services/supabase.js';

export async function viewBook(id) {
  const rid = routeId;
  app.innerHTML = `<section class="view"><p class="muted">Opening book…</p></section>`;
  let book = null;
  try {
    book = await getBook(id);
  } catch (e) {}
  if (rid !== routeId) return;
  if (!book) {
    app.innerHTML = `<section class="view"><h1 class="page-title">Book not found</h1><p class="lede">This book isn't in your library and isn't shared publicly. It may have been removed or made private.${signedIn() ? '' : " If it's yours, sign in to see it."}</p><a class="btn" href="#/library">Back to the library</a></section>`;
    return;
  }
  const { meta, chapters } = book,
    key = themeOf(meta),
    th = THEMES[key];
  ensureFonts([th.body]);
  document.title = meta.title + ' · Inkworlds';
  const moods = chapters.map(chapterMood),
    p = progOf(id) || {},
    pct = Math.round((p.pct || 0) * 100);
  const docs = { letter: 0, diary: 0, telegram: 0, news: 0 };
  chapters.forEach(ch =>
    buildBlocks(ch.paras).forEach(b => {
      if (b.kind === 'doc') docs[b.type]++;
    })
  );
  const mins = Math.max(1, Math.round(meta.words / 230));
  const why =
    meta.aiReason && meta.theme !== 'auto'
      ? 'Claude chose it: ' + meta.aiReason
      : meta.theme && meta.theme !== 'auto'
        ? 'You picked this world.'
        : meta.remote
          ? "The owner's choice of world."
          : meta.hits && meta.hits.length
            ? 'Picked from words like ' + meta.hits.map(h => '“' + h + '”').join(', ') + '.'
            : 'No strong clues in the text, so the classic look is used.';
  const labels = {
    letter: ['letter', 'letters'],
    diary: ['diary entry', 'diary entries'],
    telegram: ['telegram', 'telegrams'],
    news: ['newspaper cutting', 'newspaper cuttings']
  };
  const docHtml = Object.entries(docs)
    .filter(([, n]) => n)
    .map(([k, n]) => `<span>${n} ${labels[k][n === 1 ? 0 : 1]}</span>`)
    .join('');
  app.innerHTML = `<section class="view"><div class="book-grid">
    <div class="cover"><canvas id="coverCv" aria-hidden="true"></canvas><div class="ct" style="background:${th.panel};color:${th.text}"><div class="h" style="font-family:${esc(fontStack(th.title, 'title'))};color:${th.accent}">${esc(meta.title)}</div>${meta.author ? `<div class="a" style="font-family:${esc(fontStack(th.body, 'body'))}">${esc(meta.author)}</div>` : ''}</div></div>
    <div>
      <h1 class="page-title">${esc(meta.title)}</h1>
      ${meta.author ? `<p class="muted" style="margin:.3rem 0 0;font-size:1.1rem">${esc(meta.author)}</p>` : ''}
      <div class="actions" style="margin-top:1.3rem">
        <a class="btn" href="#/read/${enc(id)}">${pct ? 'Continue reading' : 'Start reading'}</a>
        <label class="muted" for="bookTheme" style="font-size:.95rem">World</label>
        <select class="input" id="bookTheme"><option value="auto">Automatic: ${esc(THEMES[meta.auto].name)}</option>${Object.entries(
          THEMES
        )
          .map(
            ([k, t]) => `<option value="${k}"${meta.theme === k ? ' selected' : ''}>${esc(t.name)}</option>`
          )
          .join('')}</select>
      </div>
      <p class="muted" style="font-size:.92rem;margin:.5rem 0 0">${esc(why)}</p>
      <div class="facts">
        <div><b>${pct}%</b><span>read</span></div>
        <div><b>${fmtNum(meta.words)}</b><span>words</span></div>
        <div><b>${chapters.length}</b><span>chapters</span></div>
        <div><b>${fmtMins(mins * 60)}</b><span>to read at 230 words a minute</span></div>
        ${meta.visibility === 'public' ? `<div><b>${meta.likeCount}</b><span>like${meta.likeCount === 1 ? '' : 's'}</span></div><div><b>${meta.commentCount}</b><span>comment${meta.commentCount === 1 ? '' : 's'}</span></div>` : ''}
      </div>
      <div class="sub-block" style="margin-top:0"><h2>How the story feels</h2>
        <div class="moodline" role="list">${chapters.map((c, i) => `<a role="listitem" href="#/read/${enc(id)}" data-ch="${i}" class="m-${moods[i].label}" style="flex-grow:${Math.max(1, words(c.paras.join(' ')))}" title="${esc(c.title)}: ${moods[i].label}" aria-label="${esc(c.title)}, ${moods[i].label}"></a>`).join('')}</div>
        <div class="legend"><span><i class="m-stormy"></i>Stormy</span><span><i class="m-dark"></i>Dark</span><span><i class="m-bright"></i>Bright</span><span><i class="m-calm"></i>Calm</span></div></div>
      <div class="sub-block"><h2>Documents found in the story</h2>
        ${docHtml ? `<div class="docs">${docHtml}</div><p class="muted" style="font-size:.92rem">These appear as handwritten letters, lined diary pages, telegram slips and newsprint.</p>` : `<p class="muted">No letters or diary entries were found, so the whole book is set as regular text.</p>`}</div>
      <div class="sub-block" id="shareBlock"></div>
      <div class="sub-block" id="discBlock"></div>
      ${meta.own ? `<div class="sub-block"><button class="btn ghost small" id="removeBook" type="button">Delete from my library</button></div>` : ''}
    </div></div></section>`;
  mountMini($('coverCv'), key);
  $('bookTheme').addEventListener('change', async e => {
    meta.theme = e.target.value;
    meta.aiReason = '';
    await saveMeta(meta);
    route();
  });
  app
    .querySelectorAll('.moodline a')
    .forEach(a => a.addEventListener('click', () => lsSet('iw:jump', { id, ch: +a.dataset.ch })));
  const rb = $('removeBook');
  if (rb)
    rb.addEventListener('click', async () => {
      if (
        !confirm(
          `Delete “${meta.title}” from your library? This removes it from every device, along with its highlights and comments.`
        )
      )
        return;
      busy(true, 'Deleting…', 1);
      try {
        await cloud.deleteBook(meta);
        busy(false);
        toast('Deleted from your library.');
        location.hash = '#/library';
      } catch (e) {
        busy(false);
        fail(e);
      }
    });
  renderBookSocial(book, rid);
}

export async function renderBookSocial(book, rid) {
  const { meta } = book,
    sb = $('shareBlock'),
    db = $('discBlock');
  if (!supabase) return;
  if (meta.own) {
    let comms = [],
      mine = [],
      linked = [];
    try {
      [comms, mine, linked] = await Promise.all([
        cloud.communities(),
        cloud.myCommunityIds(),
        cloud.bookCommunityIds(meta.id)
      ]);
    } catch (e) {}
    if (rid !== routeId) return;
    const joined = comms.filter(c => mine.includes(c.id)),
      sel = new Set(linked),
      pub = meta.visibility === 'public';
    const boxes = joined.length
      ? `<div class="checks">${joined.map(c => `<label><input type="checkbox" name="cid" value="${esc(c.id)}"${sel.has(c.id) ? ' checked' : ''}>${esc(c.name)}</label>`).join('')}</div>`
      : `<p class="muted" style="margin:0;font-size:.9rem">Join a <a href="#/communities">community</a> to share this book there too.</p>`;
    sb.innerHTML = `<h2>Sharing</h2><div class="vis">
      <p class="state"><b>${pub ? 'Public' : 'Private'}</b><span class="muted" style="font-size:.95rem">${pub ? 'Anyone can read it and comment, even without an account.' : 'Only you can see it, on any device you sign in on.'}</span></p>
      <div class="form" style="padding:0;border:0;background:none">
        <label>Short description<textarea class="input" id="pubDesc" maxlength="500" style="min-height:4rem" placeholder="What should readers know about this book?">${esc(meta.desc)}</textarea></label>
        <div><div class="muted" style="font-size:.9rem;margin-bottom:.3rem">Also show it in these communities</div>${boxes}</div>
        ${
          pub
            ? `<div class="actions"><button class="btn small" id="pubSave" type="button">Save sharing changes</button><button class="btn ghost small" id="pubOff" type="button">Make private</button></div>
          <p class="muted" style="font-size:.86rem;margin:0">Comments are hidden while a book is private and come back if you share it again.</p>`
            : `<label class="rights"><input type="checkbox" id="pubRights"><span>This book is in the public domain, or I have the right to share it.</span></label>
          <div class="actions"><button class="btn small" id="pubOn" type="button" disabled>Make public</button></div>`
        }
      </div></div>`;
    const cids = () => [...sb.querySelectorAll('input[name="cid"]:checked')].map(i => i.value);
    const r = $('pubRights');
    if (r)
      r.addEventListener('change', () => {
        $('pubOn').disabled = !r.checked;
      });
    const on = $('pubOn');
    if (on)
      on.addEventListener('click', async () => {
        on.disabled = true;
        try {
          const now = new Date().toISOString();
          await cloud.updateBook(meta.id, {
            visibility: 'public',
            description: $('pubDesc').value.trim().slice(0, 500),
            rights_confirmed_at: now,
            published_at: now
          });
          await cloud.setBookCommunities(meta.id, cids());
          toast('Your book is public now.');
          route();
        } catch (e) {
          fail(e);
          on.disabled = false;
        }
      });
    const sv = $('pubSave');
    if (sv)
      sv.addEventListener('click', async () => {
        try {
          await cloud.updateBook(meta.id, { description: $('pubDesc').value.trim().slice(0, 500) });
          await cloud.setBookCommunities(meta.id, cids());
          toast('Sharing updated.');
        } catch (e) {
          fail(e);
        }
      });
    const off = $('pubOff');
    if (off)
      off.addEventListener('click', async () => {
        if (!confirm('Make this book private? Readers will lose access and its comments will be hidden.'))
          return;
        try {
          await cloud.updateBook(meta.id, { visibility: 'private' });
          toast('Your book is private again.');
          route();
        } catch (e) {
          fail(e);
        }
      });
  } else {
    const ppl = await cloud.profiles([meta.ownerId]);
    if (rid !== routeId) return;
    const isLiked = signedIn() ? await cloud.liked(meta.id).catch(() => false) : false;
    if (rid !== routeId) return;
    let count = meta.likeCount || 0;
    sb.innerHTML = `<h2>${meta.sample ? 'Sample story' : 'Shared book'}</h2>
      <p>${meta.sample ? 'Everyone who opens Inkworlds has this story, so its discussion and passage comments are open to all readers.' : `Shared by ${whoHTML(ppl, meta.ownerId)}.`}</p>${meta.desc ? `<p class="muted">${nl(meta.desc)}</p>` : ''}
      <div class="actions"><button class="btn ghost small" id="likeBtn" type="button" aria-pressed="${isLiked}">${isLiked ? 'Liked' : 'Like'}</button><span class="muted" id="likeCount"></span></div>`;
    const lb = $('likeBtn'),
      lc = $('likeCount'),
      paint = () => {
        lc.textContent = count ? `${count} reader${count === 1 ? '' : 's'} liked this` : '';
      };
    paint();
    lb.addEventListener('click', async () => {
      if (!signedIn()) {
        rememberDestination(location.hash);
        location.hash = '#/signin';
        return;
      }
      const on = lb.getAttribute('aria-pressed') !== 'true';
      lb.disabled = true;
      try {
        await cloud.setLike(meta.id, on);
        count += on ? 1 : -1;
        lb.setAttribute('aria-pressed', String(on));
        lb.textContent = on ? 'Liked' : 'Like';
        paint();
      } catch (e) {
        fail(e);
      }
      lb.disabled = false;
    });
  }
  if (meta.visibility === 'public') {
    db.innerHTML = `<h2>Discussion</h2><p class="muted" style="font-size:.92rem;margin-top:0">Talk about the whole book here. To comment on a single passage, select its text while reading and choose Comment.</p><div id="bookThread"></div>`;
    mountThread($('bookThread'), { type: 'book', bookId: meta.id });
  }
}

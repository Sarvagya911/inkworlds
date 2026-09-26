// List of communities and the create form.
import { app, enc, errMsg, fail, nl, signedIn } from '../app/helpers.js';
import { routeId } from '../app/router.js';
import { THEMES, fontStack } from '../config/themes.js';
import { $, esc, toast } from '../lib/utils.js';
import * as cloud from '../services/index.js';
import { supabase } from '../services/supabase.js';

export async function viewCommunities() {
  const rid = routeId;
  app.innerHTML = `<section class="view"><h1 class="page-title">Communities</h1>
    <p class="lede">Reading circles built around a genre, a book or a mood. Join one to start discussions and share books with its members.</p><div id="cm"><p class="muted">Loading communities…</p></div></section>`;
  if (!supabase) {
    $('cm').innerHTML = `<div class="empty-box">${esc(errMsg({ code: 'not_configured' }))}</div>`;
    return;
  }
  let cs = [],
    mine = [];
  try {
    [cs, mine] = await Promise.all([cloud.communities(), cloud.myCommunityIds()]);
  } catch (e) {
    if (rid === routeId) $('cm').innerHTML = `<div class="empty-box">${esc(errMsg(e))}</div>`;
    return;
  }
  if (rid !== routeId) return;
  const joined = new Set(mine);
  $('cm').innerHTML =
    `<div class="actions" style="margin-bottom:.4rem">${signedIn() ? `<button class="btn" id="newC" type="button">Start a community</button>` : `<a class="btn" href="#/signin" data-remember>Sign in to start a community</a>`}</div>
    <div id="newCForm" hidden style="margin-top:1rem;max-width:36rem"><div class="form">
      <label>Name<input class="input" id="cName" maxlength="60" placeholder="Gothic Night Readers"></label>
      <label>What is it about?<textarea class="input" id="cDesc" maxlength="280" style="min-height:4.5rem" placeholder="Slow reads of gothic classics, one chapter a week."></textarea></label>
      <label>World for its banner<select class="input" id="cTheme">${Object.entries(THEMES)
        .map(([k, t]) => `<option value="${k}">${esc(t.name)}</option>`)
        .join('')}</select></label>
      <div class="actions"><button class="btn small" id="cCreate" type="button">Create community</button><button class="btn ghost small" id="cCancel" type="button">Cancel</button></div></div></div>
    ${
      cs.length
        ? `<div class="cgrid">${cs
            .map(c => {
              const th = THEMES[c.theme] || THEMES.parchment;
              return `<a class="ccard" href="#/c/${enc(c.id)}"><div class="band" style="--s1:${th.spine[0]};--s2:${th.spine[1]};--s3:${th.spine[2]};--sf:${esc(fontStack(th.title, 'title'))}">${esc(c.name)}</div>
      <div class="cb"><p>${nl(c.description)}</p><span class="pill">${c.member_count} member${c.member_count === 1 ? '' : 's'}</span> ${joined.has(c.id) ? '<span class="pill">Joined</span>' : ''}</div></a>`;
            })
            .join('')}</div>`
        : `<div class="empty-box" style="margin-top:1.4rem">No communities yet. Start the first one.</div>`
    }`;
  const nb = $('newC');
  if (nb) {
    nb.addEventListener('click', () => {
      $('newCForm').hidden = false;
      $('cName').focus();
    });
    $('cCancel').addEventListener('click', () => {
      $('newCForm').hidden = true;
    });
  }
  const cb = $('cCreate');
  if (cb)
    cb.addEventListener('click', async () => {
      const name = $('cName').value.trim();
      if (name.length < 3) {
        toast('Give the community a name of at least 3 characters.');
        $('cName').focus();
        return;
      }
      cb.disabled = true;
      try {
        const c = await cloud.createCommunity({
          name: name.slice(0, 60),
          desc: $('cDesc').value.trim().slice(0, 280),
          theme: $('cTheme').value
        });
        location.hash = '#/c/' + enc(c.id);
      } catch (e) {
        fail(e);
        cb.disabled = false;
      }
    });
}

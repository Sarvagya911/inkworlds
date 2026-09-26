// Profile, data export, delete and sign out.
import { app, avatarURL, busy, download, fail, signInGate, signedIn } from '../app/helpers.js';
import { renderAccountChip } from '../app/router.js';
import { flushProgress, flushReading } from '../app/sync.js';
import { signOut } from '../auth/session.js';
import { $, dayKey, esc, toast } from '../lib/utils.js';
import * as cloud from '../services/index.js';
import { myId, session } from '../services/session.js';

export async function viewAccount() {
  if (!signedIn()) {
    app.innerHTML = `<section class="view"><h1 class="page-title">Account</h1>${signInGate('see your account')}</section>`;
    return;
  }
  const u = session.user,
    p = session.profile || { display_name: '' };
  const via = (u.app_metadata && u.app_metadata.provider) === 'google' ? 'Google' : 'email';
  app.innerHTML = `<section class="view"><h1 class="page-title">Account</h1>
    <div class="settings">
      <div class="set-group"><h2>Profile</h2>
        <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1rem"><img class="avatar-lg" src="${esc(avatarURL(p))}" alt="" referrerpolicy="no-referrer"><div><div style="font-size:1.15rem">${esc(p.display_name || 'Reader')}</div><div class="muted" style="font-size:.92rem">${esc(u.email || '')}. Signed in with ${via}.</div></div></div>
        <div class="form" style="padding:0;border:0;background:none"><label>Display name<input class="input" id="aName" maxlength="60" value="${esc(p.display_name || '')}"></label>
          <div class="actions"><button class="btn small" id="aSave" type="button">Save name</button>${via === 'email' ? '<a class="btn ghost small" href="#/forgot">Change password</a>' : ''}</div></div></div>
      <div class="set-group"><h2>Your data</h2>
        <div class="set-row"><label>Download my data<span class="why">Your books list, highlights, bookmarks, progress and reading stats as one JSON file.</span></label><button class="btn ghost small" id="aExport" type="button">Download</button></div>
        <div class="set-row"><label>Delete all my books<span class="why">Removes every book you uploaded, with its highlights and comments, from all devices.</span></label><button class="btn ghost small" id="aWipe" type="button">Delete books</button></div></div>
      <div class="set-group"><h2>Session</h2><div class="set-row"><label>Sign out on this device<span class="why">Your library stays safe in your account.</span></label><button class="btn small" id="aOut" type="button">Sign out</button></div></div>
    </div></section>`;
  $('aSave').addEventListener('click', async () => {
    const n = $('aName').value.trim();
    if (!n) {
      toast('Enter a display name.');
      return;
    }
    try {
      await cloud.saveProfile({ display_name: n.slice(0, 60) });
      cloud.rememberProfile({ id: myId(), display_name: n, avatar_url: p.avatar_url });
      renderAccountChip();
      toast('Name saved.');
    } catch (e) {
      fail(e);
    }
  });
  $('aExport').addEventListener('click', async () => {
    try {
      busy(true, 'Collecting your data…', 1);
      const d = await cloud.exportMyData();
      busy(false);
      download(`inkworlds-data-${dayKey()}.json`, JSON.stringify(d, null, 2), 'application/json');
    } catch (e) {
      busy(false);
      fail(e);
    }
  });
  $('aWipe').addEventListener('click', async () => {
    if (
      !confirm(
        'Delete every book you uploaded? This removes them from all your devices and cannot be undone.'
      )
    )
      return;
    try {
      busy(true, 'Deleting your books…', 1);
      await cloud.deleteAllMyBooks();
      busy(false);
      toast('All your books were deleted.');
      location.hash = '#/library';
    } catch (e) {
      busy(false);
      fail(e);
    }
  });
  $('aOut').addEventListener('click', async () => {
    await flushReading();
    await flushProgress();
    await signOut();
    toast('Signed out.');
    location.hash = '#/';
  });
}

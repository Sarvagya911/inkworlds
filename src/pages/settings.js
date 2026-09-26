// Reading, sound and appearance settings.
import { app, signedIn } from '../app/helpers.js';
import { changePrefs } from '../app/sync.js';
import { $, applyUiTheme, prefs } from '../lib/utils.js';

export async function viewSettings() {
  app.innerHTML = `<section class="view"><h1 class="page-title">Settings</h1>
    <p class="lede">${signedIn() ? 'These follow your account to every device.' : 'Sign in to keep these on every device.'}</p>
    <div class="settings">
      <div class="set-group"><h2>Reading</h2>
        <div class="set-row"><label for="sFs">Text size<span class="why">Used in every book.</span></label><input type="range" id="sFs" min="15" max="26" value="${prefs.fs}"></div>
        <div class="set-row"><label for="sHand">Handwrite the whole book<span class="why">Letters and diaries are always handwritten.</span></label><input type="checkbox" id="sHand"${prefs.handAll ? ' checked' : ''}></div>
        <div class="set-row"><label for="sMotion">Animate backgrounds<span class="why">Turn off to save battery. The world still shows as a still picture.</span></label><input type="checkbox" id="sMotion"${prefs.motion ? ' checked' : ''}></div></div>
      <div class="set-group"><h2>Sound</h2>
        <div class="set-row"><label for="sSound">Play ambient sound when a book opens<span class="why">Your browser still needs one tap on the page before sound can start.</span></label><input type="checkbox" id="sSound"${prefs.sound ? ' checked' : ''}></div>
        <div class="set-row"><label for="sVol">Volume</label><input type="range" id="sVol" min="0" max="100" value="${prefs.vol}"></div></div>
      <div class="set-group"><h2>Appearance</h2>
        <div class="set-row"><label for="sUi">Site colors<span class="why">The reader always uses the book's world.</span></label><select class="input" id="sUi"><option value="system">Match my device</option><option value="light">Light</option><option value="dark">Dark</option></select></div></div>
      <div class="set-group"><h2>Account</h2><div class="set-row"><label>${signedIn() ? 'Your profile, data export and sign out' : 'Sign in to sync your library across devices'}</label><a class="btn ghost small" href="${signedIn() ? '#/account' : '#/signin'}">${signedIn() ? 'Open account' : 'Sign in'}</a></div></div>
    </div></section>`;
  $('sUi').value = prefs.ui;
  $('sFs').addEventListener('input', e => changePrefs({ fs: +e.target.value }));
  $('sHand').addEventListener('change', e => changePrefs({ handAll: e.target.checked }));
  $('sMotion').addEventListener('change', e => changePrefs({ motion: e.target.checked }));
  $('sSound').addEventListener('change', e => changePrefs({ sound: e.target.checked }));
  $('sVol').addEventListener('input', e => changePrefs({ vol: +e.target.value }));
  $('sUi').addEventListener('change', e => {
    changePrefs({ ui: e.target.value });
    applyUiTheme();
  });
}

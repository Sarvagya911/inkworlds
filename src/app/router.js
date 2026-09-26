// Hash router: maps #/paths to pages and opens or closes the reader.
import { app, avatarURL } from './helpers.js';
import { viewCodeSignIn, viewForgot, viewReset, viewSignIn, viewSignUp, viewVerify } from '../auth/views.js';
import { resetMinis } from '../engine/scenes/stage.js';
import { $, esc } from '../lib/utils.js';
import { viewAccount } from '../pages/account.js';
import { viewBook } from '../pages/book.js';
import { viewCommunities } from '../pages/communities.js';
import { viewCommunity } from '../pages/community.js';
import { viewDiscover } from '../pages/discover.js';
import { viewHighlights } from '../pages/highlights.js';
import { stopHero, viewHome } from '../pages/home.js';
import { viewLibrary } from '../pages/library.js';
import { viewPost } from '../pages/post.js';
import { viewSettings } from '../pages/settings.js';
import { viewStats } from '../pages/stats.js';
import { viewWorlds } from '../pages/worlds.js';
import { closeReader, cur, openReader } from '../reader/reader.js';
import { session } from '../services/session.js';
import { configured } from '../services/supabase.js';

export let routeId = 0,
  subs = [];

export function clearSubs() {
  subs.forEach(u => {
    try {
      u();
    } catch (e) {}
  });
  subs = [];
}

export function setNav(name) {
  document.querySelectorAll('.nav a').forEach(a => {
    if (a.dataset.nav === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

export function renderAccountChip() {
  const box = $('acct');
  if (!box) return;
  if (!configured) {
    box.innerHTML = '';
    return;
  }
  if (session.user) {
    const p = session.profile || { display_name: session.user.email };
    box.innerHTML = `<a class="me" href="#/account" aria-label="Your account"><img src="${esc(avatarURL(p))}" alt="" referrerpolicy="no-referrer"><span>${esc(p.display_name || 'Account')}</span></a>`;
  } else box.innerHTML = `<a class="btn small" href="#/signin" data-remember>Sign in</a>`;
}

export async function route() {
  const h = location.hash || '#/';
  routeId++;
  stopHero();
  resetMinis();
  clearSubs();
  let m;
  if ((m = h.match(/^#\/read\/(.+)$/))) {
    await openReader(decodeURIComponent(m[1]));
    return;
  }
  if (cur) closeReader();
  window.scrollTo(0, 0);
  const titled = t => {
    document.title = t ? t + ' · Inkworlds' : 'Inkworlds';
  };
  if (h === '#/' || h === '#' || h === '') {
    setNav('');
    titled('');
    await viewHome();
  } else if (h === '#/signin') {
    setNav('');
    titled('Sign in');
    viewSignIn(app);
  } else if (h === '#/signup') {
    setNav('');
    titled('Create account');
    viewSignUp(app);
  } else if (h === '#/verify') {
    setNav('');
    titled('Verify');
    viewVerify(app);
  } else if (h === '#/code') {
    setNav('');
    titled('Sign in with a code');
    viewCodeSignIn(app);
  } else if (h === '#/forgot') {
    setNav('');
    titled('Reset password');
    viewForgot(app);
  } else if (h === '#/reset') {
    setNav('');
    titled('New password');
    viewReset(app);
  } else if (h === '#/account') {
    setNav('');
    titled('Account');
    await viewAccount();
  } else if (h === '#/library') {
    setNav('library');
    titled('Library');
    await viewLibrary();
  } else if ((m = h.match(/^#\/book\/(.+)$/))) {
    setNav('library');
    await viewBook(decodeURIComponent(m[1]));
  } else if (h === '#/discover') {
    setNav('discover');
    titled('Discover');
    await viewDiscover();
  } else if (h === '#/communities') {
    setNav('communities');
    titled('Communities');
    await viewCommunities();
  } else if ((m = h.match(/^#\/c\/([^/]+)\/p\/([^/]+)$/))) {
    setNav('communities');
    await viewPost(decodeURIComponent(m[1]), decodeURIComponent(m[2]));
  } else if ((m = h.match(/^#\/c\/([^/]+)$/))) {
    setNav('communities');
    await viewCommunity(decodeURIComponent(m[1]));
  } else if (h === '#/worlds') {
    setNav('worlds');
    titled('Worlds');
    viewWorlds();
  } else if (h.startsWith('#/highlights')) {
    setNav('highlights');
    titled('Highlights');
    await viewHighlights();
  } else if (h === '#/stats') {
    setNav('stats');
    titled('Reading stats');
    await viewStats();
  } else if (h === '#/settings') {
    setNav('settings');
    titled('Settings');
    await viewSettings();
  } else {
    setNav('');
    app.innerHTML = `<section class="view"><h1 class="page-title">Page not found</h1><p class="lede">That page doesn't exist. Head back to your library to keep reading.</p><a class="btn" href="#/library">Open the library</a></section>`;
  }
  const h1 = app.querySelector('h1');
  if (h1) {
    h1.tabIndex = -1;
    h1.focus({ preventScroll: true });
  }
}

addEventListener('hashchange', route);

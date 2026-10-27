import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import {
  destination,
  setUser
} from '../auth/session.js';

import {
  closePanels,
  cur
} from '../reader/reader.js';

import { hideSelPop } from '../reader/annotations.js';

import { supabase } from '../services/supabase.js';


const NATIVE = Capacitor.isNativePlatform();

let handlingAuthCallback = false;


/* ---------------------------------------------------------
 * OAuth callback
 * --------------------------------------------------------- */

async function handleOAuthUrl(rawUrl) {
  if (!rawUrl || !supabase || handlingAuthCallback) {
    return;
  }

  let url;

  try {
    url = new URL(rawUrl);
  } catch (_) {
    return;
  }

  if (
    url.protocol !== 'com.sarvagya.inkworlds:' ||
    url.hostname !== 'auth' ||
    url.pathname !== '/callback'
  ) {
    return;
  }

  const code = url.searchParams.get('code');

  if (!code) {
    return;
  }

  handlingAuthCallback = true;

  try {
    const { data, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(
        '[Inkworlds] OAuth callback failed:',
        error
      );
      return;
    }

    if (data?.session?.user) {
      await setUser(data.session.user);
    }

    location.hash = destination();
  } catch (error) {
    console.error(
      '[Inkworlds] OAuth callback error:',
      error
    );
  } finally {
    handlingAuthCallback = false;
  }
}


/* ---------------------------------------------------------
 * Navigation
 * --------------------------------------------------------- */

function isPanelOpen() {
  const ids = [
    'drawer',
    'sheet',
    'comp',
    'pcSheet'
  ];

  return ids.some(id => {
    const el = document.getElementById(id);
    return el && !el.hidden;
  });
}


function goBack() {

  /* Close reader/settings panels first. */
  if (isPanelOpen()) {
    closePanels();
    return;
  }

  /* Close text-selection popup first. */
  const selpop =
    document.getElementById('selpop');

  if (
    selpop &&
    !selpop.hidden
  ) {
    hideSelPop();
    return;
  }

  /* Reader → book page. */
  if (cur) {
    const id = cur?.meta?.id;

    if (id) {
      location.hash =
        '#/book/' +
        encodeURIComponent(id);
    } else {
      location.hash = '#/library';
    }

    return;
  }

  const hash =
    location.hash || '#/';


  /*
   * Native navigation uses explicit route hierarchy
   * instead of relying on WebView history.
   *
   * This makes Android back reliable even when the
   * WebView only has one document history entry.
   */

  /* Book → Library */
  if (/^#\/book\/[^/]+/.test(hash)) {
    location.hash = '#/library';
    return;
  }

  /* Community post → Community */
  if (/^#\/c\/[^/]+\/p\/[^/]+/.test(hash)) {
    const match =
      hash.match(/^#\/c\/([^/]+)\/p\/[^/]+/);

    if (match) {
      location.hash =
        '#/c/' + match[1];

      return;
    }
  }

  /* Community → Communities */
  if (/^#\/c\/[^/]+$/.test(hash)) {
    location.hash = '#/communities';
    return;
  }

  /* Auth screens → Home */
  if (
    hash === '#/signin' ||
    hash === '#/signup' ||
    hash === '#/verify' ||
    hash === '#/code' ||
    hash === '#/forgot' ||
    hash === '#/reset'
  ) {
    location.hash = '#/';
    return;
  }

  /*
   * Main application pages → Home.
   */
  if (
    hash === '#/library' ||
    hash === '#/discover' ||
    hash === '#/communities' ||
    hash === '#/worlds' ||
    hash === '#/highlights' ||
    hash === '#/stats' ||
    hash === '#/settings' ||
    hash === '#/account'
  ) {
    location.hash = '#/';
    return;
  }

  /*
   * Home/root → close the Android app.
   */
  App.exitApp();
}


/* ---------------------------------------------------------
 * Edge-swipe back
 * --------------------------------------------------------- */

function setupEdgeSwipe() {

  let active = false;
  let startX = 0;
  let startY = 0;

  const EDGE_SIZE = 42;
  const TRIGGER_DISTANCE = 90;
  const MAX_VERTICAL_DRIFT = 80;


  /*
   * Touch events are used instead of pointer events because
   * they are considerably more reliable inside Android WebView.
   */

  window.addEventListener(
    'touchstart',
    event => {

      if (!event.touches?.length) {
        return;
      }

      const touch =
        event.touches[0];

      if (touch.clientX > EDGE_SIZE) {
        return;
      }

      const target =
        event.target;

      /*
       * Don't hijack controls, sliders, buttons,
       * text fields, or editable content.
       */
      if (
        target?.closest?.(
          'input, textarea, select, button, a, [contenteditable="true"]'
        )
      ) {
        return;
      }

      active = true;

      startX = touch.clientX;
      startY = touch.clientY;
    },
    { passive: true }
  );


  window.addEventListener(
    'touchend',
    event => {

      if (!active) {
        return;
      }

      const touch =
        event.changedTouches?.[0];

      if (!touch) {
        active = false;
        return;
      }

      const dx =
        touch.clientX - startX;

      const dy =
        Math.abs(
          touch.clientY - startY
        );

      active = false;

      if (
        dx >= TRIGGER_DISTANCE &&
        dy <= MAX_VERTICAL_DRIFT
      ) {
        goBack();
      }
    },
    { passive: true }
  );


  window.addEventListener(
    'touchcancel',
    () => {
      active = false;
    },
    { passive: true }
  );
}


/* ---------------------------------------------------------
 * Native app setup
 * --------------------------------------------------------- */

export async function initNativeApp() {

  if (!NATIVE) {
    return;
  }


  /*
   * Google / Supabase OAuth callback
   * while the app is already running.
   */
  await App.addListener(
    'appUrlOpen',
    event => {
      handleOAuthUrl(event.url);
    }
  );


  /*
   * OAuth callback when Android launches
   * the app from a completely closed state.
   */
  try {

    const launch =
      await App.getLaunchUrl();

    if (launch?.url) {
      await handleOAuthUrl(
        launch.url
      );
    }

  } catch (_) {}


  /*
   * Android system back button.
   */
  await App.addListener(
    'backButton',
    () => {
      goBack();
    }
  );


  /*
   * Left-edge swipe for phones and tablets.
   */
  setupEdgeSwipe();
}
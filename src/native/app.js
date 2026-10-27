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
  const drawer = document.getElementById('drawer');

  if (drawer?.classList.contains('open')) {
    return true;
  }

  const ids = [
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
  const hash = location.hash || '#/';

  // Close an actually open reader overlay first.
  if (isPanelOpen()) {
    closePanels();
    return;
  }

  // Close text-selection popup.
  const selpop = document.getElementById('selpop');

  if (selpop && !selpop.hidden) {
    hideSelPop();
    return;
  }

  // Normal page routes.
  if (
    hash === '#/settings' ||
    hash === '#/account' ||
    hash === '#/discover' ||
    hash === '#/communities' ||
    hash === '#/worlds' ||
    hash === '#/highlights' ||
    hash === '#/stats' ||
    hash === '#/library'
  ) {
    history.back();
    return;
  }

  // Book page.
  if (/^#\/book\/[^/]+/.test(hash)) {
    history.back();
    return;
  }

  // Community post.
  if (/^#\/c\/[^/]+\/p\/[^/]+/.test(hash)) {
    history.back();
    return;
  }

  // Community.
  if (/^#\/c\/[^/]+$/.test(hash)) {
    history.back();
    return;
  }

  // Auth pages.
  if (
    hash === '#/signin' ||
    hash === '#/signup' ||
    hash === '#/verify' ||
    hash === '#/code' ||
    hash === '#/forgot' ||
    hash === '#/reset'
  ) {
    history.back();
    return;
  }

  // If we're inside a book reader, return to the previous route.
  if (cur) {
    history.back();
    return;
  }

  // At the root — show the themed exit confirmation.
  showExitConfirmation();
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
 * Exit confirmation
 * --------------------------------------------------------- */

function showExitConfirmation() {
  const modal = document.getElementById('exitModal');
  const cancel = document.getElementById('exitCancel');
  const confirm = document.getElementById('exitConfirm');

  if (!modal || !cancel || !confirm) {
    App.exitApp();
    return;
  }

  modal.hidden = false;

  const close = () => {
    modal.hidden = true;
    cancel.removeEventListener('click', close);
    confirm.removeEventListener('click', exit);
  };

  const exit = () => {
    close();
    App.exitApp();
  };

  cancel.addEventListener('click', close);
  confirm.addEventListener('click', exit);

  requestAnimationFrame(() => cancel.focus());
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
    () => goBack()
  );

  /*
   * Left-edge swipe for phones and tablets.
   */
  setupEdgeSwipe();
}
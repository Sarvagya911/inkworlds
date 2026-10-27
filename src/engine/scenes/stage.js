// The full-screen reader background and the small animated previews.
import { Renderer } from './renderer.js';
import { prefs } from '../../lib/utils.js';

export const Main = new Renderer(document.getElementById('scene'), {
  full: true
});

export let minis = [];
export let miniObs = null;

// Preview rendering is deliberately split into two priorities:
// 1. visible cards are prepared first, one per frame;
// 2. off-screen cards are prepared only during browser idle time.
//
// This keeps Worlds responsive even as the gallery grows. In particular,
// background preparation never competes with scrolling or the first animation.
let pendingMinis = [];
let scrollTimer = null;
let isScrolling = false;
let loadScheduled = false;
let loadingVisible = false;
let backgroundLoadScheduled = false;
let backgroundIdleId = null;
let animationStartScheduled = false;

function isVisible(cv) {
  const rect = cv.getBoundingClientRect();

  return (
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  );
}

function cancelBackgroundLoad() {
  if (backgroundIdleId !== null) {
    if (typeof cancelIdleCallback === 'function') {
      cancelIdleCallback(backgroundIdleId);
    } else {
      clearTimeout(backgroundIdleId);
    }

    backgroundIdleId = null;
  }

  backgroundLoadScheduled = false;
}

function initMini(item) {
  if (item.r) return item.r;

  const r = new Renderer(item.cv, {
    maxDpr: 1,
    interval: 40
  });

  item.r = r;
  item.cv._r = r;

  /*
   * Renderer.set() intentionally performs 14 warm-up frames for the main
   * reader. That is useful for the full-size scene, but doing 14 expensive
   * frames for every gallery card creates a startup spike.
   *
   * A gallery preview only needs one settled frame before animation starts.
   * Initialize the renderer directly and draw exactly once.
   */
  r.name = item.key;
  r.rain = [];
  r.resize();
  r.t = 6;
  r.frame(0);
  r.stop();

  minis.push(r);
  return r;
}

function startVisibleMinisSmoothly() {
  if (
    animationStartScheduled ||
    document.hidden ||
    !prefs.motion ||
    isScrolling
  ) {
    return;
  }

  animationStartScheduled = true;

  const visible = minis.filter(r => isVisible(r.cv));
  let index = 0;

  const startOne = () => {
    if (
      document.hidden ||
      !prefs.motion ||
      isScrolling
    ) {
      animationStartScheduled = false;
      return;
    }

    const r = visible[index++];
    if (r) r.start();

    if (index < visible.length) {
      requestAnimationFrame(startOne);
    } else {
      animationStartScheduled = false;
    }
  };

  requestAnimationFrame(startOne);
}

function finishVisibleLoading() {
  loadingVisible = false;
  startVisibleMinisSmoothly();
  scheduleBackgroundLoad();
}

function loadVisibleNext() {
  if (!loadingVisible) return;

  if (isScrolling || document.hidden) {
    return;
  }

  const item = pendingMinis.find(item => isVisible(item.cv));

  if (!item) {
    finishVisibleLoading();
    return;
  }

  pendingMinis = pendingMinis.filter(candidate => candidate !== item);
  initMini(item);

  requestAnimationFrame(loadVisibleNext);
}

function scheduleVisibleLoad() {
  if (loadScheduled) return;
  loadScheduled = true;

  // Let the Worlds DOM paint first. Then prepare only what the user can see.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      loadScheduled = false;
      loadingVisible = true;
      loadVisibleNext();
    });
  });
}

function finishBackgroundLoad() {
  backgroundLoadScheduled = false;
  backgroundIdleId = null;
}

function loadBackgroundOne() {
  if (
    document.hidden ||
    isScrolling ||
    loadingVisible ||
    !pendingMinis.length
  ) {
    backgroundLoadScheduled = false;
    backgroundIdleId = null;
    return;
  }

  // Never spend an idle slot preparing a card that has become visible.
  const item =
    pendingMinis.find(item => !isVisible(item.cv)) || pendingMinis[0];

  if (isVisible(item.cv)) {
    backgroundLoadScheduled = false;
    backgroundIdleId = null;
    return;
  }

  pendingMinis = pendingMinis.filter(candidate => candidate !== item);
  initMini(item);

  if (pendingMinis.length) {
    scheduleBackgroundLoad();
  } else {
    finishBackgroundLoad();
  }
}

function scheduleBackgroundLoad() {
  if (
    backgroundLoadScheduled ||
    document.hidden ||
    isScrolling ||
    loadingVisible ||
    !pendingMinis.length
  ) {
    return;
  }

  backgroundLoadScheduled = true;

  if (typeof requestIdleCallback === 'function') {
    backgroundIdleId = requestIdleCallback(
      () => loadBackgroundOne(),
      { timeout: 1000 }
    );
  } else {
    backgroundIdleId = setTimeout(() => loadBackgroundOne(), 120);
  }
}

function resumePendingVisible() {
  if (isScrolling || document.hidden) return;

  const visiblePending = pendingMinis.filter(item => isVisible(item.cv));

  if (!visiblePending.length) {
    scheduleBackgroundLoad();
    return;
  }

  loadingVisible = true;
  requestAnimationFrame(loadVisibleNext);
}

function pauseMinisForScroll() {
  isScrolling = true;
  animationStartScheduled = false;
  cancelBackgroundLoad();

  // Pause every loaded preview immediately while the user scrolls.
  minis.forEach(r => r.stop());

  clearTimeout(scrollTimer);

  scrollTimer = setTimeout(() => {
    isScrolling = false;

    // If a newly revealed card has not been prepared yet, prepare it first.
    // Only after that do we return to low-priority background preparation.
    resumePendingVisible();
    startVisibleMinisSmoothly();
  }, 150);
}

resetMinis();

export function resetMinis() {
  minis.forEach(r => r.stop());
  minis = [];
  pendingMinis = [];
  loadScheduled = false;
  loadingVisible = false;
  backgroundLoadScheduled = false;
  backgroundIdleId = null;
  animationStartScheduled = false;

  if (miniObs) {
    miniObs.disconnect();
  }

  // Visibility controls animation only. Renderer creation is handled by the
  // visible-first / idle scheduler above, never by the observer itself.
  miniObs = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        const item = e.target._mini;
        if (!item?.r) return;

        if (e.isIntersecting) {
          if (
            !isScrolling &&
            !document.hidden &&
            prefs.motion &&
            !loadingVisible
          ) {
            item.r.start();
          }
        } else {
          item.r.stop();
        }
      });
    },
    {
      threshold: 0.05,
      rootMargin: '150px 0px'
    }
  );
}

export function mountMini(cv, key) {
  const item = { cv, key, r: null };
  cv._mini = item;
  pendingMinis.push(item);
  miniObs.observe(cv);

  scheduleVisibleLoad();

  return item;
}

/*
 * IMPORTANT:
 * Pause canvas animation during scrolling.
 *
 * This is the main fix for scroll stuttering. Background initialization is
 * also cancelled so a newly started scroll gets the main thread to itself.
 */
addEventListener(
  'scroll',
  () => {
    if (!minis.length && !pendingMinis.length && !loadingVisible) return;

    pauseMinisForScroll();
  },
  {
    passive: true
  }
);

addEventListener('resize', () => {
  if (Main.name) {
    Main.resize();

    if (!Main.running) {
      Main.frame(0);
    }
  }

  minis.forEach(r => {
    r.resize();

    if (!r.running) {
      r.frame(0);
    }
  });

  if (!isScrolling) {
    requestAnimationFrame(() => {
      resumePendingVisible();
      startVisibleMinisSmoothly();
    });
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Main.stop();
    minis.forEach(r => r.stop());
    cancelBackgroundLoad();
    return;
  }

  if (Main.name && prefs.motion) {
    Main.start();
  }

  if (miniObs) {
    minis.forEach(r => miniObs.observe(r.cv));
  }

  requestAnimationFrame(() => {
    resumePendingVisible();
    startVisibleMinisSmoothly();
    scheduleBackgroundLoad();
  });
});

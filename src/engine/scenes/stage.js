// The full-screen reader background and the small animated previews.
import { Renderer } from './renderer.js';
import { prefs } from '../../lib/utils.js';

export const Main = new Renderer(document.getElementById('scene'), {
  full: true
});

export let minis = [];
export let miniObs = null;

// Register all previews first so the Worlds route can paint immediately.
// After the first paint, initialize them in small batches. This keeps the
// expensive setup out of navigation and avoids one large blocking task.
let pendingMinis = [];
let scrollTimer = null;
let isScrolling = false;
let loadScheduled = false;
let loadingAll = false;
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

function initMini(item) {
  if (item.r) return item.r;

  const r = new Renderer(item.cv, {
    maxDpr: 1,
    interval: 40
  });

  item.r = r;
  item.cv._r = r;

  r.set(item.key);
  r.stop();

  minis.push(r);
  return r;
}

function startVisibleMinisSmoothly() {
  if (animationStartScheduled || document.hidden || !prefs.motion || isScrolling) {
    return;
  }

  animationStartScheduled = true;

  const visible = minis.filter(r => isVisible(r.cv));
  let index = 0;

  const startBatch = () => {
    if (document.hidden || !prefs.motion || isScrolling) {
      animationStartScheduled = false;
      return;
    }

    const batch = visible.slice(index, index + 2);
    batch.forEach(r => r.start());
    index += batch.length;

    if (index < visible.length) {
      requestAnimationFrame(startBatch);
    } else {
      animationStartScheduled = false;
    }
  };

  requestAnimationFrame(startBatch);
}

function finishLoading() {
  loadingAll = false;
  pendingMinis = [];
  startVisibleMinisSmoothly();
}

function loadNextBatch() {
  if (!loadingAll) return;

  // Never create renderers while the user is actively scrolling. This is what
  // keeps scrolling smooth while the remaining previews are being prepared.
  if (isScrolling || document.hidden) {
    requestAnimationFrame(loadNextBatch);
    return;
  }

  // A small batch spreads the expensive Renderer/scene initialization over
  // multiple frames instead of blocking the browser with all worlds at once.
  const batch = pendingMinis.splice(0, 2);

  batch.forEach(item => initMini(item));

  if (pendingMinis.length) {
    requestAnimationFrame(loadNextBatch);
  } else {
    finishLoading();
  }
}

function scheduleLoadAllMinis() {
  if (loadScheduled) return;
  loadScheduled = true;

  // Let the Worlds DOM paint first. Then prepare all worlds in small batches.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      loadScheduled = false;
      loadingAll = true;
      loadNextBatch();
    });
  });
}

function resumeVisibleMinis() {
  if (document.hidden || !prefs.motion || isScrolling) return;

  startVisibleMinisSmoothly();
}

function pauseMinisForScroll() {
  isScrolling = true;
  animationStartScheduled = false;

  // Pause every loaded preview immediately while the user scrolls.
  minis.forEach(r => r.stop());

  clearTimeout(scrollTimer);

  scrollTimer = setTimeout(() => {
    isScrolling = false;

    // Resume both animation and any unfinished preview preparation.
    if (loadingAll) {
      requestAnimationFrame(loadNextBatch);
    } else {
      resumeVisibleMinis();
    }
  }, 150);
}

resetMinis();

export function resetMinis() {
  minis.forEach(r => r.stop());
  minis = [];
  pendingMinis = [];
  loadScheduled = false;
  loadingAll = false;
  animationStartScheduled = false;

  if (miniObs) {
    miniObs.disconnect();
  }

  // Visibility is only used to control animation after the previews exist.
  // It no longer creates renderers during scrolling.
  miniObs = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        const item = e.target._mini;
        if (!item?.r) return;

        if (e.isIntersecting) {
          if (!isScrolling && !document.hidden && prefs.motion) {
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

  scheduleLoadAllMinis();

  return item;
}

/*
 * IMPORTANT:
 * Pause canvas animation during scrolling.
 *
 * This is the main fix for scroll stuttering.
 */
addEventListener(
  'scroll',
  () => {
    if (!minis.length && !loadingAll) return;

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
    requestAnimationFrame(resumeVisibleMinis);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Main.stop();

    minis.forEach(r => r.stop());

    return;
  }

  if (Main.name && prefs.motion) {
    Main.start();
  }

  if (miniObs) {
    minis.forEach(r => miniObs.observe(r.cv));
  }

  if (loadingAll) {
    requestAnimationFrame(loadNextBatch);
  } else {
    requestAnimationFrame(resumeVisibleMinis);
  }
});

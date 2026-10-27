// The full-screen reader background and the small animated previews.
import { Renderer } from './renderer.js';
import { prefs } from '../../lib/utils.js';

export const Main = new Renderer(document.getElementById('scene'), {
  full: true
});

export let minis = [];
export let miniObs = null;

// World previews are registered first so the Worlds page can paint quickly.
// Once the page has painted, every preview is initialized together. This keeps
// the old smooth scrolling behavior while moving the expensive setup out of
// the route/navigation step.
let pendingMinis = [];
let scrollTimer = null;
let isScrolling = false;
let loadScheduled = false;

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

function loadAllMinis() {
  loadScheduled = false;

  if (!pendingMinis.length) return;

  // Initialize every world while animation is stopped. The page has already
  // had a chance to paint, so navigation stays fast and all worlds are ready
  // before the user starts normal scrolling.
  const items = pendingMinis.slice();

  items.forEach(item => {
    if (!item.r) initMini(item);
  });

  pendingMinis = [];

  if (!document.hidden && prefs.motion && !isScrolling) {
    minis.forEach(r => {
      if (isVisible(r.cv)) r.start();
    });
  }
}

function scheduleLoadAllMinis() {
  if (loadScheduled) return;
  loadScheduled = true;

  // Let the Worlds DOM paint first. Initialization then happens immediately
  // after that first paint rather than during route construction.
  requestAnimationFrame(() => {
    setTimeout(loadAllMinis, 0);
  });
}

function resumeVisibleMinis() {
  if (document.hidden || !prefs.motion) return;

  minis.forEach(r => {
    if (isVisible(r.cv)) {
      r.start();
    } else {
      r.stop();
    }
  });
}

function pauseMinisForScroll() {
  isScrolling = true;

  // Pause every loaded preview immediately while the user scrolls.
  minis.forEach(r => r.stop());

  clearTimeout(scrollTimer);

  scrollTimer = setTimeout(() => {
    isScrolling = false;
    resumeVisibleMinis();
  }, 150);
}

resetMinis();

export function resetMinis() {
  minis.forEach(r => r.stop());
  minis = [];
  pendingMinis = [];
  loadScheduled = false;

  if (miniObs) {
    miniObs.disconnect();
  }

  // Keep an observer only for visibility/scroll lifecycle. We no longer use
  // it to lazy-create worlds because all previews are loaded after first paint.
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
    if (!minis.length) return;

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

  requestAnimationFrame(resumeVisibleMinis);
});

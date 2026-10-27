// The full-screen reader background and the small animated previews.
import { Renderer } from './renderer.js';
import { prefs } from '../../lib/utils.js';

export const Main = new Renderer(document.getElementById('scene'), {
  full: true
});

export let minis = [];
export let miniObs = null;

// World previews are registered first and only create a Renderer when they
// are close to the viewport. This keeps the Worlds page responsive on mobile.
let pendingMinis = [];
let scrollTimer = null;
let isScrolling = false;

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

  // This is the expensive part. It now happens only for previews that are
  // visible (or close to visible), instead of all worlds during navigation.
  r.set(item.key);
  r.stop();

  minis.push(r);
  return r;
}

function activateMini(item) {
  const r = initMini(item);

  if (isScrolling || document.hidden || !prefs.motion) {
    r.stop();
  } else {
    r.start();
  }
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

  // Kill animation work immediately.
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

  if (miniObs) {
    miniObs.disconnect();
  }

  miniObs = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        const item = e.target._mini;
        if (!item) return;

        if (e.isIntersecting) {
          activateMini(item);
        } else if (item.r) {
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

  // IntersectionObserver can wait for its callback until after layout.
  // For the previews already on screen, initialize on the very next frame so
  // the page can paint first without leaving a noticeable blank canvas.
  if (isVisible(cv)) {
    requestAnimationFrame(() => {
      if (item.r || !document.body.contains(cv)) return;
      activateMini(item);
    });
  }

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

  // Re-evaluate visibility after resize.
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
    const cvs = pendingMinis.map(item => item.cv);
    minis.forEach(r => cvs.push(r.cv));

    miniObs.disconnect();

    cvs.forEach(cv => {
      miniObs.observe(cv);
    });
  }

  requestAnimationFrame(resumeVisibleMinis);
});

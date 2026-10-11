// // The full-screen reader background and the small animated previews.
// import { Renderer } from './renderer.js';
// import { prefs } from '../../lib/utils.js';

// export const Main = new Renderer(document.getElementById('scene'), { full: true });

// export let minis = [],
//   miniObs = null;

// export function resetMinis() {
//   minis.forEach(r => r.stop());
//   minis = [];
//   if (miniObs) miniObs.disconnect();
//   miniObs = new IntersectionObserver(
//     es =>
//       es.forEach(e => {
//         const r = e.target._r;
//         if (!r) return;
//         if (e.isIntersecting && prefs.motion && !document.hidden) r.start();
//         else r.stop();
//       }),
//     { threshold: 0.05 }
//   );
// }

// export function mountMini(cv, key) {
//   const r = new Renderer(cv, { maxDpr: 1.25, interval: 40 });
//   cv._r = r;
//   r.set(key);
//   minis.push(r);
//   miniObs.observe(cv);
//   return r;
// }

// addEventListener('resize', () => {
//   if (Main.name) {
//     Main.resize();
//     if (!Main.running) Main.frame(0);
//   }
//   minis.forEach(r => {
//     r.resize();
//     if (!r.running) r.frame(0);
//   });
// });

// document.addEventListener('visibilitychange', () => {
//   if (document.hidden) {
//     Main.stop();
//     minis.forEach(r => r.stop());
//   } else {
//     if (Main.name && prefs.motion) Main.start();
//     if (miniObs) {
//       const cvs = minis.map(r => r.cv);
//       miniObs.disconnect();
//       cvs.forEach(c => miniObs.observe(c));
//     }
//   }
// });

// The full-screen reader background and the small animated previews.
import { Renderer } from './renderer.js';
import { prefs } from '../../lib/utils.js';

export const Main = new Renderer(document.getElementById('scene'), {
  full: true
});

export let minis = [];
export let miniObs = null;

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

  if (miniObs) {
    miniObs.disconnect();
  }

  miniObs = new IntersectionObserver(
    entries => {
      // Never restart animation while the user is actively scrolling.
      if (isScrolling || document.hidden || !prefs.motion) {
        entries.forEach(e => e.target._r?.stop());
        return;
      }

      entries.forEach(e => {
        const r = e.target._r;

        if (!r) return;

        if (e.isIntersecting) {
          r.start();
        } else {
          r.stop();
        }
      });
    },
    {
      threshold: 0.05
    }
  );
}

export function mountMini(cv, key) {
  const r = new Renderer(cv, {
    maxDpr: 1,
    interval: 40
  });

  cv._r = r;

  r.set(key);

  // Don't start it immediately.
  // IntersectionObserver decides whether it's visible.
  r.stop();

  minis.push(r);
  miniObs.observe(cv);

  return r;
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
    const cvs = minis.map(r => r.cv);

    miniObs.disconnect();

    cvs.forEach(cv => {
      miniObs.observe(cv);
    });
  }

  requestAnimationFrame(resumeVisibleMinis);
});
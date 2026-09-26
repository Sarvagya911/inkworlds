// The full-screen reader background and the small animated previews.
import { Renderer } from './renderer.js';
import { prefs } from '../../lib/utils.js';

export const Main = new Renderer(document.getElementById('scene'), { full: true });

export let minis = [],
  miniObs = null;

export function resetMinis() {
  minis.forEach(r => r.stop());
  minis = [];
  if (miniObs) miniObs.disconnect();
  miniObs = new IntersectionObserver(
    es =>
      es.forEach(e => {
        const r = e.target._r;
        if (!r) return;
        if (e.isIntersecting && prefs.motion && !document.hidden) r.start();
        else r.stop();
      }),
    { threshold: 0.05 }
  );
}

export function mountMini(cv, key) {
  const r = new Renderer(cv, { maxDpr: 1.25, interval: 40 });
  cv._r = r;
  r.set(key);
  minis.push(r);
  miniObs.observe(cv);
  return r;
}

addEventListener('resize', () => {
  if (Main.name) {
    Main.resize();
    if (!Main.running) Main.frame(0);
  }
  minis.forEach(r => {
    r.resize();
    if (!r.running) r.frame(0);
  });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Main.stop();
    minis.forEach(r => r.stop());
  } else {
    if (Main.name && prefs.motion) Main.start();
    if (miniObs) {
      const cvs = minis.map(r => r.cv);
      miniObs.disconnect();
      cvs.forEach(c => miniObs.observe(c));
    }
  }
});

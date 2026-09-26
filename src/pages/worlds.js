// Gallery of all worlds.
import { app } from '../app/helpers.js';
import { THEMES, ensureFonts, fontStack } from '../config/themes.js';
import { mountMini } from '../engine/scenes/stage.js';
import { esc } from '../lib/utils.js';

export function viewWorlds() {
  ensureFonts(Object.values(THEMES).flatMap(t => [t.body, t.hand]));
  app.innerHTML = `<section class="view"><h1 class="page-title">Worlds</h1>
    <p class="lede">Every book is matched to one of these worlds. Each has its own living background, typefaces and handwriting, and you can switch any book to any world.</p>
    <div class="worlds">${Object.entries(THEMES)
      .map(
        ([
          k,
          t
        ]) => `<article class="wcard"><div class="pv"><canvas data-w="${k}" aria-hidden="true"></canvas></div>
      <div class="body"><h2 style="font-family:${esc(fontStack(t.title, 'title'))}">${esc(t.name)}</h2><p class="for">${esc(t.best)}</p>
      <div class="spec"><div class="s1" style="font-family:${esc(fontStack(t.body, 'body'))}">The lanterns moved slowly across the moor.</div>
      <div class="s2" style="font-family:${esc(fontStack(t.hand, 'hand'))};font-size:${1.1 * t.hs}rem">My dearest friend, write soon.</div>
      <small>Titles in ${esc(t.title)}, text in ${esc(t.body)}, letters in ${esc(t.hand)}.</small></div></div></article>`
      )
      .join('')}</div></section>`;
  app.querySelectorAll('canvas[data-w]').forEach(cv => mountMini(cv, cv.dataset.w));
}

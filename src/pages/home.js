// Home page.
import { sampleMeta } from '../app/books.js';
import { app, enc, signedIn } from '../app/helpers.js';
import { progOf } from '../app/sync.js';
import { THEMES, fontStack } from '../config/themes.js';
import { SAMPLES } from '../content/samples.js';
import { mountMini } from '../engine/scenes/stage.js';
import { $, esc } from '../lib/utils.js';
import * as cloud from '../services/index.js';

export let heroTimer = null;

export function stopHero() {
  clearInterval(heroTimer);
  heroTimer = null;
}

export async function viewHome() {
  const keys = Object.keys(THEMES);
  let latest = null,
    lp = null;
  const candidates = [...SAMPLES.map(sampleMeta)];
  if (signedIn()) {
    try {
      candidates.push(...(await cloud.myBooks()));
    } catch (e) {}
  }
  for (const b of candidates) {
    const p = progOf(b.id);
    if (p && p.updated && (!lp || p.updated > lp.updated)) {
      latest = b;
      lp = p;
    }
  }
  app.innerHTML = `<section class="view">
    <div class="hero">
      <div>
        <h1 class="brand">Inkworlds</h1>
        <p class="lede">Upload a book and read it inside its own world. The background comes alive, the fonts match the era, letters appear in handwriting, and the weather follows the story.</p>
        <div class="actions">
          ${signedIn() ? `<a class="btn" href="#/library">Open your library</a>` : `<a class="btn" href="#/signup">Create a free account</a>`}
          <a class="btn ghost" href="#/read/sample-vellmoor">Read a sample story</a>
          <a class="btn ghost" href="#/discover">Discover shared books</a>
        </div>
      </div>
      <div class="window" aria-hidden="true"><canvas id="heroCv"></canvas><div class="cap"><div class="wn" id="heroName"></div><div class="wl" id="heroLine"></div></div></div>
    </div>
    ${latest ? `<div class="continue"><div style="flex:1;min-width:0"><div class="muted" style="font-size:.9rem">Continue reading</div><div style="font-family:var(--display);font-size:1.4rem;line-height:1.2">${esc(latest.title)}</div><div class="bar"><i style="width:${Math.round((lp.pct || 0) * 100)}%"></i></div></div><a class="btn small" href="#/read/${enc(latest.id)}">Resume</a></div>` : ''}
    <div class="home-sec"><h2 class="section-title">How it works</h2>
      <div class="steps">
        <div class="step"><h3>Add a book</h3><p>Drop in a PDF or a plain-text book. It's read in your browser, and only the text is saved to your account.</p></div>
        <div class="step"><h3>It finds the world</h3><p>Inkworlds reads the text, picks a matching world, and marks each chapter as stormy, dark, bright or calm.</p></div>
        <div class="step"><h3>Read anywhere</h3><p>Your books, highlights and place in each book follow you to every device you sign in on.</p></div>
      </div></div>
    <div class="home-sec"><h2 class="section-title">What happens as you read</h2>
      <div class="feat">
        <div><h3>Letters in handwriting</h3><p>Letters, diary entries, telegrams and newspaper cuttings appear as the real objects, and ink themselves in as you scroll.</p></div>
        <div><h3>Weather that follows the plot</h3><p>A storm chapter brings rain and lightning. A hopeful one warms the light.</p></div>
        <div><h3>A soundscape for every world</h3><p>Candle crackle, night wind, crickets, waves or a distant hum, generated live and shaped by each chapter.</p></div>
        <div><h3>Highlights and quote cards</h3><p>Highlight lines, add notes, and turn any quote into an image styled in the book's world.</p></div>
        <div><h3>Share and discuss</h3><p>Keep books private or make them public, join reading communities, and comment right in the margins.</p></div>
        <div><h3>Reading stats</h3><p>Time read, streaks, words read and the worlds you spend the most time in, across all your devices.</p></div>
      </div></div>
  </section>`;
  const cv = $('heroCv'),
    r = mountMini(cv, keys[0]);
  let i = 0;
  const label = k => {
    const t = THEMES[k];
    $('heroName').textContent = t.name;
    $('heroName').style.fontFamily = fontStack(t.title, 'title');
    $('heroLine').textContent = t.best;
  };
  label(keys[0]);
  heroTimer = setInterval(() => {
    if (document.hidden) return;
    i = (i + 1) % keys.length;
    cv.style.opacity = 0;
    $('heroName').style.opacity = 0;
    setTimeout(() => {
      const was = r.running;
      r.stop();
      r.set(keys[i]);
      label(keys[i]);
      cv.style.opacity = 1;
      $('heroName').style.opacity = 1;
      if (was) r.start();
    }, 500);
  }, 7000);
}

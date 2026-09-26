// Reading stats.
import { sampleMeta } from '../app/books.js';
import { app, enc, errMsg, signInGate, signedIn } from '../app/helpers.js';
import { routeId } from '../app/router.js';
import { flushReading } from '../app/sync.js';
import { THEMES, fontStack } from '../config/themes.js';
import { SAMPLES } from '../content/samples.js';
import { $, dayKey, esc, fmtMins, fmtNum } from '../lib/utils.js';
import * as cloud from '../services/index.js';

export async function viewStats() {
  const rid = routeId;
  app.innerHTML = `<section class="view"><h1 class="page-title">Reading stats</h1>
    <p class="lede">Time counts only while a book is open, the page is visible, and you've scrolled or tapped in the last minute and a half. It adds up across all your devices.</p><div id="st"></div></section>`;
  if (!signedIn()) {
    $('st').innerHTML = signInGate('track your reading');
    return;
  }
  $('st').innerHTML = '<p class="muted">Loading your stats…</p>';
  await flushReading();
  let days = [],
    prog = [],
    books = [];
  try {
    [days, prog, books] = await Promise.all([cloud.readingDays(), cloud.allProgress(), cloud.myBooks()]);
  } catch (e) {
    if (rid === routeId) $('st').innerHTML = `<div class="empty-box">${esc(errMsg(e))}</div>`;
    return;
  }
  if (rid !== routeId) return;
  const byDay = Object.fromEntries(days.map(d => [d.day, d]));
  const totalSecs = days.reduce((a, d) => a + d.secs, 0),
    totalWords = days.reduce((a, d) => a + d.words, 0),
    finished = prog.filter(p => p.maxPct >= 0.97).length;
  let streak = 0;
  {
    const d = new Date();
    if (!((byDay[dayKey(d)] || {}).secs >= 60)) d.setDate(d.getDate() - 1);
    while ((byDay[dayKey(d)] || {}).secs >= 60) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
  }
  const last = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last.push({ d, mins: Math.round(((byDay[dayKey(d)] || {}).secs || 0) / 60) });
  }
  const maxM = Math.max(10, ...last.map(x => x.mins)),
    W = 700,
    H = 220,
    bw = W / 14;
  const bars = last
    .map((x, i) => {
      const bh = (x.mins / maxM) * (H - 40);
      return `<g><title>${x.d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}: ${x.mins} min</title><rect x="${i * bw + bw * 0.2}" y="${H - 24 - bh}" width="${bw * 0.6}" height="${Math.max(bh, x.mins ? 2 : 0)}" rx="3" style="fill:var(--brass)"></rect><text x="${i * bw + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="12" style="fill:var(--muted)">${x.d.toLocaleDateString(undefined, { weekday: 'narrow' })}</text></g>`;
    })
    .join('');
  const worlds = {},
    perBook = {};
  days.forEach(d => {
    Object.entries(d.worlds || {}).forEach(([k, v]) => (worlds[k] = (worlds[k] || 0) + v));
    Object.entries(d.books || {}).forEach(([k, v]) => (perBook[k] = (perBook[k] || 0) + v));
  });
  const wmax = Math.max(1, ...Object.values(worlds));
  const titles = Object.fromEntries([...books, ...SAMPLES.map(sampleMeta)].map(b => [b.id, b.title]));
  const top = Object.entries(perBook)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    bmax = Math.max(1, ...top.map(x => x[1]));
  $('st').innerHTML = `<div class="kpis">
      <div class="kpi"><b>${fmtMins(totalSecs)}</b><span>total reading time</span></div>
      <div class="kpi"><b>${streak}</b><span>day streak (a minute or more a day)</span></div>
      <div class="kpi"><b>${fmtNum(totalWords)}</b><span>words read</span></div>
      <div class="kpi"><b>${finished}</b><span>books finished</span></div></div>
    <div class="chart"><h2 class="section-title" style="font-size:1.4rem">Minutes read, last 14 days</h2><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart of minutes read per day for the last 14 days">${bars}</svg></div>
    <div class="chart"><h2 class="section-title" style="font-size:1.4rem">Time in each world</h2>
      ${
        Object.keys(worlds).length
          ? `<div class="hbars">${Object.entries(worlds)
              .filter(([k]) => THEMES[k])
              .sort((a, b) => b[1] - a[1])
              .map(
                ([k, v]) =>
                  `<div class="hbar"><span style="font-family:${esc(fontStack(THEMES[k].title, 'title'))}">${esc(THEMES[k].name)}</span><div class="track"><i style="width:${(v / wmax) * 100}%;background:${THEMES[k].spine[0]}"></i></div><span class="muted">${fmtMins(v)}</span></div>`
              )
              .join('')}</div>`
          : '<p class="muted">Start reading to see which worlds you spend time in.</p>'
      }</div>
    <div class="chart"><h2 class="section-title" style="font-size:1.4rem">Most-read books</h2>
      ${top.length ? `<div class="hbars">${top.map(([k, v]) => `<div class="hbar"><a href="#/book/${enc(k)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(titles[k] || 'A shared book')}</a><div class="track"><i style="width:${(v / bmax) * 100}%;background:var(--brass)"></i></div><span class="muted">${fmtMins(v)}</span></div>`).join('')}</div>` : '<p class="muted">No reading time yet.</p>'}</div>`;
}

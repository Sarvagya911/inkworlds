// AI features: world picker and spoiler-safe companion.
import { saveMeta } from '../app/books.js';
import { THEMES } from '../config/themes.js';
import { $ } from '../lib/utils.js';
import { probeEl } from './position.js';
import { applyTheme, closePanels, cur, updateWhy } from './reader.js';
import * as cloud from '../services/index.js';

export function readSoFar() {
  const parts = [],
    ci = Math.max(0, cur.ci),
    el = probeEl(),
    si = el ? +el.dataset.si : 0;
  for (let i = 0; i < ci; i++) parts.push(`[${cur.chapters[i].title}]\n` + cur.chapters[i].paras.join('\n'));
  parts.push(`[${cur.chapters[ci].title}]\n` + cur.chapters[ci].paras.slice(0, si + 1).join('\n'));
  let t = parts.join('\n\n');
  if (t.length > 16000) t = '…' + t.slice(-16000);
  return t;
}

export const aiErr = e =>
  e && e.code === 'limit'
    ? "You've reached today's limit for AI features. Try again tomorrow."
    : e && e.code === 'not_configured'
      ? "AI features aren't set up on this site yet."
      : (e && e.message) || 'The AI request failed. Try again.';

export async function companion(task) {
  if (!cur) return;
  const ans = $('answer');
  ans.textContent = 'Thinking…';
  $('recapBtn').disabled = true;
  $('askBtn').disabled = true;
  try {
    const r = await cloud.askClaude({ kind: 'companion', title: cur.meta.title, task, text: readSoFar() });
    ans.textContent = r.text;
  } catch (e) {
    ans.textContent = aiErr(e);
  } finally {
    $('recapBtn').disabled = false;
    $('askBtn').disabled = false;
  }
}

$('recapBtn').addEventListener('click', () => companion('recap'));

$('askBtn').addEventListener('click', () => {
  const q = $('askIn').value.trim();
  if (!q) {
    $('askIn').focus();
    return;
  }
  companion(q);
});

$('askIn').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('askBtn').click();
});

$('aiBtn').addEventListener('click', async () => {
  if (!cur) return;
  const btn = $('aiBtn'),
    note = $('aiNote');
  btn.disabled = true;
  note.textContent = 'Reading the opening pages…';
  try {
    const out = await cloud.askClaude({
      kind: 'world',
      title: cur.meta.title,
      text: cur.chapters
        .flatMap(c => c.paras)
        .join('\n\n')
        .slice(0, 3500),
      options: Object.fromEntries(Object.entries(THEMES).map(([k, t]) => [k, t.name + ' (' + t.best + ')']))
    });
    if (!THEMES[out.theme])
      throw { message: "Claude couldn't pick a world this time. Choose one from the list instead." };
    cur.meta.theme = out.theme;
    cur.meta.aiReason = String(out.reason || '').slice(0, 200);
    await saveMeta(cur.meta);
    applyTheme(out.theme);
    $('themeSel').value = out.theme;
    updateWhy();
    note.textContent = 'Sends the title and opening pages to Claude.';
  } catch (e) {
    note.textContent = aiErr(e);
  } finally {
    btn.disabled = false;
  }
});

$('compBtn').addEventListener('click', () => {
  const open = $('comp').hidden;
  closePanels();
  if (open) {
    $('comp').hidden = false;
    $('scrim').hidden = false;
    $('compBtn').setAttribute('aria-expanded', 'true');
    $('recapBtn').focus();
  }
});

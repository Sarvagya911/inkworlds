// Draws saved highlights onto the rendered text.
import { paraEl } from './render.js';

export function wrapRange(el, start, end, h) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let pos = 0,
    n;
  const hits = [];
  while ((n = walker.nextNode())) {
    const len = n.nodeValue.length,
      a = Math.max(start, pos),
      b = Math.min(end, pos + len);
    if (a < b) hits.push([n, a - pos, b - pos]);
    pos += len;
  }
  hits.forEach(([node, a, b]) => {
    const r = document.createRange();
    r.setStart(node, a);
    r.setEnd(node, b);
    const m = document.createElement('mark');
    m.className = 'hl' + (h.note ? ' has-note' : '');
    m.dataset.hid = h.id;
    if (h.note) m.title = h.note;
    try {
      r.surroundContents(m);
    } catch (e) {}
  });
}

export function paintHighlight(h) {
  const el = paraEl(h.ch, h.si);
  if (!el) return;
  let s = h.start,
    e = h.end;
  const txt = el.textContent;
  if (txt.slice(s, e) !== h.text) {
    const i = txt.indexOf(h.text);
    if (i < 0) return;
    s = i;
    e = i + h.text.length;
  }
  wrapRange(el, s, e, h);
}

export function unpaintHighlight(id) {
  document.querySelectorAll(`mark.hl[data-hid="${id}"]`).forEach(m => {
    const p = m.parentNode;
    while (m.firstChild) p.insertBefore(m.firstChild, m);
    p.removeChild(m);
    p.normalize();
  });
}

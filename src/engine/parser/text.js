// Reads plain-text books, including Project Gutenberg files.
export function textToParas(text) {
  let t = text.replace(/\r\n?/g, '\n');
  const s = t.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  if (s >= 0) {
    t = t.slice(t.indexOf('\n', s) + 1);
    const e = t.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
    if (e >= 0) t = t.slice(0, e);
  }
  t = t.replace(/_/g, '').replace(/--/g, '—');
  return t
    .split(/\n\s*\n/)
    .map(p => ({ text: p.replace(/\s*\n\s*/g, ' ').trim(), big: false }))
    .filter(p => p.text);
}

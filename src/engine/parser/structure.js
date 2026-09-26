// Finds chapters, and letters, diary entries, telegrams and newspaper cuttings.
import { upperRatio, words } from '../../lib/utils.js';

export const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december';

export const reDiaryDate = new RegExp(
  '^(\\d{1,2}(st|nd|rd|th)?\\s+(' + MONTHS + ')|(' + MONTHS + ')\\s+\\d{1,2}(st|nd|rd|th)?)\\b',
  'i'
);

export const reGreeting =
  /^([Mm]y\s+(own\s+)?([Dd]ear|[Dd]earest|[Dd]arling|[Bb]eloved|[Ss]weet)\b[^.!?]{0,40}|[Dd]ear(est)?\s+[A-Z][^.!?]{0,40})[,:—–-]*\s*(—.*)?$/;

export const reSignoff =
  /^(yours\b|your\s+(loving|affectionate|devoted|ever|own|faithful|true)|ever\s+yours|ever\s+your|with\s+(all\s+)?(my\s+)?love|affectionately|sincerely|faithfully|lovingly|good-?bye)/i;

export function docTypeFromHeading(s) {
  if (/telegram/i.test(s)) return 'telegram';
  if (/(cutting|dailygraph|gazette|chronicle|newspaper|\bthe\s+\w*\s*(times|herald|post|graph)\b)/i.test(s))
    return 'news';
  if (/(diary|journal|memorandum|phonograph|\blog\b)/i.test(s)) return 'diary';
  if (/(\bletter\b|\bnote\b|postcard)/i.test(s)) return 'letter';
  return null;
}

export function docHeading(s) {
  if (s.length > 130) return null;
  const type = docTypeFromHeading(s);
  if (!type) return null;
  const starts =
    /^(letter|telegram|cutting|extract|memorandum|note|postcard|from the|the\s+\w*(graph|gazette|times|chronicle|post|herald))\b/i.test(
      s
    );
  const possessive = /['’]s\s+(diary|journal)\.?\s*$/i.test(s) && words(s) <= 7;
  return upperRatio(s) > 0.6 || starts || possessive ? type : null;
}

export function chaptersFromParas(paras) {
  const chs = [];
  let cur = { title: 'Opening', sub: '', paras: [] };
  const isTitle = p => {
    const t = p.text;
    if (t.length > 70) return false;
    if (/^(chapter|book|part|prologue|epilogue|interlude)\b/i.test(t)) return true;
    if (/^([IVXLC]{1,7}|\d{1,3})\.?$/.test(t)) return true;
    return p.big && t.length >= 3 && /[a-z]/i.test(t) && !docHeading(t);
  };
  for (const p of paras) {
    const t = p.text.trim();
    if (!t) continue;
    if (isTitle(p)) {
      if (cur.paras.length) {
        chs.push(cur);
        cur = { title: t, sub: '', paras: [] };
      } else if (cur.title !== 'Opening' && !cur.sub) cur.sub = t;
      else cur = { title: t, sub: '', paras: [] };
      continue;
    }
    if (
      !cur.paras.length &&
      cur.title !== 'Opening' &&
      !cur.sub &&
      t.length < 70 &&
      upperRatio(t) > 0.6 &&
      !docHeading(t)
    ) {
      cur.sub = t;
      continue;
    }
    cur.paras.push(t);
  }
  if (cur.paras.length) chs.push(cur);
  if (chs.length > 1 && chs[0].title === 'Opening' && words(chs[0].paras.join(' ')) < 40) chs.shift();
  if (chs.length < 2) {
    const all = chs.flatMap(c => c.paras),
      total = words(all.join(' '));
    if (total > 5000) {
      const out = [];
      let bucket = [],
        w = 0;
      for (const p of all) {
        bucket.push(p);
        w += words(p);
        if (w > 3000) {
          out.push({ title: 'Part ' + (out.length + 1), sub: '', paras: bucket });
          bucket = [];
          w = 0;
        }
      }
      if (bucket.length) out.push({ title: 'Part ' + (out.length + 1), sub: '', paras: bucket });
      return out;
    }
  }
  return chs;
}

export function buildBlocks(paras) {
  const blocks = [];
  let cur = null;
  const close = () => {
    if (cur) {
      blocks.push(cur);
      cur = null;
    }
  };
  paras.forEach((raw, si) => {
    const oddQuotes = (raw.match(/["“”]/g) || []).length % 2 === 1;
    const t = /^["“]/.test(raw) && oddQuotes ? raw.replace(/^["“]\s*/, '') : raw;
    const head = docHeading(t);
    if (head) {
      close();
      cur = { kind: 'doc', type: head, label: t, paras: [] };
      return;
    }
    if (cur && cur.type === 'letter' && cur.signing) {
      if (t.length < 45 && !reGreeting.test(t)) {
        cur.paras.push({ t: t.replace(/^["“]|["”]$/g, ''), cls: 'name', si });
        close();
        return;
      }
      close();
    }
    if (cur && cur.type === 'telegram' && cur.paras.length >= 4) close();
    if (cur && cur.type === 'letter' && cur.paras.length >= 30) close();
    if (cur && cur.type === 'news' && cur.paras.length >= 40) close();
    const greet = t.length < 140 && reGreeting.test(t);
    if (greet && (!cur || (cur.type !== 'diary' && !(cur.type === 'letter' && !cur.greeted)))) {
      close();
      cur = { kind: 'doc', type: 'letter', label: '', paras: [] };
    }
    if (!cur && reDiaryDate.test(t)) cur = { kind: 'doc', type: 'diary', label: '', paras: [] };
    if (cur) {
      let cls = '';
      if (cur.type === 'letter') {
        if (greet && !cur.greeted) {
          cls = 'greet';
          cur.greeted = true;
        } else if (reSignoff.test(t) && t.length < 90) {
          cls = 'sign';
          cur.signing = true;
        }
      }
      cur.paras.push({ t, cls, si });
      return;
    }
    blocks.push({ kind: 'p', text: raw, si });
  });
  close();
  return blocks;
}

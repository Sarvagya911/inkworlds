// The seven reading worlds: colours, fonts, handwriting and font loading.
/* ============================== Themes ============================== */
export const THEMES = {
  parchment: {
    name: 'Magical parchment',
    best: 'Fantasy, magic schools, quests and fairy tales.',
    title: 'Cinzel Decorative',
    body: 'EB Garamond',
    hand: 'Pinyon Script',
    hs: 1.45,
    panel: 'rgba(248,238,212,.74)',
    text: '#2c1d0f',
    accent: '#7a3e12',
    bar: 'rgba(236,222,190,.88)',
    edge: 'rgba(90,60,25,.25)',
    hl: 'rgba(214,160,60,.4)',
    paper: '#f5e9cd',
    ink: '#2a170a',
    rule: 'rgba(90,70,40,.22)',
    orn: '❦',
    spine: ['#6d3f1c', '#3f220e', '#ecca7e'],
    rain: '90,70,50'
  },
  gothic: {
    name: 'Gothic night',
    best: 'Gothic horror, vampires, haunted houses and moors.',
    title: 'UnifrakturMaguntia',
    body: 'Cormorant Garamond',
    hand: 'Meddon',
    hs: 1.0,
    panel: 'rgba(10,12,24,.68)',
    text: '#ebe5d6',
    accent: '#d0566a',
    bar: 'rgba(8,9,18,.84)',
    edge: 'rgba(208,86,106,.25)',
    hl: 'rgba(208,86,106,.38)',
    paper: '#e9ddc1',
    ink: '#2b1410',
    rule: 'rgba(80,40,30,.2)',
    orn: '✠',
    spine: ['#4a1019', '#1c060a', '#dcb86c'],
    rain: '190,200,225',
    base: { storm: 0.03 }
  },
  victorian: {
    name: 'Gaslit fog',
    best: 'Victorian mysteries, detectives and foggy city streets.',
    title: 'Playfair Display',
    body: 'Libre Baskerville',
    hand: 'Petit Formal Script',
    hs: 1.12,
    panel: 'rgba(22,20,16,.7)',
    text: '#ede3cd',
    accent: '#dcaa58',
    bar: 'rgba(18,16,13,.86)',
    edge: 'rgba(220,170,88,.22)',
    hl: 'rgba(220,170,88,.35)',
    paper: '#efe5cf',
    ink: '#1f1a33',
    rule: 'rgba(60,60,90,.18)',
    orn: '❧',
    spine: ['#2f3d33', '#141c17', '#dcaa58'],
    rain: '200,195,180',
    base: { storm: 0.12 }
  },
  cosmos: {
    name: 'Deep space',
    best: 'Science fiction, space travel and strange machines.',
    title: 'Orbitron',
    body: 'Spectral',
    hand: 'Caveat',
    hs: 1.35,
    panel: 'rgba(6,9,26,.66)',
    text: '#dfe6f6',
    accent: '#84d6ec',
    bar: 'rgba(5,7,20,.86)',
    edge: 'rgba(132,214,236,.22)',
    hl: 'rgba(132,214,236,.32)',
    paper: '#eef2fa',
    ink: '#1a2748',
    rule: 'rgba(40,70,140,.18)',
    orn: '✦',
    spine: ['#1f2a66', '#0a0e2a', '#a4e6f4'],
    rain: '170,190,230'
  },
  ocean: {
    name: 'Under the sea',
    best: 'Sea voyages, sailors, whales and island adventures.',
    title: 'IM Fell English SC',
    body: 'Crimson Text',
    hand: 'Homemade Apple',
    hs: 0.95,
    panel: 'rgba(2,24,36,.62)',
    text: '#e4f4f7',
    accent: '#8ae5d6',
    bar: 'rgba(2,20,30,.86)',
    edge: 'rgba(138,229,214,.22)',
    hl: 'rgba(138,229,214,.32)',
    paper: '#f1ead6',
    ink: '#123040',
    rule: 'rgba(30,80,100,.2)',
    orn: '≈',
    spine: ['#0f5366', '#062633', '#c3efe6'],
    rain: '180,220,235'
  },
  forest: {
    name: 'Moonlit forest',
    best: 'Woodland tales, journeys on foot and folklore.',
    title: 'IM Fell English SC',
    body: 'EB Garamond',
    hand: 'Homemade Apple',
    hs: 0.95,
    panel: 'rgba(7,17,12,.66)',
    text: '#e9eeda',
    accent: '#d0df7c',
    bar: 'rgba(6,14,10,.86)',
    edge: 'rgba(208,223,124,.2)',
    hl: 'rgba(208,223,124,.32)',
    paper: '#efe9d2',
    ink: '#1e2a14',
    rule: 'rgba(60,80,40,.2)',
    orn: '❀',
    spine: ['#27472d', '#0e1f12', '#e1eaa4'],
    rain: '190,210,200'
  },
  whimsical: {
    name: 'Wonderland pastel',
    best: "Whimsy, nonsense, dreams and children's classics.",
    title: 'Henny Penny',
    body: 'Crimson Text',
    hand: 'Tangerine',
    hs: 1.8,
    panel: 'rgba(255,255,255,.72)',
    text: '#2d2340',
    accent: '#a8356f',
    bar: 'rgba(255,250,252,.88)',
    edge: 'rgba(168,53,111,.2)',
    hl: 'rgba(168,53,111,.22)',
    paper: '#fffaf0',
    ink: '#3a1f4a',
    rule: 'rgba(120,80,140,.18)',
    orn: '♣',
    spine: ['#c07aa6', '#7d3f6a', '#fff0c8'],
    rain: '120,100,150'
  }
};
export const FONT_SPEC = {
  'EB Garamond': 'EB+Garamond:ital,wght@0,400;0,600;1,400',
  'Pinyon Script': 'Pinyon+Script',
  'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400',
  Meddon: 'Meddon',
  'Libre Baskerville': 'Libre+Baskerville:ital,wght@0,400;0,700;1,400',
  'Petit Formal Script': 'Petit+Formal+Script',
  Spectral: 'Spectral:ital,wght@0,400;0,500;1,400',
  Caveat: 'Caveat:wght@400;600',
  'Crimson Text': 'Crimson+Text:ital,wght@0,400;0,600;1,400',
  'Homemade Apple': 'Homemade+Apple',
  Tangerine: 'Tangerine:wght@400;700',
  'Special Elite': 'Special+Elite',
  'Old Standard TT': 'Old+Standard+TT:ital,wght@0,400;0,700;1,400'
};
export const FALLBACK = {
  title: 'Georgia, serif',
  body: "Georgia, 'Times New Roman', serif",
  hand: "'Segoe Script','Snell Roundhand','Apple Chancery',cursive"
};
const loadedFonts = new Set(['Spectral']);
export function ensureFonts(list) {
  const need = [...new Set(list)].filter(f => FONT_SPEC[f] && !loadedFonts.has(f));
  if (!need.length) return;
  need.forEach(f => loadedFonts.add(f));
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href =
    'https://fonts.googleapis.com/css2?' +
    need.map(f => 'family=' + FONT_SPEC[f]).join('&') +
    '&display=swap';
  document.head.appendChild(l);
}
export const fontStack = (f, kind) => `"${f}", ${FALLBACK[kind]}`;

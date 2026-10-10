// Reading worlds: colours, fonts, handwriting, typography and world configuration.

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

    base: {
      storm: 0.03
    }
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

    base: {
      storm: 0.12
    }
  },

  /* ======================= Celestial Frontier ======================= */

  cosmos: {
    name: 'Celestial Frontier',
    best: 'Deep-space exploration, orbital stations, alien worlds and cosmic adventures.',
    title: 'Orbitron',
    body: 'Spectral',
    hand: 'Caveat',
    hs: 1.35,

    panel: 'rgba(4,8,20,.72)',
    text: '#e9f3ff',
    accent: '#6edcff',
    bar: 'rgba(3,6,16,.90)',
    edge: 'rgba(110,220,255,.28)',
    hl: 'rgba(91,177,255,.30)',

    paper: '#eef4fb',
    ink: '#17243d',
    rule: 'rgba(70,120,180,.18)',

    orn: '✦',

    spine: [
      '#28517a',
      '#081426',
      '#82dfff'
    ],

    rain: '125,175,220'
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
  },

  /* ========================== Neon City ========================== */

  neon: {
    name: 'Neon City',
    best: 'Cyberpunk mysteries, hackers, megacities, rain-soaked streets and neon nights.',
    title: 'Orbitron',
    body: 'Spectral',
    hand: 'Caveat',
    hs: 1.25,
    panel: 'rgba(5,8,18,.70)',
    text: '#e8f7ff',
    accent: '#28e7ff',
    bar: 'rgba(3,6,15,.90)',
    edge: 'rgba(40,231,255,.28)',
    hl: 'rgba(255,48,184,.34)',
    paper: '#08111f',
    ink: '#dff9ff',
    rule: 'rgba(70,220,255,.18)',
    orn: '✦',

    spine: [
      '#16d9ff',
      '#071525',
      '#ff35c8'
    ],

    rain: '65,185,220',

    /*
     * World configuration.
     *
     * These values are consumed by the animated world renderer.
     *
     * The world is intentionally described as a collection of
     * locations instead of one static background.
     */

    world: {
      type: 'neon-city',
      transitionMs: 60000,

      locations: [
        {
          id: 'downtown',
          name: 'Neon District',
          description: 'Rain-slick towers, crowded streets and holographic signs.',
          sky: '#030711',
          horizon: '#081525',
          ground: '#050911',

          neon: [
            '#00eaff',
            '#ff2bb5',
            '#8b5cff',
            '#39ff88'
          ],

          density: 1.0,
          traffic: 1.0,
          people: 1.0,
          rain: 0.65,
          lights: 1.0
        },

        {
          id: 'market',
          name: 'Night Market',
          description: 'Crowded alleys filled with stalls, signs, steam and passing crowds.',
          sky: '#07040d',
          horizon: '#180b1b',
          ground: '#09060e',

          neon: [
            '#ff2bb5',
            '#ff7a18',
            '#00eaff',
            '#ffe15a'
          ],

          density: 0.9,
          traffic: 0.65,
          people: 1.35,
          rain: 0.4,
          lights: 1.2
        },

        {
          id: 'skyway',
          name: 'Skyway',
          description: 'Elevated highways cutting between enormous towers above the city.',
          sky: '#020611',
          horizon: '#07142a',
          ground: '#02040a',

          neon: [
            '#00eaff',
            '#4c7dff',
            '#b45cff',
            '#ff35c8'
          ],

          density: 1.35,
          traffic: 1.4,
          people: 0.35,
          rain: 0.5,
          lights: 1.15
        },

        {
          id: 'outskirts',
          name: 'City Outskirts',
          description: 'The endless skyline fades into industrial districts and distant lights.',
          sky: '#02050a',
          horizon: '#0b1118',
          ground: '#05080c',

          neon: [
            '#00c8ff',
            '#ff3b91',
            '#66ffcc'
          ],

          density: 0.65,
          traffic: 0.45,
          people: 0.25,
          rain: 0.25,
          lights: 0.7
        },

        {
          id: 'rooftops',
          name: 'Rooftop Sector',
          description: 'A high view over the city, with aircraft, antennas and distant towers.',
          sky: '#01040b',
          horizon: '#071326',
          ground: '#05070c',

          neon: [
            '#00eaff',
            '#ff35c8',
            '#8d6cff'
          ],

          density: 1.5,
          traffic: 0.35,
          people: 0.3,
          rain: 0.35,
          lights: 1.25
        }
      ],

      /*
       * Small ambient events prevent the city from feeling
       * like a looping wallpaper.
       */

      events: {
        lightFlicker: {
          enabled: true,
          chance: 0.035,
          minMs: 90,
          maxMs: 500
        },

        signPulse: {
          enabled: true,
          chance: 0.018,
          minMs: 600,
          maxMs: 2200
        },

        passingVehicle: {
          enabled: true,
          intervalMin: 1800,
          intervalMax: 5200
        },

        pedestrian: {
          enabled: true,
          intervalMin: 900,
          intervalMax: 3000
        },

        distantAircraft: {
          enabled: true,
          intervalMin: 7000,
          intervalMax: 17000
        }
      }
    }
  },

  /* ========================== Sky Islands ========================== */

  skyIslands: {
    name: 'Sky Islands',
    best: 'Floating kingdoms, magical skies, airships and fantasy adventures.',
    title: 'Cinzel Decorative',
    body: 'EB Garamond',
    hand: 'Pinyon Script',
    hs: 1.35,

    // Dark translucent panel gives the chapter text a readable surface
    // against the bright sunset/cloud background.
    panel: 'rgba(24,18,24,.72)',

    // Bright warm text remains readable over the fantasy artwork.
    text: '#fff4df',

    accent: '#ffd06a',
    bar: 'rgba(28,20,25,.86)',
    edge: 'rgba(255,208,106,.28)',
    hl: 'rgba(255,208,106,.32)',
    paper: '#f5e9d0',
    ink: '#302014',
    rule: 'rgba(255,220,170,.22)',
    orn: '✦',

    spine: [
      '#8b542f',
      '#402514',
      '#e7c477'
    ],

    rain: '190,180,165'
  },

  /* ======================= Astral Observatory ======================= */

  astralObservatory: {
    name: 'Astral Observatory',
    best: 'Cosmic fantasy, astronomy, mysteries, ancient stars and celestial journeys.',
    title: 'Cinzel Decorative',
    body: 'Spectral',
    hand: 'Caveat',
    hs: 1.35,
    panel: 'rgba(8,10,30,.70)',
    text: '#edf1ff',
    accent: '#bca7ff',
    bar: 'rgba(5,7,22,.88)',
    edge: 'rgba(188,167,255,.28)',
    hl: 'rgba(125,211,252,.30)',
    paper: '#eef1fa',
    ink: '#171b38',
    rule: 'rgba(90,110,180,.20)',
    orn: '✦',

    spine: [
      '#353078',
      '#11132f',
      '#c7b8ff'
    ],

    rain: '150,165,215'
  },

  /* ======================== Desert Kingdom ======================== */

  desertKingdom: {
    name: 'Desert Kingdom',
    best: 'Arabian fantasy, magical adventures, ancient kingdoms, romance and tales of the desert.',
    title: 'Cinzel Decorative',
    body: 'Spectral',
    hand: 'Caveat',
    hs: 1.35,
    panel: 'rgba(32,20,22,.68)',
    text: '#fff4df',
    accent: '#f4c56d',
    bar: 'rgba(25,15,18,.88)',
    edge: 'rgba(244,197,109,.30)',
    hl: 'rgba(255,206,117,.28)',
    paper: '#fff4df',
    ink: '#241a24',
    rule: 'rgba(145,95,60,.20)',
    orn: '☾',

    spine: [
      '#8a4f35',
      '#38222b',
      '#f0bd69'
    ],

    rain: '215,175,125'
  },

  /* ======================= Medieval Kingdom ======================= */

  medievalKingdom: {
    name: 'Medieval Kingdom',
    best: 'Fantasy kingdoms, knights, castles, quests, royal adventures and medieval tales.',
    title: 'Cinzel Decorative',
    body: 'Spectral',
    hand: 'Caveat',
    hs: 1.30,

    panel: 'rgba(18,17,20,.70)',
    text: '#f1ead9',
    accent: '#d8ad62',
    bar: 'rgba(14,13,15,.88)',
    edge: 'rgba(216,173,98,.28)',
    hl: 'rgba(216,173,98,.30)',

    paper: '#f2ead8',
    ink: '#241d19',
    rule: 'rgba(95,75,55,.20)',

    orn: '⚜',

    spine: [
      '#63402b',
      '#261a17',
      '#d7b36a'
    ],

    rain: '165,165,165'
  },

  /* ======================== Haunted Manor ======================== */

  hauntedManor: {
    name: 'Haunted Manor',
    best: 'Gothic horror, haunted houses, supernatural mysteries, ghosts and dark atmospheric stories.',
    title: 'Cinzel Decorative',
    body: 'Spectral',
    hand: 'Caveat',
    hs: 1.35,
    panel: 'rgba(7,10,20,.70)',
    text: '#edf1f5',
    accent: '#b7d8c0',
    bar: 'rgba(5,7,14,.90)',
    edge: 'rgba(183,216,192,.28)',
    hl: 'rgba(183,216,192,.24)',
    paper: '#eef1ec',
    ink: '#171b20',
    rule: 'rgba(80,105,90,.20)',
    orn: '✦',

    spine: [
      '#303b43',
      '#11161d',
      '#b7d8c0'
    ],

    rain: '145,165,155'
  },

  /* ======================== Enchanted Forest ======================== */

  enchantedForest: {
    name: 'Enchanted Forest',
    best: 'Fairy tales, magical forests, ancient ruins, woodland adventures and fantasy journeys.',
    title: 'Cinzel Decorative',
    body: 'EB Garamond',
    hand: 'Pinyon Script',
    hs: 1.35,
    panel: 'rgba(7,18,13,.70)',
    text: '#edf5e3',
    accent: '#a8d978',
    bar: 'rgba(5,13,9,.90)',
    edge: 'rgba(168,217,120,.28)',
    hl: 'rgba(168,217,120,.28)',
    paper: '#f0ead4',
    ink: '#1d291b',
    rule: 'rgba(70,100,55,.20)',
    orn: '❧',

    spine: [
      '#31512f',
      '#112315',
      '#b7d67b'
    ],

    rain: '150,175,145'
  }
};


/* ============================== Fonts ============================== */

export const FONT_SPEC = {
  'EB Garamond':
    'EB+Garamond:ital,wght@0,400;0,600;1,400',

  'Pinyon Script':
    'Pinyon+Script',

  'Cormorant Garamond':
    'Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400',

  Meddon:
    'Meddon',

  'Libre Baskerville':
    'Libre+Baskerville:ital,wght@0,400;0,700;1,400',

  'Petit Formal Script':
    'Petit+Formal+Script',

  Spectral:
    'Spectral:ital,wght@0,400;0,500;1,400',

  Orbitron:
    'Orbitron:wght@400;500;600;700',

  Caveat:
    'Caveat:wght@400;600',

  'Crimson Text':
    'Crimson+Text:ital,wght@0,400;0,600;1,400',

  'Homemade Apple':
    'Homemade+Apple',

  Tangerine:
    'Tangerine:wght@400;700',

  'Special Elite':
    'Special+Elite',

  'Old Standard TT':
    'Old+Standard+TT:ital,wght@0,400;0,700;1,400',

  'Cinzel Decorative':
    'Cinzel+Decorative:wght@400;500;600;700;800;900'
};


/* ============================ Fallbacks ============================ */

export const FALLBACK = {
  title: 'Georgia, serif',

  body:
    "Georgia, 'Times New Roman', serif",

  hand:
    "'Segoe Script','Snell Roundhand','Apple Chancery',cursive"
};


/* ========================== Font Loading =========================== */

const loadedFonts = new Set([
  'Spectral'
]);

export function ensureFonts(list) {
  const need = [...new Set(list)]
    .filter(
      f =>
        FONT_SPEC[f] &&
        !loadedFonts.has(f)
    );

  if (!need.length) return;

  need.forEach(f =>
    loadedFonts.add(f)
  );

  const l =
    document.createElement('link');

  l.rel = 'stylesheet';

  l.href =
    'https://fonts.googleapis.com/css2?' +
    need
      .map(
        f =>
          'family=' +
          FONT_SPEC[f]
      )
      .join('&') +
    '&display=swap';

  document.head.appendChild(l);
}


/* =========================== Font Stack ============================= */

export const fontStack = (
  f,
  kind
) =>
  `"${f}", ${FALLBACK[kind]}`;
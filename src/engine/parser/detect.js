// // Picks a book's world from its words, and scores each chapter's mood.
// import { clamp, words } from '../../lib/utils.js';

// export const KEYS = {
//   gothic:
//     'vampire castle blood coffin grave tomb crypt undead corpse ghost haunted midnight wolf crucifix garlic monster horror dread chapel lantern moor sexton',
//   parchment:
//     'wizard magic spell wand witch dragon sorcerer sorcery enchanted enchantment potion kingdom quest elf dwarf sword prophecy rune apprentice mage mages parchment quill ink map scroll',
//   victorian:
//     'detective inspector crime murder clue evidence constable london hansom deduction client revolver gaslight lamp cab telegram baker',
//   cosmos:
//     'planet space alien robot galaxy orbit rocket spaceship martian starship laboratory universe asteroid machine scientist',
//   ocean:
//     'sea ship captain whale sailor deck wave island ocean harpoon voyage submarine pirate shore tide anchor crew',
//   forest: 'forest woods tree river fairy village cottage hunter meadow leaves fox owl mountain valley',
//   whimsical: 'rabbit curious queen cat garden hatter mouse dream wonderland nonsense giggle'
// };

// export const KEY_RE = Object.fromEntries(
//   Object.entries(KEYS).map(([k, v]) => [k, new RegExp('\\b(' + v.split(' ').join('|') + ')(s|es)?\\b', 'gi')])
// );

// export function detectTheme(chapters) {
//   const text = chapters
//       .flatMap(c => c.paras)
//       .join(' ')
//       .slice(0, 160000),
//     n = Math.max(1, words(text));
//   let best = 'parchment',
//     bestScore = 0,
//     hits = [];
//   for (const [k, re] of Object.entries(KEY_RE)) {
//     const found = {};
//     let m;
//     re.lastIndex = 0;
//     while ((m = re.exec(text))) {
//       const w = m[1].toLowerCase();
//       found[w] = (found[w] || 0) + 1;
//     }
//     const score = (Object.values(found).reduce((a, b) => a + b, 0) / n) * 10000;
//     if (score > bestScore) {
//       bestScore = score;
//       best = k;
//       hits = Object.entries(found)
//         .sort((a, b) => b[1] - a[1])
//         .slice(0, 3)
//         .map(e => e[0]);
//     }
//   }
//   return { theme: best, hits };
// }

// export const MOOD_RE = {
//   storm:
//     /\b(storm|storms|stormy|thunder|lightning|rain|raining|tempest|gale|wind|winds|howl|howled|howling|downpour|lashed|lashing)\b/gi,
//   dark: /\b(dark|darkness|night|shadow|shadows|blood|death|dead|fear|terror|horror|grave|scream|screamed|cold|black|dread|midnight)\b/gi,
//   warm: /\b(sun|sunlight|sunshine|sunrise|warm|warmth|laugh|laughed|smile|smiled|morning|joy|happy|golden|bright|dawn|blossom)\b/gi
// };

// export function chapterMood(ch) {
//   const t = ch.paras.join(' '),
//     n = Math.max(600, words(t));
//   const c = k => {
//     const hits = (t.match(MOOD_RE[k]) || []).length;
//     return hits < 3 ? 0 : (hits / n) * 1000;
//   };
//   const m = {
//     storm: clamp(c('storm') / 6, 0, 1),
//     dark: clamp(c('dark') / 16, 0, 1),
//     warm: clamp(c('warm') / 10, 0, 1)
//   };
//   m.label = m.storm > 0.45 ? 'stormy' : m.dark > 0.5 ? 'dark' : m.warm > 0.5 ? 'bright' : 'calm';
//   return m;
// }

// Picks a book's world from its words,
// and scores each chapter's mood.

import {
  clamp,
  words
} from '../../lib/utils.js';


export const KEYS = {
  gothic:
    'vampire castle blood coffin grave tomb crypt undead corpse ghost haunted midnight wolf crucifix garlic monster horror dread chapel lantern moor sexton',

  parchment:
    'wizard magic spell wand witch dragon sorcerer sorcery enchanted enchantment potion kingdom quest elf dwarf sword prophecy rune apprentice mage mages parchment quill ink map scroll',

  victorian:
    'detective inspector crime murder clue evidence constable london hansom deduction client revolver gaslight lamp cab telegram baker',

  cosmos:
    'planet space alien robot galaxy orbit rocket spaceship martian starship laboratory universe asteroid machine scientist android hologram spacecraft',

  ocean:
    'sea ship captain whale sailor deck wave island ocean harpoon voyage submarine pirate shore tide anchor crew harbour harbor oceanic',

  forest:
    'forest woods tree river fairy village cottage hunter meadow leaves fox owl mountain valley woodland grove moss druid',

  whimsical:
    'rabbit curious queen cat garden hatter mouse dream wonderland nonsense giggle tea absurd mushroom playing cards',

  neon:
    'cyberpunk cyber hacker hacking neon megacity metropolis android implant hologram drone cyberspace corporation corporate nightclub nightclub rain skyscraper skyline streetlight terminal network data code digital synthetic augmented chrome circuit electric'

};


export const KEY_RE =
  Object.fromEntries(
    Object.entries(
      KEYS
    ).map(
      ([k, v]) => [
        k,
        new RegExp(
          '\\b(' +
            v
              .split(' ')
              .join('|') +
            ')(s|es)?\\b',
          'gi'
        )
      ]
    )
  );


export function detectTheme(
  chapters
) {
  const text =
    chapters
      .flatMap(
        c => c.paras
      )
      .join(' ')
      .slice(
        0,
        160000
      );

  const n =
    Math.max(
      1,
      words(text)
    );

  let best =
    'parchment';

  let bestScore =
    0;

  let hits = [];


  for (
    const [k, re]
      of Object.entries(
        KEY_RE
      )
  ) {
    const found =
      {};

    let m;


    re.lastIndex =
      0;


    while (
      (
        m =
          re.exec(text)
      )
    ) {
      const w =
        m[1].toLowerCase();

      found[w] =
        (
          found[w] ||
          0
        ) + 1;
    }


    const raw =
      Object
        .values(found)
        .reduce(
          (a, b) =>
            a + b,
          0
        );


    const score =
      (
        raw /
        n
      ) *
      10000;


    if (
      score >
      bestScore
    ) {
      bestScore =
        score;

      best =
        k;

      hits =
        Object.entries(
          found
        )
          .sort(
            (a, b) =>
              b[1] -
              a[1]
          )
          .slice(
            0,
            3
          )
          .map(
            e =>
              e[0]
          );
    }
  }


  return {
    theme:
      best,

    hits
  };
}


export const MOOD_RE = {
  storm:
    /\b(storm|storms|stormy|thunder|lightning|rain|raining|tempest|gale|wind|winds|howl|howled|howling|downpour|lashed|lashing)\b/gi,

  dark:
    /\b(dark|darkness|night|shadow|shadows|blood|death|dead|fear|terror|horror|grave|scream|screamed|cold|black|dread|midnight)\b/gi,

  warm:
    /\b(sun|sunlight|sunshine|sunrise|warm|warmth|laugh|laughed|smile|smiled|morning|joy|happy|golden|bright|dawn|blossom)\b/gi
};


export function chapterMood(
  ch
) {
  const t =
    ch.paras.join(' ');

  const n =
    Math.max(
      600,
      words(t)
    );


  const c =
    k => {
      const hits =
        (
          t.match(
            MOOD_RE[k]
          ) || []
        ).length;

      return hits < 3
        ? 0
        : (
            hits /
            n
          ) *
          1000;
    };


  const m = {
    storm:
      clamp(
        c('storm') /
          6,
        0,
        1
      ),

    dark:
      clamp(
        c('dark') /
          16,
        0,
        1
      ),

    warm:
      clamp(
        c('warm') /
          10,
        0,
        1
      )
  };


  m.label =
    m.storm > 0.45
      ? 'stormy'
      : m.dark > 0.5
        ? 'dark'
        : m.warm > 0.5
          ? 'bright'
          : 'calm';


  return m;
}
// src/engine/scenes/worlds/sky-islands.js
//
// Procedural animated fantasy sky-islands world (v2)
// No external images, no GIF, no reference image.
//
// Scene API:
//   init(w, h)
//   draw(ctx, state, t, dt, mood, w, h)

const DESIGN_W = 1672;
const DESIGN_H = 941;
const TAU = Math.PI * 2;

const SUN = { x: 1290, y: 285 };

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function noise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u);
}

function fbm(x) {
  return (
    noise(x) * 0.58 +
    noise(x * 2.1 + 7) * 0.3 +
    noise(x * 4.3 + 19) * 0.12
  );
}

function seeded(seed) {
  let s = seed >>> 0;

  return function random() {
    s += 0x6d2b79f5;

    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

const mixc = (a, b, t) => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

const col = (c, a = 1) =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function ell(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(
    x,
    y,
    Math.max(0.01, rx),
    Math.max(0.01, ry),
    rot,
    0,
    TAU
  );
}

function circ(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, Math.max(0.01, r), 0, TAU);
}

function tri(g, ax, ay, bx, by, cx, cy) {
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(bx, by);
  g.lineTo(cx, cy);
  g.closePath();
}

function smoothClosed(g, pts) {
  const n = pts.length;

  g.beginPath();

  g.moveTo(
    (pts[n - 1][0] + pts[0][0]) / 2,
    (pts[n - 1][1] + pts[0][1]) / 2
  );

  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];

    g.quadraticCurveTo(
      p[0],
      p[1],
      (p[0] + q[0]) / 2,
      (p[1] + q[1]) / 2
    );
  }

  g.closePath();
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(w, h);
  }

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;

  return c;
}

function sprite(bw, bh, q, fn) {
  const cv = makeCanvas(
    Math.max(1, Math.ceil(bw * q)),
    Math.max(1, Math.ceil(bh * q))
  );

  const g = cv.getContext("2d");

  g.scale(q, q);

  fn(g);

  return cv;
}

/* -------------------------------------------------------------------------- */
/* SKY                                                                         */
/* -------------------------------------------------------------------------- */

function bakeSky(g) {
  const sky = g.createLinearGradient(0, 0, 0, DESIGN_H);

  sky.addColorStop(0, "#18244e");
  sky.addColorStop(0.22, "#33407a");
  sky.addColorStop(0.42, "#7a6597");
  sky.addColorStop(0.58, "#d0868f");
  sky.addColorStop(0.74, "#f3a883");
  sky.addColorStop(1, "#f9d3a0");

  g.fillStyle = sky;
  g.fillRect(0, 0, DESIGN_W, DESIGN_H);

  const bloom = g.createRadialGradient(
    SUN.x,
    SUN.y,
    10,
    SUN.x,
    SUN.y,
    720
  );

  bloom.addColorStop(0, "rgba(255,236,190,0.85)");
  bloom.addColorStop(0.18, "rgba(255,200,150,0.45)");
  bloom.addColorStop(0.5, "rgba(255,150,130,0.18)");
  bloom.addColorStop(1, "rgba(255,120,120,0)");

  g.fillStyle = bloom;
  g.fillRect(0, 0, DESIGN_W, DESIGN_H);

  const hz = g.createRadialGradient(
    SUN.x - 100,
    640,
    20,
    SUN.x - 100,
    640,
    900
  );

  hz.addColorStop(0, "rgba(255,198,140,0.45)");
  hz.addColorStop(1, "rgba(255,170,130,0)");

  g.save();

  g.translate(0, 640);
  g.scale(1, 0.38);
  g.translate(0, -640);

  g.fillStyle = hz;
  g.fillRect(0, 0, DESIGN_W, DESIGN_H * 2.2);

  g.restore();

  const r = seeded(777);

  g.lineCap = "round";

  for (let i = 0; i < 16; i++) {
    const x = r() * DESIGN_W;
    const y = 40 + r() * 330;
    const len = 160 + r() * 330;
    const warm = smoothstep(120, 330, y);

    g.strokeStyle = col(
      mixc([200, 205, 245], [255, 205, 190], warm),
      0.08 + r() * 0.09
    );

    g.lineWidth = 2 + r() * 7;

    g.beginPath();

    g.moveTo(x, y);

    g.bezierCurveTo(
      x + len * 0.3,
      y - 14 - r() * 12,
      x + len * 0.65,
      y + 10 + r() * 10,
      x + len,
      y - 4
    );

    g.stroke();
  }

  const ranges = [
    {
      base: 585,
      amp: 160,
      sc: 0.0042,
      c: [150, 118, 156],
      a: 0.5,
      seed: 3,
    },
    {
      base: 625,
      amp: 135,
      sc: 0.0056,
      c: [118, 96, 142],
      a: 0.62,
      seed: 9,
    },
    {
      base: 662,
      amp: 112,
      sc: 0.007,
      c: [84, 72, 116],
      a: 0.78,
      seed: 17,
    },
  ];

  for (const m of ranges) {
    const gr = g.createLinearGradient(
      0,
      m.base - m.amp,
      0,
      m.base + 40
    );

    gr.addColorStop(0, col(m.c, m.a));
    gr.addColorStop(
      1,
      col(mixc(m.c, [250, 175, 150], 0.7), m.a * 0.85)
    );

    g.fillStyle = gr;

    g.beginPath();

    g.moveTo(0, DESIGN_H);

    for (let x = -10; x <= DESIGN_W + 10; x += 8) {
      const h =
        Math.pow(fbm(x * m.sc + m.seed), 1.7) *
        m.amp *
        1.6;

      g.lineTo(x, m.base - h);
    }

    g.lineTo(DESIGN_W + 10, DESIGN_H);
    g.closePath();

    g.fill();
  }
}

function makeStars() {
  const r = seeded(4242);
  const out = [];

  for (let i = 0; i < 90; i++) {
    out.push({
      x: r() * DESIGN_W,
      y: r() * 340,
      s: 0.5 + r() * 1.3,
      ph: r() * TAU,
      sp: 0.6 + r() * 1.6,
    });
  }

  return out;
}

function drawStars(g, stars, t) {
  for (const s of stars) {
    const fade = 1 - smoothstep(120, 340, s.y);

    const dx = s.x - SUN.x;
    const dy = s.y - SUN.y;

    const sunHide = smoothstep(
      120,
      520,
      Math.sqrt(dx * dx + dy * dy)
    );

    const a =
      fade *
      sunHide *
      (0.35 +
        0.65 *
          (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)));

    if (a < 0.02) continue;

    g.fillStyle = `rgba(255,246,222,${a * 0.9})`;

    circ(g, s.x, s.y, s.s);
    g.fill();
  }
}

function drawSun(g, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.35);

  g.save();

  g.globalCompositeOperation = "lighter";

  const h = g.createRadialGradient(
    SUN.x,
    SUN.y,
    8,
    SUN.x,
    SUN.y,
    170 + pulse * 14
  );

  h.addColorStop(0, "rgba(255,240,200,0.75)");
  h.addColorStop(0.35, "rgba(255,200,150,0.3)");
  h.addColorStop(1, "rgba(255,170,130,0)");

  g.fillStyle = h;

  g.fillRect(
    SUN.x - 220,
    SUN.y - 220,
    440,
    440
  );

  g.restore();

  const disc = g.createRadialGradient(
    SUN.x - 6,
    SUN.y - 6,
    2,
    SUN.x,
    SUN.y,
    32
  );

  disc.addColorStop(0, "#fffdf0");
  disc.addColorStop(0.7, "#ffeec0");
  disc.addColorStop(1, "#ffd59a");

  g.fillStyle = disc;

  circ(g, SUN.x, SUN.y, 31);
  g.fill();
}

function drawSunRays(g, t, strength) {
  g.save();

  g.globalCompositeOperation = "lighter";

  const gr = g.createRadialGradient(
    SUN.x,
    SUN.y,
    20,
    SUN.x,
    SUN.y,
    1250
  );

  gr.addColorStop(
    0,
    `rgba(255,222,170,${0.2 * strength})`
  );

  gr.addColorStop(
    0.5,
    `rgba(255,190,150,${0.07 * strength})`
  );

  gr.addColorStop(
    1,
    "rgba(255,170,140,0)"
  );

  g.fillStyle = gr;

  const n = 11;

  for (let i = 0; i < n; i++) {
    const base =
      Math.PI * 0.52 +
      (i / (n - 1)) * Math.PI * 0.95 +
      Math.sin(t * 0.07 + i * 1.3) * 0.04;

    const wd =
      0.02 +
      0.016 *
        (0.5 +
          0.5 *
            Math.sin(t * 0.13 + i * 2.1));

    g.beginPath();

    g.moveTo(SUN.x, SUN.y);

    g.lineTo(
      SUN.x + Math.cos(base - wd) * 1700,
      SUN.y + Math.sin(base - wd) * 1700
    );

    g.lineTo(
      SUN.x + Math.cos(base + wd) * 1700,
      SUN.y + Math.sin(base + wd) * 1700
    );

    g.closePath();

    g.fill();
  }

  g.restore();
}

/* -------------------------------------------------------------------------- */
/* CLOUDS                                                                      */
/* -------------------------------------------------------------------------- */

const SKY_CLOUDS = [
  {
    x: -160,
    y: 150,
    w: 460,
    h: 120,
    speed: 5,
    alpha: 0.55,
    layer: 0,
    seed: 11,
    warm: 0.75,
  },
  {
    x: 330,
    y: 95,
    w: 540,
    h: 130,
    speed: 4,
    alpha: 0.42,
    layer: 0,
    seed: 22,
    warm: 0.55,
  },
  {
    x: 870,
    y: 160,
    w: 470,
    h: 120,
    speed: 6,
    alpha: 0.5,
    layer: 0,
    seed: 33,
    warm: 0.9,
  },
  {
    x: 1300,
    y: 85,
    w: 520,
    h: 130,
    speed: 4,
    alpha: 0.45,
    layer: 0,
    seed: 44,
    warm: 0.65,
  },
  {
    x: -220,
    y: 372,
    w: 640,
    h: 170,
    speed: 10,
    alpha: 0.6,
    layer: 1,
    seed: 55,
    warm: 0.85,
  },
  {
    x: 380,
    y: 335,
    w: 580,
    h: 160,
    speed: 8,
    alpha: 0.5,
    layer: 1,
    seed: 66,
    warm: 0.7,
  },
  {
    x: 900,
    y: 365,
    w: 640,
    h: 170,
    speed: 9,
    alpha: 0.58,
    layer: 1,
    seed: 77,
    warm: 0.95,
  },
  {
    x: 1350,
    y: 345,
    w: 590,
    h: 170,
    speed: 7,
    alpha: 0.6,
    layer: 1,
    seed: 88,
    warm: 0.8,
  },
];

function makeCloud(cw, ch, seed, warm, q) {
  return sprite(cw, ch, q, (g) => {
    const r = seeded(seed);

    const top = mixc(
      [250, 246, 255],
      [255, 220, 196],
      warm
    );

    const mid = mixc(
      [212, 214, 242],
      [242, 182, 184],
      warm
    );

    const shade = mixc(
      [138, 138, 190],
      [176, 122, 152],
      warm
    );

    const n = 11 + Math.floor(r() * 4);
    const puffs = [];

    for (let i = 0; i < n; i++) {
      const p = i / (n - 1);
      const arch = Math.sin(p * Math.PI);

      const rad =
        ch *
          (0.2 +
            0.26 *
              arch *
              (0.55 + r() * 0.45)) +
        ch * 0.06;

      puffs.push({
        x: cw * (0.1 + 0.8 * p),
        y:
          ch *
          (0.64 -
            0.26 *
              arch *
              (0.5 + r() * 0.5)),
        rad,
      });
    }

    for (const p of puffs) {
      const gr = g.createRadialGradient(
        p.x,
        p.y + p.rad * 0.3,
        0,
        p.x,
        p.y + p.rad * 0.3,
        p.rad
      );

      gr.addColorStop(0, col(shade, 0.5));
      gr.addColorStop(1, col(shade, 0));

      g.fillStyle = gr;

      circ(
        g,
        p.x,
        p.y + p.rad * 0.3,
        p.rad
      );

      g.fill();
    }

    for (const p of puffs) {
      const gr = g.createRadialGradient(
        p.x + p.rad * 0.25,
        p.y - p.rad * 0.35,
        p.rad * 0.05,
        p.x,
        p.y,
        p.rad
      );

      gr.addColorStop(0, col(top, 0.95));
      gr.addColorStop(0.5, col(mid, 0.72));
      gr.addColorStop(1, col(mid, 0));

      g.fillStyle = gr;

      circ(g, p.x, p.y, p.rad);
      g.fill();
    }
  });
}

const BANKS = [
  {
    y: 655,
    h: 300,
    speed: 6,
    amp: 6,
    seed: 101,
    hi: [255, 228, 204],
    mid: [228, 178, 186],
    deep: [162, 142, 192],
  },
  {
    y: 718,
    h: 360,
    speed: 9,
    amp: 8,
    seed: 202,
    hi: [255, 232, 216],
    mid: [222, 184, 202],
    deep: [150, 140, 192],
  },
  {
    y: 782,
    h: 380,
    speed: 13,
    amp: 9,
    seed: 303,
    hi: [248, 228, 232],
    mid: [196, 176, 208],
    deep: [132, 128, 184],
  },
  {
    y: 852,
    h: 420,
    speed: 19,
    amp: 10,
    seed: 404,
    hi: [228, 218, 242],
    mid: [170, 160, 208],
    deep: [108, 108, 168],
  },
];

function makeBank(b, q) {
  return sprite(DESIGN_W, b.h, q, (g) => {
    const r = seeded(b.seed);
    const topLine = b.h * 0.38;

    const body = g.createLinearGradient(
      0,
      topLine,
      0,
      b.h
    );

    body.addColorStop(0, col(b.mid, 0));
    body.addColorStop(0.1, col(b.mid, 1));
    body.addColorStop(
      0.5,
      col(mixc(b.mid, b.deep, 0.55), 1)
    );
    body.addColorStop(1, col(b.deep, 1));

    g.fillStyle = body;
    g.fillRect(0, topLine, DESIGN_W, b.h);

    const n = 19;
    const puffs = [];

    for (let i = 0; i < n; i++) {
      puffs.push({
        x:
          ((i + r() * 0.7) / n) *
          DESIGN_W,
        y: topLine + (r() - 0.4) * 34,
        rad: 62 + r() * 72,
      });
    }

    for (const wrap of [
      -DESIGN_W,
      0,
      DESIGN_W,
    ]) {
      for (const p of puffs) {
        const px = p.x + wrap;

        const gr = g.createRadialGradient(
          px + p.rad * 0.2,
          p.y - p.rad * 0.3,
          p.rad * 0.05,
          px,
          p.y,
          p.rad
        );

        gr.addColorStop(0, col(b.hi, 0.95));
        gr.addColorStop(0.55, col(b.mid, 0.82));
        gr.addColorStop(1, col(b.mid, 0));

        g.fillStyle = gr;

        circ(g, px, p.y, p.rad);
        g.fill();
      }
    }

    for (const wrap of [
      -DESIGN_W,
      0,
      DESIGN_W,
    ]) {
      for (const p of puffs) {
        const px =
          p.x +
          wrap +
          p.rad * 0.25;

        const gr = g.createRadialGradient(
          px,
          p.y - p.rad * 0.5,
          0,
          px,
          p.y - p.rad * 0.5,
          p.rad * 0.55
        );

        gr.addColorStop(
          0,
          col(b.hi, 0.28)
        );

        gr.addColorStop(
          1,
          col(b.hi, 0)
        );

        g.fillStyle = gr;

        circ(
          g,
          px,
          p.y - p.rad * 0.5,
          p.rad * 0.55
        );

        g.fill();
      }
    }
  });
}

function drawBank(g, bank, spr, t) {
  const off = (t * bank.speed) % DESIGN_W;

  const y =
    bank.y -
    bank.h * 0.38 +
    Math.sin(t * 0.25 + bank.seed) *
      bank.amp;

  g.drawImage(
    spr,
    -off,
    y,
    DESIGN_W,
    bank.h
  );

  g.drawImage(
    spr,
    -off + DESIGN_W,
    y,
    DESIGN_W,
    bank.h
  );

  g.drawImage(
    spr,
    -off - DESIGN_W,
    y,
    DESIGN_W,
    bank.h
  );
}

function drawSkyCloud(g, c, spr, t) {
  const span = DESIGN_W + c.w * 2;

  const x =
    ((c.x + t * c.speed) % span) -
    c.w;

  g.globalAlpha = c.alpha;

  g.drawImage(
    spr,
    x - c.w / 2,
    c.y - c.h * 0.6,
    c.w,
    c.h
  );

  g.globalAlpha = 1;
}

/* -------------------------------------------------------------------------- */
/* ISLAND DATA                                                                 */
/* -------------------------------------------------------------------------- */

const ISLAND_DEFS = [
  {
    x: 190,
    y: 505,
    w: 430,
    depth: 155,
    seed: 12,
    style: "village",
    z: 1,
    waterfalls: [0.22, 0.72],
    crystal: [120, 232, 255],
  },
  {
    x: 615,
    y: 425,
    w: 470,
    depth: 180,
    seed: 25,
    style: "castle",
    z: 1,
    waterfalls: [0.16, 0.48, 0.83],
    crystal: [255, 150, 230],
  },
  {
    x: 1115,
    y: 500,
    w: 420,
    depth: 170,
    seed: 39,
    style: "village",
    mill: true,
    z: 1,
    waterfalls: [0.35, 0.76],
    crystal: [140, 255, 214],
  },
  {
    x: 1450,
    y: 330,
    w: 330,
    depth: 145,
    seed: 48,
    style: "tower",
    z: 0.6,
    waterfalls: [0.25, 0.66],
    crystal: [120, 232, 255],
  },
  {
    x: 430,
    y: 280,
    w: 270,
    depth: 120,
    seed: 67,
    style: "shrine",
    z: 0.62,
    waterfalls: [0.48],
    crystal: [255, 170, 240],
  },
  {
    x: 960,
    y: 255,
    w: 280,
    depth: 125,
    seed: 78,
    style: "tower",
    z: 0.58,
    waterfalls: [0.28, 0.75],
    crystal: [150, 220, 255],
  },
  {
    x: 100,
    y: 235,
    w: 200,
    depth: 90,
    seed: 91,
    style: "wild",
    z: 0.26,
    waterfalls: [],
    crystal: [255, 170, 240],
  },
  {
    x: 1625,
    y: 150,
    w: 170,
    depth: 80,
    seed: 97,
    style: "wild",
    z: 0.24,
    waterfalls: [],
    crystal: [140, 255, 214],
  },
];

const BRIDGES = [
  {
    a: 4,
    b: 5,
    ax: 0.92,
    bx: 0.1,
    back: true,
  },
  {
    a: 5,
    b: 3,
    ax: 0.9,
    bx: 0.1,
    back: true,
  },
  {
    a: 1,
    b: 2,
    ax: 0.95,
    bx: 0.08,
    back: false,
  },
];

const FALL_END = 742;

function surfY(isl, x) {
  const p = clamp(
    (x - (isl.x - isl.w / 2)) /
      isl.w,
    0,
    1
  );

  const edge =
    1 -
    smoothstep(0, 0.09, p) +
    (1 -
      smoothstep(
        0,
        0.09,
        1 - p
      ));

  return (
    isl.y -
    11 * Math.sin(p * Math.PI) +
    (noise(p * 5 + isl.seed) - 0.5) * 7 +
    edge * 13
  );
}

function undersideY(isl, x) {
  const u = isl.under;

  if (x <= u[0][0]) {
    return u[0][1];
  }

  for (let i = 0; i < u.length - 1; i++) {
    if (
      x >= u[i][0] &&
      x <= u[i + 1][0]
    ) {
      const k =
        (x - u[i][0]) /
        Math.max(
          0.001,
          u[i + 1][0] -
            u[i][0]
        );

      return lerp(
        u[i][1],
        u[i + 1][1],
        k
      );
    }
  }

  return u[u.length - 1][1];
}

const bobOf = (isl, t) =>
  Math.sin(
    t * isl.bobSpeed +
      isl.bobPhase
  ) * isl.bobAmp;

/* -------------------------------------------------------------------------- */
/* TREES / BUILDINGS                                                           */
/* -------------------------------------------------------------------------- */

const PINES = [
  [36, 82, 74],
  [52, 108, 84],
];

const LEAF = [
  [52, 98, 68],
  [96, 150, 84],
  [176, 210, 112],
];

const SAKURA = [
  [196, 106, 138],
  [238, 162, 188],
  [255, 216, 228],
];

const WALLS = [
  [214, 190, 170],
  [200, 170, 150],
  [178, 160, 172],
  [222, 202, 160],
];

const ROOFS = [
  [98, 66, 110],
  [132, 70, 86],
  [70, 72, 122],
  [152, 88, 86],
];

const STONE = [192, 172, 178];

const FLAG_COLS = [
  [222, 96, 108],
  [232, 168, 90],
  [102, 176, 208],
];

function drawTree(g, x, y, s, type, seed) {
  const r = seeded(seed);

  g.fillStyle =
    "rgba(20,20,40,0.22)";

  ell(
    g,
    x + 3 * s,
    y + 1,
    13 * s,
    3.5 * s
  );

  g.fill();

  if (type === "pine") {
    g.fillStyle = "#4a3436";

    g.fillRect(
      x - 1.6 * s,
      y - 10 * s,
      3.2 * s,
      12 * s
    );

    for (let i = 0; i < 4; i++) {
      const yy =
        y - (6 + i * 11) * s;

      const hw =
        (17 - i * 3.2) * s;

      g.fillStyle = col(
        PINES[i % 2]
      );

      tri(
        g,
        x,
        yy - 16 * s,
        x - hw,
        yy,
        x + hw,
        yy
      );

      g.fillStyle =
        "rgba(210,236,140,0.22)";

      tri(
        g,
        x,
        yy - 16 * s,
        x + hw,
        yy,
        x + hw * 0.1,
        yy
      );

      g.fill();
    }

    return;
  }

  const pal =
    type === "sakura"
      ? SAKURA
      : LEAF;

  g.strokeStyle = "#4a3436";
  g.lineWidth = 3 * s;
  g.lineCap = "round";

  g.beginPath();

  g.moveTo(x, y + 2);

  g.quadraticCurveTo(
    x + 2 * s,
    y - 14 * s,
    x,
    y - 24 * s
  );

  g.stroke();

  const blobs = [];

  for (let i = 0; i < 5; i++) {
    blobs.push({
      x:
        x +
        (r() - 0.5) *
          22 *
          s,
      y:
        y -
        (26 + r() * 14) *
          s,
      r:
        (10 + r() * 5) *
        s,
    });
  }

  for (const b of blobs) {
    g.fillStyle = col(pal[0]);

    circ(g, b.x, b.y, b.r);

    g.fill();
  }

  for (const b of blobs) {
    g.fillStyle = col(pal[1]);

    circ(
      g,
      b.x + b.r * 0.22,
      b.y - b.r * 0.28,
      b.r * 0.72
    );

    g.fill();
  }

  for (const b of blobs) {
    g.fillStyle = col(
      pal[2],
      0.8
    );

    circ(
      g,
      b.x + b.r * 0.34,
      b.y - b.r * 0.45,
      b.r * 0.36
    );

    g.fill();
  }
}

function glowSprite(g, x, y, rad, c, a) {
  g.save();

  g.globalCompositeOperation =
    "lighter";

  const gr =
    g.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      rad
    );

  gr.addColorStop(0, col(c, a));
  gr.addColorStop(1, col(c, 0));

  g.fillStyle = gr;

  circ(g, x, y, rad);
  g.fill();

  g.restore();
}

function windowRect(g, x, y, w, h) {
  g.fillStyle =
    "rgba(255,208,122,0.95)";

  g.fillRect(x, y, w, h);

  g.fillStyle =
    "rgba(120,70,60,0.55)";

  g.fillRect(
    x + w / 2 - 0.4,
    y,
    0.8,
    h
  );

  glowSprite(
    g,
    x + w / 2,
    y + h / 2,
    Math.max(w, h) * 2.2,
    [255, 200, 120],
    0.4
  );
}

function drawHouse(g, x, y, s, seed, dyn) {
  const r = seeded(seed);

  const w =
    (26 + r() * 14) * s;

  const h =
    (20 + r() * 14) * s;

  const wall =
    WALLS[
      Math.floor(
        r() * WALLS.length
      )
    ];

  const roof =
    ROOFS[
      Math.floor(
        r() * ROOFS.length
      )
    ];

  g.fillStyle =
    "rgba(20,20,35,0.28)";

  ell(
    g,
    x + 2 * s,
    y + 1,
    w * 0.62,
    3.6 * s
  );

  g.fill();

  const wg =
    g.createLinearGradient(
      x - w / 2,
      0,
      x + w / 2,
      0
    );

  wg.addColorStop(
    0,
    col(
      mixc(
        wall,
        [50, 36, 70],
        0.4
      )
    )
  );

  wg.addColorStop(
    1,
    col(
      mixc(
        wall,
        [255, 205, 150],
        0.3
      )
    )
  );

  g.fillStyle = wg;

  g.fillRect(
    x - w / 2,
    y - h,
    w,
    h
  );

  g.fillStyle =
    "rgba(70,46,52,0.45)";

  g.fillRect(
    x - w / 2,
    y - h,
    2 * s,
    h
  );

  g.fillRect(
    x + w / 2 - 2 * s,
    y - h,
    2 * s,
    h
  );

  g.fillRect(
    x - w / 2,
    y - h * 0.5,
    w,
    1.5 * s
  );

  if (r() > 0.4) {
    const cx =
      x + w * 0.22;

    const top =
      y - h - w * 0.5;

    g.fillStyle = "#5b4a54";

    g.fillRect(
      cx,
      top,
      w * 0.14,
      w * 0.36
    );

    g.fillStyle = "#463a46";

    g.fillRect(
      cx - 1,
      top - 2 * s,
      w * 0.14 + 2,
      2.4 * s
    );

    dyn.push({
      k: "smoke",
      x: cx + w * 0.07,
      y: top - 3 * s,
      seed,
    });
  }

  const rh = w * 0.6;

  g.fillStyle = col(roof);

  tri(
    g,
    x - w * 0.66,
    y - h,
    x,
    y - h - rh,
    x + w * 0.66,
    y - h
  );

  g.fill();

  g.fillStyle =
    "rgba(255,172,130,0.28)";

  tri(
    g,
    x,
    y - h - rh,
    x + w * 0.66,
    y - h,
    x,
    y - h
  );

  g.fill();

  g.strokeStyle = col(
    mixc(
      roof,
      [255, 220, 190],
      0.45
    ),
    0.8
  );

  g.lineWidth = 1.2 * s;

  g.beginPath();

  g.moveTo(
    x - w * 0.66,
    y - h
  );

  g.lineTo(
    x,
    y - h - rh
  );

  g.lineTo(
    x + w * 0.66,
    y - h
  );

  g.stroke();

  g.fillStyle = "#47323f";

  g.beginPath();

  g.moveTo(
    x - w * 0.12,
    y
  );

  g.lineTo(
    x - w * 0.12,
    y - h * 0.34
  );

  g.quadraticCurveTo(
    x,
    y - h * 0.5,
    x + w * 0.12,
    y - h * 0.34
  );

  g.lineTo(
    x + w * 0.12,
    y
  );

  g.closePath();

  g.fill();

  windowRect(
    g,
    x - w * 0.36,
    y - h * 0.74,
    w * 0.17,
    h * 0.22
  );

  if (r() > 0.3) {
    windowRect(
      g,
      x + w * 0.19,
      y - h * 0.74,
      w * 0.17,
      h * 0.22
    );
  }

  return {
    x,
    half: w * 0.7,
  };
}

function stoneRect(g, x, y, w, h) {
  const gr =
    g.createLinearGradient(
      x,
      0,
      x + w,
      0
    );

  gr.addColorStop(
    0,
    col(
      mixc(
        STONE,
        [60, 46, 84],
        0.45
      )
    )
  );

  gr.addColorStop(
    1,
    col(
      mixc(
        STONE,
        [255, 206, 156],
        0.35
      )
    )
  );

  g.fillStyle = gr;
  g.fillRect(x, y, w, h);

  g.fillStyle =
    "rgba(60,44,70,0.16)";

  for (
    let yy = y + 6;
    yy < y + h - 2;
    yy += 7
  ) {
    g.fillRect(
      x,
      yy,
      w,
      0.9
    );
  }
}

function cone(g, cx, by, w, h, c) {
  g.fillStyle = col(c);

  tri(
    g,
    cx - w / 2,
    by,
    cx,
    by - h,
    cx + w / 2,
    by
  );

  g.fill();

  g.fillStyle =
    "rgba(255,172,130,0.3)";

  tri(
    g,
    cx,
    by - h,
    cx + w / 2,
    by,
    cx,
    by
  );

  g.fill();
}

function drawCastle(g, x, y, s, seed, dyn) {
  g.fillStyle =
    "rgba(20,20,35,0.3)";

  ell(
    g,
    x,
    y + 2,
    92 * s,
    10 * s
  );

  g.fill();

  stoneRect(
    g,
    x - 62 * s,
    y - 34 * s,
    124 * s,
    34 * s
  );

  for (let i = -5; i <= 5; i++) {
    g.fillStyle = col(
      mixc(
        STONE,
        [255, 206, 156],
        0.2
      )
    );

    g.fillRect(
      x + i * 11 * s - 3 * s,
      y - 40 * s,
      6 * s,
      6 * s
    );
  }

  g.fillStyle = "#3a2c3c";

  g.beginPath();

  g.moveTo(
    x - 11 * s,
    y
  );

  g.lineTo(
    x - 11 * s,
    y - 16 * s
  );

  g.arc(
    x,
    y - 16 * s,
    11 * s,
    Math.PI,
    0
  );

  g.lineTo(
    x + 11 * s,
    y
  );

  g.closePath();

  g.fill();

  glowSprite(
    g,
    x,
    y - 10 * s,
    18 * s,
    [255, 190, 110],
    0.35
  );

  stoneRect(
    g,
    x - 24 * s,
    y - 92 * s,
    48 * s,
    62 * s
  );

  cone(
    g,
    x,
    y - 92 * s,
    62 * s,
    50 * s,
    [56, 44, 86]
  );

  windowRect(
    g,
    x - 3.5 * s,
    y - 76 * s,
    7 * s,
    11 * s
  );

  windowRect(
    g,
    x - 14 * s,
    y - 56 * s,
    6 * s,
    9 * s
  );

  windowRect(
    g,
    x + 8 * s,
    y - 56 * s,
    6 * s,
    9 * s
  );

  for (const sx of [-1, 1]) {
    const tx =
      x + sx * 60 * s;

    stoneRect(
      g,
      tx - 13 * s,
      y - 78 * s,
      26 * s,
      78 * s
    );

    cone(
      g,
      tx,
      y - 78 * s,
      38 * s,
      38 * s,
      sx < 0
        ? [78, 54, 96]
        : [128, 66, 88]
    );

    windowRect(
      g,
      tx - 3 * s,
      y - 62 * s,
      6 * s,
      10 * s
    );

    windowRect(
      g,
      tx - 3 * s,
      y - 38 * s,
      6 * s,
      10 * s
    );

    dyn.push({
      k: "flag",
      x: tx,
      y:
        y -
        78 * s -
        38 * s,
      size: 22 * s,
      seed: seed + sx * 3,
    });
  }

  dyn.push({
    k: "flag",
    x,
    y:
      y -
      92 * s -
      50 * s,
    size: 28 * s,
    seed: seed + 1,
  });
}

function drawTower(g, x, y, s, seed, dyn) {
  const h =
    (92 + hash(seed) * 30) * s;

  const w = 26 * s;

  g.fillStyle =
    "rgba(20,20,35,0.28)";

  ell(
    g,
    x,
    y + 2,
    26 * s,
    5 * s
  );

  g.fill();

  g.fillStyle = col(
    mixc(
      STONE,
      [90, 70, 100],
      0.35
    )
  );

  g.beginPath();

  g.moveTo(
    x - w * 0.9,
    y
  );

  g.lineTo(
    x - w * 0.5,
    y - 22 * s
  );

  g.lineTo(
    x + w * 0.5,
    y - 22 * s
  );

  g.lineTo(
    x + w * 0.9,
    y
  );

  g.closePath();

  g.fill();

  stoneRect(
    g,
    x - w / 2,
    y - h,
    w,
    h - 18 * s
  );

  g.fillStyle = col(
    mixc(
      STONE,
      [255, 206, 156],
      0.2
    )
  );

  g.fillRect(
    x - w * 0.75,
    y - h,
    w * 1.5,
    5 * s
  );

  for (let i = -2; i <= 2; i++) {
    g.fillRect(
      x +
        i * w * 0.3 -
        1.4 * s,
      y - h - 7 * s,
      2.8 * s,
      7 * s
    );
  }

  cone(
    g,
    x,
    y - h - 7 * s,
    w * 1.5,
    42 * s,
    [60, 48, 98]
  );

  for (
    let yy = y - h + 16 * s;
    yy < y - 30 * s;
    yy += 20 * s
  ) {
    windowRect(
      g,
      x - 3 * s,
      yy,
      6 * s,
      9 * s
    );
  }

  dyn.push({
    k: "flag",
    x,
    y:
      y -
      h -
      7 * s -
      42 * s,
    size: 24 * s,
    seed,
  });

  dyn.push({
    k: "glow",
    x,
    y: y - h - 5 * s,
    r: 24 * s,
    c: [255, 210, 130],
    ph: seed,
  });
}

function drawShrine(g, x, y, s, seed, dyn) {
  g.fillStyle =
    "rgba(20,20,35,0.28)";

  ell(
    g,
    x,
    y + 2,
    62 * s,
    8 * s
  );

  g.fill();

  g.fillStyle = col(
    mixc(
      STONE,
      [90, 70, 100],
      0.3
    )
  );

  g.fillRect(
    x - 54 * s,
    y - 6 * s,
    108 * s,
    6 * s
  );

  g.fillStyle = col(STONE);

  g.fillRect(
    x - 46 * s,
    y - 12 * s,
    92 * s,
    6 * s
  );

  for (let i = -2; i <= 2; i++) {
    const px =
      x + i * 19 * s;

    const pg =
      g.createLinearGradient(
        px - 3.5 * s,
        0,
        px + 3.5 * s,
        0
      );

    pg.addColorStop(
      0,
      "#c9a99a"
    );

    pg.addColorStop(
      1,
      "#f3dfc4"
    );

    g.fillStyle = pg;

    g.fillRect(
      px - 3.5 * s,
      y - 52 * s,
      7 * s,
      40 * s
    );
  }

  glowSprite(
    g,
    x,
    y - 32 * s,
    38 * s,
    [255, 200, 120],
    0.55
  );

  for (let tier = 0; tier < 2; tier++) {
    const ty =
      y -
      (52 + tier * 20) *
        s;

    const hw =
      (58 - tier * 18) * s;

    g.fillStyle = tier
      ? "#5a3a5e"
      : "#4b3358";

    g.beginPath();

    g.moveTo(
      x - hw - 8 * s,
      ty + 6 * s
    );

    g.quadraticCurveTo(
      x - hw * 0.5,
      ty - 2 * s,
      x,
      ty - 18 * s
    );

    g.quadraticCurveTo(
      x + hw * 0.5,
      ty - 2 * s,
      x + hw + 8 * s,
      ty + 6 * s
    );

    g.quadraticCurveTo(
      x,
      ty + 2 * s,
      x - hw - 8 * s,
      ty + 6 * s
    );

    g.closePath();

    g.fill();

    g.strokeStyle =
      "rgba(255,190,150,0.5)";

    g.lineWidth = 1.4 * s;

    g.beginPath();

    g.moveTo(
      x,
      ty - 18 * s
    );

    g.quadraticCurveTo(
      x + hw * 0.5,
      ty - 2 * s,
      x + hw + 8 * s,
      ty + 6 * s
    );

    g.stroke();
  }

  dyn.push({
    k: "orb",
    x,
    y: y - 108 * s,
    seed,
  });
}

function drawWindmill(g, x, y, s, dyn) {
  g.fillStyle =
    "rgba(20,20,35,0.28)";

  ell(
    g,
    x,
    y + 1,
    20 * s,
    4 * s
  );

  g.fill();

  const bg =
    g.createLinearGradient(
      x - 15 * s,
      0,
      x + 15 * s,
      0
    );

  bg.addColorStop(
    0,
    "#9a8190"
  );

  bg.addColorStop(
    1,
    "#e9cdb3"
  );

  g.fillStyle = bg;

  g.beginPath();

  g.moveTo(
    x - 16 * s,
    y
  );

  g.lineTo(
    x - 9 * s,
    y - 56 * s
  );

  g.lineTo(
    x + 9 * s,
    y - 56 * s
  );

  g.lineTo(
    x + 16 * s,
    y
  );

  g.closePath();

  g.fill();

  g.fillStyle = "#5a3a56";

  g.beginPath();

  g.moveTo(
    x - 12 * s,
    y - 56 * s
  );

  g.quadraticCurveTo(
    x,
    y - 76 * s,
    x + 12 * s,
    y - 56 * s
  );

  g.closePath();

  g.fill();

  g.fillStyle = "#47323f";

  g.fillRect(
    x - 3.5 * s,
    y - 14 * s,
    7 * s,
    14 * s
  );

  windowRect(
    g,
    x - 2.5 * s,
    y - 40 * s,
    5 * s,
    8 * s
  );

  dyn.push({
    k: "mill",
    x,
    y: y - 50 * s,
    len: 38 * s,
  });
}

/* -------------------------------------------------------------------------- */
/* ISLAND SPRITES                                                              */
/* -------------------------------------------------------------------------- */

function prepareIsland(isl, idx) {
  const r = seeded(
    isl.seed * 7 + 3
  );

  isl.idx = idx;

  isl.xL =
    isl.x - isl.w / 2;

  isl.xR =
    isl.x + isl.w / 2;

  isl.bobAmp =
    lerp(
      1.5,
      5.5,
      isl.z
    ) *
    (0.8 + r() * 0.5);

  isl.bobSpeed =
    0.35 + r() * 0.25;

  isl.bobPhase =
    r() * TAU;

  const under = [];
  const N = 22;

  for (let i = 1; i < N; i++) {
    const p = i / N;

    const x =
      isl.xL +
      p * isl.w;

    const shape = Math.pow(
      Math.sin(p * Math.PI),
      0.8
    );

    let d =
      isl.depth *
      shape *
      (0.8 +
        0.32 *
          noise(
            p * 4 +
              isl.seed
          ));

    d *=
      i % 3 === 1
        ? 1 + 0.2 * r()
        : 0.88 + 0.06 * r();

    under.push([
      x + (r() - 0.5) * 8,
      surfY(isl, x) +
        12 +
        d,
    ]);
  }

  isl.under = under;

  isl.falls =
    isl.waterfalls.map(
      (ratio, k) => {
        const x =
          isl.xL +
          ratio * isl.w;

        return {
          x,
          y0:
            surfY(isl, x) +
            7,
          y1: undersideY(
            isl,
            x
          ),
          yEnd: FALL_END,
          w: 11 + r() * 6,
          seed:
            isl.seed +
            k * 5.3,
        };
      }
    );
}

function buildIsland(isl, q) {
  const bx =
    isl.xL - 70;

  const bw =
    isl.w + 140;

  const haze =
    (1 - isl.z) * 0.62;

  const hazeCol =
    [178, 146, 190];

  const rby =
    isl.y - 40;

  const rbh =
    isl.depth + 150;

  const outline = [
    [
      isl.xL - 3,
      surfY(
        isl,
        isl.xL
      ) + 8,
    ],
    ...isl.under,
    [
      isl.xR + 3,
      surfY(
        isl,
        isl.xR
      ) + 8,
    ],
  ];

  for (let i = 1; i <= 9; i++) {
    const x =
      isl.xR -
      (i / 10) *
        isl.w;

    outline.push([
      x,
      surfY(isl, x) +
        8,
    ]);
  }

  isl.rock = sprite(
    bw,
    rbh,
    q,
    (g) => {
      g.translate(
        -bx,
        -rby
      );

      const fr = seeded(
        isl.seed * 11 + 1
      );

      smoothClosed(
        g,
        outline
      );

      const gr =
        g.createLinearGradient(
          0,
          isl.y,
          0,
          isl.y +
            isl.depth +
            40
        );

      gr.addColorStop(
        0,
        "#5e5072"
      );

      gr.addColorStop(
        0.35,
        "#403b62"
      );

      gr.addColorStop(
        0.7,
        "#2b2b4e"
      );

      gr.addColorStop(
        1,
        "#1c1d3a"
      );

      g.fillStyle = gr;
      g.fill();

      g.save();

      smoothClosed(
        g,
        outline
      );

      g.clip();

      const hg =
        g.createLinearGradient(
          isl.xL,
          0,
          isl.xR,
          0
        );

      hg.addColorStop(
        0,
        "rgba(16,16,48,0.42)"
      );

      hg.addColorStop(
        0.5,
        "rgba(0,0,0,0)"
      );

      hg.addColorStop(
        1,
        "rgba(255,168,118,0.34)"
      );

      g.fillStyle = hg;

      g.fillRect(
        isl.xL - 10,
        isl.y - 20,
        isl.w + 20,
        isl.depth + 100
      );

      for (let i = 0; i < 20; i++) {
        const fx =
          isl.xL +
          fr() * isl.w;

        const fy =
          isl.y +
          10 +
          fr() *
            isl.depth *
            0.85;

        const sz =
          18 +
          fr() * 36;

        g.fillStyle =
          fr() > 0.5
            ? "rgba(255,226,200,0.07)"
            : "rgba(8,6,28,0.12)";

        tri(
          g,
          fx,
          fy - sz,
          fx -
            sz *
              0.8,
          fy +
            sz *
              0.6,
          fx +
            sz *
              (0.4 +
                fr() * 0.6),
          fy +
            sz *
              0.7
        );

        g.fill();
      }

      g.strokeStyle =
        "rgba(190,180,215,0.13)";

      g.lineWidth = 1.6;

      for (
        let yy =
          isl.y + 36;
        yy <
        isl.y +
          isl.depth;
        yy += 17
      ) {
        g.beginPath();

        g.moveTo(
          isl.xL - 10,
          yy
        );

        g.bezierCurveTo(
          isl.xL +
            isl.w * 0.3,
          yy - 5,
          isl.xL +
            isl.w * 0.65,
          yy + 6,
          isl.xR + 10,
          yy - 1
        );

        g.stroke();
      }

      const ao =
        g.createLinearGradient(
          0,
          isl.y - 10,
          0,
          isl.y + 50
        );

      ao.addColorStop(
        0,
        "rgba(14,10,30,0.55)"
      );

      ao.addColorStop(
        1,
        "rgba(14,10,30,0)"
      );

      g.fillStyle = ao;

      g.fillRect(
        isl.xL - 10,
        isl.y - 10,
        isl.w + 20,
        70
      );

      const bg =
        g.createLinearGradient(
          0,
          isl.y +
            isl.depth *
              0.55,
          0,
          isl.y +
            isl.depth +
            30
        );

      bg.addColorStop(
        0,
        "rgba(240,160,160,0)"
      );

      bg.addColorStop(
        1,
        "rgba(246,176,170,0.32)"
      );

      g.fillStyle = bg;

      g.fillRect(
        isl.xL - 10,
        isl.y +
          isl.depth *
            0.5,
        isl.w + 20,
        isl.depth
      );

      g.restore();

      smoothClosed(
        g,
        outline
      );

      const rg =
        g.createLinearGradient(
          isl.xL,
          0,
          isl.xR,
          0
        );

      rg.addColorStop(
        0,
        "rgba(255,190,140,0)"
      );

      rg.addColorStop(
        0.5,
        "rgba(255,190,140,0.05)"
      );

      rg.addColorStop(
        1,
        "rgba(255,206,150,0.85)"
      );

      g.strokeStyle = rg;
      g.lineWidth = 2.4;
      g.lineJoin = "round";

      g.stroke();

      const vr = seeded(
        isl.seed * 3 + 9
      );

      g.lineCap = "round";

      for (let k = 0; k < 7; k++) {
        const x =
          isl.xL +
          (0.08 +
            0.84 * vr()) *
            isl.w;

        const y0 =
          surfY(
            isl,
            x
          ) + 14;

        const len =
          22 + vr() * 55;

        const sway =
          (vr() - 0.5) * 16;

        g.strokeStyle =
          "#3e6a47";

        g.lineWidth = 1.6;

        g.beginPath();

        g.moveTo(x, y0);

        g.quadraticCurveTo(
          x + sway,
          y0 +
            len *
              0.55,
          x +
            sway *
              0.4,
          y0 + len
        );

        g.stroke();

        for (
          let j = 1;
          j <= 4;
          j++
        ) {
          const u = j / 5;

          const lx =
            x +
            sway *
              u *
              u *
              1.2;

          const ly =
            y0 +
            len * u;

          g.fillStyle =
            j % 2
              ? "#5d9a58"
              : "#7bb765";

          ell(
            g,
            lx +
              (j % 2
                ? 3
                : -3),
            ly,
            3.4,
            1.8,
            j % 2
              ? 0.5
              : -0.5
          );

          g.fill();
        }
      }

      isl.crystals = [];

      const cr = seeded(
        isl.seed * 5 + 2
      );

      const idxs = [
        Math.floor(
          isl.under.length *
            0.3
        ),
        Math.floor(
          isl.under.length *
            0.5
        ),
        Math.floor(
          isl.under.length *
            0.7
        ),
      ];

      const cc =
        isl.crystal;

      for (const ix of idxs) {
        const [
          px,
          py,
        ] = isl.under[ix];

        const len =
          14 + cr() * 18;

        const wd =
          5 + cr() * 3;

        const cg =
          g.createLinearGradient(
            px - wd,
            py,
            px + wd,
            py + len
          );

        cg.addColorStop(
          0,
          col(
            mixc(
              cc,
              [255, 255, 255],
              0.55
            )
          )
        );

        cg.addColorStop(
          1,
          col(
            mixc(
              cc,
              [60, 40, 140],
              0.4
            )
          )
        );

        g.fillStyle = cg;

        g.beginPath();

        g.moveTo(
          px - wd,
          py - 5
        );

        g.lineTo(
          px + wd,
          py - 5
        );

        g.lineTo(
          px +
            wd * 0.6,
          py +
            len * 0.6
        );

        g.lineTo(
          px,
          py + len
        );

        g.lineTo(
          px -
            wd * 0.6,
          py +
            len * 0.6
        );

        g.closePath();

        g.fill();

        g.fillStyle =
          "rgba(255,255,255,0.35)";

        tri(
          g,
          px - wd * 0.2,
          py - 5,
          px + wd,
          py - 5,
          px +
            wd * 0.1,
          py +
            len * 0.85
        );

        g.fill();

        isl.crystals.push({
          x: px,
          y:
            py +
            len * 0.55,
          r: 26 + len,
          ph: cr() * TAU,
        });
      }

      if (haze > 0) {
        g.globalCompositeOperation =
          "source-atop";

        g.fillStyle = col(
          hazeCol,
          haze
        );

        g.fillRect(
          bx,
          rby,
          bw,
          rbh
        );
      }
    }
  );

  isl.rbx = bx;
  isl.rby = rby;
  isl.rbw = bw;
  isl.rbh = rbh;

  const tby =
    isl.y - 250;

  const tbh = 310;

  isl.dyn = [];

  isl.top = sprite(
    bw,
    tbh,
    q,
    (g) => {
      g.translate(
        -bx,
        -tby
      );

      const r = seeded(
        isl.seed * 13 + 5
      );

      g.beginPath();

      g.moveTo(
        isl.xL,
        surfY(
          isl,
          isl.xL
        )
      );

      for (
        let x = isl.xL;
        x <= isl.xR;
        x += 6
      ) {
        g.lineTo(
          x,
          surfY(isl, x)
        );
      }

      for (
        let x = isl.xR;
        x >= isl.xL;
        x -= 6
      ) {
        const edge =
          1 -
          smoothstep(
            0,
            0.08,
            (x - isl.xL) /
              isl.w
          ) +
          (1 -
            smoothstep(
              0,
              0.08,
              (isl.xR - x) /
                isl.w
            ));

        g.lineTo(
          x,
          surfY(isl, x) +
            13 +
            6 *
              noise(
                x * 0.05 +
                  isl.seed
              ) +
            edge * 4
        );
      }

      g.closePath();

      const sg =
        g.createLinearGradient(
          0,
          isl.y - 20,
          0,
          isl.y + 32
        );

      sg.addColorStop(
        0,
        "#74586a"
      );

      sg.addColorStop(
        1,
        "#3a2f48"
      );

      g.fillStyle = sg;
      g.fill();

      g.beginPath();

      g.moveTo(
        isl.xL,
        surfY(
          isl,
          isl.xL
        ) - 1
      );

      for (
        let x = isl.xL;
        x <= isl.xR;
        x += 5
      ) {
        g.lineTo(
          x,
          surfY(isl, x) -
            1.5
        );
      }

      for (
        let x = isl.xR;
        x >= isl.xL;
        x -= 5
      ) {
        g.lineTo(
          x,
          surfY(isl, x) +
            7 +
            2 *
              noise(
                x * 0.09
              )
        );
      }

      g.closePath();

      const gg =
        g.createLinearGradient(
          0,
          isl.y - 22,
          0,
          isl.y + 22
        );

      gg.addColorStop(
        0,
        "#b4dc74"
      );

      gg.addColorStop(
        0.5,
        "#78ac56"
      );

      gg.addColorStop(
        1,
        "#4b8049"
      );

      g.fillStyle = gg;
      g.fill();

      for (
        let x = isl.xL + 4;
        x < isl.xR - 2;
        x += 9
      ) {
        g.fillStyle = "#5d9652";

        ell(
          g,
          x,
          surfY(
            isl,
            x
          ) + 8,
          5.4,
          4
        );

        g.fill();
      }

      g.strokeStyle =
        "rgba(255,240,170,0.6)";

      g.lineWidth = 1.7;

      g.beginPath();

      g.moveTo(
        isl.x,
        surfY(
          isl,
          isl.x
        ) - 1.5
      );

      for (
        let x = isl.x;
        x <= isl.xR;
        x += 5
      ) {
        g.lineTo(
          x,
          surfY(isl, x) -
            1.5
        );
      }

      g.stroke();

      for (let i = 0; i < 90; i++) {
        const x =
          isl.xL +
          6 +
          r() *
            (isl.w - 12);

        const y =
          surfY(isl, x);

        g.strokeStyle = col(
          mixc(
            [110, 168, 80],
            [190, 224, 120],
            r()
          ),
          0.7
        );

        g.lineWidth = 1.2;

        g.beginPath();

        g.moveTo(
          x,
          y + 1
        );

        g.lineTo(
          x +
            (r() - 0.5) * 6,
          y -
            4 -
            r() * 5
        );

        g.stroke();
      }

      const spans = [];
      const placed = [];
      const dyn = isl.dyn;

      const sy = (x) =>
        surfY(isl, x) + 1;

      const backCount =
        Math.round(
          isl.w / 70
        );

      const treeType = () => {
        const v = r();

        if (
          isl.style ===
          "shrine"
        ) {
          return v < 0.6
            ? "sakura"
            : "round";
        }

        if (
          isl.style ===
          "castle"
        ) {
          return v < 0.4
            ? "pine"
            : v < 0.8
            ? "round"
            : "sakura";
        }

        return v < 0.35
          ? "pine"
          : v < 0.8
          ? "round"
          : "sakura";
      };

      for (
        let i = 0;
        i < backCount;
        i++
      ) {
        const x =
          isl.xL +
          20 +
          r() *
            (isl.w - 40);

        drawTree(
          g,
          x,
          sy(x) - 1,
          0.55 +
            r() * 0.35,
          treeType(),
          isl.seed +
            2000 +
            i
        );
      }

      if (
        isl.style ===
        "castle"
      ) {
        spans.push([
          isl.x - 100,
          isl.x + 100,
        ]);

        drawCastle(
          g,
          isl.x,
          sy(isl.x) + 2,
          1.15,
          isl.seed,
          dyn
        );

        for (const off of [
          -205,
          -150,
          150,
          205,
        ]) {
          const hx =
            isl.x + off;

          const b =
            drawHouse(
              g,
              hx,
              sy(hx) + 2,
              0.62 +
                r() * 0.2,
              isl.seed + off,
              dyn
            );

          spans.push([
            b.x - b.half,
            b.x + b.half,
          ]);
        }
      } else if (
        isl.style ===
        "village"
      ) {
        const count = 5;

        for (
          let i = 0;
          i < count;
          i++
        ) {
          const hx =
            isl.x +
            (i - 2) *
              isl.w *
              0.17 +
            (r() - 0.5) *
              16 +
            (isl.mill
              ? 28
              : 0);

          const b =
            drawHouse(
              g,
              hx,
              sy(hx) + 2,
              0.62 +
                r() * 0.32,
              isl.seed +
                i * 12,
              dyn
            );

          spans.push([
            b.x - b.half,
            b.x + b.half,
          ]);
        }

        if (isl.mill) {
          const mx =
            isl.x -
            isl.w * 0.36;

          drawWindmill(
            g,
            mx,
            sy(mx) + 2,
            1.05,
            dyn
          );

          spans.push([
            mx - 22,
            mx + 22,
          ]);
        }
      } else if (
        isl.style ===
        "tower"
      ) {
        drawTower(
          g,
          isl.x,
          sy(isl.x) + 2,
          1.05,
          isl.seed,
          dyn
        );

        spans.push([
          isl.x - 32,
          isl.x + 32,
        ]);

        for (const off of [
          -72,
          72,
        ]) {
          const hx =
            isl.x + off;

          const b =
            drawHouse(
              g,
              hx,
              sy(hx) + 2,
              0.58,
              isl.seed + off,
              dyn
            );

          spans.push([
            b.x - b.half,
            b.x + b.half,
          ]);
        }
      } else if (
        isl.style ===
        "shrine"
      ) {
        drawShrine(
          g,
          isl.x,
          sy(isl.x) + 2,
          1,
          isl.seed,
          dyn
        );

        spans.push([
          isl.x - 66,
          isl.x + 66,
        ]);
      }

      const frontCount =
        Math.round(
          isl.w / 55
        );

      for (
        let i = 0;
        i < frontCount;
        i++
      ) {
        const x =
          isl.xL +
          16 +
          r() *
            (isl.w - 32);

        if (
          spans.some(
            (s) =>
              x >
                s[0] - 8 &&
              x <
                s[1] + 8
          )
        ) {
          continue;
        }

        placed.push(x);

        drawTree(
          g,
          x,
          sy(x) + 1,
          0.7 +
            r() * 0.55,
          treeType(),
          isl.seed +
            3000 +
            i
        );
      }

      for (let i = 0; i < 26; i++) {
        const x =
          isl.xL +
          8 +
          r() *
            (isl.w - 16);

        g.fillStyle =
          r() > 0.5
            ? "rgba(255,196,214,0.95)"
            : "rgba(255,230,140,0.95)";

        circ(
          g,
          x,
          surfY(
            isl,
            x
          ) +
            3 +
            r() * 3,
          1.3
        );

        g.fill();
      }

      if (haze > 0) {
        g.globalCompositeOperation =
          "source-atop";

        g.fillStyle = col(
          hazeCol,
          haze
        );

        g.fillRect(
          bx,
          tby,
          bw,
          tbh
        );
      }
    }
  );

  isl.tbx = bx;
  isl.tby = tby;
  isl.tbw = bw;
  isl.tbh = tbh;
}

/* -------------------------------------------------------------------------- */
/* LIVE DECORATION                                                             */
/* -------------------------------------------------------------------------- */

function drawFlag(g, x, y, size, t, seed) {
  const c =
    FLAG_COLS[
      Math.abs(
        Math.floor(seed)
      ) % FLAG_COLS.length
    ];

  g.strokeStyle =
    "rgba(60,44,52,0.95)";

  g.lineWidth = 1.8;

  g.beginPath();

  g.moveTo(x, y);
  g.lineTo(
    x,
    y + size * 1.1
  );

  g.stroke();

  const seg = 7;
  const len = size * 0.9;
  const hgt = size * 0.34;

  const top = [];
  const bot = [];

  for (let i = 0; i <= seg; i++) {
    const u = i / seg;

    const w =
      Math.sin(
        t * 4.2 -
          u * 4.5 +
          seed
      ) *
      3.2 *
      u;

    const droop = u * 2;

    top.push([
      x + u * len,
      y +
        2 +
        w +
        droop * 0.3,
    ]);

    bot.push([
      x +
        u *
          len *
          (1 -
            0.1 * u),
      y +
        2 +
        hgt *
          (1 -
            0.35 * u) +
        w * 0.9 +
        droop,
    ]);
  }

  g.beginPath();

  g.moveTo(
    top[0][0],
    top[0][1]
  );

  for (
    let i = 1;
    i <= seg;
    i++
  ) {
    g.lineTo(
      top[i][0],
      top[i][1]
    );
  }

  for (
    let i = seg;
    i >= 0;
    i--
  ) {
    g.lineTo(
      bot[i][0],
      bot[i][1]
    );
  }

  g.closePath();

  g.fillStyle = col(c);
  g.fill();

  g.fillStyle =
    "rgba(255,255,255,0.18)";

  g.beginPath();

  g.moveTo(
    top[0][0],
    top[0][1]
  );

  for (
    let i = 1;
    i <= seg;
    i++
  ) {
    g.lineTo(
      top[i][0],
      top[i][1]
    );
  }

  g.lineTo(
    top[seg][0],
    top[seg][1] + 2
  );

  for (
    let i = seg;
    i >= 0;
    i--
  ) {
    g.lineTo(
      top[i][0],
      top[i][1] + 2
    );
  }

  g.closePath();

  g.fill();
}

function drawSmoke(g, d, t) {
  for (let k = 0; k < 6; k++) {
    const u =
      (t * 0.22 +
        k / 6 +
        hash(d.seed)) %
      1;

    const x =
      d.x +
      Math.sin(
        u * 7 + k
      ) *
        4 +
      u * 16;

    const y =
      d.y - u * 46;

    const r =
      2.2 + u * 7;

    g.fillStyle =
      `rgba(238,228,234,${(1 - u) * 0.3})`;

    circ(g, x, y, r);
    g.fill();
  }
}

function drawDyn(g, d, t) {
  switch (d.k) {
    case "flag":
      drawFlag(
        g,
        d.x,
        d.y,
        d.size,
        t,
        d.seed
      );
      break;

    case "smoke":
      drawSmoke(
        g,
        d,
        t
      );
      break;

    case "glow": {
      const p =
        0.7 +
        0.3 *
          Math.sin(
            t * 1.6 +
              d.ph
          );

      g.save();

      g.globalCompositeOperation =
        "lighter";

      const gr =
        g.createRadialGradient(
          d.x,
          d.y,
          0,
          d.x,
          d.y,
          d.r * 1.6
        );

      gr.addColorStop(
        0,
        col(
          d.c,
          0.6 * p
        )
      );

      gr.addColorStop(
        1,
        col(d.c, 0)
      );

      g.fillStyle = gr;

      circ(
        g,
        d.x,
        d.y,
        d.r * 1.6
      );

      g.fill();

      g.restore();

      break;
    }

    case "orb": {
      const y =
        d.y +
        Math.sin(
          t * 1.1 +
            d.seed
        ) *
          4;

      g.save();

      g.globalCompositeOperation =
        "lighter";

      const gr =
        g.createRadialGradient(
          d.x,
          y,
          0,
          d.x,
          y,
          30
        );

      gr.addColorStop(
        0,
        "rgba(255,236,190,0.95)"
      );

      gr.addColorStop(
        0.3,
        "rgba(255,190,140,0.4)"
      );

      gr.addColorStop(
        1,
        "rgba(255,160,140,0)"
      );

      g.fillStyle = gr;

      circ(
        g,
        d.x,
        y,
        30
      );

      g.fill();

      g.restore();

      g.fillStyle =
        "#fff6d8";

      circ(
        g,
        d.x,
        y,
        3.6
      );

      g.fill();

      for (let i = 0; i < 4; i++) {
        const a =
          t * 0.9 +
          i * (TAU / 4);

        g.fillStyle =
          "rgba(255,230,170,0.85)";

        circ(
          g,
          d.x +
            Math.cos(a) *
              14,
          y +
            Math.sin(a) *
              5,
          1.3
        );

        g.fill();
      }

      break;
    }

    case "mill": {
      g.save();

      g.translate(
        d.x,
        d.y
      );

      g.rotate(
        t * 0.6
      );

      for (let i = 0; i < 4; i++) {
        g.save();

        g.rotate(
          (i * Math.PI) /
            2
        );

        g.strokeStyle =
          "#5a4048";

        g.lineWidth = 2;

        g.beginPath();

        g.moveTo(0, 0);

        g.lineTo(
          0,
          -d.len
        );

        g.stroke();

        g.fillStyle =
          "rgba(246,226,198,0.95)";

        g.fillRect(
          1,
          -d.len,
          9,
          d.len * 0.78
        );

        g.fillStyle =
          "rgba(255,170,130,0.25)";

        g.fillRect(
          6,
          -d.len,
          4,
          d.len * 0.78
        );

        g.restore();
      }

      g.restore();

      g.fillStyle =
        "#4a3040";

      circ(
        g,
        d.x,
        d.y,
        3.2
      );

      g.fill();

      break;
    }

    default:
      break;
  }
}

function drawWaterfall(g, f, t) {
  const L =
    f.yEnd - f.y0;

  const cx = (yy) =>
    f.x +
    Math.sin(
      yy * 0.045 +
        t * 1.6 +
        f.seed
    ) *
      1.8 *
      clamp(
        (yy - f.y0) /
          L,
        0,
        1
      );

  const wd = (yy) => {
    const u = clamp(
      (yy - f.y0) /
        L,
      0,
      1
    );

    return (
      f.w *
      (1 +
        0.55 *
          Math.max(
            0,
            1 -
              (yy -
                f.y0) /
                22
          )) *
      (1 -
        0.42 * u)
    );
  };

  const left = [];
  const right = [];

  for (
    let yy = f.y0;
    yy <= f.yEnd;
    yy += 12
  ) {
    left.push([
      cx(yy) -
        wd(yy) / 2,
      yy,
    ]);

    right.push([
      cx(yy) +
        wd(yy) / 2,
      yy,
    ]);
  }

  const gr =
    g.createLinearGradient(
      0,
      f.y0,
      0,
      f.yEnd
    );

  gr.addColorStop(
    0,
    "rgba(236,248,255,0.92)"
  );

  gr.addColorStop(
    clamp(
      (f.y1 - f.y0) /
        L,
      0.2,
      0.9
    ),
    "rgba(190,226,248,0.72)"
  );

  gr.addColorStop(
    1,
    "rgba(215,238,255,0.3)"
  );

  g.fillStyle = gr;

  g.beginPath();

  g.moveTo(
    left[0][0],
    left[0][1]
  );

  for (
    let i = 1;
    i < left.length;
    i++
  ) {
    g.lineTo(
      left[i][0],
      left[i][1]
    );
  }

  for (
    let i = right.length - 1;
    i >= 0;
    i--
  ) {
    g.lineTo(
      right[i][0],
      right[i][1]
    );
  }

  g.closePath();

  g.fill();

  g.lineCap = "round";

  const n =
    Math.ceil(L / 46);

  for (let s = 0; s < 3; s++) {
    g.strokeStyle =
      `rgba(255,255,255,${0.42 + s * 0.08})`;

    g.lineWidth =
      1.3 + s * 0.5;

    g.beginPath();

    const u =
      (s - 1) *
      f.w *
      0.26;

    for (
      let k = 0;
      k < n;
      k++
    ) {
      const yy =
        f.y0 +
        ((
          t *
            (120 +
              s * 34) +
          k *
            (L / n) +
          s * 41
        ) %
          L);

      const y2 = Math.min(
        yy + 16 + s * 7,
        f.yEnd
      );

      g.moveTo(
        cx(yy) +
          u *
            (1 -
              0.4 *
                ((yy -
                  f.y0) /
                  L)),
        yy
      );

      g.lineTo(
        cx(y2) +
          u *
            (1 -
              0.4 *
                ((y2 -
                  f.y0) /
                  L)),
        y2
      );
    }

    g.stroke();
  }

  g.fillStyle =
    "rgba(255,255,255,0.7)";

  for (let i = -1; i <= 1; i++) {
    ell(
      g,
      f.x +
        i *
          f.w *
          0.3 +
        Math.sin(
          t * 2 + i
        ) *
          1.2,
      f.y0 + 1,
      4.2,
      2.4
    );

    g.fill();
  }

  for (let k = 0; k < 5; k++) {
    const u =
      (t * 0.9 +
        k * 0.2 +
        hash(f.seed + k)) %
      1;

    g.fillStyle =
      `rgba(235,246,255,${(1 - u) * 0.8})`;

    circ(
      g,
      f.x +
        Math.sin(
          k * 3.1 +
            f.seed
        ) *
          f.w *
          0.5,
      f.y1 +
        u * 70,
      1.5 +
        (1 - u) *
          0.8
    );

    g.fill();
  }
}

function drawMist(g, falls, t) {
  for (const f of falls) {
    for (let k = 0; k < 4; k++) {
      const ph =
        f.seed +
        k * 1.7;

      const x =
        f.x +
        Math.sin(
          t * 0.5 + ph
        ) *
          18 +
        (k - 1.5) *
          18;

      const y =
        f.yEnd -
        6 +
        Math.cos(
          t * 0.4 + ph
        ) *
          5;

      const rx =
        36 + k * 7;

      const ry =
        15 + k * 3;

      g.save();

      g.translate(x, y);

      g.scale(
        1,
        ry / rx
      );

      const gr =
        g.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          rx
        );

      gr.addColorStop(
        0,
        "rgba(252,248,255,0.55)"
      );

      gr.addColorStop(
        1,
        "rgba(252,248,255,0)"
      );

      g.fillStyle = gr;

      circ(g, 0, 0, rx);
      g.fill();

      g.restore();
    }
  }
}

function drawIslandLive(g, isl, t) {
  const bob =
    bobOf(isl, t);

  g.save();

  g.translate(
    0,
    bob
  );

  g.drawImage(
    isl.rock,
    isl.rbx,
    isl.rby,
    isl.rbw,
    isl.rbh
  );

  g.save();

  g.globalCompositeOperation =
    "lighter";

  const cc =
    isl.crystal;

  for (const c of isl.crystals || []) {
    const p =
      0.6 +
      0.4 *
        Math.sin(
          t * 1.4 +
            c.ph
        );

    const gr =
      g.createRadialGradient(
        c.x,
        c.y,
        0,
        c.x,
        c.y,
        c.r
      );

    gr.addColorStop(
      0,
      col(
        cc,
        0.55 *
          p *
          (0.35 +
            isl.z * 0.65)
      )
    );

    gr.addColorStop(
      1,
      col(cc, 0)
    );

    g.fillStyle = gr;

    circ(
      g,
      c.x,
      c.y,
      c.r
    );

    g.fill();
  }

  g.restore();

  for (const f of isl.falls) {
    drawWaterfall(
      g,
      f,
      t
    );
  }

  g.drawImage(
    isl.top,
    isl.tbx,
    isl.tby,
    isl.tbw,
    isl.tbh
  );

  const a =
    0.35 +
    isl.z * 0.65;

  g.globalAlpha = a;

  for (const d of isl.dyn) {
    drawDyn(
      g,
      d,
      t
    );
  }

  g.globalAlpha = 1;

  g.restore();
}

/* -------------------------------------------------------------------------- */
/* BRIDGES                                                                     */
/* -------------------------------------------------------------------------- */

function drawBridge(
  g,
  islands,
  br,
  t
) {
  const A =
    islands[br.a];

  const B =
    islands[br.b];

  const ax =
    A.xL +
    br.ax * A.w;

  const bx =
    B.xL +
    br.bx * B.w;

  const ay =
    surfY(A, ax) +
    bobOf(A, t) -
    2;

  const by =
    surfY(B, bx) +
    bobOf(B, t) -
    2;

  const sag =
    16 +
    Math.abs(bx - ax) *
      0.07;

  const cx =
    (ax + bx) / 2 +
    Math.sin(
      t * 0.6 + br.a
    ) *
      3;

  const cy =
    (ay + by) / 2 +
    sag * 2;

  const pt = (u) => {
    const v = 1 - u;

    return [
      v * v * ax +
        2 * u * v * cx +
        u * u * bx,

      v * v * ay +
        2 * u * v * cy +
        u * u * by,
    ];
  };

  const alpha =
    br.back ? 0.65 : 1;

  g.save();

  g.globalAlpha =
    alpha;

  g.lineCap = "round";

  g.strokeStyle =
    "#5a4048";

  g.lineWidth = 2.4;

  g.beginPath();

  g.moveTo(ax, ay);

  g.quadraticCurveTo(
    cx,
    cy,
    bx,
    by
  );

  g.stroke();

  const N = Math.max(
    10,
    Math.round(
      Math.abs(
        bx - ax
      ) / 9
    )
  );

  g.strokeStyle =
    "#8a6a62";

  g.lineWidth = 2.8;

  g.beginPath();

  for (
    let i = 1;
    i < N;
    i++
  ) {
    const p =
      pt(i / N);

    g.moveTo(
      p[0] - 3.2,
      p[1] + 1.5
    );

    g.lineTo(
      p[0] + 3.2,
      p[1] + 1.5
    );
  }

  g.stroke();

  g.strokeStyle =
    "rgba(90,64,72,0.9)";

  g.lineWidth = 1.3;

  g.beginPath();

  g.moveTo(
    ax,
    ay - 11
  );

  g.quadraticCurveTo(
    cx,
    cy - 11,
    bx,
    by - 11
  );

  g.stroke();

  g.beginPath();

  for (
    let i = 0;
    i <= N;
    i += 3
  ) {
    const p =
      pt(i / N);

    g.moveTo(
      p[0],
      p[1]
    );

    g.lineTo(
      p[0],
      p[1] - 11
    );
  }

  g.stroke();

  for (const u of [
    0.2,
    0.5,
    0.8,
  ]) {
    const p =
      pt(u);

    const sw =
      Math.sin(
        t * 1.5 +
          u * 9
      ) *
      1.6;

    g.strokeStyle =
      "rgba(60,44,52,0.9)";

    g.lineWidth = 1;

    g.beginPath();

    g.moveTo(
      p[0],
      p[1] - 11
    );

    g.lineTo(
      p[0] + sw,
      p[1] - 4
    );

    g.stroke();

    g.fillStyle =
      "#ffd88a";

    circ(
      g,
      p[0] + sw,
      p[1] - 2.5,
      2.6
    );

    g.fill();

    glowSprite(
      g,
      p[0] + sw,
      p[1] - 2.5,
      20,
      [255, 200, 120],
      0.55
    );
  }

  g.restore();
}

/* -------------------------------------------------------------------------- */
/* DEBRIS                                                                      */
/* -------------------------------------------------------------------------- */

const DEBRIS = [
  { x: 115, y: 410, s: 1.0 },
  { x: 905, y: 370, s: 0.8 },
  { x: 1335, y: 478, s: 0.7 },
  { x: 1575, y: 505, s: 0.9 },
  { x: 260, y: 175, s: 0.55 },
  { x: 700, y: 168, s: 0.5 },
  { x: 1215, y: 150, s: 0.6 },
  { x: 770, y: 612, s: 0.6 },
];

function makeDebris(seed, q) {
  return sprite(
    80,
    100,
    q,
    (g) => {
      const r =
        seeded(seed);

      const pts = [];
      const n = 8;

      for (let i = 0; i < n; i++) {
        const a =
          (i / n) * TAU;

        pts.push([
          40 +
            Math.cos(a) *
              (22 + r() * 8),

          36 +
            Math.sin(a) *
              (14 + r() * 6) +
            (Math.sin(a) > 0
              ? 14 + r() * 14
              : 0),
        ]);
      }

      smoothClosed(
        g,
        pts
      );

      const gr =
        g.createLinearGradient(
          0,
          20,
          0,
          90
        );

      gr.addColorStop(
        0,
        "#5a4c6e"
      );

      gr.addColorStop(
        1,
        "#1f2040"
      );

      g.fillStyle = gr;
      g.fill();

      g.save();

      smoothClosed(
        g,
        pts
      );

      g.clip();

      const hg =
        g.createLinearGradient(
          14,
          0,
          66,
          0
        );

      hg.addColorStop(
        0,
        "rgba(16,16,48,0.35)"
      );

      hg.addColorStop(
        1,
        "rgba(255,170,120,0.34)"
      );

      g.fillStyle = hg;

      g.fillRect(
        0,
        0,
        80,
        100
      );

      g.restore();

      g.fillStyle =
        "#86b95f";

      g.beginPath();

      g.ellipse(
        40,
        33,
        24,
        7,
        0,
        0,
        TAU
      );

      g.fill();

      g.fillStyle =
        "#b4dc74";

      g.beginPath();

      g.ellipse(
        42,
        31,
        18,
        4,
        0,
        0,
        TAU
      );

      g.fill();

      g.fillStyle =
        "#4a3436";

      g.fillRect(
        38.5,
        18,
        3,
        14
      );

      g.fillStyle =
        "#4f9a6a";

      circ(
        g,
        40,
        15,
        8
      );

      g.fill();

      g.fillStyle =
        "#86c47e";

      circ(
        g,
        42,
        12,
        4.6
      );

      g.fill();
    }
  );
}

/* -------------------------------------------------------------------------- */
/* CREATURES & VEHICLES                                                        */
/* -------------------------------------------------------------------------- */

function drawWhale(g, t) {
  const span =
    DESIGN_W + 800;

  const x =
    ((t * 8 + 260) %
      span) -
    400;

  const y =
    190 +
    Math.sin(
      t * 0.12
    ) *
      12;

  const tail =
    Math.sin(
      t * 0.9
    ) *
    14;

  g.save();

  g.translate(
    x,
    y
  );

  g.scale(
    0.95,
    0.95
  );

  g.rotate(
    Math.sin(
      t * 0.12 + 1
    ) *
      0.03
  );

  g.globalAlpha = 0.5;

  const bg =
    g.createLinearGradient(
      0,
      -44,
      0,
      36
    );

  bg.addColorStop(
    0,
    "#4e4a82"
  );

  bg.addColorStop(
    0.55,
    "#7a6a9c"
  );

  bg.addColorStop(
    1,
    "#dca4aa"
  );

  g.fillStyle = bg;

  g.beginPath();

  g.moveTo(
    122,
    2
  );

  g.bezierCurveTo(
    114,
    -30,
    50,
    -46,
    -20,
    -34
  );

  g.bezierCurveTo(
    -75,
    -26,
    -115,
    -8 +
      tail * 0.4,
    -150,
    tail * 0.8
  );

  g.bezierCurveTo(
    -115,
    10 +
      tail * 0.4,
    -75,
    24,
    -20,
    30
  );

  g.bezierCurveTo(
    40,
    40,
    106,
    32,
    122,
    2
  );

  g.closePath();

  g.fill();

  const ty =
    tail * 0.8;

  g.fillStyle =
    "#5a5090";

  g.beginPath();

  g.moveTo(
    -146,
    ty
  );

  g.quadraticCurveTo(
    -172,
    ty - 12,
    -198,
    ty - 34 +
      tail * 0.3
  );

  g.quadraticCurveTo(
    -186,
    ty - 4,
    -178,
    ty
  );

  g.quadraticCurveTo(
    -186,
    ty + 4,
    -200,
    ty + 30 +
      tail * 0.3
  );

  g.quadraticCurveTo(
    -172,
    ty + 12,
    -146,
    ty
  );

  g.closePath();

  g.fill();

  g.beginPath();

  g.moveTo(
    34,
    16
  );

  g.quadraticCurveTo(
    10,
    44 +
      tail * 0.3,
    -22,
    52 +
      tail * 0.4
  );

  g.quadraticCurveTo(
    0,
    30,
    6,
    20
  );

  g.closePath();

  g.fill();

  g.globalCompositeOperation =
    "lighter";

  for (let i = 0; i < 10; i++) {
    const px =
      92 - i * 19;

    const py =
      -10 +
      Math.sin(
        i * 0.7
      ) *
        4 +
      (i > 6
        ? tail * 0.15
        : 0);

    const a =
      0.5 +
      0.5 *
        Math.sin(
          t * 1.4 -
            i * 0.6
        );

    g.fillStyle =
      `rgba(255,224,176,${0.25 + a * 0.55})`;

    circ(
      g,
      px,
      py,
      1.6 +
        a * 0.8
    );

    g.fill();
  }

  g.globalCompositeOperation =
    "source-over";

  g.fillStyle =
    "rgba(30,20,50,0.7)";

  circ(
    g,
    92,
    -6,
    2
  );

  g.fill();

  g.restore();
}

function drawAirship(
  g,
  x,
  y,
  s,
  dir,
  t,
  ph,
  alpha
) {
  g.save();

  g.globalAlpha =
    alpha;

  g.translate(
    x,
    y
  );

  g.rotate(
    Math.sin(
      t * 0.5 + ph
    ) *
      0.025
  );

  g.scale(
    s * dir,
    s
  );

  g.fillStyle =
    "#8a5468";

  tri(
    g,
    -48,
    -6,
    -76,
    -24,
    -68,
    2
  );

  g.fill();

  tri(
    g,
    -48,
    8,
    -74,
    26,
    -66,
    4
  );

  g.fill();

  const hg =
    g.createLinearGradient(
      0,
      -28,
      0,
      28
    );

  hg.addColorStop(
    0,
    "#f8d6a4"
  );

  hg.addColorStop(
    0.45,
    "#d98e78"
  );

  hg.addColorStop(
    1,
    "#85506c"
  );

  g.fillStyle = hg;

  ell(
    g,
    0,
    0,
    58,
    27
  );

  g.fill();

  g.save();

  ell(
    g,
    0,
    0,
    58,
    27
  );

  g.clip();

  g.fillStyle =
    "rgba(120,60,84,0.2)";

  for (
    let i = -4;
    i <= 4;
    i += 2
  ) {
    g.fillRect(
      i * 13 - 6,
      -30,
      12,
      60
    );
  }

  g.fillStyle =
    "rgba(255,244,222,0.38)";

  ell(
    g,
    12,
    -13,
    34,
    7,
    -0.08
  );

  g.fill();

  g.fillStyle =
    "rgba(60,30,80,0.22)";

  ell(
    g,
    -8,
    22,
    58,
    10
  );

  g.fill();

  g.restore();

  g.strokeStyle =
    "rgba(100,56,78,0.7)";

  g.lineWidth = 1.5;

  g.beginPath();

  g.moveTo(
    -58,
    0
  );

  g.lineTo(
    58,
    0
  );

  g.stroke();

  g.strokeStyle =
    "rgba(70,48,52,0.85)";

  g.lineWidth = 1.2;

  for (const dx of [
    -24,
    -10,
    10,
    24,
  ]) {
    g.beginPath();

    g.moveTo(
      dx * 1.1,
      24
    );

    g.lineTo(
      dx * 0.7,
      37
    );

    g.stroke();
  }

  g.fillStyle =
    "#58393f";

  g.beginPath();

  g.moveTo(
    -26,
    36
  );

  g.lineTo(
    26,
    36
  );

  g.lineTo(
    19,
    51
  );

  g.lineTo(
    -19,
    51
  );

  g.closePath();

  g.fill();

  g.fillStyle =
    "#7a5258";

  g.fillRect(
    -26,
    35,
    52,
    3
  );

  for (let i = -1; i <= 1; i++) {
    g.fillStyle =
      "rgba(255,216,124,0.95)";

    g.fillRect(
      i * 11 - 2.5,
      41,
      5,
      6
    );
  }

  glowSprite(
    g,
    0,
    44,
    36,
    [255, 200, 120],
    0.5
  );

  const ang =
    t * 16 + ph;

  g.fillStyle =
    "rgba(70,46,58,0.8)";

  g.fillRect(
    -66,
    1,
    8,
    3
  );

  g.fillStyle =
    "rgba(60,40,52,0.55)";

  ell(
    g,
    -70,
    2.5,
    2.4,
    3 +
      14 *
        Math.abs(
          Math.sin(ang)
        )
  );

  g.fill();

  g.strokeStyle =
    "#4a3238";

  g.lineWidth = 1.6;

  g.beginPath();

  g.moveTo(
    0,
    -26
  );

  g.lineTo(
    0,
    -40
  );

  g.stroke();

  g.fillStyle =
    "#d9626f";

  g.beginPath();

  g.moveTo(
    0,
    -40
  );

  g.quadraticCurveTo(
    7,
    -41 +
      Math.sin(
        t * 5 + ph
      ) *
        2.2,
    14,
    -38 +
      Math.sin(
        t * 5 +
          ph +
          1
      ) *
        2
  );

  g.lineTo(
    0,
    -34
  );

  g.closePath();

  g.fill();

  g.restore();
}

function drawFlock(g, fl, t) {
  const span =
    DESIGN_W + 500;

  const x =
    ((((fl.x +
      t *
        fl.sp *
        fl.dir) %
      span) +
      span) %
      span) -
    250;

  const y =
    fl.y +
    Math.sin(
      t * 0.25 +
        fl.ph
    ) *
      16;

  g.lineCap = "round";

  for (
    let i = 0;
    i < fl.n;
    i++
  ) {
    const k =
      Math.ceil(i / 2);

    const side =
      i === 0
        ? 0
        : i % 2
        ? -1
        : 1;

    const bx =
      x -
      k *
        17 *
        fl.dir *
        fl.s;

    const by =
      y +
      side *
        k *
        8 *
        fl.s +
      Math.sin(
        t * 0.9 + k
      ) *
        2;

    const flap =
      Math.sin(
        t * 7 +
          fl.ph +
          i * 0.6
      ) *
      5 *
      fl.s;

    const s = fl.s;

    g.strokeStyle =
      `rgba(48,36,66,${0.45 + 0.35 * s})`;

    g.lineWidth =
      1.6 * s;

    g.beginPath();

    g.moveTo(
      bx,
      by
    );

    g.quadraticCurveTo(
      bx - 6 * s,
      by -
        flap * 1.2 -
        3 * s,
      bx - 13 * s,
      by +
        flap * 0.4
    );

    g.moveTo(
      bx,
      by
    );

    g.quadraticCurveTo(
      bx + 6 * s,
      by -
        flap * 1.2 -
        3 * s,
      bx + 13 * s,
      by +
        flap * 0.4
    );

    g.stroke();
  }
}

/* -------------------------------------------------------------------------- */
/* PARTICLES                                                                   */
/* -------------------------------------------------------------------------- */

function makeParticles() {
  const r =
    seeded(2025);

  const out = [];

  for (let i = 0; i < 100; i++) {
    out.push({
      x:
        r() * DESIGN_W,

      y:
        120 +
        r() * 620,

      sp:
        2 + r() * 8,

      f:
        0.3 + r() * 0.8,

      amp:
        8 + r() * 26,

      ph:
        r() * TAU,

      s:
        0.8 + r() * 1.6,

      petal:
        i % 7 === 0,
    });
  }

  return out;
}

function drawParticles(g, ps, t) {
  const W =
    DESIGN_W + 80;

  g.save();

  g.globalCompositeOperation =
    "lighter";

  for (const p of ps) {
    if (p.petal) continue;

    const x =
      (((p.x +
        t * p.sp) %
        W) +
        W) %
        W -
      40;

    const y =
      p.y +
      Math.sin(
        t * p.f +
          p.ph
      ) *
        p.amp;

    const a =
      0.25 +
      0.55 *
        (0.5 +
          0.5 *
            Math.sin(
              t * 1.7 +
                p.ph * 3
            ));

    g.fillStyle =
      `rgba(255,226,160,${a * 0.18})`;

    circ(
      g,
      x,
      y,
      p.s * 3.4
    );

    g.fill();

    g.fillStyle =
      `rgba(255,236,186,${a})`;

    circ(
      g,
      x,
      y,
      p.s
    );

    g.fill();
  }

  g.restore();

  for (const p of ps) {
    if (!p.petal) continue;

    const x =
      (((p.x -
        t *
          p.sp *
          1.4) %
        W) +
        W) %
        W -
      40;

    const y =
      p.y +
      Math.sin(
        t *
          p.f *
          0.7 +
          p.ph
      ) *
        p.amp *
        1.5 +
      ((t * 6 +
        p.ph * 40) %
        120);

    g.save();

    g.translate(
      x,
      y
    );

    g.rotate(
      t * 1.3 +
        p.ph
    );

    g.fillStyle =
      "rgba(246,172,198,0.85)";

    ell(
      g,
      0,
      0,
      3.6,
      1.8 +
        Math.abs(
          Math.sin(
            t * 2 +
              p.ph
          )
        ) *
          1.2
    );

    g.fill();

    g.restore();
  }
}

/* -------------------------------------------------------------------------- */
/* STATE BUILD                                                                 */
/* -------------------------------------------------------------------------- */

function qualityFor(w) {
  const dpr =
    typeof window !==
      "undefined" &&
    window.devicePixelRatio
      ? window.devicePixelRatio
      : 1;

  return clamp(
    (w / DESIGN_W) *
      Math.min(dpr, 2),
    0.5,
    2.2
  );
}

function buildAssets(state, w) {
  const q =
    qualityFor(w);

  const cq =
    Math.min(q, 1);

  state.q = q;
  state.builtW = w;

  state.sky = sprite(
    DESIGN_W,
    DESIGN_H,
    Math.min(q, 1.4),
    bakeSky
  );

  state.cloudSprites =
    SKY_CLOUDS.map(
      (c) =>
        makeCloud(
          c.w,
          c.h,
          c.seed,
          c.warm,
          cq
        )
    );

  state.bankSprites =
    BANKS.map((b) =>
      makeBank(b, cq)
    );

  state.islands.forEach(
    (isl) =>
      buildIsland(
        isl,
        q
      )
  );

  state.debris =
    DEBRIS.map(
      (d, i) => ({
        ...d,
        spr: makeDebris(
          500 + i * 17,
          q
        ),
        ph: i * 1.9,
        sp:
          0.4 +
          (i % 3) *
            0.12,
      })
    );
}

function createState(w) {
  const state = {
    islands:
      ISLAND_DEFS.map(
        (d, i) => {
          const isl = {
            ...d,
          };

          prepareIsland(
            isl,
            i
          );

          return isl;
        }
      ),

    stars:
      makeStars(),

    particles:
      makeParticles(),

    flocks: [
      {
        x: 150,
        y: 300,
        sp: 17,
        dir: 1,
        n: 7,
        s: 0.95,
        ph: 0,
      },
      {
        x: 1200,
        y: 175,
        sp: 12,
        dir: -1,
        n: 5,
        s: 0.7,
        ph: 2.4,
      },
      {
        x: 700,
        y: 560,
        sp: 14,
        dir: 1,
        n: 3,
        s: 0.8,
        ph: 4.1,
      },
    ],

    airships: [
      {
        x: 100,
        y: 175,
        speed: 15,
        scale: 0.8,
        phase: 0,
        dir: 1,
        alpha: 1,
      },
      {
        x: 1450,
        y: 98,
        speed: 9,
        scale: 0.46,
        phase: 2.7,
        dir: -1,
        alpha: 0.8,
      },
      {
        x: 780,
        y: 232,
        speed: 11,
        scale: 0.34,
        phase: 5,
        dir: 1,
        alpha: 0.65,
      },
    ],
  };

  buildAssets(
    state,
    w
  );

  return state;
}

let fallbackState = null;

/* -------------------------------------------------------------------------- */
/* MAIN SCENE                                                                  */
/* -------------------------------------------------------------------------- */

export default {
  init(w, h) {
    return createState(
      w || DESIGN_W
    );
  },

  draw(
    c,
    state,
    t,
    dt,
    mood,
    w,
    h
  ) {
    if (
      !state ||
      !state.islands
    ) {
      if (!fallbackState) {
        fallbackState =
          createState(w);
      }

      state =
        fallbackState;
    }

    if (
      Math.abs(
        state.builtW - w
      ) > 2
    ) {
      buildAssets(
        state,
        w
      );
    }

    const I =
      state.islands;

    const back =
      I.filter(
        (i) => i.z < 0.9
      ).sort(
        (a, b) =>
          a.z - b.z
      );

    const main =
      I.filter(
        (i) => i.z >= 0.9
      );

    /* ---------------------------------------------------------------------- */
    /* RESPONSIVE CAMERA                                                      */
    /*                                                                      */
    /* IMPORTANT:                                                            */
    /* Never scale X and Y independently.                                    */
    /*                                                                      */
    /* The original version used:                                           */
    /*                                                                      */
    /*   c.scale(w / DESIGN_W, h / DESIGN_H)                                */
    /*                                                                      */
    /* That stretches/squashes the entire 1672x941 world on portrait        */
    /* screens.                                                              */
    /*                                                                      */
    /* Instead we use one uniform scale and crop the sides on phones.        */
    /* ---------------------------------------------------------------------- */

    c.save();

    const isPortrait =
      h > w * 1.05;

    const scale =
      Math.max(
        w / DESIGN_W,
        h / DESIGN_H
      );

    const viewW =
      w / scale;

    const viewH =
      h / scale;

    let cameraX =
      (DESIGN_W -
        viewW) *
      0.5;

    let cameraY =
      (DESIGN_H -
        viewH) *
      0.5;

    if (isPortrait) {
      /*
       * Mobile focus point.
       *
       * 835 is roughly the center of the
       * main fantasy composition.
       *
       * We crop the sides instead of
       * shrinking the whole world.
       */
      const MOBILE_FOCUS_X =
        835;

      cameraX =
        MOBILE_FOCUS_X -
        viewW * 0.5;

      /*
       * Keep the upper part of the
       * sunset scene visible.
       */
      cameraY = 0;
    }

    cameraX = clamp(
      cameraX,
      0,
      Math.max(
        0,
        DESIGN_W -
          viewW
      )
    );

    cameraY = clamp(
      cameraY,
      0,
      Math.max(
        0,
        DESIGN_H -
          viewH
      )
    );

    /*
     * Translate the design-space camera
     * into the actual canvas.
     */
    c.translate(
      -cameraX * scale,
      -cameraY * scale
    );

    /*
     * ONE scale for both axes.
     *
     * This is the actual fix for mobile.
     */
    c.scale(
      scale,
      scale
    );

    /* ---------------------------------------------------------------------- */
    /* SKY                                                                     */
    /* ---------------------------------------------------------------------- */

    c.drawImage(
      state.sky,
      0,
      0,
      DESIGN_W,
      DESIGN_H
    );

    drawSun(
      c,
      t
    );

    drawStars(
      c,
      state.stars,
      t
    );

    /* ---------------------------------------------------------------------- */
    /* HIGH CLOUDS + WHALE                                                    */
    /* ---------------------------------------------------------------------- */

    SKY_CLOUDS.forEach(
      (cl, i) => {
        if (
          cl.layer === 0
        ) {
          drawSkyCloud(
            c,
            cl,
            state.cloudSprites[
              i
            ],
            t
          );
        }
      }
    );

    drawWhale(
      c,
      t
    );

    /* ---------------------------------------------------------------------- */
    /* FAR ISLANDS                                                             */
    /* ---------------------------------------------------------------------- */

    for (const isl of back) {
      drawIslandLive(
        c,
        isl,
        t
      );
    }

    for (const br of BRIDGES) {
      if (br.back) {
        drawBridge(
          c,
          I,
          br,
          t
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /* MID CLOUDS                                                              */
    /* ---------------------------------------------------------------------- */

    SKY_CLOUDS.forEach(
      (cl, i) => {
        if (
          cl.layer === 1
        ) {
          drawSkyCloud(
            c,
            cl,
            state.cloudSprites[
              i
            ],
            t
          );
        }
      }
    );

    /* ---------------------------------------------------------------------- */
    /* DEBRIS                                                                  */
    /* ---------------------------------------------------------------------- */

    for (const d of state.debris) {
      const bob =
        Math.sin(
          t * d.sp +
            d.ph
        ) * 6;

      c.drawImage(
        d.spr,
        d.x -
          40 * d.s,
        d.y -
          36 * d.s +
          bob,
        80 * d.s,
        100 * d.s
      );
    }

    /* ---------------------------------------------------------------------- */
    /* BACK CLOUD BANK                                                         */
    /* ---------------------------------------------------------------------- */

    drawBank(
      c,
      BANKS[0],
      state.bankSprites[0],
      t
    );

    /* ---------------------------------------------------------------------- */
    /* MAIN ISLANDS                                                            */
    /* ---------------------------------------------------------------------- */

    for (const isl of main) {
      drawIslandLive(
        c,
        isl,
        t
      );
    }

    for (const br of BRIDGES) {
      if (!br.back) {
        drawBridge(
          c,
          I,
          br,
          t
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /* AIRSHIPS                                                                */
    /* ---------------------------------------------------------------------- */

    const span =
      DESIGN_W + 260;

    for (const s of state.airships) {
      let x =
        s.x +
        t *
          s.speed *
          s.dir +
        Math.sin(
          t * 0.08 +
            s.phase
        ) *
          20;

      x =
        (((x + 130) %
          span) +
          span) %
          span -
        130;

      const y =
        s.y +
        Math.sin(
          t * 0.5 +
            s.phase
        ) *
          7;

      drawAirship(
        c,
        x,
        y,
        s.scale,
        s.dir,
        t,
        s.phase,
        s.alpha
      );
    }

    /* ---------------------------------------------------------------------- */
    /* CLOUD SEA + WATERFALL MIST                                             */
    /* ---------------------------------------------------------------------- */

    drawBank(
      c,
      BANKS[1],
      state.bankSprites[1],
      t
    );

    const falls = [];

    for (const isl of main) {
      for (const f of isl.falls) {
        falls.push(f);
      }
    }

    drawMist(
      c,
      falls,
      t
    );

    drawBank(
      c,
      BANKS[2],
      state.bankSprites[2],
      t
    );

    drawBank(
      c,
      BANKS[3],
      state.bankSprites[3],
      t
    );

    /* ---------------------------------------------------------------------- */
    /* LIFE                                                                    */
    /* ---------------------------------------------------------------------- */

    for (const fl of state.flocks) {
      drawFlock(
        c,
        fl,
        t
      );
    }

    drawParticles(
      c,
      state.particles,
      t
    );

    /* ---------------------------------------------------------------------- */
    /* LIGHT                                                                    */
    /* ---------------------------------------------------------------------- */

    drawSunRays(
      c,
      t,
      0.45
    );

    /* ---------------------------------------------------------------------- */
    /* BOOK CONTENT CONTRAST                                                  */
    /* ---------------------------------------------------------------------- */

    const rd =
      c.createRadialGradient(
        DESIGN_W * 0.5,
        DESIGN_H * 0.53,
        90,
        DESIGN_W * 0.5,
        DESIGN_H * 0.53,
        430
      );

    rd.addColorStop(
      0,
      "rgba(25,28,45,0.22)"
    );

    rd.addColorStop(
      0.45,
      "rgba(25,28,45,0.1)"
    );

    rd.addColorStop(
      1,
      "rgba(25,28,45,0)"
    );

    c.fillStyle = rd;

    c.fillRect(
      270,
      240,
      1130,
      570
    );

    /* ---------------------------------------------------------------------- */
    /* WARM COLOUR GRADE                                                     */
    /* ---------------------------------------------------------------------- */

    const gr =
      c.createLinearGradient(
        0,
        0,
        0,
        DESIGN_H
      );

    gr.addColorStop(
      0,
      "rgba(255,180,145,0.02)"
    );

    gr.addColorStop(
      0.55,
      "rgba(255,177,145,0.03)"
    );

    gr.addColorStop(
      1,
      "rgba(255,211,170,0.08)"
    );

    c.fillStyle = gr;

    c.fillRect(
      0,
      0,
      DESIGN_W,
      DESIGN_H
    );

    /* ---------------------------------------------------------------------- */
    /* VIGNETTE                                                                */
    /* ---------------------------------------------------------------------- */

    const vg =
      c.createRadialGradient(
        DESIGN_W / 2,
        DESIGN_H / 2,
        DESIGN_H * 0.45,
        DESIGN_W / 2,
        DESIGN_H / 2,
        DESIGN_W * 0.72
      );

    vg.addColorStop(
      0,
      "rgba(18,14,40,0)"
    );

    vg.addColorStop(
      1,
      "rgba(18,14,40,0.26)"
    );

    c.fillStyle = vg;

    c.fillRect(
      0,
      0,
      DESIGN_W,
      DESIGN_H
    );

    c.restore();
  },
};
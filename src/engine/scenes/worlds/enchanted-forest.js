// src/engine/scenes/worlds/enchanted-forest.js
// ENCHANTED FOREST - cinematic magical woodland.
// Canvas 2D, zero dependencies, deterministic procedural animation.

const TAU = Math.PI * 2;
const PI = Math.PI;

const PERIOD = 76;
const FOG = 1;
const MAGIC = 1;
const FIREFLIES = 1;
const LEAF_COUNT = 70;

const clamp = (v, a = 0, b = 1) =>
  v !== v ? a : Math.max(a, Math.min(b, v));

const lerp = (a, b, t) => a + (b - a) * t;

const smooth = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};

const smoother = (x) => {
  x = clamp(x);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

const noise = (x) => {
  const i = Math.floor(x);
  return lerp(hash(i), hash(i + 1), smoother(x - i));
};

const rgba = (r, g, b, a = 1) =>
  `rgba(${r | 0},${g | 0},${b | 0},${clamp(a)})`;

const color = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
};

const mix = (a, b, t) => ({
  r: lerp(a.r, b.r, t),
  g: lerp(a.g, b.g, t),
  b: lerp(a.b, b.b, t),
});

const addGlow = (c, x, y, radius, rgb, alpha) => {
  if (radius <= 1 || alpha <= 0.001) return;

  const g = c.createRadialGradient(
    x,
    y,
    0,
    x,
    y,
    radius
  );

  g.addColorStop(
    0,
    rgba(rgb.r, rgb.g, rgb.b, alpha)
  );

  g.addColorStop(
    0.35,
    rgba(rgb.r, rgb.g, rgb.b, alpha * 0.35)
  );

  g.addColorStop(
    1,
    rgba(rgb.r, rgb.g, rgb.b, 0)
  );

  c.fillStyle = g;
  c.fillRect(
    x - radius,
    y - radius,
    radius * 2,
    radius * 2
  );
};


/* ================================================================ */
/* PALETTE                                                          */
/* ================================================================ */

const NIGHT = color('#050914');
const SKY = color('#0c1d27');
const HORIZON = color('#243f3b');

const MOON = color('#dcefc8');
const MOON_BLUE = color('#9fc9c5');

const DEEP_FOREST = color('#07130f');
const MID_FOREST = color('#10261c');
const TREE = color('#101913');
const TREE_EDGE = color('#263d2b');

const MOSS = color('#718d55');
const MOSS_BRIGHT = color('#a8c96d');

const MAGIC_GREEN = color('#b9f7a6');
const MAGIC_BLUE = color('#88d8e7');
const MAGIC_GOLD = color('#f4d77b');

const STONE = color('#263535');
const STONE_LIGHT = color('#52675e');

const FIELDS = [
  'sky',
  'sky2',
  'horizon',
  'ground',
  'far',
  'mid',
  'near',
];

const KEYFRAMES = [
  {
    t: 0,
    sky: '#050914',
    sky2: '#0c1d27',
    horizon: '#243f3b',
    ground: '#07100d',
    far: '#0b1a17',
    mid: '#0b1712',
    near: '#050b08',
  },

  {
    t: 20,
    sky: '#07101b',
    sky2: '#10272d',
    horizon: '#38554a',
    ground: '#08130e',
    far: '#10241b',
    mid: '#0d1d15',
    near: '#050c08',
  },

  {
    t: 40,
    sky: '#081321',
    sky2: '#17332f',
    horizon: '#4b6650',
    ground: '#09150f',
    far: '#12281d',
    mid: '#102219',
    near: '#050d08',
  },

  {
    t: 57,
    sky: '#050b15',
    sky2: '#0e2427',
    horizon: '#294b43',
    ground: '#07110c',
    far: '#0b1e17',
    mid: '#0a1912',
    near: '#040a07',
  },

  {
    t: 76,
    sky: '#050914',
    sky2: '#0c1d27',
    horizon: '#243f3b',
    ground: '#07100d',
    far: '#0b1a17',
    mid: '#0b1712',
    near: '#050b08',
  },
];

function paletteAt(t) {
  const x = ((t % PERIOD) + PERIOD) % PERIOD;

  let a = KEYFRAMES[0];
  let b = KEYFRAMES[1];

  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (x >= KEYFRAMES[i].t && x <= KEYFRAMES[i + 1].t) {
      a = KEYFRAMES[i];
      b = KEYFRAMES[i + 1];
      break;
    }
  }

  const q = smoother(
    (x - a.t) / Math.max(0.001, b.t - a.t)
  );

  const out = {};

  for (const f of FIELDS) {
    out[f] = mix(
      color(a[f]),
      color(b[f]),
      q
    );
  }

  return out;
}


/* ================================================================ */
/* STATE GENERATION                                                 */
/* ================================================================ */

function makeStars() {
  const arr = [];

  for (let i = 0; i < 150; i++) {
    arr.push({
      x: hash(i * 2.3),
      y: 0.04 + hash(i * 4.7) * 0.43,
      r: 0.4 + hash(i * 7.1) * 1.4,
      phase: hash(i * 9.3) * TAU,
      speed: 0.3 + hash(i * 5.4) * 0.8,
    });
  }

  return arr;
}


function makeClouds() {
  const clouds = [];

  for (let i = 0; i < 11; i++) {
    clouds.push({
      x: hash(i * 4.1),
      y: 0.10 + hash(i * 8.7) * 0.30,
      w: 0.18 + hash(i * 3.3) * 0.25,
      h: 0.025 + hash(i * 9.2) * 0.035,
      speed: 0.004 + hash(i * 2.4) * 0.009,
      alpha: 0.08 + hash(i * 5.2) * 0.10,
    });
  }

  return clouds;
}


function makeMountains() {
  const layers = [];

  for (let layer = 0; layer < 3; layer++) {
    const pts = [];

    for (let i = 0; i <= 25; i++) {
      pts.push({
        x: i / 25,
        y:
          0.49 +
          layer * 0.045 +
          Math.sin(i * 1.7 + layer) *
            (0.035 - layer * 0.006) +
          (noise(i * 0.7 + layer * 20) - 0.5) *
            0.05,
      });
    }

    layers.push(pts);
  }

  return layers;
}


function makeTrees() {
  const trees = [];

  const defs = [
    [0.02, 0.58, 0.035, 0],
    [0.075, 0.42, 0.023, 1],
    [0.13, 0.33, 0.018, 2],
    [0.20, 0.27, 0.014, 2],
    [0.80, 0.27, 0.014, 2],
    [0.87, 0.35, 0.020, 1],
    [0.93, 0.45, 0.027, 0],
    [0.985, 0.63, 0.040, 0],
  ];

  defs.forEach((d, i) => {
    trees.push({
      x: d[0],
      h: d[1],
      width: d[2],
      layer: d[3],
      seed: i * 41 + 7,
      sway: 0.4 + hash(i * 3.4) * 0.7,
      phase: hash(i * 7.1) * TAU,
    });
  });

  return trees;
}


function makeFireflies() {
  const arr = [];

  for (let i = 0; i < 80; i++) {
    arr.push({
      x: hash(i * 2.31),
      y: 0.43 + hash(i * 3.17) * 0.43,
      radius: 0.7 + hash(i * 5.1) * 1.7,
      speed: 0.08 + hash(i * 7.7) * 0.22,
      wobble: 0.3 + hash(i * 8.8) * 0.9,
      phase: hash(i * 9.1) * TAU,
      hue: hash(i * 2.9),
    });
  }

  return arr;
}


function makeLeaves() {
  const arr = [];

  for (let i = 0; i < LEAF_COUNT; i++) {
    arr.push({
      x: hash(i * 2.2),
      y: 0.22 + hash(i * 3.7) * 0.67,
      size: 1.5 + hash(i * 4.9) * 3.5,
      speed: 0.12 + hash(i * 6.1) * 0.55,
      wobble: 0.7 + hash(i * 8.1) * 1.5,
      phase: hash(i * 9.7) * TAU,
      rot: hash(i * 11.2) * TAU,
    });
  }

  return arr;
}


function makeMushrooms() {
  const arr = [];

  const positions = [
    [0.16, 0.825, 1.0],
    [0.205, 0.86, 0.75],
    [0.275, 0.90, 1.25],
    [0.35, 0.84, 0.65],
    [0.43, 0.91, 1.1],
    [0.56, 0.875, 0.85],
    [0.63, 0.92, 1.3],
    [0.72, 0.84, 0.72],
    [0.79, 0.90, 1.05],
    [0.86, 0.83, 0.65],
  ];

  positions.forEach((p, i) => {
    arr.push({
      x: p[0],
      y: p[1],
      scale: p[2],
      phase: hash(i * 4.7) * TAU,
      type: i % 3,
    });
  });

  return arr;
}


function makeRocks() {
  const arr = [];

  for (let i = 0; i < 24; i++) {
    arr.push({
      x: 0.03 + hash(i * 4.1) * 0.94,
      y: 0.72 + hash(i * 6.7) * 0.25,
      w: 0.012 + hash(i * 8.2) * 0.025,
      h: 0.006 + hash(i * 9.7) * 0.016,
      rot: (hash(i * 2.3) - 0.5) * 0.45,
    });
  }

  return arr;
}


function makeGrass() {
  const arr = [];

  for (let i = 0; i < 150; i++) {
    arr.push({
      x: hash(i * 3.1),
      y: 0.79 + hash(i * 4.7) * 0.19,
      h: 0.012 + hash(i * 7.1) * 0.035,
      lean: (hash(i * 8.3) - 0.5) * 0.02,
      phase: hash(i * 2.9) * TAU,
    });
  }

  return arr;
}


function makeFog() {
  const layers = [];

  for (let layer = 0; layer < 4; layer++) {
    const blobs = [];

    for (let i = 0; i < 10; i++) {
      blobs.push({
        x: hash(layer * 20 + i * 3.2),
        y:
          0.52 +
          layer * 0.10 +
          hash(layer * 11 + i * 4.7) * 0.08,
        rx:
          0.08 +
          hash(layer * 8 + i * 2.1) * 0.15,
        ry:
          0.015 +
          hash(layer * 4 + i * 5.8) * 0.025,
        speed:
          0.004 +
          hash(layer * 6 + i * 7.2) * 0.012,
        alpha:
          0.035 +
          hash(layer * 3 + i * 9.1) * 0.045,
      });
    }

    layers.push(blobs);
  }

  return layers;
}


/* ================================================================ */
/* SHAPE HELPERS                                                    */
/* ================================================================ */

function ellipse(c, x, y, rx, ry, fill) {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fill();
}


function drawBlob(
  c,
  x,
  y,
  rx,
  ry,
  fill
) {
  c.fillStyle = fill;
  c.beginPath();

  c.moveTo(x - rx, y);

  c.bezierCurveTo(
    x - rx * 0.75,
    y - ry,
    x - rx * 0.25,
    y - ry * 1.15,
    x,
    y - ry * 0.72
  );

  c.bezierCurveTo(
    x + rx * 0.3,
    y - ry * 1.1,
    x + rx * 0.85,
    y - ry * 0.75,
    x + rx,
    y
  );

  c.bezierCurveTo(
    x + rx * 0.7,
    y + ry * 0.75,
    x - rx * 0.6,
    y + ry * 0.7,
    x - rx,
    y
  );

  c.fill();
}


function drawPine(
  c,
  x,
  base,
  height,
  width,
  fill
) {
  c.fillStyle = fill;

  c.beginPath();

  c.moveTo(x, base - height);

  c.lineTo(
    x - width * 0.28,
    base - height * 0.63
  );

  c.lineTo(
    x - width * 0.55,
    base - height * 0.62
  );

  c.lineTo(
    x - width * 0.33,
    base - height * 0.43
  );

  c.lineTo(
    x - width * 0.70,
    base - height * 0.40
  );

  c.lineTo(
    x - width * 0.40,
    base - height * 0.20
  );

  c.lineTo(
    x - width * 0.82,
    base
  );

  c.lineTo(
    x + width * 0.82,
    base
  );

  c.lineTo(
    x + width * 0.40,
    base - height * 0.20
  );

  c.lineTo(
    x + width * 0.70,
    base - height * 0.40
  );

  c.lineTo(
    x + width * 0.33,
    base - height * 0.43
  );

  c.lineTo(
    x + width * 0.55,
    base - height * 0.62
  );

  c.lineTo(
    x + width * 0.28,
    base - height * 0.63
  );

  c.closePath();
  c.fill();
}


/* ================================================================ */
/* SKY                                                              */
/* ================================================================ */

function drawSky(c, w, h, p, t) {
  const g = c.createLinearGradient(
    0,
    0,
    0,
    h * 0.75
  );

  g.addColorStop(0, rgba(p.sky.r, p.sky.g, p.sky.b));
  g.addColorStop(0.55, rgba(p.sky2.r, p.sky2.g, p.sky2.b));
  g.addColorStop(1, rgba(p.horizon.r, p.horizon.g, p.horizon.b));

  c.fillStyle = g;
  c.fillRect(0, 0, w, h);

  const glow = 0.10 + 0.04 * Math.sin(t * 0.18);

  addGlow(
    c,
    w * 0.5,
    h * 0.50,
    h * 0.40,
    MOON_BLUE,
    glow
  );
}


function drawStars(c, state, w, h, t) {
  c.save();

  for (let i = 0; i < state.stars.length; i++) {
    const s = state.stars[i];

    const twinkle =
      0.55 +
      Math.sin(
        t * s.speed +
        s.phase
      ) * 0.35;

    const x = s.x * w;
    const y = s.y * h;

    c.fillStyle = rgba(
      215,
      236,
      220,
      twinkle
    );

    c.beginPath();
    c.arc(
      x,
      y,
      s.r,
      0,
      TAU
    );
    c.fill();
  }

  c.restore();
}


function drawMoon(c, w, h, t) {
  const x = w * 0.52;
  const y = h * 0.255;
  const r = Math.min(w, h) * 0.105;

  const pulse =
    1 +
    Math.sin(t * 0.16) * 0.025;

  addGlow(
    c,
    x,
    y,
    r * 3.8,
    MOON,
    0.20
  );

  addGlow(
    c,
    x,
    y,
    r * 1.8,
    MAGIC_GREEN,
    0.08
  );

  c.save();

  const moonGrad = c.createRadialGradient(
    x - r * 0.25,
    y - r * 0.25,
    r * 0.1,
    x,
    y,
    r
  );

  moonGrad.addColorStop(
    0,
    rgba(248, 255, 225, 0.98)
  );

  moonGrad.addColorStop(
    0.7,
    rgba(220, 239, 200, 0.96)
  );

  moonGrad.addColorStop(
    1,
    rgba(166, 195, 177, 0.85)
  );

  c.fillStyle = moonGrad;
  c.beginPath();
  c.arc(
    x,
    y,
    r * pulse,
    0,
    TAU
  );
  c.fill();

  c.fillStyle =
    'rgba(91,120,104,.12)';

  const craters = [
    [-0.32, -0.18, 0.10],
    [0.24, -0.31, 0.075],
    [0.36, 0.20, 0.11],
    [-0.10, 0.34, 0.075],
    [-0.42, 0.25, 0.055],
  ];

  craters.forEach((q) => {
    c.beginPath();
    c.arc(
      x + q[0] * r,
      y + q[1] * r,
      q[2] * r,
      0,
      TAU
    );
    c.fill();
  });

  c.restore();
}


function drawClouds(
  c,
  state,
  w,
  h,
  t
) {
  c.save();

  for (const cloud of state.clouds) {
    const x =
      ((((cloud.x +
        t * cloud.speed) %
        1.35) +
        1.35) %
        1.35) *
        w -
      w * 0.18;

    const y = cloud.y * h;

    drawBlob(
      c,
      x,
      y,
      cloud.w * w,
      cloud.h * h,
      rgba(
        45,
        62,
        63,
        cloud.alpha
      )
    );
  }

  c.restore();
}


/* ================================================================ */
/* DISTANT MOUNTAINS + FOREST                                      */
/* ================================================================ */

function drawMountains(
  c,
  state,
  w,
  h,
  p
) {
  const colors = [
    rgba(
      p.far.r,
      p.far.g,
      p.far.b,
      0.75
    ),
    rgba(
      p.mid.r,
      p.mid.g,
      p.mid.b,
      0.85
    ),
    rgba(
      p.near.r,
      p.near.g,
      p.near.b,
      0.95
    ),
  ];

  state.mountains.forEach(
    (layer, li) => {
      c.fillStyle = colors[li];

      c.beginPath();
      c.moveTo(0, h);

      layer.forEach((pt) => {
        c.lineTo(
          pt.x * w,
          pt.y * h
        );
      });

      c.lineTo(w, h);
      c.closePath();
      c.fill();
    }
  );
}


function drawDistantPines(
  c,
  w,
  h,
  layer
) {
  const count = 60;

  c.save();

  for (let i = 0; i < count; i++) {
    const x =
      (i / count) * w +
      (hash(i * 4.1 + layer) - 0.5) *
        w *
        0.035;

    const base =
      h *
      (0.62 +
        layer * 0.055 +
        hash(i * 7.1) * 0.025);

    const height =
      h *
      (0.055 +
        hash(i * 3.7 + layer) * 0.08);

    const width =
      height *
      (0.30 +
        hash(i * 8.4) * 0.35);

    drawPine(
      c,
      x,
      base,
      height,
      width,
      layer === 0
        ? 'rgba(12,29,24,.72)'
        : 'rgba(7,20,15,.90)'
    );
  }

  c.restore();
}


/* ================================================================ */
/* LARGE TREES                                                      */
/* ================================================================ */

function branch(
  c,
  x,
  y,
  len,
  angle,
  width,
  depth,
  seed,
  sway
) {
  if (depth <= 0 || len < 4) return;

  const bend =
    Math.sin(seed * 1.7) *
    len *
    0.10;

  const x2 =
    x +
    Math.cos(angle) * len +
    bend;

  const y2 =
    y +
    Math.sin(angle) * len;

  c.lineWidth =
    Math.max(1, width);

  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(
    x + Math.cos(angle) * len * 0.45,
    y + Math.sin(angle) * len * 0.35,
    x2,
    y2
  );
  c.stroke();

  const spread =
    0.30 +
    hash(seed * 2.7) * 0.25;

  branch(
    c,
    x2,
    y2,
    len * (0.55 + hash(seed * 3.1) * 0.10),
    angle - spread,
    width * 0.62,
    depth - 1,
    seed + 2.3,
    sway
  );

  branch(
    c,
    x2,
    y2,
    len * (0.52 + hash(seed * 4.4) * 0.11),
    angle + spread,
    width * 0.58,
    depth - 1,
    seed + 7.7,
    sway
  );
}


function drawTree(
  c,
  tree,
  w,
  h,
  t,
  p,
  foreground
) {
  const x = tree.x * w;

  const base =
    h *
    (foreground
      ? 0.94
      : 0.76 + tree.layer * 0.045);

  const height =
    h *
    tree.h *
    (foreground ? 1.05 : 0.75);

  const sway =
    Math.sin(
      t * tree.sway +
      tree.phase
    ) *
    w *
    0.008;

  const trunkWidth =
    Math.max(
      2,
      tree.width * w
    );

  c.save();

  c.strokeStyle =
    foreground
      ? 'rgba(8,14,10,.98)'
      : 'rgba(8,18,13,.90)';

  c.lineCap = 'round';

  c.lineWidth =
    trunkWidth;

  c.beginPath();

  c.moveTo(
    x,
    base
  );

  c.quadraticCurveTo(
    x + sway,
    base - height * 0.5,
    x + sway * 1.5,
    base - height
  );

  c.stroke();

  branch(
    c,
    x + sway,
    base - height * 0.25,
    height * 0.32,
    -PI * 0.72,
    trunkWidth * 0.55,
    4,
    tree.seed + 1,
    sway
  );

  branch(
    c,
    x + sway * 1.2,
    base - height * 0.42,
    height * 0.30,
    -PI * 0.36,
    trunkWidth * 0.50,
    4,
    tree.seed + 11,
    sway
  );

  branch(
    c,
    x + sway * 1.5,
    base - height * 0.63,
    height * 0.25,
    -PI * 0.82,
    trunkWidth * 0.38,
    3,
    tree.seed + 21,
    sway
  );

  // Hanging leaves / canopy clusters
  const canopyAlpha =
    foreground ? 0.90 : 0.60;

  for (let i = 0; i < 9; i++) {
    const cx =
      x +
      (hash(tree.seed + i * 2.3) - 0.5) *
        height *
        0.75;

    const cy =
      base -
      height *
        (0.72 +
          hash(tree.seed + i * 3.7) *
            0.28);

    const rx =
      height *
      (0.10 +
        hash(tree.seed + i * 5.1) *
          0.10);

    const ry =
      height *
      (0.045 +
        hash(tree.seed + i * 7.4) *
          0.055);

    drawBlob(
      c,
      cx,
      cy +
        Math.sin(
          t * 0.5 +
          tree.seed +
          i
        ) *
        h *
        0.003,
      rx,
      ry,
      rgba(
        p.mid.r,
        p.mid.g,
        p.mid.b,
        canopyAlpha
      )
    );
  }

  c.restore();
}


/* ================================================================ */
/* MAGIC SHRINE                                                     */
/* ================================================================ */

function drawShrine(
  c,
  w,
  h,
  t,
  p
) {
  const x = w * 0.50;
  const ground = h * 0.665;
  const width = Math.min(w, h) * 0.17;
  const height = Math.min(w, h) * 0.17;

  // aura
  addGlow(
    c,
    x,
    ground - height * 0.55,
    height * 1.7,
    MAGIC_GREEN,
    0.09
  );

  c.save();

  // rear arch
  c.fillStyle =
    rgba(
      25,
      39,
      34,
      0.96
    );

  c.beginPath();

  c.moveTo(
    x - width * 0.36,
    ground
  );

  c.lineTo(
    x - width * 0.36,
    ground - height * 0.63
  );

  c.quadraticCurveTo(
    x,
    ground - height * 1.03,
    x + width * 0.36,
    ground - height * 0.63
  );

  c.lineTo(
    x + width * 0.36,
    ground
  );

  c.closePath();
  c.fill();

  // stones
  c.strokeStyle =
    'rgba(101,126,109,.34)';

  c.lineWidth =
    Math.max(1, width * 0.035);

  c.beginPath();

  for (let i = 0; i < 8; i++) {
    const yy =
      ground -
      height *
        (0.08 + i * 0.075);

    c.moveTo(
      x - width * 0.34,
      yy
    );

    c.lineTo(
      x + width * 0.34,
      yy
    );
  }

  c.stroke();

  // central rune
  const pulse =
    0.55 +
    Math.sin(t * 1.6) * 0.25;

  addGlow(
    c,
    x,
    ground - height * 0.42,
    height * 0.32,
    MAGIC_GREEN,
    0.22 * pulse
  );

  c.strokeStyle =
    rgba(
      MAGIC_GREEN.r,
      MAGIC_GREEN.g,
      MAGIC_GREEN.b,
      0.65 * pulse
    );

  c.lineWidth =
    Math.max(1, width * 0.018);

  c.beginPath();

  c.arc(
    x,
    ground - height * 0.42,
    width * 0.11,
    0,
    TAU
  );

  c.moveTo(
    x - width * 0.11,
    ground - height * 0.42
  );

  c.lineTo(
    x + width * 0.11,
    ground - height * 0.42
  );

  c.moveTo(
    x,
    ground - height * 0.53
  );

  c.lineTo(
    x,
    ground - height * 0.31
  );

  c.stroke();

  // stone steps
  c.fillStyle =
    'rgba(42,57,50,.95)';

  c.fillRect(
    x - width * 0.44,
    ground - height * 0.07,
    width * 0.88,
    height * 0.07
  );

  c.fillRect(
    x - width * 0.52,
    ground,
    width * 1.04,
    height * 0.045
  );

  c.restore();
}


/* ================================================================ */
/* PATH                                                             */
/* ================================================================ */

function drawPath(
  c,
  w,
  h,
  t
) {
  const top = h * 0.64;
  const bottom = h;

  const center = (y) => {
    const q =
      (y - top) /
      (bottom - top);

    return (
      w * 0.5 +
      Math.sin(q * 4.2 + 0.3) *
        w *
        0.08 *
        Math.pow(q, 0.8)
    );
  };

  c.save();

  const grad =
    c.createLinearGradient(
      0,
      top,
      0,
      bottom
    );

  grad.addColorStop(
    0,
    'rgba(64,77,63,.32)'
  );

  grad.addColorStop(
    0.55,
    'rgba(54,62,51,.58)'
  );

  grad.addColorStop(
    1,
    'rgba(30,36,28,.85)'
  );

  c.fillStyle = grad;

  c.beginPath();

  for (let i = 0; i <= 30; i++) {
    const y =
      top +
      ((bottom - top) / 30) * i;

    const q =
      (y - top) /
      (bottom - top);

    const half =
      w *
      (0.012 +
        Math.pow(q, 1.15) *
          0.13);

    const x =
      center(y);

    if (i === 0)
      c.moveTo(
        x - half,
        y
      );
    else
      c.lineTo(
        x - half,
        y
      );
  }

  for (let i = 30; i >= 0; i--) {
    const y =
      top +
      ((bottom - top) / 30) * i;

    const q =
      (y - top) /
      (bottom - top);

    const half =
      w *
      (0.012 +
        Math.pow(q, 1.15) *
          0.13);

    const x =
      center(y);

    c.lineTo(
      x + half,
      y
    );
  }

  c.closePath();
  c.fill();

  // stones along path
  for (let i = 0; i < 20; i++) {
    const q =
      hash(i * 5.7);

    const y =
      top +
      q * (bottom - top) * 0.92;

    const x =
      center(y) +
      (hash(i * 3.1) - 0.5) *
        w *
        0.20 *
        q;

    ellipse(
      c,
      x,
      y,
      w * 0.007,
      h * 0.003,
      'rgba(104,111,92,.28)'
    );
  }

  c.restore();
}


/* ================================================================ */
/* MUSHROOMS                                                        */
/* ================================================================ */

function drawMushroom(
  c,
  m,
  w,
  h,
  t
) {
  const x = m.x * w;
  const y = m.y * h;
  const s =
    Math.min(w, h) *
    0.010 *
    m.scale;

  const pulse =
    0.65 +
    Math.sin(
      t * 1.5 +
      m.phase
    ) *
      0.25;

  const glowColor =
    m.type === 0
      ? MAGIC_GREEN
      : m.type === 1
        ? MAGIC_BLUE
        : MAGIC_GOLD;

  addGlow(
    c,
    x,
    y - s * 2,
    s * 7,
    glowColor,
    0.18 * pulse
  );

  c.save();

  c.strokeStyle =
    'rgba(205,211,178,.65)';

  c.lineWidth =
    Math.max(1, s * 0.35);

  c.beginPath();

  c.moveTo(
    x,
    y
  );

  c.quadraticCurveTo(
    x - s * 0.25,
    y - s * 1.8,
    x - s * 0.05,
    y - s * 3.3
  );

  c.stroke();

  c.fillStyle =
    m.type === 0
      ? 'rgba(101,166,93,.92)'
      : m.type === 1
        ? 'rgba(70,139,161,.92)'
        : 'rgba(179,143,62,.92)';

  c.beginPath();

  c.moveTo(
    x - s * 2.1,
    y - s * 3.1
  );

  c.quadraticCurveTo(
    x,
    y - s * 5.5,
    x + s * 2.1,
    y - s * 3.1
  );

  c.quadraticCurveTo(
    x,
    y - s * 2.2,
    x - s * 2.1,
    y - s * 3.1
  );

  c.fill();

  c.fillStyle =
    rgba(
      glowColor.r,
      glowColor.g,
      glowColor.b,
      0.7 * pulse
    );

  for (let i = 0; i < 3; i++) {
    c.beginPath();

    c.arc(
      x +
        (i - 1) *
          s *
          0.8,
      y -
        s *
          (3.3 +
            (i % 2) * 0.5),
      Math.max(0.5, s * 0.25),
      0,
      TAU
    );

    c.fill();
  }

  c.restore();
}


/* ================================================================ */
/* FIRELIES                                                         */
/* ================================================================ */

function drawFireflies(
  c,
  state,
  w,
  h,
  t
) {
  c.save();
  c.globalCompositeOperation =
    'lighter';

  for (
    let i = 0;
    i < state.fireflies.length;
    i++
  ) {
    const f =
      state.fireflies[i];

    const x =
      ((f.x +
        Math.sin(
          t * f.speed +
            f.phase
        ) *
          0.025 +
        t *
          f.speed *
          0.006) %
        1 +
        1) %
        1;

    const y =
      f.y +
      Math.sin(
        t * f.wobble +
          f.phase
      ) *
        0.025;

    const pulse =
      0.35 +
      Math.max(
        0,
        Math.sin(
          t * 1.7 +
            f.phase
        )
      ) *
        0.65;

    const rgb =
      f.hue < 0.33
        ? MAGIC_GREEN
        : f.hue < 0.66
          ? MAGIC_BLUE
          : MAGIC_GOLD;

    const px = x * w;
    const py = y * h;

    addGlow(
      c,
      px,
      py,
      f.radius * 9,
      rgb,
      0.13 * pulse
    );

    c.fillStyle =
      rgba(
        rgb.r,
        rgb.g,
        rgb.b,
        0.85 * pulse
      );

    c.beginPath();

    c.arc(
      px,
      py,
      Math.max(
        0.8,
        f.radius
      ),
      0,
      TAU
    );

    c.fill();
  }

  c.restore();
}


/* ================================================================ */
/* RUINS / STONES                                                    */
/* ================================================================ */

function drawRocks(
  c,
  state,
  w,
  h
) {
  c.save();

  for (const r of state.rocks) {
    const x = r.x * w;
    const y = r.y * h;

    c.save();
    c.translate(x, y);
    c.rotate(r.rot);

    c.fillStyle =
      'rgba(24,34,29,.95)';

    c.beginPath();

    c.moveTo(
      -r.w * w,
      0
    );

    c.lineTo(
      -r.w * w * 0.65,
      -r.h * h
    );

    c.lineTo(
      r.w * w * 0.20,
      -r.h * h * 1.15
    );

    c.lineTo(
      r.w * w,
      -r.h * h * 0.45
    );

    c.lineTo(
      r.w * w,
      0
    );

    c.closePath();
    c.fill();

    c.restore();
  }

  c.restore();
}


function drawAncientStones(
  c,
  w,
  h
) {
  const x = w * 0.27;
  const base = h * 0.70;
  const stoneW =
    Math.min(w, h) * 0.075;

  c.save();

  c.fillStyle =
    'rgba(20,31,27,.95)';

  // broken standing stones
  for (let i = 0; i < 4; i++) {
    const sx =
      x +
      (i - 1.5) *
        stoneW *
        0.72;

    const sh =
      stoneW *
      (1.5 +
        hash(i * 4.2) *
          0.8);

    c.beginPath();

    c.moveTo(
      sx - stoneW * 0.38,
      base
    );

    c.lineTo(
      sx - stoneW * 0.27,
      base - sh
    );

    c.lineTo(
      sx + stoneW * 0.20,
      base - sh * 1.03
    );

    c.lineTo(
      sx + stoneW * 0.40,
      base
    );

    c.closePath();
    c.fill();
  }

  // horizontal lintel
  c.fillRect(
    x - stoneW * 1.35,
    base - stoneW * 1.75,
    stoneW * 2.7,
    stoneW * 0.24
  );

  // moss
  c.strokeStyle =
    'rgba(105,133,83,.42)';

  c.lineWidth =
    Math.max(
      1,
      stoneW * 0.06
    );

  c.beginPath();

  c.moveTo(
    x - stoneW * 1.1,
    base - stoneW * 1.55
  );

  c.quadraticCurveTo(
    x - stoneW * 0.2,
    base - stoneW * 1.8,
    x + stoneW * 0.9,
    base - stoneW * 1.6
  );

  c.stroke();

  c.restore();
}


/* ================================================================ */
/* GRASS                                                             */
/* ================================================================ */

function drawGrass(
  c,
  state,
  w,
  h,
  t
) {
  c.save();

  c.strokeStyle =
    'rgba(81,108,67,.58)';

  c.lineWidth =
    Math.max(
      0.7,
      Math.min(w, h) * 0.0013
    );

  c.beginPath();

  for (const g of state.grass) {
    const x =
      g.x * w;

    const y =
      g.y * h;

    const wind =
      Math.sin(
        t * 1.4 +
          g.phase
      ) *
      g.h *
      h *
      0.45;

    c.moveTo(
      x,
      y
    );

    c.quadraticCurveTo(
      x +
        g.lean * w +
        wind,
      y -
        g.h * h * 0.55,
      x +
        g.lean * w * 1.7 +
        wind * 1.5,
      y -
        g.h * h
    );
  }

  c.stroke();
  c.restore();
}


/* ================================================================ */
/* FALLING LEAVES                                                    */
/* ================================================================ */

function drawLeaves(
  c,
  state,
  w,
  h,
  t
) {
  c.save();

  for (const leaf of state.leaves) {
    const x =
      ((leaf.x +
        t *
          leaf.speed *
          0.012) %
        1.15) *
        w -
      w * 0.07;

    const y =
      leaf.y * h +
      Math.sin(
        t *
          leaf.wobble +
          leaf.phase
      ) *
        h *
        0.025;

    const rot =
      leaf.rot +
      t * leaf.speed;

    c.save();

    c.translate(
      x,
      y
    );

    c.rotate(rot);

    c.fillStyle =
      'rgba(91,115,70,.72)';

    c.beginPath();

    c.ellipse(
      0,
      0,
      leaf.size * 1.5,
      leaf.size * 0.7,
      0,
      0,
      TAU
    );

    c.fill();

    c.restore();
  }

  c.restore();
}


/* ================================================================ */
/* FOG                                                              */
/* ================================================================ */

function drawFog(
  c,
  state,
  w,
  h,
  t,
  layer
) {
  const blobs =
    state.fog[layer];

  if (!blobs) return;

  c.save();

  for (const f of blobs) {
    const x =
      ((((f.x +
        t * f.speed) %
        1.35) +
        1.35) %
        1.35) *
        w -
      w * 0.18;

    const y =
      f.y * h;

    const g =
      c.createRadialGradient(
        x,
        y,
        0,
        x,
        y,
        f.rx * w
      );

    g.addColorStop(
      0,
      rgba(
        173,
        196,
        181,
        f.alpha * FOG
      )
    );

    g.addColorStop(
      1,
      rgba(
        173,
        196,
        181,
        0
      )
    );

    c.fillStyle = g;

    c.beginPath();

    c.ellipse(
      x,
      y,
      f.rx * w,
      f.ry * h,
      0,
      0,
      TAU
    );

    c.fill();
  }

  c.restore();
}


/* ================================================================ */
/* MAGIC PARTICLES                                                   */
/* ================================================================ */

function drawMagicDust(
  c,
  w,
  h,
  t
) {
  c.save();

  c.globalCompositeOperation =
    'lighter';

  for (let i = 0; i < 55; i++) {
    const x =
      hash(i * 3.7) * w;

    const baseY =
      h *
      (0.42 +
        hash(i * 5.1) * 0.45);

    const y =
      baseY +
      Math.sin(
        t *
          (0.2 +
            hash(i * 2.8) *
              0.4) +
          i
      ) *
        h *
        0.025;

    const pulse =
      0.2 +
      Math.max(
        0,
        Math.sin(
          t *
            (0.7 +
              hash(i * 6.1) *
                0.8) +
            i
        )
      ) *
        0.8;

    const rgb =
      i % 3 === 0
        ? MAGIC_GREEN
        : i % 3 === 1
          ? MAGIC_BLUE
          : MAGIC_GOLD;

    c.fillStyle =
      rgba(
        rgb.r,
        rgb.g,
        rgb.b,
        0.18 * pulse * MAGIC
      );

    c.beginPath();

    c.arc(
      x,
      y,
      0.7 +
        hash(i * 8.1) *
          1.2,
      0,
      TAU
    );

    c.fill();
  }

  c.restore();
}


/* ================================================================ */
/* MAGICAL RINGS                                                     */
/* ================================================================ */

function drawGroundMagic(
  c,
  w,
  h,
  t
) {
  const x = w * 0.50;
  const y = h * 0.695;

  const pulse =
    0.45 +
    Math.sin(t * 1.1) * 0.20;

  c.save();

  c.globalCompositeOperation =
    'lighter';

  c.strokeStyle =
    rgba(
      MAGIC_GREEN.r,
      MAGIC_GREEN.g,
      MAGIC_GREEN.b,
      0.12 * pulse
    );

  c.lineWidth =
    Math.max(
      1,
      Math.min(w, h) * 0.001
    );

  for (let i = 0; i < 3; i++) {
    const radius =
      Math.min(w, h) *
      (0.055 + i * 0.018);

    c.beginPath();

    c.ellipse(
      x,
      y,
      radius,
      radius * 0.25,
      0,
      0,
      TAU
    );

    c.stroke();
  }

  c.restore();
}


/* ================================================================ */
/* FOREGROUND ROOTS                                                  */
/* ================================================================ */

function drawRoots(
  c,
  w,
  h,
  t,
  side
) {
  const x =
    side === 'left'
      ? -w * 0.03
      : w * 1.03;

  const dir =
    side === 'left'
      ? 1
      : -1;

  c.save();

  c.strokeStyle =
    'rgba(5,10,7,.98)';

  c.lineCap = 'round';

  for (let i = 0; i < 7; i++) {
    const y =
      h *
      (0.68 +
        i * 0.045);

    c.lineWidth =
      Math.max(
        2,
        Math.min(w, h) *
          (0.012 -
            i * 0.001)
      );

    c.beginPath();

    c.moveTo(
      x,
      y
    );

    c.bezierCurveTo(
      x +
        dir *
          w *
          (0.08 +
            i * 0.012),
      y -
        h *
          0.015,
      x +
        dir *
          w *
          (0.15 +
            i * 0.025),
      y +
        h *
          0.01,
      x +
        dir *
          w *
          (0.23 +
            i * 0.03),
      h *
        (0.87 +
          i * 0.012)
    );

    c.stroke();
  }

  c.restore();
}


/* ================================================================ */
/* VIGNETTE                                                          */
/* ================================================================ */

function drawVignette(
  c,
  w,
  h
) {
  const g =
    c.createRadialGradient(
      w * 0.5,
      h * 0.52,
      Math.min(w, h) * 0.25,
      w * 0.5,
      h * 0.52,
      Math.max(w, h) * 0.75
    );

  g.addColorStop(
    0,
    'rgba(0,0,0,0)'
  );

  g.addColorStop(
    0.70,
    'rgba(0,0,0,.08)'
  );

  g.addColorStop(
    1,
    'rgba(0,0,0,.48)'
  );

  c.fillStyle = g;
  c.fillRect(
    0,
    0,
    w,
    h
  );

  const bottom =
    c.createLinearGradient(
      0,
      h * 0.78,
      0,
      h
    );

  bottom.addColorStop(
    0,
    'rgba(0,0,0,0)'
  );

  bottom.addColorStop(
    1,
    'rgba(0,0,0,.32)'
  );

  c.fillStyle = bottom;

  c.fillRect(
    0,
    h * 0.78,
    w,
    h * 0.22
  );
}


/* ================================================================ */
/* INITIALIZATION                                                    */
/* ================================================================ */

function initState() {
  return {
    stars: makeStars(),
    clouds: makeClouds(),
    mountains: makeMountains(),
    trees: makeTrees(),
    fireflies: makeFireflies(),
    leaves: makeLeaves(),
    mushrooms: makeMushrooms(),
    rocks: makeRocks(),
    grass: makeGrass(),
    fog: makeFog(),
    lastT: 0,
  };
}


/* ================================================================ */
/* EXPORT                                                            */
/* ================================================================ */

export default {
  init(w, h) {
    return initState();
  },

  draw(c, state, t, dt, mood, w, h) {
    if (!(w > 0) || !(h > 0)) return;

    if (!Number.isFinite(t)) {
      t = 0;
    }

    const p =
      paletteAt(t);

    c.save();

    c.globalCompositeOperation =
      'source-over';

    c.globalAlpha = 1;

    c.lineCap = 'round';
    c.lineJoin = 'round';

    /* ------------------------------------------------------------ */
    /* SKY                                                            */
    /* ------------------------------------------------------------ */

    drawSky(
      c,
      w,
      h,
      p,
      t
    );

    drawStars(
      c,
      state,
      w,
      h,
      t
    );

    drawMoon(
      c,
      w,
      h,
      t
    );

    drawClouds(
      c,
      state,
      w,
      h,
      t
    );


    /* ------------------------------------------------------------ */
    /* DISTANT WORLD                                                  */
    /* ------------------------------------------------------------ */

    drawMountains(
      c,
      state,
      w,
      h,
      p
    );

    drawDistantPines(
      c,
      w,
      h,
      0
    );

    drawDistantPines(
      c,
      w,
      h,
      1
    );

    drawFog(
      c,
      state,
      w,
      h,
      t,
      0
    );


    /* ------------------------------------------------------------ */
    /* BACKGROUND TREES                                               */
    /* ------------------------------------------------------------ */

    for (
      const tree of state.trees
    ) {
      if (tree.layer >= 2)
        continue;

      drawTree(
        c,
        tree,
        w,
        h,
        t,
        p,
        false
      );
    }


    /* ------------------------------------------------------------ */
    /* PATH + RUINS                                                   */
    /* ------------------------------------------------------------ */

    drawPath(
      c,
      w,
      h,
      t
    );

    drawAncientStones(
      c,
      w,
      h
    );

    drawShrine(
      c,
      w,
      h,
      t,
      p
    );

    drawGroundMagic(
      c,
      w,
      h,
      t
    );


    /* ------------------------------------------------------------ */
    /* MIDGROUND                                                     */
    /* ------------------------------------------------------------ */

    drawFog(
      c,
      state,
      w,
      h,
      t,
      1
    );

    for (
      const tree of state.trees
    ) {
      if (tree.layer === 2)
        continue;

      drawTree(
        c,
        tree,
        w,
        h,
        t,
        p,
        false
      );
    }

    drawRocks(
      c,
      state,
      w,
      h
    );

    drawGrass(
      c,
      state,
      w,
      h,
      t
    );


    /* ------------------------------------------------------------ */
    /* MAGICAL LIFE                                                   */
    /* ------------------------------------------------------------ */

    for (
      const mushroom of state.mushrooms
    ) {
      drawMushroom(
        c,
        mushroom,
        w,
        h,
        t
      );
    }

    drawFireflies(
      c,
      state,
      w,
      h,
      t
    );

    drawMagicDust(
      c,
      w,
      h,
      t
    );


    /* ------------------------------------------------------------ */
    /* FOG THROUGH THE WORLD                                          */
    /* ------------------------------------------------------------ */

    drawFog(
      c,
      state,
      w,
      h,
      t,
      2
    );


    /* ------------------------------------------------------------ */
    /* FOREGROUND TREES                                               */
    /* ------------------------------------------------------------ */

    for (
      const tree of state.trees
    ) {
      if (tree.layer < 1)
        continue;

      drawTree(
        c,
        tree,
        w,
        h,
        t,
        p,
        true
      );
    }

    drawRoots(
      c,
      w,
      h,
      t,
      'left'
    );

    drawRoots(
      c,
      w,
      h,
      t,
      'right'
    );


    /* ------------------------------------------------------------ */
    /* FOREGROUND ENVIRONMENT                                        */
    /* ------------------------------------------------------------ */

    drawLeaves(
      c,
      state,
      w,
      h,
      t
    );

    drawFog(
      c,
      state,
      w,
      h,
      t,
      3
    );


    /* ------------------------------------------------------------ */
    /* FINAL ATMOSPHERE                                               */
    /* ------------------------------------------------------------ */

    drawVignette(
      c,
      w,
      h
    );

    c.restore();
  },
};
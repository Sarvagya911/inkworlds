// src/engine/scenes/worlds/haunted-manor.js
// HAUNTED MANOR - cinematic gothic night. Canvas 2D, zero deps, deterministic from t.

const TAU = Math.PI * 2;
const PI = Math.PI;

// ===== TWEAK THESE FIRST =====
const PERIOD = 80;                // loop length (s)
const T_STRANGE = 18;             // phase starts: NORMAL(0) -> STRANGE
const T_SUPER = 38;               // SUPERNATURAL
const T_STORM = 56;               // STORM
const T_AFTER = 72;               // AFTERMATH (ends at PERIOD)
const FOG_DENSITY = 1.0;
const RAIN_AMOUNT = 1.0;
const LIGHTNING_FREQUENCY = 1.0;  // 1 = 2-3 strikes per storm
const WINDOW_GLOW_STRENGTH = 1.0;
const GHOST_VISIBILITY = 1.0;

/* ===================================================================== */
/* utilities                                                              */
/* ===================================================================== */
const clamp = (v, a = 0, b = 1) => (v !== v ? a : v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sq = (x) => x * x;
function smooth(x) { x = clamp(x); return x * x * (3 - 2 * x); }
function smoother(x) { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); }
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); }
function hash2(a, b) { return hash(a * 57.31 + b * 19.77 + 0.5); }
function noise1(x) { const i = Math.floor(x); return lerp(hash(i), hash(i + 1), smoother(x - i)); }
function bump(x, a, b, fi, fo) { return smooth((x - a) / fi) * (1 - smooth((x - (b - fo)) / fo)); }

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
const mkc = () => ({ r: 0, g: 0, b: 0 });
function css(c, a = 1) { return 'rgba(' + (c.r | 0) + ',' + (c.g | 0) + ',' + (c.b | 0) + ',' + clamp(a) + ')'; }
function rgbs(c) { return (c.r | 0) + ',' + (c.g | 0) + ',' + (c.b | 0); }
function mixInto(o, a, b, t) {
  o.r = a.r + (b.r - a.r) * t; o.g = a.g + (b.g - a.g) * t; o.b = a.b + (b.b - a.b) * t;
  return o;
}
const WHITE = { r: 255, g: 255, b: 255 };
const GREEN_TINT = { r: 190, g: 238, b: 170 };
const FLASH_COL = { r: 200, g: 224, b: 240 };

/* ===================================================================== */
/* palette keyframes                                                      */
/* ===================================================================== */
const FIELDS = ['skyTop', 'skyMid', 'horizon', 'g1', 'g2', 'g3', 'g4', 'g5', 'haze', 'fog', 'rim', 'moon'];
const K_NORMAL = ['#050913', '#0a1325', '#162739', '#14212c', '#101a24', '#0b141c', '#070d14', '#04070b', '#4a6274', '#6a858f', '#b0d2e4', '#e6efe9'];
const KF = [
  [0, K_NORMAL, 0.86, 0.0, 0.62],
  [T_STRANGE, ['#050a14', '#0b1626', '#1b3039', '#15232b', '#101c23', '#0b151b', '#070e13', '#04080b', '#506b72', '#728f94', '#b6dacb', '#e8f1e2'], 0.90, 0.06, 0.82],
  [T_SUPER, ['#050c13', '#0c1b22', '#26463f', '#16262a', '#112024', '#0c171b', '#080f13', '#04080a', '#5a8277', '#7fa593', '#bfe6c8', '#e2f0d2'], 0.90, 0.10, 1.0],
  [T_STORM, ['#03060b', '#070d16', '#111a25', '#0f171e', '#0b1218', '#080e13', '#05090e', '#03060a', '#364451', '#4d5d68', '#93adc2', '#c4d0d6'], 0.98, 1.0, 0.70],
  [T_AFTER, ['#050b14', '#0b1826', '#1a2f38', '#122028', '#0e1920', '#09121a', '#060c12', '#03070a', '#51666f', '#7a8f94', '#a8cfda', '#e4eeea'], 0.92, 0.20, 0.80],
  [PERIOD, K_NORMAL, 0.86, 0.0, 0.62],
].map(([t, cols, night, storm, glow]) => {
  const k = { t, night, storm, glow };
  for (let i = 0; i < FIELDS.length; i++) k[FIELDS[i]] = hexToRgb(cols[i]);
  return k;
});

function makePalette() {
  const p = { night: 0, storm: 0, glow: 0 };
  for (let i = 0; i < FIELDS.length; i++) p[FIELDS[i]] = mkc();
  return p;
}

function fillPalette(p, x) {
  let i = 0;
  while (i < KF.length - 2 && x >= KF[i + 1].t) i++;
  const a = KF[i], b = KF[i + 1];
  const q = smoother((x - a.t) / Math.max(0.001, b.t - a.t));
  for (let k = 0; k < FIELDS.length; k++) { const f = FIELDS[k]; mixInto(p[f], a[f], b[f], q); }
  p.night = lerp(a.night, b.night, q);
  p.storm = lerp(a.storm, b.storm, q);
  p.glow = lerp(a.glow, b.glow, q);
}

/* ===================================================================== */
/* phase weights (circular cross-fades, continuous across the loop)       */
/* ===================================================================== */
function circ(x, b) { return ((x - b + PERIOD * 1.5) % PERIOD) - PERIOD * 0.5; }
function xfade(x, b, f) { return smooth((circ(x, b) + f) / (2 * f)); }

function fillPhase(ph, x) {
  const f = 2.5;
  const a0 = xfade(x, 0, f), a1 = xfade(x, T_STRANGE, f), a2 = xfade(x, T_SUPER, f),
    a3 = xfade(x, T_STORM, f), a4 = xfade(x, T_AFTER, f);
  ph.normal = a0 * (1 - a1);
  ph.strange = a1 * (1 - a2);
  ph.supernatural = a2 * (1 - a3);
  ph.storm = a3 * (1 - a4);
  ph.aftermath = a4 * (1 - a0);
  ph.eerie = clamp(ph.strange * 0.7 + ph.supernatural + ph.aftermath * 0.5);
  ph.rain = smooth((x - (T_STORM + 1.5)) / 7) * (1 - smooth((x - (T_AFTER - 1)) / 5));
  ph.wet = smooth((x - (T_STORM + 2)) / 6) * (1 - smooth((x - (T_AFTER - 1)) / (PERIOD - T_AFTER + 1)));
  ph.cover = smooth((x - (T_STORM - 5)) / 8) * (1 - smooth((x - (T_AFTER - 2)) / 8));
}

function windAt(t, ph) {
  const gust = Math.sin(t * 0.37) * 0.12 + Math.sin(t * 0.83 + 1.7) * 0.07 + noise1(t * 0.21) * 0.2 - 0.1;
  const gs = Math.floor(t / 14), gl = t - gs * 14 - hash(gs) * 10;
  const pulse = gl > 0 && gl < 3 && hash(gs + 9) > 0.45 ? sq(Math.sin((gl / 3) * PI)) * 0.28 : 0;
  const base = 0.16 + ph.strange * 0.10 + ph.supernatural * 0.20 + ph.storm * 0.95 + ph.aftermath * 0.12;
  return Math.max(0.03, base + gust * (0.5 + ph.storm * 1.6) + pulse);
}

/* ===================================================================== */
/* terrain (shared so everything stands ON the ground)                    */
/* ===================================================================== */
function farRidgeY(x, w, h, k) {
  const nx = x / w;
  const base = [0.585, 0.625, 0.655][k], amp = [0.045, 0.036, 0.028][k];
  return h * (base + Math.sin(nx * (4.1 + k * 2.3) + k * 2.7) * amp * 0.55 + (noise1(nx * (5 + k * 3) + k * 17) - 0.5) * amp * 1.5);
}
function hillY(x, F) {
  const g = F.g, w = F.w, h = F.h, nx = x / w;
  const bumpv = Math.exp(-sq((nx - 0.5) / 0.30));
  const nat = h * (0.735 - 0.028 * bumpv) + Math.sin(nx * 9 + 1) * h * 0.005 + (noise1(nx * 7 + 3) - 0.5) * h * 0.014;
  const wgt = 1 - smooth((Math.abs(x - g.cx) - 72 * g.u) / (24 * g.u));
  return lerp(nat, g.y0, wgt);
}
function graveY(x, w, h) {
  const nx = x / w;
  return h * (0.782 + Math.sin(nx * 6.3 + 0.8) * 0.010 + (noise1(nx * 5 + 9) - 0.5) * 0.018);
}
function fenceY(x, w, h) { return graveY(x, w, h) + h * 0.062; }
function pathS(F, y) { return clamp((y - F.g.pathTop) / (F.h - F.g.pathTop)); }
function pathCx(F, y) { const s = pathS(F, y); return F.g.cx + Math.sin(s * 4.0 + 0.5) * F.w * 0.075 * Math.pow(s, 0.8); }
function pathHalf(F, y) { const s = pathS(F, y); return (5 + 7 * Math.pow(s, 1.1)) * F.g.u; }

/* ===================================================================== */
/* manor data, in "units" (x from manor centre, y up from the base)       */
/* ===================================================================== */
// x, y, w, h, shape (0 rect, 1 arch, 2 round), flags (1 shutter L, 2 shutter R, 4 eyes, 8 dormer hood, 16 tower, 32 ghost-capable)
const WIN = [
  [-18, 9.5, 4.0, 7.0, 1, 0], [-10.5, 9.5, 4.0, 7.0, 1, 0], [8.5, 9.5, 4.0, 7.0, 1, 0], [16.5, 9.5, 4.0, 7.0, 1, 1],
  [-18, 22.5, 4.0, 7.0, 1, 1 | 32], [-10.5, 22.5, 4.0, 7.0, 1, 32], [8.5, 22.5, 4.0, 7.0, 1, 32], [16.5, 22.5, 4.0, 7.0, 1, 2 | 32],
  [-11, 37, 3.6, 5.6, 1, 8 | 32], [9, 37, 3.6, 5.6, 1, 8], [-1, 44, 4.4, 4.4, 2, 4],
  [-42, 8.5, 3.4, 5.8, 1, 0], [-31, 8.5, 3.4, 5.8, 1, 2], [-42, 19.5, 3.4, 5.0, 1, 1 | 32], [-31, 19.5, 3.4, 5.0, 1, 32],
  [-64, 7, 3.4, 5.6, 1, 0], [-54, 7, 3.4, 5.6, 1, 0], [-64, 14.5, 3.4, 5.0, 1, 2], [-54, 14.5, 3.4, 5.0, 1, 1 | 32], [-59, 27, 3.8, 3.8, 2, 0],
  [45, 8.5, 3.2, 5.6, 1, 0], [45, 19.2, 3.2, 4.8, 1, 0],
  [55, 7, 3.4, 5.6, 1, 0], [65, 7, 3.4, 5.6, 1, 0], [55, 14.5, 3.4, 5.0, 1, 1], [65, 14.5, 3.4, 5.0, 1, 2 | 32], [60, 28, 3.8, 3.8, 2, 0],
  [31, 10.5, 3.4, 5.4, 1, 16], [31, 21, 3.4, 6.2, 1, 16 | 32], [31, 31, 3.4, 6.2, 1, 16 | 32], [31, 40, 3.2, 5.2, 1, 16 | 32],
];
const NW = WIN.length;
const EYES = 10;
const SURV = 2;
const GHOST_WINDOWS = [4, 5, 6, 7, 8, 13, 14, 18, 25, 28, 29, 30];
const WALLS = [[-24, 0, 22, 30], [-49, 0, -24, 24], [-70, 0, -49, 20], [40, 0, 50, 22], [50, 0, 70, 22]];
// roofs: eaveL(x,y), topL, topR, eaveR
const ROOFS = [
  [-26, 30, -6, 54, 4, 54, 24, 30],
  [-51, 24, -45, 32, -28, 32, -22, 24],
  [-72, 20, -59, 35, -59, 35, -46, 20],
  [38, 22, 43, 28.5, 47, 28.5, 52, 22],
  [48, 22, 60, 37, 60, 37, 72, 22],
];
const GABLES = [0, 2, 4];
const HIPS = [1, 3];
const CHIM = [[-31, 28, 41, 3.0], [14, 36, 50, 3.2], [62, 30, 44, 3.0], [-66, 24, 36, 2.8]];
const EAVES = [[-26, 30], [24, 30], [-51, 24], [-22, 24], [-72, 20], [-46, 20], [72, 22], [48, 22], [52, 22], [-47.5, 14.2], [47.5, 14.2], [0, 14.2]];
const RAIN_LAYERS = [
  { n: 110, v: 0.62, len: 0.017, a: 0.10, lw: 0.7 },
  { n: 80, v: 0.95, len: 0.026, a: 0.16, lw: 1.0 },
  { n: 48, v: 1.35, len: 0.040, a: 0.24, lw: 1.4 },
];
const LW = [1, 0.62, 0.42, 0.28, 0.19, 0.12];
const LEVELS = 6;
const FENCE_H = 0.074, PILLAR_H = 0.092;

/* ===================================================================== */
/* init helpers                                                           */
/* ===================================================================== */
function makeStars() {
  const n = 160, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = hash(i * 7.17 + 1.3); a[i * 3 + 1] = hash(i * 3.91 + 8.2); a[i * 3 + 2] = 0.35 + hash(i * 1.9 + 4) * 0.85;
  }
  return a;
}
function initClouds() {
  const arr = [];
  for (let i = 0; i < 9; i++) {
    const blobs = [], n = 4 + Math.floor(hash(i * 3.3) * 3);
    for (let k = 0; k < n; k++) {
      blobs.push({
        ox: (hash(i * 11 + k * 1.7) - 0.5) * 0.26, oy: (hash(i * 5 + k * 2.9) - 0.5) * 0.03,
        rx: 0.07 + hash(i * 7 + k * 3.1) * 0.08, ry: 0.014 + hash(i * 13 + k * 1.3) * 0.022, a: 0.5 + hash(i * 17 + k) * 0.5,
      });
    }
    arr.push({ x: hash(i * 9.1), y: 0.10 + hash(i * 4.7) * 0.36, sp: 0.5 + hash(i * 6.3) * 1.2, a: 0.10 + hash(i * 2.9) * 0.14, blobs });
  }
  return arr;
}
function initForest() {
  const layers = [];
  for (let k = 0; k < 2; k++) {
    const n = k === 0 ? 80 : 64, a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      a[i * 4] = (i + hash(k * 50 + i * 1.3) * 0.9) / n;
      a[i * 4 + 1] = 0.026 + hash(k * 70 + i * 2.1) * 0.052;
      a[i * 4 + 2] = 0.0045 + hash(k * 90 + i * 3.3) * 0.005;
      a[i * 4 + 3] = hash(k * 110 + i * 4.7);
    }
    layers.push(a);
  }
  return layers;
}

function growBranch(segs, seed, x, y, ang, len, level, depth) {
  const n = len > 0.12 ? 3 : 2;
  let cx = x, cy = y, a = ang;
  for (let i = 0; i < n; i++) {
    a += (hash(seed + i * 3.1 + level * 1.7) - 0.5) * 0.55;
    const nx = cx + (Math.cos(a) * len) / n, ny = cy + (Math.sin(a) * len) / n;
    segs[level].push(cx, cy, nx, ny);
    cx = nx; cy = ny;
  }
  if (level >= LEVELS - 1 || depth <= 0 || len < 0.012) return;
  growBranch(segs, seed * 1.71 + 1.3, cx, cy, a + 0.42 + hash(seed + 5) * 0.45, len * (0.60 + hash(seed + 6) * 0.14), level + 1, depth - 1);
  growBranch(segs, seed * 1.37 + 2.9, cx, cy, a - 0.42 - hash(seed + 7) * 0.45, len * (0.58 + hash(seed + 8) * 0.14), level + 1, depth - 1);
  if (hash(seed + 9) > 0.5) {
    const mx = (x + cx) * 0.5, my = (y + cy) * 0.5;
    growBranch(segs, seed * 2.1 + 4.4, mx, my, a + (hash(seed + 10) > 0.5 ? 1 : -1) * (0.7 + hash(seed + 11) * 0.5), len * 0.5, level + 1, depth - 2);
  }
}
// normalised tree: base (0,0), height 1, y up
function genTree(seed) {
  const segs = [];
  for (let i = 0; i < LEVELS; i++) segs.push([]);
  const K = 7, pts = [[0, 0]];
  let px = 0, py = 0;
  for (let k = 1; k <= K; k++) {
    const ny = k / K;
    const nx = Math.sin(k * 0.95 + seed) * 0.022 + (hash(seed + k * 2.3) - 0.5) * 0.018 + (k > 4 ? (hash(seed + 31) - 0.5) * 0.05 * (k - 4) : 0);
    segs[k <= 3 ? 0 : k <= 5 ? 1 : 2].push(px, py, nx, ny);
    px = nx; py = ny; pts.push([nx, ny]);
  }
  for (let k = 2; k <= K; k++) {
    const P = pts[k];
    const side = (k + Math.floor(hash(seed + k) * 2)) % 2 === 0 ? 1 : -1;
    const ang = PI / 2 - side * (0.55 + hash(seed + k * 4.1) * 0.6);
    const len = Math.max(0.07, (0.30 - k * 0.025) * (0.85 + hash(seed + k * 6.7) * 0.5));
    growBranch(segs, seed * 7.3 + k * 13.1, P[0], P[1], ang, len, k <= 3 ? 1 : 2, 3);
    if (k >= 3 && hash(seed + k * 9.1) > 0.45) {
      growBranch(segs, seed * 5.9 + k * 3.3, P[0], P[1], PI / 2 + side * (0.5 + hash(seed + k * 2.2) * 0.5), Math.max(0.06, len * 0.8), 2, 3);
    }
  }
  growBranch(segs, seed * 3.7 + 1, pts[K][0], 1, PI / 2 + (hash(seed + 90) - 0.5) * 0.5, 0.2, 2, 3);
  growBranch(segs, seed * 4.1 + 2, pts[K][0], 1, PI / 2 + 0.6, 0.15, 3, 2);
  growBranch(segs, seed * 4.9 + 3, pts[K][0], 1, PI / 2 - 0.6, 0.15, 3, 2);
  return segs.map((s) => Float32Array.from(s));
}
function pickSeg(arr, mode) {
  let best = 0, bs = -1e9;
  for (let i = 0; i + 3 < arr.length; i += 4) {
    const dx = Math.abs(arr[i + 2] - arr[i]), dy = Math.abs(arr[i + 3] - arr[i + 1]);
    const s = mode === 0 ? dx - dy * 0.8 + hash(i * 0.37) * 0.002 : arr[i + 3] + hash(i * 0.41) * 0.002;
    if (s > bs) { bs = s; best = i / 4; }
  }
  return best;
}
function lvlWithSegs(segs, lv) { while (lv > 0 && segs[lv].length < 8) lv--; return lv; }

// x, height, thickness, sway, back, drop, swing, lantern
const TREE_DEFS = [
  [0.035, 0.64, 0.019, 1.0, false, 0.030, true, false],
  [0.118, 0.50, 0.014, 0.9, false, 0.012, false, true],
  [0.205, 0.33, 0.009, 0.8, true, 0.0, false, false],
  [0.795, 0.35, 0.009, 0.8, true, 0.0, false, false],
  [0.885, 0.52, 0.014, 1.0, false, 0.012, false, true],
  [0.968, 0.62, 0.019, 0.9, false, 0.030, true, false],
];
function makeTree(def, i, corner) {
  const seed = i * 73 + 11 + (corner ? 500 : 0);
  const segs = genTree(seed);
  const tr = {
    x: def[0], h: def[1], tw: def[2], sway: def[3], back: def[4], drop: def[5], corner: !!corner, gyFrac: def[8] || 0,
    speed: 0.04 + hash(i + 12) * 0.08, phase: hash(i + 19) * TAU, segs,
    sw: 0, fl: 0, ft: 0, gx: 0, gy: 0, H: 1, px: [0, 0], py: [0, 0],
    swing: null, lantern: null, perch: [null, null],
  };
  if (def[6]) { const lv = lvlWithSegs(segs, 1); tr.swing = { lv, idx: pickSeg(segs[lv], 0) }; }
  if (def[7]) { const lv = lvlWithSegs(segs, 2); tr.lantern = { lv, idx: pickSeg(segs[lv], 0) }; }
  const l3 = lvlWithSegs(segs, 3), l4 = lvlWithSegs(segs, 4);
  tr.perch[0] = { lv: l3, idx: pickSeg(segs[l3], 1) };
  tr.perch[1] = { lv: l4, idx: pickSeg(segs[l4], 1) };
  return tr;
}
function initTrees() { return TREE_DEFS.map((d, i) => makeTree(d, i, false)); }
function initCorners() {
  return [
    makeTree([0.012, 0.42, 0.024, 1.2, false, 0, false, false, -0.03], 21, true),
    makeTree([0.992, 0.36, 0.022, 1.1, false, 0, false, false, -0.03], 27, true),
  ];
}
function initGraves() {
  const arr = [];
  for (let i = 0; i < 26; i++) {
    arr.push({
      nx: 0.03 + hash(i * 3.7 + 1) * 0.94, d: hash(i * 4.2 + 2), size: 0.040 + hash(i * 7.1 + 3) * 0.028,
      tilt: (hash(i * 8.7 + 4) - 0.5) * 0.24, type: Math.floor(hash(i * 11.3 + 5) * 6), tx: 0, ty: 0, vis: false,
    });
  }
  arr.push({ nx: 0.165, d: 0.04, size: 0.082, tilt: 0, type: 12, tx: 0, ty: 0, vis: false });
  arr.push({ nx: 0.765, d: 0.34, size: 0.105, tilt: 0.02, type: 10, tx: 0, ty: 0, vis: false });
  arr.push({ nx: 0.625, d: 0.58, size: 0.040, tilt: 0, type: 11, tx: 0, ty: 0, vis: false });
  arr.sort((a, b) => a.d - b.d);
  return arr;
}
function initCrows(graves) {
  const eligible = [];
  for (let i = 0; i < graves.length; i++) {
    const g = graves[i];
    if ((g.type === 0 || g.type === 1 || g.type === 5) && Math.abs(g.nx - 0.5) > 0.22 && g.d > 0.2) eligible.push(i);
  }
  const spec = [[0, 0, 0], [0, 5, 0], [0, 15, 0], [0, 20, 0], [3, 0, 0], [3, 1, 0],
    [2, 0, 0], [2, 1, 1], [2, 4, 0], [2, 5, 1], [2, 0, 1]];
  for (let j = 0; j < 4 && j < eligible.length; j++) spec.push([1, eligible[Math.floor((j * eligible.length) / 4)], 0]);
  return spec.map((s, i) => ({
    kind: s[0], ref: s[1], sub: s[2], size: 0.85 + hash(i * 3.3 + 1) * 0.3, dir: hash(i * 5.1 + 2) > 0.5 ? 1 : -1,
    ph: hash(i * 7.7 + 3) * TAU, dx: (hash(i * 9.9 + 4) - 0.5) * 4, wheel: hash(i * 2.3 + 5) > 0.55 ? 1 : 0.2,
    lift: hash(i * 4.9 + 6), fdir: 1, fj: hash(i * 6.1 + 7), fj2: hash(i * 8.3 + 8),
  }));
}
function initCandles() {
  const a = [];
  for (let i = 0; i < 14; i++) {
    const porch = i % 2 === 0;
    a.push({
      x: porch ? 0.28 + hash(i * 2.3 + 1) * 0.44 : 0.06 + hash(i * 2.9 + 2) * 0.88,
      y: porch ? 0.58 + hash(i * 7.1 + 3) * 0.13 : 0.76 + hash(i * 5.3 + 4) * 0.12,
      sc: 0.8 + hash(i * 9.7 + 5) * 0.5, sp: 0.5 + hash(i * 3.4 + 6) * 0.6, ph: hash(i * 8.3 + 7) * TAU, rise: hash(i * 4.7 + 8),
    });
  }
  return a;
}
function initFog() {
  const L = [
    { n: 5, y: [0.605, 0.665], rx: [0.20, 0.30], ry: [0.020, 0.032], a: 0.08, sp: 0.55 },
    { n: 6, y: [0.690, 0.750], rx: [0.16, 0.26], ry: [0.018, 0.030], a: 0.10, sp: 0.80 },
    { n: 7, y: [0.790, 0.850], rx: [0.15, 0.26], ry: [0.022, 0.036], a: 0.12, sp: 1.15 },
    { n: 8, y: [0.890, 0.975], rx: [0.16, 0.28], ry: [0.028, 0.050], a: 0.14, sp: 1.6 },
  ];
  return L.map((l, li) => {
    const b = [];
    for (let i = 0; i < l.n; i++) {
      b.push({
        x: hash(li * 17 + i * 3.3 + 1), y: lerp(l.y[0], l.y[1], hash(li * 5 + i * 2.1 + 2)),
        rx: lerp(l.rx[0], l.rx[1], hash(li * 3 + i * 7.7 + 3)), ry: lerp(l.ry[0], l.ry[1], hash(li * 13 + i * 5.5 + 9)),
        a: l.a * (0.7 + 0.6 * hash(li * 11 + i * 1.9 + 4)),
        sp: l.sp * (0.6 + 0.8 * hash(li * 13 + i * 4.1 + 5)) * (hash(li * 19 + i + 6) > 0.5 ? 1 : -0.7), ph: hash(i + li * 9) * TAU,
      });
    }
    return b;
  });
}
function initLeaves() {
  const a = [];
  for (let i = 0; i < 38; i++) {
    a.push({ x: hash(i * 2.13 + 1), y: 0.60 + hash(i * 3.31 + 2) * 0.38, sp: 0.35 + hash(i * 4.41 + 3) * 0.8, wob: 0.7 + hash(i * 5.17 + 4) * 1.5, ph: hash(i * 6.2 + 5) * TAU, sz: 0.7 + hash(i * 7.4 + 6) * 1.5, spin: 0.8 + hash(i * 8.1 + 7) * 2.5 });
  }
  return a;
}
function initMotes() {
  const a = [];
  for (let i = 0; i < 64; i++) {
    a.push({ x: hash(i * 1.73 + 1), y: 0.48 + hash(i * 2.91 + 2) * 0.46, sp: 0.2 + hash(i * 4.27 + 3) * 0.8, wob: 0.3 + hash(i * 6.14 + 4) * 1.2, ph: hash(i * 8.37 + 5) * TAU, sz: 0.4 + hash(i * 9.61 + 6) * 0.8 });
  }
  return a;
}
function initPuddles() {
  return [
    { x: 0.18, y: 0.915, rx: 0.075 }, { x: 0.33, y: 0.955, rx: 0.060 }, { x: 0.52, y: 0.930, rx: 0.090 },
    { x: 0.68, y: 0.965, rx: 0.070 }, { x: 0.82, y: 0.915, rx: 0.065 }, { x: 0.44, y: 0.900, rx: 0.045 }, { x: 0.93, y: 0.950, rx: 0.050 },
  ];
}
function initStormOrder() {
  const idx = [];
  for (let i = 0; i < NW; i++) idx.push(i);
  idx.sort((a, b) => hash(a * 3.3 + 7) - hash(b * 3.3 + 7));
  const order = new Float32Array(NW);
  idx.forEach((wi, k) => { order[wi] = k; });
  return order;
}
function makeFrame() {
  const d = {};
  ['tmp', 'tmp2', 'wallTop', 'wallLo', 'roof', 'gable', 'frame', 'glass', 'lit', 'moon', 'cloud', 'stone', 'a', 'b'].forEach((k) => { d[k] = mkc(); });
  const mkph = () => ({ x: 0, cyc: 0, normal: 0, strange: 0, supernatural: 0, storm: 0, aftermath: 0, eerie: 0, rain: 0, wet: 0, cover: 0 });
  return {
    t: 0, w: 1, h: 1, S: 1, wind: 0, flash: 0, strike: -1, strikeSeed: 0, boltX: 0, lightX: 0, rimA: 0.3,
    p: makePalette(), ph: mkph(), tmpPh: mkph(), g: { u: 1, cx: 0, y0: 0, pathTop: 0 }, moon: { x: 0, y: 0, r: 1 },
    gate: { x: 0, half: 10 }, gr: {}, d,
  };
}

/* ===================================================================== */
/* per-frame setup                                                        */
/* ===================================================================== */
function layout(F) {
  const w = F.w, h = F.h, g = F.g, m = F.moon;
  const wf = clamp(0.52 + (0.9 - w / h) * 0.35, 0.52, 0.8);
  g.u = Math.max(1, Math.min((w * wf) / 140, (h * 0.585) / 78));
  g.cx = w * 0.5;
  g.y0 = h * 0.69;
  g.pathTop = g.y0 + 2.7 * g.u;
  m.r = Math.max(16, Math.min(w, h) * 0.135);
  m.x = g.cx - 3 * g.u;
  m.y = Math.max(m.r + h * 0.03, g.y0 - 59 * g.u);
  const yf = fenceY(g.cx, w, h);
  F.gate.x = pathCx(F, yf);
  F.gate.half = pathHalf(F, yf) * 1.12;
}

function strikeEnv(s) {
  if (s < 0) return 0;
  if (s < 0.12) return 0.5 * smooth(s / 0.12);
  if (s < 0.28) return lerp(0.5, 0.14, smooth((s - 0.12) / 0.16));
  if (s < 0.40) return lerp(0.14, 1, smooth((s - 0.28) / 0.12));
  if (s < 0.78) return 1 - smooth((s - 0.40) / 0.38);
  return 0;
}
function lightning(F) {
  const ph = F.ph, x = ph.x, cyc = ph.cyc;
  const n = Math.round(3 * LIGHTNING_FREQUENCY);
  let env = 0, idx = -1;
  for (let i = 0; i < n; i++) {
    if (i === 2 && LIGHTNING_FREQUENCY <= 1.01 && hash2(cyc, 77) < 0.3) continue;
    const t0 = T_STORM + 3 + ((i + 0.12 + hash2(cyc, i + 1) * 0.72) / Math.max(1, n)) * (T_AFTER - T_STORM - 6);
    const s = x - t0;
    if (s > 0 && s < 0.8) {
      const e = strikeEnv(s) * (0.82 + 0.18 * hash2(cyc, i + 11));
      if (e >= env) { env = e; idx = i; }
    }
  }
  F.flash = env; F.strike = idx;
  F.strikeSeed = cyc * 131 + (idx + 1) * 17 + 3;
  F.boltX = F.w * (0.14 + 0.72 * hash(F.strikeSeed * 0.77 + 1));
}
const FLASH_MIX = { skyTop: 0.18, skyMid: 0.24, horizon: 0.30, g1: 0.30, g2: 0.32, g3: 0.34, g4: 0.34, g5: 0.30, haze: 0.35, fog: 0.35, rim: 0.5 };
function applyFlash(F) {
  const f = F.flash;
  if (f < 0.003) return;
  for (const k in FLASH_MIX) mixInto(F.p[k], F.p[k], FLASH_COL, FLASH_MIX[k] * f);
}
function frameSetup(F, st, t, w, h) {
  const x = ((t % PERIOD) + PERIOD) % PERIOD;
  F.t = t; F.w = w; F.h = h;
  F.S = clamp(Math.min(w / 1100, h / 700), 0.5, 1.5);
  const ph = F.ph;
  fillPhase(ph, x);
  ph.x = x; ph.cyc = Math.floor(t / PERIOD);
  fillPalette(F.p, x);
  const el = clamp(t - st.lastT, 0, 0.1);
  st.lastT = t;
  F.wind = windAt(t, ph);
  st.windPh += F.wind * el;
  st.cloudPh += el * (1 + ph.storm * 1.4);
  st.fogPh += el * (1 + ph.rain * 1.1);
  layout(F);
  lightning(F);
  applyFlash(F);
  F.lightX = lerp(F.moon.x, F.boltX, clamp(F.flash * 1.6));
  F.rimA = (0.30 + 0.07 * ph.supernatural + 0.04 * ph.aftermath) * (1 - ph.cover * 0.5) + F.flash * 0.55;
}
function unitGrad(c, rgbStr, a0, a1) {
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(' + rgbStr + ',' + a0 + ')');
  g.addColorStop(0.5, 'rgba(' + rgbStr + ',' + a1 + ')');
  g.addColorStop(1, 'rgba(' + rgbStr + ',0)');
  return g;
}
function makeGradients(c, F) {
  const p = F.p, gr = F.gr;
  gr.warm = unitGrad(c, '255,176,86', 1, 0.34);
  gr.cold = unitGrad(c, '188,218,236', 1, 0.32);
  gr.green = unitGrad(c, '168,236,190', 1, 0.32);
  gr.fog = unitGrad(c, rgbs(p.fog), 0.95, 0.46);
  mixInto(F.d.cloud, p.skyMid, p.haze, 0.24);
  gr.cloud = unitGrad(c, rgbs(F.d.cloud), 0.95, 0.5);
  gr.storm = unitGrad(c, '4,7,12', 0.96, 0.55);
}
function prepColors(F) {
  const p = F.p, d = F.d;
  mixInto(d.wallTop, p.g3, p.haze, 0.15); mixInto(d.wallTop, d.wallTop, p.rim, 0.05);
  mixInto(d.wallLo, p.g4, p.g5, 0.3);
  mixInto(d.roof, p.g5, p.skyTop, 0.3);
  mixInto(d.gable, d.wallTop, d.roof, 0.5);
  mixInto(d.frame, p.g5, p.skyTop, 0.2);
  mixInto(d.glass, p.skyMid, p.g5, 0.5);
  mixInto(d.lit, d.wallTop, p.rim, 0.3);
}

/* soft unit-gradient blob: cheap, one gradient reused many times */
function blob(c, g, x, y, rx, ry, a) {
  if (!(a > 0.002) || !(rx > 0.5) || !(ry > 0.5)) return;
  c.save();
  c.translate(x, y);
  c.scale(rx, ry);
  c.globalAlpha = a > 1 ? 1 : a;
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 1, 0, TAU);
  c.fill();
  c.restore();
}
function winPath(c, x, y, ww, wh, shape) {
  const hw = Math.max(0.5, ww * 0.5), hh = Math.max(0.5, wh * 0.5);
  if (shape === 2) { c.moveTo(x + hw, y); c.arc(x, y, hw, 0, TAU); return; }
  if (shape === 1) {
    c.moveTo(x - hw, y + hh); c.lineTo(x - hw, y - hh + hw);
    c.arc(x, y - hh + hw, hw, PI, 0);
    c.lineTo(x + hw, y + hh); c.closePath(); return;
  }
  c.rect(x - hw, y - hh, hw * 2, hh * 2);
}

/* ===================================================================== */
/* sky, moon, clouds                                                      */
/* ===================================================================== */
function drawSky(c, F) {
  const w = F.w, h = F.h, p = F.p, ph = F.ph;
  const g = c.createLinearGradient(0, 0, 0, h * 0.72);
  g.addColorStop(0, css(p.skyTop));
  g.addColorStop(0.55, css(p.skyMid));
  g.addColorStop(1, css(p.horizon));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const k = ph.strange * 0.05 + ph.supernatural * 0.11;
  if (k > 0.004) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    blob(c, F.gr.green, w * 0.5, h * 0.62, w * 0.75, h * 0.26, k);
    c.restore();
  }
}

function drawStars(c, F, st) {
  const t = F.t, w = F.w, h = F.h, S = F.S, ph = F.ph, moon = F.moon;
  const vis = (0.45 + F.p.night * 0.55) * (1 - ph.cover * 0.9);
  if (vis < 0.03) return;
  const s = st.stars, n = s.length / 3, mr2 = sq(moon.r * 1.9);
  c.save();
  for (let b = 0; b < 3; b++) {
    const tw = 0.6 + 0.4 * Math.sin(t * (0.6 + b * 0.43) + b * 2.1);
    c.fillStyle = 'rgba(216,230,238,' + (0.62 * vis * tw).toFixed(3) + ')';
    c.beginPath();
    for (let i = b; i < n; i += 3) {
      const x = s[i * 3] * w, y = s[i * 3 + 1] * h * 0.55;
      if (sq(x - moon.x) + sq(y - moon.y) < mr2) continue;
      const r = Math.max(0.35, s[i * 3 + 2] * S);
      c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
    }
    c.fill();
  }
  c.strokeStyle = 'rgba(210,228,240,' + (0.32 * vis).toFixed(3) + ')';
  c.lineWidth = Math.max(0.4, 0.6 * S);
  c.beginPath();
  for (let i = 0; i < 9; i++) {
    const x = s[i * 3] * w, y = s[i * 3 + 1] * h * 0.55;
    if (sq(x - moon.x) + sq(y - moon.y) < mr2) continue;
    const tw = Math.max(0, Math.sin(t * (0.8 + hash(i) * 0.9) + i * 3.1));
    const L = (2 + 4 * tw * tw) * S;
    c.moveTo(x - L, y); c.lineTo(x + L, y); c.moveTo(x, y - L); c.lineTo(x, y + L);
  }
  c.stroke();
  c.restore();
}

const MARIA = [[-0.28, -0.18, 0.30], [0.12, -0.30, 0.22], [0.18, 0.10, 0.34], [-0.12, 0.22, 0.20], [0.38, -0.02, 0.12], [-0.40, 0.14, 0.14], [0.02, -0.02, 0.18]];
const CRATERS = [[-0.52, -0.30, 0.07], [0.46, 0.34, 0.09], [-0.20, 0.56, 0.06], [0.30, -0.56, 0.06], [0.60, -0.08, 0.05], [-0.62, 0.20, 0.05]];

function drawMoon(c, F) {
  const p = F.p, ph = F.ph, moon = F.moon, d = F.d, S = F.S;
  const mx = moon.x, my = moon.y, r = moon.r;
  const sick = ph.supernatural;
  mixInto(d.moon, p.moon, GREEN_TINT, sick * 0.55);
  const m = d.moon;
  const bright = clamp(1 + sick * 0.15 - ph.cover * 0.5, 0.35, 1.2);
  c.save();
  c.globalCompositeOperation = 'lighter';
  const hr = r * 3.6;
  const hg = c.createRadialGradient(mx, my, r * 0.8, mx, my, hr);
  hg.addColorStop(0, css(m, 0.24 * bright));
  hg.addColorStop(0.28, css(m, 0.09 * bright));
  hg.addColorStop(1, css(m, 0));
  c.fillStyle = hg;
  c.fillRect(mx - hr, my - hr, hr * 2, hr * 2);
  c.restore();

  c.save();
  c.beginPath();
  c.arc(mx, my, r, 0, TAU);
  c.clip();
  const A = clamp(0.98 - ph.cover * 0.2);
  mixInto(d.tmp, m, WHITE, 0.25);
  mixInto(d.tmp2, m, p.haze, 0.38);
  const dg = c.createRadialGradient(mx - r * 0.25, my - r * 0.22, r * 0.05, mx, my, r * 1.04);
  dg.addColorStop(0, css(d.tmp, A));
  dg.addColorStop(0.55, css(m, A));
  dg.addColorStop(1, css(d.tmp2, A));
  c.fillStyle = dg;
  c.fillRect(mx - r, my - r, r * 2, r * 2);
  c.fillStyle = 'rgba(84,106,102,0.20)';
  c.beginPath();
  for (let i = 0; i < MARIA.length; i++) {
    const q = MARIA[i], cx = mx + q[0] * r, cy = my + q[1] * r, cr = Math.max(1, q[2] * r);
    c.moveTo(cx + cr, cy); c.arc(cx, cy, cr, 0, TAU);
  }
  c.fill();
  c.strokeStyle = 'rgba(110,130,124,0.20)';
  c.lineWidth = Math.max(0.5, S * 0.7);
  c.beginPath();
  for (let i = 0; i < CRATERS.length; i++) {
    const q = CRATERS[i], cx = mx + q[0] * r, cy = my + q[1] * r, cr = Math.max(1, q[2] * r);
    c.moveTo(cx + cr, cy); c.arc(cx, cy, cr, 0, TAU);
  }
  c.stroke();
  c.restore();
  c.strokeStyle = css(m, 0.16 * bright);
  c.lineWidth = Math.max(0.8, S * 1.2);
  c.beginPath(); c.arc(mx, my, r, 0, TAU); c.stroke();
}

function drawClouds(c, F, st) {
  const w = F.w, h = F.h, ph = F.ph, gr = F.gr, moon = F.moon, t = F.t;
  const span = w * 1.7;
  const vis = 0.85 + ph.cover * 2.0 + ph.strange * 0.1;
  for (let i = 0; i < st.clouds.length; i++) {
    const cg = st.clouds[i];
    const gx = ((cg.x * span + st.cloudPh * cg.sp * w * 0.006) % span) - w * 0.35, gy = cg.y * h;
    for (let k = 0; k < cg.blobs.length; k++) {
      const b = cg.blobs[k];
      blob(c, gr.cloud, gx + b.ox * w, gy + b.oy * h, b.rx * w, b.ry * h, cg.a * vis * b.a);
    }
  }
  if (ph.cover > 0.01) {
    for (let i = 0; i < 9; i++) {
      const gx = ((hash(i * 3.7 + 1) * span + st.cloudPh * (0.5 + hash(i + 3) * 0.8) * w * 0.01) % span) - w * 0.35;
      blob(c, gr.storm, gx, h * (0.03 + 0.30 * hash(i * 5.1 + 2)), w * (0.20 + 0.12 * hash(i * 2.2 + 4)), h * (0.07 + 0.06 * hash(i * 8.3 + 5)), ph.cover * 0.55);
    }
    for (let k = 0; k < 3; k++) {
      const x = moon.x + Math.sin(t * 0.05 + k * 2.1) * moon.r * 1.1 + (k - 1) * moon.r * 0.6;
      const y = moon.y + (k - 1) * moon.r * 0.35 + Math.sin(t * 0.07 + k) * moon.r * 0.12;
      blob(c, gr.storm, x, y, moon.r * (1.5 + k * 0.3), moon.r * 0.55, ph.cover * 0.62);
    }
  }
}
function drawMoonWisps(c, F, st) {
  const w = F.w, moon = F.moon, ph = F.ph;
  const vis = 0.6 + 0.4 * (1 - ph.cover * 0.5);
  for (let i = 0; i < 5; i++) {
    const sp = 0.7 + i * 0.33;
    const x = ((i * 0.29 * w * 1.5 + st.cloudPh * sp * w * 0.0075) % (w * 1.5)) - w * 0.25;
    const y = moon.y + (hash(i * 3.3 + 1) - 0.5) * moon.r * 1.7 + Math.sin(st.cloudPh * 0.05 + i) * moon.r * 0.06;
    blob(c, F.gr.cloud, x, y, moon.r * (1.1 + 0.35 * (i % 3)), moon.r * (0.07 + 0.05 * hash(i * 7.7 + 2)), 0.30 * vis * (0.7 + 0.3 * hash(i + 5)));
  }
}

/* ===================================================================== */
/* lightning bolt (procedural, seeded)                                    */
/* ===================================================================== */
const BOLT = new Float32Array(66);
const BRANCH = [new Float32Array(18), new Float32Array(18), new Float32Array(18), new Float32Array(18)];
function genBolt(arr, seed, x1, y1, x2, y2, levels, jag) {
  arr[0] = x1; arr[1] = y1; arr[2] = x2; arr[3] = y2;
  let segs = 1;
  for (let lv = 0; lv < levels; lv++) {
    for (let i = segs; i >= 0; i--) { arr[i * 4] = arr[i * 2]; arr[i * 4 + 1] = arr[i * 2 + 1]; }
    for (let i = 0; i < segs; i++) {
      const ax = arr[i * 4], ay = arr[i * 4 + 1], bx = arr[i * 4 + 4], by = arr[i * 4 + 5];
      const dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy) || 1;
      const o = (hash(seed + lv * 7.31 + i * 1.93) - 0.5) * len * jag;
      arr[i * 4 + 2] = (ax + bx) * 0.5 - (dy / len) * o;
      arr[i * 4 + 3] = (ay + by) * 0.5 + (dx / len) * o;
    }
    segs *= 2;
  }
  return segs + 1;
}
function drawBolt(c, F) {
  const e = F.flash;
  if (e < 0.01) return;
  const w = F.w, h = F.h, S = F.S, gr = F.gr, seed = F.strikeSeed;
  const x1 = F.boltX, y1 = -h * 0.03;
  const x2 = x1 + (hash(seed + 4.4) - 0.5) * w * 0.20, y2 = h * (0.60 + hash(seed + 9.9) * 0.06);
  const np = genBolt(BOLT, seed, x1, y1, x2, y2, 5, 0.50);
  const tdx = x2 - x1, tdy = y2 - y1, tl = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
  for (let b = 0; b < 4; b++) {
    const idx = 5 + Math.floor(hash(seed + b * 3.3) * 20);
    const sx = BOLT[idx * 2], sy = BOLT[idx * 2 + 1];
    const side = b % 2 === 0 ? 1 : -1;
    const ang = Math.atan2(tdy, tdx) + side * (0.5 + hash(seed + b * 5.5) * 0.45);
    const len = tl * (0.12 + hash(seed + b * 8.1) * 0.10);
    genBolt(BRANCH[b], seed + 31 + b * 7, sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, 3, 0.45);
  }
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round'; c.lineJoin = 'round';
  blob(c, gr.cold, lerp(x1, x2, 0.6), h * 0.28, w * 0.42, h * 0.38, 0.22 * e);
  blob(c, gr.cold, x1, h * 0.10, w * 0.30, h * 0.12, 0.28 * e);
  const a = clamp(e * 1.25);
  const widths = [9 * S, 3.4 * S, 1.3 * S], cols = ['rgba(150,190,230,' + 0.16 * a + ')', 'rgba(200,225,250,' + 0.38 * a + ')', 'rgba(250,253,255,' + 0.95 * a + ')'];
  for (let pass = 0; pass < 3; pass++) {
    c.strokeStyle = cols[pass];
    c.lineWidth = widths[pass];
    c.beginPath();
    c.moveTo(BOLT[0], BOLT[1]);
    for (let i = 1; i < np; i++) c.lineTo(BOLT[i * 2], BOLT[i * 2 + 1]);
    c.stroke();
    c.lineWidth = widths[pass] * 0.55;
    c.beginPath();
    for (let b = 0; b < 4; b++) {
      c.moveTo(BRANCH[b][0], BRANCH[b][1]);
      for (let i = 1; i < 9; i++) c.lineTo(BRANCH[b][i * 2], BRANCH[b][i * 2 + 1]);
    }
    c.stroke();
  }
  c.restore();
}

/* ===================================================================== */
/* rain                                                                   */
/* ===================================================================== */
function drawRain(c, F, from, to) {
  const rain = F.ph.rain;
  if (rain < 0.02) return;
  const t = F.t, w = F.w, h = F.h, S = F.S;
  const slant = 0.18 + clamp(F.wind, 0, 1.6) * 0.30;
  c.save();
  c.lineCap = 'round';
  for (let l = from; l <= to; l++) {
    const L = RAIN_LAYERS[l];
    const n = Math.floor(L.n * RAIN_AMOUNT * rain);
    if (n < 1) continue;
    c.strokeStyle = css(F.p.rim, L.a * clamp(0.5 + rain * 0.8));
    c.lineWidth = Math.max(0.5, L.lw * S);
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const sd = l * 977 + i;
      const len = h * L.len * (0.7 + hash(sd * 1.7) * 0.6);
      const spanY = h + len * 2;
      const y = ((hash(sd * 3.1) * spanY + t * h * L.v) % spanY) - len;
      const x = hash(sd * 5.3) * w * 1.3 - w * 0.15 - h * slant * 0.6 + y * slant;
      c.moveTo(x, y); c.lineTo(x + len * slant, y + len);
    }
    c.stroke();
  }
  c.restore();
}

/* ===================================================================== */
/* land: far ridges, hill, path                                           */
/* ===================================================================== */
function drawFarLand(c, F, st) {
  const w = F.w, h = F.h, p = F.p, d = F.d;
  const cols = [p.g1, p.g2, p.g3], hz = [0.46, 0.30, 0.18];
  const step = Math.max(6, w / 120);
  for (let k = 0; k < 3; k++) {
    mixInto(d.tmp, cols[k], p.haze, hz[k]);
    c.fillStyle = css(d.tmp);
    c.beginPath();
    c.moveTo(0, h);
    for (let x = 0; x <= w + step; x += step) c.lineTo(x, farRidgeY(x, w, h, k));
    c.lineTo(w + step, h); c.closePath(); c.fill();
    if (k < 2) {
      mixInto(d.tmp2, d.tmp, p.g5, 0.38);
      c.fillStyle = css(d.tmp2);
      const a = st.forest[k], n = a.length / 4;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const x = a[i * 4] * w, base = farRidgeY(x, w, h, k) + 2, th = a[i * 4 + 1] * h, tw = Math.max(1.5, a[i * 4 + 2] * w), kind = a[i * 4 + 3];
        if (kind < 0.72) {
          for (let j = 0; j < 3; j++) {
            const yb = base - th * 0.30 * j, yt = base - th * (0.50 + 0.28 * j), half = tw * (1 - 0.28 * j);
            c.moveTo(x - half, yb); c.lineTo(x, yt); c.lineTo(x + half, yb); c.closePath();
          }
        } else {
          c.moveTo(x - tw * 0.15, base); c.lineTo(x, base - th); c.lineTo(x + tw * 0.15, base); c.closePath();
          c.moveTo(x, base - th * 0.55); c.lineTo(x + tw * 0.9, base - th * 0.82); c.lineTo(x + tw * 0.2, base - th * 0.5); c.closePath();
          c.moveTo(x, base - th * 0.70); c.lineTo(x - tw * 0.8, base - th * 0.92); c.lineTo(x - tw * 0.2, base - th * 0.64); c.closePath();
        }
      }
      c.fill();
    }
    if (k === 0) {
      c.strokeStyle = css(p.rim, 0.05 + F.flash * 0.1);
      c.lineWidth = Math.max(0.6, F.S * 0.8);
      c.beginPath();
      for (let x = 0; x <= w + step; x += step) { const y = farRidgeY(x, w, h, 0); if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
    }
  }
}
function drawHill(c, F) {
  const w = F.w, h = F.h, p = F.p, d = F.d, S = F.S;
  const step = Math.max(6, w / 140);
  const gr = c.createLinearGradient(0, h * 0.62, 0, h);
  mixInto(d.tmp, p.g3, p.haze, 0.07);
  mixInto(d.tmp2, p.g4, p.g5, 0.5);
  gr.addColorStop(0, css(d.tmp)); gr.addColorStop(1, css(d.tmp2));
  c.fillStyle = gr;
  c.beginPath();
  c.moveTo(0, h);
  for (let x = 0; x <= w + step; x += step) c.lineTo(x, hillY(x, F));
  c.lineTo(w + step, h); c.closePath(); c.fill();
  c.strokeStyle = css(p.rim, 0.10 + F.flash * 0.15);
  c.lineWidth = Math.max(0.6, S);
  c.beginPath();
  for (let x = 0; x <= w + step; x += step) { const y = hillY(x, F); if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
  c.stroke();
  c.save();
  c.globalCompositeOperation = 'lighter';
  blob(c, F.gr.cold, F.moon.x, F.g.y0 + h * 0.04, w * 0.34, h * 0.06, 0.05 * (1 - F.ph.cover * 0.7));
  c.restore();
}
function drawPathway(c, F) {
  const w = F.w, h = F.h, g = F.g, p = F.p, d = F.d, S = F.S, wet = F.ph.wet;
  const N = 20, yTop = g.pathTop;
  c.beginPath();
  for (let i = 0; i <= N; i++) {
    const y = lerp(yTop, h + 4, i / N);
    const x = pathCx(F, y) - pathHalf(F, y);
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const y = lerp(yTop, h + 4, i / N);
    c.lineTo(pathCx(F, y) + pathHalf(F, y), y);
  }
  c.closePath();
  const gr = c.createLinearGradient(0, yTop, 0, h);
  mixInto(d.tmp, p.g3, p.haze, 0.22);
  mixInto(d.tmp2, p.g4, p.haze, 0.08);
  gr.addColorStop(0, css(d.tmp)); gr.addColorStop(1, css(d.tmp2));
  c.fillStyle = gr; c.fill();
  if (wet > 0.02) { c.fillStyle = css(p.rim, 0.10 * wet); c.fill(); }
  c.strokeStyle = css(p.rim, 0.08 + F.flash * 0.1);
  c.lineWidth = Math.max(0.6, S * 1.1);
  c.stroke();
  c.fillStyle = css(p.rim, 0.06);
  c.beginPath();
  for (let i = 0; i < 16; i++) {
    const y = lerp(yTop + (h - yTop) * 0.04, h, hash(i * 3.3 + 1));
    const x = pathCx(F, y) + (hash(i * 5.7 + 2) - 0.5) * pathHalf(F, y) * 1.5;
    const rx = Math.max(1.5, (1.4 + hash(i + 3) * 2.4) * S * (0.6 + pathS(F, y) * 1.4));
    c.moveTo(x + rx, y); c.ellipse(x, y, rx, Math.max(0.8, rx * 0.38), 0, 0, TAU);
  }
  c.fill();
}

/* ===================================================================== */
/* trees                                                                  */
/* ===================================================================== */
let PX = 0, PY = 0;
function tp(tr, lx, ly, lvl) {
  let dd = tr.sw * ly * ly;
  if (lvl > 2) dd += tr.fl * ly * Math.sin(tr.ft + ly * 7 + lx * 5 + lvl);
  PX = tr.gx + (lx + dd) * tr.H;
  PY = tr.gy - ly * tr.H;
}
function drawTree(c, F, st, tr) {
  const t = F.t, w = F.w, h = F.h, S = F.S, p = F.p, wind = F.wind;
  tr.gx = tr.x * w;
  tr.gy = tr.corner ? tr.gyFrac * h : hillY(tr.gx, F) + tr.drop * h;
  tr.H = (tr.corner ? -1 : 1) * tr.h * h;
  tr.sw = Math.sin(t * (0.42 + tr.speed) + tr.phase) * 0.012 * wind * tr.sway + 0.028 * wind * tr.sway + Math.sin(t * 1.1 + tr.phase * 2) * 0.004 * wind * wind;
  tr.fl = 0.0045 * wind * tr.sway;
  tr.ft = t * (2.1 + tr.speed * 3) + tr.phase;
  const lit = F.lightX > tr.gx ? 1 : -1, ox = lit * 1.5 * S, oy = -0.9 * S;
  const dark = tr.corner ? 'rgba(2,4,7,0.985)' : css(p.g5, 0.98);
  const rimStr = css(p.rim, F.rimA * (tr.corner ? 0.45 : 0.8));
  const tw = tr.tw * h, sc = st.scratch;
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (let lv = 0; lv < LEVELS; lv++) {
    const arr = tr.segs[lv], n = arr.length;
    if (!n) continue;
    for (let i = 0; i < n; i += 2) { tp(tr, arr[i], arr[i + 1], lv); sc[i] = PX; sc[i + 1] = PY; }
    const lw = Math.max(0.55 * S, tw * LW[lv]);
    c.lineWidth = lw;
    if (lv <= 3) {
      c.strokeStyle = rimStr;
      c.beginPath();
      for (let i = 0; i < n; i += 4) { c.moveTo(sc[i] + ox, sc[i + 1] + oy); c.lineTo(sc[i + 2] + ox, sc[i + 3] + oy); }
      c.stroke();
    }
    c.strokeStyle = dark;
    c.beginPath();
    for (let i = 0; i < n; i += 4) { c.moveTo(sc[i], sc[i + 1]); c.lineTo(sc[i + 2], sc[i + 3]); }
    c.stroke();
    if (lv <= 1) {
      c.strokeStyle = 'rgba(0,0,0,0.38)';
      c.lineWidth = lw * 0.36;
      c.beginPath();
      for (let i = 0; i < n; i += 4) { c.moveTo(sc[i] - ox * 1.6, sc[i + 1]); c.lineTo(sc[i + 2] - ox * 1.6, sc[i + 3]); }
      c.stroke();
    }
  }
  c.restore();
  if (tr.corner) return;
  for (let k = 0; k < 2; k++) {
    const pr = tr.perch[k], arr = tr.segs[pr.lv], i = pr.idx * 4;
    tp(tr, arr[i + 2], arr[i + 3], pr.lv);
    tr.px[k] = PX; tr.py[k] = PY;
  }
  if (tr.swing) {
    const arr = tr.segs[tr.swing.lv], i = tr.swing.idx * 4;
    tp(tr, (arr[i] + arr[i + 2]) * 0.5, (arr[i + 1] + arr[i + 3]) * 0.5, tr.swing.lv);
    drawSwing(c, F, PX, PY, tr.H * 0.11);
  }
  if (tr.lantern) {
    const arr = tr.segs[tr.lantern.lv], i = tr.lantern.idx * 4;
    tp(tr, (arr[i] + arr[i + 2]) * 0.5, (arr[i + 1] + arr[i + 3]) * 0.5, tr.lantern.lv);
    drawLantern(c, F, PX, PY, tr.H * 0.045);
  }
}
function drawSwing(c, F, ax, ay, len) {
  const t = F.t, S = F.S, p = F.p, wind = clamp(F.wind, 0, 1.6);
  const a = Math.sin(t * 0.85 + ax * 0.01) * (0.04 + wind * 0.10) + 0.03 * wind;
  const sx = Math.sin(a) * len, sy = Math.cos(a) * len, hw = len * 0.12;
  c.save();
  c.strokeStyle = css(p.g5, 0.95);
  c.lineWidth = Math.max(0.8, 1.3 * S);
  c.beginPath();
  c.moveTo(ax - hw, ay); c.lineTo(ax - hw + sx, ay + sy);
  c.moveTo(ax + hw, ay); c.lineTo(ax + hw + sx, ay + sy);
  c.stroke();
  c.translate(ax + sx, ay + sy); c.rotate(a);
  c.fillStyle = css(p.g5, 0.98);
  c.fillRect(-hw * 1.35, 0, hw * 2.7, Math.max(2, len * 0.045));
  c.restore();
  c.strokeStyle = css(p.rim, F.rimA * 0.5);
  c.lineWidth = Math.max(0.4, 0.6 * S);
  c.beginPath(); c.moveTo(ax - hw + 1, ay); c.lineTo(ax - hw + sx + 1, ay + sy); c.stroke();
}
function drawLantern(c, F, ax, ay, chain) {
  const t = F.t, S = F.S, p = F.p, wind = clamp(F.wind, 0, 1.6);
  const a = Math.sin(t * 1.15 + ax * 0.02) * (0.05 + wind * 0.09);
  const lx = ax + Math.sin(a) * chain, ly = ay + Math.cos(a) * chain;
  const fl = (0.8 + 0.2 * Math.sin(t * 4.1 + ax * 0.02) * Math.sin(t * 1.7) + (noise1(t * 6 + ax) - 0.5) * 0.16) * (1 - 0.5 * F.ph.rain);
  c.strokeStyle = css(p.g5, 0.95);
  c.lineWidth = Math.max(0.7, S);
  c.beginPath(); c.moveTo(ax, ay); c.lineTo(lx, ly); c.stroke();
  c.fillStyle = css(p.g5, 0.98);
  c.beginPath();
  c.moveTo(lx - 5 * S, ly); c.lineTo(lx, ly - 4 * S); c.lineTo(lx + 5 * S, ly); c.closePath();
  c.rect(lx - 4 * S, ly, 8 * S, 11 * S);
  c.fill();
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = 'rgba(255,190,100,' + (0.8 * fl).toFixed(3) + ')';
  c.fillRect(lx - 2.6 * S, ly + 2 * S, 5.2 * S, 7 * S);
  blob(c, F.gr.warm, lx, ly + 5 * S, 30 * S, 30 * S, 0.30 * fl);
  c.restore();
}
function drawTrees(c, F, st, back) {
  for (let i = 0; i < st.trees.length; i++) if (st.trees[i].back === back) drawTree(c, F, st, st.trees[i]);
}

/* ===================================================================== */
/* manor: windows                                                         */
/* ===================================================================== */
function layoutWindows(F, st) {
  const g = F.g, u = g.u;
  for (let i = 0; i < NW; i++) {
    const q = WIN[i];
    st.wx[i] = g.cx + q[0] * u; st.wy[i] = g.y0 - q[1] * u; st.ww[i] = q[2] * u; st.wh[i] = q[3] * u;
    st.wi[i] = winIntensity(F, st, i, q);
  }
  computeGhosts(F, st);
}
function winIntensity(F, st, i, q) {
  if (q[5] & 4) return 0;
  const t = F.t, ph = F.ph, id = i + 1;
  const P = 9 + hash(id * 3.1) * 9;
  const sl = (t + hash(id * 5.7) * 40) / P, k = Math.floor(sl);
  const r = lerp(hash2(k, id), hash2(k + 1, id), smooth((sl - k - 0.78) / 0.22));
  const prob = 0.24 * ph.normal + 0.46 * ph.strange + 0.80 * ph.supernatural + 0.42 * ph.storm + 0.52 * ph.aftermath;
  let v = smooth((prob - r) / 0.18 + 0.5);
  v *= 0.90 + 0.10 * Math.sin(t * (2.1 + hash(id) * 1.7) + id * 5) * Math.sin(t * 0.7 + id) + (noise1(t * 1.3 + id * 9) - 0.5) * 0.14;
  const dp = (t + hash(id * 2.2) * 23) / 23, dk = Math.floor(dp);
  if (hash2(dk, id + 50) > 0.74) v *= 1 - 0.85 * Math.sin(clamp((dp - dk) / 0.15) * PI);
  const fk = 0.5 + 0.5 * Math.sin(t * (3.2 + hash(id + 3) * 2) + id * 7);
  v *= 1 - ph.strange * 0.30 * fk * fk * fk;
  const wave = 0.5 + 0.5 * Math.sin(t * 0.9 - q[0] * 0.06 + 0.4);
  v = Math.max(v * (1 + ph.supernatural * (wave * 0.55 - 0.15)), ph.supernatural * 0.30 * wave);
  const x = ph.x;
  if (i === SURV) v = lerp(v, 0.9 + 0.06 * Math.sin(t * 3.1), ph.storm);
  else {
    const dark = smooth((x - (T_STORM + 1 + st.order[i] * 0.4)) / 1.5);
    const relight = smooth((x - (T_AFTER + 0.5 + hash(id * 4.4) * 3.6)) / 2.2);
    v *= 1 - dark * (1 - relight);
  }
  return clamp(v * (0.5 + F.p.glow * 0.6), 0, 1.1);
}
function computeGhosts(F, st) {
  const ph = F.ph;
  st.gAmt.fill(0);
  if (ph.supernatural < 0.005) return;
  const x = ph.x, cyc = ph.cyc;
  const shift = Math.floor(hash(cyc * 3.1 + 5) * GHOST_WINDOWS.length), tshift = Math.floor(hash(cyc * 1.7 + 2) * 3);
  for (let k = 0; k < 3; k++) {
    const s0 = T_SUPER + 0.8 + k * 5.2 + hash2(cyc, k + 3) * 1.4;
    const a = bump(x, s0, s0 + 7, 1.8, 2.4);
    if (a > 0.003) {
      const wi = GHOST_WINDOWS[(shift + k * 3) % GHOST_WINDOWS.length];
      st.gAmt[wi] = Math.max(st.gAmt[wi], a * clamp(ph.supernatural * 1.6) * GHOST_VISIBILITY);
      st.gType[wi] = (k + tshift) % 3;
      st.gLoc[wi] = x - s0;
    }
  }
}
function drawGhostIn(c, F, x, y, ww, wh, shape, type, amt, loc, seed) {
  const a = Math.min(1, amt), hh = wh * 0.5, hw = ww * 0.5;
  c.save();
  c.beginPath(); winPath(c, x, y, ww, wh, shape); c.clip();
  c.fillStyle = 'rgba(110,165,155,' + 0.24 * a + ')';
  c.fillRect(x - ww, y - wh, ww * 2, wh * 2);
  const gr = c.createLinearGradient(0, y - hh, 0, y + hh);
  gr.addColorStop(0, 'rgba(218,238,228,' + 0.80 * a + ')');
  gr.addColorStop(0.7, 'rgba(192,224,214,' + 0.56 * a + ')');
  gr.addColorStop(1, 'rgba(170,205,195,' + 0.06 * a + ')');
  c.fillStyle = gr;
  const sw = Math.sin(loc * 0.7 + seed) * hw * 0.10;
  let hx = x, hy = y;
  c.beginPath();
  if (type === 0) {
    hx = x + sw * 0.5; hy = y - 0.52 * hh;
    c.ellipse(hx, y - 0.50 * hh, 0.17 * hh, 0.21 * hh, 0, 0, TAU);
    c.moveTo(hx + 0.13 * hh, hy); c.arc(hx, hy, 0.13 * hh, 0, TAU);
    c.moveTo(x - 0.15 * hh + sw * 0.6, y - 0.36 * hh);
    c.quadraticCurveTo(x - 0.10 * hh + sw * 0.3, y + 0.15 * hh, x - 0.52 * hh + sw * 0.1, y + 1.05 * hh);
    c.lineTo(x + 0.52 * hh + sw * 0.1, y + 1.05 * hh);
    c.quadraticCurveTo(x + 0.10 * hh + sw * 0.3, y + 0.15 * hh, x + 0.15 * hh + sw * 0.6, y - 0.36 * hh);
    c.closePath();
  } else if (type === 1) {
    hx = x + Math.sin(loc * 0.35) * hw * 0.12; hy = y - 0.62 * hh;
    c.ellipse(hx, hy, 0.12 * hh, 0.18 * hh, 0, 0, TAU);
    c.moveTo(x - 0.16 * hh, y - 0.44 * hh); c.lineTo(x - 0.30 * hh, y + 1.05 * hh);
    c.lineTo(x + 0.30 * hh, y + 1.05 * hh); c.lineTo(x + 0.16 * hh, y - 0.44 * hh); c.closePath();
  } else {
    hx = x + sw * 0.4; hy = y + 0.08 * hh;
    c.moveTo(hx + 0.13 * hh, hy); c.arc(hx, hy, 0.13 * hh, 0, TAU);
    c.moveTo(x - 0.11 * hh, y + 0.24 * hh); c.lineTo(x - 0.30 * hh, y + 1.05 * hh);
    c.lineTo(x + 0.30 * hh, y + 1.05 * hh); c.lineTo(x + 0.11 * hh, y + 0.24 * hh); c.closePath();
  }
  c.fill();
  c.fillStyle = 'rgba(6,12,14,' + 0.7 * a + ')';
  const er = Math.max(0.4, 0.028 * hh);
  c.beginPath();
  c.ellipse(hx - 0.05 * hh, hy, er, er * 1.5, 0, 0, TAU);
  c.moveTo(hx + 0.05 * hh + er, hy); c.ellipse(hx + 0.05 * hh, hy, er, er * 1.5, 0, 0, TAU);
  c.fill();
  c.restore();
  c.save();
  c.globalCompositeOperation = 'lighter';
  blob(c, F.gr.green, x, y, ww * 1.5, wh * 0.9, 0.14 * a);
  c.restore();
}
function drawEyes(c, F, st) {
  const t = F.t, ph = F.ph;
  const pulse = smooth((Math.sin(t * 0.31 + 1.1) + 0.35) / 0.9);
  const vis = ph.strange * 0.55 * pulse + ph.supernatural * (0.55 + 0.3 * pulse) + ph.aftermath * 0.65;
  if (vis < 0.02) return;
  const x = st.wx[EYES], y = st.wy[EYES], d = st.ww[EYES];
  const b9 = (t % 9.3) / 9.3;
  const blink = b9 > 0.92 ? 1 - Math.sin(((b9 - 0.92) / 0.08) * PI) * 0.92 : 1;
  const a = vis * 0.6;
  c.save();
  c.beginPath(); winPath(c, x, y, d, d, 2); c.clip();
  c.fillStyle = 'rgba(14,26,26,' + 0.35 * a + ')';
  c.fillRect(x - d, y - d, d * 2, d * 2);
  c.globalCompositeOperation = 'lighter';
  blob(c, F.gr.green, x, y, d * 0.85, d * 0.55, 0.20 * a);
  const ex = d * 0.19, ey = Math.max(0.5, d * 0.075 * blink), er = Math.max(1, d * 0.13);
  c.fillStyle = 'rgba(200,255,205,' + 0.9 * a + ')';
  c.beginPath();
  c.moveTo(x - ex + er, y + d * 0.02); c.ellipse(x - ex, y + d * 0.02, er, ey, -0.18, 0, TAU);
  c.moveTo(x + ex + er, y + d * 0.02); c.ellipse(x + ex, y + d * 0.02, er, ey, 0.18, 0, TAU);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = 'rgba(4,10,8,' + 0.8 * a + ')';
  const pr = Math.max(0.3, er * 0.16);
  c.beginPath();
  c.moveTo(x - ex + pr, y + d * 0.02); c.ellipse(x - ex, y + d * 0.02, pr, ey, 0, 0, TAU);
  c.moveTo(x + ex + pr, y + d * 0.02); c.ellipse(x + ex, y + d * 0.02, pr, ey, 0, 0, TAU);
  c.fill();
  c.restore();
}
function drawWindows(c, F, st) {
  const t = F.t, S = F.S, p = F.p, g = F.g, wind = F.wind, d = F.d, u = g.u;
  const wx = st.wx, wy = st.wy, ww = st.ww, wh = st.wh, wi = st.wi, ga = st.gAmt;
  c.fillStyle = css(d.frame, 0.98);
  c.beginPath();
  for (let i = 0; i < NW; i++) {
    winPath(c, wx[i], wy[i], ww[i] * 1.28, wh[i] * 1.16, WIN[i][4]);
    c.rect(wx[i] - ww[i] * 0.72, wy[i] + wh[i] * 0.52, ww[i] * 1.44, 0.45 * u);
  }
  c.fill();
  for (let i = 0; i < NW; i++) {
    const I = clamp(wi[i], 0, 1.1), G = Math.min(1, ga[i]);
    c.beginPath(); winPath(c, wx[i], wy[i], ww[i], wh[i], WIN[i][4]);
    c.fillStyle = css(d.glass, 0.96); c.fill();
    if (I > 0.01) {
      const k = Math.min(1, I) * (1 - 0.7 * G);
      c.fillStyle = 'rgba(255,' + ((176 + I * 26) | 0) + ',' + ((92 + I * 30) | 0) + ',' + (0.82 * k).toFixed(3) + ')';
      c.fill();
    }
  }
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < NW; i++) {
    const I = wi[i];
    if (I < 0.03) continue;
    const R = Math.max(ww[i], wh[i]) * 3.0, k = I * WINDOW_GLOW_STRENGTH * (1 - 0.6 * Math.min(1, ga[i]));
    blob(c, F.gr.warm, wx[i], wy[i], R, R, 0.16 * k);
    blob(c, F.gr.warm, wx[i], wy[i], R * 0.5, R * 0.5, 0.12 * k);
  }
  c.restore();
  // broken shutters
  c.fillStyle = css(d.frame, 0.97);
  c.strokeStyle = css(p.rim, F.rimA * 0.35);
  c.lineWidth = Math.max(0.5, 0.7 * S);
  for (let i = 0; i < NW; i++) {
    const fl = WIN[i][5];
    if (!(fl & 3)) continue;
    const sg = fl & 1 ? -1 : 1, hwi = ww[i] * 0.5;
    const sway = Math.sin(t * (0.9 + hash(i + 5) * 0.6) + i * 2.3) * 0.045 * (0.4 + clamp(wind, 0, 1.6) * 1.4);
    c.save();
    c.translate(wx[i] + sg * hwi * 1.25, wy[i] - wh[i] * 0.5);
    c.rotate(sg * -0.30 + sway);
    const sw = ww[i] * 0.62, sh = wh[i] * 1.04;
    c.fillRect(sg < 0 ? -sw : 0, 0, sw, sh);
    c.beginPath();
    for (let k = 1; k < 4; k++) { c.moveTo(sg < 0 ? -sw : 0, sh * k * 0.25); c.lineTo(sg < 0 ? 0 : sw, sh * k * 0.25); }
    c.stroke();
    c.restore();
  }
  for (let i = 0; i < NW; i++) {
    if (ga[i] > 0.01) drawGhostIn(c, F, wx[i], wy[i], ww[i], wh[i], WIN[i][4], st.gType[i], ga[i], st.gLoc[i], i * 1.7);
  }
  drawEyes(c, F, st);
  // mullions
  c.strokeStyle = css(d.frame, 0.92);
  c.lineWidth = Math.max(0.8, 1.2 * S);
  c.beginPath();
  for (let i = 0; i < NW; i++) {
    const x = wx[i], y = wy[i], hw = ww[i] * 0.5, hh = wh[i] * 0.5, sh = WIN[i][4];
    if (sh === 2) { c.moveTo(x - hw, y); c.lineTo(x + hw, y); c.moveTo(x, y - hw); c.lineTo(x, y + hw); } else {
      c.moveTo(x, y - hh); c.lineTo(x, y + hh);
      c.moveTo(x - hw, y - hh * 0.15); c.lineTo(x + hw, y - hh * 0.15);
      if (sh === 1) { c.moveTo(x - hw, y - hh + hw); c.lineTo(x + hw, y - hh + hw); }
    }
  }
  c.stroke();
  // curtains on lit windows
  for (let i = 0; i < NW; i++) {
    const I = wi[i];
    if (I < 0.15 || WIN[i][4] === 2) continue;
    const x = wx[i], y = wy[i], hw = ww[i] * 0.5, hh = wh[i] * 0.5;
    const ty = WIN[i][4] === 1 ? y - hh + hw : y - hh * 0.9;
    c.fillStyle = 'rgba(14,7,4,' + (0.5 * Math.min(1, I)).toFixed(3) + ')';
    c.beginPath();
    c.moveTo(x - hw, ty); c.lineTo(x - hw * 0.25, ty); c.lineTo(x - hw, y + hh * 0.25);
    c.moveTo(x + hw, ty); c.lineTo(x + hw * 0.25, ty); c.lineTo(x + hw, y + hh * 0.25);
    c.fill();
  }
  // sill rims
  c.strokeStyle = css(p.rim, F.rimA * 0.45);
  c.lineWidth = Math.max(0.5, 0.7 * S);
  c.beginPath();
  for (let i = 0; i < NW; i++) { c.moveTo(wx[i] - ww[i] * 0.72, wy[i] + wh[i] * 0.52); c.lineTo(wx[i] + ww[i] * 0.72, wy[i] + wh[i] * 0.52); }
  c.stroke();
}

/* ===================================================================== */
/* manor: porch, balcony door, vane, smoke, main body                     */
/* ===================================================================== */
function doorOpen(F) {
  const ph = F.ph, s0 = T_STRANGE + 2.8 + hash2(ph.cyc, 40) * 3;
  return smoother((ph.x - s0) / 3.6) * (1 - smoother((ph.x - (s0 + 10.5)) / 4.0));
}
function drawPorch(c, F, st, X, Y) {
  const t = F.t, S = F.S, p = F.p, g = F.g, u = g.u, d = F.d, wind = clamp(F.wind, 0, 1.6);
  const dk = css(d.frame, 0.98);
  // soft shadow under the porch roof
  const sg = c.createLinearGradient(0, Y(14.2), 0, Y(0));
  sg.addColorStop(0, 'rgba(0,0,0,0.42)'); sg.addColorStop(0.55, 'rgba(0,0,0,0.10)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg;
  c.fillRect(X(-48), Y(14.2), 96 * u, 14.2 * u);
  // roof slab
  c.fillStyle = dk;
  c.beginPath();
  c.moveTo(X(-49.5), Y(14.2)); c.lineTo(X(-47.5), Y(16.6)); c.lineTo(X(47.5), Y(16.6)); c.lineTo(X(49.5), Y(14.2)); c.closePath();
  c.fill();
  c.strokeStyle = css(p.rim, F.rimA * 0.8);
  c.lineWidth = Math.max(0.6, 1.1 * S);
  c.beginPath(); c.moveTo(X(-47.5), Y(16.6) - 0.6); c.lineTo(X(47.5), Y(16.6) - 0.6); c.stroke();
  // columns, railing
  c.fillStyle = dk;
  c.beginPath();
  for (let k = 0; k <= 16; k++) {
    if (k === 8) continue;
    const x = -1 + (k - 8) * 5.75;
    c.rect(X(x - 0.4), Y(14.2), 0.8 * u, 14.2 * u);
    c.rect(X(x - 0.7), Y(14.2), 1.4 * u, 0.6 * u);
  }
  c.rect(X(-47), Y(3.9), 43.6 * u, 0.45 * u); c.rect(X(2.4), Y(3.9), 44.6 * u, 0.45 * u);
  c.rect(X(-47), Y(1.4), 43.6 * u, 0.4 * u); c.rect(X(2.4), Y(1.4), 44.6 * u, 0.4 * u);
  for (let x = -46.6; x < 45; x += 1.0) {
    if (Math.abs(x + 1) < 3.4) continue;
    c.rect(X(x), Y(3.9), 0.22 * u, 2.5 * u);
  }
  c.rect(X(-4.7), Y(4.5), 0.9 * u, 4.5 * u); c.rect(X(2.8), Y(4.5), 0.9 * u, 4.5 * u);
  c.fill();
  c.strokeStyle = css(p.rim, F.rimA * 0.5);
  c.lineWidth = Math.max(0.5, 0.7 * S);
  c.beginPath();
  c.moveTo(X(-47), Y(3.9)); c.lineTo(X(-3.4 - 1), Y(3.9)); c.moveTo(X(2.4), Y(3.9)); c.lineTo(X(47), Y(3.9));
  c.stroke();
  // entrance door + fanlight (stays lit when the survivor window does)
  const fan = 0.35 + 0.5 * clamp(st.wi[SURV]);
  c.fillStyle = css(d.frame, 0.99);
  c.beginPath(); winPath(c, X(-1), Y(4.3), 4.6 * u, 8.6 * u, 1); c.fill();
  c.strokeStyle = css(p.rim, 0.10);
  c.lineWidth = Math.max(0.5, 0.7 * S);
  c.beginPath(); c.moveTo(X(-1), Y(0.2)); c.lineTo(X(-1), Y(7.2)); c.moveTo(X(-2.6), Y(3.2)); c.lineTo(X(0.6), Y(3.2)); c.stroke();
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = 'rgba(255,184,100,' + (0.55 * fan).toFixed(3) + ')';
  c.beginPath(); winPath(c, X(-1), Y(9.9), 3.0 * u, 1.5 * u, 1); c.fill();
  blob(c, F.gr.warm, X(-1), Y(9.4), 7 * u, 5 * u, 0.20 * fan * WINDOW_GLOW_STRENGTH);
  c.restore();
  // steps
  for (let i = 0; i < 3; i++) {
    const hwid = (5.4 + i * 0.9) * u, yy = g.y0 + i * 0.9 * u;
    mixInto(d.tmp, p.g3, p.haze, 0.10 + i * 0.02);
    c.fillStyle = css(d.tmp, 0.98);
    c.fillRect(g.cx - 1 * u - hwid, yy, hwid * 2, 0.9 * u);
    c.fillStyle = css(p.rim, F.rimA * 0.22);
    c.fillRect(g.cx - 1 * u - hwid, yy, hwid * 2, Math.max(0.6, 0.12 * u));
  }
  // porch lamps
  for (let k = 0; k < 2; k++) {
    const lx0 = k === 0 ? -7 : 5;
    const a = Math.sin(t * (1.2 + k * 0.3) + k * 2) * 0.06 * (0.4 + wind * 1.6);
    const ax = X(lx0), ay = Y(14.2), lx = ax + Math.sin(a) * 2.0 * u, ly = ay + Math.cos(a) * 2.0 * u;
    const fl = (0.8 + 0.2 * Math.sin(t * 6.1 + k * 3) * Math.sin(t * 2.3 + k) + (noise1(t * 5 + k * 9) - 0.5) * 0.16) * (1 - 0.35 * F.ph.storm);
    c.strokeStyle = dk; c.lineWidth = Math.max(0.7, 0.14 * u);
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(lx, ly); c.stroke();
    c.fillStyle = dk;
    c.beginPath(); c.moveTo(lx - 0.8 * u, ly); c.lineTo(lx, ly - 0.7 * u); c.lineTo(lx + 0.8 * u, ly); c.closePath(); c.rect(lx - 0.65 * u, ly, 1.3 * u, 1.7 * u); c.fill();
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,192,104,' + (0.8 * fl).toFixed(3) + ')';
    c.fillRect(lx - 0.4 * u, ly + 0.3 * u, 0.8 * u, 1.1 * u);
    blob(c, F.gr.warm, lx, ly + 0.9 * u, 6 * u, 6 * u, 0.30 * fl * WINDOW_GLOW_STRENGTH);
    blob(c, F.gr.warm, lx, g.y0 + 1.2 * u, 7 * u, 1.6 * u, 0.12 * fl);
    c.restore();
  }
}
function drawBalconyDoor(c, F, X, Y) {
  const t = F.t, S = F.S, p = F.p, g = F.g, u = g.u, d = F.d, wind = clamp(F.wind, 0, 1.6);
  const open = doorOpen(F);
  const dx = X(-1), top = Y(24), bot = Y(16.6), dw = 3.6 * u, dh = bot - top;
  // balcony railing on the porch roof
  c.strokeStyle = css(d.frame, 0.98); c.lineWidth = Math.max(0.8, 0.26 * u);
  c.beginPath();
  c.moveTo(X(-9), Y(19.4)); c.lineTo(X(7), Y(19.4));
  for (let x = -9; x <= 7.01; x += 1.0) { c.moveTo(X(x), Y(16.6)); c.lineTo(X(x), Y(19.4)); }
  c.stroke();
  c.fillStyle = css(d.frame, 0.98);
  c.fillRect(dx - dw * 0.62, top - 0.5 * u, dw * 1.24, dh + 0.5 * u);
  c.save();
  c.beginPath(); c.rect(dx - dw * 0.5, top, dw, dh); c.clip();
  c.fillStyle = css(d.glass, 0.97); c.fillRect(dx - dw, top, dw * 2, dh);
  if (open > 0.01) {
    const g2 = c.createLinearGradient(0, top, 0, bot);
    g2.addColorStop(0, 'rgba(255,190,110,' + 0.55 * open + ')'); g2.addColorStop(1, 'rgba(255,150,70,' + 0.88 * open + ')');
    c.fillStyle = g2; c.fillRect(dx - dw, top, dw * 2, dh);
    c.fillStyle = 'rgba(12,6,4,' + 0.62 * open + ')';
    c.beginPath();
    c.moveTo(dx - dw * 0.5, top);
    for (let k = 0; k <= 8; k++) {
      const f = k / 8;
      c.lineTo(dx - dw * 0.5 + dw * (0.20 + 0.12 * Math.sin(t * 1.6 + f * 4.2) * (0.5 + Math.min(1, wind)) * (0.3 + f * 0.7)), top + dh * f);
    }
    c.lineTo(dx - dw * 0.5, bot); c.closePath(); c.fill();
  }
  c.restore();
  const th = open * 1.18, cs = Math.cos(th), sn = Math.sin(th);
  const hx = dx - dw * 0.5, fw = dw * cs, gro = dh * 0.07 * sn;
  c.fillStyle = css(d.frame, 0.985);
  c.beginPath(); c.moveTo(hx, top); c.lineTo(hx + fw, top - gro); c.lineTo(hx + fw, bot + gro); c.lineTo(hx, bot); c.closePath(); c.fill();
  c.strokeStyle = css(p.rim, 0.13 + F.rimA * 0.2);
  c.lineWidth = Math.max(0.5, 0.7 * S);
  c.beginPath();
  c.moveTo(hx + fw * 0.12, top + dh * 0.12); c.lineTo(hx + fw * 0.88, top + dh * 0.12 - gro * 0.8);
  c.lineTo(hx + fw * 0.88, top + dh * 0.45 - gro * 0.2); c.lineTo(hx + fw * 0.12, top + dh * 0.45);
  c.closePath();
  c.moveTo(hx + fw, top - gro); c.lineTo(hx + fw, bot + gro);
  c.stroke();
  if (open > 0.01) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    blob(c, F.gr.warm, dx, bot - dh * 0.45, dw * 2.4, dh * 0.9, 0.22 * open * WINDOW_GLOW_STRENGTH);
    blob(c, F.gr.warm, dx + dw * 0.4, Y(16.4), 8 * u, 0.9 * u, 0.30 * open);
    c.restore();
  }
}
function drawVane(c, F, X, Y) {
  const t = F.t, p = F.p, u = F.g.u, d = F.d, wind = clamp(F.wind, 0, 1.5);
  const bx = X(31), by = Y(70), tilt = -0.15, pl = 8 * u;
  const tx = bx + Math.sin(tilt) * pl, ty = by - Math.cos(tilt) * pl;
  c.save();
  c.strokeStyle = css(d.frame, 0.98); c.lineWidth = Math.max(1, 0.34 * u);
  c.beginPath(); c.moveTo(bx, by + 0.6 * u); c.lineTo(tx, ty); c.stroke();
  const ang = Math.sin(t * 0.33) * 1.25 + Math.sin(t * 0.97 + 1.3) * 0.35 * wind;
  const ca = Math.cos(ang), L = 4.6 * u * Math.abs(ca), sgn = ca >= 0 ? 1 : -1;
  const ax = bx + Math.sin(tilt) * pl * 0.8, ay = by - Math.cos(tilt) * pl * 0.8;
  c.lineWidth = Math.max(1, 0.26 * u);
  c.beginPath(); c.moveTo(ax - L, ay); c.lineTo(ax + L, ay); c.stroke();
  c.fillStyle = css(d.frame, 0.98);
  c.beginPath();
  c.moveTo(ax + sgn * L, ay); c.lineTo(ax + sgn * (L - 1.4 * u * Math.abs(ca)), ay - 0.75 * u); c.lineTo(ax + sgn * (L - 1.4 * u * Math.abs(ca)), ay + 0.75 * u); c.closePath();
  c.moveTo(ax - sgn * L, ay); c.lineTo(ax - sgn * (L + 0.9 * u * Math.abs(ca)), ay - 1.3 * u); c.lineTo(ax - sgn * (L + 0.9 * u * Math.abs(ca)), ay + 0.5 * u); c.closePath();
  c.moveTo(tx + 0.5 * u, ty); c.arc(tx, ty, 0.5 * u, 0, TAU);
  c.fill();
  c.strokeStyle = css(p.rim, F.rimA * 0.8); c.lineWidth = Math.max(0.5, 0.12 * u);
  c.beginPath(); c.moveTo(bx + 0.2 * u, by); c.lineTo(tx + 0.2 * u, ty); c.stroke();
  c.restore();
}
function drawSmoke(c, F, X, Y) {
  const t = F.t, u = F.g.u, wind = clamp(F.wind, 0, 1.6), k = 1 - F.ph.rain * 0.8;
  for (let ci = 0; ci < 2; ci++) {
    const ch = CHIM[ci === 0 ? 0 : 2];
    for (let j = 0; j < 6; j++) {
      const q = (t * 0.075 + j / 6 + ci * 0.37) % 1;
      const x = X(ch[0]) + (Math.pow(q, 1.4) * (3 + wind * 12) + Math.sin(q * 6 + j + ci * 2) * 0.7) * u;
      const y = Y(ch[2] + 1) - q * 15 * u, r = (0.8 + q * 3.2) * u;
      blob(c, F.gr.fog, x, y, r, r * 0.8, (1 - q) * smooth(q * 6) * 0.14 * k);
    }
  }
}
function rimEdge(c, X, Y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1e-6) return;
  const nx = (-dy / L) * 0.95, ny = (dx / L) * 0.95;
  c.moveTo(X(ax + nx), Y(ay + ny)); c.lineTo(X(bx + nx), Y(by + ny));
}
function rimRoof(c, F, X, Y, r, aNear, aFar, lw, rimCol) {
  const nearLeft = F.lightX < X((r[0] + r[6]) * 0.5);
  c.lineWidth = lw;
  c.strokeStyle = css(rimCol, aNear);
  c.beginPath();
  if (nearLeft) rimEdge(c, X, Y, r[0], r[1], r[2], r[3]); else rimEdge(c, X, Y, r[4], r[5], r[6], r[7]);
  rimEdge(c, X, Y, r[2], r[3], r[4], r[5]);
  c.stroke();
  c.strokeStyle = css(rimCol, aFar);
  c.beginPath();
  if (nearLeft) rimEdge(c, X, Y, r[4], r[5], r[6], r[7]); else rimEdge(c, X, Y, r[0], r[1], r[2], r[3]);
  c.stroke();
}

function drawManor(c, F, st) {
  const t = F.t, S = F.S, p = F.p, g = F.g, d = F.d, u = g.u, y0 = g.y0, rimA = F.rimA;
  const X = (ux) => g.cx + ux * u, Y = (uy) => y0 - uy * u;
  layoutWindows(F, st);
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';

  // chimneys (behind the roofs)
  c.fillStyle = css(d.roof);
  c.beginPath();
  for (let i = 0; i < CHIM.length; i++) {
    const q = CHIM[i];
    c.rect(X(q[0] - q[3] * 0.5), Y(q[2]), q[3] * u, (q[2] - q[1]) * u);
    c.rect(X(q[0] - q[3] * 0.68), Y(q[2] + 0.9), q[3] * 1.36 * u, 1.0 * u);
  }
  c.fill();
  c.strokeStyle = css(p.rim, rimA * 0.8);
  c.lineWidth = Math.max(0.6, 1.1 * S);
  c.beginPath();
  for (let i = 0; i < CHIM.length; i++) {
    const q = CHIM[i], ex = X(q[0] + (F.lightX < X(q[0]) ? -1 : 1) * q[3] * 0.5);
    c.moveTo(ex, Y(q[1])); c.lineTo(ex, Y(q[2] + 0.9));
  }
  c.stroke();

  // walls
  const wg = c.createLinearGradient(0, Y(32), 0, y0);
  wg.addColorStop(0, css(d.wallTop)); wg.addColorStop(1, css(d.wallLo));
  c.fillStyle = wg;
  c.beginPath();
  for (let i = 0; i < WALLS.length; i++) { const q = WALLS[i]; c.rect(X(q[0]), Y(q[3]), (q[2] - q[0]) * u, (q[3] - q[1]) * u); }
  c.fill();
  c.strokeStyle = css(p.rim, 0.035 + F.flash * 0.10);
  c.lineWidth = Math.max(0.5, 0.6 * S);
  c.beginPath();
  for (let i = 0; i < WALLS.length; i++) {
    const q = WALLS[i];
    for (let yy = q[1] + 1.5; yy < q[3]; yy += 1.5) { c.moveTo(X(q[0]), Y(yy)); c.lineTo(X(q[2]), Y(yy)); }
  }
  c.stroke();
  // far-side shade strips, near-side rim line
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.beginPath();
  for (let i = 0; i < WALLS.length; i++) {
    const q = WALLS[i], x0 = X(q[0]), x1 = X(q[2]), nl = F.lightX < (x0 + x1) * 0.5;
    c.rect(nl ? x1 - 1.4 * u : x0, Y(q[3]), 1.4 * u, (q[3] - q[1]) * u);
  }
  c.fill();
  c.strokeStyle = css(p.rim, rimA * 0.7);
  c.lineWidth = Math.max(0.6, 1.0 * S);
  c.beginPath();
  for (let i = 0; i < WALLS.length; i++) {
    const q = WALLS[i], x0 = X(q[0]), x1 = X(q[2]), ex = F.lightX < (x0 + x1) * 0.5 ? x0 : x1;
    c.moveTo(ex, Y(q[3])); c.lineTo(ex, y0);
  }
  c.stroke();

  // gable faces + hip roofs
  c.fillStyle = css(d.gable);
  c.beginPath();
  for (let k = 0; k < GABLES.length; k++) {
    const r = ROOFS[GABLES[k]];
    c.moveTo(X(r[0]), Y(r[1])); c.lineTo(X(r[2]), Y(r[3])); c.lineTo(X(r[4]), Y(r[5])); c.lineTo(X(r[6]), Y(r[7])); c.closePath();
  }
  c.fill();
  c.fillStyle = css(d.roof);
  c.beginPath();
  for (let k = 0; k < HIPS.length; k++) {
    const r = ROOFS[HIPS[k]];
    c.moveTo(X(r[0]), Y(r[1])); c.lineTo(X(r[2]), Y(r[3])); c.lineTo(X(r[4]), Y(r[5])); c.lineTo(X(r[6]), Y(r[7])); c.closePath();
  }
  c.fill();
  c.strokeStyle = css(d.roof);
  c.lineWidth = 2.0 * u;
  c.beginPath();
  for (let k = 0; k < GABLES.length; k++) {
    const r = ROOFS[GABLES[k]];
    c.moveTo(X(r[0]), Y(r[1])); c.lineTo(X(r[2]), Y(r[3])); c.lineTo(X(r[4]), Y(r[5])); c.lineTo(X(r[6]), Y(r[7]));
  }
  c.stroke();
  // shingle courses on hips, dentil trim on gables
  c.strokeStyle = css(p.rim, 0.06 + F.flash * 0.08);
  c.lineWidth = Math.max(0.5, 0.7 * S);
  c.beginPath();
  for (let k = 0; k < HIPS.length; k++) {
    const r = ROOFS[HIPS[k]];
    for (let f = 0.18; f < 0.95; f += 0.2) {
      c.moveTo(X(lerp(r[0], r[2], f)), Y(lerp(r[1], r[3], f))); c.lineTo(X(lerp(r[6], r[4], f)), Y(lerp(r[7], r[5], f)));
    }
  }
  for (let k = 0; k < GABLES.length; k++) {
    const r = ROOFS[GABLES[k]];
    for (let f = 0.06; f < 1; f += 0.07) {
      let x = lerp(r[0], r[2], f), y = lerp(r[1], r[3], f);
      c.moveTo(X(x), Y(y) + 0.9 * u); c.lineTo(X(x), Y(y) + 1.9 * u);
      x = lerp(r[6], r[4], f); y = lerp(r[7], r[5], f);
      c.moveTo(X(x), Y(y) + 0.9 * u); c.lineTo(X(x), Y(y) + 1.9 * u);
    }
  }
  c.stroke();

  // tower
  const tl = c.createLinearGradient(X(22), 0, X(40), 0);
  const litL = F.lightX < X(31);
  mixInto(d.tmp, d.wallTop, d.wallLo, 0.5);
  mixInto(d.tmp2, d.wallLo, p.g5, 0.5);
  if (litL) { tl.addColorStop(0, css(d.lit)); tl.addColorStop(0.22, css(d.tmp)); tl.addColorStop(1, css(d.tmp2)); } else { tl.addColorStop(0, css(d.tmp2)); tl.addColorStop(0.78, css(d.tmp)); tl.addColorStop(1, css(d.lit)); }
  c.fillStyle = tl;
  c.fillRect(X(22), Y(46), 18 * u, 46 * u);
  c.fillStyle = css(d.frame, 0.98);
  c.fillRect(X(20.6), Y(47.4), 20.8 * u, 1.5 * u);
  c.strokeStyle = css(d.frame, 0.98); c.lineWidth = Math.max(0.7, 0.2 * u);
  c.beginPath();
  for (let x = 21; x <= 41; x += 1.25) { c.moveTo(X(x), Y(47.4)); c.lineTo(X(x), Y(49.4)); }
  c.moveTo(X(20.6), Y(49.4)); c.lineTo(X(41.4), Y(49.4));
  c.stroke();
  c.fillStyle = css(d.roof);
  c.beginPath();
  c.moveTo(X(31 - 11.2), Y(46.8));
  c.quadraticCurveTo(X(31 - 3.2), Y(56), X(31), Y(70));
  c.quadraticCurveTo(X(31 + 3.2), Y(56), X(31 + 11.2), Y(46.8));
  c.quadraticCurveTo(X(31), Y(45.4), X(31 - 11.2), Y(46.8));
  c.closePath();
  c.fill();
  c.strokeStyle = css(p.rim, 0.07 + F.flash * 0.08);
  c.lineWidth = Math.max(0.5, 0.7 * S);
  c.beginPath();
  for (let f = 0.15; f < 0.95; f += 0.16) {
    const yy = lerp(46.8, 70, f), hw = 11.2 * (1 - f) * 0.9;
    c.moveTo(X(31 - hw), Y(yy)); c.lineTo(X(31 + hw), Y(yy));
  }
  c.stroke();

  // dormer hoods
  c.fillStyle = css(d.roof);
  c.strokeStyle = css(p.rim, rimA * 0.7);
  c.lineWidth = Math.max(0.6, S);
  for (let i = 0; i < NW; i++) {
    if (!(WIN[i][5] & 8)) continue;
    const x = st.wx[i], ytop = st.wy[i] - st.wh[i] * 0.5, hwid = st.ww[i] * 0.95;
    c.beginPath(); c.moveTo(x - hwid, ytop + st.ww[i] * 0.18); c.lineTo(x, ytop - st.ww[i] * 0.85); c.lineTo(x + hwid, ytop + st.ww[i] * 0.18); c.closePath(); c.fill();
    c.beginPath();
    if (F.lightX < x) { c.moveTo(x - hwid, ytop + st.ww[i] * 0.18); c.lineTo(x, ytop - st.ww[i] * 0.85); } else { c.moveTo(x, ytop - st.ww[i] * 0.85); c.lineTo(x + hwid, ytop + st.ww[i] * 0.18); }
    c.stroke();
  }

  drawWindows(c, F, st);
  drawPorch(c, F, st, X, Y);
  drawBalconyDoor(c, F, X, Y);

  // widow's walk
  c.strokeStyle = css(d.frame, 0.98); c.lineWidth = Math.max(0.8, 0.26 * u);
  c.beginPath();
  c.moveTo(X(-6.6), Y(57.2)); c.lineTo(X(4.6), Y(57.2));
  for (let x = -6.6; x <= 4.7; x += 1.0) { c.moveTo(X(x), Y(54.2)); c.lineTo(X(x), Y(57.2)); }
  c.moveTo(X(-6.6), Y(57.2)); c.lineTo(X(-6.6), Y(58.6)); c.moveTo(X(4.6), Y(57.2)); c.lineTo(X(4.6), Y(58.6));
  c.stroke();
  c.strokeStyle = css(p.rim, rimA * 0.8); c.lineWidth = Math.max(0.5, 0.7 * S);
  c.beginPath(); c.moveTo(X(-6.6), Y(57.2) - 0.7); c.lineTo(X(4.6), Y(57.2) - 0.7); c.stroke();

  // rim light: soft glow pass + crisp pass, tower, chimney caps
  for (let pass = 0; pass < 2; pass++) {
    const aN = pass === 0 ? rimA * 0.20 : rimA * 0.95, aF = pass === 0 ? rimA * 0.08 : rimA * 0.42;
    const lw = pass === 0 ? Math.max(3, 0.55 * u) : Math.max(0.7, 1.15 * S);
    for (let k = 0; k < ROOFS.length; k++) rimRoof(c, F, X, Y, ROOFS[k], aN, aF, lw, p.rim);
    c.strokeStyle = css(p.rim, pass === 0 ? rimA * 0.16 : rimA * 0.95);
    c.lineWidth = lw;
    c.beginPath();
    if (litL) { c.moveTo(X(31 - 11.2), Y(46.8)); c.quadraticCurveTo(X(31 - 3.2), Y(56), X(31), Y(70)); } else { c.moveTo(X(31), Y(70)); c.quadraticCurveTo(X(31 + 3.2), Y(56), X(31 + 11.2), Y(46.8)); }
    c.stroke();
  }
  drawVane(c, F, X, Y);
  drawSmoke(c, F, X, Y);
  c.restore();
}

/* ===================================================================== */
/* fog                                                                    */
/* ===================================================================== */
function drawFog(c, F, st, layer) {
  const t = F.t, w = F.w, h = F.h, ph = F.ph;
  const dens = FOG_DENSITY * (0.55 * ph.normal + 0.85 * ph.strange + 1.05 * ph.supernatural + 0.8 * ph.storm + 1.45 * ph.aftermath);
  const L = st.fog[layer], span = w * 1.6;
  for (let i = 0; i < L.length; i++) {
    const b = L[i];
    const x = ((((b.x * span + st.fogPh * b.sp * w * 0.012) % span) + span) % span) - w * 0.3;
    blob(c, F.gr.fog, x, b.y * h, b.rx * w, b.ry * h, b.a * dens * (0.75 + 0.25 * Math.sin(t * 0.13 + b.ph)));
  }
  if (layer === 1) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    blob(c, F.gr.cold, F.moon.x, F.g.y0 + h * 0.03, w * 0.30, h * 0.05, 0.06 * dens * (1 - ph.cover * 0.7));
    c.restore();
  }
  if (layer === 3) {
    const g = c.createLinearGradient(0, h * 0.74, 0, h);
    g.addColorStop(0, css(F.p.fog, 0)); g.addColorStop(0.6, css(F.p.fog, 0.04 * dens)); g.addColorStop(1, css(F.p.fog, 0.12 * dens));
    c.fillStyle = g;
    c.fillRect(0, h * 0.74, w, h * 0.26);
  }
}

/* ===================================================================== */
/* graveyard                                                              */
/* ===================================================================== */
const TOPF = [0.86, 1.0, 1.0, 1.0, 1.0, 0.76];
function stonePath(c, type, s) {
  const hw = s * 0.24;
  switch (type) {
    case 0: c.moveTo(-hw, 0); c.lineTo(-hw, -s * 0.62); c.arc(0, -s * 0.62, hw, PI, 0); c.lineTo(hw, 0); c.closePath(); break;
    case 1: c.moveTo(-hw, 0); c.lineTo(-hw, -s * 0.62); c.quadraticCurveTo(-hw, -s * 0.86, 0, -s); c.quadraticCurveTo(hw, -s * 0.86, hw, -s * 0.62); c.lineTo(hw, 0); c.closePath(); break;
    case 2: c.rect(-s * 0.05, -s, s * 0.10, s); c.rect(-s * 0.22, -s * 0.74, s * 0.44, s * 0.10); c.rect(-s * 0.12, -s * 0.06, s * 0.24, s * 0.06); break;
    case 3: c.moveTo(s * 0.2, -s * 0.7); c.arc(0, -s * 0.7, s * 0.2, 0, TAU); c.rect(-s * 0.05, -s * 0.95, s * 0.10, s * 0.95); c.rect(-s * 0.24, -s * 0.76, s * 0.48, s * 0.10); break;
    case 4: c.moveTo(-s * 0.14, 0); c.lineTo(-s * 0.10, -s * 0.82); c.lineTo(0, -s); c.lineTo(s * 0.10, -s * 0.82); c.lineTo(s * 0.14, 0); c.closePath(); c.rect(-s * 0.2, -s * 0.08, s * 0.4, s * 0.08); break;
    case 5: c.moveTo(-hw, 0); c.lineTo(-hw, -s * 0.7); c.lineTo(-hw * 0.3, -s * 0.58); c.lineTo(hw * 0.2, -s * 0.76); c.lineTo(hw, -s * 0.5); c.lineTo(hw, 0); c.closePath(); break;
    case 10:
      c.rect(-s * 0.20, -s * 0.20, s * 0.40, s * 0.20);
      c.moveTo(-s * 0.14, -s * 0.20); c.quadraticCurveTo(-s * 0.12, -s * 0.45, -s * 0.09, -s * 0.62); c.lineTo(s * 0.09, -s * 0.62); c.quadraticCurveTo(s * 0.12, -s * 0.45, s * 0.14, -s * 0.20); c.closePath();
      c.moveTo(s * 0.08, -s * 0.70); c.arc(s * 0.01, -s * 0.70, s * 0.07, 0, TAU);
      c.moveTo(-s * 0.06, -s * 0.58); c.quadraticCurveTo(-s * 0.42, -s * 0.92, -s * 0.40, -s * 0.46); c.quadraticCurveTo(-s * 0.30, -s * 0.52, -s * 0.26, -s * 0.36); c.quadraticCurveTo(-s * 0.18, -s * 0.42, -s * 0.10, -s * 0.28); c.closePath();
      c.moveTo(s * 0.06, -s * 0.58); c.quadraticCurveTo(s * 0.42, -s * 0.92, s * 0.40, -s * 0.46); c.quadraticCurveTo(s * 0.30, -s * 0.52, s * 0.26, -s * 0.36); c.quadraticCurveTo(s * 0.18, -s * 0.42, s * 0.10, -s * 0.28); c.closePath();
      break;
    default: // 12 mausoleum
      c.rect(-s * 0.75, -s, s * 1.5, s);
      c.moveTo(-s * 0.87, -s); c.lineTo(0, -s * 1.42); c.lineTo(s * 0.87, -s); c.closePath();
      c.rect(-s * 0.95, -s * 0.06, s * 1.9, s * 0.06);
  }
}
function drawStone(c, F, type, x, y, s, tilt, colStr) {
  const S = F.S, lit = F.lightX > x ? 1 : -1;
  c.save();
  c.translate(x, y); c.rotate(tilt);
  c.fillStyle = 'rgba(0,0,0,0.32)';
  c.beginPath(); c.ellipse(0, 0, Math.max(2, s * 0.30), Math.max(1, s * 0.05), 0, 0, TAU); c.fill();
  c.save();
  c.translate(lit * 1.3 * S, -1.1 * S);
  c.beginPath(); stonePath(c, type, s); c.fillStyle = css(F.p.rim, F.rimA * 0.85); c.fill();
  c.restore();
  c.beginPath(); stonePath(c, type, s); c.fillStyle = colStr; c.fill();
  c.restore();
}
function drawOpenGrave(c, F, x, y, s) {
  const p = F.p, S = F.S;
  c.save();
  c.fillStyle = css(p.rim, F.rimA * 0.5);
  c.beginPath(); c.ellipse(x, y - 1.2 * S, s * 1.9, Math.max(1, s * 0.50), 0, 0, TAU); c.fill();
  c.fillStyle = css(p.g4, 0.99);
  c.beginPath(); c.ellipse(x, y, s * 1.9, Math.max(1, s * 0.50), 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.96)';
  c.beginPath(); c.ellipse(x - s * 0.1, y - s * 0.08, s * 1.15, Math.max(1, s * 0.27), 0, 0, TAU); c.fill();
  c.strokeStyle = css(p.g5, 0.98); c.lineWidth = Math.max(1, 1.6 * S);
  c.beginPath(); c.moveTo(x + s * 1.35, y + s * 0.1); c.lineTo(x + s * 1.0, y - s * 1.7); c.stroke();
  c.fillStyle = css(p.g5, 0.98);
  c.beginPath(); c.moveTo(x + s * 0.88, y - s * 1.7); c.lineTo(x + s * 1.14, y - s * 1.7); c.lineTo(x + s * 1.2, y - s * 1.2); c.lineTo(x + s * 0.8, y - s * 1.2); c.closePath(); c.fill();
  c.restore();
  const e = F.ph.eerie;
  if (e > 0.05) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    blob(c, F.gr.green, x - s * 0.1, y - s * 0.6, s * 1.3, s * 1.1, 0.10 * e);
    c.restore();
  }
}
function drawGraveyard(c, F, st) {
  const w = F.w, h = F.h, S = F.S, p = F.p, d = F.d, wet = F.ph.wet;
  const step = Math.max(6, w / 140);
  const gg = c.createLinearGradient(0, h * 0.76, 0, h);
  mixInto(d.tmp, p.g4, p.haze, 0.05);
  gg.addColorStop(0, css(d.tmp)); gg.addColorStop(1, css(p.g5));
  c.fillStyle = gg;
  c.beginPath();
  c.moveTo(0, h);
  for (let x = 0; x <= w + step; x += step) c.lineTo(x, graveY(x, w, h) - h * 0.012);
  c.lineTo(w + step, h); c.closePath(); c.fill();
  c.strokeStyle = css(p.rim, 0.07 + wet * 0.06 + F.flash * 0.12);
  c.lineWidth = Math.max(0.6, S);
  c.beginPath();
  for (let x = 0; x <= w + step; x += step) { const y = graveY(x, w, h) - h * 0.012; if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
  c.stroke();
  for (let i = 0; i < st.graves.length; i++) {
    const gv = st.graves[i];
    const x = gv.nx * w, y = graveY(x, w, h) + gv.d * h * 0.055;
    gv.vis = false;
    if (Math.abs(x - pathCx(F, y)) < pathHalf(F, y) * 1.25) continue;
    const s = h * gv.size * (0.82 + 0.4 * gv.d);
    mixInto(d.stone, p.g5, p.haze, (1 - gv.d) * 0.22);
    const col = css(d.stone, 0.98);
    if (gv.type === 11) drawOpenGrave(c, F, x, y, s);
    else drawStone(c, F, gv.type, x, y, s, gv.tilt, col);
    if (gv.type === 12) {
      c.fillStyle = css(F.d.frame, 0.99);
      c.fillRect(x - s * 0.22, y - s * 0.66, s * 0.44, s * 0.66);
      const e = F.ph.eerie;
      if (e > 0.05) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        blob(c, F.gr.green, x, y - s * 0.35, s * 0.55, s * 0.55, 0.16 * e);
        c.restore();
      }
    }
    if (gv.type < 6) {
      gv.vis = true;
      gv.tx = x + Math.sin(gv.tilt) * s * TOPF[gv.type];
      gv.ty = y - Math.cos(gv.tilt) * s * TOPF[gv.type];
    }
  }
}
function fencePath(c, F, rimMode) {
  const w = F.w, h = F.h, S = F.S, pitch = w / 22, gx = F.gate.x, gh = F.gate.half + w * 0.012;
  const Hp = h * FENCE_H, Hz = h * PILLAR_H, pw = w * 0.0085, oy = rimMode ? -1.3 * S : 0;
  const lx = F.lightX;
  for (let rail = 0; rail < 2; rail++) {
    const fr = rail === 0 ? 0.24 : 0.70;
    let pen = false;
    for (let x = 0; x <= w + 1; x += pitch / 3) {
      if (Math.abs(x - gx) < gh) { pen = false; continue; }
      const y = fenceY(x, w, h) - Hp * fr + oy;
      if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y);
    }
  }
  for (let k = 0; k <= 22; k++) {
    const x0 = k * pitch;
    const ox = rimMode ? (lx > x0 ? 0.9 : -0.9) * S : 0;
    if (Math.abs(x0 - gx) < gh) continue;
    const y = fenceY(x0, w, h) + oy;
    if (k % 5 === 0) {
      c.rect(x0 - pw * 0.5 + ox, y - Hz, pw, Hz);
      c.rect(x0 - pw * 0.8 + ox, y - Hz - h * 0.006, pw * 1.6, h * 0.006);
    } else {
      c.rect(x0 - pw * 0.22 + ox, y - Hp, pw * 0.44, Hp);
      c.moveTo(x0 - pw * 0.38 + ox, y - Hp); c.lineTo(x0 + ox, y - Hp - h * 0.020); c.lineTo(x0 + pw * 0.38 + ox, y - Hp); c.closePath();
    }
    for (let j = 1; j <= 4; j++) {
      const xx = x0 + (j * pitch) / 5;
      if (Math.abs(xx - gx) < gh || xx > w + 2) continue;
      const yy = fenceY(xx, w, h) + oy, ox2 = rimMode ? (lx > xx ? 0.8 : -0.8) * S : 0;
      c.rect(xx - pw * 0.12 + ox2, yy - Hp * 0.96, pw * 0.24, Hp * 0.96);
      c.moveTo(xx - pw * 0.2 + ox2, yy - Hp * 0.96); c.lineTo(xx + ox2, yy - Hp * 0.96 - h * 0.012); c.lineTo(xx + pw * 0.2 + ox2, yy - Hp * 0.96); c.closePath();
    }
  }
}
function drawFence(c, F) {
  const w = F.w, h = F.h, S = F.S, p = F.p, t = F.t, wind = clamp(F.wind, 0, 1.6);
  const step = Math.max(6, w / 140);
  // darker ground in front of the fence
  const fg = c.createLinearGradient(0, h * 0.84, 0, h);
  fg.addColorStop(0, css(p.g5, 0.98)); fg.addColorStop(1, 'rgba(1,3,5,0.99)');
  c.fillStyle = fg;
  c.beginPath();
  c.moveTo(0, h);
  for (let x = 0; x <= w + step; x += step) c.lineTo(x, fenceY(x, w, h) - h * 0.004);
  c.lineTo(w + step, h); c.closePath(); c.fill();
  c.strokeStyle = css(p.rim, 0.06 + F.flash * 0.1);
  c.lineWidth = Math.max(0.6, S);
  c.beginPath();
  for (let x = 0; x <= w + step; x += step) { const y = fenceY(x, w, h) - h * 0.004; if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
  c.stroke();
  // iron fence: rim pass first (offset toward light), then the dark iron
  const dark = css(p.g5, 1);
  c.lineWidth = Math.max(1.2, 1.5 * S);
  c.strokeStyle = css(p.rim, F.rimA * 0.8); c.fillStyle = css(p.rim, F.rimA * 0.8);
  c.beginPath(); fencePath(c, F, true); c.fill(); c.stroke();
  c.strokeStyle = dark; c.fillStyle = dark;
  c.beginPath(); fencePath(c, F, false); c.fill(); c.stroke();
  const pitch = w / 22, gh = F.gate.half + w * 0.012;
  c.lineWidth = Math.max(0.9, 1.1 * S);
  c.beginPath();
  for (let k = 0; k < 22; k++) {
    const xm = (k + 0.5) * pitch;
    if (Math.abs(xm - F.gate.x) < gh) continue;
    const r = Math.max(2, pitch * 0.12);
    const ym = fenceY(xm, w, h) - h * FENCE_H * 0.47;
    c.moveTo(xm + r, ym); c.arc(xm, ym, r, 0, TAU);
  }
  c.stroke();

  // crooked gate
  const gx = F.gate.x, gate = F.gate.half, gy = fenceY(gx, w, h);
  const Hg = h * 0.10, Hpil = h * 0.118, pwid = w * 0.012;
  const lxp = gx - gate, rxp = gx + gate;
  for (let side = 0; side < 2; side++) {
    const px = side === 0 ? lxp : rxp, py = fenceY(px, w, h), lit = F.lightX > px ? 1 : -1;
    c.fillStyle = css(p.rim, F.rimA * 0.85);
    c.fillRect(px - pwid * 0.5 + lit * 1.3 * S, py - Hpil - 1.1 * S, pwid, Hpil);
    c.fillStyle = dark;
    c.fillRect(px - pwid * 0.5, py - Hpil, pwid, Hpil);
    c.fillRect(px - pwid * 0.8, py - Hpil - h * 0.007, pwid * 1.6, h * 0.007);
    c.beginPath(); c.moveTo(px + pwid * 0.5, py - Hpil - h * 0.007); c.arc(px, py - Hpil - h * 0.007 - pwid * 0.5, pwid * 0.5, 0, TAU); c.fill();
  }
  const leafW = gate - pwid;
  c.strokeStyle = dark; c.lineWidth = Math.max(1.1, 1.4 * S);
  c.beginPath();
  // left leaf: closed but sagging
  const sag = h * 0.014;
  for (let j = 0; j <= 6; j++) {
    const f = j / 6, x = lxp + pwid * 0.5 + f * leafW, top = gy - Hg + sag * f;
    c.moveTo(x, gy); c.lineTo(x, top);
    c.moveTo(x - 2 * S, top); c.lineTo(x, top - h * 0.010); c.lineTo(x + 2 * S, top);
  }
  c.moveTo(lxp + pwid * 0.5, gy - Hg * 0.25); c.lineTo(lxp + pwid * 0.5 + leafW, gy - Hg * 0.25 + sag * 0.3);
  c.moveTo(lxp + pwid * 0.5, gy - Hg + 0); c.lineTo(lxp + pwid * 0.5 + leafW, gy - Hg + sag);
  // right leaf: swung open, creaking
  const th = 0.62 + Math.sin(t * 0.5 + 1) * 0.05 * (0.3 + wind), cs = Math.cos(th), sn = Math.sin(th);
  const hxr = rxp - pwid * 0.5, fx = hxr - leafW * cs, grow = 1 + 0.12 * sn, dy = h * 0.02 * sn;
  for (let j = 0; j <= 6; j++) {
    const f = j / 6, x = lerp(hxr, fx, f), hh2 = Hg * lerp(1, grow, f), base = gy + dy * f;
    c.moveTo(x, base); c.lineTo(x, base - hh2);
    c.moveTo(x - 2 * S, base - hh2); c.lineTo(x, base - hh2 - h * 0.010); c.lineTo(x + 2 * S, base - hh2);
  }
  c.moveTo(hxr, gy - Hg); c.lineTo(fx, gy + dy - Hg * grow);
  c.moveTo(hxr, gy - Hg * 0.25); c.lineTo(fx, gy + dy - Hg * grow * 0.25);
  c.stroke();
  // iron arch with a hanging lantern
  c.lineWidth = Math.max(1.4, 2.2 * S);
  const ay = gy - Hpil - h * 0.012;
  c.strokeStyle = css(p.rim, F.rimA * 0.6);
  c.beginPath(); c.moveTo(lxp, ay - 1.2 * S); c.bezierCurveTo(lxp + gate * 0.4, ay - h * 0.075 - 1.2 * S, rxp - gate * 0.4, ay - h * 0.075 - 1.2 * S, rxp, ay - 1.2 * S); c.stroke();
  c.strokeStyle = dark;
  c.beginPath(); c.moveTo(lxp, ay); c.bezierCurveTo(lxp + gate * 0.4, ay - h * 0.075, rxp - gate * 0.4, ay - h * 0.075, rxp, ay); c.stroke();
  drawLantern(c, F, gx, ay - h * 0.056, h * 0.026);
}

/* ===================================================================== */
/* crows and bats                                                         */
/* ===================================================================== */
function crowPath(c) {
  c.beginPath();
  c.ellipse(0, -6.2, 6.2, 3.6, -0.42, 0, TAU);
  c.moveTo(7.65, -9.6); c.arc(5.2, -9.6, 2.45, 0, TAU);
  c.moveTo(7.2, -10.4); c.lineTo(11.6, -8.9); c.lineTo(7.2, -8.0); c.closePath();
  c.moveTo(-4.4, -4.2); c.lineTo(-12, -0.6); c.lineTo(-10.6, 1.0); c.lineTo(-3.2, -2.2); c.closePath();
}
function drawCrowPerched(c, F, x, y, s, sx, lean) {
  c.save();
  c.translate(x, y);
  c.scale(sx * s, s);
  c.rotate(lean);
  c.save(); c.translate(0, -1.0);
  crowPath(c); c.fillStyle = css(F.p.rim, F.rimA * 0.7); c.fill();
  c.restore();
  crowPath(c); c.fillStyle = css(F.p.g5, 1); c.fill();
  c.strokeStyle = css(F.p.g5, 1); c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(-0.6, -2.6); c.lineTo(-0.6, 0); c.moveTo(1.5, -2.6); c.lineTo(1.5, 0); c.stroke();
  c.restore();
}
function drawFlyer(c, F, x, y, s, dir, phase, amp, kind, alpha) {
  const L = Math.sin(phase) * amp;
  c.save();
  c.translate(x, y);
  c.scale(dir * s, s);
  c.fillStyle = css(F.p.g5, alpha);
  c.beginPath();
  if (kind === 0) {
    c.ellipse(0, 0, 5.2, 2.5, -0.1, 0, TAU);
    c.moveTo(8.4, -0.6); c.arc(6.4, -0.6, 2.0, 0, TAU);
    c.moveTo(8.2, -1.2); c.lineTo(12.2, -0.2); c.lineTo(8.2, 0.6); c.closePath();
    c.moveTo(-4.5, -0.4); c.lineTo(-11, -1.6); c.lineTo(-11.4, 1.4); c.lineTo(-4.5, 1.2); c.closePath();
    c.moveTo(2.2, -1.2);
    c.quadraticCurveTo(-1, -6 - L * 8, -12, -3 - L * 13);
    c.lineTo(-9, -1 - L * 8); c.lineTo(-11.5, 0 - L * 6); c.lineTo(-7, 0.6 - L * 3.5); c.lineTo(-8.5, 2.2 - L * 2);
    c.quadraticCurveTo(-2, 1.4, 1.2, 1.2); c.closePath();
  } else {
    c.ellipse(0, 0.2, 2.0, 3.2, 0, 0, TAU);
    c.moveTo(-1.8, -2.4); c.lineTo(-2.4, -5.2); c.lineTo(-0.4, -3.0); c.closePath();
    c.moveTo(1.8, -2.4); c.lineTo(2.4, -5.2); c.lineTo(0.4, -3.0); c.closePath();
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      c.moveTo(sgn * 1.2, -1.2);
      c.quadraticCurveTo(sgn * 7, -7 - L * 6, sgn * 16, -3.5 - L * 8);
      c.quadraticCurveTo(sgn * 13.5, -0.5 - L * 4.5, sgn * 12.2, 1.4 - L * 2.5);
      c.quadraticCurveTo(sgn * 9.4, 0.4 - L * 1.8, sgn * 8.3, 3.0 - L * 1.0);
      c.quadraticCurveTo(sgn * 5.2, 1.2, sgn * 4.2, 3.6);
      c.quadraticCurveTo(sgn * 2.4, 2.6, sgn * 1.2, 3.4);
      c.closePath();
    }
  }
  c.fill();
  c.restore();
}
const PP = { x: 0, y: 0 };
function perchPos(F, st, cr) {
  const w = F.w, h = F.h;
  if (cr.kind === 0) {
    const x = cr.ref * (w / 22);
    if (Math.abs(x - F.gate.x) < F.gate.half + w * 0.012) return false;
    PP.x = x; PP.y = fenceY(x, w, h) - h * (PILLAR_H + 0.006); return true;
  }
  if (cr.kind === 1) {
    const gv = st.graves[cr.ref];
    if (!gv || !gv.vis) return false;
    PP.x = gv.tx; PP.y = gv.ty; return true;
  }
  if (cr.kind === 2) { const tr = st.trees[cr.ref]; PP.x = tr.px[cr.sub]; PP.y = tr.py[cr.sub]; return true; }
  const sgn = cr.ref === 0 ? -1 : 1;
  PP.x = F.gate.x + sgn * F.gate.half; PP.y = fenceY(F.gate.x, w, h) - h * (0.118 + 0.016); return true;
}
function drawCrows(c, F, st) {
  const w = F.w, h = F.h, S = F.S, ph = F.ph, x = ph.x, cyc = ph.cyc, n = st.crows.length;
  const shift = Math.floor(hash(cyc * 2.7 + 1) * n);
  for (let i = 0; i < n; i++) {
    const cr = st.crows[i];
    if (!perchPos(F, st, cr)) continue;
    const ox = PP.x + cr.dx * S, oy = PP.y, sz = cr.size * S * 1.15;
    cr.fdir = ox < F.g.cx ? -1 : 1;
    const toff = T_SUPER + 7 + ((i + shift) % n) * 0.28 + hash2(cyc, i + 20) * 0.5;
    const tland = T_AFTER + 0.6 + hash2(cyc, i + 40) * 3.2;
    const away = x - toff, back = x - tland;
    if (away >= 0 && away < 8) {
      const s = away / 8, ux = cr.fdir, am = smooth(away / 0.5);
      const fx = ox + ux * w * 0.66 * Math.pow(s, 1.3) + (Math.sin(away * 1.7 + cr.ph) - Math.sin(cr.ph)) * 20 * S * (0.3 + s) + (Math.cos(away * 1.1 + cr.ph) - Math.cos(cr.ph)) * cr.wheel * 36 * S * (1 - s * 0.6);
      const fy = oy - 6 * sz - h * 0.42 * smooth(s * 1.1) * (0.6 + cr.lift * 0.4) - (1 - Math.cos(away * 2.3)) * 5 * S * am + (Math.sin(away * 1.1 + cr.ph) - Math.sin(cr.ph)) * cr.wheel * 20 * S * (1 - s * 0.6);
      drawFlyer(c, F, fx, fy, sz * 0.9, ux, F.t * 13 + cr.ph, 0.55 + 0.45 * am, 0, 1);
    } else if (back >= 0 && back < 3) {
      const s = back / 3, e = 1 - sq(1 - s), sx0 = ox - cr.fdir * w * 0.45, sy0 = oy - h * 0.30;
      const fx = lerp(sx0, ox, e), fy = lerp(sy0, oy - 6 * sz, e * e) - Math.sin(s * PI) * h * 0.03;
      drawFlyer(c, F, fx, fy, sz * 0.9, cr.fdir, F.t * 12 + cr.ph, 1 - smooth((s - 0.7) / 0.3) * 0.75, 0, 1);
    } else if (x >= toff + 8 && x < tland) {
      continue;
    } else {
      const tdir = ox < F.g.cx ? 1 : -1;
      const flip = cr.dir !== tdir;
      const tf = smooth((x - (T_STRANGE + 2 + cr.fj * 8)) / 1.8) - smooth((x - (T_AFTER + 1 + cr.fj2 * 4)) / 1.8);
      const sxv = flip ? cr.dir * Math.cos(PI * tf) : cr.dir;
      const lean = (ph.strange * 0.18 + ph.supernatural * 0.08) * (flip ? tf : 1);
      drawCrowPerched(c, F, ox, oy, sz, sxv, lean);
    }
  }
}
function batChance(F, tm) {
  const o = F.tmpPh;
  fillPhase(o, ((tm % PERIOD) + PERIOD) % PERIOD);
  return clamp(0.5 * o.normal + 0.7 * o.strange + 0.85 * o.supernatural + 0.55 * o.aftermath);
}
function drawBats(c, F) {
  const t = F.t, w = F.w, h = F.h, S = F.S, moon = F.moon;
  const SLOT = 13, slot = Math.floor(t / SLOT);
  if (hash(slot * 3.7 + 0.2) < batChance(F, slot * SLOT + 6)) {
    const start = hash(slot * 5.3 + 1.1) * 4.5, q0 = (t - slot * SLOT - start) / 7.5;
    const n = 3 + Math.floor(hash(slot * 7.9 + 2) * 3);
    const yb = moon.y + (hash(slot * 2.3 + 3) - 0.5) * moon.r * 0.9;
    for (let i = 0; i < n; i++) {
      const q = q0 - i * 0.03 - hash(slot * 11 + i) * 0.04;
      if (q < -0.02 || q > 1.02) continue;
      const x = -w * 0.06 + q * w * 1.12;
      const y = yb + Math.sin(q * TAU * 1.3 + i * 1.7 + slot) * moon.r * 0.20 + (hash(slot * 13 + i * 3) - 0.5) * moon.r * 0.55 - Math.sin(q * PI) * moon.r * 0.1;
      drawFlyer(c, F, x, y, S * (1.0 + hash(i + slot) * 0.5), 1, t * (10 + hash(i * 3 + slot) * 3) + i * 2.1, 1, 1, 1);
    }
  }
  const S2 = 9.5, s2 = Math.floor(t / S2);
  if (hash(s2 * 4.1 + 0.7) < batChance(F, s2 * S2 + 4) * 0.7) {
    const q = (t - s2 * S2 - hash(s2 * 6.1) * 1.2) / 8;
    if (q > -0.02 && q < 1.02) {
      const dir = hash(s2 * 2.2) > 0.5 ? 1 : -1;
      const x = dir > 0 ? -w * 0.05 + q * w * 1.1 : w * 1.05 - q * w * 1.1;
      const y = h * (0.12 + hash(s2 * 8.8) * 0.34) + Math.sin(q * TAU * 2 + s2) * h * 0.03;
      drawFlyer(c, F, x, y, S * 0.7, 1, t * 11 + s2, 1, 1, 0.9);
    }
  }
}

/* ===================================================================== */
/* webs and spiders                                                       */
/* ===================================================================== */
function drawWeb(c, F, ax, ay, R, a0, a1, id, spokes) {
  const t = F.t, S = F.S, p = F.p, wind = clamp(F.wind, 0, 1.6);
  const sw = Math.sin(t * 0.8 + id * 2.3) * 0.012 * (0.5 + wind) + Math.sin(t * 2.1 + id) * 0.006 * wind;
  const span = a1 - a0;
  c.save();
  c.translate(ax, ay); c.rotate(sw);
  c.strokeStyle = css(p.rim, 0.20 + F.flash * 0.3);
  c.lineWidth = Math.max(0.4, 0.55 * S);
  c.beginPath();
  for (let s = 0; s <= spokes; s++) {
    const a = a0 + (span * s) / spokes, len = R * (0.92 + 0.08 * hash(id * 7 + s));
    c.moveTo(0, 0); c.lineTo(Math.cos(a) * len, Math.sin(a) * len);
  }
  const rings = 8;
  for (let k = 1; k <= rings; k++) {
    const rr = R * (k / rings);
    let lx = Math.cos(a0) * rr, ly = Math.sin(a0) * rr;
    c.moveTo(lx, ly);
    for (let s = 1; s <= spokes; s++) {
      const a = a0 + (span * s) / spokes, am = a0 + (span * (s - 0.5)) / spokes;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      c.quadraticCurveTo(Math.cos(am) * rr * 0.94, Math.sin(am) * rr * 0.94 + R * 0.012, px, py);
      lx = px; ly = py;
    }
  }
  c.stroke();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const a = a0 + span * hash(id * 3 + i * 1.7), rr = R * (0.25 + hash(id + i * 2.3) * 0.7);
    const tw = Math.max(0, Math.sin(t * (0.6 + hash(id + i) * 0.9) + i * 2.7));
    const al = 0.08 + 0.7 * Math.pow(tw, 8);
    c.fillStyle = css(p.rim, al);
    c.beginPath(); c.arc(Math.cos(a) * rr, Math.sin(a) * rr, Math.max(0.5, 0.9 * S), 0, TAU); c.fill();
  }
  c.restore();
}
function drawSpider(c, F, x, y, len, id) {
  const t = F.t, S = F.S, p = F.p, per = 17, tt = t + id * 5.3, sl = Math.floor(tt / per);
  if (hash2(sl, id) < 0.42) return;
  const drop = Math.sin(clamp((tt - sl * per) / per / 0.62) * PI);
  if (drop < 0.01) return;
  const a = smooth(drop * 6), yy = y + len * drop;
  c.save();
  c.strokeStyle = css(p.rim, 0.30 * a); c.lineWidth = Math.max(0.4, 0.5 * S);
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, yy); c.stroke();
  c.strokeStyle = css(p.g5, 0.95 * a); c.lineWidth = Math.max(0.5, 0.7 * S);
  const r = Math.max(1.2, 1.5 * S);
  c.beginPath();
  for (let k = 0; k < 4; k++) {
    const sw = Math.sin(t * 6 + k * 1.3 + id) * r * 0.5;
    for (let sg = -1; sg <= 1; sg += 2) { c.moveTo(x, yy); c.lineTo(x + sg * r * 2.2, yy + (k - 1.5) * r * 0.9 + sw); }
  }
  c.stroke();
  c.fillStyle = css(p.g5, 0.98 * a);
  c.beginPath(); c.arc(x, yy, r, 0, TAU); c.fill();
  c.restore();
}
function drawWebs(c, F, st) {
  const g = F.g, u = g.u, w = F.w, h = F.h, S = F.S, p = F.p;
  const X = (ux) => g.cx + ux * u, Y = (uy) => g.y0 - uy * u;
  drawWeb(c, F, X(-46.4), Y(14.1), 7 * u, 0.06, PI / 2 - 0.06, 1, 6);
  drawWeb(c, F, X(46.4), Y(14.1), 7 * u, PI / 2 + 0.06, PI - 0.06, 2, 6);
  drawSpider(c, F, X(-46.4) + 2.2 * u, Y(14.1) + 0.4 * u, 4.5 * u, 1);
  drawSpider(c, F, X(46.4) - 2.2 * u, Y(14.1) + 0.4 * u, 4.5 * u, 2);
  const tr = st.trees[1], postX = 4 * (w / 22), tx = tr.gx + tr.h * h * 0.012;
  const hx = (tx + postX) * 0.5, R = h * 0.05, hy = fenceY(hx, w, h) - h * 0.056;
  drawWeb(c, F, hx, hy, R, 0, TAU, 3, 11);
  c.save();
  c.strokeStyle = css(p.rim, 0.22 + F.flash * 0.3); c.lineWidth = Math.max(0.4, 0.55 * S);
  c.beginPath();
  c.moveTo(hx - R, hy); c.lineTo(tx, hy - h * 0.012);
  c.moveTo(hx + R, hy); c.lineTo(postX, fenceY(postX, w, h) - h * FENCE_H - h * 0.014);
  c.moveTo(hx, hy - R); c.lineTo(hx + R * 0.2, hy - R * 1.9);
  c.stroke();
  c.restore();
  drawSpider(c, F, hx, hy - R * 0.9, R * 1.7, 3);
}

/* ===================================================================== */
/* candles, mist figure, puddles, drips, leaves                           */
/* ===================================================================== */
function drawCandle(c, F, x, y, s, alpha, id) {
  const t = F.t, ph = F.ph, wind = clamp(F.wind, 0, 1.5);
  const fl = 0.78 + 0.22 * Math.sin(t * 7.3 + id * 3.1) * Math.sin(t * 2.3 + id) + (noise1(t * 5 + id * 11) - 0.5) * 0.18;
  const lean = wind * 1.6 * s;
  c.fillStyle = 'rgba(206,192,160,' + 0.88 * alpha + ')';
  c.fillRect(x - 2.3 * s, y, 4.6 * s, 9 * s);
  c.fillStyle = 'rgba(40,30,20,' + 0.35 * alpha + ')';
  c.fillRect(x + 0.8 * s, y, 1.5 * s, 9 * s);
  c.save();
  c.globalCompositeOperation = 'lighter';
  const fh = 10.5 * s * (0.9 + 0.2 * fl);
  c.fillStyle = 'rgba(255,205,125,' + 0.9 * fl * alpha + ')';
  c.beginPath();
  c.moveTo(x + lean * 0.4, y - fh); c.quadraticCurveTo(x + 2.8 * s, y - 4.5 * s, x, y - 0.2 * s);
  c.quadraticCurveTo(x - 2.8 * s, y - 4.5 * s, x + lean * 0.4, y - fh); c.fill();
  c.fillStyle = 'rgba(255,245,215,' + 0.7 * alpha + ')';
  c.beginPath();
  c.moveTo(x + lean * 0.2, y - fh * 0.55); c.quadraticCurveTo(x + 1.2 * s, y - 2.6 * s, x, y - 0.6 * s);
  c.quadraticCurveTo(x - 1.2 * s, y - 2.6 * s, x + lean * 0.2, y - fh * 0.55); c.fill();
  blob(c, F.gr.warm, x, y - 5 * s, 26 * s, 26 * s, 0.24 * fl * alpha * (1 - 0.4 * ph.storm));
  c.restore();
}
function drawCandles(c, F, st) {
  const t = F.t, w = F.w, h = F.h, ph = F.ph;
  const tc = 3 * ph.normal + 7 * ph.strange + 12 * ph.supernatural + 2 * ph.storm + 4.5 * ph.aftermath;
  for (let i = 0; i < st.candles.length; i++) {
    const a = smooth(tc - i);
    if (a < 0.01) continue;
    const cd = st.candles[i];
    const x = cd.x * w + Math.sin(t * 0.21 + cd.ph) * w * 0.016 + Math.sin(t * 0.09 + cd.ph * 2) * w * 0.01;
    const rise = (ph.supernatural * 0.075 + ph.strange * 0.02 + ph.aftermath * 0.01) * h * (0.4 + cd.rise);
    const y = cd.y * h - rise + Math.sin(t * cd.sp + cd.ph) * h * 0.011;
    drawCandle(c, F, x, y, cd.sc * F.S, a, i);
  }
}
function drawMistFigure(c, F) {
  const t = F.t, w = F.w, h = F.h, ph = F.ph;
  if (ph.supernatural < 0.03) return;
  const s0 = T_SUPER + 3 + hash2(ph.cyc, 9) * 4, q = (ph.x - s0) / 13;
  if (q < 0 || q > 1) return;
  const a = smooth(q / 0.18) * (1 - smooth((q - 0.72) / 0.28)) * ph.supernatural * 0.34;
  if (a < 0.003) return;
  const dir = hash2(ph.cyc, 12) > 0.5 ? 1 : -1;
  const x = w * (dir > 0 ? 0.10 + q * 0.80 : 0.90 - q * 0.80);
  const y = graveY(x, w, h) + h * 0.03 - h * 0.012 - Math.sin(q * PI * 3) * h * 0.006, u = h * 0.052, gr = F.gr.green;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 5; k++) blob(c, gr, x - dir * (k + 1) * u * 0.55, y - u * (0.5 - k * 0.05) + Math.sin(t * 1.3 + k) * u * 0.06, u * (0.55 + k * 0.12), u * (0.28 - k * 0.03), a * (0.55 - k * 0.1));
  blob(c, gr, x, y - u * 0.95, u * 0.52, u * 1.05, a * 0.9);
  blob(c, gr, x, y - u * 1.75, u * 0.30, u * 0.55, a * 0.8);
  blob(c, gr, x + dir * u * 0.04, y - u * 2.38, u * 0.20, u * 0.24, a);
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = 'rgba(4,10,12,' + Math.min(1, a * 1.6) + ')';
  const er = Math.max(0.5, u * 0.022);
  c.beginPath();
  c.moveTo(x + dir * u * 0.04 - u * 0.06 + er, y - u * 2.40); c.ellipse(x + dir * u * 0.04 - u * 0.06, y - u * 2.40, er, er * 1.6, 0, 0, TAU);
  c.moveTo(x + dir * u * 0.04 + u * 0.06 + er, y - u * 2.40); c.ellipse(x + dir * u * 0.04 + u * 0.06, y - u * 2.40, er, er * 1.6, 0, 0, TAU);
  c.fill();
  c.restore();
}
function drawPuddles(c, F, st) {
  const wet = smooth(F.ph.wet * 1.6);
  if (wet < 0.02) return;
  const t = F.t, w = F.w, h = F.h, S = F.S, p = F.p, moon = F.moon, rain = F.ph.rain, d = F.d;
  mixInto(d.tmp, p.horizon, p.rim, 0.22);
  c.save();
  for (let i = 0; i < st.puddles.length; i++) {
    const pd = st.puddles[i], x = pd.x * w, y = pd.y * h, rx = Math.max(4, pd.rx * w), ry = Math.max(2, rx * 0.11);
    const gr = c.createLinearGradient(0, y - ry, 0, y + ry);
    gr.addColorStop(0, css(d.tmp, 0.85 * wet)); gr.addColorStop(1, css(p.skyMid, 0.70 * wet));
    c.fillStyle = gr;
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
    c.strokeStyle = css(p.rim, 0.12 * wet); c.lineWidth = Math.max(0.5, 0.7 * S); c.stroke();
    c.save();
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.clip();
    c.globalCompositeOperation = 'lighter';
    const mx = clamp(lerp(x, moon.x, 0.35), x - rx * 0.55, x + rx * 0.55);
    blob(c, F.gr.cold, mx + Math.sin(t * 1.3 + i) * rx * 0.03, y, rx * 0.20, ry * 1.1, 0.34 * wet * (1 - F.ph.cover));
    c.restore();
  }
  if (rain > 0.1) {
    c.strokeStyle = css(p.rim, 1);
    c.lineWidth = Math.max(0.5, 0.7 * S);
    for (let k = 0; k < 3; k++) {
      const q = (t * 0.8 + k / 3) % 1;
      c.globalAlpha = (1 - q) * 0.28 * rain;
      c.beginPath();
      for (let i = 0; i < st.puddles.length; i++) {
        const pd = st.puddles[i], rx = pd.rx * w;
        const x = pd.x * w + (hash(i * 3 + k + 1) - 0.5) * rx * 1.1, y = pd.y * h + (hash(i * 5 + k + 2) - 0.5) * rx * 0.05, r = Math.max(1, q * rx * 0.18);
        c.moveTo(x + r, y); c.ellipse(x, y, r, Math.max(0.4, r * 0.14), 0, 0, TAU);
      }
      c.stroke();
    }
    c.globalAlpha = 1;
  }
  c.restore();
}
function drawDrips(c, F) {
  const wet = F.ph.wet;
  if (wet < 0.05) return;
  const t = F.t, g = F.g, u = g.u, S = F.S;
  c.save();
  c.strokeStyle = css(F.p.rim, 0.30 * wet);
  c.lineWidth = Math.max(0.55, 0.7 * S);
  c.beginPath();
  const beads = [];
  for (let i = 0; i < EAVES.length; i++) {
    for (let k = 0; k < 2; k++) {
      const per = 1.1 + hash(i * 3.1 + k * 7.7) * 1.6;
      const q = ((t + hash(i * 5.3 + k * 2.1) * 9) % per) / per;
      const x = g.cx + (EAVES[i][0] + (hash(i * 2.7 + k * 4.4) - 0.5) * 5) * u, ey = g.y0 - EAVES[i][1] * u;
      if (q > 0.45) {
        const f = (q - 0.45) / 0.55, y = ey + f * f * 5 * u;
        c.moveTo(x, y - Math.min(1.2, f * 3) * u * 0.5); c.lineTo(x, y);
      } else beads.push(x, ey + q * 0.6 * u);
    }
  }
  c.stroke();
  c.fillStyle = css(F.p.rim, 0.35 * wet);
  c.beginPath();
  for (let i = 0; i < beads.length; i += 2) { c.moveTo(beads[i] + Math.max(0.6, S * 0.8), beads[i + 1]); c.arc(beads[i], beads[i + 1], Math.max(0.6, S * 0.8), 0, TAU); }
  c.fill();
  c.restore();
}
function drawLeaves(c, F, st) {
  const t = F.t, w = F.w, h = F.h, S = F.S, p = F.p, span = w * 1.3;
  c.save();
  c.fillStyle = css(p.g5, 0.85);
  c.beginPath();
  for (let i = 0; i < st.leaves.length; i++) {
    const lf = st.leaves[i];
    const x = ((((lf.x * span + st.windPh * lf.sp * w * 0.22) % span) + span) % span) - w * 0.15;
    const y = lf.y * h + Math.sin(t * lf.wob + lf.ph) * h * 0.018;
    const rot = t * lf.spin + lf.ph, rx = Math.max(1, lf.sz * S * 2.2), ry = Math.max(0.6, lf.sz * S);
    c.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
    c.ellipse(x, y, rx, ry, rot, 0, TAU);
  }
  c.fill();
  for (let b = 0; b < 3; b++) {
    c.fillStyle = css(p.rim, (0.18 + 0.12 * Math.sin(t * (0.5 + b * 0.3) + b * 2)) * (1 - F.ph.rain * 0.6));
    c.beginPath();
    for (let i = b; i < st.motes.length; i += 3) {
      const mo = st.motes[i];
      const x = (((mo.x * w + st.windPh * mo.sp * w * 0.04 + t * mo.sp * 4) % w) + w) % w;
      const y = mo.y * h + Math.sin(t * mo.wob + mo.ph) * h * 0.018, r = Math.max(0.35, mo.sz * S);
      c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
    }
    c.fill();
  }
  c.restore();
}

/* ===================================================================== */
/* foreground + vignette                                                  */
/* ===================================================================== */
function drawForeground(c, F, st) {
  const t = F.t, w = F.w, h = F.h, S = F.S, p = F.p, wind = clamp(F.wind, 0, 1.6);
  const dark = css(p.g5, 0.97);
  c.save();
  c.fillStyle = dark;
  c.beginPath();
  c.moveTo(0, h);
  const step = Math.max(8, w / 100);
  for (let x = 0; x <= w + step; x += step) c.lineTo(x, h * 0.955 + (noise1(x / w * 9 + 4) - 0.5) * h * 0.02);
  c.lineTo(w + step, h); c.closePath(); c.fill();
  c.beginPath();
  for (let i = 0; i < 120; i++) {
    const x = hash(i * 5.21 + 1) * w, base = h * (0.935 + hash(i * 3.12 + 2) * 0.07), hh = h * (0.016 + hash(i * 7.3 + 3) * 0.045);
    const sway = Math.sin(t * (0.9 + hash(i) * 0.8) + i) * (0.5 + wind) * hh * 0.10 + wind * hh * 0.12;
    const bw = w * 0.0032 * (0.6 + hash(i * 2.7) * 0.8);
    c.moveTo(x - bw, base); c.quadraticCurveTo(x - bw * 0.3, base - hh * 0.6, x + sway, base - hh);
    c.quadraticCurveTo(x + bw * 0.4, base - hh * 0.55, x + bw, base); c.closePath();
  }
  c.fill();
  drawStone(c, F, 2, w * 0.075, h * 1.03, h * 0.27, -0.09, 'rgba(2,4,7,0.98)');
  drawStone(c, F, 0, w * 0.925, h * 1.02, h * 0.19, 0.12, 'rgba(2,4,7,0.98)');
  c.restore();
  for (let i = 0; i < st.corners.length; i++) drawTree(c, F, st, st.corners[i]);
}
function drawVignette(c, F) {
  const w = F.w, h = F.h, r = Math.max(w, h);
  const g = c.createRadialGradient(w * 0.5, h * 0.52, Math.min(w, h) * 0.30, w * 0.5, h * 0.52, r * 0.80);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(0,0,0,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.46)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  const bg = c.createLinearGradient(0, h * 0.82, 0, h);
  bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.30)');
  c.fillStyle = bg; c.fillRect(0, h * 0.82, w, h * 0.18);
}

/* ===================================================================== */
/* export                                                                 */
/* ===================================================================== */
export default {
  init(w, h) {
    const graves = initGraves();
    return {
      lastT: 0, windPh: 0, cloudPh: 0, fogPh: 0,
      F: makeFrame(),
      stars: makeStars(), clouds: initClouds(), forest: initForest(),
      trees: initTrees(), corners: initCorners(), graves, crows: initCrows(graves),
      candles: initCandles(), fog: initFog(), leaves: initLeaves(), motes: initMotes(), puddles: initPuddles(),
      order: initStormOrder(),
      wx: new Float32Array(NW), wy: new Float32Array(NW), ww: new Float32Array(NW), wh: new Float32Array(NW), wi: new Float32Array(NW),
      gAmt: new Float32Array(NW), gType: new Uint8Array(NW), gLoc: new Float32Array(NW),
      scratch: new Float32Array(4096),
    };
  },

  draw(c, state, t, dt, mood, w, h) {
    if (!(w > 0) || !(h > 0)) return;
    if (!Number.isFinite(t)) t = 0;
    const F = state.F;
    frameSetup(F, state, t, w, h);
    c.save();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    makeGradients(c, F);
    prepColors(F);

    drawSky(c, F);
    drawStars(c, F, state);
    drawMoon(c, F);
    drawClouds(c, F, state);
    drawMoonWisps(c, F, state);
    drawBolt(c, F);
    drawRain(c, F, 0, 0);
    drawFarLand(c, F, state);
    drawFog(c, F, state, 0);
    drawTrees(c, F, state, true);
    drawHill(c, F);
    drawPathway(c, F);
    drawManor(c, F, state);
    drawFog(c, F, state, 1);
    drawTrees(c, F, state, false);
    drawGraveyard(c, F, state);
    drawMistFigure(c, F);
    drawFog(c, F, state, 2);
    drawFence(c, F);
    drawWebs(c, F, state);
    drawCrows(c, F, state);
    drawPuddles(c, F, state);
    drawCandles(c, F, state);
    drawBats(c, F);
    drawDrips(c, F);
    drawRain(c, F, 1, 2);
    drawFog(c, F, state, 3);
    drawLeaves(c, F, state);
    drawForeground(c, F, state);
    drawVignette(c, F);

    c.restore();
  },
};
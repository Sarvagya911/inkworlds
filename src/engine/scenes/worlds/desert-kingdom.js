// src/engine/scenes/worlds/desert-kingdom.js
//
// Arabian Nights desert kingdom: a 90 second living day cycle.
//
//   0  -> 28  Day          (heat shimmer, drifting clouds, birds)
//   28 -> 42  Golden sunset (sun sinks, god rays, sky burns amber -> violet)
//   42 -> 76  Night         (huge crescent moon, Milky Way, shooting stars,
//                            palace + city windows light up, lanterns, magic)
//   76 -> 90  Dawn          (pink horizon, sun rises, back to day)
//
// Signature moments (all deterministic from `t`, no per-frame state needed):
//   - The Magic Lamp: every ~23s at night a lamp on an ancient ruin ignites,
//     a rune ring glows, a stream of golden particles spirals up and forms
//     a swirl before dissolving.
//   - A spirit light glides along the dunes every ~19s.
//   - Shooting stars, floating sky lanterns, flickering windows.
//   - Wind: sand grains blow across the foreground, with stronger gusts that
//     shake the palms and lift spindrift off the dune crests.
//
// Signature: draw(c, state, t, dt, mood, w, h)   (t in seconds)
 
const TAU = Math.PI * 2;
 
// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
const hash = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};
const mixC = (a, b, t) => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t)
];
const rgb = (c, a = 1) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const tri = (x) => 1 - Math.abs((((x % 2) + 2) % 2) - 1);
 
function glow(c, x, y, r, col, a) {
  if (a <= 0.004 || r <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgb(col, a));
  g.addColorStop(0.4, rgb(col, a * 0.35));
  g.addColorStop(1, rgb(col, 0));
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}
 
// ---------------------------------------------------------------------------
// colour keyframes across the 90s cycle
// ---------------------------------------------------------------------------
const DAY = {
  top: [107, 183, 223],
  mid: [243, 201, 139],
  hor: [250, 216, 165],
  d: [
    [214, 160, 110],
    [196, 134, 88],
    [172, 108, 72],
    [132, 80, 60],
    [78, 52, 52]
  ],
  haze: [235, 190, 140],
  cloud: [255, 247, 232],
  rim: [255, 228, 175],
  n: 0,
  warm: 0
};
 
const KF = [
  { t: 0, ...DAY },
  { t: 28, ...DAY },
  {
    t: 36, // golden sunset
    top: [86, 76, 138],
    mid: [238, 128, 84],
    hor: [255, 178, 92],
    d: [
      [206, 112, 80],
      [162, 84, 70],
      [130, 66, 64],
      [96, 50, 56],
      [54, 36, 50]
    ],
    haze: [232, 128, 88],
    cloud: [255, 170, 122],
    rim: [255, 160, 96],
    n: 0.12,
    warm: 1
  },
  {
    t: 42.5, // dusk
    top: [38, 34, 96],
    mid: [132, 70, 112],
    hor: [222, 108, 88],
    d: [
      [112, 66, 88],
      [82, 50, 74],
      [64, 40, 66],
      [42, 30, 54],
      [26, 22, 42]
    ],
    haze: [124, 72, 102],
    cloud: [190, 112, 134],
    rim: [220, 130, 140],
    n: 0.55,
    warm: 0.6
  },
  {
    t: 50, // night
    top: [7, 11, 43],
    mid: [16, 27, 76],
    hor: [38, 54, 112],
    d: [
      [56, 64, 112],
      [40, 46, 90],
      [30, 34, 70],
      [21, 23, 52],
      [13, 13, 31]
    ],
    haze: [46, 60, 112],
    cloud: [58, 74, 134],
    rim: [160, 178, 255],
    n: 1,
    warm: 0
  },
  {
    t: 68,
    top: [7, 11, 43],
    mid: [16, 27, 76],
    hor: [38, 54, 112],
    d: [
      [56, 64, 112],
      [40, 46, 90],
      [30, 34, 70],
      [21, 23, 52],
      [13, 13, 31]
    ],
    haze: [46, 60, 112],
    cloud: [58, 74, 134],
    rim: [160, 178, 255],
    n: 1,
    warm: 0
  },
  {
    t: 76, // pre-dawn
    top: [24, 30, 82],
    mid: [98, 78, 130],
    hor: [226, 138, 122],
    d: [
      [142, 94, 112],
      [102, 68, 94],
      [78, 50, 80],
      [52, 36, 62],
      [31, 25, 46]
    ],
    haze: [172, 112, 128],
    cloud: [212, 142, 156],
    rim: [255, 170, 150],
    n: 0.6,
    warm: 0.55
  },
  {
    t: 83, // dawn
    top: [98, 130, 192],
    mid: [246, 172, 132],
    hor: [255, 208, 142],
    d: [
      [224, 152, 112],
      [192, 120, 88],
      [152, 94, 74],
      [112, 70, 60],
      [64, 44, 52]
    ],
    haze: [246, 188, 142],
    cloud: [255, 206, 166],
    rim: [255, 214, 160],
    n: 0.12,
    warm: 0.8
  },
  { t: 90, ...DAY }
];
 
function palAt(cyc) {
  let i = 0;
  while (i < KF.length - 2 && cyc >= KF[i + 1].t) i++;
  const a = KF[i];
  const b = KF[i + 1];
  const u = smooth((cyc - a.t) / (b.t - a.t));
  return {
    top: mixC(a.top, b.top, u),
    mid: mixC(a.mid, b.mid, u),
    hor: mixC(a.hor, b.hor, u),
    haze: mixC(a.haze, b.haze, u),
    cloud: mixC(a.cloud, b.cloud, u),
    rim: mixC(a.rim, b.rim, u),
    d: a.d.map((col, k) => mixC(col, b.d[k], u)),
    n: lerp(a.n, b.n, u),
    warm: lerp(a.warm, b.warm, u)
  };
}
 
// ---------------------------------------------------------------------------
// dune geometry (shared so caravans / buildings can stand on the ridges)
// ---------------------------------------------------------------------------
const LAYERS = [
  { y: 0.665, a: 0.02, f: 2.6, ph: 0.5, sp: 0.02 },
  { y: 0.735, a: 0.014, f: 3.4, ph: 2.1, sp: -0.026 },
  { y: 0.805, a: 0.026, f: 2.2, ph: 4.0, sp: 0.03 },
  { y: 0.875, a: 0.028, f: 1.7, ph: 1.1, sp: -0.024 },
  { y: 0.95, a: 0.03, f: 1.3, ph: 3.3, sp: 0.02 }
];
 
function ridge(i, x, e) {
  const L = LAYERS[i];
  const nx = x / e.w;
  const th = nx * L.f * TAU + L.ph + e.t * L.sp;
  let wv =
    Math.sin(th + 0.7 * Math.sin(th)) * 0.8 +
    0.22 * Math.sin(th * 2.3 + L.ph * 1.7 + e.t * L.sp * 0.7);
  if (i === 1) {
    // flat plateau under the palace
    const pl = smooth(1 - Math.abs(nx - 0.52) / 0.22) * 0.88;
    wv *= 1 - pl;
  }
  return e.h * (L.y + wv * L.a);
}
 
// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------
function init(w, h) {
  const houses = Array.from({ length: 38 }, (_, i) => {
    const x = 0.14 + hash(i * 3.3 + 1) * 0.76;
    const dist = Math.abs(x - 0.52);
    const wd = 20 + hash(i * 7.1) * 30;
    const ht = 30 + hash(i * 5.9) * 52 + Math.max(0, 0.28 - dist) * 90;
    const rows = Math.max(1, Math.floor((ht - 8) / 20));
    const cols = Math.max(1, Math.floor(wd / 13));
    const win = [];
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        if (hash(i * 13 + r * 5 + cc * 1.7) > 0.3) {
          win.push({
            ox: -wd / 2 + (cc + 0.5) * (wd / cols),
            oy: 12 + r * 20,
            id: i * 17 + r * 5 + cc
          });
        }
      }
    }
    return {
      x,
      w: wd,
      h: ht,
      kind: Math.floor(hash(i * 2.2) * 3),
      d: hash(i * 9.9),
      win
    };
  }).sort((a, b) => a.d - b.d);
 
  return {
    w,
    h,
    wind: 0,
    lastT: null,
 
    stars: Array.from({ length: 170 }, (_, i) => ({
      x: hash(i * 4.13),
      y: 0.03 + hash(i * 8.91) * 0.58,
      r: 0.5 + Math.pow(hash(i * 3.71), 3) * 1.7,
      ph: hash(i * 9.17) * TAU,
      sp: 0.6 + hash(i * 5.43) * 2.2,
      warm: hash(i * 1.9)
    })),
 
    mw: Array.from({ length: 170 }, (_, i) => ({
      x: (hash(i * 2.1) - 0.5) * 1.7,
      y: (hash(i * 6.3) + hash(i * 9.7) - 1) * 0.12,
      a: 0.15 + hash(i * 4.4) * 0.5,
      r: 0.5 + hash(i * 7.7) * 0.9
    })),
 
    clouds: Array.from({ length: 7 }, (_, i) => ({
      x: hash(i * 5.1),
      y: 0.07 + hash(i * 2.7) * 0.34,
      s: 0.7 + hash(i * 8.3) * 0.9,
      v: 3 + hash(i * 1.3) * 7,
      blobs: Array.from({ length: 6 }, (_, j) => ({
        dx: (j - 2.5) * (26 + hash(i * 7 + j) * 10),
        dy: (hash(i * 3 + j * 1.7) - 0.6) * 16,
        r: 26 + hash(i * 11 + j * 2.3) * 30
      }))
    })),
 
    birds: Array.from({ length: 8 }, (_, i) => {
      const flock = i < 5 ? 0 : 1;
      return {
        fx: flock ? 0.62 : 0.18,
        fy: flock ? 0.2 : 0.14,
        v: flock ? 16 : 12,
        fph: flock * 2.1,
        dx: ((i % 5) - 2) * 22 + hash(i * 3.3) * 8,
        dy: Math.abs((i % 5) - 2) * 7 + hash(i * 5.1) * 5,
        ph: hash(i * 6.2) * TAU,
        s: 0.8 + hash(i * 1.7) * 0.4
      };
    }),
 
    farCity: Array.from({ length: 30 }, (_, i) => ({
      x: i / 30 + hash(i * 3.1) * 0.02,
      w: 16 + hash(i * 6.7) * 26,
      h: 16 + hash(i * 8.3) * 38,
      dome: hash(i * 2.9) > 0.62,
      minaret: hash(i * 4.7) > 0.82,
      id: i
    })),
 
    houses,
 
    stalls: Array.from({ length: 8 }, (_, i) => ({
      x: 0.2 + i * 0.085 + hash(i * 4.4) * 0.02,
      acc: i % 4,
      ph: hash(i * 7.7) * TAU
    })),
 
    people: Array.from({ length: 20 }, (_, i) => ({
      a: 0.19 + hash(i * 3.7) * 0.62,
      len: 0.03 + hash(i * 5.3) * 0.1,
      sp: 5 + hash(i * 8.9) * 7,
      ph: hash(i * 2.9) * 2,
      kind: i % 5 === 0 ? 2 : i % 4 === 0 ? 3 : i % 3 === 0 ? 1 : 0,
      col: i % 5
    })),
 
    strings: [
      { a: 0.255, b: 0.405, ha: 52, hb: 44, sag: 10, n: 8 },
      { a: 0.615, b: 0.77, ha: 46, hb: 54, sag: 11, n: 9 }
    ],
 
    skyLanterns: Array.from({ length: 9 }, (_, i) => ({
      x: 0.3 + hash(i * 4.9) * 0.45,
      off: hash(i * 7.3) * 40,
      life: 34 + hash(i * 2.1) * 14,
      ph: hash(i * 3.3) * TAU
    })),
 
    motes: Array.from({ length: 44 }, (_, i) => ({
      x: 0.1 + hash(i * 7.2) * 0.8,
      y: 0.74 + hash(i * 3.4) * 0.2,
      ph: hash(i * 5.1) * TAU,
      sp: 0.6 + hash(i * 8.7) * 0.8,
      off: hash(i * 6.1) * 20,
      r: 0.8 + hash(i * 9.1) * 1.4
    })),
 
    grains: Array.from({ length: 120 }, (_, i) => ({
      x: hash(i * 3.9),
      y: 0.72 + hash(i * 6.1) * 0.27,
      z: 0.4 + hash(i * 8.3) * 1.0,
      ph: hash(i * 2.3) * TAU
    }))
  };
}
 
// ---------------------------------------------------------------------------
// sky, sun, moon, stars
// ---------------------------------------------------------------------------
function drawSky(c, w, h, P) {
  const g = c.createLinearGradient(0, 0, 0, h * 0.72);
  g.addColorStop(0, rgb(P.top));
  g.addColorStop(0.55, rgb(P.mid));
  g.addColorStop(1, rgb(P.hor));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}
 
function drawHorizonGlow(c, w, h, P, cyc) {
  const a = P.warm;
  if (a < 0.02) return;
  const te = cyc >= 60 ? (cyc - 77) / 53 : (cyc + 13) / 53;
  const gx = lerp(0.08, 0.92, clamp(te)) * w;
  const gy = h * 0.64;
  const R = Math.max(w, h) * 0.75;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.translate(gx, gy);
  c.scale(1, 0.55);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, `rgba(255,150,70,${0.5 * a})`);
  g.addColorStop(0.35, `rgba(255,110,80,${0.18 * a})`);
  g.addColorStop(1, 'rgba(255,90,80,0)');
  c.fillStyle = g;
  c.fillRect(-w * 2, -h * 3, w * 4, h * 6);
  c.restore();
}
 
function sunState(cyc, w, h) {
  const T = ((cyc - 77 + 90) % 90) / 53;
  if (T > 1) return null;
  const arc = Math.sin(Math.PI * T);
  return {
    T,
    arc,
    x: lerp(0.08, 0.92, T) * w,
    y: h * 0.67 - Math.pow(arc, 0.8) * h * 0.52
  };
}
 
function moonState(cyc, w, h) {
  const M = (cyc - 42) / 36;
  if (M <= 0 || M >= 1) return null;
  const arc = Math.sin(Math.PI * M);
  return {
    M,
    arc,
    a: smooth(M / 0.1) * smooth((1 - M) / 0.1),
    x: lerp(0.12, 0.88, M) * w,
    y: h * 0.67 - Math.pow(arc, 0.8) * h * 0.53
  };
}
 
function drawSun(c, w, h, sun, P, t) {
  if (!sun) return;
  const r = Math.min(w, h * 1.3) * 0.05;
  const low = 1 - clamp(sun.arc * 1.7);
  const col = mixC([255, 243, 196], [255, 128, 56], low);
 
  c.save();
  c.globalCompositeOperation = 'lighter';
 
  // god rays at low sun
  if (P.warm > 0.2) {
    const R = Math.max(w, h) * 0.9;
    const g = c.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, R);
    g.addColorStop(0, rgb(col, 0.22 * P.warm));
    g.addColorStop(1, rgb(col, 0));
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a0 = -Math.PI + 0.2 + i * 0.36 + Math.sin(t * 0.05 + i) * 0.03;
      c.moveTo(sun.x, sun.y);
      c.lineTo(sun.x + Math.cos(a0 - 0.05) * R, sun.y + Math.sin(a0 - 0.05) * R);
      c.lineTo(sun.x + Math.cos(a0 + 0.05) * R, sun.y + Math.sin(a0 + 0.05) * R);
      c.closePath();
    }
    c.fill();
  }
 
  glow(c, sun.x, sun.y, r * 9, col, 0.3);
  glow(c, sun.x, sun.y, r * 4, col, 0.55);
  c.restore();
 
  const g = c.createRadialGradient(sun.x, sun.y, r * 0.1, sun.x, sun.y, r);
  g.addColorStop(0, 'rgba(255,252,232,1)');
  g.addColorStop(1, rgb(mixC(col, [255, 236, 170], 0.3), 1));
  c.fillStyle = g;
  c.beginPath();
  c.arc(sun.x, sun.y, r, 0, TAU);
  c.fill();
}
 
function drawMoon(c, w, h, moon, t) {
  if (!moon) return;
  const r = Math.max(26, Math.min(w, h) * 0.075);
  const low = 1 - clamp(moon.arc * 1.8);
  const col = mixC([255, 243, 205], [255, 176, 110], low * 0.8);
  const { x, y, a } = moon;
 
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, x, y, r * 7, col, 0.2 * a);
  glow(c, x, y, r * 2.6, col, 0.22 * a);
  c.restore();
 
  c.save();
  c.globalAlpha = a;
  // earthshine: the dark part of the moon, barely visible
  c.fillStyle = rgb(col, 0.06);
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  // crescent: clip out an offset circle
  c.beginPath();
  c.rect(x - r * 3, y - r * 3, r * 6, r * 6);
  c.moveTo(x + r * 0.52 + r * 0.92, y - r * 0.12);
  c.arc(x + r * 0.52, y - r * 0.12, r * 0.92, 0, TAU);
  c.clip('evenodd');
  c.fillStyle = rgb(col);
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.restore();
 
  // faint shimmering halo ring
  c.save();
  c.strokeStyle = rgb(col, a * (0.1 + Math.sin(t * 0.7) * 0.04));
  c.lineWidth = 1;
  c.beginPath();
  c.arc(x, y, r * 1.5, 0, TAU);
  c.stroke();
  c.restore();
}
 
function drawStars(c, w, h, st, t, vis) {
  if (vis <= 0.01) return;
  c.save();
 
  // Milky Way band
  c.translate(w * 0.5, h * 0.3);
  c.rotate(-0.55 + t * 0.0008);
  const bandH = h * 0.24;
  const g = c.createLinearGradient(0, -bandH, 0, bandH);
  g.addColorStop(0, 'rgba(190,200,255,0)');
  g.addColorStop(0.5, `rgba(190,200,255,${0.13 * vis})`);
  g.addColorStop(1, 'rgba(190,200,255,0)');
  c.fillStyle = g;
  c.fillRect(-w, -bandH, w * 2, bandH * 2);
  for (const m of st.mw) {
    c.fillStyle = `rgba(235,235,255,${m.a * vis * 0.8})`;
    c.fillRect(m.x * w, m.y * h, m.r, m.r);
  }
  c.restore();
 
  for (const s of st.stars) {
    const tw = 0.6 + 0.4 * Math.sin(t * s.sp + s.ph);
    const a = vis * tw * clamp((0.64 - s.y) * 5);
    if (a <= 0.01) continue;
    const x = s.x * w;
    const y = s.y * h;
    c.fillStyle =
      s.warm > 0.6 ? `rgba(255,236,200,${a})` : `rgba(210,225,255,${a})`;
    if (s.r < 1.1) {
      c.fillRect(x, y, s.r * 1.4, s.r * 1.4);
    } else {
      c.beginPath();
      c.arc(x, y, s.r, 0, TAU);
      c.fill();
    }
    if (s.r > 1.6) {
      c.strokeStyle = `rgba(255,240,205,${a * 0.4})`;
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(x - 5, y);
      c.lineTo(x + 5, y);
      c.moveTo(x, y - 5);
      c.lineTo(x, y + 5);
      c.stroke();
    }
  }
}
 
function drawShootingStars(c, w, h, t, vis, S) {
  if (vis < 0.3) return;
  const PER = 9;
  const k = Math.floor(t / PER);
  const local = t - k * PER;
  if (hash(k * 5.3) < 0.4) return;
  const dur = 1.0;
  const off = hash(k * 1.7) * (PER - dur - 0.5);
  const p = (local - off) / dur;
  if (p < 0 || p > 1) return;
  const dir = hash(k * 4.4) > 0.5 ? 1 : -1;
  const ang = 0.35 + hash(k * 6.1) * 0.35;
  const len = (180 + hash(k * 3.3) * 160) * S;
  const x0 = w * (0.1 + hash(k * 8.1) * 0.7);
  const y0 = h * (0.04 + hash(k * 2.9) * 0.22);
  const hx = x0 + dir * Math.cos(ang) * len * p;
  const hy = y0 + Math.sin(ang) * len * p;
  const pt = Math.max(0, p - 0.3);
  const tx = x0 + dir * Math.cos(ang) * len * pt;
  const ty = y0 + Math.sin(ang) * len * pt;
  const a = Math.sin(Math.PI * p) * vis;
 
  c.save();
  const g = c.createLinearGradient(tx, ty, hx, hy);
  g.addColorStop(0, 'rgba(255,245,220,0)');
  g.addColorStop(1, `rgba(255,250,235,${a})`);
  c.strokeStyle = g;
  c.lineWidth = 2 * S;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(tx, ty);
  c.lineTo(hx, hy);
  c.stroke();
  c.globalCompositeOperation = 'lighter';
  glow(c, hx, hy, 9 * S, [255, 240, 210], a * 0.7);
  c.restore();
}
 
function drawClouds(c, w, h, st, t, P, S) {
  const A = lerp(0.55, 0.3, P.n) + P.warm * 0.08;
  c.save();
  for (const cl of st.clouds) {
    const span = w + 500 * S;
    const x = ((cl.x * span + t * cl.v * S) % span) - 250 * S;
    const y = cl.y * h;
    for (const b of cl.blobs) {
      const bx = x + b.dx * cl.s * S;
      const by = y + b.dy * cl.s * S;
      const br = b.r * cl.s * S;
      c.save();
      c.translate(bx, by);
      c.scale(1, 0.45);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, br);
      g.addColorStop(0, rgb(P.cloud, A));
      g.addColorStop(1, rgb(P.cloud, 0));
      c.fillStyle = g;
      c.fillRect(-br, -br, br * 2, br * 2);
      c.restore();
    }
  }
  c.restore();
}
 
function drawBirds(c, w, h, st, t, P, S) {
  const vis = clamp(1 - P.n * 2.2);
  if (vis < 0.05) return;
  c.save();
  c.strokeStyle = rgb(mixC([70, 48, 50], P.haze, 0.3), 0.6 * vis);
  c.lineWidth = 1.2 * S;
  c.lineCap = 'round';
  for (const b of st.birds) {
    const span = w + 240 * S;
    const x = ((b.fx * span + t * b.v * S) % span) - 120 * S + b.dx * S;
    const y = h * b.fy + b.dy * S + Math.sin(t * 0.35 + b.fph) * 10 * S;
    const flap = Math.sin(t * 6 + b.ph) * 3 * S;
    const sz = 5 * S * b.s;
    c.beginPath();
    c.moveTo(x - sz, y + flap * 0.6);
    c.quadraticCurveTo(x - sz * 0.5, y - sz * 0.45 - flap, x, y);
    c.quadraticCurveTo(x + sz * 0.5, y - sz * 0.45 - flap, x + sz, y + flap * 0.6);
    c.stroke();
  }
  c.restore();
}
 
// ---------------------------------------------------------------------------
// dunes
// ---------------------------------------------------------------------------
function drawDune(c, i, e, P, S) {
  const { w, h } = e;
  const L = LAYERS[i];
  const hazeMix = [0.38, 0.14, 0.05, 0, 0][i];
  const col = mixC(P.d[i], P.haze, hazeMix);
  const top = h * (L.y - L.a * 1.1);
  const bot = h * (L.y + 0.12);
  const g = c.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, rgb(mixC(col, P.rim, 0.1)));
  g.addColorStop(1, rgb(mixC(col, [8, 6, 18], 0.28)));
  const step = Math.max(8, w / 220);
 
  c.beginPath();
  c.moveTo(-step, h + 2);
  for (let x = -step; x <= w + step; x += step) c.lineTo(x, ridge(i, x, e));
  c.lineTo(w + step, h + 2);
  c.closePath();
  c.fillStyle = g;
  c.fill();
 
  // lit crest
  c.beginPath();
  for (let x = -step; x <= w + step; x += step) {
    if (x === -step) c.moveTo(x, ridge(i, x, e));
    else c.lineTo(x, ridge(i, x, e));
  }
  c.strokeStyle = rgb(P.rim, 0.3 - P.n * 0.08);
  c.lineWidth = 1.4 * S;
  c.stroke();
 
  // wind ripples
  if (i >= 2) {
    c.strokeStyle = 'rgba(0,0,0,0.07)';
    c.lineWidth = 1;
    for (let k = 1; k <= 2; k++) {
      c.beginPath();
      for (let x = -14; x <= w + 14; x += 14) {
        const y = ridge(i, x, e) + k * (10 + i * 3) * S + Math.sin(x * 0.02 + k) * 2;
        if (x === -14) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  }
}
 
function drawHeatHaze(c, w, h, P, t) {
  const a = (1 - P.n) * (1 - P.warm * 0.6) * 0.08;
  if (a < 0.005) return;
  c.save();
  c.strokeStyle = rgb([255, 224, 170], a);
  c.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const y = h * (0.6 + i * 0.03);
    c.beginPath();
    for (let x = 0; x <= w; x += 16) {
      const yy = y + Math.sin(x * 0.018 + t * 0.6 + i) * 2.5;
      if (x === 0) c.moveTo(x, yy);
      else c.lineTo(x, yy);
    }
    c.stroke();
  }
  c.restore();
}
 
// ---------------------------------------------------------------------------
// architecture helpers
// ---------------------------------------------------------------------------
function onionPath(c, x, y, r, hh) {
  c.moveTo(x - r * 0.82, y);
  c.bezierCurveTo(x - r * 1.28, y - hh * 0.32, x - r * 0.55, y - hh * 0.62, x, y - hh);
  c.bezierCurveTo(x + r * 0.55, y - hh * 0.62, x + r * 1.28, y - hh * 0.32, x + r * 0.82, y);
  c.closePath();
}
 
function domeFill(c, x, y, r, hh, col, ld, P) {
  c.beginPath();
  onionPath(c, x, y, r, hh);
  const gx = x + ld * r * 0.55;
  const g = c.createRadialGradient(gx, y - hh * 0.45, r * 0.05, x, y - hh * 0.4, r * 1.5);
  g.addColorStop(0, rgb(mixC(col, P.rim, 0.55)));
  g.addColorStop(0.5, rgb(col));
  g.addColorStop(1, rgb(mixC(col, [10, 6, 20], 0.45)));
  c.fillStyle = g;
  c.fill();
  const fin = mixC(col, P.rim, 0.4);
  c.strokeStyle = rgb(fin);
  c.lineWidth = Math.max(1, r * 0.07);
  c.beginPath();
  c.moveTo(x, y - hh);
  c.lineTo(x, y - hh - r * 0.5);
  c.stroke();
  c.fillStyle = rgb(fin);
  c.beginPath();
  c.arc(x, y - hh - r * 0.52, r * 0.07 + 0.6, 0, TAU);
  c.fill();
}
 
function archPath(c, x, y, aw, ah) {
  c.moveTo(x - aw / 2, y);
  c.lineTo(x - aw / 2, y - ah * 0.55);
  c.quadraticCurveTo(x - aw * 0.5, y - ah * 0.85, x, y - ah);
  c.quadraticCurveTo(x + aw * 0.5, y - ah * 0.85, x + aw / 2, y - ah * 0.55);
  c.lineTo(x + aw / 2, y);
  c.closePath();
}
 
function box(c, x, y, bw, bh, wall, ld, P, S) {
  c.fillStyle = rgb(wall);
  c.fillRect(x, y, bw, bh);
  const sw = Math.max(1, bw * 0.2);
  c.fillStyle = 'rgba(0,0,0,0.2)';
  if (ld > 0.15) c.fillRect(x, y, sw, bh);
  else if (ld < -0.15) c.fillRect(x + bw - sw, y, sw, bh);
  c.fillStyle = rgb(P.rim, 0.28 * (1 - P.n * 0.3));
  if (ld > 0.15) c.fillRect(x + bw - 1.2 * S, y, 1.2 * S, bh);
  else if (ld < -0.15) c.fillRect(x, y, 1.2 * S, bh);
  c.fillStyle = rgb(P.rim, 0.22);
  c.fillRect(x, y, bw, 1.2 * S);
}
 
function winLit(id, n, t) {
  const thr = hash(id * 3.1 + 0.5);
  const base = clamp((n - 0.28) / 0.5 - thr * 0.65);
  if (base <= 0) return 0;
  const slow = 0.6 + 0.4 * Math.sin(t * 0.05 + id * 2.3);
  return (
    base *
    (0.82 + 0.18 * Math.sin(t * (2.5 + hash(id) * 4) + id)) *
    (thr < 0.15 ? slow : 1)
  );
}
 
function drawWin(c, x, y, S, lit, wall) {
  c.beginPath();
  archPath(c, x, y, 4.4 * S, 8 * S);
  if (lit > 0.02) {
    c.fillStyle = `rgba(255,${(176 + lit * 30) | 0},${(80 + lit * 40) | 0},${0.35 + 0.65 * lit})`;
  } else {
    c.fillStyle = rgb(mixC(wall, [8, 6, 16], 0.5), 0.85);
  }
  c.fill();
}
 
// ---------------------------------------------------------------------------
// far city (hazy silhouette on the horizon)
// ---------------------------------------------------------------------------
function drawFarCity(c, w, h, st, e, P, S, t) {
  const col = mixC(P.haze, P.d[2], 0.55);
  c.save();
  for (const b of st.farCity) {
    const x = b.x * w;
    const base = ridge(0, x, e) + 8 * S;
    const bw = b.w * S;
    const bh = b.h * S;
    c.fillStyle = rgb(col);
    c.fillRect(x - bw / 2, base - bh, bw, bh + 30 * S);
    if (b.dome) {
      c.beginPath();
      onionPath(c, x, base - bh, bw * 0.4, bw * 0.7);
      c.fill();
    }
    if (b.minaret) {
      c.fillRect(x + bw / 2 - 2 * S, base - bh - 26 * S, 3.4 * S, 30 * S);
      c.beginPath();
      c.moveTo(x + bw / 2 - 3 * S, base - bh - 26 * S);
      c.lineTo(x + bw / 2 - 0.3 * S, base - bh - 34 * S);
      c.lineTo(x + bw / 2 + 2.4 * S, base - bh - 26 * S);
      c.fill();
    }
    if (P.n > 0.3) {
      const a = winLit(b.id * 5, P.n, t) * 0.55;
      if (a > 0.03) {
        c.fillStyle = `rgba(255,190,100,${a})`;
        c.fillRect(x - 2 * S, base - bh * 0.55, 1.8 * S, 2.6 * S);
        c.fillRect(x + 2 * S, base - bh * 0.3, 1.8 * S, 2.6 * S);
      }
    }
  }
  c.restore();
}
 
// ---------------------------------------------------------------------------
// near city
// ---------------------------------------------------------------------------
function houseWall(P, dep) {
  return mixC(
    mixC(P.d[1], [58, 34, 50], 0.3 + 0.35 * P.n),
    P.haze,
    (1 - dep) * 0.28
  );
}
 
function domeColor(wall, P) {
  return mixC(mixC(wall, [246, 192, 108], 0.55 * (1 - P.n)), [96, 106, 180], 0.3 * P.n);
}
 
function drawHouses(c, w, h, st, e, P, ld, S, t) {
  for (const b of st.houses) {
    const x = b.x * w;
    const base = ridge(1, x, e) + 10 * S;
    const bw = b.w * S;
    const bh = b.h * S;
    const wall = houseWall(P, b.d);
    box(c, x - bw / 2, base - bh, bw, bh + 30 * S, wall, ld, P, S);
 
    if (b.kind === 1) {
      domeFill(c, x, base - bh, bw * 0.36, bw * 0.55, domeColor(wall, P), ld, P);
    } else if (b.kind === 2) {
      c.fillStyle = rgb(mixC(wall, [0, 0, 0], 0.2));
      c.beginPath();
      c.moveTo(x - bw * 0.52, base - bh);
      c.lineTo(x, base - bh - bw * 0.62);
      c.lineTo(x + bw * 0.52, base - bh);
      c.closePath();
      c.fill();
    } else {
      // little parapet notches
      c.fillStyle = rgb(wall);
      for (let k = 0; k < 3; k++) {
        c.fillRect(x - bw / 2 + k * (bw / 3) + 1.5 * S, base - bh - 3 * S, bw / 6, 3 * S);
      }
    }
 
    for (const wi of b.win) {
      drawWin(c, x + wi.ox * S, base - wi.oy * S, S, winLit(wi.id, P.n, t), wall);
    }
  }
}
 
function drawPalace(c, cx, by, PS, P, ld, t) {
  const n = P.n;
  const wall = mixC(P.d[1], [58, 34, 50], 0.22 + 0.4 * n);
  const wallL = mixC(wall, P.rim, 0.18 * (1 - n * 0.4));
  const dome = domeColor(wall, P);
  const gold = mixC([246, 200, 110], [255, 232, 170], n);
  const bw = (x, y, w2, h2, col) => box(c, x, y, w2, h2, col, ld, P, 1);
 
  c.save();
  c.translate(cx, by);
  c.scale(PS, PS);
 
  // outer walls with crenellations + corner towers
  for (const sg of [-1, 1]) {
    const x0 = sg > 0 ? 150 : -260;
    bw(x0, -38, 110, 68, wall);
    c.fillStyle = rgb(wall);
    for (let i = 0; i < 9; i++) c.fillRect(x0 + i * 12.5 + 1, -44, 7, 6);
    const tx = sg * 250;
    bw(tx - 12, -84, 24, 114, wall);
    domeFill(c, tx, -84, 14, 26, dome, ld, P);
  }
 
  // wings + main body
  bw(-176, -62, 66, 92, wall);
  bw(110, -62, 66, 92, wall);
  bw(-112, -92, 224, 122, wall);
 
  // side towers
  for (const sg of [-1, 1]) {
    const tx = sg * 84;
    bw(tx - 16, -132, 32, 162, wall);
    domeFill(c, tx, -132, 22, 38, dome, ld, P);
  }
 
  // central hall + drum + great dome
  bw(-52, -152, 104, 182, wall);
  bw(-36, -178, 72, 28, wallL);
  domeFill(c, 0, -178, 46, 76, dome, ld, P);
 
  // crescent finial
  c.strokeStyle = rgb(gold);
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(0, -273, 8, Math.PI * 0.1, Math.PI * 0.9);
  c.stroke();
  c.fillStyle = rgb(gold);
  c.beginPath();
  c.arc(0, -277, 2.2, 0, TAU);
  c.fill();
 
  // minarets with balconies
  for (const sg of [-1, 1]) {
    const mx = sg * 152;
    bw(mx - 7, -196, 14, 226, wallL);
    c.fillStyle = rgb(wall);
    c.fillRect(mx - 11, -154, 22, 5);
    c.fillRect(mx - 10, -112, 20, 4);
    domeFill(c, mx, -196, 10, 24, dome, ld, P);
  }
 
  // decorative bands
  c.fillStyle = rgb(P.rim, 0.18);
  c.fillRect(-112, -92, 224, 2);
  c.fillRect(-52, -120, 104, 2);
 
  // gate
  c.beginPath();
  archPath(c, 0, 0, 44, 62);
  c.fillStyle = rgb(mixC([62, 36, 36], [255, 176, 84], n * 0.85));
  c.fill();
  c.fillStyle = rgb(mixC(wall, P.rim, 0.15));
  c.fillRect(-58, -5, 116, 5);
  c.fillRect(-48, -10, 96, 5);
 
  // windows
  const wins = [
    [-26, -104, 1], [0, -104, 1], [26, -104, 1],
    [-84, -98, 2], [84, -98, 2], [-84, -62, 3], [84, -62, 3],
    [-143, -26, 4], [-125, -26, 5], [125, -26, 6], [143, -26, 7],
    [-152, -128, 8], [152, -128, 9]
  ];
  for (let i = 0; i < wins.length; i++) {
    const [wx, wy, id] = wins[i];
    const big = i < 3;
    c.beginPath();
    archPath(c, wx, wy, big ? 11 : 7, big ? 24 : 15);
    const lit = winLit(1000 + id, n, t);
    if (lit > 0.02) {
      c.fillStyle = `rgba(255,${(176 + lit * 30) | 0},${(84 + lit * 40) | 0},${0.4 + 0.6 * lit})`;
    } else {
      c.fillStyle = rgb(mixC(wall, [8, 6, 16], 0.5), 0.85);
    }
    c.fill();
  }
 
  // warm night glow
  if (n > 0.2) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    glow(c, 0, -22, 90, [255, 168, 70], 0.4 * n);
    for (let i = 0; i < 3; i++) {
      glow(c, -26 + i * 26, -112, 30, [255, 186, 90], 0.22 * n * winLit(1000 + 1, n, t));
    }
    const g = c.createLinearGradient(0, 0, 0, -150);
    g.addColorStop(0, `rgba(255,160,70,${0.1 * n})`);
    g.addColorStop(1, 'rgba(255,160,70,0)');
    c.fillStyle = g;
    c.fillRect(-52, -152, 104, 152);
    c.restore();
  }
 
  c.restore();
}
 
function drawStall(c, x, y, S, acc, P, t, ph) {
  const wd = 24 * S;
  const ht = 15 * S;
  const n = P.n;
  const accents = [
    [196, 60, 52],
    [40, 120, 130],
    [220, 160, 50],
    [110, 60, 130]
  ];
  const stripeA = mixC(accents[acc], [20, 15, 35], 0.1 + 0.6 * n);
  const stripeB = mixC([240, 225, 200], [20, 15, 35], 0.15 + 0.7 * n);
 
  c.strokeStyle = rgb(mixC([70, 46, 40], [8, 8, 20], 0.7 * n));
  c.lineWidth = 1 * S;
  c.beginPath();
  c.moveTo(x - wd / 2, y);
  c.lineTo(x - wd / 2, y - ht);
  c.moveTo(x + wd / 2, y);
  c.lineTo(x + wd / 2, y - ht);
  c.stroke();
 
  c.fillStyle = rgb(mixC(P.d[3], [0, 0, 0], 0.25));
  c.fillRect(x - wd / 2, y - 5 * S, wd, 5 * S);
 
  for (let k = 0; k < 6; k++) {
    const x0 = x - wd / 2 + (k * wd) / 6;
    c.fillStyle = rgb(k % 2 ? stripeB : stripeA);
    c.beginPath();
    c.moveTo(x0 + 0.8 * S, y - ht);
    c.lineTo(x0 + wd / 6 - 0.8 * S, y - ht);
    c.lineTo(x0 + wd / 6 + 1.2 * S, y - ht * 0.7);
    c.lineTo(x0 - 1.2 * S, y - ht * 0.7);
    c.closePath();
    c.fill();
  }
 
  // goods on the counter
  const goods = [[200, 70, 50], [230, 170, 60], [60, 140, 120]];
  for (let k = 0; k < 3; k++) {
    c.fillStyle = rgb(mixC(goods[k], [10, 10, 24], 0.5 * n));
    c.fillRect(x - wd * 0.3 + k * wd * 0.28, y - 7 * S, 2.6 * S, 2 * S);
  }
 
  if (n > 0.15) {
    const fl = 0.8 + 0.2 * Math.sin(t * 5 + ph) + 0.08 * Math.sin(t * 11 + ph);
    c.save();
    c.globalCompositeOperation = 'lighter';
    glow(c, x, y - 7 * S, 22 * S, [255, 176, 80], 0.4 * n * fl);
    c.restore();
  }
}
 
function drawLanternStrings(c, w, h, st, e, P, S, t) {
  const cols = [[255, 170, 70], [236, 76, 62], [255, 212, 104], [70, 190, 200]];
  for (const s of st.strings) {
    const xa = s.a * w;
    const xb = s.b * w;
    const ya = ridge(1, xa, e) - s.ha * S;
    const yb = ridge(1, xb, e) - s.hb * S;
    c.strokeStyle = rgb(mixC([60, 40, 40], [8, 8, 20], P.n * 0.6), 0.75);
    c.lineWidth = 1 * S;
    // posts
    c.beginPath();
    c.moveTo(xa, ridge(1, xa, e));
    c.lineTo(xa, ya);
    c.moveTo(xb, ridge(1, xb, e));
    c.lineTo(xb, yb);
    c.stroke();
    // cable
    c.beginPath();
    for (let j = 0; j <= 24; j++) {
      const u = j / 24;
      const x = lerp(xa, xb, u);
      const y = lerp(ya, yb, u) + s.sag * S * Math.sin(Math.PI * u);
      if (j === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    // lanterns
    for (let j = 1; j < s.n; j++) {
      const u = j / s.n;
      const sway = Math.sin(t * 1.3 + j * 1.7 + s.a * 9) * 0.8 * S;
      const x = lerp(xa, xb, u) + sway;
      const y = lerp(ya, yb, u) + s.sag * S * Math.sin(Math.PI * u) + 3 * S;
      const col = cols[(j + (s.n | 0)) % 4];
      c.fillStyle = rgb(mixC(col, [20, 12, 24], (1 - P.n) * 0.25), 0.95);
      c.fillRect(x - 1.5 * S, y, 3 * S, 4.2 * S);
      if (P.n > 0.15) {
        const fl = 0.8 + 0.2 * Math.sin(t * 6 + j * 2.1) + 0.06 * Math.sin(t * 13 + j);
        c.save();
        c.globalCompositeOperation = 'lighter';
        glow(c, x, y + 2 * S, 12 * S, col, 0.38 * P.n * fl);
        c.restore();
      }
    }
  }
}
 
function drawPerson(c, x, y, S, dir, t, ph, col, kind, n) {
  const H = 11 * S;
  const bob = Math.abs(Math.sin(t * 5 + ph)) * 0.6 * S;
  const top = y - H * 0.62 - bob;
  c.fillStyle = rgb(col);
  c.strokeStyle = rgb(col);
  c.beginPath();
  c.moveTo(x - 2.2 * S, y);
  c.lineTo(x - 1.6 * S, top);
  c.lineTo(x + 1.6 * S, top);
  c.lineTo(x + 2.2 * S, y);
  c.closePath();
  c.fill();
  c.beginPath();
  c.arc(x, top - 1.5 * S, 1.6 * S, 0, TAU);
  c.fill();
  c.beginPath();
  c.ellipse(x + dir * 0.2 * S, top - 2.5 * S, 1.8 * S, 1 * S, 0, 0, TAU);
  c.fill();
 
  if (kind === 1) {
    c.lineWidth = 0.8 * S;
    c.beginPath();
    c.moveTo(x + dir * 3 * S, y);
    c.lineTo(x + dir * 3 * S, y - H * 0.95);
    c.stroke();
  } else if (kind === 2) {
    c.lineWidth = 0.8 * S;
    c.beginPath();
    c.moveTo(x - 5 * S, top + 1 * S);
    c.lineTo(x + 5 * S, top + 1 * S);
    c.stroke();
    c.beginPath();
    c.arc(x - 5 * S, top + 3.4 * S, 1.6 * S, 0, TAU);
    c.arc(x + 5 * S, top + 3.4 * S, 1.6 * S, 0, TAU);
    c.fill();
  } else if (kind === 3 && n > 0.2) {
    const lx = x + dir * 3.2 * S;
    const ly = y - H * 0.35;
    c.fillStyle = 'rgba(255,196,96,0.95)';
    c.fillRect(lx - 0.8 * S, ly, 1.6 * S, 2.2 * S);
    c.save();
    c.globalCompositeOperation = 'lighter';
    glow(c, lx, ly + S, 10 * S, [255, 176, 80], 0.45 * n);
    c.restore();
  }
}
 
function drawPeople(c, w, h, st, e, P, S, t) {
  const robes = [[70, 44, 44], [40, 70, 80], [120, 60, 50], [88, 70, 50], [150, 90, 60]];
  const dark = 0.25 + 0.65 * P.n;
  // stall vendors
  for (const s of st.stalls) {
    const x = s.x * w + 9 * S;
    const y = ridge(1, s.x * w, e) - 0.5 * S;
    const col = mixC(robes[s.acc], [10, 10, 24], dark);
    drawPerson(c, x, y, S, -1, t * 0.2, s.ph, col, 0, P.n);
  }
  // walkers
  for (const p of st.people) {
    const range = Math.max(30 * S, p.len * w);
    const raw = (t * p.sp * S) / range + p.ph;
    const x = p.a * w + tri(raw) * range;
    const dir = ((raw % 2) + 2) % 2 < 1 ? 1 : -1;
    const y = ridge(1, x, e) - 0.5 * S;
    const col = mixC(robes[p.col], [10, 10, 24], dark);
    drawPerson(c, x, y, S, dir, t, p.ph * 3, col, p.kind, P.n);
  }
}
 
function drawSkyLanterns(c, w, h, st, t, P, S) {
  const vis = clamp((P.n - 0.4) / 0.4);
  if (vis < 0.02) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const l of st.skyLanterns) {
    const u = ((t + l.off) / l.life) % 1;
    const x = l.x * w + Math.sin(u * 5 + l.ph) * 18 * S + u * 40 * S;
    const y = h * 0.7 - u * h * 0.55;
    const a = Math.pow(Math.sin(Math.PI * u), 0.7) * vis;
    const fl = 0.8 + 0.2 * Math.sin(t * 4 + l.ph) + 0.06 * Math.sin(t * 9 + l.ph);
    glow(c, x, y, 16 * S, [255, 170, 70], 0.4 * a * fl);
    c.fillStyle = `rgba(255,214,130,${0.9 * a * fl})`;
    c.fillRect(x - 1.8 * S, y - 2.6 * S, 3.6 * S, 5 * S);
  }
  c.restore();
}
 
// ---------------------------------------------------------------------------
// camels + caravans
// ---------------------------------------------------------------------------
function drawCamel(c, phase, hasRider, col, packCol) {
  c.fillStyle = rgb(col);
  c.strokeStyle = rgb(col);
  c.lineCap = 'round';
 
  // legs (diagonal gait)
  const legs = [[11, 0], [7, 1], [-11, 1], [-14, 0]];
  c.lineWidth = 3.2;
  for (const [hx, ofs] of legs) {
    const a = Math.sin(phase + ofs * Math.PI) * 0.38;
    const kx = hx + Math.sin(a) * 9;
    const ky = -19 + Math.cos(a) * 9;
    const lift = Math.max(0, Math.cos(phase + ofs * Math.PI)) * 3;
    const fx = kx + Math.sin(a * 0.5) * 10;
    const fy = ky + 10 - lift;
    c.beginPath();
    c.moveTo(hx, -19);
    c.lineTo(kx, ky);
    c.lineTo(fx, fy);
    c.stroke();
  }
 
  // body
  c.beginPath();
  c.ellipse(0, -27, 19, 8.5, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.ellipse(13, -26, 8, 8, 0, 0, TAU);
  c.ellipse(-14, -26, 8, 8, 0, 0, TAU);
  c.fill();
  // hump
  c.beginPath();
  c.ellipse(-3, -35, 6.5, 6, 0, 0, TAU);
  c.fill();
  // neck + head
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(14, -31);
  c.quadraticCurveTo(24, -40, 24, -52);
  c.stroke();
  c.beginPath();
  c.ellipse(28, -53.5, 6, 3, 0.3, 0, TAU);
  c.fill();
  // tail
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-19, -30);
  c.lineTo(-22, -20);
  c.stroke();
 
  // cargo or rider
  if (hasRider) {
    c.beginPath();
    c.ellipse(-3, -45, 4, 6, 0, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(-3, -53.5, 2.8, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(-2.4, -56, 3.4, 1.7, 0, 0, TAU);
    c.fill();
  } else {
    c.fillStyle = rgb(packCol);
    c.fillRect(-10, -44, 14, 9);
    c.fillStyle = rgb(col);
    c.fillRect(-8, -47, 10, 4);
  }
}
 
function drawCaravan(c, w, h, e, cv, t, P, S) {
  const sc = cv.sc * S;
  const span = w + 480 * S;
  const p = ((t * cv.v * S + cv.off * span) % span) - 240 * S;
  const lead = cv.dir > 0 ? p : w - p;
  const spacing = 52 * sc;
  const base = mixC([66, 42, 40], [8, 8, 22], 0.15 + 0.8 * P.n);
  const col = mixC(mixC(base, [120, 50, 40], P.warm * 0.2), P.haze, cv.haze);
  const pack = mixC(col, [140, 90, 60], 0.25 * (1 - P.n));
 
  for (let k = 0; k < cv.count; k++) {
    const x = lead - cv.dir * k * spacing;
    const y = ridge(cv.layer, x, e) + 1 * sc;
    const ang = Math.atan2(ridge(cv.layer, x + 4, e) - ridge(cv.layer, x - 4, e), 8);
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.scale(cv.dir * sc, sc);
    drawCamel(c, t * 3.2 + k * 0.9, k === 0 || k === cv.count - 2, col, pack);
    c.restore();
 
    // lantern on the leader at night
    if (k === 0 && P.n > 0.35) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const fl = 0.8 + 0.2 * Math.sin(t * 5.3);
      glow(c, x + cv.dir * 26 * sc, y - 40 * sc, 16 * sc + 4, [255, 176, 80], 0.5 * P.n * fl);
      c.restore();
    }
  }
}
 
// ---------------------------------------------------------------------------
// ruin + the magic lamp
// ---------------------------------------------------------------------------
function drawRuin(c, rx, ry, S, P, ld) {
  const RS = S * 0.8;
  const n = P.n;
  const col = mixC(mixC(P.d[3], [40, 24, 40], 0.25), [6, 6, 20], 0.35 * n);
 
  c.save();
  c.translate(rx, ry);
  c.scale(RS, RS);
  c.fillStyle = rgb(col);
  c.strokeStyle = rgb(col);
 
  c.beginPath();
  c.ellipse(0, 2, 48, 6, 0, 0, TAU);
  c.fill();
 
  // columns + broken arch
  c.fillRect(-30, -54, 9, 54);
  c.fillRect(-32, -58, 13, 5);
  c.beginPath();
  c.moveTo(18, 0);
  c.lineTo(18, -34);
  c.lineTo(21, -38);
  c.lineTo(24, -33);
  c.lineTo(27, -36);
  c.lineTo(27, 0);
  c.closePath();
  c.fill();
  c.lineWidth = 7;
  c.lineCap = 'butt';
  c.beginPath();
  c.arc(-4, -52, 26, Math.PI, Math.PI * 1.55);
  c.stroke();
 
  // fallen stones + pedestal
  c.save();
  c.translate(8, -2);
  c.rotate(0.12);
  c.fillRect(-9, -5, 16, 6);
  c.restore();
  c.fillRect(-12, -8, 16, 8);
 
  // obelisk
  c.beginPath();
  c.moveTo(34, 0);
  c.lineTo(35, -46);
  c.lineTo(37.5, -54);
  c.lineTo(40, -46);
  c.lineTo(41, 0);
  c.closePath();
  c.fill();
 
  // rim light on the column
  c.fillStyle = rgb(P.rim, 0.3);
  c.fillRect(ld > 0 ? -22.2 : -30, -54, 1.4, 54);
 
  // the lamp (brass)
  const brass = mixC([206, 156, 64], col, n * 0.55);
  c.fillStyle = rgb(brass);
  c.strokeStyle = rgb(brass);
  c.beginPath();
  c.ellipse(-4, -11.5, 6, 3.4, 0, 0, TAU);
  c.fill();
  c.fillRect(-6.5, -9, 5, 1.6);
  c.beginPath();
  c.ellipse(-4, -14.6, 2.2, 1.2, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(-4, -16.2, 0.9, 0, TAU);
  c.fill();
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(1, -12);
  c.quadraticCurveTo(7, -11, 10, -18);
  c.stroke();
  c.lineWidth = 1.3;
  c.beginPath();
  c.arc(-10, -12, 3, Math.PI * 0.5, Math.PI * 1.5);
  c.stroke();
 
  c.restore();
}
 
function drawRuinMagic(c, rx, ry, S, P, t, nVis) {
  const RS = S * 0.8;
  const tipX = rx + 10 * RS;
  const tipY = ry - 18 * RS;
 
  const PER = 23;
  const DUR = 13.5;
  const k = Math.floor(t / PER);
  const local = t - k * PER;
  const on = hash(k * 2.37 + 0.3) > 0.2 && local < DUR;
 
  c.save();
  c.globalCompositeOperation = 'lighter';
 
  // lamp always glows faintly at night
  const idle = nVis * (0.28 + 0.12 * Math.sin(t * 3.1) + 0.06 * Math.sin(t * 7.7));
  glow(c, rx - 4 * RS, ry - 11 * RS, 16 * S, [255, 176, 80], idle * 0.55);
 
  if (!on || nVis < 0.05) {
    c.restore();
    return;
  }
 
  const ign = smooth(local / 2);
  const fade = 1 - smooth((local - 10.2) / 3.2);
  const env = ign * fade * nVis;
 
  glow(c, tipX, tipY, 36 * S, [255, 200, 100], 0.6 * env);
 
  // rune ring on the sand
  if (env > 0.02) {
    c.strokeStyle = rgb([255, 214, 130], env * 0.5);
    c.lineWidth = 1.1 * S;
    c.beginPath();
    c.ellipse(rx, ry + 1 * S, 38 * S, 7 * S, 0, 0, TAU);
    c.stroke();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + t * 0.4;
      const px = rx + Math.cos(a) * 38 * S;
      const py = ry + 1 * S + Math.sin(a) * 7 * S;
      c.fillStyle = rgb([255, 226, 150], env * (0.4 + 0.4 * Math.sin(t * 3 + i)));
      c.fillRect(px - 1 * S, py - 1 * S, 2 * S, 2 * S);
    }
  }
 
  // rising spiral of golden particles
  const H = 175 * S;
  const merge = smooth((local - 8.6) / 2.6);
  const alive = 1 - smooth((local - 11) / 2.5);
  for (let i = 0; i < 58; i++) {
    const age = local - (1.6 + i * 0.105);
    const u = age / 4.8;
    if (u <= 0 || u >= 1) continue;
    const rad =
      (5 + 40 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.8)) *
      S *
      (1 - 0.55 * merge);
    const th = u * TAU * 2.3 + i * 0.93 + local * 0.9;
    const x = tipX + Math.cos(th) * rad + u * 18 * S;
    const y = tipY - H * Math.pow(u, 0.82);
    const depth = 0.5 + 0.5 * Math.sin(th);
    const a = Math.pow(Math.sin(Math.PI * u), 0.7) * nVis * alive;
    const s = (0.9 + 1.1 * depth) * S;
    c.fillStyle = rgb([255, 205, 110], a * 0.22);
    c.beginPath();
    c.arc(x, y, s * 3.4, 0, TAU);
    c.fill();
    c.fillStyle = rgb([255, 236, 170], a * (0.5 + 0.5 * depth));
    c.beginPath();
    c.arc(x, y, s, 0, TAU);
    c.fill();
  }
 
  // the brief swirl: a luminous ribbon spiral
  if (local > 6.5 && local < 13) {
    const p = smooth((local - 6.5) / 2) * alive * nVis;
    c.strokeStyle = rgb([255, 214, 130], 0.4 * p);
    c.lineWidth = 1.2 * S;
    c.beginPath();
    for (let q = 0; q <= 40; q++) {
      const v = q / 40;
      const ang = v * TAU * 3 + local * 1.3;
      const r = (6 + 34 * Math.sin(Math.PI * v)) * S * (1 - 0.3 * merge);
      const x = tipX + Math.cos(ang) * r + 10 * S;
      const y = tipY - H * 0.3 - v * H * 0.62;
      if (q === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
 
  // closing flash ring
  if (local > 10 && local < 11.8) {
    const p = (local - 10) / 1.8;
    const a = Math.sin(Math.PI * p) * nVis;
    c.strokeStyle = rgb([255, 226, 150], 0.5 * a);
    c.lineWidth = 1.5 * S;
    c.beginPath();
    c.ellipse(tipX + 12 * S, tipY - H * 0.9, (20 + p * 50) * S, (5 + p * 12) * S, 0, 0, TAU);
    c.stroke();
    glow(c, tipX + 12 * S, tipY - H * 0.9, 40 * S, [255, 214, 130], 0.5 * a);
  }
 
  c.restore();
}
 
function drawSpiritTrail(c, w, h, e, t, P, S) {
  const vis = clamp((P.n - 0.5) / 0.35);
  if (vis < 0.02) return;
  const PER = 19;
  const DUR = 7.5;
  const tt = t + 6;
  const k = Math.floor(tt / PER);
  const local = tt - k * PER;
  if (local > DUR || hash(k * 7.7 + 0.2) < 0.2) return;
  const dir = hash(k * 3.1) > 0.5 ? 1 : -1;
  const p = local / DUR;
  const edge = smooth(p / 0.12) * smooth((1 - p) / 0.12);
 
  const pos = (pp) => {
    const x = (dir > 0 ? lerp(-0.05, 1.05, pp) : lerp(1.05, -0.05, pp)) * w;
    const y = ridge(2, x, e) - (26 + 10 * Math.sin(pp * TAU * 2.5)) * S;
    return [x, y];
  };
 
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let q = 0; q < 34; q++) {
    const pp = p - q * 0.0065;
    if (pp < 0) break;
    const [x, y] = pos(pp);
    const a = Math.pow(1 - q / 34, 1.6) * vis * edge;
    const jx = Math.sin(q * 2.1 + t * 3) * 3 * S;
    const jy = Math.cos(q * 1.7 + t * 2.4) * 3 * S;
    c.fillStyle = rgb([255, 214, 130], a * 0.5);
    c.beginPath();
    c.arc(x + jx, y + jy, (3.4 * (1 - q / 34) + 0.6) * S, 0, TAU);
    c.fill();
  }
  const [hx, hy] = pos(p);
  glow(c, hx, hy, 22 * S, [255, 215, 130], 0.6 * vis * edge);
  c.fillStyle = rgb([255, 244, 200], vis * edge);
  c.beginPath();
  c.arc(hx, hy, 2.2 * S, 0, TAU);
  c.fill();
  c.restore();
}
 
// ---------------------------------------------------------------------------
// palms + oasis
// ---------------------------------------------------------------------------
function drawPalm(c, x, y, sc, P, t, ph, g, lean) {
  const n = P.n;
  const leaf = mixC(mixC([46, 96, 66], P.d[4], 0.15 + 0.75 * n), P.d[3], P.warm * 0.25);
  const leafLight = mixC(leaf, P.rim, 0.14 * (1 - n) + 0.08);
  const trunk = mixC([84, 56, 44], P.d[4], 0.3 + 0.6 * n);
  const sway = Math.sin(t * 0.8 + ph) * (0.03 + 0.04 * g) + g * 0.02;
  const th = 150 * sc;
  const tx = lean * 55 * sc;
  const cx = tx * 0.15 - lean * 10 * sc;
  const cy = -th * 0.55;
 
  c.save();
  c.translate(x, y);
  c.rotate(sway * 0.5);
  c.lineCap = 'round';
 
  // trunk: tapered, ringed
  let px = 0;
  let py = 0;
  const seg = 12;
  for (let k = 1; k <= seg; k++) {
    const u = k / seg;
    const qx = 2 * (1 - u) * u * cx + u * u * tx;
    const qy = 2 * (1 - u) * u * cy + u * u * -th;
    c.strokeStyle = rgb(mixC(trunk, [0, 0, 0], k % 2 ? 0.1 : 0));
    c.lineWidth = lerp(9, 5, u) * sc;
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(qx, qy);
    c.stroke();
    px = qx;
    py = qy;
  }
 
  // crown
  c.translate(tx, -th);
  c.rotate(sway * 0.6);
  c.fillStyle = rgb(mixC(trunk, [0, 0, 0], 0.3));
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.arc((k - 1) * 3 * sc, 3 * sc, 2.4 * sc, 0, TAU);
    c.fill();
  }
 
  const nF = 11;
  for (let pass = 0; pass < 2; pass++) {
    c.strokeStyle = rgb(pass ? leafLight : leaf);
    c.lineWidth = 2.2 * sc;
    c.beginPath();
    for (let i = 0; i < nF; i++) {
      if (i % 2 !== pass) continue;
      const ang = -Math.PI + (i / (nF - 1)) * Math.PI;
      const lat = Math.abs(Math.cos(ang));
      const len = (62 + hash(i * 3.7 + ph) * 14) * sc * (lat > 0.85 ? 1.1 : 1);
      const fl = Math.sin(t * 1.6 + i + ph) * (2 + 6 * g) * sc;
      const tipx = Math.cos(ang) * len * 0.95 + fl;
      const tipy = Math.sin(ang) * len * 0.55 + len * (0.28 + 0.35 * lat) + fl * 0.4;
      const ccx = Math.cos(ang) * len * 0.55;
      const ccy = Math.sin(ang) * len - len * 0.05;
      c.moveTo(0, 0);
      c.quadraticCurveTo(ccx, ccy, tipx, tipy);
      for (let j = 1; j <= 11; j++) {
        const u = j / 12;
        const qx = 2 * (1 - u) * u * ccx + u * u * tipx;
        const qy = 2 * (1 - u) * u * ccy + u * u * tipy;
        let dx = 2 * (1 - u) * ccx + 2 * u * (tipx - ccx);
        let dy = 2 * (1 - u) * ccy + 2 * u * (tipy - ccy);
        const dl = Math.hypot(dx, dy) || 1;
        dx /= dl;
        dy /= dl;
        const ll = 13 * sc * Math.sin(Math.PI * u * 0.9 + 0.2);
        for (const sd of [-1, 1]) {
          const lx = dx * 0.55 + -dy * 0.8 * sd;
          const ly = dy * 0.55 + dx * 0.8 * sd + 0.35;
          c.moveTo(qx, qy);
          c.lineTo(qx + lx * ll, qy + ly * ll);
        }
      }
    }
    c.stroke();
  }
  c.restore();
}
 
function drawOasis(c, w, h, P, S, t) {
  const px = w * 0.165;
  const py = h * 0.905;
  const rx = 120 * S;
  const ry = 15 * S;
  const n = P.n;
 
  // shore
  c.fillStyle = rgb(mixC(P.d[3], P.rim, 0.12));
  c.beginPath();
  c.ellipse(px, py + 2 * S, rx + 8 * S, ry + 4 * S, 0, 0, TAU);
  c.fill();
 
  // water reflects the sky
  const g = c.createLinearGradient(0, py - ry, 0, py + ry);
  g.addColorStop(0, rgb(mixC(P.hor, P.mid, 0.3)));
  g.addColorStop(1, rgb(mixC(P.mid, P.top, 0.5)));
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(px, py, rx, ry, 0, 0, TAU);
  c.fill();
 
  // shimmer
  c.save();
  c.beginPath();
  c.ellipse(px, py, rx, ry, 0, 0, TAU);
  c.clip();
  const col = n > 0.5 ? [190, 205, 255] : [255, 235, 190];
  for (let i = 0; i < 9; i++) {
    const fx = px + (hash(i * 4.1) - 0.5) * rx * 1.6;
    const fy = py + (hash(i * 7.7) - 0.5) * ry * 1.4;
    const a = (0.25 + 0.25 * Math.sin(t * 1.3 + i * 2.1)) * 0.6;
    c.strokeStyle = rgb(col, a);
    c.lineWidth = 1 * S;
    c.beginPath();
    c.moveTo(fx - 8 * S, fy);
    c.lineTo(fx + 8 * S, fy);
    c.stroke();
  }
  c.restore();
 
  // reeds
  c.strokeStyle = rgb(mixC([46, 96, 66], P.d[4], 0.2 + 0.7 * n));
  c.lineWidth = 1.2 * S;
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (0.05 + (i / 15) * 0.9);
    const bx = px + Math.cos(a) * (rx + 4 * S) * -1;
    const by = py + Math.sin(a) * (ry + 2 * S);
    const hh = (8 + hash(i * 5.3) * 8) * S;
    const sw = Math.sin(t * 1.2 + i) * 1.5 * S;
    c.beginPath();
    c.moveTo(bx, by);
    c.quadraticCurveTo(bx + sw * 0.5, by - hh * 0.6, bx + sw, by - hh);
    c.stroke();
  }
}
 
const PALMS_MID = [
  { x: 0.115, L: 1, s: 0.3, lean: -0.4, ph: 1 },
  { x: 0.175, L: 1, s: 0.36, lean: 0.3, ph: 2 },
  { x: 0.86, L: 1, s: 0.32, lean: 0.4, ph: 3 },
  { x: 0.915, L: 1, s: 0.27, lean: -0.2, ph: 4 },
  { x: 0.7, L: 2, s: 0.42, lean: 0.3, ph: 5 },
  { x: 0.76, L: 2, s: 0.34, lean: -0.3, ph: 6 }
];
 
const PALMS_FRONT = [
  { x: 0.045, s: 1.2, lean: 0.3, ph: 0.3 },
  { x: 0.1, s: 0.9, lean: -0.3, ph: 1.7 },
  { x: 0.235, s: 0.8, lean: 0.4, ph: 2.9 },
  { x: 0.275, s: 1.0, lean: -0.15, ph: 4.1 },
  { x: 0.835, s: 0.85, lean: 0.35, ph: 5.2 },
  { x: 0.895, s: 1.2, lean: -0.25, ph: 6.3 },
  { x: 0.955, s: 0.95, lean: 0.3, ph: 7.4 }
];
 
function drawMidPalms(c, w, e, P, S, t, g, layer) {
  for (const p of PALMS_MID) {
    if (p.L !== layer) continue;
    const x = p.x * w;
    drawPalm(c, x, ridge(layer, x, e) + 4 * S, p.s * S * 0.9, P, t, p.ph, g, p.lean);
  }
}
 
// ---------------------------------------------------------------------------
// foreground atmosphere
// ---------------------------------------------------------------------------
function gustAt(t) {
  const a = Math.max(0, Math.sin((t * TAU) / 17 + 1.3));
  const b = Math.max(0, Math.sin((t * TAU) / 31 + 0.4));
  return Math.pow(a, 6) * 0.8 + Math.pow(b, 10) * 0.6;
}
 
function drawSand(c, w, h, st, e, P, S, t, g) {
  const sand = P.n > 0.5 ? P.rim : mixC([255, 224, 170], P.rim, 0.4);
 
  // translucent sheets of blowing sand during gusts
  if (g > 0.05) {
    c.save();
    for (let k = 0; k < 3; k++) {
      const y = h * (0.8 + k * 0.06);
      const span = w * 1.6;
      const x = ((st.wind * 0.6 + k * w * 0.4) % span) - w * 0.3;
      const gr = c.createLinearGradient(x, 0, x + w * 0.6, 0);
      gr.addColorStop(0, rgb(sand, 0));
      gr.addColorStop(0.5, rgb(sand, 0.1 * g));
      gr.addColorStop(1, rgb(sand, 0));
      c.fillStyle = gr;
      c.fillRect(x, y, w * 0.6, 40 * S);
    }
    c.restore();
 
    // spindrift off the crests
    c.strokeStyle = rgb(sand, 0.25 * g);
    c.lineWidth = 1 * S;
    c.beginPath();
    for (let i = 0; i < 14; i++) {
      const x = (hash(i * 5.3) * w + st.wind * 0.4) % w;
      const y = ridge(3, x, e) - hash(i * 2.2) * 4 * S;
      const len = (20 + hash(i * 9.1) * 40) * S * (0.5 + g);
      c.moveTo(x, y);
      c.lineTo(x + len, y - len * 0.1);
    }
    c.stroke();
  }
 
  // grains
  c.save();
  c.lineCap = 'round';
  for (const p of st.grains) {
    const x = ((p.x * w + st.wind * p.z) % (w + 40)) - 20;
    const y = p.y * h + Math.sin(t * 1.3 + p.ph) * 3 * S;
    const len = (2 + g * 14) * p.z * S;
    c.strokeStyle = rgb(sand, 0.28 * p.z * (0.5 + g));
    c.lineWidth = 1 * S * p.z;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + len, y - len * 0.08);
    c.stroke();
  }
  c.restore();
}
 
function drawMotes(c, w, h, st, t, P, S) {
  const vis = clamp((P.n - 0.3) / 0.5);
  if (vis < 0.02) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const m of st.motes) {
    const life = 11 / m.sp;
    const u = ((t + m.off) / life) % 1;
    const x = m.x * w + Math.sin(t * 0.6 + m.ph + u * 4) * (10 + 14 * u) * S;
    const y = h * m.y - u * h * 0.22;
    const a = vis * Math.sin(u * Math.PI) * 0.8;
    c.fillStyle = `rgba(255,200,100,${a * 0.25})`;
    c.beginPath();
    c.arc(x, y, m.r * S * 4, 0, TAU);
    c.fill();
    c.fillStyle = `rgba(255,232,170,${a})`;
    c.beginPath();
    c.arc(x, y, m.r * S * 0.9, 0, TAU);
    c.fill();
  }
  c.restore();
}
 
function drawVignette(c, w, h, n) {
  const g = c.createRadialGradient(
    w * 0.5, h * 0.46, Math.min(w, h) * 0.18,
    w * 0.5, h * 0.46, Math.max(w, h) * 0.72
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.72, `rgba(8,7,18,${0.05 + n * 0.08})`);
  g.addColorStop(1, `rgba(5,5,12,${0.26 + n * 0.14})`);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}
 
// ---------------------------------------------------------------------------
// scene
// ---------------------------------------------------------------------------
const CARAVANS = {
  far: { layer: 0, sc: 0.3, count: 6, v: 6, dir: -1, off: 0.35, haze: 0.5 },
  near: { layer: 2, sc: 0.82, count: 4, v: 11, dir: 1, off: 0.1, haze: 0.05 }
};
 
export default {
  init,
 
  draw(c, state, t, dt, mood, w, h) {
    if (!state) return;
    state.w = w;
    state.h = h;
 
    const dtS = state.lastT == null ? 0 : clamp(t - state.lastT, 0, 0.1);
    state.lastT = t;
 
    const cyc = ((t % 90) + 90) % 90;
    const P = palAt(cyc);
    const n = P.n;
    const S = clamp(Math.min(w / 1100, h / 700), 0.5, 1.5);
    const e = { w, h, t };
 
    const g = gustAt(t);
    state.wind += dtS * (24 + g * 170) * S;
 
    const sun = sunState(cyc, w, h);
    const moon = moonState(cyc, w, h);
    let lx;
    if (sun) lx = sun.x;
    else if (moon) lx = moon.x;
    else lx = cyc >= 60 ? w * 0.1 : w * 0.9;
    const ld = clamp((lx - w * 0.52) / (w * 0.3), -1, 1);
 
    // ---- sky ----
    drawSky(c, w, h, P);
    drawHorizonGlow(c, w, h, P, cyc);
    const starVis = clamp((n - 0.3) / 0.6);
    drawStars(c, w, h, state, t, starVis);
    drawShootingStars(c, w, h, t, starVis, S);
    drawSun(c, w, h, sun, P, t);
    drawMoon(c, w, h, moon, t);
    drawClouds(c, w, h, state, t, P, S);
    drawBirds(c, w, h, state, t, P, S);
 
    // ---- far world ----
    drawFarCity(c, w, h, state, e, P, S, t);
    drawDune(c, 0, e, P, S);
    drawHeatHaze(c, w, h, P, t);
    drawCaravan(c, w, h, e, CARAVANS.far, t, P, S);
 
    // ---- the kingdom ----
    drawHouses(c, w, h, state, e, P, ld, S, t);
    drawMidPalms(c, w, e, P, S, t, g, 1);
    const cx = w * 0.52;
    drawPalace(c, cx, ridge(1, cx, e) + 4 * S, S * 0.8, P, ld, t);
    for (const s of state.stalls) {
      drawStall(c, s.x * w, ridge(1, s.x * w, e) - 0.5 * S, S, s.acc, P, t, s.ph);
    }
    drawLanternStrings(c, w, h, state, e, P, S, t);
    drawPeople(c, w, h, state, e, P, S, t);
    drawSkyLanterns(c, w, h, state, t, P, S);
 
    drawDune(c, 1, e, P, S);
 
    // ---- desert ----
    drawMidPalms(c, w, e, P, S, t, g, 2);
    drawDune(c, 2, e, P, S);
    drawCaravan(c, w, h, e, CARAVANS.near, t, P, S);
 
    const rx = w * 0.3;
    const ry = ridge(2, rx, e) + 2 * S;
    drawRuin(c, rx, ry, S, P, ld);
    drawRuinMagic(c, rx, ry, S, P, t, clamp((n - 0.3) / 0.5));
    drawSpiritTrail(c, w, h, e, t, P, S);
 
    drawDune(c, 3, e, P, S);
 
    // ---- oasis ----
    drawOasis(c, w, h, P, S, t);
    for (const p of PALMS_FRONT) {
      drawPalm(c, p.x * w, h * 0.94, p.s * S, P, t, p.ph, g, p.lean);
    }
    drawDune(c, 4, e, P, S);
 
    // ---- foreground atmosphere ----
    drawSand(c, w, h, state, e, P, S, t, g);
    drawMotes(c, w, h, state, t, P, S);
    drawVignette(c, w, h, n);
  }
};
 
// src/engine/scenes/worlds/enchanted-forest.js
// ENCHANTED FOREST v2 — "The Door in the Old Tree"
// Canvas 2D, zero dependencies, deterministic (everything is a pure function of t).
//
// Architecture
//   * Static art (sky, forest layers, hero tree, path, foreground) is painted ONCE into
//     offscreen caches (re-built only when the size changes), so the per-frame cost is
//     a handful of drawImage calls + the live "life" layer.
//   * Live layer: moon, clouds, stars, door glow, runes, fireflies, mushrooms, spores,
//     vines, leaves, mist, wildlife and rare magical events.
//   * Wind is one shared signal -> trees (shear sway), vines, grass, mist, leaves, smoke.
//   * A slow "mood" cycle (clear > misty > moonlit > magical > deep night) cross-fades
//     lighting, fog, glow strength and firefly count. Pass mood='misty' etc. to pin one.
//
// Contract: export default { init(w,h), draw(ctx, state, t, dt, mood, w, h) }
 
const TAU = Math.PI * 2;
const PI = Math.PI;
 
/* ============================== math ============================== */
const clamp = (v, a = 0, b = 1) => (v !== v ? a : Math.max(a, Math.min(b, v)));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };
const noise = (x) => { const i = Math.floor(x); return lerp(hash(i), hash(i + 1), smoother(x - i)); };
const mod = (a, n) => ((a % n) + n) % n;
function rng(seed) {                       // seeded PRNG for the cached art
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a).toFixed(3)})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
 
/* ============================== palette ============================== */
// Restrained: forest greens + moonlit teal-blue, magic = emerald / cyan / pale gold.
const COL = {
  emerald: [120, 255, 170],
  cyan: [110, 230, 245],
  gold: [255, 214, 120],
  moon: [214, 236, 232],
  warm: [255, 176, 92],
  smoke: [120, 140, 140],
  white: [255, 255, 255],
};
 
/* ============================== canvases / sprites ============================== */
function mk(w, h) {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return null;
}
function layer(w, h, sc, pad, fn) {
  const cv = mk((w + pad * 2) * sc, h * sc);
  const g = cv.getContext('2d');
  g.scale(sc, sc);
  g.translate(pad, 0);
  g.lineCap = 'round'; g.lineJoin = 'round';
  fn(g);
  return cv;
}
 
const SPR = {};
function glowSprite(rgb) {
  const N = 128, cv = mk(N, N), g = cv.getContext('2d');
  const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, rgba(rgb, 1));
  gr.addColorStop(0.18, rgba(rgb, 0.62));
  gr.addColorStop(0.45, rgba(rgb, 0.2));
  gr.addColorStop(0.75, rgba(rgb, 0.05));
  gr.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  return cv;
}
function spr(name) {
  if (!SPR[name]) {
    if (COL[name]) SPR[name] = glowSprite(COL[name]);
    else if (name === 'mist') SPR[name] = mistSprite();
    else if (name === 'beam') SPR[name] = beamSprite();
    else if (name.startsWith('cloud')) SPR[name] = cloudSprite(+name.slice(5));
  }
  return SPR[name];
}
// additive/normal soft light. rx,ry allow flat pools of light on the ground.
function glow(c, name, x, y, rx, a, ry) {
  if (a <= 0.012 || rx < 0.5) return;
  ry = ry === undefined ? rx : ry;
  c.globalAlpha = a > 1 ? 1 : a;
  c.drawImage(spr(name), x - rx, y - ry, rx * 2, ry * 2);
  c.globalAlpha = 1;
}
function mistSprite() {
  const W = 256, H = 96, cv = mk(W, H), g = cv.getContext('2d'), r = rng(77);
  for (let i = 0; i < 14; i++) {
    const x = W * (0.16 + r() * 0.68), y = H * (0.38 + r() * 0.26), rad = H * (0.32 + r() * 0.26);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad * 1.5);
    gr.addColorStop(0, 'rgba(190,225,214,0.34)'); gr.addColorStop(1, 'rgba(190,225,214,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rad * 1.7, rad, 0, 0, TAU); g.fill();
  }
  return cv;
}
function beamSprite() {
  const W = 64, H = 256, cv = mk(W, H), g = cv.getContext('2d');
  const gx = g.createLinearGradient(0, 0, W, 0);
  gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gx; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0, 0, 0, H);
  gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.12, 'rgba(0,0,0,0.9)'); gy.addColorStop(0.6, 'rgba(0,0,0,0.35)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy; g.fillRect(0, 0, W, H);
  return cv;
}
function cloudSprite(k) {
  const W = 512, H = 150, cv = mk(W, H), g = cv.getContext('2d'), r = rng(900 + k * 31);
  const n = 11 + k * 2;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const x = W * (0.1 + 0.8 * u), arch = Math.sin(u * PI);
    const rad = H * (0.2 + 0.2 * arch + r() * 0.12);
    const y = H * 0.7 - arch * H * 0.22 - r() * H * 0.1;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(78,112,116,0.95)'); gr.addColorStop(0.55, 'rgba(70,104,108,0.45)'); gr.addColorStop(1, 'rgba(66,100,104,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rad * 1.5, rad * 0.95, 0, 0, TAU); g.fill();
  }
  // flatten the base a little so it reads as a cloud bank, not a puff
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0, 0, 0, H);
  gy.addColorStop(0, 'rgba(0,0,0,1)'); gy.addColorStop(0.72, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = gy; g.fillRect(0, 0, W, H);
  return cv;
}
 
/* ============================== runes ============================== */
const GLYPHS = [
  [[[0, -1], [0, 1]], [[-0.7, -0.3], [0, 0.3], [0.7, -0.3]]],
  [[[-0.7, -1], [-0.7, 1], [0.7, 0], [-0.7, -1]]],
  [[[-0.8, 0], [0, -1], [0.8, 0], [0, 1], [-0.8, 0]], [[0, -0.4], [0, 0.4]]],
  [[[-0.7, -1], [0.7, 1]], [[0.7, -1], [-0.7, 1]], [[0, -1], [0, 1]]],
  [[[-0.7, 1], [0, -1], [0.7, 1]], [[-0.4, 0.2], [0.4, 0.2]]],
  [[[0, -1], [0, 1]], [[-0.7, -0.6], [0, 0], [0.7, -0.6]], [[-0.7, 0.2], [0, 0.8], [0.7, 0.2]]],
  [[[-0.8, -0.8], [0.8, -0.8], [0, 1], [-0.8, -0.8]]],
  [[[-0.7, -1], [0.7, -1]], [[0, -1], [0, 1]], [[-0.7, 1], [0.7, 1]]],
];
function glyph(c, gi, x, y, size, rot, a, rgb) {
  if (a <= 0.01) return;
  const G = GLYPHS[gi % GLYPHS.length];
  c.save();
  c.translate(x, y); c.rotate(rot); c.scale(size, size);
  for (let pass = 0; pass < 2; pass++) {
    c.lineWidth = (pass === 0 ? 0.55 : 0.17);
    c.strokeStyle = rgba(rgb, pass === 0 ? a * 0.22 : a * 0.95);
    c.beginPath();
    for (const s of G) { c.moveTo(s[0][0], s[0][1]); for (let i = 1; i < s.length; i++) c.lineTo(s[i][0], s[i][1]); }
    c.stroke();
  }
  c.restore();
}
 
/* ============================== mood / weather ============================== */
const MOODS = ['clear', 'misty', 'moonlit', 'magical', 'deep'];
//                 mist  moon  magic dark  flies
const MOOD_P = [
  [0.55, 1.00, 1.00, 0.00, 1.00],   // clear night
  [2.5, 0.78, 0.9, 0.12, 0.85],   // misty night
  [0.45, 1.55, 0.95, 0.00, 1.00],   // moonlit night
  [0.75, 1.00, 1.75, 0.00, 1.30],   // magical night
  [0.65, 0.55, 0.80, 0.62, 0.38],   // deep night
];
const MOOD_LEN = 38;               // seconds per mood (cross-fade is continuous)
function moodAt(t, forced) {
  let wts;
  if (typeof forced === 'string' && MOODS.indexOf(forced) >= 0) {
    wts = MOODS.map((m) => (m === forced ? 1 : 0));
  } else {
    const x = mod(t / MOOD_LEN + 0.0, MOODS.length);     // starts clear
    wts = MOODS.map((_, i) => {
      let d = Math.abs(x - i); d = Math.min(d, MOODS.length - d);
      return smooth(1 - d / 1.0);
    });
  }
  const sum = wts.reduce((a, b) => a + b, 0) || 1;
  const o = [0, 0, 0, 0, 0];
  wts.forEach((wt, i) => { for (let k = 0; k < 5; k++) o[k] += (MOOD_P[i][k] * wt) / sum; });
  return { mist: o[0], moon: o[1], magic: o[2], dark: o[3], flies: o[4] };
}
 
/* ============================== wind ============================== */
function windAt(t, gust) {
  const base = Math.sin(t * 0.37) * 0.55 + Math.sin(t * 0.91 + 1.7) * 0.22 + Math.sin(t * 0.13 + 0.4) * 0.45;
  return base * (1 + gust * 1.6) + gust * 1.1;
}
 
/* ============================== rare magical events ============================== */
// Deterministic scheduler: time is cut into slots; each slot may contain one event.
const EV_SLOT = 10.5;
const EVENTS = [
  ['runes', 8.0, 0.60], ['swarm', 9.0, 0.55], ['star', 1.6, 0.80], ['owl', 9.5, 0.40],
  ['spores', 6.5, 0.55], ['gust', 6.5, 0.45], ['door', 3.4, 0.55], ['bats', 7.5, 0.28], ['deer', 16, 0.35],
];
function eventsAt(t) {
  const out = {};
  for (const e of EVENTS) out[e[0]] = -1;
  const n0 = Math.floor(t / EV_SLOT);
  for (let k = 0; k < 3; k++) {
    const n = n0 - k;
    if (n < 0) continue;
    let idx;
    if (n === 0) idx = 0;                           // first slot: rune wave, so the first seconds have a moment
    else if (n === 1) idx = 2;                      // then a shooting star
    else {
      if (hash(n * 7.31 + 1.7) > 0.82) continue;    // empty slot
      idx = Math.floor(hash(n * 3.77 + 9.1) * EVENTS.length) % EVENTS.length;
      if (hash(n * 5.13 + 4.2) > EVENTS[idx][2]) continue;
    }
    const [name, dur] = EVENTS[idx];
    const start = n * EV_SLOT + 1.5 + hash(n * 9.9 + 2.2) * 2.5;
    const p = (t - start) / dur;
    if (p >= 0 && p <= 1) out[name] = p;
  }
  return out;
}
const env = (p, a, b) => (p < 0 ? 0 : smooth(p / a) * smooth((1 - p) / b));
 
/* ============================== layout ============================== */
function makeLayout(w, h) {
  const asp = w / h;
  const narrow = asp < 0.85;
  const S = Math.min(w * 1.05, h);                  // central scale
  const cx = w * 0.5;
  const gy = h * (narrow ? 0.665 : 0.71);          // tree base
  const forkY = h * (narrow ? 0.385 : 0.315);
  const bw = S * 0.215;                              // trunk half-width at base
  const Dw = bw * 0.7;                             // door width
  const Dh = Dw * 1.78;
  const stepH = S * 0.0155;
  const L = { w, h, asp, narrow, S, cx, gy, forkY, bw, Dw, Dh, stepH };
  L.doorBottom = gy - bw * 0.05;
  L.doorTop = L.doorBottom - Dh;
  L.archR = Dw / 2;
  L.archY = L.doorTop + L.archR;
  L.doorCy = (L.doorTop + L.doorBottom) / 2;
  L.y0 = gy + stepH * 5.2;                          // path start (far end)
  L.yb = h * 1.03;                                  // path end (viewer)
  L.pw0 = Dw * 0.95;
  L.pw1 = Math.min(S * 0.30, w * 0.32);
  L.moon = {
    x: narrow ? cx + w * 0.2 : cx + S * 0.46,
    y: h * (narrow ? 0.14 : 0.165),
    r: narrow ? w * 0.115 : S * 0.092,
  };
  // path as function of q (0 far -> 1 near)
  L.path = (q) => {
    const y = L.y0 + (L.yb - L.y0) * q;
    const half = L.pw0 + (L.pw1 - L.pw0) * q;
    const amp = S * (narrow ? 0.19 : 0.17);
    const x = cx + amp * q * Math.sin(q * 5.0 + 0.5);
    return { x, y, half };
  };
  L.qAtY = (y) => clamp((y - L.y0) / (L.yb - L.y0));
  L.hz = h * 0.60;                                   // ground horizon
  return L;
}
 
/* ================================================================ */
/* STATIC ART HELPERS                                               */
/* ================================================================ */
const bez = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };
 
// tapered, curved limb/root. lit = {mx,my,a} adds moonlit rim on the side facing the moon.
function taper(c, x0, y0, x1, y1, x2, y2, x3, y3, w0, w1, fill, lit) {
  const N = 14, Lp = [], Rp = [], Cp = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, v = 1 - u;
    const x = bez(x0, x1, x2, x3, u), y = bez(y0, y1, y2, y3, u);
    let dx = 3 * (v * v * (x1 - x0) + 2 * v * u * (x2 - x1) + u * u * (x3 - x2));
    let dy = 3 * (v * v * (y1 - y0) + 2 * v * u * (y2 - y1) + u * u * (y3 - y2));
    const ln = Math.hypot(dx, dy) || 1; dx /= ln; dy /= ln;
    const nx = -dy, ny = dx, wd = lerp(w0, w1, Math.pow(u, 0.9)) * 0.5;
    Lp.push([x + nx * wd, y + ny * wd]); Rp.push([x - nx * wd, y - ny * wd]);
    Cp.push([x, y, nx, ny, wd]);
  }
  c.fillStyle = fill;
  c.beginPath(); c.moveTo(Lp[0][0], Lp[0][1]);
  for (let i = 1; i <= N; i++) c.lineTo(Lp[i][0], Lp[i][1]);
  for (let i = N; i >= 0; i--) c.lineTo(Rp[i][0], Rp[i][1]);
  c.closePath(); c.fill();
  if (lit && w0 > 3) {
    c.strokeStyle = rgba(lit.col || [150, 225, 215], lit.a);
    c.lineWidth = Math.max(0.8, (w0 + w1) * 0.5 * 0.12);
    c.beginPath();
    for (let i = 0; i <= N; i++) {
      const [x, y, nx, ny, wd] = Cp[i];
      let dx = lit.mx - x, dy = lit.my - y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const s = clamp((nx * dx + ny * dy) * 3, -1, 1);
      const px = x + nx * s * wd * 0.8, py = y + ny * s * wd * 0.8;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
  }
  return Cp;
}
 
// a puff of leaves. light = unit vector toward the moon.
function leaves(c, r, x, y, rad, n, dark, litc, light, sz) {
  sz = sz || 1;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * rad;
    const px = x + Math.cos(a) * d * 1.2, py = y + Math.sin(a) * d * 0.82;
    const lx = (px - x) / rad, ly = (py - y) / rad;
    const lt = clamp(lx * light[0] + ly * light[1]);
    const isLit = r() < lt * 0.55 + 0.04;
    const base = isLit ? litc : dark;
    const j = 0.75 + r() * 0.5;
    c.fillStyle = rgba([base[0] * j, base[1] * j, base[2] * j], isLit ? 0.55 + r() * 0.4 : 0.8 + r() * 0.2);
    const len = rad * (0.048 + r() * 0.05) * sz;
    c.beginPath(); c.ellipse(px, py, len, len * 0.42, r() * PI, 0, TAU); c.fill();
  }
}
function clump(c, r, x, y, rad, dark, litc, light, density) {
  // solid mass with ragged edge, then leaves on top: leaves gaps still let the moon through
  const g = c.createRadialGradient(x, y, 0, x, y, rad * 1.1);
  g.addColorStop(0, rgba(dark, 0.95)); g.addColorStop(0.7, rgba(dark, 0.8)); g.addColorStop(1, rgba(dark, 0));
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rad * 1.05, rad * 0.8, 0, 0, TAU); c.fill();
  leaves(c, r, x, y, rad, Math.max(10, Math.round(rad * (density || 1.8) * 1.5)), dark, litc, light);
}
function pine(c, x, base, height, width, fill) {
  c.fillStyle = fill; c.beginPath(); c.moveTo(x, base - height);
  const tiers = 6;
  for (let i = 1; i <= tiers; i++) {
    const u = i / tiers, yy = base - height * (1 - u * 0.96), wd = width * (0.12 + u * 0.88);
    c.lineTo(x - wd * 0.55, yy - height * 0.015); c.lineTo(x - wd, yy + height * 0.02);
    c.lineTo(x - wd * 0.62, yy + height * 0.012);
  }
  c.lineTo(x - width * 0.2, base); c.lineTo(x + width * 0.2, base);
  for (let i = tiers; i >= 1; i--) {
    const u = i / tiers, yy = base - height * (1 - u * 0.96), wd = width * (0.12 + u * 0.88);
    c.lineTo(x + wd * 0.62, yy + height * 0.012); c.lineTo(x + wd, yy + height * 0.02); c.lineTo(x + wd * 0.55, yy - height * 0.015);
  }
  c.closePath(); c.fill();
}
const lightDir = (L, x, y) => { const dx = L.moon.x - x, dy = L.moon.y - y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
function archPath(c, cx, archY, R, bottom) {
  c.beginPath(); c.moveTo(cx - R, bottom); c.lineTo(cx - R, archY); c.arc(cx, archY, R, PI, 0); c.lineTo(cx + R, bottom); c.closePath();
}
 
/* ================================================================ */
/* SKY + DISTANT WORLD (static)                                     */
/* ================================================================ */
function paintSky(c, L) {
  const { w, h, S } = L;
  const g = c.createLinearGradient(0, 0, 0, h * 0.62);
  g.addColorStop(0, '#03070f'); g.addColorStop(0.32, '#07141d'); g.addColorStop(0.62, '#0f2b33'); g.addColorStop(0.88, '#1b4543'); g.addColorStop(1, '#27564f');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // cool wash around the moon
  const mg = c.createRadialGradient(L.moon.x, L.moon.y, 0, L.moon.x, L.moon.y, S * 0.95);
  mg.addColorStop(0, 'rgba(70,130,135,0.34)'); mg.addColorStop(0.5, 'rgba(40,90,98,0.14)'); mg.addColorStop(1, 'rgba(30,70,80,0)');
  c.fillStyle = mg; c.fillRect(0, 0, w, h);
  // horizon glow behind the tree
  const hg = c.createRadialGradient(L.cx, h * 0.58, 0, L.cx, h * 0.58, w * 0.6);
  hg.addColorStop(0, 'rgba(70,150,125,0.22)'); hg.addColorStop(1, 'rgba(70,150,125,0)');
  c.fillStyle = hg; c.fillRect(0, h * 0.2, w, h * 0.5);
 
  // three mountain ridges with atmospheric perspective
  const ridges = [
    { y: 0.50, amp: 0.085, col: [38, 82, 82], a: 0.62, f: 0.011, seed: 3 },
    { y: 0.535, amp: 0.065, col: [22, 56, 56], a: 0.78, f: 0.017, seed: 11 },
    { y: 0.565, amp: 0.05, col: [12, 34, 34], a: 0.92, f: 0.024, seed: 23 },
  ];
  ridges.forEach((rg, li) => {
    const pts = [];
    for (let x = -10; x <= w + 10; x += 6) {
      const n = noise(x * rg.f * (900 / S) + rg.seed) * 0.7 + noise(x * rg.f * 3.1 * (900 / S) + rg.seed * 2) * 0.3;
      pts.push([x, h * rg.y - n * h * rg.amp]);
    }
    const gr = c.createLinearGradient(0, h * (rg.y - rg.amp), 0, h * (rg.y + 0.1));
    gr.addColorStop(0, rgba(mixc(rg.col, [60, 110, 105], 0.35), rg.a)); gr.addColorStop(1, rgba(rg.col, rg.a));
    c.fillStyle = gr; c.beginPath(); c.moveTo(-10, h);
    pts.forEach((p) => c.lineTo(p[0], p[1])); c.lineTo(w + 10, h); c.closePath(); c.fill();
    if (li < 2) {            // tiny trees along the ridge
      const r = rng(50 + li); c.fillStyle = rgba(mixc(rg.col, [0, 8, 8], 0.5), rg.a);
      for (let i = 0; i < pts.length; i += 1) {
        if (r() < 0.55) continue; const p = pts[i]; const th = h * (0.012 + r() * 0.014);
        c.beginPath(); c.moveTo(p[0], p[1] - th); c.lineTo(p[0] - th * 0.3, p[1] + 2); c.lineTo(p[0] + th * 0.3, p[1] + 2); c.fill();
      }
    }
    // haze between ridges
    const hz = c.createLinearGradient(0, h * rg.y - h * 0.03, 0, h * (rg.y + 0.07));
    hz.addColorStop(0, 'rgba(90,150,140,0)'); hz.addColorStop(1, 'rgba(90,150,140,0.10)');
    c.fillStyle = hz; c.fillRect(0, h * rg.y - h * 0.03, w, h * 0.1);
  });
 
  // the distant hill with the tiny cottage
  const hx = L.narrow ? w * 0.2 : w * 0.3, hy = h * 0.575, hw = S * (L.narrow ? 0.42 : 0.3);
  c.fillStyle = 'rgba(7,19,17,0.98)';
  c.beginPath(); c.moveTo(hx - hw, h * 0.62); c.quadraticCurveTo(hx - hw * 0.4, hy - h * 0.004, hx, hy);
  c.quadraticCurveTo(hx + hw * 0.5, hy + h * 0.002, hx + hw, h * 0.62); c.closePath(); c.fill();
  const u = S * 0.026, cx0 = hx + hw * 0.1, by = hy + 1;
  c.fillStyle = 'rgba(3,9,8,1)';
  c.fillRect(cx0 - u, by - u * 0.9, u * 2, u * 0.9);                          // walls
  c.beginPath(); c.moveTo(cx0 - u * 1.3, by - u * 0.85); c.lineTo(cx0 - u * 0.1, by - u * 1.85); // crooked roof
  c.lineTo(cx0 + u * 0.35, by - u * 1.78); c.lineTo(cx0 + u * 1.35, by - u * 0.8); c.closePath(); c.fill();
  c.fillRect(cx0 + u * 0.5, by - u * 2.05, u * 0.34, u * 0.8);                 // chimney
  L.cottage = { wx: cx0 - u * 0.5, wy: by - u * 0.55, u, chx: cx0 + u * 0.67, chy: by - u * 2.05 };
  c.fillStyle = 'rgba(255,186,100,0.9)'; c.fillRect(L.cottage.wx - u * 0.17, L.cottage.wy - u * 0.17, u * 0.34, u * 0.34);
}
 
/* ================================================================ */
/* FAR PINES (static, swayed)                                       */
/* ================================================================ */
function paintFar(c, L) {
  const { w, h, S } = L, r = rng(31);
  const rows = [
    { base: 0.612, hMin: 0.05, hMax: 0.12, col: [13, 38, 38], a: 0.9, gap: 0.016 },
    { base: 0.635, hMin: 0.07, hMax: 0.16, col: [8, 26, 25], a: 0.97, gap: 0.021 },
  ];
  rows.forEach((row) => {
    for (let x = -20; x < w + 20; x += S * row.gap * (0.7 + r() * 0.6)) {
      const hh = h * (row.hMin + r() * (row.hMax - row.hMin));
      const clearing = Math.abs(x - L.cx) < S * 0.1 ? 0.55 : 1;
      pine(c, x, h * row.base + r() * h * 0.012, hh * clearing, hh * (0.22 + r() * 0.12), rgba(row.col, row.a));
    }
  });
  c.globalCompositeOperation = 'source-atop';
  const hz = c.createLinearGradient(0, h * 0.5, 0, h * 0.66);
  hz.addColorStop(0, 'rgba(60,120,112,0)'); hz.addColorStop(1, 'rgba(60,120,112,0.30)');
  c.fillStyle = hz; c.fillRect(-30, h * 0.5, w + 60, h * 0.2);
  c.globalCompositeOperation = 'source-over';
}
 
/* ================================================================ */
/* GROUND + PATH + SHRINE (static)                                  */
/* ================================================================ */
function paintGround(c, L) {
  const { w, h, S, cx } = L, r = rng(5);
  const top = L.hz;
  c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) c.lineTo(x, top + (noise(x * 0.006 * (900 / S) + 4) - 0.5) * h * 0.03);
  c.lineTo(w, h); c.closePath();
  const g = c.createLinearGradient(0, top, 0, h);
  g.addColorStop(0, '#14332e'); g.addColorStop(0.22, '#0d231f'); g.addColorStop(0.6, '#08160f'); g.addColorStop(1, '#030806');
  c.fillStyle = g; c.fill();
 
  // a pool of moonlight in the clearing
  c.globalCompositeOperation = 'lighter';
  const pg = c.createRadialGradient(cx, L.gy + S * 0.18, 0, cx, L.gy + S * 0.18, S * 0.75);
  pg.addColorStop(0, 'rgba(60,120,105,0.17)'); pg.addColorStop(1, 'rgba(60,120,105,0)');
  c.fillStyle = pg; c.save(); c.translate(0, 0); c.beginPath(); c.rect(0, top, w, h - top); c.clip(); c.fillRect(0, top, w, h - top); c.restore();
  c.globalCompositeOperation = 'source-over';
 
  // mossy ground texture
  for (let i = 0; i < 260; i++) {
    const y = top + r() * (h - top), q = (y - top) / (h - top), x = r() * w;
    const rad = S * (0.01 + q * 0.05) * (0.6 + r());
    const gr = c.createRadialGradient(x, y, 0, x, y, rad);
    const col = r() < 0.7 ? [58, 98, 60] : [30, 78, 74];
    gr.addColorStop(0, rgba(col, 0.2 + q * 0.12)); gr.addColorStop(1, rgba(col, 0));
    c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, rad * 1.8, rad * 0.55, 0, 0, TAU); c.fill();
  }
 
  // ---------- winding path ----------
  const N = 44, Lp = [], Rp = [];
  for (let i = 0; i <= N; i++) {
    const q = i / N, p = L.path(q), j = (noise(i * 0.8 + 2) - 0.5) * p.half * 0.12;
    Lp.push([p.x - p.half + j, p.y]); Rp.push([p.x + p.half - j, p.y]);
  }
  const bed = c.createLinearGradient(0, L.y0, 0, L.yb);
  bed.addColorStop(0, 'rgba(26,44,38,0.95)'); bed.addColorStop(1, 'rgba(10,18,14,0.98)');
  c.fillStyle = bed; c.beginPath(); c.moveTo(Lp[0][0], Lp[0][1]);
  Lp.forEach((p) => c.lineTo(p[0], p[1])); for (let i = N; i >= 0; i--) c.lineTo(Rp[i][0], Rp[i][1]); c.closePath(); c.fill();
  // soft earthy edge
  c.strokeStyle = 'rgba(3,8,6,0.5)'; c.lineWidth = S * 0.012;
  [Lp, Rp].forEach((E) => { c.beginPath(); E.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); });
 
  // moss in the gaps
  for (let i = 0; i < 160; i++) {
    const q = Math.pow(r(), 0.8), p = L.path(q), x = p.x + (r() - 0.5) * 2 * p.half, y = p.y + (r() - 0.5) * 6;
    const rad = p.half * (0.06 + r() * 0.12);
    c.fillStyle = rgba(r() < 0.6 ? [64, 104, 58] : [40, 84, 66], 0.28 + r() * 0.3);
    c.beginPath(); c.ellipse(x, y, rad * 1.5, rad * 0.5, 0, 0, TAU); c.fill();
  }
 
  // individual stones, laid in perspective rows
  const rows = 26, runes = [];
  for (let k = 1; k <= rows; k++) {
    const v = k / rows, q = Math.pow(v, 1.7), q2 = Math.pow((k + 0.9) / rows, 1.7);
    const p = L.path(q), rowH = Math.max(3, (L.path(Math.min(1, q2)).y - p.y) * 0.95);
    const targetW = S * 0.075 * (0.28 + q * 0.95);
    const cols = clamp(Math.round((p.half * 2) / targetW), 2, 8);
    const stoneW = (p.half * 2) / cols;
    for (let ci = 0; ci < cols; ci++) {
      const sx = p.x - p.half + stoneW * (ci + 0.5) + (r() - 0.5) * stoneW * 0.25 + ((k % 2) * stoneW * 0.25);
      if (sx > p.x + p.half + stoneW * 0.2) continue;
      const rx = stoneW * (0.40 + r() * 0.1), ry = Math.max(1.5, rowH * (0.42 + r() * 0.1));
      const sy = p.y + (r() - 0.5) * rowH * 0.2;
      const lum = 34 + r() * 34, tint = r() < 0.3 ? [0, 10, 8] : [0, 6, 0];
      const base = [lum + tint[0], lum * 1.28 + tint[1], lum * 1.2 + tint[2]];
      const nv = 9; c.beginPath();
      for (let i = 0; i < nv; i++) {
        const a = (i / nv) * TAU, jr = 0.8 + r() * 0.3;
        const px = sx + Math.cos(a) * rx * jr, py = sy + Math.sin(a) * ry * jr;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath();
      const sg = c.createLinearGradient(sx, sy - ry, sx, sy + ry);
      sg.addColorStop(0, rgba(mixc(base, [140, 190, 180], 0.28), 1)); sg.addColorStop(1, rgba(mixc(base, [0, 10, 8], 0.5), 1));
      c.fillStyle = sg; c.fill();
      c.strokeStyle = 'rgba(2,6,5,0.55)'; c.lineWidth = Math.max(0.6, ry * 0.14); c.stroke();
      // moonlit upper-right rim = wet sheen
      c.strokeStyle = 'rgba(160,220,215,0.22)'; c.lineWidth = Math.max(0.6, ry * 0.12);
      c.beginPath(); c.ellipse(sx, sy, rx * 0.92, ry * 0.82, 0, -PI * 0.95, -PI * 0.1); c.stroke();
      if (r() < 0.32) {            // moss cap
        c.fillStyle = rgba([76, 118, 62], 0.5); c.beginPath(); c.ellipse(sx + (r() - 0.5) * rx * 0.6, sy - ry * 0.15, rx * 0.5, ry * 0.4, 0, 0, TAU); c.fill();
      }
    }
    if (k === 5 || k === 10 || k === 16 || k === 22) runes.push({ x: p.x, y: p.y, rx: p.half * 0.34, q });
  }
  L.pathRunes = runes;
  // flat slabs under the path runes
  runes.forEach((rn) => {
    c.fillStyle = 'rgba(14,26,22,0.9)'; c.beginPath(); c.ellipse(rn.x, rn.y, rn.rx * 1.12, rn.rx * 0.36, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(120,180,170,0.25)'; c.lineWidth = 1; c.beginPath(); c.ellipse(rn.x, rn.y, rn.rx * 1.12, rn.rx * 0.36, 0, PI, TAU); c.stroke();
  });
 
  // tufts of grass hugging the path edge
  for (let i = 0; i < 90; i++) {
    const q = Math.pow(r(), 0.9), p = L.path(q), side = r() < 0.5 ? -1 : 1;
    const x = p.x + side * (p.half * (1.0 + r() * 0.12)), y = p.y, hh = S * (0.012 + q * 0.03) * (0.7 + r() * 0.6);
    c.strokeStyle = rgba([34 + r() * 40, 70 + r() * 50, 44 + r() * 20], 0.85); c.lineWidth = Math.max(0.8, S * 0.0016 * (0.5 + q));
    for (let b = 0; b < 4; b++) {
      c.beginPath(); c.moveTo(x + (b - 1.5) * hh * 0.18, y);
      c.quadraticCurveTo(x + (b - 1.5) * hh * 0.35 + side * hh * 0.12, y - hh * 0.6, x + (b - 1.5) * hh * 0.6, y - hh * (0.7 + r() * 0.4)); c.stroke();
    }
  }
  paintShrine(c, L, r);
}
 
function paintShrine(c, L, r) {
  const { w, h, S } = L;
  const u = S * (L.narrow ? 0.09 : 0.07);
  const sx = L.narrow ? w * 0.23 : L.cx - S * 0.66, sy = h * (L.narrow ? 0.775 : 0.752);
  const lit = (x, y) => { c.strokeStyle = 'rgba(150,215,205,0.28)'; c.lineWidth = Math.max(1, u * 0.05); };
  c.fillStyle = 'rgba(3,8,6,0.5)'; c.beginPath(); c.ellipse(sx, sy + u * 0.1, u * 2.4, u * 0.38, 0, 0, TAU); c.fill();
  // standing back-stone with an arch top
  c.fillStyle = 'rgba(17,30,27,1)';
  c.beginPath(); c.moveTo(sx - u * 0.62, sy); c.lineTo(sx - u * 0.62, sy - u * 1.9);
  c.quadraticCurveTo(sx, sy - u * 2.7, sx + u * 0.62, sy - u * 1.95); c.lineTo(sx + u * 0.58, sy); c.closePath(); c.fill();
  lit(); c.beginPath(); c.moveTo(sx + u * 0.62, sy - u * 1.95); c.lineTo(sx + u * 0.58, sy); c.stroke();
  c.beginPath(); c.moveTo(sx - u * 0.62, sy - u * 1.9); c.quadraticCurveTo(sx, sy - u * 2.7, sx + u * 0.62, sy - u * 1.95); c.stroke();
  // broken column stump + fallen drum
  c.fillStyle = 'rgba(14,26,23,1)';
  c.beginPath(); c.moveTo(sx - u * 1.9, sy); c.lineTo(sx - u * 1.85, sy - u * 1.0); c.lineTo(sx - u * 1.6, sy - u * 1.18); c.lineTo(sx - u * 1.35, sy - u * 0.9); c.lineTo(sx - u * 1.2, sy); c.closePath(); c.fill();
  c.fillRect(sx + u * 1.1, sy - u * 0.4, u * 1.1, u * 0.4);
  c.fillStyle = 'rgba(20,36,32,1)'; c.beginPath(); c.ellipse(sx + u * 1.1, sy - u * 0.2, u * 0.12, u * 0.2, 0, 0, TAU); c.fill();
  // altar slab
  c.fillStyle = 'rgba(14,26,23,1)'; c.fillRect(sx - u * 0.92, sy - u * 0.62, u * 0.28, u * 0.62); c.fillRect(sx + u * 0.64, sy - u * 0.62, u * 0.28, u * 0.62);
  c.fillStyle = 'rgba(27,46,41,1)'; c.beginPath(); c.moveTo(sx - u * 1.15, sy - u * 0.62); c.lineTo(sx - u * 0.95, sy - u * 0.84); c.lineTo(sx + u * 0.98, sy - u * 0.84); c.lineTo(sx + u * 1.18, sy - u * 0.62); c.closePath(); c.fill();
  c.fillStyle = 'rgba(8,16,14,1)'; c.fillRect(sx - u * 1.15, sy - u * 0.62, u * 2.33, u * 0.14);
  lit(); c.beginPath(); c.moveTo(sx - u * 0.95, sy - u * 0.84); c.lineTo(sx + u * 0.98, sy - u * 0.84); c.stroke();
  // candles (flames are live)
  const cand = [[-0.55, 0.9, 0.36], [0.05, 0.9, 0.5], [0.6, 0.86, 0.3]];
  L.shrine = { x: sx, y: sy, u, rune: { x: sx, y: sy - u * 1.35 }, candles: [] };
  cand.forEach((cd) => {
    const cxx = sx + cd[0] * u, cyy = sy - u * cd[1], hh = u * cd[2];
    c.fillStyle = 'rgba(190,196,170,0.9)'; c.fillRect(cxx - u * 0.05, cyy - hh, u * 0.1, hh);
    c.fillStyle = 'rgba(230,236,210,0.55)'; c.fillRect(cxx - u * 0.05, cyy - hh, u * 0.03, hh);
    L.shrine.candles.push({ x: cxx, y: cyy - hh - u * 0.02, u });
  });
  // moss + hanging vines
  for (let i = 0; i < 14; i++) {
    c.fillStyle = rgba([72, 116, 62], 0.4 + r() * 0.3); const mx = sx + (r() - 0.5) * u * 3.4, my = sy - r() * u * 2.2;
    c.beginPath(); c.ellipse(mx, my, u * (0.1 + r() * 0.2), u * (0.06 + r() * 0.1), 0, 0, TAU); c.fill();
  }
  c.strokeStyle = 'rgba(40,78,52,0.9)'; c.lineWidth = Math.max(1, u * 0.05);
  for (let i = 0; i < 5; i++) {
    const vx = sx - u * 0.6 + i * u * 0.3, vy = sy - u * (1.95 - Math.abs(i - 2) * 0.12);
    c.beginPath(); c.moveTo(vx, vy); c.bezierCurveTo(vx + u * 0.1, vy + u * 0.5, vx - u * 0.1, vy + u * 0.9, vx + u * 0.05, vy + u * (1.0 + r() * 0.7)); c.stroke();
  }
  // ferns at the base
  for (let i = 0; i < 9; i++) {
    const fx = sx + (r() - 0.5) * u * 4.2, a = -PI / 2 + (r() - 0.5) * 1.3, fl = u * (0.4 + r() * 0.5);
    c.strokeStyle = 'rgba(28,62,44,0.95)'; c.lineWidth = Math.max(1, u * 0.04);
    c.beginPath(); c.moveTo(fx, sy); c.quadraticCurveTo(fx + Math.cos(a) * fl * 0.5, sy + Math.sin(a) * fl * 0.5 - fl * 0.2, fx + Math.cos(a) * fl, sy + Math.sin(a) * fl); c.stroke();
  }
}
 
/* ================================================================ */
/* MID FOREST (static, swayed)                                      */
/* ================================================================ */
function paintMid(c, L) {
  const { w, h, S } = L, r = rng(88);
  const bl = c.createRadialGradient(L.cx, L.gy - S * 0.35, 0, L.cx, L.gy - S * 0.35, S * 0.95);
  bl.addColorStop(0, 'rgba(120,200,175,0.16)'); bl.addColorStop(0.5, 'rgba(70,140,125,0.07)'); bl.addColorStop(1, 'rgba(70,140,125,0)');
  c.fillStyle = bl; c.fillRect(-30, 0, w + 60, h);
  const trees = [];
  for (let x = -0.03 * w; x < w * 1.03; x += S * (0.075 + r() * 0.06)) {
    trees.push({ x, base: h * (0.668 + r() * 0.08), hh: h * (0.28 + r() * 0.22), kind: r() < 0.5 ? 0 : 1 });
  }
  if (L.shrine) {                 // a couple of trunks in front of the shrine so it stays half-hidden
    trees.push({ x: L.shrine.x - L.shrine.u * 3.0, base: h * 0.76, hh: h * 0.52, kind: 1, thick: 1.3 });
    trees.push({ x: L.shrine.x + L.shrine.u * 3.4, base: h * 0.75, hh: h * 0.46, kind: 0, thick: 1.1 });
  }
  trees.sort((a, b) => a.base - b.base);
  trees.forEach((t) => {
    const depth = clamp((t.base - h * 0.66) / (h * 0.1));          // 0 far .. 1 near
    const haze = 0.5 - depth * 0.4;
    const dark = mixc([5, 15, 12], [20, 52, 48], haze), litc = mixc([60, 120, 110], [100, 160, 150], haze);
    const tw = S * (0.014 + depth * 0.012) * (t.thick || 1);
    const topY = t.base - t.hh, lean = (r() - 0.5) * S * 0.01;
    // trunk
    taper(c, t.x, t.base + 4, t.x + lean, t.base - t.hh * 0.35, t.x - lean, t.base - t.hh * 0.7, t.x + lean * 0.5, topY + t.hh * 0.18, tw, tw * 0.45, rgba(mixc(dark, [0, 4, 3], 0.35), 1),
      { mx: L.moon.x, my: L.moon.y, a: 0.16 });
    const ld = lightDir(L, t.x, topY);
    if (t.kind === 0) {
      pine(c, t.x + lean * 0.5, topY + t.hh * 0.68, t.hh * 0.68, t.hh * (0.16 + r() * 0.04), rgba(dark, 1));
      c.save(); c.globalCompositeOperation = 'source-atop';
      const gl = c.createLinearGradient(t.x - t.hh * 0.1, 0, t.x + t.hh * 0.18, 0);
      gl.addColorStop(0, 'rgba(0,0,0,0)'); gl.addColorStop(1, rgba(litc, 0.14));
      c.fillStyle = gl; c.fillRect(t.x - t.hh * 0.3, topY, t.hh * 0.6, t.hh); c.restore();
    } else {
      const cr = t.hh * (0.16 + r() * 0.05), n = 4 + ((r() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + r(), d = i === 0 ? 0 : cr * (0.5 + r() * 0.3);
        clump(c, r, t.x + Math.cos(a) * d * 1.1, topY + t.hh * 0.14 + Math.sin(a) * d * 0.55, cr * (0.62 + r() * 0.3), dark, litc, ld, 1.3);
      }
    }
  });
  // low bushes
  for (let x = 0; x < w; x += S * (0.05 + r() * 0.05)) {
    if (Math.abs(x - L.cx) < L.bw * 1.3) continue;
    const y = h * (0.7 + r() * 0.06), depth = clamp((y - h * 0.68) / (h * 0.1));
    clump(c, r, x, y, S * (0.03 + r() * 0.03) * (0.8 + depth * 0.6), mixc([5, 18, 13], [14, 40, 34], 0.5 - depth * 0.3), [70, 130, 115], lightDir(L, x, y), 1.4);
  }
}
 
/* ================================================================ */
/* HERO TREE — trunk, door, steps, roots (static)                   */
/* ================================================================ */
function trunkEdge(L, q) {
  const { cx, gy, forkY, bw } = L;
  const topY = forkY - bw * 0.25, bot = gy + bw * 0.04;
  const y = lerp(bot, topY, q);
  const hw = bw * (1 - 0.40 * Math.pow(q, 0.75)) + bw * 0.5 * Math.pow(1 - q, 7);
  const off = Math.sin(q * 3.2 + 0.6) * bw * 0.07;
  return {
    y, l: cx + off - hw - (noise(q * 11 + 3) - 0.5) * bw * 0.07,
    r: cx + off + hw + (noise(q * 9 + 8) - 0.5) * bw * 0.07, topY, bot,
  };
}
 
function paintHero(c, L) {
  const { cx, gy, forkY, bw, S, Dw, Dh } = L, r = rng(404);
  const R = L.archR, ay = L.archY, db = L.doorBottom;
 
  // ---- standing rune stones beside the tree ----
  L.stones = [];
  [[-2.15, 0.14, 0.95, -0.04, 0], [2.2, 0.18, 0.8, 0.05, 3], [-3.35, 0.46, 0.62, 0.08, 5], [3.5, 0.42, 0.7, -0.06, 1]].forEach((d) => {
    const x = cx + d[0] * bw, y = gy + d[1] * bw, hs = S * 0.1 * d[2], ws = S * 0.036 * d[2];
    c.save(); c.translate(x, y); c.rotate(d[3]);
    c.fillStyle = 'rgba(3,8,6,0.5)'; c.beginPath(); c.ellipse(0, 2, ws * 1.3, ws * 0.26, 0, 0, TAU); c.fill();
    const g = c.createLinearGradient(-ws, 0, ws, 0);
    g.addColorStop(0, '#0a1613'); g.addColorStop(0.6, '#16302c'); g.addColorStop(1, '#2b4f4b');
    c.fillStyle = g; c.beginPath(); c.moveTo(-ws, 0); c.lineTo(-ws * 0.82, -hs * 0.92); c.lineTo(-ws * 0.2, -hs); c.lineTo(ws * 0.35, -hs * 0.93); c.lineTo(ws * 0.86, -hs * 0.8); c.lineTo(ws, 0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(150,215,205,0.3)'; c.lineWidth = Math.max(1, ws * 0.06);
    c.beginPath(); c.moveTo(ws * 0.35, -hs * 0.93); c.lineTo(ws * 0.86, -hs * 0.8); c.lineTo(ws, 0); c.stroke();
    for (let i = 0; i < 5; i++) {            // moss
      c.fillStyle = rgba([76, 120, 62], 0.45); c.beginPath(); c.ellipse((r() - 0.7) * ws, -r() * hs * 0.3, ws * (0.2 + r() * 0.3), ws * 0.12, 0, 0, TAU); c.fill();
    }
    c.restore();
    L.stones.push({ x: x + Math.sin(d[3]) * -hs * 0.55, y: y - hs * 0.55, size: ws * 0.5, glyph: d[4] });
  });
 
  // ---- contact shadow ----
  c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(cx, gy + bw * 0.08, bw * 2.1, bw * 0.3, 0, 0, TAU); c.fill();
 
  // ---- trunk body ----
  const NQ = 44, left = [], right = [];
  for (let i = 0; i <= NQ; i++) { const e = trunkEdge(L, i / NQ); left.push([e.l, e.y]); right.push([e.r, e.y]); }
  const tg = c.createLinearGradient(cx - bw * 1.2, 0, cx + bw * 1.2, 0);
  tg.addColorStop(0, '#030806'); tg.addColorStop(0.3, '#0a1511'); tg.addColorStop(0.55, '#14291f'); tg.addColorStop(0.78, '#224340'); tg.addColorStop(0.92, '#2d5855'); tg.addColorStop(1, '#16302d');
  c.fillStyle = tg; c.beginPath(); c.moveTo(left[0][0], left[0][1]);
  left.forEach((p) => c.lineTo(p[0], p[1])); for (let i = NQ; i >= 0; i--) c.lineTo(right[i][0], right[i][1]); c.closePath(); c.fill();
 
  c.save(); c.clip();
  const topY = trunkEdge(L, 1).y, botY = trunkEdge(L, 0).y;
  c.strokeStyle = 'rgba(150,225,210,0.34)'; c.lineWidth = bw * 0.035; c.beginPath();
  right.forEach((p, i) => (i ? c.lineTo(p[0] - bw * 0.02, p[1]) : c.moveTo(p[0] - bw * 0.02, p[1]))); c.stroke();
  c.strokeStyle = 'rgba(150,225,210,0.12)'; c.lineWidth = bw * 0.02; c.beginPath();
  left.forEach((p, i) => (i ? c.lineTo(p[0] + bw * 0.02, p[1]) : c.moveTo(p[0] + bw * 0.02, p[1]))); c.stroke();
  // bark grooves — they twist slowly as they climb
  for (let g = 0; g < 46; g++) {
    const t0 = 0.03 + r() * 0.94, tw = (r() - 0.5) * 0.22, q0 = r() * 0.7, q1 = Math.min(1, q0 + 0.18 + r() * 0.5);
    const dark = r() < 0.7;
    c.strokeStyle = dark ? rgba([1, 4, 3], 0.3 + r() * 0.35) : rgba([150, 220, 205], 0.05 + t0 * 0.12);
    c.lineWidth = dark ? 1 + r() * 2.8 : 0.8 + r() * 1.1;
    c.beginPath();
    for (let q = q0; q <= q1; q += 0.025) {
      const e = trunkEdge(L, q), tt = t0 + tw * q + Math.sin(q * 9 + g) * 0.022;
      const x = lerp(e.l, e.r, tt) + (dark ? 0 : 1.5);
      q === q0 ? c.moveTo(x, e.y) : c.lineTo(x, e.y);
    }
    c.stroke();
  }
  // knots
  for (let i = 0; i < 6; i++) {
    const e = trunkEdge(L, 0.12 + r() * 0.75), x = lerp(e.l, e.r, 0.15 + r() * 0.7), k = bw * (0.04 + r() * 0.05);
    const kg = c.createRadialGradient(x, e.y, 0, x, e.y, k * 2);
    kg.addColorStop(0, 'rgba(0,3,2,0.7)'); kg.addColorStop(1, 'rgba(0,3,2,0)');
    c.fillStyle = kg; c.beginPath(); c.ellipse(x, e.y, k * 1.4, k * 2, 0, 0, TAU); c.fill();
  }
  // moss: heavy at the base and on the shaded left, drifting up in patches
  for (let i = 0; i < 40; i++) {
    const q = Math.pow(r(), 1.8) * 0.9, e = trunkEdge(L, q), x = lerp(e.l, e.r, Math.pow(r(), 1.5) * 0.9);
    const rad = bw * (0.05 + r() * 0.16), mg = c.createRadialGradient(x, e.y, 0, x, e.y, rad);
    mg.addColorStop(0, 'rgba(84,132,64,0.55)'); mg.addColorStop(0.6, 'rgba(60,104,56,0.28)'); mg.addColorStop(1, 'rgba(60,104,56,0)');
    c.fillStyle = mg; c.beginPath(); c.ellipse(x, e.y, rad * 1.1, rad * 0.8, 0, 0, TAU); c.fill();
    for (let k = 0; k < 7; k++) { c.fillStyle = rgba([150, 190, 100], 0.35 * r()); c.fillRect(x + (r() - 0.5) * rad * 1.8, e.y + (r() - 0.5) * rad, 1.2, 1.2); }
  }
  // darker toward the roots
  const bg = c.createLinearGradient(0, botY, 0, botY - bw * 1.2);
  bg.addColorStop(0, 'rgba(0,3,2,0.7)'); bg.addColorStop(1, 'rgba(0,3,2,0)');
  c.fillStyle = bg; c.fillRect(cx - bw * 2, botY - bw * 1.2, bw * 4, bw * 1.3);
 
  // the face you only notice after a while: two hollows + a brow, high above the door
  const ey = (ay - R * 1.45 + trunkEdge(L, 1).y) * 0.5, ex = bw * 0.3, er = bw * 0.1;
  [-1, 1].forEach((s) => {
    const x = cx + s * ex, eg = c.createRadialGradient(x, ey, 0, x, ey, er * 2.2);
    eg.addColorStop(0, 'rgba(0,2,2,0.62)'); eg.addColorStop(1, 'rgba(0,2,2,0)');
    c.fillStyle = eg; c.beginPath(); c.ellipse(x, ey, er * 2.0, er * 1.05, s * 0.28, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(0,3,2,0.45)'; c.lineWidth = bw * 0.035;
    c.beginPath(); c.moveTo(x - s * er * 2.2, ey - er * 1.0); c.quadraticCurveTo(x, ey - er * 2.1, x + s * er * 1.6, ey - er * 0.7); c.stroke();
    c.strokeStyle = 'rgba(150,220,205,0.07)'; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(x, ey + er * 0.25, er * 1.9, er * 0.9, s * 0.28, 0.2, PI - 0.2); c.stroke();
  });
  L.eyes = { y: ey, dx: ex, r: er };
  c.restore();
 
  // ---- the doorway ----
  const FR = R * 1.4;
  // roots hugging the frame
  for (let i = 0; i < 16; i++) {
    const a = PI + (i / 15) * PI, bx = cx + Math.cos(a) * FR * 0.96, by = ay + Math.sin(a) * FR * 0.96;
    const out = a + (r() - 0.5) * 0.7, len = R * (0.5 + r() * 0.8) * (Math.abs(Math.sin(a)) * 0.5 + 0.6);
    taper(c, bx, by, bx + Math.cos(out) * len * 0.3, by + Math.sin(out) * len * 0.3, bx + Math.cos(out + 0.5) * len * 0.7, by + Math.sin(out + 0.5) * len * 0.7,
      bx + Math.cos(out + 0.3) * len, by + Math.sin(out + 0.3) * len, R * 0.15, R * 0.02, 'rgba(5,11,8,0.95)', { mx: L.moon.x, my: L.moon.y, a: 0.18 });
  }
  // carved frame
  const fg = c.createLinearGradient(cx - FR, 0, cx + FR, 0);
  fg.addColorStop(0, '#0a120e'); fg.addColorStop(0.5, '#16241c'); fg.addColorStop(1, '#223a32');
  c.fillStyle = fg; archPath(c, cx, ay, FR, db + 5); c.fill();
  c.strokeStyle = 'rgba(2,6,5,0.9)'; c.lineWidth = R * 0.07; archPath(c, cx, ay, FR, db + 5); c.stroke();
  c.strokeStyle = 'rgba(140,215,200,0.2)'; c.lineWidth = 1.2; archPath(c, cx, ay, FR * 0.985, db + 5); c.stroke();
  // chiselled band that the runes sit on
  c.strokeStyle = 'rgba(2,7,5,0.55)'; c.lineWidth = R * 0.26; archPath(c, cx, ay, R * 1.22, db + 5); c.stroke();
  c.strokeStyle = 'rgba(100,170,155,0.14)'; c.lineWidth = 1; archPath(c, cx, ay, R * 1.09, db + 5); c.stroke();
  archPath(c, cx, ay, R * 1.35, db + 5); c.stroke();
  // recess
  c.fillStyle = '#010302'; archPath(c, cx, ay, R * 1.04, db + 2); c.fill();
 
  // door body: planks
  c.save(); archPath(c, cx, ay, R, db + 1); c.clip();
  const planks = 5, pw = (2 * R) / planks;
  for (let i = 0; i < planks; i++) {
    const x0 = cx - R + i * pw, lum = 0.85 + r() * 0.3;
    const pg = c.createLinearGradient(0, ay - R, 0, db);
    pg.addColorStop(0, rgba([46 * lum, 31 * lum, 20 * lum])); pg.addColorStop(1, rgba([26 * lum, 18 * lum, 12 * lum]));
    c.fillStyle = pg; c.fillRect(x0, ay - R - 2, pw + 1, Dh + 4);
    c.strokeStyle = 'rgba(8,4,2,0.5)'; c.lineWidth = 0.9;                         // wood grain
    for (let k = 0; k < 4; k++) {
      const gx = x0 + pw * (0.2 + 0.2 * k + r() * 0.1);
      c.beginPath(); c.moveTo(gx, ay - R); c.bezierCurveTo(gx + 2, ay, gx - 2, ay + Dh * 0.4, gx + 1, db); c.stroke();
    }
  }
  // iron bands + rivets
  [0.32, 0.78].forEach((f) => {
    const by = L.doorTop + Dh * f;
    c.fillStyle = 'rgba(12,12,12,0.85)'; c.fillRect(cx - R, by - R * 0.09, R * 2, R * 0.18);
    c.fillStyle = 'rgba(110,115,100,0.55)';
    for (let i = 0; i <= planks; i++) { c.beginPath(); c.arc(cx - R + i * pw, by, R * 0.028, 0, TAU); c.fill(); }
  });
  // carved circular plate for the live sigil
  c.fillStyle = 'rgba(22,15,10,0.7)'; c.beginPath(); c.arc(cx, ay + R * 0.12, R * 0.58, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 1.5; c.stroke();
  // depth: inner shadow
  const sh = c.createLinearGradient(cx - R, 0, cx + R, 0);
  sh.addColorStop(0, 'rgba(0,0,0,0.6)'); sh.addColorStop(0.25, 'rgba(0,0,0,0)'); sh.addColorStop(0.75, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  c.fillStyle = sh; c.fillRect(cx - R, ay - R, R * 2, Dh + R);
  const sv = c.createLinearGradient(0, ay - R, 0, ay);
  sv.addColorStop(0, 'rgba(0,0,0,0.55)'); sv.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sv; c.fillRect(cx - R, ay - R, R * 2, R);
  c.restore();
  // handle (a small bronze ring on a plate)
  const hx = cx + R * 0.56, hy = L.doorTop + Dh * 0.56;
  c.fillStyle = 'rgba(88,74,44,0.95)'; c.beginPath(); c.arc(hx, hy, R * 0.085, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(150,130,80,0.85)'; c.lineWidth = Math.max(1.2, R * 0.045); c.beginPath(); c.arc(hx, hy + R * 0.1, R * 0.11, 0.1, PI - 0.1); c.stroke();
  L.handle = { x: hx, y: hy };
 
  // ---- stone steps leading up to the door ----
  const nSteps = 5, sh2 = (L.y0 - db) / nSteps;
  for (let k = 0; k < nSteps; k++) {
    const yT = db + k * sh2, wd = Dw * (1.36 + 0.17 * k) * 0.5;
    const tread = c.createLinearGradient(0, yT, 0, yT + sh2 * 0.45);
    tread.addColorStop(0, '#496a63'); tread.addColorStop(1, '#2a4540');
    c.fillStyle = tread; c.beginPath(); c.moveTo(cx - wd, yT + sh2 * 0.45); c.lineTo(cx - wd * 0.96, yT); c.lineTo(cx + wd * 0.96, yT); c.lineTo(cx + wd, yT + sh2 * 0.45); c.closePath(); c.fill();
    const riser = c.createLinearGradient(0, yT + sh2 * 0.45, 0, yT + sh2);
    riser.addColorStop(0, '#1b302d'); riser.addColorStop(1, '#0a1513');
    c.fillStyle = riser; c.fillRect(cx - wd, yT + sh2 * 0.45, wd * 2, sh2 * 0.55 + 0.5);
    c.strokeStyle = 'rgba(2,6,5,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - wd, yT + sh2 * 0.45); c.lineTo(cx + wd, yT + sh2 * 0.45); c.stroke();
    c.strokeStyle = 'rgba(170,230,220,0.25)'; c.beginPath(); c.moveTo(cx - wd * 0.96, yT + 0.5); c.lineTo(cx + wd * 0.96, yT + 0.5); c.stroke();
    // cracks + moss
    for (let m = 0; m < 4; m++) {
      c.fillStyle = rgba([84, 130, 66], 0.45); c.beginPath(); c.ellipse(cx + (r() - 0.5) * wd * 1.8, yT + sh2 * 0.3, wd * (0.05 + r() * 0.1), sh2 * 0.14, 0, 0, TAU); c.fill();
    }
    c.strokeStyle = 'rgba(2,6,5,0.5)'; c.beginPath(); const kx = cx + (r() - 0.5) * wd * 1.4; c.moveTo(kx, yT + 1); c.lineTo(kx + (r() - 0.5) * 6, yT + sh2 * 0.5); c.stroke();
  }
  L.steps = { top: db, bottom: L.y0, n: nSteps };
 
  // ---- roots: arching out of the trunk and diving into the earth ----
  const rootCol = '#050c08', litR = { mx: L.moon.x, my: L.moon.y, a: 0.3 };
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 5; i++) {
      const q0 = 0.06 + i * 0.05, e0 = trunkEdge(L, q0), edgeX = s < 0 ? e0.l : e0.r, sx0 = edgeX - s * bw * 0.2, sy0 = e0.y - bw * (0.1 + i * 0.06);
      const reach = bw * (0.38 + i * 0.2 + r() * 0.14), ex = edgeX + s * reach, ey2 = gy + bw * (0.03 + i * 0.045 + r() * 0.05);
      // buttress curve: drops almost vertically along the trunk, then sweeps out along the ground
      taper(c, sx0, sy0, sx0 + s * bw * 0.04, sy0 + (ey2 - sy0) * 0.6, ex - s * reach * 0.5, ey2 - bw * 0.015, ex, ey2, bw * (0.3 - i * 0.03), bw * 0.035, rootCol, litR);
      for (let m = 0; m < 3; m++) {
        const u = 0.3 + r() * 0.5, mx = bez(sx0, sx0 + s * bw * 0.04, ex - s * reach * 0.5, ex, u), my = bez(sy0, sy0 + (ey2 - sy0) * 0.6, ey2 - bw * 0.015, ey2, u) - bw * 0.05;
        c.fillStyle = rgba([66, 108, 54], 0.4); c.beginPath(); c.ellipse(mx, my, bw * (0.03 + r() * 0.04), bw * 0.016, 0, 0, TAU); c.fill();
      }
    }
    // the two roots that frame the stairs, stepping toward the viewer
    const fx = cx + s * bw * 0.72, fy = gy - bw * 0.2, fex = cx + s * bw * 1.35, fey = gy + bw * 0.55;
    taper(c, fx, fy, fx + s * bw * 0.04, fy + (fey - fy) * 0.6, fex - s * bw * 0.35, fey - bw * 0.02, fex, fey, bw * 0.3, bw * 0.05, rootCol, litR);
    for (let m = 0; m < 7; m++) {
      const u = 0.12 + r() * 0.7, mx = bez(fx, fx + s * bw * 0.04, fex - s * bw * 0.35, fex, u), my = bez(fy, fy + (fey - fy) * 0.6, fey - bw * 0.02, fey, u) - bw * 0.06;
      c.fillStyle = rgba([80, 128, 62], 0.5); c.beginPath(); c.ellipse(mx, my, bw * (0.04 + r() * 0.05), bw * 0.024, 0, 0, TAU); c.fill();
    }
  }
 
  // ---- bioluminescent veins + tiny lights (live art reads these) ----
  L.veins = [];
  for (let v = 0; v < 9; v++) {
    let q = 0.12 + r() * 0.8, e = trunkEdge(L, q);
    let x = lerp(e.l, e.r, 0.08 + r() * 0.84), y = e.y; const pts = [[x, y]];
    let ang = -PI / 2 + (r() - 0.5) * 1.6;
    for (let k = 0; k < 7; k++) {
      ang += (r() - 0.5) * 1.1; x += Math.cos(ang) * bw * 0.07; y += Math.sin(ang) * bw * 0.07;
      const ee = trunkEdge(L, clamp((trunkEdge(L, 0).y - y) / (trunkEdge(L, 0).y - trunkEdge(L, 1).y)));
      if (x < ee.l + 4 || x > ee.r - 4) break;
      if (Math.hypot(x - cx, y - L.archY) < FR * 1.15 && y > L.archY - FR * 1.2) break;
      pts.push([x, y]);
    }
    if (pts.length > 2) L.veins.push({ pts, ph: r() * TAU, col: r() < 0.55 ? 'emerald' : 'cyan' });
  }
  L.lights = [];
  for (let i = 0; i < 26; i++) {
    const q = Math.pow(r(), 1.3) * 0.95, e = trunkEdge(L, q), side = r() < 0.5;
    const x = side ? lerp(e.l, e.r, 0.04 + r() * 0.2) : lerp(e.l, e.r, 0.76 + r() * 0.2);
    if (Math.abs(x - cx) < FR * 1.1 && e.y > L.archY - FR) continue;
    L.lights.push({ x, y: e.y, ph: r() * TAU, sp: 0.4 + r() * 1.2, col: ['emerald', 'cyan', 'gold'][(r() * 3) | 0], s: 0.8 + r() * 1.4 });
  }
}
 
/* ================================================================ */
/* HERO CROWN — twisted limbs reaching toward the moon (static)      */
/* ================================================================ */
function paintCrown(c, L) {
  const { cx, forkY, bw, S } = L, r = rng(2024);
  const topY = forkY - bw * 0.25, hwTop = bw * 0.6, tips = [], mids = [];
  const lit = { mx: L.moon.x, my: L.moon.y, a: 0.3 };
  function grow(x, y, ang, len, w, depth) {
    const bend = (r() - 0.5) * 0.9;
    const ea = ang + bend * 0.5, ex = x + Math.cos(ea) * len, ey = y + Math.sin(ea) * len;
    taper(c, x, y, x + Math.cos(ang) * len * 0.35, y + Math.sin(ang) * len * 0.35, x + Math.cos(ang + bend) * len * 0.72, y + Math.sin(ang + bend) * len * 0.72, ex, ey, w, w * 0.62, 'rgba(6,13,10,1)', lit);
    if (depth > 0) {
      mids.push({ x: (x + ex) / 2, y: (y + ey) / 2, w, depth });
      const n = depth >= 2 ? 2 : (r() < 0.5 ? 2 : 3);
      for (let i = 0; i < n; i++) {
        const off = (i / (n - 1) - 0.5) * 2;
        let na = ea + off * (0.42 + r() * 0.3);
        na = lerp(na, -PI / 2, 0.14);
        grow(ex, ey, na, len * (0.66 + r() * 0.14), w * 0.62, depth - 1);
      }
    } else tips.push({ x: ex, y: ey, w: w * 0.6, ang: ea });
  }
  const tgx = L.moon.x - L.moon.r * 0.6, tgy = L.moon.y + L.moon.r * 2.1;
  const mAng = Math.atan2(tgy - topY, tgx - (cx + hwTop * 0.5));
  const mDist = Math.hypot(tgy - topY, tgx - cx);
  const prim = [
    { sx: -0.95, ang: -PI * 0.96, len: 0.50, w: 0.9 }, { sx: -0.6, ang: -PI * 0.82, len: 0.50, w: 0.8 },
    { sx: -0.3, ang: -PI * 0.67, len: 0.42, w: 0.8 }, { sx: 0.0, ang: -PI * 0.52, len: 0.40, w: 0.75 },
    { sx: 0.3, ang: mAng - 0.05, len: mDist * 0.88 / S, w: 0.85 }, { sx: 0.95, ang: PI * 0.05, len: 0.44, w: 0.85 },
    { sx: -0.1, ang: -PI * 0.4, len: 0.34, w: 0.6 },
  ];
  const lenScale = L.narrow ? 0.9 : 1;
  prim.forEach((p) => grow(cx + p.sx * hwTop * 0.9, topY + bw * 0.1, p.ang, S * p.len * lenScale * 0.6, hwTop * 0.85 * p.w, 3));
  // a few drooping boughs
  [[-1, 0.9], [1, 0.8]].forEach((d) => grow(cx + d[0] * hwTop * 0.9, topY + bw * 0.2, d[0] < 0 ? PI * 0.94 : PI * 0.06, S * 0.2, hwTop * 0.22, 2));
 
  // moss on the fat limbs
  mids.filter((m) => m.depth >= 2).forEach((m) => {
    for (let i = 0; i < 5; i++) { c.fillStyle = rgba([58, 96, 50], 0.22 + r() * 0.2); c.beginPath(); c.ellipse(m.x + (r() - 0.5) * m.w * 1.6, m.y - m.w * 0.22, m.w * (0.12 + r() * 0.18), m.w * 0.06, 0, 0, TAU); c.fill(); }
  });
  // foliage clumps — kept thin around the moon so it shines through
  const dark = [7, 22, 18], litc = [92, 160, 142];
  const spots = tips.map((t) => ({ x: t.x, y: t.y, rad: S * (0.034 + r() * 0.032) }))
    .concat(mids.filter((m) => m.depth <= 2).map((m) => ({ x: m.x, y: m.y, rad: S * (0.026 + r() * 0.026) })));
  spots.sort((a, b) => a.y - b.y);
  spots.forEach((s) => {
    const dm = Math.hypot(s.x - L.moon.x, s.y - L.moon.y), moonR = L.moon.r;
    if (dm < moonR * 1.5) return;
    const thin = dm < moonR * 2.8 ? 0.3 : 1;
    clump(c, r, s.x, s.y, s.rad * (thin < 1 ? 0.75 : 1), dark, litc, lightDir(L, s.x, s.y), 1.35 * thin);
  });
  L.tips = spots;
  // vine anchors hang from the lower foliage
  const low = spots.filter((s) => s.y > topY - S * 0.45).sort((a, b) => hash(a.x * 3.1 + a.y) - hash(b.x * 3.1 + b.y)).slice(0, 12);
  L.crownVines = low.map((s, i) => ({ x: s.x + (hash(i * 7.7) - 0.5) * s.rad, y: s.y + s.rad * 0.45, len: S * (0.06 + hash(i * 3.3) * 0.17), ph: hash(i * 9.1) * TAU, amp: S * (0.006 + hash(i * 2.7) * 0.01) }));
  L.crownAY = forkY + bw * 0.2;
}
 
/* ================================================================ */
/* FOREGROUND — two enormous framing trees                          */
/* ================================================================ */
function paintFgTrunks(c, L) {
  const { w, h, S } = L, r = rng(1337);
  const half = L.narrow ? w * 0.12 : w * 0.072;
  L.fg = { half, cxs: [w * (L.narrow ? 0.0 : 0.012), w * (L.narrow ? 1.0 : 0.988)] };
  for (let si = 0; si < 2; si++) {
    const side = si === 0 ? -1 : 1, X = L.fg.cxs[si], inward = -side;
    const edge = (y) => {
      const q = clamp((y - h * 0.68) / (h * 0.32)), hw = half * (1.0 + 0.5 * q * q) * (1 - 0.12 * (1 - y / h));
      const wob = (noise(y * 0.012 + si * 9) - 0.5) * half * 0.18, off = Math.sin(y * 0.004 + si) * half * 0.12;
      return { l: X + off - hw + wob, r: X + off + hw - wob };
    };
    const litK = si === 0 ? 1 : 0.55;
    const g = c.createLinearGradient(X - half * 1.6, 0, X + half * 1.6, 0);
    if (si === 0) { g.addColorStop(0, '#010403'); g.addColorStop(0.45, '#050d0a'); g.addColorStop(0.8, '#0d1d19'); g.addColorStop(1, '#1d3c38'); }
    else { g.addColorStop(0, '#1b3835'); g.addColorStop(0.2, '#0d1d19'); g.addColorStop(0.55, '#050d0a'); g.addColorStop(1, '#010403'); }
    c.fillStyle = g; c.beginPath(); c.moveTo(edge(h + 20).l, h + 20);
    for (let y = h + 20; y >= -20; y -= 12) c.lineTo(edge(y).l, y);
    for (let y = -20; y <= h + 20; y += 12) c.lineTo(edge(y).r, y);
    c.closePath(); c.fill();
    c.save(); c.clip();
    // bark
    for (let i = 0; i < 40; i++) {
      const t0 = r(), y0 = r() * h * 1.1 - h * 0.05, y1 = y0 + h * (0.12 + r() * 0.4), dk = r() < 0.72;
      c.strokeStyle = dk ? rgba([0, 2, 1], 0.4 + r() * 0.4) : rgba([140, 215, 200], (0.05 + (si === 0 ? t0 : 1 - t0) * 0.12) * litK);
      c.lineWidth = dk ? 1.5 + r() * 4 : 1 + r() * 1.4; c.beginPath();
      for (let y = y0; y <= y1; y += 14) { const e = edge(y); const x = lerp(e.l, e.r, t0 + Math.sin(y * 0.01 + i) * 0.03); y === y0 ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.stroke();
    }
    // moss, quietly glowing in places
    for (let i = 0; i < 26; i++) {
      const y = h * (0.3 + Math.pow(r(), 0.7) * 0.8), e = edge(y), x = lerp(e.l, e.r, r()), rad = half * (0.1 + r() * 0.22);
      const mg = c.createRadialGradient(x, y, 0, x, y, rad);
      mg.addColorStop(0, 'rgba(70,118,60,0.38)'); mg.addColorStop(1, 'rgba(70,118,60,0)');
      c.fillStyle = mg; c.beginPath(); c.ellipse(x, y, rad, rad * 1.3, 0, 0, TAU); c.fill();
    }
    c.restore();
    // roots spilling across the ground toward the middle
    for (let i = 0; i < 5; i++) {
      const sy = h * (0.8 + i * 0.045), sx = X + inward * half * 0.5;
      const ex = X + inward * w * (0.09 + i * 0.03 + r() * 0.03), ey = h * (0.9 + i * 0.03);
      taper(c, sx, sy, sx + inward * w * 0.03, sy + h * 0.015, ex - inward * w * 0.03, ey - h * 0.02, ex, ey, half * (0.55 - i * 0.07), half * 0.04, '#020604', { mx: L.moon.x, my: L.moon.y, a: 0.2 * litK });
    }
    // big dark fern fronds
    for (let i = 0; i < 5; i++) {
      const bx = X + inward * w * (0.015 + r() * 0.14), by = h * (0.985 + r() * 0.05), fl = S * (0.14 + r() * 0.16);
      const ang = -PI / 2 + inward * (0.25 + r() * 0.8) * (r() < 0.3 ? -1 : 1);
      const ex = bx + Math.cos(ang) * fl, ey = by + Math.sin(ang) * fl, cx1 = bx + Math.cos(ang) * fl * 0.5 + inward * fl * 0.25, cy1 = by + Math.sin(ang) * fl * 0.5 - fl * 0.2;
      c.strokeStyle = '#020704'; c.lineWidth = Math.max(2, fl * 0.02); c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(cx1, cy1, ex, ey); c.stroke();
      for (let k = 2; k <= 22; k++) {
        const u = k / 22, px = (1 - u) * (1 - u) * bx + 2 * (1 - u) * u * cx1 + u * u * ex, py = (1 - u) * (1 - u) * by + 2 * (1 - u) * u * cy1 + u * u * ey;
        const tx = 2 * (1 - u) * (cx1 - bx) + 2 * u * (ex - cx1), ty = 2 * (1 - u) * (cy1 - by) + 2 * u * (ey - cy1), tl = Math.hypot(tx, ty) || 1;
        const nx = -ty / tl, ny = tx / tl, ll = fl * 0.2 * Math.sin(u * PI * 0.9 + 0.2) * (1 - u * 0.4);
        c.lineWidth = Math.max(1, fl * 0.012);
        for (let sd = -1; sd <= 1; sd += 2) {
          c.strokeStyle = '#010503'; c.beginPath(); c.moveTo(px, py); c.lineTo(px + nx * sd * ll + tx / tl * ll * 0.35, py + ny * sd * ll + ty / tl * ll * 0.35); c.stroke();
        }
        if (k % 3 === 0) { c.strokeStyle = 'rgba(110,200,175,0.2)'; c.beginPath(); c.moveTo(px, py); c.lineTo(px + nx * ll * 0.8, py + ny * ll * 0.8 - 1); c.stroke(); }
      }
    }
    // a boulder
    const rx = X + inward * w * 0.1, ry = h * 0.985, rw = S * 0.13;
    c.fillStyle = '#030907'; c.beginPath(); c.moveTo(rx - rw, ry); c.lineTo(rx - rw * 0.8, ry - rw * 0.5); c.lineTo(rx - rw * 0.1, ry - rw * 0.75); c.lineTo(rx + rw * 0.7, ry - rw * 0.5); c.lineTo(rx + rw, ry); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(140,210,195,0.18)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(rx - rw * 0.1, ry - rw * 0.75); c.lineTo(rx + rw * 0.7, ry - rw * 0.5); c.lineTo(rx + rw, ry); c.stroke();
    c.fillStyle = rgba([70, 116, 58], 0.5); c.beginPath(); c.ellipse(rx, ry - rw * 0.62, rw * 0.5, rw * 0.1, 0, 0, TAU); c.fill();
  }
}
 
function paintFgTop(c, L) {
  const { w, h, S } = L, r = rng(777);
  L.fgVines = []; L.fgAY = h * 0.2;
  for (let si = 0; si < 2; si++) {
    const side = si === 0 ? -1 : 1, X = L.fg.cxs[si], inward = -side;
    const reach = w * (L.narrow ? 0.46 : 0.3);
    const bx = X + inward * L.fg.half * 0.2, by = h * 0.24;
    const ex = X + inward * reach, ey = h * 0.015;
    const lit = { mx: L.moon.x, my: L.moon.y, a: 0.2 };
    taper(c, bx, by, bx + inward * w * 0.01, by - h * 0.12, ex - inward * reach * 0.5, ey + h * 0.12, ex, ey, L.fg.half * 0.85, L.fg.half * 0.12, '#020604', lit);
    for (let b = 0; b < 3; b++) {              // side limbs
      const u = 0.35 + b * 0.22, px = bez(bx, bx + inward * w * 0.01, ex - inward * reach * 0.5, ex, u), py = bez(by, by - h * 0.12, ey + h * 0.12, ey, u);
      const ea = inward > 0 ? 0.55 + r() * 0.5 : PI - 0.55 - r() * 0.5, len = S * (0.2 + r() * 0.15);
      taper(c, px, py, px + Math.cos(ea) * len * 0.4, py + Math.sin(ea) * len * 0.3, px + Math.cos(ea) * len * 0.7, py + Math.sin(ea) * len * 0.8, px + Math.cos(ea) * len, py + Math.sin(ea) * len, L.fg.half * 0.22, L.fg.half * 0.04, '#020604', lit);
      L.fgVines.push({ x: px + Math.cos(ea) * len * 0.8, y: py + Math.sin(ea) * len * 0.8, len: S * (0.12 + r() * 0.2), ph: r() * TAU, amp: S * (0.01 + r() * 0.012) });
      clump(c, r, px + Math.cos(ea) * len, py + Math.sin(ea) * len, S * (0.05 + r() * 0.04), [2, 10, 7], [50, 105, 92], lightDir(L, px, py), 1.2);
    }
    // heavy foliage along the top edge and at the trunk crown
    for (let i = 0; i < 7; i++) {
      const u = i / 6, x = bez(bx, bx + inward * w * 0.01, ex - inward * reach * 0.5, ex, u) + (r() - 0.5) * S * 0.06;
      const y = bez(by, by - h * 0.12, ey + h * 0.12, ey, u) + (r() - 0.2) * S * 0.07;
      clump(c, r, x, y - S * 0.02, S * (0.06 + r() * 0.045) * (1.1 - u * 0.45), [2, 9, 6], [48, 100, 90], lightDir(L, x, y), 1.3);
      if (i % 3 === 1) L.fgVines.push({ x, y: y + S * 0.05, len: S * (0.14 + r() * 0.22), ph: r() * TAU, amp: S * (0.012 + r() * 0.012) });
    }
    clump(c, r, X + inward * L.fg.half * 0.5, h * 0.06, S * 0.11, [2, 9, 6], [48, 100, 90], lightDir(L, X, h * 0.1), 1.3);
  }
}
 
/* ================================================================ */
/* MOON SPRITE                                                       */
/* ================================================================ */
function paintMoon(c, R) {
  const cx = R + 2, cy = R + 2, r = rng(12);
  c.save(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.clip();
  const g = c.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
  g.addColorStop(0, '#fbfff0'); g.addColorStop(0.55, '#e4f3e4'); g.addColorStop(1, '#a9cfc9');
  c.fillStyle = g; c.fillRect(0, 0, R * 2 + 4, R * 2 + 4);
  [[-0.35, -0.2, 0.34], [0.25, 0.2, 0.4], [-0.05, 0.45, 0.28], [0.4, -0.38, 0.22], [-0.5, 0.25, 0.2]].forEach((m) => {   // maria
    const mx = cx + m[0] * R, my = cy + m[1] * R, mr = m[2] * R, mg = c.createRadialGradient(mx, my, 0, mx, my, mr);
    mg.addColorStop(0, 'rgba(120,160,155,0.34)'); mg.addColorStop(1, 'rgba(120,160,155,0)');
    c.fillStyle = mg; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
  });
  for (let i = 0; i < 16; i++) {   // craters with a lit rim
    const a = r() * TAU, d = Math.sqrt(r()) * R * 0.85, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, cr = R * (0.03 + r() * 0.08);
    c.fillStyle = 'rgba(100,140,138,0.25)'; c.beginPath(); c.arc(x, y, cr, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,245,0.35)'; c.lineWidth = Math.max(0.6, cr * 0.18); c.beginPath(); c.arc(x, y, cr, PI * 0.9, PI * 1.8); c.stroke();
  }
  const lg = c.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);          // limb darkening
  lg.addColorStop(0, 'rgba(60,100,100,0)'); lg.addColorStop(1, 'rgba(60,100,100,0.32)');
  c.fillStyle = lg; c.fillRect(0, 0, R * 2 + 4, R * 2 + 4);
  c.restore();
}
 
/* ================================================================ */
/* CACHE + DYNAMIC OBJECTS                                           */
/* ================================================================ */
function buildCache(state, w, h, sc) {
  const L = makeLayout(w, h), pad = 28, K = {};
  K.sky = layer(w, h, sc, 0, (c) => paintSky(c, L));
  K.far = layer(w, h, sc, pad, (c) => paintFar(c, L));
  K.ground = layer(w, h, sc, 0, (c) => paintGround(c, L));
  K.mid = layer(w, h, sc, pad, (c) => paintMid(c, L));
  K.hero = layer(w, h, sc, 0, (c) => paintHero(c, L));
  K.crown = layer(w, h, sc, pad, (c) => paintCrown(c, L));
  K.fg = layer(w, h, sc, 0, (c) => paintFgTrunks(c, L));
  K.fgTop = layer(w, h, sc, pad, (c) => paintFgTop(c, L));
  const mr = Math.ceil(L.moon.r);
  K.moon = layer(mr * 2 + 4, mr * 2 + 4, sc, 0, (c) => paintMoon(c, mr));
  K.moonR = mr; K.pad = pad;
 
  // mushrooms, placed relative to the path so they never sit on it
  const defs = [
    [0.50, -1, 1.30, 0, 1.15], [0.70, 1, 1.28, 1, 1.25], [0.30, -1, 1.55, 2, 0.85], [0.90, -1, 1.12, 1, 1.45],
    [0.40, 1, 1.45, 0, 0.95], [0.82, 1, 1.35, 2, 1.1], [0.16, 1, 2.0, 0, 0.7], [0.12, -1, 1.8, 1, 0.72], [0.62, -1, 1.5, 2, 0.9],
  ];
  L.mush = defs.map((d, i) => {
    const p = L.path(d[0]);
    const x = clamp(p.x + d[1] * p.half * d[2], w * 0.05, w * 0.95);
    const kids = []; const nk = d[3] === 1 ? 2 : (d[3] === 2 ? 4 : 1);
    for (let k = 0; k < nk; k++) kids.push({ dx: (hash(i * 5 + k) - 0.5) * 2.4, dy: (hash(i * 7 + k) - 0.3) * 0.7, s: 0.45 + hash(i * 3 + k) * 0.55, ph: hash(i * 11 + k) * TAU });
    return { x, y: p.y + (hash(i) - 0.3) * 6, type: d[3], s: (L.S * 0.017) * d[4] * (0.7 + d[0] * 0.8), ph: hash(i * 4.7) * TAU, kids, period: 5 + hash(i * 2.2) * 5 };
  });
  // grass tufts
  L.grass = [];
  const rr = rng(66);
  for (let i = 0; i < 110; i++) {
    const y = h * (0.73 + rr() * 0.27), q = L.qAtY(y), p = L.path(q), x = rr() * w;
    if (Math.abs(x - p.x) < p.half * 1.02) continue;
    L.grass.push({ x, y, hh: L.S * (0.012 + q * 0.04) * (0.6 + rr() * 0.8), ph: rr() * TAU, n: 3 + ((rr() * 3) | 0), tint: rr() });
  }
  // rune registry (idle activation + event-sequence order)
  L.runeList = [];
  const ar = L.archR * 1.22, nArch = 11;
  for (let i = 0; i < nArch; i++) {
    const a = PI + (i / (nArch - 1)) * PI;
    L.runeList.push({ kind: 'arch', x: L.cx + Math.cos(a) * ar, y: L.archY + Math.sin(a) * ar, rot: a + PI / 2, size: L.archR * 0.085, order: 0.55 + (i / (nArch - 1)) * 0.43, g: i * 3 + 1 });
  }
  for (let i = 0; i < 3; i++) {
    for (let s = -1; s <= 1; s += 2) {
      const y = L.archY + L.archR * (0.35 + i * 0.5);
      L.runeList.push({ kind: 'arch', x: L.cx + s * ar, y, rot: 0, size: L.archR * 0.085, order: s < 0 ? 0.55 - i * 0.002 : 0.98, g: i * 5 + 2 });
    }
  }
  (L.pathRunes || []).forEach((p, i) => L.runeList.push({ kind: 'path', x: p.x, y: p.y, rx: p.rx, order: 0.38 - i * 0.09, g: i * 2 }));
  (L.stones || []).forEach((s, i) => L.runeList.push({ kind: 'stone', x: s.x, y: s.y, size: s.size, order: 0.4 + (i % 2) * 0.05, g: s.glyph }));
  if (L.shrine) L.runeList.push({ kind: 'stone', x: L.shrine.rune.x, y: L.shrine.rune.y, size: L.shrine.u * 0.28, order: 0.5, g: 6 });
  L.runeList.forEach((rn, i) => { rn.ph = hash(i * 3.3 + 1) * 10; rn.sp = 0.07 + hash(i * 6.1) * 0.08; });
  // floating runes that orbit the door
  L.floaters = [];
  for (let i = 0; i < 7; i++) L.floaters.push({ a: (i / 7) * TAU, rx: L.Dw * (0.95 + hash(i * 3) * 0.55), ry: L.Dh * (0.3 + hash(i * 5) * 0.12), sp: (0.05 + hash(i * 7) * 0.05) * (i % 2 ? 1 : -1), g: i, bob: hash(i) * TAU });
  // light shafts from the moon
  L.beams = [-0.46, -0.3, -0.14, 0.03, 0.19, 0.35, 0.5].map((a, i) => ({ a, wd: L.S * (0.07 + hash(i * 2) * 0.05), ph: hash(i * 5.5) * TAU }));
  state.L = L; state.K = K;
}
 
 
/* ================================================================ */
/* STATE                                                             */
/* ================================================================ */
function initState() {
  const st = { K: null, L: null, key: '' };
  // stars: sparse, three brightness classes, a few tiny clusters
  st.stars = [];
  for (let i = 0; i < 96; i++) {
    const k = hash(i * 7.7), cls = k < 0.72 ? 0 : k < 0.93 ? 1 : 2;
    st.stars.push({ x: hash(i * 2.3), y: 0.015 + hash(i * 4.7) * 0.36, cls, a: [0.32, 0.55, 0.9][cls] * (0.6 + hash(i * 1.9) * 0.5), r: [0.6, 0.9, 1.3][cls], ph: hash(i * 9.3) * TAU, sp: 0.3 + hash(i * 5.4) * 1.1 });
  }
  for (let c = 0; c < 5; c++) {
    const cx = 0.08 + hash(c * 13.1) * 0.84, cy = 0.04 + hash(c * 17.3) * 0.28;
    for (let j = 0; j < 6; j++) st.stars.push({ x: cx + (hash(c * 31 + j) - 0.5) * 0.045, y: cy + (hash(c * 37 + j) - 0.5) * 0.04, cls: 0, a: 0.3 + hash(c * 5 + j) * 0.3, r: 0.6 + hash(j + c) * 0.4, ph: hash(j * 3 + c) * TAU, sp: 0.4 + hash(j + c * 9) });
  }
  // clouds travel left -> right, very slowly
  st.clouds = [];
  for (let i = 0; i < 8; i++) st.clouds.push({ x: hash(i * 4.1) * 1.6, y: 0.07 + hash(i * 8.7) * 0.26, w: 0.26 + hash(i * 3.3) * 0.26, speed: 0.0028 + hash(i * 2.4) * 0.0038, a: 0.34 + hash(i * 5.2) * 0.26, k: i % 3 });
  // fireflies
  st.flies = [];
  for (let i = 0; i < 78; i++) {
    const fg = i >= 66, k = i % 10, type = k < 4 ? 0 : k < 6 ? 1 : k < 8 ? 2 : 3;
    st.flies.push({
      type: fg ? (i % 2 ? 0 : 1) : type, fg, th: i / 78, x: 0.04 + hash(i * 2.31) * 0.92, y: fg ? 0.62 + hash(i * 3.17) * 0.34 : 0.4 + hash(i * 3.17) * 0.5,
      r: fg ? 2.0 + hash(i * 5.1) * 1.5 : 0.8 + hash(i * 5.1) * 1.1, sp: (fg ? 0.5 : 0.7) + hash(i * 7.7) * 0.8, ph: hash(i * 9.1) * TAU, fr: 0.9 + hash(i * 6.2) * 1.8,
      hue: hash(i * 2.9), r2: hash(i * 4.4), orb: (0.35 + hash(i * 8.1) * 0.7) * (i % 2 ? 1 : -1), wgt: 0.55 + hash(i * 1.7) * 0.45,
    });
  }
  // gentle falling leaves (only a few are on screen at once)
  st.leaves = [];
  for (let i = 0; i < 15; i++) st.leaves.push({ x: 0.1 + hash(i * 2.2) * 0.8, P: 36 + hash(i * 3.7) * 30, D: 15 + hash(i * 4.9) * 12, off: hash(i * 8.1) * 80, sz: 0.55 + hash(i * 6.1) * 0.9, ph: hash(i * 9.7) * TAU, sp: 0.8 + hash(i * 1.3) * 1.6, tone: hash(i * 5.5) });
  st.gustLeaves = [];
  for (let i = 0; i < 30; i++) st.gustLeaves.push({ y: 0.2 + hash(i * 3.3) * 0.65, d: hash(i * 5.9) * 0.45, ph: hash(i * 7.3) * TAU, sz: 0.6 + hash(i * 2.1) * 0.9, sp: 3 + hash(i * 4.4) * 4, tone: hash(i * 9.9) });
  // ground mist: three depth layers of drifting banks
  st.mist = [];
  const mr = [[0.600, 0.075, 7, 0.10], [0.665, 0.12, 8, 0.085], [0.86, 0.13, 7, 0.07]];
  for (let l = 0; l < 3; l++) {
    const arr = [];
    for (let i = 0; i < mr[l][2]; i++) arr.push({ x: hash(l * 20 + i * 3.2) * 1.6, y: mr[l][0] + hash(l * 11 + i * 4.7) * mr[l][1], w: 0.26 + hash(l * 8 + i * 2.1) * 0.3, a: mr[l][3] * (0.6 + hash(l * 3 + i * 9.1) * 0.6), sp: (0.005 + hash(l * 6 + i * 7.2) * 0.008) * (l === 2 ? 1.3 : 1), ph: hash(l * 5 + i) * TAU });
    st.mist.push(arr);
  }
  return st;
}
 
/* ================================================================ */
/* LIVE DRAWING                                                      */
/* ================================================================ */
function drawSheared(c, cv, w, h, pad, k, aY, x0, x1) {
  c.save();
  if (x1 !== undefined) { c.beginPath(); c.rect(x0, 0, x1 - x0, h); c.clip(); }
  c.transform(1, 0, k, 1, -k * aY, 0);
  c.drawImage(cv, -pad, 0, w + pad * 2, h);
  c.restore();
}
 
function drawStars(c, st, L, t, md) {
  const { w, h } = L, M = L.moon, R = M.r;
  for (const s of st.stars) {
    const x = s.x * w, y = s.y * h;
    const dm = Math.hypot(x - M.x, y - M.y), vis = smooth((dm - R * 2.2) / (R * 2.2));
    if (vis <= 0.02) continue;
    let a = s.a * (0.62 + 0.38 * Math.sin(t * s.sp + s.ph));
    if (s.cls > 0) a += Math.pow(Math.max(0, Math.sin(t * 0.31 * s.sp + s.ph * 3)), 28) * 0.65;       // rare strong twinkle
    a *= vis * (1.15 - md.moon * 0.22) * (1 - md.dark * 0.3);
    c.fillStyle = rgba([214, 236, 228], a);
    if (s.cls === 0) c.fillRect(x - s.r * 0.5, y - s.r * 0.5, s.r, s.r);
    else { c.beginPath(); c.arc(x, y, s.r, 0, TAU); c.fill(); }
    if (s.cls === 2 && a > 0.55) {
      c.strokeStyle = rgba([214, 236, 228], (a - 0.45) * 0.45); c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(x - s.r * 4.5, y); c.lineTo(x + s.r * 4.5, y); c.moveTo(x, y - s.r * 4.5); c.lineTo(x, y + s.r * 4.5); c.stroke();
    }
  }
}
 
function drawMoon(c, st, L, t, md) {
  const M = L.moon, R = M.r, mb = md.moon;
  c.save(); c.globalCompositeOperation = 'lighter';
  glow(c, 'moon', M.x, M.y, R * 5.4, 0.30 * mb * (0.93 + 0.07 * Math.sin(t * 0.3)));
  glow(c, 'cyan', M.x, M.y, R * 3.0, 0.10 * mb);
  // faint 22-degree halo ring
  const rg = c.createRadialGradient(M.x, M.y, R * 1.6, M.x, M.y, R * 2.7);
  rg.addColorStop(0, 'rgba(160,220,215,0)'); rg.addColorStop(0.55, 'rgba(160,220,215,' + (0.05 * mb).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(160,220,215,0)');
  c.fillStyle = rg; c.fillRect(M.x - R * 3, M.y - R * 3, R * 6, R * 6);
  c.restore();
  const k = 1 + Math.sin(t * 0.16) * 0.01;
  c.save(); c.globalAlpha = clamp(0.7 + mb * 0.3);
  c.drawImage(st.K.moon, M.x - (R + 2) * k, M.y - (R + 2) * k, (R * 2 + 4) * k, (R * 2 + 4) * k);
  c.restore();
  if (mb > 1) { c.save(); c.globalCompositeOperation = 'lighter'; glow(c, 'white', M.x, M.y, R * 1.15, (mb - 1) * 0.16); c.restore(); }
}
 
function drawClouds(c, st, L, t, md) {
  const { w, h } = L, M = L.moon;
  for (const cl of st.clouds) {
    const px = (mod(cl.x + t * cl.speed, 1.7) - 0.35) * w, cw = cl.w * w, ch = cw * 0.29, py = cl.y * h + Math.sin(t * 0.05 + cl.x * 9) * h * 0.004;
    const sp = spr('cloud' + cl.k);
    c.globalAlpha = clamp(cl.a * (0.85 + md.mist * 0.14)); c.drawImage(sp, px - cw / 2, py - ch / 2, cw, ch);
    const d = Math.hypot(px - M.x, py - M.y), prox = Math.exp(-(d * d) / (2 * Math.pow(M.r * 4.2, 2)));
    if (prox > 0.03) {          // silver lining where the moon reaches the cloud
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = clamp(prox * 0.55 * md.moon); c.drawImage(sp, px - cw / 2, py - ch / 2 - ch * 0.04, cw, ch); c.restore();
    }
  }
  c.globalAlpha = 1;
}
 
function drawBeams(c, L, t, md) {
  const M = L.moon;
  c.save(); c.globalCompositeOperation = 'lighter';
  L.beams.forEach((b, i) => {
    const swell = 0.5 + 0.5 * Math.sin(t * 0.13 + b.ph), occ = Math.pow(Math.max(0, Math.sin(t * 0.045 + b.ph * 2.3)), 2);     // occasional
    const a = 0.028 * md.moon * (0.25 + swell * 0.55 + occ * 0.9);
    c.save(); c.translate(M.x, M.y + M.r * 0.6); c.rotate(b.a + Math.sin(t * 0.05 + b.ph) * 0.02);
    c.globalAlpha = clamp(a); c.drawImage(spr('beam'), -b.wd / 2, 0, b.wd, L.h * 0.95);
    c.restore();
  });
  c.restore();
}
 
function drawShootingStar(c, L, p) {
  if (p < 0) return;
  const { w, h } = L, x0 = w * 0.18, y0 = h * 0.07, dx = w * 0.34, dy = h * 0.16;
  const e = smooth(p), hx = x0 + dx * e, hy = y0 + dy * e, tl = 0.2, tx = x0 + dx * Math.max(0, e - tl), ty = y0 + dy * Math.max(0, e - tl);
  const a = Math.sin(p * PI);
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(tx, ty, hx, hy);
  g.addColorStop(0, 'rgba(200,255,235,0)'); g.addColorStop(1, 'rgba(235,255,245,' + (0.85 * a).toFixed(3) + ')');
  c.strokeStyle = g; c.lineWidth = Math.max(1.2, L.S * 0.002); c.beginPath(); c.moveTo(tx, ty); c.lineTo(hx, hy); c.stroke();
  glow(c, 'white', hx, hy, L.S * 0.016, 0.8 * a); c.restore();
}
 
function drawCottage(c, L, t, wind) {
  if (!L.cottage) return;
  const k = L.cottage, fl = 0.78 + 0.14 * Math.sin(t * 5.3) + 0.08 * Math.sin(t * 11.1 + 1);
  c.save(); c.globalCompositeOperation = 'lighter';
  glow(c, 'warm', k.wx, k.wy, k.u * 2.8, 0.42 * fl); glow(c, 'warm', k.wx, k.wy, k.u * 0.7, 0.8 * fl);
  c.restore();
  for (let i = 0; i < 6; i++) {          // chimney smoke
    const u = mod(t * 0.07 + i / 6, 1), x = k.chx + Math.sin(u * 5 + i * 1.3) * k.u * 0.25 + (wind * 0.5 + 0.35) * u * k.u * 2.4, y = k.chy - u * k.u * 3.4;
    glow(c, 'smoke', x, y, k.u * (0.25 + u * 0.6), 0.2 * (1 - u) * smooth(u * 5));
  }
}
 
function drawDeer(c, L, p) {
  if (p < 0) return;
  const { w, h } = L, u = L.S * 0.022, x = lerp(L.narrow ? w * 0.9 : w * 0.8, L.narrow ? w * 0.52 : w * 0.6, p), y = h * 0.652;
  const a = env(p, 0.12, 0.12), step = p * 90, graze = smooth((Math.sin(p * TAU * 1.5) - 0.2) * 3) * 0.6;
  c.save(); c.translate(x, y); c.scale(-1, 1); c.globalAlpha = a * 0.9;
  c.fillStyle = 'rgba(2,8,7,1)'; c.strokeStyle = 'rgba(2,8,7,1)'; c.lineWidth = Math.max(1, u * 0.18);
  for (const [lx, ph] of [[-0.62, 0], [-0.42, PI], [0.5, PI], [0.7, 0]]) {         // legs
    const sw = Math.sin(step + ph) * u * 0.28;
    c.beginPath(); c.moveTo(lx * u, -u * 0.55); c.lineTo(lx * u + sw, -u * 0.05); c.stroke();
  }
  c.beginPath(); c.ellipse(0, -u * 0.9, u * 0.95, u * 0.42, 0, 0, TAU); c.fill();      // body
  const nx = u * 0.85, ny = -u * 1.1;
  c.lineWidth = u * 0.26; c.beginPath(); c.moveTo(nx, ny); c.lineTo(nx + u * 0.35, ny - u * (0.5 - graze * 1.3)); c.stroke();
  const hx = nx + u * 0.5, hy = ny - u * (0.62 - graze * 1.45);
  c.beginPath(); c.ellipse(hx, hy, u * 0.26, u * 0.15, 0.5 + graze, 0, TAU); c.fill();
  c.lineWidth = Math.max(0.8, u * 0.06);
  c.beginPath(); c.moveTo(hx - u * 0.05, hy - u * 0.1); c.lineTo(hx - u * 0.18, hy - u * 0.55); c.lineTo(hx + u * 0.05, hy - u * 0.7);
  c.moveTo(hx - u * 0.18, hy - u * 0.55); c.lineTo(hx - u * 0.38, hy - u * 0.62); c.stroke();                // antlers
  c.restore();
}
 
function flapWings(c, u, flap, side) {
  c.beginPath(); c.moveTo(0, 0);
  c.quadraticCurveTo(side * u * 1.2, -u * (0.55 + flap * 0.7), side * u * 2.3, u * (0.05 + flap * 0.6));
  c.quadraticCurveTo(side * u * 1.5, u * 0.05, side * u * 1.05, u * 0.32);
  c.quadraticCurveTo(side * u * 0.55, u * 0.12, 0, u * 0.38); c.fill();
}
function drawOwl(c, L, t, p) {
  if (p < 0) return;
  const M = L.moon, S = L.S, P0 = [L.w + S * 0.06, M.y + S * 0.3], P2 = [-S * 0.08, M.y + S * 0.16], P1y = M.y - S * 0.25;
  const P1x = (M.x - 0.25 * P0[0] - 0.25 * P2[0]) / 0.5;
  const e = smooth(p) * 0.6 + p * 0.4, v = 1 - e;
  const x = v * v * P0[0] + 2 * v * e * P1x + e * e * P2[0], y = v * v * P0[1] + 2 * v * e * P1y + e * e * P2[1];
  const u = S * 0.03, fl = Math.sin(t * 7.5), a = env(p, 0.08, 0.1);
  c.save(); c.translate(x, y); c.rotate(-0.12 + fl * 0.05); c.globalAlpha = a;
  c.fillStyle = 'rgba(2,6,6,1)';
  flapWings(c, u, fl, 1); flapWings(c, u, fl, -1);
  c.beginPath(); c.ellipse(0, u * 0.18, u * 0.42, u * 0.62, 0, 0, TAU); c.fill();                   // body
  c.beginPath(); c.arc(0, -u * 0.5, u * 0.34, 0, TAU); c.fill();                                    // head
  c.beginPath(); c.moveTo(-u * 0.3, -u * 0.62); c.lineTo(-u * 0.34, -u * 0.98); c.lineTo(-u * 0.1, -u * 0.78);
  c.moveTo(u * 0.3, -u * 0.62); c.lineTo(u * 0.34, -u * 0.98); c.lineTo(u * 0.1, -u * 0.78); c.fill();   // ear tufts
  c.globalCompositeOperation = 'lighter'; glow(c, 'gold', -u * 0.14, -u * 0.52, u * 0.2, 0.9 * a); glow(c, 'gold', u * 0.14, -u * 0.52, u * 0.2, 0.9 * a);
  c.restore();
}
function drawBats(c, L, t, p) {
  if (p < 0) return;
  const M = L.moon, S = L.S, a = env(p, 0.1, 0.1);
  for (let i = 0; i < 3; i++) {
    const pp = clamp(p * 1.25 - i * 0.1), e = pp;
    const x = lerp(-S * 0.06, L.w + S * 0.06, 1 - e) , y = M.y + Math.sin(e * TAU * 1.6 + i * 2) * S * 0.04 + (i - 1) * S * 0.07 - Math.sin(e * PI) * S * 0.04;
    const u = S * (0.012 + i * 0.002), fl = Math.sin(t * 15 + i * 2);
    c.save(); c.translate(x, y); c.globalAlpha = a * smooth(pp * 8) * smooth((1 - pp) * 8); c.fillStyle = 'rgba(2,6,6,1)';
    for (const sd of [-1, 1]) {
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(sd * u * 1.0, -u * (0.8 + fl * 0.6), sd * u * 2.2, -u * fl * 0.2);
      c.quadraticCurveTo(sd * u * 1.7, u * 0.2, sd * u * 1.35, u * 0.12); c.quadraticCurveTo(sd * u * 0.9, u * 0.5, sd * u * 0.6, u * 0.2); c.quadraticCurveTo(sd * u * 0.3, u * 0.5, 0, u * 0.3); c.fill();
    }
    c.beginPath(); c.ellipse(0, u * 0.1, u * 0.28, u * 0.4, 0, 0, TAU); c.fill(); c.restore();
  }
}
 
/* ---------- vines + grass (wind driven) ---------- */
function drawVine(c, x0, y0, len, ph, amp, t, wind, col) {
  const N = 10;
  c.strokeStyle = col; c.lineWidth = Math.max(1, len * 0.014); c.beginPath(); c.moveTo(x0, y0);
  const pts = [];
  for (let i = 1; i <= N; i++) {
    const u = i / N, x = x0 + Math.sin(t * 0.85 + ph + u * 2.2) * amp * u * u + wind * len * 0.1 * u * u + Math.sin(t * 2.1 + ph * 2 + u * 5) * amp * 0.12 * u, y = y0 + u * len * (1 - 0.03 * Math.abs(wind));
    c.lineTo(x, y); pts.push([x, y, u]);
  }
  c.stroke();
  c.fillStyle = 'rgba(20,50,36,0.95)';
  for (let i = 2; i < N; i += 2) { const p = pts[i]; c.beginPath(); c.ellipse(p[0] + len * 0.015, p[1], len * 0.04, len * 0.015, 0.5 + Math.sin(t + i) * 0.2, 0, TAU); c.fill(); }
  return pts[N - 1];
}
function drawGrass(c, L, t, wind) {
  const cols = ['rgba(52,92,60,0.85)', 'rgba(34,74,66,0.85)'];
  for (let ci = 0; ci < 2; ci++) {
    c.strokeStyle = cols[ci]; c.lineWidth = Math.max(0.9, L.S * 0.0016); c.beginPath();
    for (const g of L.grass) {
      if ((g.tint < 0.5 ? 0 : 1) !== ci) continue;
      for (let b = 0; b < g.n; b++) {
        const bx = g.x + (b - (g.n - 1) / 2) * g.hh * 0.22, sway = wind * g.hh * 0.3 + Math.sin(t * 1.3 + g.ph + b) * g.hh * 0.07, lean = (b - (g.n - 1) / 2) * g.hh * 0.18;
        c.moveTo(bx, g.y); c.quadraticCurveTo(bx + lean + sway * 0.5, g.y - g.hh * 0.55, bx + lean * 1.5 + sway, g.y - g.hh * (0.82 + (b % 2) * 0.22));
      }
    }
    c.stroke();
  }
}
 
/* ---------- the doorway, runes and lights ---------- */
function drawDoor(c, L, t, md, boost) {
  const { cx, doorCy, Dw, Dh, archR: R, archY: ay, doorBottom: db, S, bw } = L;
  const b = clamp((0.58 + 0.26 * Math.sin(t * 0.8) + 0.08 * Math.sin(t * 2.1 + 1)) * (0.8 + 0.3 * md.magic) + boost * 0.9, 0, 1.6);
  c.save(); c.globalCompositeOperation = 'lighter';
  glow(c, 'emerald', cx, doorCy, bw * 2.6, 0.17 * b, bw * 2.3);                   // aura on bark + air
  glow(c, 'cyan', cx, doorCy + Dh * 0.1, Dh * 1.0, 0.09 * b);
  glow(c, 'emerald', cx, db + (L.y0 - db) * 0.55, Dw * 1.4, 0.26 * b, (L.y0 - db) * 1.2);          // spill on the steps
  glow(c, 'emerald', cx, L.y0 + S * 0.03, Dw * 2.8, 0.2 * b, S * 0.075);                            // pool on the path
  // light leaking through the cracks and around the door
  const pw = (2 * R) / 5, lines = [];
  for (let i = 1; i < 5; i++) { const x = cx - R + i * pw, dy = Math.sqrt(Math.max(0, R * R - (x - cx) * (x - cx))); lines.push([x, ay - dy + R * 0.04, x, db]); }
  for (let pass = 0; pass < 3; pass++) {
    c.lineWidth = [R * 0.14, R * 0.05, R * 0.016][pass]; c.strokeStyle = rgba(pass === 2 ? [225, 255, 235] : pass === 1 ? COL.emerald : COL.cyan, [0.1, 0.32, 0.95][pass] * b * (0.88 + 0.12 * Math.sin(t * 3.1)));
    c.beginPath();
    for (const l of lines) { c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); }
    c.moveTo(cx - R * 0.985, db); c.lineTo(cx - R * 0.985, ay); c.arc(cx, ay, R * 0.985, PI, 0); c.lineTo(cx + R * 0.985, db);
    c.stroke();
  }
  // the circular sigil
  const sx = cx, sy = ay + R * 0.12, rr = R * 0.5, sa = (0.55 + 0.45 * b);
  glow(c, 'emerald', sx, sy, rr * 2.1, 0.36 * b);
  c.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    c.lineWidth = pass ? R * 0.022 : R * 0.07; c.strokeStyle = rgba(pass ? [220, 255, 230] : COL.emerald, (pass ? 0.9 : 0.16) * sa);
    c.beginPath(); c.arc(sx, sy, rr, 0, TAU); c.moveTo(sx + rr * 0.72, sy); c.arc(sx, sy, rr * 0.72, 0, TAU); c.stroke();
    c.save(); c.translate(sx, sy); c.rotate(t * 0.1); c.beginPath();                      // tick ring
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, r0 = rr * 0.77, r1 = rr * (i % 3 ? 0.9 : 0.97); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); }
    c.stroke(); c.restore();
    c.save(); c.translate(sx, sy); c.rotate(-t * 0.17); c.beginPath();                    // counter-rotating star
    for (let k = 0; k < 2; k++) for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + k * PI / 3 - PI / 2, x = Math.cos(a) * rr * 0.62, y = Math.sin(a) * rr * 0.62; i ? c.lineTo(x, y) : c.moveTo(x, y); if (i === 2) c.closePath(); }
    c.stroke(); c.restore();
  }
  glow(c, 'white', sx, sy, rr * 0.34, 0.5 * b * (0.7 + 0.3 * Math.sin(t * 1.7)));
  // the face in the bark wakes up a little when the door pulses
  if (L.eyes) { const e = L.eyes; [-1, 1].forEach((s) => glow(c, 'emerald', cx + s * e.dx, e.y, e.r * 2.4, 0.012 + boost * 0.16, e.r * 1.2)); }
  c.restore();
}
 
function runeActivity(rn, t, md, evRunes) {
  const u = mod(t * rn.sp + rn.ph, 1), idle = u < 0.22 ? Math.pow(Math.sin(PI * u / 0.22), 2) : 0;
  let a = (0.16 + 0.84 * idle) * (0.75 + 0.35 * md.magic);
  if (evRunes >= 0) {
    const v = evRunes * 1.35 - rn.order;
    if (v > 0) a = Math.max(a, Math.exp(-v * 4.2) * smooth(v * 22) * 1.1);
  }
  return a;
}
 
function drawRunes(c, L, t, md, ev) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const rn of L.runeList) {
    const a = runeActivity(rn, t, md, ev.runes);
    if (rn.kind === 'arch') {
      glow(c, 'emerald', rn.x, rn.y, rn.size * 4.2, a * 0.28); glyph(c, rn.g, rn.x, rn.y, rn.size, rn.rot, a, COL.emerald);
    } else if (rn.kind === 'stone') {
      glow(c, 'emerald', rn.x, rn.y, rn.size * 3.4, a * 0.3); glyph(c, rn.g, rn.x, rn.y, rn.size, 0, a, COL.cyan);
    } else {
      c.save(); c.translate(rn.x, rn.y); c.scale(1, 0.34);
      glow(c, 'emerald', 0, 0, rn.rx * 1.5, a * 0.3);
      c.strokeStyle = rgba(COL.emerald, a * 0.8); c.lineWidth = Math.max(1.4, rn.rx * 0.07); c.beginPath(); c.arc(0, 0, rn.rx * 0.88, 0, TAU); c.stroke();
      c.strokeStyle = rgba(COL.emerald, a * 0.35); c.lineWidth = Math.max(1, rn.rx * 0.03); c.beginPath(); c.arc(0, 0, rn.rx * 0.7, 0, TAU); c.stroke();
      glyph(c, rn.g, 0, 0, rn.rx * 0.46, 0, a, COL.emerald); c.restore();
    }
  }
  // glyphs drifting around the doorway
  const act = 0.3 + 0.25 * md.magic;
  for (const f of L.floaters) {
    const a = f.a + t * f.sp, x = L.cx + Math.cos(a) * f.rx, y = L.doorCy + Math.sin(a) * f.ry + Math.sin(t * 0.6 + f.bob) * L.S * 0.008 - L.Dh * 0.05;
    const al = (0.28 + 0.4 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.5 + f.bob * 3), 2)) * act * 1.5;
    glow(c, 'emerald', x, y, L.archR * 0.28, al * 0.35); glyph(c, f.g + 2, x, y, L.archR * 0.085, Math.sin(t * 0.4 + f.bob) * 0.3, al, COL.emerald);
  }
  // bioluminescent veins and little lights around the trunk
  for (const v of L.veins) {
    const a = (0.1 + 0.09 * Math.sin(t * 0.55 + v.ph)) * (0.7 + 0.4 * md.magic);
    c.strokeStyle = rgba(COL[v.col], a * 0.5); c.lineWidth = L.bw * 0.03; c.beginPath(); v.pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
    c.strokeStyle = rgba(COL[v.col], a * 1.6); c.lineWidth = Math.max(0.8, L.bw * 0.01); c.stroke();
  }
  for (const l of L.lights) {
    const a = (0.32 + 0.68 * Math.pow(0.5 + 0.5 * Math.sin(t * l.sp + l.ph), 2)) * (0.7 + 0.4 * md.magic);
    glow(c, l.col, l.x, l.y, L.bw * 0.1 * l.s, a * 0.45); glow(c, 'white', l.x, l.y, L.bw * 0.022 * l.s, a * 0.8);
  }
  // shrine candles
  if (L.shrine) L.shrine.candles.forEach((cd, i) => {
    const fl = 0.8 + 0.12 * Math.sin(t * 9 + i * 3) + 0.08 * Math.sin(t * 17 + i);
    glow(c, 'warm', cd.x, cd.y, cd.u * 1.7, 0.4 * fl, cd.u * 1.3); glow(c, 'gold', cd.x, cd.y - cd.u * 0.06, cd.u * 0.2, 0.95 * fl);
  });
  c.restore();
}
 
/* ---------- mushrooms + spores ---------- */
function drawMushrooms(c, L, t, md, ev) {
  const lights = [];
  for (const m of L.mush) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 0.9 + m.ph);
    const parts = [{ s: m.s, x: m.x, y: m.y, ph: m.ph }].concat(m.kids.map((k) => ({ s: m.s * k.s, x: m.x + k.dx * m.s, y: m.y + k.dy * m.s, ph: k.ph })));
    for (const q of parts) {
      const s = q.s, type = m.type, base = type === 0 ? [34, 118, 88] : type === 1 ? [38, 104, 148] : [190, 146, 58];
      const gc = COL[type === 0 ? 'emerald' : type === 1 ? 'cyan' : 'gold'];
      const stemH = (type === 0 ? 3.4 : type === 1 ? 2.2 : 2.0) * s, capW = (type === 0 ? 1.25 : type === 1 ? 1.9 : 0.95) * s, capH = (type === 0 ? 1.9 : type === 1 ? 1.0 : 1.25) * s;
      const x = q.x, y = q.y, capY = y - stemH, e = (0.35 + 0.65 * pulse) * (0.7 + 0.3 * md.magic);
      c.strokeStyle = 'rgba(190,200,172,0.82)'; c.lineWidth = Math.max(1, s * (type === 1 ? 0.55 : 0.42));
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.sin(q.ph) * s * 0.35, y - stemH * 0.5, x, capY); c.stroke();
      c.fillStyle = rgba(mixc(base, [base[0] + 85, base[1] + 95, base[2] + 70], e * 0.5), 0.97);
      c.beginPath(); c.moveTo(x - capW, capY); c.bezierCurveTo(x - capW * 1.05, capY - capH * 1.15, x + capW * 1.05, capY - capH * 1.15, x + capW, capY); c.quadraticCurveTo(x, capY + capH * 0.3, x - capW, capY); c.fill();
      c.fillStyle = 'rgba(6,16,12,0.5)'; c.beginPath(); c.ellipse(x, capY + capH * 0.04, capW * 0.9, capH * 0.15, 0, 0, PI); c.fill();
      c.strokeStyle = 'rgba(205,245,238,0.38)'; c.lineWidth = Math.max(0.8, s * 0.1);
      c.beginPath(); c.moveTo(x + capW * 0.1, capY - capH * 0.9); c.bezierCurveTo(x + capW * 0.7, capY - capH * 0.88, x + capW, capY - capH * 0.5, x + capW * 0.97, capY); c.stroke();
      c.fillStyle = rgba(mixc(gc, [255, 255, 255], 0.45), 0.5 + 0.35 * e);
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + (i - 1) * capW * 0.5, capY - capH * (0.52 + (i % 2) * 0.2), Math.max(0.7, s * (type === 2 ? 0.1 : 0.17)), 0, TAU); c.fill(); }
      lights.push({ x, y, capY, capH, s, e, gc: type === 0 ? 'emerald' : type === 1 ? 'cyan' : 'gold' });
    }
  }
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    glow(c, l.gc, l.x, l.y + l.s * 0.1, l.s * 7.5, 0.24 * l.e, l.s * 2.4);                // pool on the ground
    glow(c, l.gc, l.x, l.capY - l.capH * 0.35, l.s * 4.2, 0.2 * l.e);                      // halo
    glow(c, l.gc, l.x, l.capY - l.capH * 0.55, l.s * 1.5, 0.28 * l.e);
  }
  const burst = env(ev.spores, 0.2, 0.3);
  L.mush.forEach((m, i) => {
    const n = 2 + Math.round(burst * 6), gcn = m.type === 0 ? 'emerald' : m.type === 1 ? 'cyan' : 'gold';
    const stemH = (m.type === 0 ? 3.4 : 2.2) * m.s;
    for (let j = 0; j < n; j++) {
      const period = m.period * (0.8 + hash(j * 3.1 + i) * 0.6) * (1 - 0.45 * burst), u = mod(t / period + hash(i * 13 + j * 7), 1), a = Math.pow(Math.sin(PI * u), 1.4);
      const x = m.x + Math.sin(u * TAU * 1.4 + j * 2 + i) * m.s * 1.3 + (j - n / 2) * m.s * 0.25, y = m.y - stemH - u * L.S * (0.2 + hash(j + i) * 0.12);
      glow(c, gcn, x, y, m.s * 0.55, a * 0.5); glow(c, 'white', x, y, m.s * 0.15, a * 0.85);
    }
  });
  c.restore();
}
 
/* ---------- fireflies ---------- */
function drawFlies(c, st, L, t, md, sw, wind, fgPass) {
  const { w, h, S } = L, door = [L.cx, L.doorCy];
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const f of st.flies) {
    if (f.fg !== fgPass) continue;
    const vis = clamp((md.flies - f.th) * 5);
    if (vis <= 0.01) continue;
    let x = f.x * w, y = f.y * h, env_ = 1;
    if (f.type === 0) {            // slow lissajous drift
      x += Math.sin(t * f.sp * 0.5 + f.ph) * S * 0.05 + Math.sin(t * f.sp * 0.21 + f.ph * 2) * S * 0.03;
      y += Math.sin(t * f.sp * 0.4 + f.ph * 1.3) * S * 0.03 + Math.sin(t * f.sp * 0.17 + f.ph) * S * 0.02;
    } else if (f.type === 1) {     // small looping circles
      const a = t * f.sp * 0.8 * (f.r2 < 0.5 ? 1 : -1) + f.ph, rad = S * (0.012 + f.r2 * 0.02);
      x += Math.cos(a) * rad + Math.sin(t * 0.13 + f.ph) * S * 0.04; y += Math.sin(a) * rad * 0.75 + Math.cos(t * 0.11 + f.ph) * S * 0.02;
    } else if (f.type === 2) {     // rise from the ground, sway, fade
      const u = mod(t * f.sp * 0.03 + f.ph / TAU, 1);
      y = lerp(h * (0.72 + f.r2 * 0.22), h * 0.3, u); x += Math.sin(u * TAU * 1.7 + f.ph) * S * 0.03 + wind * u * S * 0.02; env_ = Math.sin(PI * u);
    } else {                       // drawn toward the magical tree
      const u = mod(t * f.sp * 0.028 + f.ph / TAU, 1), e = smooth(u);
      const tx = L.cx + Math.sin(f.ph) * L.Dw * 0.5, ty = door[1] + (f.r2 - 0.4) * L.Dh * 0.5;
      x = lerp(x, tx, e) + Math.sin(u * TAU * 3 + f.ph) * S * 0.02 * (1 - e); y = lerp(y, ty, e) + Math.cos(u * TAU * 2 + f.ph) * S * 0.015 * (1 - e); env_ = Math.pow(Math.sin(PI * u), 0.6);
    }
    if (sw > 0.01) {                // event: swarm gathers round the doorway
      const a = t * f.orb + f.ph, rad = S * (0.05 + 0.16 * f.r2), g = clamp(sw * f.wgt * 1.25);
      x = lerp(x, door[0] + Math.cos(a) * rad * 1.15, g); y = lerp(y, door[1] + Math.sin(a) * rad * 0.8 - S * 0.015, g); env_ = lerp(env_, 1, g);
    }
    const pulse = 0.22 + 0.78 * Math.pow(Math.max(0, Math.sin(t * f.fr + f.ph)), 2), a = pulse * env_ * vis * (1 + sw * 0.5) * (1 - md.dark * 0.2);
    const gc = f.hue < 0.5 ? 'emerald' : f.hue < 0.8 ? 'cyan' : 'gold', rr = f.r * (fgPass ? 1 : 1);
    glow(c, gc, x, y, rr * (fgPass ? 11 : 8), 0.5 * a); c.fillStyle = rgba(mixc(COL[gc], [255, 255, 255], 0.55), 0.95 * a);
    c.beginPath(); c.arc(x, y, Math.max(0.7, rr * 0.7), 0, TAU); c.fill();
  }
  c.restore();
}
 
/* ---------- leaves ---------- */
function drawLeaf(c, x, y, size, rot, flip, tone, a) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, flip);
  c.fillStyle = rgba(tone < 0.18 ? [150, 170, 90] : tone < 0.55 ? [88, 128, 84] : [44, 84, 66], a);
  c.beginPath(); c.moveTo(-size, 0); c.quadraticCurveTo(0, -size * 0.7, size, 0); c.quadraticCurveTo(0, size * 0.7, -size, 0); c.fill();
  c.strokeStyle = rgba([20, 40, 30], a * 0.5); c.lineWidth = Math.max(0.5, size * 0.07); c.beginPath(); c.moveTo(-size, 0); c.lineTo(size, 0); c.stroke();
  c.restore();
}
function drawLeaves(c, st, L, t, wind, gustP) {
  const { w, h, S } = L;
  for (const lf of st.leaves) {
    const tt = mod(t + lf.off, lf.P), u = tt / lf.D;
    if (u >= 1) continue;
    let x = lf.x * w + u * lf.D * w * 0.012 * (1 + wind * 0.6) + Math.sin(u * TAU * 1.3 + lf.ph) * S * 0.04, y = -S * 0.03 + Math.pow(u, 1.08) * (h + S * 0.06);
    const lu = clamp((u - 0.42) / 0.22);                                      // a small current catches it mid-air
    if (lu > 0 && lu < 1) { const a = lu * TAU, k = Math.sin(lu * PI) * S * 0.035; x += Math.sin(a) * k; y += (1 - Math.cos(a)) * k * 0.6; }
    const sz = S * 0.0065 * lf.sz * (0.8 + 0.5 * y / h), al = smooth(u * 10) * smooth((1 - u) * 6) * 0.85;
    drawLeaf(c, x, y, sz, t * lf.sp * 0.8 + lf.ph + u * 6, Math.cos(t * lf.sp * 1.7 + lf.ph), lf.tone, al);
  }
  if (gustP >= 0) {                                                            // event: a gust sweeps leaves across the scene
    for (const g of st.gustLeaves) {
      const p = clamp((gustP - g.d) / 0.55); if (p <= 0 || p >= 1) continue;
      const x = -S * 0.05 + p * (w + S * 0.1), y = g.y * h + Math.sin(p * TAU * 1.4 + g.ph) * h * 0.05 - p * h * 0.06;
      drawLeaf(c, x, y, S * 0.0075 * g.sz, p * g.sp * 3 + g.ph, Math.cos(p * g.sp * 6), g.tone, Math.sin(p * PI) * 0.9);
    }
  }
}
 
/* ---------- mist ---------- */
function drawMist(c, st, L, t, md, layerI, gust) {
  const { w, h } = L, sp = spr('mist');
  for (const f of st.mist[layerI]) {
    const px = (mod(f.x + t * f.sp * (1 + gust * 1.6), 1.7) - 0.35) * w, mw = f.w * w * (layerI === 2 ? 1.1 : 1), mh = mw * 0.3;
    const py = f.y * h + Math.sin(t * 0.07 + f.ph) * h * 0.006;
    c.globalAlpha = clamp(f.a * md.mist * (0.8 + 0.2 * Math.sin(t * 0.2 + f.ph)) * (1 - md.dark * 0.25));
    c.drawImage(sp, px - mw / 2, py - mh / 2, mw, mh);
  }
  c.globalAlpha = 1;
}
 
/* ================================================================ */
/* MAIN                                                              */
/* ================================================================ */
function ensureCache(c, st, w, h) {
  let sc = 1;
  try { const m = c.getTransform(); sc = Math.hypot(m.a, m.b) || 1; } catch (e) { sc = 1; }
  sc = clamp(sc, 1, 1.75);
  const px = w * h * sc * sc; if (px > 2.1e6) sc *= Math.sqrt(2.1e6 / px);
  const key = (w | 0) + 'x' + (h | 0) + '@' + sc.toFixed(2);
  if (st.key === key && st.K) return true;
  if (!mk(2, 2)) return false;
  buildCache(st, w, h, sc);
  st.K.vig = layer(w, h, sc, 0, (g) => {
    const v = g.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.3, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.72, 'rgba(0,4,4,0.12)'); v.addColorStop(1, 'rgba(0,3,3,0.58)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    const b = g.createLinearGradient(0, h * 0.8, 0, h); b.addColorStop(0, 'rgba(0,0,0,0)'); b.addColorStop(1, 'rgba(0,2,2,0.35)');
    g.fillStyle = b; g.fillRect(0, h * 0.8, w, h * 0.2);
  });
  st.key = key;
  return true;
}
 
function drawScene(c, st, t, mood, w, h) {
  if (!ensureCache(c, st, w, h)) return;
  const L = st.L, K = st.K, pad = K.pad;
  const md = moodAt(t, mood), ev = eventsAt(t);
  const gust = env(ev.gust, 0.22, 0.45), wind = windAt(t, gust);
  const doorBoost = Math.max(
    ev.door < 0 ? 0 : Math.pow(Math.sin(PI * ev.door), 1.6),
    ev.runes > 0.66 ? smooth((ev.runes - 0.66) / 0.14) * smooth((1 - ev.runes) / 0.14) * 0.75 : 0,
    env(ev.swarm, 0.3, 0.3) * 0.25);
  const swarm = env(ev.swarm, 0.22, 0.25);
  const flutter = Math.sin(t * 1.3) * 0.0006;
 
  c.save();
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.lineCap = 'round'; c.lineJoin = 'round';
 
  /* sky */
  c.drawImage(K.sky, 0, 0, w, h);
  drawStars(c, st, L, t, md);
  drawMoon(c, st, L, t, md);
  drawClouds(c, st, L, t, md);
  drawShootingStar(c, L, ev.star);
  drawCottage(c, L, t, wind);
  drawOwl(c, L, t, ev.owl);
  drawBats(c, L, t, ev.bats);
 
  /* far world */
  drawSheared(c, K.far, w, h, pad, wind * 0.0022 + flutter, h * 0.66);
  c.drawImage(K.ground, 0, 0, w, h);
  drawMist(c, st, L, t, md, 0, gust);
  drawDeer(c, L, ev.deer);
 
  /* middle forest + moonbeams */
  drawSheared(c, K.mid, w, h, pad, wind * 0.0048 + flutter, h * 0.74);
  drawBeams(c, L, t, md);
 
  /* the hero tree */
  c.drawImage(K.hero, 0, 0, w, h);
  const kc = wind * 0.0105 + flutter * 2;
  drawSheared(c, K.crown, w, h, pad, kc, L.crownAY);
  for (const v of L.crownVines) {
    drawVine(c, v.x + kc * (v.y - L.crownAY), v.y, v.len, v.ph, v.amp, t, wind, 'rgba(14,38,28,0.95)');
  }
  drawDoor(c, L, t, md, doorBoost);
  drawRunes(c, L, t, md, ev);
  drawMist(c, st, L, t, md, 1, gust);
 
  /* the living ground */
  drawGrass(c, L, t, wind);
  drawMushrooms(c, L, t, md, ev);
  drawFlies(c, st, L, t, md, swarm, wind, false);
  drawLeaves(c, st, L, t, wind, ev.gust);
 
  /* foreground frame */
  c.drawImage(K.fg, 0, 0, w, h);
  const kl = wind * 0.009 + Math.sin(t * 0.5) * 0.0015, kr = wind * 0.009 + Math.cos(t * 0.43) * 0.0015;
  drawSheared(c, K.fgTop, w, h, pad, kl, L.fgAY, -pad, w * 0.5);
  drawSheared(c, K.fgTop, w, h, pad, kr, L.fgAY, w * 0.5, w + pad);
  for (let i = 0; i < L.fgVines.length; i++) {
    const v = L.fgVines[i], k = v.x < w * 0.5 ? kl : kr;
    const tip = drawVine(c, v.x + k * (v.y - L.fgAY), v.y, v.len, v.ph, v.amp, t, wind, 'rgba(2,10,7,0.98)');
    c.save(); c.globalCompositeOperation = 'lighter'; glow(c, i % 2 ? 'emerald' : 'cyan', tip[0], tip[1], L.S * 0.012, 0.35 + 0.25 * Math.sin(t * 0.9 + v.ph)); c.restore();
  }
  drawFlies(c, st, L, t, md, swarm * 0.5, wind, true);
  drawMist(c, st, L, t, md, 2, gust);
 
  /* grade */
  if (md.dark > 0.01) { c.fillStyle = 'rgba(1,5,9,' + (md.dark * 0.46).toFixed(3) + ')'; c.fillRect(0, 0, w, h); }
  c.drawImage(K.vig, 0, 0, w, h);
  c.restore();
}
 
/* ================================================================ */
/* EXPORT                                                            */
/* ================================================================ */
export default {
  init(w, h) { return initState(); },
  draw(c, state, t, dt, mood, w, h) {
    if (!(w > 0) || !(h > 0)) return;
    if (!Number.isFinite(t)) t = 0;
    if (!state || !state.stars) return;
    drawScene(c, state, t, mood, w, h);
  },
};
 
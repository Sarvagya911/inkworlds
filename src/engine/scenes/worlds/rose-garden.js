// Rose Glasshouse — "Velvet Twilight Conservatory"
// Inkworlds world module → src/engine/scenes/worlds/rose-garden.js
//
// Interface: { init(w,h,opts), draw(c,state,t,dt,mood,w,h), pointerMove, pointerDown, pointerUp }
// Canvas 2D only, no dependencies, zero per-frame allocation inside draw().
//
// Scene: you stand inside a Victorian glasshouse looking down a nave of receding
// pointed-iron arches. Beyond the last arch: a terrace balustrade, a moonlit garden
// and a distant manor with lit windows. Rose vines frame both sides, three iron
// lanterns swing on real pendulums, petals tumble in 3D and fireflies drift.
//
// Everything heavy (sky, garden, marble floor, iron ribs, vines, vignette) is
// pre-rendered once into state.canvases and only rebuilt when w/h/DPR change.
// All glows, petals and fireflies are blitted from pre-rendered sprites.

const TAU = Math.PI * 2;
const PI = Math.PI;

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const rgba = (r, g, b, a) => 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h, scale) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w * scale));
  cv.height = Math.max(1, Math.round(h * scale));
  const g = cv.getContext('2d');
  g.scale(scale, scale);
  return { cv, g };
}

const getDpr = () => (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

/* ════════════════════════════════════════════════════════════════════════
   SPRITES (built once in init)
   ════════════════════════════════════════════════════════════════════════ */

const PETAL_RGB = [
  [245, 185, 200], // soft blush
  [190, 45, 75],   // velvet crimson
  [252, 220, 205], // champagne peach
  [222, 150, 128], // rose gold
  [228, 118, 146], // warm rose
];
const PETAL_PICK = [0, 0, 1, 2, 2, 3, 4, 0, 3, 4, 1, 2];
const PW = 30, PH = 38;

function petalPath(g) {
  const a = PW * 0.5, b = PH * 0.5;
  g.beginPath();
  g.moveTo(0, b * 0.92);
  g.bezierCurveTo(-a * 0.45, b * 0.7, -a * 1.0, -b * 0.02, -a * 0.8, -b * 0.56);
  g.bezierCurveTo(-a * 0.62, -b * 0.86, -a * 0.2, -b * 1.0, 0, -b * 0.86);
  g.bezierCurveTo(a * 0.2, -b * 1.0, a * 0.62, -b * 0.86, a * 0.8, -b * 0.56);
  g.bezierCurveTo(a * 1.0, -b * 0.02, a * 0.45, b * 0.7, 0, b * 0.92);
  g.closePath();
}

function makePetalSprite(rgb, under, sp) {
  const { cv, g } = makeCanvas(PW, PH, sp);
  g.translate(PW / 2, PH / 2);
  const k = under ? 0.66 : 1;
  const r = rgb[0] * k, gg = rgb[1] * k, b = rgb[2] * k;
  const lt = under ? 0.1 : 0.36;
  const gr = g.createLinearGradient(0, -PH / 2, 0, PH / 2);
  gr.addColorStop(0, rgba(r + (255 - r) * lt, gg + (255 - gg) * lt, b + (255 - b) * lt, 1));
  gr.addColorStop(0.5, rgba(r, gg, b, 1));
  gr.addColorStop(1, rgba(r * 0.55, gg * 0.5, b * 0.5, 1));
  petalPath(g);
  g.fillStyle = gr;
  g.fill();

  g.save();
  petalPath(g);
  g.clip();
  // satin sheen
  const hl = g.createRadialGradient(-PW * 0.12, -PH * 0.22, 1, -PW * 0.12, -PH * 0.22, PW * 0.62);
  hl.addColorStop(0, under ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.34)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl;
  g.fillRect(-PW / 2, -PH / 2, PW, PH);
  // cupped base shadow
  const sh = g.createRadialGradient(0, PH * 0.5, 1, 0, PH * 0.5, PH * 0.55);
  sh.addColorStop(0, 'rgba(70,8,24,0.45)');
  sh.addColorStop(1, 'rgba(70,8,24,0)');
  g.fillStyle = sh;
  g.fillRect(-PW / 2, -PH / 2, PW, PH);
  // veins
  g.strokeStyle = under ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.13)';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(0, PH * 0.44); g.lineTo(0, -PH * 0.3);
  g.moveTo(0, PH * 0.3); g.quadraticCurveTo(-PW * 0.2, PH * 0.05, -PW * 0.3, -PH * 0.2);
  g.moveTo(0, PH * 0.3); g.quadraticCurveTo(PW * 0.2, PH * 0.05, PW * 0.3, -PH * 0.2);
  g.stroke();
  g.restore();

  petalPath(g);
  g.strokeStyle = under ? 'rgba(40,0,15,0.25)' : 'rgba(255,255,255,0.20)';
  g.lineWidth = 0.8;
  g.stroke();
  return cv;
}

function makeGlow(size, stops, sp) {
  const { cv, g } = makeCanvas(size, size, sp);
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (let i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], stops[i][1]);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return cv;
}

function createSprites(sp) {
  const glow = makeGlow(128, [
    [0, 'rgba(255,238,208,1)'], [0.12, 'rgba(255,208,160,0.62)'], [0.35, 'rgba(240,150,135,0.22)'],
    [0.7, 'rgba(170,64,100,0.05)'], [1, 'rgba(120,40,80,0)'],
  ], sp);
  const rose = makeGlow(128, [
    [0, 'rgba(255,208,224,0.9)'], [0.2, 'rgba(244,140,176,0.4)'], [0.55, 'rgba(190,70,120,0.12)'],
    [1, 'rgba(120,30,80,0)'],
  ], sp);
  const ffGold = makeGlow(64, [
    [0, 'rgba(255,250,228,1)'], [0.15, 'rgba(255,222,152,0.75)'], [0.4, 'rgba(255,172,130,0.25)'],
    [1, 'rgba(255,120,120,0)'],
  ], sp);
  const ffRose = makeGlow(64, [
    [0, 'rgba(255,238,244,1)'], [0.15, 'rgba(255,172,204,0.72)'], [0.4, 'rgba(240,112,162,0.24)'],
    [1, 'rgba(220,90,150,0)'],
  ], sp);
  const petals = [];
  for (let i = 0; i < PETAL_RGB.length; i++) {
    petals.push([makePetalSprite(PETAL_RGB[i], false, sp), makePetalSprite(PETAL_RGB[i], true, sp)]);
  }
  // soft moonbeam shaft (fades along its length)
  const bm = makeCanvas(32, 128, sp);
  let bg = bm.g.createLinearGradient(0, 0, 32, 0);
  bg.addColorStop(0, 'rgba(255,214,236,0)');
  bg.addColorStop(0.5, 'rgba(255,214,236,1)');
  bg.addColorStop(1, 'rgba(255,214,236,0)');
  bm.g.fillStyle = bg;
  bm.g.fillRect(0, 0, 32, 128);
  bm.g.globalCompositeOperation = 'destination-in';
  bg = bm.g.createLinearGradient(0, 0, 0, 128);
  bg.addColorStop(0, 'rgba(0,0,0,1)');
  bg.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  bg.addColorStop(1, 'rgba(0,0,0,0)');
  bm.g.fillStyle = bg;
  bm.g.fillRect(0, 0, 32, 128);
  return { glow, rose, ffGold, ffRose, petals, beam: bm.cv };
}

/* ════════════════════════════════════════════════════════════════════════
   NAVE GEOMETRY — a perspective corridor of pointed iron arches
   ════════════════════════════════════════════════════════════════════════ */

const NAVE_N = 6;
const RIB_T = [0, 0.16, 0.34, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

function buildNave(w, h) {
  const N = NAVE_N;
  const n = {
    N, cx: w * 0.5, vy: h * 0.6,
    hw: new Float32Array(N), base: new Float32Array(N), spring: new Float32Array(N),
    apex: new Float32Array(N), ctrl: new Float32Array(N), f: new Float32Array(N),
  };
  const floorY = h * 0.92;
  for (let k = 0; k < N; k++) {
    const f = 1 / (1 + 0.52 * k);
    n.f[k] = f;
    n.hw[k] = w * 0.64 * f;
    n.base[k] = n.vy + (floorY - n.vy) * f;
    n.apex[k] = n.vy - (n.vy + h * 0.14) * f;
    n.spring[k] = n.base[k] + (n.apex[k] - n.base[k]) * 0.5;
    n.ctrl[k] = n.apex[k] + (n.spring[k] - n.apex[k]) * 0.38;
  }
  return n;
}

// side: -1 left / +1 right, t: 0 (base) → 0.5 (springline) → 1 (apex)
function archPoint(n, k, side, t, out) {
  const hw = n.hw[k];
  if (t <= 0.5) {
    const s = t * 2;
    out.x = n.cx + side * hw;
    out.y = n.base[k] + (n.spring[k] - n.base[k]) * s;
  } else {
    const s = (t - 0.5) * 2, q = 1 - s;
    out.x = n.cx + side * hw * (1 - s * s);
    out.y = q * q * n.spring[k] + 2 * q * s * n.ctrl[k] + s * s * n.apex[k];
  }
}

function archPath(g, n, k) {
  const cx = n.cx, hw = n.hw[k], cy = n.ctrl[k];
  g.moveTo(cx - hw, n.base[k]);
  g.lineTo(cx - hw, n.spring[k]);
  g.quadraticCurveTo(cx - hw, cy, cx, n.apex[k]);
  g.quadraticCurveTo(cx + hw, cy, cx + hw, n.spring[k]);
  g.lineTo(cx + hw, n.base[k]);
}

/* ════════════════════════════════════════════════════════════════════════
   STATIC PAINTERS (offscreen caches)
   ════════════════════════════════════════════════════════════════════════ */

function ridge(g, w, y0, amp, color, seed, f) {
  g.beginPath();
  g.moveTo(0, y0 + amp * 3);
  for (let x = 0; x <= w + 8; x += 8) {
    const nn = Math.sin(x * f + seed) * 0.5 + Math.sin(x * f * 2.3 + seed * 1.7) * 0.3 + Math.sin(x * f * 4.1 + seed * 0.6) * 0.2;
    g.lineTo(x, y0 - amp * (0.5 + 0.5 * nn));
  }
  g.lineTo(w + 8, y0 + amp * 3);
  g.closePath();
  g.fillStyle = color;
  g.fill();
}

function drawManor(g, x, y, s) {
  g.fillStyle = 'rgba(30,13,27,1)';
  // main block
  g.fillRect(x - 4.4 * s, y - 1.7 * s, 8.8 * s, 1.7 * s);
  // centre tower + spire
  g.fillRect(x - 0.9 * s, y - 3.4 * s, 1.8 * s, 3.4 * s);
  g.beginPath(); g.moveTo(x - 1.2 * s, y - 3.4 * s); g.lineTo(x, y - 5.4 * s); g.lineTo(x + 1.2 * s, y - 3.4 * s); g.closePath(); g.fill();
  // flank towers
  for (let i = -1; i <= 1; i += 2) {
    const tx = x + i * 4.4 * s;
    g.fillRect(tx - 0.65 * s, y - 2.8 * s, 1.3 * s, 2.8 * s);
    g.beginPath(); g.moveTo(tx - 0.9 * s, y - 2.8 * s); g.lineTo(tx, y - 4.4 * s); g.lineTo(tx + 0.9 * s, y - 2.8 * s); g.closePath(); g.fill();
  }
  // lit windows
  const rng = mulberry32(9);
  for (let row = 0; row < 2; row++) {
    for (let i = -7; i <= 7; i++) {
      if (rng() < 0.28) continue;
      const wx = x + i * 0.56 * s, wy = y - 0.5 * s - row * 0.8 * s;
      g.fillStyle = rng() < 0.5 ? 'rgba(255,206,142,0.85)' : 'rgba(255,170,120,0.7)';
      g.fillRect(wx - 0.11 * s, wy, 0.22 * s, 0.4 * s);
    }
  }
  g.fillStyle = 'rgba(255,214,150,0.9)';
  g.fillRect(x - 0.2 * s, y - 3.0 * s, 0.4 * s, 0.7 * s);
  g.fillRect(x - 0.12 * s, y - 0.9 * s, 0.24 * s, 0.9 * s);
}

function paintBack(g, w, h, n, candles) {
  const cx = n.cx, vy = n.vy, N = n.N, u = Math.min(w, h);
  const P = { x: 0, y: 0 }, Q = { x: 0, y: 0 };
  let gr;

  // ── sky ──
  gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#090510');
  gr.addColorStop(0.28, '#1c0e27');
  gr.addColorStop(0.46, '#3e162d');
  gr.addColorStop(vy / h, '#63243a');
  gr.addColorStop(Math.min(1, vy / h + 0.03), '#3a1526');
  gr.addColorStop(1, '#2c121e');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);

  // ── moon ──
  const mx = w * 0.66, my = h * 0.19, mr = clamp(u * 0.045, 16, 56);
  gr = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 10);
  gr.addColorStop(0, 'rgba(255,226,238,0.36)');
  gr.addColorStop(0.25, 'rgba(228,168,212,0.15)');
  gr.addColorStop(1, 'rgba(120,60,130,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  gr = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
  gr.addColorStop(0, '#fff7f1');
  gr.addColorStop(1, '#e6cde0');
  g.fillStyle = gr;
  g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
  g.fillStyle = 'rgba(176,140,176,0.22)';
  g.beginPath(); g.arc(mx + mr * 0.3, my + mr * 0.2, mr * 0.26, 0, TAU); g.fill();
  g.beginPath(); g.arc(mx - mr * 0.35, my + mr * 0.35, mr * 0.17, 0, TAU); g.fill();
  g.beginPath(); g.arc(mx + mr * 0.05, my - mr * 0.45, mr * 0.12, 0, TAU); g.fill();

  // ── lit clouds ──
  const crng = mulberry32(31);
  for (let i = 0; i < 8; i++) {
    const x = crng() * w, y = h * (0.07 + crng() * 0.42), R = w * (0.12 + crng() * 0.16);
    g.save();
    g.translate(x, y);
    g.scale(1, 0.2);
    gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, 'rgba(158,86,134,0.30)');
    gr.addColorStop(0.55, 'rgba(112,52,98,0.13)');
    gr.addColorStop(1, 'rgba(90,40,90,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.restore();
  }

  // ── horizon haze ──
  g.save();
  g.translate(cx, vy);
  g.scale(1, 0.2);
  gr = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.78);
  gr.addColorStop(0, 'rgba(255,152,150,0.36)');
  gr.addColorStop(0.5, 'rgba(220,100,132,0.15)');
  gr.addColorStop(1, 'rgba(180,70,110,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, w * 0.78, 0, TAU); g.fill();
  g.restore();

  // ── distant garden & manor ──
  ridge(g, w, vy + h * 0.004, h * 0.045, 'rgba(60,25,50,1)', 1.7, 0.0052);
  drawManor(g, cx - w * 0.02, vy + h * 0.008, clamp(w * 0.017, 5, 26));
  ridge(g, w, vy + h * 0.01, h * 0.034, 'rgba(42,18,38,1)', 4.1, 0.0087);

  const trng = mulberry32(515);
  for (let i = 0; i < 44; i++) {
    const x = trng() * w, y0 = vy + h * 0.014, ht = h * (0.03 + trng() * 0.05), tw = ht * (0.15 + trng() * 0.1);
    g.fillStyle = trng() < 0.5 ? 'rgba(28,13,27,1)' : 'rgba(34,15,31,1)';
    if (trng() < 0.62) {
      g.beginPath();
      g.moveTo(x - tw, y0);
      g.quadraticCurveTo(x - tw * 0.9, y0 - ht * 0.55, x, y0 - ht);
      g.quadraticCurveTo(x + tw * 0.9, y0 - ht * 0.55, x + tw, y0);
      g.closePath(); g.fill();
    } else {
      g.beginPath(); g.ellipse(x, y0 - ht * 0.42, tw * 1.5, ht * 0.42, 0, 0, TAU); g.fill();
      g.fillRect(x - tw * 0.18, y0 - ht * 0.1, tw * 0.36, ht * 0.12);
    }
  }
  // fairy lights strung through the garden
  for (let i = 0; i < 18; i++) {
    const x = w * (0.04 + 0.92 * trng()), y = vy + h * (0.004 + trng() * 0.016);
    g.fillStyle = 'rgba(255,190,140,0.12)';
    g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,214,160,0.8)';
    g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill();
  }

  // lawn + mist line
  gr = g.createLinearGradient(0, vy, 0, h);
  gr.addColorStop(0, 'rgba(52,22,42,1)');
  gr.addColorStop(1, 'rgba(24,9,20,1)');
  g.fillStyle = gr;
  g.fillRect(0, vy + h * 0.012, w, h);
  gr = g.createLinearGradient(0, vy - h * 0.04, 0, vy + h * 0.05);
  gr.addColorStop(0, 'rgba(160,76,106,0)');
  gr.addColorStop(0.55, 'rgba(176,84,112,0.30)');
  gr.addColorStop(1, 'rgba(160,76,106,0)');
  g.fillStyle = gr;
  g.fillRect(0, vy - h * 0.04, w, h * 0.09);

  // ── marble floor in perspective ──
  g.save();
  g.beginPath();
  g.moveTo(cx - n.hw[0], h + 20);
  for (let k = 0; k < N; k++) g.lineTo(cx - n.hw[k], n.base[k]);
  for (let k = N - 1; k >= 0; k--) g.lineTo(cx + n.hw[k], n.base[k]);
  g.lineTo(cx + n.hw[0], h + 20);
  g.closePath();
  gr = g.createLinearGradient(0, n.base[N - 1], 0, h);
  gr.addColorStop(0, '#5a2038');
  gr.addColorStop(0.35, '#34132a');
  gr.addColorStop(1, '#150711');
  g.fillStyle = gr;
  g.fill();
  g.clip();

  const yOf = (f) => vy + (h * 0.92 - vy) * f;
  const fOf = (k) => 1 / (1 + 0.52 * k);
  const tileW = w * 0.15;
  const fEnd = n.f[N - 1];
  g.fillStyle = 'rgba(255,205,225,0.032)';
  g.beginPath();
  for (let r = -2; r < 10; r++) {
    const f1 = fOf(r * 0.5), f2 = fOf((r + 1) * 0.5);
    const y1 = yOf(f1), y2 = yOf(f2);
    for (let j = -12; j < 12; j++) {
      if (((r + j) & 1) !== 0) continue;
      g.moveTo(cx + j * tileW * f1, y1);
      g.lineTo(cx + (j + 1) * tileW * f1, y1);
      g.lineTo(cx + (j + 1) * tileW * f2, y2);
      g.lineTo(cx + j * tileW * f2, y2);
      g.closePath();
    }
  }
  g.fill();
  g.strokeStyle = 'rgba(255,196,214,0.07)';
  g.lineWidth = 1;
  g.beginPath();
  for (let r = -2; r <= 10; r++) {
    const y = yOf(fOf(r * 0.5));
    g.moveTo(-w * 0.2, y); g.lineTo(w * 1.2, y);
  }
  for (let j = -12; j <= 12; j++) {
    g.moveTo(cx + j * tileW * fEnd, yOf(fEnd));
    g.lineTo(cx + j * tileW * 2.1, yOf(2.1));
  }
  g.stroke();
  g.restore();

  // ── rose petals scattered down the aisle ──
  const prng = mulberry32(77);
  const petalU = clamp(u / 900, 0.5, 1.4);
  for (let i = 0; i < 280; i++) {
    const aisle = i < 150;
    const f = fEnd * 1.05 + Math.pow(prng(), 1.6) * (1.4 - fEnd);
    const y = yOf(f);
    const x = cx + (prng() - 0.5) * (aisle ? w * 0.17 : w * 0.9) * f;
    const sz = (5 + prng() * 6) * f * petalU * 1.3;
    const col = PETAL_RGB[(prng() * PETAL_RGB.length) | 0];
    g.fillStyle = rgba(col[0], col[1], col[2], 0.5 + prng() * 0.35);
    g.beginPath(); g.ellipse(x, y, sz, sz * 0.42, prng() * PI, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.beginPath(); g.ellipse(x - sz * 0.2, y - sz * 0.08, sz * 0.45, sz * 0.14, 0, 0, TAU); g.fill();
  }

  // ── candles lining the aisle (flames are dynamic) ──
  for (let i = 0; i < candles.length; i += 4) {
    const x = candles[i], y = candles[i + 1], ch = candles[i + 2], cw = ch * 0.3;
    g.fillStyle = 'rgba(120,78,56,1)';
    g.beginPath(); g.ellipse(x, y, cw * 1.25, cw * 0.4, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgb(246,230,206)';
    g.fillRect(x - cw / 2, y - ch, cw, ch);
    g.fillStyle = 'rgba(160,110,100,0.35)';
    g.fillRect(x, y - ch, cw / 2, ch);
    g.fillStyle = 'rgb(255,244,224)';
    g.beginPath(); g.ellipse(x, y - ch, cw / 2, cw * 0.2, 0, 0, TAU); g.fill();
  }

  // ── terrace balustrade at the far end of the nave ──
  const bx0 = cx - n.hw[N - 1], bx1 = cx + n.hw[N - 1], by = n.base[N - 1];
  const bh = h * 0.048;
  g.fillStyle = 'rgba(58,28,46,1)';
  g.fillRect(bx0, by - bh * 0.16, bx1 - bx0, bh * 0.16);
  g.fillRect(bx0, by - bh, bx1 - bx0, bh * 0.13);
  const bw = bh * 0.2, spc = bh * 0.34, cnt = Math.floor((bx1 - bx0) / spc);
  const ym = by - bh * 0.5;
  g.beginPath();
  for (let i = 0; i <= cnt; i++) {
    const x = bx0 + i * spc;
    g.moveTo(x - bw * 0.35, by - bh * 0.87);
    g.lineTo(x + bw * 0.35, by - bh * 0.87);
    g.lineTo(x + bw * 0.2, ym - bh * 0.2);
    g.quadraticCurveTo(x + bw * 0.75, ym, x + bw * 0.3, ym + bh * 0.2);
    g.lineTo(x + bw * 0.4, by - bh * 0.16);
    g.lineTo(x - bw * 0.4, by - bh * 0.16);
    g.lineTo(x - bw * 0.3, ym + bh * 0.2);
    g.quadraticCurveTo(x - bw * 0.75, ym, x - bw * 0.2, ym - bh * 0.2);
    g.closePath();
  }
  g.fillStyle = 'rgba(56,27,45,1)';
  g.fill();
  g.strokeStyle = 'rgba(240,176,204,0.30)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(bx0, by - bh); g.lineTo(bx1, by - bh); g.stroke();

  // ── glass panes (walls + vault) ──
  for (let k = 0; k < N - 1; k++) {
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 1; i < RIB_T.length - 1; i++) {
        const t0 = RIB_T[i], t1 = RIB_T[i + 1];
        archPoint(n, k, s, t0, P); archPoint(n, k + 1, s, t1, Q);
        const ax = P.x, ay = P.y, bx = Q.x, by2 = Q.y;
        g.beginPath();
        g.moveTo(P.x, P.y);
        archPoint(n, k, s, t1, P); g.lineTo(P.x, P.y);
        g.lineTo(Q.x, Q.y);
        archPoint(n, k + 1, s, t0, Q); g.lineTo(Q.x, Q.y);
        g.closePath();
        g.fillStyle = ((k + i) & 1) ? 'rgba(205,150,200,0.045)' : 'rgba(205,150,200,0.02)';
        g.fill();
        if (((k + i) % 3) === 0) {
          gr = g.createLinearGradient(ax, ay, bx, by2);
          gr.addColorStop(0, 'rgba(255,215,235,0.10)');
          gr.addColorStop(1, 'rgba(255,215,235,0)');
          g.fillStyle = gr;
          g.fill();
        }
      }
    }
  }
  void u;
}

/* ── rose vines ── */

const ROSE_TONES = [
  ['rgba(70,11,28,0.98)', 'rgba(108,20,44,0.98)', 'rgba(148,32,60,0.98)', 'rgba(188,56,90,0.97)'],
  ['rgba(112,40,64,0.98)', 'rgba(152,64,92,0.98)', 'rgba(194,98,126,0.98)', 'rgba(226,146,168,0.97)'],
  ['rgba(128,82,84,0.98)', 'rgba(172,120,112,0.98)', 'rgba(214,164,146,0.98)', 'rgba(244,204,184,0.96)'],
];
const LEAF = ['rgba(18,11,18,0.98)', 'rgba(27,17,26,0.97)', 'rgba(22,24,20,0.97)', 'rgba(35,21,31,0.96)'];

function drawRose(g, x, y, r, rot, tone, rng, lightAng) {
  const pal = ROSE_TONES[tone];
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(10,4,9,0.5)';
  g.beginPath(); g.arc(r * 0.06, r * 0.1, r * 1.06, 0, TAU); g.fill();
  g.rotate(rot);
  const dist = [1.0, 0.72, 0.48, 0.26], cnt = [7, 6, 5, 4], pr = [0.5, 0.44, 0.38, 0.3];
  for (let L = 0; L < 4; L++) {
    const off = rng() * TAU;
    for (let i = 0; i < cnt[L]; i++) {
      const a = off + (i * TAU) / cnt[L];
      const px = Math.cos(a) * r * dist[L] * 0.58, py = Math.sin(a) * r * dist[L] * 0.58;
      g.fillStyle = pal[L];
      g.beginPath(); g.ellipse(px, py, r * pr[L], r * pr[L] * 0.8, a, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,170,190,0.13)';
      g.lineWidth = Math.max(0.6, r * 0.035);
      g.beginPath(); g.arc(px, py, r * pr[L] * 0.82, a - 0.8, a + 0.8); g.stroke();
    }
  }
  g.strokeStyle = 'rgba(255,196,206,0.38)';
  g.lineWidth = Math.max(0.7, r * 0.045);
  g.beginPath();
  for (let s = 0; s <= 1.0001; s += 0.07) {
    const aa = s * TAU * 1.7, rr = r * 0.3 * s;
    if (s === 0) g.moveTo(0, 0); else g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
  }
  g.stroke();
  g.restore();
  // lantern-side rim light
  g.save();
  g.translate(x, y);
  g.strokeStyle = 'rgba(255,196,170,0.38)';
  g.lineWidth = Math.max(0.8, r * 0.07);
  g.beginPath(); g.arc(0, 0, r * 0.96, lightAng - 0.75, lightAng + 0.75); g.stroke();
  g.restore();
}

function drawBud(g, x, y, ang, r) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = 'rgba(22,16,20,0.97)';
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(r * 0.55, i * r * 0.45, r * 1.1, i * r * 0.7);
    g.quadraticCurveTo(r * 0.4, i * r * 0.15, 0, 0);
    g.fill();
  }
  g.fillStyle = 'rgba(122,22,48,0.98)';
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(r * 0.4, -r * 0.62, r * 1.25, 0);
  g.quadraticCurveTo(r * 0.4, r * 0.62, 0, 0);
  g.fill();
  g.strokeStyle = 'rgba(240,130,156,0.4)';
  g.lineWidth = Math.max(0.7, r * 0.06);
  g.beginPath(); g.moveTo(r * 0.15, -r * 0.1); g.quadraticCurveTo(r * 0.7, -r * 0.2, r * 1.15, 0); g.stroke();
  g.restore();
}

function drawLeaf(g, x, y, ang, len, tone) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.45, -len * 0.34, len, 0);
  g.quadraticCurveTo(len * 0.45, len * 0.34, 0, 0);
  g.fillStyle = LEAF[tone];
  g.fill();
  g.strokeStyle = 'rgba(160,84,110,0.18)';
  g.lineWidth = 0.7;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.85, 0); g.stroke();
  g.restore();
}

function thorn(g, x, y, ang, len) {
  g.fillStyle = 'rgba(22,10,17,0.97)';
  g.beginPath();
  g.moveTo(x + Math.cos(ang + 1.57) * len * 0.28, y + Math.sin(ang + 1.57) * len * 0.28);
  g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
  g.lineTo(x + Math.cos(ang - 1.57) * len * 0.28, y + Math.sin(ang - 1.57) * len * 0.28);
  g.closePath();
  g.fill();
}

function growVine(o, x, y, a0, steps, wid, depth) {
  if (steps < 3) return;
  const g = o.g, rng = o.rng;
  let a = a0, px = x, py = y;
  for (let i = 0; i < steps; i++) {
    const prog = i / steps;
    let da = a0 - a;
    if (da > PI) da -= TAU; else if (da < -PI) da += TAU;
    a += da * 0.07 + (rng() - 0.5) * 0.6;
    const dIn = (px - o.edgeX) * o.inward;
    if (dIn > o.maxIn) a -= o.inward * 0.2;
    else if (dIn < -o.w * 0.015) a += o.inward * 0.2;
    const nx = px + Math.cos(a) * o.step, ny = py + Math.sin(a) * o.step;
    const lw = Math.max(0.9, wid * (1 - prog * 0.5));
    g.strokeStyle = depth < 2 ? 'rgba(19,10,16,0.98)' : 'rgba(25,12,20,0.97)';
    g.lineWidth = lw;
    g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
    if (rng() < 0.45) thorn(g, nx, ny, a + (rng() < 0.5 ? 1 : -1) * (1.0 + rng() * 0.5), lw * 1.4 + o.u * 0.007);
    if (rng() < 0.6) drawLeaf(g, nx, ny, a + (rng() < 0.5 ? 1 : -1) * (0.6 + rng() * 0.7), o.u * (0.028 + rng() * 0.032) * (1 - depth * 0.12), (rng() * 4) | 0);
    if (rng() < 0.3) drawLeaf(g, nx, ny, a + (rng() < 0.5 ? 1 : -1) * (0.6 + rng() * 0.7), o.u * (0.024 + rng() * 0.028) * (1 - depth * 0.12), (rng() * 4) | 0);
    if (depth < 3 && i > 2 && i < steps - 3 && rng() < (depth === 0 ? 0.15 : 0.1)) {
      growVine(o, nx, ny, a + (rng() < 0.5 ? -1 : 1) * (0.55 + rng() * 0.65), Math.round(steps * (0.3 + rng() * 0.25)), wid * 0.62, depth + 1);
    }
    if (depth <= 1 && i > 4 && rng() < 0.045) o.addRose(nx, ny);
    px = nx; py = ny;
  }
  if (depth >= 1) {
    if (rng() < 0.72) o.addRose(px, py);
    else o.buds.push({ x: px, y: py, a, r: o.u * 0.022 });
  }
}

function garland(o, n, k, side, t0, t1, wid) {
  const g = o.g, rng = o.rng;
  const P = { x: 0, y: 0 }, Q = { x: 0, y: 0 };
  const steps = Math.max(10, Math.round((t1 - t0) * 70));
  archPoint(n, k, side, t0, P);
  for (let i = 1; i <= steps; i++) {
    archPoint(n, k, side, t0 + ((t1 - t0) * i) / steps, Q);
    const a = Math.atan2(Q.y - P.y, Q.x - P.x);
    g.strokeStyle = 'rgba(19,10,16,0.98)';
    g.lineWidth = wid * (0.7 + rng() * 0.5);
    g.beginPath(); g.moveTo(P.x, P.y); g.lineTo(Q.x, Q.y); g.stroke();
    if (rng() < 0.55) drawLeaf(g, Q.x, Q.y, a + (rng() < 0.5 ? 1 : -1) * (0.7 + rng() * 0.6), o.u * (0.024 + rng() * 0.026), (rng() * 4) | 0);
    if (rng() < 0.4) thorn(g, Q.x, Q.y, a + (rng() < 0.5 ? 1 : -1) * 1.2, wid * 1.5 + o.u * 0.006);
    if (rng() < 0.1) o.addRose(Q.x, Q.y);
    if (rng() < 0.13) {
      // trailing tendril
      g.strokeStyle = 'rgba(21,11,18,0.96)';
      g.lineWidth = Math.max(0.8, wid * 0.45);
      const dl = o.u * (0.03 + rng() * 0.05);
      g.beginPath(); g.moveTo(Q.x, Q.y);
      g.quadraticCurveTo(Q.x + (rng() - 0.5) * dl, Q.y + dl * 0.5, Q.x + (rng() - 0.5) * dl * 0.6, Q.y + dl);
      g.stroke();
      drawLeaf(g, Q.x, Q.y + dl, PI * 0.5 + (rng() - 0.5), o.u * 0.022, (rng() * 4) | 0);
    }
    P.x = Q.x; P.y = Q.y;
  }
}

function paintVines(g, w, h, n) {
  const u = Math.min(w, h);
  const roses = [];
  const buds = [];
  const rngRose = mulberry32(4242);
  for (let si = 0; si < 2; si++) {
    const side = si === 0 ? -1 : 1;
    const o = {
      g, rng: mulberry32(side < 0 ? 7741 : 9103), w, h, u, side,
      inward: -side, edgeX: side < 0 ? 0 : w,
      maxIn: w * (w > h ? 0.17 : 0.3), step: Math.max(7, u * 0.026),
      buds,
    };
    o.addRose = function (x, y) {
      const r = clamp(u * (0.024 + rngRose() * 0.024), 12, 44);
      roses.push({ x, y, r, rot: rngRose() * TAU, tone: (rngRose() * 3) | 0, la: Math.atan2(h * 0.35 - y, n.cx - x) });
    };
    const steps = Math.round((h * 0.98) / (o.step * 0.8));
    growVine(o, o.edgeX + o.inward * w * 0.012, h * 1.03, -PI / 2 + o.inward * 0.18, steps, u * 0.014 + 3, 0);
    growVine(o, o.edgeX + o.inward * w * 0.075, h * 1.03, -PI / 2 - o.inward * 0.1, Math.round(steps * 0.62), u * 0.01 + 2, 1);
    // vines creeping along the glasshouse ribs
    garland(o, n, 1, side, 0.3, 0.74, Math.max(2, u * 0.006));
    garland(o, n, 2, side, 0.4, 0.66, Math.max(1.6, u * 0.0045));
  }
  for (let i = 0; i < buds.length; i++) drawBud(g, buds[i].x, buds[i].y, buds[i].a, buds[i].r);
  for (let i = 0; i < roses.length; i++) {
    const r = roses[i];
    drawRose(g, r.x, r.y, r.r, r.rot, r.tone, rngRose, r.la);
  }
}

function ironStroke(g, lw, draw) {
  g.lineWidth = lw;
  g.strokeStyle = 'rgba(22,11,19,0.97)';
  g.beginPath(); draw(); g.stroke();
  g.save();
  g.translate(-lw * 0.22, -lw * 0.22);
  g.lineWidth = Math.max(0.6, lw * 0.2);
  g.strokeStyle = 'rgba(236,172,204,0.22)';
  g.beginPath(); draw(); g.stroke();
  g.restore();
}

function paintFront(g, w, h, n) {
  const u = Math.min(w, h), cx = n.cx, N = n.N;
  const P = { x: 0, y: 0 }, Q = { x: 0, y: 0 };
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // stone dado along the base of the glass walls
  for (let k = 0; k < N - 1; k++) {
    for (let s = -1; s <= 1; s += 2) {
      const x0 = cx + s * n.hw[k], x1 = cx + s * n.hw[k + 1];
      const y0 = n.base[k], y1 = n.base[k + 1];
      const d0 = h * 0.09 * n.f[k], d1 = h * 0.09 * n.f[k + 1];
      g.fillStyle = 'rgba(34,17,29,0.98)';
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x1, y1 - d1); g.lineTo(x0, y0 - d0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(226,158,184,0.22)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x0, y0 - d0); g.lineTo(x1, y1 - d1); g.stroke();
    }
  }

  // longitudinal ribs between arches
  for (let k = 0; k < N - 1; k++) {
    const lw = Math.max(0.9, u * 0.0068 * n.f[k]);
    ironStroke(g, lw, () => {
      for (let ti = 1; ti < RIB_T.length; ti++) {
        for (let s = -1; s <= 1; s += 2) {
          if (RIB_T[ti] === 1 && s === 1) continue;
          archPoint(n, k, s, RIB_T[ti], P);
          archPoint(n, k + 1, s, RIB_T[ti], Q);
          g.moveTo(P.x, P.y); g.lineTo(Q.x, Q.y);
        }
      }
    });
  }

  // arches
  for (let k = 0; k < N; k++) {
    ironStroke(g, Math.max(1.4, u * 0.0125 * n.f[k]), () => archPath(g, n, k));
  }

  // rivets & bosses
  for (let k = 1; k < N; k++) {
    const rr = Math.max(1.3, u * 0.006 * n.f[k] * 1.6);
    for (let ti = 1; ti < RIB_T.length; ti++) {
      for (let s = -1; s <= 1; s += 2) {
        if (RIB_T[ti] === 1 && s === 1) continue;
        archPoint(n, k, s, RIB_T[ti], P);
        g.fillStyle = 'rgba(34,17,29,1)';
        g.beginPath(); g.arc(P.x, P.y, rr, 0, TAU); g.fill();
        g.fillStyle = 'rgba(240,180,206,0.3)';
        g.beginPath(); g.arc(P.x - rr * 0.3, P.y - rr * 0.3, rr * 0.35, 0, TAU); g.fill();
      }
    }
  }

  // fairy-light wires draped along the glass walls
  const C = { x: 0, y: 0 };
  g.strokeStyle = 'rgba(20,10,16,0.9)';
  g.lineWidth = Math.max(0.8, u * 0.0012);
  for (let k = 1; k <= 3; k++) {
    for (let ti = 0; ti < SWAG_T.length; ti++) {
      for (let s = -1; s <= 1; s += 2) {
        swagCurve(n, k, s, SWAG_T[ti], h, P, Q, C);
        g.beginPath(); g.moveTo(P.x, P.y); g.quadraticCurveTo(C.x, C.y, Q.x, Q.y); g.stroke();
      }
    }
  }

  paintVines(g, w, h, n);
}

function paintOverlay(g, w, h) {
  const R = Math.hypot(w, h) * 0.5;
  let gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, R * 1.02);
  gr.addColorStop(0, 'rgba(24,6,18,0)');
  gr.addColorStop(0.55, 'rgba(28,8,22,0.22)');
  gr.addColorStop(1, 'rgba(14,3,12,0.74)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  // reading veil — keeps the centre column calm and high-contrast
  gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, 'rgba(10,3,10,0)');
  gr.addColorStop(0.26, 'rgba(10,3,10,0)');
  gr.addColorStop(0.38, 'rgba(14,4,12,0.2)');
  gr.addColorStop(0.62, 'rgba(14,4,12,0.2)');
  gr.addColorStop(0.74, 'rgba(10,3,10,0)');
  gr.addColorStop(1, 'rgba(10,3,10,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(10,3,14,0.28)');
  gr.addColorStop(0.2, 'rgba(10,3,14,0)');
  gr.addColorStop(0.8, 'rgba(20,5,14,0)');
  gr.addColorStop(1, 'rgba(20,5,14,0.34)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}

/* ── lantern sprites (iron cage + lit glass, pre-rendered per size) ── */

function makeLanternSprites(s, sp) {
  const W = Math.ceil(s * 3), H = Math.ceil(s * 2.9);
  const ox = W / 2, oy = s * 1.62;
  const B = makeCanvas(W, H, sp), F = makeCanvas(W, H, sp);
  const tw = s * 0.46, bw = s * 0.35, yt = -s * 0.6, yb = s * 0.62;

  // back layer: lit glass + candle
  let g = B.g;
  g.translate(ox, oy);
  let gr = g.createLinearGradient(0, yt, 0, yb);
  gr.addColorStop(0, 'rgba(255,196,140,0.62)');
  gr.addColorStop(0.5, 'rgba(255,226,180,0.78)');
  gr.addColorStop(1, 'rgba(255,160,110,0.62)');
  g.beginPath(); g.moveTo(-tw, yt); g.lineTo(tw, yt); g.lineTo(bw, yb); g.lineTo(-bw, yb); g.closePath();
  g.fillStyle = gr; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.beginPath(); g.moveTo(-tw * 0.75, yt + s * 0.08); g.lineTo(-tw * 0.45, yt + s * 0.08); g.lineTo(-bw * 0.42, yb - s * 0.1); g.lineTo(-bw * 0.72, yb - s * 0.1); g.closePath(); g.fill();
  const cw = s * 0.12;
  g.fillStyle = 'rgba(250,238,214,1)';
  g.fillRect(-cw / 2, s * 0.18, cw, yb - s * 0.2 - s * 0.18);
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.fillRect(-cw / 2, s * 0.18, cw * 0.3, yb - s * 0.2 - s * 0.18);
  g.fillStyle = 'rgba(176,122,76,0.95)';
  g.fillRect(-s * 0.2, yb - s * 0.05, s * 0.4, s * 0.05);

  // front layer: iron
  g = F.g;
  g.translate(ox, oy);
  const iron = 'rgba(22,10,18,1)';
  g.strokeStyle = iron; g.fillStyle = iron;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = Math.max(1.4, s * 0.06);
  g.beginPath();
  const fr = [-1, -0.36, 0.36, 1];
  for (let i = 0; i < 4; i++) { g.moveTo(fr[i] * tw, yt); g.lineTo(fr[i] * bw, yb); }
  g.stroke();
  g.lineWidth = s * 0.07;
  g.beginPath(); g.moveTo(-tw, yt); g.lineTo(tw, yt); g.moveTo(-bw, yb); g.lineTo(bw, yb); g.stroke();
  const mw = tw + (bw - tw) * 0.49;
  g.lineWidth = s * 0.04;
  g.beginPath(); g.moveTo(-mw, 0); g.lineTo(mw, 0); g.stroke();
  // scroll curls
  g.lineWidth = s * 0.035;
  g.beginPath(); g.arc(-tw * 0.62, yt + s * 0.14, s * 0.09, -0.4, PI * 1.2); g.stroke();
  g.beginPath(); g.arc(tw * 0.62, yt + s * 0.14, s * 0.09, PI - 1.2 + PI * 0.0, TAU + 0.4, true); g.stroke();
  // domed cap
  g.beginPath();
  g.moveTo(-tw - s * 0.1, yt);
  g.quadraticCurveTo(-tw * 0.95, -s * 0.92, 0, -s * 1.14);
  g.quadraticCurveTo(tw * 0.95, -s * 0.92, tw + s * 0.1, yt);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,190,140,0.28)';
  g.lineWidth = 1;
  g.stroke();
  // finial + ring
  g.fillStyle = iron;
  g.beginPath(); g.arc(0, -s * 1.2, s * 0.07, 0, TAU); g.fill();
  g.fillRect(-s * 0.03, -s * 1.3, s * 0.06, s * 0.1);
  g.strokeStyle = iron;
  g.lineWidth = s * 0.035;
  g.beginPath(); g.arc(0, -s * 1.38, s * 0.12, 0, TAU); g.stroke();
  // base + drop
  g.beginPath();
  g.moveTo(-bw - s * 0.08, yb); g.lineTo(bw + s * 0.08, yb); g.lineTo(bw * 0.6, yb + s * 0.12);
  g.lineTo(0, yb + s * 0.34); g.lineTo(-bw * 0.6, yb + s * 0.12); g.closePath();
  g.fill();
  g.beginPath(); g.arc(0, yb + s * 0.38, s * 0.05, 0, TAU); g.fill();

  return { back: B.cv, front: F.cv, W, H, oy };
}

/* ════════════════════════════════════════════════════════════════════════
   CACHE MANAGEMENT
   ════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════
   ROMANCE LAYER — candlelit aisle, fairy-light swags, moonbeams,
   a waltzing couple, hearts on tap
   ════════════════════════════════════════════════════════════════════════ */

const CANDLE_K = [0.5, 1.1, 1.8, 2.5, 3.3, 4.2];

function buildCandles(n, w, h) {
  const out = new Float32Array(CANDLE_K.length * 2 * 4);
  const rng = mulberry32(61);
  let o = 0;
  for (let i = 0; i < CANDLE_K.length; i++) {
    const f = 1 / (1 + 0.52 * CANDLE_K[i]);
    for (let s = -1; s <= 1; s += 2) {
      out[o++] = n.cx + s * w * 0.27 * f;
      out[o++] = n.vy + (h * 0.92 - n.vy) * f;
      out[o++] = h * 0.06 * f;
      out[o++] = rng() * TAU;
    }
  }
  return out;
}

const SWAG_T = [0.55, 0.8];

function swagCurve(n, k, side, t, h, P, Q, C) {
  archPoint(n, k, side, t, P);
  archPoint(n, k + 1, side, t, Q);
  C.x = (P.x + Q.x) * 0.5;
  C.y = (P.y + Q.y) * 0.5 + h * 0.044 * n.f[k];
}

function fillBulbs(n, h) {
  const out = new Float32Array(3 * SWAG_T.length * 2 * 5 * 4);
  const P = { x: 0, y: 0 }, Q = { x: 0, y: 0 }, C = { x: 0, y: 0 };
  const rng = mulberry32(88);
  let o = 0;
  for (let k = 1; k <= 3; k++) {
    for (let ti = 0; ti < SWAG_T.length; ti++) {
      for (let s = -1; s <= 1; s += 2) {
        swagCurve(n, k, s, SWAG_T[ti], h, P, Q, C);
        for (let j = 1; j <= 5; j++) {
          const u = j / 6, v = 1 - u;
          out[o++] = v * v * P.x + 2 * u * v * C.x + u * u * Q.x;
          out[o++] = v * v * P.y + 2 * u * v * C.y + u * u * Q.y;
          out[o++] = rng() * TAU;
          out[o++] = 1.5 + rng() * 2.5;
        }
      }
    }
  }
  return out;
}

const BEAM_ANG = [-0.14, 0.08, 0.3, 0.52, 0.74];
const BEAM_W = [0.12, 0.07, 0.15, 0.09, 0.12];

function drawBeams(c, st, ts, w, h, m) {
  const S = st.sprites, u = Math.min(w, h);
  const mx = w * 0.66, my = h * 0.19;
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < BEAM_ANG.length; i++) {
    const a = BEAM_ANG[i] + Math.sin(ts * 0.07 + i) * 0.03;
    const al = (0.045 + 0.03 * Math.sin(ts * 0.3 + i * 1.9)) * (1 - 0.6 * m.storm) * (1 - 0.4 * m.dark);
    const bw = u * BEAM_W[i];
    c.globalAlpha = Math.max(0, al);
    c.save();
    c.translate(mx, my);
    c.rotate(a);
    c.drawImage(S.beam, -bw / 2, 0, bw, h * 1.25);
    c.restore();
  }
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
}

function drawCandles(c, st, ts, m) {
  const C = st.candles, S = st.sprites;
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < C.length; i += 4) {
    const x = C[i], y = C[i + 1], ch = C[i + 2], ph = C[i + 3];
    const fl = 0.5 * Math.sin(ts * 8.1 + ph) + 0.3 * Math.sin(ts * 13.7 + ph * 2.1) + 0.2 * Math.sin(ts * 5.3 + ph * 0.7);
    const I = (0.75 + 0.2 * fl) * (0.75 + 0.5 * m.warm);
    const R = ch * 3.4;
    c.globalAlpha = clamp(0.3 * I);
    c.drawImage(S.glow, x - R, y - ch - R, R * 2, R * 2);
    c.globalAlpha = clamp(0.24 * I);
    c.drawImage(S.glow, x - ch * 5, y - ch * 0.5, ch * 10, ch * 1.1);
  }
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  for (let i = 0; i < C.length; i += 4) {
    const x = C[i], y = C[i + 1], ch = C[i + 2], ph = C[i + 3];
    const fl = 0.5 * Math.sin(ts * 8.1 + ph) + 0.3 * Math.sin(ts * 13.7 + ph * 2.1) + 0.2 * Math.sin(ts * 5.3 + ph * 0.7);
    const fh = ch * 0.3 * (1 + 0.14 * fl), fw = ch * 0.06, sw = (Math.sin(ts * 5.2 + ph) * 0.5 + fl * 0.5) * ch * 0.05;
    c.save();
    c.translate(x, y - ch);
    c.fillStyle = 'rgba(255,150,60,0.9)';
    flamePath(c, 0, fh, fw * 1.35, sw); c.fill();
    c.fillStyle = 'rgba(255,214,130,0.95)';
    flamePath(c, 0, fh * 0.8, fw * 0.95, sw * 0.8); c.fill();
    c.fillStyle = 'rgb(255,250,225)';
    flamePath(c, 0, fh * 0.48, fw * 0.5, sw * 0.5); c.fill();
    c.restore();
  }
}

function drawBulbs(c, st, ts, m) {
  const B = st.bulbs, S = st.sprites;
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < B.length; i += 4) {
    const tw = 0.55 + 0.45 * Math.sin(ts * B[i + 3] + B[i + 2]);
    const a = clamp(tw * (0.55 + 0.4 * m.warm));
    const sz = 10 + 5 * tw;
    c.globalAlpha = a;
    c.drawImage(S.ffGold, B[i] - sz, B[i + 1] - sz, sz * 2, sz * 2);
    c.globalAlpha = clamp(a * 1.1);
    c.fillStyle = 'rgb(255,238,204)';
    c.beginPath(); c.arc(B[i], B[i + 1], 1.4, 0, TAU); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
}

// a tiny couple waltzing at the far end of the nave
function drawCouple(c, S, n, ts, w, h, m) {
  const q = h * 0.0088;
  const x = n.cx + Math.sin(ts * 0.32) * w * 0.03;
  const y = n.base[n.N - 1] + h * 0.032;
  const turn = ts * 1.05, cs = Math.cos(turn);
  const mag = 0.4 + 0.6 * Math.abs(cs), dir = cs >= 0 ? 1 : -1;
  const bob = Math.sin(ts * 3.15) * q * 0.22;
  const flare = q * (1.9 + 0.55 * Math.sin(turn * 2));

  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.16 * (0.6 + 0.6 * m.warm);
  c.drawImage(S.glow, x - q * 14, y - q * 13, q * 28, q * 18);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 0.95;

  c.save();
  c.translate(x, y + bob);
  c.scale(dir * mag, 1);
  c.lineCap = 'round';
  // him
  c.fillStyle = 'rgb(24,10,20)';
  c.fillRect(-1.7 * q, -3.6 * q, 0.55 * q, 3.6 * q);
  c.fillRect(-1.05 * q, -3.6 * q, 0.55 * q, 3.6 * q);
  c.beginPath();
  c.moveTo(-1.95 * q, -3.3 * q); c.lineTo(-0.5 * q, -3.3 * q); c.lineTo(-0.45 * q, -6.0 * q); c.lineTo(-1.95 * q, -6.0 * q); c.closePath();
  c.moveTo(-1.95 * q, -3.3 * q); c.lineTo(-2.6 * q, -2.1 * q); c.lineTo(-1.6 * q, -3.3 * q); c.closePath();
  c.fill();
  c.beginPath(); c.arc(-1.2 * q, -6.8 * q, 0.55 * q, 0, TAU); c.fill();
  c.strokeStyle = 'rgb(24,10,20)';
  c.lineWidth = 0.42 * q;
  c.beginPath(); c.moveTo(-0.5 * q, -5.7 * q); c.lineTo(0.55 * q, -6.1 * q); c.stroke();
  // her
  c.fillStyle = 'rgb(112,28,60)';
  c.beginPath();
  c.moveTo(0.8 * q, -4.4 * q);
  c.quadraticCurveTo(1.35 * q - flare * 1.1, -2.2 * q, 1.35 * q - flare, -0.4 * q);
  c.quadraticCurveTo(1.35 * q, 0.1 * q, 1.35 * q + flare, -0.4 * q);
  c.quadraticCurveTo(1.35 * q + flare * 1.1, -2.2 * q, 1.9 * q, -4.4 * q);
  c.lineTo(2.0 * q, -5.9 * q); c.lineTo(0.7 * q, -5.9 * q);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(255,170,196,0.22)';
  c.beginPath(); c.ellipse(1.35 * q - flare * 0.2, -1.4 * q, flare * 0.45, q * 0.7, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgb(40,16,30)';
  c.beginPath(); c.arc(1.35 * q, -6.55 * q, 0.5 * q, 0, TAU); c.fill();
  c.beginPath(); c.arc(1.7 * q, -7.0 * q, 0.28 * q, 0, TAU); c.fill();
  c.strokeStyle = 'rgb(112,28,60)';
  c.beginPath(); c.moveTo(0.8 * q, -5.5 * q); c.lineTo(0.55 * q, -6.1 * q); c.stroke();
  c.restore();
  c.globalAlpha = 1;
}

const HEART_COL = ['rgb(255,170,196)', 'rgb(240,120,160)', 'rgb(255,214,186)'];

function heartPath(c, s) {
  c.beginPath();
  c.moveTo(0, s * 0.35);
  c.bezierCurveTo(-s * 0.9, -s * 0.2, -s * 0.5, -s * 0.85, 0, -s * 0.4);
  c.bezierCurveTo(s * 0.5, -s * 0.85, s * 0.9, -s * 0.2, 0, s * 0.35);
  c.closePath();
}

function drawHearts(c, st, d) {
  const H = st.hearts, S = st.sprites;
  for (let i = 0; i < H.length; i++) {
    const p = H[i];
    if (!p.on) continue;
    p.age += d;
    if (p.age < 0) continue;
    const k = p.age / p.life;
    if (k >= 1) { p.on = false; continue; }
    p.vy *= Math.exp(-0.35 * d);
    p.y += p.vy * d;
    p.x += (p.vx + Math.sin(p.age * 3 + p.rot) * 18) * d;
    const al = Math.pow(Math.sin(PI * k), 0.7);
    const s = p.size * (0.6 + 0.4 * Math.min(1, p.age * 4));
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = al * 0.55;
    c.drawImage(S.rose, p.x - s * 2.4, p.y - s * 2.4, s * 4.8, s * 4.8);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = al * 0.92;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(Math.sin(p.age * 2.4 + p.rot) * 0.35);
    heartPath(c, s);
    c.fillStyle = HEART_COL[p.ci];
    c.fill();
    c.restore();
  }
  c.globalAlpha = 1;
}

function ensureCaches(st, w, h) {
  const dpr = getDpr();
  const cacheScale = Math.min(1.5, Math.max(1, dpr));
  const cs = st.canvases;
  if (cs && cs.w === w && cs.h === h && cs.scale === cacheScale) return;

  const nave = buildNave(w, h);
  st.nave = nave;
  const back = makeCanvas(w, h, cacheScale);
  st.candles = buildCandles(nave, w, h);
  st.bulbs = fillBulbs(nave, h);
  paintBack(back.g, w, h, nave, st.candles);
  const front = makeCanvas(w, h, cacheScale);
  paintFront(front.g, w, h, nave);
  const overlay = makeCanvas(w, h, 0.5);
  paintOverlay(overlay.g, w, h);
  st.canvases = { w, h, scale: cacheScale, back: back.cv, front: front.cv, overlay: overlay.cv };

  const u = Math.min(w, h);
  const sp = Math.min(2, Math.max(1, dpr));
  for (let i = 0; i < st.lanterns.length; i++) {
    const l = st.lanterns[i];
    l.s = clamp(u * 0.044, 20, 44) * l.sizeK;
    l.spr = makeLanternSprites(l.s, sp);
  }
}

/* ════════════════════════════════════════════════════════════════════════
   DYNAMIC LAYERS
   ════════════════════════════════════════════════════════════════════════ */

function updateLanterns(st, d, ts, w, h, m) {
  const L = st.lanterns;
  const steps = Math.max(1, Math.ceil(d / 0.01));
  const hd = d / steps;
  const damping = Math.exp(-0.34 * hd);
  const stormK = 1 + m.storm * 3.5;
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    l.len = h * l.lenK;
    const gl = 1000 / l.len; // g / length
    const wind = (Math.sin(ts * 0.55 + l.phase) * 0.2 + Math.sin(ts * 0.21 + l.phase * 1.7) * 0.14) * stormK + m.storm * 0.55;
    for (let s = 0; s < steps; s++) {
      const accel = -gl * Math.sin(l.angle) + wind;
      l.vAngle = (l.vAngle + accel * hd) * damping;
      l.angle += l.vAngle * hd;
    }
    if (l.angle > 0.9) { l.angle = 0.9; l.vAngle *= -0.3; }
    else if (l.angle < -0.9) { l.angle = -0.9; l.vAngle *= -0.3; }
    const sn = Math.sin(l.angle), cn = Math.cos(l.angle);
    l.ax = l.rx * w;
    l.ay = -4;
    l.ringX = l.ax + sn * l.len;
    l.ringY = l.ay + cn * l.len;
    l.x = l.ringX + sn * 1.5 * l.s;
    l.y = l.ringY + cn * 1.5 * l.s;
    l.flick = 0.5 * Math.sin(ts * 7.3 + l.phase) + 0.3 * Math.sin(ts * 12.1 + l.phase * 2.3) + 0.2 * Math.sin(ts * 19.7 + l.phase * 0.5);
    l.I = (0.82 + 0.12 * l.flick) * (0.8 + 0.45 * m.warm);
  }
}

function flamePath(c, b, hh, ww, sw) {
  c.beginPath();
  c.moveTo(0, b);
  c.bezierCurveTo(-ww, b - hh * 0.28, -ww * 0.55, b - hh * 0.7, sw, b - hh);
  c.bezierCurveTo(ww * 0.55, b - hh * 0.7, ww, b - hh * 0.28, 0, b);
  c.closePath();
}

function drawFlame(c, s, fl, ts, ph) {
  const base = s * 0.17;
  const fh = s * 0.36 * (1 + 0.14 * fl);
  const fw = s * 0.085 * (1 - 0.1 * fl);
  const sw = (Math.sin(ts * 5.2 + ph) * 0.5 + fl * 0.5) * s * 0.04;
  c.fillStyle = 'rgba(255,150,60,0.85)';
  flamePath(c, base, fh, fw * 1.35, sw); c.fill();
  c.fillStyle = 'rgba(255,214,130,0.95)';
  flamePath(c, base, fh * 0.82, fw * 0.95, sw * 0.8); c.fill();
  c.fillStyle = 'rgb(255,250,225)';
  flamePath(c, base - s * 0.01, fh * 0.5, fw * 0.55, sw * 0.5); c.fill();
  c.strokeStyle = 'rgba(40,22,18,0.9)';
  c.lineWidth = Math.max(0.8, s * 0.025);
  c.beginPath(); c.moveTo(0, base + s * 0.02); c.lineTo(0, base - s * 0.03); c.stroke();
}

function drawLanterns(c, st, ts, w, h, m) {
  const L = st.lanterns, S = st.sprites, u = Math.min(w, h);

  // chains (dashed round caps read as links)
  c.lineCap = 'round';
  c.setLineDash(st.dash);
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    c.strokeStyle = 'rgba(30,16,26,0.95)';
    c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(l.ax, l.ay); c.lineTo(l.ringX, l.ringY); c.stroke();
    c.strokeStyle = 'rgba(255,196,160,0.3)';
    c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(l.ax, l.ay); c.lineTo(l.ringX, l.ringY); c.stroke();
  }
  c.setLineDash(st.noDash);
  for (let i = 0; i < L.length; i++) {
    c.fillStyle = 'rgba(28,14,24,1)';
    c.beginPath(); c.arc(L[i].ax, 0, 5, 0, TAU); c.fill();
  }

  // light: multi-layer additive glow + floor pools
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    const I = l.I * (1 - 0.35 * m.dark * 0) * l.gain;
    const gl = clamp(u * 0.19, 90, 220) * l.sizeK;
    let R = gl * 3.4;
    c.globalAlpha = clamp(0.2 * I);
    c.drawImage(S.rose, l.x - R, l.y - R, R * 2, R * 2);
    R = gl * 1.9;
    c.globalAlpha = clamp(0.2 * I);
    c.drawImage(S.glow, l.x - R, l.y - R, R * 2, R * 2);
    R = gl * 0.95;
    c.globalAlpha = clamp(0.32 * I);
    c.drawImage(S.glow, l.x - R, l.y - R, R * 2, R * 2);
    R = l.s * 1.6;
    c.globalAlpha = clamp(0.55 * I);
    c.drawImage(S.glow, l.x - R, l.y - R, R * 2, R * 2);
    // reflection pool on the marble
    const fx = l.x * 0.9 + w * 0.05, fy = h * 0.86, fR = gl * 1.5;
    c.globalAlpha = clamp(0.18 * I);
    c.drawImage(S.glow, fx - fR, fy - fR * 0.14, fR * 2, fR * 0.28);
  }
  c.globalCompositeOperation = 'source-over';

  // bodies
  for (let i = 0; i < L.length; i++) {
    const l = L[i], sp = l.spr, s = l.s;
    c.save();
    c.translate(l.x, l.y);
    c.rotate(-l.angle);
    c.globalAlpha = clamp(0.78 + 0.22 * l.I);
    c.drawImage(sp.back, -sp.W / 2, -sp.oy, sp.W, sp.H);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = clamp(0.55 * l.I);
    c.drawImage(S.glow, -s * 1.3, -s * 1.32, s * 2.6, s * 2.6);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    drawFlame(c, s, l.flick, ts, l.phase);
    c.drawImage(sp.front, -sp.W / 2, -sp.oy, sp.W, sp.H);
    c.restore();
  }
  c.globalAlpha = 1;
}

function stepAndDrawPetals(c, st, from, to, d, ts, w, h, windX) {
  const spr = st.sprites.petals, ptr = st.ptr, ps = ptr.speed, P = st.petals;
  const cx = w * 0.5, colW = w * 0.2;
  const decay = Math.exp(-1.7 * d);
  const relax = Math.min(1, d * 1.4);
  for (let i = from; i < to; i++) {
    const p = P[i];
    p.vFlip += (p.vFlip0 - p.vFlip) * relax;
    p.vAngle += (p.vAngle0 - p.vAngle) * relax;
    p.flip += p.vFlip * d;
    p.angle += p.vAngle * d;
    p.tilt += p.vTilt * d;
    p.sway += p.swayRate * d;

    // pointer vortex
    if (ps > 25) {
      const dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy;
      if (d2 < 36100) {
        const dist = Math.sqrt(d2) || 1, f = 1 - dist / 190;
        p.ix += (ptr.vx * f * 0.9 + (-dy / dist) * ps * f * 0.7) * d * 3;
        p.iy += (ptr.vy * f * 0.9 + (dx / dist) * ps * f * 0.7) * d * 3;
        p.ix = clamp(p.ix, -450, 450);
        p.iy = clamp(p.iy, -450, 450);
      }
    }
    p.ix *= decay;
    p.iy *= decay;

    const flat = 0.72 + 0.28 * Math.abs(Math.sin(p.tilt));
    const vx = p.vx0 + windX * (0.5 + 0.5 * p.z) + Math.sin(p.sway) * p.swayAmp + p.ix;
    const vy = p.vy0 * p.z * flat + p.iy + Math.cos(p.sway * 0.8) * 8;
    p.x += vx * (0.55 + 0.45 * p.z) * d;
    p.y += vy * d;

    if (p.y > h + 40) {
      p.y = -40 - Math.random() * 80;
      p.x = Math.random() * (w + 80) - 40;
      p.ix = 0; p.iy = 0;
    }
    if (p.x < -50) p.x = w + 50;
    else if (p.x > w + 50) p.x = -50;

    const fs = Math.cos(p.flip);
    const af = Math.abs(fs);
    const sx = af < 0.07 ? 0.07 : af;
    const sy = 0.84 + 0.16 * Math.abs(Math.cos(p.tilt));
    const H = p.size * p.z, W = H * (PW / PH);
    const cf = 0.5 + 0.5 * clamp((Math.abs(p.x - cx) - w * 0.1) / colW);
    c.globalAlpha = p.alpha * cf;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.angle);
    c.scale(sx, sy);
    c.drawImage(fs >= 0 ? spr[p.ci][0] : spr[p.ci][1], -W / 2, -H / 2, W, H);
    c.restore();
  }
}

function drawFireflies(c, st, ts, d, w, h, m) {
  const S = st.sprites, ptr = st.ptr, ps = ptr.speed, F = st.fireflies;
  const cx = w * 0.5, colW = w * 0.2;
  const bright = (0.7 + 0.5 * m.warm) * (1 - 0.15 * m.storm);
  const vdec = Math.exp(-2.2 * d), pdec = Math.exp(-0.55 * d);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    f.svx *= vdec; f.svy *= vdec;
    f.sx = (f.sx + f.svx * d) * pdec;
    f.sy = (f.sy + f.svy * d) * pdec;
    const x = f.fx * w + Math.sin(ts * f.f1 + f.p1) * f.a1 + Math.sin(ts * f.f2 + f.p2) * f.a2 + f.sx;
    const y = f.fy * h + Math.cos(ts * f.f3 + f.p3) * f.a1 * 0.8 + Math.sin(ts * f.f4 + f.p4) * f.a2 * 0.6 + f.sy;
    if (ps > 40) {
      const dx = x - ptr.x, dy = y - ptr.y, d2 = dx * dx + dy * dy;
      if (d2 < 25600) {
        const dist = Math.sqrt(d2) || 1, k = 1 - dist / 160;
        f.svx = clamp(f.svx + (dx / dist) * k * ps * d * 2.2, -260, 260);
        f.svy = clamp(f.svy + (dy / dist) * k * ps * d * 2.2, -260, 260);
      }
    }
    const pu = 0.5 + 0.5 * Math.sin(ts * f.ps + f.pp);
    const al = clamp((0.18 + 0.82 * pu * pu * (3 - 2 * pu)) * bright);
    const cf = 0.65 + 0.35 * clamp((Math.abs(x - cx) - w * 0.1) / colW);
    const sz = f.r * (8 + 7 * pu);
    c.globalAlpha = clamp(al * 0.9 * cf);
    c.drawImage(f.gold ? S.ffGold : S.ffRose, x - sz, y - sz, sz * 2, sz * 2);
    c.globalAlpha = clamp(al * cf);
    c.fillStyle = 'rgb(255,248,232)';
    c.beginPath(); c.arc(x, y, f.r * 0.6, 0, TAU); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
}

const RING_COL = ['rgb(255,222,170)', 'rgb(248,168,196)', 'rgb(226,112,152)'];

function drawRipples(c, st, d) {
  const R = st.ripples, S = st.sprites, ptr = st.ptr;
  c.globalCompositeOperation = 'lighter';
  if (ptr.speed > 30) {
    const a = clamp(ptr.speed / 1200) * 0.22;
    c.globalAlpha = a;
    c.drawImage(S.rose, ptr.x - 60, ptr.y - 60, 120, 120);
  }
  for (let i = 0; i < R.length; i++) {
    const r = R[i];
    if (!r.on) continue;
    r.age += d;
    const k = r.age / r.dur;
    if (k >= 1) { r.on = false; continue; }
    const fade = 1 - k;
    const fr = r.maxR * (0.28 + 0.3 * k);
    c.globalAlpha = fade * fade * 0.65;
    c.drawImage(S.glow, r.x - fr, r.y - fr, fr * 2, fr * 2);
    for (let j = 0; j < 3; j++) {
      const kk = clamp(k * 1.2 - j * 0.13);
      if (kk <= 0) continue;
      const e = 1 - Math.pow(1 - kk, 3);
      c.globalAlpha = Math.pow(1 - kk, 1.4) * (0.85 - j * 0.17);
      c.strokeStyle = RING_COL[j];
      c.lineWidth = 3.4 * (1 - kk) + 0.6;
      c.beginPath(); c.arc(r.x, r.y, Math.max(0.5, r.maxR * e * (1 - j * 0.2)), 0, TAU); c.stroke();
    }
    const e2 = 1 - Math.pow(1 - clamp(k * 1.3), 3);
    c.globalAlpha = Math.pow(fade, 1.3) * 0.55;
    c.strokeStyle = 'rgb(255,196,208)';
    c.lineWidth = 1.3;
    for (let j = 0; j < 8; j++) {
      const a = r.rot + (j * TAU) / 8, dist = r.maxR * 0.32 * e2;
      c.beginPath();
      c.ellipse(r.x + Math.cos(a) * dist, r.y + Math.sin(a) * dist, r.maxR * 0.17 * e2 + 1, r.maxR * 0.07 * e2 + 0.5, a, 0, TAU);
      c.stroke();
    }
  }
  c.globalCompositeOperation = 'source-over';
}

/* ════════════════════════════════════════════════════════════════════════
   MODULE
   ════════════════════════════════════════════════════════════════════════ */

export default {
  init(w, h, opts = {}) {
    void opts;
    const sp = Math.min(2, Math.max(1, getDpr()));
    const mobile = w < 650;
    const petalCount = mobile ? 72 : 112;
    const ffCount = mobile ? 28 : 46;
    const starCount = mobile ? 50 : 90;

    const petals = [];
    for (let i = 0; i < petalCount; i++) {
      const z = 0.5 + Math.random();
      const dir = Math.random() < 0.5 ? -1 : 1;
      petals.push({
        x: Math.random() * w, y: Math.random() * h, z,
        size: 15 + Math.random() * 13,
        vx0: Math.random() * 14 - 4,
        vy0: 28 + Math.random() * 42,
        sway: Math.random() * TAU, swayRate: 0.7 + Math.random() * 1.3, swayAmp: 8 + Math.random() * 26,
        angle: Math.random() * TAU, vAngle0: (Math.random() - 0.5) * 1.4, vAngle: 0,
        flip: Math.random() * TAU, vFlip0: dir * (1.1 + Math.random() * 2.2), vFlip: 0,
        tilt: Math.random() * TAU, vTilt: 0.6 + Math.random() * 1.6,
        ix: 0, iy: 0,
        ci: PETAL_PICK[i % PETAL_PICK.length],
        alpha: 0.55 + 0.4 * clamp(z - 0.5),
      });
      const p = petals[petals.length - 1];
      p.vAngle = p.vAngle0; p.vFlip = p.vFlip0;
    }
    petals.sort((a, b) => a.z - b.z);
    let farCount = 0;
    while (farCount < petals.length && petals[farCount].z < 0.85) farCount++;

    const fireflies = [];
    for (let i = 0; i < ffCount; i++) {
      fireflies.push({
        fx: Math.random(), fy: 0.2 + Math.random() * 0.75,
        a1: 14 + Math.random() * 40, a2: 40 + Math.random() * 110,
        f1: 0.2 + Math.random() * 0.3, f2: 0.05 + Math.random() * 0.1,
        f3: 0.18 + Math.random() * 0.3, f4: 0.04 + Math.random() * 0.1,
        p1: Math.random() * TAU, p2: Math.random() * TAU, p3: Math.random() * TAU, p4: Math.random() * TAU,
        pp: Math.random() * TAU, ps: 0.9 + Math.random() * 2.1,
        r: 1.2 + Math.random() * 1.6, gold: Math.random() < 0.6,
        sx: 0, sy: 0, svx: 0, svy: 0,
      });
    }

    const stars = new Float32Array(starCount * 5);
    for (let i = 0; i < starCount; i++) {
      stars[i * 5] = Math.random();
      stars[i * 5 + 1] = Math.random() * 0.5;
      stars[i * 5 + 2] = Math.random() * TAU;
      stars[i * 5 + 3] = 0.6 + Math.random() * 2.2;
      stars[i * 5 + 4] = Math.random() < 0.15 ? 2 : 1;
    }

    const mkLantern = (rx, lenK, sizeK, phase, gain) => ({
      rx, lenK, sizeK, phase, gain,
      angle: (Math.random() - 0.5) * 0.1, vAngle: 0,
      s: 28, len: 0, ax: 0, ay: -4, ringX: 0, ringY: 0, x: -9999, y: -9999,
      flick: 0, I: 1, spr: null,
    });
    const lanterns = [
      mkLantern(0.22, 0.25, 1.0, 0.3, 1.0),
      mkLantern(0.5, 0.2, 1.2, 2.1, 0.78),
      mkLantern(0.78, 0.27, 0.95, 4.0, 1.0),
    ];

    const hearts = [];
    for (let i = 0; i < 16; i++) hearts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 2.6, size: 9, rot: 0, ci: 0 });
    const ripples = [];
    for (let i = 0; i < 10; i++) ripples.push({ on: false, x: 0, y: 0, age: 0, dur: 1.6, maxR: 150, rot: 0 });

    return {
      w, h, petals, farCount, fireflies, stars, lanterns, ripples, hearts,
      candles: new Float32Array(0), bulbs: new Float32Array(0), heartIdx: 0,
      ptr: { x: -999, y: -999, vx: 0, vy: 0, speed: 0, t: 0, down: false },
      m: { warm: 0.5, storm: 0, dark: 0 },
      dash: [3.5, 3.2], noDash: [],
      ripIdx: 0, time: 0,
      sprites: createSprites(sp),
      canvases: null, nave: null,
    };
  },

  draw(c, st, t, dt, mood = {}, w, h) {
    if (!st || w < 2 || h < 2) return;
    const d = Math.max(0, Math.min(0.1, dt > 1 ? dt / 1000 : dt || 0.016));
    const ts = t * 0.001;
    st.time += d;
    st.w = w; st.h = h;
    ensureCaches(st, w, h);
    const cs = st.canvases, S = st.sprites, m = st.m, ptr = st.ptr;

    // ease mood so analyzer jumps never pop
    const k = Math.min(1, d * 1.6);
    m.warm += (clamp(typeof mood.warm === 'number' ? mood.warm : 0.5) - m.warm) * k;
    m.storm += (clamp(typeof mood.storm === 'number' ? mood.storm : 0) - m.storm) * k;
    m.dark += (clamp(typeof mood.dark === 'number' ? mood.dark : 0) - m.dark) * k;

    // pointer wind decays; speed drives petals / fireflies
    const pd = Math.exp(-3.2 * d);
    ptr.vx *= pd; ptr.vy *= pd;
    ptr.speed = Math.sqrt(ptr.vx * ptr.vx + ptr.vy * ptr.vy);

    const windX = 22 + Math.sin(ts * 0.43) * 16 + Math.sin(ts * 0.97 + 1.3) * 8 + m.storm * (70 + 40 * Math.sin(ts * 1.9));

    c.save();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    // 1. sky, garden, floor, glass
    c.drawImage(cs.back, 0, 0, w, h);

    // 2. twinkling starlight through the roof glass
    const stars = st.stars, sa = 0.85 * (1 - m.storm * 0.6);
    c.fillStyle = '#ffeef6';
    for (let i = 0; i < stars.length; i += 5) {
      const tw = 0.5 + 0.5 * Math.sin(ts * stars[i + 3] + stars[i + 2]);
      c.globalAlpha = sa * (0.2 + 0.8 * tw);
      c.fillRect(stars[i] * w, stars[i + 1] * h, stars[i + 4], stars[i + 4]);
    }
    c.globalAlpha = 1;

    // 3. horizon warmth (mood.warm)
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = (0.1 + 0.22 * m.warm) * (1 - 0.5 * m.dark);
    c.drawImage(S.glow, w * 0.5 - w * 0.55, st.nave.vy - h * 0.22, w * 1.1, h * 0.44);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;

    // moonbeams slanting through the glass
    drawBeams(c, st, ts, w, h, m);

    // 4. far petals (behind the ironwork)
    stepAndDrawPetals(c, st, 0, st.farCount, d, ts, w, h, windX);
    c.globalAlpha = 1;

    // 5. ironwork, rose vines
    c.drawImage(cs.front, 0, 0, w, h);

    // 6. night contrast
    if (m.dark > 0.01) {
      c.globalAlpha = m.dark * 0.5;
      c.fillStyle = '#05020b';
      c.fillRect(0, 0, w, h);
      c.globalAlpha = 1;
    }

    // 6b. the waltzing couple, candlelit aisle, fairy lights
    drawCouple(c, S, st.nave, ts, w, h, m);
    drawCandles(c, st, ts, m);
    drawBulbs(c, st, ts, m);

    // 7. lanterns: pendulum physics, chains, glow, flames
    updateLanterns(st, d, ts, w, h, m);
    drawLanterns(c, st, ts, w, h, m);

    // 8. near petals
    stepAndDrawPetals(c, st, st.farCount, st.petals.length, d, ts, w, h, windX);
    c.globalAlpha = 1;

    // 9. fireflies
    drawFireflies(c, st, ts, d, w, h, m);
    c.globalAlpha = 1;

    drawHearts(c, st, d);

    // 10. touch blooms
    drawRipples(c, st, d);
    c.globalAlpha = 1;

    // 11. velvet vignette + reading veil
    c.drawImage(cs.overlay, 0, 0, w, h);

    c.restore();
  },

  pointerMove(st, x, y) {
    if (!st) return;
    const p = st.ptr, now = performance.now();
    if (p.t > 0) {
      const dts = Math.max(0.004, (now - p.t) / 1000);
      const dx = x - p.x, dy = y - p.y;
      p.vx += (clamp(dx / dts, -2200, 2200) - p.vx) * 0.55;
      p.vy += (clamp(dy / dts, -2200, 2200) - p.vy) * 0.55;
      const L = st.lanterns;
      for (let i = 0; i < L.length; i++) {
        const l = L[i];
        const ddx = x - l.x, ddy = y - l.y, dist = Math.sqrt(ddx * ddx + ddy * ddy), R = l.s * 3.2;
        if (dist < R) l.vAngle += dx * 0.0006 * (1 - dist / R);
      }
    }
    p.x = x; p.y = y; p.t = now;
  },

  pointerDown(st, x, y) {
    if (!st) return;
    const p = st.ptr;
    p.x = x; p.y = y; p.t = performance.now(); p.down = true;

    // bloom ripple
    const r = st.ripples[st.ripIdx];
    st.ripIdx = (st.ripIdx + 1) % st.ripples.length;
    r.on = true; r.x = x; r.y = y; r.age = 0;
    r.dur = 1.5 + Math.random() * 0.4;
    r.maxR = Math.min(st.w, st.h) * (0.16 + Math.random() * 0.08);
    r.rot = Math.random() * TAU;

    // a few hearts drift up from the touch
    for (let j = 0; j < 8; j++) {
      const hp = st.hearts[st.heartIdx];
      st.heartIdx = (st.heartIdx + 1) % st.hearts.length;
      hp.on = true; hp.age = -j * 0.06; hp.x = x + (Math.random() - 0.5) * 30; hp.y = y + (Math.random() - 0.5) * 20;
      hp.vx = (Math.random() - 0.5) * 60; hp.vy = -(60 + Math.random() * 70);
      hp.size = 7 + Math.random() * 7; hp.life = 2.2 + Math.random() * 1.0; hp.rot = Math.random() * TAU;
      hp.ci = (Math.random() * 3) | 0;
    }

    // petals burst outward
    const P = st.petals;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      const dx = q.x - x, dy = q.y - y, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 260) {
        const f = Math.pow(1 - dist / 260, 1.3), nx = dx / (dist || 1), ny = dy / (dist || 1);
        q.ix = clamp(q.ix + nx * f * 520, -450, 450);
        q.iy = clamp(q.iy + ny * f * 520 - 120 * f, -450, 450);
        q.vAngle += (Math.random() - 0.5) * 6 * f;
        q.vFlip += (Math.random() - 0.5) * 8 * f;
      }
    }
    // fireflies scatter
    const F = st.fireflies;
    for (let i = 0; i < F.length; i++) {
      const f = F[i];
      const fx = f.fx * st.w + f.sx, fy = f.fy * st.h + f.sy;
      const dx = fx - x, dy = fy - y, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 200) {
        const k = 1 - dist / 200;
        f.svx = clamp(f.svx + (dx / (dist || 1)) * k * 260, -260, 260);
        f.svy = clamp(f.svy + (dy / (dist || 1)) * k * 260, -260, 260);
      }
    }
    // lanterns swing
    const L = st.lanterns;
    for (let i = 0; i < L.length; i++) {
      const l = L[i];
      const dx = x - l.x, dy = y - l.y, dist = Math.sqrt(dx * dx + dy * dy), R = l.s * 5;
      if (dist < R) l.vAngle += (dx < 0 ? 1 : -1) * 0.9 * (1 - dist / R);
    }
  },

  pointerUp(st) {
    if (!st) return;
    st.ptr.down = false;
  },
};
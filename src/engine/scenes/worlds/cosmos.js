// import { mk } from '../draw-utils.js';
// import { R } from '../../../lib/utils.js';

// // "cosmos" world: init() pre-renders static layers, draw() animates one frame.
// export default {
//   init(w, h) {
//     const bg = mk(w, h),
//       g = bg.getContext('2d');
//     const gr = g.createLinearGradient(0, 0, w, h);
//     gr.addColorStop(0, '#04050d');
//     gr.addColorStop(0.5, '#0b0f2a');
//     gr.addColorStop(1, '#120a26');
//     g.fillStyle = gr;
//     g.fillRect(0, 0, w, h);
//     g.globalCompositeOperation = 'lighter';
//     const cols = ['120,70,190', '30,140,160', '190,60,140', '70,90,200'];
//     for (let i = 0; i < 7; i++) {
//       const x = R(0, w),
//         y = R(0, h),
//         r = R(Math.min(w, h) * 0.25, Math.max(w, h) * 0.5),
//         col = cols[i % 4],
//         ng = g.createRadialGradient(x, y, 0, x, y, r);
//       ng.addColorStop(0, `rgba(${col},.22)`);
//       ng.addColorStop(1, `rgba(${col},0)`);
//       g.fillStyle = ng;
//       g.fillRect(0, 0, w, h);
//     }
//     g.globalCompositeOperation = 'source-over';
//     const px = w * 0.86,
//       py = h * 0.82,
//       pr = Math.min(w, h) * 0.16;
//     const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
//     pg.addColorStop(0, '#4a61a8');
//     pg.addColorStop(1, '#10173a');
//     g.strokeStyle = 'rgba(180,200,255,.28)';
//     g.lineWidth = pr * 0.08;
//     g.save();
//     g.translate(px, py);
//     g.rotate(-0.35);
//     g.beginPath();
//     g.ellipse(0, 0, pr * 1.7, pr * 0.4, 0, Math.PI, 2 * Math.PI);
//     g.stroke();
//     g.restore();
//     g.fillStyle = pg;
//     g.beginPath();
//     g.arc(px, py, pr, 0, 6.283);
//     g.fill();
//     g.save();
//     g.translate(px, py);
//     g.rotate(-0.35);
//     g.beginPath();
//     g.ellipse(0, 0, pr * 1.7, pr * 0.4, 0, 0, Math.PI);
//     g.stroke();
//     g.restore();
//     return {
//       bg,
//       stars: Array.from({ length: Math.min(320, Math.floor((w * h) / 4500) + 20) }, () => ({
//         x: R(0, w),
//         y: R(0, h),
//         z: R(0.2, 1),
//         r: R(0.5, 1.6),
//         p: R(0, 6.28)
//       })),
//       shoot: []
//     };
//   },
//   draw(c, s, t, dt, m, w, h) {
//     c.drawImage(s.bg, 0, 0, w, h);
//     for (const st of s.stars) {
//       st.x -= st.z * 8 * dt;
//       if (st.x < 0) st.x = w;
//       c.fillStyle = `rgba(225,235,255,${0.35 + 0.5 * st.z * (0.6 + 0.4 * Math.sin(t * 2 + st.p))})`;
//       c.fillRect(st.x, st.y, st.r * st.z + 0.4, st.r * st.z + 0.4);
//     }
//     if (Math.random() < dt * 0.15)
//       s.shoot.push({
//         x: R(w * 0.3, w * 1.1),
//         y: R(0, h * 0.4),
//         vx: -R(500, 800) * Math.min(1, w / 900 + 0.3),
//         vy: R(150, 300) * Math.min(1, w / 900 + 0.3),
//         life: 1
//       });
//     for (let i = s.shoot.length - 1; i >= 0; i--) {
//       const sh = s.shoot[i];
//       sh.x += sh.vx * dt;
//       sh.y += sh.vy * dt;
//       sh.life -= dt * 1.2;
//       if (sh.life <= 0) {
//         s.shoot.splice(i, 1);
//         continue;
//       }
//       const lg = c.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 0.12, sh.y - sh.vy * 0.12);
//       lg.addColorStop(0, `rgba(255,255,255,${sh.life})`);
//       lg.addColorStop(1, 'rgba(255,255,255,0)');
//       c.strokeStyle = lg;
//       c.lineWidth = 1.5;
//       c.beginPath();
//       c.moveTo(sh.x, sh.y);
//       c.lineTo(sh.x - sh.vx * 0.12, sh.y - sh.vy * 0.12);
//       c.stroke();
//     }
//   }
// };

// =====================================================================
// CELESTIAL FRONTIER  -  "Window Seat"
//
// You are sitting at the forward viewport of a deep-space survey ship,
// cruising slowly through a living galaxy. Worlds, stations, stars,
// galaxies and stranger things drift up out of the dark, swell, and slide
// past the glass. Ships cross the void. Nothing is in a hurry: the motion
// is slow and cinematic so it never fights the book text.
//
// API (unchanged):
//   init(w, h)
//   draw(ctx, state, t, dt, mood, w, h)
//
// Tweak the look with CFG below.
// =====================================================================

const CFG = {
  frame: true,       // cockpit window + console
  hud: true,         // tracking brackets + console readouts
  speed: 0.016,      // cruise speed (depth units / second)
  surges: true,      // rare gentle "cruise surge" star streaks
  ships: true,       // passing ships
};

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, v) => {
  const k = clamp((v - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wpick(list, avoid) {
  const pool = list.filter(([k]) => !avoid || !avoid.includes(k));
  let tot = 0;
  for (const [, w] of pool) tot += w;
  let r = Math.random() * tot;
  for (const [k, w] of pool) { r -= w; if (r <= 0) return k; }
  return pool[0][0];
}

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// rounded-rect subpath (no dependency on ctx.roundRect)
function rr(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// soft additive glow
function glow(c, x, y, r, rgb, a, add = true) {
  if (a <= 0.002 || r <= 0.5) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.4, `rgba(${rgb},${a * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.save();
  if (add) c.globalCompositeOperation = 'lighter';
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

/* =====================================================================
   NAMES
   ===================================================================== */

const SYL = ['Ae', 'Ka', 'Vel', 'Or', 'Zan', 'Thy', 'Mer', 'Ix', 'Cae', 'Nov', 'Lyr', 'Ar', 'Ten', 'Sol', 'Ur', 'Eth', 'Cor', 'Vey', 'Ish', 'Dra'];
const END = ['a', 'is', 'on', 'ar', 'um', 'ia', 'ene', 'ox'];
function makeName() {
  return pick(SYL) + pick(SYL).toLowerCase() + pick(END);
}

/* =====================================================================
   PROCEDURAL TEXTURES  (equirectangular strips, built once, reused)
   ===================================================================== */

const TW = 1024, TH = 512;

function blob(g, x, y, rad, seed, color, alpha, sy = 0.8) {
  const r = rng(seed), n = 9, p = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, d = rad * (0.62 + r() * 0.7);
    p.push([x + Math.cos(a) * d, y + Math.sin(a) * d * sy]);
  }
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo((p[n - 1][0] + p[0][0]) / 2, (p[n - 1][1] + p[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const q = p[(i + 1) % n];
    g.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + q[0]) / 2, (p[i][1] + q[1]) / 2);
  }
  g.fill();
  g.globalAlpha = 1;
}
function wrapBlob(g, x, y, rad, seed, color, alpha, sy) {
  for (const o of [-TW, 0, TW]) blob(g, x + o, y, rad, seed, color, alpha, sy);
}

function specEarth() {
  const r = rng((Math.random() * 1e9) | 0), t = mk(TW, TH), g = t.getContext('2d');
  const o = g.createLinearGradient(0, 0, 0, TH);
  o.addColorStop(0, '#14406f'); o.addColorStop(0.5, '#1b64a6'); o.addColorStop(1, '#14406f');
  g.fillStyle = o; g.fillRect(0, 0, TW, TH);
  for (let i = 0; i < 70; i++) wrapBlob(g, r() * TW, r() * TH, 30 + r() * 60, i + 1, '#3190cf', 0.16);
  const lands = ['#3f7a3f', '#5d8f46', '#8c9150', '#a89c64', '#2f6038'];
  for (let k = 0; k < 7; k++) {
    const cx = r() * TW, cy = TH * (0.2 + r() * 0.6), sz = 50 + r() * 90;
    for (let i = 0; i < 18; i++) {
      const a = r() * TAU, d = r() * sz;
      wrapBlob(g, cx + Math.cos(a) * d * 1.6, cy + Math.sin(a) * d * 0.8, 16 + r() * 34, k * 100 + i + 500, lands[(r() * 5) | 0], 1);
    }
    for (let i = 0; i < 6; i++) {
      const a = r() * TAU, d = r() * sz * 0.7;
      wrapBlob(g, cx + Math.cos(a) * d * 1.4, cy + Math.sin(a) * d * 0.7, 8 + r() * 16, k * 100 + i + 900, '#d9d3b0', 0.25);
    }
  }
  for (const [y0, dir] of [[0, 1], [TH, -1]]) {
    const pg = g.createLinearGradient(0, y0, 0, y0 + dir * TH * 0.14);
    pg.addColorStop(0, 'rgba(240,248,255,.95)'); pg.addColorStop(1, 'rgba(240,248,255,0)');
    g.fillStyle = pg; g.fillRect(0, Math.min(y0, y0 + dir * TH * 0.14), TW, TH * 0.14);
  }
  const cl = mk(TW, TH), cg = cl.getContext('2d');
  cg.fillStyle = '#fff';
  for (let i = 0; i < 150; i++) {
    const x = r() * TW, y = TH * (0.08 + r() * 0.84), rx = 20 + r() * 80, ry = 2 + r() * 8;
    cg.globalAlpha = 0.1 + r() * 0.28;
    for (const o2 of [-TW, 0, TW]) { cg.beginPath(); cg.ellipse(x + o2, y, rx, ry, 0, 0, TAU); cg.fill(); }
  }
  return { tex: t, clouds: cl, atm: '110,175,255', haze: 1, rs: 0.004 };
}

const GAS_PALS = [
  { c: ['#c9a47a', '#e7d2b0', '#a9774f', '#f1e6d0', '#8b5e3c', '#d8b58a'], atm: '230,200,160' },
  { c: ['#e4cf9a', '#cdb27a', '#f2e3b8', '#b99a63', '#d8c08a'], atm: '240,220,170' },
  { c: ['#2a4fb5', '#3b6fe0', '#1d3a8a', '#5b8cff', '#274a9c'], atm: '120,160,255' },
  { c: ['#3d8f8a', '#7fc9bf', '#2a6b6b', '#b9e8dc', '#4aa39b'], atm: '140,230,215' },
  { c: ['#6c4aa8', '#9c7ad9', '#4a3278', '#c9b0f2', '#7d5cc0'], atm: '190,160,255' },
  { c: ['#b5523a', '#d98a5e', '#7a2f22', '#ecc09a', '#a0412e'], atm: '255,170,130' },
];

function specGas() {
  const r = rng((Math.random() * 1e9) | 0), t = mk(TW, TH), g = t.getContext('2d');
  const pal = pick(GAS_PALS), cols = pal.c;
  const gr = g.createLinearGradient(0, 0, 0, TH);
  const stops = [];
  for (let i = 0; i < 34; i++) stops.push(r());
  stops.sort((a, b) => a - b);
  gr.addColorStop(0, cols[0]);
  for (const s of stops) {
    const col = cols[(r() * cols.length) | 0];
    gr.addColorStop(s, col);
    if (r() < 0.35) gr.addColorStop(Math.min(1, s + 0.004), col);
  }
  gr.addColorStop(1, cols[1]);
  g.fillStyle = gr; g.fillRect(0, 0, TW, TH);
  for (let i = 0; i < 320; i++) {
    const x = r() * TW, y = r() * TH, rx = 25 + r() * 110, ry = 1.5 + r() * 6;
    g.fillStyle = cols[(r() * cols.length) | 0];
    g.globalAlpha = 0.14 + r() * 0.22;
    for (const o of [-TW, 0, TW]) { g.beginPath(); g.ellipse(x + o, y, rx, ry, 0, 0, TAU); g.fill(); }
  }
  // great storm
  const sx = r() * TW, sy = TH * (0.55 + r() * 0.15);
  g.globalAlpha = 0.85; g.fillStyle = cols[2];
  g.beginPath(); g.ellipse(sx, sy, 62, 30, 0, 0, TAU); g.fill();
  g.globalAlpha = 0.55; g.strokeStyle = cols[3]; g.lineWidth = 6;
  g.beginPath(); g.ellipse(sx, sy, 68, 35, 0, 0, TAU); g.stroke();
  g.globalAlpha = 1;
  return { tex: t, atm: pal.atm, haze: 0.55, rs: 0.012 };
}

function specIce() {
  const r = rng((Math.random() * 1e9) | 0), t = mk(TW, TH), g = t.getContext('2d');
  const b = g.createLinearGradient(0, 0, 0, TH);
  b.addColorStop(0, '#e6f4fa'); b.addColorStop(0.5, '#b7d9ea'); b.addColorStop(1, '#e0f0f8');
  g.fillStyle = b; g.fillRect(0, 0, TW, TH);
  for (let i = 0; i < 90; i++) wrapBlob(g, r() * TW, r() * TH, 20 + r() * 60, i + 3, r() < 0.5 ? '#ffffff' : '#82b6d2', 0.22, 0.5);
  g.strokeStyle = '#5d9bc0'; g.lineWidth = 1.6;
  for (let i = 0; i < 46; i++) {
    let x = r() * TW, y = r() * TH;
    g.globalAlpha = 0.25 + r() * 0.35;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += (r() - 0.35) * 70; y += (r() - 0.5) * 36; g.lineTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
  return { tex: t, atm: '170,225,255', haze: 0.7, rs: 0.004 };
}

function specLava() {
  const r = rng((Math.random() * 1e9) | 0), t = mk(TW, TH), g = t.getContext('2d');
  g.fillStyle = '#1b0e0b'; g.fillRect(0, 0, TW, TH);
  for (let i = 0; i < 110; i++) wrapBlob(g, r() * TW, r() * TH, 20 + r() * 70, i + 9, r() < 0.5 ? '#33201a' : '#0f0707', 0.5);
  const em = mk(TW, TH), e = em.getContext('2d');
  e.lineCap = 'round'; e.lineJoin = 'round';
  for (let i = 0; i < 80; i++) {
    let x = r() * TW, y = r() * TH;
    const pts = [[x, y]];
    for (let k = 0; k < 9; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 50; pts.push([x, y]); }
    for (const o of [-TW, 0, TW]) {
      e.shadowColor = '#ff4a00'; e.shadowBlur = 14;
      e.strokeStyle = '#ff6a14'; e.lineWidth = 2 + r() * 2.5;
      e.beginPath(); pts.forEach((p, j) => (j ? e.lineTo(p[0] + o, p[1]) : e.moveTo(p[0] + o, p[1]))); e.stroke();
    }
    e.shadowBlur = 0; e.strokeStyle = '#ffd27a'; e.lineWidth = 0.9;
    e.beginPath(); pts.forEach((p, j) => (j ? e.lineTo(p[0], p[1]) : e.moveTo(p[0], p[1]))); e.stroke();
  }
  e.shadowBlur = 0;
  for (let i = 0; i < 16; i++) wrapBlob(e, r() * TW, r() * TH, 8 + r() * 24, i + 400, '#ff7a1c', 0.7);
  return { tex: t, emis: em, atm: '255,120,60', haze: 0.5, rs: 0.005 };
}

function specMars() {
  const r = rng((Math.random() * 1e9) | 0), t = mk(TW, TH), g = t.getContext('2d');
  const b = g.createLinearGradient(0, 0, 0, TH);
  b.addColorStop(0, '#b45f38'); b.addColorStop(0.5, '#a24d2b'); b.addColorStop(1, '#b45f38');
  g.fillStyle = b; g.fillRect(0, 0, TW, TH);
  const cols = ['#7b3820', '#c98254', '#5d2a1b', '#d29a6a'];
  for (let i = 0; i < 110; i++) wrapBlob(g, r() * TW, r() * TH, 18 + r() * 70, i + 21, cols[(r() * 4) | 0], 0.3);
  g.strokeStyle = '#4a2012'; g.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    let x = r() * TW, y = TH * (0.3 + r() * 0.4);
    g.globalAlpha = 0.45; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += 20 + r() * 30; y += (r() - 0.5) * 14; g.lineTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
  for (const [y0, dir] of [[0, 1], [TH, -1]]) {
    const pg = g.createLinearGradient(0, y0, 0, y0 + dir * TH * 0.07);
    pg.addColorStop(0, 'rgba(255,245,240,.9)'); pg.addColorStop(1, 'rgba(255,245,240,0)');
    g.fillStyle = pg; g.fillRect(0, Math.min(y0, y0 + dir * TH * 0.07), TW, TH * 0.07);
  }
  return { tex: t, atm: '255,165,120', haze: 0.35, rs: 0.005 };
}

function specMoon() {
  const r = rng((Math.random() * 1e9) | 0), t = mk(TW, TH), g = t.getContext('2d');
  g.fillStyle = '#8c8b88'; g.fillRect(0, 0, TW, TH);
  for (let i = 0; i < 60; i++) wrapBlob(g, r() * TW, r() * TH, 25 + r() * 70, i + 5, r() < 0.5 ? '#a9a8a3' : '#6c6b69', 0.25);
  for (let i = 0; i < 9; i++) wrapBlob(g, r() * TW, r() * TH, 50 + r() * 80, i + 77, '#4a4a50', 0.5);
  for (let i = 0; i < 140; i++) {
    const x = r() * TW, y = r() * TH, rad = 3 + r() * r() * 34;
    for (const o of [-TW, 0, TW]) {
      g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.arc(x + o, y, rad, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1.3;
      g.beginPath(); g.arc(x + o - rad * 0.08, y - rad * 0.08, rad, 0, TAU); g.stroke();
    }
  }
  return { tex: t, atm: null, haze: 0, rs: 0.003 };
}

/* ---- galaxy + nebula sprites ---- */

function buildGalaxy() {
  const N = 256, t = mk(N, N), g = t.getContext('2d'), r = rng((Math.random() * 1e9) | 0);
  g.translate(N / 2, N / 2);
  g.globalCompositeOperation = 'lighter';
  const core = g.createRadialGradient(0, 0, 0, 0, 0, N * 0.24);
  core.addColorStop(0, 'rgba(255,240,215,.95)');
  core.addColorStop(0.3, 'rgba(255,205,150,.4)');
  core.addColorStop(1, 'rgba(255,170,110,0)');
  g.fillStyle = core; g.fillRect(-N / 2, -N / 2, N, N);
  const arms = 2 + ((r() * 3) | 0), twist = 2.6 + r() * 1.8, R = N * 0.46;
  for (let i = 0; i < 2800; i++) {
    const arm = i % arms, f = Math.pow(r(), 0.65), rad = f * R;
    const ang = (arm / arms) * TAU + f * twist * 2 + (r() - 0.5) * (0.5 + f * 0.5);
    const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
    const cr = lerp(255, 170, f), cg = lerp(225, 200, f), cb = lerp(185, 255, f);
    g.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${0.2 + r() * 0.5})`;
    const s = 0.5 + r() * 1.1;
    g.fillRect(x, y, s, s);
  }
  for (let i = 0; i < 120; i++) {
    const arm = i % arms, f = Math.pow(r(), 0.7), rad = f * R;
    const ang = (arm / arms) * TAU + f * twist * 2;
    const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
    const gg = g.createRadialGradient(x, y, 0, x, y, 12 + f * 10);
    gg.addColorStop(0, 'rgba(150,180,255,.07)'); gg.addColorStop(1, 'rgba(150,180,255,0)');
    g.fillStyle = gg; g.fillRect(x - 24, y - 24, 48, 48);
  }
  return { spr: t, incl: rand(0.3, 0.85), pa: rand(0, TAU) };
}

const NEB_PALS = [
  [[190, 70, 210], [90, 120, 255], [255, 110, 150]],
  [[40, 200, 200], [70, 120, 255], [150, 90, 230]],
  [[255, 120, 70], [255, 80, 130], [120, 80, 220]],
  [[80, 230, 170], [60, 150, 230], [200, 90, 220]],
];
function buildNebula() {
  const N = 512, t = mk(N, N), g = t.getContext('2d'), r = rng((Math.random() * 1e9) | 0);
  const pal = pick(NEB_PALS);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 52; i++) {
    const x = N * (0.5 + (r() - 0.5) * 0.72), y = N * (0.5 + (r() - 0.5) * 0.6), rad = N * (0.06 + r() * 0.2);
    const col = pal[(r() * pal.length) | 0];
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},.2)`);
    gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 14; i++) {
    const x = N * (0.5 + (r() - 0.5) * 0.6), y = N * (0.5 + (r() - 0.5) * 0.5), rad = N * (0.04 + r() * 0.1);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(0,0,10,.28)'); gr.addColorStop(1, 'rgba(0,0,10,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 110; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
    g.fillRect(r() * N, r() * N, 1.2, 1.2);
  }
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.55, 'rgba(0,0,0,.8)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, N, N);
  return { spr: t, pa: rand(0, TAU) };
}

function buildRock(seed) {
  const r = rng(seed), N = 96, t = mk(N, N), g = t.getContext('2d');
  const n = 11, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, d = N * 0.4 * (0.72 + r() * 0.45);
    pts.push([N / 2 + Math.cos(a) * d, N / 2 + Math.sin(a) * d * 0.88]);
  }
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
  const gr = g.createLinearGradient(N * 0.2, N * 0.15, N * 0.8, N * 0.85);
  gr.addColorStop(0, '#a49a90'); gr.addColorStop(0.55, '#5d544d'); gr.addColorStop(1, '#1f1b19');
  g.fillStyle = gr; g.fill();
  g.save(); g.clip();
  for (let i = 0; i < 4; i++) {
    const x = N * (0.3 + r() * 0.4), y = N * (0.3 + r() * 0.4), rad = 4 + r() * 9;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath(); g.arc(x - 1, y - 1, rad, 0, TAU); g.stroke();
  }
  g.restore();
  return t;
}

/* ---- shared sphere shading sprites ---- */

function buildShade() {
  const R = 256, t = mk(R * 2, R * 2), g = t.getContext('2d');
  g.beginPath(); g.arc(R, R, R, 0, TAU); g.clip();
  const d = g.createRadialGradient(R * 1.35, R, 0, R * 1.35, R, R * 2);
  d.addColorStop(0, 'rgba(0,0,6,0)');
  d.addColorStop(0.4, 'rgba(0,0,6,0)');
  d.addColorStop(0.55, 'rgba(0,0,6,.4)');
  d.addColorStop(0.66, 'rgba(0,0,8,.86)');
  d.addColorStop(0.8, 'rgba(0,0,10,.94)');
  d.addColorStop(1, 'rgba(0,0,10,.95)');
  g.fillStyle = d; g.fillRect(0, 0, R * 2, R * 2);
  const l = g.createRadialGradient(R, R, R * 0.55, R, R, R);
  l.addColorStop(0, 'rgba(0,0,0,0)'); l.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = l; g.fillRect(0, 0, R * 2, R * 2);
  return t;
}

function rimSprite(S, rgb) {
  if (S.rims[rgb]) return S.rims[rgb];
  const R = 256, t = mk(R * 2, R * 2), g = t.getContext('2d');
  const gr = g.createRadialGradient(R, R, R * 0.88, R, R, R);
  gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(1, `rgba(${rgb},.85)`);
  g.fillStyle = gr; g.beginPath(); g.arc(R, R, R, 0, TAU); g.fill();
  g.globalCompositeOperation = 'destination-in';
  const m = g.createLinearGradient(0, 0, R * 2, 0);
  m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.45, 'rgba(0,0,0,.06)'); m.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = m; g.fillRect(0, 0, R * 2, R * 2);
  S.rims[rgb] = t;
  return t;
}

/* =====================================================================
   STOCK  (build textures one-per-frame in the background so spawns never hitch)
   ===================================================================== */

const MAKERS = {
  earth: specEarth, gas: specGas, ice: specIce, lava: specLava, mars: specMars, moon: specMoon,
  galaxy: buildGalaxy, nebula: buildNebula,
};
const WARM = { earth: 1, gas: 2, ice: 1, lava: 1, mars: 1, moon: 2, galaxy: 2, nebula: 2 };

function take(S, k) {
  const a = S.stock[k];
  return a && a.length ? a.pop() : MAKERS[k]();
}
function warm(S) {
  for (const k in WARM) {
    const a = S.stock[k] || (S.stock[k] = []);
    if (a.length < WARM[k]) { a.push(MAKERS[k]()); return; }
  }
}

/* =====================================================================
   STATIC BACKDROP  (milky way + dust + colour clouds)
   ===================================================================== */

function buildBG(w, h) {
  const sc = 0.7, W = w * 1.14, H = h * 1.14;
  const t = mk(W * sc, H * sc), g = t.getContext('2d');
  g.scale(sc, sc);
  const r = rng(4242);
  const base = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  base.addColorStop(0, '#080c1f'); base.addColorStop(0.6, '#040613'); base.addColorStop(1, '#020309');
  g.fillStyle = base; g.fillRect(0, 0, W, H);

  g.save();
  g.translate(W / 2, H / 2); g.rotate(-0.38);
  g.save(); g.scale(1, 0.2);
  const band = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.8);
  band.addColorStop(0, 'rgba(150,150,225,.16)'); band.addColorStop(0.5, 'rgba(110,120,200,.07)'); band.addColorStop(1, 'rgba(60,70,150,0)');
  g.fillStyle = band; g.fillRect(-W, -W, W * 2, W * 2);
  g.restore();
  const bulge = g.createRadialGradient(-W * 0.15, 0, 0, -W * 0.15, 0, W * 0.22);
  bulge.addColorStop(0, 'rgba(255,215,175,.11)'); bulge.addColorStop(1, 'rgba(255,200,160,0)');
  g.fillStyle = bulge; g.fillRect(-W, -H, W * 2, H * 2);
  for (let i = 0; i < 46; i++) {
    const x = (r() - 0.5) * W * 1.2, y = (r() - 0.5) * H * 0.18, rad = 30 + r() * 90;
    g.save(); g.translate(x, y); g.scale(1, 0.35);
    const d = g.createRadialGradient(0, 0, 0, 0, 0, rad);
    d.addColorStop(0, 'rgba(0,0,8,.34)'); d.addColorStop(1, 'rgba(0,0,8,0)');
    g.fillStyle = d; g.fillRect(-rad, -rad, rad * 2, rad * 2);
    g.restore();
  }
  for (let i = 0; i < 2400; i++) {
    const x = (r() - 0.5) * W * 1.25, y = ((r() + r() + r() - 1.5) / 1.5) * H * 0.1;
    const k = r();
    g.fillStyle = k < 0.7 ? `rgba(215,225,255,${0.08 + r() * 0.35})` : `rgba(255,225,190,${0.08 + r() * 0.3})`;
    g.fillRect(x, y, 1, 1);
  }
  g.restore();

  g.globalCompositeOperation = 'lighter';
  const clouds = [
    [0.2, 0.3, 0.34, '150,70,200', 0.07], [0.78, 0.25, 0.3, '60,110,240', 0.07],
    [0.55, 0.78, 0.4, '40,170,190', 0.045], [0.1, 0.8, 0.28, '220,80,140', 0.045],
  ];
  for (const [fx, fy, fr, col, al] of clouds) {
    const x = W * fx, y = H * fy, rad = W * fr;
    g.save(); g.translate(x, y); g.scale(1, 0.55);
    const c2 = g.createRadialGradient(0, 0, 0, 0, 0, rad);
    c2.addColorStop(0, `rgba(${col},${al})`); c2.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = c2; g.fillRect(-rad, -rad, rad * 2, rad * 2);
    g.restore();
  }
  return t;
}

/* =====================================================================
   COCKPIT FRAME  (hull, bolts, console, glass) - pre-rendered once
   ===================================================================== */

function bolt(g, x, y, rad) {
  const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
  gr.addColorStop(0, '#4a5868'); gr.addColorStop(1, '#0c1016');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(x - rad * 0.55, y); g.lineTo(x + rad * 0.55, y); g.stroke();
}

function buildFrame(w, h, dpr) {
  const t = mk(w * dpr, h * dpr), g = t.getContext('2d');
  g.scale(dpr, dpr);
  const m = Math.min(w, h);
  const side = clamp(m * 0.03, 12, 32), top = clamp(m * 0.022, 10, 26), bot = clamp(m * 0.08, 42, 80);
  const wx = side, wy = top, ww = w - side * 2, wh = h - top - bot, rad = clamp(m * 0.05, 18, 46);
  const r = rng(77);

  // hull plating with a window cut-out
  g.beginPath(); g.rect(0, 0, w, h); rr(g, wx, wy, ww, wh, rad);
  const hg = g.createLinearGradient(0, 0, 0, h);
  hg.addColorStop(0, '#27313d'); hg.addColorStop(0.12, '#18202a'); hg.addColorStop(0.8, '#0d1218'); hg.addColorStop(1, '#141b23');
  g.fillStyle = hg; g.fill('evenodd');

  // panel seams
  g.lineWidth = 1;
  for (let k = 1; k < 8; k++) {
    const x = (k * w) / 8;
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, wy); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(x + 1, 0); g.lineTo(x + 1, wy); g.stroke();
  }
  for (let k = 1; k < 5; k++) {
    const y = wy + (k * wh) / 5;
    for (const [x0, x1] of [[0, wx], [w - wx, w]]) {
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(x0, y + 1); g.lineTo(x1, y + 1); g.stroke();
    }
  }
  // bolts
  if (wy >= 14) for (let x = 50; x < w - 30; x += 96) bolt(g, x, wy / 2, 2.4);
  if (side >= 14) for (let y = wy + rad; y < wy + wh - rad; y += 90) { bolt(g, side / 2, y, 2.4); bolt(g, w - side / 2, y, 2.4); }

  // gasket + bright inner lip
  g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = 7;
  g.beginPath(); rr(g, wx - 3, wy - 3, ww + 6, wh + 6, rad + 3); g.stroke();
  g.strokeStyle = 'rgba(150,195,225,.26)'; g.lineWidth = 1.2;
  g.beginPath(); rr(g, wx, wy, ww, wh, rad); g.stroke();

  // console
  const cy0 = h - bot;
  const cg = g.createLinearGradient(0, cy0, 0, h);
  cg.addColorStop(0, '#1d2630'); cg.addColorStop(1, '#0a0e13');
  g.fillStyle = cg; g.fillRect(0, cy0 + 2, w, bot);
  g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, cy0 + 2, w, 1);

  const dw = clamp(w * 0.44, 190, 640), dh = bot * 0.46, dx = w / 2 - dw / 2, dy = cy0 + bot * 0.28;
  g.beginPath(); rr(g, dx, dy, dw, dh, 6);
  g.fillStyle = '#04080c'; g.fill();
  g.strokeStyle = 'rgba(120,200,255,.28)'; g.lineWidth = 1; g.stroke();
  const dg = g.createLinearGradient(0, dy, 0, dy + dh);
  dg.addColorStop(0, 'rgba(80,200,255,.09)'); dg.addColorStop(1, 'rgba(80,200,255,0)');
  g.fillStyle = dg; g.beginPath(); rr(g, dx + 1, dy + 1, dw - 2, dh - 2, 5); g.fill();

  const leds = [];
  const ledCols = ['255,90,90', '90,255,170', '90,200,255', '255,200,90'];
  const step = bot * 0.32;
  for (let i = 0; i < 9; i++) {
    const x = side + bot * 0.35 + i * step, y = h - bot * 0.5;
    if (x > dx - 14) break;
    g.fillStyle = '#05080b'; g.beginPath(); g.arc(x, y, bot * 0.1, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(160,190,210,.3)'; g.lineWidth = 1; g.stroke();
    if (i % 2 === 0) leds.push({ x, y, col: ledCols[i % 4], ph: r() * 9, rate: 0.8 + r() * 2.6, rad: bot * 0.05 });
    else {
      g.fillStyle = '#26323f'; g.beginPath(); rr(g, x - bot * 0.06, y - bot * 0.03, bot * 0.12, bot * 0.06, 2); g.fill();
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = dx + dw + bot * 0.45 + i * bot * 0.46, y0 = h - bot * 0.78;
    if (x > w - side - bot * 0.3) break;
    g.fillStyle = '#05080b'; g.fillRect(x - 2, y0, 4, bot * 0.56);
    g.strokeStyle = 'rgba(160,190,210,.22)'; g.lineWidth = 1; g.strokeRect(x - 2.5, y0 - 0.5, 5, bot * 0.56 + 1);
    const ky = y0 + r() * bot * 0.4;
    g.fillStyle = '#7d8fa0'; g.fillRect(x - 5, ky, 10, 5);
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x - 5, ky + 5, 10, 1);
    if (i % 2) leds.push({ x: x + bot * 0.22, y: h - bot * 0.5, col: ledCols[(i + 1) % 4], ph: r() * 9, rate: 0.6 + r() * 2, rad: bot * 0.04 });
  }

  // things that sit on the glass (clipped to the window)
  g.save();
  g.beginPath(); rr(g, wx, wy, ww, wh, rad); g.clip();
  g.strokeStyle = '#000'; g.lineWidth = 6;
  g.shadowColor = 'rgba(0,0,0,.95)'; g.shadowBlur = 45 * dpr;
  for (let i = 0; i < 2; i++) { g.beginPath(); rr(g, wx, wy, ww, wh, rad); g.stroke(); }
  g.shadowBlur = 0; g.shadowColor = 'transparent';

  for (const [x0, bw, al] of [[w * 0.2, w * 0.12, 0.05], [w * 0.36, w * 0.035, 0.04]]) {
    g.save(); g.translate(x0, 0); g.rotate(0.45);
    const lg = g.createLinearGradient(0, 0, bw, 0);
    lg.addColorStop(0, 'rgba(200,230,255,0)'); lg.addColorStop(0.5, `rgba(200,230,255,${al})`); lg.addColorStop(1, 'rgba(200,230,255,0)');
    g.fillStyle = lg; g.fillRect(0, -h, bw, h * 3);
    g.restore();
  }
  const spill = g.createLinearGradient(0, wy + wh - 100, 0, wy + wh);
  spill.addColorStop(0, 'rgba(90,200,255,0)'); spill.addColorStop(1, 'rgba(90,200,255,.07)');
  g.fillStyle = spill; g.fillRect(wx, wy + wh - 100, ww, 100);
  for (let i = 0; i < 16; i++) {
    const x = wx + r() * ww, y = wy + r() * wh, len = 6 + r() * 26, a = r() * TAU;
    g.strokeStyle = `rgba(255,255,255,${0.025 + r() * 0.04})`; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  for (let i = 0; i < 34; i++) {
    g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.04})`;
    g.fillRect(wx + r() * ww, wy + r() * wh, 1, 1);
  }
  g.restore();

  return { canvas: t, leds, disp: { x: dx, y: dy, w: dw, h: dh }, wx, wy, ww, wh, rad, bot };
}

/* =====================================================================
   WORLD DRAWING
   ===================================================================== */

function sphere(c, S, sp, rot, x, y, r, a, ang) {
  if (r < 0.6) return;
  const k = (2 * r) / TH, W = TW * k;
  if (sp.atm && sp.haze > 0) {
    const hx = x + Math.cos(ang) * r * 0.1, hy = y + Math.sin(ang) * r * 0.1;
    const g = c.createRadialGradient(hx, hy, r * 0.94, hx, hy, r * 1.3);
    g.addColorStop(0, `rgba(${sp.atm},${0.32 * sp.haze * a})`);
    g.addColorStop(1, `rgba(${sp.atm},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(hx, hy, r * 1.3, 0, TAU); c.fill();
  }
  c.save();
  c.globalAlpha = a;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
  const off = (((rot % 1) + 1) % 1) * W;
  c.drawImage(sp.tex, x - r - off, y - r, W, 2 * r);
  c.drawImage(sp.tex, x - r - off + W, y - r, W, 2 * r);
  if (sp.clouds) {
    const o2 = ((((rot * 1.4) % 1) + 1) % 1) * W;
    c.globalAlpha = a * 0.85;
    c.drawImage(sp.clouds, x - r - o2, y - r, W, 2 * r);
    c.drawImage(sp.clouds, x - r - o2 + W, y - r, W, 2 * r);
    c.globalAlpha = a;
  }
  c.save();
  c.translate(x, y); c.rotate(ang);
  c.drawImage(S.shade, -r, -r, 2 * r, 2 * r);
  if (sp.atm) c.drawImage(rimSprite(S, sp.atm), -r, -r, 2 * r, 2 * r);
  c.restore();
  if (sp.emis) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = a * 0.9;
    c.drawImage(sp.emis, x - r - off, y - r, W, 2 * r);
    c.drawImage(sp.emis, x - r - off + W, y - r, W, 2 * r);
  }
  c.restore();
}

function drawRing(c, x, y, r, ring, a, half) {
  c.save();
  c.translate(x, y); c.rotate(ring.rot);
  c.beginPath();
  if (half === 'front') c.rect(-r * 6, 0, r * 12, r * 6);
  else c.rect(-r * 6, -r * 6, r * 12, r * 6);
  c.clip();
  for (const bd of ring.bands) {
    const ro = r * bd.o, ri = r * bd.i;
    c.beginPath();
    c.moveTo(ro, 0); c.ellipse(0, 0, ro, ro * ring.tilt, 0, 0, TAU); c.closePath();
    c.moveTo(ri, 0); c.ellipse(0, 0, ri, ri * ring.tilt, 0, 0, TAU); c.closePath();
    c.fillStyle = bd.col; c.globalAlpha = a * bd.a;
    c.fill('evenodd');
  }
  c.restore();
}

function makeRing(atm) {
  const [R, G, B] = atm.split(',').map(Number);
  const edges = [1.28];
  while (edges[edges.length - 1] < 2.2) edges.push(edges[edges.length - 1] + rand(0.08, 0.26));
  const bands = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const j = rand(-30, 30);
    bands.push({
      i: edges[i], o: edges[i + 1] - (Math.random() < 0.25 ? 0.03 : 0),
      col: `rgb(${clamp(R + j, 0, 255) | 0},${clamp(G + j, 0, 255) | 0},${clamp(B + j * 0.6, 0, 255) | 0})`,
      a: rand(0.25, 0.75),
    });
  }
  return { bands, tilt: rand(0.14, 0.27), rot: rand(-0.3, 0.3) };
}

function drawWorld(c, S, b, x, y, r, a) {
  const ang = Math.atan2(S.sunY - y, S.sunX - x);
  const moons = b.moons || [];
  for (const mo of moons) if (Math.sin(mo.a) < 0) drawMoon(c, S, mo, x, y, r, a, ang);
  if (b.ring) drawRing(c, x, y, r, b.ring, a, 'back');
  sphere(c, S, b.spec, b.rot, x, y, r, a, ang);
  if (b.ring) drawRing(c, x, y, r, b.ring, a, 'front');
  for (const mo of moons) if (Math.sin(mo.a) >= 0) drawMoon(c, S, mo, x, y, r, a, ang);
}
function drawMoon(c, S, mo, x, y, r, a, ang) {
  const mx = x + Math.cos(mo.a) * mo.dist * r, my = y + Math.sin(mo.a) * mo.dist * r * mo.inc;
  sphere(c, S, mo.spec, mo.rot, mx, my, mo.size * r, a, ang);
}

const SUNS = [
  { rgb: '255,214,150', core: '255,248,230', cls: 'G' },
  { rgb: '170,205,255', core: '240,248,255', cls: 'B' },
  { rgb: '255,150,95', core: '255,225,190', cls: 'K' },
  { rgb: '255,110,80', core: '255,200,170', cls: 'M' },
];

function drawSun(c, S, b, x, y, r, a, t, w, h, m) {
  const col = b.col;
  const rr2 = r * (1 + 0.012 * Math.sin(t * 2 + b.rot * 9));
  glow(c, x, y, r * 15, col.rgb, 0.2 * a);
  glow(c, x, y, r * 5, col.rgb, 0.5 * a);
  c.save();
  c.globalCompositeOperation = 'lighter';
  // anamorphic streak + vertical spike
  const L = r * 38, th = Math.max(1.5, r * 0.16);
  let g = c.createLinearGradient(x - L, 0, x + L, 0);
  g.addColorStop(0, 'rgba(120,170,255,0)'); g.addColorStop(0.5, `rgba(${col.rgb},${0.42 * a})`); g.addColorStop(1, 'rgba(120,170,255,0)');
  c.fillStyle = g; c.fillRect(x - L, y - th / 2, L * 2, th);
  const L2 = r * 11;
  g = c.createLinearGradient(0, y - L2, 0, y + L2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(${col.rgb},${0.28 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(x - th / 3, y - L2, th / 1.5, L2 * 2);
  // prominences
  for (let i = 0; i < 9; i++) {
    const an = i * 0.7 + Math.sin(t * 0.3 + i) * 0.25;
    glow(c, x + Math.cos(an) * rr2 * 1.05, y + Math.sin(an) * rr2 * 1.05, rr2 * 0.4, col.rgb, 0.3 * a, false);
  }
  c.restore();
  // disc
  c.save();
  c.globalAlpha = a;
  const d = c.createRadialGradient(x, y, 0, x, y, rr2);
  d.addColorStop(0, `rgb(${col.core})`); d.addColorStop(0.7, `rgb(${col.core})`); d.addColorStop(1, `rgb(${col.rgb})`);
  c.fillStyle = d; c.beginPath(); c.arc(x, y, rr2, 0, TAU); c.fill();
  c.restore();
  // lens ghosts along the line through the screen centre
  const cx = S.cx, cy = S.cy;
  for (const [f, sz, al] of [[0.45, 1.3, 0.05], [0.9, 2.4, 0.04], [1.35, 1.0, 0.06], [1.8, 3.2, 0.03]]) {
    const gx = x + (cx - x) * f, gy = y + (cy - y) * f, gr = clamp(r * sz, 8, m * 0.1);
    glow(c, gx, gy, gr, col.rgb, al * a * 2);
    c.save(); c.globalAlpha = al * a * 1.2; c.strokeStyle = `rgb(${col.rgb})`; c.lineWidth = 1.2;
    c.beginPath(); c.arc(gx, gy, gr * 0.7, 0, TAU); c.stroke(); c.restore();
  }
}

function diskHalf(c, x, y, r, t, tilt, rot, half) {
  c.save();
  c.translate(x, y); c.rotate(rot);
  c.beginPath();
  if (half === 'back') c.rect(-r * 6, -r * 6, r * 12, r * 6);
  else c.rect(-r * 6, 0, r * 12, r * 6);
  c.clip();
  c.scale(1, tilt);
  const g = c.createRadialGradient(0, 0, r * 1.2, 0, 0, r * 3.7);
  g.addColorStop(0, 'rgba(255,245,220,.95)'); g.addColorStop(0.12, 'rgba(255,205,125,.9)');
  g.addColorStop(0.4, 'rgba(255,125,55,.55)'); g.addColorStop(0.75, 'rgba(150,40,20,.25)'); g.addColorStop(1, 'rgba(60,10,10,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 3.7, 0, TAU); c.fill();
  c.lineCap = 'round';
  for (let i = 0; i < 38; i++) {
    const rr3 = r * (1.3 + (i / 38) * 2.2), sp = 1.6 / Math.pow(rr3 / r, 1.5);
    const a0 = t * sp + i * 2.4, len = 0.5 + ((i * 7) % 5) * 0.14;
    const bright = 0.55 + 0.45 * Math.cos(a0);
    c.strokeStyle = `rgba(255,${(215 - i * 3) | 0},${(150 - i * 2) | 0},${0.32 * (1 - i / 44) * bright})`;
    c.lineWidth = r * 0.06;
    c.beginPath(); c.arc(0, 0, rr3, a0, a0 + len); c.stroke();
  }
  c.restore();
}

function drawBlackHole(c, b, x, y, r, a, t) {
  const tilt = b.tilt, rot = b.rotA;
  c.save();
  c.globalAlpha = a;
  glow(c, x, y, r * 8, '255,150,70', 0.1);
  diskHalf(c, x, y, r, t, tilt, rot, 'back');
  c.fillStyle = '#000'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  // photon ring
  glow(c, x, y, r * 1.6, '255,190,120', 0.18);
  c.strokeStyle = 'rgba(255,232,195,.9)'; c.lineWidth = Math.max(1, r * 0.045);
  c.beginPath(); c.arc(x, y, r * 1.035, 0, TAU); c.stroke();
  // gravitationally lensed arcs of the far side
  c.save(); c.translate(x, y); c.rotate(rot);
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(255,170,90,.5)'; c.lineWidth = r * 0.26;
  c.beginPath(); c.arc(0, 0, r * 1.32, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
  c.strokeStyle = 'rgba(255,235,200,.8)'; c.lineWidth = r * 0.07;
  c.beginPath(); c.arc(0, 0, r * 1.22, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  c.strokeStyle = 'rgba(255,150,80,.32)'; c.lineWidth = r * 0.1;
  c.beginPath(); c.arc(0, 0, r * 1.18, Math.PI * 0.14, Math.PI * 0.86); c.stroke();
  c.restore();
  diskHalf(c, x, y, r, t, tilt, rot, 'front');
  c.restore();
}

function drawStation(c, b, x, y, R, a, t) {
  const tilt = 0.27, spin = t * 0.09 + b.rot * TAU;
  const ringW = R * 0.085, hw = R * 0.1, hh = R * 0.5;
  c.save();
  c.translate(x, y); c.rotate(b.tilt);
  c.globalAlpha = a;

  const ringHalf = (front) => {
    c.save();
    c.beginPath();
    if (front) c.rect(-R * 2, 0, R * 4, R * 2); else c.rect(-R * 2, -R * 2, R * 4, R * 2);
    c.clip();
    c.strokeStyle = '#2a3644'; c.lineWidth = ringW * (front ? 1.15 : 0.9);
    c.beginPath(); c.ellipse(0, 0, R, R * tilt, 0, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(190,220,245,.35)'; c.lineWidth = Math.max(1, ringW * 0.16);
    c.beginPath(); c.ellipse(0, -ringW * 0.3, R, R * tilt, 0, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = Math.max(1, ringW * 0.12);
    c.beginPath(); c.ellipse(0, ringW * 0.38, R, R * tilt, 0, 0, TAU); c.stroke();
    const N = 56;
    c.beginPath();
    for (let i = 0; i < N; i++) {
      const an = spin + (i / N) * TAU, sn = Math.sin(an);
      if ((sn > 0) !== front) continue;
      if (i % 7 === 0) {
        c.moveTo(Math.cos(an) * R, sn * R * tilt - ringW * 0.5);
        c.lineTo(Math.cos(an) * R, sn * R * tilt + ringW * 0.5);
      }
    }
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.stroke();
    for (let i = 0; i < N; i++) {
      const an = spin + (i / N) * TAU, sn = Math.sin(an);
      if ((sn > 0) !== front) continue;
      const hv = hash(i * 3.1 + b.rot * 50);
      if (hv < 0.3) continue;
      const wx = Math.cos(an) * R, wy = sn * R * tilt;
      c.fillStyle = hv > 0.82 ? 'rgba(130,225,255,.95)' : 'rgba(255,222,150,.9)';
      const s = Math.max(1, ringW * 0.13);
      c.fillRect(wx - s, wy - s * 0.5, s * 2, s);
    }
    c.restore();
  };

  ringHalf(false);
  // spokes
  c.strokeStyle = '#46576a'; c.lineWidth = Math.max(1, R * 0.022);
  for (let k = 0; k < 4; k++) {
    const an = spin + (k * Math.PI) / 2;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(an) * R, Math.sin(an) * R * tilt); c.stroke();
  }
  // solar wings
  const wy2 = -hh * 0.82;
  for (const s of [-1, 1]) {
    const px = s > 0 ? hw : -hw - R * 0.55;
    c.fillStyle = '#16304f'; c.fillRect(px, wy2 - R * 0.05, R * 0.55, R * 0.1);
    c.strokeStyle = 'rgba(110,180,235,.35)'; c.lineWidth = 1;
    c.strokeRect(px, wy2 - R * 0.05, R * 0.55, R * 0.1);
    c.beginPath();
    for (let i = 1; i < 6; i++) { c.moveTo(px + (R * 0.55 * i) / 6, wy2 - R * 0.05); c.lineTo(px + (R * 0.55 * i) / 6, wy2 + R * 0.05); }
    c.stroke();
  }
  // hub
  const hg = c.createLinearGradient(-hw, 0, hw, 0);
  hg.addColorStop(0, '#27323e'); hg.addColorStop(0.35, '#8296a8'); hg.addColorStop(1, '#1d2731');
  c.fillStyle = hg; c.fillRect(-hw, -hh, hw * 2, hh * 2);
  c.fillStyle = '#566879';
  c.beginPath(); c.ellipse(0, -hh, hw, hw * tilt * 1.4, 0, 0, TAU); c.fill();
  c.fillStyle = '#1b242d';
  c.beginPath(); c.ellipse(0, hh, hw, hw * tilt * 1.4, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1;
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(-hw, i * hh * 0.28); c.lineTo(hw, i * hh * 0.28); c.stroke(); }
  c.fillStyle = 'rgba(255,222,150,.85)';
  for (let i = -2; i <= 2; i++) c.fillRect(-hw * 0.25, i * hh * 0.3 - 1, hw * 0.5, 2);
  // antenna + beacon
  c.strokeStyle = '#9fb2c4'; c.lineWidth = Math.max(1, R * 0.012);
  c.beginPath(); c.moveTo(0, -hh); c.lineTo(0, -hh - R * 0.24); c.stroke();
  c.beginPath(); c.arc(0, -hh - R * 0.12, R * 0.05, Math.PI, TAU); c.stroke();
  if (Math.sin(t * 3 + b.rot * 20) > 0.5) glow(c, 0, -hh - R * 0.24, R * 0.07, '255,80,90', 0.95);
  glow(c, 0, hh, R * 0.06, '120,220,255', 0.7);

  ringHalf(true);
  c.restore();
}

function drawProbe(c, b, x, y, r, a, t) {
  c.save();
  c.translate(x, y); c.rotate(b.rot * TAU + t * 0.15); c.globalAlpha = a;
  for (const s of [-1, 1]) {
    const px = s > 0 ? r * 0.6 : -r * 2.2;
    c.fillStyle = '#1f3a5c'; c.fillRect(px, -r * 0.45, r * 1.6, r * 0.9);
    c.strokeStyle = 'rgba(120,190,240,.45)'; c.lineWidth = 1; c.strokeRect(px, -r * 0.45, r * 1.6, r * 0.9);
    c.beginPath(); for (let i = 1; i < 4; i++) { c.moveTo(px + (r * 1.6 * i) / 4, -r * 0.45); c.lineTo(px + (r * 1.6 * i) / 4, r * 0.45); } c.stroke();
  }
  const g = c.createLinearGradient(0, -r * 0.5, 0, r * 0.5);
  g.addColorStop(0, '#e2c25a'); g.addColorStop(1, '#8a6a22');
  c.fillStyle = g; c.fillRect(-r * 0.55, -r * 0.55, r * 1.1, r * 1.1);
  c.fillStyle = '#dde4ea';
  c.beginPath(); c.moveTo(-r * 0.7, -r * 0.55); c.quadraticCurveTo(0, -r * 1.6, r * 0.7, -r * 0.55); c.closePath(); c.fill();
  c.strokeStyle = '#a9b6c2'; c.lineWidth = Math.max(1, r * 0.08);
  c.beginPath(); c.moveTo(0, -r * 0.95); c.lineTo(0, -r * 1.5); c.stroke();
  if (Math.sin(t * 2.6 + b.rot * 30) > 0.6) glow(c, r * 0.3, r * 0.3, r * 0.5, '255,90,90', 0.9);
  c.restore();
}

function drawPulsar(c, b, x, y, r, a, t) {
  const rot = b.rot * TAU + t * 1.6;
  c.save();
  c.globalAlpha = a;
  glow(c, x, y, r * 14, '120,170,255', 0.35);
  glow(c, x, y, r * 4, '210,235,255', 0.9);
  c.globalCompositeOperation = 'lighter';
  const L = r * 26;
  for (let k = 0; k < 2; k++) {
    c.save(); c.translate(x, y); c.rotate(rot + k * Math.PI);
    const pulse = 0.5 + 0.5 * Math.cos(rot * 2 + k * Math.PI);
    const g = c.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, `rgba(170,210,255,${0.55 * (0.4 + 0.6 * pulse)})`); g.addColorStop(1, 'rgba(120,170,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, -r * 0.35); c.lineTo(L, -r * 1.1); c.lineTo(L, r * 1.1); c.lineTo(0, r * 0.35); c.closePath(); c.fill();
    c.restore();
  }
  c.strokeStyle = 'rgba(160,205,255,.3)'; c.lineWidth = 1;
  c.beginPath(); c.ellipse(x, y, r * 6, r * 1.6, b.rot, 0, TAU); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, Math.max(1.2, r * 0.8), 0, TAU); c.fill();
  c.restore();
}

function drawMonolith(c, b, x, y, r, a, t) {
  const an = b.rot * TAU + t * 0.12;
  const hgt = r * 2.2, wd = r * 0.5 * (0.18 + 0.82 * Math.abs(Math.cos(an)));
  c.save();
  c.translate(x, y); c.rotate(b.tilt + Math.sin(t * 0.2) * 0.06); c.globalAlpha = a;
  c.fillStyle = '#020204'; c.fillRect(-wd, -hgt, wd * 2, hgt * 2);
  c.strokeStyle = 'rgba(200,215,235,.4)'; c.lineWidth = 1;
  c.strokeRect(-wd, -hgt, wd * 2, hgt * 2);
  const g = c.createLinearGradient(-wd, 0, wd, 0);
  g.addColorStop(0, 'rgba(220,235,255,.18)'); g.addColorStop(0.15, 'rgba(220,235,255,0)');
  c.fillStyle = g; c.fillRect(-wd, -hgt, wd * 2, hgt * 2);
  c.restore();
}

function drawGalaxy(c, b, x, y, r, a, t) {
  const gl = b.gal;
  c.save();
  c.translate(x, y); c.rotate(gl.pa); c.scale(1, gl.incl); c.rotate(t * 0.01);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * 0.9;
  c.drawImage(gl.spr, -r, -r, r * 2, r * 2);
  c.restore();
}

function drawNebulaBody(c, b, x, y, r, a, t) {
  c.save();
  c.translate(x, y); c.rotate(b.neb.pa + t * 0.004);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * 0.6;
  c.drawImage(b.neb.spr, -r, -r, r * 2, r * 2);
  c.restore();
}

function drawField(c, S, b, a, t, m) {
  for (const k of b.rocks) {
    const zz = b.z + k.dz;
    if (zz < 0.07 || zz > 1.15) continue;
    const kk = 1 / zz;
    const px = S.cx + (b.x + k.dx) * m * kk, py = S.cy + (b.y + k.dy) * m * kk, pr = k.size * m * kk;
    if (pr < 0.8 || px < -80 || px > S.w + 80 || py < -80 || py > S.h + 80) continue;
    c.globalAlpha = a * smooth(1.15, 0.98, zz) * smooth(0.07, 0.17, zz);
    c.save();
    c.translate(px, py); c.rotate(k.rot + t * k.spin);
    c.drawImage(S.rocks[k.spr], -pr * 1.25, -pr * 1.25, pr * 2.5, pr * 2.5);
    c.restore();
  }
  c.globalAlpha = 1;
}

/* =====================================================================
   SHIPS  (local coords: +x is forward)
   ===================================================================== */

function navLights(c, t, x1, y1, x2, y2, ph) {
  if (Math.sin(t * 2.4 + ph) > -0.2) glow(c, x1, y1, 7, '255,70,70', 0.9);
  if (Math.sin(t * 2.4 + ph + 1.6) > -0.2) glow(c, x2, y2, 7, '70,255,140', 0.9);
}

function shipShuttle(c, t, s) {
  const f = 0.8 + 0.2 * Math.sin(t * 30 + s.ph);
  glow(c, -36, 0, 30, '110,200,255', 0.8 * f);
  const fl = c.createLinearGradient(-30, 0, -70, 0);
  fl.addColorStop(0, 'rgba(255,255,255,.9)'); fl.addColorStop(0.4, 'rgba(110,200,255,.6)'); fl.addColorStop(1, 'rgba(60,140,255,0)');
  c.fillStyle = fl; c.beginPath(); c.moveTo(-28, -4); c.lineTo(-70 * (0.9 + 0.1 * f), 0); c.lineTo(-28, 4); c.closePath(); c.fill();
  c.fillStyle = '#6a7d8d';
  c.beginPath(); c.moveTo(2, -6); c.lineTo(-12, -23); c.lineTo(-26, -23); c.lineTo(-20, -6); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(2, 6); c.lineTo(-12, 23); c.lineTo(-26, 23); c.lineTo(-20, 6); c.closePath(); c.fill();
  const hg = c.createLinearGradient(0, -9, 0, 9);
  hg.addColorStop(0, '#e6eef5'); hg.addColorStop(1, '#6b7e8f');
  c.fillStyle = hg;
  c.beginPath(); c.moveTo(38, 0); c.lineTo(10, -9); c.lineTo(-20, -8); c.lineTo(-30, -5); c.lineTo(-30, 5); c.lineTo(-20, 8); c.lineTo(10, 9); c.closePath(); c.fill();
  c.fillStyle = '#d9483a'; c.fillRect(-18, -1.5, 22, 3);
  const cg = c.createLinearGradient(0, -5, 0, 3);
  cg.addColorStop(0, '#a6e7ff'); cg.addColorStop(1, '#2a6c8f');
  c.fillStyle = cg; c.beginPath(); c.ellipse(16, -2, 9, 4, 0, 0, TAU); c.fill();
  navLights(c, t, -25, -23, -25, 23, s.ph);
}

function shipFreighter(c, t, s) {
  glow(c, -116, 0, 46, '90,190,255', 0.5);
  for (const y of [-9, 0, 9]) {
    glow(c, -113, y, 14, '150,220,255', 0.9);
    c.fillStyle = '#e8f8ff'; c.fillRect(-114, y - 1.2, 3, 2.4);
  }
  c.fillStyle = '#2b3541'; c.fillRect(-112, -15, 18, 30);
  c.fillStyle = '#39454f'; c.fillRect(-100, -6, 200, 12);
  const cols = ['#8a4b3a', '#3f6a82', '#8a7a3a', '#4a5f4a', '#6a4a7a', '#7a7a7a'];
  for (let i = 0; i < 7; i++) {
    const x = -90 + i * 27;
    for (const side of [-1, 1]) {
      if (hash(i * 7 + side * 3 + s.ph * 10) < 0.15) continue;
      const col = cols[(hash(i * 13 + side + s.ph * 5) * 6) | 0];
      const y = side < 0 ? -28 : 6;
      c.fillStyle = col; c.fillRect(x, y, 24, 22);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x, y, 24, 2);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, y + 20, 24, 2);
      c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 0.8; c.strokeRect(x, y, 24, 22);
    }
  }
  const bg = c.createLinearGradient(0, -14, 0, 14);
  bg.addColorStop(0, '#c4cfda'); bg.addColorStop(1, '#6b7885');
  c.fillStyle = bg; c.fillRect(100, -13, 30, 26);
  c.beginPath(); c.moveTo(130, -13); c.lineTo(142, 0); c.lineTo(130, 13); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,222,150,.95)';
  for (let i = 0; i < 4; i++) c.fillRect(106 + i * 6, -7, 4, 3);
  navLights(c, t, 100, -13, 100, 13, s.ph);
}

function shipCapital(c, t, s) {
  // plume
  for (const y of [-24, -8, 8, 24]) {
    glow(c, -255, y, 46, '80,160,255', 0.85);
    const g = c.createLinearGradient(-252, 0, -430, 0);
    g.addColorStop(0, 'rgba(160,215,255,.55)'); g.addColorStop(1, 'rgba(80,140,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(-252, y - 4); c.lineTo(-430, y - 1); c.lineTo(-430, y + 1); c.lineTo(-252, y + 4); c.closePath(); c.fill();
  }
  const hull = c.createLinearGradient(0, -52, 0, 52);
  hull.addColorStop(0, '#46566a'); hull.addColorStop(0.5, '#1f2a36'); hull.addColorStop(1, '#0a0f15');
  c.fillStyle = hull;
  c.beginPath();
  c.moveTo(270, 0); c.lineTo(120, -26); c.lineTo(-120, -50); c.lineTo(-232, -46); c.lineTo(-252, -30);
  c.lineTo(-252, 30); c.lineTo(-232, 46); c.lineTo(-120, 50); c.lineTo(120, 26); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(170,205,235,.22)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(270, 0); c.lineTo(120, -26); c.lineTo(-120, -50); c.lineTo(-232, -46); c.stroke();
  c.beginPath(); c.moveTo(200, 0); c.lineTo(-240, 0); c.stroke();
  // tower
  c.fillStyle = '#2b3745';
  c.beginPath(); c.moveTo(-160, -48); c.lineTo(-148, -86); c.lineTo(-84, -86); c.lineTo(-62, -50); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(170,205,235,.25)'; c.stroke();
  c.fillStyle = '#8fa4b8'; c.fillRect(-122, -100, 2, 14);
  // windows
  c.beginPath();
  for (let row = -4; row <= 4; row++) {
    for (let i = 0; i < 46; i++) {
      const x = -232 + i * 9.5, edge = 48 - Math.abs(x + 60) * 0.1;
      if (Math.abs(row * 7) > edge * 0.7) continue;
      if (hash(row * 31 + i * 7.7 + s.ph * 40) < 0.62) continue;
      c.rect(x, row * 7 - 1, 3.2, 1.8);
    }
  }
  c.fillStyle = 'rgba(255,215,150,.85)'; c.fill();
  c.beginPath();
  for (let i = 0; i < 6; i++) c.rect(-148 + i * 11, -80 + (i % 2) * 6, 3.5, 2);
  c.fill();
  navLights(c, t, 100, -22, 100, 22, s.ph);
  if (Math.sin(t * 5 + s.ph) > 0.85) glow(c, -122, -100, 12, '255,255,255', 0.95);
}

function shipFighters(c, t, s) {
  for (const [ox, oy] of [[0, 0], [-34, -24], [-34, 24]]) {
    c.save(); c.translate(ox, oy);
    glow(c, -14, 0, 20, '110,200,255', 0.8 * (0.8 + 0.2 * Math.sin(t * 40 + ox)));
    c.fillStyle = '#7d8e9d';
    c.beginPath(); c.moveTo(0, -3); c.lineTo(-10, -13); c.lineTo(-13, -11); c.lineTo(-8, -2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0, 3); c.lineTo(-10, 13); c.lineTo(-13, 11); c.lineTo(-8, 2); c.closePath(); c.fill();
    const g = c.createLinearGradient(0, -5, 0, 5);
    g.addColorStop(0, '#e1e9f0'); g.addColorStop(1, '#6a7b8a');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(18, 0); c.lineTo(-6, -4.5); c.lineTo(-12, 0); c.lineTo(-6, 4.5); c.closePath(); c.fill();
    c.fillStyle = '#7fd4ff'; c.beginPath(); c.ellipse(4, 0, 4, 1.8, 0, 0, TAU); c.fill();
    c.restore();
  }
}

function drawShipObj(c, s, t) {
  c.save();
  c.translate(s.x, s.y); c.rotate(s.ang * s.dir); c.scale(s.dir * s.sc, s.sc);
  switch (s.type) {
    case 'shuttle': shipShuttle(c, t, s); break;
    case 'freighter': shipFreighter(c, t, s); break;
    case 'capital': shipCapital(c, t, s); break;
    default: shipFighters(c, t, s);
  }
  c.restore();
}

function spawnShip(S, w, h, m) {
  const type = wpick([['shuttle', 3], ['freighter', 2], ['capital', 1.1], ['fighters', 1.6]], null);
  const dir = Math.random() < 0.5 ? 1 : -1, U = m / 620;
  let len, fac, T;
  switch (type) {
    case 'shuttle': len = 80; fac = rand(0.7, 1.5); T = rand(20, 32); break;
    case 'freighter': len = 280; fac = rand(0.5, 0.95); T = rand(40, 60); break;
    case 'capital': len = 700; fac = rand(0.85, 1.5); T = rand(80, 115); break;
    default: len = 120; fac = rand(0.7, 1.2); T = rand(11, 17);
  }
  const sc = U * fac, half = (len * sc) / 2 + 40;
  S.ships.push({
    type, dir, sc, half, x: dir > 0 ? -half : w + half, y: h * rand(0.14, 0.6),
    vx: (dir * (w + half * 2)) / T, ang: rand(-0.04, 0.04), ph: rand(0, 10),
    layer: type === 'capital' ? (Math.random() < 0.5 ? 'back' : 'front') : sc < U * 0.95 ? 'back' : 'front',
  });
}

/* =====================================================================
   BODIES
   ===================================================================== */

const MAJOR = [['earth', 1.4], ['gas', 1.3], ['ringed', 1.5], ['ice', 1], ['lava', 1], ['mars', 0.8], ['moon', 0.8], ['station', 1.5], ['sun', 1.1], ['field', 1.1], ['blackhole', 0.7]];
const MINOR = [['galaxy', 1.4], ['nebula', 1.2], ['probe', 1], ['pulsar', 0.7], ['monolith', 0.1]];
const TYPES = {
  earth: 'TERRESTRIAL WORLD', gas: 'GAS GIANT', ringed: 'RINGED GIANT', ice: 'ICE WORLD', lava: 'VOLCANIC WORLD',
  mars: 'ARID WORLD', moon: 'AIRLESS MOON', station: 'ORBITAL STATION', sun: 'STELLAR BODY', field: 'ASTEROID FIELD',
  blackhole: 'KERR SINGULARITY', pulsar: 'PULSAR', galaxy: 'SPIRAL GALAXY', monolith: 'UNIDENTIFIED OBJECT',
};

function makeMoons(S, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      spec: take(S, 'moon'), a: rand(0, TAU), sp: rand(0.025, 0.07) * (Math.random() < 0.5 ? 1 : -1),
      dist: 1.7 + i * rand(0.6, 0.9) + rand(0, 0.4), size: rand(0.1, 0.2), inc: rand(0.18, 0.4), rot: Math.random(),
    });
  }
  return out;
}

function makeBody(S, kind, z, w, h) {
  const m = Math.min(w, h);
  const b = {
    kind, z, x: 0, y: 0, size: 0.1, ext: 1, la: 0, rot: Math.random(), fz0: 0.1, fz1: 0.2,
    label: true, name: makeName(), type: TYPES[kind] || '', px: 0, py: 0, pr: 0, tilt: rand(-0.3, 0.3),
  };
  switch (kind) {
    case 'earth': b.spec = take(S, 'earth'); b.size = rand(0.11, 0.17); b.moons = makeMoons(S, Math.random() < 0.6 ? 1 : 0); b.name += ' ' + pick(['III', 'IV', 'b', 'c']); break;
    case 'gas': b.spec = take(S, 'gas'); b.size = rand(0.17, 0.26); b.moons = makeMoons(S, 1 + ((Math.random() * 2) | 0)); b.name += ' ' + pick(['V', 'VI', 'VII']); break;
    case 'ringed': b.spec = take(S, 'gas'); b.size = rand(0.11, 0.16); b.ring = makeRing(b.spec.atm); b.ext = 2.3; b.moons = makeMoons(S, 1); b.name += ' ' + pick(['VI', 'VIII']); break;
    case 'ice': b.spec = take(S, 'ice'); b.size = rand(0.09, 0.14); b.moons = makeMoons(S, Math.random() < 0.4 ? 1 : 0); b.name += ' ' + pick(['d', 'e', 'IX']); break;
    case 'lava': b.spec = take(S, 'lava'); b.size = rand(0.08, 0.13); b.name += ' ' + pick(['a', 'b']); break;
    case 'mars': b.spec = take(S, 'mars'); b.size = rand(0.08, 0.12); b.moons = makeMoons(S, Math.random() < 0.5 ? 1 : 0); b.name += ' ' + pick(['II', 'IV']); break;
    case 'moon': b.spec = take(S, 'moon'); b.size = rand(0.07, 0.12); b.name += ' ' + pick(['I', 'II']) + 'a'; break;
    case 'station': b.size = rand(0.12, 0.18); b.ext = 1.4; b.name = 'STATION ' + b.name.toUpperCase(); break;
    case 'sun': b.col = pick(SUNS); b.size = rand(0.035, 0.06); b.fz0 = 0.28; b.fz1 = 0.5; b.type = 'STAR - CLASS ' + b.col.cls; break;
    case 'field': b.size = 0.4; b.noCull = true; b.fz0 = 0.14; b.fz1 = 0.22; b.name = 'DEBRIS FIELD ' + ((Math.random() * 90 + 10) | 0);
      b.rocks = [];
      for (let i = 0; i < 46; i++) b.rocks.push({ dx: (Math.random() - 0.5) * 0.55, dy: (Math.random() - 0.5) * 0.32, dz: (Math.random() - 0.5) * 0.2, size: 0.003 + Math.pow(Math.random(), 3) * 0.022, spr: (Math.random() * S.rocks.length) | 0, rot: rand(0, TAU), spin: rand(-0.4, 0.4) });
      b.rocks.sort((p, q) => q.dz - p.dz); break;
    case 'blackhole': b.size = rand(0.045, 0.07); b.ext = 3.4; b.tilt = rand(0.16, 0.22); b.rotA = rand(-0.25, 0.1); b.fz0 = 0.2; b.fz1 = 0.34; b.name = pick(SYL) + '-X' + ((Math.random() * 9 + 1) | 0); break;
    case 'pulsar': b.size = rand(0.014, 0.02); b.ext = 10; b.fz0 = 0.25; b.fz1 = 0.4; b.name = 'PSR ' + ((Math.random() * 900 + 100) | 0) + '+' + ((Math.random() * 40) | 0); break;
    case 'probe': b.size = rand(0.018, 0.026); b.label = false; b.fz0 = 0.14; b.fz1 = 0.2; break;
    case 'monolith': b.size = rand(0.022, 0.03); b.fz0 = 0.14; b.fz1 = 0.2; b.name = '???'; break;
    case 'galaxy': b.gal = take(S, 'galaxy'); b.size = rand(0.12, 0.2); b.fz0 = 0.3; b.fz1 = 0.5; b.name = 'NGC ' + ((Math.random() * 6000 + 500) | 0); break;
    case 'nebula': b.neb = take(S, 'nebula'); b.size = rand(0.5, 0.9); b.label = false; b.fz0 = 0.28; b.fz1 = 0.55; break;
  }
  placeBody(b, w, h, m, S);
  return b;
}

function placeBody(b, w, h, m, S) {
  const lim = (0.5 * w) / m, limy = (0.5 * h) / m, ext = b.size * b.ext;
  if (b.kind === 'sun') { b.x = -rand(0.35, 0.95) * lim; b.y = rand(-0.8, 0.1) * limy; return; }
  if (b.kind === 'galaxy' || b.kind === 'nebula') { b.x = rand(-0.9, 0.9) * lim; b.y = rand(-0.85, 0.85) * limy; return; }
  S.side *= -1;
  const portrait = h > w * 1.1;
  if (portrait) {
    let ay = ext * 1.08 + rand(0.08, 0.4); ay = Math.min(ay, limy + ext * 0.3);
    b.y = S.side * ay; b.x = rand(-0.7, 0.7) * lim;
  } else {
    let ax = ext * 1.08 + rand(0.08, 0.45); ax = Math.min(ax, lim + ext * 0.3);
    b.x = S.side * ax; b.y = rand(-0.85, 0.85) * limy;
  }
}

function spawnMajor(S, w, h) {
  const kind = wpick(MAJOR, S.recent);
  S.recent.push(kind); if (S.recent.length > 3) S.recent.shift();
  S.bodies.push(makeBody(S, kind === 'ringed' ? 'ringed' : kind, 1, w, h));
}

/* =====================================================================
   STATE
   ===================================================================== */

function makeStars(w, h) {
  const m = Math.min(w, h), n = clamp(Math.round((w * h) / 4200), 220, 700), out = [];
  for (let i = 0; i < n; i++) {
    const s = { x: 0, y: 0, z: 1, ci: (Math.random() * 3) | 0, tw: rand(0.4, 1.6), ph: rand(0, 10), a: 0.25 + Math.random() * 0.65, sz: 0.6 + Math.random() * 0.9, big: Math.random() < 0.035 };
    if (s.big) { s.sz += 0.9; s.a = 0.9; }
    const z = rand(0.2, 1), sx = Math.random() * w, sy = Math.random() * h;
    s.z = z; s.x = ((sx - w / 2) / m) * z; s.y = ((sy - h / 2) / m) * z;
    out.push(s);
  }
  return out;
}

function createState(w, h) {
  const S = {
    w, h, clock: 0, last: 0, cache: null, stars: [], bodies: [], ships: [], meteors: [], comets: [], flare: null,
    shade: buildShade(), rims: {}, stock: {}, rocks: [], recent: [], side: 1,
    cx: w / 2, cy: h / 2, sunX: -w * 0.5, sunY: h * 0.12,
    boost: 1, boostTarget: 1, boostT: rand(60, 100), boostHold: 0, focus: null,
    tShip: rand(5, 9), tMinor: rand(6, 10), tMajor: rand(14, 22), tMeteor: rand(4, 9), tComet: rand(40, 80), tFlare: rand(25, 50),
  };
  for (let i = 0; i < 8; i++) S.rocks.push(buildRock(i * 101 + 7));
  S.stars = makeStars(w, h);
  for (const z of [0.86, 0.6, 0.4]) {
    const kind = wpick(MAJOR, S.recent);
    S.recent.push(kind); if (S.recent.length > 3) S.recent.shift();
    S.bodies.push(makeBody(S, kind, z, w, h));
  }
  S.bodies.push(makeBody(S, 'galaxy', 0.95, w, h));
  S.bodies.push(makeBody(S, 'nebula', 0.8, w, h));
  return S;
}

let FALLBACK = null;
function getState(state, w, h) {
  if (!state || typeof state !== 'object') return FALLBACK || (FALLBACK = createState(w, h));
  return state.__cf || (state.__cf = createState(w, h));
}

function ensureCache(S, w, h, dpr) {
  const k = S.cache;
  if (k && k.w === w && k.h === h && k.dpr === dpr) return;
  S.cache = { w, h, dpr, bg: buildBG(w, h), frame: CFG.frame ? buildFrame(w, h, dpr) : null };
  if (S.w !== w || S.h !== h) { S.stars = makeStars(w, h); S.w = w; S.h = h; }
}

/* =====================================================================
   UPDATE
   ===================================================================== */

function update(S, ds, w, h, m) {
  S.w = w; S.h = h;
  // cruise surge
  if (CFG.surges) {
    S.boostT -= ds;
    if (S.boostT <= 0) { S.boostTarget = 4.2; S.boostHold = 3.2; S.boostT = rand(80, 140); }
    if (S.boostHold > 0) { S.boostHold -= ds; if (S.boostHold <= 0) S.boostTarget = 1; }
  }
  S.boost += (S.boostTarget - S.boost) * Math.min(1, ds * 1.6);
  const v = CFG.speed * S.boost * ds;

  for (let i = S.bodies.length - 1; i >= 0; i--) {
    const b = S.bodies[i];
    b.z -= v;
    b.rot += ds * (b.spec ? b.spec.rs : 0.004);
    if (b.moons) for (const mo of b.moons) { mo.a += ds * mo.sp * TAU * 0.4; mo.rot += ds * mo.spec.rs; }
    let dead = b.z < b.fz0 * 0.55 + 0.02;
    if (!dead && !b.noCull && b.z < 0.75 && b.pr > 0) {
      const e = b.pr * b.ext + 30;
      if (b.px + e < 0 || b.px - e > w || b.py + e < 0 || b.py - e > h) dead = true;
    }
    if (dead) S.bodies.splice(i, 1);
  }

  S.tMajor -= ds / Math.max(1, S.boost * 0.6);
  if (S.tMajor <= 0) { S.tMajor = rand(14, 24); spawnMajor(S, w, h); }
  S.tMinor -= ds;
  if (S.tMinor <= 0) { S.tMinor = rand(8, 16); S.bodies.push(makeBody(S, wpick(MINOR, null), 1, w, h)); }

  if (CFG.ships) {
    S.tShip -= ds;
    if (S.tShip <= 0 && S.ships.length < 2) { S.tShip = rand(14, 30); spawnShip(S, w, h, m); }
    for (let i = S.ships.length - 1; i >= 0; i--) {
      const s = S.ships[i];
      s.x += s.vx * ds;
      if ((s.dir > 0 && s.x > w + s.half + 20) || (s.dir < 0 && s.x < -s.half - 20)) S.ships.splice(i, 1);
    }
  }

  S.tMeteor -= ds;
  if (S.tMeteor <= 0) {
    S.tMeteor = rand(6, 14);
    const dir = Math.random() < 0.5 ? 1 : -1, sp = rand(700, 1100), an = rand(0.35, 0.7);
    S.meteors.push({ x: Math.random() * w, y: Math.random() * h * 0.5, vx: Math.cos(an) * sp * dir, vy: Math.sin(an) * sp, age: 0, ttl: rand(0.5, 0.9), len: rand(70, 150), wd: rand(1, 2) });
  }
  for (let i = S.meteors.length - 1; i >= 0; i--) {
    const k = S.meteors[i];
    k.age += ds; k.x += k.vx * ds; k.y += k.vy * ds;
    if (k.age > k.ttl) S.meteors.splice(i, 1);
  }

  S.tComet -= ds;
  if (S.tComet <= 0 && !S.comets.length) {
    S.tComet = rand(70, 140);
    const dir = Math.random() < 0.5 ? 1 : -1, T = rand(45, 70);
    S.comets.push({ x: dir > 0 ? -80 : w + 80, y: h * rand(0.08, 0.4), vx: (dir * (w + 160)) / T, vy: rand(-0.02, 0.06) * w / T, sc: rand(0.8, 1.3), dir });
  }
  for (let i = S.comets.length - 1; i >= 0; i--) {
    const k = S.comets[i];
    k.x += k.vx * ds; k.y += k.vy * ds;
    if ((k.dir > 0 && k.x > w + 120) || (k.dir < 0 && k.x < -120)) S.comets.splice(i, 1);
  }

  S.tFlare -= ds;
  if (S.tFlare <= 0 && !S.flare) {
    S.tFlare = rand(35, 70);
    const st = S.stars[(Math.random() * S.stars.length) | 0];
    const k = 1 / st.z;
    S.flare = { x: S.cx + st.x * m * k, y: S.cy + st.y * m * k, age: 0, dur: 4.2 };
  }
  if (S.flare) { S.flare.age += ds; if (S.flare.age > S.flare.dur) S.flare = null; }
}

/* =====================================================================
   DRAW HELPERS
   ===================================================================== */

const STAR_COLS = ['#e8f2ff', '#cfe0ff', '#fff1dc'];

function drawStars(c, S, t, ds, w, h, m) {
  const sp = CFG.speed * S.boost * 0.5 * ds, streak = S.boost > 1.3;
  for (const s of S.stars) {
    s.z -= sp;
    let k = 1 / s.z, x = S.cx + s.x * m * k, y = S.cy + s.y * m * k;
    if (s.z < 0.16 || x < -30 || x > w + 30 || y < -30 || y > h + 30) {
      const sx = Math.random() * w, sy = Math.random() * h;
      s.z = 1; s.x = (sx - w / 2) / m; s.y = (sy - h / 2) / m;
      k = 1; x = S.cx + s.x * m; y = S.cy + s.y * m;
    }
    const near = smooth(1, 0.9, s.z);
    const al = s.a * (0.75 + 0.25 * Math.sin(t * s.tw + s.ph)) * near;
    const size = s.sz * (1 + (k - 1) * 0.3);
    c.globalAlpha = al;
    c.fillStyle = STAR_COLS[s.ci];
    if (streak) {
      const k2 = 1 / (s.z * (1 + 0.03 * (S.boost - 1)));
      c.strokeStyle = STAR_COLS[s.ci]; c.lineWidth = size * 0.8;
      c.beginPath(); c.moveTo(S.cx + s.x * m * k2, S.cy + s.y * m * k2); c.lineTo(x, y); c.stroke();
    } else if (size > 1.5) {
      c.beginPath(); c.arc(x, y, size * 0.7, 0, TAU); c.fill();
    } else {
      c.fillRect(x - size / 2, y - size / 2, size, size);
    }
    if (s.big) {
      c.globalAlpha = 1;
      glow(c, x, y, size * 9, '190,220,255', 0.28 * al);
      c.globalAlpha = al * 0.5;
      c.fillRect(x - size * 4, y - 0.4, size * 8, 0.8);
      c.fillRect(x - 0.4, y - size * 4, 0.8, size * 8);
    }
  }
  c.globalAlpha = 1;
}

function drawMeteors(c, S) {
  for (const k of S.meteors) {
    const sp = Math.hypot(k.vx, k.vy), ux = k.vx / sp, uy = k.vy / sp;
    const a = Math.sin((Math.PI * k.age) / k.ttl);
    const g = c.createLinearGradient(k.x, k.y, k.x - ux * k.len, k.y - uy * k.len);
    g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); g.addColorStop(0.3, `rgba(130,200,255,${0.5 * a})`); g.addColorStop(1, 'rgba(80,150,255,0)');
    c.strokeStyle = g; c.lineWidth = k.wd; c.lineCap = 'round';
    c.beginPath(); c.moveTo(k.x, k.y); c.lineTo(k.x - ux * k.len, k.y - uy * k.len); c.stroke();
  }
}

function drawComet(c, S, k, m) {
  const ang = Math.atan2(k.y - S.sunY, k.x - S.sunX), L = m * 0.42 * k.sc, sc = k.sc;
  c.save();
  c.translate(k.x, k.y); c.rotate(ang);
  c.globalCompositeOperation = 'lighter';
  let g = c.createLinearGradient(0, 0, L, 0);
  g.addColorStop(0, 'rgba(140,200,255,.55)'); g.addColorStop(1, 'rgba(90,140,255,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(0, -3 * sc); c.lineTo(L, -L * 0.02); c.lineTo(L, L * 0.02); c.lineTo(0, 3 * sc); c.closePath(); c.fill();
  g = c.createLinearGradient(0, 0, L * 0.8, 0);
  g.addColorStop(0, 'rgba(255,225,170,.3)'); g.addColorStop(1, 'rgba(255,200,140,0)');
  c.strokeStyle = g; c.lineCap = 'round';
  for (const wd of [16, 9, 4]) { c.lineWidth = wd * sc; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * 0.4, 0, L * 0.8, L * 0.2); c.stroke(); }
  c.restore();
  glow(c, k.x, k.y, 22 * sc, '200,230,255', 0.9);
  c.fillStyle = '#fff'; c.beginPath(); c.arc(k.x, k.y, 2.2 * sc, 0, TAU); c.fill();
}

function drawFlare(c, f) {
  const e = Math.pow(Math.sin((Math.PI * f.age) / f.dur), 2);
  glow(c, f.x, f.y, 70 * e + 8, '190,220,255', 0.55 * e);
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const [ang, len] of [[0, 90], [Math.PI / 2, 90], [Math.PI / 4, 40], [-Math.PI / 4, 40]]) {
    c.save(); c.translate(f.x, f.y); c.rotate(ang);
    const g = c.createLinearGradient(-len * e, 0, len * e, 0);
    g.addColorStop(0, 'rgba(200,225,255,0)'); g.addColorStop(0.5, `rgba(235,245,255,${0.7 * e})`); g.addColorStop(1, 'rgba(200,225,255,0)');
    c.fillStyle = g; c.fillRect(-len * e, -0.7, len * 2 * e, 1.4);
    c.restore();
  }
  c.restore();
}

function drawBody(c, S, b, x, y, r, a, t, w, h, m) {
  switch (b.kind) {
    case 'earth': case 'gas': case 'ringed': case 'ice': case 'lava': case 'mars': case 'moon': drawWorld(c, S, b, x, y, r, a); break;
    case 'station': drawStation(c, b, x, y, r, a, t); break;
    case 'sun': drawSun(c, S, b, x, y, r, a, t, w, h, m); break;
    case 'field': drawField(c, S, b, a, t, m); break;
    case 'blackhole': drawBlackHole(c, b, x, y, r, a, t); break;
    case 'pulsar': drawPulsar(c, b, x, y, r, a, t); break;
    case 'probe': drawProbe(c, b, x, y, r, a, t); break;
    case 'monolith': drawMonolith(c, b, x, y, r, a, t); break;
    case 'galaxy': drawGalaxy(c, b, x, y, r, a, t); break;
    case 'nebula': drawNebulaBody(c, b, x, y, r, a, t); break;
  }
}

/* ---- HUD ---- */

function drawBrackets(c, S, b, F, m) {
  const al = b.la; if (al < 0.02) return;
  const minHalf = b.kind === 'sun' || b.kind === 'pulsar' || b.kind === 'blackhole' || b.kind === 'monolith' ? 30 : 0;
  let hw = Math.max(minHalf, b.pr * Math.max(1.2, Math.min(b.ext, 2.4) * 0.92)), hh = Math.max(minHalf, b.pr * 1.2);
  hw = Math.min(hw, F.ww * 0.45); hh = Math.min(hh, F.wh * 0.45);
  const pad = 12;
  const x0 = clamp(b.px - hw, F.wx + pad, F.wx + F.ww - pad - 20), x1 = clamp(b.px + hw, F.wx + pad + 20, F.wx + F.ww - pad);
  const y0 = clamp(b.py - hh, F.wy + pad + 14, F.wy + F.wh - pad - 20), y1 = clamp(b.py + hh, F.wy + pad + 34, F.wy + F.wh - pad);
  const L = Math.min(22, (x1 - x0) * 0.3, (y1 - y0) * 0.3);
  c.save();
  c.globalAlpha = al * 0.7;
  c.strokeStyle = 'rgb(130,225,255)'; c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(x0, y0 + L); c.lineTo(x0, y0); c.lineTo(x0 + L, y0);
  c.moveTo(x1 - L, y0); c.lineTo(x1, y0); c.lineTo(x1, y0 + L);
  c.moveTo(x0, y1 - L); c.lineTo(x0, y1); c.lineTo(x0 + L, y1);
  c.moveTo(x1 - L, y1); c.lineTo(x1, y1); c.lineTo(x1, y1 - L);
  c.stroke();
  const fs = clamp(m * 0.0115, 9, 11.5);
  c.font = `${fs}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  c.textBaseline = 'alphabetic'; c.fillStyle = 'rgb(150,232,255)';
  c.fillText(String(b.name).toUpperCase(), x0, y0 - 6);
  c.globalAlpha = al * 0.5;
  const unit = b.kind === 'galaxy' ? 'MLY' : 'AU', rng2 = b.kind === 'galaxy' ? (b.z * 2.4).toFixed(1) : Math.max(0, (b.z - 0.05) * 48).toFixed(1);
  c.fillText(`${b.type}  -  RNG ${rng2} ${unit}`, x0, y1 + fs + 5);
  c.restore();
}

function drawConsoleText(c, S, F, T, w) {
  const d = F.disp, fs = clamp(F.bot * 0.2, 9, 12.5);
  c.save();
  c.beginPath(); c.rect(d.x + 4, d.y, d.w - 8, d.h); c.clip();
  c.font = `${fs}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const hdg = ((214.7 + T * 0.12) % 360).toFixed(1).padStart(5, '0');
  const vel = (0.42 * S.boost).toFixed(2);
  const f = S.focus;
  const parts = [`HDG ${hdg}`, `VEL ${vel}c`];
  if (f && d.w > 320) parts.push(`TRK ${String(f.name).toUpperCase()}`);
  else if (d.w > 320) parts.push('TRK ---');
  c.fillStyle = 'rgba(130,225,255,.78)';
  c.shadowColor = 'rgba(80,200,255,.8)'; c.shadowBlur = 6;
  c.fillText(parts.join('   |   '), d.x + d.w / 2, d.y + d.h / 2 + 0.5);
  c.restore();
}

/* =====================================================================
   MAIN
   ===================================================================== */

export default {
  init() {
    return {};
  },

  draw(c, state, t, dt, mood, w, h) {
    const S = getState(state, w, h);
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let ds = S.last ? (now - S.last) / 1000 : 0.016;
    S.last = now;
    ds = clamp(ds, 0, 0.1);
    S.clock += ds;
    const T = S.clock;
    const dpr = clamp((c.getTransform ? c.getTransform().a : 1) || 1, 1, 2);
    ensureCache(S, w, h, dpr);
    warm(S);
    const m = Math.min(w, h);

    // gentle ship sway (shared by everything so parallax stays coherent)
    S.cx = w / 2 + Math.sin(T * 0.11) * m * 0.006 + Math.sin(T * 0.37) * m * 0.002;
    S.cy = h / 2 + Math.cos(T * 0.09) * m * 0.005;
    const roll = Math.sin(T * 0.05) * 0.006;

    update(S, ds, w, h, m);

    // light direction eases toward the nearest real star (or a distant default one)
    let tx = -w * 0.5, ty = h * 0.12;
    for (const b of S.bodies) if (b.kind === 'sun' && b.z > 0.3) { tx = b.px; ty = b.py; }
    S.sunX = lerp(S.sunX, tx, Math.min(1, ds * 0.8));
    S.sunY = lerp(S.sunY, ty, Math.min(1, ds * 0.8));

    c.save();
    c.fillStyle = '#02030a';
    c.fillRect(0, 0, w, h);

    // ----- scene (rolls slightly inside the window) -----
    c.save();
    c.translate(w / 2, h / 2); c.rotate(roll); c.scale(1.03, 1.03); c.translate(-w / 2, -h / 2);

    const bg = S.cache.bg, BW = w * 1.14, BH = h * 1.14;
    c.drawImage(bg, -(BW - w) / 2 + Math.sin(T * 0.02) * w * 0.012 + (S.cx - w / 2) * 0.4, -(BH - h) / 2 + Math.cos(T * 0.017) * h * 0.01 + (S.cy - h / 2) * 0.4, BW, BH);

    drawStars(c, S, T, ds, w, h, m);
    if (S.flare) drawFlare(c, S.flare);
    for (const k of S.comets) drawComet(c, S, k, m);

    for (const s of S.ships) if (s.layer === 'back') drawShipObj(c, s, T);

    S.bodies.sort((p, q) => q.z - p.z);
    let focus = null, best = 0;
    const F = S.cache.frame;
    for (const b of S.bodies) {
      const k = 1 / b.z;
      const x = S.cx + b.x * m * k, y = S.cy + b.y * m * k, r = b.size * m * k;
      b.px = x; b.py = y; b.pr = r;
      const a = smooth(1, 0.9, b.z) * smooth(b.fz0, b.fz1, b.z);
      if (a <= 0.003) continue;
      const e = r * b.ext + (b.kind === 'sun' ? r * 14 : 0);
      if (!b.noCull && (x + e < -40 || x - e > w + 40 || y + e < -40 || y - e > h + 40)) continue;
      drawBody(c, S, b, x, y, r, a, T, w, h, m);
      if (b.label && a > 0.25 && r > m * 0.045 && r < m * 0.75 && x > 0 && x < w && y > 0 && y < h) {
        const sc = r * (b.kind === 'galaxy' ? 0.6 : 1);
        if (sc > best) { best = sc; focus = b; }
      }
    }
    c.globalAlpha = 1;

    for (const s of S.ships) if (s.layer === 'front') drawShipObj(c, s, T);
    drawMeteors(c, S);

    // cruise-surge glow
    if (S.boost > 1.05) {
      const k = clamp((S.boost - 1) / 3.2, 0, 1);
      const g = c.createRadialGradient(w / 2, h / 2, m * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(120,170,255,0)'); g.addColorStop(1, `rgba(120,170,255,${0.13 * k})`);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }

    // tracking brackets ride along with the scene
    S.focus = focus;
    if (CFG.hud && F) {
      for (const b of S.bodies) {
        b.la += ((b === focus ? 1 : 0) - b.la) * Math.min(1, ds * 2.5);
        if (b.la > 0.02) drawBrackets(c, S, b, F, m);
      }
    }
    c.restore();

    // soft vignette so text always has calm edges to sit against
    const vg = c.createRadialGradient(w / 2, h / 2, m * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);

    // ----- ship interior -----
    if (F) {
      c.drawImage(F.canvas, 0, 0, w, h);
      for (const l of F.leds) {
        const on = Math.sin(T * l.rate + l.ph) > 0.2;
        glow(c, l.x, l.y, l.rad * 4, l.col, on ? 0.55 : 0.1);
        c.fillStyle = `rgba(${l.col},${on ? 0.95 : 0.25})`;
        c.beginPath(); c.arc(l.x, l.y, l.rad, 0, TAU); c.fill();
      }
      if (CFG.hud) drawConsoleText(c, S, F, T, w);
    }
    c.restore();
  },
};
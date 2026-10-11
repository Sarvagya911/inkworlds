/*
 * ═══════════════════════════════════════════════════════════════════════════
 *  LUNARETH — "The Frontier"
 *  A living isekai world, painted in the spirit of Grimgar: Ashes and Illusions.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Drop-in scene module:  export default { init(w,h), draw(ctx,state,t,dt,mood,w,h) }
 *
 *  THE JOURNEY (one loop ≈ 5 minutes, all of it driven by `t` in seconds)
 *
 *    0  Kingdom outskirts   early morning   farms, windmill, the city on its hill
 *    1  The gate            morning         guards, queue of carts, warm street beyond
 *    2  Market streets      midday          one-point-perspective street, stalls, laundry
 *    3  Tavern district     rainy dusk      lit windows, wet cobbles, swinging sign
 *    4  Adventurer's guild  night           torches, quest board, horses, moon
 *    5  Forest road         late night      fireflies, moonbeams, deer, ruins ahead
 *    6  River & ruins       dawn            arched bridge, mist, reflections, herons
 *
 *  HOW IT ACHIEVES THE LOOK
 *   • Every location is built from parallax layers painted ONCE into off-screen
 *     bitmaps (washes, mottled pigment, soft ridges), never redrawn per frame.
 *   • A real camera: slow dolly (near layers move more than far ones) + drift,
 *     and each transition pushes *through* the scene into the next one.
 *   • One continuous time-of-day: sky, haze and a multiply "colour grade" are
 *     interpolated across the whole journey; windows/lamps are emissive and
 *     only light up as the world darkens.
 *   • Weather is global: clear → overcast → rain at dusk → forest drizzle → mist.
 *   • Low saturation, big skies, quiet movement, and rare small events
 *     (a patron leaving the tavern, a deer crossing, a lone lantern on the road,
 *     a shooting star, a fish jumping).
 */

/* ───────────────────────────── tunables ───────────────────────────── */
const CFG = {
  SCENE_SECONDS: 44,   // time spent in each location (loop = 7 × this)
  TRANSITION: 0.17,    // fraction of a scene used for the push-through
  LAYER_SCALE: 0.62,   // resolution of painted bitmaps (lower = softer / lighter)
  TEXT_VEIL: 0.13,     // soft haze behind the lower page so text stays calm
  GRAIN: 0.16          // paper grain strength
};
const N_SCENES = 7;
const CYCLE = CFG.SCENE_SECONDS * N_SCENES;

/* ───────────────────────────── maths ───────────────────────────── */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const smoother = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const hash1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const vnoise = x => { const i = Math.floor(x), f = x - i; return lerp(hash1(i), hash1(i + 1), smooth(f)); };
const bump = (x, c, w) => { const d = Math.abs(((x - c + 0.5) % 1 + 1) % 1 - 0.5) / w; return d >= 1 ? 0 : smooth(1 - d); };
/* event helper: returns 0..1 progress while an event is active, otherwise -1 */
const evt = (t, period, dur, off = 0) => { const m = (((t - off) % period) + period) % period; return m < dur ? m / dur : -1; };

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────────────────────────── colour ───────────────────────────── */
const _hex = {};
function rgb(h) {
  if (Array.isArray(h)) return h;
  if (h.charCodeAt(0) !== 35) { const m = h.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]]; }
  let c = _hex[h];
  if (!c) { const n = parseInt(h.slice(1), 16); c = _hex[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  return c;
}
const mix = (a, b, t) => { a = rgb(a); b = rgb(b); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
const css = (c, a = 1) => typeof c === 'string' ? c : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hx = (h, a = 1) => css(rgb(h), a);
/* painterly shading: lights drift warm, shadows drift cool */
const tone = (col, t, a = 1) => css(t >= 0 ? mix(col, '#fff1d4', t) : mix(col, '#1f2740', -t), a);
const desat = (col, amt) => { const c = rgb(col), l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return mix(c, [l, l, l], amt); };

/* ───────────────────────────── canvases ───────────────────────────── */
function makeCanvas(w, h) {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/* ───────────────────────────── sprites (built once) ───────────────────────────── */
function makeCloudSprite(seed, wd, ht) {
  const cv = makeCanvas(wd, ht), c = cv.getContext('2d'), r = mulberry(seed);
  const pf = [], n = 20;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), b = Math.sin(t * Math.PI);
    const rad = ht * (0.14 + 0.24 * b) * (0.7 + r() * 0.6);
    pf.push({ x: wd * (0.1 + 0.8 * t), y: ht * 0.72 - rad * (0.3 + r() * 0.5) - b * ht * 0.2, r: rad });
  }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  pf.forEach(p => { x0 = Math.min(x0, p.x - p.r); x1 = Math.max(x1, p.x + p.r); y0 = Math.min(y0, p.y - p.r); y1 = Math.max(y1, p.y + p.r * 0.3); });
  const m = 14, sc = Math.min((wd - 2 * m) / (x1 - x0), (ht * 0.84 - m) / (y1 - y0));
  c.setTransform(sc, 0, 0, sc, m - x0 * sc + (wd - 2 * m - (x1 - x0) * sc) / 2, m - y0 * sc);
  if ('filter' in c) c.filter = 'blur(2.5px)';
  c.fillStyle = '#a9b4c2'; pf.forEach(p => { c.beginPath(); c.arc(p.x, p.y + p.r * 0.28, p.r, 0, TAU); c.fill(); });
  c.fillStyle = '#e7e4dd'; pf.forEach(p => { c.beginPath(); c.arc(p.x, p.y, p.r * 0.94, 0, TAU); c.fill(); });
  c.fillStyle = 'rgba(255,250,238,.85)'; pf.forEach(p => { c.beginPath(); c.arc(p.x - p.r * 0.2, p.y - p.r * 0.26, p.r * 0.66, 0, TAU); c.fill(); });
  c.filter = 'none'; c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'destination-out';
  const g = c.createLinearGradient(0, ht * 0.62, 0, ht * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  c.fillStyle = g; c.fillRect(0, ht * 0.62, wd, ht * 0.4);
  return cv;
}
function makeSoftSprite(wd, ht) { // soft ellipse used for mist & smoke
  const cv = makeCanvas(wd, ht), c = cv.getContext('2d');
  c.scale(1, ht / wd);
  const g = c.createRadialGradient(wd / 2, wd / 2, 0, wd / 2, wd / 2, wd / 2);
  g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, wd, wd);
  return cv;
}
function makeGrain() {
  const cv = makeCanvas(256, 256), c = cv.getContext('2d');
  const id = c.createImageData(256, 256), r = mulberry(11);
  for (let i = 0; i < 256 * 256; i++) {
    const v = 128 + (r() - 0.5) * 70 + (r() - 0.5) * 40;
    id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
  }
  c.putImageData(id, 0, 0);
  return cv;
}

/* ───────────────────────────── time of day ─────────────────────────────
 * One key per location, interpolated between scene centres so the sky never pops.
 * grade = multiply tint over the whole frame, night = how dark/emissive the world is.
 */
const KEYS = [
  { top: '#7ca2ba', mid: '#c5d3c6', hor: '#f3ddb8', haze: '#eadcc0', grade: '#fff2e0', night: 0.04, sx: 0.22, sy: 0.55, sc: '#ffdca4', mist: 0.28 },
  { top: '#6e9fbb', mid: '#b9d0d0', hor: '#e8e6d3', haze: '#dfe3d4', grade: '#fffaf0', night: 0.0, sx: 0.30, sy: 0.36, sc: '#fff0c8', mist: 0.10 },
  { top: '#68a0c5', mid: '#abcbd2', hor: '#e4e7da', haze: '#d9e1da', grade: '#fffdf6', night: 0.0, sx: 0.55, sy: 0.16, sc: '#fff6dd', mist: 0.05 },
  { top: '#62788f', mid: '#c4a58f', hor: '#ecb77f', haze: '#d9b392', grade: '#ffd0aa', night: 0.42, sx: 0.84, sy: 0.55, sc: '#ffb072', mist: 0.30 },
  { top: '#30406c', mid: '#4e5e88', hor: '#8e88a8', haze: '#66739a', grade: '#93a5d6', night: 1.0, sx: 0.70, sy: 0.17, sc: '#e9eeff', mist: 0.18 },
  { top: '#24345a', mid: '#3b5073', hor: '#5c7490', haze: '#4f6788', grade: '#8a9fcf', night: 1.0, sx: 0.36, sy: 0.14, sc: '#e9eeff', mist: 0.65 },
  { top: '#6a87a4', mid: '#b9c5c3', hor: '#f4d9b7', haze: '#e9dbc7', grade: '#ffe7d3', night: 0.20, sx: 0.70, sy: 0.50, sc: '#ffd8a0', mist: 0.6 }
];
function paletteAt(p) {
  const u = p * N_SCENES - 0.5, fl = Math.floor(u), f = smooth(u - fl);
  const A = KEYS[((fl % N_SCENES) + N_SCENES) % N_SCENES], B = KEYS[(((fl + 1) % N_SCENES) + N_SCENES) % N_SCENES];
  const P = {};
  for (const k of ['top', 'mid', 'hor', 'haze', 'grade', 'sc']) P[k] = mix(A[k], B[k], f);
  for (const k of ['night', 'sx', 'sy', 'mist']) P[k] = lerp(A[k], B[k], f);
  return P;
}

/* ═════════════════════════ painting primitives ═════════════════════════
 * Everything below paints into a layer bitmap using "layer-logical" coordinates:
 *   S.X(u) / S.Y(v)  map unit coords to pixels,   S.k = size scale (≈ h/1080)
 */
const PAL = {
  cloaks: ['#5b4a42', '#4a5560', '#6b5a46', '#4f6054', '#7a5a4f', '#55506a', '#8a7a62', '#3f4a56', '#6a4f52', '#7d6a55'],
  plaster: ['#c4b498', '#bba98c', '#cbbd9f', '#b5a48a', '#aa9c86', '#c8b99c', '#b8ab94'],
  roofs: ['#7c5649', '#6e5b56', '#5e5661', '#86614d', '#505659', '#704f46'],
  awn: ['#a3584c', '#c4a35e', '#5f8077', '#8a6a9a', '#b9714c', '#6f8a9c']
};
const pick = (rnd, a) => a[(rnd() * a.length) | 0];

function mottle(c, S, rnd, n, light = '#fff0cc', dark = '#26304c') {
  c.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < n; i++) {
    const x = rnd() * S.W, y = rnd() * S.H, r = (5 + rnd() * 20) * S.k;
    c.fillStyle = rnd() < 0.5 ? hx(light, 0.015 + rnd() * 0.025) : hx(dark, 0.015 + rnd() * 0.03);
    c.beginPath(); c.ellipse(x, y, r, r * (0.35 + rnd() * 0.6), rnd() * 3.14, 0, TAU); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
}

function brush(c, S, rnd, n) {
  c.globalCompositeOperation = 'source-atop'; c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rnd() * S.W, y = rnd() * S.H, len = (16 + rnd() * 60) * S.k, ang = (rnd() - 0.5) * 0.5;
    c.strokeStyle = rnd() < 0.5 ? `rgba(255,244,214,${0.03 + rnd() * 0.04})` : `rgba(30,40,70,${0.03 + rnd() * 0.04})`;
    c.lineWidth = (1.2 + rnd() * 3) * S.k;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
  }
  c.globalCompositeOperation = 'source-over';
}

function vgrad(c, y0, y1, a, b) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a); g.addColorStop(1, b); return g;
}

/* ridge / mountain silhouette with painted light, snow, gullies */
function ridge(c, S, rnd, o) {
  const step = o.step || 8, so = rnd() * 500, pts = [];
  for (let x = -step; x <= S.W + step; x += step) {
    const u = x / S.W; let n = 0, a = 1, f = o.freq || 2.4, s = 0;
    for (let q = 0; q < 5; q++) {
      let v = vnoise(u * f + so + q * 13.7);
      if (o.sharp) v = 1 - Math.abs(2 * v - 1);
      n += a * v; s += a; a *= o.rough || 0.5; f *= 2.07;
    }
    n /= s;
    let y = S.Y(o.base) - (n - 0.5) * 2 * o.amp * S.h;
    if (o.bump) { const d = (u - o.bump[0]) / o.bump[2]; y -= Math.exp(-Math.pow(Math.abs(d), o.bump[3] || 2)) * o.bump[1] * S.h; }
    pts.push([x, y]);
  }
  let minY = 1e9; for (const p of pts) if (p[1] < minY) minY = p[1];
  c.beginPath(); c.moveTo(pts[0][0], S.H + 6);
  for (const p of pts) c.lineTo(p[0], p[1]);
  c.lineTo(pts[pts.length - 1][0], S.H + 6); c.closePath();
  c.fillStyle = vgrad(c, minY, S.Y(o.base) + o.amp * S.h * 1.1, o.col, o.colBot || o.col);
  c.fill();
  c.save(); c.clip();
  if (o.snow) {
    c.fillStyle = vgrad(c, minY, minY + S.h * o.snow, 'rgba(252,247,238,.8)', 'rgba(252,247,238,0)');
    c.fillRect(0, minY, S.W, S.h * o.snow + 2);
  }
  const fc = o.facets || 0;
  for (let i = 0; i < fc; i++) {
    const p = pts[(rnd() * pts.length) | 0], w = (14 + rnd() * 40) * S.k, l = (40 + rnd() * 110) * S.k;
    c.fillStyle = 'rgba(28,40,66,.06)';
    c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + w * 0.7, p[1] + l); c.lineTo(p[0] - w * 0.3, p[1] + l * 0.92); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,246,226,.05)';
    c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] - w * 0.9, p[1] + l * 0.9); c.lineTo(p[0] - w * 0.2, p[1] + l); c.closePath(); c.fill();
  }
  c.restore();
  c.strokeStyle = tone(o.col, 0.4, 0.45); c.lineWidth = 1.3 * S.k;
  c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
  return pts;
}

function conifer(c, x, y, h, col, rnd, hl = true) {
  const n = h > 70 ? 6 : h > 34 ? 5 : 4, d = h / n;
  const side = sg => {
    const a = [[x, y - h]];
    for (let j = 0; j < n; j++) {
      const t = (j + 1) / n, yy = y - h + h * t * 0.97, ww = h * 0.27 * (0.3 + 0.7 * t) * (0.88 + rnd() * 0.24);
      a.push([x + sg * ww, yy + (rnd() - 0.5) * d * 0.15]);
      a.push([x + sg * ww * 0.4, yy - d * 0.3]);
    }
    return a;
  };
  const L = side(-1), R = side(1);
  c.fillStyle = col;
  c.beginPath(); c.moveTo(x, y - h);
  for (let i = 1; i < L.length; i++) c.lineTo(L[i][0], L[i][1]);
  c.lineTo(x, y + h * 0.02);
  for (let i = R.length - 1; i >= 1; i--) c.lineTo(R[i][0], R[i][1]);
  c.closePath(); c.fill();
  if (hl && h > 26) {
    c.fillStyle = tone(col, 0.2, 0.5);
    c.beginPath(); L.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.lineTo(x, y); c.closePath(); c.fill();
    c.fillStyle = 'rgba(18,28,48,.2)';
    c.beginPath(); R.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.lineTo(x, y); c.closePath(); c.fill();
  }
}

function broadleaf(c, x, y, r, col, rnd) {
  const th = r * 0.3;
  c.fillStyle = tone('#5c4838', -0.1);
  c.beginPath(); c.moveTo(x - th * 0.7, y); c.lineTo(x - th * 0.25, y - r * 1.2); c.lineTo(x + th * 0.25, y - r * 1.2); c.lineTo(x + th * 0.7, y); c.closePath(); c.fill();
  const cy = y - r * 1.55, bl = [];
  for (let i = 0; i < 12; i++) {
    const a = rnd() * TAU, d = r * 0.66 * Math.sqrt(rnd());
    bl.push([x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r * (0.36 + rnd() * 0.3)]);
  }
  bl.forEach(b => { c.fillStyle = tone(col, -0.3); c.beginPath(); c.arc(b[0] + r * 0.1, b[1] + r * 0.14, b[2], 0, TAU); c.fill(); });
  bl.forEach(b => { c.fillStyle = tone(col, 0); c.beginPath(); c.arc(b[0], b[1], b[2] * 0.92, 0, TAU); c.fill(); });
  bl.forEach(b => { c.fillStyle = tone(col, 0.24, 0.75); c.beginPath(); c.arc(b[0] - r * 0.15, b[1] - r * 0.2, b[2] * 0.62, 0, TAU); c.fill(); });
  for (let i = 0; i < 16; i++) {
    const b = bl[(rnd() * bl.length) | 0];
    c.fillStyle = tone(col, 0.4, 0.5); c.beginPath(); c.arc(b[0] - r * 0.2 + rnd() * r * 0.3, b[1] - r * 0.3 + rnd() * r * 0.2, r * 0.07 + rnd() * r * 0.06, 0, TAU); c.fill();
  }
}

function treeLine(c, S, rnd, pts, o) {
  const k = S.k;
  for (let i = 0; i < pts.length; i++) {
    if (rnd() > (o.dens || 0.6)) continue;
    const p = pts[i], s = (o.size || 50) * k * (0.6 + rnd() * 0.8), col = pick(rnd, o.cols);
    const yy = p[1] + (o.dy || 0) * k + rnd() * 6 * k;
    if (rnd() < (o.broad || 0)) broadleaf(c, p[0], yy, s * 0.5, col, rnd); else conifer(c, p[0], yy, s, col, rnd, o.hl !== false);
  }
}

function crenels(c, x0, x1, y, cw, ch, col) {
  c.fillStyle = col;
  for (let x = x0; x < x1 - cw; x += cw * 2) c.fillRect(x, y - ch, cw, ch + 1);
}

/* running-bond stone with per-block tonal variation */
function blocks(c, rnd, x, y, w, h, col, bw, bh, a = 0.55) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  let row = 0;
  for (let yy = y; yy < y + h; yy += bh, row++) {
    const off = (row % 2) * bw * 0.5;
    for (let xx = x - off; xx < x + w; xx += bw) {
      c.fillStyle = tone(col, (rnd() - 0.5) * 0.22, a);
      c.fillRect(xx + 0.7, yy + 0.7, bw - 1.4, bh - 1.4);
    }
  }
  c.restore();
}

function pane(c, rnd, x, y, w, h, frame, o = {}) {
  c.fillStyle = hx(frame, 0.95); c.fillRect(x - w * 0.1, y - h * 0.08, w * 1.2, h * 1.16);
  c.fillStyle = vgrad(c, y, y + h, '#3d4a5e', '#27303f'); c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(190,210,230,.16)';
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.6, y); c.lineTo(x, y + h * 0.7); c.closePath(); c.fill();
  c.strokeStyle = hx(frame, 0.9); c.lineWidth = Math.max(1, w * 0.07);
  c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h / 2); c.lineTo(x + w, y + h / 2); c.stroke();
  if (o.shutter) {
    c.fillStyle = hx(o.shutter, 0.95);
    c.fillRect(x - w * 0.46, y - h * 0.04, w * 0.4, h * 1.08);
    c.fillRect(x + w * 1.06, y - h * 0.04, w * 0.4, h * 1.08);
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const yy = y + h * i / 5;
      c.beginPath(); c.moveTo(x - w * 0.46, yy); c.lineTo(x - w * 0.06, yy); c.moveTo(x + w * 1.06, yy); c.lineTo(x + w * 1.46, yy); c.stroke();
    }
  }
}

/* gable-front timber house.  Records emissive windows into S.lights, chimneys into S.out.smoke */
function facade(c, S, rnd, cx, g, w, h, o = {}) {
  const k = S.k, x = cx - w / 2;
  const wall = o.wall || pick(rnd, PAL.plaster), beam = o.beam || '#4a3b33', roof = o.roof || pick(rnd, PAL.roofs), stone = o.stone || '#8e887d';
  const floors = o.floors || 2, rh = o.roofH || w * 0.58, ov = o.ov !== undefined ? o.ov : w * 0.07;
  const bh = o.base !== undefined ? o.base : h * 0.2, fh = (h - bh) / floors;
  c.fillStyle = vgrad(c, g - h, g, tone(wall, 0.1), tone(wall, -0.16)); c.fillRect(x, g - h, w, h);
  c.fillStyle = 'rgba(28,34,64,.11)'; c.fillRect(x + w * 0.8, g - h, w * 0.2, h);
  if (bh > 0) {
    c.fillStyle = tone(stone, 0); c.fillRect(x, g - bh, w, bh);
    blocks(c, rnd, x, g - bh, w, bh, stone, Math.max(8 * k, w * 0.09), Math.max(6 * k, bh * 0.25), 0.6);
  }
  const lw = Math.max(1.2, w * 0.017);
  c.strokeStyle = hx(beam, 0.92); c.lineWidth = lw;
  for (let f = 0; f <= floors; f++) { const y = g - bh - f * fh; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.stroke(); }
  const nb = Math.max(2, Math.round(w / (fh * 0.95)));
  for (let i = 0; i <= nb; i++) { const xx = x + i * w / nb; c.beginPath(); c.moveTo(xx, g - bh); c.lineTo(xx, g - h); c.stroke(); }
  for (let f = 1; f < floors; f++) for (let i = 0; i < nb; i++) if (rnd() < 0.45) {
    const x0 = x + i * w / nb, x1 = x0 + w / nb, y0 = g - bh - f * fh, y1 = y0 - fh;
    c.beginPath(); if (rnd() < 0.5) { c.moveTo(x0, y0); c.lineTo(x1, y1); } else { c.moveTo(x1, y0); c.lineTo(x0, y1); } c.stroke();
  }
  const doorBay = o.door === false ? -1 : (o.doorBay !== undefined ? o.doorBay : Math.floor(nb / 2));
  const shutters = o.shutter !== undefined ? o.shutter : (rnd() < 0.6 ? pick(rnd, ['#5f7a6e', '#8a5a4e', '#5d6f86', '#7b7a52']) : null);
  const litP = o.litP !== undefined ? o.litP : 0.6;
  for (let f = 0; f < floors; f++) for (let i = 0; i < nb; i++) {
    if (f === 0 && i === doorBay) continue;
    const bx = x + (i + 0.5) * w / nb, ww = w / nb * 0.38, wh = fh * 0.4, wy = g - bh - (f + 0.5) * fh - wh * 0.2;
    if (f === 0 && bh > 0 && wy + wh > g - bh * 0.4) continue;
    pane(c, rnd, bx - ww / 2, wy - wh / 2, ww, wh, beam, { shutter: shutters });
    S.lights.push({ kind: 'win', x: bx - ww / 2, y: wy - wh / 2, w: ww, h: wh, k: (o.lit === false ? 0.04 : rnd() < litP ? 1 : 0.1) * (o.k || 1), ph: rnd(), gy: o.reflect ? g : 0 });
  }
  if (doorBay >= 0) {
    const dx = x + (doorBay + 0.5) * w / nb, dw = Math.min(w / nb * 0.5, fh * 0.46), dh = Math.min(fh * 0.72, g - (g - bh * 0.1) + fh * 0.7);
    c.fillStyle = tone('#4a382c', -0.1);
    c.beginPath(); c.moveTo(dx - dw / 2, g); c.lineTo(dx - dw / 2, g - dh * 0.75); c.quadraticCurveTo(dx, g - dh * 1.15, dx + dw / 2, g - dh * 0.75); c.lineTo(dx + dw / 2, g); c.closePath(); c.fill();
    c.strokeStyle = hx(beam, 0.9); c.lineWidth = lw; c.stroke();
    if (o.doorLight) S.lights.push({ kind: 'door', x: dx - dw / 2, y: g - dh * 0.95, w: dw, h: dh * 0.95, k: 1, ph: rnd(), gy: g });
  }
  const top = g - h;
  c.fillStyle = vgrad(c, top - rh, top, tone(roof, 0.12), tone(roof, -0.12));
  c.beginPath(); c.moveTo(x - ov, top); c.lineTo(cx, top - rh); c.lineTo(x + w + ov, top); c.closePath(); c.fill();
  c.save(); c.clip();
  const rows = Math.max(4, Math.round(rh / (9 * k)));
  for (let r = 1; r < rows; r++) {
    const yy = top - rh + rh * r / rows, hw = (w / 2 + ov) * r / rows;
    c.strokeStyle = 'rgba(25,20,28,.17)'; c.lineWidth = Math.max(1, k * 1.2);
    c.beginPath(); c.moveTo(cx - hw, yy); c.lineTo(cx + hw, yy); c.stroke();
    const tw = Math.max(5 * k, w * 0.05);
    c.strokeStyle = 'rgba(25,20,28,.08)';
    for (let tx = cx - hw + (r % 2) * tw * 0.5; tx < cx + hw; tx += tw) { c.beginPath(); c.moveTo(tx, yy); c.lineTo(tx, yy + rh / rows); c.stroke(); }
  }
  c.fillStyle = 'rgba(255,240,210,.09)'; c.beginPath(); c.moveTo(cx, top - rh); c.lineTo(x - ov, top); c.lineTo(cx, top); c.closePath(); c.fill();
  c.restore();
  c.strokeStyle = tone(roof, -0.35, 0.9); c.lineWidth = Math.max(1.5, w * 0.02);
  c.beginPath(); c.moveTo(x - ov, top); c.lineTo(cx, top - rh); c.lineTo(x + w + ov, top); c.stroke();
  c.fillStyle = vgrad(c, top, top + fh * 0.3, 'rgba(20,18,30,.3)', 'rgba(20,18,30,0)'); c.fillRect(x, top, w, fh * 0.3);
  if (o.chimney !== false && rnd() < 0.85) {
    const chx = cx + (rnd() - 0.5) * w * 0.5, ry = top - rh * (1 - Math.abs(chx - cx) / (w / 2 + ov)), cw = w * 0.085, chh = rh * 0.32;
    c.fillStyle = tone('#7d7066', -0.05); c.fillRect(chx - cw / 2, ry - chh, cw, chh + 3);
    c.fillStyle = tone('#4c443f', 0); c.fillRect(chx - cw * 0.62, ry - chh - cw * 0.3, cw * 1.24, cw * 0.4);
    if (S.out.smoke) S.out.smoke.push({ x: chx, y: ry - chh - cw * 0.3, s: w });
  }
  return { top: top - rh };
}

/* round-ish tower with cylinder shading and conical roof */
function tower(c, S, rnd, x, g, w, h, col, roofCol, rh, o = {}) {
  const gr = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  gr.addColorStop(0, tone(col, 0.16)); gr.addColorStop(0.5, col); gr.addColorStop(1, tone(col, -0.26));
  c.fillStyle = gr; c.fillRect(x - w / 2, g - h, w, h);
  if (o.blocks !== false && w > 14 * S.k) blocks(c, rnd, x - w / 2, g - h, w, h, col, Math.max(8, w * 0.3), Math.max(6, w * 0.2), 0.1);
  if (o.slits) for (let i = 0; i < o.slits; i++) {
    const sy = g - h * (0.22 + 0.55 * i / Math.max(1, o.slits - 1)), sw = Math.max(2, w * 0.08);
    c.fillStyle = 'rgba(25,26,38,.8)'; c.fillRect(x - sw / 2, sy - w * 0.12, sw, w * 0.24);
    if (o.lit) S.lights.push({ kind: 'win', x: x - sw / 2, y: sy - w * 0.12, w: sw, h: w * 0.24, k: o.lit, ph: rnd(), gy: 0 });
  }
  c.fillStyle = tone(col, -0.12); c.fillRect(x - w * 0.56, g - h - w * 0.07, w * 1.12, w * 0.1);
  if (rh > 0) {
    const rg = c.createLinearGradient(x - w * 0.62, 0, x + w * 0.62, 0);
    rg.addColorStop(0, tone(roofCol, 0.16)); rg.addColorStop(0.55, roofCol); rg.addColorStop(1, tone(roofCol, -0.28));
    c.fillStyle = rg; c.beginPath(); c.moveTo(x - w * 0.64, g - h - w * 0.02); c.lineTo(x, g - h - rh); c.lineTo(x + w * 0.64, g - h - w * 0.02); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(25,20,28,.14)'; c.lineWidth = 1;
    for (let i = 1; i < 7; i++) { const yy = g - h - rh * i / 7, hw = w * 0.64 * (1 - i / 7); c.beginPath(); c.moveTo(x - hw, yy + rh / 7 * 0.5); c.lineTo(x + hw, yy + rh / 7 * 0.5); c.stroke(); }
    if (o.flag && S.out.flags) S.out.flags.push({ x, y: g - h - rh, len: w * 0.9, col: o.flag });
  } else crenels(c, x - w / 2, x + w / 2, g - h, w / 6, w * 0.14, tone(col, -0.05));
}

/* small gable houses for distant towns; rows climb a hill */
function townBlock(c, S, rnd, x0, x1, base, hMin, hMax, sc, pal) {
  for (let x = x0; x < x1;) {
    const w = (26 + rnd() * 24) * sc, h = (hMin + rnd() * (hMax - hMin)) * sc, rh = w * (0.45 + rnd() * 0.25);
    const wall = pick(rnd, pal.walls), rf = pick(rnd, pal.roofs);
    c.fillStyle = vgrad(c, base - h, base, tone(wall, 0.08), tone(wall, -0.12)); c.fillRect(x, base - h, w, h);
    c.fillStyle = 'rgba(28,34,64,.12)'; c.fillRect(x + w * 0.75, base - h, w * 0.25, h);
    c.fillStyle = vgrad(c, base - h - rh, base - h, tone(rf, 0.1), tone(rf, -0.14));
    c.beginPath(); c.moveTo(x - w * 0.07, base - h); c.lineTo(x + w / 2, base - h - rh); c.lineTo(x + w * 1.07, base - h); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,240,210,.1)'; c.beginPath(); c.moveTo(x + w / 2, base - h - rh); c.lineTo(x - w * 0.07, base - h); c.lineTo(x + w / 2, base - h); c.closePath(); c.fill();
    if (w > 22 * S.k * 0.8 && rnd() < 0.7) {
      const ww = w * 0.16, wh = h * 0.2;
      S.lights.push({ kind: 'win', x: x + w * 0.22, y: base - h * 0.6, w: ww, h: wh, k: rnd() < 0.55 ? 0.8 : 0.08, ph: rnd(), gy: 0, tiny: true });
      if (rnd() < 0.6) S.lights.push({ kind: 'win', x: x + w * 0.6, y: base - h * 0.6, w: ww, h: wh, k: rnd() < 0.55 ? 0.8 : 0.08, ph: rnd(), gy: 0, tiny: true });
    }
    if (rnd() < 0.3) { c.fillStyle = tone('#6d625b', 0); c.fillRect(x + w * (0.2 + rnd() * 0.5), base - h - rh * 0.8, w * 0.09, rh * 0.5); }
    x += w * (0.85 + rnd() * 0.3);
  }
}

/* the Kingdom on its hill: walls, rows of roofs, cathedral, keep.  Returns nothing; pushes flags. */
function skyline(c, S, rnd, o) {
  const k = S.k * o.sc, cx = o.cx, b = o.base, pal = o.pal;
  const stone = pal.stone, rf = pal.towerRoof;
  // cathedral (behind)
  const cathX = cx - 165 * k;
  c.fillStyle = vgrad(c, b - 250 * k, b - 60 * k, tone(stone, 0.1), tone(stone, -0.1));
  c.fillRect(cathX - 70 * k, b - 190 * k, 140 * k, 130 * k);
  c.fillStyle = tone(rf, -0.05);
  c.beginPath(); c.moveTo(cathX - 80 * k, b - 190 * k); c.lineTo(cathX, b - 250 * k); c.lineTo(cathX + 80 * k, b - 190 * k); c.closePath(); c.fill();
  tower(c, S, rnd, cathX + 55 * k, b - 60 * k, 40 * k, 260 * k, stone, rf, 120 * k, { blocks: false });
  c.fillStyle = 'rgba(40,50,80,.5)'; c.beginPath(); c.arc(cathX - 5 * k, b - 150 * k, 13 * k, Math.PI, 0); c.fillRect(cathX - 18 * k, b - 150 * k, 26 * k, 34 * k); c.fill();
  // keep
  const kx = cx + 95 * k;
  c.fillStyle = vgrad(c, b - 330 * k, b - 70 * k, tone(stone, 0.12), tone(stone, -0.14)); c.fillRect(kx - 95 * k, b - 250 * k, 190 * k, 190 * k);
  blocks(c, rnd, kx - 95 * k, b - 250 * k, 190 * k, 190 * k, stone, 20 * k, 13 * k, 0.2);
  crenels(c, kx - 95 * k, kx + 95 * k, b - 250 * k, 11 * k, 14 * k, tone(stone, -0.06));
  tower(c, S, rnd, kx - 100 * k, b - 60 * k, 52 * k, 260 * k, stone, rf, 95 * k, { slits: 3, lit: 0.9, flag: pal.flag });
  tower(c, S, rnd, kx + 100 * k, b - 60 * k, 52 * k, 245 * k, stone, rf, 90 * k, { slits: 3, lit: 0.9, flag: pal.flag });
  tower(c, S, rnd, kx, b - 100 * k, 66 * k, 320 * k, tone(stone, 0.03), rf, 120 * k, { slits: 4, lit: 1, flag: pal.flag });
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) S.lights.push({ kind: 'win', x: kx - 66 * k + i * 38 * k, y: b - 215 * k + r * 60 * k, w: 9 * k, h: 16 * k, k: 0.85, ph: rnd(), gy: 0, tiny: true });
  // house rows climbing the hill
  for (let r = 2; r >= 0; r--) townBlock(c, S, rnd, cx - 470 * k, cx + 470 * k, b - 20 * k - r * 34 * k, 30, 52, k, pal);
  // curtain wall
  const wy = b + 8 * k;
  c.fillStyle = vgrad(c, wy - 62 * k, wy, tone(stone, 0.1), tone(stone, -0.2)); c.fillRect(cx - 500 * k, wy - 62 * k, 1000 * k, 62 * k);
  blocks(c, rnd, cx - 500 * k, wy - 62 * k, 1000 * k, 62 * k, stone, 24 * k, 14 * k, 0.3);
  crenels(c, cx - 500 * k, cx + 500 * k, wy - 62 * k, 9 * k, 11 * k, tone(stone, -0.08));
  for (const tx of [-500, -250, 0, 250, 500]) tower(c, S, rnd, cx + tx * k, wy, 46 * k, 105 * k, stone, rf, tx % 500 === 0 ? 62 * k : 0, { slits: 1, lit: 0.6 });
  // main gate in the wall
  c.fillStyle = '#2c2d38'; c.beginPath(); c.moveTo(cx - 20 * k, wy); c.lineTo(cx - 20 * k, wy - 34 * k); c.arc(cx, wy - 34 * k, 20 * k, Math.PI, 0); c.lineTo(cx + 20 * k, wy); c.closePath(); c.fill();
  S.lights.push({ kind: 'win', x: cx - 8 * k, y: wy - 40 * k, w: 16 * k, h: 40 * k, k: 0.5, ph: rnd(), gy: 0, tiny: true });
}

/* ═════════════════════════ living things (drawn every frame) ═════════════════════════ */
function walker(c, x, y, s, t, ph, col, o = {}) {
  // x,y = feet position, s = body height in px, dir = ±1
  const dir = o.dir || 1, sw = o.pace === 0 ? 0 : Math.sin(t * (o.pace || 5) + ph), bob = Math.abs(sw) * s * 0.03;
  c.save(); c.translate(x, y - bob); c.scale(o.front ? 1 : dir, 1);
  if (o.shadow !== false) { c.fillStyle = 'rgba(20,25,40,.18)'; c.beginPath(); c.ellipse(0, bob, s * 0.28, s * 0.07, 0, 0, TAU); c.fill(); }
  c.strokeStyle = tone(col, -0.3); c.lineWidth = Math.max(1, s * 0.07); c.lineCap = 'round';
  c.beginPath();
  if (o.front) { c.moveTo(-s * 0.08, -s * 0.34); c.lineTo(-s * 0.08, -Math.max(0, sw) * s * 0.07); c.moveTo(s * 0.08, -s * 0.34); c.lineTo(s * 0.08, -Math.max(0, -sw) * s * 0.07); }
  else { c.moveTo(-s * 0.05, -s * 0.34); c.lineTo(-s * 0.05 + sw * s * 0.13, 0); c.moveTo(s * 0.05, -s * 0.34); c.lineTo(s * 0.05 - sw * s * 0.13, 0); }
  c.stroke();
  const type = o.type || 'villager';
  if (type === 'traveler') { c.fillStyle = tone('#6b5846', -0.05); c.fillRect(-s * 0.3, -s * 0.78, s * 0.22, s * 0.34); }
  c.fillStyle = col;
  c.beginPath(); c.moveTo(-s * 0.2, -s * 0.78); c.lineTo(s * 0.18, -s * 0.78); c.lineTo(s * 0.27 + sw * s * 0.02, -s * 0.2); c.lineTo(-s * 0.27 - sw * s * 0.02, -s * 0.2); c.closePath(); c.fill();
  c.fillStyle = tone(col, 0.18, 0.45); c.beginPath(); c.moveTo(-s * 0.2, -s * 0.78); c.lineTo(-s * 0.02, -s * 0.78); c.lineTo(-s * 0.06, -s * 0.2); c.lineTo(-s * 0.27, -s * 0.2); c.closePath(); c.fill();
  c.fillStyle = type === 'knight' ? '#8f949b' : (o.away ? '#4a3a32' : '#c9a98c');
  c.beginPath(); c.arc(0, -s * 0.88, s * 0.105, 0, TAU); c.fill();
  c.fillStyle = tone(col, -0.18);
  if (type === 'merchant') { c.beginPath(); c.ellipse(0, -s * 0.95, s * 0.2, s * 0.05, 0, 0, TAU); c.fill(); c.fillRect(-s * 0.09, -s * 1.06, s * 0.18, s * 0.12); }
  else if (type === 'mage') { c.beginPath(); c.moveTo(-s * 0.16, -s * 0.94); c.lineTo(s * 0.02, -s * 1.28); c.lineTo(s * 0.16, -s * 0.94); c.closePath(); c.fill(); }
  else { c.beginPath(); c.arc(0, -s * 0.9, s * 0.115, Math.PI * 1.05, Math.PI * 1.95); c.fill(); }
  if (type === 'traveler' || type === 'mage') { c.strokeStyle = '#4b3a2c'; c.lineWidth = Math.max(1, s * 0.035); c.beginPath(); c.moveTo(s * 0.3, -s * 1.0); c.lineTo(s * 0.24 + sw * s * 0.04, 0); c.stroke(); }
  if (type === 'knight') { c.strokeStyle = '#2f3138'; c.lineWidth = Math.max(1, s * 0.04); c.beginPath(); c.moveTo(-s * 0.2, -s * 0.5); c.lineTo(-s * 0.4, -s * 0.12); c.stroke(); }
  c.restore();
}

function horse(c, x, y, s, dir, t, col, o = {}) {
  // s = body length; y = hoof line; o.gait = steps/sec (0 = standing)
  const g = o.gait !== undefined ? o.gait : 5, ph = o.ph || 0;
  c.save(); c.translate(x, y); c.scale(dir, 1);
  c.fillStyle = 'rgba(20,25,40,.16)'; c.beginPath(); c.ellipse(0, 0, s * 0.5, s * 0.06, 0, 0, TAU); c.fill();
  const leg = (hx0, phase, hind, shade) => {
    const a = g ? Math.sin(t * g + phase + ph) : 0, lift = g ? Math.max(0, Math.cos(t * g + phase + ph)) * s * 0.06 : 0;
    const hip = [hx0, -s * 0.44], knee = [hx0 + a * s * 0.07 + (hind ? -s * 0.03 : s * 0.015), -s * 0.24], hoof = [hx0 + a * s * 0.13 + (hind ? -s * 0.01 : 0), -lift];
    c.strokeStyle = tone(col, shade); c.lineWidth = s * 0.05; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(hip[0], hip[1]); c.lineTo(knee[0], knee[1]); c.lineTo(hoof[0], hoof[1]); c.stroke();
    c.lineWidth = s * 0.06; c.strokeStyle = '#2f2824'; c.beginPath(); c.moveTo(hoof[0], hoof[1] - s * 0.02); c.lineTo(hoof[0], hoof[1]); c.stroke();
  };
  leg(-s * 0.25, Math.PI, true, -0.3); leg(s * 0.26, 0, false, -0.3);
  c.fillStyle = tone(col, 0);
  c.beginPath(); c.moveTo(-s * 0.37, -s * 0.57);
  c.quadraticCurveTo(-s * 0.1, -s * 0.74, s * 0.22, -s * 0.68);
  c.lineTo(s * 0.4, -s * 0.97); c.lineTo(s * 0.5, -s * 1.01);
  c.quadraticCurveTo(s * 0.62, -s * 0.9, s * 0.67, -s * 0.8); c.lineTo(s * 0.6, -s * 0.77);
  c.lineTo(s * 0.5, -s * 0.84); c.lineTo(s * 0.42, -s * 0.72); c.lineTo(s * 0.32, -s * 0.5);
  c.quadraticCurveTo(s * 0.0, -s * 0.34, -s * 0.3, -s * 0.42);
  c.quadraticCurveTo(-s * 0.42, -s * 0.48, -s * 0.37, -s * 0.57); c.closePath(); c.fill();
  c.fillStyle = tone(col, 0.2, 0.45); c.beginPath(); c.ellipse(-s * 0.02, -s * 0.6, s * 0.28, s * 0.06, -0.08, 0, TAU); c.fill();
  c.fillStyle = tone(col, -0.42);
  c.beginPath(); c.moveTo(s * 0.2, -s * 0.69); c.quadraticCurveTo(s * 0.32, -s * 0.92, s * 0.41, -s * 1.0); c.lineTo(s * 0.46, -s * 0.99); c.quadraticCurveTo(s * 0.34, -s * 0.84, s * 0.26, -s * 0.66); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(s * 0.46, -s * 1.0); c.lineTo(s * 0.47, -s * 1.08); c.lineTo(s * 0.52, -s * 1.0); c.closePath(); c.fill();
  const tw = Math.sin(t * 1.6 + s) * s * 0.035;
  c.beginPath(); c.moveTo(-s * 0.37, -s * 0.56); c.quadraticCurveTo(-s * 0.55 + tw, -s * 0.46, -s * 0.52 + tw * 2, -s * 0.16); c.quadraticCurveTo(-s * 0.44, -s * 0.38, -s * 0.34, -s * 0.5); c.closePath(); c.fill();
  leg(-s * 0.17, 0, true, -0.05); leg(s * 0.33, Math.PI, false, -0.05);
  c.restore();
}

function cart(c, x, y, s, dir, t, o = {}) {
  // wheels turn with distance travelled (o.dist)
  const wr = s * 0.17, rot = (o.dist || 0) / wr;
  c.save(); c.translate(x, y); c.scale(dir, 1);
  c.fillStyle = 'rgba(20,25,40,.16)'; c.beginPath(); c.ellipse(0, 0, s * 0.55, s * 0.06, 0, 0, TAU); c.fill();
  c.fillStyle = tone('#7a5b43', -0.05); c.fillRect(-s * 0.5, -s * 0.5, s, s * 0.22);
  c.fillStyle = tone('#7a5b43', -0.25); c.fillRect(-s * 0.5, -s * 0.34, s, s * 0.06);
  if (o.cover !== false) {
    c.fillStyle = tone(o.cover || '#d9cdb2', 0); c.beginPath(); c.moveTo(-s * 0.46, -s * 0.5); c.quadraticCurveTo(-s * 0.4, -s * 0.98, 0, -s * 1.0); c.quadraticCurveTo(s * 0.4, -s * 0.98, s * 0.46, -s * 0.5); c.closePath(); c.fill();
    c.fillStyle = 'rgba(30,28,40,.16)'; c.beginPath(); c.moveTo(s * 0.1, -s * 1.0); c.quadraticCurveTo(s * 0.4, -s * 0.98, s * 0.46, -s * 0.5); c.lineTo(s * 0.1, -s * 0.5); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(60,45,35,.35)'; c.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * s * 0.18, -s * 0.5); c.quadraticCurveTo(i * s * 0.2, -s * 0.9, i * s * 0.1, -s * 1.0); c.stroke(); }
  } else {
    c.fillStyle = tone('#a8885a', 0); for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-s * 0.32 + i * s * 0.2, -s * 0.54, s * 0.11, Math.PI, 0); c.fill(); }
  }
  [-s * 0.3, s * 0.28].forEach(wx => {
    c.save(); c.translate(wx, -wr); c.rotate(rot);
    c.strokeStyle = '#3f3129'; c.lineWidth = s * 0.03; c.beginPath(); c.arc(0, 0, wr, 0, TAU); c.stroke();
    c.lineWidth = s * 0.015; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i * TAU / 6) * wr, Math.sin(i * TAU / 6) * wr); c.stroke(); }
    c.restore();
  });
  c.restore();
}

function bird(c, x, y, s, t, ph, col) {
  const f = Math.sin(t * 7 + ph) * s * 0.55;
  c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.16); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - s, y - f * 0.3); c.quadraticCurveTo(x - s * 0.4, y + f - s * 0.3, x, y); c.quadraticCurveTo(x + s * 0.4, y + f - s * 0.3, x + s, y - f * 0.3); c.stroke();
}

function soft(c, sprite, x, y, w, h, a) {
  const pa = c.globalAlpha; c.globalAlpha = pa * a; c.drawImage(sprite, x - w / 2, y - h / 2, w, h); c.globalAlpha = pa;
}

function smokeAt(c, E, x, y, s, k, seed, dark = 0) {
  const tint = dark ? '#8a8c94' : '#f1ece2';
  for (let i = 0; i < 6; i++) {
    const age = ((E.t * 0.11 + i / 6 + seed) % 1), px = x + E.wind * age * 70 * k + Math.sin(E.t * 0.8 + i * 2 + seed) * 6 * k * age;
    const r = (6 + age * 30) * k * s;
    c.save(); c.globalAlpha *= (1 - age) * Math.min(1, age * 5) * 0.4 * (1 - E.rain * 0.5);
    c.fillStyle = tint; c.beginPath(); c.arc(px, y - age * 110 * k * s, r, 0, TAU); c.fill(); c.restore();
  }
}

function flagAt(c, E, f, k) {
  const wave = Math.sin(E.t * 2.6 + f.x * 0.01) * f.len * 0.1 * (0.5 + E.wind), fl = f.len * 1.1;
  c.strokeStyle = '#3b3636'; c.lineWidth = Math.max(1, 2 * k); c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x, f.y - fl * 0.9); c.stroke();
  c.fillStyle = f.col;
  c.beginPath(); c.moveTo(f.x, f.y - fl * 0.88); c.bezierCurveTo(f.x + fl * 0.3, f.y - fl * 0.9 + wave, f.x + fl * 0.6, f.y - fl * 0.82 - wave, f.x + fl * 0.85 + wave * 0.6, f.y - fl * 0.76);
  c.bezierCurveTo(f.x + fl * 0.6, f.y - fl * 0.66 - wave, f.x + fl * 0.3, f.y - fl * 0.62 + wave, f.x, f.y - fl * 0.58); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,240,210,.14)'; c.beginPath(); c.moveTo(f.x, f.y - fl * 0.88); c.lineTo(f.x + fl * 0.5, f.y - fl * 0.84 + wave * 0.5); c.lineTo(f.x, f.y - fl * 0.74); c.closePath(); c.fill();
}

/* ═════════════════════════ emissive lights (after colour grade) ═════════════════════════ */
function drawLights(c, E, S, lights) {
  const L0 = E.lamp;
  if (L0 < 0.02 && !E.rain) return;
  for (const L of lights) {
    const fl = 0.88 + 0.12 * Math.sin(E.t * (3 + L.ph * 5) + L.ph * 40) + (L.kind === 'fire' ? 0.18 * Math.sin(E.t * 17 + L.ph * 9) : 0);
    const I = clamp(L0 * L.k * fl, 0, 1.25);
    if (I < 0.03) continue;
    const cx = L.x + L.w / 2, cy = L.y + L.h / 2;
    if (L.kind === 'win') {
      const r = Math.max(L.w, L.h) * (L.tiny ? 1.6 : 2.1);
      c.globalCompositeOperation = 'lighter';
      let g = c.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(255,170,80,${0.27 * I})`); g.addColorStop(1, 'rgba(255,150,60,0)');
      c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = vgrad(c, L.y, L.y + L.h, `rgba(255,222,150,${0.95 * Math.min(1, I)})`, `rgba(247,168,88,${0.92 * Math.min(1, I)})`);
      c.fillRect(L.x, L.y, L.w, L.h);
      if (!L.tiny && L.w > 5) {
        c.strokeStyle = `rgba(58,38,28,${0.6 * Math.min(1, I)})`; c.lineWidth = Math.max(1, L.w * 0.07);
        c.beginPath(); c.moveTo(cx, L.y); c.lineTo(cx, L.y + L.h); c.moveTo(L.x, cy); c.lineTo(L.x + L.w, cy); c.stroke();
      }
    } else if (L.kind === 'lamp') {
      const r = L.r * 9;
      c.globalCompositeOperation = 'lighter';
      let g = c.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(255,190,100,${0.5 * I})`); g.addColorStop(0.3, `rgba(255,160,70,${0.16 * I})`); g.addColorStop(1, 'rgba(255,150,60,0)');
      c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = `rgba(255,236,190,${Math.min(1, I)})`; c.beginPath(); c.arc(cx, cy, L.r, 0, TAU); c.fill();
    } else if (L.kind === 'fire') {
      const r = L.r * 11;
      c.globalCompositeOperation = 'lighter';
      let g = c.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(255,170,80,${0.45 * I})`); g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2);
      c.globalCompositeOperation = 'source-over';
      const fh = L.r * (2.2 + 0.5 * Math.sin(E.t * 13 + L.ph * 7)), sway = Math.sin(E.t * 9 + L.ph * 5) * L.r * 0.3;
      c.fillStyle = `rgba(255,150,60,${Math.min(1, I)})`; c.beginPath(); c.moveTo(cx - L.r * 0.8, cy + L.r); c.quadraticCurveTo(cx - L.r * 0.9, cy - fh * 0.3, cx + sway, cy - fh); c.quadraticCurveTo(cx + L.r * 0.9, cy - fh * 0.3, cx + L.r * 0.8, cy + L.r); c.closePath(); c.fill();
      c.fillStyle = `rgba(255,226,150,${Math.min(1, I)})`; c.beginPath(); c.moveTo(cx - L.r * 0.4, cy + L.r); c.quadraticCurveTo(cx - L.r * 0.4, cy, cx + sway * 0.6, cy - fh * 0.55); c.quadraticCurveTo(cx + L.r * 0.4, cy, cx + L.r * 0.4, cy + L.r); c.closePath(); c.fill();
    } else if (L.kind === 'door') {
      c.globalCompositeOperation = 'lighter';
      const open = L.open || 0, sp = L.h * (1.6 + open * 1.2);
      let g = c.createLinearGradient(cx, L.y + L.h, cx, L.y + L.h + sp); g.addColorStop(0, `rgba(255,170,80,${(0.28 + open * 0.2) * I})`); g.addColorStop(1, 'rgba(255,150,60,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(L.x, L.y + L.h); c.lineTo(L.x + L.w, L.y + L.h); c.lineTo(L.x + L.w * (2.4 + open), L.y + L.h + sp); c.lineTo(L.x - L.w * (1.4 + open), L.y + L.h + sp); c.closePath(); c.fill();
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = vgrad(c, L.y, L.y + L.h, `rgba(255,214,140,${0.85 * Math.min(1, I)})`, `rgba(245,160,84,${0.9 * Math.min(1, I)})`);
      c.beginPath(); c.moveTo(L.x, L.y + L.h); c.lineTo(L.x, L.y + L.h * 0.25); c.quadraticCurveTo(cx, L.y - L.h * 0.12, L.x + L.w, L.y + L.h * 0.25); c.lineTo(L.x + L.w, L.y + L.h); c.closePath(); c.fill();
    }
  }
  c.globalCompositeOperation = 'source-over';
}

function drawReflections(c, E, lights) {
  if (E.wet < 0.05 || E.lamp < 0.05) return;
  for (const L of lights) {
    if (!L.gy) continue;
    const I = clamp(E.lamp * L.k, 0, 1.2); if (I < 0.05) continue;
    if (L.kind === 'win') {
      const hgt = (L.gy - L.y) * 0.7;
      for (let i = 0; i < 6; i++) {
        const yy = L.gy + hgt * i / 6 + 2, wob = Math.sin(E.t * 1.7 + i * 1.3 + L.ph * 9) * L.w * 0.12;
        c.fillStyle = `rgba(255,185,100,${0.16 * I * E.wet * (1 - i / 6)})`; c.fillRect(L.x + wob, yy, L.w, hgt / 6 + 1);
      }
    } else if (L.kind === 'lamp' || L.kind === 'fire') {
      const cy = L.y + L.h / 2, hgt = (L.gy - cy) * 0.55;
      c.fillStyle = vgrad(c, L.gy, L.gy + hgt, `rgba(255,190,100,${0.3 * I * E.wet})`, 'rgba(255,190,100,0)'); c.fillRect(L.x + L.w / 2 - L.r * 1.2, L.gy, L.r * 2.4, hgt);
    } else if (L.kind === 'door') {
      c.fillStyle = vgrad(c, L.gy, L.gy + L.h * 0.9, `rgba(255,185,100,${0.28 * I * E.wet})`, 'rgba(255,185,100,0)'); c.fillRect(L.x, L.gy, L.w, L.h * 0.9);
    }
  }
}

/* ═════════════════════════ sky ═════════════════════════ */
function drawSky(c, E, st, w, h) {
  const P = E.P, k = E.k;
  c.fillStyle = vgrad(c, 0, h * 0.7, css(P.top), css(P.mid));
  c.fillRect(0, 0, w, h);
  const g2 = c.createLinearGradient(0, h * 0.35, 0, h * 0.72);
  g2.addColorStop(0, css(P.mid, 0)); g2.addColorStop(1, css(P.hor, 1));
  c.fillStyle = g2; c.fillRect(0, h * 0.35, w, h * 0.65);
  const night = P.night, sx = P.sx * w, sy = P.sy * h;
  // stars
  if (night > 0.3) {
    const a = smooth((night - 0.3) / 0.6);
    for (const s of st.stars) {
      const tw = 0.6 + 0.4 * Math.sin(E.t * s.sp + s.ph);
      c.fillStyle = `rgba(235,240,255,${a * tw * s.a * (1 - E.overcast * 0.8)})`;
      c.beginPath(); c.arc(s.x * w, s.y * h * 0.62, s.r * k, 0, TAU); c.fill();
    }
    const ss = evt(E.t + st.seed, 41, 1.3);
    if (ss >= 0 && night > 0.7) {
      const x0 = w * (0.2 + hash1(Math.floor((E.t + st.seed) / 41)) * 0.5), y0 = h * 0.08, px = x0 + ss * w * 0.16, py = y0 + ss * h * 0.07;
      const gg = c.createLinearGradient(px, py, px - w * 0.07, py - h * 0.03); gg.addColorStop(0, `rgba(255,255,255,${0.8 * (1 - ss)})`); gg.addColorStop(1, 'rgba(255,255,255,0)');
      c.strokeStyle = gg; c.lineWidth = 1.6 * k; c.beginPath(); c.moveTo(px, py); c.lineTo(px - w * 0.07, py - h * 0.03); c.stroke();
    }
  }
  // sun / moon
  const sc = P.sc;
  if (night < 0.7) {
    const a = (1 - smooth(night / 0.7)) * (1 - E.overcast * 0.6);
    c.save(); c.globalCompositeOperation = 'screen';
    let g = c.createRadialGradient(sx, sy, 0, sx, sy, h * 0.6); g.addColorStop(0, css(sc, 0.8 * a)); g.addColorStop(0.2, css(sc, 0.3 * a)); g.addColorStop(1, css(sc, 0));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    g = c.createRadialGradient(sx, sy, 0, sx, sy, 34 * k); g.addColorStop(0, css([255, 250, 232], 0.95 * a)); g.addColorStop(1, css(sc, 0));
    c.fillStyle = g; c.beginPath(); c.arc(sx, sy, 34 * k, 0, TAU); c.fill();
    c.restore();
  }
  if (night > 0.45) {
    const a = smooth((night - 0.45) / 0.45) * (1 - E.overcast * 0.7);
    c.save(); c.globalCompositeOperation = 'screen';
    let g = c.createRadialGradient(sx, sy, 0, sx, sy, h * 0.42); g.addColorStop(0, `rgba(190,205,255,${0.28 * a})`); g.addColorStop(0.25, `rgba(160,180,240,${0.09 * a})`); g.addColorStop(1, 'rgba(150,170,230,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.restore();
    c.save(); c.globalAlpha = a;
    c.fillStyle = '#f0ecdd'; c.beginPath(); c.arc(sx, sy, 30 * k, 0, TAU); c.fill();
    c.fillStyle = 'rgba(150,150,160,.28)';
    [[-9, -6, 9], [8, 5, 11], [-3, 12, 6], [11, -10, 5]].forEach(m => { c.beginPath(); c.arc(sx + m[0] * k, sy + m[1] * k, m[2] * k, 0, TAU); c.fill(); });
    c.fillStyle = 'rgba(40,50,90,.3)'; c.beginPath(); c.arc(sx + 12 * k, sy + 4 * k, 30 * k, -1.2, 1.9); c.arc(sx + 2 * k, sy, 28 * k, 1.9, -1.2, true); c.fill();
    c.restore();
  }
  // clouds
  const ca = (0.82 - night * 0.45) * (0.55 + E.overcast * 0.6);
  for (const cl of st.clouds) {
    const sp = cl.sp * (0.5 + E.wind * 0.6), cw = cl.s * k * 520, x = ((E.t * sp + cl.off * (w + cw * 2)) % (w + cw * 2)) - cw, y = h * cl.y;
    c.globalAlpha = clamp(ca * cl.a); c.drawImage(st.cloudSprites[cl.sp2], x, y, cw, cw * 0.4); c.globalAlpha = 1;
  }
  if (E.overcast > 0.05) {
    c.fillStyle = vgrad(c, 0, h * 0.62, css(desat(P.top, 0.8), 0.55 * E.overcast), css(desat(P.mid, 0.8), 0.12 * E.overcast)); c.fillRect(0, 0, w, h * 0.62);
  }
}

/* ═════════════════════════ shared scene helpers ═════════════════════════ */
function grassBlades(c, S, rnd, x0, x1, baseY, hMin, hMax, n, col) {
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * (x1 - x0), h = (hMin + rnd() * (hMax - hMin)) * S.k, w = (2.5 + rnd() * 4) * S.k, bend = (rnd() - 0.5) * h * 0.5;
    c.fillStyle = tone(col, (rnd() - 0.4) * 0.35, 0.95);
    c.beginPath(); c.moveTo(x - w, baseY + 3); c.quadraticCurveTo(x + bend * 0.3, baseY - h * 0.6, x + bend, baseY - h);
    c.quadraticCurveTo(x + bend * 0.3 + w * 0.5, baseY - h * 0.55, x + w, baseY + 3); c.closePath(); c.fill();
  }
}
function flowers(c, S, rnd, n, x0, x1, y0, y1, cols) {
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), s = (1.5 + rnd() * 2.6) * S.k * (0.5 + (y - y0) / (y1 - y0));
    c.fillStyle = hx(pick(rnd, cols), 0.85); c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
  }
}
const SCENES = [];

/* the road that leads from the foreground up to the kingdom gate */
function roadCurve(S) {
  const p = [[0.33, 1.07], [0.17, 0.9], [0.76, 0.8], [0.68, 0.658]];
  return s => {
    const m = 1 - s, f = (a, b, c2, d) => m * m * m * a + 3 * m * m * s * b + 3 * m * s * s * c2 + s * s * s * d;
    return { x: S.X(f(p[0][0], p[1][0], p[2][0], p[3][0])), y: S.Y(f(p[0][1], p[1][1], p[2][1], p[3][1])), w: S.w * (0.2 * Math.pow(1 - s, 2.3) + 0.011) };
  };
}
const SKY_PAL = { walls: ['#cbbfa6', '#c1b49b', '#d3c7ad', '#b9ad98'], roofs: ['#98664f', '#8a6a5c', '#7a6a6e', '#a07058'], stone: '#b5aea2', towerRoof: '#6f6a78', flag: '#8d5a52' };

/* ═══════════════════════ 0 · KINGDOM OUTSKIRTS · early morning ═══════════════════════ */
SCENES.push({
  id: 'outskirts', focus: [0.68, 0.62], pan: 1, hz: 0.62,
  layers: [
    { d: 0.03, fog: 0.12, paint(c, S, r) {
      ridge(c, S, r, { base: 0.5, amp: 0.2, rough: 0.5, sharp: true, freq: 1.5, col: '#6b869f', colBot: '#93aab6', snow: 0.05, facets: 22 });
      ridge(c, S, r, { base: 0.565, amp: 0.15, rough: 0.5, sharp: true, freq: 2.3, col: '#587490', colBot: '#86a0ad', facets: 18, snow: 0.02 });
      const f = ridge(c, S, r, { base: 0.608, amp: 0.05, rough: 0.55, freq: 3, col: '#718c88', colBot: '#90a89d' });
      treeLine(c, S, r, f, { size: 34, dens: 0.5, cols: ['#617c78', '#6a847e', '#5a7471'], dy: 5 });
    } },
    { d: 0.1, fog: 0.1, paint(c, S, r) {
      const left = ridge(c, S, r, { base: 0.645, amp: 0.035, rough: 0.5, col: '#6d8874', colBot: '#80987f', bump: [0.1, 0.05, 0.14, 2] });
      treeLine(c, S, r, left, { size: 44, dens: 0.4, cols: ['#5b7766', '#668272', '#52705f'], dy: 6, broad: 0.15 });
      ridge(c, S, r, { base: 0.662, amp: 0.012, rough: 0.5, freq: 3, col: '#82a075', colBot: '#96ab84', bump: [0.65, 0.055, 0.2, 4] });
      skyline(c, S, r, { cx: S.X(0.675), base: S.Y(0.612), sc: 0.82, pal: SKY_PAL });
    }, dyn(c, E, S, lay) {
      lay.out.flags.forEach(f => flagAt(c, E, f, S.k * 0.8));
      for (let i = 0; i < 5; i++) {
        const x = ((E.t * (14 + i * 3) + i * 230) % (S.w + 200)) - 100, y = S.h * (0.22 + i * 0.03) + Math.sin(E.t * 0.8 + i) * 10;
        bird(c, x, y, 5 * S.k, E.t, i * 1.7, 'rgba(60,66,78,.6)');
      }
    } },
    { d: 0.3, fog: 0.06, paint(c, S, r) {
      const k = S.k;
      ridge(c, S, r, { base: 0.688, amp: 0.012, rough: 0.5, freq: 2, col: '#94a977', colBot: '#a3b583', step: 10 });
      // meadow & fields down to the bottom
      c.fillStyle = vgrad(c, S.Y(0.68), S.Y(1), '#9bae79', '#869d63'); c.fillRect(0, S.Y(0.69), S.W, S.H);
      const fc = ['#a9b880', '#bcb988', '#9cab74', '#c4b87e', '#90a670', '#b2a56f', '#a7b192', '#b7a982'];
      const addField = (u, v, wq, hq) => {
        const x = S.X(u), y = S.Y(v), w = wq * S.w, h = hq * S.h, col = pick(r, fc), sk = w * 0.18;
        c.fillStyle = tone(col, 0); c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w + sk, y + h); c.lineTo(x - sk * 0.4, y + h); c.closePath(); c.fill();
        c.save(); c.clip(); c.strokeStyle = 'rgba(60,70,40,.11)'; c.lineWidth = Math.max(1, k * 1.3);
        for (let i = 1; i < 11; i++) { const t = i / 11; c.beginPath(); c.moveTo(x + w * t, y); c.lineTo(x + w * t + sk * 0.9 - w * 0.02, y + h); c.stroke(); }
        c.restore();
        c.strokeStyle = tone('#5d7650', -0.1, 0.8); c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w + sk, y + h); c.stroke();
      };
      addField(0.0, 0.69, 0.12, 0.035); addField(0.13, 0.693, 0.1, 0.03); addField(0.25, 0.69, 0.11, 0.04); addField(0.4, 0.69, 0.1, 0.04);
      addField(0.8, 0.688, 0.13, 0.04); addField(0.94, 0.69, 0.1, 0.034); addField(-0.02, 0.725, 0.19, 0.05); addField(0.19, 0.735, 0.17, 0.055);
      addField(0.82, 0.73, 0.2, 0.055);
      // river
      const rp = s => { const m = 1 - s, f = (a, b, c2, d) => m * m * m * a + 3 * m * m * s * b + 3 * m * s * s * c2 + s * s * s * d; return [f(0.62, 0.5, 0.3, -0.05), f(0.667, 0.7, 0.68, 0.79)]; };
      const L = [], R = [];
      for (let i = 0; i <= 24; i++) { const s = i / 24, q = rp(s), wd = (3 + s * 26) * k; L.push([S.X(q[0]), S.Y(q[1]) - wd / 2]); R.push([S.X(q[0]), S.Y(q[1]) + wd / 2]); }
      c.fillStyle = '#9fb9c1'; c.beginPath(); L.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); R.reverse().forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,248,230,.38)'; c.lineWidth = 2 * k; c.beginPath(); L.forEach((p, i) => i ? c.lineTo(p[0], p[1] + 2 * k) : c.moveTo(p[0], p[1] + 2 * k)); c.stroke();
      // hedgerows
      for (let i = 0; i < 26; i++) { const x = S.X(r() < 0.5 ? r() * 0.46 : 0.78 + r() * 0.3), y = S.Y(0.69 + r() * 0.07); c.fillStyle = tone('#587350', (r() - 0.5) * 0.2); c.beginPath(); c.ellipse(x, y, (8 + r() * 14) * k, (4 + r() * 5) * k, 0, 0, TAU); c.fill(); }
      // road
      const rc = roadCurve(S), Lr = [], Rr = [], n = 36;
      for (let i = 0; i <= n; i++) { const s = i / n, q = rc(s), wob = Math.sin(s * 9) * 0.006 * S.w; Lr.push([q.x - q.w / 2 + wob, q.y]); Rr.push([q.x + q.w / 2 + wob, q.y]); }
      const edge = (pts, dx) => pts.map(p => [p[0] + dx, p[1]]);
      c.fillStyle = tone('#6f8a54', -0.05); c.beginPath(); edge(Lr, -9 * k).forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); edge(Rr, 9 * k).reverse().forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fill();
      const rg = vgrad(c, S.Y(0.66), S.Y(1.05), '#b9a888', '#a48e6e');
      c.fillStyle = rg; c.beginPath(); Lr.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); Rr.slice().reverse().forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fill();
      c.save(); c.clip();
      for (let j = -1; j <= 1; j += 2) {
        c.strokeStyle = 'rgba(70,55,40,.18)'; c.lineWidth = 7 * k; c.beginPath();
        for (let i = 0; i <= n; i++) { const s = i / n, q = rc(s), x = q.x + j * q.w * 0.2 + Math.sin(s * 9) * 0.006 * S.w; c.lineWidth = Math.max(1, q.w * 0.07); i ? c.lineTo(x, q.y) : c.moveTo(x, q.y); }
        c.stroke();
      }
      c.strokeStyle = 'rgba(80,100,50,.35)'; c.lineWidth = 2 * k; c.beginPath(); for (let i = 0; i <= n; i++) { const s = i / n, q = rc(s); const x = q.x + Math.sin(s * 9) * 0.006 * S.w; i ? c.lineTo(x, q.y) : c.moveTo(x, q.y); } c.stroke();
      for (let i = 0; i < 90; i++) { const s = Math.pow(r(), 1.4) * 0.9, q = rc(s); c.fillStyle = tone('#a89a84', (r() - 0.5) * 0.3, 0.7); c.beginPath(); c.ellipse(q.x + (r() - 0.5) * q.w * 0.9, q.y, q.w * 0.02 + 1, q.w * 0.01 + 0.6, 0, 0, TAU); c.fill(); }
      c.restore();
      // windmill
      const mx = S.X(0.2), my = S.Y(0.692), mh = 92 * k;
      c.fillStyle = vgrad(c, my - mh, my, '#d8ccb2', '#b3a68e'); c.beginPath(); c.moveTo(mx - 22 * k, my); c.lineTo(mx - 13 * k, my - mh); c.lineTo(mx + 13 * k, my - mh); c.lineTo(mx + 22 * k, my); c.closePath(); c.fill();
      c.fillStyle = 'rgba(28,34,64,.14)'; c.beginPath(); c.moveTo(mx + 6 * k, my); c.lineTo(mx + 5 * k, my - mh); c.lineTo(mx + 13 * k, my - mh); c.lineTo(mx + 22 * k, my); c.closePath(); c.fill();
      c.fillStyle = '#6d5850'; c.beginPath(); c.moveTo(mx - 17 * k, my - mh); c.quadraticCurveTo(mx, my - mh - 34 * k, mx + 17 * k, my - mh); c.closePath(); c.fill();
      c.fillStyle = '#3e3430'; c.fillRect(mx - 5 * k, my - 20 * k, 10 * k, 20 * k);
      S.out.mill = { x: mx, y: my - mh + 4 * k, len: 62 * k };
      // farmhouses
      [[0.36, 0.705, 70], [0.88, 0.7, 84], [0.97, 0.725, 64]].forEach(a => facade(c, S, r, S.X(a[0]), S.Y(a[1]), a[2] * k, a[2] * 0.62 * k, { floors: 1, base: 5 * k, litP: 0.3, roofH: a[2] * 0.4 * k, shutter: null }));
      // oaks & orchard
      [[0.31, 0.72, 22], [0.45, 0.7, 20], [0.7, 0.695, 17], [0.76, 0.7, 19], [0.07, 0.72, 25], [0.93, 0.76, 30]].forEach(a => broadleaf(c, S.X(a[0]), S.Y(a[1]), a[2] * k, pick(r, ['#6e8a58', '#78905c', '#667f52']), r));
    }, dyn(c, E, S, lay) {
      const k = S.k, m = lay.out.mill;
      if (m) {
        const rot = E.t * 0.35 * (0.6 + E.wind * 0.6);
        c.save(); c.translate(m.x, m.y); c.rotate(rot); c.strokeStyle = '#5c4a3e'; c.lineWidth = 2.4 * k;
        for (let i = 0; i < 4; i++) {
          c.save(); c.rotate(i * Math.PI / 2); c.beginPath(); c.moveTo(0, 0); c.lineTo(m.len, 0); c.stroke();
          c.fillStyle = 'rgba(232,222,198,.8)'; c.fillRect(m.len * 0.25, -m.len * 0.05, m.len * 0.7, -m.len * 0.19);
          c.strokeStyle = 'rgba(70,55,45,.5)'; c.lineWidth = 1; for (let q = 1; q < 6; q++) { c.beginPath(); c.moveTo(m.len * (0.25 + q * 0.12), -m.len * 0.05); c.lineTo(m.len * (0.25 + q * 0.12), -m.len * 0.24); c.stroke(); }
          c.restore();
        }
        c.restore();
      }
      lay.out.smoke.forEach((sm, i) => smokeAt(c, E, sm.x, sm.y, 0.7, k, i * 0.37));
      // travellers on the road
      const rc = roadCurve(S), items = [];
      const mk = (off, sp, type, col, extra) => { const s = 0.07 + ((E.t * sp + off) % 1) * 0.86; items.push({ s, type, col, extra }); };
      mk(0.1, 0.0075, 'cart'); mk(0.32, 0.011, 'traveler', PAL.cloaks[1]); mk(0.5, 0.0095, 'merchant', PAL.cloaks[4]); mk(0.67, 0.013, 'villager', PAL.cloaks[3]); mk(0.8, 0.0105, 'mage', PAL.cloaks[5]); mk(0.92, 0.0085, 'villager', PAL.cloaks[8]);
      items.sort((a, b) => a.s - b.s);
      for (const it of items) {
        const q = rc(it.s), q2 = rc(it.s + 0.01), dir = q2.x >= q.x ? 1 : -1, hgt = q.w * 0.5, fade = smooth(Math.min(it.s - 0.07, 0.93 - it.s) / 0.05);
        const wob = Math.sin(it.s * 9) * 0.006 * S.w;
        c.save(); c.globalAlpha *= clamp(fade);
        if (it.type === 'cart') {
          const sz = q.w * 0.95; cart(c, q.x + wob, q.y, sz, dir, E.t, { dist: E.t * 40 * it.s * 0.2 }); horse(c, q.x + wob + dir * sz * 0.95, q.y, sz * 0.9, dir, E.t, '#6b5648', { gait: 4.5 });
        } else walker(c, q.x + wob, q.y, hgt, E.t, it.s * 40, it.col, { dir, type: it.type, pace: 4 + it.s * 2 });
        c.restore();
      }
    } },
    { d: 0.7, fog: 0.0, mot: 160, paint(c, S, r) {
      const k = S.k;
      // framing oak (left) and trees (right)
      broadleaf(c, S.X(0.0), S.Y(1.02), 95 * k, '#617c4e', r);
      broadleaf(c, S.X(1.03), S.Y(1.04), 110 * k, '#5b7549', r);
      broadleaf(c, S.X(0.93), S.Y(0.9), 38 * k, '#6d8656', r);
      flowers(c, S, r, 150, S.X(0), S.X(1), S.Y(0.84), S.Y(1.0), ['#e8e0b4', '#d5c06a', '#b7a7c9', '#e9d6d0', '#cf8f7f']);
      c.fillStyle = vgrad(c, S.Y(0.86), S.Y(1), 'rgba(100,126,76,0)', 'rgba(88,112,66,.55)'); c.fillRect(0, S.Y(0.86), S.W, S.H);
      grassBlades(c, S, r, 0, S.W, S.Y(1.01), 18, 62, 260, '#6a8452');
    } }
  ]
});

/* ═════════════════════════ more shared pieces ═════════════════════════ */
function emblem(c, x, y, r) {
  c.fillStyle = '#3d4d68'; c.beginPath(); c.moveTo(x - r * 0.8, y - r); c.lineTo(x + r * 0.8, y - r); c.lineTo(x + r * 0.8, y + r * 0.1); c.quadraticCurveTo(x + r * 0.7, y + r * 0.9, x, y + r * 1.25); c.quadraticCurveTo(x - r * 0.7, y + r * 0.9, x - r * 0.8, y + r * 0.1); c.closePath(); c.fill();
  c.strokeStyle = '#c6a760'; c.lineWidth = r * 0.12; c.stroke();
  c.strokeStyle = '#cfd3d6'; c.lineWidth = r * 0.13; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - r * 0.55, y + r * 0.55); c.lineTo(x + r * 0.55, y - r * 0.6); c.moveTo(x + r * 0.55, y + r * 0.55); c.lineTo(x - r * 0.55, y - r * 0.6); c.stroke();
  c.strokeStyle = '#8a6a3e'; c.lineWidth = r * 0.1; c.beginPath(); c.moveTo(x - r * 0.3, y + r * 0.2); c.lineTo(x - r * 0.06, y - r * 0.05); c.moveTo(x + r * 0.3, y + r * 0.2); c.lineTo(x + r * 0.06, y - r * 0.05); c.stroke();
  c.fillStyle = '#d9bb70'; c.beginPath(); c.moveTo(x, y - r * 0.38); c.lineTo(x + r * 0.15, y); c.lineTo(x, y + r * 0.38); c.lineTo(x - r * 0.15, y); c.closePath(); c.fill();
}
function banner(c, x, y, w, h, col) {
  c.fillStyle = col; c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.lineTo(x, y + h - w * 0.35); c.lineTo(x - w / 2, y + h); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,240,210,.12)'; c.fillRect(x - w / 2, y, w * 0.4, h * 0.9);
  c.strokeStyle = '#c6a760'; c.lineWidth = Math.max(1, w * 0.05); c.beginPath(); c.moveTo(x - w / 2 + w * 0.08, y + h * 0.04); c.lineTo(x + w / 2 - w * 0.08, y + h * 0.04); c.stroke();
  c.fillStyle = '#cdb26c'; c.beginPath(); c.arc(x, y + h * 0.3, w * 0.2, 0, TAU); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(x, y + h * 0.3, w * 0.12, 0, TAU); c.fill();
}
function canopyCorner(c, S, rnd, x, y, r, col, n = 16) {
  const bl = [];
  for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = r * Math.sqrt(rnd()) * 0.9; bl.push([x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.22 + rnd() * 0.22)]); }
  bl.forEach(b => { c.fillStyle = tone(col, -0.32); c.beginPath(); c.arc(b[0] + r * 0.05, b[1] + r * 0.08, b[2], 0, TAU); c.fill(); });
  bl.forEach(b => { c.fillStyle = tone(col, 0); c.beginPath(); c.arc(b[0], b[1], b[2] * 0.9, 0, TAU); c.fill(); });
  bl.forEach(b => { c.fillStyle = tone(col, 0.12, 0.35); c.beginPath(); c.arc(b[0] - r * 0.06, b[1] - r * 0.07, b[2] * 0.55, 0, TAU); c.fill(); });
}
/* rows of cobbles in perspective between y0..y1; halfW(t) gives half width at depth t(0 far..1 near) */
function cobbles(c, S, rnd, cx, y0, y1, hw0, hw1, base, rows) {
  const k = S.k;
  for (let j = 0; j < rows; j++) {
    const t = Math.pow(j / rows, 1.7), t2 = Math.pow((j + 1) / rows, 1.7), ya = lerp(y0, y1, t), yb = lerp(y0, y1, t2), hw = lerp(hw0, hw1, t), sw = lerp(11 * k, 56 * k, t), sh = Math.max(2, yb - ya);
    for (let x = cx - hw; x < cx + hw; x += sw * (0.85 + rnd() * 0.3)) {
      const w = sw * (0.8 + rnd() * 0.25);
      c.fillStyle = tone(base, (rnd() - 0.5) * 0.3, 0.9);
      c.beginPath(); c.ellipse(x + w / 2, ya + sh / 2, w * 0.5, sh * 0.5, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(30,28,36,.18)'; c.lineWidth = Math.max(0.6, sw * 0.04); c.stroke();
    }
  }
}
function puddle(c, x, y, rx, ry, rnd) {
  c.fillStyle = 'rgba(176,196,206,.55)'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,250,236,.4)'; c.beginPath(); c.ellipse(x - rx * 0.15, y - ry * 0.25, rx * 0.6, ry * 0.3, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(60,70,84,.25)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.stroke();
}
function backCart(c, x, y, s, t, toward) {
  // rear/front view of a covered wagon + horse, for traffic along the depth axis
  c.save(); c.translate(x, y);
  const horseF = () => {
    const hx0 = toward ? 0 : 0, hy = toward ? s * 0.0 : -s * 0.12, hs = s * 0.8, sw = Math.sin(t * 4.2 + s);
    c.fillStyle = 'rgba(20,25,40,.16)'; c.beginPath(); c.ellipse(hx0, hy, hs * 0.3, hs * 0.05, 0, 0, TAU); c.fill();
    c.strokeStyle = '#4b3b32'; c.lineWidth = hs * 0.08; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx0 - hs * 0.09, hy - hs * 0.5); c.lineTo(hx0 - hs * 0.09 + sw * hs * 0.03, hy); c.moveTo(hx0 + hs * 0.09, hy - hs * 0.5); c.lineTo(hx0 + hs * 0.09 - sw * hs * 0.03, hy); c.stroke();
    c.fillStyle = '#6b5648'; c.beginPath(); c.ellipse(hx0, hy - hs * 0.68, hs * 0.2, hs * 0.26, 0, 0, TAU); c.fill();
    c.fillStyle = '#7c6755'; c.beginPath(); c.ellipse(hx0 - hs * 0.05, hy - hs * 0.74, hs * 0.1, hs * 0.16, 0, 0, TAU); c.fill();
    if (toward) { c.fillStyle = '#5e4b3f'; c.beginPath(); c.ellipse(hx0, hy - hs * 1.02, hs * 0.1, hs * 0.16, 0, 0, TAU); c.fill(); c.fillStyle = '#3d312b'; c.beginPath(); c.moveTo(hx0 - hs * 0.08, hy - hs * 1.1); c.lineTo(hx0, hy - hs * 1.2); c.lineTo(hx0 + hs * 0.08, hy - hs * 1.1); c.fill(); }
    else { c.strokeStyle = '#3d312b'; c.lineWidth = hs * 0.05; c.beginPath(); c.moveTo(hx0, hy - hs * 0.9); c.quadraticCurveTo(hx0 + sw * hs * 0.1, hy - hs * 0.6, hx0 + sw * hs * 0.06, hy - hs * 0.3); c.stroke(); }
  };
  const cartF = () => {
    c.fillStyle = '#7a5b43'; c.fillRect(-s * 0.4, -s * 0.5, s * 0.8, s * 0.26);
    c.fillStyle = '#d6caae'; c.beginPath(); c.moveTo(-s * 0.37, -s * 0.5); c.quadraticCurveTo(-s * 0.37, -s * 1.05, 0, -s * 1.06); c.quadraticCurveTo(s * 0.37, -s * 1.05, s * 0.37, -s * 0.5); c.closePath(); c.fill();
    c.fillStyle = 'rgba(30,26,40,.2)'; c.beginPath(); c.moveTo(s * 0.1, -s * 1.05); c.quadraticCurveTo(s * 0.37, -s * 1.05, s * 0.37, -s * 0.5); c.lineTo(s * 0.1, -s * 0.5); c.closePath(); c.fill();
    c.fillStyle = '#3f3129'; c.fillRect(-s * 0.44, -s * 0.34, s * 0.06, s * 0.34); c.fillRect(s * 0.38, -s * 0.34, s * 0.06, s * 0.34);
  };
  if (toward) { cartF(); c.save(); c.translate(0, s * 0.3); horseF(); c.restore(); }
  else { c.save(); c.translate(0, -s * 0.34); horseF(); c.restore(); cartF(); }
  c.restore();
}

/* ═══════════════════════ 1 · THE GATE · morning ═══════════════════════ */
const GATE_Q = [];
{ const r = mulberry(404);
  for (let i = 0; i < 7; i++) GATE_Q.push({ lane: -0.15 - r() * 0.65, sp: 0.007 + r() * 0.007, off: r(), type: i === 1 || i === 4 ? 'cart' : pick(r, ['traveler', 'merchant', 'villager', 'mage', 'villager']), col: pick(r, PAL.cloaks), dir: -1 });
  for (let i = 0; i < 4; i++) GATE_Q.push({ lane: 0.2 + r() * 0.7, sp: 0.008 + r() * 0.006, off: r(), type: i === 2 ? 'cart' : pick(r, ['traveler', 'villager', 'merchant']), col: pick(r, PAL.cloaks), dir: 1 });
}
SCENES.push({
  id: 'gate', focus: [0.5, 0.5], pan: 1, hz: 0.6,
  layers: [
    { d: 0.03, fog: 0.12, paint(c, S, r) {
      ridge(c, S, r, { base: 0.5, amp: 0.2, rough: 0.5, sharp: true, freq: 1.9, col: '#6b869f', colBot: '#93aab6', snow: 0.05, facets: 22 });
      const f = ridge(c, S, r, { base: 0.585, amp: 0.06, rough: 0.55, freq: 3, col: '#667f7e', colBot: '#86a095' });
      treeLine(c, S, r, f, { size: 40, dens: 0.5, cols: ['#587270', '#5f7a76', '#506a68'], dy: 5 });
    } },
    { d: 0.1, fog: 0.1, paint(c, S, r) {
      ridge(c, S, r, { base: 0.5, amp: 0.01, rough: 0.5, col: '#7d9a73', colBot: '#92a883', bump: [0.5, 0.05, 0.22, 4] });
      skyline(c, S, r, { cx: S.X(0.5), base: S.Y(0.47), sc: 0.95, pal: SKY_PAL });
    }, dyn(c, E, S, lay) {
      lay.out.flags.forEach(f => flagAt(c, E, f, S.k));
      for (let i = 0; i < 4; i++) bird(c, ((E.t * (16 + i * 3) + i * 300) % (S.w + 200)) - 100, S.h * (0.18 + i * 0.03) + Math.sin(E.t + i) * 8, 5 * S.k, E.t, i * 2.1, 'rgba(60,66,78,.6)');
    } },
    { d: 0.36, fog: 0.04, mot: 380, paint(c, S, r) {
      const k = S.k, gy = S.Y(0.745), wt = S.Y(0.4), cx = S.X(0.5), stone = '#a8a193';
      c.fillStyle = vgrad(c, wt, gy, tone(stone, 0.06), tone(stone, -0.2)); c.fillRect(0, wt, S.W, gy - wt);
      blocks(c, r, 0, wt, S.W, gy - wt, stone, 36 * k, 21 * k, 0.5);
      for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(48,54,72,${0.04 + r() * 0.06})`; c.fillRect(r() * S.W, wt + r() * (gy - wt) * 0.4, (2 + r() * 6) * k, (30 + r() * 150) * k); }
      for (let i = 0; i < 90; i++) { c.fillStyle = hx('#6f8a58', 0.12 + r() * 0.12); c.beginPath(); c.ellipse(r() * S.W, gy - r() * 38 * k, (6 + r() * 18) * k, (3 + r() * 7) * k, 0, 0, TAU); c.fill(); }
      c.fillStyle = vgrad(c, wt, wt + 60 * k, 'rgba(20,20,32,.28)', 'rgba(20,20,32,0)'); c.fillRect(0, wt, S.W, 60 * k);
      crenels(c, 0, S.W, wt, 28 * k, 26 * k, tone(stone, -0.06));
      for (let x = 100 * k; x < S.W; x += 230 * k) { c.fillStyle = 'rgba(24,26,38,.75)'; c.fillRect(x, wt + 90 * k, 6 * k, 38 * k); }
      // gatehouse block + towers
      c.fillStyle = vgrad(c, gy - 470 * k, gy, tone(stone, 0.1), tone(stone, -0.18)); c.fillRect(cx - 200 * k, gy - 470 * k, 400 * k, 470 * k);
      blocks(c, r, cx - 200 * k, gy - 470 * k, 400 * k, 470 * k, stone, 38 * k, 22 * k, 0.45);
      c.fillStyle = tone(stone, -0.22); c.fillRect(cx - 215 * k, gy - 478 * k, 430 * k, 22 * k);
      for (let x = cx - 205 * k; x < cx + 200 * k; x += 20 * k) c.fillRect(x, gy - 458 * k, 8 * k, 14 * k);
      crenels(c, cx - 215 * k, cx + 215 * k, gy - 478 * k, 22 * k, 24 * k, tone(stone, -0.08));
      tower(c, S, r, cx - 215 * k, gy, 170 * k, 600 * k, stone, '#5f5a6a', 200 * k, { slits: 3, lit: 0.6, flag: '#8d5a52', blocks: true });
      tower(c, S, r, cx + 215 * k, gy, 170 * k, 600 * k, stone, '#5f5a6a', 200 * k, { slits: 3, lit: 0.6, flag: '#8d5a52', blocks: true });
      // arch ring
      const ar = 100 * k, ay = gy - 190 * k;
      for (let i = 0; i < 15; i++) {
        const a0 = Math.PI + i * Math.PI / 15, a1 = a0 + Math.PI / 15, ro = ar + 34 * k;
        c.fillStyle = tone(stone, (r() - 0.5) * 0.22 + 0.04); c.beginPath(); c.moveTo(cx + Math.cos(a0) * ar, ay + Math.sin(a0) * ar); c.lineTo(cx + Math.cos(a0) * ro, ay + Math.sin(a0) * ro); c.lineTo(cx + Math.cos(a1) * ro, ay + Math.sin(a1) * ro); c.lineTo(cx + Math.cos(a1) * ar, ay + Math.sin(a1) * ar); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(30,30,40,.3)'; c.lineWidth = 1.2; c.stroke();
      }
      c.fillStyle = tone(stone, -0.1); c.fillRect(cx - ar - 34 * k, ay, 34 * k, 190 * k); c.fillRect(cx + ar, ay, 34 * k, 190 * k);
      blocks(c, r, cx - ar - 34 * k, ay, 34 * k, 190 * k, stone, 34 * k, 22 * k, 0.4); blocks(c, r, cx + ar, ay, 34 * k, 190 * k, stone, 34 * k, 22 * k, 0.4);
      // the glimpse of the city beyond the gate
      c.save(); c.beginPath(); c.moveTo(cx - ar, gy); c.lineTo(cx - ar, ay); c.arc(cx, ay, ar, Math.PI, 0); c.lineTo(cx + ar, gy); c.closePath(); c.clip();
      c.fillStyle = vgrad(c, gy - 290 * k, gy, '#f3ddb0', '#c7a97a'); c.fillRect(cx - ar, gy - 290 * k, ar * 2, 290 * k);
      for (let i = 0; i < 6; i++) { const hx0 = cx - ar + (i * 0.17 + r() * 0.05) * ar * 2, hh = (60 + r() * 70) * k, hw = (34 + r() * 24) * k; c.fillStyle = tone(pick(r, PAL.plaster), -0.05 - i * 0.02); c.fillRect(hx0, gy - 55 * k - hh, hw, hh); c.fillStyle = tone(pick(r, PAL.roofs), -0.08); c.beginPath(); c.moveTo(hx0 - 4 * k, gy - 55 * k - hh); c.lineTo(hx0 + hw / 2, gy - 55 * k - hh - hw * 0.5); c.lineTo(hx0 + hw + 4 * k, gy - 55 * k - hh); c.closePath(); c.fill(); }
      c.fillStyle = 'rgba(255,238,190,.5)'; c.beginPath(); c.ellipse(cx, gy - 80 * k, ar * 0.55, 90 * k, 0, 0, TAU); c.fill();
      c.fillStyle = vgrad(c, gy - 60 * k, gy, '#c9b48a', '#8a7556'); c.fillRect(cx - ar, gy - 60 * k, ar * 2, 60 * k);
      for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(48,40,44,.7)'; const px0 = cx - ar * 0.6 + r() * ar * 1.2; c.fillRect(px0, gy - 58 * k, 6 * k, 20 * k); c.beginPath(); c.arc(px0 + 3 * k, gy - 62 * k, 4 * k, 0, TAU); c.fill(); }
      c.fillStyle = vgrad(c, gy - 290 * k, gy - 120 * k, 'rgba(14,12,20,.92)', 'rgba(14,12,20,0)'); c.fillRect(cx - ar, gy - 290 * k, ar * 2, 190 * k);
      let sg = c.createLinearGradient(cx - ar, 0, cx + ar, 0); sg.addColorStop(0, 'rgba(14,12,20,.78)'); sg.addColorStop(0.2, 'rgba(14,12,20,0)'); sg.addColorStop(0.8, 'rgba(14,12,20,0)'); sg.addColorStop(1, 'rgba(14,12,20,.78)');
      c.fillStyle = sg; c.fillRect(cx - ar, gy - 290 * k, ar * 2, 290 * k);
      c.strokeStyle = '#2b2622'; c.lineWidth = 5 * k; for (let x = cx - ar + 12 * k; x < cx + ar; x += 17 * k) { c.beginPath(); c.moveTo(x, gy - 292 * k); c.lineTo(x, gy - 168 * k); c.stroke(); c.beginPath(); c.moveTo(x - 3 * k, gy - 168 * k); c.lineTo(x, gy - 150 * k); c.lineTo(x + 3 * k, gy - 168 * k); c.fillStyle = '#2b2622'; c.fill(); }
      c.lineWidth = 4 * k; for (let y = gy - 270 * k; y < gy - 170 * k; y += 38 * k) { c.beginPath(); c.moveTo(cx - ar, y); c.lineTo(cx + ar, y); c.stroke(); }
      c.restore();
      // crest, banners, torches
      emblem(c, cx, gy - 395 * k, 46 * k);
      banner(c, cx - 520 * k, wt + 14 * k, 74 * k, 270 * k, '#7a4d4a'); banner(c, cx + 520 * k, wt + 14 * k, 74 * k, 270 * k, '#7a4d4a');
      banner(c, cx - 880 * k, wt + 14 * k, 74 * k, 270 * k, '#4d5f7a'); banner(c, cx + 880 * k, wt + 14 * k, 74 * k, 270 * k, '#4d5f7a');
      [-1, 1].forEach(sd => { c.fillStyle = '#2f2824'; c.fillRect(cx + sd * 146 * k - 3 * k, gy - 160 * k, 6 * k, 30 * k); S.lights.push({ kind: 'fire', x: cx + sd * 146 * k - 7 * k, y: gy - 182 * k, w: 14 * k, h: 14 * k, r: 7 * k, k: 0.7, ph: r(), gy: 0 }); });
    }, dyn(c, E, S, lay) {
      const k = S.k, gy = S.Y(0.745), cx = S.X(0.5);
      lay.out.flags.forEach(f => flagAt(c, E, f, k * 1.1));
      [-1, 1].forEach(sd => {
        const x = cx + sd * 175 * k, hgt = 128 * k * (1 + Math.sin(E.t * 1.3 + sd) * 0.004);
        walker(c, x, gy + 10 * k, hgt, E.t, sd, sd < 0 ? '#5a6672' : '#5a6672', { type: 'knight', pace: 0, front: true });
        c.strokeStyle = '#4b3a2c'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x + sd * hgt * 0.26, gy + 10 * k); c.lineTo(x + sd * hgt * 0.26, gy + 10 * k - hgt * 1.7); c.stroke();
        c.fillStyle = '#b8bdc2'; c.beginPath(); c.moveTo(x + sd * hgt * 0.26 - 4 * k, gy + 10 * k - hgt * 1.7); c.lineTo(x + sd * hgt * 0.26, gy + 10 * k - hgt * 1.85); c.lineTo(x + sd * hgt * 0.26 + 4 * k, gy + 10 * k - hgt * 1.7); c.fill();
      });
    } },
    { d: 0.62, fog: 0, mot: 300, paint(c, S, r) {
      const k = S.k, gy = S.Y(0.745), top = S.Y(0.732), cx = S.X(0.5);
      c.fillStyle = vgrad(c, top, S.H, '#869e69', '#76905c'); c.fillRect(0, top, S.W, S.H - top);
      for (let i = 0; i < 160; i++) { c.fillStyle = tone('#7d9962', (r() - 0.5) * 0.3, 0.5); c.beginPath(); c.ellipse(r() * S.W, top + r() * (S.H - top), (10 + r() * 40) * k, (3 + r() * 9) * k, 0, 0, TAU); c.fill(); }
      const hw = t => lerp(112 * k, S.w * 0.37, t);
      c.fillStyle = tone('#5f7a4c', -0.1); c.beginPath(); c.moveTo(cx - 118 * k, top); c.lineTo(cx + 118 * k, top); c.lineTo(cx + S.w * 0.39, S.H); c.lineTo(cx - S.w * 0.39, S.H); c.closePath(); c.fill();
      c.fillStyle = vgrad(c, top, S.H, '#a79f8b', '#8a8372'); c.beginPath(); c.moveTo(cx - 104 * k, top); c.lineTo(cx + 104 * k, top); c.lineTo(cx + S.w * 0.37, S.H); c.lineTo(cx - S.w * 0.37, S.H); c.closePath(); c.fill();
      c.save(); c.clip();
      cobbles(c, S, r, cx, top, S.H, 104 * k, S.w * 0.37, '#9b9381', 38);
      for (let i = 0; i < 2; i++) { c.strokeStyle = 'rgba(54,46,40,.2)'; c.lineWidth = 9 * k; c.beginPath(); c.moveTo(cx + (i ? 1 : -1) * 36 * k, top); c.lineTo(cx + (i ? 1 : -1) * S.w * 0.12, S.H); c.stroke(); }
      puddle(c, cx - S.w * 0.08, S.Y(0.86), 90 * k, 14 * k, r); puddle(c, cx + S.w * 0.13, S.Y(0.93), 130 * k, 20 * k, r); puddle(c, cx + S.w * 0.02, S.Y(0.79), 40 * k, 6 * k, r);
      c.restore();
      c.fillStyle = vgrad(c, top, top + 40 * k, 'rgba(20,20,32,.3)', 'rgba(20,20,32,0)'); c.fillRect(0, top, S.W, 40 * k);
      // roadside: signpost, milestone, shrubs
      const sx = cx + S.w * 0.33, sy = S.Y(0.82);
      c.fillStyle = '#5b4637'; c.fillRect(sx - 4 * k, sy - 120 * k, 8 * k, 120 * k);
      [[-1, 0], [1, 28]].forEach(a => { c.fillStyle = '#7c6248'; c.beginPath(); c.moveTo(sx, sy - 112 * k + a[1] * k); c.lineTo(sx + a[0] * 70 * k, sy - 112 * k + a[1] * k); c.lineTo(sx + a[0] * 82 * k, sy - 100 * k + a[1] * k); c.lineTo(sx + a[0] * 70 * k, sy - 88 * k + a[1] * k); c.lineTo(sx, sy - 88 * k + a[1] * k); c.closePath(); c.fill(); });
      const mx = cx - S.w * 0.28, my = S.Y(0.85);
      c.fillStyle = vgrad(c, my - 52 * k, my, '#b0aa9c', '#8c867a'); c.beginPath(); c.moveTo(mx - 16 * k, my); c.lineTo(mx - 14 * k, my - 40 * k); c.quadraticCurveTo(mx, my - 56 * k, mx + 14 * k, my - 40 * k); c.lineTo(mx + 16 * k, my); c.closePath(); c.fill();
      for (let i = 0; i < 16; i++) { const x = r() < 0.5 ? r() * (cx - S.w * 0.4) : cx + S.w * 0.4 + r() * (S.W - cx - S.w * 0.4), y = S.Y(0.8 + r() * 0.18); c.fillStyle = tone('#5f7a4c', (r() - 0.5) * 0.3); c.beginPath(); c.ellipse(x, y, (14 + r() * 26) * k, (8 + r() * 12) * k, 0, 0, TAU); c.fill(); }
      broadleaf(c, cx - S.w * 0.43, S.Y(0.8), 36 * k, '#6d8656', r); broadleaf(c, cx + S.w * 0.47, S.Y(0.79), 40 * k, '#667f52', r);
    }, dyn(c, E, S, lay) {
      const k = S.k, gy = S.Y(0.745), cx = S.X(0.5), top = S.Y(0.745), items = [];
      for (const q of GATE_Q) {
        const ph = (E.t * q.sp + q.off) % 1, u = q.dir < 0 ? 1 - ph : ph, uu = 0.02 + u * 0.96;
        items.push({ q, u: uu, ph });
      }
      items.sort((a, b) => a.u - b.u);
      for (const it of items) {
        const { q, u } = it, y = lerp(top + 6 * k, S.H + 30 * k, Math.pow(u, 1.55)), hwid = lerp(104 * k, S.w * 0.37, Math.pow(u, 1.55)), x = cx + q.lane * hwid * 0.86;
        const hgt = lerp(52 * k, 270 * k, Math.pow(u, 1.45)), fade = smooth(Math.min(u / 0.1, (1 - u) / 0.1));
        c.save(); c.globalAlpha *= clamp(fade);
        if (q.type === 'cart') backCart(c, x, y, hgt * 1.0, E.t + q.off * 9, q.dir > 0);
        else walker(c, x, y, hgt, E.t, q.off * 20, q.col, { front: true, away: q.dir < 0, type: q.type, pace: 4.5 + q.off });
        c.restore();
      }
    } },
    { d: 1.0, fog: 0, mot: 160, paint(c, S, r) {
      const k = S.k;
      canopyCorner(c, S, r, S.X(-0.04), S.Y(-0.02), 330 * k, '#5b7549');
      canopyCorner(c, S, r, S.X(1.05), S.Y(-0.03), 360 * k, '#566f46');
      broadleaf(c, S.X(-0.02), S.Y(1.04), 100 * k, '#617c4e', r); broadleaf(c, S.X(1.03), S.Y(1.05), 118 * k, '#5b7549', r);
      c.fillStyle = vgrad(c, S.Y(0.88), S.Y(1), 'rgba(100,126,76,0)', 'rgba(82,106,62,.5)'); c.fillRect(0, S.Y(0.88), S.W, S.H);
      grassBlades(c, S, r, 0, S.W, S.Y(1.01), 18, 58, 240, '#678250');
    } }
  ]
});

/* ═══════════════════════ 2 · MARKET STREETS · midday ═══════════════════════ */
const STREET_WD = 3.4;
function streetCam(S) {
  const vpx = S.X(0.5), vpy = S.Y(0.47), F = S.Y(1.12) - vpy;
  return { vpx, vpy, F, px: (X, z) => vpx + X * F / z, py: (Y, z) => vpy + (1 - Y) * F / z };
}
function quad(c, a, b, d, e, fill, stroke) {
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); }
}
function stall(c, rnd, x, gy, s, col) {
  const cream = '#e4dac2';
  c.fillStyle = 'rgba(20,25,40,.16)'; c.beginPath(); c.ellipse(x, gy, s * 0.95, s * 0.12, 0, 0, TAU); c.fill();
  c.strokeStyle = '#5a4637'; c.lineWidth = Math.max(1.5, s * 0.07); c.beginPath(); c.moveTo(x - s * 0.74, gy); c.lineTo(x - s * 0.74, gy - 1.7 * s); c.moveTo(x + s * 0.74, gy); c.lineTo(x + s * 0.74, gy - 1.7 * s); c.stroke();
  c.fillStyle = '#7b6046'; c.fillRect(x - s * 0.8, gy - 0.82 * s, 1.6 * s, 0.09 * s); c.fillRect(x - s * 0.7, gy - 0.73 * s, 1.4 * s, 0.72 * s);
  c.fillStyle = 'rgba(30,25,35,.18)'; c.fillRect(x - s * 0.7, gy - 0.73 * s, 1.4 * s, 0.72 * s);
  for (let i = 0; i < 9; i++) { const gx = x - s * 0.62 + i * s * 0.155, gcol = pick(rnd, ['#b9573f', '#d3a64a', '#7a9a52', '#8f5f8a', '#c9744a', '#e0d3a6']); c.fillStyle = gcol; c.beginPath(); c.arc(gx, gy - 0.9 * s, s * 0.085, 0, TAU); c.fill(); c.fillStyle = tone(gcol, 0.3, 0.5); c.beginPath(); c.arc(gx - s * 0.02, gy - 0.93 * s, s * 0.035, 0, TAU); c.fill(); }
  const n = 8, y0 = gy - 1.95 * s, y1 = gy - 1.5 * s;
  for (let i = 0; i < n; i++) {
    const xa = x - s * 0.85 + i * s * 1.7 / n, xb = xa + s * 1.7 / n;
    c.fillStyle = i % 2 ? cream : css(col); c.beginPath(); c.moveTo(xa + s * 0.05 * (i - n / 2) / n, y0); c.lineTo(xb + s * 0.05 * (i + 1 - n / 2) / n, y0); c.lineTo(xb + s * 0.03, y1); c.quadraticCurveTo((xa + xb) / 2, y1 + s * 0.12, xa - s * 0.03, y1); c.closePath(); c.fill();
  }
  c.fillStyle = 'rgba(255,240,210,.12)'; c.fillRect(x - s * 0.85, y0, s * 0.5, y1 - y0);
  c.fillStyle = 'rgba(30,25,40,.18)'; c.fillRect(x + s * 0.4, y0, s * 0.45, y1 - y0);
}
const MKT = [];
{ const r = mulberry(77);
  for (let i = 0; i < 15; i++) MKT.push({ x: (r() - 0.5) * 3.3, sp: (0.2 + r() * 0.25) * (r() < 0.5 ? -1 : 1), off: r() * 40, type: pick(r, ['villager', 'villager', 'merchant', 'traveler', 'mage', 'knight']), col: pick(r, PAL.cloaks), kid: r() < 0.16 });
}
SCENES.push({
  id: 'street', focus: [0.5, 0.47], pan: 0.8, hz: 0.5,
  layers: [
    { d: 0.04, fog: 0.22, paint(c, S, r) {
      const k = S.k, cam = streetCam(S);
      ridge(c, S, r, { base: 0.47, amp: 0.05, rough: 0.5, freq: 3, col: '#8aa092', colBot: '#a3b4a6' });
      skyline(c, S, r, { cx: cam.vpx - S.w * 0.06, base: cam.vpy + 4 * k, sc: 0.5, pal: SKY_PAL });
      const tx = cam.vpx + 28 * k, ty = cam.vpy + 12 * k;
      tower(c, S, r, tx, ty, 60 * k, 300 * k, '#b9b2a4', '#6a6677', 110 * k, { blocks: true, slits: 2 });
      c.fillStyle = '#e8e0c8'; c.beginPath(); c.arc(tx, ty - 215 * k, 15 * k, 0, TAU); c.fill(); c.strokeStyle = '#4a4036'; c.lineWidth = 1.5 * k; c.beginPath(); c.moveTo(tx, ty - 215 * k); c.lineTo(tx, ty - 224 * k); c.moveTo(tx, ty - 215 * k); c.lineTo(tx + 6 * k, ty - 212 * k); c.stroke();
    } },
    { d: 0.45, fog: 0.03, mot: 420, brush: 900, paint(c, S, r) {
      const k = S.k, cam = streetCam(S), { vpx, vpy, F, px, py } = cam, Wd = STREET_WD, P = (X, z, Y) => [px(X, z), py(Y, z)];
      const haze = '#d3dcd9';
      const dist = z => clamp((z - 4) / 30) * 0.55;
      // ground
      c.fillStyle = vgrad(c, vpy, S.H, '#b3aa96', '#8e8674'); c.fillRect(0, vpy + 4, S.W, S.H);
      c.fillStyle = vgrad(c, vpy, S.H, '#aaa18d', '#867f6d'); quad(c, P(-Wd, 40, 0), P(Wd, 40, 0), P(Wd, 0.9, 0), P(-Wd, 0.9, 0), vgrad(c, vpy, S.H, '#b0a792', '#8a8271'));
      c.save(); quad(c, P(-Wd, 40, 0), P(Wd, 40, 0), P(Wd, 0.9, 0), P(-Wd, 0.9, 0)); c.clip();
      for (let z = 1.1; z < 40; z *= 1.07) {
        const zb = z * 1.07, ya = py(0, zb), yb = py(0, z), sw = 0.24 * F / z;
        for (let X = -Wd; X < Wd; X += 0.24 * (0.85 + r() * 0.3)) {
          const x = px(X, z), w = sw * 0.92 * (0.85 + r() * 0.2);
          c.fillStyle = css(mix(tone('#a39b8a', (r() - 0.5) * 0.2), haze, dist(z))); c.beginPath(); c.ellipse(x + w / 2, (ya + yb) / 2, w * 0.5, Math.max(1, (yb - ya) * 0.46), 0, 0, TAU); c.fill();
        }
      }
      c.strokeStyle = 'rgba(52,44,40,.1)'; c.lineWidth = 0.22 * F / 3; c.beginPath(); c.moveTo(px(0, 40), py(0, 40)); c.lineTo(px(0.05, 1.2), py(0, 1.2)); c.stroke();
      [[-1.2, 5.5, 1.2], [1.4, 9, 1.4], [0.2, 3.2, 0.8], [-0.4, 13, 1.1]].forEach(a => { const x = px(a[0], a[1]), y = py(0, a[1]), s = F / a[1]; puddle(c, x, y, a[2] * s * 0.7, a[2] * s * 0.12, r); });
      c.restore();
      // buildings, far to near
      const segs = [];
      for (const side of [-1, 1]) { let z = 1.9 + (side > 0 ? 0.6 : 0); while (z < 36) { const len = 1.5 + r() * 1.7; segs.push({ side, za: z, zb: z + len, fl: 2 + ((r() * 3) | 0), wall: pick(r, PAL.plaster), roof: pick(r, PAL.roofs), shut: r() < 0.7 ? pick(r, ['#5f7a6e', '#8a5a4e', '#5d6f86', '#7b7a52']) : null, sign: r() < 0.4, door: (r() * 3) | 0 }); z += len; } }
      segs.sort((a, b) => b.za - a.za);
      const FH = 1.05, H0 = 0.35, D = 2.6;
      for (const sg of segs) {
        const { side, za, zb, fl } = sg, Hb = H0 + fl * FH, Rh = 1.0 + r() * 0.45, zm = (za + zb) / 2, X0 = side * Wd, X1 = side * (Wd + D), dk = dist(za);
        const wallc = mix(tone(sg.wall, side > 0 ? -0.1 : 0.03), haze, dk), roofc = mix(tone(sg.roof, 0), haze, dk * 0.8), beam = mix('#4a3b33', haze, dk);
        quad(c, P(X0, za, 0), P(X1, za, 0), P(X1, za, Hb + Rh * 0.2), P(X0, za, Hb + Rh * 0.2), css(mix(wallc, '#202840', 0.22)));
        const wq = [P(X0, za, 0), P(X0, zb, 0), P(X0, zb, Hb), P(X0, za, Hb)];
        c.fillStyle = vgrad(c, Math.min(wq[2][1], wq[3][1]), Math.max(wq[0][1], wq[1][1]), css(mix(wallc, '#fff2d6', 0.1)), css(mix(wallc, '#202840', 0.18)));
        quad(c, wq[0], wq[1], wq[2], wq[3], c.fillStyle);
        // stone base
        quad(c, P(X0, za, 0), P(X0, zb, 0), P(X0, zb, H0), P(X0, za, H0), css(mix([140, 134, 124], haze, dk)));
        // gable + roof slope
        c.beginPath(); const g0 = P(X0, za, Hb), g1 = P(X0, zb, Hb), g2 = P(X0, zm, Hb + Rh); c.moveTo(g0[0], g0[1]); c.lineTo(g1[0], g1[1]); c.lineTo(g2[0], g2[1]); c.closePath(); c.fillStyle = css(mix(tone(sg.wall, -0.06), haze, dk)); c.fill();
        const A = P(X0, za, Hb), B = P(X0, zm, Hb + Rh), B2 = P(X1, zm, Hb + Rh), A2 = P(X1, za, Hb);
        quad(c, A, B, B2, A2, css(roofc));
        c.strokeStyle = 'rgba(25,20,28,.18)'; c.lineWidth = Math.max(0.8, 0.03 * F / zm);
        for (let i = 1; i < 6; i++) { const t = i / 6; c.beginPath(); c.moveTo(lerp(A[0], A2[0], t), lerp(A[1], A2[1], t)); c.lineTo(lerp(B[0], B2[0], t), lerp(B[1], B2[1], t)); c.stroke(); }
        c.strokeStyle = css(mix(tone(sg.roof, -0.4), haze, dk)); c.lineWidth = Math.max(1, 0.07 * F / zm); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(g1[0], g1[1]); c.stroke();
        // timber
        c.strokeStyle = css(beam); c.lineWidth = Math.max(0.8, 0.07 * F / zm);
        for (let f = 1; f <= fl; f++) { const Y = H0 + f * FH, a = P(X0, za, Y), b = P(X0, zb, Y); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
        const nb = Math.max(2, Math.round((zb - za) / 0.9)), bay = (zb - za) / nb;
        for (let i = 0; i <= nb; i++) { const z = za + i * bay, a = P(X0, z, 0), b = P(X0, z, Hb); c.lineWidth = Math.max(0.8, 0.07 * F / z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
        for (let i = 0; i < nb; i++) {
          const z0 = za + i * bay, zc = z0 + bay / 2, hw = 0.18;
          for (let f = 0; f < fl; f++) {
            const Y0 = H0 + f * FH + 0.28, Y1 = Y0 + 0.5;
            if (f === 0 && i === sg.door % nb) { quad(c, P(X0, zc - 0.24, 0), P(X0, zc + 0.24, 0), P(X0, zc + 0.24, 0.85), P(X0, zc - 0.24, 0.85), css(mix([58, 45, 38], haze, dk))); continue; }
            if (f === 0) { quad(c, P(X0, zc - hw, 0.5), P(X0, zc + hw, 0.5), P(X0, zc + hw, 0.95), P(X0, zc - hw, 0.95), css(mix([46, 52, 66], haze, dk))); continue; }
            if (sg.shut) { const sc2 = css(mix(sg.shut, haze, dk)); quad(c, P(X0, zc - hw - 0.17, Y0 - 0.02), P(X0, zc - hw - 0.01, Y0 - 0.02), P(X0, zc - hw - 0.01, Y1 + 0.02), P(X0, zc - hw - 0.17, Y1 + 0.02), sc2); quad(c, P(X0, zc + hw + 0.01, Y0 - 0.02), P(X0, zc + hw + 0.17, Y0 - 0.02), P(X0, zc + hw + 0.17, Y1 + 0.02), P(X0, zc + hw + 0.01, Y1 + 0.02), sc2); }
            quad(c, P(X0, zc - hw, Y0), P(X0, zc + hw, Y0), P(X0, zc + hw, Y1), P(X0, zc - hw, Y1), css(mix([50, 62, 80], haze, dk)));
            const a = P(X0, zc, Y0), b = P(X0, zc, Y1); c.strokeStyle = css(beam); c.lineWidth = Math.max(0.6, 0.04 * F / zc); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
          }
        }
        // chimney
        const cxp = px(side * (Wd + 1.7), zm - 0.2), cyb = py(Hb + Rh * 0.55, zm - 0.2), cyt = py(Hb + Rh + 0.45, zm - 0.2), cw = 0.42 * F / zm;
        c.fillStyle = css(mix([125, 112, 102], haze, dk)); c.fillRect(cxp - cw / 2, cyt, cw, cyb - cyt); c.fillStyle = css(mix([76, 68, 63], haze, dk)); c.fillRect(cxp - cw * 0.62, cyt - cw * 0.25, cw * 1.24, cw * 0.35);
        if (zm < 22) S.out.smoke.push({ x: cxp, y: cyt - cw * 0.25, s: clamp(3.2 / zm, 0.28, 1.1) });
        // hanging sign
        if (sg.sign && zm < 14) {
          const Y = H0 + FH * 0.95, a = P(X0, zm, Y), bx = px(side * (Wd - 0.95), zm), s = F / zm;
          c.strokeStyle = '#3a2f2a'; c.lineWidth = Math.max(1, 0.06 * s); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(bx, a[1]); c.stroke();
          const col = pick(r, PAL.awn); c.fillStyle = col; c.fillRect(bx - 0.3 * s, a[1] + 0.12 * s, 0.6 * s, 0.4 * s); c.strokeStyle = '#3a2f2a'; c.strokeRect(bx - 0.3 * s, a[1] + 0.12 * s, 0.6 * s, 0.4 * s);
          c.fillStyle = '#e8d9a8'; c.beginPath(); c.arc(bx, a[1] + 0.32 * s, 0.11 * s, 0, TAU); c.fill();
        }
      }
      // stalls
      [[-1, 3.1, 0], [1, 3.8, 1], [-1, 5.5, 2], [1, 6.9, 3], [-1, 8.6, 4], [1, 10.6, 5], [-1, 12.5, 0]].forEach(a => {
        const z = a[1], x = px(a[0] * (Wd - 0.95), z), gy = py(0, z), s = F / z;
        stall(c, r, x, gy, s * 0.95, mix(PAL.awn[a[2]], haze, dist(z)));
      });
      // laundry, bunting, lanterns
      const line = (zz, Y, sag, fn) => { const a = P(-Wd + 0.02, zz, Y), b = P(Wd - 0.02, zz, Y), my = (a[1] + b[1]) / 2 + sag * F / zz; c.strokeStyle = 'rgba(60,50,44,.7)'; c.lineWidth = Math.max(0.8, 0.02 * F / zz); c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo((a[0] + b[0]) / 2, my + sag * F / zz, b[0], b[1]); c.stroke(); for (let i = 0; i < 12; i++) { const t = 0.08 + i * 0.075, x = lerp(a[0], b[0], t), y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * (my + sag * F / zz) + t * t * b[1]; fn(x, y, F / zz, i); } };
      line(4.6, 3.2, 0.2, (x, y, s, i) => { if (i % 2) return; c.fillStyle = ['#d8d0c0', '#a65f55', '#6f8aa0', '#c9b47a', '#cfc7b4'][i % 5]; c.fillRect(x - 0.14 * s, y, 0.28 * s, (0.45 + (i % 3) * 0.12) * s); c.fillStyle = 'rgba(30,28,40,.14)'; c.fillRect(x, y, 0.14 * s, 0.5 * s); });
      line(7.6, 3.0, 0.22, (x, y, s, i) => { if (i % 3 !== 1) return; c.fillStyle = ['#cfc7b4', '#8a6a9a', '#b9714c'][i % 3]; c.fillRect(x - 0.16 * s, y, 0.32 * s, 0.55 * s); });
      [[3.0, 3.5], [8.8, 3.4], [13.5, 3.3]].forEach((a, ai) => line(a[0], a[1], 0.18, (x, y, s, i) => { c.fillStyle = mix(PAL.awn[(i + ai) % 6], haze, dist(a[0])); c.beginPath(); c.moveTo(x - 0.1 * s, y); c.lineTo(x + 0.1 * s, y); c.lineTo(x, y + 0.24 * s); c.closePath(); c.fill(); }));
      [[5.2, 2.7], [8.2, 2.6], [12, 2.5]].forEach(a => { const x = px(0.4, a[0]), y = py(a[1], a[0]); S.lights.push({ kind: 'lamp', x: x - 3, y: y - 3, w: 6, h: 6, r: Math.max(2, 0.07 * F / a[0]), k: 0.8, ph: r(), gy: 0 }); c.fillStyle = '#3a2f2a'; c.beginPath(); c.arc(x, y, Math.max(2.5, 0.09 * F / a[0]), 0, TAU); c.fill(); });
    }, dyn(c, E, S, lay) {
      const cam = streetCam(S), { F, px, py } = cam;
      lay.out.smoke.forEach((sm, i) => smokeAt(c, E, sm.x, sm.y, sm.s, S.k, i * 0.31));
      const R = 24, z0 = 3.4, list = [];
      for (const m of MKT) { const z = z0 + ((((m.off + E.t * m.sp) % R) + R) % R); list.push({ m, z }); }
      list.sort((a, b) => b.z - a.z);
      for (const { m, z } of list) {
        const s = (m.kid ? 0.68 : 1.04) * F / z, x = px(m.x * (1 - 0.0), z) + Math.sin(E.t * 0.7 + m.off) * 0.04 * F / z, y = py(0, z), fade = smooth(Math.min(z - z0, z0 + R - z) / 1.6);
        c.save(); c.globalAlpha *= fade; walker(c, x, y, s, E.t, m.off, m.col, { front: true, away: m.sp > 0, type: m.type, pace: m.kid ? 9 : 5 + (m.off % 2) }); c.restore();
      }
      for (let i = 0; i < 4; i++) { const px0 = px(-0.6 + i * 0.5, 3.6 + (i % 2)), py0 = py(0, 3.6 + (i % 2)); const peck = Math.max(0, Math.sin(E.t * 3 + i * 2)); c.fillStyle = i % 2 ? '#8a8e98' : '#6f7580'; const s = 0.1 * F / 3.8; c.beginPath(); c.ellipse(px0, py0 - s * 1.5 + peck * s * 0.6, s * 1.2, s * 0.85, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(px0 + s * 1.1, py0 - s * 2.2 + peck * s * 1.4, s * 0.5, 0, TAU); c.fill(); }
    } },
    { d: 1.0, fog: 0, mot: 140, paint(c, S, r) {
      const k = S.k;
      [[-1, 1], [1, 1]].forEach(a => {
        const sd = a[0], x0 = sd < 0 ? S.X(-0.1) : S.X(1.1), x1 = sd < 0 ? S.X(0.2) : S.X(0.8);
        c.fillStyle = tone('#6c5148', -0.15); c.beginPath(); c.moveTo(x0, 0); c.lineTo(x1, 0); c.lineTo(x0, S.Y(0.24)); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(20,16,24,.25)'; c.lineWidth = 1.5 * k; for (let i = 1; i < 8; i++) { const t = i / 8; c.beginPath(); c.moveTo(lerp(x0, x1, t), 0); c.lineTo(x0, S.Y(0.24) * (1 - t)); c.stroke(); }
      });
      [[0.03, 1.0, 100], [0.11, 1.03, 80], [0.95, 1.0, 96], [0.88, 1.04, 70]].forEach((a, i) => {
        const x = S.X(a[0]), y = S.Y(a[1]), s = a[2] * k;
        if (i % 2 === 0) { c.fillStyle = vgrad(c, y - s * 1.3, y, '#8a6a4a', '#6a4e38'); c.beginPath(); c.moveTo(x - s * 0.55, y); c.quadraticCurveTo(x - s * 0.7, y - s * 0.65, x - s * 0.5, y - s * 1.3); c.lineTo(x + s * 0.5, y - s * 1.3); c.quadraticCurveTo(x + s * 0.7, y - s * 0.65, x + s * 0.55, y); c.closePath(); c.fill(); c.strokeStyle = '#3a2f2a'; c.lineWidth = 4 * k; [0.3, 0.75].forEach(f => { c.beginPath(); c.moveTo(x - s * 0.62, y - s * f); c.lineTo(x + s * 0.62, y - s * f); c.stroke(); }); c.fillStyle = '#5a4430'; c.beginPath(); c.ellipse(x, y - s * 1.3, s * 0.5, s * 0.12, 0, 0, TAU); c.fill(); }
        else { c.fillStyle = '#9a7a52'; c.fillRect(x - s * 0.6, y - s * 0.9, s * 1.2, s * 0.9); c.strokeStyle = '#4a3a2a'; c.lineWidth = 3 * k; c.strokeRect(x - s * 0.6, y - s * 0.9, s * 1.2, s * 0.9); c.beginPath(); c.moveTo(x - s * 0.6, y - s * 0.45); c.lineTo(x + s * 0.6, y - s * 0.45); c.stroke(); }
      });
      c.fillStyle = vgrad(c, S.Y(0.9), S.Y(1), 'rgba(120,110,96,0)', 'rgba(120,110,96,.35)'); c.fillRect(0, S.Y(0.9), S.W, S.H);
    } }
  ]
});

/* ═══════════════════════ 3 · TAVERN DISTRICT · rainy dusk ═══════════════════════ */
function lampPost(c, S, x, gy, h, lights, rnd, wet) {
  const k = S.k;
  c.fillStyle = '#2f2b2e'; c.fillRect(x - 4 * k, gy - h, 8 * k, h); c.fillRect(x - 10 * k, gy - 8 * k, 20 * k, 8 * k);
  c.fillStyle = '#2f2b2e'; c.beginPath(); c.moveTo(x - 14 * k, gy - h); c.lineTo(x + 14 * k, gy - h); c.lineTo(x + 10 * k, gy - h - 26 * k); c.lineTo(x - 10 * k, gy - h - 26 * k); c.closePath(); c.fill();
  c.fillStyle = '#6e5a3c'; c.fillRect(x - 9 * k, gy - h - 22 * k, 18 * k, 20 * k);
  lights.push({ kind: 'lamp', x: x - 8 * k, y: gy - h - 20 * k, w: 16 * k, h: 16 * k, r: 7 * k, k: 1.1, ph: rnd(), gy: wet ? gy : 0 });
}
function barrel(c, x, y, s, k) {
  c.fillStyle = vgrad(c, y - s * 1.2, y, '#8a6a4a', '#664b36'); c.beginPath(); c.moveTo(x - s * 0.5, y); c.quadraticCurveTo(x - s * 0.66, y - s * 0.6, x - s * 0.5, y - s * 1.2); c.lineTo(x + s * 0.5, y - s * 1.2); c.quadraticCurveTo(x + s * 0.66, y - s * 0.6, x + s * 0.5, y); c.closePath(); c.fill();
  c.strokeStyle = '#3a2f2a'; c.lineWidth = 3 * k; [0.28, 0.9].forEach(f => { c.beginPath(); c.moveTo(x - s * 0.6, y - s * f); c.lineTo(x + s * 0.6, y - s * f); c.stroke(); });
  c.fillStyle = '#58412f'; c.beginPath(); c.ellipse(x, y - s * 1.2, s * 0.5, s * 0.1, 0, 0, TAU); c.fill();
}
SCENES.push({
  id: 'tavern', focus: [0.5, 0.55], pan: 1, hz: 0.62,
  layers: [
    { d: 0.05, fog: 0.2, paint(c, S, r) {
      const f = ridge(c, S, r, { base: 0.62, amp: 0.05, rough: 0.5, freq: 3, col: '#6e8394', colBot: '#869aa4' });
      treeLine(c, S, r, f, { size: 40, dens: 0.3, cols: ['#566e72', '#5f777a'], dy: 4 });
      skyline(c, S, r, { cx: S.X(0.24), base: S.Y(0.63), sc: 0.55, pal: SKY_PAL });
      skyline(c, S, r, { cx: S.X(0.86), base: S.Y(0.64), sc: 0.38, pal: SKY_PAL });
    } },
    { d: 0.2, fog: 0.1, smoke: true, paint(c, S, r) {
      const k = S.k;
      for (let x = -S.ox * 0.2; x < S.W; x += (190 + r() * 80) * k) facade(c, S, r, x, S.Y(0.71), (150 + r() * 90) * k, (150 + r() * 80) * k, { floors: 2, base: 0, litP: 0.7, door: false, shutter: null });
    } },
    { d: 0.42, fog: 0.04, smoke: true, mot: 340, paint(c, S, r) {
      const k = S.k, gy = S.Y(0.745);
      facade(c, S, r, S.X(0.03), gy, 470 * k, 640 * k, { floors: 3, wall: '#a99b84', roof: '#5c4f55', litP: 0.8, reflect: true, doorBay: 3 });
      facade(c, S, r, S.X(0.97), gy, 440 * k, 590 * k, { floors: 3, wall: '#b0a085', roof: '#6a5048', litP: 0.8, reflect: true, doorBay: 0 });
    } },
    { d: 0.6, fog: 0.02, smoke: true, mot: 360, paint(c, S, r) {
      const k = S.k, gy = S.Y(0.745), cx = S.X(0.5);
      facade(c, S, r, cx, gy, 560 * k, 530 * k, { floors: 3, wall: '#bcab8e', roof: '#5e4a45', roofH: 280 * k, litP: 1, k: 1.3, doorLight: true, reflect: true, shutter: null, ov: 30 * k, base: 100 * k });
      for (let i = 0; i < 3; i++) { const dx = cx + (i - 1) * 170 * k, top = gy - 530 * k - 190 * k; c.fillStyle = '#b7a68a'; c.fillRect(dx - 34 * k, top, 68 * k, 90 * k); c.fillStyle = '#5e4a45'; c.beginPath(); c.moveTo(dx - 44 * k, top); c.lineTo(dx, top - 52 * k); c.lineTo(dx + 44 * k, top); c.closePath(); c.fill(); pane(c, r, dx - 12 * k, top + 22 * k, 24 * k, 36 * k, '#4a3b33'); S.lights.push({ kind: 'win', x: dx - 12 * k, y: top + 22 * k, w: 24 * k, h: 36 * k, k: 1.2, ph: r(), gy: 0 }); }
      // door steps, awning, lamps
      c.fillStyle = '#8a8478'; for (let i = 0; i < 3; i++) c.fillRect(cx - (60 + i * 14) * k, gy - (3 - i) * 7 * k + 7 * k * 0, (120 + i * 28) * k, 7 * k);
      c.fillStyle = tone('#7a4a3e', 0); c.beginPath(); c.moveTo(cx - 90 * k, gy - 168 * k); c.lineTo(cx + 90 * k, gy - 168 * k); c.lineTo(cx + 104 * k, gy - 138 * k); c.lineTo(cx - 104 * k, gy - 138 * k); c.closePath(); c.fill();
      [-1, 1].forEach(sd => { const lx = cx + sd * 120 * k, ly = gy - 120 * k; c.strokeStyle = '#2f2b2e'; c.lineWidth = 4 * k; c.beginPath(); c.moveTo(lx, ly - 30 * k); c.lineTo(lx, ly + 10 * k); c.stroke(); c.fillStyle = '#6e5a3c'; c.fillRect(lx - 8 * k, ly + 8 * k, 16 * k, 20 * k); S.lights.push({ kind: 'lamp', x: lx - 7 * k, y: ly + 10 * k, w: 14 * k, h: 14 * k, r: 6 * k, k: 1.2, ph: r(), gy }); });
      barrel(c, cx - 235 * k, gy + 4 * k, 46 * k, k); barrel(c, cx - 290 * k, gy + 8 * k, 40 * k, k);
      c.fillStyle = '#5a4637'; c.fillRect(cx + 170 * k, gy - 30 * k, 110 * k, 8 * k); c.fillRect(cx + 178 * k, gy - 22 * k, 6 * k, 22 * k); c.fillRect(cx + 266 * k, gy - 22 * k, 6 * k, 22 * k);
      // sign bracket
      const sx = cx + 280 * k + 6 * k, sy = gy - 330 * k; c.strokeStyle = '#2b2628'; c.lineWidth = 5 * k; c.beginPath(); c.moveTo(cx + 280 * k, sy); c.lineTo(sx + 70 * k, sy); c.quadraticCurveTo(sx + 78 * k, sy - 22 * k, sx + 56 * k, sy - 26 * k); c.stroke();
      S.out.sign = { x: sx + 40 * k, y: sy };
    }, dyn(c, E, S, lay) {
      const k = S.k, sg = lay.out.sign, gy = S.Y(0.745), cx = S.X(0.5);
      if (sg) {
        const sw = Math.sin(E.t * 1.5) * (0.05 + E.wind * 0.07);
        c.save(); c.translate(sg.x, sg.y); c.rotate(sw);
        c.strokeStyle = '#2b2628'; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(-26 * k, 0); c.lineTo(-26 * k, 22 * k); c.moveTo(26 * k, 0); c.lineTo(26 * k, 22 * k); c.stroke();
        c.fillStyle = '#4b3a2e'; c.fillRect(-36 * k, 22 * k, 72 * k, 72 * k); c.strokeStyle = '#c3a56a'; c.lineWidth = 3 * k; c.strokeRect(-36 * k, 22 * k, 72 * k, 72 * k);
        c.fillStyle = '#d8c28a'; c.fillRect(-14 * k, 40 * k, 24 * k, 36 * k); c.fillStyle = '#f2ecd6'; c.beginPath(); c.ellipse(-2 * k, 40 * k, 14 * k, 6 * k, 0, 0, TAU); c.fill(); c.strokeStyle = '#d8c28a'; c.lineWidth = 4 * k; c.beginPath(); c.arc(14 * k, 58 * k, 8 * k, -1.4, 1.4); c.stroke();
        c.restore();
        S.lights.length; lay.lights.push;
      }
      const door = lay.lights.find(l => l.kind === 'door'); const ev = evt(E.t, 17, 6, 3);
      if (door) door.open = ev >= 0 ? Math.sin(ev * Math.PI) : 0;
      if (ev > 0.2 && ev < 0.95) { const q = (ev - 0.2) / 0.75, x = cx + q * 150 * k, y = gy + 4 * k + q * 40 * k, h = lerp(120, 170, q) * k; c.save(); c.globalAlpha *= smooth(Math.min(q * 5, (1 - q) * 3)); walker(c, x, y, h, E.t, 1, '#5a4a40', { front: true, away: false, type: 'traveler', pace: 5 }); c.restore(); }
    } },
    { d: 0.9, fog: 0, ground: true, mot: 220, paint(c, S, r) {
      const k = S.k, top = S.Y(0.73), cx = S.X(0.5);
      c.fillStyle = vgrad(c, top, S.H, '#6f7482', '#4e5262'); c.fillRect(0, top, S.W, S.H - top);
      cobbles(c, S, r, cx, S.Y(0.74), S.H, S.W * 0.52, S.W * 0.52, '#7a7d8a', 34);
      c.fillStyle = vgrad(c, top, top + 40 * k, 'rgba(18,20,34,.4)', 'rgba(18,20,34,0)'); c.fillRect(0, top, S.W, 40 * k);
      c.fillStyle = vgrad(c, S.Y(0.75), S.Y(0.9), 'rgba(190,205,216,.22)', 'rgba(190,205,216,0)'); c.fillRect(0, S.Y(0.75), S.W, S.Y(0.15));
      [[0.2, 0.83, 150, 16], [0.62, 0.9, 210, 22], [0.4, 0.97, 120, 12], [0.82, 0.8, 100, 10], [0.5, 0.78, 90, 8]].forEach(a => puddle(c, S.X(a[0]), S.Y(a[1]), a[2] * k, a[3] * k, r));
      lampPost(c, S, S.X(0.1), S.Y(0.88), 250 * k, S.lights, r, true); lampPost(c, S, S.X(0.92), S.Y(0.86), 235 * k, S.lights, r, true);
      barrel(c, S.X(0.03), S.Y(1.03), 90 * k, k); barrel(c, S.X(0.97), S.Y(1.04), 82 * k, k);
    }, dyn(c, E, S, lay) {
      const k = S.k;
      if (E.rain > 0.1) for (let i = 0; i < 14; i++) {
        const ph = (E.t * 0.9 + i * 0.37 + hash1(i) * 4) % 1, x = S.X(0.04 + hash1(i * 3.1) * 0.92), y = S.Y(0.76 + hash1(i * 7.7) * 0.22), rr = (4 + ph * 22) * k * (0.5 + (y / S.h));
        c.strokeStyle = `rgba(200,215,228,${(1 - ph) * 0.4 * E.rain})`; c.lineWidth = 1.2 * k; c.beginPath(); c.ellipse(x, y, rr, rr * 0.22, 0, 0, TAU); c.stroke();
      }
      const walk = [[0.035, 0.84, 'villager', 0], [0.03, 0.9, 'merchant', 3], [-0.028, 0.86, 'traveler', 1.4], [0.024, 0.93, 'mage', 5]];
      walk.forEach((w, i) => {
        const dir = w[0] > 0 ? 1 : -1, ph = ((E.t * Math.abs(w[0]) + i * 0.27) % 1), x = dir > 0 ? lerp(-60 * k, S.w * 1.1, ph) : lerp(S.w * 1.1, -60 * k, ph), y = S.Y(w[1]), h = lerp(110, 230, (w[1] - 0.8) / 0.15) * k;
        walker(c, x, y, h, E.t, i * 2, PAL.cloaks[(i * 3) % 9], { dir, type: w[2], pace: 5 });
      });
    } }
  ]
});

/* ═══════════════════════ 4 · ADVENTURER'S GUILD · night ═══════════════════════ */
SCENES.push({
  id: 'guild', focus: [0.5, 0.55], pan: 1, hz: 0.62,
  layers: [
    { d: 0.04, fog: 0.2, paint(c, S, r) {
      ridge(c, S, r, { base: 0.58, amp: 0.1, rough: 0.5, sharp: true, freq: 2, col: '#6a7f98', colBot: '#7d90a6', facets: 10 });
      skyline(c, S, r, { cx: S.X(0.78), base: S.Y(0.64), sc: 0.58, pal: SKY_PAL });
      skyline(c, S, r, { cx: S.X(0.18), base: S.Y(0.64), sc: 0.4, pal: SKY_PAL });
    } },
    { d: 0.2, fog: 0.1, smoke: true, paint(c, S, r) {
      const k = S.k;
      for (let x = -S.ox * 0.2; x < S.W; x += (180 + r() * 80) * k) facade(c, S, r, x, S.Y(0.71), (150 + r() * 90) * k, (150 + r() * 80) * k, { floors: 2, base: 0, litP: 0.6, door: false, shutter: null });
    } },
    { d: 0.45, fog: 0.03, mot: 360, paint(c, S, r) {
      const k = S.k, gy = S.Y(0.745), cx = S.X(0.5);
      const fc = facade(c, S, r, cx, gy, 700 * k, 470 * k, { floors: 3, wall: '#a69d8f', roof: '#58525e', roofH: 290 * k, litP: 0.9, k: 1.2, door: false, base: 130 * k, stone: '#8d877b', ov: 36 * k, shutter: null, reflect: true });
      emblem(c, cx, fc.top + 150 * k, 66 * k);
      const dw = 150 * k, dh = 215 * k;
      c.fillStyle = tone('#a69d8f', 0.0); c.fillRect(cx - dw / 2 - 20 * k, gy - dh - 20 * k, dw + 40 * k, dh + 20 * k);
      c.fillStyle = '#2d2420'; c.beginPath(); c.moveTo(cx - dw / 2, gy); c.lineTo(cx - dw / 2, gy - dh * 0.72); c.quadraticCurveTo(cx, gy - dh * 1.25, cx + dw / 2, gy - dh * 0.72); c.lineTo(cx + dw / 2, gy); c.closePath(); c.fill();
      S.lights.push({ kind: 'door', x: cx - dw / 2 + 8 * k, y: gy - dh * 0.98, w: dw - 16 * k, h: dh * 0.98, k: 1.3, ph: r(), gy });
      [-1, 1].forEach(sd => { const tx = cx + sd * (dw / 2 + 36 * k); c.fillStyle = '#2f2824'; c.fillRect(tx - 3 * k, gy - 170 * k, 6 * k, 38 * k); S.lights.push({ kind: 'fire', x: tx - 8 * k, y: gy - 198 * k, w: 16 * k, h: 16 * k, r: 8 * k, k: 1.2, ph: r(), gy }); banner(c, cx + sd * 280 * k, gy - 440 * k, 62 * k, 220 * k, sd < 0 ? '#7a4d4a' : '#4d5f7a'); });
      // quest board
      const bx = S.X(0.15), by = gy - 230 * k, notes = [];
      c.fillStyle = '#4a3a2e'; c.fillRect(bx - 100 * k, by + 100 * k, 8 * k, 130 * k); c.fillRect(bx + 92 * k, by + 100 * k, 8 * k, 130 * k);
      c.fillStyle = '#6b5240'; c.fillRect(bx - 110 * k, by - 10 * k, 220 * k, 150 * k); c.fillStyle = '#7d634c'; c.fillRect(bx - 102 * k, by - 2 * k, 204 * k, 134 * k);
      for (let i = 0; i < 12; i++) notes.push({ x: bx - 92 * k + (i % 4) * 48 * k + r() * 8 * k, y: by + 6 * k + Math.floor(i / 4) * 40 * k + r() * 6 * k, w: 30 * k, h: 34 * k, ph: r() * 6 });
      S.out.notes = notes;
      S.lights.push({ kind: 'lamp', x: bx - 6 * k, y: by - 40 * k, w: 12 * k, h: 12 * k, r: 6 * k, k: 1, ph: r(), gy: 0 }); c.strokeStyle = '#2f2b2e'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(bx, by - 10 * k); c.lineTo(bx, by - 34 * k); c.stroke();
      // training yard
      const yx = S.X(0.86);
      c.strokeStyle = '#5a4637'; c.lineWidth = 5 * k; for (let i = 0; i < 6; i++) { const fx = yx - 170 * k + i * 56 * k; c.beginPath(); c.moveTo(fx, gy); c.lineTo(fx, gy - 70 * k); c.stroke(); } c.beginPath(); c.moveTo(yx - 175 * k, gy - 55 * k); c.lineTo(yx + 115 * k, gy - 55 * k); c.moveTo(yx - 175 * k, gy - 28 * k); c.lineTo(yx + 115 * k, gy - 28 * k); c.stroke();
      c.strokeStyle = '#4a3a2e'; c.lineWidth = 7 * k; c.beginPath(); c.moveTo(yx - 60 * k, gy - 10 * k); c.lineTo(yx - 60 * k, gy - 150 * k); c.stroke(); c.lineWidth = 5 * k; c.beginPath(); c.moveTo(yx - 90 * k, gy - 120 * k); c.lineTo(yx - 30 * k, gy - 120 * k); c.stroke();
      c.fillStyle = '#a58c64'; c.beginPath(); c.arc(yx - 60 * k, gy - 160 * k, 15 * k, 0, TAU); c.fill();
      c.strokeStyle = '#4a3a2e'; c.lineWidth = 6 * k; c.beginPath(); c.moveTo(yx + 40 * k, gy); c.lineTo(yx + 70 * k, gy - 90 * k); c.moveTo(yx + 100 * k, gy); c.lineTo(yx + 70 * k, gy - 90 * k); c.stroke(); c.fillStyle = '#d9cfae'; c.beginPath(); c.arc(yx + 70 * k, gy - 110 * k, 36 * k, 0, TAU); c.fill(); [28, 18, 8].forEach((rr, i) => { c.fillStyle = ['#a8574a', '#e8e0c6', '#a8574a'][i]; c.beginPath(); c.arc(yx + 70 * k, gy - 110 * k, rr * k, 0, TAU); c.fill(); });
    }, dyn(c, E, S, lay) {
      (lay.out.notes || []).forEach(n => { const a = Math.sin(E.t * 2.2 + n.ph) * 0.07 * (0.4 + E.wind); c.save(); c.translate(n.x + n.w / 2, n.y); c.rotate(a); c.fillStyle = '#e1d4b0'; c.fillRect(-n.w / 2, 0, n.w, n.h); c.fillStyle = 'rgba(70,52,40,.5)'; for (let i = 0; i < 4; i++) c.fillRect(-n.w / 2 + 4, 7 + i * 7, n.w - 8 - (i % 2) * 8, 2); c.restore(); });
      const door = lay.lights.find(l => l.kind === 'door'), ev = evt(E.t, 23, 7, 5);
      if (door) door.open = ev >= 0 ? Math.sin(ev * Math.PI) * 0.8 : 0;
      if (ev > 0.15 && ev < 0.9) { const q = (ev - 0.15) / 0.75, k = S.k, gy = S.Y(0.745), cx = S.X(0.5); c.save(); c.globalAlpha *= smooth(Math.min(q * 4, (1 - q) * 4)); walker(c, cx + (q - 0.5) * 20 * k, gy + (1 - q) * 70 * k, lerp(190, 130, q) * k, E.t, 2, '#4d5960', { front: true, away: true, type: 'knight', pace: 5 }); c.restore(); }
    } },
    { d: 0.78, fog: 0, ground: true, mot: 220, paint(c, S, r) {
      const k = S.k, top = S.Y(0.732), cx = S.X(0.5);
      c.fillStyle = vgrad(c, top, S.H, '#6c7080', '#4b4f5e'); c.fillRect(0, top, S.W, S.H - top);
      cobbles(c, S, r, cx, S.Y(0.74), S.H, S.W * 0.52, S.W * 0.52, '#777a88', 34);
      c.fillStyle = vgrad(c, top, top + 40 * k, 'rgba(18,20,34,.4)', 'rgba(18,20,34,0)'); c.fillRect(0, top, S.W, 40 * k);
      [[0.5, 0.82, 200, 18], [0.3, 0.95, 220, 22], [0.72, 0.9, 150, 14]].forEach(a => puddle(c, S.X(a[0]), S.Y(a[1]), a[2] * k, a[3] * k, r));
      const rx = S.X(0.3), ry = S.Y(0.9); c.fillStyle = '#5a4637'; c.fillRect(rx - 110 * k, ry - 70 * k, 220 * k, 9 * k); c.fillRect(rx - 108 * k, ry - 70 * k, 9 * k, 70 * k); c.fillRect(rx + 99 * k, ry - 70 * k, 9 * k, 70 * k);
      lampPost(c, S, S.X(0.07), S.Y(0.9), 250 * k, S.lights, r, true); lampPost(c, S, S.X(0.95), S.Y(0.88), 240 * k, S.lights, r, true);
      barrel(c, S.X(0.55), S.Y(0.99), 70 * k, k); barrel(c, S.X(0.6), S.Y(1.02), 60 * k, k);
    }, dyn(c, E, S, lay) {
      const k = S.k, rx = S.X(0.3), ry = S.Y(0.9);
      horse(c, rx - 150 * k, ry + 8 * k, 190 * k, 1, E.t, '#5d4a3c', { gait: 0 }); horse(c, rx + 130 * k, ry + 12 * k, 180 * k, -1, E.t, '#8a7a68', { gait: 0 });
      walker(c, S.X(0.17), S.Y(0.86), 200 * k, E.t, 0, '#5a4a40', { dir: -1, type: 'traveler', pace: 0 });
      [[22, 0.84, 'knight', 0.1], [18, 0.88, 'mage', 0.35], [-20, 0.92, 'traveler', 0.6], [26, 0.9, 'villager', 0.8]].forEach((a, i) => {
        const dir = a[0] > 0 ? 1 : -1, ph = (E.t * Math.abs(a[0]) / (S.w + 400) + a[3]) % 1, x = dir > 0 ? lerp(-200, S.w + 200, ph) : lerp(S.w + 200, -200, ph);
        walker(c, x, S.Y(a[1]), lerp(150, 220, (a[1] - 0.8) / 0.15) * k, E.t, i * 2, PAL.cloaks[(i * 2 + 1) % 9], { dir, type: a[2], pace: 5 });
      });
    } }
  ]
});

/* ═══════════════════════ 5 · FOREST ROAD · late night ═══════════════════════ */
function forestRoad(S) {
  const p = [[0.5, 1.07], [0.28, 0.9], [0.7, 0.76], [0.5, 0.61]];
  return s => {
    const m = 1 - s, f = (a, b, c2, d) => m * m * m * a + 3 * m * m * s * b + 3 * m * s * s * c2 + s * s * s * d;
    return { x: S.X(f(p[0][0], p[1][0], p[2][0], p[3][0])), y: S.Y(f(p[0][1], p[1][1], p[2][1], p[3][1])), w: S.w * (0.27 * Math.pow(1 - s, 2.2) + 0.014) };
  };
}
function deer(c, x, y, s, dir, t, col) {
  horse(c, x, y, s, dir, t, col, { gait: 6 });
  c.save(); c.translate(x, y); c.scale(dir, 1); c.strokeStyle = tone(col, -0.4); c.lineWidth = s * 0.025; c.lineCap = 'round';
  [[0.46, -1.05], [0.5, -1.05]].forEach((a, i) => { c.beginPath(); c.moveTo(s * a[0], s * a[1]); c.lineTo(s * (a[0] - 0.08 + i * 0.1), s * (a[1] - 0.22)); c.lineTo(s * (a[0] - 0.14 + i * 0.1), s * (a[1] - 0.34)); c.moveTo(s * (a[0] - 0.08 + i * 0.1), s * (a[1] - 0.22)); c.lineTo(s * (a[0] + 0.02 + i * 0.1), s * (a[1] - 0.36)); c.stroke(); });
  c.restore();
}
function fern(c, x, y, s, col, rnd) {
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.28 + (rnd() - 0.5) * 0.1, l = s * (0.7 + rnd() * 0.5);
    c.strokeStyle = tone(col, (rnd() - 0.5) * 0.3); c.lineWidth = Math.max(1, s * 0.025);
    const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l * 0.9 + l * 0.25;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.9 - l * 0.1, ex, ey); c.stroke();
    for (let j = 1; j < 8; j++) { const t = j / 8, lx = lerp(x, ex, t), ly = lerp(y, ey, t) - Math.sin(t * Math.PI) * l * 0.12, ll = s * 0.16 * (1 - t * 0.6); c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx - ll, ly + ll * 0.5); c.moveTo(lx, ly); c.lineTo(lx + ll, ly + ll * 0.5); c.stroke(); }
  }
}
function trunk(c, S, rnd, x, y0, y1, w, col) {
  c.fillStyle = (() => { const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, tone(col, 0.14)); g.addColorStop(0.55, tone(col, 0)); g.addColorStop(1, tone(col, -0.3)); return g; })();
  c.beginPath(); c.moveTo(x - w * 0.62, y1); c.quadraticCurveTo(x - w * 0.5, (y0 + y1) / 2, x - w * 0.42, y0); c.lineTo(x + w * 0.42, y0); c.quadraticCurveTo(x + w * 0.5, (y0 + y1) / 2, x + w * 0.62, y1); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(20,18,26,.22)'; c.lineWidth = Math.max(1, w * 0.02);
  for (let i = 0; i < 14; i++) { const xx = x + (rnd() - 0.5) * w * 0.8; c.beginPath(); c.moveTo(xx, y0); c.bezierCurveTo(xx + (rnd() - 0.5) * w * 0.1, y0 + (y1 - y0) * 0.4, xx - (rnd() - 0.5) * w * 0.1, y0 + (y1 - y0) * 0.7, xx + (rnd() - 0.5) * w * 0.15, y1); c.stroke(); }
}
SCENES.push({
  id: 'forest', focus: [0.5, 0.6], pan: 1, hz: 0.6,
  layers: [
    { d: 0.04, fog: 0.2, paint(c, S, r) {
      ridge(c, S, r, { base: 0.5, amp: 0.1, rough: 0.5, sharp: true, freq: 2, col: '#5a738c', colBot: '#6d849a', snow: 0.03 });
      const f = ridge(c, S, r, { base: 0.585, amp: 0.04, rough: 0.55, freq: 3, col: '#4b6670', colBot: '#587480' });
      treeLine(c, S, r, f, { size: 56, dens: 0.8, cols: ['#425d66', '#4a6670', '#3d5860'], dy: 6 });
    } },
    { d: 0.14, fog: 0.15, paint(c, S, r) {
      const f = ridge(c, S, r, { base: 0.63, amp: 0.025, rough: 0.5, freq: 3, col: '#33504c', colBot: '#2f4a46' });
      treeLine(c, S, r, f, { size: 120, dens: 0.8, cols: ['#2f4b49', '#35544f', '#2a4542'], dy: 8, broad: 0.1 });
      const f2 = ridge(c, S, r, { base: 0.66, amp: 0.02, rough: 0.5, freq: 4, col: '#2e4844', colBot: '#2b423f' });
      treeLine(c, S, r, f2, { size: 160, dens: 0.55, cols: ['#2b4643', '#31504b'], dy: 8 });
    }, dyn(c, E, S) {
      if (E.night > 0.6) for (let i = 0; i < 3; i++) bird(c, S.w * (0.3 + 0.2 * Math.sin(E.t * 0.2 + i * 2) + i * 0.15), S.h * (0.3 + 0.08 * Math.sin(E.t * 0.9 + i * 3)), 4 * S.k, E.t * 1.6, i * 1.3, 'rgba(10,14,24,.8)');
    } },
    { d: 0.3, fog: 0.12, mot: 300, paint(c, S, r) {
      const k = S.k, cx = S.X(0.5), gy = S.Y(0.625);
      c.fillStyle = vgrad(c, S.Y(0.6), S.Y(0.7), '#3c5446', '#34503f'); c.fillRect(0, S.Y(0.617), S.W, S.H);
      // ruined arch, statue, fallen blocks
      const st = '#8a8e92';
      [-1, 1].forEach(sd => { c.fillStyle = vgrad(c, gy - 210 * k, gy, tone(st, 0.1), tone(st, -0.2)); c.fillRect(cx + sd * 78 * k - 20 * k, gy - (sd < 0 ? 210 : 150) * k, 40 * k, (sd < 0 ? 210 : 150) * k); blocks(c, r, cx + sd * 78 * k - 20 * k, gy - (sd < 0 ? 210 : 150) * k, 40 * k, (sd < 0 ? 210 : 150) * k, st, 40 * k, 20 * k, 0.3); });
      c.strokeStyle = tone(st, 0.02); c.lineWidth = 40 * k; c.beginPath(); c.arc(cx, gy - 210 * k, 78 * k, Math.PI, Math.PI * 1.62); c.stroke();
      c.lineWidth = 3 * k; c.strokeStyle = 'rgba(20,24,34,.35)'; c.beginPath(); c.arc(cx, gy - 210 * k, 78 * k, Math.PI, Math.PI * 1.62); c.stroke();
      for (let i = 0; i < 70; i++) { const side = r() < 0.5 ? -1 : 1, yy = gy - r() * (side < 0 ? 215 : 150) * k; c.fillStyle = hx('#4f7a4a', 0.35 + r() * 0.3); c.beginPath(); c.arc(cx + side * 78 * k + (r() - 0.5) * 46 * k, yy, (3 + r() * 6) * k, 0, TAU); c.fill(); }
      const sx = cx + 210 * k; c.fillStyle = tone(st, -0.1); c.fillRect(sx - 26 * k, gy - 46 * k, 52 * k, 46 * k); c.fillStyle = tone(st, 0); c.beginPath(); c.moveTo(sx - 20 * k, gy - 46 * k); c.lineTo(sx - 26 * k, gy - 120 * k); c.quadraticCurveTo(sx, gy - 150 * k, sx + 26 * k, gy - 120 * k); c.lineTo(sx + 20 * k, gy - 46 * k); c.closePath(); c.fill(); c.beginPath(); c.arc(sx, gy - 135 * k, 13 * k, 0, TAU); c.fill(); c.fillStyle = hx('#4f7a4a', 0.6); c.beginPath(); c.arc(sx - 15 * k, gy - 100 * k, 10 * k, 0, TAU); c.fill();
      for (let i = 0; i < 6; i++) { c.fillStyle = tone(st, (r() - 0.5) * 0.2); c.fillRect(cx - 190 * k + r() * 360 * k, gy - (5 + r() * 14) * k, (22 + r() * 22) * k, (10 + r() * 14) * k); }
      for (let i = 0; i < 46; i++) { const u = r(); if (u > 0.4 && u < 0.6) continue; const x = S.X(-0.05 + u * 1.1), y = S.Y(0.63 + r() * 0.05), hh = (160 + r() * 260) * k; if (r() < 0.25) broadleaf(c, x, y, hh * 0.32, pick(r, ['#2f4b3a', '#34523f']), r); else conifer(c, x, y, hh, pick(r, ['#2c4642', '#33504a', '#29433f', '#263f3b']), r); }
    }, glow(c, E, S) {
      if (E.night < 0.5) return;
      const a = smooth((E.night - 0.5) / 0.4) * (1 - E.overcast * 0.6) * (0.7 + 0.3 * Math.sin(E.t * 0.3));
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) { const x0 = S.X(0.18 + i * 0.2), g = c.createLinearGradient(x0, 0, x0 + S.w * 0.1, S.Y(0.7)); g.addColorStop(0, `rgba(170,195,255,${0.1 * a})`); g.addColorStop(1, 'rgba(170,195,255,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + S.w * 0.05, 0); c.lineTo(x0 + S.w * 0.2, S.Y(0.7)); c.lineTo(x0 + S.w * 0.09, S.Y(0.7)); c.closePath(); c.fill(); }
      c.restore();
    }, dyn(c, E, S) {
      const k = S.k, q = (E.local - 0.26) / 0.3;
      if (q > 0 && q < 1) deer(c, lerp(-S.w * 0.1, S.w * 1.15, q), S.Y(0.664), 120 * k, 1, E.t, '#6e5a48');
    } },
    { d: 0.65, fog: 0.03, mot: 320, paint(c, S, r) {
      const k = S.k, rc = forestRoad(S);
      c.fillStyle = vgrad(c, S.Y(0.61), S.H, '#3f5a43', '#2d4535'); c.beginPath(); c.moveTo(0, S.Y(0.615)); for (let x = 0; x <= S.W; x += 30) c.lineTo(x, S.Y(0.612) + Math.sin(x * 0.01) * 4 * k); c.lineTo(S.W, S.H); c.lineTo(0, S.H); c.closePath(); c.fill();
      const L = [], R = [], n = 40;
      for (let i = 0; i <= n; i++) { const s = i / n, q = rc(s); L.push([q.x - q.w / 2, q.y]); R.push([q.x + q.w / 2, q.y]); }
      c.fillStyle = vgrad(c, S.Y(0.6), S.H, '#7f7561', '#6a6152'); c.beginPath(); L.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); R.slice().reverse().forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fill();
      c.save(); c.clip();
      [-0.2, 0.2].forEach(o => { c.strokeStyle = 'rgba(40,34,30,.25)'; c.beginPath(); for (let i = 0; i <= n; i++) { const s = i / n, q = rc(s); c.lineWidth = Math.max(1, q.w * 0.07); i ? c.lineTo(q.x + o * q.w, q.y) : c.moveTo(q.x + o * q.w, q.y); } c.stroke(); });
      for (let i = 0; i < 80; i++) { const q = rc(Math.pow(r(), 1.3) * 0.95); c.fillStyle = tone('#8a8070', (r() - 0.5) * 0.3, 0.6); c.beginPath(); c.ellipse(q.x + (r() - 0.5) * q.w * 0.9, q.y, q.w * 0.02 + 1, q.w * 0.01 + 0.6, 0, 0, TAU); c.fill(); }
      c.restore();
      c.fillStyle = vgrad(c, S.Y(0.6), S.Y(0.66), 'rgba(18,28,24,.35)', 'rgba(18,28,24,0)'); c.fillRect(0, S.Y(0.6), S.W, S.Y(0.06));
      // big trees framing the road
      [[0.3, 90], [0.7, 100], [0.18, 130], [0.84, 140]].forEach(a => trunk(c, S, r, S.X(a[0]), -30, S.Y(0.74 + (a[1] % 7) * 0.003), a[1] * k, '#3e4048'));
      conifer(c, S.X(0.12), S.Y(0.84), 560 * k, '#2a443f', r); conifer(c, S.X(0.9), S.Y(0.82), 520 * k, '#2c4741', r);
      for (let i = 0; i < 18; i++) { const side = r() < 0.5 ? -1 : 1, x = side < 0 ? S.X(r() * 0.42) : S.X(0.58 + r() * 0.45), y = S.Y(0.7 + r() * 0.26); c.fillStyle = tone('#2e4a38', (r() - 0.5) * 0.3); c.beginPath(); c.ellipse(x, y, (30 + r() * 60) * k, (16 + r() * 26) * k, 0, 0, TAU); c.fill(); }
      broadleaf(c, S.X(0.04), S.Y(0.9), 150 * k, '#35523f', r); broadleaf(c, S.X(0.97), S.Y(0.92), 160 * k, '#31503c', r);
      for (let i = 0; i < 16; i++) { const q = rc(0.1 + r() * 0.8), side = r() < 0.5 ? -1 : 1; fern(c, q.x + side * (q.w * 0.7 + r() * 90 * k), q.y + 4 * k, (30 + (1 - 0.0) * r() * 60) * k * (q.w / (S.w * 0.2) + 0.4), '#3f6a4a', r); }
      for (let i = 0; i < 14; i++) { const q = rc(0.05 + r() * 0.7), side = r() < 0.5 ? -1 : 1, x = q.x + side * (q.w * 0.62 + r() * 140 * k), y = q.y + 6 * k, s = (5 + r() * 9) * k * (q.w / (S.w * 0.2) + 0.5); c.fillStyle = '#d6cbb0'; c.fillRect(x - s * 0.18, y - s * 0.8, s * 0.36, s * 0.8); c.fillStyle = pick(r, ['#b9563f', '#c9a85a', '#8a6a9a']); c.beginPath(); c.ellipse(x, y - s * 0.85, s * 0.7, s * 0.4, 0, Math.PI, 0); c.fill(); }
      c.fillStyle = vgrad(c, S.Y(0.9), S.Y(0.96), '#5a4a3a', '#43372c'); c.beginPath(); c.moveTo(S.X(0.62), S.Y(0.93)); c.lineTo(S.X(0.88), S.Y(0.92)); c.lineTo(S.X(0.89), S.Y(0.97)); c.lineTo(S.X(0.62), S.Y(0.98)); c.closePath(); c.fill(); c.fillStyle = '#7a6a54'; c.beginPath(); c.ellipse(S.X(0.89), S.Y(0.945), 12 * k, 25 * k, 0, 0, TAU); c.fill();
      grassBlades(c, S, r, 0, S.W, S.Y(1.0), 14, 46, 200, '#3c5e42');
    }, dyn(c, E, S) {
      const k = S.k, rc = forestRoad(S);
      const q = (E.local - 0.55) / 0.42;
      if (q > 0 && q < 1) { const s = lerp(0.9, 0.38, smooth(q)), p = rc(s), h = p.w * 0.55, x = p.x + p.w * 0.1, y = p.y; c.save(); c.globalAlpha *= smooth(Math.min(q * 6, (1 - q) * 6)); walker(c, x, y, h, E.t, 0, '#4d4a58', { front: true, type: 'traveler', pace: 3 }); c.restore(); }
      for (let m = 0; m < 4; m++) { const x = ((E.t * (5 + m * 2) + m * 500) % (S.w + 900)) - 450; soft(c, E.mistSprite, x, S.Y(0.72 + m * 0.08), S.w * 0.75, S.h * 0.1, E.mist * 0.55); }
    }, glow(c, E, S) {
      const rc = forestRoad(S), q = (E.local - 0.55) / 0.42;
      if (q > 0 && q < 1) { const s = lerp(0.9, 0.38, smooth(q)), p = rc(s), x = p.x + p.w * 0.1 + p.w * 0.1, y = p.y - p.w * 0.3, r = p.w * 0.9, a = smooth(Math.min(q * 6, (1 - q) * 6)); const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,190,100,${0.6 * a})`); g.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.fillStyle = `rgba(255,236,190,${a})`; c.beginPath(); c.arc(x, y, Math.max(1.5, p.w * 0.03), 0, TAU); c.fill(); }
    } },
    { d: 1.1, fog: 0, mot: 140, paint(c, S, r) {
      const k = S.k;
      trunk(c, S, r, S.X(-0.02), -20, S.Y(1.04), 230 * k, '#3a3a40'); trunk(c, S, r, S.X(1.04), -20, S.Y(1.04), 260 * k, '#363840');
      canopyCorner(c, S, r, S.X(0.08), S.Y(-0.02), 300 * k, '#28402f', 18); canopyCorner(c, S, r, S.X(0.92), S.Y(-0.03), 320 * k, '#263e2e', 18); canopyCorner(c, S, r, S.X(0.5), S.Y(-0.12), 220 * k, '#243a2c', 12);
      fern(c, S.X(0.09), S.Y(1.0), 150 * k, '#2f5a3c', r); fern(c, S.X(0.93), S.Y(1.0), 160 * k, '#2d5738', r); fern(c, S.X(0.2), S.Y(1.03), 110 * k, '#2f5a3c', r);
      c.fillStyle = vgrad(c, S.Y(0.9), S.Y(1), 'rgba(24,40,32,0)', 'rgba(24,40,32,.45)'); c.fillRect(0, S.Y(0.9), S.W, S.H);
    }, glow(c, E, S) {
      const a = smooth((E.night - 0.3) / 0.5) * (1 - E.rain * 0.7); if (a < 0.02) return;
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 34; i++) {
        const bx = hash1(i * 3.3), by = hash1(i * 5.9), x = S.X(0.03 + bx * 0.94) + Math.sin(E.t * 0.4 + i) * 40 * S.k, y = S.Y(0.5 + by * 0.46) + Math.cos(E.t * 0.5 + i * 2) * 24 * S.k, p = 0.5 + 0.5 * Math.sin(E.t * (1.2 + hash1(i) * 1.5) + i * 7), r = (3 + hash1(i * 9) * 4) * S.k;
        const g = c.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, `rgba(220,255,150,${0.75 * p * a})`); g.addColorStop(1, 'rgba(180,230,120,0)'); c.fillStyle = g; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
      }
      c.restore();
    } }
  ]
});

/* ═══════════════════════ 6 · RIVER & RUINS · dawn ═══════════════════════ */
SCENES.push({
  id: 'river', focus: [0.5, 0.6], pan: 1, hz: 0.62,
  layers: [
    { d: 0.03, fog: 0.14, paint(c, S, r) {
      ridge(c, S, r, { base: 0.52, amp: 0.2, rough: 0.5, sharp: true, freq: 1.7, col: '#6f8aa2', colBot: '#9bb0bb', snow: 0.05, facets: 20 });
      skyline(c, S, r, { cx: S.X(0.14), base: S.Y(0.585), sc: 0.3, pal: SKY_PAL });
      const f = ridge(c, S, r, { base: 0.6, amp: 0.04, rough: 0.55, freq: 3, col: '#627f7c', colBot: '#7d9a90' });
      treeLine(c, S, r, f, { size: 38, dens: 0.45, cols: ['#55726f', '#5d7a76'], dy: 4 });
    } },
    { d: 0.14, fog: 0.12, paint(c, S, r) {
      const f = ridge(c, S, r, { base: 0.625, amp: 0.025, rough: 0.5, freq: 3, col: '#5b7a6c', colBot: '#6d8a78' });
      treeLine(c, S, r, f, { size: 90, dens: 0.6, cols: ['#4f6f62', '#587868', '#496a5d'], dy: 6, broad: 0.25 });
    } },
    { d: 0.28, fog: 0.08, mot: 300, paint(c, S, r) {
      const k = S.k, gy = S.Y(0.675);
      const bank = ridge(c, S, r, { base: 0.665, amp: 0.012, rough: 0.5, freq: 3, col: '#72906a', colBot: '#5f7e5a' });
      c.fillStyle = vgrad(c, S.Y(0.65), S.Y(0.69), '#6c8a66', '#4f6e54'); c.fillRect(0, S.Y(0.665), S.W, S.Y(0.04));
      const tx = S.X(0.7), st = '#a8a296';
      c.fillStyle = vgrad(c, gy - 240 * k, gy, tone(st, 0.1), tone(st, -0.22));
      c.beginPath(); c.moveTo(tx - 50 * k, gy); c.lineTo(tx - 50 * k, gy - 300 * k); c.lineTo(tx - 34 * k, gy - 340 * k); c.lineTo(tx - 14 * k, gy - 305 * k); c.lineTo(tx + 6 * k, gy - 352 * k); c.lineTo(tx + 26 * k, gy - 280 * k); c.lineTo(tx + 50 * k, gy - 300 * k); c.lineTo(tx + 50 * k, gy); c.closePath(); c.fill();
      blocks(c, r, tx - 50 * k, gy - 340 * k, 100 * k, 340 * k, st, 30 * k, 17 * k, 0.28);
      c.fillStyle = '#30343e'; c.beginPath(); c.moveTo(tx - 12 * k, gy - 150 * k); c.lineTo(tx - 12 * k, gy - 210 * k); c.arc(tx, gy - 210 * k, 12 * k, Math.PI, 0); c.lineTo(tx + 12 * k, gy - 150 * k); c.closePath(); c.fill();
      c.fillStyle = vgrad(c, gy - 100 * k, gy, tone(st, 0.05), tone(st, -0.2)); c.beginPath(); c.moveTo(tx + 50 * k, gy); c.lineTo(tx + 50 * k, gy - 80 * k); c.lineTo(tx + 84 * k, gy - 94 * k); c.lineTo(tx + 120 * k, gy - 60 * k); c.lineTo(tx + 150 * k, gy - 66 * k); c.lineTo(tx + 150 * k, gy); c.closePath(); c.fill();
      c.fillStyle = '#30343e'; c.beginPath(); c.moveTo(tx + 80 * k, gy); c.lineTo(tx + 80 * k, gy - 44 * k); c.arc(tx + 98 * k, gy - 44 * k, 18 * k, Math.PI, 0); c.lineTo(tx + 116 * k, gy); c.closePath(); c.fill();
      for (let i = 0; i < 110; i++) { const x = tx - 70 * k + r() * 240 * k, y = gy - r() * r() * 330 * k; c.fillStyle = hx(pick(r, ['#4f7a4a', '#5d8a52', '#456b44']), 0.4 + r() * 0.4); c.beginPath(); c.arc(x, y, (2 + r() * 6) * k, 0, TAU); c.fill(); }
      for (let i = 0; i < 7; i++) { c.fillStyle = tone(st, (r() - 0.5) * 0.2); c.fillRect(tx - 120 * k + r() * 340 * k, gy - (4 + r() * 10) * k, (14 + r() * 20) * k, (8 + r() * 10) * k); }
      [[0.1, 0.675, 130], [0.3, 0.67, 110], [0.5, 0.67, 95], [0.95, 0.675, 120]].forEach(a => {
        const x = S.X(a[0]), y = S.Y(a[1]), s = a[2] * k;
        c.fillStyle = tone('#5a4a3a', -0.1); c.fillRect(x - s * 0.08, y - s * 1.1, s * 0.16, s * 1.1);
        for (let i = 0; i < 60; i++) { const ang = r() * TAU, d = s * (0.3 + r() * 0.7), sx = x + Math.cos(ang) * d * 0.9, top = y - s * 1.2 + Math.sin(ang) * d * 0.3; c.strokeStyle = tone('#7a9a58', (r() - 0.5) * 0.4, 0.55); c.lineWidth = Math.max(1, s * 0.012); c.beginPath(); c.moveTo(x + Math.cos(ang) * d * 0.25, y - s * 1.2); c.quadraticCurveTo(sx, top, sx + (r() - 0.5) * s * 0.1, y - s * (0.2 + r() * 0.5)); c.stroke(); }
      });
    }, dyn(c, E, S) { for (let i = 0; i < 3; i++) bird(c, ((E.t * (18 + i * 3) + i * 400) % (S.w + 200)) - 100, S.h * (0.25 + i * 0.04) + Math.sin(E.t + i) * 9, 5 * S.k, E.t, i * 1.9, 'rgba(60,66,78,.6)'); } },
    { d: 0.5, fog: 0.03, mot: 340, paint(c, S, r) {
      const k = S.k, wl = S.Y(0.71), yb = S.Y(0.668), hump = 34 * k, st = '#aaa398';
      const deck = u => yb - hump * (1 - Math.pow(2 * u - 1, 2)), x0 = -S.ox * 0.2, x1 = S.W * 1.02, X = u => lerp(x0, x1, u);
      c.beginPath(); c.moveTo(X(0), wl + 6 * k); for (let i = 0; i <= 60; i++) c.lineTo(X(i / 60), deck(i / 60)); c.lineTo(X(1), wl + 6 * k); c.closePath();
      c.fillStyle = vgrad(c, yb - hump, wl, tone(st, 0.1), tone(st, -0.22)); c.fill();
      c.save(); c.clip(); blocks(c, r, 0, yb - hump, S.W, wl - yb + hump, st, 34 * k, 20 * k, 0.4);
      [[0.2, 80], [0.5, 105], [0.8, 80]].forEach(a => { const ax = X(a[0]), ar = a[1] * k; c.fillStyle = vgrad(c, wl - ar, wl, '#1f3236', '#7d9a9a'); c.beginPath(); c.moveTo(ax - ar, wl + 4); c.lineTo(ax - ar, wl - ar * 0.4); c.ellipse(ax, wl - ar * 0.4, ar, ar * 0.85, 0, Math.PI, 0); c.lineTo(ax + ar, wl + 4); c.closePath(); c.fill(); c.strokeStyle = 'rgba(30,34,44,.4)'; c.lineWidth = 5 * k; c.stroke(); });
      c.restore();
      c.strokeStyle = tone(st, -0.1); c.lineWidth = 26 * k; c.beginPath(); for (let i = 0; i <= 60; i++) { const x = X(i / 60), y = deck(i / 60) - 14 * k; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      c.strokeStyle = tone(st, 0.12); c.lineWidth = 6 * k; c.beginPath(); for (let i = 0; i <= 60; i++) { const x = X(i / 60), y = deck(i / 60) - 27 * k; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      [0.04, 0.32, 0.68, 0.96].forEach(u => { c.fillStyle = tone(st, -0.05); c.fillRect(X(u) - 12 * k, deck(u) - 52 * k, 24 * k, 40 * k); });
      [0.32, 0.68].forEach(u => { const x = X(u), y = deck(u) - 100 * k; c.fillStyle = '#2f2b2e'; c.fillRect(x - 3 * k, y, 6 * k, 50 * k); c.fillRect(x - 8 * k, y - 18 * k, 16 * k, 20 * k); S.lights.push({ kind: 'lamp', x: x - 6 * k, y: y - 16 * k, w: 12 * k, h: 12 * k, r: 5 * k, k: 0.9, ph: r(), gy: 0 }); });
      for (let i = 0; i < 60; i++) { c.fillStyle = hx('#5a7a52', 0.3 + r() * 0.3); c.beginPath(); c.ellipse(r() * S.W, wl - r() * 20 * k, (8 + r() * 16) * k, (3 + r() * 6) * k, 0, 0, TAU); c.fill(); }
      S.out.deck = { x0, x1, yb, hump };
    }, dyn(c, E, S, lay) {
      const k = S.k, d = lay.out.deck; if (!d) return;
      const deck = u => d.yb - d.hump * (1 - Math.pow(2 * u - 1, 2)), X = u => lerp(d.x0, d.x1, u);
      const u = ((E.t * 0.011 + 0.1) % 1.2) - 0.1, fade = smooth(Math.min(u + 0.05, 1.05 - u) / 0.1), y = deck(u) - 14 * k, x = X(u);
      c.save(); c.globalAlpha *= clamp(fade);
      cart(c, x, y, 120 * k, 1, E.t, { dist: E.t * 40 }); horse(c, x + 125 * k, y, 105 * k, 1, E.t, '#6b5648', { gait: 3.5 });
      walker(c, X(u + 0.1), deck(u + 0.1) - 14 * k, 80 * k, E.t, 1, '#4f6054', { dir: -1, type: 'traveler', pace: 4 }); c.restore();
    } },
    { d: 0.85, fog: 0, ground: true, mot: 200, paint(c, S, r) {
      const k = S.k, wl = S.Y(0.706);
      c.fillStyle = vgrad(c, wl, S.H, '#a9c0bc', '#2d5258'); c.fillRect(0, wl, S.W, S.H - wl);
      [[-1, 0], [1, 1]].forEach(a => {
        const sd = a[0], xe = sd < 0 ? 0 : S.W, xi = sd < 0 ? S.X(0.24) : S.X(0.8);
        c.fillStyle = vgrad(c, S.Y(0.8), S.H, '#3d5c42', '#2b4535'); c.beginPath(); c.moveTo(xe, S.Y(0.76)); c.quadraticCurveTo(lerp(xe, xi, 0.5), S.Y(0.86), xi, S.H); c.lineTo(xe, S.H); c.closePath(); c.fill();
      });
      for (let i = 0; i < 120; i++) { const side = r() < 0.5 ? -1 : 1, x = side < 0 ? r() * S.w * 0.28 + S.ox * 0.4 : S.W - r() * S.w * 0.28 - S.ox * 0.4, y = S.Y(0.88 + r() * 0.16), h = (60 + r() * 120) * k; c.strokeStyle = tone('#476a45', (r() - 0.5) * 0.4); c.lineWidth = (1.5 + r() * 2) * k; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (r() - 0.5) * 40 * k, y - h * 0.6, x + (r() - 0.5) * 70 * k, y - h); c.stroke(); if (r() < 0.25) { c.fillStyle = '#5a4030'; c.beginPath(); c.ellipse(x + (r() - 0.5) * 70 * k, y - h, 4 * k, 12 * k, 0, 0, TAU); c.fill(); } }
      const rx = S.X(0.07), ry = S.Y(0.9); c.fillStyle = vgrad(c, ry - 60 * k, ry, '#8a8a86', '#5e5e5e'); c.beginPath(); c.ellipse(rx, ry, 90 * k, 45 * k, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#4a5560'; c.beginPath(); c.ellipse(rx, ry - 80 * k, 24 * k, 16 * k, 0.1, 0, TAU); c.fill(); c.beginPath(); c.moveTo(rx - 14 * k, ry - 70 * k); c.quadraticCurveTo(rx - 40 * k, ry - 110 * k, rx - 20 * k, ry - 150 * k); c.lineTo(rx - 12 * k, ry - 148 * k); c.quadraticCurveTo(rx - 26 * k, ry - 110 * k, rx - 2 * k, ry - 78 * k); c.fill(); c.beginPath(); c.moveTo(rx - 20 * k, ry - 150 * k); c.lineTo(rx - 48 * k, ry - 142 * k); c.lineTo(rx - 22 * k, ry - 142 * k); c.fill();
      c.strokeStyle = '#3a3a40'; c.lineWidth = 2.4 * k; c.beginPath(); c.moveTo(rx - 4 * k, ry - 70 * k); c.lineTo(rx - 4 * k, ry - 10 * k); c.moveTo(rx + 8 * k, ry - 68 * k); c.lineTo(rx + 8 * k, ry - 10 * k); c.stroke();
    }, dyn(c, E, S, lay, rt) {
      const k = S.k, wl = S.Y(0.706), bm = rt.layers[3] && rt.layers[3].bm, q = S.q;
      if (bm) {
        c.save(); c.beginPath(); c.rect(0, wl, S.W, S.H - wl); c.clip();
        const sh = 14 * k;
        for (let j = 0; j < 14; j++) {
          c.save(); c.globalAlpha *= 0.38 * (1 - j / 14); c.translate(Math.sin(E.t * 1.4 + j * 0.9) * 5 * k, wl + j * sh); c.scale(1, -1);
          c.drawImage(bm, 0, (wl - (j + 1) * sh) * q, bm.width, sh * q, 0, -sh, S.W, sh); c.restore();
        }
        c.restore();
      }
      c.save(); c.lineCap = 'round';
      for (let i = 0; i < 46; i++) {
        const y = wl + (S.H - wl) * Math.pow(hash1(i * 2.3), 1.3), x = ((hash1(i * 5.1) * S.W + E.t * (4 + hash1(i) * 6)) % S.W), l = (14 + hash1(i * 9) * 60) * k * (0.4 + (y - wl) / (S.H - wl));
        c.strokeStyle = `rgba(255,246,226,${0.1 + 0.12 * Math.sin(E.t * 1.5 + i)})`; c.lineWidth = (1 + (y - wl) / S.h * 3) * k; c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.stroke();
      }
      c.restore();
      const fj = evt(E.t, 21, 1.6, 4);
      if (fj >= 0) { const fx = S.X(0.55), fy = S.Y(0.8), rr = (6 + fj * 50) * k; c.strokeStyle = `rgba(240,245,240,${(1 - fj) * 0.6})`; c.lineWidth = 2 * k; c.beginPath(); c.ellipse(fx, fy, rr, rr * 0.25, 0, 0, TAU); c.stroke(); const fh = Math.sin(fj * Math.PI) * 60 * k; c.fillStyle = '#c9d3d4'; c.beginPath(); c.ellipse(fx, fy - fh, 7 * k, 3.2 * k, -0.8 + fj * 1.6, 0, TAU); c.fill(); }
      [[0.4, 0.78, 6, 1], [0.46, 0.8, 8, -1], [0.62, 0.86, 7, 1]].forEach((a, i) => {
        const x = S.X(a[0]) + Math.sin(E.t * 0.2 + i * 2) * 60 * k + (E.t * 3 * a[3]) % 40, y = S.Y(a[1]) + Math.sin(E.t * 1.2 + i) * 1.5 * k, s = a[2] * k * 2.2;
        c.strokeStyle = 'rgba(240,248,245,.25)'; c.lineWidth = 1.5 * k; c.beginPath(); c.moveTo(x - s * 2.6 * a[3], y + s * 0.4); c.lineTo(x, y); c.lineTo(x - s * 2.6 * a[3], y - s * 0.1); c.stroke();
        c.fillStyle = '#6a5a48'; c.beginPath(); c.ellipse(x, y, s, s * 0.5, 0, 0, TAU); c.fill(); c.fillStyle = '#2f5a4a'; c.beginPath(); c.arc(x + s * 0.8 * a[3], y - s * 0.55, s * 0.45, 0, TAU); c.fill(); c.fillStyle = '#c9a548'; c.beginPath(); c.moveTo(x + s * 1.2 * a[3], y - s * 0.55); c.lineTo(x + s * 1.8 * a[3], y - s * 0.45); c.lineTo(x + s * 1.2 * a[3], y - s * 0.4); c.fill();
      });
      for (let m = 0; m < 4; m++) { const x = ((E.t * (4 + m * 1.5) + m * 600) % (S.w + 1000)) - 500; soft(c, E.mistSprite, x, S.Y(0.74 + m * 0.05), S.w * 0.85, S.h * 0.1, E.mist * 0.6); }
    }, glow(c, E, S) {
      const a = (1 - smooth(E.night / 0.6)) * (1 - E.overcast * 0.6), wl = S.Y(0.706), sx = S.X(E.P.sx * 0.9 + 0.05);
      if (a < 0.02) return;
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) { const y = wl + (S.H - wl) * Math.pow(i / 26, 1.25), w = (14 + (y - wl) * 0.35 + Math.sin(E.t * 1.7 + i) * 8) * S.k, jit = Math.sin(E.t * 0.9 + i * 1.7) * 10 * S.k; c.fillStyle = `rgba(255,214,150,${0.14 * a * (1 - i / 30)})`; c.fillRect(sx - w / 2 + jit, y, w, (S.H - wl) / 26 * 0.6); }
      c.restore();
    } }
  ]
});

/* ═════════════════════════ engine ═════════════════════════ */
function resize(st, c, w, h) {
  st.w = w; st.h = h;
  const k = Math.max(0.45, h / 1080), q = CFG.LAYER_SCALE;
  st.S = { w, h, W: Math.ceil(w * 1.2), H: h, ox: w * 0.1, q, k, lights: null, out: null, X(u) { return this.ox + u * this.w; }, Y(v) { return v * this.h; } };
  st.cache = {};
  let bs = 1; try { bs = clamp(c.getTransform().a || 1, 1, 2); } catch (e) { /* older browsers */ }
  st.baseBs = bs; st.qual = 1; st.ema = 0; st.slow = 0; makeBuffers(st);
}
function makeBuffers(st) {
  const bs = st.baseBs * st.qual, w = st.w, h = st.h;
  st.bs = bs; st.buf = makeCanvas(w * bs, h * bs); st.bctx = st.buf.getContext('2d');
  st.gb = [makeCanvas(w * bs, h * bs), makeCanvas(w * bs, h * bs)]; st.gctx = st.gb.map(x => x.getContext('2d'));
}

function buildLayer(st, idx, li) {
  const S = st.S, spec = SCENES[idx].layers[li];
  const cv = makeCanvas(S.W * S.q, S.H * S.q), c = cv.getContext('2d');
  c.scale(S.q, S.q);
  S.lights = []; S.out = { smoke: [], flags: [] };
  const rnd = mulberry(1000 * (idx + 1) + li * 37 + 7);
  spec.paint(c, S, rnd);
  mottle(c, S, rnd, spec.mot || 260);
  brush(c, S, rnd, spec.brush || 700);
  const cv2 = makeCanvas(cv.width, cv.height), c2 = cv2.getContext('2d');
  if ('filter' in c2) c2.filter = 'blur(0.7px)';
  c2.drawImage(cv, 0, 0);
  return { spec, bm: cv2, out: S.out, lights: S.lights };
}

function ensureScene(st, idx, budget) {
  const sc = SCENES[idx];
  const rt = st.cache[idx] || (st.cache[idx] = { layers: new Array(sc.layers.length).fill(null) });
  for (let li = 0; li < sc.layers.length && budget > 0; li++) if (!rt.layers[li]) { rt.layers[li] = buildLayer(st, idx, li); budget--; }
  return rt;
}

function layerXf(c, S, sc, d, Z, pan) {
  const s = 1 + (Z - 1) * (0.3 + 0.9 * d), fx = sc.focus[0] * S.w, fy = sc.focus[1] * S.h;
  c.translate(fx, fy); c.scale(s, s); c.translate(-fx - pan * S.w * 0.07 * (0.15 + d), -fy);
  c.translate(-S.ox, 0);
}

function renderScene(c, st, E, job, ji) {
  const rt = st.cache[job.idx], sc = SCENES[job.idx], S = st.S, b = st.bctx;
  if (!rt) return;
  const Es = Object.assign({}, E, { local: job.local });
  b.setTransform(st.bs, 0, 0, st.bs, 0, 0); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; b.clearRect(0, 0, E.w, E.h);
  job.any = false;
  const g = st.gctx[ji]; g.setTransform(st.bs, 0, 0, st.bs, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, E.w, E.h);
  for (let li = 0; li < sc.layers.length; li++) {
    const lay = rt.layers[li]; if (!lay) continue;
    b.save(); layerXf(b, S, sc, lay.spec.d, job.Z, job.pan);
    b.drawImage(lay.bm, 0, 0, S.W, S.H);
    if (lay.spec.dyn) lay.spec.dyn(b, Es, S, lay, rt);
    if (lay.spec.smoke) lay.out.smoke.forEach((sm, si) => smokeAt(b, Es, sm.x, sm.y, clamp(sm.s / (260 * S.k), 0.4, 1.1), S.k, si * 0.37, E.rain > 0.2 ? 1 : 0));
    b.restore();
    if (job.any) { g.save(); layerXf(g, S, sc, lay.spec.d, job.Z, job.pan); g.globalCompositeOperation = 'destination-out'; g.drawImage(lay.bm, 0, 0, S.W, S.H); g.restore(); }
    if ((E.lamp >= 0.03 && lay.lights.length) || lay.spec.glow) { job.any = true; g.save(); layerXf(g, S, sc, lay.spec.d, job.Z, job.pan); drawLights(g, Es, S, lay.lights); if (lay.spec.glow) lay.spec.glow(g, Es, S, lay, rt); g.restore(); }
    if (lay.spec.ground) for (let lj = 0; lj < li; lj++) { const l2 = rt.layers[lj]; if (!l2) continue; g.save(); layerXf(g, S, sc, l2.spec.d, job.Z, job.pan); drawReflections(g, Es, l2.lights); g.restore(); }
    if (lay.spec.fog) {
      const hz = sc.hz || 0.6, a = lay.spec.fog * (0.75 + E.P.mist * 0.5);
      b.globalCompositeOperation = 'source-atop';
      const g = b.createLinearGradient(0, 0, 0, E.h);
      g.addColorStop(0, css(E.P.haze, a * 0.45)); g.addColorStop(hz, css(E.P.haze, a)); g.addColorStop(1, css(E.P.haze, a * 0.35));
      b.fillStyle = g; b.fillRect(0, 0, E.w, E.h);
      b.globalCompositeOperation = 'source-over';
    }
  }
  c.save(); c.globalAlpha = job.alpha; c.drawImage(st.buf, 0, 0, E.w, E.h); c.restore();
}

function drawRain(c, E, st, w, h) {
  if (E.rain < 0.03) return;
  const n = Math.floor(st.drops.length * clamp(E.rain)), slant = 0.16 + E.wind * 0.12, k = E.k;
  c.save(); c.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    c.strokeStyle = `rgba(208,220,232,${(pass ? 0.3 : 0.18) * (1 - 0.5 * E.P.night) * Math.min(1, E.rain * 1.3)})`;
    c.lineWidth = (pass ? 1.3 : 0.8) * k; c.beginPath();
    for (let i = 0; i < n; i++) {
      const d = st.drops[i]; if ((d.z > 0.7) !== !!pass) continue;
      const y = (d.y + E.t * (0.7 + d.z * 1.1)) % 1, px = ((d.x + y * slant * 0.3) % 1) * w, py = y * h, len = (14 + d.z * 26) * k;
      c.moveTo(px, py); c.lineTo(px - len * slant, py + len);
    }
    c.stroke();
  }
  c.restore();
}

export function init(w, h) {
  const r = mulberry((Math.random() * 1e9) | 0);
  const st = { w: 0, h: 0, seed: r() * 1000, cache: {}, stars: [], clouds: [], drops: [], pat: null, patCtx: null, buf: null, bctx: null, debug: null };
  for (let i = 0; i < 200; i++) st.stars.push({ x: r(), y: Math.pow(r(), 1.25), r: 0.5 + r() * 1.1, a: 0.35 + r() * 0.65, sp: 1 + r() * 3, ph: r() * 6 });
  for (let i = 0; i < 9; i++) st.clouds.push({ sp2: i % 3, y: 0.04 + r() * 0.32, s: 0.5 + r() * 0.9, sp: 3 + r() * 6, off: r(), a: 0.5 + r() * 0.5 });
  for (let i = 0; i < 320; i++) st.drops.push({ x: r(), y: r(), z: 0.3 + r() * 0.7 });
  st.cloudSprites = [makeCloudSprite(3, 520, 208), makeCloudSprite(9, 520, 208), makeCloudSprite(21, 520, 208)];
  st.mist = makeSoftSprite(512, 128); st.puff = makeSoftSprite(64, 64); st.grain = makeGrain();
  return st;
}

export function draw(c, st, t, dt, mood, w, h) {
  if (!st) return;
  if (st.w !== w || st.h !== h || !st.S) resize(st, c, w, h);
  const S = st.S, dbg = st.debug, tStart = performance.now();
  const tt = dbg && dbg.time !== undefined ? dbg.time : t;
  const cyc = dbg ? ((dbg.scene + dbg.local) / N_SCENES) * CYCLE : ((tt % CYCLE) + CYCLE) % CYCLE;
  const p = cyc / CYCLE, pf = p * N_SCENES, i = Math.min(N_SCENES - 1, Math.floor(pf)), local = pf - i;
  const T0 = 1 - CFG.TRANSITION, trans = local > T0, f = trans ? (local - T0) / CFG.TRANSITION : 0, nxt = (i + 1) % N_SCENES;

  /* weather */
  const rain = clamp(bump(p, 0.5, 0.065) * 1.0 + bump(p, 5.5 / 7, 0.04) * 0.38);
  const wet = clamp(Math.max(rain, bump(p, 0.52, 0.15) * 0.85, bump(p, 5.5 / 7, 0.1) * 0.3));
  const overcast = clamp(Math.max(rain * 0.9, bump(p, 0.5, 0.11) * 0.5, bump(p, 5.5 / 7, 0.08) * 0.35));
  const P = paletteAt(p);
  for (const kk of ['top', 'mid', 'hor', 'haze']) P[kk] = mix(mix(P[kk], desat(P[kk], 0.75), overcast * 0.55), '#4a5360', overcast * 0.1);
  const night = P.night, lamp = clamp(smooth(clamp((night - 0.12) / 0.55)) + overcast * 0.25 + 0.05);
  const wind = 0.55 + 0.35 * Math.sin(tt * 0.13) + 0.1 * Math.sin(tt * 0.37);
  const E = { t: tt, w, h, k: S.k, P, night, lamp, rain, wet, overcast, wind, mist: P.mist, p, local, puff: st.puff, mistSprite: st.mist, st };

  /* build scheduling: current scene complete, next scene one layer per frame */
  if (dbg) { ensureScene(st, i, 99); if (trans || dbg.both) ensureScene(st, nxt, 99); }
  else { ensureScene(st, i, 99); ensureScene(st, nxt, 1); }
  for (const key of Object.keys(st.cache)) { const n = +key; if (n !== i && n !== nxt) delete st.cache[key]; }

  /* sky */
  drawSky(c, E, st, w, h);

  /* camera + scenes */
  const zc = 1 + 0.055 * local + 0.13 * smooth(f), panc = (local - 0.5) * 2 * 0.75;
  const jobs = [];
  if (trans) {
    const nl = f * CFG.TRANSITION;
    jobs.push({ idx: nxt, local: nl, Z: 1 + 0.055 * nl + 0.1 * (1 - smooth(f)), pan: (nl - 0.5) * 2 * 0.75, alpha: 1 });
    jobs.push({ idx: i, local, Z: zc, pan: panc, alpha: 1 - smooth((f - 0.1) / 0.75) });
  } else jobs.push({ idx: i, local, Z: zc, pan: panc, alpha: 1 });
  jobs.forEach((j, ji) => renderScene(c, st, E, j, ji));

  /* drifting ground mist + calm veil for the text area (pre-grade so the grade tints them) */
  for (let m = 0; m < 4; m++) {
    const x = ((tt * (5 + m * 2.2) + m * 520) % (w + 900)) - 450;
    soft(c, st.mist, x, h * (0.6 + m * 0.045), w * 0.8, h * 0.13, E.mist * 0.13);
  }
  c.fillStyle = vgrad(c, h * 0.5, h, css(P.haze, 0), css(P.haze, CFG.TEXT_VEIL)); c.fillRect(0, h * 0.5, w, h * 0.5);

  /* colour grade (multiply) */
  c.globalCompositeOperation = 'multiply'; c.fillStyle = css(P.grade); c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
  /* soft sun-warmth wash at golden hours */
  const warm = Math.max(0, 1 - Math.abs(night - 0.3) * 4) * 0.06 * (1 - overcast);
  if (warm > 0.005) { c.globalCompositeOperation = 'soft-light'; c.fillStyle = `rgba(255,160,90,${warm * 2})`; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; }

  /* emissive lights & scene glows (after grade so they stay luminous) */
  jobs.forEach((j, ji) => { if (!j.any) return; c.save(); c.globalAlpha = j.alpha; c.drawImage(st.gb[ji], 0, 0, w, h); c.restore(); });

  drawRain(c, E, st, w, h);

  /* vignette */
  const v = c.createRadialGradient(w * 0.5, h * 0.48, Math.min(w, h) * 0.3, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
  v.addColorStop(0, 'rgba(14,18,30,0)'); v.addColorStop(1, `rgba(14,18,30,${0.24 + night * 0.16})`);
  c.fillStyle = v; c.fillRect(0, 0, w, h);

  /* paper grain */
  if (st.patCtx !== c) { st.pat = c.createPattern(st.grain, 'repeat'); st.patCtx = c; }
  if (st.pat) { c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = CFG.GRAIN; c.fillStyle = st.pat; c.fillRect(0, 0, w, h); c.restore(); }

  /* adaptive quality: if frames are consistently slow, render the buffers at lower resolution */
  if (!dbg) {
    const d = performance.now() - tStart; st.ema = st.ema ? st.ema * 0.96 + d * 0.04 : d;
    st.slow = st.ema > 26 ? st.slow + 1 : 0;
    if (st.slow > 90 && st.qual > 0.55) { st.qual = Math.max(0.5, st.qual * 0.8); st.slow = 0; st.ema = 0; makeBuffers(st); }
  }
}

export default { init, draw };
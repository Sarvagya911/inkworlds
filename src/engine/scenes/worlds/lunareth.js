// /*
//  * ═══════════════════════════════════════════════════════════════════════════
//  *  LUNARETH — "The Frontier"
//  *  A living isekai world, painted in the spirit of Grimgar: Ashes and Illusions.
//  * ═══════════════════════════════════════════════════════════════════════════
//  *
//  *  Drop-in scene module:  export default { init(w,h), draw(ctx,state,t,dt,mood,w,h) }
//  *
//  *  THE JOURNEY (one loop ≈ 5 minutes, all of it driven by `t` in seconds)
//  *
//  *    0  Kingdom outskirts   early morning   farms, windmill, the city on its hill
//  *    1  The gate            morning         guards, queue of carts, warm street beyond
//  *    2  Market streets      midday          one-point-perspective street, stalls, laundry
//  *    3  Tavern district     rainy dusk      lit windows, wet cobbles, swinging sign
//  *    4  Adventurer's guild  night           torches, quest board, horses, moon
//  *    5  Forest road         late night      fireflies, moonbeams, deer, ruins ahead
//  *    6  River & ruins       dawn            arched bridge, mist, reflections, herons
//  *
//  *  HOW IT ACHIEVES THE LOOK
//  *   • Every location is built from parallax layers painted ONCE into off-screen
//  *     bitmaps (washes, mottled pigment, soft ridges), never redrawn per frame.
//  *   • A real camera: slow dolly (near layers move more than far ones) + drift,
//  *     and each transition pushes *through* the scene into the next one.
//  *   • One continuous time-of-day: sky, haze and a multiply "colour grade" are
//  *     interpolated across the whole journey; windows/lamps are emissive and
//  *     only light up as the world darkens.
//  *   • Weather is global: clear → overcast → rain at dusk → forest drizzle → mist.
//  *   • Low saturation, big skies, quiet movement, and rare small events
//  *     (a patron leaving the tavern, a deer crossing, a lone lantern on the road,
//  *     a shooting star, a fish jumping).
//  */

// /* ───────────────────────────── tunables ───────────────────────────── */
// const CFG = {
//   SCENE_SECONDS: 44,   // time spent in each location (loop = 7 × this)
//   TRANSITION: 0.17,    // fraction of a scene used for the push-through
//   LAYER_SCALE: 0.62,   // resolution of painted bitmaps (lower = softer / lighter)
//   TEXT_VEIL: 0.13,     // soft haze behind the lower page so text stays calm
//   GRAIN: 0.16          // paper grain strength
// };
// const N_SCENES = 7;
// const CYCLE = CFG.SCENE_SECONDS * N_SCENES;

// /* ───────────────────────────── maths ───────────────────────────── */
// const TAU = Math.PI * 2;
// const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
// const lerp = (a, b, t) => a + (b - a) * t;
// const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
// const smoother = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
// const hash1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// const vnoise = x => { const i = Math.floor(x), f = x - i; return lerp(hash1(i), hash1(i + 1), smooth(f)); };
// const bump = (x, c, w) => { const d = Math.abs(((x - c + 0.5) % 1 + 1) % 1 - 0.5) / w; return d >= 1 ? 0 : smooth(1 - d); };
// /* event helper: returns 0..1 progress while an event is active, otherwise -1 */
// const evt = (t, period, dur, off = 0) => { const m = (((t - off) % period) + period) % period; return m < dur ? m / dur : -1; };

// function mulberry(seed) {
//   let a = seed >>> 0;
//   return () => {
//     a |= 0; a = (a + 0x6D2B79F5) | 0;
//     let t = Math.imul(a ^ (a >>> 15), 1 | a);
//     t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
//     return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
//   };
// }

// /* ───────────────────────────── colour ───────────────────────────── */
// const _hex = {};
// function rgb(h) {
//   if (Array.isArray(h)) return h;
//   if (h.charCodeAt(0) !== 35) { const m = h.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]]; }
//   let c = _hex[h];
//   if (!c) { const n = parseInt(h.slice(1), 16); c = _hex[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
//   return c;
// }
// const mix = (a, b, t) => { a = rgb(a); b = rgb(b); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
// const css = (c, a = 1) => typeof c === 'string' ? c : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
// const hx = (h, a = 1) => css(rgb(h), a);
// /* painterly shading: lights drift warm, shadows drift cool */
// const tone = (col, t, a = 1) => css(t >= 0 ? mix(col, '#fff1d4', t) : mix(col, '#1f2740', -t), a);
// const desat = (col, amt) => { const c = rgb(col), l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return mix(c, [l, l, l], amt); };

// /* ───────────────────────────── canvases ───────────────────────────── */
// function makeCanvas(w, h) {
//   w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
//   if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
//   const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
// }

// /* ───────────────────────────── sprites (built once) ───────────────────────────── */
// function makeCloudSprite(seed, wd, ht) {
//   const cv = makeCanvas(wd, ht), c = cv.getContext('2d'), r = mulberry(seed);
//   const pf = [], n = 20;
//   for (let i = 0; i < n; i++) {
//     const t = i / (n - 1), b = Math.sin(t * Math.PI);
//     const rad = ht * (0.14 + 0.24 * b) * (0.7 + r() * 0.6);
//     pf.push({ x: wd * (0.1 + 0.8 * t), y: ht * 0.72 - rad * (0.3 + r() * 0.5) - b * ht * 0.2, r: rad });
//   }
//   let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
//   pf.forEach(p => { x0 = Math.min(x0, p.x - p.r); x1 = Math.max(x1, p.x + p.r); y0 = Math.min(y0, p.y - p.r); y1 = Math.max(y1, p.y + p.r * 0.3); });
//   const m = 14, sc = Math.min((wd - 2 * m) / (x1 - x0), (ht * 0.84 - m) / (y1 - y0));
//   c.setTransform(sc, 0, 0, sc, m - x0 * sc + (wd - 2 * m - (x1 - x0) * sc) / 2, m - y0 * sc);
//   if ('filter' in c) c.filter = 'blur(2.5px)';
//   c.fillStyle = '#a9b4c2'; pf.forEach(p => { c.beginPath(); c.arc(p.x, p.y + p.r * 0.28, p.r, 0, TAU); c.fill(); });
//   c.fillStyle = '#e7e4dd'; pf.forEach(p => { c.beginPath(); c.arc(p.x, p.y, p.r * 0.94, 0, TAU); c.fill(); });
//   c.fillStyle = 'rgba(255,250,238,.85)'; pf.forEach(p => { c.beginPath(); c.arc(p.x - p.r * 0.2, p.y - p.r * 0.26, p.r * 0.66, 0, TAU); c.fill(); });
//   c.filter = 'none'; c.setTransform(1, 0, 0, 1, 0, 0);
//   c.globalCompositeOperation = 'destination-out';
//   const g = c.createLinearGradient(0, ht * 0.62, 0, ht * 0.8);
//   g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
//   c.fillStyle = g; c.fillRect(0, ht * 0.62, wd, ht * 0.4);
//   return cv;
// }
// function makeSoftSprite(wd, ht) { // soft ellipse used for mist & smoke
//   const cv = makeCanvas(wd, ht), c = cv.getContext('2d');
//   c.scale(1, ht / wd);
//   const g = c.createRadialGradient(wd / 2, wd / 2, 0, wd / 2, wd / 2, wd / 2);
//   g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
//   c.fillStyle = g; c.fillRect(0, 0, wd, wd);
//   return cv;
// }
// function makeGrain() {
//   const cv = makeCanvas(256, 256), c = cv.getContext('2d');
//   const id = c.createImageData(256, 256), r = mulberry(11);
//   for (let i = 0; i < 256 * 256; i++) {
//     const v = 128 + (r() - 0.5) * 70 + (r() - 0.5) * 40;
//     id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
//   }
//   c.putImageData(id, 0, 0);
//   return cv;
// }

// /* ───────────────────────────── time of day ─────────────────────────────
//  * One key per location, interpolated between scene centres so the sky never pops.
//  * grade = multiply tint over the whole frame, night = how dark/emissive the world is.
//  */
// const KEYS = [
//   { top: '#7ca2ba', mid: '#c5d3c6', hor: '#f3ddb8', haze: '#eadcc0', grade: '#fff2e0', night: 0.04, sx: 0.22, sy: 0.55, sc: '#ffdca4', mist: 0.28 },
//   { top: '#6e9fbb', mid: '#b9d0d0', hor: '#e8e6d3', haze: '#dfe3d4', grade: '#fffaf0', night: 0.0, sx: 0.30, sy: 0.36, sc: '#fff0c8', mist: 0.10 },
//   { top: '#68a0c5', mid: '#abcbd2', hor: '#e4e7da', haze: '#d9e1da', grade: '#fffdf6', night: 0.0, sx: 0.55, sy: 0.16, sc: '#fff6dd', mist: 0.05 },
//   { top: '#62788f', mid: '#c4a58f', hor: '#ecb77f', haze: '#d9b392', grade: '#ffd0aa', night: 0.42, sx: 0.84, sy: 0.55, sc: '#ffb072', mist: 0.30 },
//   { top: '#30406c', mid: '#4e5e88', hor: '#8e88a8', haze: '#66739a', grade: '#93a5d6', night: 1.0, sx: 0.70, sy: 0.17, sc: '#e9eeff', mist: 0.18 },
//   { top: '#24345a', mid: '#3b5073', hor: '#5c7490', haze: '#4f6788', grade: '#8a9fcf', night: 1.0, sx: 0.36, sy: 0.14, sc: '#e9eeff', mist: 0.65 },
//   { top: '#6a87a4', mid: '#b9c5c3', hor: '#f4d9b7', haze: '#e9dbc7', grade: '#ffe7d3', night: 0.20, sx: 0.70, sy: 0.50, sc: '#ffd8a0', mist: 0.6 }
// ];
// function paletteAt(p) {
//   const u = p * N_SCENES - 0.5, fl = Math.floor(u), f = smooth(u - fl);
//   const A = KEYS[((fl % N_SCENES) + N_SCENES) % N_SCENES], B = KEYS[(((fl + 1) % N_SCENES) + N_SCENES) % N_SCENES];
//   const P = {};
//   for (const k of ['top', 'mid', 'hor', 'haze', 'grade', 'sc']) P[k] = mix(A[k], B[k], f);
//   for (const k of ['night', 'sx', 'sy', 'mist']) P[k] = lerp(A[k], B[k], f);
//   return P;
// }

// /* ═════════════════════════ painting primitives ═════════════════════════
//  * Everything below paints into a layer bitmap using "layer-logical" coordinates:
//  *   S.X(u) / S.Y(v)  map unit coords to pixels,   S.k = size scale (≈ h/1080)
//  */
// const PAL = {
//   cloaks: ['#5b4a42', '#4a5560', '#6b5a46', '#4f6054', '#7a5a4f', '#55506a', '#8a7a62', '#3f4a56', '#6a4f52', '#7d6a55'],
//   plaster: ['#c4b498', '#bba98c', '#cbbd9f', '#b5a48a', '#aa9c86', '#c8b99c', '#b8ab94'],
//   roofs: ['#7c5649', '#6e5b56', '#5e5661', '#86614d', '#505659', '#704f46'],
//   awn: ['#a3584c', '#c4a35e', '#5f8077', '#8a6a9a', '#b9714c', '#6f8a9c']
// };
// const pick = (rnd, a) => a[(rnd() * a.length) | 0];

// function mottle(c, S, rnd, n, light = '#fff0cc', dark = '#26304c') {
//   c.globalCompositeOperation = 'source-atop';
//   for (let i = 0; i < n; i++) {
//     const x = rnd() * S.W, y = rnd() * S.H, r = (5 + rnd() * 20) * S.k;
//     c.fillStyle = rnd() < 0.5 ? hx(light, 0.015 + rnd() * 0.025) : hx(dark, 0.015 + rnd() * 0.03);
//     c.beginPath(); c.ellipse(x, y, r, r * (0.35 + rnd() * 0.6), rnd() * 3.14, 0, TAU); c.fill();
//   }
//   c.globalCompositeOperation = 'source-over';
// }

// function brush(c, S, rnd, n) {
//   c.globalCompositeOperation = 'source-atop'; c.lineCap = 'round';
//   for (let i = 0; i < n; i++) {
//     const x = rnd() * S.W, y = rnd() * S.H, len = (16 + rnd() * 60) * S.k, ang = (rnd() - 0.5) * 0.5;
//     c.strokeStyle = rnd() < 0.5 ? `rgba(255,244,214,${0.03 + rnd() * 0.04})` : `rgba(30,40,70,${0.03 + rnd() * 0.04})`;
//     c.lineWidth = (1.2 + rnd() * 3) * S.k;
//     c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
//   }
//   c.globalCompositeOperation = 'source-over';
// }

// function vgrad(c, y0, y1, a, b) {
//   const g = c.createLinearGradient(0, y0, 0, y1);
//   g.addColorStop(0, a); g.addColorStop(1, b); return g;
// }

// /* ridge / mountain silhouette with painted light, snow, gullies */
// function ridge(c, S, rnd, o) {
//   const step = o.step || 8, so = rnd() * 500, pts = [];
//   for (let x = -step; x <= S.W + step; x += step) {
//     const u = x / S.W; let n = 0, a = 1, f = o.freq || 2.4, s = 0;
//     for (let q = 0; q < 5; q++) {
//       let v = vnoise(u * f + so + q * 13.7);
//       if (o.sharp) v = 1 - Math.abs(2 * v - 1);
//       n += a * v; s += a; a *= o.rough || 0.5; f *= 2.07;
//     }
//     n /= s;
//     let y = S.Y(o.base) - (n - 0.5) * 2 * o.amp * S.h;
//     if (o.bump) { const d = (u - o.bump[0]) / o.bump[2]; y -= Math.exp(-Math.pow(Math.abs(d), o.bump[3] || 2)) * o.bump[1] * S.h; }
//     pts.push([x, y]);
//   }
//   let minY = 1e9; for (const p of pts) if (p[1] < minY) minY = p[1];
//   c.beginPath(); c.moveTo(pts[0][0], S.H + 6);
//   for (const p of pts) c.lineTo(p[0], p[1]);
//   c.lineTo(pts[pts.length - 1][0], S.H + 6); c.closePath();
//   c.fillStyle = vgrad(c, minY, S.Y(o.base) + o.amp * S.h * 1.1, o.col, o.colBot || o.col);
//   c.fill();
//   c.save(); c.clip();
//   if (o.snow) {
//     c.fillStyle = vgrad(c, minY, minY + S.h * o.snow, 'rgba(252,247,238,.8)', 'rgba(252,247,238,0)');
//     c.fillRect(0, minY, S.W, S.h * o.snow + 2);
//   }
//   const fc = o.facets || 0;
//   for (let i = 0; i < fc; i++) {
//     const p = pts[(rnd() * pts.length) | 0], w = (14 + rnd() * 40) * S.k, l = (40 + rnd() * 110) * S.k;
//     c.fillStyle = 'rgba(28,40,66,.06)';
//     c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + w * 0.7, p[1] + l); c.lineTo(p[0] - w * 0.3, p[1] + l * 0.92); c.closePath(); c.fill();
//     c.fillStyle = 'rgba(255,246,226,.05)';
//     c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] - w * 0.9, p[1] + l * 0.9); c.lineTo(p[0] - w * 0.2, p[1] + l); c.closePath(); c.fill();
//   }
//   c.restore();
//   c.strokeStyle = tone(o.col, 0.4, 0.45); c.lineWidth = 1.3 * S.k;
//   c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
//   return pts;
// }

// function conifer(c, x, y, h, col, rnd, hl = true) {
//   const n = h > 70 ? 6 : h > 34 ? 5 : 4, d = h / n;
//   const side = sg => {
//     const a = [[x, y - h]];
//     for (let j = 0; j < n; j++) {
//       const t = (j + 1) / n, yy = y - h + h * t * 0.97, ww = h * 0.27 * (0.3 + 0.7 * t) * (0.88 + rnd() * 0.24);
//       a.push([x + sg * ww, yy + (rnd() - 0.5) * d * 0.15]);
//       a.push([x + sg * ww * 0.4, yy - d * 0.3]);
//     }
//     return a;
//   };
//   const L = side(-1), R = side(1);
//   c.fillStyle = col;
//   c.beginPath(); c.moveTo(x, y - h);
//   for (let i = 1; i < L.length; i++) c.lineTo(L[i][0], L[i][1]);
//   c.lineTo(x, y + h * 0.02);
//   for (let i = R.length - 1; i >= 1; i--) c.lineTo(R[i][0], R[i][1]);
//   c.closePath(); c.fill();
//   if (hl && h > 26) {
//     c.fillStyle = tone(col, 0.2, 0.5);
//     c.beginPath(); L.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.lineTo(x, y); c.closePath(); c.fill();
//     c.fillStyle = 'rgba(18,28,48,.2)';
//     c.beginPath(); R.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.lineTo(x, y); c.closePath(); c.fill();
//   }
// }

// function broadleaf(c, x, y, r, col, rnd) {
//   const th = r * 0.3;
//   c.fillStyle = tone('#5c4838', -0.1);
//   c.beginPath(); c.moveTo(x - th * 0.7, y); c.lineTo(x - th * 0.25, y - r * 1.2); c.lineTo(x + th * 0.25, y - r * 1.2); c.lineTo(x + th * 0.7, y); c.closePath(); c.fill();
//   const cy = y - r * 1.55, bl = [];
//   for (let i = 0; i < 12; i++) {
//     const a = rnd() * TAU, d = r * 0.66 * Math.sqrt(rnd());
//     bl.push([x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r * (0.36 + rnd() * 0.3)]);
//   }
//   bl.forEach(b => { c.fillStyle = tone(col, -0.3); c.beginPath(); c.arc(b[0] + r * 0.1, b[1] + r * 0.14, b[2], 0, TAU); c.fill(); });
//   bl.forEach(b => { c.fillStyle = tone(col, 0); c.beginPath(); c.arc(b[0], b[1], b[2] * 0.92, 0, TAU); c.fill(); });
//   bl.forEach(b => { c.fillStyle = tone(col, 0.24, 0.75); c.beginPath(); c.arc(b[0] - r * 0.15, b[1] - r * 0.2, b[2] * 0.62, 0, TAU); c.fill(); });
//   for (let i = 0; i < 16; i++) {
//     const b = bl[(rnd() * bl.length) | 0];
//     c.fillStyle = tone(col, 0.4, 0.5); c.beginPath(); c.arc(b[0] - r * 0.2 + rnd() * r * 0.3, b[1] - r * 0.3 + rnd() * r * 0.2, r * 0.07 + rnd() * r * 0.06, 0, TAU); c.fill();
//   }
// }

// function treeLine(c, S, rnd, pts, o) {
//   const k = S.k;
//   for (let i = 0; i < pts.length; i++) {
//     if (rnd() > (o.dens || 0.6)) continue;
//     const p = pts[i], s = (o.size || 50) * k * (0.6 + rnd() * 0.8), col = pick(rnd, o.cols);
//     const yy = p[1] + (o.dy || 0) * k + rnd() * 6 * k;
//     if (rnd() < (o.broad || 0)) broadleaf(c, p[0], yy, s * 0.5, col, rnd); else conifer(c, p[0], yy, s, col, rnd, o.hl !== false);
//   }
// }

// function crenels(c, x0, x1, y, cw, ch, col) {
//   c.fillStyle = col;
//   for (let x = x0; x < x1 - cw; x += cw * 2) c.fillRect(x, y - ch, cw, ch + 1);
// }

// /* running-bond stone with per-block tonal variation */
// function blocks(c, rnd, x, y, w, h, col, bw, bh, a = 0.55) {
//   c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
//   let row = 0;
//   for (let yy = y; yy < y + h; yy += bh, row++) {
//     const off = (row % 2) * bw * 0.5;
//     for (let xx = x - off; xx < x + w; xx += bw) {
//       c.fillStyle = tone(col, (rnd() - 0.5) * 0.22, a);
//       c.fillRect(xx + 0.7, yy + 0.7, bw - 1.4, bh - 1.4);
//     }
//   }
//   c.restore();
// }

// function pane(c, rnd, x, y, w, h, frame, o = {}) {
//   c.fillStyle = hx(frame, 0.95); c.fillRect(x - w * 0.1, y - h * 0.08, w * 1.2, h * 1.16);
//   c.fillStyle = vgrad(c, y, y + h, '#3d4a5e', '#27303f'); c.fillRect(x, y, w, h);
//   c.fillStyle = 'rgba(190,210,230,.16)';
//   c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.6, y); c.lineTo(x, y + h * 0.7); c.closePath(); c.fill();
//   c.strokeStyle = hx(frame, 0.9); c.lineWidth = Math.max(1, w * 0.07);
//   c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h / 2); c.lineTo(x + w, y + h / 2); c.stroke();
//   if (o.shutter) {
//     c.fillStyle = hx(o.shutter, 0.95);
//     c.fillRect(x - w * 0.46, y - h * 0.04, w * 0.4, h * 1.08);
//     c.fillRect(x + w * 1.06, y - h * 0.04, w * 0.4, h * 1.08);
//     c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1;
//     for (let i = 1; i < 5; i++) {
//       const yy = y + h * i / 5;
//       c.beginPath(); c.moveTo(x - w * 0.46, yy); c.lineTo(x - w * 0.06, yy); c.moveTo(x + w * 1.06, yy); c.lineTo(x + w * 1.46, yy); c.stroke();
//     }
//   }
// }

// /* gable-front timber house.  Records emissive windows into S.lights, chimneys into S.out.smoke */
// function facade(c, S, rnd, cx, g, w, h, o = {}) {
//   const k = S.k, x = cx - w / 2;
//   const wall = o.wall || pick(rnd, PAL.plaster), beam = o.beam || '#4a3b33', roof = o.roof || pick(rnd, PAL.roofs), stone = o.stone || '#8e887d';
//   const floors = o.floors || 2, rh = o.roofH || w * 0.58, ov = o.ov !== undefined ? o.ov : w * 0.07;
//   const bh = o.base !== undefined ? o.base : h * 0.2, fh = (h - bh) / floors;
//   c.fillStyle = vgrad(c, g - h, g, tone(wall, 0.1), tone(wall, -0.16)); c.fillRect(x, g - h, w, h);
//   c.fillStyle = 'rgba(28,34,64,.11)'; c.fillRect(x + w * 0.8, g - h, w * 0.2, h);
//   if (bh > 0) {
//     c.fillStyle = tone(stone, 0); c.fillRect(x, g - bh, w, bh);
//     blocks(c, rnd, x, g - bh, w, bh, stone, Math.max(8 * k, w * 0.09), Math.max(6 * k, bh * 0.25), 0.6);
//   }
//   const lw = Math.max(1.2, w * 0.017);
//   c.strokeStyle = hx(beam, 0.92); c.lineWidth = lw;
//   for (let f = 0; f <= floors; f++) { const y = g - bh - f * fh; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.stroke(); }
//   const nb = Math.max(2, Math.round(w / (fh * 0.95)));
//   for (let i = 0; i <= nb; i++) { const xx = x + i * w / nb; c.beginPath(); c.moveTo(xx, g - bh); c.lineTo(xx, g - h); c.stroke(); }
//   for (let f = 1; f < floors; f++) for (let i = 0; i < nb; i++) if (rnd() < 0.45) {
//     const x0 = x + i * w / nb, x1 = x0 + w / nb, y0 = g - bh - f * fh, y1 = y0 - fh;
//     c.beginPath(); if (rnd() < 0.5) { c.moveTo(x0, y0); c.lineTo(x1, y1); } else { c.moveTo(x1, y0); c.lineTo(x0, y1); } c.stroke();
//   }
//   const doorBay = o.door === false ? -1 : (o.doorBay !== undefined ? o.doorBay : Math.floor(nb / 2));
//   const shutters = o.shutter !== undefined ? o.shutter : (rnd() < 0.6 ? pick(rnd, ['#5f7a6e', '#8a5a4e', '#5d6f86', '#7b7a52']) : null);
//   const litP = o.litP !== undefined ? o.litP : 0.6;
//   for (let f = 0; f < floors; f++) for (let i = 0; i < nb; i++) {
//     if (f === 0 && i === doorBay) continue;
//     const bx = x + (i + 0.5) * w / nb, ww = w / nb * 0.38, wh = fh * 0.4, wy = g - bh - (f + 0.5) * fh - wh * 0.2;
//     if (f === 0 && bh > 0 && wy + wh > g - bh * 0.4) continue;
//     pane(c, rnd, bx - ww / 2, wy - wh / 2, ww, wh, beam, { shutter: shutters });
//     S.lights.push({ kind: 'win', x: bx - ww / 2, y: wy - wh / 2, w: ww, h: wh, k: (o.lit === false ? 0.04 : rnd() < litP ? 1 : 0.1) * (o.k || 1), ph: rnd(), gy: o.reflect ? g : 0 });
//   }
//   if (doorBay >= 0) {
//     const dx = x + (doorBay + 0.5) * w / nb, dw = Math.min(w / nb * 0.5, fh * 0.46), dh = Math.min(fh * 0.72, g - (g - bh * 0.1) + fh * 0.7);
//     c.fillStyle = tone('#4a382c', -0.1);
//     c.beginPath(); c.moveTo(dx - dw / 2, g); c.lineTo(dx - dw / 2, g - dh * 0.75); c.quadraticCurveTo(dx, g - dh * 1.15, dx + dw / 2, g - dh * 0.75); c.lineTo(dx + dw / 2, g); c.closePath(); c.fill();
//     c.strokeStyle = hx(beam, 0.9); c.lineWidth = lw; c.stroke();
//     if (o.doorLight) S.lights.push({ kind: 'door', x: dx - dw / 2, y: g - dh * 0.95, w: dw, h: dh * 0.95, k: 1, ph: rnd(), gy: g });
//   }
//   const top = g - h;
//   c.fillStyle = vgrad(c, top - rh, top, tone(roof, 0.12), tone(roof, -0.12));
//   c.beginPath(); c.moveTo(x - ov, top); c.lineTo(cx, top - rh); c.lineTo(x + w + ov, top); c.closePath(); c.fill();
//   c.save(); c.clip();
//   const rows = Math.max(4, Math.round(rh / (9 * k)));
//   for (let r = 1; r < rows; r++) {
//     const yy = top - rh + rh * r / rows, hw = (w / 2 + ov) * r / rows;
//     c.strokeStyle = 'rgba(25,20,28,.17)'; c.lineWidth = Math.max(1, k * 1.2);
//     c.beginPath(); c.moveTo(cx - hw, yy); c.lineTo(cx + hw, yy); c.stroke();
//     const tw = Math.max(5 * k, w * 0.05);
//     c.strokeStyle = 'rgba(25,20,28,.08)';
//     for (let tx = cx - hw + (r % 2) * tw * 0.5; tx < cx + hw; tx += tw) { c.beginPath(); c.moveTo(tx, yy); c.lineTo(tx, yy + rh / rows); c.stroke(); }
//   }
//   c.fillStyle = 'rgba(255,240,210,.09)'; c.beginPath(); c.moveTo(cx, top - rh); c.lineTo(x - ov, top); c.lineTo(cx, top); c.closePath(); c.fill();
//   c.restore();
//   c.strokeStyle = tone(roof, -0.35, 0.9); c.lineWidth = Math.max(1.5, w * 0.02);
//   c.beginPath(); c.moveTo(x - ov, top); c.lineTo(cx, top - rh); c.lineTo(x + w + ov, top); c.stroke();
//   c.fillStyle = vgrad(c, top, top + fh * 0.3, 'rgba(20,18,30,.3)', 'rgba(20,18,30,0)'); c.fillRect(x, top, w, fh * 0.3);
//   if (o.chimney !== false && rnd() < 0.85) {
//     const chx = cx + (rnd() - 0.5) * w * 0.5, ry = top - rh * (1 - Math.abs(chx - cx) / (w / 2 + ov)), cw = w * 0.085, chh = rh * 0.32;
//     c.fillStyle = tone('#7d7066', -0.05); c.fillRect(chx - cw / 2, ry - chh, cw, chh + 3);
//     c.fillStyle = tone('#4c443f', 0); c.fillRect(chx - cw * 0.62, ry - chh - cw * 0.3, cw * 1.24, cw * 0.4);
//     if (S.out.smoke) S.out.smoke.push({ x: chx, y: ry - chh - cw * 0.3, s: w });
//   }
//   return { top: top - rh };
// }

// /* round-ish tower with cylinder shading and conical roof */
// function tower(c, S, rnd, x, g, w, h, col, roofCol, rh, o = {}) {
//   const gr = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
//   gr.addColorStop(0, tone(col, 0.16)); gr.addColorStop(0.5, col); gr.addColorStop(1, tone(col, -0.26));
//   c.fillStyle = gr; c.fillRect(x - w / 2, g - h, w, h);
//   if (o.blocks !== false && w > 14 * S.k) blocks(c, rnd, x - w / 2, g - h, w, h, col, Math.max(8, w * 0.3), Math.max(6, w * 0.2), 0.1);
//   if (o.slits) for (let i = 0; i < o.slits; i++) {
//     const sy = g - h * (0.22 + 0.55 * i / Math.max(1, o.slits - 1)), sw = Math.max(2, w * 0.08);
//     c.fillStyle = 'rgba(25,26,38,.8)'; c.fillRect(x - sw / 2, sy - w * 0.12, sw, w * 0.24);
//     if (o.lit) S.lights.push({ kind: 'win', x: x - sw / 2, y: sy - w * 0.12, w: sw, h: w * 0.24, k: o.lit, ph: rnd(), gy: 0 });
//   }
//   c.fillStyle = tone(col, -0.12); c.fillRect(x - w * 0.56, g - h - w * 0.07, w * 1.12, w * 0.1);
//   if (rh > 0) {
//     const rg = c.createLinearGradient(x - w * 0.62, 0, x + w * 0.62, 0);
//     rg.addColorStop(0, tone(roofCol, 0.16)); rg.addColorStop(0.55, roofCol); rg.addColorStop(1, tone(roofCol, -0.28));
//     c.fillStyle = rg; c.beginPath(); c.moveTo(x - w * 0.64, g - h - w * 0.02); c.lineTo(x, g - h - rh); c.lineTo(x + w * 0.64, g - h - w * 0.02); c.closePath(); c.fill();
//     c.strokeStyle = 'rgba(25,20,28,.14)'; c.lineWidth = 1;
//     for (let i = 1; i < 7; i++) { const yy = g - h - rh * i / 7, hw = w * 0.64 * (1 - i / 7); c.beginPath(); c.moveTo(x - hw, yy + rh / 7 * 0.5); c.lineTo(x + hw, yy + rh / 7 * 0.5); c.stroke(); }
//     if (o.flag && S.out.flags) S.out.flags.push({ x, y: g - h - rh, len: w * 0.9, col: o.flag });
//   } else crenels(c, x - w / 2, x + w / 2, g - h, w / 6, w * 0.14, tone(col, -0.05));
// }

// /* small gable houses for distant towns; rows climb a hill */
// function townBlock(c, S, rnd, x0, x1, base, hMin, hMax, sc, pal) {
//   for (let x = x0; x < x1;) {
//     const w = (26 + rnd() * 24) * sc, h = (hMin + rnd() * (hMax - hMin)) * sc, rh = w * (0.45 + rnd() * 0.25);
//     const wall = pick(rnd, pal.walls), rf = pick(rnd, pal.roofs);
//     c.fillStyle = vgrad(c, base - h, base, tone(wall, 0.08), tone(wall, -0.12)); c.fillRect(x, base - h, w, h);
//     c.fillStyle = 'rgba(28,34,64,.12)'; c.fillRect(x + w * 0.75, base - h, w * 0.25, h);
//     c.fillStyle = vgrad(c, base - h - rh, base - h, tone(rf, 0.1), tone(rf, -0.14));
//     c.beginPath(); c.moveTo(x - w * 0.07, base - h); c.lineTo(x + w / 2, base - h - rh); c.lineTo(x + w * 1.07, base - h); c.closePath(); c.fill();
//     c.fillStyle = 'rgba(255,240,210,.1)'; c.beginPath(); c.moveTo(x + w / 2, base - h - rh); c.lineTo(x - w * 0.07, base - h); c.lineTo(x + w / 2, base - h); c.closePath(); c.fill();
//     if (w > 22 * S.k * 0.8 && rnd() < 0.7) {
//       const ww = w * 0.16, wh = h * 0.2;
//       S.lights.push({ kind: 'win', x: x + w * 0.22, y: base - h * 0.6, w: ww, h: wh, k: rnd() < 0.55 ? 0.8 : 0.08, ph: rnd(), gy: 0, tiny: true });
//       if (rnd() < 0.6) S.lights.push({ kind: 'win', x: x + w * 0.6, y: base - h * 0.6, w: ww, h: wh, k: rnd() < 0.55 ? 0.8 : 0.08, ph: rnd(), gy: 0, tiny: true });
//     }
//     if (rnd() < 0.3) { c.fillStyle = tone('#6d625b', 0); c.fillRect(x + w * (0.2 + rnd() * 0.5), base - h - rh * 0.8, w * 0.09, rh * 0.5); }
//     x += w * (0.85 + rnd() * 0.3);
//   }
// }

// /* the Kingdom on its hill: walls, rows of roofs, cathedral, keep.  Returns nothing; pushes flags. */
// function skyline(c, S, rnd, o) {
//   const k = S.k * o.sc, cx = o.cx, b = o.base, pal = o.pal;
//   const stone = pal.stone, rf = pal.towerRoof;
//   // cathedral (behind)
//   const cathX = cx - 165 * k;
//   c.fillStyle = vgrad(c, b - 250 * k, b - 60 * k, tone(stone, 0.1), tone(stone, -0.1));
//   c.fillRect(cathX - 70 * k, b - 190 * k, 140 * k, 130 * k);
//   c.fillStyle = tone(rf, -0.05);
//   c.beginPath(); c.moveTo(cathX - 80 * k, b - 190 * k); c.lineTo(cathX, b - 250 * k); c.lineTo(cathX + 80 * k, b - 190 * k); c.closePath(); c.fill();
//   tower(c, S, rnd, cathX + 55 * k, b - 60 * k, 40 * k, 260 * k, stone, rf, 120 * k, { blocks: false });
//   c.fillStyle = 'rgba(40,50,80,.5)'; c.beginPath(); c.arc(cathX - 5 * k, b - 150 * k, 13 * k, Math.PI, 0); c.fillRect(cathX - 18 * k, b - 150 * k, 26 * k, 34 * k); c.fill();
//   // keep
//   const kx = cx + 95 * k;
//   c.fillStyle = vgrad(c, b - 330 * k, b - 70 * k, tone(stone, 0.12), tone(stone, -0.14)); c.fillRect(kx - 95 * k, b - 250 * k, 190 * k, 190 * k);
//   blocks(c, rnd, kx - 95 * k, b - 250 * k, 190 * k, 190 * k, stone, 20 * k, 13 * k, 0.2);
//   crenels(c, kx - 95 * k, kx + 95 * k, b - 250 * k, 11 * k, 14 * k, tone(stone, -0.06));
//   tower(c, S, rnd, kx - 100 * k, b - 60 * k, 52 * k, 260 * k, stone, rf, 95 * k, { slits: 3, lit: 0.9, flag: pal.flag });
//   tower(c, S, rnd, kx + 100 * k, b - 60 * k, 52 * k, 245 * k, stone, rf, 90 * k, { slits: 3, lit: 0.9, flag: pal.flag });
//   tower(c, S, rnd, kx, b - 100 * k, 66 * k, 320 * k, tone(stone, 0.03), rf, 120 * k, { slits: 4, lit: 1, flag: pal.flag });
//   for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) S.lights.push({ kind: 'win', x: kx - 66 * k + i * 38 * k, y: b - 215 * k + r * 60 * k, w: 9 * k, h: 16 * k, k: 0.85, ph: rnd(), gy: 0, tiny: true });
//   // house rows climbing the hill
//   for (let r = 2; r >= 0; r--) townBlock(c, S, rnd, cx - 470 * k, cx + 470 * k, b - 20 * k - r * 34 * k, 30, 52, k, pal);
//   // curtain wall
//   const wy = b + 8 * k;
//   c.fillStyle = vgrad(c, wy - 62 * k, wy, tone(stone, 0.1), tone(stone, -0.2)); c.fillRect(cx - 500 * k, wy - 62 * k, 1000 * k, 62 * k);
//   blocks(c, rnd, cx - 500 * k, wy - 62 * k, 1000 * k, 62 * k, stone, 24 * k, 14 * k, 0.3);
//   crenels(c, cx - 500 * k, cx + 500 * k, wy - 62 * k, 9 * k, 11 * k, tone(stone, -0.08));
//   for (const tx of [-500, -250, 0, 250, 500]) tower(c, S, rnd, cx + tx * k, wy, 46 * k, 105 * k, stone, rf, tx % 500 === 0 ? 62 * k : 0, { slits: 1, lit: 0.6 });
//   // main gate in the wall
//   c.fillStyle = '#2c2d38'; c.beginPath(); c.moveTo(cx - 20 * k, wy); c.lineTo(cx - 20 * k, wy - 34 * k); c.arc(cx, wy - 34 * k, 20 * k, Math.PI, 0); c.lineTo(cx + 20 * k, wy); c.closePath(); c.fill();
//   S.lights.push({ kind: 'win', x: cx - 8 * k, y: wy - 40 * k, w: 16 * k, h: 40 * k, k: 0.5, ph: rnd(), gy: 0, tiny: true });
// }

// /* ═════════════════════════ living things (drawn every frame) ═════════════════════════ */
// function walker(c, x, y, s, t, ph, col, o = {}) {
//   // x,y = feet position, s = body height in px, dir = ±1
//   const dir = o.dir || 1, sw = o.pace === 0 ? 0 : Math.sin(t * (o.pace || 5) + ph), bob = Math.abs(sw) * s * 0.03;
//   c.save(); c.translate(x, y - bob); c.scale(o.front ? 1 : dir, 1);
//   if (o.shadow !== false) { c.fillStyle = 'rgba(20,25,40,.18)'; c.beginPath(); c.ellipse(0, bob, s * 0.28, s * 0.07, 0, 0, TAU); c.fill(); }
//   c.strokeStyle = tone(col, -0.3); c.lineWidth = Math.max(1, s * 0.07); c.lineCap = 'round';
//   c.beginPath();
//   if (o.front) { c.moveTo(-s * 0.08, -s * 0.34); c.lineTo(-s * 0.08, -Math.max(0, sw) * s * 0.07); c.moveTo(s * 0.08, -s * 0.34); c.lineTo(s * 0.08, -Math.max(0, -sw) * s * 0.07); }
//   else { c.moveTo(-s * 0.05, -s * 0.34); c.lineTo(-s * 0.05 + sw * s * 0.13, 0); c.moveTo(s * 0.05, -s * 0.34); c.lineTo(s * 0.05 - sw * s * 0.13, 0); }
//   c.stroke();
//   const type = o.type || 'villager';
//   if (type === 'traveler') { c.fillStyle = tone('#6b5846', -0.05); c.fillRect(-s * 0.3, -s * 0.78, s * 0.22, s * 0.34); }
//   c.fillStyle = col;
//   c.beginPath(); c.moveTo(-s * 0.2, -s * 0.78); c.lineTo(s * 0.18, -s * 0.78); c.lineTo(s * 0.27 + sw * s * 0.02, -s * 0.2); c.lineTo(-s * 0.27 - sw * s * 0.02, -s * 0.2); c.closePath(); c.fill();
//   c.fillStyle = tone(col, 0.18, 0.45); c.beginPath(); c.moveTo(-s * 0.2, -s * 0.78); c.lineTo(-s * 0.02, -s * 0.78); c.lineTo(-s * 0.06, -s * 0.2); c.lineTo(-s * 0.27, -s * 0.2); c.closePath(); c.fill();
//   c.fillStyle = type === 'knight' ? '#8f949b' : (o.away ? '#4a3a32' : '#c9a98c');
//   c.beginPath(); c.arc(0, -s * 0.88, s * 0.105, 0, TAU); c.fill();
//   c.fillStyle = tone(col, -0.18);
//   if (type === 'merchant') { c.beginPath(); c.ellipse(0, -s * 0.95, s * 0.2, s * 0.05, 0, 0, TAU); c.fill(); c.fillRect(-s * 0.09, -s * 1.06, s * 0.18, s * 0.12); }
//   else if (type === 'mage') { c.beginPath(); c.moveTo(-s * 0.16, -s * 0.94); c.lineTo(s * 0.02, -s * 1.28); c.lineTo(s * 0.16, -s * 0.94); c.closePath(); c.fill(); }
//   else { c.beginPath(); c.arc(0, -s * 0.9, s * 0.115, Math.PI * 1.05, Math.PI * 1.95); c.fill(); }
//   if (type === 'traveler' || type === 'mage') { c.strokeStyle = '#4b3a2c'; c.lineWidth = Math.max(1, s * 0.035); c.beginPath(); c.moveTo(s * 0.3, -s * 1.0); c.lineTo(s * 0.24 + sw * s * 0.04, 0); c.stroke(); }
//   if (type === 'knight') { c.strokeStyle = '#2f3138'; c.lineWidth = Math.max(1, s * 0.04); c.beginPath(); c.moveTo(-s * 0.2, -s * 0.5); c.lineTo(-s * 0.4, -s * 0.12); c.stroke(); }
//   c.restore();
// }

// function horse(c, x, y, s, dir, t, col, o = {}) {
//   // s = body length; y = hoof line; o.gait = steps/sec (0 = standing)
//   const g = o.gait !== undefined ? o.gait : 5, ph = o.ph || 0;
//   c.save(); c.translate(x, y); c.scale(dir, 1);
//   c.fillStyle = 'rgba(20,25,40,.16)'; c.beginPath(); c.ellipse(0, 0, s * 0.5, s * 0.06, 0, 0, TAU); c.fill();
//   const leg = (hx0, phase, hind, shade) => {
//     const a = g ? Math.sin(t * g + phase + ph) : 0, lift = g ? Math.max(0, Math.cos(t * g + phase + ph)) * s * 0.06 : 0;
//     const hip = [hx0, -s * 0.44], knee = [hx0 + a * s * 0.07 + (hind ? -s * 0.03 : s * 0.015), -s * 0.24], hoof = [hx0 + a * s * 0.13 + (hind ? -s * 0.01 : 0), -lift];
//     c.strokeStyle = tone(col, shade); c.lineWidth = s * 0.05; c.lineCap = 'round'; c.lineJoin = 'round';
//     c.beginPath(); c.moveTo(hip[0], hip[1]); c.lineTo(knee[0], knee[1]); c.lineTo(hoof[0], hoof[1]); c.stroke();
//     c.lineWidth = s * 0.06; c.strokeStyle = '#2f2824'; c.beginPath(); c.moveTo(hoof[0], hoof[1] - s * 0.02); c.lineTo(hoof[0], hoof[1]); c.stroke();
//   };
//   leg(-s * 0.25, Math.PI, true, -0.3); leg(s * 0.26, 0, false, -0.3);
//   c.fillStyle = tone(col, 0);
//   c.beginPath(); c.moveTo(-s * 0.37, -s * 0.57);
//   c.quadraticCurveTo(-s * 0.1, -s * 0.74, s * 0.22, -s * 0.68);
//   c.lineTo(s * 0.4, -s * 0.97); c.lineTo(s * 0.5, -s * 1.01);
//   c.quadraticCurveTo(s * 0.62, -s * 0.9, s * 0.67, -s * 0.8); c.lineTo(s * 0.6, -s * 0.77);
//   c.lineTo(s * 0.5, -s * 0.84); c.lineTo(s * 0.42, -s * 0.72); c.lineTo(s * 0.32, -s * 0.5);
//   c.quadraticCurveTo(s * 0.0, -s * 0.34, -s * 0.3, -s * 0.42);
//   c.quadraticCurveTo(-s * 0.42, -s * 0.48, -s * 0.37, -s * 0.57); c.closePath(); c.fill();
//   c.fillStyle = tone(col, 0.2, 0.45); c.beginPath(); c.ellipse(-s * 0.02, -s * 0.6, s * 0.28, s * 0.06, -0.08, 0, TAU); c.fill();
//   c.fillStyle = tone(col, -0.42);
//   c.beginPath(); c.moveTo(s * 0.2, -s * 0.69); c.quadraticCurveTo(s * 0.32, -s * 0.92, s * 0.41, -s * 1.0); c.lineTo(s * 0.46, -s * 0.99); c.quadraticCurveTo(s * 0.34, -s * 0.84, s * 0.26, -s * 0.66); c.closePath(); c.fill();
//   c.beginPath(); c.moveTo(s * 0.46, -s * 1.0); c.lineTo(s * 0.47, -s * 1.08); c.lineTo(s * 0.52, -s * 1.0); c.closePath(); c.fill();
//   const tw = Math.sin(t * 1.6 + s) * s * 0.035;
//   c.beginPath(); c.moveTo(-s * 0.37, -s * 0.56); c.quadraticCurveTo(-s * 0.55 + tw, -s * 0.46, -s * 0.52 + tw * 2, -s * 0.16); c.quadraticCurveTo(-s * 0.44, -s * 0.38, -s * 0.34, -s * 0.5); c.closePath(); c.fill();
//   leg(-s * 0.17, 0, true, -0.05); leg(s * 0.33, Math.PI, false, -0.05);
//   c.restore();
// }

// function cart(c, x, y, s, dir, t, o = {}) {
//   // wheels turn with distance travelled (o.dist)
//   const wr = s * 0.17, rot = (o.dist || 0) / wr;
//   c.save(); c.translate(x, y); c.scale(dir, 1);
//   c.fillStyle = 'rgba(20,25,40,.16)'; c.beginPath(); c.ellipse(0, 0, s * 0.55, s * 0.06, 0, 0, TAU); c.fill();
//   c.fillStyle = tone('#7a5b43', -0.05); c.fillRect(-s * 0.5, -s * 0.5, s, s * 0.22);
//   c.fillStyle = tone('#7a5b43', -0.25); c.fillRect(-s * 0.5, -s * 0.34, s, s * 0.06);
//   if (o.cover !== false) {
//     c.fillStyle = tone(o.cover || '#d9cdb2', 0); c.beginPath(); c.moveTo(-s * 0.46, -s * 0.5); c.quadraticCurveTo(-s * 0.4, -s * 0.98, 0, -s * 1.0); c.quadraticCurveTo(s * 0.4, -s * 0.98, s * 0.46, -s * 0.5); c.closePath(); c.fill();
//     c.fillStyle = 'rgba(30,28,40,.16)'; c.beginPath(); c.moveTo(s * 0.1, -s * 1.0); c.quadraticCurveTo(s * 0.4, -s * 0.98, s * 0.46, -s * 0.5); c.lineTo(s * 0.1, -s * 0.5); c.closePath(); c.fill();
//     c.strokeStyle = 'rgba(60,45,35,.35)'; c.lineWidth = 1;
//     for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * s * 0.18, -s * 0.5); c.quadraticCurveTo(i * s * 0.2, -s * 0.9, i * s * 0.1, -s * 1.0); c.stroke(); }
//   } else {
//     c.fillStyle = tone('#a8885a', 0); for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-s * 0.32 + i * s * 0.2, -s * 0.54, s * 0.11, Math.PI, 0); c.fill(); }
//   }
//   [-s * 0.3, s * 0.28].forEach(wx => {
//     c.save(); c.translate(wx, -wr); c.rotate(rot);
//     c.strokeStyle = '#3f3129'; c.lineWidth = s * 0.03; c.beginPath(); c.arc(0, 0, wr, 0, TAU); c.stroke();
//     c.lineWidth = s * 0.015; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i * TAU / 6) * wr, Math.sin(i * TAU / 6) * wr); c.stroke(); }
//     c.restore();
//   });
//   c.restore();
// }

// function bird(c, x, y, s, t, ph, col) {
//   const f = Math.sin(t * 7 + ph) * s * 0.55;
//   c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.16); c.lineCap = 'round';
//   c.beginPath(); c.moveTo(x - s, y - f * 0.3); c.quadraticCurveTo(x - s * 0.4, y + f - s * 0.3, x, y); c.quadraticCurveTo(x + s * 0.4, y + f - s * 0.3, x + s, y - f * 0.3); c.stroke();
// }

// function soft(c, sprite, x, y, w, h, a) {
//   const pa = c.globalAlpha; c.globalAlpha = pa * a; c.drawImage(sprite, x - w / 2, y - h / 2, w, h); c.globalAlpha = pa;
// }

// function smokeAt(c, E, x, y, s, k, seed, dark = 0) {
//   const tint = dark ? '#8a8c94' : '#f1ece2';
//   for (let i = 0; i < 6; i++) {
//     const age = ((E.t * 0.11 + i / 6 + seed) % 1), px = x + E.wind * age * 70 * k + Math.sin(E.t * 0.8 + i * 2 + seed) * 6 * k * age;
//     const r = (6 + age * 30) * k * s;
//     c.save(); c.globalAlpha *= (1 - age) * Math.min(1, age * 5) * 0.4 * (1 - E.rain * 0.5);
//     c.fillStyle = tint; c.beginPath(); c.arc(px, y - age * 110 * k * s, r, 0, TAU); c.fill(); c.restore();
//   }
// }

// function flagAt(c, E, f, k) {
//   const wave = Math.sin(E.t * 2.6 + f.x * 0.01) * f.len * 0.1 * (0.5 + E.wind), fl = f.len * 1.1;
//   c.strokeStyle = '#3b3636'; c.lineWidth = Math.max(1, 2 * k); c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x, f.y - fl * 0.9); c.stroke();
//   c.fillStyle = f.col;
//   c.beginPath(); c.moveTo(f.x, f.y - fl * 0.88); c.bezierCurveTo(f.x + fl * 0.3, f.y - fl * 0.9 + wave, f.x + fl * 0.6, f.y - fl * 0.82 - wave, f.x + fl * 0.85 + wave * 0.6, f.y - fl * 0.76);
//   c.bezierCurveTo(f.x + fl * 0.6, f.y - fl * 0.66 - wave, f.x + fl * 0.3, f.y - fl * 0.62 + wave, f.x, f.y - fl * 0.58); c.closePath(); c.fill();
//   c.fillStyle = 'rgba(255,240,210,.14)'; c.beginPath(); c.moveTo(f.x, f.y - fl * 0.88); c.lineTo(f.x + fl * 0.5, f.y - fl * 0.84 + wave * 0.5); c.lineTo(f.x, f.y - fl * 0.74); c.closePath(); c.fill();
// }

// /* ═════════════════════════ emissive lights (after colour grade) ═════════════════════════ */
// function drawLights(c, E, S, lights) {
//   const L0 = E.lamp;
//   if (L0 < 0.02 && !E.rain) return;
//   for (const L of lights) {
//     const fl = 0.88 + 0.12 * Math.sin(E.t * (3 + L.ph * 5) + L.ph * 40) + (L.kind === 'fire' ? 0.18 * Math.sin(E.t * 17 + L.ph * 9) : 0);
//     const I = clamp(L0 * L.k * fl, 0, 1.25);
//     if (I < 0.03) continue;
//     const cx = L.x + L.w / 2, cy = L.y + L.h / 2;
//     if (L.kind === 'win') {
//       const r = Math.max(L.w, L.h) * (L.tiny ? 1.6 : 2.1);
//       c.globalCompositeOperation = 'lighter';
//       let g = c.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(255,170,80,${0.27 * I})`); g.addColorStop(1, 'rgba(255,150,60,0)');
//       c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2);
//       c.globalCompositeOperation = 'source-over';
//       c.fillStyle = vgrad(c, L.y, L.y + L.h, `rgba(255,222,150,${0.95 * Math.min(1, I)})`, `rgba(247,168,88,${0.92 * Math.min(1, I)})`);
//       c.fillRect(L.x, L.y, L.w, L.h);
//       if (!L.tiny && L.w > 5) {
//         c.strokeStyle = `rgba(58,38,28,${0.6 * Math.min(1, I)})`; c.lineWidth = Math.max(1, L.w * 0.07);
//         c.beginPath(); c.moveTo(cx, L.y); c.lineTo(cx, L.y + L.h); c.moveTo(L.x, cy); c.lineTo(L.x + L.w, cy); c.stroke();
//       }
//     } else if (L.kind === 'lamp') {
//       const r = L.r * 9;
//       c.globalCompositeOperation = 'lighter';
//       let g = c.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(255,190,100,${0.5 * I})`); g.addColorStop(0.3, `rgba(255,160,70,${0.16 * I})`); g.addColorStop(1, 'rgba(255,150,60,0)');
//       c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2);
//       c.globalCompositeOperation = 'source-over';
//       c.fillStyle = `rgba(255,236,190,${Math.min(1, I)})`; c.beginPath(); c.arc(cx, cy, L.r, 0, TAU); c.fill();
//     } else if (L.kind === 'fire') {
//       const r = L.r * 11;
//       c.globalCompositeOperation = 'lighter';
//       let g = c.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(255,170,80,${0.45 * I})`); g.addColorStop(1, 'rgba(255,120,40,0)');
//       c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2);
//       c.globalCompositeOperation = 'source-over';
//       const fh = L.r * (2.2 + 0.5 * Math.sin(E.t * 13 + L.ph * 7)), sway = Math.sin(E.t * 9 + L.ph * 5) * L.r * 0.3;
//       c.fillStyle = `rgba(255,150,60,${Math.min(1, I)})`; c.beginPath(); c.moveTo(cx - L.r * 0.8, cy + L.r); c.quadraticCurveTo(cx - L.r * 0.9, cy - fh * 0.3, cx + sway, cy - fh); c.quadraticCurveTo(cx + L.r * 0.9, cy - fh * 0.3, cx + L.r * 0.8, cy + L.r); c.closePath(); c.fill();
//       c.fillStyle = `rgba(255,226,150,${Math.min(1, I)})`; c.beginPath(); c.moveTo(cx - L.r * 0.4, cy + L.r); c.quadraticCurveTo(cx - L.r * 0.4, cy, cx + sway * 0.6, cy - fh * 0.55); c.quadraticCurveTo(cx + L.r * 0.4, cy, cx + L.r * 0.4, cy + L.r); c.closePath(); c.fill();
//     } else if (L.kind === 'door') {
//       c.globalCompositeOperation = 'lighter';
//       const open = L.open || 0, sp = L.h * (1.6 + open * 1.2);
//       let g = c.createLinearGradient(cx, L.y + L.h, cx, L.y + L.h + sp); g.addColorStop(0, `rgba(255,170,80,${(0.28 + open * 0.2) * I})`); g.addColorStop(1, 'rgba(255,150,60,0)');
//       c.fillStyle = g; c.beginPath(); c.moveTo(L.x, L.y + L.h); c.lineTo(L.x + L.w, L.y + L.h); c.lineTo(L.x + L.w * (2.4 + open), L.y + L.h + sp); c.lineTo(L.x - L.w * (1.4 + open), L.y + L.h + sp); c.closePath(); c.fill();
//       c.globalCompositeOperation = 'source-over';
//       c.fillStyle = vgrad(c, L.y, L.y + L.h, `rgba(255,214,140,${0.85 * Math.min(1, I)})`, `rgba(245,160,84,${0.9 * Math.min(1, I)})`);
//       c.beginPath(); c.moveTo(L.x, L.y + L.h); c.lineTo(L.x, L.y + L.h * 0.25); c.quadraticCurveTo(cx, L.y - L.h * 0.12, L.x + L.w, L.y + L.h * 0.25); c.lineTo(L.x + L.w, L.y + L.h); c.closePath(); c.fill();
//     }
//   }
//   c.globalCompositeOperation = 'source-over';
// }

// function drawReflections(c, E, lights) {
//   if (E.wet < 0.05 || E.lamp < 0.05) return;
//   for (const L of lights) {
//     if (!L.gy) continue;
//     const I = clamp(E.lamp * L.k, 0, 1.2); if (I < 0.05) continue;
//     if (L.kind === 'win') {
//       const hgt = (L.gy - L.y) * 0.7;
//       for (let i = 0; i < 6; i++) {
//         const yy = L.gy + hgt * i / 6 + 2, wob = Math.sin(E.t * 1.7 + i * 1.3 + L.ph * 9) * L.w * 0.12;
//         c.fillStyle = `rgba(255,185,100,${0.16 * I * E.wet * (1 - i / 6)})`; c.fillRect(L.x + wob, yy, L.w, hgt / 6 + 1);
//       }
//     } else if (L.kind === 'lamp' || L.kind === 'fire') {
//       const cy = L.y + L.h / 2, hgt = (L.gy - cy) * 0.55;
//       c.fillStyle = vgrad(c, L.gy, L.gy + hgt, `rgba(255,190,100,${0.3 * I * E.wet})`, 'rgba(255,190,100,0)'); c.fillRect(L.x + L.w / 2 - L.r * 1.2, L.gy, L.r * 2.4, hgt);
//     } else if (L.kind === 'door') {
//       c.fillStyle = vgrad(c, L.gy, L.gy + L.h * 0.9, `rgba(255,185,100,${0.28 * I * E.wet})`, 'rgba(255,185,100,0)'); c.fillRect(L.x, L.gy, L.w, L.h * 0.9);
//     }
//   }
// }

// /* ═════════════════════════ sky ═════════════════════════ */
// function drawSky(c, E, st, w, h) {
//   const P = E.P, k = E.k;
//   c.fillStyle = vgrad(c, 0, h * 0.7, css(P.top), css(P.mid));
//   c.fillRect(0, 0, w, h);
//   const g2 = c.createLinearGradient(0, h * 0.35, 0, h * 0.72);
//   g2.addColorStop(0, css(P.mid, 0)); g2.addColorStop(1, css(P.hor, 1));
//   c.fillStyle = g2; c.fillRect(0, h * 0.35, w, h * 0.65);
//   const night = P.night, sx = P.sx * w, sy = P.sy * h;
//   // stars
//   if (night > 0.3) {
//     const a = smooth((night - 0.3) / 0.6);
//     for (const s of st.stars) {
//       const tw = 0.6 + 0.4 * Math.sin(E.t * s.sp + s.ph);
//       c.fillStyle = `rgba(235,240,255,${a * tw * s.a * (1 - E.overcast * 0.8)})`;
//       c.beginPath(); c.arc(s.x * w, s.y * h * 0.62, s.r * k, 0, TAU); c.fill();
//     }
//     const ss = evt(E.t + st.seed, 41, 1.3);
//     if (ss >= 0 && night > 0.7) {
//       const x0 = w * (0.2 + hash1(Math.floor((E.t + st.seed) / 41)) * 0.5), y0 = h * 0.08, px = x0 + ss * w * 0.16, py = y0 + ss * h * 0.07;
//       const gg = c.createLinearGradient(px, py, px - w * 0.07, py - h * 0.03); gg.addColorStop(0, `rgba(255,255,255,${0.8 * (1 - ss)})`); gg.addColorStop(1, 'rgba(255,255,255,0)');
//       c.strokeStyle = gg; c.lineWidth = 1.6 * k; c.beginPath(); c.moveTo(px, py); c.lineTo(px - w * 0.07, py - h * 0.03); c.stroke();
//     }
//   }
//   // sun / moon
//   const sc = P.sc;
//   if (night < 0.7) {
//     const a = (1 - smooth(night / 0.7)) * (1 - E.overcast * 0.6);
//     c.save(); c.globalCompositeOperation = 'screen';
//     let g = c.createRadialGradient(sx, sy, 0, sx, sy, h * 0.6); g.addColorStop(0, css(sc, 0.8 * a)); g.addColorStop(0.2, css(sc, 0.3 * a)); g.addColorStop(1, css(sc, 0));
//     c.fillStyle = g; c.fillRect(0, 0, w, h);
//     g = c.createRadialGradient(sx, sy, 0, sx, sy, 34 * k); g.addColorStop(0, css([255, 250, 232], 0.95 * a)); g.addColorStop(1, css(sc, 0));
//     c.fillStyle = g; c.beginPath(); c.arc(sx, sy, 34 * k, 0, TAU); c.fill();
//     c.restore();
//   }
//   if (night > 0.45) {
//     const a = smooth((night - 0.45) / 0.45) * (1 - E.overcast * 0.7);
//     c.save(); c.globalCompositeOperation = 'screen';
//     let g = c.createRadialGradient(sx, sy, 0, sx, sy, h * 0.42); g.addColorStop(0, `rgba(190,205,255,${0.28 * a})`); g.addColorStop(0.25, `rgba(160,180,240,${0.09 * a})`); g.addColorStop(1, 'rgba(150,170,230,0)');
//     c.fillStyle = g; c.fillRect(0, 0, w, h);
//     c.restore();
//     c.save(); c.globalAlpha = a;
//     c.fillStyle = '#f0ecdd'; c.beginPath(); c.arc(sx, sy, 30 * k, 0, TAU); c.fill();
//     c.fillStyle = 'rgba(150,150,160,.28)';
//     [[-9, -6, 9], [8, 5, 11], [-3, 12, 6], [11, -10, 5]].forEach(m => { c.beginPath(); c.arc(sx + m[0] * k, sy + m[1] * k, m[2] * k, 0, TAU); c.fill(); });
//     c.fillStyle = 'rgba(40,50,90,.3)'; c.beginPath(); c.arc(sx + 12 * k, sy + 4 * k, 30 * k, -1.2, 1.9); c.arc(sx + 2 * k, sy, 28 * k, 1.9, -1.2, true); c.fill();
//     c.restore();
//   }
//   // clouds
//   const ca = (0.82 - night * 0.45) * (0.55 + E.overcast * 0.6);
//   for (const cl of st.clouds) {
//     const sp = cl.sp * (0.5 + E.wind * 0.6), cw = cl.s * k * 520, x = ((E.t * sp + cl.off * (w + cw * 2)) % (w + cw * 2)) - cw, y = h * cl.y;
//     c.globalAlpha = clamp(ca * cl.a); c.drawImage(st.cloudSprites[cl.sp2], x, y, cw, cw * 0.4); c.globalAlpha = 1;
//   }
//   if (E.overcast > 0.05) {
//     c.fillStyle = vgrad(c, 0, h * 0.62, css(desat(P.top, 0.8), 0.55 * E.overcast), css(desat(P.mid, 0.8), 0.12 * E.overcast)); c.fillRect(0, 0, w, h * 0.62);
//   }
// }

// /* ═════════════════════════ shared scene helpers ═════════════════════════ */
// function grassBlades(c, S, rnd, x0, x1, baseY, hMin, hMax, n, col) {
//   for (let i = 0; i < n; i++) {
//     const x = x0 + rnd() * (x1 - x0), h = (hMin + rnd() * (hMax - hMin)) * S.k, w = (2.5 + rnd() * 4) * S.k, bend = (rnd() - 0.5) * h * 0.5;
//     c.fillStyle = tone(col, (rnd() - 0.4) * 0.35, 0.95);
//     c.beginPath(); c.moveTo(x - w, baseY + 3); c.quadraticCurveTo(x + bend * 0.3, baseY - h * 0.6, x + bend, baseY - h);
//     c.quadraticCurveTo(x + bend * 0.3 + w * 0.5, baseY - h * 0.55, x + w, baseY + 3); c.closePath(); c.fill();
//   }
// }
// function flowers(c, S, rnd, n, x0, x1, y0, y1, cols) {
//   for (let i = 0; i < n; i++) {
//     const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), s = (1.5 + rnd() * 2.6) * S.k * (0.5 + (y - y0) / (y1 - y0));
//     c.fillStyle = hx(pick(rnd, cols), 0.85); c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
//   }
// }
// const SCENES = [];

// /* the road that leads from the foreground up to the kingdom gate */
// function roadCurve(S) {
//   const p = [[0.33, 1.07], [0.17, 0.9], [0.76, 0.8], [0.68, 0.658]];
//   return s => {
//     const m = 1 - s, f = (a, b, c2, d) => m * m * m * a + 3 * m * m * s * b + 3 * m * s * s * c2 + s * s * s * d;
//     return { x: S.X(f(p[0][0], p[1][0], p[2][0], p[3][0])), y: S.Y(f(p[0][1], p[1][1], p[2][1], p[3][1])), w: S.w * (0.2 * Math.pow(1 - s, 2.3) + 0.011) };
//   };
// }
// const SKY_PAL = { walls: ['#cbbfa6', '#c1b49b', '#d3c7ad', '#b9ad98'], roofs: ['#98664f', '#8a6a5c', '#7a6a6e', '#a07058'], stone: '#b5aea2', towerRoof: '#6f6a78', flag: '#8d5a52' };

// /* ═══════════════════════ 0 · KINGDOM OUTSKIRTS · early morning ═══════════════════════ */
// SCENES.push({
//   id: 'outskirts', focus: [0.68, 0.62], pan: 1, hz: 0.62,
//   layers: [
//     { d: 0.03, fog: 0.12, paint(c, S, r) {
//       ridge(c, S, r, { base: 0.5, amp: 0.2, rough: 0.5, sharp: true, freq: 1.5, col: '#6b869f', colBot: '#93aab6', snow: 0.05, facets: 22 });
//       ridge(c, S, r, { base: 0.565, amp: 0.15, rough: 0.5, sharp: true, freq: 2.3, col: '#587490', colBot: '#86a0ad', facets: 18, snow: 0.02 });
//       const f = ridge(c, S, r, { base: 0.608, amp: 0.05, rough: 0.55, freq: 3, col: '#718c88', colBot: '#90a89d' });
//       treeLine(c, S, r, f, { size: 34, dens: 0.5, cols: ['#617c78', '#6a847e', '#5a7471'], dy: 5 });
//     } },
//     { d: 0.1, fog: 0.1, paint(c, S, r) {
//       const left = ridge(c, S, r, { base: 0.645, amp: 0.035, rough: 0.5, col: '#6d8874', colBot: '#80987f', bump: [0.1, 0.05, 0.14, 2] });
//       treeLine(c, S, r, left, { size: 44, dens: 0.4, cols: ['#5b7766', '#668272', '#52705f'], dy: 6, broad: 0.15 });
//       ridge(c, S, r, { base: 0.662, amp: 0.012, rough: 0.5, freq: 3, col: '#82a075', colBot: '#96ab84', bump: [0.65, 0.055, 0.2, 4] });
//       skyline(c, S, r, { cx: S.X(0.675), base: S.Y(0.612), sc: 0.82, pal: SKY_PAL });
//     }, dyn(c, E, S, lay) {
//       lay.out.flags.forEach(f => flagAt(c, E, f, S.k * 0.8));
//       for (let i = 0; i < 5; i++) {
//         const x = ((E.t * (14 + i * 3) + i * 230) % (S.w + 200)) - 100, y = S.h * (0.22 + i * 0.03) + Math.sin(E.t * 0.8 + i) * 10;
//         bird(c, x, y, 5 * S.k, E.t, i * 1.7, 'rgba(60,66,78,.6)');
//       }
//     } },
//     { d: 0.3, fog: 0.06, paint(c, S, r) {
//       const k = S.k;
//       ridge(c, S, r, { base: 0.688, amp: 0.012, rough: 0.5, freq: 2, col: '#94a977', colBot: '#a3b583', step: 10 });
//       // meadow & fields down to the bottom
//       c.fillStyle = vgrad(c, S.Y(0.68), S.Y(1), '#9bae79', '#869d63'); c.fillRect(0, S.Y(0.69), S.W, S.H);
//       const fc = ['#a9b880', '#bcb988', '#9cab74', '#c4b87e', '#90a670', '#b2a56f', '#a7b192', '#b7a982'];
//       const addField = (u, v, wq, hq) => {
//         const x = S.X(u), y = S.Y(v), w = wq * S.w, h = hq * S.h, col = pick(r, fc), sk = w * 0.18;
//         c.fillStyle = tone(col, 0); c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w + sk, y + h); c.lineTo(x - sk * 0.4, y + h); c.closePath(); c.fill();
//         c.save(); c.clip(); c.strokeStyle = 'rgba(60,70,40,.11)'; c.lineWidth = Math.max(1, k * 1.3);
//         for (let i = 1; i < 11; i++) { const t = i / 11; c.beginPath(); c.moveTo(x + w * t, y); c.lineTo(x + w * t + sk * 0.9 - w * 0.02, y + h); c.stroke(); }
//         c.restore();
//         c.strokeStyle = tone('#5d7650', -0.1, 0.8); c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w + sk, y + h); c.stroke();
//       };
//       addField(0.0, 0.69, 0.12, 0.035); addField(0.13, 0.693, 0.1, 0.03); addField(0.25, 0.69, 0.11, 0.04); addField(0.4, 0.69, 0.1, 0.04);
//       addField(0.8, 0.688, 0.13, 0.04); addField(0.94, 0.69, 0.1, 0.034); addField(-0.02, 0.725, 0.19, 0.05); addField(0.19, 0.735, 0.17, 0.055);
//       addField(0.82, 0.73, 0.2, 0.055);
//       // river
//       const rp = s => { const m = 1 - s, f = (a, b, c2, d) => m * m * m * a + 3 * m * m * s * b + 3 * m * s * s * c2 + s * s * s * d; return [f(0.62, 0.5, 0.3, -0.05), f(0.667, 0.7, 0.68, 0.79)]; };
//       const L = [], R = [];
//       for (let i = 0; i <= 24; i++) { const s = i / 24, q = rp(s), wd = (3 + s * 26) * k; L.push([S.X(q[0]), S.Y(q[1]) - wd / 2]); R.push([S.X(q[0]), S.Y(q[1]) + wd / 2]); }
//       c.fillStyle = '#9fb9c1'; c.beginPath(); L.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); R.reverse().forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fill();
//       c.strokeStyle = 'rgba(255,248,230,.38)'; c.lineWidth = 2 * k; c.beginPath(); L.forEach((p, i) => i ? c.lineTo(p[0], p[1] + 2 * k) : c.moveTo(p[0], p[1] + 2 * k)); c.stroke();
//       // hedgerows
//       for (let i = 0; i < 26; i++) { const x = S.X(r() < 0.5 ? r() * 0.46 : 0.78 + r() * 0.3), y = S.Y(0.69 + r() * 0.07); c.fillStyle = tone('#587350', (r() - 0.5) * 0.2); c.beginPath(); c.ellipse(x, y, (8 + r() * 14) * k, (4 + r() * 5) * k, 0, 0, TAU); c.fill(); }
//       // road
//       const rc = roadCurve(S), Lr = [], Rr = [], n = 36;
//       for (let i = 0; i <= n; i++) { const s = i / n, q = rc(s), wob = Math.sin(s * 9) * 0.006 * S.w; Lr.push([q.x - q.w / 2 + wob, q.y]); Rr.push([q.x + q.w / 2 + wob, q.y]); }
//       const edge = (pts, dx) => pts.map(p => [p[0] + dx, p[1]]);
//       c.fillStyle = tone('#6f8a54', -0.05); c.beginPath(); edge(Lr, -9 * k).forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); edge(Rr, 9 * k).reverse().forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fill();
//       const rg = vgrad(c, S.Y(0.66), S.Y(1.05), '#b9a888', '#a48e6e');
//       c.fillStyle = rg; c.beginPath(); Lr.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); Rr.slice().reverse().forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fill();
//       c.save(); c.clip();
//       for (let j = -1; j <= 1; j += 2) {
//         c.strokeStyle = 'rgba(70,55,40,.18)'; c.lineWidth = 7 * k; c.beginPath();
//         for (let i = 0; i <= n; i++) { const s = i / n, q = rc(s), x = q.x + j * q.w * 0.2 + Math.sin(s * 9) * 0.006 * S.w; c.lineWidth = Math.max(1, q.w * 0.07); i ? c.lineTo(x, q.y) : c.moveTo(x, q.y); }
//         c.stroke();
//       }
//       c.strokeStyle = 'rgba(80,100,50,.35)'; c.lineWidth = 2 * k; c.beginPath(); for (let i = 0; i <= n; i++) { const s = i / n, q = rc(s); const x = q.x + Math.sin(s * 9) * 0.006 * S.w; i ? c.lineTo(x, q.y) : c.moveTo(x, q.y); } c.stroke();
//       for (let i = 0; i < 90; i++) { const s = Math.pow(r(), 1.4) * 0.9, q = rc(s); c.fillStyle = tone('#a89a84', (r() - 0.5) * 0.3, 0.7); c.beginPath(); c.ellipse(q.x + (r() - 0.5) * q.w * 0.9, q.y, q.w * 0.02 + 1, q.w * 0.01 + 0.6, 0, 0, TAU); c.fill(); }
//       c.restore();
//       // windmill
//       const mx = S.X(0.2), my = S.Y(0.692), mh = 92 * k;
//       c.fillStyle = vgrad(c, my - mh, my, '#d8ccb2', '#b3a68e'); c.beginPath(); c.moveTo(mx - 22 * k, my); c.lineTo(mx - 13 * k, my - mh); c.lineTo(mx + 13 * k, my - mh); c.lineTo(mx + 22 * k, my); c.closePath(); c.fill();
//       c.fillStyle = 'rgba(28,34,64,.14)'; c.beginPath(); c.moveTo(mx + 6 * k, my); c.lineTo(mx + 5 * k, my - mh); c.lineTo(mx + 13 * k, my - mh); c.lineTo(mx + 22 * k, my); c.closePath(); c.fill();
//       c.fillStyle = '#6d5850'; c.beginPath(); c.moveTo(mx - 17 * k, my - mh); c.quadraticCurveTo(mx, my - mh - 34 * k, mx + 17 * k, my - mh); c.closePath(); c.fill();
//       c.fillStyle = '#3e3430'; c.fillRect(mx - 5 * k, my - 20 * k, 10 * k, 20 * k);
//       S.out.mill = { x: mx, y: my - mh + 4 * k, len: 62 * k };
//       // farmhouses
//       [[0.36, 0.705, 70], [0.88, 0.7, 84], [0.97, 0.725, 64]].forEach(a => facade(c, S, r, S.X(a[0]), S.Y(a[1]), a[2] * k, a[2] * 0.62 * k, { floors: 1, base: 5 * k, litP: 0.3, roofH: a[2] * 0.4 * k, shutter: null }));
//       // oaks & orchard
//       [[0.31, 0.72, 22], [0.45, 0.7, 20], [0.7, 0.695, 17], [0.76, 0.7, 19], [0.07, 0.72, 25], [0.93, 0.76, 30]].forEach(a => broadleaf(c, S.X(a[0]), S.Y(a[1]), a[2] * k, pick(r, ['#6e8a58', '#78905c', '#667f52']), r));
//     }, dyn(c, E, S, lay) {
//       const k = S.k, m = lay.out.mill;
//       if (m) {
//         const rot = E.t * 0.35 * (0.6 + E.wind * 0.6);
//         c.save(); c.translate(m.x, m.y); c.rotate(rot); c.strokeStyle = '#5c4a3e'; c.lineWidth = 2.4 * k;
//         for (let i = 0; i < 4; i++) {
//           c.save(); c.rotate(i * Math.PI / 2); c.beginPath(); c.moveTo(0, 0); c.lineTo(m.len, 0); c.stroke();
//           c.fillStyle = 'rgba(232,222,198,.8)'; c.fillRect(m.len * 0.25, -m.len * 0.05, m.len * 0.7, -m.len * 0.19);
//           c.strokeStyle = 'rgba(70,55,45,.5)'; c.lineWidth = 1; for (let q = 1; q < 6; q++) { c.beginPath(); c.moveTo(m.len * (0.25 + q * 0.12), -m.len * 0.05); c.lineTo(m.len * (0.25 + q * 0.12), -m.len * 0.24); c.stroke(); }
//           c.restore();
//         }
//         c.restore();
//       }
//       lay.out.smoke.forEach((sm, i) => smokeAt(c, E, sm.x, sm.y, 0.7, k, i * 0.37));
//       // travellers on the road
//       const rc = roadCurve(S), items = [];
//       const mk = (off, sp, type, col, extra) => { const s = 0.07 + ((E.t * sp + off) % 1) * 0.86; items.push({ s, type, col, extra }); };
//       mk(0.1, 0.0075, 'cart'); mk(0.32, 0.011, 'traveler', PAL.cloaks[1]); mk(0.5, 0.0095, 'merchant', PAL.cloaks[4]); mk(0.67, 0.013, 'villager', PAL.cloaks[3]); mk(0.8, 0.0105, 'mage', PAL.cloaks[5]); mk(0.92, 0.0085, 'villager', PAL.cloaks[8]);
//       items.sort((a, b) => a.s - b.s);
//       for (const it of items) {
//         const q = rc(it.s), q2 = rc(it.s + 0.01), dir = q2.x >= q.x ? 1 : -1, hgt = q.w * 0.5, fade = smooth(Math.min(it.s - 0.07, 0.93 - it.s) / 0.05);
//         const wob = Math.sin(it.s * 9) * 0.006 * S.w;
//         c.save(); c.globalAlpha *= clamp(fade);
//         if (it.type === 'cart') {
//           const sz = q.w * 0.95; cart(c, q.x + wob, q.y, sz, dir, E.t, { dist: E.t * 40 * it.s * 0.2 }); horse(c, q.x + wob + dir * sz * 0.95, q.y, sz * 0.9, dir, E.t, '#6b5648', { gait: 4.5 });
//         } else walker(c, q.x + wob, q.y, hgt, E.t, it.s * 40, it.col, { dir, type: it.type, pace: 4 + it.s * 2 });
//         c.restore();
//       }
//     } },
//     { d: 0.7, fog: 0.0, mot: 160, paint(c, S, r) {
//       const k = S.k;
//       // framing oak (left) and trees (right)
//       broadleaf(c, S.X(0.0), S.Y(1.02), 95 * k, '#617c4e', r);
//       broadleaf(c, S.X(1.03), S.Y(1.04), 110 * k, '#5b7549', r);
//       broadleaf(c, S.X(0.93), S.Y(0.9), 38 * k, '#6d8656', r);
//       flowers(c, S, r, 150, S.X(0), S.X(1), S.Y(0.84), S.Y(1.0), ['#e8e0b4', '#d5c06a', '#b7a7c9', '#e9d6d0', '#cf8f7f']);
//       c.fillStyle = vgrad(c, S.Y(0.86), S.Y(1), 'rgba(100,126,76,0)', 'rgba(88,112,66,.55)'); c.fillRect(0, S.Y(0.86), S.W, S.H);
//       grassBlades(c, S, r, 0, S.W, S.Y(1.01), 18, 62, 260, '#6a8452');
//     } }
//   ]
// });

// /* ═════════════════════════ more shared pieces ═════════════════════════ */
// function emblem(c, x, y, r) {
//   c.fillStyle = '#3d4d68'; c.beginPath(); c.moveTo(x - r * 0.8, y - r); c.lineTo(x + r * 0.8, y - r); c.lineTo(x + r * 0.8, y + r * 0.1); c.quadraticCurveTo(x + r * 0.7, y + r * 0.9, x, y + r * 1.25); c.quadraticCurveTo(x - r * 0.7, y + r * 0.9, x - r * 0.8, y + r * 0.1); c.closePath(); c.fill();
//   c.strokeStyle = '#c6a760'; c.lineWidth = r * 0.12; c.stroke();
//   c.strokeStyle = '#cfd3d6'; c.lineWidth = r * 0.13; c.lineCap = 'round';
//   c.beginPath(); c.moveTo(x - r * 0.55, y + r * 0.55); c.lineTo(x + r * 0.55, y - r * 0.6); c.moveTo(x + r * 0.55, y + r * 0.55); c.lineTo(x - r * 0.55, y - r * 0.6); c.stroke();
//   c.strokeStyle = '#8a6a3e'; c.lineWidth = r * 0.1; c.beginPath(); c.moveTo(x - r * 0.3, y + r * 0.2); c.lineTo(x - r * 0.06, y - r * 0.05); c.moveTo(x + r * 0.3, y + r * 0.2); c.lineTo(x + r * 0.06, y - r * 0.05); c.stroke();
//   c.fillStyle = '#d9bb70'; c.beginPath(); c.moveTo(x, y - r * 0.38); c.lineTo(x + r * 0.15, y); c.lineTo(x, y + r * 0.38); c.lineTo(x - r * 0.15, y); c.closePath(); c.fill();
// }
// function banner(c, x, y, w, h, col) {
//   c.fillStyle = col; c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.lineTo(x, y + h - w * 0.35); c.lineTo(x - w / 2, y + h); c.closePath(); c.fill();
//   c.fillStyle = 'rgba(255,240,210,.12)'; c.fillRect(x - w / 2, y, w * 0.4, h * 0.9);
//   c.strokeStyle = '#c6a760'; c.lineWidth = Math.max(1, w * 0.05); c.beginPath(); c.moveTo(x - w / 2 + w * 0.08, y + h * 0.04); c.lineTo(x + w / 2 - w * 0.08, y + h * 0.04); c.stroke();
//   c.fillStyle = '#cdb26c'; c.beginPath(); c.arc(x, y + h * 0.3, w * 0.2, 0, TAU); c.fill();
//   c.fillStyle = col; c.beginPath(); c.arc(x, y + h * 0.3, w * 0.12, 0, TAU); c.fill();
// }
// function canopyCorner(c, S, rnd, x, y, r, col, n = 16) {
//   const bl = [];
//   for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = r * Math.sqrt(rnd()) * 0.9; bl.push([x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.22 + rnd() * 0.22)]); }
//   bl.forEach(b => { c.fillStyle = tone(col, -0.32); c.beginPath(); c.arc(b[0] + r * 0.05, b[1] + r * 0.08, b[2], 0, TAU); c.fill(); });
//   bl.forEach(b => { c.fillStyle = tone(col, 0); c.beginPath(); c.arc(b[0], b[1], b[2] * 0.9, 0, TAU); c.fill(); });
//   bl.forEach(b => { c.fillStyle = tone(col, 0.12, 0.35); c.beginPath(); c.arc(b[0] - r * 0.06, b[1] - r * 0.07, b[2] * 0.55, 0, TAU); c.fill(); });
// }
// /* rows of cobbles in perspective between y0..y1; halfW(t) gives half width at depth t(0 far..1 near) */
// function cobbles(c, S, rnd, cx, y0, y1, hw0, hw1, base, rows) {
//   const k = S.k;
//   for (let j = 0; j < rows; j++) {
//     const t = Math.pow(j / rows, 1.7), t2 = Math.pow((j + 1) / rows, 1.7), ya = lerp(y0, y1, t), yb = lerp(y0, y1, t2), hw = lerp(hw0, hw1, t), sw = lerp(11 * k, 56 * k, t), sh = Math.max(2, yb - ya);
//     for (let x = cx - hw; x < cx + hw; x += sw * (0.85 + rnd() * 0.3)) {
//       const w = sw * (0.8 + rnd() * 0.25);
//       c.fillStyle = tone(base, (rnd() - 0.5) * 0.3, 0.9);
//       c.beginPath(); c.ellipse(x + w / 2, ya + sh / 2, w * 0.5, sh * 0.5, 0, 0, TAU); c.fill();
//       c.strokeStyle = 'rgba(30,28,36,.18)'; c.lineWidth = Math.max(0.6, sw * 0.04); c.stroke();
//     }
//   }
// }
// function puddle(c, x, y, rx, ry, rnd) {
//   c.fillStyle = 'rgba(176,196,206,.55)'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
//   c.fillStyle = 'rgba(255,250,236,.4)'; c.beginPath(); c.ellipse(x - rx * 0.15, y - ry * 0.25, rx * 0.6, ry * 0.3, 0, 0, TAU); c.fill();
//   c.strokeStyle = 'rgba(60,70,84,.25)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.stroke();
// }
// function backCart(c, x, y, s, t, toward) {
//   // rear/front view of a covered wagon + horse, for traffic along the depth axis
//   c.save(); c.translate(x, y);
//   const horseF = () => {
//     const hx0 = toward ? 0 : 0, hy = toward ? s * 0.0 : -s * 0.12, hs = s * 0.8, sw = Math.sin(t * 4.2 + s);
//     c.fillStyle = 'rgba(20,25,40,.16)'; c.beginPath(); c.ellipse(hx0, hy, hs * 0.3, hs * 0.05, 0, 0, TAU); c.fill();
//     c.strokeStyle = '#4b3b32'; c.lineWidth = hs * 0.08; c.lineCap = 'round';
//     c.beginPath(); c.moveTo(hx0 - hs * 0.09, hy - hs * 0.5); c.lineTo(hx0 - hs * 0.09 + sw * hs * 0.03, hy); c.moveTo(hx0 + hs * 0.09, hy - hs * 0.5); c.lineTo(hx0 + hs * 0.09 - sw * hs * 0.03, hy); c.stroke();
//     c.fillStyle = '#6b5648'; c.beginPath(); c.ellipse(hx0, hy - hs * 0.68, hs * 0.2, hs * 0.26, 0, 0, TAU); c.fill();
//     c.fillStyle = '#7c6755'; c.beginPath(); c.ellipse(hx0 - hs * 0.05, hy - hs * 0.74, hs * 0.1, hs * 0.16, 0, 0, TAU); c.fill();
//     if (toward) { c.fillStyle = '#5e4b3f'; c.beginPath(); c.ellipse(hx0, hy - hs * 1.02, hs * 0.1, hs * 0.16, 0, 0, TAU); c.fill(); c.fillStyle = '#3d312b'; c.beginPath(); c.moveTo(hx0 - hs * 0.08, hy - hs * 1.1); c.lineTo(hx0, hy - hs * 1.2); c.lineTo(hx0 + hs * 0.08, hy - hs * 1.1); c.fill(); }
//     else { c.strokeStyle = '#3d312b'; c.lineWidth = hs * 0.05; c.beginPath(); c.moveTo(hx0, hy - hs * 0.9); c.quadraticCurveTo(hx0 + sw * hs * 0.1, hy - hs * 0.6, hx0 + sw * hs * 0.06, hy - hs * 0.3); c.stroke(); }
//   };
//   const cartF = () => {
//     c.fillStyle = '#7a5b43'; c.fillRect(-s * 0.4, -s * 0.5, s * 0.8, s * 0.26);
//     c.fillStyle = '#d6caae'; c.beginPath(); c.moveTo(-s * 0.37, -s * 0.5); c.quadraticCurveTo(-s * 0.37, -s * 1.05, 0, -s * 1.06); c.quadraticCurveTo(s * 0.37, -s * 1.05, s * 0.37, -s * 0.5); c.closePath(); c.fill();
//     c.fillStyle = 'rgba(30,26,40,.2)'; c.beginPath(); c.moveTo(s * 0.1, -s * 1.05); c.quadraticCurveTo(s * 0.37, -s * 1.05, s * 0.37, -s * 0.5); c.lineTo(s * 0.1, -s * 0.5); c.closePath(); c.fill();
//     c.fillStyle = '#3f3129'; c.fillRect(-s * 0.44, -s * 0.34, s * 0.06, s * 0.34); c.fillRect(s * 0.38, -s * 0.34, s * 0.06, s * 0.34);
//   };
//   if (toward) { cartF(); c.save(); c.translate(0, s * 0.3); horseF(); c.restore(); }
//   else { c.save(); c.translate(0, -s * 0.34); horseF(); c.restore(); cartF(); }
//   c.restore();
// }

// /* ═══════════════════════ 1 · THE GATE · morning ═══════════════════════ */
// const GATE_Q = [];
// { const r = mulberry(404);
//   for (let i = 0; i < 7; i++) GATE_Q.push({ lane: -0.15 - r() * 0.65, sp: 0.007 + r() * 0.007, off: r(), type: i === 1 || i === 4 ? 'cart' : pick(r, ['traveler', 'merchant', 'villager', 'mage', 'villager']), col: pick(r, PAL.cloaks), dir: -1 });
//   for (let i = 0; i < 4; i++) GATE_Q.push({ lane: 0.2 + r() * 0.7, sp: 0.008 + r() * 0.006, off: r(), type: i === 2 ? 'cart' : pick(r, ['traveler', 'villager', 'merchant']), col: pick(r, PAL.cloaks), dir: 1 });
// }
// SCENES.push({
//   id: 'gate', focus: [0.5, 0.5], pan: 1, hz: 0.6,
//   layers: [
//     { d: 0.03, fog: 0.12, paint(c, S, r) {
//       ridge(c, S, r, { base: 0.5, amp: 0.2, rough: 0.5, sharp: true, freq: 1.9, col: '#6b869f', colBot: '#93aab6', snow: 0.05, facets: 22 });
//       const f = ridge(c, S, r, { base: 0.585, amp: 0.06, rough: 0.55, freq: 3, col: '#667f7e', colBot: '#86a095' });
//       treeLine(c, S, r, f, { size: 40, dens: 0.5, cols: ['#587270', '#5f7a76', '#506a68'], dy: 5 });
//     } },
//     { d: 0.1, fog: 0.1, paint(c, S, r) {
//       ridge(c, S, r, { base: 0.5, amp: 0.01, rough: 0.5, col: '#7d9a73', colBot: '#92a883', bump: [0.5, 0.05, 0.22, 4] });
//       skyline(c, S, r, { cx: S.X(0.5), base: S.Y(0.47), sc: 0.95, pal: SKY_PAL });
//     }, dyn(c, E, S, lay) {
//       lay.out.flags.forEach(f => flagAt(c, E, f, S.k));
//       for (let i = 0; i < 4; i++) bird(c, ((E.t * (16 + i * 3) + i * 300) % (S.w + 200)) - 100, S.h * (0.18 + i * 0.03) + Math.sin(E.t + i) * 8, 5 * S.k, E.t, i * 2.1, 'rgba(60,66,78,.6)');
//     } },
//     { d: 0.36, fog: 0.04, mot: 380, paint(c, S, r) {
//       const k = S.k, gy = S.Y(0.745), wt = S.Y(0.4), cx = S.X(0.5), stone = '#a8a193';
//       c.fillStyle = vgrad(c, wt, gy, tone(stone, 0.06), tone(stone, -0.2)); c.fillRect(0, wt, S.W, gy - wt);
//       blocks(c, r, 0, wt, S.W, gy - wt, stone, 36 * k, 21 * k, 0.5);
//       for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(48,54,72,${0.04 + r() * 0.06})`; c.fillRect(r() * S.W, wt + r() * (gy - wt) * 0.4, (2 + r() * 6) * k, (30 + r() * 150) * k); }
//       for (let i = 0; i < 90; i++) { c.fillStyle = hx('#6f8a58', 0.12 + r() * 0.12); c.beginPath(); c.ellipse(r() * S.W, gy - r() * 38 * k, (6 + r() * 18) * k, (3 + r() * 7) * k, 0, 0, TAU); c.fill(); }
//       c.fillStyle = vgrad(c, wt, wt + 60 * k, 'rgba(20,20,32,.28)', 'rgba(20,20,32,0)'); c.fillRect(0, wt, S.W, 60 * k);
//       crenels(c, 0, S.W, wt, 28 * k, 26 * k, tone(stone, -0.06));
//       for (let x = 100 * k; x < S.W; x += 230 * k) { c.fillStyle = 'rgba(24,26,38,.75)'; c.fillRect(x, wt + 90 * k, 6 * k, 38 * k); }
//       // gatehouse block + towers
//       c.fillStyle = vgrad(c, gy - 470 * k, gy, tone(stone, 0.1), tone(stone, -0.18)); c.fillRect(cx - 200 * k, gy - 470 * k, 400 * k, 470 * k);
//       blocks(c, r, cx - 200 * k, gy - 470 * k, 400 * k, 470 * k, stone, 38 * k, 22 * k, 0.45);
//       c.fillStyle = tone(stone, -0.22); c.fillRect(cx - 215 * k, gy - 478 * k, 430 * k, 22 * k);
//       for (let x = cx - 205 * k; x < cx + 200 * k; x += 20 * k) c.fillRect(x, gy - 458 * k, 8 * k, 14 * k);
//       crenels(c, cx - 215 * k, cx + 215 * k, gy - 478 * k, 22 * k, 24 * k, tone(stone, -0.08));
//       tower(c, S, r, cx - 215 * k, gy, 170 * k, 600 * k, stone, '#5f5a6a', 200 * k, { slits: 3, lit: 0.6, flag: '#8d5a52', blocks: true });
//       tower(c, S, r, cx + 215 * k, gy, 170 * k, 600 * k, stone, '#5f5a6a', 200 * k, { slits: 3, lit: 0.6, flag: '#8d5a52', blocks: true });
//       // arch ring
//       const ar = 100 * k, ay = gy - 190 * k;
//       for (let i = 0; i < 15; i++) {
//         const a0 = Math.PI + i * Math.PI / 15, a1 = a0 + Math.PI / 15, ro = ar + 34 * k;
//         c.fillStyle = tone(stone, (r() - 0.5) * 0.22 + 0.04); c.beginPath(); c.moveTo(cx + Math.cos(a0) * ar, ay + Math.sin(a0) * ar); c.lineTo(cx + Math.cos(a0) * ro, ay + Math.sin(a0) * ro); c.lineTo(cx + Math.cos(a1) * ro, ay + Math.sin(a1) * ro); c.lineTo(cx + Math.cos(a1) * ar, ay + Math.sin(a1) * ar); c.closePath(); c.fill();
//         c.strokeStyle = 'rgba(30,30,40,.3)'; c.lineWidth = 1.2; c.stroke();
//       }
//       c.fillStyle = tone(stone, -0.1); c.fillRect(cx - ar - 34 * k, ay, 34 * k, 190 * k); c.fillRect(cx + ar, ay, 34 * k, 190 * k);
//       blocks(c, r, cx - ar - 34 * k, ay, 34 * k, 190 * k, stone, 34 * k, 22 * k, 0.4); blocks(c, r, cx + ar, ay, 34 * k, 190 * k, stone, 34 * k, 22 * k, 0.4);
//       // the glimpse of the city beyond the gate
//       c.save(); c.beginPath(); c.moveTo(cx - ar, gy); c.lineTo(cx - ar, ay); c.arc(cx, ay, ar, Math.PI, 0); c.lineTo(cx + ar, gy); c.closePath(); c.clip();
//       c.fillStyle = vgrad(c, gy - 290 * k, gy, '#f3ddb0', '#c7a97a'); c.fillRect(cx - ar, gy - 290 * k, ar * 2, 290 * k);
//       for (let i = 0; i < 6; i++) { const hx0 = cx - ar + (i * 0.17 + r() * 0.05) * ar * 2, hh = (60 + r() * 70) * k, hw = (34 + r() * 24) * k; c.fillStyle = tone(pick(r, PAL.plaster), -0.05 - i * 0.02); c.fillRect(hx0, gy - 55 * k - hh, hw, hh); c.fillStyle = tone(pick(r, PAL.roofs), -0.08); c.beginPath(); c.moveTo(hx0 - 4 * k, gy - 55 * k - hh); c.lineTo(hx0 + hw / 2, gy - 55 * k - hh - hw * 0.5); c.lineTo(hx0 + hw + 4 * k, gy - 55 * k - hh); c.closePath(); c.fill(); }
//       c.fillStyle = 'rgba(255,238,190,.5)'; c.beginPath(); c.ellipse(cx, gy - 80 * k, ar * 0.55, 90 * k, 0, 0, TAU); c.fill();
//       c.fillStyle = vgrad(c, gy - 60 * k, gy, '#c9b48a', '#8a7556'); c.fillRect(cx - ar, gy - 60 * k, ar * 2, 60 * k);
//       for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(48,40,44,.7)'; const px0 = cx - ar * 0.6 + r() * ar * 1.2; c.fillRect(px0, gy - 58 * k, 6 * k, 20 * k); c.beginPath(); c.arc(px0 + 3 * k, gy - 62 * k, 4 * k, 0, TAU); c.fill(); }
//       c.fillStyle = vgrad(c, gy - 290 * k, gy - 120 * k, 'rgba(14,12,20,.92)', 'rgba(14,12,20,0)'); c.fillRect(cx - ar, gy - 290 * k, ar * 2, 190 * k);
//       let sg = c.createLinearGradient(cx - ar, 0, cx + ar, 0); sg.addColorStop(0, 'rgba(14,12,20,.78)'); sg.addColorStop(0.2, 'rgba(14,12,20,0)'); sg.addColorStop(0.8, 'rgba(14,12,20,0)'); sg.addColorStop(1, 'rgba(14,12,20,.78)');
//       c.fillStyle = sg; c.fillRect(cx - ar, gy - 290 * k, ar * 2, 290 * k);
//       c.strokeStyle = '#2b2622'; c.lineWidth = 5 * k; for (let x = cx - ar + 12 * k; x < cx + ar; x += 17 * k) { c.beginPath(); c.moveTo(x, gy - 292 * k); c.lineTo(x, gy - 168 * k); c.stroke(); c.beginPath(); c.moveTo(x - 3 * k, gy - 168 * k); c.lineTo(x, gy - 150 * k); c.lineTo(x + 3 * k, gy - 168 * k); c.fillStyle = '#2b2622'; c.fill(); }
//       c.lineWidth = 4 * k; for (let y = gy - 270 * k; y < gy - 170 * k; y += 38 * k) { c.beginPath(); c.moveTo(cx - ar, y); c.lineTo(cx + ar, y); c.stroke(); }
//       c.restore();
//       // crest, banners, torches
//       emblem(c, cx, gy - 395 * k, 46 * k);
//       banner(c, cx - 520 * k, wt + 14 * k, 74 * k, 270 * k, '#7a4d4a'); banner(c, cx + 520 * k, wt + 14 * k, 74 * k, 270 * k, '#7a4d4a');
//       banner(c, cx - 880 * k, wt + 14 * k, 74 * k, 270 * k, '#4d5f7a'); banner(c, cx + 880 * k, wt + 14 * k, 74 * k, 270 * k, '#4d5f7a');
//       [-1, 1].forEach(sd => { c.fillStyle = '#2f2824'; c.fillRect(cx + sd * 146 * k - 3 * k, gy - 160 * k, 6 * k, 30 * k); S.lights.push({ kind: 'fire', x: cx + sd * 146 * k - 7 * k, y: gy - 182 * k, w: 14 * k, h: 14 * k, r: 7 * k, k: 0.7, ph: r(), gy: 0 }); });
//     }, dyn(c, E, S, lay) {
//       const k = S.k, gy = S.Y(0.745), cx = S.X(0.5);
//       lay.out.flags.forEach(f => flagAt(c, E, f, k * 1.1));
//       [-1, 1].forEach(sd => {
//         const x = cx + sd * 175 * k, hgt = 128 * k * (1 + Math.sin(E.t * 1.3 + sd) * 0.004);
//         walker(c, x, gy + 10 * k, hgt, E.t, sd, sd < 0 ? '#5a6672' : '#5a6672', { type: 'knight', pace: 0, front: true });
//         c.strokeStyle = '#4b3a2c'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x + sd * hgt * 0.26, gy + 10 * k); c.lineTo(x + sd * hgt * 0.26, gy + 10 * k - hgt * 1.7); c.stroke();
//         c.fillStyle = '#b8bdc2'; c.beginPath(); c.moveTo(x + sd * hgt * 0.26 - 4 * k, gy + 10 * k - hgt * 1.7); c.lineTo(x + sd * hgt * 0.26, gy + 10 * k - hgt * 1.85); c.lineTo(x + sd * hgt * 0.26 + 4 * k, gy + 10 * k - hgt * 1.7); c.fill();
//       });
//     } },
//     { d: 0.62, fog: 0, mot: 300, paint(c, S, r) {
//       const k = S.k, gy = S.Y(0.745), top = S.Y(0.732), cx = S.X(0.5);
//       c.fillStyle = vgrad(c, top, S.H, '#869e69', '#76905c'); c.fillRect(0, top, S.W, S.H - top);
//       for (let i = 0; i < 160; i++) { c.fillStyle = tone('#7d9962', (r() - 0.5) * 0.3, 0.5); c.beginPath(); c.ellipse(r() * S.W, top + r() * (S.H - top), (10 + r() * 40) * k, (3 + r() * 9) * k, 0, 0, TAU); c.fill(); }
//       const hw = t => lerp(112 * k, S.w * 0.37, t);
//       c.fillStyle = tone('#5f7a4c', -0.1); c.beginPath(); c.moveTo(cx - 118 * k, top); c.lineTo(cx + 118 * k, top); c.lineTo(cx + S.w * 0.39, S.H); c.lineTo(cx - S.w * 0.39, S.H); c.closePath(); c.fill();
//       c.fillStyle = vgrad(c, top, S.H, '#a79f8b', '#8a8372'); c.beginPath(); c.moveTo(cx - 104 * k, top); c.lineTo(cx + 104 * k, top); c.lineTo(cx + S.w * 0.37, S.H); c.lineTo(cx - S.w * 0.37, S.H); c.closePath(); c.fill();
//       c.save(); c.clip();
//       cobbles(c, S, r, cx, top, S.H, 104 * k, S.w * 0.37, '#9b9381', 38);
//       for (let i = 0; i < 2; i++) { c.strokeStyle = 'rgba(54,46,40,.2)'; c.lineWidth = 9 * k; c.beginPath(); c.moveTo(cx + (i ? 1 : -1) * 36 * k, top); c.lineTo(cx + (i ? 1 : -1) * S.w * 0.12, S.H); c.stroke(); }
//       puddle(c, cx - S.w * 0.08, S.Y(0.86), 90 * k, 14 * k, r); puddle(c, cx + S.w * 0.13, S.Y(0.93), 130 * k, 20 * k, r); puddle(c, cx + S.w * 0.02, S.Y(0.79), 40 * k, 6 * k, r);
//       c.restore();
//       c.fillStyle = vgrad(c, top, top + 40 * k, 'rgba(20,20,32,.3)', 'rgba(20,20,32,0)'); c.fillRect(0, top, S.W, 40 * k);
//       // roadside: signpost, milestone, shrubs
//       const sx = cx + S.w * 0.33, sy = S.Y(0.82);
//       c.fillStyle = '#5b4637'; c.fillRect(sx - 4 * k, sy - 120 * k, 8 * k, 120 * k);
//       [[-1, 0], [1, 28]].forEach(a => { c.fillStyle = '#7c6248'; c.beginPath(); c.moveTo(sx, sy - 112 * k + a[1] * k); c.lineTo(sx + a[0] * 70 * k, sy - 112 * k + a[1] * k); c.lineTo(sx + a[0] * 82 * k, sy - 100 * k + a[1] * k); c.lineTo(sx + a[0] * 70 * k, sy - 88 * k + a[1] * k); c.lineTo(sx, sy - 88 * k + a[1] * k); c.closePath(); c.fill(); });
//       const mx = cx - S.w * 0.28, my = S.Y(0.85);
//       c.fillStyle = vgrad(c, my - 52 * k, my, '#b0aa9c', '#8c867a'); c.beginPath(); c.moveTo(mx - 16 * k, my); c.lineTo(mx - 14 * k, my - 40 * k); c.quadraticCurveTo(mx, my - 56 * k, mx + 14 * k, my - 40 * k); c.lineTo(mx + 16 * k, my); c.closePath(); c.fill();
//       for (let i = 0; i < 16; i++) { const x = r() < 0.5 ? r() * (cx - S.w * 0.4) : cx + S.w * 0.4 + r() * (S.W - cx - S.w * 0.4), y = S.Y(0.8 + r() * 0.18); c.fillStyle = tone('#5f7a4c', (r() - 0.5) * 0.3); c.beginPath(); c.ellipse(x, y, (14 + r() * 26) * k, (8 + r() * 12) * k, 0, 0, TAU); c.fill(); }
//       broadleaf(c, cx - S.w * 0.43, S.Y(0.8), 36 * k, '#6d8656', r); broadleaf(c, cx + S.w * 0.47, S.Y(0.79), 40 * k, '#667f52', r);
//     }, dyn(c, E, S, lay) {
//       const k = S.k, gy = S.Y(0.745), cx = S.X(0.5), top = S.Y(0.745), items = [];
//       for (const q of GATE_Q) {
//         const ph = (E.t * q.sp + q.off) % 1, u = q.dir < 0 ? 1 - ph : ph, uu = 0.02 + u * 0.96;
//         items.push({ q, u: uu, ph });
//       }
//       items.sort((a, b) => a.u - b.u);
//       for (const it of items) {
//         const { q, u } = it, y = lerp(top + 6 * k, S.H + 30 * k, Math.pow(u, 1.55)), hwid = lerp(104 * k, S.w * 0.37, Math.pow(u, 1.55)), x = cx + q.lane * hwid * 0.86;
//         const hgt = lerp(52 * k, 270 * k, Math.pow(u, 1.45)), fade = smooth(Math.min(u / 0.1, (1 - u) / 0.1));
//         c.save(); c.globalAlpha *= clamp(fade);
//         if (q.type === 'cart') backCart(c, x, y, hgt * 1.0, E.t + q.off * 9, q.dir > 0);
//         else walker(c, x, y, hgt, E.t, q.off * 20, q.col, { front: true, away: q.dir < 0, type: q.type, pace: 4.5 + q.off });
//         c.restore();
//       }
//     } },
//     { d: 1.0, fog: 0, mot: 160, paint(c, S, r) {
//       const k = S.k;
//       canopyCorner(c, S, r, S.X(-0.04), S.Y(-0.02), 330 * k, '#5b7549');
//       canopyCorner(c, S, r, S.X(1.05), S.Y(-0.03), 360 * k, '#566f46');
//       broadleaf(c, S.X(-0.02), S.Y(1.04), 100 * k, '#617c4e', r); broadleaf(c, S.X(1.03), S.Y(1.05), 118 * k, '#5b7549', r);
//       c.fillStyle = vgrad(c, S.Y(0.88), S.Y(1), 'rgba(100,126,76,0)', 'rgba(82,106,62,.5)'); c.fillRect(0, S.Y(0.88), S.W, S.H);
//       grassBlades(c, S, r, 0, S.W, S.Y(1.01), 18, 58, 240, '#678250');
//     } }
//   ]
// });

// /* ═══════════════════════ 2 · MARKET STREETS · midday ═══════════════════════ */
// const STREET_WD = 3.4;
// function streetCam(S) {
//   const vpx = S.X(0.5), vpy = S.Y(0.47), F = S.Y(1.12) - vpy;
//   return { vpx, vpy, F, px: (X, z) => vpx + X * F / z, py: (Y, z) => vpy + (1 - Y) * F / z };
// }
// function quad(c, a, b, d, e, fill, stroke) {
//   c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.closePath();
//   if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); }
// }
// function stall(c, rnd, x, gy, s, col) {
//   const cream = '#e4dac2';
//   c.fillStyle = 'rgba(20,25,40,.16)'; c.beginPath(); c.ellipse(x, gy, s * 0.95, s * 0.12, 0, 0, TAU); c.fill();
//   c.strokeStyle = '#5a4637'; c.lineWidth = Math.max(1.5, s * 0.07); c.beginPath(); c.moveTo(x - s * 0.74, gy); c.lineTo(x - s * 0.74, gy - 1.7 * s); c.moveTo(x + s * 0.74, gy); c.lineTo(x + s * 0.74, gy - 1.7 * s); c.stroke();
//   c.fillStyle = '#7b6046'; c.fillRect(x - s * 0.8, gy - 0.82 * s, 1.6 * s, 0.09 * s); c.fillRect(x - s * 0.7, gy - 0.73 * s, 1.4 * s, 0.72 * s);
//   c.fillStyle = 'rgba(30,25,35,.18)'; c.fillRect(x - s * 0.7, gy - 0.73 * s, 1.4 * s, 0.72 * s);
//   for (let i = 0; i < 9; i++) { const gx = x - s * 0.62 + i * s * 0.155, gcol = pick(rnd, ['#b9573f', '#d3a64a', '#7a9a52', '#8f5f8a', '#c9744a', '#e0d3a6']); c.fillStyle = gcol; c.beginPath(); c.arc(gx, gy - 0.9 * s, s * 0.085, 0, TAU); c.fill(); c.fillStyle = tone(gcol, 0.3, 0.5); c.beginPath(); c.arc(gx - s * 0.02, gy - 0.93 * s, s * 0.035, 0, TAU); c.fill(); }
//   const n = 8, y0 = gy - 1.95 * s, y1 = gy - 1.5 * s;
//   for (let i = 0; i < n; i++) {
//     const xa = x - s * 0.85 + i * s * 1.7 / n, xb = xa + s * 1.7 / n;
//     c.fillStyle = i % 2 ? cream : css(col); c.beginPath(); c.moveTo(xa + s * 0.05 * (i - n / 2) / n, y0); c.lineTo(xb + s * 0.05 * (i + 1 - n / 2) / n, y0); c.lineTo(xb + s * 0.03, y1); c.quadraticCurveTo((xa + xb) / 2, y1 + s * 0.12, xa - s * 0.03, y1); c.closePath(); c.fill();
//   }
//   c.fillStyle = 'rgba(255,240,210,.12)'; c.fillRect(x - s * 0.85, y0, s * 0.5, y1 - y0);
//   c.fillStyle = 'rgba(30,25,40,.18)'; c.fillRect(x + s * 0.4, y0, s * 0.45, y1 - y0);
// }
// const MKT = [];
// { const r = mulberry(77);
//   for (let i = 0; i < 15; i++) MKT.push({ x: (r() - 0.5) * 3.3, sp: (0.2 + r() * 0.25) * (r() < 0.5 ? -1 : 1), off: r() * 40, type: pick(r, ['villager', 'villager', 'merchant', 'traveler', 'mage', 'knight']), col: pick(r, PAL.cloaks), kid: r() < 0.16 });
// }
// SCENES.push({
//   id: 'street', focus: [0.5, 0.47], pan: 0.8, hz: 0.5,
//   layers: [
//     { d: 0.04, fog: 0.22, paint(c, S, r) {
//       const k = S.k, cam = streetCam(S);
//       ridge(c, S, r, { base: 0.47, amp: 0.05, rough: 0.5, freq: 3, col: '#8aa092', colBot: '#a3b4a6' });
//       skyline(c, S, r, { cx: cam.vpx - S.w * 0.06, base: cam.vpy + 4 * k, sc: 0.5, pal: SKY_PAL });
//       const tx = cam.vpx + 28 * k, ty = cam.vpy + 12 * k;
//       tower(c, S, r, tx, ty, 60 * k, 300 * k, '#b9b2a4', '#6a6677', 110 * k, { blocks: true, slits: 2 });
//       c.fillStyle = '#e8e0c8'; c.beginPath(); c.arc(tx, ty - 215 * k, 15 * k, 0, TAU); c.fill(); c.strokeStyle = '#4a4036'; c.lineWidth = 1.5 * k; c.beginPath(); c.moveTo(tx, ty - 215 * k); c.lineTo(tx, ty - 224 * k); c.moveTo(tx, ty - 215 * k); c.lineTo(tx + 6 * k, ty - 212 * k); c.stroke();
//     } },
//     { d: 0.45, fog: 0.03, mot: 420, brush: 900, paint(c, S, r) {
//       const k = S.k, cam = streetCam(S), { vpx, vpy, F, px, py } = cam, Wd = STREET_WD, P = (X, z, Y) => [px(X, z), py(Y, z)];
//       const haze = '#d3dcd9';
//       const dist = z => clamp((z - 4) / 30) * 0.55;
//       // ground
//       c.fillStyle = vgrad(c, vpy, S.H, '#b3aa96', '#8e8674'); c.fillRect(0, vpy + 4, S.W, S.H);
//       c.fillStyle = vgrad(c, vpy, S.H, '#aaa18d', '#867f6d'); quad(c, P(-Wd, 40, 0), P(Wd, 40, 0), P(Wd, 0.9, 0), P(-Wd, 0.9, 0), vgrad(c, vpy, S.H, '#b0a792', '#8a8271'));
//       c.save(); quad(c, P(-Wd, 40, 0), P(Wd, 40, 0), P(Wd, 0.9, 0), P(-Wd, 0.9, 0)); c.clip();
//       for (let z = 1.1; z < 40; z *= 1.07) {
//         const zb = z * 1.07, ya = py(0, zb), yb = py(0, z), sw = 0.24 * F / z;
//         for (let X = -Wd; X < Wd; X += 0.24 * (0.85 + r() * 0.3)) {
//           const x = px(X, z), w = sw * 0.92 * (0.85 + r() * 0.2);
//           c.fillStyle = css(mix(tone('#a39b8a', (r() - 0.5) * 0.2), haze, dist(z))); c.beginPath(); c.ellipse(x + w / 2, (ya + yb) / 2, w * 0.5, Math.max(1, (yb - ya) * 0.46), 0, 0, TAU); c.fill();
//         }
//       }
//       c.strokeStyle = 'rgba(52,44,40,.1)'; c.lineWidth = 0.22 * F / 3; c.beginPath(); c.moveTo(px(0, 40), py(0, 40)); c.lineTo(px(0.05, 1.2), py(0, 1.2)); c.stroke();
//       [[-1.2, 5.5, 1.2], [1.4, 9, 1.4], [0.2, 3.2, 0.8], [-0.4, 13, 1.1]].forEach(a => { const x = px(a[0], a[1]), y = py(0, a[1]), s = F / a[1]; puddle(c, x, y, a[2] * s * 0.7, a[2] * s * 0.12, r); });
//       c.restore();
//       // buildings, far to near
//       const segs = [];
//       for (const side of [-1, 1]) { let z = 1.9 + (side > 0 ? 0.6 : 0); while (z < 36) { const len = 1.5 + r() * 1.7; segs.push({ side, za: z, zb: z + len, fl: 2 + ((r() * 3) | 0), wall: pick(r, PAL.plaster), roof: pick(r, PAL.roofs), shut: r() < 0.7 ? pick(r, ['#5f7a6e', '#8a5a4e', '#5d6f86', '#7b7a52']) : null, sign: r() < 0.4, door: (r() * 3) | 0 }); z += len; } }
//       segs.sort((a, b) => b.za - a.za);
//       const FH = 1.05, H0 = 0.35, D = 2.6;
//       for (const sg of segs) {
//         const { side, za, zb, fl } = sg, Hb = H0 + fl * FH, Rh = 1.0 + r() * 0.45, zm = (za + zb) / 2, X0 = side * Wd, X1 = side * (Wd + D), dk = dist(za);
//         const wallc = mix(tone(sg.wall, side > 0 ? -0.1 : 0.03), haze, dk), roofc = mix(tone(sg.roof, 0), haze, dk * 0.8), beam = mix('#4a3b33', haze, dk);
//         quad(c, P(X0, za, 0), P(X1, za, 0), P(X1, za, Hb + Rh * 0.2), P(X0, za, Hb + Rh * 0.2), css(mix(wallc, '#202840', 0.22)));
//         const wq = [P(X0, za, 0), P(X0, zb, 0), P(X0, zb, Hb), P(X0, za, Hb)];
//         c.fillStyle = vgrad(c, Math.min(wq[2][1], wq[3][1]), Math.max(wq[0][1], wq[1][1]), css(mix(wallc, '#fff2d6', 0.1)), css(mix(wallc, '#202840', 0.18)));
//         quad(c, wq[0], wq[1], wq[2], wq[3], c.fillStyle);
//         // stone base
//         quad(c, P(X0, za, 0), P(X0, zb, 0), P(X0, zb, H0), P(X0, za, H0), css(mix([140, 134, 124], haze, dk)));
//         // gable + roof slope
//         c.beginPath(); const g0 = P(X0, za, Hb), g1 = P(X0, zb, Hb), g2 = P(X0, zm, Hb + Rh); c.moveTo(g0[0], g0[1]); c.lineTo(g1[0], g1[1]); c.lineTo(g2[0], g2[1]); c.closePath(); c.fillStyle = css(mix(tone(sg.wall, -0.06), haze, dk)); c.fill();
//         const A = P(X0, za, Hb), B = P(X0, zm, Hb + Rh), B2 = P(X1, zm, Hb + Rh), A2 = P(X1, za, Hb);
//         quad(c, A, B, B2, A2, css(roofc));
//         c.strokeStyle = 'rgba(25,20,28,.18)'; c.lineWidth = Math.max(0.8, 0.03 * F / zm);
//         for (let i = 1; i < 6; i++) { const t = i / 6; c.beginPath(); c.moveTo(lerp(A[0], A2[0], t), lerp(A[1], A2[1], t)); c.lineTo(lerp(B[0], B2[0], t), lerp(B[1], B2[1], t)); c.stroke(); }
//         c.strokeStyle = css(mix(tone(sg.roof, -0.4), haze, dk)); c.lineWidth = Math.max(1, 0.07 * F / zm); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(g1[0], g1[1]); c.stroke();
//         // timber
//         c.strokeStyle = css(beam); c.lineWidth = Math.max(0.8, 0.07 * F / zm);
//         for (let f = 1; f <= fl; f++) { const Y = H0 + f * FH, a = P(X0, za, Y), b = P(X0, zb, Y); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
//         const nb = Math.max(2, Math.round((zb - za) / 0.9)), bay = (zb - za) / nb;
//         for (let i = 0; i <= nb; i++) { const z = za + i * bay, a = P(X0, z, 0), b = P(X0, z, Hb); c.lineWidth = Math.max(0.8, 0.07 * F / z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
//         for (let i = 0; i < nb; i++) {
//           const z0 = za + i * bay, zc = z0 + bay / 2, hw = 0.18;
//           for (let f = 0; f < fl; f++) {
//             const Y0 = H0 + f * FH + 0.28, Y1 = Y0 + 0.5;
//             if (f === 0 && i === sg.door % nb) { quad(c, P(X0, zc - 0.24, 0), P(X0, zc + 0.24, 0), P(X0, zc + 0.24, 0.85), P(X0, zc - 0.24, 0.85), css(mix([58, 45, 38], haze, dk))); continue; }
//             if (f === 0) { quad(c, P(X0, zc - hw, 0.5), P(X0, zc + hw, 0.5), P(X0, zc + hw, 0.95), P(X0, zc - hw, 0.95), css(mix([46, 52, 66], haze, dk))); continue; }
//             if (sg.shut) { const sc2 = css(mix(sg.shut, haze, dk)); quad(c, P(X0, zc - hw - 0.17, Y0 - 0.02), P(X0, zc - hw - 0.01, Y0 - 0.02), P(X0, zc - hw - 0.01, Y1 + 0.02), P(X0, zc - hw - 0.17, Y1 + 0.02), sc2); quad(c, P(X0, zc + hw + 0.01, Y0 - 0.02), P(X0, zc + hw + 0.17, Y0 - 0.02), P(X0, zc + hw + 0.17, Y1 + 0.02), P(X0, zc + hw + 0.01, Y1 + 0.02), sc2); }
//             quad(c, P(X0, zc - hw, Y0), P(X0, zc + hw, Y0), P(X0, zc + hw, Y1), P(X0, zc - hw, Y1), css(mix([50, 62, 80], haze, dk)));
//             const a = P(X0, zc, Y0), b = P(X0, zc, Y1); c.strokeStyle = css(beam); c.lineWidth = Math.max(0.6, 0.04 * F / zc); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
//           }
//         }
//         // chimney
//         const cxp = px(side * (Wd + 1.7), zm - 0.2), cyb = py(Hb + Rh * 0.55, zm - 0.2), cyt = py(Hb + Rh + 0.45, zm - 0.2), cw = 0.42 * F / zm;
//         c.fillStyle = css(mix([125, 112, 102], haze, dk)); c.fillRect(cxp - cw / 2, cyt, cw, cyb - cyt); c.fillStyle = css(mix([76, 68, 63], haze, dk)); c.fillRect(cxp - cw * 0.62, cyt - cw * 0.25, cw * 1.24, cw * 0.35);
//         if (zm < 22) S.out.smoke.push({ x: cxp, y: cyt - cw * 0.25, s: clamp(3.2 / zm, 0.28, 1.1) });
//         // hanging sign
//         if (sg.sign && zm < 14) {
//           const Y = H0 + FH * 0.95, a = P(X0, zm, Y), bx = px(side * (Wd - 0.95), zm), s = F / zm;
//           c.strokeStyle = '#3a2f2a'; c.lineWidth = Math.max(1, 0.06 * s); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(bx, a[1]); c.stroke();
//           const col = pick(r, PAL.awn); c.fillStyle = col; c.fillRect(bx - 0.3 * s, a[1] + 0.12 * s, 0.6 * s, 0.4 * s); c.strokeStyle = '#3a2f2a'; c.strokeRect(bx - 0.3 * s, a[1] + 0.12 * s, 0.6 * s, 0.4 * s);
//           c.fillStyle = '#e8d9a8'; c.beginPath(); c.arc(bx, a[1] + 0.32 * s, 0.11 * s, 0, TAU); c.fill();
//         }
//       }
//       // stalls
//       [[-1, 3.1, 0], [1, 3.8, 1], [-1, 5.5, 2], [1, 6.9, 3], [-1, 8.6, 4], [1, 10.6, 5], [-1, 12.5, 0]].forEach(a => {
//         const z = a[1], x = px(a[0] * (Wd - 0.95), z), gy = py(0, z), s = F / z;
//         stall(c, r, x, gy, s * 0.95, mix(PAL.awn[a[2]], haze, dist(z)));
//       });
//       // laundry, bunting, lanterns
//       const line = (zz, Y, sag, fn) => { const a = P(-Wd + 0.02, zz, Y), b = P(Wd - 0.02, zz, Y), my = (a[1] + b[1]) / 2 + sag * F / zz; c.strokeStyle = 'rgba(60,50,44,.7)'; c.lineWidth = Math.max(0.8, 0.02 * F / zz); c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo((a[0] + b[0]) / 2, my + sag * F / zz, b[0], b[1]); c.stroke(); for (let i = 0; i < 12; i++) { const t = 0.08 + i * 0.075, x = lerp(a[0], b[0], t), y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * (my + sag * F / zz) + t * t * b[1]; fn(x, y, F / zz, i); } };
//       line(4.6, 3.2, 0.2, (x, y, s, i) => { if (i % 2) return; c.fillStyle = ['#d8d0c0', '#a65f55', '#6f8aa0', '#c9b47a', '#cfc7b4'][i % 5]; c.fillRect(x - 0.14 * s, y, 0.28 * s, (0.45 + (i % 3) * 0.12) * s); c.fillStyle = 'rgba(30,28,40,.14)'; c.fillRect(x, y, 0.14 * s, 0.5 * s); });
//       line(7.6, 3.0, 0.22, (x, y, s, i) => { if (i % 3 !== 1) return; c.fillStyle = ['#cfc7b4', '#8a6a9a', '#b9714c'][i % 3]; c.fillRect(x - 0.16 * s, y, 0.32 * s, 0.55 * s); });
//       [[3.0, 3.5], [8.8, 3.4], [13.5, 3.3]].forEach((a, ai) => line(a[0], a[1], 0.18, (x, y, s, i) => { c.fillStyle = mix(PAL.awn[(i + ai) % 6], haze, dist(a[0])); c.beginPath(); c.moveTo(x - 0.1 * s, y); c.lineTo(x + 0.1 * s, y); c.lineTo(x, y + 0.24 * s); c.closePath(); c.fill(); }));
//       [[5.2, 2.7], [8.2, 2.6], [12, 2.5]].forEach(a => { const x = px(0.4, a[0]), y = py(a[1], a[0]); S.lights.push({ kind: 'lamp', x: x - 3, y: y - 3, w: 6, h: 6, r: Math.max(2, 0.07 * F / a[0]), k: 0.8, ph: r(), gy: 0 }); c.fillStyle = '#3a2f2a'; c.beginPath(); c.arc(x, y, Math.max(2.5, 0.09 * F / a[0]), 0, TAU); c.fill(); });
//     }, dyn(c, E, S, lay) {
//       const cam = streetCam(S), { F, px, py } = cam;
//       lay.out.smoke.forEach((sm, i) => smokeAt(c, E, sm.x, sm.y, sm.s, S.k, i * 0.31));
//       const R = 24, z0 = 3.4, list = [];
//       for (const m of MKT) { const z = z0 + ((((m.off + E.t * m.sp) % R) + R) % R); list.push({ m, z }); }
//       list.sort((a, b) => b.z - a.z);
//       for (const { m, z } of list) {
//         const s = (m.kid ? 0.68 : 1.04) * F / z, x = px(m.x * (1 - 0.0), z) + Math.sin(E.t * 0.7 + m.off) * 0.04 * F / z, y = py(0, z), fade = smooth(Math.min(z - z0, z0 + R - z) / 1.6);
//         c.save(); c.globalAlpha *= fade; walker(c, x, y, s, E.t, m.off, m.col, { front: true, away: m.sp > 0, type: m.type, pace: m.kid ? 9 : 5 + (m.off % 2) }); c.restore();
//       }
//       for (let i = 0; i < 4; i++) { const px0 = px(-0.6 + i * 0.5, 3.6 + (i % 2)), py0 = py(0, 3.6 + (i % 2)); const peck = Math.max(0, Math.sin(E.t * 3 + i * 2)); c.fillStyle = i % 2 ? '#8a8e98' : '#6f7580'; const s = 0.1 * F / 3.8; c.beginPath(); c.ellipse(px0, py0 - s * 1.5 + peck * s * 0.6, s * 1.2, s * 0.85, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(px0 + s * 1.1, py0 - s * 2.2 + peck * s * 1.4, s * 0.5, 0, TAU); c.fill(); }
//     } },
//     { d: 1.0, fog: 0, mot: 140, paint(c, S, r) {
//       const k = S.k;
//       [[-1, 1], [1, 1]].forEach(a => {
//         const sd = a[0], x0 = sd < 0 ? S.X(-0.1) : S.X(1.1), x1 = sd < 0 ? S.X(0.2) : S.X(0.8);
//         c.fillStyle = tone('#6c5148', -0.15); c.beginPath(); c.moveTo(x0, 0); c.lineTo(x1, 0); c.lineTo(x0, S.Y(0.24)); c.closePath(); c.fill();
//         c.strokeStyle = 'rgba(20,16,24,.25)'; c.lineWidth = 1.5 * k; for (let i = 1; i < 8; i++) { const t = i / 8; c.beginPath(); c.moveTo(lerp(x0, x1, t), 0); c.lineTo(x0, S.Y(0.24) * (1 - t)); c.stroke(); }
//       });
//       [[0.03, 1.0, 100], [0.11, 1.03, 80], [0.95, 1.0, 96], [0.88, 1.04, 70]].forEach((a, i) => {
//         const x = S.X(a[0]), y = S.Y(a[1]), s = a[2] * k;
//         if (i % 2 === 0) { c.fillStyle = vgrad(c, y - s * 1.3, y, '#8a6a4a', '#6a4e38'); c.beginPath(); c.moveTo(x - s * 0.55, y); c.quadraticCurveTo(x - s * 0.7, y - s * 0.65, x - s * 0.5, y - s * 1.3); c.lineTo(x + s * 0.5, y - s * 1.3); c.quadraticCurveTo(x + s * 0.7, y - s * 0.65, x + s * 0.55, y); c.closePath(); c.fill(); c.strokeStyle = '#3a2f2a'; c.lineWidth = 4 * k; [0.3, 0.75].forEach(f => { c.beginPath(); c.moveTo(x - s * 0.62, y - s * f); c.lineTo(x + s * 0.62, y - s * f); c.stroke(); }); c.fillStyle = '#5a4430'; c.beginPath(); c.ellipse(x, y - s * 1.3, s * 0.5, s * 0.12, 0, 0, TAU); c.fill(); }
//         else { c.fillStyle = '#9a7a52'; c.fillRect(x - s * 0.6, y - s * 0.9, s * 1.2, s * 0.9); c.strokeStyle = '#4a3a2a'; c.lineWidth = 3 * k; c.strokeRect(x - s * 0.6, y - s * 0.9, s * 1.2, s * 0.9); c.beginPath(); c.moveTo(x - s * 0.6, y - s * 0.45); c.lineTo(x + s * 0.6, y - s * 0.45); c.stroke(); }
//       });
//       c.fillStyle = vgrad(c, S.Y(0.9), S.Y(1), 'rgba(120,110,96,0)', 'rgba(120,110,96,.35)'); c.fillRect(0, S.Y(0.9), S.W, S.H);
//     } }
//   ]
// });

// /* ═══════════════════════ 3 · TAVERN DISTRICT · rainy dusk ═══════════════════════ */
// function lampPost(c, S, x, gy, h, lights, rnd, wet) {
//   const k = S.k;
//   c.fillStyle = '#2f2b2e'; c.fillRect(x - 4 * k, gy - h, 8 * k, h); c.fillRect(x - 10 * k, gy - 8 * k, 20 * k, 8 * k);
//   c.fillStyle = '#2f2b2e'; c.beginPath(); c.moveTo(x - 14 * k, gy - h); c.lineTo(x + 14 * k, gy - h); c.lineTo(x + 10 * k, gy - h - 26 * k); c.lineTo(x - 10 * k, gy - h - 26 * k); c.closePath(); c.fill();
//   c.fillStyle = '#6e5a3c'; c.fillRect(x - 9 * k, gy - h - 22 * k, 18 * k, 20 * k);
//   lights.push({ kind: 'lamp', x: x - 8 * k, y: gy - h - 20 * k, w: 16 * k, h: 16 * k, r: 7 * k, k: 1.1, ph: rnd(), gy: wet ? gy : 0 });
// }
// function barrel(c, x, y, s, k) {
//   c.fillStyle = vgrad(c, y - s * 1.2, y, '#8a6a4a', '#664b36'); c.beginPath(); c.moveTo(x - s * 0.5, y); c.quadraticCurveTo(x - s * 0.66, y - s * 0.6, x - s * 0.5, y - s * 1.2); c.lineTo(x + s * 0.5, y - s * 1.2); c.quadraticCurveTo(x + s * 0.66, y - s * 0.6, x + s * 0.5, y); c.closePath(); c.fill();
//   c.strokeStyle = '#3a2f2a'; c.lineWidth = 3 * k; [0.28, 0.9].forEach(f => { c.beginPath(); c.moveTo(x - s * 0.6, y - s * f); c.lineTo(x + s * 0.6, y - s * f); c.stroke(); });
//   c.fillStyle = '#58412f'; c.beginPath(); c.ellipse(x, y - s * 1.2, s * 0.5, s * 0.1, 0, 0, TAU); c.fill();
// }
// SCENES.push({
//   id: 'tavern', focus: [0.5, 0.55], pan: 1, hz: 0.62,
//   layers: [
//     { d: 0.05, fog: 0.2, paint(c, S, r) {
//       const f = ridge(c, S, r, { base: 0.62, amp: 0.05, rough: 0.5, freq: 3, col: '#6e8394', colBot: '#869aa4' });
//       treeLine(c, S, r, f, { size: 40, dens: 0.3, cols: ['#566e72', '#5f777a'], dy: 4 });
//       skyline(c, S, r, { cx: S.X(0.24), base: S.Y(0.63), sc: 0.55, pal: SKY_PAL });
//       skyline(c, S, r, { cx: S.X(0.86), base: S.Y(0.64), sc: 0.38, pal: SKY_PAL });
//     } },
//     { d: 0.2, fog: 0.1, smoke: true, paint(c, S, r) {
//       const k = S.k;
//       for (let x = -S.ox * 0.2; x < S.W; x += (190 + r() * 80) * k) facade(c, S, r, x, S.Y(0.71), (150 + r() * 90) * k, (150 + r() * 80) * k, { floors: 2, base: 0, litP: 0.7, door: false, shutter: null });
//     } },
//     { d: 0.42, fog: 0.04, smoke: true, mot: 340, paint(c, S, r) {
//       const k = S.k, gy = S.Y(0.745);
//       facade(c, S, r, S.X(0.03), gy, 470 * k, 640 * k, { floors: 3, wall: '#a99b84', roof: '#5c4f55', litP: 0.8, reflect: true, doorBay: 3 });
//       facade(c, S, r, S.X(0.97), gy, 440 * k, 590 * k, { floors: 3, wall: '#b0a085', roof: '#6a5048', litP: 0.8, reflect: true, doorBay: 0 });
//     } },
//     { d: 0.6, fog: 0.02, smoke: true, mot: 360, paint(c, S, r) {
//       const k = S.k, gy = S.Y(0.745), cx = S.X(0.5);
//       facade(c, S, r, cx, gy, 560 * k, 530 * k, { floors: 3, wall: '#bcab8e', roof: '#5e4a45', roofH: 280 * k, litP: 1, k: 1.3, doorLight: true, reflect: true, shutter: null, ov: 30 * k, base: 100 * k });
//       for (let i = 0; i < 3; i++) { const dx = cx + (i - 1) * 170 * k, top = gy - 530 * k - 190 * k; c.fillStyle = '#b7a68a'; c.fillRect(dx - 34 * k, top, 68 * k, 90 * k); c.fillStyle = '#5e4a45'; c.beginPath(); c.moveTo(dx - 44 * k, top); c.lineTo(dx, top - 52 * k); c.lineTo(dx + 44 * k, top); c.closePath(); c.fill(); pane(c, r, dx - 12 * k, top + 22 * k, 24 * k, 36 * k, '#4a3b33'); S.lights.push({ kind: 'win', x: dx - 12 * k, y: top + 22 * k, w: 24 * k, h: 36 * k, k: 1.2, ph: r(), gy: 0 }); }
//       // door steps, awning, lamps
//       c.fillStyle = '#8a8478'; for (let i = 0; i < 3; i++) c.fillRect(cx - (60 + i * 14) * k, gy - (3 - i) * 7 * k + 7 * k * 0, (120 + i * 28) * k, 7 * k);
//       c.fillStyle = tone('#7a4a3e', 0); c.beginPath(); c.moveTo(cx - 90 * k, gy - 168 * k); c.lineTo(cx + 90 * k, gy - 168 * k); c.lineTo(cx + 104 * k, gy - 138 * k); c.lineTo(cx - 104 * k, gy - 138 * k); c.closePath(); c.fill();
//       [-1, 1].forEach(sd => { const lx = cx + sd * 120 * k, ly = gy - 120 * k; c.strokeStyle = '#2f2b2e'; c.lineWidth = 4 * k; c.beginPath(); c.moveTo(lx, ly - 30 * k); c.lineTo(lx, ly + 10 * k); c.stroke(); c.fillStyle = '#6e5a3c'; c.fillRect(lx - 8 * k, ly + 8 * k, 16 * k, 20 * k); S.lights.push({ kind: 'lamp', x: lx - 7 * k, y: ly + 10 * k, w: 14 * k, h: 14 * k, r: 6 * k, k: 1.2, ph: r(), gy }); });
//       barrel(c, cx - 235 * k, gy + 4 * k, 46 * k, k); barrel(c, cx - 290 * k, gy + 8 * k, 40 * k, k);
//       c.fillStyle = '#5a4637'; c.fillRect(cx + 170 * k, gy - 30 * k, 110 * k, 8 * k); c.fillRect(cx + 178 * k, gy - 22 * k, 6 * k, 22 * k); c.fillRect(cx + 266 * k, gy - 22 * k, 6 * k, 22 * k);
//       // sign bracket
//       const sx = cx + 280 * k + 6 * k, sy = gy - 330 * k; c.strokeStyle = '#2b2628'; c.lineWidth = 5 * k; c.beginPath(); c.moveTo(cx + 280 * k, sy); c.lineTo(sx + 70 * k, sy); c.quadraticCurveTo(sx + 78 * k, sy - 22 * k, sx + 56 * k, sy - 26 * k); c.stroke();
//       S.out.sign = { x: sx + 40 * k, y: sy };
//     }, dyn(c, E, S, lay) {
//       const k = S.k, sg = lay.out.sign, gy = S.Y(0.745), cx = S.X(0.5);
//       if (sg) {
//         const sw = Math.sin(E.t * 1.5) * (0.05 + E.wind * 0.07);
//         c.save(); c.translate(sg.x, sg.y); c.rotate(sw);
//         c.strokeStyle = '#2b2628'; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(-26 * k, 0); c.lineTo(-26 * k, 22 * k); c.moveTo(26 * k, 0); c.lineTo(26 * k, 22 * k); c.stroke();
//         c.fillStyle = '#4b3a2e'; c.fillRect(-36 * k, 22 * k, 72 * k, 72 * k); c.strokeStyle = '#c3a56a'; c.lineWidth = 3 * k; c.strokeRect(-36 * k, 22 * k, 72 * k, 72 * k);
//         c.fillStyle = '#d8c28a'; c.fillRect(-14 * k, 40 * k, 24 * k, 36 * k); c.fillStyle = '#f2ecd6'; c.beginPath(); c.ellipse(-2 * k, 40 * k, 14 * k, 6 * k, 0, 0, TAU); c.fill(); c.strokeStyle = '#d8c28a'; c.lineWidth = 4 * k; c.beginPath(); c.arc(14 * k, 58 * k, 8 * k, -1.4, 1.4); c.stroke();
//         c.restore();
//         S.lights.length; lay.lights.push;
//       }
//       const door = lay.lights.find(l => l.kind === 'door'); const ev = evt(E.t, 17, 6, 3);
//       if (door) door.open = ev >= 0 ? Math.sin(ev * Math.PI) : 0;
//       if (ev > 0.2 && ev < 0.95) { const q = (ev - 0.2) / 0.75, x = cx + q * 150 * k, y = gy + 4 * k + q * 40 * k, h = lerp(120, 170, q) * k; c.save(); c.globalAlpha *= smooth(Math.min(q * 5, (1 - q) * 3)); walker(c, x, y, h, E.t, 1, '#5a4a40', { front: true, away: false, type: 'traveler', pace: 5 }); c.restore(); }
//     } },
//     { d: 0.9, fog: 0, ground: true, mot: 220, paint(c, S, r) {
//       const k = S.k, top = S.Y(0.73), cx = S.X(0.5);
//       c.fillStyle = vgrad(c, top, S.H, '#6f7482', '#4e5262'); c.fillRect(0, top, S.W, S.H - top);
//       cobbles(c, S, r, cx, S.Y(0.74), S.H, S.W * 0.52, S.W * 0.52, '#7a7d8a', 34);
//       c.fillStyle = vgrad(c, top, top + 40 * k, 'rgba(18,20,34,.4)', 'rgba(18,20,34,0)'); c.fillRect(0, top, S.W, 40 * k);
//       c.fillStyle = vgrad(c, S.Y(0.75), S.Y(0.9), 'rgba(190,205,216,.22)', 'rgba(190,205,216,0)'); c.fillRect(0, S.Y(0.75), S.W, S.Y(0.15));
//       [[0.2, 0.83, 150, 16], [0.62, 0.9, 210, 22], [0.4, 0.97, 120, 12], [0.82, 0.8, 100, 10], [0.5, 0.78, 90, 8]].forEach(a => puddle(c, S.X(a[0]), S.Y(a[1]), a[2] * k, a[3] * k, r));
//       lampPost(c, S, S.X(0.1), S.Y(0.88), 250 * k, S.lights, r, true); lampPost(c, S, S.X(0.92), S.Y(0.86), 235 * k, S.lights, r, true);
//       barrel(c, S.X(0.03), S.Y(1.03), 90 * k, k); barrel(c, S.X(0.97), S.Y(1.04), 82 * k, k);
//     }, dyn(c, E, S, lay) {
//       const k = S.k;
//       if (E.rain > 0.1) for (let i = 0; i < 14; i++) {
//         const ph = (E.t * 0.9 + i * 0.37 + hash1(i) * 4) % 1, x = S.X(0.04 + hash1(i * 3.1) * 0.92), y = S.Y(0.76 + hash1(i * 7.7) * 0.22), rr = (4 + ph * 22) * k * (0.5 + (y / S.h));
//         c.strokeStyle = `rgba(200,215,228,${(1 - ph) * 0.4 * E.rain})`; c.lineWidth = 1.2 * k; c.beginPath(); c.ellipse(x, y, rr, rr * 0.22, 0, 0, TAU); c.stroke();
//       }
//       const walk = [[0.035, 0.84, 'villager', 0], [0.03, 0.9, 'merchant', 3], [-0.028, 0.86, 'traveler', 1.4], [0.024, 0.93, 'mage', 5]];
//       walk.forEach((w, i) => {
//         const dir = w[0] > 0 ? 1 : -1, ph = ((E.t * Math.abs(w[0]) + i * 0.27) % 1), x = dir > 0 ? lerp(-60 * k, S.w * 1.1, ph) : lerp(S.w * 1.1, -60 * k, ph), y = S.Y(w[1]), h = lerp(110, 230, (w[1] - 0.8) / 0.15) * k;
//         walker(c, x, y, h, E.t, i * 2, PAL.cloaks[(i * 3) % 9], { dir, type: w[2], pace: 5 });
//       });
//     } }
//   ]
// });

// /* ═══════════════════════ 4 · ADVENTURER'S GUILD · night ═══════════════════════ */
// SCENES.push({
//   id: 'guild', focus: [0.5, 0.55], pan: 1, hz: 0.62,
//   layers: [
//     { d: 0.04, fog: 0.2, paint(c, S, r) {
//       ridge(c, S, r, { base: 0.58, amp: 0.1, rough: 0.5, sharp: true, freq: 2, col: '#6a7f98', colBot: '#7d90a6', facets: 10 });
//       skyline(c, S, r, { cx: S.X(0.78), base: S.Y(0.64), sc: 0.58, pal: SKY_PAL });
//       skyline(c, S, r, { cx: S.X(0.18), base: S.Y(0.64), sc: 0.4, pal: SKY_PAL });
//     } },
//     { d: 0.2, fog: 0.1, smoke: true, paint(c, S, r) {
//       const k = S.k;
//       for (let x = -S.ox * 0.2; x < S.W; x += (180 + r() * 80) * k) facade(c, S, r, x, S.Y(0.71), (150 + r() * 90) * k, (150 + r() * 80) * k, { floors: 2, base: 0, litP: 0.6, door: false, shutter: null });
//     } },
//     { d: 0.45, fog: 0.03, mot: 360, paint(c, S, r) {
//       const k = S.k, gy = S.Y(0.745), cx = S.X(0.5);
//       const fc = facade(c, S, r, cx, gy, 700 * k, 470 * k, { floors: 3, wall: '#a69d8f', roof: '#58525e', roofH: 290 * k, litP: 0.9, k: 1.2, door: false, base: 130 * k, stone: '#8d877b', ov: 36 * k, shutter: null, reflect: true });
//       emblem(c, cx, fc.top + 150 * k, 66 * k);
//       const dw = 150 * k, dh = 215 * k;
//       c.fillStyle = tone('#a69d8f', 0.0); c.fillRect(cx - dw / 2 - 20 * k, gy - dh - 20 * k, dw + 40 * k, dh + 20 * k);
//       c.fillStyle = '#2d2420'; c.beginPath(); c.moveTo(cx - dw / 2, gy); c.lineTo(cx - dw / 2, gy - dh * 0.72); c.quadraticCurveTo(cx, gy - dh * 1.25, cx + dw / 2, gy - dh * 0.72); c.lineTo(cx + dw / 2, gy); c.closePath(); c.fill();
//       S.lights.push({ kind: 'door', x: cx - dw / 2 + 8 * k, y: gy - dh * 0.98, w: dw - 16 * k, h: dh * 0.98, k: 1.3, ph: r(), gy });
//       [-1, 1].forEach(sd => { const tx = cx + sd * (dw / 2 + 36 * k); c.fillStyle = '#2f2824'; c.fillRect(tx - 3 * k, gy - 170 * k, 6 * k, 38 * k); S.lights.push({ kind: 'fire', x: tx - 8 * k, y: gy - 198 * k, w: 16 * k, h: 16 * k, r: 8 * k, k: 1.2, ph: r(), gy }); banner(c, cx + sd * 280 * k, gy - 440 * k, 62 * k, 220 * k, sd < 0 ? '#7a4d4a' : '#4d5f7a'); });
//       // quest board
//       const bx = S.X(0.15), by = gy - 230 * k, notes = [];
//       c.fillStyle = '#4a3a2e'; c.fillRect(bx - 100 * k, by + 100 * k, 8 * k, 130 * k); c.fillRect(bx + 92 * k, by + 100 * k, 8 * k, 130 * k);
//       c.fillStyle = '#6b5240'; c.fillRect(bx - 110 * k, by - 10 * k, 220 * k, 150 * k); c.fillStyle = '#7d634c'; c.fillRect(bx - 102 * k, by - 2 * k, 204 * k, 134 * k);
//       for (let i = 0; i < 12; i++) notes.push({ x: bx - 92 * k + (i % 4) * 48 * k + r() * 8 * k, y: by + 6 * k + Math.floor(i / 4) * 40 * k + r() * 6 * k, w: 30 * k, h: 34 * k, ph: r() * 6 });
//       S.out.notes = notes;
//       S.lights.push({ kind: 'lamp', x: bx - 6 * k, y: by - 40 * k, w: 12 * k, h: 12 * k, r: 6 * k, k: 1, ph: r(), gy: 0 }); c.strokeStyle = '#2f2b2e'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(bx, by - 10 * k); c.lineTo(bx, by - 34 * k); c.stroke();
//       // training yard
//       const yx = S.X(0.86);
//       c.strokeStyle = '#5a4637'; c.lineWidth = 5 * k; for (let i = 0; i < 6; i++) { const fx = yx - 170 * k + i * 56 * k; c.beginPath(); c.moveTo(fx, gy); c.lineTo(fx, gy - 70 * k); c.stroke(); } c.beginPath(); c.moveTo(yx - 175 * k, gy - 55 * k); c.lineTo(yx + 115 * k, gy - 55 * k); c.moveTo(yx - 175 * k, gy - 28 * k); c.lineTo(yx + 115 * k, gy - 28 * k); c.stroke();
//       c.strokeStyle = '#4a3a2e'; c.lineWidth = 7 * k; c.beginPath(); c.moveTo(yx - 60 * k, gy - 10 * k); c.lineTo(yx - 60 * k, gy - 150 * k); c.stroke(); c.lineWidth = 5 * k; c.beginPath(); c.moveTo(yx - 90 * k, gy - 120 * k); c.lineTo(yx - 30 * k, gy - 120 * k); c.stroke();
//       c.fillStyle = '#a58c64'; c.beginPath(); c.arc(yx - 60 * k, gy - 160 * k, 15 * k, 0, TAU); c.fill();
//       c.strokeStyle = '#4a3a2e'; c.lineWidth = 6 * k; c.beginPath(); c.moveTo(yx + 40 * k, gy); c.lineTo(yx + 70 * k, gy - 90 * k); c.moveTo(yx + 100 * k, gy); c.lineTo(yx + 70 * k, gy - 90 * k); c.stroke(); c.fillStyle = '#d9cfae'; c.beginPath(); c.arc(yx + 70 * k, gy - 110 * k, 36 * k, 0, TAU); c.fill(); [28, 18, 8].forEach((rr, i) => { c.fillStyle = ['#a8574a', '#e8e0c6', '#a8574a'][i]; c.beginPath(); c.arc(yx + 70 * k, gy - 110 * k, rr * k, 0, TAU); c.fill(); });
//     }, dyn(c, E, S, lay) {
//       (lay.out.notes || []).forEach(n => { const a = Math.sin(E.t * 2.2 + n.ph) * 0.07 * (0.4 + E.wind); c.save(); c.translate(n.x + n.w / 2, n.y); c.rotate(a); c.fillStyle = '#e1d4b0'; c.fillRect(-n.w / 2, 0, n.w, n.h); c.fillStyle = 'rgba(70,52,40,.5)'; for (let i = 0; i < 4; i++) c.fillRect(-n.w / 2 + 4, 7 + i * 7, n.w - 8 - (i % 2) * 8, 2); c.restore(); });
//       const door = lay.lights.find(l => l.kind === 'door'), ev = evt(E.t, 23, 7, 5);
//       if (door) door.open = ev >= 0 ? Math.sin(ev * Math.PI) * 0.8 : 0;
//       if (ev > 0.15 && ev < 0.9) { const q = (ev - 0.15) / 0.75, k = S.k, gy = S.Y(0.745), cx = S.X(0.5); c.save(); c.globalAlpha *= smooth(Math.min(q * 4, (1 - q) * 4)); walker(c, cx + (q - 0.5) * 20 * k, gy + (1 - q) * 70 * k, lerp(190, 130, q) * k, E.t, 2, '#4d5960', { front: true, away: true, type: 'knight', pace: 5 }); c.restore(); }
//     } },
//     { d: 0.78, fog: 0, ground: true, mot: 220, paint(c, S, r) {
//       const k = S.k, top = S.Y(0.732), cx = S.X(0.5);
//       c.fillStyle = vgrad(c, top, S.H, '#6c7080', '#4b4f5e'); c.fillRect(0, top, S.W, S.H - top);
//       cobbles(c, S, r, cx, S.Y(0.74), S.H, S.W * 0.52, S.W * 0.52, '#777a88', 34);
//       c.fillStyle = vgrad(c, top, top + 40 * k, 'rgba(18,20,34,.4)', 'rgba(18,20,34,0)'); c.fillRect(0, top, S.W, 40 * k);
//       [[0.5, 0.82, 200, 18], [0.3, 0.95, 220, 22], [0.72, 0.9, 150, 14]].forEach(a => puddle(c, S.X(a[0]), S.Y(a[1]), a[2] * k, a[3] * k, r));
//       const rx = S.X(0.3), ry = S.Y(0.9); c.fillStyle = '#5a4637'; c.fillRect(rx - 110 * k, ry - 70 * k, 220 * k, 9 * k); c.fillRect(rx - 108 * k, ry - 70 * k, 9 * k, 70 * k); c.fillRect(rx + 99 * k, ry - 70 * k, 9 * k, 70 * k);
//       lampPost(c, S, S.X(0.07), S.Y(0.9), 250 * k, S.lights, r, true); lampPost(c, S, S.X(0.95), S.Y(0.88), 240 * k, S.lights, r, true);
//       barrel(c, S.X(0.55), S.Y(0.99), 70 * k, k); barrel(c, S.X(0.6), S.Y(1.02), 60 * k, k);
//     }, dyn(c, E, S, lay) {
//       const k = S.k, rx = S.X(0.3), ry = S.Y(0.9);
//       horse(c, rx - 150 * k, ry + 8 * k, 190 * k, 1, E.t, '#5d4a3c', { gait: 0 }); horse(c, rx + 130 * k, ry + 12 * k, 180 * k, -1, E.t, '#8a7a68', { gait: 0 });
//       walker(c, S.X(0.17), S.Y(0.86), 200 * k, E.t, 0, '#5a4a40', { dir: -1, type: 'traveler', pace: 0 });
//       [[22, 0.84, 'knight', 0.1], [18, 0.88, 'mage', 0.35], [-20, 0.92, 'traveler', 0.6], [26, 0.9, 'villager', 0.8]].forEach((a, i) => {
//         const dir = a[0] > 0 ? 1 : -1, ph = (E.t * Math.abs(a[0]) / (S.w + 400) + a[3]) % 1, x = dir > 0 ? lerp(-200, S.w + 200, ph) : lerp(S.w + 200, -200, ph);
//         walker(c, x, S.Y(a[1]), lerp(150, 220, (a[1] - 0.8) / 0.15) * k, E.t, i * 2, PAL.cloaks[(i * 2 + 1) % 9], { dir, type: a[2], pace: 5 });
//       });
//     } }
//   ]
// });

// /* ═══════════════════════ 5 · FOREST ROAD · late night ═══════════════════════ */
// function forestRoad(S) {
//   const p = [[0.5, 1.07], [0.28, 0.9], [0.7, 0.76], [0.5, 0.61]];
//   return s => {
//     const m = 1 - s, f = (a, b, c2, d) => m * m * m * a + 3 * m * m * s * b + 3 * m * s * s * c2 + s * s * s * d;
//     return { x: S.X(f(p[0][0], p[1][0], p[2][0], p[3][0])), y: S.Y(f(p[0][1], p[1][1], p[2][1], p[3][1])), w: S.w * (0.27 * Math.pow(1 - s, 2.2) + 0.014) };
//   };
// }
// function deer(c, x, y, s, dir, t, col) {
//   horse(c, x, y, s, dir, t, col, { gait: 6 });
//   c.save(); c.translate(x, y); c.scale(dir, 1); c.strokeStyle = tone(col, -0.4); c.lineWidth = s * 0.025; c.lineCap = 'round';
//   [[0.46, -1.05], [0.5, -1.05]].forEach((a, i) => { c.beginPath(); c.moveTo(s * a[0], s * a[1]); c.lineTo(s * (a[0] - 0.08 + i * 0.1), s * (a[1] - 0.22)); c.lineTo(s * (a[0] - 0.14 + i * 0.1), s * (a[1] - 0.34)); c.moveTo(s * (a[0] - 0.08 + i * 0.1), s * (a[1] - 0.22)); c.lineTo(s * (a[0] + 0.02 + i * 0.1), s * (a[1] - 0.36)); c.stroke(); });
//   c.restore();
// }
// function fern(c, x, y, s, col, rnd) {
//   for (let i = 0; i < 9; i++) {
//     const a = -Math.PI / 2 + (i - 4) * 0.28 + (rnd() - 0.5) * 0.1, l = s * (0.7 + rnd() * 0.5);
//     c.strokeStyle = tone(col, (rnd() - 0.5) * 0.3); c.lineWidth = Math.max(1, s * 0.025);
//     const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l * 0.9 + l * 0.25;
//     c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.9 - l * 0.1, ex, ey); c.stroke();
//     for (let j = 1; j < 8; j++) { const t = j / 8, lx = lerp(x, ex, t), ly = lerp(y, ey, t) - Math.sin(t * Math.PI) * l * 0.12, ll = s * 0.16 * (1 - t * 0.6); c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx - ll, ly + ll * 0.5); c.moveTo(lx, ly); c.lineTo(lx + ll, ly + ll * 0.5); c.stroke(); }
//   }
// }
// function trunk(c, S, rnd, x, y0, y1, w, col) {
//   c.fillStyle = (() => { const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, tone(col, 0.14)); g.addColorStop(0.55, tone(col, 0)); g.addColorStop(1, tone(col, -0.3)); return g; })();
//   c.beginPath(); c.moveTo(x - w * 0.62, y1); c.quadraticCurveTo(x - w * 0.5, (y0 + y1) / 2, x - w * 0.42, y0); c.lineTo(x + w * 0.42, y0); c.quadraticCurveTo(x + w * 0.5, (y0 + y1) / 2, x + w * 0.62, y1); c.closePath(); c.fill();
//   c.strokeStyle = 'rgba(20,18,26,.22)'; c.lineWidth = Math.max(1, w * 0.02);
//   for (let i = 0; i < 14; i++) { const xx = x + (rnd() - 0.5) * w * 0.8; c.beginPath(); c.moveTo(xx, y0); c.bezierCurveTo(xx + (rnd() - 0.5) * w * 0.1, y0 + (y1 - y0) * 0.4, xx - (rnd() - 0.5) * w * 0.1, y0 + (y1 - y0) * 0.7, xx + (rnd() - 0.5) * w * 0.15, y1); c.stroke(); }
// }
// SCENES.push({
//   id: 'forest', focus: [0.5, 0.6], pan: 1, hz: 0.6,
//   layers: [
//     { d: 0.04, fog: 0.2, paint(c, S, r) {
//       ridge(c, S, r, { base: 0.5, amp: 0.1, rough: 0.5, sharp: true, freq: 2, col: '#5a738c', colBot: '#6d849a', snow: 0.03 });
//       const f = ridge(c, S, r, { base: 0.585, amp: 0.04, rough: 0.55, freq: 3, col: '#4b6670', colBot: '#587480' });
//       treeLine(c, S, r, f, { size: 56, dens: 0.8, cols: ['#425d66', '#4a6670', '#3d5860'], dy: 6 });
//     } },
//     { d: 0.14, fog: 0.15, paint(c, S, r) {
//       const f = ridge(c, S, r, { base: 0.63, amp: 0.025, rough: 0.5, freq: 3, col: '#33504c', colBot: '#2f4a46' });
//       treeLine(c, S, r, f, { size: 120, dens: 0.8, cols: ['#2f4b49', '#35544f', '#2a4542'], dy: 8, broad: 0.1 });
//       const f2 = ridge(c, S, r, { base: 0.66, amp: 0.02, rough: 0.5, freq: 4, col: '#2e4844', colBot: '#2b423f' });
//       treeLine(c, S, r, f2, { size: 160, dens: 0.55, cols: ['#2b4643', '#31504b'], dy: 8 });
//     }, dyn(c, E, S) {
//       if (E.night > 0.6) for (let i = 0; i < 3; i++) bird(c, S.w * (0.3 + 0.2 * Math.sin(E.t * 0.2 + i * 2) + i * 0.15), S.h * (0.3 + 0.08 * Math.sin(E.t * 0.9 + i * 3)), 4 * S.k, E.t * 1.6, i * 1.3, 'rgba(10,14,24,.8)');
//     } },
//     { d: 0.3, fog: 0.12, mot: 300, paint(c, S, r) {
//       const k = S.k, cx = S.X(0.5), gy = S.Y(0.625);
//       c.fillStyle = vgrad(c, S.Y(0.6), S.Y(0.7), '#3c5446', '#34503f'); c.fillRect(0, S.Y(0.617), S.W, S.H);
//       // ruined arch, statue, fallen blocks
//       const st = '#8a8e92';
//       [-1, 1].forEach(sd => { c.fillStyle = vgrad(c, gy - 210 * k, gy, tone(st, 0.1), tone(st, -0.2)); c.fillRect(cx + sd * 78 * k - 20 * k, gy - (sd < 0 ? 210 : 150) * k, 40 * k, (sd < 0 ? 210 : 150) * k); blocks(c, r, cx + sd * 78 * k - 20 * k, gy - (sd < 0 ? 210 : 150) * k, 40 * k, (sd < 0 ? 210 : 150) * k, st, 40 * k, 20 * k, 0.3); });
//       c.strokeStyle = tone(st, 0.02); c.lineWidth = 40 * k; c.beginPath(); c.arc(cx, gy - 210 * k, 78 * k, Math.PI, Math.PI * 1.62); c.stroke();
//       c.lineWidth = 3 * k; c.strokeStyle = 'rgba(20,24,34,.35)'; c.beginPath(); c.arc(cx, gy - 210 * k, 78 * k, Math.PI, Math.PI * 1.62); c.stroke();
//       for (let i = 0; i < 70; i++) { const side = r() < 0.5 ? -1 : 1, yy = gy - r() * (side < 0 ? 215 : 150) * k; c.fillStyle = hx('#4f7a4a', 0.35 + r() * 0.3); c.beginPath(); c.arc(cx + side * 78 * k + (r() - 0.5) * 46 * k, yy, (3 + r() * 6) * k, 0, TAU); c.fill(); }
//       const sx = cx + 210 * k; c.fillStyle = tone(st, -0.1); c.fillRect(sx - 26 * k, gy - 46 * k, 52 * k, 46 * k); c.fillStyle = tone(st, 0); c.beginPath(); c.moveTo(sx - 20 * k, gy - 46 * k); c.lineTo(sx - 26 * k, gy - 120 * k); c.quadraticCurveTo(sx, gy - 150 * k, sx + 26 * k, gy - 120 * k); c.lineTo(sx + 20 * k, gy - 46 * k); c.closePath(); c.fill(); c.beginPath(); c.arc(sx, gy - 135 * k, 13 * k, 0, TAU); c.fill(); c.fillStyle = hx('#4f7a4a', 0.6); c.beginPath(); c.arc(sx - 15 * k, gy - 100 * k, 10 * k, 0, TAU); c.fill();
//       for (let i = 0; i < 6; i++) { c.fillStyle = tone(st, (r() - 0.5) * 0.2); c.fillRect(cx - 190 * k + r() * 360 * k, gy - (5 + r() * 14) * k, (22 + r() * 22) * k, (10 + r() * 14) * k); }
//       for (let i = 0; i < 46; i++) { const u = r(); if (u > 0.4 && u < 0.6) continue; const x = S.X(-0.05 + u * 1.1), y = S.Y(0.63 + r() * 0.05), hh = (160 + r() * 260) * k; if (r() < 0.25) broadleaf(c, x, y, hh * 0.32, pick(r, ['#2f4b3a', '#34523f']), r); else conifer(c, x, y, hh, pick(r, ['#2c4642', '#33504a', '#29433f', '#263f3b']), r); }
//     }, glow(c, E, S) {
//       if (E.night < 0.5) return;
//       const a = smooth((E.night - 0.5) / 0.4) * (1 - E.overcast * 0.6) * (0.7 + 0.3 * Math.sin(E.t * 0.3));
//       c.save(); c.globalCompositeOperation = 'lighter';
//       for (let i = 0; i < 4; i++) { const x0 = S.X(0.18 + i * 0.2), g = c.createLinearGradient(x0, 0, x0 + S.w * 0.1, S.Y(0.7)); g.addColorStop(0, `rgba(170,195,255,${0.1 * a})`); g.addColorStop(1, 'rgba(170,195,255,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + S.w * 0.05, 0); c.lineTo(x0 + S.w * 0.2, S.Y(0.7)); c.lineTo(x0 + S.w * 0.09, S.Y(0.7)); c.closePath(); c.fill(); }
//       c.restore();
//     }, dyn(c, E, S) {
//       const k = S.k, q = (E.local - 0.26) / 0.3;
//       if (q > 0 && q < 1) deer(c, lerp(-S.w * 0.1, S.w * 1.15, q), S.Y(0.664), 120 * k, 1, E.t, '#6e5a48');
//     } },
//     { d: 0.65, fog: 0.03, mot: 320, paint(c, S, r) {
//       const k = S.k, rc = forestRoad(S);
//       c.fillStyle = vgrad(c, S.Y(0.61), S.H, '#3f5a43', '#2d4535'); c.beginPath(); c.moveTo(0, S.Y(0.615)); for (let x = 0; x <= S.W; x += 30) c.lineTo(x, S.Y(0.612) + Math.sin(x * 0.01) * 4 * k); c.lineTo(S.W, S.H); c.lineTo(0, S.H); c.closePath(); c.fill();
//       const L = [], R = [], n = 40;
//       for (let i = 0; i <= n; i++) { const s = i / n, q = rc(s); L.push([q.x - q.w / 2, q.y]); R.push([q.x + q.w / 2, q.y]); }
//       c.fillStyle = vgrad(c, S.Y(0.6), S.H, '#7f7561', '#6a6152'); c.beginPath(); L.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); R.slice().reverse().forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fill();
//       c.save(); c.clip();
//       [-0.2, 0.2].forEach(o => { c.strokeStyle = 'rgba(40,34,30,.25)'; c.beginPath(); for (let i = 0; i <= n; i++) { const s = i / n, q = rc(s); c.lineWidth = Math.max(1, q.w * 0.07); i ? c.lineTo(q.x + o * q.w, q.y) : c.moveTo(q.x + o * q.w, q.y); } c.stroke(); });
//       for (let i = 0; i < 80; i++) { const q = rc(Math.pow(r(), 1.3) * 0.95); c.fillStyle = tone('#8a8070', (r() - 0.5) * 0.3, 0.6); c.beginPath(); c.ellipse(q.x + (r() - 0.5) * q.w * 0.9, q.y, q.w * 0.02 + 1, q.w * 0.01 + 0.6, 0, 0, TAU); c.fill(); }
//       c.restore();
//       c.fillStyle = vgrad(c, S.Y(0.6), S.Y(0.66), 'rgba(18,28,24,.35)', 'rgba(18,28,24,0)'); c.fillRect(0, S.Y(0.6), S.W, S.Y(0.06));
//       // big trees framing the road
//       [[0.3, 90], [0.7, 100], [0.18, 130], [0.84, 140]].forEach(a => trunk(c, S, r, S.X(a[0]), -30, S.Y(0.74 + (a[1] % 7) * 0.003), a[1] * k, '#3e4048'));
//       conifer(c, S.X(0.12), S.Y(0.84), 560 * k, '#2a443f', r); conifer(c, S.X(0.9), S.Y(0.82), 520 * k, '#2c4741', r);
//       for (let i = 0; i < 18; i++) { const side = r() < 0.5 ? -1 : 1, x = side < 0 ? S.X(r() * 0.42) : S.X(0.58 + r() * 0.45), y = S.Y(0.7 + r() * 0.26); c.fillStyle = tone('#2e4a38', (r() - 0.5) * 0.3); c.beginPath(); c.ellipse(x, y, (30 + r() * 60) * k, (16 + r() * 26) * k, 0, 0, TAU); c.fill(); }
//       broadleaf(c, S.X(0.04), S.Y(0.9), 150 * k, '#35523f', r); broadleaf(c, S.X(0.97), S.Y(0.92), 160 * k, '#31503c', r);
//       for (let i = 0; i < 16; i++) { const q = rc(0.1 + r() * 0.8), side = r() < 0.5 ? -1 : 1; fern(c, q.x + side * (q.w * 0.7 + r() * 90 * k), q.y + 4 * k, (30 + (1 - 0.0) * r() * 60) * k * (q.w / (S.w * 0.2) + 0.4), '#3f6a4a', r); }
//       for (let i = 0; i < 14; i++) { const q = rc(0.05 + r() * 0.7), side = r() < 0.5 ? -1 : 1, x = q.x + side * (q.w * 0.62 + r() * 140 * k), y = q.y + 6 * k, s = (5 + r() * 9) * k * (q.w / (S.w * 0.2) + 0.5); c.fillStyle = '#d6cbb0'; c.fillRect(x - s * 0.18, y - s * 0.8, s * 0.36, s * 0.8); c.fillStyle = pick(r, ['#b9563f', '#c9a85a', '#8a6a9a']); c.beginPath(); c.ellipse(x, y - s * 0.85, s * 0.7, s * 0.4, 0, Math.PI, 0); c.fill(); }
//       c.fillStyle = vgrad(c, S.Y(0.9), S.Y(0.96), '#5a4a3a', '#43372c'); c.beginPath(); c.moveTo(S.X(0.62), S.Y(0.93)); c.lineTo(S.X(0.88), S.Y(0.92)); c.lineTo(S.X(0.89), S.Y(0.97)); c.lineTo(S.X(0.62), S.Y(0.98)); c.closePath(); c.fill(); c.fillStyle = '#7a6a54'; c.beginPath(); c.ellipse(S.X(0.89), S.Y(0.945), 12 * k, 25 * k, 0, 0, TAU); c.fill();
//       grassBlades(c, S, r, 0, S.W, S.Y(1.0), 14, 46, 200, '#3c5e42');
//     }, dyn(c, E, S) {
//       const k = S.k, rc = forestRoad(S);
//       const q = (E.local - 0.55) / 0.42;
//       if (q > 0 && q < 1) { const s = lerp(0.9, 0.38, smooth(q)), p = rc(s), h = p.w * 0.55, x = p.x + p.w * 0.1, y = p.y; c.save(); c.globalAlpha *= smooth(Math.min(q * 6, (1 - q) * 6)); walker(c, x, y, h, E.t, 0, '#4d4a58', { front: true, type: 'traveler', pace: 3 }); c.restore(); }
//       for (let m = 0; m < 4; m++) { const x = ((E.t * (5 + m * 2) + m * 500) % (S.w + 900)) - 450; soft(c, E.mistSprite, x, S.Y(0.72 + m * 0.08), S.w * 0.75, S.h * 0.1, E.mist * 0.55); }
//     }, glow(c, E, S) {
//       const rc = forestRoad(S), q = (E.local - 0.55) / 0.42;
//       if (q > 0 && q < 1) { const s = lerp(0.9, 0.38, smooth(q)), p = rc(s), x = p.x + p.w * 0.1 + p.w * 0.1, y = p.y - p.w * 0.3, r = p.w * 0.9, a = smooth(Math.min(q * 6, (1 - q) * 6)); const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,190,100,${0.6 * a})`); g.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.fillStyle = `rgba(255,236,190,${a})`; c.beginPath(); c.arc(x, y, Math.max(1.5, p.w * 0.03), 0, TAU); c.fill(); }
//     } },
//     { d: 1.1, fog: 0, mot: 140, paint(c, S, r) {
//       const k = S.k;
//       trunk(c, S, r, S.X(-0.02), -20, S.Y(1.04), 230 * k, '#3a3a40'); trunk(c, S, r, S.X(1.04), -20, S.Y(1.04), 260 * k, '#363840');
//       canopyCorner(c, S, r, S.X(0.08), S.Y(-0.02), 300 * k, '#28402f', 18); canopyCorner(c, S, r, S.X(0.92), S.Y(-0.03), 320 * k, '#263e2e', 18); canopyCorner(c, S, r, S.X(0.5), S.Y(-0.12), 220 * k, '#243a2c', 12);
//       fern(c, S.X(0.09), S.Y(1.0), 150 * k, '#2f5a3c', r); fern(c, S.X(0.93), S.Y(1.0), 160 * k, '#2d5738', r); fern(c, S.X(0.2), S.Y(1.03), 110 * k, '#2f5a3c', r);
//       c.fillStyle = vgrad(c, S.Y(0.9), S.Y(1), 'rgba(24,40,32,0)', 'rgba(24,40,32,.45)'); c.fillRect(0, S.Y(0.9), S.W, S.H);
//     }, glow(c, E, S) {
//       const a = smooth((E.night - 0.3) / 0.5) * (1 - E.rain * 0.7); if (a < 0.02) return;
//       c.save(); c.globalCompositeOperation = 'lighter';
//       for (let i = 0; i < 34; i++) {
//         const bx = hash1(i * 3.3), by = hash1(i * 5.9), x = S.X(0.03 + bx * 0.94) + Math.sin(E.t * 0.4 + i) * 40 * S.k, y = S.Y(0.5 + by * 0.46) + Math.cos(E.t * 0.5 + i * 2) * 24 * S.k, p = 0.5 + 0.5 * Math.sin(E.t * (1.2 + hash1(i) * 1.5) + i * 7), r = (3 + hash1(i * 9) * 4) * S.k;
//         const g = c.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, `rgba(220,255,150,${0.75 * p * a})`); g.addColorStop(1, 'rgba(180,230,120,0)'); c.fillStyle = g; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
//       }
//       c.restore();
//     } }
//   ]
// });

// /* ═══════════════════════ 6 · RIVER & RUINS · dawn ═══════════════════════ */
// SCENES.push({
//   id: 'river', focus: [0.5, 0.6], pan: 1, hz: 0.62,
//   layers: [
//     { d: 0.03, fog: 0.14, paint(c, S, r) {
//       ridge(c, S, r, { base: 0.52, amp: 0.2, rough: 0.5, sharp: true, freq: 1.7, col: '#6f8aa2', colBot: '#9bb0bb', snow: 0.05, facets: 20 });
//       skyline(c, S, r, { cx: S.X(0.14), base: S.Y(0.585), sc: 0.3, pal: SKY_PAL });
//       const f = ridge(c, S, r, { base: 0.6, amp: 0.04, rough: 0.55, freq: 3, col: '#627f7c', colBot: '#7d9a90' });
//       treeLine(c, S, r, f, { size: 38, dens: 0.45, cols: ['#55726f', '#5d7a76'], dy: 4 });
//     } },
//     { d: 0.14, fog: 0.12, paint(c, S, r) {
//       const f = ridge(c, S, r, { base: 0.625, amp: 0.025, rough: 0.5, freq: 3, col: '#5b7a6c', colBot: '#6d8a78' });
//       treeLine(c, S, r, f, { size: 90, dens: 0.6, cols: ['#4f6f62', '#587868', '#496a5d'], dy: 6, broad: 0.25 });
//     } },
//     { d: 0.28, fog: 0.08, mot: 300, paint(c, S, r) {
//       const k = S.k, gy = S.Y(0.675);
//       const bank = ridge(c, S, r, { base: 0.665, amp: 0.012, rough: 0.5, freq: 3, col: '#72906a', colBot: '#5f7e5a' });
//       c.fillStyle = vgrad(c, S.Y(0.65), S.Y(0.69), '#6c8a66', '#4f6e54'); c.fillRect(0, S.Y(0.665), S.W, S.Y(0.04));
//       const tx = S.X(0.7), st = '#a8a296';
//       c.fillStyle = vgrad(c, gy - 240 * k, gy, tone(st, 0.1), tone(st, -0.22));
//       c.beginPath(); c.moveTo(tx - 50 * k, gy); c.lineTo(tx - 50 * k, gy - 300 * k); c.lineTo(tx - 34 * k, gy - 340 * k); c.lineTo(tx - 14 * k, gy - 305 * k); c.lineTo(tx + 6 * k, gy - 352 * k); c.lineTo(tx + 26 * k, gy - 280 * k); c.lineTo(tx + 50 * k, gy - 300 * k); c.lineTo(tx + 50 * k, gy); c.closePath(); c.fill();
//       blocks(c, r, tx - 50 * k, gy - 340 * k, 100 * k, 340 * k, st, 30 * k, 17 * k, 0.28);
//       c.fillStyle = '#30343e'; c.beginPath(); c.moveTo(tx - 12 * k, gy - 150 * k); c.lineTo(tx - 12 * k, gy - 210 * k); c.arc(tx, gy - 210 * k, 12 * k, Math.PI, 0); c.lineTo(tx + 12 * k, gy - 150 * k); c.closePath(); c.fill();
//       c.fillStyle = vgrad(c, gy - 100 * k, gy, tone(st, 0.05), tone(st, -0.2)); c.beginPath(); c.moveTo(tx + 50 * k, gy); c.lineTo(tx + 50 * k, gy - 80 * k); c.lineTo(tx + 84 * k, gy - 94 * k); c.lineTo(tx + 120 * k, gy - 60 * k); c.lineTo(tx + 150 * k, gy - 66 * k); c.lineTo(tx + 150 * k, gy); c.closePath(); c.fill();
//       c.fillStyle = '#30343e'; c.beginPath(); c.moveTo(tx + 80 * k, gy); c.lineTo(tx + 80 * k, gy - 44 * k); c.arc(tx + 98 * k, gy - 44 * k, 18 * k, Math.PI, 0); c.lineTo(tx + 116 * k, gy); c.closePath(); c.fill();
//       for (let i = 0; i < 110; i++) { const x = tx - 70 * k + r() * 240 * k, y = gy - r() * r() * 330 * k; c.fillStyle = hx(pick(r, ['#4f7a4a', '#5d8a52', '#456b44']), 0.4 + r() * 0.4); c.beginPath(); c.arc(x, y, (2 + r() * 6) * k, 0, TAU); c.fill(); }
//       for (let i = 0; i < 7; i++) { c.fillStyle = tone(st, (r() - 0.5) * 0.2); c.fillRect(tx - 120 * k + r() * 340 * k, gy - (4 + r() * 10) * k, (14 + r() * 20) * k, (8 + r() * 10) * k); }
//       [[0.1, 0.675, 130], [0.3, 0.67, 110], [0.5, 0.67, 95], [0.95, 0.675, 120]].forEach(a => {
//         const x = S.X(a[0]), y = S.Y(a[1]), s = a[2] * k;
//         c.fillStyle = tone('#5a4a3a', -0.1); c.fillRect(x - s * 0.08, y - s * 1.1, s * 0.16, s * 1.1);
//         for (let i = 0; i < 60; i++) { const ang = r() * TAU, d = s * (0.3 + r() * 0.7), sx = x + Math.cos(ang) * d * 0.9, top = y - s * 1.2 + Math.sin(ang) * d * 0.3; c.strokeStyle = tone('#7a9a58', (r() - 0.5) * 0.4, 0.55); c.lineWidth = Math.max(1, s * 0.012); c.beginPath(); c.moveTo(x + Math.cos(ang) * d * 0.25, y - s * 1.2); c.quadraticCurveTo(sx, top, sx + (r() - 0.5) * s * 0.1, y - s * (0.2 + r() * 0.5)); c.stroke(); }
//       });
//     }, dyn(c, E, S) { for (let i = 0; i < 3; i++) bird(c, ((E.t * (18 + i * 3) + i * 400) % (S.w + 200)) - 100, S.h * (0.25 + i * 0.04) + Math.sin(E.t + i) * 9, 5 * S.k, E.t, i * 1.9, 'rgba(60,66,78,.6)'); } },
//     { d: 0.5, fog: 0.03, mot: 340, paint(c, S, r) {
//       const k = S.k, wl = S.Y(0.71), yb = S.Y(0.668), hump = 34 * k, st = '#aaa398';
//       const deck = u => yb - hump * (1 - Math.pow(2 * u - 1, 2)), x0 = -S.ox * 0.2, x1 = S.W * 1.02, X = u => lerp(x0, x1, u);
//       c.beginPath(); c.moveTo(X(0), wl + 6 * k); for (let i = 0; i <= 60; i++) c.lineTo(X(i / 60), deck(i / 60)); c.lineTo(X(1), wl + 6 * k); c.closePath();
//       c.fillStyle = vgrad(c, yb - hump, wl, tone(st, 0.1), tone(st, -0.22)); c.fill();
//       c.save(); c.clip(); blocks(c, r, 0, yb - hump, S.W, wl - yb + hump, st, 34 * k, 20 * k, 0.4);
//       [[0.2, 80], [0.5, 105], [0.8, 80]].forEach(a => { const ax = X(a[0]), ar = a[1] * k; c.fillStyle = vgrad(c, wl - ar, wl, '#1f3236', '#7d9a9a'); c.beginPath(); c.moveTo(ax - ar, wl + 4); c.lineTo(ax - ar, wl - ar * 0.4); c.ellipse(ax, wl - ar * 0.4, ar, ar * 0.85, 0, Math.PI, 0); c.lineTo(ax + ar, wl + 4); c.closePath(); c.fill(); c.strokeStyle = 'rgba(30,34,44,.4)'; c.lineWidth = 5 * k; c.stroke(); });
//       c.restore();
//       c.strokeStyle = tone(st, -0.1); c.lineWidth = 26 * k; c.beginPath(); for (let i = 0; i <= 60; i++) { const x = X(i / 60), y = deck(i / 60) - 14 * k; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
//       c.strokeStyle = tone(st, 0.12); c.lineWidth = 6 * k; c.beginPath(); for (let i = 0; i <= 60; i++) { const x = X(i / 60), y = deck(i / 60) - 27 * k; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
//       [0.04, 0.32, 0.68, 0.96].forEach(u => { c.fillStyle = tone(st, -0.05); c.fillRect(X(u) - 12 * k, deck(u) - 52 * k, 24 * k, 40 * k); });
//       [0.32, 0.68].forEach(u => { const x = X(u), y = deck(u) - 100 * k; c.fillStyle = '#2f2b2e'; c.fillRect(x - 3 * k, y, 6 * k, 50 * k); c.fillRect(x - 8 * k, y - 18 * k, 16 * k, 20 * k); S.lights.push({ kind: 'lamp', x: x - 6 * k, y: y - 16 * k, w: 12 * k, h: 12 * k, r: 5 * k, k: 0.9, ph: r(), gy: 0 }); });
//       for (let i = 0; i < 60; i++) { c.fillStyle = hx('#5a7a52', 0.3 + r() * 0.3); c.beginPath(); c.ellipse(r() * S.W, wl - r() * 20 * k, (8 + r() * 16) * k, (3 + r() * 6) * k, 0, 0, TAU); c.fill(); }
//       S.out.deck = { x0, x1, yb, hump };
//     }, dyn(c, E, S, lay) {
//       const k = S.k, d = lay.out.deck; if (!d) return;
//       const deck = u => d.yb - d.hump * (1 - Math.pow(2 * u - 1, 2)), X = u => lerp(d.x0, d.x1, u);
//       const u = ((E.t * 0.011 + 0.1) % 1.2) - 0.1, fade = smooth(Math.min(u + 0.05, 1.05 - u) / 0.1), y = deck(u) - 14 * k, x = X(u);
//       c.save(); c.globalAlpha *= clamp(fade);
//       cart(c, x, y, 120 * k, 1, E.t, { dist: E.t * 40 }); horse(c, x + 125 * k, y, 105 * k, 1, E.t, '#6b5648', { gait: 3.5 });
//       walker(c, X(u + 0.1), deck(u + 0.1) - 14 * k, 80 * k, E.t, 1, '#4f6054', { dir: -1, type: 'traveler', pace: 4 }); c.restore();
//     } },
//     { d: 0.85, fog: 0, ground: true, mot: 200, paint(c, S, r) {
//       const k = S.k, wl = S.Y(0.706);
//       c.fillStyle = vgrad(c, wl, S.H, '#a9c0bc', '#2d5258'); c.fillRect(0, wl, S.W, S.H - wl);
//       [[-1, 0], [1, 1]].forEach(a => {
//         const sd = a[0], xe = sd < 0 ? 0 : S.W, xi = sd < 0 ? S.X(0.24) : S.X(0.8);
//         c.fillStyle = vgrad(c, S.Y(0.8), S.H, '#3d5c42', '#2b4535'); c.beginPath(); c.moveTo(xe, S.Y(0.76)); c.quadraticCurveTo(lerp(xe, xi, 0.5), S.Y(0.86), xi, S.H); c.lineTo(xe, S.H); c.closePath(); c.fill();
//       });
//       for (let i = 0; i < 120; i++) { const side = r() < 0.5 ? -1 : 1, x = side < 0 ? r() * S.w * 0.28 + S.ox * 0.4 : S.W - r() * S.w * 0.28 - S.ox * 0.4, y = S.Y(0.88 + r() * 0.16), h = (60 + r() * 120) * k; c.strokeStyle = tone('#476a45', (r() - 0.5) * 0.4); c.lineWidth = (1.5 + r() * 2) * k; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (r() - 0.5) * 40 * k, y - h * 0.6, x + (r() - 0.5) * 70 * k, y - h); c.stroke(); if (r() < 0.25) { c.fillStyle = '#5a4030'; c.beginPath(); c.ellipse(x + (r() - 0.5) * 70 * k, y - h, 4 * k, 12 * k, 0, 0, TAU); c.fill(); } }
//       const rx = S.X(0.07), ry = S.Y(0.9); c.fillStyle = vgrad(c, ry - 60 * k, ry, '#8a8a86', '#5e5e5e'); c.beginPath(); c.ellipse(rx, ry, 90 * k, 45 * k, 0, Math.PI, 0); c.fill();
//       c.fillStyle = '#4a5560'; c.beginPath(); c.ellipse(rx, ry - 80 * k, 24 * k, 16 * k, 0.1, 0, TAU); c.fill(); c.beginPath(); c.moveTo(rx - 14 * k, ry - 70 * k); c.quadraticCurveTo(rx - 40 * k, ry - 110 * k, rx - 20 * k, ry - 150 * k); c.lineTo(rx - 12 * k, ry - 148 * k); c.quadraticCurveTo(rx - 26 * k, ry - 110 * k, rx - 2 * k, ry - 78 * k); c.fill(); c.beginPath(); c.moveTo(rx - 20 * k, ry - 150 * k); c.lineTo(rx - 48 * k, ry - 142 * k); c.lineTo(rx - 22 * k, ry - 142 * k); c.fill();
//       c.strokeStyle = '#3a3a40'; c.lineWidth = 2.4 * k; c.beginPath(); c.moveTo(rx - 4 * k, ry - 70 * k); c.lineTo(rx - 4 * k, ry - 10 * k); c.moveTo(rx + 8 * k, ry - 68 * k); c.lineTo(rx + 8 * k, ry - 10 * k); c.stroke();
//     }, dyn(c, E, S, lay, rt) {
//       const k = S.k, wl = S.Y(0.706), bm = rt.layers[3] && rt.layers[3].bm, q = S.q;
//       if (bm) {
//         c.save(); c.beginPath(); c.rect(0, wl, S.W, S.H - wl); c.clip();
//         const sh = 14 * k;
//         for (let j = 0; j < 14; j++) {
//           c.save(); c.globalAlpha *= 0.38 * (1 - j / 14); c.translate(Math.sin(E.t * 1.4 + j * 0.9) * 5 * k, wl + j * sh); c.scale(1, -1);
//           c.drawImage(bm, 0, (wl - (j + 1) * sh) * q, bm.width, sh * q, 0, -sh, S.W, sh); c.restore();
//         }
//         c.restore();
//       }
//       c.save(); c.lineCap = 'round';
//       for (let i = 0; i < 46; i++) {
//         const y = wl + (S.H - wl) * Math.pow(hash1(i * 2.3), 1.3), x = ((hash1(i * 5.1) * S.W + E.t * (4 + hash1(i) * 6)) % S.W), l = (14 + hash1(i * 9) * 60) * k * (0.4 + (y - wl) / (S.H - wl));
//         c.strokeStyle = `rgba(255,246,226,${0.1 + 0.12 * Math.sin(E.t * 1.5 + i)})`; c.lineWidth = (1 + (y - wl) / S.h * 3) * k; c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.stroke();
//       }
//       c.restore();
//       const fj = evt(E.t, 21, 1.6, 4);
//       if (fj >= 0) { const fx = S.X(0.55), fy = S.Y(0.8), rr = (6 + fj * 50) * k; c.strokeStyle = `rgba(240,245,240,${(1 - fj) * 0.6})`; c.lineWidth = 2 * k; c.beginPath(); c.ellipse(fx, fy, rr, rr * 0.25, 0, 0, TAU); c.stroke(); const fh = Math.sin(fj * Math.PI) * 60 * k; c.fillStyle = '#c9d3d4'; c.beginPath(); c.ellipse(fx, fy - fh, 7 * k, 3.2 * k, -0.8 + fj * 1.6, 0, TAU); c.fill(); }
//       [[0.4, 0.78, 6, 1], [0.46, 0.8, 8, -1], [0.62, 0.86, 7, 1]].forEach((a, i) => {
//         const x = S.X(a[0]) + Math.sin(E.t * 0.2 + i * 2) * 60 * k + (E.t * 3 * a[3]) % 40, y = S.Y(a[1]) + Math.sin(E.t * 1.2 + i) * 1.5 * k, s = a[2] * k * 2.2;
//         c.strokeStyle = 'rgba(240,248,245,.25)'; c.lineWidth = 1.5 * k; c.beginPath(); c.moveTo(x - s * 2.6 * a[3], y + s * 0.4); c.lineTo(x, y); c.lineTo(x - s * 2.6 * a[3], y - s * 0.1); c.stroke();
//         c.fillStyle = '#6a5a48'; c.beginPath(); c.ellipse(x, y, s, s * 0.5, 0, 0, TAU); c.fill(); c.fillStyle = '#2f5a4a'; c.beginPath(); c.arc(x + s * 0.8 * a[3], y - s * 0.55, s * 0.45, 0, TAU); c.fill(); c.fillStyle = '#c9a548'; c.beginPath(); c.moveTo(x + s * 1.2 * a[3], y - s * 0.55); c.lineTo(x + s * 1.8 * a[3], y - s * 0.45); c.lineTo(x + s * 1.2 * a[3], y - s * 0.4); c.fill();
//       });
//       for (let m = 0; m < 4; m++) { const x = ((E.t * (4 + m * 1.5) + m * 600) % (S.w + 1000)) - 500; soft(c, E.mistSprite, x, S.Y(0.74 + m * 0.05), S.w * 0.85, S.h * 0.1, E.mist * 0.6); }
//     }, glow(c, E, S) {
//       const a = (1 - smooth(E.night / 0.6)) * (1 - E.overcast * 0.6), wl = S.Y(0.706), sx = S.X(E.P.sx * 0.9 + 0.05);
//       if (a < 0.02) return;
//       c.save(); c.globalCompositeOperation = 'lighter';
//       for (let i = 0; i < 26; i++) { const y = wl + (S.H - wl) * Math.pow(i / 26, 1.25), w = (14 + (y - wl) * 0.35 + Math.sin(E.t * 1.7 + i) * 8) * S.k, jit = Math.sin(E.t * 0.9 + i * 1.7) * 10 * S.k; c.fillStyle = `rgba(255,214,150,${0.14 * a * (1 - i / 30)})`; c.fillRect(sx - w / 2 + jit, y, w, (S.H - wl) / 26 * 0.6); }
//       c.restore();
//     } }
//   ]
// });

// /* ═════════════════════════ engine ═════════════════════════ */
// function resize(st, c, w, h) {
//   st.w = w; st.h = h;
//   const k = Math.max(0.45, h / 1080), q = CFG.LAYER_SCALE;
//   st.S = { w, h, W: Math.ceil(w * 1.2), H: h, ox: w * 0.1, q, k, lights: null, out: null, X(u) { return this.ox + u * this.w; }, Y(v) { return v * this.h; } };
//   st.cache = {};
//   let bs = 1; try { bs = clamp(c.getTransform().a || 1, 1, 2); } catch (e) { /* older browsers */ }
//   st.baseBs = bs; st.qual = 1; st.ema = 0; st.slow = 0; makeBuffers(st);
// }
// function makeBuffers(st) {
//   const bs = st.baseBs * st.qual, w = st.w, h = st.h;
//   st.bs = bs; st.buf = makeCanvas(w * bs, h * bs); st.bctx = st.buf.getContext('2d');
//   st.gb = [makeCanvas(w * bs, h * bs), makeCanvas(w * bs, h * bs)]; st.gctx = st.gb.map(x => x.getContext('2d'));
// }

// function buildLayer(st, idx, li) {
//   const S = st.S, spec = SCENES[idx].layers[li];
//   const cv = makeCanvas(S.W * S.q, S.H * S.q), c = cv.getContext('2d');
//   c.scale(S.q, S.q);
//   S.lights = []; S.out = { smoke: [], flags: [] };
//   const rnd = mulberry(1000 * (idx + 1) + li * 37 + 7);
//   spec.paint(c, S, rnd);
//   mottle(c, S, rnd, spec.mot || 260);
//   brush(c, S, rnd, spec.brush || 700);
//   const cv2 = makeCanvas(cv.width, cv.height), c2 = cv2.getContext('2d');
//   if ('filter' in c2) c2.filter = 'blur(0.7px)';
//   c2.drawImage(cv, 0, 0);
//   return { spec, bm: cv2, out: S.out, lights: S.lights };
// }

// function ensureScene(st, idx, budget) {
//   const sc = SCENES[idx];
//   const rt = st.cache[idx] || (st.cache[idx] = { layers: new Array(sc.layers.length).fill(null) });
//   for (let li = 0; li < sc.layers.length && budget > 0; li++) if (!rt.layers[li]) { rt.layers[li] = buildLayer(st, idx, li); budget--; }
//   return rt;
// }

// function layerXf(c, S, sc, d, Z, pan) {
//   const s = 1 + (Z - 1) * (0.3 + 0.9 * d), fx = sc.focus[0] * S.w, fy = sc.focus[1] * S.h;
//   c.translate(fx, fy); c.scale(s, s); c.translate(-fx - pan * S.w * 0.07 * (0.15 + d), -fy);
//   c.translate(-S.ox, 0);
// }

// function renderScene(c, st, E, job, ji) {
//   const rt = st.cache[job.idx], sc = SCENES[job.idx], S = st.S, b = st.bctx;
//   if (!rt) return;
//   const Es = Object.assign({}, E, { local: job.local });
//   b.setTransform(st.bs, 0, 0, st.bs, 0, 0); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; b.clearRect(0, 0, E.w, E.h);
//   job.any = false;
//   const g = st.gctx[ji]; g.setTransform(st.bs, 0, 0, st.bs, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, E.w, E.h);
//   for (let li = 0; li < sc.layers.length; li++) {
//     const lay = rt.layers[li]; if (!lay) continue;
//     b.save(); layerXf(b, S, sc, lay.spec.d, job.Z, job.pan);
//     b.drawImage(lay.bm, 0, 0, S.W, S.H);
//     if (lay.spec.dyn) lay.spec.dyn(b, Es, S, lay, rt);
//     if (lay.spec.smoke) lay.out.smoke.forEach((sm, si) => smokeAt(b, Es, sm.x, sm.y, clamp(sm.s / (260 * S.k), 0.4, 1.1), S.k, si * 0.37, E.rain > 0.2 ? 1 : 0));
//     b.restore();
//     if (job.any) { g.save(); layerXf(g, S, sc, lay.spec.d, job.Z, job.pan); g.globalCompositeOperation = 'destination-out'; g.drawImage(lay.bm, 0, 0, S.W, S.H); g.restore(); }
//     if ((E.lamp >= 0.03 && lay.lights.length) || lay.spec.glow) { job.any = true; g.save(); layerXf(g, S, sc, lay.spec.d, job.Z, job.pan); drawLights(g, Es, S, lay.lights); if (lay.spec.glow) lay.spec.glow(g, Es, S, lay, rt); g.restore(); }
//     if (lay.spec.ground) for (let lj = 0; lj < li; lj++) { const l2 = rt.layers[lj]; if (!l2) continue; g.save(); layerXf(g, S, sc, l2.spec.d, job.Z, job.pan); drawReflections(g, Es, l2.lights); g.restore(); }
//     if (lay.spec.fog) {
//       const hz = sc.hz || 0.6, a = lay.spec.fog * (0.75 + E.P.mist * 0.5);
//       b.globalCompositeOperation = 'source-atop';
//       const g = b.createLinearGradient(0, 0, 0, E.h);
//       g.addColorStop(0, css(E.P.haze, a * 0.45)); g.addColorStop(hz, css(E.P.haze, a)); g.addColorStop(1, css(E.P.haze, a * 0.35));
//       b.fillStyle = g; b.fillRect(0, 0, E.w, E.h);
//       b.globalCompositeOperation = 'source-over';
//     }
//   }
//   c.save(); c.globalAlpha = job.alpha; c.drawImage(st.buf, 0, 0, E.w, E.h); c.restore();
// }

// function drawRain(c, E, st, w, h) {
//   if (E.rain < 0.03) return;
//   const n = Math.floor(st.drops.length * clamp(E.rain)), slant = 0.16 + E.wind * 0.12, k = E.k;
//   c.save(); c.lineCap = 'round';
//   for (let pass = 0; pass < 2; pass++) {
//     c.strokeStyle = `rgba(208,220,232,${(pass ? 0.3 : 0.18) * (1 - 0.5 * E.P.night) * Math.min(1, E.rain * 1.3)})`;
//     c.lineWidth = (pass ? 1.3 : 0.8) * k; c.beginPath();
//     for (let i = 0; i < n; i++) {
//       const d = st.drops[i]; if ((d.z > 0.7) !== !!pass) continue;
//       const y = (d.y + E.t * (0.7 + d.z * 1.1)) % 1, px = ((d.x + y * slant * 0.3) % 1) * w, py = y * h, len = (14 + d.z * 26) * k;
//       c.moveTo(px, py); c.lineTo(px - len * slant, py + len);
//     }
//     c.stroke();
//   }
//   c.restore();
// }

// export function init(w, h) {
//   const r = mulberry((Math.random() * 1e9) | 0);
//   const st = { w: 0, h: 0, seed: r() * 1000, cache: {}, stars: [], clouds: [], drops: [], pat: null, patCtx: null, buf: null, bctx: null, debug: null };
//   for (let i = 0; i < 200; i++) st.stars.push({ x: r(), y: Math.pow(r(), 1.25), r: 0.5 + r() * 1.1, a: 0.35 + r() * 0.65, sp: 1 + r() * 3, ph: r() * 6 });
//   for (let i = 0; i < 9; i++) st.clouds.push({ sp2: i % 3, y: 0.04 + r() * 0.32, s: 0.5 + r() * 0.9, sp: 3 + r() * 6, off: r(), a: 0.5 + r() * 0.5 });
//   for (let i = 0; i < 320; i++) st.drops.push({ x: r(), y: r(), z: 0.3 + r() * 0.7 });
//   st.cloudSprites = [makeCloudSprite(3, 520, 208), makeCloudSprite(9, 520, 208), makeCloudSprite(21, 520, 208)];
//   st.mist = makeSoftSprite(512, 128); st.puff = makeSoftSprite(64, 64); st.grain = makeGrain();
//   return st;
// }

// export function draw(c, st, t, dt, mood, w, h) {
//   if (!st) return;
//   if (st.w !== w || st.h !== h || !st.S) resize(st, c, w, h);
//   const S = st.S, dbg = st.debug, tStart = performance.now();
//   const tt = dbg && dbg.time !== undefined ? dbg.time : t;
//   const cyc = dbg ? ((dbg.scene + dbg.local) / N_SCENES) * CYCLE : ((tt % CYCLE) + CYCLE) % CYCLE;
//   const p = cyc / CYCLE, pf = p * N_SCENES, i = Math.min(N_SCENES - 1, Math.floor(pf)), local = pf - i;
//   const T0 = 1 - CFG.TRANSITION, trans = local > T0, f = trans ? (local - T0) / CFG.TRANSITION : 0, nxt = (i + 1) % N_SCENES;

//   /* weather */
//   const rain = clamp(bump(p, 0.5, 0.065) * 1.0 + bump(p, 5.5 / 7, 0.04) * 0.38);
//   const wet = clamp(Math.max(rain, bump(p, 0.52, 0.15) * 0.85, bump(p, 5.5 / 7, 0.1) * 0.3));
//   const overcast = clamp(Math.max(rain * 0.9, bump(p, 0.5, 0.11) * 0.5, bump(p, 5.5 / 7, 0.08) * 0.35));
//   const P = paletteAt(p);
//   for (const kk of ['top', 'mid', 'hor', 'haze']) P[kk] = mix(mix(P[kk], desat(P[kk], 0.75), overcast * 0.55), '#4a5360', overcast * 0.1);
//   const night = P.night, lamp = clamp(smooth(clamp((night - 0.12) / 0.55)) + overcast * 0.25 + 0.05);
//   const wind = 0.55 + 0.35 * Math.sin(tt * 0.13) + 0.1 * Math.sin(tt * 0.37);
//   const E = { t: tt, w, h, k: S.k, P, night, lamp, rain, wet, overcast, wind, mist: P.mist, p, local, puff: st.puff, mistSprite: st.mist, st };

//   /* build scheduling: current scene complete, next scene one layer per frame */
//   if (dbg) { ensureScene(st, i, 99); if (trans || dbg.both) ensureScene(st, nxt, 99); }
//   else { ensureScene(st, i, 99); ensureScene(st, nxt, 1); }
//   for (const key of Object.keys(st.cache)) { const n = +key; if (n !== i && n !== nxt) delete st.cache[key]; }

//   /* sky */
//   drawSky(c, E, st, w, h);

//   /* camera + scenes */
//   const zc = 1 + 0.055 * local + 0.13 * smooth(f), panc = (local - 0.5) * 2 * 0.75;
//   const jobs = [];
//   if (trans) {
//     const nl = f * CFG.TRANSITION;
//     jobs.push({ idx: nxt, local: nl, Z: 1 + 0.055 * nl + 0.1 * (1 - smooth(f)), pan: (nl - 0.5) * 2 * 0.75, alpha: 1 });
//     jobs.push({ idx: i, local, Z: zc, pan: panc, alpha: 1 - smooth((f - 0.1) / 0.75) });
//   } else jobs.push({ idx: i, local, Z: zc, pan: panc, alpha: 1 });
//   jobs.forEach((j, ji) => renderScene(c, st, E, j, ji));

//   /* drifting ground mist + calm veil for the text area (pre-grade so the grade tints them) */
//   for (let m = 0; m < 4; m++) {
//     const x = ((tt * (5 + m * 2.2) + m * 520) % (w + 900)) - 450;
//     soft(c, st.mist, x, h * (0.6 + m * 0.045), w * 0.8, h * 0.13, E.mist * 0.13);
//   }
//   c.fillStyle = vgrad(c, h * 0.5, h, css(P.haze, 0), css(P.haze, CFG.TEXT_VEIL)); c.fillRect(0, h * 0.5, w, h * 0.5);

//   /* colour grade (multiply) */
//   c.globalCompositeOperation = 'multiply'; c.fillStyle = css(P.grade); c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
//   /* soft sun-warmth wash at golden hours */
//   const warm = Math.max(0, 1 - Math.abs(night - 0.3) * 4) * 0.06 * (1 - overcast);
//   if (warm > 0.005) { c.globalCompositeOperation = 'soft-light'; c.fillStyle = `rgba(255,160,90,${warm * 2})`; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; }

//   /* emissive lights & scene glows (after grade so they stay luminous) */
//   jobs.forEach((j, ji) => { if (!j.any) return; c.save(); c.globalAlpha = j.alpha; c.drawImage(st.gb[ji], 0, 0, w, h); c.restore(); });

//   drawRain(c, E, st, w, h);

//   /* vignette */
//   const v = c.createRadialGradient(w * 0.5, h * 0.48, Math.min(w, h) * 0.3, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
//   v.addColorStop(0, 'rgba(14,18,30,0)'); v.addColorStop(1, `rgba(14,18,30,${0.24 + night * 0.16})`);
//   c.fillStyle = v; c.fillRect(0, 0, w, h);

//   /* paper grain */
//   if (st.patCtx !== c) { st.pat = c.createPattern(st.grain, 'repeat'); st.patCtx = c; }
//   if (st.pat) { c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = CFG.GRAIN; c.fillStyle = st.pat; c.fillRect(0, 0, w, h); c.restore(); }

//   /* adaptive quality: if frames are consistently slow, render the buffers at lower resolution */
//   if (!dbg) {
//     const d = performance.now() - tStart; st.ema = st.ema ? st.ema * 0.96 + d * 0.04 : d;
//     st.slow = st.ema > 26 ? st.slow + 1 : 0;
//     if (st.slow > 90 && st.qual > 0.55) { st.qual = Math.max(0.5, st.qual * 0.8); st.slow = 0; st.ema = 0; makeBuffers(st); }
//   }
// }

// export default { init, draw };

/*
 * ═══════════════════════════════════════════════════════════════════════════
 *  LUNARETH — "The Valley of the Moonwell"
 *  One enormous, connected, living valley — painted in the spirit of Grimgar.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Drop-in scene module:  export default { init(w,h), draw(ctx,state,t,dt,mood,w,h) }
 *
 *  THE WORLD  (a single continuous world — the camera glides through it forever)
 *
 *    far      the Moonwell: a giant crystal spring on a high peak, visible from everywhere
 *    far      the Citadel: the capital and its castle, terraced up a mountain, waterfall
 *    far      floating islands, a distant dragon, hills, farmland, caravans on far roads
 *    zone A   Farmlands   windmill, thatched farmhouses, barn, orchard, scarecrow, cows
 *    zone B   The River   stone arch bridge, watermill, boats, fisherman, ducks, reeds
 *    zone C   The Town    gatehouse + wall, then a real market row: 9 kinds of stall
 *                         (fruit, bread, cloth, fish, pottery, herbs, smith, flowers,
 *                         vegetables), crowd, fountain, bard, pigeons, laundry, bunting
 *    zone D   Tavern & Adventurer's Guild   lanterns, quest board, sparring yard, horses
 *    zone E   Forest road & ancient ruins   glowing glyphs, wisps, fireflies, deer
 *
 *  TIME & WEATHER are independent of position: a full day/night cycle (CFG.DAY_SECONDS)
 *  with sunrise, golden hour, blue hour, two moons, stars, aurora; rain comes and goes.
 *
 *  HOW IT'S BUILT
 *   • The world is split into chunks per parallax layer, each painted ONCE (lazily, a
 *     few ms per frame) into an off-screen bitmap — washes, pigment mottling, brush marks.
 *   • Everything alive (people, animals, boats, smoke, flags, water, wheels, birds,
 *     lanterns, dragon...) is drawn per frame on top of those layers.
 *   • Emissive things (windows, lamps, torches, the Moonwell, glyphs) are drawn after the
 *     colour grade, correctly hidden behind nearer layers.
 *   • Orton-style bloom + paper grain give the soft, watercolour finish.
 *
 *  DEBUG:  state.debug = { cam: 0..CFG.TRAVEL, time: seconds, day: 0..1, rain: 0..1 }
 */

/* ───────────────────────────── tunables ───────────────────────────── */
const CFG = {
  DAY_SECONDS: 660,    // one full day/night cycle
  START_DAY: 0.07,     // day phase at t=0  (0 dawn · .3 noon · .55 sunset · .75 night)
  TRAVEL: 14400,       // camera path length (reference px); camera glides there and back
  TRIP_SECONDS: 1260,  // seconds for one there-and-back journey
  LAYER_SCALE: 0.74,   // bitmap resolution of painted chunks (lower = softer / lighter)
  TEXT_VEIL: 0.16,     // soft haze behind lower page so overlaid text stays calm
  GRAIN: 0.13,         // paper grain strength
  BLOOM: 0.30,         // Orton glow strength
  RAIN: 1.0            // 0 disables rain entirely
};
const REF_H = 1080, CW = 960, BLEED = 14, PADV = 0.06, PADPX = REF_H * PADV;
const STAGE_P = 0.8;   // parallax of the main "stage" layer
const GY = 806;        // ground line of the stage (reference px)

/* ───────────────────────────── maths ───────────────────────────── */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const hash1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const vnoise = x => { const i = Math.floor(x), f = x - i; return lerp(hash1(i), hash1(i + 1), smooth(f)); };
const wrap01 = x => x - Math.floor(x);
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
function hashI(a, b = 0, c = 0, d = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177) + Math.imul(d | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}
const rngAt = (a, b, c, d) => mulberry(hashI(a, b, c, d));
const pick = (r, a) => a[(r() * a.length) | 0];

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
const css = (c, a = 1) => { if (typeof c === 'string' && c.charCodeAt(0) !== 35) return c; c = rgb(c); return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; };
/* painterly shading: lights drift warm, shadows drift cool */
const tone = (col, t, a = 1) => css(t >= 0 ? mix(col, '#fff1d4', t) : mix(col, '#1f2740', -t), a);
const desat = (col, amt) => { const c = rgb(col), l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return mix(c, [l, l, l], amt); };
const vgrad = (c, y0, y1, a, b) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, css(a)); g.addColorStop(1, css(b)); return g; };
const hgrad = (c, x0, x1, a, b, m) => { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, css(a)); if (m) g.addColorStop(0.5, css(m)); g.addColorStop(1, css(b)); return g; };

function makeCanvas(w, h) {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/* ───────────────────────────── palettes ───────────────────────────── */
const PAL = {
  cloaks: ['#5b4a42', '#4a5560', '#6b5a46', '#4f6054', '#7a5a4f', '#55506a', '#8a7a62', '#3f4a56', '#6a4f52', '#7d6a55', '#6f7f6a', '#8a6a3e'],
  plaster: ['#d2c3a4', '#c8b898', '#d8cbae', '#bfae92', '#cdbba0', '#c9b49a', '#d6c6a8', '#bcb09a'],
  roofs: ['#8a5a4b', '#76605a', '#655c68', '#94694f', '#575e62', '#7a5446', '#6b6a58'],
  awn: ['#a8584a', '#c7a55c', '#5f8077', '#8a6a9a', '#b9714c', '#5f7a9c', '#7f8f55'],
  skin: ['#e6c3a1', '#dcae8e', '#c99876', '#aa7c5e', '#8a5f48', '#f0d2b6'],
  hair: ['#2d2420', '#4a3426', '#6b4a2f', '#9a6f3f', '#c9a15c', '#d9d2c4', '#7a3a2a', '#1b1b22'],
  shutters: ['#5f7a6e', '#8a5a4e', '#5d6f86', '#7b7a52', '#7a5a7a'],
  wood: '#6a4e3a'
};

/* ───────────────────────────── time of day ───────────────────────────── */
const KEYS = [
  { p: 0.00, top: '#7f9bc6', mid: '#efcdbb', hor: '#f9d49c', haze: '#f0d6ba', grade: '#ffe6d0', night: 0.22, mist: 0.75 },
  { p: 0.10, top: '#78a6cf', mid: '#cfe0e3', hor: '#f4e8cf', haze: '#e3e8dc', grade: '#fffaf0', night: 0.0, mist: 0.38 },
  { p: 0.30, top: '#5f9fd2', mid: '#adcfe3', hor: '#e6efe2', haze: '#dce8e4', grade: '#ffffff', night: 0.0, mist: 0.06 },
  { p: 0.46, top: '#6c93c4', mid: '#d8d2c4', hor: '#f6d49c', haze: '#ecd8b8', grade: '#fff1da', night: 0.03, mist: 0.1 },
  { p: 0.56, top: '#586ca2', mid: '#d79d8a', hor: '#f5a76c', haze: '#d8a88f', grade: '#ffcba0', night: 0.4, mist: 0.2 },
  { p: 0.64, top: '#38487f', mid: '#6f6ca0', hor: '#c98a92', haze: '#8d80a6', grade: '#b2aedc', night: 0.82, mist: 0.3 },
  { p: 0.74, top: '#22346a', mid: '#37497e', hor: '#566b9a', haze: '#4a5f94', grade: '#93a6dc', night: 1.0, mist: 0.3 },
  { p: 0.88, top: '#1a2a58', mid: '#2e4272', hor: '#4a6190', haze: '#42588c', grade: '#8498d0', night: 1.0, mist: 0.36 },
  { p: 0.96, top: '#3a4c82', mid: '#7a88b0', hor: '#dcaa9e', haze: '#a89eb8', grade: '#b2b2d8', night: 0.55, mist: 0.6 }
];
function paletteAt(phi) {
  let i = 0; while (i < KEYS.length - 1 && phi >= KEYS[i + 1].p) i++;
  const A = KEYS[i], B = KEYS[(i + 1) % KEYS.length], pb = i === KEYS.length - 1 ? 1 : B.p;
  const f = smooth((phi - A.p) / (pb - A.p)), P = {};
  for (const k of ['top', 'mid', 'hor', 'haze', 'grade']) P[k] = mix(A[k], B[k], f);
  for (const k of ['night', 'mist']) P[k] = lerp(A[k], B[k], f);
  return P;
}
/* weather: rain comes in slow episodes, mist hugs dawn */
function weatherAt(t) {
  const n = vnoise(t / 110 + 41.7), m = vnoise(t / 170 + 7.3);
  const rain = smooth((n - 0.66) / 0.14) * CFG.RAIN * smooth(t / 40);
  const overcast = clamp(Math.max(rain * 0.95, smooth((m - 0.5) / 0.35) * 0.55));
  return { rain, overcast };
}

/* ───────────────────────────── sprites (built once) ───────────────────────────── */
function makeCloudSprite(seed, wd, ht) {
  const cv = makeCanvas(wd, ht), c = cv.getContext('2d'), r = mulberry(seed);
  const pf = [], n = 26;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), b = Math.sin(t * Math.PI);
    const rad = ht * (0.12 + 0.26 * b) * (0.7 + r() * 0.6);
    pf.push({ x: wd * (0.1 + 0.8 * t), y: ht * 0.7 - rad * (0.3 + r() * 0.5) - b * ht * 0.2, r: rad });
  }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  pf.forEach(p => { x0 = Math.min(x0, p.x - p.r); x1 = Math.max(x1, p.x + p.r); y0 = Math.min(y0, p.y - p.r); y1 = Math.max(y1, p.y + p.r * 0.3); });
  const m = 14, sc = Math.min((wd - 2 * m) / (x1 - x0), (ht * 0.84 - m) / (y1 - y0));
  c.setTransform(sc, 0, 0, sc, m - x0 * sc + (wd - 2 * m - (x1 - x0) * sc) / 2, m - y0 * sc);
  if ('filter' in c) c.filter = 'blur(2.5px)';
  c.fillStyle = '#a3afc0'; pf.forEach(p => { c.beginPath(); c.arc(p.x, p.y + p.r * 0.3, p.r, 0, TAU); c.fill(); });
  c.fillStyle = '#e4e2dc'; pf.forEach(p => { c.beginPath(); c.arc(p.x, p.y, p.r * 0.94, 0, TAU); c.fill(); });
  c.fillStyle = 'rgba(255,250,238,.85)'; pf.forEach(p => { c.beginPath(); c.arc(p.x - p.r * 0.2, p.y - p.r * 0.28, p.r * 0.66, 0, TAU); c.fill(); });
  c.filter = 'none'; c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'destination-out';
  const g = c.createLinearGradient(0, ht * 0.6, 0, ht * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  c.fillStyle = g; c.fillRect(0, ht * 0.6, wd, ht * 0.4);
  return cv;
}
function makeGlow(col, size = 128) {
  const cv = makeCanvas(size, size), c = cv.getContext('2d'), h = size / 2, r = rgb(col);
  const g = c.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, `rgba(${r[0]},${r[1]},${r[2]},1)`); g.addColorStop(0.18, `rgba(${r[0]},${r[1]},${r[2]},.55)`);
  g.addColorStop(0.5, `rgba(${r[0]},${r[1]},${r[2]},.14)`); g.addColorStop(1, `rgba(${r[0]},${r[1]},${r[2]},0)`);
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  return cv;
}
function makeSoftSprite(wd, ht) {
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

/* ═════════════════ chunk context & texture passes ═════════════════ */
function mottle(c, X, rnd, n, light = '#fff0cc', dark = '#26304c') {
  c.globalCompositeOperation = 'source-atop';
  const W = X.w + 2 * BLEED;
  for (let i = 0; i < n; i++) {
    const x = X.x0 - BLEED + rnd() * W, y = -PADPX + rnd() * (REF_H + 2 * PADPX), r = 6 + rnd() * 26;
    c.fillStyle = rnd() < 0.5 ? css(light, 0.015 + rnd() * 0.03) : css(dark, 0.015 + rnd() * 0.035);
    c.beginPath(); c.ellipse(x, y, r, r * (0.35 + rnd() * 0.6), rnd() * 3.14, 0, TAU); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
}
function brushMarks(c, X, rnd, n) {
  c.globalCompositeOperation = 'source-atop'; c.lineCap = 'round';
  const W = X.w + 2 * BLEED;
  for (let i = 0; i < n; i++) {
    const x = X.x0 - BLEED + rnd() * W, y = -PADPX + rnd() * (REF_H + 2 * PADPX), len = 14 + rnd() * 60, ang = (rnd() - 0.5) * 0.5;
    c.strokeStyle = rnd() < 0.5 ? `rgba(255,244,214,${0.03 + rnd() * 0.045})` : `rgba(30,40,70,${0.03 + rnd() * 0.045})`;
    c.lineWidth = 1.2 + rnd() * 3;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
  }
  c.globalCompositeOperation = 'source-over';
}

/* ═════════════════ ridges / mountains ═════════════════ */
function ridgeFn(o) {
  const sc = o.scale || 700, rough = o.rough || 0.5, oct = o.oct || 5, seed = o.seed || 0;
  return x => {
    let n = 0, a = 1, f = 1 / sc, s = 0;
    for (let q = 0; q < oct; q++) {
      let v = vnoise(x * f + seed + q * 13.7);
      if (o.sharp) v = 1 - Math.abs(2 * v - 1);
      n += a * v; s += a; a *= rough; f *= 2.07;
    }
    n /= s;
    let y = o.base - (n - 0.5) * 2 * o.amp;
    if (o.bumps) for (const b of o.bumps) y -= Math.exp(-Math.pow(Math.abs((x - b.x) / b.w), b.pw || 2)) * b.h;
    return y;
  };
}
/* paints the silhouette with slope-lit strips, snow and strata; returns the sampler */
function paintRidge(c, X, f, o) {
  const step = o.step || 10, x0 = X.x0 - BLEED - step, x1 = X.x1 + BLEED + step, pts = [];
  for (let x = x0; x <= x1; x += step) pts.push([x, f(x)]);
  let minY = 1e9; for (const p of pts) if (p[1] < minY) minY = p[1];
  const bot = REF_H + PADPX + 10;
  c.beginPath(); c.moveTo(pts[0][0], bot);
  for (const p of pts) c.lineTo(p[0], p[1]);
  c.lineTo(pts[pts.length - 1][0], bot); c.closePath();
  c.fillStyle = vgrad(c, minY, o.colY || (o.base + o.amp), o.col, o.colBot || o.col); c.fill();
  c.save(); c.clip();
  const r = rngAt(X.ci, o.seed | 0, 77);
  if (o.snowY !== undefined) {
    c.beginPath(); c.moveTo(x0, -200);
    for (let x = x0; x <= x1; x += step) c.lineTo(x, o.snowY + (vnoise(x * 0.018 + 3) - 0.5) * 90 + (f(x) - minY) * 0.0);
    c.lineTo(x1, -200); c.closePath();
    c.fillStyle = vgrad(c, minY, o.snowY + 60, 'rgba(252,247,238,.9)', 'rgba(252,247,238,.0)'); c.fill();
  }
  if (!o.flat) for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], sl = (b[1] - a[1]) / step, as = Math.abs(sl);
    if (as < 0.12) continue;
    const dp = (26 + r() * 120) * Math.min(1, as * 1.2), dx = -sl * dp * 0.5, lit = sl > 0;
    c.fillStyle = lit ? `rgba(255,244,214,${0.06 + r() * 0.07})` : `rgba(26,36,66,${0.07 + r() * 0.08})`;
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0] + dx, b[1] + dp); c.lineTo(a[0] + dx, a[1] + dp); c.closePath(); c.fill();
  }
  if (o.strata) for (let i = 0; i < o.strata; i++) {
    const y = minY + r() * (o.base - minY), xx = x0 + r() * (x1 - x0), l = 60 + r() * 200;
    c.strokeStyle = `rgba(30,40,64,${0.05 + r() * 0.05})`; c.lineWidth = 1 + r() * 2;
    c.beginPath(); c.moveTo(xx, y); c.lineTo(xx + l, y + (r() - 0.5) * 12); c.stroke();
  }
  c.restore();
  c.strokeStyle = tone(o.col, 0.45, 0.45); c.lineWidth = o.rim || 1.4;
  c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
}

/* ═════════════════ trees & plants ═════════════════ */
function conifer(c, x, y, h, col, rnd, hl = true) {
  const n = h > 90 ? 7 : h > 50 ? 6 : h > 28 ? 5 : 4, d = h / n;
  const side = sg => {
    const a = [[x, y - h]];
    for (let j = 0; j < n; j++) {
      const t = (j + 1) / n, yy = y - h + h * t * 0.97, ww = h * 0.28 * (0.3 + 0.7 * t) * (0.88 + rnd() * 0.24);
      a.push([x + sg * ww, yy + (rnd() - 0.5) * d * 0.15 + d * 0.12]);
      a.push([x + sg * ww * 0.4, yy - d * 0.28]);
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
  if (hl && h > 24) {
    c.fillStyle = tone(col, 0.22, 0.5);
    c.beginPath(); L.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.lineTo(x, y); c.closePath(); c.fill();
    c.fillStyle = 'rgba(18,28,48,.22)';
    c.beginPath(); R.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.lineTo(x, y); c.closePath(); c.fill();
    if (h > 60) { c.strokeStyle = 'rgba(14,22,36,.2)'; c.lineWidth = Math.max(1, h * 0.012); for (let j = 1; j < n; j++) { const yy = y - h + h * j / n, ww = h * 0.26 * j / n; c.beginPath(); c.moveTo(x - ww, yy + d * 0.5); c.quadraticCurveTo(x, yy + d * 0.9, x + ww, yy + d * 0.5); c.stroke(); } }
  }
}
function broadleaf(c, x, y, r, col, rnd, o = {}) {
  const th = r * 0.3;
  c.fillStyle = tone(o.bark || '#5c4838', -0.1);
  c.beginPath(); c.moveTo(x - th * 0.8, y); c.lineTo(x - th * 0.25, y - r * 1.25); c.lineTo(x + th * 0.25, y - r * 1.25); c.lineTo(x + th * 0.8, y); c.closePath(); c.fill();
  c.fillStyle = 'rgba(20,16,26,.25)'; c.beginPath(); c.moveTo(x + th * 0.1, y); c.lineTo(x + th * 0.1, y - r * 1.2); c.lineTo(x + th * 0.25, y - r * 1.25); c.lineTo(x + th * 0.8, y); c.closePath(); c.fill();
  c.strokeStyle = tone(o.bark || '#5c4838', -0.15); c.lineWidth = th * 0.28; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y - r * 1.0); c.lineTo(x - r * 0.5, y - r * 1.6); c.moveTo(x, y - r * 1.1); c.lineTo(x + r * 0.55, y - r * 1.7); c.stroke();
  const cy = y - r * 1.6, bl = [], nb = o.blobs || 14;
  for (let i = 0; i < nb; i++) {
    const a = rnd() * TAU, d = r * 0.7 * Math.sqrt(rnd());
    bl.push([x + Math.cos(a) * d * 1.1, cy + Math.sin(a) * d * 0.8, r * (0.34 + rnd() * 0.3)]);
  }
  bl.forEach(b => { c.fillStyle = tone(col, -0.32); c.beginPath(); c.arc(b[0] + r * 0.1, b[1] + r * 0.14, b[2], 0, TAU); c.fill(); });
  bl.forEach(b => { c.fillStyle = tone(col, -0.04); c.beginPath(); c.arc(b[0], b[1], b[2] * 0.92, 0, TAU); c.fill(); });
  bl.forEach(b => { c.fillStyle = tone(col, 0.24, 0.75); c.beginPath(); c.arc(b[0] - r * 0.14, b[1] - r * 0.2, b[2] * 0.6, 0, TAU); c.fill(); });
  for (let i = 0; i < 22; i++) {
    const b = bl[(rnd() * bl.length) | 0];
    c.fillStyle = tone(col, 0.42, 0.55); c.beginPath(); c.arc(b[0] - r * 0.2 + rnd() * r * 0.3, b[1] - r * 0.3 + rnd() * r * 0.2, r * 0.05 + rnd() * r * 0.06, 0, TAU); c.fill();
  }
  if (o.fruit) for (let i = 0; i < 12; i++) { const b = bl[(rnd() * bl.length) | 0]; c.fillStyle = o.fruit; c.beginPath(); c.arc(b[0] + (rnd() - 0.5) * b[2], b[1] + (rnd() - 0.2) * b[2], Math.max(1.5, r * 0.045), 0, TAU); c.fill(); }
  if (o.blossom) for (let i = 0; i < 40; i++) { const b = bl[(rnd() * bl.length) | 0]; c.fillStyle = css(o.blossom, 0.7); c.beginPath(); c.arc(b[0] + (rnd() - 0.5) * b[2] * 1.4, b[1] + (rnd() - 0.5) * b[2] * 1.4, r * 0.03 + rnd() * r * 0.04, 0, TAU); c.fill(); }
}
function willow(c, x, y, r, col, rnd) {
  c.fillStyle = tone('#4f4034', -0.05);
  c.beginPath(); c.moveTo(x - r * 0.16, y); c.quadraticCurveTo(x - r * 0.08, y - r * 0.7, x - r * 0.3, y - r * 1.3); c.lineTo(x + r * 0.3, y - r * 1.3); c.quadraticCurveTo(x + r * 0.1, y - r * 0.7, x + r * 0.16, y); c.closePath(); c.fill();
  for (let i = 0; i < 26; i++) {
    const a0 = (rnd() - 0.5) * 2.4, sx = x + Math.sin(a0) * r * 0.5, sy = y - r * 1.3 + Math.cos(a0) * r * 0.1, len = r * (0.8 + rnd() * 0.7);
    c.strokeStyle = tone(col, (rnd() - 0.5) * 0.4, 0.8); c.lineWidth = Math.max(1.5, r * 0.04);
    c.beginPath(); c.moveTo(sx, sy); c.bezierCurveTo(sx + Math.sin(a0) * r * 0.5, sy - r * 0.2, sx + Math.sin(a0) * r * 0.9, sy + len * 0.3, sx + Math.sin(a0) * r * 0.95 + (rnd() - 0.5) * 20, sy + len); c.stroke();
  }
  for (let i = 0; i < 9; i++) { c.fillStyle = tone(col, (rnd() - 0.5) * 0.2, 0.9); c.beginPath(); c.arc(x + (rnd() - 0.5) * r * 1.3, y - r * 1.35 + (rnd() - 0.5) * r * 0.3, r * (0.25 + rnd() * 0.2), 0, TAU); c.fill(); }
}
function bush(c, x, y, r, col, rnd, flower) {
  for (let i = 0; i < 6; i++) { const bx = x + (rnd() - 0.5) * r * 1.5, by = y - r * 0.3 - rnd() * r * 0.4, br = r * (0.4 + rnd() * 0.3); c.fillStyle = tone(col, -0.25); c.beginPath(); c.arc(bx + 2, by + 2, br, 0, TAU); c.fill(); c.fillStyle = tone(col, (rnd() - 0.4) * 0.2); c.beginPath(); c.arc(bx, by, br * 0.92, 0, TAU); c.fill(); c.fillStyle = tone(col, 0.25, 0.5); c.beginPath(); c.arc(bx - br * 0.2, by - br * 0.25, br * 0.5, 0, TAU); c.fill(); }
  if (flower) for (let i = 0; i < 10; i++) { c.fillStyle = css(flower, 0.9); c.beginPath(); c.arc(x + (rnd() - 0.5) * r * 1.6, y - r * 0.2 - rnd() * r * 0.8, Math.max(1.2, r * 0.07), 0, TAU); c.fill(); }
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
function grassBlades(c, rnd, x0, x1, baseY, hMin, hMax, n, col) {
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * (x1 - x0), h = hMin + rnd() * (hMax - hMin), w = 2 + rnd() * 3.5, bend = (rnd() - 0.5) * h * 0.5;
    c.fillStyle = tone(col, (rnd() - 0.4) * 0.35, 0.95);
    c.beginPath(); c.moveTo(x - w, baseY + 3); c.quadraticCurveTo(x + bend * 0.3, baseY - h * 0.6, x + bend, baseY - h);
    c.quadraticCurveTo(x + bend * 0.3 + w * 0.5, baseY - h * 0.55, x + w, baseY + 3); c.closePath(); c.fill();
  }
}
function flowerSpray(c, rnd, n, x0, x1, y0, y1, cols, s0 = 1.5) {
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), s = (s0 + rnd() * 2.2) * (0.6 + (y - y0) / Math.max(1, y1 - y0) * 0.7);
    c.fillStyle = css(pick(rnd, cols), 0.88); c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,248,220,.5)'; c.beginPath(); c.arc(x - s * 0.2, y - s * 0.2, s * 0.35, 0, TAU); c.fill();
  }
}
function reeds(c, rnd, x, y, w, h, n, col) {
  for (let i = 0; i < n; i++) {
    const xx = x + (rnd() - 0.5) * w, hh = h * (0.5 + rnd() * 0.6), bend = (rnd() - 0.5) * hh * 0.35;
    c.strokeStyle = tone(col, (rnd() - 0.5) * 0.4); c.lineWidth = 1.4 + rnd() * 1.6;
    c.beginPath(); c.moveTo(xx, y); c.quadraticCurveTo(xx + bend * 0.2, y - hh * 0.6, xx + bend, y - hh); c.stroke();
    if (rnd() < 0.3) { c.fillStyle = '#6a4a35'; c.beginPath(); c.ellipse(xx + bend, y - hh, 2.6, 9, bend * 0.01, 0, TAU); c.fill(); }
  }
}
function rock(c, x, y, s, col, rnd) {
  c.fillStyle = tone(col, (rnd() - 0.5) * 0.15);
  c.beginPath(); c.moveTo(x - s, y); c.lineTo(x - s * 0.8, y - s * 0.55); c.lineTo(x - s * 0.2, y - s * 0.8); c.lineTo(x + s * 0.5, y - s * 0.65); c.lineTo(x + s, y - s * 0.1); c.lineTo(x + s * 0.9, y); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,244,214,.14)'; c.beginPath(); c.moveTo(x - s * 0.8, y - s * 0.55); c.lineTo(x - s * 0.2, y - s * 0.8); c.lineTo(x, y - s * 0.3); c.lineTo(x - s * 0.7, y - s * 0.1); c.closePath(); c.fill();
  c.fillStyle = 'rgba(24,30,50,.2)'; c.beginPath(); c.moveTo(x + s * 0.5, y - s * 0.65); c.lineTo(x + s, y - s * 0.1); c.lineTo(x + s * 0.9, y); c.lineTo(x + s * 0.2, y); c.closePath(); c.fill();
  c.fillStyle = 'rgba(86,130,70,.4)'; c.beginPath(); c.ellipse(x - s * 0.3, y - s * 0.7, s * 0.4, s * 0.12, -0.2, 0, TAU); c.fill();
}

/* trees along a ridge line (stable across chunks) */
function treesAlong(c, X, f, o) {
  const st = o.step || 24, i0 = Math.floor((X.x0 - BLEED - 60) / st), i1 = Math.ceil((X.x1 + BLEED + 60) / st);
  for (let i = i0; i <= i1; i++) {
    const r = rngAt(o.seed | 0, i, 5);
    if (r() > (o.dens || 0.6)) continue;
    const x = i * st + (r() - 0.5) * st, s = (o.size || 50) * (0.6 + r() * 0.8), col = pick(r, o.cols), y = f(x) + (o.dy || 0) + r() * 5;
    if (r() < (o.broad || 0)) broadleaf(c, x, y, s * 0.5, col, r, { blobs: 9 }); else conifer(c, x, y, s, col, r, o.hl !== false);
  }
}

/* ═════════════════ masonry & roofs ═════════════════ */
function blocks(c, rnd, x, y, w, h, col, bw, bh, a = 0.55) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  let row = 0;
  for (let yy = y; yy < y + h; yy += bh, row++) {
    const off = (row % 2) * bw * 0.5;
    for (let xx = x - off; xx < x + w; xx += bw) {
      const bwv = bw * (0.85 + rnd() * 0.3);
      c.fillStyle = tone(col, (rnd() - 0.5) * 0.22, a);
      c.fillRect(xx + 0.7, yy + 0.7, bwv - 1.4, bh - 1.4);
      if (rnd() < 0.08) { c.fillStyle = 'rgba(80,110,60,.25)'; c.fillRect(xx + 1, yy + bh * 0.6, bwv - 2, bh * 0.4); }
    }
  }
  c.fillStyle = 'rgba(30,34,52,.12)'; for (let yy = y + bh; yy < y + h; yy += bh) c.fillRect(x, yy - 0.8, w, 1.2);
  c.restore();
}
function crenels(c, x0, x1, y, cw, ch, col) {
  c.fillStyle = col;
  for (let x = x0; x < x1 - cw; x += cw * 2) c.fillRect(x, y - ch, cw, ch + 1);
  c.fillStyle = 'rgba(255,244,214,.12)';
  for (let x = x0; x < x1 - cw; x += cw * 2) c.fillRect(x, y - ch, cw * 0.35, ch);
}
function tiles(c, rnd, pts, col, rows, tw, opt = {}) {
  // pts: polygon [x,y]...; paints scalloped shingles over it in rows (roof)
  c.save(); c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.clip();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  const rh = (y1 - y0) / rows;
  for (let rr = 0; rr < rows; rr++) {
    const yy = y0 + rr * rh;
    for (let x = x0 - tw + (rr % 2) * tw * 0.5; x < x1 + tw; x += tw) {
      c.fillStyle = tone(col, (rnd() - 0.5) * 0.18 + (opt.moss && rnd() < 0.12 ? -0.1 : 0), 0.55);
      c.beginPath(); c.moveTo(x, yy); c.lineTo(x + tw, yy); c.lineTo(x + tw, yy + rh * 0.7); c.quadraticCurveTo(x + tw / 2, yy + rh * 1.25, x, yy + rh * 0.7); c.closePath(); c.fill();
    }
    c.strokeStyle = 'rgba(24,18,28,.2)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, yy + rh); c.lineTo(x1, yy + rh); c.stroke();
  }
  if (opt.moss) for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(90,128,70,.28)'; c.beginPath(); c.ellipse(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 6 + rnd() * 16, 3 + rnd() * 6, 0, 0, TAU); c.fill(); }
  c.restore();
}

/* ═════════════════ emissive lights (after colour grade) ═════════════════ */
function lightI(E, L) {
  // on-threshold staggers evening switch-on; late-night windows go dark again
  const on = smooth((E.lamp * 1.25 - 0.12 - L.on * 0.7) / 0.3);
  const off = L.kind === 'win' ? 1 - smooth((E.late - L.off) / 0.2) * 0.9 : 1;
  const fl = 0.9 + 0.1 * Math.sin(E.t * (2.5 + L.ph * 5) + L.ph * 40) + (L.kind === 'fire' ? 0.2 * Math.sin(E.t * 17 + L.ph * 9) : 0) + (L.kind === 'lamp' ? 0.05 * Math.sin(E.t * 9 + L.ph * 20) : 0);
  return clamp(on * off * (L.k || 1) * fl, 0, 1.3) * (E.ga === undefined ? 1 : E.ga);
}
function drawLights(g, E, lights) {
  const sp = E.spr; let n = 0;
  for (const L of lights) {
    const I = lightI(E, L); if (I < 0.03) continue; n++;
    const cx = L.x + L.w / 2, cy = L.y + L.h / 2;
    if (L.kind === 'win') {
      const r = Math.max(L.w, L.h) * (L.tiny ? 2.6 : 3.3);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(0.5 * I); g.drawImage(sp.warm, cx - r, cy - r, r * 2, r * 2); g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = vgrad(g, L.y, L.y + L.h, [255, 226, 150], [247, 168, 88]); g.globalAlpha = Math.min(1, I * 1.1); g.fillRect(L.x, L.y, L.w, L.h);
      if (!L.tiny && L.w > 6) { g.strokeStyle = 'rgba(58,38,28,.65)'; g.lineWidth = Math.max(1, L.w * 0.07); g.beginPath(); g.moveTo(cx, L.y); g.lineTo(cx, L.y + L.h); g.moveTo(L.x, cy); g.lineTo(L.x + L.w, cy); g.stroke(); }
      g.globalAlpha = 1;
    } else if (L.kind === 'lamp') {
      const r = L.r * 12;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(0.75 * I); g.drawImage(sp.warm, cx - r, cy - r, r * 2, r * 2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(255,238,196,${Math.min(1, I)})`; g.beginPath(); g.arc(cx, cy, L.r, 0, TAU); g.fill();
    } else if (L.kind === 'fire') {
      const r = L.r * 14;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(0.8 * I); g.drawImage(sp.warm, cx - r, cy - r, r * 2, r * 2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      const fh = L.r * (2.3 + 0.5 * Math.sin(E.t * 13 + L.ph * 7)), sway = Math.sin(E.t * 9 + L.ph * 5) * L.r * 0.3, a = Math.min(1, I);
      g.fillStyle = `rgba(255,150,60,${a})`; g.beginPath(); g.moveTo(cx - L.r * 0.8, cy + L.r); g.quadraticCurveTo(cx - L.r * 0.9, cy - fh * 0.3, cx + sway, cy - fh); g.quadraticCurveTo(cx + L.r * 0.9, cy - fh * 0.3, cx + L.r * 0.8, cy + L.r); g.closePath(); g.fill();
      g.fillStyle = `rgba(255,226,150,${a})`; g.beginPath(); g.moveTo(cx - L.r * 0.4, cy + L.r); g.quadraticCurveTo(cx - L.r * 0.4, cy, cx + sway * 0.6, cy - fh * 0.55); g.quadraticCurveTo(cx + L.r * 0.4, cy, cx + L.r * 0.4, cy + L.r); g.closePath(); g.fill();
    } else if (L.kind === 'door') {
      const op = L.open || 0, sp2 = L.h * (0.7 + op * 0.9);
      g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(0, L.y + L.h, 0, L.y + L.h + sp2); gr.addColorStop(0, `rgba(255,170,80,${(0.3 + op * 0.22) * I})`); gr.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(L.x, L.y + L.h); g.lineTo(L.x + L.w, L.y + L.h); g.lineTo(L.x + L.w * (2.4 + op), L.y + L.h + sp2); g.lineTo(L.x - L.w * (1.4 + op), L.y + L.h + sp2); g.closePath(); g.fill();
      g.globalAlpha = clamp(0.35 * I); const r = L.h * 1.2; g.drawImage(sp.warm, cx - r, cy - r, r * 2, r * 2); g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = vgrad(g, L.y, L.y + L.h, [255, 214, 140], [245, 160, 84]); g.globalAlpha = Math.min(1, 0.95 * I);
      g.beginPath(); g.moveTo(L.x, L.y + L.h); g.lineTo(L.x, L.y + L.h * 0.25); g.quadraticCurveTo(cx, L.y - L.h * 0.12, L.x + L.w, L.y + L.h * 0.25); g.lineTo(L.x + L.w, L.y + L.h); g.closePath(); g.fill(); g.globalAlpha = 1;
    } else if (L.kind === 'glow') { // generic soft coloured emitter (crystal, glyph, wisp)
      const r = L.r, pulse = 0.85 + 0.15 * Math.sin(E.t * (L.sp || 1.2) + L.ph * 9);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp((L.base || 0) + I * pulse * 0.9); g.drawImage(sp[L.col || 'cyan'], cx - r, cy - r, r * 2, r * 2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  return n;
}

/* ═════════════════ buildings ═════════════════ */
function windowAt(c, X, r, x, y, w, h, o = {}) {
  const fr = o.beam || '#4a3b33';
  c.fillStyle = 'rgba(20,18,30,.2)'; c.fillRect(x - w * 0.1, y + h * 1.04, w * 1.3, h * 0.06);
  c.fillStyle = tone('#938d82', -0.05); c.fillRect(x - w * 0.14, y + h, w * 1.28, h * 0.09);
  c.fillStyle = css(fr, 0.95); c.fillRect(x - w * 0.1, y - h * 0.07, w * 1.2, h * 1.14);
  c.fillStyle = vgrad(c, y, y + h, '#4d5d75', '#27303f'); c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(200,218,236,.2)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.62, y); c.lineTo(x, y + h * 0.72); c.closePath(); c.fill();
  if (o.curtain) { c.fillStyle = css(o.curtain, 0.85); c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.38, y); c.quadraticCurveTo(x + w * 0.18, y + h * 0.45, x + w * 0.3, y + h); c.lineTo(x, y + h); c.closePath(); c.fill(); c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w * 0.62, y); c.quadraticCurveTo(x + w * 0.82, y + h * 0.45, x + w * 0.7, y + h); c.lineTo(x + w, y + h); c.closePath(); c.fill(); }
  c.strokeStyle = css(fr, 0.95); c.lineWidth = Math.max(1, w * 0.07);
  c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h * 0.5); c.lineTo(x + w, y + h * 0.5); c.stroke();
  if (o.shutter) {
    const sc = o.shutter;
    [[x - w * 0.5, w * 0.42], [x + w * 1.08, w * 0.42]].forEach(a => {
      c.fillStyle = css(sc, 0.97); c.fillRect(a[0], y - h * 0.05, a[1], h * 1.1);
      c.fillStyle = 'rgba(255,244,214,.1)'; c.fillRect(a[0], y - h * 0.05, a[1] * 0.3, h * 1.1);
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1;
      for (let i = 1; i < 7; i++) { const yy = y - h * 0.05 + h * 1.1 * i / 7; c.beginPath(); c.moveTo(a[0], yy); c.lineTo(a[0] + a[1], yy); c.stroke(); }
    });
  }
  if (o.box) {
    c.fillStyle = '#6a4b36'; c.fillRect(x - w * 0.12, y + h * 1.08, w * 1.24, h * 0.17);
    for (let i = 0; i < 9; i++) { c.fillStyle = tone(pick(r, ['#4f7a48', '#5d8a52', '#456b44']), (r() - 0.5) * 0.3); c.beginPath(); c.arc(x - w * 0.05 + i * w * 0.14, y + h * 1.06, w * 0.11, 0, TAU); c.fill(); }
    const fc = pick(r, ['#c9574a', '#e0c04e', '#b9a0d4', '#eee6d6', '#d9769a']);
    for (let i = 0; i < 7; i++) { c.fillStyle = css(fc, 0.95); c.beginPath(); c.arc(x - w * 0.02 + i * w * 0.16, y + h * (0.98 + (i % 2) * 0.05), Math.max(1.4, w * 0.06), 0, TAU); c.fill(); }
  }
  if (o.k > 0) X.light({ kind: 'win', x, y, w, h, k: o.k, tiny: o.tiny });
}

function chimney(c, X, x, y, w, h, col = '#7d7066') {
  c.fillStyle = tone(col, -0.03); c.fillRect(x - w / 2, y - h, w, h + 4);
  c.fillStyle = 'rgba(255,240,210,.14)'; c.fillRect(x - w / 2, y - h, w * 0.3, h + 4);
  c.fillStyle = 'rgba(24,26,40,.2)'; c.fillRect(x + w * 0.2, y - h, w * 0.3, h + 4);
  c.strokeStyle = 'rgba(30,26,34,.2)'; c.lineWidth = 1; for (let i = 1; i < h / 8; i++) { c.beginPath(); c.moveTo(x - w / 2, y - h + i * 8); c.lineTo(x + w / 2, y - h + i * 8); c.stroke(); }
  c.fillStyle = tone('#4c443f', 0); c.fillRect(x - w * 0.62, y - h - w * 0.3, w * 1.24, w * 0.4);
  X.smoke.push({ x, y: y - h - w * 0.3, s: clamp(w / 22, 0.6, 1.3) });
}

/* gable-front / long / thatched timber house. Returns extents. */
function house(c, X, cx, gy, o = {}) {
  const r = o.r || rngAt(cx | 0, 91, 3);
  const w = o.w || 200, floors = o.floors || 2, fh = o.fh || (82 + r() * 12), bh = o.base !== undefined ? o.base : 30;
  const H = bh + floors * fh, x = cx - w / 2, top = gy - H;
  const wall = o.wall || pick(r, PAL.plaster), beam = o.beam || '#4a3b33', roof = o.roof || pick(r, PAL.roofs), stone = o.stone || '#938d82';
  const jet = o.jetty ? Math.min(18, w * 0.07) : 0, style = o.style || 'gable', litP = o.litP !== undefined ? o.litP : 0.6;
  const ov = o.ov !== undefined ? o.ov : Math.max(8, w * 0.06);
  c.fillStyle = 'rgba(20,24,40,.22)'; c.beginPath(); c.ellipse(cx + w * 0.06, gy + 2, w * 0.6, 8, 0, 0, TAU); c.fill();
  // floors
  for (let f = 0; f < floors; f++) {
    const y1 = gy - bh - f * fh, y0 = y1 - fh, xe = f > 0 ? jet : 0;
    c.fillStyle = vgrad(c, y0, y1 + (f === 0 ? bh : 0), tone(wall, 0.09), tone(wall, f === 0 ? -0.2 : -0.1));
    c.fillRect(x - xe, y0, w + xe * 2, fh + (f === 0 ? bh : 0));
  }
  // plaster texture
  c.save(); c.beginPath(); c.rect(x - jet, top, w + jet * 2, H); c.clip();
  for (let i = 0; i < w * H / 700; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,244,214,.05)' : 'rgba(60,50,40,.05)'; c.beginPath(); c.ellipse(x - jet + r() * (w + 2 * jet), top + r() * H, 3 + r() * 14, 2 + r() * 6, r() * 3, 0, TAU); c.fill(); }
  if (r() < 0.6) { const px = x + r() * w * 0.6, py = gy - bh - fh * (0.2 + r() * 0.6); c.fillStyle = tone('#b0795c', -0.05, 0.75); c.fillRect(px, py, 24 + r() * 26, 14 + r() * 12); blocks(c, r, px, py, 40, 26, '#b0795c', 8, 5, 0.5); }
  c.fillStyle = 'rgba(28,34,64,.12)'; c.fillRect(x + w * 0.82, top, w * 0.2 + jet, H);
  c.fillStyle = vgrad(c, top, top + 22, 'rgba(20,18,30,.3)', 'rgba(20,18,30,0)'); c.fillRect(x - jet, top, w + jet * 2, 22);
  c.restore();
  // stone plinth
  if (bh > 0) { c.fillStyle = tone(stone, 0); c.fillRect(x, gy - bh, w, bh); blocks(c, r, x, gy - bh, w, bh, stone, Math.max(10, w * 0.08), 8, 0.6); c.fillStyle = vgrad(c, gy - bh, gy, 'rgba(255,244,214,.0)', 'rgba(30,34,40,.28)'); c.fillRect(x, gy - bh, w, bh); }
  // timber frame
  const lw = Math.max(2.4, w * 0.02);
  c.strokeStyle = css(beam, 0.95); c.lineWidth = lw; c.lineCap = 'butt';
  const nb = Math.max(2, Math.round(w / (fh * 0.95)));
  for (let f = 0; f <= floors; f++) { const y = gy - bh - f * fh, xe = f > 1 || (f === 1 && floors > 1) ? jet : 0; c.beginPath(); c.moveTo(x - xe, y); c.lineTo(x + w + xe, y); c.stroke(); }
  for (let f = 0; f < floors; f++) {
    const y1 = gy - bh - f * fh, y0 = y1 - fh, xe = f > 0 ? jet : 0;
    for (let i = 0; i <= nb; i++) { const xx = x - xe + i * (w + 2 * xe) / nb; c.beginPath(); c.moveTo(xx, y1); c.lineTo(xx, y0); c.stroke(); }
    for (let i = 0; i < nb; i++) if (r() < 0.5) {
      const xa = x - xe + i * (w + 2 * xe) / nb, xb = xa + (w + 2 * xe) / nb; c.lineWidth = lw * 0.8; c.beginPath();
      if (r() < 0.5) { c.moveTo(xa, y1); c.lineTo(xb, y1 - fh * 0.34); } else { c.moveTo(xb, y1); c.lineTo(xa, y1 - fh * 0.34); } c.stroke(); c.lineWidth = lw;
    }
  }
  c.strokeStyle = 'rgba(255,230,190,.12)'; c.lineWidth = 1; for (let f = 0; f <= floors; f++) { const y = gy - bh - f * fh - lw * 0.3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.stroke(); }
  if (jet) for (let i = 0; i <= nb; i += 1) { const xx = x + i * w / nb, y = gy - bh - fh; c.fillStyle = css(beam, 0.95); c.beginPath(); c.moveTo(xx - 4, y); c.lineTo(xx + 4, y); c.lineTo(xx, y + 10); c.closePath(); c.fill(); }
  // doors & windows
  const doorBay = o.door === false ? -1 : (o.doorBay !== undefined ? o.doorBay : (nb >> 1));
  const shut = o.shutter !== undefined ? o.shutter : (r() < 0.6 ? pick(r, PAL.shutters) : null);
  for (let f = 0; f < floors; f++) for (let i = 0; i < nb; i++) {
    const xe = f > 0 ? jet : 0, bw = (w + 2 * xe) / nb, bx = x - xe + (i + 0.5) * bw;
    const ww = bw * 0.4, wh = fh * 0.44, wy = gy - bh - (f + 0.5) * fh - wh * 0.45;
    if (f === 0 && i === doorBay) continue;
    if (f === 0 && bh > 0 && wy + wh > gy - bh * 0.3) { /* high enough above plinth */ }
    const lit = r() < litP;
    windowAt(c, X, r, bx - ww / 2, wy, ww, wh, { beam, shutter: shut, box: f > 0 && r() < 0.3 && ww > 14, curtain: !lit && r() < 0.35 ? pick(r, ['#d8cdb4', '#b88a7a']) : null, k: lit ? (o.k || 1) * (0.8 + r() * 0.2) : (r() < 0.25 ? 0.5 : 0) });
  }
  if (doorBay >= 0) {
    const bw = w / nb, dx = x + (doorBay + 0.5) * bw, dw = Math.min(bw * 0.55, 58), dh = Math.min(fh * 0.98 + bh * 0.25, 112);
    c.fillStyle = tone(stone, -0.1); c.fillRect(dx - dw / 2 - 6, gy - 5, dw + 12, 5);
    c.fillStyle = tone('#4a382c', -0.05);
    c.beginPath(); c.moveTo(dx - dw / 2, gy - 5); c.lineTo(dx - dw / 2, gy - dh * 0.72); c.quadraticCurveTo(dx, gy - dh * 1.14, dx + dw / 2, gy - dh * 0.72); c.lineTo(dx + dw / 2, gy - 5); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(20,14,12,.35)'; c.lineWidth = 1; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(dx - dw / 2 + dw * i / 5, gy - 5); c.lineTo(dx - dw / 2 + dw * i / 5, gy - dh * 0.8); c.stroke(); }
    c.strokeStyle = '#2d2622'; c.lineWidth = 2; c.beginPath(); c.moveTo(dx - dw / 2, gy - dh * 0.4); c.lineTo(dx + dw / 2, gy - dh * 0.4); c.stroke();
    c.strokeStyle = css(beam, 0.95); c.lineWidth = lw; c.beginPath(); c.moveTo(dx - dw / 2, gy - 5); c.lineTo(dx - dw / 2, gy - dh * 0.72); c.quadraticCurveTo(dx, gy - dh * 1.14, dx + dw / 2, gy - dh * 0.72); c.lineTo(dx + dw / 2, gy - 5); c.stroke();
    c.fillStyle = '#c9a85a'; c.beginPath(); c.arc(dx + dw * 0.28, gy - dh * 0.42, 2, 0, TAU); c.fill();
    if (o.doorLight) X.light({ kind: 'door', x: dx - dw / 2, y: gy - dh * 0.98, w: dw, h: dh * 0.95, k: 1.2, door: true });
    if (o.lantern !== false && r() < 0.5) { c.strokeStyle = '#2f2b2e'; c.lineWidth = 2; c.beginPath(); c.moveTo(dx + dw / 2 + 4, gy - dh * 1.0); c.lineTo(dx + dw / 2 + 4, gy - dh * 0.88); c.stroke(); c.fillStyle = '#6e5a3c'; c.fillRect(dx + dw / 2, gy - dh * 0.88, 8, 10); X.light({ kind: 'lamp', x: dx + dw / 2 + 1, y: gy - dh * 0.87, w: 6, h: 8, r: 3.5, k: 1 }); }
  }
  // roof
  const rh = o.roofH || (style === 'long' ? 70 + w * 0.12 : w * (0.5 + r() * 0.12)), xl = x - jet - ov, xr = x + w + jet + ov;
  if (style === 'gable') {
    const poly = [[xl, top], [cx, top - rh], [xr, top]];
    c.fillStyle = vgrad(c, top - rh, top, tone(roof, 0.12), tone(roof, -0.14)); c.beginPath(); poly.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill();
    tiles(c, r, poly, roof, Math.max(5, Math.round(rh / 11)), Math.max(8, w * 0.05), { moss: r() < 0.5 });
    c.fillStyle = 'rgba(255,240,210,.1)'; c.beginPath(); c.moveTo(cx, top - rh); c.lineTo(xl, top); c.lineTo(cx, top); c.closePath(); c.fill();
    c.strokeStyle = tone(roof, -0.4, 0.95); c.lineWidth = Math.max(2, w * 0.022); c.lineJoin = 'round'; c.beginPath(); c.moveTo(xl, top); c.lineTo(cx, top - rh); c.lineTo(xr, top); c.stroke();
    c.fillStyle = tone(roof, -0.3); c.fillRect(xl, top - 2, xr - xl, 6);
    if (o.attic !== false && rh > 70) { const aw = Math.min(26, w * 0.12), ay = top - rh * 0.4; c.fillStyle = css(beam, 0.95); c.fillRect(cx - aw / 2 - 3, ay - aw * 0.65 - 3, aw + 6, aw * 1.3 + 3); c.fillStyle = vgrad(c, ay - aw * 0.65, ay + aw * 0.65, '#47566d', '#27303f'); c.fillRect(cx - aw / 2, ay - aw * 0.65, aw, aw * 1.3); X.light({ kind: 'win', x: cx - aw / 2, y: ay - aw * 0.65, w: aw, h: aw * 1.3, k: r() < litP ? 0.9 : 0.1 }); }
    if (o.chimney !== false && r() < 0.85) { const chx = cx + (r() - 0.5) * w * 0.55, ry = top - rh * (1 - Math.abs(chx - cx) / (w / 2 + jet + ov)); chimney(c, X, chx, ry + 4, Math.max(14, w * 0.085), rh * 0.34 + 6); }
  } else if (style === 'thatch') {
    const base = top + 8, th = rh * 0.92, pts = [[xl - 4, base]];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([lerp(xl - 4, cx, t) + (r() - 0.5) * 3, lerp(base, top - th, Math.pow(t, 0.9))]); }
    for (let i = 1; i <= 14; i++) { const t = i / 14; pts.push([lerp(cx, xr + 4, t) + (r() - 0.5) * 3, lerp(top - th, base, Math.pow(t, 1.1))]); }
    for (let i = 14; i >= 0; i--) pts.push([lerp(xr + 4, xl - 4, i / 14), base + 10 + Math.sin(i * 2.3) * 4 + r() * 5]);
    c.fillStyle = vgrad(c, top - th, base + 8, tone('#c2a868', 0.12), tone('#8f7648', -0.14)); c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill();
    c.save(); c.clip();
    for (let i = 0; i < 160; i++) { const sx = xl + r() * (xr - xl), sy = top - th + r() * (th + 16); c.strokeStyle = r() < 0.5 ? 'rgba(255,236,170,.16)' : 'rgba(70,52,30,.18)'; c.lineWidth = 1 + r(); c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + (sx < cx ? 1 : -1) * 8, sy + 14 + r() * 10); c.stroke(); }
    c.fillStyle = 'rgba(86,120,64,.25)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(xl + r() * (xr - xl), top - th * r(), 14 + r() * 18, 5 + r() * 6, 0, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(28,24,32,.2)'; c.fillRect(cx, top - th, xr - cx, th + 20);
    c.restore();
    c.fillStyle = tone('#9a8250', -0.1); c.beginPath(); c.ellipse(cx - w * 0.2, top - th * 0.35, w * 0.12, th * 0.13, 0, Math.PI, 0); c.fill(); windowAt(c, X, r, cx - w * 0.2 - 8, top - th * 0.35 - 4, 16, 14, { beam, k: r() < litP ? 0.9 : 0 });
    chimney(c, X, cx + w * 0.22, top - th * 0.5, Math.max(14, w * 0.09), th * 0.45, '#8a7e72');
  } else { // long
    const poly = [[xl, top + 4], [xl + rh * 0.7, top - rh], [xr - rh * 0.7, top - rh], [xr, top + 4]];
    c.fillStyle = vgrad(c, top - rh, top, tone(roof, 0.12), tone(roof, -0.14)); c.beginPath(); poly.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill();
    tiles(c, r, poly, roof, Math.max(5, Math.round(rh / 11)), Math.max(8, w * 0.04), { moss: r() < 0.5 });
    c.fillStyle = 'rgba(255,240,210,.1)'; c.beginPath(); c.moveTo(poly[1][0], poly[1][1]); c.lineTo(poly[2][0], poly[2][1]); c.lineTo(poly[2][0], poly[2][1] + rh * 0.3); c.lineTo(poly[1][0], poly[1][1] + rh * 0.3); c.closePath(); c.fill();
    c.strokeStyle = tone(roof, -0.4, 0.9); c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath(); poly.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
    const nd = w > 230 ? 2 : 1;
    for (let d = 0; d < nd; d++) { const dx = lerp(xl + rh, xr - rh, (d + 0.5) / nd), dw = 36, dy = top - rh * 0.28; c.fillStyle = css(beam, 0.95); c.fillRect(dx - dw / 2, dy - 40, dw, 40); c.fillStyle = tone(roof, 0.05); c.beginPath(); c.moveTo(dx - dw / 2 - 5, dy - 40); c.lineTo(dx, dy - 66); c.lineTo(dx + dw / 2 + 5, dy - 40); c.closePath(); c.fill(); windowAt(c, X, r, dx - 9, dy - 34, 18, 26, { beam, k: r() < litP ? 0.9 : 0 }); }
    if (o.chimney !== false) { chimney(c, X, xl + rh * 0.9 + r() * (xr - xl - rh * 1.8), top - rh * 0.6, 20, 40); }
  }
  return { x0: x - jet - ov, x1: x + w + jet + ov, top: top - rh, gfTop: gy - bh - fh };
}

function towerR(c, X, r, x, g, w, h, col, roofCol, rh, o = {}) {
  c.fillStyle = hgrad(c, x - w / 2, x + w / 2, tone(col, 0.18), tone(col, -0.28), col); c.fillRect(x - w / 2, g - h, w, h);
  if (w > 18) blocks(c, r, x - w / 2, g - h, w, h, col, Math.max(8, w * 0.28), Math.max(6, w * 0.18), 0.14);
  if (o.slits) for (let i = 0; i < o.slits; i++) {
    const sy = g - h * (0.2 + 0.62 * i / Math.max(1, o.slits - 1)), sw = Math.max(2, w * 0.09);
    c.fillStyle = 'rgba(25,26,38,.82)'; c.fillRect(x - sw / 2, sy - w * 0.13, sw, w * 0.26);
    if (o.lit) X.light({ kind: 'win', x: x - sw / 2, y: sy - w * 0.13, w: sw, h: w * 0.26, k: o.lit, tiny: w < 60 });
  }
  c.fillStyle = tone(col, -0.12); c.fillRect(x - w * 0.58, g - h - w * 0.08, w * 1.16, w * 0.12);
  if (rh > 0) {
    c.fillStyle = hgrad(c, x - w * 0.64, x + w * 0.64, tone(roofCol, 0.18), tone(roofCol, -0.3), roofCol);
    c.beginPath(); c.moveTo(x - w * 0.66, g - h - w * 0.02); c.lineTo(x, g - h - rh); c.lineTo(x + w * 0.66, g - h - w * 0.02); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(25,20,28,.15)'; c.lineWidth = 1;
    for (let i = 1; i < 8; i++) { const yy = g - h - rh * i / 8, hw = w * 0.66 * (1 - i / 8); c.beginPath(); c.moveTo(x - hw, yy + rh / 16); c.lineTo(x + hw, yy + rh / 16); c.stroke(); }
    if (o.flag) X.flag({ x, y: g - h - rh, len: Math.max(14, w * 0.75), col: o.flag });
  } else crenels(c, x - w / 2, x + w / 2, g - h, w / 6, w * 0.14, tone(col, -0.05));
}

/* ═════════════════ market stalls — each kind has its own goods ═════════════════ */
const STALLS = ['fruit', 'bread', 'cloth', 'fish', 'pottery', 'herbs', 'smith', 'flowers', 'veg'];
function crate(c, x, y, w, h, col = '#8a6a48') {
  c.fillStyle = tone(col, 0); c.fillRect(x, y - h, w, h);
  c.strokeStyle = 'rgba(30,20,14,.45)'; c.lineWidth = 1; for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(x, y - h * i / 3); c.lineTo(x + w, y - h * i / 3); c.stroke(); }
  c.fillStyle = 'rgba(255,240,210,.14)'; c.fillRect(x, y - h, w, 2); c.fillStyle = 'rgba(20,16,26,.2)'; c.fillRect(x + w - 3, y - h, 3, h);
  c.strokeStyle = '#4a3a2c'; c.lineWidth = 2; c.strokeRect(x, y - h, w, h);
}
function fruitPile(c, r, x, y, w, rows, rad, col, kind) {
  for (let j = 0; j < rows; j++) {
    const n = Math.max(2, Math.floor((w - j * rad * 1.1) / (rad * 1.85)));
    for (let i = 0; i < n; i++) {
      const fx = x + (w - n * rad * 1.85) / 2 + (i + 0.5) * rad * 1.85 + (r() - 0.5) * 2, fy = y - j * rad * 1.45 - rad * 0.4;
      c.fillStyle = tone(col, (r() - 0.5) * 0.16 - 0.12); c.beginPath(); c.ellipse(fx, fy, rad, kind === 'pear' ? rad * 1.2 : rad * 0.95, 0, 0, TAU); c.fill();
      c.fillStyle = tone(col, (r() - 0.5) * 0.1); c.beginPath(); c.ellipse(fx - rad * 0.08, fy - rad * 0.06, rad * 0.9, rad * (kind === 'pear' ? 1.08 : 0.86), 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,248,226,.5)'; c.beginPath(); c.ellipse(fx - rad * 0.32, fy - rad * 0.36, rad * 0.26, rad * 0.16, -0.5, 0, TAU); c.fill();
      if (kind === 'apple' && r() < 0.5) { c.strokeStyle = '#4a3624'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx, fy - rad * 0.8); c.lineTo(fx + 1.5, fy - rad * 1.15); c.stroke(); }
    }
  }
}
function bottle(c, x, y, w, h, col) {
  c.fillStyle = tone(col, -0.1); c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y - h * 0.55); c.lineTo(x - w * 0.18, y - h * 0.72); c.lineTo(x - w * 0.18, y - h * 0.92); c.lineTo(x + w * 0.18, y - h * 0.92); c.lineTo(x + w * 0.18, y - h * 0.72); c.lineTo(x + w / 2, y - h * 0.55); c.lineTo(x + w / 2, y); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - w * 0.34, y - h * 0.5, w * 0.12, h * 0.4);
  c.fillStyle = '#8a6a48'; c.fillRect(x - w * 0.2, y - h * 1.0, w * 0.4, h * 0.1);
}
function jar(c, x, y, w, h, col, o = {}) {
  c.fillStyle = tone(col, -0.14); c.beginPath(); c.moveTo(x - w * 0.28, y); c.bezierCurveTo(x - w * 0.62, y - h * 0.15, x - w * 0.6, y - h * 0.62, x - w * 0.22, y - h * 0.78); c.lineTo(x - w * 0.2, y - h * 0.95); c.lineTo(x + w * 0.2, y - h * 0.95); c.lineTo(x + w * 0.22, y - h * 0.78); c.bezierCurveTo(x + w * 0.6, y - h * 0.62, x + w * 0.62, y - h * 0.15, x + w * 0.28, y); c.closePath(); c.fill();
  c.fillStyle = tone(col, 0.06); c.beginPath(); c.moveTo(x - w * 0.28, y); c.bezierCurveTo(x - w * 0.62, y - h * 0.15, x - w * 0.6, y - h * 0.62, x - w * 0.22, y - h * 0.78); c.lineTo(x - w * 0.1, y - h * 0.78); c.bezierCurveTo(x - w * 0.36, y - h * 0.55, x - w * 0.34, y - h * 0.15, x - w * 0.1, y); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(30,20,16,.3)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - w * 0.5, y - h * 0.46); c.quadraticCurveTo(x, y - h * 0.38, x + w * 0.5, y - h * 0.46); c.stroke();
  if (o.handles) { c.strokeStyle = tone(col, -0.2); c.lineWidth = w * 0.07; c.beginPath(); c.arc(x - w * 0.42, y - h * 0.68, w * 0.14, Math.PI * 0.6, Math.PI * 1.6); c.stroke(); c.beginPath(); c.arc(x + w * 0.42, y - h * 0.68, w * 0.14, Math.PI * 1.4, Math.PI * 0.4); c.stroke(); }
}
function sack(c, r, x, y, w, h, col = '#b6a27a') {
  c.fillStyle = tone(col, -0.12); c.beginPath(); c.moveTo(x - w / 2, y); c.quadraticCurveTo(x - w * 0.62, y - h * 0.5, x - w * 0.38, y - h * 0.82); c.lineTo(x + w * 0.38, y - h * 0.82); c.quadraticCurveTo(x + w * 0.62, y - h * 0.5, x + w / 2, y); c.closePath(); c.fill();
  c.fillStyle = tone(col, 0.1, 0.8); c.beginPath(); c.moveTo(x - w * 0.45, y - 2); c.quadraticCurveTo(x - w * 0.55, y - h * 0.5, x - w * 0.32, y - h * 0.78); c.lineTo(x - w * 0.1, y - h * 0.78); c.quadraticCurveTo(x - w * 0.3, y - h * 0.4, x - w * 0.2, y - 2); c.closePath(); c.fill();
  c.fillStyle = tone(col, -0.22); c.beginPath(); c.moveTo(x - w * 0.4, y - h * 0.8); c.quadraticCurveTo(x, y - h * 1.02, x + w * 0.4, y - h * 0.8); c.quadraticCurveTo(x, y - h * 0.7, x - w * 0.4, y - h * 0.8); c.fill();
  c.strokeStyle = '#6a553a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - w * 0.36, y - h * 0.8); c.lineTo(x + w * 0.36, y - h * 0.8); c.stroke();
}
function basket(c, x, y, w, h, col = '#a98a58') {
  c.fillStyle = tone(col, -0.1); c.beginPath(); c.moveTo(x - w / 2, y - h); c.lineTo(x + w / 2, y - h); c.lineTo(x + w * 0.4, y); c.lineTo(x - w * 0.4, y); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(50,34,18,.35)'; c.lineWidth = 1;
  for (let i = 1; i < 5; i++) { const yy = y - h * i / 5; c.beginPath(); c.moveTo(x - w * lerp(0.4, 0.5, i / 5), yy); c.lineTo(x + w * lerp(0.4, 0.5, i / 5), yy); c.stroke(); }
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * w * 0.14, y); c.lineTo(x + i * w * 0.17, y - h); c.stroke(); }
  c.fillStyle = 'rgba(255,240,200,.16)'; c.fillRect(x - w / 2, y - h, w * 0.25, h);
}
function fishShape(c, x, y, s, col, a = 0) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = tone(col, -0.25); c.beginPath(); c.moveTo(s * 0.4, 0); c.lineTo(s * 0.66, -s * 0.2); c.lineTo(s * 0.62, 0); c.lineTo(s * 0.66, s * 0.2); c.closePath(); c.fill();
  c.fillStyle = tone(col, -0.12); c.beginPath(); c.ellipse(0, 0, s * 0.45, s * 0.17, 0, 0, TAU); c.fill();
  c.fillStyle = tone(col, 0.28, 0.9); c.beginPath(); c.ellipse(-s * 0.02, s * 0.05, s * 0.4, s * 0.09, 0, 0, TAU); c.fill();
  c.fillStyle = tone(col, -0.3); c.beginPath(); c.moveTo(-s * 0.1, -s * 0.15); c.lineTo(s * 0.08, -s * 0.28); c.lineTo(s * 0.18, -s * 0.14); c.fill();
  c.fillStyle = '#1c1c22'; c.beginPath(); c.arc(-s * 0.33, -s * 0.03, Math.max(1, s * 0.035), 0, TAU); c.fill();
  c.strokeStyle = 'rgba(30,40,56,.4)'; c.lineWidth = 1; c.beginPath(); c.arc(-s * 0.24, 0, s * 0.12, -1.2, 1.2); c.stroke();
  c.restore();
}
function iconSign(c, kind, x, y, s) {
  c.fillStyle = '#5a4332'; c.fillRect(x - s * 0.6, y, s * 1.2, s * 1.0); c.fillStyle = '#d9c9a2'; c.fillRect(x - s * 0.52, y + s * 0.08, s * 1.04, s * 0.84);
  c.fillStyle = '#6a4b36'; c.strokeStyle = '#6a4b36'; c.lineWidth = s * 0.07;
  const cx = x, cy = y + s * 0.5;
  if (kind === 'fruit') { c.fillStyle = '#b5473b'; c.beginPath(); c.arc(cx, cy + 2, s * 0.26, 0, TAU); c.fill(); c.fillStyle = '#5f8a48'; c.beginPath(); c.ellipse(cx + 4, cy - s * 0.26, s * 0.12, s * 0.06, -0.5, 0, TAU); c.fill(); }
  else if (kind === 'bread') { c.fillStyle = '#b9854a'; c.beginPath(); c.ellipse(cx, cy, s * 0.34, s * 0.2, 0, 0, TAU); c.fill(); }
  else if (kind === 'cloth') { c.fillStyle = '#5d6f86'; c.fillRect(cx - s * 0.3, cy - s * 0.18, s * 0.6, s * 0.36); c.strokeStyle = '#d9c9a2'; c.beginPath(); c.moveTo(cx - s * 0.1, cy - s * 0.18); c.lineTo(cx - s * 0.1, cy + s * 0.18); c.stroke(); }
  else if (kind === 'fish') { fishShape(c, cx, cy, s * 0.8, '#6f8aa0'); }
  else if (kind === 'pottery') { jar(c, cx, cy + s * 0.3, s * 0.7, s * 0.7, '#b9714c'); }
  else if (kind === 'herbs') { c.strokeStyle = '#5f8a48'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(cx, cy + s * 0.28); c.lineTo(cx + i * s * 0.2, cy - s * 0.25); c.stroke(); } }
  else if (kind === 'smith') { c.fillStyle = '#3a3f48'; c.fillRect(cx - s * 0.3, cy - s * 0.08, s * 0.6, s * 0.16); c.fillRect(cx - s * 0.14, cy + s * 0.06, s * 0.28, s * 0.2); }
  else if (kind === 'flowers') { c.fillStyle = '#c9638a'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(cx + i * s * 0.2, cy - Math.abs(i) * 3, s * 0.12, 0, TAU); c.fill(); } }
  else { c.fillStyle = '#6f9a52'; c.beginPath(); c.arc(cx, cy, s * 0.26, 0, TAU); c.fill(); }
}

function stall(c, X, r, x, gy, kind, awnCol, o = {}) {
  const W = 190, s = o.s || 1;
  c.save(); c.translate(x, gy); c.scale(s, s); const g = 0; // local: ground at y=0, centre x=0
  c.fillStyle = 'rgba(20,25,40,.2)'; c.beginPath(); c.ellipse(0, 2, W * 0.62, 11, 0, 0, TAU); c.fill();
  // back posts + back cloth
  c.fillStyle = '#5a4637'; c.fillRect(-W * 0.52 - 4, g - 188, 8, 188); c.fillRect(W * 0.52 - 4, g - 188, 8, 188);
  c.fillStyle = kind === 'smith' ? '#3f3a3c' : (kind === 'cloth' ? '#6d6458' : '#7a6a56'); c.fillRect(-W * 0.5, g - 176, W, 118);
  c.fillStyle = 'rgba(14,12,24,.28)'; c.fillRect(-W * 0.5, g - 176, W, 118);
  // back-shelf goods (per kind)
  const R = r;
  if (kind === 'pottery') { c.fillStyle = '#6a5240'; for (let t = 0; t < 2; t++) c.fillRect(-W * 0.5, g - 150 + t * 40, W, 5); for (let t = 0; t < 2; t++) for (let i = 0; i < 6; i++) jar(c, -W * 0.42 + i * W * 0.165, g - 150 + t * 40, 24 + R() * 8, 24 + R() * 10, pick(R, ['#b9714c', '#a8584a', '#7a9a98', '#c9a55c', '#8a6a5a']), { handles: R() < 0.3 }); }
  if (kind === 'cloth') { for (let i = 0; i < 6; i++) { const cx0 = -W * 0.44 + i * W * 0.17, col = pick(R, ['#5d6f86', '#a8584a', '#c7a55c', '#6f8a5f', '#8a6a9a', '#d8cdb4']); c.fillStyle = tone(col, 0, 0.95); c.beginPath(); c.moveTo(cx0 - 11, g - 172); c.lineTo(cx0 + 11, g - 172); for (let q = 0; q <= 6; q++) c.lineTo(cx0 + 11 - (q % 2) * 2, g - 172 + q * 17 + 8); c.lineTo(cx0 - 11, g - 74); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,244,214,.18)'; c.fillRect(cx0 - 11, g - 172, 5, 100); c.fillStyle = 'rgba(20,18,30,.2)'; c.fillRect(cx0 + 4, g - 172, 7, 100); } }
  if (kind === 'smith') { c.strokeStyle = '#2f2a2c'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { const sx = -W * 0.38 + i * 38; c.strokeStyle = '#aab0b8'; c.lineWidth = 4; c.beginPath(); c.moveTo(sx, g - 160); c.lineTo(sx + 3, g - 100); c.stroke(); c.strokeStyle = '#4a3a2c'; c.lineWidth = 6; c.beginPath(); c.moveTo(sx - 9, g - 108); c.lineTo(sx + 12, g - 108); c.stroke(); c.beginPath(); c.moveTo(sx + 3, g - 108); c.lineTo(sx + 3, g - 92); c.stroke(); } c.fillStyle = '#8a6a48'; c.beginPath(); c.arc(W * 0.3, g - 128, 24, 0, TAU); c.fill(); c.fillStyle = '#b8bdc2'; c.beginPath(); c.arc(W * 0.3, g - 128, 6, 0, TAU); c.fill(); c.strokeStyle = '#4a3a2c'; c.lineWidth = 3; c.beginPath(); c.arc(W * 0.3, g - 128, 24, 0, TAU); c.stroke(); }
  if (kind === 'herbs') { c.fillStyle = '#6a5240'; c.fillRect(-W * 0.5, g - 120, W, 5); for (let i = 0; i < 8; i++) bottle(c, -W * 0.42 + i * W * 0.12, g - 120, 12, 26, pick(R, ['#6f9a80', '#a87a9a', '#c9a55c', '#7a8aa8', '#a8584a'])); }
  if (kind === 'bread') { c.fillStyle = '#6a5240'; c.fillRect(-W * 0.5, g - 124, W, 5); for (let i = 0; i < 6; i++) { const bx = -W * 0.4 + i * W * 0.16; c.fillStyle = tone('#b9854a', (R() - 0.5) * 0.2); c.beginPath(); c.ellipse(bx, g - 134, 17, 11, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(80,46,20,.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(bx - 8, g - 138); c.lineTo(bx + 4, g - 128); c.moveTo(bx - 2, g - 140); c.lineTo(bx + 9, g - 131); c.stroke(); } }
  // merchant behind counter (static)
  const Pm = o.merchant || mkPerson(hashI(x | 0, 17), pick(R, ['merchant', 'woman', 'villager']));
  person(c, -W * 0.14 + (R() - 0.5) * 40, g - 8, 112, 0, Pm, { front: true, pose: 'stand' });
  // counter
  const cy = g - 66;
  const skirt = o.cloth || pick(R, ['#d8cdb4', '#a8584a', '#5d6f86', '#d4c28a', '#6f8a7a']);
  c.fillStyle = tone(skirt, -0.05); c.beginPath(); c.moveTo(-W * 0.48, cy); c.lineTo(W * 0.48, cy); c.lineTo(W * 0.48, g - 12); for (let i = 0; i <= 10; i++) c.lineTo(W * 0.48 - i * W * 0.096, g - 12 + (i % 2) * 5); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,244,214,.14)'; c.fillRect(-W * 0.48, cy, W * 0.2, 52); c.fillStyle = 'rgba(20,18,30,.18)'; c.fillRect(W * 0.28, cy, W * 0.2, 52);
  c.strokeStyle = 'rgba(30,24,30,.22)'; c.lineWidth = 1; for (let i = 1; i < 9; i++) { c.beginPath(); c.moveTo(-W * 0.48 + i * W * 0.107, cy + 4); c.lineTo(-W * 0.48 + i * W * 0.107, g - 14); c.stroke(); }
  c.fillStyle = '#7b6046'; c.fillRect(-W * 0.52, cy - 8, W * 1.04, 9); c.fillStyle = 'rgba(255,240,210,.16)'; c.fillRect(-W * 0.52, cy - 8, W * 1.04, 2.5);
  const ty = cy - 8; // table top y
  // goods on counter
  if (kind === 'fruit') { [['#b5473b', 'apple', -0.3], ['#c58a3c', 'orange', 0.0], ['#b9b95a', 'pear', 0.3]].forEach((a, i) => { const bx = W * a[2] - 26; crate(c, bx, ty, 52, 20); fruitPile(c, R, bx + 2, ty - 18, 48, 2, a[1] === 'pear' ? 6.5 : 7.5, a[0], a[1]); }); basket(c, -W * 0.46, ty, 26, 18); fruitPile(c, R, -W * 0.46 - 11, ty - 16, 22, 1, 6, '#b5473b', 'apple'); c.strokeStyle = '#3a2f2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.43, ty - 52); c.lineTo(W * 0.43, ty); c.stroke(); c.beginPath(); c.moveTo(W * 0.43 - 18, ty - 44); c.lineTo(W * 0.43 + 18, ty - 44); c.stroke(); c.fillStyle = '#8a8a8a'; c.beginPath(); c.arc(W * 0.43 - 16, ty - 36, 7, 0, Math.PI); c.fill(); c.beginPath(); c.arc(W * 0.43 + 16, ty - 36, 7, 0, Math.PI); c.fill(); }
  if (kind === 'bread') { basket(c, -W * 0.3, ty, 54, 24); for (let i = 0; i < 5; i++) { c.save(); c.translate(-W * 0.3 - 20 + i * 10, ty - 22); c.rotate(-0.5 + i * 0.22); c.fillStyle = tone('#b98a4c', (R() - 0.5) * 0.2); c.beginPath(); c.ellipse(0, -13, 5.5, 22, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(86,48,20,.55)'; c.lineWidth = 1; for (let q = -3; q <= 3; q++) { c.beginPath(); c.moveTo(-4, q * 6 - 13); c.lineTo(4, q * 6 - 9); c.stroke(); } c.restore(); } for (let i = 0; i < 4; i++) { const bx = W * 0.02 + i * 30, by = ty - 11; c.fillStyle = tone('#b98a4c', (R() - 0.5) * 0.15 - 0.05); c.beginPath(); c.ellipse(bx, by, 15, 11, 0, Math.PI, 0); c.lineTo(bx + 15, by); c.lineTo(bx - 15, by); c.fill(); c.fillStyle = 'rgba(255,236,190,.35)'; c.beginPath(); c.ellipse(bx - 4, by - 6, 6, 3, -0.3, 0, TAU); c.fill(); c.strokeStyle = 'rgba(80,44,20,.55)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(bx - 8, by - 7); c.lineTo(bx + 7, by - 3); c.moveTo(bx - 3, by - 10); c.lineTo(bx + 9, by - 6); c.stroke(); } sack(c, R, W * 0.42, ty, 30, 38, '#cfc2a4'); }
  if (kind === 'cloth') { const cols = ['#5d6f86', '#a8584a', '#c7a55c', '#6f8a5f', '#d8cdb4']; for (let st = 0; st < 3; st++) { const bx = -W * 0.4 + st * 58; for (let q = 0; q < 4; q++) { const col = cols[(st + q) % 5]; c.fillStyle = tone(col, 0); c.fillRect(bx, ty - (q + 1) * 9, 46, 8.5); c.fillStyle = 'rgba(255,244,214,.2)'; c.fillRect(bx, ty - (q + 1) * 9, 46, 2); c.fillStyle = 'rgba(20,18,30,.2)'; c.fillRect(bx + 42, ty - (q + 1) * 9, 4, 8.5); c.strokeStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.moveTo(bx + 4, ty - (q + 1) * 9 + 3); c.lineTo(bx + 38, ty - (q + 1) * 9 + 3); c.stroke(); } } c.fillStyle = '#8a6a48'; c.fillRect(W * 0.34, ty - 6, 40, 4); c.fillStyle = '#d8cdb4'; c.beginPath(); c.ellipse(W * 0.42, ty - 10, 9, 5, 0, 0, TAU); c.fill(); }
  if (kind === 'fish') { c.fillStyle = '#8f98a0'; c.fillRect(-W * 0.48, ty - 6, W * 0.96, 6); c.fillStyle = 'rgba(200,225,240,.3)'; c.fillRect(-W * 0.48, ty - 6, W * 0.96, 2); for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) fishShape(c, -W * 0.38 + i * 33 + row * 12, ty - 14 - row * 8, 36, pick(R, ['#7f98a8', '#8aa098', '#6f7f98', '#a0a8a8']), (R() - 0.5) * 0.2); c.fillStyle = '#6a5240'; c.beginPath(); c.moveTo(W * 0.34, ty); c.lineTo(W * 0.52, ty); c.lineTo(W * 0.5, ty - 28); c.lineTo(W * 0.36, ty - 28); c.fill(); c.fillStyle = '#9ab8c4'; c.fillRect(W * 0.37, ty - 28, W * 0.12, 4); c.strokeStyle = '#4a3a2c'; c.lineWidth = 1; c.beginPath(); c.moveTo(-W * 0.45, g - 156); c.lineTo(W * 0.45, g - 150); c.stroke(); for (let i = 0; i < 6; i++) fishShape(c, -W * 0.38 + i * 30, g - 150 + 12, 20, '#a89a80', Math.PI / 2); }
  if (kind === 'pottery') { for (let i = 0; i < 5; i++) jar(c, -W * 0.4 + i * 36, ty, 28 + R() * 10, 30 + R() * 14, pick(R, ['#b9714c', '#a8584a', '#7a9a98', '#c9a55c', '#8a6a5a']), { handles: R() < 0.3 }); for (let i = 0; i < 4; i++) { c.fillStyle = tone('#c9a55c', -i * 0.05); c.beginPath(); c.ellipse(W * 0.34, ty - i * 5 - 2, 17 - i, 5, 0, 0, TAU); c.fill(); } jar(c, W * 0.46, ty, 22, 52, '#a8584a', { handles: true }); }
  if (kind === 'herbs') { for (let i = 0; i < 7; i++) bottle(c, -W * 0.44 + i * 18, ty, 11, 22, pick(R, ['#6f9a80', '#a87a9a', '#c9a55c', '#7a8aa8', '#a8584a'])); c.fillStyle = '#6a5a4a'; c.beginPath(); c.moveTo(W * 0.08, ty); c.lineTo(W * 0.3, ty); c.lineTo(W * 0.27, ty - 14); c.lineTo(W * 0.11, ty - 14); c.fill(); c.strokeStyle = '#7b6046'; c.lineWidth = 4; c.beginPath(); c.moveTo(W * 0.22, ty - 12); c.lineTo(W * 0.3, ty - 28); c.stroke(); basket(c, W * 0.4, ty, 34, 18, '#8a7048'); for (let i = 0; i < 6; i++) { c.fillStyle = tone(pick(R, ['#c9b48a', '#8a6a50', '#d8d2c0']), 0); c.beginPath(); c.ellipse(W * 0.4 - 10 + i * 4, ty - 18, 4.5, 3.4, 0, Math.PI, 0); c.fill(); } }
  if (kind === 'smith') { c.fillStyle = '#4a3a2c'; c.fillRect(-W * 0.44, ty - 18, 26, 18); c.fillStyle = '#3a3f48'; c.beginPath(); c.moveTo(-W * 0.48, ty - 18); c.lineTo(-W * 0.24, ty - 18); c.lineTo(-W * 0.28, ty - 30); c.lineTo(-W * 0.4, ty - 30); c.lineTo(-W * 0.52, ty - 28); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(-W * 0.4, ty - 30, 10, 3); for (let i = 0; i < 3; i++) { c.fillStyle = '#9aa0a8'; c.beginPath(); c.arc(-W * 0.04 + i * 22, ty - 10, 10, Math.PI, 0); c.fill(); c.fillRect(-W * 0.04 + i * 22 - 10, ty - 10, 20, 4); } c.strokeStyle = '#8a8f98'; c.lineWidth = 2.4; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(W * 0.28 + i * 14, ty - 6, 6, 0.4, TAU - 0.4); c.stroke(); } c.fillStyle = '#7a6a56'; c.beginPath(); c.arc(W * 0.46, ty - 14, 14, 0, TAU); c.fill(); c.fillStyle = '#b8bdc2'; c.beginPath(); c.arc(W * 0.46, ty - 14, 3.5, 0, TAU); c.fill(); }
  if (kind === 'flowers') { [['#d9769a', '#e8a8bd'], ['#e0c04e', '#f0dc8a'], ['#9a86c8', '#c4b4e4'], ['#eee6d6', '#fffaf0']].forEach((a, i) => { const bx = -W * 0.36 + i * 46; c.fillStyle = tone('#7a5a40', 0); c.beginPath(); c.moveTo(bx - 15, ty - 30); c.lineTo(bx + 15, ty - 30); c.lineTo(bx + 12, ty); c.lineTo(bx - 12, ty); c.fill(); c.strokeStyle = '#3a2f2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx - 14, ty - 24); c.lineTo(bx + 14, ty - 24); c.moveTo(bx - 12.5, ty - 8); c.lineTo(bx + 12.5, ty - 8); c.stroke(); for (let q = 0; q < 9; q++) { const fx = bx + (q - 4) * 3.4 + (R() - 0.5) * 3, fy = ty - 46 - R() * 18; c.strokeStyle = '#5a8a48'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(bx + (q - 4) * 1.2, ty - 28); c.lineTo(fx, fy); c.stroke(); c.fillStyle = a[0]; c.beginPath(); c.arc(fx, fy, 5.2, 0, TAU); c.fill(); c.fillStyle = a[1]; c.beginPath(); c.arc(fx - 1, fy - 1, 3, 0, TAU); c.fill(); if (i === 1 || i === 3) { c.fillStyle = i === 1 ? '#6a4a2a' : '#e0c04e'; c.beginPath(); c.arc(fx, fy, 1.8, 0, TAU); c.fill(); } } }); }
  if (kind === 'veg') { [['#6f9a52', 'cab'], ['#c9743a', 'car'], ['#c98a3a', 'pum'], ['#b9a05a', 'oni']].forEach((a, i) => { const bx = -W * 0.38 + i * 50; crate(c, bx, ty, 44, 18, '#8a6a48'); if (a[1] === 'cab') for (let q = 0; q < 3; q++) { const px = bx + 9 + q * 13; c.fillStyle = tone(a[0], -0.1); c.beginPath(); c.arc(px, ty - 24, 9.5, 0, TAU); c.fill(); c.fillStyle = tone(a[0], 0.14); c.beginPath(); c.arc(px - 1.5, ty - 25, 7, 0, TAU); c.fill(); c.strokeStyle = 'rgba(30,60,30,.5)'; c.lineWidth = 1; c.beginPath(); c.arc(px, ty - 24, 5, 0.3, 2.6); c.stroke(); } if (a[1] === 'car') for (let q = 0; q < 9; q++) { const px = bx + 6 + q * 4.2; c.fillStyle = a[0]; c.beginPath(); c.moveTo(px - 2.4, ty - 18); c.lineTo(px + 2.4, ty - 18); c.lineTo(px + (q - 4) * 0.4, ty - 36 + (q % 3) * 3); c.fill(); c.strokeStyle = '#5a8a3a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px, ty - 33 + (q % 3) * 3); c.lineTo(px + (q - 4) * 1.2, ty - 44 - (q % 2) * 4); c.stroke(); } if (a[1] === 'pum') for (let q = 0; q < 2; q++) { const px = bx + 12 + q * 20; c.fillStyle = tone(a[0], -0.1); c.beginPath(); c.ellipse(px, ty - 25, 11, 9, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(120,60,10,.5)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(px, ty - 25, 5, 9, 0, 0, TAU); c.stroke(); c.fillStyle = '#5a6a30'; c.fillRect(px - 1.5, ty - 36, 3, 4); } if (a[1] === 'oni') fruitPile(c, R, bx + 2, ty - 17, 40, 2, 6, a[0], 'oni'); }); sack(c, R, W * 0.46, ty, 28, 34, '#b6a27a'); }
  // awning: slanted striped canopy with scalloped valance
  const ay0 = g - 192, ay1 = g - 158, nA = 9, aw = W * 1.16;
  for (let i = 0; i < nA; i++) {
    const xa = -aw / 2 + i * aw / nA, xb = xa + aw / nA, col = i % 2 ? '#e7dcc3' : css(awnCol);
    c.fillStyle = col; c.beginPath(); c.moveTo(xa * 0.9, ay0); c.lineTo(xb * 0.9, ay0); c.lineTo(xb, ay1); c.quadraticCurveTo((xa + xb) / 2, ay1 + 16, xa, ay1); c.closePath(); c.fill();
  }
  c.fillStyle = vgrad(c, ay0, ay1 + 14, 'rgba(255,244,214,.16)', 'rgba(30,24,40,.22)'); c.fillRect(-aw / 2, ay0, aw, ay1 - ay0 + 14);
  c.fillStyle = 'rgba(20,18,30,.2)'; c.beginPath(); c.moveTo(aw * 0.1, ay0); c.lineTo(aw * 0.45, ay0); c.lineTo(aw * 0.5, ay1 + 12); c.lineTo(aw * 0.12, ay1 + 8); c.fill();
  c.strokeStyle = '#4a3a2c'; c.lineWidth = 3; c.beginPath(); c.moveTo(-aw * 0.45, ay0); c.lineTo(aw * 0.45, ay0); c.stroke();
  // hanging goods under awning
  if (kind === 'herbs') for (let i = 0; i < 8; i++) { const hx = -W * 0.45 + i * 26, hl = 22 + R() * 20, col = pick(R, ['#6f9a52', '#9a86c8', '#c9b46a', '#7a9a62']); c.strokeStyle = '#6a553a'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx, ay1 + 6); c.lineTo(hx, ay1 + 14); c.stroke(); c.fillStyle = tone(col, -0.05); c.beginPath(); c.moveTo(hx - 2, ay1 + 14); c.lineTo(hx + 2, ay1 + 14); c.lineTo(hx + 7, ay1 + 14 + hl); c.lineTo(hx - 7, ay1 + 14 + hl); c.fill(); c.strokeStyle = tone(col, 0.2, 0.5); c.beginPath(); c.moveTo(hx, ay1 + 14); c.lineTo(hx, ay1 + 14 + hl); c.stroke(); }
  if (kind === 'fish') for (let i = 0; i < 5; i++) { c.strokeStyle = '#5a4a3a'; c.beginPath(); c.moveTo(-W * 0.4 + i * 36, ay1 + 8); c.lineTo(-W * 0.4 + i * 36, ay1 + 22); c.stroke(); }
  if (kind === 'bread' || kind === 'veg' || kind === 'fruit') for (let i = 0; i < 4; i++) { const hx = -W * 0.36 + i * 48; c.strokeStyle = '#5a4a3a'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx, ay1 + 8); c.lineTo(hx, ay1 + 24); c.stroke(); if (kind === 'bread') { c.fillStyle = '#c29a58'; c.beginPath(); c.arc(hx, ay1 + 30, 7, 0, TAU); c.fill(); c.fillStyle = '#6a4a2a'; c.beginPath(); c.arc(hx, ay1 + 30, 3, 0, TAU); c.fill(); } else if (kind === 'veg') { c.fillStyle = '#c9743a'; c.beginPath(); c.ellipse(hx, ay1 + 30, 4, 9, 0, 0, TAU); c.fill(); } else { c.fillStyle = '#7a5a40'; c.beginPath(); c.ellipse(hx, ay1 + 32, 8, 10, 0, 0, TAU); c.fill(); c.strokeStyle = '#4a3a2c'; c.stroke(); } }
  if (kind === 'pottery') for (let i = 0; i < 3; i++) { c.strokeStyle = '#5a4a3a'; c.beginPath(); c.moveTo(-W * 0.3 + i * 60, ay1 + 8); c.lineTo(-W * 0.3 + i * 60, ay1 + 20); c.stroke(); jar(c, -W * 0.3 + i * 60, ay1 + 50, 22, 28, pick(R, ['#7a9a98', '#b9714c', '#c9a55c'])); }
  if (kind === 'cloth') iconSign(c, 'cloth', -W * 0.36, ay1 + 8, 26);
  // sign board
  const sk = kind; c.strokeStyle = '#2f2b2e'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W * 0.46, ay1 + 6); c.lineTo(W * 0.46, ay1 + 14); c.stroke(); iconSign(c, sk, W * 0.46, ay1 + 14, 24);
  // small lantern for evenings
  c.strokeStyle = '#2f2b2e'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-W * 0.52, ay1 + 2); c.lineTo(-W * 0.52, ay1 + 14); c.stroke(); c.fillStyle = '#6e5a3c'; c.fillRect(-W * 0.52 - 4, ay1 + 14, 8, 11);
  c.restore();
  X.light({ kind: 'lamp', x: x - (W * 0.52 + 4) * s, y: gy - 158 * s + 15 * s, w: 8 * s, h: 9 * s, r: 4 * s, k: 1 });
}

function barrel(c, x, y, s) {
  c.fillStyle = 'rgba(20,25,40,.18)'; c.beginPath(); c.ellipse(x, y, s * 0.6, s * 0.1, 0, 0, TAU); c.fill();
  c.fillStyle = vgrad(c, y - s * 1.2, y, '#8a6a4a', '#664b36'); c.beginPath(); c.moveTo(x - s * 0.5, y); c.quadraticCurveTo(x - s * 0.68, y - s * 0.6, x - s * 0.5, y - s * 1.2); c.lineTo(x + s * 0.5, y - s * 1.2); c.quadraticCurveTo(x + s * 0.68, y - s * 0.6, x + s * 0.5, y); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,240,210,.14)'; c.fillRect(x - s * 0.55, y - s * 1.2, s * 0.2, s * 1.2);
  c.strokeStyle = '#3a2f2a'; c.lineWidth = Math.max(2, s * 0.07); [0.25, 0.9].forEach(f => { c.beginPath(); c.moveTo(x - s * 0.62, y - s * f); c.lineTo(x + s * 0.62, y - s * f); c.stroke(); });
  c.fillStyle = '#58412f'; c.beginPath(); c.ellipse(x, y - s * 1.2, s * 0.5, s * 0.1, 0, 0, TAU); c.fill();
}
function crateStack(c, r, x, y, n = 2, s = 34) { for (let i = 0; i < n; i++) crate(c, x + (i === 1 ? 6 : 0) * (r() - 0.3), y - i * s * 0.8, s * (1.2 - i * 0.1), s * 0.8, pick(r, ['#8a6a48', '#7a5a3e', '#98774e'])); }
function lampPost(c, X, x, gy, h, k = 1) {
  c.fillStyle = 'rgba(20,24,40,.2)'; c.beginPath(); c.ellipse(x, gy, 14, 4, 0, 0, TAU); c.fill();
  c.fillStyle = '#2f2b2e'; c.fillRect(x - 3.5, gy - h, 7, h); c.fillRect(x - 9, gy - 9, 18, 9); c.fillRect(x - 6, gy - 24, 12, 4);
  c.beginPath(); c.moveTo(x - 13, gy - h); c.lineTo(x + 13, gy - h); c.lineTo(x + 9, gy - h - 24); c.lineTo(x - 9, gy - h - 24); c.closePath(); c.fill();
  c.fillStyle = '#6e5a3c'; c.fillRect(x - 8, gy - h - 20, 16, 19);
  X.light({ kind: 'lamp', x: x - 7, y: gy - h - 19, w: 14, h: 15, r: 6.5, k: 1.1 });
}
function bunting(c, r, x0, y0, x1, y1, sag, cols) {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag * 2;
  c.strokeStyle = 'rgba(60,50,44,.75)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, x1, y1); c.stroke();
  const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 24));
  for (let i = 1; i < n; i++) { const t = i / n, x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1; c.fillStyle = css(cols[i % cols.length], 0.95); c.beginPath(); c.moveTo(x - 7, y); c.lineTo(x + 7, y); c.lineTo(x, y + 17); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,244,214,.18)'; c.beginPath(); c.moveTo(x - 7, y); c.lineTo(x, y); c.lineTo(x, y + 17); c.closePath(); c.fill(); }
}
function laundry(c, r, x0, y0, x1, y1) {
  const my = (y0 + y1) / 2 + 14; c.strokeStyle = 'rgba(70,56,48,.8)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, my + 8, x1, y1); c.stroke();
  const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 30);
  for (let i = 1; i < n; i++) { if (r() < 0.2) continue; const t = i / n, x = lerp(x0, x1, t), y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (my + 8) + t * t * y1, col = pick(r, ['#e6dfcc', '#a8584a', '#6f8aa0', '#c9b47a', '#d8d2c0']), h = 22 + r() * 22, w = 12 + r() * 9; c.fillStyle = css(col); c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x + w / 2 + (r() - 0.5) * 3, y + h); c.quadraticCurveTo(x, y + h + 3, x - w / 2, y + h); c.closePath(); c.fill(); c.fillStyle = 'rgba(30,28,40,.15)'; c.fillRect(x, y, w / 2, h); }
}

/* ═════════════════ people ═════════════════ */
function mkPerson(seed, kind) {
  const r = mulberry(seed), P = {
    kind: kind || 'villager', skin: pick(r, PAL.skin), hair: pick(r, PAL.hair), top: pick(r, PAL.cloaks),
    bot: pick(r, ['#4a4038', '#5a4a3a', '#3f4a56', '#6a5a46', '#554a58']), ph: r() * 6, hs: 0.94 + r() * 0.12,
    cloak: null, hat: null, item: null, dress: false, apron: false, trim: null
  };
  switch (P.kind) {
    case 'woman': P.dress = true; P.apron = r() < 0.6; P.hat = r() < 0.5 ? 'scarf' : null; P.item = pick(r, [null, 'basket', 'jug', 'basket']); P.top = pick(r, ['#8a5a4e', '#5f7a6e', '#6a5a8a', '#a8826a', '#7a8a6a', '#8a6a3e']); break;
    case 'merchant': P.hat = 'merchant'; P.trim = pick(r, ['#8a3a3a', '#3a5a7a', '#6a4a8a']); P.item = r() < 0.4 ? 'pouch' : null; break;
    case 'farmer': P.hat = 'straw'; P.item = pick(r, ['fork', 'sack', 'bucket', null]); P.top = pick(r, ['#8a7a5a', '#6a7a5a', '#7a6a50']); break;
    case 'guard': P.hat = 'helmet'; P.item = 'spear'; P.trim = pick(r, ['#7a3a3a', '#3a4a7a']); P.top = '#707880'; break;
    case 'mage': P.hat = 'point'; P.item = 'staff'; P.dress = true; P.top = pick(r, ['#4a5a8a', '#6a4a7a', '#3a6a6a', '#7a4a4a']); P.cloak = null; break;
    case 'adventurer': P.hat = r() < 0.5 ? 'hood' : null; P.cloak = pick(r, PAL.cloaks); P.item = pick(r, ['sword', 'pack', 'bow', 'sword']); P.top = pick(r, ['#6a5a46', '#5a5448', '#4f5a52']); break;
    case 'child': P.hs = 0.62 + r() * 0.08; P.hat = r() < 0.3 ? 'cap' : null; break;
    case 'monk': P.hat = 'hood'; P.dress = true; P.top = '#7a6a56'; P.item = 'staff'; break;
    case 'bard': P.hat = 'feather'; P.item = 'lute'; P.top = pick(r, ['#6a4a7a', '#7a5a3a', '#3a6a5a']); P.trim = '#c9a548'; break;
    case 'traveler': P.hat = 'hood'; P.cloak = pick(r, PAL.cloaks); P.item = pick(r, ['staff', 'pack', 'lantern']); break;
    default: P.hat = pick(r, [null, 'cap', 'cap', 'hood']); P.item = pick(r, [null, null, 'bundle', 'basket']); if (r() < 0.3) P.cloak = pick(r, PAL.cloaks);
  }
  return P;
}
function person(c, x, y, s, t, P, o = {}) {
  s *= P.hs; const dir = o.dir || 1, front = !!o.front, pace = o.pace === undefined ? 5 : o.pace, moving = pace > 0 && o.pose !== 'stand';
  const sw = moving ? Math.sin(t * pace + P.ph) : Math.sin(t * 0.8 + P.ph) * 0.1, bob = moving ? Math.abs(Math.cos(t * pace + P.ph)) * s * 0.022 : 0;
  const top = P.top, dk = tone(top, -0.3), lt = tone(top, 0.16), skin = P.skin, wind = (o.wind || 0.5);
  c.save(); c.translate(x, y - bob); if (!front) c.scale(dir, 1);
  c.fillStyle = 'rgba(20,25,40,.2)'; c.beginPath(); c.ellipse(0, bob, s * 0.26, s * 0.05, 0, 0, TAU); c.fill();
  c.lineCap = 'round'; c.lineJoin = 'round';
  const lw = s * 0.085, hipY = -s * 0.46, shY = -s * 0.77, hdY = -s * 0.885;
  const limb = (x0, y0, x1, y1, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  const boot = P.kind === 'child' ? '#4a3a30' : tone(P.bot, -0.35);
  // back arm & item behind
  if (!front) limb(0, shY, -sw * s * 0.14, -s * 0.5, lw * 0.8, dk);
  if (P.item === 'pack' && !front) { c.fillStyle = '#6a5640'; c.beginPath(); c.roundRect ? c.roundRect(-s * 0.3, -s * 0.8, s * 0.2, s * 0.3, 3) : c.rect(-s * 0.3, -s * 0.8, s * 0.2, s * 0.3); c.fill(); c.fillStyle = '#8a7658'; c.fillRect(-s * 0.3, -s * 0.8, s * 0.2, s * 0.06); }
  if (P.item === 'bundle' && !front) { c.fillStyle = '#b6a27a'; c.beginPath(); c.ellipse(-s * 0.22, -s * 0.78, s * 0.14, s * 0.12, 0, 0, TAU); c.fill(); }
  // cloak behind
  if (P.cloak && !front) { const fl = Math.sin(t * 2 + P.ph) * s * 0.03 + wind * s * 0.05; c.fillStyle = tone(P.cloak, -0.18); c.beginPath(); c.moveTo(-s * 0.06, shY - s * 0.02); c.lineTo(-s * 0.2 - fl, -s * 0.2); c.lineTo(-s * 0.3 - fl * 1.5, -s * 0.16 + sw * 2); c.lineTo(s * 0.04, -s * 0.2); c.closePath(); c.fill(); }
  // legs
  if (P.dress) { c.fillStyle = boot; if (!front) { c.fillRect(sw * s * 0.07 - s * 0.03, -s * 0.06, s * 0.06, s * 0.06); c.fillRect(-sw * s * 0.07 - s * 0.03, -s * 0.06, s * 0.06, s * 0.06); } }
  else if (front) { limb(-s * 0.06, hipY, -s * 0.07, -Math.max(0, sw) * s * 0.05, lw, P.bot); limb(s * 0.06, hipY, s * 0.07, -Math.max(0, -sw) * s * 0.05, lw, P.bot); c.fillStyle = boot; c.fillRect(-s * 0.1, -s * 0.045 - Math.max(0, sw) * s * 0.05, s * 0.07, s * 0.045); c.fillRect(s * 0.03, -s * 0.045 - Math.max(0, -sw) * s * 0.05, s * 0.07, s * 0.045); }
  else { const f1 = sw * s * 0.15, l1 = Math.max(0, Math.cos(t * pace + P.ph)) * s * 0.035; limb(0, hipY, -f1, -l1, lw, tone(P.bot, -0.15)); limb(0, hipY, f1, -(moving ? Math.max(0, -Math.cos(t * pace + P.ph)) * s * 0.035 : 0), lw, P.bot); c.fillStyle = boot; c.fillRect(f1 - s * 0.02, -s * 0.05 - (moving ? Math.max(0, -Math.cos(t * pace + P.ph)) * s * 0.035 : 0), s * 0.1, s * 0.05); c.fillRect(-f1 - s * 0.03, -s * 0.05 - l1, s * 0.1, s * 0.05); }
  // torso / dress
  const tw = front ? s * 0.14 : s * 0.11;
  if (P.dress) {
    const sk = s * 0.2 + Math.abs(sw) * s * 0.02; c.fillStyle = top; c.beginPath(); c.moveTo(-tw, shY); c.lineTo(tw, shY); c.lineTo(sk, -s * 0.07); c.lineTo(-sk, -s * 0.07); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,244,214,.14)'; c.beginPath(); c.moveTo(-tw, shY); c.lineTo(-tw * 0.1, shY); c.lineTo(-sk * 0.2, -s * 0.07); c.lineTo(-sk, -s * 0.07); c.closePath(); c.fill();
    c.fillStyle = 'rgba(20,18,36,.2)'; c.beginPath(); c.moveTo(tw * 0.2, shY); c.lineTo(tw, shY); c.lineTo(sk, -s * 0.07); c.lineTo(sk * 0.3, -s * 0.07); c.closePath(); c.fill();
    c.strokeStyle = tone(top, -0.3, 0.5); c.lineWidth = 1; c.beginPath(); c.moveTo(-sk * 0.5, -s * 0.07); c.lineTo(-tw * 0.4, -s * 0.4); c.moveTo(sk * 0.5, -s * 0.07); c.lineTo(tw * 0.4, -s * 0.4); c.stroke();
    if (P.apron) { c.fillStyle = '#e4dcc6'; c.beginPath(); c.moveTo(-tw * 0.8, -s * 0.6); c.lineTo(tw * 0.8, -s * 0.6); c.lineTo(sk * 0.8, -s * 0.12); c.lineTo(-sk * 0.8, -s * 0.12); c.fill(); }
    c.fillStyle = tone(top, -0.2); c.fillRect(-tw, -s * 0.5, tw * 2, s * 0.04);
  } else {
    c.fillStyle = top; c.beginPath(); c.moveTo(-tw, shY); c.lineTo(tw, shY); c.lineTo(tw * 1.25, hipY + s * 0.08); c.lineTo(-tw * 1.25, hipY + s * 0.08); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,244,214,.14)'; c.fillRect(-tw, shY, tw * 0.7, hipY - shY);
    c.fillStyle = 'rgba(20,18,36,.2)'; c.fillRect(tw * 0.4, shY, tw * 0.6, hipY - shY + s * 0.06);
    c.fillStyle = tone(P.bot, -0.2); c.fillRect(-tw * 1.25, hipY - s * 0.02, tw * 2.5, s * 0.035);
    if (P.kind === 'guard') { c.fillStyle = P.trim; c.fillRect(-tw * 0.6, shY + s * 0.02, tw * 1.2, s * 0.27); c.fillStyle = '#d9c98a'; c.fillRect(-s * 0.012, shY + s * 0.1, s * 0.024, s * 0.1); }
    if (P.kind === 'merchant') { c.fillStyle = P.trim; c.fillRect(-tw * 0.5, shY, tw, hipY - shY); }
  }
  // arm (front)
  const handX = front ? s * 0.17 : sw * s * 0.14, handY = -s * 0.5 + (front ? s * 0.02 : 0);
  if (front) { limb(-tw, shY + s * 0.02, -s * 0.17, handY, lw * 0.8, dk); limb(tw, shY + s * 0.02, handX, handY, lw * 0.8, top); c.fillStyle = skin; c.beginPath(); c.arc(-s * 0.17, handY + 2, s * 0.03, 0, TAU); c.arc(handX, handY + 2, s * 0.03, 0, TAU); c.fill(); }
  else { const carry = P.item === 'basket' || P.item === 'jug' || P.item === 'bucket' || P.item === 'lantern'; const hx = carry ? s * 0.16 : handX, hy = carry ? -s * 0.52 : handY; limb(0, shY + s * 0.02, hx, hy, lw * 0.85, top); c.fillStyle = skin; c.beginPath(); c.arc(hx, hy + 2, s * 0.032, 0, TAU); c.fill();
    if (P.item === 'basket') { c.fillStyle = '#a98a58'; c.beginPath(); c.moveTo(hx - s * 0.08, hy + 2); c.lineTo(hx + s * 0.08, hy + 2); c.lineTo(hx + s * 0.06, hy + s * 0.11); c.lineTo(hx - s * 0.06, hy + s * 0.11); c.fill(); c.fillStyle = '#d8cdb4'; c.beginPath(); c.ellipse(hx, hy, s * 0.07, s * 0.03, 0, Math.PI, 0); c.fill(); }
    if (P.item === 'jug') { jar(c, hx, hy + s * 0.14, s * 0.1, s * 0.15, '#b9714c'); }
    if (P.item === 'bucket') { c.fillStyle = '#7a5a40'; c.fillRect(hx - s * 0.06, hy + 2, s * 0.12, s * 0.1); }
    if (P.item === 'lantern') { c.fillStyle = '#3a2f2a'; c.fillRect(hx - s * 0.03, hy + 2, s * 0.06, s * 0.08); c.fillStyle = 'rgba(255,214,140,.95)'; c.fillRect(hx - s * 0.02, hy + s * 0.025, s * 0.04, s * 0.05); }
  }
  // head, hair, hats
  c.fillStyle = skin; c.beginPath(); c.arc(0, hdY, s * 0.1, 0, TAU); c.fill();
  c.fillStyle = 'rgba(40,24,20,.12)'; c.beginPath(); c.arc(s * 0.02, hdY + s * 0.03, s * 0.085, 0, Math.PI); c.fill();
  if (front) { c.fillStyle = 'rgba(30,24,28,.7)'; c.fillRect(-s * 0.04, hdY - s * 0.005, s * 0.02, s * 0.015); c.fillRect(s * 0.02, hdY - s * 0.005, s * 0.02, s * 0.015); }
  else { c.fillStyle = 'rgba(30,24,28,.7)'; c.fillRect(s * 0.05, hdY - s * 0.01, s * 0.018, s * 0.016); c.fillStyle = tone(skin, -0.15); c.beginPath(); c.moveTo(s * 0.09, hdY); c.lineTo(s * 0.12, hdY + s * 0.02); c.lineTo(s * 0.09, hdY + s * 0.03); c.fill(); }
  c.fillStyle = P.hair; c.beginPath(); c.arc(0, hdY - s * 0.01, s * 0.108, Math.PI * 1.02, Math.PI * 1.98); c.fill(); if (!front) { c.beginPath(); c.arc(-s * 0.05, hdY + s * 0.02, s * 0.065, 0, TAU); c.fill(); }
  if (P.kind === 'woman' && !P.hat) { c.beginPath(); c.moveTo(-s * 0.08, hdY); c.quadraticCurveTo(-s * 0.16, hdY + s * 0.12, -s * 0.07, hdY + s * 0.2); c.lineTo(-s * 0.02, hdY + s * 0.05); c.fill(); }
  const hat = P.hat, hc = tone(top, -0.2);
  if (hat === 'cap') { c.fillStyle = hc; c.beginPath(); c.arc(0, hdY - s * 0.02, s * 0.108, Math.PI, 0); c.fill(); c.fillRect(front ? -s * 0.1 : -s * 0.1, hdY - s * 0.025, s * 0.2 + (front ? 0 : s * 0.04), s * 0.025); }
  if (hat === 'hood') { c.fillStyle = P.cloak ? tone(P.cloak, -0.1) : hc; c.beginPath(); c.arc(0, hdY - s * 0.005, s * 0.125, Math.PI * 0.85, Math.PI * 2.15); c.lineTo(s * 0.05, hdY + s * 0.1); c.lineTo(-s * 0.12, hdY + s * 0.1); c.closePath(); c.fill(); if (!front) { c.fillStyle = skin; c.beginPath(); c.arc(s * 0.035, hdY + s * 0.005, s * 0.07, -1.3, 1.3); c.fill(); } }
  if (hat === 'straw') { c.fillStyle = '#c9aa66'; c.beginPath(); c.ellipse(0, hdY - s * 0.05, s * 0.2, s * 0.045, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(0, hdY - s * 0.06, s * 0.09, Math.PI, 0); c.fill(); c.strokeStyle = '#7a4a3a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-s * 0.09, hdY - s * 0.07); c.lineTo(s * 0.09, hdY - s * 0.07); c.stroke(); }
  if (hat === 'merchant') { c.fillStyle = P.trim || '#5a3a3a'; c.beginPath(); c.ellipse(0, hdY - s * 0.06, s * 0.15, s * 0.03, 0, 0, TAU); c.fill(); c.fillRect(-s * 0.09, hdY - s * 0.15, s * 0.18, s * 0.1); c.fillStyle = '#d9c98a'; c.fillRect(-s * 0.09, hdY - s * 0.08, s * 0.18, s * 0.015); }
  if (hat === 'helmet') { c.fillStyle = '#8f949b'; c.beginPath(); c.arc(0, hdY - s * 0.01, s * 0.115, Math.PI, 0); c.fill(); c.fillRect(-s * 0.115, hdY - s * 0.01, s * 0.23, s * 0.03); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-s * 0.09, hdY - s * 0.1, s * 0.03, s * 0.08); c.fillStyle = '#9a3a3a'; c.fillRect(-s * 0.01, hdY - s * 0.15, s * 0.02, s * 0.05); }
  if (hat === 'point') { c.fillStyle = hc; c.beginPath(); c.ellipse(0, hdY - s * 0.055, s * 0.16, s * 0.032, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-s * 0.09, hdY - s * 0.06); c.quadraticCurveTo(-s * 0.03, hdY - s * 0.2, s * 0.08, hdY - s * 0.3 + sw * s * 0.01); c.quadraticCurveTo(s * 0.04, hdY - s * 0.15, s * 0.09, hdY - s * 0.06); c.fill(); c.fillStyle = '#d9c98a'; c.fillRect(-s * 0.09, hdY - s * 0.075, s * 0.18, s * 0.016); }
  if (hat === 'scarf') { c.fillStyle = tone(top, 0.2); c.beginPath(); c.arc(0, hdY - s * 0.005, s * 0.115, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(-s * 0.08, hdY + s * 0.07); c.closePath(); c.fill(); }
  if (hat === 'feather') { c.fillStyle = hc; c.beginPath(); c.arc(0, hdY - s * 0.03, s * 0.11, Math.PI, 0); c.fill(); c.fillRect(-s * 0.12, hdY - s * 0.035, s * 0.26, s * 0.02); c.strokeStyle = '#c9a548'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-s * 0.02, hdY - s * 0.1); c.quadraticCurveTo(-s * 0.12, hdY - s * 0.22, -s * 0.2, hdY - s * 0.16); c.stroke(); }
  // tools held upright / at side
  if (P.item === 'spear') { c.strokeStyle = '#5a4636'; c.lineWidth = Math.max(1.5, s * 0.025); c.beginPath(); c.moveTo(s * 0.17, 0); c.lineTo(s * 0.17, -s * 1.5); c.stroke(); c.fillStyle = '#b8bdc2'; c.beginPath(); c.moveTo(s * 0.17 - 3, -s * 1.5); c.lineTo(s * 0.17, -s * 1.62); c.lineTo(s * 0.17 + 3, -s * 1.5); c.fill(); }
  if (P.item === 'staff') { c.strokeStyle = '#5a4636'; c.lineWidth = Math.max(1.5, s * 0.026); c.beginPath(); c.moveTo(s * 0.2, 0); c.lineTo(s * 0.2, -s * 1.12); c.stroke(); if (P.kind === 'mage') { c.fillStyle = 'rgba(150,220,255,.9)'; c.beginPath(); c.arc(s * 0.2, -s * 1.17, s * 0.045, 0, TAU); c.fill(); o.glow = { x: s * 0.2, y: -s * 1.17 }; } }
  if (P.item === 'fork') { c.strokeStyle = '#5a4636'; c.lineWidth = Math.max(1.5, s * 0.025); c.beginPath(); c.moveTo(s * 0.18, 0); c.lineTo(s * 0.18, -s * 1.1); c.stroke(); c.strokeStyle = '#8f949b'; c.beginPath(); c.moveTo(s * 0.14, -s * 1.18); c.lineTo(s * 0.14, -s * 1.08); c.moveTo(s * 0.18, -s * 1.2); c.lineTo(s * 0.18, -s * 1.08); c.moveTo(s * 0.22, -s * 1.18); c.lineTo(s * 0.22, -s * 1.08); c.stroke(); }
  if (P.item === 'sword') { c.strokeStyle = '#aab0b8'; c.lineWidth = Math.max(1.5, s * 0.03); c.beginPath(); c.moveTo(-s * 0.1, -s * 0.5); c.lineTo(-s * 0.3, -s * 0.18); c.stroke(); c.strokeStyle = '#4a3a2c'; c.beginPath(); c.moveTo(-s * 0.08, -s * 0.52); c.lineTo(-s * 0.13, -s * 0.46); c.stroke(); }
  if (P.item === 'bow') { c.strokeStyle = '#6a4a30'; c.lineWidth = Math.max(1.4, s * 0.02); c.beginPath(); c.arc(-s * 0.12, -s * 0.7, s * 0.3, 1.9, 4.4); c.stroke(); }
  if (P.item === 'lute') { c.fillStyle = '#9a6a3a'; c.beginPath(); c.ellipse(s * 0.1, -s * 0.5, s * 0.1, s * 0.075, -0.5, 0, TAU); c.fill(); c.strokeStyle = '#5a3a20'; c.lineWidth = 2; c.beginPath(); c.moveTo(s * 0.15, -s * 0.54); c.lineTo(s * 0.34, -s * 0.72); c.stroke(); }
  if (P.item === 'pouch') { c.fillStyle = '#7a5a3a'; c.beginPath(); c.arc(s * 0.1, -s * 0.44, s * 0.04, 0, TAU); c.fill(); }
  c.restore();
}

/* ═════════════════ animals ═════════════════ */
function horse(c, x, y, s, dir, t, col, o = {}) {
  const g = o.gait !== undefined ? o.gait : 5, ph = o.ph || 0;
  c.save(); c.translate(x, y); c.scale(dir, 1);
  c.fillStyle = 'rgba(20,25,40,.18)'; c.beginPath(); c.ellipse(0, 0, s * 0.5, s * 0.06, 0, 0, TAU); c.fill();
  const leg = (hx0, phase, hind, shade) => {
    const a = g ? Math.sin(t * g + phase + ph) : 0, lift = g ? Math.max(0, Math.cos(t * g + phase + ph)) * s * 0.06 : 0;
    const hip = [hx0, -s * 0.44], knee = [hx0 + a * s * 0.07 + (hind ? -s * 0.03 : s * 0.015), -s * 0.24], hoof = [hx0 + a * s * 0.13 + (hind ? -s * 0.01 : 0), -lift];
    c.strokeStyle = tone(col, shade); c.lineWidth = s * 0.05; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(hip[0], hip[1]); c.lineTo(knee[0], knee[1]); c.lineTo(hoof[0], hoof[1]); c.stroke();
    c.lineWidth = s * 0.06; c.strokeStyle = '#2f2824'; c.beginPath(); c.moveTo(hoof[0], hoof[1] - s * 0.02); c.lineTo(hoof[0], hoof[1]); c.stroke();
  };
  leg(-s * 0.25, Math.PI, true, -0.3); leg(s * 0.26, 0, false, -0.3);
  const headDip = o.graze ? Math.sin(t * 0.6 + ph) * 0.5 + 0.5 : 0;
  c.fillStyle = tone(col, 0);
  c.beginPath(); c.moveTo(-s * 0.37, -s * 0.57);
  c.quadraticCurveTo(-s * 0.1, -s * 0.74, s * 0.22, -s * 0.68);
  if (o.graze) { c.lineTo(s * 0.4, -s * 0.78 + headDip * s * 0.35); c.lineTo(s * 0.52, -s * 0.72 + headDip * s * 0.5); c.lineTo(s * 0.5, -s * 0.62 + headDip * s * 0.5); c.lineTo(s * 0.4, -s * 0.66 + headDip * s * 0.3); c.lineTo(s * 0.32, -s * 0.5); }
  else { c.lineTo(s * 0.4, -s * 0.97); c.lineTo(s * 0.5, -s * 1.01); c.quadraticCurveTo(s * 0.62, -s * 0.9, s * 0.67, -s * 0.8); c.lineTo(s * 0.6, -s * 0.77); c.lineTo(s * 0.5, -s * 0.84); c.lineTo(s * 0.42, -s * 0.72); c.lineTo(s * 0.32, -s * 0.5); }
  c.quadraticCurveTo(s * 0.0, -s * 0.34, -s * 0.3, -s * 0.42);
  c.quadraticCurveTo(-s * 0.42, -s * 0.48, -s * 0.37, -s * 0.57); c.closePath(); c.fill();
  c.fillStyle = tone(col, 0.2, 0.45); c.beginPath(); c.ellipse(-s * 0.02, -s * 0.6, s * 0.28, s * 0.06, -0.08, 0, TAU); c.fill();
  c.fillStyle = 'rgba(20,16,28,.16)'; c.beginPath(); c.ellipse(-s * 0.02, -s * 0.46, s * 0.3, s * 0.07, 0, 0, TAU); c.fill();
  if (o.saddle) { c.fillStyle = o.saddle; c.fillRect(-s * 0.18, -s * 0.72, s * 0.3, s * 0.05); c.fillStyle = '#4a382c'; c.beginPath(); c.ellipse(-s * 0.04, -s * 0.74, s * 0.12, s * 0.04, 0, Math.PI, 0); c.fill(); }
  c.fillStyle = tone(col, -0.42);
  if (!o.graze) { c.beginPath(); c.moveTo(s * 0.2, -s * 0.69); c.quadraticCurveTo(s * 0.32, -s * 0.92, s * 0.41, -s * 1.0); c.lineTo(s * 0.46, -s * 0.99); c.quadraticCurveTo(s * 0.34, -s * 0.84, s * 0.26, -s * 0.66); c.closePath(); c.fill(); c.beginPath(); c.moveTo(s * 0.46, -s * 1.0); c.lineTo(s * 0.47, -s * 1.08); c.lineTo(s * 0.52, -s * 1.0); c.closePath(); c.fill(); }
  else { c.beginPath(); c.moveTo(s * 0.2, -s * 0.69); c.quadraticCurveTo(s * 0.34, -s * 0.74, s * 0.42, -s * 0.74 + headDip * s * 0.3); c.lineTo(s * 0.4, -s * 0.66 + headDip * s * 0.3); c.closePath(); c.fill(); }
  const tw = Math.sin(t * 1.6 + s) * s * 0.035;
  c.beginPath(); c.moveTo(-s * 0.37, -s * 0.56); c.quadraticCurveTo(-s * 0.55 + tw, -s * 0.46, -s * 0.52 + tw * 2, -s * 0.16); c.quadraticCurveTo(-s * 0.44, -s * 0.38, -s * 0.34, -s * 0.5); c.closePath(); c.fill();
  leg(-s * 0.17, 0, true, -0.05); leg(s * 0.33, Math.PI, false, -0.05);
  c.restore();
}
function cart(c, x, y, s, dir, t, o = {}) {
  const wr = s * 0.17, rot = (o.dist || 0) / wr;
  c.save(); c.translate(x, y); c.scale(dir, 1);
  c.fillStyle = 'rgba(20,25,40,.16)'; c.beginPath(); c.ellipse(0, 0, s * 0.55, s * 0.06, 0, 0, TAU); c.fill();
  c.fillStyle = tone('#7a5b43', -0.05); c.fillRect(-s * 0.5, -s * 0.5, s, s * 0.22); c.fillStyle = tone('#7a5b43', -0.25); c.fillRect(-s * 0.5, -s * 0.34, s, s * 0.06);
  if (o.cover !== false) {
    c.fillStyle = tone(o.cover || '#d9cdb2', 0); c.beginPath(); c.moveTo(-s * 0.46, -s * 0.5); c.quadraticCurveTo(-s * 0.4, -s * 0.98, 0, -s * 1.0); c.quadraticCurveTo(s * 0.4, -s * 0.98, s * 0.46, -s * 0.5); c.closePath(); c.fill();
    c.fillStyle = 'rgba(30,28,40,.16)'; c.beginPath(); c.moveTo(s * 0.1, -s * 1.0); c.quadraticCurveTo(s * 0.4, -s * 0.98, s * 0.46, -s * 0.5); c.lineTo(s * 0.1, -s * 0.5); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(60,45,35,.35)'; c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * s * 0.18, -s * 0.5); c.quadraticCurveTo(i * s * 0.2, -s * 0.9, i * s * 0.1, -s * 1.0); c.stroke(); }
  } else { c.fillStyle = '#a8885a'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-s * 0.32 + i * s * 0.2, -s * 0.54, s * 0.11, Math.PI, 0); c.fill(); } }
  [-s * 0.3, s * 0.28].forEach(wx => {
    c.save(); c.translate(wx, -wr); c.rotate(rot); c.strokeStyle = '#3f3129'; c.lineWidth = s * 0.03; c.beginPath(); c.arc(0, 0, wr, 0, TAU); c.stroke();
    c.lineWidth = s * 0.015; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i * TAU / 6) * wr, Math.sin(i * TAU / 6) * wr); c.stroke(); } c.restore();
  });
  c.restore();
}
function dog(c, x, y, s, dir, t, col, moving) {
  c.save(); c.translate(x, y); c.scale(dir, 1); const a = moving ? Math.sin(t * 10) : 0;
  c.fillStyle = 'rgba(20,25,40,.16)'; c.beginPath(); c.ellipse(0, 0, s * 0.5, s * 0.06, 0, 0, TAU); c.fill();
  c.strokeStyle = tone(col, -0.3); c.lineWidth = s * 0.09; c.lineCap = 'round';
  [[-0.28, 1], [-0.2, -1], [0.22, -1], [0.3, 1]].forEach(l => { c.beginPath(); c.moveTo(s * l[0], -s * 0.32); c.lineTo(s * l[0] + a * l[1] * s * 0.1, -Math.max(0, a * l[1]) * s * 0.06); c.stroke(); });
  c.fillStyle = col; c.beginPath(); c.ellipse(0, -s * 0.42, s * 0.38, s * 0.17, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(s * 0.38, -s * 0.58, s * 0.14, 0, TAU); c.fill(); c.beginPath(); c.moveTo(s * 0.46, -s * 0.6); c.lineTo(s * 0.62, -s * 0.52); c.lineTo(s * 0.5, -s * 0.48); c.fill();
  c.fillStyle = tone(col, -0.4); c.beginPath(); c.moveTo(s * 0.34, -s * 0.66); c.lineTo(s * 0.3, -s * 0.8); c.lineTo(s * 0.42, -s * 0.7); c.fill(); c.lineWidth = s * 0.06; c.strokeStyle = col; c.beginPath(); c.moveTo(-s * 0.36, -s * 0.46); c.quadraticCurveTo(-s * 0.55, -s * 0.6 + Math.sin(t * 9) * s * 0.06, -s * 0.5, -s * 0.72); c.stroke();
  c.fillStyle = 'rgba(255,244,214,.3)'; c.beginPath(); c.ellipse(-s * 0.05, -s * 0.5, s * 0.25, s * 0.05, 0, 0, TAU); c.fill();
  c.restore();
}
function catSit(c, x, y, s, col, t) {
  c.save(); c.translate(x, y); c.fillStyle = col; c.beginPath(); c.ellipse(0, -s * 0.28, s * 0.22, s * 0.3, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(s * 0.08, -s * 0.62, s * 0.16, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(s * 0.0, -s * 0.72); c.lineTo(s * 0.02, -s * 0.86); c.lineTo(s * 0.1, -s * 0.76); c.fill(); c.beginPath(); c.moveTo(s * 0.12, -s * 0.76); c.lineTo(s * 0.2, -s * 0.86); c.lineTo(s * 0.22, -s * 0.7); c.fill();
  c.strokeStyle = col; c.lineWidth = s * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(-s * 0.2, -s * 0.05); c.quadraticCurveTo(-s * 0.55, -s * 0.05 + Math.sin(t * 1.5) * s * 0.1, -s * 0.5, -s * 0.4 + Math.sin(t * 1.5) * s * 0.1); c.stroke();
  c.fillStyle = 'rgba(230,220,120,.9)'; c.fillRect(s * 0.1, -s * 0.64, s * 0.03, s * 0.025); c.restore();
}
function hen(c, x, y, s, dir, t, col, ph) {
  const peck = Math.max(0, Math.sin(t * 3 + ph)); c.save(); c.translate(x, y); c.scale(dir, 1);
  c.strokeStyle = '#a8784a'; c.lineWidth = Math.max(1, s * 0.06); c.beginPath(); c.moveTo(-s * 0.05, -s * 0.3); c.lineTo(-s * 0.05, 0); c.moveTo(s * 0.1, -s * 0.3); c.lineTo(s * 0.1, 0); c.stroke();
  c.fillStyle = col; c.beginPath(); c.ellipse(0, -s * 0.5, s * 0.34, s * 0.26, 0.15, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-s * 0.3, -s * 0.55); c.lineTo(-s * 0.5, -s * 0.8); c.lineTo(-s * 0.15, -s * 0.62); c.fill();
  c.beginPath(); c.arc(s * 0.32, -s * 0.76 + peck * s * 0.35, s * 0.13, 0, TAU); c.fill(); c.fillStyle = '#d9a548'; c.beginPath(); c.moveTo(s * 0.42, -s * 0.78 + peck * s * 0.35); c.lineTo(s * 0.56, -s * 0.72 + peck * s * 0.4); c.lineTo(s * 0.42, -s * 0.7 + peck * s * 0.35); c.fill();
  c.fillStyle = '#b5382e'; c.beginPath(); c.arc(s * 0.3, -s * 0.9 + peck * s * 0.35, s * 0.06, 0, TAU); c.fill(); c.restore();
}
function cow(c, x, y, s, dir, t, ph, col) {
  const dip = Math.max(0, Math.sin(t * 0.5 + ph)); c.save(); c.translate(x, y); c.scale(dir, 1);
  c.fillStyle = 'rgba(20,25,40,.16)'; c.beginPath(); c.ellipse(0, 0, s * 0.55, s * 0.07, 0, 0, TAU); c.fill();
  c.fillStyle = tone(col, -0.2); c.fillRect(-s * 0.36, -s * 0.34, s * 0.09, s * 0.34); c.fillRect(-s * 0.2, -s * 0.34, s * 0.09, s * 0.34); c.fillRect(s * 0.18, -s * 0.34, s * 0.09, s * 0.34); c.fillRect(s * 0.32, -s * 0.34, s * 0.09, s * 0.34);
  c.fillStyle = col; c.beginPath(); c.ellipse(0, -s * 0.5, s * 0.46, s * 0.26, 0, 0, TAU); c.fill();
  c.fillStyle = tone(col, -0.35, 0.8); c.beginPath(); c.ellipse(-s * 0.12, -s * 0.54, s * 0.14, s * 0.1, 0, 0, TAU); c.ellipse(s * 0.14, -s * 0.46, s * 0.1, s * 0.08, 0, 0, TAU); c.fill();
  c.fillStyle = col; c.beginPath(); c.ellipse(s * 0.5, -s * 0.5 + dip * s * 0.3, s * 0.15, s * 0.11, 0.3 + dip * 0.8, 0, TAU); c.fill(); c.fillStyle = '#e0b8a8'; c.beginPath(); c.ellipse(s * 0.6, -s * 0.46 + dip * s * 0.36, s * 0.07, s * 0.06, 0.3, 0, TAU); c.fill();
  c.strokeStyle = tone(col, -0.3); c.lineWidth = s * 0.04; c.beginPath(); c.moveTo(-s * 0.44, -s * 0.6); c.quadraticCurveTo(-s * 0.55, -s * 0.4, -s * 0.5, -s * 0.2 + Math.sin(t * 2 + ph) * s * 0.05); c.stroke(); c.restore();
}
function sheep(c, x, y, s, dir, t, ph) {
  const dip = Math.max(0, Math.sin(t * 0.7 + ph)); c.save(); c.translate(x, y); c.scale(dir, 1);
  c.strokeStyle = '#3a3438'; c.lineWidth = s * 0.07; c.beginPath(); c.moveTo(-s * 0.2, -s * 0.25); c.lineTo(-s * 0.2, 0); c.moveTo(s * 0.2, -s * 0.25); c.lineTo(s * 0.2, 0); c.stroke();
  c.fillStyle = '#e8e2d2'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(-s * 0.3 + (i % 4) * s * 0.2, -s * 0.45 - (i > 3 ? s * 0.12 : 0), s * 0.2, 0, TAU); c.fill(); } c.fillStyle = 'rgba(40,40,70,.12)'; c.beginPath(); c.ellipse(0, -s * 0.3, s * 0.5, s * 0.12, 0, 0, TAU); c.fill();
  c.fillStyle = '#3a3438'; c.beginPath(); c.ellipse(s * 0.5, -s * 0.44 + dip * s * 0.22, s * 0.12, s * 0.15, 0.3, 0, TAU); c.fill(); c.restore();
}
function duck(c, x, y, s, dir, t, ph) {
  c.save(); c.translate(x, y + Math.sin(t * 1.6 + ph) * s * 0.06); c.scale(dir, 1);
  c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.ellipse(0, s * 0.18, s * 0.6, s * 0.1, 0, 0, TAU); c.fill();
  c.fillStyle = '#7a6a52'; c.beginPath(); c.ellipse(0, 0, s * 0.45, s * 0.24, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-s * 0.4, -s * 0.05); c.lineTo(-s * 0.6, -s * 0.22); c.lineTo(-s * 0.3, -s * 0.12); c.fill();
  c.fillStyle = '#2f6a5a'; c.beginPath(); c.arc(s * 0.36, -s * 0.3, s * 0.16, 0, TAU); c.fill(); c.fillStyle = '#d9b548'; c.beginPath(); c.moveTo(s * 0.48, -s * 0.32); c.lineTo(s * 0.66, -s * 0.27); c.lineTo(s * 0.48, -s * 0.23); c.fill(); c.restore();
}
function heron(c, x, y, s, t, ph, col = '#8f9aa6') {
  c.save(); c.translate(x, y); c.strokeStyle = '#6a6258'; c.lineWidth = Math.max(1.2, s * 0.025); c.beginPath(); c.moveTo(0, -s * 0.5); c.lineTo(0, 0); c.stroke();
  c.fillStyle = col; c.beginPath(); c.ellipse(0, -s * 0.62, s * 0.16, s * 0.09, -0.4, 0, TAU); c.fill();
  const bob = Math.sin(t * 0.5 + ph) * s * 0.02; c.strokeStyle = col; c.lineWidth = s * 0.05; c.beginPath(); c.moveTo(s * 0.1, -s * 0.66); c.quadraticCurveTo(s * 0.22, -s * 0.8, s * 0.12, -s * 0.95 + bob); c.stroke();
  c.fillStyle = col; c.beginPath(); c.arc(s * 0.13, -s * 0.97 + bob, s * 0.035, 0, TAU); c.fill(); c.fillStyle = '#d9b548'; c.beginPath(); c.moveTo(s * 0.15, -s * 0.98 + bob); c.lineTo(s * 0.32, -s * 0.95 + bob); c.lineTo(s * 0.15, -s * 0.95 + bob); c.fill(); c.restore();
}
function deer(c, x, y, s, dir, t, col, gait = 6) {
  horse(c, x, y, s, dir, t, col, { gait });
  c.save(); c.translate(x, y); c.scale(dir, 1); c.strokeStyle = tone(col, -0.4); c.lineWidth = s * 0.025; c.lineCap = 'round';
  [[0.46, -1.05], [0.5, -1.05]].forEach((a, i) => { c.beginPath(); c.moveTo(s * a[0], s * a[1]); c.lineTo(s * (a[0] - 0.08 + i * 0.1), s * (a[1] - 0.22)); c.lineTo(s * (a[0] - 0.14 + i * 0.1), s * (a[1] - 0.34)); c.moveTo(s * (a[0] - 0.08 + i * 0.1), s * (a[1] - 0.22)); c.lineTo(s * (a[0] + 0.02 + i * 0.1), s * (a[1] - 0.36)); c.stroke(); });
  c.restore();
}
function bird(c, x, y, s, t, ph, col) {
  const f = Math.sin(t * 7 + ph) * s * 0.55;
  c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.16); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - s, y - f * 0.3); c.quadraticCurveTo(x - s * 0.4, y + f - s * 0.3, x, y); c.quadraticCurveTo(x + s * 0.4, y + f - s * 0.3, x + s, y - f * 0.3); c.stroke();
}
function flock(c, x, y, n, s, t, col, dir = 1) { for (let i = 0; i < n; i++) { const a = Math.ceil(i / 2) * (i % 2 ? 1 : -1); bird(c, x - dir * Math.abs(a) * s * 3.2, y + a * s * 1.4 + Math.sin(t * 0.8 + i) * s * 0.4, s, t * (0.9 + (i % 3) * 0.05), i * 1.7, col); } }
function butterfly(c, x, y, s, t, ph, col) {
  const f = Math.abs(Math.sin(t * 9 + ph)); c.fillStyle = col;
  c.beginPath(); c.ellipse(x - s * 0.3 * f, y, s * 0.55 * f + 0.5, s * 0.4, -0.4, 0, TAU); c.fill(); c.beginPath(); c.ellipse(x + s * 0.3 * f, y, s * 0.55 * f + 0.5, s * 0.4, 0.4, 0, TAU); c.fill();
}
function dragon(c, x, y, s, t, col, dir = 1) {
  c.save(); c.translate(x, y); c.scale(dir, 1); const fa = Math.sin(t * 2.6);
  const wing = (a, shade, dx) => {
    const tipX = -s * 0.3 + Math.sin(a) * s * 0.35 + dx, tipY = -s * 0.55 * Math.cos(a) - s * 0.1;
    c.fillStyle = tone(col, shade); c.beginPath(); c.moveTo(s * 0.12 + dx, -s * 0.05); c.lineTo(tipX, tipY); c.quadraticCurveTo(tipX - s * 0.1, tipY * 0.45, -s * 0.5 + dx * 0.5, s * 0.02 - tipY * 0.12); c.quadraticCurveTo(-s * 0.4, s * 0.08, -s * 0.3 + dx, s * 0.0); c.quadraticCurveTo(-s * 0.2, -s * 0.12, -s * 0.12 + dx, -s * 0.04); c.closePath(); c.fill();
    c.strokeStyle = tone(col, shade - 0.2); c.lineWidth = Math.max(1, s * 0.015); c.beginPath(); c.moveTo(s * 0.12 + dx, -s * 0.05); c.lineTo(tipX, tipY); c.moveTo(-s * 0.1 + dx, -s * 0.03); c.lineTo(tipX + s * 0.1, tipY * 0.7); c.stroke();
  };
  wing(-fa * 0.8, -0.2, -s * 0.05);
  c.fillStyle = tone(col, 0); c.beginPath(); c.moveTo(s * 0.2, -s * 0.06); c.quadraticCurveTo(s * 0.5, -s * 0.2, s * 0.62, -s * 0.34); c.lineTo(s * 0.7, -s * 0.34); c.lineTo(s * 0.8, -s * 0.28); c.lineTo(s * 0.7, -s * 0.24); c.lineTo(s * 0.62, -s * 0.2);
  c.quadraticCurveTo(s * 0.46, -s * 0.0, s * 0.3, s * 0.06); c.quadraticCurveTo(-s * 0.2, s * 0.12, -s * 0.5, s * 0.04); c.quadraticCurveTo(-s * 0.9 - fa * s * 0.05, -s * 0.05, -s * 1.15, s * 0.1 + fa * s * 0.1); c.lineTo(-s * 1.25, s * 0.04 + fa * s * 0.1); c.lineTo(-s * 1.2, s * 0.17 + fa * s * 0.1); c.quadraticCurveTo(-s * 0.9, -s * 0.0, -s * 0.5, -s * 0.06); c.quadraticCurveTo(-s * 0.1, -s * 0.12, s * 0.2, -s * 0.06); c.fill();
  c.beginPath(); c.moveTo(s * 0.64, -s * 0.34); c.lineTo(s * 0.58, -s * 0.46); c.lineTo(s * 0.68, -s * 0.37); c.fill();
  wing(fa * 0.8, 0.05, s * 0.1);
  c.restore();
}
function boat(c, x, y, s, dir, t, o = {}) {
  c.save(); c.translate(x, y + Math.sin(t * 1.3 + (o.ph || 0)) * s * 0.02); c.scale(dir, 1);
  c.fillStyle = 'rgba(20,30,40,.22)'; c.beginPath(); c.ellipse(0, s * 0.04, s * 0.55, s * 0.05, 0, 0, TAU); c.fill();
  c.fillStyle = '#6a4e3a'; c.beginPath(); c.moveTo(-s * 0.55, -s * 0.2); c.quadraticCurveTo(-s * 0.4, s * 0.04, 0, s * 0.04); c.quadraticCurveTo(s * 0.45, s * 0.04, s * 0.6, -s * 0.24); c.lineTo(s * 0.5, -s * 0.2); c.quadraticCurveTo(0, -s * 0.12, -s * 0.55, -s * 0.2); c.fill();
  c.fillStyle = 'rgba(255,240,210,.18)'; c.fillRect(-s * 0.5, -s * 0.2, s * 1.0, s * 0.03);
  if (o.P) person(c, -s * 0.05, -s * 0.12, s * 0.5, t, o.P, { dir: 1, pace: 0, pose: 'stand' });
  if (o.row) { const a = Math.sin(t * 1.3) * 0.5; c.strokeStyle = '#5a4636'; c.lineWidth = Math.max(1.5, s * 0.02); c.beginPath(); c.moveTo(0, -s * 0.28); c.lineTo(s * 0.35 + a * s * 0.2, s * 0.08); c.stroke(); }
  if (o.lantern) { c.strokeStyle = '#3a2f2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(s * 0.5, -s * 0.22); c.lineTo(s * 0.5, -s * 0.5); c.stroke(); c.fillStyle = '#6e5a3c'; c.fillRect(s * 0.46, -s * 0.5, s * 0.08, s * 0.1); }
  c.restore();
}

/* ═════════════════ small shared actors ═════════════════ */
function soft(c, sprite, x, y, w, h, a) { const pa = c.globalAlpha; c.globalAlpha = pa * a; c.drawImage(sprite, x - w / 2, y - h / 2, w, h); c.globalAlpha = pa; }
function smokeAt(c, E, x, y, s, seed, dark = 0) {
  const tint = dark ? '#8a8c94' : '#f1ece2';
  for (let i = 0; i < 6; i++) {
    const age = (((E.t * 0.11 + i / 6 + seed) % 1) + 1) % 1, px = x + E.wind * age * 70 + Math.sin(E.t * 0.8 + i * 2 + seed) * 6 * age;
    const rr = (6 + age * 28) * s;
    c.save(); c.globalAlpha *= (1 - age) * Math.min(1, age * 5) * 0.4 * (1 - E.rain * 0.4);
    c.fillStyle = tint; c.beginPath(); c.arc(px, y - age * 100 * s, rr, 0, TAU); c.fill(); c.restore();
  }
}
function flagAt(c, E, f) {
  const wave = Math.sin(E.t * 2.6 + f.x * 0.01) * f.len * 0.1 * (0.5 + E.wind), fl = f.len * 1.1;
  c.strokeStyle = '#3b3636'; c.lineWidth = 2; c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x, f.y - fl * 0.9); c.stroke();
  c.fillStyle = f.col;
  c.beginPath(); c.moveTo(f.x, f.y - fl * 0.88); c.bezierCurveTo(f.x + fl * 0.3, f.y - fl * 0.9 + wave, f.x + fl * 0.6, f.y - fl * 0.82 - wave, f.x + fl * 0.85 + wave * 0.6, f.y - fl * 0.76);
  c.bezierCurveTo(f.x + fl * 0.6, f.y - fl * 0.66 - wave, f.x + fl * 0.3, f.y - fl * 0.62 + wave, f.x, f.y - fl * 0.58); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,240,210,.14)'; c.beginPath(); c.moveTo(f.x, f.y - fl * 0.88); c.lineTo(f.x + fl * 0.5, f.y - fl * 0.84 + wave * 0.5); c.lineTo(f.x, f.y - fl * 0.74); c.closePath(); c.fill();
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  THE WORLD
 *  "Z" is the camera station along the journey (0..CFG.TRAVEL). A layer with
 *  parallax p shows station Z at x = Z*p, so every layer agrees about which
 *  zone it is currently showing.
 * ═══════════════════════════════════════════════════════════════════════════ */
const ZONES = [{ id: 'farm', z0: -9e3 }, { id: 'river', z0: 3400 }, { id: 'town', z0: 6300 }, { id: 'tavern', z0: 9900 }, { id: 'forest', z0: 12300 }];
const zoneAt = z => { let id = 'farm'; for (const q of ZONES) if (z >= q.z0) id = q.id; return id; };
const zoneW = (z, id, soft = 260) => { // smooth membership 0..1 of station z in a zone
  let i = ZONES.findIndex(q => q.id === id), a = ZONES[i].z0, b = i + 1 < ZONES.length ? ZONES[i + 1].z0 : 9e9;
  return smooth((z - a) / soft + 0.5) * (1 - smooth((z - b) / soft + 0.5));
};
const SP = z => z * STAGE_P;                       // stage x for station z
const LAYERS = [];
const addLayer = s => { s.idx = LAYERS.length; LAYERS.push(s); return s; };
const R2 = (L, i, k = 0) => rngAt(L.idx * 977 + k, i, 13);

/* ───────────── Moonwell: a giant crystal spring on the highest peak ───────────── */
function shard(c, x, y, h, w, tilt, hue) {
  c.save(); c.translate(x, y); c.rotate(tilt);
  const L = hue ? ['#d8c8ff', '#9a86e0', '#6a58b8'] : ['#d4f8ff', '#7cc8ee', '#4a8acb'], D = hue ? ['#8a72d0', '#5a48a8', '#3a2f80'] : ['#5aa0dc', '#3c68b4', '#2c4a98'];
  c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2, -h * 0.76); c.lineTo(0, -h); c.lineTo(0, 0); c.closePath(); c.fillStyle = vgrad(c, -h, 0, L[0], L[2]); c.fill();
  c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, -h * 0.76); c.lineTo(0, -h); c.lineTo(0, 0); c.closePath(); c.fillStyle = vgrad(c, -h, 0, D[0], D[2]); c.fill();
  c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.moveTo(-w * 0.34, -h * 0.1); c.lineTo(-w * 0.34, -h * 0.66); c.lineTo(-w * 0.14, -h * 0.78); c.lineTo(-w * 0.14, -h * 0.2); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-w / 2, -h * 0.76); c.lineTo(0, -h); c.lineTo(w / 2, -h * 0.76); c.moveTo(0, -h); c.lineTo(0, 0); c.stroke();
  c.restore();
}
function moonwell(c, X, mx, my) {
  const r = rngAt(5, 6, 7);
  // jagged pedestal of rock under the spring
  const P = [[mx - 330, my + 330], [mx - 240, my + 190], [mx - 196, my + 100], [mx - 168, my + 52], [mx - 132, my + 14], [mx - 96, my - 6], [mx + 96, my - 8], [mx + 132, my + 10], [mx + 170, my + 56], [mx + 204, my + 120], [mx + 262, my + 210], [mx + 350, my + 330]];
  c.fillStyle = vgrad(c, my - 10, my + 330, '#7f87a8', '#4a537c'); c.beginPath(); P.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill();
  c.save(); c.clip();
  for (let i = 0; i < 26; i++) { const x = mx - 300 + r() * 600, y = my + r() * 280, l = 40 + r() * 90, w = 16 + r() * 40, lit = x < mx + 40; c.fillStyle = lit ? `rgba(220,230,255,${0.06 + r() * 0.08})` : `rgba(20,26,60,${0.1 + r() * 0.1})`; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + l * 0.4); c.lineTo(x + w * 0.4, y + l); c.lineTo(x - w * 0.6, y + l * 0.7); c.closePath(); c.fill(); }
  c.fillStyle = 'rgba(20,26,60,.28)'; c.beginPath(); c.moveTo(mx + 96, my - 8); c.lineTo(mx + 350, my + 330); c.lineTo(mx + 60, my + 330); c.closePath(); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(210,225,255,.5)'; c.lineWidth = 2; c.beginPath(); P.slice(0, 8).forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
  c.fillStyle = '#b3b8c6'; c.beginPath(); c.ellipse(mx, my - 2, 112, 18, 0, 0, TAU); c.fill();
  c.fillStyle = '#6fd6ee'; c.beginPath(); c.ellipse(mx, my - 3, 96, 13, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(mx - 10, my - 6, 58, 4, 0, 0, TAU); c.fill();
  [[-76, 70, 24, -0.5, 1], [-44, 110, 28, -0.28, 0], [56, 100, 26, 0.3, 1], [86, 62, 22, 0.55, 0], [-98, 40, 18, -0.75, 0], [110, 36, 18, 0.8, 1], [-18, 150, 34, -0.08, 0], [22, 190, 40, 0.06, 0], [4, 120, 30, 0.0, 1]].forEach(a => shard(c, mx + a[0] * 1.2, my - 4, a[1] * 1.5, a[2] * 1.3, a[3], a[4]));
  for (let i = 0; i < 22; i++) { const a = r() * TAU; c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(mx + Math.cos(a) * (20 + r() * 110), my - 20 - r() * 230, 1 + r() * 1.6, 0, TAU); c.fill(); }
  X.light({ kind: 'glow', x: mx - 1, y: my - 120, w: 2, h: 2, r: 640, col: 'cyan', base: 0.2, on: 0, off: 0, ph: 0.3, k: 0.8 });
  X.light({ kind: 'glow', x: mx - 1, y: my - 60, w: 2, h: 2, r: 160, col: 'cyan', base: 0.05, on: 0, off: 0, ph: 0.6, k: 0.35, sp: 0.8 });
}

/* ───────────── The Citadel: capital + castle climbing a mountain ───────────── */
function townRow(c, X, r, x0, x1, base, hMin, hMax, sc, pal, gap = 0) {
  for (let x = x0; x < x1;) {
    const w = (22 + r() * 22) * sc, h = (hMin + r() * (hMax - hMin)) * sc, rh = w * (0.45 + r() * 0.3);
    const wall = pick(r, pal.walls), rf = pick(r, pal.roofs);
    c.fillStyle = vgrad(c, base - h, base, tone(wall, 0.08), tone(wall, -0.14)); c.fillRect(x, base - h, w, h);
    c.fillStyle = 'rgba(28,34,64,.14)'; c.fillRect(x + w * 0.72, base - h, w * 0.28, h);
    c.fillStyle = vgrad(c, base - h - rh, base - h, tone(rf, 0.1), tone(rf, -0.14));
    c.beginPath(); c.moveTo(x - w * 0.07, base - h); c.lineTo(x + w / 2, base - h - rh); c.lineTo(x + w * 1.07, base - h); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,240,210,.1)'; c.beginPath(); c.moveTo(x + w / 2, base - h - rh); c.lineTo(x - w * 0.07, base - h); c.lineTo(x + w / 2, base - h); c.closePath(); c.fill();
    if (r() < 0.8) X.light({ kind: 'win', x: x + w * 0.2, y: base - h * 0.62, w: w * 0.17, h: h * 0.2, k: r() < 0.6 ? 0.85 : 0.1, tiny: true });
    if (r() < 0.55) X.light({ kind: 'win', x: x + w * 0.6, y: base - h * 0.62, w: w * 0.17, h: h * 0.2, k: r() < 0.6 ? 0.85 : 0.1, tiny: true });
    if (r() < 0.25) { c.fillStyle = '#6d625b'; c.fillRect(x + w * (0.2 + r() * 0.5), base - h - rh * 0.8, w * 0.1, rh * 0.5); }
    if (gap && r() < 0.6) conifer(c, x + w * 1.4, base + 4, 30 + r() * 26, pick(r, ['#4f6b58', '#5a7660', '#466552']), r, false);
    x += w * (0.88 + r() * 0.25 + gap * r() * 0.9);
  }
}
const CIT_PAL = { walls: ['#d3c7ad', '#c8bba2', '#dccfb4', '#c0b49d'], roofs: ['#9a6a54', '#8a6e60', '#7a6c70', '#a67660', '#6f6a78'], stone: '#bab3a6', towerRoof: '#6f6a82' };
function citadel(c, X, cx) {
  const r = rngAt(31, 7, 1), pal = CIT_PAL, base = 780;
  const f = ridgeFn({ base, amp: 26, scale: 240, rough: 0.6, seed: 5, sharp: false, bumps: [{ x: cx, h: 340, w: 330, pw: 1.5 }, { x: cx + 330, h: 120, w: 150, pw: 2 }, { x: cx - 360, h: 90, w: 130, pw: 2 }] });
  paintRidge(c, X, f, { col: '#827f92', colBot: '#a09ca6', base, amp: 40, seed: 5, strata: 24, snowY: 400, step: 8 });
  const span = y => { let xl = cx, xr = cx; for (let d = 0; d < 760; d += 5) { if (f(cx - d) > y) break; xl = cx - d; } for (let d = 0; d < 760; d += 5) { if (f(cx + d) > y) break; xr = cx + d; } return [xl, xr]; };
  // terraces of houses
  c.save();
  for (let t = 0; t < 9; t++) {
    const y = base - 14 - t * 32, s = span(y), x0 = s[0] + 6, x1 = s[1] - 6, sc = lerp(1.1, 0.7, t / 10);
    if (x1 - x0 < 30) continue;
    c.fillStyle = vgrad(c, y - 10, y + 22, tone(pal.stone, 0.1), tone(pal.stone, -0.2)); c.fillRect(x0 - 8, y - 10, x1 - x0 + 16, 34);
    blocks(c, r, x0 - 8, y - 10, x1 - x0 + 16, 34, pal.stone, 20, 11, 0.35);
    townRow(c, X, r, x0, x1, y - 8, 26, 48, sc, pal, 0.9);
  }
  c.restore();
  // lower wall + gate
  const sb = span(base - 4); c.fillStyle = vgrad(c, base - 60, base + 6, tone(pal.stone, 0.1), tone(pal.stone, -0.2)); c.fillRect(sb[0] - 70, base - 56, sb[1] - sb[0] + 140, 64); blocks(c, r, sb[0] - 70, base - 56, sb[1] - sb[0] + 140, 64, pal.stone, 22, 13, 0.3); crenels(c, sb[0] - 70, sb[1] + 70, base - 56, 9, 11, tone(pal.stone, -0.08));
  for (let x = sb[0] - 60; x < sb[1] + 70; x += 190) towerR(c, X, r, x, base + 6, 38, 100, pal.stone, pal.towerRoof, 52, { slits: 1, lit: 0.6 });
  c.fillStyle = '#2c2d38'; c.beginPath(); c.moveTo(cx - 22, base + 6); c.lineTo(cx - 22, base - 26); c.arc(cx, base - 26, 22, Math.PI, 0); c.lineTo(cx + 22, base + 6); c.fill();
  // castle on the summit
  const ty = f(cx) + 16;
  c.fillStyle = vgrad(c, ty - 150, ty, tone(pal.stone, 0.12), tone(pal.stone, -0.14)); c.fillRect(cx - 100, ty - 90, 200, 105); blocks(c, r, cx - 100, ty - 90, 200, 105, pal.stone, 18, 12, 0.25); crenels(c, cx - 100, cx + 100, ty - 90, 10, 13, tone(pal.stone, -0.06));
  for (const dx of [-112, 112]) towerR(c, X, r, cx + dx, ty + 14, 38, 150, pal.stone, pal.towerRoof, 64, { slits: 3, lit: 0.9, flag: '#8d5a52' });
  towerR(c, X, r, cx - 44, ty - 86, 42, 110, tone(pal.stone, 0.03), pal.towerRoof, 62, { slits: 2, lit: 1 });
  towerR(c, X, r, cx + 46, ty - 86, 46, 140, tone(pal.stone, 0.03), pal.towerRoof, 74, { slits: 3, lit: 1, flag: '#4d5f7a' });
  towerR(c, X, r, cx + 2, ty - 94, 34, 170, tone(pal.stone, 0.08), '#6a7ab0', 104, { slits: 4, lit: 1, flag: '#8d5a52' });
  X.light({ kind: 'glow', x: cx + 1, y: ty - 270, w: 2, h: 2, r: 70, col: 'cyan', base: 0.1, on: 0, off: 0.2, ph: 0.2, k: 0.9 });
  for (let rr = 0; rr < 2; rr++) for (let i = 0; i < 6; i++) X.light({ kind: 'win', x: cx - 80 + i * 30, y: ty - 70 + rr * 36, w: 9, h: 16, k: 0.9, tiny: true });
  // cathedral on a mid terrace
  const cy = base - 14 - 3 * 32 - 8, cs = span(cy), ccx = lerp(cs[0], cs[1], 0.32);
  c.fillStyle = vgrad(c, cy - 150, cy, tone(pal.stone, 0.1), tone(pal.stone, -0.12)); c.fillRect(ccx - 46, cy - 100, 92, 100); blocks(c, r, ccx - 46, cy - 100, 92, 100, pal.stone, 16, 10, 0.2);
  c.fillStyle = tone(pal.towerRoof, -0.05); c.beginPath(); c.moveTo(ccx - 52, cy - 100); c.lineTo(ccx, cy - 150); c.lineTo(ccx + 52, cy - 100); c.closePath(); c.fill(); towerR(c, X, r, ccx + 40, cy, 24, 170, pal.stone, pal.towerRoof, 70, { blocks: false, flag: '#c9a548' });
  c.fillStyle = 'rgba(40,50,90,.55)'; c.beginPath(); c.arc(ccx - 8, cy - 62, 14, Math.PI, 0); c.fillRect(ccx - 22, cy - 62, 28, 34); c.fill(); X.light({ kind: 'win', x: ccx - 16, y: cy - 60, w: 16, h: 26, k: 0.9, tiny: true });
  // waterfall pouring off the right shoulder
  const wx = cx + 285, wy = f(wx) + 6;
  const g = c.createLinearGradient(0, wy, 0, base + 10); g.addColorStop(0, 'rgba(240,248,252,.85)'); g.addColorStop(1, 'rgba(240,248,252,.35)');
  c.fillStyle = g; c.beginPath(); c.moveTo(wx - 7, wy); c.lineTo(wx + 7, wy); c.lineTo(wx + 22, base + 6); c.lineTo(wx - 18, base + 6); c.closePath(); c.fill();
}

/* floating island (drawn live so it can bob) */
function island(c, E, x, y, s, seed, t) {
  const r = rngAt(seed, 3, 3), by = y + Math.sin(t * 0.25 + seed) * 6 * s;
  c.save(); c.translate(x, by); c.scale(s, s);
  c.fillStyle = vgrad(c, 0, 150, '#7f7a86', '#4f4c60'); c.beginPath(); c.moveTo(-110, 0);
  for (let i = 1; i <= 6; i++) c.lineTo(-110 + i * 36.6 + (r() - 0.5) * 16, 28 + Math.sin(i / 6 * Math.PI) * (70 + r() * 70) * (1 - Math.abs(i - 3) / 5));
  c.lineTo(110, 0); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,244,214,.12)'; c.beginPath(); c.moveTo(-110, 0); c.lineTo(-30, 0); c.lineTo(-60, 80); c.lineTo(-90, 40); c.fill();
  c.fillStyle = '#7fa062'; c.beginPath(); c.ellipse(0, 0, 112, 20, 0, 0, TAU); c.fill(); c.fillStyle = '#93b574'; c.beginPath(); c.ellipse(-10, -4, 92, 12, 0, 0, TAU); c.fill();
  for (let i = 0; i < 5; i++) { const tx = -70 + i * 34 + (r() - 0.5) * 10; broadleaf(c, tx, -2 + (r() - 0.5) * 6, 12 + r() * 6, pick(r, ['#5f8a52', '#6d9a58']), r, { blobs: 6 }); }
  c.fillStyle = '#c8bca4'; c.fillRect(30, -34, 24, 34); c.fillStyle = '#7a6a7a'; c.beginPath(); c.moveTo(26, -34); c.lineTo(42, -58); c.lineTo(58, -34); c.fill();
  c.strokeStyle = 'rgba(210,235,245,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-30, 20); c.lineTo(-30, 80 + Math.sin(t * 3) * 3); c.stroke();
  for (let i = 0; i < 6; i++) { c.strokeStyle = '#5a7a4a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-90 + i * 36, 18); c.quadraticCurveTo(-90 + i * 36 + 6, 40, -88 + i * 36, 56 + (i % 3) * 14); c.stroke(); }
  c.restore();
}

/* ───────────── the far layers ───────────── */
const MW_X = 470, CIT_X = -360;
const MW_PEAK = ridgeFn({ base: 600, amp: 330, scale: 1000, sharp: true, rough: 0.52, seed: 3, bumps: [{ x: MW_X, h: 190, w: 260, pw: 1.8 }] });
addLayer({
  id: 'peaks', p: 0.012, q: 0.5, fog: 0.32, dayGlow: true, emitNightOnly: true, mot: 140, brush: 300,
  paint(c, X) {
    const f1 = MW_PEAK;
    paintRidge(c, X, f1, { col: '#7f94b8', colBot: '#aebfd2', snowY: 360, strata: 14, base: 600, amp: 330, seed: 3 });
    paintRidge(c, X, ridgeFn({ base: 700, amp: 170, scale: 650, sharp: true, seed: 9 }), { col: '#6d86a6', colBot: '#98adbf', snowY: 470, base: 700, amp: 170, seed: 9 });
    if (MW_X > X.x0 - 260 && MW_X < X.x1 + 260) moonwell(c, X, MW_X, f1(MW_X) + 22);
  },
  emit(g, E, V) { // beams, rings and motes — the Moonwell breathes
    const my = MW_PEAK(MW_X) + 22 - 4, a = smooth((E.night - 0.3) / 0.6) * (0.7 + 0.3 * Math.sin(E.t * 0.4)) + 0.12;
    g.save(); g.globalCompositeOperation = 'lighter';
    const bw = 40 + 10 * Math.sin(E.t * 0.3);
    for (let q = 0; q < 8; q++) { const ww = bw * (0.35 + q * 0.3), gr = g.createLinearGradient(0, my - 760, 0, my - 30); gr.addColorStop(0, 'rgba(150,220,255,0)'); gr.addColorStop(1, `rgba(150,225,255,${0.045 * a})`); g.fillStyle = gr; g.beginPath(); g.moveTo(MW_X - ww, my - 30); g.lineTo(MW_X + ww, my - 30); g.lineTo(MW_X + ww * 1.8, my - 760); g.lineTo(MW_X - ww * 1.8, my - 760); g.closePath(); g.fill(); }
    const pu = evt(E.t, 47, 7, 5); if (pu >= 0) { const rr = 40 + pu * 520; g.strokeStyle = `rgba(170,230,255,${(1 - pu) * 0.5})`; g.lineWidth = 3 + (1 - pu) * 4; g.beginPath(); g.ellipse(MW_X, my - 20, rr, rr * 0.2, 0, 0, TAU); g.stroke(); }
    for (let i = 0; i < 26; i++) { const ph = (E.t * 0.05 + i / 26) % 1, a2 = i * 2.4 + E.t * 0.2, x = MW_X + Math.sin(a2) * (60 + 70 * hash1(i)), y = my - 20 - ph * 420 + Math.cos(a2) * 8; g.fillStyle = `rgba(200,240,255,${Math.sin(ph * Math.PI) * 0.8 * (0.4 + a)})`; g.beginPath(); g.arc(x, y, 1.6 + hash1(i * 3) * 2, 0, TAU); g.fill(); }
    g.restore();
  }
});
addLayer({
  id: 'citadel', p: 0.025, q: 0.6, fog: 0.22, mot: 200, brush: 400,
  paint(c, X) { if (CIT_X > X.x0 - 800 && CIT_X < X.x1 + 800) citadel(c, X, CIT_X); paintRidge(c, X, ridgeFn({ base: 790, amp: 40, scale: 500, seed: 14, rough: 0.5 }), { col: '#6f8a86', colBot: '#8aa090', base: 790, amp: 60, seed: 14, flat: true }); },
  dyn(c, E, V) {
    island(c, E, -40, 250, 0.9, 11, E.t); island(c, E, 900, 380, 0.6, 23, E.t);
    // mist at the waterfall foot
    for (let i = 0; i < 3; i++) soft(c, E.mistSprite, CIT_X + 285 + Math.sin(E.t * 0.3 + i) * 12, 750 - i * 8, 120 + i * 30, 36, 0.45);
    for (let i = 0; i < 14; i++) { const ph = (E.t * 0.6 + i * 0.37) % 1; c.fillStyle = `rgba(240,248,252,${(1 - ph) * 0.8})`; c.fillRect(CIT_X + 280 + (hash1(i) - 0.5) * 18, 480 + ph * 270, 2, 6); }
    // distant dragon
    const dv = evt(E.t, 190, 52, 28); if (dv >= 0) { const x = lerp(-1600, 1900, dv), y = 190 + Math.sin(dv * 9) * 24 + dv * 60; c.save(); c.globalAlpha *= 0.82; dragon(c, x, y, 90, E.t, '#3f4660', 1); c.restore(); }
    for (let i = 0; i < 4; i++) flock(c, ((E.t * (12 + i * 2) + i * 700) % 3600) - 1800, 250 + i * 40, 5, 5, E.t, 'rgba(70,78,96,.6)');
  }
});
addLayer({
  id: 'hills', p: 0.06, q: 0.6, fog: 0.2, mot: 220, brush: 500,
  paint(c, X) {
    const f = ridgeFn({ base: 700, amp: 60, scale: 520, rough: 0.5, seed: 21 });
    paintRidge(c, X, f, { col: '#76917c', colBot: '#8fa686', base: 700, amp: 60, seed: 21 });
    treesAlong(c, X, f, { seed: 41, size: 54, dens: 0.55, cols: ['#5b7766', '#668272', '#52705f'], dy: 4, broad: 0.2 });
    const f2 = ridgeFn({ base: 770, amp: 36, scale: 380, rough: 0.5, seed: 27 });
    paintRidge(c, X, f2, { col: '#829e72', colBot: '#93a97c', base: 770, amp: 36, seed: 27 });
    treesAlong(c, X, f2, { seed: 43, size: 60, dens: 0.45, cols: ['#587350', '#667f58', '#4f6a4e'], dy: 6, broad: 0.35 });
    // far hamlets
    for (let i = Math.floor((X.x0 - 200) / 700); i <= Math.ceil((X.x1 + 200) / 700); i++) { const r = R2(this, i, 5), hx = i * 700 + r() * 300; if (r() < 0.7) { townRow(c, X, r, hx, hx + 90 + r() * 80, f2(hx) + 20, 20, 34, 0.8, { walls: CIT_PAL.walls, roofs: CIT_PAL.roofs }); X.smoke.push({ x: hx + 40, y: f2(hx) - 12, s: 0.45 }); } }
  },
  dyn(c, E, V) {
    for (let i = 0; i < 3; i++) flock(c, ((E.t * (9 + i) + i * 500) % 3000) - 1000 + V.cam * 0.06, 360 + i * 30, 4, 4, E.t, 'rgba(70,78,96,.55)');
  }
});
const FIELD_COLS = ['#a9b880', '#bcb988', '#9cab74', '#c4b87e', '#90a670', '#b2a56f', '#a7b192', '#b7a982', '#8fa86a'];
addLayer({
  id: 'fields', p: 0.16, q: 0.68, fog: 0.1, mot: 240, brush: 700,
  paint(c, X) {
    const f = ridgeFn({ base: 745, amp: 26, scale: 360, rough: 0.5, seed: 33 });
    paintRidge(c, X, f, { col: '#8fa874', colBot: '#7e9a64', base: 745, amp: 40, seed: 33, flat: true });
    const SL = 120, i0 = Math.floor((X.x0 - BLEED - 200) / SL), i1 = Math.ceil((X.x1 + BLEED + 200) / SL);
    for (let i = i0; i <= i1; i++) {
      const r = R2(this, i), x = i * SL, z = (x + SL / 2) / this.p, zone = zoneAt(z), y0 = f(x) + 16 + (r() * 14), h = 34 + r() * 36, w = SL * (0.9 + r() * 0.6), sk = (r() - 0.5) * 40;
      const wr = zoneW(z, 'river', 500) * (1 - zoneW(z, 'town', 300)); // river ribbon region handled below
      if (zone === 'forest') continue;
      const col = pick(r, FIELD_COLS);
      c.fillStyle = tone(col, 0); c.beginPath(); c.moveTo(x, y0); c.lineTo(x + w, y0); c.lineTo(x + w + sk, y0 + h); c.lineTo(x + sk * 0.3, y0 + h); c.closePath(); c.fill();
      c.save(); c.clip(); c.strokeStyle = 'rgba(60,70,40,.14)'; c.lineWidth = 1.2; for (let q = 1; q < 14; q++) { const t = q / 14; c.beginPath(); c.moveTo(x + w * t, y0); c.lineTo(x + w * t + sk * 0.9, y0 + h); c.stroke(); } c.restore();
      c.strokeStyle = tone('#5d7650', -0.1, 0.8); c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + sk * 0.3, y0 + h); c.lineTo(x + w + sk, y0 + h); c.stroke();
      if (r() < 0.35) bush(c, x + r() * w, y0 + h + 2, 12 + r() * 10, pick(r, ['#587350', '#667f58']), r);
      if (r() < 0.22 && zone !== 'town') { facade2(c, X, r, x + w * 0.5, y0 + h - 4, 40 + r() * 18); }
    }
    // tree belts
    const f2 = ridgeFn({ base: 745, amp: 26, scale: 360, rough: 0.5, seed: 33 });
    treesAlong(c, X, (x) => f2(x) + 4, { seed: 61, step: 34, size: 56, dens: 0.35, cols: ['#587350', '#667f58', '#4f6a4e', '#5f7a5a'], dy: 4, broad: 0.4 });
    // river valley ribbon at the river zone
    const rz = 4880 * this.p;
    if (X.x1 > rz - 300 && X.x0 < rz + 300) { c.fillStyle = '#9fb9c1'; c.beginPath(); c.moveTo(rz - 6, f(rz) + 4); c.bezierCurveTo(rz - 30, 760, rz + 40, 780, rz - 50, 820); c.lineTo(rz + 70, 820); c.bezierCurveTo(rz + 70, 780, rz + 20, 764, rz + 6, f(rz) + 4); c.closePath(); c.fill(); }
  },
  dyn(c, E, V) {
    // far caravan
    const k = ((E.t * 0.012 + 0.3) % 1.2) - 0.1, bx = lerp(-2400, 4200, k) , by = 780;
    for (let i = 0; i < 4; i++) { const x = bx - i * 22; c.fillStyle = i === 0 ? '#d9cdb2' : '#6a5a4a'; c.fillRect(x - 6, by - 9, 12, 7); c.fillStyle = '#5a463a'; c.beginPath(); c.ellipse(x + 14, by - 5, 6, 3, 0, 0, TAU); c.fill(); }
  }
});
/* tiny farmstead used on far fields */
function facade2(c, X, r, x, g, w) {
  const h = w * 0.55, wall = pick(r, PAL.plaster), rf = pick(r, PAL.roofs);
  c.fillStyle = vgrad(c, g - h, g, tone(wall, 0.08), tone(wall, -0.14)); c.fillRect(x - w / 2, g - h, w, h);
  c.fillStyle = vgrad(c, g - h - w * 0.35, g - h, tone(rf, 0.1), tone(rf, -0.14)); c.beginPath(); c.moveTo(x - w * 0.58, g - h); c.lineTo(x, g - h - w * 0.35); c.lineTo(x + w * 0.58, g - h); c.closePath(); c.fill();
  X.light({ kind: 'win', x: x - w * 0.2, y: g - h * 0.7, w: w * 0.14, h: h * 0.28, k: r() < 0.6 ? 0.8 : 0.1, tiny: true });
  X.smoke.push({ x: x + w * 0.2, y: g - h - w * 0.2, s: 0.4 });
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  STAGE SET PIECES   (all in stage coordinates, ground line GY)
 * ═══════════════════════════════════════════════════════════════════════════ */
const MILL = { x: 520, y: GY - 318, len: 200 };
const WMILL = { x: 3262, y: GY - 62, r: 74 };               // watermill wheel
const BR = { x0: 3378, x1: 4382, xc: 3880, H: 130 };          // bridge
const NOTCH = { t0: 3428, t1: 4332, b0: 3000, b1: 4760, bot: 1150 };
const TAV = { x: 8450, w: 560, floors: 3 };
const GUILD = { x: 9330, w: 620 };
const RUIN = { x: 10650 };
const STONES = { x: 11520 };
const GATE = { x: 5420 };
const FOUNTAIN = { x: 7080 };
const noteY = GY - 110;

const notchL = y => lerp(NOTCH.t0, NOTCH.b0, Math.pow(clamp((y - GY) / (NOTCH.bot - GY)), 0.85));
const notchR = y => lerp(NOTCH.t1, NOTCH.b1, Math.pow(clamp((y - GY) / (NOTCH.bot - GY)), 0.85));
const deckY = x => { const u = clamp((x - BR.xc) / ((BR.x1 - BR.x0) / 2), -1, 1); return GY - 4 - BR.H * (1 - u * u); };

function windmill(c, X, x) {
  const r = rngAt(8, 8, 8), g = GY, h = 318, w0 = 120, w1 = 70;
  c.fillStyle = 'rgba(20,24,40,.2)'; c.beginPath(); c.ellipse(x + 20, g + 2, 100, 10, 0, 0, TAU); c.fill();
  c.fillStyle = hgrad(c, x - w0 / 2, x + w0 / 2, '#e1d6bd', '#a89b84', '#cfc3a8'); c.beginPath(); c.moveTo(x - w0 / 2, g); c.lineTo(x - w1 / 2, g - h); c.lineTo(x + w1 / 2, g - h); c.lineTo(x + w0 / 2, g); c.closePath(); c.fill();
  c.save(); c.clip(); for (let i = 0; i < 260; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,244,214,.06)' : 'rgba(60,50,40,.07)'; c.beginPath(); c.ellipse(x + (r() - 0.5) * w0, g - r() * h, 3 + r() * 10, 2 + r() * 5, 0, 0, TAU); c.fill(); }
  c.strokeStyle = 'rgba(70,56,44,.35)'; c.lineWidth = 3; for (const o of [-0.5, 0.5]) { c.beginPath(); c.moveTo(x + o * w0, g); c.lineTo(x + o * w1, g - h); c.stroke(); } for (let i = 1; i < 6; i++) { const yy = g - h * i / 6, ww = lerp(w0, w1, i / 6); c.beginPath(); c.moveTo(x - ww / 2, yy); c.lineTo(x + ww / 2, yy); c.stroke(); }
  c.restore();
  c.fillStyle = '#5a4638'; c.beginPath(); c.moveTo(x - 44, g - h + 2); c.quadraticCurveTo(x, g - h - 70, x + 44, g - h + 2); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,240,210,.14)'; c.beginPath(); c.moveTo(x - 44, g - h + 2); c.quadraticCurveTo(x - 10, g - h - 60, x, g - h - 54); c.lineTo(x - 10, g - h + 2); c.fill();
  c.fillStyle = '#3e3430'; c.beginPath(); c.moveTo(x - 22, g); c.lineTo(x - 22, g - 84); c.arc(x, g - 84, 22, Math.PI, 0); c.lineTo(x + 22, g); c.fill();
  c.fillStyle = '#6a553d'; c.fillRect(x - 54, g - 130, 108, 7); c.strokeStyle = '#6a553d'; c.lineWidth = 3; for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(x - 50 + i * 16.6, g - 123); c.lineTo(x - 50 + i * 16.6, g - 152); c.stroke(); } c.beginPath(); c.moveTo(x - 52, g - 152); c.lineTo(x + 52, g - 152); c.stroke();
  windowAt(c, X, r, x - 9, g - 230, 18, 28, { beam: '#4a3b33', k: 0.9 });
  for (let i = 0; i < 4; i++) sack(c, r, x + 64 + i * 20, g, 22, 28, '#cfc2a4');
}
function farmCottage(c, X, x, w, o = {}) {
  const r = rngAt(x | 0, 4, 4);
  house(c, X, x, GY, Object.assign({ r, w, floors: 1, base: 22, fh: 92, style: 'thatch', wall: '#d9cdb0', roofH: w * 0.46, shutter: '#6a7f6a', litP: 1, door: true, doorLight: true }, o));
  // veg beds, fence
  for (let i = 0; i < 4; i++) { const bx = x + w / 2 + 30 + i * 28; c.fillStyle = '#5a4634'; c.fillRect(bx, GY + 4, 22, 5); for (let q = 0; q < 3; q++) { c.fillStyle = tone(pick(r, ['#6f9a52', '#7a9a62', '#8aaa5a']), 0); c.beginPath(); c.arc(bx + 4 + q * 7, GY - 2, 6, 0, TAU); c.fill(); } }
}
function barn(c, X, x) {
  const r = rngAt(9, 9, 9), w = 340, h = 190, g = GY;
  c.fillStyle = 'rgba(20,24,40,.2)'; c.beginPath(); c.ellipse(x, g + 2, w * 0.6, 10, 0, 0, TAU); c.fill();
  const wood = '#8a5a4a'; c.fillStyle = vgrad(c, g - h, g, tone(wood, 0.1), tone(wood, -0.2)); c.fillRect(x - w / 2, g - h, w, h);
  for (let i = 0; i < w / 12; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,230,200' : '40,24,20'},${0.04 + r() * 0.08})`; c.fillRect(x - w / 2 + i * 12, g - h, 5 + r() * 5, h); c.fillStyle = 'rgba(30,18,14,.4)'; c.fillRect(x - w / 2 + i * 12, g - h, 1.2, h); }
  c.fillStyle = 'rgba(28,34,64,.14)'; c.fillRect(x + w * 0.3, g - h, w * 0.2, h);
  // gambrel roof
  const rf = '#5d5660', pts = [[x - w / 2 - 14, g - h], [x - w * 0.34, g - h - 70], [x, g - h - 110], [x + w * 0.34, g - h - 70], [x + w / 2 + 14, g - h]];
  c.fillStyle = vgrad(c, g - h - 110, g - h, tone(rf, 0.1), tone(rf, -0.14)); c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill();
  tiles(c, r, pts, rf, 10, 14, { moss: true }); c.strokeStyle = tone(rf, -0.4); c.lineWidth = 4; c.lineJoin = 'round'; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
  // big doors with X braces, loft door
  const dw = 120, dh = 120; c.fillStyle = tone(wood, -0.25); c.fillRect(x - dw / 2, g - dh, dw, dh); c.strokeStyle = '#d8cbb0'; c.lineWidth = 6; c.strokeRect(x - dw / 2, g - dh, dw, dh); c.beginPath(); c.moveTo(x - dw / 2, g - dh); c.lineTo(x, g); c.lineTo(x + dw / 2, g - dh); c.moveTo(x - dw / 2, g); c.lineTo(x, g - dh); c.lineTo(x + dw / 2, g); c.stroke(); c.beginPath(); c.moveTo(x, g - dh); c.lineTo(x, g); c.stroke();
  c.fillStyle = '#2a201c'; c.fillRect(x - 28, g - h - 22, 56, 50); c.strokeStyle = '#d8cbb0'; c.lineWidth = 4; c.strokeRect(x - 28, g - h - 22, 56, 50); c.fillStyle = '#b6a27a'; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x - 24 + i * 9, g - h + 26); c.lineTo(x - 22 + i * 9, g - h + 10); c.lineTo(x - 18 + i * 9, g - h + 26); c.fill(); }
  X.light({ kind: 'win', x: x - 22, y: g - h - 16, w: 44, h: 38, k: 0.5 });
  // haystacks
  for (const hx of [x + 250, x + 320, x - 270]) { c.fillStyle = vgrad(c, g - 90, g, '#d9b868', '#b08a42'); c.beginPath(); c.moveTo(hx - 42, g); c.quadraticCurveTo(hx - 40, g - 60, hx, g - 96); c.quadraticCurveTo(hx + 40, g - 60, hx + 42, g); c.closePath(); c.fill(); for (let i = 0; i < 40; i++) { c.strokeStyle = r() < 0.5 ? 'rgba(255,236,160,.35)' : 'rgba(110,80,30,.3)'; c.lineWidth = 1; const yy = g - r() * 90; c.beginPath(); c.moveTo(hx - 20 + r() * 40, yy); c.lineTo(hx - 20 + r() * 40 + 8, yy + 6); c.stroke(); } }
}
function fenceRun(c, r, x0, x1, g, h = 46) {
  c.strokeStyle = '#5a4637'; c.lineWidth = 5; for (let x = x0; x <= x1; x += 54) { c.beginPath(); c.moveTo(x, g + 2); c.lineTo(x, g - h); c.stroke(); }
  c.lineWidth = 4; for (const hh of [h * 0.35, h * 0.8]) { c.beginPath(); c.moveTo(x0, g - hh); c.lineTo(x1, g - hh); c.stroke(); }
  c.strokeStyle = 'rgba(255,240,210,.18)'; c.lineWidth = 1.2; for (const hh of [h * 0.35, h * 0.8]) { c.beginPath(); c.moveTo(x0, g - hh - 1.5); c.lineTo(x1, g - hh - 1.5); c.stroke(); }
}
function signpost(c, x, g) {
  c.fillStyle = '#5b4637'; c.fillRect(x - 4, g - 150, 8, 150);
  [[-1, 0, 'town'], [1, 30, 'mill']].forEach(a => { c.fillStyle = '#7c6248'; c.beginPath(); c.moveTo(x, g - 140 + a[1]); c.lineTo(x + a[0] * 74, g - 140 + a[1]); c.lineTo(x + a[0] * 88, g - 128 + a[1]); c.lineTo(x + a[0] * 74, g - 116 + a[1]); c.lineTo(x, g - 116 + a[1]); c.closePath(); c.fill(); c.fillStyle = 'rgba(30,20,10,.5)'; for (let i = 0; i < 3; i++) c.fillRect(x + a[0] * (14 + i * 15) - 3, g - 131 + a[1], 7, 3); });
}
function well(c, X, x, g) {
  const r = rngAt(x | 0, 2, 2); c.fillStyle = 'rgba(20,24,40,.2)'; c.beginPath(); c.ellipse(x, g + 2, 52, 7, 0, 0, TAU); c.fill();
  c.fillStyle = hgrad(c, x - 38, x + 38, '#b9b2a4', '#7e786e', '#a8a193'); c.fillRect(x - 38, g - 46, 76, 46); blocks(c, r, x - 38, g - 46, 76, 46, '#a8a193', 18, 11, 0.4); c.fillStyle = '#c9c3b4'; c.beginPath(); c.ellipse(x, g - 46, 38, 8, 0, 0, TAU); c.fill(); c.fillStyle = '#2a3440'; c.beginPath(); c.ellipse(x, g - 46, 30, 5.5, 0, 0, TAU); c.fill();
  c.strokeStyle = '#5a4637'; c.lineWidth = 6; c.beginPath(); c.moveTo(x - 32, g - 46); c.lineTo(x - 32, g - 112); c.moveTo(x + 32, g - 46); c.lineTo(x + 32, g - 112); c.stroke(); c.fillStyle = '#7a5446'; c.beginPath(); c.moveTo(x - 50, g - 108); c.lineTo(x, g - 142); c.lineTo(x + 50, g - 108); c.closePath(); c.fill(); tiles(c, r, [[x - 50, g - 108], [x, g - 142], [x + 50, g - 108]], '#7a5446', 3, 10);
  c.strokeStyle = '#4a3a2c'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, g - 106); c.lineTo(x, g - 72); c.stroke(); c.fillStyle = '#6a5240'; c.fillRect(x - 8, g - 72, 16, 12);
}

/* ───── river & bridge ───── */
function riverWater(c, X, r) {
  const bot = NOTCH.bot, N = 26;
  c.beginPath(); for (let i = 0; i <= N; i++) { const y = GY + 6 + (bot - GY - 6) * i / N; i ? c.lineTo(notchL(y), y) : c.moveTo(notchL(y), y); } for (let i = N; i >= 0; i--) { const y = GY + 6 + (bot - GY - 6) * i / N; c.lineTo(notchR(y), y); } c.closePath();
  c.save(); c.fillStyle = vgrad(c, GY, bot, '#8fb3b4', '#3f6a6e'); c.fill(); c.clip();
  for (let i = 0; i < 80; i++) { const y = GY + 14 + Math.pow(r(), 1.4) * (bot - GY - 14), x = lerp(notchL(y), notchR(y), r()), l = 20 + r() * 70 * (0.4 + (y - GY) / 340); c.strokeStyle = `rgba(${r() < 0.5 ? '230,246,246' : '30,60,66'},${0.1 + r() * 0.12})`; c.lineWidth = 1 + (y - GY) / 160; c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y + (r() - 0.5) * 2); c.stroke(); }
  for (let i = 0; i < 22; i++) { const y = GY + 40 + r() * (bot - GY - 60), x = lerp(notchL(y), notchR(y), r()), s = 8 + (y - GY) / 14; c.fillStyle = 'rgba(86,130,70,.7)'; c.beginPath(); c.ellipse(x, y, s, s * 0.35, 0, 0, TAU); c.fill(); if (r() < 0.4) { c.fillStyle = 'rgba(240,200,220,.9)'; c.beginPath(); c.arc(x + s * 0.2, y - 1, s * 0.22, 0, TAU); c.fill(); } }
  c.restore();
  // banks: stones, grass lip, reeds
  for (const side of [-1, 1]) for (let i = 0; i < 46; i++) { const y = GY + 4 + (bot - GY) * Math.pow(r(), 1.2), x = (side < 0 ? notchL(y) : notchR(y)) + (r() - 0.5) * 20; if (r() < 0.45) rock(c, x, y + 4, 6 + r() * 12 * (0.5 + (y - GY) / 300), '#8a877e', r); else grassBlades(c, r, x - 20, x + 20, y + 4, 8, 26, 5, '#5a8250'); }
  for (let i = 0; i < 14; i++) { const side = r() < 0.5 ? -1 : 1, y = GY + 20 + r() * 240, x = (side < 0 ? notchL(y) : notchR(y)) + side * (-10 + r() * 20); reeds(c, r, x, y + 6, 40, 60 + (y - GY) * 0.3, 8, '#6a8a52'); }
}
function bridge(c, X) {
  const r = rngAt(12, 12, 12), st = '#aaa398', x0 = BR.x0, x1 = BR.x1, wl = GY + 10;
  const N = 60; c.beginPath(); c.moveTo(x0, wl); for (let i = 0; i <= N; i++) { const x = lerp(x0, x1, i / N); c.lineTo(x, deckY(x)); } c.lineTo(x1, wl); c.closePath();
  c.fillStyle = vgrad(c, GY - BR.H - 10, wl, tone(st, 0.1), tone(st, -0.22)); c.fill();
  c.save(); c.clip(); blocks(c, r, x0, GY - BR.H - 20, x1 - x0, BR.H + 40, st, 36, 21, 0.45);
  c.fillStyle = 'rgba(86,130,70,.3)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(x0 + r() * (x1 - x0), wl - r() * 50, 8 + r() * 20, 3 + r() * 6, 0, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(28,34,64,.12)'; c.fillRect(x0 + (x1 - x0) * 0.8, GY - BR.H - 20, (x1 - x0) * 0.2, BR.H + 40);
  // arches: cut out so the far river shows through
  c.globalCompositeOperation = 'destination-out';
  [[3540, 108, 50], [3880, 150, 96], [4220, 108, 50]].forEach(a => { c.beginPath(); c.moveTo(a[0] - a[1], wl + 20); c.lineTo(a[0] - a[1], wl - 4); c.ellipse(a[0], wl - 4, a[1], a[2] + 4, 0, Math.PI, 0); c.lineTo(a[0] + a[1], wl + 20); c.closePath(); c.fill(); });
  c.globalCompositeOperation = 'source-over';
  // voussoirs
  [[3540, 108, 50], [3880, 150, 96], [4220, 108, 50]].forEach(a => { c.strokeStyle = tone(st, 0.1, 0.9); c.lineWidth = 11; c.beginPath(); c.ellipse(a[0], wl - 4, a[1] + 5, a[2] + 8, 0, Math.PI, 0); c.stroke(); c.strokeStyle = 'rgba(30,30,40,.35)'; c.lineWidth = 1.5; for (let i = 0; i <= 14; i++) { const ang = Math.PI + i * Math.PI / 14; c.beginPath(); c.moveTo(a[0] + Math.cos(ang) * (a[1] - 1), wl - 4 + Math.sin(ang) * (a[2] - 1)); c.lineTo(a[0] + Math.cos(ang) * (a[1] + 11), wl - 4 + Math.sin(ang) * (a[2] + 17)); c.stroke(); } });
  c.restore();
  // parapet, cap stones
  c.strokeStyle = tone(st, -0.06); c.lineWidth = 24; c.lineCap = 'butt'; c.beginPath(); for (let i = 0; i <= N; i++) { const x = lerp(x0, x1, i / N), y = deckY(x) - 12; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
  c.strokeStyle = 'rgba(30,30,40,.25)'; c.lineWidth = 1.4; for (let i = 0; i <= N * 2; i++) { const x = lerp(x0, x1, i / (N * 2)), y = deckY(x); c.beginPath(); c.moveTo(x, y - 1); c.lineTo(x, y - 23); c.stroke(); }
  c.strokeStyle = tone(st, 0.18); c.lineWidth = 6; c.beginPath(); for (let i = 0; i <= N; i++) { const x = lerp(x0, x1, i / N), y = deckY(x) - 25; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
  [3520, 3880, 4240].forEach(x => { const y = deckY(x); c.fillStyle = tone(st, -0.05); c.fillRect(x - 13, y - 56, 26, 44); c.fillStyle = tone(st, 0.15); c.fillRect(x - 16, y - 62, 32, 8); });
  [3700, 4060].forEach(x => lampPost(c, X, x, deckY(x) - 16, 110, 1));
  for (let i = 0; i < 12; i++) { const x = lerp(x0 + 30, x1 - 30, r()), y = deckY(x); c.strokeStyle = '#5a8250'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 24); c.quadraticCurveTo(x + 4, y - 4, x - 3, y + 16); c.stroke(); }
}
function watermill(c, X, x) {
  const r = rngAt(14, 14, 14);
  house(c, X, x, GY, { r, w: 250, floors: 3, base: 40, fh: 84, style: 'gable', wall: '#d2c6aa', roof: '#6e5b56', shutter: '#5f7a6e', litP: 0.9, door: true, doorLight: true, jetty: false, stone: '#8f897e' });
  // mill race pond and wheel mount
  c.fillStyle = vgrad(c, GY - 4, GY + 36, '#7fa4a8', '#4f787c'); c.beginPath(); c.moveTo(x + 125, GY); c.lineTo(WMILL.x + 80, GY); c.lineTo(WMILL.x + 90, GY + 30); c.quadraticCurveTo(x + 150, GY + 48, x + 125, GY + 36); c.closePath(); c.fill();
}

/* ───── town gate ───── */
function gatehouse(c, X, cx) {
  const r = rngAt(15, 15, 15), g = GY + 8, stone = '#a8a193', wt = g - 380, wallH = 380;
  const x0 = X.x0 - BLEED, x1 = X.x1 + BLEED;
  // curtain wall running both sides
  const wx0 = Math.max(x0, cx - 760), wx1 = Math.min(x1, cx + 760);
  if (wx1 > wx0) {
    c.fillStyle = vgrad(c, wt, g, tone(stone, 0.06), tone(stone, -0.22)); c.fillRect(wx0, wt, wx1 - wx0, wallH);
    blocks(c, r, wx0, wt, wx1 - wx0, wallH, stone, 38, 22, 0.5);
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(48,54,72,${0.04 + r() * 0.06})`; c.fillRect(wx0 + r() * (wx1 - wx0), wt + r() * wallH * 0.5, 2 + r() * 6, 30 + r() * 150); }
    c.fillStyle = vgrad(c, wt, wt + 60, 'rgba(20,20,32,.28)', 'rgba(20,20,32,0)'); c.fillRect(wx0, wt, wx1 - wx0, 60);
    c.fillStyle = 'rgba(86,130,70,.2)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(wx0 + r() * (wx1 - wx0), g - r() * 40, 8 + r() * 20, 3 + r() * 7, 0, 0, TAU); c.fill(); }
    crenels(c, wx0, wx1, wt, 28, 26, tone(stone, -0.06));
    for (let x = cx - 760 + 80; x < cx + 760; x += 190) { if (Math.abs(x - cx) < 330) continue; c.fillStyle = 'rgba(24,26,38,.78)'; c.fillRect(x, wt + 90, 6, 40); }
    for (const tx of [cx - 760, cx + 760]) if (tx > x0 - 100 && tx < x1 + 100) towerR(c, X, r, tx, g, 120, 440, stone, '#5f5a6a', 150, { slits: 3, lit: 0.6, flag: '#8d5a52' });
  }
  // gatehouse
  if (cx + 360 > x0 && cx - 360 < x1) {
    const gh = 560; c.fillStyle = vgrad(c, g - gh, g, tone(stone, 0.1), tone(stone, -0.2)); c.fillRect(cx - 200, g - gh, 400, gh); blocks(c, r, cx - 200, g - gh, 400, gh, stone, 38, 22, 0.45);
    c.fillStyle = tone(stone, -0.22); c.fillRect(cx - 214, g - gh - 8, 428, 22); for (let x = cx - 205; x < cx + 200; x += 20) c.fillRect(x, g - gh + 12, 8, 14); crenels(c, cx - 214, cx + 214, g - gh - 8, 22, 24, tone(stone, -0.08));
    for (const sd of [-1, 1]) towerR(c, X, r, cx + sd * 218, g, 150, 650, stone, '#5f5a6a', 190, { slits: 3, lit: 0.7, flag: '#8d5a52', blocks: true });
    const ar = 100, ay = g - 190;
    for (let i = 0; i < 15; i++) { const a0 = Math.PI + i * Math.PI / 15, a1 = a0 + Math.PI / 15, ro = ar + 34; c.fillStyle = tone(stone, (r() - 0.5) * 0.22 + 0.04); c.beginPath(); c.moveTo(cx + Math.cos(a0) * ar, ay + Math.sin(a0) * ar); c.lineTo(cx + Math.cos(a0) * ro, ay + Math.sin(a0) * ro); c.lineTo(cx + Math.cos(a1) * ro, ay + Math.sin(a1) * ro); c.lineTo(cx + Math.cos(a1) * ar, ay + Math.sin(a1) * ar); c.closePath(); c.fill(); c.strokeStyle = 'rgba(30,30,40,.3)'; c.lineWidth = 1.2; c.stroke(); }
    c.fillStyle = tone(stone, -0.1); c.fillRect(cx - ar - 34, ay, 34, 190); c.fillRect(cx + ar, ay, 34, 190);
    // glimpse of the lit street within
    c.save(); c.beginPath(); c.moveTo(cx - ar, g); c.lineTo(cx - ar, ay); c.arc(cx, ay, ar, Math.PI, 0); c.lineTo(cx + ar, g); c.closePath(); c.clip();
    c.fillStyle = vgrad(c, g - 290, g, '#f3ddb0', '#c7a97a'); c.fillRect(cx - ar, g - 290, ar * 2, 290);
    for (let i = 0; i < 6; i++) { const hx0 = cx - ar + (i * 0.17 + r() * 0.05) * ar * 2, hh = 60 + r() * 70, hw = 34 + r() * 24; c.fillStyle = tone(pick(r, PAL.plaster), -0.05 - i * 0.02); c.fillRect(hx0, g - 55 - hh, hw, hh); c.fillStyle = tone(pick(r, PAL.roofs), -0.08); c.beginPath(); c.moveTo(hx0 - 4, g - 55 - hh); c.lineTo(hx0 + hw / 2, g - 55 - hh - hw * 0.5); c.lineTo(hx0 + hw + 4, g - 55 - hh); c.closePath(); c.fill(); }
    c.fillStyle = vgrad(c, g - 60, g, '#c9b48a', '#8a7556'); c.fillRect(cx - ar, g - 60, ar * 2, 60);
    c.fillStyle = vgrad(c, g - 290, g - 120, 'rgba(14,12,20,.9)', 'rgba(14,12,20,0)'); c.fillRect(cx - ar, g - 290, ar * 2, 190);
    const sg = c.createLinearGradient(cx - ar, 0, cx + ar, 0); sg.addColorStop(0, 'rgba(14,12,20,.75)'); sg.addColorStop(0.2, 'rgba(14,12,20,0)'); sg.addColorStop(0.8, 'rgba(14,12,20,0)'); sg.addColorStop(1, 'rgba(14,12,20,.75)'); c.fillStyle = sg; c.fillRect(cx - ar, g - 290, ar * 2, 290);
    c.strokeStyle = '#2b2622'; c.lineWidth = 5; for (let x = cx - ar + 12; x < cx + ar; x += 17) { c.beginPath(); c.moveTo(x, g - 292); c.lineTo(x, g - 168); c.stroke(); c.fillStyle = '#2b2622'; c.beginPath(); c.moveTo(x - 3, g - 168); c.lineTo(x, g - 150); c.lineTo(x + 3, g - 168); c.fill(); }
    c.lineWidth = 4; for (let y = g - 270; y < g - 170; y += 38) { c.beginPath(); c.moveTo(cx - ar, y); c.lineTo(cx + ar, y); c.stroke(); }
    c.restore();
    emblem(c, cx, g - 395, 46);
    for (const sd of [-1, 1]) { c.fillStyle = '#2f2824'; c.fillRect(cx + sd * 150 - 3, g - 160, 6, 32); X.light({ kind: 'fire', x: cx + sd * 150 - 7, y: g - 184, w: 14, h: 14, r: 7, k: 0.9 }); }
    banner(c, cx - 300, wt + 14, 74, 270, '#7a4d4a'); banner(c, cx + 300, wt + 14, 74, 270, '#7a4d4a'); banner(c, cx - 520, wt + 14, 70, 250, '#4d5f7a'); banner(c, cx + 520, wt + 14, 70, 250, '#4d5f7a');
  }
}
function emblem(c, x, y, r) {
  c.fillStyle = '#3d4d68'; c.beginPath(); c.moveTo(x - r * 0.8, y - r); c.lineTo(x + r * 0.8, y - r); c.lineTo(x + r * 0.8, y + r * 0.1); c.quadraticCurveTo(x + r * 0.7, y + r * 0.9, x, y + r * 1.25); c.quadraticCurveTo(x - r * 0.7, y + r * 0.9, x - r * 0.8, y + r * 0.1); c.closePath(); c.fill();
  c.strokeStyle = '#c6a760'; c.lineWidth = r * 0.12; c.stroke(); c.strokeStyle = '#cfd3d6'; c.lineWidth = r * 0.13; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - r * 0.55, y + r * 0.55); c.lineTo(x + r * 0.55, y - r * 0.6); c.moveTo(x + r * 0.55, y + r * 0.55); c.lineTo(x - r * 0.55, y - r * 0.6); c.stroke();
  c.fillStyle = '#d9bb70'; c.beginPath(); c.moveTo(x, y - r * 0.38); c.lineTo(x + r * 0.15, y); c.lineTo(x, y + r * 0.38); c.lineTo(x - r * 0.15, y); c.closePath(); c.fill();
}
function banner(c, x, y, w, h, col) {
  c.fillStyle = col; c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.lineTo(x, y + h - w * 0.35); c.lineTo(x - w / 2, y + h); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,240,210,.12)'; c.fillRect(x - w / 2, y, w * 0.4, h * 0.9);
  c.strokeStyle = '#c6a760'; c.lineWidth = Math.max(1, w * 0.05); c.beginPath(); c.moveTo(x - w / 2 + w * 0.08, y + h * 0.04); c.lineTo(x + w / 2 - w * 0.08, y + h * 0.04); c.stroke();
  c.fillStyle = '#cdb26c'; c.beginPath(); c.arc(x, y + h * 0.3, w * 0.2, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(x, y + h * 0.3, w * 0.12, 0, TAU); c.fill();
}

/* ───── fountain plaza ───── */
function fountain(c, X, x) {
  const g = GY + 34, r = rngAt(21, 21, 21);
  c.fillStyle = 'rgba(20,25,40,.2)'; c.beginPath(); c.ellipse(x, g + 6, 150, 18, 0, 0, TAU); c.fill();
  c.fillStyle = vgrad(c, g - 50, g + 14, '#c2bdb0', '#8a857a'); c.beginPath(); c.moveTo(x - 140, g - 20); c.lineTo(x - 130, g + 10); c.quadraticCurveTo(x, g + 30, x + 130, g + 10); c.lineTo(x + 140, g - 20); c.closePath(); c.fill(); blocks(c, r, x - 138, g - 20, 276, 30, '#a8a193', 22, 11, 0.35);
  c.fillStyle = '#cfcabb'; c.beginPath(); c.ellipse(x, g - 20, 140, 26, 0, 0, TAU); c.fill(); c.fillStyle = '#7fb0b4'; c.beginPath(); c.ellipse(x, g - 20, 124, 20, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(x - 30, g - 24, 70, 6, 0, 0, TAU); c.fill();
  c.fillStyle = hgrad(c, x - 14, x + 14, '#cfcabb', '#8a857a'); c.fillRect(x - 12, g - 130, 24, 112);
  c.fillStyle = '#c2bdb0'; c.beginPath(); c.ellipse(x, g - 100, 52, 12, 0, 0, TAU); c.fill(); c.fillStyle = '#86b6ba'; c.beginPath(); c.ellipse(x, g - 100, 44, 8, 0, 0, TAU); c.fill();
  c.fillStyle = '#b8b3a6'; c.fillRect(x - 6, g - 150, 12, 40); c.beginPath(); c.arc(x, g - 160, 12, 0, TAU); c.fill(); c.fillStyle = '#9aa8b8'; c.beginPath(); c.moveTo(x - 4, g - 172); c.lineTo(x + 24, g - 190); c.lineTo(x + 10, g - 160); c.closePath(); c.fill();
}

/* ───── tavern ───── */
function tavern(c, X, cx) {
  const r = rngAt(33, 33, 33), g = GY, w = TAV.w;
  const fc = house(c, X, cx, g, { r, w, floors: 3, base: 62, fh: 96, style: 'gable', wall: '#c4b394', roof: '#5e4a45', roofH: 250, litP: 1, k: 1.25, doorLight: true, shutter: null, jetty: true, ov: 26, attic: true, doorBay: 3, lantern: false, chimney: true });
  for (let i = 0; i < 3; i++) { const dx = cx + (i - 1) * 150, top = fc.gfTop - 96 * 2 - 150; }
  // porch roof, lamps, tables
  c.fillStyle = tone('#7a4a3e', 0); c.beginPath(); c.moveTo(cx - 100 + 0, g - 150); c.lineTo(cx + 100 + 0, g - 150); c.lineTo(cx + 116, g - 118); c.lineTo(cx - 116, g - 118); c.closePath(); c.fill();
  for (const sd of [-1, 1]) { const lx = cx + sd * 130 + 0, ly = g - 128; c.strokeStyle = '#2f2b2e'; c.lineWidth = 4; c.beginPath(); c.moveTo(lx, ly - 30); c.lineTo(lx, ly + 8); c.stroke(); c.fillStyle = '#6e5a3c'; c.fillRect(lx - 8, ly + 6, 16, 20); X.light({ kind: 'lamp', x: lx - 7, y: ly + 8, w: 14, h: 14, r: 6, k: 1.2 }); }
  barrel(c, cx - 330, g + 4, 50); barrel(c, cx - 285, g + 8, 44); crateStack(c, r, cx - 380, g + 4, 2, 36);
  // outdoor tables & benches
  for (const tx of [cx + 360, cx + 470]) { c.fillStyle = '#5a4637'; c.fillRect(tx - 36, g - 36, 72, 7); c.fillRect(tx - 30, g - 29, 6, 29); c.fillRect(tx + 24, g - 29, 6, 29); c.fillStyle = '#d8cdb4'; c.beginPath(); c.ellipse(tx - 10, g - 42, 7, 3, 0, 0, TAU); c.fill(); c.fillStyle = '#b9714c'; c.fillRect(tx + 8, g - 50, 6, 14); }
  // hanging sign bracket
  const sx = cx + w / 2 + 6, sy = g - 330; c.strokeStyle = '#2b2628'; c.lineWidth = 5; c.beginPath(); c.moveTo(cx + w / 2 - 22, sy); c.lineTo(sx + 78, sy); c.quadraticCurveTo(sx + 88, sy - 22, sx + 62, sy - 28); c.stroke();
}
function tavernSign(c, E, x, y) {
  const sw = Math.sin(E.t * 1.5) * (0.05 + E.wind * 0.06);
  c.save(); c.translate(x, y); c.rotate(sw); c.strokeStyle = '#2b2628'; c.lineWidth = 2; c.beginPath(); c.moveTo(-26, 0); c.lineTo(-26, 22); c.moveTo(26, 0); c.lineTo(26, 22); c.stroke();
  c.fillStyle = '#4b3a2e'; c.fillRect(-36, 22, 72, 72); c.strokeStyle = '#c3a56a'; c.lineWidth = 3; c.strokeRect(-36, 22, 72, 72);
  c.fillStyle = '#d8c28a'; c.fillRect(-14, 40, 24, 36); c.fillStyle = '#f2ecd6'; c.beginPath(); c.ellipse(-2, 40, 14, 6, 0, 0, TAU); c.fill(); c.strokeStyle = '#d8c28a'; c.lineWidth = 4; c.beginPath(); c.arc(14, 58, 8, -1.4, 1.4); c.stroke();
  c.restore();
}

/* ───── guild hall, quest board, training yard ───── */
function guild(c, X, cx) {
  const r = rngAt(34, 34, 34), g = GY, w = GUILD.w;
  const fc = house(c, X, cx, g, { r, w, floors: 3, base: 150, fh: 98, style: 'gable', wall: '#aaa292', roof: '#58525e', roofH: 280, litP: 0.9, k: 1.2, door: false, stone: '#8d877b', ov: 34, shutter: null, attic: false, jetty: false });
  emblem(c, cx, fc.top + 160, 64);
  const dw = 150, dh = 220; c.fillStyle = tone('#a69d8f', 0); c.fillRect(cx - dw / 2 - 22, g - dh - 22, dw + 44, dh + 22);
  c.fillStyle = '#2d2420'; c.beginPath(); c.moveTo(cx - dw / 2, g); c.lineTo(cx - dw / 2, g - dh * 0.72); c.quadraticCurveTo(cx, g - dh * 1.25, cx + dw / 2, g - dh * 0.72); c.lineTo(cx + dw / 2, g); c.closePath(); c.fill();
  X.light({ kind: 'door', x: cx - dw / 2 + 8, y: g - dh * 0.98, w: dw - 16, h: dh * 0.98, k: 1.3, door: true });
  for (const sd of [-1, 1]) { const tx = cx + sd * (dw / 2 + 40); c.fillStyle = '#2f2824'; c.fillRect(tx - 3, g - 170, 6, 40); X.light({ kind: 'fire', x: tx - 8, y: g - 200, w: 16, h: 16, r: 8, k: 1.2 }); banner(c, cx + sd * 320, g - 470, 64, 230, sd < 0 ? '#7a4d4a' : '#4d5f7a'); }
  // stone steps
  c.fillStyle = '#8a8478'; for (let i = 0; i < 3; i++) c.fillRect(cx - (80 + i * 14), g - (3 - i) * 7 + 4, 160 + i * 28, 7);
}
function questBoard(c, X, bx) {
  const r = rngAt(35, 35, 35), g = GY + 20, by = g - 250;
  c.fillStyle = '#4a3a2e'; c.fillRect(bx - 100, by + 100, 8, 150); c.fillRect(bx + 92, by + 100, 8, 150); c.fillStyle = '#6b5240'; c.fillRect(bx - 112, by - 12, 224, 156); c.fillStyle = '#7d634c'; c.fillRect(bx - 103, by - 3, 206, 138);
  c.fillStyle = '#3f2f24'; c.beginPath(); c.moveTo(bx - 120, by - 12); c.lineTo(bx, by - 46); c.lineTo(bx + 120, by - 12); c.closePath(); c.fill();
  for (let i = 0; i < 12; i++) { const nx = bx - 94 + (i % 4) * 48 + r() * 8, ny = by + 6 + Math.floor(i / 4) * 42 + r() * 6; c.fillStyle = pick(r, ['#e1d4b0', '#d8caa4', '#e8dcc0']); c.save(); c.translate(nx + 15, ny); c.rotate((r() - 0.5) * 0.1); c.fillRect(-15, 0, 30, 34); c.fillStyle = 'rgba(70,52,40,.5)'; for (let q = 0; q < 4; q++) c.fillRect(-11, 7 + q * 7, 22 - (q % 2) * 8, 2); c.fillStyle = '#a8584a'; c.beginPath(); c.arc(0, 2, 3, 0, TAU); c.fill(); c.restore(); }
  c.strokeStyle = '#2f2b2e'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx + 100, by - 6); c.lineTo(bx + 140, by - 6); c.lineTo(bx + 140, by + 20); c.stroke();
  X.light({ kind: 'lamp', x: bx + 133, y: by + 18, w: 14, h: 14, r: 6, k: 1.1 });
}
function trainingYard(c, X, x) {
  const r = rngAt(36, 36, 36), g = GY + 10;
  c.strokeStyle = '#5a4637'; c.lineWidth = 6; for (let i = 0; i < 7; i++) { const fx = x - 180 + i * 62; c.beginPath(); c.moveTo(fx, g); c.lineTo(fx, g - 80); c.stroke(); } c.lineWidth = 5; for (const hh of [30, 62]) { c.beginPath(); c.moveTo(x - 186, g - hh); c.lineTo(x + 196, g - hh); c.stroke(); }
  // dummy
  c.strokeStyle = '#4a3a2e'; c.lineWidth = 8; c.beginPath(); c.moveTo(x - 70, g + 8); c.lineTo(x - 70, g - 150); c.stroke(); c.lineWidth = 6; c.beginPath(); c.moveTo(x - 104, g - 122); c.lineTo(x - 36, g - 122); c.stroke(); c.fillStyle = '#b09a70'; c.beginPath(); c.arc(x - 70, g - 164, 16, 0, TAU); c.fill(); c.fillStyle = '#9a8460'; c.fillRect(x - 84, g - 124, 28, 52);
  // archery target
  c.strokeStyle = '#4a3a2e'; c.lineWidth = 7; c.beginPath(); c.moveTo(x + 70, g + 6); c.lineTo(x + 100, g - 96); c.moveTo(x + 130, g + 6); c.lineTo(x + 100, g - 96); c.stroke(); c.fillStyle = '#d9cfae'; c.beginPath(); c.arc(x + 100, g - 118, 38, 0, TAU); c.fill(); [30, 20, 10].forEach((rr, i) => { c.fillStyle = ['#a8574a', '#e8e0c6', '#a8574a'][i]; c.beginPath(); c.arc(x + 100, g - 118, rr, 0, TAU); c.fill(); }); c.strokeStyle = '#6a4a30'; c.lineWidth = 2; for (const a of [[-8, -6], [6, 4], [-2, 10]]) { c.beginPath(); c.moveTo(x + 100 + a[0], g - 118 + a[1]); c.lineTo(x + 100 + a[0] - 14, g - 118 + a[1] - 8); c.stroke(); }
  // weapon rack
  c.fillStyle = '#5a4637'; c.fillRect(x + 160, g - 80, 70, 6); c.fillRect(x + 160, g - 80, 5, 80); c.fillRect(x + 225, g - 80, 5, 80); c.strokeStyle = '#aab0b8'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x + 172 + i * 14, g - 78); c.lineTo(x + 176 + i * 14, g - 8); c.stroke(); }
}

/* ───── forest ruins: arch with glyphs, stones, shrine ───── */
function glyph(c, x, y, s, r) {
  c.strokeStyle = '#9fe8f4'; c.lineWidth = Math.max(1.4, s * 0.09); c.lineCap = 'round'; c.beginPath();
  const k = (r() * 4) | 0; if (k === 0) { c.arc(x, y, s * 0.4, 0, TAU); c.moveTo(x, y - s * 0.4); c.lineTo(x, y + s * 0.4); } else if (k === 1) { c.moveTo(x - s * 0.4, y + s * 0.3); c.lineTo(x, y - s * 0.45); c.lineTo(x + s * 0.4, y + s * 0.3); c.closePath(); c.moveTo(x, y - s * 0.1); c.lineTo(x, y + s * 0.3); } else if (k === 2) { c.moveTo(x - s * 0.4, y - s * 0.3); c.lineTo(x + s * 0.4, y + s * 0.3); c.moveTo(x + s * 0.4, y - s * 0.3); c.lineTo(x - s * 0.4, y + s * 0.3); c.moveTo(x, y - s * 0.45); c.lineTo(x, y + s * 0.45); } else { c.rect(x - s * 0.3, y - s * 0.3, s * 0.6, s * 0.6); c.moveTo(x - s * 0.3, y); c.lineTo(x + s * 0.3, y); }
  c.stroke();
}
function ruins(c, X, x) {
  const r = rngAt(41, 41, 41), g = GY + 6, st = '#8a8e92';
  c.fillStyle = 'rgba(14,20,24,.28)'; c.beginPath(); c.ellipse(x, g + 2, 300, 14, 0, 0, TAU); c.fill();
  // paving
  for (let i = 0; i < 18; i++) { c.fillStyle = tone(st, (r() - 0.5) * 0.2, 0.8); c.beginPath(); c.ellipse(x - 240 + i * 28, g + 8 + (i % 3) * 6, 18 + r() * 8, 5, 0, 0, TAU); c.fill(); }
  const pil = (px, h) => { c.fillStyle = hgrad(c, px - 32, px + 32, tone(st, 0.14), tone(st, -0.3), st); c.fillRect(px - 32, g - h, 64, h); blocks(c, r, px - 32, g - h, 64, h, st, 64, 26, 0.3); c.fillStyle = tone(st, 0.05); c.fillRect(px - 40, g - h - 10, 80, 14); c.fillRect(px - 40, g - 12, 80, 12); };
  pil(x - 150, 340); pil(x + 150, 250);
  c.strokeStyle = tone(st, 0.02); c.lineWidth = 56; c.beginPath(); c.arc(x, g - 340, 150, Math.PI, Math.PI * 1.7); c.stroke(); c.strokeStyle = 'rgba(20,24,34,.35)'; c.lineWidth = 3; c.beginPath(); c.arc(x, g - 340, 150, Math.PI, Math.PI * 1.7); c.stroke();
  c.fillStyle = tone(st, -0.06); c.fillRect(x + 20, g - 346 + 72, 70, 20);
  for (let i = 0; i < 6; i++) { c.fillStyle = tone(st, (r() - 0.5) * 0.2); c.fillRect(x - 100 + r() * 200, g - (4 + r() * 18), 30 + r() * 24, 12 + r() * 14); }
  // moss & vines
  for (let i = 0; i < 90; i++) { const side = r() < 0.5 ? -150 : 150, hh = side < 0 ? 340 : 250; c.fillStyle = css('#4f7a4a', 0.35 + r() * 0.35); c.beginPath(); c.arc(x + side + (r() - 0.5) * 70, g - r() * hh, 3 + r() * 7, 0, TAU); c.fill(); }
  for (let i = 0; i < 9; i++) { const vx = x - 170 + r() * 60, vl = 60 + r() * 140; c.strokeStyle = '#4f7a4a'; c.lineWidth = 2; c.beginPath(); c.moveTo(vx, g - 340 + r() * 20); c.bezierCurveTo(vx + 8, g - 300, vx - 8, g - 340 + vl * 0.6, vx + 3, g - 340 + vl); c.stroke(); }
  // glyphs (baked dull, glow emissive)
  [[x - 150, g - 270], [x - 150, g - 200], [x - 150, g - 130], [x + 150, g - 190], [x + 150, g - 120], [x, g - 478]].forEach((a, i) => { c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#5a7a80'; glyph(c, a[0], a[1], 26, mulberry(i * 5 + 3)); c.restore(); X.light({ kind: 'glow', x: a[0] - 1, y: a[1] - 1, w: 2, h: 2, r: 56, col: 'cyan', base: 0.12, on: 0.1, off: 0, ph: i * 0.37, k: 0.85, sp: 0.9 }); });
  // statue & lantern post
  const sx = x + 340; c.fillStyle = tone(st, -0.1); c.fillRect(sx - 30, g - 50, 60, 50); c.fillStyle = tone(st, 0); c.beginPath(); c.moveTo(sx - 22, g - 50); c.lineTo(sx - 28, g - 150); c.quadraticCurveTo(sx, g - 190, sx + 28, g - 150); c.lineTo(sx + 22, g - 50); c.closePath(); c.fill(); c.beginPath(); c.arc(sx, g - 168, 15, 0, TAU); c.fill(); c.fillStyle = hx2('#4f7a4a', 0.6); c.beginPath(); c.arc(sx - 16, g - 110, 11, 0, TAU); c.fill();
  X.light({ kind: 'glow', x: sx - 1, y: g - 130, w: 2, h: 2, r: 70, col: 'violet', base: 0.1, on: 0.2, off: 0, ph: 0.5, k: 0.8, sp: 0.7 });
}
const hx2 = (h, a) => css(rgb(h), a);
function standingStones(c, X, x) {
  const r = rngAt(42, 42, 42), g = GY + 12, st = '#868a90';
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, sx = x + Math.cos(a) * 250, sy = g - Math.sin(a) * 18 - 6, h = 110 + r() * 80 + (Math.sin(a) < 0 ? 22 : 0), w = 36 + r() * 16;
    c.fillStyle = 'rgba(14,20,24,.3)'; c.beginPath(); c.ellipse(sx, sy + 2, w * 0.9, 7, 0, 0, TAU); c.fill();
    c.fillStyle = hgrad(c, sx - w / 2, sx + w / 2, tone(st, 0.14), tone(st, -0.3), st); c.beginPath(); c.moveTo(sx - w / 2, sy); c.lineTo(sx - w * 0.44, sy - h * 0.9); c.lineTo(sx - w * 0.1, sy - h); c.lineTo(sx + w * 0.4, sy - h * 0.92); c.lineTo(sx + w / 2, sy); c.closePath(); c.fill();
    c.fillStyle = hx2('#4f7a4a', 0.5); c.beginPath(); c.ellipse(sx - w * 0.2, sy - h * 0.2, w * 0.3, h * 0.08, 0, 0, TAU); c.fill();
    c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#5a7a80'; glyph(c, sx, sy - h * 0.55, 20, mulberry(i * 11 + 1)); c.restore();
    X.light({ kind: 'glow', x: sx - 1, y: sy - h * 0.55 - 1, w: 2, h: 2, r: 60, col: 'cyan', base: 0.1, on: 0.15, off: 0, ph: i * 0.43, k: 0.9, sp: 0.8 }); }
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  TOWN LAYOUT (pure data, shared by painters and live actors)
 * ═══════════════════════════════════════════════════════════════════════════ */
const TOWN_H = [], STALL_POS = [];
{
  const r = mulberry(555); let x = 6320;
  while (x < 7960) { const w = 210 + r() * 80; if (x + w / 2 > 6890 && x - w / 2 < 7270) { x = 7270 + w / 2 + 12; continue; } TOWN_H.push({ x: x + w / 2, w, floors: r() < 0.5 ? 2 : 3, style: r() < 0.7 ? 'gable' : 'long', jetty: r() < 0.6 }); x += w + 6; }
  const raw = [[5700, 0], [5905, 0], [6095, 0], [6390, 0], [6600, 1], [6790, 0], [7330, 0], [7540, 1], [7740, 0], [6495, 1], [7440, 1], [7840, 1]];
  raw.sort((a, b) => a[0] - b[0]);
  const order = [2, 0, 7, 3, 5, 1, 8, 4, 6, 3, 0, 5];
  raw.forEach((a, i) => STALL_POS.push({ x: a[0] + (r() - 0.5) * 16, back: a[1], kind: STALLS[order[i] % 9], awn: PAL.awn[i % PAL.awn.length], seed: 700 + i }));
}
const FARM_FENCES = [[900, 1080], [1420, 1560], [2160, 2420]];
const BLOCKS = [[360, 700], [1090, 1420], [1560, 2180], [2920, 3360], [3376, 4384], [4660, 6200], [6880, 7280], [8170, 8740], [8760, 9000], [9010, 9650], [9700, 10110], [10300, 11010], [11240, 11800], [960, 1040]];
const free = (x, m = 30) => { for (const b of BLOCKS) if (x > b[0] - m && x < b[1] + m) return false; return true; };

/* ═══════════════════════ ground ═══════════════════════ */
const GCOL = { // [top, bottom] per zone
  farm: ['#9fb472', '#7e9c5c'], river: ['#8fac6c', '#6f9058'], town: ['#9a948a', '#6f6c74'], tavern: ['#948f8c', '#6a6870'], forest: ['#4f6c4a', '#2e4a38']
};
function stageGround(c, X) {
  const r = rngAt(X.ci, 55, 1), st = 30, ids = ['farm', 'river', 'town', 'tavern', 'forest'];
  for (let x = Math.floor((X.x0 - BLEED) / st) * st; x < X.x1 + BLEED + st; x += st) {
    const z = (x + st / 2) / STAGE_P; let tw = 0, tc = [0, 0, 0], bc = [0, 0, 0];
    for (const id of ids) { const w = zoneW(z, id, 300); if (w < 0.001) continue; tw += w; const a = rgb(GCOL[id][0]), b = rgb(GCOL[id][1]); for (let i = 0; i < 3; i++) { tc[i] += a[i] * w; bc[i] += b[i] * w; } }
    tc = tc.map(v => v / tw); bc = bc.map(v => v / tw);
    c.fillStyle = vgrad(c, GY - 4, REF_H + PADPX, tc, bc); c.fillRect(x, GY - 4, st + 1, REF_H + PADPX - GY + 6);
  }
  // road band (dirt) where it is not cobbled
  for (let x = Math.floor((X.x0 - BLEED) / 40) * 40; x < X.x1 + BLEED + 40; x += 40) {
    const z = (x + 20) / STAGE_P, cob = zoneW(z, 'town', 260) + zoneW(z, 'tavern', 260), dirt = clamp(1 - cob);
    if (dirt < 0.02) continue;
    const forest = zoneW(z, 'forest', 300), col = mix('#b9a888', '#6e6454', forest);
    c.fillStyle = css(col, 0.9 * dirt); c.fillRect(x, GY + 24 + Math.sin(x * 0.004) * 8, 41, 96);
    c.fillStyle = css(mix(col, '#2a2420', 0.35), 0.28 * dirt); c.fillRect(x, GY + 54 + Math.sin(x * 0.004) * 8, 41, 5); c.fillRect(x, GY + 84 + Math.sin(x * 0.004) * 8, 41, 5);
  }
  // cobbles with perspective
  for (let j = 0; j < 24; j++) {
    const t = Math.pow(j / 24, 1.7), t2 = Math.pow((j + 1) / 24, 1.7), ya = lerp(GY, REF_H + PADPX, t), yb = lerp(GY, REF_H + PADPX, t2), sw = lerp(12, 62, t), sh = Math.max(2, yb - ya);
    for (let x = X.x0 - BLEED - sw; x < X.x1 + BLEED; x += sw * (0.85 + r() * 0.3)) {
      const z = x / STAGE_P, wcb = zoneW(z, 'town', 260) + zoneW(z, 'tavern', 260); if (wcb < 0.5) continue;
      const w = sw * (0.8 + r() * 0.25); c.fillStyle = tone(zoneW(z, 'tavern', 200) > 0.5 ? '#8a8690' : '#9b9381', (r() - 0.5) * 0.3, 0.9);
      c.beginPath(); c.ellipse(x + w / 2, ya + sh / 2, w * 0.5, sh * 0.5, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(30,28,36,.2)'; c.lineWidth = Math.max(0.6, sw * 0.04); c.stroke();
    }
  }
  c.fillStyle = vgrad(c, GY - 4, GY + 44, 'rgba(20,20,32,.32)', 'rgba(20,20,32,0)'); c.fillRect(X.x0 - BLEED, GY - 4, X.w + 2 * BLEED, 48);
  // grass tufts, flowers, stones off the road
  for (let i = 0; i < 180; i++) {
    const x = X.x0 - BLEED + r() * (X.w + 2 * BLEED), z = x / STAGE_P, cob = zoneW(z, 'town', 260) + zoneW(z, 'tavern', 260); if (cob > 0.4) continue;
    const y = GY + (r() < 0.5 ? 6 + r() * 20 : 130 + r() * 150); if (x > NOTCH.b0 - 40 && x < NOTCH.b1 + 40 && y > GY + 60) { const wl = notchL(y), wr = notchR(y); if (x > wl - 20 && x < wr + 20) continue; }
    const fz = zoneW(z, 'forest', 300);
    if (r() < 0.6) grassBlades(c, r, x - 12, x + 12, y, 8, 24, 4, fz > 0.5 ? '#3f6a48' : '#6a8e54'); else if (fz < 0.5 && r() < 0.6) flowerSpray(c, r, 3, x - 10, x + 10, y - 6, y, ['#e8e0b4', '#d5c06a', '#b7a7c9', '#e9d6d0', '#cf8f7f'], 1.6); else rock(c, x, y, 4 + r() * 8, '#8a877e', r);
  }
}

/* ═══════════════════════ stage layer ═══════════════════════ */
const STAGE = addLayer({
  id: 'stage', p: STAGE_P, q: 0.8, fog: 0, mot: 360, brush: 900,
  paint(c, X) {
    const hit = (a, b) => b > X.x0 - BLEED - 10 && a < X.x1 + BLEED + 10, r = rngAt(X.ci, 66, 2);
    stageGround(c, X);
    if (hit(NOTCH.b0, NOTCH.b1)) riverWater(c, X, rngAt(X.ci, 67, 2));
    // ── farm
    if (hit(0, 900)) windmill(c, X, MILL.x);
    if (hit(1090, 1420)) farmCottage(c, X, 1250, 250);
    if (hit(1560, 2180)) barn(c, X, 1850);
    if (hit(950, 1050)) well(c, X, 1000, GY + 8);
    for (const f of FARM_FENCES) if (hit(f[0], f[1])) fenceRun(c, r, f[0], f[1], GY + 6);
    if (hit(2200, 2300)) signpost(c, 2250, GY + 12);
    // orchard
    for (let i = 0; i < 8; i++) { const ox = 2330 + i * 78; if (hit(ox - 70, ox + 70) && ox < 2900) broadleaf(c, ox, GY + 14 + (i % 2) * 6, 40, '#6f8a58', rngAt(ox, 5, 5), { fruit: i % 3 === 0 ? '#b5473b' : null, blossom: i % 3 === 1 ? '#f2dce0' : null, blobs: 10 }); }
    // ── river
    if (hit(2920, 3360)) watermill(c, X, 3050);
    if (hit(3376, 4384)) bridge(c, X);
    if (hit(2500, 2900)) { willow(c, X, 2740, 96, '#7a9a58', rngAt(1, 1, 1)); }
    if (hit(4400, 4760)) { willow(c, X, 4560, 110, '#7a9a58', rngAt(2, 1, 1)); }
    // ── town: gate+wall, market row, stalls, fountain
    if (hit(4650, 6200)) gatehouse(c, X, GATE.x);
    for (const h of TOWN_H) if (hit(h.x - h.w / 2 - 30, h.x + h.w / 2 + 30)) house(c, X, h.x, GY - 8, { w: h.w, floors: h.floors, style: h.style, jetty: h.jetty, litP: 0.7, base: 36, r: rngAt(h.x | 0, 77, 1) });
    if (hit(FOUNTAIN.x - 160, FOUNTAIN.x + 160)) fountain(c, X, FOUNTAIN.x);
    for (const s of STALL_POS) if (hit(s.x - 120, s.x + 120)) stall(c, X, rngAt(s.seed, 1, 1), s.x, GY + (s.back ? 14 : 38), s.kind, s.awn, { s: s.back ? 0.88 : 1 });
    // bunting between market houses & laundry lines
    for (let i = 0; i < TOWN_H.length - 1; i++) { const a = TOWN_H[i], b = TOWN_H[i + 1]; if (b.x - a.x < 340 && hit(a.x, b.x)) { const rr = rngAt(i, 3, 3); if (rr() < 0.55) bunting(c, rr, a.x + a.w * 0.3, GY - 230 - a.floors * 24, b.x - b.w * 0.3, GY - 220 - b.floors * 24, 16, ['#a8584a', '#c7a55c', '#5f8077', '#8a6a9a', '#e8dcc0']); else laundry(c, rr, a.x + a.w * 0.3, GY - 200 - a.floors * 22, b.x - b.w * 0.3, GY - 205 - b.floors * 22); } }
    // ── tavern & guild
    if (hit(TAV.x - 420, TAV.x + 340)) tavern(c, X, TAV.x);
    if (hit(8760, 9000)) questBoard(c, X, 8880);
    if (hit(GUILD.x - 340, GUILD.x + 340)) guild(c, X, GUILD.x);
    if (hit(9700, 10110)) trainingYard(c, X, 9900);
    // ── forest
    if (hit(RUIN.x - 340, RUIN.x + 400)) ruins(c, X, RUIN.x);
    if (hit(STONES.x - 300, STONES.x + 300)) standingStones(c, X, STONES.x);
    // procedural filler by zone
    const SL = 96, i0 = Math.floor((X.x0 - BLEED - 120) / SL), i1 = Math.ceil((X.x1 + BLEED + 120) / SL);
    for (let i = i0; i <= i1; i++) {
      const rr = rngAt(i, 88, 2), x = i * SL + rr() * SL, z = x / STAGE_P, zone = zoneAt(z); if (!free(x, 40)) continue;
      if (x > NOTCH.t0 - 60 && x < NOTCH.t1 + 60) continue;
      if (zone === 'farm') { const q = rr(); if (q < 0.3) bush(c, x, GY + 12, 18 + rr() * 16, pick(rr, ['#5f7a4c', '#6b8456']), rr, rr() < 0.4 ? '#e8e0b4' : null); else if (q < 0.45) broadleaf(c, x, GY + 14, 34 + rr() * 22, pick(rr, ['#6e8a58', '#78905c']), rr, { blobs: 11 }); else if (q < 0.55) rock(c, x, GY + 12, 10 + rr() * 12, '#8a877e', rr); }
      else if (zone === 'river') { const q = rr(); if (q < 0.4) bush(c, x, GY + 10, 20 + rr() * 14, pick(rr, ['#5a7a50', '#68865a']), rr); else if (q < 0.55) reeds(c, rr, x, GY + 12, 50, 70, 10, '#6a8a52'); else if (q < 0.65) broadleaf(c, x, GY + 12, 36, '#6a8a58', rr, { blobs: 10 }); }
      else if (zone === 'town' && rr() < 0.18) { if (rr() < 0.5) barrel(c, x, GY + 52, 40); else crateStack(c, rr, x, GY + 48, 2, 34); }
      else if (zone === 'tavern' && rr() < 0.16) { if (rr() < 0.5) barrel(c, x, GY + 50, 42); else crateStack(c, rr, x, GY + 46, 2, 34); }
      else if (zone === 'forest') { const q = rr(); if (q < 0.45) { const h = 340 + rr() * 280; conifer(c, x, GY + 8, h, pick(rr, ['#2a443f', '#2c4741', '#33504a']), rr); } else if (q < 0.6) broadleaf(c, x, GY + 8, 60 + rr() * 40, pick(rr, ['#35523f', '#31503c']), rr, { blobs: 14, bark: '#3a3a40' }); else if (q < 0.8) fern(c, x, GY + 14, 60 + rr() * 50, '#3f6a4a', rr); else rock(c, x, GY + 14, 14 + rr() * 18, '#6e7478', rr); }
    }
    // lamp posts along the cobbled streets
    for (const lx of [5160, 6250, 6860, 7300, 7930, 8830, 9660, 10150]) if (hit(lx, lx + 1)) lampPost(c, X, lx, GY + 44, 190, 1);
    for (const lx of [10320, 11300]) if (hit(lx, lx + 1)) lampPost(c, X, lx, GY + 26, 170, 0.9);
    // hanging-sign anchor for dynamics is static data; chimney smoke is recorded by house()
  },
  afterChunks(b, E, V, chs) {
    if (V.x1 < BR.x0 - 60 || V.x0 > BR.x1 + 60) return;
    const wl = GY + 10, N = 14;
    b.save(); b.beginPath(); b.moveTo(notchL(wl), wl); b.lineTo(notchR(wl), wl); b.lineTo(notchR(NOTCH.bot), NOTCH.bot); b.lineTo(notchL(NOTCH.bot), NOTCH.bot); b.closePath(); b.clip();
    for (const ch of chs) {
      if (ch.x0 + CW < BR.x0 - 40 || ch.x0 > BR.x1 + 40) continue;
      for (let j = 0; j < N; j++) {
        const sh = 11, syRef = wl - (j + 1) * sh; if (syRef < -PADPX) break;
        b.save(); b.globalAlpha = ch.a * 0.5 * (1 - j / N) * (1 - E.night * 0.35); b.translate(Math.sin(E.t * 1.5 + j * 0.9) * 3.5, wl + j * sh * 1.25 + sh * 1.25); b.scale(1, -1.25);
        b.drawImage(ch.bm, 0, (syRef + PADPX) * ch.sc, ch.bm.width, sh * ch.sc, ch.x0 - BLEED, 0, WREF, sh); b.restore();
      }
    }
    b.restore();
  },
  dyn(c, E, V) { liveStage(c, E, V); },
  emit(g, E, V, chunks) { stageEmit(g, E, V, chunks); }
});

/* ═══════════════════════ back row layer (parallax .45) ═══════════════════════ */
function bgHouse(c, X, x, g, r, z) {
  house(c, X, x, g, { r, w: 130 + r() * 70, floors: 3 + ((r() * 2) | 0), fh: 58, base: 18, style: r() < 0.6 ? 'gable' : 'long', roofH: 70 + r() * 40, litP: 0.55, k: 0.9, jetty: r() < 0.5, door: false, shutter: null, attic: false, lantern: false });
}
addLayer({
  id: 'back', p: 0.45, q: 0.7, fog: 0.07, mot: 300, brush: 700,
  paint(c, X) {
    const r0 = rngAt(X.ci, 91, 1), base = 746;
    // ground colour follows the zone
    for (let x = Math.floor((X.x0 - BLEED) / 40) * 40; x < X.x1 + BLEED + 40; x += 40) {
      const z = (x + 20) / this.p, f = zoneW(z, 'forest', 300), t = zoneW(z, 'town', 300) + zoneW(z, 'tavern', 300);
      const top = mix(mix('#86a36a', '#9a9486', t * 0.7), '#3a5844', f), bot = mix(mix('#738f58', '#7c7a78', t * 0.7), '#2a4434', f);
      c.fillStyle = vgrad(c, base - 8, base + 110, top, bot); c.fillRect(x, base - 6 + Math.sin(x * 0.01) * 4, 41, 200);
    }
    // lake behind the bridge
    const lcx = 4850 * this.p;
    if (X.x1 > lcx - 1100 && X.x0 < lcx + 1100) {
      c.beginPath(); c.moveTo(lcx - 980, base + 70); for (let i = 0; i <= 30; i++) { const x = lcx - 980 + i * 65, y = base + 6 + Math.sin(i * 0.9) * 5 + (i < 4 || i > 26 ? (i < 4 ? (4 - i) * 14 : (i - 26) * 14) : 0); c.lineTo(x, y); } c.lineTo(lcx + 980, base + 140); c.lineTo(lcx - 980, base + 140); c.closePath();
      c.fillStyle = vgrad(c, base, base + 110, '#9fbcbc', '#7aa0a4'); c.fill();
      c.save(); c.clip(); for (let i = 0; i < 50; i++) { c.strokeStyle = `rgba(240,250,250,${0.1 + r0() * 0.12})`; c.lineWidth = 1.2; const x = lcx - 960 + r0() * 1920, y = base + 10 + r0() * 90; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 20 + r0() * 50, y); c.stroke(); } c.restore();
    }
    const SL = 150, i0 = Math.floor((X.x0 - BLEED - 220) / SL), i1 = Math.ceil((X.x1 + BLEED + 220) / SL);
    for (let i = i0; i <= i1; i++) {
      const r = R2(this, i), x = i * SL + r() * SL * 0.6, z = x / this.p, zone = zoneAt(z), y = base + 8 + r() * 10;
      if (zone === 'farm') {
        const q = r(); if (q < 0.3) broadleaf(c, x, y, 36 + r() * 20, pick(r, ['#68855a', '#728d5c']), r, { blobs: 11, blossom: r() < 0.2 ? '#f2dce0' : null }); else if (q < 0.5) { for (let k = 0; k < 4; k++) bush(c, x + k * 24, y, 16 + r() * 8, '#5c7a50', r); } else if (q < 0.62) facade2(c, X, r, x, y, 70 + r() * 30); else if (q < 0.74) { c.fillStyle = vgrad(c, y - 50, y, '#d9b868', '#b08a42'); c.beginPath(); c.moveTo(x - 24, y); c.quadraticCurveTo(x - 22, y - 36, x, y - 56); c.quadraticCurveTo(x + 22, y - 36, x + 24, y); c.fill(); } else if (q < 0.82) fenceRun(c, r, x, x + 120, y, 36); else if (q < 0.88) { c.strokeStyle = '#5a4637'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 54); c.moveTo(x - 22, y - 40); c.lineTo(x + 22, y - 40); c.stroke(); c.fillStyle = '#a58c64'; c.beginPath(); c.arc(x, y - 58, 8, 0, TAU); c.fill(); }
      } else if (zone === 'river') {
        const q = r(); if (Math.abs(x - lcx) < 330 && q < 0.8) continue; if (q < 0.4) willow(c, x, y + 4, 60 + r() * 30, pick(r, ['#7a9a58', '#6a8a52']), r); else if (q < 0.7) broadleaf(c, x, y, 38 + r() * 18, '#6a8a58', r, { blobs: 10 }); else reeds(c, r, x, y + 10, 60, 50, 9, '#6a8a52');
      } else if (zone === 'town') {
        if (z > 6000 && z < 6400 && r() < 0.5) continue; // gate shoulders
        const q = r(); if (q < 0.7) bgHouse(c, X, x, y + 20, r, z); else if (q < 0.78) { towerR(c, X, r, x, y + 10, 66, 400, '#b9b2a4', '#6a6677', 150, { slits: 3, lit: 0.8, flag: '#8d5a52' }); } else if (q < 0.84) { broadleaf(c, x, y, 40, '#6a8a58', r, { blobs: 9 }); }
      } else if (zone === 'tavern') {
        const q = r(); if (q < 0.55) bgHouse(c, X, x, y + 20, r, z); else if (q < 0.62) { const th = 360; towerR(c, X, r, x, y + 10, 56, th, '#b9b2a4', '#7a5446', 110, { slits: 2, lit: 0.9 }); c.fillStyle = '#e8e0c8'; c.beginPath(); c.arc(x, y + 10 - th + 50, 14, 0, TAU); c.fill(); } else if (q < 0.78) broadleaf(c, x, y, 40, '#68865a', r, { blobs: 10 });
      } else { // forest
        const f = zoneW(z, 'forest', 300); const h = 230 + r() * 260;
        if (r() < 0.8) conifer(c, x, y + 14, h, pick(r, ['#2c4a45', '#33544e', '#294440']), r); if (r() < 0.4) broadleaf(c, x + 40, y + 12, 52 + r() * 24, pick(r, ['#34523f', '#2f4d3b']), r, { blobs: 12, bark: '#3a3a40' }); if (r() < 0.3) rock(c, x - 30, y + 12, 12 + r() * 10, '#6e7478', r);
      }
    }
    // far parts of the town wall behind the gate
    const wz = 5420 * this.p; if (X.x1 > wz - 400 && X.x0 < wz + 500) { const wy = base + 14, st = '#b4ada0', wl = wz - 300; c.fillStyle = vgrad(c, wy - 150, wy, tone(st, 0.1), tone(st, -0.2)); c.fillRect(wl, wy - 150, 800, 150); blocks(c, r0, wl, wy - 150, 800, 150, st, 24, 14, 0.3); crenels(c, wl, wz + 500, wy - 150, 14, 14, tone(st, -0.06)); for (const dx of [-300, 0, 250, 500]) towerR(c, X, r0, wz + dx, wy, 60, 220, st, '#6a6677', 90, { slits: 2, lit: 0.6, flag: '#8d5a52' }); }
  },
  dyn(c, E, V) {
    // cows & sheep grazing on the farm fields
    for (let i = 0; i < 9; i++) { const z = -800 + i * 520, x = z * this.p + 30 * Math.sin(i * 3), zn = zoneAt(z); if (zn !== 'farm' || x < V.x0 - 100 || x > V.x1 + 100) continue; if (i % 3 === 0) cow(c, x, 752, 62, i % 2 ? 1 : -1, E.t, i, i % 2 ? '#d8cdb8' : '#8a6a52'); else for (let k = 0; k < 3; k++) sheep(c, x + k * 34, 752 + (k % 2) * 4, 30, 1 - 2 * (k % 2), E.t, i + k); }
    // swans / ducks on the lake
    const lcx = 4850 * this.p; for (let i = 0; i < 4; i++) { const x = lcx - 500 + ((E.t * (6 + i) + i * 400) % 1000), y = 770 + i * 14; duck(c, x, y, 16, 1, E.t, i); }
    // lanterns released at dusk from the town
    lanternFestival(c, E, V, this.p);
  },
  emit(g, E, V) { lanternGlow(g, E, V, this.p); }
});

/* sky lanterns: each evening the townsfolk release them */
function lanternPos(E, p, i) {
  const day = Math.floor((E.phiRaw)), a = E.fest; if (a <= 0) return null;
  const x = (6200 + hash1(i * 7.3 + day) * 3600) * p + (hash1(i * 3.1) - 0.5) * 300 + Math.sin(E.t * 0.2 + i) * 20, ph = (a * 1.1 + hash1(i * 5.9 + day) * 0.3) % 1.0;
  return { x: x + ph * 90 * (E.wind - 0.2), y: 740 - ph * 900 * (0.5 + hash1(i * 2.1) * 0.7), ph };
}
function lanternFestival(c, E, V, p) {
  if (E.fest <= 0) return;
  for (let i = 0; i < 46; i++) { const q = lanternPos(E, p, i); if (!q || q.ph > 0.98) continue; if (q.x < V.x0 - 40 || q.x > V.x1 + 40) continue; const a = Math.sin(q.ph * Math.PI); c.fillStyle = `rgba(255,${190 + hash1(i) * 40 | 0},120,${0.9 * a})`; c.beginPath(); c.roundRect ? c.roundRect(q.x - 5, q.y - 7, 10, 13, 2) : c.rect(q.x - 5, q.y - 7, 10, 13); c.fill(); c.fillStyle = `rgba(80,50,30,${0.6 * a})`; c.fillRect(q.x - 5, q.y + 4, 10, 2); }
}
function lanternGlow(g, E, V, p) {
  if (E.fest <= 0) return; g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) { const q = lanternPos(E, p, i); if (!q) continue; if (q.x < V.x0 - 80 || q.x > V.x1 + 80) continue; const a = Math.sin(q.ph * Math.PI) * 0.8, r = 40; g.globalAlpha = a; g.drawImage(E.spr.warm, q.x - r, q.y - r, r * 2, r * 2); }
  g.restore();
}

/* ═══════════════════════ foreground layer (parallax 1.3) ═══════════════════════ */
addLayer({
  id: 'fore', p: 1.3, q: 0.7, fog: 0, mot: 120, brush: 200,
  paint(c, X) {
    const SL = 220, i0 = Math.floor((X.x0 - BLEED - 300) / SL), i1 = Math.ceil((X.x1 + BLEED + 300) / SL);
    for (let i = i0; i <= i1; i++) {
      const r = R2(this, i), x = i * SL + r() * SL, z = x / this.p, zone = zoneAt(z), y = REF_H + 30;
      if (zone === 'farm') { if (r() < 0.8) { flowerSpray(c, r, 14, x - 80, x + 80, y - 120, y - 40, ['#e8e0b4', '#d5c06a', '#b7a7c9', '#e9d6d0', '#cf8f7f'], 2.4); grassBlades(c, r, x - 90, x + 90, y - 20, 40, 110, 22, '#6a8452'); } if (r() < 0.15) fenceRun(c, r, x, x + 160, y - 40, 90); }
      else if (zone === 'river') { reeds(c, r, x, y - 10, 160, 230, 18, '#5f8250'); if (r() < 0.4) grassBlades(c, r, x - 80, x + 80, y - 10, 40, 100, 14, '#58784a'); }
      else if (zone === 'town') { if (r() < 0.4) barrel(c, x, y + 20, 100); else if (r() < 0.5) crateStack(c, r, x, y + 16, 2, 80); grassBlades(c, r, x - 60, x + 60, y + 4, 20, 50, 8, '#7a8e60'); }
      else if (zone === 'tavern') { if (r() < 0.45) lampPost(c, X, x, y + 10, 330, 1); else if (r() < 0.5) barrel(c, x, y + 20, 100); }
      else { fern(c, x, y - 10, 190 + r() * 100, '#2f5a3c', r); if (r() < 0.4) fern(c, x + 80, y - 20, 140, '#2d5738', r); if (r() < 0.3) { for (let k = 0; k < 4; k++) { const mx = x - 60 + r() * 120, ms = 10 + r() * 14; c.fillStyle = '#d6cbb0'; c.fillRect(mx - ms * 0.18, y - 30 - ms * 0.8, ms * 0.36, ms * 0.8); c.fillStyle = pick(r, ['#b9563f', '#c9a85a', '#8a6a9a']); c.beginPath(); c.ellipse(mx, y - 30 - ms * 0.85, ms * 0.7, ms * 0.4, 0, Math.PI, 0); c.fill(); } } }
      // overhead canopy corners in leafy zones
      if (zone === 'forest' && r() < 0.5) canopyCorner(c, r, x, -150 + r() * 30, 150 + r() * 120, '#28402f', 22);
    }
    c.fillStyle = vgrad(c, REF_H - 140, REF_H + PADPX, 'rgba(60,80,50,0)', 'rgba(50,70,44,.4)'); c.fillRect(X.x0 - BLEED, REF_H - 140, X.w + 2 * BLEED, 140 + PADPX);
  },
  dyn(c, E, V) { fgLife(c, E, V); },
  emit(g, E, V) { fgEmit(g, E, V); }
});
function canopyCorner(c, r, x, y, rad, col, n = 14) {
  const bl = [];
  for (let i = 0; i < n; i++) { const a = r() * TAU, d = rad * Math.sqrt(r()) * 0.9; bl.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, rad * (0.22 + r() * 0.22)]); }
  bl.forEach(b => { c.fillStyle = tone(col, -0.32); c.beginPath(); c.arc(b[0] + rad * 0.05, b[1] + rad * 0.08, b[2], 0, TAU); c.fill(); });
  bl.forEach(b => { c.fillStyle = tone(col, 0); c.beginPath(); c.arc(b[0], b[1], b[2] * 0.9, 0, TAU); c.fill(); });
  bl.forEach(b => { c.fillStyle = tone(col, 0.12, 0.35); c.beginPath(); c.arc(b[0] - rad * 0.06, b[1] - rad * 0.07, b[2] * 0.55, 0, TAU); c.fill(); });
}
function fgLife(c, E, V) {
  // swaying grass tufts along the bottom edge (alive in the wind)
  const step = 70, i0 = Math.floor(V.x0 / step), i1 = Math.ceil(V.x1 / step), z0 = V.cam;
  for (let i = i0; i <= i1; i++) {
    const x = i * step + hash1(i * 1.7) * 40, z = x / 1.3, zone = zoneAt(z), r = hash1(i * 4.1), dark = zone === 'forest'; if (zone === 'town' || zone === 'tavern') continue;
    const col = dark ? '#2d5738' : zone === 'town' || zone === 'tavern' ? '#7a8e60' : '#678250';
    c.strokeStyle = css(col, 0.95); c.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const bx = x + k * 11, h = 40 + hash1(i * 3 + k) * 60, sw = Math.sin(E.t * 1.6 + i * 0.9 + k) * (6 + E.wind * 10); c.lineWidth = 3 + hash1(k + i) * 2; c.beginPath(); c.moveTo(bx, REF_H + 40); c.quadraticCurveTo(bx + sw * 0.4, REF_H - h * 0.5, bx + sw, REF_H - h); c.stroke(); }
  }
  // drifting petals / leaves
  const n = 16;
  for (let i = 0; i < n; i++) {
    const sp = 30 + hash1(i * 2.3) * 40, x = ((hash1(i * 9.7) * 3000 + E.t * sp * (0.4 + E.wind)) % 3000) - 600 + V.cam * 1.3 * 0 + (V.x0 + 800), y = 200 + hash1(i * 5.5) * 700 + Math.sin(E.t * 0.8 + i) * 40, z = x / 1.3;
    const zone = zoneAt(V.cam * 1.0), col = zone === 'forest' ? 'rgba(120,150,90,.6)' : zone === 'farm' ? 'rgba(240,215,225,.7)' : 'rgba(210,170,100,.55)';
    c.save(); c.translate(x, y); c.rotate(E.t * (0.6 + hash1(i)) + i); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 5, 2.4, 0, 0, TAU); c.fill(); c.restore();
  }
}
function fgEmit(g, E, V) {
  const a = smooth((E.night - 0.4) / 0.4) * (1 - E.rain * 0.7); if (a < 0.03) return;
  const zone = zoneAt(V.cam), f = zoneW(V.cam, 'forest', 700) + zoneW(V.cam, 'river', 600) * 0.7; if (f < 0.05) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const x = V.x0 + hash1(i * 3.3) * (V.x1 - V.x0) + Math.sin(E.t * 0.4 + i) * 40, y = 480 + hash1(i * 5.9) * 520 + Math.cos(E.t * 0.5 + i * 2) * 26, p = 0.5 + 0.5 * Math.sin(E.t * (1.1 + hash1(i) * 1.5) + i * 7), r = 14 + hash1(i * 9) * 14;
    g.globalAlpha = 0.85 * p * a * f; g.drawImage(E.spr.lime, x - r, y - r, r * 2, r * 2);
  }
  g.restore();
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  LIVING STAGE: people, animals, boats, wheels, music, weather
 * ═══════════════════════════════════════════════════════════════════════════ */
const ACT = [];
(function buildActors() {
  const r = mulberry(4242), mk = (kind) => mkPerson((r() * 1e9) | 0, kind);
  const walkers = (x0, x1, n, kinds, lane, v) => { for (let i = 0; i < n; i++) ACT.push({ t: 'walk', x0, x1, v: (v[0] + r() * (v[1] - v[0])) * (r() < 0.5 ? -1 : 1), off: r() * (x1 - x0), lane: lerp(lane[0], lane[1], r()), P: mk(pick(r, kinds)), pace: 4 + r() * 2 }); };
  const carts = (x0, x1, n, lane, v) => { for (let i = 0; i < n; i++) ACT.push({ t: 'cart', x0, x1, v: (v[0] + r() * (v[1] - v[0])) * (r() < 0.5 ? -1 : 1), off: r() * (x1 - x0), lane: lane, P: mk('farmer'), col: pick(r, ['#6b5648', '#5d4a3c', '#8a7a68', '#3f352e']), cover: pick(r, ['#d9cdb2', '#c9b78a', '#b8c0b0']) }); };
  walkers(-1500, 2800, 7, ['villager', 'farmer', 'woman', 'child', 'traveler'], [0, 1], [14, 26]);
  carts(-1500, 2800, 2, 0.35, [16, 22]);
  walkers(2800, 5000, 5, ['villager', 'traveler', 'woman', 'monk', 'villager'], [0, 0], [14, 22]);
  carts(2800, 5000, 1, 0, [15, 18]);
  walkers(5000, 8000, 18, ['villager', 'woman', 'merchant', 'villager', 'child', 'mage', 'adventurer', 'woman', 'villager'], [0.05, 1], [10, 26]);
  carts(5000, 8000, 2, 0.9, [16, 22]);
  walkers(7900, 10100, 8, ['adventurer', 'adventurer', 'mage', 'traveler', 'guard', 'adventurer'], [0.1, 1], [14, 26]);
  walkers(9900, 12600, 4, ['traveler', 'monk', 'adventurer', 'traveler'], [0, 0.8], [12, 20]);
  ACT.push({ t: 'walk', x0: 9950, x1: 12700, v: 15, off: 300, lane: 0.55, P: Object.assign(mkPerson(99, 'traveler'), { item: 'lantern', cloak: '#4d4a58', hat: 'hood' }), pace: 3.4, lantern: true });
  // kid + dog
  ACT.push({ t: 'dogkid', x0: 100, x1: 2600, v: 30, off: 600, lane: 0.3, P: mk('child') });
  ACT.push({ t: 'dogkid', x0: 5600, x1: 7800, v: -26, off: 1200, lane: 0.75, P: mk('child') });
  // customers at stalls
  STALL_POS.forEach((s, i) => { const n = 1 + (i % 2); for (let k = 0; k < n; k++) ACT.push({ t: 'idle', x: s.x - 62 + k * 100 + (i % 3) * 8, y: GY + (s.back ? 62 : 80), s: 112, P: mk(pick(r, ['villager', 'woman', 'villager', 'merchant', 'child', 'adventurer'])), face: k % 2 ? -1 : 1 }); });
  // gate guards, fountain audience, tavern patrons
  [-1, 1].forEach((sd, i) => ACT.push({ t: 'idle', x: GATE.x + sd * 156, y: GY + 30, s: 150, P: mkPerson(300 + i, 'guard'), face: 0, front: true }));
  for (let i = 0; i < 4; i++) ACT.push({ t: 'idle', x: FOUNTAIN.x + 170 + i * 40 * (i % 2 ? 1 : -1) - (i < 2 ? 0 : 60), y: GY + 84 + (i % 2) * 14, s: 108, P: mk(pick(r, ['villager', 'woman', 'child', 'villager'])), face: -1 });
  ACT.push({ t: 'bard', x: FOUNTAIN.x + 108, y: GY + 78, P: mkPerson(777, 'bard') });
  [TAV.x + 360, TAV.x + 470].forEach((tx, i) => { ACT.push({ t: 'idle', x: tx - 40, y: GY + 18, s: 118, P: mk('adventurer'), face: 1 }); ACT.push({ t: 'idle', x: tx + 40, y: GY + 20, s: 114, P: mk(i ? 'woman' : 'villager'), face: -1 }); });
  ACT.push({ t: 'idle', x: 8880 - 70, y: GY + 52, s: 120, P: mk('adventurer'), face: 1 }); ACT.push({ t: 'idle', x: 8880 + 74, y: GY + 54, s: 118, P: mkPerson(31, 'mage'), face: -1 });
  ACT.push({ t: 'idle', x: 8880 + 4, y: GY + 60, s: 114, P: mk('villager'), face: 0, front: true });
})();

const groundYAt = (x, lane, zone) => {
  const town = zoneW(x / STAGE_P, 'town', 300) + zoneW(x / STAGE_P, 'tavern', 300), base = GY + lerp(24, 70, town) + lane * lerp(70, 60, town);
  const bw = smooth((x - (BR.x0 - 200)) / 200) * (1 - smooth((x - BR.x1) / 200));
  return lerp(base, deckY(clamp(x, BR.x0, BR.x1)) - 4, bw);
};
function placeActor(a, E) {
  if (a.t === 'idle' || a.t === 'bard') return { x: a.x, y: a.y, s: a.s || 112, dir: a.face || 1, fade: 1 };
  const span = a.x1 - a.x0, pos = (((a.off + a.v * E.t) % span) + span) % span, x = a.x0 + pos;
  const edge = Math.min(pos, span - pos), fade = smooth(edge / 70);
  const y = groundYAt(x, a.lane), s = lerp(122, 150, clamp((y - GY - 20) / 100));
  return { x, y, s, dir: a.v > 0 ? 1 : -1, fade };
}
const pigeon = (c, x, y, s, t, ph, fly) => { if (fly) { bird(c, x, y, s * 0.9, t * 1.4, ph, '#7f8696'); return; } const peck = Math.max(0, Math.sin(t * 4 + ph)); c.fillStyle = '#8a909e'; c.beginPath(); c.ellipse(x, y - s * 0.5, s * 0.55, s * 0.32, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x + s * 0.5, y - s * 0.82 + peck * s * 0.4, s * 0.2, 0, TAU); c.fill(); c.fillStyle = '#4f7a6e'; c.beginPath(); c.arc(x + s * 0.36, y - s * 0.72 + peck * s * 0.3, s * 0.14, 0, TAU); c.fill(); c.strokeStyle = '#9a6a5a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - s * 0.2); c.lineTo(x, y); c.moveTo(x + s * 0.2, y - s * 0.2); c.lineTo(x + s * 0.2, y); c.stroke(); };

function liveStage(c, E, V) {
  const t = E.t, vis = (x, m = 200) => x > V.x0 - m && x < V.x1 + m;
  // wet-street sheen
  if (E.wet > 0.05) { c.fillStyle = vgrad(c, GY, REF_H + 60, css(E.P.hor, 0.0), css(E.P.hor, 0.28 * E.wet)); c.fillRect(V.x0 - 50, GY, V.x1 - V.x0 + 100, REF_H + 60 - GY); }
  // windmill sails
  if (vis(MILL.x, 320)) {
    const rot = t * 0.32 * (0.5 + E.wind * 0.7); c.save(); c.translate(MILL.x, MILL.y); c.fillStyle = '#4a3b33'; c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.fill(); c.rotate(rot);
    for (let i = 0; i < 4; i++) { c.save(); c.rotate(i * Math.PI / 2); c.strokeStyle = '#5c4a3e'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 0); c.lineTo(MILL.len, 0); c.stroke(); c.fillStyle = 'rgba(234,224,200,.88)'; c.fillRect(MILL.len * 0.22, -3, MILL.len * 0.74, -MILL.len * 0.22); c.strokeStyle = 'rgba(70,55,45,.55)'; c.lineWidth = 1.2; for (let q = 0; q <= 8; q++) { const xx = MILL.len * (0.22 + q * 0.0925); c.beginPath(); c.moveTo(xx, -3); c.lineTo(xx, -MILL.len * 0.22 - 3); c.stroke(); } c.beginPath(); c.moveTo(MILL.len * 0.22, -MILL.len * 0.11); c.lineTo(MILL.len * 0.96, -MILL.len * 0.11); c.stroke(); c.restore(); }
    c.restore();
  }
  // watermill wheel
  if (vis(WMILL.x, 200)) {
    const w = WMILL; c.save(); c.translate(w.x, w.y); c.rotate(t * 0.55); c.strokeStyle = '#4f3d30'; c.lineWidth = 9; c.beginPath(); c.arc(0, 0, w.r, 0, TAU); c.stroke(); c.lineWidth = 5; for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i * TAU / 8) * w.r, Math.sin(i * TAU / 8) * w.r); c.stroke(); c.fillStyle = '#6a5240'; c.save(); c.rotate(i * TAU / 8); c.fillRect(w.r - 4, -10, 16, 20); c.restore(); } c.fillStyle = '#3a2f2a'; c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fill(); c.restore();
    for (let i = 0; i < 10; i++) { const ph = (t * 1.4 + i * 0.37) % 1; c.fillStyle = `rgba(240,250,252,${(1 - ph) * 0.8})`; c.beginPath(); c.arc(w.x + w.r * 0.9 + ph * 10 + (hash1(i) - 0.5) * 12, GY + 4 + ph * 22, 1.8, 0, TAU); c.fill(); }
  }
  // tavern sign
  if (vis(TAV.x + 330, 200)) tavernSign(c, E, TAV.x + TAV.w / 2 + 46, GY - 330);
  // hens in the farmyard
  if (vis(1250, 400)) for (let i = 0; i < 7; i++) { const x = 1250 + (i - 3) * 55 + Math.sin(t * 0.22 + i * 2) * 40, d = Math.cos(t * 0.22 + i * 2) > 0 ? 1 : -1; hen(c, x, GY + 28 + (i % 3) * 14, 24, d, t, ['#b58a52', '#d9cdb2', '#8a5a3a', '#e0d2b0'][i % 4], i); }
  // horses at the guild hitching rail
  if (vis(GUILD.x - 440, 240)) { const hx = GUILD.x - 470; c.fillStyle = '#5a4637'; c.fillRect(hx - 110, GY + 34, 220, 7); c.fillRect(hx - 106, GY + 34, 7, 44); c.fillRect(hx + 100, GY + 34, 7, 44);
    horse(c, hx - 55, GY + 82, 190, 1, t, '#5d4a3c', { gait: 0, saddle: '#7a3a3a', graze: Math.sin(t * 0.1) > -0.2, ph: 1 }); horse(c, hx + 60, GY + 86, 180, -1, t, '#8a7a68', { gait: 0, saddle: '#3a5a7a', ph: 3 }); }
  // fountain jets, bard notes, pigeons
  if (vis(FOUNTAIN.x, 260)) {
    const fx = FOUNTAIN.x, fy = GY + 34 - 100; c.strokeStyle = 'rgba(225,244,250,.85)'; c.lineWidth = 2.2; for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI - Math.PI / 2 + Math.PI / 14, ph = (t * 1.3 + i * 0.13) % 1; c.beginPath(); c.moveTo(fx, fy - 40); c.quadraticCurveTo(fx + Math.sin(a) * 26, fy - 70 - Math.sin(t * 2 + i) * 4, fx + Math.sin(a) * 52, fy + 2); c.stroke(); }
    for (let i = 0; i < 22; i++) { const ph = (t * 1.5 + i * 0.19) % 1, a = hash1(i * 3) * TAU; c.fillStyle = `rgba(235,248,252,${(1 - ph) * 0.8})`; c.beginPath(); c.arc(fx + Math.cos(a) * ph * 52, fy - 42 + (ph * ph) * 52 - Math.sin(ph * Math.PI) * 28, 1.6, 0, TAU); c.fill(); }
    for (let i = 0; i < 6; i++) { const fl = evt(t + i * 3.1, 38, 4, 7) >= 0; const x = fx - 150 + i * 62 + (fl ? Math.sin(t * 2 + i) * 30 : 0), y = GY + 112 + (i % 2) * 14 - (fl ? Math.sin(evt(t + i * 3.1, 38, 4, 7) * Math.PI) * 140 : 0); pigeon(c, x, y, 12, t, i * 2, fl); }
  }
  // river life
  if (vis(3880, 760)) {
    const xl = y => notchL(y), xr = y => notchR(y);
    // boats
    const u = (Math.sin(t * 0.045) * 0.5 + 0.5), by = GY + 118, bx = lerp(xl(by) + 140, xr(by) - 140, u), bdir = Math.cos(t * 0.045) > 0 ? 1 : -1;
    boat(c, bx, by, 150, bdir, t, { row: true, P: mkPerson(5, 'villager'), lantern: true, ph: 1 });
    boat(c, (xl(GY + 250) + xr(GY + 250)) / 2 - 180, GY + 250, 210, -1, t, { P: ACT_FISH, ph: 2 });
    const ux = lerp(xl(GY + 46) + 60, xr(GY + 46) - 60, (t * 0.01) % 1); boat(c, ux, GY + 46, 70, 1, t, { P: mkPerson(8, 'merchant'), ph: 3 });
    for (let i = 0; i < 5; i++) { const y = GY + 70 + i * 26, x = lerp(xl(y) + 80, xr(y) - 80, (hash1(i) + t * 0.005 * (i % 2 ? 1 : -1) + 5) % 1); duck(c, x, y, 18 + i * 2, i % 2 ? 1 : -1, t, i); }
    // fish jump + ripples
    const fj = evt(t, 19, 1.5, 4); if (fj >= 0) { const fx = (xl(GY + 150) + xr(GY + 150)) / 2 + 120, fy = GY + 150, rr = 6 + fj * 50; c.strokeStyle = `rgba(240,248,245,${(1 - fj) * 0.6})`; c.lineWidth = 2; c.beginPath(); c.ellipse(fx, fy, rr, rr * 0.25, 0, 0, TAU); c.stroke(); const fh = Math.sin(fj * Math.PI) * 70; fishShape(c, fx + fj * 40, fy - fh, 30, '#9ab4bc', -1 + fj * 2); }
    // fisherman on the right bank + heron on the left
    person(c, 4470, GY + 34, 108, t, mkPerson(12, 'farmer'), { front: false, dir: -1, pace: 0, pose: 'stand' }); c.strokeStyle = '#5a4636'; c.lineWidth = 2; c.beginPath(); c.moveTo(4452, GY - 36); c.lineTo(4386, GY - 82); c.stroke(); const bob = Math.sin(t * 1.4) * 1.5; c.strokeStyle = 'rgba(40,40,40,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(4386, GY - 82); c.lineTo(4386, GY + 92 + bob); c.stroke(); c.fillStyle = '#c9473a'; c.beginPath(); c.arc(4386, GY + 92 + bob, 3.4, 0, TAU); c.fill(); c.strokeStyle = 'rgba(240,248,245,.35)'; c.beginPath(); c.ellipse(4386, GY + 94, 8 + Math.sin(t * 1.4) * 2, 2.5, 0, 0, TAU); c.stroke();
    heron(c, 3392, GY + 46, 120, t, 1);
  }
  // bard notes
  const bd = ACT.find(a => a.t === 'bard'); if (bd && vis(bd.x, 300)) for (let i = 0; i < 6; i++) { const ph = (t * 0.45 + i / 6) % 1, x = bd.x - 10 + Math.sin(ph * 7 + i) * 24, y = bd.y - 90 - ph * 130; c.fillStyle = `rgba(80,56,40,${Math.sin(ph * Math.PI) * 0.7})`; c.beginPath(); c.ellipse(x, y, 5, 3.6, -0.4, 0, TAU); c.fill(); c.strokeStyle = c.fillStyle; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + 4, y); c.lineTo(x + 4, y - 15); c.lineTo(x + 11, y - 11); c.stroke(); }
  // sparring in the guild yard
  if (vis(9900, 300)) spar(c, E, 9900 + 20, GY + 56);
  // events: tavern patron leaves, guild knight steps out
  const ev1 = evt(t, 17, 6, 3); if (ev1 > 0.2 && ev1 < 0.95 && vis(8497)) { const q = (ev1 - 0.2) / 0.75; c.save(); c.globalAlpha *= smooth(Math.min(q * 5, (1 - q) * 3)); person(c, 8497 + q * 160, GY - 2 + q * 62, lerp(104, 124, q), t, mkPerson(61, 'adventurer'), { front: false, dir: 1, pace: 5 }); c.restore(); }
  const ev2 = evt(t, 23, 7, 5); if (ev2 > 0.15 && ev2 < 0.9 && vis(GUILD.x)) { const q = (ev2 - 0.15) / 0.75; c.save(); c.globalAlpha *= smooth(Math.min(q * 4, (1 - q) * 4)); person(c, GUILD.x + (q - 0.5) * 30, GY - 6 + q * 80, lerp(130, 120, q), t, mkPerson(62, 'guard'), { front: true, pace: 5 }); c.restore(); }
  // deer crossing the forest road
  const dq = (E.t % 140) / 22; if (dq < 1 && V.x1 > 9900) { const x = lerp(V.x0 - 100, V.x1 + 160, dq); if (zoneW(V.cam, 'forest', 600) > 0.3) { deer(c, x, GY + 46, 120, 1, t, '#6e5a48'); deer(c, x - 150, GY + 52, 84, 1, t, '#7a6450', 6.4); } }
  // actors, depth sorted
  const list = [];
  for (const a of ACT) { const p = placeActor(a, E); if (p.x < V.x0 - 160 || p.x > V.x1 + 160) continue; list.push({ a, p }); }
  list.sort((q, w) => q.p.y - w.p.y);
  for (const { a, p } of list) {
    c.save(); c.globalAlpha *= p.fade;
    if (a.t === 'walk') person(c, p.x, p.y, p.s, t, a.P, { dir: p.dir, pace: a.pace, wind: E.wind });
    else if (a.t === 'idle') person(c, p.x, p.y, p.s, t, a.P, { dir: p.dir, front: a.front || !a.face, pace: 0, pose: 'stand', wind: E.wind });
    else if (a.t === 'bard') person(c, p.x, p.y, 112, t, a.P, { dir: -1, pace: 0, pose: 'stand' });
    else if (a.t === 'dogkid') { person(c, p.x, p.y, p.s * 0.62, t, a.P, { dir: p.dir, pace: 7 }); dog(c, p.x + p.dir * 70 + Math.sin(t * 2) * 20, p.y + 2, 46, p.dir, t, '#9a7a52', true); }
    else if (a.t === 'cart') { const sz = 150; const w = sz * 0.95; cart(c, p.x, p.y, sz, p.dir, t, { dist: E.t * a.v * 0.8, cover: a.cover }); horse(c, p.x + p.dir * w, p.y, sz * 0.95, p.dir, t, a.col, { gait: 4.2 }); person(c, p.x + p.dir * sz * 0.35, p.y - sz * 0.5, 70, t, a.P, { dir: p.dir, pace: 0, pose: 'stand' }); }
    c.restore();
  }
  // rain splashes
  if (E.rain > 0.1) for (let i = 0; i < 26; i++) { const ph = (t * 1.2 + i * 0.37) % 1, slot = Math.floor(t * 1.2 + i * 0.37), x = V.x0 + hash1(i * 3.1 + slot) * (V.x1 - V.x0), y = GY + 24 + hash1(i * 7.7 + slot) * 220, rr = (3 + ph * 20) * (0.6 + (y - GY) / 280); c.strokeStyle = `rgba(215,228,238,${(1 - ph) * 0.45 * E.rain})`; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y, rr, rr * 0.24, 0, 0, TAU); c.stroke(); }
}
const ACT_FISH = mkPerson(13, 'farmer');

function spar(c, E, x, y) {
  const t = E.t, cyc = (t * 0.9) % TAU, sw = Math.sin(cyc), S = 118;
  const A = mkPerson(51, 'adventurer'), B = mkPerson(52, 'guard'); A.item = null; B.item = null;
  person(c, x - 34 + Math.max(0, sw) * 8, y, S, t, A, { dir: 1, pace: 0, pose: 'stand' }); person(c, x + 34 - Math.max(0, -sw) * 8, y + 2, S, t, B, { dir: -1, pace: 0, pose: 'stand' });
  const blade = (hx, hy, ang, len, col) => { c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + Math.cos(ang) * len, hy + Math.sin(ang) * len); c.stroke(); c.strokeStyle = '#4a3a2c'; c.lineWidth = 5; c.beginPath(); c.moveTo(hx - Math.cos(ang) * 6, hy - Math.sin(ang) * 6); c.lineTo(hx + Math.cos(ang) * 6, hy + Math.sin(ang) * 6); c.stroke(); };
  blade(x - 34 + 24, y - S * 0.58, -0.9 + sw * 0.9, 64, '#c3c8cf'); blade(x + 34 - 24, y - S * 0.58, Math.PI + 0.9 - Math.sin(cyc + 0.6) * 0.9, 64, '#b8bdc4');
  if (Math.abs(sw) > 0.9) { c.fillStyle = 'rgba(255,240,180,.9)'; c.beginPath(); c.arc(x, y - S * 0.62, 5, 0, TAU); c.fill(); }
}

/* ───────── emissive extras for the stage ───────── */
function stageEmit(g, E, V, chunks) {
  const t = E.t, sp = E.spr;
  const ev1 = evt(t, 17, 6, 3), ev2 = evt(t, 23, 7, 5);
  for (const ch of chunks) for (const L of ch.lights) if (L.door) L.open = L.x > 8300 && L.x < 8700 ? (ev1 >= 0 ? Math.sin(ev1 * Math.PI) : 0) : (L.x > 9000 && L.x < 9700 ? (ev2 >= 0 ? Math.sin(ev2 * Math.PI) * 0.8 : 0) : 0);
  // wet reflections of lamps & windows in the street
  if (E.wet > 0.1 && E.lamp > 0.1) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const ch of chunks) for (const L of ch.lights) {
      if (L.y > GY || L.y < GY - 440 || (L.kind !== 'lamp' && L.kind !== 'door' && L.kind !== 'fire' && L.kind !== 'win')) continue;
      const I = lightI(E, L); if (I < 0.15) continue; const cx = L.x + L.w / 2, len = L.kind === 'win' ? 70 : 130, ww = L.kind === 'win' ? L.w * 1.2 : (L.r ? L.r * 2 : L.w), gr = g.createLinearGradient(0, GY + 4, 0, GY + 4 + len);
      gr.addColorStop(0, `rgba(255,185,100,${0.3 * I * E.wet})`); gr.addColorStop(1, 'rgba(255,185,100,0)'); g.fillStyle = gr; const wob = Math.sin(t * 1.7 + L.ph * 9) * ww * 0.15; g.fillRect(cx - ww / 2 + wob, GY + 4, ww, len);
    }
    g.restore();
  }
  // river: sky sheen + lantern / lamp reflections
  if (V.x1 > NOTCH.b0 && V.x0 < NOTCH.b1) {
    g.save(); g.globalCompositeOperation = 'lighter'; const a = (1 - E.night) * 0.1 + 0.02;
    g.beginPath(); g.moveTo(notchL(GY + 6), GY + 6); g.lineTo(notchR(GY + 6), GY + 6); g.lineTo(notchR(NOTCH.bot), NOTCH.bot); g.lineTo(notchL(NOTCH.bot), NOTCH.bot); g.closePath(); g.clip();
    const gr = g.createLinearGradient(0, GY, 0, NOTCH.bot); gr.addColorStop(0, css(E.P.hor, 0.26 + a)); gr.addColorStop(1, css(E.P.mid, 0.14)); g.fillStyle = gr; g.fillRect(NOTCH.b0, GY, NOTCH.b1 - NOTCH.b0, NOTCH.bot - GY);
    for (let i = 0; i < 24; i++) { const y = GY + 12 + hash1(i * 2.1) * 300, x = lerp(notchL(y), notchR(y), (hash1(i * 5.3) + t * 0.004 * (1 + i % 3)) % 1), l = 14 + hash1(i) * 50; g.fillStyle = `rgba(255,248,230,${0.1 + 0.12 * Math.sin(t * 2 + i * 3)})`; g.fillRect(x, y, l, 1.6); }
    if (E.lamp > 0.2) for (const lx of [3700, 4060]) { const len = 260, gr2 = g.createLinearGradient(0, GY, 0, GY + len); gr2.addColorStop(0, `rgba(255,190,100,${0.5 * E.lamp})`); gr2.addColorStop(1, 'rgba(255,190,100,0)'); g.fillStyle = gr2; for (let i = 0; i < 12; i++) g.fillRect(lx - 8 + Math.sin(t * 2 + i) * 6, GY + 12 + i * 20, 14 - i * 0.6, 8); }
    g.restore();
  }
  // mages' staves & the lantern traveller
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const a of ACT) { if (!(a.P.kind === 'mage' || a.lantern)) continue; const p = placeActor(a, E); if (p.x < V.x0 - 100 || p.x > V.x1 + 100) continue; const s = p.s * a.P.hs, r = a.lantern ? 90 : 56, ox = a.lantern ? p.dir * s * 0.16 : p.dir * s * 0.2, oy = a.lantern ? -s * 0.46 : -s * 1.17; g.globalAlpha = (0.35 + E.night * 0.65) * p.fade * (0.85 + 0.15 * Math.sin(t * 3 + a.off)); g.drawImage(a.lantern ? sp.warm : sp.cyan, p.x + ox - r, p.y + oy - r, r * 2, r * 2); }
  g.restore();
  // boat lantern + ripples
  if (E.lamp > 0.2 && V.x1 > NOTCH.b0 && V.x0 < NOTCH.b1) { const u = (Math.sin(t * 0.045) * 0.5 + 0.5), by = GY + 118, bx = lerp(notchL(by) + 140, notchR(by) - 140, u), dir = Math.cos(t * 0.045) > 0 ? 1 : -1; g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = E.lamp * 0.9; g.drawImage(sp.warm, bx + dir * 75 - 38, by - 75 - 38, 76, 76); g.restore(); }
}
LAYERS.sort((a, b) => a.p - b.p); LAYERS.forEach((l, i) => { l.idx = i; });

/* ═════════════════════════ sky ═════════════════════════ */
function drawSky(c, E, st, w, h) {
  const P = E.P, k = E.k, night = P.night, phi = E.phi;
  c.fillStyle = vgrad(c, 0, h * 0.7, P.top, P.mid); c.fillRect(0, 0, w, h);
  const g2 = c.createLinearGradient(0, h * 0.34, 0, h * 0.74); g2.addColorStop(0, css(P.mid, 0)); g2.addColorStop(1, css(P.hor, 1)); c.fillStyle = g2; c.fillRect(0, h * 0.34, w, h * 0.66);
  // stars + a faint milky band
  if (night > 0.3) {
    const a = smooth((night - 0.3) / 0.6) * (1 - E.overcast * 0.85);
    c.save(); c.translate(w * 0.5, h * 0.3); c.rotate(-0.5); const mg = c.createLinearGradient(0, -h * 0.12, 0, h * 0.12); mg.addColorStop(0, 'rgba(180,190,255,0)'); mg.addColorStop(0.5, `rgba(190,200,255,${0.1 * a})`); mg.addColorStop(1, 'rgba(180,190,255,0)'); c.fillStyle = mg; c.fillRect(-w, -h * 0.12, w * 2, h * 0.24); c.restore();
    for (const s of st.stars) { const tw = 0.6 + 0.4 * Math.sin(E.t * s.sp + s.ph); c.fillStyle = `rgba(235,240,255,${a * tw * s.a})`; c.beginPath(); c.arc(s.x * w, s.y * h * 0.62, s.r * k, 0, TAU); c.fill(); }
    const ss = evt(E.t + st.seed, 37, 1.3);
    if (ss >= 0 && night > 0.7) { const x0 = w * (0.2 + hash1(Math.floor((E.t + st.seed) / 37)) * 0.5), y0 = h * 0.08, px = x0 + ss * w * 0.16, py = y0 + ss * h * 0.07; const gg = c.createLinearGradient(px, py, px - w * 0.07, py - h * 0.03); gg.addColorStop(0, `rgba(255,255,255,${0.8 * (1 - ss)})`); gg.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = gg; c.lineWidth = 1.6 * k; c.beginPath(); c.moveTo(px, py); c.lineTo(px - w * 0.07, py - h * 0.03); c.stroke(); }
    // aurora ribbons
    if (night > 0.85) { const aa = smooth((night - 0.85) / 0.15) * (1 - E.overcast) * 0.9; c.save(); c.globalCompositeOperation = 'lighter'; for (let r = 0; r < 3; r++) { const cols = [[110, 255, 190], [150, 190, 255], [200, 150, 255]][r]; c.beginPath(); for (let i = 0; i <= 40; i++) { const x = i / 40 * w, y = h * (0.16 + r * 0.05) + Math.sin(i * 0.3 + E.t * 0.12 + r * 2) * h * 0.035; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.lineTo(w, h * 0.02); c.lineTo(0, h * 0.02); c.closePath(); const gr = c.createLinearGradient(0, 0, 0, h * 0.3); gr.addColorStop(0, `rgba(${cols[0]},${cols[1]},${cols[2]},0)`); gr.addColorStop(1, `rgba(${cols[0]},${cols[1]},${cols[2]},${0.07 * aa})`); c.fillStyle = gr; c.fill(); } c.restore(); }
  }
  // sun
  const phs = phi > 0.96 ? phi - 1 : phi, s = (phs + 0.04) / 0.66;
  if (s > -0.08 && s < 1.08) {
    const sx = lerp(0.08, 0.92, s) * w, sy = (0.68 - 0.58 * Math.sin(clamp(s, 0, 1) * Math.PI)) * h, a = (1 - smooth(night / 0.8)) * (1 - E.overcast * 0.6), col = mix('#fff6dd', '#ffa860', 1 - Math.sin(clamp(s, 0, 1) * Math.PI));
    c.save(); c.globalCompositeOperation = 'screen';
    let g = c.createRadialGradient(sx, sy, 0, sx, sy, h * 0.7); g.addColorStop(0, css(col, 0.75 * a)); g.addColorStop(0.2, css(col, 0.28 * a)); g.addColorStop(1, css(col, 0)); c.fillStyle = g; c.fillRect(0, 0, w, h);
    g = c.createRadialGradient(sx, sy, 0, sx, sy, 38 * k); g.addColorStop(0, `rgba(255,252,238,${0.95 * a})`); g.addColorStop(1, css(col, 0)); c.fillStyle = g; c.beginPath(); c.arc(sx, sy, 38 * k, 0, TAU); c.fill(); c.restore();
  }
  // two moons
  const phm = phi < 0.5 ? phi + 1 : phi;
  const moon = (m, x0, x1, ytop, r, col, shade, crescent) => {
    if (m < -0.05 || m > 1.05) return; const mm = clamp(m, 0, 1), mx = lerp(x0, x1, m) * w, my = (0.68 - ytop * Math.sin(mm * Math.PI)) * h, a = smooth(Math.min(m + 0.05, 1.05 - m) / 0.2) * (1 - E.overcast * 0.7);
    c.save(); c.globalCompositeOperation = 'screen'; let g = c.createRadialGradient(mx, my, 0, mx, my, h * 0.4); g.addColorStop(0, css(col, 0.26 * a)); g.addColorStop(0.25, css(col, 0.08 * a)); g.addColorStop(1, css(col, 0)); c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
    c.save(); c.globalAlpha = a; c.fillStyle = css(col, 1); c.beginPath(); c.arc(mx, my, r * k, 0, TAU); c.fill(); c.fillStyle = 'rgba(150,150,170,.28)';
    [[-0.3, -0.2, 0.28], [0.25, 0.16, 0.34], [-0.1, 0.38, 0.18], [0.36, -0.3, 0.15]].forEach(q => { c.beginPath(); c.arc(mx + q[0] * r * k, my + q[1] * r * k, q[2] * r * k, 0, TAU); c.fill(); });
    c.fillStyle = css(shade, crescent); c.beginPath(); c.arc(mx + r * 0.42 * k, my + r * 0.1 * k, r * 0.98 * k, 0, TAU); c.fill(); c.restore();
  };
  moon((phm - 0.56) / 0.52, 0.08, 0.92, 0.55, 33, '#f0ecdd', '#2a3a70', 0.34);
  moon((phm - 0.63) / 0.5, 0.02, 0.86, 0.42, 15, '#bcd4ff', '#2a3a70', 0.45);
  // clouds
  const ca = (0.85 - night * 0.5) * (0.5 + E.overcast * 0.6);
  for (const cl of st.clouds) {
    const sp = cl.sp * (0.5 + E.wind * 0.6), cw = cl.s * k * 560, x = ((E.t * sp + cl.off * (w + cw * 2) - E.cam * 0.01 * k) % (w + cw * 2) + (w + cw * 2)) % (w + cw * 2) - cw, y = h * cl.y;
    c.globalAlpha = clamp(ca * cl.a); c.drawImage(st.cloudSprites[cl.sp2], x, y, cw, cw * 0.4); c.globalAlpha = 1;
  }
  // sunset/dawn tint on clouds and sky band
  const warm = Math.max(0, 1 - Math.abs(night - 0.3) * 3.2) * (1 - E.overcast);
  if (warm > 0.02) { c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = `rgba(255,150,90,${0.5 * warm})`; c.fillRect(0, 0, w, h * 0.65); c.restore(); }
  if (E.overcast > 0.05) { c.fillStyle = vgrad(c, 0, h * 0.62, css(desat(P.top, 0.8), 0.55 * E.overcast), css(desat(P.mid, 0.8), 0.12 * E.overcast)); c.fillRect(0, 0, w, h * 0.62); }
}

/* ═════════════════════════ engine ═════════════════════════ */
const WREF = CW + 2 * BLEED, HREF = REF_H * (1 + 2 * PADV);
function resize(st, c, w, h) {
  st.w = w; st.h = h; st.k = Math.max(0.35, h / REF_H); st.cache = new Map();
  let bs = 1; try { bs = clamp(c.getTransform().a || 1, 1, 2); } catch (e) { /* older browsers */ }
  st.baseBs = bs; st.qual = 1; st.ema = 0; st.slow = 0; st.frame = 0; makeBuffers(st);
}
function makeBuffers(st) {
  const bs = st.baseBs * st.qual, w = st.w, h = st.h; st.bs = bs;
  st.buf = makeCanvas(w * bs, h * bs); st.bctx = st.buf.getContext('2d');
  st.ebs = 0.6; st.eb = makeCanvas(w * bs * st.ebs, h * bs * st.ebs); st.ectx = st.eb.getContext('2d');
  const bw = Math.max(8, Math.round(w / 5)), bh = Math.max(8, Math.round(h / 5));
  st.bl1 = makeCanvas(bw, bh); st.bl1c = st.bl1.getContext('2d'); st.bl2 = makeCanvas(Math.max(4, bw >> 2), Math.max(4, bh >> 2)); st.bl2c = st.bl2.getContext('2d');
}
function buildChunk(st, L, ci) {
  const sc = st.k * (L.q || CFG.LAYER_SCALE), x0 = ci * CW;
  const cv = makeCanvas(WREF * sc, HREF * sc), c = cv.getContext('2d');
  c.setTransform(sc, 0, 0, sc, -(x0 - BLEED) * sc, PADPX * sc);
  const X = { x0, x1: x0 + CW, w: CW, ci, p: L.p, lights: [], smoke: [], flags: [] };
  X.light = l => { const r = rngAt(l.x | 0, l.y | 0, 9); if (l.on === undefined) l.on = r(); if (l.off === undefined) l.off = r(); if (l.ph === undefined) l.ph = r(); X.lights.push(l); };
  X.flag = f => X.flags.push(f);
  c.save(); c.beginPath(); c.rect(x0 - BLEED, -PADPX, WREF, HREF); c.clip();
  L.paint(c, X);
  const rnd = rngAt(L.idx, ci, 3); mottle(c, X, rnd, L.mot || 240); brushMarks(c, X, rnd, L.brush || 600);
  c.restore();
  const inX = o => o.x >= x0 && o.x < x0 + CW;
  return { bm: cv, x0, sc, ci, lights: X.lights.filter(l => l.x + l.w / 2 >= x0 && l.x + l.w / 2 < x0 + CW), smoke: X.smoke.filter(inX), flags: X.flags.filter(inX), born: -1, a: 0 };
}

function drawLayers(c, st, E, w, h) {
  const b = st.bctx, eb = st.ectx, bs = st.bs, k = st.k, halfW = w / (2 * k) + 60;
  b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; b.clearRect(0, 0, st.buf.width, st.buf.height);
  eb.setTransform(1, 0, 0, 1, 0, 0); eb.globalCompositeOperation = 'source-over'; eb.globalAlpha = 1; eb.clearRect(0, 0, st.eb.width, st.eb.height);
  const dbg = st.debug, need = [], dirS = st.dir || 1; let ebUsed = false;
  // collect needed chunks for all layers (visible + prefetch ahead)
  const perLayer = LAYERS.map(L => {
    const camL = E.cam * L.p, x0 = camL - halfW, x1 = camL + halfW, c0 = Math.floor(x0 / CW), c1 = Math.floor(x1 / CW), list = [];
    for (let ci = c0; ci <= c1; ci++) list.push(ci);
    const pf = dirS > 0 ? c1 + 1 : c0 - 1; need.push({ L, ci: pf, pri: 1 }); for (const ci of list) need.push({ L, ci, pri: 0, d: Math.abs((ci + 0.5) * CW - camL) });
    return { L, camL, x0, x1, list };
  });
  // build (time-budgeted)
  const missing = need.some(n => n.pri === 0 && !st.cache.has(n.L.idx + ':' + n.ci)), budget = dbg ? Infinity : (missing && st.frame < 400 ? 34 : 6), t0 = performance.now();
  need.sort((a, b2) => (a.pri - b2.pri) || ((a.d || 0) - (b2.d || 0)));
  for (const n of need) { const key = n.L.idx + ':' + n.ci; if (st.cache.has(key)) continue; if (performance.now() - t0 > budget) break; st.cache.set(key, buildChunk(st, n.L, n.ci)); }
  // evict far chunks occasionally
  if (st.frame % 120 === 0) for (const [key, ch] of st.cache) { const L = LAYERS[+key.split(':')[0]], camL = E.cam * L.p; if (Math.abs((ch.ci + 0.5) * CW - camL) > halfW + CW * 2.2) st.cache.delete(key); }
  const rawT = E.t;
  for (const pl of perLayer) {
    const { L, camL } = pl, V = { cam: E.cam, p: L.p, x0: camL - halfW, x1: camL + halfW, k }, chs = [];
    for (const ci of pl.list) { const ch = st.cache.get(L.idx + ':' + ci); if (ch) { if (ch.born < 0) ch.born = rawT; ch.a = dbg ? 1 : smooth((rawT - ch.born) / 1.1); chs.push(ch); } }
    const yoff = Math.sin(E.t * 0.11 + L.idx) * L.p * 5 * k;
    const setT = (g) => g.setTransform(bs * k, 0, 0, bs * k, bs * (w / 2 - camL * k), bs * yoff);
    setT(b);
    for (const ch of chs) { b.globalAlpha = ch.a; b.drawImage(ch.bm, ch.x0 - BLEED, -PADPX, WREF, HREF); }
    b.globalAlpha = 1;
    if (L.afterChunks) L.afterChunks(b, E, V, chs);
    if (L.dyn) L.dyn(b, E, V, chs);
    for (const ch of chs) { for (const s of ch.smoke) smokeAt(b, E, s.x, s.y, s.s, s.x * 0.013, E.rain > 0.2 ? 1 : 0); for (const f of ch.flags) flagAt(b, E, f); }
    // emissive pass (occluded by this layer, then this layer's own lights)
    eb.setTransform(bs * k * st.ebs, 0, 0, bs * k * st.ebs, bs * st.ebs * (w / 2 - camL * k), bs * st.ebs * yoff);
    const dayB = L.dayGlow && E.night < 0.35;
    if (ebUsed) { eb.globalCompositeOperation = 'destination-out'; for (const ch of chs) { eb.globalAlpha = ch.a; eb.drawImage(ch.bm, ch.x0 - BLEED, -PADPX, WREF, HREF); } eb.globalAlpha = 1; eb.globalCompositeOperation = 'source-over'; }
    let any = false;
    if (dayB) { setT(b); b.globalCompositeOperation = 'lighter'; for (const ch of chs) if (ch.lights.length) { E.ga = ch.a; drawLights(b, E, ch.lights); E.ga = 1; } b.globalCompositeOperation = 'source-over'; }
    else { for (const ch of chs) if (ch.lights.length) { E.ga = ch.a; if (drawLights(eb, E, ch.lights) > 0) any = true; E.ga = 1; } if (L.emit && !(L.emitNightOnly && E.night < 0.3)) { L.emit(eb, E, V, chs); any = true; } }
    if (any) ebUsed = true;
    // atmospheric perspective: fog everything drawn so far
    if (L.fog) {
      b.setTransform(bs, 0, 0, bs, 0, 0); const a = L.fog * (0.75 + E.P.mist * 0.5);
      b.globalCompositeOperation = 'source-atop'; const g = b.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, css(E.P.haze, a * 0.45)); g.addColorStop(0.62, css(E.P.haze, a)); g.addColorStop(1, css(E.P.haze, a * 0.35)); b.fillStyle = g; b.fillRect(0, 0, w, h); b.globalCompositeOperation = 'source-over';
    }
  }
}
function drawRain(c, E, st, w, h) {
  if (E.rain < 0.03) return;
  const n = Math.floor(st.drops.length * clamp(E.rain)), slant = 0.16 + E.wind * 0.12, k = E.k; c.save(); c.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    c.strokeStyle = `rgba(208,220,232,${(pass ? 0.3 : 0.18) * (1 - 0.5 * E.night) * Math.min(1, E.rain * 1.3)})`; c.lineWidth = (pass ? 1.3 : 0.8) * k; c.beginPath();
    for (let i = 0; i < n; i++) { const d = st.drops[i]; if ((d.z > 0.7) !== !!pass) continue; const y = (d.y + E.t * (0.7 + d.z * 1.1)) % 1, px = ((d.x + y * slant * 0.3) % 1) * w, py = y * h, len = (14 + d.z * 26) * k; c.moveTo(px, py); c.lineTo(px - len * slant, py + len); }
    c.stroke();
  }
  c.restore();
}

export function init(w, h) {
  const r = mulberry((Math.random() * 1e9) | 0);
  const st = { w: 0, h: 0, seed: r() * 1000, cache: new Map(), stars: [], clouds: [], drops: [], pat: null, patCtx: null, debug: null, frame: 0, dir: 1, lastCam: 0 };
  for (let i = 0; i < 240; i++) st.stars.push({ x: r(), y: Math.pow(r(), 1.25), r: 0.5 + r() * 1.1, a: 0.35 + r() * 0.65, sp: 1 + r() * 3, ph: r() * 6 });
  for (let i = 0; i < 10; i++) st.clouds.push({ sp2: i % 3, y: 0.04 + r() * 0.32, s: 0.5 + r() * 0.9, sp: 3 + r() * 6, off: r(), a: 0.5 + r() * 0.5 });
  for (let i = 0; i < 320; i++) st.drops.push({ x: r(), y: r(), z: 0.3 + r() * 0.7 });
  st.cloudSprites = [makeCloudSprite(3, 520, 208), makeCloudSprite(9, 520, 208), makeCloudSprite(21, 520, 208)];
  st.mist = makeSoftSprite(512, 128); st.grain = makeGrain();
  st.spr = { warm: makeGlow('#ffb060'), cyan: makeGlow('#7fe4ff'), violet: makeGlow('#b49aff'), white: makeGlow('#ffffff'), lime: makeGlow('#d8ff90') };
  return st;
}

export function draw(c, st, t, dt, mood, w, h) {
  if (!st) return;
  if (st.w !== w || st.h !== h || !st.buf) resize(st, c, w, h);
  const dbg = st.debug, tStart = performance.now(), k = st.k;
  const tt = dbg && dbg.time !== undefined ? dbg.time : t;
  const ph = wrap01(tt / CFG.TRIP_SECONDS + 0.065), cam = dbg && dbg.cam !== undefined ? dbg.cam : CFG.TRAVEL * (0.5 - 0.5 * Math.cos(TAU * ph));
  st.dir = cam > st.lastCam + 1e-4 ? 1 : cam < st.lastCam - 1e-4 ? -1 : st.dir; st.lastCam = cam;
  const phiRaw = CFG.START_DAY + tt / CFG.DAY_SECONDS, phi = dbg && dbg.day !== undefined ? dbg.day : wrap01(phiRaw);
  const wx = weatherAt(tt); let rain = wx.rain, overcast = wx.overcast; if (dbg && dbg.rain !== undefined) { rain = dbg.rain; overcast = Math.max(overcast, rain * 0.9); }
  const P = paletteAt(phi);
  for (const kk of ['top', 'mid', 'hor', 'haze']) P[kk] = mix(mix(P[kk], desat(P[kk], 0.75), overcast * 0.55), '#4a5360', overcast * 0.1);
  const night = P.night, lamp = clamp(smooth(clamp((night - 0.12) / 0.55)) + overcast * 0.25 + 0.05);
  const late = smooth((phi - 0.8) / 0.06) * (1 - smooth((phi - 0.93) / 0.04)), fest = phi > 0.6 && phi < 0.78 ? (phi - 0.6) / 0.18 : 0;
  const wind = 0.55 + 0.35 * Math.sin(tt * 0.13) + 0.1 * Math.sin(tt * 0.37), wet = clamp(Math.max(rain, wx.overcast * 0.35));
  const E = { t: tt, w, h, k, P, night, lamp, late, fest, phi, phiRaw, rain, wet, overcast, wind, mist: P.mist, cam, spr: st.spr, mistSprite: st.mist, st };

  drawSky(c, E, st, w, h);
  drawLayers(c, st, E, w, h);
  const z = 1.016 + 0.012 * Math.sin(tt * 0.045);
  c.save(); c.translate(w / 2, h * 0.62); c.scale(z, z); c.translate(-w / 2, -h * 0.62);
  c.drawImage(st.buf, 0, 0, w, h);
  c.restore();
  // drifting ground mist + calm veil for the text area
  for (let m = 0; m < 4; m++) { const x = ((tt * (5 + m * 2.2) + m * 520) % (w + 900)) - 450; soft(c, st.mist, x, h * (0.66 + m * 0.045), w * 0.8, h * 0.13, E.mist * 0.16); }
  c.fillStyle = vgrad(c, h * 0.5, h, css(P.haze, 0), css(P.haze, CFG.TEXT_VEIL)); c.fillRect(0, h * 0.5, w, h * 0.5);
  // colour grade
  c.globalCompositeOperation = 'multiply'; c.fillStyle = css(P.grade); c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
  // emissive lights
  c.save(); c.translate(w / 2, h * 0.62); c.scale(z, z); c.translate(-w / 2, -h * 0.62); c.drawImage(st.eb, 0, 0, w, h); c.restore();
  drawRain(c, E, st, w, h);
  // Orton bloom
  if (CFG.BLOOM > 0 && c.canvas && !st.lite) {
    try {
      const cw = c.canvas.width, ch = c.canvas.height;
      st.bl1c.globalCompositeOperation = 'copy'; st.bl1c.drawImage(c.canvas, 0, 0, cw, ch, 0, 0, st.bl1.width, st.bl1.height); st.bl1c.globalCompositeOperation = 'destination-over'; st.bl1c.fillStyle = '#000'; st.bl1c.fillRect(0, 0, st.bl1.width, st.bl1.height);
      st.bl2c.globalCompositeOperation = 'copy'; st.bl2c.drawImage(st.bl1, 0, 0, st.bl2.width, st.bl2.height); st.bl2c.globalCompositeOperation = 'destination-over'; st.bl2c.fillStyle = '#000'; st.bl2c.fillRect(0, 0, st.bl2.width, st.bl2.height);
      c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = CFG.BLOOM * (0.55 + 0.45 * night); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(st.bl2, 1, 1, st.bl2.width - 2, st.bl2.height - 2, 0, 0, w, h); c.restore();
    } catch (e) { /* tainted or unsupported — skip bloom */ }
  }
  // vignette & paper grain
  const v = c.createRadialGradient(w * 0.5, h * 0.48, Math.min(w, h) * 0.3, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
  v.addColorStop(0, 'rgba(14,18,30,0)'); v.addColorStop(1, `rgba(14,18,30,${0.24 + night * 0.16})`); c.fillStyle = v; c.fillRect(0, 0, w, h);
  if (st.patCtx !== c) { st.pat = c.createPattern(st.grain, 'repeat'); st.patCtx = c; }
  if (st.pat) { c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = CFG.GRAIN; c.fillStyle = st.pat; c.fillRect(0, 0, w, h); c.restore(); }
  st.frame++;
  if (!dbg) { const d = performance.now() - tStart; st.ema = st.ema ? st.ema * 0.96 + d * 0.04 : d; st.slow = st.ema > 26 ? st.slow + 1 : 0; if (st.slow > 90) { if (st.qual > 0.55) { st.qual = Math.max(0.5, st.qual * 0.8); st.slow = 0; st.ema = 0; makeBuffers(st); } else if (!st.lite) { st.lite = true; st.slow = 0; st.ema = 0; } } }
}

export default { init, draw };
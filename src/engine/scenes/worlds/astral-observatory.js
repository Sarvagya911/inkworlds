// src/engine/scenes/worlds/astral-observatory.js
//
// "The Stargazer's Lake" - procedural animated night world (v4)
// Self-contained: no imports, no images.
//
// What's new in v4
//   - Realistic Milky Way: a bright galactic bulge, dust-lane rift, patchy star
//     clouds and thousands of faint stars concentrated along a diagonal arc.
//   - Real constellations (Cygnus, Cassiopeia, Ursa Major, Orion) with named stars.
//   - Telescope rewrite: a proper brass refractor on a pier. It slews smoothly
//     between stars, settles with a small damped wobble, then locks on: a sight
//     beam, a targeting reticle, the star's name and the constellation's name
//     fade in. The dome slit rotates to follow it.
//   - Sky lanterns removed (flip SKY_LANTERNS to true to bring them back).
//
// Composition (designed around a centered reading column):
//   - left third : hilltop observatory, glowing windows, open dome + telescope,
//                  a girl with a lantern
//   - centre     : calm, deep sky and still lake  (kept quiet for the text)
//   - right third: luminous moon, orrery rings, planets, boat on the lake
//
// Scene API:
//   init(w, h)  -> state
//   draw(ctx, state, t, dt, mood, w, h)
 
const DW = 1672;
const DH = 941;
const TAU = Math.PI * 2;
 
const MOON = { x: 1330, y: 235, r: 90 };
const OBS = { x: 290, base: 700, bw: 280, bh: 120, R: 125, domeY: 560 };
const LAKE_Y = 738;
const GIRL = { x: 482, y: 778 };
const BOAT = { x: 1238, y: 858 };
 
const SKY_LANTERNS = false; // the drifting lanterns, off by default
 
/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */
 
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
 
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
 
function vnoise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u);
}
 
const fbm = (x) => vnoise(x) * 0.6 + vnoise(x * 2.1 + 7) * 0.3 + vnoise(x * 4.3 + 19) * 0.1;
 
function seeded(seed) {
  let s = seed >>> 0;
  return function () {
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
 
const smootherstep = (p) => {
  const t = clamp(p, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
 
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
 
function circ(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, Math.max(0.01, r), 0, TAU);
}
 
function ell(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}
 
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  if (typeof g.roundRect === "function") g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}
 
function glow(g, x, y, r, c, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(c, a));
  gr.addColorStop(0.45, rgba(c, a * 0.35));
  gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr;
  circ(g, x, y, r);
  g.fill();
}
 
function add(g, fn) {
  g.save();
  g.globalCompositeOperation = "lighter";
  fn();
  g.restore();
}
 
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
 
function sprite(bw, bh, q, fn) {
  const cv = makeCanvas(Math.max(1, Math.ceil(bw * q)), Math.max(1, Math.ceil(bh * q)));
  const g = cv.getContext("2d");
  g.scale(q, q);
  fn(g);
  return cv;
}
 
// Terrain the observatory hill sits on.
function hillY(x) {
  const d = x - OBS.x;
  if (d <= 0) return OBS.base + 12 + Math.pow(d / 560, 2) * 95 + Math.sin(x * 0.02) * 2;
  return OBS.base + 12 + Math.pow(d / 380, 2) * 230 + Math.sin(x * 0.02) * 2;
}
 
/* -------------------------------------------------------------------------- */
/* MILKY WAY GEOMETRY                                                         */
/* -------------------------------------------------------------------------- */
// The galactic plane is modelled in band-space: u runs along the band, v across it.
// The band arcs from the lower-left horizon to the upper-right, with the bright
// galactic bulge on the left and a dark dust-lane rift running down its middle.
 
const MW = { cx: 790, cy: 330, ang: -0.42, core: -150 };
const MWC = Math.cos(MW.ang);
const MWS = Math.sin(MW.ang);
 
const mwBulge = (u) => Math.exp(-Math.pow((u - MW.core) / 330, 2));
const mwHalf = (u) => 62 + 92 * mwBulge(u) + 14 * Math.sin(u * 0.005 + 1.3);
const mwRift = (u) => Math.sin(u * 0.0065 + 0.8) * mwHalf(u) * 0.2 + (fbm(u * 0.008 + 11) - 0.5) * mwHalf(u) * 0.5;
 
function mwXY(u, v) {
  const vv = v - u * u * 0.00003; // gentle arch
  return [MW.cx + u * MWC - vv * MWS, MW.cy + u * MWS + vv * MWC];
}
 
function bakeMilkyWay(g) {
  const r = seeded(2024);
  const gauss = () => r() + r() + r() - 1.5;
  const U0 = -1300;
  const U1 = 1300;
  const pickU = () => lerp(U0, U1, r());
  const tone = (u, k) => mix([118, 140, 236], [255, 226, 184], clamp(mwBulge(u) * k, 0, 1));
 
  add(g, () => {
    // 1. wide soft glow of the whole band
    for (let i = 0; i < 300; i++) {
      const u = pickU();
      const w = mwHalf(u);
      const b = mwBulge(u);
      const [x, y] = mwXY(u, gauss() * w * 0.7);
      glow(g, x, y, w * (0.7 + r() * 0.9), tone(u, 1.1), 0.03 + 0.045 * b);
    }
    // 2. patchy star clouds (noise-modulated, brighter near the bulge)
    for (let i = 0; i < 1100; i++) {
      const u = pickU();
      const w = mwHalf(u);
      const b = mwBulge(u);
      const n = fbm(u * 0.011 + 3);
      const [x, y] = mwXY(u, gauss() * w * 0.75);
      glow(g, x, y, 12 + r() * 42, tone(u, 1.3), (0.02 + 0.07 * n) * (0.45 + 0.9 * b));
    }
    // 3. warm, dense galactic core
    for (let i = 0; i < 40; i++) {
      const [x, y] = mwXY(MW.core + gauss() * 170, gauss() * 50);
      glow(g, x, y, 40 + r() * 60, [255, 230, 190], 0.05);
    }
  });
 
  // 4. dark dust lanes (the "Great Rift") - painted over the glow
  for (let i = 0; i < 520; i++) {
    const u = lerp(U0 + 300, U1 - 100, r());
    const w = mwHalf(u);
    const b = mwBulge(u);
    const v = mwRift(u) + gauss() * w * 0.09;
    const [x, y] = mwXY(u, v);
    const len = 30 + r() * 80;
    const a = (0.08 + 0.16 * r()) * (0.4 + 0.8 * b);
    g.save();
    g.translate(x, y);
    g.rotate(MW.ang);
    g.scale(1, 0.26);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, len);
    gr.addColorStop(0, `rgba(2,3,18,${a})`);
    gr.addColorStop(1, "rgba(2,3,18,0)");
    g.fillStyle = gr;
    circ(g, 0, 0, len);
    g.fill();
    g.restore();
  }
 
  // 5. thousands of faint stars, dense along the band, thinned inside the rift
  for (let i = 0; i < 7000; i++) {
    const u = pickU();
    const w = mwHalf(u);
    const b = mwBulge(u);
    if (r() > 0.3 + 0.7 * b) continue;
    const v = gauss() * w * 0.85;
    if (Math.abs(v - mwRift(u)) < w * 0.09 && r() < 0.75) continue;
    const [x, y] = mwXY(u, v);
    if (x < 0 || x > DW || y < 0 || y > 720) continue;
    const c = r() < 0.2 ? [255, 226, 190] : [214, 224, 255];
    const a = (0.06 + 0.5 * Math.pow(r(), 2)) * (0.5 + 0.7 * b) * (1 - smoothstep(560, 720, y) * 0.8);
    g.fillStyle = rgba(c, a);
    circ(g, x, y, 0.3 + r() * 0.75);
    g.fill();
  }
}
 
/* -------------------------------------------------------------------------- */
/* SKY (baked)                                                                */
/* -------------------------------------------------------------------------- */
 
function bakeSky(g) {
  const sky = g.createLinearGradient(0, 0, 0, DH);
  sky.addColorStop(0, "#01020a");
  sky.addColorStop(0.3, "#050924");
  sky.addColorStop(0.55, "#0f1548");
  sky.addColorStop(0.75, "#222b74");
  sky.addColorStop(1, "#3a3f90");
  g.fillStyle = sky;
  g.fillRect(0, 0, DW, DH);
 
  // horizon glow (violet -> rose)
  g.save();
  g.translate(DW * 0.45, 735);
  g.scale(1, 0.3);
  const hz = g.createRadialGradient(0, 0, 0, 0, 0, 1100);
  hz.addColorStop(0, "rgba(190,120,220,0.45)");
  hz.addColorStop(0.45, "rgba(120,100,230,0.22)");
  hz.addColorStop(1, "rgba(100,90,200,0)");
  g.fillStyle = hz;
  circ(g, 0, 0, 1100);
  g.fill();
  g.restore();
 
  // moon bloom
  glow(g, MOON.x, MOON.y, 620, [140, 175, 255], 0.28);
 
  // nebulae (a touch quieter so the Milky Way reads)
  add(g, () => {
    const neb = [
      [210, 330, 360, [96, 70, 220], 0.16],
      [540, 190, 320, [50, 130, 220], 0.1],
      [900, 120, 340, [170, 70, 200], 0.08],
      [1050, 420, 300, [40, 120, 190], 0.08],
      [420, 520, 320, [140, 70, 200], 0.09],
    ];
    const r = seeded(31);
    for (const [x, y, rad, c, a] of neb) {
      for (let k = 0; k < 6; k++) {
        glow(g, x + (r() - 0.5) * rad * 0.9, y + (r() - 0.5) * rad * 0.5, rad * (0.4 + r() * 0.5), c, a);
      }
    }
  });
 
  bakeMilkyWay(g);
 
  // background stars
  const sr = seeded(5);
  for (let i = 0; i < 650; i++) {
    const y = Math.pow(sr(), 1.25) * 720;
    const tint = sr();
    const c = tint > 0.85 ? [190, 215, 255] : tint < 0.1 ? [255, 215, 190] : [228, 236, 255];
    g.fillStyle = rgba(c, (0.2 + sr() * 0.5) * (1 - smoothstep(380, 740, y) * 0.7));
    circ(g, sr() * DW, y, 0.4 + sr() * 0.7);
    g.fill();
  }
}
 
function makeStars() {
  const r = seeded(808);
  const out = [];
  for (let i = 0; i < 160; i++) {
    const big = i < 16;
    let x = r() * DW;
    let y = Math.pow(r(), 1.3) * 660;
    // many twinklers sit along the Milky Way
    if (!big && r() < 0.45) {
      const u = lerp(-1000, 1000, r());
      const w = mwHalf(u);
      const [mx, my] = mwXY(u, (r() + r() + r() - 1.5) * w * 0.8);
      if (mx >= 0 && mx <= DW && my >= 0 && my <= 660) {
        x = mx;
        y = my;
      }
    }
    out.push({
      x,
      y,
      s: big ? 1.7 + r() * 0.9 : 0.8 + r() * 0.8,
      ph: r() * TAU,
      sp: 0.7 + r() * 2.2,
      c: r() > 0.7 ? [180, 215, 255] : r() > 0.88 ? [255, 214, 186] : [255, 246, 228],
      big,
    });
  }
  return out;
}
 
function drawStars(g, stars, t) {
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
    const a = (0.45 + 0.55 * tw) * (1 - smoothstep(420, 700, s.y) * 0.8);
    if (s.big) {
      glow(g, s.x, s.y, s.s * 8, s.c, 0.5 * a);
      g.strokeStyle = rgba(s.c, 0.5 * a);
      g.lineWidth = 0.8;
      const L = s.s * (5 + tw * 4);
      g.beginPath();
      g.moveTo(s.x - L, s.y);
      g.lineTo(s.x + L, s.y);
      g.moveTo(s.x, s.y - L);
      g.lineTo(s.x, s.y + L);
      g.stroke();
    }
    g.fillStyle = rgba(s.c, a);
    circ(g, s.x, s.y, s.s * (0.7 + 0.3 * tw));
    g.fill();
  }
}
 
/* -------------------------------------------------------------------------- */
/* AURORA (kept soft and away from the text column)                           */
/* -------------------------------------------------------------------------- */
 
const calm = (x) => 1 - 0.55 * (1 - smoothstep(0, 1, Math.abs(x - 836) / 380));
 
const AURORAS = [
  { y: 190, amp: 42, f: 0.0042, sp: 0.2, h: 150, c: [70, 255, 195], a: 0.2, x0: -80, x1: 1300 },
  { y: 255, amp: 32, f: 0.0055, sp: -0.16, h: 120, c: [120, 155, 255], a: 0.15, x0: 200, x1: 1700 },
  { y: 140, amp: 26, f: 0.0068, sp: 0.13, h: 100, c: [200, 120, 255], a: 0.12, x0: 0, x1: 950 },
];
 
function drawAurora(g, t) {
  add(g, () => {
    AURORAS.forEach((a, k) => {
      const yAt = (x) =>
        a.y + Math.sin(x * a.f + t * a.sp + k * 2) * a.amp + Math.sin(x * a.f * 2.3 - t * a.sp * 0.7) * a.amp * 0.4;
      const fade = (x) => smoothstep(a.x0, a.x0 + 260, x) * (1 - smoothstep(a.x1 - 260, a.x1, x)) * calm(x);
      const gr = g.createLinearGradient(0, a.y - a.amp - 10, 0, a.y + a.amp + a.h);
      gr.addColorStop(0, rgba(a.c, 0));
      gr.addColorStop(0.12, rgba(a.c, a.a));
      gr.addColorStop(1, rgba(a.c, 0));
 
      const hAt = (x) => a.h * (0.55 + 0.45 * Math.sin(x * 0.011 + t * 0.4 + k)) * fade(x);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(a.x0, yAt(a.x0));
      for (let x = a.x0; x <= a.x1; x += 10) g.lineTo(x, yAt(x));
      for (let x = a.x1; x >= a.x0; x -= 10) g.lineTo(x, yAt(x) + hAt(x) + 2);
      g.closePath();
      g.fill();
 
      g.lineWidth = 2;
      for (let x = a.x0 + 20; x < a.x1; x += 18) {
        const f = fade(x);
        if (f < 0.04) continue;
        const y = yAt(x);
        const len = a.h * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.03 + t * 0.6 + k))) * f;
        const sg = g.createLinearGradient(0, y, 0, y + len);
        sg.addColorStop(0, rgba(a.c, a.a * 0.3 * f));
        sg.addColorStop(1, rgba(a.c, 0));
        g.strokeStyle = sg;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + len);
        g.stroke();
      }
    });
  });
}
 
/* -------------------------------------------------------------------------- */
/* CONSTELLATIONS + TELESCOPE TARGETING                                       */
/* -------------------------------------------------------------------------- */
 
const STAR_W = [240, 244, 255];
const STAR_B = [176, 210, 255];
const STAR_O = [255, 186, 138];
const STAR_G = [255, 226, 170];
 
// stars: [x, y, size, colour, optional name]
const CONSTELLATIONS = [
  {
    key: "cygnus",
    name: "Cygnus",
    stars: [
      [560, 195, 2.3, STAR_B, "Deneb"],
      [572, 262, 1.9, STAR_W, "Sadr"],
      [586, 340, 2.0, STAR_G, "Albireo"],
      [505, 252, 1.6, STAR_W],
      [640, 238, 1.5, STAR_W],
    ],
    links: [[0, 1], [1, 2], [3, 1], [1, 4]],
  },
  {
    key: "cassiopeia",
    name: "Cassiopeia",
    stars: [
      [642, 126, 1.6, STAR_W, "Segin"],
      [686, 158, 1.7, STAR_W, "Ruchbah"],
      [730, 122, 2.0, STAR_B, "Gamma Cas"],
      [776, 164, 2.2, STAR_O, "Schedar"],
      [826, 132, 1.9, STAR_W, "Caph"],
    ],
    links: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    key: "ursa",
    name: "Ursa Major",
    stars: [
      [890, 112, 2.1, STAR_O, "Dubhe"],
      [884, 170, 1.8, STAR_W, "Merak"],
      [954, 182, 1.6, STAR_W, "Phecda"],
      [958, 130, 1.5, STAR_W, "Megrez"],
      [1020, 118, 2.0, STAR_W, "Alioth"],
      [1082, 98, 2.0, STAR_W, "Mizar"],
      [1146, 118, 2.0, STAR_B, "Alkaid"],
      [1094, 90, 0.9, STAR_W],
    ],
    links: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  {
    key: "orion",
    name: "Orion",
    stars: [
      [948, 266, 1.5, STAR_W, "Meissa"],
      [898, 292, 2.5, STAR_O, "Betelgeuse"],
      [1000, 298, 2.0, STAR_B, "Bellatrix"],
      [920, 345, 1.8, STAR_B, "Alnitak"],
      [948, 340, 1.9, STAR_B, "Alnilam"],
      [976, 335, 1.8, STAR_B, "Mintaka"],
      [905, 412, 1.7, STAR_B, "Saiph"],
      [1006, 402, 2.5, STAR_B, "Rigel"],
      [949, 365, 0.9, STAR_W],
      [949, 385, 1.1, STAR_W],
    ],
    links: [[0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5], [3, 6], [5, 7], [4, 8], [8, 9]],
  },
];
 
for (const cn of CONSTELLATIONS) {
  cn.lx = cn.stars.reduce((s, p) => s + p[0], 0) / cn.stars.length;
  cn.ly = Math.max(...cn.stars.map((p) => p[1])) + 36;
}
 
// Stars the telescope visits, in order. Chosen so every angle stays inside the dome slit.
const TARGETS = [
  ["cygnus", 2],
  ["cassiopeia", 3],
  ["ursa", 0],
  ["ursa", 5],
  ["orion", 1],
  ["ursa", 6],
].map(([key, i]) => {
  const cn = CONSTELLATIONS.find((c) => c.key === key);
  const s = cn.stars[i];
  return { key, i, x: s[0], y: s[1], name: s[4] || cn.name, cname: cn.name };
});
 
// The telescope pivot (fixed point on its pier, inside the open dome slit).
const PIVOT = { x: OBS.x + Math.sin(0.6) * OBS.R * 0.85, y: OBS.domeY - 40 };
const TLEN = 112;
 
for (const tg of TARGETS) tg.ang = Math.atan2(tg.y - PIVOT.y, tg.x - PIVOT.x);
 
const SCAN = 13; // seconds per target
const SLEW = 3.4; // of which this long is spent slewing
 
// Stateless: a pure function of time. Slew -> settle -> lock.
function telescopeState(t) {
  const n = TARGETS.length;
  const k = Math.floor(t / SCAN);
  const local = t - k * SCAN;
  const cur = TARGETS[((k % n) + n) % n];
  const prev = TARGETS[(((k - 1) % n) + n) % n];
  let aim;
  let lock = 0;
  if (local < SLEW) {
    aim = lerp(prev.ang, cur.ang, smootherstep(local / SLEW));
  } else {
    const q = local - SLEW;
    // tiny damped wobble as the mount settles, then a hair of tracking drift
    aim = cur.ang + Math.sin(q * 9) * Math.exp(-q * 1.8) * 0.012 + Math.sin(t * 0.7) * 0.0012;
    lock = smoothstep(0.3, 1.5, q) * (1 - smoothstep(SCAN - SLEW - 1.6, SCAN - SLEW, q));
  }
  return { aim, lock, slewing: local < SLEW, target: cur };
}
 
function drawConstellations(g, t, ts) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.8);
 
  for (const cn of CONSTELLATIONS) {
    const obs = ts.target.key === cn.key ? ts.lock : 0;
 
    g.lineWidth = 1;
    g.strokeStyle = rgba([232, 208, 150], 0.12 + pulse * 0.05 + obs * 0.38);
    g.beginPath();
    for (const [a, b] of cn.links) {
      g.moveTo(cn.stars[a][0], cn.stars[a][1]);
      g.lineTo(cn.stars[b][0], cn.stars[b][1]);
    }
    g.stroke();
 
    cn.stars.forEach((s, i) => {
      const [x, y, sz, col] = s;
      const tw = 0.7 + 0.3 * Math.sin(t * (1.1 + i * 0.37) + i * 1.7 + cn.name.length);
      const isTarget = obs > 0 && ts.target.i === i;
      const bright = 1 + (isTarget ? obs * 0.9 : obs * 0.25);
      add(g, () => glow(g, x, y, sz * 7 * bright, col, 0.34 * tw));
      g.fillStyle = rgba(mix(col, [255, 255, 255], 0.4), 0.55 + 0.4 * tw);
      circ(g, x, y, sz * (0.8 + 0.2 * tw));
      g.fill();
    });
 
    if (obs > 0.01) {
      g.save();
      g.textAlign = "center";
      g.font = "13px Georgia, 'Times New Roman', serif";
      if ("letterSpacing" in g) g.letterSpacing = "5px";
      g.fillStyle = rgba([244, 226, 178], 0.6 * obs);
      g.fillText(cn.name.toUpperCase(), cn.lx, cn.ly);
      g.restore();
    }
  }
 
  // targeting reticle on the star being observed
  if (ts.lock > 0.01) {
    const { x, y, name } = ts.target;
    const L = ts.lock;
    add(g, () => glow(g, x, y, 34, [150, 225, 255], 0.3 * L));
    g.save();
    g.translate(x, y);
    g.rotate(t * 0.5);
    g.strokeStyle = rgba([140, 220, 255], 0.7 * L);
    g.lineWidth = 1.2;
    const r0 = 15 + Math.sin(t * 3) * 1.2;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(0, 0, r0, (k * TAU) / 4 + 0.25, (k * TAU) / 4 + TAU / 4 - 0.25);
      g.stroke();
    }
    g.restore();
    g.save();
    g.textAlign = "left";
    g.font = "italic 13px Georgia, 'Times New Roman', serif";
    g.fillStyle = rgba([200, 235, 255], 0.75 * L);
    g.fillText(name, x + 24, y + 4);
    g.restore();
  }
}
 
/* -------------------------------------------------------------------------- */
/* CELESTIAL: orrery rings, planets, moon, meteors                            */
/* -------------------------------------------------------------------------- */
 
// A faint cartographer's orrery around the moon.
function drawOrrery(g, t) {
  const { x, y } = MOON;
  const gold = [236, 206, 150];
  g.save();
  g.translate(x, y);
  g.lineWidth = 1;
  const rings = [
    { r: 150, dash: [2, 9], sp: 3, dot: 0.22, a: 0.16 },
    { r: 205, dash: [14, 10], sp: -2, dot: -0.16, a: 0.12 },
    { r: 270, dash: [1, 6], sp: 1.5, dot: 0.1, a: 0.1 },
  ];
  rings.forEach((rg, i) => {
    g.strokeStyle = rgba(gold, rg.a);
    g.setLineDash(rg.dash);
    g.lineDashOffset = t * rg.sp;
    g.beginPath();
    g.arc(0, 0, rg.r, 0, TAU);
    g.stroke();
    g.setLineDash([]);
    const ang = t * rg.dot + i * 2;
    const px = Math.cos(ang) * rg.r;
    const py = Math.sin(ang) * rg.r;
    add(g, () => glow(g, px, py, 12, gold, 0.5));
    g.fillStyle = rgba([255, 240, 205], 0.8);
    circ(g, px, py, 2.1);
    g.fill();
  });
 
  // compass ticks
  g.rotate(t * 0.012);
  g.strokeStyle = rgba(gold, 0.18);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const major = i % 6 === 0;
    const r0 = 330;
    const r1 = r0 + (major ? 14 : 6);
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.stroke();
  }
  g.restore();
}
 
function drawRingedPlanet(g, x, y, r, t) {
  const tilt = -0.32;
  const ringHalf = (front) => {
    g.save();
    g.translate(x, y);
    g.rotate(tilt);
    for (const [rx, w, a] of [
      [1.95, 0.1, 0.38],
      [1.65, 0.16, 0.5],
      [1.38, 0.05, 0.28],
    ]) {
      g.strokeStyle = `rgba(214,200,255,${a})`;
      g.lineWidth = r * w;
      g.beginPath();
      g.ellipse(0, 0, r * rx, r * rx * 0.24, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
      g.stroke();
    }
    g.restore();
  };
 
  add(g, () => glow(g, x, y, r * 3.2, [150, 110, 255], 0.16));
  ringHalf(false);
 
  const pg = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
  pg.addColorStop(0, "#e2c6ff");
  pg.addColorStop(0.5, "#8a5fd6");
  pg.addColorStop(1, "#1a1245");
  g.fillStyle = pg;
  circ(g, x, y, r);
  g.fill();
 
  g.save();
  circ(g, x, y, r);
  g.clip();
  for (let i = -3; i <= 3; i++) {
    g.fillStyle = `rgba(${i % 2 ? "255,225,255" : "60,30,120"},${0.12 + 0.04 * Math.abs(i)})`;
    g.save();
    g.translate(x, y + i * r * 0.22);
    g.rotate(tilt * 0.4);
    g.fillRect(-r, -r * 0.05, r * 2, r * 0.1 + Math.sin(t * 0.2 + i) * 1.5);
    g.restore();
  }
  const sh = g.createLinearGradient(x - r, y, x + r, y);
  sh.addColorStop(0, "rgba(4,4,24,0.6)");
  sh.addColorStop(0.55, "rgba(4,4,24,0)");
  g.fillStyle = sh;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
 
  ringHalf(true);
}
 
function drawSmallPlanet(g, x, y, r, c1, c2) {
  add(g, () => glow(g, x, y, r * 2.8, c1, 0.15));
  const pg = g.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  pg.addColorStop(0, rgba(c1));
  pg.addColorStop(0.65, rgba(c2));
  pg.addColorStop(1, "#06071a");
  g.fillStyle = pg;
  circ(g, x, y, r);
  g.fill();
}
 
function drawMoon(g, t) {
  const { x, y, r } = MOON;
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.3);
  add(g, () => {
    glow(g, x, y, r * 3 + pulse * 12, [170, 195, 255], 0.26);
    glow(g, x, y, r * 1.5, [210, 225, 255], 0.2);
  });
 
  const mg = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  mg.addColorStop(0, "#ffffff");
  mg.addColorStop(0.5, "#dfe6fa");
  mg.addColorStop(1, "#8f9bc4");
  g.fillStyle = mg;
  circ(g, x, y, r);
  g.fill();
 
  g.save();
  circ(g, x, y, r);
  g.clip();
  for (const [mx, my, mr] of [
    [-0.28, -0.2, 0.34],
    [0.18, -0.34, 0.24],
    [0.1, 0.12, 0.3],
    [-0.4, 0.28, 0.2],
  ]) {
    g.fillStyle = "rgba(100,112,158,0.28)";
    circ(g, x + mx * r, y + my * r, mr * r);
    g.fill();
  }
  const cr = seeded(12);
  for (let i = 0; i < 20; i++) {
    const a = cr() * TAU;
    const d = Math.sqrt(cr()) * r * 0.92;
    const cx = x + Math.cos(a) * d;
    const cy = y + Math.sin(a) * d;
    const rr = r * (0.025 + cr() * 0.055);
    g.fillStyle = "rgba(90,102,146,0.22)";
    circ(g, cx, cy, rr);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.2)";
    g.lineWidth = 0.9;
    g.beginPath();
    g.arc(cx, cy, rr, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
  }
  // soft terminator (waxing gibbous)
  const tx = x - r * 0.62;
  const sg = g.createRadialGradient(tx, y, r * 0.55, tx, y, r * 1.15);
  sg.addColorStop(0, "rgba(10,14,48,0.72)");
  sg.addColorStop(0.7, "rgba(10,14,48,0.5)");
  sg.addColorStop(1, "rgba(10,14,48,0)");
  g.fillStyle = sg;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
 
  g.strokeStyle = "rgba(220,232,255,0.28)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(x, y, r, -1.2, 1.2);
  g.stroke();
}
 
// Stateless: a pure function of time, so it can never get stuck.
function drawShootingStars(g, t) {
  const SLOT = 5.5;
  for (let k = Math.floor(t / SLOT) - 1; k <= Math.floor(t / SLOT); k++) {
    if (hash(k * 1.7) < 0.35) continue;
    const start = k * SLOT + hash(k * 3.1) * 3.5;
    const dur = 0.9 + hash(k * 5.3) * 0.4;
    const p = (t - start) / dur;
    if (p < 0 || p > 1) continue;
    const x0 = 100 + hash(k * 2.3) * 1300;
    const y0 = 40 + hash(k * 4.7) * 240;
    const ang = 0.45 + hash(k * 6.1) * 0.25;
    const x = x0 + Math.cos(ang) * 380 * p;
    const y = y0 + Math.sin(ang) * 380 * p;
    const L = 130;
    const a = Math.sin(p * Math.PI);
    const gr = g.createLinearGradient(x, y, x - Math.cos(ang) * L, y - Math.sin(ang) * L);
    gr.addColorStop(0, `rgba(255,255,255,${a})`);
    gr.addColorStop(1, "rgba(120,170,255,0)");
    g.strokeStyle = gr;
    g.lineWidth = 2.2;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - Math.cos(ang) * L, y - Math.sin(ang) * L);
    g.stroke();
    add(g, () => glow(g, x, y, 12, [200, 225, 255], 0.8 * a));
  }
}
 
/* -------------------------------------------------------------------------- */
/* MOONLIT WISPS                                                              */
/* -------------------------------------------------------------------------- */
 
const WISPS = [
  { y: 150, w: 900, h: 190, sp: 5, a: 0.5, seed: 1 },
  { y: 330, w: 1000, h: 200, sp: 8, a: 0.36, seed: 2 },
  { y: 460, w: 820, h: 170, sp: 3.6, a: 0.28, seed: 3 },
];
 
function makeWisp(wp, q) {
  return sprite(wp.w, wp.h, q, (g) => {
    const r = seeded(wp.seed * 17);
    for (let i = 0; i < 16; i++) {
      const p = i / 15;
      const arch = Math.sin(p * Math.PI);
      const x = wp.w * (0.08 + 0.84 * p);
      const y = wp.h * (0.6 - 0.18 * arch * r());
      const rx = wp.w * (0.07 + 0.08 * r()) * (0.5 + arch);
      const ry = wp.h * (0.12 + 0.12 * r());
      g.save();
      g.translate(x, y);
      g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, -rx * 0.2, 0, 0, 0, rx);
      gr.addColorStop(0, "rgba(176,188,246,0.34)");
      gr.addColorStop(0.5, "rgba(110,120,206,0.18)");
      gr.addColorStop(1, "rgba(80,90,180,0)");
      g.fillStyle = gr;
      circ(g, 0, 0, rx);
      g.fill();
      g.restore();
    }
  });
}
 
function drawWisps(g, sprites, t) {
  WISPS.forEach((wp, i) => {
    const span = DW + wp.w;
    const x = ((t * wp.sp + i * 500) % span) - wp.w;
    g.globalAlpha = wp.a;
    g.drawImage(sprites[i], x, wp.y - wp.h / 2, wp.w, wp.h);
  });
  g.globalAlpha = 1;
}
 
/* -------------------------------------------------------------------------- */
/* FAR LAND (baked): mountains, village lights, treeline, lake                */
/* -------------------------------------------------------------------------- */
 
function pine(g, x, y, s, rim) {
  g.fillStyle = "#04061a";
  g.fillRect(x - 2 * s, y - 14 * s, 4 * s, 16 * s);
  for (let i = 0; i < 6; i++) {
    const yy = y - (8 + i * 17) * s;
    const hw = (30 - i * 4.4) * s;
    g.beginPath();
    g.moveTo(x, yy - 26 * s);
    g.lineTo(x - hw, yy);
    g.lineTo(x + hw, yy);
    g.closePath();
    g.fill();
  }
  if (rim) {
    g.fillStyle = "rgba(120,150,235,0.18)";
    for (let i = 0; i < 6; i++) {
      const yy = y - (8 + i * 17) * s;
      const hw = (30 - i * 4.4) * s;
      g.beginPath();
      g.moveTo(x, yy - 26 * s);
      g.lineTo(x + hw, yy);
      g.lineTo(x + hw * 0.7, yy);
      g.closePath();
      g.fill();
    }
  }
}
 
function bakeFar(g) {
  const ranges = [
    { base: 545, amp: 150, sc: 0.0048, c: [34, 42, 104], a: 0.92, seed: 3 },
    { base: 605, amp: 120, sc: 0.0066, c: [22, 28, 76], a: 0.96, seed: 8 },
    { base: 668, amp: 95, sc: 0.009, c: [14, 17, 52], a: 1, seed: 14 },
  ];
  let lastPts = null;
  for (const m of ranges) {
    const pts = [];
    for (let x = -10; x <= DW + 10; x += 8) pts.push([x, m.base - Math.pow(fbm(x * m.sc + m.seed), 1.6) * m.amp * 1.6]);
    const gr = g.createLinearGradient(0, m.base - m.amp, 0, m.base + 60);
    gr.addColorStop(0, rgba(mix([48, 56, 130], m.c, 0.5), m.a));
    gr.addColorStop(1, rgba(m.c, m.a));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-10, DH);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.lineTo(DW + 10, DH);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(160,185,255,0.2)";
    g.lineWidth = 1.4;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.stroke();
    lastPts = pts;
  }
 
  // tiny village lights nestled in the last range
  const vr = seeded(66);
  add(g, () => {
    for (let i = 0; i < 26; i++) {
      const cluster = i < 14 ? 1180 : 760;
      const x = cluster + (vr() - 0.5) * 220;
      const idx = clamp(Math.round((x + 10) / 8), 0, lastPts.length - 1);
      const y = lastPts[idx][1] + 14 + vr() * 26;
      glow(g, x, y, 7, [255, 200, 120], 0.5);
      g.fillStyle = "rgba(255,226,160,0.95)";
      g.fillRect(x - 1, y - 1, 2, 2);
    }
  });
 
  // far-shore treeline
  const tr = seeded(404);
  g.fillStyle = "#04061a";
  g.fillRect(0, LAKE_Y - 8, DW, 12);
  for (let x = 380; x < DW + 20; x += 11 + tr() * 8) {
    pine(g, x, LAKE_Y + 2, 0.22 + tr() * 0.26, false);
  }
 
  // lake
  const lake = g.createLinearGradient(0, LAKE_Y, 0, DH);
  lake.addColorStop(0, "#313c92");
  lake.addColorStop(0.18, "#1c2468");
  lake.addColorStop(0.55, "#0b0f36");
  lake.addColorStop(1, "#03041a");
  g.fillStyle = lake;
  g.fillRect(0, LAKE_Y, DW, DH - LAKE_Y);
 
  add(g, () => {
    glow(g, 520, 790, 340, [120, 80, 210], 0.14);
    glow(g, 1000, 780, 380, [60, 110, 210], 0.1);
    // reflected village lights
    for (let i = 0; i < 14; i++) {
      const x = 1180 + (vr() - 0.5) * 220;
      g.fillStyle = `rgba(255,205,130,${0.12 + vr() * 0.14})`;
      g.fillRect(x, LAKE_Y + 6, 1.4, 18 + vr() * 18);
    }
  });
}
 
/* -------------------------------------------------------------------------- */
/* NEAR LAND (baked): hill, observatory, trees, boat, reeds, girl             */
/* -------------------------------------------------------------------------- */
 
function drawGirl(g, x, y, s) {
  g.fillStyle = "#04051a";
  g.beginPath();
  g.moveTo(x - 4 * s, y - 31 * s);
  g.quadraticCurveTo(x - 12 * s, y - 8 * s, x - 11 * s, y);
  g.lineTo(x + 11 * s, y);
  g.quadraticCurveTo(x + 12 * s, y - 8 * s, x + 4 * s, y - 31 * s);
  g.closePath();
  g.fill();
  g.fillRect(x - 4 * s, y - 46 * s, 8 * s, 17 * s);
  circ(g, x, y - 52 * s, 5.2 * s);
  g.fill();
  g.beginPath();
  g.moveTo(x - 4 * s, y - 56 * s);
  g.quadraticCurveTo(x - 14 * s, y - 46 * s, x - 9 * s, y - 30 * s);
  g.quadraticCurveTo(x - 5 * s, y - 44 * s, x - 2 * s, y - 49 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = "#04051a";
  g.lineWidth = 2.6 * s;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x + 3 * s, y - 44 * s);
  g.lineTo(x + 12 * s, y - 36 * s);
  g.stroke();
  g.strokeStyle = "rgba(170,195,255,0.4)";
  g.lineWidth = 1;
  g.beginPath();
  g.arc(x, y - 52 * s, 5.2 * s, -1.2, 0.6);
  g.stroke();
}
 
function bakeNear(g) {
  const { x, base, bw, bh, domeY } = OBS;
  const top = base - bh;
 
  // hill
  g.beginPath();
  g.moveTo(-10, DH);
  for (let xx = -10; xx <= 700; xx += 6) g.lineTo(xx, hillY(xx));
  g.lineTo(700, DH);
  g.closePath();
  const hg = g.createLinearGradient(0, 690, 0, DH);
  hg.addColorStop(0, "#0e1233");
  hg.addColorStop(0.35, "#060820");
  hg.addColorStop(1, "#02030c");
  g.fillStyle = hg;
  g.fill();
  g.strokeStyle = "rgba(140,165,245,0.28)";
  g.lineWidth = 1.6;
  g.beginPath();
  for (let xx = -10; xx <= 690; xx += 6) (xx < 0 ? g.moveTo(xx, hillY(xx)) : g.lineTo(xx, hillY(xx)));
  g.stroke();
 
  // winding path
  g.fillStyle = "rgba(130,140,215,0.14)";
  g.beginPath();
  g.moveTo(x - 20, base);
  g.bezierCurveTo(x - 30, 760, x + 120, 790, x + 70, 850);
  g.bezierCurveTo(x + 30, 900, x + 150, 920, x + 120, DH);
  g.lineTo(x + 260, DH);
  g.bezierCurveTo(x + 250, 910, x + 130, 890, x + 150, 850);
  g.bezierCurveTo(x + 180, 790, x + 40, 770, x + 20, base);
  g.closePath();
  g.fill();
 
  // back pines
  for (const [px, py, ps] of [[640, 800, 0.9], [600, 818, 1.1], [60, 760, 1.0]]) pine(g, px, py, ps, true);
 
  // stair tower
  const tx = x - 168;
  const tg = g.createLinearGradient(tx - 28, 0, tx + 28, 0);
  tg.addColorStop(0, "#161a3e");
  tg.addColorStop(1, "#3a4580");
  g.fillStyle = tg;
  g.fillRect(tx - 28, base - 200, 56, 200);
  g.fillStyle = "rgba(160,175,230,0.1)";
  for (let yy = base - 190; yy < base; yy += 13) g.fillRect(tx - 28, yy, 56, 1);
  g.fillStyle = "#2a2358";
  g.beginPath();
  g.moveTo(tx - 38, base - 200);
  g.lineTo(tx, base - 268);
  g.lineTo(tx + 38, base - 200);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(160,180,255,0.25)";
  g.beginPath();
  g.moveTo(tx, base - 268);
  g.lineTo(tx + 38, base - 200);
  g.lineTo(tx + 20, base - 200);
  g.closePath();
  g.fill();
  g.strokeStyle = "#cdb27a";
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(tx, base - 268);
  g.lineTo(tx, base - 288);
  g.stroke();
 
  // main body
  const bg = g.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
  bg.addColorStop(0, "#191d42");
  bg.addColorStop(0.6, "#2b3264");
  bg.addColorStop(1, "#435088");
  g.fillStyle = bg;
  rrect(g, x - bw / 2, top, bw, bh, 6);
  g.fill();
  const sh = g.createLinearGradient(0, top, 0, base);
  sh.addColorStop(0, "rgba(10,12,36,0)");
  sh.addColorStop(1, "rgba(4,5,16,0.75)");
  g.fillStyle = sh;
  g.fillRect(x - bw / 2, top, bw, bh);
  g.strokeStyle = "rgba(160,175,230,0.1)";
  g.lineWidth = 1;
  for (let yy = top + 12; yy < base; yy += 12) {
    g.beginPath();
    g.moveTo(x - bw / 2, yy);
    g.lineTo(x + bw / 2, yy);
    g.stroke();
  }
  g.fillStyle = "#4b5894";
  g.fillRect(x - bw / 2 - 8, top - 6, bw + 16, 9);
  g.fillStyle = "#0d1030";
  g.fillRect(x - bw / 2 - 8, base - 8, bw + 16, 10);
  for (const px of [-bw / 2 + 12, -22, 22, bw / 2 - 12]) {
    const pg = g.createLinearGradient(x + px - 6, 0, x + px + 6, 0);
    pg.addColorStop(0, "#232850");
    pg.addColorStop(1, "#4d5a98");
    g.fillStyle = pg;
    g.fillRect(x + px - 6, top, 12, bh - 8);
  }
  // door + steps
  g.fillStyle = "#05071b";
  g.beginPath();
  g.moveTo(x - 17, base - 8);
  g.lineTo(x - 17, base - 52);
  g.arc(x, base - 52, 17, Math.PI, 0);
  g.lineTo(x + 17, base - 8);
  g.closePath();
  g.fill();
  g.fillStyle = "#1c2048";
  g.fillRect(x - 40, base - 4, 80, 5);
  g.fillStyle = "#14173a";
  g.fillRect(x - 50, base + 1, 100, 5);
 
  // drum under the dome
  const dg = g.createLinearGradient(x - 128, 0, x + 128, 0);
  dg.addColorStop(0, "#161a3c");
  dg.addColorStop(0.6, "#2e3668");
  dg.addColorStop(1, "#5568a8");
  g.fillStyle = dg;
  g.fillRect(x - 128, domeY, 256, top - domeY);
  g.fillStyle = "#cdb27a";
  g.fillRect(x - 130, domeY - 2, 260, 4);
  g.fillRect(x - 130, top - 9, 260, 3);
 
  // terrace + small brass telescope
  const terX = x + bw / 2 + 4;
  g.fillStyle = "#12163a";
  g.fillRect(terX, base - 22, 64, 22);
  g.fillStyle = "#3a4580";
  g.fillRect(terX - 3, base - 25, 70, 4);
  g.strokeStyle = "#05071b";
  g.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.moveTo(terX + 4 + i * 8, base - 25);
    g.lineTo(terX + 4 + i * 8, base - 44);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(terX, base - 44);
  g.lineTo(terX + 66, base - 44);
  g.stroke();
  const sx = terX + 30;
  g.beginPath();
  g.moveTo(sx, base - 60);
  g.lineTo(sx - 12, base - 25);
  g.moveTo(sx, base - 60);
  g.lineTo(sx + 12, base - 25);
  g.moveTo(sx, base - 60);
  g.lineTo(sx, base - 25);
  g.stroke();
  g.save();
  g.translate(sx, base - 62);
  g.rotate(-0.95);
  const tel = g.createLinearGradient(0, -4, 0, 4);
  tel.addColorStop(0, "#e2c88c");
  tel.addColorStop(1, "#6d5a3a");
  g.fillStyle = tel;
  g.fillRect(-10, -4, 52, 8);
  g.fillStyle = "#cdb27a";
  g.fillRect(38, -5.5, 6, 11);
  g.restore();
 
  // lamp posts
  for (const lx of [x - 62, x + 62]) {
    g.fillStyle = "#04061a";
    g.fillRect(lx - 1.8, base + 8 - 56, 3.6, 56);
    g.fillRect(lx - 7, base + 8 - 60, 14, 4);
  }
 
  drawGirl(g, GIRL.x, GIRL.y, 1.25);
 
  // foreground pines framing the left edge
  pine(g, 28, 930, 2.5, true);
  pine(g, 150, 960, 2.0, true);
 
  // boat
  const { x: bx, y: by } = BOAT;
  g.fillStyle = "#04051a";
  g.beginPath();
  g.moveTo(bx - 34, by - 4);
  g.quadraticCurveTo(bx - 22, by + 12, bx, by + 12);
  g.quadraticCurveTo(bx + 24, by + 12, bx + 38, by - 8);
  g.quadraticCurveTo(bx, by - 2, bx - 34, by - 4);
  g.closePath();
  g.fill();
  g.strokeStyle = "#04051a";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(bx + 24, by - 7);
  g.lineTo(bx + 24, by - 36);
  g.quadraticCurveTo(bx + 24, by - 40, bx + 18, by - 40);
  g.stroke();
  circ(g, bx - 6, by - 19, 4.2);
  g.fill();
  g.beginPath();
  g.moveTo(bx - 12, by - 3);
  g.quadraticCurveTo(bx - 12, by - 14, bx - 6, by - 14);
  g.quadraticCurveTo(bx, by - 14, bx, by - 3);
  g.closePath();
  g.fill();
 
  // reeds + rocks (lower right)
  const rr = seeded(707);
  g.strokeStyle = "#03041a";
  g.lineCap = "round";
  for (let i = 0; i < 70; i++) {
    const rx = 1380 + rr() * 320;
    const ry = DH + 4;
    const hgt = 70 + rr() * 150;
    const lean = (rr() - 0.5) * 30;
    g.lineWidth = 1.6 + rr() * 1.4;
    g.beginPath();
    g.moveTo(rx, ry);
    g.quadraticCurveTo(rx + lean * 0.3, ry - hgt * 0.6, rx + lean, ry - hgt);
    g.stroke();
    if (i % 4 === 0) {
      g.fillStyle = "#03041a";
      ell(g, rx + lean, ry - hgt - 7, 2.6, 8, lean * 0.01);
      g.fill();
    }
  }
  g.fillStyle = "#03041a";
  ell(g, 1520, DH + 8, 130, 30);
  g.fill();
  ell(g, 1640, DH + 6, 90, 36);
  g.fill();
}
 
/* -------------------------------------------------------------------------- */
/* LIVE: dome, telescope, lights                                              */
/* -------------------------------------------------------------------------- */
 
function drawTelescope(g, t, ts) {
  const { x: px, y: py } = PIVOT;
  const { aim, lock, slewing } = ts;
 
  // pier standing on the dome floor
  const pg = g.createLinearGradient(px - 12, 0, px + 12, 0);
  pg.addColorStop(0, "#14183a");
  pg.addColorStop(0.5, "#3c4678");
  pg.addColorStop(1, "#1a1f48");
  g.fillStyle = pg;
  g.beginPath();
  g.moveTo(px - 5, py + 4);
  g.lineTo(px + 5, py + 4);
  g.lineTo(px + 11, OBS.domeY);
  g.lineTo(px - 11, OBS.domeY);
  g.closePath();
  g.fill();
  g.fillStyle = "#cdb27a";
  g.fillRect(px - 12, OBS.domeY - 4, 24, 3);
 
  g.save();
  g.translate(px, py);
  g.rotate(aim);
 
  // main tube (slightly tapered, wider dew shield at the front)
  const body = g.createLinearGradient(0, -13, 0, 13);
  body.addColorStop(0, "#f0dca4");
  body.addColorStop(0.35, "#b79a62");
  body.addColorStop(0.75, "#5e4d33");
  body.addColorStop(1, "#262640");
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(-48, -7);
  g.lineTo(70, -9.5);
  g.lineTo(TLEN, -12.5);
  g.lineTo(TLEN, 12.5);
  g.lineTo(70, 9.5);
  g.lineTo(-48, 7);
  g.closePath();
  g.fill();
 
  // brass bands
  g.fillStyle = "#f2dfa8";
  for (const [bx, h] of [[-22, 8.2], [36, 10.2], [90, 12]]) g.fillRect(bx, -h, 4, h * 2);
  g.fillStyle = "#3a4270";
  g.fillRect(TLEN - 6, -13.5, 6, 27);
 
  // finder scope riding on top
  g.fillStyle = "#4a527f";
  g.fillRect(24, -17, 3, 8);
  g.fillRect(62, -19, 3, 10);
  const fg = g.createLinearGradient(0, -22, 0, -15);
  fg.addColorStop(0, "#e0c88e");
  fg.addColorStop(1, "#6d5a3a");
  g.fillStyle = fg;
  g.fillRect(14, -22, 62, 6);
  g.fillStyle = "#79c3e8";
  g.fillRect(74, -22, 2.5, 6);
 
  // focuser + eyepiece at the rear
  g.fillStyle = "#2a2f58";
  g.fillRect(-60, -3.5, 14, 7);
  g.fillStyle = "#cdb27a";
  g.fillRect(-66, -5, 6, 10);
 
  // objective lens
  g.fillStyle = `rgba(121,195,232,${0.75 + 0.25 * lock})`;
  ell(g, TLEN + 1, 0, 3.2, 11.5);
  g.fill();
 
  // status LED: amber blink while slewing, steady green once locked
  const led = slewing ? (Math.sin(t * 10) > 0 ? [255, 170, 70] : [90, 60, 30]) : mix([90, 60, 30], [120, 255, 170], lock);
  g.fillStyle = rgba(led, 1);
  circ(g, -36, -8.5, 1.6);
  g.fill();
  g.restore();
 
  // yoke hub
  g.fillStyle = "#cdb27a";
  circ(g, px, py, 7.5);
  g.fill();
  g.fillStyle = "#2a2f58";
  circ(g, px, py, 3);
  g.fill();
 
  // glints
  add(g, () => {
    const fx = px + Math.cos(aim) * (TLEN + 3);
    const fy = py + Math.sin(aim) * (TLEN + 3);
    glow(g, fx, fy, 16 + 22 * lock, [150, 225, 255], 0.2 + 0.4 * lock);
    if (lock > 0.05) {
      const ex = px - Math.cos(aim) * 62;
      const ey = py - Math.sin(aim) * 62;
      glow(g, ex, ey, 14, [255, 215, 150], 0.3 * lock);
    }
  });
}
 
// A faint beam along the telescope's line of sight; it reaches the star when locked.
function drawBeam(g, t, ts) {
  const { aim, lock, target } = ts;
  const fx = PIVOT.x + Math.cos(aim) * (TLEN + 3);
  const fy = PIVOT.y + Math.sin(aim) * (TLEN + 3);
  const full = Math.hypot(target.x - fx, target.y - fy);
  const D = lerp(300, full, lock);
  const ddx = Math.cos(aim);
  const ddy = Math.sin(aim);
  const nx = -ddy;
  const ny = ddx;
  const w0 = 3;
  const w1 = 3 + D * 0.03;
  add(g, () => {
    const gr = g.createLinearGradient(fx, fy, fx + ddx * D, fy + ddy * D);
    gr.addColorStop(0, `rgba(150,220,255,${0.16 + 0.06 * lock})`);
    gr.addColorStop(0.6, `rgba(150,220,255,${0.06 + 0.05 * lock})`);
    gr.addColorStop(1, `rgba(150,220,255,${0.05 * lock})`);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(fx + nx * w0, fy + ny * w0);
    g.lineTo(fx + ddx * D + nx * w1, fy + ddy * D + ny * w1);
    g.lineTo(fx + ddx * D - nx * w1, fy + ddy * D - ny * w1);
    g.lineTo(fx - nx * w0, fy - ny * w0);
    g.closePath();
    g.fill();
 
    if (lock > 0.05) {
      g.strokeStyle = `rgba(190,235,255,${0.25 * lock})`;
      g.lineWidth = 1;
      g.setLineDash([2, 7]);
      g.lineDashOffset = -t * 18;
      g.beginPath();
      g.moveTo(fx, fy);
      g.lineTo(target.x, target.y);
      g.stroke();
      g.setLineDash([]);
    }
  });
}
 
function drawDome(g, t, ts) {
  const { x, R, domeY: dy } = OBS;
  // the dome slit rotates to follow where the telescope is pointing
  const a = 0.6 + clamp((ts.aim + 0.55) * 0.35, -0.1, 0.1);
 
  g.save();
  g.beginPath();
  g.arc(x, dy, R, Math.PI, TAU);
  g.closePath();
  const dg = g.createLinearGradient(x - R, 0, x + R, 0);
  dg.addColorStop(0, "#121634");
  dg.addColorStop(0.55, "#2c3566");
  dg.addColorStop(1, "#6a7cc0");
  g.fillStyle = dg;
  g.fill();
  g.clip();
 
  const vg = g.createLinearGradient(0, dy - R, 0, dy);
  vg.addColorStop(0, "rgba(190,208,255,0.2)");
  vg.addColorStop(1, "rgba(5,6,24,0.5)");
  g.fillStyle = vg;
  g.fillRect(x - R, dy - R, R * 2, R);
 
  g.strokeStyle = "rgba(214,176,106,0.45)";
  g.lineWidth = 2;
  for (const f of [0.38, 0.72]) {
    g.beginPath();
    g.ellipse(x, dy - R * f, R * Math.sqrt(1 - f * f), R * 0.07, 0, 0, Math.PI);
    g.stroke();
  }
 
  g.lineWidth = 1.6;
  for (let k = -7; k <= 7; k++) {
    const ang = a + k * (Math.PI / 10);
    const vis = Math.cos(ang);
    if (vis < 0.05) continue;
    const sx = Math.sin(ang);
    g.strokeStyle = `rgba(185,200,245,${0.22 * vis})`;
    g.beginPath();
    g.moveTo(x + sx * R, dy);
    g.quadraticCurveTo(x + sx * R * 0.7, dy - R * 0.8, x, dy - R);
    g.stroke();
  }
 
  const d = 0.13;
  const xl = Math.sin(a - d) * R;
  const xr = Math.sin(a + d) * R;
  const front = Math.cos(a);
  const ig = g.createLinearGradient(0, dy - R, 0, dy);
  ig.addColorStop(0, "rgba(8,12,46,0.97)");
  ig.addColorStop(1, "rgba(70,44,72,0.97)");
  g.fillStyle = ig;
  g.beginPath();
  g.moveTo(x + xl, dy);
  g.quadraticCurveTo(x + xl * 0.7, dy - R * 0.8, x - 1, dy - R);
  g.lineTo(x + 1, dy - R);
  g.quadraticCurveTo(x + xr * 0.7, dy - R * 0.8, x + xr, dy);
  g.closePath();
  g.fill();
  add(g, () => glow(g, x + Math.sin(a) * R * 0.9, dy - R * 0.25, R * 0.45, [255, 190, 120], 0.22 * front));
  g.restore();
 
  g.strokeStyle = "rgba(175,195,255,0.4)";
  g.lineWidth = 1.8;
  g.beginPath();
  g.arc(x, dy, R, Math.PI * 1.45, TAU);
  g.stroke();
  g.fillStyle = "#cdb27a";
  circ(g, x, dy - R - 4, 4);
  g.fill();
  g.fillRect(x - 1, dy - R - 4, 2, 6);
 
  drawTelescope(g, t, ts);
  drawBeam(g, t, ts);
}
 
function drawLights(g, t) {
  const { x, base, bh } = OBS;
  const top = base - bh;
 
  const lit = (wx, wy, i, w = 8, h = 24) => {
    const flick = 0.82 + 0.12 * Math.sin(t * (1.1 + i * 0.13) + i * 2) + 0.06 * Math.sin(t * 7 + i);
    add(g, () => glow(g, wx, wy + h * 0.4, 44, [255, 190, 100], 0.26 * flick));
    g.fillStyle = `rgba(255,208,128,${0.92 * flick})`;
    g.beginPath();
    g.moveTo(wx - w, wy + h);
    g.lineTo(wx - w, wy + w);
    g.arc(wx, wy + w, w, Math.PI, 0);
    g.lineTo(wx + w, wy + h);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(90,50,40,0.55)";
    g.fillRect(wx - 0.6, wy, 1.2, h);
    g.fillRect(wx - w, wy + h * 0.55, w * 2, 1.2);
  };
 
  [-105, -55, 55, 105].forEach((ox, i) => lit(x + ox, top + 18, i));
  lit(OBS.x - 168, OBS.base - 160, 7, 7, 20);
  lit(OBS.x - 168, OBS.base - 100, 8, 7, 20);
  lit(OBS.x - 168, OBS.base - 44, 9, 7, 20);
 
  for (let i = -2; i <= 2; i++) {
    const f = 0.8 + 0.15 * Math.sin(t * 1.3 + i);
    add(g, () => glow(g, x + i * 46, OBS.domeY + 14, 22, [255, 190, 110], 0.22 * f));
    g.fillStyle = `rgba(255,214,140,${0.9 * f})`;
    circ(g, x + i * 46, OBS.domeY + 14, 4.4);
    g.fill();
  }
 
  add(g, () => glow(g, x, base - 30, 46, [255, 190, 110], 0.3));
  g.fillStyle = "rgba(255,196,120,0.3)";
  g.beginPath();
  g.moveTo(x - 17, base - 8);
  g.lineTo(x - 17, base - 52);
  g.arc(x, base - 52, 17, Math.PI, 0);
  g.lineTo(x + 17, base - 8);
  g.closePath();
  g.fill();
 
  for (const lx of [x - 62, x + 62]) {
    const f = 0.85 + 0.15 * Math.sin(t * 2.3 + lx);
    add(g, () => glow(g, lx, base - 52, 72, [255, 196, 120], 0.36 * f));
    g.fillStyle = `rgba(255,226,160,${0.95 * f})`;
    circ(g, lx, base - 52, 3.6);
    g.fill();
  }
 
  // girl's lantern
  const gx = GIRL.x + 12 * 1.25 + Math.sin(t * 1.2) * 0.8;
  const gy = GIRL.y - 30 * 1.25;
  const gf = 0.85 + 0.15 * Math.sin(t * 5);
  add(g, () => {
    glow(g, gx, gy, 90, [255, 190, 110], 0.36 * gf);
    glow(g, gx, gy, 26, [255, 230, 170], 0.7 * gf);
  });
  g.fillStyle = `rgba(255,236,180,${gf})`;
  circ(g, gx, gy, 3);
  g.fill();
 
  // boat lantern
  const bx = BOAT.x + 18 + Math.sin(t * 0.9) * 0.8;
  const by = BOAT.y - 36;
  const bf = 0.85 + 0.15 * Math.sin(t * 4 + 1);
  add(g, () => {
    glow(g, bx, by, 80, [255, 190, 110], 0.34 * bf);
    glow(g, bx, by, 20, [255, 232, 176], 0.65 * bf);
  });
  g.fillStyle = `rgba(255,238,184,${bf})`;
  circ(g, bx, by, 2.8);
  g.fill();
}
 
/* -------------------------------------------------------------------------- */
/* LIVE: lake shimmer, reflections, ripples                                   */
/* -------------------------------------------------------------------------- */
 
const GLINTS = (() => {
  const r = seeded(321);
  const out = [];
  for (let i = 0; i < 70; i++) {
    out.push({ x: 560 + r() * 1100, y: LAKE_Y + 12 + Math.pow(r(), 1.2) * 180, w: 4 + r() * 12, ph: r() * TAU, sp: 0.8 + r() * 2 });
  }
  return out;
})();
 
function drawLake(g, t) {
  add(g, () => {
    for (let i = 0; i < 34; i++) {
      const y = LAKE_Y + 8 + i * 5.6;
      const k = i / 34;
      const w = 26 + k * 70 + Math.sin(t * 1.4 + i * 0.8) * 10;
      const off = Math.sin(t * 0.9 + i * 0.55) * (4 + k * 22);
      g.fillStyle = `rgba(205,222,255,${(0.34 - k * 0.22) * (0.55 + 0.45 * Math.sin(t * 2 + i))})`;
      g.fillRect(MOON.x + off - w / 2, y, w, 1.7);
    }
    glow(g, MOON.x, LAKE_Y + 30, 140, [170, 195, 255], 0.14);
 
    for (const s of GLINTS) {
      const a = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
      g.fillStyle = `rgba(215,228,255,${0.1 + 0.28 * a * a})`;
      g.fillRect(s.x + Math.sin(t * 0.5 + s.ph) * 6, s.y, s.w, 1.3);
    }
 
    for (let i = 0; i < 6; i++) {
      const a = 0.12 + 0.1 * Math.sin(t * 1.5 + i);
      g.fillStyle = `rgba(255,196,120,${a})`;
      g.fillRect(430 + i * 26 + Math.sin(t + i) * 3, 800 + i * 3, 3, 22);
    }
 
    for (const [lx, ly, len] of [[BOAT.x + 18, BOAT.y + 20, 60], [GIRL.x + 15, GIRL.y + 4, 36]]) {
      for (let i = 0; i < 9; i++) {
        const k = i / 9;
        g.fillStyle = `rgba(255,200,130,${0.3 * (1 - k)})`;
        g.fillRect(lx - 7 + Math.sin(t * 1.6 + i) * (2 + k * 5), ly + k * len, 14 * (1 - k * 0.3), 1.6);
      }
    }
  });
 
  g.strokeStyle = "rgba(150,170,255,0.06)";
  g.lineWidth = 1;
  for (let i = 0; i < 22; i++) {
    const y = LAKE_Y + 18 + hash(i * 3.3) * 190;
    const x = ((hash(i * 7.1) * DW + t * (3 + (i % 5))) % (DW + 200)) - 100;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 70 + hash(i) * 90, y);
    g.stroke();
  }
 
  // stateless fish ripples
  const SLOT = 4.2;
  for (let k = Math.floor(t / SLOT) - 1; k <= Math.floor(t / SLOT); k++) {
    const p = (t - (k * SLOT + hash(k * 2.7) * 1.5)) / 2.6;
    if (p < 0 || p > 1) continue;
    const cx = 640 + hash(k * 5.1) * 900;
    const cy = 780 + hash(k * 9.3) * 120;
    for (let r = 0; r < 3; r++) {
      const pr = clamp(p - r * 0.14, 0, 1);
      if (pr <= 0) continue;
      g.strokeStyle = `rgba(190,208,255,${0.34 * (1 - pr)})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(cx, cy, 8 + pr * 46, (8 + pr * 46) * 0.22, 0, 0, TAU);
      g.stroke();
    }
  }
}
 
/* -------------------------------------------------------------------------- */
/* LIVE: sky lanterns (optional), fog, fireflies                              */
/* -------------------------------------------------------------------------- */
 
function drawSkyLanterns(g, t) {
  const N = 11;
  for (let i = 0; i < N; i++) {
    const P = 36 + hash(i * 4.1) * 14;
    const u = (t / P + hash(i * 9.7)) % 1;
    const x0 = 120 + hash(i * 2.9) * 380;
    const sc = 0.42 + hash(i * 6.3) * 0.38;
    const x = x0 + u * (60 + hash(i) * 70) + Math.sin(t * 0.7 + i * 2) * 8;
    const y = 680 - u * 600;
    const a = smoothstep(0, 0.08, u) * (1 - smoothstep(0.78, 1, u));
    if (a < 0.02) continue;
    const fl = 0.85 + 0.15 * Math.sin(t * 5 + i * 3);
 
    add(g, () => {
      glow(g, x, y, 40 * sc, [255, 170, 80], 0.38 * a * fl);
      glow(g, x, y, 14 * sc, [255, 232, 170], 0.7 * a * fl);
    });
    g.save();
    g.globalAlpha = a;
    const w = 11 * sc;
    const h = 15 * sc;
    const lg = g.createLinearGradient(0, y - h, 0, y + h);
    lg.addColorStop(0, "rgba(255,190,110,0.95)");
    lg.addColorStop(1, "rgba(255,120,60,0.9)");
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(x - w * 0.7, y - h);
    g.lineTo(x + w * 0.7, y - h);
    g.lineTo(x + w, y + h * 0.7);
    g.lineTo(x - w, y + h * 0.7);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,244,200,0.85)";
    ell(g, x, y + h * 0.1, w * 0.4, h * 0.45);
    g.fill();
    g.restore();
  }
}
 
function makeFog(q) {
  return sprite(DW, 200, q, (g) => {
    const r = seeded(77);
    for (const wrap of [-DW, 0, DW]) {
      for (let i = 0; i < 12; i++) {
        const x = (i / 12) * DW + r() * 90 + wrap;
        const y = 100 + (r() - 0.5) * 50;
        const rx = 120 + r() * 140;
        const ry = 24 + r() * 26;
        g.save();
        g.translate(x, y);
        g.scale(1, ry / rx);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
        gr.addColorStop(0, "rgba(140,150,230,0.22)");
        gr.addColorStop(1, "rgba(140,150,230,0)");
        g.fillStyle = gr;
        circ(g, 0, 0, rx);
        g.fill();
        g.restore();
      }
    }
  });
}
 
function drawFog(g, fog, rows, t) {
  for (const r of rows) {
    const off = (t * r.sp) % DW;
    g.globalAlpha = r.a;
    g.drawImage(fog, -off, r.y - 100, DW, 200);
    g.drawImage(fog, -off + DW, r.y - 100, DW, 200);
  }
  g.globalAlpha = 1;
}
 
function makeFlies() {
  const r = seeded(222);
  const out = [];
  for (let i = 0; i < 40; i++) {
    out.push({
      x: r() < 0.7 ? r() * 700 : r() * DW,
      y: 600 + r() * 320,
      ph: r() * TAU,
      sp: 0.3 + r() * 0.7,
      amp: 10 + r() * 30,
      warm: i % 3 !== 0,
      s: 0.9 + r() * 1.2,
    });
  }
  return out;
}
 
function drawFlies(g, flies, t) {
  add(g, () => {
    for (const f of flies) {
      const x = f.x + Math.sin(t * f.sp + f.ph) * f.amp;
      const y = f.y + Math.cos(t * f.sp * 0.8 + f.ph) * f.amp * 0.5;
      const blink = Math.pow(0.5 + 0.5 * Math.sin(t * (0.9 + f.sp) + f.ph * 3), 3);
      const c = f.warm ? [255, 228, 130] : [150, 220, 255];
      glow(g, x, y, f.s * 9, c, 0.45 * blink);
      g.fillStyle = rgba(c, 0.25 + 0.7 * blink);
      circ(g, x, y, f.s);
      g.fill();
    }
  });
}
 
/* -------------------------------------------------------------------------- */
/* STATE                                                                      */
/* -------------------------------------------------------------------------- */
 
function qualityFor(w, h) {
  const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
  const s = Math.max(w / DW, h / DH);
  return clamp(s * Math.min(dpr, 2), 0.5, 2);
}
 
function build(state, w, h) {
  const q = qualityFor(w, h);
  state.w = w;
  state.h = h;
  state.sky = sprite(DW, DH, Math.min(q, 1.5), bakeSky);
  state.far = sprite(DW, DH, q, bakeFar);
  state.near = sprite(DW, DH, q, bakeNear);
  state.fog = makeFog(Math.min(q, 1));
  state.wisps = WISPS.map((wp) => makeWisp(wp, Math.min(q, 1)));
}
 
function create(w, h) {
  const state = { stars: makeStars(), flies: makeFlies() };
  build(state, w, h);
  return state;
}
 
let fallback = null;
 
/* -------------------------------------------------------------------------- */
/* SCENE                                                                      */
/* -------------------------------------------------------------------------- */
 
export default {
  init(w, h) {
    return create(w || DW, h || DH);
  },
 
  draw(c, state, t, dt, mood, w, h) {
    if (!state || !state.sky) {
      if (!fallback) fallback = create(w, h);
      state = fallback;
    }
    if (Math.abs(state.w - w) > 2 || Math.abs(state.h - h) > 2) build(state, w, h);
 
    c.fillStyle = "#02030f";
    c.fillRect(0, 0, w, h);
 
    // "Cover" fit. On tall/narrow screens, slide the camera toward the observatory
    // so the hero of the scene stays visible.
    const s = Math.max(w / DW, h / DH);
    const aspect = w / h;
    const p = clamp((1.25 - aspect) / 0.65, 0, 1);
    const focusX = lerp(DW / 2, 430, p);
    const ox = clamp(w / 2 - focusX * s, w - DW * s, 0);
    const oy = (h - DH * s) * 0.65;
 
    const ts = telescopeState(t);
 
    c.save();
    c.translate(ox, oy);
    c.scale(s, s);
 
    // ---- sky ----
    c.drawImage(state.sky, 0, 0, DW, DH);
    drawStars(c, state.stars, t);
    drawOrrery(c, t);
    drawAurora(c, t);
    drawConstellations(c, t, ts);
    drawRingedPlanet(c, 215, 250, 60, t);
    drawSmallPlanet(c, 1130, 300, 20, [140, 225, 240], [20, 80, 120]);
    drawSmallPlanet(c, 1590, 470, 28, [225, 145, 110], [90, 36, 52]);
    drawMoon(c, t);
    drawWisps(c, state.wisps, t);
    drawShootingStars(c, t);
 
    // ---- far land + lake ----
    c.drawImage(state.far, 0, 0, DW, DH);
    drawLake(c, t);
    drawFog(c, state.fog, [{ y: 650, sp: 5, a: 0.75 }, { y: 742, sp: 8, a: 0.6 }], t);
 
    // ---- near land ----
    c.drawImage(state.near, 0, 0, DW, DH);
    drawDome(c, t, ts);
    drawLights(c, t);
    if (SKY_LANTERNS) drawSkyLanterns(c, t);
    drawFog(c, state.fog, [{ y: 860, sp: 12, a: 0.5 }], t);
    drawFlies(c, state.flies, t);
 
    c.restore();
 
    // ---- reading comfort (screen space): a soft calm band behind the text column ----
    const half = clamp(w * 0.34, 160, 520);
    const band = c.createLinearGradient(w / 2 - half, 0, w / 2 + half, 0);
    band.addColorStop(0, "rgba(2,3,14,0)");
    band.addColorStop(0.5, "rgba(2,3,14,0.34)");
    band.addColorStop(1, "rgba(2,3,14,0)");
    c.fillStyle = band;
    c.fillRect(0, 0, w, h);
 
    const vg = c.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.45)");
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);
  },
};
 
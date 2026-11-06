
// const TAU = Math.PI * 2;

// const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// const hash = n => {
//   const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
//   return x - Math.floor(x);
// };

// function makeParticles(count) {
//   return Array.from({ length: count }, (_, i) => ({
//     x: hash(i * 3.1 + 1),
//     y: hash(i * 7.3 + 2),
//     speed: 0.008 + hash(i * 2.7 + 3) * 0.025,
//     size: 0.6 + hash(i * 8.1 + 4) * 2.2,
//     phase: hash(i * 4.7) * TAU,
//     drift: (hash(i * 9.2) - 0.5) * 0.12
//   }));
// }

// function glow(c, x, y, radius, color, alpha = 1) {
//   const g = c.createRadialGradient(x, y, 0, x, y, radius);
//   g.addColorStop(0, `rgba(${color},${alpha})`);
//   g.addColorStop(0.35, `rgba(${color},${alpha * 0.35})`);
//   g.addColorStop(1, `rgba(${color},0)`);

//   c.fillStyle = g;
//   c.beginPath();
//   c.arc(x, y, radius, 0, TAU);
//   c.fill();
// }

// function drawMountain(c, w, h, points, color) {
//   c.fillStyle = color;
//   c.beginPath();
//   c.moveTo(0, h);

//   points.forEach(([x, y]) => {
//     c.lineTo(x * w, y * h);
//   });

//   c.lineTo(w, h);
//   c.closePath();
//   c.fill();
// }

// function drawSky(c, w, h, t) {
//   const g = c.createLinearGradient(0, 0, 0, h);

//   g.addColorStop(0, '#08060d');
//   g.addColorStop(0.38, '#21101b');
//   g.addColorStop(0.72, '#512018');
//   g.addColorStop(1, '#160b10');

//   c.fillStyle = g;
//   c.fillRect(0, 0, w, h);

//   // Distant volcanic glow
//   glow(c, w * 0.52, h * 0.69, h * 0.65, '255,75,20', 0.22);

//   // Smoke clouds
//   for (let i = 0; i < 8; i++) {
//     const x = ((i * 0.19 + t * 0.003) % 1.2 - 0.1) * w;
//     const y = h * (0.12 + hash(i * 4) * 0.35);

//     glow(c, x, y, h * (0.12 + hash(i * 8) * 0.12), '75,45,48', 0.12);
//   }
// }

// function drawVolcanoes(c, w, h) {
//   drawMountain(c, w, h, [
//     [0, 0.63], [0.12, 0.43], [0.20, 0.56],
//     [0.33, 0.31], [0.43, 0.55],
//     [0.57, 0.28], [0.68, 0.53],
//     [0.82, 0.38], [1, 0.59]
//   ], '#160f19');

//   // Molten ridges
//   c.strokeStyle = 'rgba(255,91,30,.22)';
//   c.lineWidth = Math.max(1, w * 0.002);
//   c.beginPath();
//   c.moveTo(w * 0.33, h * 0.31);
//   c.lineTo(w * 0.30, h * 0.46);
//   c.lineTo(w * 0.27, h * 0.57);
//   c.moveTo(w * 0.57, h * 0.28);
//   c.lineTo(w * 0.60, h * 0.43);
//   c.lineTo(w * 0.65, h * 0.56);
//   c.stroke();
// }

// function drawFortress(c, w, h, t) {
//   const base = h * 0.79;
//   const x = w * 0.37;
//   const fw = w * 0.27;

//   c.fillStyle = '#090910';

//   // Main fortress
//   c.fillRect(x, base - h * 0.22, fw, h * 0.25);

//   // Central keep
//   c.fillRect(x + fw * 0.32, base - h * 0.43, fw * 0.36, h * 0.45);

//   // Towers
//   for (let i = 0; i < 4; i++) {
//     const tx = x + i * fw * 0.29 - fw * 0.04;
//     const tw = fw * 0.16;
//     const th = h * (0.22 + (i === 1 || i === 2 ? 0.10 : 0));

//     c.fillRect(tx, base - th, tw, th);

//     c.beginPath();
//     c.moveTo(tx - tw * 0.12, base - th);
//     c.lineTo(tx + tw / 2, base - th - tw * 1.2);
//     c.lineTo(tx + tw * 1.12, base - th);
//     c.fill();
//   }

//   // Glowing fortress windows
//   for (let i = 0; i < 18; i++) {
//     const wx = x + hash(i * 2.1) * fw;
//     const wy = base - hash(i * 4.1) * h * 0.35;
//     const pulse = 0.65 + Math.sin(t * 2 + i) * 0.2;

//     c.fillStyle = `rgba(255,125,43,${pulse})`;
//     c.fillRect(wx, wy, Math.max(2, w * 0.003), h * 0.012);

//     glow(c, wx, wy, h * 0.025, '255,100,25', 0.28);
//   }
// }

// function drawLava(c, w, h, t) {
//   const y = h * 0.88;

//   const g = c.createLinearGradient(0, y, 0, h);
//   g.addColorStop(0, '#ff8a28');
//   g.addColorStop(0.25, '#e94b12');
//   g.addColorStop(0.65, '#791c16');
//   g.addColorStop(1, '#230c12');

//   c.fillStyle = g;
//   c.beginPath();
//   c.moveTo(0, y);

//   for (let x = 0; x <= w; x += w / 40) {
//     const wave =
//       Math.sin(x * 0.012 + t * 0.7) * h * 0.012 +
//       Math.sin(x * 0.026 - t * 0.4) * h * 0.006;

//     c.lineTo(x, y + wave);
//   }

//   c.lineTo(w, h);
//   c.lineTo(0, h);
//   c.closePath();
//   c.fill();

//   // Molten surface streaks
//   c.strokeStyle = 'rgba(255,190,70,.38)';
//   c.lineWidth = Math.max(1, h * 0.002);

//   for (let i = 0; i < 14; i++) {
//     const x = ((hash(i * 7) + t * 0.018) % 1) * w;
//     const yy = y + h * (0.025 + hash(i * 2) * 0.08);

//     c.beginPath();
//     c.moveTo(x, yy);
//     c.quadraticCurveTo(
//       x + Math.sin(t + i) * 12,
//       yy + 5,
//       x + w * 0.035,
//       yy + 2
//     );
//     c.stroke();
//   }

//   glow(c, w * 0.5, y, h * 0.18, '255,95,20', 0.45);
// }

// function drawAsh(c, s, w, h, t, dt) {
//   c.fillStyle = '#ffad62';

//   for (const p of s.embers) {
//     p.y -= p.speed * dt * 2;
//     p.x += (p.drift + Math.sin(t + p.phase) * 0.01) * dt;

//     if (p.y < 0) {
//       p.y = 1;
//       p.x = hash(t + p.phase) * 1.1;
//     }

//     if (p.x < -0.05) p.x = 1.05;
//     if (p.x > 1.05) p.x = -0.05;

//     const x = p.x * w;
//     const y = p.y * h;
//     const flicker = 0.45 + Math.sin(t * 3 + p.phase) * 0.35;

//     c.globalAlpha = flicker;
//     c.beginPath();
//     c.arc(x, y, p.size, 0, TAU);
//     c.fill();

//     glow(c, x, y, p.size * 5, '255,105,35', 0.15);
//   }

//   c.globalAlpha = 1;
// }

// function drawEruption(c, w, h, t) {
//   // A distant eruption flashes occasionally.
//   const cycle = t % 27;
//   const flash = cycle > 19 && cycle < 19.5
//     ? Math.sin((cycle - 19) / 0.5 * Math.PI)
//     : 0;

//   if (flash > 0) {
//     glow(c, w * 0.57, h * 0.30, h * 0.5, '255,75,20', flash * 0.65);
//   }
// }

// export default {
//   init(w, h) {
//     return {
//       embers: makeParticles(
//         Math.min(150, Math.floor((w * h) / 8500))
//       )
//     };
//   },

//   draw(c, state, t, dt, mood, w, h) {
//     if (!(w > 0 && h > 0)) return;

//     c.save();

//     drawSky(c, w, h, t);
//     drawEruption(c, w, h, t);
//     drawVolcanoes(c, w, h);
//     drawFortress(c, w, h, t);

//     // Dark foreground cliffs
//     drawMountain(c, w, h, [
//       [0, 0.79], [0.12, 0.73], [0.22, 0.82],
//       [0.36, 0.75], [0.49, 0.84],
//       [0.62, 0.76], [0.76, 0.82],
//       [0.88, 0.74], [1, 0.80]
//     ], '#08080e');

//     drawLava(c, w, h, t);
//     drawAsh(c, state, w, h, t, dt);

//     // Dark cinematic vignette
//     const vignette = c.createRadialGradient(
//       w * 0.5, h * 0.48, h * 0.2,
//       w * 0.5, h * 0.48, Math.max(w, h) * 0.75
//     );

//     vignette.addColorStop(0, 'rgba(0,0,0,0)');
//     vignette.addColorStop(1, 'rgba(0,0,0,.48)');

//     c.fillStyle = vignette;
//     c.fillRect(0, 0, w, h);

//     c.restore();
//   }
// };


// Ashen Realms — a volcanic dark-fantasy world.
// API: { init(w, h), draw(c, state, t, dt, mood, w, h) }  — Canvas 2D only.
//
// Composition (back to front):
//   sky -> smoke -> dragon -> ridges + volcanoes -> crater glow / eruption
//   -> castle backlight -> obsidian castle on a rock island -> lit windows
//   -> horizon glow + fog -> plated lava lake -> lava waterfall
//   -> foreground cliffs -> embers + ash -> vignette
//
// Static art is rendered once into offscreen layers (rebuilt on resize),
// so the per-frame cost is just the animated parts.

const TAU = Math.PI * 2;

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => ((a % n) + n) % n;

const hash = n => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const rnd = (i, s = 0) => hash(i * 1.713 + s * 37.17);

/* ---------------------------------------------------------------- *
 *  Glow sprites (cached radial gradients, drawn with drawImage)
 * ---------------------------------------------------------------- */

const glowCache = new Map();

function glowSprite(color) {
  if (typeof document === 'undefined') return null;
  let s = glowCache.get(color);
  if (s) return s;

  s = document.createElement('canvas');
  s.width = s.height = 128;
  const g = s.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${color},1)`);
  gr.addColorStop(0.3, `rgba(${color},0.5)`);
  gr.addColorStop(0.65, `rgba(${color},0.14)`);
  gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);

  glowCache.set(color, s);
  return s;
}

function glow(c, x, y, r, color, a = 1, add = true) {
  if (a <= 0.003 || r <= 0) return;

  const prevA = c.globalAlpha;
  const prevO = c.globalCompositeOperation;
  c.globalAlpha = Math.min(1, a);
  c.globalCompositeOperation = add ? 'lighter' : 'source-over';

  const s = glowSprite(color);
  if (s) {
    c.drawImage(s, x - r, y - r, r * 2, r * 2);
  } else {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},1)`);
    g.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }

  c.globalAlpha = prevA;
  c.globalCompositeOperation = prevO;
}

/* ---------------------------------------------------------------- *
 *  Layer cache
 * ---------------------------------------------------------------- */

function blit(c, state, key, w, h, paint) {
  if (typeof document === 'undefined') {
    c.save();
    paint(c);
    c.restore();
    return;
  }

  const k = Math.max(1, (c.getTransform && c.getTransform().a) || 1);
  let e = state.layers[key];

  if (!e || e.w !== w || e.h !== h || e.k !== k) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * k);
    cv.height = Math.ceil(h * k);
    const g = cv.getContext('2d');
    g.scale(k, k);
    paint(g);
    e = state.layers[key] = { cv, w, h, k };
  }

  c.drawImage(e.cv, 0, 0, w, h);
}

/* ---------------------------------------------------------------- *
 *  Geometry shared by every layer
 * ---------------------------------------------------------------- */

function makeGeo(w, h) {
  return {
    w,
    h,
    u: Math.min(w, h * 1.6) / 100, // castle unit
    cx: w * 0.5,
    baseY: h * 0.735, // castle foot
    lakeY: h * 0.845, // lava horizon
    v: [
      { x: w * 0.17, top: h * 0.41, half: w * 0.27, crater: w * 0.045 },
      { x: w * 0.84, top: h * 0.30, half: w * 0.30, crater: w * 0.05 }
    ]
  };
}

const coneProfile = (t, half, crater) =>
  crater / 2 + (half - crater / 2) * Math.pow(t, 1.35);

/* ---------------------------------------------------------------- *
 *  STATIC LAYERS
 * ---------------------------------------------------------------- */

function paintSky(c, w, h) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#06030a');
  g.addColorStop(0.28, '#230a12');
  g.addColorStop(0.5, '#5e130f');
  g.addColorStop(0.68, '#a9340f');
  g.addColorStop(0.82, '#d9591a');
  g.addColorStop(1, '#2a0c0c');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

function ridge(c, w, h, baseY, amp, seed, color, steps = 120) {
  const f = (x, s) => {
    let v = 0, a = 1, fr = 3, sum = 0;
    for (let i = 0; i < 4; i++) {
      v += a * (1 - Math.abs(Math.sin(x * fr + s * 7.3 + i * 1.7)));
      sum += a;
      a *= 0.5;
      fr *= 2.1;
    }
    return v / sum;
  };

  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, h);
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    c.lineTo(x, baseY - f(i / steps, seed) * amp);
  }
  c.lineTo(w, h);
  c.closePath();
  c.fill();
}

function cone(c, v, baseY, seed) {
  const n = 26;
  const L = [];
  const R = [];

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = lerp(v.top, baseY, t);
    const p = coneProfile(t, v.half, v.crater);
    const j = i === 0 ? 0 : v.half * 0.05;
    L.push([v.x - p + (hash(i * 5.3 + seed) - 0.5) * j, y]);
    R.push([v.x + p + (hash(i * 3.7 + seed * 2) - 0.5) * j, y]);
  }

  const g = c.createLinearGradient(0, v.top, 0, baseY);
  g.addColorStop(0, '#2d141b');
  g.addColorStop(1, '#150a11');
  c.fillStyle = g;

  c.beginPath();
  c.moveTo(L[0][0], L[0][1]);
  L.forEach(([x, y]) => c.lineTo(x, y));
  for (let i = n; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
  c.lineTo(v.x, v.top + v.crater * 0.16);
  c.closePath();
  c.fill();
}

function paintRidges(c, w, h, G) {
  // Far ridge, hazed by distance
  ridge(c, w, h, h * 0.76, h * 0.30, 1.3, '#3a1519');
  c.save();
  c.globalCompositeOperation = 'source-atop';
  const haze = c.createLinearGradient(0, h * 0.45, 0, G.lakeY);
  haze.addColorStop(0, 'rgba(120,35,22,0)');
  haze.addColorStop(1, 'rgba(150,50,25,0.45)');
  c.fillStyle = haze;
  c.fillRect(0, 0, w, h);
  c.restore();

  // The two volcanoes
  cone(c, G.v[0], G.lakeY, 3);
  cone(c, G.v[1], G.lakeY, 9);

  // Nearer ridge
  ridge(c, w, h, h * 0.82, h * 0.16, 4.1, '#170b13', 140);

  // Everything is underlit by the lava lake
  c.save();
  c.globalCompositeOperation = 'source-atop';
  const lit = c.createLinearGradient(0, G.lakeY, 0, G.lakeY - h * 0.36);
  lit.addColorStop(0, 'rgba(255,100,30,0.42)');
  lit.addColorStop(1, 'rgba(255,100,30,0)');
  c.fillStyle = lit;
  c.fillRect(0, 0, w, h);
  c.restore();
}

function paintCastle(c, w, h, G, wins) {
  const { u, cx, baseY, lakeY } = G;
  wins.length = 0;

  // ---- rock island ----------------------------------------------
  const bottom = lakeY + h * 0.035;
  const isl = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const y = lerp(baseY + 0.5 * u, bottom, t);
    const out = 17 + 11 * Math.pow(t, 1.15) + (rnd(i, 5) - 0.5) * 3.2;
    isl.push([out, y]);
  }

  const ig = c.createLinearGradient(0, baseY, 0, bottom);
  ig.addColorStop(0, '#150b12');
  ig.addColorStop(1, '#060408');
  c.fillStyle = ig;
  c.beginPath();
  c.moveTo(cx - isl[0][0] * u, isl[0][1]);
  isl.forEach(([o, y], i) => {
    const jag = (rnd(i, 6) - 0.5) * 1.6 * u;
    c.lineTo(cx - o * u + jag, y);
  });
  for (let i = isl.length - 1; i >= 0; i--) {
    const jag = (rnd(i, 7) - 0.5) * 1.6 * u;
    c.lineTo(cx + isl[i][0] * u + jag, isl[i][1]);
  }
  c.closePath();
  c.fill();

  // glowing cracks in the rock
  c.strokeStyle = 'rgba(255,100,30,0.38)';
  c.lineWidth = Math.max(1, u * 0.1);
  for (let k = 0; k < 7; k++) {
    let x = cx + (rnd(k, 8) - 0.5) * 30 * u;
    let y = baseY + 1.5 * u + rnd(k, 9) * 2 * u;
    c.beginPath();
    c.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (rnd(k * 4 + s, 10) - 0.5) * 2.4 * u;
      y += (0.04 + rnd(k * 4 + s, 11) * 0.02) * h;
      c.lineTo(x, y);
    }
    c.stroke();
  }

  // ---- towers ----------------------------------------------------
  const shade = ['#1d0e17', '#130a12', '#09060c'];

  // [centre offset (u), width (u), body height (u), spire height (u), depth layer]
  const T = [
    [-4.6, 3.2, 19, 10, 0],
    [4.9, 3.2, 17, 10.5, 0],
    [0, 2.7, 21, 11, 0],
    [-13.2, 4.6, 9, 6.5, 1],
    [13.6, 4.6, 10, 7, 1],
    [-8.2, 5.6, 13, 8, 1],
    [8.4, 5.6, 14, 8.5, 1],
    [0, 9.6, 17, 11, 2]
  ];

  const drawTower = ([dx, tw, body, sp, layer]) => {
    const x = cx + dx * u;
    const wu = tw * u;
    const top = baseY - body * u + 0.5 * u;

    c.fillStyle = shade[layer];
    c.fillRect(x - wu / 2, top, wu, body * u);

    // corbel band under the roof
    c.fillRect(x - wu / 2 - 0.45 * u, top - 0.9 * u, wu + 0.9 * u, 1.0 * u);

    // needle spire with concave sides
    const yb = top - 0.9 * u;
    const spH = sp * u;
    c.beginPath();
    c.moveTo(x - wu / 2 - 0.3 * u, yb);
    c.quadraticCurveTo(x - wu * 0.12, yb - spH * 0.5, x, yb - spH);
    c.quadraticCurveTo(x + wu * 0.12, yb - spH * 0.5, x + wu / 2 + 0.3 * u, yb);
    c.closePath();
    c.fill();

    // finial
    c.fillRect(x - 0.12 * u, yb - spH - 1.6 * u, 0.24 * u, 1.7 * u);

    // corner pinnacles
    if (tw >= 4.4) {
      [-1, 1].forEach(s => {
        const px = x + s * (wu / 2 + 0.1 * u);
        c.beginPath();
        c.moveTo(px - 0.45 * u, yb);
        c.lineTo(px, yb - 2.2 * u);
        c.lineTo(px + 0.45 * u, yb);
        c.fill();
      });
    }

    // lit window positions (drawn live so they can flicker)
    const cols = tw > 7 ? 3 : tw > 4 ? 2 : 1;
    const rows = Math.floor((body - 2) / 3.4);
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const id = dx * 10 + r * 3 + k + layer * 50;
        if (rnd(id, 7) < 0.4) continue;
        wins.push({
          x: x + (k - (cols - 1) / 2) * (tw / (cols + 0.3)) * u,
          y: top + (1.5 + r * 3.4) * u,
          w: 0.62 * u,
          h: 1.35 * u,
          ph: rnd(id, 8) * TAU
        });
      }
    }
  };

  T.filter(t => t[4] === 0).forEach(drawTower);

  // curtain wall with crenellations
  c.fillStyle = shade[1];
  const wallTop = baseY - 6 * u;
  c.fillRect(cx - 18 * u, wallTop, 36 * u, 6.5 * u);
  for (let m = -18; m < 18; m += 1.8) {
    c.fillRect(cx + m * u, wallTop - 0.9 * u, 1.0 * u, 0.95 * u);
  }

  T.filter(t => t[4] === 1).forEach(drawTower);

  // flying buttresses between keep and flanking towers
  c.strokeStyle = shade[1];
  c.lineWidth = 0.7 * u;
  [-1, 1].forEach(s => {
    c.beginPath();
    c.moveTo(cx + s * 4.2 * u, baseY - 12 * u);
    c.quadraticCurveTo(cx + s * 6.3 * u, baseY - 15.5 * u, cx + s * 8 * u, baseY - 11 * u);
    c.stroke();
  });

  T.filter(t => t[4] === 2).forEach(drawTower);

  // great window and gate of the keep
  wins.push({ x: cx, y: baseY - 13.2 * u, w: 2.0 * u, h: 4.2 * u, ph: 1, big: true });

  c.fillStyle = '#030206';
  c.beginPath();
  c.moveTo(cx - 1.6 * u, baseY + 0.5 * u);
  c.lineTo(cx - 1.6 * u, baseY - 2 * u);
  c.quadraticCurveTo(cx - 1.4 * u, baseY - 3.8 * u, cx, baseY - 4.4 * u);
  c.quadraticCurveTo(cx + 1.4 * u, baseY - 3.8 * u, cx + 1.6 * u, baseY - 2 * u);
  c.lineTo(cx + 1.6 * u, baseY + 0.5 * u);
  c.closePath();
  c.fill();

  // lava underlight on the castle and island
  c.save();
  c.globalCompositeOperation = 'source-atop';
  const lg = c.createLinearGradient(0, lakeY, 0, baseY - 28 * u);
  lg.addColorStop(0, 'rgba(255,110,35,0.5)');
  lg.addColorStop(0.45, 'rgba(255,90,30,0.14)');
  lg.addColorStop(1, 'rgba(255,90,30,0)');
  c.fillStyle = lg;
  c.fillRect(0, 0, w, h);
  c.restore();
}

function paintFore(c, w, h, G) {
  const cliff = (side, seed, span, topY) => {
    const n = 22;
    const edge = side < 0 ? 0 : w;
    const pts = [];

    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const inner = i > 0 && i < n ? 1 : 0;
      const dx = span * w * Math.pow(t, 1.15) + (rnd(i, seed) - 0.5) * w * 0.014 * inner;
      const y = h * (topY + (1 - topY) * Math.pow(t, 0.8)) + (rnd(i, seed + 1) - 0.5) * h * 0.028 * inner;
      pts.push([side < 0 ? dx : w - dx, y]);
    }

    c.fillStyle = '#050307';
    c.beginPath();
    c.moveTo(edge, h);
    pts.forEach(([x, y]) => c.lineTo(x, y));
    c.lineTo(pts[n][0], h);
    c.closePath();
    c.fill();

    // lava-lit rim along the inner edge
    c.strokeStyle = 'rgba(255,110,40,0.3)';
    c.lineWidth = Math.max(1.5, w * 0.0015);
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  };

  cliff(-1, 20, 0.30, 0.52);
  cliff(1, 40, 0.27, 0.60);

  // obsidian shards rising from the lake
  const shard = (x, y, wd, ht, seed) => {
    c.fillStyle = '#07040a';
    c.beginPath();
    c.moveTo(x - wd / 2, y);
    c.lineTo(x - wd * 0.2 + (rnd(seed, 1) - 0.5) * wd * 0.2, y - ht * 0.62);
    c.lineTo(x + (rnd(seed, 2) - 0.5) * wd * 0.2, y - ht);
    c.lineTo(x + wd * 0.25, y - ht * 0.55);
    c.lineTo(x + wd / 2, y);
    c.closePath();
    c.fill();

    c.strokeStyle = 'rgba(255,120,45,0.35)';
    c.lineWidth = Math.max(1, wd * 0.04);
    c.beginPath();
    c.moveTo(x - wd / 2, y);
    c.lineTo(x - wd * 0.2, y - ht * 0.62);
    c.lineTo(x, y - ht);
    c.stroke();
  };

  shard(w * 0.34, G.lakeY + h * 0.07, w * 0.022, h * 0.075, 1);
  shard(w * 0.365, G.lakeY + h * 0.075, w * 0.014, h * 0.05, 2);
  shard(w * 0.69, G.lakeY + h * 0.09, w * 0.028, h * 0.10, 3);

  // dark rock catches the lava glow from below
  c.save();
  c.globalCompositeOperation = 'source-atop';
  const lit = c.createLinearGradient(0, h, 0, G.lakeY - h * 0.2);
  lit.addColorStop(0, 'rgba(255,100,30,0.38)');
  lit.addColorStop(1, 'rgba(255,100,30,0)');
  c.fillStyle = lit;
  c.fillRect(0, 0, w, h);
  c.restore();
}

/* ---------------------------------------------------------------- *
 *  ANIMATED PARTS
 * ---------------------------------------------------------------- */

function drawClouds(c, w, h, t) {
  for (let i = 0; i < 26; i++) {
    const layer = i % 3;
    const sp = 0.003 + layer * 0.003;
    const x = mod(rnd(i, 20) * 1.5 * w + t * w * sp, w * 1.5) - w * 0.25;
    const y = h * (0.04 + rnd(i, 21) * 0.46);
    const r = h * (0.12 + rnd(i, 22) * 0.16);

    glow(c, x, y, r, layer ? '30,10,16' : '12,5,10', 0.3 + rnd(i, 23) * 0.25, false);

    if (layer === 2) {
      glow(c, x, y + r * 0.45, r * 0.8, '200,60,25', 0.07);
    }
  }
}

function drawDragon(c, w, h, t) {
  const ct = (t + 30) % 64;
  const dur = 18;
  if (ct > dur) return;

  const p = ct / dur;
  const s = h * 0.042;
  const x = lerp(-0.1, 1.1, p) * w;
  const y = h * (0.17 + 0.07 * p) + Math.sin(t * 0.8) * s * 0.2;

  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.globalAlpha = 0.9;
  c.rotate(0.06 + Math.sin(t * 3.4) * 0.02);

  const wing = (phase, color) => {
    const f = Math.sin(t * 3.4 + phase);
    const tipY = -1.0 - f * 1.1;
    const tipX = -0.7 - f * 0.3;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0.5, -0.15);
    c.quadraticCurveTo(0.1, tipY * 0.7, tipX, tipY);
    c.quadraticCurveTo(tipX - 0.2, tipY * 0.45, -1.2, 0);
    c.lineTo(0.2, -0.05);
    c.closePath();
    c.fill();
  };

  wing(-0.6, '#0b050d');

  c.fillStyle = '#060208';
  c.beginPath();
  c.moveTo(1.7, -0.12);
  c.lineTo(1.25, -0.3);
  c.quadraticCurveTo(0.7, -0.12, 0.1, -0.2);
  c.quadraticCurveTo(-0.9, -0.22, -2.8, 0.25);
  c.quadraticCurveTo(-0.9, 0.14, 0.1, 0.17);
  c.quadraticCurveTo(0.8, 0.1, 1.2, 0);
  c.closePath();
  c.fill();

  wing(0, '#060208');

  c.restore();
}

function drawVolcanoLife(c, w, h, G, t) {
  G.v.forEach((v, k) => {
    const cy = v.top + v.crater * 0.12;
    const pulse = 0.6 + 0.2 * Math.sin(t * 1.3 + k * 2);

    glow(c, v.x, cy, w * 0.06, '255,120,40', pulse);
    glow(c, v.x, cy, w * 0.02, '255,215,130', pulse * 0.8);

    // glowing lava veins running down the flanks
    for (let s = 0; s < 6; s++) {
      const side = s % 2 ? 1 : -1;
      const frac = 0.25 + (s >> 1) * 0.28;
      const a = 0.22 + 0.16 * Math.sin(t * 0.9 + s + k * 3);

      c.save();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(255,100,30,${a})`;
      c.lineWidth = Math.max(1, w * 0.0016);
      c.beginPath();

      for (let i = 0; i <= 14; i++) {
        const tt = (i / 14) * 0.85;
        const y = lerp(v.top, G.lakeY, tt);
        const x =
          v.x +
          side * frac * coneProfile(tt, v.half, v.crater) +
          (hash(i * 3 + s * 11 + k * 7) - 0.5) * v.half * 0.04;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }

      c.stroke();
      c.restore();
    }
  });
}

// Every ~38s the right-hand volcano erupts: a flash, a rising ash plume,
// lava bombs in the air, and lightning inside the cloud.
function drawEruption(c, w, h, G, t) {
  const e = (t % 38) - 13; // seconds since the eruption began
  if (e < 0 || e > 20) return;

  const v = G.v[1];
  const cy = v.top + v.crater * 0.12;
  const power = e < 6 ? clamp(e / 1.2) : clamp(1 - (e - 6) / 14);

  glow(c, v.x, cy, h * 0.55, '255,70,20', power * (e < 2 ? 0.4 : 0.25));

  // ash plume
  for (let i = 0; i < 18; i++) {
    const age = e - i * 0.25;
    if (age < 0 || age > 12) continue;

    const p = age / 12;
    const rise = 1 - Math.pow(1 - p, 2);
    const x =
      v.x +
      Math.sin(i * 2.3) * h * 0.03 * p +
      p * w * 0.05 +
      Math.sin(t * 0.4 + i) * h * 0.01;
    const y = cy - rise * h * 0.42;
    const r = h * (0.03 + 0.09 * Math.sqrt(p));

    glow(c, x, y, r, '28,12,16', (1 - p) * 0.6, false);
    glow(c, x, y + r * 0.35, r * 0.9, '255,85,25', (1 - p) * (1 - p) * 0.2);
  }

  // lava bombs
  for (let i = 0; i < 16; i++) {
    const s = e - 0.3 - i * 0.22;
    if (s < 0 || s > 4.5) continue;

    const vx = (rnd(i, 1) - 0.5) * w * 0.16;
    const vy = -h * (0.2 + rnd(i, 2) * 0.16);
    const g = h * 0.2;
    const a = 1 - s / 4.5;

    for (let k = 0; k < 5; k++) {
      const ss = s - k * 0.06;
      if (ss < 0) break;
      const x = v.x + vx * ss;
      const y = cy + vy * ss + 0.5 * g * ss * ss;
      if (y > cy + h * 0.18) break;

      const f = 1 - k * 0.2;
      glow(c, x, y, h * 0.016 * f, '255,170,60', a * 0.9 * f);
      glow(c, x, y, h * 0.045 * f, '255,90,25', a * 0.4 * f);
    }
  }

  // lightning inside the plume
  if (e > 1.5 && e < 14) {
    const slot = Math.floor(t * 5);
    if (rnd(slot, 3) > 0.86) {
      const f = 1 - ((t * 5) % 1);
      let x = v.x + w * 0.03;
      let y = cy - h * 0.34;
      const tx = x + (rnd(slot, 4) - 0.5) * h * 0.4;
      const ty = cy - h * 0.06;

      c.save();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(255,225,200,${f * 0.9})`;
      c.lineWidth = Math.max(1.2, h * 0.002);
      c.beginPath();
      c.moveTo(x, y);
      for (let i = 1; i <= 7; i++) {
        x = lerp(v.x + w * 0.03, tx, i / 7) + (rnd(slot * 9 + i, 5) - 0.5) * h * 0.05;
        y = lerp(cy - h * 0.34, ty, i / 7);
        c.lineTo(x, y);
      }
      c.stroke();
      c.restore();

      glow(c, v.x + w * 0.03, cy - h * 0.25, h * 0.2, '255,200,170', f * 0.35);
    }
  }
}

function archPath(c, x, y, ww, hh) {
  c.beginPath();
  c.moveTo(x - ww / 2, y + hh);
  c.lineTo(x - ww / 2, y + hh * 0.3);
  c.lineTo(x, y);
  c.lineTo(x + ww / 2, y + hh * 0.3);
  c.lineTo(x + ww / 2, y + hh);
  c.closePath();
}

function drawWindows(c, G, wins, t) {
  const { u, cx, baseY } = G;

  for (const wn of wins) {
    const fl = clamp(
      0.6 + 0.22 * Math.sin(t * 2.3 + wn.ph) + 0.14 * Math.sin(t * 7.1 + wn.ph * 2),
      0.25,
      1
    );

    if (wn.big) {
      glow(c, wn.x, wn.y + wn.h * 0.5, u * 5, '255,120,40', 0.25 * fl);
    }

    c.fillStyle = `rgba(255,${wn.big ? 175 : 150},${wn.big ? 80 : 55},${fl * (wn.big ? 0.95 : 0.9)})`;
    archPath(c, wn.x, wn.y, wn.w, wn.h);
    c.fill();

    glow(c, wn.x, wn.y + wn.h * 0.5, u * 1.6, '255,110,35', 0.22 * fl);
  }

  // molten gate
  const gp = 0.6 + 0.15 * Math.sin(t * 1.7);
  glow(c, cx, baseY - 1.5 * u, u * 8, '255,110,30', 0.5 * gp);
  glow(c, cx, baseY - 1 * u, u * 3, '255,200,110', 0.4 * gp);
}

function drawHorizon(c, w, h, G, t) {
  const y = G.lakeY;

  const g = c.createLinearGradient(0, y - h * 0.16, 0, y + h * 0.01);
  g.addColorStop(0, 'rgba(255,100,30,0)');
  g.addColorStop(1, 'rgba(255,120,40,0.5)');
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = g;
  c.fillRect(0, y - h * 0.16, w, h * 0.17);
  c.restore();

  // low fog drifting across the lake
  for (let i = 0; i < 7; i++) {
    const x = mod(rnd(i, 9) * 1.4 * w + t * w * (0.004 + rnd(i, 10) * 0.004), w * 1.4) - w * 0.2;
    const yy = y - h * (0.01 + rnd(i, 11) * 0.05);

    c.save();
    c.translate(x, yy);
    c.scale(1, 0.22);
    glow(c, 0, 0, w * (0.1 + rnd(i, 12) * 0.1), '160,50,30', 0.16);
    c.restore();
  }
}

function drawLake(c, w, h, G, t) {
  const y0 = G.lakeY;
  const H = h - y0;

  const g = c.createLinearGradient(0, y0, 0, h);
  g.addColorStop(0, '#ffc15a');
  g.addColorStop(0.05, '#ff8f2b');
  g.addColorStop(0.22, '#ec4c10');
  g.addColorStop(0.55, '#a02812');
  g.addColorStop(1, '#3b0f10');
  c.fillStyle = g;
  c.fillRect(0, y0, w, H + 1);

  // dark crust plates drifting on the molten surface, with glowing seams
  const rows = 15;
  const W2 = w * 1.3;

  for (let r = 0; r < rows; r++) {
    const p0 = r / rows;
    const ys = y0 + H * Math.pow(p0, 1.8);
    const ye = y0 + H * Math.pow((r + 1) / rows, 1.8);
    const rh = ye - ys;
    const n = 9 + Math.floor(r * 0.5);
    const sp = W2 / n;
    const speed = rh * 0.5 * (r % 2 ? 1 : 0.8);

    c.lineWidth = Math.max(0.8, rh * 0.07);
    c.strokeStyle = `rgba(255,160,60,${0.25 + 0.35 * (1 - p0)})`;

    for (let i = 0; i < n; i++) {
      const id = r * 17 + i;
      const px = mod(i * sp + rnd(id, 1) * sp * 0.5 - t * speed, W2) - w * 0.15;
      const pw = sp * (0.45 + rnd(id, 2) * 0.4);
      const ph = rh * (0.5 + rnd(id, 3) * 0.35);
      const py = ys + rh * 0.5 + (rnd(id, 4) - 0.5) * rh * 0.25;

      c.fillStyle = `rgba(24,9,13,${0.5 + 0.45 * p0})`;
      c.beginPath();
      c.ellipse(px, py, pw / 2, ph / 2, 0, 0, TAU);
      c.fill();
      c.stroke();
    }
  }

  // bright streaks of flowing lava
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 36; i++) {
    const yy = y0 + H * Math.pow(rnd(i, 30), 1.7);
    const len = 6 + (yy - y0) * 0.25;
    const x = mod(rnd(i, 31) * w * 1.2 - t * (6 + (yy - y0) * 0.1), w * 1.2) - w * 0.1;
    const a = 0.2 + 0.25 * Math.sin(t * 1.5 + i * 2.1);

    c.strokeStyle = `rgba(255,210,110,${Math.max(0, a)})`;
    c.lineWidth = Math.max(1, (yy - y0) * 0.012);
    c.beginPath();
    c.moveTo(x, yy);
    c.lineTo(x + len, yy + 1);
    c.stroke();
  }
  c.restore();

  // the castle's reflected glow
  c.save();
  c.translate(G.cx, y0 + H * 0.12);
  c.scale(1, 1.8);
  glow(c, 0, 0, G.u * 14, '255,130,45', 0.28 + 0.05 * Math.sin(t * 1.1));
  c.restore();
}

function drawFall(c, w, h, G, t) {
  const { u, cx, baseY, lakeY } = G;
  const y0 = baseY - 0.5 * u;
  const y1 = lakeY + h * 0.015;

  // body of the fall, widening toward the bottom
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#ffd070');
  g.addColorStop(0.4, '#ff8a22');
  g.addColorStop(1, '#d4410f');

  const steps = 14;
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const y = lerp(y0, y1, p);
    const half = (1.4 + 1.2 * p) * u + Math.sin(y * 0.05 + t * 2) * 0.12 * u;
    left.push([cx - half, y]);
    right.push([cx + half, y]);
  }

  c.fillStyle = g;
  c.beginPath();
  left.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  for (let i = steps; i >= 0; i--) c.lineTo(right[i][0], right[i][1]);
  c.closePath();
  c.fill();

  // flowing highlights
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.lineWidth = Math.max(1, 0.22 * u);
  c.setLineDash([u * 2.2, u * 1.6]);
  for (let k = -2; k <= 2; k++) {
    const x0 = cx + k * 0.5 * u;
    const x1 = cx + k * 0.85 * u;
    c.lineDashOffset = -t * (7 + k * 1.3) * u;
    c.strokeStyle = 'rgba(255,230,140,0.65)';
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
  c.setLineDash([]);
  c.restore();

  glow(c, cx, y0 + (y1 - y0) * 0.5, u * 5, '255,110,30', 0.2);

  // splash and steam where it meets the lake
  glow(c, cx, y1, u * 6, '255,110,30', 0.6);
  glow(c, cx, y1, u * 2.5, '255,210,120', 0.4);

  for (let i = 0; i < 6; i++) {
    const p = mod(t * 0.15 + i / 6, 1);
    const x = cx + Math.sin(i * 2.1 + t * 0.6) * u * (2 + p * 4);
    const y = y1 - p * h * 0.16;
    glow(c, x, y, u * (2 + p * 5), '120,60,50', (1 - p) * 0.1, false);
  }
}

function drawEmbers(c, state, w, h, t, d) {
  for (const p of state.embers) {
    p.y -= p.sp * d;
    p.x += (-0.015 + Math.sin(t * 0.7 + p.ph) * 0.02) * d * (0.5 + p.z);

    if (p.y < -0.05 || p.x < -0.05) {
      p.y = 0.84 + Math.random() * 0.16;
      p.x = Math.random() * 1.1;
    }

    const flick = 0.5 + 0.5 * Math.sin(t * 4 + p.ph);
    const x = p.x * w;
    const y = p.y * h;
    const r = (0.6 + p.z * 2.6) * (h / 540);

    // far embers are crisp pinpricks; near ones are soft, large bokeh
    glow(c, x, y, r * (2.5 + p.z * 3), '255,140,50', (0.25 + 0.5 * flick) * (0.4 + 0.6 * p.z));
    glow(c, x, y, r * 0.9, '255,225,160', 0.8 * flick);
  }
}

function drawAsh(c, state, w, h, t, d) {
  c.fillStyle = 'rgba(150,120,115,0.28)';

  for (const p of state.ash) {
    p.y += (0.012 + p.z * 0.02) * d;
    p.x += (-0.02 + Math.sin(t * 0.5 + p.ph) * 0.015) * d;

    if (p.y > 1.02) {
      p.y = -0.02;
      p.x = Math.random() * 1.1;
    }
    if (p.x < -0.05) p.x = 1.05;

    const s = (0.8 + p.z * 1.6) * (h / 700);
    c.fillRect(p.x * w, p.y * h, s, s);
  }
}

/* ---------------------------------------------------------------- *
 *  Module
 * ---------------------------------------------------------------- */

export default {
  init(w, h) {
    const nE = Math.max(40, Math.min(170, Math.floor((w * h) / 9000)));
    const nA = Math.max(20, Math.min(70, Math.floor((w * h) / 26000)));

    return {
      layers: {},
      windows: [],
      geo: null,
      embers: Array.from({ length: nE }, (_, i) => ({
        x: hash(i * 3.1 + 1) * 1.1,
        y: hash(i * 7.3 + 2),
        z: Math.pow(hash(i * 5.9 + 5), 1.5),
        sp: 0.04 + hash(i * 2.7 + 3) * 0.07,
        ph: hash(i * 4.7) * TAU
      })),
      ash: Array.from({ length: nA }, (_, i) => ({
        x: hash(i * 6.1 + 9) * 1.1,
        y: hash(i * 1.9 + 4),
        z: hash(i * 8.3 + 1),
        ph: hash(i * 2.2) * TAU
      }))
    };
  },

  draw(c, state, t, dt, mood, w, h) {
    if (!(w > 0 && h > 0)) return;

    // accept dt in seconds or milliseconds
    const d = clamp(dt > 1 ? dt / 1000 : dt || 0, 0, 0.1);

    if (!state.geo || state.geo.w !== w || state.geo.h !== h) {
      state.geo = makeGeo(w, h);
    }
    const G = state.geo;

    c.save();

    blit(c, state, 'sky', w, h, g => paintSky(g, w, h));
    drawClouds(c, w, h, t);
    drawDragon(c, w, h, t);

    blit(c, state, 'ridges', w, h, g => paintRidges(g, w, h, G));
    drawVolcanoLife(c, w, h, G, t);
    drawEruption(c, w, h, G, t);

    // backlight so the dark castle reads against the mountains
    glow(c, G.cx, G.baseY - 14 * G.u, h * 0.55, '255,85,25', 0.28 + 0.05 * Math.sin(t * 0.8));
    glow(c, G.cx, G.baseY - 6 * G.u, h * 0.3, '255,140,50', 0.22);

    blit(c, state, 'castle', w, h, g => paintCastle(g, w, h, G, state.windows));
    drawWindows(c, G, state.windows, t);

    drawHorizon(c, w, h, G, t);
    drawLake(c, w, h, G, t);
    drawFall(c, w, h, G, t);

    blit(c, state, 'fore', w, h, g => paintFore(g, w, h, G));

    drawEmbers(c, state, w, h, t, d);
    drawAsh(c, state, w, h, t, d);

    // cinematic vignette
    const vg = c.createRadialGradient(
      w * 0.5, h * 0.48, h * 0.2,
      w * 0.5, h * 0.48, Math.max(w, h) * 0.75
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);

    c.restore();
  }
};
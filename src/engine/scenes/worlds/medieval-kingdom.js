// ============================================================================
// MEDIEVAL KINGDOM
// A living, moonlit realm: crag-top castle, hillside village, winding road,
// river and stone bridge, windmill, church, tavern, forge, bonfire, fireflies.
//
// API (unchanged):
//   init(w, h)
//   draw(ctx, state, t, dt, mood, w, h)
//
// Notes
//  - Static art is painted once into offscreen layers (rebuilt on resize);
//    everything that moves or glows is drawn live on top, so it stays cheap.
//  - Animation uses its own clock accumulated from dt, so it behaves the same
//    whether the host passes t/dt in milliseconds or seconds.
// ============================================================================

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const tri = (x) => { const f = x - Math.floor(x); return f < 0.5 ? f * 2 : 2 - f * 2; };
const ease = (x) => { const k = clamp(x, 0, 1); return k * k * (3 - 2 * k); };

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------------------------------
// Small drawing helpers
// ----------------------------------------------------------------------------

function poly(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fill();
}

function archPath(g, x, y, wd, ht) {
  g.beginPath();
  g.moveTo(x - wd / 2, y + ht / 2);
  g.lineTo(x - wd / 2, y - ht / 2 + wd / 2);
  g.arc(x, y - ht / 2 + wd / 2, wd / 2, Math.PI, TAU);
  g.lineTo(x + wd / 2, y + ht / 2);
  g.closePath();
}

function layer(w, h, dpr) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * dpr);
  cv.height = Math.ceil(h * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  return { cv, g };
}

function sprite(w, h, dpr, fn) {
  const L = layer(w, h, dpr);
  fn(L.g);
  return L.cv;
}

function glowSprite(rgb) {
  const n = 64;
  return sprite(n, n, 1, (g) => {
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(0.22, `rgba(${rgb},.5)`);
    gr.addColorStop(0.55, `rgba(${rgb},.12)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n);
  });
}

function pineSimple(g, x, y, sc, color) {
  g.fillStyle = color;
  poly(g, [
    [x, y - 58 * sc], [x - 17 * sc, y - 30 * sc], [x - 9 * sc, y - 30 * sc],
    [x - 24 * sc, y - 8 * sc], [x - 11 * sc, y - 8 * sc], [x - 30 * sc, y + 14 * sc],
    [x + 30 * sc, y + 14 * sc], [x + 11 * sc, y - 8 * sc], [x + 24 * sc, y - 8 * sc],
    [x + 9 * sc, y - 30 * sc], [x + 17 * sc, y - 30 * sc]
  ]);
}

function pineSway(c, x, y, sc, col, sway) {
  c.fillStyle = col;
  c.fillRect(x - 2.5 * sc, y - 14 * sc, 5 * sc, 16 * sc);
  c.strokeStyle = 'rgba(150,170,215,.13)';
  c.lineWidth = Math.max(1, 1.2 * sc);
  for (let i = 0; i < 6; i++) {
    const by = y - 10 * sc - i * 17 * sc;
    const hw = (31 - i * 4.6) * sc;
    const ox = sway * Math.pow(i + 1, 1.35) * sc * 1.6;
    const ox2 = sway * Math.pow(i + 2, 1.35) * sc * 1.6;
    c.fillStyle = col;
    poly(c, [
      [x + ox2, by - 27 * sc], [x + ox - hw, by + 3 * sc], [x + ox - hw * 0.42, by - 3 * sc],
      [x + ox, by + 4 * sc], [x + ox + hw * 0.42, by - 3 * sc], [x + ox + hw, by + 3 * sc]
    ]);
    c.beginPath();
    c.moveTo(x + ox2, by - 27 * sc);
    c.lineTo(x + ox + hw, by + 3 * sc);
    c.stroke();
  }
}

// Ridged noise gives sharp mountain peaks and soft valleys.
function ridgeNoise(u, seed) {
  let v = 0, a = 1, f = 1, sum = 0;
  for (let o = 0; o < 5; o++) {
    const n = 1 - Math.abs(Math.sin(u * f * 3.1 + hash(seed + o * 7.3) * TAU));
    v += n * a; sum += a; a *= 0.5; f *= 2.07;
  }
  return v / sum;
}

function makeRidge(w, base, amp, seed, shift) {
  return (x) => base - amp * Math.pow(clamp((ridgeNoise(x / w + shift, seed) - 0.2) / 0.5, 0, 1), 1.15);
}

// ----------------------------------------------------------------------------
// Sprites
// ----------------------------------------------------------------------------

function makeMoon(R, dpr) {
  const k = 5.2, size = R * 2 * k, c0 = size / 2;
  return sprite(size, size, dpr, (g) => {
    let gr = g.createRadialGradient(c0, c0, R * 0.8, c0, c0, R * k);
    gr.addColorStop(0, 'rgba(215,225,255,.30)');
    gr.addColorStop(0.18, 'rgba(190,205,245,.12)');
    gr.addColorStop(0.5, 'rgba(120,140,200,.04)');
    gr.addColorStop(1, 'rgba(120,140,200,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);

    gr = g.createRadialGradient(c0, c0, R * 1.6, c0, c0, R * 3.4);
    gr.addColorStop(0, 'rgba(200,215,255,0)'); gr.addColorStop(0.5, 'rgba(200,215,255,.035)'); gr.addColorStop(1, 'rgba(200,215,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);

    g.save();
    g.beginPath(); g.arc(c0, c0, R, 0, TAU); g.clip();
    gr = g.createRadialGradient(c0 - R * 0.3, c0 - R * 0.3, R * 0.1, c0, c0, R * 1.05);
    gr.addColorStop(0, '#fbf6e2'); gr.addColorStop(0.7, '#eae2c6'); gr.addColorStop(1, '#cfc6a6');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);

    const maria = [[-0.35, -0.25, 0.34], [0.15, -0.4, 0.22], [0.25, 0.05, 0.3], [-0.2, 0.3, 0.2], [-0.55, 0.1, 0.14], [0.02, 0.55, 0.15]];
    for (const [mx, my, mr] of maria) {
      const gx = c0 + mx * R, gy = c0 + my * R;
      const mg = g.createRadialGradient(gx, gy, 0, gx, gy, mr * R);
      mg.addColorStop(0, 'rgba(138,126,102,.42)'); mg.addColorStop(1, 'rgba(138,126,102,0)');
      g.fillStyle = mg; g.fillRect(gx - mr * R, gy - mr * R, mr * R * 2, mr * R * 2);
    }
    const r = rng(3);
    for (let i = 0; i < 14; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * R * 0.85, cr = (0.04 + r() * 0.07) * R;
      const px = c0 + Math.cos(a) * d, py = c0 + Math.sin(a) * d;
      g.strokeStyle = 'rgba(115,105,88,.28)'; g.lineWidth = Math.max(0.6, R * 0.015);
      g.beginPath(); g.arc(px, py, cr, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,252,235,.22)';
      g.beginPath(); g.arc(px - 0.5, py - 0.5, cr, Math.PI * 0.9, Math.PI * 1.7); g.stroke();
    }
    gr = g.createLinearGradient(c0 - R, 0, c0 + R * 0.65, 0);
    gr.addColorStop(0, 'rgba(8,12,30,.66)'); gr.addColorStop(0.55, 'rgba(8,12,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    g.restore();
  });
}

function makeCloud(cw, ch, seed, dpr) {
  return sprite(cw, ch, dpr, (g) => {
    const r = rng(seed);
    const n = 16;
    const blobs = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = cw * (0.24 + 0.52 * u) + (r() - 0.5) * cw * 0.04;
      const rad = ch * (0.1 + 0.15 * r()) * (1 - Math.abs(u - 0.5) * 0.9);
      const y = ch * 0.56 - rad * 0.5 * r();
      blobs.push([x, y, Math.max(rad, ch * 0.06)]);
    }
    for (const [x, y, rad] of blobs) {
      g.save(); g.translate(x, y); g.scale(1.7, 1);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rad * 1.5);
      gr.addColorStop(0, 'rgba(50,58,92,.62)'); gr.addColorStop(1, 'rgba(50,58,92,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rad * 1.5, 0, TAU); g.fill(); g.restore();
    }
    for (const [x, y, rad] of blobs) {
      g.save(); g.translate(x + rad * 0.35, y - rad * 0.35); g.scale(1.5, 1);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rad);
      gr.addColorStop(0, 'rgba(176,190,230,.22)'); gr.addColorStop(1, 'rgba(176,190,230,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.fill(); g.restore();
    }
  });
}

function makeFog(w, fh) {
  return sprite(w, fh, 1, (g) => {
    const r = rng(21);
    for (let i = 0; i < 28; i++) {
      const x = r() * w, y = fh * (0.45 + r() * 0.1), rad = fh * (0.16 + r() * 0.2);
      for (const wx of [-w, 0, w]) {
        g.save(); g.translate(x + wx, y); g.scale(3, 1);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, rad);
        gr.addColorStop(0, 'rgba(172,182,206,.2)'); gr.addColorStop(1, 'rgba(172,182,206,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.fill(); g.restore();
      }
    }
  });
}

// ----------------------------------------------------------------------------
// FAR LAYER: mountains, snow, distant forest, watchtower
// ----------------------------------------------------------------------------

function bakeFar(S, g) {
  const { w, h, s } = S;
  const specs = [
    { base: h * 0.605, amp: h * 0.22, seed: 2.3, top: '#3a4468', bot: '#1c2238', snow: true, shift: 0 },
    { base: h * 0.65, amp: h * 0.14, seed: 7.7, top: '#252d4a', bot: '#161b2e', snow: false, shift: 0.37 },
    { base: h * 0.69, amp: h * 0.075, seed: 11.1, top: '#1b2138', bot: '#10151f', snow: false, shift: 0.71 }
  ];
  S.ridges = [];
  const moonFrac = S.moon.x / w;

  for (const m of specs) {
    const fn = makeRidge(w, m.base, m.amp, m.seed, m.shift);
    S.ridges.push(fn);

    g.beginPath();
    g.moveTo(0, h * 0.78);
    for (let x = 0; x <= w + 4; x += 4) g.lineTo(x, fn(x));
    g.lineTo(w, h * 0.78);
    g.closePath();
    let gr = g.createLinearGradient(0, m.base - m.amp, 0, m.base + 10);
    gr.addColorStop(0, m.top); gr.addColorStop(1, m.bot);
    g.fillStyle = gr; g.fill();

    if (m.snow) {
      g.save(); g.clip();
      const sg = g.createLinearGradient(0, m.base - m.amp, 0, m.base - m.amp * 0.45);
      sg.addColorStop(0, 'rgba(208,218,244,.46)'); sg.addColorStop(1, 'rgba(208,218,244,0)');
      g.fillStyle = sg; g.fillRect(0, m.base - m.amp, w, m.amp);
      g.restore();
    }

    // moonlit ridge line, stronger toward the moon
    const rim = g.createLinearGradient(0, 0, w, 0);
    rim.addColorStop(0, 'rgba(160,178,225,.05)');
    rim.addColorStop(clamp(moonFrac, 0.1, 0.95), 'rgba(196,210,245,.42)');
    rim.addColorStop(1, 'rgba(160,178,225,.12)');
    g.strokeStyle = rim; g.lineWidth = Math.max(1, 1.3 * s);
    g.beginPath();
    for (let x = 0; x <= w + 4; x += 4) { if (x === 0) g.moveTo(x, fn(x)); else g.lineTo(x, fn(x)); }
    g.stroke();

    // dusk haze between ridges
    const hz = g.createLinearGradient(0, m.base - h * 0.08, 0, m.base + 6);
    hz.addColorStop(0, 'rgba(130,86,92,0)'); hz.addColorStop(1, 'rgba(130,86,92,.22)');
    g.fillStyle = hz; g.fillRect(0, m.base - h * 0.08, w, h * 0.08 + 8);
  }

  // distant watchtower on the middle ridge (right side)
  const r2 = S.ridges[1], r3 = S.ridges[2];
  let tx = w * 0.88, best = 1e9;
  for (let x = w * 0.78; x < w * 0.97; x += 4) {
    const y = r2(x);
    if (y < r3(x) - 10 && y < best) { best = y; tx = x; }
  }
  const ty = r2(tx) + 3 * s;
  g.fillStyle = '#0c1019';
  g.fillRect(tx - 5 * s, ty - 26 * s, 10 * s, 28 * s);
  poly(g, [[tx - 8 * s, ty - 26 * s], [tx, ty - 42 * s], [tx + 8 * s, ty - 26 * s]]);
  S.windows.push({ x: tx, y: ty - 16 * s, w: 2.4 * s, h: 4 * s, arch: false, seed: 0.41, kind: 'warm', far: true, on: false });

  // beacon fire on a left hilltop
  let bx = w * 0.12, bbest = 1e9;
  for (let x = w * 0.05; x < w * 0.24; x += 4) {
    const y = r2(x);
    if (y < r3(x) - 8 && y < bbest) { bbest = y; bx = x; }
  }
  g.fillStyle = '#0c1019';
  g.fillRect(bx - 2 * s, r2(bx) - 6 * s, 4 * s, 8 * s);
  S.torches.push({ x: bx, y: r2(bx) - 6 * s, sc: s * 0.55, seed: 4.2, far: true });

  // distant pine forest
  const fr = rng(5);
  const cols = ['#101a22', '#0d151b', '#0a1115'];
  for (let row = 0; row < 3; row++) {
    const y = h * (0.69 + row * 0.012);
    for (let x = -10; x < w + 20; x += 8 + fr() * 6) {
      pineSimple(g, x, y + fr() * 4, (0.36 + fr() * 0.3) * s * (1 + row * 0.18), cols[row]);
    }
  }

  // far procession road follows the nearest ridge silhouette
  S.proc = [];
  for (let x = w * 0.58; x <= w * 1.04; x += 8) S.proc.push([x, r3(Math.min(x, w)) + 6 * s]);
}

// ----------------------------------------------------------------------------
// CASTLE LAYER
// ----------------------------------------------------------------------------

function bakeCastle(S, g) {
  const { w, h, cs: s, cx, gy } = S;
  const X = (v) => cx + v * s;
  const Y = (v) => gy + v * s;
  const baseY = h * 0.76;
  const mh = baseY - gy;
  const rr = rng(11);

  // ---- crag ----
  const mp = [[-470, 0], [-420, 0.1], [-370, 0.22], [-330, 0.42], [-300, 0.6], [-268, 0.84], [-246, 1],
              [246, 1], [268, 0.86], [304, 0.64], [346, 0.44], [395, 0.26], [440, 0.1], [480, 0]];
  const mpts = mp.map(([x, f], i) => [X(x), baseY - f * mh + (i > 0 && i < mp.length - 1 ? (rr() - 0.5) * 6 * s : 0)]);
  const moundY = (xu) => {
    for (let i = 0; i < mp.length - 1; i++) {
      if (xu >= mp[i][0] && xu <= mp[i + 1][0]) return lerp(mpts[i][1], mpts[i + 1][1], (xu - mp[i][0]) / (mp[i + 1][0] - mp[i][0]));
    }
    return baseY;
  };
  g.beginPath();
  g.moveTo(mpts[0][0], baseY + 30 * s);
  mpts.forEach((p) => g.lineTo(p[0], p[1]));
  g.lineTo(mpts[mpts.length - 1][0], baseY + 30 * s);
  g.closePath();
  let gr = g.createLinearGradient(0, gy, 0, baseY);
  gr.addColorStop(0, '#3b3c46'); gr.addColorStop(1, '#16181e');
  g.fillStyle = gr; g.fill();
  g.save(); g.clip();
  for (let i = 0; i < 80; i++) {
    const x = X(-470 + rr() * 940), y = gy + rr() * mh;
    g.strokeStyle = rr() < 0.5 ? 'rgba(0,0,0,.24)' : 'rgba(190,200,230,.08)';
    g.lineWidth = (1 + rr() * 1.5) * s;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (10 + rr() * 30) * s, y + (rr() - 0.3) * 10 * s); g.stroke();
  }
  gr = g.createLinearGradient(X(-470), 0, X(480), 0);
  gr.addColorStop(0, 'rgba(0,0,10,.38)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(150,170,220,.12)');
  g.fillStyle = gr; g.fillRect(0, gy - 10, w, mh + 40);
  g.restore();

  // ---- masonry helpers (px based) ----
  const blocks = (x, y, wd, ht, seed) => {
    const r = rng(seed * 7 + 3);
    const rowH = 8.5 * s;
    g.strokeStyle = 'rgba(0,0,0,.2)';
    g.lineWidth = Math.max(0.6, 0.7 * s);
    g.beginPath();
    let row = 0;
    for (let yy = y + rowH; yy < y + ht; yy += rowH) {
      g.moveTo(x, yy); g.lineTo(x + wd, yy);
      for (let xx = x + (row % 2) * 6 * s + (6 + r() * 8) * s; xx < x + wd; xx += (12 + r() * 8) * s) {
        g.moveTo(xx, yy - rowH); g.lineTo(xx, yy);
      }
      row++;
    }
    g.stroke();
  };
  const stoneTone = (x, wd, y, ht) => {
    let gr2 = g.createLinearGradient(x, 0, x + wd, 0);
    gr2.addColorStop(0, '#32333b'); gr2.addColorStop(0.55, '#4f505c'); gr2.addColorStop(1, '#6b6d7e');
    g.fillStyle = gr2; g.fillRect(x, y, wd, ht);
    gr2 = g.createLinearGradient(0, y, 0, y + ht);
    gr2.addColorStop(0, 'rgba(0,0,0,0)'); gr2.addColorStop(1, 'rgba(0,0,8,.38)');
    g.fillStyle = gr2; g.fillRect(x, y, wd, ht);
  };
  const body = (x, y, wd, ht, seed) => {
    stoneTone(x, wd, y, ht);
    blocks(x, y, wd, ht, seed);
    g.fillStyle = 'rgba(185,200,240,.17)';
    g.fillRect(x + wd - 2.2 * s, y, 2.2 * s, ht);
  };
  const slab = (x, y, wd) => {
    g.fillStyle = '#41424d'; g.fillRect(x - 3 * s, y - 5 * s, wd + 6 * s, 5 * s);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 3 * s, y, wd + 6 * s, 2 * s);
    g.fillStyle = 'rgba(190,205,245,.16)'; g.fillRect(x + wd * 0.55, y - 5 * s, wd * 0.45 + 3 * s, 1.8 * s);
  };
  const merl = (x, y, wd, mw = 9 * s, gap = 7 * s, mh2 = 10 * s) => {
    const n = Math.max(1, Math.floor((wd + gap) / (mw + gap)));
    const off = (wd - (n * mw + (n - 1) * gap)) / 2;
    for (let i = 0; i < n; i++) {
      const mx = x + off + i * (mw + gap);
      g.fillStyle = '#4b4c58'; g.fillRect(mx, y - mh2, mw, mh2 + 0.5);
      g.fillStyle = 'rgba(190,205,245,.18)'; g.fillRect(mx + mw - 1.6 * s, y - mh2, 1.6 * s, mh2);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(mx, y - mh2, 1.4 * s, mh2);
    }
  };
  const cone = (xc, by, hw, ht) => {
    const g2 = g.createLinearGradient(xc - hw, 0, xc + hw, 0);
    g2.addColorStop(0, '#1d1e27'); g2.addColorStop(0.55, '#2c2e3d'); g2.addColorStop(1, '#41445a');
    g.fillStyle = g2; poly(g, [[xc - hw, by], [xc, by - ht], [xc + hw, by]]);
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = Math.max(0.6, 0.8 * s);
    for (let k = 1; k < 8; k++) {
      const f = k / 8, hh = hw * (1 - f);
      g.beginPath(); g.moveTo(xc - hh, by - ht * f); g.lineTo(xc + hh, by - ht * f); g.stroke();
    }
    g.fillStyle = '#16171e'; g.fillRect(xc - hw - 2 * s, by - 1.5 * s, hw * 2 + 4 * s, 3.5 * s);
    g.strokeStyle = 'rgba(196,208,248,.3)'; g.lineWidth = Math.max(1, 1.3 * s);
    g.beginPath(); g.moveTo(xc, by - ht); g.lineTo(xc + hw, by); g.stroke();
    g.strokeStyle = '#8a7a58'; g.lineWidth = Math.max(1, 1.2 * s);
    g.beginPath(); g.moveTo(xc, by - ht); g.lineTo(xc, by - ht - 7 * s); g.stroke();
  };
  const rtower = (xc, top, bot, r) => {
    let g2 = g.createLinearGradient(xc - r, 0, xc + r, 0);
    g2.addColorStop(0, '#2a2b33'); g2.addColorStop(0.45, '#4a4b58'); g2.addColorStop(0.78, '#6c6e80'); g2.addColorStop(1, '#383945');
    g.fillStyle = g2; g.fillRect(xc - r, top, r * 2, bot - top);
    g2 = g.createLinearGradient(0, top, 0, bot);
    g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,8,.4)');
    g.fillStyle = g2; g.fillRect(xc - r, top, r * 2, bot - top);
    blocks(xc - r, top, r * 2, bot - top, Math.floor(xc));
    slab(xc - r, top, r * 2);
  };
  const win = (xc, yc, wd, ht, kind = 'warm') => {
    g.fillStyle = '#0f1015'; archPath(g, xc, yc, wd + 2.4 * s, ht + 2.4 * s); g.fill();
    g.fillStyle = kind === 'violet' ? '#3a2e54' : '#5a4524'; archPath(g, xc, yc, wd, ht); g.fill();
    S.windows.push({ x: xc, y: yc, w: wd, h: ht, arch: true, seed: hash(xc * 0.37 + yc * 0.11), kind, on: kind === 'violet' });
  };
  const slit = (xc, yc, ht) => { g.fillStyle = '#0c0c11'; g.fillRect(xc - 1.2 * s, yc - ht / 2, 2.4 * s, ht); };

  // ---- back structures ----
  // right spire with a magical beacon
  body(X(100), Y(-214), 44 * s, 214 * s, 5);
  slab(X(100), Y(-214), 44 * s);
  cone(X(122), Y(-219), 31 * s, 86 * s);
  win(X(122), Y(-172), 8 * s, 17 * s, 'violet');
  win(X(122), Y(-128), 6 * s, 12 * s, 'violet');
  S.torches.push({ x: X(122), y: Y(-312), sc: s, seed: 7, kind: 'orb' });

  // left tower
  body(X(-138), Y(-180), 40 * s, 180 * s, 6);
  slab(X(-138), Y(-180), 40 * s);
  cone(X(-118), Y(-185), 29 * s, 74 * s);
  win(X(-118), Y(-148), 7 * s, 14 * s);
  slit(X(-118), Y(-118), 12 * s);

  // kitchen block with chimney
  g.fillStyle = '#463a35'; g.fillRect(X(-180), Y(-98), 40 * s, 98 * s);
  g.fillStyle = '#2a2227'; poly(g, [[X(-186), Y(-96)], [X(-160), Y(-126)], [X(-134), Y(-96)]]);
  g.fillStyle = '#3b3a45'; g.fillRect(X(-154), Y(-140), 8 * s, 18 * s);
  S.smokes.push({ x: X(-150), y: Y(-141), sc: s * 1.1, seed: 0.3 });

  // keep and its central tower
  body(X(-80), Y(-196), 160 * s, 196 * s, 8);
  slab(X(-80), Y(-196), 160 * s);
  merl(X(-80), Y(-201), 160 * s);
  body(X(-32), Y(-262), 64 * s, 70 * s, 9);
  slab(X(-32), Y(-262), 64 * s);
  cone(X(0), Y(-267), 40 * s, 66 * s);
  g.fillStyle = '#3b3a45'; g.fillRect(X(-68), Y(-216), 8 * s, 15 * s);
  S.smokes.push({ x: X(-64), y: Y(-217), sc: s * 1.1, seed: 1.6 });
  win(X(-48), Y(-174), 8 * s, 18 * s);
  win(X(0), Y(-174), 10 * s, 22 * s);
  win(X(48), Y(-174), 8 * s, 18 * s);
  win(X(-26), Y(-142), 7 * s, 14 * s);
  win(X(26), Y(-142), 7 * s, 14 * s);
  win(X(0), Y(-232), 7 * s, 15 * s);

  // ---- curtain wall ----
  body(X(-262), Y(-76), 524 * s, 76 * s, 12);
  g.fillStyle = '#41424d'; g.fillRect(X(-262), Y(-81), 524 * s, 5 * s);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(X(-262), Y(-76), 524 * s, 8 * s);
  merl(X(-262), Y(-81), 524 * s);
  for (const sx of [-1, 1]) for (const ux of [84, 108, 132, 156]) slit(X(sx * ux), Y(-44), 12 * s);

  // ---- outer walls descending the crag ----
  for (const sd of [-1, 1]) {
    const exu = sd * 392;
    const ex = X(exu), ey = moundY(exu);
    const x0 = X(sd * 262);
    g.fillStyle = '#3b3c46';
    poly(g, [[x0, Y(0)], [ex, ey], [ex, ey - 60 * s], [x0, Y(-76)]]);
    g.fillStyle = 'rgba(0,0,8,.25)';
    poly(g, [[x0, Y(0)], [ex, ey], [ex, ey - 24 * s], [x0, Y(-30)]]);
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = Math.max(0.6, 0.7 * s);
    for (let k = 1; k < 7; k++) {
      const f = k / 7;
      g.beginPath(); g.moveTo(x0, lerp(Y(-76), Y(0), f)); g.lineTo(ex, lerp(ey - 60 * s, ey, f)); g.stroke();
    }
    g.save(); g.setLineDash([9 * s, 7 * s]); g.strokeStyle = '#4b4c58'; g.lineWidth = 10 * s;
    g.beginPath(); g.moveTo(x0, Y(-76) - 5 * s); g.lineTo(ex, ey - 60 * s - 5 * s); g.stroke(); g.restore();
    rtower(ex, ey - 78 * s, ey + 2 * s, 15 * s);
    cone(ex, ey - 83 * s, 20 * s, 44 * s);
    slit(ex, ey - 40 * s, 12 * s);
    S.torches.push({ x: ex - sd * 30 * s, y: ey - 34 * s, sc: s * 0.9, seed: 20 + sd });
    S.flags.push({ x: ex, y: ey - 127 * s - 7 * s, sc: s * 0.55, col: '#8f3643', seed: 3 + sd });
  }

  // ---- round corner towers ----
  for (const sd of [-1, 1]) {
    const xc = X(sd * 262);
    rtower(xc, Y(-140), Y(0), 24 * s);
    cone(xc, Y(-145), 31 * s, 66 * s);
    win(xc, Y(-110), 7 * s, 14 * s);
    slit(xc, Y(-84), 12 * s);
    slit(xc, Y(-50), 12 * s);
    S.flags.push({ x: xc, y: Y(-211), sc: s * 0.9, col: sd < 0 ? '#9d3d4a' : '#8b3447', seed: 1 + sd });
  }

  // ---- square wall towers ----
  for (const sd of [-1, 1]) {
    const xl = X(sd * 205 - 21);
    body(xl, Y(-108), 42 * s, 108 * s, 30 + sd);
    slab(xl, Y(-108), 42 * s);
    cone(X(sd * 205), Y(-113), 28 * s, 46 * s);
    win(X(sd * 205), Y(-90), 6 * s, 12 * s);
    slit(X(sd * 205), Y(-52), 12 * s);
    S.flags.push({ x: X(sd * 205), y: Y(-166), sc: s * 0.7, col: '#a94650', seed: 8 + sd });
  }

  // ---- gatehouse ----
  body(X(-54), Y(-124), 108 * s, 124 * s, 21);
  slab(X(-54), Y(-124), 108 * s);
  merl(X(-54), Y(-129), 108 * s);
  for (const sd of [-1, 1]) {
    rtower(X(sd * 54), Y(-150), Y(0), 14 * s);
    cone(X(sd * 54), Y(-155), 19 * s, 44 * s);
    slit(X(sd * 54), Y(-110), 12 * s);
    slit(X(sd * 54), Y(-74), 12 * s);
    S.flags.push({ x: X(sd * 54), y: Y(-199) - 7 * s, sc: s * 0.55, col: '#b44a50', seed: 15 + sd });
    win(X(sd * 30), Y(-104), 5 * s, 10 * s);
    S.torches.push({ x: X(sd * 70), y: Y(-40), sc: s, seed: 30 + sd });
    S.torches.push({ x: X(sd * 122), y: Y(-44), sc: s * 0.9, seed: 40 + sd });
    S.torches.push({ x: X(sd * 218), y: Y(-44), sc: s * 0.9, seed: 50 + sd });
  }
  // keep banner & flag
  S.flags.push({ x: X(0), y: Y(-333) - 7 * s, sc: s * 1.15, col: '#b94a52', seed: 2 });
  // hanging banners (animated live)
  S.banners.push({ x: X(-36), y: Y(-118), len: 44 * s, wd: 13 * s, col: '#8d3341', seed: 1 });
  S.banners.push({ x: X(36), y: Y(-118), len: 44 * s, wd: 13 * s, col: '#8d3341', seed: 2 });
  S.banners.push({ x: X(-62), y: Y(-196), len: 58 * s, wd: 17 * s, col: '#7e2d3c', seed: 3 });
  S.banners.push({ x: X(62), y: Y(-196), len: 58 * s, wd: 17 * s, col: '#7e2d3c', seed: 4 });

  // arch, stone surround, shield
  const aw = 46 * s, ah = 62 * s;
  S.gate = { x: cx, y: gy, aw, ah };
  g.fillStyle = '#5b5c69'; archPath(g, cx, gy - (ah + 8 * s) / 2, aw + 14 * s, ah + 8 * s); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(0.8, s);
  for (let a = Math.PI; a <= TAU + 0.01; a += Math.PI / 9) {
    const ccx = cx, ccy = gy - ah + aw / 2;
    g.beginPath();
    g.moveTo(ccx + Math.cos(a) * (aw / 2), ccy + Math.sin(a) * (aw / 2));
    g.lineTo(ccx + Math.cos(a) * (aw / 2 + 7 * s), ccy + Math.sin(a) * (aw / 2 + 7 * s));
    g.stroke();
  }
  g.fillStyle = '#08080c'; archPath(g, cx, gy - ah / 2, aw, ah); g.fill();
  g.fillStyle = '#3c3d48'; g.fillRect(cx - aw / 2 - 12 * s, gy - 3 * s, aw + 24 * s, 5 * s);
  // heraldic shield above the arch
  const shx = cx, shy = gy - 94 * s;
  g.fillStyle = '#b89a4e';
  g.beginPath(); g.moveTo(shx - 11 * s, shy - 12 * s); g.lineTo(shx + 11 * s, shy - 12 * s);
  g.lineTo(shx + 11 * s, shy + 3 * s); g.quadraticCurveTo(shx + 11 * s, shy + 14 * s, shx, shy + 18 * s);
  g.quadraticCurveTo(shx - 11 * s, shy + 14 * s, shx - 11 * s, shy + 3 * s); g.closePath(); g.fill();
  g.fillStyle = '#7a2530';
  g.beginPath(); g.moveTo(shx - 9 * s, shy - 10 * s); g.lineTo(shx + 9 * s, shy - 10 * s);
  g.lineTo(shx + 9 * s, shy + 3 * s); g.quadraticCurveTo(shx + 9 * s, shy + 12 * s, shx, shy + 15.5 * s);
  g.quadraticCurveTo(shx - 9 * s, shy + 12 * s, shx - 9 * s, shy + 3 * s); g.closePath(); g.fill();
  g.strokeStyle = '#d2b765'; g.lineWidth = Math.max(1, 1.8 * s);
  g.beginPath(); g.moveTo(shx - 7 * s, shy + 3 * s); g.lineTo(shx, shy - 4 * s); g.lineTo(shx + 7 * s, shy + 3 * s); g.stroke();

  // guard patrol routes along the walls
  S.guardY = Y(-76);
  S.guardRange = [[X(-215), X(-78)], [X(78), X(215)]];

  // chimney smoke from the keep roof joins the list above; ambient grading
  g.save();
  g.globalCompositeOperation = 'source-atop';
  gr = g.createLinearGradient(0, gy - 340 * s, 0, baseY);
  gr.addColorStop(0, 'rgba(120,140,200,.06)'); gr.addColorStop(0.7, 'rgba(10,10,24,.10)'); gr.addColorStop(1, 'rgba(6,6,16,.35)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.restore();

  // pines clinging to the crag
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const xu = sd * (270 + rr() * 190);
      pineSimple(g, X(xu), moundY(xu) + 4 * s, (0.38 + rr() * 0.34) * s, '#0b1612');
    }
  }
}

// ----------------------------------------------------------------------------
// NEAR LAYER: hills, village, road, river, bridge, foreground
// ----------------------------------------------------------------------------

function drawBuilding(g, S, it) {
  const { x, y, sc, kind, seed } = it;
  const r = rng(seed * 13 + 5);
  g.save();
  g.translate(x, y);
  g.scale(sc, sc);
  const A = (lx, ly) => [x + lx * sc, y + ly * sc];

  const wall = ['#5b4a3e', '#524339', '#4d4038', '#5f4d40'][seed % 4];
  const thatch = r() < 0.5;
  const roofCol = thatch ? '#4b3b29' : (r() < 0.5 ? '#2c2b35' : '#34262a');
  const sideCol = 'rgba(0,0,0,.34)';
  const ox = -12, oy = -4;

  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(-2, 3, kind === 3 ? 52 : 40, 6, 0, 0, TAU); g.fill();

  const win = (lx, ly, ww, hh, shut = true) => {
    g.fillStyle = '#17110e'; g.fillRect(lx - ww / 2 - 1.2, ly - hh / 2 - 1.2, ww + 2.4, hh + 2.4);
    g.fillStyle = '#5f4826'; g.fillRect(lx - ww / 2, ly - hh / 2, ww, hh);
    if (shut) { g.fillStyle = '#2a1d17'; g.fillRect(lx - ww / 2 - 3.4, ly - hh / 2, 2.6, hh); g.fillRect(lx + ww / 2 + 0.8, ly - hh / 2, 2.6, hh); }
    const [ax, ay] = A(lx, ly);
    S.windows.push({ x: ax, y: ay, w: ww * sc, h: hh * sc, arch: false, seed: hash(ax * 0.13 + ay * 0.71), kind: 'warm', on: kind === 4, village: true });
  };
  const frontWall = (hw, top, bot) => {
    g.fillStyle = wall; g.fillRect(-hw, top, hw * 2, bot - top);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-hw, bot - 5, hw * 2, 5);
    g.fillStyle = 'rgba(185,200,240,.13)'; g.fillRect(hw - 2.5, top, 2.5, bot - top);
  };
  const sideWall = (hw, top, bot) => {
    g.fillStyle = wall; poly(g, [[-hw, bot], [-hw + ox, bot + oy], [-hw + ox, top + oy], [-hw, top]]);
    g.fillStyle = sideCol; poly(g, [[-hw, bot], [-hw + ox, bot + oy], [-hw + ox, top + oy], [-hw, top]]);
  };
  const timber = (hw, top, bot, posts) => {
    g.strokeStyle = '#271b16'; g.lineWidth = 1.7;
    g.beginPath(); g.moveTo(-hw, top); g.lineTo(hw, top); g.moveTo(-hw, bot - 3); g.lineTo(hw, bot - 3);
    for (const px of posts) { g.moveTo(px, top); g.lineTo(px, bot); }
    g.moveTo(-hw, top); g.lineTo(posts[0] ?? -hw + 8, bot);
    g.moveTo(hw, top); g.lineTo(posts[posts.length - 1] ?? hw - 8, bot);
    g.stroke();
  };
  const gable = (hw, eave, apex, col, over) => {
    const hr = hw + over;
    g.fillStyle = col;
    poly(g, [[-hr, eave], [0, apex], [ox, apex + oy], [-hr + ox, eave + oy]]);
    g.fillStyle = sideCol;
    poly(g, [[-hr, eave], [0, apex], [ox, apex + oy], [-hr + ox, eave + oy]]);
    g.fillStyle = col;
    poly(g, [[-hr, eave + 2], [0, apex], [hr, eave + 2]]);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 0.8;
    for (let k = 1; k < 7; k++) {
      const f = k / 7, hh = hr * f, yy = apex + (eave - apex) * f;
      g.beginPath(); g.moveTo(-hh, yy); g.lineTo(hh, yy); g.stroke();
    }
    g.strokeStyle = 'rgba(190,205,245,.3)'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(0, apex); g.lineTo(hr, eave + 2); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-hr + 1, eave + 1, hr * 2 - 2, 3);
  };
  const chimney = (cxl, top, bot) => {
    g.fillStyle = '#403b3b'; g.fillRect(cxl - 3.5, top, 7, bot - top);
    g.fillStyle = 'rgba(185,200,240,.18)'; g.fillRect(cxl + 1.5, top, 2, bot - top);
    g.fillStyle = '#2a2626'; g.fillRect(cxl - 4.5, top - 2, 9, 3);
    const [ax, ay] = A(cxl, top - 2);
    S.smokes.push({ x: ax, y: ay, sc: sc * 0.9, seed: hash(seed + cxl) * 3, village: true });
  };
  const door = (dx, dw, dh) => {
    g.fillStyle = '#1f1613'; archPath(g, dx, -dh / 2, dw, dh); g.fill();
  };

  if (kind === 0) {
    sideWall(24, -30, 0); frontWall(24, -30, 0); timber(24, -30, 0, [-24, -8, 24]);
    gable(24, -30, -58, roofCol, 5); chimney(14, -62, -42);
    door(0, 10, 19); win(-14, -18, 8, 9); win(15, -18, 8, 9);
  } else if (kind === 1) {
    sideWall(22, -26, 0); frontWall(22, -26, 0);
    g.fillStyle = '#3f322b'; g.fillRect(-26, -30, 52, 6);
    sideWall(25, -52, -26); frontWall(25, -52, -26);
    timber(25, -52, -26, [-25, 0, 25]);
    gable(25, -52, -90, roofCol, 5); chimney(13, -90, -66);
    door(9, 10, 19); win(-11, -13, 7, 9); win(-11, -40, 8, 10); win(11, -40, 8, 10);
  } else if (kind === 2) {
    sideWall(36, -30, 0); frontWall(36, -30, 0); timber(36, -30, 0, [-36, -12, 12, 36]);
    gable(36, -30, -55, roofCol, 5); chimney(-22, -57, -38); chimney(24, -57, -40);
    door(0, 10, 19); win(-22, -18, 7, 8); win(22, -18, 7, 8); win(-8, -18, 5, 8, false);
  } else if (kind === 3) {
    // church
    sideWall(26, -40, 0); g.fillStyle = '#665a52'; g.fillRect(-18, -40, 52, 40);
    g.fillStyle = 'rgba(185,200,240,.13)'; g.fillRect(31.5, -40, 2.5, 40);
    gable(26, -40, -74, '#2b2a35', 4);
    const gx = (xx, yy, ww, hh) => {
      g.fillStyle = '#17110e'; archPath(g, xx, yy, ww + 2, hh + 2); g.fill();
      g.fillStyle = '#6b4c20'; archPath(g, xx, yy, ww, hh); g.fill();
      const [ax, ay] = A(xx, yy);
      S.windows.push({ x: ax, y: ay, w: ww * sc, h: hh * sc, arch: true, seed: hash(ax), kind: 'amber', on: true, village: true });
    };
    gx(-4, -22, 5, 16); gx(10, -22, 5, 16); gx(24, -22, 5, 16);
    door(8, 11, 17);
    g.fillStyle = '#5c5048'; g.fillRect(-41, -96, 22, 96);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-41, -96, 8, 96);
    g.fillStyle = 'rgba(185,200,240,.15)'; g.fillRect(-21.5, -96, 2.5, 96);
    g.fillStyle = '#17110e'; archPath(g, -30, -80, 9, 15); g.fill();
    g.fillStyle = '#2b2a35'; poly(g, [[-44, -96], [-30, -142], [-16, -96]]);
    g.strokeStyle = 'rgba(190,205,245,.3)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-30, -142); g.lineTo(-16, -96); g.stroke();
    g.strokeStyle = '#a89868'; g.lineWidth = 1.3; g.beginPath();
    g.moveTo(-30, -142); g.lineTo(-30, -156); g.moveTo(-34, -150); g.lineTo(-26, -150); g.stroke();
  } else if (kind === 4) {
    // tavern
    sideWall(36, -34, 0); frontWall(36, -34, 0);
    g.fillStyle = '#3f322b'; g.fillRect(-40, -38, 80, 6);
    sideWall(39, -62, -34); frontWall(39, -62, -34); timber(39, -62, -34, [-39, -13, 13, 39]);
    gable(39, -62, -100, roofCol, 5); chimney(24, -100, -72);
    door(0, 14, 23); win(-23, -18, 8, 9); win(23, -18, 8, 9);
    win(-26, -48, 8, 10); win(0, -48, 8, 10); win(26, -48, 8, 10);
    const [lx, ly] = A(20, -26);
    S.lamps.push({ x: lx, y: ly + 12 * sc, sc: sc * 0.7, tavern: true });
    g.fillStyle = '#2b1e17'; g.fillRect(36, -40, 14, 2);
    const [sx2, sy2] = A(46, -38);
    S.signs.push({ x: sx2, y: sy2, sc });
  } else if (kind === 5) {
    // smithy
    g.fillStyle = '#241512'; g.fillRect(-28, -34, 56, 34);
    g.fillStyle = '#3a2a25'; g.fillRect(-20, -15, 22, 15);
    g.fillStyle = '#2b1e17'; g.fillRect(-34, -36, 4, 36); g.fillRect(30, -36, 4, 36);
    g.fillStyle = roofCol; poly(g, [[-40, -33], [-33, -48], [38, -48], [44, -33]]);
    g.strokeStyle = 'rgba(190,205,245,.28)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(38, -48); g.lineTo(44, -33); g.stroke();
    g.fillStyle = '#403b3b'; g.fillRect(14, -76, 11, 30);
    g.fillStyle = '#17110e'; g.fillRect(14, -10, 10, 5); g.fillRect(16, -5, 6, 5);
    const [fx, fy] = A(-9, -9);
    S.forges.push({ x: fx, y: fy, sc });
    const [ax, ay] = A(19, -77);
    S.smokes.push({ x: ax, y: ay, sc: sc * 1.1, seed: 2.2, village: true });
  } else if (kind === 6) {
    // windmill
    g.fillStyle = '#4a4038'; poly(g, [[-18, 0], [-11, -78], [11, -78], [18, 0]]);
    g.fillStyle = sideCol; poly(g, [[-18, 0], [-11, -78], [-2, -78], [-4, 0]]);
    g.fillStyle = 'rgba(185,200,240,.14)'; poly(g, [[16, 0], [18, 0], [11, -78], [9.4, -78]]);
    g.fillStyle = '#17110e'; archPath(g, 0, -9, 9, 18); g.fill();
    g.fillStyle = '#2a2530'; g.beginPath(); g.moveTo(-14, -78); g.quadraticCurveTo(0, -112, 14, -78); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(190,205,245,.28)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -97); g.quadraticCurveTo(10, -92, 14, -78); g.stroke();
    g.fillStyle = '#17110e'; g.fillRect(-3, -50, 6, 9);
    const [wx, wy] = A(0, -45);
    S.windows.push({ x: wx, y: wy, w: 6 * sc, h: 9 * sc, arch: false, seed: 0.77, kind: 'warm', on: false, village: true });
    const [hx, hy] = A(0, -84);
    S.sails.push({ x: hx, y: hy, len: 56 * sc, sc });
  }
  g.restore();
}

function bakeNear(S, g) {
  const { w, h, s, cs, cx, gy } = S;
  const gt = S.groundTop;
  const r = rng(77);

  // ---- ground ----
  g.beginPath();
  g.moveTo(0, h + 2);
  for (let x = 0; x <= w + 6; x += 6) g.lineTo(x, gt(x));
  g.lineTo(w, h + 2);
  g.closePath();
  let gr = g.createLinearGradient(0, h * 0.72, 0, h);
  gr.addColorStop(0, '#242e23'); gr.addColorStop(0.45, '#161e17'); gr.addColorStop(1, '#080c0a');
  g.fillStyle = gr; g.fill();
  g.save(); g.clip();
  for (let i = 0; i < 26; i++) {
    const px = r() * w, py = h * (0.74 + r() * 0.26), pr = (30 + r() * 90) * s;
    g.save(); g.translate(px, py); g.scale(2.4, 1);
    const pg = g.createRadialGradient(0, 0, 0, 0, 0, pr);
    const light = r() < 0.55;
    pg.addColorStop(0, light ? 'rgba(78,104,78,.10)' : 'rgba(0,0,0,.14)');
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = pg; g.beginPath(); g.arc(0, 0, pr, 0, TAU); g.fill(); g.restore();
  }
  g.restore();
  const crest = g.createLinearGradient(0, 0, w, 0);
  crest.addColorStop(0, 'rgba(150,170,200,.05)'); crest.addColorStop(0.8, 'rgba(180,196,230,.2)'); crest.addColorStop(1, 'rgba(150,170,200,.08)');
  g.strokeStyle = crest; g.lineWidth = Math.max(1, 1.4 * s);
  g.beginPath();
  for (let x = 0; x <= w + 6; x += 6) { if (x === 0) g.moveTo(x, gt(x)); else g.lineTo(x, gt(x)); }
  g.stroke();

  // ---- road ----
  const R = S.road;
  const left = [], right = [];
  for (let i = 0; i < R.length; i++) {
    const a = R[Math.max(0, i - 1)], b = R[Math.min(R.length - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    R[i].nx = -ty; R[i].ny = tx;
    left.push([R[i].x + R[i].nx * R[i].w / 2, R[i].y + R[i].ny * R[i].w / 2]);
    right.push([R[i].x - R[i].nx * R[i].w / 2, R[i].y - R[i].ny * R[i].w / 2]);
  }
  g.beginPath();
  left.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
  g.closePath();
  gr = g.createLinearGradient(0, gy, 0, h);
  gr.addColorStop(0, 'rgba(158,134,104,.62)'); gr.addColorStop(0.4, 'rgba(110,94,74,.78)'); gr.addColorStop(1, 'rgba(84,70,56,.85)');
  g.fillStyle = gr; g.fill();
  g.save(); g.clip();
  for (let i = 0; i < 380; i++) {
    const p = R[Math.floor(r() * R.length)];
    const off = (r() - 0.5) * p.w * 0.9;
    const sz = Math.max(0.8, p.w * 0.03) * (0.6 + r());
    g.fillStyle = r() < 0.5 ? 'rgba(200,185,155,.12)' : 'rgba(0,0,0,.14)';
    g.beginPath(); g.ellipse(p.x + p.nx * off, p.y + p.ny * off, sz * 1.5, sz, 0, 0, TAU); g.fill();
  }
  g.restore();
  g.strokeStyle = 'rgba(14,11,8,.3)'; g.lineWidth = Math.max(1.2, 2 * s);
  for (const side of [-0.22, 0.22]) {
    g.beginPath();
    R.forEach((p, i) => { const px = p.x + p.nx * p.w * side, py = p.y + p.ny * p.w * side; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    g.stroke();
  }
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = Math.max(1, 1.6 * s);
  for (const pts of [left, right]) {
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
  }
  for (let i = 2; i < R.length; i += 3) {
    const p = R[i];
    for (const sd of [-1, 1]) {
      const off = p.w / 2 + (2 + r() * 5) * s;
      g.fillStyle = r() < 0.5 ? '#2b2e29' : '#232620';
      g.beginPath(); g.ellipse(p.x + p.nx * off * sd, p.y + p.ny * off * sd, (1.5 + r() * 2.4) * (p.w / (70 * s) + 0.5), (1 + r() * 1.5), 0, 0, TAU); g.fill();
    }
  }

  // ---- lane beside the river ----
  g.strokeStyle = 'rgba(88,72,52,.55)'; g.lineWidth = 11 * s; g.lineCap = 'round';
  g.beginPath();
  for (let x = -10; x <= w + 10; x += 10) { if (x === -10) g.moveTo(x, S.lane(x)); else g.lineTo(x, S.lane(x)); }
  g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = Math.max(1, 1.4 * s);
  g.beginPath();
  for (let x = -10; x <= w + 10; x += 10) { if (x === -10) g.moveTo(x, S.lane(x) + 3 * s); else g.lineTo(x, S.lane(x) + 3 * s); }
  g.stroke();
  g.lineCap = 'butt';

  // ---- bonfire site (kept clear of houses) ----
  const bfy = h * 0.818;
  const bfr = S.roadAt(bfy);
  let bfx = bfr.x - bfr.w / 2 - 110 * s;
  if (bfx < w * 0.12) bfx = bfr.x + bfr.w / 2 + 110 * s;
  S.bonfire = { x: bfx, y: bfy, sc: s * 1.15 };

  // ---- pines behind the village ----
  const placed = [];
  for (let i = 0; i < 46; i++) {
    const x = r() < 0.55 ? (r() < 0.5 ? r() * w * 0.2 : w * (0.8 + r() * 0.2)) : r() * w;
    const y = h * (0.752 + r() * 0.09);
    const rd = S.roadAt(y);
    if (Math.abs(x - rd.x) < rd.w / 2 + 30 * s) continue;
    if (Math.abs(x - bfx) < 70 * s && Math.abs(y - bfy) < 40 * s) continue;
    placed.push([x, y]);
    pineSimple(g, x, y, (0.5 + r() * 0.45) * s * lerp(0.8, 1.2, (y - h * 0.75) / (h * 0.1)), r() < 0.5 ? '#0c1712' : '#0f1b15');
  }

  // ---- buildings ----
  const rows = [{ y: 0.778, sc: 0.62 }, { y: 0.808, sc: 0.8 }, { y: 0.838, sc: 1.0 }];
  const items = [];
  const mill = { x: w * 0.17, y: gt(w * 0.17) + 10 * s, sc: 1.5 * s };
  rows.forEach((row, ri) => {
    let x = -10 + r() * 40;
    while (x < w + 20) {
      const sc = row.sc * s * (0.9 + r() * 0.25);
      const y = h * row.y + (r() - 0.5) * h * 0.008;
      const rd = S.roadAt(y);
      const bw = 62 * sc;
      if (Math.abs(x - rd.x) < rd.w / 2 + bw * 0.7 + 8 * s) { x = rd.x + rd.w / 2 + bw * 0.85 + 10 * s; continue; }
      const blocked =
        (Math.abs(x - bfx) < 85 * s && Math.abs(y - bfy) < 30 * s) ||
        (ri < 2 && Math.abs(x - mill.x) < 80 * s);
      if (!blocked) {
        const k = r();
        items.push({ x, y, sc, kind: k < 0.45 ? 0 : k < 0.85 ? 1 : 2, seed: Math.floor(r() * 1000), row: ri });
      }
      x += bw * (1.3 + r() * 0.65);
    }
  });
  const pickNear = (ri, tx, kind, scMul) => {
    let best = null, bd = 1e9;
    for (const it of items) {
      if (it.row !== ri || it.kind > 2) continue;
      const d = Math.abs(it.x - tx);
      if (d < bd) { bd = d; best = it; }
    }
    if (best) { best.kind = kind; best.sc *= scMul; }
  };
  pickNear(1, cx - w * 0.2, 3, 1.12);
  pickNear(2, cx + w * 0.24, 4, 1.05);
  pickNear(2, cx - w * 0.3, 5, 1.0);
  items.push({ x: mill.x, y: mill.y, sc: mill.sc, kind: 6, seed: 9, row: -1 });
  items.sort((a, b) => a.y - b.y);
  // trees behind buildings first, then buildings back-to-front
  for (const it of items) drawBuilding(g, S, it);

  // bonfire ring: stones, logs, seated villagers
  {
    const { x, y, sc } = S.bonfire;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y + 3 * sc, 26 * sc, 7 * sc, 0, 0, TAU); g.fill();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.fillStyle = '#34322f';
      g.beginPath(); g.ellipse(x + Math.cos(a) * 15 * sc, y + 1 * sc + Math.sin(a) * 4.5 * sc, 3.4 * sc, 2.4 * sc, 0, 0, TAU); g.fill();
    }
    g.strokeStyle = '#1c130f'; g.lineWidth = 3.2 * sc; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 9 * sc, y); g.lineTo(x + 7 * sc, y - 5 * sc); g.moveTo(x + 9 * sc, y); g.lineTo(x - 7 * sc, y - 5 * sc); g.stroke();
    g.lineCap = 'butt';
    const folks = [[-30, 4], [31, 3], [-6, 14], [20, 13]];
    for (const [fx, fy] of folks) {
      g.fillStyle = '#0e0b0b';
      g.beginPath(); g.ellipse(x + fx * sc, y + fy * sc - 5 * sc, 4.6 * sc, 6.2 * sc, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(x + fx * sc, y + fy * sc - 13.5 * sc, 3 * sc, 0, TAU); g.fill();
    }
  }

  // well beside the road
  {
    const wy = h * 0.848;
    const rd = S.roadAt(wy);
    const wx = rd.x + rd.w / 2 + 44 * s;
    const sc = s * 0.95;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(wx, wy + 2 * sc, 16 * sc, 4 * sc, 0, 0, TAU); g.fill();
    g.fillStyle = '#4a4a54'; g.fillRect(wx - 11 * sc, wy - 13 * sc, 22 * sc, 14 * sc);
    g.fillStyle = 'rgba(185,200,240,.16)'; g.fillRect(wx + 8 * sc, wy - 13 * sc, 3 * sc, 14 * sc);
    g.fillStyle = '#0b0c10'; g.beginPath(); g.ellipse(wx, wy - 13 * sc, 10 * sc, 3 * sc, 0, 0, TAU); g.fill();
    g.fillStyle = '#2b1e17'; g.fillRect(wx - 10 * sc, wy - 34 * sc, 2.4 * sc, 21 * sc); g.fillRect(wx + 8 * sc, wy - 34 * sc, 2.4 * sc, 21 * sc);
    g.fillStyle = '#2e2b36'; poly(g, [[wx - 15 * sc, wy - 32 * sc], [wx, wy - 44 * sc], [wx + 15 * sc, wy - 32 * sc]]);
  }

  // haystacks
  for (const hx of [w * 0.045, w * 0.94, w * 0.3]) {
    const hy = h * 0.845, sc = s * 0.9;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(hx, hy + 2 * sc, 20 * sc, 4.5 * sc, 0, 0, TAU); g.fill();
    const hg = g.createLinearGradient(hx - 18 * sc, 0, hx + 18 * sc, 0);
    hg.addColorStop(0, '#3c3322'); hg.addColorStop(0.7, '#6b5a38'); hg.addColorStop(1, '#4a3f29');
    g.fillStyle = hg; g.beginPath(); g.moveTo(hx - 18 * sc, hy); g.quadraticCurveTo(hx - 15 * sc, hy - 26 * sc, hx, hy - 27 * sc);
    g.quadraticCurveTo(hx + 15 * sc, hy - 26 * sc, hx + 18 * sc, hy); g.closePath(); g.fill();
  }

  // ---- river ----
  const hw = S.rhw;
  g.beginPath();
  for (let x = -4; x <= w + 4; x += 4) { const y = S.ry(x) - hw; if (x === -4) g.moveTo(x, y); else g.lineTo(x, y); }
  for (let x = w + 4; x >= -4; x -= 4) g.lineTo(x, S.ry(x) + hw);
  g.closePath();
  gr = g.createLinearGradient(0, h * 0.86, 0, h * 0.92);
  gr.addColorStop(0, '#1d2c4a'); gr.addColorStop(1, '#0b1325');
  g.fillStyle = gr; g.fill();
  g.strokeStyle = 'rgba(160,185,225,.10)'; g.lineWidth = Math.max(1, 1.2 * s);
  g.beginPath(); for (let x = -4; x <= w + 4; x += 4) { const y = S.ry(x) - hw; if (x === -4) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = Math.max(1.5, 2.4 * s);
  g.beginPath(); for (let x = -4; x <= w + 4; x += 4) { const y = S.ry(x) + hw + 1; if (x === -4) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();

  // reeds
  g.lineWidth = Math.max(1, 1.2 * s);
  for (let i = 0; i < 150; i++) {
    const x = r() * w, top = r() < 0.5;
    const y = S.ry(x) + (top ? -hw : hw) + (r() - 0.5) * 3 * s;
    const hh = (6 + r() * 12) * s, lean = (r() - 0.5) * 5 * s;
    g.strokeStyle = r() < 0.5 ? '#09120d' : '#14231a';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + lean, y - hh); g.stroke();
  }

  // ---- bridge where road meets river ----
  {
    const b = S.bridge;
    const bw = b.w * 1.05;
    const topY = S.ry(b.x) - hw - 5 * s, botY = S.ry(b.x) + hw + 5 * s;
    // shadow arch below deck
    g.fillStyle = '#05080f';
    g.beginPath(); g.ellipse(b.x, botY - 4 * s, bw * 0.34, (botY - topY) * 0.36, 0, Math.PI, TAU); g.fill();
    g.fillStyle = '#50505c'; g.fillRect(b.x - bw / 2, topY, bw, botY - topY);
    let bg = g.createLinearGradient(b.x - bw / 2, 0, b.x + bw / 2, 0);
    bg.addColorStop(0, '#3a3b45'); bg.addColorStop(0.6, '#555664'); bg.addColorStop(1, '#6d6f80');
    g.fillStyle = bg; g.fillRect(b.x - bw / 2, topY, bw, botY - topY);
    g.fillStyle = 'rgba(0,0,8,.28)'; g.fillRect(b.x - bw / 2, botY - 8 * s, bw, 8 * s);
    // road across the deck
    g.fillStyle = 'rgba(96,82,66,.8)'; g.fillRect(b.x - bw * 0.38, topY, bw * 0.76, botY - topY);
    // parapets
    g.fillStyle = '#6a6b79'; g.fillRect(b.x - bw / 2 - 3 * s, topY - 3 * s, 7 * s, botY - topY + 6 * s);
    g.fillRect(b.x + bw / 2 - 4 * s, topY - 3 * s, 7 * s, botY - topY + 6 * s);
    g.fillStyle = 'rgba(190,205,245,.18)'; g.fillRect(b.x + bw / 2 - 1 * s, topY - 3 * s, 3 * s, botY - topY + 6 * s);
    // arch voussoirs under the near face
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(0.8, s);
    for (let a = Math.PI * 1.1; a < TAU - 0.1; a += 0.28) {
      const ax = b.x + Math.cos(a) * bw * 0.34, ay = botY - 4 * s + Math.sin(a) * (botY - topY) * 0.36;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + Math.cos(a) * 5 * s, ay + Math.sin(a) * 5 * s); g.stroke();
    }
    // lamp posts at the four corners
    for (const sx of [-1, 1]) for (const yy of [topY - 2 * s, botY + 2 * s]) {
      S.lamps.push({ x: b.x + sx * (bw / 2 + 1 * s), y: yy, sc: s * 0.9 });
    }
  }
  // lamps along the road
  for (const idx of [Math.floor(R.length * 0.36), Math.floor(R.length * 0.55)]) {
    const p = R[idx];
    for (const sd of [-1, 1]) S.lamps.push({ x: p.x + p.nx * sd * (p.w / 2 + 8 * s), y: p.y, sc: s * (0.6 + (p.y - gy) / (h - gy) * 0.5) });
  }
  for (const lp of S.lamps) {
    if (lp.tavern) continue;
    g.fillStyle = '#17120f';
    g.fillRect(lp.x - 1.3 * lp.sc, lp.y - 30 * lp.sc, 2.6 * lp.sc, 30 * lp.sc);
    g.fillRect(lp.x - 4 * lp.sc, lp.y - 39 * lp.sc, 8 * lp.sc, 9 * lp.sc);
    poly(g, [[lp.x - 5.5 * lp.sc, lp.y - 39 * lp.sc], [lp.x, lp.y - 45 * lp.sc], [lp.x + 5.5 * lp.sc, lp.y - 39 * lp.sc]]);
    g.fillStyle = '#6b5026'; g.fillRect(lp.x - 2.6 * lp.sc, lp.y - 37.5 * lp.sc, 5.2 * lp.sc, 6 * lp.sc);
  }

  // ---- foreground bank ----
  gr = g.createLinearGradient(0, h * 0.905, 0, h);
  gr.addColorStop(0, 'rgba(2,5,4,0)'); gr.addColorStop(1, 'rgba(2,5,4,.62)');
  g.fillStyle = gr; g.fillRect(0, h * 0.905, w, h * 0.095);
  for (let i = 0; i < 120; i++) {
    const y = lerp(h * 0.92, h, Math.pow(r(), 0.8));
    const x = r() * w;
    const rd = S.roadAt(y);
    if (Math.abs(x - rd.x) < rd.w * 0.55) continue;
    const persp = 0.7 + (y - h * 0.9) / (h * 0.1) * 0.7;
    const hh = (7 + r() * 15) * s * persp;
    g.strokeStyle = r() < 0.7 ? '#08110c' : 'rgba(30,52,34,.75)';
    g.lineWidth = Math.max(1, 1.3 * s * persp);
    g.beginPath();
    for (let k = -2; k <= 2; k++) {
      g.moveTo(x + k * 2.2 * s, y);
      g.quadraticCurveTo(x + k * 3.2 * s, y - hh * 0.6, x + k * 5 * s + (r() - 0.5) * 3 * s, y - hh);
    }
    g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = r() * w, y = lerp(h * 0.925, h * 0.99, r());
    const rd = S.roadAt(y);
    if (Math.abs(x - rd.x) < rd.w * 0.55) continue;
    g.fillStyle = '#10130f';
    g.beginPath(); g.ellipse(x, y, (6 + r() * 10) * s, (3 + r() * 4) * s, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(160,180,215,.1)';
    g.beginPath(); g.ellipse(x + 1 * s, y - 1 * s, (4 + r() * 6) * s, (1.5 + r() * 2) * s, 0, Math.PI, TAU); g.fill();
  }
}

// ----------------------------------------------------------------------------
// BUILD (everything static + data lists for live animation)
// ----------------------------------------------------------------------------

function build(w, h, dpr) {
  const s = clamp(Math.min(w / 1100, h / 760), 0.55, 1.45);
  const cs = clamp(Math.min(w / 1400, h / 900), 0.42, 1.4);
  const cx = w * 0.5;
  const gy = h * 0.655;
  const S = {
    w, h, dpr, s, cs, cx, gy,
    moon: { x: w * 0.79, y: h * 0.2, r: Math.max(26, 46 * s) },
    windows: [], torches: [], flags: [], banners: [], smokes: [], forges: [],
    lamps: [], sails: [], stars: [], signs: [], clouds: [], flies: [], trees: [], spr: {}
  };

  S.ry = (x) => h * 0.893 + Math.sin((x / w) * TAU * 0.8 + 0.9) * h * 0.012;
  S.rhw = h * 0.02;
  S.lane = (x) => S.ry(x) - h * 0.043;
  S.groundTop = (x) =>
    h * 0.752 -
    Math.exp(-Math.pow((x - w * 0.17) / (w * 0.1), 2)) * h * 0.038 -
    Math.exp(-Math.pow((x - w * 0.9) / (w * 0.1), 2)) * h * 0.02 +
    Math.sin((x / w) * 7 + 1) * h * 0.004;

  const roadW = (y) => lerp(26 * cs, 120 * s, Math.pow(clamp((y - gy) / (h - gy), 0, 1), 1.1));
  const P = [[cx, gy + 3 * cs], [cx - 0.17 * w, h * 0.775], [cx + 0.3 * w, h * 0.82], [cx + 0.05 * w, h * 1.05]];
  S.road = [];
  const N = 140;
  for (let i = 0; i <= N; i++) {
    const t = i / N, mt = 1 - t;
    const x = mt * mt * mt * P[0][0] + 3 * mt * mt * t * P[1][0] + 3 * mt * t * t * P[2][0] + t * t * t * P[3][0];
    const y = mt * mt * mt * P[0][1] + 3 * mt * mt * t * P[1][1] + 3 * mt * t * t * P[2][1] + t * t * t * P[3][1];
    S.road.push({ x, y, w: roadW(y) });
  }
  S.roadAt = (y) => {
    let best = S.road[0], bd = 1e9;
    for (const p of S.road) { const d = Math.abs(p.y - y); if (d < bd) { bd = d; best = p; } }
    return best;
  };
  let bi = 0, bdist = 1e9;
  S.road.forEach((p, i) => { const d = Math.abs(p.y - S.ry(p.x)); if (d < bdist) { bdist = d; bi = i; } });
  S.bridge = S.road[bi];

  const L = { far: layer(w, h, dpr), castle: layer(w, h, dpr), near: layer(w, h, dpr) };
  bakeFar(S, L.far.g);
  bakeCastle(S, L.castle.g);
  bakeNear(S, L.near.g);
  S.L = { far: L.far.cv, castle: L.castle.cv, near: L.near.cv };

  // sprites
  S.spr.warm = glowSprite('255,201,112');
  S.spr.amber = glowSprite('255,170,70');
  S.spr.fire = glowSprite('255,140,48');
  S.spr.violet = glowSprite('188,148,255');
  S.spr.cool = glowSprite('170,200,255');
  S.spr.green = glowSprite('200,255,170');
  S.spr.moon = makeMoon(S.moon.r, dpr);
  S.spr.fog = makeFog(w, Math.max(80, h * 0.16));
  S.spr.milky = sprite(w, h * 0.62, 1, (g) => {
    g.translate(w * 0.35, h * 0.2);
    g.rotate(0.42);
    g.save(); g.scale(1, 0.1);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.6);
    gr.addColorStop(0, 'rgba(140,150,210,.13)'); gr.addColorStop(1, 'rgba(140,150,210,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, w * 0.6, 0, TAU); g.fill(); g.restore();
    const r = rng(9);
    for (let i = 0; i < 420; i++) {
      const a = (r() - 0.5) * w, b = (r() + r() - 1) * h * 0.07;
      g.fillStyle = `rgba(210,215,240,${(0.08 + r() * 0.25).toFixed(2)})`;
      g.fillRect(a, b, 1.1, 1.1);
    }
  });

  // stars
  const sr = rng(1234);
  for (let i = 0; i < 200; i++) {
    const y = Math.pow(sr(), 1.4) * h * 0.58;
    S.stars.push({
      x: sr() * w, y, r: 0.4 + sr() * sr() * 1.5, ph: sr() * TAU, sp: 0.6 + sr() * 2.2,
      a: 0.35 + sr() * 0.6, big: sr() < 0.06,
      tone: sr() < 0.2 ? '255,226,190' : sr() < 0.45 ? '190,210,255' : '235,235,245'
    });
  }

  // clouds
  const cspec = [
    { y: 0.17, sc: 1.3, sp: 5, a: 0.9, seed: 3 }, { y: 0.27, sc: 1.9, sp: 3.2, a: 0.75, seed: 8 },
    { y: 0.11, sc: 0.9, sp: 7, a: 0.7, seed: 14 }, { y: 0.36, sc: 2.3, sp: 2.2, a: 0.5, seed: 19 },
    { y: 0.21, sc: 1.1, sp: 4.2, a: 0.8, seed: 25 }, { y: 0.45, sc: 2.6, sp: 1.6, a: 0.38, seed: 31 }
  ];
  for (const c of cspec) {
    const cw = 420 * c.sc * s * 0.8, ch = 140 * c.sc * s * 0.8;
    S.clouds.push({ spr: makeCloud(Math.round(420), 140, c.seed, 1), w: cw, h: ch, y: h * c.y - ch * 0.5, sp: c.sp, a: c.a, x0: hash(c.seed) * w });
  }

  // fireflies
  const fr = rng(66);
  for (let i = 0; i < 20; i++) {
    S.flies.push({ ax: fr() * w, ay: h * (0.8 + fr() * 0.18), ph: fr() * TAU, sp: 0.5 + fr() * 0.6, tone: fr() < 0.7 ? 'green' : 'warm' });
  }

  // swaying foreground pines on both edges
  const tr = rng(808);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const f = tr();
      const y = h * (0.905 + tr() * 0.1);
      const x = side < 0 ? w * (-0.01 + f * 0.13) : w * (0.88 + f * 0.13);
      const persp = lerp(1.0, 2.0, (y - h * 0.9) / (h * 0.11));
      S.trees.push({ x, y, sc: persp * s * (0.85 + tr() * 0.4), ph: tr() * TAU, col: tr() < 0.5 ? '#050a07' : '#070e0a' });
    }
  }
  S.trees.sort((a, b) => a.y - b.y);

  return S;
}

// ----------------------------------------------------------------------------
// LIVE DRAWING PIECES
// ----------------------------------------------------------------------------

function drawSky(c, S) {
  const { w, h, cx } = S;
  let g = c.createLinearGradient(0, 0, 0, h * 0.76);
  g.addColorStop(0, '#03060e'); g.addColorStop(0.28, '#080e20'); g.addColorStop(0.52, '#141a35');
  g.addColorStop(0.72, '#2f2742'); g.addColorStop(0.88, '#4b3441'); g.addColorStop(1, '#58393e');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  g = c.createRadialGradient(cx, h * 0.68, 10, cx, h * 0.68, h * 0.55);
  g.addColorStop(0, 'rgba(216,130,82,.32)'); g.addColorStop(1, 'rgba(216,130,82,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  g = c.createRadialGradient(S.moon.x, S.moon.y, 10, S.moon.x, S.moon.y, h * 0.6);
  g.addColorStop(0, 'rgba(90,110,180,.14)'); g.addColorStop(1, 'rgba(90,110,180,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.6;
  c.drawImage(S.spr.milky, 0, 0, w, h * 0.62);
  c.globalAlpha = 1;
}

function drawStars(c, S, T) {
  for (const st of S.stars) {
    const a = st.a * (0.6 + 0.4 * Math.sin(T * st.sp + st.ph));
    c.fillStyle = `rgba(${st.tone},${a.toFixed(3)})`;
    if (st.r < 0.9) c.fillRect(st.x, st.y, st.r * 1.6, st.r * 1.6);
    else { c.beginPath(); c.arc(st.x, st.y, st.r, 0, TAU); c.fill(); }
    if (st.big) {
      c.strokeStyle = `rgba(${st.tone},${(a * 0.5).toFixed(3)})`;
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(st.x - 5, st.y); c.lineTo(st.x + 5, st.y);
      c.moveTo(st.x, st.y - 5); c.lineTo(st.x, st.y + 5);
      c.stroke();
    }
  }
}

function drawBird(c, x, y, sz, ph) {
  const f = Math.sin(ph);
  c.beginPath();
  c.moveTo(x - sz, y - f * sz * 0.7);
  c.quadraticCurveTo(x - sz * 0.45, y - f * sz * 0.7 - sz * 0.38, x, y);
  c.quadraticCurveTo(x + sz * 0.45, y - f * sz * 0.7 - sz * 0.38, x + sz, y - f * sz * 0.7);
  c.stroke();
}

function drawBat(c, x, y, sz, ph) {
  const f = Math.sin(ph);
  c.beginPath(); c.ellipse(x, y, sz * 0.28, sz * 0.4, 0, 0, TAU); c.fill();
  for (const sd of [-1, 1]) {
    c.beginPath();
    c.moveTo(x, y - sz * 0.1);
    c.lineTo(x + sd * sz * 0.55, y - sz * (0.5 * f + 0.3));
    c.lineTo(x + sd * sz * 1.1, y - sz * (0.3 * f) + sz * 0.1);
    c.lineTo(x + sd * sz * 0.8, y + sz * 0.15 - sz * 0.1 * f);
    c.lineTo(x + sd * sz * 0.5, y + sz * 0.12);
    c.lineTo(x + sd * sz * 0.2, y + sz * 0.3);
    c.closePath(); c.fill();
  }
}

function drawSmoke(c, x, y, sc, T, seed, wind) {
  for (let i = 0; i < 6; i++) {
    const p = (T * 0.07 + i / 6 + seed * 0.37) % 1;
    const sx = x + (p * p * 18 + wind * 9 * p + Math.sin(T * 0.8 + i * 2 + seed) * 3 * p) * sc;
    const sy = y - p * 62 * sc;
    const a = (1 - p) * (p < 0.12 ? p / 0.12 : 1) * 0.2;
    c.globalAlpha = a;
    c.fillStyle = '#b0b2ba';
    c.beginPath(); c.arc(sx, sy, (3.2 + p * 9.5) * sc, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
}

function drawFlag(c, f, T, wind) {
  const { x, y, sc, col, seed } = f;
  c.strokeStyle = '#8a7a5c'; c.lineWidth = Math.max(1, 1.5 * sc);
  c.beginPath(); c.moveTo(x, y + 2 * sc); c.lineTo(x, y - 52 * sc); c.stroke();
  c.fillStyle = '#c9a85a'; c.beginPath(); c.arc(x, y - 53 * sc, 1.8 * sc, 0, TAU); c.fill();
  const segs = 9, len = 34 * sc, hh = 15 * sc;
  const amp = (2.6 + Math.abs(wind) * 2.6 + 1.5) * sc;
  const topPts = [], botPts = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const wave = Math.sin(T * 3.4 - u * 4.4 + seed * 2) * amp * u;
    const py = y - 50 * sc + wave + u * u * 2 * sc;
    topPts.push([x + u * len * (1 - 0.06 * Math.abs(wave) / sc * 0.2), py]);
    botPts.push([x + u * len * (1 - 0.06 * Math.abs(wave) / sc * 0.2), py + hh * (1 - u * 0.22)]);
  }
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(topPts[0][0], topPts[0][1]);
  for (let i = 1; i <= segs; i++) c.lineTo(topPts[i][0], topPts[i][1]);
  const mid = [(topPts[segs][0] + botPts[segs][0]) / 2 - 5 * sc, (topPts[segs][1] + botPts[segs][1]) / 2];
  c.lineTo(mid[0], mid[1]);
  c.lineTo(botPts[segs][0], botPts[segs][1]);
  for (let i = segs - 1; i >= 0; i--) c.lineTo(botPts[i][0], botPts[i][1]);
  c.closePath(); c.fill();
  for (let i = 0; i < segs; i++) {
    const shade = 0.5 + 0.5 * Math.sin(T * 3.4 - (i / segs) * 4.4 + seed * 2 + 1.2);
    c.fillStyle = `rgba(0,0,0,${(0.05 + shade * 0.22).toFixed(3)})`;
    c.beginPath();
    c.moveTo(topPts[i][0], topPts[i][1]); c.lineTo(topPts[i + 1][0], topPts[i + 1][1]);
    c.lineTo(botPts[i + 1][0], botPts[i + 1][1]); c.lineTo(botPts[i][0], botPts[i][1]);
    c.closePath(); c.fill();
  }
  c.fillStyle = '#d2b765';
  c.beginPath(); c.arc(x + len * 0.34, topPts[3][1] + hh * 0.46, 2 * sc, 0, TAU); c.fill();
}

function drawBanner(c, b, T) {
  const { x, y, len, wd, col, seed } = b;
  c.fillStyle = '#a58d4e'; c.fillRect(x - wd / 2 - 2, y - 2, wd + 4, 3);
  const segs = 7;
  const L = [], Rr = [];
  for (let i = 0; i <= segs; i++) {
    const v = i / segs;
    const off = Math.sin(T * 1.5 + v * 2.4 + seed) * 2.6 * v + Math.sin(T * 0.7 + seed) * 1.2 * v;
    const yy = y + v * len;
    L.push([x - wd / 2 + off, yy]); Rr.push([x + wd / 2 + off, yy]);
  }
  c.fillStyle = col;
  c.beginPath(); c.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i <= segs; i++) c.lineTo(L[i][0], L[i][1]);
  c.lineTo((L[segs][0] + Rr[segs][0]) / 2, L[segs][1] - wd * 0.45);
  c.lineTo(Rr[segs][0], Rr[segs][1]);
  for (let i = segs - 1; i >= 0; i--) c.lineTo(Rr[i][0], Rr[i][1]);
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(0,0,0,.22)';
  c.beginPath(); c.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i <= segs; i++) c.lineTo(L[i][0], L[i][1]);
  for (let i = segs; i >= 0; i--) c.lineTo(lerp(L[i][0], Rr[i][0], 0.4), L[i][1]);
  c.closePath(); c.fill();
  c.fillStyle = '#c9ab5b';
  const m = Math.floor(segs * 0.4);
  c.beginPath(); c.arc((L[m][0] + Rr[m][0]) / 2, L[m][1], wd * 0.14, 0, TAU); c.fill();
}

function drawTorch(c, S, tr, T) {
  const { x, y, sc, seed } = tr;
  const f = 0.85 + 0.1 * Math.sin(T * 9 + seed) + 0.07 * Math.sin(T * 15.7 + seed * 2.1) + 0.05 * Math.sin(T * 23 + seed * 3.3);
  if (tr.kind === 'orb') {
    const p = 0.7 + 0.3 * Math.sin(T * 1.6);
    c.save(); c.globalCompositeOperation = 'lighter';
    const r1 = 40 * sc * p;
    c.globalAlpha = 0.9; c.drawImage(S.spr.violet, x - r1, y - r1, r1 * 2, r1 * 2);
    c.globalAlpha = 0.5; const r2 = 120 * sc * p; c.drawImage(S.spr.violet, x - r2, y - r2, r2 * 2, r2 * 2);
    c.restore();
    c.fillStyle = '#e7d3ff'; c.beginPath(); c.arc(x, y, 3.2 * sc, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(214,190,255,.5)'; c.lineWidth = Math.max(0.8, sc * 0.8);
    c.beginPath(); c.ellipse(x, y, 9 * sc, 3 * sc, T * 0.8, 0, TAU); c.stroke();
    c.beginPath(); c.ellipse(x, y, 9 * sc, 3 * sc, -T * 0.6 + 1, 0, TAU); c.stroke();
    return;
  }
  if (!tr.far) {
    c.fillStyle = '#2b1d16'; c.fillRect(x - 1.6 * sc, y - 2 * sc, 3.2 * sc, 13 * sc);
    c.fillStyle = '#17110e'; c.fillRect(x - 3 * sc, y + 1 * sc, 6 * sc, 2 * sc);
  }
  c.save(); c.globalCompositeOperation = 'lighter';
  c.globalAlpha = clamp(0.75 * f, 0, 1);
  const gr = (tr.far ? 30 : 38) * sc * f;
  c.drawImage(S.spr.fire, x - gr, y - 9 * sc - gr, gr * 2, gr * 2);
  c.restore();
  const sw = Math.sin(T * 6 + seed) * 1.7 * sc;
  const hgt = (tr.far ? 22 : 17) * sc * f;
  const layers = [[1, '#ff7f26'], [0.68, '#ffbf4a'], [0.36, '#fff1a8']];
  for (const [k, col] of layers) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x, y - 2 * sc);
    c.bezierCurveTo(x - 7 * sc * k, y - 5 * sc, x - 3.5 * sc * k + sw * 0.4, y - hgt * 0.55 * k, x + sw * k, y - 2 * sc - hgt * k);
    c.bezierCurveTo(x + 3.5 * sc * k + sw * 0.4, y - hgt * 0.55 * k, x + 7 * sc * k, y - 5 * sc, x, y - 2 * sc);
    c.fill();
  }
  if (!tr.far) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const p = (T * 0.8 + seed * 0.3 + k / 3) % 1;
      c.globalAlpha = (1 - p) * 0.8;
      c.fillStyle = '#ffb04a';
      c.fillRect(x + Math.sin(T * 3 + k * 2 + seed) * 6 * sc * p, y - 14 * sc - p * 30 * sc, 1.4 * sc, 1.4 * sc);
    }
    c.restore();
  }
}

function drawBonfire(c, S, T) {
  const { x, y, sc } = S.bonfire;
  const f = 0.85 + 0.12 * Math.sin(T * 8) + 0.08 * Math.sin(T * 13.1 + 1) + 0.06 * Math.sin(T * 21.3);
  c.save(); c.globalCompositeOperation = 'lighter';
  c.globalAlpha = clamp(0.55 * f, 0, 1);
  const r1 = 120 * sc * f;
  c.save(); c.translate(x, y); c.scale(1, 0.55);
  c.drawImage(S.spr.fire, -r1, -r1, r1 * 2, r1 * 2);
  c.restore();
  c.globalAlpha = clamp(0.8 * f, 0, 1);
  const r2 = 40 * sc * f;
  c.drawImage(S.spr.fire, x - r2, y - 14 * sc - r2, r2 * 2, r2 * 2);
  c.restore();
  const layers = [[1, '#ff6a1e', 30], [0.72, '#ff9d2e', 26], [0.45, '#ffd25a', 20], [0.22, '#fff3b0', 13]];
  for (let n = 0; n < 3; n++) {
    const ox = (n - 1) * 6 * sc, hh = (n === 1 ? 1 : 0.7) * f;
    for (const [k, col, H] of layers) {
      const sw = Math.sin(T * 5 + n * 2 + k) * 2.4 * sc;
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(x + ox, y - 3 * sc);
      c.bezierCurveTo(x + ox - 8 * sc * k, y - 6 * sc, x + ox - 4 * sc * k + sw * 0.4, y - H * 0.5 * sc * hh * k, x + ox + sw * k, y - 3 * sc - H * sc * hh * k);
      c.bezierCurveTo(x + ox + 4 * sc * k + sw * 0.4, y - H * 0.5 * sc * hh * k, x + ox + 8 * sc * k, y - 6 * sc, x + ox, y - 3 * sc);
      c.fill();
    }
  }
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 14; k++) {
    const p = (T * 0.55 + k * 0.071 + hash(k) * 0.5) % 1;
    c.globalAlpha = (1 - p) * 0.9;
    c.fillStyle = k % 3 === 0 ? '#ffe08a' : '#ff9a3a';
    const ex = x + (hash(k * 3.1) - 0.5) * 22 * sc + Math.sin(T * 1.6 + k) * 10 * sc * p;
    c.fillRect(ex, y - 20 * sc - p * 70 * sc, 1.6 * sc, 1.6 * sc);
  }
  c.restore();
}

function drawHorse(c, ph, col, trot) {
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
  const bob = Math.sin(ph * 2) * 1.1 * trot;
  c.lineWidth = 2.8;
  const legs = [[-12, 0], [10, Math.PI * 0.5], [-8, Math.PI], [13, Math.PI * 1.5]];
  for (const [lx, po] of legs) {
    const a = Math.sin(ph + po) * 0.62 * trot;
    const hx = lx, hy = -17 + bob;
    const kx = hx + Math.sin(a) * 5.5, ky = hy + 8.5;
    const fx = kx + Math.sin(a - 0.45) * 5.5;
    const fy = Math.min(0, ky + 8.5 - Math.max(0, Math.cos(a + 1)) * 3.5 * trot);
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
  }
  c.beginPath(); c.ellipse(0, -22 + bob, 17, 7.5, 0, 0, TAU); c.fill();
  c.beginPath();
  c.moveTo(10, -26 + bob); c.lineTo(19, -41 + bob); c.lineTo(24, -40 + bob); c.lineTo(31, -33 + bob);
  c.lineTo(29.5, -30 + bob); c.lineTo(24, -33 + bob); c.lineTo(19, -21 + bob); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(20, -41 + bob); c.lineTo(20.5, -45.5 + bob); c.lineTo(23, -41 + bob); c.fill();
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(-16, -25 + bob);
  c.quadraticCurveTo(-25, -22 + Math.sin(ph * 1.5) * 3, -27, -11 + Math.sin(ph * 1.5 + 1) * 3); c.stroke();
}

function drawCart(c, S, T, x, y, sc, dir, dist) {
  c.save();
  c.translate(x, y);
  c.scale(dir * sc, sc);
  drawHorse(c, dist * 0.2 / sc, '#14100e', 1);
  c.strokeStyle = '#1c1411'; c.lineWidth = 1.8;
  c.beginPath(); c.moveTo(-8, -22); c.lineTo(-32, -19); c.stroke();
  // wagon body
  c.fillStyle = '#2b1d16'; c.fillRect(-80, -34, 50, 20);
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-80, -28); c.lineTo(-30, -28); c.moveTo(-80, -21); c.lineTo(-30, -21); c.stroke();
  c.fillStyle = 'rgba(190,205,245,.12)'; c.fillRect(-32, -34, 2, 20);
  // canopy
  c.fillStyle = '#5f5039';
  c.beginPath(); c.ellipse(-55, -34, 26, 19, 0, Math.PI, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1;
  for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(-55 + k * 10, -34); c.quadraticCurveTo(-55 + k * 8, -50, -55 + k * 3, -53); c.stroke(); }
  c.strokeStyle = 'rgba(190,205,245,.2)'; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(-55, -34, 26, 19, 0, Math.PI * 1.45, Math.PI * 1.95); c.stroke();
  // driver
  c.fillStyle = '#0e0b0a';
  c.beginPath(); c.ellipse(-34, -41, 3.6, 6, 0, 0, TAU); c.fill();
  c.beginPath(); c.arc(-34, -50, 3.2, 0, TAU); c.fill();
  // wheels
  const ang = dist / (10 * sc);
  for (const wx of [-68, -42]) {
    c.strokeStyle = '#150f0c'; c.lineWidth = 2.6;
    c.beginPath(); c.arc(wx, -10, 10, 0, TAU); c.stroke();
    c.lineWidth = 1.1;
    for (let k = 0; k < 8; k++) {
      const a = ang + (k * TAU) / 8;
      c.beginPath(); c.moveTo(wx, -10); c.lineTo(wx + Math.cos(a) * 9, -10 + Math.sin(a) * 9); c.stroke();
    }
  }
  const sw = Math.sin(T * 3.1) * 2;
  c.strokeStyle = '#2a1d16'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(-30, -34); c.lineTo(-24, -38); c.lineTo(-24 + sw, -33); c.stroke();
  c.fillStyle = '#e8b25a'; c.fillRect(-26 + sw, -33, 4, 5);
  c.restore();
  c.save(); c.globalCompositeOperation = 'lighter';
  const lx = x + dir * sc * (-24 + sw), ly = y - 30.5 * sc;
  const r = 34 * sc * (0.9 + 0.1 * Math.sin(T * 9));
  c.globalAlpha = 0.85; c.drawImage(S.spr.warm, lx - r, ly - r, r * 2, r * 2);
  c.restore();
}

function drawRider(c, S, T, x, y, sc, dir, dist, alpha) {
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  c.scale(dir * sc, sc);
  drawHorse(c, dist * 0.2 / sc, '#120d0c', 1.1);
  const wave = Math.sin(T * 9) * 2.2;
  c.fillStyle = '#2a0d13';
  c.beginPath(); c.moveTo(-2, -40); c.quadraticCurveTo(-14, -36 + wave, -22, -24 + wave * 1.5); c.lineTo(-6, -27); c.closePath(); c.fill();
  c.fillStyle = '#17110f';
  c.beginPath(); c.moveTo(-3, -27); c.lineTo(-1, -44); c.lineTo(5, -44); c.lineTo(6, -27); c.closePath(); c.fill();
  c.beginPath(); c.arc(2.5, -48, 3.6, 0, TAU); c.fill();
  c.fillStyle = '#2b2d36'; c.beginPath(); c.arc(2.5, -49, 3.9, Math.PI, TAU); c.fill();
  c.strokeStyle = '#17110f'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(4, -42); c.lineTo(11, -50); c.stroke();
  c.strokeStyle = '#4a3020'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(11, -50); c.lineTo(11.6, -57); c.stroke();
  c.restore();
  const fx = x + dir * sc * 11.8, fy = y - 58 * sc;
  const f = 0.9 + 0.1 * Math.sin(T * 14);
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha * 0.85;
  const r = 30 * sc * f; c.drawImage(S.spr.fire, fx - r, fy - r, r * 2, r * 2);
  c.restore();
  c.globalAlpha = alpha;
  c.fillStyle = '#ffb347';
  c.beginPath(); c.moveTo(fx, fy + 1 * sc); c.quadraticCurveTo(fx - 3 * sc, fy - 3 * sc, fx, fy - 9 * sc * f); c.quadraticCurveTo(fx + 3 * sc, fy - 3 * sc, fx, fy + 1 * sc); c.fill();
  c.globalAlpha = 1;
}

function drawGuard(c, S, T, idx) {
  const [a, b] = S.guardRange[idx];
  const cyc = T / 55 + idx * 0.37;
  const p = ease(clamp((tri(cyc) - 0.08) / 0.84, 0, 1));
  const prev = ease(clamp((tri(cyc - 0.01) - 0.08) / 0.84, 0, 1));
  const dir = p >= prev ? 1 : -1;
  const x = lerp(a, b, p), y = S.guardY, sc = S.cs;
  const moving = Math.abs(p - prev) > 0.0001;
  const step = moving ? Math.sin(T * 5 + idx) * 2 * sc : 0;
  c.fillStyle = '#0a0b0f'; c.strokeStyle = '#0a0b0f'; c.lineWidth = 1.7 * sc;
  c.beginPath(); c.moveTo(x - 1.2 * sc, y - 7 * sc); c.lineTo(x - 1.2 * sc + step, y); c.moveTo(x + 1.2 * sc, y - 7 * sc); c.lineTo(x + 1.2 * sc - step, y); c.stroke();
  c.fillRect(x - 2.6 * sc, y - 15 * sc, 5.2 * sc, 9 * sc);
  c.beginPath(); c.arc(x, y - 17.5 * sc, 2.5 * sc, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(x + dir * 2 * sc, y - 13 * sc); c.lineTo(x + dir * 6 * sc, y - 9 * sc); c.stroke();
  const lx = x + dir * 6.5 * sc, ly = y - 8 * sc + Math.sin(T * 3 + idx) * 0.6 * sc;
  c.fillStyle = '#ffd37a'; c.fillRect(lx - 1.4 * sc, ly - 1.4 * sc, 2.8 * sc, 3.2 * sc);
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.8;
  const r = 24 * sc; c.drawImage(S.spr.warm, lx - r, ly - r, r * 2, r * 2);
  c.restore();
}

function lanternGlow(c, S, x, y, sc, T, seed, a = 0.8) {
  const f = 0.9 + 0.07 * Math.sin(T * 8 + seed) + 0.04 * Math.sin(T * 14 + seed * 2);
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = clamp(a * f, 0, 1);
  const r = 30 * sc * f;
  c.drawImage(S.spr.warm, x - r, y - r, r * 2, r * 2);
  c.restore();
}

// ----------------------------------------------------------------------------
// STATE / EVENTS
// ----------------------------------------------------------------------------

function makeData(S, key) {
  const br = rng(404);
  const bats = [];
  for (let i = 0; i < 4; i++) bats.push({ ph: br() * TAU, sp: 0.25 + br() * 0.25, cx: 0.25 + br() * 0.5, cy: 0.4 + br() * 0.1, sz: 4 + br() * 2 });
  return {
    S, key, clock: 0, wind: 0,
    gate: { open: 0 },
    cart: null, rider: null, flock: null, shoot: null, proc: null, flockCount: 0,
    timers: { cart: 6, rider: 17, flock: 10, shoot: 3.5, proc: 28 },
    bats
  };
}

function updateEvents(D, dts) {
  const { S } = D;
  const { w, h, s } = S;
  const tm = D.timers;
  for (const k of Object.keys(tm)) tm[k] -= dts;

  // cart on the river lane
  if (!D.cart && tm.cart <= 0) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    D.cart = { x: dir > 0 ? -140 * s : w + 140 * s, dir, dist: 0, speed: (34 + Math.random() * 10) * s };
    tm.cart = 40 + Math.random() * 35;
  }
  if (D.cart) {
    const cr = D.cart;
    cr.x += cr.dir * cr.speed * dts; cr.dist += cr.speed * dts;
    if ((cr.dir > 0 && cr.x > w + 160 * s) || (cr.dir < 0 && cr.x < -160 * s)) D.cart = null;
  }

  // rider through the castle gate (down the hill, or home again)
  if (!D.rider && tm.rider <= 0) {
    const out = Math.random() < 0.55;
    D.rider = out ? { out: true, state: 'wait', k: 0, dist: 0, open: true } : { out: false, state: 'run', k: S.road.length - 1, dist: 0, open: false };
    tm.rider = 55 + Math.random() * 40;
  }
  if (D.rider) {
    const r = D.rider, sp = 3.6 * dts;
    if (r.out) {
      if (r.state === 'wait' && D.gate.open > 0.9) r.state = 'run';
      if (r.state === 'run') {
        r.k += sp; r.dist += sp * 9;
        if (r.k > 12) r.open = false;
        if (r.k >= S.road.length + 6) D.rider = null;
      }
    } else {
      if (r.state === 'run') {
        r.k -= sp; r.dist += sp * 9;
        if (r.k < 22) r.open = true;
        if (r.k <= 0.5) { r.state = 'done'; r.hold = 2.8; }
      } else if (r.state === 'done') {
        r.hold -= dts;
        if (r.hold <= 0) D.rider = null;
      }
    }
  }
  D.gate.open += ((D.rider && D.rider.open ? 1 : 0) - D.gate.open) * Math.min(1, dts * 1.1);

  // flocks
  if (!D.flock && tm.flock <= 0) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const moonPass = D.flockCount % 2 === 0;
    D.flockCount++;
    D.flock = {
      dir, x: dir > 0 ? -60 : w + 60, speed: (moonPass ? 52 : 70) * s * (0.9 + Math.random() * 0.3),
      y: moonPass ? S.moon.y + (Math.random() - 0.5) * S.moon.r * 1.1 : h * (0.4 + Math.random() * 0.08),
      n: moonPass ? 8 : 2, sz: (moonPass ? 6.5 : 5) * s, ph: Math.random() * TAU
    };
    tm.flock = 38 + Math.random() * 40;
  }
  if (D.flock) {
    const f = D.flock;
    f.x += f.dir * f.speed * dts;
    if ((f.dir > 0 && f.x > w + 200) || (f.dir < 0 && f.x < -200)) D.flock = null;
  }

  // shooting star
  if (!D.shoot && tm.shoot <= 0) {
    const sx = w * (0.1 + Math.random() * 0.6), sy = h * (0.03 + Math.random() * 0.2);
    const ang = 0.35 + Math.random() * 0.35;
    D.shoot = { x: sx, y: sy, vx: Math.cos(ang) * 620 * s, vy: Math.sin(ang) * 620 * s, life: 0, dur: 0.9 };
    tm.shoot = 14 + Math.random() * 26;
  }
  if (D.shoot) { D.shoot.life += dts; D.shoot.x += D.shoot.vx * dts; D.shoot.y += D.shoot.vy * dts; if (D.shoot.life > D.shoot.dur) D.shoot = null; }

  // far procession
  if (!D.proc && tm.proc <= 0) {
    D.proc = { d: 0, dir: Math.random() < 0.5 ? 1 : -1, n: 9 };
    tm.proc = 70 + Math.random() * 50;
  }
  if (D.proc) {
    D.proc.d += 24 * s * dts;
    const total = (S.proc.length - 1) * 8;
    if (D.proc.d > total + D.proc.n * 16 * s + 10) D.proc = null;
  }
}

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

function render(c, S, D, T, dts) {
  const { w, h, s, cs, cx, gy } = S;
  const wind = D.wind;

  drawSky(c, S);
  drawStars(c, S, T);

  // shooting star
  if (D.shoot) {
    const sh = D.shoot, p = sh.life / sh.dur;
    const a = Math.sin(p * Math.PI);
    const len = 120 * s;
    const mag = Math.hypot(sh.vx, sh.vy);
    const gx = c.createLinearGradient(sh.x, sh.y, sh.x - (sh.vx / mag) * len, sh.y - (sh.vy / mag) * len);
    gx.addColorStop(0, `rgba(255,250,235,${(0.9 * a).toFixed(3)})`); gx.addColorStop(1, 'rgba(255,250,235,0)');
    c.strokeStyle = gx; c.lineWidth = 1.6 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sh.x, sh.y); c.lineTo(sh.x - (sh.vx / mag) * len, sh.y - (sh.vy / mag) * len); c.stroke();
    c.lineCap = 'butt';
  }

  // moon
  const mr = S.moon.r * 5.2;
  c.drawImage(S.spr.moon, S.moon.x - mr, S.moon.y - mr, mr * 2, mr * 2);

  // clouds
  for (const cl of S.clouds) {
    const span = w + cl.w * 2;
    const x = ((cl.x0 + T * cl.sp * s * (1 + wind * 0.25)) % span + span) % span - cl.w;
    c.globalAlpha = cl.a;
    c.drawImage(cl.spr, x, cl.y, cl.w, cl.h);
  }
  c.globalAlpha = 1;

  // flock of birds
  if (D.flock) {
    const f = D.flock;
    c.strokeStyle = 'rgba(5,7,14,.88)'; c.lineWidth = Math.max(1.1, 1.5 * s * 0.8); c.lineCap = 'round';
    for (let i = 0; i < f.n; i++) {
      const k = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
      const bx = f.x - f.dir * k * 17 * s * (i ? 1 : 0);
      const by = f.y + (i ? side * k * 9 * s : 0) + Math.sin(T * 1.3 + i * 1.7) * 2 * s;
      drawBird(c, bx, by, f.sz * (0.85 + hash(i) * 0.3), T * 7 + i * 0.9 + f.ph);
    }
    c.lineCap = 'butt';
  }

  // far mountains
  c.drawImage(S.L.far, 0, 0, w, h);

  // far lights: watchtower window and hill beacon are in torches/windows lists; procession here
  if (D.proc) {
    const p = D.proc, total = (S.proc.length - 1) * 8;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < p.n; i++) {
      const dd = p.d - i * 16 * s;
      if (dd < 0 || dd > total) continue;
      const u = p.dir > 0 ? dd : total - dd;
      const idx = clamp(u / 8, 0, S.proc.length - 1);
      const i0 = Math.floor(idx), i1 = Math.min(S.proc.length - 1, i0 + 1);
      const px = lerp(S.proc[i0][0], S.proc[i1][0], idx - i0);
      const py = lerp(S.proc[i0][1], S.proc[i1][1], idx - i0);
      const fl = 0.8 + 0.2 * Math.sin(T * 10 + i * 2);
      const r = 9 * s * fl;
      c.globalAlpha = 0.85; c.drawImage(S.spr.fire, px - r, py - r, r * 2, r * 2);
      c.globalAlpha = 1; c.fillStyle = '#ffe2a0'; c.fillRect(px - 0.8 * s, py - 1.2 * s, 1.6 * s, 2.4 * s);
    }
    c.restore();
  }
  for (const tr of S.torches) if (tr.far) drawTorch(c, S, tr, T);

  // mist between mountains and castle
  drawFog(c, S, T, 0.665, 0.4, 1.8, 1.2);

  // castle
  c.drawImage(S.L.castle, 0, 0, w, h);

  // castle live details
  drawGateLive(c, S, D.gate.open, T);
  drawWindows(c, S, T);
  for (const tr of S.torches) if (!tr.far) drawTorch(c, S, tr, T);
  for (const b of S.banners) drawBanner(c, b, T);
  for (const f of S.flags) drawFlag(c, f, T, wind);
  for (const sm of S.smokes) { if (!sm.village) drawSmoke(c, sm.x, sm.y, sm.sc, T, sm.seed, wind); }
  drawGuard(c, S, T, 0);
  drawGuard(c, S, T, 1);

  // bats circling
  c.fillStyle = 'rgba(6,8,13,.85)';
  for (const b of D.bats) {
    const bx = w * b.cx + Math.sin(T * b.sp + b.ph) * w * 0.28 + Math.sin(T * 1.9 + b.ph * 2) * 18 * s;
    const by = h * b.cy + Math.sin(T * b.sp * 1.7 + b.ph * 3) * h * 0.06 + Math.sin(T * 4.3 + b.ph) * 6 * s;
    drawBat(c, bx, by, b.sz * s, T * 17 + b.ph);
  }

  // village
  c.drawImage(S.L.near, 0, 0, w, h);
  drawFog(c, S, T, 0.742, 0.5, 2.1, 1.0);

  // village live details: lights, smoke, sails, forge, bonfire, signs
  drawWindows(c, S, T, true);
  for (const lp of S.lamps) lanternGlow(c, S, lp.x, lp.y - 35 * lp.sc, lp.sc * 0.9, T, lp.x * 0.1, lp.tavern ? 0.9 : 0.75);
  for (const sm of S.smokes) { if (sm.village) drawSmoke(c, sm.x, sm.y, sm.sc, T, sm.seed, wind); }
  for (const f of S.forges) {
    const fl = 0.85 + 0.12 * Math.sin(T * 9 + f.x) + 0.08 * Math.sin(T * 17 + f.x);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.9 * fl; const r = 34 * f.sc * fl; c.drawImage(S.spr.fire, f.x - r, f.y - r, r * 2, r * 2);
    for (let k = 0; k < 5; k++) {
      const p = (T * 1.3 + k * 0.2 + f.x) % 1;
      c.globalAlpha = (1 - p); c.fillStyle = '#ffb347';
      c.fillRect(f.x + (hash(k + f.x) - 0.5) * 16 * f.sc * p, f.y - p * 26 * f.sc + p * p * 16 * f.sc, 1.5 * f.sc, 1.5 * f.sc);
    }
    c.restore();
    c.fillStyle = '#ff9a32'; c.fillRect(f.x - 6 * f.sc, f.y - 3 * f.sc, 12 * f.sc, 6 * f.sc * fl);
  }
  for (const sl of S.sails) {
    const ang = T * 0.35;
    for (let k = 0; k < 4; k++) {
      c.save(); c.translate(sl.x, sl.y); c.rotate(ang + (k * Math.PI) / 2);
      c.fillStyle = '#120e0c'; c.fillRect(0, -1.1 * sl.sc, sl.len, 2.2 * sl.sc);
      c.fillStyle = 'rgba(66,58,56,.62)'; c.fillRect(sl.len * 0.16, 1.1 * sl.sc, sl.len * 0.84, 9 * sl.sc);
      c.strokeStyle = '#17120f'; c.lineWidth = Math.max(0.8, 0.9 * sl.sc);
      c.strokeRect(sl.len * 0.16, 1.1 * sl.sc, sl.len * 0.84, 9 * sl.sc);
      c.beginPath();
      for (let q = 1; q < 6; q++) { const qx = sl.len * (0.16 + 0.84 * q / 6); c.moveTo(qx, 1.1 * sl.sc); c.lineTo(qx, 10.1 * sl.sc); }
      c.stroke();
      c.restore();
    }
    c.fillStyle = '#0d0a09'; c.beginPath(); c.arc(sl.x, sl.y, 3 * sl.sc, 0, TAU); c.fill();
  }
  for (const sg of S.signs) {
    const sw = Math.sin(T * 1.7 + sg.x) * 0.12;
    c.save(); c.translate(sg.x, sg.y); c.rotate(sw);
    c.strokeStyle = '#17110e'; c.lineWidth = 1 * sg.sc; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 4 * sg.sc); c.stroke();
    c.fillStyle = '#4a3320'; c.fillRect(-5 * sg.sc, 4 * sg.sc, 10 * sg.sc, 8 * sg.sc);
    c.fillStyle = '#a58d4e'; c.beginPath(); c.arc(0, 8 * sg.sc, 2.2 * sg.sc, 0, TAU); c.fill();
    c.restore();
  }
  drawBonfire(c, S, T);

  // river shimmer & moon road
  drawRiver(c, S, T);

  // fireflies
  for (const fl of S.flies) {
    const x = fl.ax + Math.sin(T * 0.5 * fl.sp + fl.ph) * 42 * s + Math.sin(T * 1.3 + fl.ph * 2) * 12 * s;
    const y = fl.ay + Math.cos(T * 0.4 * fl.sp + fl.ph * 1.7) * 18 * s;
    const pulse = Math.pow(Math.max(0, Math.sin(T * 1.1 + fl.ph * 5)), 2);
    if (pulse < 0.02) continue;
    const r = 11 * s * (0.6 + pulse * 0.6);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = pulse * 0.9;
    c.drawImage(fl.tone === 'green' ? S.spr.green : S.spr.warm, x - r, y - r, r * 2, r * 2);
    c.fillStyle = '#f4ffd0'; c.globalAlpha = pulse; c.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
    c.restore();
  }

  // cart on the lane
  if (D.cart) {
    const cr = D.cart;
    drawCart(c, S, T, cr.x, S.lane(clamp(cr.x, 0, w)) + 7 * s, 0.8 * s, cr.dir, cr.dist);
  }

  // rider on the road
  if (D.rider && D.rider.state !== 'wait' && D.rider.state !== 'done') {
    const r = D.rider;
    const idx = clamp(r.k, 0, S.road.length - 1.001);
    const i0 = Math.floor(idx), i1 = i0 + 1;
    const p0 = S.road[i0], p1 = S.road[i1];
    const px = lerp(p0.x, p1.x, idx - i0), py = lerp(p0.y, p1.y, idx - i0);
    const dx = p1.x - p0.x;
    const dirH = Math.abs(dx) < 0.05 ? (r.dirH || 1) : Math.sign(dx) * (r.out ? 1 : -1);
    r.dirH = dirH;
    const sc = lerp(0.24, 1.05, clamp((py - gy) / (h - gy), 0, 1)) * s;
    const fade = r.out ? clamp(r.k / 4, 0, 1) : clamp((r.k - 0.5) / 4, 0, 1);
    drawRider(c, S, T, px, py, sc, dirH, r.dist, fade);
  }

  // swaying foreground pines
  for (const tr of S.trees) {
    const sway = (Math.sin(T * 0.7 + tr.ph) * 0.45 + wind * 0.45) * 0.6;
    pineSway(c, tr.x, tr.y, tr.sc, tr.col, sway);
  }

  // low fog layers in front
  drawFog(c, S, T, 0.835, 0.34, 1.6, 0.9);
  drawFog(c, S, T, 0.935, 0.3, 1.3, 1.1);

  // vignette & ground darkening
  let g = c.createRadialGradient(w * 0.5, h * 0.55, h * 0.25, w * 0.5, h * 0.55, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,6,.5)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  g = c.createLinearGradient(0, h * 0.84, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,4,.32)');
  c.fillStyle = g; c.fillRect(0, h * 0.84, w, h * 0.16);
}

function drawFog(c, S, T, yFrac, alpha, hScale, speedMul) {
  const { w, h, s } = S;
  const dh = Math.max(80, h * 0.16) * hScale;
  const off = (T * 7 * s * speedMul) % w;
  c.globalAlpha = alpha;
  c.drawImage(S.spr.fog, off - w, h * yFrac - dh * 0.5, w, dh);
  c.drawImage(S.spr.fog, off, h * yFrac - dh * 0.5, w, dh);
  c.globalAlpha = 1;
}

function drawGateLive(c, S, open, T) {
  const { x: cx, y: gy, aw, ah } = S.gate;
  const s = S.cs;
  c.save();
  archPath(c, cx, gy - ah / 2, aw, ah);
  c.clip();
  if (open > 0.02) {
    const g = c.createLinearGradient(0, gy - ah, 0, gy);
    g.addColorStop(0, `rgba(214,140,62,${(0.7 * open).toFixed(3)})`);
    g.addColorStop(1, `rgba(255,214,130,${(0.95 * open).toFixed(3)})`);
    c.fillStyle = g; c.fillRect(cx - aw / 2, gy - ah, aw, ah);
    c.fillStyle = `rgba(20,10,6,${(0.55 * open).toFixed(3)})`;
    for (const px of [-0.26, 0.05, 0.3]) {
      c.beginPath(); c.ellipse(cx + px * aw, gy - 7 * s, 2.4 * s, 6.5 * s, 0, 0, TAU); c.fill();
      c.beginPath(); c.arc(cx + px * aw, gy - 15 * s, 2 * s, 0, TAU); c.fill();
    }
  }
  const lw = (aw / 2) * (1 - open * 0.93);
  for (const sd of [-1, 1]) {
    const x0 = sd < 0 ? cx - aw / 2 : cx + aw / 2 - lw;
    const gr = c.createLinearGradient(x0, 0, x0 + lw, 0);
    gr.addColorStop(0, sd < 0 ? '#2b1b12' : '#3d271a'); gr.addColorStop(1, sd < 0 ? '#3a2519' : '#4a3020');
    c.fillStyle = gr; c.fillRect(x0, gy - ah, lw, ah);
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = Math.max(0.8, s);
    c.beginPath();
    for (let k = 1; k < 4; k++) { const px = x0 + (lw * k) / 4; c.moveTo(px, gy - ah); c.lineTo(px, gy); }
    c.stroke();
    c.fillStyle = '#15151a';
    for (const by of [0.22, 0.5, 0.78]) c.fillRect(x0, gy - ah * by - 1.1 * s, lw, 2.2 * s);
  }
  c.restore();
  if (open > 0.02) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.5 * open;
    const r = 90 * s;
    c.save(); c.translate(cx, gy + 2 * s); c.scale(1, 0.4);
    c.drawImage(S.spr.warm, -r, -r, r * 2, r * 2);
    c.restore();
    c.restore();
  }
}

function drawWindows(c, S, T, villageOnly) {
  const list = S.windows;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const wn of list) {
    if (villageOnly ? !wn.village : wn.village) continue;
    const L = wn.on ? 1 : clamp(0.95 + 1.1 * Math.sin(T * 0.045 + wn.seed * 40), 0, 1);
    wn.L = L;
    wn.f = 1 + 0.07 * Math.sin(T * 6.5 + wn.seed * 30) + 0.05 * Math.sin(T * 11.7 + wn.seed * 9);
    if (L < 0.03) continue;
    const spr = wn.kind === 'violet' ? S.spr.violet : wn.kind === 'amber' ? S.spr.amber : S.spr.warm;
    const rad = Math.max(wn.w, wn.h) * (wn.far ? 2.5 : 3.2);
    c.globalAlpha = clamp(0.55 * L * wn.f, 0, 1);
    c.drawImage(spr, wn.x - rad, wn.y - rad, rad * 2, rad * 2);
  }
  c.restore();
  for (const wn of list) {
    if (villageOnly ? !wn.village : wn.village) continue;
    if (!wn.L || wn.L < 0.03) continue;
    c.globalAlpha = clamp(wn.L * 0.95 * wn.f, 0, 1);
    c.fillStyle = wn.kind === 'violet' ? '#d2b2ff' : wn.kind === 'amber' ? '#ffb85c' : '#ffd98c';
    if (wn.arch) archPath(c, wn.x, wn.y, wn.w, wn.h); else { c.beginPath(); c.rect(wn.x - wn.w / 2, wn.y - wn.h / 2, wn.w, wn.h); }
    c.fill();
    if (wn.w > 3) {
      c.strokeStyle = 'rgba(28,18,10,.7)'; c.lineWidth = Math.max(0.6, wn.w * 0.1);
      c.beginPath();
      c.moveTo(wn.x, wn.y - wn.h / 2); c.lineTo(wn.x, wn.y + wn.h / 2);
      c.moveTo(wn.x - wn.w / 2, wn.y - wn.h * 0.08); c.lineTo(wn.x + wn.w / 2, wn.y - wn.h * 0.08);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
}

function drawRiver(c, S, T) {
  const { w, h, s, moon } = S;
  const hw = S.rhw;
  c.save();
  c.globalCompositeOperation = 'lighter';
  // moon column
  for (let k = 0; k < 11; k++) {
    const u = k / 10;
    const y = S.ry(moon.x) - hw * 0.85 + u * hw * 1.7;
    const wd = (22 - Math.abs(u - 0.5) * 18 + Math.sin(T * 1.4 + k * 1.3) * 7) * s;
    const x = moon.x + Math.sin(T * 0.9 + k * 1.9) * 7 * s;
    c.globalAlpha = 0.22 + 0.18 * Math.sin(T * 2 + k);
    c.fillStyle = '#dfe6ff';
    c.fillRect(x - wd / 2, y, wd, Math.max(1, 1.3 * s));
  }
  // ripples drifting with the current
  for (let i = 0; i < 34; i++) {
    const x = ((hash(i * 3.7) * w + T * (5 + hash(i) * 6) * s) % (w + 80)) - 40;
    const y = S.ry(x) + (hash(i * 9.1) - 0.5) * hw * 1.6;
    const wd = (8 + hash(i * 5.3) * 24) * s;
    c.globalAlpha = 0.07 + 0.1 * hash(i * 2.2) * (0.6 + 0.4 * Math.sin(T * 1.7 + i));
    c.fillStyle = '#b7c8ee';
    c.fillRect(x, y, wd, Math.max(0.8, s));
  }
  // lamp reflections at the bridge
  const b = S.bridge;
  for (const sx of [-1, 1]) {
    const lx = b.x + sx * (b.w * 0.5);
    c.globalAlpha = 0.3;
    const r = 22 * s;
    c.save(); c.translate(lx, S.ry(b.x) + hw * 0.5); c.scale(0.5, 1.2);
    c.drawImage(S.spr.warm, -r, -r, r * 2, r * 2); c.restore();
  }
  c.restore();
}

// ----------------------------------------------------------------------------
// MODULE API
// ----------------------------------------------------------------------------

export default {
  init(w, h) {
    return { initialized: true, w, h };
  },

  draw(ctx, state, t, dt, mood, w, h) {
    const holder = state || (this._fallback || (this._fallback = {}));
    const dpr = Math.min(1.5, (ctx.getTransform ? ctx.getTransform().a : 1) || 1);
    const key = `${Math.round(w)}x${Math.round(h)}@${dpr}`;

    let D = holder.__kingdom;
    if (!D || D.key !== key) {
      const S = build(w, h, dpr);
      const old = D;
      D = makeData(S, key);
      if (old) { D.clock = old.clock; }
      holder.__kingdom = D;
    }

    let dts = dt > 0.5 ? dt / 1000 : dt;
    dts = clamp(dts || 0, 0, 0.1);
    D.clock += dts;
    D.wind = Math.sin(D.clock * 0.23) * 0.5 + Math.sin(D.clock * 0.11 + 1) * 0.5;

    updateEvents(D, dts);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    render(ctx, D.S, D, D.clock, dts);
    ctx.restore();
  }
};
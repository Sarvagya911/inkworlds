// Canvas drawing helpers shared by the world scenes.
import { R } from '../../lib/utils.js';

export function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function sprite(rgb) {
  const c = mk(128, 128),
    g = c.getContext('2d'),
    gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.4, `rgba(${rgb},.45)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export function glow(c, spr, x, y, r, a) {
  if (a <= 0 || r <= 0) return;
  c.globalAlpha = Math.min(1, a);
  c.drawImage(spr, x - r, y - r, r * 2, r * 2);
  c.globalAlpha = 1;
}

export function makeFog(n, w, h, y0, y1) {
  return Array.from({ length: n }, () => ({
    x: R(-w * 0.2, w),
    y: R(y0, y1),
    rx: R(w * 0.25, w * 0.6),
    ry: R(h * 0.08, h * 0.2),
    v: R(5, 15) * (Math.random() < 0.5 ? -1 : 1),
    a: R(0.08, 0.18)
  }));
}

export function drawFog(c, spr, fog, dt, w, mul) {
  for (const f of fog) {
    f.x += f.v * dt;
    if (f.x - f.rx > w) f.x = -f.rx;
    if (f.x + f.rx < 0) f.x = w + f.rx;
    c.globalAlpha = Math.min(1, f.a * mul);
    c.drawImage(spr, f.x - f.rx, f.y - f.ry, f.rx * 2, f.ry * 2);
  }
  c.globalAlpha = 1;
}

export function inkTrail(w, h) {
  let x = R(w * 0.05, w * 0.95),
    y = R(h * 0.08, h * 0.92),
    a = R(0, 6.283),
    loop = -1;
  const pts = [],
    N = Math.floor(R(140, 260)),
    step = Math.max(1.6, Math.min(3.4, Math.min(w, h) / 220));
  for (let i = 0; i < N; i++) {
    if (loop < 0 && Math.random() < 0.012) loop = Math.floor(R(22, 34));
    let da = (Math.random() - 0.5) * 0.28 + Math.sin(i * 0.045) * 0.025;
    if (loop > 0) {
      da = 0.26;
      loop--;
    }
    a += da;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push([x, y]);
  }
  return { pts, head: 0, speed: R(45, 90), fade: 1, lw: R(0.9, 1.8) };
}

export function bat(c, x, y, s, f) {
  c.save();
  c.translate(x, y);
  c.beginPath();
  c.moveTo(0, -s * 0.15);
  c.quadraticCurveTo(-s * 0.6, -s * (0.2 + 0.7 * f), -s * 1.5, -s * 0.25 * f);
  c.quadraticCurveTo(-s, s * 0.05, -s * 0.9, s * 0.25);
  c.quadraticCurveTo(-s * 0.45, s * 0.05, 0, s * 0.3);
  c.quadraticCurveTo(s * 0.45, s * 0.05, s * 0.9, s * 0.25);
  c.quadraticCurveTo(s, s * 0.05, s * 1.5, -s * 0.25 * f);
  c.quadraticCurveTo(s * 0.6, -s * (0.2 + 0.7 * f), 0, -s * 0.15);
  c.fill();
  c.restore();
}

export function pine(g, x, base, ht, wd) {
  for (let i = 0; i < 3; i++) {
    const top = base - ht * (0.45 + i * 0.27),
      bot = base - ht * (i * 0.27),
      hw = (wd * (1 - i * 0.25)) / 2;
    g.beginPath();
    g.moveTo(x, top - ht * 0.08);
    g.lineTo(x + hw, bot);
    g.lineTo(x - hw, bot);
    g.closePath();
    g.fill();
  }
  g.fillRect(x - wd * 0.05, base - ht * 0.08, wd * 0.1, ht * 0.1);
}

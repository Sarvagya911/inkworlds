import { mk, sprite, glow, pine } from '../draw-utils.js';
import { R, clamp } from '../../../lib/utils.js';

// "forest" world: init() pre-renders static layers, draw() animates one frame.
export default {
  init(w, h) {
    const bg = mk(w, h),
      g = bg.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0a1422');
    gr.addColorStop(0.5, '#10241c');
    gr.addColorStop(1, '#08130d');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const mg = g.createRadialGradient(w * 0.18, h * 0.14, 0, w * 0.18, h * 0.14, Math.min(w, h) * 0.5);
    mg.addColorStop(0, 'rgba(215,230,255,.28)');
    mg.addColorStop(1, 'rgba(215,230,255,0)');
    g.fillStyle = mg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9eef7';
    g.beginPath();
    g.arc(w * 0.18, h * 0.14, Math.max(8, Math.min(w, h) * 0.04), 0, 6.283);
    g.fill();
    const sc = Math.min(1, w / 900) + 0.3;
    const layers = [
      ['#16301f', h * 0.72, [0.22, 0.36], 70],
      ['#0d1d14', h * 0.86, [0.3, 0.5], 95],
      ['#050c08', h * 1.03, [0.42, 0.66], 150]
    ];
    for (const [col, base, [a, b], gap] of layers) {
      g.fillStyle = col;
      for (let x = -40; x < w + 60; x += R(gap * 0.6, gap * 1.2) * sc) {
        const ht = R(h * a, h * b);
        pine(g, x, base, ht, ht * R(0.35, 0.5));
      }
      g.fillRect(0, base - 2, w, h - base + 2);
    }
    return {
      bg,
      sc,
      flies: Array.from({ length: 40 }, () => ({
        x: R(0, w),
        y: R(h * 0.3, h * 0.95),
        vx: R(-15, 15),
        vy: R(-10, 10),
        p: R(0, 6),
        sp: R(1, 2.6)
      })),
      leaves: [],
      next: 2,
      fs: sprite('210,255,120')
    };
  },
  draw(c, s, t, dt, m, w, h) {
    c.drawImage(s.bg, 0, 0, w, h);
    for (const f of s.flies) {
      f.vx = clamp(f.vx + R(-1, 1) * dt * 40, -22, 22);
      f.vy = clamp(f.vy + R(-1, 1) * dt * 40, -16, 16);
      f.x += f.vx * dt * s.sc;
      f.y += f.vy * dt * s.sc;
      if (f.x < 0) f.x = w;
      if (f.x > w) f.x = 0;
      if (f.y < h * 0.25) f.vy = Math.abs(f.vy);
      if (f.y > h) f.vy = -Math.abs(f.vy);
      const a = Math.pow(Math.max(0, Math.sin(t * f.sp + f.p)), 2) * (1 - m.warm * 0.5);
      glow(c, s.fs, f.x, f.y, 12 * s.sc, a * 0.8);
      c.fillStyle = `rgba(240,255,190,${a})`;
      c.fillRect(f.x - 1, f.y - 1, 2, 2);
    }
    if (t > s.next) {
      s.leaves.push({
        x: R(0, w),
        y: -10,
        vx: R(-20, 20),
        vy: R(25, 50) * s.sc,
        rot: R(0, 6),
        vr: R(-2, 2),
        sz: R(4, 8) * s.sc
      });
      s.next = t + R(0.8, 2.5);
    }
    for (let i = s.leaves.length - 1; i >= 0; i--) {
      const l = s.leaves[i];
      l.x += l.vx * dt + Math.sin(t + l.rot) * 0.4;
      l.y += l.vy * dt;
      l.rot += l.vr * dt;
      if (l.y > h + 10) {
        s.leaves.splice(i, 1);
        continue;
      }
      c.save();
      c.translate(l.x, l.y);
      c.rotate(l.rot);
      c.fillStyle = 'rgba(92,120,58,.8)';
      c.beginPath();
      c.ellipse(0, 0, l.sz, l.sz * 0.45, 0, 0, 6.283);
      c.fill();
      c.restore();
    }
  }
};

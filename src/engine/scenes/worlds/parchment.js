import { mk, sprite, glow, inkTrail } from '../draw-utils.js';
import { R } from '../../../lib/utils.js';

// "parchment" world: init() pre-renders static layers, draw() animates one frame.
export default {
  init(w, h) {
    const bg = mk(w, h),
      g = bg.getContext('2d');
    const gr = g.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.5, Math.hypot(w, h) * 0.6);
    gr.addColorStop(0, '#f3e6c6');
    gr.addColorStop(0.55, '#e4cf9f');
    gr.addColorStop(1, '#9c7443');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const x = R(0, w),
        y = R(0, h),
        r = R(40, 240),
        s = g.createRadialGradient(x, y, 0, x, y, r);
      s.addColorStop(0, 'rgba(125,85,35,.12)');
      s.addColorStop(1, 'rgba(125,85,35,0)');
      g.fillStyle = s;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const n = Math.min(9000, Math.floor((w * h) / 160));
    for (let i = 0; i < n; i++) {
      g.fillStyle =
        Math.random() < 0.55 ? `rgba(90,60,25,${R(0.03, 0.1)})` : `rgba(255,248,225,${R(0.04, 0.12)})`;
      g.fillRect(R(0, w), R(0, h), R(0.6, 1.8), R(0.6, 1.8));
    }
    g.lineWidth = 0.6;
    g.strokeStyle = 'rgba(110,80,40,.07)';
    for (let i = 0; i < 160; i++) {
      const x = R(0, w),
        y = R(0, h);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + R(-30, 30), y + R(-12, 12), x + R(-70, 70), y + R(-24, 24));
      g.stroke();
    }
    return {
      bg,
      trails: [inkTrail(w, h)],
      blots: [],
      next: 1,
      nextBlot: 3,
      flame: sprite('255,170,80'),
      mote: sprite('255,225,150'),
      motes: Array.from({ length: Math.min(60, Math.floor((w * h) / 12000) + 10) }, () => ({
        x: R(0, w),
        y: R(0, h),
        v: R(4, 14),
        r: R(0.6, 1.8),
        p: R(0, 6.28)
      }))
    };
  },
  draw(c, s, t, dt, m, w, h) {
    c.drawImage(s.bg, 0, 0, w, h);
    if (t > s.next && s.trails.length < 6) {
      s.trails.push(inkTrail(w, h));
      s.next = t + R(1.2, 3.5);
    }
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (let i = s.trails.length - 1; i >= 0; i--) {
      const tr = s.trails[i];
      if (tr.head < tr.pts.length) tr.head = Math.min(tr.pts.length, tr.head + dt * tr.speed);
      else tr.fade -= dt * 0.12;
      if (tr.fade <= 0) {
        s.trails.splice(i, 1);
        continue;
      }
      const n = Math.floor(tr.head);
      if (n < 2) continue;
      c.strokeStyle = `rgba(52,30,12,${0.32 * tr.fade})`;
      c.lineWidth = tr.lw;
      c.beginPath();
      c.moveTo(tr.pts[0][0], tr.pts[0][1]);
      for (let k = 1; k < n; k++) c.lineTo(tr.pts[k][0], tr.pts[k][1]);
      c.stroke();
      if (tr.head < tr.pts.length) {
        const p = tr.pts[n - 1];
        c.fillStyle = 'rgba(40,22,8,.5)';
        c.beginPath();
        c.arc(p[0], p[1], tr.lw * 1.3, 0, 6.283);
        c.fill();
      }
    }
    if (t > s.nextBlot) {
      s.blots.push({ x: R(w * 0.05, w * 0.95), y: R(h * 0.05, h * 0.95), r: 0, max: R(4, 13), age: 0 });
      s.nextBlot = t + R(4, 9);
    }
    for (let i = s.blots.length - 1; i >= 0; i--) {
      const b = s.blots[i];
      b.age += dt;
      b.r = b.max * Math.min(1, b.age / 1.4);
      const a = b.age < 8 ? 0.22 : 0.22 * (1 - (b.age - 8) / 5);
      if (a <= 0) {
        s.blots.splice(i, 1);
        continue;
      }
      c.fillStyle = `rgba(45,25,10,${a})`;
      c.beginPath();
      c.arc(b.x, b.y, b.r, 0, 6.283);
      c.fill();
    }
    const fl = 0.78 + 0.1 * Math.sin(t * 8.3) + 0.06 * Math.sin(t * 21.1 + 1.3) + R(-0.03, 0.03),
      rr = Math.min(w, h) * 0.7,
      dim = 1 - m.dark * 0.5;
    glow(c, s.flame, w * 0.04, h * 1.02, rr * fl, 0.38 * fl * dim);
    glow(c, s.flame, w * 0.97, h * 0.98, rr * 0.8 * fl, 0.3 * fl * dim);
    for (const p of s.motes) {
      p.y -= p.v * dt;
      p.x += Math.sin(t * 0.6 + p.p) * 0.25;
      if (p.y < -5) {
        p.y = h + 5;
        p.x = R(0, w);
      }
      glow(c, s.mote, p.x, p.y, p.r * 4, (0.35 + 0.3 * Math.sin(t * 1.7 + p.p)) * 0.6);
    }
  }
};

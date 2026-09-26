import { mk, sprite, glow, makeFog, drawFog, bat } from '../draw-utils.js';
import { R } from '../../../lib/utils.js';

// "gothic" world: init() pre-renders static layers, draw() animates one frame.
export default {
  init(w, h) {
    const bg = mk(w, h),
      g = bg.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#070a18');
    gr.addColorStop(0.55, '#141a36');
    gr.addColorStop(0.85, '#2a1830');
    gr.addColorStop(1, '#3a121c');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < Math.floor((w * h) / 2600); i++) {
      g.fillStyle = `rgba(230,230,255,${R(0.15, 0.7)})`;
      const r = R(0.3, 1.1);
      g.fillRect(R(0, w), R(0, h * 0.7), r, r);
    }
    const mx = w * 0.76,
      my = h * 0.2,
      mr = Math.max(14, Math.min(w, h) * 0.075);
    const hg = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 5);
    hg.addColorStop(0, 'rgba(220,215,190,.35)');
    hg.addColorStop(1, 'rgba(220,215,190,0)');
    g.fillStyle = hg;
    g.fillRect(0, 0, w, h);
    const md = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    md.addColorStop(0, '#fbf8ea');
    md.addColorStop(1, '#d9d3b8');
    g.fillStyle = md;
    g.beginPath();
    g.arc(mx, my, mr, 0, 6.283);
    g.fill();
    g.fillStyle = 'rgba(150,140,110,.25)';
    for (let i = 0; i < 7; i++) {
      const a = R(0, 6.28),
        d = R(0, mr * 0.7);
      g.beginPath();
      g.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, R(mr * 0.06, mr * 0.18), 0, 6.283);
      g.fill();
    }
    const castle = mk(w, h),
      k = castle.getContext('2d');
    k.fillStyle = '#05060c';
    k.beginPath();
    k.moveTo(0, h);
    k.lineTo(0, h * 0.86);
    for (let x = 0; x <= w + w / 12; x += w / 12)
      k.lineTo(x, h * 0.84 + Math.sin(x * 0.004 + 1) * h * 0.03 + R(-h * 0.01, h * 0.01));
    k.lineTo(w, h);
    k.closePath();
    k.fill();
    const base = h * 0.84,
      W = Math.min(w * 0.55, 560),
      x0 = w * 0.08,
      windows = [];
    k.fillRect(x0, base - h * 0.12, W, h * 0.13);
    for (let i = 0; i < 6; i++) {
      const tw = R(W * 0.07, W * 0.13),
        tx = x0 + (i + 0.5) * (W / 6) - tw / 2 + R(-W * 0.02, W * 0.02),
        th = R(h * 0.18, h * 0.36);
      k.fillRect(tx, base - th, tw, th);
      if (Math.random() < 0.65) {
        k.beginPath();
        k.moveTo(tx - tw * 0.12, base - th);
        k.lineTo(tx + tw / 2, base - th - tw * R(1.2, 2));
        k.lineTo(tx + tw * 1.12, base - th);
        k.closePath();
        k.fill();
      } else
        for (let q = 0; q < 4; q++) k.fillRect(tx + (q * tw) / 4, base - th - tw * 0.2, tw / 8, tw * 0.2);
      const nw = Math.floor(R(1, 3));
      for (let j = 0; j < nw; j++)
        windows.push({
          x: tx + tw * R(0.3, 0.55),
          y: base - th * R(0.35, 0.8),
          w: Math.max(2, tw * 0.14),
          h: Math.max(4, tw * 0.26),
          p: R(0, 6.28),
          on: Math.random() < 0.7
        });
    }
    return {
      bg,
      castle,
      windows,
      fog: makeFog(7, w, h, h * 0.6, h * 0.98),
      fogFar: makeFog(4, w, h, h * 0.45, h * 0.75),
      bats: [],
      nextBat: 1,
      fs: sprite('150,160,185'),
      win: sprite('255,170,70'),
      sc: Math.min(1, Math.min(w, h) / 600) + 0.3
    };
  },
  draw(c, s, t, dt, m, w, h) {
    c.drawImage(s.bg, 0, 0, w, h);
    drawFog(c, s.fs, s.fogFar, dt, w, 0.7);
    c.drawImage(s.castle, 0, 0, w, h);
    for (const wi of s.windows) {
      if (!wi.on) continue;
      const f = 0.75 + 0.25 * Math.sin(t * 3 + wi.p) + R(-0.05, 0.05);
      c.fillStyle = `rgba(255,180,80,${0.85 * f * (1 - m.dark * 0.4)})`;
      c.fillRect(wi.x, wi.y, wi.w, wi.h);
      glow(c, s.win, wi.x + wi.w / 2, wi.y + wi.h / 2, wi.h * 2.4, 0.35 * f);
    }
    if (t > s.nextBat) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      s.bats.push({
        x: dir > 0 ? -30 : w + 30,
        y: R(h * 0.1, h * 0.5),
        vx: dir * R(70, 130) * s.sc,
        p: R(0, 6),
        sz: R(6, 13) * s.sc
      });
      s.nextBat = t + R(1.5, 5) * (1 - m.dark * 0.5);
    }
    c.fillStyle = '#04050a';
    for (let i = s.bats.length - 1; i >= 0; i--) {
      const b = s.bats[i];
      b.x += b.vx * dt;
      if (b.x < -60 || b.x > w + 60) {
        s.bats.splice(i, 1);
        continue;
      }
      bat(c, b.x, b.y + Math.sin(t * 2.2 + b.p) * 14 * s.sc, b.sz, Math.sin(t * 16 + b.p));
    }
    drawFog(c, s.fs, s.fog, dt, w, 1 + m.dark * 0.4);
  }
};

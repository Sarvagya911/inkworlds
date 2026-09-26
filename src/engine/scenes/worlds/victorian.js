import { mk, sprite, glow, makeFog, drawFog } from '../draw-utils.js';
import { R } from '../../../lib/utils.js';

// "victorian" world: init() pre-renders static layers, draw() animates one frame.
export default {
  init(w, h) {
    const bg = mk(w, h),
      g = bg.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1c1b19');
    gr.addColorStop(0.6, '#3a362d');
    gr.addColorStop(1, '#4a4336');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const sky = mk(w, h),
      k = sky.getContext('2d'),
      base = h * 0.9,
      lamps = [],
      sc = Math.min(1, w / 900) + 0.25;
    k.fillStyle = '#17150f';
    let x = -20;
    while (x < w) {
      const bw = R(60, 150) * sc,
        bh = R(h * 0.2, h * 0.46);
      k.fillRect(x, base - bh, bw, bh);
      const ch = Math.floor(R(1, 4));
      for (let i = 0; i < ch; i++)
        k.fillRect(x + R(4, Math.max(5, bw - 10)), base - bh - R(8, 22) * sc, R(5, 11) * sc, 30 * sc);
      for (let i = 0; i < 4; i++)
        if (Math.random() < 0.35) {
          k.fillStyle = 'rgba(230,170,80,.35)';
          k.fillRect(
            x + R(4, Math.max(5, bw - 12)),
            base - bh + R(10, Math.max(12, bh - 30)),
            6 * sc,
            10 * sc
          );
          k.fillStyle = '#17150f';
        }
      x += bw + R(-4, 6);
    }
    k.fillStyle = '#0e0d0a';
    k.fillRect(0, base, w, h - base);
    const n = Math.max(2, Math.round(w / 380));
    for (let i = 0; i < n; i++) {
      const lx = ((i + 0.5) * w) / n,
        ph = h * 0.22;
      k.fillStyle = '#0b0a08';
      k.fillRect(lx - 2, base - ph, 4, ph);
      k.beginPath();
      k.moveTo(lx - 10 * sc, base - ph);
      k.lineTo(lx + 10 * sc, base - ph);
      k.lineTo(lx + 6 * sc, base - ph - 16 * sc);
      k.lineTo(lx - 6 * sc, base - ph - 16 * sc);
      k.closePath();
      k.fill();
      lamps.push({ x: lx, y: base - ph - 8 * sc, p: R(0, 6) });
    }
    return {
      bg,
      sky,
      lamps,
      fog: makeFog(9, w, h, h * 0.35, h * 0.95),
      fs: sprite('190,180,150'),
      lg: sprite('255,190,110'),
      sc
    };
  },
  draw(c, s, t, dt, m, w, h) {
    c.drawImage(s.bg, 0, 0, w, h);
    c.drawImage(s.sky, 0, 0, w, h);
    for (const l of s.lamps) {
      const f = 0.85 + 0.08 * Math.sin(t * 7 + l.p) + R(-0.04, 0.04);
      glow(c, s.lg, l.x, l.y, h * 0.2 * f, 0.5 * f * (1 - m.dark * 0.3));
      glow(c, s.lg, l.x, l.y, 14 * s.sc, 0.95);
    }
    drawFog(c, s.fs, s.fog, dt, w, 1.15 + m.dark * 0.3);
  }
};

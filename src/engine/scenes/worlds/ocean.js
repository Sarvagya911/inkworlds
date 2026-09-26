import { mk } from '../draw-utils.js';
import { R } from '../../../lib/utils.js';

// "ocean" world: init() pre-renders static layers, draw() animates one frame.
export default {
  init(w, h) {
    const bg = mk(w, h),
      g = bg.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0f6078');
    gr.addColorStop(0.45, '#083a52');
    gr.addColorStop(1, '#021520');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const sc = Math.min(1, w / 900) + 0.3;
    return {
      bg,
      sc,
      rays: Array.from({ length: 6 }, () => ({
        x: R(0, w),
        w: R(30, 100) * sc,
        p: R(0, 6),
        sp: R(0.12, 0.3)
      })),
      bubbles: Array.from({ length: 45 }, () => ({
        x: R(0, w),
        y: R(0, h),
        r: R(1.5, 5) * sc,
        v: R(20, 60) * sc,
        p: R(0, 6)
      })),
      motes: Array.from({ length: 70 }, () => ({ x: R(0, w), y: R(0, h), v: R(2, 8), p: R(0, 6) })),
      kelp: Array.from({ length: Math.max(4, Math.round(w / 90)) }, () => ({
        x: R(0, w),
        h: R(h * 0.15, h * 0.42),
        p: R(0, 6),
        lw: R(4, 9) * sc
      }))
    };
  },
  draw(c, s, t, dt, m, w, h) {
    c.drawImage(s.bg, 0, 0, w, h);
    c.globalCompositeOperation = 'lighter';
    for (const r of s.rays) {
      const off = Math.sin(t * r.sp + r.p) * 90 * s.sc,
        lg = c.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, `rgba(170,235,255,${0.13 * (1 - m.dark * 0.6)})`);
      lg.addColorStop(1, 'rgba(170,235,255,0)');
      c.fillStyle = lg;
      c.beginPath();
      c.moveTo(r.x - r.w / 2, 0);
      c.lineTo(r.x + r.w / 2, 0);
      c.lineTo(r.x + r.w * 1.6 + off, h);
      c.lineTo(r.x - r.w * 1.6 + off, h);
      c.closePath();
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    for (const p of s.motes) {
      p.y -= p.v * dt;
      p.x += Math.sin(t * 0.5 + p.p) * 0.2;
      if (p.y < 0) {
        p.y = h;
        p.x = R(0, w);
      }
      c.fillStyle = 'rgba(200,240,240,.25)';
      c.fillRect(p.x, p.y, 1.2, 1.2);
    }
    c.strokeStyle = 'rgba(3,38,32,.92)';
    c.lineCap = 'round';
    for (const k of s.kelp) {
      c.lineWidth = k.lw;
      c.beginPath();
      c.moveTo(k.x, h + 4);
      for (let i = 1; i <= 10; i++) {
        c.lineTo(k.x + Math.sin(t * 0.8 + k.p + i * 0.45) * i * 2.2 * s.sc, h - (k.h * i) / 10);
      }
      c.stroke();
    }
    for (const b of s.bubbles) {
      b.y -= b.v * dt;
      if (b.y < -10) {
        b.y = h + 10;
        b.x = R(0, w);
      }
      const bx = b.x + Math.sin(t * 2 + b.p) * 4;
      c.strokeStyle = 'rgba(210,245,255,.5)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(bx, b.y, b.r, 0, 6.283);
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.fillRect(bx - b.r * 0.4, b.y - b.r * 0.5, 1.2, 1.2);
    }
  }
};

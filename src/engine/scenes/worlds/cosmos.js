import { mk } from '../draw-utils.js';
import { R } from '../../../lib/utils.js';

// "cosmos" world: init() pre-renders static layers, draw() animates one frame.
export default {
  init(w, h) {
    const bg = mk(w, h),
      g = bg.getContext('2d');
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#04050d');
    gr.addColorStop(0.5, '#0b0f2a');
    gr.addColorStop(1, '#120a26');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    const cols = ['120,70,190', '30,140,160', '190,60,140', '70,90,200'];
    for (let i = 0; i < 7; i++) {
      const x = R(0, w),
        y = R(0, h),
        r = R(Math.min(w, h) * 0.25, Math.max(w, h) * 0.5),
        col = cols[i % 4],
        ng = g.createRadialGradient(x, y, 0, x, y, r);
      ng.addColorStop(0, `rgba(${col},.22)`);
      ng.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = ng;
      g.fillRect(0, 0, w, h);
    }
    g.globalCompositeOperation = 'source-over';
    const px = w * 0.86,
      py = h * 0.82,
      pr = Math.min(w, h) * 0.16;
    const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, '#4a61a8');
    pg.addColorStop(1, '#10173a');
    g.strokeStyle = 'rgba(180,200,255,.28)';
    g.lineWidth = pr * 0.08;
    g.save();
    g.translate(px, py);
    g.rotate(-0.35);
    g.beginPath();
    g.ellipse(0, 0, pr * 1.7, pr * 0.4, 0, Math.PI, 2 * Math.PI);
    g.stroke();
    g.restore();
    g.fillStyle = pg;
    g.beginPath();
    g.arc(px, py, pr, 0, 6.283);
    g.fill();
    g.save();
    g.translate(px, py);
    g.rotate(-0.35);
    g.beginPath();
    g.ellipse(0, 0, pr * 1.7, pr * 0.4, 0, 0, Math.PI);
    g.stroke();
    g.restore();
    return {
      bg,
      stars: Array.from({ length: Math.min(320, Math.floor((w * h) / 4500) + 20) }, () => ({
        x: R(0, w),
        y: R(0, h),
        z: R(0.2, 1),
        r: R(0.5, 1.6),
        p: R(0, 6.28)
      })),
      shoot: []
    };
  },
  draw(c, s, t, dt, m, w, h) {
    c.drawImage(s.bg, 0, 0, w, h);
    for (const st of s.stars) {
      st.x -= st.z * 8 * dt;
      if (st.x < 0) st.x = w;
      c.fillStyle = `rgba(225,235,255,${0.35 + 0.5 * st.z * (0.6 + 0.4 * Math.sin(t * 2 + st.p))})`;
      c.fillRect(st.x, st.y, st.r * st.z + 0.4, st.r * st.z + 0.4);
    }
    if (Math.random() < dt * 0.15)
      s.shoot.push({
        x: R(w * 0.3, w * 1.1),
        y: R(0, h * 0.4),
        vx: -R(500, 800) * Math.min(1, w / 900 + 0.3),
        vy: R(150, 300) * Math.min(1, w / 900 + 0.3),
        life: 1
      });
    for (let i = s.shoot.length - 1; i >= 0; i--) {
      const sh = s.shoot[i];
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.life -= dt * 1.2;
      if (sh.life <= 0) {
        s.shoot.splice(i, 1);
        continue;
      }
      const lg = c.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 0.12, sh.y - sh.vy * 0.12);
      lg.addColorStop(0, `rgba(255,255,255,${sh.life})`);
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      c.strokeStyle = lg;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(sh.x, sh.y);
      c.lineTo(sh.x - sh.vx * 0.12, sh.y - sh.vy * 0.12);
      c.stroke();
    }
  }
};

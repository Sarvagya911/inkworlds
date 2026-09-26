import { R } from '../../../lib/utils.js';

// "whimsical" world: init() pre-renders static layers, draw() animates one frame.
export default {
  init(w, h) {
    const sc = Math.min(1, w / 900) + 0.35;
    return {
      sc,
      items: Array.from({ length: 16 }, () => ({
        type: Math.random() < 0.6 ? 'card' : 'clock',
        x: R(0, w),
        y: R(0, h),
        vy: R(8, 22),
        rot: R(0, 6),
        vr: R(-0.3, 0.3),
        sz: R(22, 46) * sc,
        suit: '♠♥♣♦'[Math.floor(R(0, 4))]
      })),
      sparks: Array.from({ length: 40 }, () => ({ x: R(0, w), y: R(0, h), p: R(0, 6), s: R(2, 5) }))
    };
  },
  draw(c, s, t, dt, m, w, h) {
    const hu = (t * 4) % 360,
      lg = c.createLinearGradient(0, 0, w, h);
    lg.addColorStop(0, `hsl(${hu + 260},70%,88%)`);
    lg.addColorStop(0.5, `hsl(${hu + 160},60%,86%)`);
    lg.addColorStop(1, `hsl(${hu + 20},80%,88%)`);
    c.fillStyle = lg;
    c.fillRect(0, 0, w, h);
    for (const sp of s.sparks) {
      const a = Math.max(0, Math.sin(t * 1.5 + sp.p));
      c.fillStyle = `rgba(255,255,255,${a * 0.9})`;
      c.beginPath();
      c.moveTo(sp.x, sp.y - sp.s);
      c.lineTo(sp.x + sp.s * 0.3, sp.y);
      c.lineTo(sp.x, sp.y + sp.s);
      c.lineTo(sp.x - sp.s * 0.3, sp.y);
      c.closePath();
      c.fill();
      c.fillRect(sp.x - sp.s, sp.y - 0.4, sp.s * 2, 0.8);
    }
    for (const it of s.items) {
      it.y -= it.vy * dt * s.sc;
      it.rot += it.vr * dt;
      if (it.y < -60) {
        it.y = h + 60;
        it.x = R(0, w);
      }
      c.save();
      c.translate(it.x, it.y);
      c.rotate(it.rot);
      const z = it.sz;
      if (it.type === 'card') {
        c.fillStyle = 'rgba(255,255,255,.9)';
        c.strokeStyle = 'rgba(60,40,80,.35)';
        c.lineWidth = 1;
        c.beginPath();
        if (c.roundRect) c.roundRect(-z * 0.36, -z * 0.5, z * 0.72, z, z * 0.08);
        else c.rect(-z * 0.36, -z * 0.5, z * 0.72, z);
        c.fill();
        c.stroke();
        c.fillStyle = it.suit === '♥' || it.suit === '♦' ? '#c0335a' : '#2e2440';
        c.font = `${z * 0.45}px Georgia, serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(it.suit, 0, 0);
      } else {
        c.fillStyle = '#fff7e0';
        c.strokeStyle = '#b8913a';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, z * 0.45, 0, 6.283);
        c.fill();
        c.stroke();
        c.strokeStyle = '#6b5020';
        c.lineWidth = 1;
        for (let q = 0; q < 12; q++) {
          const a = (q * Math.PI) / 6;
          c.beginPath();
          c.moveTo(Math.cos(a) * z * 0.36, Math.sin(a) * z * 0.36);
          c.lineTo(Math.cos(a) * z * 0.41, Math.sin(a) * z * 0.41);
          c.stroke();
        }
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(Math.cos(t * 0.9) * z * 0.3, Math.sin(t * 0.9) * z * 0.3);
        c.stroke();
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(Math.cos(t * 0.08) * z * 0.2, Math.sin(t * 0.08) * z * 0.2);
        c.stroke();
      }
      c.restore();
    }
  }
};

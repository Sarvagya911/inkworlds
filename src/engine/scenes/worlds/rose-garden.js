// Velvet Twilight Conservatory / Rose Glass Garden
// Procedural interactive romance world for Inkworlds.

const TAU = Math.PI * 2;

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// Pre-render static conservatory architecture to offscreen canvas for high FPS
function getOffscreen(state, key, w, h) {
  if (!state.canvases) state.canvases = {};
  let c = state.canvases[key];
  if (!c || c.width !== w || c.height !== h) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    state.canvases[key] = c;
    return { canvas: c, ctx: c.getContext('2d'), fresh: true };
  }
  return { canvas: c, ctx: c.getContext('2d'), fresh: false };
}

function renderArchitecture(c, w, h) {
  // Conservatory vaulted glass arches & wrought-iron framework
  c.clearRect(0, 0, w, h);

  const cx = w * 0.5;
  const archTop = h * 0.08;
  const archBottom = h * 0.95;

  c.save();

  // Glass panel reflections (subtle translucent ribs)
  c.strokeStyle = 'rgba(230, 185, 205, 0.07)';
  c.lineWidth = 1.5;
  const ribs = 12;
  for (let i = 0; i <= ribs; i++) {
    const rx = (w * i) / ribs;
    c.beginPath();
    c.moveTo(rx, 0);
    c.quadraticCurveTo(cx, h * 0.28, rx * 0.6 + cx * 0.4, archBottom);
    c.stroke();
  }

  // Horizontal structural rings
  const rings = 6;
  for (let i = 1; i <= rings; i++) {
    const ry = (h * i * 0.15);
    c.beginPath();
    c.ellipse(cx, ry, w * 0.48 * (1 - (i * 0.1)), h * 0.08, 0, 0, TAU);
    c.stroke();
  }

  // Main Gothic / Victorian arched iron ribs
  c.strokeStyle = 'rgba(28, 16, 26, 0.88)';
  c.lineWidth = Math.max(2.5, w * 0.0035);

  // Central Grand Arch
  c.beginPath();
  c.moveTo(w * 0.1, archBottom);
  c.bezierCurveTo(w * 0.15, archTop * 2.5, cx - w * 0.15, archTop, cx, archTop * 0.6);
  c.bezierCurveTo(cx + w * 0.15, archTop, w * 0.85, archTop * 2.5, w * 0.9, archBottom);
  c.stroke();

  // Outer secondary arches
  c.lineWidth = Math.max(1.5, w * 0.002);
  c.beginPath();
  c.moveTo(-w * 0.05, archBottom);
  c.bezierCurveTo(w * 0.05, h * 0.2, cx * 0.5, archTop * 1.8, cx, archTop * 1.5);
  c.stroke();

  c.beginPath();
  c.moveTo(w * 1.05, archBottom);
  c.bezierCurveTo(w * 0.95, h * 0.2, cx * 1.5, archTop * 1.8, cx, archTop * 1.5);
  c.stroke();

  // Climbing rose vines & silhouettes on sides
  c.fillStyle = 'rgba(18, 10, 16, 0.92)';
  renderClimbingVines(c, 0, 0, w * 0.22, h, false);
  renderClimbingVines(c, w, 0, w * 0.22, h, true);

  // Distant conservatory balustrade / garden terrace
  c.fillStyle = 'rgba(20, 12, 18, 0.75)';
  c.fillRect(0, h * 0.88, w, h * 0.12);

  // Balustrade railing
  c.strokeStyle = 'rgba(224, 150, 170, 0.2)';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, h * 0.88);
  c.lineTo(w, h * 0.88);
  c.stroke();

  // Railing balusters
  const numBalusters = Math.floor(w / 28);
  c.strokeStyle = 'rgba(25, 14, 22, 0.8)';
  c.lineWidth = 3;
  c.beginPath();
  for (let i = 0; i <= numBalusters; i++) {
    const bx = (w * i) / numBalusters;
    c.moveTo(bx, h * 0.88);
    c.lineTo(bx, h * 0.94);
  }
  c.stroke();

  c.restore();
}

function renderClimbingVines(c, originX, originY, width, height, flip) {
  const dir = flip ? -1 : 1;
  c.save();
  c.translate(originX, originY);
  if (flip) c.scale(-1, 1);

  // Main branch path
  c.beginPath();
  c.moveTo(0, height);
  c.bezierCurveTo(width * 0.6, height * 0.75, width * 0.3, height * 0.45, width * 0.8, height * 0.2);
  c.bezierCurveTo(width * 0.95, height * 0.1, width * 0.5, height * 0.05, 0, 0);
  c.lineWidth = Math.max(4, width * 0.08);
  c.strokeStyle = 'rgba(22, 12, 20, 0.95)';
  c.stroke();

  // Secondary tendrils & leaf clusters
  const leafCount = 28;
  for (let i = 0; i < leafCount; i++) {
    const t = i / leafCount;
    const lx = Math.sin(t * Math.PI * 3.5) * (width * 0.45) + (width * 0.35 * t);
    const ly = height * (1 - t);
    const size = rand(width * 0.1, width * 0.22);
    const angle = rand(-0.8, 0.8) + (dir * 0.4);

    c.save();
    c.translate(lx, ly);
    c.rotate(angle);
    c.beginPath();
    c.ellipse(0, 0, size * 0.9, size * 0.4, 0, 0, TAU);
    c.fillStyle = i % 3 === 0 ? 'rgba(35, 15, 24, 0.9)' : 'rgba(20, 10, 16, 0.92)';
    c.fill();

    // Occasional rose silhouette / bud
    if (i % 5 === 0) {
      c.beginPath();
      c.arc(size * 0.6, 0, size * 0.45, 0, TAU);
      c.fillStyle = 'rgba(80, 22, 38, 0.85)';
      c.fill();
      c.beginPath();
      c.arc(size * 0.6, 0, size * 0.25, 0, TAU);
      c.fillStyle = 'rgba(150, 45, 65, 0.7)';
      c.fill();
    }
    c.restore();
  }

  c.restore();
}

export default {
  init(w, h, opts = {}) {
    const isMobile = w < 650;
    const petalCount = isMobile ? 65 : 120;
    const fireflyCount = isMobile ? 22 : 45;

    // Petal particle pool
    const petals = [];
    const petalColors = [
      { r: 242, g: 180, b: 195, a: 0.85 }, // Soft blush
      { r: 228, g: 120, b: 145, a: 0.88 }, // Warm rose
      { r: 185, g: 45, b: 75, a: 0.82 },   // Deep velvet crimson
      { r: 250, g: 215, b: 200, a: 0.78 }, // Champagne peach
      { r: 210, g: 90, b: 120, a: 0.84 }   // Rose gold pink
    ];

    for (let i = 0; i < petalCount; i++) {
      const color = petalColors[i % petalColors.length];
      petals.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: rand(0.5, 1.4), // Depth scale
        vx: rand(-0.3, 0.7),
        vy: rand(0.4, 1.3),
        size: rand(5, 11),
        angle: Math.random() * TAU,
        vAngle: rand(-0.03, 0.03),
        flip: Math.random() * TAU,
        vFlip: rand(0.015, 0.045),
        color,
        curve: rand(0.3, 0.7)
      });
    }

    // Fireflies / motes pool
    const fireflies = [];
    for (let i = 0; i < fireflyCount; i++) {
      fireflies.push({
        x: Math.random() * w,
        y: Math.random() * h,
        originX: Math.random() * w,
        originY: Math.random() * h,
        radius: rand(1.2, 2.8),
        pulse: Math.random() * TAU,
        pulseSpeed: rand(0.018, 0.045),
        vx: rand(-0.25, 0.25),
        vy: rand(-0.2, 0.2),
        hue: rand(335, 365) // warm golden-rose to amber
      });
    }

    // Swaying Glass Conservatory Lanterns
    const lanterns = [
      { rx: 0.22, length: h * 0.26, angle: -0.05, vAngle: 0, size: 26, glow: 130 },
      { rx: 0.50, length: h * 0.22, angle: 0.03, vAngle: 0, size: 30, glow: 160 },
      { rx: 0.78, length: h * 0.28, angle: 0.04, vAngle: 0, size: 24, glow: 125 }
    ];

    // Ripple / Bloom bursts from pointer interactions (fixed ring pool)
    const MAX_RIPPLES = 8;
    const ripples = [];
    for (let i = 0; i < MAX_RIPPLES; i++) {
      ripples.push({
        active: false,
        x: 0,
        y: 0,
        radius: 0,
        maxRadius: 180,
        alpha: 0
      });
    }

    return {
      w,
      h,
      petals,
      fireflies,
      lanterns,
      ripples,
      pointerWind: { x: 0, y: 0, force: 0 },
      lastPointer: { x: -1, y: -1, time: 0 },
      canvases: null
    };
  },

  pointerMove(st, x, y, e) {
    if (!st) return;
    const now = performance.now();
    if (st.lastPointer.x >= 0) {
      const dt = Math.max(1, now - st.lastPointer.time);
      const dx = x - st.lastPointer.x;
      const dy = y - st.lastPointer.y;
      const speed = Math.min(6, Math.hypot(dx, dy) / dt);

      st.pointerWind.x = (dx / dt) * 12;
      st.pointerWind.y = (dy / dt) * 12;
      st.pointerWind.force = speed * 1.5;

      // Nudge lanterns if touched or swept
      st.lanterns.forEach(l => {
        const lx = l.rx * st.w;
        const ly = l.length;
        const dist = Math.hypot(x - lx, y - ly);
        if (dist < 120) {
          l.vAngle += (dx * 0.0004) * (1 - dist / 120);
        }
      });
    }
    st.lastPointer.x = x;
    st.lastPointer.y = y;
    st.lastPointer.time = now;
  },

  pointerDown(st, x, y, e) {
    if (!st) return;
    // Spawn interactive bloom ripple
    const r = st.ripples.find(rip => !rip.active) || st.ripples[0];
    r.active = true;
    r.x = x;
    r.y = y;
    r.radius = 8;
    r.maxRadius = rand(130, 210);
    r.alpha = 0.85;

    // Burst nearby petals outward
    st.petals.forEach(p => {
      const dx = p.x - x;
      const dy = p.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < 220) {
        const force = (1 - dist / 220) * 4.5;
        p.vx += (dx / (dist || 1)) * force;
        p.vy += (dy / (dist || 1)) * force - 1.2;
        p.vAngle += rand(-0.15, 0.15);
      }
    });

    // Perturb nearby lantern
    st.lanterns.forEach(l => {
      const lx = l.rx * st.w;
      const ly = l.length;
      const dist = Math.hypot(x - lx, y - ly);
      if (dist < 180) {
        l.vAngle += (x < lx ? -0.04 : 0.04) * (1 - dist / 180);
      }
    });
  },

  pointerUp(st) {
    if (!st) return;
    st.pointerWind.force = 0;
  },

  draw(c, st, t, dt, mood = {}, w, h) {
    if (!st) return;
    const timeSec = t * 0.001;
    const warmMood = mood.warm !== undefined ? mood.warm : 0.2;
    const stormMood = mood.storm !== undefined ? mood.storm : 0;

    // Decay pointer wind smoothly
    st.pointerWind.x *= 0.94;
    st.pointerWind.y *= 0.94;
    st.pointerWind.force *= 0.92;

    // 1. SKY GRADIENT: Dusky Indigo to Velvet Plum & Warm Twilight Rose
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#090510');      // Deepest twilight indigo
    sky.addColorStop(0.35, '#1b0e24');   // Dusky amethyst
    sky.addColorStop(0.68, '#3d162c');   // Velvet wine / plum
    sky.addColorStop(0.92, '#66263b');   // Warm antique rose
    sky.addColorStop(1, '#2c121e');      // Ground shadow
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);

    // Subtle moon / evening horizon warmth
    const horizonGlow = c.createRadialGradient(
      w * 0.5, h * 0.74, 10,
      w * 0.5, h * 0.74, w * 0.65
    );
    horizonGlow.addColorStop(0, `rgba(235, 140, 160, ${0.16 + warmMood * 0.08})`);
    horizonGlow.addColorStop(0.4, 'rgba(180, 80, 110, 0.08)');
    horizonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = horizonGlow;
    c.fillRect(0, 0, w, h);

    // 2. OFFSCREEN ARCHITECTURE (Cached Blit)
    const arch = getOffscreen(st, 'arch', w, h);
    if (arch.fresh) {
      renderArchitecture(arch.ctx, w, h);
    }
    c.drawImage(arch.canvas, 0, 0);

    // 3. SWAYING LANTERNS (Pendulum Physics & Radial Warm Light)
    st.lanterns.forEach(l => {
      // Natural pendulum acceleration: - (g / L) * sin(theta) - damping * v
      const gravity = 0.0018;
      const damping = 0.988;
      const windForce = Math.sin(timeSec * 0.8 + l.rx * 5) * 0.00018 + (stormMood * 0.0004);
      const accel = -gravity * Math.sin(l.angle) + windForce;

      l.vAngle = (l.vAngle + accel) * damping;
      l.angle += l.vAngle;

      const originX = l.rx * w;
      const originY = 0;
      const chainLen = l.length;
      const lanternX = originX + Math.sin(l.angle) * chainLen;
      const lanternY = originY + Math.cos(l.angle) * chainLen;

      // Draw chain
      c.save();
      c.strokeStyle = 'rgba(40, 20, 32, 0.85)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(originX, originY);
      c.lineTo(lanternX, lanternY);
      c.stroke();

      // Warm radial candle glow (flickers softly with sine & warm mood)
      const flicker = Math.sin(timeSec * 4.2 + l.rx * 12) * 0.06 + Math.cos(timeSec * 9.1) * 0.03;
      const glowRadius = l.glow * (1 + warmMood * 0.25 + flicker);

      const radGlow = c.createRadialGradient(
        lanternX, lanternY, 4,
        lanternX, lanternY, glowRadius
      );
      radGlow.addColorStop(0, `rgba(255, 215, 175, ${0.45 + flicker * 0.5})`);
      radGlow.addColorStop(0.25, `rgba(235, 150, 140, ${0.22 + flicker * 0.3})`);
      radGlow.addColorStop(0.65, 'rgba(180, 60, 95, 0.07)');
      radGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = radGlow;
      c.beginPath();
      c.arc(lanternX, lanternY, glowRadius, 0, TAU);
      c.fill();

      // Lantern body (wrought iron cage)
      c.translate(lanternX, lanternY);
      c.rotate(-l.angle * 0.3);

      const sz = l.size;
      // Glass backing
      c.fillStyle = 'rgba(255, 230, 200, 0.45)';
      c.fillRect(-sz * 0.4, -sz * 0.5, sz * 0.8, sz);

      // Candle core
      c.fillStyle = '#fff4db';
      c.beginPath();
      c.ellipse(0, sz * 0.1, sz * 0.18, sz * 0.3, 0, 0, TAU);
      c.fill();

      // Cage frame
      c.strokeStyle = 'rgba(28, 14, 22, 0.95)';
      c.lineWidth = 2.2;
      c.strokeRect(-sz * 0.4, -sz * 0.5, sz * 0.8, sz);

      // Cap & Ring
      c.beginPath();
      c.moveTo(-sz * 0.5, -sz * 0.5);
      c.lineTo(0, -sz * 0.85);
      c.lineTo(sz * 0.5, -sz * 0.5);
      c.closePath();
      c.fillStyle = 'rgba(28, 14, 22, 0.95)';
      c.fill();

      c.restore();
    });

    // 4. BLOOM RIPPLES (Touch Interaction)
    st.ripples.forEach(r => {
      if (!r.active) return;
      r.radius += (r.maxRadius - r.radius) * 0.08 + 1.2;
      r.alpha *= 0.94;
      if (r.alpha < 0.01 || r.radius >= r.maxRadius) {
        r.active = false;
        return;
      }

      c.save();
      c.strokeStyle = `rgba(240, 160, 185, ${r.alpha * 0.75})`;
      c.lineWidth = 2.5 * (1 - r.radius / r.maxRadius);
      c.beginPath();
      c.arc(r.x, r.y, r.radius, 0, TAU);
      c.stroke();

      // Secondary soft glow ring
      c.strokeStyle = `rgba(255, 215, 200, ${r.alpha * 0.4})`;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(r.x, r.y, Math.max(0, r.radius - 8), 0, TAU);
      c.stroke();
      c.restore();
    });

    // 5. DRIFTING ROSE PETALS (Tumblings & Fluid Wind Currents)
    const ambientWind = Math.sin(timeSec * 0.5) * 0.35 + 0.3 + (stormMood * 0.8);
    c.save();

    st.petals.forEach(p => {
      // Wind influences
      p.x += (p.vx + ambientWind + st.pointerWind.x * 0.08) * p.z;
      p.y += (p.vy + st.pointerWind.y * 0.05) * p.z;
      p.angle += p.vAngle;
      p.flip += p.vFlip;

      // Wrap around edges seamlessly
      if (p.x < -40) p.x = w + 30;
      if (p.x > w + 40) p.x = -30;
      if (p.y > h + 30) {
        p.y = -20;
        p.x = Math.random() * w;
      }

      // 3D projected flutter (horizontal width oscillates via cosine of flip)
      const flipScale = Math.cos(p.flip);
      const width = p.size * p.z * flipScale;
      const height = p.size * p.z * 1.35;

      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.angle);

      // Petal heart / tear shape
      c.beginPath();
      c.moveTo(0, -height * 0.45);
      c.bezierCurveTo(width * 1.1, -height * 0.3, width * 0.9, height * 0.5, 0, height * 0.55);
      c.bezierCurveTo(-width * 0.9, height * 0.5, -width * 1.1, -height * 0.3, 0, -height * 0.45);

      const col = p.color;
      // Shading based on flip orientation (simulates underside darker velvet shade)
      const shade = flipScale > 0 ? 1 : 0.78;
      c.fillStyle = `rgba(${Math.round(col.r * shade)}, ${Math.round(col.g * shade)}, ${Math.round(col.b * shade)}, ${col.a})`;
      c.fill();

      // Subtle center vein
      if (p.z > 0.9 && Math.abs(flipScale) > 0.35) {
        c.strokeStyle = `rgba(255, 255, 255, ${0.18 * Math.abs(flipScale)})`;
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(0, -height * 0.3);
        c.lineTo(0, height * 0.4);
        c.stroke();
      }

      c.restore();
    });
    c.restore();

    // 6. GLOWING FIREFLIES / MOTES
    c.save();
    st.fireflies.forEach(f => {
      f.pulse += f.pulseSpeed;
      f.x += f.vx + Math.sin(timeSec + f.pulse) * 0.3;
      f.y += f.vy + Math.cos(timeSec * 0.8 + f.pulse) * 0.25;

      // Pointer avoidance/attraction
      if (st.lastPointer.x >= 0 && st.pointerWind.force > 0.1) {
        const pdx = f.x - st.lastPointer.x;
        const pdy = f.y - st.lastPointer.y;
        const pdist = Math.hypot(pdx, pdy);
        if (pdist < 140) {
          f.x += (pdx / (pdist || 1)) * 1.5;
          f.y += (pdy / (pdist || 1)) * 1.5;
        }
      }

      if (f.x < 0) f.x = w;
      if (f.x > w) f.x = 0;
      if (f.y < 0) f.y = h;
      if (f.y > h) f.y = 0;

      const alpha = Math.max(0, (Math.sin(f.pulse) * 0.45 + 0.55));
      const r = f.radius * (1 + alpha * 0.4);

      // Glowing aura
      const grad = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 3.8);
      grad.addColorStop(0, `hsla(${f.hue}, 90%, 82%, ${alpha * 0.85})`);
      grad.addColorStop(0.4, `hsla(${f.hue}, 80%, 65%, ${alpha * 0.3})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      c.fillStyle = grad;
      c.beginPath();
      c.arc(f.x, f.y, r * 3.8, 0, TAU);
      c.fill();

      // Sharp bright core
      c.fillStyle = `rgba(255, 250, 240, ${alpha * 0.95})`;
      c.beginPath();
      c.arc(f.x, f.y, r * 0.75, 0, TAU);
      c.fill();
    });
    c.restore();

    // 7. CINEMATIC VIGNETTE (Rich velvet twilight border)
    const vignette = c.createRadialGradient(
      w * 0.5, h * 0.5, Math.min(w, h) * 0.42,
      w * 0.5, h * 0.5, Math.max(w, h) * 0.82
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.7, 'rgba(22, 10, 18, 0.28)');
    vignette.addColorStop(1, 'rgba(12, 5, 10, 0.68)');
    c.fillStyle = vignette;
    c.fillRect(0, 0, w, h);
  }
};

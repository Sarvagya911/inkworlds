// Generated soundscapes for each world (Web Audio, no sound files).
import { R, prefs } from '../lib/utils.js';

/* ============================== Ambient sound (synthesized, no files) ============================== */
export const Ambience = {
  ctx: null,
  master: null,
  layers: [],
  L: {},
  timers: [],
  world: null,
  mood: { storm: 0, dark: 0, warm: 0 },
  playing: false,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise();
      this.crackle = this.makeCrackle();
      this.cricket = this.makeCrickets();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  },
  makeNoise() {
    const c = this.ctx,
      b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  },
  makeCrackle() {
    const c = this.ctx,
      sr = c.sampleRate,
      b = c.createBuffer(1, sr * 3, sr),
      d = b.getChannelData(0);
    for (let k = 0; k < 42; k++) {
      const s = Math.floor(Math.random() * (d.length - 900)),
        a = R(0.2, 1),
        len = Math.floor(R(80, 700));
      for (let i = 0; i < len; i++) d[s + i] += (Math.random() * 2 - 1) * a * Math.exp(-i / (len / 4));
    }
    return b;
  },
  makeCrickets() {
    const c = this.ctx,
      sr = c.sampleRate,
      b = c.createBuffer(1, sr * 2, sr),
      d = b.getChannelData(0);
    for (let ch = 0; ch < 5; ch++) {
      const t0 = ch * 0.4;
      for (let p = 0; p < 3; p++) {
        const s = Math.floor((t0 + p * 0.045) * sr),
          len = Math.floor(0.03 * sr);
        for (let i = 0; i < len && s + i < d.length; i++)
          d[s + i] += Math.sin((2 * Math.PI * 4300 * i) / sr) * Math.sin((Math.PI * i) / len) * 0.5;
      }
    }
    return b;
  },
  layer(buf, type, freq, q, base, rate = 1) {
    const c = this.ctx,
      s = c.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0;
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start();
    const L = { s, f, g, base };
    this.layers.push(L);
    return L;
  },
  lfo(param, rate, depth) {
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g);
    g.connect(param);
    o.start();
    this.layers.push({ s: o });
  },
  hum(freqs) {
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.connect(this.master);
    freqs.forEach(f => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = this.ctx.createGain();
      og.gain.value = 0.06;
      o.connect(og);
      og.connect(g);
      o.start();
      this.layers.push({ s: o });
    });
    const L = { g, base: 0.8 };
    this.layers.push(L);
    return L;
  },
  musicBox() {
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    this.timers.push(
      setInterval(() => {
        if (!this.ctx || Math.random() > 0.55) return;
        const c = this.ctx,
          o = c.createOscillator(),
          g = c.createGain(),
          now = c.currentTime;
        o.type = 'sine';
        o.frequency.value = notes[Math.floor(Math.random() * notes.length)];
        const v = 0.06 * (1 - this.mood.dark * 0.6);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(v, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
        o.connect(g);
        g.connect(this.master);
        o.start(now);
        o.stop(now + 1.4);
      }, 650)
    );
  },
  build(world) {
    this.clear();
    this.world = world;
    const L = {};
    L.rain = this.layer(this.noise, 'bandpass', 1400, 0.6, 0);
    L.wind = this.layer(this.noise, 'lowpass', 380, 1, 0.1);
    this.lfo(L.wind.f.frequency, 0.08, 180);
    if (world === 'parchment') {
      L.fire = this.layer(this.crackle, 'highpass', 900, 0.5, 0.55);
      L.wind.base = 0.1;
    }
    if (world === 'gothic') {
      L.wind.base = 0.35;
    }
    if (world === 'victorian') {
      L.wind.base = 0.14;
      L.rain.base = 0.12;
    }
    if (world === 'cosmos') {
      L.hum = this.hum([55, 82.4, 110]);
      L.wind.base = 0.06;
    }
    if (world === 'ocean') {
      L.sea = this.layer(this.noise, 'lowpass', 520, 0.7, 0.5);
      this.lfo(L.sea.g.gain, 0.09, 0.3);
      L.wind.base = 0.05;
    }
    if (world === 'forest') {
      L.crick = this.layer(this.cricket, 'highpass', 2500, 0.5, 0.25);
      L.crick2 = this.layer(this.cricket, 'highpass', 2500, 0.5, 0.16, 1.07);
      L.wind.base = 0.12;
    }
    if (world === 'whimsical') {
      this.musicBox();
      L.wind.base = 0.04;
    }
    this.L = L;
    this.applyMood(this.mood, true);
  },
  applyMood(m, instant) {
    this.mood = m;
    if (!this.ctx) return;
    const now = this.ctx.currentTime,
      tc = instant ? 0.05 : 1.6,
      L = this.L;
    const set = (l, v) => {
      if (l) l.g.gain.setTargetAtTime(Math.max(0, v), now, tc);
    };
    set(L.rain, Math.max(L.rain ? L.rain.base : 0, m.storm * 0.5));
    set(L.wind, (L.wind ? L.wind.base : 0) + m.storm * 0.3);
    set(L.fire, L.fire && L.fire.base * (1 - m.storm * 0.4));
    set(L.hum, L.hum && L.hum.base * (1 - m.warm * 0.3));
    set(L.sea, L.sea && L.sea.base * (1 + m.storm * 0.4));
    set(L.crick, L.crick && L.crick.base * (1 - m.storm));
    set(L.crick2, L.crick2 && L.crick2.base * (1 - m.storm));
  },
  clear() {
    this.layers.forEach(l => {
      try {
        l.s && l.s.stop();
      } catch (e) {}
      try {
        (l.g || l.s).disconnect();
      } catch (e) {}
    });
    this.layers = [];
    this.L = {};
    this.timers.forEach(clearInterval);
    this.timers = [];
  },
  play(world) {
    if (!this.ensure()) return false;
    if (this.world !== world || !this.layers.length) this.build(world);
    this.playing = true;
    this.master.gain.setTargetAtTime((prefs.vol / 100) * 0.8, this.ctx.currentTime, 0.4);
    return true;
  },
  volume() {
    if (this.ctx && this.playing)
      this.master.gain.setTargetAtTime((prefs.vol / 100) * 0.8, this.ctx.currentTime, 0.1);
  },
  pause() {
    if (!this.ctx) return;
    this.playing = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  },
  stopAll() {
    if (!this.ctx) return;
    this.pause();
    setTimeout(() => {
      if (!this.playing) {
        this.clear();
        this.world = null;
      }
    }, 900);
  }
};

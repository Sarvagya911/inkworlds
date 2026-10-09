// // Draws one world onto a canvas, plus rain, lightning and mood lighting.
// import { THEMES } from '../../config/themes.js';
// import { SCENES } from './index.js';
// import { R } from '../../lib/utils.js';

// export class Renderer {
//   constructor(cv, opts = {}) {
//     this.cv = cv;
//     this.c = cv.getContext('2d');
//     this.full = !!opts.full;
//     this.fixed = opts.fixed || null;
//     this.maxDpr = opts.maxDpr || 1.5;
//     this.interval = opts.interval || 32;
//     this.name = null;
//     this.st = null;
//     this.t = 6;
//     this.running = false;
//     this.mood = { storm: 0, dark: 0, warm: 0 };
//     this.target = { storm: 0, dark: 0, warm: 0 };
//     this.rain = [];
//     this.flash = 0;
//     this.lastDraw = 0;
//     this.last = 0;
//   }
//   size() {
//     if (this.fixed) return this.fixed;
//     if (this.full) return [innerWidth, innerHeight];
//     const r = this.cv.getBoundingClientRect();
//     return [Math.max(10, r.width), Math.max(10, r.height)];
//   }
//   resize() {
//     const [w, h] = this.size();
//     this.w = w;
//     this.h = h;
//     this.dpr = this.fixed ? 1 : Math.min(this.maxDpr, window.devicePixelRatio || 1);
//     this.cv.width = Math.round(w * this.dpr);
//     this.cv.height = Math.round(h * this.dpr);
//     this.c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
//     if (this.name) this.st = SCENES[this.name].init(w, h, { full: this.full });
//   }
//   set(name) {
//     this.name = name;
//     this.rain = [];
//     this.resize();
//     this.t = 6;
//     // Still images (fixed size) skip a world's intro animation, if it has one.
//     if (this.fixed && this.st && SCENES[name].settle) SCENES[name].settle(this.st);
//     for (let i = 0; i < 14; i++) this.frame(0.12);
//   }
//   start() {
//     if (this.running || !this.name) return;
//     this.running = true;
//     this.last = performance.now();
//     const loop = ts => {
//       if (!this.running) return;
//       requestAnimationFrame(loop);
//       if (ts - this.lastDraw < this.interval) return;
//       this.lastDraw = ts;
//       const dt = Math.min(0.1, (ts - this.last) / 1000);
//       this.last = ts;
//       this.frame(dt);
//     };
//     requestAnimationFrame(loop);
//   }
//   stop() {
//     this.running = false;
//   }
//   setMood(m) {
//     this.target = { storm: m.storm, dark: m.dark, warm: m.warm };
//     if (!this.running) {
//       this.mood = { ...this.target };
//       this.frame(0);
//     }
//   }
//   frame(dt) {
//     if (!this.name || !this.st) return;
//     const c = this.c,
//       w = this.w,
//       h = this.h,
//       m = this.mood,
//       th = THEMES[this.name];
//     this.t += dt;
//     for (const k of ['storm', 'dark', 'warm']) m[k] += (this.target[k] - m[k]) * Math.min(1, dt * 0.7);
//     SCENES[this.name].draw(c, this.st, this.t, dt, m, w, h);
//     const storm = Math.max(m.storm, (th.base && th.base.storm) || 0),
//       want = Math.floor(storm * 260 * Math.min(1, (w * h) / 900000 + 0.15));
//     while (this.rain.length < want)
//       this.rain.push({ x: R(-w * 0.1, w), y: R(-h, h), l: R(10, 24), v: R(650, 950) });
//     if (this.rain.length > want) this.rain.length = want;
//     if (this.rain.length) {
//       c.strokeStyle = `rgba(${th.rain},.32)`;
//       c.lineWidth = 1;
//       c.beginPath();
//       for (const d of this.rain) {
//         d.y += d.v * dt;
//         d.x += d.v * dt * 0.12;
//         if (d.y > h) {
//           d.y = R(-60, -10);
//           d.x = R(-w * 0.1, w);
//         }
//         c.moveTo(d.x, d.y);
//         c.lineTo(d.x - d.l * 0.12, d.y - d.l);
//       }
//       c.stroke();
//     }
//     if (dt > 0 && dt < 0.11 && this.running && Math.random() < dt * storm * storm * 0.45) this.flash = 1;
//     if (this.flash > 0) {
//       c.fillStyle = `rgba(235,240,255,${this.flash * 0.32})`;
//       c.fillRect(0, 0, w, h);
//       this.flash -= dt * 3.2;
//     }
//     if (m.dark > 0.02) {
//       c.fillStyle = `rgba(4,4,10,${m.dark * 0.3})`;
//       c.fillRect(0, 0, w, h);
//     }
//     if (m.warm > 0.02) {
//       c.fillStyle = `rgba(255,196,120,${m.warm * 0.08})`;
//       c.fillRect(0, 0, w, h);
//     }
//   }
// }


// Draws one world onto a canvas, plus rain, lightning,
// mood lighting and interactive world controls.

import { THEMES } from '../../config/themes.js';
import { SCENES } from './index.js';
import { R } from '../../lib/utils.js';

export class Renderer {
  constructor(cv, opts = {}) {
    this.cv = cv;
    this.c = cv.getContext('2d');

    this.full = !!opts.full;
    this.fixed = opts.fixed || null;

    this.maxDpr =
      opts.maxDpr || 1.5;

    this.interval =
      opts.interval || 32;

    this.name = null;
    this.st = null;

    this.t = 6;
    this.running = false;

    this.mood = {
      storm: 0,
      dark: 0,
      warm: 0
    };

    this.target = {
      storm: 0,
      dark: 0,
      warm: 0
    };

    this.rain = [];
    this.flash = 0;

    this.lastDraw = 0;
    this.last = 0;

    this.pointer = {
      x: 0,
      y: 0,
      down: false
    };

    this._bindPointer();
  }


  size() {
    if (this.fixed) {
      return this.fixed;
    }

    if (this.full) {
      return [
        innerWidth,
        innerHeight
      ];
    }

    const r =
      this.cv.getBoundingClientRect();

    return [
      Math.max(
        10,
        r.width
      ),
      Math.max(
        10,
        r.height
      )
    ];
  }


  resize() {
    const [
      w,
      h
    ] = this.size();

    this.w = w;
    this.h = h;

    this.dpr =
      this.fixed
        ? 1
        : Math.min(
            this.maxDpr,
            window.devicePixelRatio ||
              1
          );

    this.cv.width =
      Math.round(
        w * this.dpr
      );

    this.cv.height =
      Math.round(
        h * this.dpr
      );

    this.c.setTransform(
      this.dpr,
      0,
      0,
      this.dpr,
      0,
      0
    );

    if (this.name) {
      this.st =
        SCENES[
          this.name
        ].init(
          w,
          h,
          {
            full:
              this.full
          }
        );
    }

    this.pointer.x =
      w / 2;

    this.pointer.y =
      h / 2;

    this.pointer.down =
      false;
  }


  set(name) {
    this.name =
      name;

    this.rain = [];

    this.resize();

    this.t = 6;

    if (
      this.fixed &&
      this.st &&
      SCENES[name].settle
    ) {
      SCENES[
        name
      ].settle(
        this.st
      );
    }

    for (
      let i = 0;
      i < 14;
      i++
    ) {
      this.frame(
        0.12
      );
    }
  }


  start() {
    if (
      this.running ||
      !this.name
    ) {
      return;
    }

    this.running = true;

    this.last =
      performance.now();

    const loop =
      ts => {
        if (
          !this.running
        ) {
          return;
        }

        requestAnimationFrame(
          loop
        );

        if (
          ts -
            this.lastDraw <
          this.interval
        ) {
          return;
        }

        this.lastDraw =
          ts;

        const dt =
          Math.min(
            0.1,
            (
              ts -
              this.last
            ) / 1000
          );

        this.last =
          ts;

        this.frame(
          dt
        );
      };

    requestAnimationFrame(
      loop
    );
  }


  stop() {
    this.running =
      false;
  }


  setMood(m) {
    this.target = {
      storm:
        m.storm || 0,

      dark:
        m.dark || 0,

      warm:
        m.warm || 0
    };

    if (
      !this.running
    ) {
      this.mood = {
        ...this.target
      };

      this.frame(0);
    }
  }


  /*
   * IMPORTANT:
   *
   * We listen on window instead of only
   * the canvas.
   *
   * The reader page sits over the world,
   * so the canvas itself may not receive
   * pointer events.
   */
  _bindPointer() {
    window.addEventListener(
      'pointermove',
      e => {
        if (!this.w) {
          return;
        }

        this.pointer.x =
          e.clientX;

        this.pointer.y =
          e.clientY;

        const scene =
          this.name &&
          SCENES[
            this.name
          ];

        scene?.pointerMove?.(
          this.st,
          e.clientX,
          e.clientY,
          e
        );
      },
      {
        passive: true
      }
    );


    window.addEventListener(
      'pointerdown',
      e => {
        this.pointer.down =
          true;

        const scene =
          this.name &&
          SCENES[
            this.name
          ];

        scene?.pointerDown?.(
          this.st,
          e.clientX,
          e.clientY,
          e
        );
      },
      {
        passive: true
      }
    );


    window.addEventListener(
      'pointerup',
      e => {
        this.pointer.down =
          false;

        const scene =
          this.name &&
          SCENES[
            this.name
          ];

        scene?.pointerUp?.(
          this.st,
          e.clientX,
          e.clientY,
          e
        );
      },
      {
        passive: true
      }
    );
  }


  frame(dt) {
    if (
      !this.name ||
      !this.st
    ) {
      return;
    }

    const c =
      this.c;

    const w =
      this.w;

    const h =
      this.h;

    const m =
      this.mood;

    const th =
      THEMES[
        this.name
      ];

    this.t += dt;


    /*
     * Smooth mood transitions.
     */
    for (
      const k of [
        'storm',
        'dark',
        'warm'
      ]
    ) {
      m[k] +=
        (
          this.target[k] -
          m[k]
        ) *
        Math.min(
          1,
          dt * 0.7
        );
    }


    /*
     * World.
     */
    SCENES[
      this.name
    ].draw(
      c,
      this.st,
      this.t,
      dt,
      m,
      w,
      h
    );


    /*
     * Existing global rain system.
     *
     * Neon already has its own detailed
     * rain, so don't duplicate it.
     */
    const isNeon =
      this.name ===
      'neon';

    const storm =
      Math.max(
        m.storm,
        (
          th.base &&
          th.base.storm
        ) || 0
      );


    if (
      !isNeon
    ) {
      const want =
        Math.floor(
          storm *
            260 *
            Math.min(
              1,
              (
                w * h
              ) /
                900000 +
                0.15
            )
        );

      while (
        this.rain.length <
        want
      ) {
        this.rain.push({
          x:
            R(
              -w * 0.1,
              w
            ),

          y:
            R(
              -h,
              h
            ),

          l:
            R(
              10,
              24
            ),

          v:
            R(
              650,
              950
            )
        });
      }

      if (
        this.rain.length >
        want
      ) {
        this.rain.length =
          want;
      }


      if (
        this.rain.length
      ) {
        c.strokeStyle =
          `rgba(${th.rain},.32)`;

        c.lineWidth = 1;

        c.beginPath();

        for (
          const d of this.rain
        ) {
          d.y +=
            d.v *
            dt;

          d.x +=
            d.v *
            dt *
            0.12;

          if (
            d.y >
            h
          ) {
            d.y =
              R(
                -60,
                -10
              );

            d.x =
              R(
                -w * 0.1,
                w
              );
          }

          c.moveTo(
            d.x,
            d.y
          );

          c.lineTo(
            d.x -
              d.l *
                0.12,
            d.y -
              d.l
          );
        }

        c.stroke();
      }
    }


    /*
     * Lightning.
     */
    if (
      dt > 0 &&
      dt < 0.11 &&
      this.running &&
      Math.random() <
        dt *
          storm *
          storm *
          0.45
    ) {
      this.flash = 1;
    }


    if (
      this.flash >
      0
    ) {
      c.fillStyle =
        `rgba(235,240,255,${
          this.flash *
          0.32
        })`;

      c.fillRect(
        0,
        0,
        w,
        h
      );

      this.flash -=
        dt * 3.2;
    }


    /*
     * Global mood overlays.
     */
    if (
      m.dark >
      0.02
    ) {
      c.fillStyle =
        `rgba(4,4,10,${
          m.dark *
          0.3
        })`;

      c.fillRect(
        0,
        0,
        w,
        h
      );
    }


    if (
      m.warm >
      0.02
    ) {
      c.fillStyle =
        `rgba(255,196,120,${
          m.warm *
          0.08
        })`;

      c.fillRect(
        0,
        0,
        w,
        h
      );
    }
  }
}
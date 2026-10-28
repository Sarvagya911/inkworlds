import { mk, sprite, glow } from '../draw-utils.js';
import { R, clamp } from '../../../lib/utils.js';

// "parchment" world: an antique enchanted map that inks itself onto the page.
// A coastline with contour lines, a winding river, mountains, forests, a walled castle,
// villages and a lone tower are joined by curving roads. Footsteps travel the roads,
// the river flows, a ship sails the coast, windmill sails turn, chimneys smoke,
// flags fly, and now and then a road lights up in golden ink.
// Wizarding layer: Hogwarts-style castle, Quidditch pitch, owls, snitch, ghosts, Patronus,
// Marauder's-Map names beside the footprints.
// init() pre-renders the parchment and the map; draw() animates one frame.

const INK = '52,30,12';
const TAU = Math.PI * 2;
const SEED = (Math.random() * 2 ** 32) >>> 0; // one map per page load; a resize redraws the same map
const seen = new Set(); // sizes already revealed, so resizing doesn't replay the ink bloom
const NAMES = {
  realm: [
    'The Vale of Everwyn',
    'The Mistral Reaches',
    'The Lantern Isles',
    'The Duchy of Hollowmere',
    'The Kingdom of Aldermoor'
  ],
  castle: ['Castle Greywater', 'Ravensholt', 'Stormwatch Keep', 'Castle Ashgrove'],
  village: [
    'Brackenby',
    'Thornwick',
    'Little Wending',
    'Owlsbridge',
    'Fennmouth',
    'Candlefold',
    'Marrowdale',
    'Hob’s End'
  ],
  port: ['Saltmere Harbour', 'Gull’s Landing', 'Port Wendle'],
  tower: ['The Astronomer’s Tower', 'Greyspire', 'The Hermit’s Tower'],
  wood: ['The Whispering Wood', 'Elderwood', 'The Tangle', 'Nightjar Forest'],
  mountains: ['The Frostcrown Peaks', 'The Dragonback Hills', 'The Grey Teeth'],
  sea: ['The Sleeping Sea', 'Mermaid’s Reach', 'The Glass Water'],
  circle: ['The Old Stones']
};

// Wizarding-world layer for parchment.js: a grand castle, a Quidditch pitch, a Whomping-Willow-style
// tree, a crooked shack, glowing eyes in the forest, then the living magic: owls, a golden snitch,
// house-coloured broom riders, floating candles, ghosts, a Patronus stag, a lake tentacle,
// and Marauder's-Map style names beside the walking footprints.

const FONT = '"EB Garamond", "Cormorant Garamond", Georgia, serif';
const OATH = 'I solemnly swear that I am up to no good';

const HP = {
  names: {
    realm: ['Hogwarts and Environs'],
    castle: ['Hogwarts'],
    village: ['Brackenby', 'Thornwick', 'Owlsbridge', 'Fennmouth', 'Candlefold', 'Marrowdale', 'Little Wending', 'Hob’s End'],
    port: ['Black Lake Landing'],
    tower: ['The Astronomy Tower'],
    wood: ['The Forbidden Forest', 'The Whispering Wood', 'Dark Hollow', 'The Tangle'],
    mountains: ['The Highlands'],
    sea: ['The Black Lake'],
    circle: ['The Standing Stones']
  },
  subtitle: 'Surveyed by Wren and Fenn, cartographers of mischief',
  people: ['Wren', 'Aldous Fenn', 'Tamsin Rook', 'Barnaby Quill', 'Odalys Finch', 'Peregrine Moss', 'Isolde Vane']
};

const HOUSES = ['170,40,35', '40,115,70', '50,85,165', '220,180,40']; // scarlet, green, blue, gold

/* ------------------------------------------------------------------ helpers */
const nearPts = (pts, x, y, d) =>
  pts.some(p => Math.abs(p[0] - x) < d && Math.abs(p[1] - y) < d && Math.hypot(p[0] - x, p[1] - y) < d);

/* ------------------------------------------------------------------ the castle (static ink) */
function grandCastle(g, p, S, u, flags, lights) {
  const x0 = p.x,
    y0 = p.y + S * 0.5;
  g.save();
  g.lineWidth = Math.max(0.55, 0.85 * u);
  g.strokeStyle = `rgba(${INK},.88)`;
  g.lineJoin = 'round';

  // Crag the castle sits on, hatched.
  g.beginPath();
  g.ellipse(x0, y0, S * 4.3, S * 1.0, 0, 0, Math.PI);
  hide(g);
  g.stroke();
  g.beginPath();
  for (let k = 0; k < 9; k++) {
    const sx = x0 - S * 3.6 + k * S * 0.9;
    g.moveTo(sx, y0 + S * 0.15);
    g.lineTo(sx - S * 0.15, y0 + S * 0.7);
  }
  g.stroke();

  // A covered bridge reaching out to the left.
  const by = y0 + S * 0.1,
    bl = x0 - S * 3.8,
    br = x0 - S * 8;
  g.beginPath();
  g.rect(br, by - S * 0.4, bl - br, S * 0.4);
  hide(g);
  g.stroke();
  g.beginPath();
  for (let k = 0; k < 4; k++) {
    const seg = (bl - br) / 4;
    g.arc(br + seg * (k + 0.5), by, seg * 0.38, 0, Math.PI);
  }
  for (let x = br + S * 0.4; x < bl; x += S * 0.55) {
    g.moveTo(x, by - S * 0.4);
    g.lineTo(x, by);
  }
  g.stroke();

  // x, width, height, roof height (all in units of S).
  const tower = (xr, wr, hr, rr, opt = {}) => {
    const x = x0 + xr * S,
      w = wr * S,
      h = hr * S,
      top = y0 - h;
    g.beginPath();
    g.rect(x - w / 2, top, w, h);
    hide(g);
    g.stroke();
    g.beginPath();
    g.moveTo(x - w / 2 - w * 0.12, top);
    g.lineTo(x + w / 2 + w * 0.12, top);
    g.stroke();
    g.beginPath();
    g.moveTo(x - w / 2 - w * 0.18, top);
    g.lineTo(x, top - rr * S);
    g.lineTo(x + w / 2 + w * 0.18, top);
    g.closePath();
    hide(g);
    g.fillStyle = `rgba(${INK},.32)`;
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(x, top - rr * S);
    g.lineTo(x, top - rr * S - S * 0.6);
    g.stroke();
    if (opt.flag) flags.push([x, top - rr * S - S * 0.6, S / 9]);
    for (let k = 0; ; k++) {
      const wy = top + S * (0.7 + k * 1.1);
      if (wy + S * 0.4 > y0 - S * 1.6) break;
      g.beginPath();
      g.moveTo(x - w * 0.1, wy + S * 0.38);
      g.lineTo(x - w * 0.1, wy);
      g.arc(x, wy, w * 0.1, Math.PI, 0);
      g.lineTo(x + w * 0.1, wy + S * 0.38);
      g.stroke();
      if (k % 2 === 0) lights.push([x, wy + S * 0.2, S * 0.5, opt.magic && k === 0]);
    }
  };
  tower(0.3, 1.0, 4.6, 2.0, { flag: true, magic: true }); // the tall Astronomy-style tower
  tower(-1.6, 0.9, 3.6, 1.6, { flag: true });
  tower(1.9, 0.95, 3.2, 1.4, { flag: true });

  // Curtain wall with battlements.
  const wallH = S * 1.5,
    wx = x0 - S * 3.5,
    ww = S * 7;
  g.beginPath();
  g.rect(wx, y0 - wallH, ww, wallH);
  hide(g);
  g.stroke();
  g.beginPath();
  for (let k = 0; k < 15; k++) g.rect(wx + (k * ww) / 15, y0 - wallH - S * 0.2, (ww / 15) * 0.55, S * 0.2);
  g.stroke();

  // Gatehouse with portcullis.
  const gx = x0 + S * 0.2,
    gw = S * 1.5,
    gh = S * 2.2;
  g.beginPath();
  g.rect(gx - gw / 2, y0 - gh, gw, gh);
  hide(g);
  g.stroke();
  g.beginPath();
  for (let k = 0; k < 4; k++) g.rect(gx - gw / 2 + k * gw * 0.28, y0 - gh - S * 0.22, gw * 0.2, S * 0.22);
  g.moveTo(gx - gw * 0.22, y0);
  g.lineTo(gx - gw * 0.22, y0 - gh * 0.45);
  g.arc(gx, y0 - gh * 0.45, gw * 0.22, Math.PI, 0);
  g.lineTo(gx + gw * 0.22, y0);
  g.stroke();
  g.beginPath();
  for (let k = -1; k <= 1; k++) {
    g.moveTo(gx + k * gw * 0.12, y0);
    g.lineTo(gx + k * gw * 0.12, y0 - gh * 0.5);
  }
  g.stroke();

  tower(-3.5, 0.85, 2.5, 1.1);
  tower(3.6, 0.85, 2.3, 1.0, { flag: true });
  g.restore();
}

/* ------------------------------------------------------------------ extra places (static ink) */
function drawExtras(g, G, u, S, rand, woods, w, h) {
  const W = w,
    H = h,
    m = 30 * u + 16;
  const roadPts = G.roads.flatMap(r => r.path.pts);
  const lw = Math.max(0.55, 0.85 * u);
  const used = [];
  g.save();
  g.lineWidth = lw;
  g.strokeStyle = `rgba(${INK},.85)`;
  g.lineJoin = 'round';

  // Finds open ground near (cx, cy), clear of places, roads, rivers and the coast.
  const spot = (cx, cy, rMin, rMax, clear) => {
    for (let k = 0; k < 120; k++) {
      const a = rand() * TAU,
        r = rMin + rand() * (rMax - rMin);
      const x = cx + Math.cos(a) * r * 1.3,
        y = cy + Math.sin(a) * r * 0.8;
      if (x < m + clear || x > W - m - clear || y < m + clear || y > H - m - clear) continue;
      const [qa, qb] = G.AB(x, y);
      if (qb < G.coastB(qa) + 0.04 || qb > G.mtnB - 0.02) continue;
      if (G.places.some(p => Math.hypot(p.x - x, p.y - y) < clear * 1.6)) continue;
      if (used.some(q => Math.hypot(q[0] - x, q[1] - y) < clear * 1.6)) continue;
      if (nearPts(roadPts, x, y, clear * 0.7) || nearPts(G.river, x, y, clear * 0.7)) continue;
      if (G.trib.length && nearPts(G.trib, x, y, clear * 0.6)) continue;
      used.push([x, y]);
      return [x, y];
    }
    return null;
  };

  // Quidditch pitch: oval, stands, centre circle and three hoops at each end.
  let pitch = null;
  const pp = spot(G.castle.x, G.castle.y, S * 7, S * 13, S * 4);
  if (pp) {
    const [x, y] = pp,
      rx = S * 3,
      ry = S * 1.5;
    pitch = { x, y, rx, ry };
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    hide(g);
    g.stroke();
    g.beginPath();
    g.ellipse(x, y, rx * 0.82, ry * 0.78, 0, 0, TAU);
    g.moveTo(x, y - ry * 0.78);
    g.lineTo(x, y + ry * 0.78);
    g.moveTo(x + rx * 0.18, y);
    g.ellipse(x, y, rx * 0.18, ry * 0.3, 0, 0, TAU);
    g.stroke();
    g.beginPath();
    for (let k = 0; k < 32; k++) {
      const a = (k * TAU) / 32;
      g.moveTo(x + Math.cos(a) * rx, y + Math.sin(a) * ry);
      g.lineTo(x + Math.cos(a) * rx * 1.13, y + Math.sin(a) * ry * 1.2);
    }
    for (const sx of [-1, 1])
      for (const [dy, h] of [
        [-0.45, 1.3],
        [0, 1.8],
        [0.45, 1.3]
      ]) {
        const hx = x + sx * rx * 0.82,
          hy = y + dy * ry;
        g.moveTo(hx, hy);
        g.lineTo(hx, hy - S * h);
        g.moveTo(hx + S * 0.22, hy - S * h - S * 0.28);
        g.ellipse(hx, hy - S * h - S * 0.28, S * 0.22, S * 0.28, 0, 0, TAU);
      }
    g.stroke();
  }

  // A gnarled tree whose branches are animated in draw().
  let willow = null;
  const wp = spot(G.castle.x, G.castle.y, S * 5, S * 16, S * 3.5);
  if (wp) {
    const [x, y] = wp,
      s = S * 1.2;
    willow = { x, y, s };
    g.beginPath();
    g.moveTo(x - s * 0.45, y);
    g.quadraticCurveTo(x - s * 0.2, y - s * 1.2, x - s * 0.3, y - s * 2.2);
    g.lineTo(x + s * 0.3, y - s * 2.2);
    g.quadraticCurveTo(x + s * 0.25, y - s * 1.2, x + s * 0.45, y);
    g.closePath();
    hide(g);
    g.stroke();
    g.beginPath();
    g.moveTo(x - s * 0.45, y);
    g.quadraticCurveTo(x - s * 0.9, y + s * 0.1, x - s * 1.1, y + s * 0.25);
    g.moveTo(x + s * 0.45, y);
    g.quadraticCurveTo(x + s * 0.9, y + s * 0.1, x + s * 1.1, y + s * 0.25);
    g.moveTo(x - s * 0.12, y - s * 1.1);
    g.arc(x - s * 0.12, y - s * 1.1, s * 0.1, 0, TAU);
    g.stroke();
  }

  // A crooked, boarded-up shack on the edge of the first village.
  let shack = null;
  const v0 = G.places.find(p => p.kind === 'village');
  const sp = v0 && spot(v0.x, v0.y, S * 4, S * 8, S * 2.5);
  if (sp) {
    const [x, y] = sp;
    shack = { x, y };
    g.save();
    g.translate(x, y);
    g.rotate(-0.07);
    g.beginPath();
    g.rect(-S * 0.8, -S * 0.9, S * 1.6, S * 0.9);
    hide(g);
    g.stroke();
    g.beginPath();
    g.moveTo(-S * 0.95, -S * 0.9);
    g.lineTo(-S * 0.1, -S * 1.55);
    g.lineTo(S * 0.2, -S * 1.35);
    g.lineTo(S * 0.95, -S * 0.9);
    g.closePath();
    hide(g);
    g.fillStyle = `rgba(${INK},.25)`;
    g.fill();
    g.stroke();
    g.beginPath();
    g.rect(-S * 0.5, -S * 0.7, S * 0.4, S * 0.4);
    g.moveTo(-S * 0.5, -S * 0.7);
    g.lineTo(-S * 0.1, -S * 0.3);
    g.moveTo(-S * 0.1, -S * 0.7);
    g.lineTo(-S * 0.5, -S * 0.3);
    for (let k = 0; k < 5; k++) {
      g.moveTo(S * (0.2 + k * 0.17), 0);
      g.lineTo(S * (0.2 + k * 0.17), -S * 0.35);
    }
    g.stroke();
    g.restore();
  }

  // Pairs of eyes that blink open in the forest.
  const eyes = [];
  for (const wd of woods)
    for (let k = 0; k < 3; k++) {
      const a = rand() * TAU,
        r = Math.sqrt(rand()) * wd.r * 0.7;
      eyes.push({
        x: wd.x + Math.cos(a) * r * 1.2,
        y: wd.y + Math.sin(a) * r * 0.7,
        sp: 1.3 * u + 1.5,
        ph: rand() * TAU
      });
    }
  // Faint filler across the whole page (it shows through behind the text, so it stays light):
  // grass tufts, small hills and trees, star charts, and a dotted treasure trail ending in an X.
  {
    const d0 = 20 * u + 8,
      cap = Math.min(520, Math.floor((W * H) / (d0 * d0 * 2.2))),
      pts = [];
    for (let k = 0; k < cap * 4 && pts.length < cap; k++) {
      const x = m + rand() * (W - 2 * m),
        y = m + rand() * (H - 2 * m),
        [qa, qb] = G.AB(x, y);
      if (qb < G.coastB(qa) + 0.025 || qb > G.mtnB - 0.01) continue;
      if (pts.some(q => Math.hypot(q[0] - x, q[1] - y) < d0)) continue;
      if (G.places.some(p => Math.hypot(p.x - x, p.y - y) < S * 4.5)) continue;
      if (used.some(q => Math.hypot(q[0] - x, q[1] - y) < S * 5)) continue;
      if (woods.some(wd => Math.hypot((wd.x - x) / 1.3, (wd.y - y) / 0.8) < wd.r * 1.05)) continue;
      if (nearPts(roadPts, x, y, 7 * u + 3) || nearPts(G.river, x, y, 9 * u + 4)) continue;
      if (G.trib.length && nearPts(G.trib, x, y, 6 * u + 3)) continue;
      pts.push([x, y]);
    }
    g.lineCap = 'round';
    for (const [x, y] of pts) {
      const r = rand();
      g.strokeStyle = `rgba(${INK},${0.3 + rand() * 0.15})`;
      g.lineWidth = Math.max(0.45, 0.65 * u);
      if (r < 0.45) {
        const t0 = (3 + rand() * 2) * u + 1.5;
        g.beginPath();
        for (const dx of [-1, 0, 1]) {
          g.moveTo(x + dx * t0 * 0.5, y);
          g.quadraticCurveTo(x + dx * t0 * 0.6, y - t0 * 0.7, x + dx * t0 * 0.9, y - t0 * (1.1 - Math.abs(dx) * 0.3));
        }
        g.stroke();
      } else if (r < 0.7) hill(g, x, y, (5 + rand() * 4) * u + 2.5, u);
      else if (r < 0.88) (rand() < 0.5 ? broadleaf : conifer)(g, x, y, (4.5 + rand() * 2) * u + 2);
      else {
        g.beginPath();
        g.arc(x, y, (1.6 + rand()) * u + 1, Math.PI, TAU);
        g.arc(x + 3 * u + 2, y + 1, (1.2 + rand()) * u + 0.8, Math.PI, TAU);
        g.stroke();
      }
    }
    const land = (x0, x1) => {
      for (let k = 0; k < 60; k++) {
        const x = W * (x0 + rand() * (x1 - x0)),
          y = m + rand() * (H - 2 * m),
          [qa, qb] = G.AB(x, y);
        if (qb > G.coastB(qa) + 0.05 && qb < G.mtnB - 0.03 && !G.places.some(p => Math.hypot(p.x - x, p.y - y) < S * 3))
          return [x, y];
      }
      return null;
    };
    // Star charts.
    g.fillStyle = `rgba(${INK},.4)`;
    g.strokeStyle = `rgba(${INK},.3)`;
    g.lineWidth = Math.max(0.4, 0.55 * u);
    for (let k = 0; k < 3; k++) {
      const p0 = land(0.08, 0.92);
      if (!p0) continue;
      let [px, py] = p0;
      const st = [[px, py]];
      for (let i = 0; i < 5 + Math.floor(rand() * 3); i++) {
        px += (rand() - 0.35) * ((26 + rand() * 18) * u + 10);
        py += (rand() - 0.5) * ((26 + rand() * 18) * u + 10);
        st.push([px, py]);
      }
      g.setLineDash([1.5 * u + 1, 3 * u + 2]);
      g.beginPath();
      polyPath(g, st);
      g.stroke();
      g.setLineDash([]);
      for (const [x, y] of st) {
        const r = (2.2 + rand() * 1.6) * u + 1.2;
        g.beginPath();
        g.moveTo(x, y - r);
        g.quadraticCurveTo(x + r * 0.15, y - r * 0.15, x + r, y);
        g.quadraticCurveTo(x + r * 0.15, y + r * 0.15, x, y + r);
        g.quadraticCurveTo(x - r * 0.15, y + r * 0.15, x - r, y);
        g.quadraticCurveTo(x - r * 0.15, y - r * 0.15, x, y - r);
        g.fill();
      }
    }
    // Treasure trail.
    const a0 = land(0.25, 0.45),
      a1 = land(0.55, 0.75);
    if (a0 && a1) {
      const ctrl = [a0];
      for (let k = 1; k < 4; k++) {
        const t0 = k / 4;
        ctrl.push([a0[0] + (a1[0] - a0[0]) * t0 + (rand() - 0.5) * H * 0.18, a0[1] + (a1[1] - a0[1]) * t0 + (rand() - 0.5) * H * 0.18]);
      }
      ctrl.push(a1);
      g.strokeStyle = `rgba(${INK},.38)`;
      g.lineWidth = Math.max(0.5, 0.8 * u);
      g.setLineDash([1.2 * u + 0.8, 4 * u + 3]);
      g.beginPath();
      polyPath(g, spline(ctrl, 12));
      g.stroke();
      g.setLineDash([]);
      const xs = 4 * u + 3;
      g.lineWidth = Math.max(0.8, 1.3 * u);
      g.strokeStyle = `rgba(150,40,25,.55)`;
      g.beginPath();
      g.moveTo(a1[0] - xs, a1[1] - xs);
      g.lineTo(a1[0] + xs, a1[1] + xs);
      g.moveTo(a1[0] + xs, a1[1] - xs);
      g.lineTo(a1[0] - xs, a1[1] + xs);
      g.stroke();
    }
  }
  g.restore();
  return { pitch, willow, shack, eyes };
}

/* ------------------------------------------------------------------ animated figures */
function owl(c, x, y, ang, s, t, a) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.globalAlpha = a;
  const fl = Math.sin(t * 11) * 0.9;
  c.fillStyle = `rgba(${INK},.88)`;
  for (const sd of [-1, 1]) {
    c.beginPath();
    c.moveTo(s * 0.1, sd * s * 0.25);
    c.quadraticCurveTo(-s * 0.2, sd * s * (1.1 + fl * 0.2), -s * 0.9, sd * s * (1.5 + fl * 0.9));
    c.quadraticCurveTo(-s * 0.5, sd * s * (0.6 + fl * 0.2), -s * 0.7, sd * s * 0.2);
    c.closePath();
    c.fill();
  }
  c.beginPath();
  c.ellipse(-s * 0.2, 0, s * 0.85, s * 0.34, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(s * 0.7, 0, s * 0.3, 0, TAU);
  c.fill();
  c.beginPath();
  c.moveTo(-s * 0.95, -s * 0.2);
  c.lineTo(-s * 1.5, 0);
  c.lineTo(-s * 0.95, s * 0.2);
  c.fill();
  c.restore();
}
function rider(c, x, y, dx, dy, s, col, t) {
  const dir = dx >= 0 ? 1 : -1;
  c.save();
  c.translate(x, y);
  c.scale(dir, 1);
  c.rotate(Math.atan2(dy, Math.abs(dx)) * 0.5);
  c.strokeStyle = `rgba(${INK},.9)`;
  c.lineWidth = Math.max(0.6, s * 0.22);
  c.beginPath();
  c.moveTo(-s * 1.1, 0);
  c.lineTo(s * 1.2, 0);
  c.stroke();
  c.fillStyle = `rgba(${INK},.8)`;
  c.beginPath();
  c.moveTo(-s * 1.1, 0);
  c.lineTo(-s * 1.9, -s * 0.3);
  c.lineTo(-s * 1.9, s * 0.3);
  c.closePath();
  c.fill();
  c.fillStyle = `rgba(${col},.92)`;
  c.beginPath();
  c.moveTo(s * 0.15, -s * 0.8);
  c.lineTo(-s * 1.1, -s * 0.5 + Math.sin(t * 14) * s * 0.12);
  c.lineTo(s * 0.0, -s * 0.15);
  c.closePath();
  c.fill();
  c.fillStyle = `rgba(${INK},.85)`;
  c.beginPath();
  c.arc(s * 0.35, -s * 0.95, s * 0.32, 0, TAU);
  c.fill();
  c.restore();
}
function stag(c, x, y, dir, s, t, a) {
  c.save();
  c.translate(x, y);
  c.scale(dir, 1);
  c.globalAlpha = a;
  c.fillStyle = 'rgba(246,252,255,.96)';
  c.strokeStyle = 'rgba(70,120,185,.9)';
  c.lineWidth = Math.max(0.6, s * 0.08);
  c.lineCap = 'round';
  c.shadowColor = 'rgba(150,205,255,1)';
  c.shadowBlur = s > 7 ? s * 1.8 : 0;
  c.beginPath();
  for (const [lx, ph] of [
    [-s * 0.9, 0],
    [-s * 0.6, Math.PI],
    [s * 0.7, Math.PI],
    [s * 1.0, 0]
  ]) {
    c.moveTo(lx, s * 0.1);
    c.lineTo(lx + Math.sin(t * 9 + ph) * s * 0.55, s * 1.1);
  }
  c.stroke();
  c.beginPath();
  c.ellipse(0, 0, s * 1.3, s * 0.52, 0, 0, TAU);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(s * 0.9, -s * 0.3);
  c.quadraticCurveTo(s * 1.4, -s * 0.9, s * 1.6, -s * 1.3);
  c.lineTo(s * 2.2, -s * 1.15);
  c.lineTo(s * 2.0, -s * 0.9);
  c.quadraticCurveTo(s * 1.5, -s * 0.55, s * 1.2, s * 0.05);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(s * 1.7, -s * 1.3);
  c.lineTo(s * 1.5, -s * 2.2);
  c.moveTo(s * 1.6, -s * 1.8);
  c.lineTo(s * 1.15, -s * 2.0);
  c.moveTo(s * 1.75, -s * 1.3);
  c.lineTo(s * 2.1, -s * 2.1);
  c.moveTo(s * 1.9, -s * 1.7);
  c.lineTo(s * 2.4, -s * 1.9);
  c.stroke();
  c.beginPath();
  c.moveTo(-s * 1.25, -s * 0.2);
  c.lineTo(-s * 1.7, -s * 0.5);
  c.lineTo(-s * 1.3, s * 0.05);
  c.stroke();
  c.restore();
}
function tentacle(c, x, y, seg, t, ph, rise, u) {
  let px = x,
    py = y,
    ang = -Math.PI / 2;
  const n = 14;
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const f = i / n;
    ang += Math.sin(t * 1.4 + i * 0.55 + ph) * 0.22 * (0.3 + f) + (f > 0.7 ? 0.28 : 0);
    const nx = px + Math.cos(ang) * seg * rise,
      ny = py + Math.sin(ang) * seg * rise;
    c.strokeStyle = `rgba(${INK},${0.85 * rise})`;
    c.lineWidth = Math.max(0.6, (1 - f) * 3.4 * u + 0.8);
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(nx, ny);
    c.stroke();
    if (i % 2 && f < 0.85) {
      c.fillStyle = `rgba(${INK},${0.6 * rise})`;
      c.beginPath();
      c.arc(px + Math.cos(ang + Math.PI / 2) * (2 * u + 1), py + Math.sin(ang + Math.PI / 2) * (2 * u + 1), 0.8 * u + 0.4, 0, TAU);
      c.fill();
    }
    px = nx;
    py = ny;
  }
}

/* ------------------------------------------------------------------ runtime */
function initMagic(s, w, h) {
  const { G, X, S, u } = s;
  s.walkers.forEach((wk, i) => (wk.name = HP.people[i % HP.people.length]));
  const home = X.pitch || { x: G.castle.x, y: G.castle.y - S * 4, rx: S * 3, ry: S * 2 };
  s.mg = {
    silver: sprite('185,225,255'),
    green: sprite('160,255,130'),
    pale: sprite('205,230,255'),
    owls: [],
    nextOwl: R(1.5, 4),
    snitch: { x: home.x, y: home.y, vx: 0, vy: 0, tx: home.x, ty: home.y, next: 0, trail: [], home },
    riders: X.pitch ? [0, 1, 2, 3].map(i => ({ ph: i * 1.57, v: 0.7 + i * 0.1, col: HOUSES[i] })) : [],
    ghosts: Math.min(w, h) < 500 ? [{ ph: 0 }] : [{ ph: 0 }, { ph: 2.4 }],
    stag: null,
    nextStag: R(10, 18),
    squid: { age: -1, next: R(4, 8), x: 0, y: 0, ph: 0 },
    wisps: Array.from({ length: clamp(Math.round((w * h) / 45000), 5, 18) }, () => ({
      bx: R(0, w),
      by: R(0, h),
      ax: R(20, 70) * u + 8,
      ay: R(15, 50) * u + 6,
      sx: R(0.15, 0.4),
      sy: R(0.2, 0.5),
      p: R(0, 6.28),
      green: Math.random() < 0.25
    }))
  };
}

function drawMagic(c, s, t, dt, m, w, h, ready, show) {
  const mg = s.mg,
    u = s.u,
    G = s.G,
    X = s.X,
    S = s.S,
    cs = G.castle;
  dt = Math.min(dt, 0.05);

  // The oath writes itself while the map is inking in.
  const dur = s.bloom.dur;
  if (s.age < dur) {
    const q = clamp(s.age / (dur * 0.7), 0, 1),
      al = s.age > dur * 0.75 ? 1 - (s.age - dur * 0.75) / (dur * 0.25) : 1;
    let size = clamp(w * 0.034, 15, 40);
    c.save();
    c.font = `italic ${size}px ${FONT}`;
    const tw0 = c.measureText(OATH).width;
    if (tw0 > w * 0.86) {
      size *= (w * 0.86) / tw0;
      c.font = `italic ${size}px ${FONT}`;
    }
    const tw = c.measureText(OATH).width,
      x0 = w / 2 - tw / 2,
      y = h * 0.5;
    c.globalAlpha = clamp(al, 0, 1);
    c.textBaseline = 'middle';
    c.save();
    c.beginPath();
    c.rect(x0 - 4, y - size, tw * q + 6, size * 2);
    c.clip();
    c.lineWidth = size * 0.2;
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(240,226,190,.7)';
    c.strokeText(OATH, x0, y);
    c.fillStyle = `rgba(${INK},.92)`;
    c.fillText(OATH, x0, y);
    c.restore();
    if (q < 1) glow(c, s.gold, x0 + tw * q, y + size * 0.1, size * 0.9, 0.8);
    c.restore();
  }
  if (show <= 0) return;

  // Whomping-willow branches, with a periodic fit of rage.
  if (X.willow) {
    const wl = X.willow,
      cx = wl.x,
      cy = wl.y - wl.s * 2.2,
      thrash = Math.pow(Math.max(0, Math.sin(t * 0.35)), 4);
    c.save();
    c.globalAlpha = show;
    c.strokeStyle = `rgba(${INK},.85)`;
    c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * (0.12 + i * 0.125) + Math.sin(t * (1.1 + i * 0.23) + i * 2) * (0.18 + 0.5 * thrash),
        L = wl.s * (2.1 + (i % 3) * 0.45),
        ex = cx + Math.cos(a) * L,
        ey = cy + Math.sin(a) * L;
      c.lineWidth = Math.max(0.7, 2 * u * (1 - i * 0.05));
      c.beginPath();
      c.moveTo(cx, cy);
      c.quadraticCurveTo(cx + Math.cos(a - 0.45) * L * 0.55, cy + Math.sin(a - 0.45) * L * 0.55, ex, ey);
      c.stroke();
      c.lineWidth = Math.max(0.5, u * 0.8);
      c.beginPath();
      c.moveTo(ex, ey);
      c.lineTo(ex + Math.cos(a + 0.7) * L * 0.25, ey + Math.sin(a + 0.7) * L * 0.25);
      c.moveTo(ex, ey);
      c.lineTo(ex + Math.cos(a - 0.5) * L * 0.22, ey + Math.sin(a - 0.5) * L * 0.22);
      c.stroke();
    }
    c.restore();
  }

  // Eyes blinking open in the forest, and a green flicker from the shack.
  for (const e of X.eyes) {
    const al = Math.pow(Math.max(0, Math.sin(t * 0.4 + e.ph * 5)), 40);
    if (al > 0.02) {
      glow(c, mg.green, e.x - e.sp, e.y, 2.6 * u + 1.6, al * 0.9 * show);
      glow(c, mg.green, e.x + e.sp, e.y, 2.6 * u + 1.6, al * 0.9 * show);
    }
  }
  if (X.shack)
    glow(c, mg.green, X.shack.x - S * 0.3, X.shack.y - S * 0.5, S * 1.1, (0.2 + 0.25 * Math.max(0, Math.sin(t * 2.1))) * show);

  // Floating candles circling above the castle.
  const nC = Math.min(w, h) < 500 ? 5 : 8;
  for (let k = 0; k < nC; k++) {
    const a = t * 0.25 + (k * TAU) / nC,
      sc = 0.8 + 0.2 * Math.sin(a),
      x = cs.x + Math.cos(a) * S * 5.2,
      y = cs.y - S * 2.6 + Math.sin(a) * S * 1.6 + Math.sin(t * 1.3 + k) * S * 0.2,
      cw = S * 0.2 * sc,
      ch = S * 0.65 * sc;
    c.fillStyle = `rgba(244,232,200,${0.95 * show})`;
    c.strokeStyle = `rgba(${INK},${0.8 * show})`;
    c.lineWidth = Math.max(0.5, 0.7 * u);
    c.beginPath();
    c.rect(x - cw / 2, y, cw, ch);
    c.fill();
    c.stroke();
    glow(c, s.gold, x, y - S * 0.2, S * 0.9 * sc, (0.5 + 0.25 * Math.sin(t * 9 + k * 2)) * (0.6 + m.dark * 0.6) * show);
    c.fillStyle = `rgba(255,215,120,${0.95 * show})`;
    c.beginPath();
    c.ellipse(x, y - S * 0.17 * sc, S * 0.09 * sc, S * 0.2 * sc, 0, 0, TAU);
    c.fill();
  }

  // Little lights drifting over the whole map, including behind the text.
  for (const q of mg.wisps) {
    const x = q.bx + Math.sin(t * q.sx + q.p) * q.ax,
      y = q.by + Math.sin(t * q.sy + q.p * 2) * q.ay;
    glow(c, q.green ? mg.green : s.gold, x, y, 4 * u + 2.5, (0.25 + 0.25 * Math.sin(t * 1.7 + q.p)) * (0.6 + m.dark * 0.6) * show);
  }

  // Ghosts drifting through the grounds.
  for (const gh of mg.ghosts) {
    const a = t * 0.22 + gh.ph,
      x = cs.x + Math.cos(a) * S * 7,
      y = cs.y - S * 1.5 + Math.sin(t * 0.35 + gh.ph * 2) * S * 2.6,
      dir = Math.sin(a) > 0 ? -1 : 1,
      al = (0.55 + 0.25 * Math.sin(t * 0.8 + gh.ph)) * show,
      sz = S * 0.9,
      hem = y + sz * 1.1;
    glow(c, mg.pale, x, y, S * 2.4, al * 0.5);
    c.beginPath();
    c.arc(x, y - sz * 0.4, sz * 0.5, Math.PI, 0);
    for (let k = 0; k <= 8; k++) c.lineTo(x + sz * 0.5 - (k / 8) * sz, hem + Math.sin(t * 3 + k * 1.4 + gh.ph) * sz * 0.12);
    c.closePath();
    c.fillStyle = `rgba(228,240,255,${0.55 * al})`;
    c.strokeStyle = `rgba(100,140,190,${0.55 * al})`;
    c.lineWidth = Math.max(0.5, 0.7 * u);
    c.fill();
    c.stroke();
    c.fillStyle = `rgba(60,80,110,${0.8 * al})`;
    for (const ex of [0.1, 0.32]) {
      c.beginPath();
      c.arc(x + dir * sz * ex, y - sz * 0.45, sz * 0.07, 0, TAU);
      c.fill();
    }
    c.beginPath();
    c.ellipse(x + dir * sz * 0.22, y - sz * 0.2, sz * 0.07, sz * 0.12, 0, 0, TAU);
    c.fill();
  }

  // Owls flying out from the castle to the villages.
  if (ready) {
    mg.nextOwl -= dt;
    const dests = G.places.filter(p => p.kind !== 'castle' && p.kind !== 'circle');
    if (mg.nextOwl <= 0 && mg.owls.length < 3 && dests.length) {
      const far = [...dests].sort((a, b) => Math.hypot(b.x - cs.x, b.y - cs.y) - Math.hypot(a.x - cs.x, a.y - cs.y)),
        d = far[Math.floor(Math.random() * Math.min(2, far.length))],
        sx = cs.x,
        sy = cs.y - S * 4.5,
        dist = Math.hypot(d.x - sx, d.y - S - sy) || 1;
      mg.owls.push({
        sx,
        sy,
        dx: d.x,
        dy: d.y - S,
        dist,
        k: 0,
        dur: dist / (34 * u + 14),
        amp: R(0.05, 0.14) * dist * (Math.random() < 0.5 ? 1 : -1),
        ph: R(0, 6)
      });
      mg.nextOwl = R(5, 11);
    }
  }
  for (let i = mg.owls.length - 1; i >= 0; i--) {
    const o = mg.owls[i];
    o.k += dt / o.dur;
    if (o.k >= 1) {
      mg.owls.splice(i, 1);
      continue;
    }
    const pos = k => {
      const off = Math.sin(k * Math.PI) * o.amp;
      return [
        o.sx + (o.dx - o.sx) * k - ((o.dy - o.sy) / o.dist) * off,
        o.sy + (o.dy - o.sy) * k + ((o.dx - o.sx) / o.dist) * off - Math.sin(k * 20 + o.ph) * u * 1.5
      ];
    };
    const [x, y] = pos(o.k),
      [x1, y1] = pos(o.k + 0.01);
    const al = o.k < 0.08 ? o.k / 0.08 : o.k > 0.92 ? (1 - o.k) / 0.08 : 1;
    glow(c, s.gold, x, y, 8 * u + 3, 0.2 * al);
    owl(c, x, y, Math.atan2(y1 - y, x1 - x), 4.5 * u + 2.5, t + o.ph, al);
  }

  // Broom riders in house colours circling the pitch, and a darting Golden Snitch.
  if (X.pitch)
    for (const r of mg.riders) {
      const a = t * r.v + r.ph,
        P = X.pitch;
      rider(
        c,
        P.x + Math.cos(a) * P.rx * 0.8,
        P.y + Math.sin(a) * P.ry * 0.8 - 2 * u,
        -Math.sin(a) * P.rx * r.v,
        Math.cos(a) * P.ry * r.v,
        3.2 * u + 2,
        r.col,
        t
      );
    }
  const sn = mg.snitch;
  sn.next -= dt;
  if (sn.next <= 0) {
    const a = R(0, TAU),
      r = R(0.4, 1) * (sn.home.rx * 1.8 + S * 2);
    sn.tx = sn.home.x + Math.cos(a) * r * 1.3;
    sn.ty = sn.home.y + Math.sin(a) * r * 0.8 - S;
    sn.next = R(0.35, 1.1);
  }
  sn.vx += ((sn.tx - sn.x) * 14 - sn.vx * 4.5) * dt;
  sn.vy += ((sn.ty - sn.y) * 14 - sn.vy * 4.5) * dt;
  sn.x += sn.vx * dt;
  sn.y += sn.vy * dt;
  if (dt > 0) sn.trail.push({ x: sn.x, y: sn.y, age: 0 });
  for (let i = sn.trail.length - 1; i >= 0; i--) {
    const q = sn.trail[i];
    q.age += dt;
    if (q.age > 0.6) {
      sn.trail.splice(i, 1);
      continue;
    }
    glow(c, s.gold, q.x, q.y, (3 * u + 1.5) * (1 - q.age / 0.6), 0.5 * (1 - q.age / 0.6) * show);
  }
  {
    const sz = 2.6 * u + 1.6,
      fl = Math.sin(t * 45);
    glow(c, s.gold, sn.x, sn.y, 9 * u + 4, 0.8 * show);
    c.fillStyle = 'rgba(255,246,210,.9)';
    c.strokeStyle = `rgba(${INK},.6)`;
    c.lineWidth = 0.6;
    for (const sd of [-1, 1]) {
      c.beginPath();
      c.ellipse(sn.x + sd * sz * 0.9, sn.y - sz * 0.3, sz, sz * 0.28, sd * (0.4 + fl * 0.5), 0, TAU);
      c.fill();
      c.stroke();
    }
    c.fillStyle = 'rgb(214,160,40)';
    c.beginPath();
    c.arc(sn.x, sn.y, sz * 0.45, 0, TAU);
    c.fill();
    c.stroke();
  }

  // A silver stag runs along a road now and then.
  if (ready) {
    mg.nextStag -= dt;
    if (!mg.stag && mg.nextStag <= 0 && G.roads.length) {
      const r = G.roads[Math.floor(Math.random() * G.roads.length)],
        dir = Math.random() < 0.5 ? 1 : -1;
      mg.stag = { path: r.path, d: dir > 0 ? 0 : r.path.total, dir, trail: [] };
    }
    const st = mg.stag;
    if (st) {
      st.d += st.dir * dt * (60 * u + 25);
      if (st.d < 0 || st.d > st.path.total) {
        mg.stag = null;
        mg.nextStag = R(18, 30);
      } else {
        const [x, y, ang] = along(st.path, st.d),
          face = st.dir > 0 ? ang : ang + Math.PI,
          a = clamp(Math.min(st.d, st.path.total - st.d) / 40, 0, 1);
        if (dt > 0) st.trail.push({ x, y: y - 4 * u, age: 0 });
        for (let i = st.trail.length - 1; i >= 0; i--) {
          const q = st.trail[i];
          q.age += dt;
          if (q.age > 1.6) {
            st.trail.splice(i, 1);
            continue;
          }
          glow(c, mg.silver, q.x, q.y, (6 * u + 3) * (1 - q.age / 1.6), 0.5 * (1 - q.age / 1.6) * a);
        }
        glow(c, mg.silver, x, y - 5 * u, 22 * u + 8, 0.7 * a);
        stag(c, x, y - 5 * u, Math.cos(face) >= 0 ? 1 : -1, 5 * u + 3, t, a);
      }
    }
  }

  // The lake's giant squid waves a tentacle.
  const sq = mg.squid;
  if (ready && sq.age < 0 && (sq.next -= dt) <= 0) {
    const a = R(0.15, 0.85);
    [sq.x, sq.y] = G.P(a, G.coastB(a) * R(0.3, 0.5));
    sq.age = 0;
    sq.ph = R(0, 6);
  }
  if (sq.age >= 0) {
    sq.age += dt;
    const k = sq.age / 10;
    if (k >= 1) {
      sq.age = -1;
      sq.next = R(10, 18);
    } else {
      const rise = Math.pow(Math.sin(Math.PI * k), 0.7);
      c.save();
      c.strokeStyle = `rgba(${INK},${0.4 * rise})`;
      c.lineWidth = Math.max(0.5, 0.7 * u);
      for (let r = 1; r <= 2; r++) {
        c.beginPath();
        c.ellipse(sq.x, sq.y + 2 * u, (r * 5 + k * 6) * u, (r * 1.8 + k * 2) * u, 0, 0, TAU);
        c.stroke();
      }
      tentacle(c, sq.x - S * 0.8, sq.y, S * 0.55, t, sq.ph, rise, u);
      tentacle(c, sq.x + S * 0.9, sq.y, S * 0.44, t, sq.ph + 2, rise, u);
      c.restore();
    }
  }

  // Marauder's-Map style names beside each pair of footprints.
  if (ready) {
    c.save();
    c.font = `italic ${clamp(9 * u + 3.5, 8.5, 13)}px ${FONT}`;
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 3;
    c.globalAlpha = show;
    for (const wk of s.walkers) {
      if (!wk.name || (!wk.x && !wk.y)) continue;
      const right = wk.x < w * 0.8;
      c.textAlign = right ? 'left' : 'right';
      const x = wk.x + (right ? 1 : -1) * (9 * u + 4),
        y = wk.y - 8 * u - 3;
      c.strokeStyle = 'rgba(240,226,190,.75)';
      c.strokeText(wk.name, x, y);
      c.fillStyle = `rgba(${INK},.8)`;
      c.fillText(wk.name, x, y);
    }
    c.restore();
  }
}

Object.assign(NAMES, HP.names);


/* ------------------------------------------------------------------ helpers */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Smooth 1-D noise in roughly [-1, 1]. */
function noise1(rand) {
  const v = Array.from({ length: 64 }, () => rand() * 2 - 1);
  return x => {
    const i = Math.floor(x),
      f = x - i,
      s = f * f * (3 - 2 * f);
    const a = v[((i % 64) + 64) % 64],
      b = v[(((i + 1) % 64) + 64) % 64];
    return a + (b - a) * s;
  };
}
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
/** A smooth curve through the points (Catmull-Rom). */
function spline(pts, n = 10) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n,
        t2 = t * t,
        t3 = t2 * t;
      out.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
/** A polyline with cumulative lengths, so things can travel along it. */
function measure(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, total: cum[cum.length - 1] };
}
/** Point and heading at distance d along a measured path. */
function along(path, d) {
  const { pts, cum } = path;
  d = clamp(d, 0, path.total);
  let lo = 0,
    hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1,
    f = (d - cum[lo]) / seg;
  const [x0, y0] = pts[lo],
    [x1, y1] = pts[hi];
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, Math.atan2(y1 - y0, x1 - x0)];
}
function polyPath(g, pts, from = 0, to = pts.length) {
  g.moveTo(pts[from][0], pts[from][1]);
  for (let i = from + 1; i < to; i++) g.lineTo(pts[i][0], pts[i][1]);
}
function segHit(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]],
    s = [d[0] - c[0], d[1] - c[1]],
    den = r[0] * s[1] - r[1] * s[0];
  if (!den) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den,
    u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + r[0] * t, a[1] + r[1] * t] : null;
}
const near = (pts, x, y, dist) =>
  pts.some(
    p => Math.abs(p[0] - x) < dist && Math.abs(p[1] - y) < dist && Math.hypot(p[0] - x, p[1] - y) < dist
  );

/* ------------------------------------------------------------------ parchment */
function paintParchment(w, h) {
  const bg = mk(w, h),
    g = bg.getContext('2d');
  const gr = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.hypot(w, h) * 0.62);
  gr.addColorStop(0, '#f3e4c0');
  gr.addColorStop(0.55, '#e1c893');
  gr.addColorStop(1, '#8e6334');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) {
    const x = R(0, w),
      y = R(0, h),
      r = R(40, 280),
      s = g.createRadialGradient(x, y, 0, x, y, r);
    s.addColorStop(0, `rgba(125,85,35,${R(0.06, 0.14)})`);
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
  // Fold creases from years in a coat pocket.
  g.lineWidth = 1;
  for (const [x0, y0, x1, y1] of [
    [w / 3, 0, w / 3, h],
    [(2 * w) / 3, 0, (2 * w) / 3, h],
    [0, h / 2, w, h / 2]
  ]) {
    g.strokeStyle = 'rgba(90,60,25,.1)';
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.strokeStyle = 'rgba(255,248,225,.14)';
    g.beginPath();
    g.moveTo(x0 + 1.5, y0 + 1.5);
    g.lineTo(x1 + 1.5, y1 + 1.5);
    g.stroke();
  }
  return bg;
}

/* ------------------------------------------------------------------ geography */
// Everything is placed in (a, b) space: `a` runs along the coast (0 to 1) and `b` runs
// inland from the sea (0) to the mountains (1). Wide screens put the sea on the left,
// tall screens put it at the bottom, so the same map design works on both.
// In the full-screen reader on a wide screen, the text column covers the middle of the page,
// so the map is laid out around it: sea, harbour and compass in the left margin; castle,
// tower, villages and mountains in the right one. Matches `.pages { max-width: 44rem }`.
const READING_COLUMN = 704;

function geography(w, h, u, rand, full) {
  const wide = w >= h * 0.9;
  const gut = full && wide ? (w - Math.min(READING_COLUMN, w)) / 2 : 0;
  const framed = gut >= 140; // margins wide enough to hold the map's main places
  const P = wide ? (a, b) => [b * w, a * h] : (a, b) => [a * w, h - b * h];
  const AB = wide ? (x, y) => [y / h, x / w] : (x, y) => [x / w, (h - y) / h];
  const n1 = noise1(rand),
    n2 = noise1(rand),
    n3 = noise1(rand);
  const off = rand() * 40;
  const coastBase = framed ? clamp((gut * 0.55) / w, 0.07, 0.2) : wide ? 0.2 : 0.17;
  const wob = framed ? Math.min(0.045, coastBase * 0.22) : 0.045;
  const coastB = a => coastBase + wob * n1(off + a * 4) + wob * 0.45 * n2(off + a * 13);
  // Where the mountains begin, and the bands of land that stay visible beside the text.
  const mtnB = framed ? 1 - Math.max(0.05, (gut * 0.3) / w) : 0.8;
  const rightZone = framed ? [1 - (gut - 20) / w, mtnB - 0.025] : null;
  const leftZone = framed ? [coastBase + wob + 0.035, (gut - 20) / w] : null;
  const minD = Math.min(w, h);

  // Coastline, sampled densely.
  const coast = [];
  for (let a = -0.02; a <= 1.02; a += 0.004) coast.push(P(a, coastB(a)));

  // The river rises in the mountains and meanders down to the sea.
  const river = [],
    riverAB = [];
  let a = 0.35 + rand() * 0.3,
    b = framed ? mtnB + 0.01 : 0.9;
  while (b > coastB(a) - 0.012) {
    river.push(P(a, b));
    riverAB.push([a, b]);
    b -= 0.01;
    a = clamp(a + n3(off + b * 7) * 0.016 + (rand() - 0.5) * 0.004 + (0.5 - a) * 0.02, 0.2, 0.8);
  }
  river.push(P(a, coastB(a) - 0.02));
  riverAB.push([a, coastB(a) - 0.02]);
  // A smaller tributary joins it from the hills.
  const trib = [];
  {
    let ta = a < 0.5 ? 0.8 : 0.2,
      tb = 0.82;
    const step = a < 0.5 ? -0.012 : 0.012;
    for (let k = 0; k < 120; k++) {
      const p = P(ta, tb);
      trib.push(p);
      if (near(river, p[0], p[1], 5 * u + 2)) break;
      ta += step * (0.7 + 0.5 * rand());
      tb -= 0.008 + 0.006 * n2(k * 0.3);
      if (tb < 0.35) break;
    }
  }

  // Places, kept apart from each other, the river and the coast.
  const places = [];
  const free = (x, y, d) =>
    !places.some(p => Math.hypot(p.x - x, p.y - y) < d) &&
    !near(river, x, y, d * 0.45) &&
    !near(trib, x, y, d * 0.35);
  const place = (kind, bMin, bMax, sep, tries = 80) => {
    for (let k = 0; k < tries; k++) {
      const pa = 0.15 + rand() * 0.7,
        pb = Math.max(coastB(pa) + (framed ? 0.03 : 0.07), bMin + rand() * (bMax - bMin));
      if (pb > bMax + (framed ? 0.005 : 0.05)) continue;
      const [x, y] = P(pa, pb);
      if (free(x, y, sep)) {
        const p = { kind, x, y, a: pa, b: pb };
        places.push(p);
        return p;
      }
    }
    return null;
  };
  // The castle sits on a hill beside the river.
  const castleB = framed ? (rightZone[0] + rightZone[1]) / 2 : 0;
  const mid = framed
    ? riverAB.reduce((best, q) => (Math.abs(q[1] - castleB) < Math.abs(best[1] - castleB) ? q : best))
    : riverAB[Math.floor(riverAB.length * (0.45 + rand() * 0.15))];
  const side = mid[0] < 0.5 ? 1 : -1;
  const [cx, cy] = P(clamp(mid[0] + side * (framed ? 0.16 : 0.12), 0.12, 0.88), framed ? castleB : mid[1]);
  const castle = { kind: 'castle', x: cx, y: cy };
  places.push(castle);
  const pa = clamp(a + (a < 0.5 ? 0.22 : -0.22), 0.16, 0.84);
  const [px, py] = P(pa, coastB(pa) + 0.03);
  const port = { kind: 'port', x: px, y: py, a: pa };
  places.push(port);
  let tower, circle;
  if (framed) {
    const sep = minD * 0.16,
      leftOk = leftZone[1] - leftZone[0] > 0.02;
    tower = place('tower', rightZone[1] - 0.02, rightZone[1], sep, 150);
    for (let k = 0; k < 4; k++) {
      const z = k % 2 && leftOk ? leftZone : rightZone;
      place('village', z[0], z[1], sep, 150);
    }
    circle = place('circle', ...(leftOk ? leftZone : rightZone), sep * 0.8, 150);
  } else {
    tower = place('tower', 0.7, 0.76, minD * 0.2);
    const villageCount = minD > 500 ? 4 : 3;
    for (let k = 0; k < villageCount; k++) place('village', 0.3, 0.68, minD * 0.2);
    circle = place('circle', 0.35, 0.7, minD * 0.17);
  }

  // Roads: a minimum spanning tree between places, plus one extra loop, each a gentle curve.
  const nodes = places.filter(p => p.kind !== 'circle');
  const edges = [];
  const inTree = new Set([nodes[0]]);
  while (inTree.size < nodes.length) {
    let best = null;
    for (const p of inTree)
      for (const q of nodes)
        if (!inTree.has(q)) {
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (!best || d < best[2]) best = [p, q, d];
        }
    edges.push(best);
    inTree.add(best[1]);
  }
  let extra = null;
  for (const p of nodes)
    for (const q of nodes)
      if (p !== q && !edges.some(([x, y]) => (x === p && y === q) || (x === q && y === p))) {
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (!extra || d < extra[2]) extra = [p, q, d];
      }
  if (extra) edges.push(extra);
  const roads = edges.map(([p, q]) => {
    const dx = q.x - p.x,
      dy = q.y - p.y,
      len = Math.hypot(dx, dy),
      nx = -dy / len,
      ny = dx / len;
    const bend = (rand() - 0.5) * 0.35;
    const ctrl = [[p.x, p.y]];
    for (let k = 1; k < 4; k++) {
      const t = k / 4,
        o = len * (bend * Math.sin(Math.PI * t) + (rand() - 0.5) * 0.08);
      let x = p.x + dx * t + nx * o,
        y = p.y + dy * t + ny * o;
      const [ca, cb] = AB(x, y);
      if (cb < coastB(ca) + 0.02) [x, y] = P(ca, coastB(ca) + 0.02); // keep roads on land
      ctrl.push([x, y]);
    }
    ctrl.push([q.x, q.y]);
    return { from: p, to: q, path: measure(spline(ctrl, 14)) };
  });
  // Bridges where roads cross water.
  const bridges = [];
  for (const r of roads)
    for (const water of [river, trib])
      for (let i = 1; i < r.path.pts.length; i++) {
        let hit = null;
        for (let j = 1; j < water.length && !hit; j++)
          hit = segHit(r.path.pts[i - 1], r.path.pts[i], water[j - 1], water[j]);
        if (hit) {
          const [x0, y0] = r.path.pts[i - 1],
            [x1, y1] = r.path.pts[i];
          bridges.push({ x: hit[0], y: hit[1], ang: Math.atan2(y1 - y0, x1 - x0) });
          break;
        }
      }

  return {
    framed,
    mtnB,
    zones: framed ? [leftZone, rightZone].filter(z => z[1] - z[0] > 0.02) : null,
    wide,
    P,
    AB,
    coastB,
    coast,
    river,
    trib,
    places,
    castle,
    port,
    tower,
    circle,
    roads,
    bridges,
    n1,
    n2
  };
}

/* ------------------------------------------------------------------ map symbols */
/** Fills the current path with bare parchment, hiding any ink drawn under it (the ink layer sits on the parchment). */
function hide(g) {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.fill();
  g.restore();
}
function mountain(g, x, y, wd, ht, u, lean) {
  const px = x + lean * wd * 0.15;
  g.beginPath();
  g.moveTo(x - wd / 2, y);
  g.quadraticCurveTo(x - wd * 0.2, y - ht * 0.55, px, y - ht);
  g.quadraticCurveTo(x + wd * 0.18, y - ht * 0.5, x + wd / 2, y);
  hide(g);
  g.stroke();
  // Hatching on the shadowed slope.
  g.save();
  g.clip();
  g.lineWidth = Math.max(0.5, 0.6 * u);
  g.beginPath();
  for (let k = 1; k < 9; k++) {
    const t = k / 9,
      sx = px + (x + wd / 2 - px) * t,
      sy = y - ht + ht * t;
    g.moveTo(sx, sy);
    g.lineTo(sx - wd * 0.12, sy + ht * 0.28);
  }
  g.stroke();
  g.restore();
  // A snowcap line.
  g.beginPath();
  g.moveTo(px - wd * 0.12, y - ht * 0.72);
  g.lineTo(px - wd * 0.04, y - ht * 0.66);
  g.lineTo(px + wd * 0.03, y - ht * 0.74);
  g.lineTo(px + wd * 0.1, y - ht * 0.68);
  g.stroke();
}
function hill(g, x, y, r, u) {
  g.beginPath();
  g.ellipse(x, y, r, r * 0.55, 0, Math.PI, TAU);
  g.stroke();
  g.lineWidth = Math.max(0.4, 0.55 * u);
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = Math.PI * (1.55 + k * 0.08),
      sx = x + Math.cos(a) * r,
      sy = y + Math.sin(a) * r * 0.55;
    g.moveTo(sx, sy);
    g.lineTo(sx + r * 0.12, sy + r * 0.28);
  }
  g.stroke();
}
function broadleaf(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - s * 0.7);
  g.stroke();
  g.beginPath();
  g.arc(x - s * 0.35, y - s * 0.95, s * 0.42, Math.PI * 0.6, Math.PI * 1.6);
  g.arc(x, y - s * 1.4, s * 0.45, Math.PI * 1.1, Math.PI * 1.9);
  g.arc(x + s * 0.38, y - s * 0.95, s * 0.42, Math.PI * 1.4, Math.PI * 0.4);
  g.quadraticCurveTo(
    x,
    y - s * 0.45,
    x - s * 0.35 - s * 0.42 * Math.cos(Math.PI * 0.6),
    y - s * 0.95 + s * 0.42 * Math.sin(Math.PI * 0.6)
  );
  hide(g);
  g.stroke();
  g.beginPath();
  g.moveTo(x + s * 0.3, y - s * 1.1);
  g.lineTo(x + s * 0.5, y - s * 0.85);
  g.moveTo(x + s * 0.12, y - s * 0.85);
  g.lineTo(x + s * 0.3, y - s * 0.66);
  g.stroke();
}
function conifer(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - s * 1.8);
  g.lineTo(x + s * 0.45, y - s * 0.3);
  g.lineTo(x + s * 0.12, y - s * 0.3);
  g.lineTo(x + s * 0.12, y);
  g.lineTo(x - s * 0.12, y);
  g.lineTo(x - s * 0.12, y - s * 0.3);
  g.lineTo(x - s * 0.45, y - s * 0.3);
  g.closePath();
  hide(g);
  g.stroke();
  g.beginPath();
  for (let k = 0; k < 3; k++) {
    const yy = y - s * (0.55 + k * 0.4);
    g.moveTo(x, yy - s * 0.2);
    g.lineTo(x + s * (0.3 - k * 0.07), yy + s * 0.05);
  }
  g.stroke();
}
function house(g, x, y, s, church) {
  const wd = s * (church ? 1.1 : 1),
    ht = s * 0.7;
  g.beginPath();
  g.rect(x - wd / 2, y - ht, wd, ht);
  hide(g);
  g.stroke();
  g.beginPath();
  g.moveTo(x - wd / 2 - s * 0.12, y - ht);
  g.lineTo(x, y - ht - s * 0.55);
  g.lineTo(x + wd / 2 + s * 0.12, y - ht);
  g.closePath();
  g.fillStyle = `rgba(${INK},.22)`;
  g.fill();
  g.stroke();
  g.beginPath();
  g.rect(x - s * 0.1, y - ht * 0.55, s * 0.2, ht * 0.55);
  g.stroke();
  if (church) {
    g.beginPath();
    g.rect(x + wd / 2 - s * 0.05, y - ht - s * 0.9, s * 0.35, ht + s * 0.9);
    hide(g);
    g.stroke();
    g.beginPath();
    g.moveTo(x + wd / 2 - s * 0.1, y - ht - s * 0.9);
    g.lineTo(x + wd / 2 + s * 0.125, y - ht - s * 1.7);
    g.lineTo(x + wd / 2 + s * 0.35, y - ht - s * 0.9);
    g.stroke();
  }
  return [x + wd * 0.25, y - ht - s * 0.3]; // chimney
}
/**
 * Draws a label at the first of `spots` where it doesn't overlap an earlier label.
 * Optional labels are skipped when every spot is taken; others use the first spot anyway.
 */
function label(g, text, x, y, size, opts = {}, taken = null, spots = []) {
  if (taken) {
    g.save();
    g.font = `${opts.italic === false ? '' : 'italic '}${size}px "EB Garamond", "Cormorant Garamond", Georgia, serif`;
    const tw = g.measureText(opts.spaced ? text.split('').join(' ') : text).width,
      th = size * 1.2;
    g.restore();
    const cos = Math.abs(Math.cos(opts.rot || 0)),
      sin = Math.abs(Math.sin(opts.rot || 0));
    const bw = tw * cos + th * sin,
      bh = tw * sin + th * cos;
    const fits = ([px, py]) =>
      !taken.some(b => Math.abs(b[0] - px) * 2 < b[2] + bw && Math.abs(b[1] - py) * 2 < b[3] + bh);
    const spot = [[x, y], ...spots].find(fits);
    if (!spot && opts.optional) return;
    [x, y] = spot || [x, y];
    taken.push([x, y, bw + 4, bh]);
  }
  g.save();
  g.font = `${opts.italic === false ? '' : 'italic '}${size}px "EB Garamond", "Cormorant Garamond", Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (opts.spaced) text = text.toUpperCase().split('').join(String.fromCharCode(8202));
  g.lineWidth = size * 0.28;
  g.strokeStyle = 'rgba(240,226,190,.75)';
  g.lineJoin = 'round';
  if (opts.rot) {
    g.translate(x, y);
    g.rotate(opts.rot);
    x = y = 0;
  }
  g.strokeText(text, x, y);
  g.fillStyle = `rgba(${INK},.82)`;
  g.fillText(text, x, y);
  g.restore();
}

/** Largest font size (up to `max`) at which the text fits in `width`. */
function fitSize(g, text, width, max) {
  g.save();
  g.font = `italic ${max}px "EB Garamond", "Cormorant Garamond", Georgia, serif`;
  const tw = g.measureText(text).width;
  g.restore();
  return tw > width ? Math.max(6, (max * width) / tw) : max;
}

/* ------------------------------------------------------------------ drawing the map */
function drawMap(w, h, u, G, rand) {
  const ink = mk(w, h),
    g = ink.getContext('2d');
  const minD = Math.min(w, h),
    lw = Math.max(0.6, 1.05 * u),
    labels = u >= 0.4;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = `rgba(${INK},.78)`;
  g.lineWidth = lw;
  const { P, coastB } = G;
  const flags = [],
    chimneys = [],
    lights = [];

  // Compass and cartouche positions, both out at sea.
  const seaMid = a => coastB(a) * 0.46;
  const compass = G.wide
    ? { x: seaMid(0.8) * w, y: h * 0.8, r: clamp(coastB(0.8) * w * 0.34, 18, 90 * u + 20) }
    : { x: w * 0.18, y: h - seaMid(0.18) * h, r: clamp(coastB(0.18) * h * 0.34, 18, 90 * u + 20) };

  const f = 10 * u + 4,
    gap = 6 * u + 3;
  // Everything but the border stays inside the frame.
  g.save();
  g.beginPath();
  g.rect(f + gap, f + gap, w - 2 * (f + gap), h - 2 * (f + gap));
  g.clip();

  // 1. Rhumb lines radiating from the compass across the whole map.
  g.save();
  g.strokeStyle = `rgba(${INK},.1)`;
  g.lineWidth = Math.max(0.4, 0.5 * u);
  g.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k * TAU) / 16;
    g.moveTo(compass.x, compass.y);
    g.lineTo(compass.x + Math.cos(a) * Math.hypot(w, h), compass.y + Math.sin(a) * Math.hypot(w, h));
  }
  g.stroke();
  g.restore();

  // 2. The sea: a faint wash, the coastline, and echoing contour lines.
  const seaPoly = G.wide ? [[-5, -5], ...G.coast, [-5, h + 5]] : [[-5, h + 5], ...G.coast, [w + 5, h + 5]];
  g.fillStyle = `rgba(${INK},.05)`;
  g.beginPath();
  polyPath(g, seaPoly);
  g.closePath();
  g.fill();
  for (let k = 5; k >= 1; k--) {
    const d = (k * 5.5 * u + 2) / (G.wide ? w : h);
    g.strokeStyle = `rgba(${INK},${0.34 - k * 0.05})`;
    g.lineWidth = Math.max(0.4, 0.6 * u);
    g.setLineDash(k > 2 ? [2 * u + 1, (k - 1) * 2.5 * u + 1] : []);
    g.beginPath();
    let first = true;
    for (let a = -0.02; a <= 1.02; a += 0.004) {
      const [x, y] = P(a, coastB(a) - d);
      first ? g.moveTo(x, y) : g.lineTo(x, y);
      first = false;
    }
    g.stroke();
  }
  g.setLineDash([]);
  g.strokeStyle = `rgba(${INK},.85)`;
  g.lineWidth = lw * 1.6;
  g.beginPath();
  polyPath(g, G.coast);
  g.stroke();
  // Wave marks scattered across open water.
  g.lineWidth = Math.max(0.5, 0.7 * u);
  g.strokeStyle = `rgba(${INK},.45)`;
  const waves = [];
  for (let k = 0; k < 120 && waves.length < 22 * Math.max(0.6, u); k++) {
    const a = rand(),
      b = coastB(a) * (0.12 + rand() * 0.62);
    const [x, y] = P(a, b);
    if (Math.hypot(x - compass.x, y - compass.y) < compass.r * 1.5) continue;
    if (waves.some(q => Math.hypot(q[0] - x, q[1] - y) < 26 * u + 6)) continue;
    waves.push([x, y]);
    const s = (5 + rand() * 3) * u + 2;
    g.beginPath();
    g.moveTo(x - s, y);
    g.quadraticCurveTo(x - s / 2, y - s * 0.6, x, y);
    g.quadraticCurveTo(x + s / 2, y - s * 0.6, x + s, y);
    g.moveTo(x - s * 0.5, y + s * 0.5);
    g.quadraticCurveTo(x, y + s * 0.1, x + s * 0.5, y + s * 0.5);
    g.stroke();
  }

  // 3. Hills, hatched on their shadowed side.
  g.strokeStyle = `rgba(${INK},.6)`;
  for (let k = 0; k < 60; k++) {
    const a = 0.05 + rand() * 0.9,
      b = coastB(a) + 0.1 + rand() * 0.55;
    const [x, y] = P(a, b);
    if (G.places.some(p => Math.hypot(p.x - x, p.y - y) < minD * 0.09)) continue;
    if (near(G.river, x, y, 16 * u + 4)) continue;
    g.lineWidth = lw * 0.9;
    hill(g, x, y, (8 + rand() * 8) * u + 3, u);
  }

  // 4. Rivers: double banks that widen towards the sea.
  const drawRiver = (pts, w0, w1) => {
    for (const [pass, extra] of [
      ['source-over', 0],
      ['destination-out', -1]
    ]) {
      g.save();
      g.globalCompositeOperation = pass;
      g.strokeStyle = `rgba(${INK},.7)`;
      for (let i = 1; i < pts.length; i++) {
        const t = i / pts.length,
          wd = (w0 + (w1 - w0) * t) * u + 1.2;
        g.lineWidth = Math.max(0.5, wd + extra * Math.max(1, wd * 0.45));
        g.beginPath();
        g.moveTo(pts[i - 1][0], pts[i - 1][1]);
        g.lineTo(pts[i][0], pts[i][1]);
        g.stroke();
      }
      g.restore();
    }
    // A pale wash of water between the banks.
    g.strokeStyle = `rgba(${INK},.12)`;
    for (let i = 1; i < pts.length; i++) {
      const t = i / pts.length;
      g.lineWidth = Math.max(0.5, (w0 + (w1 - w0) * t) * u);
      g.beginPath();
      g.moveTo(pts[i - 1][0], pts[i - 1][1]);
      g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
    }
  };
  drawRiver(G.river, 3, 11);
  if (G.trib.length > 3) drawRiver(G.trib, 1.6, 4);

  // 5. Roads: two thin inked edges, like an old surveyor's map.
  for (const [pass, wd, col] of [
    ['source-over', 4.6, `rgba(${INK},.72)`],
    ['destination-out', 2.6, '#000']
  ]) {
    g.save();
    g.globalCompositeOperation = pass;
    g.strokeStyle = col;
    g.lineWidth = wd * u + 1;
    g.beginPath();
    for (const r of G.roads) polyPath(g, r.path.pts);
    g.stroke();
    g.restore();
  }
  // Milestones along the roads.
  g.fillStyle = `rgba(${INK},.6)`;
  for (const r of G.roads)
    for (let d = 40 * u + 20; d < r.path.total - 20; d += 70 * u + 30) {
      const [x, y, a] = along(r.path, d);
      g.beginPath();
      g.arc(x - Math.sin(a) * (4 * u + 2), y + Math.cos(a) * (4 * u + 2), Math.max(0.6, 0.9 * u), 0, TAU);
      g.fill();
    }

  // 6. Bridges.
  g.strokeStyle = `rgba(${INK},.85)`;
  for (const br of G.bridges) {
    const L = 9 * u + 5,
      W = 3.2 * u + 1.5,
      e = 3 * u + 1;
    g.save();
    g.translate(br.x, br.y);
    g.rotate(br.ang);
    g.beginPath();
    g.rect(-L, -W, L * 2, W * 2);
    g.restore();
    g.save();
    hide(g);
    g.translate(br.x, br.y);
    g.rotate(br.ang);
    g.lineWidth = lw;
    g.beginPath();
    g.moveTo(-L, -W);
    g.lineTo(L, -W);
    g.moveTo(-L, W);
    g.lineTo(L, W);
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ]) {
      g.moveTo(sx * L, sy * W);
      g.lineTo(sx * (L + e), sy * (W + e));
    }
    g.stroke();
    g.restore();
  }

  // 7. Mountains along the inland edge, drawn back to front so nearer peaks overlap.
  g.strokeStyle = `rgba(${INK},.8)`;
  const peaks = [];
  for (let a = -0.02; a < 1.04; a += 0.035 + rand() * 0.03) {
    const rows = minD > 450 ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      const band = 1 - G.mtnB;
      const b = 1 - band * (0.15 + r * 0.375) - rand() * band * 0.2;
      const [x, y] = P(a + (r ? 0.02 : 0), b);
      const s = (r ? 1 : 0.8) * (26 + rand() * 22) * u + 8;
      peaks.push([x, y, s]);
    }
  }
  peaks.sort((p, q) => p[1] - q[1]);
  for (const [x, y, s] of peaks) {
    g.lineWidth = lw;
    mountain(g, x, y, s * 1.3, s, u, rand() - 0.5);
  }

  // 8. Forests: broadleaf woods in the lowlands, pines towards the mountains.
  const roadPts = G.roads.flatMap(r => r.path.pts);
  const woods = [];
  for (let k = 0; k < 40 && woods.length < (minD > 500 ? 4 : 3); k++) {
    const a = 0.16 + rand() * 0.68,
      z = G.zones ? G.zones[Math.floor(rand() * G.zones.length)] : null,
      b = z ? z[0] + rand() * (z[1] - z[0]) : coastB(a) + 0.12 + rand() * 0.5;
    const [x, y] = P(a, b);
    if (G.places.some(p => Math.hypot(p.x - x, p.y - y) < minD * 0.12)) continue;
    if (woods.some(q => Math.hypot(q.x - x, q.y - y) < minD * 0.22)) continue;
    const zw = z ? ((z[1] - z[0]) * w) / 2 : Infinity; // keep a wood inside its margin
    woods.push({ x, y, r: Math.min(minD * (0.07 + rand() * 0.05), zw / 1.3), pine: b > 0.6 });
  }
  const trees = [];
  for (const wd of woods)
    for (let k = 0; k < 70; k++) {
      const ang = rand() * TAU,
        rr = Math.sqrt(rand()) * wd.r;
      const x = wd.x + Math.cos(ang) * rr * 1.3,
        y = wd.y + Math.sin(ang) * rr * 0.8;
      if (near(roadPts, x, y, 7 * u + 3) || near(G.river, x, y, 7 * u + 3) || near(G.trib, x, y, 5 * u + 2))
        continue;
      // Keep trees off towns and the castle.
      if (
        G.places.some(
          p => Math.hypot(p.x - x, (p.y - y) * 1.3) < (p.kind === 'castle' ? 6 : 3.2) * (9 * u + 3)
        )
      )
        continue;
      if (trees.some(t => Math.hypot(t[0] - x, t[1] - y) < 6.5 * u + 2)) continue;
      trees.push([x, y, (7 + rand() * 3) * u + 2.5, wd.pine]);
    }
  trees.sort((p, q) => p[1] - q[1]);
  g.lineWidth = Math.max(0.5, 0.85 * u);
  for (const [x, y, s, pine] of trees) (pine ? conifer : broadleaf)(g, x, y, s);

  // 9. Places.
  let S = 9 * u + 3; // base size of buildings
  // The village nearest the castle becomes Hogsmeade: bigger, with more houses.
  const hogs = G.places
    .filter(p => p.kind === 'village')
    .sort((a, b) => Math.hypot(a.x - G.castle.x, a.y - G.castle.y) - Math.hypot(b.x - G.castle.x, b.y - G.castle.y))[0];
  g.lineWidth = Math.max(0.55, 0.85 * u);
  g.strokeStyle = `rgba(${INK},.85)`;
  for (const p of G.places) {
    if (p.kind === 'village' || p.kind === 'port') {
      const n = p.kind === 'port' ? 4 : p === hogs ? 10 : 5 + Math.floor(rand() * 3);
      const spots = [];
      for (let k = 0; k < n; k++) {
        const ang = rand() * TAU,
          rr = S * (0.5 + rand() * 1.6) * (p === hogs ? 1.5 : 1);
        spots.push([p.x + Math.cos(ang) * rr * 1.3, p.y + Math.sin(ang) * rr * 0.8]);
      }
      spots.sort((a, b) => a[1] - b[1]);
      spots.forEach(([x, y], k) => {
        const ch = house(g, x, y, S * 0.75, k === spots.length - 1 && p.kind === 'village');
        if (k % 2 === 0) chimneys.push(ch);
      });
      if (p.kind === 'port') {
        // A pier reaching out to sea.
        const [ca, cb] = G.AB(p.x, p.y);
        const [sx, sy] = G.P(ca, coastB(ca) - 0.005),
          [ex, ey] = G.P(ca, coastB(ca) - 0.05);
        g.lineWidth = Math.max(1, 2.2 * u);
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(ex, ey);
        g.stroke();
        g.lineWidth = Math.max(0.55, 0.85 * u);
      }
    } else if (p.kind === 'castle') {
      grandCastle(g, p, S, u, flags, lights);
    } else if (p.kind === 'tower') {
      hill(g, p.x, p.y + S * 0.3, S * 1.8, u);
      const tw = S * 0.8,
        th = S * 3.4;
      g.beginPath();
      g.moveTo(p.x - tw / 2, p.y);
      g.lineTo(p.x - tw * 0.38, p.y - th);
      g.lineTo(p.x + tw * 0.38, p.y - th);
      g.lineTo(p.x + tw / 2, p.y);
      g.closePath();
      hide(g);
      g.stroke();
      g.beginPath();
      g.moveTo(p.x - tw * 0.55, p.y - th);
      g.lineTo(p.x, p.y - th - S * 1.5);
      g.lineTo(p.x + tw * 0.55, p.y - th);
      g.closePath();
      g.fillStyle = `rgba(${INK},.35)`;
      g.fill();
      g.stroke();
      g.beginPath();
      g.rect(p.x - S * 0.1, p.y - th * 0.82, S * 0.2, S * 0.35);
      g.stroke();
      lights.push([p.x, p.y - th * 0.82 + S * 0.17, S * 0.9, true]);
      // A crescent moon and stars above the tower.
      const mx = p.x + S * 1.1,
        my = p.y - th - S * 1.5;
      g.fillStyle = `rgba(${INK},.6)`;
      g.beginPath();
      g.arc(mx, my, S * 0.4, 0, TAU);
      g.arc(mx + S * 0.18, my - S * 0.08, S * 0.34, 0, TAU, true);
      g.fill('evenodd');
    } else if (p.kind === 'circle') {
      hill(g, p.x, p.y + S * 0.4, S * 1.9, u);
      for (let k = 0; k < 9; k++) {
        const a = (k * TAU) / 9;
        const sx = p.x + Math.cos(a) * S * 1.1,
          sy = p.y + Math.sin(a) * S * 0.5;
        g.beginPath();
        g.rect(sx - S * 0.12, sy - S * 0.42, S * 0.24, S * 0.42);
        hide(g);
        g.stroke();
      }
    }
  }
  // A windmill beside the first village.
  let windmill = null;
  const v0 = G.places.find(p => p.kind === 'village');
  if (v0) {
    const x = v0.x + S * 3,
      y = v0.y + S * 0.4;
    g.beginPath();
    g.moveTo(x - S * 0.45, y);
    g.lineTo(x - S * 0.3, y - S * 1.5);
    g.lineTo(x + S * 0.3, y - S * 1.5);
    g.lineTo(x + S * 0.45, y);
    g.closePath();
    hide(g);
    g.stroke();
    g.beginPath();
    g.moveTo(x - S * 0.38, y - S * 1.5);
    g.lineTo(x, y - S * 1.9);
    g.lineTo(x + S * 0.38, y - S * 1.5);
    g.stroke();
    windmill = { x, y: y - S * 1.55, r: S * 1.3 };
  }

  // Wizarding extras: Quidditch pitch, gnarled tree, shack, eyes in the forest.
  const X = drawExtras(g, G, u, S, rand, woods, w, h);

  // 10. Place names.
  if (labels) {
    const fs = clamp(12 * u + 3, 9.5, 17);
    const villageNames = [...NAMES.village];
    // Buildings count as taken space too, so labels never sit on top of them.
    const taken = G.places.map(p => {
      const k = p.kind === 'castle' ? 1.35 : 1;
      return [p.x, p.y - S * 1.2 * k, S * 5.5 * k, S * 5 * k];
    });
    for (const p of G.places) {
      const name =
        p === hogs
          ? 'Hogsmeade'
          : p.kind === 'castle'
            ? pick(rand, NAMES.castle)
          : p.kind === 'port'
            ? pick(rand, NAMES.port)
            : p.kind === 'tower'
              ? pick(rand, NAMES.tower)
              : p.kind === 'circle'
                ? NAMES.circle[0]
                : villageNames.splice(Math.floor(rand() * villageNames.length), 1)[0] || 'Wending';
      const big = p.kind === 'castle';
      const below = p.y + S * (big ? 3 : 1.7),
        above = p.y - S * (big ? 5.2 : p.kind === 'tower' ? 6.4 : 2.6);
      label(g, name, p.x, below, big ? fs * 1.25 : p === hogs ? fs * 1.12 : fs, { spaced: big, italic: !big }, taken, [
        [p.x, above],
        [p.x + S * 4, p.y],
        [p.x - S * 4, p.y]
      ]);
    }
    if (X.pitch) {
      const P0 = X.pitch;
      label(g, 'Quidditch Pitch', P0.x, P0.y + P0.ry + S * 2.1, fs * 0.95, {}, taken, [[P0.x, P0.y - P0.ry - S * 3.2]]);
    }
    if (X.willow)
      label(g, 'Whomping Willow', X.willow.x, X.willow.y + S * 1.5, fs * 0.85, { optional: true }, taken, [
        [X.willow.x, X.willow.y - X.willow.s * 5.5]
      ]);
    if (X.shack)
      label(g, 'Shrieking Shack', X.shack.x, X.shack.y + S * 1.1, fs * 0.85, { optional: true }, taken, [
        [X.shack.x, X.shack.y - S * 2.4]
      ]);
    const woodNames = [...NAMES.wood];
    woods.forEach(wd =>
      label(
        g,
        woodNames.splice(Math.floor(rand() * woodNames.length), 1)[0] || 'The Deep Wood',
        wd.x,
        wd.y + wd.r * 0.95,
        fs * 0.95,
        { optional: true },
        taken,
        [
          [wd.x, wd.y],
          [wd.x, wd.y - wd.r * 0.9]
        ]
      )
    );
    const [mx, my] = P(0.5, G.mtnB + (1 - G.mtnB) * 0.35);
    label(
      g,
      pick(rand, NAMES.mountains),
      mx,
      my,
      fs * 1.05,
      { spaced: true, italic: false, rot: G.wide ? Math.PI / 2 : 0, optional: true },
      taken
    );
    if (G.wide) {
      // (on tall screens the strip of sea is taken by the compass and cartouche)
      const [sx, sy] = P(0.45, coastB(0.45) * 0.55);
      label(g, pick(rand, NAMES.sea), sx, sy, fs * 1.3, { rot: -Math.PI / 2 });
    }
    if (G.river.length > 20) {
      const i = Math.floor(G.river.length * 0.3),
        [rx, ry] = G.river[i],
        [qx, qy] = G.river[i + 4];
      let ang = Math.atan2(qy - ry, qx - rx);
      if (ang > Math.PI / 2) ang -= Math.PI;
      if (ang < -Math.PI / 2) ang += Math.PI;
      const ox = Math.sin(ang) * (12 * u + 4),
        oy = Math.cos(ang) * (12 * u + 4);
      label(g, 'River Wend', rx - ox, ry + oy, fs * 0.9, { rot: ang, optional: true }, taken, [
        [rx + ox, ry - oy]
      ]);
    }
  }

  // 11. Compass rose, with a fleur-de-lis pointing north.
  drawCompass(g, compass, u);

  // 12. Cartouche with the realm's name, out at sea.
  if (labels) {
    const edge = 10 * u + 4 + (6 * u + 3);
    const seaW = G.wide ? Math.min(coastB(0.08), coastB(0.14), coastB(0.2)) * w - edge : w;
    const cw = clamp(Math.min(minD * 0.36, seaW * 1.15), 140, 300),
      chh = cw * 0.34;
    const [cx, cy] = G.wide
      ? [edge + cw / 2 + chh * 0.25, edge + chh * 0.9 + 8]
      : [w * 0.64, h - coastB(0.64) * h * 0.45];
    drawCartouche(g, cx, cy, cw, chh, u, pick(rand, NAMES.realm));
  }

  g.restore();

  // 13. Border with a graduated scale, like an old chart.
  g.strokeStyle = `rgba(${INK},.8)`;
  g.lineWidth = lw * 1.4;
  g.strokeRect(f, f, w - 2 * f, h - 2 * f);
  g.lineWidth = lw * 0.8;
  g.strokeRect(f + gap, f + gap, w - 2 * (f + gap), h - 2 * (f + gap));
  g.fillStyle = `rgba(${INK},.7)`;
  const seg = 28 * u + 10;
  for (let x = f + gap, k = 0; x < w - f - gap; x += seg, k++)
    if (k % 2) {
      const e = Math.min(seg, w - f - gap - x);
      g.fillRect(x, f, e, gap);
      g.fillRect(x, h - f - gap, e, gap);
    }
  for (let y = f + gap, k = 0; y < h - f - gap; y += seg, k++)
    if (k % 2) {
      const e = Math.min(seg, h - f - gap - y);
      g.fillRect(f, y, gap, e);
      g.fillRect(w - f - gap, y, gap, e);
    }
  for (const [x, y] of [
    [f, f],
    [w - f - gap, f],
    [f, h - f - gap],
    [w - f - gap, h - f - gap]
  ])
    g.fillRect(x, y, gap, gap);

  // A scale bar in leagues.
  if (labels) {
    const [sx, sy] = G.wide
      ? [f + gap + (coastB(0.55) * w - f - gap) * 0.45, h * 0.58]
      : [w * 0.84, h - f - gap - 14 * u - 6];
    const L = Math.min(120 * u + 30, (G.wide ? coastB(0.55) * w - f - gap : w * 0.25) * 0.7);
    g.lineWidth = lw;
    g.strokeStyle = `rgba(${INK},.8)`;
    g.strokeRect(sx - L / 2, sy, L, 4 * u + 2);
    for (let k = 0; k < 4; k++) if (k % 2 === 0) g.fillRect(sx - L / 2 + (k * L) / 4, sy, L / 4, 4 * u + 2);
    label(g, 'Leagues', sx, sy - 8 * u - 3, clamp(10 * u + 2, 8, 14));
  }

  return { ink, flags, chimneys, lights, windmill, compass, S, X };
}

function drawCompass(g, c, u) {
  const { x, y, r } = c;
  g.save();
  g.translate(x, y);
  g.strokeStyle = `rgba(${INK},.85)`;
  g.lineWidth = Math.max(0.5, 0.8 * u);
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  hide(g);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, r * 0.9, 0, TAU);
  g.stroke();
  g.beginPath();
  for (let k = 0; k < 64; k++) {
    const a = (k * TAU) / 64,
      l = k % 4 ? 0.95 : 0.9;
    g.moveTo(Math.cos(a) * r * l, Math.sin(a) * r * l);
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.stroke();
  // Sixteen points, each half shaded, longest at the cardinal directions.
  for (const [n, len, wd] of [
    [16, 0.55, 0.06],
    [8, 0.72, 0.1],
    [4, 0.9, 0.14]
  ])
    for (let k = 0; k < n; k++) {
      const a = (k * TAU) / n - Math.PI / 2 + (n === 16 ? TAU / 32 : n === 8 ? TAU / 16 : 0);
      const tip = [Math.cos(a) * r * len, Math.sin(a) * r * len];
      const l = [Math.cos(a - Math.PI / 2) * r * wd, Math.sin(a - Math.PI / 2) * r * wd];
      const rr = [Math.cos(a + Math.PI / 2) * r * wd, Math.sin(a + Math.PI / 2) * r * wd];
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(...l);
      g.lineTo(...tip);
      g.closePath();
      hide(g);
      g.stroke();
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(...rr);
      g.lineTo(...tip);
      g.closePath();
      g.fillStyle = `rgba(${INK},.75)`;
      g.fill();
      g.stroke();
    }
  g.beginPath();
  g.arc(0, 0, r * 0.07, 0, TAU);
  hide(g);
  g.stroke();
  // Fleur-de-lis at north.
  const fy = -r * 1.02,
    s = r * 0.16;
  g.fillStyle = `rgba(${INK},.8)`;
  g.beginPath();
  g.moveTo(0, fy - s * 2.2);
  g.quadraticCurveTo(s * 0.7, fy - s * 1.2, 0, fy);
  g.quadraticCurveTo(-s * 0.7, fy - s * 1.2, 0, fy - s * 2.2);
  g.moveTo(0, fy - s * 0.4);
  g.quadraticCurveTo(s * 1.6, fy - s * 1.9, s * 1.2, fy - s * 0.2);
  g.quadraticCurveTo(s * 0.8, fy - s * 0.9, 0, fy - s * 0.2);
  g.moveTo(0, fy - s * 0.4);
  g.quadraticCurveTo(-s * 1.6, fy - s * 1.9, -s * 1.2, fy - s * 0.2);
  g.quadraticCurveTo(-s * 0.8, fy - s * 0.9, 0, fy - s * 0.2);
  g.fill();
  g.fillRect(-s * 0.9, fy - s * 0.15, s * 1.8, s * 0.3);
  g.restore();
}

function drawCartouche(g, x, y, wd, ht, u, title) {
  g.save();
  g.translate(x, y);
  g.strokeStyle = `rgba(${INK},.85)`;
  g.lineWidth = Math.max(0.6, 1 * u);
  const hw = wd / 2,
    hh = ht / 2,
    curl = ht * 0.32;
  // Scroll body.
  g.beginPath();
  g.moveTo(-hw, -hh);
  g.bezierCurveTo(-hw * 0.4, -hh - curl * 0.5, hw * 0.4, -hh + curl * 0.5, hw, -hh);
  g.lineTo(hw, hh);
  g.bezierCurveTo(hw * 0.4, hh + curl * 0.5, -hw * 0.4, hh - curl * 0.5, -hw, hh);
  g.closePath();
  hide(g);
  g.fillStyle = 'rgba(120,80,30,.07)';
  g.fill();
  g.stroke();
  // Rolled ends.
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * hw, 0, curl * 0.55, hh + curl * 0.2, 0, 0, TAU);
    hide(g);
    g.stroke();
    g.beginPath();
    g.ellipse(sx * hw, 0, curl * 0.22, hh * 0.9, 0, 0, TAU);
    g.stroke();
  }
  g.restore();
  label(g, title, x, y - ht * 0.08, fitSize(g, title, wd * 0.78, clamp(wd * 0.085, 10, 24)), {
    italic: true
  });
  const sub = HP.subtitle;
  label(g, sub, x, y + ht * 0.26, fitSize(g, sub, wd * 0.78, clamp(wd * 0.042, 7, 12)));
}

/* ------------------------------------------------------------------ living details */
function foot(c, x, y, ang, s) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.beginPath();
  c.ellipse(1.5 * s, 0, 2.3 * s, 1.25 * s, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.ellipse(-2 * s, 0, 1.2 * s, 1.05 * s, 0, 0, TAU);
  c.fill();
  c.restore();
}
function ship(c, x, y, s, ang, t) {
  c.save();
  c.translate(x, y);
  c.rotate(Math.sin(t * 1.3) * 0.06);
  const dir = Math.cos(ang) >= 0 ? 1 : -1;
  c.scale(dir, 1);
  c.strokeStyle = `rgba(${INK},.85)`;
  c.fillStyle = 'rgba(232,212,168,1)';
  c.lineWidth = Math.max(0.6, s * 0.08);
  c.beginPath(); // hull
  c.moveTo(-s * 1.3, -s * 0.2);
  c.lineTo(s * 1.4, -s * 0.2);
  c.quadraticCurveTo(s * 1.1, s * 0.45, s * 0.6, s * 0.45);
  c.lineTo(-s, s * 0.45);
  c.quadraticCurveTo(-s * 1.3, s * 0.3, -s * 1.3, -s * 0.2);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(0, -s * 0.2);
  c.lineTo(0, -s * 2.2);
  c.moveTo(-s * 0.7, -s * 0.2);
  c.lineTo(-s * 0.7, -s * 1.5);
  c.stroke();
  const bil = Math.sin(t * 2) * 0.08;
  for (const [mx, top, wd] of [
    [0, -s * 2.1, s * 0.75],
    [-s * 0.7, -s * 1.45, s * 0.5]
  ]) {
    c.beginPath();
    c.moveTo(mx - wd * 0.8, top);
    c.quadraticCurveTo(mx + wd * (0.5 + bil), top + (-top - s * 0.4) / 2, mx - wd * 0.8, -s * 0.4);
    c.lineTo(mx + wd * 0.2, -s * 0.4);
    c.quadraticCurveTo(mx + wd * (1.2 + bil), top + (-top - s * 0.4) / 2, mx + wd * 0.2, top);
    c.closePath();
    c.fill();
    c.stroke();
  }
  c.beginPath(); // pennant
  c.moveTo(0, -s * 2.2);
  c.lineTo(s * 0.6, -s * 2.1 + Math.sin(t * 6) * s * 0.08);
  c.lineTo(0, -s * 2.0);
  c.fillStyle = `rgba(${INK},.7)`;
  c.fill();
  c.restore();
}

/** Warm light from two candles just off the bottom corners, drawn once at full size. */
function candleLight(w, h) {
  const cv = mk(w, h),
    g = cv.getContext('2d'),
    rr = Math.min(w, h) * 0.7;
  for (const [x, y, r, a] of [
    [w * 0.04, h * 1.02, rr * 0.8, 0.34],
    [w * 0.97, h * 0.98, rr * 0.66, 0.26]
  ]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,170,80,${a})`);
    gr.addColorStop(0.4, `rgba(255,170,80,${a * 0.45})`);
    gr.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return cv;
}

/* ------------------------------------------------------------------ world */
export default {
  /** Skips the ink bloom, for still images such as quote cards. */
  settle(s) {
    s.age = 99;
  },
  init(w, h, opts = {}) {
    const u = clamp(Math.min(w, h) / 820, 0.3, 1.4);
    const rand = rng((SEED ^ (Math.round(w / 40) * 7919) ^ (Math.round(h / 40) * 104729)) >>> 0);
    const bg = paintParchment(w, h);
    const G = geography(w, h, u, rand, !!opts.full);
    const M = drawMap(w, h, u, G, rand);
    const sizeKey = Math.round(w / 60) + 'x' + Math.round(h / 60);
    const fresh = !seen.has(sizeKey);
    seen.add(sizeKey);
    // The ink blooms outward from a blot near the castle.
    const bx = G.castle.x,
      by = G.castle.y;
    // Where the ship sails: back and forth off the coast.
    const lane = [];
    // (the compass sits at a = 0.8 on wide screens and 0.18 on tall ones, so the lane avoids it)
    const [a0, a1] = G.wide ? [0.3, 0.66] : [0.38, 0.9];
    for (let a = a0; a <= a1; a += 0.01) lane.push(G.P(a, G.coastB(a) * 0.72));
    const nodes = new Map();
    G.roads.forEach((r, i) => {
      for (const n of [r.from, r.to]) nodes.set(n, [...(nodes.get(n) || []), i]);
    });
    const walkers = Array.from({ length: clamp(Math.round(G.roads.length * 0.8), 2, 7) }, (_, k) => {
      const ri = k % G.roads.length;
      return {
        road: ri,
        dir: 1,
        d: R(0, G.roads[ri].path.total),
        wait: R(0, 2),
        side: 1,
        since: 0,
        x: 0,
        y: 0,
        ang: 0
      };
    });
    const s = {
      bg,
      ...M,
      G,
      u,
      nodes,
      age: fresh ? 0 : 99,
      bloom: {
        x: bx,
        y: by,
        maxR: Math.hypot(Math.max(bx, w - bx), Math.max(by, h - by)) * 1.12,
        dur: 5.5,
        ph: R(0, 6)
      },
      walkers,
      prints: [],
      lane: measure(lane),
      shipD: R(0, 1),
      shipDir: 1,
      serpent: { next: R(8, 14), age: -1, x: 0, y: 0 },
      trail: null,
      nextTrail: 0,
      smoke: [],
      sparks: [],
      gold: sprite('255,206,110'),
      shade: sprite('70,45,20'),
      candle: candleLight(w, h),
      mote: sprite('255,225,150'),
      motes: Array.from({ length: Math.min(36, Math.floor((w * h) / 20000) + 8) }, () => ({
        x: R(0, w),
        y: R(0, h),
        v: R(4, 14),
        r: R(0.6, 1.8),
        p: R(0, 6.28)
      }))
    };
    initMagic(s, w, h);
    return s;
  },

  draw(c, s, t, dt, m, w, h) {
    const u = s.u,
      G = s.G;
    // The renderer warms scenes up with 0.12 s steps before showing them; those don't count
    // toward the bloom, so readers see the map ink itself in from the start.
    if (dt === 0)
      s.age = 99; // a still frame (motion switched off): show the finished map
    else if (dt < 0.11) s.age += dt;
    c.drawImage(s.bg, 0, 0, w, h);

    // 1. The map, soaking outward from an ink blot the first time it appears.
    const b = s.bloom,
      p = clamp(s.age / b.dur, 0, 1);
    if (p < 1) {
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2,
        rad = b.maxR * e;
      const edge = () => {
        c.beginPath();
        for (let a = 0; a <= 6.3; a += 0.1) {
          const k = 1 + 0.1 * Math.sin(a * 5 + b.ph + s.age) + 0.05 * Math.sin(a * 11 - s.age * 1.7);
          const px = b.x + Math.cos(a) * rad * k,
            py = b.y + Math.sin(a) * rad * k;
          a ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath();
      };
      c.save();
      edge();
      c.clip();
      c.drawImage(s.ink, 0, 0, w, h);
      c.restore();
      edge();
      c.strokeStyle = `rgba(255,200,110,${0.35 * (1 - p)})`;
      c.lineWidth = 10 * u + 3;
      c.stroke();
      c.strokeStyle = `rgba(${INK},${0.25 * (1 - p)})`;
      c.lineWidth = 3 * u + 1;
      c.stroke();
      c.fillStyle = `rgba(${INK},${0.55 * (1 - p)})`;
      c.beginPath();
      c.arc(b.x, b.y, (6 + 14 * e) * u + 2, 0, TAU);
      c.fill();
    } else c.drawImage(s.ink, 0, 0, w, h);
    const ready = p >= 1,
      show = clamp((p - 0.8) / 0.2, 0, 1);

    // 2. The river flows towards the sea.
    if (show > 0) {
      c.save();
      c.globalAlpha = show;
      c.strokeStyle = `rgba(${INK},.35)`;
      c.lineWidth = Math.max(0.6, 0.9 * u);
      c.setLineDash([2 * u + 1, 11 * u + 4]);
      c.lineDashOffset = -t * (14 * u + 4);
      c.beginPath();
      polyPath(c, G.river);
      c.stroke();
      if (G.trib.length > 3) {
        c.beginPath();
        polyPath(c, G.trib);
        c.stroke();
      }
      c.setLineDash([]);
      c.restore();
    }

    // 3. Flags on the castle, a turning windmill, chimney smoke and lit windows.
    c.fillStyle = `rgba(${INK},${0.7 * show})`;
    for (const [fx, fy, fs] of s.flags) {
      c.beginPath();
      c.moveTo(fx, fy);
      for (let k = 0; k <= 6; k++)
        c.lineTo(fx + k * 1.5 * fs, fy + Math.sin(t * 5 + k * 0.9 + fx) * 0.9 * fs * (k / 6));
      for (let k = 6; k >= 0; k--)
        c.lineTo(
          fx + k * 1.5 * fs * 0.92,
          fy + 4 * fs * (1 - k / 14) + Math.sin(t * 5 + k * 0.9 + fx) * 0.9 * fs * (k / 6)
        );
      c.closePath();
      c.fill();
    }
    if (s.windmill && show > 0) {
      const wm = s.windmill;
      c.save();
      c.globalAlpha = show;
      c.translate(wm.x, wm.y);
      c.rotate(t * 0.8);
      c.strokeStyle = `rgba(${INK},.85)`;
      c.fillStyle = 'rgba(232,212,168,.95)';
      c.lineWidth = Math.max(0.5, 0.8 * u);
      for (let k = 0; k < 4; k++) {
        c.rotate(TAU / 4);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(wm.r, 0);
        c.stroke();
        c.beginPath();
        c.rect(wm.r * 0.25, 0, wm.r * 0.72, wm.r * 0.22);
        c.fill();
        c.stroke();
        c.beginPath();
        for (let q = 1; q < 4; q++) {
          c.moveTo(wm.r * (0.25 + q * 0.18), 0);
          c.lineTo(wm.r * (0.25 + q * 0.18), wm.r * 0.22);
        }
        c.stroke();
      }
      c.restore();
    }
    if (ready) {
      for (const [x, y] of s.chimneys)
        if (Math.random() < dt * 0.5) s.smoke.push({ x, y, age: 0, ph: R(0, 6) });
      for (let i = s.smoke.length - 1; i >= 0; i--) {
        const q = s.smoke[i];
        q.age += dt;
        if (q.age > 4) {
          s.smoke.splice(i, 1);
          continue;
        }
        const k = q.age / 4;
        glow(
          c,
          s.shade,
          q.x + Math.sin(q.age * 1.6 + q.ph) * 4 * u + q.age * 3 * u,
          q.y - q.age * 9 * u,
          (2 + q.age * 3) * u + 1,
          0.3 * (1 - k)
        );
      }
      for (const [x, y, r, magic] of s.lights) {
        const tw = magic
          ? 0.55 + 0.35 * Math.sin(t * 2.3) + 0.1 * Math.sin(t * 7.1)
          : 0.35 + 0.1 * Math.sin(t * 3 + x);
        glow(c, s.gold, x, y, r * (magic ? 1.6 : 1), tw * (0.6 + m.dark * 0.6));
      }
    }

    // 4. A ship sailing the coast, and now and then a sea serpent.
    if (show > 0) {
      s.shipD += (s.shipDir * dt * (10 * u + 4)) / s.lane.total;
      if (s.shipD > 1 || s.shipD < 0) {
        s.shipDir = -s.shipDir;
        s.shipD = clamp(s.shipD, 0, 1);
      }
      const [x, y, ang] = along(s.lane, s.shipD * s.lane.total);
      c.save();
      c.globalAlpha = show;
      ship(c, x, y + Math.sin(t * 1.5) * u, 7 * u + 3, s.shipDir > 0 ? ang : ang + Math.PI, t);
      c.strokeStyle = `rgba(${INK},.3)`; // wake
      c.lineWidth = Math.max(0.5, 0.7 * u);
      c.beginPath();
      for (let k = 1; k < 4; k++) {
        const [wx, wy] = along(s.lane, (s.shipD - s.shipDir * k * 0.012) * s.lane.total);
        c.moveTo(wx - 3 * u, wy + (6 + k) * u);
        c.quadraticCurveTo(wx, wy + (4 + k) * u, wx + 3 * u, wy + (6 + k) * u);
      }
      c.stroke();
      c.restore();
      const sp = s.serpent;
      if (sp.age < 0 && t > sp.next) {
        const a = R(0.15, 0.85);
        [sp.x, sp.y] = G.P(a, G.coastB(a) * R(0.25, 0.45));
        sp.age = 0;
      }
      if (sp.age >= 0) {
        sp.age += dt;
        const life = 9,
          k = sp.age / life;
        if (k >= 1) {
          sp.age = -1;
          sp.next = t + R(14, 24);
        } else {
          const rise = Math.sin(Math.PI * k),
            S = 6 * u + 3;
          c.strokeStyle = `rgba(${INK},${0.8 * rise})`;
          c.fillStyle = `rgba(${INK},${0.25 * rise})`;
          c.lineWidth = Math.max(0.7, 1.1 * u);
          for (let q = 0; q < 3; q++) {
            const hx = sp.x + q * S * 1.9 + sp.age * 3 * u,
              hr = S * (0.9 - q * 0.15) * clamp(rise * 1.3 - q * 0.15, 0, 1);
            if (hr <= 0.5) continue;
            c.beginPath();
            c.arc(hx, sp.y, hr, Math.PI, TAU);
            c.fill();
            c.stroke();
          }
          const hx = sp.x - S * 1.2 + sp.age * 3 * u,
            hy = sp.y - S * 1.1 * rise;
          c.beginPath(); // head and fin
          c.moveTo(hx + S * 0.6, sp.y);
          c.quadraticCurveTo(hx + S * 0.2, hy + S * 0.2, hx - S * 0.4, hy);
          c.lineTo(hx - S * 0.9, hy + S * 0.25);
          c.lineTo(hx - S * 0.2, hy + S * 0.45);
          c.quadraticCurveTo(hx, sp.y - S * 0.2, hx - S * 0.1, sp.y);
          c.fill();
          c.stroke();
        }
      }
    }

    // 5. Now and then a road lights up in golden ink, from one end to the other.
    if (ready && !s.nextTrail) s.nextTrail = t + R(3, 6);
    if (ready && !s.trail && t > s.nextTrail && G.roads.length) {
      const r = G.roads[Math.floor(Math.random() * G.roads.length)];
      s.trail = { path: r.path, dir: Math.random() < 0.5 ? 1 : -1, age: 0 };
      s.nextTrail = t + R(10, 16);
    }
    if (s.trail) {
      const tr = s.trail;
      tr.age += dt;
      const drawn = Math.min(1, tr.age / 3.5),
        fade = tr.age < 8 ? 1 : 1 - (tr.age - 8) / 3;
      if (fade <= 0) s.trail = null;
      else {
        const pts = tr.dir > 0 ? tr.path.pts : [...tr.path.pts].reverse();
        const n = Math.max(2, Math.floor(drawn * pts.length));
        c.save();
        c.strokeStyle = `rgba(190,130,40,${0.75 * fade})`;
        c.lineWidth = Math.max(1, 1.6 * u);
        c.setLineDash([1, 5 * u + 2]);
        c.lineCap = 'round';
        c.beginPath();
        polyPath(c, pts, 0, n);
        c.stroke();
        c.restore();
        const [hx, hy] = pts[n - 1];
        if (drawn < 1) {
          glow(c, s.gold, hx, hy, 14 * u + 5, 0.85);
          if (Math.random() < 0.5)
            s.sparks.push({ x: hx, y: hy, vx: R(-10, 10) * u, vy: R(-18, -4) * u, life: 1 });
        }
      }
    }

    // 6. Footsteps travelling the roads, fading behind each traveller.
    const fs = Math.max(1, 1.8 * u),
      stride = 7 * fs,
      speed = 20 * u + 6;
    if (ready)
      for (const wk of s.walkers) {
        const road = G.roads[wk.road];
        if (wk.wait > 0) {
          wk.wait -= dt;
          continue;
        }
        const step = speed * dt;
        wk.d += wk.dir * step;
        const end = wk.dir > 0 ? wk.d >= road.path.total : wk.d <= 0;
        const [x, y, a] = along(road.path, wk.d);
        wk.x = x;
        wk.y = y;
        wk.ang = wk.dir > 0 ? a : a + Math.PI;
        if (end) {
          const node = wk.dir > 0 ? road.to : road.from;
          const opts = (s.nodes.get(node) || []).filter(i => i !== wk.road);
          const next = opts.length ? opts[Math.floor(Math.random() * opts.length)] : wk.road;
          const nr = G.roads[next];
          wk.road = next;
          wk.dir = nr.from === node ? 1 : -1;
          wk.d = wk.dir > 0 ? 0 : nr.path.total;
          if (Math.random() < 0.5) {
            wk.wait = R(1, 4);
            for (let k = 0; k < 6; k++)
              s.sparks.push({ x, y, vx: R(-14, 14) * u, vy: R(-22, -6) * u, life: 1 });
          }
        }
        wk.since += step;
        if (wk.since >= stride) {
          wk.since = 0;
          wk.side = -wk.side;
          s.prints.push({
            x: wk.x - Math.sin(wk.ang) * 2.3 * fs * wk.side,
            y: wk.y + Math.cos(wk.ang) * 2.3 * fs * wk.side,
            ang: wk.ang,
            age: 0
          });
          if (s.prints.length > 320) s.prints.shift();
        }
      }
    c.fillStyle = `rgb(${INK})`;
    for (let i = s.prints.length - 1; i >= 0; i--) {
      const f = s.prints[i];
      f.age += dt;
      const a = f.age < 0.25 ? f.age / 0.25 : 1 - (f.age - 0.25) / 8;
      if (a <= 0) {
        s.prints.splice(i, 1);
        continue;
      }
      c.globalAlpha = 0.7 * a;
      foot(c, f.x, f.y, f.ang, fs);
    }
    c.globalAlpha = 1;
    if (ready)
      for (const wk of s.walkers) {
        const pulse = (t * 0.7 + wk.road * 0.37) % 1;
        c.strokeStyle = `rgba(${INK},${0.4 * (1 - pulse)})`;
        c.lineWidth = 0.9;
        c.beginPath();
        c.arc(wk.x, wk.y, (3 + pulse * 8) * fs, 0, TAU);
        c.stroke();
      }

    // 7. Golden sparks.
    for (let i = s.sparks.length - 1; i >= 0; i--) {
      const sp = s.sparks[i];
      sp.life -= dt * 0.8;
      if (sp.life <= 0) {
        s.sparks.splice(i, 1);
        continue;
      }
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      glow(c, s.gold, sp.x, sp.y, 5 * u + 3, sp.life * 0.85);
    }

    // 8. A slow shimmer around the compass rose.
    if (ready) {
      const cp = s.compass,
        a = t * 0.35;
      glow(c, s.gold, cp.x + Math.cos(a) * cp.r * 0.95, cp.y + Math.sin(a) * cp.r * 0.95, cp.r * 0.3, 0.35);
    }

    // 8b. The wizarding layer: owls, snitch, riders, ghosts, Patronus, names beside footprints.
    drawMagic(c, s, t, dt, m, w, h, ready, show);

    // 9. Candlelight from the corners and drifting motes.
    // (the light is pre-rendered once; flickering only changes how strongly it's laid on)
    const fl = 0.78 + 0.1 * Math.sin(t * 8.3) + 0.06 * Math.sin(t * 21.1 + 1.3) + R(-0.03, 0.03);
    c.globalAlpha = clamp(fl * (1 - m.dark * 0.5), 0, 1);
    c.drawImage(s.candle, 0, 0, w, h);
    c.globalAlpha = 1;
    for (const q of s.motes) {
      q.y -= q.v * dt;
      q.x += Math.sin(t * 0.6 + q.p) * 0.25;
      if (q.y < -5) {
        q.y = h + 5;
        q.x = R(0, w);
      }
      glow(c, s.mote, q.x, q.y, q.r * 4, (0.35 + 0.3 * Math.sin(t * 1.7 + q.p)) * 0.5);
    }
  }
};
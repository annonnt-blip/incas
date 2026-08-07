// World data: the frozen metrics, the authored level, its entities and its lore wiring.
// Every number here is fixed in design/thresholds.md and the layout is built on top of it.

export const CELL = 3.0;
export const WALL_H = 3.6;
export const EYE_H = 1.7;
export const GW = 64, GH = 48;

// texture slots — indices into the loaded texture array (see game.js ASSETS)
export const TEX = { MEGALITH: 0, FLOOR: 1, CEIL: 2, GLYPH: 3, GOLD: 4, ALIEN: 5, RUBBLE: 6 };

// attunements. Each carries a distinct SHAPE as well as a colour, so colour is never the
// only channel a player has to read (accessibility: no colour-only signal).
export const GLYPH = {
  NONE:   { id: 0, key: "none",   shape: "flame",    rgb: [1.00, 0.72, 0.38], radius: 6.0 },
  INTI:   { id: 1, key: "inti",   shape: "chakana",  rgb: [1.00, 0.78, 0.30], radius: 8.5 },
  QUILLA: { id: 2, key: "quilla", shape: "crescent", rgb: [0.72, 0.84, 1.00], radius: 8.5 },
  CHASKA: { id: 3, key: "chaska", shape: "star",     rgb: [0.42, 0.95, 1.00], radius: 8.5 },
};
export const GLYPH_BY_ID = [GLYPH.NONE, GLYPH.INTI, GLYPH.QUILLA, GLYPH.CHASKA];

// economy (design/thresholds.md)
export const LAMP_MAX = 100;
export const LAMP_DRAIN = 1.05;
export const ATTUNE_COST = 4;
export const BRAZIER_FULL = 48;
export const BRAZIER_REUSE = 18;

// movement
export const WALK = 3.0, SPRINT = 4.8, P_RADIUS = 0.34;
export const REACH = 3.2, AIM_COS = Math.cos(30 * Math.PI / 180);

// the Watcher
export const WATCH_DELAY = 12, WATCH_SPEED = 2.2, WATCH_CATCH = 0.8;

// ---------------------------------------------------------------------------
// level geometry — authored rectangles, carved into the grid
// ---------------------------------------------------------------------------
const ROOMS = [
  // zone 1 — the entrance shaft and the collapsed gallery
  { x: 4,  z: 40, w: 5,  h: 6, zone: 1 },   // shaft (start)
  { x: 6,  z: 34, w: 1,  h: 6, zone: 1 },   // rope corridor
  { x: 3,  z: 27, w: 10, h: 8, zone: 1 },   // collapsed gallery
  { x: 13, z: 30, w: 6,  h: 1, zone: 1 },   // squeeze
  { x: 19, z: 27, w: 5,  h: 7, zone: 1 },   // shrine of the first light

  // zone 2 — the Hall of the Sun
  { x: 21, z: 22, w: 1,  h: 4,  zone: 2 },  // approach
  { x: 12, z: 12, w: 16, h: 10, zone: 2 },  // hall
  { x: 7,  z: 15, w: 5,  h: 4,  zone: 2 },  // west alcove
  { x: 28, z: 17, w: 2,  h: 1,  zone: 2 },  // east passage
  { x: 30, z: 15, w: 5,  h: 6,  zone: 2 },  // shrine of the moon

  // zone 3 — the observatory and the drowned terrace
  { x: 32, z: 10, w: 1,  h: 4, zone: 3 },   // rising passage
  { x: 24, z: 3,  w: 14, h: 7, zone: 3 },   // observatory
  { x: 38, z: 7,  w: 1,  h: 1, zone: 3 },   // terrace mouth
  { x: 39, z: 5,  w: 6,  h: 5, zone: 3 },   // drowned terrace

  // zone 4 — the machine
  { x: 46, z: 7,  w: 4,  h: 1, zone: 4 },   // hull corridor
  { x: 50, z: 3,  w: 10, h: 8, zone: 4 },   // machine hall
  { x: 61, z: 5,  w: 2,  h: 2, zone: 4 },   // sealed alcove (behind a phase wall)
  { x: 54, z: 11, w: 1,  h: 2, zone: 4 },   // descent
  { x: 48, z: 13, w: 12, h: 9, zone: 4 },   // core chamber
  { x: 45, z: 16, w: 2,  h: 2, zone: 4 },   // sealed alcove (behind a phase wall)
];

// gates: solid until opened, and each answers to exactly one light
export const GATES = [
  { id: 1, cx: 21, cz: 26, need: GLYPH.INTI },
  { id: 2, cx: 32, cz: 14, need: GLYPH.QUILLA },
  { id: 3, cx: 45, cz: 7,  need: GLYPH.CHASKA },
];

// phase walls: alien hull that stops being solid while CHASKA is carried
export const PHASE = [
  { cx: 60, cz: 5 }, { cx: 60, cz: 6 },
  { cx: 47, cz: 16 }, { cx: 47, cz: 17 },
];

// murals live on wall cells: look at one within reach and read it under the right light
export const MURALS = [
  { key: "mural.1", cx: 18, cz: 29, need: GLYPH.INTI },
  { key: "mural.2", cx: 18, cz: 11, need: GLYPH.INTI },
  { key: "mural.3", cx: 22, cz: 11, need: GLYPH.QUILLA },
  { key: "mural.4", cx: 30, cz: 2,  need: GLYPH.QUILLA },
  { key: "mural.5", cx: 53, cz: 12, need: GLYPH.CHASKA },
];

// free-standing objects, drawn as billboards
export const PROPS = [
  // zone 1
  { kind: "relic",   key: "relic.rope",    cx: 4,  cz: 44 },
  { kind: "brazier", id: "b1", cx: 7,  cz: 44, lit: false },
  { kind: "brazier", id: "b2", cx: 4,  cz: 28, lit: false },
  { kind: "relic",   key: "relic.journal", cx: 11, cz: 33 },
  { kind: "stele",   glyph: GLYPH.INTI,    cx: 21, cz: 28, note: "stone.inti" },

  // zone 2
  { kind: "brazier", id: "b3", cx: 14, cz: 19, lit: true },
  { kind: "brazier", id: "b4", cx: 25, cz: 14, lit: false },
  { kind: "relic",   key: "relic.tumi",    cx: 9,  cz: 16 },
  { kind: "relic",   key: "relic.quipu",   cx: 26, cz: 20 },
  { kind: "stele",   glyph: GLYPH.QUILLA,  cx: 32, cz: 17, note: "stone.quilla" },
  { kind: "relic",   key: "relic.mask",    cx: 33, cz: 19 },

  // zone 3
  { kind: "brazier", id: "b5", cx: 26, cz: 5,  lit: true },
  { kind: "relic",   key: "relic.lens",    cx: 36, cz: 4 },
  { kind: "brazier", id: "b6", cx: 42, cz: 8,  lit: false },
  { kind: "relic",   key: "relic.shard",   cx: 40, cz: 6 },
  { kind: "stele",   glyph: GLYPH.CHASKA,  cx: 43, cz: 6, note: "stone.chaska", alien: true },

  // zone 4
  { kind: "node",    id: "n1", cx: 52, cz: 5,  note: "node.hum" },
  { kind: "node",    id: "n2", cx: 57, cz: 9,  note: "node.hum" },
  { kind: "relic",   key: "relic.seed",    cx: 62, cz: 5 },   // behind a phase wall
  { kind: "brazier", id: "b7", cx: 45, cz: 16, lit: false },  // behind a phase wall
  { kind: "brazier", id: "b8", cx: 50, cz: 20, lit: false },
  { kind: "core",    cx: 53, cz: 17, note: "node.core" },
];

// fixed environment lights that are not props (shaft daylight, seepage from cracks)
export const AMBIENT_LIGHTS = [
  { x: 6,  z: 42, y: 3.2, rgb: [0.55, 0.62, 0.75], r: 10, i: 0.85 }, // daylight down the shaft
  { x: 20, z: 16, y: 3.3, rgb: [0.42, 0.40, 0.34], r: 13, i: 0.30 }, // cracks over the hall
  { x: 31, z: 6,  y: 3.3, rgb: [0.40, 0.44, 0.52], r: 13, i: 0.32 }, // the star shaft
  { x: 54, z: 17, y: 3.3, rgb: [0.16, 0.44, 0.52], r: 14, i: 0.40 }, // the engine's own glow
];

export const START = { cx: 6, cz: 43, ang: -Math.PI / 2 };

export const TOTAL_RELICS = PROPS.filter(p => p.kind === "relic").length;
export const TOTAL_MURALS = MURALS.length;

// ---------------------------------------------------------------------------
// grid construction
// ---------------------------------------------------------------------------
export function buildGrid() {
  const n = GW * GH;
  const solid = new Uint8Array(n).fill(1);
  const zone  = new Uint8Array(n);
  const wtex  = new Uint8Array(n);
  const ftex  = new Uint8Array(n);
  const ctex  = new Uint8Array(n);
  const gate  = new Uint8Array(n);   // gate id, 0 = none
  const phase = new Uint8Array(n);   // 1 = alien phase wall

  const at = (x, z) => z * GW + x;

  for (const r of ROOMS) {
    for (let z = r.z; z < r.z + r.h; z++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (x < 1 || z < 1 || x >= GW - 1 || z >= GH - 1) continue;
        const i = at(x, z);
        solid[i] = 0;
        zone[i] = r.zone;
        ftex[i] = r.zone === 1 ? TEX.RUBBLE : r.zone === 4 ? TEX.ALIEN : TEX.FLOOR;
        ctex[i] = r.zone === 4 ? TEX.ALIEN : TEX.CEIL;
      }
    }
  }

  // gates start solid; they are cut from gold and they are the only way through
  for (const g of GATES) {
    const i = at(g.cx, g.cz);
    gate[i] = g.id; solid[i] = 1; wtex[i] = TEX.GOLD;
    zone[i] = zone[at(g.cx, g.cz + 1)] || zone[at(g.cx, g.cz - 1)] || 2;
    ftex[i] = TEX.FLOOR; ctex[i] = TEX.CEIL;
  }
  for (const p of PHASE) {
    const i = at(p.cx, p.cz);
    phase[i] = 1; solid[i] = 1; wtex[i] = TEX.ALIEN;
    ftex[i] = TEX.ALIEN; ctex[i] = TEX.ALIEN;
  }

  // wall faces take the material of the zone they face
  for (let z = 1; z < GH - 1; z++) {
    for (let x = 1; x < GW - 1; x++) {
      const i = at(x, z);
      if (!solid[i] || gate[i] || phase[i]) continue;
      let zn = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = at(x + dx, z + dz);
        if (!solid[j] || gate[j] || phase[j]) { zn = zone[j] || zn; }
      }
      if (!zn) continue;
      zone[i] = zn;
      wtex[i] = zn === 1 ? TEX.RUBBLE : zn === 4 ? TEX.ALIEN : TEX.MEGALITH;
      // deterministic carved panels break up the long megalithic runs
      if ((zn === 2 || zn === 3) && ((x * 7 + z * 3) % 11 === 0)) wtex[i] = TEX.GLYPH;
    }
  }
  for (const m of MURALS) wtex[at(m.cx, m.cz)] = TEX.GLYPH;

  return { solid, zone, wtex, ftex, ctex, gate, phase, at };
}

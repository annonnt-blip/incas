// Procedural fallback for the generated tile set.
//
// The shipped build uses the generated stone; this module draws the same seven
// materials in code for builds that cannot carry image files (the self-contained
// artifact) or when an asset fails to load. Procedural art is an asset like any
// other, so it works from the same style formula: damp charcoal-grey andesite and
// moss-olive stone, warm tarnished gold ochre on the Inca interactables, cold
// cyan-white on the alien hull, and every tile lands on the same mean luminance the
// renderer's lighting model is tuned against.
//
// Everything here is seamless by construction: the noise lattice wraps, and cell
// distances are measured on a torus, so no tile needs a seam fix.

const TS = 256;
export const TARGET_LUM = 0.34;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// value noise on a wrapping lattice — tiles seamlessly at any octave
function lattice(n, rand) {
  const g = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) g[i] = rand();
  return g;
}
const smooth = t => t * t * (3 - 2 * t);

function noiseAt(g, n, x, y) {
  const fx = x * n, fy = y * n;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = smooth(fx - x0), ty = smooth(fy - y0);
  const i0 = ((x0 % n) + n) % n, j0 = ((y0 % n) + n) % n;
  const i1 = (i0 + 1) % n, j1 = (j0 + 1) % n;
  const a = g[j0 * n + i0], b = g[j0 * n + i1];
  const c = g[j1 * n + i0], d = g[j1 * n + i1];
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
}

function fbm(seed, octaves, base) {
  const rand = rng(seed);
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push(lattice(base << o, rand));
  return (x, y) => {
    let v = 0, amp = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      v += noiseAt(layers[o], base << o, x, y) * amp;
      norm += amp; amp *= 0.5;
    }
    return v / norm;
  };
}

// Jittered seed points, measured on a torus: the basis for Inca polygonal masonry.
function cells(count, seed, jitter = 0.42) {
  const rand = rng(seed);
  const cols = Math.round(Math.sqrt(count));
  const pts = [];
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      pts.push({
        x: (i + 0.5 + (rand() - 0.5) * jitter * 2) / cols,
        y: (j + 0.5 + (rand() - 0.5) * jitter * 2) / cols,
        shade: rand(), hue: rand(),
      });
    }
  }
  return pts;
}

function nearest(pts, x, y) {
  let b1 = 9, b2 = 9, best = pts[0];
  for (const p of pts) {
    let dx = Math.abs(p.x - x), dy = Math.abs(p.y - y);
    if (dx > 0.5) dx = 1 - dx;
    if (dy > 0.5) dy = 1 - dy;
    const d = dx * dx + dy * dy;
    if (d < b1) { b2 = b1; b1 = d; best = p; }
    else if (d < b2) b2 = d;
  }
  return { cell: best, edge: Math.sqrt(b2) - Math.sqrt(b1) };
}

function surface() {
  const c = document.createElement("canvas");
  c.width = c.height = TS;
  return c.getContext("2d", { willReadFrequently: true });
}

// Normalise a finished tile onto the luminance the lighting model expects.
function normalise(img, target = TARGET_LUM) {
  const d = img.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  const mean = sum / (d.length / 4) / 255;
  let lo = 0.15, hi = 1.6, g = 1;
  for (let k = 0; k < 30; k++) {
    g = (lo + hi) / 2;
    if (Math.pow(mean, g) < target) hi = g; else lo = g;
  }
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.min(255, Math.round(Math.pow(v / 255, g) * 255));
  for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
  return img;
}

const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;

// Fills a tile pixel by pixel. `shade(x, y, out)` writes r,g,b into out.
function paint(shade) {
  const g = surface();
  const img = g.createImageData(TS, TS);
  const d = img.data;
  const out = [0, 0, 0];
  for (let py = 0; py < TS; py++) {
    for (let px = 0; px < TS; px++) {
      shade(px / TS, py / TS, out);
      const i = (py * TS + px) * 4;
      d[i] = clamp(out[0]); d[i + 1] = clamp(out[1]); d[i + 2] = clamp(out[2]); d[i + 3] = 255;
    }
  }
  return normalise(img);
}

// --- the seven materials ---------------------------------------------------------------

function wallMegalith() {
  const grain = fbm(1201, 4, 8);
  const pts = cells(36, 733, 0.5);
  return paint((x, y, o) => {
    const { cell, edge } = nearest(pts, x, y);
    const n = grain(x, y);
    // Blocks differ only slightly: this is one quarry, dressed by one crew. Too much
    // variance and the wall reads as camouflage rather than masonry.
    let r = 66 + cell.shade * 11, g = 65 + cell.shade * 10, b = 56 + cell.shade * 8;
    // The joints are hairlines — the whole point of this masonry is that a blade will
    // not fit between the stones — with moss holding in the shadow of them.
    const joint = Math.max(0, 1 - edge / 0.013);
    r = r * (1 - joint * 0.58) + 30 * joint * 0.5;
    g = g * (1 - joint * 0.48) + 38 * joint * 0.6;
    b = b * (1 - joint * 0.60) + 24 * joint * 0.4;
    // A dressed face is flat; only a narrow shadow sits beside each joint. Shading the
    // whole face as a dome is what turns a wall into camouflage.
    const shadow = Math.max(0, 1 - edge / 0.028) * 0.20;
    const k = 0.86 + n * 0.22 - shadow;
    o[0] = r * k; o[1] = g * k; o[2] = b * k;
  });
}

function floorStone() {
  const grain = fbm(311, 4, 8);
  const wet = fbm(977, 3, 4);
  const pts = cells(16, 4021, 0.22);
  return paint((x, y, o) => {
    const { cell, edge } = nearest(pts, x, y);
    const n = grain(x, y);
    let r = 62 + cell.shade * 20, g = 63 + cell.shade * 19, b = 56 + cell.shade * 15;
    const joint = Math.max(0, 1 - edge / 0.022);
    // standing water sits in the joints and picks up a cold sheen
    r = r * (1 - joint * 0.7) + 28 * joint * 0.8;
    g = g * (1 - joint * 0.62) + 34 * joint * 0.9;
    b = b * (1 - joint * 0.5) + 36 * joint;
    const sheen = Math.pow(Math.max(0, wet(x, y) - 0.55), 2) * 210;
    const k = 0.74 + n * 0.44;
    o[0] = r * k + sheen * 0.7; o[1] = g * k + sheen * 0.8; o[2] = b * k + sheen;
  });
}

function ceilingRock() {
  const rough = fbm(88, 5, 6);
  const chisel = fbm(541, 3, 12);
  const drip = fbm(2207, 2, 3);
  return paint((x, y, o) => {
    const n = rough(x, y);
    // parallel tool marks left by hand chiselling
    const marks = Math.sin((x * 26 + chisel(x, y) * 7) * Math.PI * 2) * 0.5 + 0.5;
    let k = 0.5 + n * 0.7 + marks * 0.12;
    const stain = Math.max(0, drip(x, y) - 0.58) * 1.6;   // mineral seepage
    o[0] = (48 * k) * (1 - stain * 0.3) + stain * 30;
    o[1] = (48 * k) * (1 - stain * 0.22) + stain * 32;
    o[2] = (43 * k) * (1 - stain * 0.1) + stain * 26;
  });
}

// stepped-cross and terrace banding, carved rather than painted
function wallGlyph() {
  const grain = fbm(6101, 4, 8);
  const step = (u) => {
    const t = ((u % 1) + 1) % 1;
    return t < 0.5 ? t * 2 : (1 - t) * 2;
  };
  return paint((x, y, o) => {
    const n = grain(x, y);
    const bandY = step(y * 4);
    // a chakana reads as nested square steps; approximate with a stepped chevron field
    const a = step(x * 4 + bandY * 0.5);
    const carve = Math.abs(a - 0.5) < 0.16 || Math.abs(bandY - 0.5) < 0.09 ? 1 : 0;
    const relief = carve ? 0.52 : 1.0;
    const rim = (Math.abs(Math.abs(a - 0.5) - 0.16) < 0.03) ? 1.34 : 1;
    const k = (0.7 + n * 0.5) * relief * rim;
    o[0] = 72 * k; o[1] = 70 * k; o[2] = 56 * k;
  });
}

function goldRelief() {
  const grain = fbm(4404, 4, 6);
  const hammer = fbm(1717, 2, 16);
  return paint((x, y, o) => {
    let dx = x - 0.5, dy = y - 0.5;
    const d = Math.sqrt(dx * dx + dy * dy);
    const ang = Math.atan2(dy, dx);
    // sun disc with radial rays, embossed
    const rays = Math.sin(ang * 16) * 0.5 + 0.5;
    const disc = d < 0.17 ? 1.22 : (d < 0.42 ? 0.86 + rays * 0.34 : 0.78);
    const ring = Math.abs(d - 0.17) < 0.014 || Math.abs(d - 0.42) < 0.012 ? 1.3 : 1;
    const n = grain(x, y), h = hammer(x, y);
    const k = disc * ring * (0.72 + n * 0.34 + h * 0.2);
    // tarnish drags the highlights toward green-brown
    o[0] = 168 * k; o[1] = 126 * k * (0.94 + n * 0.1); o[2] = 58 * k * (0.8 + n * 0.3);
  });
}

function alienPanel() {
  const grain = fbm(9091, 3, 8);
  const pts = cells(9, 6161, 0.1);
  return paint((x, y, o) => {
    const { edge } = nearest(pts, x, y);
    const n = grain(x, y);
    // recessed channels between hull plates, lit from inside
    const channel = Math.max(0, 1 - edge / 0.03);
    const trace = Math.max(0, 1 - Math.abs(edge - 0.055) / 0.008);
    const base = 40 + n * 26;
    o[0] = base * (1 - channel * 0.6) + trace * 12;
    o[1] = base * (1 - channel * 0.3) + channel * 40 + trace * 96;
    o[2] = base * (1 - channel * 0.1) + channel * 54 + trace * 124;
  });
}

function rubbleDirt() {
  const dust = fbm(1313, 5, 8);
  const pts = cells(196, 8123, 0.9);
  return paint((x, y, o) => {
    const { cell, edge } = nearest(pts, x, y);
    const n = dust(x, y);
    // small shattered stones sitting in packed dirt
    const stone = edge > 0.012 && cell.hue > 0.45 ? 1 : 0;
    const lit = stone ? 1.18 + cell.shade * 0.3 : 0.82;
    const k = (0.62 + n * 0.66) * lit;
    o[0] = 74 * k; o[1] = 65 * k; o[2] = 48 * k;
  });
}

export function makeTextures() {
  return [
    wallMegalith(),  // TEX.MEGALITH
    floorStone(),    // TEX.FLOOR
    ceilingRock(),   // TEX.CEIL
    wallGlyph(),     // TEX.GLYPH
    goldRelief(),    // TEX.GOLD
    alienPanel(),    // TEX.ALIEN
    rubbleDirt(),    // TEX.RUBBLE
  ];
}

// A stand-in for the menu backdrop: a corridor falling away into cold light.
export function makeTitleArt(w = 960, h = 540) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#05060a"; g.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.52;
  // receding walls, drawn as nested trapezoids
  for (let i = 14; i >= 1; i--) {
    const t = i / 14;
    const ww = w * 0.16 + t * w * 0.62, hh = h * 0.2 + t * h * 0.72;
    g.fillStyle = `rgb(${(14 + (1 - t) * 78) | 0},${(15 + (1 - t) * 74) | 0},${(12 + (1 - t) * 58) | 0})`;
    g.fillRect(cx - ww / 2, cy - hh / 2, ww, hh);
  }
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, w * 0.2);
  glow.addColorStop(0, "rgba(120,230,255,0.85)");
  glow.addColorStop(0.35, "rgba(40,130,160,0.32)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  const warm = g.createRadialGradient(w * 0.13, h * 0.82, 0, w * 0.13, h * 0.82, w * 0.3);
  warm.addColorStop(0, "rgba(216,171,94,0.4)");
  warm.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = warm; g.fillRect(0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.72);
}

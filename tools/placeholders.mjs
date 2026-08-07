// Local-only stand-ins so the engine can be driven and debugged before the generated
// art is wired in. These are never shipped — the real manifest assets replace them.
import zlib from "node:zlib";
import fs from "node:fs";

function png(w, h, fill) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fill(x, y);
      raw[o++] = r; raw[o++] = g; raw[o++] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}
let TBL = null;
function crc32(buf) {
  if (!TBL) {
    TBL = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TBL[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TBL[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return c ^ -1;
}

const noise = (seed) => {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
};

function blocky(base, mortar, cw, ch, jitter) {
  const r = noise(base[0] * 7919 + 13);
  const cache = new Map();
  return (x, y) => {
    const row = Math.floor(y / ch);
    const off = (row % 2) * (cw / 2);
    const col = Math.floor((x + off) / cw);
    const inMortar = ((y % ch) < 3) || (((x + off) % cw) < 3);
    const key = row * 977 + col;
    if (!cache.has(key)) cache.set(key, r());
    const v = cache.get(key);
    const n = ((x * 31 + y * 17) % 23) / 23;
    if (inMortar) return mortar.map(c => Math.max(0, Math.min(255, c + n * 12 - 6)) | 0);
    return base.map(c => Math.max(0, Math.min(255, c * (0.78 + v * 0.42) + n * jitter - jitter / 2)) | 0);
  };
}

fs.mkdirSync("public/assets", { recursive: true });
const out = (name, buf) => { fs.writeFileSync("public/assets/" + name, buf); console.log("  " + name); };

out("wall_megalith.png", png(256, 256, blocky([88, 88, 78], [40, 42, 34], 84, 62, 26)));
out("floor_stone.png",   png(256, 256, blocky([74, 74, 68], [34, 36, 30], 128, 128, 22)));
out("ceiling_rock.png",  png(256, 256, blocky([58, 58, 52], [28, 29, 25], 64, 48, 30)));
out("wall_glyph.png",    png(256, 256, blocky([96, 92, 76], [46, 44, 32], 42, 42, 34)));
out("gold_relief.png",   png(256, 256, blocky([172, 132, 62], [96, 70, 28], 52, 52, 30)));
out("alien_panel.png",   png(256, 256, blocky([44, 58, 64], [18, 46, 54], 64, 32, 18)));
out("rubble_dirt.png",   png(256, 256, blocky([80, 70, 56], [44, 38, 30], 26, 22, 40)));
out("title_art.png",     png(640, 360, (x, y) => {
  const cx = 320, cy = 190, d = Math.hypot(x - cx, (y - cy) * 1.6) / 260;
  const t = Math.max(0, 1 - d);
  return [(20 + t * 60) | 0, (26 + t * 120) | 0, (30 + t * 150) | 0];
}));
out("icon_app.png",      png(128, 128, (x, y) => {
  const d = Math.hypot(x - 64, y - 64) / 60, t = Math.max(0, 1 - d);
  return [(180 * t) | 0, (140 * t) | 0, (70 * t) | 0];
}));
console.log("placeholders written");

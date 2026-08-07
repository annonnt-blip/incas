// Procedurally drawn billboards and HUD marks.
// These are manifest assets like any other (design/assets.csv rows spr_* and ui_glyphs) and
// they carry the same STYLE FORMULA palette as the generated textures: damp charcoal-grey
// andesite, warm tarnished gold ochre for Inca interactables, cold cyan-white for alien tech.

export const PAL = {
  stoneDark:  "#22231f",
  stone:      "#3b3c35",
  stoneLit:   "#55564b",
  moss:       "#454a35",
  gold:       "#b8893f",
  goldLit:    "#e8c374",
  goldPale:   "#f6e0ab",
  cyan:       "#5fe0ff",
  cyanDeep:   "#12586b",
  cyanPale:   "#d5fbff",
  moon:       "#b9cbe8",
  flame:      "#ffb958",
  flameHot:   "#fff0c4",
};

function surface(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true;
  return { c, g };
}

function toSprite(c) {
  const g = c.getContext("2d");
  const id = g.getImageData(0, 0, c.width, c.height);
  return { w: c.width, h: c.height, data: new Uint32Array(id.data.buffer.slice(0)) };
}

// deterministic jitter so every run draws the identical prop
function rnd(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// --- glyph marks, also used by the HUD so colour is never the only channel -------------
export function drawGlyphMark(g, shape, cx, cy, r, color) {
  g.save();
  g.strokeStyle = color; g.fillStyle = color;
  g.lineWidth = Math.max(1.5, r * 0.22);
  g.lineJoin = "miter";
  if (shape === "chakana") {
    const u = r / 1.5;
    g.beginPath();
    const pts = [[-1,-3],[1,-3],[1,-1],[3,-1],[3,1],[1,1],[1,3],[-1,3],[-1,1],[-3,1],[-3,-1],[-1,-1]];
    pts.forEach(([x, y], i) => i ? g.lineTo(cx + x * u, cy + y * u) : g.moveTo(cx + x * u, cy + y * u));
    g.closePath(); g.stroke();
    g.beginPath(); g.arc(cx, cy, u * 0.55, 0, 7); g.fill();
  } else if (shape === "crescent") {
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.save(); g.globalCompositeOperation = "destination-out";
    g.beginPath(); g.arc(cx + r * 0.5, cy - r * 0.16, r * 0.92, 0, 7); g.fill();
    g.restore();
  } else if (shape === "star") {
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, rr = i % 2 ? r * 0.36 : r;
      const x = cx + Math.cos(a - Math.PI / 2) * rr, y = cy + Math.sin(a - Math.PI / 2) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath(); g.fill();
  } else { // bare flame
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.quadraticCurveTo(cx + r * 0.75, cy - r * 0.1, cx, cy + r * 0.8);
    g.quadraticCurveTo(cx - r * 0.75, cy - r * 0.1, cx, cy - r);
    g.fill();
  }
  g.restore();
}

// --- brazier ---------------------------------------------------------------------------
function brazier(lit) {
  const { c, g } = surface(96, 144);
  const rand = rnd(7);
  // pedestal
  g.fillStyle = PAL.stoneDark;
  g.beginPath(); g.moveTo(30, 144); g.lineTo(66, 144); g.lineTo(60, 74); g.lineTo(36, 74); g.closePath(); g.fill();
  g.fillStyle = PAL.stone;
  g.beginPath(); g.moveTo(33, 144); g.lineTo(50, 144); g.lineTo(48, 74); g.lineTo(37, 74); g.closePath(); g.fill();
  // chiselled banding
  g.strokeStyle = PAL.stoneDark; g.lineWidth = 2;
  for (let y = 88; y < 140; y += 16) { g.beginPath(); g.moveTo(32, y); g.lineTo(65, y + 2); g.stroke(); }
  // bowl
  g.fillStyle = PAL.stone;
  g.beginPath(); g.ellipse(48, 74, 30, 11, 0, 0, 7); g.fill();
  g.fillStyle = PAL.stoneDark;
  g.beginPath(); g.ellipse(48, 72, 23, 8, 0, 0, 7); g.fill();
  g.fillStyle = PAL.stoneLit;
  g.beginPath(); g.ellipse(48, 74, 30, 11, 0, Math.PI * 1.08, Math.PI * 1.92); g.fill();
  // gold rim — the Inca signal colour
  g.strokeStyle = PAL.gold; g.lineWidth = 2.5;
  g.beginPath(); g.ellipse(48, 74, 30, 11, 0, 0, 7); g.stroke();

  if (lit) {
    // embers in the bowl
    g.fillStyle = "#8a3d12";
    g.beginPath(); g.ellipse(48, 72, 19, 5.5, 0, 0, 7); g.fill();
    g.fillStyle = PAL.flame;
    g.beginPath(); g.ellipse(48, 71, 12, 3.5, 0, 0, 7); g.fill();
    // three tongues rather than a solid mass, so the fire keeps a silhouette
    for (let k = 0; k < 3; k++) {
      const lean = (k - 1) * 5.5, hgt = 34 + k * 7 + rand() * 8;
      const wid = 8.5 - Math.abs(k - 1) * 2.4;
      g.globalAlpha = 0.30;
      g.fillStyle = "#d8641c";
      g.beginPath();
      g.moveTo(48 + lean - wid, 70);
      g.quadraticCurveTo(48 + lean - wid * 0.5, 70 - hgt * 0.6, 48 + lean + lean * 0.5, 70 - hgt);
      g.quadraticCurveTo(48 + lean + wid * 0.5, 70 - hgt * 0.6, 48 + lean + wid, 70);
      g.closePath(); g.fill();
      g.globalAlpha = 0.42;
      g.fillStyle = PAL.flame;
      g.beginPath();
      g.moveTo(48 + lean - wid * 0.55, 70);
      g.quadraticCurveTo(48 + lean, 70 - hgt * 0.5, 48 + lean * 1.3, 70 - hgt * 0.72);
      g.quadraticCurveTo(48 + lean + wid * 0.45, 70 - hgt * 0.4, 48 + lean + wid * 0.55, 70);
      g.closePath(); g.fill();
    }
    g.globalAlpha = 0.72;
    g.fillStyle = PAL.flameHot;
    g.beginPath(); g.ellipse(48, 66, 4.5, 8, 0, 0, 7); g.fill();
    g.globalAlpha = 1;
  } else {
    g.fillStyle = "#15150f";
    g.beginPath(); g.ellipse(48, 72, 20, 6, 0, 0, 7); g.fill();
  }
  return toSprite(c);
}

// --- glyph stele -----------------------------------------------------------------------
function stele(shape, color, awake, alien) {
  const { c, g } = surface(96, 192);
  const body = alien ? "#23282b" : PAL.stone;
  const bodyDark = alien ? "#14181a" : PAL.stoneDark;
  g.fillStyle = bodyDark;
  g.beginPath(); g.moveTo(22, 192); g.lineTo(74, 192); g.lineTo(70, 18); g.lineTo(26, 18); g.closePath(); g.fill();
  g.fillStyle = body;
  g.beginPath(); g.moveTo(26, 190); g.lineTo(56, 190); g.lineTo(54, 20); g.lineTo(29, 20); g.closePath(); g.fill();
  g.fillStyle = alien ? "#2e3a3e" : PAL.stoneLit;
  g.beginPath(); g.moveTo(26, 190); g.lineTo(36, 190); g.lineTo(34, 20); g.lineTo(28, 20); g.closePath(); g.fill();
  if (alien) {
    // the pattern is under the surface, not carved into it
    g.strokeStyle = "#1d4c58"; g.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      g.beginPath(); g.moveTo(28, 40 + i * 21); g.lineTo(70, 34 + i * 21); g.stroke();
    }
  } else {
    g.strokeStyle = bodyDark; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(26, 44 + i * 24); g.lineTo(72, 42 + i * 24); g.stroke(); }
  }
  // the face
  drawGlyphMark(g, shape, 48, 74, 21, awake ? color : (alien ? "#1d3b44" : "#2b2c26"));
  if (awake) {
    g.globalAlpha = 0.35;
    drawGlyphMark(g, shape, 48, 74, 27, color);
    g.globalAlpha = 1;
  }
  return toSprite(c);
}

// --- relic -----------------------------------------------------------------------------
function relic() {
  const { c, g } = surface(64, 64);
  g.fillStyle = "#0d0d0a";
  g.beginPath(); g.ellipse(32, 55, 20, 6, 0, 0, 7); g.fill();
  g.fillStyle = PAL.gold;
  g.beginPath();
  g.moveTo(16, 50); g.lineTo(48, 50); g.lineTo(44, 36); g.lineTo(32, 22); g.lineTo(20, 36); g.closePath(); g.fill();
  g.fillStyle = PAL.goldLit;
  g.beginPath(); g.moveTo(20, 48); g.lineTo(32, 48); g.lineTo(32, 25); g.lineTo(22, 37); g.closePath(); g.fill();
  g.fillStyle = PAL.goldPale;
  g.beginPath(); g.ellipse(29, 33, 2.5, 5, -0.4, 0, 7); g.fill();
  return toSprite(c);
}

// --- alien node ------------------------------------------------------------------------
function node() {
  const { c, g } = surface(96, 96);
  g.fillStyle = "#10171a";
  g.beginPath(); g.arc(48, 48, 22, 0, 7); g.fill();
  g.strokeStyle = PAL.cyanDeep; g.lineWidth = 4;
  g.beginPath(); g.ellipse(48, 48, 34, 12, 0.35, 0, 7); g.stroke();
  g.strokeStyle = PAL.cyan; g.lineWidth = 2.5;
  g.beginPath(); g.ellipse(48, 48, 34, 12, -0.35, 0, 7); g.stroke();
  g.fillStyle = PAL.cyan;
  g.beginPath(); g.arc(48, 48, 11, 0, 7); g.fill();
  g.fillStyle = PAL.cyanPale;
  g.beginPath(); g.arc(48, 48, 5, 0, 7); g.fill();
  return toSprite(c);
}

// --- the engine socket -----------------------------------------------------------------
function core() {
  const { c, g } = surface(192, 224);
  g.fillStyle = "#0f1416";
  g.beginPath(); g.moveTo(48, 224); g.lineTo(144, 224); g.lineTo(132, 10); g.lineTo(60, 10); g.closePath(); g.fill();
  g.fillStyle = "#1b2528";
  g.beginPath(); g.moveTo(56, 222); g.lineTo(100, 222); g.lineTo(96, 12); g.lineTo(62, 12); g.closePath(); g.fill();
  g.strokeStyle = PAL.cyanDeep; g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    g.beginPath(); g.moveTo(54, 34 + i * 22); g.lineTo(138, 30 + i * 22); g.stroke();
  }
  g.strokeStyle = PAL.cyan; g.lineWidth = 2;
  g.beginPath(); g.moveTo(96, 14); g.lineTo(96, 220); g.stroke();
  // the opening, the exact size of a hand
  g.fillStyle = "#04090b";
  g.beginPath(); g.ellipse(96, 118, 26, 34, 0, 0, 7); g.fill();
  g.fillStyle = PAL.cyanDeep;
  g.beginPath(); g.ellipse(96, 118, 20, 27, 0, 0, 7); g.fill();
  g.fillStyle = PAL.cyan;
  g.beginPath(); g.ellipse(96, 118, 11, 16, 0, 0, 7); g.fill();
  g.fillStyle = PAL.cyanPale;
  g.beginPath(); g.ellipse(96, 118, 4, 7, 0, 0, 7); g.fill();
  return toSprite(c);
}

export function buildSprites() {
  return {
    brazierOff: brazier(false),
    brazierOn:  brazier(true),
    steleInti:   [stele("chakana",  PAL.goldLit, false, false), stele("chakana",  PAL.goldLit, true,  false)],
    steleQuilla: [stele("crescent", PAL.moon,    false, false), stele("crescent", PAL.moon,    true,  false)],
    steleChaska: [stele("star",     PAL.cyan,    false, true),  stele("star",     PAL.cyan,    true,  true)],
    relic: relic(),
    node: node(),
    core: core(),
  };
}

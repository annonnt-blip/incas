import { T, setLang, LANGS } from "./strings.js";
import { Renderer } from "./engine.js";
import { buildSprites, drawGlyphMark, PAL } from "./sprites.js";
import { Audio } from "./audio.js";
import * as W from "./world.js";

const {
  CELL, EYE_H, GW, GH, TEX, GLYPH, GLYPH_BY_ID,
  LAMP_MAX, LAMP_DRAIN, ATTUNE_COST, BRAZIER_FULL, BRAZIER_REUSE,
  WALK, SPRINT, P_RADIUS, REACH, AIM_COS,
  WATCH_DELAY, WATCH_SPEED, WATCH_CATCH,
  GATES, PHASE, MURALS, PROPS, AMBIENT_LIGHTS, START, TOTAL_RELICS, TOTAL_MURALS,
} = W;

const $ = id => document.getElementById(id);
const SAVE_KEY = "asg.save.v1";
const OPT_KEY = "asg.opt.v1";
const STEP = 1000 / 60;

// ---------------------------------------------------------------------------
// options
// ---------------------------------------------------------------------------
const opt = Object.assign({
  sens: 1, invertY: false, textScale: 1, shake: true, flash: true, grain: true,
  quality: 1, music: 1, sfx: 1, lang: "en",
}, JSON.parse(localStorage.getItem(OPT_KEY) || "{}"));
function saveOpt() { localStorage.setItem(OPT_KEY, JSON.stringify(opt)); }

// ---------------------------------------------------------------------------
// assets
// ---------------------------------------------------------------------------
const TEXTURE_FILES = [
  ["wall_megalith.png", TEX.MEGALITH], ["floor_stone.png", TEX.FLOOR],
  ["ceiling_rock.png", TEX.CEIL], ["wall_glyph.png", TEX.GLYPH],
  ["gold_relief.png", TEX.GOLD], ["alien_panel.png", TEX.ALIEN],
  ["rubble_dirt.png", TEX.RUBBLE],
];
const AUDIO_FILES = {
  music: "./assets/mus_dread.mp3", amb: "./assets/sfx_ambience.mp3",
  step: "./assets/sfx_step.mp3", glyph: "./assets/sfx_glyph.mp3",
  gate: "./assets/sfx_gate.mp3", alien: "./assets/sfx_alien.mp3",
};

const renderer = new Renderer();
const audio = new Audio();
let SPR = null;
let grid = null;

async function loadTexture(file, slot) {
  const img = new Image();
  img.src = "./assets/" + file;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingEnabled = true;
  g.drawImage(img, 0, 0, 256, 256);
  renderer.setTexture(slot, g.getImageData(0, 0, 256, 256));
}

// ---------------------------------------------------------------------------
// game state
// ---------------------------------------------------------------------------
let S = null;
function freshState() {
  return {
    x: (START.cx + 0.5) * CELL, z: (START.cz + 0.5) * CELL,
    ang: START.ang, pitch: 0,
    charge: 62, glyph: 0,
    known: [true, false, false, false],
    relics: {}, murals: {}, gates: {}, braziers: {}, nodes: {},
    seen: {}, reached: {},
    time: 0, bob: 0, stepDist: 0,
    dark: 0, watcher: null, respawn: { x: (START.cx + 0.5) * CELL, z: (START.cz + 0.5) * CELL },
    ended: null, shake: 0, flashT: 0,
  };
}

let lights = [];     // currently baked lights
let props = [];      // live billboard instances

function rebuildWorld() {
  grid = W.buildGrid();
  renderer.clearLights();
  lights = [];
  for (const L of AMBIENT_LIGHTS) addLight(L);

  props = [];
  for (const p of PROPS) {
    const inst = {
      ...p,
      x: (p.cx + 0.5) * CELL, z: (p.cz + 0.5) * CELL,
      w: 1.1, h: 1.6, yOff: 0, glow: 0, glowRgb: [1, 1, 1], img: null,
    };
    if (p.kind === "brazier") {
      inst.w = 1.15; inst.h = 1.75;
      if (S.braziers[p.id] === undefined) S.braziers[p.id] = p.lit ? "lit" : "cold";
    } else if (p.kind === "stele") {
      inst.w = 1.0; inst.h = 2.1;
    } else if (p.kind === "relic") {
      inst.w = 0.6; inst.h = 0.6;
    } else if (p.kind === "node") {
      inst.w = 0.95; inst.h = 0.95; inst.yOff = 1.15;
    } else if (p.kind === "core") {
      inst.w = 2.4; inst.h = 2.8; inst.yOff = 0.2;
    }
    props.push(inst);
  }
  for (const p of props) {
    if (p.kind === "brazier" && S.braziers[p.id] === "lit") addLight(brazierLight(p));
    if (p.kind === "node") addLight(nodeLight(p));
    if (p.kind === "core") addLight({ x: p.x, z: p.z, y: 1.8, rgb: [0.30, 0.92, 1.0], r: 15, i: 1.0 });
    if (p.kind === "stele") addLight({ x: p.x, z: p.z, y: 1.5, rgb: p.glyph.rgb, r: 6.5, i: 0.45 });
  }
  for (const g of GATES) if (S.gates[g.id]) openGateCell(g);
  syncProps();
}

const brazierLight = p => ({ id: "bz" + p.id, x: p.x, z: p.z, y: 1.55, rgb: [1.0, 0.70, 0.34], r: 12.5, i: 1.25 });
const nodeLight = p => ({ id: "nd" + p.id, x: p.x, z: p.z, y: 1.7, rgb: [0.28, 0.90, 1.0], r: 9.5, i: 0.75 });

function addLight(L) { lights.push(L); renderer.bakeLight(grid, L, +1); }
function removeLight(id) {
  const i = lights.findIndex(l => l.id === id);
  if (i < 0) return;
  renderer.bakeLight(grid, lights[i], -1);
  lights.splice(i, 1);
}

function openGateCell(g) {
  const i = grid.at(g.cx, g.cz);
  grid.solid[i] = 0; grid.gate[i] = 0;
  grid.ftex[i] = TEX.FLOOR; grid.ctex[i] = TEX.CEIL;
}

// keep billboard images in step with the state
function syncProps() {
  for (const p of props) {
    if (p.kind === "brazier") {
      const lit = S.braziers[p.id] === "lit" || S.braziers[p.id] === "spent";
      p.img = lit ? SPR.brazierOn : SPR.brazierOff;
      p.glow = lit ? 0.26 : 0; p.glowRgb = [1.0, 0.68, 0.32];
    } else if (p.kind === "stele") {
      const k = S.known[p.glyph.id];
      const set = p.glyph.id === 1 ? SPR.steleInti : p.glyph.id === 2 ? SPR.steleQuilla : SPR.steleChaska;
      p.img = set[k ? 1 : 0];
      p.glow = k ? 0.30 : 0.12; p.glowRgb = p.glyph.rgb;
    } else if (p.kind === "relic") {
      p.img = SPR.relic; p.glow = 0.18; p.glowRgb = [1.0, 0.80, 0.45];
      p.hidden = !!S.relics[p.key];
    } else if (p.kind === "node") {
      p.img = SPR.node; p.glow = 0.55; p.glowRgb = [0.35, 0.95, 1.0];
    } else if (p.kind === "core") {
      p.img = SPR.core; p.glow = 0.6; p.glowRgb = [0.35, 0.95, 1.0];
    }
  }
}
const visibleProps = () => props.filter(p => !p.hidden);

// ---------------------------------------------------------------------------
// input — every binding is a physical key code, and every command has a
// keyboard, a touch and a gamepad route
// ---------------------------------------------------------------------------
const BIND = {
  KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
  ShiftLeft: "sprint", ShiftRight: "sprint",
  KeyE: "use", Space: "use", Enter: "use",
  Digit1: "g1", Digit2: "g2", Digit3: "g3", Digit0: "g0", Backquote: "g0",
  Tab: "codex", KeyC: "codex", Escape: "pause", KeyP: "pause",
  KeyQ: "cyclePrev", KeyR: "cycleNext",
};
const PAD = { 0: "use", 3: "codex", 9: "pause", 4: "cyclePrev", 5: "cycleNext", 10: "sprint" };
const held = new Set();
const edge = new Set();      // commands that fired this frame
let padPrev = {};

addEventListener("keydown", e => {
  const c = BIND[e.code];
  if (!c) return;
  if (e.code === "Tab" || e.code === "Space") e.preventDefault();
  if (!held.has(c)) edge.add(c);
  held.add(c);
});
addEventListener("keyup", e => { const c = BIND[e.code]; if (c) held.delete(c); });
addEventListener("blur", () => { held.clear(); });

function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let ax = 0, az = 0, lx = 0, ly = 0;
  for (const gp of pads) {
    if (!gp) continue;
    const dz = v => Math.abs(v) < 0.18 ? 0 : v;
    ax += dz(gp.axes[0] || 0); az += dz(gp.axes[1] || 0);
    lx += dz(gp.axes[2] || 0); ly += dz(gp.axes[3] || 0);
    gp.buttons.forEach((b, i) => {
      const c = PAD[i]; if (!c) return;
      if (b.pressed && !padPrev[i]) edge.add(c);
      if (b.pressed) held.add(c); else held.delete(c);
      padPrev[i] = b.pressed;
    });
    if (gp.buttons[12] && gp.buttons[12].pressed) held.add("up"); else if (az === 0) held.delete("up");
    if (gp.buttons[13] && gp.buttons[13].pressed) held.add("down");
  }
  return { ax, az, lx, ly };
}

// mouse look with pointer lock
let mouseDX = 0, mouseDY = 0;
const canvas = $("c");
canvas.addEventListener("click", () => {
  if (S && phase === "play" && !isTouch) canvas.requestPointerLock();
});
document.addEventListener("mousemove", e => {
  if (document.pointerLockElement === canvas) { mouseDX += e.movementX; mouseDY += e.movementY; }
});
document.addEventListener("pointerlockchange", () => {
  if (phase === "play" && document.pointerLockElement !== canvas && !isTouch) setPhase("pause");
});

// touch: left half drives movement, right half looks, on-screen buttons do the rest
const isTouch = matchMedia("(hover: none)").matches || "ontouchstart" in window;
let stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
let lookTouch = { id: null, lx: 0, ly: 0 };
function bindTouch() {
  const surf = $("touchsurf");
  surf.addEventListener("touchstart", e => {
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && stick.id === null) {
        stick.id = t.identifier; stick.ox = t.clientX; stick.oy = t.clientY; stick.x = 0; stick.y = 0;
        const n = $("stick"); n.style.left = t.clientX + "px"; n.style.top = t.clientY + "px"; n.style.opacity = 1;
      } else if (lookTouch.id === null) {
        lookTouch.id = t.identifier; lookTouch.lx = t.clientX; lookTouch.ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  surf.addEventListener("touchmove", e => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) {
        const dx = t.clientX - stick.ox, dy = t.clientY - stick.oy, R = 58;
        const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / R);
        stick.x = dx / d * k; stick.y = dy / d * k;
        $("stickN").style.transform = `translate(${stick.x * R}px, ${stick.y * R}px)`;
      } else if (t.identifier === lookTouch.id) {
        mouseDX += (t.clientX - lookTouch.lx) * 2.1;
        mouseDY += (t.clientY - lookTouch.ly) * 2.1;
        lookTouch.lx = t.clientX; lookTouch.ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) {
        stick.id = null; stick.x = stick.y = 0;
        $("stick").style.opacity = 0; $("stickN").style.transform = "";
      }
      if (t.identifier === lookTouch.id) lookTouch.id = null;
    }
  };
  surf.addEventListener("touchend", end);
  surf.addEventListener("touchcancel", end);
}

// ---------------------------------------------------------------------------
// collision & movement
// ---------------------------------------------------------------------------
function blocked(x, z) {
  const cx = (x / CELL) | 0, cz = (z / CELL) | 0;
  if (cx < 0 || cz < 0 || cx >= GW || cz >= GH) return true;
  const i = cz * GW + cx;
  if (!grid.solid[i]) return false;
  if (grid.phase[i] && S.glyph === GLYPH.CHASKA.id && S.charge > 0) return false;
  return true;
}
function canStand(x, z) {
  const r = P_RADIUS;
  return !blocked(x - r, z - r) && !blocked(x + r, z - r) &&
         !blocked(x - r, z + r) && !blocked(x + r, z + r);
}
function moveBy(dx, dz) {
  if (canStand(S.x + dx, S.z)) S.x += dx;
  if (canStand(S.x, S.z + dz)) S.z += dz;
}

// ---------------------------------------------------------------------------
// targeting
// ---------------------------------------------------------------------------
const muralAt = (cx, cz) => MURALS.find(m => m.cx === cx && m.cz === cz);
const gateAt = (cx, cz) => GATES.find(g => g.cx === cx && g.cz === cz);

function losClear(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
  const n = Math.ceil(len / 0.5);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (blocked(ax + dx * t, az + dz * t)) return false;
  }
  return true;
}

function pickTarget() {
  const dx = Math.cos(S.ang), dz = Math.sin(S.ang);
  // wall targets: march forward until the first solid cell
  for (let d = 0.2; d <= REACH; d += 0.25) {
    const cx = ((S.x + dx * d) / CELL) | 0, cz = ((S.z + dz * d) / CELL) | 0;
    if (cx < 0 || cz < 0 || cx >= GW || cz >= GH) break;
    const i = cz * GW + cx;
    if (grid.solid[i]) {
      const g = grid.gate[i] ? gateAt(cx, cz) : null;
      if (g && !S.gates[g.id]) return { type: "gate", gate: g, cx, cz };
      const m = muralAt(cx, cz);
      if (m) return { type: "mural", mural: m, cx, cz };
      break;
    }
  }
  // prop targets: nearest inside the aim cone with a clear line
  let best = null, bestD = 1e9;
  for (const p of visibleProps()) {
    const vx = p.x - S.x, vz = p.z - S.z;
    const d = Math.hypot(vx, vz);
    if (d > REACH || d < 0.001) continue;
    if ((vx / d) * dx + (vz / d) * dz < AIM_COS) continue;
    if (!losClear(S.x, S.z, p.x, p.z)) continue;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best ? { type: best.kind, prop: best } : null;
}

function promptFor(t) {
  if (!t) return "";
  switch (t.type) {
    case "gate": return T("prompt.attuneGate");
    case "mural": return T("prompt.read");
    case "brazier": {
      const st = S.braziers[t.prop.id];
      if (st === "cold") return T("prompt.light");
      if (st === "lit") return T("prompt.rest");
      return T("prompt.inspect");
    }
    case "stele": return T("prompt.inspect");
    case "relic": return T("prompt.take");
    case "node": return T("prompt.touchNode");
    case "core": return T("prompt.core");
  }
  return T("prompt.inspect");
}

// ---------------------------------------------------------------------------
// interaction
// ---------------------------------------------------------------------------
function toast(msg, kind = "") {
  const el = $("toast");
  el.textContent = msg;
  el.className = "show " + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = ""; }, 3400);
}

function interact() {
  const t = pickTarget();
  if (!t) { return; }
  const cur = GLYPH_BY_ID[S.glyph];

  if (t.type === "gate") {
    if (S.charge <= 0) return toast(T("deny.noCharge"));
    if (S.glyph !== t.gate.need.id) {
      toast(T("deny.gate") + " " + T("deny.gate.hint", T("glyph." + t.gate.need.key)));
      return;
    }
    S.gates[t.gate.id] = true;
    openGateCell(t.gate);
    audio.play("gate", { gain: 1 });
    if (opt.shake) S.shake = 0.9;
    toast(T("fb.gateOpened"), "good");
    save();
    return;
  }

  if (t.type === "mural") {
    if (S.charge <= 0) return toast(T("deny.dark"));
    if (S.glyph !== t.mural.need.id) {
      toast(T("deny.mural") + " " + T("deny.mural.hint", T("glyph." + t.mural.need.key)));
      return;
    }
    if (!S.murals[t.mural.key]) { S.murals[t.mural.key] = true; save(); }
    openReader(T(t.mural.key + ".name"), T(t.mural.key + ".text"), "mural");
    return;
  }

  const p = t.prop;
  if (t.type === "brazier") {
    const st = S.braziers[p.id];
    if (st === "cold") {
      if (S.charge <= 0) return toast(T("deny.noCharge"));
      S.braziers[p.id] = "lit";
      addLight(brazierLight(p));
      syncProps();
      S.charge = Math.min(LAMP_MAX, S.charge + BRAZIER_FULL);
      S.respawn = { x: p.x, z: p.z };
      audio.play("glyph", { rate: 0.8 });
      if (opt.flash) S.flashT = 0.35;
      toast(T("fb.brazierLit"), "good");
    } else if (st === "lit") {
      S.braziers[p.id] = "spent";
      S.charge = Math.min(LAMP_MAX, S.charge + BRAZIER_REUSE);
      S.respawn = { x: p.x, z: p.z };
      toast(T("fb.brazierDrawn"), "good");
    } else {
      S.respawn = { x: p.x, z: p.z };
      toast(T("fb.brazierEmpty"));
    }
    save();
    return;
  }

  if (t.type === "stele") {
    const g = p.glyph;
    if (!S.known[g.id]) {
      S.known[g.id] = true;
      S.glyph = g.id;
      syncProps();
      audio.play("glyph");
      audio.play(g.id === 3 ? "alien" : "glyph", { rate: 1.1, gain: 0.7 });
      if (opt.flash) S.flashT = 0.5;
      openReader(T("glyph." + g.key), T(p.note) + "\n\n" + T("glyph." + g.key + ".desc"), "glyph");
      save();
    } else {
      toast(T("glyph." + g.key + ".desc"));
    }
    return;
  }

  if (t.type === "relic") {
    S.relics[p.key] = true;
    p.hidden = true;
    audio.play("glyph", { rate: 1.35, gain: 0.5 });
    openReader(T(p.key + ".name"), T(p.key + ".text"), "relic");
    save();
    return;
  }

  if (t.type === "node") {
    if (S.glyph !== GLYPH.CHASKA.id || S.charge <= 0) {
      toast(T("deny.node") + " " + T("deny.node.hint", T("glyph.chaska")));
      return;
    }
    audio.play("alien");
    S.charge = Math.min(LAMP_MAX, S.charge + 22);
    toast(T(p.note), "alien");
    return;
  }

  if (t.type === "core") {
    if (S.glyph !== GLYPH.CHASKA.id || S.charge <= 0) {
      toast(T("deny.node") + " " + T("deny.node.hint", T("glyph.chaska")));
      return;
    }
    openEndingChoice();
    return;
  }
}

function attune(id) {
  if (!S.known[id]) return toast(T("fb.attuneNoGlyph"));
  if (S.glyph === id) return;
  if (S.charge <= ATTUNE_COST) return toast(T("deny.noCharge"));
  S.charge -= ATTUNE_COST;
  S.glyph = id;
  audio.play("glyph", { rate: 0.9 + id * 0.14, gain: 0.6 });
  toast(T("fb.attuned") + " — " + T("glyph." + GLYPH_BY_ID[id].key));
  updateChips();
}
function cycleGlyph(dir) {
  const avail = [0, 1, 2, 3].filter(i => S.known[i]);
  const at = avail.indexOf(S.glyph);
  attune(avail[(at + dir + avail.length) % avail.length]);
}

// ---------------------------------------------------------------------------
// objectives — the current goal is always one line, always on return
// ---------------------------------------------------------------------------
function objectiveKey() {
  if (S.ended) return "obj.done";
  if (S.braziers.b1 === "cold") return "obj.1";
  if (!S.known[1]) return ((S.x / CELL) | 0) < 13 ? "obj.2" : "obj.3";
  if (!S.gates[1]) return "obj.4";
  if (!S.known[2]) return "obj.5";
  if (!S.gates[2]) return "obj.6";
  if (!S.known[3]) return ((S.x / CELL) | 0) < 39 ? "obj.7" : "obj.8";
  if (!S.gates[3]) return "obj.9";
  return "obj.10";
}

// ---------------------------------------------------------------------------
// the Watcher
// ---------------------------------------------------------------------------
let flow = null, flowAt = 0;
function computeFlow() {
  const n = GW * GH;
  if (!flow) flow = new Int32Array(n);
  flow.fill(-1);
  const q = new Int32Array(n);
  let head = 0, tail = 0;
  const s = ((S.z / CELL) | 0) * GW + ((S.x / CELL) | 0);
  flow[s] = 0; q[tail++] = s;
  while (head < tail) {
    const i = q[head++], x = i % GW, z = (i / GW) | 0;
    const d = flow[i];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= GW || nz >= GH) continue;
      const j = nz * GW + nx;
      if (flow[j] >= 0 || grid.solid[j]) continue;
      flow[j] = d + 1; q[tail++] = j;
    }
  }
}
function updateWatcher(dt) {
  if (S.ended) { S.watcher = null; return; }
  if (S.charge > 0) {
    S.dark = 0;
    if (S.watcher) { S.watcher = null; audio.setDread(0); }
    return;
  }
  S.dark += dt;
  const t = Math.min(1, S.dark / (WATCH_DELAY + 10));
  audio.setDread(t);
  if (S.dark < WATCH_DELAY) return;

  if (!S.watcher) {
    computeFlow();
    // spawn out of sight, roughly eight cells back along the corridor
    let best = null, bestScore = 1e9;
    for (let i = 0; i < GW * GH; i++) {
      if (flow[i] < 6 || flow[i] > 14) continue;
      const score = Math.abs(flow[i] - 9);
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best === null) return;
    S.watcher = { x: ((best % GW) + 0.5) * CELL, z: (((best / GW) | 0) + 0.5) * CELL };
    toast(T("watch.near"), "bad");
    audio.play("alien", { rate: 0.55, gain: 0.9 });
    flowAt = 0;
  }
  flowAt -= dt;
  if (flowAt <= 0) { computeFlow(); flowAt = 0.4; }
  const wx = (S.watcher.x / CELL) | 0, wz = (S.watcher.z / CELL) | 0;
  let bx = wx, bz = wz, bd = flow[wz * GW + wx];
  if (bd < 0) bd = 1e9;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = wx + dx, nz = wz + dz;
    if (nx < 0 || nz < 0 || nx >= GW || nz >= GH) continue;
    const f = flow[nz * GW + nx];
    if (f >= 0 && f < bd) { bd = f; bx = nx; bz = nz; }
  }
  const tx = (bx + 0.5) * CELL, tz = (bz + 0.5) * CELL;
  const dx = tx - S.watcher.x, dz = tz - S.watcher.z, d = Math.hypot(dx, dz) || 1;
  S.watcher.x += dx / d * WATCH_SPEED * dt;
  S.watcher.z += dz / d * WATCH_SPEED * dt;

  if (Math.hypot(S.watcher.x - S.x, S.watcher.z - S.z) < WATCH_CATCH) caught();
}
function caught() {
  S.watcher = null; S.dark = 0;
  audio.setDread(0);
  S.x = S.respawn.x; S.z = S.respawn.z;
  S.charge = 35;
  toast(T("watch.caught") + " " + T("watch.wake"), "bad");
  if (opt.shake) S.shake = 1.2;
  save();
}

// ---------------------------------------------------------------------------
// simulation
// ---------------------------------------------------------------------------
function update(dt) {
  if (phase !== "play") return;
  S.time += dt;

  const pad = pollPad();

  // look
  let yaw = mouseDX * 0.0022 * opt.sens;
  let pit = mouseDY * 0.0022 * opt.sens * (opt.invertY ? -1 : 1);
  mouseDX = 0; mouseDY = 0;
  yaw += pad.lx * 2.6 * dt * opt.sens;
  pit += pad.ly * 2.6 * dt * opt.sens * 90 * (opt.invertY ? -1 : 1) * 0.011;
  S.ang += yaw;
  S.pitch = Math.max(-canvasH * 0.34, Math.min(canvasH * 0.34, S.pitch - pit * 260));

  // move
  let fx = 0, fz = 0;
  if (held.has("up")) fz += 1;
  if (held.has("down")) fz -= 1;
  if (held.has("left")) fx -= 1;
  if (held.has("right")) fx += 1;
  fx += pad.ax; fz -= pad.az;
  fx += stick.x; fz -= stick.y;
  const mag = Math.hypot(fx, fz);
  if (mag > 1) { fx /= mag; fz /= mag; }
  const speed = held.has("sprint") ? SPRINT : WALK;
  const dirX = Math.cos(S.ang), dirZ = Math.sin(S.ang);
  const dx = (dirX * fz - dirZ * fx) * speed * dt;
  const dz = (dirZ * fz + dirX * fx) * speed * dt;
  if (dx || dz) {
    const before = S.x + S.z;
    moveBy(dx, dz);
    const moved = Math.hypot(dx, dz);
    S.bob += moved * 3.4;
    S.stepDist += moved;
    if (S.stepDist > 1.9) {
      S.stepDist = 0;
      audio.play("step", { rate: 0.86 + Math.random() * 0.3, gain: 0.55 });
    }
    void before;
  }

  // lamp economy
  if (S.charge > 0) S.charge = Math.max(0, S.charge - LAMP_DRAIN * dt);
  if (S.charge > 0 && S.charge < 14 && !S._warned) { S._warned = true; toast(T("watch.warn"), "bad"); }
  if (S.charge > 20) S._warned = false;

  updateWatcher(dt);
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 1.6);
  if (S.flashT > 0) S.flashT = Math.max(0, S.flashT - dt * 2.2);
}

// ---------------------------------------------------------------------------
// presentation
// ---------------------------------------------------------------------------
let canvasW = 448, canvasH = 252;
const ctx = canvas.getContext("2d", { alpha: false });
let off = document.createElement("canvas");
let offCtx = off.getContext("2d");
let grainTiles = [];

function makeGrain() {
  grainTiles = [];
  for (let k = 0; k < 4; k++) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const id = g.createImageData(128, 128);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 118 + ((Math.random() * 74) | 0);
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    grainTiles.push(c);
  }
}

function resize() {
  const cssW = innerWidth, cssH = innerHeight;
  canvas.style.width = cssW + "px"; canvas.style.height = cssH + "px";
  // Budget the internal buffer by pixel count, not by width: a tall phone in portrait
  // would otherwise get a far bigger buffer than a wide desktop at the same "width".
  const budget = ([58000, 108000, 168000][opt.quality] || 108000) * (isTouch ? 0.62 : 1);
  const aspect = cssW / cssH;
  canvasW = Math.max(200, Math.min(760, Math.round(Math.sqrt(budget * aspect))));
  canvasH = Math.max(140, Math.round(canvasW / aspect));
  canvas.width = cssW <= 900 ? cssW : Math.min(1600, cssW);
  canvas.height = Math.round(canvas.width * cssH / cssW);
  off.width = canvasW; off.height = canvasH;
  offCtx = off.getContext("2d");
  renderer.setSize(canvasW, canvasH);
  ctx.imageSmoothingEnabled = true;
  document.documentElement.style.setProperty("--ts", opt.textScale);
}
addEventListener("resize", resize);
addEventListener("orientationchange", () => setTimeout(resize, 120));

const lampObj = { radius: 6, rgb: [1, 0.72, 0.38], power: 1, phase: false };
let frameNo = 0;

function render() {
  const g = GLYPH_BY_ID[S.glyph];
  const flicker = 0.94 + Math.sin(S.time * 11.3) * 0.03 + Math.sin(S.time * 27.7) * 0.025;
  const low = Math.min(1, S.charge / 18);
  lampObj.radius = g.radius;
  lampObj.rgb = g.rgb;
  lampObj.power = S.charge > 0 ? 1.05 * flicker * low : 0;
  lampObj.phase = S.glyph === GLYPH.CHASKA.id && S.charge > 0;

  const bob = Math.sin(S.bob) * 2.2 * (opt.shake ? 1 : 0);
  const shake = S.shake > 0 && opt.shake ? (Math.random() - 0.5) * S.shake * 14 : 0;
  const cam = { x: S.x, z: S.z, ang: S.ang, pitch: S.pitch + bob + shake };

  const sprites = visibleProps();
  if (S.watcher) {
    // the Watcher is never drawn as a creature — only as the absence of light moving
    sprites.push({ x: S.watcher.x, z: S.watcher.z, w: 1.4, h: 2.4, yOff: 0, img: SPR.node, glow: 0.05, glowRgb: [0.2, 0.25, 0.3] });
  }
  const img = renderer.render(cam, grid, sprites, lampObj);
  offCtx.putImageData(img, 0, 0);

  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);

  if (opt.grain && grainTiles.length) {
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.globalCompositeOperation = "overlay";
    const t = grainTiles[(frameNo >> 1) & 3];
    const s = 3;
    for (let y = 0; y < canvas.height; y += 128 * s)
      for (let x = 0; x < canvas.width; x += 128 * s)
        ctx.drawImage(t, x, y, 128 * s, 128 * s);
    ctx.restore();
  }
  if (S.flashT > 0 && opt.flash) {
    ctx.save();
    ctx.globalAlpha = S.flashT * 0.35;
    ctx.fillStyle = "#cfe6ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  frameNo++;
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
const chipCanvases = {};
function updateChips() {
  const wrap = $("chips");
  wrap.innerHTML = "";
  for (const id of [0, 1, 2, 3]) {
    if (!S.known[id]) continue;
    const gl = GLYPH_BY_ID[id];
    const b = document.createElement("button");
    b.className = "chip" + (S.glyph === id ? " on" : "");
    b.title = T("glyph." + gl.key);
    const c = document.createElement("canvas");
    c.width = c.height = 34;
    const g2 = c.getContext("2d");
    const col = `rgb(${gl.rgb.map(v => (v * 255) | 0).join(",")})`;
    drawGlyphMark(g2, gl.shape, 17, 17, 11, col);
    b.appendChild(c);
    const n = document.createElement("span");
    n.textContent = id === 0 ? "0" : String(id);
    b.appendChild(n);
    b.onclick = () => { attune(id); };
    wrap.appendChild(b);
  }
}

function updateHud() {
  const pct = Math.max(0, S.charge) / LAMP_MAX;
  $("lampFill").style.transform = `scaleX(${pct})`;
  $("lampWrap").className = pct < 0.16 ? "low" : "";
  $("lampNum").textContent = Math.ceil(Math.max(0, S.charge));
  const t = pickTarget();
  const p = promptFor(t);
  $("prompt").textContent = p ? "[E] " + p : "";
  $("prompt").style.opacity = p ? 1 : 0;
  $("objective").textContent = T(objectiveKey());
  $("reticle").style.opacity = t ? 1 : 0.35;
}

// ---------------------------------------------------------------------------
// panels
// ---------------------------------------------------------------------------
let phase = "menu";
function setPhase(p) {
  phase = p;
  for (const id of ["menu", "codex", "reader", "pause", "ending"]) $(id).classList.toggle("open", id === p);
  $("hud").classList.toggle("open", p === "play");
  $("touchsurf").style.display = (p === "play" && isTouch) ? "block" : "none";
  $("touchbtns").style.display = (p === "play" && isTouch) ? "flex" : "none";
  if (p === "play") { audio.resume(); audio.startBeds(); }
  if (p !== "play" && document.pointerLockElement === canvas) document.exitPointerLock();
}

function openReader(title, body, kind) {
  $("readerTitle").textContent = title;
  $("readerBody").textContent = body;
  $("reader").dataset.kind = kind || "";
  setPhase("reader");
}
$("readerClose").onclick = () => setPhase("play");

function openCodex() {
  const wrap = $("codexBody");
  wrap.innerHTML = "";
  const sec = (title, rows) => {
    const h = document.createElement("h3"); h.textContent = title; wrap.appendChild(h);
    if (!rows.length) { const e = document.createElement("p"); e.className = "dim"; e.textContent = T("codex.empty"); wrap.appendChild(e); return; }
    for (const r of rows) {
      const d = document.createElement("div"); d.className = "entry";
      const n = document.createElement("div"); n.className = "en"; n.textContent = r[0];
      const b = document.createElement("div"); b.className = "eb"; b.textContent = r[1];
      d.appendChild(n); d.appendChild(b); wrap.appendChild(d);
    }
  };
  sec(T("codex.tabLights"), [0, 1, 2, 3].filter(i => S.known[i])
    .map(i => [T("glyph." + GLYPH_BY_ID[i].key), T("glyph." + GLYPH_BY_ID[i].key + ".desc")]));
  const finds = PROPS.filter(p => p.kind === "relic" && S.relics[p.key]).map(p => [T(p.key + ".name"), T(p.key + ".text")]);
  sec(T("codex.tabFinds") + " — " + T("codex.found", finds.length, TOTAL_RELICS), finds);
  const walls = MURALS.filter(m => S.murals[m.key]).map(m => [T(m.key + ".name"), T(m.key + ".text")]);
  sec(T("codex.tabWalls") + " — " + T("codex.found", walls.length, TOTAL_MURALS), walls);
  setPhase("codex");
}
$("codexClose").onclick = () => setPhase("play");

function openEndingChoice() {
  const hasSeed = !!S.relics["relic.seed"];
  $("endTitle").textContent = T("end.choose");
  $("endBody").textContent = T("node.core");
  $("endStats").textContent = "";
  const box = $("endBtns"); box.innerHTML = "";
  if (hasSeed) box.appendChild(btn(T("end.seal"), () => finish("seal")));
  box.appendChild(btn(T("end.wake"), () => finish("wake")));
  box.appendChild(btn(T("menu.back"), () => setPhase("play")));
  setPhase("ending");
}
function btn(label, fn) {
  const b = document.createElement("button");
  b.className = "big"; b.textContent = label; b.onclick = fn;
  return b;
}
function finish(which) {
  S.ended = which;
  audio.play("alien", { gain: 1 });
  if (opt.flash) S.flashT = 1.2;
  const relics = Object.keys(S.relics).length, walls = Object.keys(S.murals).length;
  const mm = Math.floor(S.time / 60), ss = Math.floor(S.time % 60);
  $("endTitle").textContent = T(which === "seal" ? "end.sealTitle" : "end.wakeTitle");
  $("endBody").textContent = T(which === "seal" ? "end.sealText" : "end.wakeText");
  $("endStats").textContent = T("end.stats", relics, TOTAL_RELICS, walls, TOTAL_MURALS, `${mm}:${String(ss).padStart(2, "0")}`);
  const box = $("endBtns"); box.innerHTML = "";
  box.appendChild(btn(T("end.again"), () => { localStorage.removeItem(SAVE_KEY); newGame(); }));
  setPhase("ending");
  localStorage.removeItem(SAVE_KEY);
}

// ---------------------------------------------------------------------------
// save / load
// ---------------------------------------------------------------------------
function save() {
  if (!S || S.ended) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage may be denied */ }
}
function hasSave() { return !!localStorage.getItem(SAVE_KEY); }

function newGame() {
  S = freshState();
  rebuildWorld();
  updateChips();
  setPhase("play");
}
function continueGame() {
  try {
    S = Object.assign(freshState(), JSON.parse(localStorage.getItem(SAVE_KEY)));
    S.watcher = null; S.dark = 0;
  } catch (e) { S = freshState(); }
  rebuildWorld();
  updateChips();
  setPhase("play");
}

// ---------------------------------------------------------------------------
// menu / options wiring
// ---------------------------------------------------------------------------
function fillStatic() {
  $("title").textContent = T("title");
  $("subtitle").textContent = T("subtitle");
  $("btnStart").textContent = T("menu.start");
  $("btnContinue").textContent = T("menu.continue");
  $("btnControls").textContent = T("menu.controls");
  $("btnOptions").textContent = T("menu.options");
  $("ctrlTitle").textContent = T("ctrl.title");
  $("ctrlHint").textContent = T("ctrl.hint");
  $("optTitle").textContent = T("opt.title");
  $("codexTitle").textContent = T("codex.title");
  $("codexClose").textContent = T("codex.close");
  $("readerClose").textContent = T("codex.close");
  $("pauseTitle").textContent = T("pause.title");
  $("btnResume").textContent = T("pause.resume");
  $("btnRestart").textContent = T("pause.restart");
  $("btnQuit").textContent = T("pause.quit");
  $("credit").textContent = T("end.credit");
  $("hudLampLabel").textContent = T("hud.lamp");
  $("objLabel").textContent = T("hud.objective");

  const rows = [
    ["ctrl.move", "ctrl.moveKeys"], ["ctrl.look", "ctrl.lookKeys"],
    ["ctrl.sprint", "ctrl.sprintKeys"], ["ctrl.interact", "ctrl.interactKeys"],
    ["ctrl.attune", "ctrl.attuneKeys"], ["ctrl.codex", "ctrl.codexKeys"],
    ["ctrl.pause", "ctrl.pauseKeys"],
  ];
  $("ctrlRows").innerHTML = rows.map(([a, b]) =>
    `<div class="crow"><span>${T(a)}</span><b>${T(b)}</b></div>`).join("");

  const o = $("optRows");
  o.innerHTML = "";
  const row = (label, el) => {
    const d = document.createElement("div"); d.className = "crow";
    const s = document.createElement("span"); s.textContent = label;
    d.appendChild(s); d.appendChild(el); o.appendChild(d);
  };
  const slider = (key, min, max, step) => {
    const i = document.createElement("input");
    i.type = "range"; i.min = min; i.max = max; i.step = step; i.value = opt[key];
    i.oninput = () => { opt[key] = +i.value; saveOpt(); applyOpt(); };
    return i;
  };
  const toggle = (key) => {
    const b = document.createElement("button");
    const sync = () => b.textContent = opt[key] ? T("opt.on") : T("opt.off");
    b.onclick = () => { opt[key] = !opt[key]; saveOpt(); applyOpt(); sync(); };
    sync(); return b;
  };
  row(T("opt.sensitivity"), slider("sens", 0.4, 2.5, 0.05));
  row(T("opt.invertY"), toggle("invertY"));
  row(T("opt.textScale"), slider("textScale", 0.85, 1.5, 0.05));
  row(T("opt.shake"), toggle("shake"));
  row(T("opt.flash"), toggle("flash"));
  row(T("opt.grain"), toggle("grain"));
  const q = document.createElement("button");
  const qsync = () => q.textContent = [T("opt.qualityLow"), T("opt.qualityMed"), T("opt.qualityHigh")][opt.quality];
  q.onclick = () => { opt.quality = (opt.quality + 1) % 3; saveOpt(); resize(); qsync(); };
  qsync(); row(T("opt.quality"), q);
  row(T("opt.music"), slider("music", 0, 1, 0.05));
  row(T("opt.sfx"), slider("sfx", 0, 1, 0.05));
  if (Object.keys(LANGS).length > 1) {
    const sel = document.createElement("select");
    for (const [k, v] of Object.entries(LANGS)) {
      const o2 = document.createElement("option"); o2.value = k; o2.textContent = v;
      if (opt.lang === k) o2.selected = true; sel.appendChild(o2);
    }
    sel.onchange = () => { opt.lang = sel.value; setLang(sel.value); saveOpt(); fillStatic(); };
    row(T("opt.language"), sel);
  }
}
function applyOpt() {
  document.documentElement.style.setProperty("--ts", opt.textScale);
  audio.setMusicVol(opt.music);
  audio.setSfxVol(opt.sfx);
}

function showPanel(name) {
  for (const p of ["mainPanel", "ctrlPanel", "optPanel"]) $(p).classList.toggle("open", p === name);
}
$("btnStart").onclick = () => { localStorage.removeItem(SAVE_KEY); newGame(); };
$("btnContinue").onclick = () => continueGame();
$("btnControls").onclick = () => showPanel("ctrlPanel");
$("btnOptions").onclick = () => showPanel("optPanel");
for (const b of document.querySelectorAll(".backBtn")) b.onclick = () => showPanel("mainPanel");
$("btnResume").onclick = () => setPhase("play");
$("btnRestart").onclick = () => { localStorage.removeItem(SAVE_KEY); newGame(); };
$("btnQuit").onclick = () => { save(); setPhase("menu"); showPanel("mainPanel"); $("btnContinue").style.display = hasSave() ? "" : "none"; };

// ---------------------------------------------------------------------------
// loop
// ---------------------------------------------------------------------------
let acc = 0, last = performance.now(), frames = 0, fpsAt = last;
const dev = new URLSearchParams(location.search).has("dev");
let hudAt = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let delta = now - last; last = now;
  if (delta > 250) delta = 250;

  if (phase === "play") {
    acc += delta;
    let guard = 0;
    while (acc >= STEP && guard++ < 6) { update(STEP / 1000); acc -= STEP; }

    if (edge.has("use")) interact();
    if (edge.has("codex")) openCodex();
    if (edge.has("pause")) setPhase("pause");
    if (edge.has("g0")) attune(0);
    if (edge.has("g1")) attune(1);
    if (edge.has("g2")) attune(2);
    if (edge.has("g3")) attune(3);
    if (edge.has("cyclePrev")) cycleGlyph(-1);
    if (edge.has("cycleNext")) cycleGlyph(1);

    render();
    hudAt -= delta;
    if (hudAt <= 0) { updateHud(); hudAt = 90; }
  } else {
    pollPad();
    if (edge.has("pause") && phase === "pause") setPhase("play");
    else if (edge.has("use") || edge.has("pause") || edge.has("codex")) {
      if (phase === "reader" || phase === "codex") setPhase("play");
    }
  }
  edge.clear();

  if (dev) {
    frames++;
    if (now - fpsAt >= 500) {
      const fps = Math.round(frames * 1000 / (now - fpsAt));
      frames = 0; fpsAt = now;
      $("dev").textContent = `${fps} fps · ${canvasW}×${canvasH} · lights ${lights.length} · props ${props.length}`;
    }
  }
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
async function boot() {
  setLang(opt.lang);
  fillStatic();
  applyOpt();
  makeGrain();
  SPR = buildSprites();
  S = freshState();
  resize();
  if (isTouch) bindTouch();
  if (dev) $("dev").style.display = "block";

  const bar = $("loadBar");
  let n = 0;
  const total = TEXTURE_FILES.length + 1;
  const tick = () => { bar.style.transform = `scaleX(${++n / total})`; };

  $("loadMsg").textContent = T("menu.loadingAssets");
  await Promise.all(TEXTURE_FILES.map(([f, slot]) => loadTexture(f, slot).then(tick).catch(tick)));
  await audio.init(AUDIO_FILES, () => {}).catch(() => {});
  tick();

  rebuildWorld();
  $("loading").classList.remove("open");
  $("btnContinue").style.display = hasSave() ? "" : "none";
  showPanel("mainPanel");
  setPhase("menu");
  requestAnimationFrame(frame);
}

// Dev instrumentation (?dev=1 only): a readable state handle and a programmatic input
// route, so the reference route can be driven and the frame budget measured.
if (dev) {
  window.__g = {
    get S() { return S; },
    get lights() { return lights; },
    face(cx, cz) {
      S.ang = Math.atan2((cz + 0.5) * CELL - S.z, (cx + 0.5) * CELL - S.x);
      S.pitch = 0;
    },
    goto(cx, cz) { S.x = (cx + 0.5) * CELL; S.z = (cz + 0.5) * CELL; },
    target() { const t = pickTarget(); return t && { type: t.type, prompt: promptFor(t) }; },
    act() { interact(); },
    attune,
    phase: () => phase,
    setPhase,
    objective: () => objectiveKey(),
    texturesLoaded: () => TEXTURE_FILES.every(([, slot]) => !!renderer.tex[slot]),
    audioLoaded: () => Object.keys(audio.buf).length,
    // average render cost over n frames, in milliseconds
    perf(n = 60) {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) render();
      return (performance.now() - t0) / n;
    },
    // same, split by stage, so "slow" is diagnosed instead of guessed at
    perfSplit(n = 40) {
      const cam = { x: S.x, z: S.z, ang: S.ang, pitch: S.pitch };
      const sp = visibleProps();
      let t = performance.now();
      for (let i = 0; i < n; i++) renderer.render(cam, grid, sp, lampObj);
      const cast = (performance.now() - t) / n;
      const img = renderer.render(cam, grid, sp, lampObj);
      t = performance.now();
      for (let i = 0; i < n; i++) offCtx.putImageData(img, 0, 0);
      const blit = (performance.now() - t) / n;
      t = performance.now();
      for (let i = 0; i < n; i++) ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
      const scale = (performance.now() - t) / n;
      t = performance.now();
      for (let i = 0; i < n; i++) render();
      const full = (performance.now() - t) / n;
      return { cast, blit, scale, full, overlays: full - cast - blit - scale };
    },
  };
}

// touch buttons
$("btnUse").addEventListener("touchstart", e => { e.preventDefault(); interact(); }, { passive: false });
$("btnCodex").addEventListener("touchstart", e => { e.preventDefault(); openCodex(); }, { passive: false });
$("btnPause").addEventListener("touchstart", e => { e.preventDefault(); setPhase("pause"); }, { passive: false });

addEventListener("visibilitychange", () => { if (document.hidden && phase === "play") setPhase("pause"); });

boot();

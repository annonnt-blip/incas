// Level validation: every gate is a real chokepoint, everything is reachable in the
// intended order, and no prop is buried in rock. Run: node tools/validate.mjs
import * as W from "../public/src/world.js";

const { GW, GH, CELL, START, GATES, PHASE, MURALS, PROPS } = W;
const grid = W.buildGrid();
let fail = 0;
const bad = m => { console.log("  FAIL  " + m); fail++; };
const ok = m => console.log("  ok    " + m);

// --- reachability, honouring the gate order -------------------------------------------
function flood(openGates, phaseOpen) {
  const seen = new Uint8Array(GW * GH);
  const start = START.cz * GW + START.cx;
  const q = [start]; seen[start] = 1;
  while (q.length) {
    const i = q.pop(), x = i % GW, z = (i / GW) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= GW || nz >= GH) continue;
      const j = nz * GW + nx;
      if (seen[j]) continue;
      const isGate = grid.gate[j];
      const isPhase = grid.phase[j];
      if (grid.solid[j] && !(isGate && openGates.has(isGate)) && !(isPhase && phaseOpen)) continue;
      seen[j] = 1; q.push(j);
    }
  }
  return seen;
}

const cellOf = p => p.cz * GW + p.cx;

console.log("\n= geometry =");
if (grid.solid[START.cz * GW + START.cx]) bad("the start cell is solid");
else ok("start cell is open");

for (const p of PROPS) {
  if (grid.solid[cellOf(p)]) bad(`prop ${p.kind} ${p.key || p.id || ""} at (${p.cx},${p.cz}) is inside rock`);
}
for (const m of MURALS) {
  if (!grid.solid[cellOf(m)]) bad(`mural ${m.key} at (${m.cx},${m.cz}) is not on a wall`);
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !grid.solid[(m.cz + dz) * GW + m.cx + dx]);
  if (!nb) bad(`mural ${m.key} at (${m.cx},${m.cz}) has no open cell to read it from`);
}
if (!fail) ok("every prop stands on floor and every mural faces a room");

// --- each gate must be the only way onward --------------------------------------------
console.log("\n= gates are chokepoints =");
for (const g of GATES) {
  const without = flood(new Set([...GATES.map(x => x.id)].filter(id => id !== g.id)), true);
  const withAll = flood(new Set(GATES.map(x => x.id)), true);
  let sealed = 0;
  for (let i = 0; i < GW * GH; i++) if (withAll[i] && !without[i]) sealed++;
  if (sealed < 8) bad(`gate ${g.id} seals only ${sealed} cells — it can be walked around`);
  else ok(`gate ${g.id} (${g.need.key}) is the only way into ${sealed} cells`);
}

// --- the intended order actually holds -------------------------------------------------
console.log("\n= progression order =");
const steles = PROPS.filter(p => p.kind === "stele");
const order = [
  { need: 1, gate: 1 }, { need: 2, gate: 2 }, { need: 3, gate: 3 },
];
let opened = new Set();
for (const step of order) {
  const reach = flood(opened, opened.has(3));
  const stele = steles.find(s => s.glyph.id === step.need);
  if (!reach[cellOf(stele)]) bad(`the ${stele.glyph.key} stele is not reachable before gate ${step.gate}`);
  else ok(`${stele.glyph.key} stele reachable with gates {${[...opened]}} open`);
  const g = GATES.find(x => x.id === step.gate);
  const front = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dz]) => reach[(g.cz + dz) * GW + g.cx + dx]);
  if (!front) bad(`gate ${step.gate} cannot even be stood in front of at this point`);
  opened.add(step.gate);
}

// --- everything is eventually reachable ------------------------------------------------
console.log("\n= full clear =");
const all = flood(new Set([1, 2, 3]), true);
for (const p of PROPS) if (!all[cellOf(p)]) bad(`prop ${p.kind} ${p.key || p.id || ""} is unreachable`);
for (const m of MURALS) {
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => all[(m.cz + dz) * GW + m.cx + dx]);
  if (!nb) bad(`mural ${m.key} is unreachable`);
}
// the phase-walled alcoves must be sealed without CHASKA and open with it
const noPhase = flood(new Set([1, 2, 3]), false);
for (const p of PHASE) {
  const behind = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([dx, dz]) => (p.cz + dz) * GW + p.cx + dx)
    .filter(j => !grid.solid[j]);
  const hidden = behind.some(j => !noPhase[j] && all[j]);
  if (!hidden && behind.length) ok(`phase wall (${p.cx},${p.cz}) borders open ground on both sides`);
}
const seed = PROPS.find(p => p.key === "relic.seed");
if (noPhase[cellOf(seed)]) bad("the seed can be taken without CHASKA — the seal means nothing");
else ok("the seed sits behind a phase wall, reachable only under CHASKA");

let openCells = 0;
for (let i = 0; i < GW * GH; i++) if (!grid.solid[i]) openCells++;
console.log(`\n  ${openCells} open cells · ${PROPS.length} props · ${MURALS.length} murals`);
console.log(fail ? `\nFAILED with ${fail} problem(s)\n` : "\nAll level checks passed\n");
process.exit(fail ? 1 : 0);

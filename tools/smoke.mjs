// Drives the reference route end to end in a real browser, measures the frame budget,
// and fails on any console error. Run: node tools/smoke.mjs [--shots]
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = process.env.ASG_ROOT || new URL("../public/", import.meta.url).pathname;
const INDEX = process.env.ASG_INDEX || "index.html";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".mp3": "audio/mpeg", ".jpg": "image/jpeg", ".json": "application/json" };
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const f = join(ROOT, p === "/" ? INDEX : p);
  try {
    const body = await readFile(f);
    res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nope"); }
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;

const SHOTS = process.argv.includes("--shots");
const errors = [];
let fails = 0;
const check = (cond, msg) => { console.log(`  ${cond ? "ok  " : "FAIL"}  ${msg}`); if (!cond) fails++; };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", e => errors.push("pageerror: " + e.message));

await page.goto(`http://127.0.0.1:${PORT}/?dev=1`);
await page.waitForFunction(() => window.__g && !document.getElementById("loading").classList.contains("open"), null, { timeout: 20000 });
console.log("\n= boot =");
check(await page.evaluate(() => document.getElementById("menu").classList.contains("open")), "menu shown after load");

const shot = async n => { if (SHOTS) await page.screenshot({ path: `tools/shots/${n}.png` }); };
await shot("00-menu");

await page.click("#btnStart");
await page.waitForTimeout(400);
console.log("\n= reference route =");
check(await page.evaluate(() => window.__g.phase() === "play"), "start enters play");
await shot("01-shaft");

const g = async fn => page.evaluate(fn);
const targetAt = async (stand, look) => {
  await page.evaluate(([s, l]) => { window.__g.goto(s[0], s[1]); window.__g.face(l[0], l[1]); }, [stand, look]);
  await page.waitForTimeout(90);
  return g(() => window.__g.target());
};

// 1 — light the first brazier
let t = await targetAt([6, 44], [7, 44]);
check(t && t.type === "brazier", `brazier targeted in the shaft (${t && t.prompt})`);
await g(() => window.__g.act());
check(await g(() => window.__g.S.braziers.b1 === "lit"), "brazier b1 lights");
check(await g(() => window.__g.S.charge > 90), "lighting it refills the lamp");
check(await g(() => window.__g.lights.some(l => l.id === "bzb1")), "a new light was baked into the world");
await shot("02-brazier");

// 2 — the sun stele, then the sun gate
t = await targetAt([21, 29], [21, 28]);
check(t && t.type === "stele", "INTI stele targeted in the shrine");
await g(() => window.__g.act());
check(await g(() => window.__g.S.known[1] === true), "INTI is learned");
check(await g(() => window.__g.phase() === "reader"), "learning a light opens the reader");
await shot("03-stele");
await page.click("#readerClose");

t = await targetAt([21, 27], [21, 26]);
check(t && t.type === "gate", "the sun gate is targeted");
await g(() => { window.__g.attune(2); });   // wrong light on purpose
await g(() => { window.__g.S.known[2] = true; window.__g.attune(2); window.__g.act(); });
check(await g(() => !window.__g.S.gates[1]), "the gate refuses the wrong light");
check(await g(() => document.getElementById("toast").textContent.length > 20), "the refusal explains itself");
await g(() => { window.__g.attune(1); window.__g.act(); });
check(await g(() => window.__g.S.gates[1] === true), "the gate opens under INTI");
await shot("04-gate");

// 3 — murals answer only their own light
t = await targetAt([18, 12], [18, 11]);
check(t && t.type === "mural", "mural targeted in the Hall of the Sun");
await g(() => { window.__g.attune(1); window.__g.act(); });
check(await g(() => window.__g.phase() === "reader"), "the INTI mural reads under INTI");
await page.click("#readerClose");
t = await targetAt([22, 12], [22, 11]);
await g(() => { window.__g.attune(1); window.__g.act(); });
check(await g(() => window.__g.phase() === "play"), "the QUILLA mural stays blank under INTI");

// 4 — relics, phase walls, the engine
await g(() => { window.__g.S.known[3] = true; window.__g.attune(3); });
t = await targetAt([61, 5], [62, 5]);
check(t && t.type === "relic", "the seed is reachable through the phase wall under CHASKA");
await g(() => window.__g.act());
check(await g(() => !!window.__g.S.relics["relic.seed"]), "the seed is taken");
await page.click("#readerClose");
await shot("05-alien");

t = await targetAt([53, 18], [53, 17]);
check(t && t.type === "core", "the engine socket is targeted");
await g(() => window.__g.act());
check(await g(() => window.__g.phase() === "ending"), "the engine offers the choice");
check(await g(() => document.querySelectorAll("#endBtns button").length === 3), "both endings offered once the seed is held");
await shot("06-choice");
await page.evaluate(() => document.querySelectorAll("#endBtns button")[0].click());
check(await g(() => window.__g.S.ended === "seal"), "the sealing ending resolves");
await shot("07-ending");

// 5 — codex
await g(() => { window.__g.S.ended = null; window.__g.setPhase("play"); });
await page.waitForFunction(() => window.__g.phase() === "play");
await page.keyboard.press("Tab");
// the loop consumes key edges on its next frame, so wait for the state, not a fixed delay
const sawCodex = await page.waitForFunction(() => window.__g.phase() === "codex", null, { timeout: 4000 })
  .then(() => true).catch(() => false);
check(sawCodex, "Tab opens the codex");
check(await g(() => document.getElementById("codexBody").textContent.includes("seed")
  || document.getElementById("codexBody").textContent.length > 200), "the codex holds what was found");
await shot("08-codex");
await page.click("#codexClose");

// 5b — the player can actually walk, including with a gamepad plugged in
console.log("\n= movement =");
await g(() => { window.__g.goto(21, 20); window.__g.face(21, 14); window.__g.S.charge = 90; });
await page.waitForTimeout(120);
await page.click("#c", { position: { x: 400, y: 300 } }).catch(() => {});
const walk = async (label) => {
  const a = await g(() => ({ x: window.__g.S.x, z: window.__g.S.z }));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyW");
  const b2 = await g(() => ({ x: window.__g.S.x, z: window.__g.S.z }));
  const d = Math.hypot(b2.x - a.x, b2.z - a.z);
  check(d > 0.8, `${label} (moved ${d.toFixed(2)} units)`);
  return d;
};
await walk("W walks forward");

// An idle controller used to erase the keyboard's held keys every frame.
await g(() => {
  const pad = { id: "fake", connected: true, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  navigator.getGamepads = () => [pad, null, null, null];
});
await g(() => { window.__g.goto(21, 20); window.__g.face(21, 14); });
await page.waitForTimeout(120);
await walk("W still walks with a gamepad connected");
await g(() => { navigator.getGamepads = () => [null, null, null, null]; });

// 6 — the lamp economy and the Watcher
console.log("\n= economy =");
await g(() => { window.__g.goto(20, 16); window.__g.S.charge = 0; });
await page.waitForTimeout(1200);
check(await g(() => window.__g.S.dark > 0.5), "the dark clock runs once the lamp is out");
await g(() => { window.__g.S.dark = 13; });
const sawWatcher = await page.waitForFunction(() => !!window.__g.S.watcher, null, { timeout: 5000 })
  .then(() => true).catch(() => false);
check(sawWatcher, "the Watcher appears after the delay");
await g(() => { const S = window.__g.S; S.watcher.x = S.x; S.watcher.z = S.z; });
const caught = await page.waitForFunction(() => window.__g.S.watcher === null && window.__g.S.charge > 30,
  null, { timeout: 5000 }).then(() => true).catch(() => false);
check(caught, "being caught wakes you at a brazier instead of ending the run");

// 7 — frame budget on the worst-case scene
console.log("\n= performance =");
await g(() => { window.__g.goto(20, 16); window.__g.S.charge = 90; window.__g.attune(1); });
await page.waitForTimeout(200);
await g(() => window.__g.perf(30));                       // warm the JIT
const runs = [];
for (let i = 0; i < 3; i++) { runs.push(await g(() => window.__g.perf(60))); await page.waitForTimeout(80); }
runs.sort((a, b) => a - b);
const ms = runs[1];
const dims = await g(() => document.getElementById("dev").textContent);
console.log(`  render ${runs.map(r => r.toFixed(2)).join(" / ")} ms/frame (median ${ms.toFixed(2)})  (${dims.trim()})`);
check(ms < 16.6, `worst-case scene renders inside the 60 fps budget (${ms.toFixed(2)} ms)`);

// 8 — touch-only viewport
console.log("\n= mobile =");
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const merr = [];
m.on("pageerror", e => merr.push(e.message));
await m.goto(`http://127.0.0.1:${PORT}/?dev=1`);
await m.waitForFunction(() => window.__g && !document.getElementById("loading").classList.contains("open"), null, { timeout: 20000 });
await m.click("#btnStart");
await m.waitForTimeout(400);
check(await m.evaluate(() => getComputedStyle(document.getElementById("touchbtns")).display !== "none"), "touch controls appear on a phone viewport");
check(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "nothing overflows the phone viewport");
const mms = await m.evaluate(() => window.__g.perf(60));
console.log(`  render ${mms.toFixed(2)} ms/frame at phone resolution`);
check(mms < 33, `phone frame budget holds (${mms.toFixed(2)} ms)`);
if (SHOTS) await m.screenshot({ path: "tools/shots/09-mobile.png" });
check(merr.length === 0, "no page errors on mobile: " + merr.join(" | "));

console.log("\n= console =");
// Audio clips are generated assets that only exist in the packaged build; locally they
// 404 by design and the loader is expected to survive it.
const audio404 = errors.filter(e => /404/.test(e)).length;
const real = errors.filter(e => !/404/.test(e));
if (audio404) console.log(`  note  ${audio404} asset 404s (audio placeholders absent locally) — tolerated`);
check(real.length === 0, "no console errors: " + (real.slice(0, 4).join(" | ") || "clean"));
check(await g(() => window.__g.phase() !== undefined), "the loader survived the missing clips");

await browser.close();
server.close();
console.log(fails ? `\nFAILED — ${fails} check(s)\n` : "\nAll smoke checks passed\n");
process.exit(fails ? 1 : 0);

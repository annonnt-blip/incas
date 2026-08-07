// Runs the packaged build (real generated art and audio) in Chromium, asserts every
// asset resolves, and captures the viewpoints used to judge the look.
// Executed inside the Higgsfield sandbox, where the generated assets are reachable.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const DIR = process.argv[2] || "./dist";
const OUT = process.argv[3] || "./shots";
await mkdir(OUT, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg" };
const missing = [];
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(req.url.split("?")[0]));
  const f = join(DIR, p === "/" ? "index.html" : p);
  try {
    const b = await readFile(f);
    res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
    res.end(b);
  } catch { missing.push(p); res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const URL_BASE = `http://127.0.0.1:${server.address().port}`;

let fails = 0;
const check = (c, m) => { console.log(`  ${c ? "ok  " : "FAIL"}  ${m}`); if (!c) fails++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(`${URL_BASE}/?dev=1`);
await page.waitForFunction(() => window.__g && !document.getElementById("loading").classList.contains("open"), null, { timeout: 40000 });

console.log("\n= packaged build =");
check(missing.length === 0, `every requested file exists (${missing.length ? missing.join(", ") : "no 404s"})`);
check(errors.length === 0, `no console errors (${errors.slice(0, 3).join(" | ") || "clean"})`);
check(await page.evaluate(() => window.__g.texturesLoaded()), "all seven textures decoded into the renderer");
check(await page.evaluate(() => window.__g.audioLoaded() === 6), "all six audio clips decoded");
await page.screenshot({ path: `${OUT}/00-menu.png` });

await page.click("#btnStart");
await page.waitForTimeout(300);

// viewpoints: [name, stand, look, glyph, braziers to light first as [stand, look] pairs]
const SHOTS = [
  ["01-shaft",      [6, 42],  [6, 37],  0, [[[6, 44], [7, 44]]]],
  ["02-gallery",    [9, 31],  [4, 29],  1, [[[4, 29], [4, 28]]]],
  ["03-sungate",    [21, 29], [21, 26], 1, []],
  ["04-hall",       [21, 21], [16, 14], 1, []],
  ["05-shrine",     [32, 20], [32, 16], 2, []],
  ["06-observatory",[31, 9],  [30, 3],  2, []],
  ["07-terrace",    [40, 9],  [43, 6],  2, [[[42, 9], [42, 8]]]],
  ["08-machine",    [51, 8],  [56, 4],  3, []],
  ["09-core",       [53, 21], [53, 17], 3, []],
];

for (const [name, stand, look, glyph, prep] of SHOTS) {
  for (const [ps, pl] of prep) {
    await page.evaluate(([a, b]) => { window.__g.goto(a[0], a[1]); window.__g.face(b[0], b[1]); }, [ps, pl]);
    await page.waitForTimeout(60);
    await page.evaluate(() => window.__g.act());
    await page.evaluate(() => { if (window.__g.phase() !== "play") window.__g.setPhase("play"); });
  }
  await page.evaluate(([s, l, g]) => {
    const S = window.__g.S;
    S.known = [true, true, true, true];
    S.charge = 88;
    window.__g.attune(g);
    window.__g.goto(s[0], s[1]);
    window.__g.face(l[0], l[1]);
    document.getElementById("toast").className = "";
  }, [stand, look, glyph]);
  await page.waitForTimeout(180);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  shot  ${name}`);
}

console.log("\n= frame budget (real textures) =");
await page.evaluate(() => { window.__g.goto(21, 16); });
await page.evaluate(() => window.__g.perf(30));
const runs = [];
for (let i = 0; i < 3; i++) runs.push(await page.evaluate(() => window.__g.perf(60)));
runs.sort((a, b) => a - b);
console.log(`  render ${runs.map(r => r.toFixed(2)).join(" / ")} ms  (median ${runs[1].toFixed(2)})`);
check(runs[1] < 16.6, `desktop budget holds (${runs[1].toFixed(2)} ms)`);

const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await m.goto(`${URL_BASE}/?dev=1`);
await m.waitForFunction(() => window.__g && !document.getElementById("loading").classList.contains("open"), null, { timeout: 40000 });
await m.click("#btnStart");
await m.waitForTimeout(300);
await m.evaluate(() => { window.__g.S.known = [true, true, true, true]; window.__g.S.charge = 88; window.__g.goto(21, 21); window.__g.face(16, 14); });
await m.waitForTimeout(200);
await m.screenshot({ path: `${OUT}/10-phone.png` });
await m.evaluate(() => window.__g.perf(30));
const mms = await m.evaluate(() => window.__g.perf(60));
console.log(`  phone  ${mms.toFixed(2)} ms`);
check(mms < 33, `phone budget holds (${mms.toFixed(2)} ms)`);

await browser.close();
server.close();
console.log(fails ? `\nVERIFY FAILED (${fails})\n` : "\nVERIFY OK\n");
process.exit(fails ? 1 : 0);

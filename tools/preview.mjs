// One screenshot of a chosen viewpoint, for iterating on the look without running the
// whole suite. Run: ASG_ROOT=$PWD/public node tools/preview.mjs
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
const ROOT = process.env.ASG_ROOT, INDEX = process.env.ASG_INDEX || "index.html";
const server = createServer(async (req,res)=>{
  const p = normalize(decodeURIComponent(req.url.split("?")[0]));
  try { const b = await readFile(join(ROOT, p === "/" ? INDEX : p)); res.writeHead(200,{"content-type":"text/html"}); res.end(b);} catch(e){res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,r));
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport:{width:1280,height:720} });
await p.goto(`http://127.0.0.1:${server.address().port}/?dev=1`);
await p.waitForFunction(()=>window.__g && !document.getElementById("loading").classList.contains("open"), null, {timeout:60000});
await p.click("#btnStart"); await p.waitForTimeout(300);
await p.evaluate(()=>{ window.__g.S.known=[true,true,true,true]; window.__g.S.charge=90; window.__g.attune(1); window.__g.goto(21,29); window.__g.face(21,26); document.getElementById("toast").className=""; });
await p.waitForTimeout(300);
await p.screenshot({ path: "tools/shots/preview.png" });
console.log("shot written");
await b.close(); server.close();

import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const ROOT = new URL("../public/", import.meta.url).pathname;
const MIME = { ".html":"text/html", ".js":"text/javascript", ".png":"image/png", ".mp3":"audio/mpeg" };
const server = createServer(async (req,res)=>{const p=normalize(decodeURIComponent(req.url.split("?")[0]));const f=join(ROOT,p==="/"?"index.html":p);try{const b=await readFile(f);res.writeHead(200,{"content-type":MIME[extname(f)]||"application/octet-stream"});res.end(b);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,r));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport:{width:1280,height:720}, deviceScaleFactor:1 });
await page.goto(`http://127.0.0.1:${server.address().port}/?dev=1`);
await page.waitForFunction(()=>window.__g && !document.getElementById("loading").classList.contains("open"),null,{timeout:20000});
await page.click("#btnStart"); await page.waitForTimeout(400);
for (const [name, cx, cz] of [["hall",20,16],["corridor",21,24],["observatory",30,6],["core",53,18]]) {
  await page.evaluate(([x,z])=>{window.__g.goto(x,z);window.__g.S.charge=90;window.__g.attune(1);},[cx,cz]);
  await page.waitForTimeout(150);
  await page.evaluate(()=>window.__g.perfSplit(20)); const r = await page.evaluate(()=>window.__g.perfSplit(60));
  console.log(`${name.padEnd(12)} full ${r.full.toFixed(2)}  cast ${r.cast.toFixed(2)}  blit ${r.blit.toFixed(2)}  scale ${r.scale.toFixed(2)}  overlays ${r.overlays.toFixed(2)}`);
}
await browser.close(); server.close();

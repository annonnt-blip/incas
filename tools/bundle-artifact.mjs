// Builds a single self-contained HTML file: every module inlined, no network requests,
// textures and audio generated in code. This is the build for hosts that only accept one
// file (the published artifact); the zip build is the one that carries the generated art.
//
// Run: node tools/bundle-artifact.mjs [outdir]

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const SRC = new URL("../public/src/", import.meta.url).pathname;
const PAGE = new URL("../public/index.html", import.meta.url).pathname;
const OUT = process.argv[2] || new URL("../dist/artifact/", import.meta.url).pathname;
const ENTRY = "game";

const IMPORT_NAMED = /^import\s*\{([^}]*)\}\s*from\s*["']\.\/([\w.-]+)\.js["'];?\s*$/gm;
const IMPORT_STAR = /^import\s*\*\s*as\s+([\w$]+)\s+from\s*["']\.\/([\w.-]+)\.js["'];?\s*$/gm;

// Every name a module exports. A declaration list (`export const GW = 64, GH = 48;`)
// exports each of its declarators, so the statement is scanned to its terminating
// semicolon and split on top-level commas — taking only the first one silently drops
// the rest, and the module then reads `undefined` for them at runtime.
function exportedNames(src) {
  const names = [];
  const re = /\bexport\s+(const|let|var|function|class)\s+/g;
  let m;
  while ((m = re.exec(src))) {
    const rest = src.slice(re.lastIndex);
    if (m[1] === "function" || m[1] === "class") {
      const id = /^([A-Za-z_$][\w$]*)/.exec(rest);
      if (id) names.push(id[1]);
      continue;
    }
    let depth = 0, quote = null, start = 0;
    const parts = [];
    for (let i = 0; i < rest.length; i++) {
      const c = rest[i];
      if (quote) {
        if (c === "\\") i++;
        else if (c === quote) quote = null;
        continue;
      }
      // Comments are skipped before quotes are considered: an apostrophe in prose
      // ("the engine's own glow") would otherwise open a string that never closes.
      if (c === "/" && rest[i + 1] === "/") {
        i = rest.indexOf("\n", i);
        if (i < 0) break;
        continue;
      }
      if (c === "/" && rest[i + 1] === "*") {
        const end = rest.indexOf("*/", i + 2);
        if (end < 0) break;
        i = end + 1;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") depth--;
      else if (depth === 0 && c === ",") { parts.push(rest.slice(start, i)); start = i + 1; }
      else if (depth === 0 && c === ";") { parts.push(rest.slice(start, i)); break; }
    }
    for (const p of parts) {
      const id = /^\s*([A-Za-z_$][\w$]*)/.exec(p);
      if (id) names.push(id[1]);
    }
  }
  return names;
}

async function readModule(name) {
  const text = await readFile(join(SRC, name + ".js"), "utf8");
  const deps = new Set();
  const wants = [];        // [dependency, name] pairs this module reads from others
  let body = text;

  body = body.replace(IMPORT_STAR, (_, alias, dep) => {
    deps.add(dep);
    return `const ${alias} = __M[${JSON.stringify(dep)}];`;
  });
  body = body.replace(IMPORT_NAMED, (_, names, dep) => {
    deps.add(dep);
    // `a, b as c` becomes `a, b: c`
    const bindings = names.split(",").map(s => s.trim()).filter(Boolean).map(s => {
      const [from, to] = s.split(/\s+as\s+/);
      wants.push([dep, from.trim()]);
      return to ? `${from.trim()}: ${to.trim()}` : from.trim();
    });
    return `const { ${bindings.join(", ")} } = __M[${JSON.stringify(dep)}];`;
  });

  // `import * as W` followed by `const { A, B } = W;` reads the same bindings, so those
  // names are checked too — that destructuring is where a dropped export hides longest.
  for (const dep of deps) {
    const alias = new RegExp(`const\\s+(\\w+)\\s*=\\s*__M\\[${JSON.stringify(JSON.stringify(dep))}\\];`);
    const found = alias.exec(body);
    if (!found) continue;
    const destructure = new RegExp(`const\\s*\\{([^}]*)\\}\\s*=\\s*${found[1]};`, "g");
    let d;
    while ((d = destructure.exec(body))) {
      for (const raw of d[1].split(",")) {
        const id = /^\s*([A-Za-z_$][\w$]*)/.exec(raw);
        if (id) wants.push([dep, id[1]]);
      }
    }
  }

  const exports = exportedNames(body);
  body = body.replace(/^export\s+/gm, "");

  return { name, deps: [...deps], exports, wants, body };
}

// depth-first topological order, so a module is emitted after everything it imports
function order(mods) {
  const byName = new Map(mods.map(m => [m.name, m]));
  const seen = new Set(), out = [];
  const visit = (name, stack) => {
    if (seen.has(name)) return;
    if (stack.includes(name)) throw new Error(`import cycle: ${[...stack, name].join(" -> ")}`);
    const m = byName.get(name);
    if (!m) throw new Error(`missing module: ${name}`);
    for (const d of m.deps) visit(d, [...stack, name]);
    seen.add(name); out.push(m);
  };
  for (const m of mods) visit(m.name, []);
  return out;
}

const names = ["strings", "world", "engine", "sprites", "synth", "audio", "procgen", "game"];
const mods = order(await Promise.all(names.map(readModule)));

// Every name one module imports must actually be exported by the other. Without this
// check a dropped export becomes `undefined` at runtime and fails far from its cause.
const exportsOf = new Map(mods.map(m => [m.name, new Set(m.exports)]));
const broken = [];
for (const m of mods) {
  for (const [dep, want] of m.wants) {
    if (!exportsOf.get(dep)?.has(want)) broken.push(`${m.name} imports "${want}" but ${dep} does not export it`);
  }
}
if (broken.length) throw new Error("broken bindings:\n  " + broken.join("\n  "));

const parts = ["const __M = {};"];
for (const m of mods) {
  if (m.name === ENTRY) continue;
  parts.push(
    `__M[${JSON.stringify(m.name)}] = (function () {\n${m.body}\nreturn { ${m.exports.join(", ")} };\n})();`
  );
}
const entry = mods.find(m => m.name === ENTRY);
parts.push(`(function () {\n${entry.body}\n})();`);

let page = await readFile(PAGE, "utf8");
page = page.replace(/^<link rel="icon"[^>]*>\n?/m, "");   // no asset files to point at
page = page.replace(
  /<script type="module" src="\.\/src\/game\.js"><\/script>/,
  `<script type="module">\nwindow.__ASG_PROCEDURAL__ = true;\n${parts.join("\n\n")}\n</script>`
);

if (page.includes("./assets/") && !page.includes("__ASG_PROCEDURAL__")) {
  throw new Error("the page still references asset files");
}

await mkdir(OUT, { recursive: true });
const file = join(OUT, "ashes-of-the-sun-gate.html");
await writeFile(file, page);
console.log(`${file}  ${(page.length / 1024).toFixed(0)} KB  (${mods.length} modules inlined)`);

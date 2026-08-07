# Ashes of the Sun Gate

A first-person exploration game: you climb down into an Inca temple and find that the
deepest chambers are not Inca at all. Every door in the ruin is opened by light, not by
force — you learn three lights and attune your lamp to them.

Built as a browser game with the Higgsfield asset pipeline.

## Layout

```
public/            the game — this directory is the root of the deployed zip
  index.html       page, HUD and panels
  src/game.js      state, input, interaction, objectives, save
  src/engine.js    raycast renderer, baked lightmap, billboards
  src/world.js     frozen metrics, the authored level, entities, lore wiring
  src/sprites.js   procedurally drawn props and glyph marks
  src/strings.js   every player-visible string (adding a language is a data change)
  src/audio.js     three-bus mix with a limiter
  logic.js         single-player rules stub required at the archive root
  assets/          generated textures and audio (not in git — see below)
design/
  assets.csv       the asset manifest: one row per shipped asset
  thresholds.md    the frozen numbers everything else is built on
tools/
  validate.mjs     level checks: reachability, gate chokepoints, progression order
  smoke.mjs        browser run of the whole reference route + frame budget
  placeholders.mjs local stand-in textures so the engine can be run without the pipeline
```

## Assets

`public/assets/` is generated, not committed. The textures, music and effects are produced
from the prompts recorded in `design/assets.csv`, each carrying the same style formula, and
the tiles are made mathematically seamless before packaging. To work on the code without
them:

```
node tools/placeholders.mjs
```

## Checks

```
node tools/validate.mjs        # level structure
node tools/smoke.mjs --shots   # full playthrough in a real browser, with screenshots
```

The smoke run drives the reference route end to end — light the first brazier, learn INTI,
be refused by the sun gate under the wrong light, open it under the right one, read a mural,
walk a phase wall under CHASKA, take the seed, reach the engine and seal it — then measures
the frame budget on the worst-case scene at desktop and phone viewports.

## Packaging and deploying

Art and audio are prepared in the Higgsfield sandbox (which has the seam-fix
pipeline, ffmpeg and the generation CDN), then the whole thing is zipped with the
platform's layout — `logic.js` and `index.html` at the archive root, everything else
alongside them:

```
GAME_SKILL=$HF_WORKFLOWS/game-generation \
python3 tools/prepare-assets.py --raw raw --out dist/assets
cp public/index.html public/logic.js dist/ && cp -r public/src dist/
(cd dist && zip -qr ../game.zip .)
```

`tools/sandbox-verify.mjs` then runs that exact archive in Chromium and checks it
before it ships.

### Current build

The verified 1.7 MB archive is at:

```
https://d2ol7oe51mr4n9.cloudfront.net/user_31z5PkZA8MC960QQdaVG6VczO8w/b62a6478-6fed-4dbf-b198-cbe55fd6ea5b.zip
```

To play it without the marketplace, unzip it and serve the folder — ES modules do
not load over `file://`:

```
unzip game.zip -d ashes && cd ashes && python3 -m http.server 8000
```

Then open http://localhost:8000 (add `?dev=1` for the FPS overlay).

### Deploy parameters

```
title      Ashes of the Sun Gate
thumbnail  .../hf_20260807_160603_c642f92f-5f1e-48ac-8b76-6cd9fc432483.png   (16:9)
favicon    .../hf_20260807_160603_22c6882b-9fa3-4872-8797-34a98677b374.png   (1:1)
source     the archive URL above
```

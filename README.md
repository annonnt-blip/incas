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

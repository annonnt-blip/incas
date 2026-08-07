# Frozen numbers — Ashes of the Sun Gate

Fixed before content production (§5.3 agency metrics, §6.5 performance law).
Changing anything here invalidates the level layout built on top of it.

## Agency metrics (world units)

| Metric | Value |
|---|---|
| Grid cell | 3.0 |
| Wall height | 3.6 |
| Eye height | 1.7 |
| Player collision radius | 0.34 |
| Walk speed | 3.0 u/s |
| Sprint speed | 4.8 u/s |
| Mouse look sensitivity | 0.0022 rad/px (0.4×–2.5× in options) |
| Gamepad/touch look rate | 2.6 rad/s |
| Interact range | 3.2 |
| Interact aim cone | 30° half-angle from screen centre |

## Economy

| Resource | Value |
|---|---|
| Lamp charge max | 100 |
| Lamp drain, lit | 1.05 / s |
| Attunement switch cost | 4 |
| Brazier refill | 48 (each brazier gives once at full value, then 18 on re-use) |
| Lamp radius, unattuned | 6.0 |
| Lamp radius, attuned | 8.5 |

## Threat (the Watcher)

| Metric | Value |
|---|---|
| Spawns after | 12 s at zero charge |
| Speed | 2.2 u/s |
| Catch radius | 0.8 |
| Consequence | fade out, wake at the last lit brazier with 35 charge — no progress lost |

## Rendering & performance budgets

| Budget | Value |
|---|---|
| Internal render width | 448 px desktop / 320 px mobile (upscaled to canvas) |
| Target frame rate | ≥60 fps desktop, ≥30 fps mobile, worst-case scene = Hall of the Sun |
| Simulation | fixed 60 Hz timestep, seeded RNG |
| Per-frame allocations | zero in the render loop (typed-array buffers reused) |
| Lightmap | baked, 4 samples/cell, 2 height layers, incremental per-light rebake |
| Fog | exp², density 0.085, toward near-black |

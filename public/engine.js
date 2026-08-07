// Raycast renderer: textured walls/floors/ceilings, a baked two-layer lightmap,
// a dynamic lamp, exponential fog and alpha billboards.
// No allocations happen inside render() — every buffer is created once in setSize().

import { CELL, WALL_H, EYE_H, GW, GH } from "./world.js";

const TS = 256;              // working texture size (power of two)
const TMASK = TS - 1;
const LS = 4;                // lightmap samples per grid cell
const LW = GW * LS, LH = GH * LS;
const LOW_Y = 0.45, HIGH_Y = 2.95;   // the two baked height layers
const WH_C = WALL_H / CELL, EY_C = EYE_H / CELL;
const FOG_DENSITY = 0.085;
const FAR = 36;      // past this the fog term is below one 8-bit step — draw black instead
const DARK = 0.006;  // below this the shaded texel rounds to black anyway

export class Renderer {
  constructor() {
    this.tex = [];                              // Uint32Array[] of TS*TS
    this.lowMap = new Float32Array(LW * LH * 3);
    this.highMap = new Float32Array(LW * LH * 3);
    this.W = 0; this.H = 0;
    this.buf = null; this.px = null; this.zbuf = null;
    this.order = new Int32Array(64);
    this.dist = new Float64Array(64);
    // fog lookup, indexed by world distance × 4
    this.fog = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      const d = i / 4, t = FOG_DENSITY * d;
      this.fog[i] = Math.exp(-t * t);
    }
    // Lamp attenuation, indexed by (distance / radius) × 256. An inverse-square-ish
    // curve puts most of its falloff in the first few units, which on a first-person
    // camera is all off-screen — the nearest visible floor is already two eye-heights
    // out. A quadratic window instead holds the near and mid range readable and only
    // drops off approaching the radius.
    this.lampLut = new Float32Array(257);
    for (let i = 0; i <= 256; i++) { const u = i / 256; this.lampLut[i] = 1 - u * u; }
  }

  setSize(W, H) {
    this.W = W; this.H = H;
    this.img = new ImageData(W, H);
    this.px = new Uint32Array(this.img.data.buffer);
    this.zbuf = new Float32Array(W);
    this.colDir = new Float64Array(W * 2);
  }

  // Textures arrive as ImageData at TS×TS and are kept as packed uint32.
  setTexture(slot, imageData) {
    const src = new Uint32Array(imageData.data.buffer);
    const dst = new Uint32Array(TS * TS);
    dst.set(src);
    this.tex[slot] = dst;
  }

  // -------------------------------------------------------------------------
  // lightmap
  // -------------------------------------------------------------------------
  clearLights() { this.lowMap.fill(0); this.highMap.fill(0); }

  // Adds (sign = +1) or removes (sign = -1) one light's contribution.
  // Only the light's own footprint is touched, so toggling a brazier is cheap.
  bakeLight(world, L, sign = 1) {
    const { solid, at } = world;
    const r = L.r, inv = 1 / r;
    const x0 = Math.max(0, ((L.x - r) / CELL * LS) | 0);
    const x1 = Math.min(LW - 1, ((L.x + r) / CELL * LS) | 0);
    const z0 = Math.max(0, ((L.z - r) / CELL * LS) | 0);
    const z1 = Math.min(LH - 1, ((L.z + r) / CELL * LS) | 0);
    const cr = L.rgb[0] * L.i * sign, cg = L.rgb[1] * L.i * sign, cb = L.rgb[2] * L.i * sign;

    for (let lz = z0; lz <= z1; lz++) {
      const wz = (lz + 0.5) * CELL / LS;
      for (let lx = x0; lx <= x1; lx++) {
        const wx = (lx + 0.5) * CELL / LS;
        const dx = wx - L.x, dz = wz - L.z;
        const flat = Math.sqrt(dx * dx + dz * dz);
        if (flat > r) continue;
        // samples inside solid rock hold no light; wall shading reads from the open
        // cell in front of the surface instead.
        if (solid[at((wx / CELL) | 0, (wz / CELL) | 0)]) continue;
        if (this.occluded(world, L.x, L.z, wx, wz)) continue;

        const o = (lz * LW + lx) * 3;
        for (let layer = 0; layer < 2; layer++) {
          const ly = layer ? HIGH_Y : LOW_Y;
          const dy = ly - L.y;
          const d = Math.sqrt(flat * flat + dy * dy);
          if (d >= r) continue;
          const u = d * inv, a = 1 - u * u;   // same curve as the lamp, for one pool of light
          const m = layer ? this.highMap : this.lowMap;
          m[o] += cr * a; m[o + 1] += cg * a; m[o + 2] += cb * a;
        }
      }
    }
  }

  occluded(world, ax, az, bx, bz) {
    const { solid, at } = world;
    const dx = bx - ax, dz = bz - az;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.7) return false;
    const steps = Math.ceil(len / 0.6);
    const sx = dx / steps, sz = dz / steps;
    // skip the endpoints: the light and the sample both sit in open cells by construction
    for (let i = 1; i < steps; i++) {
      const x = ax + sx * i, z = az + sz * i;
      if (solid[at((x / CELL) | 0, (z / CELL) | 0)]) return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // render
  // -------------------------------------------------------------------------
  render(cam, world, sprites, lamp) {
    const W = this.W, H = this.H, px = this.px, zbuf = this.zbuf;
    const { solid, wtex, ftex, ctex, gate, phase, at } = world;
    const openPhase = lamp.phase;                 // CHASKA carried → hull walls stand open

    const pxC = cam.x / CELL, pzC = cam.z / CELL;
    const dirX = Math.cos(cam.ang), dirZ = Math.sin(cam.ang);
    const fovScale = 0.78;
    const planeX = -dirZ * fovScale, planeZ = dirX * fovScale;
    const mid = (H * 0.5 + cam.pitch) | 0;

    const lampR = lamp.radius, lampInv = 256 / lampR;
    const lr = lamp.rgb[0] * lamp.power, lg = lamp.rgb[1] * lamp.power, lb = lamp.rgb[2] * lamp.power;
    const fog = this.fog, lampLut = this.lampLut;
    const AMB = 0.05;

    for (let x = 0; x < W; x++) {
      const camX = 2 * x / W - 1;
      const rdx = dirX + planeX * camX, rdz = dirZ + planeZ * camX;
      this.colDir[x * 2] = rdx; this.colDir[x * 2 + 1] = rdz;

      // --- DDA over the grid ---
      let mapX = pxC | 0, mapZ = pzC | 0;
      const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
      const ddz = rdz === 0 ? 1e30 : Math.abs(1 / rdz);
      let stepX, stepZ, sideX, sideZ;
      if (rdx < 0) { stepX = -1; sideX = (pxC - mapX) * ddx; }
      else { stepX = 1; sideX = (mapX + 1 - pxC) * ddx; }
      if (rdz < 0) { stepZ = -1; sideZ = (pzC - mapZ) * ddz; }
      else { stepZ = 1; sideZ = (mapZ + 1 - pzC) * ddz; }

      let side = 0, hit = 0, guard = 0;
      while (!hit && guard++ < 128) {
        if (sideX < sideZ) { sideX += ddx; mapX += stepX; side = 0; }
        else { sideZ += ddz; mapZ += stepZ; side = 1; }
        if (mapX < 0 || mapZ < 0 || mapX >= GW || mapZ >= GH) { hit = 2; break; }
        const i = mapZ * GW + mapX;
        if (solid[i] && !(openPhase && phase[i])) hit = 1;
      }
      let perp = side === 0 ? sideX - ddx : sideZ - ddz;
      if (hit === 2 || perp <= 0.0001) perp = 60;
      const dw = perp * CELL;                                   // world distance
      zbuf[x] = dw;

      const projH = H / perp;                                   // px per cell-unit of height
      let top = (mid - (WH_C - EY_C) * projH) | 0;
      let bot = (mid + EY_C * projH) | 0;
      const wallTop = top, wallBot = bot;
      if (top < 0) top = 0;
      if (bot > H) bot = H;

      // ---------------- ceiling ----------------
      // Lighting varies smoothly along the ray, so it is evaluated every second
      // pixel and reused — invisible under fog and grain, and half the cost.
      let o = x, cR = 0, cG = 0, cB = 0;
      for (let y = 0; y < top; y++, o += W) {
        const dy = mid - y;
        if (dy <= 0) { px[o] = 0xff000000; continue; }
        const pf = (WH_C - EY_C) * H / dy;
        const d = pf * CELL;
        if (d > FAR) { px[o] = 0xff000000; continue; }      // fog has already closed
        const fx = pxC + rdx * pf, fz = pzC + rdz * pf;
        const cx = fx | 0, cz = fz | 0;
        if (cx < 0 || cz < 0 || cx >= GW || cz >= GH) { px[o] = 0xff000000; continue; }
        if ((y & 1) === 0) {
          const L = bilinear(this.highMap, fx * CELL, fz * CELL, this._s1 || (this._s1 = new Float32Array(3)));
          const f = fog[Math.min(511, (d * 4) | 0)];
          const dyE = WALL_H - EYE_H;
          const dl = Math.sqrt(d * d + dyE * dyE);
          let R = L[0] + AMB, G = L[1] + AMB, B = L[2] + AMB;
          if (dl < lampR) { const a = lampLut[(dl * lampInv) | 0]; R += lr * a; G += lg * a; B += lb * a; }
          cR = R * f; cG = G * f; cB = B * f;
        }
        if (cR + cG + cB < DARK) { px[o] = 0xff000000; continue; } // nothing to see there
        const t = this.tex[ctex[cz * GW + cx]] || this.tex[0];
        const tx = ((fx - cx) * TS) & TMASK, ty = ((fz - cz) * TS) & TMASK;
        px[o] = pack(t[(ty << 8) | tx], cR, cG, cB);
      }

      // ---------------- wall ----------------
      if (hit === 1) {
        const i = mapZ * GW + mapX;
        const t = this.tex[wtex[i]] || this.tex[0];
        let wallX = side === 0 ? pzC + perp * rdz : pxC + perp * rdx;
        wallX -= Math.floor(wallX);
        let tx = (wallX * TS) | 0;
        if ((side === 0 && rdx > 0) || (side === 1 && rdz < 0)) tx = TS - tx - 1;
        tx &= TMASK;

        // light is sampled just in front of the surface, in open air
        const hx = pxC + rdx * perp - rdx * 0.14, hz = pzC + rdz * perp - rdz * 0.14;
        const L0 = this.sampleLow(hx * CELL, hz * CELL);
        const L1 = this.sampleHigh(hx * CELL, hz * CELL);
        const fogv = fog[Math.min(511, (dw * 4) | 0)];
        const span = wallBot - wallTop;
        const emit = gate[i] ? 0 : (phase[i] ? 0.55 : 0);   // dormant hull breathes cyan

        // whole-column early-out: if the brightest texel on this wall still rounds to
        // black, fill the span and skip the per-pixel work entirely
        const peak = Math.max(L0[0], L1[0]) + Math.max(L0[1], L1[1]) + Math.max(L0[2], L1[2])
          + 3 * AMB + (dw < lampR ? (lr + lg + lb) * lampLut[(dw * lampInv) | 0] : 0) + emit * 0.48;
        const texStep = TS / span;
        let texPos = (top - wallTop) * texStep;
        let oo = x + top * W;
        if (peak * fogv < DARK) {
          for (let y = top; y < bot; y++, oo += W) px[oo] = 0xff000000;
        } else {
          for (let y = top; y < bot; y++, oo += W, texPos += texStep) {
            const ty = texPos & TMASK;
            const c = t[(ty << 8) | tx];
            // height above the floor of this texel, for the layer blend and the lamp
            const hAbove = (EY_C - (y - mid) / projH) * CELL;
            let k = (hAbove - LOW_Y) / (HIGH_Y - LOW_Y);
            if (k < 0) k = 0; else if (k > 1) k = 1;
            let R = L0[0] + (L1[0] - L0[0]) * k + AMB;
            let G = L0[1] + (L1[1] - L0[1]) * k + AMB;
            let B = L0[2] + (L1[2] - L0[2]) * k + AMB;
            const dy2 = hAbove - EYE_H;
            const dl = Math.sqrt(dw * dw + dy2 * dy2);
            if (dl < lampR) {
              const a = lampLut[(dl * lampInv) | 0];
              R += lr * a; G += lg * a; B += lb * a;
            }
            if (emit) { R += 0.02 * emit; G += 0.20 * emit; B += 0.26 * emit; }
            px[oo] = pack(c, R * fogv, G * fogv, B * fogv);
          }
        }
      }

      // ---------------- floor ----------------
      let of = x + bot * W, fR = 0, fG = 0, fB = 0;
      for (let y = bot; y < H; y++, of += W) {
        const dy = y - mid;
        if (dy <= 0) { px[of] = 0xff000000; continue; }
        const pf = EY_C * H / dy;
        const d = pf * CELL;
        if (d > FAR) { px[of] = 0xff000000; continue; }
        const fx = pxC + rdx * pf, fz = pzC + rdz * pf;
        const cx = fx | 0, cz = fz | 0;
        if (cx < 0 || cz < 0 || cx >= GW || cz >= GH) { px[of] = 0xff000000; continue; }
        if ((y & 1) === 0) {
          const L = bilinear(this.lowMap, fx * CELL, fz * CELL, this._s0 || (this._s0 = new Float32Array(3)));
          const f = fog[Math.min(511, (d * 4) | 0)];
          const dl = Math.sqrt(d * d + EYE_H * EYE_H);
          let R = L[0] + AMB, G = L[1] + AMB, B = L[2] + AMB;
          if (dl < lampR) { const a = lampLut[(dl * lampInv) | 0]; R += lr * a; G += lg * a; B += lb * a; }
          fR = R * f; fG = G * f; fB = B * f;
        }
        if (fR + fG + fB < DARK) { px[of] = 0xff000000; continue; }
        const t = this.tex[ftex[cz * GW + cx]] || this.tex[1];
        const tx = ((fx - cx) * TS) & TMASK, ty = ((fz - cz) * TS) & TMASK;
        px[of] = pack(t[(ty << 8) | tx], fR, fG, fB);
      }
    }

    this.drawSprites(cam, sprites, dirX, dirZ, planeX, planeZ, mid, lamp);
    return this.img;
  }

  sampleLow(wx, wz) { return bilinear(this.lowMap, wx, wz, this._w0 || (this._w0 = new Float32Array(3))); }
  sampleHigh(wx, wz) { return bilinear(this.highMap, wx, wz, this._w1 || (this._w1 = new Float32Array(3))); }

  // -------------------------------------------------------------------------
  // billboards
  // -------------------------------------------------------------------------
  drawSprites(cam, sprites, dirX, dirZ, planeX, planeZ, mid, lamp) {
    const W = this.W, H = this.H, px = this.px, zbuf = this.zbuf;
    const n = sprites.length;
    if (n > this.order.length) { this.order = new Int32Array(n); this.dist = new Float64Array(n); }
    const order = this.order, dist = this.dist;
    for (let i = 0; i < n; i++) {
      const s = sprites[i];
      const dx = s.x - cam.x, dz = s.z - cam.z;
      dist[i] = dx * dx + dz * dz; order[i] = i;
    }
    // insertion sort, far to near — n is small and this allocates nothing
    for (let i = 1; i < n; i++) {
      const k = order[i], dk = dist[k];
      let j = i - 1;
      while (j >= 0 && dist[order[j]] < dk) { order[j + 1] = order[j]; j--; }
      order[j + 1] = k;
    }

    const invDet = 1 / (planeX * dirZ - dirX * planeZ);
    for (let oi = 0; oi < n; oi++) {
      const s = sprites[order[oi]];
      const img = s.img; if (!img) continue;
      const dx = (s.x - cam.x) / CELL, dz = (s.z - cam.z) / CELL;
      const tx = invDet * (dirZ * dx - dirX * dz);
      const ty = invDet * (-planeZ * dx + planeX * dz);
      if (ty <= 0.12) continue;
      const projH = H / ty;
      const scrX = ((W / 2) * (1 + tx / ty)) | 0;
      const hpx = (s.h * projH / CELL) | 0;
      const wpx = (s.w * projH / CELL) | 0;
      if (hpx < 1 || wpx < 1) continue;
      const baseY = mid + EY_C * projH;                 // where this sprite meets the floor
      const y0 = (baseY - hpx - (s.yOff || 0) * projH / CELL) | 0;
      const x0 = scrX - (wpx >> 1);
      const dw = ty * CELL;
      const fogv = this.fog[Math.min(511, (dw * 4) | 0)];

      // ambient + lamp, sampled once per sprite
      const L = bilinear(this.lowMap, s.x, s.z, this._s2 || (this._s2 = new Float32Array(3)));
      let R = L[0] + 0.06, G = L[1] + 0.06, B = L[2] + 0.06;
      if (dw < lamp.radius) {
        const a = this.lampLut[(dw * 256 / lamp.radius) | 0];
        R += lamp.rgb[0] * lamp.power * a; G += lamp.rgb[1] * lamp.power * a; B += lamp.rgb[2] * lamp.power * a;
      }
      R *= fogv; G *= fogv; B *= fogv;
      const gl = s.glow || 0, gr = s.glowRgb || [1, 1, 1];
      const gR = gr[0] * gl, gG = gr[1] * gl, gB = gr[2] * gl;

      const sw = img.w, sh = img.h, sd = img.data;
      const xs = Math.max(0, x0), xe = Math.min(W, x0 + wpx);
      const ys = Math.max(0, y0), ye = Math.min(H, y0 + hpx);
      for (let x = xs; x < xe; x++) {
        if (zbuf[x] <= dw) continue;
        const sx = (((x - x0) * sw / wpx) | 0);
        for (let y = ys; y < ye; y++) {
          const sy = (((y - y0) * sh / hpx) | 0);
          const c = sd[sy * sw + sx];
          const a = c >>> 24;
          if (a < 12) continue;
          const o = y * W + x;
          const lit = pack(c, R + gR, G + gG, B + gB);
          if (a > 240) px[o] = lit;
          else {
            const t = a / 255, inv = 1 - t;
            const d0 = px[o];
            px[o] = 0xff000000 |
              ((((lit >> 16 & 255) * t + (d0 >> 16 & 255) * inv) | 0) << 16) |
              ((((lit >> 8 & 255) * t + (d0 >> 8 & 255) * inv) | 0) << 8) |
              (((lit & 255) * t + (d0 & 255) * inv) | 0);
          }
        }
      }
    }
  }
}

function bilinear(map, wx, wz, out) {
  let fx = wx / CELL * LS - 0.5, fz = wz / CELL * LS - 0.5;
  if (fx < 0) fx = 0; else if (fx > LW - 1.001) fx = LW - 1.001;
  if (fz < 0) fz = 0; else if (fz > LH - 1.001) fz = LH - 1.001;
  const x0 = fx | 0, z0 = fz | 0;
  const tx = fx - x0, tz = fz - z0;
  const i00 = (z0 * LW + x0) * 3, i10 = i00 + 3;
  const i01 = i00 + LW * 3, i11 = i01 + 3;
  const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz), w01 = (1 - tx) * tz, w11 = tx * tz;
  out[0] = map[i00] * w00 + map[i10] * w10 + map[i01] * w01 + map[i11] * w11;
  out[1] = map[i00 + 1] * w00 + map[i10 + 1] * w10 + map[i01 + 1] * w01 + map[i11 + 1] * w11;
  out[2] = map[i00 + 2] * w00 + map[i10 + 2] * w10 + map[i01 + 2] * w01 + map[i11 + 2] * w11;
  return out;
}

function pack(c, R, G, B) {
  let r = (c & 255) * R, g = ((c >> 8) & 255) * G, b = ((c >> 16) & 255) * B;
  if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
  return 0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
}

// Procedural fallback for the generated audio.
//
// The shipped build carries the generated music and effects; this module synthesises
// stand-ins for builds that cannot carry files. Each clip is rendered straight into a
// buffer and peak-normalised, so playback level is still set entirely by the three
// mix buses in audio.js and the mix contract lives in one place.

const SR = 44100;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 * 2 - 1);
}

// one-pole low pass, in place
function lowpass(buf, cutoff) {
  const a = Math.exp(-2 * Math.PI * cutoff / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i++) { y = buf[i] * (1 - a) + y * a; buf[i] = y; }
}
function highpass(buf, cutoff) {
  const a = Math.exp(-2 * Math.PI * cutoff / SR);
  let y = 0, prev = 0;
  for (let i = 0; i < buf.length; i++) {
    y = a * (y + buf[i] - prev); prev = buf[i]; buf[i] = y;
  }
}
function normalise(buf, target = 0.944) {   // ≈ -0.5 dBFS
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  if (peak < 1e-6) return buf;
  const k = target / peak;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
  return buf;
}
// fade the ends into each other so a looped clip has no click
function loopFade(buf, ms = 60) {
  const n = Math.min((SR * ms / 1000) | 0, buf.length >> 2);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    buf[i] *= t;
    buf[buf.length - 1 - i] *= t;
  }
}

const alloc = seconds => new Float32Array((SR * seconds) | 0);

// --- the six clips ---------------------------------------------------------------------

// Dark ambient dread: low drones a semitone apart so they beat slowly against each
// other, sparse hand-drum pulses, a breathy flute high above.
function music(seconds = 30) {
  const out = alloc(seconds);
  const n = out.length;
  const rand = rng(4242);
  const roots = [55, 55 * 1.0595, 82.5, 110];        // A1, its neighbour, E2, A2
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < roots.length; k++) {
      const swell = 0.5 + 0.5 * Math.sin(t * (0.055 + k * 0.021) * Math.PI * 2 + k);
      v += Math.sin(2 * Math.PI * roots[k] * t) * swell * (0.30 - k * 0.05);
    }
    out[i] = v;
  }
  // hand drum: a soft thump every few seconds, never on a tidy grid
  const drum = alloc(seconds);
  let at = 1.7;
  while (at < seconds - 0.5) {
    const start = (at * SR) | 0;
    const len = (0.5 * SR) | 0;
    const pitch = 61 + rand() * 6;
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / SR;
      const env = Math.exp(-t * 11);
      drum[start + i] += Math.sin(2 * Math.PI * pitch * t * (1 - t * 0.35)) * env * 0.6;
    }
    at += 2.4 + (rand() + 1) * 1.9;
  }
  // bone flute: filtered breath riding a slow, unresolved line
  const flute = alloc(seconds);
  for (let i = 0; i < n; i++) flute[i] = rand();
  lowpass(flute, 900); highpass(flute, 420);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const gate = Math.max(0, Math.sin(t * 0.09 * Math.PI * 2 - 1)) ** 2;
    flute[i] *= gate * 0.5;
  }
  for (let i = 0; i < n; i++) out[i] = out[i] * 0.8 + drum[i] * 0.5 + flute[i];
  lowpass(out, 2600);
  loopFade(out, 900);
  return normalise(out, 0.85);
}

// Cave room tone: air, distant groans, and slow drips.
function ambience(seconds = 8) {
  const out = alloc(seconds);
  const n = out.length;
  const rand = rng(77);
  for (let i = 0; i < n; i++) out[i] = rand();
  lowpass(out, 240);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = out[i] * 2.2 + Math.sin(2 * Math.PI * 41 * t) * 0.12 * (0.6 + 0.4 * Math.sin(t * 0.4));
  }
  // drips: a short pitched blip with a long tail
  let at = 0.8;
  while (at < seconds - 0.6) {
    const start = (at * SR) | 0;
    const f = 900 + (rand() + 1) * 700;
    for (let i = 0; i < (0.4 * SR) | 0 && start + i < n; i++) {
      const t = i / SR;
      const env = Math.exp(-t * 26);
      out[start + i] += Math.sin(2 * Math.PI * f * t * (1 + t * 2)) * env * 0.22;
    }
    at += 0.9 + (rand() + 1) * 1.4;
  }
  loopFade(out, 300);
  return normalise(out, 0.8);
}

// One boot on wet gritty stone, in a room with a long tail.
function step() {
  const out = alloc(0.42);
  const n = out.length;
  const rand = rng(913);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = rand() * Math.exp(-t * 46);
  }
  lowpass(out, 2400);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] += Math.sin(2 * Math.PI * 96 * t) * Math.exp(-t * 30) * 0.5;   // the heel
    out[i] += rand() * Math.exp(-t * 9) * 0.05;                            // room tail
  }
  return normalise(out);
}

// A struck stone chime, ringing out into the chamber.
function chime() {
  const out = alloc(2.0);
  const n = out.length;
  const partials = [1, 2.02, 2.98, 4.36, 5.9];
  const gains = [1, 0.5, 0.32, 0.16, 0.09];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < partials.length; k++) {
      v += Math.sin(2 * Math.PI * 392 * partials[k] * t) * gains[k] * Math.exp(-t * (1.6 + k * 1.1));
    }
    out[i] = v * (1 - Math.exp(-t * 500));
  }
  return normalise(out);
}

// A stone slab grinding open: low rumble, grit, a settling thud.
function gate() {
  const out = alloc(3.0);
  const n = out.length;
  const rand = rng(5150);
  for (let i = 0; i < n; i++) out[i] = rand();
  lowpass(out, 320);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t * 4) * Math.min(1, (3 - t) * 1.4);
    // the grind: amplitude chewed by a slow irregular modulation
    const grind = 0.6 + 0.4 * Math.sin(2 * Math.PI * 7.3 * t) * Math.sin(2 * Math.PI * 2.1 * t);
    out[i] = out[i] * 3.2 * env * grind + Math.sin(2 * Math.PI * 38 * t) * env * 0.3;
  }
  // grit falling
  const grit = alloc(3.0);
  for (let i = 0; i < n; i++) grit[i] = rand() * Math.exp(-Math.abs(i / SR - 1.2) * 2.2);
  highpass(grit, 2600);
  for (let i = 0; i < n; i++) out[i] += grit[i] * 0.28;
  return normalise(out);
}

// Alien machinery waking: a rising harmonic stack with a cold shimmer on top.
function alien() {
  const out = alloc(3.4);
  const n = out.length;
  const rand = rng(31337);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const rise = 1 + t * 0.42;
    const env = Math.min(1, t * 1.4) * Math.min(1, (3.4 - t) * 1.2);
    let v = 0;
    for (let k = 1; k <= 6; k++) {
      v += Math.sin(2 * Math.PI * 74 * k * rise * t) * (0.5 / k);
    }
    out[i] = v * env;
  }
  // shimmer: high, thin, and slightly detuned so it never sounds like a musical note
  const sh = alloc(3.4);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    sh[i] = (Math.sin(2 * Math.PI * 3100 * t) + Math.sin(2 * Math.PI * 4270 * t) + rand() * 0.4)
      * Math.exp(-Math.abs(t - 1.9) * 1.5) * 0.12;
  }
  for (let i = 0; i < n; i++) out[i] += sh[i];
  // the thud it settles onto
  for (let i = 0; i < n; i++) {
    const t = i / SR - 2.6;
    if (t > 0) out[i] += Math.sin(2 * Math.PI * 48 * t) * Math.exp(-t * 6) * 0.7;
  }
  lowpass(out, 7000);
  return normalise(out);
}

const RENDER = { music, amb: ambience, step, glyph: chime, gate, alien };

export function synthBuffers(ctx) {
  const out = {};
  for (const [name, make] of Object.entries(RENDER)) {
    const data = make();
    const buf = ctx.createBuffer(1, data.length, SR);
    buf.copyToChannel(data, 0);
    out[name] = buf;
  }
  return out;
}

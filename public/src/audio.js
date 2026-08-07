// Audio mix. Levels follow the mix contract: music sits at roughly -19 dBFS, effects at
// -11 dBFS, and everything passes through a limiter so the true peak stays under -3 dBFS.

import { synthBuffers } from "./synth.js";

const MUSIC_GAIN = 0.112;   // ≈ -19 dBFS
const SFX_GAIN   = 0.282;   // ≈ -11 dBFS
const AMB_GAIN   = 0.150;

export class Audio {
  constructor() {
    this.ctx = null; this.buf = {}; this.ready = false;
    this.musicVol = 1; this.sfxVol = 1;
    this.muted = false;
  }

  async init(urls, onProgress, procedural = false) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.12;
    this.limiter.connect(this.ctx.destination);

    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = MUSIC_GAIN;
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = SFX_GAIN;
    this.ambBus = this.ctx.createGain(); this.ambBus.gain.value = AMB_GAIN;
    this.musicBus.connect(this.limiter); this.sfxBus.connect(this.limiter); this.ambBus.connect(this.limiter);

    if (procedural) {
      this.buf = synthBuffers(this.ctx);
      this.ready = true;
      return;
    }

    const names = Object.keys(urls);
    let done = 0;
    await Promise.all(names.map(async (n) => {
      try {
        const r = await fetch(urls[n]);
        if (!r.ok) throw new Error(r.status);
        const ab = await r.arrayBuffer();
        this.buf[n] = await this.ctx.decodeAudioData(ab);
      } catch (e) { /* a missing clip must never take the game down */ }
      onProgress && onProgress(++done / names.length);
    }));
    // nothing arrived — play synthesised stand-ins rather than run the ruin silent
    if (Object.keys(this.buf).length === 0) this.buf = synthBuffers(this.ctx);
    this.ready = true;
  }

  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }

  play(name, { gain = 1, rate = 1, bus = "sfx" } = {}) {
    if (!this.ready || this.muted || !this.buf[name]) return null;
    const s = this.ctx.createBufferSource();
    s.buffer = this.buf[name];
    s.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain * (bus === "music" ? this.musicVol : this.sfxVol);
    s.connect(g);
    g.connect(bus === "music" ? this.musicBus : bus === "amb" ? this.ambBus : this.sfxBus);
    s.start();
    return s;
  }

  loop(name, bus, gain = 1) {
    if (!this.ready || !this.buf[name]) return null;
    const s = this.ctx.createBufferSource();
    s.buffer = this.buf[name]; s.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = gain * (bus === "music" ? this.musicVol : this.sfxVol);
    s.connect(g);
    g.connect(bus === "music" ? this.musicBus : bus === "amb" ? this.ambBus : this.sfxBus);
    s.start();
    return { src: s, gain: g };
  }

  startBeds() {
    if (this.music) return;
    this.music = this.loop("music", "music", 1);
    this.amb = this.loop("amb", "amb", 1);
  }

  setMusicVol(v) {
    this.musicVol = v;
    if (this.music) this.music.gain.gain.value = v;
  }
  setSfxVol(v) {
    this.sfxVol = v;
    if (this.amb) this.amb.gain.gain.value = v;
  }

  // rising unease while the lamp is out — the Watcher's approach is audible before it is visible
  setDread(t) {
    if (!this.music) return;
    const target = this.musicVol * (1 + t * 0.6);
    this.music.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4);
    this.music.src.playbackRate.setTargetAtTime(1 - t * 0.18, this.ctx.currentTime, 0.6);
  }
}

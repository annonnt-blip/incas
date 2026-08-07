#!/usr/bin/env python3
"""Turn the raw generated art and audio into the files the game ships.

Run inside the Higgsfield sandbox, where the seam-fix pipeline and ffmpeg live:

    GAME_SKILL=$HF_WORKFLOWS/game-generation \
    python3 tools/prepare-assets.py --raw raw --out dist/assets

Steps, in order:

1. Tiles are resized to 512 and made mathematically seamless (Moisan periodic
   decomposition plus a minimal-error cut) by the bundled pipeline script.
2. Tile luminance is lifted to a target mean by a per-image gamma. The generated
   stone is authentically dark — mean luminance 0.14-0.24 — but the renderer
   multiplies it by lamp falloff and fog, and at that base level the walls read as
   black. Gamma preserves hue and saturation, so the style formula's palette
   survives; the darkness of the game comes from the lighting model, not from the
   textures having no headroom.
3. The menu art becomes a 1280x720 JPEG and the icon a 256px PNG.
4. Every clip is peak-normalised to -0.5 dBFS and encoded to MP3. Playback level
   is then set entirely by the three mix buses in audio.js, so the mix contract
   lives in one place.
"""

import argparse
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

TILES = ["wall_megalith", "floor_stone", "ceiling_rock", "wall_glyph",
         "gold_relief", "alien_panel", "rubble_dirt"]
CLIPS = ["mus_dread", "sfx_ambience", "sfx_step", "sfx_glyph", "sfx_gate", "sfx_alien"]
TILE_PX = 512
TARGET_LUM = 0.34


def luminance(a):
    return float((0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]).mean())


def lift(a, target):
    """Solve for the gamma that puts mean luminance at `target`."""
    lo, hi = 0.15, 1.0
    for _ in range(40):
        g = (lo + hi) / 2
        if luminance(a ** g) < target:
            hi = g
        else:
            lo = g
    return g


def seam_ratio(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)
    seam = abs(a[0] - a[-1]).mean() + abs(a[:, 0] - a[:, -1]).mean()
    base = abs(np.diff(a, axis=0)).mean() + abs(np.diff(a, axis=1)).mean()
    return seam / base


def run(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True, help="directory of downloaded generations")
    ap.add_argument("--out", required=True, help="directory to write shipped assets into")
    ap.add_argument("--work", default="work", help="scratch directory")
    ap.add_argument("--target-lum", type=float, default=TARGET_LUM)
    ap.add_argument("--skip-audio", action="store_true")
    args = ap.parse_args()

    skill = os.environ.get("GAME_SKILL", "")
    pipeline = os.path.join(skill, "scripts", "pipeline.py")
    os.makedirs(args.out, exist_ok=True)
    os.makedirs(args.work, exist_ok=True)

    print(f"{'tile':<16}{'seam':>14}{'luminance':>22}")
    for tid in TILES:
        src = os.path.join(args.raw, tid + ".png")
        stage = os.path.join(args.work, tid + "_in.png")
        Image.open(src).convert("RGB").resize((TILE_PX, TILE_PX), Image.LANCZOS).save(stage)
        before = seam_ratio(stage)

        prefix = os.path.join(args.work, tid)
        seamless = prefix + "_seamless.png"
        if os.path.exists(pipeline):
            run(f'python3 "{pipeline}" "{stage}" -o "{prefix}" --trim 0')
        if not os.path.exists(seamless):
            print(f"  {tid}: seam fix unavailable, shipping the resized tile", file=sys.stderr)
            seamless = stage

        a = np.asarray(Image.open(seamless).convert("RGB")).astype(float) / 255
        lum0 = luminance(a)
        g = lift(a, args.target_lum)
        out = (np.clip(a ** g, 0, 1) * 255).astype("uint8")
        dst = os.path.join(args.out, tid + ".png")
        Image.fromarray(out).save(dst)
        after = seam_ratio(dst)
        print(f"{tid:<16}{before:>6.2f} -> {after:<5.2f}{lum0:>10.3f} -> "
              f"{luminance(a ** g):<6.3f} (gamma {g:.2f})")

    Image.open(os.path.join(args.raw, "title_art.png")).convert("RGB") \
        .resize((1280, 720), Image.LANCZOS) \
        .save(os.path.join(args.out, "title_art.jpg"), quality=84, optimize=True)
    Image.open(os.path.join(args.raw, "icon_app.png")).convert("RGB") \
        .resize((256, 256), Image.LANCZOS) \
        .save(os.path.join(args.out, "icon_app.png"), optimize=True)
    print("stills: title_art.jpg 1280x720, icon_app.png 256x256")

    if args.skip_audio:
        return
    for cid in CLIPS:
        matches = [f for f in os.listdir(args.raw) if f.startswith(cid + ".")]
        if not matches:
            print(f"  {cid}: missing", file=sys.stderr)
            continue
        src = os.path.join(args.raw, matches[0])
        probe = run(f'ffmpeg -hide_banner -i "{src}" -af volumedetect -f null - 2>&1')
        peak = -6.0
        for line in (probe.stdout + probe.stderr).splitlines():
            if "max_volume:" in line:
                peak = float(line.split("max_volume:")[1].replace("dB", "").strip())
                break
        gain = -peak - 0.5
        rate = "96k" if cid == "mus_dread" else "64k"
        dst = os.path.join(args.out, cid + ".mp3")
        run(f'ffmpeg -hide_banner -loglevel error -y -i "{src}" -af "volume={gain}dB" '
            f'-c:a libmp3lame -b:a {rate} -ar 44100 "{dst}"')
        print(f"{cid:<16}peak {peak:>6.1f} dB -> normalised, {os.path.getsize(dst)//1024} KB")


if __name__ == "__main__":
    main()

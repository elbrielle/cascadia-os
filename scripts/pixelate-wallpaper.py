#!/usr/bin/env python3
"""
pixelate-wallpaper.py — turn a detailed illustration into TRUE pixel art.

Offline asset tool (not part of the site build). Regenerates the desktop
wallpapers in public/wallpaper/ from the source masters in design-references/.

Why this exists: downsampling a 4K image just looks "low-res," not pixel art.
The pixel-art read comes from three things this script does and a plain resize
does not:  (1) a LOW art resolution, integer-upscaled with nearest-neighbour so
the grid is crisp and uniform;  (2) a TIGHT palette;  (3) ordered (Bayer)
DITHERING, which fakes smooth gradients from a few colours — that regular
halftone-dot texture is the signature retro look.

Pipeline:  LANCZOS downscale to ART_W  ->  median-cut palette, snapped toward
Cascadia design tokens where close  ->  Bayer 4x4 ordered dither  ->  nearest-
neighbour upscale x SCALE  ->  lossless WebP.

Retune by editing the KNOBS below:
    ART_W     lower  = chunkier pixels (320 aggressive · 480 balanced · 640 fine)
    STRENGTH  higher = busier dither (20 calm · 30 current · 48 heavy; <~24 bands)
    COLORS    palette size before token-snapping
    SCALE     ART_W * SCALE = stored width (640 * 3 = 1920)

Usage:   pip install Pillow numpy   &&   python3 scripts/pixelate-wallpaper.py
Then commit the updated public/wallpaper/*.webp.  Full rationale + the
day/night mapping live in docs/PROJECT-STATUS.md ("Wallpaper — pixel-art
pipeline").
"""
import os
import numpy as np
from PIL import Image

# --- KNOBS -------------------------------------------------------------------
ART_W       = 640
STRENGTH    = 30
COLORS      = 36
SNAP_THRESH = 55     # RGB distance under which a colour snaps to a token
SCALE       = 3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = {
    "day":   os.path.join(ROOT, "design-references", "wallpaper-day-source.png"),   # warm sunset -> light theme
    "night": os.path.join(ROOT, "design-references", "wallpaper-night-source.png"), # moonlit    -> dark theme
}
OUT_DIR = os.path.join(ROOT, "public", "wallpaper")

# Cascadia design tokens (src/styles/tokens.css) — palette colours snap to these
# where close, so the wallpaper harmonises with the OS chrome.
CASCADIA = np.array([
    (0xF9,0xF7,0xF3),(0xED,0xDE,0xA4),(0xF7,0xA0,0x72),(0xC8,0x45,0x1A),(0x96,0x33,0x08),
    (0xB5,0xE2,0xFA),(0x5B,0xC8,0xD8),(0x0F,0xA3,0xB1),(0x0A,0x6D,0x7A),(0x6F,0xB8,0xC8),
    (0x3A,0x88,0x98),(0xA8,0xC8,0xD8),(0x6A,0x8A,0xA0),(0x3A,0x5E,0x7A),(0x1A,0x4D,0x55),
    (0xC8,0xB8,0x88),(0xA8,0x98,0x68),(0x11,0x20,0x2A),(0x0D,0x18,0x20),(0x05,0x0D,0x18),
    (0x15,0x25,0x2E),(0x1D,0x35,0x40),
], float)


def bayer(n):
    if n == 1:
        return np.zeros((1, 1))
    s = bayer(n // 2)
    return np.block([[4*s, 4*s + 2], [4*s + 3, 4*s + 1]])

B4 = bayer(4) / 16.0 - 0.5   # normalized to [-0.5, 0.5)


def palette(small):
    """Median-cut palette, snapped toward Cascadia tokens where within thresh."""
    q = small.quantize(colors=COLORS, method=Image.MEDIANCUT)
    pal = np.array(q.getpalette()[:COLORS * 3]).reshape(-1, 3).astype(float)
    snapped = 0
    for i, c in enumerate(pal):
        d2 = ((CASCADIA - c) ** 2).sum(1)
        j = int(d2.argmin())
        if d2[j] < SNAP_THRESH * SNAP_THRESH:
            pal[i] = CASCADIA[j]
            snapped += 1
    return pal, snapped


def nearest(arr, pal):
    a = arr.reshape(-1, 3).astype(float)
    d = ((a[:, None, :] - pal[None, :, :]) ** 2).sum(2)
    return d.argmin(1).reshape(arr.shape[:2])


def render(path):
    im = Image.open(path).convert("RGB")
    small = im.resize((ART_W, round(ART_W * im.height / im.width)), Image.LANCZOS)
    pal, snapped = palette(small)
    arr = np.asarray(small).astype(float)
    h, w, _ = arr.shape
    tile = np.tile(B4, (h // 4 + 1, w // 4 + 1))[:h, :w]
    idx = nearest(np.clip(arr + tile[..., None] * STRENGTH, 0, 255), pal)
    art = pal[idx].astype(np.uint8)
    big = Image.fromarray(art).resize((art.shape[1] * SCALE, art.shape[0] * SCALE), Image.NEAREST)
    return big, len(pal), snapped


def main():
    for tag, src in SOURCES.items():
        big, k, snapped = render(src)
        out = os.path.join(OUT_DIR, f"wallpaper-{tag}.webp")
        big.save(out, lossless=True, method=6)
        kb = os.path.getsize(out) // 1024
        print(f"{tag:5s} -> {out}  {big.size[0]}x{big.size[1]}  "
              f"{k}-colour palette ({snapped} snapped to tokens)  {kb} KB")


if __name__ == "__main__":
    main()

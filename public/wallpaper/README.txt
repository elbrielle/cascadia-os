WALLPAPER IMAGES — installed.
  wallpaper-day.webp    -> shown in light theme (+ OS light)  — warm sunset
  wallpaper-night.webp  -> shown in dark theme  (+ OS dark)   — moonlit
Wired in src/styles/wallpaper.css (cross-fades with the theme; the layers use
image-rendering: pixelated to keep the grid crisp when scaled).

These are TRUE pixel art (1920x1080, ~40-52 KB): a Firewatch-style scene
rendered through the pixel pipeline — downscale to 640px art-res, quantize to
a ~36-colour Cascadia-token-snapped palette, Bayer ordered-dither, then
nearest-neighbour upscale x3. To regenerate or retune (chunkiness / palette /
dither strength), see scripts/pixelate-wallpaper.py (the KNOBS block).

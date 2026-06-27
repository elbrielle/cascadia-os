/* ============================================================================
   avatar-dissolve.js  —  Win95 block-dissolve for the Home avatar (#intro)
   ----------------------------------------------------------------------------
   The Introduction avatar starts as a pixel-art portrait and "dissolves" into a
   real photo on hover (tap on touch), block by block in a scrambled order — the
   classic Windows 95 "dissolve", NOT a smooth opacity fade. A <canvas> over the
   pixel-art <img> repaints the portrait: the pixel art is the base layer, and the
   photo is stamped in one chunky block at a time as a progress value climbs 0→1
   (and is un-stamped 1→0 on un-hover). Each block flips at its own threshold, and
   the thresholds follow a shuffled order, so the reveal scatters like TV static.

   The <img> underneath stays as the no-JS / pre-load fallback (and carries the
   alt text). External file → the CSP two-inline-hash gate is untouched. Self-
   registers on DOMContentLoaded + astro:page-load, idempotent, and no-ops where
   the avatar is absent (every page but Home). Markup: src/pages/index.astro
   ([data-avatar-reveal] + .avatar__canvas). Reduced motion → instant swap.
   ========================================================================== */
(function () {
  "use strict";

  var PIXEL_SRC = "/images/avatar.png?v=2";
  var REAL_SRC = "/images/avatar-real.jpg?v=1";
  var BLOCK = 16; // device px per dissolve block on the 256² canvas (≈8 CSS px each)
  var DURATION = 460; // ms for a full dissolve in either direction

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function setup(root) {
    var canvas = root.querySelector(".avatar__canvas");
    var ctx = canvas && canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;

    var W = canvas.width;
    var H = canvas.height;
    var cols = Math.ceil(W / BLOCK);
    var rows = Math.ceil(H / BLOCK);
    var total = cols * rows;

    // threshold[block] = the progress value at which this block flips to the photo.
    // A shuffled order gives the scattered "static" dissolve rather than a sweep.
    var seq = [];
    for (var i = 0; i < total; i++) seq.push(i);
    shuffle(seq);
    var threshold = new Array(total);
    for (var pos = 0; pos < total; pos++) threshold[seq[pos]] = (pos + 1) / total;

    var pixelImg = new Image();
    var realImg = new Image();
    var progress = 0; // 0 = pixel-art, 1 = real photo
    var target = 0;
    var raf = null;
    var lastTs = 0;
    var loaded = 0;

    function reduced() {
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (e) {
        return false;
      }
    }

    function render(p) {
      if (!pixelImg.naturalWidth) {
        ctx.clearRect(0, 0, W, H);
        return;
      }
      ctx.imageSmoothingEnabled = false; // crisp pixel-art base (128 → 256, nearest)
      ctx.drawImage(pixelImg, 0, 0, W, H);
      if (p <= 0 || !realImg.naturalWidth) return;
      ctx.imageSmoothingEnabled = true; // smooth photo tiles
      // Aero swaps the Win95 block-dissolve for a smooth glassy crossfade (Elisha:
      // the chunky pixel dissolve reads retro under Aero). Same progress ramp; only
      // the compositing differs. Read the skin per-frame so the live retro↔Aero
      // toggle is honoured mid-session. Retro keeps the block dissolve below.
      if (document.documentElement.getAttribute("data-skin") === "aero") {
        ctx.globalAlpha = p;
        ctx.drawImage(realImg, 0, 0, W, H);
        ctx.globalAlpha = 1;
        return;
      }
      for (var b = 0; b < total; b++) {
        if (threshold[b] <= p) {
          var x = (b % cols) * BLOCK;
          var y = ((b / cols) | 0) * BLOCK;
          ctx.drawImage(realImg, x, y, BLOCK, BLOCK, x, y, BLOCK, BLOCK);
        }
      }
    }

    function tick(ts) {
      if (!lastTs) lastTs = ts;
      var dt = ts - lastTs;
      lastTs = ts;
      var dir = target > progress ? 1 : -1;
      progress += dir * (dt / DURATION);
      if ((dir > 0 && progress >= target) || (dir < 0 && progress <= target)) {
        progress = target;
        render(progress);
        raf = null;
        lastTs = 0;
        return;
      }
      render(progress);
      raf = requestAnimationFrame(tick);
    }

    function animate(to) {
      target = to;
      if (reduced()) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = null;
        }
        progress = to;
        lastTs = 0;
        render(progress);
        return;
      }
      if (!raf) {
        lastTs = 0;
        raf = requestAnimationFrame(tick);
      }
    }

    function start() {
      render(0); // first paint = pixel-art, matching the <img> underneath (no flash)
      var canHover = true;
      try {
        canHover = window.matchMedia("(hover: hover)").matches;
      } catch (e) {}
      if (canHover) {
        root.addEventListener("mouseenter", function () {
          animate(1);
        });
        root.addEventListener("mouseleave", function () {
          animate(0);
        });
      } else {
        // No hover (touch): tap toggles the dissolve.
        root.style.cursor = "pointer";
        root.addEventListener("click", function () {
          animate(target >= 1 ? 0 : 1);
        });
      }
    }

    function done() {
      if (++loaded >= 2) start();
    }
    pixelImg.onload = done;
    pixelImg.onerror = done;
    realImg.onload = done;
    realImg.onerror = done;
    pixelImg.src = PIXEL_SRC;
    realImg.src = REAL_SRC;
  }

  function init() {
    var root = document.querySelector("[data-avatar-reveal]");
    if (!root || root.dataset.avatarRevealReady) return;
    root.dataset.avatarRevealReady = "1";
    setup(root);
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();

/* ============================================================================
   trophy-gallery.js  —  About "Trophy Case" maximized media viewer
   ----------------------------------------------------------------------------
   Click an award row (.tc-row[data-award]) -> a maximized viewer opens with the
   honor's media (photos + the occasional video) in a big stage, a thumbnail
   filmstrip, prev/next, and keyboard nav (Esc closes, <- / -> step). Everything
   is read off the clicked row's data-* attributes (data-title / -year / -sub /
   -tier-label / -blurb and a data-media JSON array of absolute src paths), and
   the row's .tc-ic badge is cloned into the title bar — no inline <script>, so
   the CSP inline-script gate stays at its two pinned hashes. Honors with no
   media show a text card from data-blurb instead of a gallery. Wires on
   astro:page-load (and the first DOMContentLoaded), idempotent per #tcg.
   Markup + data: src/pages/about.astro + src/lib/trophies.js. Styles:
   src/styles/trophies.css (global, so the JS-built media gets styled too).
   ========================================================================== */
(function () {
  "use strict";

  function init() {
    var root = document.getElementById("tcg");
    if (!root) return;
    // idempotent: astro:page-load + DOMContentLoaded can both fire on first
    // load, and the overlay is fresh markup on each client-side navigation.
    if (root.dataset.tcgReady) return;
    root.dataset.tcgReady = "1";

    var elTitle = document.getElementById("tcg-title");
    var elIcon = root.querySelector(".tcg__ic");
    var elMeta = root.querySelector(".tcg__meta");
    var elMedia = document.getElementById("tcg-media");
    var elStrip = document.getElementById("tcg-strip");
    var elCap = document.getElementById("tcg-caption");
    var btnClose = root.querySelector('[data-tcg="close"]');
    var btnPrev = root.querySelector('[data-tcg="prev"]');
    var btnNext = root.querySelector('[data-tcg="next"]');

    var current = null;
    var idx = 0;
    var invoker = null;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function render() {
      if (!current) return;
      var m = current.media[idx];
      elMedia.innerHTML = "";

      if (!m) {
        var empty = document.createElement("div");
        empty.className = "tcg__empty";
        empty.textContent =
          current.blurb ||
          "Photo still in the archive. The honor's logged, the picture comes next.";
        elMedia.appendChild(empty);
      } else if (m.type === "video") {
        var v = document.createElement("video");
        v.src = m.src;
        if (m.poster) v.poster = m.poster;
        v.controls = true;
        v.playsInline = true;
        v.preload = "metadata";
        v.className = "tcg__video";
        elMedia.appendChild(v);
      } else {
        var img = document.createElement("img");
        // prefer the .webp sibling; fall back to the .jpg on decode failure
        img.onerror = function () { img.onerror = null; img.src = m.src; };
        img.src = m.src.replace(/\.jpe?g$/i, ".webp");
        img.alt = current.title + (current.year ? " — " + current.year : "");
        img.className = "tcg__img";
        elMedia.appendChild(img);
      }

      var total = current.media.length;
      elMeta.textContent = total
        ? (m && m.type === "video" ? "Clip" : "Photo") + " " + (idx + 1) + " of " + total
        : "";

      Array.prototype.forEach.call(elStrip.children, function (c, i) {
        c.classList.toggle("is-active", i === idx);
        c.setAttribute("aria-current", i === idx ? "true" : "false");
      });

      var single = total < 2;
      btnPrev.disabled = single;
      btnNext.disabled = single;
    }

    function buildStrip() {
      elStrip.innerHTML = "";
      current.media.forEach(function (m, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "tcg__thumb" + (m.type === "video" ? " tcg__thumb--video" : "");
        var src = m.type === "video" ? m.poster || "" : m.src;
        if (src) b.style.backgroundImage = "url('" + src + "')";
        if (m.type === "video") {
          var play = document.createElement("span");
          play.className = "tcg__play";
          play.textContent = "▶";
          play.setAttribute("aria-hidden", "true");
          b.appendChild(play);
        }
        b.setAttribute("aria-label", (m.type === "video" ? "Video " : "Photo ") + (i + 1));
        b.addEventListener("click", function () { idx = i; render(); });
        elStrip.appendChild(b);
      });
      elStrip.hidden = current.media.length < 2;
    }

    function open(row) {
      if (!row) return;
      var media;
      try { media = JSON.parse(row.getAttribute("data-media") || "[]"); }
      catch (e) { media = []; }
      var ic = row.querySelector(".tc-ic");
      current = {
        title: row.getAttribute("data-title") || "",
        year: row.getAttribute("data-year") || "",
        sub: row.getAttribute("data-sub") || "",
        tierLabel: row.getAttribute("data-tier-label") || "",
        blurb: row.getAttribute("data-blurb") || "",
        iconSvg: ic ? ic.innerHTML : "",
        media: media,
      };
      invoker = row;
      idx = 0;

      elTitle.textContent = current.title + (current.year ? "  —  " + current.year : "");
      elIcon.innerHTML = current.iconSvg || "";
      elCap.textContent =
        (current.sub || "") + (current.tierLabel ? "   ·   " + current.tierLabel : "");

      buildStrip();
      render();

      root.hidden = false;
      root.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("tcg-open");

      if (!reduce) {
        root.classList.remove("tcg-anim");
        void root.offsetWidth;
        root.classList.add("tcg-anim");
      }

      // If this honor opens on a video (the District finalist), play it — the
      // gallery open was a user click, so the gesture permits it. If a browser
      // still blocks sound autoplay, it just stays paused with controls showing.
      if (current.media[0] && current.media[0].type === "video") {
        var firstVideo = elMedia.querySelector("video");
        if (firstVideo) {
          var played = firstVideo.play();
          if (played && played.catch) played.catch(function () {});
        }
      }

      btnClose.focus();
      document.addEventListener("keydown", onKey);
    }

    function close() {
      var v = elMedia.querySelector("video");
      if (v) { try { v.pause(); } catch (e) {} }
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("tcg-open");
      document.removeEventListener("keydown", onKey);
      if (invoker && invoker.focus) invoker.focus();
      current = null;
    }

    function step(d) {
      if (!current || current.media.length < 2) return;
      idx = (idx + d + current.media.length) % current.media.length;
      render();
    }

    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    }

    root.addEventListener("click", function (e) {
      var hit = e.target.closest("[data-tcg]");
      if (hit) {
        var act = hit.getAttribute("data-tcg");
        if (act === "close") close();
        else if (act === "next") step(1);
        else if (act === "prev") step(-1);
        return;
      }
      if (e.target === root) close();
    });

    document.querySelectorAll("[data-award]").forEach(function (row) {
      row.addEventListener("click", function () { open(row); });
    });
  }

  // Run on first load AND on every Astro view-transition navigation (the site
  // swaps page content client-side, so DOMContentLoaded won't re-fire).
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();

/* ============================================================================
   about-reveal.js  —  the About README's "A Means to an End" reader (#mte)
   ----------------------------------------------------------------------------
   The README's closing line is a [data-mte] button. Clicking it opens a paged
   green-on-black BBS/LCD terminal echoing the Art page's visual-poem viewer
   (#vpv). The deck is a cover frame + content frames (src/lib/about.js); each
   frame can carry a contact sheet of photo thumbnails.

   TWO MODES, one overlay:
     - "deck"  : prev/next page the frames; Esc/×/backdrop close; the only motion
                 is the blinking terminal cursor (no teletype — this is prose).
     - "image" : tapping a thumbnail enlarges that photo IN the terminal screen;
                 prev/next now walk that frame's photos (wrap), the caption shows
                 below, and Esc / "back" return to the frame (focus to the thumb).

   The full-size photo loads only on enlarge; the contact sheet uses /thumbs/.
   Self-registers on DOMContentLoaded + astro:page-load, idempotent via
   root.dataset.mteReady, no-ops when #mte is absent (every page but About).
   External is:inline src -> the CSP two-hash gate is untouched.
   Markup + data: src/pages/about.astro (#mte) / src/lib/about.js.
   Styles: src/styles/components.css (ABOUT — Means to an End viewer block).
   ========================================================================== */
(function () {
  "use strict";

  function prefersReduce() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (_) { return false; }
  }

  function initReveal() {
    var root = document.getElementById("mte");
    if (!root || root.dataset.mteReady) return;
    root.dataset.mteReady = "1";

    var elMeta = root.querySelector("#mte-meta"),
        elHint = root.querySelector("#mte-hint"),
        screen = root.querySelector("#mte-screen"),
        deck = root.querySelector("#mte-deck"),
        pages = Array.prototype.slice.call(root.querySelectorAll("[data-mte-page]")),
        imgview = root.querySelector("#mte-imgview"),
        imgEl = root.querySelector("#mte-imgview-img"),
        capEl = root.querySelector("#mte-imgview-cap"),
        btnClose = root.querySelector("[data-mte-close]"),
        btnPrev = root.querySelector("[data-mte-prev]"),
        btnNext = root.querySelector("[data-mte-next]");
    if (!pages.length || !btnClose) return;   // defensive — nothing to drive

    var total = pages.length;
    var mode = "deck";          // "deck" | "image"
    var idx = 0;                // current frame
    var gallery = [];           // [{ full, caption, alt }] for the current image mode
    var imgIdx = 0;             // current photo within gallery
    var imgInvoker = null;      // the thumb that opened image mode (focus restore)
    var invoker = null;         // the README line that opened the reader

    var DECK_HINT = "← → to turn the page · Esc to close";
    var IMG_HINT = "← → photos · Esc back to the story";

    function setMeta(label) { if (elMeta) elMeta.textContent = "[ " + label + " ]"; }

    // -------- DECK MODE --------
    function renderDeck() {
      for (var n = 0; n < total; n++) {
        var on = n === idx;
        pages[n].hidden = !on;
        pages[n].setAttribute("aria-hidden", on ? "false" : "true");
      }
      var cur = pages[idx];
      setMeta(cur.getAttribute("data-meta") || String(idx + 1));
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === total - 1;
      btnPrev.setAttribute("aria-label", "Previous");
      btnNext.setAttribute("aria-label", "Next");
      if (elHint) elHint.textContent = DECK_HINT;
      if (screen) screen.scrollTop = 0;
    }

    function stepDeck(d) {
      var nx = idx + d;
      if (nx < 0 || nx > total - 1) return;   // bounded, no wrap
      idx = nx;
      renderDeck();
    }

    // -------- IMAGE MODE --------
    function renderImage() {
      var m = gallery[imgIdx] || {};
      var full = m.full || "";
      // prefer the .webp sibling; fall back to the .jpg on decode failure
      imgEl.onerror = function () { imgEl.onerror = null; imgEl.src = full; };
      imgEl.src = full ? full.replace(/\.jpe?g$/i, ".webp") : "";
      imgEl.alt = m.alt || "";
      // caption (+ an optional "(review)" link out) — built with nodes, not innerHTML
      capEl.textContent = m.caption || "";
      if (m.link) {
        capEl.appendChild(document.createTextNode(" "));
        var a = document.createElement("a");
        a.className = "mte__cap-link";
        a.href = m.link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "(review)";
        capEl.appendChild(a);
      }
      setMeta("photo " + (imgIdx + 1) + " / " + gallery.length);
      var single = gallery.length < 2;
      btnPrev.disabled = single;
      btnNext.disabled = single;
      btnPrev.setAttribute("aria-label", "Previous photo");
      btnNext.setAttribute("aria-label", "Next photo");
      if (elHint) elHint.textContent = IMG_HINT;
      if (screen) screen.scrollTop = 0;
    }

    function stepImage(d) {
      if (gallery.length < 2) return;
      imgIdx = (imgIdx + d + gallery.length) % gallery.length;   // wrap
      renderImage();
    }

    function openImage(thumb) {
      var sheet = thumb.closest("[data-mte-gallery]");
      if (!sheet) return;
      var thumbs = Array.prototype.slice.call(sheet.querySelectorAll("[data-mte-thumb]"));
      gallery = thumbs.map(function (t) {
        return {
          full: t.getAttribute("data-full") || "",
          caption: t.getAttribute("data-caption") || "",
          alt: t.getAttribute("data-alt") || "",
          link: t.getAttribute("data-link") || "",
        };
      });
      imgIdx = Math.max(0, thumbs.indexOf(thumb));
      imgInvoker = thumb;
      mode = "image";
      deck.hidden = true;
      imgview.hidden = false;
      imgview.setAttribute("aria-hidden", "false");
      renderImage();
      var back = imgview.querySelector("[data-mte-back]");
      if (back) back.focus();
    }

    function closeImage() {
      mode = "deck";
      imgview.hidden = true;
      imgview.setAttribute("aria-hidden", "true");
      imgEl.removeAttribute("src");   // drop the big image so it isn't held in memory
      deck.hidden = false;
      renderDeck();
      if (imgInvoker && imgInvoker.focus) imgInvoker.focus();
      imgInvoker = null;
      gallery = [];
    }

    // -------- shared open/close + nav routing --------
    function open(trigger) {
      invoker = trigger || null;
      mode = "deck";
      idx = 0;
      imgview.hidden = true;
      imgview.setAttribute("aria-hidden", "true");
      deck.hidden = false;
      root.hidden = false;
      root.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("mte-open");
      if (!prefersReduce()) {
        root.classList.remove("mte-anim");
        void root.offsetWidth;          // restart the pop animation
        root.classList.add("mte-anim");
      }
      renderDeck();
      btnClose.focus();
      document.addEventListener("keydown", onKey, true);   // capture, matches #vpv
    }

    function close() {
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("mte-open");
      document.removeEventListener("keydown", onKey, true);
      imgview.hidden = true;
      imgEl.removeAttribute("src");
      deck.hidden = false;
      if (invoker && invoker.focus) invoker.focus();
      invoker = null;
      imgInvoker = null;
      gallery = [];
      mode = "deck";
      idx = 0;
    }

    function stepPrev() { mode === "image" ? stepImage(-1) : stepDeck(-1); }
    function stepNext() { mode === "image" ? stepImage(1) : stepDeck(1); }

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        mode === "image" ? closeImage() : close();
        return;
      }
      if (e.key === "ArrowRight") { e.preventDefault(); stepNext(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); stepPrev(); return; }
      if (e.key !== "Tab") return;
      // :not([disabled]) so a disabled prev/next never traps focus on a dead control;
      // hidden elements (the off-mode layer) are already non-focusable.
      var f = root.querySelectorAll("button:not([disabled]), [tabindex]:not([tabindex='-1'])");
      f = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null || el === document.activeElement; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    root.addEventListener("click", function (e) {
      if (e.target.closest("[data-mte-close]")) return close();
      if (e.target.closest("[data-mte-back]")) return closeImage();
      var thumb = e.target.closest("[data-mte-thumb]");
      if (thumb) return openImage(thumb);
      if (e.target.closest("[data-mte-prev]")) return stepPrev();
      if (e.target.closest("[data-mte-next]")) return stepNext();
      if (e.target === root) return close();   // backdrop
    });

    // Launcher(s): the README reveal phrase (a span[role=button] so the highlight
    // wraps as true inline text) and any other [data-mte] trigger. A span doesn't
    // fire click on Enter/Space, so wire keyboard activation explicitly.
    document.querySelectorAll("[data-mte]").forEach(function (b) {
      b.addEventListener("click", function () { open(b); });
      b.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          open(b);
        }
      });
    });
  }

  function init() { initReveal(); }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();

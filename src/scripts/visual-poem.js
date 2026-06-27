/* ============================================================================
   visual-poem.js  —  the Art page's "what i chose" teletype BBS viewer (#vpv)
   ----------------------------------------------------------------------------
   The Poetry window's FIRST file-list row is the 2020 visual poem "what i chose"
   (.filelist__row[data-vpv], carrying data-slides / data-title / data-attribution
   / data-title-art-alt). Clicking it opens a green-on-black LCD "terminal" that
   echoes the in-house CD-player palette (.cdp__lcd) and PAINTS each stanza the way
   a 1200-baud BBS painted a text screen: a monotonic left-to-right reveal of the
   VERBATIM characters, in order — NO scramble, NO randomization, NO crossfade.

   A 6-frame deck: frame 0 = the framed title painting (lazy <img>, src copied off
   the row thumbnail — never eager-loaded), frames 1..5 = the five stanzas. Bounded
   prev/next (no wrap). Esc / × / backdrop close, focus restores to the row, Tab is
   trapped. Under prefers-reduced-motion the full stanza is shown instantly with no
   typing and the cursor is parked steady (CSS pins it on).

   Mirrors notepad.js's initViewer (open-from-row / close / focus / Tab trap /
   reduced-motion / data-*Ready idempotency / DOMContentLoaded + astro:page-load
   registration) grafted with trophy-gallery.js's idx/render/step multi-frame nav.
   The in-overlay controls use data-vpv-close / -prev / -next — DISTINCT from the
   row's data-vpv launcher attr (mirrors notepad's data-np vs data-np-close), so
   the launcher loop can never re-bind open() onto the close/prev/next buttons and
   no .closest('#vpv') guard is needed.

   External; self-registers on DOMContentLoaded + astro:page-load; idempotent via
   root.dataset.vpvReady. No-ops when #vpv is absent (off the Art page). External
   is:inline src → ZERO inline blocks, so the CSP two-hash gate is untouched.
   Markup: src/pages/art.astro (#vpv). Data: src/lib/art.js (WHAT_I_CHOSE_SLIDES).
   Styles: src/styles/art.css (VISUAL-POEM VIEWER block).
   ========================================================================== */
(function () {
  "use strict";

  function prefersReduce() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (_) { return false; }
  }

  function initViewer() {
    var root = document.getElementById("vpv");
    if (!root || root.dataset.vpvReady) return;
    root.dataset.vpvReady = "1";

    var elTitle = root.querySelector("#vpv-title"),
        elMeta = root.querySelector("#vpv-meta"),
        elArt = root.querySelector("#vpv-art"),
        elArtCap = root.querySelector("#vpv-art-cap"),
        elRule = root.querySelector("#vpv-rule"),
        elText = root.querySelector("#vpv-text"),
        btnClose = root.querySelector("[data-vpv-close]"),
        btnPrev = root.querySelector("[data-vpv-prev]"),
        btnNext = root.querySelector("[data-vpv-next]");

    // prefersReduce() is read LIVE at each use site (open + render) rather than
    // cached here, so toggling the OS Reduce-Motion setting mid-session is honored.
    var slides = [], idx = 0, invoker = null;
    var artSrc = "", artAlt = "", attribution = "";
    var typer = null;                  // pending setTimeout id — the cancellation handle
    var textNode = null, cursor = null; // persistent children of elText (built once per render)

    // --- text-node plumbing: the cursor span is never clobbered, no innerHTML --
    function clearText() {
      elText.textContent = "";
      textNode = null;
      cursor = null;
    }
    function buildText() {
      clearText();
      textNode = document.createTextNode("");
      cursor = document.createElement("span");
      cursor.className = "vpv__cur";
      cursor.setAttribute("aria-hidden", "true");
      cursor.textContent = "▌";
      elText.appendChild(textNode);
      elText.appendChild(cursor);
    }
    function setTextStatic(full) {
      buildText();
      textNode.nodeValue = full;       // reduced-motion path; cursor present, CSS freezes its blink
    }

    function cancelType() {
      if (typer) { clearTimeout(typer); typer = null; }
    }

    // --- teletype: stepped setTimeout, self-cancelling, whitespace-instant -----
    function typeOut(full) {
      cancelType();
      buildText();
      var n = 0, L = full.length;
      function step() {
        if (n < L) { n++; }                                  // reveal one visible char
        while (n < L && /\s/.test(full.charAt(n))) { n++; }  // swallow the following whitespace run this tick
        textNode.nodeValue = full.slice(0, n);               // mutate ONLY the text node; cursor untouched
        if (n < L) { typer = setTimeout(step, 16); }
        else { typer = null; }                               // done — cursor parks & keeps blinking
      }
      typer = setTimeout(step, 90);     // --speed-fast lead-in so the box frame paints first
    }

    function render() {
      cancelType();                     // ALWAYS kill any in-flight typer first
      var total = slides.length + 1;
      btnPrev.disabled = idx === 0;     // bounded deck (no wrap)
      btnNext.disabled = idx === total - 1;

      if (idx === 0) {
        // ---- TITLE CARD ----
        elArt.hidden = false;
        elRule.textContent = "";
        clearText();
        elMeta.textContent = "[ cover ]";
        if (artSrc) {
          var img = elArt.querySelector("img");
          if (!img) {
            img = document.createElement("img");
            img.className = "vpv__art-img";
            img.loading = "lazy";
            img.decoding = "async";
            elArt.insertBefore(img, elArtCap);
          }
          if (img.getAttribute("src") !== artSrc) img.src = artSrc;  // assign src HERE only — once, on frame 0
          img.alt = artAlt;
          elArtCap.textContent = attribution;
        } else {
          elArt.hidden = true;          // no thumbnail loaded yet → skip the card gracefully
        }
        return;
      }

      // ---- STANZA ----
      elArt.hidden = true;
      elArtCap.textContent = "";
      var s = slides[idx - 1];
      if (!s) return;
      var roman = s.roman || (idx + ".");
      elMeta.textContent = "[ " + roman.replace(".", "") + " of " + slides.length + " ]";  // "[ I of V ]"
      elRule.textContent = "── " + roman + " ──";
      var full = s.text || "";
      if (prefersReduce()) { setTextStatic(full); return; }   // full verbatim text instantly, static cursor
      typeOut(full);
    }

    function open(row) {
      invoker = row;
      try { slides = JSON.parse(row.getAttribute("data-slides") || "[]"); }
      catch (e) { slides = []; }
      if (!Array.isArray(slides) || !slides.length) return;   // defensive — nothing to show

      var title = row.getAttribute("data-title") || "";
      attribution = row.getAttribute("data-attribution") || "";
      var thumb = row.querySelector(".filelist__icon--art img");   // the already-lazy row thumbnail
      artSrc = thumb ? (thumb.currentSrc || thumb.src || "") : "";  // copy resolved src — NO new fetch
      artAlt = row.getAttribute("data-title-art-alt") || title;
      elTitle.textContent = title + "  —  visual poem";
      idx = 0;

      root.hidden = false;
      root.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("vpv-open");
      if (!prefersReduce()) {
        root.classList.remove("vpv-anim");
        void root.offsetWidth;
        root.classList.add("vpv-anim");
      }
      render();
      btnClose.focus();
      document.addEventListener("keydown", onKey, true);   // capture, matches notepad
    }

    function close() {
      cancelType();
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("vpv-open");
      document.removeEventListener("keydown", onKey, true);
      if (invoker && invoker.focus) invoker.focus();
      invoker = null;
      slides = [];
      idx = 0;
    }

    function step(d) {
      cancelType();
      var total = slides.length + 1;
      var nx = idx + d;
      if (nx < 0 || nx > total - 1) return;   // bounded, no wrap
      idx = nx;
      render();
    }

    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); return; }
      if (e.key !== "Tab") return;
      // :not([disabled]) so a disabled prev/next at deck ends never traps focus on a dead control
      var f = root.querySelectorAll("button:not([disabled]), [tabindex]:not([tabindex='-1'])");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    root.addEventListener("click", function (e) {
      if (e.target.closest("[data-vpv-close]")) return close();
      if (e.target.closest("[data-vpv-prev]")) return step(-1);
      if (e.target.closest("[data-vpv-next]")) return step(1);
      if (e.target === root) return close();   // backdrop
    });

    document.querySelectorAll(".filelist__row[data-vpv]").forEach(function (b) {
      b.addEventListener("click", function () { open(b); });
    });
  }

  function init() { initViewer(); }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();

/* ============================================================================
   contact-terminal.js  —  Contact "Terminal — contact" console motion
   ----------------------------------------------------------------------------
   DECORATION ONLY. The Contact form is the real Web3Forms form wearing a console
   skin (.term, styled in src/styles/contact-terminal.css). This script's only
   jobs are: (1) a once-per-session typed BOOT of the console lines, and (2) a
   decorative TRANSMIT progress bar on send. It NEVER preventDefaults the submit,
   touches the form fields, or writes the aria-live status — so the inline form
   handler's bytes stay identical and the CSP inline-script gate stays at its two
   pinned hashes.

   Contract (matches trophy-gallery.js / systray.js / boot.js):
     • self-registers on `astro:page-load` (fires on first load AND after every
       view-transition swap);
     • HARD NO-OP when [data-term-banner] is absent — every page but /contact is
       untouched;
     • idempotent via `data-termReady` on [data-term];
     • once-per-session boot gate via sessionStorage("cascadia-term-booted") —
       a 2nd /contact visit this session shows the console already booted;
     • reduced motion (belt and suspenders): this script skips the type-on AND
       the transmit animation; the CSS cursor blink uses the shared @keyframes
       blink, which tokens.css's global reduce block also freezes.

   The boot lines + logo are plain static HTML, so JS-off (or a script error) still
   shows them, and the form is fully interactive from first paint — the type-on is
   pure decoration over text that is already present and never gates the form.
   ========================================================================== */
(function () {
  "use strict";

  function prefersReduce() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (_) { return false; }
  }

  // Decorative transmit bar. Bound once; does NOT preventDefault, so the inline
  // handler still runs (and confirms via the shared success dialog). The submit
  // event only fires after native validation passes, so a real send is in flight.
  function bindTransmit(term, reduce) {
    var form = term.querySelector("[data-contact-form]");
    var xmit = term.querySelector("[data-term-xmit]");
    if (!form || !xmit) return;
    form.addEventListener("submit", function () {
      if (reduce) return; // reduced motion: let the handler's status line stand
      var pct = 0;
      xmit.textContent = "";
      var timer = setInterval(function () {
        pct += 11; if (pct > 100) pct = 100;
        var fill = Math.round((pct / 100) * 16), bar = "";
        for (var k = 0; k < 16; k++) bar += (k < fill ? "▓" : "░"); // ▓ / ░
        xmit.innerHTML = "transmitting <b>" + bar + "</b> " + pct + "%";
        if (pct >= 100) {
          clearInterval(timer);
          setTimeout(function () { xmit.textContent = ""; }, 1200);
        }
      }, 75);
    }, false);
  }

  function init() {
    var banner = document.querySelector("[data-term-banner]");
    if (!banner) return; // not the contact terminal
    var term = document.querySelector("[data-term]");
    if (!term) return;
    if (term.dataset.termReady) return; // bind once
    term.dataset.termReady = "1";

    var reduce = prefersReduce();

    // Transmit bar is independent of the boot branch — bind it first.
    bindTransmit(term, reduce);

    var booted = false;
    try { booted = !!sessionStorage.getItem("cascadia-term-booted"); } catch (_) {}

    // Reduced motion, or already booted this session: show the console fully
    // booted with no type-on. Turn on the blink cursor only when motion is
    // allowed (under reduce the keyframe is frozen anyway; honor the guard).
    if (reduce || booted) {
      if (!reduce) term.classList.add("term--connected");
      return;
    }

    // First visit this session, motion allowed: type the boot once.
    try { sessionStorage.setItem("cascadia-term-booted", "1"); } catch (_) {}
    term.classList.add("term--connecting");

    // The last boot line carries [data-term-last]; settle to the steady cursor on
    // its animationend (a fallback timer covers a missed event). Listen on .term.
    var settled = false;
    function settle() {
      if (settled) return;
      settled = true;
      term.classList.remove("term--connecting");
      term.classList.add("term--connected");
    }
    term.addEventListener("animationend", function (e) {
      if (e.target && e.target.matches && e.target.matches("[data-term-last]")) settle();
    });
    setTimeout(settle, 1400);
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();

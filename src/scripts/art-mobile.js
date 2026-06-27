/* ============================================================================
   art-mobile.js — mobile medium-switcher for the Art page (V2 "A6" reflow).

   Desktop shows all three Art windows in a grid. On mobile (<62em) the CSS
   shows ONLY the .is-active window, full-width, and the chip rail
   ([data-art-switch] in art.astro) switches between mediums — so a phone never
   gets the old ~3,600px stack-and-scroll. The chips drive the SAME .is-active
   window state windows.js owns (via window.CascadiaWindows.focus), so the chip
   rail and the bottom taskbar stay in lockstep: tap either, the active window
   updates and both reflect it.

   Self-registering on astro:page-load (+ first DOMContentLoaded), idempotent via
   a data-flag, and a complete no-op on every page but Art (the rail is absent).
   External file → the CSP inline-script hash count is untouched.
   ========================================================================== */
(function () {
  "use strict";

  function activeWindowId() {
    var active = document.querySelector(".window.is-active");
    return active ? active.dataset.window || active.id : null;
  }

  // Tracks the medium currently shown so syncChips snaps the scroll only on an
  // ACTUAL switch (not on every unrelated .window class mutation).
  var lastActiveId = null;

  function syncChips(chips) {
    var id = activeWindowId();
    chips.forEach(function (chip) {
      var on = chip.dataset.artTarget === id;
      chip.classList.toggle("is-active", on);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    });
    // Snap to the top on a real medium change, from EITHER switch path — a chip
    // tap OR a bottom-taskbar tap (both land here via the observer). The outgoing
    // window may be scrolled down (tall cork board); the shorter incoming one
    // would otherwise strand the viewport in dead space. Mobile only; the sticky
    // chip rail stays put.
    if (id && id !== lastActiveId && window.matchMedia("(max-width: 61.99em)").matches) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    lastActiveId = id;
  }

  function initArtMobile() {
    var rail = document.querySelector("[data-art-switch]");
    if (!rail || rail.dataset.artMobileReady) return;
    rail.dataset.artMobileReady = "1";

    var chips = Array.prototype.slice.call(
      rail.querySelectorAll(".art-switch__chip")
    );
    if (!chips.length) return;

    // Seed so the initial sync below isn't treated as a switch (no scroll on load).
    lastActiveId = activeWindowId();

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var id = chip.dataset.artTarget;
        // Bring the chosen window forward. windows.js keeps exactly one window
        // .is-active; the mobile CSS shows only that one.
        if (window.CascadiaWindows && typeof window.CascadiaWindows.focus === "function") {
          window.CascadiaWindows.focus(id);
        }
        // Reflect immediately (the observer below also fires, but calling here
        // covers the case where CascadiaWindows isn't ready yet). syncChips also
        // performs the scroll-to-top on the switch.
        syncChips(chips);
      });
    });

    // Keep the chips in sync when the active window changes from elsewhere —
    // the bottom taskbar buttons, or a pointerdown on a window. Observing the
    // class attribute on each window is cheaper than polling and never fights
    // windows.js for ownership of the state.
    if ("MutationObserver" in window) {
      var wins = document.querySelectorAll(".window");
      if (wins.length) {
        var obs = new MutationObserver(function () { syncChips(chips); });
        wins.forEach(function (w) {
          obs.observe(w, { attributes: true, attributeFilter: ["class"] });
        });
      }
    }

    syncChips(chips);
  }

  // astro:page-load fires on the initial document load AND after every
  // view-transition swap — the same hook windows.js uses (and registered after
  // it), so initArtMobile never runs before windows.js has seeded .is-active.
  // No DOMContentLoaded/synchronous fallback: it would only risk a pre-windows
  // mis-sync, and astro:page-load already covers first load.
  document.addEventListener("astro:page-load", initArtMobile);
})();

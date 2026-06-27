/* ============================================================================
   mobile-collapse.js  —  responsive native-<details> open state for tall windows
   ----------------------------------------------------------------------------
   A native <details> open/closed state is HTML, not CSS, so a media query CANNOT
   set it per breakpoint. This script does, at <=720px, re-syncing on breakpoint
   cross. Two opt-in flavors:

     • `.m-collapse`        — open on desktop, COLLAPSED on mobile (the résumé
                              sections). The lead stays out of the wrapper.
     • `[data-m-mobile]`    — keep the element's MARKUP open state on desktop, but
                              force a specific state on mobile:
                                data-m-mobile="closed"  -> collapsed on mobile
                                data-m-mobile="open"    -> open on mobile
                              (used on the Work File Explorer: Apps closed +
                              Services open on mobile, so the index shows that
                              folders open without the biggest one dominating).
     • `[data-m-keep-open]` — always open, any width.

   Markup authors the DESKTOP truth (so desktop + the 721–991px band are correct
   at first paint, zero CSS); the script only diverges on mobile. Re-syncs on
   breakpoint cross only, so a visitor's manual toggle within a breakpoint sticks.
   External file → the CSP inline-hash count is untouched. Keyboard/AT come free
   from the native element.
   ========================================================================== */
(function () {
  "use strict";
  var MQ = "(max-width: 720px)";
  var mql = null;
  var bound = false;
  var SEL = ".m-collapse, [data-m-mobile]";

  // Capture each element's desktop open state ONCE, before we ever mutate it:
  // .m-collapse opens on desktop; [data-m-mobile] keeps its authored [open].
  function desktopOpen(el) {
    if (el.__mDeskOpen === undefined) {
      el.__mDeskOpen = el.classList.contains("m-collapse")
        ? true
        : el.hasAttribute("open");
    }
    return el.__mDeskOpen;
  }

  function sync() {
    if (!mql) return;
    var mobile = mql.matches;
    var els = document.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var deskOpen = desktopOpen(el); // capture first (before mutating)
      if (el.hasAttribute("data-m-keep-open")) { el.open = true; continue; }
      if (!mobile) { el.open = deskOpen; continue; }
      var mob = el.getAttribute("data-m-mobile");
      if (mob === "open") el.open = true;
      else if (mob === "closed") el.open = false;
      else if (el.classList.contains("m-collapse")) el.open = false;
      else el.open = deskOpen;
    }
  }

  function init() {
    if (!document.querySelector(SEL)) return; // not on this page
    try { if (!mql) mql = window.matchMedia(MQ); } catch (_) { return; }
    if (!bound) {
      bound = true;
      if (mql.addEventListener) mql.addEventListener("change", sync);
      else if (mql.addListener) mql.addListener(sync); // older Safari
    }
    sync();
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();

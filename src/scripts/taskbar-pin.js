/* ============================================================================
   taskbar-pin.js  —  keep the bottom taskbar welded to the VISUAL viewport
   ----------------------------------------------------------------------------
   On mobile, the body scrolls (mobile.css releases the desktop's viewport lock)
   while the taskbar is position:fixed; bottom:0. A fixed element anchors to the
   LAYOUT viewport, but iOS's collapsing browser toolbar slides the VISUAL
   viewport bottom around during scroll, so the bar drifts off the bottom and
   strands mid-page. We measure that gap with the VisualViewport API and publish
   it as --vv-inset-bottom; desktop.css / startmenu.css / mobile.css fold it into
   the `bottom` of the taskbar and the chrome anchored above it, so they ride up
   by the gap and stay glued to the visible bottom.

   No-op on desktop (body is overflow:hidden → no scroll → gap stays 0) and on any
   browser without VisualViewport. External file → the CSP 2-inline-hash gate is
   untouched. Binds once on `window` so it survives view-transition swaps; reads
   document.documentElement fresh each frame in case the swap replaces it.
   ========================================================================== */
(function () {
  var vv = window.visualViewport;
  if (!vv || window.__taskbarPinned) return;
  window.__taskbarPinned = true;

  var mq = window.matchMedia("(max-width: 720px)");
  var raf = 0;

  // The on-screen keyboard also shrinks the visual viewport. We don't want the
  // taskbar to leap up above the keyboard on the contact form, so when a text
  // field is focused we release the pin (the bar just sits behind the keyboard,
  // the normal mobile behaviour).
  function keyboardLikely() {
    var a = document.activeElement;
    return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
  }

  function measure() {
    raf = 0;
    var gap = 0;
    if (mq.matches && !keyboardLikely()) {
      // Distance from the visible bottom up to the layout-viewport bottom (where
      // bottom:0 sits). Positive while the browser toolbar overlaps the bottom.
      gap = window.innerHeight - (vv.height + vv.offsetTop);
      if (gap < 0) gap = 0; // clamp rubber-band overshoot
    }
    document.documentElement.style.setProperty("--vv-inset-bottom", gap + "px");
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(measure);
  }

  vv.addEventListener("resize", schedule);
  vv.addEventListener("scroll", schedule);
  window.addEventListener("orientationchange", schedule);
  if (mq.addEventListener) mq.addEventListener("change", schedule);

  measure();
})();

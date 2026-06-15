/* ============================================================================
   scrollbar.js  —  custom Win95 scrollbar (renders on macOS too)
   ----------------------------------------------------------------------------
   The native ::-webkit-scrollbar pseudo-elements can't draw arrow BUTTONS or a
   thumb GRIP on macOS/Safari (verified live: ::-webkit-scrollbar-button and a
   thumb background-image are both ignored there). So this overlays a real-DOM
   scrollbar — sunken track + raised thumb w/ engraved grip + up/down arrow
   buttons — on each OVERFLOWING window body, which renders identically on every
   platform.

   Non-invasive by design: the .window__body stays the real native scroller (its
   native bar hidden via the .has-cscroll class), so wheel / trackpad / touch /
   keyboard scrolling all keep working untouched. The custom bar is appended to
   the .window (which is position:relative), pinned over the body's right padding
   gutter, and only MIRRORS + DRIVES body.scrollTop. It is aria-hidden (a mouse
   affordance — assistive-tech users scroll natively) and gated to desktop /
   pointer:fine (touch keeps momentum scroll + the mobile stacked layout). It
   re-inits on astro:page-load with a full teardown so no observer/listener
   dangles across a view-transition swap.

   No animation/transition is introduced (scroll updates are instant), so there
   is nothing for prefers-reduced-motion to neutralize.

   External file loaded via <script is:inline src> in Layout.astro, so the CSP
   two-hash gate is untouched.
   ========================================================================== */
(function () {
  var fine = window.matchMedia ? window.matchMedia("(pointer: fine)") : { matches: true };
  var instances = [];   // live { body, bar, ro, onScroll, place } — for teardown
  var STEP = 40;        // px per arrow click / repeat tick

  function teardown() {
    instances.forEach(function (s) {
      if (s.ro) s.ro.disconnect();
      if (s.stops) s.stops.forEach(function (fn) { fn(); });   // cancel any in-flight arrow-repeat timer
      if (s.body) {
        s.body.removeEventListener("scroll", s.onScroll);
        s.body.classList.remove("has-cscroll");
      }
      if (s.bar && s.bar.parentNode) s.bar.parentNode.removeChild(s.bar);
    });
    instances = [];
  }

  function build(body) {
    // Host = the scroller's nearest positioned ancestor: the .window for a
    // .window__body (unchanged behaviour), or the position:relative .fav__content
    // for the favorites .fav__grids. The bar is appended there + pinned over the
    // scroller's right gutter, so the same code drives both.
    var host = body.offsetParent;
    if (!host || !body.closest(".window")) return;
    body.classList.add("has-cscroll");

    var bar = document.createElement("div");
    bar.className = "cscroll";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML =
      '<button class="cscroll__btn cscroll__btn--up" type="button" tabindex="-1"></button>' +
      '<div class="cscroll__track"><div class="cscroll__thumb"></div></div>' +
      '<button class="cscroll__btn cscroll__btn--down" type="button" tabindex="-1"></button>';
    host.appendChild(bar);

    var track = bar.querySelector(".cscroll__track");
    var thumb = bar.querySelector(".cscroll__thumb");
    var upBtn = bar.querySelector(".cscroll__btn--up");
    var downBtn = bar.querySelector(".cscroll__btn--down");

    // Pin the bar over the scroller's right gutter. Geometry is read relative to
    // the offsetParent (host) so a dragged window (transform) carries the bar for
    // free; only size changes (maximize/resize/content) need a re-place().
    function place() {
      if (!body.offsetParent) { bar.style.display = "none"; return; }
      bar.style.top = body.offsetTop + "px";
      bar.style.height = body.offsetHeight + "px";
      bar.style.right = (host.clientWidth - (body.offsetLeft + body.offsetWidth)) + "px";
      sync();
    }

    // Mirror the thumb to the body's scroll position + visible fraction.
    function sync() {
      var sh = body.scrollHeight, ch = body.clientHeight, st = body.scrollTop;
      var overflow = sh - ch;
      if (overflow <= 1) { bar.style.display = "none"; return; }   // nothing to scroll
      bar.style.display = "";
      var trackH = track.clientHeight;
      var thumbH = Math.max(24, Math.round(trackH * ch / sh));
      var maxTop = trackH - thumbH;
      thumb.style.height = thumbH + "px";
      thumb.style.top = (overflow > 0 ? Math.round(maxTop * st / overflow) : 0) + "px";
    }

    var ticking = false;
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function () { ticking = false; sync(); });
      }
    }
    body.addEventListener("scroll", onScroll, { passive: true });

    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { place(); });
      ro.observe(body);
      ro.observe(host);
    }

    // --- Thumb drag ----------------------------------------------------------
    thumb.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      var startY = e.clientY, startScroll = body.scrollTop;
      var maxTop = track.clientHeight - thumb.offsetHeight;
      var overflow = body.scrollHeight - body.clientHeight;
      try { thumb.setPointerCapture(e.pointerId); } catch (err) {}
      function move(ev) {
        var dy = ev.clientY - startY;
        body.scrollTop = startScroll + (maxTop > 0 ? (dy / maxTop) * overflow : 0);
      }
      function end() {
        thumb.removeEventListener("pointermove", move);
        thumb.removeEventListener("pointerup", end);
        thumb.removeEventListener("pointercancel", end);
      }
      thumb.addEventListener("pointermove", move);
      thumb.addEventListener("pointerup", end);
      thumb.addEventListener("pointercancel", end);
    });

    // --- Arrow buttons (click + hold-to-repeat) ------------------------------
    function arm(btn, dir) {
      var timer = null;
      function step() { body.scrollTop += dir * STEP; }
      function down(e) {
        e.preventDefault();
        step();
        timer = setTimeout(function repeat() {
          step();
          timer = setTimeout(repeat, 60);
        }, 300);
      }
      function stop() { if (timer) { clearTimeout(timer); timer = null; } }
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", stop);
      btn.addEventListener("pointercancel", stop);
      btn.addEventListener("pointerleave", stop);
      return stop;   // so teardown() can cancel an in-flight repeat on a removed bar
    }
    var stops = [arm(upBtn, -1), arm(downBtn, 1)];

    // --- Track paging (click above/below the thumb) --------------------------
    track.addEventListener("pointerdown", function (e) {
      if (e.target === thumb) return;
      var r = thumb.getBoundingClientRect();
      var page = body.clientHeight * 0.9;
      if (e.clientY < r.top) body.scrollTop -= page;
      else if (e.clientY > r.bottom) body.scrollTop += page;
    });

    // Wheel over the bar scrolls the body (a sibling overlay wouldn't receive
    // the body's native wheel otherwise). Only preventDefault when the scroll
    // actually moved, so a wheel at the scroll boundary still chains normally.
    bar.addEventListener("wheel", function (e) {
      var prev = body.scrollTop;
      body.scrollTop += e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      if (body.scrollTop !== prev) e.preventDefault();
    }, { passive: false });

    instances.push({ body: body, bar: bar, ro: ro, onScroll: onScroll, place: place, stops: stops });
    place();
  }

  function init() {
    teardown();
    if (!fine.matches) return;   // touch / coarse pointer: keep native scroll
    // Every overflowing window body, PLUS the favorites cover grid (which scrolls
    // internally on desktop so its sidebar + detail pane stay put). Attach only
    // where the element is genuinely an overflow:auto scroller — on mobile the grid
    // is overflow:visible (the body scrolls via the drill-in), so it's skipped.
    var targets = document.querySelectorAll("main .window .window__body, main .window .fav__grids");
    Array.prototype.forEach.call(targets, function (el) {
      if (getComputedStyle(el).overflowY !== "auto") return;
      // On desktop the favorites window delegates scrolling to its .fav__grids, so
      // skip its body (it won't overflow — avoids a redundant hidden bar). On mobile
      // .fav__grids is overflow:visible, so the body keeps its bar for the drill-in.
      if (el.classList.contains("window__body")) {
        var fg = el.querySelector(".fav__grids");
        if (fg && getComputedStyle(fg).overflowY === "auto") return;
      }
      build(el);
    });
  }

  // A viewport resize that doesn't change a fixed-size window still shifts it;
  // re-place everything (RO on .window covers the responsive cases).
  window.addEventListener("resize", function () {
    instances.forEach(function (s) { s.place(); });
  });

  document.addEventListener("astro:page-load", init);
})();

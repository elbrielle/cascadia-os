/* ============================================================================
   systray.js  —  the desktop taskbar "Badges" flyout (Cascadia OS)
   ----------------------------------------------------------------------------
   On desktop the personal-flair badges (Progress Pride + UBC crest) sit bare in
   the taskbar tray; their only "life" was a native title tooltip. On mobile the
   same badges relocate into the Start menu as a *labeled* strip, so the phone
   reads richer than the desktop. This restores parity in a desktop-native way:

     • hover a badge   → a Win95 cream info-tip names it (pure CSS, see desktop.css)
     • click the tray  → a small flyout opens above it (the Win95 tray-popover
                         idiom, like clicking the clock for a calendar) holding
                         the same labels as the mobile strip + the UBC link.

   The tray cluster + flyout live in the `transition:persist` taskbar, so this
   binds ONCE (guarded by data-systray-bound) and rides across view-transition
   navigations. Standard popup a11y: aria-expanded on the toggle, Esc closes and
   returns focus, click-outside closes, Up/Down opens and dives into the flyout.
   The Visitors/Clock LCDs the mobile strip carries are omitted here — on desktop
   they're already visible in the taskbar, so duplicating them would be noise.
   ========================================================================== */

(function () {
  function init() {
    var toggle = document.querySelector("[data-systray-toggle]");
    var flyout = document.querySelector("[data-systray-flyout]");
    if (!toggle || !flyout) return;
    if (toggle.dataset.systrayBound === "1") return; // persisted — bind once
    toggle.dataset.systrayBound = "1";

    function isOpen() {
      return toggle.getAttribute("aria-expanded") === "true";
    }
    function open() {
      toggle.setAttribute("aria-expanded", "true");
      flyout.hidden = false;
    }
    function close(returnFocus) {
      toggle.setAttribute("aria-expanded", "false");
      flyout.hidden = true;
      if (returnFocus) toggle.focus();
    }

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      isOpen() ? close(false) : open();
    });

    // Up/Down opens the flyout and moves focus to its first link (keyboard
    // users can't read the hover tooltips, so the flyout is their path in).
    toggle.addEventListener("keydown", function (e) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        if (!isOpen()) open();
        var link = flyout.querySelector("a, button");
        if (link) link.focus();
      }
    });

    // Click anywhere outside the toggle/flyout closes it (clicking the Start
    // button counts as outside, so the two popups never co-exist).
    document.addEventListener("click", function (e) {
      if (!isOpen()) return;
      if (flyout.contains(e.target) || toggle.contains(e.target)) return;
      close(false);
    });

    // Esc closes and returns focus to the toggle.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) close(true);
    });

    // Following the UBC link (opens a new tab) should leave the flyout closed.
    flyout.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) close(false);
    });
  }

  document.addEventListener("astro:page-load", init);
})();

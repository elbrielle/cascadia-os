/* ============================================================================
   boot.js  —  once-per-session boot splash dismissal (feature #8)
   ----------------------------------------------------------------------------
   The splash (`[data-boot]`, in Layout.astro) is visible by default and a
   pure-CSS `boot-out` animation already fades it out — so this script is
   pure enhancement; with JS off the splash still dismisses itself.

   This IIFE runs once at load (it is NOT re-run on view-transition swaps —
   the splash is `transition:persist`, so the listeners we attach ride along
   with the node). On a same-session hard reload the script re-runs against a
   fresh document; the sessionStorage gate skips the splash instantly then.

   `data-skip` (see boot.css) hard-locks the splash hidden so a persisted node
   never replays the animation as you navigate between pages.
   ========================================================================== */

(function () {
  var splash = document.querySelector("[data-boot]");
  if (!splash) return;

  var KEY = "cascadia-booted";
  var booted = false;
  try { booted = !!sessionStorage.getItem(KEY); } catch (_) {}

  // While the splash covers the screen the shell underneath must not be
  // tabbable (WCAG 2.4.3 — focus would land on controls hidden behind an
  // opaque overlay). `inert` is JS-set/JS-cleared only, so the no-JS path
  // (CSS dismisses the splash on its own) never locks anything. The
  // persisted nodes (.desktop-icons, .taskbar) rely on dismiss() running on
  // every exit path — including the 4s net, which survives a mid-boot swap —
  // so a stale inert can't outlive the splash; <main> is additionally safe
  // because each view transition swaps in a fresh, non-inert node.
  var shell = Array.prototype.filter.call(
    [document.querySelector("main"),
     document.querySelector(".desktop-icons"),
     document.querySelector(".taskbar")],
    Boolean
  );
  function setShellInert(on) {
    shell.forEach(function (el) { el.inert = on; });
  }

  function dismiss() {
    splash.setAttribute("data-skip", "");
    setShellInert(false);
    shell = []; // the persisted splash keeps its listeners forever — don't pin the first page's <main>
  }

  // Already booted this session (e.g. a hard reload) — skip instantly.
  if (booted) { dismiss(); return; }

  try { sessionStorage.setItem(KEY, "1"); } catch (_) {}

  // Lock hidden once the CSS boot-out animation completes.
  splash.addEventListener("animationend", function (e) {
    if (e.animationName === "boot-out") dismiss();
  });

  // Skippable: the first key or pointer press fast-forwards to the desktop.
  window.addEventListener("keydown", dismiss, { once: true });
  splash.addEventListener("pointerdown", dismiss, { once: true });

  // Safety net: force-hide even if animationend never fires. Armed before
  // the inert lock goes on so no throw can strand the shell inert.
  setTimeout(dismiss, 4000);

  setShellInert(true);
})();

/* ============================================================================
   system.js  —  little ambient widgets: taskbar clock + LCD hit counter
   ----------------------------------------------------------------------------
   Hit counter: starts at a "you arrived at #N" number persisted in
   localStorage, then increments randomly on a slow interval so the LCD
   keeps a little life. Pure decoration; resets are harmless.
   ========================================================================== */

// Bind via astro:page-load (the lifecycle every other shell script uses) rather
// than DOMContentLoaded, with a run-once guard so a view-transition swap can't
// stack a second clock interval / ambient ticker. The clock + LCD live in the
// persisted taskbar, so binding ONCE (not per swap) is correct.
document.addEventListener("astro:page-load", () => {
  if (window.__cascadiaSystemBound) return;
  window.__cascadiaSystemBound = true;

  /* ------- CLOCK(S) ------------------------------------------------------- */
  // One in the taskbar (desktop) + one in the Start-menu tray (mobile); keep
  // every copy in sync off the same tick.
  const clocks = document.querySelectorAll("[data-clock]");
  if (clocks.length) {
    const tickClock = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const text = `${hh}:${mm}`;
      clocks.forEach((c) => { c.textContent = text; });
    };
    tickClock();
    // Align the first refresh to the next minute boundary, then tick once a
    // minute. The old flat 30s interval started at page load, so the displayed
    // minute could lag wall-clock by up to ~30s before the next tick corrected
    // it; aligning flips the digit exactly on the rollover (and halves wakeups).
    // Minute rollovers are global (epoch ms % 60000 === 0), so this aligns to
    // the local getMinutes() change regardless of timezone.
    const msToNextMinute = 60000 - (Date.now() % 60000);
    setTimeout(() => {
      tickClock();
      setInterval(tickClock, 60000);
    }, msToNextMinute);
  }

  /* ------- HIT COUNTER ---------------------------------------------------- */
  // Live visit count from Cloudflare KV (GET /api/hits — same-origin, so no
  // CSP change). Falls back to a cosmetic localStorage ticker when the endpoint
  // is unavailable (KV not bound yet, or local `npm run dev` which has no
  // Functions runtime) so the LCD always feels alive.
  const hitsEls = document.querySelectorAll("[data-hits]");
  if (hitsEls.length) {
    const STORAGE = "cascadia-os-hits";

    // Same live count rendered into every [data-hits] copy (the taskbar LCD +
    // the mobile Start-menu tray) so they never disagree.
    function render(value, rolling = false) {
      const text = Number(value).toLocaleString("en-US");
      hitsEls.forEach((el) => {
        el.textContent = text;
        el.classList.toggle("is-rolling", rolling);
      });
    }

    // Seed instantly from cache so the LCD is never blank. Defaults to the
    // 242 baseline so there's no number flash before the live count resolves.
    let n = parseInt(localStorage.getItem(STORAGE) || "0", 10);
    if (!n || isNaN(n)) n = 242;
    render(n);

    // Live count takes over if the Function answers with a real number.
    let live = false;
    fetch("/api/hits", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.count === "number") {
          live = true;
          n = data.count;
          localStorage.setItem(STORAGE, String(n));
          render(n, true);
          setTimeout(() => render(n, false), 350);
        }
      })
      .catch(() => {});

    // Cosmetic fallback ticker — only runs while NOT live.
    function ambientTick() {
      if (live) return;
      n += 1;
      localStorage.setItem(STORAGE, String(n));
      render(n, true);
      setTimeout(() => { if (!live) render(n, false); }, 350);
      setTimeout(ambientTick, 30000 + Math.random() * 60000);
    }
    setTimeout(ambientTick, 12000);
  }
});

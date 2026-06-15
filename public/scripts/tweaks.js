/* ============================================================================
   tweaks.js  —  the Settings controls (Theme + Font rendering)
   ----------------------------------------------------------------------------
   Two controls only:
     • Theme    : system / light / dark
     • Rendering: pixel (sharp, no smoothing) / smooth (anti-aliased fallback)

   The controls are static markup living in the Start menu's "Settings"
   cascading submenu (Layout.astro). startmenu.js owns the flyout open/close
   behavior; this script owns *state* only — it reads/writes localStorage,
   applies it via data-attributes on <html> (tokens.css does the recolor +
   font-smoothing swap), and reflects the active value on the segmented buttons.

   View-transition aware:
     • Astro's <ClientRouter /> re-syncs <html> attributes from each new
       server-rendered document, which would strip our client-set data-theme.
       We hook `astro:before-swap` and apply state to event.newDocument's
       <html> BEFORE it's swapped in — no flash of wrong theme.
     • The controls live in the `transition:persist` taskbar, so they survive
       navigations; we bind a delegated click handler on the Start menu ONCE.
   ========================================================================== */

(function () {
  const STORE = "cascadia-os-tweaks";

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || "{}"); }
    catch (_) { return {}; }
  }
  function save(state) {
    localStorage.setItem(STORE, JSON.stringify(state));
  }

  // applyTo() takes any document root so we can write attributes to either
  // the live <html> (initial bootstrap, control toggles) OR the incoming
  // document supplied by `astro:before-swap` (pre-navigation, no flash).
  function applyTo(rootDoc, s) {
    const el = rootDoc.documentElement;
    if (s.theme && s.theme !== "system") el.setAttribute("data-theme", s.theme);
    else el.removeAttribute("data-theme");
    if (s.smoothing) el.setAttribute("data-smoothing", s.smoothing);
    else el.removeAttribute("data-smoothing");
  }
  function apply(s) { applyTo(document, s); }

  // Module-level state. Re-applied on every nav so it survives ClientRouter
  // sync'ing <html> attributes back to the new document's bare HTML.
  let state = Object.assign({ theme: "system", smoothing: "pixel" }, load());
  apply(state);

  function setKey(key, value) {
    state[key] = value;
    save(state);
    apply(state);
    render();
  }

  // Reflect the active value on the segmented controls in the Settings submenu.
  function render() {
    document.querySelectorAll("[data-tweak-group]").forEach((g) => {
      const key = g.dataset.tweakGroup;
      g.querySelectorAll("[data-tweak-value]").forEach((b) => {
        const on = b.dataset.tweakValue === state[key];
        b.classList.toggle("is-active", on);
        // Expose the selected value to assistive tech, not just visually (the
        // .is-active bevel). Mirrors the Favorites switcher (favorites-explorer.js).
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    });
  }

  // The controls live in the persisted taskbar Start menu, so bind once: a
  // delegated click on #start-menu catches the segmented buttons. A data flag
  // guards against stacking listeners across page-loads.
  function bindControls() {
    const menu = document.getElementById("start-menu");
    if (menu && menu.dataset.tweaksBound !== "1") {
      menu.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tweak-value]");
        if (!btn) return;
        const group = btn.parentElement.dataset.tweakGroup;
        if (group) setKey(group, btn.dataset.tweakValue);
      });
      menu.dataset.tweaksBound = "1";
    }
    render();
  }

  /* ------- LIFECYCLE ----------------------------------------------------- */
  // Theme persistence across view-transition navigations:
  // `astro:before-swap` fires while we still hold a reference to BOTH the
  // current document and the incoming one (event.newDocument). Stamp our
  // saved theme onto the incoming <html> before it's swapped into view —
  // tokens.css picks it up the moment ClientRouter performs the swap, so
  // there's no flash of system theme between pages.
  document.addEventListener("astro:before-swap", (event) => {
    if (event && event.newDocument) applyTo(event.newDocument, state);
  });

  // Re-apply to the live document after each swap (safety net) and re-sync the
  // control highlights.
  document.addEventListener("astro:after-swap", () => { apply(state); render(); });

  // Initial bootstrap + every page-load.
  document.addEventListener("astro:page-load", bindControls);

  // Console helper to clear the saved preference.
  window.CascadiaTweaks = {
    reset() {
      localStorage.removeItem(STORE);
      state = { theme: "system", smoothing: "pixel" };
      apply(state);
      render();
    },
    get state() { return Object.assign({}, state); },
  };
})();

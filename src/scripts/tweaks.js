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
    // Resolve "system" to a CONCRETE light/dark attribute instead of leaving the
    // attribute off. The Aero skin's dark theme is ~156 rules keyed on
    // [data-theme="dark"] (CSS can't mirror them all under @media prefers-dark), so a
    // bare "system" rendered a broken half-dark amalgamation — the tokens flipped dark
    // (text went light) while the skin's surfaces stayed light = light-on-light,
    // unreadable. Resolving here keys BOTH the base tokens and the skin's dark-siblings
    // off one explicit attribute, and the value still tracks the OS. Base is unaffected
    // (its [data-theme="dark"] mirrors its @media block; "light" falls to :root).
    let theme = s.theme;
    if (!theme || theme === "system") {
      theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    el.setAttribute("data-theme", theme);
    if (s.smoothing) el.setAttribute("data-smoothing", s.smoothing);
    else el.removeAttribute("data-smoothing");

    // Interface skin. "aero" sets the data-skin hook that activates the Frutiger
    // Aero override stylesheet (public/aero/frutiger-aero.css); "95" removes it
    // for the base Win95 look. Default "aero" on this branch — matches the SSR
    // <html data-skin="aero"> so the common case has no flash. Applied here (incl.
    // on event.newDocument in before-swap) so client navigations keep the chosen
    // skin with no FOUC. The SWITCH itself is not live — see requestSkin(): it
    // reboots so a 95<->Aero change reads as a real OS restart.
    if ((s.skin || "aero") === "95") el.removeAttribute("data-skin");
    else el.setAttribute("data-skin", "aero");
  }
  function apply(s) { applyTo(document, s); }

  // Module-level state. Re-applied on every nav so it survives ClientRouter
  // sync'ing <html> attributes back to the new document's bare HTML.
  // Defaults: dark Aero is the shipped first-run look (Elisha's call) — a brand-new
  // visitor opens in dark Frutiger Aero. "system" / "light" / "95" stay one click
  // away in Settings and override this once chosen (load() wins over the defaults).
  let state = Object.assign({ theme: "dark", smoothing: "pixel", skin: "aero" }, load());
  apply(state);

  function setKey(key, value) {
    state[key] = value;
    save(state);
    apply(state);
    render();
  }

  // Skin changes do NOT apply live — they reboot (Elisha's call). The CRT
  // power-off + boot splash make a 95<->Aero switch read as a deliberate OS
  // restart AND hide the repaint behind the full-screen splash (so even a
  // future tier-3 metaphor swap — different markup per skin — has nowhere to
  // flash). No-op if you pick the skin you are already in. Persist first so the
  // reloaded page resolves the new skin; the start-menu module owns the CRT
  // ceremony (reboot()), with a plain reload as a graceful fallback.
  function requestSkin(value) {
    if (value !== "aero" && value !== "95") return;
    if (value === (state.skin || "aero")) return;
    state.skin = value;
    save(state);
    render(); // light up the chosen pill before the screen folds away
    const os = window.CascadiaStartMenu;
    if (os && typeof os.reboot === "function") {
      os.reboot();
    } else {
      try { sessionStorage.removeItem("cascadia-booted"); } catch (_) {}
      location.href = location.pathname + location.search;
    }
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
        if (!group) return;
        if (group === "skin") requestSkin(btn.dataset.tweakValue);
        else setKey(group, btn.dataset.tweakValue);
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

  // While in "system" mode, follow live OS light/dark changes (re-resolve + re-apply,
  // no reload needed). Only acts when the user hasn't pinned an explicit theme.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!state.theme || state.theme === "system") apply(state);
  });

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

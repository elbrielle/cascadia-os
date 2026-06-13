/* ============================================================================
   context-menu.js  —  the Cascadia OS right-click desktop menu (audit #16)
   ----------------------------------------------------------------------------
   Right-click is the most reflexive Win9x gesture, and it's the last core OS
   interaction the desktop metaphor was missing. This binds `contextmenu` ONLY
   on the bare desktop background (the .wallpaper / <main> backdrop), shows a
   small Win95-style popup there, and lets the NATIVE right-click survive
   everywhere it matters — links, buttons, inputs, textareas, the windows, and
   any selectable text — so copy / inspect / open-in-new-tab still work.

   Menu items (see the ITEMS array for the live set):
     • Refresh       — location.reload()
     • Properties    — the SAME System Properties dialog the Start menu opens,
                       via window.CascadiaStartMenu.openAbout (lifted out of
                       startmenu.js's init closure so the markup isn't duplicated).
   "View source → the GitHub repo" is omitted while the repo is private (it would
   404 for visitors); re-add it once the repo is public (see the ITEMS comment).

   It reuses the Start menu's chrome — the .start-menu / .start-menu__list /
   .start-menu__item classes and the `start-menu-in` keyframe — so it inherits
   the bevel, the open animation, and the reduced-motion handling for free.

   a11y + dismissal parity with startmenu.js: role=menu / menuitem, ArrowDown/
   Up/Home/End to move between items, Escape to close (restores prior focus),
   and dismissal on outside-pointerdown, on scroll, and on resize. The document
   listeners are added (capture) on open and removed on close so nothing
   dangles — the same teardown pattern startmenu.js uses. Only one menu exists
   at a time. No touch long-press handler: right-click has no touch equivalent,
   and the Start menu already exposes these same actions.

   Self-registers on `astro:page-load` (so it runs on initial load AND after
   every view-transition swap) and is guarded by a dataset.*Bound flag on a
   persisted shell element so it doesn't stack across swaps — mirroring
   startmenu.js's `data-start-bound` pattern. External file loaded via
   `<script is:inline src>` in Layout.astro, so the CSP two-hash gate is
   untouched.
   ========================================================================== */

(function () {
  // The menu items, in order. `run` fires on activation; the menu is always
  // closed first so focus is restored before the action runs.
  //
  // "View source" is intentionally OMITTED while the GitHub repo is private — a
  // link there 404s for every visitor. Re-add this entry once the repo is public:
  //   { label: "View source", run: function () {
  //       window.open("https://github.com/elbrielle/Portfolio-Site", "_blank", "noopener");
  //   } },
  var ITEMS = [
    { label: "Refresh", run: function () { location.reload(); } },
    { label: "Properties", run: function () {
        if (window.CascadiaStartMenu && window.CascadiaStartMenu.openAbout) {
          window.CascadiaStartMenu.openAbout();
        }
    } },
  ];

  function init() {
    // Bind ONCE on document — document persists across ClientRouter view
    // transitions, whereas <main> is swapped on every navigation (so a listener
    // bound to <main> would orphan after the first nav and a captured reference
    // would go stale; isBareBackground() re-queries <main> per event instead).
    // The run-once guard must live on a `transition:persist` node: <html>'s
    // runtime data-* attributes are reset to the incoming page's on each swap
    // (which would wipe the flag and stack a second listener every navigation),
    // but the .wallpaper layer persists as the SAME node and keeps the flag —
    // the same idea as startmenu.js's data-start-bound on the persisted Start
    // button.
    var guard = document.querySelector(".wallpaper") || document.body;
    if (!guard || guard.dataset.ctxBound === "1") return;
    guard.dataset.ctxBound = "1";

    var menu = null;          // the live menu element, or null when closed
    var prevFocus = null;     // element focused before the menu opened

    // --- "Is this the bare desktop background?" --------------------------
    // We want the custom menu ONLY on the empty backdrop, never on something
    // the browser's own context menu serves better. Two gates:
    //   1. The right-click must originate inside the desktop layer — either on
    //      the wallpaper div itself or within <main>. (Clicks on the taskbar,
    //      desktop icons, the page title, etc. fall through to native.)
    //   2. Within <main>, the target must not be (or sit inside) an
    //      interactive / text-bearing element: links, buttons, inputs,
    //      textareas, selects, the draggable windows (.window / .panel), or
    //      anything explicitly editable. That keeps native right-click for
    //      copy / inspect / open-in-new-tab on everything that matters.
    var INTERACTIVE = [
      "a", "button", "input", "textarea", "select", "label",
      "[contenteditable]", "[role='button']", "[role='menuitem']",
      ".window", ".panel", ".desktop-icon",
    ].join(",");

    function isBareBackground(target) {
      if (!(target instanceof Element)) return false;
      // The right-click must land inside the desktop <main> — queried FRESH
      // each time, since <main> is swapped on every view transition (a captured
      // reference would point at the previous page's detached node). The
      // .wallpaper layers sit behind <main> with pointer-events:none, so they
      // are never the event target — a bare-desktop right-click resolves to
      // <main> itself, which is what this checks.
      var main = document.querySelector("main");
      if (!main || !main.contains(target)) return false;
      // … and not on/inside any interactive or text-bearing element.
      if (target.closest(INTERACTIVE)) return false;
      // Guard against a right-click on an active text selection inside <main>
      // (e.g. a paragraph): let the native menu offer Copy.
      var sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        if (target.closest("p, li, h1, h2, h3, h4, h5, h6, dd, dt, blockquote, code, pre, td, th, time, span")) {
          return false;
        }
      }
      return true;
    }

    // --- Menu lifecycle --------------------------------------------------
    function menuItems() {
      return menu
        ? Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'))
        : [];
    }

    function closeMenu(restoreFocus) {
      if (!menu) return;
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss, true);
      menu.remove();
      menu = null;
      // Restore focus to wherever it was before we opened (Start-menu parity),
      // but only if that element is still in the document.
      if (restoreFocus && prevFocus && document.contains(prevFocus)) {
        prevFocus.focus();
      }
      prevFocus = null;
    }

    function openMenu(x, y) {
      closeMenu(false);                 // only one menu instance at a time
      prevFocus = document.activeElement;

      menu = document.createElement("div");
      menu.className = "start-menu context-menu";
      menu.setAttribute("role", "menu");
      menu.setAttribute("aria-label", "Desktop");

      var list = document.createElement("ul");
      list.className = "start-menu__list";

      ITEMS.forEach(function (def) {
        var li = document.createElement("li");
        li.setAttribute("role", "none");
        var btn = document.createElement("button");
        btn.className = "start-menu__item";
        btn.type = "button";
        btn.setAttribute("role", "menuitem");
        btn.textContent = def.label;
        btn.addEventListener("click", function () {
          closeMenu(false);             // close (focus not restored — action follows)
          def.run();
        });
        li.appendChild(btn);
        list.appendChild(li);
      });

      menu.appendChild(list);
      document.body.appendChild(menu);

      // Position at the click point, clamped to the viewport so the menu never
      // overflows a screen edge. Measured after insertion so we know its size;
      // `position: fixed` + left/top override the stylesheet's bottom-left
      // anchor (see context-menu.css).
      var rect = menu.getBoundingClientRect();
      var pad = 4;
      var maxX = window.innerWidth - rect.width - pad;
      var maxY = window.innerHeight - rect.height - pad;
      var left = Math.max(pad, Math.min(x, maxX));
      var top = Math.max(pad, Math.min(y, maxY));
      menu.style.left = left + "px";
      menu.style.top = top + "px";

      var first = menuItems()[0];
      if (first) first.focus();

      // Dismissal + key handling, added on open / removed on close (capture),
      // mirroring startmenu.js so nothing dangles.
      document.addEventListener("pointerdown", onOutside, true);
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("scroll", onDismiss, true);
      window.addEventListener("resize", onDismiss, true);
    }

    function onOutside(e) {
      if (menu && !menu.contains(e.target)) closeMenu(false);
    }
    function onDismiss() { closeMenu(false); }

    function onKey(e) {
      if (!menu) return;
      var list = menuItems();
      var idx = list.indexOf(document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu(true);                // restore focus to the prior element
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        (list[idx + 1] || list[0]).focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        (list[idx - 1] || list[list.length - 1]).focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        list[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        list[list.length - 1].focus();
      } else if (e.key === "Tab") {
        closeMenu(false);               // let Tab move focus on naturally
      }
    }

    // --- The one binding -------------------------------------------------
    // A single delegated listener on document (persists across navigations).
    // It sees every right-click; isBareBackground() decides whether to take
    // over (bare desktop / wallpaper backdrop) or let the native menu through
    // (links, text, form fields, windows). This covers both the <main> grid
    // and the .wallpaper layer behind it without per-element bindings that a
    // view-transition swap would orphan.
    document.addEventListener("contextmenu", onContextMenu);

    function onContextMenu(e) {
      if (!isBareBackground(e.target)) return;   // let native menus survive
      e.preventDefault();
      openMenu(e.clientX, e.clientY);
    }
  }

  document.addEventListener("astro:page-load", init);
})();

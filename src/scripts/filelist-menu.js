/* ============================================================================
   filelist-menu.js  —  the Poetry window's Win95 dropdown menu bar
   ----------------------------------------------------------------------------
   Turns File / Edit / View / Sort into a REAL Win95 menu bar on the Poetry
   window (art.astro .filelist__menu):

     • OPEN/CLOSE — click a top item to toggle its dropdown (closing siblings);
       click-away / Escape / blur closes; Escape returns focus to the top button.
       Keyboard: ArrowDown enters the open pop, ArrowUp/Down move between items,
       Enter/Space activate, Escape closes. Disabled items are skipped in arrow
       nav. (Authentic Win95 menu behaviour.)
     • VIEW (shipped) — data-fl-view sets .filelist[data-view] = "icons" | "list"
       (the attr the icon-view CSS keys off) and updates the two View buttons'
       aria-pressed. Session-only; no persistence needed.
     • SORT (shipped) — data-fl-sort dispatches a synthetic .click() on the
       matching existing .filelist__head [data-sort] header button, REUSING
       notepad.js's comparator + asc/desc toggle + aria-sort (single source of
       truth — zero duplicate sort logic). Works in icon view too because the
       header button stays in the DOM (display:none) and .click() still fires.

   File / Edit ship inert this pass: each pop carries a single greyed
   (aria-disabled + disabled) placeholder so the bar reads complete without a
   fake affordance. The real File/Edit actions + gag copy await Elisha's
   sign-off, so nothing here wires them — DO NOT wire File/Edit until she picks
   the actions + copy (no em dashes per her house style).

   External; self-registers on DOMContentLoaded + astro:page-load; idempotent
   via data-flMenuReady on .filelist__menu. No-ops off the Art page (mirrors
   notepad.js). External is:inline src → ZERO inline blocks, so the CSP two-hash
   gate is untouched.
   ========================================================================== */
(function () {
  function init() {
    var bar = document.querySelector("[data-fl-menu]");
    if (!bar || bar.dataset.flMenuReady) return;
    bar.dataset.flMenuReady = "1";

    var filelist = document.querySelector(".filelist");
    var groups = Array.prototype.slice.call(bar.querySelectorAll(".fl-menu"));

    // --- open/close -------------------------------------------------------
    function closeAll(except) {
      groups.forEach(function (g) {
        if (g === except) return;
        var top = g.querySelector(".filelist__menu-item");
        var pop = g.querySelector(".fl-menu__pop");
        if (top) top.setAttribute("aria-expanded", "false");
        if (pop) pop.hidden = true;
      });
    }
    function isOpen(group) {
      var top = group.querySelector(".filelist__menu-item");
      return top && top.getAttribute("aria-expanded") === "true";
    }
    function openGroup(group, focusFirst) {
      closeAll(group);
      var top = group.querySelector(".filelist__menu-item");
      var pop = group.querySelector(".fl-menu__pop");
      if (top) top.setAttribute("aria-expanded", "true");
      if (pop) pop.hidden = false;
      if (focusFirst) {
        var item = firstEnabled(group);
        if (item) item.focus();
      }
    }
    function closeGroup(group, refocusTop) {
      var top = group.querySelector(".filelist__menu-item");
      var pop = group.querySelector(".fl-menu__pop");
      if (top) top.setAttribute("aria-expanded", "false");
      if (pop) pop.hidden = true;
      if (refocusTop && top) top.focus();
    }

    // enabled (non aria-disabled, non disabled) menu items inside a group's pop
    function items(group) {
      return Array.prototype.slice.call(group.querySelectorAll(".fl-menu__pop button"));
    }
    function enabledItems(group) {
      return items(group).filter(function (b) {
        return !b.disabled && b.getAttribute("aria-disabled") !== "true";
      });
    }
    function firstEnabled(group) {
      var e = enabledItems(group);
      return e.length ? e[0] : null;
    }

    // --- top-item interactions -------------------------------------------
    groups.forEach(function (group) {
      var top = group.querySelector(".filelist__menu-item");
      if (!top) return;

      top.addEventListener("click", function (e) {
        e.stopPropagation();
        if (isOpen(group)) closeGroup(group, false);
        else openGroup(group, false);
      });

      top.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          openGroup(group, true);
        } else if (e.key === "Escape") {
          if (isOpen(group)) { e.preventDefault(); closeGroup(group, true); }
        }
      });

      // Keyboard nav WITHIN this group's pop.
      var pop = group.querySelector(".fl-menu__pop");
      if (pop) {
        pop.addEventListener("keydown", function (e) {
          var enabled = enabledItems(group);
          var idx = enabled.indexOf(document.activeElement);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (enabled.length) enabled[(idx + 1 + enabled.length) % enabled.length].focus();
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (enabled.length) enabled[(idx - 1 + enabled.length) % enabled.length].focus();
          } else if (e.key === "Escape") {
            e.preventDefault();
            closeGroup(group, true);
          }
          // Enter / Space activate natively (these are <button>s).
        });
      }
    });

    // --- VIEW (shipped) ---------------------------------------------------
    bar.querySelectorAll("[data-fl-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-fl-view");   // "icons" | "list"
        if (filelist) filelist.dataset.view = mode;
        bar.querySelectorAll("[data-fl-view]").forEach(function (r) {
          r.setAttribute("aria-pressed", r === btn ? "true" : "false");
        });
        // Return focus to the owning top button (authentic Win95: the menu bar
        // keeps focus after a command runs) instead of dropping it to <body>.
        var group = btn.closest(".fl-menu");
        if (group) closeGroup(group, true); else closeAll(null);
      });
    });

    // --- SORT (shipped) — reuse notepad.js's header sort ------------------
    bar.querySelectorAll("[data-fl-sort]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-fl-sort");
        var h = document.querySelector('.filelist__head [data-sort="' + key + '"]');
        if (h) h.click();   // single source of truth: notepad.js's comparator + aria-sort
        var group = btn.closest(".fl-menu");
        if (group) closeGroup(group, true); else closeAll(null);
      });
    });

    // File / Edit: NO wiring this pass — the single placeholder in each pop is
    // aria-disabled + disabled. Real actions + gag copy await Elisha's sign-off.

    // --- click-away / Escape (global) ------------------------------------
    function onDocClick(e) {
      if (!bar.contains(e.target)) closeAll(null);
    }
    function onDocKey(e) {
      if (e.key === "Escape") closeAll(null);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onDocKey);

    // Close on blur out of the whole bar (focus moved elsewhere via Tab).
    bar.addEventListener("focusout", function (e) {
      if (!bar.contains(e.relatedTarget)) closeAll(null);
    });
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();

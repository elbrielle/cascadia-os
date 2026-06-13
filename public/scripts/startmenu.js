/* ============================================================================
   startmenu.js  —  the Cascadia OS Start menu (feature #2)
   ----------------------------------------------------------------------------
   Wires the taskbar Start button to a Win95-style popup menu with three items:

     • Settings          — a cascading submenu (Win95-style flyout) holding the
                            Theme + Font-rendering controls. This script owns
                            the open/close behavior (hover, click, arrow keys);
                            tweaks.js binds the segmented controls inside it.
     • About Cascadia OS  — a fake "System Properties" modal (shared .os-dialog
                            chrome from dialog.css).
     • Shut Down…         — a CRT power-off animation → the black "It's now safe
                            to turn off your computer" screen → a Restart link
                            that clears the boot gate and reloads Home (so the
                            boot splash plays again — a full reboot).

   The Start button + menu live in the `transition:persist` taskbar, so this
   binds ONCE (guarded by data-start-bound) and the handlers ride across
   view-transition navigations. Standard menu a11y: aria-expanded, role=menu /
   menuitem, Esc to close (returns focus to the button), click-outside to
   close, Up/Down/Home/End arrow navigation.
   ========================================================================== */

(function () {
  function init() {
    var btn = document.getElementById("start-button");
    var menu = document.getElementById("start-menu");
    if (!btn || !menu) return;
    if (btn.dataset.startBound === "1") return; // persisted — bind once
    btn.dataset.startBound = "1";

    function items() {
      return Array.prototype.slice.call(
        menu.querySelectorAll('[role="menuitem"]')
      );
    }
    function isOpen() { return btn.getAttribute("aria-expanded") === "true"; }

    // While a modal dialog (About / System Properties) is open, the desktop
    // behind it must not be tabbable — focus would otherwise walk out of the
    // dialog onto controls hidden behind the backdrop (WCAG 2.4.3, and the
    // aria-modal="true" we already assert). Mirrors boot.js's splash treatment.
    // Recomputed each call so a view-transition-swapped <main> is covered;
    // cleared on close BEFORE focus returns to the trigger (you can't focus an
    // inert element). Reused by any future desktop dialog opened via openAbout
    // (e.g. the right-click context menu's Properties item).
    function setShellInert(on) {
      [document.querySelector("main"),
       document.querySelector(".desktop-icons"),
       document.querySelector(".taskbar")].forEach(function (el) {
        if (el) el.inert = on;
      });
    }

    // --- Settings cascading submenu --------------------------------------
    var settingsItem = menu.querySelector("#start-settings");
    var submenu = menu.querySelector("#settings-submenu");
    var subParent = settingsItem ? settingsItem.closest(".start-menu__sub") : null;
    function subOpen() {
      return !!settingsItem && settingsItem.getAttribute("aria-expanded") === "true";
    }
    function openSub() {
      if (!settingsItem || !submenu) return;
      submenu.hidden = false;
      settingsItem.setAttribute("aria-expanded", "true");
    }
    function closeSub() {
      if (!settingsItem || !submenu) return;
      submenu.hidden = true;
      settingsItem.setAttribute("aria-expanded", "false");
    }
    function toggleSub() { subOpen() ? closeSub() : openSub(); }

    function openMenu() {
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      var first = items()[0];
      if (first) first.focus();
      document.addEventListener("pointerdown", onOutside, true);
      document.addEventListener("keydown", onKey, true);
    }
    function closeMenu(focusBtn) {
      closeSub();
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
      if (focusBtn) btn.focus();
    }

    function onOutside(e) {
      if (!menu.contains(e.target) && !btn.contains(e.target)) closeMenu(false);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (subOpen()) { closeSub(); if (settingsItem) settingsItem.focus(); }
        else closeMenu(true);
        return;
      }
      // While focus is inside the open submenu, let its segmented buttons take
      // arrows/Tab natively; ArrowLeft backs out to the Settings parent.
      if (submenu && submenu.contains(document.activeElement)) {
        if (e.key === "ArrowLeft") {
          e.preventDefault(); closeSub(); if (settingsItem) settingsItem.focus();
        }
        return;
      }
      // ArrowRight on the Settings parent opens its submenu + focuses the first
      // control.
      if (e.key === "ArrowRight" && document.activeElement === settingsItem) {
        e.preventDefault(); openSub();
        var firstTweak = submenu && submenu.querySelector("[data-tweak-value]");
        if (firstTweak) firstTweak.focus();
        return;
      }
      var list = items();
      var idx = list.indexOf(document.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault(); (list[idx + 1] || list[0]).focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault(); (list[idx - 1] || list[list.length - 1]).focus();
      } else if (e.key === "Home") {
        e.preventDefault(); list[0].focus();
      } else if (e.key === "End") {
        e.preventDefault(); list[list.length - 1].focus();
      } else if (e.key === "Tab") {
        closeMenu(false); // let Tab move focus on naturally
      }
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (isOpen()) closeMenu(false); else openMenu();
    });

    // Hover opens the Settings submenu (Win95 cascading); hovering any other
    // row closes it. Moving onto the submenu (a descendant of .start-menu__sub)
    // keeps it open.
    if (subParent) subParent.addEventListener("mouseenter", openSub);
    var listEl = menu.querySelector(".start-menu__list");
    if (listEl) listEl.addEventListener("mouseover", function (e) {
      if (!e.target.closest(".start-menu__sub")) closeSub();
    });

    // Item activation. Settings toggles its cascading submenu; About / Shut
    // Down run and close the menu. Segmented tweak buttons are handled by
    // tweaks.js — we ignore them here so the menu stays open.
    menu.addEventListener("click", function (e) {
      if (e.target.closest("[data-tweak-value]")) return;
      if (settingsItem && e.target.closest("#start-settings")) {
        e.stopPropagation(); toggleSub(); return;
      }
      var item = e.target.closest('[role="menuitem"]');
      if (!item) return;
      if (item.hasAttribute("data-start-about")) openAbout();
      else if (item.hasAttribute("data-start-shutdown")) shutDown();
      closeMenu(false);
    });

    /* ----- About Cascadia OS (fake System Properties) -------------------- */
    function openAbout() {
      // Real build stamp — Layout.astro stamps the commit SHA + build date onto
      // <body data-build / data-build-date> at build time; read it here so the
      // "Build" row is genuine instead of a made-up spec. Falls back to "dev".
      var ds = document.body ? document.body.dataset : {};
      var buildSha = ds.build || "dev";
      var buildLine = ds.buildDate ? buildSha + " · " + ds.buildDate : buildSha;
      var modal = document.createElement("div");
      modal.className = "os-modal";
      modal.innerHTML =
        '<div class="os-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">' +
          '<header class="os-dialog__bar">' +
            '<span class="os-dialog__title" id="about-title">System Properties</span>' +
            '<button class="os-dialog__close" type="button" aria-label="Close">×</button>' +
          '</header>' +
          '<div class="os-dialog__body">' +
            '<div class="os-dialog__row">' +
              '<span class="os-dialog__icon" data-icon="info" aria-hidden="true"></span>' +
              '<div class="os-dialog__message">' +
                '<p><strong>Cascadia&nbsp;OS</strong><br>Version 95 · Ocean Breeze build</p>' +
                '<p class="os-dialog__code">Registered to: Elisha Lucero</p>' +
              '</div>' +
            '</div>' +
            '<dl class="sysprops">' +
              '<div><dt>Processor</dt><dd><a class="sysprops__link" href="https://cogsys.ubc.ca/" target="_blank" rel="noopener" title="UBC Cognitive Systems">Cognitive Systems, UBC</a></dd></div>' +
              '<div><dt>Memory</dt><dd>640K ought to be enough</dd></div>' +
              '<div><dt>Display</dt><dd>32-bit</dd></div>' +
              '<div><dt>Build</dt><dd>' + buildLine + '</dd></div>' +
              '<div><dt>System</dt><dd>Astro · Cloudflare</dd></div>' +
            '</dl>' +
            '<div class="os-dialog__actions">' +
              '<button class="btn btn--primary" type="button" data-about-ok>OK</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
      setShellInert(true);                                       // trap focus in the dialog
      if (window.CascadiaIcons) window.CascadiaIcons.mountAll(); // render the info icon

      function close() {
        document.removeEventListener("keydown", onEsc, true);
        setShellInert(false);                                    // clear BEFORE refocusing the trigger
        modal.remove();
        btn.focus();
      }
      function onEsc(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }

      modal.addEventListener("click", function (e) {
        if (e.target === modal) return close();             // backdrop
        if (e.target.closest(".os-dialog__close")) return close();
        if (e.target.closest("[data-about-ok]")) return close();
      });
      document.addEventListener("keydown", onEsc, true);
      var ok = modal.querySelector("[data-about-ok]");
      if (ok) ok.focus();
    }

    // Expose openAbout so the right-click context menu's Properties item can
    // open the SAME System Properties dialog without duplicating its markup.
    // Defined here inside init() so it keeps its closures over `btn` (focus
    // return) and `setShellInert` (focus trap). Mirrors the existing
    // window.CascadiaWindows / CascadiaIcons / CascadiaTweaks convention.
    window.CascadiaStartMenu = window.CascadiaStartMenu || {};
    window.CascadiaStartMenu.openAbout = openAbout;

    /* ----- Shut Down gag -------------------------------------------------- */
    function shutDown() {
      var ov = document.createElement("div");
      ov.className = "shutdown";
      ov.setAttribute("role", "alertdialog");
      ov.setAttribute("aria-label", "Shutting down");
      ov.innerHTML =
        '<div class="shutdown__crt" aria-hidden="true"></div>' +
        '<div class="shutdown__msg" hidden>' +
          '<p class="shutdown__safe">It’s now safe to turn off your computer.</p>' +
          '<a class="shutdown__restart" href="/" data-astro-reload>Restart</a>' +
        '</div>';
      document.body.appendChild(ov);

      var reduce = false;
      try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) {}
      setTimeout(function () {
        var msg = ov.querySelector(".shutdown__msg");
        if (msg) msg.hidden = false;
        var r = ov.querySelector(".shutdown__restart");
        if (r) r.focus();
      }, reduce ? 150 : 850);

      ov.querySelector(".shutdown__restart").addEventListener("click", function (e) {
        e.preventDefault();
        try { sessionStorage.removeItem("cascadia-booted"); } catch (_) {}
        window.location.href = "/"; // full reload → boot splash plays again
      });
    }
  }

  document.addEventListener("astro:page-load", init);
})();

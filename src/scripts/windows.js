/* ============================================================================
   windows.js  —  drag / min / max / focus + taskbar
   ----------------------------------------------------------------------------
   Layout strategy:
     • <main> is a CSS Grid with per-page named cells (see layout.css).
       Each .window sits inside its own .layout__cell, which holds the grid
       slot — so minimizing a window doesn't reflow its neighbors.
     • JS NEVER owns positioning. We only add a drag offset stored in two
       CSS custom properties (--drag-x, --drag-y) on the window itself.
       The .window rule applies them via transform: translate(...), so the
       offset is a delta on top of whatever the grid cell decided.
     • Resize never breaks anything — the cell's grid slot reflows; the
       drag offset (if any) stays. Double-click the title bar to reset.
     • Drag is disabled at ≤720px (the mobile.css layer) AND on any
       coarse-pointer (touch) device regardless of width — in the 721–991px
       band the per-page grid templates (layout.css, ≥62em) aren't active
       yet, so windows are stacked and a touch drag would just shove them
       off-axis with no reliable way to reset (dblclick is mouse-only).
       A mouse keeps drag at any width.

   States: .is-active  .is-minimized  .is-maximized  .is-dragging
           .is-closing .is-opening (transient animation classes)
   Drag-tracking: window has style --drag-x / --drag-y, and data-moved="1".
   ========================================================================== */

(function () {
  let windows = [];
  let taskbar = null;
  let topZ = 100;

  /* ----- init ------------------------------------------------------------ */
  function initWindows() {
    windows = Array.from(document.querySelectorAll(".window"));
    taskbar = document.querySelector("[data-taskbar-items]");
    if (windows.length === 0) {
      if (taskbar) taskbar.innerHTML = "";
      return;
    }
    topZ = 100;

    windows.forEach((win, i) => {
      const titlebar = win.querySelector(".window__titlebar");
      const controls = win.querySelectorAll(".window__btn");
      if (!win.dataset.window) win.dataset.window = "window-" + i;

      // Initial drag offset = 0,0. Setting these via setProperty (not the
      // style attribute) keeps the rendered HTML clean for view-source.
      win.style.setProperty("--drag-x", "0px");
      win.style.setProperty("--drag-y", "0px");

      // After the initial window-pop animation finishes, stamp data-mounted
      // so the matching CSS rule disables that animation. Otherwise it
      // would re-fire whenever the element's animation-name reverts (e.g.
      // when .is-opening is removed after restoring from the taskbar) —
      // visible as an opacity-0 blink right after the restore lands.
      const stampMounted = (e) => {
        if (e.animationName !== "window-pop" && e.animationName !== "aero-window-mount") return;
        win.dataset.mounted = "1";
        win.removeEventListener("animationend", stampMounted);
      };
      win.addEventListener("animationend", stampMounted);

      win.addEventListener("pointerdown", () => focusWindow(win));
      makeDraggable(win, titlebar);

      // Double-click the title bar to reset the window's drag offset and
      // return it to its responsive flow position.
      if (titlebar) {
        titlebar.addEventListener("dblclick", (e) => {
          if (e.target.closest(".window__btn")) return;
          resetDrag(win);
        });
      }

      controls.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          if (action === "minimize") minimize(win);
          if (action === "maximize") toggleMaximize(win, btn);
        });
      });
    });

    focusWindow(windows[0]);
    buildTaskbar();
    syncTaskbar();
  }

  function focusWindow(win) {
    windows.forEach((w) => w.classList.remove("is-active"));
    win.classList.add("is-active");
    topZ += 1;
    win.style.zIndex = topZ;
    syncTaskbar();
  }

  /* ----- dragging via CSS translate -------------------------------------- */
  function readPx(win, prop) {
    const v = win.style.getPropertyValue(prop) || "0px";
    return parseFloat(v) || 0;
  }

  function makeDraggable(win, handle) {
    if (!handle) return;
    let startX = 0, startY = 0, originX = 0, originY = 0, dragging = false;

    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".window__btn")) return;
      if (win.classList.contains("is-maximized")) return;
      // Drag intentionally disabled on narrow viewports AND on touch-primary
      // devices at any width (see the header note: stacked-layout band +
      // no touch-friendly reset). Mouse/trackpad users keep drag everywhere.
      if (window.matchMedia("(max-width: 720px), (pointer: coarse)").matches) return;
      dragging = true;
      win.classList.add("is-dragging");
      startX = e.clientX;
      startY = e.clientY;
      originX = readPx(win, "--drag-x");
      originY = readPx(win, "--drag-y");
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = originX + (e.clientX - startX);
      const dy = originY + (e.clientY - startY);
      win.style.setProperty("--drag-x", dx + "px");
      win.style.setProperty("--drag-y", dy + "px");
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      win.classList.remove("is-dragging");
      // Mark as user-placed only if the offset is actually non-zero.
      const dx = readPx(win, "--drag-x");
      const dy = readPx(win, "--drag-y");
      if (dx !== 0 || dy !== 0) win.dataset.moved = "1";
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }

  function resetDrag(win) {
    win.style.setProperty("--drag-x", "0px");
    win.style.setProperty("--drag-y", "0px");
    delete win.dataset.moved;
  }

  /* ----- minimize / restore state machine --------------------------------
     Each window has at most ONE pending end-of-animation handler. Both paths
     route through awaitAnimation(), which (a) guards on e.animationName so a
     stray child animation can't complete the transition early, (b) listens
     for animationcancel so an interrupted animation doesn't leak its handler,
     and (c) arms a setTimeout safety net (same idea as boot.js) so a window
     can never strand in .is-closing/.is-opening if animationend goes missing.
     restore() can interrupt a mid-flight minimize (and vice versa): the first
     thing each does is clearPending(), so the other's stale handler can never
     fire late and re-hide / re-show the window.                            */

  function clearPending(win) {
    if (win._pendingEnd) {
      win.removeEventListener("animationend", win._pendingEnd);
      win.removeEventListener("animationcancel", win._pendingEnd);
      win._pendingEnd = null;
    }
    if (win._pendingTimer) {
      clearTimeout(win._pendingTimer);
      win._pendingTimer = null;
    }
  }

  function awaitAnimation(win, name, done) {
    clearPending(win);
    const finish = () => {
      clearPending(win);
      done();
    };
    const handler = (e) => {
      // `name` may be a string OR an array of accepted animation names: the Aero
      // skin (public/aero/frutiger-aero.css) renames these keyframes
      // (aero-window-close / aero-window-restore), so resolve on EITHER the base or
      // the skin name. The setTimeout net below still covers any miss.
      if (Array.isArray(name) ? !name.includes(e.animationName) : e.animationName !== name) return;
      finish();
    };
    win._pendingEnd = handler;
    win.addEventListener("animationend", handler);
    win.addEventListener("animationcancel", handler);
    // Safety net: animation duration + slack. Under prefers-reduced-motion
    // --speed is 0.01ms, so this resolves almost immediately either way.
    const ms = parseFloat(getComputedStyle(win).animationDuration) * 1000 || 250;
    win._pendingTimer = setTimeout(finish, ms + 150);
  }

  function minimize(win) {
    // On mobile the Art page shows exactly ONE window at a time (art.css gates
    // each cell's visibility on a window being .is-active). Minimizing removes
    // is-active before the promote, which would blank the pane and then silently
    // switch the user to a different medium — so it's a no-op for Art windows on
    // mobile (the chip rail / taskbar switch instead). Desktop + every other
    // page keep normal minimize. Covers BOTH triggers: the titlebar "_" button
    // and the taskbar button's minimize-on-active branch.
    if (win.closest(".page-art") && window.matchMedia("(max-width: 61.99em)").matches) return;
    if (win.classList.contains("is-minimized") || win.classList.contains("is-closing")) return;
    clearPending(win);
    win.classList.remove("is-opening");
    win.classList.add("is-closing");
    win.classList.remove("is-active");
    // Keyboard flow: the window is about to display:none — if focus is inside
    // it (the usual path: its own "_" button), hand focus to the window's
    // taskbar button instead of letting it reset to <body>.
    if (win.contains(document.activeElement) && taskbar) {
      const item = taskbar.querySelector(`.taskbar__item[data-for="${win.dataset.window}"]`);
      if (item) item.focus();
    }
    awaitAnimation(win, ["window-close", "aero-window-close"], () => {
      // Idempotence: a restore() may have interrupted us (it strips
      // .is-closing); in that case the minimize never landed — do nothing.
      if (!win.classList.contains("is-closing")) return;
      win.classList.remove("is-closing");
      win.classList.add("is-minimized");
      syncTaskbar();
      // The window just vanished INTO the bar — let its button acknowledge
      // the landing (fires here, at animation end, so cause and effect line
      // up by construction). Minimize-only by design: restore's
      // acknowledgement is the window itself arriving on the desktop.
      thunkTaskbarItem(win);
      // Promote the top-most remaining visible window so the desktop isn't
      // left with every titlebar in its dimmed, non-active state. Done after
      // is-minimized is set so we never mark a sibling active mid-animation.
      const anyActive = windows.some(
        (w) => w.classList.contains("is-active") && !w.classList.contains("is-minimized")
      );
      if (!anyActive) {
        const next = windows
          .filter((w) => w !== win && !w.classList.contains("is-minimized") && !w.classList.contains("is-closing"))
          .sort((a, b) => (parseInt(b.style.zIndex, 10) || 0) - (parseInt(a.style.zIndex, 10) || 0))[0];
        if (next) focusWindow(next);
      }
    });
    syncTaskbar();
  }

  function restore(win) {
    // Cancel any in-flight minimize so its handler can't fire late and
    // re-hide the window we're bringing back.
    clearPending(win);
    if (win.classList.contains("is-closing")) {
      // Interrupted mid-minimize: reverse to the open animation. The window
      // was never display:none, so this is a clean class swap.
      win.classList.remove("is-closing");
      win.classList.add("is-opening");
    } else if (win.classList.contains("is-minimized")) {
      // Atomic class swap: classList.replace() in a single op so the browser
      // never sees a state where is-minimized has been removed but is-opening
      // hasn't been added yet — that intermediate state would let the base
      // .window rule's `animation: window-pop` kick in for one paint, snapping
      // the (just-undisplayed) window to its pop animation's 0% frame before
      // .is-opening took over. Replacing in one call keeps the transition
      // direct from display:none → display:block + window-open animation.
      win.classList.replace("is-minimized", "is-opening");
    } else {
      focusWindow(win);
      return;
    }
    awaitAnimation(win, ["window-open", "aero-window-restore"], () => {
      if (!win.classList.contains("is-opening")) return;
      win.classList.remove("is-opening");
      // Keyboard flow: land focus on the restored window's titlebar
      // (tabindex="-1" in Window.astro) so the user is where they left off —
      // but only if focus is still on the launcher (taskbar) or has fallen to
      // <body>. If the user already clicked into a field during the open
      // animation, yanking focus to the titlebar would interrupt their input.
      const idle =
        document.activeElement === document.body ||
        (taskbar && taskbar.contains(document.activeElement));
      const titlebar = win.querySelector(".window__titlebar");
      if (idle && titlebar) titlebar.focus({ preventScroll: true });
    });
    focusWindow(win);
  }

  // Reflect maximized state on the control: glyph + accessible name flip
  // together (the aria-label is the load-bearing half). Deliberately NO
  // aria-pressed: a label that changes with state plus a pressed state is the
  // APG name+state contradiction ("Restore, pressed" reads backwards) — when
  // the name flips, the name alone carries the state. The depressed LOOK is
  // pure CSS (window.css `.window.is-maximized .window__btn[...]`).
  function setMaxButton(win, btn, max) {
    const b = btn || win.querySelector('.window__btn[data-action="maximize"]');
    if (!b) return;
    b.setAttribute("aria-label", max ? "Restore" : "Maximize");
    b.textContent = max ? "❐" : "▢";
  }

  // FLIP a window between its two resting geometries so maximize/restore glides
  // instead of teleporting. The caller has ALREADY toggled .is-maximized and
  // passes `first` = the rect measured BEFORE that flip; we measure `last`
  // (the new resting rect) and play the inverted delta as a WAAPI tween.
  // Non-obvious constraints, preserved from the original:
  //   • Animate the INDIVIDUAL `translate`/`scale` properties, not `transform`
  //     — .is-maximized pins `transform: translate(0,0) !important`, and
  //     important author declarations beat animations, so a `transform` tween
  //     would be invisible on the maximize half. The individual props compose
  //     ON TOP of whatever `transform` resolves to — exactly the FLIP contract.
  //   • WAAPI escapes the tokens.css reduced-motion squash, so the gate is
  //     explicit (the caller passes tween=false under reduced motion).
  //   • Hold the base top/left/width/height transition (window.css) at `none`
  //     for the WHOLE tween and restore it only when the tween settles — else
  //     that CSS transition double-animates over the WAAPI tween (the old code
  //     restored it before the tween, which read as a janky/absent morph).
  // Deltas are center-based (default transform-origin 50% 50%). Interrupt-safe:
  // a re-entrant call cancels the in-flight tween and re-measures the live rect.
  function flipResize(win, first, tween) {
    if (!tween || !first || first.width <= 0 || first.height <= 0) return;
    win.style.transition = "none"; // suspend base geometry transition…
    const last = win.getBoundingClientRect();
    if (last.width <= 0 || last.height <= 0) {
      win.style.transition = "";
      return;
    }
    const dx = first.left + first.width / 2 - (last.left + last.width / 2);
    const dy = first.top + first.height / 2 - (last.top + last.height / 2);
    const root = getComputedStyle(document.documentElement);
    // --speed-window is the single window-motion duration shared by maximize,
    // minimize, and restore (with --ease-soft) — a touch slower than the generic
    // --speed so the big geometry change glides instead of snapping.
    const ms = parseFloat(root.getPropertyValue("--speed-window")) || 320;
    const ease = root.getPropertyValue("--ease-soft").trim() || "ease";
    if (win._maxTween) win._maxTween.cancel();
    // restore() runs when the tween settles (finished OR cancelled — .cancel()
    // rejects .finished, hence the .catch) so the base transition is NEVER left
    // stranded at "none" (which would freeze the next drag/restore animation).
    const restore = () => {
      win.style.transition = "";
    };
    // try/catch so the caller's focusWindow() still runs: an engine with
    // Element.animate but no individual translate/scale keyframe support
    // spec-filters the unknown props to a no-op; should one reject them, the
    // window just snaps to its already-applied resting geometry.
    try {
      win._maxTween = win.animate(
        [
          {
            translate: dx + "px " + dy + "px",
            scale: first.width / last.width + " " + first.height / last.height,
          },
          { translate: "0px 0px", scale: "1 1" },
        ],
        { duration: ms, easing: ease }
      );
      win._maxTween.finished.then(restore).catch(restore);
    } catch (_) {
      restore();
    }
  }

  // Restore a maximized sibling back to its grid slot (animated), resetting its
  // control. Used to enforce the single-maximized invariant in toggleMaximize.
  function demaximize(win, tween) {
    if (!win.classList.contains("is-maximized")) return;
    const first = tween ? win.getBoundingClientRect() : null;
    win.classList.remove("is-maximized");
    setMaxButton(win, null, false);
    flipResize(win, first, tween);
  }

  function toggleMaximize(win, btn) {
    const tween =
      typeof win.animate === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Single-maximized invariant: only one window may be maximized at a time,
    // the canonical Win95 behavior. Before maximizing THIS window, restore any
    // OTHER maximized window (animate it down + reset its control). This is the
    // whole "no maximized window in front of another maximized window" fix.
    // (Un-maximizing `win` itself takes the toggle path below — no demote.)
    if (!win.classList.contains("is-maximized")) {
      windows.forEach((w) => {
        if (w !== win) demaximize(w, tween);
      });
    }

    const first = tween ? win.getBoundingClientRect() : null;
    const max = win.classList.toggle("is-maximized");
    setMaxButton(win, btn, max);
    flipResize(win, first, tween);
    focusWindow(win);
  }

  /* ----- taskbar --------------------------------------------------------- */
  // The minimize "thunk" (#27): press the window's taskbar button in for one
  // --speed-fast beat as the window-close animation lands in it. The visual
  // lives in CSS (@keyframes taskbar-thunk, desktop.css); this just toggles
  // the transient class. The class is removed on the animation's own end (or
  // cancel), and a re-entrant call strips + reflows first so back-to-back
  // landings restart the press instead of silently skipping it. A stale
  // class can't pin the pressed look (the keyframe doesn't fill) — it would
  // only swallow the next thunk, which the strip-and-reflow also prevents.
  function thunkTaskbarItem(win) {
    if (!taskbar) return;
    const item = taskbar.querySelector(`.taskbar__item[data-for="${win.dataset.window}"]`);
    if (!item) return;
    item.classList.remove("is-receiving");
    void item.offsetWidth;
    const clear = (e) => {
      if (e.animationName !== "taskbar-thunk" && e.animationName !== "aero-minimize-bloom") return;
      item.classList.remove("is-receiving");
      item.removeEventListener("animationend", clear);
      item.removeEventListener("animationcancel", clear);
    };
    item.addEventListener("animationend", clear);
    item.addEventListener("animationcancel", clear);
    item.classList.add("is-receiving");
  }

  // Map a window title to a taskbar glyph key (the Aero skin paints a gel icon per
  // key; base/retro hides .taskbar__item-ic so the bar stays text-only). Keyword
  // match so suffixes like "README — Elisha Lucero" / "Terminal — contact" still hit.
  function taskbarIconKey(title) {
    var t = (title || "").toLowerCase();
    if (t.indexOf("introduction") > -1) return "person";
    if (t.indexOf("trophy") > -1) return "cup";
    if (t.indexOf("favorite") > -1) return "star";
    if (t.indexOf("file explorer") > -1) return "folder";
    if (t.indexOf("photograph") > -1) return "camera";
    if (t.indexOf("cd player") > -1 || t.indexOf("now playing") > -1) return "note";
    if (t.indexOf("terminal") > -1 || t.indexOf("contact") > -1 || t.indexOf("elsewhere") > -1) return "envelope";
    if (t.indexOf("tags") > -1) return "tag";
    // posts / logs / readme / poetry / resume / generic text → document
    if (/posts|build log|attention|readme|poetry|resume|\.log|\.txt|\.doc/.test(t)) return "doc";
    return null;
  }

  function buildTaskbar() {
    if (!taskbar) return;
    taskbar.innerHTML = "";
    windows.forEach((win) => {
      const title = win.querySelector(".window__title")?.textContent ?? "Window";
      const item = document.createElement("button");
      item.className = "taskbar__item";
      item.dataset.for = win.dataset.window;
      item.type = "button";
      // Per-window glyph (Aero only — see .taskbar__item-ic): a span sibling before
      // the label text, so item.textContent stays the title for the a11y label.
      const key = taskbarIconKey(title);
      if (key) {
        const ic = document.createElement("span");
        ic.className = "taskbar__item-ic";
        ic.dataset.tbicon = key;
        ic.setAttribute("aria-hidden", "true");
        item.appendChild(ic);
      }
      item.appendChild(document.createTextNode(title));
      // Native tooltip: the button can ellipsize as windows accumulate, and
      // title= is also the period-correct Win9x affordance.
      item.title = title;
      item.addEventListener("click", () => {
        // A window mid-minimize (.is-closing) needs restoring too — without
        // this, the click falls through to focusWindow(), the close animation
        // completes, and the window the user just asked for vanishes.
        const needsRestore =
          win.classList.contains("is-minimized") || win.classList.contains("is-closing");
        const isActive = win.classList.contains("is-active");
        if (needsRestore) restore(win);
        else if (isActive) minimize(win);
        else focusWindow(win);
      });
      taskbar.appendChild(item);
    });
  }

  function syncTaskbar() {
    if (!taskbar) return;
    taskbar.querySelectorAll(".taskbar__item").forEach((item) => {
      const win = windows.find((w) => w.dataset.window === item.dataset.for);
      if (!win) return;
      const active =
        win.classList.contains("is-active") && !win.classList.contains("is-minimized");
      const minimized = win.classList.contains("is-minimized");
      item.classList.toggle("is-active", active);
      item.classList.toggle("is-minimized", minimized);
      // Screen readers otherwise hear a flat "<title>, button" in every state.
      // This is a tri-state launcher (restore / minimize / focus), so state
      // goes in the accessible name — aria-pressed would mislabel it a toggle.
      item.setAttribute(
        "aria-label",
        item.textContent + (minimized ? " (minimized)" : active ? " (active)" : "")
      );
    });
  }

  // Expose for any later use (e.g. Astro view transitions, the mobile Art
  // medium-switcher in art-mobile.js, which calls focusWindow to bring a chosen
  // window forward — on mobile CSS shows only the .is-active window).
  window.CascadiaWindows = {
    init: initWindows,
    resetDrag,
    focus: (winOrId) => {
      const win =
        typeof winOrId === "string"
          ? windows.find((w) => w.dataset.window === winOrId) ||
            document.getElementById(winOrId)
          : winOrId;
      if (win) focusWindow(win);
    },
  };

  // Bootstrap. `astro:page-load` fires both on the initial document load AND
  // after every <ClientRouter /> view-transition swap, so this is the right
  // hook for rebinding drag/focus handlers to the freshly-rendered window
  // elements on the new page. DOMContentLoaded would only fire once and the
  // bindings would never reattach after a navigation.
  document.addEventListener("astro:page-load", initWindows);
})();

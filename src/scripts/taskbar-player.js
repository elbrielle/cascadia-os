/* ============================================================================
   taskbar-player.js  —  the docked mini-player VIEW + MediaSession
   ----------------------------------------------------------------------------
   Renders the compact play/pause/skip + now-playing strip docked in the
   persisted taskbar (Layout.astro [data-mini-player]). It is a pure VIEW over
   window.CascadiaPlayer (player-engine.js): it reads state and calls
   toggle/next/prev — it never touches audio.src / volume / currentTime, so the
   /art CD player's playback (play/liner modes, the Dean Young sample fade) is
   never disturbed.

   Show/hide rule: the mini-player appears when a track is loaded AND the full
   CD player isn't the active foreground window — i.e. the audio has been carried
   AWAY from a visible player (off /art, or on /art with the window minimized).
   It hides when the CD player is foregrounded (redundant) or no track is loaded.
   Per Elisha's intent it never vanishes silently mid-track on a navigation —
   only on explicit stop/clear or when the full player is back in front.

   ANSI reveal: show()/hide() toggle .is-showing / .is-hiding and let CSS paint
   the stepped column-wipe + scanline shimmer (desktop.css). We drive it via
   animationend (NOT setTimeout) so under prefers-reduced-motion — where the
   --speed* tokens are squashed to 0.01ms — the animation fires-and-ends in one
   frame and the panel just shows/hides instantly, with no separate JS branch.
   A `visible` boolean makes a repeated refreshVisibility() in the same state a
   no-op so the wipe never replays on every navigation.

   Binds ONCE behind window.__cascadiaMiniPlayerBound (the persisted node means
   listeners must never stack across swaps); a separate unguarded per-page block
   only recomputes visibility for the new route. External; astro:page-load +
   DOMContentLoaded; no-op when its hook is absent.
   ========================================================================== */
(function () {
  var visible = false;

  function CP() { return window.CascadiaPlayer; }

  function render(mp) {
    var cp = CP();
    if (!cp) return;
    var s = cp.getState();
    var paused = cp.audio.paused;

    var toggle = mp.querySelector("[data-mp-toggle]");
    if (toggle) {
      var span = toggle.querySelector("span");
      if (span) span.textContent = paused ? "►" : "❚❚";
      toggle.setAttribute("aria-label", paused ? "Play" : "Pause");
      toggle.setAttribute("aria-pressed", paused ? "false" : "true");
    }
    var title = mp.querySelector("[data-mp-title]");
    if (title) title.textContent = s.title || "—";
    // .is-playing drives the pure-CSS EQ "is playing" hint.
    mp.classList.toggle("is-playing", !paused);
  }

  function cdpVisible() {
    // The full CD-player window is on THIS page (it only exists on /art) and not
    // minimized → the docked mini-player would be redundant, so hide it. We key
    // off "window present and not minimized" rather than "is the focused window"
    // because on /art the player tiles alongside other windows: it's plainly
    // visible even when another window (e.g. Photography) holds focus, so the
    // mini-player should still defer to it. When the user minimizes #art-music
    // the mini-player appears; off /art the window is absent, so it shows too.
    var win = document.querySelector("#art-music");
    if (!win) return false; // off /art — no full player present
    return !win.classList.contains("is-minimized");
  }

  function refreshVisibility(mp) {
    var cp = CP();
    if (!cp || !mp) return;
    var audio = cp.audio;
    // Trust the AUDIO ELEMENT, not just the engine's hasTrack flag — across a
    // view-transition swap the flag can momentarily lag, but the persisted
    // element's currentSrc is ground truth. Show only for music the user
    // actually ENGAGED, per Elisha's intent ("if someone is playing music…"):
    // currentSrc rules out the cold "no src" start; played.length / !paused
    // rules out the "track cued on load but never played" case, so a fresh /art
    // visit + navigate-away doesn't pop a player for a song that never started.
    var engaged = !audio.paused || (audio.played && audio.played.length > 0);
    var hasTrack = !!audio.currentSrc && engaged;
    var shouldShow = hasTrack && !cdpVisible();
    if (shouldShow) show(mp);
    else hide(mp);
  }

  // Clear any pending end-of-wipe handler + safety timer (interrupt-safe: a
  // show↔hide flip mid-wipe must not let the previous transition's handler fire
  // late and undo the new state). Mirrors windows.js clearPending().
  function clearWipe(mp) {
    if (mp._wipeEnd) { mp.removeEventListener("animationend", mp._wipeEnd); mp._wipeEnd = null; }
    if (mp._wipeTimer) { clearTimeout(mp._wipeTimer); mp._wipeTimer = null; }
  }

  // Run `settle` when the wipe animation on mp itself ends. We DON'T trust
  // animationend alone: the EQ child animates infinitely (never fires end) and
  // bubbles its iterations, and a display:none or reduced-motion path may never
  // emit a usable end event — so a safety timer (the windows.js awaitAnimation
  // idiom) always lands the terminal state. The handler filters to e.target===mp
  // so a bubbling child event can't resolve early.
  function awaitWipe(mp, settle) {
    clearWipe(mp);
    var finish = function () { clearWipe(mp); settle(); };
    mp._wipeEnd = function (e) { if (e && e.target !== mp) return; finish(); };
    mp.addEventListener("animationend", mp._wipeEnd);
    var ms = parseFloat(getComputedStyle(mp).animationDuration) * 1000 || 0;
    mp._wipeTimer = setTimeout(finish, ms + 60);
  }

  function show(mp) {
    if (visible) return; // already shown — don't replay the wipe on every nav
    visible = true;
    clearWipe(mp);
    mp.classList.remove("is-hiding");
    mp.hidden = false;
    render(mp);
    // Re-arm the reveal cleanly even if a prior show was interrupted.
    mp.classList.remove("is-showing");
    void mp.offsetWidth; // reflow so the animation restarts
    mp.classList.add("is-showing");
    awaitWipe(mp, function () { mp.classList.remove("is-showing"); /* panel stays solid */ });
  }

  function hide(mp) {
    if (!visible) return;
    visible = false;
    clearWipe(mp);
    mp.classList.remove("is-showing");
    mp.classList.remove("is-hiding");
    void mp.offsetWidth;
    mp.classList.add("is-hiding");
    awaitWipe(mp, function () { mp.classList.remove("is-hiding"); mp.hidden = true; });
  }

  /* ---- MediaSession — OS lock-screen / media-key metadata + handlers.
     Additive, gated on support; no markup or CSP impact. So the hardware media
     keys drive the Win95 CD player — the "this OS is real" touch. ---------- */
  function bindMediaSession() {
    if (!("mediaSession" in navigator)) return;
    var ms = navigator.mediaSession;
    document.addEventListener("cascadia:nowplaying", function (e) {
      var s = e.detail || {};
      try {
        if (window.MediaMetadata) {
          ms.metadata = new MediaMetadata({
            title: s.title || "",
            artist: s.n || "",
            album: "Cascadia OS",
            artwork: s.cover ? [{ src: s.cover }] : [],
          });
        }
      } catch (_) {}
    });
    var cp0 = CP();
    if (cp0) {
      cp0.audio.addEventListener("play", function () { try { ms.playbackState = "playing"; } catch (_) {} });
      cp0.audio.addEventListener("pause", function () { try { ms.playbackState = "paused"; } catch (_) {} });
    }
    function set(action, fn) { try { ms.setActionHandler(action, fn); } catch (_) {} }
    set("play", function () { var c = CP(); if (c) c.toggle(); });
    set("pause", function () { var c = CP(); if (c) c.toggle(); });
    set("previoustrack", function () { var c = CP(); if (c) c.prev(); });
    set("nexttrack", function () { var c = CP(); if (c) c.next(); });
  }

  function bindOnce() {
    if (window.__cascadiaMiniPlayerBound) return;
    var mp = document.querySelector("[data-mini-player]");
    if (!mp || !CP()) return; // need both the persisted node and the engine
    window.__cascadiaMiniPlayerBound = true;

    // One delegated click handler for the transport. The LCD <a href="/art/"> is
    // a plain link — ClientRouter swaps it client-side; no preventDefault here.
    mp.addEventListener("click", function (e) {
      var act = e.target.closest("[data-mp-act]");
      if (!act) return;
      var cp = CP();
      if (!cp) return;
      var a = act.getAttribute("data-mp-act");
      if (a === "toggle") cp.toggle();
      else if (a === "next") cp.next();
      else if (a === "prev") cp.prev();
    });

    // Repaint on now-playing changes and on raw audio play/pause (covers media
    // keys + the CD player's own transitions), and recompute visibility — so a
    // stop/clear retires the panel and a fresh track reveals it.
    document.addEventListener("cascadia:nowplaying", function () { render(mp); refreshVisibility(mp); });
    var cp = CP();
    cp.audio.addEventListener("play", function () { render(mp); refreshVisibility(mp); });
    cp.audio.addEventListener("pause", function () { render(mp); refreshVisibility(mp); });

    bindMediaSession();
    refreshVisibility(mp);
  }

  function init() {
    bindOnce();
    // Per-page (UNGUARDED): only recompute show/hide for the new route. No
    // listeners added here — bindOnce owns all subscriptions. Foreground state
    // (#art-music.is-active) is freshly evaluated against the swapped-in DOM.
    var mp = document.querySelector("[data-mini-player]");
    if (mp && CP()) refreshVisibility(mp);
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();

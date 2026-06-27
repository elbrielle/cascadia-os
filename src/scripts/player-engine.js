/* ============================================================================
   player-engine.js  —  window.CascadiaPlayer, the shared playback facade
   ----------------------------------------------------------------------------
   ONE <audio> for the whole OS. It lives in the persisted taskbar footer
   (Layout.astro, transition:persist), so the live element — and its active
   playback, currentTime, buffered ranges — survives every ClientRouter view-
   transition swap. This engine is a THIN, read-mostly handle on that one audio:

     • It NEVER sets audio.src, audio.volume, or audio.currentTime. art-player.js
       (the /art CD player) is the sole owner of those — it owns track selection,
       the play/liner modes, and the Dean Young sample fade. The engine only ever
       play()s / pause()s the existing source, or delegates next/prev INTO the
       CD player's controller when /art is mounted.
     • setNowPlaying() records the current track + dispatches cascadia:nowplaying
       so the taskbar mini-player (taskbar-player.js) + MediaSession can repaint.
     • next()/prev() are NO-OPS when no controller is bound (i.e. off /art), so
       the docked player can never desync a track model it doesn't own.

   Binds ONCE behind a window.CascadiaPlayer existence guard (mirrors system.js's
   window.__cascadiaSystemBound) — the audio is persisted, so re-running init on
   a later page-load is a no-op and the engine's own listeners never stack.

   External; self-registers on astro:page-load + DOMContentLoaded; no timers.
   No-op when [data-engine-audio] is absent (defensive — e.g. ClientRouter off).
   ========================================================================== */
(function () {
  function noop() {}

  function init() {
    // Existence guard: the audio is persisted across swaps, so the engine binds
    // exactly once for the life of the document. Re-entry is a clean no-op.
    if (window.CascadiaPlayer) return;

    var audio = document.querySelector("[data-engine-audio]");
    if (!audio) return; // no hook (e.g. a full reload with the footer not yet present) — bail quietly

    var state = {
      title: "—",
      n: "",
      paused: true,
      hasTrack: false,
      playable: true,
      albumId: null,
      trackNo: 0,
      sampling: false,
      sampleStart: 0,
      cover: null,
    };
    var controller = null;

    function emit() {
      document.dispatchEvent(new CustomEvent("cascadia:nowplaying", { detail: state }));
    }

    var CascadiaPlayer = {
      audio: audio,
      // setNowPlaying — called by art-player.js whenever a track is cued. Marks
      // a track present and notifies the taskbar view + MediaSession.
      setNowPlaying: function (o) {
        if (o) for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) state[k] = o[k];
        state.hasTrack = true;
        emit();
      },
      getState: function () { return state; },
      // The CD player registers/clears its transport closure here as /art mounts
      // and unmounts. With no controller, next/prev are inert (see below).
      bindController: function (c) { controller = c; },
      unbindController: function () { controller = null; },
      // Pass-throughs. toggle falls back to raw play/pause off /art so the docked
      // mini-player can still pause/resume the carried audio; next/prev only act
      // through the CD player's controller (the track model owner).
      toggle: function () {
        if (controller) { controller.toggle(); return; }
        if (audio.paused) audio.play().catch(noop);
        else audio.pause();
      },
      next: function () { if (controller) controller.next(); },
      prev: function () { if (controller) controller.prev(); },
      stop: function () { if (controller) controller.stop(); else audio.pause(); },
    };

    // Engine-owned listeners — bound ONCE (existence guard above guarantees this
    // init body runs a single time). Keep state.paused honest and re-broadcast so
    // every subscriber repaints, even when a play/pause originates outside the
    // CD player (e.g. OS media keys via MediaSession, or the taskbar toggle).
    audio.addEventListener("play", function () { state.paused = false; emit(); });
    audio.addEventListener("pause", function () { state.paused = true; emit(); });
    // 'emptied' fires when src is genuinely removed (switchAlbum's
    // removeAttribute('src')) — the track model is gone, so the mini-player
    // retires. But the browser can also fire a transient 'emptied' during a
    // resource re-attach; guard on currentSrc so a still-sourced (still-playing)
    // audio is never falsely marked track-less and yanked off the taskbar.
    audio.addEventListener("emptied", function () {
      if (!audio.currentSrc) { state.hasTrack = false; emit(); }
    });

    window.CascadiaPlayer = CascadiaPlayer;
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();

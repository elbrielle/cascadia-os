/* ============================================================================
   art-player.js  —  the Art page's Win95 CD-player window (Music)
   ----------------------------------------------------------------------------
   One <audio preload="none"> (nothing downloads until Play). Album tabs switch
   the disc; the player ADAPTS to it, honest to how it'd really work:

     • Playable album (Embroidered, unreleased) → "Now Playing": full transport,
       seek, tracklist — plays straight through the hosted demos.
     • Non-playable album (Fragments, on streaming) → "Liner Notes": the writing
       (description + years-later recollection), the Spotify/Apple/SoundCloud
       links, a read-only tracklist for reference, and ONE hosted sample — a clip
       of Dean Young from 2:09 to the end, volume fading 0→full across 2:09–2:11.

   External; self-registers on astro:page-load; idempotent via data-cdp-ready.
   ========================================================================== */
(function () {
  function noop() {}
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function fmt(s) {
    if (!isFinite(s) || s < 0) return "0:00";
    s = Math.floor(s);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function init() {
    var root = document.querySelector("[data-cdp]");
    if (!root || root.dataset.cdpReady) return;
    root.dataset.cdpReady = "1";

    var albums;
    try { albums = JSON.parse(root.getAttribute("data-albums") || "[]"); } catch (e) { albums = []; }
    albums.sort(function (a, b) { return (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0); });
    if (!albums.length) return;

    // The <audio> is the persisted singleton in the taskbar footer (Layout.astro),
    // NOT a child of this window — it must outlive the #art-music remount so
    // playback survives navigation. art-player.js stays its sole controller
    // (src/volume/currentTime/the sample fade all set only here).
    var audio = document.querySelector("[data-cdp-audio]");
    if (!audio) return; // defensive: no shared audio present → nothing to drive
    var $ = function (s) { return root.querySelector(s); };
    var elTabs = $("[data-cdp-albums]"), elCover = $("[data-cdp-cover]"), elAlbum = $("[data-cdp-album]"),
        elSub = $("[data-cdp-sub]"), elLinks = $("[data-cdp-links]"), elTracks = $("[data-cdp-tracks]"),
        elNote = $("[data-cdp-note]"), elNo = $("[data-cdp-no]"), elLcdTitle = $("[data-cdp-lcdtitle]"),
        elTime = $("[data-cdp-time]"), elSeek = $("[data-cdp-seek]"), elToggle = $("[data-cdp-toggle]"),
        elPos = $("[data-cdp-pos]"), elArtist = $("[data-cdp-artist]");
    var ai = 0, ti = 0, seeking = false, sampling = false, sampleStart = 0, sampleFade = 2;
    var resyncLive = false; // one-shot: true when re-mounting /art mid-playback

    function album() { return albums[ai]; }
    function playable() { return album().playable !== false; }
    function sampleOf(a) { for (var i = 0; i < a.tracks.length; i++) if (a.tracks[i].sample) return { t: a.tracks[i], i: i }; return null; }

    function setGlyph() {
      var span = elToggle.querySelector("span");
      if (span) span.textContent = audio.paused ? "►" : "❚❚";   // retro text glyph (untouched)
      // Aero shows crisp vector icons instead: drive the play↔pause swap off a
      // state attribute (the SVGs are separate siblings, so this never wipes them).
      elToggle.dataset.cdpState = audio.paused ? "paused" : "playing";
      elToggle.setAttribute("aria-label", audio.paused ? (playable() ? "Play" : "Play sample") : "Pause");
    }
    // Publish played fraction as --seek-pct so the Aero skin can paint a colored
    // progress fill on the track (WebKit can't show a range's value in CSS alone).
    function paintSeek() {
      var max = Number(elSeek.max) || 0;
      elSeek.style.setProperty("--seek-pct", (max > 0 ? Number(elSeek.value) / max * 100 : 0) + "%");
    }
    function markTracks() {
      var rows = elTracks.querySelectorAll(".cdp__track");
      for (var i = 0; i < rows.length; i++) rows[i].classList.toggle("is-playing", i === ti && !audio.paused);
    }

    function buildTabs() {
      elTabs.textContent = "";
      albums.forEach(function (a, i) {
        // i === 0 is the newest / featured record (albums are sorted newest-first),
        // so it reads as the PRIMARY; any others are "sample" teasers. The Aero skin
        // styles this hierarchy; retro ignores the modifier + hides the tag.
        var primary = (i === 0);
        var b = el("button", "cdp__albumtab " + (primary ? "cdp__albumtab--primary" : "cdp__albumtab--sample") + (i === ai ? " is-active" : ""));
        b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", i === ai ? "true" : "false");
        b.dataset.albumIdx = i;
        var img = el("img"); img.alt = ""; img.loading = "lazy";
        // prefer the .webp sibling; fall back to the .jpg on decode failure
        // (CSP-safe — onerror set in JS, not an inline attribute)
        img.onerror = function () { img.onerror = null; img.src = a.cover; };
        img.src = a.cover.replace(/\.jpe?g$/i, ".webp");
        b.appendChild(img);
        b.appendChild(el("span", "cdp__albumtab-t", a.title));
        if (!primary) b.appendChild(el("span", "cdp__albumtab-tag", "sample"));
        elTabs.appendChild(b);
      });
    }
    function markTabs() {
      var t = elTabs.querySelectorAll(".cdp__albumtab");
      for (var i = 0; i < t.length; i++) { t[i].classList.toggle("is-active", i === ai); t[i].setAttribute("aria-selected", i === ai ? "true" : "false"); }
    }

    function nowPlaying() {
      // Mirror the cued track into the shared engine so the docked mini-player +
      // MediaSession repaint. Read-only handoff; the engine never writes back.
      var t = album().tracks[ti];
      if (window.CascadiaPlayer && t) {
        window.CascadiaPlayer.setNowPlaying({
          title: t.title, n: t.n, playable: playable(),
          albumId: album().id, trackNo: ti,
          sampling: sampling, sampleStart: sampleStart, cover: album().cover,
        });
      }
    }
    function selectTrack(i, play) { // play mode
      sampling = false; audio.volume = 1; ti = i;
      var t = album().tracks[i];
      audio.src = t.src;
      elNo.textContent = t.n; elLcdTitle.textContent = t.title; elTime.textContent = fmt(t.dur);
      elSeek.max = Math.floor(t.dur) || 0; elSeek.value = 0; paintSeek();
      nowPlaying();
      if (play) audio.play().catch(noop); else { markTracks(); setGlyph(); }
    }
    function playSample() { // liner mode
      var s = sampleOf(album()); if (!s) return;
      ti = s.i; sampling = true; sampleStart = s.t.sample.start; sampleFade = s.t.sample.fade || 2;
      audio.src = s.t.src; audio.volume = 0;
      elNo.textContent = s.t.n; elLcdTitle.textContent = s.t.title;
      nowPlaying();
      audio.play().catch(noop); // seek to sampleStart once metadata is in (loadedmetadata)
    }
    function toggle() {
      if (playable()) {
        if (audio.paused) { if (!audio.src) selectTrack(ti, false); audio.play().catch(noop); }
        else audio.pause();
      } else {
        if (audio.paused) { if (sampling && audio.src) audio.play().catch(noop); else playSample(); }
        else audio.pause();
      }
    }
    function stop() { audio.pause(); try { audio.currentTime = sampling ? sampleStart : 0; } catch (e) {} elSeek.value = 0; }
    function switchAlbum(i) {
      audio.pause(); audio.removeAttribute("src"); sampling = false; audio.volume = 1;
      ai = i; ti = 0; renderAlbum(); markTabs();
      // The mode may have flipped (play ↔ liner), which changes WHICH element is
      // the overflow scroller (tracklist pane in play mode, the window body in
      // liner mode — art.css's :has() liner rule). Ask scrollbar.js to re-scan
      // so its themed bar re-targets. The dataset.mode write above invalidated
      // the :has() rule; force a synchronous style+layout flush (reading
      // offsetHeight) so getComputedStyle() inside the re-scan sees the SETTLED
      // overflow values — a rAF here races the recalc and re-attaches to the
      // stale element. No-op on mobile / coarse pointer (scrollbar.js bails).
      void root.offsetHeight;   // force reflow so the :has() overflow is settled
      document.dispatchEvent(new CustomEvent("cascadia:rescroll"));
    }

    function renderAlbum() {
      var a = album();
      root.dataset.mode = playable() ? "play" : "liner";
      elCover.onerror = function () { elCover.onerror = null; elCover.src = a.cover; };
      elCover.src = a.cover.replace(/\.jpe?g$/i, ".webp");
      elCover.alt = a.title + " cover";
      elAlbum.textContent = a.title + " · " + a.artist;
      elSub.textContent = a.subtitle + (a.producer ? " · prod. " + a.producer : "");

      elLinks.textContent = "";
      Object.keys(a.links || {}).forEach(function (k) {
        var href = a.links[k];
        if (!/^https:\/\//i.test(href)) return;
        var link = el("a", "cdp__link", (k === "soundcloud" ? "SoundCloud" : k === "apple" ? "Apple Music" : cap(k)) + " ↗");
        link.href = href; link.target = "_blank"; link.rel = "noopener";
        elLinks.appendChild(link);
      });

      elNote.textContent = "";
      if (!playable()) {
        if (a.note) elNote.appendChild(el("p", "cdp__note-p", a.note));
        if (a.artistNote) elNote.appendChild(el("p", "cdp__note-p cdp__note-p--recollection", a.artistNote));
      } else if (a.artistNote || a.note) {
        elNote.appendChild(el("p", "cdp__note-p", a.artistNote || a.note));
      }

      elTracks.textContent = "";
      a.tracks.forEach(function (t, i) {
        var isSample = !!t.sample;
        var rowPlayable = playable() || isSample;
        var btn = el("button", "cdp__track" + (rowPlayable ? "" : " cdp__track--listing") + (isSample ? " cdp__track--sample" : ""));
        btn.type = "button"; btn.dataset.ti = i;
        if (!rowPlayable) btn.setAttribute("aria-disabled", "true");
        btn.appendChild(el("span", "cdp__track-n", t.n));
        btn.appendChild(el("span", "cdp__track-title", t.title));
        btn.appendChild(el("span", "cdp__track-dur", isSample ? "sample ►" : fmt(t.dur)));
        var li = el("li"); li.appendChild(btn); elTracks.appendChild(li);
      });

      elPos.textContent = (playable() ? "Now playing" : "Liner notes");
      elArtist.textContent = a.artist;

      // resyncLive is set true ONLY for the first render when we returned to /art
      // mid-playback (set in init from CascadiaPlayer.getState()). In that case we
      // must NOT call selectTrack(0,false) — it would reassign audio.src to track
      // 0 and zero currentTime, killing the still-playing persisted audio (the
      // disappearing bug, inverted). Instead repaint the LIVE row/glyph and let
      // the existing timeupdate path restore the seek bar. One-shot: cleared here.
      var live = resyncLive; resyncLive = false;
      if (playable()) {
        if (!live) selectTrack(0, false);
        else {
          // Repaint the LCD + seek to the LIVE track WITHOUT touching audio.src /
          // currentTime — the persisted audio is mid-play. loadedmetadata already
          // fired (won't re-fire), so restore the seek bar from audio.duration and
          // the current position; the running timeupdate keeps it ticking.
          var lt = a.tracks[ti];
          if (lt) { elNo.textContent = lt.n; elLcdTitle.textContent = lt.title; }
          var dur = isFinite(audio.duration) ? Math.floor(audio.duration) : (lt ? Math.floor(lt.dur) || 0 : 0);
          elSeek.max = dur; elSeek.value = Math.floor(audio.currentTime) || 0; paintSeek();
          elTime.textContent = fmt(audio.currentTime);
          markTracks(); setGlyph();
        }
      } else {
        var s = sampleOf(a);
        if (s) { elNo.textContent = s.t.n; elLcdTitle.textContent = s.t.title; }
        if (!live) elTime.textContent = "0:00";
        markTracks(); setGlyph();
      }
    }

    // The <audio> is the PERSISTED singleton, so its event listeners must NOT be
    // re-added on every /art remount or they'd stack → double auto-advance + a
    // doubled sample-fade ramp on repeat visits. Bind the five audio listeners
    // exactly ONCE (guarded by audio.dataset.cdpListeners); each one delegates to
    // audio._cdp, the CURRENT mount's handler set, which we overwrite below on
    // every init. That keeps the listeners single (no stacking) while always
    // firing against the freshly-mounted window's closure (elSeek, album(), ti…).
    audio._cdp = {
      loadedmetadata: function () {
        if (sampling) { try { if (audio.currentTime < sampleStart) audio.currentTime = sampleStart; } catch (e) {} }
        else if (isFinite(audio.duration)) elSeek.max = Math.floor(audio.duration);
      },
      timeupdate: function () {
        if (sampling) audio.volume = clamp((audio.currentTime - sampleStart) / sampleFade, 0, 1);
        if (seeking) return;
        elSeek.value = Math.floor(audio.currentTime);
        elTime.textContent = fmt(audio.currentTime);
        paintSeek();
      },
      play: function () { setGlyph(); markTracks(); },
      pause: function () { setGlyph(); markTracks(); },
      ended: function () {
        if (sampling) { sampling = false; audio.volume = 1; setGlyph(); markTracks(); return; }
        if (ti < album().tracks.length - 1) selectTrack(ti + 1, true);
        else selectTrack(0, false);
      },
    };
    if (!audio.dataset.cdpListeners) {
      audio.dataset.cdpListeners = "1";
      audio.addEventListener("loadedmetadata", function () { if (audio._cdp) audio._cdp.loadedmetadata(); });
      audio.addEventListener("timeupdate", function () { if (audio._cdp) audio._cdp.timeupdate(); });
      audio.addEventListener("play", function () { if (audio._cdp) audio._cdp.play(); });
      audio.addEventListener("pause", function () { if (audio._cdp) audio._cdp.pause(); });
      audio.addEventListener("ended", function () { if (audio._cdp) audio._cdp.ended(); });
    }
    elSeek.addEventListener("input", function () { seeking = true; elTime.textContent = fmt(elSeek.value); paintSeek(); });
    elSeek.addEventListener("change", function () { audio.currentTime = Number(elSeek.value); seeking = false; });

    root.addEventListener("click", function (e) {
      var tab = e.target.closest("[data-album-idx]");
      if (tab) { switchAlbum(Number(tab.dataset.albumIdx)); return; }
      var act = e.target.closest("[data-cdp-act]");
      if (act) {
        var a = act.getAttribute("data-cdp-act");
        if (a === "toggle") toggle();
        else if (a === "stop") stop();
        else if (a === "next") selectTrack(Math.min(ti + 1, album().tracks.length - 1), !audio.paused);
        else if (a === "prev") { if (audio.currentTime > 3) audio.currentTime = 0; else selectTrack(Math.max(ti - 1, 0), !audio.paused); }
        return;
      }
      var trk = e.target.closest(".cdp__track");
      if (trk && !trk.hasAttribute("aria-disabled")) {
        if (playable()) selectTrack(Number(trk.dataset.ti), true);
        else playSample();
      }
    });

    // MID-PLAYBACK RE-SYNC. If we returned to /art while the persisted audio is
    // still carrying a track (started here, then navigated away), adopt the LIVE
    // state BEFORE the first render so the disc/row/glyph repaint to the playing
    // track instead of resetting to album 0 / track 0 (which renderAlbum's guard,
    // gated on resyncLive, now skips). Changing the disc later is still an
    // explicit switchAlbum (which clears src) — only the initial paint adopts.
    var liveState = window.CascadiaPlayer && window.CascadiaPlayer.getState();
    if (liveState && liveState.hasTrack && audio.currentSrc) {
      var idx = -1;
      for (var k = 0; k < albums.length; k++) if (albums[k].id === liveState.albumId) { idx = k; break; }
      ai = idx < 0 ? 0 : idx;
      ti = liveState.trackNo || 0;
      sampling = !!liveState.sampling;
      sampleStart = liveState.sampleStart || 0;
      resyncLive = true;
    }

    // Register this mount's transport with the engine so the docked mini-player
    // (and OS media keys) drive the REAL CD-player logic — track model stays
    // owned here. Cleared on leaving /art via the module-scope before-swap below.
    if (window.CascadiaPlayer) {
      window.CascadiaPlayer.bindController({
        toggle: toggle,
        next: function () { selectTrack(Math.min(ti + 1, album().tracks.length - 1), !audio.paused); },
        prev: function () { if (audio.currentTime > 3) audio.currentTime = 0; else selectTrack(Math.max(ti - 1, 0), !audio.paused); },
        stop: stop,
      });
    }

    buildTabs();
    renderAlbum();
    setGlyph();
  }

  // Leaving /art drops the stale transport closure so the engine falls back to
  // raw play/pause (and next/prev become inert) until /art mounts again. The
  // audio + engine PERSIST; only this per-page controller is released. Module
  // scope (attached once) — never inside init, or it would stack per mount.
  document.addEventListener("astro:before-swap", function () {
    if (window.CascadiaPlayer) window.CascadiaPlayer.unbindController();
  });

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();

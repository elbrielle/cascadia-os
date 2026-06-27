/* ============================================================================
   attention-grid.js  —  the Home "attention.log" icon-grid panel
   ----------------------------------------------------------------------------
   Drives the cover-tile grid built at build time in AttentionLog.astro (markup +
   styles: src/components/AttentionLog.astro + the .attn rules in components.css).
   Each tile carries its data in data-* attrs, so this only handles interaction:
   tap a tile → show the title + my note. Desktop fills a sticky detail bar
   pinned to the window bottom; mobile (<=720px) slides the same content up as a
   dismissible bottom sheet (tap the backdrop / close button / Esc). The first
   tile is pre-selected so the desktop bar is never empty — on mobile the sheet
   stays closed until the first tap.

   External + registered on astro:page-load (first load AND after each view-
   transition swap). No-ops on pages without the panel. The detail is built
   with createElement/textContent (never innerHTML) so a curated note or title
   can never inject markup; links are https-guarded.
   ========================================================================== */

(function () {
  var KIND_LABEL = { book: "Book", film: "Film", show: "TV", game: "Game", album: "Album", paper: "Article" };

  /* ----- background scroll lock for the mobile bottom sheet ----------------
     The sheet is position:fixed over a backdrop (mobile.css), a modal contract,
     but the document behind it stays scrollable — a swipe on the sheet's gutter
     or an overscroll past its bounds drags the page underneath, so it reads as
     half-modal. iOS Safari ignores `overflow:hidden` on <body> (and mobile.css
     forces body overflow visible anyway), so we pin the body with position:fixed
     + a negative top offset — the technique iOS actually honors — and restore
     the scroll position on release. Module-level (the IIFE runs once; only
     initAttn re-runs per astro:page-load) so the lock state survives a view
     transition and the before-swap unlock below can always find it. */
  var scrollLockY = 0;
  var scrollLocked = false;
  function lockScroll() {
    // Idempotent: re-locking while already pinned would record scrollY = 0
    // (the body is fixed, so the window reports no scroll) and later restore to
    // the top. Tapping a second tile while the sheet is open must NOT re-lock.
    if (scrollLocked) return;
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    scrollLocked = true;
    var s = document.body.style;
    s.position = "fixed";
    s.top = -scrollLockY + "px"; // content stays visually put — same on-screen pixel as the live scroll
    s.left = "0";
    s.right = "0"; // fixed body would otherwise shrink-to-fit; pin full width so padding/layout hold
  }
  function unlockScroll() {
    if (!scrollLocked) return;
    scrollLocked = false;
    var s = document.body.style;
    s.position = "";
    s.top = ""; // clear the offset BEFORE scrollTo so the pinned top can't fight the restore
    s.left = "";
    s.right = "";
    window.scrollTo(0, scrollLockY);
  }
  // Never carry a pinned body into a ClientRouter navigation — the swapped-in
  // page would render unscrollable. Attached once at module scope (no stacking).
  document.addEventListener("astro:before-swap", unlockScroll);

  function buildDetail(detail, tile) {
    var d = tile.dataset;
    while (detail.firstChild) detail.removeChild(detail.firstChild);

    // Cover (artwork, or a document tile for articles with no art).
    var cov = document.createElement("div");
    cov.className =
      "attn__detail-cov" +
      (d.kind === "album" ? " attn__detail-cov--sq" : "") +
      (d.image ? "" : " attn__detail-cov--doc");
    if (d.kind) cov.style.setProperty("--tint", "var(--t-" + d.kind + ")");
    if (d.image) {
      var img = document.createElement("img");
      img.src = d.image;
      img.alt = "Cover of " + (d.title || "");
      img.loading = "lazy";
      cov.appendChild(img);
    } else {
      var glyph = document.createElement("span");
      glyph.className = "attn__doc";
      glyph.textContent = "▤"; // ▤
      cov.appendChild(glyph);
    }
    detail.appendChild(cov);

    var meta = document.createElement("div");
    meta.className = "watch__meta";

    var head = document.createElement("div");
    head.className = "watch__head";
    var chip = document.createElement("span");
    chip.className = "kind kind--" + (d.kind || "");
    chip.textContent = KIND_LABEL[d.kind] || d.kind || "";
    head.appendChild(chip);

    var titleEl;
    if (d.link && /^https:\/\//i.test(d.link)) {
      titleEl = document.createElement("a");
      titleEl.className = "watch__title";
      titleEl.href = d.link;
      titleEl.target = "_blank";
      titleEl.rel = "noopener";
    } else {
      titleEl = document.createElement("span");
      titleEl.className = "watch__title";
    }
    titleEl.textContent = d.title || "";
    head.appendChild(titleEl);
    meta.appendChild(head);

    if (d.detail) {
      var sub = document.createElement("span");
      sub.className = "watch__detail";
      sub.textContent = d.detail;
      meta.appendChild(sub);
    }
    if (d.note) {
      var note = document.createElement("span");
      note.className = "watch__note";
      note.textContent = "“" + d.note + "”"; // curly quotes
      meta.appendChild(note);
    }
    detail.appendChild(meta);
  }

  // Module-level so the previous Esc handler can be detached before re-binding
  // on each astro:page-load (otherwise listeners stack across view transitions).
  var escHandler = null;

  function initAttn() {
    var root = document.querySelector("[data-attn]");
    if (!root) return; // not the Home attention panel

    // Cover arrival reveal: stamping data-covers arms the components.css
    // opacity gate (no-JS visitors never get it, so covers stay visible), and
    // each cover flips .is-loaded once decoded. img.complete handles cache
    // hits and view-transition returns where `load` already fired; `error`
    // also reveals (the alt text over the tint beats a forever-blank tile).
    if (!root.dataset.covers) {
      root.dataset.covers = "1";
      Array.prototype.forEach.call(root.querySelectorAll(".attn__cov-img"), function (img) {
        var reveal = function () { img.classList.add("is-loaded"); };
        if (img.complete) reveal();
        else {
          img.addEventListener("load", reveal, { once: true });
          img.addEventListener("error", reveal, { once: true });
        }
      });
    }

    var detail = root.querySelector("[data-attn-detail]");
    var content = root.querySelector("[data-attn-detail-content]");
    var backdrop = root.querySelector("[data-attn-backdrop]");
    var tiles = Array.prototype.slice.call(root.querySelectorAll(".attn__tile"));
    if (!detail || !content || !tiles.length) return;

    // Desktop: the detail is a sticky bar that's always visible. Mobile (<=720px,
    // matching mobile.css): it's a bottom sheet revealed on tap.
    var sheetMQ = window.matchMedia("(max-width: 720px)");

    function openSheet() {
      // Re-fill on a second tile tap leaves the sheet open; the lock guard
      // (already-open → no-op) keeps that from re-recording the scroll position.
      if (detail.classList.contains("is-open")) return;
      if (sheetMQ.matches) lockScroll(); // mobile only; desktop's sticky bar never opens a sheet
      detail.classList.add("is-open");
      if (backdrop) backdrop.hidden = false;
    }
    function closeSheet() {
      detail.classList.remove("is-open");
      if (backdrop) backdrop.hidden = true;
      // Always unlock (idempotent). Covers every close path — backdrop tap,
      // close button, Esc, and the cross-to-desktop handler below (which fires
      // with sheetMQ.matches already false, so it can't be gated on that).
      unlockScroll();
    }

    function select(tile, userInitiated) {
      buildDetail(content, tile);
      var prev = root.querySelector(".attn__tile.is-sel");
      if (prev) prev.classList.remove("is-sel");
      tile.classList.add("is-sel");
      // A tap on mobile slides the sheet up. Desktop's sticky bar needs nothing
      // (no scrollIntoView — that was what jumped the page down to the bottom).
      if (userInitiated && sheetMQ.matches) openSheet();
    }

    root.addEventListener("click", function (e) {
      if (e.target.closest("[data-attn-close]")) { closeSheet(); return; }
      var tile = e.target.closest(".attn__tile");
      if (tile) select(tile, true);
    });
    if (backdrop) backdrop.addEventListener("click", closeSheet);

    if (escHandler) document.removeEventListener("keydown", escHandler);
    escHandler = function (e) {
      if (e.key === "Escape" && detail.classList.contains("is-open")) closeSheet();
    };
    document.addEventListener("keydown", escHandler);

    // Crossing back to desktop width should never leave a sheet stuck open.
    sheetMQ.onchange = function (e) { if (!e.matches) closeSheet(); };

    select(tiles[0], false); // pre-fill the (desktop) bar; never auto-open on load
  }

  document.addEventListener("astro:page-load", initAttn);
})();

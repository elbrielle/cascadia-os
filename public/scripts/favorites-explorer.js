/* ============================================================================
   favorites-explorer.js  —  the About page Favorites explorer (Phase C)
   ----------------------------------------------------------------------------
   Drives the Windows/Finder-style explorer built at build time in about.astro
   (markup + styles: src/styles/favorites.css). All item data is baked into the
   DOM as data-* attributes on each .fav__cover, so this script only handles
   interaction — no fetching.

     • Click a folder  → show that category's cover grid + update the path bar.
     • Click a cover   → populate the detail pane with the review.
     • Desktop (≥62em) → grid + detail sit side by side; switching folders
                          auto-selects the first cover so the pane is never blank.
     • Mobile (<62em)  → drill-in: folders are a chip row, the grid is full
                          width, and tapping a cover swaps to a full-width detail
                          with a "← Back" button (CSS keys off .is-detail-open).

   External + registered on astro:page-load (first load AND after each
   view-transition swap). No-ops on pages without the explorer. The detail pane
   is built with createElement/textContent (never innerHTML) so a curated note
   or title can never inject markup.
   ========================================================================== */

(function () {
  // Matches the 3-pane breakpoint in favorites.css. At/above this width the
  // detail pane sits beside the grid, so we auto-select the first item; below it
  // the layout is the drill-in (grid first, detail on tap) — no auto-select.
  function isDesktop() {
    return window.matchMedia("(min-width: 75em)").matches;
  }

  function buildDetail(root, detail, cover) {
    const d = cover.dataset;
    while (detail.firstChild) detail.removeChild(detail.firstChild);

    // Back button — visible on mobile only (CSS), returns to the grid.
    const back = document.createElement("button");
    back.type = "button";
    back.className = "fav__detail-back";
    back.textContent = "← Back";
    back.addEventListener("click", function () {
      root.classList.remove("is-detail-open");
    });
    detail.appendChild(back);

    // Big cover — artwork, or a document tile for papers (no art anywhere).
    const big = document.createElement("div");
    big.className =
      "fav__detail-cover" +
      (d.kind === "paper" ? " fav__cover--doc" : "") +
      (d.kind === "album" ? " fav__detail-cover--square" : ""); // albums are 1:1, not portrait
    const tint = cover.style.getPropertyValue("--tint");
    if (tint) big.style.setProperty("--tint", tint);
    if (d.kind === "paper") {
      const fold = document.createElement("span");
      fold.className = "fav__cover-fold";
      const t = document.createElement("span");
      t.className = "fav__cover-t";
      t.textContent = d.title || "";
      const ext = document.createElement("span");
      ext.className = "fav__cover-ext";
      ext.textContent = ".pdf";
      big.appendChild(fold);
      big.appendChild(t);
      big.appendChild(ext);
    } else if (d.image) {
      const img = document.createElement("img");
      img.className = "fav__detail-img";
      img.src = d.image;
      img.alt = "Cover of " + (d.title || "");
      img.loading = "lazy";
      big.appendChild(img);
    } else {
      const t = document.createElement("span");
      t.className = "fav__cover-t";
      t.textContent = d.title || "";
      big.appendChild(t);
    }
    detail.appendChild(big);

    const title = document.createElement("div");
    title.className = "fav__detail-title";
    title.textContent = d.title || "";
    detail.appendChild(title);

    if (d.detail) {
      const sub = document.createElement("div");
      sub.className = "fav__detail-sub";
      sub.textContent = d.detail;
      detail.appendChild(sub);
    }
    if (d.note) {
      const note = document.createElement("div");
      note.className = "fav__detail-note";
      note.textContent = "“" + d.note + "”"; // curly quotes
      detail.appendChild(note);
    }
    if (d.link && /^https:\/\//i.test(d.link)) {
      const a = document.createElement("a");
      a.className = "fav__detail-link";
      a.href = d.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "View source ↗";
      detail.appendChild(a);
    }
  }

  function initFav() {
    const root = document.querySelector("[data-fav]");
    if (!root) return; // not the About explorer

    const folders = Array.prototype.slice.call(root.querySelectorAll(".fav__folder"));
    const grids = Array.prototype.slice.call(root.querySelectorAll(".fav__grid"));
    const pathEl = root.querySelector("[data-fav-path]");
    const detail = root.querySelector("[data-fav-detail]");
    const select = root.querySelector("[data-fav-select]"); // mobile category picker
    if (!folders.length || !detail) return;

    function showDetail(cover) {
      buildDetail(root, detail, cover);
      detail.hidden = false;
      root.classList.add("is-detail-open");
      const prev = root.querySelector(".fav__cover.is-sel");
      if (prev) prev.classList.remove("is-sel");
      cover.classList.add("is-sel");
    }

    function selectFolder(key) {
      folders.forEach(function (f) {
        const on = f.dataset.cat === key;
        f.classList.toggle("is-active", on);
        f.setAttribute("aria-pressed", on ? "true" : "false");
        if (on && pathEl) pathEl.textContent = "C:\\Favorites\\" + (f.dataset.label || "");
      });
      grids.forEach(function (g) {
        g.hidden = g.dataset.cat !== key;
      });
      if (select && select.value !== key) select.value = key; // keep the mobile dropdown in sync
      // Reset to the grid view; on desktop, auto-open the first item.
      root.classList.remove("is-detail-open");
      detail.hidden = true;
      const firstCover = root.querySelector(".fav__grid:not([hidden]) .fav__cover");
      if (isDesktop() && firstCover) showDetail(firstCover);
    }

    folders.forEach(function (f) {
      f.addEventListener("click", function () {
        selectFolder(f.dataset.cat);
      });
    });

    if (select) {
      select.addEventListener("change", function () {
        selectFolder(select.value);
      });
    }

    root.addEventListener("click", function (e) {
      const cover = e.target.closest(".fav__cover");
      if (cover && cover.closest(".fav__grid")) showDetail(cover);
    });

    selectFolder(folders[0].dataset.cat);
  }

  document.addEventListener("astro:page-load", initFav);
})();

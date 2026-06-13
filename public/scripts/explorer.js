/* ============================================================================
   explorer.js  —  deep-link the Work page's File Explorer to a project
   ----------------------------------------------------------------------------
   The Home page's project tiles link to /work/#work-<slug>. The File Explorer
   window groups projects into collapsible <details> "folders" (Apps /
   Curriculum / Services), with Apps open by default. A bare URL hash can't
   open a *collapsed* <details>, so on arrival we:
     1. find the targeted .work-item by its id,
     2. open its folder and collapse the others — so you land in the folder you
        clicked (a Service / Curriculum item no longer dumps you in Apps),
     3. scroll it into view and flash a brief highlight.

   External + registered on astro:page-load (fires on first load AND after each
   view-transition swap), so it works whether you hard-load /work/#… or click a
   tile and cross-fade in. No-ops on pages without the explorer or when the hash
   doesn't point at a project (e.g. the legacy "#client" window anchor).
   ========================================================================== */

(function () {
  function focusTarget() {
    var hash = location.hash;
    if (!hash || hash.length < 2) return;

    var target;
    try { target = document.querySelector(hash); } catch (_) { return; }
    if (!target || !target.classList.contains("work-item")) return;

    var folder = target.closest("details.folder");
    if (folder) {
      // Open the targeted folder, collapse the rest — land where you clicked.
      document.querySelectorAll("details.folder").forEach(function (d) {
        d.open = d === folder;
      });
    }

    // Let the just-opened folder lay out before scrolling to the item.
    requestAnimationFrame(function () {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    });

    // Brief highlight so the clicked project is obvious on arrival.
    target.classList.add("is-target");
    setTimeout(function () { target.classList.remove("is-target"); }, 2000);
  }

  document.addEventListener("astro:page-load", focusTarget);
  window.addEventListener("hashchange", focusTarget);
})();

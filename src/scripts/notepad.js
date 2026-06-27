/* ============================================================================
   notepad.js  —  the Art page's Notepad viewer + file-list sort
   ----------------------------------------------------------------------------
   Two jobs on the Poetry window:
     • Open a written poem verbatim. A [data-np] file-list row carries the poem
       in data-poem; we drop it into a <pre white-space:pre> via textContent (no
       innerHTML → no injection), title the bar "X — Notepad", show the credit
       line for collaborations, Esc / × / backdrop close, focus restores to the
       row. The visual poem ([data-vpv]) is handled by its own viewer, not here.
     • Sort the file-list. The column headers ([data-sort]) really re-sort the
       rows (Name / Type / Year), toggling asc↔desc — a real affordance, the way
       Win95 Explorer's Details columns work.

   External; self-registers on astro:page-load; idempotent guards. No-ops off the
   Art page. (File/Edit/Format/View stay decorative chrome — aria-hidden, inert.)
   ========================================================================== */
(function () {
  function initViewer() {
    var root = document.getElementById("np");
    if (!root || root.dataset.npReady) return;
    root.dataset.npReady = "1";

    var elTitle = root.querySelector("#np-title"),
        elAttr = root.querySelector("#np-attr"),
        elText = root.querySelector("#np-text"),
        elSrc = root.querySelector("#np-status-src"),
        elMeta = root.querySelector("#np-status-meta"),
        btnClose = root.querySelector("[data-np-close]");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var invoker = null;

    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      var f = root.querySelectorAll("button, [tabindex]:not([tabindex='-1'])");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function open(btn) {
      invoker = btn;
      var d = btn.dataset;
      elTitle.textContent = (d.title || "") + "  —  Notepad";
      if (d.attribution) { elAttr.textContent = d.attribution; elAttr.hidden = false; }
      else { elAttr.hidden = true; elAttr.textContent = ""; }
      elText.textContent = d.poem || "";
      elSrc.textContent = d.source || "";
      elMeta.textContent = d.year || "";
      root.hidden = false;
      root.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("np-open");
      if (!reduce) { root.classList.remove("np-anim"); void root.offsetWidth; root.classList.add("np-anim"); }
      btnClose.focus();
      document.addEventListener("keydown", onKey, true);
    }
    function close() {
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("np-open");
      document.removeEventListener("keydown", onKey, true);
      if (invoker && invoker.focus) invoker.focus();
      invoker = null;
    }

    root.addEventListener("click", function (e) {
      if (e.target.closest("[data-np-close]")) return close();
      if (e.target === root) return close(); // backdrop
    });
    document.querySelectorAll("[data-np]").forEach(function (b) {
      b.addEventListener("click", function () { open(b); });
    });
  }

  function initSort() {
    var list = document.querySelector(".filelist__rows");
    var head = document.querySelector(".filelist__head");
    if (!list || !head || list.dataset.sortReady) return;
    list.dataset.sortReady = "1";
    var dir = {};

    function val(li, key) {
      var b = li.querySelector(".filelist__row");
      var d = b.dataset;
      if (key === "name") return (d.title || "").toLowerCase();
      if (key === "date") return parseInt(d.year, 10) || 0;
      if (key === "kind") return b.hasAttribute("data-vpv") ? "visual poem" : "text document";
      return "";
    }

    head.querySelectorAll("[data-sort]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-sort");
        dir[key] = dir[key] === "asc" ? "desc" : "asc";
        var rows = Array.prototype.slice.call(list.children);
        rows.sort(function (a, b) {
          var va = val(a, key), vb = val(b, key);
          var c = va < vb ? -1 : va > vb ? 1 : 0;
          return dir[key] === "asc" ? c : -c;
        });
        rows.forEach(function (li) { list.appendChild(li); });
        head.querySelectorAll("[data-sort]").forEach(function (h) { h.removeAttribute("aria-sort"); });
        btn.setAttribute("aria-sort", dir[key] === "asc" ? "ascending" : "descending");
      });
    });
  }

  function init() { initViewer(); initSort(); }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();

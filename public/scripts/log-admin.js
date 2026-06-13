/* ============================================================================
   public/scripts/log-admin.js  —  curation admin UI (Attention Log + Favorites)
   ----------------------------------------------------------------------------
   Drives the private /log-admin page. Two curated lists share this UI through a
   tab switcher:
     • Attention Log  — the live "currently into" feed (KV key "published").
       Adds Film/TV + Books, plus the Trakt review inbox and Goodreads sync.
     • Favorites      — the all-time picks (KV key "favorites"). Adds Book,
       Film/TV, Game, Music, Article (DOI/title); grouped by category. No
       Goodreads/Trakt — those are live-feed concepts and stay on Attention.

   The generic search/add/list/note/remove machinery lives in createList(cfg),
   instantiated once per list and pointed at a read endpoint + KV list key. The
   attention-only extras (Goodreads sync, Trakt inbox, Push-to-site) wrap the
   attention instance. Writes for BOTH lists serialize through one mutate()
   chain (different KV keys, but one chain is simplest and can never race).

   The page sits behind Cloudflare Access, so same-origin fetches to /api/admin/*
   automatically carry the Access session cookie — there is no token to manage
   here. External (not inline) so the CSP script-hash list stays at two.

   Reliability notes (why this isn't just naive fetch()):
   - Every request has a hard timeout (api() aborts after API_TIMEOUT_MS). A
     stalled request used to leave the "Add" button stuck on "Adding…" forever
     because the await never settled; now it always settles.
   - Writes are serialized through one promise chain (mutate()). KV has no
     transactions, so two overlapping read-modify-write calls could lose an
     update. Serializing them makes every write see the previous write's result.
   - A button's success state reflects the WRITE that just succeeded, not the
     follow-up list refresh — so a slow refresh can never strand a button.
   - Post-write rendering goes through each list's applyWriteResult() (render
     from the write's own response), never a re-read — KV reads are edge-cached
     (~60s) and can hand back the pre-write list.

   Under `npm run dev` there is no Functions runtime, so the API calls 404 and
   the lists can't load/save — test on a deployed (preview/prod) URL. The tab
   switcher + form rendering still work under dev (handy to eyeball the layout).
   ========================================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");
  if (!statusEl) return; // not the admin page

  // Category order for the Favorites grouped list — mirrors CATEGORIES in
  // src/lib/favorites.js so the admin groups exactly like the public explorer.
  const CATEGORY_ORDER = [
    { key: "book", label: "Books" },
    { key: "film", label: "Films" },
    { key: "show", label: "Shows" },
    { key: "game", label: "Games" },
    { key: "album", label: "Music" },
    { key: "paper", label: "Articles" },
  ];
  const KIND_LABEL = { film: "Film", show: "TV", book: "Book", album: "Album", game: "Game", paper: "Paper" };
  const API_TIMEOUT_MS = 15000;

  function setStatus(msg, kind) {
    statusEl.textContent = msg || "";
    statusEl.dataset.kind = kind || "";
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // fetch + JSON with a hard timeout so a stalled request can never leave the
  // UI hanging. AbortController fires after API_TIMEOUT_MS → fetch rejects →
  // the caller's catch runs (button resets, status shows the error). Thrown
  // errors carry `.status` so callers can branch (e.g. retry on 429).
  async function api(path, opts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const res = await fetch(path, { ...opts, signal: controller.signal });
      if (!res.ok) throw Object.assign(new Error("HTTP " + res.status), { status: res.status });
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Writes go through here: Cloudflare KV allows only ~1 write/sec to a single
  // key, so two writes to the same key in quick succession can come back 429.
  // mutate() serializes writes but doesn't space them a full second apart, so a
  // rapid add-add or note-note can still trip the limit. Back off and retry a
  // couple times before surfacing the failure. Writes here are full-array puts
  // (idempotent last-write-wins) + serialized, so a retry is safe.
  async function writeApi(path, opts) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await api(path, opts);
      } catch (err) {
        if (err && err.status === 429 && attempt < 2) {
          await sleep(1100);
          continue;
        }
        throw err;
      }
    }
  }

  // Serialize every WRITE (add / edit / remove / sync / dismiss) onto one chain
  // so they never overlap on a single KV key. Reads stay free. A failed write
  // rejects to its own caller but does NOT break the chain.
  let writeChain = Promise.resolve();
  function mutate(fn) {
    const run = writeChain.then(fn, fn);
    writeChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  // Cache-buster for reads. Defeats the HTTP/CDN cache only — it cannot touch
  // Cloudflare KV's own edge read-cache (~60s), which lives below HTTP. That's
  // why post-write rendering goes through applyWriteResult() (render from the
  // write's own response), never a re-read.
  const bust = () => "_=" + Date.now();

  // ---- shared row builder -------------------------------------------------
  function thumb(src, alt) {
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = alt || "";
      img.loading = "lazy";
      return img;
    }
    const ph = document.createElement("div");
    ph.className = "thumb--empty";
    return ph;
  }

  function row(it) {
    const li = document.createElement("li");
    li.className = "row";
    li.appendChild(thumb(it.image, it.title));

    const meta = document.createElement("div");
    meta.className = "row__meta";

    const title = document.createElement("div");
    title.className = "row__title";
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = KIND_LABEL[it.kind] || it.kind;
    title.appendChild(chip);
    title.appendChild(document.createTextNode(" " + (it.title || "")));
    meta.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "row__sub";
    sub.textContent = it.detail || "";
    meta.appendChild(sub);

    li.appendChild(meta);
    return li;
  }

  // ---- generic curated list ------------------------------------------------
  // One instance per list. cfg:
  //   formId/kindId/qId/resultsId : the search UI element ids
  //   listId/countId              : the saved-list container + count ids
  //   readPath                    : public GET endpoint (e.g. /api/favorites)
  //   list                        : KV list key for writes ("favorites") or
  //                                 null → default "published" (omit the param)
  //   source                      : provenance written with new items
  //   grouped                     : render the list grouped by CATEGORY_ORDER
  //   emptyText                   : message when the list is empty
  function createList(cfg) {
    const form = $(cfg.formId);
    const kindSel = $(cfg.kindId);
    const qInput = $(cfg.qId);
    const resultsEl = $(cfg.resultsId);
    const listEl = $(cfg.listId);
    const countEl = $(cfg.countId);

    // True once any write has painted this list. The initial guarded read
    // (load(true)) yields if a write already rendered, so it can't clobber a
    // fresher write paint.
    let writeRendered = false;
    let loaded = false;

    // Build the write endpoint, threading the ?list= selector for non-default
    // lists. extra is an already-encoded query fragment (e.g. "id=...").
    const itemPath = (extra) =>
      "/api/admin/item" +
      (cfg.list
        ? "?list=" + cfg.list + (extra ? "&" + extra : "")
        : extra
        ? "?" + extra
        : "");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = qInput.value.trim();
      if (!q) return;
      setStatus("Searching…");
      resultsEl.innerHTML = "";
      try {
        const { results } = await api(
          `/api/admin/search?q=${encodeURIComponent(q)}&kind=${kindSel.value}`
        );
        renderResults(results || []);
        setStatus(results && results.length ? "" : "No matches.");
      } catch (err) {
        setStatus("Search failed.", "err");
      }
    });

    function renderResults(results) {
      resultsEl.innerHTML = "";
      if (!results.length) return;
      results.forEach((r) => {
        const li = row(r);
        const add = document.createElement("button");
        add.type = "button";
        add.textContent = "Add";
        add.addEventListener("click", () => addItem(r, add));
        li.appendChild(add);
        resultsEl.appendChild(li);
      });
    }

    async function addItem(r, btn) {
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Adding…";
      }
      try {
        const res = await mutate(() =>
          writeApi(itemPath(), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...r, source: cfg.source, note: "" }),
          })
        );
        // Button reflects the ADD (which succeeded). Render the new list straight
        // from the write response — no stale KV re-read.
        if (btn) btn.textContent = "Added ✓";
        setStatus(`Added “${r.title}”.`, "ok");
        applyWriteResult(res);
      } catch (err) {
        setStatus("Add failed — try again.", "err");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Add";
        }
      }
    }

    // Every write endpoint returns the full, authoritative `items` array. Render
    // from it directly so the list reflects the write instantly. We deliberately
    // do NOT re-read after a write (KV reads are edge-cached ~60s and can return
    // the pre-write list). Falls back to a read only if an endpoint didn't
    // return items.
    function applyWriteResult(res) {
      writeRendered = true;
      if (res && Array.isArray(res.items)) renderList(res.items);
      else load();
    }

    // guardInitial: when true (the on-load read), yield if a write has already
    // painted — the write's response is fresher than this edge-cached read.
    async function load(guardInitial) {
      try {
        const { items } = await api(cfg.readPath + (cfg.readPath.includes("?") ? "&" : "?") + bust());
        if (guardInitial && writeRendered) return;
        renderList(items || []);
      } catch (err) {
        if (guardInitial && writeRendered) return;
        listEl.innerHTML = '<li class="empty">Could not load the list.</li>';
      }
      loaded = true;
    }

    function renderList(items) {
      countEl.textContent = items.length ? `(${items.length})` : "";
      listEl.innerHTML = "";
      if (!items.length) {
        listEl.innerHTML = `<li class="empty">${cfg.emptyText}</li>`;
        return;
      }
      if (cfg.grouped) {
        // One labelled section per non-empty category, in CATEGORY_ORDER.
        CATEGORY_ORDER.forEach((c) => {
          const inCat = items.filter((it) => it.kind === c.key);
          if (!inCat.length) return;
          const head = document.createElement("li");
          head.className = "group";
          head.textContent = `${c.label} (${inCat.length})`;
          listEl.appendChild(head);
          inCat.forEach((it) => listEl.appendChild(listRow(it)));
        });
      } else {
        items.forEach((it) => listEl.appendChild(listRow(it)));
      }
    }

    function listRow(it) {
      const li = row(it);
      const note = document.createElement("input");
      note.className = "row__note";
      note.type = "text";
      note.maxLength = 280;
      note.placeholder = "Add a note (e.g. “Best series of the year”)";
      note.value = it.note || "";
      let last = note.value;
      note.addEventListener("blur", async () => {
        const val = note.value;
        if (val === last) return;
        // Commit `last` only AFTER a successful save. If the save fails, `last`
        // stays at the old value, so re-blurring the same text retries instead
        // of being silently skipped by the equality guard above.
        if (await saveNote(it, val)) last = val;
      });
      li.querySelector(".row__meta").appendChild(note);

      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "row__rm";
      rm.textContent = "Remove";
      rm.addEventListener("click", () => removeItem(it));
      li.appendChild(rm);
      return li;
    }

    // Returns true on success, false on failure, so the blur handler knows
    // whether to commit `last` (and thus whether a re-blur should retry).
    async function saveNote(it, note) {
      setStatus("Saving note…");
      try {
        await mutate(() =>
          writeApi(itemPath(), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...it, note }),
          })
        );
        setStatus("Note saved.", "ok");
        return true;
      } catch (err) {
        setStatus("Could not save note — retry by editing again.", "err");
        return false;
      }
    }

    async function removeItem(it) {
      if (!confirm(`Remove “${it.title}” from the list?`)) return;
      try {
        const res = await mutate(() =>
          writeApi(itemPath("id=" + encodeURIComponent(it.id)), { method: "DELETE" })
        );
        setStatus(`Removed “${it.title}”.`, "ok");
        applyWriteResult(res);
      } catch (err) {
        setStatus("Remove failed.", "err");
      }
    }

    return { load, applyWriteResult, isLoaded: () => loaded };
  }

  // ---- the two lists -------------------------------------------------------
  const attention = createList({
    formId: "search-form",
    kindId: "kind",
    qId: "q",
    resultsId: "results",
    listId: "published",
    countId: "count",
    readPath: "/api/attention",
    list: null, // default "published"
    source: "manual",
    grouped: false,
    emptyText: "Nothing yet. Search above to add your first item.",
  });

  const favorites = createList({
    formId: "fav-search-form",
    kindId: "fav-kind",
    qId: "fav-q",
    resultsId: "fav-results",
    listId: "fav-list",
    countId: "fav-count",
    readPath: "/api/favorites",
    list: "favorites",
    source: "manual",
    grouped: true,
    emptyText: "No favorites yet. Search above to add your first pick.",
  });

  // ---- tab switcher --------------------------------------------------------
  // Favorites loads lazily on first open (so the page doesn't fetch a list it
  // may never show); afterward its DOM persists and writes keep it fresh.
  const tabBtns = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  const panels = Array.prototype.slice.call(document.querySelectorAll("[data-panel]"));
  function activateTab(name) {
    tabBtns.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach((p) => {
      p.hidden = p.dataset.panel !== name;
    });
    if (name === "favorites" && !favorites.isLoaded()) favorites.load();
  }
  tabBtns.forEach((t) => t.addEventListener("click", () => activateTab(t.dataset.tab)));

  // ---- publish (rebuild — both lists) -------------------------------------
  const publishBtn = $("publish");
  publishBtn.addEventListener("click", async () => {
    publishBtn.disabled = true;
    setStatus("Triggering rebuild…");
    try {
      // Through mutate() so any in-flight write (a note save, an add) settles
      // before the rebuild fires — the build reads the just-written lists.
      await mutate(() => api("/api/admin/publish", { method: "POST" }));
      setStatus("Rebuild started — live in ~40s.", "ok");
    } catch (err) {
      setStatus("Publish failed.", "err");
    } finally {
      setTimeout(() => {
        publishBtn.disabled = false;
      }, 3000);
    }
  });

  // ---- goodreads sync (Attention only) ------------------------------------
  // Mirror the Goodreads currently-reading shelf into the attention list. Runs
  // quietly on load (so books show up to annotate) and loudly from the button.
  // The POST is serialized via mutate() so it can't race a manual Add.
  const syncBtn = $("sync-goodreads");
  async function runGoodreadsSync(manual) {
    if (syncBtn) {
      syncBtn.disabled = true;
      if (manual) syncBtn.textContent = "Syncing…";
    }
    if (manual) setStatus("Syncing Goodreads…");
    try {
      // writeApi: a KV write-rate 429 is retried with backoff (the sync is a
      // serialized, idempotent full-array put, so retry is safe).
      const r = await mutate(() => writeApi("/api/admin/sync-goodreads", { method: "POST" }));
      if (manual) {
        const added = r && typeof r.added === "number" ? r.added : 0;
        const total = r && typeof r.total === "number" ? r.total : "?";
        setStatus(
          r && r.skipped === "parsed-empty"
            ? `Goodreads shelf came back empty — kept all ${total} tracked item(s), nothing written.`
            : added > 0
              ? `Goodreads synced — ${added} new book(s), ${total} total.`
              : `Goodreads synced — no new books (${total} total).`,
          "ok"
        );
      }
      // Only a sync that actually WROTE (changed:true) is authoritative — render
      // from it and claim the write-paint. A no-op sync (changed:false) performed
      // no put; its `items` is just another KV read, so rendering from it AND
      // claiming the paint would let a stale no-op suppress the genuine initial
      // read. For a no-op, the stored list is unchanged, so leave the initial
      // read / prior paint — it's already correct. (A response missing `changed`
      // falls through to render, preserving old behavior.)
      if (r && r.changed === false) {
        // no-op: status only (set above for manual); do not render or claim paint
      } else {
        attention.applyWriteResult(r);
      }
    } catch (err) {
      if (manual) setStatus("Goodreads sync failed — try again.", "err");
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        if (manual) syncBtn.textContent = "Sync Goodreads";
      }
    }
  }
  if (syncBtn) syncBtn.addEventListener("click", () => runGoodreadsSync(true));

  // ---- review inbox (Trakt suggestions — Attention only) ------------------
  const inboxEl = $("suggestions");
  const inboxCountEl = $("inbox-count");

  async function loadSuggestions() {
    if (!inboxEl) return;
    try {
      const { results } = await api("/api/admin/suggestions?" + bust());
      renderSuggestions(results || []);
    } catch (err) {
      inboxEl.innerHTML = '<li class="empty">Inbox unavailable.</li>';
    }
  }

  // Single source of truth for the inbox count: derive it from the live rows so
  // it stays correct after Publish/Dismiss removes a row (not just on render).
  function updateInboxCount() {
    if (!inboxCountEl) return;
    const n = inboxEl.querySelectorAll("li.row").length;
    inboxCountEl.textContent = n ? `(${n})` : "";
    if (!n && !inboxEl.querySelector(".empty")) {
      inboxEl.innerHTML = '<li class="empty">Nothing to review.</li>';
    }
  }

  function renderSuggestions(items) {
    inboxEl.innerHTML = "";
    if (!items.length) {
      inboxEl.innerHTML = '<li class="empty">Nothing to review.</li>';
      updateInboxCount();
      return;
    }
    items.forEach((s) => {
      const li = row(s);
      const pub = document.createElement("button");
      pub.type = "button";
      pub.textContent = "Publish";
      pub.addEventListener("click", () => publishSuggestion(s, li, pub));
      li.appendChild(pub);

      const dis = document.createElement("button");
      dis.type = "button";
      dis.className = "row__rm";
      dis.textContent = "Dismiss";
      dis.addEventListener("click", () => dismissSuggestion(s, li));
      li.appendChild(dis);

      inboxEl.appendChild(li);
    });
    updateInboxCount();
  }

  async function publishSuggestion(s, li, btn) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Publishing…";
    }
    try {
      const res = await mutate(() =>
        writeApi("/api/admin/item", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...s, source: "trakt", note: "" }),
        })
      );
      setStatus(`Published “${s.title}”.`, "ok");
      if (li) li.remove();
      updateInboxCount();
      attention.applyWriteResult(res);
    } catch (err) {
      setStatus("Publish failed.", "err");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Publish";
      }
    }
  }

  async function dismissSuggestion(s, li) {
    try {
      await mutate(() =>
        writeApi("/api/admin/dismiss", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: s.id }),
        })
      );
      setStatus(`Dismissed “${s.title}”.`, "ok");
      if (li) li.remove();
      updateInboxCount();
    } catch (err) {
      setStatus("Dismiss failed.", "err");
    }
  }

  // ---- init ----------------------------------------------------------------
  // Attention is the default tab: paint its list fast (guarded read) AND fire
  // the quiet Goodreads sync immediately — so it's already queued on the write
  // chain before any "Push to site" click, guaranteeing publish bakes the synced
  // shelf. The guarded read yields if the sync (a write) paints first, so the
  // two can't fight over the last paint regardless of which resolves first.
  // Favorites loads on first tab open (see activateTab).
  loadSuggestions();
  attention.load(true);
  runGoodreadsSync(false);
})();

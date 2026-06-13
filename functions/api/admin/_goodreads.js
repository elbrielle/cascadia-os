/* ============================================================================
   functions/api/admin/_goodreads.js  —  shared Goodreads → KV sync (Phase 2)
   ----------------------------------------------------------------------------
   NOT a route: the leading underscore tells Cloudflare Pages Functions to skip
   this file for routing, so it's import-only shared code. Used by
   sync-goodreads.js (the manual/auto sync route). The admin UI runs it on page
   load and from the "Sync Goodreads" button; publish.js does NOT sync (it is a
   pure deploy-hook trigger), so the shelf is current in KV before any rebuild.

   syncGoodreads(env) mirrors Elisha's Goodreads "currently-reading" shelf into
   the ATTENTION KV `published` array as source:"goodreads" items:
     - new shelf books are added (note empty, ready to annotate later),
     - books already present keep their note / addedAt / order (only the
       feed-derived title/author/cover/link refresh),
     - source:"goodreads" books that have left the shelf are dropped,
     - every non-goodreads item (manual films/shows, trakt) is left untouched.

   Resilience: a Goodreads fetch failure returns {ok:false} WITHOUT touching KV
   — we never interpret "unreachable" as "empty shelf" and wipe the books. The
   same goes for a 200 with a non-RSS body or a feed whose items no longer
   parse (both throw in fetchShelfBooks), and for an all-empty parse while
   tracked books exist (skipped:"parsed-empty", no write).

   The RSS is parsed dependency-free (no rss-parser in the Workers runtime); the
   regex below is validated against the live feed. Book links are built from
   <book_id> (the canonical /book/show/<id> URL), sidestepping the review-link
   the feed puts in <link>.
   ========================================================================== */

import { isRateLimit } from "./_kv.js";
import { readArray } from "../_http.js";

const KEY = "published";
const SHELF_URL =
  "https://www.goodreads.com/review/list_rss/12934617?shelf=currently-reading";
const UA = "elishalucero.com (Cascadia OS portfolio admin)";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BOOKS = 12;

// Goodreads suffixes titles with " (Series, #N)" — strip for clean display.
function cleanTitle(t = "") {
  return t.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, "").trim();
}

// Pull one tag's inner text, tolerating both CDATA-wrapped and plain values.
function tagText(block, name) {
  const m = block.match(
    new RegExp(`<${name}>(?:\\s*<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>\\s*)?</${name}>`, "i")
  );
  return m ? m[1].trim() : "";
}

function parseShelf(xml, limit = MAX_BOOKS) {
  const out = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) && out.length < limit) {
    const block = m[1];
    const bookId = (block.match(/<book_id>(\d+)<\/book_id>/) || [])[1];
    if (!bookId) continue;
    const title = cleanTitle(tagText(block, "title")).slice(0, 300);
    if (!title) continue;
    const author = tagText(block, "author_name").slice(0, 200);
    const cover =
      tagText(block, "book_large_image_url") ||
      tagText(block, "book_medium_image_url") ||
      tagText(block, "book_image_url") ||
      "";
    out.push({
      id: `book:goodreads:${bookId}`,
      kind: "book",
      title,
      detail: author,
      image: cover ? cover.replace(/^http:\/\//i, "https://") : null,
      link: `https://www.goodreads.com/book/show/${bookId}`,
      source: "goodreads",
    });
  }
  return out;
}

async function fetchShelfBooks() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const res = await fetch(SHELF_URL, {
    headers: { "User-Agent": UA },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  if (!res.ok) throw new Error("goodreads " + res.status);
  const xml = await res.text();
  // A 200 carrying a non-RSS body (HTML interstitial, error page) must read as
  // a fetch failure, not an empty shelf — otherwise the merge below would drop
  // every book from KV.
  if (!/<rss[\s>]/i.test(xml)) throw new Error("goodreads non-rss body");
  const items = parseShelf(xml);
  // Real RSS whose <item> blocks all fail to parse means the feed format
  // drifted (renamed tags etc.) — also a failure. Only a feed with zero
  // <item>s is a genuinely empty shelf.
  if (items.length === 0 && /<item>/i.test(xml)) throw new Error("goodreads parse drift");
  return items;
}

// env.ATTENTION is guaranteed bound by the time this runs (syncGoodreads guards
// it first), so readArray never returns null here; `|| []` keeps it defensive.
async function loadPublished(env) {
  return (await readArray(env.ATTENTION, KEY)) || [];
}

export async function syncGoodreads(env) {
  if (!env || !env.ATTENTION) return { ok: false, error: "kv-unbound" };

  let shelf;
  try {
    shelf = await fetchShelfBooks();
  } catch (err) {
    // Leave KV untouched — never treat "feed unreachable" as "shelf empty".
    return { ok: false, error: String((err && err.message) || err) };
  }

  const existing = await loadPublished(env);

  // Never let an all-empty parse wipe tracked books (and their curated notes /
  // addedAt). If the shelf genuinely emptied, the next sync that sees ANY book
  // prunes departed ones normally; erring toward never-wipe matches the
  // resilience contract in the header. changed:false keeps the admin UI on its
  // existing render (same contract as a no-op sync).
  if (shelf.length === 0 && existing.some((it) => it.source === "goodreads")) {
    return {
      ok: true,
      synced: 0,
      added: 0,
      removed: 0,
      changed: false,
      skipped: "parsed-empty",
      total: existing.length,
      items: existing,
    };
  }

  const byId = new Map(existing.map((it) => [it.id, it]));
  const shelfIds = new Set(shelf.map((b) => b.id));
  const now = new Date().toISOString();

  // Refresh feed-derived fields on books we already track; collect brand-new ones.
  const fresh = [];
  for (const b of shelf) {
    const prev = byId.get(b.id);
    if (prev) {
      byId.set(b.id, {
        ...prev,
        title: b.title,
        detail: b.detail,
        image: b.image,
        link: b.link,
        source: "goodreads",
      });
    } else {
      fresh.push({ ...b, note: "", addedAt: now });
    }
  }

  // Rebuild: keep original order, drop goodreads books no longer on the shelf,
  // keep everything else untouched, then prepend the brand-new books (newest-first).
  let removed = 0;
  const kept = [];
  for (const it of existing) {
    if (it.source === "goodreads" && !shelfIds.has(it.id)) {
      removed++;
      continue;
    }
    kept.push(byId.get(it.id) || it);
  }
  const next = [...fresh, ...kept];

  // Only write when the merged list actually differs from what's stored. The
  // admin runs this sync on EVERY page load, and a no-op write is the most
  // frequent automatic read-modify-write on the shared `published` key — i.e.
  // the most likely thing to clobber a concurrent edit under KV's eventual
  // consistency. Skipping the write when nothing changed removes that window
  // for the common case (no shelf change) and spares the ~1 write/sec budget.
  const changed = JSON.stringify(next) !== JSON.stringify(existing);
  if (changed) {
    try {
      await env.ATTENTION.put(KEY, JSON.stringify(next));
    } catch (err) {
      // Rate-limit → flag so the route returns 429 (client retries with backoff).
      return { ok: false, error: String((err && err.message) || err), rateLimited: isRateLimit(err) };
    }
  }
  // Include the full merged list so the admin UI renders from this response
  // rather than re-reading the (edge-cached, possibly-stale) GET /api/attention.
  return { ok: true, synced: shelf.length, added: fresh.length, removed, changed, total: next.length, items: next };
}

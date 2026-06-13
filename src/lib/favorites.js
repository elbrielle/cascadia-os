// ============================================================================
//  favorites.js  —  build-time read of the curated "Favorites" collection
// ----------------------------------------------------------------------------
//  Sibling of attention.js. The curation admin (/log-admin, Favorites tab)
//  writes items into Cloudflare KV (key "favorites"); the public Function
//  GET /api/favorites reads them back. This module fetches that endpoint at
//  build time and bakes the result into the About page's Favorites explorer —
//  same resilience contract as attention.js: never throw, return [] on any
//  failure so the build stays green and the explorer simply renders empty.
//
//  Why fetch our own URL instead of reading KV directly? The Astro build runs
//  in a generic CI container with no KV binding (bindings exist only for
//  Functions at runtime). Fetching the deployed endpoint is the clean way in;
//  the previously-live deploy serves it, so there's no chicken-and-egg beyond
//  the very first build (which just sees [] and falls back).
//
//  FAVORITES_ENDPOINT overrides the URL (handy for previews); defaults to prod.
// ============================================================================

const ENDPOINT = process.env.FAVORITES_ENDPOINT || "https://elishalucero.com/api/favorites";
const FETCH_TIMEOUT_MS = 10_000;

// Memoize the IN-FLIGHT fetch (same pattern as attention.js). getFavorites has a
// single caller today (the About explorer), so this is a consistency/defensive
// sibling rather than a measured win — it keeps both build-time readers identical
// and dedupes for free if a second caller is ever added. Resolves to the items
// array; [] on any failure. getFavorites treats it as read-only (filter/slice copy).
let _itemsPromise = null;
function fetchItemsOnce() {
  if (_itemsPromise) return _itemsPromise;
  _itemsPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(ENDPOINT, { signal: controller.signal }).finally(() =>
        clearTimeout(timer)
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data && data.items) ? data.items : [];
    } catch {
      return [];
    }
  })();
  return _itemsPromise;
}

// kinds: optional allow-list (e.g. ["game"]) to filter to one collection.
// limit: max items returned after filtering (favorites are an all-time list, so
//        the default is generous).
export async function getFavorites(kinds = null, limit = 200) {
  let items = await fetchItemsOnce();
  if (Array.isArray(kinds)) items = items.filter((it) => kinds.includes(it.kind));
  return items.slice(0, limit);
}

// Group a flat favorites array into ordered collections for the explorer.
// Returns [{ key, label, items }] in CATEGORY_ORDER, skipping empty groups
// unless includeEmpty is set (the admin wants all tabs; the public page hides
// empties). Kept here so the page and any future consumer share one definition.
export const CATEGORIES = [
  { key: "book", label: "Books" },
  { key: "film", label: "Films" },
  { key: "show", label: "Shows" },
  { key: "game", label: "Games" },
  { key: "album", label: "Music" },
  { key: "paper", label: "Articles" },
];

export function groupByCategory(items, { includeEmpty = false } = {}) {
  const list = Array.isArray(items) ? items : [];
  return CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    items: list.filter((it) => it.kind === c.key),
  })).filter((g) => includeEmpty || g.items.length > 0);
}

// ============================================================================
//  attention.js  —  build-time read of the curated "Attention Log" list
// ----------------------------------------------------------------------------
//  The curation admin (/log-admin) writes items into a Cloudflare KV store; the
//  public Function GET /api/attention reads them back. This module fetches that
//  endpoint at build time and bakes the result into the About page — same
//  pattern and resilience contract as goodreads.js / trakt.js: never throw,
//  return [] on any failure so the build stays green and the section hides.
//
//  Why fetch our own URL instead of reading KV directly? The Astro build runs
//  in a generic CI container with no KV binding (bindings exist only for
//  Functions at runtime). Fetching the deployed endpoint is the clean way in;
//  the previously-live deploy serves it, so there's no chicken-and-egg beyond
//  the very first build (which just sees [] and falls back).
//
//  ATTENTION_ENDPOINT overrides the URL (handy for previews); defaults to prod.
// ============================================================================

const ENDPOINT = process.env.ATTENTION_ENDPOINT || "https://elishalucero.com/api/attention";
const FETCH_TIMEOUT_MS = 10_000;

// Fetch the full list at most once per build, memoizing the IN-FLIGHT promise so
// the 5 concurrent getAttention() calls in AttentionLog share ONE round-trip
// instead of 5. (substack.js caches the resolved value, which only dedupes its
// sequential getPosts/getTags pair; caching the promise also covers concurrent
// Promise.all callers.) Resolves to the items array; [] on any failure. The
// resolved array is treated as read-only by getAttention (filter/slice copy it).
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

// kinds: optional allow-list (e.g. ["film","show"]) to filter to one section.
// limit: max items returned after filtering.
export async function getAttention(kinds = null, limit = 12) {
  let items = await fetchItemsOnce();
  if (Array.isArray(kinds)) items = items.filter((it) => kinds.includes(it.kind));
  return items.slice(0, limit);
}

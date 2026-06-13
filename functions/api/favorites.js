/* ============================================================================
   functions/api/favorites.js  —  Cloudflare Pages Function: read the curated
   "Favorites" collection (GET /api/favorites)
   ----------------------------------------------------------------------------
   PUBLIC, un-gated on purpose (same contract as api/attention.js): this returns
   only data already shown on the public About page, and the build step fetches
   this URL to bake the Favorites explorer (see src/lib/favorites.js). The write
   side lives under /api/admin/* (item.js with ?list=favorites) and IS gated by
   Cloudflare Access.

   Storage reuses the same `ATTENTION` KV namespace as the Attention Log, but a
   SEPARATE key: "favorites" (a JSON array of items). All-time favorites are
   hand-curated and stable; the live attention.log lives under key "published".
   Keeping them in distinct keys means a Favorites write can never clobber the
   live feed and vice-versa.

   Fail-soft: if KV isn't bound yet, return an empty list so the build stays
   green and the explorer simply renders empty. no-store so the deploy-hook
   rebuild never reads a cached (stale) copy right after a write.
   ========================================================================== */

import { jsonResponse, readArray } from "./_http.js";

export async function onRequestGet({ env }) {
  // readArray returns null when KV isn't bound; fail-soft to an empty list so
  // the build stays green and the explorer renders empty. The default headers
  // (content-type: application/json + cache-control: no-store) match what this
  // read served before — no-store is load-bearing (see header note).
  const items = (await readArray(env.ATTENTION, "favorites")) || [];
  return jsonResponse({ items });
}

/* ============================================================================
   functions/api/admin/sync-goodreads.js  —  Pages Function (Phase 2)
   POST /api/admin/sync-goodreads
   ----------------------------------------------------------------------------
   GATED: under /api/admin/*, protected by Cloudflare Access at the edge.

   Mirrors the Goodreads "currently-reading" shelf into the ATTENTION KV
   `published` array (see _goodreads.js for the merge rules). The admin UI calls
   this on load and from the "Sync Goodreads" button. (publish.js does NOT sync
   — it is a pure deploy-hook trigger.) Fail-soft: 503 if KV isn't bound, 429 if
   the KV write was rate-limited (client retries), 502 if Goodreads is
   unreachable (KV is left untouched in that case).
   ========================================================================== */

import { syncGoodreads } from "./_goodreads.js";
import { jsonResponse as json } from "../_http.js";

export async function onRequestPost({ env }) {
  const result = await syncGoodreads(env);
  if (result.ok) return json(result, 200);
  const status = result.rateLimited
    ? 429
    : result.error === "kv-unbound"
      ? 503
      : 502;
  return json(result, status);
}

/* ============================================================================
   functions/api/hits.js  —  Cloudflare Pages Function: visitor hit counter
   ----------------------------------------------------------------------------
   Maps to GET /api/hits. Increments a counter in a KV namespace bound to this
   Pages project as `HITS` and returns { count }. It is first-party and
   same-origin, so it needs NO CSP change (covered by connect-src 'self').

   ONE-TIME SETUP (Cloudflare dashboard):
     1. Workers & Pages → KV → Create a namespace (e.g. "cascadia-hits").
     2. Your Pages project → Settings → Functions → KV namespace bindings →
        Add binding with Variable name = HITS, pointed at that namespace.
     3. Redeploy. Until the binding exists this returns { count: null } and the
        client (system.js) shows its cosmetic fallback number instead.

   Note: KV has no atomic increment, so under heavy concurrency the count is
   approximate. That is fine for a portfolio visitor counter.

   Local `npm run dev` (Astro) has no Functions runtime, so /api/hits 404s
   there and the client falls back too — expected.
   ========================================================================== */

import { jsonResponse } from "./_http.js";

export async function onRequestGet({ env }) {
  const KEY = "visits";

  // KV not bound yet → fail soft so the client keeps its fallback display.
  // jsonResponse's defaults (content-type: application/json + cache-control:
  // no-store, status 200) match what this endpoint served before.
  if (!env.HITS) {
    return jsonResponse({ count: null, error: "kv-unbound" });
  }

  // Baseline: 242 prior unique visitors before the live counter existed. The
  // floor folds that in (and discards the few test hits from when the endpoint
  // first went live); once the count is past it, this is a no-op.
  const BASE = 242;
  let n = parseInt((await env.HITS.get(KEY)) || "0", 10);
  if (!Number.isFinite(n)) n = 0;
  if (n < BASE) n = BASE;
  n += 1;
  await env.HITS.put(KEY, String(n));

  return jsonResponse({ count: n });
}

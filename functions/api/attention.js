/* ============================================================================
   functions/api/attention.js  —  Cloudflare Pages Function: read the curated
   "Attention Log" list (GET /api/attention)
   ----------------------------------------------------------------------------
   PUBLIC, un-gated on purpose: this returns only data already shown on the
   public About page, and the site's build step fetches this URL to bake the
   "Recently watched" section (see src/lib/attention.js). The write side lives
   under /api/admin/* and IS gated by Cloudflare Access.

   Storage is a KV namespace bound to this Pages project as `ATTENTION`, key
   "published" holding a JSON array of items. Same fail-soft posture as
   functions/api/hits.js: if KV isn't bound yet, return an empty list so the
   build stays green and the section simply hides.

   ONE-TIME SETUP (Cloudflare dashboard):
     1. Workers & Pages → KV → Create a namespace (e.g. "cascadia-attention").
     2. Pages project → Settings → Functions → KV namespace bindings →
        Add binding: Variable name = ATTENTION, pointed at that namespace.
     3. Redeploy.

   no-store: the deploy-hook rebuild fetches this immediately after a write, so
   we never want a cached (stale) copy served back to the build.
   ========================================================================== */

import { jsonResponse, readArray } from "./_http.js";

export async function onRequestGet({ env }) {
  // readArray returns null when KV isn't bound; fail-soft to an empty list so
  // the build stays green and the section simply hides. The default headers
  // (content-type: application/json + cache-control: no-store) are exactly
  // what this read served before — no-store is load-bearing (see header note).
  const items = (await readArray(env.ATTENTION, "published")) || [];
  return jsonResponse({ items });
}

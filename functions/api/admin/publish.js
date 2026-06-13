/* ============================================================================
   functions/api/admin/publish.js  —  Pages Function: trigger a site rebuild
   (POST /api/admin/publish)
   ----------------------------------------------------------------------------
   GATED: under /api/admin/*, protected by Cloudflare Access at the edge.
   Fires the Cloudflare Pages deploy hook so curated edits in KV get baked into
   the static site. The hook URL is a server-side secret — never in client code.

   ONE-TIME SETUP (Cloudflare dashboard):
     1. Pages project → Settings → Builds & deployments → Deploy hooks →
        create one on `main`. Copy the URL.
     2. Pages project → Settings → Environment variables → add a secret
        DEPLOY_HOOK_URL with that URL.

   Publish is a PURE deploy-hook trigger — it does NOT write KV. It used to run
   the Goodreads sync here first, but that was a read-modify-write of the shared
   `published` key, and KV reads are edge-cached (~60s): the sync could read a
   stale list and write it back over an edit the user had just made (e.g. a note
   added seconds earlier), silently clobbering it. The shelf is already kept
   current by the admin's on-load auto-sync and the "Sync Goodreads" button
   (both write KV and render from their own response), so by the time the user
   pushes, `published` already holds what the build will bake. Keeping publish
   write-free removes the clobber path entirely.
   ========================================================================== */

import { jsonResponse as json } from "../_http.js";

export async function onRequestPost({ env }) {
  if (!env.DEPLOY_HOOK_URL) return json({ error: "no-hook" }, 503);
  try {
    const r = await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
    // Surface a deploy-hook failure as an error STATUS, not a 200 with ok:false.
    // The client's api() only throws on !res.ok, so a 200 here would make a
    // failed rebuild read as success ("Rebuild started."). 502 = upstream hook
    // rejected us; the client then shows the error and the button re-enables.
    if (!r.ok) return json({ ok: false, error: "deploy-hook-failed", status: r.status }, 502);
    return json({ ok: true, status: r.status });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) }, 502);
  }
}

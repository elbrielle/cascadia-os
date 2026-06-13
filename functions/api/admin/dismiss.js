/* ============================================================================
   functions/api/admin/dismiss.js  —  Pages Function (Phase 3)
   POST /api/admin/dismiss   body: { id }
   ----------------------------------------------------------------------------
   GATED: under /api/admin/*, protected by Cloudflare Access at the edge.

   Adds a suggestion id to the ATTENTION KV `dismissed` array so it stops
   showing up in the review inbox (see _trakt.js, which filters it out). The
   list is capped so it can't grow without bound. 503 if KV isn't bound.
   ========================================================================== */

import { isRateLimit } from "./_kv.js";
import { jsonResponse as json, readArray } from "../_http.js";

const KEY = "dismissed";
const MAX_DISMISSED = 500;

export async function onRequestPost({ env, request }) {
  if (!env.ATTENTION) return json({ error: "kv-unbound" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-json" }, 400);
  }

  const id = String((body && body.id) || "").slice(0, 120).trim();
  if (!id) return json({ error: "missing-id" }, 400);

  // env.ATTENTION is guaranteed bound here (guarded above), so readArray never
  // returns null; `|| []` is belt-and-suspenders to keep this defensive.
  let arr = (await readArray(env.ATTENTION, KEY)) || [];

  if (!arr.includes(id)) arr.unshift(id);
  if (arr.length > MAX_DISMISSED) arr = arr.slice(0, MAX_DISMISSED);

  try {
    await env.ATTENTION.put(KEY, JSON.stringify(arr));
  } catch (err) {
    return json(
      { error: "kv-write-failed", detail: String((err && err.message) || err) },
      isRateLimit(err) ? 429 : 503
    );
  }
  return json({ ok: true, count: arr.length });
}

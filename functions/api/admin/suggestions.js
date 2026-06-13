/* ============================================================================
   functions/api/admin/suggestions.js  —  Pages Function (Phase 3)
   GET /api/admin/suggestions
   ----------------------------------------------------------------------------
   GATED: under /api/admin/*, protected by Cloudflare Access at the edge.

   Returns Trakt recently-watched candidates for the admin "Review inbox",
   minus anything already published or dismissed (see _trakt.js). Always
   fail-soft: any error returns an empty list with HTTP 200 so the inbox just
   shows "nothing to review" rather than erroring. Empty until the Plex→Trakt
   sync feeds Trakt with data.
   ========================================================================== */

import { getTraktSuggestions } from "./_trakt.js";
import { jsonResponse as json } from "../_http.js";

export async function onRequestGet({ env }) {
  try {
    const results = await getTraktSuggestions(env);
    return json({ results });
  } catch (err) {
    return json({ results: [], error: String((err && err.message) || err) });
  }
}

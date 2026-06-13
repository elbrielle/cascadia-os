/* ============================================================================
   functions/api/_http.js  —  shared HTTP / KV-read helpers
   ----------------------------------------------------------------------------
   NOT a route (leading underscore): import-only shared code, sibling to the
   route files in functions/api/ (admin routes import it as "../_http.js").

   jsonResponse(obj, status = 200, headers = {})
     Builds a JSON Response. Defaults to `content-type: application/json` +
     `cache-control: no-store` — byte-identical to the `json` helper that the
     admin routes each defined inline. The `headers` param is spread LAST, so a
     caller can override any default (e.g. a public read that wants CDN caching
     can pass its own `cache-control`). With no `headers` arg the output matches
     the old inline helpers exactly.

   readArray(binding, key)
     Reads a KV key and coerces it to an array. Mirrors the hand-written block
     repeated across the read/admin routes:
       - no binding            → null  (caller decides: 503, or fall-soft to [])
       - missing / empty value → []
       - valid JSON array      → the array
       - non-array JSON        → []
       - parse failure         → []
     Returning null (not []) for the unbound case preserves item.js's ability to
     distinguish "KV not configured" (→ 503) from "empty list".
   ========================================================================== */

export const jsonResponse = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...headers,
    },
  });

export async function readArray(binding, key) {
  if (!binding) return null; // not configured — caller decides what to do
  const raw = await binding.get(key);
  try {
    const a = raw ? JSON.parse(raw) : [];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

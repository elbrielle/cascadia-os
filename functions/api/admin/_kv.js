/* ============================================================================
   functions/api/admin/_kv.js  —  shared KV helpers
   ----------------------------------------------------------------------------
   NOT a route (leading underscore): import-only shared code.

   isRateLimit(err): Cloudflare Workers KV allows ~1 write/sec to a single key.
   When a write Function exceeds that, env.ATTENTION.put() throws — and without
   handling, that surfaces to the browser as a generic 500, so the admin UI's
   429-retry (writeApi() in log-admin.js) never engages. Write routes call this
   to recognize a rate-limit-shaped error and return HTTP 429 instead, which the
   client then retries with backoff. Match defensively on the message text since
   the runtime doesn't expose a typed error code.
   ========================================================================== */

export function isRateLimit(err) {
  const m = String((err && err.message) || err).toLowerCase();
  return (
    m.includes("429") ||
    m.includes("rate limit") ||
    m.includes("rate-limit") ||
    m.includes("too many")
  );
}

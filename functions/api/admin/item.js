/* ============================================================================
   functions/api/admin/item.js  —  Pages Function: upsert / delete a curated item
   ----------------------------------------------------------------------------
   POST   /api/admin/item        add or edit an item (body = the item JSON)
   DELETE /api/admin/item?id=...  remove an item by id

   GATED: under /api/admin/*, protected by Cloudflare Access at the edge.
   Storage is the `ATTENTION` KV namespace, key "published" (a JSON array).

   Everything written here is sanitized: kind is allow-listed, strings are
   length-capped, and URLs must be https. Astro escapes on render, but we
   validate at the storage boundary anyway so nothing odd ever lands in KV.
   ========================================================================== */

import { isRateLimit } from "./_kv.js";
import { jsonResponse as json, readArray } from "../_http.js";

// Two lists share the ATTENTION namespace under different keys: the live
// attention.log ("published") and the all-time Favorites ("favorites"). The
// ?list= query param selects one; any other value falls back to "published"
// so the existing attention.log admin keeps working unchanged.
const LIST_KEYS = { published: "published", favorites: "favorites" };
const listKey = (request) =>
  LIST_KEYS[new URL(request.url).searchParams.get("list")] || "published";
const KINDS = ["film", "show", "book", "album", "game", "paper"];
const SOURCES = ["manual", "goodreads", "trakt"];

// readArray returns null when the binding is unbound (→ caller answers 503),
// otherwise the parsed array (non-array / parse-failure coerced to []).
const load = (env, key) => readArray(env.ATTENTION, key);

const save = (env, key, items) => env.ATTENTION.put(key, JSON.stringify(items));

export async function onRequestPost({ env, request }) {
  const key = listKey(request);
  const items = await load(env, key);
  if (items === null) return json({ error: "kv-unbound" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-json" }, 400);
  }

  const clean = sanitize(body);
  if (!clean) return json({ error: "invalid-item" }, 400);

  const idx = items.findIndex((x) => x.id === clean.id);
  if (idx >= 0) {
    // Edit: keep the original addedAt; apply the rest (note, etc.).
    items[idx] = { ...items[idx], ...clean, addedAt: items[idx].addedAt || clean.addedAt };
  } else {
    items.unshift(clean); // newest first
  }

  try {
    await save(env, key, items);
  } catch (err) {
    // KV write failed. A rate-limit (~1 write/sec per key) → 429 so the client's
    // writeApi() retries with backoff; anything else → 503 (retryable upstream).
    return json(
      { error: "kv-write-failed", detail: String((err && err.message) || err) },
      isRateLimit(err) ? 429 : 503
    );
  }
  // Return the full, just-written list so the admin UI can render from this
  // response directly. It must NOT re-read GET /api/attention afterward: KV
  // reads are edge-cached (~60s) and can hand back the pre-write list.
  return json({ ok: true, items, item: items[idx >= 0 ? idx : 0], count: items.length });
}

export async function onRequestDelete({ env, request }) {
  const key = listKey(request);
  const items = await load(env, key);
  if (items === null) return json({ error: "kv-unbound" }, 503);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "missing-id" }, 400);

  const next = items.filter((x) => x.id !== id);
  try {
    await save(env, key, next);
  } catch (err) {
    return json(
      { error: "kv-write-failed", detail: String((err && err.message) || err) },
      isRateLimit(err) ? 429 : 503
    );
  }
  // Return the full post-delete list (see the POST handler note re: KV caching).
  return json({ ok: true, items: next, count: next.length });
}

function sanitize(body) {
  if (!body || typeof body !== "object") return null;

  const id = String(body.id || "").slice(0, 120).trim();
  const kind = KINDS.includes(body.kind) ? body.kind : null;
  const title = String(body.title || "").slice(0, 300).trim();
  if (!id || !kind || !title) return null;

  const cap = (v, n) => (v == null ? "" : String(v).slice(0, n));
  const httpsOrNull = (u) => (/^https:\/\//i.test(String(u || "")) ? String(u).slice(0, 500) : null);

  return {
    id,
    kind,
    title,
    detail: cap(body.detail, 200),
    note: cap(body.note, 280),
    image: httpsOrNull(body.image),
    link: httpsOrNull(body.link) || "",
    source: SOURCES.includes(body.source) ? body.source : "manual",
    addedAt: new Date().toISOString(),
  };
}

/* ============================================================================
   functions/api/admin/_trakt.js  —  shared Trakt → review-inbox source (Phase 3)
   ----------------------------------------------------------------------------
   NOT a route (leading underscore): import-only shared code, used by
   suggestions.js. getTraktSuggestions(env) pulls Elisha's recently-watched
   films + shows from Trakt's public API and returns them as normalized
   candidate items, MINUS anything already in the curated `published` list or
   waved off in `dismissed`. The admin "Review inbox" renders these; ticking one
   publishes it (POST /api/admin/item, source:"trakt"); dismissing it adds its
   id to `dismissed` (POST /api/admin/dismiss).

   Ids match the manual-search scheme (`film|show:tmdb:<id>`) so a suggestion
   de-dupes against a title you already added by hand. This is the same fetch
   logic as src/lib/trakt.js, adapted to the Workers runtime (env vars, not
   process.env). It stays empty until the home-server Plex→Trakt sync feeds
   Trakt with data (see docs/plextraktsync-agent-spec.md) — fail-soft to [].
   ========================================================================== */

const TRAKT_API = "https://api.trakt.tv";
const TMDB_IMG = "https://image.tmdb.org/t/p/w185";
const UA = "elishalucero.com (Cascadia OS portfolio admin)";
const FETCH_TIMEOUT_MS = 10_000;

function fetchJSON(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  // Trakt's API sits behind Cloudflare, which 403s requests without a UA.
  const withUA = { "User-Agent": UA, ...headers };
  return fetch(url, { headers: withUA, signal: controller.signal })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("HTTP " + res.status))))
    .finally(() => clearTimeout(timer));
}

// Map a Trakt history entry to the normalized item shape (stable id first).
function mapItem(it) {
  if (it.type === "movie" && it.movie) {
    const ids = it.movie.ids || {};
    const tmdbId = ids.tmdb || null;
    return {
      id: tmdbId ? `film:tmdb:${tmdbId}` : `film:trakt:${ids.slug || ids.trakt || ""}`,
      kind: "film",
      title: it.movie.title,
      detail: it.movie.year ? String(it.movie.year) : "",
      image: null,
      link: ids.slug ? `https://trakt.tv/movies/${ids.slug}` : "https://trakt.tv",
      tmdbId,
    };
  }
  if (it.type === "episode" && it.show) {
    const ids = it.show.ids || {};
    const tmdbId = ids.tmdb || null;
    return {
      id: tmdbId ? `show:tmdb:${tmdbId}` : `show:trakt:${ids.slug || ids.trakt || ""}`,
      kind: "show",
      title: it.show.title,
      detail: "", // just the show — a binge collapses to one row via dedupe
      image: null,
      link: ids.slug ? `https://trakt.tv/shows/${ids.slug}` : "https://trakt.tv",
      tmdbId,
    };
  }
  return null;
}

// Collapse repeats (a show binge → one suggestion). Keeps the most recent.
function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it.id || seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

// Best-effort TMDB poster (Trakt's free tier has none). Failure → text row.
async function addPoster(item, tmdbKey) {
  if (!tmdbKey || !item.tmdbId) return;
  const path = item.kind === "film" ? "movie" : "tv";
  try {
    const data = await fetchJSON(
      `https://api.themoviedb.org/3/${path}/${item.tmdbId}?api_key=${tmdbKey}`
    );
    if (data && data.poster_path) item.image = `${TMDB_IMG}${data.poster_path}`;
  } catch (_) {
    /* leave image null */
  }
}

async function loadIdSet(env) {
  // Returns a Set of ids to exclude: everything already published + dismissed.
  const taken = new Set();
  if (!env || !env.ATTENTION) return taken;
  try {
    const pubRaw = await env.ATTENTION.get("published");
    const pub = pubRaw ? JSON.parse(pubRaw) : [];
    if (Array.isArray(pub)) for (const x of pub) if (x && x.id) taken.add(x.id);
  } catch (_) {}
  try {
    const disRaw = await env.ATTENTION.get("dismissed");
    const dis = disRaw ? JSON.parse(disRaw) : [];
    if (Array.isArray(dis)) for (const id of dis) taken.add(id);
  } catch (_) {}
  return taken;
}

export async function getTraktSuggestions(env, limit = 12) {
  const clientId = env && env.TRAKT_CLIENT_ID;
  const username = env && env.TRAKT_USERNAME;
  if (!clientId || !username) return []; // not configured → empty inbox

  let history;
  try {
    history = await fetchJSON(
      `${TRAKT_API}/users/${encodeURIComponent(username)}/history?limit=${limit * 6}`,
      { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": clientId }
    );
  } catch (_) {
    return []; // Trakt unreachable / private history → empty inbox
  }

  let items = dedupe((Array.isArray(history) ? history : []).map(mapItem).filter(Boolean));
  const taken = await loadIdSet(env);
  items = items.filter((it) => !taken.has(it.id)).slice(0, limit);

  const tmdbKey = env && env.TMDB_API_KEY;
  if (tmdbKey) await Promise.all(items.map((it) => addPoster(it, tmdbKey)));

  // Drop the internal tmdbId before returning — the UI only needs the item shape.
  return items.map(({ tmdbId, ...rest }) => rest);
}

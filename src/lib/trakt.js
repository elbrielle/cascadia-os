// ============================================================================
//  trakt.js  —  pull Elisha's recently-watched films + shows from Trakt
// ----------------------------------------------------------------------------
//  Unlike Goodreads (keyless public RSS), Trakt's API needs an app Client ID
//  sent as the `trakt-api-key` header, plus a PUBLIC watch history. Both the
//  Client ID and the username come from build-time env vars, so no credential
//  ever lands in the repo or in client HTML:
//
//      TRAKT_CLIENT_ID   — a registered app's Client ID
//                          (make one at https://trakt.tv/oauth/applications)
//      TRAKT_USERNAME    — your Trakt profile slug (trakt.tv/users/<slug>)
//      TMDB_API_KEY      — OPTIONAL. Trakt doesn't return poster images on the
//                          free tier, but its history items carry a TMDB id, so
//                          we resolve covers from TMDB when this key is set
//                          (free v3 key from themoviedb.org). No key → text rows.
//
//  Set these as Cloudflare Pages build env vars, and make your Trakt history
//  public (Settings → Privacy). Fetched at build time (same pattern as
//  goodreads.js / substack.js); refresh = rebuild. If the Trakt vars are
//  missing or Trakt is unreachable we return an empty list, so the build never
//  fails and the About page's "Recently watched" section simply hides.
// ============================================================================

const TRAKT_API = "https://api.trakt.tv";
const TMDB_IMG = "https://image.tmdb.org/t/p/w185"; // crisp at the ~46px slot
const FETCH_TIMEOUT_MS = 10_000;

const CLIENT_ID = process.env.TRAKT_CLIENT_ID || "";
const USERNAME = process.env.TRAKT_USERNAME || "";
const TMDB_API_KEY = process.env.TMDB_API_KEY || "";

export const TRAKT_PROFILE_URL = USERNAME
  ? `https://trakt.tv/users/${USERNAME}`
  : "https://trakt.tv";

// Small fetch helper with a hard timeout so a slow/hung upstream can't stall
// the whole build. Resolves parsed JSON; rejects on timeout or non-2xx.
function fetchJSON(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  // Trakt's API sits behind Cloudflare, which 403s requests that send no
  // User-Agent — and Node's built-in fetch sends none by default. Always set
  // one (curl works precisely because it does). Caller headers win.
  const withUA = { "User-Agent": "elishalucero.com (Cascadia OS portfolio)", ...headers };
  return fetch(url, { headers: withUA, signal: controller.signal })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("HTTP " + res.status))))
    .finally(() => clearTimeout(timer));
}

// Map a Trakt history entry to a flat shape the About page renders.
function mapItem(it) {
  if (it.type === "movie" && it.movie) {
    const ids = it.movie.ids || {};
    return {
      kind: "film",
      title: it.movie.title,
      detail: it.movie.year ? String(it.movie.year) : "",
      link: ids.slug ? `https://trakt.tv/movies/${ids.slug}` : TRAKT_PROFILE_URL,
      tmdbId: ids.tmdb || null,
      image: null,
      watchedAt: it.watched_at || null,
    };
  }
  if (it.type === "episode" && it.show) {
    const ids = it.show.ids || {};
    return {
      kind: "show",
      title: it.show.title,
      detail: "", // just the show — no season/episode (and dedupe collapses a binge)
      link: ids.slug ? `https://trakt.tv/shows/${ids.slug}` : TRAKT_PROFILE_URL,
      tmdbId: ids.tmdb || null,
      image: null,
      watchedAt: it.watched_at || null,
    };
  }
  return null;
}

// Collapse repeats of the same title so a show binge shows up once, not as ten
// near-identical rows. Keeps the most recent (history is reverse-chron).
function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = `${it.kind}:${it.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

// Resolve a poster from TMDB using the id Trakt hands us. Optional + best-effort:
// no key or no id → leave image null (the row renders as text). Failures are
// swallowed so a TMDB hiccup never breaks the build.
async function addPoster(item) {
  if (!TMDB_API_KEY || !item.tmdbId) return;
  const path = item.kind === "film" ? "movie" : "tv";
  try {
    const data = await fetchJSON(
      `https://api.themoviedb.org/3/${path}/${item.tmdbId}?api_key=${TMDB_API_KEY}`
    );
    if (data && data.poster_path) item.image = `${TMDB_IMG}${data.poster_path}`;
  } catch (_) {
    /* leave image null → text row */
  }
}

export async function getRecentlyWatched(limit = 4) {
  // Not configured yet → return nothing so the section hides (build stays green).
  if (!CLIENT_ID || !USERNAME) return [];

  // Over-fetch so dedupe still leaves `limit` distinct titles after a binge.
  const url = `${TRAKT_API}/users/${encodeURIComponent(USERNAME)}/history?limit=${limit * 6}`;
  try {
    const data = await fetchJSON(url, {
      "Content-Type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": CLIENT_ID,
    });
    const items = dedupe(
      (Array.isArray(data) ? data : []).map(mapItem).filter(Boolean)
    ).slice(0, limit);
    // Enrich the final few with posters (parallel; only when TMDB_API_KEY is set).
    await Promise.all(items.map(addPoster));
    return items;
  } catch (err) {
    console.warn(`[trakt] history fetch failed — hiding section:`, err.message);
    return [];
  }
}

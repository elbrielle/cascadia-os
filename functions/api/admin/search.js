/* ============================================================================
   functions/api/admin/search.js  —  Pages Function: title search proxy
   (GET /api/admin/search?q=...&kind=screen|book|game|album|paper)
   ----------------------------------------------------------------------------
   GATED: lives under /api/admin/*, which Cloudflare Access protects at the edge
   (see docs/attention-log-admin-spec.md, Setup A). Proxies TMDB (film/TV) and
   Open Library (books) so the TMDB key stays server-side and never reaches the
   browser. Returns a normalized candidate list the admin UI renders.

   `kind`:  "screen" → TMDB multi-search (movies + TV)
            "book"   → Google Books Volumes API (keyless), falling back to Open
                       Library if Google Books is unavailable (e.g. the shared
                       keyless quota is exhausted). Set GOOGLE_BOOKS_API_KEY to
                       use a dedicated key and skip the shared quota entirely.
   ========================================================================== */

import { jsonResponse as json } from "../_http.js";

const TMDB = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w185";
const GBOOKS = "https://www.googleapis.com/books/v1/volumes";
const IGDB = "https://api.igdb.com/v4/games";
const IGDB_IMG = "https://images.igdb.com/igdb/image/upload/t_cover_big";
const TWITCH_TOKEN = "https://id.twitch.tv/oauth2/token";
const ITUNES = "https://itunes.apple.com/search";
const DEEZER = "https://api.deezer.com";
const CROSSREF = "https://api.crossref.org/works";
// Crossref "polite pool" mailto is read from env.CROSSREF_MAIL at request time;
// unset in this public snapshot, so requests use Crossref's anonymous pool.
const DOI_RE = /^10\.\d{4,9}\/\S+$/i;
const UA = "elishalucero.com (Cascadia OS portfolio admin)";

// Per-upstream timeout. Must be comfortably below the browser's 15s api()
// timeout so that when Google Books stalls, THIS fetch aborts first and the
// Open Library fallback actually runs — instead of the whole request hanging
// until the browser gives up and the user gets nothing.
const UPSTREAM_TIMEOUT_MS = 7000;

const fetchUpstream = (url, init = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const allowed = ["screen", "book", "game", "album", "paper"];
  const reqKind = url.searchParams.get("kind") || "screen";
  const kind = allowed.includes(reqKind) ? reqKind : "screen";
  if (!q) return json({ results: [] });

  try {
    let results;
    switch (kind) {
      case "book":  results = await searchBooks(q, env); break;
      case "game":  results = await searchGames(q, env); break;
      case "album": results = await searchAlbums(q); break;
      case "paper": results = await searchPapers(q, env); break;
      default:      results = await searchScreen(q, env.TMDB_API_KEY); break;
    }
    return json({ results });
  } catch (err) {
    return json({ results: [], error: String(err && err.message ? err.message : err) }, 502);
  }
}

async function searchScreen(q, key) {
  if (!key) return []; // TMDB key not set → no screen search (book search still works)
  const r = await fetchUpstream(
    `${TMDB}/search/multi?query=${encodeURIComponent(q)}&include_adult=false&api_key=${key}`,
    { headers: { "User-Agent": UA } }
  );
  if (!r.ok) throw new Error("tmdb " + r.status);
  const data = await r.json();
  return (data.results || [])
    .filter((it) => it.media_type === "movie" || it.media_type === "tv")
    .slice(0, 8)
    .map((it) => {
      const isMovie = it.media_type === "movie";
      const date = isMovie ? it.release_date : it.first_air_date;
      return {
        id: `${isMovie ? "film" : "show"}:tmdb:${it.id}`,
        kind: isMovie ? "film" : "show",
        title: isMovie ? it.title : it.name,
        detail: date ? String(date).slice(0, 4) : "",
        image: it.poster_path ? `${TMDB_IMG}${it.poster_path}` : null,
        link: `https://www.themoviedb.org/${isMovie ? "movie" : "tv"}/${it.id}`,
      };
    });
}

// Book search. Google Books first (better metadata + covers); Open Library is a
// resilient fallback so book search never goes dark when the keyless Google
// quota is exhausted. Both return the same normalized item shape; only the id
// provider segment differs (`gbooks` vs `olid`).
async function searchBooks(q, env) {
  try {
    const books = await searchGoogleBooks(q, env && env.GOOGLE_BOOKS_API_KEY);
    if (books.length) return books;
  } catch (_) {
    // fall through to Open Library
  }
  return searchOpenLibrary(q);
}

async function searchGoogleBooks(q, key) {
  // `country` is required for unauthenticated calls from some regions; `key` (if
  // set) moves us off the shared keyless quota entirely.
  const url =
    `${GBOOKS}?q=${encodeURIComponent(q)}&maxResults=8&printType=books&country=US` +
    (key ? `&key=${encodeURIComponent(key)}` : "");
  const r = await fetchUpstream(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("gbooks " + r.status);
  const data = await r.json();
  return (data.items || [])
    .slice(0, 8)
    .map((it) => {
      const v = it.volumeInfo || {};
      const img = v.imageLinks || {};
      const cover = img.thumbnail || img.smallThumbnail || "";
      return {
        id: `book:gbooks:${it.id}`,
        kind: "book",
        title: v.title || "",
        detail: Array.isArray(v.authors) ? v.authors[0] : "",
        // Google hands back http:// cover URLs — force https for the CSP + mixed-content.
        image: cover ? cover.replace(/^http:\/\//i, "https://") : null,
        link: v.canonicalVolumeLink || v.infoLink || `https://books.google.com/books?id=${it.id}`,
      };
    })
    .filter((b) => b.title);
}

async function searchOpenLibrary(q) {
  const r = await fetchUpstream(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8` +
      `&fields=key,title,author_name,first_publish_year,cover_i`,
    { headers: { "User-Agent": UA } }
  );
  if (!r.ok) throw new Error("openlibrary " + r.status);
  const data = await r.json();
  return (data.docs || []).slice(0, 8).map((d) => {
    const olid = String(d.key || "").replace("/works/", "");
    return {
      id: `book:olid:${olid}`,
      kind: "book",
      title: d.title || "",
      detail: Array.isArray(d.author_name) ? d.author_name[0] : "",
      image: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      link: `https://openlibrary.org${d.key || ""}`,
    };
  });
}

// --- Games (IGDB via Twitch) -------------------------------------------------
// IGDB needs a Twitch OAuth app token (client-credentials). Without the two env
// vars set, game search is simply disabled (returns []), exactly like screen
// search without a TMDB key — every other category keeps working. The token
// (~60-day life) is cached in KV so we don't mint a new one on every search.
async function getIgdbToken(env) {
  const id = env.TWITCH_CLIENT_ID;
  const secret = env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return null;

  // Reuse a cached token while it still has comfortable headroom (>2 min).
  try {
    if (env.ATTENTION) {
      const cached = await env.ATTENTION.get("igdb_token");
      if (cached) {
        const t = JSON.parse(cached);
        if (t && t.token && t.exp && t.exp > Date.now() + 120000) return t.token;
      }
    }
  } catch (_) {
    /* fall through and mint a fresh token */
  }

  const r = await fetchUpstream(
    `${TWITCH_TOKEN}?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(
      secret
    )}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!r.ok) return null;
  const data = await r.json();
  if (!data || !data.access_token) return null;

  const exp = Date.now() + Number(data.expires_in || 0) * 1000;
  try {
    if (env.ATTENTION) {
      await env.ATTENTION.put("igdb_token", JSON.stringify({ token: data.access_token, exp }));
    }
  } catch (_) {
    /* token is still usable this request even if caching the write failed */
  }
  return data.access_token;
}

async function searchGames(q, env) {
  const token = await getIgdbToken(env);
  if (!token) return []; // IGDB not configured → no game search (others still work)
  // Apicalypse query body; strip quotes/backslashes so the search literal is safe.
  const term = q.replace(/["\\]/g, " ").trim();
  const body = `search "${term}"; fields name,slug,first_release_date,cover.image_id; limit 8;`;
  const r = await fetchUpstream(IGDB, {
    method: "POST",
    headers: {
      "Client-ID": env.TWITCH_CLIENT_ID,
      Authorization: "Bearer " + token,
      "User-Agent": UA,
    },
    body,
  });
  if (!r.ok) throw new Error("igdb " + r.status);
  const data = await r.json();
  return (Array.isArray(data) ? data : [])
    .slice(0, 8)
    .map((g) => ({
      id: `game:igdb:${g.id}`,
      kind: "game",
      title: g.name || "",
      detail: g.first_release_date
        ? String(new Date(g.first_release_date * 1000).getUTCFullYear())
        : "",
      image: g.cover && g.cover.image_id ? `${IGDB_IMG}/${g.cover.image_id}.jpg` : null,
      link: g.slug ? `https://www.igdb.com/games/${g.slug}` : "",
    }))
    .filter((x) => x.title);
}

// --- Music (iTunes Store + Deezer, both keyless) -----------------------------
// Two sources, because each covers a catalog the other misses:
//   • iTunes Search API only sees the iTunes STORE (purchasable) catalog — which
//     is NOT the Apple Music streaming catalog. Streaming-only releases (lots of
//     indie / back-catalog) are invisible to it, and it over-constrains when one
//     query mixes album + artist words. It does carry a release year, though.
//   • Deezer has far broader coverage, handles "title artist" queries gracefully,
//     and returns inline cover art — but its search response omits the year.
// Query both in parallel and merge: dedup by normalized title+artist, keep the
// first position (Deezer leads for recall), and fill a missing year from the
// other source. Deezer-only finalists get a cheap best-effort /album/{id} year
// lookup so indie picks aren't left yearless. Either source can fail and music
// search still works from whatever the other returned.
const MUSIC_LIMIT = 15; // per source, before merge
const MUSIC_RESULTS = 12; // returned to the UI, after merge + dedup

async function searchAlbums(q) {
  const [deezer, itunes] = await Promise.all([
    searchDeezerAlbums(q).catch(() => []),
    searchItunesAlbums(q).catch(() => []),
  ]);
  const merged = mergeAlbums(deezer, itunes).slice(0, MUSIC_RESULTS);
  await fillMissingYears(merged); // best-effort, only Deezer-only finalists
  return merged.map((it) => ({
    id: it.id,
    kind: "album",
    title: it.title,
    detail: [it.artist, it.year].filter(Boolean).join(" · "),
    image: it.image,
    link: it.link,
  }));
}

async function searchItunesAlbums(q) {
  const r = await fetchUpstream(
    `${ITUNES}?term=${encodeURIComponent(q)}&media=music&entity=album&limit=${MUSIC_LIMIT}&country=US`,
    { headers: { "User-Agent": UA } }
  );
  if (!r.ok) throw new Error("itunes " + r.status);
  const data = await r.json();
  return (data.results || [])
    .map((a) => ({
      id: `album:itunes:${a.collectionId}`,
      title: a.collectionName || "",
      artist: a.artistName || "",
      year: a.releaseDate ? String(a.releaseDate).slice(0, 4) : "",
      // 100x100 thumb upscaled to a crisp 600x600 (the reliable iTunes trick).
      image: a.artworkUrl100 ? a.artworkUrl100.replace("100x100bb", "600x600bb") : null,
      link: a.collectionViewUrl || "",
    }))
    .filter((x) => x.title);
}

async function searchDeezerAlbums(q) {
  const r = await fetchUpstream(
    `${DEEZER}/search/album?q=${encodeURIComponent(q)}&limit=${MUSIC_LIMIT}`,
    { headers: { "User-Agent": UA } }
  );
  if (!r.ok) throw new Error("deezer " + r.status);
  const data = await r.json();
  return (Array.isArray(data.data) ? data.data : [])
    .map((a) => ({
      id: `album:deezer:${a.id}`,
      title: a.title || "",
      artist: (a.artist && a.artist.name) || "",
      year: "", // search response has no release_date; fillMissingYears backfills
      image: a.cover_xl || a.cover_big || a.cover_medium || null,
      link: a.link || "",
      deezerId: a.id, // for the best-effort year lookup; dropped before output
    }))
    .filter((x) => x.title);
}

// Round-robin merge so each source's top hits surface early. Dedup by normalized
// title+artist: keep the first occurrence's position, but backfill a missing
// year/cover/link/deezerId from a later duplicate (iTunes is where the year
// comes from). Parenthetical markers are kept in the key on purpose, so a vocal
// album and its "(Instrumental)" edition stay distinct instead of collapsing.
function mergeAlbums(primary, secondary) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const byKey = new Map();
  const order = [];
  const max = Math.max(primary.length, secondary.length);
  for (let i = 0; i < max; i++) {
    for (const it of [primary[i], secondary[i]]) {
      if (!it) continue;
      const key = norm(it.title) + "|" + norm(it.artist);
      const prev = byKey.get(key);
      if (prev) {
        if (!prev.year && it.year) prev.year = it.year;
        if (!prev.image && it.image) prev.image = it.image;
        if (!prev.link && it.link) prev.link = it.link;
        if (!prev.deezerId && it.deezerId) prev.deezerId = it.deezerId;
      } else {
        byKey.set(key, it);
        order.push(key);
      }
    }
  }
  return order.map((k) => byKey.get(k));
}

// Deezer's search omits release_date; for the handful of Deezer-only finalists
// still missing a year, fetch /album/{id} in parallel. Best-effort — any failure
// just leaves that year blank. Bounded by the result cap, so a few calls at most.
async function fillMissingYears(items) {
  const targets = items.filter((it) => !it.year && it.deezerId);
  await Promise.all(
    targets.map(async (it) => {
      try {
        const r = await fetchUpstream(`${DEEZER}/album/${it.deezerId}`, {
          headers: { "User-Agent": UA },
        });
        if (!r.ok) return;
        const d = await r.json();
        if (d && d.release_date) it.year = String(d.release_date).slice(0, 4);
      } catch (_) {
        /* leave the year blank */
      }
    })
  );
}

// --- Research articles (Crossref, keyless) -----------------------------------
// Accepts a pasted DOI (→ /works/{doi}) or free-text (→ bibliographic query).
// Papers have no cover art anywhere, so `image` is always null; the UI renders
// them as document tiles. mailto puts us in Crossref's faster "polite pool".
async function searchPapers(q, env) {
  const cleaned = q.replace(/^\s*https?:\/\/(dx\.)?doi\.org\//i, "").trim();
  const isDoi = DOI_RE.test(cleaned);
  // mailto puts us in Crossref's faster "polite pool"; only sent when the
  // deployer sets the CROSSREF_MAIL env binding (unset here = anonymous pool).
  const mail = (env && env.CROSSREF_MAIL) || "";
  const polite = mail ? `mailto=${encodeURIComponent(mail)}` : "";
  const url = isDoi
    ? `${CROSSREF}/${cleaned}${polite ? "?" + polite : ""}`
    : `${CROSSREF}?query.bibliographic=${encodeURIComponent(
        q
      )}&rows=8&select=DOI,title,author,issued,container-title${polite ? "&" + polite : ""}`;
  const r = await fetchUpstream(url, {
    headers: { "User-Agent": mail ? `elishalucero.com (mailto:${mail})` : UA },
  });
  if (!r.ok) throw new Error("crossref " + r.status);
  const data = await r.json();
  const works = isDoi
    ? [data && data.message]
    : (data && data.message && data.message.items) || [];
  return works
    .filter(Boolean)
    .slice(0, 8)
    .map((w) => {
      const doi = w.DOI || "";
      const title = Array.isArray(w.title) ? w.title[0] : w.title || "";
      const authors = Array.isArray(w.author) ? w.author : [];
      const a0 = authors[0] ? authors[0].family || authors[0].name || "" : "";
      const who = a0 ? a0 + (authors.length > 1 ? " et al." : "") : "";
      const year =
        w.issued && w.issued["date-parts"] && w.issued["date-parts"][0]
          ? w.issued["date-parts"][0][0]
          : "";
      const venue = Array.isArray(w["container-title"]) ? w["container-title"][0] : "";
      return {
        id: `paper:doi:${doi}`,
        kind: "paper",
        title,
        detail: [who, year, venue].filter(Boolean).join(" · "),
        image: null,
        link: doi ? `https://doi.org/${doi}` : "",
      };
    })
    .filter((x) => x.title && x.id !== "paper:doi:");
}

// ============================================================================
//  goodreads.js  —  pull Elisha's currently-reading shelf from Goodreads
// ----------------------------------------------------------------------------
//  Goodreads' user-shelf RSS is public, no API key required. We fetch it at
//  build time (same pattern as substack.js) so the About → attention.log
//  window shows the books Elisha is actually reading, not hardcoded titles.
//
//  Schedule a rebuild on the host (Cloudflare Pages cron / GitHub Actions
//  every N hours) to keep the list fresh — new books appear on the next build.
//  Falls back to an empty list if Goodreads is unreachable so the build never
//  fails — AttentionLog.astro hides the "Currently reading" section when it
//  gets [] (same contract as trakt.js), instead of shipping placeholder copy.
// ============================================================================

import Parser from "rss-parser";

// User 12934617 — Elisha. Public profile link is in contact.astro.
export const GOODREADS_USER_ID = "12934617";
export const GOODREADS_PROFILE_URL =
  `https://www.goodreads.com/user/show/${GOODREADS_USER_ID}-elisha-lucero`;

// Hard timeout for the Goodreads RSS fetch. Without this, a Goodreads outage
// or slow response could hang the build for ~minutes before failing; with it
// we drop to [] after 10s and finish the build.
const FETCH_TIMEOUT_MS = 10_000;

// rss-parser doesn't know about Goodreads' custom <book_image_url> /
// <author_name> / <average_rating> fields by default — register the ones
// fetchShelf actually reads so item objects expose them under camelCased keys.
const parser = new Parser({
  customFields: {
    item: [
      ["book_image_url", "bookImage"],
      ["book_small_image_url", "bookImageSmall"],
      ["book_medium_image_url", "bookImageMedium"],
      ["author_name", "author"],
      ["average_rating", "averageRating"],
    ],
  },
});

// Goodreads adds " (Series #N)" suffixes to titles. Strip parenthetical
// series tags for cleaner display; keep the main title verbatim.
function cleanTitle(t = "") {
  return t.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, "").trim();
}

// Strip Goodreads' RSS tracking params from book links so the URL we render
// is the canonical share URL.
function cleanLink(l = "") {
  return l.replace(/[?&]utm_[^&]+/g, "").replace(/\?$/, "");
}

async function fetchShelf(shelf, limit = 4) {
  const url = `https://www.goodreads.com/review/list_rss/${GOODREADS_USER_ID}?shelf=${shelf}`;
  try {
    // Fetch the XML ourselves with an AbortController timeout, then parseString.
    // rss-parser's own parseURL timeout can surface as an unhandled rejection
    // that fails the whole build; this keeps every failure inside the try/catch.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { "User-Agent": "elishalucero.com (Cascadia OS portfolio)" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const xml = await res.text();
    const feed = await parser.parseString(xml);
    const items = (feed.items || []).slice(0, limit).map((item) => ({
      title: cleanTitle(item.title ?? "Untitled"),
      author: item.author ?? "Unknown",
      link: cleanLink(item.link ?? GOODREADS_PROFILE_URL),
      image: item.bookImage || item.bookImageMedium || item.bookImageSmall || null,
      averageRating: item.averageRating ? Number(item.averageRating) : null,
    }));
    return items;
  } catch (err) {
    console.warn(`[goodreads] ${shelf} feed failed, section will hide:`, err.message);
    return [];
  }
}

export function getCurrentlyReading(limit = 4) {
  return fetchShelf("currently-reading", limit);
}

// Hook for the still-open "recently read" decision. Kept ready-to-wire —
// intentionally NOT dead code — even though no page renders the "read" shelf yet.
export function getRecentlyRead(limit = 4) {
  return fetchShelf("read", limit);
}

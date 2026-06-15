// ============================================================================
//  substack.js  —  pull Elisha's posts + tags from Substack at build time
// ----------------------------------------------------------------------------
//  Primary source: the public JSON archive endpoint
//    https://<pub>.substack.com/api/v1/archive
//  It returns each post with `postTags` (Substack strips tags from the RSS).
//  We use the archive for BOTH posts and tags so they share one fetch and stay
//  perfectly consistent (a post's tags are the same as the tag's post list).
//
//  RSS feed is kept as a graceful fallback so the build never fails if the
//  archive endpoint changes shape or 403s a build agent.
//
//  Everything runs once during `npm run build`. New posts/tags appear when
//  the site rebuilds — schedule a periodic rebuild on the host to stay fresh.
// ============================================================================

import Parser from "rss-parser";

export const SUBSTACK_URL = "https://elishalucero.substack.com";
export const SUBSTACK_FEED_URL = "https://elishalucero.substack.com/feed";
const SUBSTACK_ARCHIVE_URL = "https://elishalucero.substack.com/api/v1/archive?sort=new&offset=0&limit=50";

// On a total outage (archive AND RSS both fail) getPosts() / getTags() return an
// EMPTY array — never placeholder content. Rendering nothing is correct: the
// consumers .map() over [] (so the Home Build Log / blog Posts windows simply
// show no rows) and getStaticPaths() over [] generates zero tag routes. This
// mirrors the Goodreads empty-on-failure fix (PR #92, audit #1) — build-time
// scaffolding must never reach visitors.

function stripHtml(html = "") {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function makeExcerpt(text, max = 180) {
  const t = stripHtml(text);
  return t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

// Single in-process cache so getPosts() + getTags() share one network call
// during a single build run.
let _archiveCache = null;

// Hard timeout for the archive fetch. If Substack stalls, we fail fast and
// the catch in getPosts/getTags drops to RSS / empty rather than hanging the
// build for the full default network timeout.
const FETCH_TIMEOUT_MS = 10_000;

async function fetchArchive() {
  if (_archiveCache) return _archiveCache;
  const res = await fetch(SUBSTACK_ARCHIVE_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("archive response was not an array");
  _archiveCache = data;
  return data;
}

function normalizeTag(tag) {
  if (!tag || !tag.slug || tag.hidden) return null;
  return { name: tag.name ?? tag.slug, slug: tag.slug };
}

function archivePostToShape(post) {
  const tags = Array.isArray(post.postTags)
    ? post.postTags.map(normalizeTag).filter(Boolean)
    : [];
  const date = post.post_date ? new Date(post.post_date) : null;
  const excerptSource = post.truncated_body_text ?? post.subtitle ?? "";
  return {
    title: post.title ?? "Untitled",
    link: post.canonical_url ?? `${SUBSTACK_URL}/p/${post.slug ?? ""}`,
    date,
    excerpt: makeExcerpt(excerptSource),
    tags,
  };
}

async function rssFallbackPosts() {
  // Fetch the XML ourselves with an AbortController timeout, then parseString.
  // rss-parser's own parseURL timeout can surface as an unhandled rejection
  // that escapes getPosts()'s try/catch and fails the whole build; this keeps
  // every failure awaited and catchable (same pattern as goodreads.js).
  const parser = new Parser();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const res = await fetch(SUBSTACK_FEED_URL, {
    headers: { "User-Agent": "elishalucero.com (Cascadia OS portfolio)" },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  if (!res.ok) throw new Error("HTTP " + res.status);
  const xml = await res.text();
  const feed = await parser.parseString(xml);
  if (!feed.items || feed.items.length === 0) return [];
  return feed.items.map((item) => ({
    title: item.title ?? "Untitled",
    link: item.link ?? SUBSTACK_URL,
    date: item.isoDate ? new Date(item.isoDate) : null,
    excerpt: makeExcerpt(item.contentSnippet ?? item.content ?? ""),
    tags: [], // RSS strips tags
  }));
}

/**
 * Returns Elisha's Substack posts. Each post includes a `tags` array
 * (possibly empty) — useful for tag-filter routes. Returns [] if both the
 * archive and the RSS fallback fail (see the empty-on-outage note up top).
 */
export async function getPosts() {
  try {
    const archive = await fetchArchive();
    if (archive.length === 0) return [];
    return archive.map(archivePostToShape);
  } catch (err) {
    console.warn("[substack] archive fetch failed, falling back to RSS:", err.message);
    try {
      return await rssFallbackPosts();
    } catch (rssErr) {
      console.warn("[substack] RSS also failed, returning no posts:", rssErr.message);
      return [];
    }
  }
}

/**
 * Aggregate unique tags from every post on the archive.
 * Returns [{ name, slug, count, link }] sorted by count desc, then name asc.
 * `link` points to the Substack `/t/<slug>` page (used as a fallback target
 * if we ever decide to skip the in-site tag-filter route). Returns [] if the
 * archive fails (see the empty-on-outage note up top).
 */
export async function getTags() {
  try {
    const archive = await fetchArchive();
    if (archive.length === 0) return [];

    const byCount = new Map();
    for (const post of archive) {
      const tags = Array.isArray(post.postTags) ? post.postTags : [];
      for (const raw of tags) {
        const t = normalizeTag(raw);
        if (!t) continue;
        const existing = byCount.get(t.slug);
        if (existing) {
          existing.count += 1;
        } else {
          byCount.set(t.slug, {
            name: t.name,
            slug: t.slug,
            count: 1,
            link: `${SUBSTACK_URL}/t/${t.slug}`,
          });
        }
      }
    }
    if (byCount.size === 0) return [];
    return [...byCount.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name)
    );
  } catch (err) {
    console.warn("[substack] archive fetch failed, returning no tags:", err.message);
    return [];
  }
}

/**
 * Tag-cloud sizing: returns a `tagSize(count)` fn that scales a tag's font-size
 * between 12px and 22px by how often it appears across all posts — single-post
 * tags stay small, the most-used tag hits 22px, linear in between. Shared by
 * /blog/ and /blog/tagged/[slug] so both Tag clouds render identically (the
 * block was duplicated verbatim in each — audit #21). maxCount is seeded at 1
 * so an empty tag list can't produce NaN / a divide-by-zero.
 */
export function makeTagSizer(tags) {
  const maxCount = Math.max(1, ...tags.map((t) => t.count ?? 1));
  return function tagSize(count) {
    if (maxCount <= 1) return 14;
    const ratio = (count - 1) / (maxCount - 1);
    return Math.round(12 + ratio * 10);
  };
}

export function formatDate(date) {
  // `date` is a Date or null (see post mapping above). Guard the INVALID-Date
  // case too: `new Date("garbage")` is truthy, so without isNaN it would render
  // the literal text "Invalid Date" into the post date span.
  if (!date || isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

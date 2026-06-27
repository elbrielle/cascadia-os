#!/usr/bin/env node
// ============================================================================
//  scripts/compute-csp-hashes.cjs  —  CSP inline-script hash regenerator
// ----------------------------------------------------------------------------
//  Why this exists:
//    public/_headers ships a Content-Security-Policy that pins each inline
//    <script> via a SHA-256 hash instead of relying on 'unsafe-inline'. That
//    way even a stray XSS injection point can't drop a <script> tag.
//
//    Browsers compute the hash on the SCRIPT BODY (the text between the
//    opening <script ...> and the closing </script>), byte-for-byte, with NO
//    whitespace normalization. The hash must therefore be computed against
//    the built HTML, not the source .astro file — Astro rewrites whitespace
//    during compile.
//
//  Usage:
//    1. npm run build              (produces dist/)
//    2. node scripts/compute-csp-hashes.cjs           (print paste-ready tokens)
//    3. Copy the printed sha256-... tokens into the script-src directive
//       of public/_headers, then rebuild + redeploy.
//
//    Add --check to compare the script-src hashes in public/_headers against
//    what the built output actually contains. Exits non-zero on drift, which
//    is what .github/workflows/ci.yml uses to gate merges so an edit to an
//    inline script can never silently break the live CSP:
//      node scripts/compute-csp-hashes.cjs --check
//
//  When to rerun:
//    Any edit to an inline <script> block in src/**/*.astro. Two such blocks
//    exist today (see docs/PROJECT-STATUS.md "Operational notes"):
//      - src/layouts/Layout.astro    astro:after-swap sidebar nav-sync
//      - src/pages/contact.astro     Web3Forms submit handler
//    The script logs which built page each unique hash came from so you can
//    sanity-check coverage if you ever add or remove inline scripts.
//
//  Why a .cjs file:
//    package.json sets "type": "module", so .js would be parsed as ESM. We
//    want plain require() here without any tooling. .cjs is the cheapest
//    opt-out.
// ============================================================================

const fs   = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DIST_DIR = path.resolve(__dirname, "..", "dist");
// Crawl every built HTML page so we catch inline scripts that only appear on
// a subset of routes (e.g. the contact form handler is contact.astro only).
// `dist/**/index.html` is enough to cover Astro's `trailingSlash: "always"`
// output layout — we don't need a full HTML walker for a static site.
function listHtmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listHtmlFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

// Match every <script ...>...</script> with a NON-empty body. We deliberately
// skip <script src="..."> tags — those load external files and are governed
// by the `'self'` source in script-src, not by a hash. Astro's emitter writes
// inline blocks with the opening tag on its own line; the body capture below
// is non-greedy so adjacent inline blocks each match independently.
const SCRIPT_RE = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

function sha256Base64(body) {
  // Browsers hash the script body verbatim — same bytes the parser receives
  // between the tags. NO trim, NO whitespace normalize, NO decode of HTML
  // entities. crypto.createHash gives us the raw digest; we base64 it.
  return crypto.createHash("sha256").update(body, "utf8").digest("base64");
}

if (!fs.existsSync(DIST_DIR)) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

const files = listHtmlFiles(DIST_DIR);
if (files.length === 0) {
  console.error("No HTML files found in dist/.");
  process.exit(1);
}

// Map of hash -> { bodyPreview, sources: Set<routePath> } so the report shows
// which built page surfaced each unique inline script. A single inline script
// that's part of the shared Layout will show up across every route.
const hashes = new Map();

for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  const route = "/" + path.relative(DIST_DIR, file).replace(/\\/g, "/");
  let match;
  while ((match = SCRIPT_RE.exec(html)) !== null) {
    const body = match[1];
    if (!body.trim()) continue; // skip empty <script></script>
    const hash = sha256Base64(body);
    if (!hashes.has(hash)) {
      hashes.set(hash, { preview: body.trim().slice(0, 80), sources: new Set() });
    }
    hashes.get(hash).sources.add(route);
  }
}

if (hashes.size === 0) {
  console.error("No inline <script> blocks with non-empty bodies found.");
  process.exit(1);
}

// --check mode: compare what we just computed to what's already pinned in
// public/_headers' script-src. Exits 1 on any drift so CI can gate merges
// when someone edits an inline script and forgets to refresh the hashes.
if (process.argv.includes("--check")) {
  const headersPath = path.resolve(__dirname, "..", "public", "_headers");
  if (!fs.existsSync(headersPath)) {
    console.error("public/_headers not found.");
    process.exit(1);
  }
  const headers = fs.readFileSync(headersPath, "utf8");

  // Pull hashes only from the Content-Security-Policy line itself (not from
  // comments above it that might contain example tokens). The directive sits
  // on a single line per Cloudflare's _headers format spec.
  const cspMatch = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m);
  if (!cspMatch) {
    console.error("No Content-Security-Policy directive found in public/_headers.");
    process.exit(1);
  }
  const actualHashes = new Set(
    [...cspMatch[1].matchAll(/sha256-[A-Za-z0-9+/=]+/g)].map((m) => m[0])
  );
  const expectedHashes = new Set([...hashes.keys()].map((h) => `sha256-${h}`));

  const missing = [...expectedHashes].filter((h) => !actualHashes.has(h));
  const stale   = [...actualHashes].filter((h) => !expectedHashes.has(h));

  if (missing.length === 0 && stale.length === 0) {
    console.log(`✓ public/_headers script-src matches built output (${hashes.size} hash(es)).`);
    process.exit(0);
  }
  console.error("✗ CSP hash drift detected between dist/ and public/_headers:");
  if (missing.length) {
    console.error("\n  Missing from public/_headers (present in build):");
    for (const h of missing) console.error(`    ${h}`);
  }
  if (stale.length) {
    console.error("\n  Stale in public/_headers (no longer in build):");
    for (const h of stale) console.error(`    ${h}`);
  }
  console.error(
    "\nFix: rerun without --check, then paste the new tokens into the " +
    "script-src directive of public/_headers.\n"
  );
  process.exit(1);
}

// Default mode: print a paste-ready fragment + a per-hash breakdown.
console.log("--- Paste into public/_headers script-src directive ---\n");
const tokens = [...hashes.keys()].map((h) => `'sha256-${h}'`).join(" ");
console.log(tokens + "\n");

console.log("--- Per-hash detail ---");
for (const [hash, info] of hashes) {
  console.log(`\nsha256-${hash}`);
  console.log(`  preview: ${info.preview.replace(/\s+/g, " ")}…`);
  console.log(`  appears on: ${[...info.sources].sort().join(", ")}`);
}

console.log(`\n${hashes.size} unique inline script(s) hashed across ${files.length} built page(s).`);

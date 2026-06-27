#!/usr/bin/env node
// ============================================================================
//  scripts/gen-webp.cjs  —  emit a sibling .webp next to every .jpg in public/
// ----------------------------------------------------------------------------
//  WHY committed (not build-time): the .webp files are committed to the repo as
//  static assets beside their .jpg, so they exist in BOTH `npm run dev` and the
//  Cloudflare build with zero build-pipeline dependency on sharp at deploy time
//  (a <picture> webp <source> that 404s would show a BROKEN image in dev, not a
//  graceful fallback — so the file must really be there). This script is the
//  REGENERATOR: run it whenever you add/replace .jpg images under public/.
//
//  USAGE:  node scripts/gen-webp.cjs            # convert new/changed jpgs
//          node scripts/gen-webp.cjs --force    # re-convert everything
//
//  Quality: q78 — the conservative, quality-safe target Elisha approved for the
//  photography/portrait work (AVIF q50 was rejected as too soft). Each .jpg keeps
//  its place as the fallback; nothing here edits or deletes a .jpg.
//
//  sharp ships with Astro (its image service), so it resolves without a separate
//  install. If it can't load, this exits 0 with a notice rather than failing.
// ============================================================================
const fs = require("fs");
const path = require("path");

let sharp;
try {
  sharp = require("sharp");
} catch (e) {
  console.log("[gen-webp] sharp unavailable — skipping (jpgs still serve via fallback).");
  process.exit(0);
}

const ROOT = path.join(__dirname, "..", "public");
const FORCE = process.argv.includes("--force");
const QUALITY = 78;

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, out);
    else if (/\.jpe?g$/i.test(name)) out.push(p);
  }
  return out;
}

(async () => {
  const jpgs = walk(ROOT, []);
  let converted = 0, skipped = 0, savedBytes = 0, errors = 0;

  for (const jpg of jpgs) {
    const webp = jpg.replace(/\.jpe?g$/i, ".webp");
    const jpgStat = fs.statSync(jpg);
    // Skip if an up-to-date webp already exists (unless --force).
    if (!FORCE && fs.existsSync(webp) && fs.statSync(webp).mtimeMs >= jpgStat.mtimeMs) {
      skipped++;
      continue;
    }
    try {
      await sharp(jpg).webp({ quality: QUALITY, effort: 6 }).toFile(webp);
      const webpSize = fs.statSync(webp).size;
      savedBytes += jpgStat.size - webpSize;
      converted++;
    } catch (e) {
      console.warn(`[gen-webp] FAILED ${path.relative(ROOT, jpg)}: ${e.message}`);
      errors++;
    }
  }

  const mb = (b) => (b / 1048576).toFixed(2) + " MB";
  console.log(
    `[gen-webp] ${jpgs.length} jpg | converted ${converted}, skipped ${skipped}` +
    (errors ? `, errors ${errors}` : "") + ` | saved ${mb(savedBytes)}`
  );
})();

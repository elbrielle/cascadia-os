// ============================================================================
//  build-info.js  —  build stamp for the "About Cascadia OS" dialog
// ----------------------------------------------------------------------------
//  Surfaces a short commit SHA + a build date so the fake System Properties
//  dialog can show a *real* "Build" row instead of a cheesy made-up spec.
//
//  • On Cloudflare Pages, the commit SHA is handed to the build as the
//    CF_PAGES_COMMIT_SHA env var — use that (no git needed in their CI image).
//  • Locally there's no such var, so fall back to `git rev-parse`. The
//    try/catch keeps a git-less environment (or a downloaded tarball) building.
//  • The date is the build moment, which == "last updated" for a site that
//    redeploys on every push to main.
//
//  These are module-level constants, so the (cheap) git call runs once per
//  build and is reused by every page that imports Layout.astro — not per page.
//  Imported by src/layouts/Layout.astro and stamped onto <body data-build…>,
//  where the external startmenu.js reads it from the DOM (keeps that script
//  external, so the CSP script-src hash list never changes).
// ============================================================================
import { execSync } from "node:child_process";

function shortSha() {
  const fromCloudflare = process.env.CF_PAGES_COMMIT_SHA;
  if (fromCloudflare) return fromCloudflare.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

export const BUILD_SHA = shortSha();
export const BUILD_DATE = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

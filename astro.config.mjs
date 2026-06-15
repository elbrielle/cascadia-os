// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// ============================================================================
//  astro.config.mjs  —  PROJECT-WIDE ASTRO SETTINGS
// ----------------------------------------------------------------------------
//  This is where Astro reads its configuration. For a static site like this,
//  there's very little to set. The most important line is `site`: your final
//  domain. Astro uses it to build correct absolute URLs (for sitemaps, RSS,
//  social tags, etc.).
//
//  Astro builds a fully static site by default (just HTML/CSS/JS in /dist),
//  which is exactly what we want — no server needed to host it.
// ============================================================================

export default defineConfig({
  site: 'https://elishalucero.com',

  // Astro defaults to "directory" routing, so a page at src/pages/about.astro
  // is served at /about/ (with a trailing slash). The nav links use that form.
  trailingSlash: 'always',

  // Generates sitemap-index.xml + sitemap-0.xml at build (uses `site` above for
  // absolute URLs). robots.txt (public/robots.txt) points crawlers at it.
  integrations: [
    sitemap({
      // The /log-admin curation tool is Cloudflare-Access-gated; keep it out of
      // the public sitemap (robots.txt disallows it too).
      filter: (page) => !page.includes('/log-admin'),
    }),
  ],
});

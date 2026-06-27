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

  // Route-split browser scripts are pulled into pages via `?url` imports (see
  // any page's `import x from "../scripts/x.js?url"`). Vite's default
  // assetsInlineLimit (4 KB) would inline a SMALL such script as a `data:` URI
  // in the <script src> — which our CSP (`script-src 'self'`, no `data:`)
  // BLOCKS at runtime, silently breaking that script in prod while still
  // passing `npm run build` + the inline-hash gate. Force every .js asset to
  // emit as a real fingerprinted file under /_astro (cacheable, CSP-clean);
  // leave images/fonts on Vite's default inlining.
  vite: {
    build: {
      assetsInlineLimit(filePath) {
        if (filePath.endsWith('.js')) return false;
        return undefined; // others → Vite default (4096 bytes)
      },
    },
  },

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

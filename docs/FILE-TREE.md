# File tree — annotated map

Where everything lives and what it does. Keep this current when you add/move/
remove a meaningful file. Pairs with `architecture.md` (mental model).
Generated assets (`dist/`, `node_modules/`)
and binary media (fonts, images, wallpaper, cursors, resume PDF) are omitted —
only files an agent reads or edits are listed.

```
.
├── README.md                   Human-facing run/deploy overview + integrations table
├── astro.config.mjs            Astro config: output:"static", site, trailingSlash:"ignore"
├── package.json                Deps (astro ^6, rss-parser) + scripts (dev/build/preview)
├── public/
│   ├── _headers                Cloudflare response headers — CSP (2 inline-script hashes!), HSTS, etc.
│   ├── scripts/                Browser JS — ALL external (keeps CSP hash list at 2)
│   │   ├── boot.js               Boot/splash screen (once-per-session gate)
│   │   ├── windows.js            Draggable/min/max windows (pointer + CSS transform)
│   │   ├── icons.js              Pixel-art SVG icons (nav + project tiles)
│   │   ├── startmenu.js          Win95 Start menu (Settings, About, Shut Down)
│   │   ├── system.js             Taskbar clock + KV visitor counter (reads /api/hits)
│   │   ├── tweaks.js             Settings panel: theme + font toggles (localStorage)
│   │   ├── explorer.js           Work page: Win95 Explorer folder tree (loaded by work.astro)
│   │   ├── log-admin.js          Attention Log + Favorites admin UI (createList factory) [PR #53]
│   │   ├── favorites-explorer.js  About Favorites explorer: folders → grid → detail (astro:page-load) [#54]
│   │   └── attention-grid.js     Home attention.log icon grid → sticky detail bar (astro:page-load) [#59]
│   ├── fonts/ images/ cursors/ wallpaper/ resume/   Static assets (binary, not listed;
│   │                            favicon set (favicon.ico + favicon-16/32.png + apple-touch-icon.png)
│   │                            and og-image.png social card live in images/ — wired in Layout.astro <head>)
├── src/
│   ├── layouts/
│   │   └── Layout.astro         The OS shell: sidebar nav, taskbar, scripts, view transitions.
│   │                            Contains 1 of the 2 CSP-hashed inline scripts (nav-sync).
│   ├── components/
│   │   ├── Window.astro         The reusable draggable window chrome.
│   │   └── AttentionLog.astro   attention.log icon grid + detail bar: reading/watched (synced) + games/music/articles (manual), Home-only [#44,#58,#59]
│   ├── pages/                   One file per route (Astro file-based routing)
│   │   ├── index.astro            Home (intro + Build Log + attention.log featured panel) [PR #44]
│   │   ├── about.astro            About — bio (README window) + Favorites explorer [#54]
│   │   ├── work.astro             Selected Work (Explorer folders) + résumé window
│   │   ├── blog.astro             Blog index (Substack posts + tags)
│   │   ├── blog/tagged/[slug].astro  Per-tag filter routes (getStaticPaths over tags)
│   │   ├── contact.astro          Contact form (Web3Forms). 2nd CSP-hashed inline script.
│   │   ├── log-admin.astro        Private Attention Log admin page (Access-gated, noindex)
│   │   └── 404.astro              Win95 "illegal operation" error dialog
│   ├── lib/                     Build-time data fetchers (10s timeout + empty fallback each)
│   │   ├── substack.js            Substack archive/RSS → posts + tags
│   │   ├── goodreads.js           Goodreads "currently-reading" RSS → books
│   │   ├── trakt.js               Trakt history → recently-watched (fallback for About)
│   │   ├── attention.js           Reads public /api/attention at build → bakes curated list
│   │   ├── favorites.js           Reads public /api/favorites at build → Favorites explorer + groupByCategory() [PR #45]
│   │   └── build-info.js          Commit SHA + date → <body data-build> stamp
│   └── styles/                 CSS, imported in cascade order. tokens → reset → … → components
│       ├── tokens.css            CSS custom props: colors (both themes), type scale, z-index
│       ├── reset.css  fonts.css  Baseline + @font-face
│       ├── layout.css            THE layout engine: per-page CSS grid areas (source of truth)
│       ├── desktop.css window.css mobile.css   Desktop chrome, window chrome, mobile collapse
│       ├── components.css        In-window bits: headings, links, buttons, book/watch rows + notes
│       ├── favorites.css         About Favorites explorer: folder sidebar → cover grid → detail [#54]
│       ├── dialog.css startmenu.css boot.css cursor.css tweaks.css wallpaper.css   Feature styles
├── functions/                  Cloudflare Pages Functions (file-based routing under /api/)
│   └── api/
│       ├── hits.js              GET /api/hits — KV visitor counter (bound HITS)
│       ├── attention.js         GET /api/attention — PUBLIC read of KV `published` (build reads this)
│       ├── favorites.js         GET /api/favorites — PUBLIC read of KV `favorites` (Favorites feature) [PR #45]
│       └── admin/              GATED by Cloudflare Access (the curation API). KV bound ATTENTION.
│           ├── search.js         GET  — search proxy: TMDB (film/TV), Google Books, IGDB (games), iTunes+Deezer (music), Crossref (papers) [PR #45]
│           ├── item.js           POST/DELETE — upsert/remove; ?list=favorites|published routes to either KV key [PR #45]
│           ├── publish.js        POST — fires the deploy hook. PURE trigger, no KV write.
│           ├── sync-goodreads.js POST — mirror Goodreads shelf into KV `published` (Phase 2)
│           ├── suggestions.js    GET  — Trakt candidates minus published/dismissed (Phase 3 inbox)
│           ├── dismiss.js        POST — add an id to KV `dismissed` (Phase 3)
│           ├── _goodreads.js     (shared, non-route) syncGoodreads() merge logic
│           ├── _trakt.js         (shared, non-route) getTraktSuggestions() logic
│           └── _kv.js            (shared, non-route) isRateLimit() — maps KV write-rate errors → 429
├── scripts/
│   ├── compute-csp-hashes.cjs   CSP gate: hashes inline scripts in dist/, --check verifies _headers
│   └── pixelate-wallpaper.py    Offline asset tool: renders day/night pixel-art wallpapers
│                                (Bayer dither; deps: Pillow, numpy).
├── .github/
│   ├── workflows/ci.yml         CI: npm ci + build + audit
│   └── dependabot.yml           Weekly npm + actions updates
└── docs/
    ├── architecture.md          The layout-engine mental model
    ├── design-system.md         Colors, type, voice (the "why" behind the visuals)
    └── FILE-TREE.md             This file
```

## Quick "where do I…" lookup

| I want to… | File(s) |
| --- | --- |
| Add/change a page | `src/pages/<route>.astro` |
| Change the OS shell (nav, taskbar, Start menu) | `src/layouts/Layout.astro` + `public/scripts/*.js` |
| Change colors / type / theme | `src/styles/tokens.css` |
| Change the grid layout of a page | `src/styles/layout.css` |
| Add a build-time data source | new `src/lib/<source>.js` (copy the goodreads.js shape) |
| Touch the curation API | `functions/api/admin/*` (+ `public/scripts/log-admin.js` for UI) |
| Add browser interactivity | new `public/scripts/<name>.js` + `<script is:inline src>` (NEVER inline a block) |
| Change response headers / CSP | `public/_headers` (rerun the CSP gate) |

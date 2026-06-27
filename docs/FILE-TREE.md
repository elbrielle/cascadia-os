# File tree — annotated map

Where everything lives and what it does. Keep this current when you add/move/
remove a meaningful file. Pairs with `../CLAUDE.md` (rules) and
`architecture.md` (mental model). Generated assets (`dist/`, `node_modules/`)
and binary media (fonts, images, wallpaper, cursors, resume PDF) are omitted —
only files an agent reads or edits are listed.

```
.
├── CLAUDE.md                    Agent entry point — rules, commands, decisions, doc index
├── README.md                   Human-facing run/deploy overview + integrations table
├── astro.config.mjs            Astro config: static output (default), site, trailingSlash:"always", @astrojs/sitemap integration
├── package.json                Deps (astro ^6, @astrojs/sitemap, rss-parser) + scripts (dev/build/preview)
├── public/
│   ├── _headers                Cloudflare response headers — CSP (2 inline-script hashes!), HSTS, etc.
│   ├── robots.txt              Welcomes crawlers, points at sitemap-index.xml, disallows /log-admin + /api/ [#138]
│   ├── scripts/                ONLY log-admin.js now — every other browser script moved to
│   │   │                        src/scripts/ (build-pipelined, ?url-imported, fingerprinted) [#198–#201]
│   │   └── log-admin.js          Attention Log + Favorites admin UI (createList factory); Access-gated,
│   │                            served as a plain /scripts/ file (not fingerprinted) [PR #53]
│   ├── fonts/ images/ cursors/ wallpaper/ resume/ trophies/   Static assets (binary, not listed;
│   │                            trophies/ = the Trophy Case photos + the District video [#9];
│   │                            favicon set (favicon.ico + favicon-16/32.png + apple-touch-icon.png)
│   │                            and og-image.png social card live in images/ — wired in Layout.astro <head>)
├── src/
│   ├── layouts/
│   │   └── Layout.astro         The OS shell: sidebar nav, taskbar, scripts, view transitions.
│   │                            Contains 1 of the 2 CSP-hashed inline scripts (nav-sync).
│   ├── components/
│   │   ├── Window.astro         The reusable draggable window chrome.
│   │   ├── TagsWindow.astro     Blog tag-cloud window (shared by /blog + /blog/tagged; owns makeTagSizer) [#140]
│   │   └── AttentionLog.astro   attention.log icon grid + detail bar: reading/watched (synced) + games/music/articles (manual), Home-only [#44,#58,#59]
│   ├── scripts/                Browser JS, ?url-imported → fingerprinted /_astro files (immutable-cached).
│   │   │                        SHELL (imported in Layout.astro, every page) — order is the load contract:
│   │   ├── icons.js              Pixel-art SVG icons (nav + project tiles); window.CascadiaIcons
│   │   ├── tweaks.js             Settings panel: theme + font toggles (localStorage)
│   │   ├── system.js             Taskbar clock + KV visitor counter (reads /api/hits)
│   │   ├── windows.js            Draggable/min/max windows (pointer + CSS transform); window.CascadiaWindows
│   │   ├── startmenu.js          Win95 Start menu (+ openCredits); window.CascadiaStartMenu — MUST load before context-menu
│   │   ├── systray.js            Desktop taskbar Badges flyout: tooltips + labels panel
│   │   ├── mobile-collapse.js    Responsive <details> collapse: strips [open] at <=720px (CSS can't toggle [open])
│   │   ├── context-menu.js       Right-click desktop menu (Refresh / View source / Credits / Properties) [#118,#129]
│   │   ├── boot.js               Boot/splash screen (once-per-session gate)
│   │   ├── player-engine.js      window.CascadiaPlayer audio facade — MUST load before art-player (cross-page audio)
│   │   ├── art-player.js         CD-player UI on /art; binds its transport to CascadiaPlayer (global; no-op off /art)
│   │   ├── taskbar-player.js     Docked mini-player view + MediaSession (persists across navigation)
│   │   ├── scrollbar.js          Custom Win95 scrollbar — real-DOM bar (macOS won't draw native arrows/grip) [#132]
│   │   │                        ROUTE-SPLIT (imported only in the page that renders their guard element):
│   │   ├── attention-grid.js     Home attention.log icon grid → sticky detail bar [#59]
│   │   ├── avatar-dissolve.js    Home avatar Win95 block-dissolve reveal
│   │   ├── about-reveal.js       About "A Means to an End" #mte reader
│   │   ├── favorites-explorer.js  About Favorites explorer: folders → grid → detail [#54]
│   │   ├── explorer.js           Work page Win95 Explorer folder tree (<details.folder>)
│   │   ├── trophy-gallery.js     #tcg award gallery — shared by /about + /art (Vite dedups to one file) [#9]
│   │   ├── art-mobile.js         /art mobile window-switch chips
│   │   ├── filelist-menu.js      /art poetry file-list menu + view toggle
│   │   ├── notepad.js            /art poetry Notepad viewer (#np)
│   │   ├── visual-poem.js        /art animated-ASCII visual-poem viewer (#vpv)
│   │   └── contact-terminal.js   Contact terminal: typed boot + transmit bar (no-op off /contact)
│   ├── pages/                   One file per route (Astro file-based routing)
│   │   ├── index.astro            Home (intro + Build Log + attention.log featured panel) [PR #44]
│   │   ├── about.astro            About — README + Trophy Case stacked (left) + Favorites explorer (right) [#54,#9]
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
│   │   ├── build-info.js          Commit SHA + date → <body data-build> stamp
│   │   └── trophies.js            Trophy Case honors: static data + pixel-badge SVGs (local media, no fetch) [#9]
│   └── styles/                 CSS, imported in cascade order. tokens → reset → … → components
│       ├── tokens.css            CSS custom props: colors (both themes), type scale, z-index
│       ├── reset.css  fonts.css  Baseline + @font-face
│       ├── layout.css            THE layout engine: per-page CSS grid areas (source of truth)
│       ├── desktop.css window.css mobile.css   Desktop chrome, window chrome, mobile collapse
│       ├── components.css        In-window bits: headings, links, buttons, book/watch rows + notes
│       ├── favorites.css         About Favorites explorer: folder sidebar → cover grid → detail [#54]
│       ├── trophies.css          About Trophy Case: launcher list + maximized media gallery (global) [#9]
│       ├── contact-terminal.css  Contact terminal: fixed-dark console (tangerine/cream, no green) over the real form (global, scoped to .term)
│       ├── mobile-collapse.css    .m-collapse: native <details> styled as the Win95 [+]/[-] disclosure on mobile (44px tap target), plain heading on desktop
│       ├── dialog.css startmenu.css boot.css cursor.css tweaks.css wallpaper.css   Feature styles
├── functions/                  Cloudflare Pages Functions (file-based routing under /api/)
│   └── api/
│       ├── hits.js              GET /api/hits — KV visitor counter (bound HITS)
│       ├── attention.js         GET /api/attention — PUBLIC read of KV `published` (build reads this)
│       ├── favorites.js         GET /api/favorites — PUBLIC read of KV `favorites` (Favorites feature) [PR #45]
│       ├── _http.js             (shared, non-route) jsonResponse() + readArray() — imported by public + admin routes [PR #114]
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
│   └── pixelate-wallpaper.py    Offline asset tool: renders day/night pixel-art wallpapers from
│                                design-references/ masters (Bayer dither; deps: Pillow, numpy). See PROJECT-STATUS.
├── .github/
│   ├── workflows/ci.yml         CI: npm ci + build + audit (blocked on Actions billing — see CLAUDE.md)
│   └── dependabot.yml           Weekly npm + actions updates
└── docs/                        See CLAUDE.md "Doc index" for what each file is for
```

## Quick "where do I…" lookup

| I want to… | File(s) |
| --- | --- |
| Add/change a page | `src/pages/<route>.astro` |
| Change the OS shell (nav, taskbar, Start menu) | `src/layouts/Layout.astro` + `src/scripts/*.js` (shell scripts, `?url`-imported in Layout) |
| Change colors / type / theme | `src/styles/tokens.css` |
| Change the grid layout of a page | `src/styles/layout.css` |
| Add a build-time data source | new `src/lib/<source>.js` (copy the goodreads.js shape) |
| Touch the curation API | `functions/api/admin/*` (+ `public/scripts/log-admin.js` for UI — the one script still served from `public/`) |
| Add browser interactivity | new `src/scripts/<name>.js`, then `import x from "../scripts/<name>.js?url"` + `<script is:inline src={x}>` in the owning page or Layout (NEVER inline a block, NEVER a processed `<script>import>`) |
| Change response headers / CSP | `public/_headers` (rerun the CSP gate) |
| Add a new feature idea | `docs/ROADMAP.md` |
| Work on the Favorites feature | `docs/favorites-feature-spec.md` (spec + phase tracker) |

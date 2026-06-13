# Architecture

How the site fits together. Read top to bottom and you'll understand the mental
model — especially the layout system, which is the most non-obvious piece.

---

## It's a static site

`npm run build` runs every `.astro` page's frontmatter **once on your computer**
and writes plain `.html` / `.css` / `.js` into `dist/`. That folder is the
site — no server runs your code when someone visits. Two implications:

- **Build-time fetches** (Substack RSS, Goodreads RSS) happen in Node during
  the build. Posts and books are baked into the HTML. New ones appear on the
  next rebuild — schedule one on the host.
- **Browser-time JS** (drag, min/max, focus) runs in the visitor's browser.
  That's why `windows.js` is shipped; the RSS code is not.

Knowing which code runs **when** is the single most useful thing to keep in
your head.

---

## File map

```
public/                  served as-is from the site root
  scripts/               browser JS — windows.js, icons.js, system.js,
                         tweaks.js
  fonts/                 Sysfont, W95FA, Departure Mono (.woff2 + .woff)
  images/avatar.png      the Introduction-window portrait (64×64-native art, baked 2× → 128×128, PNG-8)
  images/og-image.png    1200×630 Open Graph / Twitter share card (avatar + name
                         + tagline)
  images/projects/       per-project tile logos
  wallpaper/             wallpaper-day.webp, wallpaper-night.webp

src/
  layouts/Layout.astro   shared shell: wallpaper, sidebar nav, taskbar, scripts
  components/Window.astro  the only reusable component — the draggable window
  lib/substack.js        getPosts() — parses elishalucero.substack.com/feed
  lib/goodreads.js       getCurrentlyReading() — parses user 12934617's RSS
  pages/                 ONE FILE PER URL (the router)
    index.astro    →  /
    about.astro    →  /about/
    work.astro     →  /work/
    blog.astro     →  /blog/
    contact.astro  →  /contact/
  styles/                imported in order from Layout.astro:
                         tokens.css → reset.css → fonts → wallpaper → desktop
                         → window → layout → components → tweaks → mobile
```

`public/` vs `src/` is the key split. Files in `public/` are copied verbatim
and reachable at the same path (`public/fonts/x.woff2` → `/fonts/x.woff2`).
Files in `src/` are *processed* — Astro compiles `.astro`, bundles CSS,
hashes assets.

---

## How a page becomes a page

`.astro` files have two parts: a **frontmatter** block (`---` fenced JS that
runs at build time) and a **template** (markup with `{ }` interpolations).
Pages wrap content in `<Layout>`; whatever sits between the tags is dropped
into Layout's `<slot />`.

```astro
---
import Layout from "../layouts/Layout.astro";
import Window from "../components/Window.astro";
import { getCurrentlyReading } from "../lib/goodreads.js";
const reading = await getCurrentlyReading(4);   // ← runs at BUILD time
---
<Layout title="…" pageTitle="About" current="about">
  <Window id="bio" title="README" width={580}>…</Window>
  <Window id="now" title="attention.log" width={460}>
    {reading.map((book) => <li>{book.title}</li>)}
  </Window>
</Layout>
```

The Layout supplies the wallpaper, the desktop icons sidebar (nav inlined in
`Layout.astro` — there's no separate `DesktopIcons` component), the taskbar,
and the script tags. The page supplies only what's unique.

---

## The layout system (the non-obvious piece)

**JS never owns positioning** — CSS handles
the default arrangement; JS only adds a drag delta on top.

### The container — `<main>`

`main[data-pages]` is a CSS Grid container. Per-page templates live in
`layout.css` inside a `@media (min-width: 62em)` block; each page (`page-home`,
`page-about`, `page-work`, `page-blog`, `page-contact`) defines its own
`grid-template-columns` and the slots for its `.layout__cell` children.
Below 62em the grid collapses to a single column and cells stack.

### Each window sits inside a fixed grid cell

Each `<Window>` is wrapped in a `.layout__cell` (e.g. `.home__intro`,
`.about__readme`) that holds the grid slot. The cell — not the window — owns
the layout position, so minimizing or hiding a window via `display: none`
never reflows its neighbors. Inside the cell the window stays a flex item
sized by its preferred width:

```css
.window {
  --preferred-width: 480px;        /* default; overridden by `width` prop  */
  flex: 1 1 0;
  min-width: 320px;
  max-width: min(92vw, var(--preferred-width));
}
```

Behavior by viewport — note the two breakpoints are deliberately different
layers (grid templates at 62em, the mobile restyle at 720px), and drag has its
own gate:

| Viewport | Behavior |
| --- | --- |
| ≥ 62em (992px) | Per-page grid template places each window in its slot; preferred widths cap how wide a cell can grow |
| 721–991px | Grid templates inactive → windows stack single-column, but the desktop styling (`mobile.css` not yet applied) remains |
| ≤ 720px | Mobile restyle: single-column stack, narrow sidebar, larger text, mobile taskbar (`mobile.css`) |

Drag is gated separately in `windows.js`: disabled at ≤ 720px **and** on any
coarse-pointer (touch-primary) device at every width — in the 721–991px band a
touch drag would shove stacked windows off-axis with no touch-friendly reset.
Mouse/trackpad users keep drag at any width ≥ 721px.

### The drag delta

Each window has two CSS custom properties on its style attribute, initially
`0px`:

```css
.window {
  transform: translate(var(--drag-x, 0px), var(--drag-y, 0px));
}
```

`windows.js`'s `pointermove` handler updates `--drag-x` and `--drag-y` via
`element.style.setProperty(...)`. The translate is a *delta on top of* the
window's flow position — so when the viewport resizes, the flow position
re-flows but the drag delta stays. Double-click a title bar to clear the
delta and snap back to the responsive position.

### Why never `left` / `top`

Changing `left`/`top` requires JS to recompute on every resize. CSS `translate`
on a normal flow item never disturbs the flow and never needs to be
recalculated — the browser's already doing all the responsive work.

---

## The script layer (`public/scripts/`)

Plain JavaScript loaded with `<script src="…">` from `Layout.astro`:

- **windows.js** — drag handling, focus, minimize/maximize, taskbar wiring.
  No layout logic.
- **icons.js** — injects the pixel-art SVGs (home/about/work/blog/contact +
  the project icons used in `data-icon="…"` spans). Sources of truth for the
  pixel grids.
- **tweaks.js** — the Settings panel (theme + font-smoothing toggles, persists
  to `localStorage`). Applies theme to the incoming document on
  `astro:before-swap` so navigations don't flash.
- **system.js** — the live clock + the hit counter LCD.

Each script self-registers an `astro:page-load` listener (fires on initial
document load AND after every `<ClientRouter />` view-transition swap) so
handlers reattach on the freshly-rendered DOM without stacking duplicates.

---

## Build-time data flows

### Substack (blog posts + tags)

`getPosts()` and `getTags()` in `src/lib/substack.js` both pull from
`https://elishalucero.substack.com/api/v1/archive` (Substack's public JSON
endpoint, which exposes `postTags` per post — the RSS feed strips those).
The two helpers share a single in-process cache so the build issues one
network call total. RSS is kept as a graceful fallback for posts only.
Both calls use a 10s `AbortSignal.timeout` so a stalled Substack doesn't
hang the build. Used by `index.astro` (Build Log, top 4 posts), `blog.astro`
(Posts window, full list + tag cloud), and `blog/tagged/[slug].astro`
(in-site tag filter routes built via `getStaticPaths`). Falls back to
placeholder posts/tags if the archive AND RSS are both unreachable.

### Goodreads (currently reading)

`getCurrentlyReading()` in `src/lib/goodreads.js` fetches
`https://www.goodreads.com/review/list_rss/12934617?shelf=currently-reading`,
parses Goodreads' custom RSS fields (`book_image_url`, `author_name`, etc.),
returns `{ title, author, link, image, averageRating }[]`. Used by
`about.astro`'s attention.log window. Uses the same 10s timeout + fallback
pattern.

Both rebuilds need network access at build time. The Cloudflare Pages build
environment provides this.

---

## Theming

Two themes share the same five named brand colors; only their roles invert.
Toggle by setting `<html data-theme="light|dark">`. The Settings panel
(`tweaks.js`) flips this and persists to `localStorage`. With no explicit
choice, `prefers-color-scheme` is honored.

Wallpaper is two .webp images (day/night, ~400 KB each at 2000px) swapped
purely in CSS — see `src/styles/wallpaper.css`. Full palette tables are in
`docs/design-system.md`.

---

## Common edits

| You want to… | Edit |
| --- | --- |
| Add a page | `src/pages/<name>.astro`, then add a nav entry in `Layout.astro` |
| Add a window | Drop a `<Window id="unique" title="…" width={N}>…` in any page |
| Add a project to Work | Add an `<li class="panel work-item">` in `work.astro` |
| Change a color | `src/styles/tokens.css` |
| Add a pixel icon | New SVG in `public/scripts/icons.js`; reference with `<span data-icon="key">` |

---

## Known TODOs

- **Web3Forms key** — paste into `contact.astro`'s hidden input to activate
  the form.
- **Scheduled rebuilds** — set up a Cloudflare build hook + cron so new posts
  + books appear without manual pushes.
- **Accessibility pass** — run the `design:accessibility-review` skill on a
  final build.

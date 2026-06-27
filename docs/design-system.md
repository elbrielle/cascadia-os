# Design System — Cascadia OS

The visual language of the site: brand colors, tokens, components, patterns.
This is the *reference* doc — for **how** the layout engine works, see
`architecture.md`.

---

## The core metaphor

The site is a **fake desktop operating system**. Protect the metaphor:

- The page background is the **desktop wallpaper**.
- Navigation is a column of **desktop icons** on the left.
- Content lives in **draggable windows**.
- A **taskbar** at the bottom mirrors open windows.
- Small touches (hit counter, Settings, file-path crumb) sell the era.

Colors, fonts, icons, copy — all retunable. The *behavior* (windows drag,
title bars look pressed, taskbar updates) is what makes it read as "an OS."

---

## Brand palette

> **Scope: this is the Cascadia 95 (retro) + base palette.** It lives in
> `src/styles/tokens.css` and drives the default/retro skin. The **Cascadia Aero**
> skin (`data-skin="aero"`) has its OWN, different palette since 2026-06-26 — sky-blue
> chrome + evergreen accent + aqua icons, with **orange fully retired** — defined
> entirely in `public/aero/frutiger-aero.css` and documented in
> **`docs/aero-design-system.md` → "## Locked palette"**. The two skins are intentionally
> separate; editing colors here affects 95, not Aero. Keep both alive.

Five named brand colors. Light "Ocean Breeze" / dark "Midnight Bay" share them
with inverted roles.

| Name | Hex | Role |
| --- | --- | --- |
| **Pacific Blue** | `#0FA3B1` | Title bars, structural accent (same in both themes) |
| **Icy Blue** | `#B5E2FA` | Light desktop ground / sky |
| **Porcelain** | `#F9F7F3` | Light window paper |
| **Vanilla Custard** | `#EDDEA4` | Warm pale — sand, secondary accent |
| **Tangerine Dream** | `#F7A072` | Coral — links, active states |

**Accent usage** — pure Tangerine `#F7A072` fails AA contrast as *text* on
Porcelain, so links use the deepened `#C8451A`. The literal Tangerine is
reserved for backgrounds / button fills where text sits on top of it.

Full token tables (chrome, bevels, wallpaper layers) are in `src/styles/tokens.css`.

---

## Typography

Three roles, all self-hosted in `public/fonts/`:

| Role | Font | Used for |
| --- | --- | --- |
| `--font-display-mega` | **Sysfont** | The giant page title (`Home`, `About`, …) |
| `--font-display` | **W95FA** | Window titles, headings, buttons |
| `--font-body` | **W95FA** | Paragraph text |
| `--font-mono` | **Departure Mono** | System labels, dates, clock, crumb |

Pixel rendering is the default (`-webkit-font-smoothing: none`). The Settings
panel exposes a "smooth" mode that swaps body text to a system sans for
readers who prefer anti-aliased type; chrome stays pixel.

Size tokens (`tokens.css`):

```
--text-xs    13px       --text-lg    22px       --text-huge  clamp(2.75rem, 8vw, 6rem)
--text-sm    15px       --text-xl    26px
--text-base  17px       --text-2xl   32px
```

---

## Layout dimensions

```
--taskbar-height   44px
--titlebar-height  34px       ← tall enough to grab easily
--sidebar-width    104px
--window-border    3px        ← thick enough to read as substantial chrome
--icon-size        48px
```

Spacing scale is a 4px base: `--space-1` 4 → `--space-2` 8 → `--space-3` 16 →
`--space-4` 24 → `--space-5` 40 → `--space-6` 64.

---

## Where the dials live

| You want to change… | File |
| --- | --- |
| Colors, fonts, spacing, sizes (the theme) | `src/styles/tokens.css` |
| Window frame look (bevels, title bar, drag affordance) | `src/styles/window.css` |
| Wallpaper, desktop icons, page title, taskbar | `src/styles/desktop.css` |
| Buttons, links, panels, book list, forms, marquee | `src/styles/components.css` |
| Which fonts load | `src/styles/fonts.css` + `public/fonts/` |
| Drag / focus / minimize behavior | `public/scripts/windows.js` |
| Pixel-art icon SVGs | `public/scripts/icons.js` |

**Start in `tokens.css`** — nearly everything references the tokens, so a
handful of values re-themes the whole site.

---

## Components

### Window (`Window.astro` + `window.css`)

The signature element. Title bar with min/max buttons, beveled body. Raised
outer bevel; sunken inner bevel for the paper.

```astro
<Window id="intro" title="Introduction" width={520}>
  …content…
</Window>
```

The `width` prop is a **preferred maximum**, not a fixed width. It's set as
an inline `--preferred-width` custom property; the window's `flex: 1 1 0` +
`max-width` lets it expand toward that cap inside its `.layout__cell` grid
slot and shrink below it when the slot is narrow. `min-width: 320px` is the
floor before mobile single-column stack takes over.

Drag is a CSS `transform: translate()` driven by `--drag-x` / `--drag-y`
custom properties that `windows.js` updates on `pointermove`. Double-click
the title bar to reset.

### Desktop icons (left sidebar)

Inlined in `Layout.astro` — not a separate component. Each icon is a fixed
48×48 cell with a pixel-art SVG below a label. The active page's icon is
highlighted via a dashed outline + accent label background.

### Taskbar (bottom)

Also inlined in `Layout.astro`. `windows.js` injects one button per window
(`buildTaskbar()`). The active window's button looks pressed-in; minimized
windows show italic muted text. Live clock in the bottom-right via
`system.js`.

### Avatar variants (`components.css`)

- `.avatar` — pixel-art SVG variant (96×96, sunken inset). Currently unused
  but kept for SVG-based portrait fallbacks.
- `.avatar--photo` — photo variant (128×128, `object-fit: cover`,
  `image-rendering: pixelated`). Used in the Introduction window with
  `/images/avatar.png` — a genuine **64×64-native, 38-colour pixel-art** portrait
  (Retro Diffusion), nearest-neighbour-doubled to a crisp **128×128 PNG-8** (~2 KB;
  each native pixel → a clean 2×2 block, so it can't blur). PNG, not WebP — iOS
  WebKit wouldn't render the WebP on mobile while desktop did. Served via
  `<img width="128" height="128">`;
  box width == asset width, so it integer-scales crisply at every device pixel
  ratio (1×/2×/3×).

### Book list (`components.css` → `.book-list`)

Goodreads currently-reading rendered as inset panels with a 48px cover, title
(linking to the book page), and author in mono.

### Other reusables

`.btn` / `.btn--primary` — beveled pixel button. `.panel` / `.panel-list` —
inset sunken cards. `.pixel-link` — icon + label list rows. `.tag` / `.tag-cloud`
— `#tag` pills. `.marquee` — restrained scrolling ticker (one line, hover
pauses). `.blink` — accent cursor blink.

---

## The layout pattern

The whole responsive layout is **CSS-driven, never JS-computed**. See
`architecture.md` → "The layout system" for the full mental model. The short
version:

1. `<main>` is a CSS Grid with a per-page template in `layout.css`
   (e.g. `.page-home`, `.page-about`). Each page declares its column tracks
   and named slots (`.home__intro`, `.home__build-log`, …) inside a
   `@media (min-width: 62em)` block. Below that breakpoint the grid
   collapses to a single column and cells stack.
2. Each `<Window>` is wrapped in a `.layout__cell` that occupies a fixed
   grid slot. The cell owns the layout; the window inside it stays
   `flex: 1 1 0; min-width: 320; max-width: min(92vw, var(--preferred-width))`.
3. JS only adds a drag delta via `transform: translate(var(--drag-x),
   var(--drag-y))`.

Result: at any viewport, windows sit in their per-page slots without
overlap, minimizing one never reflows its neighbors, and the drag offset
is a delta on top of the slot position — so resize never breaks anything.

---

## Motion

Animations are **short and snappy** — `--speed-fast: 90ms`, `--speed: 180ms`,
`--speed-page: 260ms`, plus an exit pair `--speed-exit: 140ms` /
`--ease-exit`. Enter and exit are deliberately asymmetric: things that arrive
(window mount, restore) settle in on `--speed`/`--ease-soft`; things that
leave (minimize) are shorter and accelerate away — a leaving element needs
less attention. The `--ease` token is `steps(4, end)` for a clipped, retro
feel; `--ease-soft` is a cubic-bezier for organic motion. Pixel/sprite
surfaces (cover reveals, segmented-control presses) always use the `steps()`
vocabulary, never the smooth curves.

The site honors `prefers-reduced-motion`. Window-pop (mount), window-close
(minimize), and window-open (restore) are keyframe animations on `.window`.
All three compose the user's `--drag-x` / `--drag-y` offsets so a
manually-positioned window animates from where it actually sits, not from
(0,0). After the initial pop, JS stamps `data-mounted` on the window and a
matching rule disables `window-pop` so removing `.is-opening` doesn't
re-trigger it. The `.is-dragging` rule **deliberately does not override
`animation`** — toggling that property between values would restart the
mount-pop animation on every drag release.

---

## Accessibility

- Body text vs paper: ≥ 4.5:1 (Ocean Breeze dark text on Porcelain passes
  with room).
- Title bar text vs gradient: same.
- Settings exposes pixel-vs-smooth font rendering so readers who struggle
  with bitmap text can flip to a system sans.
- All keyboard focusable elements have a visible 2px accent outline (`:focus-visible`).
- Drag is mouse/trackpad only — keyboard users don't need it (windows have
  fixed flow positions) and touch-primary devices have it disabled outright
  (windows.js gates on `pointer: coarse`); the maximize/minimize buttons are
  reachable by tab, with hit areas extended past the 22px bevel to meet
  target-size minimums.
- Run `design:accessibility-review` on the deployed site before launch.

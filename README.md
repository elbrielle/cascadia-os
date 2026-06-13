# elishalucero.com

My personal site, built to look and behave like an old desktop operating system. There's a wallpaper, windows you can drag around, desktop icons, a taskbar, a start menu, and a boot screen on the way in. I themed it after the Pacific Northwest and called it Cascadia OS, with a light mode (Ocean Breeze) and a dark one (Midnight Bay).

Live at [elishalucero.com](https://elishalucero.com).

## How it's built

It's an [Astro](https://astro.build) static site on Cloudflare Pages. Most of it is HTML and CSS with a few small vanilla-JS files for the desktop behavior: dragging windows, the start menu, the clock, the boot splash. A handful of Cloudflare Pages Functions handle the parts that need a server, like the visitor counter and a log of what's had my attention lately (books, shows, games, that sort of thing). Those lists come from Substack, Goodreads, and Trakt, pulled in when the site builds so the pages stay static.

If you want the details:

- [`docs/architecture.md`](docs/architecture.md) walks through the layout. The gist: the desktop is a CSS grid and JavaScript never sets positions. It only adds a drag offset through two custom properties, so resizing the browser never breaks the layout.
- [`docs/design-system.md`](docs/design-system.md) covers the colors, type, and why things look the way they do.

## Run it locally

Needs Node 22.12 or newer (Astro 6).

```bash
npm install     # once
npm run dev     # http://localhost:4321
npm run build   # builds the static site into dist/
```

## Good to know

- The whole file tree is annotated in [`docs/FILE-TREE.md`](docs/FILE-TREE.md).
- The Content Security Policy lives in `public/_headers` and pins a hash of the two inline scripts on the site. If you edit either one, rebuild and run `node scripts/compute-csp-hashes.cjs`, then paste the new hashes into `public/_headers`. Forget that step and the browser quietly blocks the script, which is an annoying thing to track down.
- The build pulls posts and reading data over the network. If a source is down, that section renders empty instead of failing the build, so a flaky connection never blocks a deploy.

## License

MIT. See [LICENSE](LICENSE).

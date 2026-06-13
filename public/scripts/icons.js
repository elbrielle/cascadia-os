/* ============================================================================
   icons.js  —  pixel-art icon system
   ----------------------------------------------------------------------------
   Each icon is a 16×16 ASCII grid. A character → palette lookup expands the
   grid into a tight SVG of <rect>s (run-length compacted per row).

   Mount: every [data-icon] element gets its innerHTML set to the matching SVG.
   Exposes window.CascadiaIcons for re-mounting if needed.

   Palette is aligned to the Ocean Breeze theme. These are clean PLACEHOLDERS —
   easy to redraw (just edit a grid) or replace with hand-made art. Elisha is
   making the real "about" (portrait) icon.
   ========================================================================== */

const PALETTE = {
  '.': null,          // transparent
  'k': '#11202A',     // ink outline
  'w': '#F9F7F3',     // porcelain / white
  'c': '#B5E2FA',     // icy blue (lit windows)
  't': '#0FA3B1',     // pacific blue (teal)
  'T': '#0A6D7A',     // deep pacific
  'o': '#F7A072',     // tangerine / coral
  'O': '#C8451A',     // deep coral
  'v': '#EDDEA4',     // vanilla custard (sand pale)
  'V': '#C8A858',     // vanilla shadow
  'a': '#FBBF24',     // amber (kept for the PC RGB fans)
  'g': '#8AA2A8',     // cool gray
  'G': '#5A6878',     // gray dark
  's': '#F0D4B0',     // skin (warm pale, peachy)
  'S': '#C89870',     // skin shadow
  'h': '#8B5A3C',     // hair (warm auburn — matches the portrait)
  'p': '#F7A072',     // coral accent
  'P': '#C8451A',     // deep coral accent
  'f': '#1A4D55',     // conifer dark
  'F': '#2E6B52',     // conifer mid
  'd': '#5A3A28',     // cedar dark / hair shadow
  'D': '#7A5240',     // cedar mid / hair highlight
  'r': '#C8451A',     // red/coral LED
  'n': '#2A7D4F',     // green LED
  '#': '#CDD8DD',     // cool surface
};

function renderIcon(grid) {
  const rows = grid.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n').map(r => r.replace(/\s+$/, ''));
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  let body = '';
  for (let y = 0; y < h; y++) {
    let runStart = -1, runColor = null;
    for (let x = 0; x <= w; x++) {
      const ch = rows[y][x];
      const color = ch ? PALETTE[ch] : null;
      if (color !== runColor) {
        if (runColor) body += `<rect x="${runStart}" y="${y}" width="${x - runStart}" height="1" fill="${runColor}"/>`;
        runColor = color;
        runStart = x;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}

/* ============================================================================
   Icon grids — 16×16.
   ========================================================================== */
const ICONS = {

  /* HOME — house: coral roof, teal walls, icy windows, coral door. */
  home: `
.......k........
......kkk.......
.....kOOOk......
....kOOOOOk.....
...kOOOOOOOk....
..kOOOOOOOOOk...
.kOOOOOOOOOOOk..
.kkkkkkkkkkkkk..
.kTcctttttccTk..
.kTcctttttccTk..
.kTtttttttttTk..
.kTtttooottttTk.
.kTtttoootttTk..
.kkkkkkkkkkkkk..
................
................
`,

  /* ABOUT — hand-drawn pixel-art portrait of Elisha (provided by Elisha;
     source SVG lives at /images/avatar-icon.svg). Rasterized to 48/96 PNG
     with nearest-neighbor so pixel edges stay crisp at the icon slot. */
  about: { image: "/images/avatar-icon.png", srcset2x: "/images/avatar-icon@2x.png" },

  /* WORK — briefcase in Vanilla Custard, clasps + coral lock detail. */
  work: `
................
......kkkk......
.....k....k.....
.....k....k.....
..kkkkkkkkkkkk..
.kvvvvvvvvvvvvk.
.kvvvvvkkvvvvvk.
.kvvvvokkovvvvk.
.kvvvvvkkvvvvvk.
.kvvvvvvvvvvvvk.
.kvVVVVVVVVVVvk.
.kvvvvvvvvvvvvk.
.kvvvvvvvvvvvvk.
..kkkkkkkkkkkk..
................
................
`,

  /* BLOG — a page with text lines. */
  blog: `
................
..kkkkkkkkkk....
..kwwwwwwwwk....
..kwTTTTTwwk....
..kwwwwwwwwk....
..kwTTTTwwwk....
..kwTTTTTTwk....
..kwwwwwwwwk....
..kwTTTTTwwk....
..kwTTTTTTwk....
..kwwwwwwwwk....
..kwTTTTwwwk....
..kwwwwwwwwk....
..kkkkkkkkkk....
................
................
`,

  /* CONTACT — envelope with a coral wax-seal under the V flap. */
  contact: `
................
................
..kkkkkkkkkkkk..
..kwwwwwwwwwwk..
..kwkwwwwwwkwk..
..kwwkwwwwkwwk..
..kwwwkwwkwwwk..
..kwwwwkkwwwwk..
..kwwwwoowwwwk..
..kwwwwoowwwwk..
..kwwwwwwwwwwk..
..kwwwwwwwwwwk..
..kkkkkkkkkkkk..
................
................
................
`,

  /* RSS — standard feed glyph as raw SVG: orange rounded square + white dot
     and two arcs. Vector keeps it crisp + recognizable at the ~18px corner,
     where the dot/arcs are illegible as a tiny pixel grid. */
  rss: { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#F7A072"/><circle cx="7" cy="17" r="2.6" fill="#FFFFFF"/><path d="M4 10.5a9.5 9.5 0 0 1 9.5 9.5" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/><path d="M4 4.5a15.5 15.5 0 0 1 15.5 15.5" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/></svg>` },

  /* SETTINGS — gear. */
  settings: `
................
.....k...k......
....k.k.k.k.....
....k.kkk.k.....
...kkkkkkkkk....
.kkkkGGGGGkkk...
.k.kGGGGGGGk.k..
.kk.GGGkGGG.kk..
.kk.GGkkkGG.kk..
.kk.GGGkGGG.kk..
.k.kGGGGGGGk.k..
.kkkkGGGGGkkk...
...kkkkkkkkk....
....k.kkk.k.....
....k.k.k.k.....
.....k...k......
`,

  /* AVATAR — same hand-drawn portrait as ABOUT. Registered for any surface
     that wants the portrait as an icon; the Home hero renders its own <img>
     directly (index.astro), not through this registry. */
  avatar: { image: "/images/avatar-icon.png", srcset2x: "/images/avatar-icon@2x.png" },

  /* CONIFER — small fir, for panel decoration. */
  conifer: `
........k.......
.......kfk......
......kfffk.....
.....kfFFfk.....
.....kfFFfk.....
....kfFFFFfk....
....kfFFFFfk....
...kfFFFFFFfk...
...kfFFFFFFfk...
..kfFFFFFFFFfk..
..kfFFFFFFFFfk..
.kfFFFFFFFFFFfk.
........d.......
........d.......
......kddk......
................
`,

  /* EMAIL — tiny envelope for contact links, with a coral wax-seal. */
  email: `
................
..kkkkkkkkkkkk..
.kwwwwwwwwwwwwk.
.kwkwwwwwwwwkwk.
.kwwkwwwwwwkwwk.
.kwwwkwwwwkwwwk.
.kwwwwkwwkwwwwk.
.kwwwwwkkwwwwwk.
.kwwwwwoowwwwwk.
.kwwwwwoowwwwwk.
.kwwwwwwwwwwwwk.
.kwwwwwwwwwwwwk.
..kkkkkkkkkkkk..
................
................
................
`,

  /* GITHUB — repo badge with GH letterforms. */
  github: `
................
..kkkkkkkkkkkk..
.kGGGGGGGGGGGGk.
.kGwwGwwGGwGGGk.
.kGwGGwGGGwGGGk.
.kGwGGwGGGwGGGk.
.kGwGGwwwGwGGGk.
.kGwGGwGGGwGGGk.
.kGwwGwwGGwwwGk.
.kGGGGGGGGGGGGk.
.kGGGkkkkGGGGGk.
.kGGkwwwwkGGGGk.
.kGGkwwwwkGGGGk.
..kkkkkkkkkkkk..
................
................
`,

  /* LINKEDIN — blue tile with "in". */
  linkedin: `
................
..kkkkkkkkkkkk..
.kTTTTTTTTTTTTk.
.kTTTTTTTTTTTTk.
.kTwTTTTwwwTTTk.
.kTTTTTTTTwTTTk.
.kTwTTTTTTwTTTk.
.kTwTTTTTTwTTTk.
.kTwTTTTTTwTTTk.
.kTwTTTTTTwTTTk.
.kTwTTTTwwwTTTk.
.kTTTTTTTTTTTTk.
.kTTTTTTTTTTTTk.
..kkkkkkkkkkkk..
................
................
`,

  /* THREADS — stylized @-with-tail on an ink tile. */
  threads: `
................
..kkkkkkkkkkkk..
.kkkkkkkkkkkkkk.
.kkkkwwwwwwkkkk.
.kkkwwkkkkkwkkk.
.kkkwkkwwwkwkkk.
.kkkwkkwkwkwkkk.
.kkkwkkwkwwwkkk.
.kkkwkkwwkkkkkk.
.kkkwwkkkkkkkkk.
.kkkkwwwwwwkkkk.
.kkkkkkkkkwwkkk.
.kkkkkkkkkkkkkk.
..kkkkkkkkkkkk..
................
................
`,

  /* SUBSTACK — stacked coral pages. */
  substack: `
................
...kkkkkkkkkk...
...koooooooook..
...koooooooook..
...kkkkkkkkkk...
...koooooooook..
...koooooooook..
...kkkkkkkkkk...
...koooooooook..
...koooooooook..
...koooooooook..
....koooooook...
.....koooook....
......kooook....
................
................
`,

  /* IDK CAN YOU — classroom question mark tile. */
  idk: `
................
..kkkkkkkkkkkk..
.kTTTTTTTTTTTTk.
.kTTTTwwTTTTTTk.
.kTTwwwwTTTTTTk.
.kTTwwwwTTTTTTk.
.kTTTTwwTTTTTTk.
.kTTTwwTTTTTTTk.
.kTTTwwTTTTTTTk.
.kTTTTTTTTTTTTk.
.kTTTwwTTTTTTTk.
.kTTTwwTTTTTTTk.
.kTTTTTTTTTTTTk.
..kkkkkkkkkkkk..
................
................
`,

  /* CCE — curriculum book with check mark. */
  cce: `
................
...kkkk..kkkk...
..kwwwwkkwwwwk..
.kwwwwkkkkwwwwk.
.kwwwwkttkwwwwk.
.kwwwkttttkwwwk.
.kwwkttkkttkwwk.
.kwwkkkwwkkkwwk.
.kwwwwwwwwwwwwk.
.kwwwwwwwwwwwwk.
.kwwTTTTTTTwwwk.
.kwwTTTwwTTwwwk.
.kwwwwwwwwwwwwk.
..kkkkkkkkkkkk..
................
................
`,

  /* GOODREADS — green book tile with a white G. */
  goodreads: `
................
..kkkkkkkkkkkk..
.kFFFFFFFFFFFFk.
.kFwwwwwwwwwFFk.
.kFwwFFFFFFFFFk.
.kFwFFFFFFFFFFk.
.kFwFFFFwwwwFFk.
.kFwFFFFwFFFwk.
.kFwwwwwFFFFwk.
.kFFFFFwFFFFwk.
.kFFFFFwwwwwFk.
.kFFFFFFFFFFFFk.
.kFFFFFFFFFFFFk.
..kkkkkkkkkkkk..
................
................
`,

  /* PLAY — app-store style play triangle. */
  play: `
................
..kkkkkkkkkkkk..
.kwwwwwwwwwwwwk.
.kwwTTwwwwwwwwk.
.kwwTTTTwwwwwwk.
.kwwTTTTTTwwwwk.
.kwwTTTTTTTTwwk.
.kwwTTTTTTwwwwk.
.kwwTTTTwwwwwwk.
.kwwTTwwwwwwwwk.
.kwwwwwwwwwwwwk.
.kwwwwwwwwwwwwk.
.kwwwwwwwwwwwwk.
..kkkkkkkkkkkk..
................
................
`,

  /* PC — glass-side desktop tower with RGB fans. */
  pc: `
................
...kkkkkkkkkk...
..kGGGGGGGGGk...
..kGwwwwwcGGk...
..kGwttttcGGk...
..kGwttttcGGk...
..kGGGGGGGGGk...
..kGGooGGaaGk...
..kGooooGaaaGk..
..kGGooGGaaGk...
..kGGGGGGGGGk...
..kGGnGGGrGGk...
..kGGGGGGGGGk...
...kkkkkkkkkk...
....kkkkkkkk....
................
`,

  /* BOT — Discord/request-bot style face for integrations. */
  bot: `
................
.....kkkkkk.....
...kkTTTTTTkk...
..kTTTTTTTTTTk..
.kTTTwwTTwwTTTk.
.kTTTwwTTwwTTTk.
.kTTTTTTTTTTTTk.
.kTTwTTTTTTwTTk.
.kTTTwwwwwwTTTk.
.kTTTTTTTTTTTTk.
..kTTTTTTTTTTk..
...kkkkkkkkkk...
.....k....k.....
....kk....kk....
................
................
`,

  /* ERROR — coral tile with a white X, for the 404 dialog. Matches the
     blocky github/linkedin tile aesthetic rather than a smooth circle. */
  error: `
................
..kkkkkkkkkkkk..
.kOOOOOOOOOOOOk.
.kOwOOOOOOOOwOk.
.kOOwOOOOOOwOOk.
.kOOOwOOOOwOOOk.
.kOOOOwOOwOOOOk.
.kOOOOOwwOOOOOk.
.kOOOOOwwOOOOOk.
.kOOOOwOOwOOOOk.
.kOOOwOOOOwOOOk.
.kOOwOOOOOOwOOk.
.kOwOOOOOOOOwOk.
.kOOOOOOOOOOOOk.
..kkkkkkkkkkkk..
................
`,

  /* POWER — teal tile with a white IEC power glyph (ring + top bar), for the
     Start menu's "Shut Down…" item. */
  power: `
................
..kkkkkkkkkkkk..
.kTTTTTwwTTTTTk.
.kTTTwwwwwwTTTk.
.kTTwwwwwwwwTTk.
.kTwwTTwwTTwwTk.
.kTwTTTwwTTTwTk.
.kTwTTTwwTTTwTk.
.kTwTTTTTTTTwTk.
.kTwwTTTTTTwwTk.
.kTTwwTTTTwwTTk.
.kTTTwwwwwwTTTk.
.kTTTTwwwwTTTTk.
.kTTTTTTTTTTTTk.
..kkkkkkkkkkkk..
................
`,

  /* FOLDER — manila folder for the Work page's "Selected Work" Explorer view.
     Vanilla-custard fill ('v') with a shaded front flap ('V'); ink outline. */
  folder: `
................
................
................
.kkkkk..........
.kvvvk..........
.kvvvkkkkkkkkk..
.kvvvvvvvvvvvk..
.kvvvvvvvvvvvk..
.kvVVVVVVVVVVk..
.kvVVVVVVVVVVk..
.kvVVVVVVVVVVk..
.kvVVVVVVVVVVk..
.kkkkkkkkkkkkk..
................
................
................
`,

  /* INFO — teal tile with a white "i", for the Start menu's "About" item. */
  info: `
................
..kkkkkkkkkkkk..
.kTTTTTTTTTTTTk.
.kTTTTTwwTTTTTk.
.kTTTTTwwTTTTTk.
.kTTTTTTTTTTTTk.
.kTTTTwwwTTTTTk.
.kTTTTTwwTTTTTk.
.kTTTTTwwTTTTTk.
.kTTTTTwwTTTTTk.
.kTTTTwwwwTTTTk.
.kTTTTTTTTTTTTk.
.kTTTTTTTTTTTTk.
.kTTTTTTTTTTTTk.
..kkkkkkkkkkkk..
................
`,
};

function mountAll() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    if (el.dataset.iconMounted === "1") return;
    const name = el.dataset.icon;
    const def = ICONS[name];
    if (!def) { el.textContent = "?"; return; }
    if (typeof def === "object" && def.svg) {
      // Raw-SVG icon (e.g. the RSS feed glyph) — vector, so it stays crisp and
      // recognizable at small sizes where a 16×16 pixel grid turns to mush.
      el.innerHTML = def.svg;
    } else if (typeof def === "object" && def.image) {
      // Image-backed icon (e.g. about/avatar uses the real avatar.png so the
      // sidebar portrait is byte-for-byte the source pixel art).
      const srcset = def.srcset2x ? ` srcset="${def.image} 1x, ${def.srcset2x} 2x"` : "";
      el.innerHTML = `<img src="${def.image}"${srcset} alt="" />`;
    } else {
      // String grid — pixel-art ASCII → SVG.
      el.innerHTML = renderIcon(def);
    }
    el.dataset.iconMounted = "1";
  });
}

window.CascadiaIcons = { mountAll, renderIcon, ICONS };
// Bootstrap on initial load + after every view-transition swap. Each
// [data-icon] span sets data-icon-mounted="1" after its first render so
// repeat calls only touch newly-injected spans on the swapped page.
document.addEventListener("astro:page-load", mountAll);

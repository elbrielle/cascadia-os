// ============================================================================
//  trophies.js  —  the About "Trophy Case": Elisha's teaching recognitions.
// ----------------------------------------------------------------------------
//  Static, hand-curated LOCAL data (no fetch) — each honor carries a little
//  pixel-art icon (icons.js idiom) and a media set (photos + the occasional
//  video) under public/trophies/. about.astro renders the launcher list and
//  emits a JSON manifest; public/scripts/trophy-gallery.js reads it and opens a
//  maximized photo/video viewer when a row is clicked. Honors with no media
//  (yet) show a short text card from `blurb` instead of a gallery.
//
//  Order = most-prestigious first. The DISTRICT finalist leads: it means top 3
//  in the whole district (picked from the campus winners), so it outranks the
//  campus win and carries the video. `featured: true` gives a honor the raised
//  hero tile. Facts come straight from the award media Elisha provided (Bowie
//  MS, Irving ISD, UBC), so keep them accurate: the CTE month is Sep 2024.
// ============================================================================

export const MEDIA_BASE = "/trophies/";

// Pixel-art badges — viewBox only (no width/height) so CSS sizes them; gold cup
// = a win, silver cup = a finalist, teal rosette = a nominee, ribboned medallion
// = a monthly honor. shape-rendering:crispEdges keeps the blocks sharp.
export const ICONS = {
  goldcup: `<svg viewBox="0 0 32 40" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="8" width="3" height="8" fill="#C98A18"/><rect x="4" y="14" width="3" height="3" fill="#C98A18"/><rect x="27" y="8" width="3" height="8" fill="#C98A18"/><rect x="25" y="14" width="3" height="3" fill="#C98A18"/><rect x="6" y="5" width="20" height="3" fill="#F4D04A"/><rect x="6" y="8" width="20" height="6" fill="#E6BA38"/><rect x="9" y="8" width="3" height="6" fill="#FBE38A"/><rect x="8" y="14" width="16" height="3" fill="#D99A21"/><rect x="11" y="17" width="10" height="3" fill="#C98A18"/><rect x="14" y="20" width="4" height="5" fill="#C98A18"/><rect x="9" y="25" width="14" height="3" fill="#D99A21"/><rect x="6" y="28" width="20" height="3" fill="#9A6A10"/></svg>`,
  silvercup: `<svg viewBox="0 0 32 40" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="8" width="3" height="8" fill="#7A8C96"/><rect x="4" y="14" width="3" height="3" fill="#7A8C96"/><rect x="27" y="8" width="3" height="8" fill="#7A8C96"/><rect x="25" y="14" width="3" height="3" fill="#7A8C96"/><rect x="6" y="5" width="20" height="3" fill="#F2F7F9"/><rect x="6" y="8" width="20" height="6" fill="#C2CFD6"/><rect x="9" y="8" width="3" height="6" fill="#FFFFFF"/><rect x="8" y="14" width="16" height="3" fill="#9FB0B8"/><rect x="11" y="17" width="10" height="3" fill="#8194A0"/><rect x="14" y="20" width="4" height="5" fill="#8194A0"/><rect x="9" y="25" width="14" height="3" fill="#9FB0B8"/><rect x="6" y="28" width="20" height="3" fill="#5E6E78"/></svg>`,
  rosette: `<svg viewBox="0 0 28 40" shape-rendering="crispEdges" aria-hidden="true"><rect x="9" y="22" width="4" height="14" fill="#0A5566"/><rect x="15" y="22" width="4" height="14" fill="#0A5566"/><rect x="9" y="34" width="4" height="2" fill="#073C49"/><rect x="15" y="34" width="4" height="2" fill="#073C49"/><rect x="10" y="4" width="8" height="2" fill="#168096"/><rect x="8" y="6" width="12" height="2" fill="#1E94AB"/><rect x="6" y="8" width="16" height="8" fill="#168096"/><rect x="8" y="16" width="12" height="2" fill="#1E94AB"/><rect x="10" y="18" width="8" height="2" fill="#168096"/><rect x="6" y="6" width="2" height="2" fill="#4FB8CC"/><rect x="20" y="6" width="2" height="2" fill="#4FB8CC"/><rect x="4" y="10" width="2" height="4" fill="#4FB8CC"/><rect x="22" y="10" width="2" height="4" fill="#4FB8CC"/><rect x="11" y="9" width="6" height="6" fill="#F4D04A"/><rect x="13" y="11" width="2" height="2" fill="#9A6A10"/></svg>`,
  star: `<svg viewBox="0 0 28 40" shape-rendering="crispEdges" aria-hidden="true"><rect x="10" y="2" width="4" height="12" fill="#A33A16"/><rect x="14" y="2" width="4" height="12" fill="#C8451A"/><rect x="10" y="12" width="8" height="2" fill="#E6BA38"/><rect x="8" y="14" width="12" height="2" fill="#F4D04A"/><rect x="6" y="16" width="16" height="8" fill="#E6BA38"/><rect x="8" y="24" width="12" height="2" fill="#D99A21"/><rect x="10" y="26" width="8" height="2" fill="#C98A18"/><polygon points="14,16 18,20 14,24 10,20" fill="#FFF3C4" shape-rendering="geometricPrecision"/></svg>`,
};

export const TROPHIES = [
  {
    id: "district", icon: "silvercup", tierClass: "finalist", tier: "FINALIST", tierLabel: "District finalist",
    featured: true,
    title: "District Teacher of the Year", year: "2025–26", sub: "Irving ISD · top 3 in the district",
    // Video first — it's the headline, so the gallery opens on it and plays.
    media: [
      { type: "video", src: "district-video.mp4", poster: "district-video-poster.jpg" },
      { type: "image", src: "district-01.jpg" },
      { type: "image", src: "district-02.jpg" },
    ],
  },
  {
    id: "campus", icon: "goldcup", tierClass: "win", tier: "WINNER", tierLabel: "Winner",
    title: "Teacher of the Year", year: "2025–26", sub: "Bowie Middle School · Irving ISD",
    media: [{ type: "image", src: "campus-01.jpg" }, { type: "image", src: "campus-02.jpg" }],
  },
  {
    id: "nom2425", icon: "rosette", tierClass: "nominee", tier: "NOMINEE", tierLabel: "Nominee",
    title: "Teacher of the Year", year: "2024–25", sub: "Nominee",
    media: [{ type: "image", src: "nominee2425-01.jpg" }],
  },
  {
    id: "cte", icon: "star", tierClass: "month", tier: "MONTHLY", tierLabel: "Monthly honor",
    title: "CTE Teacher of the Month", year: "Sep 2024", sub: "Career & Technical Education",
    media: [{ type: "image", src: "cte-01.jpg" }, { type: "image", src: "cte-02.jpg" }],
  },
  {
    id: "ubc", icon: "rosette", tierClass: "nominee", tier: "NOMINEE", tierLabel: "Nominee",
    title: "Outstanding Student Leader", year: "2020", sub: "UBC Faculty of Arts",
    blurb: "Nominated for an Outstanding Student Leader award at the UBC Faculty of Arts Dean's Reception for Graduating Student Leaders, 2020.",
    media: [],
  },
];

// Row caption: "2 photos · 1 video", or "details" when an honor has no media yet
// (clicking still opens a text card from `blurb`).
export const mediaLabel = (m) => {
  if (!m.length) return "details";
  const imgs = m.filter((x) => x.type === "image").length;
  const vids = m.filter((x) => x.type === "video").length;
  const parts = [];
  if (imgs) parts.push(imgs + (imgs > 1 ? " photos" : " photo"));
  if (vids) parts.push(vids + (vids > 1 ? " videos" : " video"));
  return parts.join(" · ");
};

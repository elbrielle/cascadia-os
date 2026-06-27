// ============================================================================
//  art.js  —  the Art page's curated, hand-authored LOCAL data (no fetch)
// ----------------------------------------------------------------------------
//  Mirrors trophies.js: a static module of relative media paths resolved to
//  absolute at the page (art.astro). The explorer (art-explorer.js) renders the
//  four media folders; each item's `type` routes it to a viewer on open:
//    photo | album  -> the reused maximized gallery (trophy-gallery.js, #tcg)
//    music          -> the CD player (#cdp)
//    poem           -> the Notepad pane (#np)
//    visual         -> the animated-ASCII viewer (#vpv)
//
//  PRESERVE ELISHA'S VOICE VERBATIM. The poem bodies, slide stanzas, album
//  captions, the Fragments description, credits, and the Instagram artist-note
//  are quoted source — copied exactly, NOT paraphrased, NOT reflowed, blank
//  lines and indentation intact. The no-em-dash house rule is WAIVED for this
//  quoted source (some poems use em dashes deliberately).
//
//  Paths match the on-disk asset tree under public/art/ (see docs/art-page-spec.md).
// ============================================================================

export const MEDIA_BASE = "/art/";

// --- Written poems (verbatim; column-0 inside the template literal so the
//     rendered <pre> matches the source exactly — do not re-indent these). ---

const POEM_BREVITY = `Brevity was never bred into me.
Words as confetti feathering a hardened shell.
A piñata, protected from the elements.
Cut off and distant; a trap that'll explode if hit.
Embellishing these stumbles into dances of elegance


Brevity was never bred into me.
So lately I've been training to cut out the irrelevant.
Take, and keep, ownership of these paintings,
don't try to sell it. Don't make this something it isn't.


This is woman on a mission. Love over hate
in my tunnel vision. Recognises limits exist,
but bets all kinds of shit against them.
Can't cleanse demons if you don't risk
letting them burn through a magnifying lens.


Look into the paper mache lungs
this confetti spews out of. Hovering over falsely
coloured skin. Airborne floating amidst
cardboard formed wrists that don't give up
even against imminent consequences.


Like sitting in that Honda Civic as an adult
who feels so small in her skin. Previous of kin
equipped with a 9mm and pissed—face—drunken—rage
aimed with a loaded chamber until
the parallel help notices the danger.


                     Falls behind.


You see, brevity was never bred into me.
But I'm slowly shredding off this confetti.
Please, drop that stick. Don't swing.`;

const POEM_LEAF = `One day I will point to a puddle and say ocean.
Put a piece of bark in your hand and say forest.
I'll wrap you in simple.
Leaf. Candle. Blanket. Warm. Love.
Until the day you look at a candle and see light.
Look at a lamp and see stars.
You will stand in an empty parking lot and say "look at this galaxy".
I will hold your hand and say, "look at this universe".

- Leaf
Jenny. Velazquez

We've been through a shipwreck.
Paint a storm brewing with our hearts on deck.
Let me be the last to hold your hand delicately, it's a Leaf.
The ridges in your fingertips ethereal and unique
like we need to retreat but the cabin door is locked
and the texture of your veins on loose leaf is the key.

I used to feel off-key, sounding the wrong the notes
off-beat before you caught me. Defibrillator shocked the melody.
The Candle of your heart sparking this rhythmic remedy
Wrapping me in a blanket keeping me heated when the winter breathes
with frostbite, attempting to mark its territory
destroying the warmth we keep inside.
Let me be the last to say that we'll fight, with fire in our words.
Brightening the sky with our masthead lights;

A white bulb powered by all of our epiphanies,
starboard red, port side green, pointing to a forest fire ahead of us,
a few miles out from the sea as lightning forms
from the storm of our built up energy and strikes the first tree.
It scores deep, but we're not keeping score.
Writing to a score we both speak.
The chord progression overtaking us,
reaching unused notes in harmony.

We touch land, at two in the morning,
finding ourselves in the middle of our forest with no foresight,
just a signal, a chorus to cast out, set about in orbit.
And this forest fire is burning wildly now
as we forfeit gravitational forces.
The cobbled ground looking like a hundred billion galaxies now.
Hand in hand, me and you, moving the universe around
bouncing on these galaxies with our footsteps
because I remember you mentioned falling in love
with the way it sounds.`;

const POEM_ONE_RHYTHM = `If the wind gets loud enough
when there are enough trees in the background
then the rustling of the leaves starts to sound a lot like an ocean
and the back and forth rhythm of the waves


In the same way
the sound of war
after so much of it
when there are enough gunshots in the background
starts to sound a lot less
like the ferocious pound of thunder
and more
like the gentle pattern of rain

Therefore,

If the wind gets loud enough
and starts to sound like an ocean
both of them
sounding the sway of rhythm—
the sound of back and forth—
then you know even Humanity,
who bears skin so soft,
could start to become coarse


If the wind starts to sound like an ocean
you'll realise they both create waves
and that the motion of them sway
so both sides eventually see their light of day
Humanity is a wave
and just like back becomes forth
peace becomes war


But,

If the wind gets loud enough
and the wind and ocean
both start to sound the same
then just like the wind and the ocean
maybe one rhythm
is from where we all came

Maybe today we're ignoring truth
ignoring the cadence telling us
we're all fundamentally
just a different form
of the same wave
just a different form
of back and forth


But one day we'll realise it
and no longer find ourselves standing
over the remains of those
who carried a different rhythm than us
and were regarded as an obstacle in our way`;

const POEM_GHOST = `Sometimes, I want to be a ghost
The kind of ones you may see on TV
They may walk through walls
or float through ceilings


But I want to walk through you
so I can see everything that you're feeling
So I don't have to guess about the pain you're hiding from me
Hiding from everybody


I want to be a ghost, that's invisible
That way every moment you feel down or depressed,
when you let no one around because you don't want anyone burdened with your mess,
you would still feel my presence
without needing to accept it
The air I travel through would be cold
so with every gust of wind you'd know someone cared
and wouldn't leave you alone


I want to be a ghost
so I could travel the middle land between Hell and man
And if he exists, tell the devil it's not a wise plan to take you yet
you've still got a ways to go
until you figure out where you stand in this life
How to stand on your own


I want to be a ghost
One that moved into whatever afterlife I would call home
only after I know you're safe
When you know you're more than skin and bone
That your body is more than some temporary loan to pay back
It's an investment
And every cent I own I'm putting in hoping you've declared an IPO
Because if the stock market rises
so would your soul
I want to be a ghost
So I don't have to contemplate
whether you're really gone
or still here
as one of those
So I don't have to believe
maybe
you became a ghost`;

// --- "what i chose" (2020) — five stanzas, verbatim from the slam-chapbook PDF.
//     Re-typeset live as serif text over a per-slide animated ASCII background. ---
const WHAT_I_CHOSE_SLIDES = [
  {
    roman: "I.",
    ascii: "tide",
    text: `I spoke to God,
hands dipped into the shoreline
of the Vancouver Pacific.
She said, "Everything will be fine.
This is all for peace of mind.
To piece it together, my
fragmented,
never idle,
ignition."`,
  },
  {
    roman: "II.",
    ascii: "drift",
    text: `I share my favourite music
as if spreading my own ashes
over the ocean. Every track lives
in the soul of those I see myself in;
the edges of distinct relationships
softened by the overlap.`,
  },
  {
    roman: "III.",
    ascii: "static",
    text: `Showing compassion
has always been
how I heal.
Not by free-will;
conditioned,
still,
entangled
in what we chose.`,
  },
  {
    roman: "IV.",
    ascii: "bloom",
    text: `During February
I felt celebrated,
prayed to.
How else to repay that truth;
turn it
back to you.`,
  },
  {
    roman: "V.",
    ascii: "tide",
    text: `I spoke to God,
hands dipped into the high tide.
She said, "Everything will be fine.
This is all for peace of mind.
To piece it together, my
fragmented,
never idle,
ignition."`,
  },
];

// --- Fragments — verbatim official description, credits, and the Instagram
//     artist-note (the album intro). Copied exactly from Elisha's source. ---
const FRAGMENTS_NOTE =
  `Fragments is a portrait of disjointed ambition yearning for cohesion by way of finding out what gave rise to it in the first place. It is a mix of hip hop tracks with dense, fragmented lyricism, and a few spoken word pieces partly inspired by Dean Young's poem "The Invention of Heaven." Very grateful to the wonderful producers and engineers I got to work with in making this EP.`;

const FRAGMENTS_ARTIST_NOTE =
  `I made this album in 2019. It was one of my first complete projects and a signal to me that I could continue to grow in my writing through music. I have been writing since 14 years old, and this was me starting to truly believe in myself.

This album is rough around the edges. I am timid, not fully comfortable on a mic; Still struggling with gender and identity. Still hiding in a masculine body and finding my voice. I can hear the uncertainty. But I am also fully honest in my expression. I am also supported by amazing engineers, vocalists, friends. I still love it for that.`;

const FRAGMENTS_CREDITS =
  `Album mixing / mastering by Steel Tipped Dove. Vocal engineering by Travis Skjolde and myself. Production from Steel Tipped Dove, Dansovn, NoEx Beats, Urstruly, and Deergod. Some arrangements by myself. Track mixing from Ben Hixon (Dean Young) and producer Urstruly (Autopilot). Thanks Mimi Silver for the chorus on Dean Young.`;

const KUSH_CAPTION =
  `This is Kush and she low-key runs things around here by being both incredibly annoying and an absolute sweetheart. If holding a plate of food, she will wait—painstakingly patiently—with her head on your lap as a reminder to share. This lasts until the baby (inevitability) throws food she is bored of from her high-chair onto the floor. Kush will howl at the sound of everything and nothing. If she hears the wind change direction, then she must be let out into the backyard immediately on the off chance it beckoned a squirrel into it; Cheese snacks are the only way to bring her back during these episodes. She is perfect on walks. She is very bad at catching house flies, though she desperately tries. Most importantly, I'm very grateful to have her around to keep some structure in my post-grad, mid-pandemic, life.`;

const IRVING_CAPTION =
  `"...I give her my money, I wait for my change, but I feel like there's something more happening here. I feel like a warm mop bucket and dingy tiles that will never come clean. I feel like these freezers cannot be restocked often enough. I feel like trash cans of candy wrappers with soda pop dripping down the wrong side of the plastic. I feel like everything just got computerized..." — Buddy Wakefield, Convenience Stores`;

// --- helpers to keep the photo arrays DRY ---
const single = (id, title, alt) => ({
  id, type: "photo", kind: "photo", title,
  cover: `photography/singles/${id}-thumb.jpg`,
  images: [{ src: `photography/singles/${id}.jpg`, alt: alt || title }],
});
const album = (id, title, n, extra = {}) => ({
  id, type: "album", kind: "album", title,
  cover: `photography/albums/${id}/1-thumb.jpg`,
  images: Array.from({ length: n }, (_, i) => ({
    src: `photography/albums/${id}/${i + 1}.jpg`,
    thumb: `photography/albums/${id}/${i + 1}-thumb.jpg`,
    alt: `${title} — ${i + 1} of ${n}`,
  })),
  ...extra,
});

export const FOLDERS = [
  {
    key: "photography",
    label: "Photography",
    icon: "photo",
    // Order is intentional (Elisha's pick): the three featured albums lead the
    // board, then the three black-and-white singles, then the rest; the three
    // least-favored singles (composition / curious / levity) come dead last.
    items: [
      album("convenience-stores-south-irving", "convenience stores of (south) Irving", 5, {
        caption: IRVING_CAPTION,
        attribution: "Quote: Buddy Wakefield, Convenience Stores",
      }),
      album("my-wife-at-arboretum", "My Wife at Arboretum", 3),
      album("sweetheart", "Sweetheart", 3),
      single("valentine", "Valentine"),
      single("a-portrait", "a portrait"),
      single("a-trip", "a trip"),
      album("kush", "Kush", 3, { caption: KUSH_CAPTION }),
      album("perform", "Perform", 4),
      single("composition", "Composition"),
      single("curious", "Curious"),
      single("levity", "Levity"),
    ],
  },

  {
    key: "music",
    label: "Music",
    icon: "music",
    intro: { artist: "Elision", handle: "@elision.bri" },
    items: [
      {
        id: "fragments",
        type: "music",
        title: "Fragments",
        year: "2019",
        subtitle: "EP · hip-hop / rap · Dec 2019",
        cover: "music/fragments/cover.jpg",
        // Released on Spotify/Apple/SoundCloud, so it is NOT a full playthrough on
        // the site — Liner-Notes mode: the writing + links + a single hosted sample.
        playable: false,
        note: FRAGMENTS_NOTE,
        artistNote: FRAGMENTS_ARTIST_NOTE,
        credits: FRAGMENTS_CREDITS,
        tracks: [
          // Listing-only (not hosted) — durations shown for reference, no src.
          { n: "01", title: "Before the Invention (Poem One)", dur: 32 },
          // The one hosted SAMPLE: a clip of Dean Young from 2:09 to the end,
          // volume fading in 0→full across 2:09–2:11.
          { n: "02", title: "Dean Young (feat. Mimi Silver)", dur: 186, src: "music/fragments/02-dean-young.mp3", sample: { start: 129, fade: 2 } },
          { n: "03", title: "Derivatives (feat. Steel Tipped Dove)", dur: 165 },
          { n: "04", title: "Bridges (Poem Two) [feat. NoEx Beats]", dur: 47 },
          { n: "05", title: "Squad Verse Interlude", dur: 67 },
          { n: "06", title: "Autopilot (feat. Urstruly)", dur: 173 },
          { n: "07", title: "25 Kittens (feat. NoEx Beats)", dur: 211 },
          { n: "08", title: "Heaven, Not Quite Yet (Poem Three) [feat. NoEx Beats]", dur: 257 },
        ],
        links: {
          spotify: "https://open.spotify.com/album/1iaR93VU2fxq3Nq4NAax1t",
          apple: "https://music.apple.com/us/album/fragments/1493140144",
          soundcloud: "https://soundcloud.com/eli311lucero/sets/fragments",
        },
      },
      {
        id: "embroidered",
        type: "music",
        title: "Embroidered",
        year: "2025",
        subtitle: "5 demos · unreleased",
        producer: "Sorrow Bringer",
        cover: "music/embroidered/cover.jpg",
        tracks: [
          // Elisha's running order for the site: the title track leads.
          { n: "01", title: "Embroidered (Demo)", dur: 159, src: "music/embroidered/02-embroidered.mp3" },
          { n: "02", title: "Riddle (Demo)", dur: 103, src: "music/embroidered/01-riddle.mp3" },
          { n: "03", title: "Hourglass (Demo)", dur: 155, src: "music/embroidered/03-hourglass.mp3" },
          { n: "04", title: "Road Rash (Demo)", dur: 149, src: "music/embroidered/04-road-rash.mp3" },
          { n: "05", title: "Fall Apart (Demo)", dur: 125, src: "music/embroidered/05-fall-apart.mp3" },
        ],
        links: {},
      },
    ],
  },

  {
    key: "poetry",
    label: "Poetry",
    icon: "poem",
    intro: { note: "UBC slam chapbooks · “our failed sit down dinner” (2016) · “a delightfully pacifistic huddle of poes” (2017)" },
    // Reverse-chronological — the visual poem leads (it is the page's most
    // visual piece, and the icon view's standout tile), newest first then down.
    // "what i chose" opens the animated-ASCII slide viewer; the .txt poems open
    // Notepad.
    items: [
      { id: "what-i-chose", type: "visual", kind: "visual-set", title: "what i chose", year: "2020",
        attribution: "Title artwork “entangled in what we chose” by RW",
        cover: "visual/what-i-chose/title.jpg",
        titleArt: { src: "visual/what-i-chose/title.jpg", alt: "entangled in what we chose — painting by RW" },
        slides: WHAT_I_CHOSE_SLIDES,
        pdf: "visual/what-i-chose/what-i-chose.pdf" },
      { id: "brevity", type: "poem", kind: "poem", title: "Brevity", year: "2017",
        source: "a delightfully pacifistic huddle of poes · UBC, 2017", poemText: POEM_BREVITY },
      { id: "leaf", type: "poem", kind: "poem", title: "Leaf", year: "2017",
        source: "a delightfully pacifistic huddle of poes · UBC, 2017",
        attribution: "Co-written with Jenny Velazquez", poemText: POEM_LEAF },
      { id: "one-rhythm", type: "poem", kind: "poem", title: "One Rhythm", year: "2016",
        source: "our failed sit down dinner · UBC, 2016", poemText: POEM_ONE_RHYTHM },
      { id: "i-want-to-be-a-ghost", type: "poem", kind: "poem", title: "I Want to Be a Ghost", year: "2016",
        source: "our failed sit down dinner · UBC, 2016", poemText: POEM_GHOST },
    ],
  },
];

// Count of openable pieces in a folder (covers/tracks/slides), for the rail badge.
export const folderCount = (f) =>
  f.items.reduce(
    (n, it) => n + (it.images?.length || it.tracks?.length || it.slides?.length || 1),
    0,
  );

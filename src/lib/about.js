/* ============================================================================
   about.js  —  data for the About page's "A Means to an End" reader (#mte)
   ----------------------------------------------------------------------------
   A paged green-terminal BBS reader opened from the README's closing highlight.
   Markup: src/pages/about.astro. JS: public/scripts/about-reveal.js.

   Each frame is { roman, blocks: [...] }. A block is ONE of:
     { p: "text" }                prose paragraph. [bracketed] runs render as <mark>.
     { lead: "text" }             a short intro line (image-forward frames).
     { aside: "text" }            an italic PS line (Elisha's /slashed/ notes).
     { img: "name.jpg", label, alt, caption, link? }
                                  a SINGLE photo placed inline to break the prose.
                                  `label` shows on a translucent bar over the photo;
                                  the full `caption` shows on enlarge (tap).
     { grid: { images: [{name, alt, caption?}], caption?, link? } }
                                  a bottom contact sheet. A grid `caption` shows once
                                  beneath the sheet (Elisha's "one caption for all");
                                  otherwise each image carries its own (on enlarge).

   Photos: public/about/means-to-an-end/<name> + a /thumbs/<name> for the sheet +
   inline display; the full file loads only on enlarge.

   Prose is Elisha's, VERBATIM (em dashes are intentional — do not strip).
   Inline `label`s + grouped-grid captions are drafts for her to rewrite.
   ========================================================================== */

export const MTE_MEDIA_BASE = "/about/means-to-an-end/";

const GSMARENA_RANT = "https://www.gsmarena.com/samsung_m540_rant-2526.php";
const GSMARENA_HERO = "https://www.gsmarena.com/htc_hero-2820.php";

export const MEANS_TO_AN_END = {
  title: "A Means to an End",
  epigraph: "Before I had language for systems, I had the problem of limits.",
  frames: [
    {
      roman: "I",
      blocks: [
        { p: `The summer of my seventh-grade year, my mother offered that she could afford either a cellphone or an internet plan while I stayed home. In my hands sat a Samsung Rant, a week later—a slide-out keyboard, unlimited texting, live TV, and pseudo-WAP webpages on a two-inch screen— and I was ready to conquer my social life.` },
        { img: "samsung-rant.jpg", label: "Samsung Rant on Sprint", alt: "A purple Samsung Rant 2008 slider phone with its keyboard slid out.", caption: "The Samsung Rant on Sprint, my first phone. It was between this or the Motorola Razr, but I thought the keyboard was cool.", link: GSMARENA_RANT },
        { p: `As for the internet…I found a way to packet-sniff and crack a WEP key for my neighbor's Wi-Fi. [Not because I cared about networking or hacking] (I actually hated it, my father was a network engineer), but because I needed Wi-Fi to play World of Warcraft and Miniclip on my HP Pavilion.` },
      ],
    },
    {
      roman: "II",
      blocks: [
        { p: `Then I fell in love with smartphones. My first, the HTC Hero, turned tinkering into something closer to obsession.` },
        { img: "htc-hero.jpg", label: "HTC Hero", alt: "An HTC Hero on Sprint, showing the HTC Sense flip clock.", caption: "The HTC Hero, my first Android. I remember thinking HTC was making Android beautiful, more striking than the iPhone.", link: GSMARENA_HERO },
        { p: `I found a forum called XDA-Developers and began rooting my Android device, flashed custom ROMs, and taught myself whatever tools were required: IDEs, GIMP, Photoshop, Illustrator, etc.` },
        { img: "xda-forum.jpg", label: "XDA-Developers", alt: "A screenshot from approximately 2009-2010 of the XDA-Developers forum index.", caption: "XDA-Developers. I wish I could remember how I found it. What was the Google search that led me here?" },
        { p: `I made themes other people could download. I spent a part time jobs worth of time every week recoloring, texturing, or recreating hundreds of interface files—[Not because I primarily loved bootloaders or layer masking]—so that I could create real interface looks that either me or others wanted.` },
        { aside: `(On the side, I had an iPod Touch that I would also jailbreak for custom packages through Cydia. But, I never admitted it because my friends knew me as the iPhone hater.)` },
        {
          grid: {
            images: [
              { name: "htc-one-splash.jpg", alt: "A handwritten custom boot splash on an HTC One reading 'this phone has not been tampered with'.", caption: "A custom boot splash for my HTC One." },
              { name: "htc-one-ig.jpg", alt: "An Instagram post showing a gold HTC One M7, captioned 'Easily the best phone I've ever owned.'", caption: "The HTC One M7, posted to Instagram in 2013: 'Easily the best phone I've ever owned.'" },
            ],
          },
        },
      ],
    },
    {
      roman: "II · themes",
      blocks: [
        { lead: `Some home screens I themed. I cringe. But I also love that I even did it.` },
        {
          grid: {
            caption: "A run of home screens I themed, 2012.",
            images: [
              { name: "theme-5.jpg", alt: "A blue themed Android home screen with the HTC flip clock and weather for Irving." },
              { name: "theme-1.jpg", alt: "A themed Android home screen." },
              { name: "theme-2.jpg", alt: "A themed Android home screen with recolored widgets." },
              { name: "theme-3.jpg", alt: "A themed Android home screen." },
              { name: "theme-4.jpg", alt: "A themed Android home screen with a custom clock." },
              { name: "theme-6.jpg", alt: "A themed Android home screen." },
            ],
          },
        },
        {
          grid: {
            caption: "The tree-of-apps theme on my HTC One. As I got older, I like to think I started to develop some actual aesthetic taste.",
            images: [{ name: "theme-7.jpg", alt: "An HTC One showing a custom tree-of-apps home screen theme." }],
          },
        },
      ],
    },
    {
      roman: "III",
      blocks: [
        { p: `The XDA community became a form of education. I was a kid on XDA talking with adults (I know…) across the world through forums, instant messenger, and IRC channels. I begged my dad to take me to a convention called The Big Android BBQ. I ended up with a plethora of Android devices throughout the next five years, mostly HTC. Every new device became another surface to open, modify, and push past what it was supposed to do. At 14 years old, I was even given the highly coveted title of "XDA Developers "Recognized Themer""` },
        { aside: `Devices I remember owning: HTC: Hero, EVO Shift, EVO 4G, EVO 3D, One M7, Jetstream, Nexus 5, Nexus 7, Note 5 , and Google Pixel.. My last Android phone was in 2020…` },
        {
          grid: {
            caption: "The Big Android BBQ, 2012. The closest thing to a tech conference I had at that age: keynotes, the session board, and a lot of inflatable Androids.",
            images: [
              { name: "bbq-1.jpg", alt: "A keynote slide reading 'Welcome to the Big Android BBQ' under a green fiber-optic chandelier." },
              { name: "bbq-3.jpg", alt: "The Big Android BBQ session schedule board." },
              { name: "bbq-2.jpg", alt: "A conference talk with a slide of Android drag-handling code." },
              { name: "bbq-4.jpg", alt: "A giant inflatable green Android wearing an 'HTC quietly brilliant' sign." },
              { name: "bbq-5.jpg", alt: "An 'Undead Android' booth with a zombie Android mascot." },
            ],
          },
        },
      ],
    },
    {
      roman: "III · devices",
      blocks: [
        { lead: `The lineage: phones I owned, hacked, and a couple I only got to play with.` },
        {
          grid: {
            images: [
              { name: "moment-ig.jpg", alt: "An Instagram post of a Samsung Moment slider phone, captioned about how badly I had wanted it." },
              { name: "evo-3d.jpg", alt: "An HTC EVO 3D, shown front and back." },
              { name: "evo-shift-4g.jpg", alt: "An HTC EVO Shift 4G with its slide-out keyboard open." },
              { name: "nexus-4-ig.jpg", alt: "An Instagram post of a Nexus 4 showing the Google Play Music library." },
              { name: "nexus-5.jpg", alt: "A Nexus 5 on the KitKat home screen." },
              { name: "note-5.jpg", alt: "A white Samsung Galaxy Note 5, seen from the back." },
              { name: "tablets.jpg", alt: "A collection of Android tablets laid out in cases." },
              { name: "pixel.jpg", alt: "A Google Pixel phone in its retail box." },
            ],
          },
        },
      ],
    },
    {
      roman: "IV",
      blocks: [
        { p: `During high school, I started growing into app development. I built a basic web wrapper for my school district's grade system so students could check grades on mobile. I built a quiz game for an AP US History project. As college grew closer, the teachers, peers, and adult figures around pushed me towards computer science.` },
        {
          grid: {
            caption: "StudentConnection: the grade-checker I built so my district's students could see grades on their phones.",
            images: [
              { name: "app-directory.jpg", alt: "The StudentConnection school directory, a grid of Irving ISD campuses." },
              { name: "app-news.jpg", alt: "A StudentConnection school news list for Jack E. Singley Academy." },
              { name: "app-4.jpg", alt: "The StudentConnection navigation drawer: Grades, School Directory, Rebuild Form." },
            ],
          },
        },
        {
          grid: {
            caption: "Where I built it: Android Studio, the SDK manager, GitHub, Photoshop, and XDA always open.",
            images: [{ name: "dev-setup.jpg", alt: "A laptop screen with Android Studio, the SDK manager, GitHub, Photoshop, and XDA tabs open." }],
          },
        },
      ],
    },
    {
      roman: "V",
      blocks: [
        { p: `When I got to college, I entered the University of British Columbia with a scholarship and direct acceptance into computer science. I struggled. My heart wasn't in it. Without everyone encouraging that path, I realized I didn't love coding. What I loved was what coding helped me uncover. My passion was not graphic design; It was understanding how we interact with and are affected by user experiences—being able to manipulate them and learning whatever tools I needed to get there.` },
      ],
    },
    {
      roman: "VI",
      blocks: [
        { p: `In 2016, I ended up taking a semester to explore: my identity, what my teenage passions meant. How they were a means to an end. And to what end did it serve now? I am so lucky I found Cognitive Systems. At the time, a very early program that explored intelligent systems, both natural and artificial. It bridged computer science, linguistics, cognitive science, machine learning, and the study of how minds model the world. It gave me language for my impulse.` },
        { img: "ubc-grad.jpg", label: "UBC convocation, 2022", alt: "Elisha in a black graduation cap and gown and round glasses, smiling and holding a navy University of British Columbia diploma folder against a UBC-branded backdrop.", caption: "Convocation at the University of British Columbia, 2022. I graduated in Cognitive Systems, the thing that finally gave my teenage tinkering a name." },
      ],
    },
    {
      roman: "VII",
      blocks: [
        { p: `I am passionate about understanding and deconstructing systems as a means to an end. As a means to make constraints visible enough for people to see where the system ends and their agency begins` },
      ],
    },
  ],
};

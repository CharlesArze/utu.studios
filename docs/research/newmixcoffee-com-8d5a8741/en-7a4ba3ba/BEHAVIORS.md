# Behaviors — newmixcoffee.com/en

Extracted from the site's own Next.js/Turbopack bundle (readable, unminified
enough to trace exact algorithms) plus the SSR'd HTML in
`docs/research/.../page.html` (kept in the scratchpad, not committed).
This is ground truth, not visual guessing.

## 1. Hero "grain dust" particle system (Section 0 background)

Source: chunk `14mi0bklv8h5w.js` (bundles `gsap`, `ScrollTrigger`, `Lenis`
naming, and a `brandParticles` canvas component). Confirmed: it is a pure
Canvas 2D procedural noise system — **not** WebGL, **not** an image-reveal
mask. "start with mix" / "StartWithMix.png" is a plain static PNG; the
canvas layers are decorative dust behind/around it.

Three stacked `<canvas>` elements (`o`, `a`, `c`), each sized to the
parent wrapper (`offsetWidth`/`offsetHeight`), `position:absolute`,
`pointer-events:none`, appended in order o → a → c (c on top):

- **Layer o** — static noise, painted once via `putImageData`.
  `count: 200000`, `alphaMin: 10`, `alphaMax: 60`, color `rgb(80,80,80)`.
  60% of points cluster around 20 random "attractor" centers (spread
  40–340px, Gaussian jitter via Box-Muller transform), 40% fully random.
- **Layer a** — static noise, same attractor logic, `count: 110000`,
  `alphaMin: 15`, `alphaMax: 90`, same color. Additionally gets `8000`
  small filled circles (`arc`, radius 0.5–1.2px, alpha 0.03–0.18) drawn
  on top with `fillStyle rgba(80,80,80,alpha)`.
- **Layer c** — animated: `600` dots (radius 0.5–1.5px, same gray),
  each orbiting its origin via `sin/cos(time*speed+phase)` (amplitude
  ~8px), redrawn every frame (`clearRect` + redraw, not `putImageData`).
  **Cursor repel**: for each dot within 120px of the pointer, it's
  pushed radially away (`repelX/repelY` eased at 0.15 in / 0.92 decay
  out) — this is the "dust scatters away from your cursor" feel.

**Parallax on mousemove**: pointer position is normalized to [-1,1]
relative to the wrapper's center, then lerp-smoothed (`+= (target-current)
*0.06`). Layers are translated by different multipliers of that smoothed
value: `o` × 10, `a` × 30, `c` × 20 (plus small independent sine/cosine
drift terms and a scroll-driven parallax offset). Because `a`'s
multiplier (30×) is 3× `o`'s, dragging the mouse fast visually "tears"
the grain apart — this is what reads as an "erase/reveal" gesture on
first look; it is really just differential parallax speed between noise
layers, no compositing trick involved.

**Reimplementation note**: reproduce the exact counts/alphas/color and
the lerp+multiplier parallax; the mouse-repel radius (120px) and easing
(0.15/0.92) for layer `c`'s animated dots. This is fully deterministic
from the algorithm above — no shader reverse engineering needed.

## 2. Section 0 scroll-pinned reveal sequence (GSAP ScrollTrigger)

`features-hero-clip` (`.sticky.top-0.h-screen`) is pinned via
`ScrollTrigger({trigger: <section0-wrapper>, scroller: <custom scroll
container>, start:"top top", end:"bottom bottom", scrub:true})`. As
scroll progress advances:
- `f` (the hero content column) translates up by `j` px (`-749` default,
  or `-(brandTextTop - 100/200)` depending on breakpoint).
- `g` (likely `features-hero-img` / brand-image wrapper) animates
  `clip-path: inset(0 0 100% 0)` → `inset(0 0 0% 0)` (bottom-up reveal),
  duration 0.2, same timeline position as the translate ("<").
- `y` and `k` refs (brand-text / brand-slogan) fade+slide in:
  `{opacity:0,y:20/30} → {opacity:1,y:0}`, durations 0.15, slightly
  staggered (`"-=0.1"`).
- The connecting SVG path (`.newmix-line-path`, the wandering curve to
  the 5 tag labels) draws progressively via manual `stroke-dasharray`
  computation from `getTotalLength()` — not a CSS animation. At
  progress `t`: drawn length = `t * totalLength`; dash pattern built as
  repeating `"2 2"` segments up to that length, then the remainder, then
  the gap to the end. The arrowhead (`polygon.line-end-arrow`) rotates
  to match the path's end tangent (`atan2` of the last two sampled
  points) and only becomes visible at full draw.
- `brand-dash-line` (small vertical dashed tick before the first video
  card) reveals the same way (`clip-path: inset(0 0 100% 0)` → `0%`).

Actual DOM order inside Section 0 (top→bottom): dashed tick line →
`brand-image` (small rounded video card, `BrandStory_1.mp4`, 226×166 /
400×294) → `brand-text` ("newmix explores new possibilities by mixing
and reinterpreting familiar elements") → `brand-slogan` ("Nothing is
new") → `brand-image-2` (wide rounded video card, `BrandStory_2.mp4`,
full-width/800px) with **"The new begins with the known." overlaid
centered on top of the video** (absolutely positioned text, not on bare
black) → the wandering SVG line with the 5 tag labels (`coffee`,
`k-culture`, `everyday life`, `journeys`, `rituals`) positioned along it
→ `text_logo.svg` (hidden `features-hero-logo`, opacity-0, fades in at
some scroll beat — treat as a late reveal, low priority) →
`StartWithMix.png` (`brand-line-slogan`, the big grain-styled wordmark
image) → `BrandImage_Desktop.webp` / `BrandImage_Mobile.webp`
(`features-hero-img`, `hidden lg:block` / presumably `lg:hidden`,
opacity-0→1 on reveal, big background photo, 2160×1440).

## 3. Gallery scroll track (27 items)

`div.gallery-track` (`max-w-[800px] lg:max-w-[1000px] mx-auto flex
flex-col`) stacks 27 `gallery_N.webp` images. Every item shares:
`width:65%`, `aspect-ratio:16/9`, `clip-path: inset(-1px 20%)` (crops
20% off each side, showing the center 60% width of the image at 16:9).
Only `--offset-x` (a CSS custom property, used for horizontal
translateX) differs per item — values zig-zag between roughly -15% and
+18% (full per-item list in `components/gallery-track.spec.md`). Each
`<img>` starts at `transform:scale(1.5)` (seen on the SSR'd last item);
treat as "each image scales 1.5 → 1.0 as it scrolls into/through the
viewport" (IntersectionObserver or scroll-progress driven — build with
a simple per-item IntersectionObserver + CSS transition, since we don't
have the exact trigger rootMargin from the bundle for this specific
piece). Section wrapper `mt-[-55vh] lg:mt-[-20vh]` pulls this content up
underneath the still-pinned Section 1 hero — i.e. the gallery visually
scrolls "through"/behind the sticky hero clip before it unpins.

## 4. Products marquee

`div.marquee-wrap` (`h-[600px] lg:h-[920px] overflow-hidden`): plain DOM,
no canvas/WebGL involved (initial guess was wrong — confirmed via
`drawImage` grep across every JS chunk: zero matches). Structure:
- Two edge-fade `<div>`s (`w-[120px]`, `linear-gradient(to
  right/left, #000 0%, transparent 100%)`), opacity toggled 0↔1 via a
  0.5s transition — almost certainly fed by "at scroll start/end of the
  track" logic (fade the edge you can still scroll toward).
- `div.marquee-track` (`flex items-end w-max h-full pb-[70px] lg:pb-[60px]`),
  32 `div.marquee-item` children — the 16 `mix_1..16.png` product photos
  duplicated once (`mix_1..16` then `mix_1..16` again) for a seamless
  looping horizontal marquee. Item height `322px` (mobile) — check `lg:`
  variant when building. Build as a CSS `@keyframes translateX(-50%)`
  infinite marquee (duration tuned to feel ~time-driven, not
  scroll-driven) — this matches "auto-playing carousel" from the
  interaction checklist.

## 5. Offline Store cards

Each of the 3 cards (Seongsu/Anguk/Hannam) is actually a **mini image
carousel**, not a single static photo: `relative h-full` →
`overflow-hidden` → `flex h-full` → one-or-more `relative w-full h-full
shrink-0` slides, with prev/next arrow buttons using
`/carousel/desktop_left.svg` / `desktop_right.svg` (`Previous`/`Next`
`aria-label`s) and dot indicators (Korean aria-labels leaked into the EN
locale — e.g. `"슬라이드 3로 이동"` — copy verbatim for fidelity, it's a
source-site bug, not something to "fix" in the clone). Only one image
per store was present in this SSR snapshot (arrows may be vestigial for
single-image stores, or additional slides load client-side) — build the
carousel shell (arrows + dots) generically but it's fine if a store
only ever shows 1 slide.

Card content overlay: `absolute bottom-0 left-0 right-0 h-[125px]
lg:h-[200px]` with a `bg-gradient-to-b from-white to-[rgba(6,6,6,0.4)]
mix-blend-multiply` scrim, then `h3` (name, 24/36px bold), `p` (address,
12/16px, white/70), `a` (View Location → real Google Maps URL, opens in
new tab, underlined, small arrow-triangle SVG icon inline), `p` (hours,
12/16px, white/70, margin-top 2/3).

## 6. Contact Us section
Heading + copy + "Contact Us" button (`href="/en/contact"`, bordered
pill, hover inverts to white bg/black text) + `contact_po.mp4` video
(137px mobile / 393px desktop tall, `w-auto shrink-0
pointer-events-none`, autoplay/loop/muted) placed to the side of the
copy.

## 7. Footer
Two layouts (`lg:hidden` mobile block confirmed; assume a parallel
`hidden lg:flex` desktop block exists — not fully captured, build
consistent with the mobile block's content/links, adapting to a
horizontal layout at `lg`). Contains: `Footer_animation_mobile.mp4` /
`Footer_animation_desktop.mp4` background video (same poster), email
link with a **double-underline hover-swap** (two absolutely positioned
`::after`-like spans: one visible underline that scales out on hover,
one invisible one that scales in — `origin-right scale-x-100
group-hover:scale-x-0` / `origin-left scale-x-0 group-hover:scale-x-100`,
300ms `cubic-bezier(0.33,1,0.68,1)`), nav links (Home/Products/Projects/
Stores/Contact/Behind) with the same underline-swap hover, address
("40, Changdeokgung 1-gil, Seoul, Korea"), copyright "2026 newmix All
rights reserved.", Terms of Service / Privacy Policy links.

## 8. Global patterns
- Custom scroll container (not native `<body>` scroll) — see
  PAGE_TOPOLOGY.md. No Lenis smooth-scroll wrapper class found active on
  `<html>`/`<body>` in the live DOM despite the library being bundled;
  build with native scroll inside the fixed container (`overflow-y:auto`)
  and skip Lenis unless the user reports the real site feels smoother.
- Link/nav hover pattern used everywhere: either opacity 70%→100% (top
  nav) or double-underline scale swap (footer links), both 200–300ms
  `cubic-bezier(0.33,1,0.68,1)`.
- Monochrome palette only — see PAGE_TOPOLOGY.md "Palette".
- Fonts: SF Pro (latin) + Pretendard (Korean), both self-hosted variable
  fonts, `font-weight: 100 900`.

## Known approximations (flagged, not silently guessed)
- Gallery-track per-item scroll trigger (exact rootMargin/threshold) was
  not recovered from the bundle in the time spent; implemented as a
  per-item IntersectionObserver scale-in (1.5→1.0) as a faithful-looking
  approximation of "each image un-zooms as it enters view." If this
  doesn't match on QA, it's the first thing to revisit.
- Footer desktop layout structure was not captured from the SSR snapshot
  (only the `lg:hidden` mobile block was). Built to be visually
  consistent with the mobile block's content at `lg`, not verified
  pixel-for-pixel against the live desktop footer.
- Responsive breakpoints (1440/768/390) are inferred from Tailwind
  classes only — `resize_window` does not change the real viewport in
  this sandboxed browser (see PAGE_TOPOLOGY.md). Not empirically
  verified.

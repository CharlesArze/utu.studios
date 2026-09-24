# Page Topology — newmixcoffee.com/en

Source: https://newmixcoffee.com/en
site-key: newmixcoffee-com-8d5a8741 · page-key: en-7a4ba3ba

Global scroll model: the page is NOT native-scrolled. A fixed div
(`.scrollbar-hide.fixed.left-0.right-0.bottom-0.top-[72px]`) with
`overflow-y-auto` and hidden scrollbar is the real scroll container,
positioned below a fixed top nav (72px / 80px on lg). Its child
`.white-bg-content` (scrollHeight ~7560px at 748px viewport width) holds
every section. A separate `position:fixed inset-0` `<canvas>` (z-30,
pointer-events:none) renders the drag-to-reveal hero art on top of
everything, independent of the scroll container.

Font stack: self-hosted variable fonts, no Google Fonts.
- `SF Pro` — `/font/SF-Pro-Subset.woff2` (latin body/UI text)
- `Pretendard` — `/font/PretendardVariable.woff2` (Korean text support)
Both declared with `font-weight: 100 900` (variable) and `font-display: swap`.

Palette: pure monochrome. `#000` background, `#fff` text/foreground,
grays `rgb(23,23,23)` / `rgb(26,26,26)` / `#f5f5f5` for secondary
surfaces/text, plus white at 30/40/50/70% opacity for muted text and
hover dividers. No accent color anywhere observed.

Nav (fixed, top, height 72px / 80px lg): logo "newmix" (SVG wordmark) +
hamburger on mobile; on lg, inline links `Products / Projects / Stores /
Contact / Behind` (white, opacity-70 → opacity-100 on hover, 200ms
`cubic-bezier(0.33,1,0.68,1)`) + language switcher (KOR/ENG/JPN/CHN/TWN,
current = ENG).

## Sections (top to bottom, offsets measured inside `.white-bg-content`)

| # | offsetTop | height | Name | Interaction model |
|---|-----------|--------|------|--------------------|
| 0 | 0 | ~1×viewport (h-dvh) | Tagline / statement | static, fade-in on load |
| 1 | ~465 | 1×viewport (h-screen, sticky) | Hero pin (drag-reveal canvas + "Drag to mix") | drag/pointer-driven canvas reveal |
| 2 | ~1000 | ~3325px (`mt-[-55vh]` overlap) | Gallery scroll track (27 items) | scroll-driven (pin + progress-driven image sequence) |
| 3 | ~4324 | 725px | Products (heading + CTA) + marquee (3 canvas tracks) | marquee = time-driven auto-scroll, canvases likely WebGL image-distortion-on-hover |
| 4 | ~5048 | 1336px | Offline Store (heading + 3 store cards: Seongsu/Anguk/Hannam) | static, hover on cards |
| 5 | ~6384 | 315px | Online Store (heading + Store/Amazon US links) | static |
| 6 | ~6699 | 257px | Contact Us (heading + CTA + video accent `contact_po.mp4`) | static, autoplay muted loop video |
| 7 | ~6956 | 605px | Footer (nav links, address, copyright, Terms/Privacy, background video) | static, autoplay muted loop video (mobile/desktop variants) |

## Section 0 — Tagline / Statement
Container: `.relative.h-dvh.overflow-hidden.z-[1]` (bg-black, full first
viewport). Contains, top to bottom:
- "newmix explores new possibilities by mixing and reinterpreting familiar
  elements" (large statement line)
- "Nothing is new"
- "The new begins with the known."
- Tag pills: `coffee` `k-culture` `everyday life` `journeys` `rituals`

## Section 1 — Hero Pin (WebGL particle text)
Container: `.features-hero-clip.sticky.top-0.w-screen.h-screen`, with a
separate `position:fixed inset-0` `<canvas>` (z-30) on top of it. **This
is WebGL, not Canvas 2D** — an earlier pass guessed a
`globalCompositeOperation: "destination-out"` grain-reveal brush before
the real lazily-loaded `initHeroEngine` chunk was found. What actually
happens: "start with mix" is rasterized offscreen and sampled pixel-by-
pixel to seed a `THREE.Points` field (up to ~140k particles, one draw
call, `PointsMaterial` patched via `onBeforeCompile`). Particles fly in
on load (`windGather`: offset start position, per-particle delay/wobble,
expo-out ease), drift via a curl-noise force grid in the cursor-idle
state, and scatter/spring-return when the cursor drags across them (grid
receives the cursor impulse, particles sample it bilinearly — the cursor
never touches particles directly). Scrolling past this section drives
`morphProgress`, which retargets every particle from the text shape to
the site's wordmark and flips the color from white to black. Full
parameter extraction and the reimplementation live in
`heroEngine.ts`.
Copy overlay: "Drag to mix" (bottom-left small label, only in the very
first state).

## Section 2 — Gallery Scroll Track
Container: `section.gallery-section` (`z-[2]`, `overflow-hidden`,
`mt-[-55vh] lg:mt-[-20vh]` — pulls up under Section 1's pinned viewport,
i.e. this is the content that scrolls "through" the pinned hero).
Contains:
- `img.features-hero-logo` — opacity-0, pointer-events-none, `invert`,
  `lg:w-[220px]` — a hidden newmix logo mark, likely faded in at a
  specific scroll progress as a transition beat.
- `div.gallery-track` — `max-w-[800px] lg:max-w-[1000px] mx-auto flex
  flex-col` with **27 children**. This is the big one: needs a dedicated
  extraction pass (see `components/gallery-track.spec.md`) to catalog
  each of the 27 items (image vs. text vs. video), their aspect ratios,
  and the scroll-progress trigger for each (this is almost certainly an
  IntersectionObserver/scroll-progress driven sequence, not a native
  carousel).

## Section 3 — Products
`div` with heading "Products" / "Explore all newmix products—from mix
coffee to snacks." / "View All" CTA, `max-w-[1440px] mx-auto`.
Below it, `div.marquee-wrap` (`h-[600px] lg:h-[920px]`, `overflow-hidden`,
3 children) — this holds **3 unstyled `<canvas>` elements** (748×698 at
current viewport) with no Tailwind classes, strongly suggesting a
WebGL/canvas-rendered image marquee (likely 3 parallel tracks scrolling
at different speeds, each canvas doing image draw + possible
hover-distortion shader). No accessible DOM fallback text found — treat
as image-driven; extract actual marquee images via network request
capture, not DOM (see Pre-Flight follow-up).

## Section 4 — Offline Store
Heading "Offline Store" / description / "View All", then 3 store cards:
- **Seongsu** — "3, Yeonmujang 3-gil" · "View Location" · "MON-SUN 11am - 8pm"
- **Anguk** — "40, Changdeokgung 1-gil" · "View Location" · "MON-SUN 8am - 7pm"
- **Hannam** — "16-1, Itaewon-ro 54-gil" · "View Location" · "MON-SUN 11am - 8pm"
Each card likely has its own photo (needs per-card screenshot/asset pass).

## Section 5 — Online Store
Heading "Online Store" / "Shop newmix online. (Available in Korea and the
U.S.)" / two links: "Store" and "Amazon US".

## Section 6 — Contact Us
Heading "Contact Us" / "Contact us with any questions or inquiries." /
"Contact Us" CTA button / `hello@newmixcoffee.com`. Includes an inline
video `contact_po.mp4` (137px mobile / 393px desktop height, `w-auto
shrink-0 pointer-events-none`, autoplay/loop/muted) — a small looping
brand clip next to the copy.

## Footer
Nav re-listed (Home/Products/Projects/Stores/Contact/Behind), address
block ("40, Changdeokgung 1-gil, Seoul, Korea"), copyright "2026 newmix
All rights reserved.", Terms of Service / Privacy Policy links.
Background video: `Footer_animation_mobile.mp4` vs
`Footer_animation_desktop.mp4` (two sources swapped by breakpoint, same
poster), autoplay/loop/muted.

## Known assets (videos, discovered so far)
- `/home/BrandStory_1.mp4` (+ poster) — `object-cover`, full-bleed
- `/home/BrandStory_2.mp4` (+ poster) — `object-cover`, `h-auto`
- `/contact/contact_po.mp4` (+ poster)
- `/footer/Footer_animation_mobile.mp4` (+ shared poster)
- `/footer/Footer_animation_desktop.mp4` (+ shared poster)

## Environment limitation (flagged to user)
`resize_window` does not change the actual viewport in this sandboxed
browser (stuck at 748×465 regardless of requested size; `screen.width`
reports 1920×1080 available but window stays capped). Responsive
behavior below is inferred from Tailwind breakpoint classes in the DOM,
not empirically verified at 1440/768/390. Flag to user before Phase 5 QA.

"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import UtuLogo from "./UtuLogo";
import { useScroller } from "./ScrollShell";

const TAG_LABELS = [
  { text: "Diseño de Marca", x: 110, y: 137.5 },
  { text: "Diseño de Experiencia", x: 110, y: 172.5 },
  { text: "Desarrollo Web", x: 110, y: 207.5 },
  { text: "Producción de Contenido", x: 110, y: 242.5 },
];

const LINE_PATH =
  "M117.98.27c21.52,33.28-17.23,44.74-48.42,58.93S25.2,93.31,15.81,113.18c-17.94,37.96-19.28,85.81,3.72,121.88,36.11,56.62,118.62,74.26,168.69,25.29,30.7-30.03,40.24-78.07,23.93-117.73-28.23-68.65-114.35-85.94-170.29-37.51C-4.17,144.96-11.44,221.93,18.36,270.76c2.29,3.76,4.83,7.37,7.57,10.82,30.53,38.51,82.73,52.47,93.36,77.77";

/**
 * Sticky pin + GSAP ScrollTrigger `scrub` reveal — ported from the reference
 * site's own desktop implementation (function `j` in its bundle). The
 * wordmark and its first three companions (`.brand-dash-line`, `.brand-image`,
 * `.brand-text`) are revealed earlier, by the page-level hero->white landing
 * timeline (see `ScrollShell.tsx`) — this component starts with those already
 * visible and scrub-reveals everything after them as the user scrolls through
 * the pinned section, exactly like the reference.
 */
export default function StatementSection() {
  const pinRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const brandImage2Ref = useRef<HTMLDivElement>(null);
  const brandSloganRef = useRef<HTMLParagraphElement>(null);
  const lineWrapRef = useRef<HTMLDivElement>(null);
  const linePathRef = useRef<SVGPathElement>(null);
  const lineDotRef = useRef<SVGCircleElement>(null);
  const lineArrowRef = useRef<SVGPolygonElement>(null);
  const brandLineSloganRef = useRef<HTMLDivElement>(null);
  const scroller = useScroller();

  useEffect(() => {
    if (!scroller || !pinRef.current || !contentRef.current || !bgRef.current) return;
    gsap.registerPlugin(ScrollTrigger);

    function setup() {
      const pin = pinRef.current!;
      const bg = bgRef.current!;
      const content = contentRef.current!;
      const lineWrap = lineWrapRef.current;
      const brandImage2 = brandImage2Ref.current;
      const brandSlogan = brandSloganRef.current;

      // brandLineSlogan ("you to you") is the true last element revealed, sitting below and taller
      // than lineWrap — anchoring on lineWrap alone undershoots the real content bottom by ~260px,
      // so the pin's scroll range ends before the wordmark is ever fully scrolled into view.
      const anchor = brandLineSloganRef.current ?? lineWrap ?? brandImage2 ?? brandSlogan;
      let bottom = anchor ? anchor.offsetTop + anchor.offsetHeight : 0;

      const viewportH = window.innerHeight;
      const topOffset = window.innerWidth > 1024 ? 200 : 100;
      // Computed purely from brandSlogan's own position — with zero knowledge of brandImage2, which
      // sits further down and is only guaranteed a comfortable view if it happens to also fit above
      // the fold once slogan lands at topOffset. On a short viewport (or once brand-image-2 grew
      // taller from earlier edits) it doesn't: content stops rising with only image2's top edge
      // grazing into view from below, reported as "apenas se asoma" with nothing more appearing
      // after. Take whichever of the two needs MORE upward travel (the more negative value), so
      // reaching slideUp always clears both — slogan may land a little above its ideal topOffset
      // mark when image2 is the taller ask, which is the acceptable side to give on since slogan is
      // a brief passing moment the user keeps scrolling through regardless.
      const slideUpForSlogan = brandSlogan ? -(brandSlogan.offsetTop - topOffset) : -749;
      const slideUpForImage2 = brandImage2 ? viewportH - (brandImage2.offsetTop + brandImage2.offsetHeight) - 40 : slideUpForSlogan;
      const slideUp = Math.min(slideUpForSlogan, slideUpForImage2);

      if (lineWrap) {
        lineWrap.style.paddingBottom = "";
        const projectedBottom = bottom + slideUp;
        if (projectedBottom < viewportH) {
          lineWrap.style.paddingBottom = `${Math.ceil(viewportH - projectedBottom)}px`;
          // Padding lineWrap pushes every later sibling (brandLineSlogan included) down by the same
          // amount, so re-read from `anchor` rather than lineWrap directly to keep this in step with
          // the anchor fix above.
          bottom = anchor ? anchor.offsetTop + anchor.offsetHeight : bottom;
        }
      }

      const pinnedExtra = bottom + 90;
      const bgRange = -(bg.offsetHeight - (bg.parentElement?.offsetHeight ?? bg.offsetHeight));
      pin.style.height = `${viewportH + pinnedExtra}px`;

      const tl = gsap.timeline({
        scrollTrigger: { trigger: pin, scroller, start: "top top", end: "bottom bottom", scrub: true },
      });

      tl.to(content, { y: slideUp, duration: 0.25, ease: "none" });
      tl.fromTo(".brand-dash-line-2", { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.2 }, "<");
      // Absolute position, not "-=0.1" relative to the previous tween's end — that overlap put the
      // reveal in the TAIL of the content-y descent above, so by the time opacity finished at 1 the
      // slogan had already been carried almost all the way to its cramped near-top resting spot
      // (slideUp pins it topOffset=200px down), reading as "barely visible, and only once it's
      // already leaving". Slogan enters the viewport's bottom edge around t=0.075 of this same
      // descent (screenY = offsetTop + content.y crosses the viewport height there); starting the
      // reveal at 0.1 and finishing by 0.2 — before the descent's own 0.25 endpoint — means it's
      // fully opaque while still comfortably mid-screen, with room left to keep reading as it
      // finishes settling into place.
      tl.fromTo(".brand-slogan", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.1 }, 0.1);
      // Starting this early (was 0.22) trades away nothing: if it's still below the fold when the
      // fade starts, the fade just finishes before it's visible, so it's ALREADY fully opaque the
      // moment it scrolls into view — no visible fade-in lag either way. Waiting until 0.22 to start
      // was the direct cause of "se demora demasiado en salir, se asoma apenas un poco": the box
      // only had until 0.42 (the edge of the still window below) to go from invisible to fully
      // shown, and reported as barely peeking in before running out of runway. Starting at 0.05 gives
      // it the whole still window to arrive, comfortably done well before anything moves again.
      tl.fromTo(".brand-image-2", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.35 }, 0.05);

      const finalReach = -(bottom - viewportH);
      const linePath = lineWrap?.querySelector<SVGPathElement>(".newmix-line-path");
      if (linePath) {
        const total = linePath.getTotalLength();
        const drawState = { progress: 0 };
        const draw = (p: number) => {
          const dashed = p * total;
          const remainder = total - dashed + 10;
          if (dashed <= 0) {
            linePath.style.strokeDasharray = `0 ${total + 10}`;
            return;
          }
          const fullPairs = Math.floor(dashed / 4);
          const partial = dashed - 4 * fullPairs;
          let pattern = "2 2 ".repeat(fullPairs);
          if (partial > 2) pattern += `2 ${partial - 2} `;
          else if (partial > 0) pattern += `${partial} 0 `;
          pattern += `0 ${remainder}`;
          linePath.style.strokeDasharray = pattern;
        };
        draw(0);

        const arrow = lineWrap!.querySelector<SVGPolygonElement>(".line-end-arrow");
        const end = linePath.getPointAtLength(total);
        const prev = linePath.getPointAtLength(Math.max(0, total - 2));
        const angle = (Math.atan2(end.y - prev.y, end.x - prev.x) * 180) / Math.PI;
        const arrowScale = window.innerWidth > 1024 ? 0.8 : 1;
        arrow?.setAttribute(
          "transform",
          `rotate(${angle - 90}, ${end.x}, ${end.y}) translate(${end.x}, ${end.y}) scale(${arrowScale}) translate(${-end.x}, ${-end.y})`,
        );

        tl.to(".line-start-dot", { opacity: 1, duration: 0.15 }, 0.45);
        tl.to(drawState, { progress: 1, duration: 0.5, ease: "none", onUpdate: () => draw(drawState.progress) }, 0.45);
        if (brandImage2) {
          // Only accounted for brandImage2's own centre, with zero knowledge of lineWrap sitting
          // further down — on viewports where that centre-target lands short of what lineWrap needs,
          // the trace parks with its bottom half (including the end arrow) cut off below the fold for
          // the entire reveal window, reported as "no lo encuentro / queda hacia el fondo". Same fix
          // shape as slideUp above: take whichever candidate demands more upward travel.
          const lineSvgHeight = lineWrap!.querySelector("svg")!.getBoundingClientRect().height;
          const targetForImage2 = -(brandImage2.offsetTop + brandImage2.offsetHeight / 2);
          const targetForLine = viewportH - (lineWrap!.offsetTop + lineSvgHeight) - 40;
          const target = Math.min(Math.max(Math.min(targetForImage2, targetForLine), finalReach), slideUp);
          tl.to(content, { y: target, duration: 0.35, ease: "none" }, "<");
        }
        tl.to(".line-end-arrow", { opacity: 1, duration: 0.15 }, 0.8);
        // Each label widened from 0.04 (and the whole group from a combined ~0.14) to a much longer,
        // overlapping spread — same reasoning as the reveals above.
        for (let i = 1; i <= TAG_LABELS.length; i++) {
          tl.fromTo(`.line-label-${i}`, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25 }, 0.85 + i * 0.05);
        }
        tl.fromTo(brandLineSloganRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 1.1);
      }

      // Unconditional on purpose. `finalReach` is, by construction, exactly the content y that
      // brings `anchor` (brandLineSlogan) fully into view at the end of the scroll — it's the same
      // value `pinnedExtra`/the pin's own scrollable height was derived from. The synced tween above
      // only carries content to a clamped midpoint (brandImage2's centre), which "you to you" reveals
      // while still off-screen below the fold; gating this final push behind a condition meant to
      // detect "is there still a gap" left the wordmark stuck off-screen — its opacity already at 1,
      // permanently unreachable — whenever that condition didn't evaluate the way the gap actually
      // was. Always finishing at finalReach removes that failure mode: it's the correct rest position
      // regardless of where the synced tween left off.
      tl.to(content, { y: finalReach, duration: 0.15, ease: "none" });

      const preDuration = tl.duration();
      tl.to({}, { duration: (90 / pinnedExtra) * preDuration });
      const fullDuration = tl.duration();
      tl.fromTo(bg, { y: 0 }, { y: bgRange, duration: fullDuration, ease: "none" }, 0);
    }

    let ctx = gsap.context(setup, pinRef);

    // `viewportH`/`slideUp`/`pin.style.height` above are all computed once
    // from `window.innerHeight` — on mobile the browser chrome (address bar)
    // shows/hides as the user scrolls, changing that value after mount, so
    // without this the pinned section's height and the scroll-trigger's
    // start/end positions go stale and the page can fall short of its real
    // scrollable distance (content near the bottom becomes unreachable).
    // Rebuilding the whole timeline on resize keeps it honest.
    let resizeTimer: number | undefined;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        ctx.revert();
        ctx = gsap.context(setup, pinRef);
      }, 200);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      ctx.revert();
    };
  }, [scroller]);

  return (
    <div className="relative z-[1] bg-black">
      <div ref={pinRef} className="sticky top-0 relative h-screen overflow-hidden z-[1]">
        <div ref={bgRef} className="absolute inset-0 bg-[#FAA2CA]" style={{ height: "300%" }} />

        <div
          ref={contentRef}
          className="relative w-full flex flex-col items-center pt-[max(calc(25vh_-_16px),157px)] lg:pt-[max(calc(25vh_+_20px),243px)]"
        >
          {/* Starts at top:75vh, opacity:0. The hero->white landing timeline
              (ScrollShell.tsx) tweens it to top:25vh with opacity:1, tracking
              the particles that morph into this exact shape/position. Box
              size must match heroEngine.ts's computeMorphShape() targetW —
              bumped from 320 to 380 (+23px height) so the logo lands larger;
              the content pt- offset above was shifted by the same +23px to
              keep the same gap to the logo's now-lower bottom edge. */}
          <div
            data-hero-morph-target
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-black z-10 opacity-0"
            style={{ width: 380, height: 148, top: "75vh" }}
          >
            {/* Cropped to the glyph's own bounds (matches heroEngine.ts's
                computeMorphShape() and Nav.tsx) — the shared viewBox pads
                the glyph's bottom-right, which left both the static logo
                and the particle cloud it crossfades with sitting off-center
                to the left of this box. */}
            <UtuLogo className="w-full h-full" viewBox="11 5 1009 394" />
          </div>

          <svg
            className="brand-dash-line w-px pointer-events-none mt-[14px] lg:mt-[10px] h-[136px] lg:h-[248px]"
            style={{ clipPath: "inset(0 0 100% 0)" }}
            viewBox="0 0 1 136"
            preserveAspectRatio="none"
            fill="none"
          >
            <line x1="0.5" y1="0" x2="0.5" y2="136" stroke="#1a1a1a" strokeWidth="1" strokeDasharray="2 2" strokeLinecap="round" />
          </svg>

          {/* Placeholder — reference plays a video here (`brand-image`). Same box, ready to be
              swapped for a UTU piece. */}
          <div className="brand-image relative pointer-events-none opacity-0 mt-[25px] lg:mt-[30px] w-[226px] h-[166px] lg:w-[400px] lg:h-[294px] rounded overflow-hidden bg-black/10" />

          <p className="brand-text pointer-events-none opacity-0 font-light text-center text-[#1a1a1a] mt-[16px] lg:mt-[20px] w-full lg:w-[800px] px-6 lg:px-0 text-[14px] lg:text-[24px] tracking-[-0.072px]">
            UTU Studios da forma a marcas que perduran, uniendo estrategia, diseño y tecnología
          </p>

          <svg
            className="brand-dash-line-2 w-px pointer-events-none mt-[16px] lg:mt-[20px] h-[136px] lg:h-[248px]"
            style={{ clipPath: "inset(0 0 100% 0)" }}
            viewBox="0 0 1 136"
            preserveAspectRatio="none"
            fill="none"
          >
            <line x1="0.5" y1="0" x2="0.5" y2="136" stroke="#1a1a1a" strokeWidth="1" strokeDasharray="2 2" strokeLinecap="round" />
          </svg>

          <p
            ref={brandSloganRef}
            className="brand-slogan pointer-events-none opacity-0 font-medium text-center text-[#1a1a1a] mt-[16px] lg:mt-[20px] w-full lg:w-[800px] px-6 lg:px-0 text-[14px] lg:text-[36px] tracking-[-0.072px]"
          >
            Todo empieza en ti
          </p>

          {/* Placeholder — reference plays a video here (`brand-image-2`). aspect-[2400/1398]
              matches its poster so the box holds its shape without a video. */}
          <div
            ref={brandImage2Ref}
            className="brand-image-2 relative pointer-events-none opacity-0 mt-[16px] lg:mt-[20px] w-[calc(100%-48px)] lg:w-[800px] aspect-[2400/1398] rounded overflow-hidden bg-[#1a1a1a]"
          >
            <p className="absolute inset-0 flex items-center justify-center text-white text-center font-medium text-[18px] lg:text-[32px] tracking-[-0.072px] px-4">
              Lo nuevo nace de lo que ya eres.
            </p>
          </div>

          <div ref={lineWrapRef} className="pointer-events-none mt-[20px] lg:mt-[30px] w-[220px] lg:w-[468px] pb-[100px]">
            <svg className="w-full h-auto" viewBox="0 0 220.52 359.55" overflow="visible" fill="none">
              <circle ref={lineDotRef} className="line-start-dot" cx="117.98" cy="0.27" r="2.5" fill="#1a1a1a" opacity="0" />
              <path
                ref={linePathRef}
                className="newmix-line-path"
                d={LINE_PATH}
                stroke="#1a1a1a"
                strokeWidth="1"
                fill="none"
                strokeLinecap="round"
              />
              <polygon ref={lineArrowRef} className="line-end-arrow" points="119.29,359.55 115.29,351.55 123.29,351.55" fill="#1a1a1a" opacity="0" />
              {TAG_LABELS.map((label, i) => (
                <text
                  key={label.text}
                  className={`line-label line-label-${i + 1} text-[14px] lg:text-[13px]`}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  opacity="0"
                  style={{ fontWeight: 300, fill: "#1a1a1a" }}
                >
                  {label.text}
                </text>
              ))}
            </svg>
          </div>

          <div ref={brandLineSloganRef} className="brand-line-slogan w-full lg:w-[960px] mt-[15px] lg:mt-[35px] pb-16 opacity-0">
            <svg viewBox="0 0 960 164" className="w-full h-auto" aria-label="you to you">
              <defs>
                <filter id="grain-text" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>
              <text
                x="50%"
                y="60%"
                textAnchor="middle"
                filter="url(#grain-text)"
                style={{
                  fontSize: "120px",
                  fontWeight: 900,
                  fill: "#1a1a1a",
                  letterSpacing: "-12px",
                  // Bundled Helvetica Black local font (see layout.tsx) —
                  // matches heroEngine.ts's choice here.
                  fontFamily: "var(--font-helvetica-black)",
                  // Glyph height only, not font-size/width — matches the
                  // same compression applied to the hero particle text.
                  transform: "scaleY(0.85)",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              >
                you to you
              </text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

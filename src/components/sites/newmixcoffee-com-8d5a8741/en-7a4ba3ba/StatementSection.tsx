"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import UtuLogo from "./UtuLogo";
import BrandParticles, { type BrandParticlesHandle } from "./BrandParticles";
import BrandSnapMobile, { type BrandSnapMobileHandle } from "./BrandSnapMobile";
import { useVideoAutoplay } from "./useVideoAutoplay";
import { useScroller, useStatementHandle } from "./ScrollShell";

export type StatementSectionHandle = {
  handleSwipe: (direction: "down" | "up", source?: "wheel" | "touch") => void;
  reset: () => void;
};

const TAG_LABELS = [
  { text: "Diseño de Marca", x: 110, y: 137.5 },
  { text: "Diseño de Experiencia", x: 110, y: 184.2 },
  { text: "Desarrollo Web", x: 110, y: 230.8 },
  { text: "Producción de Contenido", x: 110, y: 277.5 },
];

const LINE_PATH =
  "M117.98.27c21.52,33.28-17.23,44.74-48.42,58.93S25.2,93.31,15.81,113.18c-17.94,37.96-19.28,85.81,3.72,121.88,36.11,56.62,118.62,74.26,168.69,25.29,30.7-30.03,40.24-78.07,23.93-117.73-28.23-68.65-114.35-85.94-170.29-37.51C-4.17,144.96-11.44,221.93,18.36,270.76c2.29,3.76,4.83,7.37,7.57,10.82,30.53,38.51,82.73,52.47,93.36,77.77";

/**
 * Sticky pin + GSAP ScrollTrigger `scrub` reveal for desktop — rebuilt
 * from scratch against the reference site's own bundle (chunk
 * `14mi0bklv8h5w.js`; see docs/research/.../TRAMO_HERO_TO_SLOGAN.md §3).
 *
 * Two DOM levels, matching the reference exactly (this was the actual
 * root cause of every "cut off / can't find it" report against the old
 * version, not the tween durations): an OUTER wrapper that receives the
 * scroll-distance height and is the ScrollTrigger `trigger`, and an INNER
 * `sticky` element that keeps its own `h-screen` and never gets an inline
 * height — it pins because its ancestor got taller, not because it did.
 */
export default function StatementSection() {
  const { handleRef, onSnapComplete, onSnapExitUp } = useStatementHandle();
  // Decided once on mount, not re-evaluated on resize — matches the
  // reference's own `M` wrapper (a mid-session breakpoint crossing would
  // need a full remount to switch scroll mechanisms anyway).
  const [mobile, setMobile] = useState<boolean | null>(null);
  const mobileRef = useRef<BrandSnapMobileHandle>(null);

  const wrapperRef = useRef<HTMLDivElement>(null); // outer — gets the extra height, is the trigger
  const pinRef = useRef<HTMLDivElement>(null); // inner — stays sticky/h-screen, no inline height
  const bgRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const brandImage2Ref = useRef<HTMLDivElement>(null);
  const brandSloganRef = useRef<HTMLParagraphElement>(null);
  const lineWrapRef = useRef<HTMLDivElement>(null);
  const linePathRef = useRef<SVGPathElement>(null);
  const brandLineSloganRef = useRef<HTMLDivElement>(null);
  const scroller = useScroller();

  const { videoRef: video1Ref, failed: video1Failed } = useVideoAutoplay();
  const { videoRef: video2Ref, failed: video2Failed } = useVideoAutoplay();

  useImperativeHandle(handleRef, () => ({
    handleSwipe: (direction, source) => mobileRef.current?.handleSwipe(direction, source),
    reset: () => mobileRef.current?.reset(),
  }));

  useEffect(() => {
    // Read once at mount, client-only (avoids an SSR/client `window` mismatch) —
    // the resulting `mobile === null` -> boolean transition is a deliberate one-time
    // branch switch, not a subscription, so it can't be modeled as "sync external state".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobile(window.innerWidth < 1024);
  }, []);

  useEffect(() => {
    if (mobile !== false) return;
    const particlesHost = bgRef.current?.firstElementChild as (HTMLDivElement & {
      __brandParticles?: BrandParticlesHandle;
    }) | null;

    if (!scroller || !wrapperRef.current || !pinRef.current || !contentRef.current || !bgRef.current) return;
    gsap.registerPlugin(ScrollTrigger);

    function setup() {
      const wrapper = wrapperRef.current!;
      const bg = bgRef.current!;
      const content = contentRef.current!;
      const lineWrap = lineWrapRef.current;
      const brandImage2 = brandImage2Ref.current;
      const brandSlogan = brandSloganRef.current;

      const anchor = brandLineSloganRef.current ?? lineWrap ?? brandImage2 ?? brandSlogan;
      let bottom = anchor ? anchor.offsetTop + anchor.offsetHeight : 0;

      const viewportH = window.innerHeight;
      const topOffset = window.innerWidth > 1024 ? 200 : 100;
      const j = brandSlogan ? -(brandSlogan.offsetTop - topOffset) : -749;

      if (lineWrap) {
        lineWrap.style.paddingBottom = "";
        const projectedBottom = bottom + j;
        if (projectedBottom < viewportH) {
          lineWrap.style.paddingBottom = `${Math.ceil(viewportH - projectedBottom)}px`;
          bottom = anchor ? anchor.offsetTop + anchor.offsetHeight : bottom;
        }
      }

      const pinnedExtra = bottom + 90;
      // The parallax bg's fixed "300%" (from the JSX) only ever buys 2 viewport-heights of
      // travel before it runs out and the section's own black bg shows through underneath —
      // fine when pinnedExtra happens to be under that, but this tramo's content (labels +
      // wordmark) routinely needs more. Size it to the pin's actual scroll distance instead,
      // so it always has exactly enough room to cover the full pin.
      bg.style.height = `${viewportH + pinnedExtra}px`;
      const bgRange = -(bg.offsetHeight - (bg.parentElement?.offsetHeight ?? bg.offsetHeight));
      // Height goes on the OUTER wrapper, never on the sticky pin itself.
      wrapper.style.height = `${viewportH + pinnedExtra}px`;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapper,
          scroller,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (self) => particlesHost?.__brandParticles?.setScrollParallax(self.progress, bgRange),
          onLeave: () => particlesHost?.__brandParticles?.stop(),
          onEnterBack: () => particlesHost?.__brandParticles?.start(),
        },
      });

      // Exact relative positions from the reference — see TRAMO doc §3.
      tl.to(content, { y: j, duration: 0.25, ease: "none" });
      tl.fromTo(".brand-dash-line-2", { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.2 }, "<");
      tl.fromTo(".brand-slogan", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.15 }, "-=0.1");
      tl.fromTo(".brand-image-2", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.15 });

      const finalReach = -(bottom - viewportH);
      const linePath = lineWrap?.querySelector<SVGPathElement>(".newmix-line-path");
      let target = j;
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

        tl.to(".line-start-dot", { opacity: 1, duration: 0.03 });
        tl.to(drawState, { progress: 1, duration: 0.35, ease: "none", onUpdate: () => draw(drawState.progress) });
        if (brandImage2) {
          target = Math.min(Math.max(-(brandImage2.offsetTop + brandImage2.offsetHeight / 2), finalReach), j);
          tl.to(content, { y: target, duration: 0.35, ease: "none" }, "<");
        }
        tl.to(".line-end-arrow", { opacity: 1, duration: 0.03 });
        for (let i = 1; i <= TAG_LABELS.length; i++) {
          tl.fromTo(`.line-label-${i}`, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.04 }, i > 1 ? "-=0.01" : undefined);
        }
        tl.fromTo(brandLineSloganRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.06, ease: "power2.out" });
      }

      if (finalReach < target) {
        tl.to(content, { y: finalReach, duration: 0.15, ease: "none" });
      }

      const preDuration = tl.duration();
      tl.to({}, { duration: (90 / pinnedExtra) * preDuration });
      const fullDuration = tl.duration();
      tl.fromTo(bg, { y: 0 }, { y: bgRange, duration: fullDuration, ease: "none" }, 0);
    }

    let ctx = gsap.context(setup, wrapperRef);

    let resizeTimer: number | undefined;
    const rebuild = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        ctx.revert();
        ctx = gsap.context(setup, wrapperRef);
        lastContentHeight = contentRef.current?.offsetHeight ?? lastContentHeight;
      }, 200);
    };
    window.addEventListener("resize", rebuild);

    // `setup()` measures `bottom`/`j` (and sizes the wrapper from them) once, synchronously —
    // if the web font swaps in or a poster image finishes sizing after that, the pin's scroll
    // distance goes stale and shorter than the content actually needs, so it un-pins before the
    // labels/wordmark finish revealing (the "cortado" reported on real pages, reproduced here
    // with a short-viewport scrub). A resize only catches viewport changes, not this, so also
    // watch the content's own height and rebuild if it moves once things settle.
    let lastContentHeight = contentRef.current.offsetHeight;
    const contentObserver = new ResizeObserver(() => {
      const el = contentRef.current;
      if (!el) return;
      const h = el.offsetHeight;
      if (Math.abs(h - lastContentHeight) < 2) return;
      lastContentHeight = h;
      rebuild();
    });
    contentObserver.observe(contentRef.current);

    return () => {
      window.removeEventListener("resize", rebuild);
      window.clearTimeout(resizeTimer);
      contentObserver.disconnect();
      ctx.revert();
    };
  }, [scroller, mobile]);

  if (mobile === null) return null;

  if (mobile) {
    return <BrandSnapMobile ref={mobileRef} onComplete={onSnapComplete} onExitUp={onSnapExitUp} />;
  }

  return (
    <div ref={wrapperRef} className="relative z-[1] bg-black">
      <div ref={pinRef} className="sticky top-0 relative h-screen overflow-hidden z-[1]">
        <div ref={bgRef} className="absolute inset-0 bg-[#FAA2CA]" style={{ height: "300%" }}>
          <BrandParticles />
        </div>

        <div
          ref={contentRef}
          className="relative w-full flex flex-col items-center pt-[max(calc(25vh_-_16px),157px)] lg:pt-[max(calc(25vh_+_20px),243px)]"
        >
          <div
            data-hero-morph-target
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-black z-10 opacity-0"
            style={{ width: 220, height: 86, top: "75vh" }}
          >
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

          <div className="brand-image relative pointer-events-none opacity-0 mt-[25px] lg:mt-[30px] w-[226px] h-[166px] lg:w-[400px] lg:h-[294px] rounded overflow-hidden bg-black/10">
            {video1Failed ? (
              <img src="/sites/newmixcoffee-com-8d5a8741/shared/BrandStory_1_poster.webp" alt="" className="w-full h-full object-cover" />
            ) : (
              <video
                ref={video1Ref}
                src="/sites/newmixcoffee-com-8d5a8741/shared/BrandStory_1.mp4"
                poster="/sites/newmixcoffee-com-8d5a8741/shared/BrandStory_1_poster.webp"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            )}
          </div>

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

          <div
            ref={brandImage2Ref}
            className="brand-image-2 relative pointer-events-none opacity-0 mt-[16px] lg:mt-[20px] w-[calc(100%-48px)] lg:w-[800px] aspect-[2400/1398] rounded overflow-hidden bg-[#1a1a1a]"
          >
            {video2Failed ? (
              <img src="/sites/newmixcoffee-com-8d5a8741/shared/BrandStory_2_poster.webp" alt="" className="w-full h-full object-cover" />
            ) : (
              <video
                ref={video2Ref}
                src="/sites/newmixcoffee-com-8d5a8741/shared/BrandStory_2.mp4"
                poster="/sites/newmixcoffee-com-8d5a8741/shared/BrandStory_2_poster.webp"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            )}
            <p className="absolute inset-0 flex items-center justify-center text-white text-center font-medium text-[18px] lg:text-[32px] tracking-[-0.072px] px-4">
              Lo nuevo nace de lo que ya eres.
            </p>
          </div>

          <div ref={lineWrapRef} className="pointer-events-none mt-[20px] lg:mt-[30px] w-[220px] lg:w-[468px] pb-[100px]">
            <svg className="w-full h-auto" viewBox="0 0 220.52 359.55" overflow="visible" fill="none">
              <circle className="line-start-dot" cx="117.98" cy="0.27" r="2.5" fill="#1a1a1a" opacity="0" />
              <path
                ref={linePathRef}
                className="newmix-line-path"
                d={LINE_PATH}
                stroke="#1a1a1a"
                strokeWidth="1"
                fill="none"
                strokeLinecap="round"
              />
              <polygon className="line-end-arrow" points="119.29,359.55 115.29,351.55 123.29,351.55" fill="#1a1a1a" opacity="0" />
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
                  fontFamily: "var(--font-helvetica-black)",
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

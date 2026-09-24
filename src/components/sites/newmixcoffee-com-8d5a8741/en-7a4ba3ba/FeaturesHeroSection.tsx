"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import UtuLogo from "./UtuLogo";
import { useScroller } from "./ScrollShell";

/**
 * Ported from the reference's `setupFeaturesHeroParallax` (function `E` in its bundle): a sticky
 * full-screen image that shrinks and (on desktop) clips inward as the section scrolls past, with
 * the wordmark fading in at the midpoint. Sits directly below StatementSection, overlapping it by
 * `mt-[-55vh] lg:mt-[-20vh]` like the reference's gallery wrapper does — no spacer between them.
 */
export default function FeaturesHeroSection() {
  const scroller = useScroller();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scroller || !wrapperRef.current) return;
    gsap.registerPlugin(ScrollTrigger);

    function setup() {
      const wrapper = wrapperRef.current!;
      const mobile = window.innerWidth < 1024;
      const extra = mobile ? 0.7 * window.innerHeight : 2 * window.innerHeight;
      wrapper.style.height = `${window.innerHeight + extra}px`;

      const tl = gsap.timeline({
        scrollTrigger: { trigger: wrapper, scroller, start: "top top", end: "bottom bottom", scrub: true },
      });

      if (mobile) {
        tl.to(imgRef.current, { scale: 0.7, y: -100, transformOrigin: "center top", duration: 1 }, 0);
      } else {
        tl.to(imgRef.current, { scale: 0.6, duration: 1 }, 0);
        tl.to(clipRef.current, { clipPath: "inset(20% 25% 20% 25%)", duration: 1 }, 0);
      }
      tl.fromTo(logoRef.current, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.3 }, 0.5);
    }

    let ctx = gsap.context(setup, wrapperRef);

    // Same reasoning as StatementSection: heights are computed from window.innerHeight/innerWidth
    // at build time, so the timeline goes stale on resize (including mobile browser-chrome resize).
    let resizeTimer: number | undefined;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        ctx.revert();
        ctx = gsap.context(setup, wrapperRef);
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
    <div ref={wrapperRef} className="features-hero-wrapper relative bg-black">
      <div
        ref={clipRef}
        className="features-hero-clip sticky top-0 w-screen h-screen supports-[height:100dvh]:h-dvh overflow-hidden"
        style={{ clipPath: "inset(0 0% 0 0%)" }}
      >
        {/* Placeholder — reference has a full-bleed photo here. Same box; swap in a UTU piece. */}
        <div ref={imgRef} className="features-hero-img w-full h-full bg-[#262626]" />
      </div>

      <section className="relative z-[2] overflow-hidden bg-black pt-[80px] pb-[80px] px-[10%] mt-[-55vh] lg:mt-[-20vh]">
        <div ref={logoRef} className="features-hero-logo block mx-auto opacity-0 pointer-events-none text-white w-[51px] lg:w-[86px]">
          <UtuLogo className="w-full h-full" viewBox="11 5 1009 394" />
        </div>
      </section>
    </div>
  );
}

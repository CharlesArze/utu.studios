"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HeroCanvas, { type HeroCanvasHandle } from "./HeroCanvas";

const ScrollerContext = createContext<HTMLDivElement | null>(null);

export function useScroller() {
  return useContext(ScrollerContext);
}

type WhitePhase = "landing" | "content" | null;

const navHeight = () => (window.innerWidth >= 1024 ? 80 : 72);

/**
 * Owns the hero<->white transition exactly as the reference site does it:
 * a single wheel/swipe/click gesture triggers a GSAP tween (not a
 * continuous scroll-position mapping), scroll is blocked until it
 * completes, and a second gesture in the "landing" phase plays a short
 * reveal timeline before native scroll is handed back. See the plan at
 * `.claude/plans/sleepy-greeting-boot.md` for the exact ground truth this
 * was ported from — desktop only, mobile has its own separate mechanism
 * in the reference that isn't implemented here.
 *
 * `scrollerRef` (a plain ref) is what every direct DOM mutation below goes
 * through; `scroller` (state) exists only to hand a reactive value to
 * `ScrollerContext` for consumers like GallerySection/HeroPinSection.
 */
export default function ScrollShell({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const setScrollerNode = useCallback((el: HTMLDivElement | null) => {
    scrollerRef.current = el;
    setScroller(el);
  }, []);
  const heroRef = useRef<HeroCanvasHandle>(null);
  const [currentSection, setCurrentSection] = useState<"hero" | "white">("hero");
  const whitePhaseRef = useRef<WhitePhase>(null);
  const isBusy = useRef(false);
  // Real trackpad/mouse-wheel gestures keep firing events for a while after
  // the "main" motion (momentum/inertia) — without a short lock after each
  // transition completes, that trailing input reads as the *next* gesture
  // and immediately fires the following transition (e.g. bouncing straight
  // back to hero the instant "content" phase is reached). The reference
  // site guards this the same way (its own gesture handler uses a 200ms
  // cooldown).
  const cooldownUntil = useRef(0);
  const touchStart = useRef({ y: 0, t: 0 });
  const armCooldown = () => {
    cooldownUntil.current = performance.now() + 200;
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    gsap.set(el, { yPercent: 100 });
    el.style.overflowY = "hidden";
  }, [scroller]);

  const transitionToWhite = useCallback(() => {
    const el = scrollerRef.current;
    if (isBusy.current || performance.now() < cooldownUntil.current || currentSection === "white" || !el) return;
    isBusy.current = true;
    el.style.overflowY = "hidden";
    // The pink panel starts below the nav, so a plain 75vh left the wordmark one nav-height too low,
    // near the foot of the section. Same formula the landing tween already uses (fraction of the
    // viewport minus the nav), and set right before the morph like the reference does.
    gsap.set("[data-hero-morph-target]", { top: `${Math.round(0.75 * window.innerHeight - navHeight())}px` });
    gsap.fromTo(el, { yPercent: 100 }, {
      yPercent: 0,
      duration: 0.8,
      ease: "power3.out",
      onUpdate: () => {
        const t = 1 - (gsap.getProperty(el, "yPercent") as number) / 100;
        heroRef.current?.setColorMixTarget(t);
        heroRef.current?.setMorphProgress(t);
      },
      onComplete: () => {
        el.scrollTop = 0;
        whitePhaseRef.current = "landing";
        setCurrentSection("white");
        // Hand the dust off to the solid vector logo as soon as it lands, not on the next scroll.
        // The reference's points are big enough (5-8 * dpr px) that its dust already reads as a
        // solid black silhouette here; ours are ~1px and leave gaps, so the crossfade supplies it.
        gsap.to("[data-hero-morph-target]", {
          opacity: 1,
          duration: 0.25,
          ease: "power2.out",
          onUpdate() {
            heroRef.current?.setTextFade(gsap.getProperty(this.targets()[0], "opacity") as number);
          },
        });
        isBusy.current = false;
        armCooldown();
      },
    });
  }, [currentSection]);

  const landingAdvance = useCallback(() => {
    if (isBusy.current || performance.now() < cooldownUntil.current) return;
    isBusy.current = true;
    const nav = navHeight();
    const tl = gsap.timeline({
      onComplete: () => {
        whitePhaseRef.current = "content";
        const el = scrollerRef.current;
        if (el) el.style.overflowY = "auto";
        requestAnimationFrame(() => ScrollTrigger.refresh());
        isBusy.current = false;
        armCooldown();
      },
    });
    tl.to("[data-hero-morph-target]", {
      top: `${Math.round(0.25 * window.innerHeight - nav)}px`,
      opacity: 1,
      duration: 0.6,
      ease: "power3.out",
      onUpdate: () => {
        heroRef.current?.updateMorphTarget();
        // Crossfade the dust that landed exactly on the logo out at the same
        // rate the real vector logo fades in, so it hands off to one clean
        // solid shape instead of sitting on top of it forever (those
        // particles never fade on their own — only the ones that missed a
        // logo pixel do, via morphProgress).
        const el = document.querySelector("[data-hero-morph-target]");
        const wordmarkOpacity = el ? (gsap.getProperty(el, "opacity") as number) : 1;
        heroRef.current?.setTextFade(wordmarkOpacity);
      },
    });
    tl.fromTo(".brand-dash-line", { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.5 }, 0.3);
    tl.fromTo(".brand-image", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4 }, 0.4);
    tl.fromTo(".brand-text", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, 0.5);
  }, []);

  const transitionToHero = useCallback(() => {
    const el = scrollerRef.current;
    if (isBusy.current || performance.now() < cooldownUntil.current || !el) return;
    isBusy.current = true;
    el.style.overflowY = "hidden";
    el.scrollTop = 0;
    heroRef.current?.setTextFade(0);
    heroRef.current?.resumeLoop();
    gsap.set("[data-hero-morph-target]", { top: "75vh", opacity: 0 });
    gsap.set(".brand-dash-line, .brand-dash-line-2", { clipPath: "inset(0 0 100% 0)" });
    gsap.set(".brand-image, .brand-image-2", { opacity: 0, y: 30 });
    gsap.set(".brand-text, .brand-slogan", { opacity: 0, y: 20 });
    gsap.set(".brand-line-slogan", { opacity: 0, y: 12 });
    gsap.set(".newmix-line-path", { strokeDasharray: "0 9999" });
    gsap.set(".line-start-dot, .line-end-arrow", { opacity: 0 });
    gsap.set(".line-label", { opacity: 0, y: 8 });
    gsap.to(el, {
      yPercent: 100,
      duration: 0.8,
      ease: "power3.out",
      onUpdate: () => {
        // Mirrors transitionToWhite: morphProgress rides the SAME 0.8s tween
        // instead of snapping to 0 up front. A hard snap leaves the particle
        // spring physics to close a large gap on its own clock (velocity is
        // capped, see heroEngine's stepParticles), which runs longer than
        // 0.8s and reads as slow/janky — exactly the "trabada" symptom
        // reported here, absent going the other direction where the target
        // already moves gradually every frame.
        const t = (gsap.getProperty(el, "yPercent") as number) / 100;
        heroRef.current?.setColorMixTarget(1 - t);
        heroRef.current?.setMorphProgress(1 - t);
      },
      onComplete: () => {
        whitePhaseRef.current = null;
        setCurrentSection("hero");
        isBusy.current = false;
        armCooldown();
      },
    });
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (isBusy.current) {
        e.preventDefault();
        return;
      }
      if (whitePhaseRef.current === "landing") {
        e.preventDefault();
        if (e.deltaY > 0) landingAdvance();
        else if (e.deltaY < 0) transitionToHero();
      } else if (whitePhaseRef.current === "content" && (scrollerRef.current?.scrollTop ?? 0) <= 0 && e.deltaY < 0) {
        e.preventDefault();
        transitionToHero();
      }
    },
    [landingAdvance, transitionToHero],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    touchStart.current = { y: e.touches[0].clientY, t: performance.now() };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (isBusy.current) return;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      const dt = performance.now() - touchStart.current.t;
      // "Return to hero" is gated behind a fast flick so an ordinary scroll
      // bounce/rubber-band at the top of content can't trigger it by
      // accident. Advancing out of "landing" has no such accidental-trigger
      // risk — it's the only forward gesture available there — so it used
      // to share this same flick-only gate and left mobile users stuck
      // after an unhurried (non-flick) swipe, unable to reach the second
      // section's content at all.
      const isFlick = dt < 300 && Math.abs(dy / dt) > 0.5;
      if (whitePhaseRef.current === "landing") {
        if (dy < -30) landingAdvance();
        else if (isFlick && dy > 30) transitionToHero();
      } else if (
        whitePhaseRef.current === "content" &&
        (scrollerRef.current?.scrollTop ?? 0) <= 5 &&
        isFlick &&
        dy > 30
      ) {
        transitionToHero();
      }
    },
    [landingAdvance, transitionToHero],
  );

  return (
    <>
      <HeroCanvas
        ref={heroRef}
        onWheelDown={transitionToWhite}
        onIndicatorClick={transitionToWhite}
        showChrome={currentSection === "hero"}
      />
      <div
        ref={setScrollerNode}
        className="scrollbar-hide fixed left-0 right-0 bottom-0 top-[72px] lg:top-20 w-full overflow-x-hidden overflow-y-hidden z-[25] bg-white text-[#1a1a1a]"
        // iOS's native momentum-scroll engine, explicitly opted into for
        // this custom (non-window) scroll container — mobile Safari's
        // default touch-scroll handling of a `overflow-y: auto` div with a
        // `position: sticky` child inside it (StatementSection's pinned
        // reveal) is known to be unreliable without this.
        style={{ overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <ScrollerContext.Provider value={scroller}>{children}</ScrollerContext.Provider>
      </div>
    </>
  );
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import HeroCanvas, { type HeroCanvasHandle } from "./HeroCanvas";
import type { StatementSectionHandle } from "./StatementSection";

const ScrollerContext = createContext<HTMLDivElement | null>(null);

export function useScroller() {
  return useContext(ScrollerContext);
}

// StatementSection registers its imperative handle here (it's rendered as
// a child, not owned directly by ScrollShell, so a plain ref prop can't
// reach it) — this is how the mobile "brand-snap" swipes below reach its
// 3-step state machine, and how its own completion/exit-up events reach
// back up to ScrollShell's phase transitions.
type StatementContextValue = {
  handleRef: React.RefObject<StatementSectionHandle | null>;
  onSnapComplete: () => void;
  onSnapExitUp: () => void;
};
const StatementContext = createContext<StatementContextValue | null>(null);

export function useStatementHandle() {
  const ctx = useContext(StatementContext);
  if (!ctx) throw new Error("useStatementHandle must be used within ScrollShell");
  return ctx;
}

type WhitePhase = "landing" | "brand-snap" | "content" | null;

const navHeight = () => (window.innerWidth >= 1024 ? 80 : 72);
const isMobileViewport = () => window.innerWidth < 1024;
const lenisEasing = (t: number) => (t === 1 ? 1 : 1.001 - Math.pow(2, -10 * t));

/**
 * Owns the hero<->white transition and the white-section scroll driver,
 * rebuilt from scratch against the reference site's own bundle (chunk
 * `14mi0bklv8h5w.js`; see docs/research/.../TRAMO_HERO_TO_SLOGAN.md §2).
 * Desktop: wheel/click triggers a GSAP tween, `landing` reveals the first
 * beats, then native (Lenis-smoothed) scroll takes over. Mobile: after
 * `landing`, a distinct `brand-snap` phase drives 3 discrete swipe steps
 * (see StatementSection/BrandSnapMobile) before handing off to content.
 */
export default function ScrollShell({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const setScrollerNode = useCallback((el: HTMLDivElement | null) => {
    scrollerRef.current = el;
    setScroller(el);
  }, []);
  const statementHandleRef = useRef<StatementSectionHandle | null>(null);
  const heroRef = useRef<HeroCanvasHandle>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [currentSection, setCurrentSection] = useState<"hero" | "white">("hero");
  const whitePhaseRef = useRef<WhitePhase>(null);
  const isBusy = useRef(false);
  // Trailing wheel/touch momentum after a transition completes would
  // otherwise read as the next gesture — same 200ms cooldown the
  // reference itself uses (`wheel.cooldown`).
  const cooldownUntil = useRef(0);
  const touchStart = useRef({ y: 0, t: 0 });
  const armCooldown = () => {
    cooldownUntil.current = performance.now() + 200;
  };

  const destroyLenis = useCallback(() => {
    lenisRef.current?.destroy();
    lenisRef.current = null;
  }, []);

  const startLenis = useCallback(() => {
    if (lenisRef.current || !scrollerRef.current || !contentRef.current) return;
    const lenis = new Lenis({
      wrapper: scrollerRef.current,
      content: contentRef.current,
      smoothWheel: true,
      syncTouch: true,
      duration: 0.8,
      easing: lenisEasing,
    });
    lenis.on("scroll", () => ScrollTrigger.update());
    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    lenisRef.current = lenis;
    return () => gsap.ticker.remove(onTick);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    gsap.set(el, { yPercent: 100 });
    el.style.overflowY = "hidden";
  }, [scroller]);

  const transitionToWhite = useCallback(() => {
    const el = scrollerRef.current;
    if (isBusy.current || performance.now() < cooldownUntil.current || currentSection === "white" || !el) return;
    isBusy.current = true;
    el.style.overflowY = "hidden";
    const nav = navHeight();
    const viewH = window.innerHeight;
    gsap.set("[data-hero-morph-target]", { top: `${Math.round(0.75 * viewH - nav)}px` });
    gsap.fromTo(el, { yPercent: 100 }, {
      yPercent: 0,
      duration: 0.8,
      ease: "power3.out",
      onUpdate: function () {
        const t = this.ratio;
        heroRef.current?.setWhiteBgYOffset(Math.round((viewH - nav) * (1 - t)));
        heroRef.current?.setColorMixTarget(t);
        heroRef.current?.setMorphProgress(t);
      },
      onComplete: () => {
        heroRef.current?.setWhiteBgYOffset(0);
        el.scrollTop = 0;
        whitePhaseRef.current = "landing";
        setCurrentSection("white");
        // No separate crossfade tween here — heroEngine's own reveal clock
        // (triggered the instant setMorphProgress first went >0, above)
        // already crossfades the dust into the flat vector logo internally,
        // over the same fixed 0.8s window the reference uses, folded into
        // its last 40%. A second bolt-on tween here was the "rápidamente
        // se convierte al logo plano" jump reported — two separate steps
        // instead of one continuous motion.
        isBusy.current = false;
        armCooldown();
      },
    });
  }, [currentSection]);

  const landingAdvance = useCallback(() => {
    if (isBusy.current || performance.now() < cooldownUntil.current) return;
    isBusy.current = true;
    const nav = navHeight();
    const mobile = isMobileViewport();
    const tl = gsap.timeline({
      onComplete: () => {
        if (mobile) {
          whitePhaseRef.current = "brand-snap";
        } else {
          whitePhaseRef.current = "content";
          const el = scrollerRef.current;
          if (el) el.style.overflowY = "auto";
          startLenis();
          requestAnimationFrame(() => ScrollTrigger.refresh());
        }
        isBusy.current = false;
        armCooldown();
      },
    });
    // Opacity isn't animated here — the reveal crossfade already finished
    // during transitionToWhite (see there); this only moves the (already
    // fully opaque) logo up to its resting position.
    tl.to("[data-hero-morph-target]", {
      top: `${Math.round(0.25 * window.innerHeight - nav)}px`,
      duration: 0.6,
      ease: "power3.out",
      onUpdate: () => heroRef.current?.updateMorphTarget(),
    });
    tl.fromTo(".brand-dash-line", { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.5 }, 0.3);
    tl.fromTo(".brand-image", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4 }, 0.4);
    tl.fromTo(".brand-text", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, 0.5);
  }, [startLenis]);

  const brandSnapComplete = useCallback(() => {
    whitePhaseRef.current = "content";
    const el = scrollerRef.current;
    if (el) el.style.overflowY = "auto";
    startLenis();
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }, [startLenis]);

  const transitionToHero = useCallback(() => {
    const el = scrollerRef.current;
    if (isBusy.current || performance.now() < cooldownUntil.current || !el) return;
    isBusy.current = true;
    statementHandleRef.current?.reset();
    destroyLenis();
    el.style.overflowY = "hidden";
    el.scrollTop = 0;
    heroRef.current?.resumeLoop();
    // Snapped synchronously, not tweened — matches the reference exactly: the
    // reverse GSAP tween below only animates colorMixTarget/whiteBgYOffset.
    // This triggers the engine's own internal "return" animation (a fixed
    // 0.8s eased position tween back to the "you to you" shape, its own
    // clock, independent of this outer tween) and resets the overlay logo's
    // opacity — see heroEngine.ts's setMorphProgress. Never calling this at
    // all (the previous bug) left morphProgress stuck at 1, which is why the
    // hero came back empty/stuck on the logo.
    heroRef.current?.setMorphProgress(0);
    gsap.set("[data-hero-morph-target]", { top: "75dvh", opacity: 0, y: 0 });
    gsap.set(".brand-dash-line, .brand-dash-line-2", { clipPath: "inset(0 0 100% 0)" });
    gsap.set(".brand-image, .brand-image-2", { opacity: 0, y: 30 });
    gsap.set(".brand-text, .brand-slogan", { opacity: 0, y: 20 });
    gsap.set(".brand-line-slogan", { opacity: 0, y: 12 });
    gsap.set(".newmix-line-path", { strokeDasharray: "0 9999" });
    gsap.set(".line-start-dot, .line-end-arrow", { opacity: 0 });
    gsap.set(".line-label", { opacity: 0, y: 8 });
    const nav = navHeight();
    const viewH = window.innerHeight;
    gsap.to(el, {
      yPercent: 100,
      duration: 0.8,
      ease: "power3.out",
      onUpdate: function () {
        const t = this.ratio;
        heroRef.current?.setWhiteBgYOffset(Math.round((viewH - nav) * t));
        heroRef.current?.setColorMixTarget(1 - t);
      },
      onComplete: () => {
        heroRef.current?.setWhiteBgYOffset(viewH - nav);
        whitePhaseRef.current = null;
        setCurrentSection("hero");
        isBusy.current = false;
        armCooldown();
      },
    });
  }, [destroyLenis]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (isBusy.current) {
        e.preventDefault();
        return;
      }
      const phase = whitePhaseRef.current;
      if (phase === "landing") {
        e.preventDefault();
        if (e.deltaY > 0) landingAdvance();
        else if (e.deltaY < 0) transitionToHero();
      } else if (phase === "brand-snap") {
        e.preventDefault();
        if (e.deltaY > 30) statementHandleRef.current?.handleSwipe("down", "wheel");
        else if (e.deltaY < -30) statementHandleRef.current?.handleSwipe("up", "wheel");
      } else if (phase === "content" && (scrollerRef.current?.scrollTop ?? 0) <= 0 && e.deltaY < 0) {
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
      const isFlick = dt < 300 && Math.abs(dy / dt) > 0.5;
      const phase = whitePhaseRef.current;
      if (phase === "landing") {
        if (dy < -30) landingAdvance();
        else if (isFlick && dy > 30) transitionToHero();
      } else if (phase === "brand-snap") {
        if (dy < -30) statementHandleRef.current?.handleSwipe("down", "touch");
        else if (dy > 30) statementHandleRef.current?.handleSwipe("up", "touch");
      } else if (phase === "content" && (scrollerRef.current?.scrollTop ?? 0) <= 5 && isFlick && dy > 30) {
        transitionToHero();
      }
    },
    [landingAdvance, transitionToHero],
  );

  useEffect(() => destroyLenis, [destroyLenis]);

  const statementContext = useMemo<StatementContextValue>(
    () => ({ handleRef: statementHandleRef, onSnapComplete: brandSnapComplete, onSnapExitUp: transitionToHero }),
    [brandSnapComplete, transitionToHero],
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
        style={{ overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div ref={contentRef} className="white-bg-content">
          <ScrollerContext.Provider value={scroller}>
            <StatementContext.Provider value={statementContext}>{children}</StatementContext.Provider>
          </ScrollerContext.Provider>
        </div>
      </div>
    </>
  );
}

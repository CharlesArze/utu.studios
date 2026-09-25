"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import gsap from "gsap";
import UtuLogo from "./UtuLogo";
import BrandParticles from "./BrandParticles";
import { BrandSnapStep1, BrandSnapStep2, BrandSnapStep3, type BrandSnapStepHandle } from "./BrandSnapSteps";

export type BrandSnapMobileHandle = {
  handleSwipe: (direction: "down" | "up", source?: "wheel" | "touch") => void;
  reset: () => void;
};

const NAV_HEIGHT = 72; // matches Nav.tsx's mobile height (lg:80)
const MORPH_WIDTH = 220; // UtuLogo box size used by the morph target (see StatementSection/heroEngine)
const MORPH_HEIGHT = 86;
const MORPH_GAP = 14; // gap before the first dash line (mt-[14px] on BrandSnapStep1)

/**
 * Mobile-only "brand-snap": 3 discrete swipe-driven steps instead of the
 * desktop pin's continuous scrub — ported from the reference's own mobile
 * branch (`T` in the bundle; see TRAMO_HERO_TO_SLOGAN.md §4). Swiping
 * down/up moves between steps with a 200ms cooldown; a second swipe
 * queued mid-animation (touch only) speeds the current one up instead of
 * being dropped, exactly like the reference.
 */
const BrandSnapMobile = forwardRef<BrandSnapMobileHandle, { onComplete: () => void; onExitUp: () => void }>(
  function BrandSnapMobile({ onComplete, onExitUp }, ref) {
    const contentRef = useRef<HTMLDivElement>(null);
    const bgRef = useRef<HTMLDivElement>(null);
    const step2WrapRef = useRef<HTMLDivElement>(null);
    const step3WrapRef = useRef<HTMLDivElement>(null);
    const step1Ref = useRef<BrandSnapStepHandle>(null);
    const step2Ref = useRef<BrandSnapStepHandle>(null);
    const step3Ref = useRef<BrandSnapStepHandle>(null);

    const currentStep = useRef<1 | 2 | 3>(1);
    const offsets = useRef({ 1: 0, 2: 0, 3: 0 });
    const activeTimeline = useRef<gsap.core.Timeline | null>(null);
    const isAnimating = useRef(false);
    const queuedDirection = useRef<"down" | "up" | null>(null);
    const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Re-measured every time we're about to use it (mount, and again right before
    // each `goTo`) rather than cached once: the step wrappers' offsetTop/offsetHeight
    // shift as videos/fonts finish loading, so a mount-only snapshot goes stale and
    // step 3 lands at the wrong y — the actual cause of it drifting off-screen on
    // viewports whose aspect ratio differs from a tall phone.
    function computeOffsets() {
      const baseline = 0.25 * window.innerHeight - NAV_HEIGHT + MORPH_HEIGHT + MORPH_GAP;
      const step3Top = step3WrapRef.current?.offsetTop ?? 0;
      const step3Height = step3WrapRef.current?.offsetHeight ?? 0;
      // On viewports too short for the circular-trace step to fit under the usual
      // baseline (wide-but-short windows, tablets in the <1024 mobile range), pull
      // it up just enough that its bottom stays inside the h-dvh viewport instead
      // of being clipped by BrandSnapMobile's `overflow-hidden`.
      const step3Baseline = Math.min(baseline, Math.max(window.innerHeight - step3Height - 16, 0));
      offsets.current = {
        1: 0,
        2: -((step2WrapRef.current?.offsetTop ?? 0) - baseline),
        3: -(step3Top - step3Baseline),
      };
    }

    useEffect(() => {
      computeOffsets();
    }, []);

    useEffect(() => {
      const particlesHost = bgRef.current?.firstElementChild as (HTMLDivElement & {
        __brandParticles?: { start: () => void; stop: () => void };
      }) | null;
      particlesHost?.__brandParticles?.start();
      return () => particlesHost?.__brandParticles?.stop();
    }, []);

    function goTo(target: 1 | 2 | 3, source: "wheel" | "touch") {
      const from = currentStep.current;
      isAnimating.current = true;
      currentStep.current = target;
      if (target === 3) computeOffsets();
      const y = offsets.current[target];
      const morphTarget = document.querySelector<HTMLElement>("[data-hero-morph-target]");
      const tl = gsap.timeline({
        onComplete: () => {
          activeTimeline.current = null;
          const queued = queuedDirection.current;
          queuedDirection.current = null;
          if (queued) {
            handleSwipeInternal(queued, "touch");
            return;
          }
          isAnimating.current = false;
          cooldownTimer.current = setTimeout(() => {
            cooldownTimer.current = null;
          }, 200);
          if (target === 3 && from < 3) onComplete();
        },
      });
      activeTimeline.current = tl;
      if (source === "touch" && queuedDirection.current) tl.timeScale(10);
      tl.to(contentRef.current, { y, duration: 0.5, ease: "power3.out" }, 0);
      if (morphTarget) tl.to(morphTarget, { y, duration: 0.5, ease: "power3.out" }, 0);
      tl.to(bgRef.current, { y: 0.15 * y, duration: 0.5, ease: "power3.out" }, 0);

      if (target > from) {
        if (target === 2) step2Ref.current?.animateIn();
        if (target === 3) step3Ref.current?.animateIn();
      } else {
        if (from === 3) step3Ref.current?.animateOut();
        if (from === 2) step2Ref.current?.animateOut();
      }
    }

    function handleSwipeInternal(direction: "down" | "up", source: "wheel" | "touch") {
      if (isAnimating.current) {
        if (source === "touch") {
          queuedDirection.current = direction;
          activeTimeline.current?.timeScale(10);
        }
        return;
      }
      if (cooldownTimer.current) return;
      const step = currentStep.current;
      if (direction === "down") {
        if (step === 1) goTo(2, source);
        else if (step === 2) goTo(3, source);
        else onComplete();
      } else {
        if (step === 1) onExitUp();
        else if (step === 2) goTo(1, source);
        else goTo(2, source);
      }
    }

    useImperativeHandle(ref, () => ({
      handleSwipe: (direction, source = "wheel") => handleSwipeInternal(direction, source),
      reset: () => {
        const tl = activeTimeline.current;
        activeTimeline.current = null;
        tl?.kill();
        isAnimating.current = false;
        queuedDirection.current = null;
        if (cooldownTimer.current) {
          clearTimeout(cooldownTimer.current);
          cooldownTimer.current = null;
        }
        currentStep.current = 1;
        step1Ref.current?.reset();
        step2Ref.current?.reset();
        step3Ref.current?.reset();
        gsap.set(contentRef.current, { y: 0 });
        gsap.set(bgRef.current, { y: 0 });
        const morphTarget = document.querySelector<HTMLElement>("[data-hero-morph-target]");
        if (morphTarget) gsap.set(morphTarget, { y: 0 });
      },
    }));

    return (
      <div className="relative z-[1] bg-black">
        <div className="relative h-dvh overflow-hidden z-[1]">
          <div ref={bgRef} className="absolute inset-x-0 top-0 bottom-[-50%] bg-[#FAA2CA] will-change-transform">
            <BrandParticles density={0.2} />
          </div>

          <div
            data-hero-morph-target
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-black z-10 opacity-0 will-change-transform"
            // dvh, not vh — matches the h-dvh container below. On iOS Safari, vh uses the
            // large (toolbar-hidden) viewport while the container tracks the visible one,
            // so as the address bar shows/hides mid-swipe the two drift apart and this
            // logo visibly overlaps whatever's under it. dvh keeps both in the same frame.
            style={{ width: MORPH_WIDTH, height: MORPH_HEIGHT, top: "75dvh" }}
          >
            <UtuLogo className="w-full h-full" viewBox="11 5 1009 394" />
          </div>

          <div
            ref={contentRef}
            className="relative w-full flex flex-col items-center pt-[max(calc(25dvh_-_39px),134px)] will-change-transform"
          >
            <BrandSnapStep1 ref={step1Ref} />
            <div ref={step2WrapRef}>
              <BrandSnapStep2 ref={step2Ref} />
            </div>
            <div ref={step3WrapRef}>
              <BrandSnapStep3 ref={step3Ref} />
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default BrandSnapMobile;

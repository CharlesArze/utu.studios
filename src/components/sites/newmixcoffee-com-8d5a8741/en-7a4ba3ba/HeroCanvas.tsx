"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { HeroEngine } from "./heroEngine";

export type HeroCanvasHandle = Pick<
  HeroEngine,
  "setMorphProgress" | "setColorMixTarget" | "setWhiteBgYOffset" | "updateMorphTarget" | "setTextFade" | "resumeLoop"
>;

type HeroCanvasProps = {
  onWheelDown: () => void;
  onIndicatorClick: () => void;
  showChrome: boolean;
};

/**
 * Thin React shell around `heroEngine`. Exposes the engine's transition
 * controls imperatively (via `ref`) so the page-level transition controller
 * — which owns the GSAP tweens for hero<->white — can drive them directly,
 * the same way the reference site's own hero wrapper exposes an engine ref
 * to its parent instead of driving itself off scroll position.
 */
const HeroCanvas = forwardRef<HeroCanvasHandle, HeroCanvasProps>(function HeroCanvas(
  { onWheelDown, onIndicatorClick, showChrome },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<HeroEngine | null>(null);
  const showChromeRef = useRef(showChrome);
  // Empty until mount so SSR and the first client render match exactly
  // (a live clock rendered during SSR would hydrate-mismatch against
  // whatever time the client actually loads at).
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const formatted = new Intl.DateTimeFormat("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "America/Lima",
      }).format(new Date());
      setTime(`${formatted} PET`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setMorphProgress: (p) => engineRef.current?.setMorphProgress(p),
      setColorMixTarget: (t) => engineRef.current?.setColorMixTarget(t),
      setWhiteBgYOffset: (o) => engineRef.current?.setWhiteBgYOffset(o),
      updateMorphTarget: () => engineRef.current?.updateMorphTarget(),
      setTextFade: (t) => engineRef.current?.setTextFade(t),
      resumeLoop: () => engineRef.current?.resumeLoop(),
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    import("./heroEngine").then(({ createHeroEngine }) => {
      if (cancelled) return;
      engineRef.current = createHeroEngine(canvas, { onSwipeUp: onWheelDown });
    });

    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    showChromeRef.current = showChrome;
  }, [showChrome]);

  // Cursor-driven tilt of the particle field. It runs inside the WebGL scene
  // (heroEngine's setTilt) rather than as a CSS transform on the canvas: a 3D
  // CSS transform makes the GPU resample the canvas as a texture, and the
  // near-regular 1px grain beats against the sample grid into a moiré band
  // that reads as a sheen sweeping over the letters. The hero's chrome — the
  // pink bar and the scroll arrow — deliberately stays flat and anchored.
  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const MAX_DEG = 15;
    let targetX = 0;
    let targetY = 0;
    let rx = 0;
    let ry = 0;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      // rotateY+ pushes the right edge away and rotateX+ pushes the top away,
      // so these signs sink whichever side the cursor is on and lift the other.
      targetY = nx * MAX_DEG;
      targetX = -ny * MAX_DEG;
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const tick = () => {
      // Eases back to flat for the white-section transition instead of
      // snapping, which would be visible mid-morph on the particle canvas.
      if (!showChromeRef.current) {
        targetX = 0;
        targetY = 0;
      }
      rx += (targetX - rx) * 0.08;
      ry += (targetY - ry) * 0.08;
      // Rotation only, about the field's centre. A translate, a scale or a
      // cursor-following pivot would read as the camera panning around the
      // section rather than the plate itself tipping.
      engineRef.current?.setTilt(rx, ry);
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      engineRef.current?.setTilt(0, 0);
    };
  }, []);

  return (
    <>
      {/* Particle canvas paints above the header (Nav.tsx, z-40) so particles
          the user drags up into that strip pass in front of it instead of
          disappearing behind it. Interaction stays unaffected: the drag
          physics in heroEngine.ts listen on `window`, not this element, so
          it can safely stay pointer-events-none and out of the header's way
          for clicks — only the wheel/button layer below needs pointer
          events, and that one stays below the header as before. The open
          mobile menu still needs to win over this canvas too — see Nav.tsx,
          where it's a z-[70] sibling of header instead of a nested child,
          specifically so it isn't capped at header's own z-40. */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
      <div
        className="fixed inset-0 z-30 pointer-events-none"
        onWheel={(e) => showChrome && e.deltaY > 30 && onWheelDown()}
        style={{ pointerEvents: showChrome ? "auto" : "none" }}
      >
        {showChrome && (
          <>
            <button
              type="button"
              onClick={onIndicatorClick}
              aria-label="Scroll to content"
              className="absolute bottom-16 lg:bottom-20 left-1/2 -translate-x-1/2 text-white/70 cursor-pointer"
              style={{ animation: "scroll-hint-float 1.8s cubic-bezier(0.65,0,0.35,1) infinite" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {/* Grid, not flex+justify-between — with 3 items of uneven width,
                justify-between doesn't put the middle one at the true visual
                center of the bar (its position shifts with the outer items'
                widths). A 3-column grid pins each phrase to its own edge
                independently: left flush left, right flush right, center
                genuinely centered regardless of the other two. */}
            <div className="absolute bottom-6 lg:bottom-8 inset-x-6 lg:inset-x-20 grid grid-cols-3 items-center text-[#FAA2CA] text-[18px] lg:text-[21px] tracking-wide pointer-events-none">
              <span className="text-left">CREATIVE STUDIO DESIGN</span>
              <span className="text-center">{time}</span>
              <span className="text-right">ONLINE IN AREQUIPA, PERÚ</span>
            </div>
          </>
        )}
      </div>
    </>
  );
});

export default HeroCanvas;

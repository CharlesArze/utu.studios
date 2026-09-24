"use client";

import { useEffect, useRef } from "react";
import { createFooterLogoEngine, type FooterLogoEngine } from "./FooterLogoEngine";

export default function FooterLogoParticles({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    let engine: FooterLogoEngine | null = null;
    let played = false;

    // Fires once per page load: the wordmark forms the first time the footer scrolls into view,
    // then stays static — leaving/re-entering the section never replays it (only a reload does).
    const observer = new IntersectionObserver(
      (entries) => {
        if (played || !entries.some((e) => e.isIntersecting)) return;
        played = true;
        observer.disconnect();
        engine = createFooterLogoEngine(canvas, container);
        if (!engine) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          engine.showFinal();
        } else {
          engine.play();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(container);

    return () => {
      observer.disconnect();
      engine?.destroy();
    };
  }, []);

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

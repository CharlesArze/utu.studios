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

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (!engine) engine = createFooterLogoEngine(canvas, container);
        engine?.replay();
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

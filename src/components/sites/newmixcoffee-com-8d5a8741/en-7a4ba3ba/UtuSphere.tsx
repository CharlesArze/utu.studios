"use client";

import { useEffect, useRef } from "react";

/** Rotation duration matches the reference clip's own loop length (contact_po.mp4, 4.467s). */
const SPIN_DURATION = "4.467s";

/** The UTU sphere mark: the exact PNG artwork (no edge distortion), with an infinite counter-clockwise spin. */
export default function UtuSphere({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // ponytail: pause the spin while the footer is off-screen.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) svg.unpauseAnimations();
      else svg.pauseAnimations();
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  return (
    <svg ref={svgRef} viewBox="0 0 1000 1000" aria-hidden="true" className={className}>
      {/* Movimiento B: rotación antihoraria infinita sobre el centro exacto de la esfera */}
      <g>
        <image href="/images/utu-sphere-outline-512.png" width="1000" height="1000" />
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 500 500"
          to="-360 500 500"
          dur={SPIN_DURATION}
          repeatCount="indefinite"
          calcMode="linear"
        />
      </g>
    </svg>
  );
}

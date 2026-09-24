"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import gsap from "gsap";
import { useVideoAutoplay } from "./useVideoAutoplay";

export type BrandSnapStepHandle = {
  animateIn: () => void;
  animateOut: () => void;
  reset: () => void;
};

const LINE_PATH =
  "M117.98.27c21.52,33.28-17.23,44.74-48.42,58.93S25.2,93.31,15.81,113.18c-17.94,37.96-19.28,85.81,3.72,121.88,36.11,56.62,118.62,74.26,168.69,25.29,30.7-30.03,40.24-78.07,23.93-117.73-28.23-68.65-114.35-85.94-170.29-37.51C-4.17,144.96-11.44,221.93,18.36,270.76c2.29,3.76,4.83,7.37,7.57,10.82,30.53,38.51,82.73,52.47,93.36,77.77";

const TAG_LABELS = [
  { text: "Diseño de Marca", x: 110, y: 120 },
  { text: "Diseño de Experiencia", x: 110, y: 166.7 },
  { text: "Desarrollo Web", x: 110, y: 213.3 },
  { text: "Producción de Contenido", x: 110, y: 260 },
];

/** Step 1 of the mobile "brand-snap" — dash line + BrandStory_1 + intro line. Durations/positions ported verbatim from `T`'s `k` sub-component in the reference bundle. */
export const BrandSnapStep1 = forwardRef<BrandSnapStepHandle>(function BrandSnapStep1(_props, ref) {
  const dashRef = useRef<SVGSVGElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const { videoRef, failed } = useVideoAutoplay();

  useImperativeHandle(ref, () => ({
    animateIn: () => {
      const tl = gsap.timeline();
      tl.fromTo(dashRef.current, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.5 });
      tl.fromTo(imageRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4 }, 0.2);
      tl.fromTo(textRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, 0.3);
    },
    animateOut: () => {
      const tl = gsap.timeline();
      tl.to(textRef.current, { opacity: 0, y: 20, duration: 0.3 });
      tl.to(imageRef.current, { opacity: 0, y: 30, duration: 0.3 }, 0.05);
      tl.to(dashRef.current, { clipPath: "inset(0 0 100% 0)", duration: 0.3 }, 0.1);
    },
    reset: () => {
      gsap.set(dashRef.current, { clipPath: "inset(0 0 100% 0)" });
      gsap.set(imageRef.current, { opacity: 0, y: 30 });
      gsap.set(textRef.current, { opacity: 0, y: 20 });
    },
  }));

  return (
    <div className="flex flex-col items-center px-6">
      <svg
        ref={dashRef}
        className="brand-dash-line w-px pointer-events-none h-[136px] mt-[14px]"
        style={{ clipPath: "inset(0 0 100% 0)" }}
        viewBox="0 0 1 136"
        preserveAspectRatio="none"
        fill="none"
      >
        <line x1="0.5" y1="0" x2="0.5" y2="136" stroke="#1a1a1a" strokeWidth="1" strokeDasharray="2 2" strokeLinecap="round" />
      </svg>
      <div ref={imageRef} className="brand-image relative pointer-events-none opacity-0 mt-[25px] w-[226px] h-[166px] rounded overflow-hidden bg-black/10">
        {failed ? (
          <img src="/sites/newmixcoffee-com-8d5a8741/shared/BrandStory_1_poster.webp" alt="" className="w-full h-full object-cover" />
        ) : (
          <video
            ref={videoRef}
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
      <p ref={textRef} className="brand-text pointer-events-none opacity-0 font-light text-center text-[#1a1a1a] mt-[16px] w-full px-6 text-[14px] tracking-[-0.072px]">
        UTU Studios da forma a marcas que perduran, uniendo estrategia, diseño y tecnología
      </p>
    </div>
  );
});

/** Step 2 — second dash line + slogan + BrandStory_2. */
export const BrandSnapStep2 = forwardRef<BrandSnapStepHandle>(function BrandSnapStep2(_props, ref) {
  const dashRef = useRef<SVGSVGElement>(null);
  const sloganRef = useRef<HTMLParagraphElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const { videoRef, failed } = useVideoAutoplay();

  useImperativeHandle(ref, () => ({
    animateIn: () => {
      const tl = gsap.timeline();
      tl.fromTo(dashRef.current, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.5 });
      tl.fromTo(sloganRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, 0.2);
      tl.fromTo(imageRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4 }, 0.3);
    },
    animateOut: () => {
      const tl = gsap.timeline();
      tl.to(imageRef.current, { opacity: 0, y: 30, duration: 0.3 });
      tl.to(sloganRef.current, { opacity: 0, y: 20, duration: 0.3 }, 0.05);
      tl.to(dashRef.current, { clipPath: "inset(0 0 100% 0)", duration: 0.3 }, 0.1);
    },
    reset: () => {
      gsap.set(dashRef.current, { clipPath: "inset(0 0 100% 0)" });
      gsap.set(sloganRef.current, { opacity: 0, y: 20 });
      gsap.set(imageRef.current, { opacity: 0, y: 30 });
    },
  }));

  return (
    <div className="flex flex-col items-center px-6">
      <svg
        ref={dashRef}
        className="brand-dash-line-2 w-px pointer-events-none h-[136px] mt-[16px]"
        style={{ clipPath: "inset(0 0 100% 0)" }}
        viewBox="0 0 1 136"
        preserveAspectRatio="none"
        fill="none"
      >
        <line x1="0.5" y1="0" x2="0.5" y2="136" stroke="#1a1a1a" strokeWidth="1" strokeDasharray="2 2" strokeLinecap="round" />
      </svg>
      <p ref={sloganRef} className="brand-slogan pointer-events-none opacity-0 font-medium text-center text-[#1a1a1a] mt-[16px] w-full px-6 text-[16px] tracking-[-0.072px]">
        Todo empieza en ti
      </p>
      <div ref={imageRef} className="brand-image-2 relative pointer-events-none opacity-0 mt-[16px] w-[calc(100%-48px)] aspect-[2400/1398] rounded overflow-hidden bg-[#1a1a1a]">
        {failed ? (
          <img src="/sites/newmixcoffee-com-8d5a8741/shared/BrandStory_2_poster.webp" alt="" className="w-full h-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            src="/sites/newmixcoffee-com-8d5a8741/shared/BrandStory_2.mp4"
            poster="/sites/newmixcoffee-com-8d5a8741/shared/BrandStory_2_poster.webp"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        )}
        <p className="absolute inset-0 flex items-center justify-center text-white text-center font-medium text-[14px] tracking-[-0.072px] px-4">
          Lo nuevo nace de lo que ya eres.
        </p>
      </div>
    </div>
  );
});

/** Step 3 — the wandering trace with the 4 service labels + the "you to you" wordmark. */
export const BrandSnapStep3 = forwardRef<BrandSnapStepHandle>(function BrandSnapStep3(_props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    animateIn: () => {
      const svg = svgRef.current;
      if (svg) {
        const path = svg.querySelector<SVGPathElement>(".newmix-line-path");
        if (path) path.style.strokeDasharray = "";
        gsap.set(svg.querySelector(".line-start-dot"), { opacity: 1 });
        gsap.set(svg.querySelector(".line-end-arrow"), { opacity: 1 });
      }
      gsap.fromTo(wrapRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" });
      const labels = svg?.querySelectorAll(".line-label");
      if (labels) gsap.fromTo(labels, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, delay: 0.3 });
      gsap.fromTo(wordmarkRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, delay: 0.5, ease: "power2.out" });
    },
    animateOut: () => {
      gsap.to(wrapRef.current, { opacity: 0, duration: 0.2, ease: "power2.in" });
    },
    reset: () => {
      gsap.set(wrapRef.current, { opacity: 0 });
      const labels = svgRef.current?.querySelectorAll(".line-label");
      if (labels) gsap.set(labels, { opacity: 0, y: 8 });
      gsap.set(wordmarkRef.current, { opacity: 0, y: 12 });
    },
  }));

  // Rotates the arrowhead to match the path's own end tangent — same
  // getPointAtLength/atan2 math as the reference, run once on mount since
  // this step's path never redraws (it's revealed whole via `animateIn`,
  // not progressively like the desktop pin's).
  useEffect(() => {
    const svg = svgRef.current;
    const path = svg?.querySelector<SVGPathElement>(".newmix-line-path");
    const arrow = svg?.querySelector<SVGPolygonElement>(".line-end-arrow");
    if (!path || !arrow) return;
    const total = path.getTotalLength();
    const end = path.getPointAtLength(total);
    const prev = path.getPointAtLength(Math.max(0, total - 2));
    const angle = (Math.atan2(end.y - prev.y, end.x - prev.x) * 180) / Math.PI;
    arrow.setAttribute(
      "transform",
      `rotate(${angle - 90}, ${end.x}, ${end.y}) translate(${end.x}, ${end.y}) scale(1) translate(${-end.x}, ${-end.y})`,
    );
  }, []);

  return (
    <div className="flex flex-col items-center px-6">
      <div ref={wrapRef} className="pointer-events-none w-[220px] sm:w-[260px] mt-[20px] pb-6 opacity-0">
        <svg ref={svgRef} className="w-full h-auto" viewBox="0 0 220.52 359.55" overflow="visible" fill="none">
          <circle className="line-start-dot" cx="117.98" cy="0.27" r="2.5" fill="#1a1a1a" />
          <path
            className="newmix-line-path"
            d={LINE_PATH}
            stroke="#1a1a1a"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="2 2"
          />
          <polygon className="line-end-arrow" points="119.29,359.55 115.29,351.55 123.29,351.55" fill="#1a1a1a" />
          {TAG_LABELS.map((label, i) => (
            <text
              key={label.text}
              className={`line-label line-label-${i + 1} text-[11px]`}
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
        <div ref={wordmarkRef} className="brand-line-slogan block w-full opacity-0 pointer-events-none mt-[15px]">
          <svg viewBox="0 0 960 164" className="w-full h-auto" aria-label="you to you">
            <defs>
              <filter id="grain-text-mobile" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <text
              x="50%"
              y="60%"
              textAnchor="middle"
              filter="url(#grain-text-mobile)"
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
  );
});

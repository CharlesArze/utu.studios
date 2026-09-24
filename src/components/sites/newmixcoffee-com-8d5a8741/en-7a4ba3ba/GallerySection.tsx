"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useScroller } from "./ScrollShell";

const ASSET_BASE = "/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/images";

// Per-item horizontal offsets, captured verbatim from the live site's
// server-rendered `--offset-x` custom properties (see PAGE_TOPOLOGY.md).
const OFFSETS = [
  -15, -5, 8, 18, 10, 0, -10, -5, 5, 15, 8, -3, -12, -15, -8, 5, 15, 10, 0, -10, -15, -5, 8, 18, 10, -3, 5,
];

function GalleryItem({ index, offset }: { index: number; offset: number }) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transform = "scale(1)";
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = index + 1;
  return (
    <div
      className="relative mx-auto"
      style={{ width: "65%", aspectRatio: "16/9", transform: `translateX(${offset}%)`, clipPath: "inset(-1px 20%)" }}
    >
      <img
        ref={imgRef}
        src={`${ASSET_BASE}/gallery_${n}.webp`}
        alt={`Gallery ${n}`}
        className="absolute inset-0 w-full h-full object-cover origin-center transition-transform duration-700 ease-out"
        style={{ transform: "scale(1.5)" }}
        loading="lazy"
      />
    </div>
  );
}

export default function GallerySection() {
  const scroller = useScroller();
  const sectionRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scroller || !sectionRef.current || !logoRef.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        logoRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          scrollTrigger: {
            trigger: sectionRef.current,
            scroller,
            start: "top 60%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, [scroller]);

  return (
    <section
      ref={sectionRef}
      className="gallery-section relative z-[2] overflow-hidden bg-black pt-[80px] pb-[80px] px-[10%] mt-[-55vh] lg:mt-[-20vh]"
    >
      <div ref={logoRef} className="block mx-auto w-[120px] lg:w-[220px] mb-10 invert">
        <Image src={`${ASSET_BASE}/text_logo.svg`} alt="NEWMIX" width={220} height={40} className="w-full h-auto" />
      </div>
      <div className="gallery-track relative max-w-[800px] lg:max-w-[1000px] mx-auto flex flex-col gap-6 lg:gap-10">
        {OFFSETS.map((offset, i) => (
          <GalleryItem key={i} index={i} offset={offset} />
        ))}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function ScrollToNextIndicator({ label, href }: { label: string; href: string }) {
  const [percent, setPercent] = useState(0);
  const navigatedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    let raf = 0;

    function update() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const pct = scrollable > 0 ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)) : 0;
      setPercent(pct);
      if (pct >= 99.5 && !navigatedRef.current) {
        navigatedRef.current = true;
        setTimeout(() => router.push(href), 500);
      }
    }

    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [href, router]);

  return (
    <div className="flex justify-center py-12 lg:py-16 bg-black">
      <div className="relative w-[217px] h-[122px]">
        <svg viewBox="0 0 217 122" className="absolute inset-0 w-full h-full">
          <ellipse cx="108.5" cy="61" rx="106" ry="59" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          <ellipse
            cx="108.5"
            cy="61"
            rx="106"
            ry="59"
            fill="none"
            stroke="white"
            strokeWidth="3"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - percent}
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center text-white">
          <p className="text-[12px] uppercase tracking-wide font-light">Scroll a {label}</p>
          <p className="text-[12px] text-white/70">{Math.round(percent)}%</p>
        </div>
      </div>
    </div>
  );
}

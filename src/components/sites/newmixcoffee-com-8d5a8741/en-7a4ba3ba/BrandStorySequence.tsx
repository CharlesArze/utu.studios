"use client";

import { useEffect, useState } from "react";

const BASE = "/images/brand-story-1";

const FRAMES = [
  "01_cera",
  "02_nieve",
  "05_tecla",
  "06_neon",
  "07_vaca",
  "08_serigrafia",
  "09_moneda",
  "11_plata",
].map((name) => `${BASE}/${name}.webp`);

/** Loop duration matches the reference clip it replaces (BrandStory_1.mp4, 3.375s). */
const FRAME_INTERVAL_MS = 3375 / FRAMES.length;

/** Stand-in for BrandStory_1.mp4: cycles the UTU sphere-in-wax stills as a looping sequence.
 * A single <img> whose src swaps on each tick — no stacked opacity layers, so there's never a
 * moment where the outgoing and incoming frame are both faded out at once. */
export default function BrandStorySequence({ className }: { className?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small looping sequence, not a single LCP image */}
      <img src={FRAMES[frame]} alt="" className="absolute inset-0 w-full h-full object-cover" />
    </div>
  );
}

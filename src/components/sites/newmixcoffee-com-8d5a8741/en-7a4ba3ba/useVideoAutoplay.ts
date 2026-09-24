"use client";

import { useEffect, useRef, useState } from "react";

/** Falls back to the poster image if autoplay is blocked — matches the reference's own `S()` hook. */
export function useVideoAutoplay() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    videoRef.current?.play().catch(() => setFailed(true));
  }, []);

  return { videoRef, failed };
}

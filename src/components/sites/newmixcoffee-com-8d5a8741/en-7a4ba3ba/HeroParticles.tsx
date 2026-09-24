"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type HeroParticlesHandle = {
  start: () => void;
  stop: () => void;
  setScrollParallax: (progress: number, range: number) => void;
};

type NoiseParams = { count: number; alphaMin: number; alphaMax: number };

const STATIC_DENSE: NoiseParams = { count: 200000, alphaMin: 10, alphaMax: 60 };
const STATIC_SPARSE: NoiseParams = { count: 110000, alphaMin: 15, alphaMax: 90 };
const GRAIN_RGB: [number, number, number] = [80, 80, 80];

type Attractor = { x: number; y: number; spread: number };
type Dot = {
  ox: number;
  oy: number;
  r: number;
  fill: string;
  phase: number;
  speed: number;
  repelX: number;
  repelY: number;
};

/** Box-Muller transform — matches the source site's clustering jitter. */
function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleAttractorPoint(width: number, height: number, attractors: Attractor[], bias: number) {
  if (Math.random() < bias) {
    const a = attractors[Math.floor(Math.random() * attractors.length)];
    return { x: a.x + gaussian() * a.spread, y: a.y + gaussian() * a.spread };
  }
  return { x: Math.random() * width, y: Math.random() * height };
}

function makeLayerCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  Object.assign(canvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  });
  return canvas;
}

function paintNoise(canvas: HTMLCanvasElement, params: NoiseParams, attractors: Attractor[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const [r, g, b] = GRAIN_RGB;
  for (let i = 0; i < params.count; i++) {
    const { x, y } = sampleAttractorPoint(width, height, attractors, 0.6);
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || px >= width || py < 0 || py >= height) continue;
    const idx = (py * width + px) * 4;
    const alpha = params.alphaMin + Math.floor(Math.random() * (params.alphaMax - params.alphaMin));
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = Math.min(255, data[idx + 3] + alpha);
  }
  ctx.putImageData(imageData, 0, 0);
}

function paintDustSpecks(canvas: HTMLCanvasElement, attractors: Attractor[], count: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const [r, g, b] = GRAIN_RGB;
  for (let i = 0; i < count; i++) {
    const { x, y } = sampleAttractorPoint(width, height, attractors, 0.5);
    if (x < 0 || x > width || y < 0 || y > height) continue;
    const radius = 0.5 + 0.7 * Math.random();
    const alpha = 0.03 + 0.15 * Math.random();
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Ported from newmixcoffee.com's own bundle (chunk with gsap/ScrollTrigger +
 * a `brandParticles` canvas component): three stacked 2D-canvas noise
 * layers, parallax-shifted by cursor position, with a top layer of dots
 * that get repelled within 120px of the pointer. See BEHAVIORS.md — this
 * is the real algorithm, not a visual approximation.
 */
const HeroParticles = forwardRef<HeroParticlesHandle, { density?: number }>(function HeroParticles(
  { density = 1 },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<HeroParticlesHandle | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    if (width === 0 || height === 0) return;

    const staticFar = makeLayerCanvas(width, height);
    const staticNear = makeLayerCanvas(width, height);
    const animated = makeLayerCanvas(width, height);
    const animatedCtx = animated.getContext("2d");
    container.appendChild(staticFar);
    container.appendChild(staticNear);
    container.appendChild(animated);

    const attractors: Attractor[] = Array.from({ length: 20 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      spread: 40 + 300 * Math.random(),
    }));

    const scale = (p: NoiseParams): NoiseParams =>
      density < 1 ? { ...p, count: Math.round(p.count * density) } : p;

    paintNoise(staticFar, scale(STATIC_DENSE), attractors);
    paintNoise(staticNear, scale(STATIC_SPARSE), attractors);
    paintDustSpecks(staticNear, attractors, Math.round(8000 * density));

    const [r, g, b] = GRAIN_RGB;
    const dotCount = Math.round(600 * density);
    const dots: Dot[] = Array.from({ length: dotCount }, () => {
      const { x, y } = sampleAttractorPoint(width, height, attractors, 0.5);
      return {
        ox: Math.max(0, Math.min(width, x)),
        oy: Math.max(0, Math.min(height, y)),
        r: 0.5 + Math.random(),
        fill: `rgba(${r},${g},${b},${(0.06 + 0.22 * Math.random()).toFixed(3)})`,
        phase: Math.random() * Math.PI * 2,
        speed: 0.012 * (0.5 + Math.random()),
        repelX: 0,
        repelY: 0,
      };
    });

    let targetX = 0;
    let targetY = 0;
    let smoothX = 0;
    let smoothY = 0;
    let mouseX = -9999;
    let mouseY = -9999;
    let scrollProgress = 0;
    let scrollRange = 0;
    let running = false;
    let rafId: number | null = null;
    let startedAt = 0;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      targetX = (e.clientX - rect.left - cx) / cx;
      targetY = (e.clientY - rect.top - cy) / cy;
      mouseX = ((e.clientX - rect.left) / rect.width) * width;
      mouseY = ((e.clientY - rect.top) / rect.height) * height;
    };
    const onMouseLeave = () => {
      targetX = 0;
      targetY = 0;
      mouseX = -9999;
      mouseY = -9999;
    };

    function frame(now: number) {
      smoothX += (targetX - smoothX) * 0.06;
      smoothY += (targetY - smoothY) * 0.06;
      const elapsed = now - startedAt;
      const t = 0.001 * elapsed;
      const rampIn = Math.min(1, elapsed / 2000);
      const wobbleFarX = 8 * Math.sin(0.2 * t) * rampIn;
      const wobbleFarY = 6 * Math.cos(0.15 * t) * rampIn;
      const wobbleNearX = 14 * Math.sin(0.28 * t + 1) * rampIn;
      const wobbleNearY = 10 * Math.cos(0.22 * t + 1) * rampIn;
      const scrollFar = -(scrollRange * scrollProgress * 0.4);
      const scrollNear = scrollRange * scrollProgress * -0.15;

      staticFar.style.transform = `translate3d(${(10 * smoothX + wobbleFarX).toFixed(1)}px, ${(
        10 * smoothY +
        wobbleFarY +
        scrollFar
      ).toFixed(1)}px, 0)`;
      staticNear.style.transform = `translate3d(${(30 * smoothX + wobbleNearX).toFixed(1)}px, ${(
        30 * smoothY +
        wobbleNearY +
        scrollNear
      ).toFixed(1)}px, 0)`;
      animated.style.transform = `translate3d(${(20 * smoothX).toFixed(1)}px, ${(20 * smoothY).toFixed(1)}px, 0)`;

      if (animatedCtx) {
        animatedCtx.clearRect(0, 0, width, height);
        for (const dot of dots) {
          const wobbleX = 8 * Math.sin(t * dot.speed + dot.phase);
          const wobbleY = 8 * Math.cos(t * dot.speed * 0.7 + dot.phase) * 0.7;
          const x = dot.ox + wobbleX;
          const y = dot.oy + wobbleY;
          const dx = x - mouseX;
          const dy = y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120 && dist > 0.1) {
            const push = (1 - dist / 120) * 60;
            dot.repelX += ((dx / dist) * push - dot.repelX) * 0.15;
            dot.repelY += ((dy / dist) * push - dot.repelY) * 0.15;
          } else {
            dot.repelX *= 0.92;
            dot.repelY *= 0.92;
          }
          animatedCtx.fillStyle = dot.fill;
          animatedCtx.beginPath();
          animatedCtx.arc(x + dot.repelX, y + dot.repelY, dot.r, 0, Math.PI * 2);
          animatedCtx.fill();
        }
      }
      if (running) rafId = requestAnimationFrame(frame);
    }

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);

    const stop = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      smoothX = smoothY = targetX = targetY = 0;
      mouseX = mouseY = -9999;
      scrollProgress = 0;
      staticFar.style.transform = "";
      staticNear.style.transform = "";
      animated.style.transform = "";
    };

    apiRef.current = {
      start: () => {
        if (running) return;
        running = true;
        startedAt = performance.now();
        rafId = requestAnimationFrame(frame);
      },
      stop,
      setScrollParallax: (progress, range) => {
        scrollProgress = progress;
        scrollRange = range;
      },
    };

    return () => {
      stop();
      apiRef.current = null;
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      staticFar.remove();
      staticNear.remove();
      animated.remove();
    };
  }, [density]);

  useImperativeHandle(ref, () => ({
    start: () => apiRef.current?.start(),
    stop: () => apiRef.current?.stop(),
    setScrollParallax: (progress, range) => apiRef.current?.setScrollParallax(progress, range),
  }));

  return <div ref={containerRef} className="relative w-full h-full" />;
});

export default HeroParticles;

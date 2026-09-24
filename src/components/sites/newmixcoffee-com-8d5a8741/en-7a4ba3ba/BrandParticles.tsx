"use client";

import { useEffect, useRef } from "react";

/**
 * Grain/dust background — ported 1:1 (counts, alphas, radii, parallax
 * multipliers, cursor-repel constants) from the reference site's own
 * `brandParticles` component (chunk `14mi0bklv8h5w.js`), a pure Canvas 2D
 * system: two static noise layers painted once via `putImageData`, plus a
 * third animated layer of orbiting dots that get pushed away from the
 * cursor. See `docs/research/.../TRAMO_HERO_TO_SLOGAN.md` §5 for the
 * source. Only the color is not the reference's literal value — their
 * `rgb(80,80,80)` reads as flat gray on their off-white bg; over UTU's
 * pink it's tuned darker/warmer so the grain still reads as texture
 * instead of disappearing into the pink.
 */

type Attractor = { x: number; y: number; spread: number };

const LAYER_O = { count: 200_000, alphaMin: 10, alphaMax: 60 };
const LAYER_A = { count: 110_000, alphaMin: 15, alphaMax: 90 };
const GRAIN_COLOR: [number, number, number] = [64, 24, 40];

/** Box-Muller transform — gaussian jitter around each attractor, mean 0 / stddev 1. */
function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function makeCanvas(w: number, h: number, extraStyle: Partial<CSSStyleDeclaration> = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  Object.assign(c.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    ...extraStyle,
  });
  return c;
}

export type BrandParticlesHandle = {
  start: () => void;
  stop: () => void;
  setScrollParallax: (progress: number, range: number) => void;
};

export default function BrandParticles({ density = 1 }: { density?: number }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    // Two ancestors up: the reference reaches `.parentElement.parentElement`
    // from the canvas layer to get the mousemove/parallax target — here
    // that's the `.brand-story-bg` container this component is mounted
    // inside of (wrapper's own parent), matching 1:1.
    const target = wrapper.parentElement?.parentElement ?? wrapper.parentElement;
    if (!target) return;

    const w = wrapper.offsetWidth;
    const h = wrapper.offsetHeight;
    const layerO = makeCanvas(w, h);
    const layerA = makeCanvas(w, h);
    const layerC = makeCanvas(w, h);
    const ctxCNullable = layerC.getContext("2d");
    if (!ctxCNullable) return;
    const ctxC = ctxCNullable;
    wrapper.appendChild(layerO);
    wrapper.appendChild(layerA);
    wrapper.appendChild(layerC);

    const attractors: Attractor[] = Array.from({ length: 20 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      spread: 40 + 300 * Math.random(),
    }));

    function paintNoise(canvas: HTMLCanvasElement, opts: { count: number; alphaMin: number; alphaMax: number }) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const iw = canvas.width;
      const ih = canvas.height;
      const imageData = ctx.createImageData(iw, ih);
      const data = imageData.data;
      const [r, g, b] = GRAIN_COLOR;
      for (let i = 0; i < opts.count; i++) {
        let x: number;
        let y: number;
        if (Math.random() < 0.6) {
          const a = attractors[Math.floor(Math.random() * attractors.length)];
          x = Math.round(a.x + gaussian() * a.spread);
          y = Math.round(a.y + gaussian() * a.spread);
        } else {
          x = Math.floor(Math.random() * iw);
          y = Math.floor(Math.random() * ih);
        }
        if (x < 0 || x >= iw || y < 0 || y >= ih) continue;
        const idx = (y * iw + x) * 4;
        const alpha = opts.alphaMin + Math.floor(Math.random() * (opts.alphaMax - opts.alphaMin));
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = Math.min(255, data[idx + 3] + alpha);
      }
      ctx.putImageData(imageData, 0, 0);
    }

    function paintDots(canvas: HTMLCanvasElement, count: number) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const iw = canvas.width;
      const ih = canvas.height;
      const [r, g, b] = GRAIN_COLOR;
      for (let i = 0; i < count; i++) {
        let x: number;
        let y: number;
        if (Math.random() < 0.5) {
          const a = attractors[Math.floor(Math.random() * attractors.length)];
          x = a.x + gaussian() * a.spread;
          y = a.y + gaussian() * a.spread;
        } else {
          x = Math.random() * iw;
          y = Math.random() * ih;
        }
        if (x < 0 || x > iw || y < 0 || y > ih) continue;
        const radius = 0.5 + 0.7 * Math.random();
        const alpha = 0.03 + 0.15 * Math.random();
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    const layerOScaled = density < 1 ? { ...LAYER_O, count: Math.round(LAYER_O.count * density) } : LAYER_O;
    const layerAScaled = density < 1 ? { ...LAYER_A, count: Math.round(LAYER_A.count * density) } : LAYER_A;
    const dotCount = Math.round(8000 * density);
    const animatedCount = Math.round(600 * density);

    paintNoise(layerO, layerOScaled);
    paintNoise(layerA, layerAScaled);
    paintDots(layerA, dotCount);

    type AnimatedDot = {
      ox: number;
      oy: number;
      r: number;
      fill: string;
      phase: number;
      speed: number;
      repelX: number;
      repelY: number;
    };
    const dots: AnimatedDot[] = [];
    const [cr, cg, cb] = GRAIN_COLOR;
    for (let i = 0; i < animatedCount; i++) {
      let x: number;
      let y: number;
      if (Math.random() < 0.5) {
        const a = attractors[Math.floor(Math.random() * attractors.length)];
        x = a.x + gaussian() * a.spread;
        y = a.y + gaussian() * a.spread;
      } else {
        x = Math.random() * w;
        y = Math.random() * h;
      }
      x = Math.max(0, Math.min(w, x));
      y = Math.max(0, Math.min(h, y));
      const radius = 0.5 + Math.random();
      const alpha = 0.06 + 0.22 * Math.random();
      dots.push({
        ox: x,
        oy: y,
        r: radius,
        fill: `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`,
        phase: Math.random() * Math.PI * 2,
        speed: 0.012 * (0.5 + Math.random()),
        repelX: 0,
        repelY: 0,
      });
    }

    // Mouse parallax (lerp-smoothed) + independent per-layer drift.
    let targetX = 0;
    let targetY = 0;
    let smoothX = 0;
    let smoothY = 0;
    let pointerX = -9999;
    let pointerY = -9999;
    // Scroll parallax, fed by `setScrollParallax` from the pin's ScrollTrigger.
    let scrollProgress = 0;
    let scrollRange = 0;
    let running = false;
    let raf = 0;
    let startedAt = 0;

    const onPointerMove = (e: MouseEvent) => {
      const rect = target.getBoundingClientRect();
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;
      targetX = (e.clientX - rect.left - halfW) / halfW;
      targetY = (e.clientY - rect.top - halfH) / halfH;
      pointerX = ((e.clientX - rect.left) / rect.width) * w;
      pointerY = ((e.clientY - rect.top) / rect.height) * h;
    };
    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      pointerX = -9999;
      pointerY = -9999;
    };

    function frame(now: number) {
      smoothX += (targetX - smoothX) * 0.06;
      smoothY += (targetY - smoothY) * 0.06;
      const elapsed = now - startedAt;
      const t = 0.001 * elapsed;
      const ramp = Math.min(1, elapsed / 2000);
      const driftOx = 8 * Math.sin(0.2 * t) * ramp;
      const driftOy = 6 * Math.cos(0.15 * t) * ramp;
      const driftAx = 14 * Math.sin(0.28 * t + 1) * ramp;
      const driftAy = 10 * Math.cos(0.22 * t + 1) * ramp;
      const scrollOOffset = -(scrollRange * scrollProgress * 0.4);
      const scrollAOffset = scrollRange * scrollProgress * (0.85 - 1);

      layerO.style.transform = `translate3d(${(10 * smoothX + driftOx).toFixed(1)}px, ${(10 * smoothY + driftOy + scrollOOffset).toFixed(1)}px, 0)`;
      layerA.style.transform = `translate3d(${(30 * smoothX + driftAx).toFixed(1)}px, ${(30 * smoothY + driftAy + scrollAOffset).toFixed(1)}px, 0)`;
      layerC.style.transform = `translate3d(${(20 * smoothX).toFixed(1)}px, ${(20 * smoothY).toFixed(1)}px, 0)`;

      ctxC.clearRect(0, 0, w, h);
      for (const dot of dots) {
        const wobbleX = 8 * Math.sin(t * dot.speed + dot.phase);
        const wobbleY = 8 * Math.cos(t * dot.speed * 0.7 + dot.phase) * 0.7;
        const x = dot.ox + wobbleX;
        const y = dot.oy + wobbleY;
        const dx = x - pointerX;
        const dy = y - pointerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0.1) {
          const force = (1 - dist / 120) * 60;
          dot.repelX += ((dx / dist) * force - dot.repelX) * 0.15;
          dot.repelY += ((dy / dist) * force - dot.repelY) * 0.15;
        } else {
          dot.repelX *= 0.92;
          dot.repelY *= 0.92;
        }
        ctxC.fillStyle = dot.fill;
        ctxC.beginPath();
        ctxC.arc(x + dot.repelX, y + dot.repelY, dot.r, 0, 2 * Math.PI);
        ctxC.fill();
      }

      if (running) raf = requestAnimationFrame(frame);
    }

    target.addEventListener("mousemove", onPointerMove);
    target.addEventListener("mouseleave", onPointerLeave);

    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      smoothX = smoothY = targetX = targetY = 0;
      pointerX = pointerY = -9999;
      scrollProgress = 0;
      scrollRange = 0;
      layerO.style.transform = "";
      layerA.style.transform = "";
      layerC.style.transform = "";
    };

    (wrapper as HTMLDivElement & { __brandParticles?: BrandParticlesHandle }).__brandParticles = {
      start: () => {
        if (running) return;
        running = true;
        startedAt = performance.now();
        raf = requestAnimationFrame(frame);
      },
      stop,
      setScrollParallax: (progress, range) => {
        scrollProgress = progress;
        scrollRange = range;
      },
    };

    return () => {
      stop();
      target.removeEventListener("mousemove", onPointerMove);
      target.removeEventListener("mouseleave", onPointerLeave);
      layerO.remove();
      layerA.remove();
      layerC.remove();
    };
  }, [density]);

  return <div ref={wrapperRef} className="relative w-full h-full" />;
}

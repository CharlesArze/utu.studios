import * as THREE from "three";
import { UTU_LOGO_PATH_D } from "./UtuLogo";

/**
 * Footer wordmark, rendered as a static WebGL particle field using the same rendering technique as
 * the hero's "you to you" (heroEngine.ts): same latticeNoise grain/edge-erosion, same
 * DENSITY_CEILING/EDGE_WOBBLE/material.size constants, same expo-out entrance easing with decaying
 * perpendicular wobble. The entrance is the footer's own: every particle is born at the wordmark's
 * centre and expands outward to its final, eroded-edge position, staggered by distance from that
 * centre so the field reads as growing outward rather than popping in at once. There is no cursor
 * interaction here (by request) — once the entrance finishes, the field goes static and the render
 * loop stops. Plays once per page load, triggered by FooterLogoParticles' IntersectionObserver.
 */

// Glyph's own tight bounds within the shared 1904x742 viewBox (matches heroEngine.ts's GLYPH_BOX
// and Nav.tsx's crop) — the raw viewBox pads the glyph's bottom-right.
const GLYPH_BOX = { x: 11, y: 5, w: 1009, h: 394 };

const MAX_PARTICLES = 140000;
const PERSPECTIVE = 2500;
// Kept identical to heroEngine.ts's own values — see that file for the measurements behind them.
const MAX_PIXEL_RATIO = 2;
const DENSITY_CEILING = 0.97;
const EDGE_WOBBLE = 0.32;
// Sampling grid cell, in CSS px — same as heroEngine.ts's seedText/computeMorphShape.
const STEP = 2;

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Verbatim from heroEngine.ts — smooth value noise on a hash lattice, used to erode the glyph
// edge into organic lobes/bites instead of a clean cutout.
function latticeNoise(x: number, y: number, cell: number, seed: number) {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (ix: number, iy: number) => {
    let n = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const a = h(gx, gy);
  const b = h(gx + 1, gy);
  const c = h(gx, gy + 1);
  const d = h(gx + 1, gy + 1);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

export type FooterLogoEngine = {
  /** Plays the centre-outward entrance once. */
  play: () => void;
  /** Renders the finished wordmark instantly, no animation (prefers-reduced-motion). */
  showFinal: () => void;
  destroy: () => void;
};

export function createFooterLogoEngine(canvas: HTMLCanvasElement, container: HTMLElement): FooterLogoEngine | null {
  let destroyed = false;
  let raf = 0;
  let n = 0;
  let entranceStart = 0;
  let centerX = 0;
  let centerY = 0;

  let positions = new Float32Array(0);
  let colors = new Float32Array(0);
  let ox = new Float32Array(0);
  let oy = new Float32Array(0);
  let pDelay = new Float32Array(0);
  let pDuration = new Float32Array(0);
  let wobAmp = new Float32Array(0);
  let wobFreq = new Float32Array(0);
  let wobPhase = new Float32Array(0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  // Matches heroEngine.ts: world Y maps to screen-down.
  camera.up.set(0, -1, 0);

  const geometry = new THREE.BufferGeometry();
  const material = new THREE.PointsMaterial({
    size: 1,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
  });
  const points = new THREE.Points(geometry, material);
  points.matrixAutoUpdate = false;
  scene.add(points);

  function allocate(count: number) {
    n = count;
    positions = new Float32Array(3 * n);
    colors = new Float32Array(3 * n).fill(1);
    ox = new Float32Array(n);
    oy = new Float32Array(n);
    pDelay = new Float32Array(n);
    pDuration = new Float32Array(n);
    wobAmp = new Float32Array(n);
    wobFreq = new Float32Array(n);
    wobPhase = new Float32Array(n);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }

  /** Rasterizes + samples the wordmark and rebuilds the camera for the container's current size.
   * Returns false if the container has no size yet (e.g. still display:none). */
  function setup(): boolean {
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    if (!width || !height) return false;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    camera.fov = 2 * Math.atan(height / 2 / PERSPECTIVE) * (180 / Math.PI);
    camera.aspect = width / height;
    camera.near = 0.1;
    camera.far = 2 * PERSPECTIVE;
    camera.position.set(width / 2, height / 2, -PERSPECTIVE);
    camera.lookAt(width / 2, height / 2, 0);
    camera.updateProjectionMatrix();

    const mobile = window.innerWidth < 1024;
    material.size = (mobile ? 0.6 : 0.67) * Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);

    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.ceil(width));
    off.height = Math.max(1, Math.ceil(height));
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;

    // 30% smaller than a "fit the box" 0.9 fit, still centred by the same formula.
    const fit = 0.9 * 0.7;
    const scale = Math.min((off.width * fit) / GLYPH_BOX.w, (off.height * fit) / GLYPH_BOX.h);
    const path = new Path2D(UTU_LOGO_PATH_D);
    const drawGlyph = () => {
      ctx.save();
      ctx.translate(
        (off.width - GLYPH_BOX.w * scale) / 2 - GLYPH_BOX.x * scale,
        (off.height - GLYPH_BOX.h * scale) / 2 - GLYPH_BOX.y * scale
      );
      ctx.scale(scale, scale);
      ctx.fillStyle = "#fff";
      ctx.fill(path);
      ctx.restore();
    };

    // The same grainy, edge-eroded sampler as heroEngine.ts's seedText — blur radius and noise-lobe
    // size adapted from "fontSize*scale" (the text's own rendered size) to this glyph's analogous
    // rendered size, using the fit box's own scale to keep the same ratio the hero tuned.
    const glyphScale = GLYPH_BOX.w * scale;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, off.width, off.height);
    ctx.save();
    ctx.filter = `blur(${glyphScale * 0.008}px)`;
    drawGlyph();
    ctx.restore();
    const grainData = ctx.getImageData(0, 0, off.width, off.height).data;

    const noiseCell = glyphScale * 0.028;
    const ptsX: number[] = [];
    const ptsY: number[] = [];
    for (let y = 0; y < off.height; y += STEP) {
      for (let x = 0; x < off.width; x += STEP) {
        const red = grainData[(y * off.width + x) * 4];
        const a = red / 255;
        const region = latticeNoise(x, y, noiseCell * 6, 7);
        const amp = EDGE_WOBBLE * (0.35 + 1.3 * region);
        const wobble = (latticeNoise(x, y, noiseCell, 1) - 0.5) * 2 * amp * 4 * a * (1 - a);
        const p = clamp(a + wobble, 0, 1);
        if (Math.random() < DENSITY_CEILING * p ** 3) {
          ptsX.push(x + (Math.random() - 0.5) * STEP);
          ptsY.push(y + (Math.random() - 0.5) * STEP);
        }
      }
    }

    // The glyph is drawn centred within `off` by construction (see drawGlyph's translate), so the
    // canvas's own centre is the wordmark's centre — the single point every particle is born from.
    centerX = off.width / 2;
    centerY = off.height / 2;

    const count = Math.min(ptsX.length, MAX_PARTICLES);
    allocate(count);
    const dist = new Float32Array(count);
    let maxDist = 1;
    for (let i = 0; i < count; i++) {
      ox[i] = ptsX[i];
      oy[i] = ptsY[i];
      const d = Math.hypot(ptsX[i] - centerX, ptsY[i] - centerY);
      dist[i] = d;
      if (d > maxDist) maxDist = d;
    }
    for (let i = 0; i < count; i++) {
      // Same delay/duration shape as heroEngine.ts's seedEntrance, re-keyed from horizontal position
      // to radial distance from the wordmark's centre: particles nearest the centre resolve almost
      // immediately, the outermost ones wait longest, so the field reads as growing outward from a
      // single point rather than arriving all at once.
      const nd = dist[i] / maxDist;
      pDelay[i] = 0.25 * Math.random() + 0.35 * nd;
      pDuration[i] = 0.9 + 0.53 * Math.random();
      // Wobble amplitude scales with this particle's own travel distance rather than heroEngine's
      // fixed 20-40px range: a hop here ranges from a few px near the centre to the wordmark's own
      // half-width near its edges, so a flat 20-40px wobble would either vanish or dwarf the travel.
      const travel = dist[i] || 1;
      wobAmp[i] = travel * (0.15 + 0.3 * Math.random());
      wobFreq[i] = 2 + 3 * Math.random();
      wobPhase[i] = Math.random() * Math.PI * 2;

      positions[i * 3] = centerX;
      positions[i * 3 + 1] = centerY;
      positions[i * 3 + 2] = 0;
    }
    (geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    return true;
  }

  /** Mirrors heroEngine.ts's stepEntrance exactly (expo-out ease, decaying perpendicular wobble) —
   * only the start point's meaning changed (the wordmark's own centre instead of an off-screen point). */
  function stepEntrance(elapsed: number): boolean {
    let allDone = true;
    for (let i = 0; i < n; i++) {
      const l = clamp((elapsed - pDelay[i]) / pDuration[i], 0, 1);
      if (l < 1) allDone = false;
      const eased = l === 1 ? 1 : 1 - Math.pow(2, -10 * l);
      const rx = ox[i];
      const ry = oy[i];
      let px = centerX + (rx - centerX) * eased;
      let py = centerY + (ry - centerY) * eased;
      const dirx = rx - centerX;
      const diry = ry - centerY;
      const len = Math.hypot(dirx, diry) || 1;
      const wob = Math.sin(l * wobFreq[i] * Math.PI + wobPhase[i]) * wobAmp[i] * (1 - l);
      px += (-diry / len) * wob;
      py += (dirx / len) * wob;
      positions[i * 3] = px;
      positions[i * 3 + 1] = py;
    }
    return allDone;
  }

  function frame(nowMs: number) {
    if (destroyed || n === 0) return;
    const elapsed = nowMs / 1000 - entranceStart;
    const done = stepEntrance(elapsed);
    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    renderer.render(scene, camera);
    raf = done ? 0 : requestAnimationFrame(frame);
  }

  function play() {
    if (destroyed || n === 0) return;
    entranceStart = performance.now() / 1000;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function showFinal() {
    if (destroyed || n === 0) return;
    cancelAnimationFrame(raf);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = ox[i];
      positions[i * 3 + 1] = oy[i];
    }
    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    renderer.render(scene, camera);
  }

  if (!setup()) return null;

  return {
    play,
    showFinal,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}

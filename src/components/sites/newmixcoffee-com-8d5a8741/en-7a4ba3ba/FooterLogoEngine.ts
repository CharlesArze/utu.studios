import * as THREE from "three";
import { UTU_LOGO_PATH_D } from "./UtuLogo";

/**
 * Footer wordmark, rendered as a static WebGL particle field with the SAME grain/edge-erosion
 * recipe as the hero's "you to you" (heroEngine.ts) — same latticeNoise, same DENSITY_CEILING/
 * EDGE_WOBBLE/material.size constants, verbatim. The only deliberate difference is the entrance:
 * instead of flying in from off-screen, each particle starts near the interior of its own letter
 * and spreads out to its final, eroded-edge position in place. There is no cursor interaction here
 * (by request) — once the entrance finishes, the field goes static and the render loop stops.
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
// How many steps a particle may climb toward its own letter's interior when anchoring its entrance
// origin (see anchorToInterior below). Bounded so the walk can't cross into a different stroke.
const MAX_WALK_STEPS = 14;

const NEIGHBORS8 = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
] as const;

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

/** Ported from the previous version of this file (not from the hero). BFS distance transform:
 * for each inside-mask cell, how many grid steps to the nearest cell outside the mask, normalised
 * to [0,1]. 8-connected for smoother, more Euclidean-like iso-distance contours than a 4-connected
 * (diamond-shaped) BFS. Used here to find each particle's own letter-local interior. */
function computeDepth(insideMask: Uint8Array, gridW: number, gridH: number) {
  const n = gridW * gridH;
  const dist = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let qHead = 0;
  let qTail = 0;
  const idx = (x: number, y: number) => y * gridW + x;

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const i = idx(x, y);
      if (!insideMask[i]) continue;
      let onEdge = x === 0 || y === 0 || x === gridW - 1 || y === gridH - 1;
      if (!onEdge) {
        for (const [dx, dy] of NEIGHBORS8) {
          if (!insideMask[idx(x + dx, y + dy)]) {
            onEdge = true;
            break;
          }
        }
      }
      if (onEdge) {
        dist[i] = 0;
        queue[qTail++] = i;
      }
    }
  }

  while (qHead < qTail) {
    const i = queue[qHead++];
    const x = i % gridW;
    const y = (i / gridW) | 0;
    const d = dist[i];
    for (const [dx, dy] of NEIGHBORS8) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
      const ni = idx(nx, ny);
      if (!insideMask[ni] || dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      queue[qTail++] = ni;
    }
  }

  let maxDist = 1;
  for (let i = 0; i < n; i++) if (dist[i] > maxDist) maxDist = dist[i];

  const depth = new Float32Array(n);
  for (let i = 0; i < n; i++) depth[i] = insideMask[i] && dist[i] > 0 ? dist[i] / maxDist : 0;
  return depth;
}

/** Gradient-ascent walk on the depth field: from (gx0,gy0), repeatedly step to whichever
 * 8-neighbour has strictly greater depth, up to MAX_WALK_STEPS, stopping at a local maximum.
 * Because it only ever moves into the SAME mask (a letter is disconnected from its neighbours by
 * background), this always lands inside the particle's own stroke, never a different letter. */
function anchorToInterior(gx0: number, gy0: number, insideMask: Uint8Array, depth: Float32Array, gridW: number, gridH: number) {
  let gx = gx0;
  let gy = gy0;
  for (let s = 0; s < MAX_WALK_STEPS; s++) {
    let bestGx = gx;
    let bestGy = gy;
    let bestDepth = depth[gy * gridW + gx];
    for (const [dx, dy] of NEIGHBORS8) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
      const ni = ny * gridW + nx;
      if (!insideMask[ni]) continue;
      if (depth[ni] > bestDepth) {
        bestDepth = depth[ni];
        bestGx = nx;
        bestGy = ny;
      }
    }
    if (bestGx === gx && bestGy === gy) break;
    gx = bestGx;
    gy = bestGy;
  }
  return { gx, gy };
}

export type FooterLogoEngine = {
  /** Resets every particle to its entrance origin and restarts the reveal from t=0. Re-samples the
   * glyph first if the container's size has changed since the last call. */
  replay: () => void;
  destroy: () => void;
};

export function createFooterLogoEngine(canvas: HTMLCanvasElement, container: HTMLElement): FooterLogoEngine | null {
  let destroyed = false;
  let raf = 0;
  let n = 0;
  let lastWidth = 0;
  let lastHeight = 0;
  let entranceStart = 0;

  let positions = new Float32Array(0);
  let colors = new Float32Array(0);
  let startX = new Float32Array(0);
  let startY = new Float32Array(0);
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
    startX = new Float32Array(n);
    startY = new Float32Array(n);
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

  /** Rasterizes + samples the wordmark, computes each particle's interior-anchored entrance origin,
   * and rebuilds the camera for the container's current size. Returns false if the container has no
   * size yet (e.g. still display:none). */
  function setup(): boolean {
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    if (!width || !height) return false;
    lastWidth = width;
    lastHeight = height;

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

    // Pass 1: clean (unblurred) mask, used only to classify inside/outside for the depth transform
    // — the grain's own soft edge would confuse the BFS with false edge cells.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, off.width, off.height);
    drawGlyph();
    const maskData = ctx.getImageData(0, 0, off.width, off.height).data;
    const gridW = Math.ceil(off.width / STEP);
    const gridH = Math.ceil(off.height / STEP);
    const insideMask = new Uint8Array(gridW * gridH);
    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const px = Math.min(gx * STEP, off.width - 1);
        const py = Math.min(gy * STEP, off.height - 1);
        insideMask[gy * gridW + gx] = maskData[(py * off.width + px) * 4 + 3] > 128 ? 1 : 0;
      }
    }
    const depth = computeDepth(insideMask, gridW, gridH);

    // Pass 2: the same grainy, edge-eroded sampler as heroEngine.ts's seedText — blur radius and
    // noise-lobe size adapted from "fontSize*scale" (the text's own rendered size) to this glyph's
    // analogous rendered size, targetW-equivalent = off.width*scale-ish; using the fit box's own
    // scale keeps the same ratio the hero tuned.
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
    const ptsDepth: number[] = [];
    const ptsGx: number[] = [];
    const ptsGy: number[] = [];
    for (let y = 0; y < off.height; y += STEP) {
      for (let x = 0; x < off.width; x += STEP) {
        const red = grainData[(y * off.width + x) * 4];
        const a = red / 255;
        const region = latticeNoise(x, y, noiseCell * 6, 7);
        const amp = EDGE_WOBBLE * (0.35 + 1.3 * region);
        const wobble = (latticeNoise(x, y, noiseCell, 1) - 0.5) * 2 * amp * 4 * a * (1 - a);
        const p = clamp(a + wobble, 0, 1);
        if (Math.random() < DENSITY_CEILING * p ** 3) {
          const gx = Math.min(gridW - 1, (x / STEP) | 0);
          const gy = Math.min(gridH - 1, (y / STEP) | 0);
          ptsX.push(x + (Math.random() - 0.5) * STEP);
          ptsY.push(y + (Math.random() - 0.5) * STEP);
          ptsDepth.push(depth[gy * gridW + gx]);
          ptsGx.push(gx);
          ptsGy.push(gy);
        }
      }
    }

    const count = Math.min(ptsX.length, MAX_PARTICLES);
    allocate(count);
    for (let i = 0; i < count; i++) {
      ox[i] = ptsX[i];
      oy[i] = ptsY[i];
      const anchor = anchorToInterior(ptsGx[i], ptsGy[i], insideMask, depth, gridW, gridH);
      startX[i] = anchor.gx * STEP + STEP / 2 + (Math.random() - 0.5) * STEP;
      startY[i] = anchor.gy * STEP + STEP / 2 + (Math.random() - 0.5) * STEP;

      // Core particles (depth near 1, already close to their own anchor) arrive almost immediately;
      // edge particles (depth near 0) wait longer and travel further — the glyph reads as building
      // from each letter's interior outward. Same delay/duration shape as heroEngine.ts's
      // seedEntrance, re-keyed from horizontal position to depth.
      pDelay[i] = 0.25 * Math.random() + 0.35 * (1 - ptsDepth[i]);
      pDuration[i] = 0.9 + 0.53 * Math.random();
      // Wobble amplitude scales with this particle's own travel distance rather than heroEngine's
      // fixed 20-40px range: a hop here is only a few to a few dozen px (the whole point of
      // "esparcirse en el mismo sitio"), so a flat 20-40px wobble would dwarf the travel itself.
      const travel = Math.hypot(ox[i] - startX[i], oy[i] - startY[i]) || 1;
      wobAmp[i] = travel * (0.15 + 0.3 * Math.random());
      wobFreq[i] = 2 + 3 * Math.random();
      wobPhase[i] = Math.random() * Math.PI * 2;

      positions[i * 3] = startX[i];
      positions[i * 3 + 1] = startY[i];
      positions[i * 3 + 2] = 0;
    }
    (geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    return true;
  }

  /** Mirrors heroEngine.ts's stepEntrance exactly (expo-out ease, decaying perpendicular wobble) —
   * only startX/startY's meaning changed (interior anchor instead of an off-screen point). */
  function stepEntrance(elapsed: number): boolean {
    let allDone = true;
    for (let i = 0; i < n; i++) {
      const l = clamp((elapsed - pDelay[i]) / pDuration[i], 0, 1);
      if (l < 1) allDone = false;
      const eased = l === 1 ? 1 : 1 - Math.pow(2, -10 * l);
      const sx = startX[i];
      const sy = startY[i];
      const rx = ox[i];
      const ry = oy[i];
      let px = sx + (rx - sx) * eased;
      let py = sy + (ry - sy) * eased;
      const dirx = rx - sx;
      const diry = ry - sy;
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

  function replay() {
    if (destroyed) return;
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    if (width !== lastWidth || height !== lastHeight) {
      if (!setup()) return;
    }
    if (n === 0) return;
    for (let i = 0; i < n; i++) {
      positions[i * 3] = startX[i];
      positions[i * 3 + 1] = startY[i];
    }
    entranceStart = performance.now() / 1000;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  if (!setup()) return null;

  return {
    replay,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}

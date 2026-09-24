import * as THREE from "three";
import { UTU_LOGO_PATH_D } from "./UtuLogo";

/**
 * Framework-agnostic WebGL particle hero engine, ported from the reference
 * site's own lazily-loaded `initHeroEngine` chunk. Renders "you to you" as a
 * THREE.Points field (one draw call for up to 140k particles) that scatters
 * on cursor drag and springs back, then morphs into the utu logo as the page
 * scrolls into the white section. All physics constants below are copied
 * verbatim from the reference bundle (see the project's hero-rebuild plan);
 * the only deliberate deviations are noted inline.
 */

export type HeroEngine = {
  setMorphProgress: (p: number) => void;
  setColorMixTarget: (t: number) => void;
  setWhiteBgYOffset: (offset: number) => void;
  /** Re-samples the morph target's on-screen rect without changing morphProgress — call this on every
   * frame the `[data-hero-morph-target]` element itself is being animated (e.g. its `top` moving), so the
   * particles that already formed the target shape keep tracking it instead of visually detaching. */
  updateMorphTarget: () => void;
  /** Tilts the particle field in degrees, matching the CSS transform the hero's chrome layer uses.
   * Done in-scene rather than by CSS-transforming the canvas: a 3D CSS transform makes the GPU
   * resample the canvas as a texture, and the near-regular 1px grain beats against the sample grid
   * into a moiré band that reads as a sheen sweeping over the letters. Rendering the rotation
   * natively draws every point at its true position instead, so there is nothing to resample. */
  setTilt: (rxDeg: number, ryDeg: number) => void;
  resumeLoop: () => void;
  destroy: () => void;
};

export type HeroEngineOptions = {
  onSwipeUp?: () => void;
};

const CELL = 10;
const MAX_PARTICLES = 140000;
const DESIGN_W = 661;
const DESIGN_H = 695;
/** Distance in px from the camera to the z=0 particle plane. Mirrors the `perspective()` length the
 * hero's chrome layer uses in CSS, so the tilt foreshortens both by exactly the same amount. Every
 * particle sits at z=0, so the flat field projects 1:1 to pixels regardless of this value — it only
 * takes effect once `setTilt` pushes points off that plane. */
const PERSPECTIVE = 2500;

/** Cap on the drawing buffer's pixel ratio, and on the point size that is expressed in those same
 * pixels. Matches the reference.
 *
 * Raising it to 3 was tried, to stop a 3x phone stretching a 2x buffer over its pixels and washing
 * the grain into flat letterforms. It worked, but it is the wrong lever: it costs 2.25x the pixels
 * to shade and made the hero load and run visibly slower on device. The real fault was that a mobile
 * point covered less than one buffer pixel, so it was already being anti-aliased to a faint smudge
 * before any upscaling — a sub-pixel dot cannot survive being stretched. Grain that is coarse enough
 * to resolve in the first place travels through the upscale intact and costs nothing, which is what
 * the mobile branch of material.size now does.
 *
 * Must stay shared with material.size: point size is in buffer pixels, so both scale by this
 * together and apparent grain size is unchanged. Letting them drift would resize the grain. */
const MAX_PIXEL_RATIO = 2;

/** Smooth value noise on a hash lattice, in [0,1]. The glyph sampler's per-cell coin flips are
 * spatially independent, so on their own they can only fray an edge into fine dust — the contour
 * itself stays smooth at any scale above a pixel. Measured against the reference, our edge matched
 * it closely at fine scale but strayed 2.4x less at coarse scale, which is exactly that missing
 * correlation. Displacing the glyph's alpha by this instead makes the boundary wander in lobes and
 * bites, the way ink bleeds unevenly on rough paper. */
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

/** Ceiling on the sampling probability, so even a fully opaque cell sometimes seeds nothing.
 *
 * It exists to pay for material.size. The reference renders points ~1.108x larger than ours yet its
 * stroke interiors are *less* filled (95.1% against 98.5%), which is only possible if it draws
 * fewer of them — so matching its grain size without thinning the count would tile the strokes
 * solid and throw away the pitting. Points grew 0.56 -> 0.8, i.e. 2.04x the area, and this roughly
 * offsets that.
 *
 * Set by counting distinct marks per unit of letter area — holes enclosed by the grain, normalised
 * by stroke width, which makes the figure independent of how far a capture happens to be zoomed in.
 * The reference runs 407.5 per stroke squared against 259.2 here, so it lays down 1.57x as many
 * marks, and 0.62 x 1.57 lands essentially at the ceiling. Raising the count alone would have
 * tiled the strokes solid, so material.size drops to match; the two are solved together against the
 * reference's 93.1% interior fill and only make sense as a pair. */
const DENSITY_CEILING = 0.97;

/** How far the lattice noise may shift a glyph's alpha, at the contour.
 *
 * Amplitude and lobe size are not interchangeable, which is what an earlier pass got wrong. At 0.45
 * paired with lobes 5% of the font size — around a tenth of the cap height — the noise stopped
 * roughening the boundary and started melting it, and the letterforms visibly deformed. Dropping to
 * 0.15 then read as no effect at all. The fix is not a midpoint between those amplitudes: it is a
 * high amplitude over *small* lobes (see noiseCell), which chews the edge without moving where the
 * letter is. A tight blur also steepens the alpha gradient the noise has to fight, so this can run
 * hot without spreading the contour. */
const EDGE_WOBBLE = 0.32;
const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 3;
const COLOR_MIX_LERP = 0.08;

export function createHeroEngine(canvas: HTMLCanvasElement, opts: HeroEngineOptions = {}): HeroEngine {
  let destroyed = false;
  let n = 0;

  let positions = new Float32Array(0);
  let colors = new Float32Array(0);
  let alphas = new Float32Array(0);
  let vx = new Float32Array(0);
  let vy = new Float32Array(0);
  let logoX = new Float32Array(0);
  let logoY = new Float32Array(0);
  let textX = new Float32Array(0);
  let textY = new Float32Array(0);
  let ox = new Float32Array(0);
  let oy = new Float32Array(0);
  let startX = new Float32Array(0);
  let startY = new Float32Array(0);
  let returnFromX = new Float32Array(0);
  let returnFromY = new Float32Array(0);
  let pDelay = new Float32Array(0);
  let pDuration = new Float32Array(0);
  let wobAmp = new Float32Array(0);
  let wobFreq = new Float32Array(0);
  let wobPhase = new Float32Array(0);
  let returnAt = new Float32Array(0);
  let isText = new Uint8Array(0);

  let viewWidth = 1;
  let viewHeight = 1;
  let numCols = 1;
  let numRows = 1;
  let gridX = new Float32Array(1);
  let gridY = new Float32Array(1);
  let gridXv = new Float32Array(1);
  let gridYv = new Float32Array(1);
  let gridPressure = new Float32Array(1);

  let mouseX = -9999;
  let mouseY = -9999;
  let prevMouseX = -9999;
  let prevMouseY = -9999;
  let hasPointer = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  let morphProgress = 0;
  let morphWasActive = false;
  let colorMixTarget = 0;
  let colorMixValue = 0;
  let colorMixUniform: { value: number } | null = null;

  // The reveal (hero-text -> logo) and return (logo -> hero-text) beats are
  // each a fixed 0.8s eased *position* tween with their own clock — not fed
  // continuously by `morphProgress`'s live value (that's only used as an
  // edge-trigger, going 0->active or active->0). This is a direct port of
  // the reference's own `aB`/`aF` phases: verbatim `1 - Math.pow(1-p, 3)`
  // easing, same 0.8s duration, and the vector-logo opacity crossfade
  // folded into the last 40% of the SAME window instead of a separate
  // bolt-on tween — see heroEngine's rebuild notes.
  let revealActive = false;
  let returnActive = false;
  let revealStartAt = 0;
  let returnStartAt = 0;
  let arrived = false;
  let overlayEl: HTMLElement | null = null;

  let entranceStart = 0;
  let entranceActive = true;

  let rafId: number | null = null;
  let lastNow = 0;
  let accumulator = 0;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  // World Y maps to screen-down (matching the canvas-pixel coordinates every
  // particle position is computed in). Flipping just `up` while looking
  // down -Z also flips the right vector (a 180° rotation, not a Y-only
  // flip) — pairing the up-flip with a camera on the -Z side cancels that
  // out and leaves only the intended Y flip.
  camera.up.set(0, -1, 0);

  const geometry = new THREE.BufferGeometry();
  const material = new THREE.PointsMaterial({
    size: 1,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uColorMix = { value: colorMixValue };
    colorMixUniform = shader.uniforms.uColorMix;
    shader.vertexShader = shader.vertexShader.replace(
      "void main() {",
      "attribute float aAlpha;\nvarying float vAlpha;\nvoid main() {\n\tvAlpha = aAlpha;"
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      "varying float vAlpha;\nuniform float uColorMix;\nvoid main() {"
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <premultiplied_alpha_fragment>",
      "gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0), uColorMix);\ngl_FragColor.a *= vAlpha;\n#include <premultiplied_alpha_fragment>"
    );
  };

  const points = new THREE.Points(geometry, material);
  points.matrixAutoUpdate = false;
  points.frustumCulled = false;
  scene.add(points);

  let tiltXDeg = 0;
  let tiltYDeg = 0;
  const tiltEuler = new THREE.Euler();
  const tiltQuat = new THREE.Quaternion();
  const tiltPivot = new THREE.Vector3();
  const tiltScale = new THREE.Vector3(1, 1, 1);
  const tiltRecentre = new THREE.Matrix4();

  /** Rebuilds `points.matrix` as a rotation about the viewport centre (the particle coordinates are
   * absolute screen pixels, so rotating about the object origin would swing the whole field instead
   * of tipping it in place). */
  function applyTilt() {
    const cx = viewWidth / 2;
    const cy = viewHeight / 2;
    // Screen axes here are +X right and +Y down with the camera parked on -Z, so "towards the
    // viewer" is -Z — the mirror of CSS, where it is +Z. Mirroring one axis inverts rotations about
    // the other two, hence the negated angles: these reproduce the chrome layer's CSS tilt rather
    // than mirroring it.
    tiltEuler.set((-tiltXDeg * Math.PI) / 180, (-tiltYDeg * Math.PI) / 180, 0, "YXZ");
    tiltQuat.setFromEuler(tiltEuler);
    tiltPivot.set(cx, cy, 0);
    points.matrix.compose(tiltPivot, tiltQuat, tiltScale);
    points.matrix.multiply(tiltRecentre.makeTranslation(-cx, -cy, 0));
    points.matrixWorldNeedsUpdate = true;
  }

  function setTilt(rxDeg: number, ryDeg: number) {
    tiltXDeg = rxDeg;
    tiltYDeg = ryDeg;
    applyTilt();
  }

  function cellIndex(c: number, r: number) {
    return c * numRows + r;
  }
  function cellRight(i: number) {
    const c = Math.floor(i / numRows);
    return c + 1 < numCols ? i + numRows : i;
  }
  function cellDown(i: number) {
    const r = i % numRows;
    return r + 1 < numRows ? i + 1 : i;
  }

  function resizeCamera() {
    const rect = canvas.getBoundingClientRect();
    viewWidth = Math.max(1, rect.width);
    viewHeight = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(viewWidth, viewHeight, false);

    // fov is derived from the camera distance so the z=0 plane keeps filling the viewport exactly —
    // i.e. one world unit stays one CSS pixel whatever PERSPECTIVE is. Pulling the camera back from
    // the old `viewHeight` to PERSPECTIVE is therefore invisible for the flat field and only changes
    // how strongly `setTilt`'s z displacement foreshortens.
    camera.fov = 2 * Math.atan(viewHeight / 2 / PERSPECTIVE) * (180 / Math.PI);
    camera.aspect = viewWidth / viewHeight;
    camera.near = 0.1;
    camera.far = 2 * PERSPECTIVE;
    camera.position.set(viewWidth / 2, viewHeight / 2, -PERSPECTIVE);
    camera.lookAt(viewWidth / 2, viewHeight / 2, 0);
    camera.updateProjectionMatrix();
    applyTilt();

    const mobile = viewWidth < 1024;
    // Paired with DENSITY_CEILING — neither number means anything on its own, since count and point
    // area trade off against the same interior fill.
    //
    // An earlier pass read this as 0.80 by measuring "isolated" blobs out in the sparse edge zone,
    // on the assumption that a blob there is one point. That inflated the reference: the denser a
    // field is, the more often such a blob is really two or three points overlapping, so it measured
    // the reference's clumps against our singles and concluded its points were larger. Counting
    // marks per unit of letter area instead says the opposite — it lays down 1.57x as many. Holding
    // interior fill at its measured 93.1% while multiplying the count by 1.57 needs point area at
    // 0.70, so diameter lands here.
    // Mobile runs a FINER grain than desktop, matching the reference's own mechanic: its bundle sets
    // point size to (mobile ? 5 : 8) * min(dpr,2) — mobile at 62.5% of desktop, not larger. Ours had
    // drifted the opposite way (0.74 vs desktop's 0.67) while chasing a separate, sub-pixel-related
    // washout (see the floor note below), which read as "too chunky" once that was fixed.
    //
    // Their absolute numbers don't port: their glyph sampling is a hard >128 threshold that seeds
    // far fewer, much larger points, ours is a blurred probability mask with lattice-noise edge
    // erosion that seeds many tiny ones — different architectures converging on similar coverage by
    // opposite means. Only their mobile/desktop *ratio* carries over, and even that ratio can't be
    // hit exactly: applying 0.625 literally (0.67*0.625 = 0.42) lands at 0.84 buffer px, under the
    // 1px floor below. 0.6 is the highest value that is both under desktop and clear of that floor.
    //
    // The floor: point size here is in buffer pixels, so with the cap at 2 a factor of 0.5 is
    // exactly one pixel, and the GPU saturates anything at or below that to a washed-out dot
    // regardless of the value — that saturation, not the phone's display upscaling, was the real
    // cause of the original flat look. Stay above ~0.55. Reducing size also thins coverage and there
    // is no headroom to compensate with count, since DENSITY_CEILING is already near 1 and the
    // sampling grid is an integer.
    material.size = (mobile ? 0.5 : 0.8) * Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);

    numCols = Math.max(1, Math.ceil(viewWidth / CELL));
    numRows = Math.max(1, Math.ceil(viewHeight / CELL));
    const cellCount = numCols * numRows;
    gridX = new Float32Array(cellCount);
    gridY = new Float32Array(cellCount);
    gridXv = new Float32Array(cellCount);
    gridYv = new Float32Array(cellCount);
    gridPressure = new Float32Array(cellCount);
    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < numRows; r++) {
        const i = cellIndex(c, r);
        gridX[i] = c * CELL + CELL / 2;
        gridY[i] = r * CELL + CELL / 2;
      }
    }
  }

  function allocate(count: number) {
    n = count;
    positions = new Float32Array(3 * n);
    colors = new Float32Array(3 * n).fill(1);
    alphas = new Float32Array(n).fill(1);
    vx = new Float32Array(n);
    vy = new Float32Array(n);
    logoX = new Float32Array(n);
    logoY = new Float32Array(n);
    textX = new Float32Array(n);
    textY = new Float32Array(n);
    ox = new Float32Array(n);
    oy = new Float32Array(n);
    startX = new Float32Array(n);
    startY = new Float32Array(n);
    returnFromX = new Float32Array(n);
    returnFromY = new Float32Array(n);
    pDelay = new Float32Array(n);
    pDuration = new Float32Array(n);
    wobAmp = new Float32Array(n);
    wobFreq = new Float32Array(n);
    wobPhase = new Float32Array(n);
    returnAt = new Float32Array(n).fill(-1);
    isText = new Uint8Array(n);

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));

    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __hero?: { count: number } }).__hero = { count: n };
    }
  }

  /** Rasterizes "you to you" using the reference site's own sampling pipeline. */
  async function seedText() {
    await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (destroyed) return;

    const mobile = viewWidth < 1024;
    const supersample = mobile ? 1.4 : 1.2;
    const cw = Math.max(1, Math.floor(viewWidth * supersample));
    const ch = Math.max(1, Math.floor(viewHeight * supersample));

    const off = document.createElement("canvas");
    off.width = cw;
    off.height = ch;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);

    const fit = mobile ? 0.8 : 0.6;
    const scale = Math.min((cw * fit) / DESIGN_W, (ch * fit) / DESIGN_H);

    const fontSize = 331;
    const lineHeightRatio = 0.62;
    const lineHeight = fontSize * lineHeightRatio;

    ctx.save();
    ctx.translate(cw / 2 - 330.5 * scale, ch / 2 - 347.5 * scale);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#fff";
    // Reference's letter edges aren't a crisp cutout — a direct, matched-
    // scale capture of the live newmix hero (zoomed into "art"/"with") shows
    // a genuinely wide scatter of grain trailing off the glyph's contour,
    // more dispersed than an earlier, over-corrected pass here that tightened
    // this down to a thin band. This is tuned directly against that capture.
    // Set by comparing the SAME letter in both heroes — the 't', the only one the two straplines
    // share. That matters: an earlier pass compared our 'u' against the reference's 'w' and every
    // number it produced was contaminated by letterform geometry rather than grain. Smoothing a 'w'
    // destroys its three junctions, which that pass read as edge roughness, and a 'w' also carries
    // far more perimeter per unit area, which it read as a wider edge band. Both pushed toward
    // widening this blur, and doubling it bloated the letterforms out of shape. Measured honestly on
    // matched 't's, the reference's edge is the *tighter* one: its 85%->15% transition spans 11.8%
    // of stroke width against 16.3% here.
    ctx.filter = `blur(${fontSize * scale * 0.008}px)`;
    // Reference headline is a super-heavy Helvetica baked to path data at
    // design time. Bundled locally as a next/font/local face (see
    // layout.tsx); resolve its generated family name from the CSS var.
    const helveticaBlack = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-helvetica-black")
      .trim();
    ctx.font = `900 ${fontSize}px ${helveticaBlack}`;
    ctx.textBaseline = "middle";
    ctx.letterSpacing = `${-fontSize * 0.1}px`;
    // Bloque subido 25% de la altura renderizada de la "o" de "you" (dos
    // ajustes de 12.5% acumulados: natHeight 180.53px * glyphHeightScale 0.85
    // = 153.45px; 12.5% ≈ 19.18px, doble ≈ 38.36px), medido directamente
    // contra la fuente/tamaño reales del motor.
    const baseY = DESIGN_H / 2 - lineHeight - 38.36;
    // Y-only compression (no X narrowing) left the glyphs reading noticeably
    // wider than the source font's own proportions — visibly "stretched"
    // horizontally once compared side by side. Narrow X by ~20% alongside
    // the existing Y compression so the letters keep their shorter height
    // but stop looking horizontally inflated.
    const glyphHeightScale = 0.85;
    const glyphWidthScale = 0.8;
    // Left-aligned stack, not three centred lines. One shared left edge runs down the block, and
    // the opening "y" hangs out to the left of it — so the "ou" of line 1 starts exactly where the
    // "to" and the final "you" do. Measured off the reference layout: lines 2 and 3 both began at
    // x=176 while line 1 began at x=97, the 79px difference being precisely one "y" advance.
    //
    // Taking that advance as the difference of two measurements rather than measuring "y" on its
    // own is deliberate: letterSpacing is negative here and is applied per character, so a lone "y"
    // does not measure the same as the "y" inside "you", and the edge would sit a few px off.
    ctx.textAlign = "left";
    const lineW = ctx.measureText("you").width;
    const yAdvance = lineW - ctx.measureText("ou").width;
    const blockLeft = DESIGN_W / 2 - ((yAdvance + lineW) * glyphWidthScale) / 2;
    // Only the last gap is tightened, to 80% of the leading, so lines 1 and 2 stay exactly where
    // they were placed. That does leave the block 20% of a line shorter overall, hanging its
    // midpoint slightly higher than before — the alternative, re-centring, would have moved the
    // first two lines off the vertical position tuned for them above.
    const lineTops = [0, lineHeight, lineHeight * 1.8];
    ["you", "to", "you"].forEach((line, i) => {
      const y = baseY + lineTops[i];
      ctx.save();
      ctx.translate(blockLeft, y);
      ctx.scale(glyphWidthScale, glyphHeightScale);
      ctx.fillText(line, i === 0 ? 0 : yAdvance, 0);
      ctx.restore();
    });
    ctx.restore();

    // 2px on both breakpoints. Going finer than this was tried on desktop and backfired: halving
    // the cell size quadruples how many candidate cells land in the blurred fringe, so even a
    // steeper probability curve nets more stray particles, not fewer, and the halo widened instead
    // of tightening. Mobile used to sit at 1px, which is the same trap — it quadrupled the count
    // for grain too fine to resolve on a phone, and made the hero slow to load there. Grain size
    // belongs to material.size, not to this.
    const step = 2;
    const data = ctx.getImageData(0, 0, cw, ch).data;
    const pts: { x: number; y: number }[] = [];
    // Lobe size, and the reason the edge can be roughened without the letter deforming. At 0.05 the
    // lobes ran about a tenth of the cap height, big enough that the noise displaced whole sections
    // of contour. Roughly halved, each lobe is smaller than a stroke is wide, so the boundary frays
    // in bites instead of drifting.
    const noiseCell = fontSize * scale * 0.028;
    for (let y = 0; y < ch; y += step) {
      for (let x = 0; x < cw; x += step) {
        const red = data[(y * cw + x) * 4];
        // Tuned against a pixel analysis of matched-scale captures of both
        // heroes side by side. The exponent is set by the wide shot: stray
        // lit pixels outside the glyph body measured 0.31% on the reference
        // against 2.14% here, so its outline is far cleaner than ours and the
        // cubic curve starves the blurred fringe that was spraying them.
        // Deliberately no sub-1 ceiling here: on matched 't's the reference's interior fill is
        // 95.1%, so it is denser than a ceiling would leave us. Interior porosity is set by
        // material.size instead — with dark-gap size already matching between the two, mean white
        // run follows from fill alone, so fill is the only interior knob worth turning.
        const a = red / 255;
        // A second, much slower field modulates how hard the first one bites, so the erosion is
        // uneven from region to region — one flank of a letter chewed, another nearly clean. With a
        // single field the whole glyph erodes at a statistically uniform rate, which is the tell
        // that gives a synthetic edge away; real ink never wears evenly. It swings the amplitude
        // either side of EDGE_WOBBLE without shifting its average, so the overall strength stays
        // where it was tuned.
        const region = latticeNoise(x, y, noiseCell * 6, 7);
        const amp = EDGE_WOBBLE * (0.35 + 1.3 * region);
        // Weighted by 4a(1-a) so it peaks on the 50% boundary and vanishes into the solid core and
        // the empty field: this is meant to reshape where the edge *is*, not to pit the interior or
        // fling specks into open space, both of which measured wrong in earlier passes.
        const wobble = (latticeNoise(x, y, noiseCell, 1) - 0.5) * 2 * amp * 4 * a * (1 - a);
        const p = Math.min(1, Math.max(0, a + wobble));
        if (Math.random() < DENSITY_CEILING * p ** 3) {
          pts.push({
            x: (x + (Math.random() - 0.5) * step) / supersample,
            y: (y + (Math.random() - 0.5) * step) / supersample,
          });
        }
      }
    }

    for (let i = pts.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    if (pts.length > MAX_PARTICLES) pts.length = MAX_PARTICLES;

    if (isLowEndDevice()) {
      const halved: typeof pts = [];
      for (let i = 0; i < pts.length; i += 2) halved.push(pts[i]);
      pts.length = 0;
      pts.push(...halved);
    }

    allocate(pts.length);
    for (let i = 0; i < pts.length; i++) {
      logoX[i] = pts[i].x;
      logoY[i] = pts[i].y;
      textX[i] = pts[i].x;
      textY[i] = pts[i].y;
      ox[i] = pts[i].x;
      oy[i] = pts[i].y;
    }
    computeMorphShape();
    seedEntrance();
  }

  function isLowEndDevice(): boolean {
    const nav = navigator as Navigator & { deviceMemory?: number };
    if (nav.deviceMemory && nav.deviceMemory <= 4) return true;
    const gl = renderer.getContext();
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (dbg) {
      const name = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)).toLowerCase();
      if (name.includes("swiftshader") || name.includes("software")) return true;
    }
    return false;
  }

  // Cached by `computeMorphShape()` (expensive: rasterize + sort, geometry-only,
  // independent of scroll position) and consumed by `repositionMorphTarget()`
  // (cheap: just re-offsets by the wordmark's *current* on-screen rect). The
  // wordmark scrolls with the page, so its viewport position at seed time
  // (scrollTop 0, off-screen below the hero) is not where it ends up once the
  // scroll-driven morph actually completes — the target has to be
  // recomputed against the live rect, not captured once.
  let morphLocalPts: { x: number; y: number }[] = [];
  let morphOrder: number[] = [];
  let morphTargetW = 0;
  let morphTargetH = 0;

  // Glyph's own tight bounds within the shared 1904x742 viewBox (matches
  // Nav.tsx's crop) — the raw viewBox pads the glyph's bottom-right, which
  // otherwise rasterizes/centers the shape off to the left of its box.
  const GLYPH_BOX = { x: 11, y: 5, w: 1009, h: 394 };

  /** Rasterizes the utu logo at its target size; positions are relative to (0,0). */
  function computeMorphShape() {
    // Matches the `[data-hero-morph-target]` box exactly (StatementSection.tsx,
    // BrandSnapMobile.tsx). Shrunk from 380: at that size the landed wordmark
    // read as too large/blocky next to how the reference settles its own
    // (much smaller, 138px-wide) logo — this keeps the same silhouette at a
    // scale closer to that proportion.
    const targetW = 220;
    const targetH = (GLYPH_BOX.h / GLYPH_BOX.w) * targetW;
    morphTargetW = targetW;
    morphTargetH = targetH;

    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.ceil(targetW));
    off.height = Math.max(1, Math.ceil(targetH));
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, off.width, off.height);
    ctx.fillStyle = "#fff";
    const path = new Path2D(UTU_LOGO_PATH_D);
    const s = targetW / GLYPH_BOX.w;
    ctx.save();
    ctx.translate(-GLYPH_BOX.x * s, -GLYPH_BOX.y * s);
    ctx.scale(s, s);
    ctx.fill(path);
    ctx.restore();

    // Deliberately NOT the hero text's sampler. The reference samples its logo with a plain hard
    // threshold on an unblurred mask (step 2, >128) — separately from its text sampler — so the
    // wordmark the particles land on reads as a clean solid shape. Reusing the text's blur, lattice
    // wobble and density ceiling here made our logo land rough and distressed instead.
    const step = 2;
    const data = ctx.getImageData(0, 0, off.width, off.height).data;
    const pts: { x: number; y: number }[] = [];
    for (let y = 0; y < off.height; y += step) {
      for (let x = 0; x < off.width; x += step) {
        if (data[(y * off.width + x) * 4] > 128) pts.push({ x, y });
      }
    }
    // Sort both point clouds by *normalized* position (each within its own
    // bounding box), not raw pixels — "you to you" spans ~700px across 3
    // lines while the utu logo is a single 138px-wide line, so sorting by
    // raw x/y would map the logo's whole width onto a thin sliver of the
    // text's x-range, producing a jumbled, skewed-looking correspondence.
    // Normalizing first means "top-left of the text" reliably lines up with
    // "top-left of the logo", giving each particle a short, coherent path.
    let tMinX = Infinity;
    let tMaxX = -Infinity;
    let tMinY = Infinity;
    let tMaxY = -Infinity;
    for (const p of pts) {
      if (p.x < tMinX) tMinX = p.x;
      if (p.x > tMaxX) tMaxX = p.x;
      if (p.y < tMinY) tMinY = p.y;
      if (p.y > tMaxY) tMaxY = p.y;
    }
    const tRangeX = tMaxX - tMinX || 1;
    const tRangeY = tMaxY - tMinY || 1;
    pts.sort((a, b) => {
      const na = (a.y - tMinY) / tRangeY;
      const nb = (b.y - tMinY) / tRangeY;
      return na - nb || (a.x - tMinX) / tRangeX - (b.x - tMinX) / tRangeX;
    });
    morphLocalPts = pts;

    let sMinX = Infinity;
    let sMaxX = -Infinity;
    let sMinY = Infinity;
    let sMaxY = -Infinity;
    for (let i = 0; i < n; i++) {
      if (logoX[i] < sMinX) sMinX = logoX[i];
      if (logoX[i] > sMaxX) sMaxX = logoX[i];
      if (logoY[i] < sMinY) sMinY = logoY[i];
      if (logoY[i] > sMaxY) sMaxY = logoY[i];
    }
    const sRangeX = sMaxX - sMinX || 1;
    const sRangeY = sMaxY - sMinY || 1;
    const order = Array.from({ length: n }, (_, i) => i);
    order.sort((a, b) => {
      const na = (logoY[a] - sMinY) / sRangeY;
      const nb = (logoY[b] - sMinY) / sRangeY;
      return na - nb || (logoX[a] - sMinX) / sRangeX - (logoX[b] - sMinX) / sRangeX;
    });
    morphOrder = order;

    repositionMorphTarget();
  }

  /** Re-offsets the cached morph shape onto the wordmark's *current* viewport rect. */
  function repositionMorphTarget() {
    if (morphLocalPts.length === 0 || morphOrder.length === 0) return;
    const el = document.querySelector<HTMLElement>("[data-hero-morph-target]");
    const rect = el ? el.getBoundingClientRect() : null;
    const originX = rect ? rect.left + rect.width / 2 - morphTargetW / 2 : viewWidth / 2 - morphTargetW / 2;
    const originY = rect ? rect.top + rect.height / 2 - morphTargetH / 2 : viewHeight / 2 - morphTargetH / 2;

    const pts = morphLocalPts;
    const order = morphOrder;
    const assignCount = Math.min(n, pts.length);
    for (let k = 0; k < assignCount; k++) {
      const i = order[k];
      textX[i] = originX + pts[k].x;
      textY[i] = originY + pts[k].y;
      isText[i] = 1;
    }
    // Particles beyond the logo's own pixel count don't get a crisp slot,
    // but they still travel toward the target area (reusing target points
    // with jitter, wrapping around) so the whole field visibly streams
    // toward the destination instead of the majority just fading in place
    // while only a sparse subset relocates — that reads as two disconnected
    // things happening rather than one fluid morph.
    const overflow = Math.max(1, order.length - assignCount);
    for (let k = assignCount; k < order.length; k++) {
      const i = order[k];
      if (pts.length > 0) {
        const reuse = pts[k % pts.length];
        const spread = 8 + 24 * ((k - assignCount) / overflow);
        textX[i] = originX + reuse.x + (Math.random() - 0.5) * spread;
        textY[i] = originY + reuse.y + (Math.random() - 0.5) * spread;
      } else {
        textX[i] = logoX[i] + (Math.random() - 0.5);
        textY[i] = logoY[i] + (Math.random() - 0.5);
      }
      isText[i] = 0;
    }
  }

  function seedEntrance() {
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < n; i++) {
      if (logoX[i] < minX) minX = logoX[i];
      if (logoX[i] > maxX) maxX = logoX[i];
    }
    const rangeX = maxX - minX || 1;
    const angle = -(0.15 * Math.PI);
    const dist = 1.2 * Math.max(viewWidth, viewHeight);
    for (let i = 0; i < n; i++) {
      startX[i] = logoX[i] + Math.cos(angle) * dist + (Math.random() - 0.5) * 300;
      startY[i] = logoY[i] + Math.sin(angle) * dist + (Math.random() - 0.5) * viewHeight * 0.8;
      const nx = (logoX[i] - minX) / rangeX;
      // Reference (newmixcoffee.com) reads as mostly-arrived by ~1s post-load
      // (only a light comet-tail trailing in); the old wider delay/duration
      // spread here (max ~1.01s delay + up to 1.43s flight) left the field
      // still a diffuse, unreadable cloud at t=1s and only resolved by ~2s —
      // confirmed by side-by-side timed screenshots of both sites. Tightened
      // to front-load more of the field while keeping the same nx-biased
      // left-to-right stagger and the same expo-out easing shape below.
      pDelay[i] = 0.25 * Math.random() + 0.35 * nx;
      // Reduced ~25% from the earlier speed-up pass (0.6 + 0.35*rand) — that
      // round front-loaded the field to fix a too-slow entrance, but it ended
      // up faster than the reference's own right-side sweep; this eases back
      // toward it without reverting to the original sluggish spread. Then
      // slowed another 20% on top (0.75+0.44*rand * 1.2).
      pDuration[i] = 0.9 + 0.53 * Math.random();
      wobAmp[i] = 20 + 40 * Math.random();
      wobFreq[i] = 2 + 3 * Math.random();
      wobPhase[i] = Math.random() * Math.PI * 2;
      positions[i * 3] = startX[i];
      positions[i * 3 + 1] = startY[i];
      positions[i * 3 + 2] = 0;
      vx[i] = 0;
      vy[i] = 0;
      returnAt[i] = -1;
    }
    entranceStart = performance.now() / 1000;
    entranceActive = true;
    (geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  function stepEntrance(elapsed: number): boolean {
    let allDone = true;
    for (let i = 0; i < n; i++) {
      const l = Math.min(1, Math.max(0, (elapsed - pDelay[i]) / pDuration[i]));
      if (l < 1) allDone = false;
      const eased = l === 1 ? 1 : 1 - Math.pow(2, -10 * l);
      const rx = ox[i];
      const ry = oy[i];
      const sx = startX[i];
      const sy = startY[i];
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
      vx[i] = 0;
      vy[i] = 0;
    }
    return allDone;
  }

  function updateRestTargets() {
    for (let i = 0; i < n; i++) {
      // Plain linear lerp on the raw `morphProgress` — matches the reference
      // engine exactly (`t.ox = t.logoX + (t.textX-t.logoX)*l`, no per-particle
      // delay or easing here). The fluid "dust settling" feel comes entirely
      // from stepParticles' own velocity/damping spring chasing this target,
      // not from smoothing the target itself — easing it here too fought that
      // spring instead of complementing it, and read as choppier, not softer.
      ox[i] = logoX[i] + (textX[i] - logoX[i]) * morphProgress;
      oy[i] = logoY[i] + (textY[i] - logoY[i]) * morphProgress;
    }
  }

  function updateAlpha() {
    // Only runs during entrance/idle (revealActive/returnActive manage alpha
    // themselves — see stepReveal/stepReturn/setMorphProgress). At rest in
    // the hero (morphProgress 0) every particle should read as visible dust.
    for (let i = 0; i < n; i++) {
      alphas[i] = isText[i] ? 1 : Math.max(0, 1 - morphProgress);
    }
    (geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }

  function setOverlayOpacity(v: number) {
    if (!overlayEl) overlayEl = document.querySelector<HTMLElement>("[data-hero-morph-target]");
    if (overlayEl) overlayEl.style.opacity = String(v);
  }

  /** Hero text -> logo: fixed 0.8s eased position tween, own clock (see the `revealActive` comment above). */
  function stepReveal(now: number) {
    const frac = Math.min(1, (now - revealStartAt) / 0.8);
    const eased = 1 - Math.pow(1 - frac, 3);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = returnFromX[i] + (textX[i] - returnFromX[i]) * eased;
      positions[i * 3 + 1] = returnFromY[i] + (textY[i] - returnFromY[i]) * eased;
      vx[i] = 0;
      vy[i] = 0;
    }
    // Vector-logo crossfade folded into the last 40% of this same window —
    // not a separate step after the particles arrive.
    if (frac > 0.6) {
      const e = (frac - 0.6) / 0.4;
      const opacity = e > 0.99 ? 1 : e;
      setOverlayOpacity(opacity);
      for (let i = 0; i < n; i++) alphas[i] = 1 - e;
      (geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    }
    if (frac >= 1) {
      revealActive = false;
      arrived = true;
      setOverlayOpacity(1);
      for (let i = 0; i < n; i++) alphas[i] = 0;
      (geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  /** Logo -> hero text: symmetric fixed 0.8s eased position tween back to the "you to you" shape. */
  function stepReturn(now: number) {
    const frac = Math.min(1, (now - returnStartAt) / 0.8);
    const eased = 1 - Math.pow(1 - frac, 3);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = returnFromX[i] + (logoX[i] - returnFromX[i]) * eased;
      positions[i * 3 + 1] = returnFromY[i] + (logoY[i] - returnFromY[i]) * eased;
      vx[i] = 0;
      vy[i] = 0;
    }
    if (frac >= 1) returnActive = false;
  }

  function updateColorMix() {
    const diff = colorMixTarget - colorMixValue;
    colorMixValue = Math.abs(diff) < 0.01 ? colorMixTarget : colorMixValue + diff * COLOR_MIX_LERP;
    if (colorMixUniform) colorMixUniform.value = colorMixValue;
  }

  function applyCursorImpulse(dxRaw: number, dyRaw: number) {
    if (dxRaw === 0 && dyRaw === 0) return;
    const steps = Math.max(1, Math.ceil(Math.hypot(dxRaw, dyRaw) / 6));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const sx = prevMouseX + dxRaw * t;
      const sy = prevMouseY + dyRaw * t;
      const c0 = Math.max(0, Math.floor((sx - 48) / CELL));
      const c1 = Math.min(numCols - 1, Math.floor((sx + 48) / CELL));
      const r0 = Math.max(0, Math.floor((sy - 48) / CELL));
      const r1 = Math.min(numRows - 1, Math.floor((sy + 48) / CELL));
      for (let c = c0; c <= c1; c++) {
        for (let r = r0; r <= r1; r++) {
          const i = cellIndex(c, r);
          const dx = gridX[i] - sx;
          const dy = gridY[i] - sy;
          let dist = Math.hypot(dx, dy);
          if (dist < 48) {
            if (dist < 4) dist = 48;
            const f = 48 / dist;
            gridXv[i] += dxRaw * f;
            gridYv[i] += dyRaw * f;
          }
        }
      }
    }
  }

  function stepGrid(t: number) {
    const n1 = 0.06 * t;
    for (let i = 0; i < gridXv.length; i++) {
      gridXv[i] += 0.005 * Math.sin(0.005 * gridY[i] + n1);
      gridYv[i] += 0.005 * Math.cos(0.005 * gridX[i] - 1.1 * n1);
    }
    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < numRows; r++) {
        const i = cellIndex(c, r);
        const ul = cellIndex(Math.max(0, c - 1), Math.max(0, r - 1));
        const u = cellIndex(c, Math.max(0, r - 1));
        const ur = cellIndex(Math.min(numCols - 1, c + 1), Math.max(0, r - 1));
        const l = cellIndex(Math.max(0, c - 1), r);
        const rr = cellIndex(Math.min(numCols - 1, c + 1), r);
        const dl = cellIndex(Math.max(0, c - 1), Math.min(numRows - 1, r + 1));
        const d = cellIndex(c, Math.min(numRows - 1, r + 1));
        const dr = cellIndex(Math.min(numCols - 1, c + 1), Math.min(numRows - 1, r + 1));
        gridPressure[i] =
          (0.5 * gridXv[ul] +
            gridXv[l] +
            0.5 * gridXv[dl] -
            0.5 * gridXv[ur] -
            gridXv[rr] -
            0.5 * gridXv[dr] +
            0.5 * gridYv[ul] +
            gridYv[u] +
            0.5 * gridYv[ur] -
            0.5 * gridYv[dl] -
            gridYv[d] -
            0.5 * gridYv[dr]) *
          0.25;
      }
    }
    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < numRows; r++) {
        const i = cellIndex(c, r);
        const ul = cellIndex(Math.max(0, c - 1), Math.max(0, r - 1));
        const u = cellIndex(c, Math.max(0, r - 1));
        const ur = cellIndex(Math.min(numCols - 1, c + 1), Math.max(0, r - 1));
        const l = cellIndex(Math.max(0, c - 1), r);
        const rr = cellIndex(Math.min(numCols - 1, c + 1), r);
        const dl = cellIndex(Math.max(0, c - 1), Math.min(numRows - 1, r + 1));
        const d = cellIndex(c, Math.min(numRows - 1, r + 1));
        const dr = cellIndex(Math.min(numCols - 1, c + 1), Math.min(numRows - 1, r + 1));
        gridXv[i] +=
          0.25 *
          (0.5 * gridPressure[ul] + gridPressure[l] + 0.5 * gridPressure[dl] - 0.5 * gridPressure[ur] - gridPressure[rr] - 0.5 * gridPressure[dr]);
        gridYv[i] +=
          0.25 *
          (0.5 * gridPressure[ul] + gridPressure[u] + 0.5 * gridPressure[ur] - 0.5 * gridPressure[dl] - gridPressure[d] - 0.5 * gridPressure[dr]);
      }
    }
    for (let i = 0; i < gridXv.length; i++) {
      const s = Math.hypot(gridXv[i], gridYv[i]);
      if (s > 100) {
        const f = 100 / s;
        gridXv[i] *= f;
        gridYv[i] *= f;
      }
      gridXv[i] *= 0.99;
      gridYv[i] *= 0.99;
    }
  }

  function stepParticles(now: number, dt: number, forceReturn: boolean) {
    for (let i = 0; i < n; i++) {
      const speed = Math.hypot(vx[i], vy[i]);
      if (forceReturn) {
        if (returnAt[i] < 0) returnAt[i] = now;
      } else if (speed > 0.5) {
        returnAt[i] = -1;
      } else if (returnAt[i] < 0) {
        returnAt[i] = now;
      }
      if (returnAt[i] >= 0) {
        const p = Math.min(1, (now - returnAt[i]) / 0.05);
        const ease = p * p * (3 - 2 * p);
        const k = 50 * dt * (0.15 + 0.85 * ease);
        vx[i] += (ox[i] - positions[i * 3]) * k;
        vy[i] += (oy[i] - positions[i * 3 + 1]) * k;
      }

      const px = positions[i * 3];
      const py = positions[i * 3 + 1];
      const gx = Math.min(Math.max(px, 0), viewWidth);
      const gy = Math.min(Math.max(py, 0), viewHeight);
      const c = Math.min(numCols - 1, Math.max(0, (gx / CELL) | 0));
      const r = Math.min(numRows - 1, Math.max(0, (gy / CELL) | 0));
      const cellI = cellIndex(c, r);
      const fRight = cellRight(cellI);
      const fDown = cellDown(cellI);
      const dFrac = (((px % CELL) + CELL) % CELL) / CELL;
      const pFrac = (((py % CELL) + CELL) % CELL) / CELL;
      vx[i] += (1 - dFrac) * gridXv[cellI] * 0.06;
      vy[i] += (1 - pFrac) * gridYv[cellI] * 0.06;
      vx[i] += dFrac * gridXv[fRight] * 0.06;
      vy[i] += dFrac * gridYv[fRight] * 0.06;
      vx[i] += pFrac * gridXv[fDown] * 0.06;
      vy[i] += pFrac * gridYv[fDown] * 0.06;

      const spd = Math.hypot(vx[i], vy[i]);
      if (spd > 30) {
        const f = 30 / spd;
        vx[i] *= f;
        vy[i] *= f;
      }

      positions[i * 3] += vx[i];
      positions[i * 3 + 1] += vy[i];

      vx[i] *= 0.4;
      vy[i] *= 0.4;
    }
  }

  function frame(nowMs: number) {
    if (destroyed) return;
    const now = nowMs / 1000;
    if (lastNow === 0) lastNow = now;
    const frameDt = Math.min(0.05, now - lastNow);
    lastNow = now;

    const hasPrevPointer = prevMouseX > -9000 && prevMouseY > -9000;
    const rawDx = hasPointer && hasPrevPointer ? mouseX - prevMouseX : 0;
    const rawDy = hasPointer && hasPrevPointer ? mouseY - prevMouseY : 0;
    // Seed the impulse origin on the first frame the cursor exists (or exists
    // again after leaving). It now only advances where the impulse fires, so
    // without this it would sit on the sentinel forever and no impulse would
    // ever be produced. There is no travel to attribute yet, so this frame
    // correctly contributes nothing.
    if (hasPointer && !hasPrevPointer) {
      prevMouseX = mouseX;
      prevMouseY = mouseY;
    }

    updateColorMix();

    // `seedText()` is async (awaits fonts + rasterizes); the render loop
    // starts immediately, so the first several frames can land before
    // `allocate()` has created the geometry attributes. Skip the
    // particle-attribute work entirely until seeding has run at least once.
    if (n > 0) {
      updateRestTargets();

      if (revealActive) {
        stepReveal(now);
      } else if (returnActive) {
        stepReturn(now);
      } else if (entranceActive) {
        const elapsed = now - entranceStart;
        if (stepEntrance(elapsed)) entranceActive = false;
        updateAlpha();
      } else {
        accumulator += frameDt;
        let steps = 0;
        let first = true;
        while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
          if (first && (rawDx !== 0 || rawDy !== 0)) {
            applyCursorImpulse(rawDx, rawDy);
            // Advance the impulse origin only once the impulse has actually
            // fired. Above 60Hz the accumulator leaves this loop unentered on
            // roughly every other frame, so advancing it per frame (as this
            // used to) silently dropped that frame's cursor travel. The
            // impulse is superlinear in the delta — it stamps the full delta
            // at every ~6px along the segment — so losing half the travel cost
            // far more than half the force. Holding the origin here instead
            // lets the travel accumulate across skipped frames, which also
            // keeps `applyCursorImpulse`'s segment start correct.
            prevMouseX = mouseX;
            prevMouseY = mouseY;
          }
          first = false;
          stepGrid(now);
          stepParticles(now, FIXED_DT, morphProgress > 0);
          accumulator -= FIXED_DT;
          steps++;
        }
        updateAlpha();
      }

      (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    renderer.render(scene, camera);

    const settled = !revealActive && !returnActive && morphProgress >= 1 && Math.abs(colorMixValue - colorMixTarget) < 0.01;
    if (settled) {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  function resumeLoop() {
    if (rafId === null && !destroyed) {
      lastNow = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  function setMorphProgress(p: number) {
    morphProgress = Math.min(1, Math.max(0, p));
    const isActive = morphProgress > 0;

    if (isActive && !morphWasActive) {
      // Forward trigger: reveal from wherever particles currently sit toward
      // the logo shape (their live rendered position, not a rest target —
      // in practice this fires on frame 1 of the outer tween so it's
      // effectively the hero-text shape, but captured live for correctness
      // if re-triggered mid-flight).
      revealActive = true;
      returnActive = false;
      revealStartAt = performance.now() / 1000;
      for (let i = 0; i < n; i++) {
        returnFromX[i] = positions[i * 3];
        returnFromY[i] = positions[i * 3 + 1];
      }
    } else if (!isActive && morphWasActive) {
      // Reverse trigger: return from wherever particles currently sit back
      // to the hero-text shape.
      returnActive = true;
      revealActive = false;
      returnStartAt = performance.now() / 1000;
      if (arrived) {
        // Fully landed on the logo already — start each particle from its
        // own logo-shape point (or, for the filler particles that never got
        // a crisp slot, a small jitter around a random landed particle),
        // matching the reference exactly instead of an arbitrary snap.
        const textIdx: number[] = [];
        for (let i = 0; i < n; i++) if (isText[i]) textIdx.push(i);
        for (let i = 0; i < n; i++) {
          if (isText[i]) {
            returnFromX[i] = textX[i];
            returnFromY[i] = textY[i];
          } else if (textIdx.length > 0) {
            const ref = textIdx[Math.floor(Math.random() * textIdx.length)];
            returnFromX[i] = textX[ref] + (Math.random() - 0.5) * 2;
            returnFromY[i] = textY[ref] + (Math.random() - 0.5) * 2;
          } else {
            returnFromX[i] = positions[i * 3];
            returnFromY[i] = positions[i * 3 + 1];
          }
        }
      } else {
        // Reversed mid-flight (still revealing) — start from wherever each
        // particle actually is right now, so there's no visual jump.
        for (let i = 0; i < n; i++) {
          returnFromX[i] = positions[i * 3];
          returnFromY[i] = positions[i * 3 + 1];
        }
      }
      for (let i = 0; i < n; i++) {
        positions[i * 3] = returnFromX[i];
        positions[i * 3 + 1] = returnFromY[i];
        vx[i] = 0;
        vy[i] = 0;
        alphas[i] = 1;
      }
      (geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
      arrived = false;
      setOverlayOpacity(0);
    }
    morphWasActive = isActive;

    if (morphProgress > 0) repositionMorphTarget();
    resumeLoop();
  }
  function setColorMixTarget(t: number) {
    colorMixTarget = Math.min(1, Math.max(0, t));
    resumeLoop();
  }
  // The reference's own `whiteBgYOffset` is set alongside colorMix/morphProgress during the hero<->white
  // tweens but ends up applied to something outside this engine's own render (its value is left nonzero
  // while idle back in "hero", which rules out it being a camera/particle-field offset here — that would
  // visibly leave the particles off-center). Kept as a no-op for API parity with the caller.
  function setWhiteBgYOffset(offset: number) {
    void offset;
  }
  function updateMorphTarget() {
    repositionMorphTarget();
    resumeLoop();
  }

  function onPointerMove(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    mouseX = clientX - rect.left;
    mouseY = clientY - rect.top;
    hasPointer = true;
  }
  function onPointerLeave() {
    mouseX = -9999;
    mouseY = -9999;
    // Reset the impulse origin too. `frame` only advances it when an impulse
    // actually fires, so it no longer picks the sentinel up on its own — and
    // without it the next re-entry would read as one enormous cursor delta
    // and fling the field apart.
    prevMouseX = -9999;
    prevMouseY = -9999;
    hasPointer = false;
  }
  const onMouseMove = (e: MouseEvent) => onPointerMove(e.clientX, e.clientY);
  // Leaving the whole browser viewport (not just the canvas) has no
  // `relatedTarget` — that's the only case we need, since the canvas never
  // owns hit-testing itself (see the `window`-level listeners below).
  const onWindowMouseOut = (e: MouseEvent) => {
    if (!e.relatedTarget) onPointerLeave();
  };
  // Tracks whether the current touch sequence started on the nav chrome —
  // header, the mobile menu button (Nav.tsx moved it to a sibling of
  // header, tagged `data-nav-chrome`, so it can render above the open
  // menu — `.closest("header")` alone stopped matching it), and the menu
  // panel itself. Taps there must keep their native tap-to-click behavior,
  // so the hero drag gesture must not steal them.
  let touchStartedOnHeader = false;
  const onTouchStart = (e: TouchEvent) => {
    touchStartedOnHeader = e.target instanceof Element && !!e.target.closest("header, [data-nav-chrome]");
    // Only steal the gesture from page scroll while still fully in the
    // hero — once the user has started scrolling into the transition,
    // touch-scrolling the rest of the page must keep working.
    if (morphProgress === 0 && !touchStartedOnHeader) e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = performance.now();
    const rect = canvas.getBoundingClientRect();
    mouseX = t.clientX - rect.left;
    mouseY = t.clientY - rect.top;
    hasPointer = true;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (morphProgress === 0 && !touchStartedOnHeader) e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    onPointerMove(t.clientX, t.clientY);
  };
  const onTouchEnd = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    if (t) {
      const dy = t.clientY - touchStartY;
      const dt = performance.now() - touchStartTime;
      if (dy < -30 && dt < 300 && Math.abs(dy / dt) > 0.5) opts.onSwipeUp?.();
    }
    void touchStartX;
    onPointerLeave();
  };

  // Bound to `window`, not `canvas`, and the canvas keeps `pointer-events:
  // none` permanently — it must never become the hit-test target for a
  // fixed, full-viewport element, or it risks swallowing wheel/trackpad
  // scroll input meant for the page underneath. Window-level listeners
  // still see every move/touch (they just don't need to be "the target"),
  // so the drag-to-mix interaction keeps working exactly the same.
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseout", onWindowMouseOut);
  window.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);

  let resizeTimer: number | undefined;
  let lastW = 0;
  let lastH = 0;
  function onResize() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (Math.abs(w - lastW) < 10 && Math.abs(h - lastH) < 150) return;
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      lastW = w;
      lastH = h;
      resizeCamera();
      void seedText();
    }, 200);
  }
  window.addEventListener("resize", onResize);

  function onContextLost(e: Event) {
    e.preventDefault();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }
  function onContextRestored() {
    resizeCamera();
    void seedText();
    resumeLoop();
  }
  canvas.addEventListener("webglcontextlost", onContextLost, false);
  canvas.addEventListener("webglcontextrestored", onContextRestored, false);

  function destroy() {
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (resizeTimer) window.clearTimeout(resizeTimer);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseout", onWindowMouseOut);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  resizeCamera();
  void seedText();
  rafId = requestAnimationFrame(frame);

  return { setMorphProgress, setColorMixTarget, setWhiteBgYOffset, updateMorphTarget, setTilt, resumeLoop, destroy };
}

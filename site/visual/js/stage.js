// stage.js — the full-viewport fixed WebGL particle field behind every visual page. Decorative only:
// never intercepts pointer events, never gates content, always optional.
//
// Requires the page's importmap (see js/shell.js's head-comment) to map:
//   "three"         → cdnjs three.module.min.js (0.186.0)
//   "three/addons/" → jsDelivr /npm/three@0.186.0/examples/jsm/  (pinned; addon modules only,
//                       verified 2026-09-25 to import only 'three' or relative addon paths)
//
// PUBLIC API
//   initStage({ canvasId, particleCount, initialFormation } = {}) → Promise<Stage|null>
//     Returns null immediately (no import, no canvas) when WebGL is unavailable (`hasWebGL()` from
//     motion.js — this also covers `?nowebgl=1`), when motion isn't allowed (Calm / reduced-motion —
//     defense in depth; callers should also gate creation via motion.js's motionScope), or when the
//     Three.js/addon CDN load fails. Any of those leaves the page on the CSS aurora-gradient fallback
//     in visual.css. Creates (or reuses) `#stage-canvas`, prepended to <body>.
//     `particleCount` defaults to ~16000 (desktop) / ~4000 (`max-width: 767px`). `initialFormation`
//     defaults to the last formation saved to sessionStorage (`sg-visual-formation`, try/catch) so
//     navigating between visual pages continues the same shape, else 'nebula'.
//   Stage.setFormation(name, points?, { duration = 1.6 } = {})
//     `name` is a label (one of FORMATIONS, or any string — only used for the sessionStorage handoff).
//     Pass `points` (a flat Float32Array/array of x,y,z in normalized [-1,1] space) to morph to a
//     caller-supplied shape (e.g. the hub's risk/liquidity bubble galaxy); omit it to morph to one of
//     the five built-in formations by name. `points` is resampled to the live particle count via
//     `resamplePositions` (cyclic repeat if shorter, cyclic reindex if longer — see that function).
//     Morphs with an eased CPU-side lerp between the previous and next position sets (an `aFrom`/`aTo`
//     pair, implemented as a plain JS tween into the `position` BufferAttribute rather than a GPU
//     uniform mix — simpler, and 12k particles is trivial for a per-frame typed-array lerp). No-op
//     after dispose().
//   Stage.pulse(hue)  hue: 'products' | 'methods' | 'brokers' | 0 | 1 | 2. Briefly (700ms) brightens
//     and enlarges only the particles carrying that hue. No-op after dispose().
//   Stage.dispose()   Stops the render loop, removes all listeners, frees GPU resources, removes the
//     canvas. Every method becomes a no-op after this. Also called automatically is NOT implied —
//     callers (shell.js, via motionScope) own the dispose() call when motion stops being allowed.
//   Stage.formation   getter, current formation name.
//   FORMATIONS = ['nebula','grid','rings','rain','helix']
//   generateFormation(name, count) → Float32Array   Pure; the position generator behind each built-in.
//   resamplePositions(points, count) → Float32Array Pure; documented resample policy (see below).
//   loadThreeModules() → Promise<{THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass}>
//     Exposed so other visual pages needing their own small canvas (e.g. a hub "bubble galaxy") can
//     reuse the same dynamic import without re-declaring the addon list.
//
// Implementation notes (decided here, not prescribed by the brief):
//   - The renderer clears OPAQUE to the theme's `--bg` (read from CSS) rather than a transparent
//     canvas over the aurora CSS gradient. UnrealBloomPass has a known history of breaking canvas
//     alpha compositing, and an opaque clear sidesteps that entirely in every theme. Practically this
//     means: while the stage is running it replaces the CSS aurora visually (same colors, more life);
//     when it isn't running (no WebGL, Calm, load failure) the CSS aurora in visual.css is what's seen.
//   - Bloom (EffectComposer + UnrealBloomPass + OutputPass) is built only in dark theme on non-phone
//     viewports; light theme and phones render directly via `renderer.render()` — cheaper, and bloom's
//     glow reads as "smudge" rather than "neon" against the light risograph background.
//   - Curl-noise drift is a compact GLSL value-noise (hash-based) with a finite-difference curl, not a
//     full simplex implementation — enough for organic wander at particle-field scale, far less GLSL.
//   - Formation continuity is saved on `pagehide` (survives bfcache) rather than `beforeunload`.

import { hasWebGL, motionAllowed, renderLoop, DEBUG } from './motion.js';

export const FORMATIONS = ['nebula', 'grid', 'rings', 'rain', 'helix'];
const FORMATION_STORAGE_KEY = 'sg-visual-formation';
const HUE_VARS = ['--world-products', '--world-methods', '--world-brokers'];
const HUE_INDEX = { products: 0, methods: 1, brokers: 2 };

// ---------------------------------------------------------------------------
// Pure formation generators — no DOM, safe to unit test.
// ---------------------------------------------------------------------------

function genNebula(count) {
  const arr = new Float32Array(count * 3);
  // Jittered grid, not free-form random placement: a purely random sphere fill (tried first, plus a
  // volumetrically-uniform cbrt radius) can still leave a screen region sparse or empty by chance —
  // found in review to read as a "dead patch" behind some sections, especially in dark mode where
  // additive brightness depends on particle density. A jittered grid instead GUARANTEES every cell of
  // the cube is seeded, so there is always something everywhere, while the per-cell random offset (90%
  // of a cell width) keeps it reading as organic scatter rather than a visible lattice — the curl-noise
  // drift in the vertex shader further hides any residual grid regularity once it's moving.
  const n = Math.max(2, Math.ceil(Math.cbrt(count)));
  const half = 1.05; // cube half-extent, tuned with camera.position.z below to fill the frame edge-to-edge
  const cell = (half * 2) / n;
  let idx = 0;
  outer:
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        if (idx >= count) break outer;
        const cx = -half + cell * (x + 0.5) + (Math.random() - 0.5) * cell * 0.9;
        const cy = -half + cell * (y + 0.5) + (Math.random() - 0.5) * cell * 0.9;
        const cz = -half + cell * (z + 0.5) + (Math.random() - 0.5) * cell * 0.9;
        arr[idx * 3] = cx;
        arr[idx * 3 + 1] = cy;
        arr[idx * 3 + 2] = cz * 0.6; // flattened depth, matching the other formations
        idx++;
      }
    }
  }
  // A perfect cube count (n^3) rarely equals `count` exactly — any remaining slots (count - n^3, only
  // possible when n^3 < count, i.e. never once n = ceil(cbrt(count)) except the pathological
  // count < 8 case) are left at the origin, which is fine: they're too few to be visually noticeable
  // and this keeps the function simple rather than special-casing a near-impossible remainder.
  return arr;
}

function genGrid(count) {
  const n = Math.max(2, Math.ceil(Math.cbrt(count)));
  const arr = new Float32Array(count * 3);
  let idx = 0;
  outer:
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        if (idx >= count) break outer;
        arr[idx * 3] = (x / (n - 1)) * 2 - 1;
        arr[idx * 3 + 1] = (y / (n - 1)) * 2 - 1;
        arr[idx * 3 + 2] = (z / (n - 1)) * 2 - 1;
        idx++;
      }
    }
  }
  return arr;
}

function genRings(count) {
  const arr = new Float32Array(count * 3);
  const rings = 5;
  const perRing = Math.ceil(count / rings);
  let idx = 0;
  for (let r = 0; r < rings && idx < count; r++) {
    const radius = 0.22 + r * 0.16;
    for (let i = 0; i < perRing && idx < count; i++) {
      const t = (i / perRing) * Math.PI * 2;
      arr[idx * 3] = Math.cos(t) * radius;
      arr[idx * 3 + 1] = Math.sin(t) * radius * 0.5;
      arr[idx * 3 + 2] = (r / (rings - 1) - 0.5) * 0.7;
      idx++;
    }
  }
  return arr;
}

function genRain(count) {
  const arr = new Float32Array(count * 3);
  const cols = 44;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    arr[i * 3] = (col / (cols - 1)) * 2 - 1 + (Math.random() - 0.5) * 0.015;
    arr[i * 3 + 1] = Math.random() * 2 - 1;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
  }
  return arr;
}

function genHelix(count) {
  const arr = new Float32Array(count * 3);
  const turns = 4;
  for (let i = 0; i < count; i++) {
    const strand = i % 2;
    const t = (i / count) * Math.PI * 2 * turns;
    const y = (i / count) * 2 - 1;
    const angle = t + strand * Math.PI;
    arr[i * 3] = Math.cos(angle) * 0.45;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = Math.sin(angle) * 0.45;
  }
  return arr;
}

const GENERATORS = { nebula: genNebula, grid: genGrid, rings: genRings, rain: genRain, helix: genHelix };

export function generateFormation(name, count) {
  const gen = GENERATORS[name] || genNebula;
  return gen(Math.max(1, count | 0));
}

/**
 * Resamples an arbitrary point set onto exactly `count` particles.
 * Policy: index modulo the source length. If `points` has fewer than `count` points, this repeats
 * them cyclically (e.g. 40 bubble-chart points → 12000 particles: each point gets ~300 particles at
 * the same position, which the curl-noise drift then fans out organically). If `points` has more than
 * `count`, this simply takes points at `i % srcCount` for i in [0,count) — a cyclic reindex, not an
 * evenly-spaced subsample, so the visual head of a long point list is favoured; callers with a much
 * larger point set than the particle budget should pre-subsample before calling setFormation.
 */
export function resamplePositions(points, count) {
  const src = points instanceof Float32Array ? points : Float32Array.from(points || []);
  const srcCount = Math.floor(src.length / 3);
  const out = new Float32Array(Math.max(1, count | 0) * 3);
  if (srcCount === 0) return out;
  for (let i = 0; i < count; i++) {
    const si = i % srcCount;
    out[i * 3] = src[si * 3];
    out[i * 3 + 1] = src[si * 3 + 1];
    out[i * 3 + 2] = src[si * 3 + 2];
  }
  return out;
}

function saveFormation(name) {
  try { sessionStorage.setItem(FORMATION_STORAGE_KEY, JSON.stringify({ formation: name })); } catch { /* ignore */ }
}
function readSavedFormation() {
  try {
    const raw = sessionStorage.getItem(FORMATION_STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return FORMATIONS.includes(obj?.formation) ? obj.formation : null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Three.js loading
// ---------------------------------------------------------------------------

export async function loadThreeModules() {
  const THREE = await import('three');
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
  ]);
  return { THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass };
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const VERT = /* glsl */ `
attribute float aHue;
attribute float aSize;
uniform float uTime;
uniform vec2 uPointer;
uniform float uScrollVel;
uniform float uPulseHue;
uniform float uPulseAmt;
uniform float uDpr;
uniform float uAlphaBoost;
uniform float uCrispness;
uniform vec3 uHue0;
uniform vec3 uHue1;
uniform vec3 uHue2;
varying vec3 vColor;
varying float vAlpha;
varying float vInnerEdge;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0.0,0.0,0.0)), hash(i + vec3(1.0,0.0,0.0)), f.x),
        mix(hash(i + vec3(0.0,1.0,0.0)), hash(i + vec3(1.0,1.0,0.0)), f.x), f.y),
    mix(mix(hash(i + vec3(0.0,0.0,1.0)), hash(i + vec3(1.0,0.0,1.0)), f.x),
        mix(hash(i + vec3(0.0,1.0,1.0)), hash(i + vec3(1.0,1.0,1.0)), f.x), f.y),
    f.z);
}
vec3 curl(vec3 p) {
  float e = 0.08;
  float a = (vnoise(p + vec3(0.0, e, 0.0)) - vnoise(p - vec3(0.0, e, 0.0))) / (2.0 * e);
  float b = (vnoise(p + vec3(e, 0.0, 0.0)) - vnoise(p - vec3(e, 0.0, 0.0))) / (2.0 * e);
  float c = (vnoise(p + vec3(0.0, 0.0, e)) - vnoise(p - vec3(0.0, 0.0, e))) / (2.0 * e);
  return vec3(a - c, c - b, b - a);
}

void main() {
  vec3 base = position;
  vec3 drift = curl(base * 1.6 + uTime * 0.06) * (0.09 + abs(uScrollVel) * 0.4);
  vec3 p = base + drift;
  p.xy += uPointer * 0.06 * smoothstep(1.2, 0.0, length(base));

  vec3 hueColor = uHue0;
  if (aHue > 1.5) hueColor = uHue2; else if (aHue > 0.5) hueColor = uHue1;
  float pulseMatch = step(abs(aHue - uPulseHue), 0.5) * uPulseAmt;
  vColor = hueColor * (1.0 + pulseMatch * 0.8);
  // Base kept low-ish: with additive blending (dark mode) and 4000-16000 overlapping particles,
  // too high clips large screen regions to solid white (the original bug, found in Phase 2
  // verification). uAlphaBoost (set from JS, tuned per theme independently — see alphaBoostFor())
  // multiplies this up: light mode needs much more (normal blending over a light background, so a
  // low base alpha just read as a pale smudge) but dark mode also needed a bit more than 1.0x once
  // the formation/camera were rebalanced (a plain 1.0x under-lit it — also found in review).
  vAlpha = min(1.0, (0.16 + pulseMatch * 0.55) * uAlphaBoost);
  // Crispness is a SEPARATE 0-1 uniform from the alpha magnitude above (uCrispness, not derived from
  // uAlphaBoost) — dark mode wants a soft glowing edge at any alpha, light mode wants a hard
  // risograph-dot edge; the two needed to be tunable independently rather than coupled through one
  // number. Passed as a varying rather than a second fragment-side uniform: three.js requires
  // matching precision for a uniform of the same name across stages, and the fragment shader's
  // mediump default vs. the vertex shader's implicit highp default caused a "Precisions of uniform
  // ... differ" link error the first time this was a fragment-side uniform (found in review).
  vInnerEdge = mix(0.05, 0.16, uCrispness);

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  float size = aSize * (1.0 + pulseMatch * 0.6);
  gl_PointSize = size * uDpr * (140.0 / max(0.001, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAG = /* glsl */ `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
varying float vInnerEdge;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  // A crisper inner edge (0.16 vs. 0.05, from vInnerEdge — see the vertex shader) reads as a solid
  // risograph dot rather than a soft blur once alpha is boosted (light mode).
  float alpha = smoothstep(0.5, vInnerEdge, d) * vAlpha;
  if (alpha <= 0.01) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

// ---------------------------------------------------------------------------
// initStage
// ---------------------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export async function initStage({ canvasId = 'stage-canvas', particleCount, initialFormation } = {}) {
  if (!hasWebGL() || !motionAllowed() || DEBUG.noWebgl) return null;

  let mod;
  try {
    mod = await loadThreeModules();
  } catch (e) {
    console.warn('[visual] Three.js failed to load; falling back to the CSS gradient background', e);
    return null;
  }
  const { THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass } = mod;

  const isPhone = typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches;
  // Bumped from the ~12k/3k starting point (still a "cap", not a hard requirement) to compensate for
  // genNebula's wider spread — the same particle count over more volume reads as sparser, so density
  // is restored here rather than by shrinking the spread back down (found in review).
  const count = Math.max(200, particleCount || (isPhone ? 4000 : 16000));

  let canvas = document.getElementById(canvasId);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
  }

  let disposed = false;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  } catch (e) {
    console.warn('[visual] WebGLRenderer failed to init; falling back to the CSS gradient background', e);
    return null;
  }
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 10);
  // Pulled in from 2.6: makes the (density-preserving) particle cloud fill the frame edge-to-edge by
  // framing rather than by spreading particles thinner across more volume — see genNebula's comment.
  // gl_PointSize's distance divisor in the vertex shader is scaled down to match (140 vs. 260), so
  // points come out roughly the same screen size as before rather than nearly doubling.
  camera.position.z = 1.4;

  const cssVar = name => (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim();
  const isDark = () => {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light') return false;
    if (attr === 'dark') return true;
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const bgColor = () => new THREE.Color(cssVar('--bg') || '#12151c');
  const hueColor = i => new THREE.Color(cssVar(HUE_VARS[i]) || '#888888');

  renderer.setClearColor(bgColor(), 1);

  let currentFormationName = FORMATIONS.includes(initialFormation) ? initialFormation : (readSavedFormation() || 'nebula');
  const initialPositions = generateFormation(currentFormationName, count);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(initialPositions.slice(), 3));
  const aHue = new Float32Array(count);
  const aSize = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    aHue[i] = i % 3;
    // Bumped from 0.6-1.5: with the jittered-grid placement above (guaranteed coverage, no gaps by
    // construction), larger points were the remaining lever for a genuinely full-looking field rather
    // than visible flecks — found in review that placement alone, even gap-free, still read as sparse
    // at the original size once each point covers only a few screen pixels.
    aSize[i] = 1.1 + Math.random() * 1.6;
  }
  geometry.setAttribute('aHue', new THREE.BufferAttribute(aHue, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));

  // Dark mode uses additive blending, where a low base alpha still glows once enough particles
  // overlap; light mode uses normal blending over a light background, where the same low alpha just
  // reads as a pale smudge. Both are boosted up from 1.0x (found in review: a plain 1.0x for dark
  // mode under-lit it once the formation/camera were rebalanced to fix the "empty margin" bug — see
  // genNebula's and camera.position.z's comments). uCrispness is independent of the alpha magnitude:
  // it only controls the fragment shader's edge shape (see vInnerEdge) — dark mode keeps a soft
  // glowing edge, light mode gets a hard risograph-dot edge.
  const alphaBoostFor = () => (isDark() ? 2.6 : 2.6);
  const crispnessFor = () => (isDark() ? 0.0 : 1.0);

  const uniforms = {
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector2(0, 0) },
    uScrollVel: { value: 0 },
    uPulseHue: { value: -1 },
    uPulseAmt: { value: 0 },
    uDpr: { value: dpr },
    uAlphaBoost: { value: alphaBoostFor() },
    uCrispness: { value: crispnessFor() },
    uHue0: { value: hueColor(0) },
    uHue1: { value: hueColor(1) },
    uHue2: { value: hueColor(2) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: isDark() ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  const pointsMesh = new THREE.Points(geometry, material);
  pointsMesh.frustumCulled = false;
  scene.add(pointsMesh);

  let composer = null;
  function buildComposer() {
    if (composer) { composer.dispose?.(); composer = null; }
    if (isDark() && !isPhone) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      // Strength/threshold kept modest: dense, tightly-clustered additive particles compound bloom
      // into a large washed-out area behind text (found in Phase 2 verification). Nudged back up
      // slightly from 0.35 after widening genNebula's spread and raising the particle count, which
      // lowered the typical on-screen density enough that the original value under-lit dark mode.
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.6, 0.85));
      composer.addPass(new OutputPass());
    }
  }
  buildComposer();

  // ---- pointer / scroll reactivity ----
  const pointer = { x: 0, y: 0 };
  function onPointerMove(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  let lastScrollY = window.scrollY;
  let scrollVel = 0;
  function onScroll() {
    const y = window.scrollY;
    scrollVel += (y - lastScrollY) * 0.02;
    lastScrollY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- resize ----
  function onResize() {
    const w = window.innerWidth, h = Math.max(1, window.innerHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer?.setSize(w, h);
  }
  window.addEventListener('resize', onResize, { passive: true });

  // ---- theme changes (stable's toggle dispatches this on window) ----
  function onThemeChange() {
    renderer.setClearColor(bgColor(), 1);
    uniforms.uHue0.value = hueColor(0);
    uniforms.uHue1.value = hueColor(1);
    uniforms.uHue2.value = hueColor(2);
    uniforms.uAlphaBoost.value = alphaBoostFor();
    uniforms.uCrispness.value = crispnessFor();
    material.blending = isDark() ? THREE.AdditiveBlending : THREE.NormalBlending;
    buildComposer();
  }
  window.addEventListener('sg:themechange', onThemeChange);

  // ---- formation transition state ----
  let transition = null; // { start, duration }
  let fromArr = initialPositions.slice();
  let toArr = initialPositions.slice();

  function setFormation(name, points, opts = {}) {
    if (disposed) return;
    const duration = opts.duration ?? 1.6;
    const target = points ? resamplePositions(points, count) : generateFormation(name, count);
    fromArr = geometry.attributes.position.array.slice();
    toArr = target;
    transition = { start: performance.now(), duration: Math.max(1, duration * 1000) };
    currentFormationName = name;
    saveFormation(name);
  }

  function tickTransition() {
    if (!transition) return;
    const t = Math.min(1, (performance.now() - transition.start) / transition.duration);
    const eased = easeInOutCubic(t);
    const buf = geometry.attributes.position.array;
    for (let i = 0; i < buf.length; i++) buf[i] = fromArr[i] + (toArr[i] - fromArr[i]) * eased;
    geometry.attributes.position.needsUpdate = true;
    if (t >= 1) transition = null;
  }

  // ---- pulse state ----
  let pulseState = null; // { start, duration }
  function pulse(hue) {
    if (disposed) return;
    const idx = typeof hue === 'number' ? hue : (HUE_INDEX[hue] ?? -1);
    uniforms.uPulseHue.value = idx;
    pulseState = { start: performance.now(), duration: 700 };
  }
  function tickPulse() {
    if (!pulseState) { uniforms.uPulseAmt.value = 0; return; }
    const t = (performance.now() - pulseState.start) / pulseState.duration;
    if (t >= 1) { pulseState = null; uniforms.uPulseAmt.value = 0; return; }
    uniforms.uPulseAmt.value = Math.sin(Math.PI * t);
  }

  // ---- pagehide: remember formation across navigation (bfcache-safe) ----
  function onPageHide() { saveFormation(currentFormationName); }
  window.addEventListener('pagehide', onPageHide);

  // ---- render loop (pauses when hidden or off-screen) ----
  const loop = renderLoop((dt, now) => {
    uniforms.uTime.value = now / 1000;
    uniforms.uPointer.value.set(pointer.x, pointer.y);
    scrollVel *= 0.9;
    uniforms.uScrollVel.value = scrollVel;
    tickTransition();
    tickPulse();
    if (composer) composer.render(); else renderer.render(scene, camera);
  }, { canvas });

  function dispose() {
    if (disposed) return;
    disposed = true;
    loop.stop();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('sg:themechange', onThemeChange);
    window.removeEventListener('pagehide', onPageHide);
    geometry.dispose();
    material.dispose();
    composer?.dispose?.();
    renderer.dispose();
    canvas.remove();
  }

  return {
    canvas,
    setFormation,
    pulse,
    dispose,
    get formation() { return currentFormationName; },
  };
}

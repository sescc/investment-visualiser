// motion.js — the single source of truth for "is animation allowed right now", and the only place
// GSAP + its plugins are loaded from cdnjs (once, lazily, memoized).
//
// PUBLIC API
//   DEBUG                          → { noWebgl: bool, calm: bool } parsed once from `location.search`
//                                     (`?nowebgl=1` forces the WebGL/CSS-gradient fallback everywhere;
//                                     `?calm=1` forces Calm mode — the Browser pane can't emulate
//                                     prefers-reduced-motion, so this is how that path gets tested).
//   getCalm() → bool               localStorage `sg-visual-calm` (try/catch), or true if `?calm=1`.
//   setCalm(bool)                  Persists Calm mode, toggles `<html class="is-calm">`, dispatches
//                                   `sg:calmchange` on window.
//   motionAllowed() → bool         false when `prefers-reduced-motion: reduce` OR Calm mode is on.
//   hasWebGL() → bool              false when `?nowebgl=1` or the browser truly can't get a context.
//   onMotionChange(cb) → unsub     cb(allowed: bool) whenever motionAllowed() may have changed
//                                   (reduced-motion media query flips, or Calm toggles).
//   motionScope(setup) → {destroy} Runs setup() now iff motionAllowed(); setup() returns a cleanup
//                                   function. Cleanup runs the instant motion becomes disallowed
//                                   (Calm turned on, or the OS setting flips), and setup() runs again
//                                   if motion becomes allowed again. Every animated feature (stage,
//                                   cursor, tilt, magnetic buttons, scroll choreography) should mount
//                                   through this so a single toggle tears down every canvas/listener.
//                                   If you build a `gsap.matchMedia()` instance inside setup(), store
//                                   it and call `.revert()` in your cleanup — matchMedia only tracks
//                                   the OS media query, not Calm mode, so motionScope is what notices
//                                   the localStorage flag.
//   whenGsap() → Promise<gsap|null>  Loads gsap.min.js + all ten plugins from cdnjs 3.15.0 in parallel
//   loadGsap()                       after the core, registers whichever loaded, and resolves the
//                                     `window.gsap` namespace. Resolves null after an 8s timeout or a
//                                     core-load failure (a plugin failing individually doesn't fail the
//                                     whole load). Memoized: safe to call from every module.
//   reveal(el, gsapVars) → void    Fire-and-forget entrance animation. No-op (element keeps its normal,
//                                   fully-visible styling — nothing in visual.css ever sets opacity:0 on
//                                   content) when motion isn't allowed or GSAP failed to load.
//   splitHeadline(el, opts) → Promise<SplitText|null>
//                                   Waits for `document.fonts.ready`, splits into words+chars, plays a
//                                   stagger-in, then calls `.revert()` on complete so the final DOM is
//                                   the original text node exactly. No-op (text left as authored) when
//                                   motion isn't allowed or SplitText failed to load.
//   countUp(el, toValue, format) → Promise<void>
//                                   Tweens a number and writes `format(value)` into `el.textContent`,
//                                   guaranteed to end at exactly `format(toValue)`. Writes the final
//                                   value immediately (no animation) when motion isn't allowed.
//
// Nothing in this file touches fee numbers — `format` is always supplied by the caller (formatSGD, a
// percent formatter, etc.), never invented here.

const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const DEBUG = Object.freeze({
  noWebgl: params.get('nowebgl') === '1',
  calm: params.get('calm') === '1',
});

const CALM_KEY = 'sg-visual-calm';

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch { /* ignore */ }
}

export function getCalm() {
  if (DEBUG.calm) return true;
  return lsGet(CALM_KEY) === '1';
}

export function setCalm(on) {
  lsSet(CALM_KEY, on ? '1' : '0');
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('is-calm', !!on);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sg:calmchange', { detail: { calm: !!on } }));
  }
}

/** Applies the persisted/forced Calm class immediately (call once, early, ideally before first paint). */
export function applyInitialCalmClass() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('is-calm', getCalm());
}
applyInitialCalmClass();

const reduceMQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function motionAllowed() {
  const reduced = !!reduceMQ?.matches;
  return !reduced && !getCalm();
}

export function hasWebGL() {
  if (DEBUG.noWebgl) return false;
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

export function onMotionChange(cb) {
  const wrapped = () => cb(motionAllowed());
  if (reduceMQ) {
    reduceMQ.addEventListener ? reduceMQ.addEventListener('change', wrapped) : reduceMQ.addListener?.(wrapped);
  }
  window.addEventListener('sg:calmchange', wrapped);
  return () => {
    if (reduceMQ) {
      reduceMQ.removeEventListener ? reduceMQ.removeEventListener('change', wrapped) : reduceMQ.removeListener?.(wrapped);
    }
    window.removeEventListener('sg:calmchange', wrapped);
  };
}

export function motionScope(setup) {
  let cleanup = null;
  function apply() {
    if (motionAllowed()) {
      if (!cleanup) {
        try { cleanup = setup() || null; } catch (e) { console.warn('[visual] motionScope setup failed', e); cleanup = null; }
      }
    } else if (cleanup) {
      try { cleanup(); } catch (e) { console.warn('[visual] motionScope cleanup failed', e); }
      cleanup = null;
    }
  }
  apply();
  const unsub = onMotionChange(apply);
  return {
    destroy() {
      if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
      unsub();
    },
  };
}

// ---------------------------------------------------------------------------
// GSAP loading
// ---------------------------------------------------------------------------

const GSAP_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/';
const GSAP_CORE = 'gsap.min.js';
const GSAP_PLUGINS = [
  'ScrollTrigger', 'SplitText', 'Flip', 'DrawSVGPlugin', 'MorphSVGPlugin',
  'Draggable', 'InertiaPlugin', 'ScrambleTextPlugin', 'MotionPathPlugin', 'CustomEase',
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error(`script load failed: ${src}`));
    document.head.appendChild(s);
  });
}

function timeoutAfter(ms) {
  return new Promise(resolve => setTimeout(() => resolve('timeout'), ms));
}

let _gsapPromise = null;

export function whenGsap() {
  if (_gsapPromise) return _gsapPromise;
  _gsapPromise = (async () => {
    try {
      const result = await Promise.race([
        (async () => {
          await loadScript(GSAP_BASE + GSAP_CORE);
          if (!window.gsap) throw new Error('window.gsap missing after core load');
          await Promise.allSettled(GSAP_PLUGINS.map(p => loadScript(`${GSAP_BASE}${p}.min.js`)));
          const gsap = window.gsap;
          const toRegister = GSAP_PLUGINS.map(p => window[p]).filter(Boolean);
          if (toRegister.length) gsap.registerPlugin(...toRegister);
          return gsap;
        })(),
        timeoutAfter(8000),
      ]);
      return result === 'timeout' ? null : result;
    } catch (e) {
      console.warn('[visual] GSAP failed to load; motion falls back to static content', e);
      return null;
    }
  })();
  return _gsapPromise;
}

export const loadGsap = whenGsap;

// ---------------------------------------------------------------------------
// Small motion helpers — every one is a safe no-op under !motionAllowed() or a failed GSAP load.
// ---------------------------------------------------------------------------

// Both entrance helpers below arm a hard setTimeout safety net that forces the tween to its end
// state no later than ~1.2s after starting, regardless of GSAP/rAF timing. Found necessary in
// review: requestAnimationFrame (which GSAP's ticker runs on) can stop firing for a backgrounded/
// not-yet-visible tab, and a `gsap.from()` tween that never gets a tick stays parked at its opacity:0
// starting frame indefinitely — the headline (and anything using `reveal`) could stay invisible or
// low-contrast well past any reasonable "content should be legible immediately" bar. The safety net
// makes that bar a guarantee instead of an assumption.
const ENTRANCE_SAFETY_MS = 1200;

export async function reveal(el, vars = {}) {
  if (!el || !motionAllowed()) return;
  const gsap = await whenGsap();
  if (!gsap || !motionAllowed()) return;
  const { from = {}, ...rest } = vars;
  const tween = gsap.from(el, { y: 24, opacity: 0, duration: 0.6, ease: 'power3.out', ...from, ...rest });
  setTimeout(() => tween.progress(1), ENTRANCE_SAFETY_MS);
}

export async function splitHeadline(el, { type = 'words,chars', ...vars } = {}) {
  if (!el || !motionAllowed()) return null;
  const gsap = await whenGsap();
  if (!gsap || !window.SplitText) return null;
  try { await (document.fonts?.ready || Promise.resolve()); } catch { /* ignore */ }
  if (!motionAllowed()) return null; // Calm may have been toggled while fonts were loading.
  const split = new window.SplitText(el, { type, aria: 'auto' });
  const targets = split.chars?.length ? split.chars : split.words;
  let finished = false;
  const finish = () => { if (finished) return; finished = true; split.revert(); };
  const tween = gsap.from(targets, {
    opacity: 0, y: '0.6em', rotateX: -40, stagger: 0.02, duration: 0.7, ease: 'back.out(1.7)',
    onComplete: finish,
    ...vars,
  });
  setTimeout(() => { tween.progress(1); finish(); }, ENTRANCE_SAFETY_MS);
  return split;
}

export async function countUp(el, toValue, format = String) {
  if (!el) return;
  if (!motionAllowed()) { el.textContent = format(toValue); return; }
  const gsap = await whenGsap();
  if (!gsap) { el.textContent = format(toValue); return; }
  await new Promise(resolve => {
    const obj = { v: 0 };
    gsap.to(obj, {
      v: toValue, duration: 1.2, ease: 'power2.out',
      onUpdate: () => { el.textContent = format(obj.v); },
      onComplete: () => { el.textContent = format(toValue); resolve(); },
    });
  });
}

/** Pauses/resumes a render-loop callback when the tab is hidden or the canvas scrolls off-screen. */
export function renderLoop(fn, { canvas } = {}) {
  let raf = null;
  let running = false;
  let visible = true;
  let intersecting = true;
  let last = performance.now();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (visible && intersecting) fn(dt, now);
  }
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  const onVis = () => { visible = document.visibilityState !== 'hidden'; };
  document.addEventListener('visibilitychange', onVis);

  let io = null;
  if (canvas && typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.target === canvas) intersecting = e.isIntersecting; });
    }, { threshold: 0.01 });
    io.observe(canvas);
  }

  start();
  return {
    stop() {
      stop();
      document.removeEventListener('visibilitychange', onVis);
      io?.disconnect();
    },
  };
}

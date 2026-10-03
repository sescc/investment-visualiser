// motion.js — the single source of truth for "is animation allowed right now", and the only place
// GSAP + its plugins are loaded from cdnjs (once, lazily, memoized).
//
// PUBLIC API
//   DEBUG                          → { noGsap: bool, calm: bool } parsed once from `location.search`
//                                     (`?nogsap=1` forces whenGsap() to resolve null everywhere, to test
//                                     the animation-library-failure path; `?calm=1` forces Calm mode —
//                                     the Browser pane can't emulate prefers-reduced-motion, so this is
//                                     how that path gets tested).
//   getCalm() → bool               localStorage `sg-visual-calm` (try/catch), or true if `?calm=1`.
//   setCalm(bool)                  Persists Calm mode, toggles `<html class="is-calm">`, dispatches
//                                   `sg:calmchange` on window.
//   motionAllowed() → bool         false when `prefers-reduced-motion: reduce` OR Calm mode is on.
//   onMotionChange(cb) → unsub     cb(allowed: bool) whenever motionAllowed() may have changed
//                                   (reduced-motion media query flips, or Calm toggles).
//   motionScope(setup) → {destroy} Runs setup() now iff motionAllowed(); setup() returns a cleanup
//                                   function. Cleanup runs the instant motion becomes disallowed
//                                   (Calm turned on, or the OS setting flips), and setup() runs again
//                                   if motion becomes allowed again. Every animated feature (backdrop
//                                   parallax, tilt, magnetic buttons, scroll choreography) should mount
//                                   through this so a single toggle tears down every listener/timeline.
//                                   If you build a `gsap.matchMedia()` instance inside setup(), store
//                                   it and call `.revert()` in your cleanup — matchMedia only tracks
//                                   the OS media query, not Calm mode, so motionScope is what notices
//                                   the localStorage flag.
//   whenGsap() → Promise<gsap|null>  Loads gsap.min.js + only the plugins actually used anywhere under
//   loadGsap()                       site/visual/js (grep-verified — see GSAP_PLUGINS below) from cdnjs
//                                     3.15.0 in parallel after the core, registers whichever loaded, and
//                                     resolves the `window.gsap` namespace. Resolves null immediately
//                                     under `?nogsap=1`, or after an 8s timeout, or a core-load failure
//                                     (a plugin failing individually doesn't fail the whole load).
//                                     Memoized: safe to call from every module. On a successful load,
//                                     also runs `ScrollTrigger.config({ ignoreMobileResize: true,
//                                     limitCallbacks: true })` once, and refreshes ScrollTrigger after
//                                     `document.fonts.ready` (layout can shift once webfonts swap in).
//   refreshScenes() → void         `orderTriggers()` then `ScrollTrigger.refresh()` if GSAP/ScrollTrigger
//                                   loaded; no-op otherwise. Synchronous. Call after re-rendering content
//                                   that scenes measure against (new data, a filter/sort change, etc.).
//   scheduleSceneRefresh(ms=60)    Debounced (setTimeout — NOT rAF, which the Browser pane throttles)
//                                   `orderTriggers()` + `ScrollTrigger.refresh()`. scene(), scrubOnEntry(),
//                                   scrubHeading() and batchReveal() call it themselves after their async
//                                   creation (and scene() after teardown), reveal() after its tween
//                                   completes (a pinned trigger measured mid-entrance is off by the
//                                   entrance offset); also fires on fonts.ready and window `load`. Call it yourself after any ASYNC mount that creates or
//                                   removes a pin (products.js does after building the deck).
//   orderTriggers() → void         Sets `refreshPriority` on EVERY live ScrollTrigger from its trigger
//                                   element's document order and calls `ScrollTrigger.sort()` — see the
//                                   TRIGGER ORDERING note on scene() below.
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
//   scene(section, build, opts) → { refresh(), destroy(), get timeline }
//                                   The one helper that owns a pinned-or-scrubbed scroll sequence's
//                                   whole lifecycle (motionScope + whenGsap + gsap.context +
//                                   gsap.matchMedia). `opts`: `pin` (default true), `length` (viewport
//                                   heights the scene plays over, default 1), `mobile` (currently always
//                                   'scrub' — reserved for a future mode), `start` (ScrollTrigger start,
//                                   default `top top+=<header height>`).
//                                   ≥768px: pins `section` and scrubs `build`'s timeline over
//                                   `length * 100vh` of scroll (`anticipatePin`, `invalidateOnRefresh`).
//                                   <768px: the same timeline scrubs from 'top 85%' to 'bottom 60%' with
//                                   no pin (address-bar resize / short-viewport safe).
//                                   `build(tl, { gsap, isMobile, section })` fills the timeline — it
//                                   receives an *empty* `gsap.timeline()` already wired to its
//                                   ScrollTrigger.
//                                   A `focusin` inside `section` while its ScrollTrigger is active and
//                                   short of progress 1 jumps `window.scrollTo` straight to the
//                                   trigger's end (instant), so keyboard users never land inside a
//                                   half-played scene. `will-change: transform` is toggled on `section`
//                                   as the trigger becomes active/inactive (`onToggle`).
//                                   Safe no-op (authored layout stays exactly as written) under
//                                   !motionAllowed() or a failed/`?nogsap=1` GSAP load. `destroy()`
//                                   reverts everything (`gsap.context().revert()` + matchMedia revert).
//                                   TRIGGER ORDERING (added 2026-10-03): a pin inserts a spacer, so every
//                                   trigger BELOW it must be measured AFTER it. Triggers are created
//                                   asynchronously (GSAP loads lazily; products.js's deck is rebuilt on
//                                   every filter/Remix), so creation order is NOT document order — before
//                                   this, #liquid-row pinned at ~y=4000 over the Bonds & cash deck after
//                                   any deck rebuild. Now, after every scene creation/teardown (debounced),
//                                   on fonts.ready/load, and on refreshScenes(): ALL ScrollTriggers (also
//                                   those made outside scene() — deck pin, scrubHeading, scrubOnEntry,
//                                   batchReveal, ScrollTrigger.create) get a refreshPriority from the
//                                   document order of their trigger element (earlier = refreshed first;
//                                   containerAnimation children after their container; page-level
//                                   triggers with no element / `end:'max'` last), then sort + refresh.
//                                   Callers need do nothing, except: if you create/remove a pin from your
//                                   own async code, call scheduleSceneRefresh() afterwards. A new scene
//                                   built on scene() (e.g. a page-end runway) is ordered automatically.
//   batchReveal(elements, variant, { decorative } = {}) → { destroy() }
//                                   `ScrollTrigger.batch(elements, { once: true, ... })`, animating only
//                                   transform/opacity, staggered. `variant` is one of chaos.js's
//                                   entrance names ('fade-rise' | 'scramble' | 'slide-scale' |
//                                   'flip-in'). Text-bearing elements (the default, `decorative:
//                                   false`) never start below opacity 0.85 (law 6: text is never
//                                   hidden); pass `{ decorative: true }` for purely-decorative elements
//                                   (fills, chips, coins…) to allow a full opacity:0 start. Same
//                                   motionScope/no-op semantics as `scene()`.
//   scrubOnEntry(el, build, { start, end, once, scrub } = {}) → { destroy() }
//                                   The lightweight sibling of `scene()`: ONE ScrollTrigger-scrubbed
//                                   timeline tied to `el`'s own scroll entry — no pin, no matchMedia
//                                   mobile/desktop split. For "this block (or some children of it)
//                                   drifts/fades/scales in as it nears the viewport" — a deal-in card
//                                   stack, a wrapper's rotate-in, a headline explode, a fee jar's coins.
//                                   `start`/`end` default to `'top 85%'`/`'top 40%'`; `scrub` defaults to
//                                   0.4 (same feel as `scrubHeading`); `once` (default false) is passed
//                                   straight through to the ScrollTrigger (stops tracking scroll after
//                                   the first entry instead of reversing on scroll-back).
//                                   `build(tl, { gsap, isMobile })` fills the timeline — `isMobile` is a
//                                   one-time `matchMedia('(max-width: 767px)').matches` snapshot at
//                                   mount time, not reactive (there's no per-breakpoint rebuild here;
//                                   use `scene()` if you need that). `build` may itself return an extra
//                                   cleanup function (e.g. reverting a `SplitText` instance it created)
//                                   — `scrubOnEntry` calls it, if returned, alongside its own
//                                   `gsap.context().revert()`.
//                                   Same motionScope/no-op semantics as `scene()`: safe no-op (authored
//                                   layout unchanged) under !motionAllowed() or a failed/`?nogsap=1` GSAP
//                                   load; torn down and rebuilt automatically as Calm/reduced-motion
//                                   toggles.
//   scrubHeading(el) → { destroy() }
//                                   Splits `el` into words+chars (SplitText `type: 'words,chars'`: chars
//                                   nested in inline-block word boxes so lines only wrap between words,
//                                   punctuation stays attached; `aria: 'auto'` so the heading
//                                   stays announced as one string) and scrubs the chars from
//                                   { y: '40%', opacity: 0.85, rotateX: -30 } to their resting position
//                                   between 'top 90%' and 'top 55%'. Deliberately NOT a fully-clipped
//                                   "chars rise from y:100%" reveal — that would start the heading text
//                                   fully hidden, which law 6 forbids even for a moment. `destroy()`
//                                   kills the ScrollTrigger/tween and calls `.revert()` on the SplitText
//                                   instance, restoring the original text node. Same motionScope/no-op
//                                   semantics as `scene()`.
//
// Nothing in this file touches fee numbers — `format` is always supplied by the caller (formatSGD, a
// percent formatter, etc.), never invented here.

const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const DEBUG = Object.freeze({
  noGsap: params.get('nogsap') === '1',
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
// Only plugins actually referenced anywhere under site/visual/js (grep-verified 2026-09-27).
// ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin are kept regardless — Wave 2's page scenes
// use them. Flip (calc.js, compare.js) and Draggable (hub.js quiz fling) are used today. InertiaPlugin is deliberately\n// NOT loaded (3 Oct 2026): Draggable auto-tracks with it whenever it is present, and each tracker holds a permanent\n// GSAP ticker listener, so the hub's ticker ran every frame while idle (law 7).
// Dropped: MorphSVGPlugin, ScrambleTextPlugin, CustomEase — no `window.X` reference to any of them
// exists in site/visual/js (the "scramble" strings in chaos.js/CSS are just an entrance-variant name,
// not a use of ScrambleTextPlugin).
const GSAP_PLUGINS = [
  'ScrollTrigger', 'SplitText', 'DrawSVGPlugin', 'MotionPathPlugin',
  'Flip', 'Draggable',
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

function refreshAfterFontsReady() {
  if (typeof document === 'undefined') return;
  // Fonts swapping in shifts layout; so does the window `load` event (late images/iframes). Both go
  // through the same ordered, debounced settle as scene creation does.
  if (document.fonts?.ready) document.fonts.ready.then(() => scheduleSceneRefresh()).catch(() => { /* ignore */ });
  if (document.readyState !== 'complete') window.addEventListener('load', () => scheduleSceneRefresh(), { once: true });
}

// ScrollTrigger 3.x starts a `_rafBugFix` loop at init — a requestAnimationFrame callback that re-queues itself
// forever (a workaround for an iOS/Safari rAF quirk). On every other engine it is pure idle work: one rAF per
// frame on a page that is doing nothing, against law 7 ("nothing does work while idle"). While the plugins load
// we hand the first `_rafBugFix` callback a no-op rAF, so the loop never starts; the real rAF is restored right
// after. WebKit (Safari, every iOS browser) keeps the workaround. The callback is recognised by function name,
// which the minified cdnjs build preserves; if a future build renames it the shim simply does nothing.
function suppressScrollTriggerRafLoop() {
  const ua = navigator.userAgent || '';
  const webkit = (/Safari/.test(ua) && !/Chrome|Chromium|Edg|Android|OPR/.test(ua))
    || /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (webkit) return () => {};
  const real = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) {
    if (cb && cb.name === '_rafBugFix') return 0;
    return real.call(window, cb);
  };
  return () => { if (window.requestAnimationFrame !== real) window.requestAnimationFrame = real; };
}

export function whenGsap() {
  if (_gsapPromise) return _gsapPromise;
  _gsapPromise = (async () => {
    if (DEBUG.noGsap) return null;
    try {
      const result = await Promise.race([
        (async () => {
          let unshim = () => {};
          try {
            await loadScript(GSAP_BASE + GSAP_CORE);
            if (!window.gsap) throw new Error('window.gsap missing after core load');
            // After the core: gsap caches window.requestAnimationFrame at load and must keep the real one.
            unshim = suppressScrollTriggerRafLoop();
            await Promise.allSettled(GSAP_PLUGINS.map(p => loadScript(`${GSAP_BASE}${p}.min.js`)));
            const gsap = window.gsap;
            const toRegister = GSAP_PLUGINS.map(p => window[p]).filter(Boolean);
            if (toRegister.length) gsap.registerPlugin(...toRegister);
            window.ScrollTrigger?.config({ ignoreMobileResize: true, limitCallbacks: true });
            refreshAfterFontsReady();
            return gsap;
          } finally {
            unshim();
          }
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
// Trigger ordering + settle (see scene()'s header comment for the "why").
// ---------------------------------------------------------------------------

// Priority tiers (ScrollTrigger refreshes HIGHER refreshPriority first):
//   element-bound triggers: ELEMENT_BASE - rank, rank = document order of the trigger element, so a
//     trigger earlier in the page (and the pin-spacer it adds) is always measured before any later one;
//   containerAnimation children (deck card tilt): 0 — after every element-bound trigger, i.e. after
//     their container's own trigger;
//   page-level triggers (no trigger element, e.g. header progress bar / backdrop parallax with
//     `end: 'max'`): -1 — last, because they depend on the final page height.
const ELEMENT_BASE = 100000;

/**
 * Assigns every live ScrollTrigger a refreshPriority from its trigger element's document order and sorts.
 * Covers triggers created outside scene() too (the products deck pin, scrubHeading, scrubOnEntry,
 * batchReveal, ScrollTrigger.create in shell/backdrop/compare). Safe no-op without ScrollTrigger.
 */
export function orderTriggers() {
  const ST = window.ScrollTrigger;
  if (!ST) return;
  const all = ST.getAll();
  const bound = [];
  for (const st of all) {
    const el = st.trigger;
    const pageLevel = !(el instanceof Element) || st.vars.end === 'max';
    if (pageLevel) st.vars.refreshPriority = -1;
    else if (st.vars.containerAnimation) st.vars.refreshPriority = 0;
    else bound.push(st);
  }
  // Array.prototype.sort is stable: triggers on the same element keep creation order; an ancestor
  // (e.g. a pinned section) sorts before its descendants.
  bound.sort((a, b) => {
    if (a.trigger === b.trigger) return 0;
    const pos = a.trigger.compareDocumentPosition(b.trigger);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1; // b after a
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  bound.forEach((st, i) => { st.vars.refreshPriority = ELEMENT_BASE - i; });
  ST.sort();
}

let _settleTimer = null;

/**
 * Debounced (setTimeout, not rAF — the Browser pane throttles rAF) orderTriggers() + ScrollTrigger.refresh().
 * Call after creating or destroying anything that adds/removes a pin-spacer or changes page height
 * asynchronously (scene(), scrubOnEntry(), scrubHeading(), batchReveal() and products.js' deck already do);
 * also fires on fonts.ready and window `load`.
 */
export function scheduleSceneRefresh(delayMs = 60) {
  if (typeof window === 'undefined') return;
  clearTimeout(_settleTimer);
  _settleTimer = setTimeout(() => {
    _settleTimer = null;
    if (!window.ScrollTrigger) return;
    orderTriggers();
    window.ScrollTrigger.refresh();
  }, delayMs);
}

/** ordered ScrollTrigger.refresh() if loaded; no-op otherwise. Call after re-rendering measured content. */
export function refreshScenes() {
  if (!window.ScrollTrigger) return;
  orderTriggers();
  window.ScrollTrigger.refresh();
}

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
  const userDone = rest.onComplete;
  const tween = gsap.from(el, {
    y: 24, opacity: 0, duration: 0.6, ease: 'power3.out', ...from, ...rest,
    // A scene may have measured `el` (or something inside it) while it was still offset by the entrance
    // transform; re-measure once it has settled (e.g. the index hero card is a pinned scene's trigger).
    onComplete: function (...a) { userDone?.apply(this, a); scheduleSceneRefresh(); },
  });
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

// ---------------------------------------------------------------------------
// Scroll scenes — the shared lifecycle for every pinned-or-scrubbed sequence.
// ---------------------------------------------------------------------------

function headerOffsetPx() {
  if (typeof getComputedStyle !== 'function') return 0;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--header-h');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * scene(section, build, { pin = true, length = 1, mobile = 'scrub', start } = {})
 *   → { refresh(), destroy(), get timeline }
 * See the file-header PUBLIC API comment for the full contract.
 */
export function scene(section, build, opts = {}) {
  const { pin = true, length = 1, start } = opts;
  if (!section || typeof build !== 'function') return { refresh() {}, destroy() {}, get timeline() { return null; } };

  let currentTl = null;
  let currentSt = null;
  let mm = null;

  const scopeHandle = motionScope(() => {
    let ctx = null;
    let cancelled = false;
    let onFocusIn = null;

    (async () => {
      const gsap = await whenGsap();
      if (cancelled || !gsap || !window.ScrollTrigger) return;
      if (!motionAllowed()) return; // Calm/reduced-motion may have flipped while GSAP was loading.

      const onToggle = self => { section.style.willChange = self.isActive ? 'transform' : ''; };

      ctx = gsap.context(() => {
        mm = gsap.matchMedia();
        mm.add('(min-width: 768px)', () => {
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              // A function, not a computed string: ScrollTrigger re-calls this on refresh() (e.g. after
              // the header's height changes), so the pin start point never goes stale.
              start: start ?? (() => `top top+=${headerOffsetPx()}`),
              end: '+=' + (length * 100) + '%',
              scrub: 0.5,
              pin,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onToggle,
            },
          });
          currentTl = tl;
          currentSt = tl.scrollTrigger;
          build(tl, { gsap, isMobile: false, section });
          return () => { currentTl = null; currentSt = null; };
        });
        mm.add('(max-width: 767px)', () => {
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              start: 'top 85%',
              end: 'bottom 60%',
              scrub: 0.5,
              invalidateOnRefresh: true,
              onToggle,
            },
          });
          currentTl = tl;
          currentSt = tl.scrollTrigger;
          build(tl, { gsap, isMobile: true, section });
          return () => { currentTl = null; currentSt = null; };
        });
      }, section);

      onFocusIn = e => {
        // Gate on progress only, not `isActive`: tabbing forward into a not-yet-active section fires
        // `focusin` before ScrollTrigger marks it active, and an `isActive` check here would let the
        // browser's native scrollIntoView-on-focus land the viewport mid-pin instead (found in review).
        if (!currentSt || currentSt.progress >= 1) return;
        if (!section.contains(e.target)) return;
        // Deferred one frame so this runs AFTER the browser's own focus-scroll, not before it — the
        // native jump would otherwise immediately re-scroll to a mid-pin position on its own schedule.
        requestAnimationFrame(() => { if (currentSt && currentSt.progress < 1) window.scrollTo(0, currentSt.end); });
      };
      section.addEventListener('focusin', onFocusIn);
      scheduleSceneRefresh();
    })();

    return () => {
      cancelled = true;
      if (onFocusIn) section.removeEventListener('focusin', onFocusIn);
      mm?.revert();
      ctx?.revert();
      section.style.willChange = '';
      currentTl = null;
      currentSt = null;
      scheduleSceneRefresh(); // reverting removed a pin-spacer: re-measure everything below it
    };
  });

  return {
    refresh: refreshScenes,
    destroy: () => scopeHandle.destroy(),
    get timeline() { return currentTl; },
  };
}

// ---------------------------------------------------------------------------
// scrubOnEntry — the lightweight, unpinned sibling of scene(): one scrubbed timeline tied to an
// element's own scroll entry. Added 2026-09-27, replacing near-identical local copies (compare.js's
// motionScrollFx + its two users; hub.js's and products.js's identical heroExplode; hub.js's
// mountQuizDealIn).
// ---------------------------------------------------------------------------

/**
 * scrubOnEntry(el, build, { start = 'top 85%', end = 'top 40%', once = false, scrub = 0.4 } = {})
 *   → { destroy() }
 * See the file-header PUBLIC API comment for the full contract.
 */
export function scrubOnEntry(el, build, opts = {}) {
  const { start = 'top 85%', end = 'top 40%', once = false, scrub = 0.4 } = opts;
  if (!el || typeof build !== 'function') return { destroy() {} };

  return motionScope(() => {
    let ctx = null;
    let extraCleanup = null;
    let cancelled = false;
    (async () => {
      const gsap = await whenGsap();
      if (cancelled || !gsap || !window.ScrollTrigger) return;
      if (!motionAllowed()) return; // Calm/reduced-motion may have flipped while GSAP was loading.
      const isMobile = typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches;
      ctx = gsap.context(() => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start, end, scrub, once } });
        extraCleanup = build(tl, { gsap, isMobile }) || null;
      }, el);
      scheduleSceneRefresh();
    })();
    return () => {
      cancelled = true;
      extraCleanup?.();
      ctx?.revert();
    };
  });
}

// ---------------------------------------------------------------------------
// batchReveal — ScrollTrigger.batch entrance for grids, one trigger group not one per card.
// ---------------------------------------------------------------------------

const REVEAL_VARIANTS = {
  'fade-rise': { y: 24 },
  scramble: { y: -16, rotate: -3 },
  'slide-scale': { x: -24, scale: 0.94 },
  'flip-in': { rotateX: -35 },
};

/**
 * batchReveal(elements, variant = 'fade-rise', { decorative = false } = {}) → { destroy() }
 * See the file-header PUBLIC API comment for the full contract.
 */
export function batchReveal(elements, variant = 'fade-rise', { decorative = false } = {}) {
  const els = Array.isArray(elements) || elements instanceof NodeList ? Array.from(elements) : [elements].filter(Boolean);
  if (!els.length) return { destroy() {} };
  const offset = REVEAL_VARIANTS[variant] || REVEAL_VARIANTS['fade-rise'];

  return motionScope(() => {
    let ctx = null;
    let batchTriggers = null;
    let cancelled = false;
    (async () => {
      const gsap = await whenGsap();
      if (cancelled || !gsap || !window.ScrollTrigger) return;
      if (!motionAllowed()) return;
      // Text-bearing elements (the default) never start below opacity 0.85 — law 6, text is never
      // hidden. Purely decorative elements (fills, chips, coins…) may start fully transparent.
      const fromVars = { opacity: decorative ? 0 : 0.85, ...offset };
      ctx = gsap.context(() => {
        // Apply the "before" state synchronously, up front — NOT inside onEnter via fromTo. Elements
        // sit at full/authored opacity from first paint until whichever one scrolls into view first;
        // driving the from-state off ScrollTrigger.batch's onEnter instead would let every element below
        // the fold render fully visible and then visibly snap down to `fromVars` the instant it enters,
        // which reads as a flash/pop rather than an entrance (found in review).
        gsap.set(els, fromVars);
        batchTriggers = window.ScrollTrigger.batch(els, {
          start: 'top 88%',
          once: true,
          onEnter: batch => gsap.to(batch, {
            opacity: 1, y: 0, x: 0, scale: 1, rotate: 0, rotateX: 0,
            duration: 0.6, ease: 'power3.out', stagger: 0.06,
          }),
        });
      });
      scheduleSceneRefresh();
    })();
    return () => {
      cancelled = true;
      batchTriggers?.forEach(st => st.kill());
      batchTriggers = null;
      ctx?.revert(); // restores the gsap.set() from-state back to the authored CSS
    };
  });
}

// ---------------------------------------------------------------------------
// scrubHeading — chars scrub in as the heading nears the viewport; never fully hidden (law 6).
// ---------------------------------------------------------------------------

/**
 * scrubHeading(el) → { destroy() }
 * See the file-header PUBLIC API comment for the full contract.
 */
export function scrubHeading(el) {
  if (!el) return { destroy() {} };
  return motionScope(() => {
    let split = null;
    let tween = null;
    let st = null;
    let cancelled = false;
    (async () => {
      const gsap = await whenGsap();
      if (cancelled || !gsap || !window.SplitText || !window.ScrollTrigger) return;
      if (!motionAllowed()) return;
      // 'words,chars': chars sit inside inline-block word boxes, so a line can only wrap BETWEEN words
      // (with 'chars' alone every char is its own inline-block and the heading broke mid-word).
      split = new window.SplitText(el, { type: 'words,chars', aria: 'auto' });
      const chars = split.chars?.length ? split.chars : [el];
      tween = gsap.fromTo(chars,
        { y: '40%', opacity: 0.85, rotateX: -30 },
        {
          y: '0%', opacity: 1, rotateX: 0, stagger: 0.02, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 55%', scrub: 0.4 },
        },
      );
      st = tween.scrollTrigger;
      scheduleSceneRefresh();
    })();
    return () => {
      cancelled = true;
      st?.kill();
      tween?.kill?.();
      split?.revert();
    };
  });
}

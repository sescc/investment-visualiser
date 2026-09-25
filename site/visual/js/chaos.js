// chaos.js — seeded "unpredictable" choreography. Pure functions have zero DOM/browser dependency
// (importable from Node for a determinism test); DOM mounting is in separate exports below them.
//
// IMPORTANT: roll() only ever drives *decoration* — accent hue, entrance style, particle-formation
// order, palette variation. It must never change which content appears, its order, a "cheapest"
// answer, a ranking, or any fee figure. That partiality lives entirely in cost.js/data.js/feeview.js.
//
// PUBLIC API
//   mulberry32(seed) → () => number         Deterministic PRNG in [0,1); same seed ⇒ same sequence.
//   roll(seed) → Choreography                { seed, accent, entrance, formationOrder, palette }.
//                                             Deterministic: roll(42) is deep-equal every time.
//   randomSeed() → number                    A fresh 32-bit seed (crypto-backed when available).
//   getSeedFromUrl() → number|null           Reads `?seed=`, else null.
//   currentSeed() → number                   getSeedFromUrl() ?? a fresh randomSeed() (does not touch
//                                             the URL — a page that never remixes stays seedless in the
//                                             address bar, matching "random per visit").
//   setSeedParam(seed)                       Replaces only the `seed` search param via
//                                             history.replaceState, preserving every other param
//                                             (group, market, ids, scenario, calm, nowebgl, …) and the
//                                             hash (e.g. #calc-mount).
//   mountRemix({ mount, seed, onRoll }) → { reroll(seed?), destroy() }
//                                             Renders a 🎲 "Remix" button into `mount`. Click (or
//                                             .reroll()) picks a new random seed, updates the URL,
//                                             fires `sg:remix` on window with { seed, roll }, and calls
//                                             onRoll(roll) so the caller can replay entrances / re-seed
//                                             the stage without a reload.
//   onRemix(cb) → unsub                      Subscribe to `sg:remix` (detail: { seed, roll }).
//   initKonami(cb) → unsub                   ↑↑↓↓←→←→BA activates "chaos mode": fires `sg:chaosmode`
//                                             with { on: true } and cb({ on: true }). Gated on
//                                             motion.js's motionAllowed() — inert under reduced motion.
//   onChaosMode(cb) → unsub                  Subscribe to `sg:chaosmode`.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const ACCENTS = ['products', 'methods', 'brokers'];
const ENTRANCES = ['fade-rise', 'scramble', 'slide-scale', 'flip-in'];
const FORMATIONS = ['nebula', 'grid', 'rings', 'rain', 'helix'];

/** roll(seed) → deterministic Choreography. Decoration only — see file header. */
export function roll(seed) {
  const s = Number.isFinite(seed) ? seed >>> 0 : 0;
  const rand = mulberry32(s);
  const accent = ACCENTS[Math.floor(rand() * ACCENTS.length)];
  const entrance = ENTRANCES[Math.floor(rand() * ENTRANCES.length)];
  const formationOrder = shuffle(FORMATIONS, rand);
  const palette = {
    hueShift: Math.floor(rand() * 360),
    saturationBoost: Math.round(rand() * 100) / 100,
    glowBoost: Math.round(rand() * 100) / 100,
  };
  return { seed: s, accent, entrance, formationOrder, palette };
}

export function randomSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}

export function getSeedFromUrl() {
  if (typeof location === 'undefined') return null;
  const v = new URLSearchParams(location.search).get('seed');
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n >>> 0 : null;
}

export function currentSeed() {
  return getSeedFromUrl() ?? randomSeed();
}

export function setSeedParam(seed) {
  if (typeof history === 'undefined' || typeof location === 'undefined') return;
  const url = new URL(location.href);
  url.searchParams.set('seed', String(seed >>> 0));
  history.replaceState(history.state, '', url.pathname + '?' + url.searchParams.toString() + url.hash);
}

export function onRemix(cb) {
  const handler = e => cb(e.detail);
  window.addEventListener('sg:remix', handler);
  return () => window.removeEventListener('sg:remix', handler);
}

export function onChaosMode(cb) {
  const handler = e => cb(e.detail);
  window.addEventListener('sg:chaosmode', handler);
  return () => window.removeEventListener('sg:chaosmode', handler);
}

/** Mounts a 🎲 Remix button. Returns { reroll(seed?), destroy() }. */
export function mountRemix({ mount, seed, onRoll } = {}) {
  if (!mount) return { reroll() {}, destroy() {} };
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pill btn-remix';
  btn.dataset.action = 'remix';
  btn.setAttribute('aria-label', 'Remix — reroll the visual choreography');
  btn.title = 'Remix the look (does not change any content or fees)';
  btn.innerHTML = '<span aria-hidden="true">🎲</span> <span>Remix</span>';
  mount.appendChild(btn);

  function reroll(nextSeed) {
    const s = Number.isFinite(nextSeed) ? nextSeed >>> 0 : randomSeed();
    setSeedParam(s);
    const r = roll(s);
    window.dispatchEvent(new CustomEvent('sg:remix', { detail: { seed: s, roll: r } }));
    onRoll?.(r);
    return r;
  }

  const onClick = () => reroll();
  btn.addEventListener('click', onClick);

  return {
    reroll,
    destroy() {
      btn.removeEventListener('click', onClick);
      btn.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// Konami code → chaos mode
// ---------------------------------------------------------------------------

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export function initKonami(cb) {
  let idx = 0;
  function onKeydown(e) {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === KONAMI[idx]) {
      idx += 1;
      if (idx === KONAMI.length) {
        idx = 0;
        window.dispatchEvent(new CustomEvent('sg:chaosmode', { detail: { on: true } }));
        cb?.({ on: true });
      }
    } else {
      idx = key === KONAMI[0] ? 1 : 0;
    }
  }
  window.addEventListener('keydown', onKeydown);
  return () => window.removeEventListener('keydown', onKeydown);
}

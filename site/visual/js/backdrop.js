// backdrop.js — the visual edition's moving background. Replaces stage.js's full-viewport WebGL
// particle field (removed 2026-09-27, user decision: "remove WebGL entirely") with a plain DOM/CSS
// layer: three large radial-gradient blobs in the three world hues, plus a static grain texture.
// Decorative only: fixed, aria-hidden, pointer-events:none, never intercepts input, never gates content.
//
// PUBLIC API
//   mountBackdrop() → { pulse(hue), setFormation(name, points?), get formation, destroy() }
//     Always creates (or reuses) `.sg-backdrop` and prepends it to <body> — unlike the old WebGL stage,
//     this layer is cheap DOM/CSS, so it stays mounted even under Calm/reduced-motion; only the
//     scroll-parallax part (see below) is gated on motion internally.
//     `setFormation(name)` sets `data-formation` on the layer (CSS `transition: transform 1.4s` moves
//     the blobs between the named layout — see visual.css's `.sg-backdrop[data-formation="…"]` rules).
//     `name` must be one of FORMATIONS; anything else falls back to 'nebula'. The chosen formation is
//     saved to sessionStorage (`sg-visual-formation`, try/catch) so navigating between visual pages
//     continues the same shape — same key stage.js used, so nothing else needs to change. A second
//     `points` argument is accepted (ignored) for call-site compatibility with the old
//     `Stage.setFormation(name, points)` signature; this DOM backdrop only ever renders the five named
//     layouts, not arbitrary point clouds.
//     `pulse(hue)` (hue: 'products'|'methods'|'brokers'|0|1|2) briefly (700ms) brightens/enlarges that
//     hue's blob via a single `element.animate()` call — no-op when motion isn't allowed.
//     Under !motionAllowed(): the layer stays in its current formation with no transition (the global
//     `.is-calm`/`prefers-reduced-motion` CSS rule already collapses every transition to ~0ms), pulse()
//     is a no-op, and no ScrollTrigger is created (see below) — a fully static layout.
//     `destroy()` tears down the scroll-parallax scope, disconnects the section-formation observer, and
//     removes the layer.
//   FORMATIONS = ['nebula','grid','rings','rain','helix'] — same names stage.js used.
//
// Scroll parallax: ONE page-wide scrubbed ScrollTrigger (not one per blob) drives all three blobs'
// translate/scale/rotate together, via a single GSAP timeline with three tweens starting at position 0.
// Built inside a motion.js `motionScope`, so it's created/reverted automatically as Calm/reduced-motion
// toggles; a failed GSAP load (or `?nogsap=1`) leaves the blobs in their static per-formation position.
//
// Section → formation auto-wiring (added 2026-09-27, replacing five near-identical per-page copies —
// brokers.js, methods.js, compare.js each had their own IntersectionObserver; hub.js/products.js each
// had their own `wireFormation`/ScrollTrigger version): `mountBackdrop()` itself observes every
// `main section[data-formation]` on the page with ONE plain `IntersectionObserver` (no GSAP dependency,
// so this runs even under `?nogsap=1`) and calls `setFormation` with whichever section is intersecting a
// thin band at the viewport's vertical centre (`rootMargin: '-45% 0px -45% 0px'`) — this is what "pick
// the section nearest the viewport centre" means here, not a separate distance calculation. Not gated on
// `motionAllowed()`: `setFormation` is a cheap attribute write, and it already degrades to an instant,
// untransitioned jump under Calm/reduced-motion via the global CSS transition kill-switch, so there is
// nothing to gain by turning this observer off. Pages no longer need their own initial-formation
// call either — every page's hero section's own `data-formation` attribute already equals the value that
// page used to hardcode as its startup default (verified against every site/visual/*.html), and an
// `IntersectionObserver` fires an initial callback for each newly-observed target based on its current
// intersection state, before any scroll — so the very first callback here reproduces exactly what the
// old explicit `sg:stageready`-driven "set the initial formation" calls did, without needing them.

import { motionAllowed, motionScope, whenGsap } from './motion.js';

export const FORMATIONS = ['nebula', 'grid', 'rings', 'rain', 'helix'];
const FORMATION_KEY = 'sg-visual-formation';
const HUES = ['products', 'methods', 'brokers'];

function saveFormation(name) {
  try { sessionStorage.setItem(FORMATION_KEY, JSON.stringify({ formation: name })); } catch { /* ignore */ }
}
function readSavedFormation() {
  try {
    const raw = sessionStorage.getItem(FORMATION_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return FORMATIONS.includes(obj?.formation) ? obj.formation : null;
  } catch { return null; }
}

function buildLayer() {
  const layer = document.createElement('div');
  layer.className = 'sg-backdrop';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = HUES.map(hue => `
    <div class="sg-backdrop-blob sg-backdrop-blob--${hue}">
      <div class="sg-backdrop-blob-parallax">
        <div class="sg-backdrop-blob-inner"></div>
      </div>
    </div>`).join('') + '<div class="sg-backdrop-grain"></div>';
  document.body.prepend(layer);
  return layer;
}

// ONE page-wide ScrollTrigger driving all three blobs' parallax via a single timeline (three tweens
// starting at position 0), rather than one ScrollTrigger per blob.
function buildParallaxScope(layer) {
  return motionScope(() => {
    let ctx = null;
    let cancelled = false;
    (async () => {
      const gsap = await whenGsap();
      if (cancelled || !gsap || !window.ScrollTrigger) return;
      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: {
            start: 0,
            end: 'max',
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });
        const parallaxEls = layer.querySelectorAll('.sg-backdrop-blob-parallax');
        parallaxEls.forEach((el, i) => {
          const dir = i % 2 === 0 ? 1 : -1;
          tl.to(el, { yPercent: 16 * dir, xPercent: -9 * dir, rotate: 10 * dir, scale: 1.1, ease: 'none' }, 0);
        });
      });
    })();
    return () => {
      cancelled = true;
      ctx?.revert();
    };
  });
}

// Plain IntersectionObserver, no GSAP — see the "Section → formation auto-wiring" file-header note.
function observeSectionFormations(setFormation) {
  const sections = document.querySelectorAll('main section[data-formation]');
  if (!sections.length || !('IntersectionObserver' in window)) return null;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) setFormation(e.target.dataset.formation); });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  sections.forEach(el => io.observe(el));
  return io;
}

export function mountBackdrop() {
  const layer = document.querySelector('.sg-backdrop') || buildLayer();

  let formation = readSavedFormation() || 'nebula';
  layer.setAttribute('data-formation', formation);

  const parallaxScope = buildParallaxScope(layer);
  let disposed = false;

  function setFormation(name /*, points — accepted for call-site compat, unused */) {
    if (disposed) return;
    formation = FORMATIONS.includes(name) ? name : 'nebula';
    saveFormation(formation);
    // No branching needed for !motionAllowed(): the blanket `.is-calm`/reduced-motion CSS rule already
    // forces every transition-duration to ~0ms, so this becomes an instant, untransitioned jump.
    layer.setAttribute('data-formation', formation);
  }

  const sectionObserver = observeSectionFormations(setFormation);

  function pulse(hue) {
    if (disposed || !motionAllowed()) return;
    const key = typeof hue === 'number' ? HUES[hue] : hue;
    const target = layer.querySelector(`.sg-backdrop-blob--${key} .sg-backdrop-blob-inner`);
    if (!target || typeof target.animate !== 'function') return;
    target.animate(
      [
        { opacity: 0.5, transform: 'scale(1)' },
        { opacity: 1, transform: 'scale(1.2)', offset: 0.45 },
        { opacity: 0.5, transform: 'scale(1)' },
      ],
      { duration: 700, easing: 'ease-out' },
    );
  }

  function destroy() {
    if (disposed) return;
    disposed = true;
    parallaxScope.destroy();
    sectionObserver?.disconnect();
    layer.remove();
  }

  return {
    pulse,
    setFormation,
    get formation() { return formation; },
    destroy,
  };
}

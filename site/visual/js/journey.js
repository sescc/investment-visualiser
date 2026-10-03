// journey.js — makes the five visual pages one continuous trip: Hub -> Products -> Methods -> Brokers ->
// Compare. Mounted once per page by shell.js:mountShell (so every page gets it), after the backdrop.
//
// PUBLIC API
//   nextStop(page)                  re-exported from stops.js — { href, label, index } | null (null for Compare).
//   mountJourney({ page, stage, footEl }) → { destroy(), get state }   idempotent (second call returns the first handle).
//     `page`    the active nav href ('index.html' …), `stage` the backdrop handle (setFormation/pulse/formation),
//     `footEl`  #app-footer — the runway/finale is inserted right after it, so the footer, disclaimer, freshness
//               and glossary links stay reachable above it.
//
// WHAT IT MOUNTS
//   1. RUNWAY (every page but Compare) — `section.journey-runway` after the footer: "Next stop" title, a neutral
//      teaser and a REAL link `a.journey-next` (rendered without GSAP, so it exists in every mode, and is the
//      only thing a keyboard / Calm / reduced-motion / ?nogsap=1 reader gets). CSS default = short plain section;
//      class `is-live` (added only when motion is allowed and GSAP is expected) makes it 1.2 viewport heights
//      with a CSS-sticky stage (not a GSAP pin), over which the warp plays.
//   2. WARP — scrubbed by the runway's own scroll progress `p` (0 when its top reaches the viewport bottom,
//      1 at max scroll): stroke-only rings scale up, a veil fades in, the title zooms toward the reader (never
//      below opacity 1 — law 6), the fixed .sg-backdrop scales, the backdrop switches to the 'rings' formation
//      and pulses. Transform/opacity only; no will-change; no ScrollTrigger (see SCROLL SAMPLER).
//   3. NAVIGATION — see ARMING. At most once per page view: sets the one-shot sessionStorage flag
//      `sg-journey-arrival` and `location.assign(nextHref)` (carries ?seed= and ?calm= only).
//   4. VIEW-TRANSITION HANDOFF — in a `pageswap` listener (covers auto-navigation, a click on the link and
//      keyboard activation): the current hero headline gives up `view-transition-name: visual-hero-headline`
//      and the runway title takes it, so the cross-document transition morphs the title into the next page's
//      hero headline (the four non-Hub heroes carry the `.hero-headline` class for this). Undone on `pageshow`.
//   5. PREFETCH — `<link rel="prefetch">` of the next page the first time the runway comes within ~1 viewport.
//      Never prerender (entrance animations must not play while the page is hidden).
//   6. ARRIVAL — if the previous page set the flag (and it names this page's predecessor), the backdrop scales
//      in from 1.5 and pulses once, after the view transition has finished (900 ms cap). Content wrappers are
//      deliberately NOT animated (ancestors of pinned scenes; would stack with the pages' own entrances).
//   7. HUD — fixed bottom-left, aria-hidden 5-dot rail + current stop + a scaleX page-progress fill. Hidden below
//      480px, while the runway stage is in view and while a modal is open. Static (no fill) when motion is off.
//   8. FINALE (Compare only) — "Journey complete": recap links to the five stops, the disclaimer sentence,
//      "Start again (Hub)" and "Back to the normal site" (edition-switch.js:editionHref), credits rising
//      (transform only) and one capped confetti burst when it enters view. Never navigates.
//
// SCROLL SAMPLER (why no ScrollTrigger here): a trigger created in mountShell is measured BEFORE the page's pins
// insert their spacers (the Products bug class). So the runway reads its own getBoundingClientRect() in ONE
// rAF-coalesced sample per scroll event (a rAF is scheduled only by a scroll event — never a standing loop).
// The runway's IntersectionObserver gates the rect read to "near" (within 1 viewport); the HUD only does a cached
// scrollY/max division and one transform write. Nothing runs while idle.
//
// ARMING (back-bounce safety) — geometry: V = viewport height, t = runway top. The runway is 1.2 V tall, so max
// scroll is t = -0.2 V. "Above the runway" means t >= 0.5 V (scrolling up one viewport from the bottom gives
// t = 0.8 V, clearing it). The runway ARMS only on a downward crossing from above to below that line, observed
// between two samples, with a user-intent event (wheel / touch / PageDown… key; not Tab) in the last 400 ms — so
// scroll restoration, late pin spacers, scroll anchoring and focus scroll-into-view can never arm it. It FIRES when
// armed, p >= 0.98, moving down (or a fresh downward wheel / key / touch gesture while already at the bottom, since
// no more scroll events come there), >= 400 ms after arming (a fast flick or the End key can't fire it), not within
// 500 ms of a height-only resize, not after focus entered the runway, and not already fired. `pageshow` (incl.
// bfcache `persisted`) disarms and resets everything, so Back never bounces forward. A width resize disarms.
// Motion off (Calm, reduced motion, ?nogsap=1, GSAP failure) => none of this exists: the runway is just the link.

import { DEBUG, motionAllowed, motionScope, whenGsap } from './motion.js';
import { confettiBurst } from './fx.js';
import { editionHref } from '../../js/edition-switch.js';
import { NAV_ITEMS, nextStop, stopIndex, nextHref, stopHref } from './stops.js';

export { nextStop };

const ARRIVAL_KEY = 'sg-journey-arrival';
const VT_NAME = 'visual-hero-headline';
const ABOVE_FRAC = 0.5;     // runway top >= this * V  =>  reader is "above" the runway
const FIRE_P = 0.98;
const DWELL_MS = 400;       // min time between arming and firing
const INTENT_MS = 400;      // an arming scroll must follow user input within this
const WHEEL_GAP_MS = 180;   // quiet gap that makes a wheel event a fresh gesture (filters trackpad inertia)
const RESIZE_HOLD_MS = 500;
const AWAY_P = 0.05;        // HUD hides once the runway stage is this far in

const clamp01 = n => Math.min(1, Math.max(0, n));
const ssGet = k => { try { return sessionStorage.getItem(k); } catch { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } };
const ssDel = k => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pageFileOf(url) {
  try { return new URL(url, location.href).pathname.split('/').pop() || 'index.html'; } catch { return null; }
}

// ---------------------------------------------------------------------------
// DOM builders — all static HTML, no GSAP.
// ---------------------------------------------------------------------------

function buildRunway(next, live) {
  const s = document.createElement('section');
  s.className = 'journey-runway' + (live ? ' is-live' : '');
  s.setAttribute('aria-label', 'Next stop');
  s.dataset.next = next.href;
  s.innerHTML = `
    <div class="journey-stage">
      <div class="journey-veil" aria-hidden="true"></div>
      <div class="journey-rings" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <h2 class="journey-title"><span class="journey-kicker">Next stop<span class="sr-only">:</span></span> <span class="journey-dest">${esc(next.label)}</span></h2>
      <p class="journey-teaser">Continue to ${esc(next.label)} when you're ready.</p>
      <nav class="journey-nav" aria-label="Next page">
        <a class="journey-next btn btn-primary" href="${esc(nextHref(next.from))}">Next: ${esc(next.label)} →</a>
      </nav>
    </div>`;
  return s;
}

function buildFinale(page) {
  const s = document.createElement('section');
  s.className = 'journey-finale';
  s.setAttribute('aria-labelledby', 'journey-finale-h');
  const idx = stopIndex(page);
  s.innerHTML = `
    <div class="visual-wrap">
      <div class="journey-finale-inner glass">
        <h2 id="journey-finale-h" class="journey-finale-title">Journey complete</h2>
        <ol class="journey-recap">
          ${NAV_ITEMS.map((n, i) => `<li${i === idx ? ' aria-current="page"' : ''}><a href="${esc(stopHref(n.href))}"><span class="journey-recap-n" aria-hidden="true">${i + 1}</span> ${esc(n.label)}</a></li>`).join('')}
        </ol>
        <p class="journey-finale-note">Educational only — not financial advice. Fees change; always confirm on the provider's site.</p>
        <div class="journey-finale-actions">
          <a class="btn btn-primary" href="${esc(stopHref('index.html'))}">Start again (Hub)</a>
          <a class="btn btn-ghost" href="${esc(editionHref())}">Back to the normal site</a>
        </div>
      </div>
    </div>`;
  return s;
}

function buildHud(page) {
  const idx = stopIndex(page);
  const hud = document.createElement('div');
  hud.className = 'journey-hud';
  hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML = `
    <span class="journey-hud-dots">${NAV_ITEMS.map((n, i) => `<i class="${i < idx ? 'is-done' : i === idx ? 'is-current' : ''}"></i>`).join('')}</span>
    <span class="journey-hud-label">${esc(NAV_ITEMS[idx]?.label ?? '')}</span>
    <span class="journey-hud-bar"><i></i></span>`;
  document.body.appendChild(hud);
  return hud;
}

// ---------------------------------------------------------------------------
// mountJourney
// ---------------------------------------------------------------------------

export function mountJourney({ page, stage, footEl } = {}) {
  if (window.__sgJourney) return window.__sgJourney;
  if (stopIndex(page) < 0) return null;

  // One-shot arrival flag: read + clear immediately; only honoured if it names this page's predecessor.
  const from = ssGet(ARRIVAL_KEY);
  ssDel(ARRIVAL_KEY);
  const arrived = !!from && nextStop(from)?.href === page;

  const next = nextStop(page);
  const predictLive = motionAllowed() && !DEBUG.noGsap;
  const anchor = footEl || document.body.lastElementChild;

  let runway = null;
  let finale = null;
  if (next) {
    runway = buildRunway({ ...next, from: page }, predictLive);
    anchor.after(runway);
  } else {
    finale = buildFinale(page);
    anchor.after(finale);
  }
  const hud = buildHud(page);
  const hudFill = hud.querySelector('.journey-hud-bar i');

  const linkEl = runway?.querySelector('.journey-next') || null;
  const titleEl = runway?.querySelector('.journey-title') || null;
  const teaserEl = runway?.querySelector('.journey-teaser') || null;
  const neutralTeaser = teaserEl?.textContent || '';

  const state = { live: false, gsapOk: false, armed: false, fired: false, p: 0, near: false };
  const handle = { destroy() {}, get state() { return state; } };
  window.__sgJourney = handle;

  // ---- always-on, motion-independent: link href freshness, focus guard, prefetch, VT handoff ----
  let userFocused = false;
  const refreshHref = () => { if (linkEl && next) linkEl.setAttribute('href', nextHref(page)); };
  window.addEventListener('sg:remix', refreshHref);
  linkEl?.addEventListener('focus', refreshHref);
  linkEl?.addEventListener('pointerdown', refreshHref);
  linkEl?.addEventListener('click', () => { ssSet(ARRIVAL_KEY, page); });
  runway?.addEventListener('focusin', () => { userFocused = true; });

  let heroEl = null;
  function undoHandoff() {
    titleEl?.style.removeProperty('view-transition-name');
    heroEl?.style.removeProperty('view-transition-name');
  }
  window.addEventListener('pageswap', e => {
    if (!e.viewTransition || !motionAllowed() || !titleEl || !next) return;
    let dest = null;
    try { dest = pageFileOf(e.activation?.entry?.url); } catch { /* ignore */ }
    if (dest !== next.href) return;
    const r = titleEl.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= window.innerHeight) return; // morphing from an off-screen title looks wrong
    heroEl = document.querySelector('.hero-headline');
    heroEl?.style.setProperty('view-transition-name', 'none');
    titleEl.style.setProperty('view-transition-name', VT_NAME);
  });

  let prefetched = false;
  function prefetchNext() {
    if (prefetched || !next) return;
    prefetched = true;
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.as = 'document';
    l.href = next.href; // path only — no query, so one cached copy serves any seed/calm
    document.head.appendChild(l);
  }

  // ---- everything animated / scroll-driven lives in one motionScope (Calm / reduced-motion tear it all down) ----
  motionScope(() => {
    let cancelled = false;
    let raf = 0;
    let io = null;
    let finaleIo = null;
    let tl = null;
    let setP = null;
    let ro = null;
    let arrivalTween = null;
    let finaleTweens = [];
    const timers = [];
    const backdropEl = document.querySelector('.sg-backdrop');

    // sampler state (per page view)
    let near = false;
    let docMax = 1;
    let lastY = window.scrollY;
    let down = true;
    let wasAbove = null;
    let armed = false;
    let armedAt = 0;
    let bottomAt = 0;
    let lastIntentAt = 0;
    let lastWheelAt = 0;
    let touchStartY = 0;
    let touchAfterBottom = false;
    let resizeHoldUntil = 0;
    let lastW = window.innerWidth;
    let lastP = 0;
    let hudP = -1;
    let away = false;
    let formSet = false;
    let prevFormation = null;
    const pulsed = [false, false, false];
    const HUES = ['products', 'methods', 'brokers'];

    function measure() {
      docMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    }
    function setAway(v) {
      if (v !== away) { away = v; hud.classList.toggle('is-away', v); }
    }
    function resetWarp() {
      lastP = 0; state.p = 0;
      if (tl) { setP?.(0); tl.progress(0); }
      if (backdropEl && state.gsapOk) window.gsap.set(backdropEl, { clearProps: 'transform' });
      setAway(false);
      pulsed.fill(false);
      if (formSet && prevFormation) stage?.setFormation(prevFormation);
      formSet = false;
    }

    function go() {
      state.fired = true;
      ssSet(ARRIVAL_KEY, page);
      location.assign(nextHref(page));
    }

    function maybeFire(src, now) {
      if (state.fired || !armed || !state.gsapOk || userFocused || !runway) return;
      if (!motionAllowed() || document.hidden) return;
      if (lastP < FIRE_P) return;
      if (src === 'scroll' && !down) return;
      if (now - armedAt < DWELL_MS) return;
      if (now < resizeHoldUntil) return;
      go();
    }

    function sample() {
      raf = 0;
      const now = performance.now();
      const y = window.scrollY;
      if (y !== lastY) { down = y > lastY; lastY = y; }

      // HUD: page progress, one transform write when it changed.
      if (state.gsapOk) {
        const pp = clamp01(y / docMax);
        if (Math.abs(pp - hudP) > 0.002) { hudP = pp; hudFill.style.transform = `scaleX(${pp.toFixed(3)})`; }
      }
      if (!runway || !near) return;

      const rect = runway.getBoundingClientRect();
      const V = window.innerHeight;
      const t = rect.top;
      const p = clamp01((V - t) / Math.max(1, rect.height));
      lastP = p; state.p = p;
      setAway(p > AWAY_P);

      // ---- warp (decorative) ----
      if (state.gsapOk) {
        setP?.(p);
        if (p > 0.2 && !formSet && stage) { prevFormation = stage.formation; stage.setFormation('rings'); formSet = true; }
        else if (p < 0.1 && formSet) { if (prevFormation) stage?.setFormation(prevFormation); formSet = false; }
        [0.5, 0.75, 0.95].forEach((th, i) => {
          if (p >= th && !pulsed[i]) { pulsed[i] = true; stage?.pulse(HUES[i]); }
          else if (p < 0.4 && pulsed[i]) pulsed[i] = false;
        });
      }

      // ---- arming ----
      const above = t >= ABOVE_FRAC * V;
      if (above) { armed = false; bottomAt = 0; }
      else if (wasAbove === true && down && now - lastIntentAt <= INTENT_MS) { armed = true; armedAt = now; }
      wasAbove = above;
      state.armed = armed;

      if (p >= FIRE_P) { if (!bottomAt) bottomAt = now; maybeFire('scroll', now); }
      else bottomAt = 0;
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(sample); };

    // ---- user-intent + at-the-bottom gestures (passive; one timestamp write each) ----
    const INTENT_KEYS = new Set(['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', ' ', 'Home', 'End']);
    const FIRE_KEYS = new Set(['PageDown', 'ArrowDown', ' ']);
    function onWheel(e) {
      const now = performance.now();
      lastIntentAt = now;
      const fresh = now - lastWheelAt > WHEEL_GAP_MS;
      lastWheelAt = now;
      if (e.deltaY > 0 && fresh && bottomAt) maybeFire('wheel', now);
    }
    function onKey(e) {
      if (!INTENT_KEYS.has(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
      const now = performance.now();
      lastIntentAt = now;
      if (FIRE_KEYS.has(e.key) && !e.shiftKey && bottomAt) maybeFire('key', now);
    }
    function onTouchStart(e) {
      lastIntentAt = performance.now();
      touchStartY = e.touches?.[0]?.clientY ?? 0;
      touchAfterBottom = !!bottomAt;
    }
    function onTouchMove(e) {
      const now = performance.now();
      lastIntentAt = now;
      const y = e.touches?.[0]?.clientY ?? touchStartY;
      if (touchAfterBottom && touchStartY - y > 40 && bottomAt) maybeFire('touch', now);
    }

    function onResize() {
      const now = performance.now();
      const w = window.innerWidth;
      if (w !== lastW) { lastW = w; armed = false; wasAbove = null; bottomAt = 0; tl?.invalidate(); }
      else resizeHoldUntil = now + RESIZE_HOLD_MS;
      measure();
      schedule();
    }

    function onPageShow() {
      armed = false; wasAbove = null; armedAt = 0; bottomAt = 0;
      state.fired = false; state.armed = false; userFocused = false;
      undoHandoff();
      resetWarp();
      // Sample "where am I" after pageshow + one frame, never at mount: scroll restoration runs after mount.
      requestAnimationFrame(() => requestAnimationFrame(() => { lastY = window.scrollY; measure(); sample(); }));
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKey, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('pageshow', onPageShow);

    if (runway && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(entries => {
        const e = entries[entries.length - 1];
        near = e.isIntersecting;
        state.near = near;
        if (near) { prefetchNext(); measure(); sample(); }
        else { armed = false; wasAbove = null; bottomAt = 0; resetWarp(); }
      }, { rootMargin: '100% 0px 0px 0px', threshold: 0 });
      io.observe(runway);
    } else if (runway) {
      prefetchNext();
    }

    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(() => { measure(); schedule(); });
      ro.observe(document.body);
    }
    measure();

    // ---- GSAP part ----
    (async () => {
      const gsap = await whenGsap();
      if (cancelled) return;
      if (!gsap) {
        // GSAP failed / ?nogsap=1: fall back to the plain link-only runway.
        runway?.classList.remove('is-live');
        return;
      }
      state.gsapOk = true;
      state.live = true;
      hud.classList.add('is-live');
      runway?.classList.add('is-live');
      if (teaserEl) teaserEl.textContent = `Keep scrolling to continue to ${next.label}.`;

      if (runway) {
        const rings = runway.querySelectorAll('.journey-rings i');
        const veil = runway.querySelector('.journey-veil');
        const dest = runway.querySelector('.journey-title');
        const maxScale = () => Math.max(1, Math.min(1.5, (window.innerWidth - 32) / Math.max(1, dest.offsetWidth)));
        tl = gsap.timeline({ paused: true });
        tl.fromTo(rings, { scale: 0.2, opacity: 0 }, { scale: 1.4, opacity: 0.55, duration: 0.5, ease: 'none', stagger: 0.07 }, 0)
          .fromTo(veil, { opacity: 0 }, { opacity: 0.35, duration: 0.5, ease: 'none' }, 0)
          .fromTo(dest, { scale: 0.92 }, { scale: () => maxScale(), duration: 0.55, ease: 'power1.in' }, 0.35)
          // Teaser + link ride down together with the same offset so the zooming title never grows into them.
          .fromTo([teaserEl, runway.querySelector('.journey-nav')], { y: 0 }, { y: 44, duration: 0.55, ease: 'none' }, 0.35)
          .to(rings, { scale: 2.4, duration: 0.5, ease: 'none', stagger: 0.05 }, 0.5)
          .to(veil, { opacity: 0.6, duration: 0.5, ease: 'none' }, 0.5);
        if (backdropEl) tl.fromTo(backdropEl, { scale: 1 }, { scale: 1.35, duration: 0.5, ease: 'none' }, 0.5);
        setP = gsap.quickTo(tl, 'progress', { duration: 0.3, ease: 'power2.out' });
        if (near) sample();
      }

      // ---- arrival warp-in: backdrop only (see header) ----
      if (arrived && backdropEl) {
        const run = () => {
          if (cancelled || !motionAllowed()) return;
          arrivalTween = gsap.fromTo(backdropEl, { scale: 1.5 }, { scale: 1, duration: 0.8, ease: 'power3.out', clearProps: 'transform' });
          timers.push(setTimeout(() => arrivalTween?.progress(1), 1200));
          stage?.pulse({ products: 'products', methods: 'methods', brokers: 'brokers', compare: 'brokers' }[page.replace('.html', '')] || 'products');
        };
        const vt = document.activeViewTransition;
        if (vt?.finished) {
          let ran = false;
          const once = () => { if (!ran) { ran = true; run(); } };
          vt.finished.then(once, once);
          timers.push(setTimeout(once, 900));
        } else requestAnimationFrame(run);
      }

      // ---- finale: credits rise + one confetti burst ----
      if (finale) {
        const inner = finale.querySelector('.journey-finale-inner');
        const rows = finale.querySelectorAll('.journey-recap li');
        let played = false;
        const play = () => {
          if (played || cancelled) return;
          played = true;
          const a = gsap.from(inner, { y: 60, duration: 0.9, ease: 'power3.out' });
          const b = gsap.from(rows, { y: 28, duration: 0.7, ease: 'power3.out', stagger: 0.08, delay: 0.15 });
          finaleTweens.push(a, b);
          timers.push(setTimeout(() => { a.progress(1); b.progress(1); }, 1600));
          const r = inner.getBoundingClientRect();
          confettiBurst({ x: r.left + r.width / 2, y: Math.min(window.innerHeight * 0.6, r.top + 60) }, { count: 40 });
        };
        if ('IntersectionObserver' in window) {
          finaleIo = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { play(); finaleIo.disconnect(); } }, { threshold: 0.35 });
          finaleIo.observe(inner);
        }
      }
      sample();
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      io?.disconnect();
      finaleIo?.disconnect();
      ro?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pageshow', onPageShow);
      const g = window.gsap;
      tl?.kill();
      arrivalTween?.kill();
      finaleTweens.forEach(t => t.kill());
      if (g) {
        const clear = el => el && g.set(el, { clearProps: 'transform,opacity' });
        runway?.querySelectorAll('.journey-rings i, .journey-veil, .journey-title, .journey-teaser, .journey-nav').forEach(clear);
        finale?.querySelectorAll('.journey-finale-inner, .journey-recap li').forEach(clear);
        if (backdropEl) g.set(backdropEl, { clearProps: 'transform' });
      }
      if (formSet && prevFormation) stage?.setFormation(prevFormation);
      runway?.classList.remove('is-live');
      hud.classList.remove('is-live', 'is-away');
      hudFill.style.transform = '';
      if (teaserEl) teaserEl.textContent = neutralTeaser;
      state.gsapOk = false; state.live = false; state.armed = false;
    };
  });

  return handle;
}

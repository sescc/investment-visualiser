// hub.js — the visual edition's hub page (site/visual/index.html). Reference implementation for the
// four Wave C pages: shows how to mount the shell, read shared content/data/fee view-models, and layer
// spectacle on top of always-visible real content via motion.js's motionScope.
//
// Sections: kinetic hero + scroll-scrubbed portal journey, a swipeable quiz card stack with a slot-reel
// result, a risk/liquidity table (Wave 2 replaces this with an SVG scatter — see mountGalaxy below), and
// holographic-tilt world cards. Same copy, same quiz logic, same teaser text as the stable hub — see
// each section's comment for exactly which stable text/behaviour it mirrors.
//
// Local helpers below (crown, emptyStatePanel, bubbleTableRows, buildTableDetails, the diverging
// colour scale) are intentionally re-implemented rather than imported from site/js/components.js or
// site/js/charts.js: both of those modules import each other (charts.js imports components.js for
// onThemeChange), and pulling in components.js would drag the entire stable page-chrome module into
// the visual bundle. None of these helpers make a fee/costing decision — costGroupOf, computeCost,
// rankByCost and teaserData itself all still come from cost.js/content.js untouched.

import { getData, isEmpty, buildCompareUrl } from '../../js/data.js';
import { WORLD_META, teaserData, QUESTIONS, pickQuizResult } from '../../js/content.js';
import { icon } from '../../js/icons.js';
import { mountShell, esc } from './shell.js';
import { motionAllowed, motionScope, whenGsap, reveal, scene, scrubOnEntry, scrubHeading, refreshScenes, scheduleSceneRefresh } from './motion.js';
import { confettiBurst, playBlip } from './fx.js';
import { onRemix } from './chaos.js';
import { NAV_ITEMS } from './stops.js';

// ============================================================================
// Local scroll-scene helpers (see file header for why these aren't imported from motion.js — Wave 2
// owns only hub.js/products.js; motion.js's `scene()` is used where its pin+matchMedia contract fits,
// and motion.js's `scrubOnEntry()` is used below wherever a helper needs custom start/end points and
// must NOT be pinned.)
// ============================================================================

// Every pinned scene ends in the authored layout (law 6) — a pinned hero explode would instead have to
// END exploded, which breaks that rule. So the hero headline gets an UNPINNED scrub instead (words drift
// out as the hero scrolls toward and past the top of the viewport, never hidden — only transform moves,
// opacity is never touched). Only the hero *diagram* (coin + portals, mountJourneyScene below) is pinned.
function heroExplode(headingEl, sectionSelector) {
  if (!headingEl) return { destroy() {} };
  const trigger = headingEl.closest(sectionSelector) || headingEl;
  return scrubOnEntry(trigger, tl => {
    if (!window.SplitText) return null;
    const split = new window.SplitText(headingEl, { type: 'words', aria: 'auto' });
    const words = split.words?.length ? split.words : [headingEl];
    // Opacity is never animated here — words only translate/rotate/scale — so the headline can never
    // drop below the law-6 floor no matter where scroll lands.
    tl.fromTo(words, { x: 0, y: 0, rotate: 0, scale: 1 }, {
      x: i => (i % 2 === 0 ? -1 : 1) * (34 + i * 14),
      y: i => -24 - i * 4,
      rotate: i => (i % 2 === 0 ? -1 : 1) * 11,
      scale: 0.86,
      ease: 'none',
    });
    return () => split.revert(); // restores the plain text node exactly
  }, { start: 'top top', end: 'bottom top' });
}

// ============================================================================
// Local helpers (see file header for why these aren't imported from stable modules)
// ============================================================================

function crown(label = 'Cheapest right now') {
  return `<span class="crown" title="${esc(label)}">${icon('crown', { size: 14 })}<span class="sr-only">${esc(label)}</span></span>`;
}

function emptyStatePanel(container, { title = 'No data yet', detail = 'Run the scraper to generate data.' } = {}) {
  container.innerHTML = `
    <div class="panel" style="text-align:center">
      ${icon('warning', { size: 32 })}
      <h3>${esc(title)}</h3>
      <p>${esc(detail)}</p>
      <code>npm run scrape</code>
    </div>`;
}

function buildTableDetails(headers, rows) {
  return `
    <details class="chart-table">
      <summary>Show as table</summary>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>${headers.map(hh => `<th>${esc(hh)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </details>`;
}

// Same row shape as stable's charts.js:bubbleTableRows.
function bubbleTableRows(products) {
  return products.map(p => [p.name, p.riskLevel, p.liquidity, p.complexity, typeof p.growthVsDividend === 'number' ? `${p.growthVsDividend}% growth / ${100 - p.growthVsDividend}% income` : '—']);
}

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 128, g: 128, b: 128 };
}
function lerpRgb(aHex, bHex, t) {
  const a = hexToRgb(aHex), b = hexToRgb(bHex);
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}
// Same diverging teal↔amber scale as stable's charts.js:divergingColor, returned as 0-255 components.
function divergingColorRgb(v) {
  const growth = cssVar('--growth') || '#0f8b8d';
  const income = cssVar('--income') || '#d98a12';
  const neutral = cssVar('--muted') || '#8a909c';
  const x = Math.max(0, Math.min(100, v ?? 50));
  return x >= 50 ? lerpRgb(neutral, growth, (x - 50) / 50) : lerpRgb(income, neutral, x / 50);
}

// Scatter geometry constants — declared here (`const`, not hoisted) rather than down in section 3, since
// Boot below calls `mountGalaxy()` synchronously and `mountGalaxy`/`scatterX`/`scatterY` all read these
// during that same call (a `const` used before its own declaration line has run is a TDZ error, unlike
// the `function mountGalaxy` declaration itself, which IS hoisted).
const SCATTER_VB_W = 420;
const SCATTER_VB_H = 340;
const SCATTER_PAD_L = 34;
const SCATTER_PAD_B = 30;
const SCATTER_PAD_T = 14;
const SCATTER_PAD_R = 14;

function scatterX(risk) {
  const w = SCATTER_VB_W - SCATTER_PAD_L - SCATTER_PAD_R;
  return SCATTER_PAD_L + ((risk - 1) / 4) * w;
}
function scatterY(liquidity) {
  const h = SCATTER_VB_H - SCATTER_PAD_T - SCATTER_PAD_B;
  // Inverted: higher liquidity draws higher up (smaller SVG y).
  return SCATTER_PAD_T + (1 - (liquidity - 1) / 4) * h;
}
function scatterR(complexity) {
  return 5 + Math.max(1, Math.min(5, complexity || 1)) * 2.1;
}

// ============================================================================
// Boot
// ============================================================================

const data = await getData();
const shellHandle = await mountShell({ page: 'index.html', data });

mountMarquee(); // before mountHero(): the strip sits right after the hero section, ahead of every pin below it
mountHero();
mountQuiz(data);
mountGalaxy(data, shellHandle);
mountWorldCards(data);
// Backdrop formation per section: backdrop.js's mountBackdrop() now auto-observes every
// `main section[data-formation]` on its own (2026-09-27 dedup — this page used to wire its own
// `wireFormation`/`wireSectionFormations` per section via ScrollTrigger; both are gone, folded into the
// shared IntersectionObserver-based one, since the hero section's own `data-formation="nebula"` is
// exactly what this page's initial formation used to be set to).
document.querySelectorAll('main section h2.kinetic').forEach(h2 => scrubHeading(h2));

onRemix(() => { if (motionAllowed()) playBlip({ freq: 600 }); });

// ============================================================================
// 1. Hero — kinetic headline (unpinned scrub-out) + pinned scroll-scrubbed portal journey (same
// headline/intro/labels as stable)
// ============================================================================

function mountHero() {
  const headline = document.getElementById('hero-headline');
  // Reveal the diagram INSIDE the card, never the card itself: the card is the trigger/pin of
  // mountJourneyScene() below, and ScrollTrigger's pin save/restores the pinned element's inline style —
  // that clobbered the entrance mid-tween and left a stale translateY(30px) on the card (its pin start
  // measured 30px off). The card box paints from first paint; only its picture eases in.
  const card = document.querySelector('.diagram-card');
  reveal(card?.querySelector('.diagram-svg') || card, { from: { opacity: 0, y: 30 }, delay: 0.15 });
  heroExplode(headline, '.hero-section');
  mountJourneyScene();
}

// Pinned: the coin rides the journey path via MotionPath while each portal's accent ring lights up as
// the coin passes it (transform/opacity only — the rings are purely decorative, so they may start fully
// hidden per law 6; the "You"/"Method"/"Broker"/"Product" text stays untouched throughout).
function mountJourneyScene() {
  const card = document.querySelector('.diagram-card');
  if (!card) return;
  scene(card, (tl, { gsap }) => {
    const coin = document.getElementById('journey-coin');
    const path = document.getElementById('journey-path');
    if (coin && path && window.MotionPathPlugin) {
      gsap.set(coin, { display: 'block' });
      tl.to(coin, {
        motionPath: { path, align: path, alignOrigin: [0.5, 0.5] },
        ease: 'none',
        duration: 1,
      }, 0);
    }
    // No `svgOrigin` (see mountScatterScene's note) — `.portal-ring`'s own CSS `transform-box: fill-box;
    // transform-origin: center` already pivots the scale around each ring's own centre.
    const pulseRing = (id, at) => {
      const ring = document.getElementById(id);
      if (!ring) return;
      tl.fromTo(ring, { opacity: 0, scale: 0.6 },
        { opacity: 1, scale: 1.12, duration: 0.08 }, at)
        .to(ring, { opacity: 0.3, scale: 1, duration: 0.08 }, at + 0.1);
    };
    pulseRing('ring-methods', 0.12);
    pulseRing('ring-brokers', 0.55);
    pulseRing('ring-products', 0.9);
  }, { pin: true, length: 1.5 });
}

// ============================================================================
// 1b. Journey marquee — a bold kinetic strip of the five journey stops between the hero and the quiz.
//     Decorative duplicate of the nav labels (stops.js:NAV_ITEMS — no new content), aria-hidden.
//     Two lanes slide in opposite directions as you scroll and the whole strip shears with scroll
//     VELOCITY. Everything runs off one ScrollTrigger onUpdate + gsap.quickTo (transform only); with no
//     scroll there is no work at all — no ticker callback, no timer (the quickTo tweens finish and the
//     ticker sleeps; the skew is released by ScrollTrigger's `scrollEnd`). With motion off (Calm,
//     reduced motion, ?nogsap=1, GSAP failure) it stays the static single row the markup/CSS describes.
// ============================================================================

function mountMarquee() {
  const hero = document.querySelector('.hero-section');
  if (!hero || document.querySelector('.journey-marquee')) return;
  const rowHtml = (dup) => `<span class="jm-row"${dup ? ' data-dup' : ''}>${NAV_ITEMS.map(n =>
    `<span class="jm-word" data-stop="${esc(n.href.replace(/\.html$/, '').replace(/^index$/, 'hub'))}">${esc(n.label)}</span><i class="jm-dot"></i>`).join('')}</span>`;
  // 3 identical rows per lane: the track slides within one row-width and is re-seated by exactly one row
  // width (visually identical) whenever it would run out, so it loops without ever tweening backwards.
  const lane = (cls) => `<div class="jm-lane ${cls}"><div class="jm-track">${rowHtml(false)}${rowHtml(true)}${rowHtml(true)}</div></div>`;
  const root = document.createElement('div');
  root.className = 'journey-marquee';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `<div class="jm-skew">${lane('jm-lane-a')}${lane('jm-lane-b')}</div>`;
  hero.after(root);

  motionScope(() => {
    let cancelled = false;
    let ctx = null;
    let st = null;
    let onEnd = null;
    (async () => {
      const gsap = await whenGsap();
      if (cancelled || !gsap || !window.ScrollTrigger || !motionAllowed()) return;
      const skewEl = root.querySelector('.jm-skew');
      const lanes = [
        { track: root.querySelector('.jm-lane-a .jm-track'), sign: -1 }, // A travels against the scroll
        { track: root.querySelector('.jm-lane-b .jm-track'), sign: 1 },  // B travels with it
      ];
      ctx = gsap.context(() => {
        let period = 1;
        const measure = () => {
          const row = lanes[0].track.querySelector('.jm-row');
          period = parseFloat(getComputedStyle(row).width) || row.offsetWidth || 1;
          // The track must span one period plus the viewport; render only that many rows (usually 2, not 3),
          // so the promoted layers — and the first-paint raster of their big type — stay as small as possible.
          const need = Math.max(2, Math.ceil((period + root.clientWidth) / period));
          lanes.forEach(l => l.track.querySelectorAll('.jm-row').forEach((r, i) => { r.style.display = i < need ? '' : 'none'; }));
        };
        root.classList.add('is-live');
        measure();
        lanes.forEach((l, i) => {
          l.pos = -period / 2;
          gsap.set(l.track, { x: l.pos });
          l.xTo = gsap.quickTo(l.track, 'x', { duration: 0.5, ease: 'power3.out' });
        });
        const skewTo = gsap.quickTo(skewEl, 'skewX', { duration: 0.6, ease: 'power3.out' });

        let lastY = window.scrollY, lastT = performance.now(), vel = 0;
        const move = (dx) => {
          lanes.forEach(l => {
            l.pos += dx * l.sign;
            // Re-seat by exactly one row width, then retarget from the re-seated position (quickTo's
            // resetTo re-reads the live value), so the loop seam never tweens backwards.
            while (l.pos < -period) { l.pos += period; gsap.set(l.track, { x: `+=${period}` }); }
            while (l.pos > 0) { l.pos -= period; gsap.set(l.track, { x: `-=${period}` }); }
            l.xTo(l.pos);
          });
        };
        st = window.ScrollTrigger.create({
          trigger: root,
          start: 'top bottom',
          end: 'bottom top',
          onRefresh: () => { measure(); },
          onUpdate: self => {
            const y = self.scroll();
            const now = performance.now();
            const dy = y - lastY;
            const dt = Math.max(8, now - lastT);
            lastY = y; lastT = now;
            if (!dy) return;
            vel = vel * 0.6 + (dy / dt * 1000) * 0.4; // px/s, lightly smoothed
            // Faster scrolling travels disproportionately further: velocity, not just distance.
            move(dy * (0.8 + Math.min(Math.abs(vel), 3000) / 3000 * 1.2));
            skewTo(Math.max(-12, Math.min(12, -vel / 220)));
          },
        });
        onEnd = () => { vel = 0; lastY = window.scrollY; lastT = performance.now(); skewTo(0); };
        window.ScrollTrigger.addEventListener('scrollEnd', onEnd);
      }, root);
      scheduleSceneRefresh(); // is-live can change the strip's height; re-measure everything below in document order
    })();
    return () => {
      cancelled = true;
      if (onEnd) window.ScrollTrigger?.removeEventListener('scrollEnd', onEnd);
      st?.kill();
      ctx?.revert();
      root.classList.remove('is-live');
      root.querySelectorAll('.jm-skew, .jm-track').forEach(el => { el.style.transform = ''; });
      scheduleSceneRefresh();
    };
  });
}

// ============================================================================
// 2. Quiz — same QUESTIONS/scoring/result as stable (content.js), swipeable card stack + slot reveal
// ============================================================================

function mountQuiz(data) {
  const mount = document.getElementById('quiz-mount');
  const answers = {};
  let qIdx = 0;

  function renderQuiz() {
    if (qIdx >= QUESTIONS.length) return renderResult();
    const step = QUESTIONS[qIdx];
    mount.innerHTML = `
      <div class="quiz glass">
        <div class="quiz-progress-track"><div class="quiz-progress-fill" style="width:${(qIdx / QUESTIONS.length) * 100}%"></div></div>
        <p class="quiz-progress">Question ${qIdx + 1} of ${QUESTIONS.length}</p>
        <div class="quiz-card" data-tilt>
          <h3 class="kinetic display-md">${esc(step.q)}</h3>
          <div class="quiz-options">
            ${step.options.map((o, i) => `<button type="button" class="quiz-option" data-i="${i}">${esc(o.label)}</button>`).join('')}
          </div>
        </div>
        ${qIdx > 0 ? `<button type="button" class="btn btn-ghost" data-action="quiz-back" style="margin-top:14px">Back</button>` : ''}
      </div>`;
    const card = mount.querySelector('.quiz-card');
    mount.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => selectOption(step, Number(btn.dataset.i), card));
    });
    mount.querySelector('[data-action="quiz-back"]')?.addEventListener('click', () => { qIdx -= 1; renderQuiz(); });
    wireDrag(card, step);
    refreshScenes(); // question height changes shift every section below (scatter/world-cards pins)
  }

  function selectOption(step, i, card) {
    answers[step.key] = step.options[i].value;
    playBlip({ freq: 500 + i * 60 });
    const dir = i === 0 ? -1 : i === step.options.length - 1 ? 1 : 0;
    flyOff(card, dir, () => { qIdx += 1; renderQuiz(); });
  }

  function flyOff(card, dir, done) {
    if (!card || !motionAllowed()) { done(); return; }
    whenGsap().then(gsap => {
      if (!gsap) { done(); return; }
      gsap.to(card, { x: dir * 340, rotate: dir * 12, opacity: 0, duration: 0.32, ease: 'power2.in', onComplete: done });
    });
  }

  // Fling left = first option, fling right = last option (accessible primary control is always the
  // tap buttons above — this is a bonus gesture, only wired when motion is allowed).
  function wireDrag(card, step) {
    if (!card || step.options.length < 2 || !motionAllowed()) return;
    whenGsap().then(gsap => {
      if (!gsap || !window.Draggable || !motionAllowed()) return;
      Draggable.create(card, {
        type: 'x',
        // No `inertia`: InertiaPlugin's VelocityTracker adds a permanent GSAP ticker listener per tracked
        // draggable, which kept the ticker (a rAF every frame) running on the hub while idle — law 7. The
        // decision below only reads this.x at release, so a throw adds nothing.
        inertia: false,
        onDragEnd() {
          const threshold = 100;
          if (this.x > threshold) selectOption(step, step.options.length - 1, card);
          else if (this.x < -threshold) selectOption(step, 0, card);
          else gsap.to(card, { x: 0, duration: 0.3 });
        },
      });
    });
  }

  function renderResult() {
    if (isEmpty(data)) {
      // Same empty-state copy as stable's index.js.
      mount.innerHTML = `<div class="quiz glass"><p class="muted">No data loaded yet — run <code>npm run scrape</code> to see personalised suggestions.</p>
        <button type="button" class="btn btn-ghost" data-action="quiz-restart">Start over</button></div>`;
      mount.querySelector('[data-action="quiz-restart"]').addEventListener('click', () => { qIdx = 0; renderQuiz(); });
      refreshScenes();
      return;
    }

    const { bestProduct, bestMethod, bestBroker, scenario, ids } = pickQuizResult(data, answers);
    const compareUrl = buildCompareUrl({ ids, scenario });
    const results = [
      bestProduct && { icon: 'basket', label: 'Product', name: bestProduct.name, href: 'products.html' },
      bestMethod && { icon: 'key', label: 'Method', name: bestMethod.name, href: 'methods.html' },
      bestBroker && { icon: 'briefcase', label: 'Broker type', name: bestBroker.name, href: 'brokers.html' },
    ].filter(Boolean);

    mount.innerHTML = `
      <div class="quiz glass">
        <h3 class="kinetic display-md">Your suggested starting point</h3>
        <div class="quiz-result">
          ${results.map(r => `
            <div class="quiz-result-card">
              <strong>${icon(r.icon, { size: 16 })} ${esc(r.label)}:</strong>
              <div class="quiz-reel" data-reel data-name="${esc(r.name)}">
                <div class="quiz-reel-track"><div class="quiz-reel-item"><a href="${esc(r.href)}">${esc(r.name)}</a></div></div>
              </div>
            </div>`).join('')}
        </div>
        <div class="modal-actions" style="justify-content:flex-start; margin-top:16px">
          <a class="btn btn-primary" data-magnetic href="${compareUrl}">${icon('chart', { size: 16 })} Compare these &amp; see costs</a>
          <button type="button" class="btn btn-ghost" data-action="quiz-restart">Start over</button>
        </div>
      </div>`;
    mount.querySelector('[data-action="quiz-restart"]').addEventListener('click', () => {
      qIdx = 0;
      Object.keys(answers).forEach(k => delete answers[k]);
      renderQuiz();
    });

    confettiBurst({ x: window.innerWidth / 2, y: mount.getBoundingClientRect().top + 120 });
    playBlip({ freq: 880 });
    spinReels(mount, results);
    refreshScenes();
  }

  // Content is already the final, linked result (see renderResult above) before this ever runs —
  // spinReels is a no-op under !motionAllowed(), and on any GSAP-load failure it just leaves the
  // final state in place instead of replacing it with the spin sequence.
  function spinReels(root, results) {
    if (!motionAllowed()) return;
    whenGsap().then(gsap => {
      if (!gsap) return;
      root.querySelectorAll('[data-reel]').forEach((reel, i) => {
        const track = reel.querySelector('.quiz-reel-track');
        const finalName = reel.dataset.name;
        const href = reel.querySelector('a')?.getAttribute('href') || '#';
        const decoys = results.map(r => r.name).filter(n => n !== finalName);
        const seq = [...decoys, ...decoys, finalName];
        if (seq.length < 2) return; // nothing to spin through
        track.innerHTML = seq.map((n, idx) => `<div class="quiz-reel-item">${idx === seq.length - 1 ? `<a href="${esc(href)}">${esc(n)}</a>` : esc(n)}</div>`).join('');
        const itemHeight = reel.offsetHeight || 1;
        gsap.fromTo(track, { y: 0 }, {
          y: -(seq.length - 1) * itemHeight, duration: 1 + i * 0.2, ease: 'power2.out', delay: i * 0.12,
          onComplete: () => { track.innerHTML = `<div class="quiz-reel-item"><a href="${esc(href)}">${esc(finalName)}</a></div>`; track.style.transform = ''; },
        });
      });
    });
  }

  renderQuiz();
  mountQuizDealIn(mount);
}

// Not pinned (interactive form). One-shot: the whole quiz block deals in as it enters the section, then
// settles by the time it reaches mid-viewport. Only the mount's own y/rotate move — nothing inside it
// (question text, options, results) is ever touched, so it stays fully readable throughout.
function mountQuizDealIn(mount) {
  return scrubOnEntry(mount, tl => {
    tl.fromTo(mount, { y: 46, rotate: -3 }, { y: 0, rotate: 0, ease: 'power2.out' });
  }, { start: 'top 90%', end: 'top 50%', scrub: 0.5 });
}

// ============================================================================
// 3. Risk vs. access map — inline SVG scatter, same encoding as the stable hub's Chart.js bubble chart
// (site/js/charts.js:renderBubbleChart): x = risk, y = liquidity, r = complexity, colour = diverging
// growth/income. The <details> table stays as the accessible/authoritative alternative, unchanged rows,
// and lives OUTSIDE the pinned element (motion.js's scene() only ever pins the scatter itself).
// ============================================================================

async function mountGalaxy(data, shell) {
  const mount = document.getElementById('galaxy-mount');
  const products = data.products.entries;
  if (!products.length) {
    emptyStatePanel(mount, { title: 'No product data yet', detail: 'Run npm run scrape to generate data, then reload this page.' });
    return;
  }

  // Deterministic ring-offset for products that share the exact same (risk, liquidity) cell, so bubbles
  // never fully overlap. Grouped and ordered by id so the layout never depends on Remix/shuffle order.
  const byCell = new Map();
  const sortedProducts = products.slice().sort((a, b) => a.id.localeCompare(b.id));
  sortedProducts.forEach(p => {
    const key = `${p.riskLevel}:${p.liquidity}`;
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key).push(p);
  });
  const points = sortedProducts.map(p => {
    const key = `${p.riskLevel}:${p.liquidity}`;
    const cell = byCell.get(key);
    const n = cell.length;
    const i = cell.indexOf(p);
    const jitterR = n > 1 ? 10 : 0;
    const angle = n > 1 ? (2 * Math.PI * i) / n : 0;
    const cx = scatterX(p.riskLevel) + Math.cos(angle) * jitterR;
    const cy = scatterY(p.liquidity) + Math.sin(angle) * jitterR;
    const r = scatterR(p.complexity);
    return { entry: p, cx, cy, r, color: divergingColorRgb(p.growthVsDividend) };
  });

  const gridXs = [1, 2, 3, 4, 5].map(v => scatterX(v));
  const gridYs = [1, 2, 3, 4, 5].map(v => scatterY(v));
  const axisX0 = scatterX(1), axisX1 = scatterX(5);
  const axisY0 = scatterY(1), axisY1 = scatterY(5);

  // Each point is one self-contained group (circle, an optional leader line, its label) — NOT split
  // into separate bubbles/labels groups as an earlier version had it. `layoutScatterLabels` below
  // repositions every label to a spot that overlaps neither another label NOR any bubble (not just its
  // own), so paint order no longer matters for "never covered" (law 6) — nesting instead buys a real
  // CSS win: `.scatter-point:hover`/`:focus` can reach its OWN label directly (used for the mobile
  // hover-reveal density fallback in hub.css) without needing `:has()` sibling tricks.
  const bubblesSvg = points.map(pt => `
    <g class="scatter-point" tabindex="0" role="button" data-entry-id="${esc(pt.entry.id)}"
       aria-label="${esc(pt.entry.name)}: risk ${pt.entry.riskLevel}, liquidity ${pt.entry.liquidity}${typeof pt.entry.growthVsDividend === 'number' ? `, ${pt.entry.growthVsDividend}% growth-weighted` : ''}">
      <circle class="scatter-bubble" cx="${pt.cx.toFixed(1)}" cy="${pt.cy.toFixed(1)}" r="${pt.r.toFixed(1)}" fill="rgba(${pt.color.r | 0}, ${pt.color.g | 0}, ${pt.color.b | 0}, 0.8)"></circle>
      <line class="scatter-leader" x1="${pt.cx.toFixed(1)}" y1="${pt.cy.toFixed(1)}" x2="${pt.cx.toFixed(1)}" y2="${pt.cy.toFixed(1)}" hidden></line>
      <text class="scatter-label" x="${(pt.cx + pt.r + 4).toFixed(1)}" y="${pt.cy.toFixed(1)}" dominant-baseline="middle">${esc(pt.entry.name)}</text>
    </g>`).join('');
  const gridSvg = gridXs.map(x => `<line class="scatter-grid" x1="${x.toFixed(1)}" y1="${axisY0}" x2="${x.toFixed(1)}" y2="${axisY1}"></line>`).join('')
    + gridYs.map(y => `<line class="scatter-grid" x1="${axisX0}" y1="${y.toFixed(1)}" x2="${axisX1}" y2="${y.toFixed(1)}"></line>`).join('');

  const legend = `<p class="chart-legend-text">${icon('info', { size: 14 })} X-axis: risk (1 very low – 5 very high). Y-axis: liquidity, how quickly you can get your money out (1 locked-in – 5 instant). Bubble size: complexity. Colour: teal leans toward capital growth, amber leans toward income.</p>`;

  mount.innerHTML = `
    <div class="scatter-wrap" id="scatter-wrap">
      <svg class="scatter-svg" viewBox="0 0 ${SCATTER_VB_W} ${SCATTER_VB_H}" role="img" aria-label="Products plotted by risk, liquidity, complexity and return mix — see the table below for exact values">
        <g class="scatter-axes">
          ${gridSvg}
          <line class="scatter-axis" id="scatter-axis-x" x1="${axisX0}" y1="${axisY0}" x2="${axisX1}" y2="${axisY0}"></line>
          <line class="scatter-axis" id="scatter-axis-y" x1="${axisX0}" y1="${axisY0}" x2="${axisX0}" y2="${axisY1}"></line>
        </g>
        <g class="scatter-bubbles">${bubblesSvg}</g>
      </svg>
    </div>
    ${legend}
    ${buildTableDetails(['Product', 'Risk', 'Liquidity', 'Complexity', 'Return mix'], bubbleTableRows(products))}`;

  layoutScatterLabels(mount, points);

  mount.querySelectorAll('.scatter-point').forEach(g => {
    const open = () => {
      const entry = products.find(p => p.id === g.dataset.entryId);
      if (entry) openBubbleModal(entry, shell);
    };
    g.addEventListener('click', open);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  mount.querySelector('details')?.addEventListener('toggle', refreshScenes);

  mountScatterScene(document.getElementById('scatter-wrap'));
}

// Collision-avoidance label placement (found necessary in review: the naive "always place 4 units right
// of the bubble" default let long product names overlap their neighbours). Two-pass: the labels were
// already inserted at that naive default above so `getComputedTextLength()` reflects their REAL rendered
// width (font metrics aren't guessable up front); this pass tries a fixed set of candidate spots around
// each bubble in priority order (right, left, above/below, then the diagonals) and keeps the first one
// that overlaps neither an already-placed label NOR ANY bubble (not just its own) — so paint order can
// never matter for coverage. A short leader line is drawn whenever a label didn't land at the default
// spot, so it's still obvious which bubble it names.
function layoutScatterLabels(mount, points) {
  const PAD = 3;
  const GAP = 1.6;
  const LABEL_H = 9.6; // ~1.13em at the 8.5px font-size in visual.css/hub.css, dominant-baseline:middle
  const bounds = { left: PAD, right: SCATTER_VB_W - PAD, top: PAD, bottom: SCATTER_VB_H - PAD };

  function overlaps(a, b) {
    return !(a.right + GAP < b.left || b.right + GAP < a.left || a.bottom + GAP < b.top || b.bottom + GAP < a.top);
  }
  function withinBounds(r) {
    return r.left >= bounds.left && r.right <= bounds.right && r.top >= bounds.top && r.bottom <= bounds.bottom;
  }
  function rectFor(x, y, anchor, w) {
    const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
    return { left, right: left + w, top: y - LABEL_H / 2, bottom: y + LABEL_H / 2, x, y, anchor };
  }

  // Bubbles are fixed obstacles from the start; each accepted label rect is added too, so later points
  // avoid earlier labels as well.
  const obstacles = points.map(pt => ({ left: pt.cx - pt.r, right: pt.cx + pt.r, top: pt.cy - pt.r, bottom: pt.cy + pt.r }));

  const groups = mount.querySelectorAll('.scatter-point');
  points.forEach((pt, i) => {
    const g = groups[i];
    const label = g?.querySelector('.scatter-label');
    const leader = g?.querySelector('.scatter-leader');
    if (!label) return;
    const w = label.getComputedTextLength();
    const { cx, cy, r } = pt;
    const defaultRect = rectFor(cx + r + 4, cy, 'start', w);

    const candidates = [
      defaultRect,
      rectFor(cx - r - 4, cy, 'end', w),
      rectFor(cx + r + 4, cy - LABEL_H - 0.5, 'start', w),
      rectFor(cx + r + 4, cy + LABEL_H + 0.5, 'start', w),
      rectFor(cx - r - 4, cy - LABEL_H - 0.5, 'end', w),
      rectFor(cx - r - 4, cy + LABEL_H + 0.5, 'end', w),
      rectFor(cx, cy - r - LABEL_H * 0.7, 'middle', w),
      rectFor(cx, cy + r + LABEL_H * 0.9, 'middle', w),
    ];

    let chosen = candidates.find(c => withinBounds(c) && !obstacles.some(o => overlaps(c, o))) || null;
    if (!chosen) {
      // Bounded incremental fallback — push the right-side default down in small steps until clear or
      // out of room. 18 points in this much space: expected to rarely if ever run.
      let cand = defaultRect;
      let tries = 0;
      while (tries < 48 && (!withinBounds(cand) || obstacles.some(o => overlaps(cand, o)))) {
        cand = rectFor(cx + r + 4, cand.y + LABEL_H * 0.55, 'start', w);
        tries += 1;
      }
      chosen = cand;
    }

    label.setAttribute('x', chosen.x.toFixed(1));
    label.setAttribute('y', chosen.y.toFixed(1));
    label.setAttribute('text-anchor', chosen.anchor);

    const isDefault = chosen.anchor === 'start' && Math.abs(chosen.x - defaultRect.x) < 0.5 && Math.abs(chosen.y - defaultRect.y) < 0.5;
    if (!isDefault && leader) {
      leader.setAttribute('x2', chosen.x.toFixed(1));
      leader.setAttribute('y2', chosen.y.toFixed(1));
      leader.removeAttribute('hidden');
    }

    obstacles.push(chosen);
  });
}

// Pinned: axes/gridlines draw (DrawSVG), then bubbles burst from the chart centre to their real
// positions (transform only — final cx/cy/r are already correct in the DOM), then labels slide in just
// short of it, never below opacity 0.85 (law 6 — these are the product names, not decoration).
function mountScatterScene(wrap) {
  if (!wrap) return;
  scene(wrap, (tl, { gsap, isMobile }) => {
    const centerX = (SCATTER_PAD_L + (SCATTER_VB_W - SCATTER_PAD_R)) / 2;
    const centerY = (SCATTER_PAD_T + (SCATTER_VB_H - SCATTER_PAD_B)) / 2;

    if (window.DrawSVGPlugin) {
      const lines = wrap.querySelectorAll('.scatter-axis, .scatter-grid');
      gsap.set(lines, { drawSVG: '0%' });
      tl.to(lines, { drawSVG: '100%', ease: 'none', stagger: 0.01 }, 0);
    }

    // No `svgOrigin` here (found in review to produce wildly wrong matrices on this markup — GSAP's
    // custom-origin compensation blew up combined with `scale`). `.scatter-point`'s own CSS
    // (`transform-box: fill-box; transform-origin: center`) already pivots any scale around each
    // point's own bounding box, which is exactly the burst-to-its-own-spot effect this needs, so plain
    // `x`/`y`/`scale` (no origin option) is enough.
    // An explicit (shorter than GSAP's 0.5 default) duration so every bubble has actually LANDED before
    // labels start appearing below — found in review: with the default duration, bubbles were still
    // converging on their final spots while labels (which start mid-flight, opacity ≥0.85) were already
    // visible, so an in-transit bubble/point could briefly slide across an already-settled neighbour's
    // label text. Latest start (i=24) + duration still finishes at 0.3+0.24+0.3=0.84.
    wrap.querySelectorAll('.scatter-point').forEach((g, i) => {
      const circle = g.querySelector('.scatter-bubble');
      if (!circle) return;
      const cx = Number(circle.getAttribute('cx'));
      const cy = Number(circle.getAttribute('cy'));
      tl.fromTo(g, { x: centerX - cx, y: centerY - cy, scale: 0.2 },
        { x: 0, y: 0, scale: 1, ease: 'none', duration: 0.25 }, 0.3 + Math.min(i, 17) * 0.03);
    });

    // Below 768px, hub.css defaults labels to opacity:0 (hover/focus-reveal — see its comment) and Calm/
    // reduced-motion forces them back to 1 with `!important`. Animating opacity here too would fight
    // both of those with an inline style, so the entrance fade is desktop-only; mobile labels are purely
    // CSS-driven. Starts at 1.1 — after every bubble above has actually landed (last one: 0.3+17*0.03+
    // 0.25=1.06) — so no in-flight point can still cross paths with an already-settled label.
    if (!isMobile) {
      const labels = wrap.querySelectorAll('.scatter-label');
      tl.fromTo(labels, { opacity: 0.85, x: -8 }, { opacity: 1, x: 0, ease: 'none', stagger: 0.01 }, 1.1);
    }
  }, { pin: true, length: 2 });
}

function openBubbleModal(entry, shell) {
  const body = document.createElement('div');
  body.innerHTML = `
    <h2 id="scatter-proscons-title" class="kinetic display-md">${esc(entry.name)}</h2>
    <div class="proscons-grid">
      <div class="proscons-col proscons-pros">
        <h3>${icon('check', { size: 16 })} Pros</h3>
        <ul>${(entry.pros || []).map(p => `<li>${esc(p)}</li>`).join('') || '<li class="muted">Not documented yet.</li>'}</ul>
      </div>
      <div class="proscons-col proscons-cons">
        <h3>${icon('warning', { size: 16 })} Cons</h3>
        <ul>${(entry.cons || []).map(c => `<li>${esc(c)}</li>`).join('') || '<li class="muted">Not documented yet.</li>'}</ul>
      </div>
    </div>
    ${entry.bestFor ? `<p class="best-for"><strong>Best for:</strong> ${esc(entry.bestFor)}</p>` : ''}
    ${entry.eligibility ? `<p class="eligibility"><strong>Eligibility:</strong> ${esc(entry.eligibility)}</p>` : ''}
    <div class="modal-actions"><a class="btn btn-primary" href="products.html#${esc(entry.id)}">${icon('external', { size: 16 })} See full card</a></div>`;
  shell.openModal(body, { labelledBy: 'scatter-proscons-title' });
  shell.glossaryTooltips(body);
}

// ============================================================================
// 4. World cards — same teaser text/logic as stable (content.js:teaserData), foil tilt cards
// ============================================================================

function mountWorldCards(data) {
  const mount = document.getElementById('world-cards');
  mount.innerHTML = Object.entries(WORLD_META).map(([world, meta]) => {
    const count = data[world].entries.length;
    const t = teaserData(data, world);
    let teaser;
    if (t?.kind === 'yield') {
      teaser = `Top low-risk yield: <strong>${esc(t.entryName)}</strong> — ${t.value}%${t.label ? ` <span class="muted">(${esc(t.label)})</span>` : ''}`;
    } else if (t?.kind === 'cheapest') {
      teaser = `${crown('Cheapest right now')} Cheapest ${esc(t.groupLabel.toLowerCase())} for ${esc(t.presetLabel)}: <strong>${esc(t.name)}</strong> — ${esc(t.totalText)} over ${t.years} years`;
    } else {
      teaser = isEmpty(data) ? 'Fee data not loaded yet' : 'Fee data coming soon';
    }
    // The fan-out/flip scene (below) animates `.world-card-slot`, never the `<a>` itself — fx.js writes
    // its own inline `transform` on `[data-tilt]`/`[data-magnetic]` elements (the anchor), and animating
    // both from two places would fight over the same CSS property.
    return `
      <div class="world-card-slot">
        <a class="foil-card world-card world-${world}" data-tilt data-magnetic href="${esc(meta.href)}">
          <h3>${icon(meta.icon, { size: 22 })} ${esc(meta.tagline)}</h3>
          <span class="count">${count} ${count === 1 ? 'entry' : 'entries'}</span>
          <span class="teaser">${teaser}</span>
        </a>
      </div>`;
  }).join('');
  mountWorldCardsScene(mount);
}

// Pinned: the three cards start gathered toward the grid's centre (only as far as ≤55° rotateY
// foreshortening allows without any card's text overlapping another's — there is no separate back face
// on these cards, so capping well under 90° also guarantees nothing ever reads as blank/edge-on) and fan
// out into their authored grid position. Text is never hidden — only x/y/rotateY/scale of the slot move.
function mountWorldCardsScene(mount) {
  scene(mount, (tl, { gsap }) => {
    const slots = Array.from(mount.querySelectorAll('.world-card-slot'));
    if (!slots.length) return;
    const rects = slots.map(s => s.getBoundingClientRect());
    const cx = rects.reduce((sum, r) => sum + r.left + r.width / 2, 0) / rects.length;
    const cy = rects.reduce((sum, r) => sum + r.top + r.height / 2, 0) / rects.length;
    slots.forEach((slot, i) => {
      const r = rects[i];
      const dx = cx - (r.left + r.width / 2);
      const dy = cy - (r.top + r.height / 2);
      tl.fromTo(slot,
        { x: dx * 0.65, y: dy * 0.65, rotateY: i % 2 === 0 ? -52 : 52, scale: 0.92, transformPerspective: 900 },
        { x: 0, y: 0, rotateY: 0, scale: 1, ease: 'none' },
        0);
    });
  }, { pin: true, length: 1 });
}

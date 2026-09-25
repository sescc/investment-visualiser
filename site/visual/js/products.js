// products.js — the visual edition's Products page (site/visual/products.html). A pinned
// horizontal-scroll deck of holographic trading cards, one per product, grouped into "booster pack"
// bands by category; a scrubbable risk thermometer that highlights the deck and re-forms the WebGL
// stage; a growth↔income spectrum scrubber; and liquid-fill "where the return comes from" columns.
//
// Same content as the stable page (site/products.html + site/js/products.js): same hero chip/heading/
// intro copy (verbatim), same category filter + beginner-only toggle, same per-product summary/
// analogy/meters/growth-vs-income bar/return-driver chips/fee line/pros/cons/steps/bestFor/
// eligibility/official link, same "Compare what it costs to buy →" links, same empty-state copy.
// Fee text/freshness badges are thin renderers over feeview.js's feeSummary/freshnessView — identical
// wording to components.js's feeLineInner/freshnessBadge — never a hand-typed number (see file's own
// grep-yourself rule in CLAUDE.md/the task brief). Local helpers below are re-implemented rather than
// imported from site/js/components.js or site/js/charts.js for the same reason hub.js gives in its
// header: those two modules import each other and would drag the stable page-chrome bundle in here.

import { getData } from '../../js/data.js';
import { feeSummary, freshnessView } from '../../js/feeview.js';
import { icon } from '../../js/icons.js';
import { mountShell, esc } from './shell.js';
import { motionAllowed, motionScope, whenGsap, splitHeadline, DEBUG } from './motion.js';
import { playBlip } from './fx.js';
import { onRemix, mulberry32 } from './chaos.js';

function h(strings, ...vals) {
  return strings.reduce((acc, s, i) => acc + s + (vals[i] ?? ''), '');
}

// ============================================================================
// Local helpers (see file header for why these aren't imported from stable modules)
// ============================================================================

function buildTableDetails(headers, rows) {
  return h`
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

function emptyStatePanel(container, { title = 'No data yet', detail = 'Run the scraper to generate data.' } = {}) {
  container.innerHTML = h`
    <div class="panel" style="text-align:center">
      ${icon('warning', { size: 32 })}
      <h3>${esc(title)}</h3>
      <p>${esc(detail)}</p>
      <code>npm run scrape</code>
    </div>`;
}

// Same badge states/wording as stable's components.js:freshnessBadge, over the same feeview.js data.
function FRESH_META(state) {
  return { live: { cls: 'badge-live', icon: 'check' }, aging: { cls: 'badge-aging', icon: 'info' },
    stale: { cls: 'badge-stale', icon: 'warning' }, missing: { cls: 'badge-missing', icon: 'warning' } }[state];
}
function freshnessBadge(component) {
  const view = freshnessView(component);
  const meta = FRESH_META(view.state);
  const asOf = view.asOfText ? ` · ${view.asOfText}` : '';
  const badge = h`<span class="badge ${meta.cls}">${icon(meta.icon, { size: 12 })} ${view.label}${asOf}</span>`;
  if (!view.href) return badge;
  return h`<a class="badge-link" href="${esc(view.href)}" target="_blank" rel="noopener" title="Source: ${esc(view.href)}">${badge}</a>`;
}

// Same wording as stable's components.js:renderFeeLine, over the same feeview.js:feeSummary view-model.
function renderFeeLine(summary) {
  switch (summary.kind) {
    case 'yield-range': {
      const { low, best, yields } = summary;
      return h`<span class="fee-line" title="${esc(yields.map(y => `${y.label || 'Rate'}: ${y.value}%`).join('\n'))}">${icon('bill', { size: 14 })} Yield ${low}–${best.value}% <span class="muted">(best: ${esc(best.label || '')})</span> ${freshnessBadge(best)}</span>`;
    }
    case 'yield':
      return h`<span class="fee-line">${icon('bill', { size: 14 })} Yield ${summary.comp.value}% ${freshnessBadge(summary.comp)}</span>`;
    case 'exchange':
      return h`<span class="fee-line">${icon('bill', { size: 14 })} ${summary.comps.map(f => `${esc(f.label)} ${f.value}%`).join(' · ')} <span class="muted">per trade, on top of broker fees</span> ${freshnessBadge(summary.oldest)}</span>`;
    case 'from':
      return h`<span class="fee-line">${icon('bill', { size: 14 })} From ${summary.comp.value}${summary.unit} ${freshnessBadge(summary.comp)}</span>`;
    case 'via-broker':
      return h`<span class="fee-line muted">${icon('bill', { size: 14 })} Fees via your broker →</span>`;
    case 'untracked':
    default:
      return h`<span class="fee-line muted">${icon('bill', { size: 14 })} Fees not tracked yet</span>`;
  }
}
function feeLine(entry) {
  const summary = feeSummary(entry);
  const line = renderFeeLine(summary);
  if (!summary.compareLink) return line;
  return h`${line} <a class="fee-compare-link" href="${summary.compareLink.href}">Compare what it costs to buy → ${esc(summary.compareLink.groupLabel.toLowerCase())}</a>`;
}

function meterDots(value, max = 5, label = '') {
  const v = Math.max(0, Math.min(max, Math.round(value || 0)));
  const dots = Array.from({ length: max }, (_, i) => `<span class="dot${i < v ? ' is-filled' : ''}"></span>`).join('');
  return h`<div class="meter" role="img" aria-label="${esc(label)}: ${v} of ${max}"><span class="meter-dots">${dots}</span></div>`;
}

function gdBar(value) {
  const v = Math.max(0, Math.min(100, value ?? 50));
  return h`
    <div class="gd-bar" role="img" aria-label="Return mix: ${v}% capital growth, ${100 - v}% income">
      <div class="gd-track"><div class="gd-marker" style="left:${v}%"></div></div>
      <div class="gd-labels"><span>Income</span><span>Growth</span></div>
    </div>`;
}

const RETURN_DRIVER_LABEL = { 'capital-growth': 'Capital growth', dividends: 'Dividends', interest: 'Interest', coupon: 'Coupon', none: 'No return' };
function returnDriverChips(drivers) {
  if (!drivers?.length) return '';
  return h`<div class="chip-row">${drivers.map(d => `<span class="chip chip-sm">${esc(RETURN_DRIVER_LABEL[d] || d)}</span>`).join('')}</div>`;
}

function divergingColor(v) {
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const growth = cssVar('--growth') || '#0f8b8d';
  const income = cssVar('--income') || '#d98a12';
  const neutral = cssVar('--muted') || '#8a909c';
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 128, g: 128, b: 128 };
  }
  function lerp(aHex, bHex, t) {
    const a = hexToRgb(aHex), b = hexToRgb(bHex);
    return `rgb(${Math.round(a.r + (b.r - a.r) * t)}, ${Math.round(a.g + (b.g - a.g) * t)}, ${Math.round(a.b + (b.b - a.b) * t)})`;
  }
  const x = Math.max(0, Math.min(100, v ?? 50));
  return x >= 50 ? lerp(neutral, growth, (x - 50) / 50) : lerp(income, neutral, x / 50);
}

const SPECTRUM_TIERS = ['top2', 'top1', 'bottom1', 'bottom2'];

// Module-level page state (read/written by the functions below; declared here, ahead of Boot at the
// bottom of this file, so nothing is ever read out of its temporal-dead-zone at call time — every
// `let`/`const` a function closes over must already have run by the time Boot calls that function).
let activeCategory = 'all';
let beginnerOnly = false;
let riskFilter = 0; // 0 = highlight nothing (all shown equally)
let dealOrder = []; // current display order of product ids (shuffled by Remix); set in Boot
let deckScrollScope = null;
let stRefresh = null;

// ============================================================================
// 1. Hero
// ============================================================================

function mountHero() {
  splitHeadline(document.getElementById('hero-headline'), {});
}

// ============================================================================
// 2. Controls — category filter chips + beginner toggle (same set/behaviour as stable), risk thermometer
// ============================================================================

function mountControls() {
  renderFilters();
  const range = document.getElementById('risk-range');
  const readout = document.getElementById('therm-readout');
  range.addEventListener('input', () => {
    riskFilter = Number(range.value) || 0;
    readout.textContent = riskFilter === 0 ? 'Showing every risk level' : `Highlighting risk level ${riskFilter}`;
    applyRiskHighlight();
    const formations = ['nebula', 'grid', 'rings', 'rain', 'helix'];
    shellHandle.getStage()?.setFormation(riskFilter === 0 ? 'nebula' : formations[riskFilter % formations.length]);
    playBlip({ freq: 440 + riskFilter * 60 });
  });
}

function renderFilters() {
  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
  const mount = document.getElementById('filters-mount');
  mount.innerHTML = categories.map(c =>
    `<button type="button" class="chip chip-btn${c === activeCategory ? ' is-active' : ''}" data-cat="${esc(c)}">${c === 'all' ? 'All categories' : esc(c)}</button>`
  ).join('') + `<button type="button" class="chip chip-btn${beginnerOnly ? ' is-active' : ''}" data-action="toggle-beginner">Beginner-friendly only</button>`;

  mount.querySelectorAll('[data-cat]').forEach(btn => btn.addEventListener('click', () => { activeCategory = btn.dataset.cat; renderFilters(); rebuildDeck(); }));
  mount.querySelector('[data-action="toggle-beginner"]').addEventListener('click', () => { beginnerOnly = !beginnerOnly; renderFilters(); rebuildDeck(); });
}

function filtered() {
  const byOrder = dealOrder.map(getEntry).filter(Boolean);
  return byOrder.filter(p =>
    (activeCategory === 'all' || p.category === activeCategory) &&
    (!beginnerOnly || (p.complexity ?? 5) <= 2));
}

function applyRiskHighlight() {
  document.querySelectorAll('.trading-card').forEach(card => {
    const risk = Number(card.dataset.risk);
    const active = riskFilter !== 0;
    card.classList.toggle('is-risk-match', active && risk === riskFilter);
    card.classList.toggle('is-risk-dim', active && risk !== riskFilter);
  });
}

// ============================================================================
// 3. Growth ↔ income spectrum (same data/behaviour as stable's charts.js:renderSpectrumTrack)
// ============================================================================

function mountSpectrum() {
  const mount = document.getElementById('spectrum-mount');
  const sorted = products.slice().sort((a, b) => (a.growthVsDividend ?? 50) - (b.growthVsDividend ?? 50));
  let lastV = null, run = 0;
  mount.innerHTML = `
    <div class="spectrum" role="img" aria-label="Products plotted from pure income to pure capital growth">
      <div class="spectrum-track"></div>
      ${sorted.map(p => {
        const v = p.growthVsDividend ?? 50;
        if (lastV !== null && Math.abs(v - lastV) <= 3) run += 1; else run = 0;
        lastV = v;
        const stagger = SPECTRUM_TIERS[run % SPECTRUM_TIERS.length];
        return `<button type="button" class="spectrum-point spectrum-${stagger}" style="left:calc(37px + (100% - 74px) * ${v} / 100); --dot-color:${divergingColor(v)}" data-entry-id="${esc(p.id)}" aria-label="${esc(p.name)}: ${v}% growth">
          <span class="spectrum-dot"></span><span class="spectrum-tag">${esc(p.name)}</span>
        </button>`;
      }).join('')}
      <div class="spectrum-ends"><span>Income</span><span>Growth</span></div>
    </div>
    ${buildTableDetails(['Product', 'Growth mix'], sorted.map(p => [p.name, `${p.growthVsDividend ?? 50}% growth / ${100 - (p.growthVsDividend ?? 50)}% income`]))}`;

  mount.querySelectorAll('.spectrum-point').forEach(btn => {
    const on = v => document.querySelectorAll(`.trading-card[data-entry-id="${btn.dataset.entryId}"]`).forEach(el => el.classList.toggle('is-highlight', v));
    btn.addEventListener('mouseenter', () => on(true));
    btn.addEventListener('mouseleave', () => on(false));
    btn.addEventListener('focus', () => on(true));
    btn.addEventListener('blur', () => on(false));
  });
}

// ============================================================================
// 4. The deck — pinned horizontal scroll (desktop+motion) / native scroll-snap carousel (phone) /
//    readable grid (Calm or reduced motion). Booster-pack bands group cards by category.
// ============================================================================

function packGroups(list) {
  const order = [];
  const byCat = new Map();
  list.forEach(p => {
    const cat = p.category || 'Other';
    if (!byCat.has(cat)) { byCat.set(cat, []); order.push(cat); }
    byCat.get(cat).push(p);
  });
  return order.map(cat => ({ category: cat, items: byCat.get(cat) }));
}

function cardFrontHtml(entry) {
  const showGd = typeof entry.growthVsDividend === 'number';
  return h`
    <div class="tc-face tc-front">
      <div class="tc-head">
        <span class="tc-icon">${icon(entry.icon || 'chart', { size: 26 })}</span>
        <div>
          <h3 class="tc-title kinetic display-md">${esc(entry.name)}</h3>
          <p class="tc-analogy">${esc(entry.analogy || '')}</p>
        </div>
      </div>
      <p class="tc-summary">${esc(entry.summary)}</p>
      <div class="meter-row">
        ${meterDots(entry.riskLevel, 5, 'Risk')}<span class="meter-label">Risk</span>
        ${meterDots(entry.liquidity, 5, 'Liquidity')}<span class="meter-label">Liquidity</span>
        ${meterDots(entry.complexity, 5, 'Complexity')}<span class="meter-label">Complexity</span>
      </div>
      ${showGd ? gdBar(entry.growthVsDividend) : ''}
      ${returnDriverChips(entry.returnDrivers)}
      <div class="tc-fee">${feeLine(entry)}</div>
      <div class="tc-actions">
        <button type="button" class="btn btn-ghost" data-action="flip" data-magnetic>${icon('info', { size: 16 })} Pros &amp; cons</button>
        <button type="button" class="btn btn-primary" data-action="quest" data-magnetic>${icon('key', { size: 16 })} How to start</button>
      </div>
    </div>`;
}

function cardBackHtml(entry) {
  return h`
    <div class="tc-face tc-back" hidden>
      <h3 class="kinetic display-md">${esc(entry.name)}</h3>
      <div class="proscons-grid">
        <div class="proscons-col proscons-pros">
          <h4>${icon('check', { size: 14 })} Pros</h4>
          <ul>${(entry.pros || []).map(p => `<li>${esc(p)}</li>`).join('') || '<li class="muted">Not documented yet.</li>'}</ul>
        </div>
        <div class="proscons-col proscons-cons">
          <h4>${icon('warning', { size: 14 })} Cons</h4>
          <ul>${(entry.cons || []).map(c => `<li>${esc(c)}</li>`).join('') || '<li class="muted">Not documented yet.</li>'}</ul>
        </div>
      </div>
      ${entry.bestFor ? `<p class="best-for"><strong>Best for:</strong> ${esc(entry.bestFor)}</p>` : ''}
      ${entry.eligibility ? `<p class="eligibility"><strong>Eligibility:</strong> ${esc(entry.eligibility)}</p>` : ''}
      <button type="button" class="btn btn-ghost" data-action="unflip">${icon('check', { size: 16 })} Back to card</button>
    </div>`;
}

function cardHtml(entry) {
  return h`
    <article class="trading-card foil-card" data-tilt data-entry-id="${esc(entry.id)}" data-risk="${entry.riskLevel ?? ''}" data-category="${esc(entry.category || '')}" id="card-${esc(entry.id)}">
      <div class="tc-inner">
        ${cardFrontHtml(entry)}
        ${cardBackHtml(entry)}
      </div>
    </article>`;
}

function packBandHtml(category, count, index) {
  return h`
    <div class="pack-band" style="--pack-i:${index}">
      <span class="pack-band-label kinetic">${esc(category)}</span>
      <span class="pack-band-count">${count} ${count === 1 ? 'card' : 'cards'}</span>
    </div>`;
}

function mountDeck() {
  rebuildDeck();
  deckScrollScope = motionScope(() => setupDeckMotion());
}

function rebuildDeck({ entrance } = {}) {
  const track = document.getElementById('deck-track');
  const list = filtered();
  if (!list.length) {
    track.innerHTML = `<p class="muted" style="padding:24px">No products match these filters.</p>`;
  } else {
    const groups = packGroups(list);
    track.innerHTML = groups.map((g, i) => packBandHtml(g.category, g.items.length, i) + g.items.map(cardHtml).join('')).join('');
  }
  wireDeckCards(track);
  applyRiskHighlight();
  stRefresh?.();
  playEntrance(entrance || shellHandle.roll?.entrance);
}

function wireDeckCards(root) {
  root.querySelectorAll('[data-action="flip"]').forEach(btn => btn.addEventListener('click', () => flipCard(btn.closest('.trading-card'), true)));
  root.querySelectorAll('[data-action="unflip"]').forEach(btn => btn.addEventListener('click', () => flipCard(btn.closest('.trading-card'), false)));
  root.querySelectorAll('[data-action="quest"]').forEach(btn => btn.addEventListener('click', () => {
    const entry = getEntry(btn.closest('.trading-card')?.dataset.entryId);
    if (entry) openQuestModal(entry);
  }));
}

// Animates `.tc-inner` (a plain child div), never `.trading-card` itself — that outer element carries
// `data-tilt`, and fx.js's delegated pointermove handler writes its own inline `transform` directly to
// it, which would fight GSAP's transform cache if both animated the same element.
function flipCard(card, toBack) {
  if (!card) return;
  const inner = card.querySelector('.tc-inner');
  const front = card.querySelector('.tc-front');
  const back = card.querySelector('.tc-back');
  if (!motionAllowed()) { front.hidden = toBack; back.hidden = !toBack; return; }
  whenGsap().then(gsap => {
    if (!gsap || !motionAllowed()) { front.hidden = toBack; back.hidden = !toBack; return; }
    gsap.timeline()
      .to(inner, { rotateY: 90, duration: 0.22, ease: 'power1.in' })
      .add(() => {
        front.hidden = toBack; back.hidden = !toBack;
        (toBack ? back : front).querySelector('button,h3')?.focus?.({ preventScroll: true });
      })
      .set(inner, { rotateY: -90 })
      .to(inner, { rotateY: 0, duration: 0.24, ease: 'power1.out', clearProps: 'transform' });
  });
}

// ---- Entrance animation: seeded per visit via chaos.js's roll.entrance (decorative only) ----
function playEntrance(style) {
  if (!motionAllowed()) return;
  const cards = document.querySelectorAll('.trading-card');
  if (!cards.length) return;
  const VARS = {
    'fade-rise': { opacity: 0, y: 36 },
    scramble: { opacity: 0, scale: 0.82, rotate: -6 },
    'slide-scale': { opacity: 0, x: -28, scale: 0.92 },
    'flip-in': { opacity: 0, rotateY: -70 },
  };
  whenGsap().then(gsap => {
    if (!gsap || !motionAllowed()) return;
    gsap.from(cards, { ...(VARS[style] || VARS['fade-rise']), duration: 0.6, ease: 'back.out(1.6)', stagger: 0.04, clearProps: 'all' });
  });
}

// ---- Pinned horizontal scroll (desktop + motion) / native carousel (phone) / grid (Calm / reduced motion) ----
function isPhone() { return typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches; }

function setDeckMode(mode) {
  const viewport = document.getElementById('deck-viewport');
  viewport.dataset.mode = mode; // 'pinned' | 'carousel' | 'grid' — see products.css
}

function setupDeckMotion() {
  const viewport = document.getElementById('deck-viewport');
  const track = document.getElementById('deck-track');

  if (isPhone() || DEBUG.calm) {
    setDeckMode('carousel');
    stRefresh = null;
    return () => { setDeckMode('grid'); stRefresh = null; };
  }

  setDeckMode('pinned');
  let cancelled = false;
  let ctx = null;
  let st = null;
  (async () => {
    const gsap = await whenGsap();
    if (cancelled || !gsap || !window.ScrollTrigger || !motionAllowed()) { setDeckMode('carousel'); return; }
    ctx = gsap.context(() => {
      const headerH = document.getElementById('app-header')?.offsetHeight || 60;
      const tween = gsap.to(track, {
        x: () => -(track.scrollWidth - viewport.clientWidth),
        ease: 'none',
        scrollTrigger: {
          trigger: viewport,
          start: `top top+=${headerH}`,
          end: () => '+=' + Math.max(200, track.scrollWidth - viewport.clientWidth),
          scrub: 0.4,
          pin: true,
          invalidateOnRefresh: true,
        },
      });
      st = tween.scrollTrigger;
    });
    stRefresh = () => st?.refresh();
  })();
  return () => {
    cancelled = true;
    ctx?.revert();
    st = null;
    stRefresh = null;
    if (track) track.style.transform = '';
    setDeckMode('grid');
  };
}

// ============================================================================
// Sign-up quest modal — step path with a hopping token; same steps/fallback/links as stable's stepper.
// ============================================================================

function openQuestModal(entry) {
  const steps = entry.steps?.length ? entry.steps : [{ title: 'Details coming soon', detail: 'Sign-up steps for this entry have not been written yet.', link: entry.officialLink }];
  let idx = 0;
  const body = document.createElement('div');
  body.className = 'quest';
  const close = shellHandle.openModal(body, { labelledBy: 'quest-title', size: 'lg' });

  function render() {
    const step = steps[idx];
    const isLast = idx === steps.length - 1;
    body.innerHTML = h`
      <h2 id="quest-title" class="kinetic display-md">${esc(entry.name)}: sign-up quest</h2>
      <div class="quest-path" role="progressbar" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="${idx + 1}" aria-label="Step ${idx + 1} of ${steps.length}">
        <div class="quest-path-line"></div>
        ${steps.map((_, i) => `<span class="quest-node${i === idx ? ' is-current' : ''}${i < idx ? ' is-past' : ''}" style="left:${steps.length > 1 ? (i / (steps.length - 1)) * 100 : 0}%">${i + 1}</span>`).join('')}
        <span class="quest-token" aria-hidden="true" style="left:${steps.length > 1 ? (idx / (steps.length - 1)) * 100 : 0}%">${icon('coin', { size: 18 })}</span>
      </div>
      <p class="quest-count muted">Step ${idx + 1} of ${steps.length}</p>
      <div class="quest-step glass">
        <h3>${esc(step.title)}</h3>
        <p>${esc(step.detail)}</p>
        ${step.link ? `<a class="link-out" href="${esc(step.link)}" target="_blank" rel="noopener">${icon('external', { size: 14 })} Open official page</a>` : ''}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="back" ${idx === 0 ? 'disabled' : ''}>Back</button>
        ${isLast
          ? `<a class="btn btn-primary" data-magnetic href="${esc(step.link || entry.officialLink || '#')}" target="_blank" rel="noopener">${icon('external', { size: 16 })} Go to official site</a>`
          : `<button type="button" class="btn btn-primary" data-action="next" data-magnetic>Next</button>`}
      </div>`;
    body.querySelector('[data-action="back"]')?.addEventListener('click', () => { idx = Math.max(0, idx - 1); render(); });
    body.querySelector('[data-action="next"]')?.addEventListener('click', () => { idx = Math.min(steps.length - 1, idx + 1); playBlip({ freq: 600 + idx * 40 }); render(); });
  }
  render();
  shellHandle.glossaryTooltips(body);
}

// ============================================================================
// 5. Where the return comes from — liquid-fill columns (same data as stable's charts.js:
//    renderReturnSourceBars / returnSourceTableRows).
// ============================================================================

function mountReturns() {
  const mount = document.getElementById('returns-mount');
  mount.innerHTML = `
    <div class="liquid-row" id="liquid-row">
      ${products.map(p => {
        const growth = p.growthVsDividend ?? 0;
        const income = 100 - growth;
        return `
        <div class="liquid-col" data-entry-id="${esc(p.id)}">
          <div class="liquid-flask" aria-hidden="true">
            <div class="liquid-fill liquid-growth" style="--fill:${growth}%" data-fill="${growth}"></div>
            <div class="liquid-fill liquid-income" style="--fill:${income}%" data-fill="${income}"></div>
          </div>
          <p class="liquid-name">${esc(p.name)}</p>
          <p class="liquid-pct muted">${growth}% growth / ${income}% income</p>
        </div>`;
      }).join('')}
    </div>
    <div class="chip-row" style="margin-top:12px">
      <span class="chip chip-sm" style="background:var(--growth); color:#fff">Capital growth</span>
      <span class="chip chip-sm" style="background:var(--income); color:#fff">Income</span>
    </div>
    ${buildTableDetails(['Product', 'Capital growth', 'Income'], products.map(p => [p.name, `${p.growthVsDividend ?? 0}%`, `${100 - (p.growthVsDividend ?? 0)}%`]))}`;

  animateLiquid();
}

function animateLiquid() {
  const cols = document.querySelectorAll('.liquid-fill');
  if (!cols.length) return;
  if (!motionAllowed() || typeof IntersectionObserver !== 'function') {
    cols.forEach(el => { el.style.height = 'var(--fill)'; });
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const pct = Number(el.dataset.fill) || 0;
      whenGsap().then(gsap => {
        if (!gsap || !motionAllowed()) { el.style.height = 'var(--fill)'; return; }
        gsap.fromTo(el, { height: '0%' }, { height: `${pct}%`, duration: 1, ease: 'power2.out' });
      });
      io.unobserve(el);
    });
  }, { threshold: 0.2 });
  cols.forEach(el => io.observe(el));
}

// ============================================================================
// Deep link: products.html#<entryId> scrolls to and flips open that card.
// ============================================================================

function handleDeepLink() {
  const id = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  if (!id) return;
  const card = document.getElementById(`card-${id}`);
  if (!card) return;
  setTimeout(() => {
    card.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto', block: 'center', inline: 'center' });
    flipCard(card, true);
  }, 80);
}

window.addEventListener('hashchange', handleDeepLink);

function shuffle(arr, rand) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ============================================================================
// Boot — last, so every module-level `let`/`const` above has already been initialized by the time
// these calls run (function declarations are hoisted; `let`/`const` bindings are not).
// ============================================================================

const data = await getData();
const shellHandle = await mountShell({ page: 'products.html', data });
const products = data.products.entries;
const getEntry = id => products.find(e => e.id === id) || null;
dealOrder = products.map(p => p.id);

mountHero();
if (products.length) {
  mountControls();
  mountSpectrum();
  mountDeck();
  mountReturns();
  handleDeepLink();
} else {
  emptyStatePanel(document.getElementById('products-empty'), { title: 'No product data yet', detail: 'Run npm run scrape to generate data, then reload this page.' });
  document.getElementById('spectrum-section')?.remove();
  document.getElementById('returns-section')?.remove();
  document.querySelector('.controls-section')?.remove();
}

onRemix(({ seed, roll }) => {
  if (!products.length) return;
  const rand = mulberry32(seed);
  dealOrder = shuffle(products.map(p => p.id), rand);
  playBlip({ freq: 520 });
  rebuildDeck({ entrance: roll.entrance });
});

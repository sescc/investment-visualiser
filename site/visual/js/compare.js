// compare.js — the visual edition's Compare page (site/visual/compare.html). Same content and query-
// string contract as stable's site/compare.html + site/js/compare.js (search/pick up to three entries,
// the radar comparison with its <details> table, the same side-by-side facts, the site-wide fee-drag
// calculator with the same ranking/incomplete/FX rules) — staged as a "versus arena": chosen entries
// enter as fighter cards either side of a kinetic "VS", their risk/liquidity/complexity clash as
// tug-of-war bars, the radar redraws per selection, and a fee jar fills with coins as the cheapest
// provider's fee drag compounds over a scrubbable year horizon.
//
// Local helpers below (crown, freshnessBadgeHTML, feeLineHTML/feeTextFor, meterRow, emptyStatePanel,
// buildTableDetails, the radar's colour triad/axis mapping) are intentionally re-implemented rather
// than imported from site/js/components.js or site/js/charts.js, for the same reason hub.js/methods.js/
// products.js give: those two modules import each other and would drag the entire stable page-chrome
// module into this bundle. None of these helpers make a costing/ranking decision — feeSummary,
// bestFeeComponent, computeCost and rankByCost itself all still come from feeview.js/data.js/cost.js
// untouched, and the fee-drag machine itself is calc.js (owned by the methods page agent, imported
// as-is — see that file's header for its API and its own honouring of ?group=/?market=/?scenario=).
//
// Query-string contract (unchanged from stable): ?ids=<comma-separated entry ids> picks the compared
// entries; ?scenario=<preset key | compact JSON> seeds the calculator's scenario; ?group=&market=
// (from a product card's "Compare what it costs to buy →" link, or the stable/visual edition switch)
// opens the calculator on that cost group/market and is honoured by calc.js itself; #calc-mount is a
// real element id so a deep link scrolls straight to the calculator.

import { getData, allEntries, findEntry, parseQuery, buildQuery } from '../../js/data.js';
import { feeSummary, freshnessView } from '../../js/feeview.js';
import { computeCost, formatSGD, describeScenario, COST_GROUPS } from '../../js/cost.js';
import { icon } from '../../js/icons.js';
import { mountShell, esc } from './shell.js';
import { motionAllowed, motionScope, whenGsap, splitHeadline, reveal, scene, scrubOnEntry, batchReveal, scrubHeading, refreshScenes } from './motion.js';
import { playBlip } from './fx.js';
import { onRemix } from './chaos.js';
import { mountVisualCalculator } from './calc.js';

function h(strings, ...vals) {
  return strings.reduce((acc, s, i) => acc + s + (vals[i] ?? ''), '');
}

// ============================================================================
// Local helpers (see file header for why these aren't imported from stable modules)
// ============================================================================

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

// Same lookup motion.js's own (private) headerOffsetPx() does — not exported, so reimplemented here.
function headerOffsetPx() {
  const n = parseFloat(cssVar('--header-h'));
  return Number.isFinite(n) ? n : 0;
}

// Fixed 3-slot categorical order — same as stable's charts.js:CATEGORICAL_TRIAD — independent of each
// entry's own world, so dataset i always gets the same hue on the radar and in the arena.
function triadColors() { return ['--world-products', '--world-methods', '--world-brokers'].map(cssVar); }

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
const FRESH_META = { live: { cls: 'badge-live', icon: 'check' }, aging: { cls: 'badge-aging', icon: 'info' }, stale: { cls: 'badge-stale', icon: 'warning' }, missing: { cls: 'badge-missing', icon: 'warning' } };
function freshnessBadgeHTML(component) {
  const view = freshnessView(component);
  const meta = FRESH_META[view.state];
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
      return h`<span class="fee-line" title="${esc(yields.map(y => `${y.label || 'Rate'}: ${y.value}%`).join('\n'))}">${icon('bill', { size: 14 })} Yield ${low}–${best.value}% <span class="muted">(best: ${esc(best.label || '')})</span> ${freshnessBadgeHTML(best)}</span>`;
    }
    case 'yield':
      return h`<span class="fee-line">${icon('bill', { size: 14 })} Yield ${summary.comp.value}% ${freshnessBadgeHTML(summary.comp)}</span>`;
    case 'exchange':
      return h`<span class="fee-line">${icon('bill', { size: 14 })} ${summary.comps.map(f => `${esc(f.label)} ${f.value}%`).join(' · ')} <span class="muted">per trade, on top of broker fees</span> ${freshnessBadgeHTML(summary.oldest)}</span>`;
    case 'from':
      return h`<span class="fee-line">${icon('bill', { size: 14 })} From ${summary.comp.value}${summary.unit} ${freshnessBadgeHTML(summary.comp)}</span>`;
    case 'via-broker':
      return h`<span class="fee-line muted">${icon('bill', { size: 14 })} Fees via your broker →</span>`;
    case 'untracked':
    default:
      return h`<span class="fee-line muted">${icon('bill', { size: 14 })} Fees not tracked yet</span>`;
  }
}
function feeLineHTML(entry) {
  const summary = feeSummary(entry);
  const line = renderFeeLine(summary);
  if (!summary.compareLink) return line;
  return h`${line} <a class="fee-compare-link" href="${esc(summary.compareLink.href)}">Compare what it costs to buy → ${esc(summary.compareLink.groupLabel.toLowerCase())}</a>`;
}
// Plain-text version for the facts <details> table (no HTML/badges).
function feeTextFor(entry) {
  const summary = feeSummary(entry);
  switch (summary.kind) {
    case 'yield-range': return `Yield ${summary.low}–${summary.best.value}% (best: ${summary.best.label || ''})`;
    case 'yield': return `Yield ${summary.comp.value}%`;
    case 'exchange': return summary.comps.map(f => `${f.label} ${f.value}%`).join(' · ');
    case 'from': return `From ${summary.comp.value}${summary.unit}`;
    case 'via-broker': return 'Fees via your broker';
    case 'untracked':
    default: return 'Fees not tracked yet';
  }
}

function meterRow(entry) {
  const dot = (value, max, label) => {
    const v = Math.max(0, Math.min(max, Math.round(value || 0)));
    const dots = Array.from({ length: max }, (_, i) => `<span class="dot${i < v ? ' is-filled' : ''}"></span>`).join('');
    return h`<span class="meter-item"><span class="meter" role="img" aria-label="${esc(label)}: ${v} of ${max}"><span class="meter-dots">${dots}</span></span> ${esc(label)}</span>`;
  };
  return h`<div class="compare-meters">${dot(entry.riskLevel, 5, 'Risk')}${dot(entry.liquidity, 5, 'Liquidity')}${dot(entry.complexity, 5, 'Complexity')}</div>`;
}

// ============================================================================
// Radar (same axis mapping/labels/rows as stable's charts.js:radarAxes/RADAR_LABELS/radarTableRows —
// re-implemented locally per the file header, not a fee/cost decision, just risk/liquidity/complexity/
// growth-income mapping already public as data on the entry itself).
// ============================================================================

const RADAR_LABELS = ['Risk', 'Liquidity', 'Complexity', 'Income focus', 'Growth focus'];

function radarAxes(entry) {
  const hasGd = typeof entry.growthVsDividend === 'number';
  return [
    entry.riskLevel ?? 0,
    entry.liquidity ?? 0,
    entry.complexity ?? 0,
    hasGd ? (100 - entry.growthVsDividend) / 20 : 2.5,
    hasGd ? entry.growthVsDividend / 20 : 2.5,
  ];
}

function radarTableRows(entries) {
  return entries.map(e => {
    const hasGd = typeof e.growthVsDividend === 'number';
    return [e.name, e.riskLevel, e.liquidity, e.complexity, hasGd ? `${100 - e.growthVsDividend}%` : 'n/a', hasGd ? `${e.growthVsDividend}%` : 'n/a'];
  });
}

let radarChart = null;
function renderRadarChartLocal(canvas, entries) {
  if (!window.Chart) return;
  if (radarChart) { radarChart.destroy(); radarChart = null; }
  const colors = triadColors();
  radarChart = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels: RADAR_LABELS,
      datasets: entries.map((e, i) => ({
        label: e.name,
        data: radarAxes(e),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '33',
        pointBackgroundColor: colors[i % colors.length],
        borderWidth: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Animation is OFF at construction, always — Chart.js's constructor does its own initial
      // render immediately regardless of scroll position, so leaving it enabled here would play the
      // draw-in animation off-screen. mountRadarChartEntry() (below) flips `options.animation` on and
      // triggers a `reset()` + `update()` replay only once the wrapper actually scrolls into view.
      // Under !motionAllowed() nothing ever re-enables it, so the chart stays statically, fully drawn.
      animation: false,
      scales: {
        r: {
          min: 0, max: 5,
          angleLines: { color: cssVar('--glass-border') },
          grid: { color: cssVar('--glass-border') },
          pointLabels: { color: cssVar('--ink-2'), font: { family: cssVar('--font-visual-body') } },
          ticks: { display: false, stepSize: 1 },
        },
      },
      plugins: { legend: { position: 'bottom', labels: { color: cssVar('--ink-2'), font: { family: cssVar('--font-visual-body') } } } },
    },
  });
}

// ----------------------------------------------------------------------------
// Radar wrapper scroll effects (transform/opacity only — .radar-wrap is one of the decorative
// elements law 6 explicitly allows to start hidden). Two independent, re-mountable scroll effects:
// the wrapper's own scale/rotate scrub-in, and a one-time replay of the Chart.js draw animation.
// Both are destroyed and recreated on every renderRadarSection() call (new selection = new chart).
// ----------------------------------------------------------------------------
let radarWrapScrubHandle = null;
let radarChartEntryHandle = null;

function mountRadarWrapScrub(wrap) {
  radarWrapScrubHandle?.destroy();
  radarWrapScrubHandle = scrubOnEntry(wrap, tl => {
    tl.fromTo(wrap, { opacity: 0, scale: 0.82, rotate: -6 }, { opacity: 1, scale: 1, rotate: 0, ease: 'power2.out' });
  }, { start: 'top 88%', end: 'top 50%' });
}

// Not a scrub (no scrubOnEntry here): a discrete, one-shot "replay Chart.js's own draw animation once
// this wrapper enters" trigger — the chart's draw-in timing is owned by Chart.js's internal animation
// system, not a GSAP timeline this could scrub, so it stays a plain ScrollTrigger.create + onEnter.
function mountRadarChartEntry(wrap) {
  radarChartEntryHandle?.destroy();
  if (!motionAllowed()) { radarChartEntryHandle = null; return; }
  radarChartEntryHandle = motionScope(() => {
    let st = null;
    let cancelled = false;
    (async () => {
      const gsap = await whenGsap();
      if (cancelled || !gsap || !window.ScrollTrigger) return;
      st = window.ScrollTrigger.create({
        trigger: wrap,
        start: 'top 80%',
        once: true,
        onEnter: () => {
          if (!radarChart) return;
          // Enable the tween only now, then replay from a reset (pre-animation) state — see the
          // `animation: false` note in renderRadarChartLocal for why it's off until this first entry.
          radarChart.options.animation = { duration: 700, easing: 'easeOutQuart' };
          radarChart.reset();
          radarChart.update();
        },
      });
    })();
    return () => { cancelled = true; st?.kill(); };
  });
}

// ============================================================================
// Boot
// ============================================================================

const data = await getData();
const shell = await mountShell({ page: 'compare.html', data });

splitHeadline(document.getElementById('compare-headline'), {});
reveal(document.querySelector('.compare-hero'), { from: { opacity: 0, y: 24 } });

// Hero: pin ~1vh while the headline block drifts/tilts away — opacity only ever reaches 0.85, never
// lower (law 6: text is never hidden), so the heading/intro copy stay legible for the whole pin.
scene(document.querySelector('.hero-section'), tl => {
  const heroBlock = document.querySelector('.compare-hero');
  if (!heroBlock) return;
  tl.to(heroBlock, { y: -70, rotate: -4, opacity: 0.85, ease: 'none' }, 0);
}, { pin: true, length: 1 });

// Scrubbed section headings (h2.kinetic) — same treatment as every other visual-edition page.
['arena-heading', 'radar-heading', 'facts-heading', 'calc-heading'].forEach(id => {
  const el = document.getElementById(id);
  if (el) scrubHeading(el);
});

// Backdrop formation per section: backdrop.js's mountBackdrop() now auto-observes every
// `main section[data-formation]` on its own (2026-09-27 dedup — this page used to run its own
// IntersectionObserver here; folded into the shared one). Purely decorative — setFormation() is itself a
// no-op under !motionAllowed(), and this never touches content or fees.

const all = allEntries(data);
const getEntry = id => findEntry(data, id);

const { ids: initialIds, scenario: initialScenarioFromUrl } = parseQuery(location.search);
let selectedIds = initialIds.filter(id => all.some(e => e.id === id)).slice(0, 3);
let scenario = initialScenarioFromUrl;
const qp = new URLSearchParams(location.search);
const initialGroup = qp.get('group') || 'brokers';
if (['SG', 'US', 'HK'].includes(qp.get('market'))) scenario = { ...(scenario || {}), market: qp.get('market') };

if (!all.length) {
  emptyStatePanel(document.getElementById('compare-empty'), { title: 'No data yet', detail: 'Run npm run scrape to generate data, then reload this page.' });
}

function syncUrl() {
  const qs = buildQuery({ ids: selectedIds, scenario });
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

// ---------------- Picker ----------------
const input = document.getElementById('picker-input');
const suggestMount = document.getElementById('picker-suggestions');
const arenaStage = document.getElementById('arena-stage');
const clashMount = document.getElementById('clash-mount');
const radarCanvas = document.getElementById('radar-canvas');
const radarWrap = document.getElementById('radar-wrap');
const radarEmptyNote = document.getElementById('radar-empty-note');
const radarTableMount = document.getElementById('radar-table-mount');
const factsGrid = document.getElementById('facts-grid');
const factsTableMount = document.getElementById('facts-table-mount');

function renderSuggestions() {
  const term = input.value.trim().toLowerCase();
  if (!term) { suggestMount.innerHTML = ''; return; }
  const matches = all.filter(e => !selectedIds.includes(e.id) && e.name.toLowerCase().includes(term)).slice(0, 8);
  suggestMount.innerHTML = matches.map(e => h`<button type="button" class="chip chip-btn" data-add="${esc(e.id)}">+ ${esc(e.name)} <span class="muted">(${esc(e.world)})</span></button>`).join('')
    || '<span class="muted">No matches.</span>';
  suggestMount.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => {
    if (selectedIds.length >= 3) return;
    selectedIds = [...selectedIds, btn.dataset.add];
    input.value = '';
    suggestMount.innerHTML = '';
    onSelectionChange();
  }));
}
input.addEventListener('input', renderSuggestions);

// ---------------- Versus arena ----------------

function fighterCardHTML(entry, color) {
  return h`
    <article class="fighter-slot foil-card" data-tilt data-id="${esc(entry.id)}" style="--fighter-color:${color}">
      <button type="button" class="icon-btn fighter-remove" data-remove="${esc(entry.id)}" aria-label="Remove ${esc(entry.name)} from comparison">
        <span aria-hidden="true" style="font-size:16px;font-weight:800;line-height:1">&times;</span>
      </button>
      <span class="fighter-icon" style="color:${color}">${icon(entry.icon || 'chart', { size: 30 })}</span>
      <h3 class="fighter-name kinetic display-md">${esc(entry.name)}</h3>
      <span class="chip chip-sm" style="background:color-mix(in srgb, ${color} 20%, transparent); color:${color}">${esc(entry.world)}</span>
      <p class="fighter-summary">${esc(entry.summary)}</p>
      ${meterRow(entry)}
      <div class="fighter-fee">${feeLineHTML(entry)}</div>
    </article>`;
}

function wireArena() {
  arenaStage.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => {
    selectedIds = selectedIds.filter(id => id !== btn.dataset.remove);
    onSelectionChange();
  }));
}

const CLASH_DIMS = [
  { key: 'riskLevel', label: 'Risk', max: 5 },
  { key: 'liquidity', label: 'Liquidity', max: 5 },
  { key: 'complexity', label: 'Complexity', max: 5 },
];

// Each fighter's clash bar grows from one shared centre origin (50% of the track) out to its value
// — "tug-of-war bars growing from the centre" — via scaleX only (left/width/transform-origin below
// are static, set once, never animated; only `scaleX` is tweened, on scroll entry). Bars are
// decorative (law 6 explicitly allows "bars" to start hidden); the marker dots + tags + legend text
// carrying the actual values are separate, unanimated elements that stay fully readable throughout.
function clashBarHTML(dim, entry, i, colors, count) {
  const pct = Math.max(0, Math.min(100, ((entry[dim.key] || 0) / dim.max) * 100));
  const left = Math.min(50, pct);
  const width = Math.abs(pct - 50);
  const origin = pct >= 50 ? 'left' : 'right';
  const laneOffset = count > 1 ? (i - (count - 1) / 2) * 7 : 0;
  return h`<span class="clash-bar" data-clash-bar style="left:${left}%; width:${width}%; top:calc(50% + ${laneOffset}px); background:${colors[i % colors.length]}; transform-origin:${origin} center"></span>`;
}

function clashRowHTML(dim, entries, colors) {
  const valuesText = entries.map(e => `${e.name}: ${e[dim.key] ?? 0} of ${dim.max}`).join(', ');
  const legend = entries.map((e, i) => h`<span class="clash-legend-item"><span class="clash-legend-dot" style="background:${colors[i % colors.length]}"></span>${esc(e.name)} ${e[dim.key] ?? 0}</span>`).join('');
  return h`
    <div class="clash-row">
      <div class="clash-label">${esc(dim.label)}</div>
      <div class="clash-track" role="img" aria-label="${esc(dim.label)} — ${esc(valuesText)}">
        <span class="clash-center-line" aria-hidden="true"></span>
        ${entries.map((e, i) => clashBarHTML(dim, e, i, colors, entries.length)).join('')}
        ${entries.map((e, i) => h`
          <span class="clash-marker" style="left:${Math.max(0, Math.min(100, ((e[dim.key] || 0) / dim.max) * 100))}%; --marker-color:${colors[i % colors.length]}">
            <span class="clash-dot"></span><span class="clash-tag">${esc(e.name)} ${e[dim.key] ?? 0}</span>
          </span>`).join('')}
      </div>
      <div class="clash-legend muted">${legend}</div>
    </div>`;
}

let clashScrubHandle = null;
function mountClashScrub() {
  clashScrubHandle?.destroy();
  clashScrubHandle = null;
  const bars = clashMount.querySelectorAll('[data-clash-bar]');
  if (!bars.length) return;
  clashScrubHandle = scrubOnEntry(clashMount, tl => {
    tl.fromTo(bars, { scaleX: 0 }, { scaleX: 1, stagger: 0.03, ease: 'power2.out' });
  }, { start: 'top 85%', end: 'top 45%' });
}

function renderClash(entries, colors) {
  clashMount.hidden = !entries.length;
  clashMount.innerHTML = entries.length ? CLASH_DIMS.map(dim => clashRowHTML(dim, entries, colors)).join('') : '';
  mountClashScrub();
}

let currentRadarEntries = [];
function drawRadar() { renderRadarChartLocal(radarCanvas, currentRadarEntries); }
window.addEventListener('sg:themechange', () => { if (currentRadarEntries.length) drawRadar(); });

function renderRadarSection(entries) {
  currentRadarEntries = entries;
  if (!entries.length) {
    if (radarChart) { radarChart.destroy(); radarChart = null; }
    radarEmptyNote.hidden = false;
    radarTableMount.innerHTML = '';
    radarWrapScrubHandle?.destroy();
    radarWrapScrubHandle = null;
    radarChartEntryHandle?.destroy();
    radarChartEntryHandle = null;
    return;
  }
  radarEmptyNote.hidden = true;
  drawRadar();
  radarTableMount.innerHTML = buildTableDetails(['Name', ...RADAR_LABELS], radarTableRows(entries));
  mountRadarWrapScrub(radarWrap);
  mountRadarChartEntry(radarWrap);
}

function factsTableRows(entries) {
  const defs = [
    ['World', e => e.world],
    ['Summary', e => e.summary || '—'],
    ['Risk (1-5)', e => e.riskLevel ?? '—'],
    ['Liquidity (1-5)', e => e.liquidity ?? '—'],
    ['Complexity (1-5)', e => e.complexity ?? '—'],
    ['Fees', e => feeTextFor(e)],
    ['Min. amount', e => e.minAmount || '—'],
    ['Best for', e => e.bestFor || '—'],
    ['Pros', e => (e.pros || []).join('; ') || '—'],
    ['Cons', e => (e.cons || []).join('; ') || '—'],
  ];
  return defs.map(([label, fn]) => [label, ...entries.map(fn)]);
}

function factCardHTML(entry, color) {
  return h`
    <article class="fact-card panel" style="--fact-color:${color}">
      <div class="fact-head">
        <span class="fact-icon" style="color:${color}">${icon(entry.icon || 'chart', { size: 24 })}</span>
        <div>
          <h3 class="fact-name">${esc(entry.name)}</h3>
          <span class="chip chip-sm" style="background:color-mix(in srgb, ${color} 20%, transparent); color:${color}">${esc(entry.world)}</span>
        </div>
      </div>
      <p class="fact-summary">${esc(entry.summary)}</p>
      ${meterRow(entry)}
      <div class="fact-fee">${feeLineHTML(entry)}</div>
      <p class="fact-line"><strong>Min. amount:</strong> ${esc(entry.minAmount || '—')}</p>
      <p class="fact-line"><strong>Best for:</strong> ${esc(entry.bestFor || '—')}</p>
      <div class="fact-proscons">
        <div><h4>${icon('check', { size: 14 })} Pros</h4><ul>${(entry.pros || []).map(p => `<li>${esc(p)}</li>`).join('') || '<li class="muted">Not documented yet.</li>'}</ul></div>
        <div><h4>${icon('warning', { size: 14 })} Cons</h4><ul>${(entry.cons || []).map(c => `<li>${esc(c)}</li>`).join('') || '<li class="muted">Not documented yet.</li>'}</ul></div>
      </div>
    </article>`;
}

let factsRevealHandle = null;
function renderFacts(entries, colors) {
  factsRevealHandle?.destroy();
  factsRevealHandle = null;
  if (!entries.length) {
    factsGrid.innerHTML = '<p class="muted">Nothing selected yet — search above, or use the quiz on the hub page.</p>';
    factsTableMount.innerHTML = '';
    return;
  }
  factsGrid.innerHTML = entries.map((e, i) => factCardHTML(e, colors[i % colors.length])).join('');
  factsTableMount.innerHTML = buildTableDetails(['Field', ...entries.map(e => e.name)], factsTableRows(entries));
  shell.glossaryTooltips(factsGrid);
  // Text-bearing cards (names, fees, pros/cons) — batchReveal never starts these below opacity 0.85
  // (law 6) unless `decorative: true` is passed, which it isn't here.
  const cards = factsGrid.querySelectorAll('.fact-card');
  if (cards.length) factsRevealHandle = batchReveal(cards, shell.roll.entrance);
}

function renderArena() {
  const entries = selectedIds.map(id => getEntry(id)).filter(Boolean);
  const colors = triadColors();

  // Flip capture (decorative only — content is rebuilt identically whether or not this succeeds).
  const gsapReady = motionAllowed() && window.gsap;
  const FlipPlugin = gsapReady ? window.Flip : null;
  const state = FlipPlugin ? window.Flip.getState(Array.from(arenaStage.children)) : null;

  if (!entries.length) {
    arenaStage.innerHTML = '<p class="muted arena-empty">Nothing selected yet — search above, or use the quiz on the hub page.</p>';
  } else {
    arenaStage.innerHTML = entries.map((e, i) => {
      const card = fighterCardHTML(e, colors[i % colors.length]);
      return i > 0 ? `<div class="vs-type kinetic" aria-hidden="true">VS</div>${card}` : card;
    }).join('');
  }
  wireArena();
  shell.glossaryTooltips(arenaStage);

  if (state && FlipPlugin) {
    window.Flip.from(state, {
      duration: 0.55, ease: 'power2.inOut', absolute: true, nested: true,
      onEnter: els => window.gsap.fromTo(els, { opacity: 0, scale: 0.7, y: 14 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)', stagger: 0.06 }),
      onLeave: els => window.gsap.to(els, { opacity: 0, scale: 0.82, duration: 0.28 }),
    });
  }

  renderClash(entries, colors);
  renderRadarSection(entries);
  renderFacts(entries, colors);

  try { shell.getStage()?.pulse(entries[0]?.world || 'brokers'); } catch { /* decorative — never block on this */ }

  // Selection changes reflow everything below (clash rows, radar, facts) — remeasure every scene's
  // ScrollTrigger (including the fee jar's, further down the page) against the new layout.
  refreshScenes();
}

function onSelectionChange() {
  renderArena();
  syncUrl();
}

function applyAccent(rollObj) {
  document.documentElement.style.setProperty('--arena-accent', `var(--world-${rollObj.accent})`);
}
applyAccent(shell.roll);

onRemix(({ roll }) => {
  applyAccent(roll);
  playBlip({ freq: 480 + (roll.seed % 200) });
  if (motionAllowed()) {
    whenGsap().then(gsap => {
      if (!gsap) return;
      gsap.fromTo('.fighter-slot', { scale: 0.94 }, { scale: 1, duration: 0.4, ease: 'back.out(1.6)', stagger: 0.06 });
    });
  }
});

// No explicit initial-formation call needed: the hero section's own `data-formation="nebula"` (see
// compare.html) is exactly what backdrop.js's auto-observer sets on its first callback, before any
// scroll — see backdrop.js's file-header "Section → formation auto-wiring" note.

// ---------------- Fee-drag machine + fee jar ----------------

function buildCalcItems() {
  const items = [];
  all.forEach(e => {
    if ((e.fees || []).some(f => f.type !== 'yield_pct')) items.push({ item: e, world: e.world });
    (e.providers || []).forEach(p => items.push({ item: p, world: e.world }));
  });
  return items;
}

let jarSceneHandle = null;

function renderFeeJar(result) {
  const jarMount = document.getElementById('fee-jar');
  const { ranked, group, scenario: sc } = result;

  // A new calc result always retires the previous pinned scene first — its build() closure closes
  // over the *previous* winner/memo, and its scrub range/heights were measured against markup that's
  // about to be replaced. Never leave a stale scene scrubbing over the DOM built for a new winner.
  jarSceneHandle?.destroy();
  jarSceneHandle = null;

  if (!ranked.length) {
    jarMount.innerHTML = '<p class="muted">No complete data to fill the jar for this scenario.</p>';
    return;
  }
  const winner = ranked[0].item;
  const maxYears = 40;
  const yearNow = Math.min(maxYears, Math.max(1, Math.round(sc.years) || 1));

  // Fee numbers never stop mid-tween (law 6): every year shown is a real computeCost result, never
  // an interpolation. Memoized because the scroll scrub can revisit the same year repeatedly, and a
  // fresh Map is created — i.e. the memo is cleared — on every call to renderFeeJar (every new result).
  const costMemo = new Map();
  function costForYear(year) {
    if (!costMemo.has(year)) costMemo.set(year, computeCost(winner, { ...sc, years: year }, data.fx));
    return costMemo.get(year);
  }
  const atMax = costForYear(maxYears);
  const referenceMax = Math.max(1, atMax.complete ? atMax.total : (ranked[0].total || 1));

  const withFx = ranked.filter(r => r.info?.length);
  const exchangeNotes = selectedIds.map(id => getEntry(id)).filter(Boolean)
    .map(e => ({ e, summary: feeSummary(e) })).filter(x => x.summary.kind === 'exchange');
  const fxLines = []
    .concat(withFx.length ? [`${icon('info', { size: 14 })} Currency conversion, not in the totals: ${withFx.map(r => `${esc(r.item.name)} ${r.info[0].pct}%`).join(' · ')}.`] : [])
    .concat(exchangeNotes.map(x => `${icon('info', { size: 14 })} ${esc(x.e.name)}: ${x.summary.comps.map(c => `${esc(c.label)} ${c.value}%`).join(' · ')} — on top of broker fees, not in the totals.`));

  jarMount.innerHTML = h`
    <div class="jar-panel glass">
      <div class="jar-flask" aria-hidden="true">
        <div class="jar-fill" data-el="jar-fill"></div>
      </div>
      <div class="jar-readout">
        <p class="muted jar-caption" data-el="jar-caption"></p>
        <p class="jar-total kinetic display-md" data-el="jar-total" aria-live="polite"></p>
        <label class="jar-slider-label" for="jar-year">Scrub years: <strong data-el="jar-year-label"></strong></label>
        <input type="range" id="jar-year" min="1" max="${maxYears}" step="1" value="${yearNow}">
        ${fxLines.length ? `<div class="jar-fx-note muted">${fxLines.join('<br>')}</div>` : ''}
      </div>
    </div>`;

  const fillEl = jarMount.querySelector('[data-el="jar-fill"]');
  const totalEl = jarMount.querySelector('[data-el="jar-total"]');
  const captionEl = jarMount.querySelector('[data-el="jar-caption"]');
  const yearLabelEl = jarMount.querySelector('[data-el="jar-year-label"]');
  const flaskEl = jarMount.querySelector('.jar-flask');
  const slider = jarMount.querySelector('#jar-year');

  let lastYearShown = null;
  let lastCoinAt = 0;

  function dropCoin() {
    if (!motionAllowed()) return;
    const now = performance.now();
    if (now - lastCoinAt < 120) return; // throttle to <=1 coin per 120ms
    lastCoinAt = now;
    whenGsap().then(gsap => {
      if (!gsap || !flaskEl.isConnected) return;
      const coin = document.createElement('span');
      coin.className = 'jar-coin-drop';
      coin.setAttribute('aria-hidden', 'true');
      coin.textContent = '\u{1FA99}';
      flaskEl.appendChild(coin);
      gsap.fromTo(coin, { y: -36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'bounce.out', onComplete: () => coin.remove() });
    });
  }

  // Slider value, year label, caption and total text are only touched when the *integer* year
  // actually changes — both the manual slider and the scroll scrub funnel through here.
  function applyYear(yearVal) {
    const year = Math.min(maxYears, Math.max(1, Math.round(yearVal)));
    if (year === lastYearShown) return;
    lastYearShown = year;

    const res = costForYear(year);
    const amount = res.complete ? res.total : null;
    const pct = amount == null ? 0 : Math.max(2, Math.min(100, (amount / referenceMax) * 100));

    fillEl.style.transition = motionAllowed() ? 'transform .4s ease' : 'none';
    fillEl.style.transform = `scaleY(${pct / 100})`;
    slider.value = String(year);
    yearLabelEl.textContent = String(year);
    totalEl.textContent = amount == null ? '—' : formatSGD(amount);
    captionEl.textContent = `Estimated fee drag for ${winner.name} over ${year} year${year === 1 ? '' : 's'} — cheapest ${COST_GROUPS[group]?.label.toLowerCase() || 'this group'}, ${describeScenario({ ...sc, years: year })}.`;

    if (amount != null) dropCoin();
  }

  slider.addEventListener('input', () => applyYear(Number(slider.value)));
  applyYear(yearNow);

  // Pin the jar panel only (never the calculator, per the interactive-UI rule) and scrub years 1→40
  // across ~2 viewport heights of scroll. Under Calm/reduced-motion/`?nogsap=1`, scene() is a no-op —
  // the panel stays unpinned and the slider above keeps working exactly as it does after the scene.
  //
  // #fee-jar is the last pinned scene on the page, so a fixed `top top+=header` start can put the
  // pin's own `end` beyond what the document can actually scroll to when there isn't enough natural
  // content after the jar (found in verification: on ordinary desktop viewport heights, the jar panel
  // + footer wasn't enough — the scrub silently capped below year 40). Instead of reserving blank
  // space after the page for every reader (rejected — it showed even in Calm/`?nogsap=1`, which never
  // pin at all), the start point itself adapts: if there's enough room below the jar's top to fit one
  // more viewport (the normal case), pin from `top top+=header` as usual; otherwise pin from
  // `bottom bottom` (the jar's bottom at the viewport's own bottom) — always reachable, because the
  // pin's own spacer then adds the full scrub distance below that point, whatever it is. A function
  // (not a cached string) so ScrollTrigger's `invalidateOnRefresh` re-evaluates it on every refresh;
  // GSAP measures pins in their reverted, unpinned state during refresh, so this always sees the true
  // natural layout rather than a stale mid-pin one.
  const start = () => {
    const header = headerOffsetPx();
    const jarTop = jarMount.getBoundingClientRect().top + window.scrollY;
    const spaceAfterJarTop = document.documentElement.scrollHeight - jarTop - header;
    return spaceAfterJarTop >= window.innerHeight ? `top top+=${header}` : 'bottom bottom';
  };

  jarSceneHandle = scene(jarMount, tl => {
    const state = { p: 0 };
    tl.to(state, {
      p: 1,
      ease: 'none',
      duration: 1,
      onUpdate: () => applyYear(1 + state.p * (maxYears - 1)),
    });
  }, { pin: true, length: 2, start });
  refreshScenes();
}

if (all.length) {
  mountVisualCalculator(document.getElementById('calc-mount'), {
    items: buildCalcItems(), fx: data.fx, initialScenario: scenario, initialGroup,
    title: 'Fee-drag machine',
    getStage: () => shell.getStage(),
    onResult: renderFeeJar,
  });
} else {
  document.getElementById('calc-mount').innerHTML = '';
  document.getElementById('fee-jar').innerHTML = '';
}

renderArena();

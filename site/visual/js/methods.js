// methods.js — the visual edition's Methods page (site/visual/methods.html). Same content as stable's
// site/methods.html + site/js/methods.js (every method, same headings/intro copy, same card content,
// same providers table, same fee-drag calculator behaviour) — staged as a Singapore MRT-style line map:
// methods grouped by category become coloured "lines" (one station per method), lines draw themselves
// on scroll (DrawSVGPlugin) with a train riding along (MotionPath), and a station click/Enter opens a
// full-screen "platform" panel with that method's card content, providers table and sign-up steps.
//
// Local helpers below (crown, freshnessBadgeHTML, feeLineHTML/renderFeeLine, providersTableHTML,
// emptyStatePanel — the fee-display decision tree) are intentionally re-implemented rather than
// imported from site/js/components.js, for the same reason hub.js gives (components.js pulls in the
// entire *stable* page-chrome module). None of these helpers make a costing/ranking decision —
// feeSummary, bestFeeComponent, rankByCost and computeCost itself all still come from
// feeview.js/data.js/cost.js untouched. The fee-drag calculator itself is calc.js (owned by this page,
// shared with brokers/compare) — see that file's header for its API.

import { getData, bestFeeComponent } from '../../js/data.js';
import { feeSummary, freshnessView } from '../../js/feeview.js';
import { rankByCost, formatSGD, describeScenario, DEFAULT_SCENARIO } from '../../js/cost.js';
import { icon } from '../../js/icons.js';
import { mountShell, esc } from './shell.js';
import { motionAllowed, motionScope, whenGsap, splitHeadline, reveal } from './motion.js';
import { FORMATIONS } from './stage.js';
import { onRemix } from './chaos.js';
import { mountVisualCalculator } from './calc.js';

function h(strings, ...vals) {
  return strings.reduce((acc, s, i) => acc + s + (vals[i] ?? ''), '');
}

// ============================================================================
// Local helpers (see file header for why these aren't imported from stable modules)
// ============================================================================

function crown(label = 'Cheapest') {
  return h`<span class="crown" title="${esc(label)}">${icon('crown', { size: 14 })}<span class="sr-only">${esc(label)}</span></span>`;
}

const FRESH_META = { live: { cls: 'badge-live', icon: 'check' }, aging: { cls: 'badge-aging', icon: 'info' }, stale: { cls: 'badge-stale', icon: 'warning' }, missing: { cls: 'badge-missing', icon: 'warning' } };

function freshnessBadgeHTML(component) {
  const view = freshnessView(component);
  const meta = FRESH_META[view.state];
  const asOf = view.asOfText ? ` · ${view.asOfText}` : '';
  const badge = h`<span class="badge ${meta.cls}">${icon(meta.icon, { size: 12 })} ${view.label}${asOf}</span>`;
  if (!view.href) return badge;
  return h`<a class="badge-link" href="${esc(view.href)}" target="_blank" rel="noopener" title="Source: ${esc(view.href)}">${badge}</a>`;
}

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

const RETURN_DRIVER_LABEL = { 'capital-growth': 'Capital growth', dividends: 'Dividends', interest: 'Interest', coupon: 'Coupon', none: 'No return' };

function meterRow(entry) {
  const dot = (value, max, label) => {
    const v = Math.max(0, Math.min(max, Math.round(value || 0)));
    const dots = Array.from({ length: max }, (_, i) => `<span class="dot${i < v ? ' is-filled' : ''}"></span>`).join('');
    return h`<span class="platform-meter-item"><span class="meter" role="img" aria-label="${esc(label)}: ${v} of ${max}"><span class="meter-dots">${dots}</span></span> ${esc(label)}</span>`;
  };
  return h`<div class="platform-meters">${dot(entry.riskLevel, 5, 'Risk')}${dot(entry.liquidity, 5, 'Liquidity')}${dot(entry.complexity, 5, 'Complexity')}</div>`;
}

function providersTableHTML(entry, scenario, fx) {
  const providers = entry.providers || [];
  if (!providers.length) return '<p class="muted">No specific providers listed yet.</p>';
  const { ranked, incomplete } = rankByCost(providers, scenario, fx);
  const rows = [];
  ranked.forEach((r, i) => rows.push(h`
    <tr>
      <td>${i === 0 ? crown() : ''} ${esc(r.item.name)}</td>
      <td>${formatSGD(r.total)}</td>
      <td>${freshnessBadgeHTML(bestFeeComponent(r.item))}</td>
      <td><a class="btn btn-ghost" href="${esc(r.item.officialLink)}" target="_blank" rel="noopener">${icon('external', { size: 14 })} Site</a></td>
    </tr>`));
  incomplete.forEach(r => rows.push(h`
    <tr class="is-incomplete">
      <td>${esc(r.item.name)}</td>
      <td class="muted">—</td>
      <td class="muted" title="${esc(r.reasons.join('; '))}">${icon('warning', { size: 12 })} incomplete</td>
      <td><a class="btn btn-ghost" href="${esc(r.item.officialLink)}" target="_blank" rel="noopener">${icon('external', { size: 14 })} Site</a></td>
    </tr>`));
  return h`
    <div class="table-scroll">
      <table class="data-table providers-table">
        <caption class="sr-only">Providers for ${esc(entry.name)}, ranked by cost for: ${esc(describeScenario(scenario))}</caption>
        <thead><tr><th>Provider</th><th>Est. cost</th><th>Data</th><th></th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
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

// ============================================================================
// Grouping (categories → "lines")
// ============================================================================

function groupByCategory(methodList) {
  const order = [];
  const byCategory = new Map();
  methodList.forEach(m => {
    const cat = m.category || 'Other';
    if (!byCategory.has(cat)) { byCategory.set(cat, []); order.push(cat); }
    byCategory.get(cat).push(m);
  });
  return order.map(category => ({ category, methods: byCategory.get(category) }));
}

// ============================================================================
// MRT line map — decorative line colour/train-style choice only (chaos.js roll); content/order is
// always the full, unfiltered method list grouped by category, in data order.
// ============================================================================

const PALETTE = ['var(--mrt-c1)', 'var(--mrt-c2)', 'var(--mrt-c3)', 'var(--mrt-c4)', 'var(--mrt-c5)'];

// Reuses chaos.js's roll() rather than a second PRNG call: roll.formationOrder is FORMATIONS shuffled
// by the seed, so each formation's new index is a deterministic 0..4 permutation we repurpose here to
// pick which of the 5 decorative line colours each category line gets.
function lineColorOrder(roll) {
  return FORMATIONS.map(f => roll.formationOrder.indexOf(f));
}

const TRAIN_STYLE_CLASSES = ['mrt-train--fade-rise', 'mrt-train--scramble', 'mrt-train--slide-scale', 'mrt-train--flip-in'];
function applyTrainStyle(entrance) {
  const cls = `mrt-train--${entrance}`;
  document.querySelectorAll('.mrt-train').forEach(t => {
    t.classList.remove(...TRAIN_STYLE_CLASSES);
    t.classList.add(cls);
  });
}

function buildLineGeometry(count) {
  // Inset well clear of the track's own edges (not just the viewBox's) — the widest station label
  // (min(22vw, 150px), see methods.css) is centered on its station, so an edge station needs roughly
  // half that width of clearance to avoid overflowing the track (methods.css's overflow-x: hidden on
  // .mrt-line-track is a hard backstop regardless, but this keeps normal rendering un-clipped).
  const startX = 90, endX = 910, y = 50;
  const positions = count <= 1 ? [500] : Array.from({ length: count }, (_, i) => startX + (i / (count - 1)) * (endX - startX));
  return { path: `M${startX} ${y} H${endX}`, positions, y };
}

function renderMap(mount, groups, roll, onOpen) {
  const order = lineColorOrder(roll);
  mount.innerHTML = groups.map((g, i) => {
    const color = PALETTE[order[i % order.length]];
    const { path, positions, y } = buildLineGeometry(g.methods.length);
    const stationsHTML = g.methods.map((m, si) => h`
      <button type="button" class="mrt-station" data-id="${esc(m.id)}" style="left:${(positions[si] / 10).toFixed(2)}%" aria-haspopup="dialog" aria-label="${esc(m.name)} — open platform">
        <span class="mrt-dot" aria-hidden="true"></span>
        <span class="mrt-station-label">${esc(m.name)}</span>
      </button>`).join('');
    return h`
      <div class="mrt-line" data-category="${esc(g.category)}" style="--line-color:${color}">
        <h3 class="mrt-line-label"><span class="mrt-line-legend-dot" aria-hidden="true"></span>${esc(g.category)} line</h3>
        <div class="mrt-line-track">
          <svg class="mrt-line-svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path class="mrt-line-path" d="${path}"></path>
            <circle class="mrt-train" r="9" cx="${positions[0]}" cy="${y}"></circle>
          </svg>
          <div class="mrt-stations">${stationsHTML}</div>
        </div>
      </div>`;
  }).join('');

  mount.querySelectorAll('.mrt-station').forEach(btn => {
    btn.addEventListener('click', () => onOpen(btn.dataset.id, btn));
  });

  // The scroll-drawn line + riding train is decorative flourish, desktop only (the mobile layout drops
  // the SVG entirely for a plain vertical line — see methods.css) — no point mounting ScrollTrigger
  // instances for an svg that's `display:none`.
  if (window.innerWidth >= 768) {
    mount.querySelectorAll('.mrt-line').forEach(lineEl => mountLineAnimation(lineEl));
  }
}

function mountLineAnimation(lineEl) {
  motionScope(() => {
    let ctx = null;
    let cancelled = false;
    (async () => {
      const gsap = await whenGsap();
      if (cancelled || !gsap || !window.DrawSVGPlugin || !window.MotionPathPlugin || !window.ScrollTrigger) return;
      const path = lineEl.querySelector('.mrt-line-path');
      const train = lineEl.querySelector('.mrt-train');
      if (!path) return;
      ctx = gsap.context(() => {
        gsap.set(path, { drawSVG: '0%' });
        gsap.to(path, {
          drawSVG: '100%', ease: 'none',
          scrollTrigger: { trigger: lineEl, start: 'top 88%', end: 'bottom 55%', scrub: 0.6 },
        });
        if (train) {
          gsap.set(train, { opacity: 1 });
          gsap.to(train, {
            motionPath: { path, align: path, alignOrigin: [0.5, 0.5] },
            ease: 'none',
            scrollTrigger: { trigger: lineEl, start: 'top 88%', end: 'bottom 55%', scrub: 0.6 },
          });
        }
      }, lineEl);
    })();
    return () => {
      cancelled = true;
      ctx?.revert();
      const train = lineEl.querySelector('.mrt-train');
      if (train) train.style.opacity = 0;
    };
  });
}

// ============================================================================
// Platform panel (station click/Enter → full-screen modal, same content as the stable card + table)
// ============================================================================

function stepsChecklistHTML(entry) {
  const steps = entry.steps?.length ? entry.steps : [{ title: 'Details coming soon', detail: 'Sign-up steps for this entry have not been written yet.', link: entry.officialLink }];
  return steps.map((s, i) => h`
    <div class="platform-step">
      <span class="platform-step-num" aria-hidden="true">${i + 1}</span>
      <div class="platform-step-body">
        <label class="platform-step-check"><input type="checkbox" data-action="toggle-step" data-idx="${i}"> <span>Step ${i + 1}: ${esc(s.title)}</span></label>
        <p>${esc(s.detail)}</p>
        ${s.link ? h`<a class="btn btn-ghost" href="${esc(s.link)}" target="_blank" rel="noopener">${icon('external', { size: 14 })} Open official page</a>` : ''}
      </div>
    </div>`).join('');
}

function openPlatformModal(entry, originEl, shellHandle, dataBundle) {
  const body = document.createElement('div');
  body.className = 'platform-panel';
  const rd = entry.returnDrivers?.length ? entry.returnDrivers : null;
  body.innerHTML = h`
    <div class="platform-head">
      <span class="platform-icon">${icon(entry.icon || 'chart', { size: 26 })}</span>
      <div>
        <h2 id="platform-title" class="kinetic display-md">${esc(entry.name)}</h2>
        ${entry.analogy ? `<p class="platform-analogy">${esc(entry.analogy)}</p>` : ''}
      </div>
    </div>
    <p>${esc(entry.summary)}</p>
    ${meterRow(entry)}
    ${rd ? `<div class="chip-row">${rd.map(d => `<span class="chip chip-sm">${esc(RETURN_DRIVER_LABEL[d] || d)}</span>`).join('')}</div>` : ''}
    <div class="card-fee">${feeLineHTML(entry)}</div>

    <div>
      <h3 class="platform-section-title">${icon('info', { size: 16 })} Pros &amp; cons</h3>
      <div class="platform-proscons">
        <div><h4>Pros</h4><ul>${(entry.pros || []).map(p => `<li>${esc(p)}</li>`).join('') || '<li class="muted">Not documented yet.</li>'}</ul></div>
        <div><h4>Cons</h4><ul>${(entry.cons || []).map(c => `<li>${esc(c)}</li>`).join('') || '<li class="muted">Not documented yet.</li>'}</ul></div>
      </div>
    </div>

    <div class="platform-facts">
      ${entry.bestFor ? `<p><strong>Best for:</strong> ${esc(entry.bestFor)}</p>` : ''}
      ${entry.eligibility ? `<p><strong>Eligibility:</strong> ${esc(entry.eligibility)}</p>` : ''}
      ${entry.minAmount ? `<p><strong>Minimum:</strong> ${esc(entry.minAmount)}</p>` : ''}
    </div>

    <div>
      <h3 class="platform-section-title">${icon('key', { size: 16 })} How to start</h3>
      <div class="platform-steps">${stepsChecklistHTML(entry)}</div>
    </div>

    <div>
      <h3 class="platform-section-title">${icon('briefcase', { size: 16 })} Providers</h3>
      <div class="platform-providers-table">${providersTableHTML(entry, DEFAULT_SCENARIO, dataBundle.fx)}</div>
    </div>

    <div class="platform-actions">
      <a class="btn btn-primary" href="${esc(entry.officialLink || '#')}" target="_blank" rel="noopener">${icon('external', { size: 16 })} Official page</a>
    </div>`;

  shellHandle.openModal(body, { labelledBy: 'platform-title', size: 'lg' });
  shellHandle.glossaryTooltips(body);

  const storeKey = `steps:${entry.id}`;
  let done = new Set();
  try { done = new Set(JSON.parse(shellHandle.ls(storeKey) || '[]')); } catch { done = new Set(); }
  body.querySelectorAll('[data-action="toggle-step"]').forEach(cb => {
    const idx = Number(cb.dataset.idx);
    cb.checked = done.has(idx);
    cb.addEventListener('change', () => {
      if (cb.checked) done.add(idx); else done.delete(idx);
      shellHandle.lsSet(storeKey, JSON.stringify([...done]));
    });
  });

  // Decorative "Flip from the station" entrance: animates the already-fully-rendered, already-visible
  // dialog in from the clicked station's screen position. No-op (dialog just appears, per shell.js's
  // normal CSS) under reduced motion / Calm / a failed GSAP load — content is never gated on this.
  if (motionAllowed() && originEl) {
    const dialog = document.querySelector('.modal-overlay .modal');
    if (dialog) {
      const originRect = originEl.getBoundingClientRect();
      whenGsap().then(gsap => {
        if (!gsap || !document.body.contains(dialog)) return;
        const dialogRect = dialog.getBoundingClientRect();
        gsap.fromTo(dialog, {
          x: originRect.left + originRect.width / 2 - (dialogRect.left + dialogRect.width / 2),
          y: originRect.top + originRect.height / 2 - (dialogRect.top + dialogRect.height / 2),
          scale: 0.2, opacity: 0,
        }, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' });
      });
    }
  }
}

// ============================================================================
// Boot — placed last so every helper/const above (PALETTE, groupByCategory, renderMap,
// openPlatformModal, …) is fully initialized before this synchronous top-level code runs.
// ============================================================================

const data = await getData();
const shell = await mountShell({ page: 'methods.html', data });

splitHeadline(document.getElementById('methods-headline'), {});
reveal(document.querySelector('.methods-hero'), { from: { opacity: 0, y: 24 } });

const methods = data.methods.entries;
const getEntry = id => methods.find(e => e.id === id) || null;
const mapMount = document.getElementById('mrt-map');
const emptyMount = document.getElementById('methods-empty');
const hintEl = document.querySelector('[data-el="map-hint"]');

if (!methods.length) {
  document.getElementById('calc-mount').innerHTML = '';
  emptyStatePanel(emptyMount, { title: 'No method data yet', detail: 'Run npm run scrape to generate data, then reload this page.' });
} else {
  const groups = groupByCategory(methods);
  renderMap(mapMount, groups, shell.roll, (id, el) => {
    const entry = getEntry(id);
    if (entry) openPlatformModal(entry, el, shell, data);
  });
  applyTrainStyle(shell.roll.entrance);

  onRemix(({ roll }) => {
    const order = lineColorOrder(roll);
    document.querySelectorAll('.mrt-line').forEach((lineEl, i) => lineEl.style.setProperty('--line-color', PALETTE[order[i % order.length]]));
    applyTrainStyle(roll.entrance);
  });

  if (hintEl) {
    hintEl.hidden = false;
    hintEl.innerHTML = `${icon('info', { size: 14 })} ${methods.length} methods across ${groups.length} lines.`;
  }

  const items = methods.flatMap(m => (m.providers?.length ? m.providers.map(p => ({ item: p, world: 'methods' })) : [{ item: m, world: 'methods' }]));
  mountVisualCalculator(document.getElementById('calc-mount'), {
    items, fx: data.fx, initialGroup: 'robo', title: 'Fee-drag machine',
    getStage: () => shell.getStage(),
  });

  const setRings = () => shell.getStage()?.setFormation('rings');
  if (shell.getStage()) setRings();
  window.addEventListener('sg:stageready', setRings, { once: true });
}

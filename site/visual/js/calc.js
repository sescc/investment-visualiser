// calc.js — the shared visual-edition fee calculator ("fee-drag machine"). OWNED BY the methods page
// agent. The brokers and compare page agents may IMPORT this once it exists but MUST NOT EDIT it —
// flag issues back instead of patching in place, so every page keeps identical costing/ranking logic.
//
// Real inputs (dials/segmented toggles built on native <input>/<label> radio pairs — fully keyboard
// and screen-reader operable), results as an animated "bar race" of ranked providers. ALL costing goes
// through site/js/cost.js's rankByCost/computeCost — this module never computes a fee itself, and never
// hand-types a fee/percent figure (see CLAUDE.md's hard rule). Every animation here is decorative and
// gated the same way as the rest of the visual edition (motion.js's motionAllowed()/whenGsap()); the
// underlying numbers, ranking and incomplete list are always in the DOM as plain readable text/markup,
// with a "Show as table" <details> fallback, so Calm mode / reduced motion / a failed GSAP load never
// hides content.
//
// PUBLIC API
//   mountVisualCalculator(container, opts) → { setScenario(partial), setGroup(key), destroy() }
//     opts: {
//       items,             // [{ item, world }] candidates — Provider or Entry objects with `.fees`
//                           // (see site/js/cost.js's Fee schema). Required.
//       fx,                // data.fx bundle (from data.js:getData()'s result) — passed straight through
//                           // to computeCost/rankByCost for currency conversion. Required.
//       groups,             // optional: subset of COST_GROUPS keys to offer as the "Compare" control;
//                           // default = every COST_GROUPS key that at least one item belongs to
//                           // (costGroupOf), same rule stable's mountFeeCalculator uses.
//       initialScenario,    // optional partial Scenario merged over DEFAULT_SCENARIO. If omitted, a
//                           // `?scenario=` query param is decoded instead (data.js:decodeScenario;
//                           // same codec compare.html's own deep links use), falling back to
//                           // DEFAULT_SCENARIO when absent/invalid.
//       initialGroup,       // optional COST_GROUPS key; falls back to the first available group.
//       title,              // heading text; default 'Fee-drag machine'.
//       getStage,           // optional () => Stage|null (e.g. () => shellHandle.getStage()) — pulsed
//                           // with the active group's world hue on every recompute. Decorative only.
//       onResult,           // optional ({ ranked, incomplete, scenario, group }) => void, called after
//                           // every render (e.g. so a caller can sync its own UI to the live ranking).
//     }
//     On mount, `?group=` and `?market=` in location.search are honoured exactly like stable's
//     compare.js reads them (URL wins over initialGroup / initialScenario.market when present and
//     valid) — so a deep link from a product card's "Compare what it costs to buy →" link
//     (compare.html?group=…&market=…#calc-mount, built by site/js/feeview.js) behaves the same whether
//     it lands on the stable or the visual edition.
//   Returned handle:
//     setScenario(partial) — shallow-merges into the live scenario and re-renders (dial/segmented
//                             controls call this internally; exposed so a caller can drive the
//                             calculator programmatically, e.g. from a quiz result).
//     setGroup(key)         — switches the active cost group (must be one of the offered groups) and
//                             re-renders.
//     destroy()             — removes all listeners and empties the container.
//   "Cheapest" always names its scenario and cost group (invariant #3): the headline reads
//   "Cheapest <group label, lowercase> for <describeScenario(scenario)>: <name>". Incomplete providers
//   are listed separately and never ranked. `fx_spread_pct` is shown as an info line ("not in the
//   totals"), never summed — see cost.js's `info` field.

import { rankByCost, describeScenario, formatSGD, costGroupOf, COST_GROUPS, PRESETS, DEFAULT_SCENARIO, DEFAULT_SHARE_PRICE } from '../../js/cost.js';
import { decodeScenario } from '../../js/data.js';
import { icon } from '../../js/icons.js';
import { esc } from './shell.js';
import { motionAllowed, whenGsap, countUp } from './motion.js';
import { confettiBurst, playBlip } from './fx.js';

function h(strings, ...vals) {
  return strings.reduce((acc, s, i) => acc + s + (vals[i] ?? ''), '');
}

function crownIcon(label = 'Cheapest') {
  return h`<span class="crown" title="${esc(label)}">${icon('crown', { size: 14 })}<span class="sr-only">${esc(label)}</span></span>`;
}

const FIELD_META = [
  { key: 'lumpSum', label: 'Lump sum (S$)', min: 0, step: 500 },
  { key: 'monthly', label: 'Monthly (S$)', min: 0, step: 50 },
  { key: 'years', label: 'Years', min: 1, max: 40, step: 1 },
  { key: 'tradesPerMonth', label: 'Trades / month', min: 0, max: 60, step: 1 },
  { key: 'sharePrice', label: 'Typical share price', min: 1, step: 1, hint: 'Only used for brokers that charge per share (e.g. some US pricing plans)' },
];
const MARKETS = [['SG', 'Singapore'], ['US', 'United States'], ['HK', 'Hong Kong']];

export function mountVisualCalculator(container, opts = {}) {
  const { items = [], fx, title = 'Fee-drag machine', getStage, onResult } = opts;

  const worldOf = new Map(items.map(x => [x.item.id || x.item.name, x.world]));
  const keyOf = item => item.id || item.name;

  const allGroupKeys = Object.keys(COST_GROUPS).filter(g => items.some(x => costGroupOf(x.item) === g));
  const groupKeys = (opts.groups?.length ? opts.groups.filter(g => allGroupKeys.includes(g)) : allGroupKeys);

  const qp = new URLSearchParams(location.search);
  let scenario = opts.initialScenario ? { ...DEFAULT_SCENARIO, ...opts.initialScenario } : decodeScenario(qp.get('scenario'));
  if (['SG', 'US', 'HK'].includes(qp.get('market'))) scenario = { ...scenario, market: qp.get('market') };
  let group = groupKeys.includes(qp.get('group')) ? qp.get('group')
    : (groupKeys.includes(opts.initialGroup) ? opts.initialGroup : groupKeys[0]);

  let lastWinnerKey = null;
  let destroyed = false;

  container.innerHTML = h`
    <div class="fee-machine glass">
      <h3 class="kinetic display-md">${esc(title)}</h3>

      <fieldset class="segmented" data-el="group-field">
        <legend class="segmented-legend">Compare</legend>
        ${groupKeys.map((g, i) => h`
          <label class="segmented-btn">
            <input type="radio" name="fee-machine-group" value="${g}" ${g === group ? 'checked' : ''}>
            <span>${esc(COST_GROUPS[g].label)}</span>
          </label>`).join('')}
      </fieldset>

      <div class="fee-machine-presets">
        ${Object.entries(PRESETS).map(([key, p]) => h`<button type="button" class="chip chip-btn" data-preset="${key}">${esc(p.label)}</button>`).join('')}
      </div>

      <form class="fee-machine-form" data-action="fee-machine-form">
        ${FIELD_META.map(f => h`
          <div class="dial-field"${f.hint ? ` title="${esc(f.hint)}"` : ''}>
            <label for="fm-${f.key}">${esc(f.label)}</label>
            <div class="dial-control">
              <button type="button" class="dial-step" data-target="${f.key}" data-step="-${f.step}" aria-label="Decrease ${esc(f.label)}">&minus;</button>
              <input type="number" id="fm-${f.key}" name="${f.key}" min="${f.min}" ${f.max ? `max="${f.max}"` : ''} step="${f.step}">
              <button type="button" class="dial-step" data-target="${f.key}" data-step="${f.step}" aria-label="Increase ${esc(f.label)}">&plus;</button>
            </div>
          </div>`).join('')}
        <fieldset class="segmented" data-el="market-field">
          <legend class="segmented-legend">Market</legend>
          ${MARKETS.map(([v, l]) => h`
            <label class="segmented-btn">
              <input type="radio" name="fee-machine-market" value="${v}">
              <span>${esc(l)}</span>
            </label>`).join('')}
        </fieldset>
      </form>

      <p class="fee-machine-headline" data-el="headline" aria-live="polite"></p>
      <div class="bar-race" data-el="bar-race" role="list" aria-label="Ranked providers by estimated cost"></div>
      <p class="muted fee-machine-fx" data-el="fx-note"></p>
      <details class="chart-table"><summary>Show as table</summary><div data-el="table"></div></details>
      <div class="fee-machine-incomplete" data-el="incomplete"></div>
    </div>`;

  const form = container.querySelector('[data-action="fee-machine-form"]');
  const headlineEl = container.querySelector('[data-el="headline"]');
  const raceEl = container.querySelector('[data-el="bar-race"]');
  const fxEl = container.querySelector('[data-el="fx-note"]');
  const tableEl = container.querySelector('[data-el="table"]');
  const incompleteEl = container.querySelector('[data-el="incomplete"]');
  const groupField = container.querySelector('[data-el="group-field"]');
  const marketField = container.querySelector('[data-el="market-field"]');

  function syncFormFromScenario() {
    FIELD_META.forEach(f => { const el = form.elements.namedItem(f.key); if (el) el.value = scenario[f.key] ?? (f.key === 'sharePrice' ? DEFAULT_SHARE_PRICE : 0); });
    marketField.querySelectorAll('input[name="fee-machine-market"]').forEach(r => { r.checked = r.value === scenario.market; });
    groupField.querySelectorAll('input[name="fee-machine-group"]').forEach(r => { r.checked = r.value === group; });
  }
  syncFormFromScenario();

  function readForm() {
    const fd = new FormData(form);
    scenario = {
      lumpSum: Number(fd.get('lumpSum')) || 0,
      monthly: Number(fd.get('monthly')) || 0,
      years: Number(fd.get('years')) || 1,
      tradesPerMonth: Number(fd.get('tradesPerMonth')) || 0,
      sharePrice: Number(fd.get('sharePrice')) || DEFAULT_SHARE_PRICE,
      market: fd.get('market') || scenario.market || 'SG',
    };
  }

  function buildRowEl(r, i) {
    const row = document.createElement('div');
    row.className = 'bar-race-row';
    row.dataset.id = keyOf(r.item);
    row.setAttribute('role', 'listitem');
    row.innerHTML = h`
      <span class="bar-race-rank" data-el="rank"></span>
      <span class="bar-race-name">${esc(r.item.name)}</span>
      <div class="bar-race-track"><div class="bar-race-fill" style="width:0%"></div></div>
      <span class="bar-race-total" data-el="total">${formatSGD(r.total)}</span>`;
    return row;
  }

  function updateRace(ranked) {
    const gsapReady = motionAllowed() && window.gsap;
    const FlipPlugin = gsapReady ? window.Flip : null;
    const state = FlipPlugin ? window.Flip.getState(Array.from(raceEl.children)) : null;

    const existing = new Map(Array.from(raceEl.children).map(el => [el.dataset.id, el]));
    const maxTotal = Math.max(1, ...ranked.map(r => r.total || 0));

    ranked.forEach((r, i) => {
      const key = keyOf(r.item);
      let row = existing.get(key);
      if (row) existing.delete(key); else row = buildRowEl(r, i);
      row.classList.toggle('is-first', i === 0);
      row.querySelector('[data-el="rank"]').innerHTML = i === 0 ? crownIcon(`Cheapest ${COST_GROUPS[group]?.label.toLowerCase() || ''} for ${describeScenario(scenario)}`) : String(i + 1);
      row.style.setProperty('--bar-color', `var(--world-${worldOf.get(key) || 'methods'})`);
      raceEl.appendChild(row);

      const fill = row.querySelector('.bar-race-fill');
      const totalEl = row.querySelector('[data-el="total"]');
      const pct = maxTotal ? Math.max(2, (r.total / maxTotal) * 100) : 0;
      if (gsapReady) window.gsap.to(fill, { width: `${pct}%`, duration: 0.6, ease: 'power2.out' });
      else fill.style.width = `${pct}%`;
      countUp(totalEl, r.total, formatSGD);
    });
    existing.forEach(el => el.remove());

    if (state && FlipPlugin) {
      window.Flip.from(state, {
        duration: 0.55, ease: 'power2.inOut', absolute: true, nested: true,
        onEnter: els => window.gsap.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.35 }),
        onLeave: els => window.gsap.to(els, { opacity: 0, duration: 0.25 }),
      });
    }

    if (ranked.length && !destroyed) {
      const winnerKey = keyOf(ranked[0].item);
      if (winnerKey !== lastWinnerKey && motionAllowed()) {
        const rect = raceEl.querySelector('.is-first')?.getBoundingClientRect();
        confettiBurst({ x: (rect?.left ?? window.innerWidth / 2) + 24, y: (rect?.top ?? window.innerHeight / 2) + 12 }, { count: 40 });
        playBlip({ freq: 880 });
      }
      lastWinnerKey = winnerKey;
    } else if (!ranked.length) {
      lastWinnerKey = null;
    }

    if (!ranked.length) {
      raceEl.innerHTML = '<p class="muted">No complete data for this scenario.</p>';
    }
  }

  function renderFx(ranked) {
    const withFx = ranked.filter(r => r.info?.length);
    fxEl.innerHTML = withFx.length
      ? h`${icon('info', { size: 14 })} Currency conversion fees, <strong>not in the totals</strong> (few brokers publish one): ${withFx.map(r => `${esc(r.item.name)} ${r.info[0].pct}%`).join(' · ')}.`
      : '';
  }

  function renderTable(ranked) {
    const showFx = ranked.some(r => r.info?.length);
    tableEl.innerHTML = h`
      <table class="data-table">
        <thead><tr><th>Provider</th><th>Estimated cost</th>${showFx ? '<th>Currency conversion <span class="muted">(not in total)</span></th>' : ''}</tr></thead>
        <tbody>${ranked.map((r, i) => h`<tr><td>${i === 0 ? crownIcon() : ''} ${esc(r.item.name)}</td><td>${formatSGD(r.total)}</td>${showFx ? `<td>${r.info?.find(x => x.type === 'fx_spread_pct') ? r.info.find(x => x.type === 'fx_spread_pct').pct + '%' : '<span class="muted">not published</span>'}</td>` : ''}</tr>`).join('') || '<tr><td colspan="2" class="muted">No complete data for this scenario.</td></tr>'}</tbody>
      </table>`;
  }

  function renderIncomplete(incomplete) {
    incompleteEl.innerHTML = incomplete.length ? h`
      <p class="muted incomplete-heading">${icon('warning', { size: 14 })} Incomplete data — excluded from ranking:</p>
      <ul class="incomplete-list">
        ${incomplete.map(r => `<li><span class="incomplete-name">${esc(r.item.name)}</span> — ${esc(r.reasons.join('; '))}</li>`).join('')}
      </ul>` : '';
  }

  function update() {
    if (destroyed) return;
    const groupItems = items.map(x => x.item).filter(it => costGroupOf(it) === group);
    const { ranked, incomplete } = rankByCost(groupItems, scenario, fx);

    headlineEl.textContent = ranked.length
      ? `Cheapest ${COST_GROUPS[group]?.label.toLowerCase() || 'providers'} for ${describeScenario(scenario)}: ${ranked[0].item.name}`
      : `No complete data for ${COST_GROUPS[group]?.label.toLowerCase() || 'this group'}, ${describeScenario(scenario)}.`;

    updateRace(ranked);
    renderFx(ranked);
    renderTable(ranked);
    renderIncomplete(incomplete);

    const hueWorld = groupItems[0] ? worldOf.get(keyOf(groupItems[0])) : null;
    try { getStage?.()?.pulse(hueWorld || 'methods'); } catch { /* decorative — never block on this */ }

    onResult?.({ ranked, incomplete, scenario, group });
  }

  function onDialClick(e) {
    const btn = e.target.closest('.dial-step');
    if (!btn) return;
    const input = form.elements.namedItem(btn.dataset.target);
    if (!input) return;
    const step = Number(btn.dataset.step) || 0;
    const min = input.min !== '' ? Number(input.min) : -Infinity;
    const max = input.max !== '' ? Number(input.max) : Infinity;
    input.value = Math.max(min, Math.min(max, (Number(input.value) || 0) + step));
    readForm();
    update();
  }
  function onFormInput() { readForm(); update(); }
  function onGroupChange(e) {
    if (e.target.name !== 'fee-machine-group') return;
    group = e.target.value;
    update();
  }
  function onMarketChange(e) {
    if (e.target.name !== 'fee-machine-market') return;
    readForm();
    update();
  }
  function onPresetClick(e) {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    scenario = { ...PRESETS[btn.dataset.preset] };
    syncFormFromScenario();
    update();
  }

  form.addEventListener('click', onDialClick);
  form.addEventListener('input', onFormInput);
  form.addEventListener('change', onMarketChange);
  groupField.addEventListener('change', onGroupChange);
  container.querySelector('.fee-machine-presets').addEventListener('click', onPresetClick);

  update();

  return {
    setScenario(partial) { scenario = { ...scenario, ...partial }; syncFormFromScenario(); update(); },
    setGroup(key) { if (groupKeys.includes(key)) { group = key; syncFormFromScenario(); update(); } },
    destroy() {
      destroyed = true;
      form.removeEventListener('click', onDialClick);
      form.removeEventListener('input', onFormInput);
      form.removeEventListener('change', onMarketChange);
      groupField.removeEventListener('change', onGroupChange);
      container.querySelector('.fee-machine-presets')?.removeEventListener('click', onPresetClick);
      container.innerHTML = '';
    },
  };
}

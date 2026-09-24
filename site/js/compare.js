import { getData, allEntries, findEntry, parseQuery, buildQuery } from './data.js';
import { renderChrome, emptyStatePanel, feeLine, mountFeeCalculator } from './components.js';
import { renderRadarChart, radarTableRows, RADAR_LABELS, buildTableDetails, renderFeeBarChart, registerChart } from './charts.js';

const data = await getData();
await renderChrome('compare.html', data);

const all = allEntries(data);
const { ids: initialIds, scenario: initialScenario } = parseQuery(location.search);

let selectedIds = initialIds.filter(id => all.some(e => e.id === id)).slice(0, 3);
let scenario = initialScenario;
// Deep link from product cards: ?group=<cost group>&market=SG|US|HK opens the calculator on that group.
const qp = new URLSearchParams(location.search);
const initialGroup = qp.get('group') || 'brokers';
if (['SG', 'US', 'HK'].includes(qp.get('market'))) scenario = { ...(scenario || {}), market: qp.get('market') };

const emptyMount = document.getElementById('compare-empty');
if (!all.length) {
  emptyStatePanel(emptyMount, { title: 'No data yet', detail: 'Run npm run scrape to generate data, then reload this page.' });
}

function syncUrl() {
  const qs = buildQuery({ ids: selectedIds, scenario });
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------- Picker ----------------
const input = document.getElementById('picker-input');
const suggestMount = document.getElementById('picker-suggestions');
const selectedMount = document.getElementById('picker-selected');

function renderSelected() {
  selectedMount.innerHTML = selectedIds.map(id => {
    const e = findEntry(data, id);
    if (!e) return '';
    return `<span class="chip world-${e.world}" style="background:var(--world-${e.world}-soft); color:var(--world-${e.world})">${esc(e.name)} <button type="button" data-remove="${esc(id)}" aria-label="Remove ${esc(e.name)}" style="background:none;border:none;color:inherit;cursor:pointer;font-weight:700">×</button></span>`;
  }).join('') || '<p class="muted">Nothing selected yet — search above, or use the quiz on the hub page.</p>';
  selectedMount.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => {
    selectedIds = selectedIds.filter(id => id !== btn.dataset.remove);
    onSelectionChange();
  }));
}

function renderSuggestions() {
  const term = input.value.trim().toLowerCase();
  if (!term) { suggestMount.innerHTML = ''; return; }
  const matches = all.filter(e => !selectedIds.includes(e.id) && e.name.toLowerCase().includes(term)).slice(0, 8);
  suggestMount.innerHTML = matches.map(e => `<button type="button" class="chip chip-btn" data-add="${esc(e.id)}">+ ${esc(e.name)} <span class="muted">(${e.world})</span></button>`).join('')
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

// ---------------- Radar + table ----------------
function renderComparison() {
  const entries = selectedIds.map(id => findEntry(data, id)).filter(Boolean);
  const radarWrap = document.getElementById('radar-wrap');
  const radarTableMount = document.getElementById('radar-table-mount');
  const table = document.getElementById('compare-table');

  if (entries.length < 1) {
    radarWrap.innerHTML = '<canvas id="radar-canvas"></canvas>';
    radarTableMount.innerHTML = '';
    table.innerHTML = '';
    return;
  }

  registerChart(() => renderRadarChart(document.getElementById('radar-canvas'), entries));
  radarTableMount.innerHTML = buildTableDetails(['Name', ...RADAR_LABELS], radarTableRows(entries));

  const rows = [
    ['World', e => `<span class="chip" style="background:var(--world-${e.world}-soft); color:var(--world-${e.world})">${e.world}</span>`],
    ['Summary', e => esc(e.summary)],
    ['Risk (1-5)', e => e.riskLevel],
    ['Liquidity (1-5)', e => e.liquidity],
    ['Complexity (1-5)', e => e.complexity],
    ['Fees', e => feeLine(e)],
    ['Min. amount', e => esc(e.minAmount || '—')],
    ['Best for', e => esc(e.bestFor || '—')],
    ['Pros', e => `<ul>${(e.pros || []).map(p => `<li>${esc(p)}</li>`).join('') || '<li class="muted">—</li>'}</ul>`],
    ['Cons', e => `<ul>${(e.cons || []).map(c => `<li>${esc(c)}</li>`).join('') || '<li class="muted">—</li>'}</ul>`],
  ];
  table.innerHTML = `
    <thead><tr><th></th>${entries.map(e => `<th>${esc(e.name)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([label, fn]) => `<tr><th scope="row">${label}</th>${entries.map(e => `<td>${fn(e)}</td>`).join('')}</tr>`).join('')}</tbody>`;
}

function onSelectionChange() {
  renderSelected();
  renderComparison();
  syncUrl();
}

// ---------------- Site-wide calculator ----------------
function mountCalculator() {
  const items = [];
  all.forEach(e => {
    if ((e.fees || []).some(f => f.type !== 'yield_pct')) items.push({ item: e, world: e.world });
    (e.providers || []).forEach(p => items.push({ item: p, world: e.world }));
  });
  mountFeeCalculator(document.getElementById('calc-mount'), {
    items, fx: data.fx, initialScenario: scenario, initialGroup,
    renderChart: (canvas, ranked) => renderFeeBarChart(canvas, ranked, { hueVar: '--focus' }),
  });
}

renderSelected();
renderComparison();
if (all.length) mountCalculator();

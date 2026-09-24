// Chart.js wrappers. Colours are read from CSS custom properties at render time and every
// chart is re-rendered on theme change (see onThemeChange in components.js). Every chart
// exports a matching buildTableDetails() alternative for the <details> "Show as table" markup.

import { onThemeChange } from './components.js';
import { formatSGD } from './cost.js';

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return { r: 128, g: 128, b: 128 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function lerpColor(aHex, bHex, t) {
  const a = hexToRgb(aHex), b = hexToRgb(bHex);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

/** Diverging teal↔amber scale through a neutral gray midpoint (never a raw teal→amber lerp, which muddies to olive). */
export function divergingColor(v) {
  const growth = cssVar('--growth') || '#0f8b8d';
  const income = cssVar('--income') || '#d98a12';
  const neutral = cssVar('--muted') || '#8a909c';
  const x = Math.max(0, Math.min(100, v ?? 50));
  if (x >= 50) return lerpColor(neutral, growth, (x - 50) / 50);
  return lerpColor(income, neutral, x / 50);
}

/** Fixed 3-slot categorical order for compare (radar): teal, amber, violet — independent of each entry's own world. */
export const CATEGORICAL_TRIAD = () => [cssVar('--world-products'), cssVar('--world-methods'), cssVar('--world-brokers')];

function destroyChart(canvas) {
  if (canvas.__chart) { canvas.__chart.destroy(); canvas.__chart = null; }
}

function baseFont() {
  return { family: cssVar('--font-body') || 'Inter, system-ui, sans-serif' };
}

function gridColor() { return cssVar('--line'); }
function inkColor() { return cssVar('--ink'); }
function ink2Color() { return cssVar('--ink-2'); }
function surfaceColor() { return cssVar('--surface'); }

export function buildTableDetails(headers, rows) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return `
    <details class="chart-table">
      <summary>Show as table</summary>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </details>`;
}

// ---------------------------------------------------------------------------
// Risk vs return bubble map (index.html)
// ---------------------------------------------------------------------------

export function renderBubbleChart(canvas, products, { onClick } = {}) {
  if (!window.Chart) return;
  destroyChart(canvas);
  const data = products.map(p => ({
    x: p.riskLevel, y: p.liquidity, r: 6 + (p.complexity || 1) * 3.4,
    entryId: p.id, label: p.name, gd: p.growthVsDividend,
  }));
  canvas.__chart = new Chart(canvas.getContext('2d'), {
    type: 'bubble',
    data: {
      datasets: [{
        data,
        backgroundColor: data.map(d => {
          const rgb = divergingColor(d.gd).match(/\d+/g).map(Number);
          return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.75)`;
        }),
        borderColor: surfaceColor(),
        borderWidth: 2,
        hoverBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (evt, els) => {
        if (!els.length || !onClick) return;
        const idx = els[0].index;
        onClick(data[idx].entryId);
      },
      onHover: (evt, els) => { evt.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
      scales: {
        x: { min: 0.5, max: 5.5, ticks: { stepSize: 1, color: ink2Color(), font: baseFont() }, title: { display: true, text: 'Risk (1 low – 5 high)', color: ink2Color(), font: baseFont() }, grid: { color: gridColor() } },
        y: { min: 0.5, max: 5.5, ticks: { stepSize: 1, color: ink2Color(), font: baseFont() }, title: { display: true, text: 'Liquidity (1 locked-in – 5 instant)', color: ink2Color(), font: baseFont() }, grid: { color: gridColor() } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = ctx.raw;
              return `${d.label}: risk ${d.x}, liquidity ${d.y}${typeof d.gd === 'number' ? `, ${d.gd}% growth-weighted` : ''}`;
            },
          },
        },
      },
    },
  });
}

export function bubbleTableRows(products) {
  return products.map(p => [p.name, p.riskLevel, p.liquidity, p.complexity, typeof p.growthVsDividend === 'number' ? `${p.growthVsDividend}% growth / ${100 - p.growthVsDividend}% income` : '—']);
}

// ---------------------------------------------------------------------------
// Growth ↔ income spectrum track (products.html) — DOM/CSS, not canvas.
// ---------------------------------------------------------------------------

const SPECTRUM_TIERS = ['top2', 'top1', 'bottom1', 'bottom2'];

export function renderSpectrumTrack(container, products, { onHighlight } = {}) {
  const sorted = products.slice().sort((a, b) => (a.growthVsDividend ?? 50) - (b.growthVsDividend ?? 50));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Points that share (or nearly share) a value would otherwise stack exactly on top of one
  // another — cycle through 4 vertical tiers whenever a run of close values appears.
  let lastV = null, run = 0;
  container.innerHTML = `
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
    </div>`;
  container.querySelectorAll('.spectrum-point').forEach(btn => {
    btn.addEventListener('mouseenter', () => onHighlight?.(btn.dataset.entryId, true));
    btn.addEventListener('mouseleave', () => onHighlight?.(btn.dataset.entryId, false));
    btn.addEventListener('focus', () => onHighlight?.(btn.dataset.entryId, true));
    btn.addEventListener('blur', () => onHighlight?.(btn.dataset.entryId, false));
  });
}

// ---------------------------------------------------------------------------
// Stacked "where the return comes from" bars (products.html)
// ---------------------------------------------------------------------------

export function renderReturnSourceBars(canvas, products) {
  if (!window.Chart) return;
  destroyChart(canvas);
  const labels = products.map(p => p.name);
  const growth = products.map(p => p.growthVsDividend ?? 0);
  const income = products.map(p => 100 - (p.growthVsDividend ?? 0));
  canvas.__chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Capital growth', data: growth, backgroundColor: cssVar('--growth'), borderColor: surfaceColor(), borderWidth: 2, stack: 's' },
        { label: 'Income (dividends / interest / coupons)', data: income, backgroundColor: cssVar('--income'), borderColor: surfaceColor(), borderWidth: 2, stack: 's' },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, min: 0, max: 100, ticks: { callback: v => v + '%', color: ink2Color(), font: baseFont() }, grid: { color: gridColor() } },
        y: { stacked: true, ticks: { color: inkColor(), font: baseFont() }, grid: { display: false } },
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: ink2Color(), font: baseFont() } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}%` } },
      },
    },
  });
}

export function returnSourceTableRows(products) {
  return products.map(p => [p.name, `${p.growthVsDividend ?? 0}%`, `${100 - (p.growthVsDividend ?? 0)}%`]);
}

// ---------------------------------------------------------------------------
// Fee-drag bar chart (methods.html / brokers.html / compare.html calculators)
// ---------------------------------------------------------------------------

export function renderFeeBarChart(canvas, ranked, { hueVar = '--world-methods' } = {}) {
  if (!window.Chart) return;
  destroyChart(canvas);
  if (!ranked.length) {
    canvas.__chart = null;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const labels = ranked.map((r, i) => (i === 0 ? `♛ ${r.item.name}` : r.item.name));
  const values = ranked.map(r => r.total);
  canvas.__chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Estimated total fees', data: values, backgroundColor: cssVar(hueVar), borderRadius: 4, maxBarThickness: 24 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: ink2Color(), font: baseFont(), callback: v => formatSGD(v) }, grid: { color: gridColor() } },
        y: { ticks: { color: inkColor(), font: baseFont() }, grid: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => formatSGD(ctx.raw) } },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Compare radar chart
// ---------------------------------------------------------------------------

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

export const RADAR_LABELS = ['Risk', 'Liquidity', 'Complexity', 'Income focus', 'Growth focus'];

export function renderRadarChart(canvas, entries) {
  if (!window.Chart) return;
  destroyChart(canvas);
  const colors = CATEGORICAL_TRIAD();
  canvas.__chart = new Chart(canvas.getContext('2d'), {
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
      scales: {
        r: {
          min: 0, max: 5,
          angleLines: { color: gridColor() },
          grid: { color: gridColor() },
          pointLabels: { color: ink2Color(), font: baseFont() },
          ticks: { display: false, stepSize: 1 },
        },
      },
      plugins: { legend: { position: 'bottom', labels: { color: ink2Color(), font: baseFont() } } },
    },
  });
}

export function radarTableRows(entries) {
  return entries.map(e => {
    const hasGd = typeof e.growthVsDividend === 'number';
    return [e.name, e.riskLevel, e.liquidity, e.complexity, hasGd ? `${100 - e.growthVsDividend}%` : 'n/a', hasGd ? `${e.growthVsDividend}%` : 'n/a'];
  });
}

// ---------------------------------------------------------------------------
// Auto re-render registry: page code calls registerChart(fn); fn re-runs on theme change.
// ---------------------------------------------------------------------------

const registry = [];
export function registerChart(fn) {
  registry.push(fn);
  fn();
}
onThemeChange(() => registry.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }));

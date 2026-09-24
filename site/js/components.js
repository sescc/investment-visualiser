// Shared UI components: page chrome, cards, meters, modals, flip cards, stepper, calculator, glossary.
// DOM-building helpers return strings (innerHTML) or elements; each mounts its own event listeners.

import { icon } from './icons.js';
import {
  worldOf, freshness, freshnessOfComponent, bestFeeComponent, freshnessSummary,
  checkRefreshAvailable, triggerRefresh, invalidateCache, buildCompareUrl,
} from './data.js';
import { computeCost, formatSGD, rankByCost, describeScenario, PRESETS, DEFAULT_SCENARIO, DEFAULT_SHARE_PRICE, COST_GROUPS, costGroupOf, PRODUCT_COST_LINKS } from './cost.js';

const WORLD_LABEL = { products: 'Products', methods: 'Methods', brokers: 'Brokers' };
const WORLD_TAGLINE = { products: 'What to buy', methods: 'How to invest', brokers: 'Who executes it' };

function h(strings, ...vals) {
  return strings.reduce((acc, s, i) => acc + s + (vals[i] ?? ''), '');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ls(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch { /* ignore */ }
}
function ss(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function ssSet(key, val) {
  try { sessionStorage.setItem(key, val); } catch { /* ignore */ }
}

// ============================================================================
// Theme
// ============================================================================

const THEME_KEY = 'sgtheme';

export function getStoredTheme() {
  const v = ls(THEME_KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

export function currentTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(mode) {
  if (mode === 'light' || mode === 'dark') {
    document.documentElement.setAttribute('data-theme', mode);
    lsSet(THEME_KEY, mode);
  } else {
    document.documentElement.removeAttribute('data-theme');
    lsSet(THEME_KEY, '');
  }
  window.dispatchEvent(new CustomEvent('sg:themechange', { detail: { theme: currentTheme() } }));
}

export function initTheme() {
  const stored = getStoredTheme();
  if (stored) document.documentElement.setAttribute('data-theme', stored);

  // System preference changes (relevant when the user hasn't overridden with the toggle).
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    if (!getStoredTheme()) window.dispatchEvent(new CustomEvent('sg:themechange', { detail: { theme: currentTheme() } }));
  };
  mq.addEventListener ? mq.addEventListener('change', onSystemChange) : mq.addListener(onSystemChange);

  // Explicit attribute changes (toggle button, or another tab via storage).
  new MutationObserver(() => {
    window.dispatchEvent(new CustomEvent('sg:themechange', { detail: { theme: currentTheme() } }));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="toggle-theme"]');
    if (!btn) return;
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });
}

export function onThemeChange(cb) {
  window.addEventListener('sg:themechange', cb);
  return () => window.removeEventListener('sg:themechange', cb);
}

// ============================================================================
// Page chrome: header, nav, disclaimer, footer, freshness panel
// ============================================================================

const NAV_ITEMS = [
  { href: 'index.html', label: 'Hub' },
  { href: 'products.html', label: 'Products' },
  { href: 'methods.html', label: 'Methods' },
  { href: 'brokers.html', label: 'Brokers' },
  { href: 'compare.html', label: 'Compare' },
];

/** Renders the sticky header, disclaimer strip and footer into #app-header / #app-disclaimer / #app-footer. */
export async function renderChrome(activeHref, data) {
  const header = document.getElementById('app-header');
  const discEl = document.getElementById('app-disclaimer');
  const footEl = document.getElementById('app-footer');
  const theme = currentTheme();

  if (header) {
    header.innerHTML = h`
      <div class="bar-inner">
        <a class="brand" href="index.html" aria-label="SGInvest Visualiser — home">
          <span class="brand-dot" aria-hidden="true"></span>
          <span class="brand-name">SGInvest Visualiser</span>
        </a>
        <nav class="nav" aria-label="Main">
          ${NAV_ITEMS.map(n => h`<a href="${n.href}" class="nav-link${n.href === activeHref ? ' is-active' : ''}"${n.href === activeHref ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}
        </nav>
        <div class="bar-actions">
          <button type="button" class="pill freshness-pill" data-action="open-freshness" aria-haspopup="dialog">
            ${icon('chart', { size: 16 })}
            <span class="freshness-pill-text">Data loading…</span>
          </button>
          <button type="button" class="icon-btn" data-action="toggle-theme" aria-label="Toggle dark mode" title="Toggle dark mode">
            ${icon(theme === 'dark' ? 'sun' : 'moon', { size: 18 })}
          </button>
          <button type="button" class="icon-btn nav-burger" data-action="toggle-nav" aria-label="Toggle menu" aria-expanded="false">
            <span class="burger-lines" aria-hidden="true"></span>
          </button>
        </div>
      </div>`;
    updateFreshnessPill(data);
    wireFreshnessPanel(data);
  }

  if (discEl && ss('sg-disclaimer-dismissed') !== '1') {
    discEl.hidden = false;
    discEl.innerHTML = h`
      <div class="disclaimer-inner">
        ${icon('warning', { size: 18 })}
        <p>Educational only — not financial advice. Fees change; always confirm on the provider's site.</p>
        <button type="button" class="icon-btn" data-action="dismiss-disclaimer" aria-label="Dismiss">${icon('check', { size: 16 })}</button>
      </div>`;
    discEl.querySelector('[data-action="dismiss-disclaimer"]').addEventListener('click', () => {
      ssSet('sg-disclaimer-dismissed', '1');
      discEl.hidden = true;
    });
  } else if (discEl) {
    discEl.hidden = true;
  }

  if (footEl) {
    const gen = data?.generatedAt ? new Date(data.generatedAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'not yet generated';
    footEl.innerHTML = h`
      <div class="footer-inner">
        <p>Data generated: ${esc(gen)}. Fee figures come from each provider's own pricing page via an automated scraper.</p>
        <div class="footer-links">
          <a href="methods.html">Sources &amp; methods</a>
          <span aria-hidden="true">·</span>
          <a href="#" data-action="open-freshness">Freshness report</a>
          <span aria-hidden="true">·</span>
          <a href="#" data-action="open-glossary">Glossary</a>
        </div>
        <p class="footer-fine">Not financial advice. Educational tool only.</p>
      </div>`;
    footEl.querySelector('[data-action="open-freshness"]')?.addEventListener('click', e => { e.preventDefault(); document.querySelector('[data-action="open-freshness"].freshness-pill')?.click(); });
    footEl.querySelector('[data-action="open-glossary"]')?.addEventListener('click', e => { e.preventDefault(); openGlossaryModal(); });
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-action="toggle-nav"]')) {
      document.querySelector('.nav')?.classList.toggle('is-open');
    }
  });

  glossaryTooltips(document.body);
}

function updateFreshnessPill(data) {
  const pillText = document.querySelector('.freshness-pill-text');
  if (!pillText) return;
  if (!data || data.empty) {
    pillText.textContent = 'No data yet';
    return;
  }
  const { total, live, generatedAt } = freshnessSummary(data);
  const dateStr = generatedAt ? new Date(generatedAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : '—';
  pillText.textContent = `Data as of ${dateStr} · fees for ${live}/${total}`;
  pillText.parentElement?.setAttribute('title', `${live} of ${total} products/providers have live fee data; the rest link to the provider's own page.`);
}

function wireFreshnessPanel(data) {
  const btns = document.querySelectorAll('[data-action="open-freshness"]');
  btns.forEach(btn => btn.addEventListener('click', () => openFreshnessPanel(data)));
}

async function openFreshnessPanel(data) {
  const canRefresh = await checkRefreshAvailable();
  const rows = (data?.report || []).map(r => h`
    <tr>
      <td>${esc(r.adapter)}</td>
      <td>${r.ok ? `<span class="badge badge-live">${icon('check', { size: 12 })} ok</span>` : `<span class="badge badge-stale">${icon('warning', { size: 12 })} fail</span>`}</td>
      <td>${r.count ?? '—'}</td>
      <td class="muted">${esc(r.error || '')}</td>
    </tr>`).join('');

  const body = document.createElement('div');
  body.innerHTML = h`
    <h2 id="freshness-title">Data freshness</h2>
    <p class="muted">Each row is one automated adapter run. "live" fee data was fetched within the last 30 days.</p>
    ${(() => {
      const { missing } = data?.empty ? { missing: [] } : freshnessSummary(data);
      return missing.length ? h`
        <h3>Not scraped automatically (${missing.length})</h3>
        <p class="muted">These pages need a real browser, are PDFs, or block automated reading — check the provider directly.</p>
        <ul class="incomplete-list">${missing.map(m => `<li><a href="${esc(m.sourceUrl)}" target="_blank" rel="noopener">${esc(m.name)} ${icon('external', { size: 12 })}</a></li>`).join('')}</ul>` : '';
    })()}
    ${data?.empty ? `<p class="empty-note">No data yet. Run <code>npm run scrape</code> to generate <code>data/sgdata.json</code>.</p>` : ''}
    ${rows ? h`<div class="table-scroll"><table class="data-table"><thead><tr><th>Adapter</th><th>Status</th><th>Components</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">No adapter report available yet.</p>'}
    <div class="modal-actions">
      ${canRefresh ? `<button type="button" class="btn btn-primary" data-action="refresh-data">${icon('external', { size: 16 })} Refresh data</button>` : ''}
    </div>
  `;
  const close = openModal(body, { labelledBy: 'freshness-title' });

  body.querySelector('[data-action="refresh-data"]')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> Refreshing…`;
    const ok = await triggerRefresh();
    if (ok) {
      invalidateCache();
      location.reload();
    } else {
      btn.disabled = false;
      btn.textContent = 'Refresh failed — try again';
    }
  });
  return close;
}

// ============================================================================
// Modal: focus-trapped, Esc to close, role=dialog
// ============================================================================

let _activeModal = null;

export function openModal(contentEl, { labelledBy, onClose, size } = {}) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'modal' + (size === 'lg' ? ' modal-lg' : '');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (labelledBy) dialog.setAttribute('aria-labelledby', labelledBy);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn modal-close';
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.innerHTML = '<span aria-hidden="true" style="font-size:20px;line-height:1;font-weight:600">&times;</span>';
  dialog.appendChild(closeBtn);
  dialog.appendChild(contentEl);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');

  const previouslyFocused = document.activeElement;
  const focusables = () => Array.from(dialog.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'));
  (focusables()[0] || dialog).focus?.();
  dialog.tabIndex = -1;

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  function onOverlayClick(e) { if (e.target === overlay) close(); }

  function close() {
    document.removeEventListener('keydown', onKeydown);
    overlay.removeEventListener('click', onOverlayClick);
    overlay.remove();
    document.body.classList.remove('modal-open');
    previouslyFocused?.focus?.();
    if (_activeModal === close) _activeModal = null;
    onClose?.();
  }

  document.addEventListener('keydown', onKeydown);
  overlay.addEventListener('click', onOverlayClick);
  closeBtn.addEventListener('click', close);
  _activeModal = close;
  return close;
}

export function closeModal() {
  _activeModal?.();
}

// ============================================================================
// Small atoms
// ============================================================================

export function crown(label = 'Cheapest') {
  return h`<span class="crown" title="${esc(label)}">${icon('crown', { size: 14 })}<span class="sr-only">${esc(label)}</span></span>`;
}

export function meterDots(value, max = 5, label = '') {
  const v = Math.max(0, Math.min(max, Math.round(value || 0)));
  const dots = Array.from({ length: max }, (_, i) => `<span class="dot${i < v ? ' is-filled' : ''}"></span>`).join('');
  return h`<div class="meter" role="img" aria-label="${esc(label)}: ${v} of ${max}"><span class="meter-dots">${dots}</span></div>`;
}

/** Horizontal growth↔income bar: 0 = pure income (amber), 100 = pure growth (teal). */
export function gdBar(value) {
  const v = Math.max(0, Math.min(100, value ?? 50));
  return h`
    <div class="gd-bar" role="img" aria-label="Return mix: ${v}% capital growth, ${100 - v}% income">
      <div class="gd-track">
        <div class="gd-marker" style="left:${v}%"></div>
      </div>
      <div class="gd-labels"><span>Income</span><span>Growth</span></div>
    </div>`;
}

const RETURN_DRIVER_LABEL = { 'capital-growth': 'Capital growth', dividends: 'Dividends', interest: 'Interest', coupon: 'Coupon', none: 'No return' };

export function returnDriverChips(drivers) {
  if (!drivers?.length) return '';
  return h`<div class="chip-row">${drivers.map(d => `<span class="chip chip-sm">${esc(RETURN_DRIVER_LABEL[d] || d)}</span>`).join('')}</div>`;
}

const FRESH_META = {
  live: { cls: 'badge-live', label: 'live', icon: 'check' },
  aging: { cls: 'badge-aging', label: 'aging', icon: 'info' },
  stale: { cls: 'badge-stale', label: 'stale', icon: 'warning' },
  missing: { cls: 'badge-missing', label: 'no data', icon: 'warning' },
};

export function freshnessBadge(component) {
  const state = freshnessOfComponent(component);
  const meta = FRESH_META[state];
  const asOf = component?.asOf ? ` · ${new Date(component.asOf).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
  const badge = h`<span class="badge ${meta.cls}">${icon(meta.icon, { size: 12 })} ${meta.label}${asOf}</span>`;
  // Each figure links to the page it was read from (merge.js only ever stores https sources).
  const src = component?.source;
  if (typeof src !== 'string' || !src.startsWith('https://')) return badge;
  return h`<a class="badge-link" href="${esc(src)}" target="_blank" rel="noopener" title="Source: ${esc(src)}">${badge}</a>`;
}

/** DESIGN.md card fee line: "Yield 3.1% · live" (reads yield_pct directly — computeCost excludes it) or a cost teaser, or a pass-through note. */
export function feeLine(entry) {
  const line = feeLineInner(entry);
  const link = PRODUCT_COST_LINKS[entry?.id];
  if (!link) return line;
  const href = `compare.html?group=${link.group}&market=${link.market}#calc-mount`;
  return h`${line} <a class="fee-compare-link" href="${href}">Compare what it costs to buy → ${esc(COST_GROUPS[link.group].label.toLowerCase())}</a>`;
}

function feeLineInner(entry) {
  const fees = entry?.fees || [];
  // Several yields (e.g. FD board rates per bank, CPF per account): show the range and name the best.
  const yields = fees.filter(f => f.type === 'yield_pct');
  if (yields.length > 1) {
    const best = yields.reduce((a, b) => (b.value > a.value ? b : a));
    const low = Math.min(...yields.map(y => y.value));
    return h`<span class="fee-line" title="${esc(yields.map(y => `${y.label || 'Rate'}: ${y.value}%`).join('\n'))}">${icon('bill', { size: 14 })} Yield ${low}–${best.value}% <span class="muted">(best: ${esc(best.label || '')})</span> ${freshnessBadge(best)}</span>`;
  }
  if (yields.length === 1) {
    return h`<span class="fee-line">${icon('bill', { size: 14 })} Yield ${yields[0].value}% ${freshnessBadge(yields[0])}</span>`;
  }
  // Exchange pass-through fees (e.g. SGX clearing/trading) are the same at every broker: list them by
  // label rather than as a "From" price. One badge, for the oldest figure.
  const exchange = fees.filter(f => f.group === 'exchange' && f.label);
  if (exchange.length) {
    const oldest = exchange.reduce((a, b) => ((b.asOf || '') < (a.asOf || '') ? b : a));
    return h`<span class="fee-line">${icon('bill', { size: 14 })} ${exchange.map(f => `${esc(f.label)} ${f.value}%`).join(' · ')} <span class="muted">per trade, on top of broker fees</span> ${freshnessBadge(oldest)}</span>`;
  }
  const costComp = bestFeeComponent(entry);
  if (costComp) {
    const unit = costComp.currency === 'PCT' ? '%' : ` ${costComp.currency}`;
    return h`<span class="fee-line">${icon('bill', { size: 14 })} From ${costComp.value}${unit} ${freshnessBadge(costComp)}</span>`;
  }
  if (entry?.providers?.length) {
    return h`<span class="fee-line muted">${icon('bill', { size: 14 })} Fees via your broker →</span>`;
  }
  return h`<span class="fee-line muted">${icon('bill', { size: 14 })} Fees not tracked yet</span>`;
}

// ============================================================================
// Glossary
// ============================================================================

const GLOSSARY = {
  cdp: 'Central Depository — MAS-linked registry that holds Singapore shares directly in your own name.',
  custodian: 'Custodian / nominee account — your broker holds shares in trust on your behalf, bundled with other clients’.',
  srs: 'Supplementary Retirement Scheme — a tax-deferred account you can invest from; withdrawals before the statutory age are taxed and penalised.',
  cpf: 'Central Provident Fund — Singapore’s mandatory savings scheme (Ordinary, Special, MediSave, Retirement accounts).',
  'cpf-oa': 'CPF Ordinary Account — earns a government-set interest rate (see the CPF Top-Ups card for the current figure); can be invested via CPFIS within limits.',
  aum: 'Assets under management — the value of what a platform manages for you; many robo-advisors charge an annual % of this.',
  'expense-ratio': 'The fund’s own yearly running cost, taken out of its returns before you see them.',
  rsp: 'Regular Savings Plan — investing a fixed amount on a schedule (e.g. monthly), regardless of price.',
  liquidity: 'How quickly you can turn the investment back into spendable cash.',
  etf: 'Exchange-Traded Fund — a basket of many stocks or bonds that trades on an exchange like a single share.',
  reit: 'Real Estate Investment Trust — owns income-producing property and distributes most rental income to unit holders.',
  'sales-charge': 'A one-off percentage fee taken when you buy into a fund, on top of its running costs.',
  ssb: 'Singapore Savings Bond — a government bond for individuals with step-up interest and no penalty for early redemption.',
};

export function glossaryTooltips(root = document) {
  root.querySelectorAll('abbr[data-glossary]').forEach(el => {
    const key = el.getAttribute('data-glossary');
    const def = GLOSSARY[key];
    if (!def) return;
    if (!el.title) el.title = def;
    el.tabIndex = 0;
    el.classList.add('glossary-term');
  });
}

function openGlossaryModal() {
  const body = document.createElement('div');
  body.innerHTML = h`
    <h2 id="glossary-title">Glossary</h2>
    <dl class="glossary-list">
      ${Object.entries(GLOSSARY).map(([k, v]) => h`<dt>${esc(k.replace(/-/g, ' '))}</dt><dd>${esc(v)}</dd>`).join('')}
    </dl>`;
  openModal(body, { labelledBy: 'glossary-title' });
}

// ============================================================================
// Entry card (products / methods / brokers share this)
// ============================================================================

export function entryCard(entry, world) {
  const worldColorClass = `world-${world}`;
  const showGd = world === 'products' && typeof entry.growthVsDividend === 'number';
  return h`
    <article class="card entry-card ${worldColorClass}" data-entry-id="${esc(entry.id)}">
      <div class="card-top"></div>
      <div class="card-body">
        <div class="card-head">
          <span class="card-icon">${icon(entry.icon || 'chart', { size: 26 })}</span>
          <div>
            <h3 class="card-title">${esc(entry.name)}</h3>
            <p class="card-analogy">${esc(entry.analogy || '')}</p>
          </div>
        </div>
        <p class="card-summary">${esc(entry.summary)}</p>
        <div class="meter-row">
          ${meterDots(entry.riskLevel, 5, 'Risk')}<span class="meter-label">Risk</span>
          ${meterDots(entry.liquidity, 5, 'Liquidity')}<span class="meter-label">Liquidity</span>
          ${meterDots(entry.complexity, 5, 'Complexity')}<span class="meter-label">Complexity</span>
        </div>
        ${showGd ? gdBar(entry.growthVsDividend) : ''}
        ${returnDriverChips(entry.returnDrivers)}
        <div class="card-fee">${feeLine(entry)}</div>
      </div>
      <div class="card-actions">
        <button type="button" class="btn btn-ghost" data-action="flip-card">${icon('info', { size: 16 })} Pros &amp; cons</button>
        <button type="button" class="btn btn-primary" data-action="open-stepper">${icon('key', { size: 16 })} How to start</button>
      </div>
    </article>`;
}

/** Mounts card interactivity (flip + stepper) for all `.entry-card` under root, looking entries up via `getEntry(id)`. */
export function wireEntryCards(root, getEntry) {
  root.querySelectorAll('[data-action="flip-card"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.closest('[data-entry-id]')?.dataset.entryId;
      const entry = getEntry(id);
      if (entry) openProsConsModal(entry);
    });
  });
  root.querySelectorAll('[data-action="open-stepper"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.closest('[data-entry-id]')?.dataset.entryId;
      const entry = getEntry(id);
      if (entry) openStepperModal(entry);
    });
  });
}

// ============================================================================
// Pros & cons flip card (shown as an accessible modal — works identically on touch)
// ============================================================================

export function openProsConsModal(entry) {
  const body = document.createElement('div');
  body.innerHTML = h`
    <h2 id="proscons-title">${esc(entry.name)}</h2>
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
  `;
  openModal(body, { labelledBy: 'proscons-title' });
  glossaryTooltips(body);
}

// ============================================================================
// Stepper modal: numbered progress, back/next, checklist saved to localStorage
// ============================================================================

export function openStepperModal(entry) {
  const steps = entry.steps?.length ? entry.steps : [{ title: 'Details coming soon', detail: 'Sign-up steps for this entry have not been written yet.', link: entry.officialLink }];
  const storeKey = `steps:${entry.id}`;
  let done = new Set();
  try { done = new Set(JSON.parse(ls(storeKey) || '[]')); } catch { done = new Set(); }
  let idx = 0;

  const body = document.createElement('div');
  body.className = 'stepper';
  openModal(body, { labelledBy: 'stepper-title', size: 'lg' });

  function save() { lsSet(storeKey, JSON.stringify([...done])); }

  function render() {
    const step = steps[idx];
    const isLast = idx === steps.length - 1;
    body.innerHTML = h`
      <h2 id="stepper-title">${esc(entry.name)}: how to start</h2>
      <div class="stepper-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="${idx + 1}">
        ${steps.map((_, i) => `<span class="stepper-dot${i === idx ? ' is-active' : ''}${done.has(i) ? ' is-done' : ''}"></span>`).join('')}
        <span class="stepper-count">Step ${idx + 1} of ${steps.length}</span>
      </div>
      <div class="stepper-step">
        <label class="stepper-check">
          <input type="checkbox" data-action="toggle-done" ${done.has(idx) ? 'checked' : ''} />
          <h3>${esc(step.title)}</h3>
        </label>
        <p>${esc(step.detail)}</p>
        ${step.link ? `<a class="link-out" href="${esc(step.link)}" target="_blank" rel="noopener">${icon('external', { size: 14 })} Open official page</a>` : ''}
      </div>
      <div class="modal-actions stepper-actions">
        <button type="button" class="btn btn-ghost" data-action="back" ${idx === 0 ? 'disabled' : ''}>Back</button>
        ${isLast
          ? `<a class="btn btn-primary" href="${esc(step.link || entry.officialLink || '#')}" target="_blank" rel="noopener">${icon('external', { size: 16 })} Go to official site</a>`
          : `<button type="button" class="btn btn-primary" data-action="next">Next</button>`}
      </div>`;

    body.querySelector('[data-action="toggle-done"]').addEventListener('change', e => {
      if (e.target.checked) done.add(idx); else done.delete(idx);
      save();
      render();
    });
    body.querySelector('[data-action="back"]')?.addEventListener('click', () => { idx = Math.max(0, idx - 1); render(); });
    body.querySelector('[data-action="next"]')?.addEventListener('click', () => { idx = Math.min(steps.length - 1, idx + 1); render(); });
  }
  render();
  glossaryTooltips(body);
}

// ============================================================================
// Providers table (methods / brokers cards)
// ============================================================================

export function providersTable(entry, scenario, fx) {
  const providers = entry.providers || [];
  if (!providers.length) return '<p class="muted">No specific providers listed yet.</p>';
  const { ranked, incomplete } = rankByCost(providers, scenario, fx);
  const rows = [];
  ranked.forEach((r, i) => {
    rows.push(h`
      <tr>
        <td>${i === 0 ? crown() : ''} ${esc(r.item.name)}</td>
        <td>${formatSGD(r.total)}</td>
        <td>${freshnessBadge(bestFeeComponent(r.item))}</td>
        <td><a class="link-out" href="${esc(r.item.officialLink)}" target="_blank" rel="noopener">${icon('external', { size: 14 })} Site</a></td>
      </tr>`);
  });
  incomplete.forEach(r => {
    rows.push(h`
      <tr class="is-incomplete">
        <td>${esc(r.item.name)}</td>
        <td class="muted">—</td>
        <td class="muted" title="${esc(r.reasons.join('; '))}">${icon('warning', { size: 12 })} incomplete</td>
        <td><a class="link-out" href="${esc(r.item.officialLink)}" target="_blank" rel="noopener">${icon('external', { size: 14 })} Site</a></td>
      </tr>`);
  });
  return h`
    <div class="table-scroll">
      <table class="data-table providers-table">
        <caption class="sr-only">Providers for ${esc(entry.name)}, ranked by cost for: ${esc(describeScenario(scenario))}</caption>
        <thead><tr><th>Provider</th><th>Est. cost</th><th>Data</th><th></th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

// ============================================================================
// Fee-drag calculator (shared: methods.html, brokers.html, compare.html)
// ============================================================================

/**
 * mountFeeCalculator(container, { items, fx, scope, onRender })
 * items: array of { item, world } candidates (Provider or Entry objects with `fees`).
 * Renders inputs + preset buttons + a bar-chart mount point; caller supplies the
 * chart renderer via `renderChart(canvas, ranked, incomplete, scenario)` (charts.js).
 */
export function mountFeeCalculator(container, { items, fx, renderChart, title = 'Fee-drag calculator', initialScenario, initialGroup }) {
  let scenario = { ...DEFAULT_SCENARIO, ...(initialScenario || {}) };
  const groupKeys = Object.keys(COST_GROUPS).filter(g => items.some(x => costGroupOf(x.item) === g));
  let group = groupKeys.includes(initialGroup) ? initialGroup : groupKeys[0];

  container.innerHTML = h`
    <div class="calc">
      <h3>${title}</h3>
      <label class="calc-group">Compare
        <select data-el="calc-group">
          ${groupKeys.map(g => `<option value="${g}" ${g === group ? 'selected' : ''}>${esc(COST_GROUPS[g].label)}</option>`).join('')}
        </select>
      </label>
      <div class="calc-presets">
        ${Object.entries(PRESETS).map(([key, p]) => `<button type="button" class="chip chip-btn" data-preset="${key}">${esc(p.label)}</button>`).join('')}
      </div>
      <form class="calc-form" data-action="calc-form">
        <label>Lump sum (S$)<input type="number" min="0" step="500" name="lumpSum" value="${scenario.lumpSum}"></label>
        <label>Monthly (S$)<input type="number" min="0" step="50" name="monthly" value="${scenario.monthly}"></label>
        <label>Years<input type="number" min="1" max="40" step="1" name="years" value="${scenario.years}"></label>
        <label>Trades / month<input type="number" min="0" max="60" step="1" name="tradesPerMonth" value="${scenario.tradesPerMonth}"></label>
        <label title="Only used for brokers that charge per share (e.g. some US pricing plans)">Typical share price<input type="number" min="1" step="1" name="sharePrice" value="${scenario.sharePrice ?? DEFAULT_SHARE_PRICE}"></label>
        <label>Market
          <select name="market">
            <option value="SG" ${scenario.market === 'SG' ? 'selected' : ''}>Singapore</option>
            <option value="US" ${scenario.market === 'US' ? 'selected' : ''}>United States</option>
            <option value="HK" ${scenario.market === 'HK' ? 'selected' : ''}>Hong Kong</option>
          </select>
        </label>
      </form>
      <p class="calc-scenario" data-el="scenario-text"></p>
      <p class="muted calc-caveat" data-el="calc-caveat"></p>
      <div class="chart-wrap"><canvas data-el="calc-canvas" role="img"></canvas></div>
      <p class="muted calc-fx" data-el="calc-fx"></p>
      <details class="chart-table"><summary>Show as table</summary><div data-el="calc-table"></div></details>
      <div class="calc-incomplete" data-el="calc-incomplete"></div>
    </div>`;

  const form = container.querySelector('[data-action="calc-form"]');
  const scenarioText = container.querySelector('[data-el="scenario-text"]');
  const canvas = container.querySelector('[data-el="calc-canvas"]');
  const tableMount = container.querySelector('[data-el="calc-table"]');
  const incompleteMount = container.querySelector('[data-el="calc-incomplete"]');

  function readForm() {
    const fd = new FormData(form);
    scenario = {
      lumpSum: Number(fd.get('lumpSum')) || 0,
      monthly: Number(fd.get('monthly')) || 0,
      years: Number(fd.get('years')) || 1,
      tradesPerMonth: Number(fd.get('tradesPerMonth')) || 0,
      sharePrice: Number(fd.get('sharePrice')) || DEFAULT_SHARE_PRICE,
      market: fd.get('market') || 'SG',
    };
  }

  function update() {
    scenarioText.textContent = `Ranking ${COST_GROUPS[group]?.label.toLowerCase() || 'providers'} for: ${describeScenario(scenario)}`;
    container.querySelector('[data-el="calc-caveat"]').textContent = COST_GROUPS[group]?.caveat || '';
    const { ranked, incomplete } = rankByCost(items.map(x => x.item).filter(it => costGroupOf(it) === group), scenario, fx);
    renderChart(canvas, ranked, scenario);
    // Published currency-conversion fees are shown beside the estimate, never added to it (see cost.js `info`).
    const showFx = ranked.some(r => r.info?.length);
    const withFx = ranked.filter(r => r.info?.length);
    container.querySelector('[data-el="calc-fx"]').innerHTML = withFx.length
      ? h`${icon('info', { size: 14 })} Currency conversion fees, <strong>not in the totals</strong> (few brokers publish one): ${withFx.map(r => `${esc(r.item.name)} ${r.info[0].pct}%`).join(' · ')}.`
      : '';
    const fxCell = r => {
      const f = r.info?.find(i => i.type === 'fx_spread_pct');
      return f ? `<td>${f.pct}% ${freshnessBadge(f.component)}</td>` : '<td class="muted">not published</td>';
    };
    tableMount.innerHTML = h`
      <table class="data-table">
        <thead><tr><th>Provider</th><th>Estimated cost</th>${showFx ? '<th>Currency conversion <span class="muted">(not in total)</span></th>' : ''}</tr></thead>
        <tbody>${ranked.map((r, i) => `<tr><td>${i === 0 ? crown() : ''} ${esc(r.item.name)}</td><td>${formatSGD(r.total)}</td>${showFx ? fxCell(r) : ''}</tr>`).join('') || '<tr><td colspan="2" class="muted">No complete data for this scenario.</td></tr>'}</tbody>
      </table>`;
    incompleteMount.innerHTML = incomplete.length ? h`
      <p class="muted incomplete-heading">${icon('warning', { size: 14 })} Incomplete data — excluded from ranking:</p>
      <ul class="incomplete-list">
        ${incomplete.map(r => `<li><span class="incomplete-name">${esc(r.item.name)}</span> — ${esc(r.reasons.join('; '))}</li>`).join('')}
      </ul>` : '';
  }

  form.addEventListener('input', () => { readForm(); update(); });
  container.querySelector('[data-el="calc-group"]').addEventListener('change', e => { group = e.target.value; update(); });
  container.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      scenario = { ...PRESETS[btn.dataset.preset] };
      form.lumpSum.value = scenario.lumpSum;
      form.monthly.value = scenario.monthly;
      form.years.value = scenario.years;
      form.tradesPerMonth.value = scenario.tradesPerMonth;
      form.sharePrice.value = scenario.sharePrice ?? DEFAULT_SHARE_PRICE;
      form.market.value = scenario.market;
      update();
    });
  });
  onThemeChange(() => update());
  update();

  return { getScenario: () => scenario, refresh: update };
}

// ============================================================================
// Empty state panel
// ============================================================================

export function emptyStatePanel(container, { title = 'No data yet', detail = 'Run the scraper to generate data.' } = {}) {
  container.innerHTML = h`
    <div class="empty-panel">
      ${icon('warning', { size: 32 })}
      <h3>${esc(title)}</h3>
      <p>${esc(detail)}</p>
      <code>npm run scrape</code>
    </div>`;
}

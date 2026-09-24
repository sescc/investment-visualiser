// Data loading, freshness, query-string (deep link) codec, and small lookup helpers.
// Contract: window.SGDATA (classic script) → fetch ../data/sgdata.json → empty-state object.
// Never throws: every page must render, even with no data/ present yet.

import { PRESETS, DEFAULT_SCENARIO } from './cost.js';

const DATASETS = ['products', 'methods', 'brokers'];

function emptyData() {
  return {
    empty: true,
    generatedAt: null,
    fx: {},
    report: [],
    products: { dataset: 'products', entries: [] },
    methods: { dataset: 'methods', entries: [] },
    brokers: { dataset: 'brokers', entries: [] },
  };
}

// Accepts a few plausible shapes so this survives however the scraper's merge finally serializes:
// { products:{entries}, methods:{entries}, brokers:{entries}, generatedAt, fx, report }
// or an array of the three baseline-shaped dataset objects, keyed by `.dataset`.
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return emptyData();
  const out = emptyData();
  out.empty = false;
  out.generatedAt = raw.generatedAt || null;
  out.fx = raw.fx || {};
  out.report = Array.isArray(raw.report) ? raw.report : [];

  if (Array.isArray(raw)) {
    for (const ds of raw) {
      if (ds && DATASETS.includes(ds.dataset)) out[ds.dataset] = ds;
    }
  } else if (Array.isArray(raw.datasets)) {
    for (const ds of raw.datasets) {
      if (ds && DATASETS.includes(ds.dataset)) out[ds.dataset] = ds;
    }
  } else {
    for (const key of DATASETS) {
      if (raw[key]?.entries) out[key] = raw[key];
    }
  }

  // Providers remember their parent entry so calculators can compare like with like (see costGroupOf in cost.js).
  for (const key of DATASETS) {
    for (const e of out[key]?.entries || []) (e.providers || []).forEach(p => { p.entryId = e.id; });
  }

  const hasAny = DATASETS.some(k => (out[k]?.entries || []).length > 0);
  if (!hasAny) out.empty = true;
  return out;
}

let _cache = null;

/** getData() → normalized dataset bundle. Never rejects. */
export async function getData() {
  if (_cache) return _cache;

  if (typeof window !== 'undefined' && window.SGDATA) {
    _cache = normalize(window.SGDATA);
    return _cache;
  }

  try {
    const res = await fetch('../data/sgdata.json');
    if (res.ok) {
      const json = await res.json();
      _cache = normalize(json);
      return _cache;
    }
  } catch (e) {
    // file:// CORS, missing file, or network error — fall through to empty state.
  }

  _cache = emptyData();
  return _cache;
}

/** Force a re-fetch next call (used after a successful "Refresh data"). */
export function invalidateCache() {
  _cache = null;
}

export function isEmpty(data) {
  return !!data?.empty;
}

// ---------- lookups ----------

export function worldOf(id) {
  if (typeof id !== 'string') return null;
  if (id.startsWith('p-')) return 'products';
  if (id.startsWith('m-')) return 'methods';
  if (id.startsWith('b-')) return 'brokers';
  return null;
}

export function allEntries(data) {
  return DATASETS.flatMap(world => (data[world]?.entries || []).map(e => ({ ...e, world })));
}

export function findEntry(data, id) {
  const world = worldOf(id);
  const pool = world ? (data[world]?.entries || []) : allEntries(data);
  const found = pool.find(e => e.id === id);
  return found ? { ...found, world: world || found.world } : null;
}

/** Find a provider by "entryId/providerId" or by providerId alone (first match). */
export function findProvider(data, ref) {
  if (!ref) return null;
  const [entryId, providerId] = ref.includes('/') ? ref.split('/') : [null, ref];
  for (const world of DATASETS) {
    for (const e of data[world]?.entries || []) {
      if (entryId && e.id !== entryId) continue;
      const p = (e.providers || []).find(p => p.id === providerId);
      if (p) return { provider: p, entry: e, world };
    }
  }
  return null;
}

// ---------- freshness (CLAUDE.md: live ≤30d, aging ≤90d, stale >90d, missing = no component) ----------

export function freshness(asOf, now = new Date()) {
  if (!asOf) return 'missing';
  const d = new Date(asOf);
  if (isNaN(d.getTime())) return 'missing';
  const days = (now - d) / 86400000;
  if (days <= 30) return 'live';
  if (days <= 90) return 'aging';
  return 'stale';
}

export function freshnessOfComponent(comp) {
  return comp ? freshness(comp.asOf) : 'missing';
}

/** Freshest / most-informative fee component for an entry (checked across entry + providers). */
export function bestFeeComponent(entry) {
  const every = [...(entry?.fees || []), ...(entry?.providers || []).flatMap(p => p.fees || [])];
  // Prefer cost-bearing components: a display-only FX markup or an `other` note must never become the headline price.
  const costly = every.filter(f => f.type !== 'fx_spread_pct' && f.type !== 'other');
  const all = costly.length ? costly : every;
  if (!all.length) return null;
  const rank = { live: 0, aging: 1, stale: 2, missing: 3 };
  return all.slice().sort((a, b) => rank[freshnessOfComponent(a)] - rank[freshnessOfComponent(b)])[0];
}

/**
 * Site-wide freshness pill summary, counted over everything that *should* have fee data
 * (each entry/provider with feeSpecs), not over adapters — so unscrapable sources show up as gaps.
 * → { total, live, covered, missing: [{ name, sourceUrl }], generatedAt }
 */
export function freshnessSummary(data) {
  const targets = allEntries(data).flatMap(e => [e, ...(e.providers || [])]).filter(t => (t.feeSpecs || []).length);
  const missing = [];
  let live = 0, covered = 0;
  for (const t of targets) {
    const fees = t.fees || [];
    if (!fees.length) { missing.push({ name: t.name, sourceUrl: t.feeSpecs[0].sourceUrl }); continue; }
    covered++;
    if (fees.some(c => freshnessOfComponent(c) === 'live')) live++;
  }
  return { total: targets.length, live, covered, missing, generatedAt: data.generatedAt };
}

// ---------- scenario / deep-link query-string codec (shared by quiz → compare, calculators) ----------

const SCENARIO_KEYS = ['lumpSum', 'monthly', 'years', 'tradesPerMonth', 'market'];

function samePreset(a, b) {
  return SCENARIO_KEYS.every(k => a[k] === b?.[k]);
}

/** Encodes to a preset key when possible (short, readable URL), else a compact JSON blob. */
export function encodeScenario(scenario) {
  if (!scenario) return '';
  for (const [key, preset] of Object.entries(PRESETS)) {
    if (samePreset(preset, scenario)) return key;
  }
  const custom = {};
  for (const k of SCENARIO_KEYS) if (scenario[k] !== undefined) custom[k] = scenario[k];
  return 'c' + encodeURIComponent(JSON.stringify(custom));
}

export function decodeScenario(param) {
  if (!param) return { ...DEFAULT_SCENARIO };
  if (PRESETS[param]) return { ...PRESETS[param] };
  if (param.startsWith('c')) {
    try {
      const obj = JSON.parse(decodeURIComponent(param.slice(1)));
      return { ...DEFAULT_SCENARIO, ...obj };
    } catch {
      return { ...DEFAULT_SCENARIO };
    }
  }
  return { ...DEFAULT_SCENARIO };
}

export function parseQuery(search) {
  const params = new URLSearchParams(search ?? (typeof location !== 'undefined' ? location.search : ''));
  const ids = (params.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);
  return { ids, scenario: decodeScenario(params.get('scenario')) };
}

export function buildQuery({ ids, scenario } = {}) {
  const params = new URLSearchParams();
  if (ids?.length) params.set('ids', ids.join(','));
  if (scenario) params.set('scenario', encodeScenario(scenario));
  return params.toString();
}

export function buildCompareUrl(opts) {
  return `compare.html?${buildQuery(opts)}`;
}

// ---------- refresh button (server.js, same-origin only) ----------

export async function checkRefreshAvailable() {
  if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return false;
  try {
    const res = await fetch('/api/health', { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function triggerRefresh() {
  try {
    const res = await fetch('/api/refresh', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export { PRESETS, DEFAULT_SCENARIO };

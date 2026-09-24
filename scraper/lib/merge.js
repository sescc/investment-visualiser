// Merges adapter output into the hand-authored baseline datasets. See the
// "Data schema" and "Adapter contract" sections of CLAUDE.md for the shapes
// referenced here.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DATASETS = ['products', 'methods', 'brokers'];
const BASELINE_DIR = path.join(process.cwd(), 'data', 'baseline');

// Load the three baseline files. A missing file becomes an empty dataset (with
// a warning pushed onto `warnings`) so the scraper still runs before/without
// the content team's files.
export async function loadBaselines(warnings = []) {
  const baselines = {};
  for (const name of DATASETS) {
    const file = path.join(BASELINE_DIR, `${name}.json`);
    try {
      baselines[name] = JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      warnings.push(`baseline ${name}.json missing or unreadable (${err.code || err.message}) — using empty dataset`);
      baselines[name] = { dataset: name, entries: [] };
    }
  }
  return baselines;
}

// An adapter may name the page each component was read from (`c.source`); only an https URL is
// accepted, anything else falls back to the adapter's own url so a bad value never drops good data.
function sourceOf(c, url) {
  try {
    if (typeof c.source === 'string' && new URL(c.source).protocol === 'https:') return c.source;
  } catch { /* not a URL */ }
  return url;
}

// Today's date in Asia/Singapore, as YYYY-MM-DD.
export function todaySGT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
}

/**
 * merge(baselines, adapterResults, previous)
 *
 * baselines:      { products, methods, brokers } — each { dataset, entries } (from loadBaselines)
 * adapterResults: [{ id, url, ok, error?, components }] — components are the raw
 *                 (already-validated) objects an adapter's scrape() returned
 * previous:       the last written data/sgdata.json contents, or null
 *
 * Returns { merged: {products,methods,brokers}, fx, report, warnings }.
 */
export function merge(baselines, adapterResults, previous, existingIds = null) {
  const asOf = todaySGT();
  const warnings = [];
  const report = [];
  const fx = {};

  // Clone baselines; every entry/provider starts this run with fees reset to
  // [] so stale components never survive across runs.
  const merged = {};
  for (const name of DATASETS) {
    merged[name] = {
      dataset: baselines[name].dataset || name,
      entries: (baselines[name].entries || []).map((e) => ({
        ...e,
        fees: [],
        providers: (e.providers || []).map((p) => ({ ...p, fees: [] })),
      })),
    };
  }

  // Resolve a "entryId" or "entryId/providerId" target to its live object in `merged`.
  function findTarget(target) {
    const [entryId, providerId] = target.split('/');
    for (const name of DATASETS) {
      const entry = merged[name].entries.find((e) => e.id === entryId);
      if (!entry) continue;
      if (!providerId) return entry;
      return entry.providers.find((p) => p.id === providerId) || null;
    }
    return null;
  }

  // Index every fee component in the previous run by the adapter that produced
  // it, so a failing adapter this run can have its stale data carried over.
  const previousByAdapter = new Map();
  function rememberPrevious(adapterId, target, fee) {
    if (!previousByAdapter.has(adapterId)) previousByAdapter.set(adapterId, []);
    previousByAdapter.get(adapterId).push({ target, fee });
  }
  if (previous) {
    for (const name of DATASETS) {
      for (const entry of previous[name]?.entries || []) {
        for (const fee of entry.fees || []) {
          if (fee.adapter) rememberPrevious(fee.adapter, entry.id, fee);
        }
        for (const provider of entry.providers || []) {
          for (const fee of provider.fees || []) {
            if (fee.adapter) rememberPrevious(fee.adapter, `${entry.id}/${provider.id}`, fee);
          }
        }
      }
    }
    for (const [pair, comp] of Object.entries(previous.fx || {})) {
      if (comp?.adapter) rememberPrevious(comp.adapter, '_fx', { ...comp, pair, type: 'fx' });
    }
  }

  for (const result of adapterResults) {
    const { id, url, ok, error, components = [] } = result;
    let count = 0;

    if (ok) {
      for (const c of components) {
        if (c.target === '_fx' && c.type === 'fx') {
          fx[c.pair] = { value: c.value, asOf, source: sourceOf(c, url), adapter: id, lastRunOk: true };
          count++;
          continue;
        }
        const target = findTarget(c.target);
        if (!target) {
          warnings.push(`${id}: unknown target "${c.target}"`);
          continue;
        }
        const { target: _drop, ...rest } = c;
        target.fees.push({ ...rest, asOf, source: sourceOf(c, url), adapter: id, lastRunOk: true });
        count++;
      }
    } else {
      // Carry over this adapter's components from the previous run, stamped stale.
      for (const { target: targetKey, fee } of previousByAdapter.get(id) || []) {
        if (targetKey === '_fx') {
          fx[fee.pair] = { value: fee.value, asOf: fee.asOf, source: fee.source, adapter: id, lastRunOk: false };
        } else {
          const target = findTarget(targetKey);
          if (target) target.fees.push({ ...fee, lastRunOk: false });
        }
        count++;
      }
    }

    report.push({ adapter: id, ok, count, ...(error ? { error } : {}) });
  }

  // Adapters not run this time (e.g. --only) keep their previous components and report rows untouched.
  // Adapters whose file no longer exists (existingIds) are dropped, so deleted sources don't linger forever.
  const ran = new Set(adapterResults.map((r) => r.id));
  const stillExists = (id) => !existingIds || existingIds.has(id);
  for (const [adapterId, items] of previousByAdapter) {
    if (ran.has(adapterId) || !stillExists(adapterId)) continue;
    for (const { target: targetKey, fee } of items) {
      if (targetKey === '_fx') {
        const { pair, type: _t, ...rest } = fee;
        fx[pair] = rest;
      } else {
        const target = findTarget(targetKey);
        if (target) target.fees.push(fee);
      }
    }
  }
  for (const row of previous?.report || []) {
    if (!ran.has(row.adapter) && stillExists(row.adapter)) report.push(row);
  }

  return { merged, fx, report, warnings };
}

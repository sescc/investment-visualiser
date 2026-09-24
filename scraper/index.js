#!/usr/bin/env node
// CLI + in-process entry point for the fee scraper.
// Discovers scraper/sources/*.js adapters, runs each one, validates what it
// returns, merges the result into the baseline datasets, and writes
// data/sgdata.json + data/sgdata.js. See CLAUDE.md for the full data model
// and the adapter contract.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getText, getJSON } from './lib/http.js';
import * as extract from './lib/extract.js';
import { loadBaselines, merge } from './lib/merge.js';
import { renderPage, closeBrowser } from './lib/browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SOURCES_DIR = path.join(__dirname, 'sources');
const OUT_JSON = path.join(ROOT, 'data', 'sgdata.json');
const OUT_JS = path.join(ROOT, 'data', 'sgdata.js');

// FeeType enum from CLAUDE.md. 'fx' is a separate special case (see below),
// not a normal fee type.
const FEE_TYPES = new Set([
  'per_trade_pct', 'per_trade_min', 'per_trade_flat', 'per_share', 'per_trade_max_pct', 'fx_spread_pct',
  'aum_annual_pct', 'custody_monthly', 'platform_flat_annual',
  'sales_charge_pct', 'transaction_flat', 'yield_pct', 'other',
]);

async function discoverAdapters() {
  let files;
  try {
    files = await readdir(SOURCES_DIR);
  } catch {
    return [];
  }
  const adapters = [];
  for (const file of files.sort()) {
    if (!file.endsWith('.js') || file.startsWith('_')) continue;
    const mod = await import(pathToFileURL(path.join(SOURCES_DIR, file)).href);
    adapters.push(mod.default);
  }
  return adapters;
}

// A component is valid if it has a target, a finite numeric value, and either
// a known FeeType, or is the special `{ target:'_fx', type:'fx' }` fx component.
export function invalidReason(c) {
  if (!c || typeof c !== 'object') return 'component is not an object';
  if (!c.target || typeof c.target !== 'string') return 'missing target';
  const isFx = c.target === '_fx' && c.type === 'fx';
  if (!isFx && !FEE_TYPES.has(c.type)) return `unknown type "${c.type}"`;
  if (typeof c.value !== 'number' || !Number.isFinite(c.value)) return 'value is not a finite number';
  if (c.sharePrice !== undefined) {
    const sp = c.sharePrice;
    if (!sp || typeof sp !== 'object' || Array.isArray(sp)) return 'sharePrice is not an object';
    if (sp.from == null && sp.below == null) return 'sharePrice needs from and/or below';
    for (const k of ['from', 'below']) {
      if (sp[k] != null && (typeof sp[k] !== 'number' || !Number.isFinite(sp[k]))) return `sharePrice.${k} is not a finite number`;
    }
    if (!(c.type.startsWith('per_trade') || c.type === 'per_share')) return 'sharePrice only applies to per-trade/per-share fees';
  }
  return null;
}

async function fetchContext(adapter) {
  if (adapter.format === 'json') {
    const json = await getJSON(adapter.url);
    return { json, extract };
  }
  if (adapter.format === 'browser') {
    // Lazily launches one shared headless Edge instance (playwright-core,
    // channel 'msedge') the first time any adapter needs it. adapter.waitFor
    // (string selector | RegExp | function(text)) lets the adapter wait past
    // hydration instead of reading a JS-free placeholder. See lib/browser.js.
    const { html } = await renderPage(adapter.url, { waitFor: adapter.waitFor });
    const $ = extract.load(html);
    const text = extract.cleanText(extract.load(html)); // fresh $ — cleanText mutates (removes script/style)
    return { $, text, extract, renderPage };
  }
  // default: html
  const html = await getText(adapter.url);
  const $ = extract.load(html);
  const text = extract.cleanText(extract.load(html)); // fresh $ — cleanText mutates (removes script/style)
  return { $, text, extract };
}

async function runAdapter(adapter) {
  try {
    const ctx = await fetchContext(adapter);
    const components = await adapter.scrape(ctx);
    if (!Array.isArray(components)) throw new Error('scrape() must return an array');
    for (const c of components) {
      const problem = invalidReason(c);
      if (problem) throw new Error(`invalid component (${problem})`);
    }
    return { id: adapter.id, url: adapter.url, ok: true, components };
  } catch (err) {
    return { id: adapter.id, url: adapter.url, ok: false, error: err.message, components: [] };
  }
}

async function loadPrevious() {
  try {
    return JSON.parse(await readFile(OUT_JSON, 'utf8'));
  } catch {
    return null;
  }
}

function printReport(report, warnings) {
  const rows = report.map((r) => [r.adapter, r.ok ? 'ok' : 'FAIL', String(r.count), r.error || '']);
  const header = ['adapter', 'status', 'components', 'error'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cols) => cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(line(header));
  console.log(line(widths.map((w) => '-'.repeat(w))));
  for (const row of rows) console.log(line(row));
  if (warnings.length) {
    console.log('\nWarnings:');
    for (const w of warnings) console.log('  - ' + w);
  }
}

export async function run({ only, dry = false } = {}) {
  const warnings = [];
  const baselines = await loadBaselines(warnings);
  const previous = await loadPrevious();

  let adapters = await discoverAdapters();
  const existingIds = new Set(adapters.map((a) => a.id));
  if (only?.length) {
    const wanted = new Set(only);
    adapters = adapters.filter((a) => wanted.has(a.id));
  }

  // Run sequentially: lib/http.js already serialises requests per host, and this
  // keeps console output / the report in deterministic file order.
  // The shared headless Edge instance (lib/browser.js) is only launched lazily
  // by the first 'browser'-format adapter, but is always closed here — even if
  // an adapter throws — so `node scraper/index.js` doesn't hang on exit.
  const results = [];
  try {
    for (const adapter of adapters) {
      results.push(await runAdapter(adapter));
    }
  } finally {
    await closeBrowser();
  }

  const { merged, fx, report, warnings: mergeWarnings } = merge(baselines, results, previous, existingIds);
  warnings.push(...mergeWarnings);

  const generatedAt = new Date().toISOString();
  const output = {
    products: merged.products,
    methods: merged.methods,
    brokers: merged.brokers,
    generatedAt,
    fx,
    report,
  };

  if (!dry) {
    await mkdir(path.dirname(OUT_JSON), { recursive: true });
    await writeFile(OUT_JSON, JSON.stringify(output, null, 2) + '\n', 'utf8');
    await writeFile(OUT_JS, `window.SGDATA = ${JSON.stringify(output, null, 2)};\n`, 'utf8');
  }

  printReport(report, warnings);
  console.log(
    dry
      ? '\n(dry run — nothing written)'
      : `\nWrote ${path.relative(ROOT, OUT_JSON)} and ${path.relative(ROOT, OUT_JS)}`
  );

  return { generatedAt, report, warnings };
}

// CLI entry point — only runs when this file is executed directly (not when
// server.js imports run()).
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',').filter(Boolean) : undefined;

  run({ only, dry })
    .then(() => {
      process.exitCode = 0;
    })
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exitCode = 1;
    });
}

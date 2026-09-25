// Pure fee view-models: no DOM, no HTML strings. This is the decision tree behind components.js's
// feeLineInner/feeLine/freshnessBadge, factored out so the visual edition can render the same fee
// facts its own way (see docs/visual/ARCHITECTURE.md: FeeView / feeSummary morphism).

import { bestFeeComponent, freshnessOfComponent } from './data.js';
import { PRODUCT_COST_LINKS, COST_GROUPS } from './cost.js';

// Non-DOM half of components.js's FRESH_META: state → label. (cls/icon stay in components.js, DOM-only.)
export const FRESH_STATE_LABEL = { live: 'live', aging: 'aging', stale: 'stale', missing: 'no data' };

/**
 * freshnessView(component) → { state, label, asOfText, href }
 * state: 'live'|'aging'|'stale'|'missing'. asOfText: formatted date string or null.
 * href: the component's https `source` (merge.js only ever stores https sources) or null.
 */
export function freshnessView(component) {
  const state = freshnessOfComponent(component);
  const asOfText = component?.asOf
    ? new Date(component.asOf).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const src = component?.source;
  const href = (typeof src === 'string' && src.startsWith('https://')) ? src : null;
  return { state, label: FRESH_STATE_LABEL[state], asOfText, href };
}

/** compare.html?group=…&market=…#calc-mount for a product wired via PRODUCT_COST_LINKS, else null. */
function compareLinkFor(entry) {
  const link = PRODUCT_COST_LINKS[entry?.id];
  if (!link) return null;
  return {
    href: `compare.html?group=${link.group}&market=${link.market}#calc-mount`,
    groupLabel: COST_GROUPS[link.group].label,
  };
}

/**
 * feeSummary(entry) → the view-model behind the card fee line. One of:
 *   { kind: 'yield-range', low, best, yields, compareLink }
 *   { kind: 'yield', comp, compareLink }
 *   { kind: 'exchange', comps, oldest, compareLink }
 *   { kind: 'from', comp, unit, compareLink }
 *   { kind: 'via-broker', compareLink }
 *   { kind: 'untracked', compareLink }
 * compareLink is `{ href, groupLabel } | null`, independent of `kind` (see compareLinkFor).
 */
export function feeSummary(entry) {
  const compareLink = compareLinkFor(entry);
  const fees = entry?.fees || [];

  // Several yields (e.g. FD board rates per bank, CPF per account): report the range and name the best.
  const yields = fees.filter(f => f.type === 'yield_pct');
  if (yields.length > 1) {
    const best = yields.reduce((a, b) => (b.value > a.value ? b : a));
    const low = Math.min(...yields.map(y => y.value));
    return { kind: 'yield-range', low, best, yields, compareLink };
  }
  if (yields.length === 1) {
    return { kind: 'yield', comp: yields[0], compareLink };
  }

  // Exchange pass-through fees (e.g. SGX clearing/trading) are the same at every broker.
  const exchange = fees.filter(f => f.group === 'exchange' && f.label);
  if (exchange.length) {
    const oldest = exchange.reduce((a, b) => ((b.asOf || '') < (a.asOf || '') ? b : a));
    return { kind: 'exchange', comps: exchange, oldest, compareLink };
  }

  const costComp = bestFeeComponent(entry);
  if (costComp) {
    const unit = costComp.currency === 'PCT' ? '%' : ` ${costComp.currency}`;
    return { kind: 'from', comp: costComp, unit, compareLink };
  }

  if (entry?.providers?.length) {
    return { kind: 'via-broker', compareLink };
  }
  return { kind: 'untracked', compareLink };
}

/**
 * missingFeeLink(entryOrProvider) → { text, href } | null
 * Pure helper for the "Not available — check provider ↗" case (ARCHITECTURE.md's FeeView `missing` state):
 * present whenever the entry/provider declares feeSpecs (where a figure should come from), regardless of
 * whether a fee component was actually scraped. href is the first feeSpec's sourceUrl.
 */
export function missingFeeLink(entryOrProvider) {
  const specs = entryOrProvider?.feeSpecs || [];
  if (!specs.length) return null;
  return { text: 'Not available — check provider ↗', href: specs[0].sourceUrl };
}

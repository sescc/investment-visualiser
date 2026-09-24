// The only place fee components are turned into money. Used by the calculator and every leaderboard.
// Fee schema: see CLAUDE.md. Percent values are percent numbers (0.08 = 0.08%).

// sharePrice is a user assumption (in the market's own currency), only used by per_share fees.
export const DEFAULT_SHARE_PRICE = 50;
export const PRESETS = {
  rsp: { label: 'S$500/mo RSP', lumpSum: 0, monthly: 500, years: 10, tradesPerMonth: 1, market: 'SG', sharePrice: DEFAULT_SHARE_PRICE },
  lump: { label: 'S$50k lump sum', lumpSum: 50000, monthly: 0, years: 10, tradesPerMonth: 0, market: 'SG', sharePrice: DEFAULT_SHARE_PRICE },
  usActive: { label: '10 US trades/mo', lumpSum: 10000, monthly: 1000, years: 5, tradesPerMonth: 10, market: 'US', sharePrice: DEFAULT_SHARE_PRICE },
};
export const DEFAULT_SCENARIO = PRESETS.rsp;

// Only providers in the same group are ranked against each other (a crypto exchange is not a cheaper stock broker).
export const COST_GROUPS = {
  brokers: { label: 'Stock brokers', entries: ['b-cdp-local', 'b-custodian-app', 'b-international', 'b-bank-integrated', 'b-full-service'],
    caveat: 'Commissions and platform fees only — excludes exchange/clearing fees, GST and any custody charges not published.' },
  robo: { label: 'Robo-advisors', entries: ['m-robo'],
    caveat: 'Advisory/management fee only — the underlying funds charge their own expense ratios.' },
  rsp: { label: 'Regular savings plans', entries: ['m-bank-rsp'],
    caveat: 'Plan fees only — ETF/stock expense ratios not included.' },
  funds: { label: 'Fund platforms & bank unit trusts', entries: ['m-fund-platform', 'b-fund-platform', 'm-bank-unit-trust'],
    caveat: 'Platform and sales charges only — every fund also has its own annual management fee, often the biggest cost.' },
  crypto: { label: 'Crypto exchanges', entries: ['b-crypto-exchange'],
    caveat: 'Trading fee only — spreads, deposit/withdrawal and network fees are extra.' },
  govBonds: { label: 'SSB / T-bill applications', entries: ['m-atm-internet-banking'],
    caveat: 'Bank application fee per application.' },
};
// A product's cost mostly depends on where you buy it: which calculator group (and market) to open for each product.
export const PRODUCT_COST_LINKS = {
  'p-sgx-stocks': { group: 'brokers', market: 'SG' },
  'p-us-hk-stocks': { group: 'brokers', market: 'US' },
  'p-etf': { group: 'brokers', market: 'SG' },
  'p-reit': { group: 'brokers', market: 'SG' },
  'p-corp-bond': { group: 'brokers', market: 'SG' },
  'p-options-cfd': { group: 'brokers', market: 'US' },
  'p-unit-trust': { group: 'funds', market: 'SG' },
  'p-ssb': { group: 'govBonds', market: 'SG' },
  'p-tbill': { group: 'govBonds', market: 'SG' },
  'p-sgs-bond': { group: 'govBonds', market: 'SG' },
  'p-crypto': { group: 'crypto', market: 'SG' },
};

export const costGroupOf = item => Object.keys(COST_GROUPS).find(g => COST_GROUPS[g].entries.includes(item.entryId || item.id)) || null;

const COST_TYPES = new Set([
  'per_trade_pct', 'per_trade_min', 'per_trade_flat', 'per_share', 'per_trade_max_pct', 'fx_spread_pct',
  'aum_annual_pct', 'custody_monthly', 'platform_flat_annual', 'sales_charge_pct', 'transaction_flat',
]);

const fmt = new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 });

export function describeScenario(s) {
  const parts = [];
  if (s.lumpSum) parts.push(`${fmt.format(s.lumpSum)} upfront`);
  if (s.monthly) parts.push(`${fmt.format(s.monthly)}/month`);
  parts.push(`for ${s.years} year${s.years === 1 ? '' : 's'}`);
  if (s.tradesPerMonth) parts.push(`${s.tradesPerMonth} trade${s.tradesPerMonth === 1 ? '' : 's'}/month`);
  parts.push(`${s.market} market`);
  return parts.join(', ');
}

// Components that apply to this market (exact market match wins over ALL).
function pick(fees, type, market) {
  const ofType = (fees || []).filter(f => f.type === type);
  return ofType.find(f => f.market === market) || ofType.find(f => !f.market || f.market === 'ALL') || null;
}

// Convert a component's flat value to SGD via the scraped fx[<CUR>SGD] rate (SGD per one unit).
// Returns null if the needed rate is missing, so the provider is reported incomplete.
function toSGD(comp, fx) {
  if (!comp) return 0;
  if (comp.currency === 'SGD' || comp.currency === 'PCT' || !comp.currency) return comp.value;
  const rate = fx?.[`${comp.currency}SGD`]?.value;
  return rate ? comp.value * rate : null;
}

// Annual AUM rate (percent) for a balance, honouring tiers (blended across bands).
function aumRate(comp, balance) {
  if (!comp.tiers?.length) return comp.value;
  let remaining = balance, prev = 0, fee = 0;
  for (const t of comp.tiers) {
    const cap = t.upTo == null ? Infinity : t.upTo;
    const band = Math.max(0, Math.min(remaining, cap - prev));
    fee += band * t.value / 100;
    remaining -= band;
    prev = cap;
    if (remaining <= 0) break;
  }
  return balance > 0 ? (fee / balance) * 100 : comp.tiers[0].value;
}

/**
 * computeCost(item, scenario, fx) → {
 *   total: number|null (S$, fees only, no investment growth assumed),
 *   breakdown: [{ type, label, amount }],
 *   complete: boolean, reasons: string[], usedComponents: FeeComponent[],
 *   info: [{ type, label, pct, component }]   (shown beside the estimate, never summed — e.g. FX conversion fees)
 * }
 * item: a Provider or Entry with `fees`. Balances are simulated monthly with zero growth (conservative, fee-only).
 */
export function computeCost(item, scenario, fx) {
  const s = { ...DEFAULT_SCENARIO, ...scenario };
  const fees = (item.fees || []).filter(f => COST_TYPES.has(f.type));
  const reasons = [];
  const breakdown = [];
  const used = [];
  const add = (type, label, amount, comp) => {
    if (amount == null) { reasons.push(`${label}: no FX rate to convert ${comp.currency}`); return; }
    if (amount > 0) breakdown.push({ type, label, amount });
    used.push(comp);
  };

  if (!fees.length) {
    return { total: null, breakdown, complete: false, reasons: ['No fee data yet — check provider'], usedComponents: used, info: [] };
  }

  const months = Math.round(s.years * 12);
  const contributions = s.lumpSum + s.monthly * months;
  // No explicit trade count: one buy for the lump sum plus one per monthly contribution.
  const totalTrades = s.tradesPerMonth * months || (s.lumpSum ? 1 : 0) + (s.monthly ? months : 0);
  const tradeSize = totalTrades ? contributions / totalTrades : 0;

  // Per-trade charges: each `group` (default 'commission'; e.g. 'platform') is costed on its own and summed:
  //   fee = max(pct·size + flat + perShare·shares, min), then capped at maxPct·size if a cap is published.
  // Shares per trade come from the scenario's sharePrice assumption (in the fee's currency).
  // A component with `sharePrice: { from?, below? }` applies only when from <= sharePrice < below.
  const price = s.sharePrice || DEFAULT_SHARE_PRICE;
  const appliesAt = f => (f.sharePrice?.from == null || price >= f.sharePrice.from) && (f.sharePrice?.below == null || price < f.sharePrice.below);
  const allPerTradeFees = fees.filter(f => f.type.startsWith('per_trade') || f.type === 'per_share');
  const perTradeFees = allPerTradeFees.filter(appliesAt);
  const groups = [...new Set(perTradeFees.map(f => f.group || 'commission'))];
  let anyTradeModel = false;
  if (totalTrades > 0) {
    for (const g of groups) {
      const inGroup = perTradeFees.filter(f => (f.group || 'commission') === g);
      const pct = pick(inGroup, 'per_trade_pct', s.market);
      const flat = pick(inGroup, 'per_trade_flat', s.market);
      const min = pick(inGroup, 'per_trade_min', s.market);
      const perShare = pick(inGroup, 'per_share', s.market);
      const maxPct = pick(inGroup, 'per_trade_max_pct', s.market);
      if (!(pct || flat || min || perShare)) continue;
      anyTradeModel = true;
      const flatSGD = flat ? toSGD(flat, fx) : 0;
      const minSGD = min ? toSGD(min, fx) : 0;
      const perShareSGD = perShare ? toSGD(perShare, fx) : 0;
      const priceSGD = perShare ? toSGD({ value: price, currency: perShare.currency }, fx) : 1;
      if (flatSGD == null || minSGD == null || perShareSGD == null || priceSGD == null) { reasons.push('Trading fee in foreign currency but no FX rate'); continue; }
      const shares = perShare ? tradeSize / priceSGD : 0;
      let perTrade = Math.max((pct ? pct.value / 100 : 0) * tradeSize + flatSGD + perShareSGD * shares, minSGD);
      if (maxPct) perTrade = Math.min(perTrade, maxPct.value / 100 * tradeSize);
      [pct, flat, min, perShare, maxPct].filter(Boolean).forEach(c => used.push(c));
      const name = g === 'commission' ? 'Commission' : `${g[0].toUpperCase()}${g.slice(1)} fee`;
      breakdown.push({ type: g, label: `${name} (${totalTrades} trades)`, amount: perTrade * totalTrades });
    }
    // Checked against the unfiltered list: a broker whose only tiers exclude this share price must not rank on its other fees alone.
    if (allPerTradeFees.length && !anyTradeModel) reasons.push(`No ${s.market} trading fee found`);
  }

  // Currency-conversion fees are display-only (user decision 2026-09-23): only a few brokers publish one,
  // so summing it would rank transparent brokers as dearer. Returned in `info`, never in total.
  const info = [];
  const fxs = pick(fees, 'fx_spread_pct', s.market);
  if (fxs && s.market !== 'SG') info.push({ type: 'fx_spread_pct', label: 'Currency conversion', pct: fxs.value, component: fxs });

  const sales = pick(fees, 'sales_charge_pct', s.market);
  if (sales) add('sales_charge_pct', 'Sales charge', contributions * sales.value / 100, sales);

  const txn = pick(fees, 'transaction_flat', s.market);
  if (txn) {
    const n = (s.lumpSum ? 1 : 0) + (s.monthly ? months : 0);
    const v = toSGD(txn, fx);
    add('transaction_flat', 'Transaction fees', v == null ? null : v * n, txn);
  }

  const aum = pick(fees, 'aum_annual_pct', s.market);
  if (aum) {
    let balance = s.lumpSum, amount = 0;
    // Optional monthly floor (minMonthly, SGD) and balance-dependent ceilings
    // (monthlyCaps: [{ upTo, cap }], upTo null = rest), e.g. Phillip SBP.
    for (let m = 0; m < months; m++) {
      balance += s.monthly;
      let monthly = balance * aumRate(aum, balance) / 100 / 12;
      if (aum.minMonthly != null) monthly = Math.max(monthly, aum.minMonthly);
      const cap = (aum.monthlyCaps || []).find(c => c.upTo == null || balance < c.upTo);
      if (cap) monthly = Math.min(monthly, cap.cap);
      amount += monthly;
    }
    add('aum_annual_pct', 'Annual management fee', amount, aum);
  }

  const custody = pick(fees, 'custody_monthly', s.market);
  if (custody) { const v = toSGD(custody, fx); add('custody_monthly', 'Custody / account fee', v == null ? null : v * months, custody); }

  const platform = pick(fees, 'platform_flat_annual', s.market);
  if (platform) { const v = toSGD(platform, fx); add('platform_flat_annual', 'Platform fee', v == null ? null : v * s.years, platform); }

  if (!used.length && !reasons.length) reasons.push(`No fees published for the ${s.market} market`);
  const total = breakdown.reduce((a, b) => a + b.amount, 0);
  const complete = reasons.length === 0 && used.length > 0;
  return { total: complete ? total : null, breakdown, complete, reasons, usedComponents: used, info };
}

/** Rank items cheapest-first. Incomplete items are returned separately, never ranked as cheap. */
export function rankByCost(items, scenario, fx) {
  const results = items.map(item => ({ item, ...computeCost(item, scenario, fx) }));
  const ranked = results.filter(r => r.complete).sort((a, b) => a.total - b.total);
  const incomplete = results.filter(r => !r.complete);
  return { ranked, incomplete, scenarioText: describeScenario({ ...DEFAULT_SCENARIO, ...scenario }) };
}

export const formatSGD = v => (v == null ? '—' : fmt.format(v));

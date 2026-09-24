// Synthetic unit checks for cost.js. Numbers here are made-up test inputs, not fee data (the fee rule covers data/ and site/).
// Run: npm test
import assert from 'node:assert/strict';
import { computeCost } from '../site/js/cost.js';

const fx = { USDSGD: { value: 1.25 } };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: got ${a}, want ${b}`);
const phillipLike = { type: 'aum_annual_pct', market: 'SG', value: 0.3, currency: 'PCT', minMonthly: 1,
  monthlyCaps: [{ upTo: 40000, cap: 8.88 }, { upTo: null, cap: 5.88 }] };

// per_share: 1 trade of S$12,500 = US$10,000 at US$50/share = 200 shares x US$0.01 = US$2 = S$2.50; the minimum doesn't bind.
let r = computeCost({ fees: [
  { type: 'per_share', market: 'US', value: 0.01, currency: 'USD' },
  { type: 'per_trade_min', market: 'US', value: 1, currency: 'USD' },
] }, { lumpSum: 12500, monthly: 0, years: 1, tradesPerMonth: 0, market: 'US', sharePrice: 50 }, fx);
near(r.total, 2.5, 'per_share');

// Cap: US$1/share on 200 shares = US$200, capped at 1% of S$12,500 = S$125.
r = computeCost({ fees: [
  { type: 'per_share', market: 'US', value: 1, currency: 'USD' },
  { type: 'per_trade_max_pct', market: 'US', value: 1, currency: 'PCT' },
] }, { lumpSum: 12500, monthly: 0, years: 1, tradesPerMonth: 0, market: 'US', sharePrice: 50 }, fx);
near(r.total, 125, 'max cap');

// Minimum binds on a tiny trade: US$1 = S$1.25.
r = computeCost({ fees: [
  { type: 'per_share', market: 'US', value: 0.005, currency: 'USD' },
  { type: 'per_trade_min', market: 'US', value: 1, currency: 'USD' },
] }, { lumpSum: 100, monthly: 0, years: 1, tradesPerMonth: 0, market: 'US', sharePrice: 50 }, fx);
near(r.total, 1.25, 'min binds');

// Groups are costed separately and summed: 12 monthly trades x (S$1 commission + S$2 platform).
r = computeCost({ fees: [
  { type: 'per_trade_min', market: 'SG', value: 1, currency: 'SGD' },
  { type: 'per_trade_min', market: 'SG', group: 'platform', value: 2, currency: 'SGD' },
] }, { lumpSum: 0, monthly: 100, years: 1, tradesPerMonth: 0, market: 'SG' }, fx);
near(r.total, 36, 'groups');

// AUM monthly minimum binds on a small balance: 12 months x S$1.
r = computeCost({ fees: [phillipLike] }, { lumpSum: 0, monthly: 100, years: 1, tradesPerMonth: 0, market: 'SG' }, fx);
near(r.total, 12, 'aum min');

// AUM cap above the threshold: 0.3%/12 of S$100k = S$25, capped at S$5.88.
r = computeCost({ fees: [phillipLike] }, { lumpSum: 100000, monthly: 0, years: 1 / 12, tradesPerMonth: 0, market: 'SG' }, fx);
near(r.total, 5.88, 'aum cap above threshold');

// Below the threshold and under its cap: 0.3%/12 of S$30k = S$7.50.
r = computeCost({ fees: [phillipLike] }, { lumpSum: 30000, monthly: 0, years: 1 / 12, tradesPerMonth: 0, market: 'SG' }, fx);
near(r.total, 7.5, 'aum below cap');

// Foreign-currency fee with no FX rate is incomplete, never ranked.
r = computeCost({ fees: [{ type: 'per_share', market: 'US', value: 0.01, currency: 'USD' }] },
  { lumpSum: 1000, monthly: 0, years: 1, tradesPerMonth: 0, market: 'US' }, {});
assert.equal(r.complete, false, 'no fx -> incomplete');

// Lump sum with no trades/month still counts one buy.
r = computeCost({ fees: [{ type: 'per_trade_min', market: 'SG', value: 10, currency: 'SGD' }] },
  { lumpSum: 50000, monthly: 0, years: 10, tradesPerMonth: 0, market: 'SG' }, fx);
near(r.total, 10, 'lump sum counts one trade');

// HKD converts via fx.HKDSGD (per unit): HK$10 minimum x 0.2 = S$2.
r = computeCost({ fees: [{ type: 'per_trade_min', market: 'HK', value: 10, currency: 'HKD' }] },
  { lumpSum: 1000, monthly: 0, years: 1, tradesPerMonth: 0, market: 'HK' }, { ...fx, HKDSGD: { value: 0.2 } });
near(r.total, 2, 'hkd converts');

// HKD fee without an HKD rate is incomplete (a USD rate alone doesn't help).
r = computeCost({ fees: [{ type: 'per_trade_min', market: 'HK', value: 10, currency: 'HKD' }] },
  { lumpSum: 1000, monthly: 0, years: 1, tradesPerMonth: 0, market: 'HK' }, fx);
assert.equal(r.complete, false, 'no hkd rate -> incomplete');

// Share-price tiers (threshold US$40): upper tier flat US$1; lower tier US$0.01/share, min US$2.
// A commission with no condition applies at every price (US$0.40 flat).
const tiered = { fees: [
  { type: 'per_trade_flat', market: 'US', value: 0.4, currency: 'USD' },
  { type: 'per_trade_flat', market: 'US', group: 'platform', value: 1, currency: 'USD', sharePrice: { from: 40 } },
  { type: 'per_share', market: 'US', group: 'platform', value: 0.01, currency: 'USD', sharePrice: { below: 40 } },
  { type: 'per_trade_min', market: 'US', group: 'platform', value: 2, currency: 'USD', sharePrice: { below: 40 } },
] };
const oneTrade = p => ({ lumpSum: 12500, monthly: 0, years: 1, tradesPerMonth: 0, market: 'US', sharePrice: p });
// Below: US$10,000 at US$10 = 1,000 shares x 0.01 = US$10 (> US$2 min) + US$0.40 = US$10.40 = S$13.
near(computeCost(tiered, oneTrade(10), fx).total, 13, 'tier below threshold');
// Exactly at the threshold is the upper tier: US$1 + US$0.40 = S$1.75.
near(computeCost(tiered, oneTrade(40), fx).total, 1.75, 'tier at threshold');
near(computeCost(tiered, oneTrade(100), fx).total, 1.75, 'tier above threshold');

// No tier covers the price: incomplete, never ranked on its other (custody) fee alone.
r = computeCost({ fees: [
  { type: 'per_trade_flat', market: 'US', value: 1, currency: 'USD', sharePrice: { from: 40 } },
  { type: 'custody_monthly', market: 'ALL', value: 1, currency: 'SGD' },
] }, oneTrade(10), fx);
assert.equal(r.complete, false, 'no applicable tier -> incomplete');
assert.match(r.reasons.join(), /No US trading fee found/);

// FX conversion fees are shown in `info`, never added to the total.
const withFx = { fees: [
  { type: 'per_trade_min', market: 'US', value: 1, currency: 'USD' },
  { type: 'fx_spread_pct', market: 'US', value: 0.5, currency: 'PCT' },
] };
r = computeCost(withFx, oneTrade(50), fx);
near(r.total, 1.25, 'fx fee not in total');
assert.equal(r.info.length, 1, 'fx fee reported in info');
assert.equal(r.info[0].pct, 0.5, 'fx info pct');
assert.equal(computeCost(withFx, { ...oneTrade(50), market: 'SG' }, fx).info.length, 0, 'no fx info on SG market');

console.log('all cost.js checks passed');

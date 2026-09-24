# Tasks

## 1. Per-figure source

- [x] 1.1 `scraper/lib/merge.js:merge` uses `c.source` when it is an `https:` URL, else the adapter URL, for components and `fx`. Verify with a scratchpad script that calls `merge` with a valid, invalid and missing `source`, plus a failed-adapter carry-over, and asserts the resulting `source`s.
- [x] 1.2 `fixed-deposit-boards`, `fsmone` (RSP component) and `moomoo-sg` (US components) return per-figure `source`, and notes drop "see other page" wording. Verify `npm run scrape -- --dry --only=fixed-deposit-boards,fsmone,moomoo-sg` passes, and a dumped component shows the per-bank/page URL.
- [x] 1.3 `site/js/components.js:freshnessBadge` links to `component.source` when it is https. Verify in the browser: the badge is an `<a target=_blank>` with the source URL, and plain text when there is no source.

## 2. HKD exchange rate

- [x] 2.1 `scraper/sources/mas-fx.js` runs one postback per currency (checkbox found by label text), normalises "per 100 units", and emits `USDSGD` + `HKDSGD`. Verify `--dry --only=mas-fx` prints 2 components, with a plausible HKD value (per unit, < 1).
- [x] 2.2 `site/js/cost.js:toSGD` generalises to `fx[<CUR>SGD]`. Add tests for HKD conversion and missing HKD → incomplete. Verify `npm test`.

## 3. Share-price tiers and Longbridge

- [x] 3.1 `scraper/index.js:invalidReason` validates the optional `sharePrice` shape. Verify a scratchpad check rejects `{from:'x'}` and accepts `{below:40}`.
- [x] 3.2 `site/js/cost.js:computeCost` filters per-trade components by `appliesAt` before `pick`. Add tests below, at and above the threshold, plus an unconditioned component at any price. Verify `npm test`.
- [x] 3.3 `usmart-sg.js` emits both US tiers, with the threshold and lower-tier figures parsed from the page. Verify `--dry --only=usmart-sg` 3× OK.
- [x] 3.4 `longbridge-sg.js`: the `waitFor` / `sgPlatformPct` uses a shape match with no fee value, and US emits `per_share` + `per_trade_min`. Verify `--dry --only=longbridge-sg` 3× OK and grep shows no fee literal in the `waitFor`.

## 4. SGX exchange fees

- [x] 4.1 New `scraper/sources/sgx-clearing-fee.js`: reads clearing + trading % from two broker pages, throws on disagreement or on fewer than two readable pages, and emits labelled `per_trade_pct` (group `exchange`) with a per-figure `source` for `p-sgx-stocks` and `p-corp-bond`. Verify `--dry --only=sgx-clearing-fee` gives 4 components.
- [x] 4.2 `data/baseline/products.json`: SGX `feeSpecs` `sourceUrl`/`hint` point at the broker page, and a trading-fee `feeSpec` is added. Verify `npm run check-links` covers the new URLs.
- [x] 4.3 `components.js:feeLineInner` lists labelled exchange fees instead of "From". Verify in the browser: the SGX stocks and corporate bond cards show both labels with a badge and the compare link.

## 5. FX conversion fees (display-only)

- [x] 5.1 `computeCost` stops summing `fx_spread_pct` and returns it in `info`. Add a test that total is unchanged with an FX fee present and `info` holds it. Verify `npm test`.
- [x] 5.2 The calculator shows "Currency conversion … not in the totals" for non-SG markets, as a visible line under the chart and a table column. (`providersTable` always uses the SG default scenario, where FX never applies, so it is left unchanged.) Verify in the browser with the US market.
- [x] 5.3 Probe each broker's fee page for a currency-conversion row. Add `fx_spread_pct` components + `feeSpecs` only for plain percentages, and record the rest in DECISIONS. Verify `--dry` for each touched adapter.

## 6. Integration and reconcile

- [x] 6.1 Run a full `npm run scrape` (write) and `npm test`. Verify all adapters OK (or failures explained) and the pill count reported.
- [x] 6.2 Browser check of all 5 pages: zero console errors, and HK-market ranking present. Report ranking deltas for the three presets vs 2026-09-22.
- [x] 6.3 Update the CLAUDE.md schema (`sharePrice`, per-figure `source`, `fx.HKDSGD`, FX display-only, formula) and the DECISIONS.md §12 decisions/edge cases (expense ratios won't-model, UOB/Kristal/Coinbase re-confirmed, SGX via brokers, FX user decision).
- [x] 6.4 Reconcile `docs/{scraper,cost-model,site}/{ARCHITECTURE,IMPLEMENTATION,STATUS}.md`, the roll-ups and `reviews/review-close-open-followups.md`. Run the manual drift check with 0 dead rows.

# Proposal

## Why

The 2026-09-22 handoff left several gaps that make figures less trustworthy or less complete than they look:
- Figures from multi-page adapters cite the wrong page, and the site never links a figure to its source at all.
- The Hong Kong market is selectable, but no HKD rate is scraped, so every broker with an HKD minimum is "incomplete" there.
- uSMART's US pricing below USD 40 and Longbridge's US per-share fee are still approximations.
- A Longbridge `waitFor` contains a fee value, which breaks the §10 rule.
- SGX clearing/trading fees show "check provider".
- FX conversion fees would be summed for the few brokers that publish them, which penalises transparency. The user decided they must be **display-only**.

## What Changes

- **Per-figure source.** An adapter may give any component its own `https:` `source`, and merge keeps it (otherwise the adapter's URL). FSMOne RSP, the OCBC/UOB fixed-deposit rates and moomoo US use it. The site's freshness badge links each figure to its source page.
- **HKD FX.** The MAS FX adapter also emits `fx.HKDSGD` (MAS quotes per 100 HKD; the value is normalised per unit). The cost model converts any currency through `fx[<CUR>SGD]`; a missing rate still means incomplete.
- **Share-price-conditional per-trade components.** A new optional `sharePrice: { from?, below? }` (in the fee's currency) on `per_trade_*` / `per_share` components. A component applies only when the calculator's "Typical share price" is in range. Unconditioned components apply at every price.
  - uSMART US emits both tiers, with the threshold parsed from the page.
  - Longbridge US emits `per_share` + `per_trade_min`.
  - Longbridge's `waitFor` becomes a shape match with no fee value.
- **SGX exchange fees.** A new `sgx-clearing-fee` adapter reads the SGX clearing and trading fee percentages from at least two independent broker pages. It throws if they disagree, and stamps each figure with the page it came from.
  - They are display-only on `p-sgx-stocks` / `p-corp-bond`, never added to broker costs (the broker caveat already excludes them).
  - The baseline `sourceUrl`s move off sgx.com, which never renders for automated browsers.
- **FX conversion fees: display-only (user decision, 2026-09-23).** `fx_spread_pct` is never summed into a total.
  - Where a broker publishes a plain percentage, it is scraped and shown beside the cost as "not in total".
  - **BREAKING (cost model):** totals for any provider that had an `fx_spread_pct` would drop. Today none do, so no ranking changes.
- **Records only:**
  - Fund expense ratios won't be modelled (same fund, same ratio on every platform; the caveat already says so).
  - UOB unit trusts (re-verified: no page states the fee), Kristal.AI and Coinbase stay skipped.

## Capabilities

### New Capabilities
- `fee-data`: the published `data/sgdata.json` contract — per-figure source, FX pairs, share-price conditions, SGX exchange fees on products.
- `cost-comparison`: what the calculator and provider tables show — currency conversion, share-price tiers, display-only FX fees, source links.

### Modified Capabilities
- none (no specs exist yet)

## Impact

- **Scraper:**
  - `scraper/lib/merge.js`, `scraper/index.js` (validation).
  - Adapters: `mas-fx`, `usmart-sg`, `longbridge-sg`, `fsmone`, `fixed-deposit-boards`, `moomoo-sg`, a new `sgx-clearing-fee`, and FX-fee additions to broker adapters that publish one.
- **Cost model:** `site/js/cost.js` (`toSGD`, condition filter, FX display-only) and `test/cost.test.mjs`.
- **Site:** `site/js/components.js` (source link on the badge, product fee line for labelled exchange fees, FX column).
- **Data and docs:**
  - `data/baseline/products.json` (SGX `feeSpecs`) and `brokers.json` (FX `feeSpecs`).
  - CLAUDE.md schema, DECISIONS.md, `docs/<component>/*`.

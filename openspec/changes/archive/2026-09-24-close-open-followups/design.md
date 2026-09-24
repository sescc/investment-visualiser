# Design

## Context

Requirements are in `specs/fee-data` and `specs/cost-comparison`; motivation is in `proposal.md`. Relevant current state:
- `scraper/lib/merge.js:merge` stamps `source: url` (the adapter's top-level URL) on every component, and on `fx` entries.
- `site/js/cost.js:toSGD` knows only USD (`fx.USDSGD`). `pick()` picks by market only.
- `computeCost` sums `fx_spread_pct` for non-SG markets. No adapter emits it today.
- `site/js/components.js:freshnessBadge` renders no link, and nothing in `site/` reads `component.source`.
- `feeLineInner` shows "From <value>" using `bestFeeComponent` for non-yield entries.
- Probing the existing html adapters' pages on 2026-09-23 found SGX clearing/trading fee rows on moomoo SG (help centre), Maybank, OCBC Securities, DBS Vickers, Tiger and UOB Kay Hian. None of them gives the S$ cap the same way (OCBC states its own maximum), so caps are not stored.

## Goals / Non-Goals

**Goals:** the spec'd behaviour with the smallest model delta. No new `FeeType`. Every new number is scraped.

**Non-Goals:**
- Fund expense ratios (won't model; see DECISIONS).
- SGX fee caps, and per-conversion FX minimums.
- Adding exchange fees to broker totals.
- Summing FX fees, or evading bot checks (UOB unit trusts, Kristal.AI and Coinbase stay skipped).

## Decisions

### Model delta (FRAMEWORK: Dat / Trn)
| Kind | Item | Change |
| --- | --- | --- |
| `Dat` | FeeComponent | + optional `sharePrice: {from?: number, below?: number}` (fee currency). `source` may now differ per component. |
| `Dat` | SgData.fx | + `HKDSGD` (per unit) |
| `Trn` | merge | `source = isHttps(c.source) ? c.source : url` for components and `fx` |
| `Trn` | invalidReason | rejects a non-object `sharePrice` or non-finite bounds |
| `Trn` | toSGD | `fx[currency+'SGD']`, total over all currencies with a rate; partial (null) otherwise |
| `Trn` | pick | unchanged; `computeCost` first filters per-trade components by `appliesAt(c, sharePrice)` |
| `Trn` | computeCost | `fx_spread_pct` removed from the sum; returned as `info: [{label, pct, comp}]` |
| `Trn` | freshnessBadge | wraps the badge in `<a href=source>` when `source` is https |

**§3 consolidation:** the share-price tier is *not* a new object or FeeType. It is an existing FeeComponent plus a guard on one morphism (the per-trade group costing). The FX-fee display is the existing `fx_spread_pct` object with its morphism into `total` removed. SGX exchange fees are existing `per_trade_pct` components with a `label` on product entries, and products are never passed to `computeCost`.

### Per-figure source: validate in merge, not in adapters
Merge is the single writer of `source`, so it does the https check once. Alternative considered: validating in `index.js:invalidReason` and failing the adapter. Rejected, because a malformed URL shouldn't discard good fee values. It falls back to the adapter URL instead.

### HKD from MAS: one postback per currency
The results table columns follow the ticked checkboxes. Rather than rely on column order, the adapter runs the postback **once per currency**. Each run is single-column, as today. The checkbox is found by its label text ("Hong Kong Dollar", "US Dollar") and the unit read from that label/header ("per 100 Units" ⇒ ÷100). Alternative considered: one postback with two columns, parsed by header. Rejected because the header structure is unverified and costs just as much to get right. Two requests to the same host are cheap and already serialised by `lib/http.js`.

### Share-price guard applies before `pick`
`appliesAt(c, p) = (c.sharePrice?.from == null || p >= from) && (c.sharePrice?.below == null || p < below)`, with `p` = the scenario's share price. It is filtered before the `pct||flat||min||perShare` check, so a group with no applicable tier is skipped like a group with no components. Share price is compared in the fee's own currency, which is what the calculator's input means (market currency).

uSMART US emits:
- `per_trade_flat` commission, unconditioned: $0 in both tiers per the page.
- `platform` group, upper tier (`sharePrice.from = T`): `per_trade_flat`.
- `platform` group, lower tier (`sharePrice.below = T`): `per_share` + `per_trade_min` + `per_trade_max_pct`, parsed from the "<T USD" text.

Longbridge US emits a `platform` `per_share` + `per_trade_min`, no condition. Its `waitFor` / `sgPlatformPct` anchors on `/Min\. SGD [\d.]+\/Order/` instead of a literal amount.

### SGX exchange fees: dedicated adapter, cross-checked
The new `scraper/sources/sgx-clearing-fee.js` (id already referenced by the baseline `feeSpecs`) is `format: 'html'`. Its `url` is the primary page, and it fetches a second page with `getText`.
- Candidates: the moomoo SG help-centre fee page and the Maybank Securities SG pricing page. Both state the fee "on contract value / transaction amount" with standard-securities wording, and list the DLC/structured-warrant rates separately.
- The adapter parses both percentages from each page with shape regexes, and requires equality.
- It emits per product: `{type: 'per_trade_pct', market: 'SG', label: 'SGX clearing fee' | 'SGX trading fee', group: 'exchange', source: <page it was read from>}`.
- `note` is text only.

Alternative considered: taking one page only. Rejected, because a secondary source needs corroboration. Alternative considered: sgx.com via a stealth browser. Rejected under the hard limits.

### Product card fee line
If an entry's non-yield fees all carry a `label`, `feeLineInner` lists them ("SGX clearing fee X% · SGX trading fee Y%") with one freshness badge (oldest `asOf`), instead of "From".

### FX fees: `info`, not `breakdown`
`computeCost` returns `info` for `fx_spread_pct`, applicable to non-SG markets. The calculator table and provider table show it in a "Currency conversion (not in total)" cell.

Which brokers publish a plain percentage is found during apply, by probing each broker adapter's own page (or its official fee page) for a currency-conversion row. Only brokers whose rate is a pure percentage get an `fx_spread_pct` component plus a `feeSpec`. Minimum-based schedules (e.g. basis points with a per-conversion floor) are recorded in DECISIONS as not stored.

### §4.5 coherence laws to keep
1. Single source of fee truth: new thresholds, rates and FX all come from pages, and the `waitFor`s contain no values.
2. One fee→money morphism (`computeCost`), now with *one fewer* summed type.
3. Explicit partiality: missing HKD rate → incomplete; SGX disagreement → the adapter throws; no applicable tier → the group is skipped.
4. Like-for-like ranking: FX fees can no longer skew rankings, and exchange fees stay off broker totals.
5. Partial runs preserve the rest, including carried-over per-figure `source`.

## Risks / Trade-offs
- [A broker page drifts and SGX pages disagree] → The adapter fails and the previous values are carried as `lastRunOk:false`. Visible in the report.
- [HK market reveals new incomplete brokers (no HK fee at all)] → Correct behaviour; they appear with a reason.
- [uSMART lower tier makes uSMART costlier at a low typical price] → That is the published price; the default price is unchanged, so default rankings shouldn't move.
- [Probing more broker pages for FX adds scrape time] → Only adapters that already fetch that page are extended where possible.

## Migration Plan
There is no data migration. The next full `npm run scrape` rewrites `sgdata.json`. Components carried over from the previous file keep their old `source`. Roll back by restoring the previous `data/sgdata.json`.

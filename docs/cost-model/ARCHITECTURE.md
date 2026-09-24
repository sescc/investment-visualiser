# cost-model — architecture

`Loc`: browser page (and Node for `npm test`). Pure — no effects.

| Morphism | Signature | Partiality / semantics |
| --- | --- | --- |
| computeCost | Item × Scenario × FX → {total, breakdown, info} \| incomplete | zero-growth monthly sim; per-trade group cost = min(max(pct·size + flat + per_share·shares, min), max_pct·size), summed over groups, using only components where `appliesAt(sharePrice)`; AUM tiers blended, `minMonthly`/`monthlyCaps` by monthly balance; `yield_pct`/`other` never summed; `fx_spread_pct` → `info` only (display, never summed) |
| appliesAt | Component × price → bool | `from ≤ price < below`; no condition ⇒ true |
| toSGD | Component × FX → SGD \| null | `fx[<CUR>SGD]`; missing rate ⇒ null ⇒ provider incomplete |
| rankByCost | Item[] × Scenario × FX → ranked, incomplete[] | incomplete never ranked cheap |
| costGroupOf | Item → group | like-for-like groups (`COST_GROUPS`) |
| PRODUCT_COST_LINKS | product → (group, market) | products defer cost to the calculator; products are never passed to computeCost |

Not modelled:
- Fund expense ratios: won't model. The same fund has the same ratio on every platform (DECISIONS §12).
- FX fees in totals: by user decision they're display-only (§12).

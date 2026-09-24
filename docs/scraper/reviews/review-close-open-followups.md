# Review — close-open-followups (§4.5 checklist run, 2026-09-24)

Spans the scraper, cost-model and site. Change: `openspec/changes/close-open-followups/`. Decisions: DECISIONS.md §12.

| Law (architecture-map) | Held? | Evidence |
| --- | --- | --- |
| 1. Single source of fee truth | yes | New figures (HKD, SGX %, uSMART threshold/tier, Longbridge per-share, Saxo/IBKR FX %) are all regex-parsed. The Longbridge `waitFor` literal was removed, and a grep of `waitFor` finds no fee value. FSMOne notes no longer hand-type "0%". Spec/test numbers are synthetic inputs outside `data/` and `site/`. |
| 2. Single fee→money morphism | yes | Only `computeCost` turns fees into money. `fx_spread_pct` moved out of the sum into `info`. Product exchange fees are rendered as text and products never reach `computeCost`. |
| 3. Explicit partiality | yes | Missing HKD ⇒ incomplete (test). SGX pages disagree or are missing ⇒ throw (scratchpad check). uSMART thresholds disagree ⇒ throw. Invalid `source` ⇒ falls back (scratchpad check). Invalid `sharePrice` ⇒ rejected (scratchpad check). No applicable tier ⇒ "No US trading fee found". |
| 4. Like-for-like ranking | yes | FX shown "not in the totals". SGX fees are not on brokers. Default presets are unchanged (S$500/mo: uSMART S$30, Endowus S$1,815). |
| 5. Partial runs preserve the rest | yes | The carry-over paths keep per-figure `source` (scratchpad check: failed and not-run). |

**Consolidation (§3):** no new FeeType or object. `sharePrice` is a guard on an existing morphism, the FX change removes a morphism into `total`, and the SGX fees are existing `per_trade_pct` with a label and group.

**Verification:**
- `npm test` passes: 17 checks.
- Full scrape: 41/41 OK.
- `check-links`: 114/117, the same 3 accepted 403s.
- Browser: 5 pages with 0 console errors, no horizontal scroll, pill 53/56. Checked badge links, the SGX card, US FX info, tier switching at US$10 vs US$50, and HK ranking.

**Residual:** 13 brokers have no HK fee (a coverage gap). Syfe FX is behind a 403.

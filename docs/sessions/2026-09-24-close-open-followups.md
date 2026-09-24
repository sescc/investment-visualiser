# 2026-09-24 — close open follow-ups

Previous: [2026-09-23-supercharge-bootstrap.md](2026-09-23-supercharge-bootstrap.md). Decisions and edge cases in full: [DECISIONS.md §12](../DECISIONS.md). Review: [scraper/reviews/review-close-open-followups.md](../scraper/reviews/review-close-open-followups.md).

## What was done (OpenSpec change `close-open-followups`, 19/19 tasks)
- **Per-figure `source`:** merge keeps an adapter's https `source`, and badges link to it. Used by FD, FSMOne RSP, moomoo US, SGX fees, and the FX pages.
- **HKD FX from MAS:** `fx.HKDSGD` per unit, and a generic `toSGD`. HK now ranks 4 brokers (was 0).
- **Share-price tiers:** `sharePrice: {from, below}` for uSMART US. Longbridge US is now `per_share`, and its `waitFor` no longer contains a fee value.
- **SGX clearing and trading fees:** read from moomoo and cross-checked against Maybank. Shown on the SGX stocks and bond cards, never in broker totals.
- **FX conversion fees are display-only (user decision):**
  - Saxo and IBKR (auto-conversion) are stored.
  - Tiger and moomoo publish no %. Syfe's page is 403. IBKR's manual conversion has a minimum per conversion, so it isn't stored.
- **Won't model** fund expense ratios. UOB unit trusts, Kristal.AI and Coinbase stay skipped (UOB re-checked).
- **Found at advisor review and fixed:** `bestFeeComponent` chose the FX markup as the International card's "From" price. It now prefers fee types that carry a cost.

## Decisions kept / discarded
- **Kept:**
  - FX display-only (the user chose it over "summed all-or-none" and over deferring).
  - SGX fees from brokers, requiring 2 pages to agree.
  - No SGX caps stored.
- **Discarded:**
  - A defaulted user input for expense ratios.
  - Scraping sgx.com with stealth techniques (hard limit).
  - One MAS postback with two columns (one per currency is simpler).

## Tests and benchmarks
- `npm test` passes: 17 checks, up from 9.
- Full scrape: 41/41 OK. `check-links`: 114/117, the same accepted Coinbase/Coinhako 403s.
- Browser: 5 pages, 0 console errors, no horizontal scroll, pill "fees for 53/56" (was 51/56), no nested links.
- **Rankings:**
  - S$500/mo preset: uSMART S$30 and Endowus S$1,815 (unchanged).
  - S$50k lump sum: Webull S$13.
  - 10 US trades/mo: POEMS, Webull and Syfe Trade are all S$0.
  - HK market (S$50k lump sum): POEMS S$40, then OCBC S$75.
  - At a US$10 share price, uSMART drops out of the US top 4 (its lower-tier minimum binds).
- Scratchpad checks (not in the repo):
  - merge source rules, including carry-over.
  - `invalidReason` for `sharePrice`.
  - SGX adapter disagreement and missing-section paths.

## OpenSpec snapshot
`openspec list --json` → `close-open-followups: 19/19 tasks, status complete`. **Not archived.** Waiting for the user to run `/opsx:archive`, which merges the `fee-data` and `cost-comparison` specs into `openspec/specs/`.

## Live state
- The preview server (`sg-invest`, port 5173) is stopped. No jobs are running.
- Generated this session:
  - `data/sgdata.json` and `data/sgdata.js` (full run on 2026-09-24).
  - `graphify-out/graph.json`, rebuilt: 343 nodes, 683 edges, 40 communities.

## Open ends
1. Archive the change: `/opsx:archive close-open-followups`.
2. **HK coverage:** 13 of 17 stock brokers have no HK fee scraped, so they're incomplete on the HK market.
3. Still unscrapable: UOB unit trusts, Kristal.AI, Coinbase. The Syfe FX fee is behind a 403.
4. `git init` (the user's step). After that, `drift-check.ps1` works; until then, run the manual check (52 rows, 0 dead).
5. gbrain isn't installed, so this log isn't indexed.

## Resume
```
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\skills\supercharge\scripts\preflight.ps1"
openspec list --json
npm test
npm run scrape -- --dry
npm run serve
```

## Addendum (same session, after archive)
- **Archived:** `openspec/changes/archive/2026-09-24-close-open-followups/`. Main specs were created at `openspec/specs/fee-data` and `openspec/specs/cost-comparison`, and both pass `openspec validate --specs --strict`.
- **Spec sync:** `cost-comparison` gained 2 failure scenarios to meet the specs rule. Writing them exposed a `computeCost` edge case (no applicable share-price tier while other fees exist ⇒ could rank). It is fixed and tested (18 checks) and recorded in DECISIONS §12.
- `openspec list --json` → `"changes": []`.
- **Rename (user):** the display name is now **SGInvest Visualiser** in page titles, the header brand, README and docs (DECISIONS §12 last bullet). A Sonnet agent made the edits and Opus verified them: 5/5 page titles and brands correct, 0 console errors, and at 375px the brand fits untruncated with no overlap or horizontal scroll. The safety CSS in `site/css/app.css:.brand-name` truncates with an ellipsis if ever needed. README.md was added. The preview is stopped.

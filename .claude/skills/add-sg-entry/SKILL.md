---
name: add-sg-entry
description: Add or edit an investment product, investing method, broker type, or provider in the SG Invest Visualiser (data/baseline/*.json), wire up its fee scraping, and verify it renders. Use when asked to add a new product/robo-advisor/broker/bank or correct pros, cons or sign-up steps.
---

# Add or edit an entry

## 1. Pick the dataset
- `data/baseline/products.json` — what you buy (id prefix `p-`)
- `data/baseline/methods.json` — the channel (robo, bank RSP, SRS, CPFIS…) (`m-`)
- `data/baseline/brokers.json` — broker types (`b-`); individual brokers go in that type's `providers[]`

## 2. Write the content (schema in CLAUDE.md)
- `summary` ≤ 2 plain-English sentences; add an everyday `analogy`.
- Scores: `riskLevel`, `liquidity`, `complexity` 1–5; products also `growthVsDividend` 0–100 and `returnDrivers`.
- `pros` / `cons`: 3–5 each, concrete, written for a beginner.
- `steps`: 4–8 actionable steps researched from the **official** provider/MAS/CPF/IRAS page; the last step links the official sign-up/application page.
- `relatedIds`: link to the matching methods/brokers/products.
- **No fee numbers.** Add `feeSpecs` (type, market, sourceUrl, hint, adapter) instead; leave `fees: []`.
- Structural figures (caps, minimums) only with an official citation link in the same step.

## 3. Wire the fees
Follow the `refresh-sg-data` skill §3 to add an adapter, then `npm run scrape -- --only=<adapter>`.

## 4. Verify
- `node -e "JSON.parse(require('fs').readFileSync('data/baseline/<file>.json','utf8'))"` parses.
- `npm run serve`, open the page in the browser, check the card, pros/cons flip, stepper modal, fee badge, and that the entry appears in the calculator (providers) or risk map (products).

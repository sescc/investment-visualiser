# SGInvest Visualiser

A visual-heavy static website that explains investing in Singapore to laymen:
**products** (what you buy), **methods** (how/through which channel you invest) and **broker types**
(who executes it) — with fees (cheapest highlighted), pros/cons, and step-by-step sign-up guides.
Fee figures come only from a modular scraper that stamps each value with an `asOf` date.

Not financial advice. Every page carries the disclaimer banner.

## Commands
```
npm install              # cheerio (html parsing) + playwright-core (drives the installed Edge — no browser download)
npm run scrape           # node scraper/index.js — all adapters, writes data/sgdata.json + data/sgdata.js
npm run scrape -- --only=poems,syfe   # selected adapter ids
npm run scrape -- --dry  # run adapters, print report, write nothing
npm run serve            # node server.js — http://127.0.0.1:5173, enables the site's "Refresh data" button
npm test                 # cost-model unit checks (synthetic inputs)
npm run check-links      # verify every authored link in data/baseline
```
The site needs the server: browsers block ES modules on `file://`, so opening `site/*.html` directly only shows a
"run npm run serve" notice. Any static http server works for read-only viewing (the refresh button hides itself
when `/api/health` is absent).

## Layout
- `scraper/index.js` CLI · `scraper/lib/{http,extract,merge}.js` · `scraper/sources/<id>.js` one adapter per source
- `data/baseline/{products,methods,brokers}.json` hand-authored content (NO fee numbers)
- `data/sgdata.json` / `data/sgdata.js` generated — never edit by hand
- `site/` static pages; `site/js/cost.js` is the only place fees are turned into costs
- `docs/DESIGN.md` visual/UX spec for the site
- `.claude/skills/` project skills: `refresh-sg-data`, `add-sg-entry`
- `docs/DECISIONS.md` log of every design decision and edge case so far — read before changing the cost model,
  scraper merge logic or any skipped source. Append new decisions there.
- `docs/SESSION-*.md` per-session handoff records up to 2026-09-22. From 2026-09-23 the supercharge loop is used:
  logs in `docs/sessions/`, intent in `docs/architecture-map.md` + `docs/<component>/`, changes in `openspec/`.

@docs/DECISIONS.md

## HARD RULE: fee numbers come only from the scraper
- Never hand-type or recall a fee, rate, yield or minimum-commission figure into `data/` or `site/`.
- Baseline JSON holds `feeSpecs` (where + what to extract), never values.
- If a scrape yields nothing, the UI shows "Not available — check provider ↗" linking to `feeSpecs[].sourceUrl`.
- Non-fee numbers that are structural facts (e.g. SSB max holding, CPF top-up caps) may appear in prose
  **only** with a citation link to the official page in the same sentence/step.

## Data schema (ES modules, `"type": "module"`)
Baseline file = `{ "dataset": "products"|"methods"|"brokers", "entries": [Entry] }`

```jsonc
Entry {
  "id": "p-ssb",                 // prefix p- products, m- methods, b- broker types
  "name": "Singapore Savings Bonds",
  "category": "Bonds & cash",    // grouping on the page
  "icon": "shield",              // key into site/js/icons.js (inline SVG set)
  "summary": "≤2 plain-English sentences, no jargon",
  "analogy": "one-line everyday analogy (optional)",
  "minAmount": "S$500 (cite)",   // display string; cite official link in steps/links
  "riskLevel": 1,                // 1 very low … 5 very high
  "liquidity": 4,                // 1 locked-in … 5 instant
  "complexity": 1,               // 1 beginner … 5 expert
  "growthVsDividend": 0,         // products only: 0 = pure income, 100 = pure capital growth
  "returnDrivers": ["interest"], // subset of capital-growth|dividends|interest|coupon|none
  "pros": ["…"], "cons": ["…"],
  "bestFor": "…",
  "eligibility": "…",
  "relatedIds": ["m-srs", "b-cdp-local"],   // cross-links between the three datasets
  "feeSpecs": [ FeeSpec ],        // type-level fees (e.g. SSB application fee, CPF interest)
  "fees": [ FeeComponent ],       // filled by scraper merge; [] in baseline
  "providers": [ Provider ],      // concrete providers (robo/broker/bank); may be []
  "steps": [ { "title": "…", "detail": "…", "link": "https://official…" } ],  // last step links official page
  "officialLink": "https://…"
}

Provider {
  "id": "poems", "name": "POEMS (Phillip Securities)",
  "officialLink": "https://…",
  "tags": ["CDP-linked", "SG", "US"],
  "feeSpecs": [ FeeSpec ], "fees": [ FeeComponent ],
  "steps": [ … ]                 // optional provider-specific sign-up steps
}

FeeSpec { "type": FeeType, "market": "SG"|"US"|"HK"|"ALL", "sourceUrl": "https://…", "hint": "what text to find", "adapter": "poems" }

FeeComponent {
  "type": FeeType, "market": "SG"|"US"|"HK"|"ALL",
  "value": 0.08, "currency": "SGD"|"USD"|"PCT",
  "tiers": [ { "upTo": 25000, "value": 0.6 } ],   // optional, for tiered aum_annual_pct (upTo null = rest)
  "label": "optional human label", "note": "optional",
  "group": "platform",           // optional, per_trade_*/per_share only: separate charge costed on its own and summed (default "commission")
  "minMonthly": 1,               // optional, aum_annual_pct only: monthly floor in SGD
  "monthlyCaps": [ { "upTo": 40000, "cap": 8.88 } ],  // optional, aum_annual_pct only: monthly ceiling by balance band (upTo null = rest)
  "sharePrice": { "from": 40 } | { "below": 40 },     // optional, per_trade_*/per_share only: applies only when from <= typical share price < below (fee currency); threshold must be scraped
  "asOf": "2026-09-22", "source": "https://…", "adapter": "poems", "lastRunOk": true
  // source = the page this figure was read from: an adapter may set it per component (https only), else the adapter url
}

FeeType =
  per_trade_pct | per_trade_min | per_trade_flat | per_share | per_trade_max_pct | fx_spread_pct |
  aum_annual_pct | custody_monthly | platform_flat_annual |
  sales_charge_pct | transaction_flat | yield_pct | other
```
Percentages are stored as percent numbers (0.08 means 0.08%). `yield_pct` is a return, not a cost (shown, never summed).
`fx_spread_pct` is display-only too (user decision 2026-09-23): shown as "not in total", never summed — few brokers
publish one, so summing it would rank transparent brokers as dearer. Store it only when published as a plain %.
Per-trade cost per group = min(max(pct·size + flat + per_share·shares, min), max_pct·size), using only components
whose `sharePrice` condition includes the typical share price; shares come from the calculator's user-set
"typical share price" assumption. Tests: `npm test` (`test/cost.test.mjs`).
`other` is display-only (needs `label`). Product entries may carry `group: "exchange"` labelled `per_trade_pct`
(SGX clearing/trading fees): shown on the card by label, never added to broker totals.

`data/sgdata.json` = baseline entries with `fees` filled, plus
`{ "generatedAt": ISO, "fx": { "USDSGD"|"HKDSGD": { value, asOf, source } }, "report": [ { adapter, ok, count, error? } ] }`.
`fx` values are SGD per ONE unit (MAS quotes HKD per 100; `mas-fx` normalises). `cost.js` converts any currency via
`fx[<CUR>SGD]`; a missing rate makes the provider incomplete.

## Adapter contract (`scraper/sources/<id>.js`)
```js
export default {
  id: 'poems',
  url: 'https://www.poems.com.sg/pricing/',
  format: 'html',                       // 'html' → cheerio $ ; 'json' → parsed json
  targets: ['b-cdp-local/poems'],       // entryId or entryId/providerId it fills
  async scrape({ $, json, text, extract }) {
    return [ { target: 'b-cdp-local/poems', type: 'per_trade_pct', market: 'SG', value: 0.08, currency: 'PCT' } ];
  },
};
```
Merge stamps `asOf`, `source` (a component's own https `source` if the adapter set one — do this whenever a figure
comes from a second page — else `adapter.url`), `adapter`, `lastRunOk`. On adapter failure the previous run's components are
kept with `lastRunOk: false`. Adapters must throw (not return guesses) when the expected text isn't found.

`format: 'browser'` is for sources whose fee text only exists after JavaScript runs. `scraper/lib/browser.js`
drives the Microsoft Edge already installed on the machine via `playwright-core`'s
`chromium.launch({ channel: 'msedge', headless: true })` — **no browser is downloaded**. One Edge instance is
shared and launched lazily for the whole run (only if a selected adapter needs it) and always closed at the
end, even on failure. `index.js` renders `adapter.url` and builds `$`/`text` from the resulting HTML exactly
like `'html'` format; set `adapter.waitFor` (a CSS selector, a `RegExp`, or `function(text)`) to wait past
hydration instead of reading a placeholder value — a function predicate is required when `0`/empty is a
legitimate value the placeholder also happens to show (see Longbridge in DECISIONS.md §9). Adapters needing a
second rendered page can call `renderPage(url, { waitFor })` from `ctx` or import it from `lib/browser.js`
directly. If Edge or `playwright-core` isn't available, or a page shows a bot challenge/CAPTCHA, the adapter
throws and fails cleanly — other adapters still run (see hard limits in DECISIONS.md).

## Freshness (UI)
live = asOf ≤ 30 days · aging = 31–90 days · stale = > 90 days · missing = no component.

## Model split
Opus: design, schema, specs, review. Sonnet subagents: routine code, adapters, content authoring from specs.

## Conventions
- Plain HTML/CSS/JS, no build step. ES modules in browser (`<script type="module">`), except `data/sgdata.js` (classic script).
- Chart.js from cdnjs only; fonts from Google Fonts. No other CDNs.
- localStorage always wrapped in try/catch.
- Plain English everywhere; jargon gets a `<abbr data-glossary="…">` tooltip.

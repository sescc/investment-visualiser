# SGInvest Visualiser

A visual guide to investing in Singapore for people who are just starting out, written in plain English.

It covers three things:

- **Products:** what you can buy. For example: SGX stocks, US/HK stocks, ETFs, REITs, Singapore Savings Bonds, T-bills, SGS bonds, fixed deposits, unit trusts, CPF top-ups and crypto.
- **Methods:** how you invest. For example: robo-advisors, regular savings plans, fund platforms, bank unit trusts, SRS, CPFIS and DIY brokerage.
- **Broker types:** who carries out your trades. For example: CDP-linked local brokers, app-based custodian brokers, international brokers, bank-integrated brokers and crypto exchanges.

Each entry has pros and cons, risk, liquidity and complexity meters, a growth-vs-dividend meter for products, and a step-by-step sign-up guide that ends at the official page. A fee calculator compares providers against similar ones for a scenario you set.

> **Educational only — not financial advice.** Always check the provider's own page before you invest.

## Where the fees come from

No fee, rate or yield on the site is typed in by hand. Every figure comes from a modular scraper that reads the provider's own published page. The scraper records the date each figure was read and the page it came from.

- Every figure has a freshness badge: **live** (≤ 30 days), **aging** (31–90 days) or **stale** (> 90 days). Each badge links to the page the figure was read from.
- If a figure can't be scraped, the site says **"Not available — check provider ↗"** instead of guessing.
- If a source fails, its last good values are kept and marked stale, and every other source still updates.
- Exchange rates (USD and HKD) come from MAS.
- Some fees are shown on their own and never added to cost totals:
  - SGX clearing and trading fees: they're the same at every broker. They're read from brokers' own fee schedules and must match across two of them.
  - Currency-conversion fees: only a few brokers publish one, so adding them would make the transparent brokers look dearer.

## Fee calculator

The calculator estimates the fees you'd pay over time. It ignores investment returns (zero growth), so the result is a fee-only estimate.

- **Like-for-like groups:** it only ranks providers against similar ones. The groups are stock brokers, robo-advisors, regular savings plans, fund platforms, crypto exchanges, and SSB/T-bill applications. Each group says which costs it leaves out.
- **Presets:** a S$500/month plan, a S$50k lump sum, and active US trading. You can also set your own amounts, market (SG/US/HK) and typical share price.
- **Fee rules it handles:** percentage fees with minimums and caps, separate platform fees, per-share pricing (including tiers by share price), tiered and capped management fees, and conversion from foreign currencies.
- **Missing data:** a provider with incomplete fees is listed separately with the reason. It is never ranked as cheap.

## Getting started

Requirements: Node.js 20+ (developed on Node 24). The browser-rendered sources need Microsoft Edge installed. The scraper drives your installed Edge through `playwright-core`, so no browser is downloaded.

```bash
npm install
npm run scrape      # read every source, write data/sgdata.json + data/sgdata.js
npm run serve       # http://127.0.0.1:5173
```

The site uses ES modules, so it has to be served over HTTP. Opening the HTML files directly (`file://`) only shows a "run npm run serve" notice. With `npm run serve`, the site also gets a **Refresh data** button that re-runs the scraper.

## Deployment (GitHub Pages)

The site is published at the root of GitHub Pages by `.github/workflows/scrape-and-deploy.yml`. In the repo's
Settings → Pages, set **Source = GitHub Actions**.

The workflow builds a Pages artifact with `site/` as the root and `data/` copied in beside it, so the published
site loads `data/sgdata.json` / `data/sgdata.js` exactly like local `npm run serve` does. It runs on three
triggers:

- **Weekly schedule** (Monday 03:17 SGT): re-scrapes every fee source, commits `data/sgdata.json` and
  `data/sgdata.js` if they changed, then deploys.
- **Manual "Run workflow"** in the Actions tab: same as the schedule.
- **Push to `main`** touching `site/**` or `data/**`: deploys only, no scrape.

The **Refresh data** button is hidden on the published site (there's no `/api/health` endpoint on Pages) — that's
expected; use the scheduled/manual scrape instead.

GitHub disables scheduled workflows after 60 days with no repository activity. If the weekly scrape stops
running, re-enable it from the workflow's page in the Actions tab.

### Other commands

```bash
npm run scrape -- --only=poems,syfe   # run selected sources only (others keep their data)
npm run scrape -- --dry               # run and report, write nothing
npm test                              # cost-model unit checks
npm run check-links                   # verify every authored link
```

## Project layout

```
scraper/
  index.js            CLI: runs sources, validates, merges, writes data/
  lib/                http, html extraction, headless Edge, merge
  sources/<id>.js     one adapter per fee source
  check-links.js
data/
  baseline/           hand-written content: products, methods, brokers (no fee numbers)
  sgdata.json|.js     generated — never edit by hand
site/                 static pages (hub, products, methods, brokers, compare)
  js/cost.js          the only place fees are turned into money
server.js             local-only server + refresh endpoint
test/                 cost-model checks
docs/                 design spec, decision log, architecture docs, session logs
openspec/             specs and change history
```

Plain HTML/CSS/JS with no build step. Chart.js loads from cdnjs and fonts from Google Fonts. Light and dark themes are supported, and the layout works down to phone width.

## Adding or fixing a fee source

Each source is one file in `scraper/sources/` that declares a URL, a format (`html`, `json` or `browser`), which entries it fills, and a `scrape()` function.

Adapters must **throw rather than guess** when the expected text isn't on the page. They must never contain a hand-typed fee value, not even in a wait condition or a note. The full adapter contract and data schema are in [CLAUDE.md](CLAUDE.md), and the reasoning behind every modelling choice is in [docs/DECISIONS.md](docs/DECISIONS.md).

## Known gaps

- Some sources can't be scraped: UOB unit trusts (no page states the fee), Kristal.AI (no public pricing) and Coinbase (bot protection, which the scraper won't try to get around). These show "check provider".
- Hong Kong fees are only scraped for some brokers.
- Fund expense ratios aren't modelled. The same fund costs the same on every platform, so they don't change the rankings.

## Disclaimer

This project is for education only. It is not financial advice, and it is not affiliated with any provider listed. Fees change, so always confirm them on the provider's own page before you invest.

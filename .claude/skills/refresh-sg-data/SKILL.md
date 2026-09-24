---
name: refresh-sg-data
description: Refresh the SGInvest Visualiser fee data by running the scraper, reading its report, and fixing or adding source adapters. Use when asked to update fees/rates, when the site shows stale or missing fees, or when a provider changed its pricing page.
---

# Refresh SG fee data

Fee figures on this site come ONLY from `scraper/`. Never type a fee number into `data/` or `site/` (see CLAUDE.md hard rule).

## 1. Run
```
npm install
npm run scrape            # all adapters
npm run scrape -- --only=poems,syfe
npm run scrape -- --dry   # report only, writes nothing
```
Output: `data/sgdata.json` + `data/sgdata.js`. The end-of-run report lists each adapter: `ok` (components found), `FAIL` (error, previous values kept with `lastRunOk:false`).

From the site: `npm run serve`, open http://127.0.0.1:5173, freshness pill → "Refresh data" (calls `POST /api/refresh`).
The pill shows `fees for X/Y` = entries/providers with live fee data out of all that have `feeSpecs`; the panel lists the gaps.

Also run `npm run check-links` — it GETs every `steps[].link`, `officialLink` and `feeSpecs[].sourceUrl` and lists failures.
403s from Cloudflare-protected sites (Coinbase, Coinhako) are bot blocks, not dead links; fix any 404/5xx by finding the
provider's current official page.

## 2. Fix a failing adapter
1. Open `scraper/sources/<id>.js`, note `url`.
2. Fetch the page raw (no JS execution) and check the fee text is present in the HTML:
   `node -e "fetch('<url>').then(r=>r.text()).then(t=>console.log(t.length, /0\.\d+%/.test(t)))"`
3. If the page moved, search the provider site for the new pricing URL and update `url` + the matching `feeSpecs[].sourceUrl` in `data/baseline/*.json`.
4. If the text is present, update the cheerio selectors / regex in `scrape()`. Prefer anchoring on nearby label text over brittle CSS classes.
5. If the page is JS-only, switch the adapter to `format: 'browser'` (headless system Edge via `playwright-core`; see CLAUDE.md adapter contract) with a `waitFor` predicate:
   - `waitFor` must require **every** row `scrape()` reads (sections can hydrate at different times — Saxo's SGX table lags its US table).
   - Normalise whitespace first (`text.replace(/\s+/g, ' ')`) — rendered `innerText` is tab/newline-separated.
   - Match by **shape** (`\d+(?:\.\d+)?%`), never a literal fee value — that is a hand-typed figure and breaks when the rate changes.
   - If a placeholder like `0%` renders before the real value, wait for a non-placeholder (see `longbridge-sg.js`).
6. If the page is a PDF, shows a bot challenge/CAPTCHA, or never renders for automated browsers (sgx.com), delete the adapter and leave the `feeSpecs` in baseline — the UI will show a "check provider ↗" card. Never try to evade bot detection. Do not substitute a remembered number.
7. Adapters must **throw** when expected text is missing — never return a guess.
8. Re-run `npm run scrape -- --dry --only=<id>` **three times** (browser adapters can be flaky), confirm the values against the live page, then run once without `--dry`.

## 3. Add a source
Create `scraper/sources/<id>.js` following the adapter contract in CLAUDE.md (try `format: 'html'` first; use `'browser'` only if the raw HTML lacks the fee text), set `targets` to `entryId` or `entryId/providerId`, add a matching `feeSpecs` entry (with `"adapter": "<id>"`) in the baseline JSON, run it with `--only`, then load the page in the browser and check the fee appears with a "live" badge.

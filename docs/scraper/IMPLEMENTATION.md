# scraper — implementation map

| Model | Code |
| --- | --- |
| discoverAdapters | `scraper/index.js:discoverAdapters` |
| fetchContext | `scraper/index.js:fetchContext` |
| invalidReason (incl. `sharePrice`) | `scraper/index.js:invalidReason` |
| run (CLI entry) | `scraper/index.js:run` |
| merge | `scraper/lib/merge.js:merge` |
| per-figure source rule | `scraper/lib/merge.js:sourceOf` |
| loadBaselines | `scraper/lib/merge.js:loadBaselines` |
| renderPage | `scraper/lib/browser.js:renderPage` |
| closeBrowser | `scraper/lib/browser.js:closeBrowser` |
| assertNoChallenge | `scraper/lib/browser.js:assertNoChallenge` |
| HTTP fetch | `scraper/lib/http.js:getText`, `scraper/lib/http.js:postForm` |
| extraction helpers | `scraper/lib/extract.js:mustFind`, `scraper/lib/extract.js:parsePct` |
| FX (USD, HKD) | `scraper/sources/mas-fx.js:latestRate` |
| SGX exchange fees (cross-checked) | `scraper/sources/sgx-clearing-fee.js:fromMoomoo`, `scraper/sources/sgx-clearing-fee.js:fromMaybank` |
| share-price tiers (uSMART US) | `scraper/sources/usmart-sg.js:sharePrice` |
| FX fee (display-only) sources | `scraper/sources/saxo-markets-sg.js:FX_URL`, `scraper/sources/interactive-brokers-sg.js:FX_URL` |
| link checker | `scraper/check-links.js` |

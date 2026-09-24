# scraper — architecture

`Loc`: Node process (CLI `npm run scrape`, or in-process from server) + optional shared headless Edge.

| Morphism | Signature | Partiality / semantics |
| --- | --- | --- |
| discoverAdapters | fs → Adapter[] | one file per source |
| fetchContext | Adapter → {$, json, text} | `html`/`json` via fetch; `browser` via Edge render + `waitFor` |
| scrape | Context → FeeComponent[] | partial — throws when text isn't found (never guesses); may fetch further pages and set a per-component `source` |
| invalidReason | FeeComponent → reason? | rejects unknown `FeeType`, non-finite value, malformed `sharePrice` (or `sharePrice` on a non-per-trade type) |
| merge | Baseline × Results × Previous × ExistingIds → SgData | total; `source` = component's https `source` else adapter url; failed adapter ⇒ previous values `lastRunOk:false` (original source kept); not-run ⇒ kept; deleted ⇒ dropped |
| renderPage | URL × waitFor → HTML | retries once; throws on bot challenge (no evasion) |

`Dat` notes:
- **FX** — `fx` holds `USDSGD` and `HKDSGD`, SGD per one unit. `mas-fx` runs one MAS postback per currency and takes the quoting unit from the checkbox list name.
- **SGX exchange fees** — `sgx-clearing-fee` is a cross-checked secondary source: two broker pages must agree, else it throws.

Laws:
- A `waitFor` never contains a fee value.
- One Edge per run, always closed.
- Thresholds (e.g. uSMART's share-price tier) are parsed, never assumed.

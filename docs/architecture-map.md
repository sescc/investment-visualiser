# Architecture map — SGInvest Visualiser

High-level §4 map (FRAMEWORK.md). Detail lives in each component folder; decisions in [DECISIONS.md](DECISIONS.md).

## Atoms
| Kind | Atom | Notes |
| --- | --- | --- |
| `Dat` | **Baseline** (`data/baseline/{products,methods,brokers}.json`) | hand-authored entries + `feeSpecs`; never fee values |
| `Dat` | **FeeComponent** | typed fee/yield, stamped `asOf`/`source` (the page it was read from)/`adapter`/`lastRunOk`; optional `sharePrice` condition — only the scraper creates one |
| `Dat` | **SgData** (`data/sgdata.json` + `sgdata.js`) | baseline ⊕ merged fees ⊕ `fx` (USDSGD, HKDSGD per unit) ⊕ `report`; generated, never hand-edited |
| `Dat` | **Scenario** | calculator inputs (amounts, trades, market, share price); user-owned, not a fee |
| `Trn` | **scrape** : Adapter → FeeComponent[] (partial: throws, never guesses) | one per `scraper/sources/<id>.js` |
| `Trn` | **merge** : Baseline × Results × Previous → SgData | total; failed adapters carry previous values with `lastRunOk:false` |
| `Trn` | **computeCost** : Item × Scenario × FX → Cost \| incomplete | the only fee→money morphism |
| `Loc` | Node process (CLI or server), headless Edge, browser page | |
| `Trm` | HTTPS (sources→scraper), `POST /api/refresh` + static GET (page↔server), file write (scraper→data/) | |

## Components
| Component | Owns | Docs |
| --- | --- | --- |
| scraper | scrape, merge, write SgData | [scraper/](scraper/ARCHITECTURE.md) |
| server | local HTTP, refresh endpoint | [server/](server/ARCHITECTURE.md) |
| cost-model | computeCost, cost groups, presets | [cost-model/](cost-model/ARCHITECTURE.md) |
| site | pages rendering SgData | [site/](site/ARCHITECTURE.md) |

Data flow: `sources ─HTTPS→ scraper ─write→ data/sgdata.* ─GET→ site ─calls→ cost-model`; `site ─POST /api/refresh→ server ─run→ scraper`.

## Coherence checklist (§4.5, project-specific)
1. **Single source of fee truth** — no fee value exists in `data/baseline`, `site/`, adapter notes, or `waitFor` predicates.
2. **Single fee→money morphism** — every displayed cost goes through `computeCost`.
3. **Partiality is explicit** — an adapter that can't find its text throws; a missing component renders "Not available — check provider"; a missing FX rate makes a provider incomplete, never cheap.
4. **Like-for-like ranking** — "cheapest" is only computed within one `COST_GROUPS` group under a named scenario. Fees only some providers publish (FX conversion) and fees identical everywhere (SGX exchange fees) are shown, never summed.
5. **Partial runs preserve the rest** — `--only` never erases other adapters' data; deleted adapters are dropped.

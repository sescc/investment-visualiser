# Implementation roll-up

| Component | Code root | Map |
| --- | --- | --- |
| scraper | `scraper/` | [scraper/IMPLEMENTATION.md](scraper/IMPLEMENTATION.md) |
| server | `server.js` | [server/IMPLEMENTATION.md](server/IMPLEMENTATION.md) |
| cost-model | `site/js/cost.js` | [cost-model/IMPLEMENTATION.md](cost-model/IMPLEMENTATION.md) |
| site | `site/` | [site/IMPLEMENTATION.md](site/IMPLEMENTATION.md) |

Shared objects: `data/baseline/*.json` (Baseline), `data/sgdata.json|.js` (SgData — written only by `scraper/lib/merge.js:merge` via `scraper/index.js:run`).

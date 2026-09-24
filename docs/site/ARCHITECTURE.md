# site — architecture

`Loc`: browser page (ES modules, served by `server.js` or any static server). Visual spec: [DESIGN.md](../DESIGN.md).

| Morphism | Signature | Partiality / semantics |
| --- | --- | --- |
| load data | `data/sgdata.js` → `window.SGDATA` | `file://` ⇒ "run npm run serve" notice |
| render cards / tables / charts | SgData → DOM | missing fee ⇒ "Not available — check provider ↗"; freshness pill = coverage |
| freshness badge | FeeComponent → badge | links to the figure's https `source`; plain text when there is none |
| product fee line | Entry → text | multi-yield ⇒ range + best; `group:"exchange"` fees ⇒ listed by label (not "From"); else freshest component |
| calculator | Scenario → computeCost → DOM | via cost-model only; `?group=&market=` preset; FX `info` shown as "not in the totals" line + table column |
| refresh button | click → `POST /api/refresh` → reload | hidden when `/api/health` absent |

Pages: hub (`index`), products, methods, brokers, compare.

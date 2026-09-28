# site — architecture

`Loc`: browser page (ES modules, served by `server.js` or any static server). Visual spec: [DESIGN.md](../DESIGN.md).
`data.js` fetches `data/sgdata.json` relative to `import.meta.url` (not the page's own path), so both
`/site/*.html` and `/site/visual/*.html` resolve the same file without two fetch paths.

**Shared with the visual edition** (`site/visual/`, [visual/ARCHITECTURE.md](../visual/ARCHITECTURE.md)) —
defined once here and imported by both editions, so fee-display and content rules never diverge:
- **Content** (`site/js/content.js`): glossary, world meta, quiz questions/scoring — moved out of
  `components.js`/`index.js` so both editions import the same data instead of each holding a copy.
- **FeeView** (`site/js/feeview.js:feeSummary`): the derived fee-display decision (chosen component,
  freshness, missing-fee link). `feeLineInner`/`freshnessBadge` below are thin renderers over it now, not
  separate logic — same wording/hrefs, no fee decision duplicated.
- **editionHref / mountEditionSwitch** (`site/js/edition-switch.js`): the floating switch button present on
  every page of both editions. Positions itself via `transform: translateY()`, not `top` (which forces
  layout on every write), from one rAF-coalesced scroll handler. Same href mapping (keeps the query string
  and hash) on both editions.

| Morphism | Signature | Partiality / semantics |
| --- | --- | --- |
| load data | `data/sgdata.js` → `window.SGDATA` | `file://` ⇒ "run npm run serve" notice |
| render cards / tables / charts | SgData → DOM | missing fee ⇒ "Not available — check provider ↗"; freshness pill = coverage |
| freshness badge | FeeComponent → badge | links to the figure's https `source`; plain text when there is none |
| product fee line | Entry → text | multi-yield ⇒ range + best; `group:"exchange"` fees ⇒ listed by label (not "From"); else freshest component |
| calculator | Scenario → computeCost → DOM | via cost-model only; `?group=&market=` preset; FX `info` shown as "not in the totals" line + table column |
| refresh button | click → `POST /api/refresh` → reload | hidden when `/api/health` absent |
| editionHref | Location → URL | stable `X.html` ↔ `visual/X.html`, query string + hash kept; shared with the visual edition |

Pages: hub (`index`), products, methods, brokers, compare.

`scripts/build-site.mjs` assembles `_site/` — the one artifact both the GitHub Pages workflow and the Vercel
deploy build from — copying `site/` and `data/` in beside each other so every page-relative fetch resolves
the same way under either host.

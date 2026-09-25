# visual — architecture

`Loc`: browser page under `site/visual/` (ES modules, same server/Pages artifact as `site/`), plus one WebGL
canvas behind the DOM. A second **rendering** of the same `SgData`; it owns no data and no costing.

§3 consolidation: no new `Dat` for content. `render_visual : SgData × Scenario → DOM` is a second functor out of
the same objects the stable `site` renders; both factor through the shared pure view-models below, so fee display
rules are defined once.

## Objects
| Object | Kind | Notes |
| --- | --- | --- |
| SgData, Scenario | `Dat` (shared) | via `site/js/data.js:getData`; visual pages include `../data/sgdata.js` |
| Content | `Dat` (shared) | glossary, world meta, quiz questions — `site/js/content.js`, used by both editions |
| FeeView | `Dat` (derived) | `feeSummary(entry)` result: chosen component, text, freshness, source href, yield range/best, or missing + `sourceUrl` |
| Choreography | `Dat` (per visit) | seeded roll (palette accent, entrance style, formation order); `?seed=` reproduces it; not content |
| Formation | `Dat` (transient) | particle target positions; last one handed to the next page via `sessionStorage` |
| MotionPref | `Dat` (per viewer) | reduced-motion media query ∨ "Calm mode" (localStorage, try/catch) |

## Morphisms
| Morphism | Signature | Partiality / semantics |
| --- | --- | --- |
| feeSummary | Entry → FeeView | total; missing ⇒ `missing:true` with provider `sourceUrl` ("Not available — check provider ↗"); cost-bearing component preferred (`data.js:bestFeeComponent`) |
| computeCost / rankByCost | Item × Scenario × FX → Cost \| incomplete | **reused from cost-model, never reimplemented**; incomplete ⇒ "pit lane", never ranked |
| editionHref | Location → URL | stable `X.html` ↔ `visual/X.html`, query string kept; used by both editions |
| roll | seed → Choreography | deterministic for a given seed |
| stage.setFormation | Formation → frames | defined only when WebGL ∧ ¬MotionPref.calm; otherwise no-op (CSS gradient fallback) |
| animate | DOM × Choreography → DOM | decorative only: content is in the DOM and readable before and without it |
| analytics | host → script load | defined only when host ends with `.vercel.app`; otherwise no request |

## Transmissions
| Trm | From → To | Notes |
| --- | --- | --- |
| cross-document View Transition | visual page → visual page | progressive enhancement; ignored where unsupported |
| sessionStorage formation handoff | page → next page | try/catch; absent ⇒ start from a fresh formation |
| CDN script load | cdnjs (Three r186 core, GSAP 3.15) · jsDelivr `/npm` pinned (Three addons only) | failure ⇒ static layout, content intact |
| Vercel insights | page → Vercel | `*.vercel.app` only |

## Coherence (§4.5) this component must keep
1. Single source of fee truth — no figure in `site/visual/`.
2. Single fee→money morphism — every cost via `computeCost`.
3. Partiality explicit — missing fee ⇒ "Not available"; incomplete ⇒ pit lane, never cheap.
4. Like-for-like — "Cheapest" names its scenario and cost group; FX / `other` / SGX exchange fees shown, never summed.
5. Content parity — same entries, providers, pros/cons, steps, glossary and quiz as the stable page.
6. Motion is decorative — reduced motion or no WebGL yields a complete, readable page.

Pages: hub (`index`), products, methods, brokers, compare.

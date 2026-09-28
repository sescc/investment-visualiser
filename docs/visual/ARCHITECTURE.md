# visual — architecture

`Loc`: browser page under `site/visual/` (ES modules, same server/Pages artifact as `site/`). A second
**rendering** of the same `SgData`; it owns no data and no costing. No WebGL: the moving background is a DOM layer
(user decision 2026-09-26, after the Three.js particle stage made the edition lag on a mid-range laptop).

§3 consolidation: no new `Dat` for content. `render_visual : SgData × Scenario → DOM` is a second functor out of
the same objects the stable `site` renders; both factor through the shared pure view-models below, so fee display
rules are defined once. A scroll scene is not a new object either: it is a morphism from scroll position to the
decorative state of DOM that already holds the content.

## Objects
| Object | Kind | Notes |
| --- | --- | --- |
| SgData, Scenario | `Dat` (shared) | via `site/js/data.js:getData`; visual pages include `../data/sgdata.js` |
| Content | `Dat` (shared) | glossary, world meta, quiz questions — `site/js/content.js`, used by both editions |
| FeeView | `Dat` (derived) | `feeSummary(entry)` result: chosen component, text, freshness, source href, yield range/best, or missing + `sourceUrl` |
| Choreography | `Dat` (per visit) | seeded roll (palette accent, entrance style, formation order); `?seed=` reproduces it; not content |
| Formation | `Dat` (transient) | named backdrop arrangement (blob positions); last one handed to the next page via `sessionStorage` |
| ScrollProgress | `Dat` (transient) | position of the page / of one scene in `[0,1]`; owned by ScrollTrigger, never stored |
| MotionPref | `Dat` (per viewer) | reduced-motion media query ∨ "Calm mode" (localStorage, try/catch) |

## Morphisms
| Morphism | Signature | Partiality / semantics |
| --- | --- | --- |
| feeSummary | Entry → FeeView | total; missing ⇒ `missing:true` with provider `sourceUrl` ("Not available — check provider ↗"); cost-bearing component preferred (`data.js:bestFeeComponent`) |
| computeCost / rankByCost | Item × Scenario × FX → Cost \| incomplete | **reused from cost-model, never reimplemented**; incomplete ⇒ "pit lane", never ranked |
| editionHref | Location → URL | stable `X.html` ↔ `visual/X.html`, query string kept; used by both editions |
| roll | seed → Choreography | deterministic for a given seed |
| backdrop.setFormation / pulse | Formation → DOM transform | defined only when ¬MotionPref; otherwise no-op on a static backdrop |
| scene | Section × build → (ScrollProgress → decorative DOM state) | defined only when ¬MotionPref ∧ GSAP loaded; ≥768px pins the section, <768px scrubs it unpinned; focus entering the section jumps to progress 1 |
| batchReveal / scrubHeading | Elements → entrance on scroll | same partiality as `scene`; end state = authored layout |
| animate | DOM × Choreography → DOM | decorative only: content is in the DOM and readable before and without it |
| analytics | host → script load | defined only when host ends with `.vercel.app`; otherwise no request |

## Transmissions
| Trm | From → To | Notes |
| --- | --- | --- |
| cross-document View Transition | visual page → visual page | progressive enhancement; ignored where unsupported |
| sessionStorage formation handoff | page → next page | try/catch; absent ⇒ start from a fresh formation |
| CDN script load | cdnjs only (GSAP 3.15 core + the plugins actually used; Chart.js) | failure (or `?nogsap=1`) ⇒ static layout, content intact |
| Vercel insights | page → Vercel | `*.vercel.app` only |

## Coherence (§4.5) this component must keep
1. Single source of fee truth — no figure in `site/visual/`.
2. Single fee→money morphism — every cost via `computeCost`.
3. Partiality explicit — missing fee ⇒ "Not available"; incomplete ⇒ pit lane, never cheap.
4. Like-for-like — "Cheapest" names its scenario and cost group; FX / `other` / SGX exchange fees shown, never summed.
5. Content parity — same entries, providers, pros/cons, steps, glossary and quiz as the stable page.
6. Motion is decorative — reduced motion, Calm mode or a failed animation-library load yields a complete, readable
   page with no pinning. Within that:
   - **Text is never hidden.** Text and data (ranks, names, winner banner, pit-lane reasons, totals, legends,
     labels, missing-fee links) stay readable at every scroll position — they may move, never fade below ~0.85 opacity
     or sit covered. Only decorative parts (fills, racers, chips, coins, drawn lines, bubbles, blobs) start hidden.
     Every pinned scene ends in the authored layout.
   - **Fee numbers never stop mid-tween.** A displayed fee total is always a real `computeCost` result, never an
     interpolated value; scroll may drive non-fee counts only.
7. Motion stays light (project rule) —
   - animate only `transform` / `opacity` (plus DrawSVG / MotionPath on small inline SVGs);
   - never `backdrop-filter`, `mix-blend-mode`, CSS `filter`, or animated width / height / top / left / box-shadow /
     background-position;
   - no own `requestAnimationFrame` loops; no infinite CSS animations except on hover / focus;
   - `will-change` only on backdrop blobs and the active pinned scene; grids reveal via `ScrollTrigger.batch`.

Pages: hub (`index`), products, methods, brokers, compare.

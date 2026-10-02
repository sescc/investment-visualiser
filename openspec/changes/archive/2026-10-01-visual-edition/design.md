# Design

## Context

Requirements are in `specs/visual-edition`, and the component model is in `docs/visual/ARCHITECTURE.md`. Current state:
- The stable pages render through `site/js/components.js`, which mixes DOM rendering with fee-display decisions (`feeLineInner`, `freshnessBadge`) and holds `GLOSSARY`.
- `site/js/index.js` holds the quiz definition and scoring inline.
- `data.js` fetches `data/sgdata.json` page-relative, which breaks one directory deeper.
- The Pages workflow assembles `_site/` inline in YAML.

**Revision 2026-09-26.** The first visual build lagged badly on a mid-range laptop. The causes:
- A full-viewport Three.js stage (~16k particles, bloom in dark mode) redrawing every frame, plus a second Three.js scene on the hub.
- `backdrop-filter` glass panels re-blurring over that moving canvas every frame.
- A full-screen `mix-blend-mode` grain layer, and an aurora animating `background-position`.
- A blend-mode custom cursor, infinite CSS loops, and bars animating `width`/`height`.

The user chose to remove WebGL entirely and to use maximal scroll-driven animation instead.

## Goals / Non-Goals

**Goals:**
- Maximum spectacle with zero change to the fee truth.
- Every fee-display decision is defined once and used by both editions.
- Motion is always optional.
- Motion is light: smooth scrolling on an ordinary laptop, and no work while the page is idle.

**Non-Goals:**
- Changing the cost model, the scraper or the data schema.
- Making the stable site animated.
- A build step or bundler: this stays plain ES modules from CDNs.
- WebGL or canvas render loops.

## Decisions

### Model delta (FRAMEWORK: Dat / Trn / Loc / Trm)
| Kind | Item | Change |
| --- | --- | --- |
| `Dat` | Content | Moved to `site/js/content.js` (was inline in `components.js`/`index.js`) |
| `Dat` | FeeView | New derived object: `feeview.js:feeSummary(entry)`, `freshnessView(comp)`, and the missing-fee link |
| `Dat` | ScrollProgress | New, transient: scroll position of the page or of one scene in `[0,1]`, owned by ScrollTrigger, never stored |
| `Dat` | Formation | Now a named backdrop arrangement, no longer particle positions |
| `Trn` | feeLine / freshnessBadge | Become thin renderers over FeeView, with identical HTML output |
| `Trn` | render_visual | New: SgData × Scenario → DOM for `site/visual/*`, factoring through FeeView and `computeCost` |
| `Trn` | scene | New, partial: Section × build → (ScrollProgress → decorative DOM state). Defined only when motion is allowed and GSAP loaded. Pins at ≥768px, scrubs unpinned below. Focus entering a scene ⇒ progress 1. |
| `Trn` | batchReveal / scrubHeading | New, same partiality as `scene`; the end state is the authored layout |
| `Trn` | backdrop.setFormation / pulse | Replaces `stage.setFormation`/`pulse`, keeping the same call sites; no-op on a static backdrop when motion isn't allowed |
| `Trn` | editionHref | New: Location → matching page in the other edition, keeping the query and hash |
| `Loc` | WebGL canvas | **Removed** (was: behind the DOM, optional) |
| `Trm` | View Transition, sessionStorage formation handoff, cdnjs loads, Vercel insights | Each degrades to nothing. The jsDelivr load is removed. |

§3 consolidation: the visual edition is a second rendering of existing objects, not a new data model. It owns no fee logic. A scroll scene is a morphism onto DOM that already holds the content, not a new object.

### Libraries
- **cdnjs only:** GSAP 3.15.0, loading only the plugins the pages actually use (ScrollTrigger, SplitText, DrawSVG, MotionPath, ScrambleText, Draggable + Inertia, Flip if used), plus Chart.js for the compare radar.
- Three.js and the jsDelivr exception are removed.

### Scroll scenes
- One helper, `scene()`, owns the lifecycle of every pinned or scrubbed sequence. It wraps `motionScope`, `gsap.context`, `gsap.matchMedia` and ScrollTrigger, so Calm mode tears every scene down together.
- Interactive forms (quiz, calculators, compare selection, filters) are never pinned. Only their surrounding displays are.
- **Text is never hidden:** text and data stay readable at every scroll position, and only decorative parts start hidden.
- **Fee numbers never stop mid-tween:** every displayed fee total is a real `computeCost` result.
- The Fee Race and the fee jar rebuild their timelines on every new calculator result, so scrolling back never shows a stale ranking.

### Content parity
- Data-driven content (entries, providers, fees, pros/cons, steps, glossary, quiz) comes from the shared modules, so parity holds by construction.
- **Static section copy** (hero headline and intros) lives in the stable HTML. The visual pages copy it verbatim, and parity is checked by the verifier.
  - *Why not extract it:* the stable pages would then need JS to show their headline text, which changes the stable site.
  - This is recorded as an accepted duplication in DECISIONS.

### Motion safety
- `prefers-reduced-motion: reduce` or "Calm mode" (a header toggle, persisted in localStorage wrapped in try/catch) gives a static layout: no pinning, no scrubbing, no pulses.
- A failed GSAP load (or `?nogsap=1`) gives the same static layout. The content is always in the DOM before any animation runs.

### Motion performance rules
- Animate only transform/opacity, plus DrawSVG/MotionPath on small inline SVGs.
- Never use `backdrop-filter`, `mix-blend-mode`, CSS `filter`, or animated width/height/top/left/box-shadow/background-position.
- No own rAF loops. No infinite CSS animations except on hover or focus.
- `will-change` only on the backdrop blobs and the active pinned scene. Grids reveal via `ScrollTrigger.batch`.
- Checked by a perf probe in headless Edge:
  - while scrolling: p95 frame ≤ 20 ms and ≤ 5% of frames > 33 ms;
  - while idle: 0 long animation frames and a near-full idle budget.

### Hosting
- `scripts/build-site.mjs` is the single assembly step, shared by Pages and Vercel.
- Vercel skips `npm install` (the scraper deps aren't needed) and serves `_site/`.
- Analytics scripts load only when `location.hostname` ends with `.vercel.app`.

## Coherence laws kept (§4.5, see `docs/architecture-map.md`)
- 1: single source of fee truth.
- 2: single fee→money morphism.
- 3: explicit partiality.
- 4: like-for-like ranking.
- New project laws: 5, content parity; 6, motion is decorative (text never hidden, fee numbers never mid-tween); 7, motion stays light.

## Risks
- **CDN failure.** Mitigated by the static layout.
- **Pinned scenes on touch devices** (address-bar resizes, long pages). Below 768px scenes scrub without pinning, and `ignoreMobileResize` is on.
- **Keyboard users landing inside a half-played scene.** Focus jumps the scene to its end.
- **A stale ranking after a calculator change.** Timelines rebuild on every result.
- **Section copy drifting between editions.** Covered by the parity check and the DECISIONS note.

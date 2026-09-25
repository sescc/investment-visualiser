# Design

## Context

Requirements are in `specs/visual-edition`, and the component model is in `docs/visual/ARCHITECTURE.md`. Current state:
- The stable pages render through `site/js/components.js`, which mixes DOM rendering with fee-display decisions (`feeLineInner`, `freshnessBadge`) and holds `GLOSSARY`.
- `site/js/index.js` holds the quiz definition and scoring inline.
- `data.js` fetches `data/sgdata.json` page-relative, which breaks one directory deeper.
- The Pages workflow assembles `_site/` inline in YAML.

## Goals / Non-Goals

**Goals:**
- Maximum spectacle with zero change to the fee truth.
- Every fee-display decision is defined once and used by both editions.
- Motion is always optional.

**Non-Goals:**
- Changing the cost model, the scraper or the data schema.
- Making the stable site animated.
- A build step or bundler: this stays plain ES modules from CDNs.

## Decisions

### Model delta (FRAMEWORK: Dat / Trn / Loc / Trm)
| Kind | Item | Change |
| --- | --- | --- |
| `Dat` | Content | Moved to `site/js/content.js` (was inline in `components.js`/`index.js`) |
| `Dat` | FeeView | New derived object: `feeview.js:feeSummary(entry)`, `freshnessView(comp)`, and the missing-fee link |
| `Trn` | feeLine / freshnessBadge | Become thin renderers over FeeView, with identical HTML output |
| `Trn` | render_visual | New: SgData × Scenario → DOM for `site/visual/*`, factoring through FeeView and `computeCost` |
| `Trn` | editionHref | New: Location → matching page in the other edition, keeping the query and hash |
| `Loc` | WebGL canvas | New, behind the DOM, and optional |
| `Trm` | View Transition, sessionStorage formation handoff, CDN loads, Vercel insights | New; each degrades to nothing |

§3 consolidation: the visual edition is a second rendering of existing objects, not a new data model. It owns no fee logic.

### Libraries
- **cdnjs:** Three.js 0.186.0 (`three.module.min.js`) and GSAP 3.15.0 (including ScrollTrigger, SplitText, Flip, DrawSVG, MorphSVG, Draggable and Inertia; all on cdnjs, checked 2026-09-25).
- **jsDelivr `/npm`, pinned:** only the Three.js addons missing from cdnjs (EffectComposer, UnrealBloomPass), resolved through an import map.

### Content parity
- Data-driven content (entries, providers, fees, pros/cons, steps, glossary, quiz) comes from the shared modules, so parity holds by construction.
- **Static section copy** (hero headline and intros) lives in the stable HTML. The visual pages copy it verbatim, and parity is checked by the verifier.
  - *Why not extract it:* the stable pages would then need JS to show their headline text, which changes the stable site.
  - This is recorded as an accepted duplication in DECISIONS.

### Motion safety
- `prefers-reduced-motion: reduce` or "Calm mode" (a header toggle, persisted in localStorage wrapped in try/catch) gives a static layout: no WebGL, no scroll-jacking, no pulses.
- No WebGL, or a failed CDN load, falls back to a CSS gradient background. The content is always in the DOM before any animation runs.

### Hosting
- `scripts/build-site.mjs` is the single assembly step, shared by Pages and Vercel.
- Vercel skips `npm install` (the scraper deps aren't needed) and serves `_site/`.
- Analytics scripts load only when `location.hostname` ends with `.vercel.app`.

## Coherence laws kept (§4.5, see `docs/architecture-map.md`)
- 1: single source of fee truth.
- 2: single fee→money morphism.
- 3: explicit partiality.
- 4: like-for-like ranking.
- New project laws: 5, content parity; 6, motion is decorative.

## Risks
- **CDN or WebGL failure.** Mitigated by the static fallback.
- **Performance on phones.** Particle count is scaled down, DPR capped at 1.5, the loop pauses when the tab is hidden, and Three.js is lazy-loaded.
- **Section copy drifting between editions.** Covered by the parity check and the DECISIONS note.

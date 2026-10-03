# Design

## Context
- The visual pages are independent documents linked by the shell's nav (`shell.js:NAV_ITEMS`, which is the journey order).
- `@view-transition { navigation: auto }` is already on, and the visual header and hero headline carry `view-transition-name`s.
- Every scroll scene goes through `motion.js:scene()`.
- The Products bug comes from creation order: the returns pin is built before the deck's async horizontal pin.

## Model delta (FRAMEWORK)
| Kind | Item | Change |
| --- | --- | --- |
| `Dat` | JourneyStop | Derived from `NAV_ITEMS`: `{ href, label, index }`. Not stored. |
| `Dat` | RunwayArmed | Per page view, transient: true only after a downward scroll *into* the runway that began above it |
| `Trn` | nextStop | Page → JourneyStop \| ⊥. ⊥ for Compare, the last stop. |
| `Trn` | runway | ScrollProgress × RunwayArmed → decorative state; at progress ≥ 0.98, armed and scrolling down ⇒ navigate(nextStop). Defined only when motion is allowed; otherwise just the link. |
| `Trn` | scene (changed) | Triggers are refreshed in document order (`refreshPriority`), followed by one sort-and-refresh after async mounts |
| `Trm` | navigate | Same-origin document navigation carrying the View Transition. The runway title and the next page's hero headline share `view-transition-name: visual-hero-headline`; the current page's hero gives up that name first. |
| `Trm` | prefetch | `<link rel="prefetch">` to the next page when the runway is first approached. Not a prerender, because the entrance animations must not play while the page is hidden. |

## Decisions
- **Runway placement.** After the footer, so the disclaimer, freshness and glossary links stay reachable. About 1.2 viewport heights tall, unpinned.
- **Arming and back-bounce.** On `pageshow`, including bfcache restores, and whenever a load lands inside the runway, the runway is disarmed. It arms only once the reader has been above the runway and then scrolls down into it. Navigation needs progress ≥ 0.98, downward velocity and arming. `sessionStorage` is not used for this, so each page view decides for itself.
- **Query carry-over.** `?seed=` and `?calm=` carry over. Page-specific parameters (`group`, `market`, `ids`, `scenario`, `#hash`) don't.
- **Arrival.** The next page reads a one-shot `sessionStorage` flag (`sg-journey-arrival`, try/catch) to play a short "warp-in" variant of its hero entrance. Without the flag, the normal entrance plays.
- **Motion off** (Calm, reduced motion, `?nogsap=1`, GSAP failure): the runway becomes a plain section with "Next: <page> →". There is no auto-navigation.
- **Spectacle budget.** Only transform and opacity animate. Velocity effects go through `gsap.quickTo` and settle to idle. No clip-path wipes; a scale-and-opacity iris is used instead. Each addition must pass the perf probe: p95 frame ≤ 20 ms, ≤ 5% of frames > 33 ms, 0 idle long animation frames.
- **HUD.** A fixed 5-dot rail with a `scaleX` progress fill. It is `aria-hidden` (the nav already conveys position), hidden below 480px, and present in Calm mode without animation.

## Coherence laws kept
- 5, content parity: the runway and the finale add navigation only, not content.
- 6, text never hidden: the runway link is always readable, and heading wraps match the unsplit text.
- 7, motion stays light.

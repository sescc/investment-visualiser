# Review — visual edition

§4.5 coherence checklist run (`docs/architecture-map.md`'s 8 laws: 1–5 project-wide, 6–8 visual-edition-
specific), verified this session.

| Law | Result | Evidence |
| --- | --- | --- |
| 1. Single source of fee truth | PASS | no fee value found outside `data/`/adapter notes/`waitFor` predicates — same grep-clean check as the stable site; the visual edition adds no new fee source |
| 2. Single fee→money morphism | PASS | every visual-edition cost goes through `computeCost`/`rankByCost`; no local recompute anywhere in `site/visual/js` |
| 3. Partiality is explicit | PASS | incomplete providers render in the pit lane / as "Not available", never ranked cheap |
| 4. Like-for-like ranking | PASS | Fee Race ranked correctly for all 3 presets + the HK market, including the S$0 tie; Compare's calculator covers all 11 presets + the robo group |
| 5. Partial runs preserve the rest | PASS | scraper-only law, unaffected by the visual edition; no regression |
| 6. Content parity | PASS | products 18/18, methods 12/12, brokers 7/7 entries match the stable page; hub quiz 3/3 result combinations match; world-card teasers match; the scatter's `<details>` table has the same 18 rows as the stable bubble-chart table |
| 7. Motion is decorative | PASS | `?calm=1`, reduced-motion, `?nogsap=1`, and a blocked CDN each render the complete, static, readable page; a law-6 opacity sweep across all 11 pinned scenes found zero text-bearing elements below 0.85 opacity |
| 8. Motion stays light | PASS, 2 accepted notes | code-rule grep (`filter:`, `backdrop-filter`, `mix-blend-mode`, animated width/height/top/left/box-shadow/background-position, own `requestAnimationFrame` loops) is clean except: confetti's `requestAnimationFrame` burst (`fx.js:confettiBurst`) is bounded (dies within ≤2.5s via its own safety timeout) and only ever starts on a user action (quiz result, race win), never a continuous render loop — accepted exception; `motion.js:countUp` has zero remaining call sites in `site/visual/js` — dead code, not a rule violation, flagged for removal rather than left as an unused fee-number animator |

## Coverage
PASS. All 5 previously-failing scenes (hub scatter, products spectrum, methods map, brokers fighters/
ownership) now pass — 0/13 text-coverage checks failing at both 1280px and 375px, 0 opacity violations.
`?calm=1`, `?nogsap=1`, 375px, console errors (0) and perf all re-verified after the fixes: p95 6–10 ms,
≤0.8% of frames >33 ms, 0 idle LoAF. See [DECISIONS.md §14](../../DECISIONS.md) for what each fix was and
where it's handled.

## Perf
Headless Edge, same methodology throughout the rework.

| Metric | Before rework | After |
| --- | --- | --- |
| Scroll p95 | 67–150 ms | ≈8.4 ms uncapped / <20 ms vsync-capped |
| Frames >33 ms | 55–99% | ≤0.5% |
| Idle long-animation-frames | 27–45 | 0 |

See [visual/STATUS.md](../STATUS.md) for the idle-budget caveat (GSAP's ticker vs. the stable site's ~360%).

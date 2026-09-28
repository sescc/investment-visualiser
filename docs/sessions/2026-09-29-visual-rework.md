# 2026-09-29 — visual rework

Previous: [2026-09-24-close-open-followups.md](2026-09-24-close-open-followups.md). Decisions and edge
cases in full: [DECISIONS.md §14](../DECISIONS.md). Review:
[visual/reviews/review-visual-edition.md](../visual/reviews/review-visual-edition.md).

The initial visual-edition build (OpenSpec tasks 1.1–3.2: the shared `content.js`/`feeview.js`/
`edition-switch.js` modules, `scripts/build-site.mjs` + Vercel, the visual shell, the original Three.js
particle stage, the hub/products/methods scenes, and the brokers/compare drafts) ran on 25 Sep 2026
without a session log of its own — it's summarised below alongside the 26–29 Sep rework this log covers.

## What was done (OpenSpec change `visual-edition`, 18/19 tasks)
- **25 Sep — initial build.** Shared modules extracted so both editions apply identical content/fee rules;
  `build-site.mjs` assembling `_site/` for Pages and Vercel; the visual shell (header, disclaimer,
  freshness, Calm mode); a full-viewport Three.js particle stage behind every page; the hub, products and
  methods pages' first scenes; brokers and compare drafted.
- **26 Sep — user report: "very laggy even on a reasonably powered laptop."** A headless-Edge perf baseline
  was captured first (agent A), confirming the Three.js stage was the dominant cost: visual-page scroll p95
  67–150 ms and 55–99% of frames over 33 ms, against 17 ms / 0.3% on the stable reference pages in the same
  run.
- **User decisions (26 Sep):** remove WebGL entirely; maximal scroll-driven animation (most sections pin
  and play as scroll-scrubbed scenes, replacing the original fire-and-forget reveal-on-load entrances).
- **Wave 0 — docs and spec revised before any code:** `docs/visual/ARCHITECTURE.md`, the OpenSpec
  `design.md`/`spec.md`/`tasks.md` all updated to describe the backdrop/`scene()` model and the perf/
  content laws before Wave 1 touched a line of code.
- **Wave 1 — foundation (agent A):** deleted the Three.js stage and its jsDelivr importmap; new
  `backdrop.js` (DOM blobs, no canvas, no render loop); `motion.js` gained `scene`, `batchReveal`,
  `scrubHeading`; the performance rules enforced in CSS (no `backdrop-filter`, no `mix-blend-mode`, no
  animated `background-position`, custom cursor removed); GSAP plugins trimmed from 10 to 7 (grep-verified
  against actual usage); the edition-switch button repositioned via `transform: translateY()` instead of
  `top` (28 Sep, same agent, a later small task).
- **Wave 2 — pages (three parallel Sonnet agents):**
  - Hub: pinned coin journey (MotionPath), a not-pinned quiz deal-in, an SVG risk/liquidity scatter (pinned
    axis-draw + burst-into-place, replacing the old 3D galaxy), pinned world-card fan-out/flip.
  - Products: pinned spectrum marker drop-in, the pinned horizontal deck with per-card rotate/scale, pinned
    return-column fills.
  - Methods: the MRT map (lines draw in sequence, train rides via MotionPath scrub, pinned), calculator
    result bars via `scaleX`.
  - Brokers: pinned ownership lanes, pinned fighter card deal, the Fee Race as one persistent pinned,
    scroll-clocked scene.
  - Compare: scrubbed clash bars, a radar reveal, `batchReveal`-ed facts, a pinned fee jar scrubbing years
    1→40.
- **Consolidation (agent A):** five near-identical per-page section→formation observers collapsed into one
  (`backdrop.js:mountBackdrop`'s own `IntersectionObserver`); four near-identical scrub-on-entry helpers
  collapsed into `motion.js:scrubOnEntry`; the visual calculator's styling consolidated into one
  `calc.css` shared by the three pages that mount it.
- **Independent verification + fixes:** `calc.js`'s market radio was reading the wrong form field name
  (fixed — the calculator was silently stuck on one market); the calculator's FX cell was missing a
  freshness badge (fixed); the last pinned scene on a short page could be unreachable (fixed via an
  adaptive pin-start); an SVG `<g>`'s `svgOrigin` was producing ~300,000px transform offsets under GSAP's
  custom-origin compensation (replaced with `transform-box: fill-box` in CSS); provider-table tag chips
  were accepted as an additive parity difference, not a gap; and text-coverage checks found 5 failing
  scenes (fighters card overlap, ownership chip paint order, MRT map label/heading overlap, hub scatter
  label collisions, products spectrum tag overflow) — all fixed 29 Sep, see
  [DECISIONS.md §14](../DECISIONS.md) for each one and where it's handled.

## Decisions kept / discarded
- **Kept:** no WebGL; maximal scroll-driven animation; project laws 6 (text never hidden, fee numbers never
  mid-tween) and 7 (transform/opacity-only motion, no render loops); the Fee Race as one persistent pinned
  scene rebuilt with `tl.clear()` + a progress seek rather than destroy/recreate (avoids a scroll-position
  jump on every calculator result); the compare fee jar's adaptive pin start (`'top top'` vs.
  `'bottom bottom'`) instead of a fixed 100vh spacer; the MRT map's scale-to-fit-once approach (a constant
  transform, never scroll-driven).
- **Discarded:** a "lite" Three.js alternative (considered, then rejected in favour of removing WebGL
  entirely); the jsDelivr CDN exception (cdnjs-only again); a fixed 100vh scroll tail for the fee jar;
  clipping/panning the MRT map instead of scaling it to fit (caused the label/heading overlap and a
  `ScrollTrigger`-refresh layout loop — see DECISIONS §14); dealing the brokers "fighters" cards from one
  shared centre stack (caused cards to cover each other mid-flight).

## Tests and benchmarks
Headless-Edge perf, same probe methodology throughout (`scratchpad/perf-probe-A.mjs`; note the frame-time
regime caveat — a vsync-capped run reads ~16.7 ms per frame at rest, an uncapped run ~7.7 ms, so numbers
are only ever compared within one run, never across differently-capped runs):

| Stage | Scroll p95 | Frames >33 ms | Idle LoAF |
| --- | --- | --- | --- |
| Baseline (26 Sep, WebGL stage) | 67–150 ms | 55–99% | 27–45 |
| Foundation (26 Sep, backdrop.js + scene()) | ≈16.8 ms | 0.2–1.5% | 0 |
| Final (29 Sep, all fixes + text coverage) | 6–10 ms | ≤0.8% | 0 |

(Foundation and final rows differ mainly by frame-time regime, not real work — see the caveat above; the
uncapped final run measured p95 8.3–8.5 ms and 0.1–0.5% >33 ms across all 5 pages,
`scratchpad/perf-verify-current.json`.)

- `npm test` passes.
- `npm run build` passes (writes `_site/`).
- `openspec validate visual-edition --strict` passes.
- Independent verifier checklist: **26 pass**; one item — A.15, the tab-hidden pause — **not run**
  (headless Edge can't emulate a backgrounded tab; verified by static analysis of the code only, see
  DECISIONS §14 open ends).

## OpenSpec snapshot
```
$ openspec list --json
{
  "changes": [
    {
      "name": "visual-edition",
      "completedTasks": 18,
      "totalTasks": 19,
      "lastModified": "2026-09-28T17:42:14.059Z",
      "status": "in-progress"
    }
  ]
}
```
The 19th task (4.4 — drift check + `openspec validate --strict`) is completed by this same session; see
"Tests and benchmarks" above and the report at the end of this session.

## Live state
- The preview server (`node server.js`, port 5173) started by an earlier `preview_start` may still be
  running.
- Generated this session: `_site/` (git-ignored, from `npm run build`); `graphify-out/graph.json` rebuilt
  (`graphify . --code-only`): 699 nodes, 1837 edges, 57 communities.
- Scratchpad scripts (not in the repo): `perf-probe-A.mjs`, `formation-sequence.mjs`,
  `law6-consolidated.mjs`, `consolidated-console.mjs`, and the page agents' own `verify-*.mjs`/`wave2*.mjs`/
  `law6.mjs` checks.
- No scheduled jobs.

## Open ends
1. **The user needs to `git add` the untracked visual files.** Drift-check shows 3 DEAD-PATH rows purely
   because `backdrop.js`/`brokers.js`/`compare.js` (plus several CSS/HTML files) are untracked — the paths
   are real and grep-verified; the tool only resolves against `git ls-files`.
2. **Archive the change** (`/opsx:archive visual-edition`) after the user commits.
3. **Stable-site 375px overflow** on methods/brokers (a 640px-minimum explainer SVG) — a follow-up task
   was offered, not fixed here (`site/**` was out of scope for the doc-reconciliation session).
4. **Tab-hidden pause is unverified empirically** — static analysis only (see above).
5. **Idle budget runs ~74% on the visual pages vs. the stable site's ~360%**, both at 0 idle LoAF — GSAP's
   ticker slices up idle periods even when nothing is animating, so the two numbers aren't directly
   comparable; not a regression.
6. **`motion.js:countUp` is now unused** — zero call sites in `site/visual/js`; flagged for removal rather
   than removed here (a pure doc/verification session).
7. **The compare page's calculator accent colour falls back to methods' amber** instead of a
   compare-specific accent — cosmetic, not a content or fee issue.
8. **`favicon.ico` 404s site-wide** (both editions) — not a visual-edition-specific issue.
9. **gbrain isn't installed**, so this log isn't indexed (same note as the 24 Sep log).

## Resume
```
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\skills\supercharge\scripts\preflight.ps1"
openspec list --json
npm test
npm run build
npm run serve
node <scratchpad>\perf-probe-A.mjs <urls> --label=x
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\skills\supercharge\scripts\drift-check.ps1"
```

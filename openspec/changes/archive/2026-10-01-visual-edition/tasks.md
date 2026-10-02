# Tasks

## 1. Shared groundwork (Wave A)

- [x] 1.1 `site/js/content.js`: move `GLOSSARY`, `WORLD_META`, `TEASER_GROUP`, the quiz `QUESTIONS`, `scoreEntry` and the pure quiz picking out of `components.js` / `index.js`. Verify the stable quiz result and glossary are unchanged (before/after capture).
- [x] 1.2 `site/js/feeview.js`: `feeSummary`, `freshnessView` and the missing-fee link. `feeLine`/`freshnessBadge` become thin renderers over them. Verify `.fee-line` text and `a.badge-link` hrefs on all 5 stable pages are identical before and after.
- [x] 1.3 `data.js` fetches `sgdata.json` relative to `import.meta.url`. Verify both `/site/` and `/site/visual/` load data.
- [x] 1.4 `scripts/build-site.mjs` + `npm run build`. The Pages workflow's assemble step uses it; add a root `vercel.json` and `_site/` in `.gitignore`. Verify the `_site/` tree.
- [x] 1.5 `site/js/edition-switch.js` (`editionHref`, `isVisualEdition`, `mountEditionSwitch`) + CSS, mounted by the stable `renderChrome`. Verify href mapping (including query string and the Pages subpath), no overlap with the header controls, no horizontal scroll at 375px, and no animation under reduced motion.

## 2. Visual foundation + hub (Wave B)

- [x] 2.1 `site/visual/css/visual.css`, `js/shell.js` (header, disclaimer, freshness pill/panel/refresh, glossary, edition switch, Calm mode), `js/motion.js`, `js/chaos.js`, `js/stage.js`, `js/fx.js`, `js/analytics.js`. Verify 0 console errors. Check the reduced-motion and no-WebGL fallbacks, and that no `/_vercel/` request is made on localhost. *(stage.js and the no-WebGL path superseded by 2.3.)*
- [x] 2.2 `site/visual/index.html` + `js/hub.js`: kinetic hero, portal journey, fling-card quiz with a slot reveal, bubble galaxy + table, and foil world cards. Verify quiz-result parity with the stable hub, and that the world-card teasers match. *(3D galaxy superseded by 2.4.)*
- [x] 2.3 Light foundation (2026-09-26 rework):
  - Record a headless-Edge perf baseline first.
  - Delete `stage.js` and the import maps, and remove the custom cursor.
  - Remove `hasWebGL`/`renderLoop`/`?nowebgl` from `motion.js`.
  - New `backdrop.js` (`mountBackdrop`: `pulse`, `setFormation`, still exposed as `shell.getStage()`, and `sg:stageready` still fires).
  - `motion.js`: `scene`, `batchReveal`, `scrubHeading`, only the plugins actually used, `?nogsap=1`.
  - `visual.css`: no blur, no blend modes, a static aurora, the ring spinning on hover only, and a scroll-progress bar.
  - `fx.js`: per-element tilt/magnetic, confetti capped.
  - Verify 0 console errors, `?calm=1` / `?nogsap=1` static layouts, and that every page still renders.
- [x] 2.4 Hub scenes:
  - Hero: pinned coin journey via MotionPath.
  - Quiz: deals in, not pinned.
  - An SVG risk-vs-access scatter replaces the 3D galaxy: same encoding and click-through, `<details>` table kept. Pinned: axes draw, then the bubbles burst into place.
  - World cards: pinned fan-out and flip.
  - Verify quiz and teaser parity, and scatter data parity with the stable hub table.
- [x] 2.5 Products scenes:
  - Spectrum: markers drop in, pinned.
  - Deck: the pinned horizontal scroll gets per-card rotate/scale.
  - Returns columns: scaleY fill, pinned.
  - Controls: reveal only.
  - Verify entry, pros/cons and steps parity.
- [x] 2.6 Methods scenes:
  - MRT map: lines draw in sequence and the train rides each line via scrub, pinned.
  - Remove the infinite train CSS.
  - Calculator result bars use scaleX.
  - Verify provider parity and that calculator totals equal the stable ones.

## 3. Visual pages (Wave C, parallel)

- [x] 3.1 Products: flip-card deck, risk thermometer, return-source columns. Verify entry, pros/cons and steps parity.
- [x] 3.2 Methods: MRT line map, provider tables, calculator. Verify provider parity and that calculator totals equal the stable ones.
- [x] 3.3 Brokers:
  - Ownership lanes: pinned scene.
  - Fighters: pinned deal.
  - The Fee Race as a pinned, scroll-clocked scene:
    - lanes use `scaleX`, and the cheapest finishes first;
    - order and labels come only from the calculator's ranking;
    - the timeline is rebuilt on every result;
    - the winner banner names the scenario and cost group, and is readable throughout;
    - a pit lane holds incomplete providers.
  - Verify ranking parity for all 3 presets and the HK market, including the S$0 tie.
- [x] 3.4 Compare:
  - Arena clash bars scrubbed on entry.
  - Radar reveal.
  - Facts `batchReveal`.
  - A pinned fee jar that scrubs years 1→40:
    - slider kept in sync;
    - memoized `computeCost` per year, rebuilt on every result;
    - scaleY fill, throttled coins;
    - "not in total" FX/exchange rows.
  - Verify the `?group=&market=` presets (from `PRODUCT_COST_LINKS`) and parity with the stable compare page.

## 4. Verify and reconcile

- [x] 4.1 Independent verifier:
  - Parity checklist on all 5 visual pages.
  - Every `spec.md` scenario, including:
    - empty dataset;
    - `?nogsap=1`;
    - disclaimer dismissal;
    - missing-fee link;
    - pit lane never the winner;
    - tabbing into a pinned scene;
    - scrolling back after an input change.
  - `?calm=1`, 375px (scrub without pins, no horizontal scroll), dark/light.
  - The edition switch on all 10 pages, and internal links staying under `/visual/`.
  - The headless-Edge perf probe against the targets in design.md, compared with the 2.3 baseline.
  - `npm test` and `npm run build`.
- [x] 4.2 `docs/visual/IMPLEMENTATION.md` rows → `docs/visual/STATUS.md`, then `docs/site/*` (shared modules, switch), `docs/STATUS.md` and `docs/architecture-map.md` (new component, laws 5–7). Write `docs/visual/reviews/review-visual-edition.md`. (`ARCHITECTURE.md` was revised before code, on 2026-09-26.)
- [x] 4.3 CLAUDE.md: layout, cdnjs-only CDN rule, Vercel/build, motion performance rules. DECISIONS.md §14: decisions + edge cases.
- [x] 4.4 Drift check shows 0 dead rows, and `openspec validate visual-edition --strict` passes.

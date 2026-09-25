# Tasks

## 1. Shared groundwork (Wave A)

- [x] 1.1 `site/js/content.js`: move `GLOSSARY`, `WORLD_META`, `TEASER_GROUP`, the quiz `QUESTIONS`, `scoreEntry` and the pure quiz picking out of `components.js` / `index.js`. Verify the stable quiz result and glossary are unchanged (before/after capture).
- [x] 1.2 `site/js/feeview.js`: `feeSummary`, `freshnessView` and the missing-fee link. `feeLine`/`freshnessBadge` become thin renderers over them. Verify `.fee-line` text and `a.badge-link` hrefs on all 5 stable pages are identical before and after.
- [x] 1.3 `data.js` fetches `sgdata.json` relative to `import.meta.url`. Verify both `/site/` and `/site/visual/` load data.
- [x] 1.4 `scripts/build-site.mjs` + `npm run build`. The Pages workflow's assemble step uses it; add a root `vercel.json` and `_site/` in `.gitignore`. Verify the `_site/` tree.
- [x] 1.5 `site/js/edition-switch.js` (`editionHref`, `isVisualEdition`, `mountEditionSwitch`) + CSS, mounted by the stable `renderChrome`. Verify href mapping (including query string and the Pages subpath), no overlap with the header controls, no horizontal scroll at 375px, and no animation under reduced motion.

## 2. Visual foundation + hub (Wave B)

- [x] 2.1 `site/visual/css/visual.css`, `js/shell.js` (header, disclaimer, freshness pill/panel/refresh, glossary, edition switch, Calm mode), `js/motion.js`, `js/chaos.js`, `js/stage.js`, `js/fx.js`, `js/analytics.js`. Verify 0 console errors. Check the reduced-motion and no-WebGL fallbacks, and that no `/_vercel/` request is made on localhost.
- [x] 2.2 `site/visual/index.html` + `js/hub.js`: kinetic hero, portal journey, fling-card quiz with a slot reveal, bubble galaxy + table, and foil world cards. Verify quiz-result parity with the stable hub, and that the world-card teasers match.

## 3. Visual pages (Wave C, parallel)

- [ ] 3.1 Products: flip-card deck, risk thermometer, return-source columns. Verify entry, pros/cons and steps parity.
- [ ] 3.2 Methods: MRT line map, provider tables, calculator. Verify provider parity and that calculator totals equal the stable ones.
- [ ] 3.3 Brokers: the Fee Race with a named-scenario winner, a pit lane for incomplete providers, and Flip reordering. Verify ranking parity for all 3 presets and the HK market.
- [ ] 3.4 Compare: morphing radar, fee jar, and "not in total" FX/exchange rows. Verify `?group=&market=` presets and parity with the stable compare page.

## 4. Verify and reconcile

- [ ] 4.1 Independent verifier: parity checklist on all 5 visual pages, reduced motion, no WebGL, 375px, dark/light, edition switch on all 10 pages, and the frame loop pausing when the tab is hidden. Also `npm test` and `npm run build`.
- [ ] 4.2 `docs/visual/IMPLEMENTATION.md` rows → `ARCHITECTURE.md` → `docs/visual/STATUS.md`, then `docs/site/*` (shared modules, switch), `docs/STATUS.md` and `docs/architecture-map.md` (new component, laws 5–6). Write `docs/visual/reviews/review-visual-edition.md`.
- [ ] 4.3 CLAUDE.md: layout, CDN rule for jsDelivr addons, Vercel/build. DECISIONS.md §14: decisions + edge cases.
- [ ] 4.4 Drift check shows 0 dead rows, and `openspec validate visual-edition --strict` passes.

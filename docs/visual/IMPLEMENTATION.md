# visual — implementation map

| Model | Code |
| --- | --- |
| shared content (glossary, world meta, quiz) | `site/js/content.js` |
| feeSummary / freshnessView / missing-fee link | `site/js/feeview.js:feeSummary` |
| editionHref / edition switch | `site/js/edition-switch.js:editionHref` |
| visual shell (header, disclaimer, freshness, Calm mode) | `site/visual/js/shell.js:mountShell` |
| scroll-progress bar | `site/visual/js/shell.js:mountProgressBar` |
| motion registry + reduced-motion gate | `site/visual/js/motion.js:motionScope` |
| scene / batchReveal / scrubHeading / scrubOnEntry / refreshScenes | `site/visual/js/motion.js:scene` |
| backdrop (formations, pulse, section→formation observer) | `site/visual/js/backdrop.js:mountBackdrop` |
| roll (seeded choreography) | `site/visual/js/chaos.js` |
| interaction fx (tilt, magnetic, confetti) | `site/visual/js/fx.js:mountFx` |
| analytics (Vercel only) | `site/visual/js/analytics.js` |
| hub scenes (journey, scatter, world cards) | `site/visual/js/hub.js:mountJourneyScene`, `:mountScatterScene`, `:mountWorldCardsScene` |
| hub scatter label collision layout | `site/visual/js/hub.js:layoutScatterLabels` |
| products scenes (spectrum, deck, returns) | `site/visual/js/products.js:mountSpectrumScene`, `:setupDeckMotion`, `:mountReturnsScene` |
| products spectrum tag layout | `site/visual/js/products.js:layoutSpectrumTags` |
| methods scene (MRT map) | `site/visual/js/methods.js:mountMapScene` |
| calculator (shared across the 3 visual pages that use it) | `site/visual/js/calc.js:mountVisualCalculator`, `site/visual/css/calc.css` |
| brokers scenes (ownership, fighters, fee race) | `site/visual/js/brokers.js:mountOwnershipScene`, `:mountFightersScene`, `:mountFeeRace` |
| compare scenes (fee jar, clash bars, radar wrapper) | `site/visual/js/compare.js:renderFeeJar`, `:mountClashScrub`, `:mountRadarWrapScrub` |
| journey order (`NAV_ITEMS`, `nextStop`, `nextHref`, `stopHref`) | `site/visual/js/stops.js:nextStop`, `:nextHref` |
| journey (runway + warp, arming/navigation, prefetch, view-transition handoff, arrival warp-in, HUD, Compare finale) | `site/visual/js/journey.js:mountJourney`, `css/visual.css` "Journey" section |
| cross-document view-transition opt-in (inline, first in `<head>`) | inline `<style>` in each `site/visual/*.html` `<head>`; shell.js head comment |
| hub marquee (velocity-driven journey stops) | `site/visual/js/hub.js:mountMarquee` |
| products pack bursts / deck velocity skew | `site/visual/js/products.js:wirePackBursts`, `:wireDeckVelocity` |
| methods portal train (inside the runway stage) | `site/visual/js/methods.js:mountPortalTrain` |
| brokers photo finish | `site/visual/js/brokers.js:mountFeeRace` (`firePhoto`, `playPhoto`, `killPhoto`) |
| scene trigger ordering + debounced ordered refresh | `site/visual/js/motion.js:orderTriggers`, `:scheduleSceneRefresh` |
| ScrollTrigger idle rAF loop suppression | `site/visual/js/motion.js:suppressScrollTriggerRafLoop` (called from `whenGsap`) || pages | `site/visual/{index,products,methods,brokers,compare}.html` |
| build (Pages + Vercel) | `scripts/build-site.mjs`, `vercel.json` |

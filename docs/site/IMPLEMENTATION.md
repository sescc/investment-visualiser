# site — implementation map

| Model | Code |
| --- | --- |
| data loading (relative to `import.meta.url`) | `site/js/data.js` |
| headline component (cost-bearing first) | `site/js/data.js:bestFeeComponent` |
| shared content (glossary, world meta, quiz) — used by both editions | `site/js/content.js` |
| feeSummary / freshnessView / missing-fee link — used by both editions | `site/js/feeview.js:feeSummary` |
| edition switch (href mapping, floating button) — used by both editions | `site/js/edition-switch.js:editionHref`, `:mountEditionSwitch` |
| freshness badge (source link) | `site/js/components.js:freshnessBadge` |
| product fee line | `site/js/components.js:feeLine` |
| calculator (incl. FX info) | `site/js/components.js:mountFeeCalculator` |
| providers table | `site/js/components.js:providersTable` |
| charts | `site/js/charts.js` |
| hub + teasers | `site/js/index.js` |
| products / methods / brokers pages | `site/js/products.js`, `site/js/methods.js`, `site/js/brokers.js` |
| compare page | `site/js/compare.js` |
| icons | `site/js/icons.js` |
| design tokens / badge-link style | `site/css/tokens.css`, `site/css/app.css:badge-link` |
| build assembly (Pages + Vercel) | `scripts/build-site.mjs` |

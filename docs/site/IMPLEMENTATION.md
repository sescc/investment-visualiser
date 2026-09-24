# site — implementation map

| Model | Code |
| --- | --- |
| data loading | `site/js/data.js` |
| headline component (cost-bearing first) | `site/js/data.js:bestFeeComponent` |
| freshness badge (source link) | `site/js/components.js:freshnessBadge` |
| product fee line | `site/js/components.js:feeLineInner` |
| calculator (incl. FX info) | `site/js/components.js:mountFeeCalculator` |
| providers table | `site/js/components.js:providersTable` |
| charts | `site/js/charts.js` |
| hub + teasers | `site/js/index.js` |
| products / methods / brokers pages | `site/js/products.js`, `site/js/methods.js`, `site/js/brokers.js` |
| compare page | `site/js/compare.js` |
| icons | `site/js/icons.js` |
| design tokens / badge-link style | `site/css/tokens.css`, `site/css/app.css:badge-link` |

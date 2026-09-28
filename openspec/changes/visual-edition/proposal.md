# Proposal

## Why

The stable site is complete and correct, but it's plain. The user wants a second, spectacle-first edition ("vibrant, animated, exciting, unpredictable, adventurous, outlandish") that shows **the exact same content**. They want it previewable on Vercel while it's being built, and it must not change the stable site's look or behaviour.

**Revised 2026-09-26 (user):** the first build, with a Three.js particle stage behind blurred glass panels, was "very laggy even on a reasonably-powered laptop". The user chose to remove WebGL entirely and to put the spectacle into **scroll-driven animation** instead, at the "maximal" level: most sections pin and play as scroll-scrubbed scenes.

## What Changes

- **A new visual edition** at `site/visual/` (served at `/visual/` on Pages and Vercel). It has the same 5 pages (hub, products, methods, brokers, compare) with the same data, fees, pros/cons, steps, glossary and quiz. It adds:
  - Pinned, scroll-scrubbed scenes (GSAP ScrollTrigger), scrubbed headings, a scroll-progress bar, and cross-document View Transitions.
  - A lightweight moving background: large colour blobs that drift and rearrange with scroll (transform/opacity only, no WebGL).
  - Seeded "unpredictable" choreography (a 🎲 Remix button, `?seed=`).
  - Per-page set pieces, each driven by scroll: a coin riding the hub journey, an SVG bubble map that bursts into place, a flip-card deck, an MRT-style method map with a train riding the line, the ownership lanes, the "Fee Race" (scroll is the race clock), and a fee jar that fills year by year.
  - Performance rules: only transform/opacity animate; no blur, blend modes or render loops; nothing works while the page is idle.
- **Shared pure modules.** Code moves out of the stable pages so both editions apply identical rules:
  - `content.js`: glossary, world meta, quiz questions and scoring.
  - `feeview.js`: the fee-line, freshness and missing-fee view-models.
- **Edition switch (user request).** A pinned round button in the top-right corner of every page of both editions links to the matching page in the other edition. The stable site's button invites readers to try the visual edition; the visual edition's button offers the way back to the normal site. This is the only visible change to the stable site.
- **Hosting.**
  - `scripts/build-site.mjs` assembles `_site/` (`site/` + `data/sgdata.*` + `.nojekyll`). The Pages workflow and a new `vercel.json` both use it.
  - Vercel Web Analytics and Speed Insights load only on `*.vercel.app`.
- **Data path.** `data.js` fetches `sgdata.json` relative to its own module URL, so pages at any depth work.
- **Conventions.** cdnjs only. *(Superseded 2026-09-26: the earlier user-approved jsDelivr exception for Three.js addons is no longer needed, because Three.js is removed.)*

## Capabilities

### New Capabilities
- `visual-edition`: what a reader of `/visual/` sees and can rely on. It covers content and fee parity with the stable site, motion that is always optional, light and never blocking, the edition switch, and analytics limited to Vercel.

### Modified Capabilities
- none. `cost-comparison` behaviour is reused unchanged.

## Impact

- **New:**
  - `site/visual/**`
  - `site/js/content.js`, `site/js/feeview.js`, `site/js/edition-switch.js`
  - `scripts/build-site.mjs`, `vercel.json`
  - `docs/visual/*`
- **Changed (no behaviour change except the switch):**
  - `site/js/components.js`, `site/js/index.js`, `site/js/data.js`
  - `site/css/app.css`
  - `.github/workflows/scrape-and-deploy.yml` (assemble step), `package.json`, `.gitignore`
- **Removed:** `site/visual/js/stage.js` (Three.js), the import maps, the custom cursor.
- **Docs:** CLAUDE.md (layout, CDN rule, Vercel, motion performance rules), DECISIONS.md §14, `docs/architecture-map.md`, `docs/STATUS.md`.

# Proposal

## Why

The stable site is complete and correct, but it's plain. The user wants a second, spectacle-first edition ("vibrant, animated, exciting, unpredictable, adventurous, outlandish") that shows **the exact same content**. They want it previewable on Vercel while it's being built, and it must not change the stable site's look or behaviour.

## What Changes

- **A new visual edition** at `site/visual/` (served at `/visual/` on Pages and Vercel). It has the same 5 pages (hub, products, methods, brokers, compare) with the same data, fees, pros/cons, steps, glossary and quiz. It adds:
  - Three.js particle stage, GSAP scroll choreography, and cross-document View Transitions.
  - Seeded "unpredictable" choreography (a 🎲 Remix button, `?seed=`).
  - Per-page set pieces: a bubble galaxy, a flip-card deck, an MRT-style method map, the "Fee Race", and a draining fee jar.
- **Shared pure modules.** Code moves out of the stable pages so both editions apply identical rules:
  - `content.js`: glossary, world meta, quiz questions and scoring.
  - `feeview.js`: the fee-line, freshness and missing-fee view-models.
- **Edition switch (user request).** A pinned round button in the top-right corner of every page of both editions links to the matching page in the other edition. The stable site's button invites readers to try the visual edition; the visual edition's button offers the way back to the normal site. This is the only visible change to the stable site.
- **Hosting.**
  - `scripts/build-site.mjs` assembles `_site/` (`site/` + `data/sgdata.*` + `.nojekyll`). The Pages workflow and a new `vercel.json` both use it.
  - Vercel Web Analytics and Speed Insights load only on `*.vercel.app`.
- **Data path.** `data.js` fetches `sgdata.json` relative to its own module URL, so pages at any depth work.
- **Conventions (user decision).** Besides cdnjs, the visual edition may load Three.js addons from `cdn.jsdelivr.net/npm`, with pinned versions.

## Capabilities

### New Capabilities
- `visual-edition`: what a reader of `/visual/` sees and can rely on. It covers content and fee parity with the stable site, motion that is always optional, the edition switch, and analytics limited to Vercel.

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
- **Docs:** CLAUDE.md (layout, CDN rule, Vercel), DECISIONS.md §14, `docs/architecture-map.md`, `docs/STATUS.md`.

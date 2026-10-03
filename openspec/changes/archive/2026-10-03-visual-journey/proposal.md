# Proposal

## Why

The user wants the visual edition to read as one continuous journey, and asked for more adventurous spectacle without lag:
- Scrolling past the end of a page should carry the reader straight into the next page (Hub → Products → Methods → Brokers → Compare). Compare is the true end.

They also reported two bugs:
- On Products, the return-source columns pin over the middle of the page, covering the "Bonds & cash" text.
- Section headings wrap mid-word ("spectr|um", a lone "?").

## What Changes

**Bug fixes:**
- `scene()` orders ScrollTrigger creation and refresh by document position, so a scene created late (after an async mount) can't miscompute an earlier scene's start.
- Headings split into words first, so a line only ever breaks between words.

**Journey runway.** After the footer of every visual page except Compare there is a "next stop" runway.
- Scrolling down through it plays a scrubbed warp into the next page's title.
- At the end the browser navigates to the next page with a cross-document View Transition, so the title morphs into the next page's hero headline.
- A visible "Next: <page> →" link is always present, so keyboard and no-JS readers can continue.
- Calm mode, reduced motion and `?nogsap=1` show the link only and never navigate on their own.
- Back-button safety: the runway only arms after a fresh downward scroll into it during the current page view, so returning with Back never bounces the reader forward again.

**Journey HUD.** A small 5-stop rail shows where the reader is in the whole journey.

**Compare finale.** "Journey complete" end credits: a recap of the five stops, the disclaimer and links back to the start or to the normal site.

**One new signature moment per page**, each within the motion performance rules (law 7):
- Hub: a velocity-driven marquee of the journey stops between sections.
- Products: category bands pop in as "booster packs", and cards skew slightly with scroll velocity.
- Methods: the train leaves the map and becomes the runway's portal.
- Brokers: a "photo finish" freeze-frame on the race winner.

## Capabilities

### Modified Capabilities
- `visual-edition`: adds page-to-page journey navigation and the finale, and tightens the "never hide content" rule with the heading-wrap and pin-order cases.

## Impact

- `site/visual/js/motion.js` (scene ordering, heading split), `site/visual/js/products.js`
- New `site/visual/js/journey.js`, used by `shell.js`
- `site/visual/css/visual.css`, plus per-page JS/CSS for the signature moments
- `docs/visual/*`, DECISIONS §15

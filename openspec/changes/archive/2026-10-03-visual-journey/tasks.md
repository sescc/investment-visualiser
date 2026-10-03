# Tasks

## 1. Bug fixes (agent 1)
- [x] 1.1 `motion.js:scrubHeading` (and any other heading split) splits by `words,chars`. Verify: on all 5 pages at 375/768/1280px, line counts match the plain text.
- [x] 1.2 `motion.js:scene` uses `refreshPriority` in document order, with sort and refresh after async mounts. The products returns row pins only when it fits. Verify: pin-start assertions at 768/1024/1280px, no cross-section cover, and the law-6 sweep and perf probe on products.

## 2. Journey (agent 2, after 1)
- [x] 2.1 `site/visual/js/journey.js`: `nextStop`, the runway (scrub warp, arming, navigation, prefetch, view-transition name handoff, query carry-over), and the arrival warp-in. Mounted by `shell.js`. The link-only fallback renders without GSAP.
- [x] 2.2 Journey HUD rail.
- [x] 2.3 Compare finale ("journey complete").
- [x] 2.4 Verify in headless Edge:
  - hub→products→methods→brokers→compare by scrolling;
  - `pagereveal` has a `viewTransition`;
  - Back doesn't bounce;
  - calm, `?nogsap=1` and reduced motion are link-only;
  - keyboard reaches the link;
  - footer reachable;
  - perf probe and law-6 sweep on all 5 pages.

## 3. Signature moments (parallel, after 2)
- [x] 3.1 Hub: journey marquee driven by scroll velocity.
- [x] 3.2 Products: booster-pack band pops and card velocity skew.
- [x] 3.3 Methods: the train exits the map into the runway portal.
- [x] 3.4 Brokers: photo-finish freeze-frame on the winner.
- [x] 3.5 Verify: perf probe and law-6 sweep per page, and parity unchanged.

## 4. Reconcile
- [x] 4.1 `docs/visual/ARCHITECTURE.md` (runway, nextStop, navigate/prefetch rows), `IMPLEMENTATION.md`, `STATUS.md`; DECISIONS §15; CLAUDE.md if the conventions change.
- [x] 4.2 `npm test`, the drift check, `openspec validate visual-journey --strict`, then archive and write the session log.

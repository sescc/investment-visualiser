# 2026-10-03 — visual journey (page-to-page runway, spectacles, bug fixes)

Previous: [2026-10-01-visual-closeout.md](2026-10-01-visual-closeout.md). Full decisions and edge cases: [DECISIONS.md §14 (end) and §15](../DECISIONS.md).

## User requests
1. Scrolling past the end of a visual page should carry the reader into the next one, in the order Hub → Products → Methods → Brokers → Compare. Compare is the end.
2. More adventurous spectacle, without lag.
3. Bugs:
   - Products' return-source columns pinned over the "Bonds & cash" deck.
   - Headings wrapped mid-word.

## Done (OpenSpec `visual-journey`, archived as `openspec/changes/archive/2026-10-03-visual-journey/`)
- **Headings:** `scrubHeading` now splits `words,chars`. 0 of 60 headings wrap differently from their plain text (was 22 of 60).
- **Pin order:** `motion.js:orderTriggers` and `scheduleSceneRefresh` order every trigger by document order. The products bug came from `rebuildDeck` recreating the deck pin last.
- **Hub hero:** the stale translateY on the hub hero's pin trigger is fixed (`reveal()` now targets `.diagram-svg`).
- **Journey (`site/visual/js/journey.js` + `stops.js`):**
  - A runway after the footer plays a warp, then auto-navigates, and the View Transition morphs its title into the next page's hero.
  - It arms only on a real user scroll, so it never bounces after Back.
  - Calm mode, reduced motion and `?nogsap=1` show the link only.
  - Also: a 5-stop HUD, and a "Journey complete" finale on Compare.
- **View transitions:** the transition was skipped until the opt-in moved inline to the top of `<head>`. Headed Edge went from 0 of 12 to 12 of 12.
- **Spectacles:**
  - Hub: journey marquee.
  - Products: booster-pack bursts and velocity sway.
  - Methods: the train exits into the portal.
  - Brokers: photo finish, with DEAD HEAT on ties.
- **Idle:** about 200 to 400 rAF frames per 1.5 s became 6. ScrollTrigger's rAF bug-fix loop is suppressed on non-WebKit browsers, and InertiaPlugin was dropped.

## Tests
| Check | Result |
| --- | --- |
| `npm test` | passes |
| `npm run build` | OK |
| `journey-verify.mjs` | 44/44 |
| law-6 sweep | all 5 pages pass |
| `verify-pins` | 0 fail |
| `verify-headings` | 0 fail |
| `photo-verify` | all pass |
| `openspec validate --specs --strict` | 3/3 |

Perf, headless Edge, uncapped-frame regime:

| Page | p95 (ms) | % frames > 33 ms | Idle LoAF |
| --- | --- | --- | --- |
| index | 8.8 | 0.6 | 0 |
| products | 8.5 | 0.5 | 0 |
| methods | 8.3 | 0.0 | 0 |
| brokers | 8.5 | 0.9 | 0 |
| compare | 8.3 | 0.0 | 0 |

## Drift
2 DEAD-PATH rows: `site/visual/js/stops.js` and `journey.js`. Both files exist, but they are untracked, and the check resolves against `git ls-files`. They clear once the user commits.

## Open ends
1. **User:** `git add` the new files (`journey.js`, `stops.js`, the archive folder, this log), then commit and push `visual`. Check the Vercel preview, then merge to `main`.
2. Not checked on a real phone or touch device, or in Safari. On WebKit the ScrollTrigger rAF suppression is deliberately off.
3. The rAF suppression matches a function name in the minified ScrollTrigger build. If a GSAP upgrade renames it, the shim becomes a no-op; re-run the idle probe after any GSAP version bump.
4. Earlier open ends still stand: hiding the tab pausing animation is verified only statically, HK fees are missing for 13 brokers, and gbrain is not installed.
5. A stray empty `products.js` at the repo root, an agent's redirect mishap, was deleted.

## Live state
No servers or jobs are running. Scratchpad probes: `journey-verify.mjs`, `verify-pins.mjs`, `verify-headings.mjs`, `photo-verify.mjs`, `idle-probe2.mjs`, `vt-chain-headed.mjs`, `perf-probe-A.mjs`, `law6-consolidated.mjs`.

## Resume
```
openspec list --json
npm test
npm run serve        # then open http://127.0.0.1:5173/site/visual/index.html and scroll to the end
```

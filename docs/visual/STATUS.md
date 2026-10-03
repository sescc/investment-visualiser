# visual — status

In sync as of 2026-09-28. 5 pages, no WebGL, 11 pinned scenes. Perf (headless Edge, same run as the
stable reference pages): p95 ≈ 8.4 ms uncapped / <20 ms vsync-capped, ≤0.5% of frames >33 ms, 0 idle
long-animation-frames — down from the pre-rework baseline (p95 67–150 ms, 55–99% of frames >33 ms,
27–45 idle LoAF). Open items: the tab-hidden pause is verified only by static analysis, since headless
Edge can't emulate a backgrounded tab; idle budget runs ~74% against the stable site's ~360% (GSAP's
ticker slices up idle periods even at 0 LoAF, so the two aren't directly comparable). Provider-table tag
chips are an accepted addition over the stable page, not a parity gap.

Text-coverage fixes: done. All 5 previously-failing scenes now pass — 0/13 text-coverage checks failing
at both 1280px and 375px, 0 opacity violations. Re-verified: `?calm=1`, `?nogsap=1`, 375px, console errors
(0), and perf (p95 6–10 ms, ≤0.8% of frames >33 ms, 0 idle LoAF).

Journey (3 Oct 2026): in sync. Hub > Products > Methods > Brokers > Compare scroll straight on (runway after the footer, Compare ends with a finale); journey-verify 44/44 in headless Edge (chain, back-bounce with bfcache on and off, Calm/nogsap/reduced = link only, keyboard, seed carry-over, 375/768/1280 light+dark); cross-document view transition non-null on arrival (inline opt-in in each page head; headed Edge 12/12). Idle: 6 rAF frames per 1.5 s on all 5 pages (was ~200: ScrollTrigger rAF loop + Draggable/Inertia ticker). Perf (headless, uncapped regime): p95 8.3-8.8 ms, <=0.9% of frames >33 ms, 0 idle LoAF. Law-6 sweep (25 steps x 5 pages) passes. Open: scrollbar-drag may not count as arming intent; prefetch benefit unprovable on the dev server.

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

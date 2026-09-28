# site — status

In sync as of 2026-09-28. All 5 pages have zero console errors and no horizontal scroll. The pill reads "fees for 53/56". Badges link to sources, SGX cards list exchange fees by label, and the calculator shows FX as "not in the totals". HK ranks 4 brokers. The only visible change from the visual-edition work is the floating edition-switch button, present on every page.

Fixed 2026-09-29: methods and brokers no longer overflow at 375px — the card list grids now use `grid-template-columns:minmax(0,1fr)` (the cause was the grid track, not the explainer SVG; see DECISIONS.md §14).

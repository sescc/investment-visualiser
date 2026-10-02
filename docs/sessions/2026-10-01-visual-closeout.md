# 2026-10-01 — visual-edition close-out

Previous: [2026-09-29-visual-rework.md](2026-09-29-visual-rework.md). Decisions: [DECISIONS.md §14](../DECISIONS.md).

## Done
- Ticked task 4.4: `openspec validate visual-edition --strict` passes and the drift check shows 0 dead / 54.
- `npm test` passes. `npm run build` wrote `_site/`, including `_site/visual/index.html`; `_site/` was then deleted.
- Archived the change as `openspec/changes/archive/2026-10-01-visual-edition/`. The new main spec is `openspec/specs/visual-edition/spec.md`; its placeholder Purpose was replaced. `openspec validate --specs --strict` passes: 3 of 3.
- Graph updated incrementally (`graphify . --code-only`).

## Open ends from 2026-09-29, re-checked
1. Untracked visual files: resolved, committed in `7935d34` on `visual`.
2. Archive: done.
3. Stable 375px overflow on methods/brokers: fixed (DECISIONS §14).
4. Pausing animation when the tab is hidden: still verified only by static analysis.
5. Idle-budget numbers: not a regression (see the previous log).

## Still open
- **User:** commit this close-out, then merge `visual` into `main`. That publishes `/visual/` and the stable edition-switch button together.
- HK fees are missing for 13 brokers. UOB unit trusts, Kristal.AI and Coinbase can't be scraped. gbrain is not installed.

## OpenSpec snapshot
`openspec list --json` → `"changes": []`.

## Live state
No servers or jobs are running.

## Resume
```
openspec list --json
npm test
npm run build
npm run serve
```

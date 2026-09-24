# 2026-09-23 — supercharge bootstrap (low effort)

Previous handoff: [../SESSION-2026-09-22.md](../SESSION-2026-09-22.md) (kept in place, not migrated).

## Decisions
- **Adopt the supercharge loop** (user). New sessions log here in `docs/sessions/`; `docs/SESSION-*.md` stays as history.
- **Four components from code seams** (Claude): scraper, server, cost-model (`site/js/cost.js` split from site because it is the single fee→money morphism), site.
- **OpenSpec specs option B** (Claude): `openspec/specs/` holds external surface only (CLI flags, HTTP API, sgdata shape, what pages show). Recorded in `openspec/config.yaml` with the fee hard rule in `context:`.
- **Graph built `--code-only`** (Claude): no LLM API key in WSL for doc extraction. `graphify-out/` added to `.gitignore`.
- **Not done:** `git init` — left to the user (global rule: user handles git).

## Edge cases
- `drift-check.ps1` exits 2 outside a git repo. Substituted a manual check with the same row pattern: 39 rows, 0 dead.

## Tests run
- `npm test`: all cost.js checks passed.

## OpenSpec snapshot
`openspec list --json` → `"changes": []` (nothing in flight).

## Live state
No running processes, servers or jobs. Generated: `graphify-out/graph.json` (335 nodes, 664 edges, 42 communities).

## Open ends (next session, high effort)
1. Per-component `source` in `merge.js` for multi-page adapters (smallest).
2. Unmodelled costs: fund expense ratios, FX spreads, uSMART US <USD 40 tier.
3. Unscrapable sources: SGX clearing, UOB unit trusts, Kristal.AI, Coinbase (no evasion).
4. `git init` (user), after which `drift-check.ps1` works.

## Resume
```
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\skills\supercharge\scripts\preflight.ps1"
openspec list --json
npm test
npm run serve
```

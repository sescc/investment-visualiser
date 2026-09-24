# Decision & edge-case log

Sessions of 22 Sep 2026: §1–8 session 1 (project creation), §9–10 session 2 (headless adapters, cost-model extensions).
23–24 Sep 2026: §11 supercharge session loop adopted, §12 open follow-ups closed.
Earlier bullets superseded later are marked in place. Newest context last within each section.
Format: **Decision** — why. Edge cases list what happens and where it's handled.

## 1. Scope & requirements (from the user)
- **Audience:** Singapore investing laymen; site must be visual-heavy.
- **Three datasets:** investment *products*, investing *methods/channels* (robo, bank, SRS, CPFIS…), *broker types*. Each needs fees (cheapest highlighted), pros/cons (products: capital growth vs dividends), and step-by-step apply/register guides.
- **Model split:** Opus for design, planning and review; Sonnet subagents for routine code and content.
- **Stack:** plain static HTML/CSS/JS (user choice over Vite/React and Astro/Next).
- **Delivery:** local project folder only; not published as an Artifact.
- **Fee data:** the user rejected "agents look up fees" in favour of a **reusable, modular scraper** that the user or the website can run on demand, stamping every figure with an "as of" date.
- **Interpretation:** "scrape details of all stock options" = all investment options on the site, not options contracts. Options/CFDs are covered as one flagged, advanced product type.

## 2. Architecture decisions
- **Node 24 scraper using cheerio + built-in `fetch`; no headless browser.** A probe during planning showed most fee pages are server-rendered (POEMS, IBKR, DBS, Syfe, StashAway, CPF) and MAS has a key-free JSON statistics API. Pages that need JS/PDF parsing are scoped out rather than papered over.
- **One adapter file per source** (`scraper/sources/<id>.js`). One adapter may fill several targets (`entryId` or `entryId/providerId`). A failure in one adapter never stops the others.
- **Adapters must throw, never guess**, when the expected text isn't found.
- **`data/sgdata.js` (`window.SGDATA = …`) alongside `sgdata.json`**, originally so the site could work on `file://` (see §6 for the reversal).
- **`server.js`** is a tiny `node:http` server:
  - It binds to 127.0.0.1 only, checks the Host header, and serves only `/site/**` and the two data files, with path-traversal protection.
  - `POST /api/refresh` runs the scraper in-process. The `only` ids are allowlisted against the adapter files and never interpolated into a shell. One refresh runs at a time; a second gets 409.
- **ES modules** throughout (`"type": "module"`), with Chart.js loaded from cdnjs and fonts from Google Fonts only.
- **Design tokens in `site/css/tokens.css`** give each dataset its own hue: products teal, methods amber, brokers violet. Green marks the cheapest option, amber warnings, and SG red is used only for the logo and disclaimer icon. Light/dark via `prefers-color-scheme` plus a `data-theme` toggle.
- **Project skills:** `refresh-sg-data` (run/fix/add adapters) and `add-sg-entry` (add content). Both need `name`/`description` frontmatter to be discoverable.

## 3. The fee hard rule (advisor-driven, pre-implementation)
- **Every fee value in `data/` must come from a scraper run.** Baseline JSON holds `feeSpecs` (where the figure lives and what to extract), never numbers.
  - *Why:* a model-recalled number carrying a "verified" stamp reads as authoritative to a layman deciding where to put money.
- **Missing data → "Not available — check provider ↗"**, linking to the provider's own fee page.
- **Structural facts** (e.g. the SSB minimum and cap) are allowed in prose only with an official citation link.
- **Adapter notes must not contain hand-typed figures either.** Seven notes were fixed at review (DBS digiPortfolio, Endowus ×2, Independent Reserve, OCBC unit trusts, Phillip SBP, Syfe), plus the old OCBC BCIP and Tiger notes.
- **Authored steps are researched from official pages** (MAS, CPF, SGX, IRAS, MoneySense, providers), and each block ends with the official link.

## 4. Cost model decisions (`site/js/cost.js`)
- **Typed fee components instead of display strings**, so costs can be computed. Types:
  - Per trade: `per_trade_pct`, `per_trade_min`, `per_trade_flat`.
  - Holding: `aum_annual_pct` (with `tiers`), `custody_monthly`, `platform_flat_annual`.
  - Buying: `fx_spread_pct`, `sales_charge_pct`, `transaction_flat`. *(`fx_spread_pct` superseded: display-only, never summed — see §12.)*
  - Display only: `yield_pct` (a return, never summed) and `other` (needs a `label`).
  - *Why:* broker costs (percentage with minimum, annual AUM %, FX spread, flat fees) can't be compared as strings.
- **One `computeCost(item, scenario, fx)`** is the only place fees become money. The calculator, leaderboards, provider tables and hub teasers all use it.
- **Zero-growth monthly simulation.** It is conservative and fee-only, and assumes no investment returns.
- **Tiered AUM fees are blended across bands**, matching how StashAway and Endowus publish them.
- **Incomplete providers are never ranked as cheap.** They are listed separately with a reason.
- **"Cheapest" always names its scenario.** Presets: S$500/month plan (10 years), S$50k lump sum, 10 US trades/month. The ranking order changes with the profile.
- **Cost groups (added at review):** rank only like-for-like.
  - The groups are stock brokers, robo-advisors, regular savings plans, fund platforms & bank unit trusts, crypto exchanges, and SSB/T-bill applications. Each group states which costs it excludes.
  - *Why:* the first run ranked crypto exchanges, S$2 SSB applications and S$0 fund platforms alongside stock brokers, which was meaningless.
- **Per-trade `group` field** (e.g. `"platform"`): each group is costed as its own max(pct × size + flat, min), then summed.
  - *Why:* Tiger charges a separate platform fee with different rates, and ignoring it made Tiger look cheaper.
- **Implicit trade count:** when trades/month is 0, the model counts one buy for the lump sum plus one per monthly contribution.
  - *Why:* the S$50k lump-sum preset had zero trades, which dropped all brokers from the ranking.
- **FX:** USD fees convert using the scraped MAS USD/SGD rate. If the rate is missing, the provider is marked incomplete; no rate is ever hardcoded. *(Extended in §12: any currency via `fx[<CUR>SGD]`; HKD added.)*

## 5. Data & scraper edge cases
- **`--only` runs wiped other adapters' data (bug, fixed).** `merge.js` reset every entry's fees and carried over only *failed* adapters. Now adapters not run this time keep their previous components and report rows. This matters because the refresh button uses partial runs.
- **Failed adapter:** its previous components are carried over with `lastRunOk: false`, and the UI ages them by `asOf`.
- **Concurrent scraper runs race on `sgdata.json`.** Parallel agents used `--dry` only, and the full write ran once at the end.
- **MAS FX:** there is no public JSON exchange-rate endpoint (the data.gov.sg series ended in 2015). The adapter does an ASP.NET WebForms postback on the MAS Exchange Rates page.
- **SSB, T-bill and SGS yields** also use MAS `fdanet` postbacks. The T-bill adapter skips a same-day unauctioned placeholder row.
- **MAS pages bot-block some fetchers.** The content agent verified them in a real browser instead.
- **Coinhako** uses a Zoho Desk public API that was found by inspecting network requests.
- **Endowus** has two conflicting tier tables. The adapter anchors on "All Endowus Fees at a Glance", confirmed current by screenshot.
- **Longbridge** raw HTML contains placeholder `0%` values that are replaced after JS runs. It was not shipped in session 1, because scraping it would be actively wrong rather than just missing. *(Now scraped via the browser path with a non-zero wait predicate — see §9.)*
- **Moomoo:** the adapter uses the Help Center fee schedule, not the promotional pricing page. SG commission and platform fee have identical rates and minimums, so their sum is exact.
- **OCBC BCIP:** "0.3% or S$5 per counter, whichever is higher" is modelled as `per_trade_pct` + `per_trade_min` (each monthly buy is a trade). It was first stored as a sales charge, which dropped the S$5 minimum and showed S$180 instead of S$600.
- **Phillip Share Builders Plan:** the fee is a % of portfolio value with a monthly minimum and cap. It was modelled as an annual AUM % only in session 1. *(Superseded: `minMonthly` + `monthlyCaps` — see §10.)*
- **Per-share US fees** (Tiger, IBKR): in session 1 the per-order minimum stood in for a typical order. *(Superseded: `per_share` + `per_trade_max_pct` — see §10.)*
- **Promotional rates:** the standard rate is always used; promos go in `note`.
- **Skipped sources in session 1** (show "check provider"). *Session 2 status is in §9: uSMART, Saxo, FSMOne, Upbit, Longbridge and fixed deposits (via bank board rates) now work; SGX clearing, UOB unit trusts, Kristal.AI and Coinbase remain skipped.*
  - SGX clearing fee: the rulebook URL was actually the options fee, and the real page is a JS-only page with no API.
  - MAS FD rates: the series was discontinued in June 2021, and showing a five-year-old figure as current would mislead.
  - UOB unit trusts: no readable page states the fee.
  - uSMART, Saxo, FSMOne: pages are empty until JavaScript runs.
  - Kristal.AI: pivoted to accredited investors and has no public pricing.
  - Coinbase: Cloudflare challenge.
  - Upbit: JavaScript-only page with no API.
- **Provider/content choices:** MoneyOwl was excluded (wound down end-2023). DBS Digital Exchange was excluded (accredited investors only). Gemini's full MPI licence was confirmed via the MAS FID. The CGS-CIMB → CGS International and utrade → uobkh.com.sg rebrands are reflected.
- **ID drift between agents:** products.json used `p-etf`, `p-reit`, etc. rather than the planned `p-etfs`, `p-sreits`. Methods/brokers `relatedIds` were retargeted to the real IDs.

## 6. Site/UX decisions and edge cases
- **`file://` does not work.** Browsers block ES modules on file URLs. CLAUDE.md's original claim was removed. Every page now shows a "run `npm run serve`" notice on `file:`, and the refresh button hides unless `/api/health` answers.
- **Freshness pill** was changed from "adapters OK" (34/34) to coverage: "fees for X/Y", counted over every entry/provider that has `feeSpecs`. The panel lists unscraped sources with provider links.
  - *Why:* "34/34 live" implied coverage the site didn't have.
- **Freshness bands:** live ≤30 days, aging ≤90 days, stale >90 days, missing = no component.
- **Hub teasers:**
  - Products show the top yield among products that are low-risk *and* reasonably liquid. The CPF top-up was excluded because the money is locked until retirement.
  - Methods and brokers show the cheapest provider in one named cost group and scenario.
- **Hub heading** "Risk vs. return map" was renamed "Risk vs. access map", because the y-axis is liquidity, not return.
- **Mobile:** the hero diagram gets a minimum width of 640px and scrolls inside its own card below 720px rather than shrinking to illegibility. The page itself never scrolls horizontally. The calculator's input grid collapses to one column below 480px, and spectrum labels use a 4-tier stagger (found by the site agent).
- **Charts:** colours come from CSS variables and re-render on theme change. Every chart has a `<details>` table alternative, which also covers the palette's marginal colour-vision-deficiency (CVD) contrast.
- **Radar chart:** entries without `growthVsDividend` (methods/brokers) fall back to a neutral 2.5 on the growth/income axes.
- **localStorage** (theme, stepper checklist, disclaimer dismissal) is always wrapped in try/catch.
- **Disclaimer** "Educational only — not financial advice" appears on every page.

## 7. Links & verification
- **`npm run check-links`** (`scraper/check-links.js`) GETs every `steps[].link`, `officialLink` and `feeSpecs[].sourceUrl`.
- **Fixed dead links:**
  - paynow.sg (522) → ABS PayNow page.
  - mas.gov.sg/consumer-education (404) → moneysense.gov.sg.
  - Old IRAS employee share plan page (404) → IRAS "Gains from the exercise of stock options".
  - kristal.ai/pricing (404) → kristal.ai.
- **Accepted 403s:** Coinbase and Coinhako are Cloudflare bot blocks; the pages load fine in a real browser.
- **sgx.com pages** never rendered for the fetchers. `investors.sgx.com` / `rulebook.sgx.com` were used where possible.

## 8. Process notes
- **Session rate limit:** all four agents were cut off by a usage limit and resumed from their own transcripts via SendMessage, so no work was lost.
- **Screenshots in the browser pane timed out** when the window was in the background. Verification used page text, the DOM and console reads instead.
- **Temporary scripts:** `scratch_clean.mjs` and `_rank.mjs` were removed from the project root. Scratch work belongs in the session scratchpad.

## 9. Headless adapters (session 2)
- **`playwright-core` driving the already-installed system Edge** (`chromium.launch({ channel: 'msedge', headless: true })`, falling back to a hardcoded `executablePath` if the channel lookup fails), NOT the `playwright` package — no browser binary is downloaded. See `scraper/lib/browser.js` and the `format: 'browser'` adapter contract in CLAUDE.md.
  - *Why not `networkidle`:* several sites (Saxo, others) keep persistent connections open (chat widgets, analytics beacons) that never go idle, which made `page.goto` time out even after the fee content had long since rendered. `renderPage` uses `domcontentloaded` plus its own `waitFor` poll (selector / RegExp / `function(text)`) against the rendered text instead.
  - `renderPage` retries once on any failure (network jitter) but never to evade a detected bot challenge — `assertNoChallenge` re-checks on the retry too.
  - One Edge instance is shared for a whole scraper run, launched lazily by the first adapter that needs it, and always closed in a `finally` around the adapter loop in `index.js` so a run never hangs on exit.
- **Per-source outcome:**
  - **uSMART SG** — works. `format: 'browser'`, tables render but are entirely absent from the raw HTML. SG commission 0.02%/platform 0.03% (no minimum); US commission $0 + $0.88/order platform fee (≥USD 40 tier); the <USD 40 per-share tier is in `note`.
  - **Longbridge SG** — works, with care. Confirmed by hand in a real render: the Platform Fee card shows a placeholder **0%** immediately on mount, then flips to the real rate (0.03% for SG) a moment later once a second client-side data fetch resolves. The adapter's `waitFor` is a `function(text)` predicate that polls until the SG platform-fee percentage is non-zero, and `scrape()` throws if it's still exactly 0 — genuine $0 values elsewhere (the "Lifetime Free" commission) are untouched by this check since they're a different field. This is the reason `waitFor` supports a content predicate, not just a selector: a selector-based wait would have matched the placeholder instantly.
  - **Saxo Markets SG** — works. Classic (entry) tier used for SG (SGX) and US (NASDAQ): 0.08% with a per-market minimum (SGD 3 / USD 1).
  - **FSMOne** — works. One adapter (`fsmone.js`) fills all three targets (`b-fund-platform/fsmone-platform`, `m-fund-platform/fsmone`, `m-bank-rsp/fsmone-rsp`), same pattern as `syfe.js`. Sales charge is a genuine permanent 0%. The platform fee is published as a quarterly rate ("0% or 0.0875%/quarter" for most funds, non-Diamond-tier); the adapter annualises it ×4 into `aum_annual_pct` and keeps the Fixed Income Funds' lower rate and the CPF/Diamond 0% carve-outs in `note`. The RSP ETF buy-fee waiver (since 2021, "until further notice") is a second render (of `fsm.global/sg/regular-savings-plan`) via `renderPage` called from inside `scrape()`.
  - **Upbit SG** — works. SGD market maker/taker fee (both 0.25%, GST-inclusive) from the user guide page; `type` changed from `other` to `per_trade_pct`/`market: 'ALL'` to match the other crypto exchange adapters. The `waitFor` had to check for the actual `SGD…%…%` row text, not just "a percentage is present somewhere" — a looser check occasionally resolved before the fee table itself had rendered.
  - **Fixed deposits** — MAS's series is still discontinued (see §5), so `p-fixed-deposit` now gets three `yield_pct` components from `fixed-deposit-boards.js`: DBS, OCBC and UOB's own published 12-month *board* (non-promotional) rate, smallest deposit tier, all server-rendered plain HTML (`format: 'html'`, no browser needed). UOB's page conveniently separates a "Board Rates" table from the "Promotion" table above it. **DBS's page has a cheerio-parsing quirk**: the real HTML has proper `<td>` markup (confirmed by inspecting the raw response directly), but `cheerio.load()` desyncs partway through the document and `cleanText()`'s output ends up containing literal `<td class="...">` characters instead of stripped-down text — for reasons not fully diagnosed. Since `index.js` builds every adapter's `text` context the same way, the adapter matches that literal artifact directly (`/12 mths<\/td>\s*<td[^>]*>(\d+...)</`) rather than working around it, since that's what the real pipeline actually hands it.
  - ✅ **Fixed later in session 2** (see §10): card fee lines now show the range and best of all yields. *Original note:* `site/js/components.js` (`fees.find(f => f.type === 'yield_pct')`) and `site/js/index.js`'s hub-teaser logic both pick only the *first* `yield_pct` component on an entry. Every other `yield_pct` user (SSB, T-bill, SGS, CPF) has exactly one component per entry; `p-fixed-deposit` is the first entry with three (DBS/OCBC/UOB), so today only one bank's rate is actually visible in the UI even though all three are correctly scraped and stored in `data/sgdata.json`. This needs a small site-side change (e.g. show all matching `yield_pct` components, or pick the highest) — flagged as a follow-up, not addressed here since it's outside `scraper/`.
  - **SGX securities clearing fee** — still skipped. The rulebook URL the baseline previously pointed to (`rulebook.sgx.com/rulebook/18122-clearing-fees`) is confirmed to be the *options* clearing fee (Chapter 18, Options Trading; 0.05% capped at $200), not securities — the baseline `sourceUrl` was corrected to `https://www.sgx.com/securities/trading-services/fees` (the real securities/equities fees page, found via site navigation) even though no adapter reads it yet. That page's React app fails to load its own content — `console` shows `Error fetching CMS data: TypeError: Cannot read properties of null (reading 'data')` — reproduced identically in the Browser pane *and* in a real `chromium.launch({ channel: 'msedge' })` render, on every `sgx.com`/`www.sgx.com` route tried (`/securities/clearing-information`, `/stock-exchange/clearing-information`, `/securities/trading-services/fees`). This isn't a visible CAPTCHA/"Just a moment" banner, but it has the same practical effect (no content ever renders for an automated browser) and per the hard limits on evasion, it was not worked around (no stealth, no fingerprint spoofing). Matches the prior session's finding that sgx.com never renders for fetchers.
  - **Coinbase** — skipped per the explicit hard limit (known Cloudflare bot challenge; not attempted).
  - **Kristal.AI** — skipped per the explicit hard limit (no public pricing, per prior session).
- **Coordinated edit, not a second session:** the "other process" was the main (Opus) session working in parallel by design (it messaged this agent to add the types). Mid-session, `tiger-brokers-sg.js`, `interactive-brokers-sg.js` and `site/js/cost.js` were modified to add two new `FeeType`s, `per_share` and `per_trade_max_pct` (Tiger's/IBKR's per-share US pricing, previously approximated with `per_trade_min` per §5, is now modelled properly). This session's `scraper/index.js` `FEE_TYPES` set and CLAUDE.md's `FeeType` list were updated to include both — confirmed necessary (not just claimed) once a dry run showed `tiger-brokers-sg`/`interactive-brokers-sg` failing with `unknown type "per_share"` against the old set. `cost.js`, `tiger-brokers-sg.js`, `interactive-brokers-sg.js` and `phillip-sbp.js` were left untouched, per that session's own edits.

## 10. Cost-model extensions, UI and fixes (session 2, main session)
- **`per_share` and `per_trade_max_pct` fee types.** Per group, the cost is min(max(pct·size + flat + per_share·shares, min), max_pct·size).
  - Shares per trade come from a new calculator input, "Typical share price" (default `DEFAULT_SHARE_PRICE` = 50, in the market's own currency).
  - That default is a user assumption, not a fee, so the fee rule doesn't apply to it.
  - Tiger US (commission + platform, each with its own cap) and IBKR US (Fixed plan) now emit per-share, minimum and cap components. IBKR's cap is read from the "Maximum per order" row; a hand-typed "1%" was removed from its note.
  - On typical S$500 orders the per-order minimum still binds, so rankings only move for large orders or low share prices.
- **`aum_annual_pct` now supports `minMonthly` and `monthlyCaps: [{upTo, cap}]`.** Phillip SBP has a S$1 floor and two caps by portfolio size, all scraped.
  - The cap is chosen by the balance *each month*, so a growing portfolio moves into the lower cap once it crosses the threshold.
- **Products link to a calculator group.** `PRODUCT_COST_LINKS` (cost.js) maps each product to the calculator group and market that determine its cost; for example US stocks → stock brokers on the US market, and SSB/T-bills/SGS → bond applications.
  - Cards show "Compare what it costs to buy →", and `compare.html?group=…&market=…` opens the calculator pre-set.
  - *Why:* a product's cost is mostly set by where you buy it, so the products page points into the like-for-like calculator rather than duplicating it.
- **Multiple yields per entry.** Card fee lines show the range and name the best (e.g. FD board rates for 3 banks, CPF per account, SSB year-1 vs 10-year average). This fixes the §9 gap.
- **Glossary fee-rule fix.** The CPF OA entry had a hand-typed interest rate; it now points to the scraped CPF card.
- **Deleted adapters no longer linger.** `merge()` takes the set of existing adapter ids; carried-over components and report rows for adapters whose file is gone are dropped.
  - The agent's "39 adapters" was a miscount: there are 40 files and 40 report rows, all OK.
- **Saxo flakiness (fixed).**
  - Its `waitFor` checked for a literal "0.08%", which is both a hand-typed figure and brittle. It also only waited for the SGX row, while the Asia/Pacific table hydrates up to ~3 s after the America one.
  - `innerText` is tab/newline-separated, so the first regex fix never matched.
  - The final predicate normalises whitespace and requires both rows by *shape*: 3/3 runs OK.
  - **Rule:** a `waitFor` must never contain a fee value.
- **Refresh button verified end to end.** A click in the freshness panel → `POST /api/refresh` → full 40-adapter run with headless Edge → `sgdata.json` rewritten → page reload. That run surfaced the Saxo flake, whose previous values were correctly carried over as `lastRunOk: false`.
- **`npm test`** (`test/cost.test.mjs`): 9 synthetic checks covering per-share, cap, minimum, summed groups, AUM min, AUM caps above/below threshold, missing FX → incomplete, and one trade for a lump sum. The numbers are test inputs outside `data/` and `site/`.
- **Git is not installed** on this machine (`git` not on PATH), so version control is still pending the user's install.

## 11. Session loop (23 Sep 2026)
- **Adopted the supercharge session loop** (user). Components: scraper, server, cost-model, site (Claude, from code seams). OpenSpec specs hold the external surface only (Claude). Graph is built `--code-only` because there's no LLM key (Claude). See `docs/sessions/2026-09-23-supercharge-bootstrap.md`.
- **Edge case:** the drift check needs a git repo, so a manual check was used instead (39 rows, 0 dead) until the user runs `git init`.

## 12. Follow-ups closed (24 Sep 2026, OpenSpec change `close-open-followups`)
- **Per-figure `source`** (Claude, from the session-2 known quirk). An adapter may set an https `source` on any component, and `merge.js:sourceOf` keeps it; anything else falls back to `adapter.url` rather than failing the adapter. Carried-over components keep their original source. FD (per bank), FSMOne RSP, moomoo US, SGX fees, and the Saxo/IBKR FX pages use it.
  - **Site:** every freshness badge now links to its figure's source page. Before this, `source` was stored but never shown.
- **HKD FX** (Claude; a gap found during scoping). The Hong Kong market was selectable, but every HK broker was "incomplete" because only USD was scraped. `mas-fx` now runs one postback per currency, finds each checkbox by label, and takes the unit from the list name (HKD is quoted per 100, so it is divided by 100). `cost.js:toSGD` is generic over `fx[<CUR>SGD]`. HK ranks 4 brokers now (0 before).
  - *Edge case:* the other 13 brokers have **no HK fee scraped at all**. That's a coverage gap, not an FX one, and is an open follow-up.
- **Share-price tiers** (Claude). There is a new optional `sharePrice: {from?, below?}` on per-trade components; `computeCost` filters by it before `pick`. A price exactly at `from` falls in the upper tier. Unconditioned components apply at every price. Tests cover below, at and above the threshold.
  - **uSMART US:** both tiers, with the threshold parsed from four places on the page; the adapter throws if they disagree. With the default typical price, uSMART is unchanged. At US$10 it costs slightly more than before (the lower-tier minimum binds).
  - **Longbridge US:** now `per_share` + `per_trade_min`, no longer a minimum-only stand-in.
  - **Longbridge `waitFor` fixed.** It searched for the literal minimum-fee string, which broke the §10 rule; it now matches by shape.
- **SGX clearing & trading fees** (Claude; advisor: cross-check). The official route is dead: sgx.com doesn't render (§9), and CDP Clearing Rule 13.2 only refers to "CDP's fee schedules", with no rate.
  - The new `sgx-clearing-fee` adapter reads moomoo SG's fee schedule and requires Maybank Securities' to agree, or it throws. Both figures take moomoo's page as their source, and the note names the cross-check. Scratchpad checks covered the disagreement and missing-section paths.
  - They are display-only on `p-sgx-stocks` / `p-corp-bond` (group `exchange`, labelled, not "From …") and never added to broker totals, because the fee is identical at every broker.
  - Caps are **not** stored, since sources differ on them.
  - The baseline `sourceUrl`s moved off sgx.com.
- **FX conversion fees are display-only** (the **user** chose this over "summed all-or-none" or "defer"). *Why:* only a few brokers publish one, so summing would punish the transparent ones (it breaks like-for-like ranking). `computeCost` returns them in `info`, and the calculator shows "Currency conversion … not in the totals".
  - **Stored:** Saxo (help-centre conversion fee %) and IBKR (auto-conversion markup %).
  - **Not stored:**
    - IBKR manual FX: basis points with a per-conversion minimum, which one percentage can't express.
    - Tiger and moomoo: the margin is built into the rate, with no published %.
    - Syfe: the help centre returns a 403 bot block, not attempted.
    - The rest: no FX row on their fee pages.
- **Fund expense ratios won't be modelled** (Claude; advisor agreed). The same fund has the same ratio on every platform, so it can't change a like-for-like ranking. The group caveats already say so. A defaulted user input was rejected, because it would look like a fee figure.
- **Re-confirmed skips:** UOB unit trusts (the unit-trust page's only % is a max subscription fee in one fund's performance footnote, not UOB's sales charge), Kristal.AI, Coinbase.
- **Process:**
  - Probe/peek scripts lived in the session scratchpad (§8), not the repo.
  - `Set-Content -Encoding` failed in this PowerShell, so `[IO.File]::WriteAllText` was used instead.
- **Result:** 41/41 adapters OK, `npm test` passes (9 → 17 checks), `check-links` 114/117 (the same 3 accepted 403s), pill "fees for 53/56" (was 51/56). Default presets unchanged: S$500/mo → uSMART S$30 / Endowus S$1,815.
- **Edge case found at review (fixed):** `data.js:bestFeeComponent` returned the first live component. IBKR/Saxo emit their FX markup first, so the International brokers card read "From <FX markup>%" and their table badges linked to the FX pages. It now prefers cost-bearing components (excluding `fx_spread_pct` and `other`, falling back only if nothing else is left). Browser re-check: the card shows the commission %, and the badges link to the commissions pages. `freshnessBadge` is now an `<a>`: none of its call sites is inside another link (`a a` count 0 on brokers/compare).
- **Edge case found during the archive spec sync (fixed):** `computeCost` checked the "No <market> trading fee found" reason against the share-price-*filtered* list. A broker whose only tiers exclude the typical price, but which also had e.g. a custody fee, would have ranked on the custody fee alone. The check now uses the unfiltered list, with a new test "no applicable tier -> incomplete" (18 checks). No current provider hits it; default rankings are unchanged.
  - The main spec `cost-comparison` gained two failure scenarios at sync, to meet the "happy + failure scenario" rule: "No tier covers the price" and "Exchange fees not yet scraped". Both describe implemented behaviour.
- **Display name is "SGInvest Visualiser"** (user decision, 24 Sep 2026) — replaces "SG Invest Map" in page titles, the header brand and README, and "SG Invest Visualiser" in docs. Internal ids (package name `sg-invest-visualiser`, skill names, localStorage keys) are unchanged so saved theme/checklist state isn't reset.

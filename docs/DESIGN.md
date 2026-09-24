# Design spec — SGInvest Visualiser

Audience: Singapore residents who have never invested. Tone: friendly, calm, confident, zero jargon.
The site should feel like a well-designed field guide / map, not a trading terminal.

## Visual language
- **Three "worlds", each with a hue** used consistently for chips, card top-borders, chart series and page accents:
  - Products — "What to buy" — teal `--world-products`
  - Methods — "How to invest" — amber `--world-methods`
  - Brokers — "Who executes it" — violet `--world-brokers`
- **Cheapest** gets a crown badge + `--good` green. Stale/missing data gets `--warn` amber / `--muted` grey. Singapore red `--sg-red` only for the logo mark and the disclaimer icon.
- Fonts (Google Fonts): headings **Bricolage Grotesque** (600/700), body **Inter** (400/500/600), numbers `font-variant-numeric: tabular-nums`.
- Generous whitespace, 16px radius cards, soft shadows, big rounded icons (inline SVG, 1.75px stroke, `currentColor`).
- All colours are tokens in `site/css/tokens.css`; light + dark mode (prefers-color-scheme, overridable with `data-theme` on `<html>` via a toggle).
- Mobile-first: 16px gutters, single column < 720px, no horizontal page scroll. Charts get `aspect-ratio` containers.
- Motion: subtle (150–250ms), respect `prefers-reduced-motion`.

## Global chrome (every page)
- Sticky top bar: logo mark (red dot + "SGInvest Visualiser"), nav tabs Products · Methods · Brokers · Compare, theme toggle, data-freshness pill ("Data as of 22 Sep 2026 · 18/24 live") that opens a freshness panel listing each adapter's status. "Refresh data" button inside that panel, shown only when `location.protocol` is http(s) and `GET /api/health` answers.
- Disclaimer strip under the bar: "Educational only — not financial advice. Fees change; always confirm on the provider's site." (dismissible per session, try/catch storage).
- Footer: sources list link, generatedAt, glossary link.

## index.html — the hub
1. Hero: headline "Your map to investing in Singapore", sub-line, an illustrated **3-layer diagram** (inline SVG): *You → Method (channel) → Broker/platform → Product*, each layer clickable to its page. This teaches the mental model in one picture.
2. **"Which path suits me?" quiz** — 5 questions (goal: grow vs income vs safety; horizon; monthly amount; hands-on vs hands-off; use CPF/SRS?). Result card suggests 1 product mix + 1 method + 1 broker type with links, and preloads the matching fee scenario for the Compare page (query string).
3. **Risk vs return map**: Chart.js bubble chart of all products (x = riskLevel, y = liquidity, bubble r = complexity, colour = growthVsDividend on a diverging teal↔amber scale). Click bubble → product modal. Legend explains axes in words.
4. Three big world cards with counts and "cheapest right now" teaser (from computeCost with default scenario).

## products.html
- Filter chips by category + toggle "Beginner-friendly only" (complexity ≤ 2).
- **Growth ↔ Income spectrum**: horizontal track with every product plotted by growthVsDividend (labels stagger to avoid overlap); hovering highlights its card.
- Card grid: icon, name, summary, analogy, 3 mini meters (Risk / Liquidity / Complexity as 5-dot rows), growth↔dividend bar, return-driver chips, fee status line (e.g. "Yield 3.1% · live" or "Fees via your broker →"), buttons "Pros & cons" (flip card) and "How to start" (stepper modal).
- Stacked bar chart "Where the return comes from" (share capital growth vs income per product).

## methods.html
- Intro diagram: flow showing money path for each method (cash / CPF OA / SRS → method → product).
- Card per method: same card system as products, plus providers table (name, headline fee, freshness badge, crown on cheapest for current scenario).
- **Fee-drag calculator** (shared component, also on brokers & compare): inputs lump sum, monthly amount, years, trades/month, market SG/US; preset buttons "S$500/mo RSP", "S$50k lump sum", "10 US trades/mo". Output: horizontal bar chart of total fees in S$ over the period, sorted cheapest first, crown on #1, "incomplete data" providers listed below the chart greyed with reason. Shows the scenario sentence above the chart: "Ranking for: S$500/month for 10 years, 1 trade/month, SG market".

## brokers.html
- Explainer graphic: **CDP-linked vs custodian** (two-lane SVG: shares in your name at CDP vs held by broker in trust) — the single most important broker concept for SG laymen.
- Broker-type cards (pros/cons, steps) with provider sub-tables.
- Same fee-drag calculator scoped to brokers; leaderboard labelled with scenario.

## compare.html
- Pick up to 3 items (any dataset) from searchable chips → radar chart (Risk, Liquidity, Complexity, Income focus, Growth focus) + side-by-side table (pros, cons, fees, min amount, best for).
- Full calculator across all providers.
- Reads query params (`?ids=…&scenario=…`) so the quiz can deep-link.

## Shared components (`site/js/components.js`)
- `entryCard(entry, world)`, `meterDots(n)`, `gdBar(growthVsDividend)`, `freshnessBadge(component)`, `feeLine(entry)`,
  `prosConsFlip(entry)`, `stepperModal(entry|provider)` (numbered progress bar, back/next, tick-off checklist saved to localStorage key `steps:<id>`, final step shows official link as primary button), `glossaryTooltips(root)`, `crown()`.
- Modal: focus-trapped, Esc to close, `role="dialog"`.

## Accessibility
- WCAG AA contrast in both themes; charts have a text/table alternative (`<details>` "Show as table").
- All interactive elements keyboard reachable; visible focus ring `--focus`.

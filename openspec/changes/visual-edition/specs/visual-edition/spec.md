## ADDED Requirements

### Requirement: Same content as the stable site
Each visual-edition page SHALL show the same entries, providers, pros and cons, sign-up steps, glossary terms, quiz questions and quiz result as its stable counterpart, from the same dataset.

#### Scenario: Entry parity
- **WHEN** a reader opens `/visual/products.html` and `/products.html` on the same dataset
- **THEN** both list the same products with the same pros, cons and steps

#### Scenario: Empty dataset
- **WHEN** no data has been generated yet
- **THEN** the visual page shows the same "no data yet" guidance as the stable page instead of an empty animation

### Requirement: Fee figures and rankings follow the stable rules
The visual edition SHALL show only scraped figures. It SHALL apply the same fee-line, freshness-badge and cost rules as the stable site: each badge links to its figure's source, and "Cheapest" names its scenario and cost group. Currency-conversion, "other" and exchange fees SHALL be shown but never added to totals.

#### Scenario: Fee race
- **WHEN** a reader runs the brokers "Fee Race" for a scenario
- **THEN** the ranking and totals equal the stable calculator's for the same scenario, and the winner's label names that scenario

#### Scenario: Missing or incomplete fee data
- **WHEN** a provider has no scraped fee, or needs a missing FX rate
- **THEN** it shows "Not available — check provider ↗" linking to the provider's page (or its incomplete reason), and is never shown as a winner or cheapest

### Requirement: Motion is optional
The visual edition SHALL present complete, readable content when the reader prefers reduced motion, turns on Calm mode, or the browser cannot run WebGL or load the animation libraries.

#### Scenario: Reduced motion
- **WHEN** the reader's system prefers reduced motion
- **THEN** no WebGL canvas runs, nothing auto-animates or hijacks scrolling, and all content is visible

#### Scenario: No WebGL or library load failure
- **WHEN** WebGL is unavailable or a CDN script fails to load
- **THEN** the page shows a static background and all content remains usable

### Requirement: Disclaimer on every page
Every visual-edition page SHALL show the "Educational only — not financial advice" disclaimer.

#### Scenario: Any visual page
- **WHEN** a reader opens any of the five visual pages
- **THEN** the disclaimer is present

#### Scenario: Dismissed
- **WHEN** the reader dismisses the disclaimer
- **THEN** it stays dismissed for the session, as it does on the stable site, and the footer still states "Not financial advice"

### Requirement: Edition switch
Every page of both editions SHALL show a pinned round button at the top right that links to the matching page in the other edition, keeping the page's query string. The button SHALL never cover the header controls or cause horizontal scrolling.

#### Scenario: Stable to visual
- **WHEN** a reader on `/compare.html?group=robo` activates the switch
- **THEN** they arrive at `/visual/compare.html?group=robo`

#### Scenario: Visual back to stable
- **WHEN** a reader on any visual page activates the "Back to the normal site" switch
- **THEN** they arrive at the matching stable page

#### Scenario: Small screen
- **WHEN** the viewport is 375px wide
- **THEN** the switch sits inside the page gutter below the header and the page does not scroll horizontally

### Requirement: Analytics only on Vercel
Vercel Web Analytics and Speed Insights SHALL load only when the site is served from a `*.vercel.app` host.

#### Scenario: Vercel preview
- **WHEN** a page is served from a `*.vercel.app` host
- **THEN** the Vercel analytics scripts load

#### Scenario: GitHub Pages or local
- **WHEN** a page is served from GitHub Pages or localhost
- **THEN** no request to `/_vercel/` is made

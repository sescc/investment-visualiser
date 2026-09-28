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
The visual edition SHALL present complete, readable content when the reader prefers reduced motion, turns on Calm mode, or the browser cannot load the animation library.

#### Scenario: Reduced motion
- **WHEN** the reader's system prefers reduced motion, or Calm mode is on
- **THEN** nothing auto-animates, no section pins or scrubs with scrolling, and all content is visible

#### Scenario: Animation library fails
- **WHEN** the animation library fails to load
- **THEN** the page shows a static background and the plain layout, and all content remains usable

### Requirement: Scroll animations never hide or distort content
Scroll-driven scenes SHALL keep every piece of text and data readable at every scroll position, and SHALL never show a fee amount that is not the real computed figure. Keyboard and assistive-technology users SHALL be able to reach every control without scrolling through a scene.

#### Scenario: Scrolling through a pinned scene
- **WHEN** a reader scrolls slowly through a pinned scene, such as the Fee Race
- **THEN** the ranking, names, winner label and totals are readable at every point, and only decorative parts animate in

#### Scenario: Keyboard focus lands inside an unfinished scene
- **WHEN** a keyboard user tabs to a control inside a scene that has not finished playing
- **THEN** the scene jumps to its finished state and the focused control is visible

#### Scenario: Inputs change after the scene has played
- **WHEN** the reader changes a calculator input and then scrolls back through the Fee Race or the fee jar
- **THEN** the scene shows the new result, never the previous ranking or totals

### Requirement: Motion stays light
The visual edition SHALL scroll smoothly on an ordinary laptop and SHALL do no animation work while the reader is idle.

#### Scenario: Scrolling a full page
- **WHEN** a page is scrolled from top to bottom over about eight seconds in a desktop browser
- **THEN** 95% of frames take 20 ms or less, and no more than 5% take over 33 ms

#### Scenario: Idle page
- **WHEN** the reader stops scrolling and does nothing for three seconds
- **THEN** the page produces no long animation frames and leaves the browser's idle time essentially free

#### Scenario: Tab in the background
- **WHEN** the visual page's tab is hidden
- **THEN** no animation keeps running until the tab is shown again

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

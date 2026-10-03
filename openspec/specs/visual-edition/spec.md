# visual-edition Specification

## Purpose
Defines what a reader of the animated visual edition (`/visual/`) can rely on: the same content and fee figures as the stable site, motion that never hides content and can always be turned off, light performance, the disclaimer, the edition switch, and analytics only on Vercel.

## Requirements

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

### Requirement: Continuous journey between pages
Each visual page except the last stop SHALL end with a runway after its footer. Scrolling down through the runway SHALL carry the reader to the next page in the order Hub, Products, Methods, Brokers, Compare. The runway SHALL always show a visible "Next: <page>" link.

#### Scenario: Scrolling past the end of the hub
- **WHEN** a reader with motion allowed scrolls down past the hub's footer and through the runway
- **THEN** the browser moves to the visual Products page with a transition, and the reader starts at the top of Products

#### Scenario: Compare is the end
- **WHEN** a reader reaches the end of the Compare page
- **THEN** there is no runway and no automatic navigation, and a "journey complete" finale offers links back to the start and to the normal site

#### Scenario: Returning with Back
- **WHEN** a reader presses Back from Products and lands at the bottom of the hub
- **THEN** the hub does not move forward again on its own until the reader scrolls up and back down into the runway

#### Scenario: Motion turned off
- **WHEN** Calm mode or reduced motion is on, or the animation library fails to load
- **THEN** the runway shows only the "Next: <page>" link and the page never navigates by itself

#### Scenario: Keyboard reader
- **WHEN** a keyboard user tabs past the footer
- **THEN** they reach the "Next: <page>" link and can activate it

### Requirement: Headings wrap only between words
Animated headings SHALL break lines only where the same unanimated heading would.

#### Scenario: Narrow screen
- **WHEN** "Growth ↔ income spectrum" or "Which path suits me?" is shown at 375px
- **THEN** no word is split across lines, and punctuation stays with its word

#### Scenario: Wide screen
- **WHEN** the same headings are shown at 1280px
- **THEN** they occupy the same number of lines as their plain text

### Requirement: Pinned scenes stay in their own section
A pinned scene SHALL pin only while its own section is in view, and SHALL never cover another section's text, regardless of the order in which scenes are set up.

#### Scenario: Products return sources
- **WHEN** a reader scrolls through the Products card deck ("Bonds & cash" and the other categories)
- **THEN** the return-source columns are not visible over it, and pin only once their own section reaches the top

#### Scenario: Content taller than the screen
- **WHEN** a scene's content is taller than the viewport
- **THEN** it scrolls normally instead of pinning, so none of it is cut off

### Requirement: Spectacle stays light
New journey and page effects SHALL keep within the visual edition's frame budget.

#### Scenario: Scrolling a page with the new effects
- **WHEN** any visual page, runway included, is scrolled top to bottom in a desktop browser
- **THEN** 95% of frames take 20 ms or less and no more than 5% take over 33 ms

#### Scenario: Idle after scrolling
- **WHEN** the reader stops scrolling for three seconds
- **THEN** velocity-driven effects settle and the page produces no long animation frames

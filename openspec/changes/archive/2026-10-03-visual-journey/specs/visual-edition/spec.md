## ADDED Requirements

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

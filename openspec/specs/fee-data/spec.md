# fee-data Specification

## Purpose

Defines the published fee dataset (`data/sgdata.json` / `sgdata.js`) that the site and any other consumer read: where each figure came from, which exchange rates exist, and which figures apply only under stated conditions.

## Requirements

### Requirement: Every figure names the page it was read from
Every fee component and FX rate in the dataset SHALL carry a `source` that is an `https:` URL of the page the value was actually read from. Where one source reads several pages, each figure SHALL name its own page. A figure carried over from an earlier run SHALL keep its original `source`.

#### Scenario: Multi-page source
- **WHEN** the fixed-deposit source reads DBS, OCBC and UOB pages in one run
- **THEN** each bank's rate carries that bank's page as its `source`, not a shared URL

#### Scenario: Invalid per-figure source ignored
- **WHEN** a source supplies a per-figure source that is not an `https:` URL
- **THEN** the figure's `source` falls back to the source's main page and the run does not fail

#### Scenario: Failed source keeps provenance
- **WHEN** a source fails on a later run
- **THEN** its previous figures are kept with `lastRunOk: false` and their original per-figure `source`

### Requirement: Exchange rates for every quoted foreign currency
The dataset's `fx` object SHALL contain `USDSGD` and `HKDSGD`, each as SGD per **one** unit of the foreign currency, with `asOf` and `source`.

#### Scenario: HKD rate published per unit
- **WHEN** the official source quotes HKD per 100 units
- **THEN** `fx.HKDSGD.value` is that quote divided by 100

#### Scenario: HKD rate unavailable
- **WHEN** the official source cannot be read or has no HKD column
- **THEN** the source fails without writing a guessed rate, and the previous `HKDSGD` is kept with `lastRunOk: false` (or it stays absent if there never was one)

### Requirement: Share-price conditions on per-trade figures
A per-trade or per-share figure MAY carry `sharePrice: { from?, below? }` in the figure's currency, meaning it applies only when the typical share price is at or above `from` and below `below`. A figure without `sharePrice` applies at every share price. The threshold SHALL come from the provider's page, never be hand-typed.

#### Scenario: Two published tiers
- **WHEN** a broker publishes different US platform fees above and below a share-price threshold
- **THEN** the dataset holds both tiers, one with `sharePrice.from` and one with `sharePrice.below` set to the same scraped threshold

#### Scenario: Threshold missing on page
- **WHEN** the page no longer states the threshold
- **THEN** that source fails rather than emitting tiers with an assumed threshold

### Requirement: SGX exchange fees on Singapore securities products
The SGX-listed stock and bond products SHALL carry the SGX clearing fee and SGX trading fee as labelled percentages of trade value. They SHALL be read from at least two independent published broker pages that agree, and each figure SHALL name the page it came from.

#### Scenario: Pages agree
- **WHEN** two broker pages state the same clearing and trading fee percentages
- **THEN** both products carry a "SGX clearing fee" and a "SGX trading fee" figure

#### Scenario: Pages disagree or are missing
- **WHEN** the broker pages state different percentages, or fewer than two can be read
- **THEN** the source fails and no new SGX fee figure is written

### Requirement: FX conversion fees are informational
Published currency-conversion fees (`fx_spread_pct`) SHALL be stored only when a provider publishes a plain percentage, and they are informational: consumers MUST NOT add them to cost totals.

#### Scenario: Provider publishes a percentage
- **WHEN** a broker page states a currency-conversion fee as a percentage
- **THEN** the dataset holds an `fx_spread_pct` figure for that broker

#### Scenario: Provider publishes a minimum-based schedule
- **WHEN** a broker's conversion fee is basis points with a per-conversion minimum
- **THEN** no `fx_spread_pct` figure is written for it (the page stays linked from the provider)

# Spec Delta

## Purpose

Defines what the site's cost calculator, provider tables and fee badges show to a reader comparing providers, so that estimates stay like-for-like and every figure can be traced to its source.

## ADDED Requirements

### Requirement: Foreign-currency fees convert with the scraped rate
The calculator SHALL convert a fee in any foreign currency to SGD using the dataset's rate for that currency. A provider whose fee needs a missing rate SHALL be listed as incomplete with the reason, never ranked.

#### Scenario: Hong Kong market
- **WHEN** the reader selects the Hong Kong market and HKD minimum commissions exist with `fx.HKDSGD` present
- **THEN** those brokers are ranked with their HKD minimums converted to SGD

#### Scenario: Missing rate
- **WHEN** a needed rate is absent from the dataset
- **THEN** that provider appears under "Incomplete data" with a "no FX rate" reason

### Requirement: Share-price tiers follow the typical share price
The calculator SHALL apply only the per-trade figures whose share-price condition includes the reader's "Typical share price". A price exactly at a tier's `from` threshold falls in that (upper) tier.

#### Scenario: Below threshold
- **WHEN** the typical share price is below a broker's published threshold
- **THEN** the lower-price tier's per-share rate, minimum and cap are used and the upper tier's fixed fee is not

#### Scenario: At or above threshold
- **WHEN** the typical share price equals or exceeds the threshold
- **THEN** the upper tier's fee is used and the lower tier's is not

### Requirement: FX conversion fees shown, never totalled
Currency-conversion fees SHALL be shown next to a provider's estimate as "not in total" and SHALL NOT change any total or ranking.

#### Scenario: Broker with a published FX fee
- **WHEN** a US-market comparison includes a broker with a published conversion fee
- **THEN** its estimate is unchanged, and the fee appears beside it marked "not in total"

#### Scenario: Broker without one
- **WHEN** a broker publishes no conversion fee
- **THEN** nothing is shown for it and it is not marked incomplete

### Requirement: Figures link to their source
Each fee figure's freshness badge SHALL link to the page that figure was read from.

#### Scenario: Badge link
- **WHEN** a reader clicks a figure's freshness badge
- **THEN** the figure's source page opens in a new tab

#### Scenario: No source
- **WHEN** a figure has no `source`
- **THEN** the badge renders as plain text without a link

### Requirement: Exchange fees on product cards are labelled, not "from"
A product card whose fees are labelled exchange fees SHALL list them by label (e.g. "SGX clearing fee <scraped>%") and SHALL NOT present them as the cheapest price for the product.

#### Scenario: SGX stocks card
- **WHEN** the SGX stocks product has clearing and trading fee figures
- **THEN** its card shows both by label with their freshness, plus the existing link to compare broker costs

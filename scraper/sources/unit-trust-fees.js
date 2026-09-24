// MoneySense's Unit Trusts Guide states the typical initial sales charge as a
// range ("Ranges from 1.5% - 5% of your investment"), not a single figure.
// Per the adapter brief this is emitted as an 'other' component (upper bound
// of the range only, with a label spelling out the full range) rather than
// sales_charge_pct, since a single number would misrepresent a range.
const PAGE_URL = 'https://www.moneysense.gov.sg/unit-trusts-guide/';

export default {
  id: 'unit-trust-fees',
  url: PAGE_URL,
  format: 'html',
  targets: ['p-unit-trust'],
  async scrape({ text, extract }) {
    const m = /Subscription fee or initial sales charge[\s\S]{0,250}?Ranges from\s*(\d+(?:\.\d+)?)\s*%\s*[-–]\s*(\d+(?:\.\d+)?)\s*%/i.exec(
      text
    );
    extract.mustFind(m, 'unit trust initial sales charge range on MoneySense unit trusts guide');
    const lower = m[1];
    const upper = Number(m[2]);

    return [
      {
        target: 'p-unit-trust',
        type: 'other',
        market: 'SG',
        value: upper,
        currency: 'PCT',
        label: `Typical initial sales charge (subscription fee): ${lower}%–${upper}% of investment (upper bound shown)`,
      },
    ];
  },
};

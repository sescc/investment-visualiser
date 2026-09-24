// Independent Reserve SG fees page — trading fee volume-discount table.
// The standard retail rate is the entry (0 volume) tier.
export default {
  id: 'independent-reserve-sg',
  url: 'https://www.independentreserve.com/fees',
  format: 'html',
  targets: ['b-crypto-exchange/independent-reserve-sg'],
  async scrape({ text, extract }) {
    const start = text.indexOf('Trade volume discounts');
    extract.mustFind(start >= 0 ? true : null, 'Independent Reserve trade volume discount section');
    const end = text.indexOf('Withdrawal fees from');
    extract.mustFind(end > start ? true : null, 'Independent Reserve trade volume discount section end');
    const slice = text.slice(start, end);

    // First row of the tier table is the entry tier: "AUD volumeFees 0 0.50% 50,000 0.48% ..."
    const entryMatch = slice.match(/AUD volumeFees\s*0\s*(\d+\.\d+)%/);
    extract.mustFind(entryMatch, 'Independent Reserve entry-tier (0 volume) trading fee');
    const entryPct = Number(entryMatch[1]);

    return [
      {
        target: 'b-crypto-exchange/independent-reserve-sg', type: 'per_trade_pct', market: 'ALL',
        value: entryPct, currency: 'PCT',
        label: 'Trading fee (entry tier, 0 x 30-day volume)',
        note: 'Entry tier; discounted on a sliding scale at higher 30-day trading volume (see page).',
      },
    ];
  },
};

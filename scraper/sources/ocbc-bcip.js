// OCBC Blue Chip Investment Plan (BCIP) — dedicated product page. Uses the
// standard "Fees and charges (per transaction)" rate for all customers
// (0.3% or S$5/counter, whichever higher), not the preferential under-30 /
// promo rate (0.88% flat, capped at S$500/counter/month) shown further up.
export default {
  id: 'ocbc-bcip',
  url: 'https://www.ocbc.com/personal-banking/investments/blue-chip-investment-plan',
  format: 'html',
  targets: ['m-bank-rsp/ocbc-bcip'],
  async scrape({ text, extract }) {
    // "Fees and charges (per transaction) 0.3% of the total investment amount
    // or S$5 per counter, whichever is higher."
    const match = extract.mustFind(
      /Fees and charges \(per transaction\)\s*([\d.]+)%\s*of the total investment amount or S\$(\d+(?:\.\d+)?)\s*per counter, whichever is higher/.exec(text),
      'OCBC BCIP standard buy transaction fee (% of investment amount or S$ per counter)'
    );
    // Each monthly purchase is a transaction, so model as per-trade % with a per-trade minimum.
    const note = 'Per monthly purchase, per counter — standard rate; a preferential under-30 rate also exists (see page).';
    return [
      { target: 'm-bank-rsp/ocbc-bcip', type: 'per_trade_pct', market: 'SG', value: Number(match[1]), currency: 'PCT', label: 'Transaction fee', note },
      { target: 'm-bank-rsp/ocbc-bcip', type: 'per_trade_min', market: 'SG', value: Number(match[2]), currency: 'SGD', label: 'Minimum per counter' },
    ];
  },
};

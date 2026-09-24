// Gemini ActiveTrader fee schedule — spot Maker/Taker fee tiers by 30-day
// volume/balance. The standard retail rate is the lowest (>= $0) tier.
export default {
  id: 'gemini-sg',
  url: 'https://www.gemini.com/fees/activetrader-fee-schedule',
  format: 'html',
  targets: ['b-crypto-exchange/gemini-sg'],
  async scrape({ text, extract }) {
    const start = text.indexOf('Fee TiersSpot');
    extract.mustFind(start >= 0 ? true : null, 'Gemini Spot fee tiers table');
    const end = text.indexOf('Stablecoins', start);
    extract.mustFind(end > start ? true : null, 'Gemini Spot fee tiers table end');
    const slice = text.slice(start, end);

    // Rows read "maker% taker% volume balance"; the lowest (last) row is "0.600%1.200%≥ $0≥ $0".
    const lastRowMatch = slice.match(/(\d+\.\d+)%(\d+\.\d+)%≥\s*\$0≥\s*\$0/);
    extract.mustFind(lastRowMatch, 'Gemini lowest-tier (>= $0) maker/taker row');
    const takerPct = Number(lastRowMatch[2]);
    const makerPct = Number(lastRowMatch[1]);

    return [
      {
        target: 'b-crypto-exchange/gemini-sg', type: 'per_trade_pct', market: 'ALL',
        value: takerPct, currency: 'PCT',
        label: 'Trading fee (taker, lowest 30-day volume tier)',
        note: `ActiveTrader taker fee at the entry tier (>= $0 volume/balance). Maker fee at the same tier is ${makerPct}%; both fall with higher 30-day trading volume or asset balance.`,
      },
    ];
  },
};

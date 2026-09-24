// Upbit Singapore's user guide (client-rendered — raw HTML has none of this
// text) publishes trading fees per quote currency (SGD, USDT), each with
// maker/taker rates. The SGD market is Upbit SG's primary local-currency
// market, so that's the rate used (maker and taker are both 0.25%, GST
// inclusive); the market is named in `note` per the Gemini/Independent
// Reserve convention for crypto exchanges (COST_GROUPS 'crypto' compares
// these on market: 'ALL').
export default {
  id: 'upbit-sg',
  url: 'https://sg.upbit.com/service_center/guide',
  format: 'browser',
  // Require the actual SGD fee row (not just any "Trading Fee" heading plus
  // some unrelated 0.x% elsewhere), since a looser check occasionally passed
  // before the fee table itself had rendered.
  waitFor: (text) => /SGD\s*(\d+(?:\.\d+)?)%\s*(\d+(?:\.\d+)?)%/.test(text),
  targets: ['b-crypto-exchange/upbit-sg'],
  async scrape({ text, extract }) {
    const start = text.indexOf('Trading Fee');
    extract.mustFind(start >= 0 ? true : null, 'Upbit Trading Fee section');
    const slice = text.slice(start, start + 200);
    const sgdMatch = slice.match(/SGD\s*(\d+(?:\.\d+)?)%\s*(\d+(?:\.\d+)?)%/);
    extract.mustFind(sgdMatch, 'Upbit SGD market maker/taker fee row');
    const makerPct = Number(sgdMatch[1]);
    const takerPct = Number(sgdMatch[2]);

    return [
      {
        target: 'b-crypto-exchange/upbit-sg', type: 'per_trade_pct', market: 'ALL',
        value: takerPct, currency: 'PCT',
        label: 'Trading fee (SGD market, taker)',
        note: `SGD market maker/taker fee, GST inclusive (both ${takerPct}%). The USDT market is priced separately on the same guide page.`,
      },
    ];
  },
};

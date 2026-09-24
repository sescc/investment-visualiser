// Maybank Securities — Pricing Stocks help centre page. Uses the standard
// Online/Mobile Cash/Margin rate (not the Pre-funded flat rate, and not the
// Offline/negotiated rate), smallest contract-value tier per market.
export default {
  id: 'maybank-securities',
  url: 'https://www.maybank.com/investment-banking/sg/help_centre/pricing/stocks.page',
  format: 'html',
  targets: ['b-cdp-local/maybank-securities'],
  async scrape({ text, extract }) {
    // "Contract Value Online and Mobile Trades Offline Trades Cash / Margin
    // Pre-funded Cash / Margin / Pre-funded Up to SGD50,000 0.275% 0.12% 0.50%
    // ... Minimum SGD25 SGD10 SGD40"
    const sg = extract.mustFind(
      /Up to SGD50,000\s*([\d.]+)%\s*[\d.]+%\s*[\d.]+%[\s\S]{0,200}?Minimum\s*SGD(\d+)/.exec(text),
      'Maybank Securities SG Online Cash/Margin commission rate and minimum (smallest tier)'
    );

    // "Hong Kong Up to HKD250,000 0.25% 0.12% Above HKD250,000 0.20% Minimum
    // Commission HKD100 HKD50"
    const hk = extract.mustFind(
      /Hong Kong Up to HKD250,000\s*([\d.]+)%\s*[\d.]+%[\s\S]{0,80}?Minimum Commission\s*HKD(\d+)/.exec(text),
      'Maybank Securities HK Online Cash/Margin commission rate and minimum (smallest tier)'
    );

    // "United States All values 0.30% 0.12% Minimum Commission USD20 USD10"
    const us = extract.mustFind(
      /United States All values\s*([\d.]+)%\s*[\d.]+%\s*Minimum Commission\s*USD(\d+)/.exec(text),
      'Maybank Securities US Online Cash/Margin commission rate and minimum'
    );

    return [
      { target: 'b-cdp-local/maybank-securities', type: 'per_trade_pct', market: 'SG', value: Number(sg[1]), currency: 'PCT', note: 'Online/Mobile, Cash/Margin, contract value up to SGD50,000' },
      { target: 'b-cdp-local/maybank-securities', type: 'per_trade_min', market: 'SG', value: Number(sg[2]), currency: 'SGD' },
      { target: 'b-cdp-local/maybank-securities', type: 'per_trade_pct', market: 'US', value: Number(us[1]), currency: 'PCT', note: 'Online/Mobile, Cash/Margin' },
      { target: 'b-cdp-local/maybank-securities', type: 'per_trade_min', market: 'US', value: Number(us[2]), currency: 'USD' },
      { target: 'b-cdp-local/maybank-securities', type: 'per_trade_pct', market: 'HK', value: Number(hk[1]), currency: 'PCT', note: 'Online/Mobile, Cash/Margin, contract value up to HKD250,000' },
      { target: 'b-cdp-local/maybank-securities', type: 'per_trade_min', market: 'HK', value: Number(hk[2]), currency: 'HKD' },
    ];
  },
};

// UOB Kay Hian — Fees and Commissions FAQ article. Uses the standard Online
// Cash/Margin Account rates (not the flat-rate "UTRADE X" cash-upfront
// product, and not the tiered Offline/negotiated rate).
// Consolidates the bank-integrated "uob-kay-hian-tmrw" SG target here since
// UOB TMRW access uses the same commission schedule.
export default {
  id: 'uob-kay-hian',
  url: 'https://uobkh.com.sg/en/faq/article/equities',
  format: 'html',
  targets: ['b-cdp-local/uob-kay-hian', 'b-bank-integrated/uob-kay-hian-tmrw'],
  async scrape({ text, extract }) {
    // "Cash / Margin Account Contract value up to SGD50,0000.275%Negotiable ...
    // Minimum CommissionSGD25 / USD19 / AUD20 / HKD139"
    const sgRate = extract.mustFind(
      /Contract value up to SGD50,000\s*([\d.]+)%/.exec(text),
      'UOB Kay Hian SG Cash/Margin Account online commission rate (smallest contract-value tier)'
    );
    const sgMin = extract.mustFind(
      /Minimum Commission\s*SGD(\d+)\s*\/\s*USD/.exec(text),
      'UOB Kay Hian SG minimum commission'
    );

    // "USOnline RatesOffline Rates Cash Account Flat Rate0.30%Negotiable
    // Minimum CommissionUSD20"
    const us = extract.mustFind(
      /USOnline RatesOffline Rates\s*Cash Account\s*Flat Rate\s*([\d.]+)%[\s\S]{0,60}?Minimum Commission\s*USD(\d+)/.exec(text),
      'UOB Kay Hian US Cash Account commission rate and minimum'
    );

    // "Hong KongOnline RatesOffline Rates Cash Account Contract value up to
    // HKD250,0000.25%Negotiable ... Minimum CommissionHKD100"
    const hk = extract.mustFind(
      /Hong KongOnline RatesOffline Rates\s*Cash Account\s*Contract value up to HKD250,000\s*([\d.]+)%[\s\S]{0,120}?Minimum Commission\s*HKD(\d+)/.exec(text),
      'UOB Kay Hian HK Cash Account commission rate and minimum (smallest contract-value tier)'
    );

    const components = [];
    for (const target of ['b-cdp-local/uob-kay-hian', 'b-bank-integrated/uob-kay-hian-tmrw']) {
      components.push(
        { target, type: 'per_trade_pct', market: 'SG', value: Number(sgRate[1]), currency: 'PCT', note: 'Cash/Margin Account, contract value up to SGD50,000' },
        { target, type: 'per_trade_min', market: 'SG', value: Number(sgMin[1]), currency: 'SGD' }
      );
    }
    components.push(
      { target: 'b-cdp-local/uob-kay-hian', type: 'per_trade_pct', market: 'US', value: Number(us[1]), currency: 'PCT', note: 'Cash Account flat rate' },
      { target: 'b-cdp-local/uob-kay-hian', type: 'per_trade_min', market: 'US', value: Number(us[2]), currency: 'USD' },
      { target: 'b-cdp-local/uob-kay-hian', type: 'per_trade_pct', market: 'HK', value: Number(hk[1]), currency: 'PCT', note: 'Cash Account, contract value up to HKD250,000' },
      { target: 'b-cdp-local/uob-kay-hian', type: 'per_trade_min', market: 'HK', value: Number(hk[2]), currency: 'HKD' }
    );

    return components;
  },
};

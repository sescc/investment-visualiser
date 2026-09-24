// OCBC Securities — "Investment Fees & Charges" page. Uses the "Online
// commission rates and fees" table (SGX/US/HK columns), which is the CDP-linked
// trading account's per-market commission schedule — distinct from the
// separate "Invest Online" 0.275%/0.22%/0.18% table further up the page,
// which applies to OCBC's custodian "Online Equities Account", not CDP trading.
// Consolidates the bank-integrated "ocbc-securities-bank" SG target here since
// the Online Equities Account through internet/mobile banking uses the same
// commission schedule.
export default {
  id: 'ocbc-securities',
  url: 'https://www.ocbc.com/personal-banking/investments/fees-and-charges.page',
  format: 'html',
  targets: ['b-cdp-local/ocbc-securities', 'b-bank-integrated/ocbc-securities-bank'],
  async scrape({ text, extract }) {
    // "Exchange SGX US(NYSE, NASDAQ, AMEX) HK SH “A” BURSA LSE ASX SET TSE PSE
    // IDX SH “B” SZ “B” Commission rates 0.15% 0.15% 0.15% 0.15% 0.30%...
    // Minimum commission fees 25 SGD 20 USD 150 HKD 80 RMB..."
    const match = extract.mustFind(
      /Exchange SGX US\(NYSE, NASDAQ, AMEX\) HK[\s\S]{0,150}?Commission rates\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%[\s\S]{0,200}?Minimum commission fees\s+(\d+)\s*SGD\s+(\d+)\s*USD\s+(\d+)\s*HKD/.exec(text),
      'OCBC "Online commission rates and fees" table (SGX/US/HK columns)'
    );
    const [, sgPct, usPct, hkPct, sgMin, usMin, hkMin] = match;

    const components = [];
    for (const target of ['b-cdp-local/ocbc-securities', 'b-bank-integrated/ocbc-securities-bank']) {
      components.push(
        { target, type: 'per_trade_pct', market: 'SG', value: Number(sgPct), currency: 'PCT' },
        { target, type: 'per_trade_min', market: 'SG', value: Number(sgMin), currency: 'SGD' }
      );
    }
    // US/HK only apply to the standalone CDP-linked account target.
    components.push(
      { target: 'b-cdp-local/ocbc-securities', type: 'per_trade_pct', market: 'US', value: Number(usPct), currency: 'PCT' },
      { target: 'b-cdp-local/ocbc-securities', type: 'per_trade_min', market: 'US', value: Number(usMin), currency: 'USD' },
      { target: 'b-cdp-local/ocbc-securities', type: 'per_trade_pct', market: 'HK', value: Number(hkPct), currency: 'PCT' },
      { target: 'b-cdp-local/ocbc-securities', type: 'per_trade_min', market: 'HK', value: Number(hkMin), currency: 'HKD' }
    );

    return components;
  },
};

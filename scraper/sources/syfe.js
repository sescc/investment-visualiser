// Syfe's single pricing page (syfe.com/pricing) has both the Managed
// Portfolios (robo-advisor AUM fee) tiers AND the Brokerage (Syfe Trade)
// commission tiers, so one adapter fills both m-robo/syfe and
// b-custodian-app/syfe-trade. (Consolidated from the separately-planned
// "syfe-trade" adapter id — see report.)
export default {
  id: 'syfe',
  url: 'https://www.syfe.com/pricing',
  format: 'html',
  targets: ['m-robo/syfe', 'b-custodian-app/syfe-trade'],
  async scrape({ text, extract }) {
    // --- Managed portfolios AUM tiers ---
    const tierStart = text.indexOf('total assets / products');
    const tierEnd = text.indexOf('cash management');
    extract.mustFind(tierStart >= 0 && tierEnd > tierStart ? true : null, 'Syfe tier threshold row');
    const tierRow = text.slice(tierStart, tierEnd);
    // "No min.S$50K+S$250K+S$1M+S$5M+"
    const thresholds = [...tierRow.matchAll(/S\$(\d+)([KM])\+/g)].map((m) => {
      const n = Number(m[1]);
      return m[2] === 'M' ? n * 1_000_000 : n * 1_000;
    });
    extract.mustFind(thresholds.length === 4 ? true : null, 'Syfe 4 tier thresholds (Black/Gold/Platinum/Diamond)');

    const portfoliosStart = text.indexOf('MANAGED PORTFOLIOSFees (p.a.)ALL PORTFOLIOS');
    extract.mustFind(portfoliosStart >= 0 ? true : null, 'Syfe managed portfolios fee row');
    const portfoliosSlice = text.slice(portfoliosStart, portfoliosStart + 200);
    const pctMatches = [...portfoliosSlice.matchAll(/(\d+\.\d+)%/g)].map((m) => Number(m[1]));
    extract.mustFind(pctMatches.length === 5 ? true : null, 'Syfe 5 managed-portfolio fee tiers');

    const tiers = [
      { upTo: thresholds[0], value: pctMatches[0] },
      { upTo: thresholds[1], value: pctMatches[1] },
      { upTo: thresholds[2], value: pctMatches[2] },
      { upTo: thresholds[3], value: pctMatches[3] },
      { upTo: null, value: pctMatches[4] },
    ];

    // --- Brokerage (Syfe Trade): Singapore commission + minimum (Blue/base tier) ---
    const brokerageStart = text.indexOf('BrokerageMin. S$1.98 per trade') >= 0
      ? text.indexOf('BrokerageMin. S$1.98 per trade')
      : text.indexOf('Brokerage$0 commission');
    extract.mustFind(brokerageStart >= 0 ? true : null, 'Syfe Brokerage section');
    const brokerageSlice = text.slice(brokerageStart, brokerageStart + 500);

    const sgMinMatch = brokerageSlice.match(/Min\.\s*S\$([\d.]+)\s*per trade/);
    const sgMin = extract.mustFind(sgMinMatch ? Number(sgMinMatch[1]) : null, 'Syfe SG brokerage minimum per trade');
    const sgPctMatches = [...brokerageSlice.matchAll(/(\d+\.\d+)%of trade value/g)].map((m) => Number(m[1]));
    extract.mustFind(sgPctMatches.length ? true : null, 'Syfe SG brokerage commission tiers');
    const sgBasePct = sgPctMatches[0]; // Blue (base/entry) tier — highest rate

    extract.mustFind(/\$0 commission and \$0 platform fee on all US trades/.test(text) ? true : null, 'Syfe US $0 commission/platform fee confirmation');

    return [
      {
        target: 'm-robo/syfe', type: 'aum_annual_pct', market: 'ALL',
        value: tiers[0].value, currency: 'PCT', tiers,
        label: 'Managed Portfolios annual fee',
      },
      {
        target: 'b-custodian-app/syfe-trade', type: 'per_trade_pct', market: 'SG',
        value: sgBasePct, currency: 'PCT',
        note: 'Base (Blue) tier rate; lower rates apply at higher membership tiers (see page).',
      },
      {
        target: 'b-custodian-app/syfe-trade', type: 'per_trade_min', market: 'SG',
        value: sgMin, currency: 'SGD',
      },
      {
        target: 'b-custodian-app/syfe-trade', type: 'per_trade_flat', market: 'US',
        value: 0, currency: 'USD',
        note: '$0 commission and $0 platform fee on all US trades, across all tiers.',
      },
    ];
  },
};

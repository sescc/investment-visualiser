// Endowus pricing page — fills three targets that all draw on the same
// "All Endowus Fees at a Glance" table (Cash — Long-Term Wealth tiers),
// consolidated per task instructions:
//   - m-robo/endowus: advised portfolios (Flagship/Income/ESG/Fund Smart 2+ funds)
//   - b-fund-platform/endowus-platform: same Cash access-fee tiers
//   - m-fund-platform/endowus-fund-smart: self-directed Fund Smart (single fund), Cash
export default {
  id: 'endowus',
  url: 'https://endowus.com/pricing',
  format: 'html',
  targets: ['m-robo/endowus', 'b-fund-platform/endowus-platform', 'm-fund-platform/endowus-fund-smart'],
  async scrape({ text, extract }) {
    // "All Endowus Fees at a Glance" table, Cash — Long-Term Wealth row:
    // "Flagship, Income, ESG, Fund Smart<$200K$200K – <$1M$1M – <$5M‍≥$5M0.60%0.50%0.35%0.25%"
    const label = 'Flagship, Income, ESG, Fund Smart';
    const labelIdx = text.indexOf(label);
    extract.mustFind(labelIdx >= 0 ? true : null, 'Endowus "Flagship, Income, ESG, Fund Smart" tier row label');
    const slice = text.slice(labelIdx, labelIdx + 250);
    const pctMatches = [...slice.matchAll(/(\d+\.\d+)%/g)].map((m) => Number(m[1]));
    extract.mustFind(pctMatches.length >= 4 ? true : null, 'Endowus 4 Cash tier percentages');
    const [under200k, under1m, under5m, over5m] = pctMatches;

    const advisedTiers = [
      { upTo: 200000, value: under200k },
      { upTo: 1000000, value: under1m },
      { upTo: 5000000, value: under5m },
      { upTo: null, value: over5m },
    ];

    // Fund Smart single-fund (Cash): the "Below $5M...0.30%...$5M and above...0.25%..."
    // block that immediately follows the multi-fund tier block. "Below $5M" is a safe
    // anchor since the multi-fund block's first breakpoint is "Below $200K", not "$5M".
    extract.mustFind(text.includes('Single-fund is Fund Smart with 1 fund.') ? true : null, 'Endowus Fund Smart single-fund explainer text');
    const fsIdx = text.indexOf('Below $5M', labelIdx);
    extract.mustFind(fsIdx >= 0 ? true : null, 'Endowus Fund Smart single-fund tier block ("Below $5M")');
    const fsSlice = text.slice(fsIdx, fsIdx + 100);
    const fsPctMatches = [...fsSlice.matchAll(/(\d+\.\d+)%/g)].map((m) => Number(m[1]));
    extract.mustFind(fsPctMatches.length >= 2 ? true : null, 'Endowus Fund Smart single-fund tier percentages');
    const fundSmartTiers = [
      { upTo: 5000000, value: fsPctMatches[0] },
      { upTo: null, value: fsPctMatches[1] },
    ];

    return [
      {
        target: 'm-robo/endowus', type: 'aum_annual_pct', market: 'ALL',
        value: advisedTiers[0].value, currency: 'PCT', tiers: advisedTiers,
        label: 'Cash — Long-Term Wealth access fee (advised portfolios)',
        note: 'CPF and SRS advised portfolios are priced separately at flat rates (see page) and do not combine with Cash for tiering.',
      },
      {
        target: 'b-fund-platform/endowus-platform', type: 'aum_annual_pct', market: 'ALL',
        value: advisedTiers[0].value, currency: 'PCT', tiers: advisedTiers,
        label: 'Endowus Access Fee (Cash)',
      },
      {
        target: 'm-fund-platform/endowus-fund-smart', type: 'aum_annual_pct', market: 'ALL',
        value: fundSmartTiers[0].value, currency: 'PCT', tiers: fundSmartTiers,
        label: 'Fund Smart (self-directed, single fund) access fee — Cash',
        note: 'CPF/SRS Fund Smart single-fund access fee is a flat rate (see page) and does not use this tiering.',
      },
    ];
  },
};

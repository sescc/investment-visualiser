// StashAway SG pricing page — General Investing (and related) portfolios'
// marginal-band annual fee tiers, server-rendered.
export default {
  id: 'stashaway',
  url: 'https://www.stashaway.sg/pricing',
  format: 'html',
  targets: ['m-robo/stashaway'],
  async scrape({ text, extract }) {
    const start = text.indexOf('First $25,0000.8%');
    extract.mustFind(start >= 0 ? true : null, 'StashAway tiered fee table start');
    const end = text.indexOf('Flexible Portfolio', start);
    extract.mustFind(end > start ? true : null, 'StashAway tiered fee table end');
    const slice = text.slice(start, end);

    // Rows look like: "First $25,0000.8%" / "...up to $50,0000.7%" / "...above $1,000,0000.2%"
    const rows = [...slice.matchAll(/\$([\d,]+)(\d\.\d)%/g)];
    extract.mustFind(rows.length === 7 ? true : null, 'StashAway 7 marginal fee bands');

    const bandTops = [25000, 50000, 100000, 250000, 500000, 1000000];
    const values = rows.map((m) => Number(m[2]));

    const tiers = bandTops.map((upTo, i) => ({ upTo, value: values[i] }));
    tiers.push({ upTo: null, value: values[6] });

    return [
      {
        target: 'm-robo/stashaway', type: 'aum_annual_pct', market: 'ALL',
        value: tiers[0].value, currency: 'PCT', tiers,
        label: 'General Investing annual fee',
      },
    ];
  },
};

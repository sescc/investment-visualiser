// DBS digiPortfolio — product page's "Portfolio Statistics" tables. Every
// portfolio listed (Wealth Builder, Global, Asia, ...) shows the same
// "digiPortfolio fee 0.75% p.a." figure, so the first match is representative.
export default {
  id: 'dbs-digiportfolio',
  url: 'https://www.dbs.com.sg/personal/investments/other-investments/dbs-digiportfolio',
  format: 'html',
  targets: ['m-robo/dbs-digiportfolio'],
  async scrape({ text, extract }) {
    const match = extract.mustFind(
      /digiPortfolio fee[\s\S]{0,60}?([\d.]+)%\s*p\.a\./.exec(text),
      'DBS digiPortfolio management fee (% p.a.)'
    );
    return [
      {
        target: 'm-robo/dbs-digiportfolio',
        type: 'aum_annual_pct',
        market: 'ALL',
        value: Number(match[1]),
        currency: 'PCT',
        note: 'Same rate shown for all digiPortfolio strategies (Wealth Builder, Global, Asia, etc.); excludes the underlying fund houses\' own management fees (see page).',
      },
    ];
  },
};

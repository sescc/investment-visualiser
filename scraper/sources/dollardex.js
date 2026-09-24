// dollarDEX (Singlife) landing page advertises "Zero Platform Fees" for
// Cash/CPF/SRS unit trust investing. No sales-charge percentage is published
// on this page (it's set per fund), so only the platform fee is emitted.
export default {
  id: 'dollardex',
  url: 'https://singlife.com/en/dollardex',
  format: 'html',
  targets: ['m-fund-platform/dollardex'],
  async scrape({ text, extract }) {
    extract.mustFind(/[Zz]ero Platform Fees?/.test(text) ? true : null, 'dollarDEX "Zero Platform Fee(s)" confirmation');

    return [
      {
        target: 'm-fund-platform/dollardex', type: 'platform_flat_annual', market: 'ALL',
        value: 0, currency: 'SGD',
        note: 'dollarDEX advertises zero platform fees across Cash/CPF/SRS investing. Fund-level sales charges are set per fund and not published as a single site-wide rate.',
      },
    ];
  },
};

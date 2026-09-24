// DBS/POSB Unit Trusts — "Why invest with DBS" page. DBS's main unit trust
// landing pages are JS-rendered SPA shells with no fee text in the raw HTML;
// this "why-invest" page is server-rendered and states the online sales
// charge directly.
export default {
  id: 'dbs-unit-trusts',
  url: 'https://www.dbs.com.sg/personal/investments/unit-trusts/why-invest',
  format: 'html',
  targets: ['m-bank-unit-trust/dbs-unit-trusts'],
  async scrape({ text, extract }) {
    // "There will be an online sales charge of 0.82% per transaction on any investment amount."
    const match = extract.mustFind(
      /online sales charge of\s*([\d.]+)%\s*per transaction on any investment amount/.exec(text),
      'DBS online unit trust sales charge (% per transaction)'
    );
    return [
      {
        target: 'm-bank-unit-trust/dbs-unit-trusts',
        type: 'sales_charge_pct',
        market: 'ALL',
        value: Number(match[1]),
        currency: 'PCT',
        note: 'Online sales charge per transaction, any investment amount',
      },
    ];
  },
};

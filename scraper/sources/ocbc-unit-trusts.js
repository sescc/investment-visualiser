// OCBC Unit Trusts — dedicated product page's "Fees and charges" section.
// Uses the standard "Do it yourself online" sales charge (lump sum), not the
// "Receive expert advice" (up to 5%) tier.
export default {
  id: 'ocbc-unit-trusts',
  url: 'https://www.ocbc.com/personal-banking/investments/unit-trusts/why-invest-with-us',
  format: 'html',
  targets: ['m-bank-unit-trust/ocbc-unit-trusts'],
  async scrape({ text, extract }) {
    const match = extract.mustFind(
      /Calculate online sales charge for me\s*Do it yourself online\s*([\d.]+)%\s*of investment amount/.exec(text),
      'OCBC unit trust online sales charge (% of investment amount)'
    );
    return [
      {
        target: 'm-bank-unit-trust/ocbc-unit-trusts',
        type: 'sales_charge_pct',
        market: 'ALL',
        value: Number(match[1]),
        currency: 'PCT',
        note: 'Online sales charge via OCBC app / Internet Banking; branch/advised purchases usually cost more (see page)',
      },
    ];
  },
};

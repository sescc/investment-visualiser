// UOB's Gold & Silver page covers both the Gold Savings Account (GSA)
// monthly service charge and the physical-gold conversion fee on the same
// page, so one adapter fills both p-gold-silver feeSpecs (consolidated from
// the originally separate uob-gold-savings-fee / uob-gold-conversion-fee
// adapter ids named in the baseline).
const PAGE_URL = 'https://www.uob.com.sg/personal/invest/gold-and-silver.page';

export default {
  id: 'uob-gold',
  url: PAGE_URL,
  format: 'html',
  targets: ['p-gold-silver'],
  async scrape({ text, extract }) {
    const gsaMatch = /Gold Savings Account \(GSA\) will be simplified to\s*(\d+(?:\.\d+)?)%\s*per annum/i.exec(text);
    extract.mustFind(gsaMatch, 'UOB Gold Savings Account service charge on gold-and-silver page');
    const gsaRate = Number(gsaMatch[1]);

    const conversionMatch = /fee of S\$(\d+(?:\.\d+)?)\s*(?:is|will be) charged per 100g of physical gold cast bar/i.exec(
      text
    );
    extract.mustFind(conversionMatch, 'UOB GSA physical gold conversion fee on gold-and-silver page');
    const conversionFee = Number(conversionMatch[1]);

    return [
      {
        target: 'p-gold-silver',
        type: 'aum_annual_pct',
        market: 'SG',
        value: gsaRate,
        currency: 'PCT',
        label: 'UOB Gold Savings Account monthly service charge (% p.a. of highest balance each month)',
      },
      {
        target: 'p-gold-silver',
        type: 'transaction_flat',
        market: 'SG',
        value: conversionFee,
        currency: 'SGD',
        label: 'UOB GSA physical gold conversion fee, per 100g cast bar',
      },
    ];
  },
};

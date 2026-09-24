// POSB/DBS Invest-Saver — the main Invest-Saver landing page never states a
// numeric fee; DBS's iBanking FAQ page for the ETF Regular Savings Plan does,
// and explicitly calls out POSB Invest-Saver in its footer notice.
export default {
  id: 'posb-invest-saver',
  url: 'https://www.dbs.com.sg/ibanking/help/faq/exchange-traded-fund-regular-savings-plan-sales-charge.html',
  format: 'html',
  targets: ['m-bank-rsp/posb-invest-saver'],
  async scrape({ text, extract }) {
    // "Exchange Traded Fund Net sales charge(monthly) for Internet Banking
    // transaction Nikko AM Singapore STI ETF 1.00% ABF Singapore Bond Index Fund 0.50%"
    const sti = extract.mustFind(
      /Nikko AM Singapore STI ETF\s*([\d.]+)%/.exec(text),
      'POSB Invest-Saver Nikko AM Singapore STI ETF monthly sales charge %'
    );
    const bond = extract.mustFind(
      /ABF Singapore Bond Index Fund\s*([\d.]+)%/.exec(text),
      'POSB Invest-Saver ABF Singapore Bond Index Fund monthly sales charge %'
    );
    return [
      {
        target: 'm-bank-rsp/posb-invest-saver',
        type: 'sales_charge_pct',
        market: 'SG',
        value: Number(sti[1]),
        currency: 'PCT',
        label: 'RSP sales charge (Nikko AM Singapore STI ETF)',
        note: `Charged monthly on RSP purchases; the ABF Singapore Bond Index Fund counter is ${bond[1]}% instead`,
      },
    ];
  },
};

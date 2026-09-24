// UOBAM Invest (Digital Adviser) — dedicated "Digital Adviser" page's "Fees
// charged to Investors" table. The homepage only advertises a "0.40% till 30
// June 2023" promo (long expired), so this adapter reads the standing fee
// schedule instead. Uses the smallest investment tier (S$25,000 and below).
export default {
  id: 'uobam-invest',
  url: 'https://www.uobam.com.sg/uobaminvest/digital-adviser.html',
  format: 'html',
  targets: ['m-robo/uobam-invest'],
  async scrape({ text, extract }) {
    // "Fees charged to Investors S$25,000 and below Above S$25,0002 Annual fee1
    // (inclusive of GST of 8%) 0.8% p.a. 0.6% p.a."
    const match = extract.mustFind(
      /S\$25,000 and below\s*Above S\$25,000\d*\s*Annual fee\d*\s*\(inclusive of GST of \d+%\)\s*([\d.]+)%\s*p\.a\.\s*([\d.]+)%\s*p\.a\./.exec(text),
      'UOBAM Invest annual fee table (S$25,000 and below vs above tiers)'
    );
    return [
      {
        target: 'm-robo/uobam-invest',
        type: 'aum_annual_pct',
        market: 'ALL',
        value: Number(match[1]),
        currency: 'PCT',
        note: `Investment amount S$25,000 and below, inclusive of GST; drops to ${match[2]}% p.a. above S$25,000`,
      },
    ];
  },
};

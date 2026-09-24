// Webull SG pricing page (server-rendered).
// SG: the page shows a 1-year promo of $0 commission; the footnote gives the
// standard (post-promo) rate, which is what we use per policy.
// US: "Truly $0 fees for US Stocks & ETFs" is Webull's standing headline
// (not time-limited like the SG promo) — both commission and platform fee
// are $0.
export default {
  id: 'webull-sg',
  url: 'https://www.webull.com.sg/pricing',
  format: 'html',
  targets: ['b-custodian-app/webull-sg'],
  async scrape({ text, extract }) {
    const sgNote = extract.findNear(
      text,
      /the standard commission of\s*/,
      /0\.\d+%\s*\*\s*Total trade amount\s*\(min\.\s*SGD\s*[\d.]+\s*per order\)/,
      150
    );
    extract.mustFind(sgNote, 'Webull SG standard commission text');
    const sgPct = extract.mustFind(extract.parsePct(sgNote), 'Webull SG standard commission %');
    const sgMinMatch = sgNote.match(/min\.\s*SGD\s*([\d.]+)\s*per order/);
    const sgMin = extract.mustFind(sgMinMatch ? Number(sgMinMatch[1]) : null, 'Webull SG standard commission minimum');

    extract.mustFind(/Truly\s*\$0\s*fees for US Stocks\s*&\s*ETFs/.test(text) ? true : null, 'Webull "Truly $0 fees" US headline');
    extract.mustFind(/US\$0\s*Platform fee/.test(text) ? true : null, 'Webull US $0 platform fee');
    extract.mustFind(/US\$0\s*Commission/.test(text) ? true : null, 'Webull US $0 commission');

    return [
      {
        target: 'b-custodian-app/webull-sg', type: 'per_trade_pct', market: 'SG',
        value: sgPct, currency: 'PCT',
        note: 'Standard rate after the 1-year commission-free promo period for new clients ends.',
      },
      {
        target: 'b-custodian-app/webull-sg', type: 'per_trade_min', market: 'SG',
        value: sgMin, currency: 'SGD',
      },
      {
        target: 'b-custodian-app/webull-sg', type: 'per_trade_flat', market: 'US',
        value: 0, currency: 'USD',
        note: 'Webull SG advertises "Truly $0 fees for US Stocks & ETFs" — both commission and platform fee are $0 (not a time-limited promo, unlike the SG-market rate).',
      },
    ];
  },
};

// Tiger Brokers SG commissions page (server-rendered).
//
// SG and US both charge a Commission AND a separate Platform Fee with
// slightly different (not identical) rates/minimums, so — per policy —
// only the Commission is modelled as per_trade_pct/per_trade_min; the
// Platform Fee is described in `note` rather than invented into cost.js.
export default {
  id: 'tiger-brokers-sg',
  url: 'https://www.itiger.com/sg/commissions',
  format: 'html',
  targets: ['b-custodian-app/tiger-brokers-sg'],
  async scrape({ text, extract }) {
    // --- Singapore Stocks, ETFs, REITs... ---
    const sgStart = text.indexOf('Singapore Stocks (including Odd Lot), ETFs, REITs');
    const sgEnd = text.indexOf('Singapore DLCs & Structured Warrants');
    extract.mustFind(sgStart >= 0 && sgEnd > sgStart ? true : null, 'Tiger SG stocks fee section');
    const sgSection = text.slice(sgStart, sgEnd);

    const sgCommission = extract.findNear(sgSection, /Commission\s*/, /0\.\d+%\s*\*\s*Trade Value\s*Min\.\s*SGD\s*[\d.]+\s*\/\s*Order/, 100);
    extract.mustFind(sgCommission, 'Tiger SG commission text');
    const sgPct = extract.mustFind(extract.parsePct(sgCommission), 'Tiger SG commission %');
    const sgMinMatch = sgCommission.match(/Min\.\s*SGD\s*([\d.]+)\s*\/\s*Order/);
    const sgMin = extract.mustFind(sgMinMatch ? Number(sgMinMatch[1]) : null, 'Tiger SG commission minimum');

    const sgPlatform = extract.findNear(sgSection, /Platform Fee\s*/, /0\.\d+%\s*\*\s*Trade Value\s*Min\.\s*SGD\s*[\d.]+\s*\/\s*Order/, 100);
    extract.mustFind(sgPlatform, 'Tiger SG platform fee text');

    // --- US Stocks, ETFs & Fractional Shares ---
    const usStart = text.indexOf('Competitive commissions on US Stocks, ETFs & Fractional Shares');
    const usEnd = text.indexOf('Tiger Brokers SEC Membership Fee');
    extract.mustFind(usStart >= 0 && usEnd > usStart ? true : null, 'Tiger US stocks fee section');
    const usSection = text.slice(usStart, usEnd);

    const usCommission = extract.findNear(usSection, /Commission\s*/, /USD\s*[\d.]+\s*\/\s*Share\s*Min\.\s*USD\s*[\d.]+\s*\/\s*Order\s*Max\.\s*[\d.]+%\s*\*\s*Trade Value\s*\/\s*Order/, 100);
    extract.mustFind(usCommission, 'Tiger US commission text');
    const usPerShareMatch = usCommission.match(/USD\s*([\d.]+)\s*\/\s*Share/);
    const usMinMatch = usCommission.match(/Min\.\s*USD\s*([\d.]+)\s*\/\s*Order/);
    const usMaxMatch = usCommission.match(/Max\.\s*([\d.]+)%\s*\*\s*Trade Value/);
    const usPerShare = extract.mustFind(usPerShareMatch ? Number(usPerShareMatch[1]) : null, 'Tiger US commission per share');
    const usMin = extract.mustFind(usMinMatch ? Number(usMinMatch[1]) : null, 'Tiger US commission minimum');
    const usMax = extract.mustFind(usMaxMatch ? Number(usMaxMatch[1]) : null, 'Tiger US commission max %');

    const usPlatform = extract.findNear(usSection, /Tiger Brokers Platform Fee\s*/, /USD\s*[\d.]+\s*\/\s*Share\s*Min\.\s*USD\s*[\d.]+\s*\/\s*Order/, 100);
    extract.mustFind(usPlatform, 'Tiger US platform fee text');

    const sgPlatPct = extract.mustFind(extract.parsePct(sgPlatform), 'Tiger SG platform fee %');
    const sgPlatMinMatch = sgPlatform.match(/Min\.\s*SGD\s*([\d.]+)/);
    const sgPlatMin = extract.mustFind(sgPlatMinMatch ? Number(sgPlatMinMatch[1]) : null, 'Tiger SG platform fee minimum');
    const usPlatMinMatch = usPlatform.match(/Min\.\s*USD\s*([\d.]+)/);
    const usPlatMin = extract.mustFind(usPlatMinMatch ? Number(usPlatMinMatch[1]) : null, 'Tiger US platform fee minimum');
    const usPlatPerShareMatch = usPlatform.match(/USD\s*([\d.]+)\s*\/\s*Share/);
    const usPlatPerShare = extract.mustFind(usPlatPerShareMatch ? Number(usPlatPerShareMatch[1]) : null, 'Tiger US platform fee per share');
    // The platform fee may also have a % cap printed after it.
    const usPlatMaxMatch = usSection.slice(usSection.indexOf(usPlatform) + usPlatform.length, usSection.indexOf(usPlatform) + usPlatform.length + 80)
      .match(/^\s*Max\.\s*([\d.]+)%\s*\*\s*Trade Value/);

    const t = 'b-custodian-app/tiger-brokers-sg';
    return [
      { target: t, type: 'per_trade_pct', market: 'SG', value: sgPct, currency: 'PCT', label: 'Commission' },
      { target: t, type: 'per_trade_min', market: 'SG', value: sgMin, currency: 'SGD', label: 'Commission minimum' },
      { target: t, type: 'per_trade_pct', market: 'SG', group: 'platform', value: sgPlatPct, currency: 'PCT', label: 'Platform fee' },
      { target: t, type: 'per_trade_min', market: 'SG', group: 'platform', value: sgPlatMin, currency: 'SGD', label: 'Platform fee minimum' },
      { target: t, type: 'per_share', market: 'US', value: usPerShare, currency: 'USD', label: 'Commission per share' },
      { target: t, type: 'per_trade_min', market: 'US', value: usMin, currency: 'USD', label: 'Commission minimum' },
      { target: t, type: 'per_trade_max_pct', market: 'US', value: usMax, currency: 'PCT', label: 'Commission cap (% of trade value)' },
      { target: t, type: 'per_share', market: 'US', group: 'platform', value: usPlatPerShare, currency: 'USD', label: 'Platform fee per share' },
      { target: t, type: 'per_trade_min', market: 'US', group: 'platform', value: usPlatMin, currency: 'USD', label: 'Platform fee minimum' },
      ...(usPlatMaxMatch ? [{ target: t, type: 'per_trade_max_pct', market: 'US', group: 'platform', value: Number(usPlatMaxMatch[1]), currency: 'PCT', label: 'Platform fee cap (% of trade value)' }] : []),
    ];
  },
};

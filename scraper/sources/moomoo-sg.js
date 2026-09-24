// moomoo SG fee schedule (Help Center articles, server-rendered — NOT the
// marketing /pricing page, which only shows time-limited promo banners).
//
// SG stocks/ETFs/REITs: Commission 0.03% (min SGD 0.99/order) PLUS a
// separate, identically-structured Platform Fee (also 0.03%, min SGD 0.99).
// Because both components share the exact same rate and minimum, they can
// be combined into a single per_trade_pct/per_trade_min pair without losing
// accuracy: max(0.03%*V,0.99) + max(0.03%*V,0.99) == max(0.06%*V,1.98).
//
// US stocks/ETFs: Commission is $0 (moomoo's announced "permanent zero
// commissions" policy — see the SG Help Center announcement of the same
// name). The Platform Fee (USD 0.99/order, fixed default tier) is the only
// real per-trade charge, so it is emitted as per_trade_flat.
import { getText } from '../lib/http.js';

const SG_URL = 'https://www.moomoo.com/sg/support/topic5_118';
const US_URL = 'https://www.moomoo.com/sg/support/topic5_76';

export default {
  id: 'moomoo-sg',
  url: SG_URL,
  format: 'html',
  targets: ['b-custodian-app/moomoo-sg'],
  async scrape({ text, extract }) {
    // --- SG stocks, ETFs & REITs (section "1.") ---
    const sgStart = text.indexOf('1. Singapore Stocks, ETFs and REITs');
    const sgEnd = text.indexOf('2. Singapore Daily Leverage Certificates');
    extract.mustFind(sgStart >= 0 && sgEnd > sgStart ? true : null, 'moomoo SG stocks fee section');
    const sgSection = text.slice(sgStart, sgEnd);

    const sgCommission = extract.findNear(sgSection, /1\.1 Commission[\s\S]{0,80}?Fees/, /SGD\s*0\.\d+%\s*\*\s*Transaction amount,\s*min\s*[\d.]+\s*\/\s*Order/, 200);
    extract.mustFind(sgCommission, 'moomoo SG commission fee text');
    const sgCommissionPct = extract.mustFind(extract.parsePct(sgCommission), 'moomoo SG commission %');
    const sgCommissionMinMatch = sgCommission.match(/min\s*([\d.]+)\s*\/\s*Order/);
    const sgCommissionMin = extract.mustFind(sgCommissionMinMatch ? Number(sgCommissionMinMatch[1]) : null, 'moomoo SG commission minimum');

    const sgPlatform = extract.findNear(sgSection, /1\.2 Platform Fees[\s\S]{0,80}?Fees/, /SGD\s*0\.\d+%\s*\*\s*Transaction amount,\s*min\s*[\d.]+\s*\/\s*Order/, 200);
    extract.mustFind(sgPlatform, 'moomoo SG platform fee text');
    const sgPlatformPct = extract.mustFind(extract.parsePct(sgPlatform), 'moomoo SG platform fee %');
    const sgPlatformMinMatch = sgPlatform.match(/min\s*([\d.]+)\s*\/\s*Order/);
    const sgPlatformMin = extract.mustFind(sgPlatformMinMatch ? Number(sgPlatformMinMatch[1]) : null, 'moomoo SG platform fee minimum');

    const combinedPct = Math.round((sgCommissionPct + sgPlatformPct) * 1e6) / 1e6;
    const combinedMin = Math.round((sgCommissionMin + sgPlatformMin) * 100) / 100;

    // --- US stocks & ETFs (fetched from the separate Help Center article) ---
    const usHtml = await getText(US_URL);
    const usText = extract.cleanText(extract.load(usHtml));

    const usCStart = usText.indexOf('1.1 Commission');
    const usCEnd = usText.indexOf('1.2 Platform Fees');
    extract.mustFind(usCStart >= 0 && usCEnd > usCStart ? true : null, 'moomoo US commission section');
    const usCommissionSection = usText.slice(usCStart, usCEnd);
    extract.mustFind(/USD\s*\$0\*/.test(usCommissionSection) ? true : null, 'moomoo US $0 commission confirmation');

    const usPlatform = extract.findNear(usText, /1\.2 Platform Fees[\s\S]{0,80}?Fees/, /Fixed \(Default\)\s*USD\s*\$([\d.]+)\s*\/\s*Order/, 200);
    extract.mustFind(usPlatform, 'moomoo US platform fee text');
    const usPlatformMatch = usPlatform.match(/\$([\d.]+)/);
    const usPlatformFee = extract.mustFind(usPlatformMatch ? Number(usPlatformMatch[1]) : null, 'moomoo US platform fee');

    return [
      {
        target: 'b-custodian-app/moomoo-sg', type: 'per_trade_pct', market: 'SG',
        value: combinedPct, currency: 'PCT',
        note: `Combines Commission (${sgCommissionPct}%, min SGD ${sgCommissionMin}/order) + Platform Fee (${sgPlatformPct}%, min SGD ${sgPlatformMin}/order) — the two are structurally identical, so combining them is exact.`,
      },
      {
        target: 'b-custodian-app/moomoo-sg', type: 'per_trade_min', market: 'SG',
        value: combinedMin, currency: 'SGD',
      },
      {
        target: 'b-custodian-app/moomoo-sg', type: 'per_trade_flat', market: 'US',
        value: usPlatformFee, currency: 'USD', source: US_URL,
        note: 'Commission is USD $0 (moomoo\'s "permanent zero commissions" policy for eligible clients). This is the Platform Fee, fixed default tier per order.',
      },
    ];
  },
};

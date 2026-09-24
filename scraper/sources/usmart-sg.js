// uSMART SG pricing page (usmart.sg/pricing — note the www.usmart.sg URL
// server-redirects there) renders its fee tables client-side; the raw HTML
// has none of this text. Needs format: 'browser' (see CLAUDE.md).
//
// SG: Commission 0.02% (no minimum) + a separate Platform Fee 0.03% (no
// minimum), both "Online Rates" for the uSMART SG entity — modelled as two
// per_trade_pct groups, same pattern as Tiger Brokers SG.
// US ("Available Across ASEAN..." online tier): pricing splits at a stock-price
// threshold stated on the page. At/above it the Platform Fee is a fixed amount
// per order; below it, it's per share with a minimum and a % cap. Both tiers
// are emitted with `sharePrice: {from|below}` so cost.js picks the one matching
// the calculator's typical share price. Threshold and figures are all parsed.
export default {
  id: 'usmart-sg',
  url: 'https://www.usmart.sg/pricing',
  format: 'browser',
  waitFor: (text) => /SG Stock Fees/.test(text) && /US Stock Fees/.test(text),
  targets: ['b-custodian-app/usmart-sg'],
  async scrape({ text, extract }) {
    const sgStart = text.indexOf('SG Stock FeesSGDUSDHKD');
    extract.mustFind(sgStart >= 0 ? true : null, 'uSMART SG Stock Fees section');
    const sgSection = text.slice(sgStart, sgStart + 400);

    const sgCommissionMatch = sgSection.match(/Commission(\d+(?:\.\d+)?)% \* Transaction Amount No Minimum/);
    const sgCommissionPct = extract.mustFind(sgCommissionMatch ? Number(sgCommissionMatch[1]) : null, 'uSMART SG commission %');

    const sgPlatformMatch = sgSection.match(/Platform Fee(\d+(?:\.\d+)?)% \* Transaction Amount No Minimum/);
    const sgPlatformPct = extract.mustFind(sgPlatformMatch ? Number(sgPlatformMatch[1]) : null, 'uSMART SG platform fee %');

    const usStart = text.indexOf('US Stock Fees (Available Across ASEAN and Japan/Korea/Taiwan Clients)Charged ByU.S. Stocks Price');
    extract.mustFind(usStart >= 0 ? true : null, 'uSMART US Stock Fees section');
    const usSection = text.slice(usStart, usStart + 700);

    // Online rates, two share-price tiers split at a threshold stated on the page (parsed, never assumed):
    // "...Stock price ≥ T USDCommission$0USD … (offline)Stock price＜T USD$0uSMART SGStock price ≥ T USDPlatform FeeUS$X /Order (Fixed)$0
    //  Stock price < T USDUSD a Per Share Minimum USD b Per Order Maximum c% * Transaction Amount"
    // (the page mixes ASCII "<" and full-width "＜").
    const num = '(\\d+(?:\\.\\d+)?)';
    const usCommissionMatch = usSection.match(new RegExp(`Stock price ≥ ${num} USDCommission\\$${num}`));
    extract.mustFind(usCommissionMatch, 'uSMART US commission (upper share-price tier, online)');
    const usCommissionLowMatch = usSection.match(new RegExp(`Stock price\\s*[<＜]\\s*${num} USD\\$${num}uSMART`));
    extract.mustFind(usCommissionLowMatch, 'uSMART US commission (lower share-price tier, online)');
    const usPlatformMatch = usSection.match(new RegExp(`Stock price ≥ ${num} USDPlatform FeeUS\\$${num} \\/Order \\(Fixed\\)`));
    extract.mustFind(usPlatformMatch, 'uSMART US platform fee (upper share-price tier, online, fixed)');
    const usSmallTierMatch = usSection.match(new RegExp(`Stock price\\s*[<＜]\\s*${num} USDUSD ${num} Per Share Minimum USD ${num} Per Order Maximum ${num}% \\* Transaction Amount`));
    extract.mustFind(usSmallTierMatch, 'uSMART US platform fee (lower share-price tier)');

    const thresholds = [usCommissionMatch[1], usCommissionLowMatch[1], usPlatformMatch[1], usSmallTierMatch[1]].map(Number);
    if (new Set(thresholds).size !== 1) throw new Error(`uSMART US share-price thresholds disagree: ${thresholds.join(', ')}`);
    const T = thresholds[0];
    const [usCommissionHigh, usCommissionLow, usPlatformFlat] = [usCommissionMatch[2], usCommissionLowMatch[2], usPlatformMatch[2]].map(Number);
    const [usPerShare, usMin, usMaxPct] = usSmallTierMatch.slice(2, 5).map(Number);

    const t = 'b-custodian-app/usmart-sg';
    const tierNote = 'Online rate, ASEAN/Japan/Korea/Taiwan client tier; the tier follows the calculator\'s typical share price.';
    const usCommission = usCommissionHigh === usCommissionLow
      ? [{ target: t, type: 'per_trade_flat', market: 'US', value: usCommissionHigh, currency: 'USD', label: 'Commission', note: `Online rate at any share price (ASEAN/Japan/Korea/Taiwan client tier).` }]
      : [
        { target: t, type: 'per_trade_flat', market: 'US', value: usCommissionHigh, currency: 'USD', label: 'Commission', sharePrice: { from: T }, note: tierNote },
        { target: t, type: 'per_trade_flat', market: 'US', value: usCommissionLow, currency: 'USD', label: 'Commission', sharePrice: { below: T }, note: tierNote },
      ];
    return [
      { target: t, type: 'per_trade_pct', market: 'SG', value: sgCommissionPct, currency: 'PCT', label: 'Commission' },
      { target: t, type: 'per_trade_pct', market: 'SG', group: 'platform', value: sgPlatformPct, currency: 'PCT', label: 'Platform fee' },
      ...usCommission,
      { target: t, type: 'per_trade_flat', market: 'US', group: 'platform', value: usPlatformFlat, currency: 'USD', label: 'Platform fee', sharePrice: { from: T }, note: tierNote },
      { target: t, type: 'per_share', market: 'US', group: 'platform', value: usPerShare, currency: 'USD', label: 'Platform fee per share', sharePrice: { below: T }, note: tierNote },
      { target: t, type: 'per_trade_min', market: 'US', group: 'platform', value: usMin, currency: 'USD', label: 'Platform fee minimum', sharePrice: { below: T } },
      { target: t, type: 'per_trade_max_pct', market: 'US', group: 'platform', value: usMaxPct, currency: 'PCT', label: 'Platform fee cap', sharePrice: { below: T } },
    ];
  },
};

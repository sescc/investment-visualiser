// Longbridge SG pricing page (longbridge.com/sg/pricing) is client-rendered
// AND, per DECISIONS.md, its fee widgets first mount showing a placeholder
// "0%" for the Platform Fee rate before a second data fetch fills in the
// real value (confirmed by hand: it flips from "Min. SGD 0.99/Order 0%" to
// "Min. SGD 0.99/Order 0.03%" a moment after the page settles). So this
// adapter's `waitFor` polls until that percentage is non-zero, and the
// scraper throws rather than accepting a literal 0 (per CLAUDE.md: adapters
// must throw, not guess — a still-zero value here means "not hydrated yet",
// not "genuinely free").
//
// Commission is a genuine $0 across SG/HK/US ("Lifetime Free" — like
// moomoo's and Syfe's $0 US commission, this is the site's own current
// headline rate, not something invented). The real per-trade cost is the
// Platform Fee: SG is % of trade value with a minimum; US is per-share with
// a minimum, emitted as per_share + per_trade_min (cost.js models both).
//
// The SG platform-fee % is found by the *shape* of its minimum ("Min. SGD
// <n>/Order"), never a literal amount — a waitFor must not contain a fee value.
function sgPlatformPct(text) {
  const m = text.match(/Min\. SGD \d+(?:\.\d+)?\/Order/);
  if (!m) return null;
  const pct = text.slice(m.index, m.index + 40).match(/(\d+(?:\.\d+)?)%/);
  return pct ? Number(pct[1]) : null;
}

export default {
  id: 'longbridge-sg',
  url: 'https://longbridge.com/sg/pricing',
  format: 'browser',
  waitFor: (text) => {
    const pct = sgPlatformPct(text);
    return pct !== null && pct > 0;
  },
  targets: ['b-custodian-app/longbridge-sg'],
  async scrape({ text, extract }) {
    const sgPct = sgPlatformPct(text);
    if (!(sgPct > 0)) {
      // Belt-and-suspenders: even if index.js's waitFor somehow let this
      // through, never emit the known placeholder value.
      throw new Error('Longbridge SG platform fee still reads 0% — placeholder not replaced by hydration');
    }

    const sgStart = extract.mustFind(text.indexOf('SingaporeIncluding DLCsCommission') >= 0 ? text.indexOf('SingaporeIncluding DLCsCommission') : null, 'Longbridge Singapore fee card');
    const sgSection = text.slice(sgStart, sgStart + 300);
    const sgCommissionMatch = sgSection.match(/Lifetime Free\*\$(\d+(?:\.\d+)?)/);
    const sgCommissionFlat = extract.mustFind(sgCommissionMatch ? Number(sgCommissionMatch[1]) : null, 'Longbridge SG commission');
    const sgMinMatch = sgSection.match(/Platform FeeMin\. SGD (\d+(?:\.\d+)?)\/Order/);
    const sgMin = extract.mustFind(sgMinMatch ? Number(sgMinMatch[1]) : null, 'Longbridge SG platform fee minimum');

    const usStart = extract.mustFind(text.indexOf('United StatesCommission') >= 0 ? text.indexOf('United StatesCommission') : null, 'Longbridge United States fee card');
    const usSection = text.slice(usStart, usStart + 300);
    const usCommissionMatch = usSection.match(/Lifetime Free\*\$(\d+(?:\.\d+)?)/);
    const usCommissionFlat = extract.mustFind(usCommissionMatch ? Number(usCommissionMatch[1]) : null, 'Longbridge US commission');
    const usMinMatch = usSection.match(/Platform FeeMin\. USD (\d+(?:\.\d+)?)\/Order/);
    const usMin = extract.mustFind(usMinMatch ? Number(usMinMatch[1]) : null, 'Longbridge US platform fee minimum');
    const usPerShareMatch = usSection.match(/USD (\d+(?:\.\d+)?)\/Share/);
    const usPerShare = extract.mustFind(usPerShareMatch ? Number(usPerShareMatch[1]) : null, 'Longbridge US platform fee per-share rate');

    const t = 'b-custodian-app/longbridge-sg';
    return [
      { target: t, type: 'per_trade_flat', market: 'SG', value: sgCommissionFlat, currency: 'SGD', label: 'Commission', note: '"Lifetime Free" promotional commission — the site\'s current standard headline rate.' },
      { target: t, type: 'per_trade_pct', market: 'SG', group: 'platform', value: sgPct, currency: 'PCT', label: 'Platform fee' },
      { target: t, type: 'per_trade_min', market: 'SG', group: 'platform', value: sgMin, currency: 'SGD', label: 'Platform fee minimum' },
      { target: t, type: 'per_trade_flat', market: 'US', value: usCommissionFlat, currency: 'USD', label: 'Commission', note: '"Lifetime Free" promotional commission — the site\'s current standard headline rate.' },
      { target: t, type: 'per_share', market: 'US', group: 'platform', value: usPerShare, currency: 'USD', label: 'Platform fee per share' },
      { target: t, type: 'per_trade_min', market: 'US', group: 'platform', value: usMin, currency: 'USD', label: 'Platform fee minimum' },
    ];
  },
};

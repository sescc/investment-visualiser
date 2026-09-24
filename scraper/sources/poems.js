// POEMS (Phillip Securities) — brokerage pricing page. Consolidates the
// separate "poems-funds" fund-platform target into this one adapter since
// both figures (SGX/US/HK commission + unit trust sales charge) live on the
// same page. Uses the Cash Plus account, "Starter" TAV tier (SGD 0-29,999) —
// the standard online cash account, smallest tier — per CLAUDE.md convention.
export default {
  id: 'poems',
  url: 'https://www.poems.com.sg/pricing/',
  format: 'html',
  targets: ['b-cdp-local/poems', 'm-fund-platform/poems-funds'],
  async scrape({ text, extract }) {
    // Anchor on the "Cash Plus Brokerage rate..." intro line above the
    // per-market commission table, then work only within that section —
    // "Singapore"/"US"/"Hong Kong" also appear elsewhere on the page (nav,
    // other product tables) so a whole-document search would hit the wrong one.
    const anchor = extract.mustFind(
      /Cash Plus Brokerage rate is determined[\s\S]{0,900}/.exec(text)?.[0] || null,
      'POEMS Share/ETF commission table section'
    );

    // Singapore: "Singapore 0.08%, No Min Comm 0.07%, No Min Comm 0.06%, No Min Comm ..."
    // — first value is the Cash Plus Starter (smallest TAV) tier; "No Min Comm" = no minimum.
    const sgMatch = extract.mustFind(
      /Singapore\s+([\d.]+)%,\s*No Min Comm/.exec(anchor),
      'POEMS SGX commission % (Cash Plus Starter tier)'
    );
    const sgPct = Number(sgMatch[1]);

    // United States: "US 0 0 0 0.30%, min USD20" — first "0" is Cash Plus
    // Starter/Premier/Privilege tiers (advertised $0 US commission); the
    // trailing 0.30%/min USD20 belongs to the separate Cash Management/Contra tier.
    const usMatch = extract.mustFind(
      /\bUS\s+(\d+(?:\.\d+)?)\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+[\d.]+%,\s*min USD\d+/.exec(anchor),
      'POEMS US commission (Cash Plus Starter tier)'
    );
    const usPct = Number(usMatch[1]);

    // Hong Kong: "Hong Kong 0.08%, min HKD 30 0.06%, min HKD 20 0.05%, min HKD 15 0.25%, min HKD100"
    const hkMatch = extract.mustFind(
      /Hong Kong\s+([\d.]+)%,\s*min HKD\s*(\d+)/.exec(anchor),
      'POEMS HK commission % and minimum (Cash Plus Starter tier)'
    );
    const hkPct = Number(hkMatch[1]);
    const hkMin = Number(hkMatch[2]);

    // Unit trust sales charge — headline banner states "0% Sales Charge on Unit Trusts"
    // for the Cash Plus account, matching the detailed "Unit Trust (UT) ... Sales Charge $0" line.
    const salesChargePct = extract.parsePct(
      extract.mustFind(
        /0%\s*Sales Charge on Unit Trusts/.exec(text)?.[0] || null,
        'POEMS unit trust sales charge %'
      )
    );

    return [
      { target: 'b-cdp-local/poems', type: 'per_trade_pct', market: 'SG', value: sgPct, currency: 'PCT', note: 'Cash Plus account, Starter tier (TAV S$0–29,999), no minimum commission' },
      { target: 'b-cdp-local/poems', type: 'per_trade_min', market: 'SG', value: 0, currency: 'SGD', note: 'No minimum commission on Cash Plus Starter tier' },
      { target: 'b-cdp-local/poems', type: 'per_trade_pct', market: 'US', value: usPct, currency: 'PCT', label: 'Zero-commission US trading', note: 'Cash Plus account, Starter tier' },
      { target: 'b-cdp-local/poems', type: 'per_trade_pct', market: 'HK', value: hkPct, currency: 'PCT', note: 'Cash Plus account, Starter tier' },
      { target: 'b-cdp-local/poems', type: 'per_trade_min', market: 'HK', value: hkMin, currency: 'HKD', note: 'Cash Plus account, Starter tier' },
      { target: 'm-fund-platform/poems-funds', type: 'sales_charge_pct', market: 'ALL', value: salesChargePct, currency: 'PCT', note: 'Unit trusts bought via Cash Plus account' },
    ];
  },
};

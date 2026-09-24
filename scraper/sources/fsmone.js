// FSM Global (FSMOne) fills three targets from the same fee structure — same
// pattern as syfe.js filling two targets from one page. Both the Pricing
// Structure page and the Regular Savings Plan page are client-rendered (raw
// HTML has none of this text), so format: 'browser'. The RSP page needs its
// own render, so this adapter uses `renderPage` from ctx for the second URL
// (same pattern as moomoo-sg.js fetching a second Help Center article, just
// with a headless render instead of a plain GET).
//
// Sales charge: FSM Global's headline "permanent 0% sales charge" (not a
// time-limited promo — it's marketed as permanent, same footing as moomoo's
// "permanent zero commissions").
// Platform fee: quarterly rate for the standard (non-Diamond-tier, non-CPF)
// case, "All other funds" (Alternative/Balanced/Equity) — annualised ×4 to
// match the aum_annual_pct schema. Fixed Income funds' lower quarterly rate
// is kept in `note` (figure copied from the page, not invented), along with
// the CPF/Diamond-tier 0% carve-outs.
// RSP: FSM has waived the ETF RSP buy-order processing fee since 2021
// ("until further notice") — a genuine current $0, not a time-limited promo.
const RSP_URL = 'https://fsm.global/sg/regular-savings-plan';

export default {
  id: 'fsmone',
  url: 'https://fsm.global/sg/pricing-structure',
  format: 'browser',
  waitFor: (text) => /Platform fee/.test(text) && /Sales Charge/.test(text),
  targets: ['b-fund-platform/fsmone-platform', 'm-fund-platform/fsmone', 'm-bank-rsp/fsmone-rsp'],
  async scrape({ text, extract, renderPage }) {
    const salesChargeMatch = text.match(/permanent (\d+(?:\.\d+)?)% sales charge/);
    const salesChargePct = extract.mustFind(salesChargeMatch ? Number(salesChargeMatch[1]) : null, 'FSMOne sales charge %');

    const equityMatch = text.match(/All other funds \(Alternative Investments, Balanced, Equity etc\.\)0% or (\d+(?:\.\d+)?)%per quarterPlatform fee/);
    const equityQuarterlyPct = extract.mustFind(equityMatch ? Number(equityMatch[1]) : null, 'FSMOne platform fee % (all other funds)');
    const equityAnnualPct = Math.round(equityQuarterlyPct * 4 * 1e6) / 1e6;

    const fixedIncomeMatch = text.match(/Fixed Income Funds0% or (\d+(?:\.\d+)?)%per quarterPlatform fee/);
    const fixedIncomeQuarterlyPct = extract.mustFind(fixedIncomeMatch ? Number(fixedIncomeMatch[1]) : null, 'FSMOne platform fee % (fixed income funds)');
    const fixedIncomeAnnualPct = Math.round(fixedIncomeQuarterlyPct * 4 * 1e6) / 1e6;

    const { html: rspHtml } = await renderPage(RSP_URL, { waitFor: (t) => /waived ETF RSP/.test(t) });
    const rspClean = extract.cleanText(extract.load(rspHtml));
    extract.mustFind(/waived ETF RSP Buy Order processing fees/.test(rspClean) ? true : null, 'FSMOne RSP fee-waiver note');

    const platformFeeNote = `Standard (non-Diamond-tier) rate for Cash/SRS holdings; CPF investments and Diamond-tier clients are priced separately (see page). Fixed Income Funds are charged ${fixedIncomeQuarterlyPct}%/quarter (${fixedIncomeAnnualPct}%/year annualised) instead. Annualised from the published ${equityQuarterlyPct}%-per-quarter rate.`;
    const rspNote = 'FSM Global has waived the ETF RSP Buy Order processing fee since 2021, "until further notice" — a standing rate, not a time-limited promo.';

    const components = [];
    for (const target of ['b-fund-platform/fsmone-platform', 'm-fund-platform/fsmone']) {
      components.push(
        { target, type: 'sales_charge_pct', market: 'ALL', value: salesChargePct, currency: 'PCT', note: `Permanent ${salesChargePct}% sales charge on funds.` },
        { target, type: 'aum_annual_pct', market: 'ALL', value: equityAnnualPct, currency: 'PCT', label: 'Platform fee (annualised)', note: platformFeeNote }
      );
    }
    // Read from the RSP page, so it names that page as its source (merge.js keeps it).
    components.push({ target: 'm-bank-rsp/fsmone-rsp', type: 'per_trade_flat', market: 'ALL', value: 0, currency: 'SGD', note: rspNote, source: RSP_URL });

    return components;
  },
};

// Interactive Brokers Singapore commissions page — static, server-rendered
// Bootstrap tabs/tables (verified: real figures are present in the raw HTML,
// not injected by client JS). Uses the "Fixed" pricing plan throughout, per
// task instructions (IBKR Lite/Pro-Tiered are not modelled).
//
// Currency conversion: manual FX trades are charged in basis points with a
// per-conversion minimum, which fx_spread_pct can't express, so that isn't
// stored. The auto currency conversion markup IS published as a plain
// percentage on the spot-currencies page and is stored as fx_spread_pct —
// display-only, never summed (DECISIONS.md §12).
import { getText } from '../lib/http.js';

const FX_URL = 'https://www.interactivebrokers.com.sg/en/pricing/commissions-spot-currencies.php';

export default {
  id: 'interactive-brokers-sg',
  url: 'https://www.interactivebrokers.com.sg/en/pricing/commissions-stocks.php',
  format: 'html',
  targets: ['b-international/interactive-brokers-sg'],
  async scrape({ $, extract }) {
    const sgRows = $('#pills-singapore-sgd table tbody tr');
    extract.mustFind(sgRows.length ? true : null, 'IBKR Singapore (SGD) commission table');

    const sgFirstCols = $(sgRows[0]).find('td').map((_, td) => $(td).text().trim()).get();
    const sgFixedText = extract.mustFind(sgFirstCols[2] || null, 'IBKR SG Fixed plan commission %');
    const sgPct = extract.mustFind(extract.parsePct(sgFixedText), 'IBKR SG Fixed plan commission % (parsed)');

    const sgMinRow = sgRows.filter((_, tr) => $(tr).find('td').first().text().trim() === 'Minimum per order').first();
    extract.mustFind(sgMinRow.length ? true : null, 'IBKR SG minimum-per-order row');
    const sgMinCols = $(sgMinRow[0]).find('td').map((_, td) => $(td).text().trim()).get();
    const sgMinMoney = extract.mustFind(extract.parseMoney(sgMinCols[2] || ''), 'IBKR SG Fixed plan minimum per order');

    const usHeading = $('h3').filter((_, el) => $(el).text().trim() === 'United States').first();
    extract.mustFind(usHeading.length ? true : null, 'IBKR United States heading');
    const usTable = usHeading.nextAll('.table-responsive').first().find('table');
    extract.mustFind(usTable.length ? true : null, 'IBKR United States commission table');
    const usRows = usTable.find('tbody tr');

    const usFirstCols = $(usRows[0]).find('td').map((_, td) => $(td).text().trim()).get();
    const usFixedText = extract.mustFind(usFirstCols[2] || null, 'IBKR US Pro-Fixed per-share commission');
    const usPerShareMatch = usFixedText.match(/USD\s*([\d.]+)/);
    const usPerShare = extract.mustFind(usPerShareMatch ? Number(usPerShareMatch[1]) : null, 'IBKR US per-share commission (parsed)');

    const usMinRow = usRows.filter((_, tr) => $(tr).find('td').first().text().trim().startsWith('Minimum per order')).first();
    extract.mustFind(usMinRow.length ? true : null, 'IBKR US minimum-per-order row');
    const usMinCols = $(usMinRow[0]).find('td').map((_, td) => $(td).text().trim()).get();
    const usMinMoney = extract.mustFind(extract.parseMoney(usMinCols[2] || ''), 'IBKR US Pro-Fixed minimum per order');

    const usMaxRow = usRows.filter((_, tr) => $(tr).find('td').first().text().trim().startsWith('Maximum per order')).first();
    extract.mustFind(usMaxRow.length ? true : null, 'IBKR US maximum-per-order row');
    const usMaxCols = $(usMaxRow[0]).find('td').map((_, td) => $(td).text().trim()).get();
    const usMaxPct = extract.mustFind(extract.parsePct(usMaxCols[2] || ''), 'IBKR US Pro-Fixed maximum % of trade value');

    const fxText = extract.cleanText(extract.load(await getText(FX_URL)));
    const fxMatch = fxText.match(/auto currency conversion service, IB will typically add or subtract \(at its discretion\) (\d+(?:\.\d+)?)% to the exchange rate/);
    const fxPct = extract.mustFind(fxMatch ? Number(fxMatch[1]) : null, 'IBKR auto currency conversion markup %');

    return [
      {
        target: 'b-international/interactive-brokers-sg', type: 'fx_spread_pct', market: 'ALL',
        value: fxPct, currency: 'PCT', label: 'Auto currency conversion markup', source: FX_URL,
        note: 'Typical markup IBKR adds to the rate for automatic conversions. Converting manually instead is priced per trade with a minimum (see page). Shown for information; not included in cost totals.',
      },
      {
        target: 'b-international/interactive-brokers-sg', type: 'per_trade_pct', market: 'SG',
        value: sgPct, currency: 'PCT',
        note: 'IBKR Pro Fixed pricing plan (not Tiered, not IBKR Lite).',
      },
      {
        target: 'b-international/interactive-brokers-sg', type: 'per_trade_min', market: 'SG',
        value: sgMinMoney.value, currency: sgMinMoney.currency,
      },
      {
        target: 'b-international/interactive-brokers-sg', type: 'per_share', market: 'US',
        value: usPerShare, currency: 'USD', label: 'Commission per share', note: 'IBKR Pro Fixed pricing plan.',
      },
      {
        target: 'b-international/interactive-brokers-sg', type: 'per_trade_min', market: 'US',
        value: usMinMoney.value, currency: usMinMoney.currency, label: 'Minimum per order',
      },
      {
        target: 'b-international/interactive-brokers-sg', type: 'per_trade_max_pct', market: 'US',
        value: usMaxPct, currency: 'PCT', label: 'Maximum per order (% of trade value)',
      },
    ];
  },
};

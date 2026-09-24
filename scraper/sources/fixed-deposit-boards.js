// MAS's fixed-deposit interest rate series was discontinued in June 2021
// (see DECISIONS.md §5) so, per this session's brief, this adapter instead
// scrapes the published standard/board 12-month SGD fixed deposit rate
// (never the promotional rate) directly from DBS, OCBC and UOB's own rate
// pages — one component per bank, all server-rendered plain HTML.
//
// Each bank publishes rates in tiers by deposit size; the smallest/entry
// tier is used as "the" board rate (same convention as picking a broker's
// base/entry commission tier elsewhere in this scraper).
//
// DBS: cheerio's parser desyncs partway through this specific page (a known
// quirk — before verifying, the raw HTML was checked to confirm the real
// <td> markup is there; cheerio's cleaned text ends up containing literal
// "<td...>" characters instead of stripping them). Since index.js's `text`
// context is built the exact same way for every adapter, matching that
// literal tag text is what's actually reliable here — not a hack layered on
// top of a different code path.
const DBS_URL = 'https://www.dbs.com.sg/personal/rates-online/fixed-deposit-rate-singapore-dollar.page';
const OCBC_URL = 'https://www.ocbc.com/personal-banking/deposits/fixed-deposit-sgd-interest-rates.page';
const UOB_URL = 'https://www.uob.com.sg/personal/online-rates/singapore-dollar-time-fixed-deposit-rates.page';

import { getText } from '../lib/http.js';

export default {
  id: 'fixed-deposit-boards',
  url: DBS_URL,
  format: 'html',
  targets: ['p-fixed-deposit'],
  async scrape({ text, extract }) {
    // --- DBS: New Placements board-rate table, 12 mths row, smallest ($1,000-$9,999) tier ---
    const dbsMatch = text.match(/12 mths<\/td>\s*<td[^>]*>(\d+(?:\.\d+)?)</);
    const dbsPct = extract.mustFind(dbsMatch ? Number(dbsMatch[1]) : null, 'DBS 12-month board rate (New Placements table)');

    // --- OCBC: SGD Time Deposit board-rate table, 12-month row, S$5,000-S$20,000 tier ---
    const ocbcHtml = await getText(OCBC_URL);
    const ocbcText = extract.cleanText(extract.load(ocbcHtml));
    const ocbcMatch = ocbcText.match(/10 - 11 [\d.]+% [\d.]+% [\d.]+% [\d.]+% [\d.]+% [\d.]+% 12 (\d+(?:\.\d+)?)%/);
    const ocbcPct = extract.mustFind(ocbcMatch ? Number(ocbcMatch[1]) : null, 'OCBC 12-month board rate (SGD Time Deposit table)');

    // --- UOB: "Board Rates" table (explicitly separate from the Promotion
    // section above it on the same page), 12-month row, "Below S$50,000" tier ---
    const uobHtml = await getText(UOB_URL);
    const uobText = extract.cleanText(extract.load(uobHtml));
    const boardStart = uobText.indexOf('Board Rates');
    extract.mustFind(boardStart >= 0 ? true : null, 'UOB Board Rates section (distinct from the Promotion table above it)');
    const uobBoardSlice = uobText.slice(boardStart, boardStart + 1500);
    const uobMatch = uobBoardSlice.match(/11-month [\d.]+ [\d.]+ [\d.]+ [\d.]+ 12-month (\d+(?:\.\d+)?)/);
    const uobPct = extract.mustFind(uobMatch ? Number(uobMatch[1]) : null, 'UOB 12-month board rate (Board Rates table)');

    const t = 'p-fixed-deposit';
    const tierNote = 'Board (non-promotional) rate, entry/smallest deposit tier — larger placements may get a different rate (see page).';
    // Each rate names its own bank's page as `source` (merge.js keeps it).
    return [
      { target: t, type: 'yield_pct', market: 'SG', value: dbsPct, currency: 'PCT', label: 'DBS 12-month board rate', note: `${tierNote} S$1,000-S$9,999 tier.`, source: DBS_URL },
      { target: t, type: 'yield_pct', market: 'SG', value: ocbcPct, currency: 'PCT', label: 'OCBC 12-month board rate', note: `${tierNote} S$5,000-S$20,000 tier.`, source: OCBC_URL },
      { target: t, type: 'yield_pct', market: 'SG', value: uobPct, currency: 'PCT', label: 'UOB 12-month board rate', note: `${tierNote} Below S$50,000 tier.`, source: UOB_URL },
    ];
  },
};

// Saxo Markets Singapore's stock commissions page (client-rendered — the raw
// HTML has none of this text). Three account tiers (Classic/Platinum/VIP);
// per CLAUDE.md/DECISIONS.md convention of always using the standard
// (entry-level) rate, this uses Classic — the first percentage shown for
// each exchange.
//
// Currency conversion: Saxo SG's help centre states the conversion fee built
// into its FX rate as a plain percentage (server-rendered). Stored as
// fx_spread_pct — display-only, never summed (DECISIONS.md §12).
import { getText } from '../lib/http.js';

const FX_URL = 'https://www.help.saxo/hc/en-sg/articles/360019476437-What-are-the-currency-conversion-fees-for-account-transfers';

export default {
  id: 'saxo-markets-sg',
  url: 'https://www.home.saxo/en-sg/rates-and-conditions/stocks/commissions',
  format: 'browser',
  // Wait until BOTH rows the scraper reads have rendered — the Asia/Pacific (SGX) table can hydrate after the
  // America one. innerText is tab/newline-separated, so normalise whitespace; match by shape, never by a rate.
  waitFor: (text) => {
    const t = text.replace(/\s+/g, ' ');
    return /Singapore Exchange \d+(?:\.\d+)?% \(min\. [\d.]+ SGD\)/.test(t) && /NASDAQ \d+(?:\.\d+)?% \(min\. [\d.]+ USD\)/.test(t);
  },
  targets: ['b-international/saxo-markets-sg'],
  async scrape({ text, extract }) {
    const sgStart = text.indexOf('Exchange - Asia / Pacific');
    extract.mustFind(sgStart >= 0 ? true : null, 'Saxo Asia/Pacific exchange section');
    const sgSlice = text.slice(sgStart, sgStart + 250);
    const sgMatch = sgSlice.match(/Singapore Exchange (\d+(?:\.\d+)?)% \(min\. (\d+(?:\.\d+)?) SGD\)/);
    extract.mustFind(sgMatch, 'Saxo SGX Classic tier commission');
    const sgPct = Number(sgMatch[1]);
    const sgMin = Number(sgMatch[2]);

    const usStart = text.indexOf('Exchange - America');
    extract.mustFind(usStart >= 0 ? true : null, 'Saxo America exchange section');
    const usSlice = text.slice(usStart, usStart + 250);
    const usMatch = usSlice.match(/NASDAQ (\d+(?:\.\d+)?)% \(min\. (\d+(?:\.\d+)?) USD\)/);
    extract.mustFind(usMatch, 'Saxo NASDAQ Classic tier commission');
    const usPct = Number(usMatch[1]);
    const usMin = Number(usMatch[2]);

    const fxText = extract.cleanText(extract.load(await getText(FX_URL)));
    const fxMatch = fxText.match(/A (\d+(?:\.\d+)?)% conversion fee is included in the conversion rate/);
    const fxPct = extract.mustFind(fxMatch ? Number(fxMatch[1]) : null, 'Saxo SG currency conversion fee %');

    const t = 'b-international/saxo-markets-sg';
    const note = 'Classic (standard/entry) tier rate; Platinum and VIP tiers get lower rates at higher trading volumes (see page).';
    return [
      {
        target: t, type: 'fx_spread_pct', market: 'ALL', value: fxPct, currency: 'PCT', label: 'Currency conversion fee', source: FX_URL,
        note: 'Built into Saxo\'s conversion rate when converting between currency sub-accounts. Shown for information; not included in cost totals.',
      },
      { target: t, type: 'per_trade_pct', market: 'SG', value: sgPct, currency: 'PCT', note },
      { target: t, type: 'per_trade_min', market: 'SG', value: sgMin, currency: 'SGD' },
      { target: t, type: 'per_trade_pct', market: 'US', value: usPct, currency: 'PCT', note },
      { target: t, type: 'per_trade_min', market: 'US', value: usMin, currency: 'USD' },
    ];
  },
};

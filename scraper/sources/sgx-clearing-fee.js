// SGX clearing fee and SGX trading fee for SGX-listed securities (stocks, ETFs,
// REITs, bonds). sgx.com itself never renders for automated browsers (see
// DECISIONS.md §9) and the CDP Clearing Rules only point to "CDP's fee schedules",
// so these exchange pass-through fees are read from brokers' own published fee
// schedules instead — and only accepted when two independent brokers agree.
// Each figure names the page it was read from (`source`); a mismatch, or a
// page that can't be read, fails the adapter rather than picking one.
//
// Display-only on the product entries: these fees are identical at every
// broker, so they are never added to broker totals (see COST_GROUPS caveat).
// Structured warrants / DLCs / money-market ETFs have different rates on the
// same pages; the patterns below anchor on the standard-securities rows.
import { getText } from '../lib/http.js';

const MOOMOO_URL = 'https://www.moomoo.com/sg/support/topic5_118';
const MAYBANK_URL = 'https://www.maybank.com/investment-banking/sg/help_centre/pricing/stocks.page';
const PCT = '(\\d+(?:\\.\\d+)?)%';

// moomoo SG Help Centre, section "1. Singapore Stocks, ETFs and REITs" → "1.3 Other Fees":
// "Trading Fees SGD <x>% * Transaction amount SGX Clearing Fees SGD <y>% * Transaction amount SGX"
function fromMoomoo(text, extract) {
  const start = text.indexOf('1. Singapore Stocks, ETFs and REITs');
  const end = text.indexOf('2. Singapore Daily Leverage Certificates');
  extract.mustFind(start >= 0 && end > start ? true : null, 'moomoo SG stocks fee section');
  const section = text.slice(start, end);
  const trading = section.match(new RegExp(`Trading Fees SGD ${PCT} \\* Transaction amount SGX`));
  const clearing = section.match(new RegExp(`Clearing Fees SGD ${PCT} \\* Transaction amount SGX`));
  return {
    trading: extract.mustFind(trading ? Number(trading[1]) : null, 'moomoo SGX trading fee %'),
    clearing: extract.mustFind(clearing ? Number(clearing[1]) : null, 'moomoo SGX clearing fee %'),
  };
}

// Maybank Securities SG: "Other Fees for Trades done in Singapore market … SGX Clearing Fee <y>%^ on
// contract value SGX Trading Fee <x>%^ on contract value"
function fromMaybank(text, extract) {
  const start = text.indexOf('Other Fees for Trades done in Singapore market');
  extract.mustFind(start >= 0 ? true : null, 'Maybank "Other Fees for Trades done in Singapore market" table');
  const section = text.slice(start, start + 400);
  const clearing = section.match(new RegExp(`SGX Clearing Fee ${PCT}\\^? on contract value`));
  const trading = section.match(new RegExp(`SGX Trading Fee ${PCT}\\^? on contract value`));
  return {
    trading: extract.mustFind(trading ? Number(trading[1]) : null, 'Maybank SGX trading fee %'),
    clearing: extract.mustFind(clearing ? Number(clearing[1]) : null, 'Maybank SGX clearing fee %'),
  };
}

export default {
  id: 'sgx-clearing-fee',
  url: MOOMOO_URL,
  format: 'html',
  targets: ['p-sgx-stocks', 'p-corp-bond'],
  async scrape({ text, extract }) {
    const a = fromMoomoo(text, extract);
    const b = fromMaybank(extract.cleanText(extract.load(await getText(MAYBANK_URL))), extract);
    if (a.clearing !== b.clearing || a.trading !== b.trading) {
      throw new Error(`broker pages disagree on SGX fees: moomoo clearing ${a.clearing}% / trading ${a.trading}%, Maybank clearing ${b.clearing}% / trading ${b.trading}%`);
    }
    const note = 'Charged by SGX on every trade of SGX-listed securities, passed on at cost by all brokers (GST may apply). Read from moomoo SG\'s fee schedule and cross-checked against Maybank Securities\' — both must agree. Structured warrants/DLCs differ.';
    const out = [];
    for (const target of ['p-sgx-stocks', 'p-corp-bond']) {
      out.push(
        { target, type: 'per_trade_pct', market: 'SG', group: 'exchange', value: a.clearing, currency: 'PCT', label: 'SGX clearing fee', note, source: MOOMOO_URL },
        { target, type: 'per_trade_pct', market: 'SG', group: 'exchange', value: a.trading, currency: 'PCT', label: 'SGX trading fee', note, source: MOOMOO_URL },
      );
    }
    return out;
  },
};

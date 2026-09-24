// MAS's "How to buy" page for Singapore Savings Bonds states a flat,
// non-refundable transaction fee charged by the bank for each application
// (ATM cash applications and SRS internet-banking applications alike). The
// page doesn't differentiate the fee by bank, so the same figure fills the
// SSB product-level fee and all three bank "how to buy" providers
// (DBS/POSB, OCBC, UOB) under m-atm-internet-banking.
const PAGE_URL = 'https://www.mas.gov.sg/bonds-and-bills/investing-in-singapore-savings-bonds/how-to-buy';

const TARGETS = [
  'p-ssb',
  'm-atm-internet-banking/dbs',
  'm-atm-internet-banking/ocbc',
  'm-atm-internet-banking/uob',
];

export default {
  id: 'mas-ssb-fee',
  url: PAGE_URL,
  format: 'html',
  targets: TARGETS,
  async scrape({ text, extract }) {
    const m = /Fees\s*\$(\d+(?:\.\d+)?)\s*non-refundable transaction fee/i.exec(text);
    extract.mustFind(m, 'SSB non-refundable transaction fee on MAS how-to-buy page');
    const value = Number(m[1]);

    const label = 'Non-refundable transaction fee per SSB application (ATM or internet banking)';
    return TARGETS.map((target) => ({
      target,
      type: 'transaction_flat',
      market: 'SG',
      value,
      currency: 'SGD',
      label,
    }));
  },
};

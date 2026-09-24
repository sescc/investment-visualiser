// Phillip Share Builders Plan (SBP) — monthly handling fee. The dedicated SBP
// landing page only gives a worked example ("a portfolio value of S$1,000
// incurs a handling fee of S$1 per month"); the clean rate + min/cap figures
// are on the main POEMS pricing page's "RSP & SBP" row, so this adapter reads
// that page instead (same publisher, same account/plan).
export default {
  id: 'phillip-sbp',
  url: 'https://www.poems.com.sg/pricing/',
  format: 'html',
  targets: ['m-bank-rsp/phillip-sbp'],
  async scrape({ text, extract }) {
    // "SBP *Month Handling Fees (NEW!) 0.3% per annum of Total Portfolio Value
    // ("TPV") Min. S$1 per month TPV < S$40,000 Capped at S$8.88 per month
    // TPV ≥ S$40,000 Capped at S$5.88 per month"
    const match = extract.mustFind(
      /SBP[\s\S]{0,40}Handling Fees[\s\S]{0,40}?([\d.]+)%\s*per annum of Total Portfolio Value[\s\S]{0,40}?Min\.\s*S\$(\d+(?:\.\d+)?)\s*per month[\s\S]{0,60}?Capped at S\$(\d+(?:\.\d+)?)\s*per month/.exec(text),
      'POEMS Share Builders Plan monthly handling fee rate, minimum and cap'
    );
    const ratePct = Number(match[1]);
    const minMonthly = Number(match[2]);

    // Balance-dependent caps: "TPV < S$40,000 Capped at S$8.88 per month TPV ≥ S$40,000 Capped at S$5.88 per month"
    const window = text.slice(match.index, match.index + match[0].length + 200);
    const bands = [...window.matchAll(/TPV\s*(<|≥|>=)\s*S\$([\d,]+)\s*Capped at S\$(\d+(?:\.\d+)?)\s*per month/g)];
    const below = bands.find(b => b[1] === '<');
    const above = bands.find(b => b[1] !== '<');
    extract.mustFind(below && above ? true : null, 'POEMS SBP cap bands (below/above threshold)');
    const threshold = Number(below[2].replace(/,/g, ''));
    const monthlyCaps = [{ upTo: threshold, cap: Number(below[3]) }, { upTo: null, cap: Number(above[3]) }];

    return [
      {
        target: 'm-bank-rsp/phillip-sbp',
        type: 'aum_annual_pct',
        market: 'SG',
        value: ratePct,
        currency: 'PCT',
        minMonthly,
        monthlyCaps,
        label: 'SBP monthly handling fee',
        note: `${ratePct}% p.a. of Total Portfolio Value, min S$${minMonthly}/month; capped at S$${below[3]}/month below S$${below[2]} and S$${above[3]}/month from S$${above[2]}.`,
      },
    ];
  },
};

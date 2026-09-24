// CGS International Securities (CGS iTrade) — Charges & Settlement FAQ
// article. Fetches fine with the scraper's standard Chrome UA (the earlier
// 403 report was likely from a bare/no-UA request). Uses the "Online/Mobile
// CDP Linked" column (standard CDP-linked online account), not "Online Via
// TRS" (phone/remisier), "CDP Sub Account", "CUT" or "iCash" (custodian
// products), smallest SGX contract-value tier.
export default {
  id: 'cgs-international',
  url: 'https://itrade.cgsi.com.sg/app/help.client.services.z?cat=01&subcat=01_05',
  format: 'html',
  targets: ['b-cdp-local/cgs-international'],
  async scrape({ text, extract }) {
    // "Online Via TRS Online/Mobile CDP Linked CDP Sub Account CUT * iCash
    // Contract Value Up to SGD50,000 0.50% 0.275% 0.18% 0.18% 0.18% ...
    // Minimum Commission SGD40 SGD25 SGD18 SGD18 SGD18"
    const match = extract.mustFind(
      /Contract Value Up to SGD50,000\s*[\d.]+%\s*([\d.]+)%\s*[\d.]+%\s*[\d.]+%\s*[\d.]+%[\s\S]{0,80}?Minimum Commission\s*SGD\d+\s*SGD(\d+)/.exec(text),
      'CGS iTrade SGX Online/Mobile CDP Linked commission rate and minimum (smallest tier)'
    );
    return [
      { target: 'b-cdp-local/cgs-international', type: 'per_trade_pct', market: 'SG', value: Number(match[1]), currency: 'PCT', note: 'Online/Mobile, CDP Linked account, contract value up to SGD50,000' },
      { target: 'b-cdp-local/cgs-international', type: 'per_trade_min', market: 'SG', value: Number(match[2]), currency: 'SGD' },
    ];
  },
};

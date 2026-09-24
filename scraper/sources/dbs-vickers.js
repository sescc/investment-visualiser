// DBS Vickers — Individual Account full pricing guide. This page's CMS field
// stores its rate tables as HTML-entity-escaped markup inside the document,
// so cheerio's plain-text extraction (which decodes entities) yields the
// table's tags and cell text verbatim — regexes below match that literal
// "<td>...</td>" text rather than real DOM structure.
// Consolidates the bank-integrated "dbs-vickers-digibank" SG target here since
// digibank access uses the same commission schedule as the standalone account.
export default {
  id: 'dbs-vickers',
  url: 'https://www.dbsvickers.com/vickers/pricing/individualaccount-fullpricing',
  format: 'html',
  targets: ['b-cdp-local/dbs-vickers', 'b-bank-integrated/dbs-vickers-digibank'],
  async scrape({ text, extract }) {
    function section(label, chars = 1600) {
      const i = text.indexOf(label);
      extract.mustFind(i >= 0 ? label : null, `DBS Vickers "${label}" pricing section`);
      return text.slice(i, i + chars);
    }

    // Standard online Cash account rate is flat regardless of tier (unlike
    // the tiered Phone rate) — read it off the "Above X - Y" middle row,
    // which is where the flat Online/Cash-Upfront columns are populated.
    const sgd = section('(Share trading in SGD)');
    const sgdMin = extract.mustFind(
      /Minimum Commission:<\/td><td>SGD[\d.]+<br\/>\(inclusive of GST\)<\/td><td>SGD([\d.]+)<br\/>\(inclusive of GST\)<\/td>/.exec(sgd),
      'DBS Vickers SGD online cash minimum commission'
    );
    const sgdRate = extract.mustFind(
      /Above SGD50,000 - SGD100,000:<\/td><td[^>]*>[\d.]+%<\/td><td[^>]*>([\d.]+)%<\/td>/.exec(sgd),
      'DBS Vickers SGD online cash commission rate'
    );

    const usd = section('(Shares trading in USD)');
    const usdMin = extract.mustFind(
      /Minimum Commission:<\/td><td>USD[\d.]+<br\/>\(inclusive of GST\)<\/td><td>USD([\d.]+)<br\/>\(inclusive of GST\)<\/td>/.exec(usd),
      'DBS Vickers USD online cash minimum commission'
    );
    const usdRate = extract.mustFind(
      /Above USD30,000 - USD60,000:<\/td><td[^>]*>[\d.]+%<\/td><td[^>]*>([\d.]+)%<\/td>/.exec(usd),
      'DBS Vickers USD online cash commission rate'
    );

    const components = [];
    for (const target of ['b-cdp-local/dbs-vickers', 'b-bank-integrated/dbs-vickers-digibank']) {
      components.push(
        { target, type: 'per_trade_pct', market: 'SG', value: Number(sgdRate[1]), currency: 'PCT', note: 'Online Cash account, flat rate (not Cash Upfront)' },
        { target, type: 'per_trade_min', market: 'SG', value: Number(sgdMin[1]), currency: 'SGD', note: 'Online Cash account minimum commission, incl. GST' }
      );
    }
    // US market only applies to the standalone CDP-linked account target.
    components.push(
      { target: 'b-cdp-local/dbs-vickers', type: 'per_trade_pct', market: 'US', value: Number(usdRate[1]), currency: 'PCT', note: 'Online Cash account, flat rate (not Cash Upfront)' },
      { target: 'b-cdp-local/dbs-vickers', type: 'per_trade_min', market: 'US', value: Number(usdMin[1]), currency: 'USD', note: 'Online Cash account minimum commission, incl. GST' }
    );

    return components;
  },
};

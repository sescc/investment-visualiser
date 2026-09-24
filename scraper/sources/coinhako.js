// Coinhako's help-center fees article is served by a Zoho Desk help portal
// that renders client-side (the article page itself returns an empty React
// shell). The portal's own public content API — discovered by inspecting
// the page's network requests — returns the article body (as HTML in an
// `answer` field) as JSON with no auth needed, so this adapter fetches that
// API directly while keeping `url` pointing at the human-facing article page.
//
// This one adapter fills two different targets/specs that both cite the
// same article: the product-level p-crypto per_trade_pct fee, and the
// broker-level b-crypto-exchange/coinhako 'other' fee (the brokers agent's
// coinhako adapter id was consolidated into this file per the task split).
import { getJSON } from '../lib/http.js';

const PAGE_URL = 'https://help.coinhako.com/portal/en/kb/articles/coinhako-fees';
const API_URL =
  'https://help.coinhako.com/portal/api/kbArticles/articleByPermalink?portalId=edbsn61790d0f4571a6580349ae3ae698be8b05368eff5eac69ddf6a3a55eb224e988&permalink=coinhako-fees&locale=en';

export default {
  id: 'coinhako',
  url: PAGE_URL,
  format: 'html',
  targets: ['p-crypto', 'b-crypto-exchange/coinhako'],
  async scrape({ extract }) {
    const json = await getJSON(API_URL);
    const answer = json && json.answer;
    extract.mustFind(typeof answer === 'string' && answer ? answer : null, 'Coinhako fees article body');

    const $ = extract.load(answer);
    let spotTradeFee = null;
    $('table tr').each((_, tr) => {
      const $tds = $(tr).find('td');
      if ($tds.length < 2) return;
      const label = $tds.eq(0).text().trim();
      if (/Spot trade \(SGD\/USD\) with Coinhako wallet/i.test(label)) {
        spotTradeFee = extract.parsePct($tds.eq(1).text());
      }
    });
    extract.mustFind(spotTradeFee, 'Coinhako spot trade (SGD/USD) fee percentage');

    return [
      {
        target: 'p-crypto',
        type: 'per_trade_pct',
        market: 'ALL',
        value: spotTradeFee,
        currency: 'PCT',
        label: 'Coinhako spot trade fee (SGD/USD, Coinhako wallet)',
      },
      {
        target: 'b-crypto-exchange/coinhako',
        type: 'other',
        market: 'SG',
        value: spotTradeFee,
        currency: 'PCT',
        label: 'Trading fee',
      },
    ];
  },
};

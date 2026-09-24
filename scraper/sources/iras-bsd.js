// IRAS's Buyer's Stamp Duty (BSD) page lists several rate tables (one per
// effective-date regime). This adapter finds the table captioned "On or
// after <date>" (the current regime) and emits one 'other' component per
// residential-property marginal band, with labels built from the band text
// read off the page (e.g. "First $180,000").
const PAGE_URL =
  "https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/buyer's-stamp-duty-(bsd)";

export default {
  id: 'iras-bsd',
  url: PAGE_URL,
  format: 'html',
  targets: ['p-property'],
  async scrape({ $, extract }) {
    let $table = null;
    let caption = null;
    $('table').each((_, el) => {
      const capText = $(el).find('thead strong').first().text().trim();
      if (/^On or after/i.test(capText)) {
        $table = $(el);
        caption = capText;
      }
    });
    extract.mustFind($table, 'IRAS current BSD rates table ("On or after ...")');

    const bands = [];
    $table.find('tbody tr').each((_, tr) => {
      const $tds = $(tr).find('td');
      if ($tds.length < 2) return;
      const bandLabel = $tds.eq(0).text().trim();
      const rateText = $tds.eq(1).text().trim();
      const rate = extract.parsePct(rateText);
      if (bandLabel && rate !== null) bands.push({ bandLabel, rate });
    });
    extract.mustFind(bands.length ? true : null, 'IRAS BSD residential marginal rate bands');

    return bands.map(({ bandLabel, rate }) => ({
      target: 'p-property',
      type: 'other',
      market: 'SG',
      value: rate,
      currency: 'PCT',
      label: `BSD (residential) on ${bandLabel} (${caption})`,
    }));
  },
};

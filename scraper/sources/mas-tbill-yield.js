// MAS's classic "SGS Auction Result for T-Bills" eService
// (eservices.mas.gov.sg/statistics/fdanet/TreasuryBillAuctions.aspx) is a
// server-rendered ASP.NET WebForms page: the auction-result grid only
// appears after the "Display" button's postback, same pattern as mas-fx.js.
// This POSTs back filtered to 6-month (182-day) T-bills, searching by issue
// date across the current and previous year (so a query run early in
// January still finds the most recent completed auction), then walks the
// results grid backwards for the last row with a non-zero cut-off yield —
// the newest results row is often a just-announced, not-yet-auctioned
// placeholder with all-zero figures.
import { postForm } from '../lib/http.js';

const PAGE_URL = 'https://eservices.mas.gov.sg/statistics/fdanet/TreasuryBillAuctions.aspx';

export default {
  id: 'mas-tbill-yield',
  url: PAGE_URL,
  format: 'html',
  targets: ['p-tbill'],
  async scrape({ $, extract }) {
    const hidden = (id) => $(`#${id}`).attr('value') || '';
    const viewState = extract.mustFind(hidden('__VIEWSTATE') || null, 'MAS T-bill auctions __VIEWSTATE token');
    const viewStateGenerator = hidden('__VIEWSTATEGENERATOR');
    const eventValidation = hidden('__EVENTVALIDATION');

    const now = new Date();
    const year = String(now.getFullYear());
    const prevYear = String(now.getFullYear() - 1);

    const fields = {
      __EVENTTARGET: '',
      __EVENTARGUMENT: '',
      __VIEWSTATE: viewState,
      __VIEWSTATEGENERATOR: viewStateGenerator,
      __EVENTVALIDATION: eventValidation,
      'ctl00$ContentPlaceHolder1$SearchBy': 'IssueDateRadioButton',
      'ctl00$ContentPlaceHolder1$StartYearDropDownList': prevYear,
      'ctl00$ContentPlaceHolder1$EndYearDropDownList': year,
      'ctl00$ContentPlaceHolder1$StartMonthDropDownList': '1',
      'ctl00$ContentPlaceHolder1$EndMonthDropDownList': '12',
      'ctl00$ContentPlaceHolder1$TermToMaturityAtAuctionDropDownList': '6', // 6 months
      'ctl00$ContentPlaceHolder1$IssueCodeTextBox': '',
      'ctl00$ContentPlaceHolder1$DisplayButton': 'Display',
    };
    for (let i = 0; i <= 14; i++) fields[`ctl00$ContentPlaceHolder1$SelectedColumnsCheckBoxList$${i}`] = 'on';

    const html = await postForm(PAGE_URL, fields);
    const $$ = extract.load(html);

    // Columns (15, all checked): IssueCode, ISIN, Term(Days), AuctionAmt,
    // AuctionDate, IssueDate, MaturityDate, AmtApplied, BidToCover,
    // CutoffYield, CutoffPrice, MedianYield, MedianPrice, AvgYield, AvgPrice.
    const $rows = $$('#ContentPlaceHolder1_TreasuryBillAuctionsGridView tbody tr');
    extract.mustFind($rows.length ? true : null, '6-month T-bill auction results grid');

    let latest = null;
    $rows.each((_, tr) => {
      const $tds = $$(tr).find('td');
      const issueCode = $tds.eq(0).text().trim();
      const auctionDate = $tds.eq(4).text().trim();
      const issueDate = $tds.eq(5).text().trim();
      const cutoffYield = extract.parsePct($tds.eq(9).text() + '%');
      if (issueCode && cutoffYield !== null && cutoffYield > 0) {
        latest = { issueCode, auctionDate, issueDate, cutoffYield };
      }
    });

    extract.mustFind(latest, 'latest completed 6-month T-bill auction with a cut-off yield');

    return [
      {
        target: 'p-tbill',
        type: 'yield_pct',
        market: 'SG',
        value: latest.cutoffYield,
        currency: 'PCT',
        label: `6-month T-bill cut-off yield, ${latest.issueCode} (auction ${latest.auctionDate})`,
      },
    ];
  },
};

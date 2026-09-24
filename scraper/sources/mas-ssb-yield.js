// MAS's classic "SSB Interest Rates" eService (eservices.mas.gov.sg/statistics/fdanet/StepUpInterest.aspx)
// is a server-rendered ASP.NET WebForms page: the per-issue interest-rate
// tables only appear after the "Display" button's postback, same pattern as
// mas-fx.js. This POSTs back with the current year and "ALL" months selected,
// then reads the LAST issue block on the page (issues are listed in
// chronological order, so the last one is the most recently published issue,
// which may already be announced ahead of its actual issue date).
import { postForm } from '../lib/http.js';

const PAGE_URL = 'https://eservices.mas.gov.sg/statistics/fdanet/StepUpInterest.aspx';

export default {
  id: 'mas-ssb-yield',
  url: PAGE_URL,
  format: 'html',
  targets: ['p-ssb'],
  async scrape({ $, extract }) {
    const hidden = (id) => $(`#${id}`).attr('value') || '';
    const viewState = extract.mustFind(hidden('__VIEWSTATE') || null, 'MAS SSB Interest Rates __VIEWSTATE token');
    const viewStateGenerator = hidden('__VIEWSTATEGENERATOR');
    const eventValidation = hidden('__EVENTVALIDATION');

    const year = String(new Date().getFullYear());

    const body = {
      __EVENTTARGET: '',
      __EVENTARGUMENT: '',
      __VIEWSTATE: viewState,
      __VIEWSTATEGENERATOR: viewStateGenerator,
      __EVENTVALIDATION: eventValidation,
      'ctl00$ContentPlaceHolder1$StartYearDropDownList': year,
      'ctl00$ContentPlaceHolder1$StartMonthDropDownList': '13', // "ALL"
      'ctl00$ContentPlaceHolder1$IssueCodeTextBox': '',
      'ctl00$ContentPlaceHolder1$DisplayButton': 'Display',
    };

    const html = await postForm(PAGE_URL, body);
    const $$ = extract.load(html);

    const $rateTable = $$('table.setupInterest-table').last();
    extract.mustFind($rateTable.length ? $rateTable : null, 'SSB step-up interest rate table');

    const $infoTable = $rateTable.prev('table');
    const issueCode = $infoTable.find('td.staticLable').first().text().trim();
    const issueDate = $infoTable.find('td.staticLable').eq(2).text().trim();
    extract.mustFind(issueCode || null, 'SSB issue code for latest published issue');

    const $rows = $rateTable.find('tbody tr');
    const $year1to10 = $rows.eq(0).find('td.setupIntersetDataRow');
    const $avgReturn = $rows.eq(1).find('td.year');
    extract.mustFind($avgReturn.length === 10 ? true : null, 'SSB average p.a. return row (10 years)');

    const year1Rate = extract.mustFind(extract.parsePct($year1to10.eq(0).text()), 'SSB year-1 interest rate');
    const avg10y = extract.mustFind(extract.parsePct($avgReturn.eq(9).text()), 'SSB 10-year average p.a. return');

    return [
      {
        target: 'p-ssb',
        type: 'yield_pct',
        market: 'SG',
        value: avg10y,
        currency: 'PCT',
        label: `10-year average p.a. return, SSB ${issueCode} (issue date ${issueDate})`,
      },
      {
        target: 'p-ssb',
        type: 'yield_pct',
        market: 'SG',
        value: year1Rate,
        currency: 'PCT',
        label: `Year 1 interest rate, SSB ${issueCode} (issue date ${issueDate})`,
      },
    ];
  },
};

// USD/SGD reference rate from MAS's official "Exchange Rates" eService.
//
// Investigated eservices.mas.gov.sg/statistics/api/v1/... directly: the only
// working collection there is bondsandbills (e.g. .../bondsandbills/m/listsavingbonds),
// used for Singapore Savings Bonds, not general MSB statistics — there is no
// .../exchangerates or similar JSON endpoint under that path (all guesses 404).
// MAS's newer subscription API catalog (eservices.mas.gov.sg/apimg-portal) requires
// registering an app and a key, which is disallowed here.
// data.gov.sg's "Exchange Rates, SGD per unit of USD, Daily" dataset IS a free,
// no-key JSON API (data.gov.sg/api/action/datastore_search), but its data stops
// in Oct 2015 — too stale to use.
//
// What does work, is free, needs no key, and is genuinely live: MAS's classic
// "Exchange Rates" page (https://eservices.mas.gov.sg/statistics/msb/exchangerates.aspx).
// It's a server-rendered ASP.NET WebForms page — the results table only appears
// after the "Display" button's postback — so this adapter replicates that
// postback: it reuses the __VIEWSTATE/__VIEWSTATEGENERATOR/__EVENTVALIDATION
// tokens from the page scraper/index.js already fetched for us (passed in as
// `$`), POSTs them back once per currency (USD, HKD) with only that checkbox
// ticked (for a single-column results table), and reads the last (most recent)
// row. HKD is quoted per 100 units and normalised to per-unit.
import { postForm } from '../lib/http.js';

const PAGE_URL = 'https://eservices.mas.gov.sg/statistics/msb/exchangerates.aspx';

export default {
  id: 'mas-fx',
  url: PAGE_URL,
  format: 'html',
  targets: ['_fx'],
  async scrape({ $, extract }) {
    const hidden = (id) => $(`#${id}`).attr('value') || '';
    const viewState = extract.mustFind(hidden('__VIEWSTATE') || null, 'MAS exchange rates __VIEWSTATE token');
    const viewStateGenerator = hidden('__VIEWSTATEGENERATOR');
    const eventValidation = hidden('__EVENTVALIDATION');

    const now = new Date();
    const year = String(now.getFullYear());

    // One postback per currency, each with a single ticked checkbox, keeps every
    // results table to one data column. The checkbox is found by its label, and
    // its list name says whether MAS quotes per unit or per 100 units.
    async function latestRate(label) {
      const box = $('input[type=checkbox]').filter((_, el) => $(`label[for="${$(el).attr('id')}"]`).text().trim() === label).first();
      const name = extract.mustFind(box.attr('name') || null, `MAS exchange rates "${label}" checkbox`);
      const perUnits = /Per100Units/.test(name) ? 100 : /PerUnit/.test(name) ? 1 : null;
      extract.mustFind(perUnits, `MAS quoting unit for "${label}" (checkbox list ${name})`);

      const body = {
        __EVENTTARGET: '',
        __EVENTARGUMENT: '',
        __VIEWSTATE: viewState,
        __VIEWSTATEGENERATOR: viewStateGenerator,
        __EVENTVALIDATION: eventValidation,
        'ctl00$ContentPlaceHolder1$StartYearDropDownList': year,
        'ctl00$ContentPlaceHolder1$EndYearDropDownList': year,
        'ctl00$ContentPlaceHolder1$StartMonthDropDownList': '1',
        'ctl00$ContentPlaceHolder1$EndMonthDropDownList': String(now.getMonth() + 1),
        [name]: 'on',
        'ctl00$ContentPlaceHolder1$DisplayFrequencyDropDownList': 'D',
        'ctl00$ContentPlaceHolder1$DisplayButton': 'Display',
      };

      const $$ = extract.load(await postForm(PAGE_URL, body));

      // The results table repeats year/month only on the first row of each
      // month; walk every row in document order and keep the last data cell —
      // that's the most recent business day's rate.
      let latest = null;
      $$('#ContentPlaceHolder1_ResultsPanel table tbody tr').each((_, tr) => {
        const cellText = $$(tr).find('td.data').first().text().trim();
        const num = Number(cellText);
        if (cellText && Number.isFinite(num)) latest = num;
      });
      extract.mustFind(latest, `${label} rate in MAS exchange rates results table`);
      return Math.round((latest / perUnits) * 1e8) / 1e8; // SGD per ONE unit (rounded: 16.27/100 isn't exact in binary)
    }

    return [
      { target: '_fx', type: 'fx', pair: 'USDSGD', value: await latestRate('US Dollar'), currency: 'SGD' },
      { target: '_fx', type: 'fx', pair: 'HKDSGD', value: await latestRate('Hong Kong Dollar'), currency: 'SGD' },
    ];
  },
};

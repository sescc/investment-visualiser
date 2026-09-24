// OCBC RoboInvest — dedicated product page's "Fees and charges" section.
export default {
  id: 'ocbc-roboinvest',
  url: 'https://www.ocbc.com/personal-banking/investments/roboinvest',
  format: 'html',
  targets: ['m-robo/ocbc-roboinvest'],
  async scrape({ text, extract }) {
    // "Fees and charges Management Fee Do it yourself online 0.88% of total
    // investment value per year The fee will be computed and charged to you
    // monthly based on number of calendar days in each month."
    const match = extract.mustFind(
      /Management Fee\s+Do it yourself online\s+([\d.]+)%\s*of total investment value per year/.exec(text),
      'OCBC RoboInvest management fee (% of total investment value per year)'
    );
    return [
      {
        target: 'm-robo/ocbc-roboinvest',
        type: 'aum_annual_pct',
        market: 'ALL',
        value: Number(match[1]),
        currency: 'PCT',
        note: 'Computed and charged monthly based on the number of calendar days in the month',
      },
    ];
  },
};

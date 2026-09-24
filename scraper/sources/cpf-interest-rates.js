// CPF Board's "Earning attractive interest" page states the current
// quarter's Ordinary Account rate, and a single combined rate for Special,
// MediSave and Retirement Accounts. One component is emitted per account
// (OA, SA, MA, RA) as required by the product's feeSpec, with SA/MA/RA
// sharing the page's single combined figure.
const PAGE_URL = 'https://www.cpf.gov.sg/member/growing-your-savings/earning-higher-returns/earning-attractive-interest';

export default {
  id: 'cpf-interest-rates',
  url: PAGE_URL,
  format: 'html',
  targets: ['p-cpf-topup'],
  async scrape({ text, extract }) {
    const oaMatch = /Ordinary Account interest rate\s*Interest rate from\s*([^:]+):\s*(\d+(?:\.\d+)?)%\s*per annum/i.exec(
      text
    );
    extract.mustFind(oaMatch, 'CPF Ordinary Account interest rate on cpf.gov.sg');

    const saMatch = /Special, MediSave and Retirement Account interest rates\s*Interest rate from\s*([^:]+):\s*(\d+(?:\.\d+)?)%\s*per annum/i.exec(
      text
    );
    extract.mustFind(saMatch, 'CPF Special/MediSave/Retirement Account interest rate on cpf.gov.sg');

    const oaPeriod = oaMatch[1].trim();
    const oaRate = Number(oaMatch[2]);
    const saPeriod = saMatch[1].trim();
    const saRate = Number(saMatch[2]);

    return [
      {
        target: 'p-cpf-topup',
        type: 'yield_pct',
        market: 'SG',
        value: oaRate,
        currency: 'PCT',
        label: `CPF Ordinary Account (OA) interest rate (${oaPeriod})`,
      },
      {
        target: 'p-cpf-topup',
        type: 'yield_pct',
        market: 'SG',
        value: saRate,
        currency: 'PCT',
        label: `CPF Special Account (SA) interest rate (${saPeriod})`,
      },
      {
        target: 'p-cpf-topup',
        type: 'yield_pct',
        market: 'SG',
        value: saRate,
        currency: 'PCT',
        label: `CPF MediSave Account (MA) interest rate (${saPeriod})`,
      },
      {
        target: 'p-cpf-topup',
        type: 'yield_pct',
        market: 'SG',
        value: saRate,
        currency: 'PCT',
        label: `CPF Retirement Account (RA) interest rate (${saPeriod})`,
      },
    ];
  },
};

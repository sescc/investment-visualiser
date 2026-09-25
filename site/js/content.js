// Shared, pure content: no DOM, no globals. Both the stable site (index.js, components.js) and the
// later visual edition import from here so glossary text, world/quiz metadata and the quiz's picking
// logic are defined exactly once. See docs/visual/ARCHITECTURE.md ("Content" object, shared Dat).

import { rankByCost, formatSGD, DEFAULT_SCENARIO, PRESETS, COST_GROUPS, costGroupOf } from './cost.js';

// ============================================================================
// Glossary
// ============================================================================

export const GLOSSARY = {
  cdp: 'Central Depository — MAS-linked registry that holds Singapore shares directly in your own name.',
  custodian: 'Custodian / nominee account — your broker holds shares in trust on your behalf, bundled with other clients’.',
  srs: 'Supplementary Retirement Scheme — a tax-deferred account you can invest from; withdrawals before the statutory age are taxed and penalised.',
  cpf: 'Central Provident Fund — Singapore’s mandatory savings scheme (Ordinary, Special, MediSave, Retirement accounts).',
  'cpf-oa': 'CPF Ordinary Account — earns a government-set interest rate (see the CPF Top-Ups card for the current figure); can be invested via CPFIS within limits.',
  aum: 'Assets under management — the value of what a platform manages for you; many robo-advisors charge an annual % of this.',
  'expense-ratio': 'The fund’s own yearly running cost, taken out of its returns before you see them.',
  rsp: 'Regular Savings Plan — investing a fixed amount on a schedule (e.g. monthly), regardless of price.',
  liquidity: 'How quickly you can turn the investment back into spendable cash.',
  etf: 'Exchange-Traded Fund — a basket of many stocks or bonds that trades on an exchange like a single share.',
  reit: 'Real Estate Investment Trust — owns income-producing property and distributes most rental income to unit holders.',
  'sales-charge': 'A one-off percentage fee taken when you buy into a fund, on top of its running costs.',
  ssb: 'Singapore Savings Bond — a government bond for individuals with step-up interest and no penalty for early redemption.',
};

// ============================================================================
// World (hub) metadata
// ============================================================================

export const WORLD_META = {
  products: { icon: 'basket', tagline: 'What to buy', href: 'products.html' },
  methods: { icon: 'key', tagline: 'How to invest', href: 'methods.html' },
  brokers: { icon: 'briefcase', tagline: 'Who executes it', href: 'brokers.html' },
};

// Teaser per world: products → best low-risk yield; methods/brokers → cheapest in one like-for-like cost group.
export const TEASER_GROUP = { methods: 'robo', brokers: 'brokers' };

/**
 * Pure data behind the hub's per-world teaser line (index.js:teaserFor renders this to HTML/text).
 * → { kind: 'yield', entryName, value, label } | { kind: 'cheapest', groupLabel, presetLabel, name, total, years } | null
 */
export function teaserData(data, world) {
  if (world === 'products') {
    const yields = data.products.entries
      .filter(e => e.riskLevel <= 2 && e.liquidity >= 3) // low-risk and not locked away (excludes CPF top-ups)
      .flatMap(e => (e.fees || []).filter(f => f.type === 'yield_pct').map(f => ({ e, f })))
      .sort((a, b) => b.f.value - a.f.value);
    if (!yields.length) return null;
    const { e, f } = yields[0];
    return { kind: 'yield', entryName: e.name, value: f.value, label: f.label || null };
  }
  const group = TEASER_GROUP[world];
  const items = data[world].entries.flatMap(e => e.providers || []).filter(p => costGroupOf(p) === group);
  const { ranked } = rankByCost(items, DEFAULT_SCENARIO, data.fx);
  if (!ranked.length) return null;
  return {
    kind: 'cheapest',
    groupLabel: COST_GROUPS[group].label,
    presetLabel: PRESETS.rsp.label,
    name: ranked[0].item.name,
    total: ranked[0].total,
    totalText: formatSGD(ranked[0].total),
    years: DEFAULT_SCENARIO.years,
  };
}

// ============================================================================
// Quiz
// ============================================================================

export const QUESTIONS = [
  {
    key: 'goal', q: 'What matters most to you?',
    options: [
      { label: 'Grow my money over the long run', value: 'growth' },
      { label: 'Steady income along the way', value: 'income' },
      { label: 'Keep my capital safe', value: 'safety' },
    ],
  },
  {
    key: 'horizon', q: "What's your time horizon?",
    options: [
      { label: 'Less than 2 years', value: 2 },
      { label: '2 – 5 years', value: 5 },
      { label: '5+ years', value: 10 },
    ],
  },
  {
    key: 'amount', q: 'How much can you invest?',
    options: [
      { label: 'A little each month (under S$200)', value: { monthly: 100, lumpSum: 0 } },
      { label: 'S$200 – S$1,000 a month', value: { monthly: 500, lumpSum: 0 } },
      { label: 'A lump sum (S$10,000+)', value: { monthly: 0, lumpSum: 20000 } },
    ],
  },
  {
    key: 'style', q: 'How hands-on do you want to be?',
    options: [
      { label: "I'll pick my own investments", value: 'active' },
      { label: 'I want it automated for me', value: 'passive' },
    ],
  },
  {
    key: 'account', q: 'Do you want to use CPF or SRS money?',
    options: [
      { label: 'CPF Ordinary Account', value: 'cpf' },
      { label: 'SRS', value: 'srs' },
      { label: 'No, cash only', value: 'cash' },
    ],
  },
];

export function scoreEntry(entry, targetRisk, targetGd) {
  const riskDist = Math.abs((entry.riskLevel ?? 3) - targetRisk);
  const gdDist = typeof entry.growthVsDividend === 'number' ? Math.abs(entry.growthVsDividend - targetGd) / 20 : 0;
  return riskDist + gdDist;
}

/**
 * pickQuizResult(data, answers) → { bestProduct, bestMethod, bestBroker, scenario, ids }
 * Pure: given the normalized dataset bundle (data.js:getData shape) and the quiz's answers object
 * (QUESTIONS[].key → chosen option.value), picks the same product/method/broker the stable site's
 * renderResult did, plus the scenario and compare-page ids derived from the answers.
 * `data.products/methods/brokers.entries` must be non-empty (caller checks isEmpty(data) first).
 */
export function pickQuizResult(data, answers) {
  const goal = answers.goal || 'growth';
  const targetRisk = goal === 'safety' ? 1 : goal === 'income' ? 2.5 : 4;
  const targetGd = goal === 'growth' ? 85 : goal === 'income' ? 15 : 40;
  const handsOff = answers.style === 'passive';

  const products = data.products.entries;
  const bestProduct = products.slice().sort((a, b) => scoreEntry(a, targetRisk, targetGd) - scoreEntry(b, targetRisk, targetGd))[0] || null;

  const methodPool = data.methods.entries;
  const bestMethod = methodPool.slice().sort((a, b) => {
    const aMatch = (answers.account && answers.account !== 'cash' && (a.eligibility || '').toLowerCase().includes(answers.account)) ? -1 : 0;
    const bMatch = (answers.account && answers.account !== 'cash' && (b.eligibility || '').toLowerCase().includes(answers.account)) ? -1 : 0;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return handsOff ? (a.complexity ?? 3) - (b.complexity ?? 3) : (b.complexity ?? 3) - (a.complexity ?? 3);
  })[0] || null;

  const brokerPool = data.brokers.entries;
  const bestBroker = brokerPool.slice().sort((a, b) => handsOff ? (a.complexity ?? 3) - (b.complexity ?? 3) : (a.riskLevel ?? 3) - (b.riskLevel ?? 3))[0] || null;

  const amount = answers.amount || { monthly: 500, lumpSum: 0 };
  const scenario = { lumpSum: amount.lumpSum, monthly: amount.monthly, years: answers.horizon || 10, tradesPerMonth: handsOff ? 0 : 1, market: 'SG' };
  const ids = [bestProduct, bestMethod, bestBroker].filter(Boolean).map(e => e.id);

  return { bestProduct, bestMethod, bestBroker, scenario, ids };
}

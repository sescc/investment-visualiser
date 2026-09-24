import { getData, isEmpty, allEntries, buildCompareUrl } from './data.js';
import { renderChrome, entryCard, wireEntryCards, openProsConsModal, emptyStatePanel, crown } from './components.js';
import { renderBubbleChart, bubbleTableRows, buildTableDetails, registerChart } from './charts.js';
import { rankByCost, formatSGD, DEFAULT_SCENARIO, PRESETS, COST_GROUPS, costGroupOf } from './cost.js';
import { icon } from './icons.js';

const data = await getData();
await renderChrome('index.html', data);

const products = data.products.entries;
const getEntry = id => allEntries(data).find(e => e.id === id) || null;

// ---------------- Risk vs return bubble map ----------------
const bubbleMount = document.getElementById('bubble-mount');
if (!products.length) {
  emptyStatePanel(bubbleMount, { title: 'No product data yet', detail: 'Run npm run scrape to generate data, then reload this page.' });
} else {
  registerChart(() => {
    const canvas = document.getElementById('bubble-canvas');
    renderBubbleChart(canvas, products, { onClick: id => { const e = getEntry(id); if (e) openProsConsModal(e); } });
  });
  document.getElementById('bubble-table-mount').innerHTML =
    buildTableDetails(['Product', 'Risk', 'Liquidity', 'Complexity', 'Return mix'], bubbleTableRows(products)) +
    `<p class="chart-legend-text">${icon('info', { size: 14 })} X-axis: risk (1 very low – 5 very high). Y-axis: liquidity, how quickly you can get your money out (1 locked-in – 5 instant). Bubble size: complexity. Colour: teal leans toward capital growth, amber leans toward income.</p>`;
}

// ---------------- World cards ----------------
const WORLD_META = {
  products: { icon: 'basket', tagline: 'What to buy', href: 'products.html' },
  methods: { icon: 'key', tagline: 'How to invest', href: 'methods.html' },
  brokers: { icon: 'briefcase', tagline: 'Who executes it', href: 'brokers.html' },
};

// Teaser per world: products → best low-risk yield; methods/brokers → cheapest in one like-for-like cost group.
const TEASER_GROUP = { methods: 'robo', brokers: 'brokers' };

function teaserFor(world) {
  if (world === 'products') {
    const yields = data.products.entries
      .filter(e => e.riskLevel <= 2 && e.liquidity >= 3) // low-risk and not locked away (excludes CPF top-ups)
      .flatMap(e => (e.fees || []).filter(f => f.type === 'yield_pct').map(f => ({ e, f })))
      .sort((a, b) => b.f.value - a.f.value);
    if (!yields.length) return null;
    const { e, f } = yields[0];
    return `Top low-risk yield: <strong>${e.name}</strong> — ${f.value}%${f.label ? ` <span class="muted">(${f.label})</span>` : ''}`;
  }
  const group = TEASER_GROUP[world];
  const items = data[world].entries.flatMap(e => e.providers || []).filter(p => costGroupOf(p) === group);
  const { ranked } = rankByCost(items, DEFAULT_SCENARIO, data.fx);
  if (!ranked.length) return null;
  return `${crown('Cheapest right now')} Cheapest ${COST_GROUPS[group].label.toLowerCase()} for ${PRESETS.rsp.label}: <strong>${ranked[0].item.name}</strong> — ${formatSGD(ranked[0].total)} over ${DEFAULT_SCENARIO.years} years`;
}

const cardsMount = document.getElementById('world-cards');
cardsMount.innerHTML = Object.entries(WORLD_META).map(([world, meta]) => {
  const count = data[world].entries.length;
  const teaser = teaserFor(world) || (isEmpty(data) ? 'Fee data not loaded yet' : 'Fee data coming soon');
  return `
    <a class="card world-card world-${world}" href="${meta.href}">
      <h3>${icon(meta.icon, { size: 22 })} ${meta.tagline}</h3>
      <span class="count">${count} ${count === 1 ? 'entry' : 'entries'}</span>
      <span class="teaser">${teaser}</span>
    </a>`;
}).join('');

// ---------------- Quiz ----------------
const QUESTIONS = [
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

const answers = {};
let qIdx = 0;
const quizMount = document.getElementById('quiz-mount');

function renderQuiz() {
  if (qIdx >= QUESTIONS.length) return renderResult();
  const step = QUESTIONS[qIdx];
  quizMount.innerHTML = `
    <div class="quiz">
      <p class="quiz-progress">Question ${qIdx + 1} of ${QUESTIONS.length}</p>
      <h3>${step.q}</h3>
      <div class="quiz-options">
        ${step.options.map((o, i) => `<button type="button" class="quiz-option" data-i="${i}">${o.label}</button>`).join('')}
      </div>
      ${qIdx > 0 ? `<button type="button" class="btn btn-ghost" data-action="quiz-back" style="margin-top:14px">Back</button>` : ''}
    </div>`;
  quizMount.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => {
      answers[step.key] = step.options[Number(btn.dataset.i)].value;
      qIdx += 1;
      renderQuiz();
    });
  });
  quizMount.querySelector('[data-action="quiz-back"]')?.addEventListener('click', () => { qIdx -= 1; renderQuiz(); });
}

function scoreEntry(entry, targetRisk, targetGd) {
  const riskDist = Math.abs((entry.riskLevel ?? 3) - targetRisk);
  const gdDist = typeof entry.growthVsDividend === 'number' ? Math.abs(entry.growthVsDividend - targetGd) / 20 : 0;
  return riskDist + gdDist;
}

function renderResult() {
  const goal = answers.goal || 'growth';
  const targetRisk = goal === 'safety' ? 1 : goal === 'income' ? 2.5 : 4;
  const targetGd = goal === 'growth' ? 85 : goal === 'income' ? 15 : 40;
  const handsOff = answers.style === 'passive';

  if (isEmpty(data)) {
    quizMount.innerHTML = `<div class="quiz"><p class="muted">No data loaded yet — run <code>npm run scrape</code> to see personalised suggestions.</p>
      <button type="button" class="btn btn-ghost" data-action="quiz-restart">Start over</button></div>`;
    quizMount.querySelector('[data-action="quiz-restart"]').addEventListener('click', () => { qIdx = 0; renderQuiz(); });
    return;
  }

  const bestProduct = products.slice().sort((a, b) => scoreEntry(a, targetRisk, targetGd) - scoreEntry(b, targetRisk, targetGd))[0];
  const methodPool = data.methods.entries;
  const bestMethod = methodPool.slice().sort((a, b) => {
    const aMatch = (answers.account && answers.account !== 'cash' && (a.eligibility || '').toLowerCase().includes(answers.account)) ? -1 : 0;
    const bMatch = (answers.account && answers.account !== 'cash' && (b.eligibility || '').toLowerCase().includes(answers.account)) ? -1 : 0;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return handsOff ? (a.complexity ?? 3) - (b.complexity ?? 3) : (b.complexity ?? 3) - (a.complexity ?? 3);
  })[0];
  const brokerPool = data.brokers.entries;
  const bestBroker = brokerPool.slice().sort((a, b) => handsOff ? (a.complexity ?? 3) - (b.complexity ?? 3) : (a.riskLevel ?? 3) - (b.riskLevel ?? 3))[0];

  const amount = answers.amount || { monthly: 500, lumpSum: 0 };
  const scenario = { lumpSum: amount.lumpSum, monthly: amount.monthly, years: answers.horizon || 10, tradesPerMonth: handsOff ? 0 : 1, market: 'SG' };
  const ids = [bestProduct, bestMethod, bestBroker].filter(Boolean).map(e => e.id);
  const compareUrl = buildCompareUrl({ ids, scenario });

  quizMount.innerHTML = `
    <div class="quiz">
      <h3>Your suggested starting point</h3>
      <div class="quiz-result">
        ${bestProduct ? `<div class="quiz-result-card"><strong>${icon('basket', { size: 16 })} Product:</strong> <a href="products.html">${bestProduct.name}</a></div>` : ''}
        ${bestMethod ? `<div class="quiz-result-card"><strong>${icon('key', { size: 16 })} Method:</strong> <a href="methods.html">${bestMethod.name}</a></div>` : ''}
        ${bestBroker ? `<div class="quiz-result-card"><strong>${icon('briefcase', { size: 16 })} Broker type:</strong> <a href="brokers.html">${bestBroker.name}</a></div>` : ''}
      </div>
      <div class="modal-actions" style="justify-content:flex-start; margin-top:16px">
        <a class="btn btn-primary" href="${compareUrl}">${icon('chart', { size: 16 })} Compare these &amp; see costs</a>
        <button type="button" class="btn btn-ghost" data-action="quiz-restart">Start over</button>
      </div>
    </div>`;
  quizMount.querySelector('[data-action="quiz-restart"]').addEventListener('click', () => { qIdx = 0; Object.keys(answers).forEach(k => delete answers[k]); renderQuiz(); });
}

renderQuiz();

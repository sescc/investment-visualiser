import { getData, isEmpty, allEntries, buildCompareUrl } from './data.js';
import { renderChrome, entryCard, wireEntryCards, openProsConsModal, emptyStatePanel, crown } from './components.js';
import { renderBubbleChart, bubbleTableRows, buildTableDetails, registerChart } from './charts.js';
import { icon } from './icons.js';
import { WORLD_META, teaserData, QUESTIONS, pickQuizResult } from './content.js';

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
// WORLD_META, and the pure numbers behind each teaser, live in content.js so the visual edition can
// reuse them; only the HTML string-building here is DOM/site-specific.
function teaserFor(world) {
  const t = teaserData(data, world);
  if (!t) return null;
  if (t.kind === 'yield') {
    return `Top low-risk yield: <strong>${t.entryName}</strong> — ${t.value}%${t.label ? ` <span class="muted">(${t.label})</span>` : ''}`;
  }
  return `${crown('Cheapest right now')} Cheapest ${t.groupLabel.toLowerCase()} for ${t.presetLabel}: <strong>${t.name}</strong> — ${t.totalText} over ${t.years} years`;
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
// QUESTIONS and the result-picking logic live in content.js (shared, pure); this file only owns the DOM.
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

function renderResult() {
  if (isEmpty(data)) {
    quizMount.innerHTML = `<div class="quiz"><p class="muted">No data loaded yet — run <code>npm run scrape</code> to see personalised suggestions.</p>
      <button type="button" class="btn btn-ghost" data-action="quiz-restart">Start over</button></div>`;
    quizMount.querySelector('[data-action="quiz-restart"]').addEventListener('click', () => { qIdx = 0; renderQuiz(); });
    return;
  }

  const { bestProduct, bestMethod, bestBroker, scenario, ids } = pickQuizResult(data, answers);
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

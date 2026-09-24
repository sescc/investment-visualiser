import { getData } from './data.js';
import { renderChrome, entryCard, wireEntryCards, providersTable, mountFeeCalculator, emptyStatePanel } from './components.js';
import { renderFeeBarChart } from './charts.js';
import { DEFAULT_SCENARIO } from './cost.js';

const data = await getData();
await renderChrome('methods.html', data);

const methods = data.methods.entries;
const getEntry = id => methods.find(e => e.id === id) || null;

const listMount = document.getElementById('methods-list');
if (!methods.length) {
  document.getElementById('calc-mount').innerHTML = '';
  emptyStatePanel(document.getElementById('methods-empty'), { title: 'No method data yet', detail: 'Run npm run scrape to generate data, then reload this page.' });
} else {
  listMount.innerHTML = methods.map(m => `
    <div>
      ${entryCard(m, 'methods')}
      <div style="margin-top:10px">${providersTable(m, DEFAULT_SCENARIO, data.fx)}</div>
    </div>`).join('');
  wireEntryCards(listMount, getEntry);

  const items = methods.flatMap(m => (m.providers?.length ? m.providers.map(p => ({ item: p, world: 'methods' })) : [{ item: m, world: 'methods' }]));
  mountFeeCalculator(document.getElementById('calc-mount'), {
    items, fx: data.fx, initialGroup: 'robo',
    renderChart: (canvas, ranked) => renderFeeBarChart(canvas, ranked, { hueVar: '--world-methods' }),
  });
}

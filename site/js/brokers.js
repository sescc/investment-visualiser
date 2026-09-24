import { getData } from './data.js';
import { renderChrome, entryCard, wireEntryCards, providersTable, mountFeeCalculator, emptyStatePanel } from './components.js';
import { renderFeeBarChart } from './charts.js';
import { DEFAULT_SCENARIO } from './cost.js';

const data = await getData();
await renderChrome('brokers.html', data);

const brokers = data.brokers.entries;
const getEntry = id => brokers.find(e => e.id === id) || null;

const listMount = document.getElementById('brokers-list');
if (!brokers.length) {
  document.getElementById('calc-mount').innerHTML = '';
  emptyStatePanel(document.getElementById('brokers-empty'), { title: 'No broker data yet', detail: 'Run npm run scrape to generate data, then reload this page.' });
} else {
  listMount.innerHTML = brokers.map(b => `
    <div>
      ${entryCard(b, 'brokers')}
      <div style="margin-top:10px">${providersTable(b, DEFAULT_SCENARIO, data.fx)}</div>
    </div>`).join('');
  wireEntryCards(listMount, getEntry);

  const items = brokers.flatMap(b => (b.providers?.length ? b.providers.map(p => ({ item: p, world: 'brokers' })) : [{ item: b, world: 'brokers' }]));
  mountFeeCalculator(document.getElementById('calc-mount'), {
    items, fx: data.fx, initialGroup: 'brokers',
    renderChart: (canvas, ranked) => renderFeeBarChart(canvas, ranked, { hueVar: '--world-brokers' }),
  });
}

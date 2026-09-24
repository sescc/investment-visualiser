import { getData } from './data.js';
import { renderChrome, entryCard, wireEntryCards, emptyStatePanel } from './components.js';
import { renderSpectrumTrack, renderReturnSourceBars, returnSourceTableRows, buildTableDetails, registerChart } from './charts.js';

const data = await getData();
await renderChrome('products.html', data);

const products = data.products.entries;
const getEntry = id => products.find(e => e.id === id) || null;

let activeCategory = 'all';
let beginnerOnly = false;

function filtered() {
  return products.filter(p =>
    (activeCategory === 'all' || p.category === activeCategory) &&
    (!beginnerOnly || (p.complexity ?? 5) <= 2));
}

function renderFilters() {
  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
  const mount = document.getElementById('filters-mount');
  mount.innerHTML = categories.map(c =>
    `<button type="button" class="chip chip-btn${c === activeCategory ? ' is-active' : ''}" data-cat="${c}">${c === 'all' ? 'All categories' : c}</button>`
  ).join('') + `<button type="button" class="chip chip-btn${beginnerOnly ? ' is-active' : ''}" data-action="toggle-beginner">Beginner-friendly only</button>`;

  mount.querySelectorAll('[data-cat]').forEach(btn => btn.addEventListener('click', () => { activeCategory = btn.dataset.cat; renderAll(); }));
  mount.querySelector('[data-action="toggle-beginner"]').addEventListener('click', () => { beginnerOnly = !beginnerOnly; renderAll(); });
}

function renderGrid() {
  const list = filtered();
  const grid = document.getElementById('products-grid');
  const emptyMount = document.getElementById('products-empty');
  if (!products.length) {
    emptyStatePanel(emptyMount, { title: 'No product data yet', detail: 'Run npm run scrape to generate data, then reload this page.' });
    grid.innerHTML = '';
    return;
  }
  emptyMount.innerHTML = '';
  grid.innerHTML = list.length
    ? list.map(p => entryCard(p, 'products')).join('')
    : `<p class="muted">No products match these filters.</p>`;
  wireEntryCards(grid, getEntry);
}

function renderSpectrum() {
  const mount = document.getElementById('spectrum-mount');
  if (!products.length) { mount.innerHTML = ''; return; }
  renderSpectrumTrack(mount, products, {
    onHighlight: (id, on) => {
      document.querySelectorAll(`.entry-card[data-entry-id="${id}"]`).forEach(el => el.classList.toggle('is-highlight', on));
      document.querySelectorAll(`.spectrum-point[data-entry-id="${id}"]`).forEach(el => el.classList.toggle('is-highlight', on));
    },
  });
}

function renderReturns() {
  if (!products.length) return;
  registerChart(() => renderReturnSourceBars(document.getElementById('returns-canvas'), products));
  document.getElementById('returns-table-mount').innerHTML =
    buildTableDetails(['Product', 'Capital growth', 'Income'], returnSourceTableRows(products));
}

function renderAll() {
  renderFilters();
  renderGrid();
}

renderAll();
renderSpectrum();
renderReturns();

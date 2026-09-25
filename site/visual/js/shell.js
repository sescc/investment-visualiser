// shell.js — the visual edition's page chrome: header, disclaimer, footer, freshness pill/panel,
// glossary modal + tooltips, theme/Calm/sound toggles, Remix button, the WebGL stage's lifecycle,
// cursor/tilt/magnetic fx, the edition switch, and Vercel analytics. Every visual page calls
// `mountShell(...)` once; nothing else needs to know how these pieces fit together.
//
// CANONICAL <head> — copy this order into every site/visual/*.html page (hub.html is the reference):
//
//   <meta charset="UTF-8">
//   <meta name="viewport" content="width=device-width, initial-scale=1">
//   <title>… — SGInvest Visualiser (visual edition)</title>
//   <!-- Importmap MUST come before any <script type="module">. -->
//   <script type="importmap">
//   {
//     "imports": {
//       "three": "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.186.0/three.module.min.js",
//       "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/"
//     }
//   }
//   </script>
//   <!-- Pre-paint: apply the stored theme + Calm state before first paint, so there's no flash. -->
//   <script>
//   (function () {
//     try { var t = localStorage.getItem('sgtheme'); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) {}
//     try { var calm = new URLSearchParams(location.search).get('calm') === '1' || localStorage.getItem('sg-visual-calm') === '1'; if (calm) document.documentElement.classList.add('is-calm'); } catch (e) {}
//   })();
//   </script>
//   <link rel="stylesheet" href="../../css/tokens.css">
//   <link rel="stylesheet" href="../css/visual.css">
//   <body class="visual-edition">
//   <a class="sr-only" href="#main">Skip to content</a>
//   <header id="app-header"></header>
//   <div id="app-disclaimer" class="disclaimer" hidden></div>  <!-- mountShell also adds this class
//     defensively (bug found in review: without it, painting order put the strip behind the fixed
//     stage canvas even though it was in the DOM) — include it in markup anyway for clarity. -->
//   <main id="main">…real, always-visible content…</main>
//   <footer id="app-footer"></footer>
//   <!-- Same file:// notice as stable (site/index.html) — paths are one level deeper. -->
//   <script>if (location.protocol === "file:") document.addEventListener("DOMContentLoaded", function () { var m = document.getElementById("main"); if (m) m.insertAdjacentHTML("afterbegin", "<div class=\"visual-wrap\" style=\"padding:24px 0\"><div class=\"panel\"><h3>Start the local server to use this site</h3><p>Browsers block this page's scripts when opened as a file. In the project folder run:</p><code>npm run serve</code><p>then open http://127.0.0.1:5173/site/visual/</p></div></div>"); });</script>
//   <script src="../../data/sgdata.js"></script>  <!-- classic, before any module -->
//   <script type="module" src="./js/hub.js"></script>  <!-- (or products.js / methods.js / … ) -->
//
// Paths above are written for a page at `site/visual/<page>.html`; keep them relative (Pages serves
// `site/` at the root, local dev serves it at `/site/`, and both must work unmodified).
//
// PUBLIC API
//   mountShell({ page, data, glossary } = {}) → Promise<ShellHandle>
//     `page`: the active nav href, e.g. 'index.html' (same value stable's renderChrome takes).
//     `data`: the normalized dataset bundle from ../../js/data.js:getData().
//     `glossary`: optional override for the {key: definition} map; defaults to content.js's GLOSSARY.
//     Mounts everything into #app-header / #app-disclaimer / #app-footer, appends the grain overlay
//     and (motion permitting) the WebGL stage to <body>, starts the render/interaction fx, calls the
//     edition switch and analytics, and returns:
//       { getStage(), roll, openModal(el, opts), closeModal(), esc(str), ls(key), lsSet(key,val),
//         ss(key), ssSet(key,val), glossaryTooltips(root) }
//     `getStage()` returns the live Stage from stage.js, or null before it's ready / when motion
//     isn't allowed. Listen for `window.addEventListener('sg:stageready', e => e.detail.stage)` to
//     react the moment it becomes available instead of polling.
//   openModal(contentEl, { labelledBy, onClose, size } = {}) → close()
//     Focus-trapped, Esc-to-close, restores focus, marks the rest of the page `inert` while open.
//     Exported standalone too (not just via the mountShell handle) so Wave C pages that already hold
//     a reference can call `import { openModal, closeModal, esc } from './shell.js'` directly.
//   esc(str) → escaped string  — the same escaper every page should use before any scraped text goes
//     into innerHTML.
//   ls(key)/lsSet(key,val), ss(key)/ssSet(key,val) — localStorage/sessionStorage, always try/catch.
//
// Theme: reuses the stable site's exact localStorage key (`sgtheme`) and `sg:themechange` window
// event, so the reader's light/dark choice follows them across editions — but the toggle logic is
// re-implemented locally rather than imported from ../../js/components.js, which also renders the
// *stable* header/footer/modal and would pull that unrelated chrome into this bundle.

import { icon } from '../../js/icons.js';
import { freshnessSummary, checkRefreshAvailable, triggerRefresh, invalidateCache } from '../../js/data.js';
import { GLOSSARY as CONTENT_GLOSSARY } from '../../js/content.js';
import { mountEditionSwitch } from '../../js/edition-switch.js';
import { DEBUG, getCalm, setCalm, motionScope, motionAllowed } from './motion.js';
import { initStage } from './stage.js';
import { mountFx, confettiBurst, getSoundEnabled, setSoundEnabled, playBlip } from './fx.js';
import { roll as rollChoreography, currentSeed, mountRemix, onChaosMode, initKonami } from './chaos.js';
import { initAnalytics } from './analytics.js';

function h(strings, ...vals) {
  return strings.reduce((acc, s, i) => acc + s + (vals[i] ?? ''), '');
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function ls(key) { try { return localStorage.getItem(key); } catch { return null; } }
export function lsSet(key, val) { try { localStorage.setItem(key, val); } catch { /* ignore */ } }
export function ss(key) { try { return sessionStorage.getItem(key); } catch { return null; } }
export function ssSet(key, val) { try { sessionStorage.setItem(key, val); } catch { /* ignore */ } }

// ============================================================================
// Theme (same localStorage key + event as stable's components.js)
// ============================================================================

const THEME_KEY = 'sgtheme';

function getStoredTheme() {
  const v = ls(THEME_KEY);
  return v === 'light' || v === 'dark' ? v : null;
}
function currentTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function setTheme(mode) {
  if (mode === 'light' || mode === 'dark') {
    document.documentElement.setAttribute('data-theme', mode);
    lsSet(THEME_KEY, mode);
  } else {
    document.documentElement.removeAttribute('data-theme');
    lsSet(THEME_KEY, '');
  }
  window.dispatchEvent(new CustomEvent('sg:themechange', { detail: { theme: currentTheme() } }));
}
function initThemeSync() {
  const stored = getStoredTheme();
  if (stored) document.documentElement.setAttribute('data-theme', stored);
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => { if (!getStoredTheme()) window.dispatchEvent(new CustomEvent('sg:themechange', { detail: { theme: currentTheme() } })); };
  mq.addEventListener ? mq.addEventListener('change', onSystemChange) : mq.addListener?.(onSystemChange);
}

// ============================================================================
// Modal: focus-trapped, Esc to close, role=dialog, rest of the page `inert` while open.
// ============================================================================

let _activeModal = null;

export function openModal(contentEl, { labelledBy, onClose, size } = {}) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'modal' + (size === 'lg' ? ' modal-lg' : '');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (labelledBy) dialog.setAttribute('aria-labelledby', labelledBy);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn modal-close';
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.innerHTML = '<span aria-hidden="true" style="font-size:20px;line-height:1;font-weight:700">&times;</span>';
  dialog.appendChild(closeBtn);
  dialog.appendChild(contentEl);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');

  const inertTargets = ['#app-header', '#app-disclaimer', '#main', '#app-footer', '.edition-switch']
    .map(sel => document.querySelector(sel)).filter(Boolean);
  inertTargets.forEach(el => el.setAttribute('inert', ''));

  const previouslyFocused = document.activeElement;
  const focusables = () => Array.from(dialog.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'));
  (focusables()[0] || dialog).focus?.({ preventScroll: true });
  requestAnimationFrame(() => { document.documentElement.scrollLeft = 0; document.body.scrollLeft = 0; });
  dialog.tabIndex = -1;

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  function onOverlayClick(e) { if (e.target === overlay) close(); }

  function close() {
    document.removeEventListener('keydown', onKeydown);
    overlay.removeEventListener('click', onOverlayClick);
    overlay.remove();
    document.body.classList.remove('modal-open');
    inertTargets.forEach(el => el.removeAttribute('inert'));
    previouslyFocused?.focus?.();
    if (_activeModal === close) _activeModal = null;
    onClose?.();
  }

  document.addEventListener('keydown', onKeydown);
  overlay.addEventListener('click', onOverlayClick);
  closeBtn.addEventListener('click', close);
  _activeModal = close;
  return close;
}

export function closeModal() { _activeModal?.(); }

// ============================================================================
// Glossary
// ============================================================================

export function glossaryTooltips(root = document, glossary = CONTENT_GLOSSARY) {
  root.querySelectorAll('abbr[data-glossary]').forEach(el => {
    const key = el.getAttribute('data-glossary');
    const def = glossary[key];
    if (!def) return;
    if (!el.title) el.title = def;
    el.tabIndex = 0;
    el.classList.add('glossary-term');
  });
}

function openGlossaryModal(glossary) {
  const body = document.createElement('div');
  body.innerHTML = h`
    <h2 id="glossary-title" class="kinetic display-md">Glossary</h2>
    <dl class="glossary-list">
      ${Object.entries(glossary).map(([k, v]) => h`<dt>${esc(k.replace(/-/g, ' '))}</dt><dd>${esc(v)}</dd>`).join('')}
    </dl>`;
  openModal(body, { labelledBy: 'glossary-title' });
}

// ============================================================================
// Freshness pill + panel (same text/format as stable, so both editions are diffable)
// ============================================================================

const NAV_ITEMS = [
  { href: 'index.html', label: 'Hub' },
  { href: 'products.html', label: 'Products' },
  { href: 'methods.html', label: 'Methods' },
  { href: 'brokers.html', label: 'Brokers' },
  { href: 'compare.html', label: 'Compare' },
];

function updateFreshnessPill(data) {
  const pillText = document.querySelector('.freshness-pill-text');
  if (!pillText) return;
  if (!data || data.empty) { pillText.textContent = 'No data yet'; return; }
  const { total, live, generatedAt } = freshnessSummary(data);
  const dateStr = generatedAt ? new Date(generatedAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : '—';
  pillText.textContent = `Data as of ${dateStr} · fees for ${live}/${total}`;
  pillText.parentElement?.setAttribute('title', `${live} of ${total} products/providers have live fee data; the rest link to the provider's own page.`);
}

async function openFreshnessPanel(data) {
  const canRefresh = await checkRefreshAvailable();
  const rows = (data?.report || []).map(r => h`
    <tr>
      <td>${esc(r.adapter)}</td>
      <td>${r.ok ? `<span class="badge badge-live">${icon('check', { size: 12 })} ok</span>` : `<span class="badge badge-stale">${icon('warning', { size: 12 })} fail</span>`}</td>
      <td>${r.count ?? '—'}</td>
      <td class="muted">${esc(r.error || '')}</td>
    </tr>`).join('');

  const body = document.createElement('div');
  body.innerHTML = h`
    <h2 id="freshness-title" class="kinetic display-md">Data freshness</h2>
    <p class="muted">Each row is one automated adapter run. "live" fee data was fetched within the last 30 days.</p>
    ${(() => {
      const { missing } = data?.empty ? { missing: [] } : freshnessSummary(data);
      return missing.length ? h`
        <h3>Not scraped automatically (${missing.length})</h3>
        <p class="muted">These pages need a real browser, are PDFs, or block automated reading — check the provider directly.</p>
        <ul class="incomplete-list">${missing.map(m => `<li><a href="${esc(m.sourceUrl)}" target="_blank" rel="noopener">${esc(m.name)} ${icon('external', { size: 12 })}</a></li>`).join('')}</ul>` : '';
    })()}
    ${data?.empty ? `<p class="empty-note">No data yet. Run <code>npm run scrape</code> to generate <code>data/sgdata.json</code>.</p>` : ''}
    ${rows ? h`<div class="table-scroll"><table class="data-table"><thead><tr><th>Adapter</th><th>Status</th><th>Components</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">No adapter report available yet.</p>'}
    <div class="modal-actions">
      ${canRefresh ? `<button type="button" class="btn btn-primary" data-action="refresh-data">${icon('external', { size: 16 })} Refresh data</button>` : ''}
    </div>`;
  openModal(body, { labelledBy: 'freshness-title' });

  body.querySelector('[data-action="refresh-data"]')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> Refreshing…`;
    const ok = await triggerRefresh();
    if (ok) { invalidateCache(); location.reload(); }
    else { btn.disabled = false; btn.textContent = 'Refresh failed — try again'; }
  });
}

// ============================================================================
// Mobile header menu — below 720px, nav + freshness pill + Remix + Calm/sound/theme collapse into a
// focus-trapped drawer under the header, opened by a single burger button (keeps the header itself to
// one row, ≤64px, on narrow screens). No-op above 720px (the burger is hidden and .header-menu is
// `display: contents`, so nothing here fires from user interaction there).
// ============================================================================

function setUpHeaderMenu(header) {
  const burger = header.querySelector('[data-action="toggle-menu"]');
  const menu = header.querySelector('#header-menu');
  if (!burger || !menu) return;

  let open = false;
  let onKeydown = null;
  let onOutside = null;

  function focusables() {
    return Array.from(menu.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'));
  }

  function setOpen(next) {
    if (open === next) return;
    open = next;
    menu.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));

    if (open) {
      // preventScroll: true — found necessary in review: focusing the first nav link (position:
      // fixed, left: 0) was triggering a horizontal scroll-into-view even though it was already fully
      // visible. preventScroll didn't fully suppress it in every case tested, so this also forces
      // body/html scrollLeft back to 0 on the next frame as a guaranteed backstop — the site's hard
      // rule is no horizontal scroll anywhere, so this is defensive regardless of root cause.
      (focusables()[0] || menu).focus?.({ preventScroll: true });
      requestAnimationFrame(() => { document.documentElement.scrollLeft = 0; document.body.scrollLeft = 0; });
      onKeydown = e => {
        if (e.key === 'Escape') { e.preventDefault(); setOpen(false); burger.focus(); return; }
        if (e.key === 'Tab') {
          const f = focusables();
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      onOutside = e => { if (!menu.contains(e.target) && e.target !== burger && !burger.contains(e.target)) setOpen(false); };
      document.addEventListener('keydown', onKeydown);
      document.addEventListener('pointerdown', onOutside);
    } else {
      if (onKeydown) document.removeEventListener('keydown', onKeydown);
      if (onOutside) document.removeEventListener('pointerdown', onOutside);
      onKeydown = null;
      onOutside = null;
    }
  }

  burger.addEventListener('click', () => setOpen(!open));
  // Picking a nav link should close the drawer rather than leave it open under the next page's header.
  menu.querySelectorAll('.nav-link').forEach(a => a.addEventListener('click', () => setOpen(false)));
  // A resize back to desktop width doesn't visually need this (`.header-menu` is `display: contents`
  // there), but reset the open/aria state anyway so it isn't stale if the viewport narrows again.
  window.addEventListener('resize', () => { if (open && window.innerWidth >= 720) setOpen(false); });
}

// ============================================================================
// mountShell
// ============================================================================

export async function mountShell({ page, data, glossary = CONTENT_GLOSSARY } = {}) {
  document.body.classList.add('visual-edition');
  initThemeSync();

  // Grain overlay (decorative, behind content — see visual.css .grain-overlay).
  if (!document.querySelector('.grain-overlay')) {
    const grain = document.createElement('div');
    grain.className = 'grain-overlay';
    grain.setAttribute('aria-hidden', 'true');
    document.body.prepend(grain);
  }

  const header = document.getElementById('app-header');
  const discEl = document.getElementById('app-disclaimer');
  const footEl = document.getElementById('app-footer');

  // Bug found in review: without this class, #app-disclaimer has no `position`/`z-index`, and CSS
  // paints unpositioned in-flow boxes BEFORE (i.e. visually behind) any `position: fixed` sibling —
  // including #stage-canvas and .grain-overlay — regardless of DOM order. The strip was in the DOM,
  // hit-testable, and readable in devtools, but the stage canvas visually painted over it. `.disclaimer`
  // carries `position: relative; z-index: var(--z-content)` (see visual.css's "main, header, footer,
  // .visual-topbar, .disclaimer" rule) plus its own opaque `--warn-soft` background.
  discEl?.classList.add('disclaimer');

  if (header) {
    header.className = 'visual-topbar topbar'; // `.topbar` too — edition-switch.js measures its height.
    const theme = currentTheme();
    const calmOn = getCalm();
    const soundOn = getSoundEnabled();
    // Below 720px, `.header-menu` (nav + freshness pill + Remix + Calm/sound/theme) collapses into a
    // focus-trapped drawer opened by the single burger button, keeping the header itself to one row.
    // Above 720px, `.header-menu` is `display: contents` (see visual.css) — its children fall back
    // into `.bar-inner`'s normal flex row exactly as before, so desktop is unchanged.
    header.innerHTML = h`
      <div class="bar-inner">
        <a class="brand" href="index.html" aria-label="SGInvest Visualiser — home">
          <span class="brand-dot" aria-hidden="true"></span>
          <span class="brand-name kinetic">SGInvest Visualiser</span>
          <span class="brand-tag">visual</span>
        </a>
        <button type="button" class="icon-btn nav-burger" data-action="toggle-menu" aria-label="Menu" aria-expanded="false" aria-controls="header-menu">
          <span class="burger-lines" aria-hidden="true">≡</span>
        </button>
        <div class="header-menu" id="header-menu">
          <nav class="nav" aria-label="Main">
            ${NAV_ITEMS.map(n => h`<a href="${n.href}" class="nav-link${n.href === page ? ' is-active' : ''}"${n.href === page ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}
          </nav>
          <div class="bar-actions">
            <span data-mount="remix"></span>
            <button type="button" class="pill freshness-pill" data-action="open-freshness" aria-haspopup="dialog">
              ${icon('chart', { size: 16 })}
              <span class="freshness-pill-text">Data loading…</span>
            </button>
            <button type="button" class="icon-btn${calmOn ? ' is-on' : ''}" data-action="toggle-calm" aria-pressed="${calmOn}" aria-label="Calm mode (turns off motion and the 3D background)" title="Calm mode" ${DEBUG.calm ? 'disabled' : ''}>
              ${icon('shield', { size: 18 })}
            </button>
            <button type="button" class="icon-btn${soundOn ? ' is-on' : ''}" data-action="toggle-sound" aria-pressed="${soundOn}" aria-label="Toggle sound effects" title="Sound effects">
              <span aria-hidden="true" data-el="sound-glyph">${soundOn ? '🔊' : '🔈'}</span>
            </button>
            <button type="button" class="icon-btn" data-action="toggle-theme" aria-label="Toggle dark mode" title="Toggle dark mode">
              ${icon(theme === 'dark' ? 'sun' : 'moon', { size: 18 })}
            </button>
          </div>
        </div>
      </div>`;
    updateFreshnessPill(data);
    document.querySelectorAll('[data-action="open-freshness"]').forEach(btn => btn.addEventListener('click', () => openFreshnessPanel(data)));

    header.querySelector('[data-action="toggle-theme"]').addEventListener('click', () => {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
      playBlip({ freq: 520 });
    });
    header.querySelector('[data-action="toggle-calm"]').addEventListener('click', e => {
      const on = !getCalm();
      setCalm(on);
      e.currentTarget.setAttribute('aria-pressed', String(on));
      e.currentTarget.classList.toggle('is-on', on);
    });
    header.querySelector('[data-action="toggle-sound"]').addEventListener('click', e => {
      const on = !getSoundEnabled();
      setSoundEnabled(on);
      e.currentTarget.setAttribute('aria-pressed', String(on));
      e.currentTarget.classList.toggle('is-on', on);
      const glyph = e.currentTarget.querySelector('[data-el="sound-glyph"]');
      if (glyph) glyph.textContent = on ? '🔊' : '🔈';
      if (on) playBlip({ freq: 660 });
    });

    setUpHeaderMenu(header);

    function setHeaderHeightVar() {
      document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
    }
    setHeaderHeightVar();
    window.addEventListener('resize', setHeaderHeightVar);
  }

  if (discEl) {
    if (ss('sg-disclaimer-dismissed') !== '1') {
      discEl.hidden = false;
      discEl.innerHTML = h`
        <div class="disclaimer-inner">
          ${icon('warning', { size: 18 })}
          <p>Educational only — not financial advice. Fees change; always confirm on the provider's site.</p>
          <button type="button" class="icon-btn" data-action="dismiss-disclaimer" aria-label="Dismiss">${icon('check', { size: 16 })}</button>
        </div>`;
      discEl.querySelector('[data-action="dismiss-disclaimer"]').addEventListener('click', () => {
        ssSet('sg-disclaimer-dismissed', '1');
        discEl.hidden = true;
      });
    } else {
      discEl.hidden = true;
    }
  }

  if (footEl) {
    const gen = data?.generatedAt ? new Date(data.generatedAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'not yet generated';
    footEl.className = 'visual-footer';
    footEl.innerHTML = h`
      <div class="footer-inner">
        <p>Data generated: ${esc(gen)}. Fee figures come from each provider's own pricing page via an automated scraper.</p>
        <div class="footer-links">
          <a href="methods.html">Sources &amp; methods</a>
          <span aria-hidden="true">·</span>
          <a href="#" data-action="open-freshness">Freshness report</a>
          <span aria-hidden="true">·</span>
          <a href="#" data-action="open-glossary">Glossary</a>
        </div>
        <p class="footer-fine">Not financial advice. Educational tool only.</p>
      </div>`;
    footEl.querySelector('[data-action="open-freshness"]')?.addEventListener('click', e => { e.preventDefault(); openFreshnessPanel(data); });
    footEl.querySelector('[data-action="open-glossary"]')?.addEventListener('click', e => { e.preventDefault(); openGlossaryModal(glossary); });
  }

  glossaryTooltips(document.body, glossary);

  // ---- Edition switch (shared module; styled by visual.css) ----
  mountEditionSwitch({ edition: 'visual' });

  // ---- Analytics (Vercel only) ----
  initAnalytics();

  // ---- fx: cursor / magnetic / tilt (one motionScope, torn down together under Calm/reduced-motion) ----
  mountFx({});

  // ---- WebGL stage lifecycle, gated on motion + WebGL availability ----
  let stage = null;
  motionScope(() => {
    let disposed = false;
    initStage({}).then(s => {
      if (disposed) { s?.dispose(); return; }
      stage = s;
      if (stage) window.dispatchEvent(new CustomEvent('sg:stageready', { detail: { stage } }));
    });
    return () => {
      disposed = true;
      if (stage) { stage.dispose(); stage = null; window.dispatchEvent(new CustomEvent('sg:stagedispose')); }
    };
  });

  // ---- Remix (seeded choreography) ----
  const seed = currentSeed();
  let roll = rollChoreography(seed);
  const remixMount = header?.querySelector('[data-mount="remix"]');
  if (remixMount) {
    mountRemix({
      mount: remixMount,
      seed,
      onRoll: r => {
        roll = r;
        playBlip({ freq: 440 + (r.seed % 200) });
        stage?.pulse(r.accent);
      },
    });
  }

  // ---- Konami → chaos mode (inert under reduced motion / Calm; motionAllowed() gates the effect only) ----
  initKonami(() => {
    if (!motionAllowed()) return;
    document.documentElement.classList.add('chaos-mode');
    confettiBurst({ x: window.innerWidth / 2, y: window.innerHeight * 0.3 }, { count: 140 });
    ['products', 'methods', 'brokers'].forEach((hue, i) => setTimeout(() => stage?.pulse(hue), i * 220));
  });
  onChaosMode(({ on }) => { if (!on) document.documentElement.classList.remove('chaos-mode'); });

  // ---- Cross-document View Transitions: skip under Calm (visual.css already gates reduced-motion). ----
  const skipIfCalm = e => { if (!motionAllowed()) e.viewTransition?.skipTransition?.(); };
  window.addEventListener('pageswap', skipIfCalm);
  window.addEventListener('pagereveal', skipIfCalm);

  return {
    getStage: () => stage,
    roll,
    openModal,
    closeModal,
    esc,
    ls, lsSet, ss, ssSet,
    glossaryTooltips: root => glossaryTooltips(root, glossary),
  };
}

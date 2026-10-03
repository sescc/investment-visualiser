// brokers.js — the visual edition's Brokers page (site/visual/brokers.html). Same content as stable's
// site/brokers.html + site/js/brokers.js (every broker type, same headings/intro copy incl. the CDP vs
// custodian explainer, same card content, same providers table, same fee-drag calculator behaviour) —
// staged two ways: broker types become a "choose your fighter" character-select grid (holo tilt, animated
// meter bars, a sign-up "quest" modal), and the fee calculator is staged as "The Fee Race" — a racetrack
// visualisation layered on top of calc.js's onResult() callback, with calc.js's own accessible panel kept
// directly below it for the real controls, table and incomplete list.
//
// Local helpers below (crown, freshnessBadgeHTML, feeLineHTML/renderFeeLine, providersTableHTML,
// questStepsHTML, emptyStatePanel, meterBarsHTML — the fee-display decision tree) are intentionally
// re-implemented rather than imported from site/js/components.js, for the same reason hub.js/methods.js
// give (components.js pulls in the entire *stable* page-chrome module). None of these helpers make a
// costing/ranking decision — feeSummary, bestFeeComponent, rankByCost and computeCost itself all still
// come from feeview.js/data.js/cost.js untouched. The fee calculator itself is calc.js (owned by the
// methods page agent, shared with methods/compare) — see that file's header for its API. The Fee Race
// NEVER computes a cost itself: it only reads the { ranked, incomplete, scenario, group } calc.js hands
// it via onResult and re-renders the same numbers as a racetrack.

import { getData, bestFeeComponent } from '../../js/data.js';
import { feeSummary, freshnessView } from '../../js/feeview.js';
import { rankByCost, formatSGD, describeScenario, DEFAULT_SCENARIO, COST_GROUPS } from '../../js/cost.js';
import { icon } from '../../js/icons.js';
import { mountShell, esc } from './shell.js';
import { motionAllowed, onMotionChange, whenGsap, splitHeadline, scene, scrubHeading, refreshScenes } from './motion.js';
import { onRemix } from './chaos.js';
import { mountVisualCalculator } from './calc.js';
import { confettiBurst, playBlip } from './fx.js';

function h(strings, ...vals) {
  return strings.reduce((acc, s, i) => acc + s + (vals[i] ?? ''), '');
}

// ============================================================================
// Local helpers (see file header for why these aren't imported from stable modules)
// ============================================================================

function crown(label = 'Cheapest') {
  return h`<span class="crown" title="${esc(label)}">${icon('crown', { size: 14 })}<span class="sr-only">${esc(label)}</span></span>`;
}

const FRESH_META = { live: { cls: 'badge-live', icon: 'check' }, aging: { cls: 'badge-aging', icon: 'info' }, stale: { cls: 'badge-stale', icon: 'warning' }, missing: { cls: 'badge-missing', icon: 'warning' } };

function freshnessBadgeHTML(component) {
  const view = freshnessView(component);
  const meta = FRESH_META[view.state];
  const asOf = view.asOfText ? ` · ${view.asOfText}` : '';
  const badge = h`<span class="badge ${meta.cls}">${icon(meta.icon, { size: 12 })} ${view.label}${asOf}</span>`;
  if (!view.href) return badge;
  return h`<a class="badge-link" href="${esc(view.href)}" target="_blank" rel="noopener" title="Source: ${esc(view.href)}">${badge}</a>`;
}

function renderFeeLine(summary) {
  switch (summary.kind) {
    case 'yield-range': {
      const { low, best, yields } = summary;
      return h`<span class="fee-line" title="${esc(yields.map(y => `${y.label || 'Rate'}: ${y.value}%`).join('\n'))}">${icon('bill', { size: 14 })} Yield ${low}–${best.value}% <span class="muted">(best: ${esc(best.label || '')})</span> ${freshnessBadgeHTML(best)}</span>`;
    }
    case 'yield':
      return h`<span class="fee-line">${icon('bill', { size: 14 })} Yield ${summary.comp.value}% ${freshnessBadgeHTML(summary.comp)}</span>`;
    case 'exchange':
      return h`<span class="fee-line">${icon('bill', { size: 14 })} ${summary.comps.map(f => `${esc(f.label)} ${f.value}%`).join(' · ')} <span class="muted">per trade, on top of broker fees</span> ${freshnessBadgeHTML(summary.oldest)}</span>`;
    case 'from':
      return h`<span class="fee-line">${icon('bill', { size: 14 })} From ${summary.comp.value}${summary.unit} ${freshnessBadgeHTML(summary.comp)}</span>`;
    case 'via-broker':
      return h`<span class="fee-line muted">${icon('bill', { size: 14 })} Fees via your broker →</span>`;
    case 'untracked':
    default:
      return h`<span class="fee-line muted">${icon('bill', { size: 14 })} Fees not tracked yet</span>`;
  }
}

function feeLineHTML(entry) {
  const summary = feeSummary(entry);
  const line = renderFeeLine(summary);
  // compareLinkFor only ever matches product ids (p-*), so a broker-type entry never produces the
  // nested <a>. Kept as a plain summary-kind switch anyway so this stays a faithful port of
  // components.js/methods.js's identical renderer.
  if (!summary.compareLink) return line;
  return h`${line} <a class="fee-compare-link" href="${esc(summary.compareLink.href)}">Compare what it costs to buy → ${esc(summary.compareLink.groupLabel.toLowerCase())}</a>`;
}

/** Three bar meters (Risk / Liquidity / Complexity). Rendered at scaleX(0) (brokers.css default); call
 * animateMeters() on the mounted root to grow them in to their real value via `transform` (never
 * `width` — perf rule) — a no-op jump-to-final under !motionAllowed() (see the CSS transition's
 * reduced-motion/is-calm override in brokers.css). */
function meterBarsHTML(entry) {
  const rows = [['Risk', entry.riskLevel], ['Liquidity', entry.liquidity], ['Complexity', entry.complexity]];
  return h`<div class="fighter-meters">${rows.map(([label, v]) => {
    const clamped = Math.max(0, Math.min(5, v || 0));
    const pct = (clamped / 5) * 100;
    return h`
      <div class="fighter-meter">
        <span>${esc(label)}</span>
        <span class="fighter-meter-track" role="img" aria-label="${esc(label)}: ${clamped} of 5">
          <span class="fighter-meter-fill" data-pct="${pct}"></span>
        </span>
      </div>`;
  }).join('')}</div>`;
}

function animateMeters(root) {
  const fills = root.querySelectorAll('.fighter-meter-fill');
  if (!fills.length) return;
  if (!motionAllowed()) { fills.forEach(f => { f.style.transform = `scaleX(${f.dataset.pct / 100})`; }); return; }
  requestAnimationFrame(() => requestAnimationFrame(() => { fills.forEach(f => { f.style.transform = `scaleX(${f.dataset.pct / 100})`; }); }));
}

function providerTagsHTML(provider) {
  return provider.tags?.length ? h`<div class="provider-tags">${provider.tags.map(t => `<span class="provider-tag">${esc(t)}</span>`).join('')}</div>` : '';
}

function providersTableHTML(entry, scenario, fx) {
  const providers = entry.providers || [];
  if (!providers.length) return '<p class="muted">No specific providers listed yet.</p>';
  const { ranked, incomplete } = rankByCost(providers, scenario, fx);
  const rows = [];
  ranked.forEach((r, i) => rows.push(h`
    <tr>
      <td>${i === 0 ? crown() : ''} ${esc(r.item.name)}${providerTagsHTML(r.item)}</td>
      <td>${formatSGD(r.total)}</td>
      <td>${freshnessBadgeHTML(bestFeeComponent(r.item))}</td>
      <td><a class="btn btn-ghost" href="${esc(r.item.officialLink)}" target="_blank" rel="noopener">${icon('external', { size: 14 })} Site</a></td>
    </tr>`));
  incomplete.forEach(r => rows.push(h`
    <tr class="is-incomplete">
      <td>${esc(r.item.name)}${providerTagsHTML(r.item)}</td>
      <td class="muted">—</td>
      <td class="muted" title="${esc(r.reasons.join('; '))}">${icon('warning', { size: 12 })} incomplete</td>
      <td><a class="btn btn-ghost" href="${esc(r.item.officialLink)}" target="_blank" rel="noopener">${icon('external', { size: 14 })} Site</a></td>
    </tr>`));
  return h`
    <div class="table-scroll">
      <table class="data-table providers-table">
        <caption class="sr-only">Providers for ${esc(entry.name)}, ranked by cost for: ${esc(describeScenario(scenario))}</caption>
        <thead><tr><th>Provider</th><th>Est. cost</th><th>Data</th><th></th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

function questStepsHTML(entry) {
  const steps = entry.steps?.length ? entry.steps : [{ title: 'Details coming soon', detail: 'Sign-up steps for this entry have not been written yet.', link: entry.officialLink }];
  return steps.map((s, i) => h`
    <div class="fighter-quest-step">
      <span class="fighter-quest-num" aria-hidden="true">${i + 1}</span>
      <div class="fighter-quest-body">
        <label class="fighter-quest-check"><input type="checkbox" data-action="toggle-step" data-idx="${i}"> <span>Step ${i + 1}: ${esc(s.title)}</span></label>
        <p>${esc(s.detail)}</p>
        ${s.link ? h`<a class="btn btn-ghost" href="${esc(s.link)}" target="_blank" rel="noopener">${icon('external', { size: 14 })} Open official page</a>` : ''}
      </div>
    </div>`).join('');
}

function emptyStatePanel(container, { title = 'No data yet', detail = 'Run the scraper to generate data.' } = {}) {
  container.innerHTML = h`
    <div class="panel" style="text-align:center">
      ${icon('warning', { size: 32 })}
      <h3>${esc(title)}</h3>
      <p>${esc(detail)}</p>
      <code>npm run scrape</code>
    </div>`;
}

// ============================================================================
// Ownership diagram scene — the CDP-vs-custodian explainer SVG (brokers.html section 2). Lane 1's two
// arrows draw in sequence (DrawSVG) while a decorative "share certificate" chip travels from the You box
// all the way to the CDP box; lane 2's arrow then draws and a second chip travels into the pooled
// (nominee) box and shrinks/fades slightly to read as "merging" with other clients' holdings. All SVG
// text and the legend paragraph below it are never touched by this scene — they're static markup, always
// fully readable, both boxes' resting positions are the same before/without motion.
// ============================================================================

function mountOwnershipScene(section) {
  return scene(section, (tl, { gsap }) => {
    if (!window.DrawSVGPlugin) return;
    const svg = section.querySelector('.diagram-svg');
    if (!svg) return;
    const arrow1 = svg.querySelector('path[d="M160 55 H280"]');
    const arrow2 = svg.querySelector('path[d="M440 55 H560"]');
    const arrow3 = svg.querySelector('path[d="M160 190 H280"]');
    const chipCdp = svg.querySelector('#ownership-chip-cdp');
    const chipPooled = svg.querySelector('#ownership-chip-pooled');
    if (!arrow1 || !arrow2 || !arrow3) return;

    gsap.set([arrow1, arrow2, arrow3], { drawSVG: '0%' });
    // Chips are authored (in brokers.html) at their FINAL resting spot in each box's empty corner, clear
    // of any centred text; the offset below is "as if" the chip started at that lane's You box, and the
    // scene tweens it back to (0,0) — never the reverse — so under !motionAllowed() the chip simply sits
    // at its correct final position with no code path needed to force it there.
    if (chipCdp) gsap.set(chipCdp, { x: -685, y: 13, opacity: 0 });
    if (chipPooled) gsap.set(chipPooled, { x: -505, y: 13, opacity: 0 });

    tl.addLabel('lane1');
    tl.to(arrow1, { drawSVG: '100%', duration: 1, ease: 'none' }, 'lane1');
    tl.to(arrow2, { drawSVG: '100%', duration: 1, ease: 'none' }, 'lane1+=1');
    if (chipCdp) {
      tl.to(chipCdp, { opacity: 1, duration: 0.2, ease: 'none' }, 'lane1');
      tl.to(chipCdp, { x: 0, y: 0, duration: 2, ease: 'none' }, 'lane1');
    }

    tl.addLabel('lane2');
    tl.to(arrow3, { drawSVG: '100%', duration: 1, ease: 'none' }, 'lane2');
    if (chipPooled) {
      tl.to(chipPooled, { opacity: 1, x: 0, y: 0, duration: 1, ease: 'none' }, 'lane2');
      tl.to(chipPooled, { scale: 0.6, opacity: 0.55, duration: 0.4, ease: 'none' }, 'lane2+=1');
    }
  }, { pin: true, length: 1.5 });
}

// ============================================================================
// "Choose your fighter" — character-select card + modal
// ============================================================================

function fighterCardHTML(entry) {
  // The deal-in scene (mountFightersScene, below) animates the OUTER `.fighter-slot` wrapper's transform,
  // never `.fighter-card` itself: the card carries `data-tilt`/`data-magnetic` (fx.js), which writes its
  // own `style.transform` on hover, and two writers on one element's transform fight each other.
  return h`
    <div class="fighter-slot">
      <button type="button" class="foil-card fighter-card" data-tilt data-magnetic data-id="${esc(entry.id)}" aria-haspopup="dialog">
        <div class="fighter-card-head">
          <span class="fighter-card-icon">${icon(entry.icon || 'briefcase', { size: 24 })}</span>
          <div>
            <p class="fighter-card-category">${esc(entry.category || '')}</p>
            <h3 class="fighter-card-name">${esc(entry.name)}</h3>
          </div>
        </div>
        ${entry.analogy ? `<p class="fighter-card-analogy">${esc(entry.analogy)}</p>` : ''}
        <p class="fighter-card-summary">${esc(entry.summary)}</p>
        ${meterBarsHTML(entry)}
        <div class="card-fee">${feeLineHTML(entry)}</div>
        <span class="fighter-card-cta">${icon('key', { size: 14 })} Stats, fees &amp; sign-up quest →</span>
      </button>
    </div>`;
}

// ============================================================================
// Fighters deal-in scene — cards fan out from a centre stack into the grid. Text/meters stay at full
// opacity throughout (only transform moves), so there's never a "face-down" state — the scene is purely
// decorative motion layered on already-complete, already-readable cards.
// ============================================================================

function mountFightersScene(section, gridMount) {
  return scene(section, (tl, { gsap }) => {
    const slots = Array.from(gridMount.children);
    if (!slots.length) return;
    // NOT a shared centre stack (found in review: converging every card on one point put up to 15 text
    // elements from neighbouring cards under each other mid-flight, steps 6-8 of 12). Each card instead
    // rises straight up from directly below its OWN resting slot — x never changes, so a card's flight
    // rectangle never leaves its own column's horizontal range and can never cross a neighbouring
    // column's card. A modest per-card offset (120px, well under a card's own height/the row gap) keeps
    // same-column cards' flight paths inside their own row's lane, so an earlier row is already most of
    // the way to its resting spot before the row below starts rising into the space above it; the
    // stagger (index order = row-major DOM order) reinforces that earlier rows settle first.
    const RISE = 120;
    gsap.set(slots, { y: RISE, opacity: 1, scale: 0.94, rotate: i => (i % 2 ? 3 : -3) });
    tl.to(slots, { y: 0, scale: 1, rotate: 0, stagger: 0.09, duration: 0.6, ease: 'power3.out' });
  }, { pin: true, length: 1 });
}

function openFighterModal(entry, originEl, shellHandle, dataBundle) {
  const body = document.createElement('div');
  body.className = 'fighter-panel';
  body.innerHTML = h`
    <div class="fighter-head">
      <span class="fighter-icon">${icon(entry.icon || 'briefcase', { size: 26 })}</span>
      <div>
        <p class="fighter-card-category">${esc(entry.category || '')}</p>
        <h2 id="fighter-title" class="kinetic display-md">${esc(entry.name)}</h2>
        ${entry.analogy ? `<p class="fighter-analogy">${esc(entry.analogy)}</p>` : ''}
      </div>
    </div>
    <p>${esc(entry.summary)}</p>
    ${meterBarsHTML(entry)}
    <div class="card-fee">${feeLineHTML(entry)}</div>

    <div>
      <h3 class="fighter-section-title">${icon('info', { size: 16 })} Pros &amp; cons</h3>
      <div class="fighter-proscons">
        <div><h4>Pros</h4><ul>${(entry.pros || []).map(p => `<li>${esc(p)}</li>`).join('') || '<li class="muted">Not documented yet.</li>'}</ul></div>
        <div><h4>Cons</h4><ul>${(entry.cons || []).map(c => `<li>${esc(c)}</li>`).join('') || '<li class="muted">Not documented yet.</li>'}</ul></div>
      </div>
    </div>

    <div class="fighter-facts">
      ${entry.bestFor ? `<p><strong>Best for:</strong> ${esc(entry.bestFor)}</p>` : ''}
      ${entry.eligibility ? `<p><strong>Eligibility:</strong> ${esc(entry.eligibility)}</p>` : ''}
      ${entry.minAmount ? `<p><strong>Minimum:</strong> ${esc(entry.minAmount)}</p>` : ''}
    </div>

    <div>
      <h3 class="fighter-section-title">${icon('key', { size: 16 })} Sign-up quest</h3>
      <div class="fighter-quest">${questStepsHTML(entry)}</div>
    </div>

    <div>
      <h3 class="fighter-section-title">${icon('briefcase', { size: 16 })} Providers</h3>
      <div class="fighter-providers-table">${providersTableHTML(entry, DEFAULT_SCENARIO, dataBundle.fx)}</div>
    </div>

    <div class="fighter-actions">
      <a class="btn btn-primary" href="${esc(entry.officialLink || '#')}" target="_blank" rel="noopener">${icon('external', { size: 16 })} Official page</a>
    </div>`;

  shellHandle.openModal(body, { labelledBy: 'fighter-title', size: 'lg' });
  shellHandle.glossaryTooltips(body);
  animateMeters(body);

  const storeKey = `steps:${entry.id}`;
  let done = new Set();
  try { done = new Set(JSON.parse(shellHandle.ls(storeKey) || '[]')); } catch { done = new Set(); }
  body.querySelectorAll('[data-action="toggle-step"]').forEach(cb => {
    const idx = Number(cb.dataset.idx);
    cb.checked = done.has(idx);
    cb.addEventListener('change', () => {
      if (cb.checked) done.add(idx); else done.delete(idx);
      shellHandle.lsSet(storeKey, JSON.stringify([...done]));
    });
  });

  // Decorative "Flip from the card" entrance — no-op under reduced motion / Calm / a failed GSAP load;
  // content is already fully rendered and visible before/without this.
  if (motionAllowed() && originEl) {
    const dialog = document.querySelector('.modal-overlay .modal');
    if (dialog) {
      const originRect = originEl.getBoundingClientRect();
      whenGsap().then(gsap => {
        if (!gsap || !document.body.contains(dialog)) return;
        const dialogRect = dialog.getBoundingClientRect();
        gsap.fromTo(dialog, {
          x: originRect.left + originRect.width / 2 - (dialogRect.left + dialogRect.width / 2),
          y: originRect.top + originRect.height / 2 - (dialogRect.top + dialogRect.height / 2),
          scale: 0.2, opacity: 0,
        }, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' });
      });
    }
  }
}

// ============================================================================
// "The Fee Race" — a decorative racetrack layered over calc.js's onResult(). NEVER computes a cost:
// every number below comes straight from the { ranked, incomplete, scenario, group } payload calc.js
// hands it. The race track is pinned (NOT the calculator below it) and scroll IS the race clock: each
// lane's fill scales from 0 to its share of the most expensive total, over a slice of the scroll-scrub
// proportional to its own total, so the cheapest lane visually "finishes" first — same idea as the old
// laneDurationMs, just driven by scroll position instead of wall-clock time. Incomplete providers are
// never given a lane; they sit in the pit lane (rendered as plain, unpinned flow below the pinned track,
// so it's always fully on-screen and never squeezed into the pin) with their reasons and are never shown
// as winning. Ranks/names/totals/the banner are always the real final values from the moment they're
// rendered — only the fill/racer motion is decorative and tied to scroll.
// ============================================================================

function buildLaneEl(r) {
  const lane = document.createElement('div');
  lane.className = 'fee-race-lane';
  lane.dataset.id = r.item.id || r.item.name;
  lane.setAttribute('role', 'listitem');
  lane.innerHTML = h`
    <span class="fee-race-lane-rank" data-el="rank"></span>
    <span class="fee-race-lane-name">${esc(r.item.name)}</span>
    <div class="fee-race-lane-strip">
      <div class="fee-race-lane-fill"></div>
      <span class="fee-race-lane-racer" aria-hidden="true">🏎️</span>
      <span class="fee-race-lane-flag" aria-hidden="true">🏁</span>
    </div>
    <span class="fee-race-lane-total" data-el="total"></span>`;
  return lane;
}

// Relative GSAP-timeline weight per lane (units are arbitrary — the scrub owns real time); shape mirrors
// the old laneDurationMs so the cheapest lane still gets noticeably the shortest fill duration.
function laneWeight(total, maxTotal) {
  const t = maxTotal ? Math.min(1, (total || 0) / maxTotal) : 0;
  return 0.3 + t * 1.2;
}

// A rebuild debounce: number-input scenario changes fire on every keystroke, and a full tl.clear() +
// re-add + ScrollTrigger.refresh() on every one of those would be wasted work mid-typing. The DOM text
// (banner/ranks/totals/pit lane) still updates immediately on every call — only the scroll-scrubbed
// tween rebuild is debounced.
const RACE_REBUILD_DEBOUNCE_MS = 150;

// ---- PHOTO FINISH (signature spectacle, visual-journey task 3.4) --------------------------------------
// The moment the cheapest lane(s) reach their line: a camera flash behind the panel, a white flash inside
// the winning strip, viewfinder brackets that lock on around the lane, the lane punching in (scale) and a
// "PHOTO FINISH" stamp (or "DEAD HEAT" when two or more complete providers tie to the cent). Rules:
//  - Leaders come ONLY from the real onResult ranking (ranked[0].total, to the cent). Incomplete providers
//    never reach `ranked`, so a pit-lane row can never be a leader. The banner text and the index-0 crown
//    are untouched, so a tie still names exactly what the stable ranking names.
//  - Nothing here animates or computes a fee number; text (lane names/totals, banner) is never faded —
//    the only text-bearing tweens are scale (lane punch-in, stamp), and every overlay (glow, strip flash,
//    brackets) is text-free or sits BEHIND the content (z-index) with a tinted, low-peak opacity.
//  - Scale parts live on the race's scrubbed timeline (so Calm's ctx.revert() undoes them); the opacity
//    one-shots are a time-based gsap timeline that ends at opacity 0 with clearProps, has a setTimeout
//    safety net, and is killed whenever the lanes are re-rendered or motion is switched off.
const PF_TIE_EPS = 0.005;       // totals within half a cent are a dead heat
const PF_SAFETY_MS = 2600;      // hard stop for the one-shot, in case rAF stalls mid-flash
const APERTURE_SVG = '<svg class="pf-aperture" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3l4 7M20.4 8.5L13 9.5M20 16l-6-4M12 21l-4-7M3.6 15.5L11 14.5M4 8l6 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

function mountFeeRace(container, { getStage } = {}) {
  let lastPayload = { ranked: [], incomplete: [], scenario: DEFAULT_SCENARIO, group: null };
  let confettiFired = false;
  let rebuildTimer = null;
  // photo finish state
  let pfFired = false;       // the one-shot already played for this build/crossing
  let pfPending = false;     // crossed while off-screen; play when the panel next scrolls into view
  let pfWinT = Infinity;     // timeline time at which the leader(s) cross their line
  let pfTween = null;        // in-flight one-shot timeline
  let pfTimer = null;

  container.innerHTML = h`
    <div class="fee-race glass" data-el="pin">
      <span class="pf-glow" aria-hidden="true"></span>
      <div class="fee-race-head">
        <h3 class="kinetic display-md">The Fee Race</h3>
        <span class="pf-stamp" data-el="stamp" aria-hidden="true">${APERTURE_SVG}<span data-el="stamp-text"></span></span>
      </div>
      <p class="fee-race-banner" data-el="banner" aria-live="polite"></p>
      <div class="fee-race-track fee-race--fade-rise" data-el="track" role="list" aria-label="Broker fee race, ranked cheapest first"></div>
    </div>
    <div class="pit-lane" data-el="pit" hidden>
      <p class="pit-lane-heading">${icon('warning', { size: 14 })} Pit lane — incomplete data, excluded from the race:</p>
      <ul class="pit-lane-list" data-el="pit-list"></ul>
    </div>`;

  const pinEl = container.querySelector('[data-el="pin"]');
  const bannerEl = container.querySelector('[data-el="banner"]');
  const trackEl = container.querySelector('[data-el="track"]');
  const pitEl = container.querySelector('[data-el="pit"]');
  const pitListEl = container.querySelector('[data-el="pit-list"]');
  const stampEl = container.querySelector('[data-el="stamp"]');
  const stampTextEl = container.querySelector('[data-el="stamp-text"]');
  const glowEl = container.querySelector('.pf-glow');

  function isOnScreen(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 80 && r.top < window.innerHeight - 80;
  }

  /** Stops an in-flight one-shot and returns every decorative overlay to its CSS default (hidden). */
  function killPhoto() {
    clearTimeout(pfTimer);
    pfTimer = null;
    if (pfTween) { pfTween.kill(); pfTween = null; }
    const g = window.gsap;
    if (g) g.set([glowEl, ...trackEl.querySelectorAll('.pf-flash, .pf-frame')], { clearProps: 'opacity,transform' });
  }

  /** The time-based, opacity-only part: glow behind the panel, white flash in each leader's strip, and the
   * viewfinder brackets locking on around each leader lane. Ends at opacity 0 with clearProps. */
  function playPhoto(leaderLanes) {
    const gsap = window.gsap;
    killPhoto();
    const flashes = leaderLanes.map(l => l.querySelector('.pf-flash')).filter(Boolean);
    const frames = leaderLanes.map(l => l.querySelector('.pf-frame')).filter(Boolean);
    const all = [glowEl, ...flashes, ...frames];
    const done = () => { gsap.set(all, { clearProps: 'opacity,transform' }); pfTween = null; };
    const t = gsap.timeline({ onComplete: done });
    // Peak 0.3, brand-tinted and BEHIND the text (z-index) — a pale flash behind light text would crush contrast.
    t.fromTo(glowEl, { opacity: 0 }, { opacity: 0.3, duration: 0.08, ease: 'none' }, 0)
      .to(glowEl, { opacity: 0, duration: 0.5, ease: 'power2.out' }, 0.08);
    if (flashes.length) {
      t.fromTo(flashes, { opacity: 0 }, { opacity: 0.95, duration: 0.06, ease: 'none' }, 0)
        .to(flashes, { opacity: 0, duration: 0.35, ease: 'power2.out' }, 0.06);
    }
    if (frames.length) {
      t.fromTo(frames, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'power4.out' }, 0.04)
        .to(frames, { opacity: 0, duration: 0.45, ease: 'power1.in' }, 1.7);
    }
    pfTween = t;
    pfTimer = setTimeout(() => { if (pfTween) { pfTween.progress(1); } }, PF_SAFETY_MS);
  }

  /** Idempotent: plays the photo finish once per crossing. Off-screen => remembered until the panel is seen. */
  function firePhoto() {
    if (pfFired) return;
    const leaderLanes = Array.from(trackEl.querySelectorAll('[data-leader]'));
    if (!leaderLanes.length || !motionAllowed() || !window.gsap) return;
    if (!isOnScreen(pinEl)) { pfPending = true; return; }
    pfFired = true;
    pfPending = false;
    pinEl.dataset.pfCount = String((Number(pinEl.dataset.pfCount) || 0) + 1);
    playPhoto(leaderLanes);
  }

  // If motion is switched off mid-flash, drop the one-shot and the stamp (the scrubbed parts are reverted
  // by the scene's own ctx.revert()).
  const unsubMotion = onMotionChange(allowed => {
    if (allowed) return;
    killPhoto();
    pfFired = false; pfPending = false;
    pinEl.classList.remove('is-pf-live');
  });

  // addRaceTweens mutates the SAME timeline object scene() created inside its gsap.context() — never a
  // fresh standalone gsap.timeline() — so Calm/reduced-motion's ctx.revert() (run by scene()'s teardown)
  // still finds and reverts whatever this function most recently put on it, even though most calls happen
  // long after the context's own setup ran.
  function addRaceTweens(tl) {
    const gsap = window.gsap;
    tl.clear();
    confettiFired = false;
    pfFired = false;
    pfPending = false;
    pfWinT = Infinity;
    const ranked = lastPayload.ranked;
    if (!ranked.length) { gsap.set(stampEl, { clearProps: 'transform' }); return; }
    const maxTotal = Math.max(1, ...ranked.map(r => r.total || 0));
    let maxDur = 0;
    ranked.forEach(r => {
      const lane = trackEl.querySelector(`[data-id="${CSS.escape(String(r.item.id || r.item.name))}"]`);
      const fill = lane?.querySelector('.fee-race-lane-fill');
      const racer = lane?.querySelector('.fee-race-lane-racer');
      const strip = lane?.querySelector('.fee-race-lane-strip');
      if (!fill) return;
      const pct = Math.max(3, (r.total / maxTotal) * 100);
      const dur = laneWeight(r.total, maxTotal);
      maxDur = Math.max(maxDur, dur);
      gsap.set(fill, { scaleX: 0 });
      tl.to(fill, { scaleX: pct / 100, duration: dur, ease: 'none' }, 0);
      if (racer && strip) {
        gsap.set(racer, { x: 0 });
        tl.to(racer, { x: () => strip.clientWidth * (pct / 100), duration: dur, ease: 'none' }, 0);
      }
    });
    const winnerLane = trackEl.querySelector('.is-winner');
    // PHOTO FINISH, scrubbed part: the leader lane(s) cross their line at their own fill duration (the
    // cheapest lane is the shortest), so the punch-in + stamp are placed THERE, not at the end of the
    // race. Replaces the old end-of-race yoyo on the winner lane (two scale writers on one lane fight).
    // Scale only — the lane's names/totals and the stamp never lose opacity.
    const leaderLanes = Array.from(trackEl.querySelectorAll('[data-leader]'));
    if (leaderLanes.length) {
      pfWinT = laneWeight(ranked[0].total, maxTotal);
      tl.fromTo(leaderLanes, { scale: 1 }, { scale: 1.025, duration: 0.14, ease: 'back.out(3)' }, pfWinT);
      tl.fromTo(stampEl, { scale: 0, rotate: -14 }, { scale: 1, rotate: -4, duration: 0.18, ease: 'back.out(2.2)' }, pfWinT);
      pinEl.classList.add('is-pf-live');
      tl.call(() => {
        const st = tl.scrollTrigger;
        if (!st || st.direction <= 0) return;
        firePhoto();
      }, null, pfWinT);
    }
    tl.call(() => {
      const st = tl.scrollTrigger;
      if (!st || st.direction <= 0 || confettiFired) return;
      confettiFired = true;
      const rect = winnerLane?.querySelector('.fee-race-lane-strip')?.getBoundingClientRect();
      confettiBurst({ x: rect?.right ?? window.innerWidth / 2, y: (rect?.top ?? window.innerHeight / 2) + 10 }, { count: 50 });
      playBlip({ freq: 960 });
      try { getStage?.()?.pulse('brokers'); } catch { /* decorative — never block on this */ }
    }, null, maxDur);
    // ScrollTrigger instances don't expose gsap.core.Animation's `.eventCallback()` — set `vars.onUpdate`
    // directly (what ScrollTrigger itself reads on every scrub tick).
    if (tl.scrollTrigger) tl.scrollTrigger.vars.onUpdate = self => { if (self.progress < 1) confettiFired = false; };
    // Scrolled back above the finish line (the scrubbed PLAYHEAD, which lags the scroll position by the scrub
    // smoothing, is what matters — not the scroll progress): the next forward crossing plays it again.
    tl.eventCallback('onUpdate', () => { if (tl.time() < pfWinT - 0.001) pfFired = false; });
  }

  // One persistent pinned scene for the whole page's life — never destroyed/recreated per result (that
  // would drop the pin-spacer and jump the scroll position out from under whoever's looking at the
  // calculator below it). A result just clears and re-adds this same timeline's tweens.
  const raceScene = scene(pinEl, tl => { addRaceTweens(tl); }, { pin: true, length: 1.5 });

  function renderDom(payload) {
    const { ranked, incomplete, scenario, group } = payload;
    const groupLabel = COST_GROUPS[group]?.label.toLowerCase() || 'providers';
    const label = `Cheapest ${groupLabel} for ${describeScenario(scenario)}`;
    bannerEl.innerHTML = ranked.length
      ? h`${crown(label)} ${esc(label)}: <strong>${esc(ranked[0].item.name)}</strong>`
      : `No complete data for ${esc(groupLabel)}, ${esc(describeScenario(scenario))}.`;

    killPhoto(); // the lanes (and their flash/bracket overlays) are about to be replaced
    // Photo-finish leaders: every ranked provider whose total ties ranked[0] to the cent. Only `ranked`
    // (complete providers) is ever consulted, so a pit-lane provider can never lead.
    const leaderCount = ranked.length ? ranked.filter(r => Math.abs(r.total - ranked[0].total) < PF_TIE_EPS).length : 0;
    stampTextEl.textContent = leaderCount > 1 ? 'DEAD HEAT' : 'PHOTO FINISH';
    stampEl.hidden = !leaderCount;
    pinEl.dataset.pfLabel = leaderCount ? stampTextEl.textContent : '';

    trackEl.innerHTML = '';
    if (!ranked.length) {
      trackEl.innerHTML = '<p class="fee-race-empty muted">No complete data for this scenario.</p>';
    } else {
      const maxTotal = Math.max(1, ...ranked.map(r => r.total || 0));
      ranked.forEach((r, i) => {
        const lane = buildLaneEl(r);
        lane.classList.toggle('is-winner', i === 0);
        if (i < leaderCount) {
          lane.dataset.leader = '1';
          lane.insertAdjacentHTML('beforeend', '<span class="pf-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></span>');
          lane.querySelector('.fee-race-lane-strip').insertAdjacentHTML('beforeend', '<span class="pf-flash" aria-hidden="true"></span>');
        }
        lane.querySelector('[data-el="rank"]').innerHTML = i === 0 ? crown(label) : String(i + 1);
        trackEl.appendChild(lane);
        // Authored-final fallback for the fill (matches the CSS default of scaleX(0) otherwise) — real
        // motion (scaleX(0) → this pct) is only ever driven by the scroll-scrubbed scene above; under
        // !motionAllowed()/failed GSAP the scene never runs, so this inline value is what actually shows.
        const pct = Math.max(3, (r.total / maxTotal) * 100);
        lane.querySelector('.fee-race-lane-fill').style.transform = `scaleX(${pct / 100})`;
        // Every number here is the real, final computeCost result — never a tween, never mid-count.
        lane.querySelector('[data-el="total"]').textContent = formatSGD(r.total);
      });
    }

    if (incomplete.length) {
      pitEl.hidden = false;
      pitListEl.innerHTML = incomplete.map(r => h`<li class="pit-lane-item"><span class="pit-lane-name">${esc(r.item.name)}</span> — ${esc(r.reasons.join('; '))}</li>`).join('');
    } else {
      pitEl.hidden = true;
      pitListEl.innerHTML = '';
    }
  }

  function scheduleRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      const tl = raceScene.timeline;
      const st = tl?.scrollTrigger;
      if (tl && st) {
        addRaceTweens(tl);
        // Restore progress from the current scroll position immediately — scrolling back never shows an
        // old ranking, and a result that arrives off-screen or after the scene completed just shows the
        // final state at whatever progress the ScrollTrigger already computes for where we are now.
        tl.progress(st.progress);
        // Scenario changed while the race is already past the finish line (the usual case: the calculator
        // sits BELOW the pinned race): re-fire the photo finish for the new result. firePhoto() is
        // idempotent, so it doesn't matter whether the seek above also ran the timeline's own call.
        if (lastPayload.ranked.length && tl.time() >= pfWinT) firePhoto();
      }
      refreshScenes();
    }, RACE_REBUILD_DEBOUNCE_MS);
  }

  // Crossed (or rebuilt past the line) while the panel was off-screen: play once it is actually seen.
  const pfIo = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
      if (!pfPending || !entries.some(e => e.isIntersecting)) return;
      const tl = raceScene.timeline;
      if (tl && tl.time() >= pfWinT) firePhoto();
    }, { threshold: 0.35 })
    : null;
  pfIo?.observe(pinEl);

  return {
    onResult(payload) {
      lastPayload = payload;
      renderDom(payload);
      scheduleRebuild();
    },
    /** Decorative only (chaos.js roll): which racer size + stripe accent this visit gets. */
    applyRoll(roll) {
      trackEl.className = `fee-race-track fee-race--${roll.entrance}`;
      container.style.setProperty('--fee-race-stripe-a', `var(--world-${roll.accent}-soft)`);
    },
    /** Remix re-races: a one-shot, time-based 1.2s replay of the CURRENT result — only when the scroll
     * scene has already played all the way through, so this never fights an in-progress scrub and is
     * never itself infinite/looping. */
    replay() {
      const tl = raceScene.timeline;
      const st = tl?.scrollTrigger;
      if (!tl || !st || st.progress < 1 || !window.gsap) return;
      window.gsap.fromTo(tl, { progress: 0 }, { progress: 1, duration: 1.2, ease: 'power1.inOut' });
    },
    destroy() { pfIo?.disconnect(); unsubMotion(); killPhoto(); clearTimeout(rebuildTimer); raceScene.destroy(); },
  };
}

// ============================================================================
// Boot — placed last so every helper above is fully initialized before this synchronous top-level code
// runs (same convention as hub.js/methods.js).
// ============================================================================

const data = await getData();
const shell = await mountShell({ page: 'brokers.html', data });

// Text stays ≥0.85 opacity throughout splitHeadline's own stagger-in (law 6); it reverts to the plain
// text node ~1.2s after starting (see motion.js), so the hero drift-out scene below animates the whole
// `.brokers-hero` block, not individual chars, which no longer exist as separate elements by scroll time.
splitHeadline(document.getElementById('brokers-headline'), { opacity: 0.85 });

// Hero drift-out — replaces the old fire-and-forget reveal(), which started the hero at opacity:0 (a
// law-6 violation on its own, and would have fought this scene for the same element).
scene(document.querySelector('.hero-section'), (tl, { gsap }) => {
  const hero = document.querySelector('.brokers-hero');
  if (!hero) return;
  tl.to(hero, { yPercent: -16, rotateX: 6, opacity: 0.85, ease: 'none' });
}, { length: 1 });

// Ownership diagram scene — mounted regardless of whether any broker data loaded (the explainer SVG is
// always present static markup).
mountOwnershipScene(document.getElementById('ownership-heading')?.closest('.visual-section'));

// Backdrop formation per section, as it enters — decorative only (shell.getStage()/backdrop.js).
// backdrop.js's mountBackdrop() now auto-observes every `main section[data-formation]` on its own
// (2026-09-27 dedup — this page used to run its own IntersectionObserver + initial-formation call; both
// are gone, folded into the shared observer, since the hero section's own `data-formation="grid"` is
// exactly what this page's initial formation used to be set to).

document.querySelectorAll('h2.kinetic').forEach(h2 => scrubHeading(h2));

const brokers = data.brokers.entries;
const getEntry = id => brokers.find(e => e.id === id) || null;
const fightersMount = document.getElementById('brokers-fighters');
const fightersSection = document.getElementById('fighters-heading')?.closest('.visual-section');
const emptyMount = document.getElementById('brokers-empty');

if (!brokers.length) {
  document.getElementById('fee-race-mount').innerHTML = '';
  document.getElementById('calc-mount').innerHTML = '';
  emptyStatePanel(emptyMount, { title: 'No broker data yet', detail: 'Run npm run scrape to generate data, then reload this page.' });
} else {
  fightersMount.innerHTML = brokers.map(fighterCardHTML).join('');
  animateMeters(fightersMount);
  mountFightersScene(fightersSection, fightersMount);
  fightersMount.querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = getEntry(btn.dataset.id);
      if (entry) openFighterModal(entry, btn, shell, data);
    });
  });

  const items = brokers.flatMap(b => (b.providers?.length ? b.providers.map(p => ({ item: p, world: 'brokers' })) : [{ item: b, world: 'brokers' }]));

  const feeRace = mountFeeRace(document.getElementById('fee-race-mount'), { getStage: () => shell.getStage() });
  feeRace.applyRoll(shell.roll);

  mountVisualCalculator(document.getElementById('calc-mount'), {
    items, fx: data.fx, initialGroup: 'brokers', title: 'The full calculator',
    getStage: () => shell.getStage(),
    onResult: payload => feeRace.onResult(payload),
  });

  onRemix(({ roll }) => {
    feeRace.applyRoll(roll);
    feeRace.replay();
  });
}

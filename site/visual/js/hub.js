// hub.js — the visual edition's hub page (site/visual/index.html). Reference implementation for the
// four Wave C pages: shows how to mount the shell, read shared content/data/fee view-models, and layer
// spectacle on top of always-visible real content via motion.js's motionScope.
//
// Sections: kinetic hero + scroll-scrubbed portal journey, a swipeable quiz card stack with a slot-reel
// result, a 3D risk/liquidity "bubble galaxy" (with a permanent <details> table alternative), and
// holographic-tilt world cards. Same copy, same quiz logic, same teaser text as the stable hub — see
// each section's comment for exactly which stable text/behaviour it mirrors.
//
// Local helpers below (crown, emptyStatePanel, bubbleTableRows, buildTableDetails, the diverging
// colour scale) are intentionally re-implemented rather than imported from site/js/components.js or
// site/js/charts.js: both of those modules import each other (charts.js imports components.js for
// onThemeChange), and pulling in components.js would drag the entire stable page-chrome module into
// the visual bundle. None of these helpers make a fee/costing decision — costGroupOf, computeCost,
// rankByCost and teaserData itself all still come from cost.js/content.js untouched.

import { getData, isEmpty, buildCompareUrl } from '../../js/data.js';
import { WORLD_META, teaserData, QUESTIONS, pickQuizResult } from '../../js/content.js';
import { icon } from '../../js/icons.js';
import { mountShell, esc } from './shell.js';
import { motionAllowed, motionScope, whenGsap, splitHeadline, reveal, hasWebGL, renderLoop } from './motion.js';
import { loadThreeModules } from './stage.js';
import { confettiBurst, playBlip } from './fx.js';
import { onRemix } from './chaos.js';

// ============================================================================
// Local helpers (see file header for why these aren't imported from stable modules)
// ============================================================================

function crown(label = 'Cheapest right now') {
  return `<span class="crown" title="${esc(label)}">${icon('crown', { size: 14 })}<span class="sr-only">${esc(label)}</span></span>`;
}

function emptyStatePanel(container, { title = 'No data yet', detail = 'Run the scraper to generate data.' } = {}) {
  container.innerHTML = `
    <div class="panel" style="text-align:center">
      ${icon('warning', { size: 32 })}
      <h3>${esc(title)}</h3>
      <p>${esc(detail)}</p>
      <code>npm run scrape</code>
    </div>`;
}

function buildTableDetails(headers, rows) {
  return `
    <details class="chart-table">
      <summary>Show as table</summary>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>${headers.map(hh => `<th>${esc(hh)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </details>`;
}

// Same row shape as stable's charts.js:bubbleTableRows.
function bubbleTableRows(products) {
  return products.map(p => [p.name, p.riskLevel, p.liquidity, p.complexity, typeof p.growthVsDividend === 'number' ? `${p.growthVsDividend}% growth / ${100 - p.growthVsDividend}% income` : '—']);
}

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 128, g: 128, b: 128 };
}
function lerpRgb(aHex, bHex, t) {
  const a = hexToRgb(aHex), b = hexToRgb(bHex);
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}
// Same diverging teal↔amber scale as stable's charts.js:divergingColor, returned as 0-255 components.
function divergingColorRgb(v) {
  const growth = cssVar('--growth') || '#0f8b8d';
  const income = cssVar('--income') || '#d98a12';
  const neutral = cssVar('--muted') || '#8a909c';
  const x = Math.max(0, Math.min(100, v ?? 50));
  return x >= 50 ? lerpRgb(neutral, growth, (x - 50) / 50) : lerpRgb(income, neutral, x / 50);
}

// ============================================================================
// Boot
// ============================================================================

const data = await getData();
const shellHandle = await mountShell({ page: 'index.html', data });

mountHero(shellHandle);
mountQuiz(data);
mountGalaxy(data);
mountWorldCards(data);

onRemix(() => { if (motionAllowed()) playBlip({ freq: 600 }); });

// ============================================================================
// 1. Hero — kinetic headline + scroll-scrubbed portal journey (same headline/intro/labels as stable)
// ============================================================================

async function mountHero(shell) {
  const headline = document.getElementById('hero-headline');
  splitHeadline(headline, {});
  reveal(document.querySelector('.diagram-card'), { from: { opacity: 0, y: 30 }, delay: 0.15 });

  motionScope(() => {
    let ctx = null;
    let cancelled = false;
    (async () => {
      const gsap = await whenGsap();
      if (cancelled || !gsap || !window.MotionPathPlugin || !window.ScrollTrigger) return;
      const coin = document.getElementById('journey-coin');
      if (!coin) return;
      coin.style.display = '';
      ctx = gsap.context(() => {
        gsap.to(coin, {
          motionPath: { path: '#journey-path', align: '#journey-path', alignOrigin: [0.5, 0.5] },
          ease: 'none',
          scrollTrigger: { trigger: '.diagram-card', start: 'top 80%', end: 'bottom 40%', scrub: 0.6 },
        });
      });
    })();
    return () => {
      cancelled = true;
      ctx?.revert();
      const coin = document.getElementById('journey-coin');
      if (coin) coin.style.display = 'none';
    };
  });

  const setNebula = () => shell.getStage()?.setFormation('nebula');
  if (shell.getStage()) setNebula();
  window.addEventListener('sg:stageready', setNebula, { once: true });
}

// ============================================================================
// 2. Quiz — same QUESTIONS/scoring/result as stable (content.js), swipeable card stack + slot reveal
// ============================================================================

function mountQuiz(data) {
  const mount = document.getElementById('quiz-mount');
  const answers = {};
  let qIdx = 0;

  function renderQuiz() {
    if (qIdx >= QUESTIONS.length) return renderResult();
    const step = QUESTIONS[qIdx];
    mount.innerHTML = `
      <div class="quiz glass">
        <div class="quiz-progress-track"><div class="quiz-progress-fill" style="width:${(qIdx / QUESTIONS.length) * 100}%"></div></div>
        <p class="quiz-progress">Question ${qIdx + 1} of ${QUESTIONS.length}</p>
        <div class="quiz-card" data-tilt>
          <h3 class="kinetic display-md">${esc(step.q)}</h3>
          <div class="quiz-options">
            ${step.options.map((o, i) => `<button type="button" class="quiz-option" data-i="${i}">${esc(o.label)}</button>`).join('')}
          </div>
        </div>
        ${qIdx > 0 ? `<button type="button" class="btn btn-ghost" data-action="quiz-back" style="margin-top:14px">Back</button>` : ''}
      </div>`;
    const card = mount.querySelector('.quiz-card');
    mount.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => selectOption(step, Number(btn.dataset.i), card));
    });
    mount.querySelector('[data-action="quiz-back"]')?.addEventListener('click', () => { qIdx -= 1; renderQuiz(); });
    wireDrag(card, step);
  }

  function selectOption(step, i, card) {
    answers[step.key] = step.options[i].value;
    playBlip({ freq: 500 + i * 60 });
    const dir = i === 0 ? -1 : i === step.options.length - 1 ? 1 : 0;
    flyOff(card, dir, () => { qIdx += 1; renderQuiz(); });
  }

  function flyOff(card, dir, done) {
    if (!card || !motionAllowed()) { done(); return; }
    whenGsap().then(gsap => {
      if (!gsap) { done(); return; }
      gsap.to(card, { x: dir * 340, rotate: dir * 12, opacity: 0, duration: 0.32, ease: 'power2.in', onComplete: done });
    });
  }

  // Fling left = first option, fling right = last option (accessible primary control is always the
  // tap buttons above — this is a bonus gesture, only wired when motion is allowed).
  function wireDrag(card, step) {
    if (!card || step.options.length < 2 || !motionAllowed()) return;
    whenGsap().then(gsap => {
      if (!gsap || !window.Draggable || !motionAllowed()) return;
      Draggable.create(card, {
        type: 'x',
        inertia: !!window.InertiaPlugin,
        onDragEnd() {
          const threshold = 100;
          if (this.x > threshold) selectOption(step, step.options.length - 1, card);
          else if (this.x < -threshold) selectOption(step, 0, card);
          else gsap.to(card, { x: 0, duration: 0.3 });
        },
      });
    });
  }

  function renderResult() {
    if (isEmpty(data)) {
      // Same empty-state copy as stable's index.js.
      mount.innerHTML = `<div class="quiz glass"><p class="muted">No data loaded yet — run <code>npm run scrape</code> to see personalised suggestions.</p>
        <button type="button" class="btn btn-ghost" data-action="quiz-restart">Start over</button></div>`;
      mount.querySelector('[data-action="quiz-restart"]').addEventListener('click', () => { qIdx = 0; renderQuiz(); });
      return;
    }

    const { bestProduct, bestMethod, bestBroker, scenario, ids } = pickQuizResult(data, answers);
    const compareUrl = buildCompareUrl({ ids, scenario });
    const results = [
      bestProduct && { icon: 'basket', label: 'Product', name: bestProduct.name, href: 'products.html' },
      bestMethod && { icon: 'key', label: 'Method', name: bestMethod.name, href: 'methods.html' },
      bestBroker && { icon: 'briefcase', label: 'Broker type', name: bestBroker.name, href: 'brokers.html' },
    ].filter(Boolean);

    mount.innerHTML = `
      <div class="quiz glass">
        <h3 class="kinetic display-md">Your suggested starting point</h3>
        <div class="quiz-result">
          ${results.map(r => `
            <div class="quiz-result-card">
              <strong>${icon(r.icon, { size: 16 })} ${esc(r.label)}:</strong>
              <div class="quiz-reel" data-reel data-name="${esc(r.name)}">
                <div class="quiz-reel-track"><div class="quiz-reel-item"><a href="${esc(r.href)}">${esc(r.name)}</a></div></div>
              </div>
            </div>`).join('')}
        </div>
        <div class="modal-actions" style="justify-content:flex-start; margin-top:16px">
          <a class="btn btn-primary" data-magnetic href="${compareUrl}">${icon('chart', { size: 16 })} Compare these &amp; see costs</a>
          <button type="button" class="btn btn-ghost" data-action="quiz-restart">Start over</button>
        </div>
      </div>`;
    mount.querySelector('[data-action="quiz-restart"]').addEventListener('click', () => {
      qIdx = 0;
      Object.keys(answers).forEach(k => delete answers[k]);
      renderQuiz();
    });

    confettiBurst({ x: window.innerWidth / 2, y: mount.getBoundingClientRect().top + 120 });
    playBlip({ freq: 880 });
    spinReels(mount, results);
  }

  // Content is already the final, linked result (see renderResult above) before this ever runs —
  // spinReels is a no-op under !motionAllowed(), and on any GSAP-load failure it just leaves the
  // final state in place instead of replacing it with the spin sequence.
  function spinReels(root, results) {
    if (!motionAllowed()) return;
    whenGsap().then(gsap => {
      if (!gsap) return;
      root.querySelectorAll('[data-reel]').forEach((reel, i) => {
        const track = reel.querySelector('.quiz-reel-track');
        const finalName = reel.dataset.name;
        const href = reel.querySelector('a')?.getAttribute('href') || '#';
        const decoys = results.map(r => r.name).filter(n => n !== finalName);
        const seq = [...decoys, ...decoys, finalName];
        if (seq.length < 2) return; // nothing to spin through
        track.innerHTML = seq.map((n, idx) => `<div class="quiz-reel-item">${idx === seq.length - 1 ? `<a href="${esc(href)}">${esc(n)}</a>` : esc(n)}</div>`).join('');
        const itemHeight = reel.offsetHeight || 1;
        gsap.fromTo(track, { y: 0 }, {
          y: -(seq.length - 1) * itemHeight, duration: 1 + i * 0.2, ease: 'power2.out', delay: i * 0.12,
          onComplete: () => { track.innerHTML = `<div class="quiz-reel-item"><a href="${esc(href)}">${esc(finalName)}</a></div>`; track.style.transform = ''; },
        });
      });
    });
  }

  renderQuiz();
}

// ============================================================================
// 3. Risk vs. access map — 3D bubble galaxy, with a permanent <details> table (same rows as stable)
// ============================================================================

async function mountGalaxy(data) {
  const mount = document.getElementById('galaxy-mount');
  const products = data.products.entries;
  if (!products.length) {
    emptyStatePanel(mount, { title: 'No product data yet', detail: 'Run npm run scrape to generate data, then reload this page.' });
    return;
  }

  const rows = bubbleTableRows(products);
  const legend = `<p class="chart-legend-text">${icon('info', { size: 14 })} X-axis: risk (1 very low – 5 very high). Y-axis: liquidity, how quickly you can get your money out (1 locked-in – 5 instant). Bubble size: complexity. Colour: teal leans toward capital growth, amber leans toward income.</p>`;
  mount.innerHTML = `<div data-el="galaxy-3d-slot"></div><p class="galaxy-fallback-note" data-el="galaxy-note" hidden></p>${buildTableDetails(['Product', 'Risk', 'Liquidity', 'Complexity', 'Return mix'], rows)}${legend}`;
  const slot = mount.querySelector('[data-el="galaxy-3d-slot"]');
  const note = mount.querySelector('[data-el="galaxy-note"]');
  const details = mount.querySelector('details');

  function showFallback(text) {
    note.hidden = false;
    note.textContent = text;
    details.open = true;
  }

  if (!hasWebGL()) {
    showFallback("3D view needs WebGL — here's the same data as a table.");
    return; // WebGL support doesn't change at runtime, so no motionScope needed for this branch.
  }

  // Show the fallback immediately when motion isn't allowed at mount time (e.g. `?calm=1`, Calm mode
  // already on, or reduced-motion): motionScope's setup() only runs once motion IS allowed, so relying
  // on its cleanup alone (as an earlier version of this function did) left the section looking empty —
  // found in Phase 2 verification with `?calm=1` from page load.
  if (!motionAllowed()) {
    showFallback("3D view needs motion — turn off Calm mode to see it, or here's the same data as a table.");
  }

  motionScope(() => {
    let disposed = false;
    let dispose = () => {};
    note.hidden = true; // setup() only ever runs while motion is allowed, so any prior fallback note is stale.
    buildGalaxy3D(slot, products).then(handle => {
      if (disposed) { handle?.dispose(); return; }
      if (!handle) {
        showFallback("3D view couldn't load — here's the same data as a table.");
        return;
      }
      dispose = handle.dispose;
    });
    return () => {
      disposed = true;
      dispose();
      slot.innerHTML = '';
      showFallback("3D view paused — Calm mode / reduced motion is on. Here's the same data as a table.");
    };
  });
}

async function buildGalaxy3D(slot, products) {
  let mod;
  try {
    mod = await loadThreeModules();
  } catch (e) {
    console.warn('[visual] galaxy: Three.js failed to load', e);
    return null;
  }
  const { THREE } = mod;

  const wrap = document.createElement('div');
  wrap.className = 'galaxy-wrap';
  const tooltip = document.createElement('span');
  tooltip.className = 'galaxy-tooltip';
  tooltip.setAttribute('aria-hidden', 'true');
  wrap.appendChild(tooltip);
  slot.appendChild(wrap);

  const width = wrap.clientWidth || 600;
  const height = wrap.clientHeight || 375;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    console.warn('[visual] galaxy: WebGLRenderer failed to init', e);
    wrap.remove();
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(width, height);
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
  camera.position.set(0, 0.6, 4.2);

  const group = new THREE.Group();
  scene.add(group);
  const meshes = products.map(p => {
    const x = ((p.riskLevel ?? 3) - 3) * 0.7;
    const y = ((p.liquidity ?? 3) - 3) * 0.6;
    const z = (Math.random() - 0.5) * 1.2;
    const r = 0.08 + (p.complexity ?? 1) * 0.035;
    const rgb = divergingColorRgb(p.growthVsDividend);
    const color = new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 20, 16),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1, emissive: color, emissiveIntensity: 0.25 }),
    );
    mesh.position.set(x, y, z);
    mesh.userData.entry = p;
    group.add(mesh);
    return mesh;
  });
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(2, 3, 4);
  scene.add(light);

  // Manual drag-to-orbit — no OrbitControls addon, to keep the addon list to what's already imported.
  let dragging = false, lastX = 0, lastY = 0;
  const onDown = e => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
  const onUp = () => { dragging = false; };
  const onDragMove = e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    group.rotation.y += dx * 0.006;
    group.rotation.x = Math.max(-0.6, Math.min(0.6, group.rotation.x + dy * 0.006));
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointermove', onDragMove);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;
  function pickAt(clientX, clientY) {
    const rect = wrap.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(meshes)[0]?.object || null;
  }
  const onMove = e => {
    const hit = pickAt(e.clientX, e.clientY);
    if (hit !== hovered) {
      if (hovered) hovered.scale.setScalar(1);
      hovered = hit;
      if (hovered) hovered.scale.setScalar(1.3);
    }
    if (hovered) {
      const rect = wrap.getBoundingClientRect();
      tooltip.textContent = hovered.userData.entry.name;
      tooltip.style.left = `${e.clientX - rect.left}px`;
      tooltip.style.top = `${e.clientY - rect.top}px`;
      tooltip.classList.add('is-visible');
    } else {
      tooltip.classList.remove('is-visible');
    }
  };
  // Convention for Wave C: a click here navigates to products.html#<entryId>. products.js can choose
  // to honour that hash (e.g. open that entry's pros/cons modal on load) — not wired up on this side.
  const onClick = e => {
    const hit = pickAt(e.clientX, e.clientY);
    if (hit) location.href = `products.html#${encodeURIComponent(hit.userData.entry.id)}`;
  };
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('click', onClick);

  const onResize = () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  const loop = renderLoop(dt => {
    if (!dragging) group.rotation.y += dt * 0.05;
    renderer.render(scene, camera);
  }, { canvas: renderer.domElement });

  function dispose() {
    loop.stop();
    renderer.domElement.removeEventListener('pointerdown', onDown);
    renderer.domElement.removeEventListener('pointermove', onMove);
    renderer.domElement.removeEventListener('click', onClick);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('resize', onResize);
    meshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
    renderer.dispose();
    wrap.remove();
  }

  return { dispose };
}

// ============================================================================
// 4. World cards — same teaser text/logic as stable (content.js:teaserData), foil tilt cards
// ============================================================================

function mountWorldCards(data) {
  const mount = document.getElementById('world-cards');
  mount.innerHTML = Object.entries(WORLD_META).map(([world, meta]) => {
    const count = data[world].entries.length;
    const t = teaserData(data, world);
    let teaser;
    if (t?.kind === 'yield') {
      teaser = `Top low-risk yield: <strong>${esc(t.entryName)}</strong> — ${t.value}%${t.label ? ` <span class="muted">(${esc(t.label)})</span>` : ''}`;
    } else if (t?.kind === 'cheapest') {
      teaser = `${crown('Cheapest right now')} Cheapest ${esc(t.groupLabel.toLowerCase())} for ${esc(t.presetLabel)}: <strong>${esc(t.name)}</strong> — ${esc(t.totalText)} over ${t.years} years`;
    } else {
      teaser = isEmpty(data) ? 'Fee data not loaded yet' : 'Fee data coming soon';
    }
    return `
      <a class="foil-card world-card world-${world}" data-tilt data-magnetic href="${esc(meta.href)}">
        <h3>${icon(meta.icon, { size: 22 })} ${esc(meta.tagline)}</h3>
        <span class="count">${count} ${count === 1 ? 'entry' : 'entries'}</span>
        <span class="teaser">${teaser}</span>
      </a>`;
  }).join('');
}

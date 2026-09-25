// Floating "try the other edition" button. Shared by both editions — the future site/visual/*.js
// pages import this same module with { edition: 'visual' } (see docs/visual/ARCHITECTURE.md:
// editionHref is a pure Location → URL morphism used by both).

const PULSE_SEEN_KEY = 'sg-edition-pulse-seen';

function ss(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function ssSet(key, val) {
  try { sessionStorage.setItem(key, val); } catch { /* ignore */ }
}

/** True when the location's path has a `/visual/` segment. */
export function isVisualEdition(loc = location) {
  return /(^|\/)visual\//.test(loc.pathname);
}

function pageFile(loc) {
  const path = loc.pathname;
  const last = path.slice(path.lastIndexOf('/') + 1);
  return last && last.includes('.') ? last : 'index.html';
}

/**
 * editionHref(loc) → relative URL of the matching page in the other edition, keeping the query
 * string and hash. A page `X.html` (or a directory index) under `/visual/` maps to `../X.html`;
 * a stable page `X.html` maps to `visual/X.html`. Relative, so a GitHub Pages repo subpath (or any
 * other base path) doesn't matter — it works from local dev and from Pages alike.
 */
export function editionHref(loc = location) {
  const file = pageFile(loc);
  const rel = isVisualEdition(loc) ? `../${file}` : `visual/${file}`;
  return rel + (loc.search || '') + (loc.hash || '');
}

// Both editions give their sticky header the `.topbar` class (visual's shell.js adds it alongside
// `.visual-topbar`) specifically so this measurement works unchanged on either edition.
function headerBottom() {
  const header = document.querySelector('.topbar');
  const rect = header?.getBoundingClientRect();
  return rect && rect.height > 0 ? rect.bottom : 60;
}

// The disclaimer isn't sticky — it scrolls with the page and sits right under the header until the
// page scrolls past it (or it's dismissed, which sets `hidden`). While any part of it still overlaps
// the header's row, the switch must sit below it instead of below the header, or it covers the
// disclaimer's own dismiss button. Once it's scrolled away (its bottom rises above the header's
// bottom) or dismissed, Math.max below naturally prefers the header again — no separate branch needed.
function disclaimerBottom() {
  const el = document.getElementById('app-disclaimer');
  if (!el || el.hidden) return -Infinity;
  const rect = el.getBoundingClientRect();
  return rect.bottom;
}

function positionSwitch(el) {
  const top = Math.max(headerBottom(), disclaimerBottom()) + 12;
  el.style.setProperty('--edition-switch-top', `${top}px`);
}

// rAF-throttled so scroll doesn't spam layout reads/writes.
function throttledToFrame(fn) {
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; fn(); });
  };
}

/**
 * mountEditionSwitch({ edition: 'stable' | 'visual' }) — appends the floating switch `<a>` to
 * document.body. Idempotent: a second call (e.g. a re-render of chrome) is a no-op.
 */
export function mountEditionSwitch({ edition } = {}) {
  if (document.querySelector('.edition-switch')) return;
  const isStable = edition !== 'visual';

  const a = document.createElement('a');
  a.className = `edition-switch edition-switch--${isStable ? 'stable' : 'visual'}`;
  a.href = editionHref();
  a.setAttribute('aria-label', isStable
    ? 'Feeling adventurous? Try the visual edition — same facts, a whole new ride.'
    : 'Back to the normal site.');

  if (isStable) {
    const ring = document.createElement('span');
    ring.className = 'edition-switch-ring';
    ring.setAttribute('aria-hidden', 'true');
    a.appendChild(ring);
  }

  const iconSpan = document.createElement('span');
  iconSpan.className = 'edition-switch-icon';
  iconSpan.setAttribute('aria-hidden', 'true');
  iconSpan.textContent = isStable ? '✨' : '↩';
  a.appendChild(iconSpan);

  const labelSpan = document.createElement('span');
  labelSpan.className = 'edition-switch-label';
  labelSpan.textContent = isStable
    ? 'Feeling adventurous? Try the visual edition ✨ — same facts, a whole new ride.'
    : 'Back to the normal site';
  a.appendChild(labelSpan);

  const caption = document.createElement('span');
  caption.className = 'edition-switch-caption';
  caption.setAttribute('aria-hidden', 'true');
  caption.textContent = isStable ? 'Try visual ✨' : 'Normal site';
  a.appendChild(caption);

  document.body.appendChild(a);

  const reposition = () => positionSwitch(a);
  const repositionOnScroll = throttledToFrame(reposition);
  reposition();
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', repositionOnScroll, { passive: true });

  // Recompute the instant the disclaimer is dismissed (its `hidden` attribute is set) so the switch
  // slides back up to just under the header rather than waiting for the next scroll/resize.
  const disclaimerEl = document.getElementById('app-disclaimer');
  if (disclaimerEl && 'MutationObserver' in window) {
    new MutationObserver(reposition).observe(disclaimerEl, { attributes: true, attributeFilter: ['hidden'] });
  }

  if (isStable) {
    // Gentle attention pulse, once per browser session, ~4s after load.
    if (!ss(PULSE_SEEN_KEY)) {
      ssSet(PULSE_SEEN_KEY, '1');
      setTimeout(() => {
        a.classList.add('is-pulsing');
        a.addEventListener('animationend', () => a.classList.remove('is-pulsing'), { once: true });
      }, 4000);
    }
  } else {
    // Visual: show the label briefly on first load, same as hover/focus.
    a.classList.add('is-introducing');
    setTimeout(() => a.classList.remove('is-introducing'), 3000);
  }

  return a;
}

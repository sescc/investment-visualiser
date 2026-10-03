// stops.js — the visual edition's journey order. A leaf module (imports nothing) on purpose: shell.js
// imports journey.js, so journey.js must not import shell.js, and both read the stop list from here.
//
// PUBLIC API
//   NAV_ITEMS            [{ href, label }] in journey order (Hub -> Products -> Methods -> Brokers -> Compare).
//   stopIndex(page)      0..4, or -1 for an unknown page.
//   nextStop(page)       { href, label, index } of the stop after `page`, or null for the last stop (Compare).
//   nextHref(page, loc)  nextStop(page).href plus `?seed=…&calm=…` — ONLY those two params carry over, read from
//                        `loc.search` at call time (Remix rewrites ?seed= via history.replaceState). `group`,
//                        `market`, `ids`, `scenario` and the #hash never carry. null for the last stop.
//   stopHref(href, loc)  any stop's href with the same carried query (used by the finale's recap links).

export const NAV_ITEMS = [
  { href: 'index.html', label: 'Hub' },
  { href: 'products.html', label: 'Products' },
  { href: 'methods.html', label: 'Methods' },
  { href: 'brokers.html', label: 'Brokers' },
  { href: 'compare.html', label: 'Compare' },
];

export function stopIndex(page) {
  return NAV_ITEMS.findIndex(n => n.href === page);
}

export function nextStop(page) {
  const i = stopIndex(page);
  if (i < 0 || i >= NAV_ITEMS.length - 1) return null;
  return { ...NAV_ITEMS[i + 1], index: i + 1 };
}

function carriedQuery(loc) {
  const src = new URLSearchParams(loc?.search || '');
  const out = new URLSearchParams();
  const seed = src.get('seed');
  if (seed !== null && seed !== '' && Number.isFinite(Number(seed))) out.set('seed', String(Number(seed)));
  if (src.get('calm') === '1') out.set('calm', '1');
  const s = out.toString();
  return s ? `?${s}` : '';
}

export function stopHref(href, loc = typeof location !== 'undefined' ? location : null) {
  return href + carriedQuery(loc);
}

export function nextHref(page, loc = typeof location !== 'undefined' ? location : null) {
  const n = nextStop(page);
  return n ? stopHref(n.href, loc) : null;
}

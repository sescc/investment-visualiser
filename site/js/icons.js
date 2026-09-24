// Inline SVG icon set. Stroke-based, 1.75px stroke, currentColor, 24x24 viewBox.
// Usage: import { icon } from './icons.js'; el.innerHTML = icon('shield', { size: 24, className: 'icon' });

const STROKE = 1.75;

// Each entry is the inner markup of a 0 0 24 24 viewBox, stroke-based unless noted.
const PATHS = {
  chart: '<path d="M4 19V5"/><path d="M4 19h16"/><rect x="7" y="11" width="3" height="6" rx="0.75"/><rect x="12.5" y="7" width="3" height="10" rx="0.75"/><rect x="18" y="13" width="3" height="4" rx="0.75"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.8 2.4 4.3 5.4 4.3 8.5s-1.5 6.1-4.3 8.5c-2.8-2.4-4.3-5.4-4.3-8.5S9.2 5.9 12 3.5Z"/>',
  basket: '<path d="M4 10h16l-1.6 9.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8L4 10Z"/><path d="M8 10 10 4"/><path d="M16 10 14 4"/><path d="M9 14v3"/><path d="M12 14v3"/><path d="M15 14v3"/>',
  building: '<rect x="5" y="3.5" width="14" height="17" rx="1"/><path d="M9 7.5h1.2M13.8 7.5H15M9 11h1.2M13.8 11H15M9 14.5h1.2M13.8 14.5H15"/><path d="M10 20.5V17h4v3.5"/>',
  jar: '<path d="M7 8h10l-.9 11.3a2 2 0 0 1-2 1.7H9.9a2 2 0 0 1-2-1.7L7 8Z"/><path d="M8.5 8V5.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V8"/><path d="M9.5 12.5h5"/>',
  shield: '<path d="M12 3.5 19 6.3v5.4c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6.3L12 3.5Z"/><path d="m9 12 2 2 4-4.2"/>',
  bill: '<rect x="3" y="6.5" width="18" height="11" rx="1.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6 8.5v0M18 15.5v0"/>',
  landmark: '<path d="M4 21h16"/><path d="M5 21V10.5M9.5 21V10.5M14.5 21V10.5M19 21V10.5"/><path d="M3 10.5 12 4l9 6.5"/><path d="M3 10.5h18"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="1.5"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/><path d="M10.5 12.5v1.6h3v-1.6"/>',
  bank: '<path d="M3 10.5 12 4l9 6.5"/><path d="M4 10.5h16v1.8H4z"/><path d="M5.5 12.5V19M9.5 12.5V19M14.5 12.5V19M18.5 12.5V19"/><path d="M3.5 21h17"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.1" fill="currentColor" stroke="none"/><path d="M7 6 15.5 3l1.8 3"/>',
  piggy: '<path d="M5 12.5a6 6 0 0 1 6-6h3.5c2.5 0 4.5 2 4.5 4.5v1L21 13l-1.5 1.5h-1v2a1.5 1.5 0 0 1-1.5 1.5h-1v2h-3v-2H9v2H6v-2.8A6 6 0 0 1 5 12.5Z"/><circle cx="15" cy="10.5" r=".6" fill="currentColor" stroke="none"/><path d="M5 12.5H3.5"/>',
  umbrella: '<path d="M12 3v1.2"/><path d="M3.5 12A8.5 8.5 0 0 1 20.5 12Z"/><path d="M12 12v7a2 2 0 0 1-2 2"/>',
  gold: '<rect x="4" y="9" width="16" height="9" rx="1.5"/><path d="M4 9c0-2.8 3.6-5 8-5s8 2.2 8 5"/><path d="M8 13.5h8"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.2"/><path d="M12 9v6M10 10.3h2.6a1.4 1.4 0 0 1 0 2.7H10"/>',
  warning: '<path d="M12 3.7 21.3 20H2.7L12 3.7Z"/><path d="M12 10v4.2"/><path d="M12 17.3v.1"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/>',
  robot: '<rect x="5" y="8.5" width="14" height="10" rx="2"/><path d="M12 8.5V5.5"/><circle cx="12" cy="4" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.2" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="13" r="1.1" fill="currentColor" stroke="none"/><path d="M9 17h6"/><path d="M3 12h2M19 12h2"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10.5 19h3"/>',
  handshake: '<path d="M2.5 12.5 6 9l3 2 3-2.6L15.5 11l2.7-2.4 3.3 3.4-4.7 4.6a1.8 1.8 0 0 1-2.5 0l-.5-.5"/><path d="m9 11 3.3 3.2a1.6 1.6 0 0 0 2.2 0"/><path d="m11 13-1.5 1.5a1.5 1.5 0 0 1-2.1 0l-.2-.2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12 19 4"/><path d="M16 7l2.5 2.5"/><path d="M19 4l2 2"/>',
  crown: '<path d="M3.5 8.5 7 12l5-6.5 5 6.5 3.5-3.5-1.6 9.5a1.4 1.4 0 0 1-1.4 1.2H6.5a1.4 1.4 0 0 1-1.4-1.2L3.5 8.5Z" fill="currentColor" fill-opacity=".14"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="8" r=".2" fill="currentColor" stroke="currentColor" stroke-width="2.2"/>',
  external: '<path d="M9 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/><path d="M14 4h6v6"/><path d="M20 4 11 13"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  moon: '<path d="M20 14.2A8.5 8.5 0 1 1 9.8 4a6.6 6.6 0 0 0 10.2 10.2Z"/>',
};

// A visible fallback (question mark in a circle) so a missing key never renders `undefined`.
const FALLBACK = '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.3a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.2 1-1.2 1.9"/><circle cx="12" cy="17" r=".2" fill="currentColor" stroke-width="2.2"/>';

/**
 * icon(name, opts) → SVG markup string.
 * opts: { size = 24, className = '', strokeWidth = 1.75, title }
 */
export function icon(name, opts = {}) {
  const { size = 24, className = '', strokeWidth = STROKE, title } = opts;
  const inner = PATHS[name] || FALLBACK;
  const titleTag = title ? `<title>${escapeXml(title)}</title>` : '';
  const cls = className ? ` class="${className}"` : '';
  return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="${title ? 'false' : 'true'}" role="${title ? 'img' : 'presentation'}">${titleTag}${inner}</svg>`;
}

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(PATHS, name);
}

export const ICON_KEYS = Object.keys(PATHS);

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// analytics.js — Vercel Web Analytics + Speed Insights, loaded only on a *.vercel.app deployment.
// On GitHub Pages or localhost this makes zero network requests (checked by Phase 2 verification via
// read_network_requests — no `/_vercel/` entries).
//
// PUBLIC API
//   initAnalytics() → void   Call once per page (shell.js does this). Safe to call multiple times
//                             (idempotent — checks for an existing queue/script before adding another).

export function initAnalytics() {
  if (typeof location === 'undefined' || !location.hostname.endsWith('.vercel.app')) return;
  if (window.__sgAnalyticsInit) return;
  window.__sgAnalyticsInit = true;

  // Vercel's client libraries look for these queues before their script tag has loaded.
  window.va = window.va || function (...args) { (window.vaq = window.vaq || []).push(args); };
  window.si = window.si || function (...args) { (window.siq = window.siq || []).push(args); };

  const inject = (src) => {
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
  };
  inject('/_vercel/insights/script.js');
  inject('/_vercel/speed-insights/script.js');
}

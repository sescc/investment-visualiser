// Minimal fetch wrapper shared by every adapter: a realistic desktop Chrome UA
// (some sites block bare Node fetch UAs), a hard timeout, a couple of retries
// with backoff, and a polite delay between requests to the same host so we
// never hammer a provider's site.

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const ACCEPT_LANGUAGE = 'en-SG,en;q=0.9';
const TIMEOUT_MS = 20_000;
const RETRIES = 2;
const HOST_DELAY_MS = 800;

// hostname -> timestamp of the last request we started, so repeat requests to
// the same host always wait out HOST_DELAY_MS first.
const lastRequestAt = new Map();

// Exported so lib/browser.js can share the same per-host timestamp map —
// an html fetch and a headless-browser nav to the same host still space out.
export async function politeDelay(url) {
  const host = new URL(url).host;
  const wait = (lastRequestAt.get(host) || 0) + HOST_DELAY_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt.set(host, Date.now());
}

export { USER_AGENT };

async function fetchWithRetry(url, options = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    await politeDelay(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': ACCEPT_LANGUAGE,
          ...(options.headers || {}),
        },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < RETRIES) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function getText(url, options) {
  const res = await fetchWithRetry(url, options);
  return res.text();
}

export async function getJSON(url, options) {
  const res = await fetchWithRetry(url, options);
  return res.json();
}

// POST an application/x-www-form-urlencoded body. Used by adapters that have
// to replicate a classic server-rendered form postback (no JSON API exists).
export async function postForm(url, formFields, options = {}) {
  const res = await fetchWithRetry(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(options.headers || {}),
    },
    body: new URLSearchParams(formFields).toString(),
  });
  return res.text();
}

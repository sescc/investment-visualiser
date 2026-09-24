// Headless-browser rendering for the handful of sources whose fee text only
// exists after JavaScript runs. Uses `playwright-core` (NOT `playwright` —
// no browser binary download) to drive the Microsoft Edge already installed
// on this machine, via `chromium.launch({ channel: 'msedge' })`. See the
// 'browser' format in CLAUDE.md's adapter contract.
//
// One Edge instance is shared for the whole scraper run, launched lazily on
// the first call to renderPage() — so a run with no 'browser'-format adapters
// never launches anything. index.js closes it once, after all adapters have
// run, even if some failed.
import { politeDelay, USER_AGENT } from './http.js';

// Fallback path if the 'msedge' channel lookup fails (e.g. registry entry
// missing) but the binary is still present at the usual install location.
const EDGE_EXECUTABLE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const NAV_TIMEOUT_MS = 30_000;

// Per CLAUDE.md hard limits: never try to evade a bot challenge. Detect the
// common markers and throw, so the adapter fails cleanly instead of parsing
// challenge-page HTML as if it were the real page.
const CHALLENGE_MARKERS = [
  /just a moment/i,
  /checking your browser/i,
  /enable javascript and cookies to continue/i,
  /verify you are human/i,
  /attention required[\s\S]{0,40}cloudflare/i,
  /captcha/i,
];

let browserPromise = null; // resolves to a launched Browser
let launchFailure = null; // cached Error, so a bad launch fails fast for every adapter after the first

async function launchEdge() {
  let playwrightCore;
  try {
    playwrightCore = await import('playwright-core');
  } catch (err) {
    throw new Error(
      "playwright-core is not installed — run 'npm install playwright-core' (no browser download needed, it drives the system Edge). " +
        err.message
    );
  }
  const { chromium } = playwrightCore;
  try {
    return await chromium.launch({ channel: 'msedge', headless: true });
  } catch (channelErr) {
    try {
      return await chromium.launch({ headless: true, executablePath: EDGE_EXECUTABLE });
    } catch (pathErr) {
      throw new Error(
        `Could not launch Microsoft Edge for headless rendering. Tried channel 'msedge' (${channelErr.message}) ` +
          `and executablePath '${EDGE_EXECUTABLE}' (${pathErr.message}). Is Edge installed?`
      );
    }
  }
}

async function getBrowser() {
  if (launchFailure) throw launchFailure;
  if (!browserPromise) browserPromise = launchEdge();
  try {
    return await browserPromise;
  } catch (err) {
    launchFailure = err;
    browserPromise = null;
    throw err;
  }
}

function assertNoChallenge(text, url) {
  for (const re of CHALLENGE_MARKERS) {
    if (re.test(text)) {
      throw new Error(
        `Bot challenge / CAPTCHA page detected on ${url} — skipping per CLAUDE.md hard limits (no evasion attempted).`
      );
    }
  }
}

/**
 * renderPage(url, { waitFor, timeout }) -> { html, text }
 *
 * waitFor (optional):
 *  - string  -> treated as a CSS selector; waits for it to appear (page.waitForSelector)
 *  - RegExp  -> polls the rendered body text until it matches
 *  - function(text) -> polls the rendered body text until it returns truthy
 *    (use this instead of a selector when a value must be *correct*, not just
 *    present — e.g. Longbridge's placeholder 0% is in the DOM immediately, so
 *    a selector wait would pass instantly on the wrong value)
 *  - omitted -> waits a fixed 2s grace period after `domcontentloaded`
 *
 * Throws if a bot challenge is detected, or if waitFor never resolves in time.
 * Retries once on any failure (network jitter, a slow first paint) — but
 * never to evade a detected challenge; assertNoChallenge still throws
 * straight through on retry too since the reason is re-checked each time.
 */
export async function renderPage(url, opts = {}) {
  try {
    return await renderPageOnce(url, opts);
  } catch (err) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return renderPageOnce(url, opts);
  }
}

async function renderPageOnce(url, { waitFor, timeout = NAV_TIMEOUT_MS } = {}) {
  const browser = await getBrowser();
  await politeDelay(url); // same per-host map as lib/http.js — shared politeness budget
  const context = await browser.newContext({ userAgent: USER_AGENT, locale: 'en-SG' });
  const page = await context.newPage();
  try {
    // 'domcontentloaded' rather than 'networkidle': several of these sites
    // keep persistent connections open (chat widgets, analytics beacons)
    // that never let the network go idle, which made networkidle time out
    // even once the fee content had long since rendered. The waitFor poll
    // below is what actually confirms the content we need is present.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    if (typeof waitFor === 'string') {
      await page.waitForSelector(waitFor, { timeout });
    } else if (waitFor instanceof RegExp || typeof waitFor === 'function') {
      const predicate = typeof waitFor === 'function' ? waitFor : (t) => waitFor.test(t);
      const deadline = Date.now() + timeout;
      let lastText = '';
      let matched = false;
      while (Date.now() < deadline) {
        lastText = await page.innerText('body').catch(() => '');
        if (predicate(lastText)) {
          matched = true;
          break;
        }
        await page.waitForTimeout(300);
      }
      if (!matched) throw new Error(`Timed out waiting for expected content to render on ${url}`);
    } else {
      // No waitFor given: still allow a short grace period for client-side
      // rendering to finish, since we no longer wait for networkidle.
      await page.waitForTimeout(2000);
    }

    const html = await page.content();
    const text = await page.innerText('body').catch(() => '');
    assertNoChallenge(text, url);
    return { html, text };
  } finally {
    await context.close();
  }
}

// Called once at the end of a scraper run (success or failure). No-op if a
// browser was never launched. Safe to call more than once.
export async function closeBrowser() {
  if (!browserPromise) return;
  let browser;
  try {
    browser = await browserPromise;
  } catch {
    browserPromise = null;
    return;
  }
  browserPromise = null;
  try {
    await browser.close();
  } catch {
    // already closed, or never fully started — nothing more to do
  }
}

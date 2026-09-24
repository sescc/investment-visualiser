// Parsing helpers shared by adapters. Every parser returns null on failure —
// adapters combine that with mustFind() to throw instead of guessing, per the
// hard rule in CLAUDE.md ("adapters must throw when the expected text isn't found").
import * as cheerio from 'cheerio';

export function load(html) {
  return cheerio.load(html);
}

// Strip script/style tags and collapse all whitespace to single spaces.
export function cleanText($) {
  $('script, style').remove();
  return $.root().text().replace(/\s+/g, ' ').trim();
}

// Return the first substring matching valueRegex within `window` chars after
// the first match of labelRegex, or null if the label or value isn't found.
export function findNear(text, labelRegex, valueRegex, window = 200) {
  const labelMatch = labelRegex.exec(text);
  if (!labelMatch) return null;
  const start = labelMatch.index + labelMatch[0].length;
  const slice = text.slice(start, start + window);
  const valueMatch = valueRegex.exec(slice);
  return valueMatch ? valueMatch[0] : null;
}

// "0.08%" -> 0.08 (a percent NUMBER, e.g. 0.08 means 0.08%, not a fraction).
export function parsePct(str) {
  if (typeof str !== 'string') return null;
  const m = str.match(/(-?\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
}

// "S$10" -> {value:10,currency:'SGD'}; "USD 0.99" -> {value:0.99,currency:'USD'};
// "US$1" -> currency 'USD'; "HK$5"/"HKD 5" -> 'HKD'.
export function parseMoney(str) {
  if (typeof str !== 'string') return null;
  const m = str.match(/(US\$|HK\$|S\$|USD|SGD|HKD)\s*([\d,]+(?:\.\d+)?)/i);
  if (!m) return null;
  const value = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  const symbol = m[1].toUpperCase();
  const currency = symbol.includes('US') ? 'USD' : symbol.includes('HK') ? 'HKD' : 'SGD';
  return { value, currency };
}

// Throw a uniform "Not found" error for null/undefined — used at the end of
// every adapter's extraction chain instead of falling back to a guess.
export function mustFind(value, what) {
  if (value === null || value === undefined) throw new Error('Not found: ' + what);
  return value;
}

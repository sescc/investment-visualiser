// Checks every authored link (steps[].link, officialLink, feeSpecs[].sourceUrl) in data/baseline/*.json.
// Usage: npm run check-links   — prints non-OK links; exit code 1 if any fail.
import { readFile } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const links = new Map(); // url -> [where]

function collect(obj, where) {
  const add = (url, w) => url && (links.get(url) || links.set(url, []).get(url)).push(w);
  add(obj.officialLink, `${where} officialLink`);
  (obj.steps || []).forEach((s, i) => add(s.link, `${where} step ${i + 1}`));
  (obj.feeSpecs || []).forEach(f => add(f.sourceUrl, `${where} feeSpec`));
}

for (const ds of ['products', 'methods', 'brokers']) {
  const { entries } = JSON.parse(await readFile(`data/baseline/${ds}.json`, 'utf8'));
  for (const e of entries) {
    collect(e, e.id);
    (e.providers || []).forEach(p => collect(p, `${e.id}/${p.id}`));
  }
}

async function check(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-SG' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    return res.status;
  } catch (err) {
    return err.name === 'TimeoutError' ? 'timeout' : err.cause?.code || err.message;
  }
}

const urls = [...links.keys()];
const results = [];
for (let i = 0; i < urls.length; i += 8) {
  results.push(...await Promise.all(urls.slice(i, i + 8).map(async u => ({ url: u, status: await check(u) }))));
}
const bad = results.filter(r => r.status !== 200);
for (const r of bad) console.log(`${r.status}\t${r.url}\n\t  used by: ${links.get(r.url).join(', ')}`);
console.log(`\n${results.length - bad.length}/${results.length} links OK`);
process.exitCode = bad.length ? 1 : 0;

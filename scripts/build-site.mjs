#!/usr/bin/env node
// Assembles the Pages/Vercel output directory: site/ copied to _site/, with data/sgdata.json and
// data/sgdata.js copied in beside it (published layout: data/ sits next to js/, css/, etc — see
// CLAUDE.md §13 and .github/workflows/scrape-and-deploy.yml). No dependencies; Node >= 16.7 for the
// recursive fs.cpSync used here.
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const siteDir = path.join(root, 'site');
const dataDir = path.join(root, 'data');
const outDir = path.join(root, '_site');

const dataJson = path.join(dataDir, 'sgdata.json');
const dataJs = path.join(dataDir, 'sgdata.js');

for (const f of [dataJson, dataJs]) {
  if (!existsSync(f)) {
    console.error(`build-site: missing ${path.relative(root, f)} — run "npm run scrape" first.`);
    process.exit(1);
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(siteDir, outDir, { recursive: true });

const outDataDir = path.join(outDir, 'data');
mkdirSync(outDataDir, { recursive: true });
cpSync(dataJson, path.join(outDataDir, 'sgdata.json'));
cpSync(dataJs, path.join(outDataDir, 'sgdata.js'));

writeFileSync(path.join(outDir, '.nojekyll'), '');

console.log(`build-site: wrote ${path.relative(root, outDir)}/ (site/ + data/sgdata.json + data/sgdata.js + .nojekyll)`);

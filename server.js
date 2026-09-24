// Minimal static file server + refresh API for the SG Invest Visualiser site.
// No dependencies beyond node:http/fs/path; the scraper is invoked in-process
// (run() from scraper/index.js), so refreshing never shells out.
import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './scraper/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5173;
const HOST = '127.0.0.1';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// Only /site/** and the two generated data files are servable. Resolving the
// path first (which collapses "..") and then checking the prefix is what
// actually stops path traversal — checking the raw string is not enough.
function isAllowed(resolved) {
  const siteDir = path.join(ROOT, 'site') + path.sep;
  if (resolved.startsWith(siteDir)) return true;
  return (
    resolved === path.join(ROOT, 'data', 'sgdata.json') ||
    resolved === path.join(ROOT, 'data', 'sgdata.js')
  );
}

async function serveStatic(urlPath, res) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded.replace(/^\/+/, '');
  const resolved = path.resolve(ROOT, relative);
  if (!isAllowed(resolved)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  try {
    const data = await readFile(resolved);
    res.writeHead(200, { 'Content-Type': contentTypeFor(resolved) });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

async function listAdapterIds() {
  try {
    const files = await readdir(path.join(ROOT, 'scraper', 'sources'));
    return files.filter((f) => f.endsWith('.js') && !f.startsWith('_')).map((f) => f.replace(/\.js$/, ''));
  } catch {
    return [];
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy(new Error('body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Reject anything not addressed to this exact host:port (basic anti-DNS-rebinding /
// anti-CSRF measure for a server that only ever binds to 127.0.0.1).
function hostIsAllowed(req) {
  const host = req.headers.host || '';
  return host === `127.0.0.1:${PORT}` || host === `localhost:${PORT}`;
}

let refreshing = false;

const server = http.createServer(async (req, res) => {
  if (!hostIsAllowed(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/') {
    res.writeHead(302, { Location: '/site/index.html' });
    res.end();
    return;
  }

  if (url.pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/api/refresh' && req.method === 'POST') {
    if (refreshing) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'refresh already in progress' }));
      return;
    }

    let only;
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      if (body.only !== undefined) {
        if (!Array.isArray(body.only) || !body.only.every((x) => typeof x === 'string')) {
          throw new Error('"only" must be an array of strings');
        }
        const known = await listAdapterIds();
        const unknown = body.only.filter((id) => !known.includes(id));
        if (unknown.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'unknown adapter id(s): ' + unknown.join(', ') }));
          return;
        }
        only = body.only;
      }
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }

    refreshing = true;
    try {
      const result = await run({ only, dry: false });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ generatedAt: result.generatedAt, report: result.report }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    } finally {
      refreshing = false;
    }
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    await serveStatic(url.pathname, res);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`SG Invest Visualiser server: http://${HOST}:${PORT}`);
});

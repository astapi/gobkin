#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const APP_ROOT = path.join(REPO_ROOT, 'goblin_native');
const ASSETS_DIR = path.join(APP_ROOT, 'assets');
const PROJECT_ROOT = REPO_ROOT;
const PUBLIC_DIR = path.join(__dirname, 'public');
const OUTPUT_DIR = path.join(__dirname, 'output');

const PORT = Number(process.env.PORT) || 4321;
const HOST = '127.0.0.1';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function safeJoin(root, rel) {
  const resolved = path.resolve(root, '.' + path.sep + rel);
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

function listAssetsTree(dir, relBase = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  const dirs = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      dirs.push({ type: 'dir', name: entry.name, path: rel, children: listAssetsTree(abs, rel) });
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXT.has(ext)) {
        files.push({ type: 'file', name: entry.name, path: rel });
      }
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return [...dirs, ...files];
}

function listProjectBackgrounds() {
  const sources = [
    { dir: REPO_ROOT, prefix: '' },
    { dir: APP_ROOT, prefix: 'goblin_native/' },
  ];
  const result = [];
  for (const { dir, prefix } of sources) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { continue; }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!IMAGE_EXT.has(ext)) continue;
      const label = prefix ? `${entry.name}  (${prefix.replace(/\/$/, '')})` : entry.name;
      result.push({ name: label, path: prefix + entry.name });
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function sendFile(res, filePath, contentType) {
  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = contentType || MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const limit = 50 * 1024 * 1024;
    req.on('data', (c) => {
      total += c.length;
      if (total > limit) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname || '/');

  try {
    if (pathname === '/api/assets') {
      const tree = listAssetsTree(ASSETS_DIR);
      sendJson(res, 200, { tree });
      return;
    }
    if (pathname === '/api/backgrounds') {
      const list = listProjectBackgrounds();
      sendJson(res, 200, { list });
      return;
    }
    if (pathname === '/api/save' && req.method === 'POST') {
      const body = await readBody(req);
      let json;
      try { json = JSON.parse(body.toString('utf8')); } catch (_) {
        sendJson(res, 400, { error: 'invalid json' });
        return;
      }
      const dataUrl = json.dataUrl;
      const name = (json.name || `screenshot-${Date.now()}.png`).replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!dataUrl || !/^data:image\/png;base64,/.test(dataUrl)) {
        sendJson(res, 400, { error: 'invalid dataUrl' });
        return;
      }
      const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      ensureDir(OUTPUT_DIR);
      const outPath = path.join(OUTPUT_DIR, name);
      fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
      sendJson(res, 200, { savedTo: path.relative(PROJECT_ROOT, outPath) });
      return;
    }

    if (pathname.startsWith('/assets/')) {
      const rel = pathname.slice('/assets/'.length);
      const abs = safeJoin(ASSETS_DIR, rel);
      if (!abs) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      sendFile(res, abs);
      return;
    }
    if (pathname.startsWith('/project/')) {
      const rel = pathname.slice('/project/'.length);
      const abs = safeJoin(PROJECT_ROOT, rel);
      if (!abs) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      sendFile(res, abs);
      return;
    }

    let rel = pathname === '/' ? '/index.html' : pathname;
    const abs = safeJoin(PUBLIC_DIR, rel);
    if (!abs) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      sendFile(res, abs);
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`screenshot-maker: http://${HOST}:${PORT}`);
  console.log(`  project root: ${PROJECT_ROOT}`);
  console.log(`  assets dir:   ${ASSETS_DIR}`);
  console.log(`  output dir:   ${OUTPUT_DIR}`);
});

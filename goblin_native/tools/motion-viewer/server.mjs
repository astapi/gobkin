import { createReadStream } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const viewerRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(viewerRoot, '..', '..');
const port = Number.parseInt(process.env.MOTION_VIEWER_PORT ?? '4178', 10);
const host = '127.0.0.1';
const defaultSet = 'artifacts/pixel-art-demo/game-base-goblin-motion-v2/strict64';

const motionDefaults = {
  idle: { label: '待機', duration: 160 },
  walk: { label: '歩行', duration: 130 },
  attack: { label: '攻撃', duration: 140 },
  'walk-body': { label: '歩行（素体）', duration: 130 },
};

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function safeResolve(root, requestedPath) {
  const absolute = path.resolve(root, requestedPath);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error('プロジェクト外のパスは読み込めません');
  }
  return absolute;
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': contentTypes['.json'],
  });
  response.end(JSON.stringify(body, null, 2));
}

async function buildManifest(requestedSet) {
  const set = requestedSet || defaultSet;
  const absoluteSet = safeResolve(projectRoot, set);
  const setStat = await stat(absoluteSet);
  if (!setStat.isDirectory()) {
    throw new Error('指定されたセットはディレクトリではありません');
  }

  let semanticReview = null;
  try {
    semanticReview = JSON.parse(await readFile(path.join(absoluteSet, 'motion-review.json'), 'utf8'));
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw new Error(`motion-review.json を読み込めません: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }

  const entries = await readdir(absoluteSet, { withFileTypes: true });
  const motions = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'preview-frames') {
      continue;
    }
    const motionDir = path.join(absoluteSet, entry.name);
    const files = await readdir(motionDir);
    const frames = files
      .map((file) => ({ file, match: /^frame-(\d+)\.png$/i.exec(file) }))
      .filter(({ match }) => match)
      .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
      .map(({ file }) => `/files/${encodeURI(path.posix.join(set.split(path.sep).join('/'), entry.name, file))}`);
    if (frames.length === 0) {
      continue;
    }
    const defaults = motionDefaults[entry.name] ?? {
      label: entry.name,
      duration: 140,
    };
    motions.push({
      id: entry.name,
      label: defaults.label,
      duration: defaults.duration,
      frames,
      semanticReview: semanticReview?.motions?.[entry.name] ?? { frames: {} },
    });
  }

  const order = ['idle', 'walk', 'attack', 'walk-body'];
  motions.sort((a, b) => {
    const aIndex = order.indexOf(a.id);
    const bIndex = order.indexOf(b.id);
    return (aIndex < 0 ? 999 : aIndex) - (bIndex < 0 ? 999 : bIndex);
  });

  if (motions.length === 0) {
    throw new Error('frame-N.png を含むモーションフォルダが見つかりません');
  }

  return {
    generatedAt: new Date().toISOString(),
    projectRoot: path.basename(projectRoot),
    reviewSource: semanticReview ? path.posix.join(set.split(path.sep).join('/'), 'motion-review.json') : null,
    set,
    motions,
  };
}

async function serveFile(response, absolutePath) {
  const fileStat = await stat(absolutePath);
  if (!fileStat.isFile()) {
    throw new Error('ファイルではありません');
  }
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': fileStat.size,
    'Content-Type': contentTypes[path.extname(absolutePath).toLowerCase()] ?? 'application/octet-stream',
  });
  createReadStream(absolutePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`);

    if (url.pathname === '/api/health') {
      sendJson(response, 200, { ok: true, defaultSet });
      return;
    }

    if (url.pathname === '/api/manifest') {
      const manifest = await buildManifest(url.searchParams.get('set') ?? defaultSet);
      sendJson(response, 200, manifest);
      return;
    }

    if (url.pathname.startsWith('/files/')) {
      const relativePath = decodeURI(url.pathname.slice('/files/'.length));
      await serveFile(response, safeResolve(projectRoot, relativePath));
      return;
    }

    const viewerPath = url.pathname === '/' ? 'index.html' : decodeURI(url.pathname.slice(1));
    await serveFile(response, safeResolve(viewerRoot, viewerPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラー';
    sendJson(response, 404, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`Motion Inspector: http://${host}:${port}`);
  console.log(`Default set: ${defaultSet}`);
});

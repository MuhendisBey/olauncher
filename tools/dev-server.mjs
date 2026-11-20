import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { startMockHAServer } from './mock-ha-server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const HTTP_PORT = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : 8080;
const HTTP_HOST = process.env.HOST || '127.0.0.1';
const rootIndex = args.indexOf('--root');
const targetFolder = rootIndex !== -1 ? args[rootIndex + 1] : 'launcher';
const SERVE_DIR = path.resolve(rootDir, targetFolder);
const SERVE_PREFIX = SERVE_DIR.endsWith(path.sep) ? SERVE_DIR : SERVE_DIR + path.sep;
const noMockHa = args.includes('--no-mock-ha');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2'
};

function resolveSafeFile(reqPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(reqPath);
  } catch (_) {
    return { error: 400 };
  }

  const normalized = decoded === '/' || decoded === '' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(SERVE_DIR, normalized);

  // Enforce strict directory boundary check
  if (resolved !== SERVE_DIR && !resolved.startsWith(SERVE_PREFIX)) {
    return { error: 403 };
  }

  return { filePath: resolved, relPath: '/' + normalized };
}

function sendConfigJson(configPath, res) {
  fs.readFile(configPath, 'utf8', (readErr, content) => {
    if (readErr) {
      res.writeHead(500);
      res.end('Error reading config');
      return;
    }

    if (noMockHa) {
      res.writeHead(200, {
        'Content-Type': MIME_TYPES['.json'],
        'Cache-Control': 'no-cache'
      });
      res.end(content);
      return;
    }

    try {
      const cfg = JSON.parse(content);
      if (cfg.home_assistant) {
        cfg.home_assistant.ha_url = 'ws://127.0.0.1:8123/api/websocket';
        cfg.home_assistant.access_token = 'MOCK_TOKEN';
      }
      res.writeHead(200, {
        'Content-Type': MIME_TYPES['.json'],
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify(cfg, null, 2));
    } catch (_) {
      res.writeHead(200, { 'Content-Type': MIME_TYPES['.json'], 'Cache-Control': 'no-cache' });
      res.end(content);
    }
  });
}

const server = http.createServer((req, res) => {
  const rawPath = (req.url || '/').split('?')[0];
  const resolved = resolveSafeFile(rawPath);

  if (resolved.error === 400) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  if (resolved.error === 403) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  let { filePath, relPath } = resolved;

  // Fallback to config.example.json when local config.json does not exist
  if (relPath === '/config.json' && !fs.existsSync(filePath)) {
    const localExample = path.join(SERVE_DIR, 'config.example.json');
    const repoExample = path.join(rootDir, 'launcher', 'config.example.json');
    if (fs.existsSync(localExample)) {
      filePath = localExample;
    } else if (fs.existsSync(repoExample)) {
      filePath = repoExample;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${relPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    if (ext === '.json' && (relPath === '/config.json' || relPath === '/config.example.json')) {
      sendConfigJson(filePath, res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(HTTP_PORT, HTTP_HOST, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 OLauncher Dev Server running at: http://${HTTP_HOST}:${HTTP_PORT}`);
  console.log(`📁 Serving directory: ${SERVE_DIR}`);
  console.log(`🎮 Remote navigation: Arrow keys (navigate), Enter (select), Esc/Backspace (back)`);
  console.log(`======================================================\n`);
});

if (!noMockHa) {
  startMockHAServer(8123);
}

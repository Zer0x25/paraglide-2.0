import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, 'dist');
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOSTNAME || '0.0.0.0';
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://api:3001';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  // 1. Proxy para /api/*
  if (pathname.startsWith('/api/')) {
    const targetUrl = new URL(pathname + url.search, INTERNAL_API_URL);
    const proxyHeaders = { ...req.headers };
    proxyHeaders.host = targetUrl.host;
    delete proxyHeaders.connection;

    const proxyReq = http.request(
      targetUrl,
      {
        method: req.method,
        headers: proxyHeaders,
        timeout: 120_000,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (err) => {
      console.error(`[proxy error] ${req.method} ${pathname}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
      }
    });

    req.pipe(proxyReq);
    return;
  }

  // 2. Archivos estáticos en /dist
  let filePath = path.join(DIST_DIR, pathname);

  // Prevenir Directory Traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Si existe el archivo estático solicitado
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isImmutable = pathname.startsWith('/assets/');
    const isServiceWorker = pathname === '/sw.js';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': isImmutable
        ? 'public, max-age=31536000, immutable'
        : isServiceWorker
          ? 'public, max-age=0, must-revalidate'
          : 'public, max-age=3600',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // 3. Fallback de SPA: index.html
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// Soporte para WebSockets / upgrade si es necesario
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    const targetUrl = new URL(url.pathname + url.search, INTERNAL_API_URL);
    const proxyReq = http.request(targetUrl, {
      method: req.method,
      headers: { ...req.headers, host: targetUrl.host },
    });
    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\n` +
          Object.entries(proxyRes.headers)
            .map(([k, v]) => `${k}: ${v}\r\n`)
            .join('') +
          `\r\n`,
      );
      if (proxyHead.length > 0) socket.write(proxyHead);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });
    proxyReq.on('error', () => socket.destroy());
    proxyReq.end();
  } else {
    socket.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[web] Servidor Vite SPA escuchando en http://${HOST}:${PORT}`);
  console.log(`[web] Proxy /api configurado hacia ${INTERNAL_API_URL}`);
});

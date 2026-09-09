const http = require('http');
const fs = require('fs');
const path = require('path');
const api = require('./lib/api');

const PORT = 8000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  // Phase 4: JSON API (auth, applications, fees, payments, CMS, reports)
  if (req.url.indexOf('/api') === 0) {
    if (api.handle(req, res)) return;
  }

  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  let filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('==============================================');
  console.log('  MODERN EDUCATIONAL CENTRE WEBSITE SERVER');
  console.log('  (Phase 4: Admin Dashboard + Payments API)');
  console.log('==============================================');
  console.log('');
  console.log('  Server running on port ' + PORT);
  console.log('');
  console.log('  Public site:  http://127.0.0.1:' + PORT);
  console.log('  Admin panel:  http://127.0.0.1:' + PORT + '/admin');
  console.log('  API health:   http://127.0.0.1:' + PORT + '/api/health');
  console.log('');
  console.log('  Your machine: http://10.50.127.253:' + PORT);
  console.log('');
  console.log('  Press Ctrl+C to stop the server');
  console.log('==============================================');
});
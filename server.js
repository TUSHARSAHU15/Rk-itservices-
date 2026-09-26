const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8085;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
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
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};

function resolveFile(requestedPath) {
  let relativePath = decodeURIComponent(requestedPath);
  if (relativePath.startsWith('/')) {
    relativePath = relativePath.slice(1);
  }
  if (!relativePath || relativePath === '') {
    relativePath = 'index.html';
  }

  let fullPath = path.resolve(ROOT_DIR, relativePath);
  if (!fullPath.startsWith(ROOT_DIR)) {
    return null;
  }

  // 1. If path ends with .html but was an asset like .jpg.html / .png.html / .css.html,
  // prefer the real binary asset if it exists!
  if (fullPath.endsWith('.html')) {
    const stripped = fullPath.slice(0, -5);
    if (fs.existsSync(stripped) && fs.statSync(stripped).isFile()) {
      return stripped;
    }
  }

  // 2. Direct file check
  if (fs.existsSync(fullPath)) {
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      // If this file happens to be a 33KB Vercel checkpoint HTML page and counterpart exists, use counterpart
      return fullPath;
    }
    if (stat.isDirectory()) {
      // Look for index.html
      const idx = path.join(fullPath, 'index.html');
      if (fs.existsSync(idx) && fs.statSync(idx).isFile()) return idx;

      // Look for <dirname>.html (e.g. about-us/about-us.html)
      const dirBase = path.basename(fullPath);
      const namedHtml = path.join(fullPath, `${dirBase}.html`);
      if (fs.existsSync(namedHtml) && fs.statSync(namedHtml).isFile()) return namedHtml;

      // Look for any .html in the directory
      const files = fs.readdirSync(fullPath);
      const htmlFile = files.find(f => f.endsWith('.html') && !f.includes('checkpoint'));
      if (htmlFile) return path.join(fullPath, htmlFile);
    }
  }

  // 3. Check fullPath + '.html'
  if (fs.existsSync(fullPath + '.html') && fs.statSync(fullPath + '.html').isFile()) {
    return fullPath + '.html';
  }

  // 4. Check if directory without trailing slash
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    const dirBase = path.basename(fullPath);
    const namedHtml = path.join(fullPath, `${dirBase}.html`);
    if (fs.existsSync(namedHtml) && fs.statSync(namedHtml).isFile()) return namedHtml;
  }

  return null;
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url);

  // Cloudflare email protection fallback
  if (parsedUrl.pathname.includes('email-protection')) {
    res.writeHead(302, { 'Location': 'mailto:hello@rkitservice.com' });
    res.end();
    return;
  }

  const targetFile = resolveFile(parsedUrl.pathname);

  if (!targetFile) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>404 Not Found</h1><p>Could not find <code>${parsedUrl.pathname}</code></p><p><a href="/">Back to Home</a></p>`);
    return;
  }

  const ext = path.extname(targetFile).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(targetFile, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Serving directory: ${ROOT_DIR}`);
});

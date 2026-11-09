/* Local server: static dist/ + the API function at /api/* (same code that runs on Netlify).
   Usage: DATABASE_URL=postgres://… AUTH_SECRET=… MAIL_PROVIDER=file node qa/dev-server.mjs [port]
   Mirrors the Netlify redirects for the app shells (/account/*, /t/*, /admin/events/*). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import api from '../netlify/functions/api.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.argv[2] || process.env.PORT || 8788);
process.env.SITE_URL = process.env.SITE_URL || `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ics': 'text/calendar', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' };
const SHELLS = [[/^\/(ar\/)?account(\/|$)/, 'account/index.html'], [/^\/(ar\/)?t\//, 't/index.html'], [/^\/(ar\/)?admin\/events(\/|$)/, 'admin/events/index.html'], [/^\/ar\/ideas\//, 'ar/ideas/index.html'], [/^\/ideas\//, 'ideas/index.html']];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, process.env.SITE_URL);
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : null;
    const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (v != null) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const request = new Request(url.toString(), { method: req.method, headers, body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined });
    const waits = [];
    const response = await api(request, { ip: req.socket.remoteAddress, waitUntil: (p) => waits.push(p) });
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
    await Promise.allSettled(waits);
    return;
  }
  let p = decodeURIComponent(url.pathname);
  const shell = SHELLS.find(([re]) => re.test(p));
  let f = shell ? path.join(DIST, shell[1]) : path.join(DIST, p);
  if (!shell && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
server.listen(PORT, '127.0.0.1', () => console.log(`dev server → ${process.env.SITE_URL}  (dist + /api)`));

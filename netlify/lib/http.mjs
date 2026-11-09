/* Small HTTP helpers shared by the functions (Fetch-API Request/Response). */
import { createHash } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, code, extra) { super(code); this.status = status; this.code = code; this.extra = extra || null; }
}
export const fail = (status, code, extra) => { throw new HttpError(status, code, extra); };

const SECURITY = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, SECURITY, headers) });
}
export function text(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SECURITY, headers) });
}
export function redirect(location, headers = {}) {
  return new Response(null, { status: 303, headers: Object.assign({ Location: location }, SECURITY, headers) });
}

const MAX_BODY = 16 * 1024;
export async function readJson(req, maxBytes = MAX_BODY) {
  const ct = (req.headers.get('content-type') || '').toLowerCase();
  const raw = await req.text();
  if (!ct && !raw.trim()) return {}; // bodiless action (e.g. retry, logout)
  if (!ct.startsWith('application/json')) fail(415, 'json_required');
  if (raw.length > maxBytes) fail(413, 'body_too_large');
  if (!raw.trim()) return {};
  try { const v = JSON.parse(raw); if (!v || typeof v !== 'object' || Array.isArray(v)) fail(400, 'bad_json'); return v; }
  catch (e) { if (e instanceof HttpError) throw e; fail(400, 'bad_json'); }
}

export function cookies(req) {
  const out = {};
  (req.headers.get('cookie') || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}

export function siteUrl(req) {
  const env = process.env.SITE_URL || process.env.URL || '';
  if (env) return env.replace(/\/$/, '');
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

/* Same-origin check for state-changing requests: cookies are SameSite=Lax and bodies must be JSON,
   which already defeats classic CSRF; this is the belt to those braces. */
export function assertSameOrigin(req) {
  const origin = req.headers.get('origin');
  // Accept the configured site URL and the exact host this request was sent to (the site answers on its primary
  // domain and the netlify.app address); any other page's origin is refused.
  const u = new URL(req.url);
  const allowed = new Set([siteUrl(req), `${u.protocol}//${u.host}`]);
  if (origin && !allowed.has(origin) && !isLocalDev(origin)) fail(403, 'bad_origin');
  const sfs = req.headers.get('sec-fetch-site');
  if (sfs && sfs !== 'same-origin' && sfs !== 'none' && !isLocalDev(origin || '')) fail(403, 'bad_origin');
}
function isLocalDev(origin) { return !process.env.NETLIFY && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || ''); }

export function clientIp(req, context) {
  return (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '0.0.0.0';
}
export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');
export const ipHash = (ip) => sha256('ip:' + ip + ':' + (process.env.AUTH_SECRET || '')).slice(0, 24);

export const normEmail = (e) => String(e || '').trim().toLowerCase();
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;
export const cleanName = (n) => String(n || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
export const langOf = (v) => (String(v || 'en').slice(0, 2) === 'ar' ? 'ar' : 'en');

/* Only allow redirects back into this site. */
export function safePath(p) {
  const s = String(p || '');
  if (!s.startsWith('/') || s.startsWith('//') || /[\r\n]/.test(s)) return '/';
  return s.split('?')[0].split('#')[0];
}

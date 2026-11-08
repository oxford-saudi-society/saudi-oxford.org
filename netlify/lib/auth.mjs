/* Passwordless identity: email magic links → a signed, HttpOnly session cookie.
   Staff roles come from oss_staff on every request (never from the cookie). */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, fail, sha256, ipHash, clientIp } from './http.mjs';

const COOKIE = 'oss_session';
const SESSION_DAYS = 30;

function secret() {
  const s = process.env.AUTH_SECRET || '';
  if (s.length >= 32 && !/^dev-secret/.test(s)) return s;
  if (process.env.NETLIFY || process.env.NODE_ENV === 'production') throw Object.assign(new Error('auth_secret_missing'), { status: 503 });
  return 'dev-only-secret-not-for-production-use-0123456789';
}
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const sign = (payload) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function newToken(bytes = 32) { return randomBytes(bytes).toString('base64url'); }
export const tokenHash = (t) => sha256('tok:' + t);

/* ── sessions ───────────────────────────────────────────────────── */
export function sessionCookie(email, req) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64u(JSON.stringify({ e: email, iat: now, exp: now + SESSION_DAYS * 86400 }));
  const value = body + '.' + sign(body);
  const secure = !req || /^https:/.test(req.url) || !!process.env.NETLIFY;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`;
}
export function clearSessionCookie() { return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`; }

export function sessionFrom(req) {
  const raw = cookies(req)[COOKIE];
  if (!raw) return null;
  const i = raw.lastIndexOf('.');
  if (i < 1) return null;
  const body = raw.slice(0, i), sig = raw.slice(i + 1);
  const expect = sign(body);
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.e || !p.exp || p.exp < Date.now() / 1000) return null;
    return { email: String(p.e).toLowerCase(), iat: p.iat };
  } catch (e) { return null; }
}

/* ── staff & members ────────────────────────────────────────────── */
const ROLE_RANK = { checkin_staff: 1, events_admin: 2, super_admin: 3 };
export async function staffFor(q, email) {
  if (!email) return null;
  const r = await q.query('SELECT email, name, role, event_ids, disabled FROM oss_staff WHERE email = $1', [email]);
  if (r.rows.length && !r.rows[0].disabled) return r.rows[0];
  // bootstrap: addresses listed in ADMIN_BOOTSTRAP_EMAILS become super admins on first sign-in
  const boot = (process.env.ADMIN_BOOTSTRAP_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (boot.includes(email)) {
    await q.query("INSERT INTO oss_staff (email, role, created_by) VALUES ($1, 'super_admin', 'bootstrap') ON CONFLICT (email) DO UPDATE SET disabled = false, role = 'super_admin'", [email]);
    return { email, role: 'super_admin', event_ids: null, disabled: false };
  }
  return null;
}
export function requireRole(staff, role, eventId) {
  if (!staff) fail(401, 'staff_required');
  if ((ROLE_RANK[staff.role] || 0) < (ROLE_RANK[role] || 99)) fail(403, 'forbidden');
  if (eventId && staff.role !== 'super_admin' && Array.isArray(staff.event_ids) && staff.event_ids.length && !staff.event_ids.includes(eventId)) fail(403, 'forbidden_event');
  return true;
}
export async function isMember(q, email) {
  if (!email) return false;
  const r = await q.query("SELECT 1 FROM oss_members WHERE email = $1 AND status = 'approved' AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)", [email]);
  return r.rows.length > 0;
}

/* ── rate limiting (fixed windows in the database, atomic) ──────── */
export async function rateLimit(q, bucket, id, limit, windowSec) {
  const key = `${bucket}:${id}`;
  const r = await q.query(
    `INSERT INTO oss_rate_limits (key, count, window_start) VALUES ($1, 1, now())
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN oss_rate_limits.window_start < now() - make_interval(secs => $2) THEN 1 ELSE oss_rate_limits.count + 1 END,
       window_start = CASE WHEN oss_rate_limits.window_start < now() - make_interval(secs => $2) THEN now() ELSE oss_rate_limits.window_start END
     RETURNING count`, [key, windowSec]);
  if (r.rows[0].count > limit) fail(429, 'rate_limited');
}
export const limitByIp = (q, bucket, req, context, limit, windowSec) => rateLimit(q, bucket, ipHash(clientIp(req, context)), limit, windowSec);
export const limitByEmail = (q, bucket, email, limit, windowSec) => rateLimit(q, bucket, sha256('e:' + email).slice(0, 24), limit, windowSec);

/* ── one-time links (verification, sign-in, waitlist claims) ───── */
export async function createPending(q, { kind, email, eventId, registrationId, lang, payload, ttlMin }) {
  const token = newToken(32);
  await q.query('INSERT INTO oss_pending (kind, token_hash, email, event_id, registration_id, lang, payload, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7, now() + make_interval(mins => $8))',
    [kind, tokenHash(token), email, eventId || null, registrationId || null, lang || 'en', JSON.stringify(payload || {}), ttlMin]);
  return token;
}
/* Consume inside a transaction: locks the row so a double click cannot use the link twice. */
export async function consumePending(q, token) {
  if (!token || token.length < 20 || token.length > 128) return { error: 'invalid' };
  const r = await q.query('SELECT * FROM oss_pending WHERE token_hash = $1 FOR UPDATE', [tokenHash(token)]);
  if (!r.rows.length) return { error: 'invalid' };
  const p = r.rows[0];
  if (p.used_at) return { error: 'used', pending: p };
  if (new Date(p.expires_at).getTime() < Date.now()) return { error: 'expired', pending: p };
  await q.query('UPDATE oss_pending SET used_at = now() WHERE id = $1', [p.id]);
  return { pending: p };
}

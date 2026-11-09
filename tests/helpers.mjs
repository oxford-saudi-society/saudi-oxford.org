/* Test harness: drives the API function in-process against a throwaway database.
   TEST_DATABASE_URL=postgres://… (recommended — real row locks and parallel transactions)
   otherwise PGlite in memory (single connection; logic still exercised). */
import { randomUUID } from 'node:crypto';

export async function setupDb() {
  if (process.env.OSS_TEST_NO_SECRET) delete process.env.AUTH_SECRET; // exercise the database-generated key
  else process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-test-secret-test-secret-0001';
  process.env.MAIL_PROVIDER = 'capture';
  process.env.SITE_URL = 'https://test.oxsss.org';
  process.env.ADMIN_BOOTSTRAP_EMAILS = 'root@example.org';
  process.env.PG_POOL_MAX = '12';
  const base = process.env.TEST_DATABASE_URL;
  if (base) {
    const { default: pg } = await import('pg');
    const admin = new pg.Client({ connectionString: base });
    await admin.connect();
    const name = 'oss_t_' + randomUUID().replace(/-/g, '').slice(0, 10);
    await admin.query(`CREATE DATABASE ${name}`);
    await admin.end();
    const u = new URL(base); u.pathname = '/' + name;
    process.env.DATABASE_URL = u.toString();
    process.env.DB_DRIVER = 'pg';
  } else {
    process.env.DB_DRIVER = 'pglite';
    delete process.env.DATABASE_URL;
  }
  const dbm = await import('../netlify/lib/db.mjs');
  await dbm._reset();
  const db = await dbm.ready();
  const E = await import('../netlify/lib/events.mjs');
  await E.seed(db);
  return db;
}

export async function makeClient() {
  const { default: api } = await import('../netlify/functions/api.mjs');
  const mail = await import('../netlify/lib/mail.mjs');
  const site = process.env.SITE_URL;
  let ipCounter = 0;
  async function call(method, path, opts = {}) {
    const headers = new Headers({ Accept: 'application/json' });
    if (opts.cookie) headers.set('cookie', opts.cookie);
    if (opts.headers) Object.entries(opts.headers).forEach(([k, v]) => headers.set(k, v));
    let body;
    if (opts.body !== undefined) { body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body); if (!headers.has('content-type')) headers.set('content-type', 'application/json'); }
    const waits = [];
    const res = await api(new Request((opts.base || site) + path, { method, headers, body, redirect: 'manual' }), { ip: opts.ip || '10.0.0.' + (opts.sameIp ? 1 : (++ipCounter % 250) + 1), waitUntil: (p) => waits.push(p) });
    await Promise.allSettled(waits);
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    return { status: res.status, headers: res.headers, location: res.headers.get('location'), cookie: (res.headers.get('set-cookie') || '').split(';')[0] || null, body: ct.includes('json') && text ? JSON.parse(text) : text };
  }
  const captured = mail._captured;
  const lastMail = (to, kind) => [...captured].reverse().find((m) => (!to || m.to_email === to) && (!kind || m.kind === kind));
  const linkIn = (m) => { const x = /https?:\/\/\S+verify\?t=([A-Za-z0-9_-]+)/.exec(m.body_text); return x ? x[1] : null; };
  const verify = (token) => call('GET', '/api/verify?t=' + token);
  async function signIn(email, redirect) {
    const r = await call('POST', '/api/auth/request-link', { body: { email, lang: 'en', redirect: redirect || '/account/' } });
    if (r.status !== 200) throw new Error('request-link ' + r.status + ' ' + JSON.stringify(r.body));
    const m = lastMail(email, 'login_link');
    const v = await verify(linkIn(m));
    return v.cookie;
  }
  return { call, captured, lastMail, linkIn, verify, signIn, site };
}

export const q = (db, sql, params) => db.query(sql, params).then((r) => r.rows);

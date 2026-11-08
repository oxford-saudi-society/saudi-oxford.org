/* Database access for the events system.
   Production: PostgreSQL through `pg` (Netlify DB / Neon sets NETLIFY_DATABASE_URL; any DATABASE_URL works).
   Tests without a server: PGlite (Postgres in WASM) when DB_DRIVER=pglite.
   One API either way: db.query(sql, params) and db.tx(async (q) => …) with q.query(). */
import { MIGRATIONS } from './migrations.mjs';

let instance = null;
let readyPromise = null;

function url() { return process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || process.env.NETLIFY_DATABASE_URL_UNPOOLED || ''; }

function sslFor(connectionString) {
  const mode = (process.env.DATABASE_SSL || '').toLowerCase();
  if (mode === 'disable') return false;
  if (mode === 'no-verify') return { rejectUnauthorized: false };
  let host = '';
  try { host = new URL(connectionString).hostname; } catch (e) { /* ignore */ }
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
  if (mode === 'require' || mode === 'verify') return { rejectUnauthorized: true };
  return local ? false : { rejectUnauthorized: true };
}

async function createPg() {
  const { default: pg } = await import('pg');
  const connectionString = url();
  // keep pg's own type parsing for timestamptz (Date) and leave int8 as string → we cast counts in SQL
  const pool = new pg.Pool({ connectionString, ssl: sslFor(connectionString), max: Number(process.env.PG_POOL_MAX || 4), idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 });
  pool.on('error', (e) => { console.error('[db] idle client error', e.message); });
  return {
    driver: 'pg',
    query: (sql, params) => pool.query(sql, params),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const r = await fn({ query: (sql, params) => client.query(sql, params) });
        await client.query('COMMIT');
        return r;
      } catch (e) { try { await client.query('ROLLBACK'); } catch (e2) { /* ignore */ } throw e; }
      finally { client.release(); }
    },
    close: () => pool.end(),
  };
}

async function createPglite() {
  const name = '@electric-sql/pglite'; // variable keeps the bundler from pulling the WASM package into the function
  const { PGlite } = await import(name);
  const lite = new PGlite(process.env.PGLITE_DIR || undefined);
  await lite.waitReady;
  const wrap = (r) => ({ rows: r.rows, rowCount: r.affectedRows != null ? r.affectedRows : r.rows.length });
  // PGlite is single-connection: serialise everything through one queue so transactions never interleave.
  let chain = Promise.resolve();
  const run = (job) => { const p = chain.then(job, job); chain = p.catch(() => {}); return p; };
  return {
    driver: 'pglite',
    query: (sql, params) => run(() => lite.query(sql, params).then(wrap)),
    tx: (fn) => run(() => lite.transaction(async (t) => fn({ query: (sql, params) => t.query(sql, params).then(wrap) }))),
    close: () => lite.close(),
  };
}

export async function getDb() {
  if (instance) return instance;
  const driver = (process.env.DB_DRIVER || (url() ? 'pg' : '')).toLowerCase();
  if (driver === 'pglite') instance = await createPglite();
  else if (driver === 'pg') instance = await createPg();
  else throw Object.assign(new Error('database_not_configured'), { status: 503 });
  return instance;
}

/* Run pending migrations once per process (cold start). Safe to call on every request. */
export function ready() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const db = await getDb();
      await db.query('CREATE TABLE IF NOT EXISTS oss_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const done = new Set((await db.query('SELECT id FROM oss_migrations')).rows.map((r) => r.id));
      for (const m of MIGRATIONS) {
        if (done.has(m.id)) continue;
        await db.tx(async (q) => {
          for (const stmt of m.sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await q.query(stmt);
          await q.query('INSERT INTO oss_migrations (id) VALUES ($1)', [m.id]);
        });
      }
      return db;
    })().catch((e) => { readyPromise = null; throw e; });
  }
  return readyPromise;
}

/* Test hook: forget the cached connection (used between PGlite instances). */
export async function _reset() { if (instance) { try { await instance.close(); } catch (e) { /* ignore */ } } instance = null; readyPromise = null; }

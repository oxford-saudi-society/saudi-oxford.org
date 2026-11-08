/* /api/* — the events API (Netlify Function, Fetch API style).
   Public: programme state, interest, bookings, email verification, calendar, tickets.
   Owner: /api/me, cancel, ticket rotation. Staff: /api/admin/*. */
import QRCode from 'qrcode';
import { ready } from '../lib/db.mjs';
import { HttpError, json, redirect, readJson, assertSameOrigin, siteUrl, normEmail, validEmail, cleanName, langOf, safePath, fail } from '../lib/http.mjs';
import { sessionFrom, sessionCookie, clearSessionCookie, staffFor, isMember, limitByIp, limitByEmail, rateLimit, createPending, consumePending, tokenHash, requireRole } from '../lib/auth.mjs';
import { enqueue, processOutbox } from '../lib/mail.mjs';
import * as E from '../lib/events.mjs';
import * as A from '../lib/admin.mjs';

export const config = { path: ['/api', '/api/*'] };

const PRIVACY_FALLBACK = E.SETTINGS.privacyVersion || '2026-11';

export default async function handler(req, context) {
  const t0 = Date.now();
  let db;
  try {
    db = await ready();
    await E.ensureSeeded(db);
    const res = await route(req, context, db);
    // deliver anything queued by this request without making the user wait for the provider
    const flush = processOutbox(db, 10).catch((e) => console.error('[mail] flush failed', e.message));
    if (context && typeof context.waitUntil === 'function') context.waitUntil(flush); else await flush;
    return res;
  } catch (e) {
    if (e instanceof HttpError) return json(Object.assign({ error: e.code }, e.extra || {}), e.status);
    if (e && (e.message === 'database_not_configured' || e.message === 'auth_secret_missing')) return json({ error: e.message }, 503);
    console.error('[api] error', req.method, new URL(req.url).pathname, e && e.stack || e);
    return json({ error: 'server_error' }, 500);
  } finally {
    if (process.env.API_LOG) console.log('[api]', req.method, new URL(req.url).pathname, Date.now() - t0 + 'ms');
  }
}

async function route(req, context, db) {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '').split('/').filter(Boolean);
  const m = req.method.toUpperCase();
  const site = siteUrl(req);
  const session = sessionFrom(req);
  const [a, b, c, d] = parts;

  if (m === 'GET' && (parts.length === 0 || a === 'health')) {
    const n = (await db.query('SELECT count(*)::int AS n FROM oss_events')).rows[0].n;
    return json({ ok: true, events: n, time: new Date().toISOString(), driver: db.driver });
  }

  /* ── public programme ─────────────────────────────────────────── */
  if (a === 'events' && !b && m === 'GET') {
    const evs = (await db.query('SELECT * FROM oss_events WHERE published ORDER BY start_utc')).rows;
    const out = [];
    for (const ev of evs) out.push(E.publicEvent(ev, await E.counts(db, ev.id)));
    return json({ events: out }, 200, { 'Cache-Control': 'public, max-age=30' });
  }
  if (a === 'events' && b && !c && m === 'GET') {
    const ev = await E.getEvent(db, b); if (!ev || !ev.published) fail(404, 'not_found');
    const cnt = await E.counts(db, ev.id);
    const out = { event: E.publicEvent(ev, cnt), me: null };
    if (session) {
      const reg = (await db.query('SELECT id, status, kind, created_at FROM oss_registrations WHERE event_id = $1 AND email = $2 AND status = ANY($3) LIMIT 1', [ev.id, session.email, E.ACTIVE])).rows[0] || null;
      out.me = { email: session.email, member: await isMember(db, session.email), registration: reg };
    }
    return json(out);
  }
  if (a === 'events' && b && c === 'calendar.ics' && m === 'GET') {
    const ev = await E.getEvent(db, b); if (!ev || !ev.published) fail(404, 'not_found');
    return new Response(E.icsFor(ev, site), { status: 200, headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${ev.slug}.ics"`, 'Cache-Control': 'public, max-age=300' } });
  }

  /* ── interest / booking requests ──────────────────────────────── */
  if (a === 'events' && b && (c === 'interest' || c === 'register') && m === 'POST') {
    assertSameOrigin(req);
    const body = await readJson(req);
    if (body.website) return json({ status: 'pending_verification' }); // honeypot: say nothing, do nothing
    const email = normEmail(body.email), name = cleanName(body.name), lang = langOf(body.lang);
    const fields = {};
    if (!validEmail(email)) fields.email = 'invalid';
    if (name.length < 2) fields.name = 'required';
    if (body.consent_privacy !== true) fields.privacy = 'required';
    if (Object.keys(fields).length) fail(400, 'validation', { fields });
    const privacyVersion = String(body.privacy_version || PRIVACY_FALLBACK).slice(0, 40);
    await limitByIp(db, 'signup_ip', req, context, 20, 3600);
    await limitByEmail(db, 'signup_email', email, 6, 3600);
    const idemKey = req.headers.get('idempotency-key') ? `${email}|${b}|${c}|${req.headers.get('idempotency-key')}` : null;
    const result = await db.tx(async (q) => E.idempotent(q, idemKey, async () => {
      const ev = await E.getEvent(q, b, { lock: true }); if (!ev || !ev.published) fail(404, 'not_found');
      const signedIn = session && session.email === email;
      const memberFlag = await isMember(q, email);
      if (c === 'interest') {
        if (signedIn) { const r = await E.recordInterest(q, { ev, email, name, lang, marketing: !!body.marketing_opt_in, privacyVersion, site, memberFlag }); if (r.result === 'not_open') fail(400, 'not_open'); return { status: 200, body: { status: r.result === 'already' ? 'already' : 'interested' } }; }
        return { status: 200, body: await E.requestInterest(q, { ev, email, name, lang, marketing: !!body.marketing_opt_in, privacyVersion, site }) };
      }
      // register (booking or waitlist)
      if (ev.audience === 'members') {
        if (!signedIn) fail(403, 'member_required', { reason: 'sign_in' });
        if (!memberFlag) fail(403, 'member_required');
      }
      if (signedIn) {
        const r = await E.assignSeat(q, { ev, email, name, lang, marketing: !!body.marketing_opt_in, privacyVersion, site, memberFlag, source: 'web_signed_in' });
        if (r.result === 'not_open') fail(400, 'not_open');
        if (r.result === 'member_required') fail(403, 'member_required');
        return { status: 200, body: { status: r.result === 'already' ? 'already' : r.result, registrationId: r.registration ? r.registration.id : undefined } };
      }
      return { status: 200, body: await E.requestBooking(q, { ev, email, name, lang, marketing: !!body.marketing_opt_in, privacyVersion, site, wantWaitlist: !!body.waitlist }) };
    }));
    return json(result.body, result.status || 200);
  }

  /* ── email links ──────────────────────────────────────────────── */
  if (a === 'verify' && m === 'GET') {
    await limitByIp(db, 'verify_ip', req, context, 60, 3600);
    const token = url.searchParams.get('t') || '';
    const out = await db.tx(async (q) => {
      const { pending, error } = await consumePending(q, token);
      const lang = pending ? pending.lang : 'en';
      const base = site + (lang === 'ar' ? '/ar' : '');
      if (error) {
        const ev = pending && pending.event_id ? await E.getEvent(q, pending.event_id) : null;
        return { to: (ev ? `${base}/events/${ev.slug}/` : `${base}/account/`) + '?verified=' + error };
      }
      const p = pending.payload || {};
      if (pending.kind === 'login') {
        const to = safePath(p.redirect || '/account/');
        return { to: site + to + (to.indexOf('?') === -1 ? '?' : '&') + 'verified=signed_in', cookie: sessionCookie(pending.email, req) };
      }
      const ev = await E.getEvent(q, pending.event_id, { lock: true });
      const back = `${base}/events/${ev.slug}/?verified=`;
      const memberFlag = await isMember(q, pending.email);
      if (pending.kind === 'interest') {
        const r = await E.recordInterest(q, { ev, email: pending.email, name: p.name || '', lang, marketing: !!p.marketing, privacyVersion: p.privacyVersion || PRIVACY_FALLBACK, site, memberFlag });
        return { to: back + (r.result === 'not_open' ? 'not_open' : r.result === 'already' ? 'already' : 'interest'), cookie: sessionCookie(pending.email, req) };
      }
      if (pending.kind === 'booking' || pending.kind === 'waitlist') {
        const r = await E.assignSeat(q, { ev, email: pending.email, name: p.name || '', lang, marketing: !!p.marketing, privacyVersion: p.privacyVersion || PRIVACY_FALLBACK, site, memberFlag, source: 'web_verified' });
        const key = r.result === 'confirmed' ? 'confirmed' : r.result === 'waitlisted' ? 'waitlisted' : r.result === 'full' ? 'full' : r.result === 'already' ? 'already' : r.result === 'member_required' ? 'member_required' : 'not_open';
        if (r.result === 'full') { const u = E.urls(site, lang, ev); await enqueue(q, { kind: 'booking_full', to: pending.email, lang, eventId: ev.id, vars: Object.assign({ name: p.name || '', ev: E.titled(ev, lang), waitlist: ev.waitlist_enabled }, u) }); }
        return { to: back + key, cookie: sessionCookie(pending.email, req) };
      }
      if (pending.kind === 'claim') {
        const reg = (await q.query('SELECT * FROM oss_registrations WHERE id = $1', [pending.registration_id])).rows[0];
        const r = await E.claimSeat(q, { reg, ev, site });
        return { to: back + (r.result === 'claimed' ? 'claimed' : 'claim_gone'), cookie: sessionCookie(pending.email, req) };
      }
      return { to: `${base}/account/?verified=invalid` };
    });
    return redirect(out.to, out.cookie ? { 'Set-Cookie': out.cookie } : {});
  }

  /* ── sign-in links & session ──────────────────────────────────── */
  if (a === 'auth' && b === 'request-link' && m === 'POST') {
    assertSameOrigin(req);
    const body = await readJson(req);
    if (body.website) return json({ status: 'link_sent' });
    const email = normEmail(body.email), lang = langOf(body.lang);
    if (!validEmail(email)) fail(400, 'validation', { fields: { email: 'invalid' } });
    await limitByIp(db, 'login_ip', req, context, 10, 3600);
    await limitByEmail(db, 'login_email', email, 5, 3600);
    const redirectTo = safePath(body.redirect || (lang === 'ar' ? '/ar/account/' : '/account/'));
    await db.tx(async (q) => {
      // enumeration-safe: we always answer the same; a link is only useful to the inbox owner anyway
      const token = await createPending(q, { kind: 'login', email, lang, ttlMin: 30, payload: { redirect: redirectTo } });
      await enqueue(q, { kind: 'login_link', to: email, lang, vars: { link: `${site}/api/verify?t=${token}`, siteUrl: site } });
    });
    return json({ status: 'link_sent' });
  }
  if (a === 'auth' && b === 'logout' && m === 'POST') { assertSameOrigin(req); return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() }); }

  /* ── the signed-in person's own registrations ─────────────────── */
  if (a === 'me' && m === 'GET') {
    if (!session) fail(401, 'sign_in_required');
    const rows = (await db.query(`SELECT r.id, r.status, r.kind, r.lang, r.created_at, r.confirmed_at, r.checked_in_at, r.offered_at, r.claim_expires_at, e.id AS event_id, e.slug, e.content, e.start_utc, e.end_utc, e.event_status, e.venue_key, e.version
      FROM oss_registrations r JOIN oss_events e ON e.id = r.event_id WHERE r.email = $1 ORDER BY e.start_utc`, [session.email])).rows;
    const staff = await staffFor(db, session.email);
    return json({ email: session.email, member: await isMember(db, session.email), staff: staff ? { role: staff.role } : null, registrations: rows.map((r) => ({ id: r.id, status: r.status, kind: r.kind, createdAt: r.created_at, confirmedAt: r.confirmed_at, checkedInAt: r.checked_in_at, claimExpiresAt: r.claim_expires_at,
      event: { id: r.event_id, slug: r.slug, title: r.content.title, image: r.content.image ? r.content.image.thumb : null, startUtc: r.start_utc, endUtc: r.end_utc, eventStatus: r.event_status, venue: { en: E.venueName({ venue_key: r.venue_key }, 'en'), ar: E.venueName({ venue_key: r.venue_key }, 'ar') }, version: r.version } })) });
  }
  if (a === 'registrations' && b && c === 'cancel' && m === 'POST') {
    assertSameOrigin(req);
    if (!session) fail(401, 'sign_in_required');
    await rateLimit(db, 'cancel', session.email, 20, 3600);
    const out = await db.tx(async (q) => {
      const reg = (await q.query('SELECT * FROM oss_registrations WHERE id = $1 FOR UPDATE', [b])).rows[0];
      if (!reg || reg.email !== session.email) fail(404, 'not_found'); // no IDOR: others' ids look non-existent
      const ev = await E.getEvent(q, reg.event_id, { lock: true });
      return E.cancelRegistration(q, { reg, ev, actor: session.email, reason: 'cancelled by attendee', byAdmin: false, site });
    });
    return json({ ok: out.result === 'cancelled', result: out.result });
  }
  if (a === 'registrations' && b && c === 'claim' && m === 'POST') {
    assertSameOrigin(req);
    if (!session) fail(401, 'sign_in_required');
    await rateLimit(db, 'claim', session.email, 20, 3600);
    const out = await db.tx(async (q) => {
      const reg = (await q.query('SELECT * FROM oss_registrations WHERE id = $1 FOR UPDATE', [b])).rows[0];
      if (!reg || reg.email !== session.email) fail(404, 'not_found');
      const ev = await E.getEvent(q, reg.event_id, { lock: true });
      return E.claimSeat(q, { reg, ev, site });
    });
    return json({ ok: out.result === 'claimed', result: out.result });
  }
  if (a === 'registrations' && b && c === 'ticket' && m === 'POST') {
    assertSameOrigin(req);
    if (!session) fail(401, 'sign_in_required');
    await rateLimit(db, 'ticket_view', session.email, 30, 3600);
    const out = await db.tx(async (q) => {
      const reg = (await q.query('SELECT * FROM oss_registrations WHERE id = $1 FOR UPDATE', [b])).rows[0];
      if (!reg || reg.email !== session.email) fail(404, 'not_found');
      if (!(reg.status === 'confirmed' || reg.status === 'checked_in')) fail(400, 'not_confirmed');
      const token = await E.issueTicket(q, reg.id); // viewing rotates the ticket; only hashes are stored
      await E.audit(q, session.email, 'ticket.viewed', 'registration:' + reg.id, null);
      return { token };
    });
    return json({ token: out.token, url: `${site}/t/${out.token}` });
  }

  /* ── ticket page data (the token is the credential) ───────────── */
  if (a === 'tickets' && b && m === 'GET') {
    await limitByIp(db, 'ticket_ip', req, context, 120, 3600);
    const t = (await db.query(`SELECT t.revoked_at, t.revoked_reason, r.id AS reg_id, r.name, r.status, r.checked_in_at, r.lang, e.id AS event_id, e.slug, e.content, e.start_utc, e.end_utc, e.event_status, e.venue_key
      FROM oss_ticket_tokens t JOIN oss_registrations r ON r.id = t.registration_id JOIN oss_events e ON e.id = r.event_id WHERE t.token_hash = $1`, [tokenHash(b)])).rows[0];
    if (!t) fail(404, 'not_found');
    const valid = !t.revoked_at && (t.status === 'confirmed' || t.status === 'checked_in');
    const qr = valid ? await QRCode.toString('OSS1:' + b, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#002147', light: '#ffffff' } }) : null;
    return json({ valid, revoked: !!t.revoked_at, status: t.status, checkedInAt: t.checked_in_at, attendee: E.displayName(t.name), lang: t.lang, qrSvg: qr,
      event: { id: t.event_id, slug: t.slug, title: t.content.title, image: t.content.image ? t.content.image.thumb : null, startUtc: t.start_utc, endUtc: t.end_utc, eventStatus: t.event_status, venue: { en: E.venueName({ venue_key: t.venue_key }, 'en'), ar: E.venueName({ venue_key: t.venue_key }, 'ar') } } });
  }

  /* ── committee desk ───────────────────────────────────────────── */
  if (a === 'admin') {
    if (!session) fail(401, 'sign_in_required');
    const staff = await staffFor(db, session.email);
    if (!staff) fail(403, 'staff_required');
    if (m !== 'GET') assertSameOrigin(req);
    const body = m === 'GET' ? null : await readJson(req);
    const P = url.searchParams;
    if (b === 'me' && m === 'GET') return json({ email: staff.email, role: staff.role, eventIds: staff.event_ids, name: staff.name });
    if (b === 'overview' && m === 'GET') return json(await A.overview(db, staff));
    if (b === 'events' && c && !d && m === 'GET') return json(await A.eventDetail(db, staff, c));
    if (b === 'events' && c && !d && m === 'PATCH') return json(await db.tx((q) => A.updateEvent(q, staff, c, body, site)));
    if (b === 'events' && c && d === 'registrations' && m === 'GET') return json(await A.roster(db, staff, c, P));
    if (b === 'events' && c && d === 'registrations.csv' && m === 'GET') { const r = await db.tx((q) => A.rosterCsv(q, staff, c)); return new Response(r.csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${r.filename}"`, 'Cache-Control': 'no-store' } }); }
    if (b === 'events' && c && d === 'check-in' && m === 'POST') return json(await db.tx((q) => A.checkIn(q, staff, c, body)));
    if (b === 'events' && c && d === 'check-in' && m === 'GET') return json(await db.tx((q) => A.checkInSearch(q, staff, c, P.get('q'))));
    if (b === 'events' && c && d === 'notify' && m === 'POST') return json(await db.tx((q) => A.notify(q, staff, c, body, site)));
    if (b === 'registrations' && c && d === 'cancel' && m === 'POST') return json(await db.tx((q) => A.cancelByAdmin(q, staff, c, body, site)));
    if (b === 'registrations' && c && d === 'resend-ticket' && m === 'POST') return json(await db.tx((q) => A.resendTicket(q, staff, c, site)));
    if (b === 'mail' && !c && m === 'GET') return json(await A.mailQueue(db, staff, P));
    if (b === 'mail' && c && d === 'retry' && m === 'POST') return json(await A.mailRetry(db, staff, c));
    if (b === 'mail' && c === 'process' && m === 'POST') { requireRole(staff, 'events_admin'); return json(await processOutbox(db, 50)); }
    if (b === 'audit' && m === 'GET') return json(await A.auditLog(db, staff, P));
    if (b === 'staff' && m === 'GET') return json(await A.staffList(db, staff));
    if (b === 'staff' && m === 'POST') return json(await A.staffUpsert(db, staff, body));
    if (b === 'staff' && c && m === 'DELETE') return json(await A.staffDisable(db, staff, decodeURIComponent(c)));
    if (b === 'members' && m === 'GET') return json(await A.membersList(db, staff, P));
    if (b === 'members' && m === 'POST') return json(await A.memberUpsert(db, staff, body));
    if (b === 'publish' && m === 'POST') return json(await A.triggerPublish(db, staff));
    fail(404, 'not_found');
  }
  fail(404, 'not_found');
}

/* Events domain logic: seeding from the published content, registration state, seats, waitlist,
   tickets and check-in. Every seat decision happens inside a transaction holding the event row lock. */
import { EVENTS, VENUES, SETTINGS } from './content.generated.mjs';
import * as T from '../../shared/time.cjs';
import { fail, sha256 } from './http.mjs';
import { createPending, newToken, tokenHash, isMember } from './auth.mjs';
import { enqueue } from './mail.mjs';

export const ACTIVE = ['interested', 'confirmed', 'waitlisted', 'offered', 'checked_in'];
export const SEATED = ['confirmed', 'offered', 'checked_in']; // statuses that hold a seat
const L = (o, lang) => (o && typeof o === 'object') ? (o[lang] || o.en || '') : (o || '');
export const CLAIM_HOURS = Number(process.env.WAITLIST_CLAIM_HOURS || 24);

/* ── seed / sync from content (idempotent; never resets committee edits) ── */
export async function seed(db) {
  for (const e of EVENTS) {
    await db.query(
      `INSERT INTO oss_events (id, slug, event_status, registration_mode, audience, price_status, capacity, waitlist_enabled, start_utc, end_utc, venue_key, published, visibility, content, seeded_from)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'content')
       ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, content = EXCLUDED.content, published = EXCLUDED.published, visibility = EXCLUDED.visibility, updated_at = now()`,
      [e.id, e.slug, e.eventStatus || 'proposed', e.registrationMode || 'interest_only', e.audience || 'public', (e.price && e.price.status) || 'free', e.capacity == null ? null : e.capacity,
        e.waitlistEnabled !== false, e.start, e.end, e.venueKey || null, e.published !== false, e.visibility || 'published_as_proposal',
        JSON.stringify({ title: e.title, description: e.description, agenda: e.agenda, category: e.category, image: e.image, order: e.order, dateNotice: e.dateNotice, bookingRequired: e.bookingRequired, price: e.price })]);
  }
}
let seeded = null;
export function ensureSeeded(db) { if (!seeded) seeded = seed(db).catch((e) => { seeded = null; throw e; }); return seeded; }

/* ── lookups ────────────────────────────────────────────────────── */
export async function getEvent(q, idOrSlug, { lock = false } = {}) {
  const r = await q.query(`SELECT * FROM oss_events WHERE (id = $1 OR slug = $1)${lock ? ' FOR UPDATE' : ''}`, [idOrSlug]);
  return r.rows[0] || null;
}
export async function counts(q, eventId) {
  const r = await q.query(`SELECT status, count(*)::int AS n FROM oss_registrations WHERE event_id = $1 GROUP BY status`, [eventId]);
  const c = { interested: 0, confirmed: 0, waitlisted: 0, offered: 0, checked_in: 0, cancelled: 0, expired: 0, declined: 0 };
  r.rows.forEach((x) => { c[x.status] = x.n; });
  c.seated = c.confirmed + c.offered + c.checked_in;
  return c;
}
export function seatsLeft(ev, c) { return ev.capacity == null ? null : Math.max(0, ev.capacity - c.seated); }

/* Server-derived registration state — the only source the client may act on. */
export function stateOf(ev, c, now = new Date()) {
  if (ev.event_status === 'cancelled') return 'cancelled';
  if (ev.event_status === 'postponed') return 'tbc';
  if (new Date(ev.end_utc) < now || ev.event_status === 'completed') return 'past';
  if (ev.registration_mode === 'none') return 'none';
  if (ev.event_status === 'proposed') return ev.registration_mode === 'interest_only' ? 'interest' : 'soon';
  // confirmed
  if (ev.registration_mode === 'interest_only') return 'soon';
  if (ev.registration_mode === 'closed') return 'closed';
  if (ev.booking_opens_at && new Date(ev.booking_opens_at) > now) return 'soon';
  if (ev.booking_closes_at && new Date(ev.booking_closes_at) < now) return 'closed';
  const left = seatsLeft(ev, c);
  if (ev.registration_mode === 'open') { if (left == null || left > 0) return 'book'; return ev.waitlist_enabled ? 'waitlist' : 'full'; }
  if (ev.registration_mode === 'waitlist_only') return ev.waitlist_enabled ? 'waitlist' : 'full';
  return 'closed';
}

export function publicEvent(ev, c, now) {
  const st = stateOf(ev, c, now);
  return { id: ev.id, slug: ev.slug, version: ev.version, eventStatus: ev.event_status, registrationMode: ev.registration_mode, audience: ev.audience, priceStatus: ev.price_status,
    capacity: ev.capacity, waitlistEnabled: ev.waitlist_enabled, seatsLeft: seatsLeft(ev, c), startUtc: new Date(ev.start_utc).toISOString(), endUtc: new Date(ev.end_utc).toISOString(),
    venueKey: ev.venue_key, bookingOpensAt: ev.booking_opens_at, bookingClosesAt: ev.booking_closes_at, state: st, updatedAt: ev.updated_at };
}
export function titled(ev, lang) { return { title: L(ev.content && ev.content.title, lang), start_utc: ev.start_utc, end_utc: ev.end_utc, event_status: ev.event_status, slug: ev.slug, id: ev.id }; }
export function venueName(ev, lang) { const v = VENUES[ev.venue_key]; return v ? L(v.name, lang) : (lang === 'ar' ? 'يُعلن لاحقًا' : 'To be announced'); }
export const urls = (site, lang, ev) => {
  const b = site + (lang === 'ar' ? '/ar' : '');
  return { eventUrl: `${b}/events/${ev.slug}/`, eventsUrl: `${b}/events/`, accountUrl: `${b}/account/`, icsUrl: `${site}/api/events/${ev.id}/calendar.ics`, siteUrl: site };
};

/* ── interest (non-ticket) ──────────────────────────────────────── */
export async function requestInterest(q, { ev, email, name, lang, marketing, privacyVersion, site }) {
  if (stateOf(ev, await counts(q, ev.id)) !== 'interest') fail(400, 'not_open');
  const token = await createPending(q, { kind: 'interest', email, eventId: ev.id, lang, ttlMin: 60, payload: { name, marketing: !!marketing, privacyVersion } });
  await enqueue(q, { kind: 'verify_interest', to: email, lang, eventId: ev.id, vars: { name, ev: titled(ev, lang), link: `${site}/api/verify?t=${token}`, siteUrl: site } });
  return { status: 'pending_verification' };
}
export async function recordInterest(q, { ev, email, name, lang, marketing, privacyVersion, site, memberFlag }) {
  if (stateOf(ev, await counts(q, ev.id)) !== 'interest') return { result: 'not_open' };
  const ex = await q.query(`SELECT * FROM oss_registrations WHERE event_id = $1 AND email = $2 AND status = ANY($3) FOR UPDATE`, [ev.id, email, ACTIVE]);
  if (ex.rows.length) return { result: 'already', registration: ex.rows[0] };
  const r = await q.query(
    `INSERT INTO oss_registrations (event_id, email, name, kind, status, lang, member_at_booking, consent_privacy_version, marketing_opt_in, marketing_opt_in_at, event_version)
     VALUES ($1,$2,$3,'interest','interested',$4,$5,$6,$7, CASE WHEN $7 THEN now() ELSE NULL END, $8) RETURNING *`,
    [ev.id, email, name, lang, !!memberFlag, privacyVersion, !!marketing, ev.version]);
  const reg = r.rows[0];
  const u = urls(site, lang, ev);
  await enqueue(q, { kind: 'interest_received', to: email, lang, registrationId: reg.id, eventId: ev.id, dedupeKey: `interest_received:${reg.id}`, vars: Object.assign({ name, ev: titled(ev, lang) }, u) });
  await audit(q, email, 'interest.recorded', 'registration:' + reg.id, { event: ev.id });
  return { result: 'interested', registration: reg };
}

/* ── bookings ───────────────────────────────────────────────────── */
export async function requestBooking(q, { ev, email, name, lang, marketing, privacyVersion, site, wantWaitlist }) {
  const st = stateOf(ev, await counts(q, ev.id));
  if (!(st === 'book' || st === 'waitlist')) fail(400, 'not_open');
  if (ev.audience === 'members') fail(403, 'member_required'); // members must be signed in; verified by the caller before reaching here
  const kind = st === 'waitlist' || wantWaitlist ? 'waitlist' : 'booking';
  const token = await createPending(q, { kind, email, eventId: ev.id, lang, ttlMin: 60, payload: { name, marketing: !!marketing, privacyVersion } });
  await enqueue(q, { kind: kind === 'waitlist' ? 'verify_waitlist' : 'verify_booking', to: email, lang, eventId: ev.id, vars: { name, ev: titled(ev, lang), link: `${site}/api/verify?t=${token}`, siteUrl: site } });
  return { status: 'pending_verification' };
}

/* The seat decision. Caller must hold the event row lock (getEvent with lock) inside a transaction. */
export async function assignSeat(q, { ev, email, name, lang, marketing, privacyVersion, site, memberFlag, source }) {
  const c = await counts(q, ev.id);
  const st = stateOf(ev, c);
  if (!(st === 'book' || st === 'waitlist' || st === 'full')) return { result: 'not_open', state: st };
  if (ev.audience === 'members' && !memberFlag) return { result: 'member_required' };
  const ex = await q.query(`SELECT * FROM oss_registrations WHERE event_id = $1 AND email = $2 AND status = ANY($3) FOR UPDATE`, [ev.id, email, ACTIVE]);
  const existing = ex.rows[0] || null;
  if (existing && existing.status !== 'interested') return { result: 'already', registration: existing };
  const left = seatsLeft(ev, c);
  let status;
  if (left == null || left > 0) status = 'confirmed';
  else if (ev.waitlist_enabled) status = 'waitlisted';
  else return { result: 'full' };
  let reg;
  if (existing) { // interest upgraded to a booking, same row
    reg = (await q.query(`UPDATE oss_registrations SET kind = 'booking', status = $2, name = $3, lang = $4, member_at_booking = $5, consent_privacy_version = $6, consent_at = now(),
      marketing_opt_in = $7, marketing_opt_in_at = CASE WHEN $7 AND NOT marketing_opt_in THEN now() ELSE marketing_opt_in_at END, confirmed_at = CASE WHEN $2 = 'confirmed' THEN now() ELSE NULL END,
      event_version = $8, source = $9, updated_at = now() WHERE id = $1 RETURNING *`, [existing.id, status, name, lang, !!memberFlag, privacyVersion, !!marketing, ev.version, source || 'web'])).rows[0];
  } else {
    reg = (await q.query(`INSERT INTO oss_registrations (event_id, email, name, kind, status, lang, member_at_booking, consent_privacy_version, marketing_opt_in, marketing_opt_in_at, confirmed_at, event_version, source)
      VALUES ($1,$2,$3,'booking',$4,$5,$6,$7,$8, CASE WHEN $8 THEN now() ELSE NULL END, CASE WHEN $4 = 'confirmed' THEN now() ELSE NULL END, $9, $10) RETURNING *`,
      [ev.id, email, name, status, lang, !!memberFlag, privacyVersion, !!marketing, ev.version, source || 'web'])).rows[0];
  }
  const u = urls(site, lang, ev);
  if (status === 'confirmed') {
    const ticket = await issueTicket(q, reg.id);
    await enqueue(q, { kind: 'booking_confirmed', to: email, lang, registrationId: reg.id, eventId: ev.id, dedupeKey: `booking_confirmed:${reg.id}:${ticket.slice(0, 8)}`,
      vars: Object.assign({ name, ev: titled(ev, lang), venue: venueName(ev, lang), ticketUrl: `${site}/t/${ticket}` }, u), attachments: [{ filename: `${ev.slug}.ics`, content: Buffer.from(icsFor(ev, site)).toString('base64') }] });
    await audit(q, email, 'booking.confirmed', 'registration:' + reg.id, { event: ev.id, source: source || 'web' });
    return { result: 'confirmed', registration: reg, ticket };
  }
  await enqueue(q, { kind: 'waitlisted', to: email, lang, registrationId: reg.id, eventId: ev.id, dedupeKey: `waitlisted:${reg.id}`, vars: Object.assign({ name, ev: titled(ev, lang) }, u) });
  await audit(q, email, 'booking.waitlisted', 'registration:' + reg.id, { event: ev.id });
  return { result: 'waitlisted', registration: reg };
}

export async function issueTicket(q, registrationId) {
  await q.query(`UPDATE oss_ticket_tokens SET revoked_at = now(), revoked_reason = 'reissued' WHERE registration_id = $1 AND revoked_at IS NULL`, [registrationId]);
  const token = newToken(24);
  await q.query('INSERT INTO oss_ticket_tokens (registration_id, token_hash) VALUES ($1, $2)', [registrationId, tokenHash(token)]);
  return token;
}
export async function revokeTickets(q, registrationId, reason) {
  await q.query(`UPDATE oss_ticket_tokens SET revoked_at = now(), revoked_reason = $2 WHERE registration_id = $1 AND revoked_at IS NULL`, [registrationId, reason || 'cancelled']);
}

/* ── cancel + waitlist promotion ────────────────────────────────── */
export async function cancelRegistration(q, { reg, ev, actor, reason, byAdmin, site }) {
  if (!ACTIVE.includes(reg.status)) return { result: 'not_active' };
  const heldSeat = SEATED.includes(reg.status);
  await q.query(`UPDATE oss_registrations SET status = 'cancelled', cancelled_at = now(), cancel_reason = $2, updated_at = now() WHERE id = $1`, [reg.id, (reason || '').slice(0, 300)]);
  await revokeTickets(q, reg.id, byAdmin ? 'cancelled_by_admin' : 'cancelled_by_user');
  const u = urls(site, reg.lang, ev);
  await enqueue(q, { kind: 'registration_cancelled', to: reg.email, lang: reg.lang, registrationId: reg.id, eventId: ev.id, dedupeKey: `cancelled:${reg.id}:${Date.now()}`, vars: Object.assign({ name: reg.name, ev: titled(ev, reg.lang), byAdmin: !!byAdmin, reason: byAdmin ? reason : '' }, u) });
  await audit(q, actor, byAdmin ? 'registration.cancelled_by_admin' : 'registration.cancelled', 'registration:' + reg.id, { event: ev.id, reason: reason || null });
  let promoted = [];
  if (heldSeat) promoted = await promoteWaitlist(q, { ev, site });
  return { result: 'cancelled', promoted };
}

/* Offer freed seats to the oldest waitlisted people (FIFO). Caller holds the event row lock. */
export async function promoteWaitlist(q, { ev, site }) {
  const out = [];
  if (!ev.waitlist_enabled || ev.event_status !== 'confirmed') return out;
  for (;;) {
    const c = await counts(q, ev.id);
    const left = seatsLeft(ev, c);
    if (left != null && left <= 0) break;
    const next = (await q.query(`SELECT * FROM oss_registrations WHERE event_id = $1 AND status = 'waitlisted' ORDER BY waitlist_seq ASC LIMIT 1 FOR UPDATE SKIP LOCKED`, [ev.id])).rows[0];
    if (!next) break;
    const token = await createPending(q, { kind: 'claim', email: next.email, eventId: ev.id, registrationId: next.id, lang: next.lang, ttlMin: CLAIM_HOURS * 60 });
    const exp = new Date(Date.now() + CLAIM_HOURS * 3600 * 1000);
    await q.query(`UPDATE oss_registrations SET status = 'offered', offered_at = now(), claim_expires_at = $2, updated_at = now() WHERE id = $1`, [next.id, exp]);
    const u = urls(site, next.lang, ev);
    await enqueue(q, { kind: 'waitlist_offer', to: next.email, lang: next.lang, registrationId: next.id, eventId: ev.id, dedupeKey: `offer:${next.id}:${exp.getTime()}`,
      vars: Object.assign({ name: next.name, ev: titled(ev, next.lang), link: `${site}/api/verify?t=${token}`, expiresText: T.fmtWhen(exp, exp, next.lang).split(/[,،]/)[0] + ' ' + T.fmtTime(exp, next.lang) }, u) });
    await audit(q, 'system', 'waitlist.offered', 'registration:' + next.id, { event: ev.id, expires: exp.toISOString() });
    out.push(next.id);
  }
  return out;
}

/* Claim an offered seat (from the email link). Caller holds the event lock. */
export async function claimSeat(q, { reg, ev, site }) {
  const fresh = (await q.query('SELECT * FROM oss_registrations WHERE id = $1 FOR UPDATE', [reg.id])).rows[0];
  if (!fresh || fresh.status !== 'offered') return { result: 'claim_gone', registration: fresh };
  if (fresh.claim_expires_at && new Date(fresh.claim_expires_at) < new Date()) return { result: 'claim_gone', registration: fresh };
  await q.query(`UPDATE oss_registrations SET status = 'confirmed', confirmed_at = now(), claim_expires_at = NULL, updated_at = now() WHERE id = $1`, [fresh.id]);
  const ticket = await issueTicket(q, fresh.id);
  const u = urls(site, fresh.lang, ev);
  await enqueue(q, { kind: 'booking_confirmed', to: fresh.email, lang: fresh.lang, registrationId: fresh.id, eventId: ev.id, dedupeKey: `booking_confirmed:${fresh.id}:${ticket.slice(0, 8)}`,
    vars: Object.assign({ name: fresh.name, ev: titled(ev, fresh.lang), venue: venueName(ev, fresh.lang), ticketUrl: `${site}/t/${ticket}` }, u), attachments: [{ filename: `${ev.slug}.ics`, content: Buffer.from(icsFor(ev, site)).toString('base64') }] });
  await audit(q, fresh.email, 'waitlist.claimed', 'registration:' + fresh.id, { event: ev.id });
  return { result: 'claimed', registration: fresh, ticket };
}

/* Expire offers whose claim window passed; release the seat to the next person. */
export async function expireOffers(db, site) {
  const due = (await db.query(`SELECT r.id, r.event_id FROM oss_registrations r WHERE r.status = 'offered' AND r.claim_expires_at < now()`)).rows;
  let n = 0;
  for (const row of due) {
    await db.tx(async (q) => {
      const ev = await getEvent(q, row.event_id, { lock: true });
      const reg = (await q.query(`SELECT * FROM oss_registrations WHERE id = $1 AND status = 'offered' AND claim_expires_at < now() FOR UPDATE`, [row.id])).rows[0];
      if (!reg) return;
      await q.query(`UPDATE oss_registrations SET status = 'expired', updated_at = now() WHERE id = $1`, [reg.id]);
      const u = urls(site, reg.lang, ev);
      await enqueue(q, { kind: 'offer_expired', to: reg.email, lang: reg.lang, registrationId: reg.id, eventId: ev.id, dedupeKey: `offer_expired:${reg.id}`, vars: Object.assign({ name: reg.name, ev: titled(ev, reg.lang) }, u) });
      await audit(q, 'system', 'waitlist.offer_expired', 'registration:' + reg.id, { event: ev.id });
      await promoteWaitlist(q, { ev, site });
      n++;
    });
  }
  return n;
}

/* ── check-in ───────────────────────────────────────────────────── */
export async function checkInByToken(q, { ev, token, staffEmail }) {
  const t = (await q.query(`SELECT t.*, r.status AS reg_status, r.event_id, r.name, r.checked_in_at FROM oss_ticket_tokens t JOIN oss_registrations r ON r.id = t.registration_id WHERE t.token_hash = $1 FOR UPDATE OF r`, [tokenHash(String(token || '').replace(/^OSS1:/, ''))])).rows[0];
  if (!t) return { result: 'invalid' };
  if (t.event_id !== ev.id) return { result: 'wrong_event' };
  if (t.revoked_at) return { result: 'revoked' };
  return checkInRegistration(q, { ev, registrationId: t.registration_id, staffEmail, method: 'qr' });
}
export async function checkInRegistration(q, { ev, registrationId, staffEmail, method }) {
  const reg = (await q.query('SELECT * FROM oss_registrations WHERE id = $1 AND event_id = $2 FOR UPDATE', [registrationId, ev.id])).rows[0];
  if (!reg) return { result: 'invalid' };
  const who = { name: displayName(reg.name), status: reg.status, registrationId: reg.id };
  if (reg.status === 'checked_in') return Object.assign({ result: 'duplicate', checkedInAt: reg.checked_in_at }, who);
  if (reg.status !== 'confirmed') return Object.assign({ result: 'not_confirmed' }, who);
  await q.query(`UPDATE oss_registrations SET status = 'checked_in', checked_in_at = now(), updated_at = now() WHERE id = $1`, [reg.id]);
  await q.query('INSERT INTO oss_checkins (registration_id, event_id, staff_email, method) VALUES ($1,$2,$3,$4)', [reg.id, ev.id, staffEmail, method]);
  await audit(q, staffEmail, 'checkin.' + method, 'registration:' + reg.id, { event: ev.id });
  return Object.assign({ result: 'admitted', checkedInAt: new Date().toISOString() }, who);
}
export const displayName = (n) => { const parts = String(n || '').trim().split(/\s+/); return parts.length > 1 ? parts[0] + ' ' + parts[parts.length - 1][0] + '.' : parts[0] || ''; };
export const maskEmail = (e) => { const [u, d] = String(e).split('@'); return (u || '').slice(0, 2) + '…@' + (d || ''); };

/* ── calendar + ticket data ─────────────────────────────────────── */
export function icsFor(ev, site) {
  const status = ev.event_status === 'cancelled' ? 'CANCELLED' : ev.event_status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE';
  const title = L(ev.content.title, 'en') + (ev.event_status === 'proposed' ? ' (proposed)' : ev.event_status === 'postponed' ? ' (postponed — date to be confirmed)' : '');
  const fold = (s) => s.replace(/(.{70})/g, '$1\r\n ');
  const escT = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const url = `${site}/events/${ev.slug}/`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Oxford Saudi Society//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${ev.id}@ousss.org`, `DTSTAMP:${T.icsUtc(new Date())}`, `DTSTART:${T.icsUtc(ev.start_utc)}`, `DTEND:${T.icsUtc(ev.end_utc)}`, `SEQUENCE:${ev.version}`, `STATUS:${status}`,
    fold(`SUMMARY:${escT(title)}`), fold(`DESCRIPTION:${escT(L(ev.content.description, 'en') + (ev.event_status === 'proposed' ? '\nDate and venue are proposed and not yet confirmed.' : '') + '\n' + url)}`),
    fold(`LOCATION:${escT(venueName(ev, 'en') + (ev.event_status === 'proposed' ? ' (proposed)' : ''))}`), `URL:${url}`, 'END:VEVENT', 'END:VCALENDAR'];
  return lines.join('\r\n') + '\r\n';
}

export async function audit(q, actor, action, resource, meta) {
  await q.query('INSERT INTO oss_audit (actor, action, resource, meta) VALUES ($1,$2,$3,$4)', [String(actor || 'anonymous').slice(0, 200), action, resource || null, meta ? JSON.stringify(meta) : null]);
}

/* Idempotency: same key + same actor → same answer for 24h. */
export async function idempotent(q, key, compute) {
  if (!key) return compute();
  const k = sha256('idem:' + key);
  const hit = await q.query('SELECT status, response FROM oss_idempotency WHERE key = $1 AND created_at > now() - interval \'24 hours\'', [k]);
  if (hit.rows.length) return { replay: true, status: hit.rows[0].status, body: hit.rows[0].response };
  const res = await compute();
  await q.query('INSERT INTO oss_idempotency (key, status, response) VALUES ($1,$2,$3) ON CONFLICT (key) DO NOTHING', [k, res.status || 200, JSON.stringify(res.body)]);
  return res;
}

export { SETTINGS, VENUES, EVENTS, L };
export const memberOf = isMember;

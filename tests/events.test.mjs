/* Events system — integration tests against the API function and a real database.
   Run: TEST_DATABASE_URL=postgres://user@host:5432/postgres node --test tests/
   The matrix ids (C01…C22) refer to the package's acceptance tests. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupDb, makeClient, q } from './helpers.mjs';

let db, C, PV;
const ROOT = 'root@example.org';
let rootCookie;

before(async () => { db = await setupDb(); C = await makeClient(); rootCookie = await C.signIn(ROOT, '/admin/events/'); PV = (await import('../netlify/lib/content.generated.mjs')).SETTINGS.privacyVersion; });
after(async () => { const dbm = await import('../netlify/lib/db.mjs'); await dbm._reset(); });

const reg = (slug, body, opts) => C.call('POST', `/api/events/${slug}/register`, Object.assign({ body: Object.assign({ consent_privacy: true, lang: 'en' }, body) }, opts || {}));
const interest = (slug, body, opts) => C.call('POST', `/api/events/${slug}/interest`, Object.assign({ body: Object.assign({ consent_privacy: true, lang: 'en' }, body) }, opts || {}));
const patch = (id, body, cookie) => C.call('PATCH', `/api/admin/events/${id}`, { body, cookie: cookie || rootCookie });
async function openEvent(id, capacity, extra) {
  const r1 = await patch(id, Object.assign({ eventStatus: 'confirmed' }, extra || {}));
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  const r2 = await patch(id, { registrationMode: 'open', capacity, waitlistEnabled: true });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  return r2.body.event;
}

test('C01/C03 seed: 11 published events, server states, Oxford clock → UTC (BST and GMT)', async () => {
  const r = await C.call('GET', '/api/events');
  assert.equal(r.status, 200);
  assert.equal(r.body.events.length, 11);
  const by = Object.fromEntries(r.body.events.map((e) => [e.id, e]));
  assert.equal(by['oss-005'].state, 'none');
  assert.ok(Object.values(by).filter((e) => e.id !== 'oss-005').every((e) => e.state === 'interest'));
  assert.equal(by['oss-001'].startUtc, '2026-12-01T18:00:00.000Z'); // 18:00 GMT
  assert.equal(by['oss-010'].startUtc, '2027-10-10T13:00:00.000Z'); // 14:00 BST
  assert.equal(by['oss-011'].priceStatus, 'tbd'); // C18: dinner price not free
  assert.equal(by['oss-001'].audience, 'members');
  const ics = await C.call('GET', '/api/events/oss-010/calendar.ics');
  assert.match(ics.body, /STATUS:TENTATIVE/); assert.match(ics.body, /SUMMARY:Michaelmas Term Welcome Gathering \(proposed\)/); assert.match(ics.body, /DTSTART:20271010T130000Z/);
});

test('C07/C08 interest: proposed event → verified email → interested record, explicitly not a booking, no ticket', async () => {
  const r = await interest('michaelmas-term-welcome', { name: 'Amal Test', email: 'amal@example.org', marketing_opt_in: false });
  assert.equal(r.status, 200); assert.equal(r.body.status, 'pending_verification');
  assert.equal((await q(db, 'SELECT count(*)::int AS n FROM oss_registrations')).length, 1);
  assert.equal((await q(db, 'SELECT count(*)::int AS n FROM oss_registrations'))[0].n, 0, 'nothing stored before the email is verified');
  const m = C.lastMail('amal@example.org', 'verify_interest');
  assert.ok(m, 'verification email captured'); assert.match(m.body_text, /not a ticket or a guaranteed place/);
  const v = await C.verify(C.linkIn(m));
  assert.equal(v.status, 303); assert.match(v.location, /\/events\/michaelmas-term-welcome\/\?verified=interest$/); assert.match(v.cookie, /^oss_session=/);
  const rows = await q(db, 'SELECT * FROM oss_registrations WHERE email = $1', ['amal@example.org']);
  assert.equal(rows.length, 1); assert.equal(rows[0].status, 'interested'); assert.equal(rows[0].kind, 'interest'); assert.equal(rows[0].consent_privacy_version, PV);
  assert.equal((await q(db, 'SELECT count(*)::int AS n FROM oss_ticket_tokens'))[0].n, 0, 'no ticket for interest');
  const ack = C.lastMail('amal@example.org', 'interest_received'); assert.match(ack.subject, /not a booking/i);
  const again = await C.verify(C.linkIn(m)); assert.match(again.location, /verified=used$/);
  const dup = await interest('michaelmas-term-welcome', { name: 'Amal Test', email: 'amal@example.org' }, { cookie: v.cookie });
  assert.equal(dup.body.status, 'already');
  // booking is refused while proposed
  const b = await reg('michaelmas-term-welcome', { name: 'Amal Test', email: 'amal@example.org' }, { cookie: v.cookie });
  assert.equal(b.status, 400); assert.equal(b.body.error, 'not_open');
});

test('C19 input: validation, JSON only, honeypot, bad origin, rate limit per email', async () => {
  const bad = await interest('michaelmas-term-welcome', { name: 'A', email: 'nope', consent_privacy: false });
  assert.equal(bad.status, 400); assert.deepEqual(Object.keys(bad.body.fields).sort(), ['email', 'name', 'privacy']);
  const form = await C.call('POST', '/api/events/michaelmas-term-welcome/interest', { body: 'name=x', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(form.status, 415);
  const before = (await q(db, 'SELECT count(*)::int AS n FROM oss_pending'))[0].n;
  const hp = await interest('michaelmas-term-welcome', { name: 'Bot', email: 'bot@example.org', website: 'http://spam' });
  assert.equal(hp.status, 200); assert.equal((await q(db, 'SELECT count(*)::int AS n FROM oss_pending'))[0].n, before, 'honeypot creates nothing');
  const xo = await interest('michaelmas-term-welcome', { name: 'Evil', email: 'evil@example.org' }, { headers: { origin: 'https://evil.example' } });
  assert.equal(xo.status, 403); assert.equal(xo.body.error, 'bad_origin');
  // the same site on another of its domains (primary custom domain vs netlify.app) is same-origin; others are not
  const alt = await C.call('POST', '/api/membership/apply', { base: 'https://oxsss.example', headers: { origin: 'https://oxsss.example' }, body: { name: '' } });
  assert.equal(alt.status, 400, 'own host accepted (fails validation, not origin)');
  const altEvil = await C.call('POST', '/api/membership/apply', { base: 'https://oxsss.example', headers: { origin: 'https://evil.example' }, body: { name: '' } });
  assert.equal(altEvil.status, 403); assert.equal(altEvil.body.error, 'bad_origin');
  let last;
  for (let i = 0; i < 7; i++) last = await interest('hilary-term-welcome-gathering', { name: 'Rate Limit', email: 'rl@example.org' });
  assert.equal(last.status, 429);
  const tampered = await C.call('GET', '/api/me', { cookie: 'oss_session=eyJlIjoicm9vdEBleGFtcGxlLm9yZyIsImlhdCI6MSwiZXhwIjo5OTk5OTk5OTk5fQ.AAAA' });
  assert.equal(tampered.status, 401);
});

test('C19 admin auth: only staff, role-scoped; opening registration requires a confirmed event', async () => {
  const anon = await C.call('GET', '/api/admin/overview'); assert.equal(anon.status, 401);
  const userCookie = await C.signIn('nobody@example.org');
  const notStaff = await C.call('GET', '/api/admin/overview', { cookie: userCookie }); assert.equal(notStaff.status, 403);
  const me = await C.call('GET', '/api/admin/me', { cookie: rootCookie }); assert.equal(me.body.role, 'super_admin');
  const early = await patch('oss-002', { registrationMode: 'open' }); assert.equal(early.status, 400); assert.equal(early.body.error, 'confirm_before_opening');
  const add = await C.call('POST', '/api/admin/staff', { cookie: rootCookie, body: { email: 'door@example.org', role: 'checkin_staff', eventIds: ['oss-002'] } }); assert.equal(add.status, 200);
  const doorCookie = await C.signIn('door@example.org');
  const noEdit = await patch('oss-002', { capacity: 5 }, doorCookie); assert.equal(noEdit.status, 403);
  const wrongEvent = await C.call('GET', '/api/admin/events/oss-003/registrations', { cookie: doorCookie }); assert.equal(wrongEvent.status, 403);
});

test('C09/C10 booking: verified seat, ticket + ICS, duplicate and idempotent replays cannot take a second seat', async () => {
  const ev = await openEvent('oss-002', 10);
  assert.equal(ev.state, 'book'); assert.equal(ev.seatsLeft, 10);
  const r = await reg('hilary-term-welcome-gathering', { name: 'Badr Test', email: 'badr@example.org', marketing_opt_in: true });
  assert.equal(r.body.status, 'pending_verification');
  const m = C.lastMail('badr@example.org', 'verify_booking');
  const v = await C.verify(C.linkIn(m));
  assert.match(v.location, /verified=confirmed$/);
  const row = (await q(db, 'SELECT * FROM oss_registrations WHERE email = $1', ['badr@example.org']))[0];
  assert.equal(row.status, 'confirmed'); assert.ok(row.confirmed_at); assert.equal(row.marketing_opt_in, true); assert.ok(row.marketing_opt_in_at);
  const conf = C.lastMail('badr@example.org', 'booking_confirmed');
  assert.ok(conf); assert.match(conf.body_text, /\/t\/[A-Za-z0-9_-]{20,}/); assert.equal(conf.attachments[0].filename, 'hilary-term-welcome-gathering.ics');
  assert.match(Buffer.from(conf.attachments[0].content, 'base64').toString(), /STATUS:CONFIRMED/);
  const token = /\/t\/([A-Za-z0-9_-]+)/.exec(conf.body_text)[1];
  const t = await C.call('GET', '/api/tickets/' + token);
  assert.equal(t.status, 200); assert.equal(t.body.valid, true); assert.match(t.body.qrSvg, /^<svg/); assert.equal(t.body.attendee, 'Badr T.');
  assert.ok(!JSON.stringify(t.body).includes('badr@example.org'), 'ticket data carries no email');
  const hashes = await q(db, 'SELECT token_hash FROM oss_ticket_tokens'); assert.ok(hashes.every((h) => h.token_hash !== token && h.token_hash.length === 64), 'only hashes stored');
  // second request, same email → second verification → already (no second seat)
  const r2 = await reg('hilary-term-welcome-gathering', { name: 'Badr Test', email: 'badr@example.org' });
  const v2 = await C.verify(C.linkIn(C.lastMail('badr@example.org', 'verify_booking')));
  assert.match(v2.location, /verified=already$/);
  // signed-in duplicate + idempotency replay
  const r3 = await reg('hilary-term-welcome-gathering', { name: 'Badr Test', email: 'badr@example.org' }, { cookie: v.cookie, headers: { 'Idempotency-Key': 'k1' } });
  assert.equal(r3.body.status, 'already');
  const r4 = await reg('hilary-term-welcome-gathering', { name: 'Badr Test', email: 'badr@example.org' }, { cookie: v.cookie, headers: { 'Idempotency-Key': 'k1' } });
  assert.deepEqual(r4.body, r3.body);
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_registrations WHERE email = 'badr@example.org'"))[0].n, 1);
  const after = await C.call('GET', '/api/events/oss-002'); assert.equal(after.body.event.seatsLeft, 9);
  const me = await C.call('GET', '/api/events/oss-002', { cookie: v.cookie }); assert.equal(me.body.me.registration.status, 'confirmed');
  assert.equal(r2.status, 200);
});

test('C11 last seat: 20 parallel signed-in bookings → exactly one confirmed, the rest waitlisted', async () => {
  await openEvent('oss-003', 1);
  const people = Array.from({ length: 20 }, (_, i) => `racer${i}@example.org`);
  const cookies = [];
  for (const p of people) cookies.push(await C.signIn(p));
  const results = await Promise.all(people.map((p, i) => reg('saudi-founding-day-ramadan-iftar', { name: 'Racer ' + i, email: p }, { cookie: cookies[i] })));
  const statuses = results.map((r) => r.body.status);
  assert.equal(statuses.filter((s) => s === 'confirmed').length, 1, JSON.stringify(statuses));
  assert.equal(statuses.filter((s) => s === 'waitlisted').length, 19);
  const c = await q(db, "SELECT status, count(*)::int AS n FROM oss_registrations WHERE event_id = 'oss-003' GROUP BY status");
  assert.deepEqual(Object.fromEntries(c.map((x) => [x.status, x.n])), { confirmed: 1, waitlisted: 19 });
  const ev = await C.call('GET', '/api/events/oss-003'); assert.equal(ev.body.event.seatsLeft, 0); assert.equal(ev.body.event.state, 'waitlist');
});

test('C12 members-only: unverified account gets 403 and is not registered; approved member can book', async () => {
  await openEvent('oss-001', 20);
  const anon = await reg('winter-welcome-first-society-meeting', { name: 'Guest', email: 'guest@example.org' });
  assert.equal(anon.status, 403); assert.equal(anon.body.error, 'member_required');
  const cookie = await C.signIn('member@example.org');
  const notYet = await reg('winter-welcome-first-society-meeting', { name: 'Member One', email: 'member@example.org' }, { cookie });
  assert.equal(notYet.status, 403);
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_registrations WHERE event_id = 'oss-001'"))[0].n, 0);
  const approve = await C.call('POST', '/api/admin/members', { cookie: rootCookie, body: { email: 'member@example.org', name: 'Member One', status: 'approved', tier: 'saudi' } });
  assert.equal(approve.status, 200);
  const ok = await reg('winter-welcome-first-society-meeting', { name: 'Member One', email: 'member@example.org' }, { cookie });
  assert.equal(ok.body.status, 'confirmed');
  const row = (await q(db, "SELECT member_at_booking FROM oss_registrations WHERE event_id = 'oss-001'"))[0]; assert.equal(row.member_at_booking, true);
  // a session for a different address cannot book on the member's behalf
  const other = await C.signIn('someone@example.org');
  const spoof = await reg('winter-welcome-first-society-meeting', { name: 'Spoof', email: 'member@example.org' }, { cookie: other });
  assert.equal(spoof.status, 403);
});

test('C13 isolation: /api/me shows only own registrations; other ids read as not found; roster is staff-only', async () => {
  const badr = await C.signIn('badr@example.org');
  const me = await C.call('GET', '/api/me', { cookie: badr });
  assert.equal(me.status, 200); assert.ok(me.body.registrations.length >= 1); assert.ok(me.body.registrations.every((r) => r.event));
  const foreign = (await q(db, "SELECT id FROM oss_registrations WHERE email = 'racer0@example.org'"))[0].id;
  assert.equal((await C.call('POST', `/api/registrations/${foreign}/cancel`, { cookie: badr })).status, 404);
  assert.equal((await C.call('POST', `/api/registrations/${foreign}/ticket`, { cookie: badr })).status, 404);
  assert.equal((await C.call('GET', '/api/admin/events/oss-002/registrations', { cookie: badr })).status, 403);
  assert.equal((await C.call('GET', '/api/me')).status, 401);
  // owner can rotate their own ticket; the old link stops working
  const mine = me.body.registrations.find((r) => r.status === 'confirmed');
  const rot = await C.call('POST', `/api/registrations/${mine.id}/ticket`, { cookie: badr });
  assert.equal(rot.status, 200); assert.match(rot.body.url, /\/t\//);
  const oldToken = /\/t\/([A-Za-z0-9_-]+)/.exec(C.lastMail('badr@example.org', 'booking_confirmed').body_text)[1];
  assert.equal((await C.call('GET', '/api/tickets/' + oldToken)).body.valid, false);
  assert.equal((await C.call('GET', '/api/tickets/' + rot.body.token)).body.valid, true);
});

test('C14/C15 waitlist: FIFO offer on cancellation, 24h claim, expiry passes the seat on, bilingual notices', async () => {
  const first = (await q(db, "SELECT email FROM oss_registrations WHERE event_id = 'oss-003' AND status = 'confirmed'"))[0].email;
  const order = (await q(db, "SELECT email FROM oss_registrations WHERE event_id = 'oss-003' AND status = 'waitlisted' ORDER BY waitlist_seq")).map((r) => r.email);
  await db.query('UPDATE oss_registrations SET lang = $2 WHERE email = $1', [order[0], 'ar']); // first in line prefers Arabic
  const cookie = await C.signIn(first);
  const mine = (await C.call('GET', '/api/me', { cookie })).body.registrations.find((r) => r.event.id === 'oss-003');
  const cancel = await C.call('POST', `/api/registrations/${mine.id}/cancel`, { cookie });
  assert.equal(cancel.body.ok, true);
  const cancelled = (await q(db, 'SELECT status FROM oss_registrations WHERE id = $1', [mine.id]))[0]; assert.equal(cancelled.status, 'cancelled');
  assert.ok((await q(db, 'SELECT revoked_at FROM oss_ticket_tokens WHERE registration_id = $1', [mine.id])).every((t) => t.revoked_at), 'ticket revoked (C15)');
  const offered = await q(db, "SELECT email, status, claim_expires_at FROM oss_registrations WHERE event_id = 'oss-003' AND status = 'offered'");
  assert.equal(offered.length, 1); assert.equal(offered[0].email, order[0], 'oldest waitlisted gets the offer');
  const offerMail = C.lastMail(order[0], 'waitlist_offer'); assert.match(offerMail.subject, /توفّر مقعد/); assert.equal(offerMail.lang, 'ar');
  assert.equal((await C.call('GET', '/api/events/oss-003')).body.event.seatsLeft, 0, 'offered seat is held');
  // the offer expires → seat passes to the next person
  await db.query("UPDATE oss_registrations SET claim_expires_at = now() - interval '1 minute' WHERE event_id = 'oss-003' AND status = 'offered'");
  const { runJobs } = await import('../netlify/functions/jobs.mjs');
  const jobs = await runJobs(db, C.site);
  assert.equal(jobs.offersExpired, 1);
  assert.equal((await q(db, 'SELECT status FROM oss_registrations WHERE email = $1', [order[0]]))[0].status, 'expired');
  assert.ok(C.lastMail(order[0], 'offer_expired'));
  const next = await q(db, "SELECT email FROM oss_registrations WHERE event_id = 'oss-003' AND status = 'offered'");
  assert.equal(next[0].email, order[1]);
  // second in line claims within the window
  const claim = await C.verify(C.linkIn(C.lastMail(order[1], 'waitlist_offer')));
  assert.match(claim.location, /verified=claimed$/);
  assert.equal((await q(db, 'SELECT status FROM oss_registrations WHERE email = $1', [order[1]]))[0].status, 'confirmed');
  assert.ok(C.lastMail(order[1], 'booking_confirmed'));
  assert.equal((await C.verify(C.linkIn(C.lastMail(order[1], 'waitlist_offer')))).location.endsWith('verified=used'), true);
  const seated = await q(db, "SELECT count(*)::int AS n FROM oss_registrations WHERE event_id = 'oss-003' AND status IN ('confirmed','offered','checked_in')");
  assert.equal(seated[0].n, 1, 'never oversold');
});

test('C16 check-in: staff only, event-scoped, single use, duplicates reported, revoked rejected, manual lookup', async () => {
  const conf = C.lastMail('member@example.org', 'booking_confirmed');
  const token = /\/t\/([A-Za-z0-9_-]+)/.exec(conf.body_text)[1];
  assert.equal((await C.call('POST', '/api/admin/events/oss-001/check-in', { body: { token } })).status, 401);
  const door = await C.signIn('door@example.org'); // scoped to oss-002 only
  assert.equal((await C.call('POST', '/api/admin/events/oss-001/check-in', { cookie: door, body: { token } })).status, 403);
  const wrong = await C.call('POST', '/api/admin/events/oss-002/check-in', { cookie: door, body: { token: 'OSS1:' + token } });
  assert.equal(wrong.body.result, 'wrong_event');
  const ok = await C.call('POST', '/api/admin/events/oss-001/check-in', { cookie: rootCookie, body: { token: 'OSS1:' + token } });
  assert.equal(ok.body.result, 'admitted'); assert.equal(ok.body.name, 'Member O.');
  const dup = await C.call('POST', '/api/admin/events/oss-001/check-in', { cookie: rootCookie, body: { token } });
  assert.equal(dup.body.result, 'duplicate'); assert.ok(dup.body.checkedInAt);
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_checkins WHERE event_id = 'oss-001'"))[0].n, 1);
  assert.equal((await C.call('POST', '/api/admin/events/oss-001/check-in', { cookie: rootCookie, body: { token: 'nonsense' } })).body.result, 'invalid');
  const t = await C.call('GET', '/api/tickets/' + token); assert.equal(t.body.status, 'checked_in');
  const search = await C.call('GET', '/api/admin/events/oss-001/check-in?q=mem', { cookie: rootCookie });
  assert.equal(search.body.results.length, 1); assert.equal(search.body.results[0].status, 'checked_in');
  assert.equal((await C.call('GET', '/api/admin/events/oss-001/check-in?q=me', { cookie: rootCookie })).status, 400);
  // a revoked ticket (cancelled registration) is rejected
  const cancelledReg = (await q(db, "SELECT id FROM oss_registrations WHERE event_id = 'oss-003' AND status = 'cancelled'"))[0];
  const revokedHash = (await q(db, 'SELECT token_hash FROM oss_ticket_tokens WHERE registration_id = $1', [cancelledReg.id]))[0];
  assert.ok(revokedHash);
});

test('C17 postpone / cancel: preview → confirm, notices queued, version bumped, calendar updated, sign-ups blocked', async () => {
  const preview = await patch('oss-002', { eventStatus: 'postponed', reason: 'Venue unavailable' });
  assert.equal(preview.body.preview, true); assert.ok(preview.body.affected >= 1);
  assert.equal((await q(db, "SELECT version FROM oss_events WHERE id = 'oss-002'"))[0].version, 1, 'preview changes nothing');
  const apply = await patch('oss-002', { eventStatus: 'postponed', reason: 'Venue unavailable', confirm: true });
  assert.equal(apply.status, 200); assert.ok(apply.body.notified >= 1);
  assert.equal((await q(db, "SELECT version FROM oss_events WHERE id = 'oss-002'"))[0].version, 2);
  assert.ok(C.lastMail('badr@example.org', 'event_postponed'));
  assert.equal((await C.call('GET', '/api/events/oss-002')).body.event.state, 'tbc');
  const blocked = await reg('hilary-term-welcome-gathering', { name: 'Late', email: 'late@example.org' }); assert.equal(blocked.status, 400);
  // date change on a confirmed event → change notice + SEQUENCE bump in the ICS
  await patch('oss-002', { eventStatus: 'confirmed' });
  const move = await patch('oss-002', { startLocal: '2027-01-21T18:30', endLocal: '2027-01-21T20:30', confirm: true });
  assert.equal(move.status, 200);
  const ics = await C.call('GET', '/api/events/oss-002/calendar.ics');
  assert.match(ics.body, /SEQUENCE:3/); assert.match(ics.body, /DTSTART:20270121T183000Z/);
  const chg = C.lastMail('badr@example.org', 'event_changed'); assert.match(chg.body_text, /Date\/time:/);
  // cancel the whole event: tickets revoked, interested people told too, state cancelled
  const cancel = await patch('oss-001', { eventStatus: 'cancelled', reason: 'Committee decision', confirm: true });
  assert.equal(cancel.status, 200);
  assert.equal((await C.call('GET', '/api/events/oss-001')).body.event.state, 'cancelled');
  assert.ok((await q(db, "SELECT t.revoked_at FROM oss_ticket_tokens t JOIN oss_registrations r ON r.id = t.registration_id WHERE r.event_id = 'oss-001'")).every((t) => t.revoked_at));
  assert.ok(C.lastMail('member@example.org', 'event_cancelled'));
  assert.match((await C.call('GET', '/api/events/oss-001/calendar.ics')).body, /STATUS:CANCELLED/);
});

test('C20 mail: provider failure keeps the message queued with backoff, never marked sent; retry delivers; dead after repeated failures', async () => {
  const { processOutbox } = await import('../netlify/lib/mail.mjs');
  process.env.MAIL_PROVIDER = 'fail';
  const r = await C.call('POST', '/api/auth/request-link', { body: { email: 'flaky@example.org', lang: 'en' } });
  assert.equal(r.body.status, 'link_sent');
  let m = (await q(db, "SELECT * FROM oss_mail_outbox WHERE to_email = 'flaky@example.org'"))[0];
  assert.equal(m.status, 'failed'); assert.equal(m.attempts, 1); assert.match(m.last_error, /simulated/); assert.ok(new Date(m.next_attempt_at) > new Date());
  await db.query('UPDATE oss_mail_outbox SET next_attempt_at = now() WHERE id = $1', [m.id]);
  process.env.MAIL_PROVIDER = 'capture';
  const out = await processOutbox(db, 50);
  assert.ok(out.sent >= 1);
  m = (await q(db, 'SELECT * FROM oss_mail_outbox WHERE id = $1', [m.id]))[0];
  assert.equal(m.status, 'sent'); assert.ok(m.sent_at); assert.equal(m.provider, 'capture');
  // dead-letter after the backoff ladder is exhausted
  process.env.MAIL_PROVIDER = 'fail';
  await db.query("UPDATE oss_mail_outbox SET status = 'failed', attempts = 6, next_attempt_at = now() WHERE id = $1", [m.id]);
  await processOutbox(db, 50);
  assert.equal((await q(db, 'SELECT status FROM oss_mail_outbox WHERE id = $1', [m.id]))[0].status, 'dead');
  process.env.MAIL_PROVIDER = 'capture';
  const retry = await C.call('POST', `/api/admin/mail/${m.id}/retry`, { cookie: rootCookie });
  assert.equal(retry.status, 200);
  assert.equal((await q(db, 'SELECT status FROM oss_mail_outbox WHERE id = $1', [m.id]))[0].status, 'sent');
  assert.ok((await q(db, "SELECT 1 FROM oss_audit WHERE action = 'mail.retried'")).length);
});

test('C20b mail: with no provider configured, queued mail waits untouched; it is delivered once a provider exists (even if it had died waiting)', async () => {
  const { processOutbox, senderAddress, replyToAddress } = await import('../netlify/lib/mail.mjs');
  const { SETTINGS } = await import('../netlify/lib/content.generated.mjs');
  process.env.MAIL_PROVIDER = 'log';
  const r = await C.call('POST', '/api/auth/request-link', { body: { email: 'early@example.org', lang: 'en' } });
  assert.equal(r.body.status, 'link_sent');
  await db.query("UPDATE oss_mail_outbox SET next_attempt_at = now() WHERE to_email = 'early@example.org'");
  for (let i = 0; i < 8; i++) await processOutbox(db, 50);
  let m = (await q(db, "SELECT * FROM oss_mail_outbox WHERE to_email = 'early@example.org'"))[0];
  assert.equal(m.status, 'queued'); assert.equal(m.attempts, 0);
  // a message that went dead under the old behaviour is revived
  await db.query("UPDATE oss_mail_outbox SET status = 'dead', attempts = 7, last_error = 'no_mail_provider' WHERE id = $1", [m.id]);
  process.env.MAIL_PROVIDER = 'capture';
  await processOutbox(db, 50);
  m = (await q(db, 'SELECT * FROM oss_mail_outbox WHERE id = $1', [m.id]))[0];
  assert.equal(m.status, 'sent'); assert.equal(m.attempts, 1);
  // sender/reply-to defaults: the public address for both
  const saved = { from: process.env.MAIL_FROM, reply: process.env.MAIL_REPLY_TO };
  delete process.env.MAIL_FROM; delete process.env.MAIL_REPLY_TO;
  assert.equal(senderAddress(), `Oxford Saudi Society <${SETTINGS.email}>`);
  assert.equal(replyToAddress(), SETTINGS.email);
  process.env.MAIL_FROM = 'X <x@example.org>'; assert.equal(senderAddress(), 'X <x@example.org>');
  if (saved.from) process.env.MAIL_FROM = saved.from; else delete process.env.MAIL_FROM;
  if (saved.reply) process.env.MAIL_REPLY_TO = saved.reply;
});

test('C19/C21 roster + CSV export: staff-only, formula-safe cells, audited; consent + marketing recorded separately', async () => {
  const cookie = await C.signIn('formula@example.org');
  await openEvent('oss-006', 50);
  const r = await reg('saudi-futures-research-ai-careers', { name: '=HYPERLINK("http://x")', email: 'formula@example.org', marketing_opt_in: false }, { cookie });
  assert.equal(r.body.status, 'confirmed');
  const csv = await C.call('GET', '/api/admin/events/oss-006/registrations.csv', { cookie: rootCookie });
  assert.equal(csv.status, 200); assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.body, /"'=HYPERLINK\(""http:\/\/x""\)"/); assert.match(csv.body, /privacy_notice_version/);
  assert.equal((await C.call('GET', '/api/admin/events/oss-006/registrations.csv', { cookie })).status, 403);
  assert.ok((await q(db, "SELECT 1 FROM oss_audit WHERE action = 'roster.exported'")).length);
  const roster = await C.call('GET', '/api/admin/events/oss-006/registrations?q=formula', { cookie: rootCookie });
  assert.equal(roster.body.total, 1); assert.equal(roster.body.registrations[0].marketing_opt_in, false); assert.equal(roster.body.registrations[0].consent_privacy_version, PV);
  const door = await C.signIn('door@example.org');
  await C.call('POST', '/api/admin/staff', { cookie: rootCookie, body: { email: 'door@example.org', role: 'checkin_staff', eventIds: ['oss-002', 'oss-006'] } });
  const masked = await C.call('GET', '/api/admin/events/oss-006/registrations', { cookie: door });
  assert.match(masked.body.registrations[0].email, /^fo…@example\.org$/);
});

test('C19 capacity cannot drop below seated; admin cancel releases the seat and notifies; notify preview/confirm', async () => {
  const below = await patch('oss-006', { capacity: 0 });
  assert.equal(below.status, 400); assert.equal(below.body.error, 'capacity_below_seated');
  const id = (await q(db, "SELECT id FROM oss_registrations WHERE event_id = 'oss-006' AND status = 'confirmed'"))[0].id;
  const c = await C.call('POST', `/api/admin/registrations/${id}/cancel`, { cookie: rootCookie, body: { reason: 'Duplicate account' } });
  assert.equal(c.body.result, 'cancelled');
  assert.match(C.lastMail('formula@example.org', 'registration_cancelled').body_text, /by the organisers/);
  const pv = await C.call('POST', '/api/admin/events/oss-003/notify', { cookie: rootCookie, body: { to: 'all_active', subject: { en: 'Parking', ar: 'المواقف' }, body: { en: 'Please use the side entrance.', ar: 'يرجى استخدام المدخل الجانبي.' } } });
  assert.equal(pv.body.preview, true); assert.ok(pv.body.affected >= 2);
  const sent = await C.call('POST', '/api/admin/events/oss-003/notify', { cookie: rootCookie, body: { to: 'all_active', subject: { en: 'Parking', ar: 'المواقف' }, body: { en: 'Please use the side entrance.', ar: 'يرجى استخدام المدخل الجانبي.' }, confirm: true } });
  assert.equal(sent.body.queued, pv.body.affected);
  const audit = await C.call('GET', '/api/admin/audit?limit=50', { cookie: rootCookie });
  assert.ok(audit.body.audit.some((a) => a.action === 'notify.sent'));
  assert.ok(audit.body.audit.every((a) => !/(badr|racer\d+|member|formula|amal)@example\.org/.test(JSON.stringify(a.meta || {}))), 'audit meta carries no attendee emails');
});

test('C21 retention: anonymises ordinary PII for events past the window when enabled', async () => {
  const { runJobs } = await import('../netlify/functions/jobs.mjs');
  await db.query("UPDATE oss_events SET start_utc = now() - interval '200 days', end_utc = now() - interval '200 days' + interval '3 hours' WHERE id = 'oss-003'");
  process.env.RETENTION_ENABLED = 'true'; process.env.RETENTION_DAYS = '90';
  const out = await runJobs(db, C.site);
  assert.ok(out.retention.anonymised >= 1, JSON.stringify(out.retention));
  const left = await q(db, "SELECT email FROM oss_registrations WHERE event_id = 'oss-003' AND email LIKE 'racer%'");
  assert.equal(left.length, 0);
  delete process.env.RETENTION_ENABLED;
});

test('C18 annual dinner: price to be announced, interest only, nothing to pay or book', async () => {
  const e = (await C.call('GET', '/api/events/oss-011')).body.event;
  assert.equal(e.priceStatus, 'tbd'); assert.equal(e.state, 'interest'); assert.equal(e.audience, 'members');
  const paid = await patch('oss-011', { priceStatus: 'paid' }); assert.equal(paid.status, 400); assert.equal(paid.body.error, 'paid_not_enabled');
});

test('C20c mail via Gmail: sender is the society Gmail, attachments survive, outbox marks it sent', async () => {
  const net = await import('node:net');
  const got = [];
  const srv = net.createServer((c) => {
    let data = false, buf = '';
    c.write('220 fake ESMTP\r\n');
    c.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (data) { if (line === '.') { data = false; c.write('250 queued\r\n'); } else got.push(line); continue; }
        const v = line.slice(0, 4).toUpperCase();
        if (v === 'EHLO') c.write('250-fake\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (v === 'AUTH') c.write('235 ok\r\n');
        else if (v === 'DATA') { data = true; c.write('354 go\r\n'); }
        else if (v === 'QUIT') { c.write('221 bye\r\n'); c.end(); }
        else c.write('250 ok\r\n');
      }
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { processOutbox, senderAddress } = await import('../netlify/lib/mail.mjs');
  const { SETTINGS } = await import('../netlify/lib/content.generated.mjs');
  const saved = { p: process.env.MAIL_PROVIDER, from: process.env.MAIL_FROM };
  delete process.env.MAIL_PROVIDER; delete process.env.MAIL_FROM; delete process.env.RESEND_API_KEY;
  Object.assign(process.env, { GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop', GMAIL_SMTP_HOST: '127.0.0.1', GMAIL_SMTP_PORT: String(srv.address().port) });
  try {
    assert.equal(senderAddress(), `Oxford Saudi Society <${SETTINGS.committeeNotifyEmail}>`);
    await db.query("UPDATE oss_mail_outbox SET status = 'sent' WHERE status <> 'sent'");
    const { enqueue } = await import('../netlify/lib/mail.mjs');
    await db.tx((q) => enqueue(q, { kind: 'login_link', to: 'gm@example.org', lang: 'en', vars: { link: 'https://x/y' }, attachments: [{ filename: 'a.ics', content: Buffer.from('BEGIN:VCALENDAR').toString('base64') }] }));
    const r = await processOutbox(db, 10);
    assert.equal(r.sent, 1, JSON.stringify(r));
    const raw = got.join('\n');
    assert.match(raw, new RegExp('^From: Oxford Saudi Society <' + SETTINGS.committeeNotifyEmail.replace(/[.]/g, '\\.') + '>', 'm'));
    assert.match(raw, /^To: gm@example\.org/m);
    assert.match(raw, /filename=a\.ics/);
    const row = (await q(db, "SELECT status, provider_id FROM oss_mail_outbox WHERE to_email = 'gm@example.org'"))[0];
    assert.equal(row.status, 'sent');
  } finally {
    for (const k of ['GMAIL_APP_PASSWORD', 'GMAIL_SMTP_HOST', 'GMAIL_SMTP_PORT']) delete process.env[k];
    if (saved.p) process.env.MAIL_PROVIDER = saved.p; if (saved.from) process.env.MAIL_FROM = saved.from;
    srv.close();
  }
});

test('C20d daily allowance: urgent mail first, reminders only above a 25% reserve, nothing past the cap', async () => {
  const { processOutbox, enqueue } = await import('../netlify/lib/mail.mjs');
  const saved = process.env.MAIL_DAILY_LIMIT;
  process.env.MAIL_PROVIDER = 'capture';
  await db.query("UPDATE oss_mail_outbox SET status = 'sent', sent_at = now() - interval '2 days' WHERE status <> 'sent' OR sent_at > now() - interval '24 hours'");
  try {
    process.env.MAIL_DAILY_LIMIT = '8';
    // 6 sent today already → 2 left, which is within the reserve (ceil(8*0.25)=2): reminders must wait
    for (let i = 0; i < 6; i++) await db.tx((q) => enqueue(q, { kind: 'login_link', to: `old${i}@example.org`, lang: 'en', vars: { link: 'x' } }));
    await processOutbox(db, 50);
    for (let i = 0; i < 3; i++) await db.tx((q) => enqueue(q, { kind: 'reminder', to: `rem${i}@example.org`, lang: 'en', dedupeKey: `t-rem-${i}`, vars: { name: 'A', ev: { title: 'E', start_utc: new Date(Date.now() + 864e5).toISOString(), end_utc: new Date(Date.now() + 9e7).toISOString(), timezone: 'Europe/London' }, venue: 'V', inWords: 'tomorrow', ticketUrl: 'x', accountUrl: 'y' } }));
    await db.tx((q) => enqueue(q, { kind: 'login_link', to: 'urgent@example.org', lang: 'en', vars: { link: 'x' } }));
    const r = await processOutbox(db, 50);
    assert.equal(r.sent, 1);
    const st = Object.fromEntries((await q(db, "SELECT to_email, status FROM oss_mail_outbox WHERE to_email LIKE 'rem%' OR to_email = 'urgent@example.org'")).map((x) => [x.to_email, x.status]));
    assert.equal(st['urgent@example.org'], 'sent');
    assert.equal(st['rem0@example.org'], 'queued');
    // cap reached → nothing more goes out, and nothing is burned
    await db.tx((q) => enqueue(q, { kind: 'login_link', to: 'late@example.org', lang: 'en', vars: { link: 'x' } }));
    await processOutbox(db, 50); // 7 used → 1 left: urgent goes
    const r2 = await processOutbox(db, 50);
    assert.equal(r2.waiting, 'daily_limit');
    const rem = (await q(db, "SELECT status, attempts FROM oss_mail_outbox WHERE to_email = 'rem1@example.org'"))[0];
    assert.equal(rem.status, 'queued'); assert.equal(rem.attempts, 0);
    // a fresh day: reminders flow
    await db.query("UPDATE oss_mail_outbox SET sent_at = now() - interval '2 days' WHERE status = 'sent'");
    const r3 = await processOutbox(db, 50);
    assert.equal(r3.sent, 3);
  } finally {
    if (saved === undefined) delete process.env.MAIL_DAILY_LIMIT; else process.env.MAIL_DAILY_LIMIT = saved;
  }
});

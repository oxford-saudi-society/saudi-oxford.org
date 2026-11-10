/* Privacy notice 2026-11-09 in practice: proof of nationality is uploaded (never emailed), seen only by the
   committee, deleted when the result is recorded; and the published retention periods are enforced by the job. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
const { setupDb, makeClient, q } = await import('./helpers.mjs');

let db, C, root, runJobs;
const ADMIN = 'president@oxsss.org';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 32)]);
const apply = (over) => C.call('POST', '/api/membership/apply', { body: Object.assign({ tier: 'saudi', confirm_saudi: true, sso: 'hert1234', name: 'Sara Example', email: 'sara@example.org', uniChoice: 'oxford', college: 'Hertford College', status: 'doctoral', consent_privacy: true, lang: 'en' }, over || {}) });
const upload = (cookie, buf, mime) => C.call('POST', '/api/membership/evidence', { cookie, body: { mime: mime || 'image/jpeg', data: buf.toString('base64') } });

before(async () => { process.env.NATIONALITY_UPLOAD = 'true'; /* the upload is off on the site for now; these tests keep the dormant feature honest */ db = await setupDb(); C = await makeClient(); root = await C.signIn(ADMIN, '/admin/events/'); ({ runJobs } = await import('../netlify/functions/jobs.mjs')); });
after(async () => { const dbm = await import('../netlify/lib/db.mjs'); await dbm._reset(); });

test('proof of nationality: applicant uploads, only the committee can open it, and recording the result deletes it', async () => {
  const a = await apply(); assert.equal(a.status, 200); const no = a.body.member.memberNo;
  assert.match(C.lastMail('sara@example.org', 'membership_received').body_text, /upload one proof of Saudi nationality/);
  assert.doesNotMatch(C.lastMail('sara@example.org', 'membership_received').body_text, /email you for a photo|send (us )?a photo/i);
  assert.equal((await upload(null, JPEG)).status, 401, 'must be signed in');
  const sara = await C.signIn('sara@example.org');
  assert.equal((await upload(sara, Buffer.from('<script>alert(1)</script>'.repeat(40)), 'image/jpeg')).status, 400, 'the bytes must match the declared type');
  assert.equal((await upload(sara, JPEG, 'text/html')).status, 400);
  assert.equal((await upload(sara, Buffer.concat([JPEG, Buffer.alloc(3 * 1024 * 1024)]))).status, 413, 'over 3 MB is refused');
  const up = await upload(sara, JPEG); assert.equal(up.status, 200, JSON.stringify(up.body));
  assert.equal(up.body.member.nationalityStatus, 'submitted'); assert.ok(up.body.member.evidence.uploadedAt);
  assert.deepEqual(Object.keys(up.body.member.evidence), ['uploadedAt'], 'the applicant never sees who opened it');
  assert.match(C.lastMail('membership@oxsss.org', 'membership_committee').subject, /Proof of nationality uploaded/);
  assert.doesNotMatch(JSON.stringify(C.lastMail('membership@oxsss.org', 'membership_committee')), /\/9j\/|base64/, 'the document is never put in an email');
  // nobody but staff can fetch it
  assert.equal((await C.call('GET', `/api/admin/membership/${no}/evidence`)).status, 401);
  assert.equal((await C.call('GET', `/api/admin/membership/${no}/evidence`, { cookie: sara })).status, 403);
  const other = await C.signIn('nosy@example.org');
  assert.equal((await C.call('GET', `/api/admin/membership/${no}/evidence`, { cookie: other })).status, 403);
  // the committee opens it: exact bytes, never cached, and the opening is logged
  const doc = await C.call('GET', `/api/admin/membership/${no}/evidence`, { cookie: root, binary: true });
  assert.equal(doc.status, 200); assert.equal(doc.headers.get('content-type'), 'image/jpeg'); assert.match(doc.headers.get('cache-control'), /no-store/);
  assert.ok(doc.buffer.equals(JPEG));
  const d1 = await C.call('GET', `/api/admin/membership/${no}`, { cookie: root });
  assert.equal(d1.body.member.evidence.viewedBy, ADMIN); assert.ok(d1.body.history.some((h) => h.action === 'membership.evidence_viewed'));
  assert.equal(d1.body.member.data, undefined);
  // recording the result deletes the document in the same step; only the result is kept
  const ok = await C.call('POST', `/api/admin/membership/${no}/update`, { cookie: root, body: { nationalityStatus: 'verified' } });
  assert.equal(ok.status, 200); assert.equal(ok.body.member.nationality_status, 'verified'); assert.equal(ok.body.member.evidence, null);
  assert.equal((await q(db, 'SELECT count(*)::int AS n FROM oss_member_evidence'))[0].n, 0);
  assert.equal((await C.call('GET', `/api/admin/membership/${no}/evidence`, { cookie: root })).status, 404);
  assert.equal((await upload(sara, JPEG)).status, 400, 'nothing more to upload once verified');
});

test('proof not accepted → deleted, applicant emailed to upload again; applicant can remove their own; a decision deletes it', async () => {
  await apply({ email: 'omar@example.org', name: 'Omar Example' });
  const omar = await C.signIn('omar@example.org'); const no = (await C.call('GET', '/api/membership/me', { cookie: omar })).body.member.memberNo;
  assert.equal((await upload(omar, PDF, 'application/pdf')).status, 200);
  const rej = await C.call('POST', `/api/admin/membership/${no}/update`, { cookie: root, body: { nationalityStatus: 'rejected' } });
  assert.equal(rej.body.member.nationality_status, 'rejected');
  assert.equal((await q(db, 'SELECT count(*)::int AS n FROM oss_member_evidence'))[0].n, 0);
  assert.match(C.lastMail('omar@example.org', 'membership_proof_again').body_text, /has been deleted/);
  // upload again, then change their mind
  assert.equal((await upload(omar, JPEG)).body.member.nationalityStatus, 'submitted');
  const rm = await C.call('DELETE', '/api/membership/evidence', { cookie: omar });
  assert.equal(rm.status, 200); assert.equal(rm.body.member.nationalityStatus, 'pending'); assert.equal(rm.body.member.evidence, null);
  // upload once more; approving the application ends the need for the document
  await upload(omar, JPEG);
  assert.equal((await C.call('POST', `/api/admin/membership/${no}/approve`, { cookie: root, body: {} })).body.error, 'eligibility_required', 'free membership is not activated until the committee confirms eligibility');
  const ap = await C.call('POST', `/api/admin/membership/${no}/approve`, { cookie: root, body: { eligibilityConfirmed: true } });
  assert.equal(ap.body.member.status, 'approved'); assert.equal(ap.body.member.nationality_status, 'verified');
  assert.equal((await q(db, 'SELECT count(*)::int AS n FROM oss_member_evidence'))[0].n, 0);
});

test('an unchecked document is not kept beyond 30 days', async () => {
  await apply({ email: 'lina@example.org', name: 'Lina Example' });
  const lina = await C.signIn('lina@example.org');
  await upload(lina, JPEG);
  await db.query("UPDATE oss_member_evidence SET uploaded_at = now() - interval '29 days' WHERE email = 'lina@example.org'");
  assert.equal((await runJobs(db, C.site)).retention.evidenceExpired, 0);
  await db.query("UPDATE oss_member_evidence SET uploaded_at = now() - interval '31 days' WHERE email = 'lina@example.org'");
  assert.equal((await runJobs(db, C.site)).retention.evidenceExpired, 1);
  assert.equal((await q(db, "SELECT nationality_status FROM oss_members WHERE email = 'lina@example.org'"))[0].nationality_status, 'pending');
  assert.equal((await q(db, 'SELECT count(*)::int AS n FROM oss_member_evidence'))[0].n, 0);
});

test('membership records: kept during membership, deleted 12 months after it ends', async () => {
  const mk = async (email, sql) => { await apply({ email, name: 'Member ' + email.split('@')[0], tier: 'associate', status: 'supporter' }); await db.query(`UPDATE oss_members SET ${sql} WHERE email = $1`, [email]); };
  await mk('active@example.org', "status = 'approved', valid_until = NULL, approved_at = now() - interval '5 years', applied_at = now() - interval '5 years'");
  await mk('current@example.org', "status = 'approved', valid_until = CURRENT_DATE + 30");
  await mk('lapsed-recent@example.org', "status = 'approved', valid_until = CURRENT_DATE - 200");
  await mk('lapsed-old@example.org', "status = 'approved', valid_until = CURRENT_DATE - 400");
  await mk('declined-old@example.org', "status = 'declined', decided_at = now() - interval '13 months'");
  await mk('declined-new@example.org', "status = 'declined', decided_at = now() - interval '11 months'");
  await mk('stale-application@example.org', "status = 'pending', applied_at = now() - interval '13 months', created_at = now() - interval '13 months'");
  await mk('held@example.org', "status = 'revoked', decided_at = now() - interval '3 years', legal_hold = true");
  const out = (await runJobs(db, C.site)).retention;
  assert.equal(out.membershipsExpired, 2, JSON.stringify(out));
  assert.equal(out.membersDeleted, 3, JSON.stringify(out));
  const left = (await q(db, "SELECT email, status FROM oss_members WHERE email LIKE '%@example.org' ORDER BY email")).map((r) => r.email + ':' + r.status);
  for (const keep of ['active@example.org:approved', 'current@example.org:approved', 'lapsed-recent@example.org:expired', 'declined-new@example.org:declined', 'held@example.org:revoked']) assert.ok(left.includes(keep), keep + ' should remain — ' + left.join(', '));
  for (const gone of ['lapsed-old@example.org', 'declined-old@example.org', 'stale-application@example.org']) assert.ok(!left.some((x) => x.startsWith(gone)), gone + ' should be deleted');
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_audit WHERE actor IN ('lapsed-old@example.org','declined-old@example.org','stale-application@example.org')"))[0].n, 0, 'their audit trail goes with them');
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_audit WHERE action = 'retention.member_deleted'"))[0].n, 3);
});

test('dietary / access notes: stored with a booking, shown to organisers, cleared 7 days after the event', async () => {
  await db.query("UPDATE oss_events SET event_status = 'confirmed', registration_mode = 'open', capacity = 50 WHERE id = 'oss-005'");
  const guest = await C.signIn('guest@example.org');
  const b = await C.call('POST', '/api/events/oss-005/register', { cookie: guest, body: { name: 'Guest Example', email: 'guest@example.org', consent_privacy: true, requirements: '  Vegetarian;\n step-free access  ' } });
  assert.equal(b.status, 200, JSON.stringify(b.body)); assert.equal(b.body.status, 'confirmed');
  assert.equal((await q(db, "SELECT requirements FROM oss_registrations WHERE email = 'guest@example.org'"))[0].requirements, 'Vegetarian; step-free access');
  const roster = await C.call('GET', '/api/admin/events/oss-005/registrations', { cookie: root });
  assert.equal(roster.body.registrations.find((r) => r.email === 'guest@example.org').requirements, 'Vegetarian; step-free access');
  // via the emailed confirmation link as well
  const r2 = await C.call('POST', '/api/events/oss-005/register', { body: { name: 'Second Guest', email: 'second@example.org', consent_privacy: true, requirements: 'Nut allergy' } });
  assert.equal(r2.body.status, 'pending_verification');
  await C.verify(C.linkIn(C.lastMail('second@example.org', 'verify_booking')));
  assert.equal((await q(db, "SELECT requirements FROM oss_registrations WHERE email = 'second@example.org'"))[0].requirements, 'Nut allergy');
  await db.query("UPDATE oss_events SET start_utc = now() - interval '6 days' - interval '3 hours', end_utc = now() - interval '6 days' WHERE id = 'oss-005'");
  assert.equal((await runJobs(db, C.site)).retention.requirementsCleared, 0);
  await db.query("UPDATE oss_events SET start_utc = now() - interval '8 days' - interval '3 hours', end_utc = now() - interval '8 days' WHERE id = 'oss-005'");
  const out = (await runJobs(db, C.site)).retention;
  assert.equal(out.requirementsCleared, 2, JSON.stringify(out));
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_registrations WHERE requirements IS NOT NULL"))[0].n, 0);
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_pending WHERE payload ? 'requirements'"))[0].n, 0);
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_registrations WHERE event_id = 'oss-005'"))[0].n, 2, 'the registrations themselves stay until day 30');
});

test('news subscribers export: members who ticked the box and carried-over event opt-ins; staff only', async () => {
  await apply({ email: 'news@example.org', name: 'News Reader', tier: 'associate', status: 'supporter', consent_news: true });
  await db.query("INSERT INTO oss_subscribers (email, name, lang, source) VALUES ('kept@example.org', 'Kept Person', 'ar', 'event')");
  assert.equal((await C.call('GET', '/api/admin/subscribers.csv')).status, 401);
  const r = await C.call('GET', '/api/admin/subscribers.csv', { cookie: root });
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/csv/);
  assert.match(r.body, /news@example\.org,News Reader,en,[^,]+,membership/); assert.match(r.body, /kept@example\.org,Kept Person,ar,[^,]+,event/);
  assert.doesNotMatch(r.body, /sara@example\.org/, 'no one who did not ask for news');
});

test('with the upload switched off (as on the site now): nothing can be uploaded and any leftover document is removed', async () => {
  await apply({ email: 'later@example.org', name: 'Later Person' });
  const later = await C.signIn('later@example.org');
  assert.equal((await upload(later, JPEG)).status, 200); // uploaded while it was on
  delete process.env.NATIONALITY_UPLOAD;
  try {
    assert.equal((await upload(later, JPEG)).status, 404, 'the upload route is closed');
    const mine = await C.call('GET', '/api/membership/me', { cookie: later });
    assert.equal(mine.body.member.canUploadProof, false);
    const out = (await runJobs(db, C.site)).retention;
    assert.ok(out.evidenceExpired >= 1, JSON.stringify(out));
    assert.equal((await q(db, 'SELECT count(*)::int AS n FROM oss_member_evidence'))[0].n, 0, 'no document is kept once the upload is off');
    assert.equal((await q(db, "SELECT nationality_status FROM oss_members WHERE email = 'later@example.org'"))[0].nationality_status, 'pending');
    await apply({ email: 'fresh@example.org', name: 'Fresh Person' });
    assert.match(C.lastMail('fresh@example.org', 'membership_received').body_text, /secretary will email you later to ask for proof of Saudi nationality/);
    assert.doesNotMatch(C.lastMail('fresh@example.org', 'membership_received').body_text, /upload/i);
  } finally { process.env.NATIONALITY_UPLOAD = 'true'; }
});

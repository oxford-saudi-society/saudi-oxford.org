/* Membership applications: numbers, queue positions, committee decisions, applicant replies.
   Runs without AUTH_SECRET to prove the database-generated signing key works. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.OSS_TEST_NO_SECRET = '1';
const { setupDb, makeClient, q } = await import('./helpers.mjs');

let db, C, root;
const ADMIN = 'saudioxfordsoc@gmail.com'; // from settings.adminEmails
const NO = /^OSS-\d{4}-\d{4,}$/;
const apply = (over) => C.call('POST', '/api/membership/apply', { body: Object.assign({ tier: 'saudi', name: 'Applicant One', nameAr: 'مقدم الطلب', email: 'one@example.org', college: 'Hertford College', status: 'dphil', phone: '+44 7700 900000', volunteer: ['events', 'nope'], heard: 'friend', consent_privacy: true, consent_news: true, lang: 'en' }, over || {}) });

before(async () => { db = await setupDb(); C = await makeClient(); root = await C.signIn(ADMIN, '/admin/events/'); });
after(async () => { const dbm = await import('../netlify/lib/db.mjs'); await dbm._reset(); });

test('signing key is generated and stored when AUTH_SECRET is absent', async () => {
  assert.equal(process.env.AUTH_SECRET, undefined);
  const k = await q(db, "SELECT value FROM oss_settings WHERE key = 'auth_secret'");
  assert.equal(k.length, 1); assert.ok(String(k[0].value).length >= 48);
  assert.equal((await C.call('GET', '/api/admin/me', { cookie: root })).body.role, 'super_admin', 'settings.adminEmails bootstraps the first super admin');
});

test('validation, honeypot and consent', async () => {
  const bad = await C.call('POST', '/api/membership/apply', { body: { tier: 'gold', name: 'x', email: 'bad', college: '', status: 'pirate', consent_privacy: false } });
  assert.equal(bad.status, 400); assert.deepEqual(Object.keys(bad.body.fields).sort(), ['college', 'consent', 'email', 'name', 'status', 'tier']);
  const hp = await apply({ website: 'spam', email: 'bot@example.org' });
  assert.equal(hp.status, 200); assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_members WHERE email = 'bot@example.org'"))[0].n, 0);
});

test('apply: permanent number, queue position, confirmation email, committee notice, duplicates', async () => {
  const r1 = await apply();
  assert.equal(r1.status, 200); assert.equal(r1.body.result, 'received');
  const m1 = r1.body.member;
  assert.match(m1.memberNo, NO); assert.equal(m1.status, 'pending'); assert.equal(m1.position, 1); assert.equal(m1.nationalityStatus, 'pending'); assert.equal(m1.amountGbp, 0);
  const year = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric' }).format(new Date());
  assert.ok(m1.memberNo.startsWith('OSS-' + year + '-'));
  const r2 = await apply({ email: 'two@example.org', name: 'Applicant Two', tier: 'student', status: 'masters', lang: 'ar' });
  const r3 = await apply({ email: 'three@example.org', name: 'Applicant Three', tier: 'friend', status: 'alumni' });
  assert.equal(r2.body.member.position, 2); assert.equal(r3.body.member.position, 3);
  assert.equal(r2.body.member.amountGbp, 10); assert.equal(r2.body.member.paymentStatus, 'due');
  assert.notEqual(r1.body.member.memberNo, r2.body.member.memberNo);
  const mail = C.lastMail('one@example.org', 'membership_received');
  assert.ok(mail.body_text.includes(m1.memberNo)); assert.match(mail.body_text, /Place in the review queue: 1/); assert.match(mail.body_text, /do not send any identity document/);
  const arMail = C.lastMail('two@example.org', 'membership_received');
  assert.match(arMail.subject, /تم استلام طلب العضوية/); assert.match(arMail.body_text, /£10/); assert.ok(arMail.body_text.includes(r2.body.member.memberNo));
  assert.ok(C.lastMail(ADMIN, 'membership_committee'), 'committee is told about new applications');
  const row = (await q(db, "SELECT volunteer, consent_news, consent_privacy_version, heard FROM oss_members WHERE email = 'one@example.org'"))[0];
  assert.deepEqual(row.volunteer, ['events']); assert.equal(row.consent_news, true); assert.ok(row.consent_privacy_version);
  const dup = await apply({ name: 'Someone Else' });
  assert.equal(dup.body.result, 'already'); assert.equal(dup.body.member.memberNo, m1.memberNo);
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_members WHERE email = 'one@example.org'"))[0].n, 1);
});

test('desk: queue in order with positions; staff only', async () => {
  const anon = await C.call('GET', '/api/admin/membership'); assert.equal(anon.status, 401);
  const nobody = await C.signIn('nobody@example.org');
  assert.equal((await C.call('GET', '/api/admin/membership', { cookie: nobody })).status, 403);
  const qd = await C.call('GET', '/api/admin/membership?view=queue', { cookie: root });
  assert.deepEqual(qd.body.members.map((x) => [x.email, x.position]), [['one@example.org', 1], ['two@example.org', 2], ['three@example.org', 3]]);
  assert.equal(qd.body.totals.pending, 3);
  const no = qd.body.members[0].member_no;
  const d = await C.call('GET', '/api/admin/membership/' + no, { cookie: root });
  assert.equal(d.body.member.name_ar, 'مقدم الطلب'); assert.ok(d.body.history.some((h) => h.action === 'membership.applied'));
});

test('request info → applicant answers from their account → back in the queue at the same place', async () => {
  const no = (await q(db, "SELECT member_no FROM oss_members WHERE email = 'one@example.org'"))[0].member_no;
  const ask = await C.call('POST', `/api/admin/membership/${no}/request-info`, { cookie: root, body: { message: 'Please send a photo of your Saudi passport to membership@ousss.org.' } });
  assert.equal(ask.status, 200); assert.equal(ask.body.member.status, 'info_requested');
  assert.match(C.lastMail('one@example.org', 'membership_info_request').body_text, /photo of your Saudi passport/);
  // the confirmation email's link signs the applicant in and verifies their address
  const v = await C.verify(C.linkIn(C.lastMail('one@example.org', 'membership_received')));
  assert.equal(v.status, 303); assert.match(v.location, /\/account\/\?verified=signed_in$/);
  const me = await C.call('GET', '/api/membership/me', { cookie: v.cookie });
  assert.equal(me.body.member.status, 'info_requested'); assert.match(me.body.member.infoRequest, /passport/); assert.equal(me.body.member.emailVerified, true); assert.equal(me.body.member.position, 1);
  const other = await C.signIn('two@example.org');
  assert.equal((await C.call('POST', '/api/membership/respond', { cookie: other, body: { response: 'not mine' } })).status, 400, 'no open question for someone else');
  const ans = await C.call('POST', '/api/membership/respond', { cookie: v.cookie, body: { response: 'Sent it just now, thank you.' } });
  assert.equal(ans.body.member.status, 'pending'); assert.equal(ans.body.member.position, 1);
  assert.match(C.lastMail(ADMIN, 'membership_committee').body_text, /Sent it just now/);
  const acct = await C.call('GET', '/api/me', { cookie: v.cookie });
  assert.equal(acct.body.membership.memberNo, no);
});

test('approve → active member (members-only gate opens), queue moves up, flags and history', async () => {
  const no = (await q(db, "SELECT member_no FROM oss_members WHERE email = 'one@example.org'"))[0].member_no;
  const up = await C.call('POST', `/api/admin/membership/${no}/update`, { cookie: root, body: { nationalityStatus: 'verified', notes: 'Checked passport, image deleted.' } });
  assert.equal(up.body.member.nationality_status, 'verified');
  const ok = await C.call('POST', `/api/admin/membership/${no}/approve`, { cookie: root, body: { validUntil: '2027-09-30' } });
  assert.equal(ok.body.member.status, 'approved'); assert.ok(ok.body.member.decided_by === ADMIN);
  const mail = C.lastMail('one@example.org', 'membership_approved');
  assert.match(mail.body_text, /Valid until: 30 September 2027/); assert.ok(mail.body_text.includes(no));
  const cookie = await C.signIn('one@example.org');
  assert.equal((await C.call('GET', '/api/me', { cookie })).body.member, true, 'approved members pass the members-only check');
  const qd = await C.call('GET', '/api/admin/membership?view=queue', { cookie: root });
  assert.deepEqual(qd.body.members.map((x) => [x.email, x.position]), [['two@example.org', 1], ['three@example.org', 2]]);
  const again = await C.call('POST', '/api/membership/apply', { body: { tier: 'saudi', name: 'Applicant One', email: 'one@example.org', college: 'Hertford', status: 'dphil', consent_privacy: true } });
  assert.equal(again.body.result, 'already_member');
  const hist = (await C.call('GET', '/api/admin/membership/' + no, { cookie: root })).body.history.map((h) => h.action);
  assert.deepEqual(hist.filter((a) => a.startsWith('membership.')), ['membership.applied', 'membership.info_requested', 'membership.responded', 'membership.updated', 'membership.approved']);
});

test('decline with reason → re-application keeps the number and joins the back of the queue; revoke and reinstate', async () => {
  const two = (await q(db, "SELECT member_no FROM oss_members WHERE email = 'two@example.org'"))[0].member_no;
  const dec = await C.call('POST', `/api/admin/membership/${two}/decline`, { cookie: root, body: { reason: 'Not a member of the University.' } });
  assert.equal(dec.body.member.status, 'declined');
  assert.match(C.lastMail('two@example.org', 'membership_declined').body_text, /ليس|Not a member of the University/);
  assert.equal((await C.call('POST', `/api/admin/membership/${two}/revoke`, { cookie: root, body: {} })).status, 400, 'only approved members can be revoked');
  const re = await apply({ email: 'two@example.org', name: 'Applicant Two', tier: 'student', status: 'masters' });
  assert.equal(re.body.result, 'received'); assert.equal(re.body.member.memberNo, two); assert.equal(re.body.member.position, 2);
  const one = (await q(db, "SELECT member_no FROM oss_members WHERE email = 'one@example.org'"))[0].member_no;
  const rev = await C.call('POST', `/api/admin/membership/${one}/revoke`, { cookie: root, body: { reason: 'Left Oxford.' } });
  assert.equal(rev.body.member.status, 'revoked'); assert.ok(C.lastMail('one@example.org', 'membership_revoked'));
  const cookie = await C.signIn('one@example.org');
  assert.equal((await C.call('GET', '/api/me', { cookie })).body.member, false, 'revoked members lose members-only access');
  const back = await C.call('POST', `/api/admin/membership/${one}/approve`, { cookie: root, body: { notify: false } });
  assert.equal(back.body.member.status, 'approved');
});

test('manual additions get numbers; members list searchable by number', async () => {
  const add = await C.call('POST', '/api/admin/members', { cookie: root, body: { rows: [{ email: 'carry@example.org', name: 'Carried Over', status: 'approved' }, { email: 'bad' }] } });
  assert.equal(add.body.count, 1);
  const row = (await q(db, "SELECT member_no, status FROM oss_members WHERE email = 'carry@example.org'"))[0];
  assert.match(row.member_no, NO); assert.equal(row.status, 'approved');
  const found = await C.call('GET', '/api/admin/membership?view=all&q=' + encodeURIComponent(row.member_no.toLowerCase()), { cookie: root });
  assert.equal(found.body.members.length, 1); assert.equal(found.body.members[0].email, 'carry@example.org');
  const nums = (await q(db, 'SELECT member_no FROM oss_members')).map((r) => r.member_no);
  assert.equal(new Set(nums).size, nums.length, 'numbers are unique');
});

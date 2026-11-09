/* Membership applications: numbers, queue positions, committee decisions, applicant replies.
   Runs without AUTH_SECRET to prove the database-generated signing key works. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.OSS_TEST_NO_SECRET = '1';
const { setupDb, makeClient, q } = await import('./helpers.mjs');

let db, C, root;
const ADMIN = 'president@oxsss.org'; // from settings.adminEmails
const COMMITTEE = 'membership@oxsss.org'; // settings.committeeNotifyEmail
const NO = /^OSS-\d{4}-\d{4,}$/;
const apply = (over) => C.call('POST', '/api/membership/apply', { body: Object.assign({ tier: 'saudi', sso: 'hert1234', name: 'Applicant One', nameAr: 'مقدم الطلب', email: 'one@example.org', college: 'Hertford College', status: 'dphil', phone: '+44 7700 900000', volunteer: ['events', 'nope'], heard: 'friend', consent_privacy: true, consent_news: true, lang: 'en' }, over || {}) });

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
  assert.ok(mail.body_text.includes(m1.memberNo)); assert.match(mail.body_text, /Place in the review queue: 1/); assert.match(mail.body_text, /secretary will email you later to ask for proof of Saudi nationality/); assert.doesNotMatch(mail.body_text, /upload/i);
  const arMail = C.lastMail('two@example.org', 'membership_received');
  assert.match(arMail.subject, /تم استلام طلب العضوية/); assert.match(arMail.body_text, /£10/); assert.ok(arMail.body_text.includes(r2.body.member.memberNo));
  assert.ok(C.lastMail(COMMITTEE, 'membership_committee'), 'committee is told about new applications');
  const row = (await q(db, "SELECT volunteer, consent_news, consent_privacy_version, heard FROM oss_members WHERE email = 'one@example.org'"))[0];
  assert.deepEqual(row.volunteer, ['events']); assert.equal(row.consent_news, true); assert.ok(row.consent_privacy_version);
  const dup = await apply();
  assert.equal(dup.body.result, 'already', 'the same answers again change nothing'); assert.equal(dup.body.member.memberNo, m1.memberNo);
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
  const ask = await C.call('POST', `/api/admin/membership/${no}/request-info`, { cookie: root, body: { message: 'Please send a photo of your Saudi passport to membership@oxsss.org.' } });
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
  assert.match(C.lastMail(COMMITTEE, 'membership_committee').body_text, /Sent it just now/);
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
  const again = await C.call('POST', '/api/membership/apply', { body: { tier: 'saudi', sso: 'hert1234', name: 'Applicant One', email: 'one@example.org', college: 'Hertford', status: 'dphil', consent_privacy: true } });
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

test('status "Other" needs the typed answer, which is stored and shown to the committee', async () => {
  const missing = await apply({ email: 'other1@example.org', status: 'other' });
  assert.equal(missing.status, 400); assert.equal(missing.body.fields.statusOther, 'required');
  const ok = await apply({ email: 'other1@example.org', status: 'other', statusOther: '  Oxford Brookes   student ' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const row = (await q(db, "SELECT uni_status, uni_status_other, heard FROM oss_members WHERE email = 'other1@example.org'"))[0];
  assert.equal(row.uni_status, 'other'); assert.equal(row.uni_status_other, 'Oxford Brookes student');
  assert.match(C.lastMail(COMMITTEE, 'membership_committee').body_text, /Other: Oxford Brookes student/);
  // a normal status ignores any stray "other" text
  const plain = await apply({ email: 'other2@example.org', status: 'dphil', statusOther: 'ignored', heard: undefined });
  assert.equal(plain.status, 200);
  const r2 = (await q(db, "SELECT uni_status_other, heard FROM oss_members WHERE email = 'other2@example.org'"))[0];
  assert.equal(r2.uni_status_other, null); assert.equal(r2.heard, null);
});

test('sending the form again with a different membership type updates the open application (same number and place)', async () => {
  const first = await apply({ email: 'switch@example.org', name: 'Switch Person', tier: 'saudi' });
  assert.equal(first.body.member.nationalityStatus, 'pending'); assert.equal(first.body.member.canUploadProof, false, 'the upload is switched off');
  const pos = first.body.member.position;
  // chose "Saudi students" by mistake → sends the form again as an ordinary student
  const again = await apply({ email: 'switch@example.org', name: 'Switch Person', tier: 'student', status: 'masters' });
  assert.equal(again.body.result, 'updated'); assert.equal(again.body.member.memberNo, first.body.member.memberNo); assert.equal(again.body.member.position, pos);
  assert.equal(again.body.member.tier, 'student'); assert.equal(again.body.member.nationalityStatus, 'not_required', 'nothing about nationality for a non-Saudi membership');
  assert.equal(again.body.member.amountGbp, 10); assert.equal(again.body.member.paymentStatus, 'due');
  const changed = C.lastMail('switch@example.org', 'membership_changed');
  assert.match(changed.subject, /application was updated/); assert.match(changed.body_text, /Student membership/); assert.doesNotMatch(changed.body_text, /nationality/i);
  assert.match(C.lastMail(COMMITTEE, 'membership_committee').subject, /Application changed to Student membership/);
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_members WHERE email = 'switch@example.org'"))[0].n, 1);
  // once the address is confirmed, only its owner (signed in) can change the application
  const me = await C.signIn('switch@example.org');
  const stranger = await apply({ email: 'switch@example.org', name: 'Someone Else', tier: 'friend' });
  assert.equal(stranger.body.result, 'already'); assert.equal(stranger.body.needsSignIn, true); assert.equal(stranger.body.member.tier, 'student'); assert.equal(stranger.body.member.name, 'Switch Person');
  const own = await C.call('POST', '/api/membership/apply', { cookie: me, body: { tier: 'saudi', sso: 'hert1234', name: 'Switch Person', email: 'switch@example.org', college: 'Hertford College', status: 'masters', consent_privacy: true, lang: 'en' } });
  assert.equal(own.body.result, 'updated'); assert.equal(own.body.member.tier, 'saudi'); assert.equal(own.body.member.nationalityStatus, 'pending'); assert.equal(own.body.member.amountGbp, 0);
  const acct = await C.call('GET', '/api/membership/me', { cookie: me });
  assert.equal(acct.body.member.canUploadProof, false); assert.equal(acct.body.member.evidence, null);
});

test('Oxford SSO username: needed for the student membership types, optional otherwise, four letters then four digits', async () => {
  const base = { name: 'Sso Person', college: 'Hertford College', status: 'masters', consent_privacy: true, lang: 'en' };
  const send = (over) => C.call('POST', '/api/membership/apply', { body: Object.assign({}, base, over) });
  for (const tier of ['saudi', 'student']) {
    const r = await send({ tier, email: tier + '-nosso@example.org' });
    assert.equal(r.status, 400); assert.equal(r.body.fields.sso, 'required', tier + ' needs the username');
  }
  for (const [i, bad] of ['abc1234', 'abcd123', 'abcde123', '1234abcd', 'ab-d1234', 'abcd12345'].entries()) {
    const r = await send({ tier: 'student', email: 'badsso' + i + '@example.org', sso: bad });
    assert.equal(r.status, 400, bad); assert.equal(r.body.fields.sso, 'invalid', bad);
  }
  const ok = await send({ tier: 'student', email: 'goodsso@example.org', sso: '  HeRt1234 ' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal((await q(db, "SELECT sso_username FROM oss_members WHERE email = 'goodsso@example.org'"))[0].sso_username, 'hert1234', 'stored in lower case');
  assert.match(C.lastMail(COMMITTEE, 'membership_committee').body_text, /SSO hert1234/);
  const detail = await C.call('GET', '/api/admin/membership/' + ok.body.member.memberNo, { cookie: root });
  assert.equal(detail.body.member.sso_username, 'hert1234');
  // not a student type → the field may be left empty, but a wrong format is still refused
  for (const tier of ['associate', 'friend']) {
    const r = await send({ tier, email: tier + '-nosso@example.org', status: 'staff' });
    assert.equal(r.status, 200, tier + ': ' + JSON.stringify(r.body));
    assert.equal((await q(db, 'SELECT sso_username FROM oss_members WHERE email = $1', [tier + '-nosso@example.org']))[0].sso_username, null);
  }
  assert.equal((await send({ tier: 'associate', email: 'assoc-bad@example.org', status: 'staff', sso: 'nope' })).body.fields.sso, 'invalid');
});

test('fee codes: the committee issues one; a valid code waives the fee, a wrong or used-up one is declined', async () => {
  const base = { name: 'Code Person', college: 'Hertford College', status: 'masters', consent_privacy: true, lang: 'en', sso: 'hert1234' };
  const send = (over) => C.call('POST', '/api/membership/apply', { body: Object.assign({}, base, over) });
  const check = (code, tier) => C.call('POST', '/api/membership/code', { body: { code, tier: tier || 'student' } });
  // only the committee can create or see codes
  assert.equal((await C.call('GET', '/api/admin/fee-codes')).status, 401);
  const outsider = await C.signIn('nobody@example.org');
  assert.equal((await C.call('POST', '/api/admin/fee-codes', { cookie: outsider, body: { label: 'x' } })).status, 403);
  const made = await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { label: 'Partner scholars', maxUses: 1 } });
  assert.equal(made.status, 200); const code = made.body.created;
  assert.match(code, /^OSS-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/); assert.equal(made.body.codes[0].used, 0); assert.equal(made.body.codes[0].label, 'Partner scholars');
  // "Check code": accepted or declined, and typing it in lower case with spaces still works
  assert.deepEqual((await check(' ' + code.toLowerCase() + ' ')).body, { ok: true });
  assert.deepEqual((await check('OSS-NOPE-NOPE')).body, { ok: false, reason: 'invalid' });
  assert.deepEqual((await check(code, 'saudi')).body, { ok: false, reason: 'not_needed' }, 'free types need no code');
  // a wrong code stops the form: nothing is saved
  const bad = await send({ tier: 'student', email: 'code-bad@example.org', feeCode: 'OSS-NOPE-NOPE' });
  assert.equal(bad.status, 400); assert.equal(bad.body.fields.feeCode, 'invalid');
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_members WHERE email = 'code-bad@example.org'"))[0].n, 0);
  // the right code: fee waived, shown to the applicant and the committee, counted once
  const ok = await send({ tier: 'student', email: 'code-ok@example.org', feeCode: code.toLowerCase() });
  assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.member.amountGbp, 0); assert.equal(ok.body.member.paymentStatus, 'waived'); assert.equal(ok.body.member.feeWaived, true);
  assert.equal(JSON.stringify(ok.body).includes(code), false, 'the code is never sent back to the browser');
  assert.match(C.lastMail('code-ok@example.org', 'membership_received').body_text, /fee has been waived with the code you entered/);
  assert.doesNotMatch(C.lastMail('code-ok@example.org', 'membership_received').body_text, /£10|treasurer/);
  assert.ok(C.lastMail(COMMITTEE, 'membership_committee').body_text.includes('Fee waived with code ' + code));
  const det = await C.call('GET', '/api/admin/membership/' + ok.body.member.memberNo, { cookie: root });
  assert.equal(det.body.member.fee_code, code); assert.equal(det.body.member.payment_status, 'waived');
  assert.equal((await C.call('GET', '/api/admin/fee-codes', { cookie: root })).body.codes[0].used, 1);
  // the same person sending the form again does not use the code up twice
  assert.equal((await send({ tier: 'student', email: 'code-ok@example.org', feeCode: code })).body.result, 'already');
  assert.equal((await q(db, 'SELECT used FROM oss_fee_codes WHERE code = $1', [code]))[0].used, 1);
  // one use only: the next person is declined
  const second = await send({ tier: 'associate', email: 'code-second@example.org', status: 'staff', feeCode: code });
  assert.equal(second.status, 400); assert.equal(second.body.fields.feeCode, 'used_up');
  assert.deepEqual((await check(code)).body, { ok: false, reason: 'used_up' });
  // expired and switched-off codes are declined; a free type ignores a code without using it
  const exp = (await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { code: 'old-code-1', expiresOn: '2020-01-01' } })).body.created;
  assert.equal(exp, 'OLD-CODE-1'); assert.deepEqual((await check(exp)).body, { ok: false, reason: 'expired' });
  const open = (await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { code: 'FRIENDS2026' } })).body.created;
  assert.equal((await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { code: 'FRIENDS2026' } })).status, 409, 'no two codes alike');
  const free = await send({ tier: 'friend', email: 'code-friend@example.org', status: 'alumni', feeCode: open, sso: '' });
  assert.equal(free.status, 200); assert.equal(free.body.member.feeWaived, false); assert.equal((await q(db, 'SELECT used FROM oss_fee_codes WHERE code = $1', [open]))[0].used, 0);
  await C.call('POST', '/api/admin/fee-codes/' + open + '/disable', { cookie: root, body: {} });
  assert.deepEqual((await check(open)).body, { ok: false, reason: 'invalid' });
  await C.call('POST', '/api/admin/fee-codes/' + open + '/enable', { cookie: root, body: {} });
  assert.deepEqual((await check(open, 'associate')).body, { ok: true });
});

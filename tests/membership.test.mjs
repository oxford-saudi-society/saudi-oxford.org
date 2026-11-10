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
/* A Saudi doctoral student at the University of Oxford, unless a test says otherwise. */
const BASE = { tier: 'saudi', confirm_saudi: true, name: 'Applicant One', nameAr: 'مقدم الطلب', email: 'one@example.org', status: 'doctoral', uniChoice: 'oxford', college: 'Hertford College', sso: 'hert1234', phone: '+966 50 000 0000', consent_privacy: true, consent_news: true, lang: 'en' };
const send = (body, cookie) => C.call('POST', '/api/membership/apply', { body, cookie });
const apply = (over, cookie) => send(Object.assign({}, BASE, over || {}), cookie);
const memberNo = async (email) => (await q(db, 'SELECT member_no FROM oss_members WHERE email = $1', [email]))[0].member_no;
const desk = (no, action, body) => C.call('POST', `/api/admin/membership/${no}/${action}`, { cookie: root, body: body || {} });

before(async () => { db = await setupDb(); C = await makeClient(); root = await C.signIn(ADMIN, '/admin/events/'); });
after(async () => { const dbm = await import('../netlify/lib/db.mjs'); await dbm._reset(); });

test('signing key is generated and stored when AUTH_SECRET is absent', async () => {
  assert.equal(process.env.AUTH_SECRET, undefined);
  const k = await q(db, "SELECT value FROM oss_settings WHERE key = 'auth_secret'");
  assert.equal(k.length, 1); assert.ok(String(k[0].value).length >= 48);
  assert.equal((await C.call('GET', '/api/admin/me', { cookie: root })).body.role, 'super_admin', 'settings.adminEmails bootstraps the first super admin');
});

test('validation, honeypot and consent', async () => {
  const bad = await send({ tier: 'gold', name: 'x', email: 'bad', status: 'pirate', consent_privacy: false });
  assert.equal(bad.status, 400); assert.deepEqual(Object.keys(bad.body.fields).sort(), ['consent', 'email', 'name', 'tier']);
  const st = await send({ tier: 'saudi', name: 'Real Name', email: 'st@example.org', status: 'pirate', consent_privacy: true });
  assert.deepEqual(Object.keys(st.body.fields).sort(), ['confirmSaudi', 'status'], 'the free category needs the nationality confirmation');
  const hp = await apply({ website: 'spam', email: 'bot@example.org' });
  assert.equal(hp.status, 200); assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_members WHERE email = 'bot@example.org'"))[0].n, 0);
});

test('apply: permanent number, queue position, confirmation email, committee notice, duplicates', async () => {
  const r1 = await apply();
  assert.equal(r1.status, 200, JSON.stringify(r1.body)); assert.equal(r1.body.result, 'received'); assert.equal(r1.body.kind, 'membership');
  const m1 = r1.body.member;
  assert.match(m1.memberNo, NO); assert.equal(m1.status, 'pending'); assert.equal(m1.stage, 'received'); assert.equal(m1.position, 1); assert.equal(m1.nationalityStatus, 'pending'); assert.equal(m1.amountGbp, 0);
  assert.deepEqual(m1.fee, { en: 'Free', ar: 'مجانية' }); assert.deepEqual(m1.statusLabel, { en: 'Doctoral student', ar: 'طالب دكتوراه' }); assert.equal(m1.institution, 'University of Oxford');
  const year = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric' }).format(new Date());
  assert.ok(m1.memberNo.startsWith('OSS-' + year + '-'));
  const r2 = await apply({ email: 'two@example.org', name: 'Applicant Two', tier: 'student', status: 'masters', lang: 'ar' });
  const r3 = await apply({ email: 'three@example.org', name: 'Applicant Three', tier: 'associate', status: 'supporter' });
  assert.equal(r2.body.member.position, 2); assert.equal(r3.body.member.position, 3);
  assert.equal(r2.body.member.amountGbp, 10); assert.equal(r2.body.member.paymentStatus, 'due'); assert.deepEqual(r2.body.member.fee, { en: '£10 per year', ar: '١٠ جنيهات إسترلينية سنويًا' });
  assert.equal(r3.body.member.amountGbp, 15); assert.deepEqual(r3.body.member.fee, { en: '£15 per year', ar: '١٥ جنيهًا إسترلينيًا سنويًا' });
  assert.notEqual(r1.body.member.memberNo, r2.body.member.memberNo);
  const mail = C.lastMail('one@example.org', 'membership_received');
  assert.ok(mail.body_text.includes(m1.memberNo)); assert.match(mail.body_text, /Place in the review queue: 1/); assert.match(mail.body_text, /Status: Application received/);
  assert.match(mail.body_text, /secretary will email you later to ask for proof of Saudi nationality/); assert.match(mail.body_text, /becomes active once eligibility is confirmed/); assert.doesNotMatch(mail.body_text, /upload/i);
  const arMail = C.lastMail('two@example.org', 'membership_received');
  assert.match(arMail.subject, /تم استلام طلب العضوية/); assert.match(arMail.body_text, /£10/); assert.match(arMail.body_text, /تُفعَّل العضوية بعد تأكيد السداد/); assert.ok(arMail.body_text.includes(r2.body.member.memberNo));
  const note = C.lastMail(COMMITTEE, 'membership_committee');
  assert.ok(note, 'committee is told about new applications'); assert.match(note.body_text, /Associate Membership · Friend or supporter of the Society/);
  const row = (await q(db, "SELECT consent_news, consent_privacy_version, declared_saudi, whatsapp, phone, university, uni_choice, eligibility FROM oss_members WHERE email = 'one@example.org'"))[0];
  assert.equal(row.consent_news, true); assert.ok(row.consent_privacy_version); assert.equal(row.declared_saudi, true); assert.equal(row.whatsapp, false);
  assert.equal(row.phone, '+966 50 000 0000', 'international numbers are kept as typed'); assert.equal(row.university, 'University of Oxford'); assert.equal(row.eligibility, 'not_required');
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
  assert.equal(qd.body.totals.pending, 3); assert.equal(qd.body.members[0].statusText, 'Doctoral student'); assert.match(qd.body.members[0].detailText, /University of Oxford · Hertford College/);
  const no = qd.body.members[0].member_no;
  const d = await C.call('GET', '/api/admin/membership/' + no, { cookie: root });
  assert.equal(d.body.member.name_ar, 'مقدم الطلب'); assert.ok(d.body.history.some((h) => h.action === 'membership.applied'));
});

test('request info → applicant answers from their account → back in the queue at the same place', async () => {
  const no = await memberNo('one@example.org');
  const ask = await desk(no, 'request-info', { message: 'Please tell us which college you are at.' });
  assert.equal(ask.status, 200); assert.equal(ask.body.member.status, 'info_requested');
  assert.match(C.lastMail('one@example.org', 'membership_info_request').body_text, /which college/);
  // the confirmation email's link signs the applicant in and verifies their address
  const v = await C.verify(C.linkIn(C.lastMail('one@example.org', 'membership_received')));
  assert.equal(v.status, 303); assert.match(v.location, /\/account\/\?verified=signed_in$/);
  const me = await C.call('GET', '/api/membership/me', { cookie: v.cookie });
  assert.equal(me.body.member.status, 'info_requested'); assert.equal(me.body.member.stage, 'needs_info'); assert.deepEqual(me.body.member.stageLabel, { en: 'More information needed', ar: 'يتطلب استكمال البيانات' });
  assert.match(me.body.member.infoRequest, /college/); assert.equal(me.body.member.emailVerified, true); assert.equal(me.body.member.position, 1);
  const other = await C.signIn('two@example.org');
  assert.equal((await C.call('POST', '/api/membership/respond', { cookie: other, body: { response: 'not mine' } })).status, 400, 'no open question for someone else');
  const ans = await C.call('POST', '/api/membership/respond', { cookie: v.cookie, body: { response: 'Hertford, as on the form.' } });
  assert.equal(ans.body.member.status, 'pending'); assert.equal(ans.body.member.position, 1); assert.equal(ans.body.member.stage, 'verifying', 'email confirmed, waiting for the committee');
  assert.match(C.lastMail(COMMITTEE, 'membership_committee').body_text, /Hertford, as on the form/);
  const acct = await C.call('GET', '/api/me', { cookie: v.cookie });
  assert.equal(acct.body.membership.memberNo, no);
});

test('approve → active member (members-only gate opens), queue moves up, flags and history', async () => {
  const no = await memberNo('one@example.org');
  const early = await desk(no, 'approve', { validUntil: '2027-09-30' });
  assert.equal(early.status, 400); assert.equal(early.body.error, 'eligibility_required', 'a free membership is not activated before eligibility is confirmed');
  const up = await desk(no, 'update', { nationalityStatus: 'verified', notes: 'Confirmed by the secretary.' });
  assert.equal(up.body.member.nationality_status, 'verified');
  const ok = await desk(no, 'approve', { validUntil: '2027-09-30' });
  assert.equal(ok.body.member.status, 'approved'); assert.ok(ok.body.member.decided_by === ADMIN); assert.equal(ok.body.member.stage, 'active');
  const mail = C.lastMail('one@example.org', 'membership_approved');
  assert.match(mail.body_text, /Valid until: 30 September 2027/); assert.ok(mail.body_text.includes(no));
  const cookie = await C.signIn('one@example.org');
  assert.equal((await C.call('GET', '/api/me', { cookie })).body.member, true, 'approved members pass the members-only check');
  const qd = await C.call('GET', '/api/admin/membership?view=queue', { cookie: root });
  assert.deepEqual(qd.body.members.map((x) => [x.email, x.position]), [['two@example.org', 1], ['three@example.org', 2]]);
  const again = await apply();
  assert.equal(again.body.result, 'already_member');
  const hist = (await C.call('GET', '/api/admin/membership/' + no, { cookie: root })).body.history.map((h) => h.action);
  assert.deepEqual(hist.filter((a) => a.startsWith('membership.')), ['membership.applied', 'membership.info_requested', 'membership.responded', 'membership.updated', 'membership.approved']);
});

test('decline with reason → re-application keeps the number and joins the back of the queue; revoke and reinstate', async () => {
  const two = await memberNo('two@example.org');
  const dec = await desk(two, 'decline', { reason: 'Not a member of the University.' });
  assert.equal(dec.body.member.status, 'declined');
  assert.match(C.lastMail('two@example.org', 'membership_declined').body_text, /ليس|Not a member of the University/);
  assert.equal((await desk(two, 'revoke')).status, 400, 'only approved members can be revoked');
  const re = await apply({ email: 'two@example.org', name: 'Applicant Two', tier: 'student', status: 'masters' });
  assert.equal(re.body.result, 'received'); assert.equal(re.body.member.memberNo, two); assert.equal(re.body.member.position, 2);
  const one = await memberNo('one@example.org');
  const rev = await desk(one, 'revoke', { reason: 'Left Oxford.' });
  assert.equal(rev.body.member.status, 'revoked'); assert.ok(C.lastMail('one@example.org', 'membership_revoked'));
  const cookie = await C.signIn('one@example.org');
  assert.equal((await C.call('GET', '/api/me', { cookie })).body.member, false, 'revoked members lose members-only access');
  const back = await desk(one, 'approve', { notify: false });
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

test('sending the form again with a different membership type updates the open application (same number and place)', async () => {
  const first = await apply({ email: 'switch@example.org', name: 'Switch Person' });
  assert.equal(first.body.member.nationalityStatus, 'pending'); assert.equal(first.body.member.canUploadProof, false, 'the upload is switched off');
  const pos = first.body.member.position;
  // chose the free Saudi category by mistake → sends the form again as an ordinary Oxford student
  const again = await apply({ email: 'switch@example.org', name: 'Switch Person', tier: 'student', status: 'masters', confirm_saudi: false });
  assert.equal(again.body.result, 'updated'); assert.equal(again.body.member.memberNo, first.body.member.memberNo); assert.equal(again.body.member.position, pos);
  assert.equal(again.body.member.tier, 'student'); assert.equal(again.body.member.nationalityStatus, 'not_required', 'nothing about nationality for the other memberships');
  assert.equal(again.body.member.amountGbp, 10); assert.equal(again.body.member.paymentStatus, 'due');
  assert.equal((await q(db, "SELECT declared_saudi FROM oss_members WHERE email = 'switch@example.org'"))[0].declared_saudi, false, 'no nationality is recorded for a paid membership');
  const changed = C.lastMail('switch@example.org', 'membership_changed');
  assert.match(changed.subject, /application was updated/); assert.match(changed.body_text, /Oxford Student Membership/); assert.doesNotMatch(changed.body_text, /nationality/i);
  assert.match(C.lastMail(COMMITTEE, 'membership_committee').subject, /Application changed to Oxford Student Membership/);
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_members WHERE email = 'switch@example.org'"))[0].n, 1);
  // once the address is confirmed, only its owner (signed in) can change the application
  const me = await C.signIn('switch@example.org');
  const stranger = await apply({ email: 'switch@example.org', name: 'Someone Else', tier: 'associate', status: 'supporter' });
  assert.equal(stranger.body.result, 'already'); assert.equal(stranger.body.needsSignIn, true); assert.equal(stranger.body.member.tier, 'student'); assert.equal(stranger.body.member.name, 'Switch Person');
  const own = await apply({ email: 'switch@example.org', name: 'Switch Person', status: 'masters' }, me);
  assert.equal(own.body.result, 'updated'); assert.equal(own.body.member.tier, 'saudi'); assert.equal(own.body.member.nationalityStatus, 'pending'); assert.equal(own.body.member.amountGbp, 0);
  const acct = await C.call('GET', '/api/membership/me', { cookie: me });
  assert.equal(acct.body.member.canUploadProof, false); assert.equal(acct.body.member.evidence, null);
});

test('Oxford SSO username: always optional, four letters then four digits, kept only for a current University of Oxford affiliation', async () => {
  const sso = async (email) => (await q(db, 'SELECT sso_username FROM oss_members WHERE email = $1', [email]))[0].sso_username;
  for (const tier of ['saudi', 'student']) {
    const r = await apply({ tier, email: tier + '-nosso@example.org', status: 'masters', sso: '' });
    assert.equal(r.status, 200, tier + ' does not need the username: ' + JSON.stringify(r.body)); assert.equal(await sso(tier + '-nosso@example.org'), null);
  }
  for (const [i, bad] of ['abc1234', 'abcd123', 'abcde123', '1234abcd', 'ab-d1234', 'abcd12345'].entries()) {
    const r = await apply({ tier: 'student', email: 'badsso' + i + '@example.org', status: 'masters', sso: bad });
    assert.equal(r.status, 400, bad); assert.equal(r.body.fields.sso, 'invalid', bad);
  }
  const ok = await apply({ tier: 'student', email: 'goodsso@example.org', status: 'undergraduate', sso: '  HeRt1234 ' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(await sso('goodsso@example.org'), 'hert1234', 'stored in lower case');
  assert.match(C.lastMail(COMMITTEE, 'membership_committee').body_text, /SSO hert1234/);
  assert.equal((await C.call('GET', '/api/admin/membership/' + ok.body.member.memberNo, { cookie: root })).body.member.sso_username, 'hert1234');
  // an alumnus, a Brookes student and a hospital doctor are never asked for it, and a stray value is not stored
  await apply({ email: 'sso-alum@example.org', status: 'alumni', sso: 'hert1234' });
  await apply({ email: 'sso-brookes@example.org', status: 'masters', uniChoice: 'brookes', sso: 'hert1234' });
  await apply({ email: 'sso-doc@example.org', status: 'consultant', hospital: 'jr', role: 'Consultant cardiologist', specialty: 'Cardiology', sso: 'hert1234' });
  for (const e of ['sso-alum@example.org', 'sso-brookes@example.org', 'sso-doc@example.org']) assert.equal(await sso(e), null, e);
  // academic staff at the University of Oxford may give it; at another institution it is not kept
  await apply({ tier: 'associate', email: 'sso-staff@example.org', status: 'academic_staff', department: 'Chemistry', sso: 'chem1234' });
  await apply({ tier: 'associate', email: 'sso-staff2@example.org', status: 'academic_staff', uniChoice: 'brookes', department: 'Law', sso: 'chem1234' });
  assert.equal(await sso('sso-staff@example.org'), 'chem1234'); assert.equal(await sso('sso-staff2@example.org'), null);
});

test('discount and exemption codes: decided by the code record; a full code waives the fee, a part code reduces it', async () => {
  const check = (code, tier, email) => C.call('POST', '/api/membership/code', { body: { code, tier: tier || 'student', email } });
  const student = (over) => apply(Object.assign({ tier: 'student', status: 'masters', name: 'Code Person' }, over));
  // only the committee can create or see codes
  assert.equal((await C.call('GET', '/api/admin/fee-codes')).status, 401);
  const outsider = await C.signIn('nobody@example.org');
  assert.equal((await C.call('POST', '/api/admin/fee-codes', { cookie: outsider, body: { label: 'x' } })).status, 403);
  const made = await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { label: 'Partner scholars', maxUses: 1 } });
  assert.equal(made.status, 200); const code = made.body.created;
  assert.match(code, new RegExp('^OSS-X' + String(new Date().getUTCFullYear()).slice(-2) + '-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$'), 'a generated code carries the year it was issued in');
  assert.equal(made.body.codes[0].used, 0); assert.equal(made.body.codes[0].label, 'Partner scholars'); assert.equal(made.body.codes[0].percent_off, 100);
  // "Check code": typed in lower case, without dashes, with spaces or with O for 0 / L for 1 — the same record
  const yes = { ok: true, personal: false, percent: 100, amountGbp: 0 };
  assert.deepEqual((await check(' ' + code.toLowerCase() + ' ')).body, yes);
  assert.deepEqual((await check(code.replace(/-/g, ''))).body, yes);
  assert.deepEqual((await check(code.replace(/-/g, ' ').replace(/0/g, 'O').replace(/1/g, 'L'))).body, yes);
  // a code that is not on record is declined, whatever it looks like (no pattern is trusted)
  assert.deepEqual((await check('OSS-NOPE-NOPE')).body, { ok: false, reason: 'invalid' });
  const lookalike = code.slice(0, -1) + (code.slice(-1) === 'A' ? 'B' : 'A');
  assert.deepEqual((await check(lookalike)).body, { ok: false, reason: 'invalid' }, 'the right shape without a record is still declined');
  assert.deepEqual((await check(code, 'saudi')).body, { ok: false, reason: 'not_needed' }, 'the free category needs no code');
  // a wrong code stops the form: nothing is saved
  const bad = await student({ email: 'code-bad@example.org', feeCode: 'OSS-NOPE-NOPE' });
  assert.equal(bad.status, 400); assert.equal(bad.body.fields.feeCode, 'invalid');
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_members WHERE email = 'code-bad@example.org'"))[0].n, 0);
  // the right code: fee waived, shown to the applicant and the committee, counted once
  const ok = await student({ email: 'code-ok@example.org', feeCode: code.toLowerCase() });
  assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.member.amountGbp, 0); assert.equal(ok.body.member.paymentStatus, 'waived'); assert.equal(ok.body.member.feeWaived, true);
  assert.equal(JSON.stringify(ok.body).includes(code), false, 'the code is never sent back to the browser');
  assert.match(C.lastMail('code-ok@example.org', 'membership_received').body_text, /fee has been waived with the code you entered/);
  assert.doesNotMatch(C.lastMail('code-ok@example.org', 'membership_received').body_text, /£10|treasurer/);
  assert.ok(C.lastMail(COMMITTEE, 'membership_committee').body_text.includes('Fee waived with code ' + code));
  const det = await C.call('GET', '/api/admin/membership/' + ok.body.member.memberNo, { cookie: root });
  assert.equal(det.body.member.fee_code, code); assert.equal(det.body.member.payment_status, 'waived');
  assert.equal((await C.call('GET', '/api/admin/fee-codes', { cookie: root })).body.codes[0].used, 1);
  // the same person sending the form again does not use the code up twice
  assert.equal((await student({ email: 'code-ok@example.org', feeCode: code })).body.result, 'already');
  assert.equal((await q(db, 'SELECT used FROM oss_fee_codes WHERE code = $1', [code]))[0].used, 1);
  // one use only: the next person is declined
  const second = await apply({ tier: 'associate', email: 'code-second@example.org', status: 'supporter', feeCode: code });
  assert.equal(second.status, 400); assert.equal(second.body.fields.feeCode, 'used_up');
  assert.deepEqual((await check(code)).body, { ok: false, reason: 'used_up' });
  // the committee's own wording works the same way; expired and switched-off records are declined
  const exp = (await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { code: 'old-code-1', expiresOn: '2020-01-01' } })).body.created;
  assert.equal(exp, 'OLD-CODE-1'); assert.deepEqual((await check(exp)).body, { ok: false, reason: 'expired' });
  const open = (await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { code: 'FRIENDS2026' } })).body.created;
  assert.equal((await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { code: 'friends-2o26' } })).status, 409, 'two spellings of one code are one code');
  assert.equal((await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { code: 'abc' } })).status, 400, 'too short to be a code');
  const free = await apply({ email: 'code-free@example.org', feeCode: open });
  assert.equal(free.status, 200); assert.equal(free.body.member.feeWaived, false); assert.equal((await q(db, 'SELECT used FROM oss_fee_codes WHERE code = $1', [open]))[0].used, 0, 'the free category ignores a code without using it');
  await C.call('POST', '/api/admin/fee-codes/' + open + '/disable', { cookie: root, body: {} });
  assert.deepEqual((await check(open)).body, { ok: false, reason: 'invalid' });
  await C.call('POST', '/api/admin/fee-codes/' + open + '/enable', { cookie: root, body: {} });
  assert.deepEqual((await check('friends 2026', 'associate')).body, yes);
  // a discount code takes its percentage off the fee, and the rest is still due
  assert.equal((await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { percentOff: 0 } })).status, 400);
  const half = (await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { label: 'Half price', percentOff: 50 } })).body.created;
  assert.deepEqual((await check(half)).body, { ok: true, personal: false, percent: 50, amountGbp: 5 });
  assert.deepEqual((await check(half, 'associate')).body, { ok: true, personal: false, percent: 50, amountGbp: 8 });
  const disc = await student({ email: 'code-half@example.org', feeCode: half });
  assert.equal(disc.body.member.amountGbp, 5); assert.equal(disc.body.member.paymentStatus, 'due'); assert.equal(disc.body.member.feeWaived, false); assert.equal(disc.body.member.feeDiscounted, true);
  assert.match(C.lastMail('code-half@example.org', 'membership_received').body_text, /discount code you entered has been applied[\s\S]*£5 per year/);
  assert.ok(C.lastMail(COMMITTEE, 'membership_committee').body_text.includes('Discount code ' + half + ' applied: fee £5'));
  // every generated code is different
  const many = new Set(); for (let i = 0; i < 20; i++) many.add((await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: {} })).body.created);
  assert.equal(many.size, 20); for (const c of many) assert.equal((await check(c)).body.ok, true, c);
  // a personal code: only the named email address can use it, once
  const pers = await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { label: 'For Reem', email: ' Reem@Example.org ' } });
  const mine = pers.body.created; const rec = pers.body.codes.find((c) => c.code === mine);
  assert.equal(rec.email, 'reem@example.org'); assert.equal(rec.max_uses, 1);
  assert.equal((await check(mine)).body.personal, true, 'before an email is typed the code is recognised');
  assert.deepEqual((await check(mine, 'student', 'someone@example.org')).body, { ok: false, reason: 'not_yours' });
  assert.equal((await check(mine, 'student', 'reem@example.org')).body.ok, true);
  const other = await student({ email: 'someone@example.org', feeCode: mine });
  assert.equal(other.status, 400); assert.equal(other.body.fields.feeCode, 'not_yours');
  const reem = await student({ email: 'reem@example.org', name: 'Reem Person', feeCode: mine });
  assert.equal(reem.status, 200); assert.equal(reem.body.member.feeWaived, true);
  assert.equal((await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: { email: 'not-an-email' } })).status, 400);
});

test('each membership type and status asks only for the details that apply to it', async () => {
  const req = async (over, fields) => { const r = await apply(Object.assign({ college: '', sso: '', uniChoice: '' }, over)); assert.equal(r.status, 400, JSON.stringify(over)); assert.deepEqual(Object.keys(r.body.fields).sort(), fields, JSON.stringify(over)); };
  const row = async (email, cols) => (await q(db, `SELECT ${cols} FROM oss_members WHERE email = $1`, [email]))[0];
  // Oxford Student Membership: four statuses, college needed, open to every nationality
  await req({ tier: 'student', email: 'd1@example.org', status: 'masters' }, ['college']);
  await req({ tier: 'student', email: 'd1@example.org', status: 'alumni', college: 'Hertford College' }, ['status']);
  const st = await apply({ tier: 'student', email: 'd-student@example.org', status: 'visiting_student', confirm_saudi: false });
  assert.equal(st.status, 200); assert.deepEqual(st.body.member.tierLabel, { en: 'Oxford Student Membership', ar: 'عضوية طلبة جامعة أكسفورد' }); assert.deepEqual(st.body.member.statusLabel, { en: 'Visiting student', ar: 'طالب زائر' });
  // Other University Student Membership: where they study, the university's name and the level; the subject is optional
  await req({ tier: 'external', email: 'd2@example.org', status: 'masters', college: 'Hertford College', sso: 'hert1234' }, ['org', 'uniPlace']);
  await req({ tier: 'external', email: 'd2@example.org', status: 'brookes', uniPlace: 'brookes', org: 'Oxford Brookes University' }, ['status']);
  for (const [i, place] of ['brookes', 'uk_university', 'global_university'].entries()) {
    const r = await apply({ tier: 'external', email: 'ext' + i + '@example.org', status: 'masters', uniPlace: place, org: place === 'brookes' ? 'Oxford Brookes University' : 'Some University', subject: i ? '' : 'Computer Science', sso: 'hert1234', college: 'ignored' });
    assert.equal(r.status, 200, place + ' ' + JSON.stringify(r.body)); assert.equal(r.body.member.amountGbp, 10); assert.equal(r.body.member.nationalityStatus, 'not_required');
    assert.deepEqual(r.body.member.tierLabel, { en: 'Other University Student Membership', ar: 'عضوية طلبة الجامعات الأخرى' });
  }
  assert.deepEqual(await row('ext0@example.org', 'university, subject, college, sso_username, uni_status, uni_place, amount_gbp'), { university: 'Oxford Brookes University', subject: 'Computer Science', college: null, sso_username: null, uni_status: 'masters', uni_place: 'brookes', amount_gbp: 10 });
  assert.deepEqual((await apply({ tier: 'external', email: 'ext2@example.org', status: 'masters', uniPlace: 'global_university', org: 'Some University' })).body.member.statusLabel, { en: 'University outside the UK · Master’s', ar: 'جامعة خارج بريطانيا · ماجستير' });
  assert.match(C.lastMail(COMMITTEE, 'membership_committee').body_text, /Other University Student Membership · University outside the UK · Master’s\nSome University/);
  // Saudi Oxford Community Membership, by kind of connection
  await req({ email: 'd3@example.org', status: 'masters' }, ['uniChoice']);
  await req({ email: 'd3@example.org', status: 'masters', uniChoice: 'oxford' }, ['college']);
  await req({ email: 'd3@example.org', status: 'masters', uniChoice: 'other' }, ['org']);
  assert.equal((await apply({ email: 'd-brookes@example.org', status: 'undergraduate', uniChoice: 'brookes', college: 'stray' })).status, 200, 'a college is asked only of University of Oxford students');
  assert.deepEqual(await row('d-brookes@example.org', 'university, college, uni_choice'), { university: 'Oxford Brookes University', college: null, uni_choice: 'brookes' });
  await req({ email: 'd4@example.org', status: 'alumni', uniChoice: 'oxford', gradYear: '19' }, ['gradYear']);
  assert.equal((await apply({ email: 'd-alum@example.org', status: 'alumni', uniChoice: 'brookes', gradYear: '2019' })).status, 200);
  assert.equal((await apply({ email: 'd-alum2@example.org', status: 'alumni', uniChoice: 'oxford', gradYear: '' })).status, 200, 'the year of graduation is optional');
  assert.deepEqual(await row('d-alum@example.org', 'university, grad_year, college'), { university: 'Oxford Brookes University', grad_year: 2019, college: null });
  await req({ email: 'd5@example.org', status: 'researcher' }, ['department', 'uniChoice']);
  await req({ email: 'd5@example.org', status: 'researcher', uniChoice: 'oxford' }, ['department']);
  assert.equal((await apply({ email: 'd-emp@example.org', status: 'university_employee', uniChoice: 'oxford', college: '' })).status, 200, 'a department is optional for an employee');
  await req({ email: 'd6@example.org', status: 'clinical_fellow' }, ['hospital', 'role', 'specialty']);
  await req({ email: 'd6@example.org', status: 'resident_doctor', hospital: 'other', role: 'Resident doctor', specialty: 'Paediatrics' }, ['org']);
  const fellow = await apply({ email: 'd-fellow@example.org', status: 'clinical_fellow', hospital: 'churchill', role: 'Clinical Fellow', specialty: 'Oncology', college: 'stray', uniChoice: 'oxford' });
  assert.equal(fellow.status, 200); assert.deepEqual(fellow.body.member.statusLabel, { en: 'Clinical fellow', ar: 'طبيب زمالة' });
  assert.deepEqual(await row('d-fellow@example.org', 'hospital, university, job_role, specialty, college, uni_choice'), { hospital: 'churchill', university: 'Churchill Hospital', job_role: 'Clinical Fellow', specialty: 'Oncology', college: null, uni_choice: null });
  assert.equal((await apply({ email: 'd-res@example.org', status: 'resident_doctor', hospital: 'other', org: 'Manor Hospital', role: 'Resident doctor', specialty: 'Paediatrics' })).status, 200);
  assert.equal((await row('d-res@example.org', 'university')).university, 'Manor Hospital');
  await req({ email: 'd7@example.org', status: 'healthcare', hospital: 'jr' }, ['role']);
  assert.equal((await apply({ email: 'd-nurse@example.org', status: 'healthcare', hospital: 'jr', role: 'Pharmacist' })).status, 200, 'a medical specialty is optional for other healthcare professionals');
  await req({ email: 'd8@example.org', status: 'oxford_professional' }, ['org', 'role']);
  assert.equal((await apply({ email: 'd-work@example.org', status: 'oxford_professional', org: 'Example Ltd, Oxford', role: 'Engineer' })).status, 200);
  // Associate Membership: a supporter is asked for nothing more; "other" explains itself
  assert.equal((await apply({ tier: 'associate', email: 'd-supp@example.org', status: 'supporter', college: '', sso: '', uniChoice: '' })).status, 200);
  assert.deepEqual(await row('d-supp@example.org', 'college, university, sso_username, job_role'), { college: null, university: null, sso_username: null, job_role: null });
  await req({ tier: 'associate', email: 'd9@example.org', status: 'other' }, ['connection']);
  await req({ tier: 'associate', email: 'd9@example.org', status: 'oxford_professional', org: 'x', role: 'y' }, ['status']);
  const assoc = await apply({ tier: 'associate', email: 'd-assoc@example.org', status: 'researcher', department: 'Physics' });
  assert.deepEqual(assoc.body.member.tierLabel, { en: 'Associate Membership', ar: 'العضوية المنتسبة' }); assert.deepEqual(assoc.body.member.statusLabel, { en: 'Researcher', ar: 'باحث' }); assert.equal(assoc.body.member.amountGbp, 15);
  assert.deepEqual((await apply({ email: 'd-saudi@example.org' })).body.member.tierLabel, { en: 'Saudi Oxford Community Membership', ar: 'عضوية السعوديين في أكسفورد' });
  // the WhatsApp group is its own unchecked choice
  await apply({ email: 'd-wa@example.org', whatsapp: true });
  assert.equal((await row('d-wa@example.org', 'whatsapp')).whatsapp, true);
});

test('mailing list: an email address and an explicit opt-in; separate from membership', async () => {
  const sub = (over) => send(Object.assign({ tier: 'mailing', email: 'news@example.org', consent_privacy: true, consent_news: true, lang: 'en' }, over));
  const bad = await sub({ email: 'nope', consent_news: false, consent_privacy: false });
  assert.equal(bad.status, 400); assert.deepEqual(Object.keys(bad.body.fields).sort(), ['consent', 'consentNews', 'email'], 'the name is optional; the opt-in is not');
  const ok = await sub({ interests: ['cultural', 'careers', 'bogus'] });
  assert.equal(ok.status, 200); assert.deepEqual(ok.body, { result: 'subscribed', kind: 'mailing', email: 'news@example.org' });
  assert.deepEqual((await q(db, "SELECT name, interests, source, verified_at FROM oss_subscribers WHERE email = 'news@example.org'"))[0], { name: null, interests: ['cultural', 'careers'], source: 'mailing_list', verified_at: null });
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_members WHERE email = 'news@example.org'"))[0].n, 0, 'a subscriber is not a member');
  const mail = C.lastMail('news@example.org', 'mailing_welcome');
  assert.match(mail.body_text, /separate from membership/); assert.equal(C.lastMail(COMMITTEE, 'mailing_welcome'), undefined);
  assert.deepEqual((await sub({ name: 'News Reader' })).body, ok.body, 'the same answer whether or not the address was already on the list');
  // following the link confirms the address; the account shows the subscription and can end it
  const v = await C.verify(C.linkIn(mail));
  const me = await C.call('GET', '/api/me', { cookie: v.cookie });
  assert.equal(me.body.member, false, 'no membership rights'); assert.equal(me.body.membership, null); assert.equal(me.body.mailingList.subscribed, true); assert.equal(me.body.volunteer, null);
  assert.ok((await q(db, "SELECT verified_at FROM oss_subscribers WHERE email = 'news@example.org'"))[0].verified_at);
  // a confirmed subscription is not changed by someone else sending the form with that address
  await sub({ name: 'Mallory', interests: ['social'] });
  assert.deepEqual((await q(db, "SELECT name, interests FROM oss_subscribers WHERE email = 'news@example.org'"))[0], { name: 'News Reader', interests: [] });
  const csv = await C.call('GET', '/api/admin/subscribers.csv', { cookie: root });
  assert.match(csv.body, /news@example\.org,News Reader,en,[^,]+,mailing_list,,yes/);
  assert.equal((await C.call('POST', '/api/mailing-list/unsubscribe')).status, 401);
  const out = await C.call('POST', '/api/mailing-list/unsubscribe', { cookie: v.cookie, body: {} });
  assert.equal(out.body.mailingList, null); assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_subscribers WHERE email = 'news@example.org'"))[0].n, 0);
  // unsubscribing also ends a news opt-in given with a membership application
  const mem = await C.signIn('one@example.org');
  assert.equal((await C.call('GET', '/api/me', { cookie: mem })).body.mailingList.subscribed, true);
  await C.call('POST', '/api/mailing-list/unsubscribe', { cookie: mem, body: {} });
  assert.equal((await q(db, "SELECT consent_news FROM oss_members WHERE email = 'one@example.org'"))[0].consent_news, false);
});

test('volunteer registration: its own register; areas and place needed; no membership rights', async () => {
  const vol = (over, cookie) => send(Object.assign({ tier: 'volunteer', name: 'Vol Person', email: 'vol@example.org', areas: ['events', 'photography'], place: 'both', consent_privacy: true, lang: 'ar' }, over), cookie);
  const bad = await vol({ name: '', email: 'x', areas: ['bogus'], place: '', consent_privacy: false });
  assert.equal(bad.status, 400); assert.deepEqual(Object.keys(bad.body.fields).sort(), ['areas', 'consent', 'email', 'name', 'place']);
  const ok = await vol({ phone: '+44 7700 900000', whatsapp: true });
  assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.result, 'volunteer_received'); assert.equal(ok.body.kind, 'volunteer'); assert.deepEqual(ok.body.volunteer.areas, ['events', 'photography']);
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_members WHERE email = 'vol@example.org'"))[0].n, 0, 'a volunteer is not a member');
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_subscribers WHERE email = 'vol@example.org'"))[0].n, 0, 'and is not put on the mailing list without asking');
  const mail = C.lastMail('vol@example.org', 'volunteer_received');
  assert.match(mail.subject, /تم استلام طلب التطوع/); assert.match(mail.body_text, /تنظيم الفعاليات، التصوير والتغطية الإعلامية/); assert.match(mail.body_text, /كلاهما/);
  const note = C.lastMail(COMMITTEE, 'volunteer_committee');
  assert.match(note.subject, /New volunteer registration — Vol Person/); assert.match(note.body_text, /Event organisation, Photography and media coverage/);
  const v = await C.verify(C.linkIn(mail));
  const me = await C.call('GET', '/api/me', { cookie: v.cookie });
  assert.equal(me.body.member, false); assert.equal(me.body.membership, null); assert.equal(me.body.volunteer.place, 'both'); assert.equal(me.body.mailingList, null);
  // a confirmed registration is changed only by its owner
  const stranger = await vol({ name: 'Mallory', areas: ['admin'], place: 'remote' });
  assert.equal(stranger.body.result, 'volunteer_already'); assert.equal(stranger.body.needsSignIn, true); assert.equal(stranger.body.volunteer, null);
  const own = await vol({ areas: ['admin'], place: 'remote', consent_news: true, phone: '+44 7700 900000', whatsapp: true }, v.cookie);
  assert.equal(own.body.result, 'volunteer_updated'); assert.deepEqual(own.body.volunteer.areas, ['admin']); assert.equal(own.body.volunteer.place, 'remote');
  assert.equal((await q(db, "SELECT source FROM oss_subscribers WHERE email = 'vol@example.org'"))[0].source, 'volunteer', 'the news opt-in is a separate, explicit choice');
  // the desk lists volunteers and exports them
  const list = await C.call('GET', '/api/admin/volunteers', { cookie: root });
  assert.equal(list.body.volunteers.find((x) => x.email === 'vol@example.org').place, 'remote'); assert.equal((await C.call('GET', '/api/admin/volunteers')).status, 401);
  assert.match((await C.call('GET', '/api/admin/volunteers.csv', { cookie: root })).body, /vol@example\.org,Vol Person,,'\+44 7700 900000,admin,remote,yes,ar,[^,]+,yes/);
  // a membership applicant may offer to volunteer on the same form: that becomes its own registration
  await apply({ email: 'both@example.org', name: 'Both Things', volunteerAreas: ['welcome', 'nope'] });
  assert.deepEqual((await q(db, "SELECT areas, place, name FROM oss_volunteers WHERE email = 'both@example.org'"))[0], { areas: ['welcome'], place: 'both', name: 'Both Things' });
  assert.equal((await q(db, "SELECT count(*)::int AS n FROM oss_volunteers WHERE email = 'd-saudi@example.org'"))[0].n, 0, 'volunteering stays optional for members');
  // withdrawing removes the registration and nothing else
  assert.equal((await C.call('POST', '/api/volunteer/withdraw')).status, 401);
  const gone = await C.call('POST', '/api/volunteer/withdraw', { cookie: v.cookie, body: {} });
  assert.equal(gone.body.volunteer, null); assert.equal(gone.body.mailingList.subscribed, true);
});

test('free-membership assessment: asked for by choice, no fee while it is open, and nothing is active before payment or eligibility is confirmed', async () => {
  const stage = async (email) => (await C.call('GET', '/api/membership/me', { cookie: await C.signIn(email) })).body.member;
  // a paid applicant who does not ask is never asked about nationality
  const plain = await apply({ tier: 'associate', email: 'e-plain@example.org', status: 'supporter', confirm_saudi: false });
  assert.equal(plain.status, 200); assert.equal(plain.body.member.eligibility, 'not_required');
  // asking for the assessment needs the nationality confirmation
  const noconf = await apply({ tier: 'external', email: 'e-ask@example.org', status: 'masters', uniPlace: 'uk_university', org: 'University of Reading', freeAssess: true, confirm_saudi: false });
  assert.equal(noconf.status, 400); assert.deepEqual(noconf.body.fields, { confirmSaudi: 'required' });
  const ask = await apply({ tier: 'external', email: 'e-ask@example.org', name: 'Ask Person', status: 'masters', uniPlace: 'uk_university', org: 'University of Reading', freeAssess: true });
  assert.equal(ask.status, 200); assert.equal(ask.body.member.eligibility, 'review'); assert.equal(ask.body.member.stage, 'eligibility'); assert.deepEqual(ask.body.member.stageLabel, { en: 'Awaiting eligibility check', ar: 'بانتظار التحقق من الأهلية' });
  assert.equal(ask.body.member.paymentStatus, 'on_hold', 'no fee is asked while eligibility is under review');
  const got = C.lastMail('e-ask@example.org', 'membership_received');
  assert.match(got.body_text, /Awaiting eligibility check/); assert.match(got.body_text, /will not be asked to pay anything while it is under review/); assert.doesNotMatch(got.body_text, /treasurer|payment reference/);
  assert.match(C.lastMail(COMMITTEE, 'membership_committee').subject, /eligibility check needed/);
  const no = ask.body.member.memberNo;
  assert.equal((await desk(no, 'approve')).body.error, 'eligibility_review_open', 'the check is settled before anything is approved');
  assert.equal((await desk(no, 'update', { eligibility: 'maybe' })).status, 400);
  // not eligible → the application carries on in its own category and the fee is asked for now
  const noGo = await desk(no, 'update', { eligibility: 'not_eligible' });
  assert.equal(noGo.body.member.eligibility, 'not_eligible'); assert.equal(noGo.body.member.payment_status, 'due'); assert.equal(noGo.body.member.tier, 'external');
  const told = C.lastMail('e-ask@example.org', 'membership_eligibility');
  assert.match(told.body_text, /could not confirm that you qualify/); assert.match(told.body_text, /£10 per year/);
  assert.equal((await stage('e-ask@example.org')).stage, 'awaiting_payment');
  assert.equal((await desk(no, 'approve')).body.error, 'payment_required', 'a paid membership is not activated before payment is confirmed');
  await desk(no, 'update', { paymentStatus: 'received' });
  assert.equal((await stage('e-ask@example.org')).stage, 'verifying');
  const act = await desk(no, 'approve');
  assert.equal(act.body.member.status, 'approved'); assert.equal((await stage('e-ask@example.org')).stage, 'active'); assert.deepEqual((await stage('e-ask@example.org')).stageLabel, { en: 'Membership active', ar: 'العضوية فعّالة' });
  // eligible → the application becomes a free Saudi Oxford Community Membership
  const yes = await apply({ tier: 'associate', email: 'e-yes@example.org', name: 'Yes Person', status: 'professional', org: 'Example Ltd', role: 'Analyst', freeAssess: true, lang: 'ar' });
  assert.equal(yes.body.member.amountGbp, 15); assert.equal(yes.body.member.paymentStatus, 'on_hold');
  const conv = await desk(yes.body.member.memberNo, 'update', { eligibility: 'confirmed' });
  assert.equal(conv.body.member.tier, 'saudi'); assert.equal(conv.body.member.amount_gbp, 0); assert.equal(conv.body.member.payment_status, 'not_required'); assert.equal(conv.body.member.uni_status, 'oxford_professional'); assert.equal(conv.body.member.eligibility, 'confirmed');
  assert.match(C.lastMail('e-yes@example.org', 'membership_eligibility').body_text, /أكدت اللجنة أهليتك/);
  assert.equal((await desk(yes.body.member.memberNo, 'approve')).body.error, 'eligibility_required');
  assert.equal((await desk(yes.body.member.memberNo, 'approve', { eligibilityConfirmed: true })).body.member.status, 'approved');
  assert.equal((await q(db, "SELECT nationality_status FROM oss_members WHERE email = 'e-yes@example.org'"))[0].nationality_status, 'verified');
  // "Other Oxford connection" in the free category goes to manual review; residence alone is not a connection
  const miss = await apply({ email: 'e-other@example.org', status: 'other_connection', uniChoice: '', college: '' });
  assert.equal(miss.status, 400); assert.deepEqual(miss.body.fields, { connection: 'required' });
  const oth = await apply({ email: 'e-other@example.org', name: 'Other Person', status: 'other_connection', connection: '  I   live in Oxford. ', uniChoice: '', college: '' });
  assert.equal(oth.body.member.eligibility, 'review'); assert.equal(oth.body.member.stage, 'eligibility'); assert.equal(oth.body.member.amountGbp, 0);
  assert.equal((await q(db, "SELECT connection FROM oss_members WHERE email = 'e-other@example.org'"))[0].connection, 'I live in Oxford.');
  const no2 = await desk(oth.body.member.memberNo, 'update', { eligibility: 'not_eligible' });
  assert.equal(no2.body.member.tier, 'saudi'); assert.match(C.lastMail('e-other@example.org', 'membership_eligibility').body_text, /welcome to join as an Associate Member \(£15 per year\)/);
  // a waived fee counts as settled
  const code = (await C.call('POST', '/api/admin/fee-codes', { cookie: root, body: {} })).body.created;
  const waived = await apply({ tier: 'student', email: 'e-waived@example.org', status: 'masters', feeCode: code, confirm_saudi: false });
  assert.equal((await desk(waived.body.member.memberNo, 'approve')).body.member.status, 'approved');
});

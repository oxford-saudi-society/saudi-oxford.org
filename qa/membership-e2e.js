// Membership lifecycle in a real browser against the dev server (dist + API + PostgreSQL):
// apply (EN + AR) → numbers and queue places → desk queue → request info → applicant answers in /account/
// → committee verifies + approves → applicant sees an active membership; decline another.
// Prereq: qa/dev-reset.sh (fresh DB, MAIL_PROVIDER=file, ADMIN_BOOTSTRAP_EMAILS=admin@example.org)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const BASE = 'http://127.0.0.1:8788', MAIL = '/tmp/oss-mail.jsonl';
let n = 0, fails = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log('  FAIL', m); } };
const shot = (p, name, full) => p.screenshot({ path: path.join(__dirname, 'shots', name + '.png'), fullPage: !!full });
const mails = () => (fs.existsSync(MAIL) ? fs.readFileSync(MAIL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const link = (to, kind) => { const m = [...mails()].reverse().find((x) => x.to === to && (!kind || x.kind === kind)); const r = m && /https?:\/\/\S+verify\?t=\S+/.exec(m.text); return r ? r[0] : null; };
async function applyAs(p, lang, tier, name, email) {
  await p.goto(BASE + (lang === 'ar' ? '/ar' : '') + '/join/'); await p.waitForTimeout(400);
  await p.check(`input[name=tier][value=${tier}]`, { force: true });
  await p.fill('#f-name', name); await p.fill('#f-email', email); await p.fill('#f-sso', 'hert1234'); await p.fill('#f-college', 'Hertford College'); await p.locator('#statuses label', { has: p.locator('input[value=dphil]') }).click(); await p.check('#f-consent', { force: true });
  await p.click('#submit-btn'); await p.waitForTimeout(1500);
  return p.evaluate(() => ({ no: (document.getElementById('mno') || {}).textContent, q: (document.querySelector('.qno') || {}).textContent, st: (document.querySelector('.mstate') || {}).textContent, fail: !!(document.getElementById('join-fail') && !document.getElementById('join-fail').hidden) }));
}
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const desk = await (await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })).newPage(); desk.on('pageerror', (e) => errors.push('desk: ' + e.message));
  const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage(); phone.on('pageerror', (e) => errors.push('phone: ' + e.message));
  const other = await (await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })).newPage(); other.on('pageerror', (e) => errors.push('other: ' + e.message));

  const a1 = await applyAs(phone, 'en', 'saudi', 'Hassan Bucklain', 'hassan@example.org');
  ok(/^OSS-\d{4}-0001$/.test(a1.no) && a1.q === '1' && /Pending/.test(a1.st), 'first applicant: number + place 1 ' + JSON.stringify(a1));
  await shot(phone, 'm-phone-confirm-en', true);
  const a2 = await applyAs(other, 'ar', 'student', 'سارة أحمد', 'sara@example.org');
  ok(/^OSS-\d{4}-0002$/.test(a2.no) && a2.q === '٢', 'second applicant (Arabic): number + place ٢ ' + JSON.stringify(a2));
  const again = await applyAs(other, 'en', 'student', 'Sara Ahmed', 'sara@example.org');
  ok(again.no === a2.no && !again.fail, 'same email again → same number, no duplicate ' + JSON.stringify(again));
  ok(await other.evaluate(() => /Application updated/i.test(document.getElementById('join-done').textContent)), 'the form sent again with different answers shows "Application updated"');

  // committee desk
  await desk.goto(BASE + '/admin/events/'); await desk.waitForTimeout(600);
  await desk.fill('#si-email', 'admin@example.org'); await desk.click('#si-btn'); await desk.waitForTimeout(1000);
  await desk.goto(link('admin@example.org', 'login_link')); await desk.waitForTimeout(1500);
  let v = await desk.evaluate(() => ({ hash: location.hash, rows: Array.from(document.querySelectorAll('.mtbl tbody tr')).map((r) => r.children[0].textContent.trim() + ' ' + r.children[1].textContent.trim()) }));
  ok(v.rows.length === 2 && v.rows[0].startsWith('1 ') && v.rows[1].startsWith('2 '), 'desk lands on the review queue in order ' + JSON.stringify(v));
  await shot(desk, 'm-desk-queue');
  await desk.click('.mtbl tbody tr:first-child'); await desk.waitForTimeout(1000);
  await shot(desk, 'm-desk-detail', true);
  await desk.click('details.mact-d:nth-of-type(2) summary'); await desk.waitForTimeout(200);
  await desk.click('[data-tpl="nat"]'); await desk.waitForTimeout(100);
  ok(/passport/.test(await desk.inputValue('#ma-msg')), 'template fills the message');
  await desk.click('[data-act="request-info"]'); await desk.waitForTimeout(1200);
  v = await desk.evaluate(() => ({ flash: document.getElementById('flash').textContent, badge: document.querySelector('.app-head .badge').textContent }));
  ok(/Question sent/.test(v.flash) && /Question sent/.test(v.badge), 'request info: status updated ' + JSON.stringify(v));

  // applicant answers from their account (the confirmation email link signs them in)
  await phone.goto(link('hassan@example.org', 'membership_received')); await phone.waitForTimeout(1500);
  v = await phone.evaluate(() => ({ path: location.pathname, no: (document.querySelector('.mem-pane .mno') || {}).textContent, st: (document.querySelector('.mem-pane .mstate') || {}).textContent, q: !!document.getElementById('mem-q') }));
  ok(v.path === '/account/' && /OSS-/.test(v.no) && /question/i.test(v.st) && v.q, 'account shows the question ' + JSON.stringify(v));
  await shot(phone, 'm-phone-account-question', true);
  await phone.fill('#mem-ans', 'I have emailed my passport photo to the membership address.'); await phone.click('#mem-q button[type=submit]'); await phone.waitForTimeout(1200);
  v = await phone.evaluate(() => ({ alert: (document.querySelector('.alert.ok') || {}).textContent, st: document.querySelector('.mem-pane .mstate').textContent, pos: Array.from(document.querySelectorAll('.mem-pane .mcard-meta b')).map((x) => x.textContent) }));
  ok(/Thank you/.test(v.alert) && /Pending/.test(v.st) && v.pos.includes('1'), 'answer sent, back to pending at place 1 ' + JSON.stringify(v));

  // committee verifies nationality and approves
  await desk.reload(); await desk.waitForTimeout(1200);
  ok(/emailed my passport/.test(await desk.textContent('#view')), 'desk shows the applicant\'s answer');
  await desk.selectOption('#mc-nat', 'verified'); await desk.click('#mchecks button[type=submit]'); await desk.waitForTimeout(1000);
  await desk.click('[data-act="approve"]'); await desk.waitForTimeout(1200);
  v = await desk.evaluate(() => ({ flash: document.getElementById('flash').textContent, badge: document.querySelector('.app-head .badge').textContent, dialog: !!document.querySelector('dialog.confirm[open]') }));
  ok(/Approved/.test(v.flash) && /Active/.test(v.badge) && !v.dialog, 'approved without warnings once checks are done ' + JSON.stringify(v));
  await shot(desk, 'm-desk-approved', true);
  await phone.reload(); await phone.waitForTimeout(1200);
  ok(/Active member/.test(await phone.textContent('.mem-pane .mstate')), 'applicant sees an active membership');
  await shot(phone, 'm-phone-account-active', true);
  ok(mails().some((m) => m.to === 'hassan@example.org' && m.kind === 'membership_approved'), 'approval email written');

  // decline the second applicant (warns first because the fee is due)
  await desk.goto(BASE + '/admin/events/#membership'); await desk.waitForTimeout(1200);
  await desk.click('.mtbl tbody tr:first-child'); await desk.waitForTimeout(1000);
  await desk.click('details.mact-d:nth-of-type(3) summary'); await desk.fill('#ma-dec', 'Please apply with your University email address.');
  await desk.click('[data-act="decline"]'); await desk.waitForTimeout(1200);
  ok(/Declined/.test(await desk.textContent('.app-head .badge')), 'declined');
  ok(mails().some((m) => m.to === 'sara@example.org' && m.kind === 'membership_declined' && /University email/.test(m.text)), 'decline email with reason (Arabic applicant)');
  await desk.goto(BASE + '/ar/admin/events/#membership/all'); await desk.waitForTimeout(1400);
  ok(await desk.evaluate(() => document.documentElement.dir === 'rtl' && document.querySelectorAll('.mtbl tbody tr').length === 2), 'Arabic register lists both');
  await shot(desk, 'm-desk-register-ar');
  // status "Other": one tap opens the text box inside the card; it must be filled before sending
  await phone.goto(BASE + '/join/'); await phone.waitForTimeout(400);
  await phone.check('input[name=tier][value=friend]', { force: true });
  await phone.locator('#statuses label.stat-other').click(); await phone.waitForTimeout(200);
  let o = await phone.evaluate(() => ({ sel: document.querySelector('#statuses .stat-other').classList.contains('sel'), shown: getComputedStyle(document.querySelector('.stat-other .oth')).display !== 'none', focused: document.activeElement && document.activeElement.id === 'f-status-other' }));
  ok(o.sel && o.shown && o.focused, 'Other card selected, text box shown and focused ' + JSON.stringify(o));
  await phone.fill('#f-name', 'Layla Other'); await phone.fill('#f-email', 'layla@example.org'); await phone.fill('#f-college', 'Oxford Brookes University'); await phone.check('#f-consent', { force: true });
  await phone.click('#submit-btn'); await phone.waitForTimeout(600);
  ok(await phone.evaluate(() => document.querySelector('[data-f=status]').classList.contains('err') && !document.getElementById('join-done').textContent.trim()), 'empty Other text blocks sending');
  await phone.fill('#f-status-other', 'Oxford Brookes student');
  await phone.locator('#statuses label', { has: phone.locator('input[value=masters]') }).click(); await phone.waitForTimeout(150);
  ok(await phone.evaluate(() => getComputedStyle(document.querySelector('.stat-other .oth')).display === 'none' && document.querySelectorAll('#statuses .stat.sel').length === 1), 'choosing another card closes the Other box (one selection only)');
  await phone.locator('#statuses label.stat-other').click(); await phone.waitForTimeout(150);
  await shot(phone, 'm-phone-status-other');
  await phone.click('#submit-btn'); await phone.waitForTimeout(1500);
  ok(await phone.evaluate(() => /^OSS-\d{4}-\d{4}$/.test((document.getElementById('mno') || {}).textContent || '')), 'Other applicant gets a number');
  ok(mails().some((m) => m.kind === 'membership_committee' && /Other: Oxford Brookes student/.test(m.text)), 'committee notice shows the typed status');
  ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await b.close();
  console.log(`${n} checks, ${fails} failures`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

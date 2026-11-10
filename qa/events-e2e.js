// End-to-end: real browser (system Chrome) against the dev server (dist + API on PostgreSQL).
// Prereq: qa/dev-server.mjs running on :8788 with MAIL_PROVIDER=file MAIL_FILE=/tmp/oss-mail.jsonl ADMIN_BOOTSTRAP_EMAILS=admin@example.org
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8788';
const MAIL = process.env.MAIL_FILE || '/tmp/oss-mail.jsonl';
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('  FAIL', m); } };
const shot = (p, name) => p.screenshot({ path: path.join(__dirname, 'shots', name + '.png'), fullPage: true });
function mails() { return fs.existsSync(MAIL) ? fs.readFileSync(MAIL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []; }
function lastLink(to, kind) { const m = [...mails()].reverse().find((x) => x.to === to && (!kind || x.kind === kind)); const r = m && /https?:\/\/\S+verify\?t=\S+/.exec(m.text); return r ? r[0] : null; }
const uniq = Date.now().toString(36);
const USER = `user-${uniq}@example.org`, ADMIN = 'admin@example.org', MEMBER = `member-${uniq}@example.org`;

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const desk = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const phone = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const errors = [];
  const pd = await desk.newPage(); pd.on('pageerror', (e) => errors.push('desk: ' + e.message));
  const pp = await phone.newPage(); pp.on('pageerror', (e) => errors.push('phone: ' + e.message));

  // 1. public index hydrates from the API
  await pd.goto(BASE + '/events/'); await pd.waitForTimeout(800);
  const hyd = await pd.evaluate(() => ({ n: document.querySelectorAll('.evc').length, api: !!document.querySelector('.evc[data-status]') }));
  ok(hyd.n === 11, 'index shows 11 cards');

  // 2. register interest on the phone → email link → banner + account
  await pp.goto(BASE + '/events/michaelmas-term-welcome/'); await pp.waitForTimeout(600);
  await pp.click('#reg-cta'); await pp.waitForTimeout(300);
  await pp.fill('#reg-name', 'Phone Person'); await pp.fill('#reg-email', USER); await pp.check('#reg-privacy');
  await pp.click('#reg-submit'); await pp.waitForTimeout(1500);
  const done = await pp.evaluate(() => ({ hidden: document.getElementById('reg-done').hidden, title: document.getElementById('reg-done-title').textContent, text: document.getElementById('reg-done-text').textContent }));
  ok(!done.hidden && /Check your email/.test(done.title) && /not a ticket/.test(done.text), 'interest → check-your-email panel: ' + JSON.stringify(done));
  await shot(pp, 'e2e-phone-interest-done');
  const link = lastLink(USER, 'verify_interest'); ok(!!link, 'verification email written');
  await pp.goto(link); await pp.waitForTimeout(800);
  const after = await pp.evaluate(() => ({ url: location.pathname + location.search, banner: document.getElementById('reg-state').textContent, cta: document.getElementById('reg-cta').textContent, disabled: document.getElementById('reg-cta').disabled }));
  ok(/\/events\/michaelmas-term-welcome\/$/.test(after.url) && /registered your interest only/.test(after.banner), 'verified → banner, clean url: ' + JSON.stringify(after));
  await pp.waitForTimeout(600);
  ok(await pp.evaluate(() => document.getElementById('reg-cta').disabled), 'CTA reflects existing interest after hydration');
  await shot(pp, 'e2e-phone-interest-verified');
  await pp.goto(BASE + '/account/'); await pp.waitForTimeout(1000);
  const acct = await pp.evaluate(() => ({ cards: document.querySelectorAll('.regc').length, badge: (document.querySelector('.regc .badge') || {}).textContent, who: (document.querySelector('.who') || {}).textContent }));
  ok(acct.cards === 1 && /Interest registered/.test(acct.badge) && acct.who.includes(USER), 'account lists the interest: ' + JSON.stringify(acct));
  await shot(pp, 'e2e-phone-account');
  // Arabic account page
  await pp.goto(BASE + '/ar/account/'); await pp.waitForTimeout(900);
  ok(await pp.evaluate(() => document.documentElement.dir === 'rtl' && /السجل/.test(document.body.textContent) && !/تسجيلاتي/.test(document.body.textContent)), 'Arabic account page is RTL and is called السجل');
  await shot(pp, 'e2e-phone-account-ar');

  // 3. committee desk: sign in with the bootstrap address, confirm + open an event
  await pd.goto(BASE + '/admin/events/'); await pd.waitForTimeout(800);
  ok(await pd.evaluate(() => !!document.getElementById('si')), 'desk shows staff sign-in');
  await shot(pd, 'e2e-desk-signin');
  await pd.fill('#si-email', ADMIN); await pd.click('#si-btn'); await pd.waitForTimeout(1200);
  const alink = lastLink(ADMIN, 'login_link'); ok(!!alink, 'staff sign-in link emailed');
  await pd.goto(alink); await pd.waitForTimeout(1500);
  await pd.goto(BASE + '/admin/events/#overview'); await pd.waitForTimeout(1200);
  const ov = await pd.evaluate(() => ({ path: location.pathname, rows: document.querySelectorAll('.tbl tbody tr').length, role: (document.querySelector('.who') || {}).textContent }));
  ok(/\/admin\/events\/$/.test(ov.path) && ov.rows === 11 && /super_admin/.test(ov.role), 'desk overview after sign-in: ' + JSON.stringify(ov));
  await shot(pd, 'e2e-desk-overview');
  await pd.goto(BASE + '/admin/events/#event/oss-002'); await pd.waitForTimeout(1200);
  await pd.selectOption('#f-status', 'confirmed'); await pd.click('#f-save'); await pd.waitForTimeout(1200);
  await pd.selectOption('#f-mode', 'open'); await pd.fill('#f-cap', '2'); await pd.click('#f-save'); await pd.waitForTimeout(1200);
  const ed = await pd.evaluate(() => { const w = document.querySelectorAll('.app-head .who'); return { flash: (document.getElementById('flash') || {}).textContent, who: w[w.length - 1].textContent }; });
  ok(/Saved/.test(ed.flash) && /Booking open/.test(ed.who), 'event confirmed and opened: ' + JSON.stringify(ed));
  await shot(pd, 'e2e-desk-event');

  // 4. public page now offers booking; the signed-in user books directly
  await pp.goto(BASE + '/events/hilary-term-welcome-gathering/'); await pp.waitForTimeout(1000);
  const cta = await pp.evaluate(() => ({ key: document.getElementById('reg-cta').dataset.key, text: document.getElementById('reg-cta').textContent, disabled: document.getElementById('reg-cta').disabled, seats: document.getElementById('reg-state').textContent }));
  ok(cta.key === 'book' && !cta.disabled && /Book now/.test(cta.text), 'CTA hydrated to Book now: ' + JSON.stringify(cta));
  await shot(pp, 'e2e-phone-book-cta');
  await pp.click('#reg-cta'); await pp.waitForTimeout(300);
  ok(await pp.evaluate(() => document.getElementById('reg-email').value) === USER, 'dialog pre-fills the signed-in email');
  await pp.fill('#reg-name', 'Phone Person'); await pp.check('#reg-privacy'); await pp.click('#reg-submit'); await pp.waitForTimeout(1500);
  const bk = await pp.evaluate(() => ({ title: document.getElementById('reg-done-title').textContent, link: document.getElementById('reg-done-link').hidden }));
  ok(/Registration confirmed/.test(bk.title) && !bk.link, 'signed-in booking confirmed immediately: ' + JSON.stringify(bk));
  await shot(pp, 'e2e-phone-booked');
  const conf = [...mails()].reverse().find((m) => m.to === USER && m.kind === 'booking_confirmed'); ok(!!conf, 'confirmation email written');
  const ticketUrl = conf && /https?:\/\/\S+\/t\/[A-Za-z0-9_-]+/.exec(conf.text)[0];
  await pp.goto(ticketUrl); await pp.waitForTimeout(1000);
  const tk = await pp.evaluate(() => ({ qr: !!document.querySelector('.ticket .qr svg'), state: (document.querySelector('.ticket .state') || {}).textContent, name: (document.querySelector('.ticket .name') || {}).textContent, email: document.body.textContent.includes('@example.org') }));
  ok(tk.qr && /Valid/.test(tk.state) && tk.name === 'Phone P.' && !tk.email, 'ticket page: QR, valid, first name only: ' + JSON.stringify(tk));
  await shot(pp, 'e2e-phone-ticket');

  // 5. check-in from the desk: paste the ticket code → admitted → duplicate
  const token = ticketUrl.split('/t/')[1];
  await pd.goto(BASE + '/admin/events/#checkin/oss-002'); await pd.waitForTimeout(1200);
  await pd.fill('#ci-code', 'OSS1:' + token); await pd.click('#code-f button[type=submit]'); await pd.waitForTimeout(1000);
  let ci = await pd.evaluate(() => ({ cls: document.getElementById('ci-res').className, txt: document.getElementById('ci-res').textContent, tally: (document.getElementById('tally') || {}).textContent }));
  ok(/admitted/.test(ci.cls) && /Phone P\./.test(ci.txt) && /1 of 1/.test(ci.tally), 'check-in admitted: ' + JSON.stringify(ci));
  await shot(pd, 'e2e-desk-checkin-admitted');
  await pd.fill('#ci-code', token); await pd.click('#code-f button[type=submit]'); await pd.waitForTimeout(1000);
  ci = await pd.evaluate(() => ({ cls: document.getElementById('ci-res').className, txt: document.getElementById('ci-res').textContent }));
  ok(/duplicate/.test(ci.cls) && /Already checked in/.test(ci.txt), 'second scan → duplicate: ' + JSON.stringify(ci));
  await pp.reload(); await pp.waitForTimeout(900);
  ok(/Checked in/.test(await pp.evaluate(() => document.querySelector('.ticket .state').textContent)), 'ticket page shows checked in');

  // 6. roster + CSV + members + mail queue + audit render; Arabic desk
  await pd.goto(BASE + '/admin/events/#roster/oss-002'); await pd.waitForTimeout(1200);
  const ro = await pd.evaluate(() => ({ rows: document.querySelectorAll('.tbl tbody tr').length, csv: !!document.querySelector('a[href$="registrations.csv"]'), badge: (document.querySelector('.tbl .badge') || {}).textContent }));
  ok(ro.rows === 1 && ro.csv && /Checked in/.test(ro.badge), 'roster: ' + JSON.stringify(ro));
  await shot(pd, 'e2e-desk-roster');
  const csv = await pd.evaluate(async () => { const r = await fetch('/api/admin/events/oss-002/registrations.csv'); return { status: r.status, text: await r.text() }; });
  ok(csv.status === 200 && /name,email,kind,status/.test(csv.text) && /Phone Person/.test(csv.text), 'CSV export via session');
  await pd.goto(BASE + '/admin/events/#membership-add'); await pd.waitForTimeout(1000);
  await pd.fill('#m-email', MEMBER); await pd.fill('#m-name', 'Member Test'); await pd.click('#mf button[type=submit]'); await pd.waitForTimeout(1000);
  ok(await pd.evaluate((m) => document.body.textContent.includes(m), MEMBER), 'member added appears in the list');
  await shot(pd, 'e2e-desk-members');
  await pd.goto(BASE + '/admin/events/#mail'); await pd.waitForTimeout(1000);
  ok(await pd.evaluate(() => document.querySelectorAll('.tbl tbody tr').length) >= 3, 'mail queue lists messages');
  await shot(pd, 'e2e-desk-mail');
  await pd.goto(BASE + '/admin/events/#comms/oss-002'); await pd.waitForTimeout(1000);
  await pd.fill('#c-sen', 'Parking'); await pd.fill('#c-ben', 'Please use the side entrance.'); await pd.fill('#c-sar', 'المواقف'); await pd.fill('#c-bar', 'يرجى استخدام المدخل الجانبي.'); await pd.click('#c-prev'); await pd.waitForTimeout(1000);
  ok(await pd.evaluate(() => !!document.getElementById('c-send') && /Preview — 1/.test(document.getElementById('c-out').textContent)), 'notice preview shows recipient count');
  await shot(pd, 'e2e-desk-comms');
  await pd.goto(BASE + '/admin/events/#audit'); await pd.waitForTimeout(1000);
  ok(await pd.evaluate(() => document.querySelectorAll('.tbl tbody tr').length) >= 5, 'audit log renders');
  await pd.goto(BASE + '/ar/admin/events/#overview'); await pd.waitForTimeout(1200);
  ok(await pd.evaluate(() => document.documentElement.dir === 'rtl' && document.querySelectorAll('.tbl tbody tr').length === 11), 'Arabic desk overview');
  await shot(pd, 'e2e-desk-overview-ar');
  // check-in staff scoped role cannot edit
  await pd.goto(BASE + '/admin/events/#staff'); await pd.waitForTimeout(1000);
  ok(await pd.evaluate(() => document.querySelectorAll('.tbl tbody tr').length) >= 1, 'staff list renders');
  await shot(pd, 'e2e-desk-staff');

  // 7. sign out
  await pp.goto(BASE + '/account/'); await pp.waitForTimeout(900);
  await pp.click('#signout'); await pp.waitForTimeout(900);
  ok(await pp.evaluate(() => !!document.getElementById('si')), 'sign-out returns to the sign-in form');

  ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await b.close();
  console.log(`${n} checks, ${fails} failures`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

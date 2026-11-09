// Membership pages in a real browser with the proof-of-nationality upload switched OFF (as on the site now):
// Saudi applicants are told the secretary will email later and are offered no upload; other membership types see
// nothing about nationality; sending the form again with another type updates the application. Also: the 3-step
// join page, the styled college list, the language switch on every page type, and the single ideas-board button.
// Prereq: qa/dev-reset.sh
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const BASE = 'http://127.0.0.1:8788', MAIL = '/tmp/oss-mail.jsonl';
let n = 0, fails = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log('  FAIL', m); } };
const shot = (p, name, full) => p.screenshot({ path: path.join(__dirname, 'shots', name + '.png'), fullPage: !!full });
const mails = () => (fs.existsSync(MAIL) ? fs.readFileSync(MAIL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const lastMail = (to, kind) => [...mails()].reverse().find((x) => x.to === to && (!kind || x.kind === kind));
const link = (to, kind) => { const m = lastMail(to, kind); const r = m && /https?:\/\/\S+verify\?t=\S+/.exec(m.text); return r ? r[0] : null; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage(); phone.on('pageerror', (e) => errors.push('phone: ' + e.message));
  const desk = await (await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })).newPage(); desk.on('pageerror', (e) => errors.push('desk: ' + e.message));

  // ── join page: exactly three steps, numbered once; no unavailable payment methods; no hardship/privilege claims
  await phone.goto(BASE + '/ar/join/'); await phone.waitForTimeout(400);
  let j = await phone.evaluate(() => ({ steps: Array.from(document.querySelectorAll('#steps li')).map((li) => li.textContent.trim()), nums: Array.from(document.querySelectorAll('#steps li .k')).map((k) => getComputedStyle(k, '::before').content), text: document.getElementById('main').innerText }));
  ok(j.steps.length === 3 && j.steps.every((s) => !/^\d|^[٠-٩]/.test(s)), 'three steps, no number in the text itself ' + JSON.stringify(j.steps));
  ok(j.nums.length === 3 && j.nums.every((c) => /counter\(step, arabic-indic\)/.test(c)), 'step numbers drawn once by CSS, in Arabic numerals ' + JSON.stringify(j.nums));
  ok(!/صندوق للمساعدة|بالبطاقة|شهادة تقدير|حق التصويت|إنستغرام/.test(j.text), 'no hardship fund, card payment, certificate, voting or Instagram claims');
  await phone.check('input[name=tier][value=saudi]', { force: true });
  await phone.fill('#f-name', 'نورة العتيبي'); await phone.fill('#f-email', 'noura@example.org');
  // Oxford SSO username: Arabic label and placeholder, needed for the student types only, 4 letters + 4 digits
  let so = await phone.evaluate(() => { const i = document.getElementById('f-sso'), f = i.closest('.f'); return { label: f.querySelector('.lbl span').textContent, ph: i.placeholder, phColor: getComputedStyle(i, '::placeholder').color, inkColor: getComputedStyle(i).color, emptyDir: getComputedStyle(i).direction, star: !document.getElementById('sso-req').hidden, opt: !document.getElementById('sso-opt').hidden, required: i.required }; });
  ok(so.label === 'معرّف الدخول الموحّد (SSO)' && so.ph === 'مثال: abcd1234' && so.emptyDir === 'rtl', 'Arabic label and placeholder, shown right-to-left ' + JSON.stringify(so));
  ok(so.phColor !== so.inkColor && /0\.3\d*\)$/.test(so.phColor), 'placeholder is a subtle grey, lighter than typed text: ' + so.phColor + ' vs ' + so.inkColor);
  ok(so.star && !so.opt && so.required, 'Saudi student type: the username is required (star shown)');
  await phone.check('input[name=tier][value=associate]', { force: true });
  ok(await phone.evaluate(() => document.getElementById('sso-req').hidden && !document.getElementById('sso-opt').hidden && !document.getElementById('f-sso').required), 'non-student type: optional');
  await phone.check('input[name=tier][value=student]', { force: true });
  ok(await phone.evaluate(() => !document.getElementById('sso-req').hidden && document.getElementById('f-sso').required), 'student type: required again');
  await phone.check('input[name=tier][value=saudi]', { force: true });
  await phone.tap('#f-sso'); await phone.keyboard.type('HE rt-12'); await phone.waitForTimeout(100);
  so = await phone.evaluate(() => { const i = document.getElementById('f-sso'); return { v: i.value, dir: getComputedStyle(i).direction, phGone: !i.matches(':placeholder-shown') }; });
  ok(so.v === 'hert12' && so.dir === 'ltr' && so.phGone, 'typing clears the placeholder; letters and digits only, lower case, left-to-right ' + JSON.stringify(so));
  await phone.tap('#f-name'); await phone.waitForTimeout(150);
  ok(await phone.evaluate(() => document.querySelector('[data-f=sso]').classList.contains('err') && getComputedStyle(document.querySelector('[data-f=sso] .msg')).display !== 'none'), 'an incomplete username shows the format message');
  await phone.fill('#f-sso', 'hert1234');
  ok(await phone.evaluate(() => !document.querySelector('[data-f=sso]').classList.contains('err')), 'a correct username clears the message');
  // college field: the suggestions are the page's own list, styled like the field (not the browser's built-in one)
  await phone.tap('#f-college'); await phone.waitForTimeout(200); await phone.keyboard.type('hert'); await phone.waitForTimeout(200);
  const cb = await phone.evaluate(() => { const l = document.getElementById('college-list'), i = document.getElementById('f-college'), ls = getComputedStyle(l), is = getComputedStyle(i); return { native: i.hasAttribute('list'), open: !l.hidden, items: Array.from(l.children).map((x) => x.textContent), sameRadius: ls.borderRadius === is.borderRadius, sameFont: ls.fontSize === is.fontSize && ls.fontFamily === is.fontFamily, dark: ls.backgroundColor, sameWidth: Math.abs(l.getBoundingClientRect().width - i.getBoundingClientRect().width) < 1 }; });
  ok(!cb.native && cb.open && cb.items.length === 1 && cb.items[0] === 'Hertford College' && cb.sameRadius && cb.sameFont && cb.sameWidth && /rgba?\(6, 22, 46/.test(cb.dark), 'college suggestions use the field\'s own style ' + JSON.stringify(cb));
  await phone.keyboard.press('ArrowDown'); await phone.keyboard.press('Enter'); await phone.waitForTimeout(150);
  ok(await phone.evaluate(() => document.getElementById('f-college').value === 'Hertford College' && document.getElementById('college-list').hidden && !document.getElementById('join-form').hidden), 'a suggestion can be chosen from the keyboard without sending the form'); await phone.locator('#statuses label', { has: phone.locator('input[value=masters]') }).click(); await phone.check('#f-consent', { force: true });
  await phone.click('#submit-btn'); await phone.waitForTimeout(1500);
  j = await phone.evaluate(() => ({ no: (document.getElementById('mno') || {}).textContent, text: document.getElementById('join-done').innerText, links: Array.from(document.querySelectorAll('#join-done a')).map((x) => x.textContent.trim()) }));
  ok(/^OSS-\d{4}-0001$/.test(j.no), 'application received with a number ' + j.no);
  ok(/سيراسلك أمين سر مجلس إدارة الجمعية لاحقًا لطلب إثبات الجنسية السعودية عند الحاجة/.test(j.text) && !/ارفع|رفع/.test(j.text) && !j.links.some((t) => /ارفع/.test(t)), 'Saudi applicant: told the secretary will email later; nothing to upload');
  await shot(phone, 'p-join-done-ar', true);
  const no = j.no;
  const mail1 = (lastMail('noura@example.org', 'membership_received') || {}).text || '';
  ok(/سيراسلك أمين سر مجلس إدارة الجمعية لاحقًا/.test(mail1) && !/ارفع/.test(mail1), 'confirmation email says the same');

  // ── Saudi applicant's own page ("السجل"): the note, and no upload
  await phone.goto(link('noura@example.org', 'membership_received')); await phone.waitForTimeout(1500);
  let a = await phone.evaluate(() => ({ text: document.getElementById('app').innerText, upload: !!document.getElementById('mem-ev') || !!document.querySelector('input[type=file]'), title: document.title }));
  ok(!a.upload && /سيراسلك أمين سر مجلس إدارة الجمعية لاحقًا لطلب إثبات الجنسية السعودية عند الحاجة/.test(a.text), 'Saudi applicant page: secretary note, no upload control');
  ok(/السجل/.test(a.text) && /^السجل —/.test(a.title) && !/تسجيلات/.test(a.text), 'the page is called السجل (no "تسجيلاتي") — ' + a.title);
  await shot(phone, 'p-account-saudi-ar', true);
  let r = await phone.evaluate(async () => (await fetch('/api/membership/evidence', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mime: 'image/jpeg', data: 'AAAA' }) })).status);
  ok(r === 404, 'the upload route is closed: ' + r);

  // ── a non-Saudi applicant never sees anything about nationality
  const other = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage(); other.on('pageerror', (e) => errors.push('other: ' + e.message));
  const applyOn = async (p, tier, name, email) => { await p.goto(BASE + '/join/'); await p.waitForTimeout(400); await p.check('input[name=tier][value=' + tier + ']', { force: true }); await p.fill('#f-name', name); await p.fill('#f-email', email); if (tier === 'saudi' || tier === 'student') await p.fill('#f-sso', 'hert1234'); await p.fill('#f-college', 'Hertford College'); await p.locator('#statuses label', { has: p.locator('input[value=masters]') }).click(); await p.check('#f-consent', { force: true }); await p.click('#submit-btn'); await p.waitForTimeout(1500); return p.evaluate(() => document.getElementById('join-done').innerText); };
  let t = await applyOn(other, 'student', 'Maria Rossi', 'maria@example.org');
  ok(/Application received/i.test(t) && !/nationality|secretary|upload/i.test(t), 'non-Saudi confirmation says nothing about nationality');
  await other.goto(link('maria@example.org', 'membership_received')); await other.waitForTimeout(1500);
  a = await other.evaluate(() => ({ text: document.getElementById('app').innerText, upload: !!document.getElementById('mem-ev') || !!document.querySelector('input[type=file]') }));
  ok(!a.upload && !/nationality|secretary|upload/i.test(a.text) && /Student membership/.test(a.text), 'non-Saudi member page: no nationality note and no upload');
  await shot(other, 'p-account-nonsaudi-en', true);
  ok(!/nationality|upload/i.test((lastMail('maria@example.org', 'membership_received') || {}).text || 'nationality'), 'non-Saudi confirmation email says nothing about nationality');

  // ── chose "Saudi students" by mistake, then sends the form again as another type: the page follows the new choice
  const third = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage(); third.on('pageerror', (e) => errors.push('third: ' + e.message));
  t = await applyOn(third, 'saudi', 'John Smith', 'john@example.org');
  ok(/secretary will email you later/i.test(t), 'first as Saudi: secretary note');
  t = await applyOn(third, 'associate', 'John Smith', 'john@example.org');
  ok(/Application updated/i.test(t) && /Associate membership/.test(t) && !/nationality|secretary/i.test(t), 'sent again as Associate: application updated, nationality note gone');
  await third.goto(link('john@example.org', 'membership_changed')); await third.waitForTimeout(1500);
  a = await third.evaluate(() => document.getElementById('app').innerText);
  ok(/Associate membership/.test(a) && !/nationality|secretary|upload/i.test(a), 'their page now shows the Associate application only');

  // ── committee desk: no document panel while the upload is off; the request template asks by email
  await desk.goto(BASE + '/admin/events/'); await desk.waitForTimeout(600);
  await desk.fill('#si-email', 'admin@example.org'); await desk.click('#si-btn'); await desk.waitForTimeout(1000);
  await desk.goto(link('admin@example.org', 'login_link')); await desk.waitForTimeout(1500);
  await desk.goto(BASE + '/admin/events/#membership/' + no); await desk.waitForTimeout(1200);
  let d = await desk.evaluate(() => ({ pane: !!document.getElementById('mev'), text: document.body.innerText }));
  ok(!d.pane && /Saudi nationality/i.test(d.text), 'desk: no document panel; the nationality check box is still there');

  // ── fee codes: the committee creates one in the desk; on the join form it is accepted or declined at once
  await desk.goto(BASE + '/admin/events/#membership-codes'); await desk.waitForTimeout(1000);
  await desk.fill('#fc-label', 'Partner scholars'); await desk.fill('#fc-max', '1'); await desk.click('#fc-f button[type=submit]'); await desk.waitForTimeout(1200);
  const code = await desk.evaluate(() => (document.querySelector('.tbl tbody tr td b') || {}).textContent || '');
  ok(/^OSS-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code) && await desk.evaluate(() => /Code created/.test(document.getElementById('flash').innerText) && /0 \/ 1/.test(document.querySelector('.tbl tbody tr').innerText)), 'desk: code created and listed, unused — ' + code);
  await shot(desk, 'p-desk-codes', true);
  const fee = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage(); fee.on('pageerror', (e) => errors.push('fee: ' + e.message));
  await fee.goto(BASE + '/ar/join/'); await fee.waitForTimeout(400);
  ok(await fee.evaluate(() => document.getElementById('fee-code').hidden), 'no code field before a type is chosen');
  await fee.check('input[name=tier][value=saudi]', { force: true });
  ok(await fee.evaluate(() => document.getElementById('fee-code').hidden), 'no code field for a free type');
  await fee.check('input[name=tier][value=student]', { force: true });
  let fc = await fee.evaluate(() => { const f = document.getElementById('fee-code'), i = document.getElementById('f-fee-code'); return { shown: !f.hidden, label: f.querySelector('.lbl span').textContent, ph: i.placeholder, btn: document.getElementById('fee-code-btn').textContent, sum: document.getElementById('sum').innerText }; });
  ok(fc.shown && fc.label === 'رمز الإعفاء من الرسوم' && /OSS-ABCD-2345/.test(fc.ph) && fc.btn === 'تحقّق من الرمز' && /£10/.test(fc.sum), 'fee-paying type: Arabic code field appears ' + JSON.stringify(fc));
  await fee.fill('#f-fee-code', 'oss-nope-nope'); await fee.tap('#fee-code-btn'); await fee.waitForTimeout(900);
  fc = await fee.evaluate(() => ({ cls: document.getElementById('fee-code-state').className, text: document.getElementById('fee-code-state').innerText, sum: document.getElementById('sum').innerText, val: document.getElementById('f-fee-code').value }));
  ok(/is-bad/.test(fc.cls) && /رُفض الرمز/.test(fc.text) && /£10/.test(fc.sum) && fc.val === 'OSS-NOPE-NOPE', 'a wrong code is declined at once ' + JSON.stringify(fc));
  await shot(fee, 'p-code-declined-ar');
  await fee.fill('#f-fee-code', code.toLowerCase()); await fee.tap('#fee-code-btn'); await fee.waitForTimeout(900);
  fc = await fee.evaluate(() => ({ cls: document.getElementById('fee-code-state').className, text: document.getElementById('fee-code-state').innerText, sum: document.getElementById('sum').innerText }));
  ok(/is-ok/.test(fc.cls) && /تم قبول الرمز/.test(fc.text) && /لا توجد رسوم/.test(fc.sum) && !/£10/.test(fc.sum), 'the right code is accepted and the fee disappears ' + JSON.stringify(fc));
  await shot(fee, 'p-code-accepted-ar');
  await fee.fill('#f-name', 'ليلى حسن'); await fee.fill('#f-email', 'layla.code@example.org'); await fee.fill('#f-sso', 'hert1234'); await fee.fill('#f-college', 'Hertford College'); await fee.locator('#statuses label', { has: fee.locator('input[value=masters]') }).click(); await fee.check('#f-consent', { force: true });
  await fee.click('#submit-btn'); await fee.waitForTimeout(1500);
  t = await fee.evaluate(() => document.getElementById('join-done').innerText);
  ok(/أُعفيت من رسوم العضوية/.test(t) && !/£10|رسوم العضوية: /.test(t), 'confirmation: fee waived, nothing to pay');
  ok(/أُعفيت|إعفاؤك من رسوم العضوية/.test((lastMail('layla.code@example.org', 'membership_received') || {}).text || ''), 'confirmation email says the fee is waived');
  // the single use is spent: the next person is declined when sending the form, and nothing is saved
  const fee2 = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage();
  await fee2.goto(BASE + '/join/'); await fee2.waitForTimeout(400); await fee2.check('input[name=tier][value=associate]', { force: true });
  await fee2.fill('#f-fee-code', code); await fee2.fill('#f-name', 'Second Person'); await fee2.fill('#f-email', 'second.code@example.org'); await fee2.fill('#f-college', 'Hertford College'); await fee2.locator('#statuses label', { has: fee2.locator('input[value=staff]') }).click(); await fee2.check('#f-consent', { force: true });
  await fee2.click('#submit-btn'); await fee2.waitForTimeout(1500);
  fc = await fee2.evaluate(() => ({ state: document.getElementById('fee-code-state').innerText, done: !document.getElementById('join-done').hidden, form: !document.getElementById('join-form').hidden }));
  ok(/Code declined — this code has already been used/.test(fc.state) && !fc.done && fc.form, 'a used-up code is declined on sending and the form stays open ' + JSON.stringify(fc));
  await desk.goto(BASE + '/admin/events/#membership'); await desk.waitForTimeout(600); await desk.goto(BASE + '/admin/events/#membership-codes'); await desk.waitForTimeout(1000);
  ok(await desk.evaluate(() => /1 \/ 1/.test(document.querySelector('.tbl tbody tr').innerText) && /Used up/i.test(document.querySelector('.tbl tbody tr').innerText)), 'desk shows the code as used up');

  // ── language switch: every page type, both directions, from a phone and a narrow phone
  const narrow = await (await b.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true })).newPage();
  const pages = ['/', '/about/', '/events/', '/events/eid-al-fitr-celebration/', '/join/', '/community/', '/committees/', '/ideas/', '/faq/', '/privacy/', '/terms/', '/account/'];
  let bad = [];
  for (const pg of pages) for (const from of ['', '/ar']) {
    await narrow.goto(BASE + from + pg, { waitUntil: 'load' }); await narrow.waitForTimeout(120);
    const to = from ? 'en' : 'ar', want = (from ? '' : '/ar') + pg;
    const vis = await narrow.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth + 1; }, to);
    try { await Promise.all([narrow.waitForNavigation({ timeout: 5000 }), narrow.click('#' + to, { timeout: 3000 })]); } catch (e) { bad.push(from + pg + ' click failed'); continue; }
    const got = new URL(narrow.url()).pathname; const lang = await narrow.evaluate(() => document.documentElement.lang);
    if (got !== want || lang !== to || !vis) bad.push(from + pg + ' → ' + got + ' (' + lang + (vis ? '' : ', button off-screen') + ')');
  }
  ok(bad.length === 0, 'language buttons open the same page in the other language at 320px: ' + JSON.stringify(bad));
  await narrow.goto(BASE + '/faq/#prove-saudi'); await narrow.waitForTimeout(300);
  await Promise.all([narrow.waitForNavigation({ timeout: 5000 }), narrow.click('#ar')]);
  ok(narrow.url().endsWith('/ar/faq/#prove-saudi'), 'switching language keeps your place: ' + narrow.url());

  // ── ideas page: one board button, live message, no "pending" text
  await desk.goto(BASE + '/ideas/'); await desk.waitForTimeout(500);
  d = await desk.evaluate(() => ({ btns: Array.from(document.querySelectorAll('a')).filter((x) => /canny\.io/.test(x.href) && x.offsetParent).map((x) => x.textContent.trim()), text: document.getElementById('main').innerText }));
  ok(d.btns.length === 1 && /Open the ideas board/.test(d.btns[0]) && /The ideas board is live\. Share your ideas, vote and join the discussion\./.test(d.text) && !/as soon as the committee connects it/.test(d.text), 'ideas board: live message and exactly one button ' + JSON.stringify(d.btns));

  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  console.log(n + ' checks, ' + fails + ' failures');
  await b.close(); process.exit(fails ? 1 : 0);
})();

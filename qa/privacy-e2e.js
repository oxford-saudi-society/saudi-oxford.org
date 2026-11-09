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
  // college field: the suggestions are the page's own list, styled like the field (not the browser's built-in one)
  await phone.tap('#f-college'); await phone.keyboard.type('hert'); await phone.waitForTimeout(200);
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
  const applyOn = async (p, tier, name, email) => { await p.goto(BASE + '/join/'); await p.waitForTimeout(400); await p.check('input[name=tier][value=' + tier + ']', { force: true }); await p.fill('#f-name', name); await p.fill('#f-email', email); await p.fill('#f-college', 'Hertford College'); await p.locator('#statuses label', { has: p.locator('input[value=masters]') }).click(); await p.check('#f-consent', { force: true }); await p.click('#submit-btn'); await p.waitForTimeout(1500); return p.evaluate(() => document.getElementById('join-done').innerText); };
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

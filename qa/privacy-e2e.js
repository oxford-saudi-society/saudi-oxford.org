// Secure proof-of-nationality upload in a real browser (phone for the applicant, desktop for the committee):
// apply → sign in from the emailed link → upload a photo on the membership page → committee opens it from the desk
// (and nobody else can) → "Verified" deletes it → the applicant sees the confirmation. Also: the 3-step join page,
// language switch on every page type, and the single ideas-board button.
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
  const nosy = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

  // ── join page: exactly three steps, numbered once; no unavailable payment methods; no hardship/privilege claims
  await phone.goto(BASE + '/ar/join/'); await phone.waitForTimeout(400);
  let j = await phone.evaluate(() => ({ steps: Array.from(document.querySelectorAll('#steps li')).map((li) => li.textContent.trim()), nums: Array.from(document.querySelectorAll('#steps li .k')).map((k) => getComputedStyle(k, '::before').content), text: document.getElementById('main').innerText }));
  ok(j.steps.length === 3 && j.steps.every((s) => !/^\d|^[٠-٩]/.test(s)), 'three steps, no number in the text itself ' + JSON.stringify(j.steps));
  ok(j.nums.length === 3 && j.nums.every((c) => /counter\(step, arabic-indic\)/.test(c)), 'step numbers drawn once by CSS, in Arabic numerals ' + JSON.stringify(j.nums));
  ok(!/صندوق للمساعدة|بالبطاقة|شهادة تقدير|حق التصويت|إنستغرام/.test(j.text), 'no hardship fund, card payment, certificate, voting or Instagram claims');
  await phone.check('input[name=tier][value=saudi]', { force: true });
  await phone.fill('#f-name', 'نورة العتيبي'); await phone.fill('#f-email', 'noura@example.org'); await phone.fill('#f-college', 'Hertford College'); await phone.locator('#statuses label', { has: phone.locator('input[value=masters]') }).click(); await phone.check('#f-consent', { force: true });
  await phone.click('#submit-btn'); await phone.waitForTimeout(1500);
  j = await phone.evaluate(() => ({ no: (document.getElementById('mno') || {}).textContent, text: document.getElementById('join-done').innerText, track: Array.from(document.querySelectorAll('.track .tk')).map((k) => k.textContent + getComputedStyle(k, '::before').content) }));
  ok(/^OSS-\d{4}-0001$/.test(j.no), 'application received with a number ' + j.no);
  ok(/ارفع الإثبات بأمان/.test(j.text) && /عدم إرسال وثائق الهوية بالبريد/.test(j.text) && !/سنراسلك لطلب صورة/.test(j.text), 'confirmation points to the secure upload, not email');
  await shot(phone, 'p-join-done-ar', true);
  const no = j.no;
  ok(/ارفع من صفحة عضويتك|وارفع من صفحة عضويتك/.test((lastMail('noura@example.org', 'membership_received') || {}).text || ''), 'confirmation email explains the upload');

  // ── applicant signs in from the email link and uploads a photo
  await phone.goto(link('noura@example.org', 'membership_received')); await phone.waitForTimeout(1500);
  ok(await phone.evaluate(() => !!document.getElementById('mem-ev')), 'membership page offers the secure upload');
  // a real PNG with visible content, larger than the downscale limit so the browser re-encodes it
  const png = await phone.evaluate(() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const g = c.getContext('2d'); g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, 3000, 2000); g.fillStyle = '#14532D'; g.font = '160px sans-serif'; g.fillText('SPECIMEN PASSPORT', 300, 1000); return c.toDataURL('image/png').split(',')[1]; });
  fs.writeFileSync('/tmp/specimen.png', Buffer.from(png, 'base64'));
  await phone.click('#mem-ev-btn'); await phone.waitForTimeout(200);
  ok(await phone.evaluate(() => !document.getElementById('mem-ev-err').hidden), 'cannot upload without a file and the consent tick');
  await phone.setInputFiles('#mem-ev-file', '/tmp/specimen.png'); await phone.check('#mem-ev-ok', { force: true });
  await shot(phone, 'p-account-upload-ar', true);
  await phone.click('#mem-ev-btn'); await phone.waitForTimeout(2500);
  let a = await phone.evaluate(() => ({ text: document.getElementById('app').innerText, form: !!document.getElementById('mem-ev'), remove: !!document.getElementById('mem-ev-remove') }));
  ok(!a.form && a.remove && /تم استلام مستندك|تم استلام المستند/.test(a.text), 'upload accepted; page now shows it is held and can be removed');
  await shot(phone, 'p-account-held-ar', true);
  ok(/Proof of nationality uploaded/.test((lastMail('admin@example.org') || lastMail('membership@oxsss.org') || {}).subject || (mails().reverse().find((m) => m.kind === 'membership_committee') || {}).subject || ''), 'committee is told a document is waiting');
  ok(!mails().some((m) => /\/9j\/[A-Za-z0-9+/]{200}/.test(JSON.stringify(m))), 'the document never appears in any email');

  // ── nobody else can open it
  let r = await nosy.goto(BASE + '/api/admin/membership/' + no + '/evidence'); ok(r.status() === 401, 'signed-out visitor: ' + r.status());
  r = await phone.evaluate(async (u) => (await fetch(u, { credentials: 'same-origin' })).status, '/api/admin/membership/' + no + '/evidence'); ok(r === 403, 'the applicant themself cannot use the committee route: ' + r);

  // ── committee desk
  await desk.goto(BASE + '/admin/events/'); await desk.waitForTimeout(600);
  await desk.fill('#si-email', 'admin@example.org'); await desk.click('#si-btn'); await desk.waitForTimeout(1000);
  await desk.goto(link('admin@example.org', 'login_link')); await desk.waitForTimeout(1500);
  await desk.goto(BASE + '/admin/events/#membership/' + no); await desk.waitForTimeout(1200);
  let d = await desk.evaluate(() => ({ pane: (document.getElementById('mev') || {}).innerText || '', open: (document.querySelector('#mev a[target=_blank]') || {}).href || '' }));
  ok(/Document to check/i.test(d.pane) && /Uploaded/.test(d.pane) && /JPEG/.test(d.pane) && /evidence$/.test(d.open), 'desk shows the document is waiting, with an open link ' + JSON.stringify(d).slice(0, 200));
  await shot(desk, 'p-desk-evidence', true);
  const img = await desk.evaluate(async (u) => { const x = await fetch(u, { credentials: 'same-origin' }); const buf = new Uint8Array(await x.arrayBuffer()); const bmp = await createImageBitmap(new Blob([buf], { type: x.headers.get('content-type') })); return { status: x.status, type: x.headers.get('content-type'), cache: x.headers.get('cache-control'), bytes: buf.length, w: bmp.width, h: bmp.height, jpeg: buf[0] === 0xff && buf[1] === 0xd8 }; }, d.open);
  ok(img.status === 200 && img.type === 'image/jpeg' && img.jpeg && /no-store/.test(img.cache), 'committee can open it: a JPEG, never cached ' + JSON.stringify(img));
  ok(Math.max(img.w, img.h) === 2200 && img.bytes < 3 * 1024 * 1024, 'the photo was reduced in the browser before upload (' + img.w + '×' + img.h + ', ' + Math.round(img.bytes / 1024) + ' KB)');
  await desk.reload(); await desk.waitForTimeout(1200);
  ok(await desk.evaluate(() => /Last opened/.test(document.getElementById('mev').innerText) && /evidence viewed/.test(document.body.innerText)), 'the opening is recorded and shown');
  await desk.click('#mev [data-ev=verified]'); await desk.waitForTimeout(1500);
  d = await desk.evaluate(() => ({ pane: (document.getElementById('mev') || {}).innerText || '', link: !!document.querySelector('#mev a[target=_blank]') }));
  ok(/Verified/i.test(d.pane) && !d.link, 'recording "verified" removes the document from the desk ' + JSON.stringify(d).slice(0, 160));
  r = await desk.evaluate(async (u) => (await fetch(u, { credentials: 'same-origin' })).status, '/api/admin/membership/' + no + '/evidence'); ok(r === 404, 'the document no longer exists: ' + r);
  await phone.reload(); await phone.waitForTimeout(1200);
  ok(await phone.evaluate(() => /تم التحقق من الجنسية السعودية/.test(document.getElementById('app').innerText) && !document.getElementById('mem-ev')), 'applicant sees that the check is done and the document deleted');

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

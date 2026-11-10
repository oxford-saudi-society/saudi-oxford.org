// The join form (three steps, six categories) and the membership lifecycle, in a real browser against the dev
// server (dist + API + PostgreSQL). Nothing here touches the live site.
//   categories and fees → step 2 per category → step 3 fields per status → Next/Previous keep and clear answers →
//   Arabic messages → only applicable answers are sent → mailing list → volunteer → free-membership assessment →
//   discount / exemption codes → desk: queue, eligibility, payment and approval guards → the applicant's account.
// Prereq: qa/dev-reset.sh (fresh DB, MAIL_PROVIDER=file, ADMIN_BOOTSTRAP_EMAILS=admin@example.org)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { join, toStep3, fill, done, shown } = require('./join-helpers');
const BASE = 'http://127.0.0.1:8788', MAIL = '/tmp/oss-mail.jsonl';
let n = 0, fails = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log('  FAIL', m); } };
const shot = (p, name, full) => p.screenshot({ path: path.join(__dirname, 'shots', name + '.png'), fullPage: !!full });
const mails = () => (fs.existsSync(MAIL) ? fs.readFileSync(MAIL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const lastMail = (to, kind) => [...mails()].reverse().find((x) => x.to === to && (!kind || x.kind === kind));
const link = (to, kind) => { const m = lastMail(to, kind); const r = m && /https?:\/\/\S+verify\?t=\S+/.exec(m.text); return r ? r[0] : null; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const OX = { selects: { 'f-uni-choice': 'oxford' } };

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  const page = async (w, h, mobile) => { const p = await (await b.newContext(Object.assign({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }, mobile ? { isMobile: true, hasTouch: true } : {}))).newPage(); p.on('pageerror', (e) => errors.push(e.message)); return p; };
  const d = await page(1280, 900), phone = await page(390, 844, true), desk = await page(1280, 900);

  // ── step 1: six categories with their fees; one step on screen at a time ────────────────────────────────
  await d.goto(BASE + '/join/'); await d.waitForTimeout(400);
  let v = await d.evaluate(() => ({ cards: Array.from(document.querySelectorAll('#tiers .tier')).map((l) => l.querySelector('.tn').textContent + ' | ' + l.querySelector('.tp').innerText.replace(/\s+/g, ' ').trim()), vis: [1, 2, 3].map((i) => !document.getElementById('step-' + i).hidden), pills: Array.from(document.querySelectorAll('#steps li')).map((l) => l.textContent.trim()), cur: document.querySelector('#steps li[aria-current=step]').textContent.trim(), desc: document.querySelector('#tiers .tier .td').textContent, who: document.querySelector('details.who').textContent }));
  ok(same(v.cards, ['Saudi Oxford Community Membership | Free no fee', 'Oxford Student Membership | £10 per year', 'Other University Student Membership | £10 per year', 'Associate Membership | £15 per year', 'Mailing List | Free not a membership', 'Volunteer Registration | Free not a membership']), 'six categories with fees ' + JSON.stringify(v.cards));
  ok(same(v.vis, [true, false, false]) && same(v.pills, ['Membership type', 'Status or interests', 'Details and confirmation']) && v.cur === 'Membership type', 'only step 1 is shown; three named steps ' + JSON.stringify([v.vis, v.pills]));
  ok(v.desc === 'Free for Saudi nationals studying, working, researching, training or previously educated in Oxford.' && !/Non-Saudi/i.test(await d.textContent('#tiers')), 'free-membership description as specified; nothing is labelled Non-Saudi');
  ok(/Oxford Brookes University/.test(v.who) && /hospitals/.test(v.who) && /Living in Oxford is not, by itself, enough/.test(v.who) && /do not carry membership rights/.test(v.who), 'who qualifies: Oxford universities, hospitals, work in Oxford; residence alone is not enough');
  await d.click('#step-1 [data-go=next]'); await d.waitForTimeout(200);
  ok(await d.evaluate(() => !document.getElementById('step-1').hidden && getComputedStyle(document.getElementById('tier-msg')).display === 'block'), 'Next without a choice stays on step 1 and says why');

  // ── step 2: each category shows its own choices and nothing else ────────────────────────────────────────
  const step2 = async (tier) => { await d.goto(BASE + '/join/'); await d.waitForTimeout(300); await d.check(`input[name=tier][value=${tier}]`, { force: true }); await d.click('#step-1 [data-go=next]'); await d.waitForTimeout(250); return d.evaluate(() => ({ eyebrow: document.getElementById('step-2-eyebrow').textContent, h: document.getElementById('status-h').textContent, statuses: document.getElementById('status-wrap').hidden ? [] : Array.from(document.querySelectorAll('#statuses .tn')).map((x) => x.textContent), places: document.getElementById('place-wrap').hidden ? [] : Array.from(document.querySelectorAll('#places .tn')).map((x) => x.textContent), interests: document.getElementById('interests-wrap').hidden ? [] : Array.from(document.querySelectorAll('#interests .chk-l')).map((x) => x.textContent), areas: document.getElementById('areas-wrap').hidden ? [] : Array.from(document.querySelectorAll('#areas .chk-l')).map((x) => x.textContent) })); };
  v = await step2('saudi');
  ok(v.h === 'What is your connection to Oxford?' && /Your status/.test(v.eyebrow) && same(v.statuses, ['Undergraduate student', 'Master’s student', 'Doctoral student', 'Visiting student', 'Oxford university alumnus', 'Academic staff', 'Researcher / postdoctoral researcher', 'Visiting researcher', 'Clinical fellow', 'Resident doctor', 'Consultant physician', 'Other healthcare professional', 'University or research-institution employee', 'Oxford-based professional or business owner', 'Other Oxford connection']), 'Saudi category: the fifteen Oxford connections ' + JSON.stringify(v.statuses));
  await d.click('#step-2 [data-go=next]'); await d.waitForTimeout(200);
  ok(await d.evaluate(() => !document.getElementById('step-2').hidden && document.querySelector('[data-f=status]').classList.contains('err') && /Please choose your status/.test(document.getElementById('status-msg').textContent)), 'Next without a status stays on step 2');
  v = await step2('student');
  ok(v.h === 'Your status' && same(v.statuses, ['Undergraduate student', 'Master’s student', 'Doctoral student', 'Visiting student']) && !v.places.length, 'Oxford student: the four student statuses only');
  v = await step2('external');
  ok(v.h === 'Where do you study?' && same(v.places, ['Oxford Brookes University', 'Another UK university', 'University outside the UK']) && !v.statuses.length, 'another university: where first; the level is not shown yet ' + JSON.stringify(v));
  await d.locator('#places label', { has: d.locator('input[value=uk_university]') }).click(); await d.waitForTimeout(200);
  ok(same(await d.evaluate(() => (document.getElementById('status-wrap').hidden ? [] : Array.from(document.querySelectorAll('#statuses .tn')).map((x) => x.textContent))), ['Undergraduate', 'Master’s', 'Doctorate', 'Visiting student']) && await d.evaluate(() => !document.getElementById('level-h').hidden), 'then the level of study');
  v = await step2('associate');
  ok(same(v.statuses, ['Academic staff', 'Researcher', 'Visiting researcher', 'University employee', 'Alumnus', 'Clinical fellow', 'Resident doctor', 'Consultant physician', 'Other healthcare professional', 'Employee or professional', 'Friend or supporter of the Society', 'Other']), 'associate: its twelve statuses ' + JSON.stringify(v.statuses));
  v = await step2('mailing');
  ok(v.h === 'Which topics interest you?' && /Your interests/.test(v.eyebrow) && same(v.interests, ['Cultural events', 'Social gatherings', 'Academic events', 'Career opportunities', 'All Society news']) && !v.statuses.length, 'mailing list: topics, no academic status');
  await d.click('#step-2 [data-go=next]'); await d.waitForTimeout(250);
  ok(await d.evaluate(() => !document.getElementById('step-3').hidden), 'the topics are optional');
  v = await step2('volunteer');
  ok(v.h === 'In which areas would you like to volunteer?' && same(v.areas, ['Event organisation', 'Media and design', 'Photography and media coverage', 'Sponsorships and partnerships', 'Welcoming and supporting new students', 'Academic and professional programmes', 'Administrative and organisational support']) && !v.statuses.length, 'volunteer: the seven areas, no academic status');
  await d.click('#step-2 [data-go=next]'); await d.waitForTimeout(200);
  ok(await d.evaluate(() => !document.getElementById('step-2').hidden && document.querySelector('[data-f=areas]').classList.contains('err')), 'a volunteer must choose at least one area');

  // ── step 3: only the fields that apply ──────────────────────────────────────────────────────────────────
  const BASE_F = ['name', 'name_ar', 'email', 'phone'], MEM_END = ['volExtra', 'consent', 'consentNews', 'whatsapp'], PAID_END = ['volExtra', 'assess', 'feeCode', 'consent', 'consentNews', 'whatsapp'];
  const fieldsFor = async (o) => { await d.goto(BASE + '/join/'); await d.waitForTimeout(300); await toStep3(d, o); return shown(d); };
  const cases = [
    ['Oxford student', { tier: 'student', status: 'masters' }, BASE_F.concat(['college', 'sso'], PAID_END)],
    ['other university', { tier: 'external', place: 'uk_university', status: 'doctoral' }, BASE_F.concat(['org', 'subject'], PAID_END)],
    ['Saudi student at Oxford', Object.assign({ tier: 'saudi', status: 'undergraduate' }, OX), BASE_F.concat(['uniChoice', 'college', 'sso', 'volExtra', 'confirmSaudi', 'consent', 'consentNews', 'whatsapp'])],
    ['Saudi student at Brookes', { tier: 'saudi', status: 'undergraduate', selects: { 'f-uni-choice': 'brookes' } }, BASE_F.concat(['uniChoice', 'volExtra', 'confirmSaudi', 'consent', 'consentNews', 'whatsapp'])],
    ['Saudi alumnus', Object.assign({ tier: 'saudi', status: 'alumni' }, OX), BASE_F.concat(['uniChoice', 'gradYear', 'volExtra', 'confirmSaudi', 'consent', 'consentNews', 'whatsapp'])],
    ['Saudi researcher at Oxford', Object.assign({ tier: 'saudi', status: 'researcher' }, OX), BASE_F.concat(['uniChoice', 'sso', 'department', 'volExtra', 'confirmSaudi', 'consent', 'consentNews', 'whatsapp'])],
    ['Saudi clinical fellow', { tier: 'saudi', status: 'clinical_fellow', selects: { 'f-hospital': 'other' } }, BASE_F.concat(['hospital', 'org', 'role', 'specialty', 'volExtra', 'confirmSaudi', 'consent', 'consentNews', 'whatsapp'])],
    ['Saudi professional in Oxford', { tier: 'saudi', status: 'oxford_professional' }, BASE_F.concat(['org', 'role', 'volExtra', 'confirmSaudi', 'consent', 'consentNews', 'whatsapp'])],
    ['Saudi other connection', { tier: 'saudi', status: 'other_connection' }, BASE_F.concat(['connection', 'volExtra', 'confirmSaudi', 'consent', 'consentNews', 'whatsapp'])],
    ['associate supporter', { tier: 'associate', status: 'supporter' }, BASE_F.concat(PAID_END)],
    ['mailing list', { tier: 'mailing' }, ['name', 'email', 'consent', 'consentNews']],
    ['volunteer', { tier: 'volunteer', areas: ['events'] }, BASE_F.concat(['place', 'consent', 'consentNews', 'whatsapp'])],
  ];
  for (const [what, o, want] of cases) { const got = await fieldsFor(o); ok(same(got, want), what + ': fields ' + JSON.stringify(got)); }
  // labels, placeholders and what is optional
  await d.goto(BASE + '/join/'); await d.waitForTimeout(300); await toStep3(d, Object.assign({ tier: 'saudi', status: 'doctoral' }, OX));
  v = await d.evaluate(() => { const lbl = (f) => document.querySelector('[data-f=' + f + '] .lbl').innerText.replace(/\s+/g, ' ').trim(); return { name: document.getElementById('f-name').placeholder, phone: lbl('phone'), phonePh: document.getElementById('f-phone').placeholder, sso: lbl('sso'), ssoReq: document.getElementById('f-sso').required, nameAr: lbl('name_ar'), eyebrow: document.querySelector('#step-3 .eyebrow').textContent, h: document.getElementById('step-3-h').textContent, news: document.getElementById('f-news').checked, wa: document.getElementById('f-whatsapp').checked, waText: document.querySelector('[data-f=whatsapp] .chk-l').innerText.trim(), newsText: document.querySelector('[data-f=consentNews] .chk-l').innerText.trim(), upload: !!document.querySelector('#join-form input[type=file]'), btn: document.getElementById('submit-label').textContent, privacy: (() => { const a = document.querySelector('[data-f=consent] a'); return a ? [a.getAttribute('href'), a.target, a.textContent] : null; })(), confirm: document.querySelector('[data-f=confirmSaudi] .chk-l').innerText }; });
  ok(v.name === 'First and last name' && !/University card/i.test(await d.content()), 'name placeholder: First and last name');
  ok(/^MOBILE NUMBER \(optional\)$/i.test(v.phone) && /\+44/.test(v.phonePh) && /\+966/.test(v.phonePh), 'mobile number is optional and takes any country code ' + JSON.stringify([v.phone, v.phonePh]));
  ok(/Oxford SSO username \(optional\)/i.test(v.sso) && !v.ssoReq && /optional/i.test(v.nameAr), 'the SSO username and the Arabic name are optional');
  ok(/Step 3 of 3 · Your details/i.test(v.eyebrow) && v.h === 'Your details' && v.btn === 'Send membership application', 'step 3 is "Your details"; the button says what it sends');
  ok(!v.news && !v.wa && v.waText === 'I would like to join the Society’s WhatsApp group' && v.newsText === 'I would like to receive Society news and events by email', 'news and WhatsApp are separate choices, both off to begin with');
  ok(v.privacy && v.privacy[0] === '/privacy/' && v.privacy[1] === '_blank' && /privacy notice/.test(v.privacy[2]), 'the privacy notice is a link that opens beside the form ' + JSON.stringify(v.privacy));
  ok(/I confirm that I am a Saudi national and that my connection to Oxford is as I have stated/.test(v.confirm) && !v.upload, 'the free category asks for a confirmation, not a passport upload');

  // ── Previous / Next keep what still applies; a changed status or category clears what no longer does ──────
  await fill(d, { fields: { 'f-name': 'Keep Me', 'f-email': 'keep@example.org', 'f-college': 'Hertford College', 'f-sso': 'hert1234' } });
  await d.click('#step-3 [data-go=prev]'); await d.waitForTimeout(250);
  ok(await d.evaluate(() => !document.getElementById('step-2').hidden && document.querySelector('input[name=status]:checked').value === 'doctoral'), 'Previous goes back to step 2 with the status still chosen');
  await d.click('#step-2 [data-go=next]'); await d.waitForTimeout(250);
  ok(same(await d.evaluate(() => ['f-name', 'f-email', 'f-college', 'f-sso', 'f-uni-choice'].map((i) => document.getElementById(i).value)), ['Keep Me', 'keep@example.org', 'Hertford College', 'hert1234', 'oxford']), 'coming back without changing anything keeps every answer');
  await d.click('#step-3 [data-go=prev]'); await d.waitForTimeout(200);
  await d.locator('#statuses label', { has: d.locator('input[value=consultant]') }).click(); await d.click('#step-2 [data-go=next]'); await d.waitForTimeout(250);
  v = await d.evaluate(() => ({ kept: ['f-name', 'f-email'].map((i) => document.getElementById(i).value), cleared: ['f-college', 'f-sso', 'f-uni-choice'].map((i) => document.getElementById(i).value), hidden: ['college', 'sso', 'uniChoice'].map((f) => document.querySelector('[data-f=' + f + ']').hidden) }));
  ok(same(v.kept, ['Keep Me', 'keep@example.org']) && same(v.cleared, ['', '', '']) && same(v.hidden, [true, true, true]), 'a new status keeps the name and email and clears the answers that no longer apply ' + JSON.stringify(v));
  await d.click('#steps li[data-step="1"]'); await d.waitForTimeout(250);
  await d.check('input[name=tier][value=associate]', { force: true }); await d.click('#step-1 [data-go=next]'); await d.waitForTimeout(250);
  ok(await d.evaluate(() => !document.querySelector('input[name=status]:checked') && document.querySelectorAll('#statuses .stat').length === 12), 'a new category starts step 2 afresh');

  // ── Arabic: step names, specific messages, fee wording, right-to-left ───────────────────────────────────
  await phone.goto(BASE + '/ar/join/'); await phone.waitForTimeout(400);
  v = await phone.evaluate(() => ({ pills: Array.from(document.querySelectorAll('#steps li')).map((l) => l.textContent.trim()), cards: Array.from(document.querySelectorAll('#tiers .tn')).map((x) => x.textContent), desc: document.querySelector('#tiers .tier .td').textContent, dir: document.documentElement.dir, over: document.documentElement.scrollWidth > window.innerWidth + 1 }));
  ok(same(v.pills, ['نوع العضوية', 'الصفة أو مجال الاهتمام', 'البيانات وتأكيد الطلب']) && same(v.cards, ['عضوية السعوديين في أكسفورد', 'عضوية طلبة جامعة أكسفورد', 'عضوية طلبة الجامعات الأخرى', 'العضوية المنتسبة', 'القائمة البريدية', 'التسجيل للتطوع']), 'Arabic step names and category names ' + JSON.stringify(v.cards));
  ok(v.desc === 'عضوية مجانية للسعوديين من طلبة وخريجي جامعات أكسفورد، وأعضاء هيئة التدريس، والباحثين، والأطباء، والموظفين، والعاملين في مدينة أكسفورد.' && v.dir === 'rtl' && !v.over, 'Arabic free-membership description as specified; right-to-left; nothing overflows on a phone');
  await toStep3(phone, { tier: 'saudi', status: 'clinical_fellow' });
  v = await phone.evaluate(() => ({ h2: document.getElementById('status-h').textContent, h3: document.getElementById('step-3-h').textContent, phone: document.querySelector('[data-f=phone] .lbl').innerText.replace(/\s+/g, ' ').trim(), sso: document.querySelector('[data-f=sso] .lbl').innerText.trim(), name: document.getElementById('f-name').placeholder, hosp: Array.from(document.querySelectorAll('#f-hospital option')).map((o) => o.textContent), btn: document.getElementById('submit-label').textContent, prev: document.querySelector('#step-3 [data-go=prev]').textContent, wa: document.querySelector('[data-f=whatsapp] .chk-l').innerText.trim(), news: document.querySelector('[data-f=consentNews] .chk-l').innerText.trim(), cons: document.querySelector('[data-f=consent] .chk-l').innerText.trim(), sum: document.getElementById('sum').textContent, over: document.documentElement.scrollWidth > window.innerWidth + 1 }));
  ok(v.h2 === 'ما علاقتك بأكسفورد؟' && v.h3 === 'بياناتك الشخصية' && v.phone === 'رقم الجوال (اختياري)' && v.sso === 'اسم المستخدم الجامعي في أكسفورد (SSO) — اختياري' && v.name === 'الاسم الأول واسم العائلة', 'Arabic headings and labels as specified ' + JSON.stringify([v.h2, v.h3, v.phone, v.sso, v.name]));
  ok(same(v.hosp.slice(1), ['مستشفى جون رادكليف', 'مستشفى تشرشل', 'مركز نافيلد لجراحة العظام', 'مستشفى آخر تابع لمستشفيات جامعة أكسفورد', 'جهة صحية أخرى في أكسفورد']), 'hospital list ' + JSON.stringify(v.hosp));
  ok(v.btn === 'إرسال طلب العضوية' && v.prev === 'السابق' && v.wa === 'أرغب في الانضمام إلى مجموعة واتساب الخاصة بالجمعية' && v.news === 'أرغب في استلام أخبار الجمعية والفعاليات عبر البريد الإلكتروني' && /^اطلعت على إشعار الخصوصية وفهمت كيفية استخدام بياناتي/.test(v.cons) && /مجانية/.test(v.sum) && !v.over, 'Arabic buttons, consents and fee ' + JSON.stringify([v.btn, v.sum]));
  await phone.click('#submit-btn'); await phone.waitForTimeout(300);
  v = await phone.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll('#step-3 .f.err')).map((f) => [f.getAttribute('data-f'), Array.from(f.querySelectorAll('.msg')).map((m) => m.textContent).join('')])));
  ok(v.name === 'يرجى إدخال الاسم الكامل.' && v.email === 'يرجى إدخال بريد إلكتروني صحيح.' && /الصفة الوظيفية/.test(v.role) && /التخصص الطبي/.test(v.specialty) && /المستشفى/.test(v.hospital) && v.confirmSaudi && v.consent && !v.phone && !v.name_ar, 'each missing answer has its own Arabic message; optional fields are not flagged ' + JSON.stringify(Object.keys(v)));
  await shot(phone, 'j-ar-errors', true);
  await fill(phone, { selects: { 'f-hospital': 'other' } });
  ok(await phone.evaluate(() => !document.querySelector('[data-f=org]').hidden && document.querySelector('[data-f=org] .lt').textContent === 'اسم المستشفى أو الجهة الصحية'), 'another healthcare organisation asks for its name');

  // ── only what applies is sent; the review shows it before sending ───────────────────────────────────────
  await d.goto(BASE + '/join/'); await d.waitForTimeout(300);
  await toStep3(d, Object.assign({ tier: 'saudi', status: 'doctoral' }, OX, { fields: { 'f-name': 'Hassan Bucklain', 'f-email': 'hassan@example.org', 'f-college': 'Hertford College', 'f-sso': 'hert1234', 'f-phone': '+966 50 000 0000' } }));
  await d.click('#step-3 [data-go=prev]'); await d.locator('#statuses label', { has: d.locator('input[value=alumni]') }).click(); await d.click('#step-2 [data-go=next]'); await d.waitForTimeout(250);
  await fill(d, { fields: { 'f-grad-year': '2019' }, checks: ['f-confirm-saudi', 'f-consent'] });
  v = await d.evaluate(() => document.getElementById('review-list').innerText.replace(/\s*\n\s*/g, ' | '));
  ok(v === 'Category | Saudi Oxford Community Membership | Fee | Free | Status | Oxford university alumnus | Institution | University of Oxford | Name | Hassan Bucklain | Email | hassan@example.org', 'review: category, fee, status, institution, name and email — ' + v);
  await shot(d, 'j-en-review', true);
  let sent = null; d.on('request', (r) => { if (/\/api\/membership\/apply$/.test(r.url())) sent = JSON.parse(r.postData()); });
  await d.click('#submit-btn'); await d.waitForTimeout(1500);
  let a1 = await done(d);
  ok(sent && sent.tier === 'saudi' && sent.status === 'alumni' && sent.uniChoice === 'oxford' && sent.gradYear === '2019' && sent.confirm_saudi === true && !('college' in sent) && !('sso' in sent) && !('hospital' in sent) && !('feeCode' in sent) && !('freeAssess' in sent), 'answers that stopped applying (college, SSO) are not sent ' + JSON.stringify(Object.keys(sent || {})));
  ok(/^OSS-\d{4}-0001$/.test(a1.no) && a1.q === '1' && a1.stage.trim() === 'Application received' && /Application received/i.test(a1.text) && /secretary will email you later/.test(a1.text) && /Free/.test(a1.text), 'first applicant: number, place 1, "Application received" ' + JSON.stringify([a1.no, a1.q, a1.stage]));
  await shot(d, 'j-en-done', true);
  ok(/Status: Application received/.test(lastMail('hassan@example.org', 'membership_received').text) && /Saudi Oxford Community Membership · Oxford university alumnus/.test(lastMail('membership@oxsss.org', 'membership_committee').text), 'confirmation and committee emails carry the category and status');

  // ── mailing list: an email address and the opt-in; not a membership ─────────────────────────────────────
  await phone.goto(BASE + '/ar/join/'); await phone.waitForTimeout(300); await toStep3(phone, { tier: 'mailing', interests: ['cultural', 'careers'] });
  v = await phone.evaluate(() => ({ btn: document.getElementById('submit-label').textContent, req: !document.getElementById('news-req').hidden, nameOpt: !document.querySelector('[data-f=name] .opt').hidden && document.querySelector('[data-f=name] .req').hidden, review: document.getElementById('review-list').innerText }));
  ok(v.btn === 'الاشتراك في القائمة البريدية' && v.req && v.nameOpt && /الفعاليات الثقافية، الفرص المهنية/.test(v.review), 'mailing list: its own button, the name is optional, the opt-in is marked as needed');
  await fill(phone, { fields: { 'f-email': 'reader@example.org' }, checks: ['f-consent'] }); await phone.click('#submit-btn'); await phone.waitForTimeout(400);
  ok(same((await done(phone)).errs, ['consentNews']) && /يلزم تفعيل هذا الخيار/.test(await phone.textContent('[data-f=consentNews] .msg')), 'the subscription needs the explicit opt-in');
  await phone.check('#f-news', { force: true }); await phone.click('#submit-btn'); await phone.waitForTimeout(1500);
  let m1 = await done(phone);
  ok(m1.done && /تم اشتراكك في القائمة البريدية/.test(m1.text) && /مستقلة عن العضوية/.test(m1.text) && !m1.no, 'subscribed: no membership number, told it is not a membership');
  ok(/القائمة البريدية مستقلة عن العضوية/.test((lastMail('reader@example.org', 'mailing_welcome') || {}).text || ''), 'welcome email (Arabic) with a confirmation link');

  // ── volunteer registration ───────────────────────────────────────────────────────────────────────────────
  let vol = await join(d, BASE, 'en', { tier: 'volunteer', areas: ['events', 'photography'], fields: { 'f-name': 'Vera Volunteer', 'f-email': 'vera@example.org' }, checks: ['f-consent'] });
  ok(!vol.done && same(vol.errs, ['place']) && await d.textContent('#submit-label') === 'Send volunteer registration', 'volunteer: the preferred place is needed; the button says "Send volunteer registration"');
  await fill(d, { selects: { 'f-place': 'both' } }); await d.click('#submit-btn'); await d.waitForTimeout(1500); vol = await done(d);
  ok(vol.done && /Volunteer registration received/i.test(vol.text) && /Event organisation, Photography and media coverage/.test(vol.text) && /does not make you a member/.test(vol.text) && !vol.no, 'volunteer registered: areas shown, not a membership');
  ok(/New volunteer registration — Vera Volunteer/.test((lastMail('membership@oxsss.org', 'volunteer_committee') || {}).subject || ''), 'the committee is told');

  // ── free-membership assessment ───────────────────────────────────────────────────────────────────────────
  await d.goto(BASE + '/join/'); await d.waitForTimeout(300);
  await toStep3(d, { tier: 'student', status: 'masters', fields: { 'f-name': 'Sara Ahmed', 'f-email': 'sara@example.org', 'f-college': 'Keble College' } });
  v = await d.evaluate(() => ({ off: !document.getElementById('f-assess').checked, more: document.getElementById('assess-more').hidden, fee: document.getElementById('sum').textContent, hint: document.querySelector('#assess .hint').textContent }));
  ok(v.off && v.more && v.fee === 'Fee: £10 per year' && /nobody else is asked about nationality/.test(v.hint), 'paid category: £10 per year; the assessment is offered, off by default, and nobody is made to state a nationality');
  await d.check('#f-assess', { force: true }); await d.click('#submit-btn'); await d.waitForTimeout(300);
  ok((await done(d)).errs.includes('assess') && /confirm your nationality/.test(await d.textContent('#assess-msg')), 'asking for the assessment needs the nationality confirmation');
  await d.check('#f-assess-saudi', { force: true }); await d.waitForTimeout(200);
  ok(await d.evaluate(() => !document.getElementById('assess-offer').hidden && document.getElementById('assess-conn-wrap').hidden), 'an Oxford student who is Saudi is offered the free category at once');
  await shot(d, 'j-en-assess-offer', true);
  await d.click('#assess-switch'); await d.waitForTimeout(400);
  v = await d.evaluate(() => ({ tier: document.querySelector('input[name=tier]:checked').value, step2: !document.getElementById('step-2').hidden, st: (document.querySelector('input[name=status]:checked') || {}).value, note: !document.getElementById('switch-note').hidden }));
  ok(v.tier === 'saudi' && v.step2 && v.st === 'masters' && v.note, 'switching goes to the free category with the status carried over ' + JSON.stringify(v));
  await d.click('#step-2 [data-go=next]'); await d.waitForTimeout(300);
  v = await d.evaluate(() => ({ vals: ['f-name', 'f-email', 'f-college', 'f-uni-choice'].map((i) => document.getElementById(i).value), fee: document.getElementById('sum').textContent, code: document.getElementById('fee-code').hidden }));
  ok(same(v.vals, ['Sara Ahmed', 'sara@example.org', 'Keble College', 'oxford']) && v.fee === 'Fee: Free' && v.code, 'the details already entered are kept, and the fee is now Free ' + JSON.stringify(v));
  await fill(d, { checks: ['f-confirm-saudi', 'f-consent'] }); await d.click('#submit-btn'); await d.waitForTimeout(1500);
  let a2 = await done(d);
  ok(/^OSS-\d{4}-0002$/.test(a2.no) && /Saudi Oxford Community Membership/.test(a2.text) && !/£10/.test(a2.text), 'sent as a free membership: ' + a2.no);
  // eligibility that cannot be settled on the page → awaiting eligibility check, no fee asked
  let a3 = await join(d, BASE, 'en', { tier: 'external', place: 'uk_university', status: 'doctoral', fields: { 'f-name': 'Omar Review', 'f-email': 'omar@example.org', 'f-org': 'University of Reading' }, checks: ['f-assess', 'f-assess-saudi', 'f-consent'], submit: false });
  await fill(d, { selects: { 'f-assess-conn': 'unsure' } });
  v = await d.evaluate(() => ({ note: document.getElementById('assess-review').hidden ? '' : document.getElementById('assess-review').textContent, fee: document.getElementById('review-list').innerText }));
  ok(/Awaiting eligibility check/.test(v.note) && /will not be asked to pay/.test(v.note) && /£10 per year — not requested while your eligibility is under review/.test(v.fee), 'not sure of the connection: goes to the committee, and the review says no fee is requested meanwhile');
  await d.click('#submit-btn'); await d.waitForTimeout(1500); a3 = await done(d);
  ok(a3.stage.trim() === 'Awaiting eligibility check' && /You will not be asked to pay anything while it is under review/.test(a3.text) && !/treasurer|payment reference/i.test(a3.text), 'confirmation: awaiting eligibility check, no payment panel');
  await shot(d, 'j-en-done-eligibility', true);

  // ── discount or exemption code: decided by the code's record ────────────────────────────────────────────
  await desk.goto(BASE + '/admin/events/'); await desk.waitForTimeout(600);
  await desk.fill('#si-email', 'admin@example.org'); await desk.click('#si-btn'); await desk.waitForTimeout(1000);
  await desk.goto(link('admin@example.org', 'login_link')); await desk.waitForTimeout(1500);
  await desk.goto(BASE + '/admin/events/#membership-codes'); await desk.waitForTimeout(1000);
  ok(/Discount and exemption codes/.test(await desk.textContent('#view h1')) && await desk.inputValue('#fc-pct') === '100', 'desk: "Discount and exemption codes", full exemption by default');
  await desk.fill('#fc-label', 'Half price'); await desk.fill('#fc-pct', '50'); await desk.click('#fc-f button[type=submit]'); await desk.waitForTimeout(1000);
  const half = await desk.evaluate(() => document.querySelector('#flash .mono').textContent);
  await desk.fill('#fc-label', 'Guest'); await desk.fill('#fc-code', 'welcome-2026'); await desk.fill('#fc-max', '1'); await desk.click('#fc-f button[type=submit]'); await desk.waitForTimeout(1000);
  ok(/^OSS-X\d{2}-/.test(half) && same(await desk.evaluate(() => Array.from(document.querySelectorAll('.tbl tbody tr')).map((r) => r.children[0].querySelector('b').textContent + ' ' + r.children[2].textContent)), ['WELCOME-2026 100%', half + ' 50%']), 'a generated code and one in the committee’s own words, each with its discount');
  await shot(desk, 'j-desk-codes', true);
  await d.goto(BASE + '/join/'); await d.waitForTimeout(300);
  await toStep3(d, { tier: 'associate', status: 'supporter', fields: { 'f-name': 'Code Person', 'f-email': 'code@example.org' } });
  v = await d.evaluate(() => ({ label: document.querySelector('#fee-code .lbl span').textContent, ph: document.getElementById('f-fee-code').placeholder, fee: document.getElementById('sum').textContent }));
  ok(v.label === 'Discount or exemption code' && v.ph === 'Enter your code' && !/OSS-X/.test(v.ph) && v.fee === 'Fee: £15 per year', 'the code field: new name, no pattern shown; associate fee £15 per year');
  let calls = 0; d.on('request', (r) => { if (/\/api\/membership\/code$/.test(r.url())) calls++; });
  await d.fill('#f-fee-code', 'OSS-X26-00000-00001'); await d.click('#fee-code-btn'); await d.waitForTimeout(900);
  ok(calls === 1 && /not recognised/.test(await d.textContent('#fee-code-state')) && await d.evaluate(() => document.getElementById('fee-code-state').classList.contains('is-bad')), 'a code with the right shape but no record is declined by the server, not by its pattern');
  await d.fill('#f-fee-code', half.toLowerCase().replace(/-/g, ' ')); await d.click('#fee-code-btn'); await d.waitForTimeout(900);
  v = await d.evaluate(() => ({ text: document.getElementById('fee-code-state').textContent, fee: document.getElementById('sum').textContent }));
  ok(/50% off/.test(v.text) && /£8 per year/.test(v.text) && v.fee === 'Fee: £8 per year', 'a discount code typed loosely is found and takes half off ' + JSON.stringify(v));
  await d.fill('#f-fee-code', 'welcome 2026'); await d.click('#fee-code-btn'); await d.waitForTimeout(900);
  ok(/fee is waived/.test(await d.textContent('#fee-code-state')) && await d.textContent('#sum') === 'Fee: Free', 'an exemption code waives the fee');
  await d.check('#f-consent', { force: true }); await d.click('#submit-btn'); await d.waitForTimeout(1500);
  let a4 = await done(d);
  ok(a4.done && /fee has been waived with your code/.test(a4.text), 'application sent with the fee waived');
  let a5 = await join(d, BASE, 'en', { tier: 'associate', status: 'supporter', fields: { 'f-name': 'Late Person', 'f-email': 'late@example.org', 'f-fee-code': 'WELCOME-2026' }, checks: ['f-consent'] });
  ok(!a5.done && a5.step === 3 && /already been used/.test(await d.textContent('#fee-code-state')), 'a used-up code stops the form');
  await d.fill('#f-fee-code', ''); await d.click('#submit-btn'); await d.waitForTimeout(1500); a5 = await done(d);
  ok(a5.done && /£15 per year/.test(a5.text) && a5.stage.trim() === 'Application received', 'without the code the fee is £15 per year');

  // ── an Arabic paid application: the fee in Arabic ───────────────────────────────────────────────────────
  let a6 = await join(phone, BASE, 'ar', { tier: 'student', status: 'undergraduate', fields: { 'f-name': 'ليلى حسن', 'f-email': 'layla@example.org', 'f-college': 'Hertford College' }, checks: ['f-consent'], submit: false });
  ok(await phone.textContent('#sum') === 'الرسوم: ١٠ جنيهات إسترلينية سنويًا', 'Arabic fee before sending: ' + await phone.textContent('#sum'));
  await phone.click('#submit-btn'); await phone.waitForTimeout(1500); a6 = await done(phone);
  ok(a6.done && /١٠ جنيهات إسترلينية سنويًا/.test(a6.text) && a6.stage.trim() === 'تم استلام الطلب', 'Arabic confirmation: fee and "تم استلام الطلب"');
  await shot(phone, 'j-ar-done', true);
  await join(phone, BASE, 'ar', { tier: 'associate', status: 'supporter', fields: { 'f-name': 'x', 'f-email': 'y@example.org' }, submit: false });
  ok(await phone.textContent('#sum') === 'الرسوم: ١٥ جنيهًا إسترلينيًا سنويًا', 'Arabic associate fee: ' + await phone.textContent('#sum'));

  // ── the committee desk ───────────────────────────────────────────────────────────────────────────────────
  await desk.goto(BASE + '/admin/events/#membership'); await desk.waitForTimeout(1200);
  v = await desk.evaluate(() => Array.from(document.querySelectorAll('.mtbl tbody tr')).map((r) => r.children[0].textContent.trim() + ' ' + r.children[2].querySelector('b').textContent + ' | ' + r.children[3].textContent + ' | ' + r.children[7].textContent));
  ok(v.length === 6 && /^1 Hassan Bucklain \| Saudi Oxford community/.test(v[0]) && /^3 Omar Review \| Other university student \| On hold/.test(v[2]), 'queue in order with category and payment state ' + JSON.stringify(v));
  await shot(desk, 'j-desk-queue');
  // a free membership is approved only with the eligibility confirmation
  await desk.click('.mtbl tbody tr:first-child'); await desk.waitForTimeout(1000);
  ok(/Stated Saudi nationality/.test(await desk.textContent('#view')) && /University of Oxford/.test(await desk.textContent('#view')), 'detail shows the stated nationality and the institution');
  await desk.click('[data-act="approve"]'); await desk.waitForTimeout(500);
  v = await desk.evaluate(() => { const dl = document.querySelector('dialog[open]'); return dl ? dl.textContent : ''; });
  ok(/Confirm eligibility and approve/.test(v) && /checked this person’s Saudi nationality and Oxford connection/.test(v), 'approving a free membership asks the committee to confirm eligibility');
  await desk.click('dialog[open] .btn-p'); await desk.waitForTimeout(1200);
  ok(/Approved/.test(await desk.textContent('#flash')) && /Active/.test(await desk.textContent('.app-head .badge')), 'approved once eligibility is confirmed');
  // the eligibility check on Omar's application: nothing can be approved until it is decided
  await desk.goto(BASE + '/admin/events/#membership/' + a3.no); await desk.waitForTimeout(1200);
  ok(await desk.evaluate(() => !!document.getElementById('melig')) && /asked to be assessed/.test(await desk.textContent('#melig')), 'the application has an Eligibility box');
  await shot(desk, 'j-desk-eligibility', true);
  await desk.click('[data-act="approve"]'); await desk.waitForTimeout(500);
  ok(/awaiting an eligibility check/.test(await desk.textContent('#flash')), 'cannot approve while the check is open');
  await desk.click('[data-elig="not_eligible"]'); await desk.waitForTimeout(300); await desk.click('dialog[open] .btn-p'); await desk.waitForTimeout(1200);
  ok(/could not confirm that you qualify/.test((lastMail('omar@example.org', 'membership_eligibility') || {}).text || '') && await desk.evaluate(() => !document.getElementById('melig') && document.getElementById('mc-pay').value === 'due'), 'not eligible: applicant emailed, the fee becomes due');
  await desk.click('[data-act="approve"]'); await desk.waitForTimeout(500);
  ok(/Payment has not been confirmed/.test(await desk.textContent('#flash')), 'a paid membership cannot be approved before the payment is confirmed');
  await desk.selectOption('#mc-pay', 'received'); await desk.click('#mchecks button[type=submit]'); await desk.waitForTimeout(1000);
  await desk.click('[data-act="approve"]'); await desk.waitForTimeout(600);
  if (await desk.evaluate(() => !!document.querySelector('dialog[open]'))) { await desk.click('dialog[open] .btn-p'); } // "email not confirmed yet" warning
  await desk.waitForTimeout(1200);
  ok(/Active/.test(await desk.textContent('.app-head .badge')), 'approved once the payment is marked received');
  await desk.goto(BASE + '/admin/events/#membership-volunteers'); await desk.waitForTimeout(1000);
  ok(/Vera Volunteer/.test(await desk.textContent('#view')) && /Event organisation, Photography and media coverage/.test(await desk.textContent('#view')), 'the desk lists volunteers');
  await shot(desk, 'j-desk-volunteers');

  // ── the applicant's account: status wording, and leaving the two separate registers ─────────────────────
  await d.goto(link('omar@example.org', 'membership_received')); await d.waitForTimeout(1500);
  ok(/Membership active/i.test(await d.textContent('.mem-pane .mstate')), 'active member sees "Membership active"');
  await phone.goto(link('layla@example.org', 'membership_received')); await phone.waitForTimeout(1500);
  v = await phone.evaluate(() => ({ st: document.querySelector('.mem-pane .mstate').textContent.trim(), text: document.getElementById('app').innerText }));
  ok(v.st === 'بانتظار السداد' && /بانتظار السداد: ١٠ جنيهات إسترلينية سنويًا/.test(v.text) && /القائمة البريدية/.test(v.text) && /لم تسجّل للتطوع/.test(v.text), 'unpaid applicant (Arabic): "بانتظار السداد", with the mailing list and volunteering shown separately');
  await shot(phone, 'j-ar-account', true);
  const vera = await page(1280, 900);
  await vera.goto(link('vera@example.org', 'volunteer_received')); await vera.waitForTimeout(1500);
  v = await vera.evaluate(() => document.getElementById('app').innerText);
  ok(/You do not have a membership application yet/.test(v) && /Event organisation, Photography and media coverage/.test(v) && /You are not on the mailing list/.test(v), 'a volunteer has no membership; their registration is on their account');
  await vera.click('#vol-out'); await vera.waitForTimeout(300); await vera.click('dialog[open] .btn-p'); await vera.waitForTimeout(1200);
  ok(/has been withdrawn/.test(await vera.textContent('#app')) && /You have not registered to volunteer/.test(await vera.textContent('#app')), 'they can withdraw it themselves');
  const reader = await page(390, 844, true);
  await reader.goto(link('reader@example.org', 'mailing_welcome')); await reader.waitForTimeout(1500);
  ok(/أنت مشترك في القائمة البريدية/.test(await reader.textContent('#app')), 'a subscriber sees the subscription on their account');
  await reader.click('#ml-out'); await reader.waitForTimeout(300); await reader.click('dialog[open] .btn-p'); await reader.waitForTimeout(1200);
  ok(/تم إلغاء اشتراكك/.test(await reader.textContent('#app')), 'and can unsubscribe themselves');

  // ── a link can open the form on a category; small screens ───────────────────────────────────────────────
  await phone.setViewportSize({ width: 320, height: 640 });
  await phone.goto(BASE + '/ar/join/?type=volunteer'); await phone.waitForTimeout(400);
  ok(await phone.evaluate(() => document.querySelector('input[name=tier]:checked').value === 'volunteer' && document.documentElement.scrollWidth <= window.innerWidth + 1), '?type=volunteer preselects the category; no sideways scrolling at 320px');
  await toStep3(phone, { tier: 'saudi', status: 'researcher' });
  ok(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'step 3 fits a 320px screen');
  ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await b.close();
  console.log(`${n} checks, ${fails} failures`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

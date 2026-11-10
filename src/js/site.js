(function () {
  'use strict';
  var lang = (document.documentElement.lang || 'en').slice(0, 2) === 'ar' ? 'ar' : 'en';
  var SITE = { lang: lang, email: '', treasurerEmail: '', membershipEmail: '', fees: {}, payLinks: {}, bank: {}, apiBase: '/api' };
  try { var el0 = document.getElementById('site-settings'); if (el0) Object.assign(SITE, JSON.parse(el0.textContent)); } catch (e) {}
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var T = {
    en: {
      sumPaid: 'Fee: <b>{amount}</b> — payment details follow after you apply', sumFree: 'Nothing to pay',
      sumVerify: 'Free — the secretary will email you later if proof of nationality is needed',
      sumWaived: 'Nothing to pay — your fee is waived with your code',
      codeOk: 'Exemption code accepted — your membership fee is waived.', codeOkPersonal: 'Exemption code accepted. It is reserved for one email address, which is checked when you send the form.', codeChecking: 'Checking…', codeEmpty: 'Type the code first.',
      codeBad: { not_yours: 'Code declined — this code is reserved for a different email address.', invalid: 'Code declined — this code is not recognised. Please check it against the one you were given.', expired: 'Code declined — this code has expired.', used_up: 'Code declined — this code has already been used.', not_needed: 'This category is free, so no code is needed.', rate: 'Too many attempts. Please wait a few minutes and try again.', net: 'The code could not be checked just now. It is checked again when you send the form.' }, sumNone: 'Choose a membership type above',
      sending: 'Sending…',
      cardTitle: 'Pay by card', cardBtn: 'Pay {amount} by card',
      cardNote: 'Secure checkout opens in a new tab, handled by the payment provider. The Society never sees your card details.',
      bankTitle: 'Pay by bank transfer', acctName: 'Account name', sortCode: 'Sort code', acctNo: 'Account number', refK: 'Reference',
      dirNoMatch: 'No one matches that search.'
    },
    ar: {
      sumPaid: 'الرسوم: <b>{amount}</b> — تصلك تفاصيل الدفع بعد التقديم', sumFree: 'لا توجد رسوم',
      sumVerify: 'مجاناً — سيراسلك أمين السر لاحقاً إن لزم إثبات الجنسية',
      sumWaived: 'لا توجد رسوم — أُعفيت منها بموجب الرمز',
      codeOk: 'تم قبول رمز الإعفاء — أُعفيت من رسوم العضوية.', codeOkPersonal: 'تم قبول رمز الإعفاء. هذا الرمز مخصّص لبريد إلكتروني واحد، ويُتحقق منه عند إرسال النموذج.', codeChecking: 'جارٍ التحقق…', codeEmpty: 'اكتب الرمز أولاً.',
      codeBad: { not_yours: 'رُفض الرمز — هذا الرمز مخصّص لبريد إلكتروني آخر.', invalid: 'رُفض الرمز — هذا الرمز غير معروف لدينا. راجعه وقارنه بالرمز الذي استلمته.', expired: 'رُفض الرمز — انتهت صلاحية هذا الرمز.', used_up: 'رُفض الرمز — استُخدم هذا الرمز من قبل.', not_needed: 'هذا النوع من العضوية مجاني، فلا حاجة إلى رمز.', rate: 'محاولات كثيرة. انتظر بضع دقائق ثم حاول مجدداً.', net: 'تعذّر التحقق من الرمز الآن. سيُتحقق منه مرة أخرى عند إرسال النموذج.' }, sumNone: 'اختر نوع العضوية أعلاه',
      sending: 'جارٍ الإرسال…',
      cardTitle: 'الدفع بالبطاقة', cardBtn: 'ادفع {amount} بالبطاقة',
      cardNote: 'تُفتح صفحة دفع آمنة في تبويب جديد عبر مزوّد الدفع. لا تطّلع الجمعية على بيانات بطاقتك أبداً.',
      bankTitle: 'الدفع بالتحويل البنكي', acctName: 'اسم الحساب', sortCode: 'رمز الفرع (Sort code)', acctNo: 'رقم الحساب', refK: 'المرجع',
      dirNoMatch: 'لا نتائج لهذا البحث.'
    }
  };
  function t(key, vars) { var s = (T[lang] && T[lang][key] !== undefined) ? T[lang][key] : T.en[key]; if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); }); return s; }
  function phOr(v, placeholder) { return v ? esc(v) : '<span class="ph">' + esc(placeholder) + '</span>'; }

  /* ── ideas board (Canny, or any embeddable board) ─────────────── */
  (function ideasBoard() {
    var board = $('ideas-board'); if (!board) return;
    var cfg = SITE.ideas || {}, linkCard = $('ideas-link'), mainLink = $('ideas-open-main');
    if (mainLink && cfg.url) mainLink.href = cfg.url;
    if (linkCard && !cfg.url) linkCard.hidden = true;
    if (cfg.cannyBoardToken) {
      /* Canny's loader, as published at developers.canny.io/install/widget/web */
      (function (w, d, i, s) { function l() { if (!d.getElementById(i)) { var f = d.getElementsByTagName(s)[0], e = d.createElement(s); e.type = 'text/javascript'; e.async = true; e.src = 'https://sdk.canny.io/sdk.js'; f.parentNode.insertBefore(e, f); } } if (typeof w.Canny !== 'function') { var c = function () { c.q.push(arguments); }; c.q = []; w.Canny = c; if (d.readyState === 'complete') l(); else w.addEventListener('load', l, false); } })(window, document, 'canny-jssdk', 'script');
      window.Canny('render', { boardToken: cfg.cannyBoardToken, basePath: location.pathname.replace(/\/$/, ''), ssoToken: null, theme: 'light' });
    } else if (cfg.embedUrl) {
      var fr = document.createElement('iframe'); fr.src = cfg.embedUrl; fr.title = lang === 'ar' ? 'لوحة الأفكار' : 'Ideas board'; fr.loading = 'lazy'; fr.setAttribute('allow', 'clipboard-write');
      board.appendChild(fr);
    }
  })();

  (function langSwitch() {
    function target(to) {
      var p = location.pathname, isAr = /^\/ar(\/|$)/.test(p);
      if (to === 'ar') return (isAr ? p : '/ar' + p) + location.search + location.hash;
      return (isAr ? (p.replace(/^\/ar/, '') || '/') : p) + location.search + location.hash;
    }
    ['en', 'ar'].forEach(function (id) {
      var a = $(id); if (!a) return;
      var known = a.getAttribute('href') || '';
      // only step in where the built link does not already name this exact page
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
        var want = target(id), base = want.split('?')[0].split('#')[0];
        if (known === base && !location.search && !location.hash) return;
        e.preventDefault(); location.href = want;
      });
    });
  })();

  /* ── header: compact capsule once the page scrolls ───────────── */
  (function compactHeader() {
    var hd = document.querySelector('header.site'); if (!hd) return;
    var tick = false;
    function apply() { hd.classList.toggle('scrolled', (window.scrollY || document.documentElement.scrollTop || 0) > 24); tick = false; }
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(apply); } }, { passive: true });
    apply();
  })();

  /* ── community directory: filter + search over server-rendered cards ── */
  var grid = $('dir-grid');
  if (grid) {
    var filter = 'all', q = '';
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.pcard'));
    var empty = $('dir-empty');
    function applyDir() {
      var shown = 0, qq = q.trim().toLowerCase();
      cards.forEach(function (c) { var ok = (filter === 'all' || c.getAttribute('data-group') === filter) && (!qq || (c.getAttribute('data-search') || '').indexOf(qq) !== -1); c.hidden = !ok; if (ok) shown++; });
      if (cards.length && empty) { empty.hidden = shown > 0; empty.textContent = t('dirNoMatch'); }
    }
    document.querySelectorAll('#dir-filters .chip').forEach(function (b) {
      b.addEventListener('click', function () { filter = b.getAttribute('data-g'); document.querySelectorAll('#dir-filters .chip').forEach(function (x) { x.classList.toggle('on', x === b); }); applyDir(); });
    });
    var qi = $('dir-q'); if (qi) qi.addEventListener('input', function () { q = this.value; applyDir(); });
  }

  /* ── FAQ: search, topic chips, expand/collapse, deep links ───────── */
  (function faq() {
    var page = $('faq-page'); if (!page || !page.children.length) return;
    var items = Array.prototype.slice.call(page.querySelectorAll('.faq-item'));
    var secs = Array.prototype.slice.call(page.querySelectorAll('.faq-sec'));
    var q = $('faq-q'), count = $('faq-count'), toggle = $('faq-toggle'), empty = $('faq-empty'), clear = $('faq-clear');
    var chips = Array.prototype.slice.call(page.querySelectorAll('.faq-nav .chip'));
    var total = items.length;
    var countText = function (n) { return lang === 'ar' ? new Intl.NumberFormat('ar-SA-u-nu-arab').format(n) + ' ' + (n === 1 ? 'سؤال' : n === 2 ? 'سؤالان' : n <= 10 ? 'أسئلة' : 'سؤالًا') : n + ' question' + (n === 1 ? '' : 's'); };
    function norm(x) { return String(x || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim(); }
    items.forEach(function (d) { d.setAttribute('data-search', norm(d.getAttribute('data-search'))); });
    var wasOpen = null; // remembered open state while a search is active
    function apply() {
      var qq = norm(q.value), shown = 0;
      if (qq && !wasOpen) { wasOpen = items.map(function (d) { return d.open; }); }
      items.forEach(function (d) { var ok = !qq || d.getAttribute('data-search').indexOf(qq) !== -1; d.hidden = !ok; if (ok) shown++; if (qq && ok && qq.length >= 2) d.open = true; });
      if (!qq && wasOpen) { items.forEach(function (d, i) { d.open = wasOpen[i]; }); wasOpen = null; }
      secs.forEach(function (sec) {
        var n = sec.querySelectorAll('.faq-item:not([hidden])').length; sec.hidden = n === 0;
        var lab = sec.querySelector('.faq-sec-n'); if (lab) lab.textContent = countText(n);
        var chip = chips.filter(function (c) { return c.getAttribute('data-sec') === sec.getAttribute('data-sec'); })[0]; if (chip) chip.hidden = n === 0;
      });
      count.textContent = countText(shown); empty.hidden = shown > 0;
      try { var p = new URLSearchParams(location.search); if (qq) p.set('q', q.value.trim()); else p.delete('q'); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash); } catch (e) { /* ignore */ }
      syncToggle();
    }
    function syncToggle() { var vis = items.filter(function (d) { return !d.hidden; }), allOpen = vis.length > 0 && vis.every(function (d) { return d.open; }); toggle.textContent = toggle.getAttribute(allOpen ? 'data-collapse' : 'data-expand'); toggle.setAttribute('aria-pressed', allOpen ? 'true' : 'false'); }
    toggle.addEventListener('click', function () { var vis = items.filter(function (d) { return !d.hidden; }), allOpen = vis.every(function (d) { return d.open; }); vis.forEach(function (d) { d.open = !allOpen; }); wasOpen = null; syncToggle(); });
    q.addEventListener('input', apply);
    clear.addEventListener('click', function () { q.value = ''; apply(); q.focus(); });
    try { var p0 = new URLSearchParams(location.search); if (p0.get('q')) { q.value = p0.get('q'); } } catch (e) { /* ignore */ }
    // deep links: open the question named in the hash; write the hash when a question is opened
    function openHash() { var id = decodeURIComponent((location.hash || '').slice(1)); if (!id) return; var d = document.getElementById(id); if (d && d.classList.contains('faq-item')) { d.open = true; setTimeout(function () { d.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); } }
    items.forEach(function (d) {
      d.addEventListener('toggle', function () { if (d.open && !q.value) { try { history.replaceState(null, '', location.pathname + location.search + '#' + d.id); } catch (e) { /* ignore */ } } syncToggle(); });
      var cp = d.querySelector('.faq-copy');
      if (cp) cp.addEventListener('click', function () { var url = location.origin + location.pathname + '#' + d.id, keep = cp.textContent; var pr = (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(url) : Promise.reject(); pr.then(function () { cp.textContent = cp.getAttribute('data-copied'); }, function () { cp.textContent = url; }); setTimeout(function () { cp.textContent = keep; }, 2200); });
    });
    window.addEventListener('hashchange', openHash);
    // topic chips: highlight the section in view
    if ('IntersectionObserver' in window) {
      var current = null;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) current = en.target.getAttribute('data-sec'); });
        chips.forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-sec') === current); });
      }, { rootMargin: '-120px 0px -60% 0px', threshold: 0 });
      secs.forEach(function (sec) { io.observe(sec); });
    }
    window.addEventListener('beforeprint', function () { items.forEach(function (d) { d.open = true; }); });
    apply(); openHash();
  })();

  /* ── join form: three steps — category → status or interests → details and confirmation ─────────────────────
     Six categories. Four are memberships; the Mailing List and Volunteer Registration are separate and give no
     membership rights. Each step shows only what applies to the choices made so far: an answer that stops applying
     is cleared, is not checked and is not sent. The server applies the same rules again (netlify/lib/membership.mjs). */
  var form = $('join-form'); if (!form) return;
  var done = $('join-done');
  var I = lang === 'ar' ? 1 : 0, tx = function (pair) { return pair[I]; };
  var fees = SITE.fees || {};
  var PRICE = { saudi: 0, student: fees.student != null ? fees.student : 10, external: fees.external != null ? fees.external : 10, associate: fees.associate != null ? fees.associate : 15, mailing: 0, volunteer: 0 };
  var MEMBER = { saudi: 1, student: 1, external: 1, associate: 1 };
  /* status: [English, Arabic, kind]. The kind decides which details step 3 asks for. */
  var STATUS = {
    undergraduate: ['Undergraduate student', 'طالب بكالوريوس', 'student'], masters: ['Master’s student', 'طالب ماجستير', 'student'], doctoral: ['Doctoral student', 'طالب دكتوراه', 'student'], visiting_student: ['Visiting student', 'طالب زائر', 'student'],
    alumni: ['Oxford university alumnus', 'خريج إحدى جامعات أكسفورد', 'alumni'], academic_staff: ['Academic staff', 'عضو هيئة تدريس', 'academic'], researcher: ['Researcher / postdoctoral researcher', 'باحث أو باحث ما بعد الدكتوراه', 'academic'], visiting_researcher: ['Visiting researcher', 'باحث زائر', 'academic'],
    clinical_fellow: ['Clinical fellow', 'طبيب زمالة', 'clinical'], resident_doctor: ['Resident doctor', 'طبيب مقيم', 'clinical'], consultant: ['Consultant physician', 'طبيب استشاري', 'clinical'], healthcare: ['Other healthcare professional', 'ممارس صحي', 'health'],
    university_employee: ['University or research-institution employee', 'موظف في جامعة أو جهة بحثية', 'employee'], oxford_professional: ['Oxford-based professional or business owner', 'موظف أو صاحب عمل في مدينة أكسفورد', 'work'], other_connection: ['Other Oxford connection', 'صلة أخرى بأكسفورد', 'other'],
    professional: ['Employee or professional', 'موظف أو مهني', 'work'], supporter: ['Friend or supporter of the Society', 'صديق أو داعم للجمعية', 'none'], other: ['Other', 'أخرى', 'other']
  };
  var TIER_STATUS = {
    saudi: ['undergraduate', 'masters', 'doctoral', 'visiting_student', 'alumni', 'academic_staff', 'researcher', 'visiting_researcher', 'clinical_fellow', 'resident_doctor', 'consultant', 'healthcare', 'university_employee', 'oxford_professional', 'other_connection'],
    student: ['undergraduate', 'masters', 'doctoral', 'visiting_student'], external: ['undergraduate', 'masters', 'doctoral', 'visiting_student'],
    associate: ['academic_staff', 'researcher', 'visiting_researcher', 'university_employee', 'alumni', 'clinical_fellow', 'resident_doctor', 'consultant', 'healthcare', 'professional', 'supporter', 'other']
  };
  var STATUS_ALT = {
    associate: { researcher: ['Researcher', 'باحث'], university_employee: ['University employee', 'موظف جامعي'], alumni: ['Alumnus', 'خريج'] },
    external: { undergraduate: ['Undergraduate', 'بكالوريوس'], masters: ['Master’s', 'ماجستير'], doctoral: ['Doctorate', 'دكتوراه'] }
  };
  var PLACES = [['brookes', 'Oxford Brookes University', 'جامعة أكسفورد بروكس'], ['uk_university', 'Another UK university', 'جامعة أخرى داخل بريطانيا'], ['global_university', 'University outside the UK', 'جامعة خارج بريطانيا']];
  var INTERESTS = [['cultural', 'Cultural events', 'الفعاليات الثقافية'], ['social', 'Social gatherings', 'اللقاءات الاجتماعية'], ['academic', 'Academic events', 'الفعاليات الأكاديمية'], ['careers', 'Career opportunities', 'الفرص المهنية'], ['all_news', 'All Society news', 'جميع أخبار الجمعية']];
  var AREAS = [['events', 'Event organisation', 'تنظيم الفعاليات'], ['media', 'Media and design', 'الإعلام والتصميم'], ['photography', 'Photography and media coverage', 'التصوير والتغطية الإعلامية'], ['partnerships', 'Sponsorships and partnerships', 'الرعايات والشراكات'], ['welcome', 'Welcoming and supporting new students', 'استقبال ودعم الطلبة الجدد'], ['academic', 'Academic and professional programmes', 'البرامج الأكاديمية والمهنية'], ['admin', 'Administrative and organisational support', 'الدعم الإداري والتنظيمي']];
  var VOL_PLACE = { oxford: ['In Oxford', 'في أكسفورد'], remote: ['Remotely', 'عن بُعد'], both: ['Both', 'كلاهما'] };
  /* Words that change with the choices made: [label or heading, message when it is missing, placeholder] */
  var W = {
    h2: { saudi: ['What is your connection to Oxford?', 'ما علاقتك بأكسفورد؟'], student: ['Your status', 'صفتك الحالية'], associate: ['Your status', 'صفتك الحالية'], external: ['Where do you study?', 'أين تدرس؟'], mailing: ['Which topics interest you?', 'ما المواضيع التي تهمك؟'], volunteer: ['In which areas would you like to volunteer?', 'في أي المجالات ترغب بالتطوع؟'] },
    eyebrow2: { status: ['Step 2 of 3 · Your status', 'الخطوة ٢ من ٣ · صفتك الحالية'], interest: ['Step 2 of 3 · Your interests', 'الخطوة ٢ من ٣ · مجال الاهتمام'] },
    uniStudy: [['University', 'الجامعة'], ['Please choose your university.', 'يرجى اختيار الجامعة.']],
    uniGrad: [['University you graduated from', 'الجامعة التي تخرجت منها'], ['Please choose the university you graduated from.', 'يرجى اختيار الجامعة التي تخرجت منها.']],
    uniInst: [['University or institution', 'الجامعة أو الجهة التابع لها'], ['Please choose your university or institution.', 'يرجى اختيار الجامعة أو الجهة التابع لها.']],
    orgUni: [['University name', 'اسم الجامعة'], ['Please enter the name of your university.', 'يرجى إدخال اسم الجامعة.'], ['e.g. Oxford Brookes University', 'مثال: جامعة أكسفورد بروكس']],
    orgInst: [['Name of the university or institution', 'اسم الجامعة أو الجهة'], ['Please enter the name of the university or institution.', 'يرجى إدخال اسم الجامعة أو الجهة.'], ['', '']],
    orgGrad: [['Name of the university you graduated from', 'اسم الجامعة التي تخرجت منها'], ['Please enter the name of the university you graduated from.', 'يرجى إدخال اسم الجامعة التي تخرجت منها.'], ['', '']],
    orgHealth: [['Name of the hospital or healthcare organisation', 'اسم المستشفى أو الجهة الصحية'], ['Please enter the name of the hospital or healthcare organisation.', 'يرجى إدخال اسم المستشفى أو الجهة الصحية.'], ['', '']],
    orgWork: [['Employer or business name', 'جهة العمل أو اسم المنشأة'], ['Please enter your employer or business name.', 'يرجى إدخال جهة العمل أو اسم المنشأة.'], ['', '']],
    roleJob: [['Job title', 'الصفة الوظيفية'], ['Please enter your job title.', 'يرجى إدخال الصفة الوظيفية.'], ['e.g. Clinical Fellow in Cardiology', 'مثال: طبيب زمالة في أمراض القلب']],
    roleProf: [['Professional role', 'الصفة المهنية'], ['Please enter your professional role.', 'يرجى إدخال الصفة المهنية.'], ['e.g. Pharmacist', 'مثال: صيدلي']],
    roleWork: [['Nature of work or job title', 'طبيعة العمل أو المسمى الوظيفي'], ['Please enter the nature of your work or your job title.', 'يرجى إدخال طبيعة العمل أو المسمى الوظيفي.'], ['', '']],
    connSaudi: [['Explain your connection to Oxford', 'وضّح علاقتك بأكسفورد'], ['Please explain your connection to Oxford.', 'يرجى توضيح علاقتك بأكسفورد.']],
    connOther: [['Tell us about your status', 'وضّح صفتك'], ['Please tell us about your status in a few words.', 'يرجى توضيح صفتك بإيجاز.']],
    submit: { member: ['Send membership application', 'إرسال طلب العضوية'], volunteer: ['Send volunteer registration', 'إرسال طلب التطوع'], mailing: ['Subscribe to the mailing list', 'الاشتراك في القائمة البريدية'] },
    assess: { confirm: ['Please confirm your nationality, or switch off the assessment request.', 'يرجى تأكيد جنسيتك، أو ألغِ طلب التقييم.'], conn: ['Please answer the question about your connection to Oxford.', 'يرجى الإجابة عن سؤال صلتك بأكسفورد.'], offer: ['Switch to the free membership above, or switch off the assessment request.', 'انتقل إلى العضوية المجانية أعلاه، أو ألغِ طلب التقييم.'] },
    rev: { cat: ['Category', 'نوع العضوية'], fee: ['Fee', 'الرسوم'], status: ['Status', 'الصفة'], inst: ['Institution', 'الجهة'], name: ['Name', 'الاسم'], email: ['Email', 'البريد الإلكتروني'], topics: ['Topics', 'المواضيع'], areas: ['Volunteering areas', 'مجالات التطوع'], place: ['Preferred place', 'مكان التطوع المفضل'], missing: ['not filled in yet', 'لم يُدخل بعد'], hold: ['not requested while your eligibility is under review', 'لا تُطلب ما دام طلبك قيد التحقق من الأهلية'], all: ['All Society news', 'جميع أخبار الجمعية'] },
    codeOk: ['Code accepted — your membership fee is waived.', 'تم قبول الرمز — أُعفيت من رسوم العضوية.'], codeOff: ['Code accepted — {pct}% off. Your fee is now {fee}.', 'تم قبول الرمز — خصم {pct}٪. أصبحت الرسوم {fee}.'],
    codePersonal: ['This code is reserved for one email address, which is checked when you send the form.', 'هذا الرمز مخصّص لبريد إلكتروني واحد، ويُتحقق منه عند إرسال النموذج.']
  };
  function arDigits(n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.charAt(+d); }); }
  /* The fee as it is shown before sending: Free · £10 per year · ١٠ جنيهات إسترلينية سنويًا · ١٥ جنيهًا إسترلينيًا سنويًا */
  function feeText(n) {
    if (!(n > 0)) return tx(['Free', 'مجانية']);
    if (!I) return '£' + n + ' per year';
    if (n === 1) return 'جنيه إسترليني واحد سنويًا';
    if (n === 2) return 'جنيهان إسترلينيان سنويًا';
    return n <= 10 ? arDigits(n) + ' جنيهات إسترلينية سنويًا' : arDigits(n) + ' جنيهًا إسترلينيًا سنويًا';
  }
  var busy = false, last = null, step = 1, shownFor = null;
  var GLIDE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; // no gliding for people who ask for less motion
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, SSO_RE = /^[A-Za-z]{4}[0-9]{4}$/;
  var INPUT = { name: 'f-name', name_ar: 'f-name-ar', email: 'f-email', phone: 'f-phone', uniChoice: 'f-uni-choice', hospital: 'f-hospital', org: 'f-org', college: 'f-college', sso: 'f-sso', department: 'f-department', role: 'f-role', specialty: 'f-specialty', subject: 'f-subject', gradYear: 'f-grad-year', connection: 'f-connection', place: 'f-place' };
  var SEND_AS = { name: 'name', name_ar: 'nameAr', phone: 'phone', uniChoice: 'uniChoice', hospital: 'hospital', org: 'org', college: 'college', sso: 'sso', department: 'department', role: 'role', specialty: 'specialty', subject: 'subject', gradYear: 'gradYear', connection: 'connection', place: 'place' };
  function val(n) { var el = $(INPUT[n]); return el ? el.value.trim() : ''; }
  function radio(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }
  function ticked(name) { return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (c) { return c.value; }); }
  function cat() { return radio('tier'); }
  function tierName(c) { var r = form.querySelector('input[name="tier"][value="' + c + '"]'); return r ? r.closest('.tier').querySelector('.tn').textContent : ''; }
  function statusName(c, st) { var alt = (STATUS_ALT[c] || {})[st], s = alt || STATUS[st]; return s ? s[I] : ''; }
  function kindOf() { var c = cat(), st = radio('status'); if (!MEMBER[c] || !st || !STATUS[st]) return ''; return c === 'student' || c === 'external' ? 'student' : STATUS[st][2]; }
  function setErr(name, on) { var f = form.querySelector('[data-f="' + name + '"]'); if (!f) return; f.classList.toggle('err', !!on); var inp = f.querySelector('input,select,textarea'); if (inp) inp.setAttribute('aria-invalid', on ? 'true' : 'false'); }

  /* College / department: the suggestions are drawn by the page in the same style as the field (a browser's own
     suggestion list cannot be styled). Typing filters them; an answer that is not on the list is still accepted. */
  (function collegeCombo() {
    var input = $('f-college'), data = $('colleges'); if (!input || !data) return;
    var all = Array.prototype.map.call(data.querySelectorAll('option'), function (o) { return o.value; }).filter(Boolean);
    if (!all.length) return;
    input.removeAttribute('list'); // switch the browser's list off; ours replaces it
    var wrap = document.createElement('div'); wrap.className = 'combo'; input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    var list = document.createElement('ul'); list.className = 'combo-list'; list.id = 'college-list'; list.hidden = true;
    list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', lang === 'ar' ? 'اقتراحات الكليات' : 'College suggestions');
    wrap.appendChild(list);
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', 'college-list'); input.setAttribute('aria-expanded', 'false');
    var shown = [], active = -1, picking = false;
    function norm(v) { return String(v || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim(); }
    function matches(q) {
      q = norm(q); if (!q) return all.slice();
      var first = [], rest = [];
      all.forEach(function (v) { var n = norm(v), i = n.indexOf(q); if (i === -1) return; if (i === 0 || /[\s(]/.test(n.charAt(i - 1))) first.push(v); else rest.push(v); }); // words that start with what was typed come first
      return first.concat(rest);
    }
    function mark(v, q) { q = norm(q); var i = q ? v.toLowerCase().indexOf(q) : -1; return i < 0 ? esc(v) : esc(v.slice(0, i)) + '<b>' + esc(v.slice(i, i + q.length)) + '</b>' + esc(v.slice(i + q.length)); }
    function setActive(i) {
      active = i;
      Array.prototype.forEach.call(list.children, function (li, k) { li.classList.toggle('on', k === i); li.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      if (i < 0) { input.removeAttribute('aria-activedescendant'); return; }
      input.setAttribute('aria-activedescendant', 'college-opt-' + i);
      var li = list.children[i], top = li.offsetTop, bottom = top + li.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top - 6; else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 6;
    }
    function close() { list.hidden = true; wrap.classList.remove('open'); input.setAttribute('aria-expanded', 'false'); setActive(-1); }
    function open() {
      var q = input.value; shown = matches(q);
      if (!shown.length || (shown.length === 1 && norm(shown[0]) === norm(q))) return close(); // nothing to suggest, or already chosen
      list.innerHTML = shown.map(function (v, i) { return '<li role="option" id="college-opt-' + i + '" aria-selected="false" data-i="' + i + '">' + mark(v, q) + '</li>'; }).join('');
      list.hidden = false; list.scrollTop = 0; wrap.classList.add('open'); input.setAttribute('aria-expanded', 'true'); setActive(-1);
    }
    function choose(i) {
      if (i < 0 || i >= shown.length) return;
      input.value = shown[i]; close();
      picking = true; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); picking = false;
    }
    input.addEventListener('input', function () { if (!picking) open(); });
    input.addEventListener('focus', open);
    input.addEventListener('click', function () { if (list.hidden) open(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (list.hidden) { open(); if (list.hidden) return; }
        var n = shown.length; setActive(e.key === 'ArrowDown' ? (active + 1) % n : (active <= 0 ? n - 1 : active - 1));
      } else if (e.key === 'Enter') { if (!list.hidden && active >= 0) { e.preventDefault(); choose(active); } }
      else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); close(); } }
      else if (e.key === 'Tab') close();
    });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep the cursor in the field while a suggestion is picked
    list.addEventListener('click', function (e) { var li = e.target.closest ? e.target.closest('li[data-i]') : null; if (li) { choose(+li.getAttribute('data-i')); input.focus(); } });
    input.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== input) close(); }, 150); });
    document.addEventListener('pointerdown', function (e) { if (!wrap.contains(e.target)) close(); });
  })();

  /* ── step 2: drawn for the chosen category; choosing another category starts it afresh ─────────────────── */
  function cards(host, name, items) {
    var tones = ['green', 'gold', 'sky'];
    host.innerHTML = items.map(function (it, i) { return '<label class="tier stat compact" data-tone="' + tones[i % 3] + '"><input type="radio" name="' + name + '" value="' + esc(it[0]) + '"><span class="chk" aria-hidden="true"></span><span class="tn">' + esc(it[1]) + '</span></label>'; }).join('');
  }
  function switches(host, name, items) { host.innerHTML = items.map(function (it) { return '<label class="chk-l"><input type="checkbox" name="' + name + '" value="' + esc(it[0]) + '"><span>' + esc(it[1 + I]) + '</span></label>'; }).join(''); }
  function paintCards() { form.querySelectorAll('.tier').forEach(function (l) { var r = l.querySelector('input[type="radio"]'); if (r) l.classList.toggle('sel', r.checked); }); }
  function renderStep2() {
    var c = cat(), member = !!MEMBER[c];
    if (c !== shownFor) {
      shownFor = c;
      cards($('places'), 'uni_place', c === 'external' ? PLACES.map(function (p) { return [p[0], p[1 + I]]; }) : []);
      cards($('statuses'), 'status', member ? TIER_STATUS[c].map(function (k) { return [k, statusName(c, k)]; }) : []);
      switches($('interests'), 'interests', c === 'mailing' ? INTERESTS : []);
      switches($('areas'), 'areas', c === 'volunteer' ? AREAS : []);
      ['uniPlace', 'status', 'areas'].forEach(function (n) { setErr(n, false); });
    }
    $('status-h').textContent = tx(W.h2[c] || W.h2.student);
    $('step-2-eyebrow').textContent = tx(member ? W.eyebrow2.status : W.eyebrow2.interest);
    $('place-wrap').hidden = c !== 'external';
    $('interests-wrap').hidden = c !== 'mailing';
    $('areas-wrap').hidden = c !== 'volunteer';
    var levels = c === 'external'; // a student of another university says where first, then at what level
    $('status-wrap').hidden = !member || (levels && !radio('uni_place'));
    $('level-h').hidden = !levels;
    $('statuses').setAttribute('aria-label', tx(levels ? ['Level of study', 'المرحلة الدراسية'] : ['Status', 'الصفة']));
    $('places').setAttribute('aria-label', tx(W.h2.external));
    paintCards();
  }

  /* ── step 3: which details apply, by category and status ───────────────────────────────────────────────── */
  function plan() {
    var c = cat(), k = kindOf(), f = {};
    function add(n, req, words) { f[n] = { req: !!req, words: words || null }; }
    if (c === 'mailing') { add('name', false); add('email', true); return f; }
    add('name', true); add('name_ar', false); add('email', true); add('phone', false);
    if (c === 'volunteer') { add('place', true); return f; }
    if (c === 'student') { add('college', true); add('sso', false); }
    else if (c === 'external') { add('org', true, 'orgUni'); add('subject', false); }
    else if (k === 'student') { add('uniChoice', true, 'uniStudy'); if (val('uniChoice') === 'oxford') { add('college', true); add('sso', false); } else if (val('uniChoice') === 'other') add('org', true, 'orgInst'); }
    else if (k === 'alumni') { add('uniChoice', true, 'uniGrad'); if (val('uniChoice') === 'other') add('org', true, 'orgGrad'); add('gradYear', false); }
    else if (k === 'academic' || k === 'employee') { add('uniChoice', true, 'uniInst'); if (val('uniChoice') === 'other') add('org', true, 'orgInst'); add('department', k === 'academic'); if (val('uniChoice') === 'oxford') add('sso', false); }
    else if (k === 'clinical' || k === 'health') { add('hospital', true); if (val('hospital') === 'other') add('org', true, 'orgHealth'); else if (val('hospital') === 'ouh_other') add('org', false, 'orgHealth'); add('role', true, k === 'clinical' ? 'roleJob' : 'roleProf'); add('specialty', k === 'clinical'); }
    else if (k === 'work') { add('org', true, 'orgWork'); add('role', true, 'roleWork'); }
    else if (k === 'other') add('connection', true, c === 'saudi' ? 'connSaudi' : 'connOther');
    if (MEMBER[c]) add('volExtra', false);
    return f;
  }
  function clearIn(box) { box.querySelectorAll('input,select,textarea').forEach(function (el) { if (el.type === 'checkbox' || el.type === 'radio') el.checked = false; else el.value = ''; }); box.classList.remove('err'); }
  function showRow(name, on) { var f = form.querySelector('[data-f="' + name + '"]'); if (!f) return null; if (!on && !f.hidden) clearIn(f); f.hidden = !on; return f; }
  function syncFields() {
    var c = cat(), p = plan(), paid = PRICE[c] > 0;
    Object.keys(INPUT).concat(['volExtra']).forEach(function (n) {
      var f = showRow(n, !!p[n]); if (!f || !p[n]) return;
      var req = f.querySelector('.lbl .req'), opt = f.querySelector('.lbl .opt'), w = p[n].words ? W[p[n].words] : null;
      if (req) req.hidden = !p[n].req; if (opt) opt.hidden = p[n].req;
      if (w) { var lt = f.querySelector('.lt'), mt = f.querySelector('.mt'), el = $(INPUT[n]); if (lt) lt.textContent = tx(w[0]); if (mt) mt.textContent = tx(w[1]); if (el && w[2]) el.placeholder = tx(w[2]); }
    });
    if (c === 'external' && radio('uni_place') === 'brookes' && !val('org')) $('f-org').value = 'Oxford Brookes University';
    $('email-hint').hidden = !(c === 'student' || (p.college && c === 'saudi'));
    $('connection-hint').hidden = !(p.connection && c === 'saudi');
    showRow('confirmSaudi', c === 'saudi');
    showRow('whatsapp', c !== 'mailing');
    $('news-req').hidden = c !== 'mailing'; if (c !== 'mailing') setErr('consentNews', false);
    showRow('assess', paid); showRow('feeCode', paid); if (!paid) codeState(null);
    syncAssess();
    $('submit-label').textContent = tx(W.submit[MEMBER[c] ? 'member' : c] || W.submit.member);
    review();
  }

  /* ── free-membership assessment (paid categories only, and only for those who ask) ─────────────────────── */
  function connEvident() { var c = cat(); return c === 'student' || (c === 'external' && radio('uni_place') === 'brookes'); } // studying at an Oxford university is itself the connection
  function assessState() {
    var c = cat(); if (!(PRICE[c] > 0) || !$('f-assess').checked) return '';
    if (!$('f-assess-saudi').checked) return 'confirm';
    var conn = connEvident() ? 'yes' : $('f-assess-conn').value;
    return !conn ? 'conn' : conn === 'yes' ? 'offer' : 'review';
  }
  function syncAssess() {
    var on = $('f-assess').checked, st = assessState();
    $('assess-more').hidden = !on;
    $('assess-conn-wrap').hidden = connEvident() || !$('f-assess-saudi').checked;
    $('assess-offer').hidden = st !== 'offer'; $('assess-review').hidden = st !== 'review';
    setErr('assess', false); // whatever was missing is being answered; it is checked again on sending
  }
  $('assess-switch').addEventListener('click', function () {
    var from = cat(), st = radio('status'), place = radio('uni_place');
    var map = { professional: 'oxford_professional' }, keep = map[st] || st;
    form.querySelector('input[name="tier"][value="saudi"]').checked = true;
    onCategory(); renderStep2();
    if (from === 'external' && place !== 'brookes') keep = ''; // studying elsewhere: the Oxford connection is something else, so it is chosen afresh
    var target = keep && TIER_STATUS.saudi.indexOf(keep) !== -1 ? form.querySelector('input[name="status"][value="' + keep + '"]') : null;
    if (target) target.checked = true;
    if (STATUS[keep] && STATUS[keep][2] === 'student') $('f-uni-choice').value = from === 'external' ? 'brookes' : 'oxford';
    $('switch-note').hidden = false;
    show(2, true);
  });

  /* ── discount or exemption code: the server looks the code up in its records; nothing is decided from its shape ── */
  var codeOk = false, codeAmount = null;
  function codeState(kind, text) { var p = $('fee-code-state'); if (!p) return; codeOk = kind === 'ok'; if (!codeOk) codeAmount = null; p.hidden = !kind; p.className = 'code-state' + (kind ? ' is-' + kind : ''); p.textContent = text || ''; if (kind !== 'bad') setErr('feeCode', false); }
  (function () {
    var inp = $('f-fee-code'), btn = $('fee-code-btn'); if (!inp || !btn) return;
    async function check() {
      var c = cat(), code = inp.value.trim();
      if (!code) { codeState('bad', t('codeEmpty')); inp.focus(); return; }
      var em = val('email');
      btn.disabled = true; codeState('wait', t('codeChecking'));
      try {
        var r = await fetch((SITE.apiBase || '/api') + '/membership/code', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ code: code, tier: c, email: EMAIL_RE.test(em) ? em : '' }) });
        var d = null; try { d = await r.json(); } catch (e) { /* not json */ }
        if (r.status === 429) codeState('bad', t('codeBad').rate);
        else if (r.ok && d && d.ok) { codeState('ok', (d.percent >= 100 ? tx(W.codeOk) : tx(W.codeOff).replace('{pct}', I ? arDigits(d.percent) : d.percent).replace('{fee}', feeText(d.amountGbp))) + (d.personal && !em ? ' ' + tx(W.codePersonal) : '')); codeAmount = d.amountGbp; }
        else if (r.ok && d) codeState('bad', t('codeBad')[d.reason] || t('codeBad').invalid);
        else codeState('wait', t('codeBad').net);
      } catch (e) { codeState('wait', t('codeBad').net); }
      btn.disabled = false; review();
    }
    btn.addEventListener('click', check);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    inp.addEventListener('input', function () { var v = inp.value.toUpperCase(); if (v !== inp.value) inp.value = v; if (!$('fee-code-state').hidden) { codeState(null); review(); } });
  })();
  (function () {
    var ssoIn = $('f-sso'); if (!ssoIn) return;
    // letters and digits only, lower case, as the username is written by the University
    ssoIn.addEventListener('input', function () { var v = ssoIn.value.replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 8); if (v !== ssoIn.value) ssoIn.value = v; if (!v || SSO_RE.test(v)) setErr('sso', false); });
    ssoIn.addEventListener('blur', function () { var v = ssoIn.value.trim(); if (v && !SSO_RE.test(v)) setErr('sso', true); });
    $('f-grad-year').addEventListener('input', function () { var v = this.value.replace(/\D/g, '').slice(0, 4); if (v !== this.value) this.value = v; });
  })();

  /* ── the review shown before sending: category, fee, status, institution and the applicant's own details ── */
  function feeLine() {
    var c = cat(), price = PRICE[c] || 0; if (!MEMBER[c]) return '';
    if (!price) return feeText(0);
    if (assessState() === 'review') return feeText(price) + ' — ' + tx(W.rev.hold);
    return feeText(codeOk && codeAmount != null ? codeAmount : price);
  }
  function institution() {
    var p = plan(), parts = [], pickText = function (id) { var s = $(id); return s && s.value ? s.options[s.selectedIndex].text : ''; };
    if (cat() === 'student') parts.push(tx(['University of Oxford', 'جامعة أكسفورد']));
    if (p.uniChoice && val('uniChoice') !== 'other') parts.push(pickText('f-uni-choice'));
    if (p.hospital && val('hospital') !== 'other') parts.push(pickText('f-hospital'));
    if (p.org && val('org')) parts.push(val('org'));
    if (p.college && val('college')) parts.push(val('college'));
    return parts.filter(Boolean).join(I ? '، ' : ', ');
  }
  function review() {
    var host = $('review-list'); if (!host) return;
    var c = cat(), R = W.rev, rows = [], sep = I ? '، ' : ', ', names = function (list, picked) { return list.filter(function (x) { return picked.indexOf(x[0]) !== -1; }).map(function (x) { return x[1 + I]; }).join(sep); };
    rows.push([R.cat, tierName(c), true]);
    if (MEMBER[c]) {
      rows.push([R.fee, feeLine(), true]);
      var pl = PLACES.filter(function (x) { return x[0] === radio('uni_place'); })[0];
      rows.push([R.status, [c === 'external' && pl ? pl[1 + I] : '', statusName(c, radio('status'))].filter(Boolean).join(' · '), true]);
      var inst = institution(); if (inst || kindOf() !== 'none') rows.push([R.inst, inst, !(kindOf() === 'none' || kindOf() === 'other')]);
    }
    if (c === 'mailing') rows.push([R.topics, names(INTERESTS, ticked('interests')) || tx(R.all), true]);
    if (c === 'volunteer') { rows.push([R.areas, names(AREAS, ticked('areas')), true]); rows.push([R.place, VOL_PLACE[val('place')] ? tx(VOL_PLACE[val('place')]) : '', true]); }
    if (c !== 'mailing' || val('name')) rows.push([R.name, val('name'), c !== 'mailing']);
    rows.push([R.email, val('email'), true, true]);
    host.innerHTML = rows.filter(function (r) { return r[1] || r[2]; }).map(function (r) { return '<dt>' + esc(tx(r[0])) + '</dt><dd' + (r[3] ? ' dir="ltr"' : '') + '>' + (r[1] ? esc(r[1]) : '<span class="rev-miss">' + esc(tx(R.missing)) + '</span>') + '</dd>'; }).join('');
    $('sum').textContent = MEMBER[c] ? tx(R.fee) + ': ' + feeLine() : '';
  }

  /* ── moving between the steps ──────────────────────────────────────────────────────────────────────────── */
  function show(n, focus) {
    step = n;
    [1, 2, 3].forEach(function (i) { $('step-' + i).hidden = i !== n; });
    document.querySelectorAll('#steps li').forEach(function (li) { var k = +li.getAttribute('data-step'); li.classList.toggle('on', k === n); li.classList.toggle('done', k < n); if (k === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    $('err-sum').classList.remove('on');
    if (n === 2) renderStep2();
    if (n !== 2) $('switch-note').hidden = true;
    if (n === 3) syncFields();
    if (focus) { $('join-form-band').scrollIntoView({ behavior: GLIDE, block: 'start' }); var h = $('step-' + n).querySelector('.step-h'); if (h) setTimeout(function () { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }, 60); }
  }
  function fail(bad) { // show what is missing in the current step and go to the first of it
    $('err-sum').classList.toggle('on', bad.length > 0);
    if (!bad.length) return true;
    var el = $(bad[0]); if (el) { if (el.focus) el.focus({ preventScroll: true }); el.scrollIntoView({ behavior: GLIDE, block: 'center' }); }
    return false;
  }
  function validate1() { var c = cat(); $('tier-msg').style.display = c ? 'none' : 'block'; $('tiers').classList.toggle('err', !c); return fail(c ? [] : ['tiers']); }
  function validate2() {
    var c = cat(), bad = [];
    if (c === 'external') { var noPlace = !radio('uni_place'); setErr('uniPlace', noPlace); if (noPlace) bad.push('places'); }
    if (MEMBER[c] && !bad.length) { var noStatus = !radio('status'); setErr('status', noStatus); if (noStatus) bad.push('statuses'); }
    if (c === 'volunteer') { var none = !ticked('areas').length; setErr('areas', none); if (none) bad.push('areas'); }
    return fail(bad);
  }
  function validate3() {
    var c = cat(), p = plan(), bad = [];
    function mark(name, id, isBad) { setErr(name, isBad); if (isBad) bad.push(id); }
    Object.keys(INPUT).forEach(function (n) {
      if (!p[n]) return;
      var v = val(n), el = $(INPUT[n]), isBad = false;
      if (n === 'email') isBad = !EMAIL_RE.test(v);
      else if (n === 'sso') isBad = !!v && !SSO_RE.test(v);
      else if (n === 'gradYear') isBad = !!v && !(/^\d{4}$/.test(v) && +v >= 1950 && +v <= new Date().getFullYear() + 1);
      else if (p[n].req) isBad = v.length < (el.tagName === 'SELECT' ? 1 : n === 'connection' ? 5 : 2);
      mark(n, INPUT[n], isBad);
    });
    var as = assessState();
    if (as === 'confirm' || as === 'conn' || as === 'offer') { $('assess-msg').textContent = tx(W.assess[as]); mark('assess', as === 'conn' ? 'f-assess-conn' : as === 'offer' ? 'assess-switch' : 'f-assess-saudi', true); } else setErr('assess', false);
    if (c === 'saudi') mark('confirmSaudi', 'f-confirm-saudi', !$('f-confirm-saudi').checked);
    mark('consent', 'f-consent', !$('f-consent').checked);
    if (c === 'mailing') mark('consentNews', 'f-news', !$('f-news').checked);
    return fail(bad);
  }
  /* Choosing another category starts steps 2 and 3 afresh for it: answers that belonged to the old one are cleared. */
  function onCategory() {
    paintCards();
    var c = cat(); if (c) { $('tier-msg').style.display = 'none'; $('tiers').classList.remove('err'); }
    if (c !== shownFor) { codeState(null); $('f-fee-code').value = ''; clearIn($('assess')); form.querySelectorAll('#vol-extra input').forEach(function (x) { x.checked = false; }); }
  }
  form.addEventListener('change', function (e) {
    var n = e.target.name;
    if (n === 'tier') onCategory();
    if (n === 'uni_place') { paintCards(); setErr('uniPlace', false); renderStep2(); }
    if (n === 'status') { paintCards(); setErr('status', false); }
    if (n === 'areas') setErr('areas', false);
    if (step === 3) { if (n === 'uni_choice' || n === 'hospital') syncFields(); else { syncAssess(); review(); } }
  });
  form.addEventListener('input', function (e) {
    var f = e.target.closest ? e.target.closest('[data-f]') : null;
    if (f && f.classList.contains('err') && e.target.type !== 'checkbox') f.classList.remove('err');
    if (step === 3) review();
  });
  ['f-consent', 'f-news', 'f-confirm-saudi'].forEach(function (id) { $(id).addEventListener('change', function () { if (this.checked) setErr(this.closest('[data-f]').getAttribute('data-f'), false); }); });
  form.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('data-go') === 'prev') return show(Math.max(1, step - 1), true);
      if (step === 1 ? validate1() : validate2()) show(step + 1, true);
    });
  });
  document.querySelectorAll('#steps li').forEach(function (li) { li.addEventListener('click', function () { var k = +li.getAttribute('data-step'); if (k < step && !form.hidden) show(k, true); }); });
  switches($('vol-extra'), 'vol_extra', AREAS);

  /* Submission goes to the society's own database (/api/membership/apply), which issues a permanent
     membership number and a place in the review queue. Nothing is claimed until the server answers. */
  var M = {
    en: {
      eyebrowNew: 'Application received', eyebrowUpdated: 'Application updated', eyebrowAgain: 'You have already applied', eyebrowMember: 'You are already a member',
      thanks: 'Thank you, {name}.', welcomeBack: 'Welcome back, {name}.', thanksPlain: 'Thank you.',
      ledeNew: 'Your application is with the committee. Keep your membership number: quote it in anything you send us.',
      ledeAgain: 'We already have your application, so nothing new was submitted. Here is where it stands.', feeWaived: 'Your membership fee has been waived with your code. There is nothing to pay.', feeDiscounted: 'Your discount code has been applied to the fee shown here.',
      ledeUpdated: 'We already had an application from this email address, so we have updated it with your new answers. It keeps its number and its place in the queue.',
      changeHow: 'To change your answers, sign in on the My account page first (we email you a sign-in link), then send this form again.', changeBtn: 'Sign in to My account',
      ledeMember: 'This email address already belongs to an active membership.',
      org: 'Oxford Saudi Society', noLabel: 'Membership number', nameL: 'Name', typeL: 'Membership', appliedL: 'Applied', statusL: 'Status', feeL: 'Fee', copy: 'Copy number', copied: 'Copied',
      qL: 'Your place in the review queue', qP: 'The committee reviews applications in the order they arrive. You will get an email as soon as yours is decided.',
      t1: 'Application received', t2: 'Committee review', t2e: 'Eligibility check', t3pay: 'Payment of {amount}', t3verify: 'Eligibility confirmed', t4: 'Membership active',
      payH: 'Membership fee: {amount}', payP: 'Use your membership number as the payment reference so the treasurer can match it. Membership becomes active once the payment is confirmed.', payLater: 'The treasurer will email you how to pay. Use your membership number as the payment reference; membership becomes active once the payment is confirmed.',
      verifyH: 'Confirming your eligibility', verifyP: 'Nothing is needed from you now. The committee’s secretary will email you later to ask for proof of Saudi nationality, if it is needed. Please do not send any identity document until you are asked. Free membership becomes active once eligibility is confirmed.',
      eligH: 'Awaiting eligibility check', eligP: 'The committee will review whether you qualify for the free Saudi Oxford Community Membership and email you its decision. You will not be asked to pay anything while it is under review.', eligSaudiP: 'The committee will review your connection to Oxford and email you its decision.',
      mailNote: 'We have sent a confirmation to <b dir="ltr">{email}</b>. Its link lets you follow your application and answer any question from the committee.',
      track: 'Track my application', print: 'Save or print', again: 'Send another form', account: 'Go to My account',
      volEyebrow: 'Volunteer registration received', volLede: 'Thank you for offering your time. The committee has your registration and will be in touch when there is something that suits you. This is separate from membership and does not make you a member.', volUpdated: 'Your volunteer registration has been updated.',
      volLocked: 'A volunteer registration already exists for this email address. To change it, sign in on the My account page first (we email you a sign-in link), then send this form again.', volMail: 'We have sent a confirmation to <b dir="ltr">{email}</b>. Its link opens your account, where you can change or withdraw your registration.',
      subEyebrow: 'You are on the mailing list', subLede: 'We will email you Society news and events. The mailing list is separate from membership and does not make you a member.', subMail: 'We have sent a confirmation to <b dir="ltr">{email}</b>. Please open its link to confirm the address is yours. You can unsubscribe at any time from My account.',
      failH: 'Your form was not sent', fail: 'We could not reach the membership system just now. Your answers are still in the form: please press the button again in a minute.', failMail: 'If it keeps failing, email {email}.',
      rate: 'Too many attempts from this connection. Please wait a few minutes and try again.'
    },
    ar: {
      eyebrowNew: 'تم استلام الطلب', eyebrowUpdated: 'تم تحديث الطلب', eyebrowAgain: 'لقد تقدّمت بطلب من قبل', eyebrowMember: 'أنت عضو بالفعل',
      thanks: 'شكرًا لك يا {name}.', welcomeBack: 'أهلًا بعودتك يا {name}.', thanksPlain: 'شكرًا لك.',
      ledeNew: 'طلبك الآن لدى اللجنة. احتفظ برقم عضويتك واذكره في أي مراسلة معنا.',
      ledeAgain: 'طلبك موجود لدينا، فلم يُرسل طلب جديد. هذا وضع طلبك الآن.', feeWaived: 'أُعفيت من رسوم العضوية بموجب الرمز الذي أدخلته، فلا يلزمك دفع شيء.', feeDiscounted: 'طُبّق رمز الخصم على الرسوم الظاهرة هنا.',
      ledeUpdated: 'لدينا طلب سابق من هذا البريد الإلكتروني، فحدّثناه بإجاباتك الجديدة. يحتفظ الطلب برقمه وبترتيبه في قائمة المراجعة.',
      changeHow: 'لتعديل إجاباتك، سجّل الدخول أولًا من صفحة «حسابي» (نرسل لك رابط دخول بالبريد)، ثم أرسل هذا النموذج مرة أخرى.', changeBtn: 'سجّل الدخول إلى حسابي',
      ledeMember: 'هذا البريد مرتبط بعضوية فعّالة.',
      org: 'الجمعية السعودية في أكسفورد', noLabel: 'رقم العضوية', nameL: 'الاسم', typeL: 'العضوية', appliedL: 'تاريخ الطلب', statusL: 'الصفة', feeL: 'الرسوم', copy: 'نسخ الرقم', copied: 'تم النسخ',
      qL: 'ترتيبك في قائمة المراجعة', qP: 'تراجع اللجنة الطلبات بحسب ترتيب وصولها، وستصلك رسالة بالبريد فور البت في طلبك.',
      t1: 'تم استلام الطلب', t2: 'مراجعة اللجنة', t2e: 'التحقق من الأهلية', t3pay: 'سداد {amount}', t3verify: 'تأكيد الأهلية', t4: 'العضوية فعّالة',
      payH: 'رسوم العضوية: {amount}', payP: 'اكتب رقم عضويتك مرجعًا للدفع ليتمكن أمين الصندوق من مطابقته. تُفعَّل العضوية بعد تأكيد السداد.', payLater: 'سيراسلك أمين الصندوق بطريقة الدفع. اكتب رقم عضويتك مرجعًا للدفع، وتُفعَّل العضوية بعد تأكيد السداد.',
      verifyH: 'تأكيد الأهلية', verifyP: 'لا يلزمك فعل شيء الآن. سيراسلك أمين سر مجلس إدارة الجمعية لاحقًا لطلب إثبات الجنسية السعودية عند الحاجة. يرجى عدم إرسال أي وثيقة هوية قبل أن يُطلب منك ذلك. تُفعَّل العضوية المجانية بعد تأكيد الأهلية.',
      eligH: 'بانتظار التحقق من الأهلية', eligP: 'ستراجع اللجنة أهليتك لعضوية السعوديين في أكسفورد المجانية وتبلغك بقرارها بالبريد الإلكتروني. لن تُطلب منك أي رسوم ما دام طلبك قيد المراجعة.', eligSaudiP: 'ستراجع اللجنة صلتك بأكسفورد وتبلغك بقرارها بالبريد الإلكتروني.',
      mailNote: 'أرسلنا تأكيدًا إلى <b dir="ltr">{email}</b>، ويتيح لك الرابط فيه متابعة طلبك والإجابة عن أي سؤال من اللجنة.',
      track: 'تابع طلبي', print: 'حفظ أو طباعة', again: 'إرسال نموذج آخر', account: 'الانتقال إلى حسابي',
      volEyebrow: 'تم استلام طلب التطوع', volLede: 'شكرًا لرغبتك في المشاركة بوقتك. وصل طلبك إلى اللجنة وستتواصل معك عند توفر ما يناسبك. التسجيل للتطوع مستقل عن العضوية ولا يجعلك عضوًا.', volUpdated: 'تم تحديث طلب التطوع الخاص بك.',
      volLocked: 'يوجد طلب تطوع مسجّل بهذا البريد الإلكتروني. لتعديله، سجّل الدخول أولًا من صفحة «حسابي» (نرسل لك رابط دخول بالبريد)، ثم أرسل هذا النموذج مرة أخرى.', volMail: 'أرسلنا تأكيدًا إلى <b dir="ltr">{email}</b>، ويفتح الرابط فيه حسابك حيث يمكنك تعديل طلبك أو سحبه.',
      subEyebrow: 'تم اشتراكك في القائمة البريدية', subLede: 'سنرسل لك أخبار الجمعية وفعالياتها. القائمة البريدية مستقلة عن العضوية ولا تجعلك عضوًا.', subMail: 'أرسلنا تأكيدًا إلى <b dir="ltr">{email}</b>. يرجى فتح الرابط فيه لتأكيد أن البريد لك. يمكنك إلغاء الاشتراك في أي وقت من «حسابي».',
      failH: 'لم يُرسل النموذج', fail: 'تعذّر الوصول إلى نظام العضوية الآن. إجاباتك ما زالت في النموذج؛ اضغط الزر مرة أخرى بعد دقيقة.', failMail: 'إن تكرر الخطأ فراسلنا على {email}.',
      rate: 'محاولات كثيرة من هذا الاتصال. انتظر بضع دقائق ثم حاول مجددًا.'
    }
  };
  function m(key, vars) { var v = (M[lang][key] !== undefined ? M[lang][key] : M.en[key]); if (typeof v === 'string' && vars) Object.keys(vars).forEach(function (k) { v = v.split('{' + k + '}').join(vars[k]); }); return v; }
  function fmtDay(d) { try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-arab' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }).format(new Date(d)); } catch (e) { return ''; } }
  function num(n) { return lang === 'ar' ? new Intl.NumberFormat('ar-SA-u-nu-arab').format(n) : String(n); }
  /* Only what applies to the choices made is sent. */
  function collect() {
    var c = cat(), p = plan(), o = { tier: c, lang: lang, privacy_version: SITE.privacyVersion || '', website: form.querySelector('input[name="website"]').value, consent_privacy: $('f-consent').checked, consent_news: $('f-news').checked, email: val('email') };
    Object.keys(SEND_AS).forEach(function (n) { if (p[n]) o[SEND_AS[n]] = n === 'sso' ? val(n).toLowerCase() : val(n); });
    if (MEMBER[c]) {
      o.status = radio('status'); if (c === 'external') o.uniPlace = radio('uni_place');
      o.whatsapp = $('f-whatsapp').checked; o.volunteerAreas = ticked('vol_extra');
      if (c === 'saudi') o.confirm_saudi = $('f-confirm-saudi').checked;
      if (PRICE[c] > 0) { o.feeCode = $('f-fee-code').value.trim(); if (assessState() === 'review') { o.freeAssess = true; o.confirm_saudi = true; } }
    }
    if (c === 'mailing') o.interests = ticked('interests');
    if (c === 'volunteer') { o.areas = ticked('areas'); o.whatsapp = $('f-whatsapp').checked; }
    return o;
  }
  async function send(app) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    try {
      var r = await fetch((SITE.apiBase || '/api') + '/membership/apply', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(app), signal: ctl ? ctl.signal : undefined });
      var data = null; try { data = await r.json(); } catch (e) { /* not json */ }
      return { ok: r.ok, status: r.status, data: data };
    } catch (e) { return { ok: false, status: 0, data: null }; }
    finally { clearTimeout(timer); }
  }
  function showFail(res) {
    var box = $('join-fail');
    if (!box) { box = document.createElement('div'); box.id = 'join-fail'; box.className = 'err-sum on'; box.setAttribute('role', 'alert'); $('submit-btn').parentNode.parentNode.insertBefore(box, $('submit-btn').parentNode); }
    if (res.status === 400 && res.data && res.data.fields) {
      var fields = res.data.fields, keys = Object.keys(fields);
      // the server found something the page did not: open the step it belongs to and highlight it
      var where = fields.tier ? 1 : (fields.status || fields.uniPlace || fields.areas) ? 2 : 3;
      if (step !== where) show(where, false);
      if (fields.tier) { $('tier-msg').style.display = 'block'; $('tiers').classList.add('err'); }
      if (fields.feeCode) { codeState('bad', t('codeBad')[fields.feeCode] || t('codeBad').invalid); setErr('feeCode', true); review(); }
      keys.forEach(function (k) { if (k === 'confirmSaudi' && cat() !== 'saudi') { $('assess-msg').textContent = tx(W.assess.confirm); setErr('assess', true); } else if (k !== 'tier' && k !== 'feeCode') setErr(k, true); });
      box.hidden = true; $('err-sum').classList.add('on');
      var first = form.querySelector('#step-' + where + ' .err'); if (first) first.scrollIntoView({ behavior: GLIDE, block: 'center' });
      return;
    }
    box.hidden = false;
    box.innerHTML = '<b>' + esc(m('failH')) + '</b> ' + esc(res.status === 429 ? m('rate') : m('fail')) + (res.status === 429 ? '' : ' ' + m('failMail', { email: SITE.email ? '<a href="mailto:' + esc(SITE.email) + '">' + esc(SITE.email) + '</a>' : '' }));
    box.scrollIntoView({ behavior: GLIDE, block: 'center' });
  }
  form.addEventListener('submit', async function (e) {
    e.preventDefault(); if (busy) return;
    if (form.querySelector('input[name="website"]').value) return;
    if (step === 1) { if (validate1()) show(2, true); return; }
    if (step === 2) { if (validate2()) show(3, true); return; }
    if (!validate3()) return;
    busy = true; var btn = $('submit-btn'), lbl = $('submit-label'), keep = lbl.innerHTML; btn.disabled = true; lbl.textContent = t('sending');
    var app = null, res;
    // never leave the button stuck on "Sending…": any unexpected error ends in the visible failure message
    try { app = collect(); res = await send(app); } catch (err) { res = { ok: false, status: 0, data: null }; }
    finally { busy = false; btn.disabled = false; lbl.innerHTML = keep; }
    if (!res.ok || !res.data || !res.data.result || res.data.honeypot) { showFail(res); return; }
    var f = $('join-fail'); if (f) f.hidden = true;
    last = { app: app, data: res.data }; renderDone();
  });
  function finish(h) {
    h += '<p class="again"><a href="#join-form-band" id="again">' + esc(m('again')) + '</a></p>';
    done.innerHTML = h; done.hidden = false; form.hidden = true;
    document.querySelectorAll('#steps li').forEach(function (li) { li.classList.remove('on'); li.classList.add('done'); li.removeAttribute('aria-current'); });
    $('again').addEventListener('click', function (ev) {
      ev.preventDefault(); last = null; form.reset(); shownFor = null; codeState(null); paintCards();
      form.querySelectorAll('.f.err').forEach(function (x) { x.classList.remove('err'); });
      done.hidden = true; form.hidden = false; show(1, true);
    });
    $('join-form-band').scrollIntoView({ behavior: GLIDE });
  }
  var accountUrl = (lang === 'ar' ? '/ar' : '') + '/account/';
  function renderDone() {
    var d = last.data, app = last.app;
    if (d.kind === 'mailing') return finish('<p class="eyebrow">' + esc(m('subEyebrow')) + '</p><h2 class="done-h">' + esc(m('thanksPlain')) + '</h2><p class="lede done-lede">' + esc(m('subLede')) + '</p><p class="muted done-mail">' + m('subMail', { email: esc(app.email) }) + '</p><div class="done-actions"><a class="btn btn-p" href="' + accountUrl + '">' + esc(m('account')) + '</a></div>');
    if (d.kind === 'volunteer') {
      var first0 = esc((app.name || '').split(/\s+/)[0]);
      if (d.needsSignIn) return finish('<p class="eyebrow">' + esc(m('eyebrowAgain')) + '</p><h2 class="done-h">' + esc(m('welcomeBack', { name: first0 })) + '</h2><p class="note">' + esc(m('volLocked')) + '</p><div class="done-actions"><a class="btn btn-p" href="' + accountUrl + '">' + esc(m('changeBtn')) + '</a></div>');
      var v = d.volunteer || {}, sep = I ? '، ' : ', ';
      var areaNames = AREAS.filter(function (x) { return (v.areas || []).indexOf(x[0]) !== -1; }).map(function (x) { return x[1 + I]; }).join(sep);
      return finish('<p class="eyebrow">' + esc(m('volEyebrow')) + '</p><h2 class="done-h">' + esc(m('thanks', { name: first0 })) + '</h2><p class="lede done-lede">' + esc(d.result === 'volunteer_updated' ? m('volUpdated') + ' ' : '') + esc(m('volLede')) + '</p>' +
        '<dl class="kv done-kv"><dt>' + esc(tx(W.rev.areas)) + '</dt><dd>' + esc(areaNames) + '</dd><dt>' + esc(tx(W.rev.place)) + '</dt><dd>' + esc(VOL_PLACE[v.place] ? tx(VOL_PLACE[v.place]) : '') + '</dd></dl>' +
        '<p class="muted done-mail">' + m('volMail', { email: esc(app.email) }) + '</p><div class="done-actions"><a class="btn btn-p" href="' + accountUrl + '">' + esc(m('account')) + '</a></div>');
    }
    var mem = d.member, kind = d.result;
    var first = esc((app.name || mem.name || '').split(/\s+/)[0]);
    var fee = (mem.fee && mem.fee[lang]) || feeText(mem.amountGbp || 0), paid = mem.amountGbp > 0, isMember = mem.status === 'approved', elig = mem.stage === 'eligibility';
    var verify = mem.tier === 'saudi' && mem.nationalityStatus !== 'verified';
    var h = '<p class="eyebrow">' + esc(m(kind === 'already_member' ? 'eyebrowMember' : kind === 'already' ? 'eyebrowAgain' : kind === 'updated' ? 'eyebrowUpdated' : 'eyebrowNew')) + '</p>';
    h += '<h2 class="done-h">' + esc(m(kind === 'received' ? 'thanks' : 'welcomeBack', { name: first })) + '</h2>';
    h += '<p class="lede done-lede">' + esc(m(kind === 'already_member' ? 'ledeMember' : kind === 'already' ? 'ledeAgain' : kind === 'updated' ? 'ledeUpdated' : 'ledeNew')) + '</p>';
    if (d.needsSignIn) h += '<p class="note">' + esc(m('changeHow')) + '</p>';
    // membership card
    h += '<div class="mcard" id="mcard"><div class="mcard-top"><span class="mcard-org">' + esc(m('org')) + '</span><span class="mstate s-' + esc(mem.status) + ' g-' + esc(mem.stage) + '" id="mstage">' + esc((mem.stageLabel && mem.stageLabel[lang]) || mem.status) + '</span></div>';
    h += '<span class="mk">' + esc(m('noLabel')) + '</span><span class="mno" dir="ltr" id="mno">' + esc(mem.memberNo) + '</span>';
    h += '<div class="mcard-meta"><div><span class="mk">' + esc(m('nameL')) + '</span><b>' + esc(mem.name || app.name) + '</b></div><div><span class="mk">' + esc(m('typeL')) + '</span><b>' + esc((mem.tierLabel && mem.tierLabel[lang]) || tierName(mem.tier)) + '</b></div>' +
      (mem.statusLabel && mem.statusLabel[lang] ? '<div><span class="mk">' + esc(m('statusL')) + '</span><b>' + esc(mem.statusLabel[lang]) + '</b></div>' : '') +
      '<div><span class="mk">' + esc(m('feeL')) + '</span><b>' + esc(fee) + '</b></div><div><span class="mk">' + esc(m('appliedL')) + '</span><b>' + esc(fmtDay(mem.appliedAt)) + '</b></div></div>';
    h += '<button type="button" class="mcopy" id="mcopy">' + esc(m('copy')) + '</button></div>';
    if (!isMember && mem.position) h += '<div class="qtile"><span class="mk">' + esc(m('qL')) + '</span><b class="qno">' + esc(num(mem.position)) + '</b><p>' + esc(m('qP')) + '</p></div>';
    if (!isMember) {
      var steps = [[m('t1'), 'done', fmtDay(mem.appliedAt)], [m(elig ? 't2e' : 't2'), 'now', '']];
      if (paid && !elig) steps.push([m('t3pay', { amount: fee }), mem.paymentStatus === 'received' ? 'done' : '', '']); else if (verify) steps.push([m('t3verify'), '', '']);
      steps.push([m('t4'), '', '']);
      h += '<ol class="track">' + steps.map(function (s) { return '<li class="' + s[1] + '"><span class="tk" aria-hidden="true">' + (s[1] === 'done' ? '✓' : '') + '</span><span class="tt">' + esc(s[0]) + (s[2] ? '<small>' + esc(s[2]) + '</small>' : '') + '</span></li>'; }).join('') + '</ol>';
    }
    if (!isMember && elig) {
      h += '<div class="nextpanel"><h3 class="disp">' + esc(m('eligH')) + '</h3><p>' + esc(m(mem.tier === 'saudi' ? 'eligSaudiP' : 'eligP')) + '</p></div>'; // no fee is asked while this is open
    } else if (!isMember && paid && mem.paymentStatus !== 'received') {
      var link = (SITE.payLinks || {})[mem.tier] || '', bank = SITE.bank || {}, hasBank = !!(bank.sortCode && bank.accountNumber), amount = '£' + mem.amountGbp;
      h += '<div class="nextpanel"><h3 class="disp">' + esc(m('payH', { amount: fee })) + '</h3><p>' + esc(m(link || hasBank ? 'payP' : 'payLater')) + '</p>';
      if (link || hasBank) {
        h += '<div class="paygrid">';
        if (link) h += '<div class="card tinted"><h3>' + esc(t('cardTitle')) + '</h3><p class="big"><bdi>' + esc(amount) + '</bdi></p><a class="btn btn-p" href="' + esc(link) + '" target="_blank" rel="noopener">' + t('cardBtn', { amount: esc(amount) }) + '</a><p style="margin-top:14px;font-size:13.5px">' + esc(t('cardNote')) + '</p></div>';
        if (hasBank) h += '<div class="card"><h3>' + esc(t('bankTitle')) + '</h3><dl class="kv"><dt>' + esc(t('acctName')) + '</dt><dd>' + esc(bank.accountName || 'Oxford Saudi Society') + '</dd><dt>' + esc(t('sortCode')) + '</dt><dd dir="ltr">' + esc(bank.sortCode) + '</dd><dt>' + esc(t('acctNo')) + '</dt><dd dir="ltr">' + esc(bank.accountNumber) + '</dd><dt>' + esc(t('refK')) + '</dt><dd><b dir="ltr">' + esc(mem.memberNo) + '</b></dd></dl></div>';
        h += '</div>';
      }
      h += '</div>';
    } else if (!isMember && verify) {
      h += '<div class="nextpanel"><h3 class="disp">' + esc(m('verifyH')) + '</h3><p>' + esc(m('verifyP')) + '</p></div>';
    }
    if (mem.feeWaived && !isMember) h += '<p class="alert ok">' + esc(m('feeWaived')) + '</p>';
    else if (mem.feeDiscounted && !isMember && !elig) h += '<p class="alert ok">' + esc(m('feeDiscounted')) + '</p>';
    h += '<p class="muted done-mail">' + m('mailNote', { email: esc(app.email) }) + '</p>';
    h += '<div class="done-actions"><a class="btn btn-p" href="' + accountUrl + '">' + esc(m('track')) + '</a><button type="button" class="btn btn-s" id="done-print">' + esc(m('print')) + '</button></div>';
    finish(h);
    $('mcopy').addEventListener('click', function () { var b = this; var p = (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(mem.memberNo) : Promise.reject(); p.then(function () { b.textContent = m('copied'); setTimeout(function () { b.textContent = m('copy'); }, 2000); }, function () { var r = document.createRange(); r.selectNodeContents($('mno')); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }); });
    $('done-print').addEventListener('click', function () { window.print(); });
  }
  /* A link can open the form on a category: /join/?type=volunteer */
  (function () { try { var want = new URLSearchParams(location.search).get('type'), r = want ? form.querySelector('input[name="tier"][value="' + want.replace(/[^a-z]/g, '') + '"]') : null; if (r) r.checked = true; } catch (e) { /* no preselection */ } })();
  onCategory(); show(1, false);
})();

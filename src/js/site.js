(function () {
  'use strict';
  var lang = (document.documentElement.lang || 'en').slice(0, 2) === 'ar' ? 'ar' : 'en';
  var SITE = { lang: lang, email: '', treasurerEmail: '', membershipEmail: '', fees: {}, payLinks: {}, bank: {}, apiBase: '/api' };
  try { var el0 = document.getElementById('site-settings'); if (el0) Object.assign(SITE, JSON.parse(el0.textContent)); } catch (e) {}
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var T = {
    en: {
      sumPaid: 'Then pay <b>{amount}</b> by card or bank transfer', sumFree: 'Nothing to pay',
      sumVerify: 'Free — we’ll email you for proof of nationality', sumNone: 'Choose a membership type above',
      sending: 'Sending…', eyebrowSaved: 'Application received', eyebrowSend: 'One more step', thanks: 'Thank you, {name}.',
      savedBody: 'Your application is with the committee. We will confirm your membership by email at <b>{email}</b>.',
      savedBodyFree: 'You are on the list. Event news and invitations will reach you at <b>{email}</b>.',
      sendBody: 'We could not send your application automatically. Please send it to the committee — the button opens an email with everything filled in, or copy the text and paste it into any message.',
      stateSaved: 'Received', stateSend: 'Not sent yet', refLabel: 'Your reference', openMail: 'Open email app', copyApp: 'Copy application',
      copied: 'Copied — paste it into an email or message to the committee.', copyFail: 'Copying is blocked here. Select the text below and copy it yourself.', orWrite: 'or write to',
      payEyebrow: 'Step 3 · Payment', payTitle: 'Pay {amount} to activate your membership',
      payBody: 'Pay by card, or by bank transfer quoting your reference. Membership starts once the payment is matched — usually within two working days.',
      cardTitle: 'Pay by card', cardBtn: 'Pay {amount} by card', cardSoon: 'Card payments open soon',
      cardNote: 'Secure checkout opens in a new tab, handled by the payment provider. The Society never sees your card details.',
      bankTitle: 'Pay by bank transfer', acctName: 'Account name', sortCode: 'Sort code', acctNo: 'Account number', refK: 'Reference',
      bankNote: 'Please use the reference exactly as shown — it is how the treasurer matches your payment to your application.',
      hardship: 'Hardship fund: email the treasurer in confidence and the fee is waived, no questions asked.', again: 'Submit another application',
      verifyEyebrow: 'Step 3 · Verification', verifyTitle: 'One last thing: proof of nationality',
      verifyBodySaved: 'Within a few days we will email you at <b>{email}</b> asking for a photo of your Saudi passport or national ID (or your Cultural Bureau scholarship confirmation). Once checked, your membership is confirmed and the image is deleted — nothing is kept.',
      verifyBodySend: 'Attach a photo of your Saudi passport or national ID (or your Cultural Bureau scholarship confirmation) to the email you send us. Once checked, your membership is confirmed and the image is deleted — nothing is kept.',
      verifyNow: 'Prefer to send it now? Email it to {email} quoting your reference.',
      dirNoMatch: 'No one matches that search.', dirEmpty: 'Profiles are being added — check back soon.'
    },
    ar: {
      sumPaid: 'ثم ادفع <b>{amount}</b> بالبطاقة أو بالتحويل البنكي', sumFree: 'لا توجد رسوم',
      sumVerify: 'مجاناً — سنراسلك لطلب إثبات الجنسية', sumNone: 'اختر نوع العضوية أعلاه',
      sending: 'جارٍ الإرسال…', eyebrowSaved: 'تم استلام الطلب', eyebrowSend: 'خطوة أخيرة', thanks: 'شكراً لك يا {name}.',
      savedBody: 'وصل طلبك إلى اللجنة. سنؤكد عضويتك عبر البريد الإلكتروني على <b>{email}</b>.',
      savedBodyFree: 'أصبحت على القائمة. ستصلك أخبار الفعاليات والدعوات على <b>{email}</b>.',
      sendBody: 'تعذّر إرسال طلبك تلقائياً. أرسله إلى اللجنة من فضلك — يفتح الزر رسالة بريد معبّأة بكل البيانات، أو انسخ النص وألصقه في أي رسالة.',
      stateSaved: 'تم الاستلام', stateSend: 'لم يُرسل بعد', refLabel: 'رقمك المرجعي', openMail: 'فتح تطبيق البريد', copyApp: 'نسخ الطلب',
      copied: 'تم النسخ — ألصقه في رسالة بريد أو رسالة نصية إلى اللجنة.', copyFail: 'النسخ محجوب هنا. حدّد النص أدناه وانسخه بنفسك.', orWrite: 'أو راسلنا على',
      payEyebrow: 'الخطوة ٣ · الدفع', payTitle: 'ادفع {amount} لتفعيل عضويتك',
      payBody: 'ادفع بالبطاقة، أو بالتحويل البنكي مع ذكر رقمك المرجعي. تبدأ العضوية بمجرد مطابقة الدفعة — عادةً خلال يومي عمل.',
      cardTitle: 'الدفع بالبطاقة', cardBtn: 'ادفع {amount} بالبطاقة', cardSoon: 'الدفع بالبطاقة يُتاح قريباً',
      cardNote: 'تُفتح صفحة دفع آمنة في تبويب جديد عبر مزوّد الدفع. لا تطّلع الجمعية على بيانات بطاقتك أبداً.',
      bankTitle: 'الدفع بالتحويل البنكي', acctName: 'اسم الحساب', sortCode: 'رمز الفرع (Sort code)', acctNo: 'رقم الحساب', refK: 'المرجع',
      bankNote: 'يرجى كتابة المرجع كما هو تماماً — فهو ما يستخدمه أمين الصندوق لمطابقة دفعتك بطلبك.',
      hardship: 'يوجد صندوق للمساعدة: راسل أمين الصندوق بسرّية وسنعفيك من الرسوم دون أسئلة.', again: 'إرسال طلب آخر',
      verifyEyebrow: 'الخطوة ٣ · إثبات الجنسية', verifyTitle: 'أمر أخير: إثبات الجنسية',
      verifyBodySaved: 'خلال أيام قليلة سنراسلك على <b>{email}</b> لطلب صورة من جواز سفرك السعودي أو هويتك الوطنية (أو تأكيد الابتعاث من الملحقية الثقافية). بعد التحقق تُؤكَّد عضويتك وتُحذف الصورة — لا نحتفظ بشيء.',
      verifyBodySend: 'أرفق صورة من جواز سفرك السعودي أو هويتك الوطنية (أو تأكيد الابتعاث من الملحقية الثقافية) بالرسالة التي سترسلها إلينا. بعد التحقق تُؤكَّد عضويتك وتُحذف الصورة — لا نحتفظ بشيء.',
      verifyNow: 'تفضّل إرساله الآن؟ أرسله إلى {email} مع ذكر رقمك المرجعي.',
      dirNoMatch: 'لا نتائج لهذا البحث.', dirEmpty: 'تجري إضافة الملفات — عد قريباً.'
    }
  };
  function t(key, vars) { var s = (T[lang] && T[lang][key] !== undefined) ? T[lang][key] : T.en[key]; if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); }); return s; }
  function phOr(v, placeholder) { return v ? esc(v) : '<span class="ph">' + esc(placeholder) + '</span>'; }

  /* ── ideas board (Canny, or any embeddable board) ─────────────── */
  (function ideasBoard() {
    var board = $('ideas-board'); if (!board) return;
    var cfg = SITE.ideas || {}, openLink = $('ideas-open'), pending = $('ideas-pending'), linkCard = $('ideas-link'), mainLink = $('ideas-open-main'), mail = $('ideas-pending-mail');
    if (cfg.url) {
      if (openLink) { openLink.href = cfg.url; openLink.hidden = false; }
      if (mainLink) mainLink.href = cfg.url;
      if (!cfg.cannyBoardToken && !cfg.embedUrl && linkCard) { linkCard.hidden = false; pending.hidden = true; }
    }
    if (mail) mail.innerHTML = (lang === 'ar' ? 'حتى ذلك الحين أرسل أفكارك إلى ' : 'Until then, send ideas to ') +
      (SITE.email ? '<a href="mailto:' + esc(SITE.email) + '">' + esc(SITE.email) + '</a>' : '<span class="ph">[hello@address]</span>') +
      (lang === 'ar' ? ' — وستُنقل إلى اللوحة عند فتحها.' : ' — they will be moved onto the board when it opens.');
    if (cfg.cannyBoardToken) {
      pending.hidden = true; if (linkCard) linkCard.hidden = true;
      /* Canny's loader, as published at developers.canny.io/install/widget/web */
      (function (w, d, i, s) { function l() { if (!d.getElementById(i)) { var f = d.getElementsByTagName(s)[0], e = d.createElement(s); e.type = 'text/javascript'; e.async = true; e.src = 'https://sdk.canny.io/sdk.js'; f.parentNode.insertBefore(e, f); } } if (typeof w.Canny !== 'function') { var c = function () { c.q.push(arguments); }; c.q = []; w.Canny = c; if (d.readyState === 'complete') l(); else w.addEventListener('load', l, false); } })(window, document, 'canny-jssdk', 'script');
      window.Canny('render', { boardToken: cfg.cannyBoardToken, basePath: location.pathname.replace(/\/$/, ''), ssoToken: null, theme: 'light' });
    } else if (cfg.embedUrl) {
      pending.hidden = true; if (linkCard) linkCard.hidden = true;
      var fr = document.createElement('iframe'); fr.src = cfg.embedUrl; fr.title = lang === 'ar' ? 'لوحة الأفكار' : 'Ideas board'; fr.loading = 'lazy'; fr.setAttribute('allow', 'clipboard-write');
      board.appendChild(fr);
    }
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

  /* ── join form ─────────────────────────────────────────────────── */
  var form = $('join-form'); if (!form) return;
  var done = $('join-done');
  var TIERS = [
    { id: 'saudi', price: 0, verify: true, en: 'Saudi student membership', ar: 'عضوية الطلبة السعوديين' },
    { id: 'student', price: SITE.fees.student != null ? SITE.fees.student : 10, en: 'Student membership', ar: 'عضوية الطلبة' },
    { id: 'associate', price: SITE.fees.associate != null ? SITE.fees.associate : 15, en: 'Associate membership', ar: 'العضوية المنتسبة' },
    { id: 'friend', price: 0, en: 'Mailing list & volunteering', ar: 'القائمة البريدية والتطوّع' }
  ];
  var STEP3 = { pay: ['Payment', 'الدفع'], verify: ['Verification', 'إثبات الجنسية'], none: ['All set', 'اكتمل'] };
  var STATUS = { undergraduate: 'Undergraduate', masters: "Taught postgraduate (Master's)", dphil: 'Research postgraduate (DPhil)', visiting: 'Visiting student or researcher', staff: 'University staff or researcher', alumni: 'Alumni', other: 'Other' };
  var VOL = { events: 'Events', media: 'Media & design', partnerships: 'Sponsorship & partnerships', welfare: 'Welfare & welcome', academic: 'Academic & careers' };
  var busy = false, last = null;
  function tierOf(id) { for (var i = 0; i < TIERS.length; i++) if (TIERS[i].id === id) return TIERS[i]; return null; }
  function amountOf(tier) { return '£' + tier.price; }
  function amountHtml(tier) { var a = esc(amountOf(tier)); return '<bdi>' + (SITE.fees.confirmed ? a : '<span class="ph">[' + a + ']</span>') + '</bdi>'; }
  function selectedTier() { var r = form.querySelector('input[name="tier"]:checked'); return r ? tierOf(r.value) : null; }
  function step3Kind(tier) { return !tier ? 'pay' : tier.price ? 'pay' : tier.verify ? 'verify' : 'none'; }
  function syncTier() {
    var tier = selectedTier();
    document.querySelectorAll('#tiers .tier').forEach(function (l) { l.classList.toggle('sel', l.querySelector('input').checked); });
    $('email-hint').hidden = !(tier && (tier.id === 'student' || tier.id === 'saudi'));
    $('sum').innerHTML = !tier ? t('sumNone') : tier.price ? t('sumPaid', { amount: amountHtml(tier) }) : tier.verify ? t('sumVerify') : t('sumFree');
    $('step3-label').textContent = STEP3[step3Kind(tier)][lang === 'ar' ? 1 : 0];
    if (tier) { $('tier-msg').style.display = 'none'; $('tiers').classList.remove('err'); }
  }
  form.addEventListener('change', function (e) { if (e.target.name === 'tier') syncTier(); });
  function setErr(name, on) { var f = form.querySelector('[data-f="' + name + '"]'); if (!f) return; f.classList.toggle('err', !!on); var inp = f.querySelector('input,select'); if (inp) inp.setAttribute('aria-invalid', on ? 'true' : 'false'); }
  function validate() {
    var bad = [], tier = selectedTier();
    $('tier-msg').style.display = tier ? 'none' : 'block'; $('tiers').classList.toggle('err', !tier); if (!tier) bad.push('tiers');
    var name = $('f-name').value.trim(), email = $('f-email').value.trim(), college = $('f-college').value.trim(), status = $('f-status').value, consent = $('f-consent').checked;
    setErr('name', !name); if (!name) bad.push('f-name');
    var okMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email); setErr('email', !okMail); if (!okMail) bad.push('f-email');
    setErr('college', !college); if (!college) bad.push('f-college');
    setErr('status', !status); if (!status) bad.push('f-status');
    setErr('consent', !consent); if (!consent) bad.push('f-consent');
    $('err-sum').classList.toggle('on', bad.length > 0);
    if (bad.length) { var el = $(bad[0]); if (el.focus) el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    return bad.length === 0;
  }
  ['f-name', 'f-email', 'f-college', 'f-status', 'f-consent'].forEach(function (id) { var clear = function () { setErr(id.replace('f-', ''), false); }; $(id).addEventListener('input', clear); $(id).addEventListener('change', clear); });
  /* Submission goes to the society's own database (/api/membership/apply), which issues a permanent
     membership number and a place in the review queue. Nothing is claimed until the server answers. */
  var M = {
    en: {
      eyebrowNew: 'Application received', eyebrowAgain: 'You have already applied', eyebrowMember: 'You are already a member',
      thanks: 'Thank you, {name}.', welcomeBack: 'Welcome back, {name}.',
      ledeNew: 'Your application is with the committee. Keep your membership number: you will use it for payments, members-only events and anything you send us.',
      ledeAgain: 'We already have your application, so nothing new was submitted. Here is where it stands.',
      ledeMember: 'This email address already belongs to an active membership.',
      org: 'Oxford Saudi Society', noLabel: 'Membership number', nameL: 'Name', typeL: 'Membership', appliedL: 'Applied', copy: 'Copy number', copied: 'Copied',
      st: { pending: 'Pending review', info_requested: 'Question from the committee', approved: 'Active member', declined: 'Not approved', revoked: 'Ended', expired: 'Expired' },
      qL: 'Your place in the review queue', qP: 'The committee reviews applications in the order they arrive. You will get an email as soon as yours is decided.',
      t1: 'Application received', t2: 'Committee review', t3pay: 'Payment of {amount}', t3verify: 'Proof of Saudi nationality', t4: 'Membership active',
      payH: 'Pay {amount} to complete your membership', payP: 'Use your membership number as the payment reference so the treasurer can match it. Membership is approved once the payment is matched.',
      verifyH: 'Proof of Saudi nationality', verifyP: 'The committee will email you to check Saudi nationality (passport, national ID or Cultural Bureau scholarship confirmation). Please do not send any document until we ask. It is checked and then deleted.',
      mailNote: 'We have sent a confirmation to <b dir="ltr">{email}</b>. Its link lets you follow your application and answer any question from the committee.',
      track: 'Track my application', print: 'Save or print', again: 'Submit another application',
      failH: 'Your application was not submitted', fail: 'We could not reach the membership system just now. Your answers are still in the form: please press Submit again in a minute.', failMail: 'If it keeps failing, email {email}.',
      rate: 'Too many attempts from this connection. Please wait a few minutes and try again.'
    },
    ar: {
      eyebrowNew: 'تم استلام الطلب', eyebrowAgain: 'لقد تقدّمت بطلب من قبل', eyebrowMember: 'أنت عضو بالفعل',
      thanks: 'شكرًا لك يا {name}.', welcomeBack: 'أهلًا بعودتك يا {name}.',
      ledeNew: 'طلبك الآن لدى اللجنة. احتفظ برقم عضويتك؛ ستستخدمه في الدفع وحجز فعاليات الأعضاء وفي أي مراسلة معنا.',
      ledeAgain: 'طلبك موجود لدينا، فلم يُرسل طلب جديد. هذا وضع طلبك الآن.',
      ledeMember: 'هذا البريد مرتبط بعضوية فعّالة.',
      org: 'الجمعية السعودية في أكسفورد', noLabel: 'رقم العضوية', nameL: 'الاسم', typeL: 'العضوية', appliedL: 'تاريخ الطلب', copy: 'نسخ الرقم', copied: 'تم النسخ',
      st: { pending: 'قيد المراجعة', info_requested: 'سؤال من اللجنة', approved: 'عضو فعّال', declined: 'لم تتم الموافقة', revoked: 'منتهية', expired: 'منتهية الصلاحية' },
      qL: 'ترتيبك في قائمة المراجعة', qP: 'تراجع اللجنة الطلبات بحسب ترتيب وصولها، وستصلك رسالة بالبريد فور البت في طلبك.',
      t1: 'تم استلام الطلب', t2: 'مراجعة اللجنة', t3pay: 'دفع {amount}', t3verify: 'إثبات الجنسية السعودية', t4: 'تفعيل العضوية',
      payH: 'ادفع {amount} لإتمام عضويتك', payP: 'اكتب رقم عضويتك مرجعًا للدفع ليتمكن أمين الصندوق من مطابقته. تُعتمد العضوية بعد مطابقة الدفعة.',
      verifyH: 'إثبات الجنسية السعودية', verifyP: 'ستراسلك اللجنة للتحقق من الجنسية السعودية (جواز السفر أو الهوية الوطنية أو تأكيد الابتعاث من الملحقية). يرجى عدم إرسال أي وثيقة قبل أن نطلبها، وتُحذف بعد التحقق.',
      mailNote: 'أرسلنا تأكيدًا إلى <b dir="ltr">{email}</b>، ويتيح لك الرابط فيه متابعة طلبك والإجابة عن أي سؤال من اللجنة.',
      track: 'تابع طلبي', print: 'حفظ أو طباعة', again: 'تقديم طلب آخر',
      failH: 'لم يُرسل طلبك', fail: 'تعذّر الوصول إلى نظام العضوية الآن. إجاباتك ما زالت في النموذج؛ اضغط «إرسال الطلب» مرة أخرى بعد دقيقة.', failMail: 'إن تكرر الخطأ فراسلنا على {email}.',
      rate: 'محاولات كثيرة من هذا الاتصال. انتظر بضع دقائق ثم حاول مجددًا.'
    }
  };
  function m(key, vars) { var v = (M[lang][key] !== undefined ? M[lang][key] : M.en[key]); if (typeof v === 'string' && vars) Object.keys(vars).forEach(function (k) { v = v.split('{' + k + '}').join(vars[k]); }); return v; }
  function fmtDay(d) { try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-arab' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }).format(new Date(d)); } catch (e) { return ''; } }
  function num(n) { return lang === 'ar' ? new Intl.NumberFormat('ar-SA-u-nu-arab').format(n) : String(n); }
  function collect() {
    var tier = selectedTier();
    return { tier: tier ? tier.id : '', name: $('f-name').value.trim(), nameAr: $('f-name-ar').value.trim(), email: $('f-email').value.trim(), college: $('f-college').value.trim(), status: $('f-status').value, phone: $('f-phone').value.trim(),
      volunteer: Array.prototype.slice.call(form.querySelectorAll('input[name="volunteer"]:checked')).map(function (c) { return c.value; }),
      heard: $('f-heard').value, consent_privacy: $('f-consent').checked, consent_news: form.querySelector('input[name="consent_news"]').checked,
      privacy_version: SITE.privacyVersion || '', lang: lang, website: form.querySelector('input[name="website"]').value };
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
      var map = { name: 'name', email: 'email', college: 'college', status: 'status', consent: 'consent' };
      Object.keys(res.data.fields).forEach(function (k) { if (map[k]) setErr(map[k], true); if (k === 'tier') { $('tier-msg').style.display = 'block'; $('tiers').classList.add('err'); } });
      box.hidden = true; $('err-sum').classList.add('on'); return;
    }
    box.hidden = false;
    box.innerHTML = '<b>' + esc(m('failH')) + '</b> ' + esc(res.status === 429 ? m('rate') : m('fail')) + (res.status === 429 ? '' : ' ' + m('failMail', { email: SITE.email ? '<a href="mailto:' + esc(SITE.email) + '">' + esc(SITE.email) + '</a>' : '' }));
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  form.addEventListener('submit', async function (e) {
    e.preventDefault(); if (busy) return;
    if (form.querySelector('input[name="website"]').value) return;
    if (!validate()) return;
    busy = true; var btn = $('submit-btn'), lbl = $('submit-label'), keep = lbl.innerHTML; btn.disabled = true; lbl.textContent = t('sending');
    var app = collect(); var res = await send(app);
    busy = false; btn.disabled = false; lbl.innerHTML = keep;
    if (!res.ok || !res.data || !res.data.member) { showFail(res); return; }
    var f = $('join-fail'); if (f) f.hidden = true;
    last = { app: app, result: res.data.result, member: res.data.member }; renderDone();
  });
  function setSteps(stage) { document.querySelectorAll('#steps li').forEach(function (li) { var n = +li.getAttribute('data-step'); li.classList.remove('on', 'done'); if (stage === 'form') { if (n < 3) li.classList.add('on'); } else if (stage === 'pay') li.classList.add(n < 3 ? 'done' : 'on'); else li.classList.add('done'); }); }
  function renderDone() {
    var app = last.app, mem = last.member, kind = last.result, tier = tierOf(mem.tier) || selectedTier() || TIERS[0];
    var first = esc((app.name || mem.name || '').split(/\s+/)[0]);
    var amount = '£' + (mem.amountGbp || 0), paid = mem.amountGbp > 0, verify = mem.nationalityStatus === 'pending' || mem.nationalityStatus === 'verified';
    var isMember = mem.status === 'approved';
    var h = '<p class="eyebrow">' + esc(m(kind === 'already_member' ? 'eyebrowMember' : kind === 'already' ? 'eyebrowAgain' : 'eyebrowNew')) + '</p>';
    h += '<h2 class="done-h">' + esc(m(kind === 'received' ? 'thanks' : 'welcomeBack', { name: first })) + '</h2>';
    h += '<p class="lede done-lede">' + esc(m(kind === 'already_member' ? 'ledeMember' : kind === 'already' ? 'ledeAgain' : 'ledeNew')) + '</p>';
    // membership card
    h += '<div class="mcard" id="mcard"><div class="mcard-top"><span class="mcard-org">' + esc(m('org')) + '</span><span class="mstate s-' + esc(mem.status) + '">' + esc(m('st')[mem.status] || mem.status) + '</span></div>';
    h += '<span class="mk">' + esc(m('noLabel')) + '</span><span class="mno" dir="ltr" id="mno">' + esc(mem.memberNo) + '</span>';
    h += '<div class="mcard-meta"><div><span class="mk">' + esc(m('nameL')) + '</span><b>' + esc(mem.name || app.name) + '</b></div><div><span class="mk">' + esc(m('typeL')) + '</span><b>' + esc((mem.tierLabel && mem.tierLabel[lang]) || tier[lang]) + '</b></div><div><span class="mk">' + esc(m('appliedL')) + '</span><b>' + esc(fmtDay(mem.appliedAt)) + '</b></div></div>';
    h += '<button type="button" class="mcopy" id="mcopy">' + esc(m('copy')) + '</button></div>';
    if (!isMember && mem.position) h += '<div class="qtile"><span class="mk">' + esc(m('qL')) + '</span><b class="qno">' + esc(num(mem.position)) + '</b><p>' + esc(m('qP')) + '</p></div>';
    if (!isMember) {
      var third = paid ? m('t3pay', { amount: amount }) : verify ? m('t3verify') : null;
      var steps = [[m('t1'), 'done', fmtDay(mem.appliedAt)], [m('t2'), 'now', '']];
      if (third) steps.push([third, paid && mem.paymentStatus === 'received' ? 'done' : '', '']);
      steps.push([m('t4'), '', '']);
      h += '<ol class="track">' + steps.map(function (s, i) { return '<li class="' + s[1] + '"><span class="tk">' + (s[1] === 'done' ? '✓' : num(i + 1)) + '</span><span class="tt">' + esc(s[0]) + (s[2] ? '<small>' + esc(s[2]) + '</small>' : '') + '</span></li>'; }).join('') + '</ol>';
    }
    if (!isMember && paid) {
      var link = SITE.payLinks[tier.id] || '';
      h += '<div class="nextpanel"><h3 class="disp">' + esc(m('payH', { amount: amount })) + '</h3><p>' + esc(m('payP')) + '</p><div class="paygrid">';
      h += '<div class="card tinted"><h3>' + esc(t('cardTitle')) + '</h3><p class="big">' + amountHtml(tier) + '</p>' + (link ? '<a class="btn btn-p" href="' + esc(link) + '" target="_blank" rel="noopener">' + t('cardBtn', { amount: esc(amount) }) + '</a>' : '<span class="btn btn-p is-off ph" aria-disabled="true">' + esc(t('cardSoon')) + '</span>') + '<p style="margin-top:14px;font-size:13.5px">' + esc(t('cardNote')) + '</p></div>';
      h += '<div class="card"><h3>' + esc(t('bankTitle')) + '</h3><dl class="kv"><dt>' + esc(t('acctName')) + '</dt><dd><span class="' + (SITE.bank.sortCode ? '' : 'ph') + '">' + esc(SITE.bank.accountName || 'Oxford Saudi Society') + '</span></dd>';
      h += '<dt>' + esc(t('sortCode')) + '</dt><dd>' + phOr(SITE.bank.sortCode, '[00-00-00]') + '</dd><dt>' + esc(t('acctNo')) + '</dt><dd>' + phOr(SITE.bank.accountNumber, '[00000000]') + '</dd>';
      h += '<dt>' + esc(t('refK')) + '</dt><dd><b dir="ltr">' + esc(mem.memberNo) + '</b></dd></dl></div></div>';
      var tm = SITE.treasurerEmail || SITE.email || '';
      h += '<p class="muted" style="font-size:13px;margin-top:14px">' + esc(t('hardship')) + (tm ? ' <a href="mailto:' + esc(tm) + '">' + esc(tm) + '</a>' : '') + '</p></div>';
    } else if (!isMember && verify && mem.nationalityStatus !== 'verified') {
      h += '<div class="nextpanel"><h3 class="disp">' + esc(m('verifyH')) + '</h3><p>' + esc(m('verifyP')) + '</p></div>';
    }
    h += '<p class="muted done-mail">' + m('mailNote', { email: esc(app.email) }) + '</p>';
    h += '<div class="done-actions"><a class="btn btn-p" href="' + (lang === 'ar' ? '/ar' : '') + '/account/">' + esc(m('track')) + '</a><button type="button" class="btn btn-s" id="done-print">' + esc(m('print')) + '</button></div>';
    h += '<p class="again"><a href="#join-form-band" id="again">' + esc(m('again')) + '</a></p>';
    done.innerHTML = h; done.hidden = false; form.hidden = true; setSteps(isMember ? 'all' : (paid || verify) ? 'pay' : 'all');
    $('mcopy').addEventListener('click', function () { var b = this; var p = (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(mem.memberNo) : Promise.reject(); p.then(function () { b.textContent = m('copied'); setTimeout(function () { b.textContent = m('copy'); }, 2000); }, function () { var r = document.createRange(); r.selectNodeContents($('mno')); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }); });
    $('done-print').addEventListener('click', function () { window.print(); });
    $('again').addEventListener('click', function (ev) { ev.preventDefault(); last = null; form.reset(); done.hidden = true; form.hidden = false; $('err-sum').classList.remove('on'); form.querySelectorAll('.f.err').forEach(function (f) { f.classList.remove('err'); }); syncTier(); setSteps('form'); $('join-form-band').scrollIntoView({ behavior: 'smooth' }); });
    $('join-form-band').scrollIntoView({ behavior: 'smooth' });
  }
  syncTier(); setSteps('form');
})();

(function () {
  'use strict';
  var lang = (document.documentElement.lang || 'en').slice(0, 2) === 'ar' ? 'ar' : 'en';
  var SITE = { lang: lang, email: '', fees: {}, payLinks: {}, bank: {}, formEndpoint: '/' };
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

  /* ── menu ──────────────────────────────────────────────────────── */
  var nav = $('nav'), burger = $('burger');
  if (burger) burger.addEventListener('click', function () { var open = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', open ? 'true' : 'false'); });

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
    $('f-tier-label').value = tier ? tier.en : '';
    $('f-amount').value = tier && tier.price ? amountOf(tier) : '0';
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
  function makeRef() { return 'OSS-' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2); }
  function collect() {
    var tier = selectedTier(), ref = makeRef(); $('f-reference').value = ref;
    return { ref: ref, tier: tier.id, tierLabel: tier.en, amount: tier.price, verify: !!tier.verify, name: $('f-name').value.trim(), nameAr: $('f-name-ar').value.trim(), email: $('f-email').value.trim(),
      college: $('f-college').value.trim(), status: $('f-status').value, phone: $('f-phone').value.trim(),
      volunteer: Array.prototype.slice.call(form.querySelectorAll('input[name="volunteer"]:checked')).map(function (c) { return c.value; }),
      heard: $('f-heard').value, consentNews: form.querySelector('input[name="consent_news"]').checked, lang: lang, submittedAt: new Date().toISOString() };
  }
  function plainText(app) {
    var L = ['Oxford Saudi Society — membership application', 'Reference: ' + app.ref, 'Membership: ' + app.tierLabel + (app.amount ? ' (£' + app.amount + ')' : app.verify ? ' (free — proof of nationality to follow)' : ' (free)'), 'Name: ' + app.name];
    if (app.nameAr) L.push('Name (Arabic): ' + app.nameAr);
    L.push('Email: ' + app.email, 'College / department: ' + app.college, 'Status: ' + (STATUS[app.status] || app.status));
    if (app.phone) L.push('Mobile / WhatsApp: ' + app.phone);
    L.push('Volunteering: ' + (app.volunteer.length ? app.volunteer.map(function (v) { return VOL[v] || v; }).join(', ') : '—'));
    if (app.heard) L.push('Heard about us: ' + app.heard);
    L.push('Privacy consent: yes', 'Event news by email: ' + (app.consentNews ? 'yes' : 'no'), 'Submitted: ' + app.submittedAt.replace('T', ' ').slice(0, 16) + ' UTC');
    return L.join('\n');
  }
  function timeout(p, ms) { return Promise.race([p, new Promise(function (res) { setTimeout(function () { res(undefined); }, ms); })]); }
  async function send(app) {
    if (!SITE.formEndpoint || typeof fetch !== 'function') return false;
    var fd = new FormData(form); fd.set('form-name', form.getAttribute('name') || 'join');
    ['lang', 'submittedAt'].forEach(function (k) { fd.set(k, app[k]); });
    var body = new URLSearchParams(fd).toString();
    try { var r = await timeout(fetch(SITE.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body }), 12000); return !!(r && r.ok); }
    catch (e) { return false; }
  }
  form.addEventListener('submit', async function (e) {
    e.preventDefault(); if (busy) return;
    if (form.querySelector('input[name="website"]').value) return;
    if (!validate()) return;
    busy = true; var btn = $('submit-btn'), lbl = $('submit-label'), keep = lbl.innerHTML; btn.disabled = true; lbl.textContent = t('sending');
    var app = collect(); var ok = await send(app);
    busy = false; btn.disabled = false; lbl.innerHTML = keep;
    last = { app: app, saved: ok }; renderDone();
  });
  function setSteps(stage) { document.querySelectorAll('#steps li').forEach(function (li) { var n = +li.getAttribute('data-step'); li.classList.remove('on', 'done'); if (stage === 'form') { if (n < 3) li.classList.add('on'); } else if (stage === 'pay') li.classList.add(n < 3 ? 'done' : 'on'); else li.classList.add('done'); }); }
  function renderDone() {
    var app = last.app, saved = last.saved, tier = tierOf(app.tier) || TIERS[0], paid = tier.price > 0, kind = step3Kind(tier);
    var first = esc(app.name.split(/\s+/)[0] || app.name), text = plainText(app);
    var mail = 'mailto:' + encodeURIComponent(SITE.email || '') + '?subject=' + encodeURIComponent('Membership application ' + app.ref + ' — ' + app.name) + '&body=' + encodeURIComponent(text);
    var h = '<p class="eyebrow">' + esc(t(saved ? 'eyebrowSaved' : 'eyebrowSend')) + '</p>';
    h += '<h2 style="font-size:clamp(28px,3.6vw,40px);margin-top:12px">' + esc(t('thanks', { name: first })) + '</h2>';
    h += '<div><div class="ref"><span class="rk">' + esc(t('refLabel')) + '</span><span class="rv">' + esc(app.ref) + '</span></div></div>';
    h += '<div><span class="state ' + (saved ? 'ok' : 'todo') + '">' + esc(t(saved ? 'stateSaved' : 'stateSend')) + '</span></div>';
    if (saved) h += '<p class="lede" style="max-width:60ch">' + t(paid || kind === 'verify' ? 'savedBody' : 'savedBodyFree', { email: esc(app.email) }) + '</p>';
    else {
      h += '<p class="lede" style="max-width:60ch">' + esc(t('sendBody')) + '</p>';
      h += '<div class="mailrow"><a class="btn btn-p" href="' + mail + '">' + esc(t('openMail')) + '</a><button type="button" class="btn btn-s" id="copy-app">' + esc(t('copyApp')) + '</button>';
      h += '<span class="addr">' + esc(t('orWrite')) + ' ' + phOr(SITE.email, '[hello@address]') + '</span></div>';
      h += '<p class="muted" id="copy-note" style="font-size:13.5px;margin-top:10px"></p><textarea class="copybox" id="copy-box" readonly spellcheck="false" hidden>' + esc(text) + '</textarea>';
    }
    if (paid) {
      var link = SITE.payLinks[tier.id] || '';
      h += '<p class="eyebrow" style="margin-top:44px">' + esc(t('payEyebrow')) + '</p><h3 class="disp" style="font-size:28px;margin:10px 0 8px">' + t('payTitle', { amount: amountHtml(tier) }) + '</h3>';
      h += '<p style="color:var(--ink-80);max-width:60ch">' + esc(t('payBody')) + '</p><div class="paygrid">';
      h += '<div class="card tinted"><h3>' + esc(t('cardTitle')) + '</h3><p class="big">' + amountHtml(tier) + '</p>';
      h += link ? '<a class="btn btn-p" href="' + esc(link) + '" target="_blank" rel="noopener">' + t('cardBtn', { amount: esc(amountOf(tier)) }) + '</a>' : '<span class="btn btn-p is-off ph" aria-disabled="true">' + esc(t('cardSoon')) + '</span>';
      h += '<p style="margin-top:14px;font-size:13.5px">' + esc(t('cardNote')) + '</p></div>';
      h += '<div class="card"><h3>' + esc(t('bankTitle')) + '</h3><dl class="kv"><dt>' + esc(t('acctName')) + '</dt><dd><span class="' + (SITE.bank.sortCode ? '' : 'ph') + '">' + esc(SITE.bank.accountName || 'Oxford Saudi Society') + '</span></dd>';
      h += '<dt>' + esc(t('sortCode')) + '</dt><dd>' + phOr(SITE.bank.sortCode, '[00-00-00]') + '</dd><dt>' + esc(t('acctNo')) + '</dt><dd>' + phOr(SITE.bank.accountNumber, '[00000000]') + '</dd>';
      h += '<dt>' + esc(t('refK')) + '</dt><dd><b>' + esc(app.ref) + '</b></dd></dl><p style="margin-top:14px;font-size:13.5px">' + esc(t('bankNote')) + '</p></div></div>';
      h += '<p class="muted" style="font-size:13px;margin-top:18px">' + esc(t('hardship')) + '</p>';
    } else if (kind === 'verify') {
      h += '<p class="eyebrow" style="margin-top:44px">' + esc(t('verifyEyebrow')) + '</p><h3 class="disp" style="font-size:28px;margin:10px 0 8px">' + esc(t('verifyTitle')) + '</h3>';
      h += '<p style="color:var(--ink-80);max-width:60ch">' + t(saved ? 'verifyBodySaved' : 'verifyBodySend', { email: esc(app.email) }) + '</p>';
      if (saved) h += '<p class="muted" style="font-size:13.5px;margin-top:12px">' + t('verifyNow', { email: phOr(SITE.email, '[hello@address]') }) + '</p>';
    }
    h += '<p class="again"><a href="#join-form-band" id="again">' + esc(t('again')) + '</a></p>';
    done.innerHTML = h; done.hidden = false; form.hidden = true; setSteps(kind === 'none' ? 'all' : 'pay');
    var cb = $('copy-app');
    if (cb) cb.addEventListener('click', function () { var box = $('copy-box'), note = $('copy-note'); var p = (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(text) : Promise.reject(); p.then(function () { note.textContent = t('copied'); box.hidden = true; }, function () { note.textContent = t('copyFail'); box.hidden = false; box.focus(); box.select(); }); });
    $('again').addEventListener('click', function (ev) { ev.preventDefault(); last = null; form.reset(); done.hidden = true; form.hidden = false; $('err-sum').classList.remove('on'); form.querySelectorAll('.f.err').forEach(function (f) { f.classList.remove('err'); }); syncTier(); setSteps('form'); $('join-form-band').scrollIntoView({ behavior: 'smooth' }); });
    $('join-form-band').scrollIntoView({ behavior: 'smooth' });
  }
  syncTier(); setSteps('form');
})();

/* /account/ — the signed-in person's registrations (sign-in by email link; no passwords). */
(function () {
  'use strict';
  var O = window.OSS, $ = O.$, esc = O.esc, lang = O.lang, base = O.base;
  var S = {
    en: { title: 'My registrations', page: 'My account', sub: 'Your membership, event registrations and tickets.', signinH: 'Sign in with your email', signinP: 'Enter the address you used to register and we will email you a sign-in link. No password needed.', email: 'Email', send: 'Email me a sign-in link', sent: 'Check your email', sentP: 'If {email} has registrations or a membership, a sign-in link is on its way. It works once and expires in 30 minutes.',
      signedInAs: 'Signed in as', member: 'Verified member', signout: 'Sign out', upcoming: 'Upcoming', past: 'Past', none: 'No registrations yet.', browse: 'Browse the programme', ticket: 'Show ticket', cancel: 'Cancel registration', claim: 'Claim my place', claimBy: 'Claim by {t}', cancelQ: 'Cancel this registration?', cancelT: 'Your place goes to the next person and any ticket stops working.', yesCancel: 'Yes, cancel', cancelled: 'Registration cancelled.', claimed: 'Your place is confirmed. Your ticket has been emailed to you.', claimGone: 'Sorry — that place was taken or the offer expired.', ticketNote: 'Opening a ticket here replaces any earlier ticket link.', desk: 'Committee desk', err: 'Something went wrong. Please try again.',
      status: { interested: 'Interest registered (not a booking)', confirmed: 'Confirmed', waitlisted: 'On the waitlist', offered: 'Place offered — claim it', checked_in: 'Checked in', cancelled: 'Cancelled', expired: 'Offer expired', declined: 'Declined' },
      banner: { signed_in: 'You are signed in.', invalid: 'That link is not valid.', expired: 'That link has expired. Request a new one below.', used: 'That link was already used — request a new one if you are not signed in.' },
      evStatus: { proposed: 'proposed', confirmed: '', postponed: 'postponed — date to be confirmed', cancelled: 'cancelled', completed: '' },
      mem: { h: 'Membership', no: 'Membership number', type: 'Membership', since: 'Applied', valid: 'Valid until', queue: 'Place in the review queue', none: 'You do not have a membership application yet.', join: 'Apply for membership',
        st: { pending: 'Pending review', info_requested: 'The committee has a question', approved: 'Active member', declined: 'Not approved', revoked: 'Ended', expired: 'Expired' },
        qH: 'Question from the committee', reply: 'Your answer', send: 'Send answer', sent: 'Thank you — your answer is with the committee. Your application keeps its place.', yourAnswer: 'Your last answer', payDue: 'Fee due: {amount}. Use your membership number as the payment reference.', reason: 'Reason', verify: 'The committee\u2019s secretary will email you later to ask for proof of Saudi nationality, if it is needed. You do not need to send anything now.',
        ev: { h: 'Proof of Saudi nationality', p: 'Upload one document: the photo page of your passport, your national ID or your Cultural Bureau scholarship confirmation. It is sent over an encrypted connection, only authorised committee members can open it, and it is deleted as soon as it has been checked. Please do not send it by email.', again: 'The document you uploaded could not be accepted and has been deleted. Please upload a different one.', file: 'Photo or PDF (up to 3 MB)', agree: 'I agree to the committee viewing this document only to confirm that I am eligible for free membership.', send: 'Upload securely', sending: 'Uploading…', held: 'Document received on {when}. It will be deleted as soon as the committee has checked it.', remove: 'Remove my document', removeQ: 'Remove your document?', removeT: 'It is deleted now. Your application stays in the queue, but it cannot be approved as a free membership until a document has been checked.', removed: 'Your document has been deleted.', done: 'Thank you — your document has been received.', ok: 'Saudi nationality confirmed. Your document has been deleted.', eType: 'Please choose a JPEG, PNG or WebP photo, or a PDF.', eBig: 'That file is larger than 3 MB. Please choose a smaller photo or PDF.', eRead: 'That file could not be read. Please try another.', eNeed: 'Choose a file and tick the box first.' } } },
    ar: { title: 'السجل', page: 'حسابي', sub: 'عضويتك وسجل فعالياتك وتذاكرك.', signinH: 'سجّل الدخول ببريدك الإلكتروني', signinP: 'أدخل البريد الذي سجّلت به وسنرسل لك رابط دخول. لا حاجة لكلمة مرور.', email: 'البريد الإلكتروني', send: 'أرسل لي رابط الدخول', sent: 'تحقّق من بريدك', sentP: 'إذا كان {email} مرتبطًا بتسجيل في فعالية أو بعضوية فرابط الدخول في طريقه إليك. يعمل مرة واحدة وتنتهي صلاحيته خلال ٣٠ دقيقة.',
      signedInAs: 'مسجّل الدخول باسم', member: 'عضو معتمد', signout: 'تسجيل الخروج', upcoming: 'القادمة', past: 'السابقة', none: 'لم تسجّل في أي فعالية بعد.', browse: 'تصفّح البرنامج', ticket: 'عرض التذكرة', cancel: 'إلغاء التسجيل', claim: 'تأكيد مقعدي', claimBy: 'أكّد قبل {t}', cancelQ: 'إلغاء هذا التسجيل؟', cancelT: 'سيذهب مقعدك إلى الشخص التالي وتتوقف أي تذكرة عن العمل.', yesCancel: 'نعم، ألغِ', cancelled: 'تم إلغاء التسجيل.', claimed: 'تم تأكيد مقعدك، وأُرسلت التذكرة إلى بريدك.', claimGone: 'عذرًا — حُجز المقعد أو انتهت مدة العرض.', ticketNote: 'فتح التذكرة هنا يستبدل أي رابط تذكرة سابق.', desk: 'مكتب اللجنة', err: 'حدث خطأ ما. حاول مجددًا.',
      status: { interested: 'تم تسجيل الاهتمام (ليس حجزًا)', confirmed: 'مؤكد', waitlisted: 'في قائمة الانتظار', offered: 'عُرض عليك مقعد — أكّده', checked_in: 'تم تسجيل الحضور', cancelled: 'ملغى', expired: 'انتهى العرض', declined: 'مرفوض' },
      banner: { signed_in: 'تم تسجيل دخولك.', invalid: 'هذا الرابط غير صالح.', expired: 'انتهت صلاحية الرابط. اطلب رابطًا جديدًا أدناه.', used: 'استُخدم هذا الرابط من قبل — اطلب رابطًا جديدًا إن لم تكن مسجّل الدخول.' },
      evStatus: { proposed: 'مبدئي', confirmed: '', postponed: 'مؤجل — التاريخ قيد التأكيد', cancelled: 'ملغاة', completed: '' },
      mem: { h: 'العضوية', no: 'رقم العضوية', type: 'العضوية', since: 'تاريخ الطلب', valid: 'صالحة حتى', queue: 'ترتيبك في قائمة المراجعة', none: 'لا يوجد لديك طلب عضوية بعد.', join: 'تقدّم بطلب العضوية',
        st: { pending: 'قيد المراجعة', info_requested: 'لدى اللجنة سؤال', approved: 'عضو فعّال', declined: 'لم تتم الموافقة', revoked: 'منتهية', expired: 'منتهية الصلاحية' },
        qH: 'سؤال من اللجنة', reply: 'إجابتك', send: 'إرسال الإجابة', sent: 'شكرًا لك — وصلت إجابتك إلى اللجنة، ويحتفظ طلبك بترتيبه.', yourAnswer: 'آخر إجابة منك', payDue: 'الرسوم المستحقة: {amount}. اكتب رقم عضويتك مرجعًا للدفع.', reason: 'السبب', verify: 'سيراسلك أمين سر مجلس إدارة الجمعية لاحقًا لطلب إثبات الجنسية السعودية عند الحاجة. لا يلزمك إرسال أي شيء الآن.',
        ev: { h: 'إثبات الجنسية السعودية', p: 'ارفع مستندًا واحدًا: صفحة الصورة في جواز السفر، أو الهوية الوطنية، أو تأكيد الابتعاث من الملحقية الثقافية. يُرسل عبر اتصال مشفّر، ولا يستطيع فتحه سوى أعضاء اللجنة المخوّلين، ويُحذف فور التحقق منه. يرجى عدم إرساله بالبريد الإلكتروني.', again: 'لم يُقبل المستند الذي رفعته وقد حُذف. يرجى رفع مستند آخر.', file: 'صورة أو ملف PDF (حتى ٣ ميغابايت)', agree: 'أوافق على اطّلاع اللجنة على هذا المستند للتحقق من أهليتي للعضوية المجانية فقط.', send: 'ارفع بأمان', sending: 'جارٍ الرفع…', held: 'تم استلام المستند في {when}. سيُحذف فور تحقق اللجنة منه.', remove: 'احذف مستندي', removeQ: 'حذف مستندك؟', removeT: 'يُحذف الآن. يبقى طلبك في قائمة المراجعة، لكن لا يمكن اعتماده عضويةً مجانية قبل التحقق من مستند.', removed: 'تم حذف مستندك.', done: 'شكرًا لك — تم استلام مستندك.', ok: 'تم التحقق من الجنسية السعودية، وحُذف مستندك.', eType: 'يرجى اختيار صورة بصيغة JPEG أو PNG أو WebP، أو ملف PDF.', eBig: 'حجم الملف أكبر من ٣ ميغابايت. يرجى اختيار صورة أو ملف أصغر.', eRead: 'تعذّرت قراءة الملف. جرّب ملفًا آخر.', eNeed: 'اختر ملفًا وضع علامة في المربع أولًا.' } } }
  };
  var s = S[lang];
  document.body.insertAdjacentHTML('afterbegin', O.header('account'));
  document.title = s.title + ' — ' + (O.ar ? 'الجمعية السعودية في أكسفورد' : 'Oxford Saudi Society');
  var app = $('app');
  var banner = '';
  (function () { var p = new URLSearchParams(location.search), v = p.get('verified'); if (v && s.banner[v]) { banner = '<p class="alert ' + (v === 'signed_in' ? 'ok' : 'warn') + '">' + esc(s.banner[v]) + '</p>'; p.delete('verified'); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '')); } })();

  function signin(note) {
    app.innerHTML = '<div class="app-head"><div><p class="eyebrow">' + esc(s.title) + '</p><h1>' + esc(s.signinH) + '</h1></div></div>' + banner + (note || '') +
      '<form id="si" class="pane stack" style="max-width:520px" novalidate><p class="muted" style="margin:0">' + esc(s.signinP) + '</p><div class="f"><label class="lbl" for="si-email">' + esc(s.email) + '</label><input id="si-email" type="email" autocomplete="email" required dir="ltr"></div><div class="f hp" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off" id="si-web"></div><div class="rowc"><button class="btn btn-p" type="submit" id="si-btn">' + esc(s.send) + '</button></div><p class="alert bad" id="si-err" hidden></p></form>';
    $('si').addEventListener('submit', async function (e) {
      e.preventDefault(); var email = $('si-email').value.trim(), err = $('si-err');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = lang === 'ar' ? 'أدخل بريدًا إلكترونيًا صحيحًا.' : 'Enter a valid email address.'; err.hidden = false; return; }
      $('si-btn').disabled = true;
      try { await O.api('/auth/request-link', { method: 'POST', body: { email: email, lang: lang, redirect: location.pathname, website: $('si-web').value } });
        app.innerHTML = '<div class="app-head"><div><p class="eyebrow">' + esc(s.title) + '</p><h1>' + esc(s.sent) + '</h1></div></div><p class="lede" style="max-width:60ch">' + esc(s.sentP.replace('{email}', email)) + '</p>';
      } catch (ex) { err.textContent = ex.status === 429 ? (lang === 'ar' ? 'محاولات كثيرة. حاول بعد قليل.' : 'Too many attempts. Please try again shortly.') : s.err; err.hidden = false; $('si-btn').disabled = false; }
    });
  }

  function card(r, me) {
    var ev = r.event, title = O.L(ev.title), st = r.status, when = O.fmtShort(ev.startUtc) + ' · ' + O.fmtRange(ev.startUtc, ev.endUtc), venue = O.L(ev.venue);
    var evNote = s.evStatus[ev.eventStatus] ? ' <span class="badge ' + esc(ev.eventStatus) + '">' + esc(s.evStatus[ev.eventStatus]) + '</span>' : '';
    var acts = '';
    if (st === 'confirmed' || st === 'checked_in') acts += '<button class="btn btn-s btn-sm" data-act="ticket" data-id="' + esc(r.id) + '">' + esc(s.ticket) + '</button>';
    if (st === 'offered') acts += '<button class="btn btn-p btn-sm" data-act="claim" data-id="' + esc(r.id) + '">' + esc(s.claim) + '</button>';
    if (['interested', 'confirmed', 'waitlisted', 'offered'].indexOf(st) !== -1 && new Date(ev.endUtc) > new Date()) acts += '<button class="btn btn-s btn-sm btn-danger" data-act="cancel" data-id="' + esc(r.id) + '">' + esc(s.cancel) + '</button>';
    var claim = st === 'offered' && r.claimExpiresAt ? '<p class="meta">' + esc(s.claimBy.replace('{t}', O.fmtStamp(r.claimExpiresAt))) + '</p>' : '';
    return '<article class="regc glass" data-id="' + esc(r.id) + '"><a href="' + base + '/events/' + esc(ev.slug) + '/"><img src="' + esc(ev.image || '/assets/seal-880.webp') + '" alt="" width="96" height="96"></a>' +
      '<div><span class="badge ' + esc(st) + '">' + esc(s.status[st] || st) + '</span>' + evNote + '<h3><a class="ev-link" style="color:inherit;text-decoration:none" href="' + base + '/events/' + esc(ev.slug) + '/">' + esc(title) + '</a></h3><p class="meta">' + esc(when) + (venue ? ' · ' + esc(venue) : '') + '</p>' + claim + '</div><div class="acts">' + acts + '</div></article>';
  }

  function memCard(mm) {
    var t = s.mem;
    if (!mm) return '<section class="pane mem-pane"><h2>' + esc(t.h) + '</h2><p class="muted">' + esc(t.none) + '</p><a class="btn btn-p" href="' + base + '/join/">' + esc(t.join) + '</a></section>';
    var day = function (d) { return d ? O.fmtShort(d) : ''; };
    var h = '<section class="mem-pane"><div class="mcard"><div class="mcard-top"><span class="mcard-org">' + esc(O.ar ? 'الجمعية السعودية في أكسفورد' : 'Oxford Saudi Society') + '</span><span class="mstate s-' + esc(mm.status) + '">' + esc(t.st[mm.status] || mm.status) + '</span></div>';
    h += '<span class="mk">' + esc(t.no) + '</span><span class="mno" dir="ltr">' + esc(mm.memberNo) + '</span>';
    h += '<div class="mcard-meta"><div><span class="mk">' + esc(t.type) + '</span><b>' + esc(O.L(mm.tierLabel)) + '</b></div><div><span class="mk">' + esc(mm.status === 'approved' && mm.validUntil ? t.valid : t.since) + '</span><b>' + esc(mm.status === 'approved' && mm.validUntil ? day(mm.validUntil) : day(mm.appliedAt)) + '</b></div>' + (mm.position ? '<div><span class="mk">' + esc(t.queue) + '</span><b>' + esc(O.num(mm.position)) + '</b></div>' : '') + '</div></div>';
    if (mm.reason) h += '<p class="alert warn">' + esc(t.reason) + ': ' + esc(mm.reason) + '</p>';
    if ((mm.status === 'pending' || mm.status === 'info_requested') && mm.paymentStatus === 'due') h += '<p class="alert">' + esc(t.payDue.replace('{amount}', '£' + mm.amountGbp)) + '</p>';
    var openApp = mm.status === 'pending' || mm.status === 'info_requested', ns = mm.nationalityStatus, E = t.ev;
    var saudi = mm.tier === 'saudi'; // nothing about nationality is ever shown for the other membership types
    if (saudi && mm.canUploadProof && openApp && (ns === 'pending' || ns === 'rejected')) {
      h += '<form class="pane mem-ev" id="mem-ev" novalidate><h3>' + esc(E.h) + '</h3>' + (ns === 'rejected' ? '<p class="alert warn">' + esc(E.again) + '</p>' : '') + '<p class="muted" style="margin:0">' + esc(E.p) + '</p>' +
        '<div class="f"><label class="lbl" for="mem-ev-file">' + esc(E.file) + '</label><input id="mem-ev-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></div>' +
        '<label class="chk-l need"><input type="checkbox" id="mem-ev-ok"><span>' + esc(E.agree) + '</span></label>' +
        '<p class="alert bad" id="mem-ev-err" hidden></p><div class="form-foot"><button class="btn btn-p" type="submit" id="mem-ev-btn">' + esc(E.send) + '</button></div></form>';
    } else if (saudi && mm.evidence && openApp && ns === 'submitted') {
      h += '<div class="pane mem-ev"><h3>' + esc(E.h) + '</h3><p class="alert ok">' + esc(E.held.replace('{when}', mm.evidence && mm.evidence.uploadedAt ? O.fmtShort(mm.evidence.uploadedAt) : '')) + '</p><div class="rowc"><button type="button" class="btn btn-s btn-sm" id="mem-ev-remove">' + esc(E.remove) + '</button></div></div>';
    } else if (saudi && openApp && ns !== 'verified' && ns !== 'not_required') {
      h += '<p class="alert">' + esc(t.verify) + '</p>';
    }
    if (mm.status === 'info_requested') {
      h += '<form class="pane mem-q" id="mem-q"><h3>' + esc(t.qH) + '</h3><p class="preview">' + esc(mm.infoRequest) + '</p><div class="f"><label class="lbl" for="mem-ans">' + esc(t.reply) + '</label><textarea id="mem-ans" maxlength="4000" required></textarea></div><div class="form-foot"><button class="btn btn-p" type="submit">' + esc(t.send) + '</button></div></form>';
    } else if (mm.infoResponse && (mm.status === 'pending')) {
      h += '<p class="muted" style="font-size:13.5px">' + esc(t.yourAnswer) + ': “' + esc(mm.infoResponse.slice(0, 300)) + '”</p>';
    }
    return h + '</section>';
  }
  function readAsDataUrl(blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.onerror = function () { rej('read'); }; r.readAsDataURL(blob); }); }
  async function prepareEvidence(file) {
    if (file.type === 'application/pdf') { var d = await readAsDataUrl(file); return { mime: 'application/pdf', data: d.slice(d.indexOf(',') + 1), bytes: file.size }; }
    var url = URL.createObjectURL(file);
    try {
      var img = await new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej('read'); }; i.src = url; });
      var max = 2200, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      var out = c.toDataURL('image/jpeg', 0.86), b64 = out.slice(out.indexOf(',') + 1);
      return { mime: 'image/jpeg', data: b64, bytes: Math.floor(b64.length * 3 / 4) };
    } finally { URL.revokeObjectURL(url); }
  }
  async function load(note) {
    var me;
    try { me = await O.api('/me'); } catch (e) { if (e.status === 401) return signin(note); app.innerHTML = '<p class="alert bad">' + esc(s.err) + '</p>'; return; }
    var now = new Date(), up = me.registrations.filter(function (r) { return new Date(r.event.endUtc) >= now; }), past = me.registrations.filter(function (r) { return new Date(r.event.endUtc) < now; }).reverse();
    var h = '<div class="app-head"><div><p class="eyebrow">' + esc(s.sub) + '</p><h1>' + esc(s.page) + '</h1><p class="who">' + esc(s.signedInAs) + ' <b dir="ltr">' + esc(me.email) + '</b>' + (me.member ? ' · <span class="badge confirmed">' + esc(s.member) + '</span>' : '') + '</p></div><div class="rowc">' + (me.staff ? '<a class="btn btn-s btn-sm" href="' + base + '/admin/events/">' + esc(s.desk) + '</a>' : '') + '<button class="btn btn-s btn-sm" id="signout">' + esc(s.signout) + '</button></div></div>' + banner + (note || '');
    h += memCard(me.membership);
    h += '<h2 class="eyebrow ev-sec" style="margin-top:30px">' + esc(s.title) + '</h2>';
    if (!me.registrations.length) h += '<div class="dir-empty"><p>' + esc(s.none) + '</p><a class="btn btn-p" href="' + base + '/events/">' + esc(s.browse) + '</a></div>';
    if (up.length) h += '<h2 class="eyebrow ev-sec">' + esc(s.upcoming) + '</h2><div class="stack">' + up.map(function (r) { return card(r, me); }).join('') + '</div>';
    if (past.length) h += '<h2 class="eyebrow ev-sec" style="margin-top:28px">' + esc(s.past) + '</h2><div class="stack">' + past.map(function (r) { return card(r, me); }).join('') + '</div>';
    if (me.registrations.some(function (r) { return r.status === 'confirmed' || r.status === 'checked_in'; })) h += '<p class="muted" style="font-size:13px;margin-top:18px">' + esc(s.ticketNote) + '</p>';
    app.innerHTML = h; banner = '';
    var mq = $('mem-q');
    if (mq) mq.addEventListener('submit', async function (e) {
      e.preventDefault(); var v = $('mem-ans').value.trim(); if (v.length < 2) return;
      mq.querySelector('button').disabled = true;
      try { await O.api('/membership/respond', { method: 'POST', body: { response: v } }); return load('<p class="alert ok">' + esc(s.mem.sent) + '</p>'); }
      catch (ex) { mq.querySelector('button').disabled = false; load('<p class="alert bad">' + esc(s.err) + '</p>'); }
    });
    var evf = $('mem-ev');
    if (evf) evf.addEventListener('submit', async function (e) {
      e.preventDefault(); var E = s.mem.ev, err = $('mem-ev-err'), btn = $('mem-ev-btn'), f = $('mem-ev-file').files[0];
      var say = function (m) { err.textContent = m; err.hidden = false; };
      err.hidden = true;
      if (!f || !$('mem-ev-ok').checked) return say(E.eNeed);
      if (['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].indexOf(f.type) === -1) return say(E.eType);
      btn.disabled = true; var keep = btn.textContent; btn.textContent = E.sending;
      try {
        var doc = await prepareEvidence(f);
        if (doc.bytes > 3 * 1024 * 1024) { btn.disabled = false; btn.textContent = keep; return say(E.eBig); }
        await O.api('/membership/evidence', { method: 'POST', body: { mime: doc.mime, data: doc.data } });
        return load('<p class="alert ok">' + esc(E.done) + '</p>');
      } catch (ex) {
        btn.disabled = false; btn.textContent = keep;
        var code = ex && ex.data && ex.data.error;
        say(ex && ex.status === 413 || code === 'file_too_large' || code === 'body_too_large' ? E.eBig : code === 'bad_type' ? E.eType : code === 'bad_file' || ex === 'read' ? E.eRead : ex && ex.status === 429 ? (lang === 'ar' ? 'محاولات كثيرة. حاول بعد قليل.' : 'Too many attempts. Please try again shortly.') : s.err);
      }
    });
    var evr = $('mem-ev-remove');
    if (evr) evr.addEventListener('click', async function () {
      var E = s.mem.ev; if (!(await O.confirm(E.removeQ, E.removeT, E.remove))) return;
      evr.disabled = true;
      try { await O.api('/membership/evidence', { method: 'DELETE' }); return load('<p class="alert ok">' + esc(E.removed) + '</p>'); } catch (ex) { evr.disabled = false; load('<p class="alert bad">' + esc(s.err) + '</p>'); }
    });
    $('signout').addEventListener('click', async function () { try { await O.api('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ } location.reload(); });
    app.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.getAttribute('data-id'), act = b.getAttribute('data-act');
        b.disabled = true;
        try {
          if (act === 'ticket') { var t = await O.api('/registrations/' + id + '/ticket', { method: 'POST' }); location.href = base + '/t/' + t.token; return; }
          if (act === 'claim') { var c = await O.api('/registrations/' + id + '/claim', { method: 'POST' }); return load('<p class="alert ' + (c.ok ? 'ok' : 'warn') + '">' + esc(c.ok ? s.claimed : s.claimGone) + '</p>'); }
          if (act === 'cancel') { if (!(await O.confirm(s.cancelQ, s.cancelT, s.yesCancel))) { b.disabled = false; return; } await O.api('/registrations/' + id + '/cancel', { method: 'POST' }); return load('<p class="alert ok">' + esc(s.cancelled) + '</p>'); }
        } catch (e) { b.disabled = false; load('<p class="alert bad">' + esc(s.err) + '</p>'); }
      });
    });
  }
  load();
})();

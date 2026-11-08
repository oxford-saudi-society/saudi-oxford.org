/* /account/ — the signed-in person's registrations (sign-in by email link; no passwords). */
(function () {
  'use strict';
  var O = window.OSS, $ = O.$, esc = O.esc, lang = O.lang, base = O.base;
  var S = {
    en: { title: 'My registrations', sub: 'Your event registrations, tickets and waitlist places.', signinH: 'Sign in with your email', signinP: 'Enter the address you used to register and we will email you a sign-in link. No password needed.', email: 'Email', send: 'Email me a sign-in link', sent: 'Check your email', sentP: 'If {email} has registrations or a membership, a sign-in link is on its way. It works once and expires in 30 minutes.',
      signedInAs: 'Signed in as', member: 'Verified member', signout: 'Sign out', upcoming: 'Upcoming', past: 'Past', none: 'No registrations yet.', browse: 'Browse the programme', ticket: 'Show ticket', cancel: 'Cancel registration', claim: 'Claim my place', claimBy: 'Claim by {t}', cancelQ: 'Cancel this registration?', cancelT: 'Your place goes to the next person and any ticket stops working.', yesCancel: 'Yes, cancel', cancelled: 'Registration cancelled.', claimed: 'Your place is confirmed. Your ticket has been emailed to you.', claimGone: 'Sorry — that place was taken or the offer expired.', ticketNote: 'Opening a ticket here replaces any earlier ticket link.', desk: 'Committee desk', err: 'Something went wrong. Please try again.',
      status: { interested: 'Interest registered (not a booking)', confirmed: 'Confirmed', waitlisted: 'On the waitlist', offered: 'Place offered — claim it', checked_in: 'Checked in', cancelled: 'Cancelled', expired: 'Offer expired', declined: 'Declined' },
      banner: { signed_in: 'You are signed in.', invalid: 'That link is not valid.', expired: 'That link has expired. Request a new one below.', used: 'That link was already used — request a new one if you are not signed in.' },
      evStatus: { proposed: 'proposed', confirmed: '', postponed: 'postponed — date to be confirmed', cancelled: 'cancelled', completed: '' } },
    ar: { title: 'تسجيلاتي', sub: 'تسجيلاتك في الفعاليات وتذاكرك ومقاعدك في قوائم الانتظار.', signinH: 'سجّل الدخول ببريدك الإلكتروني', signinP: 'أدخل البريد الذي سجّلت به وسنرسل لك رابط دخول. لا حاجة لكلمة مرور.', email: 'البريد الإلكتروني', send: 'أرسل لي رابط الدخول', sent: 'تحقّق من بريدك', sentP: 'إذا كان {email} مرتبطًا بتسجيلات أو عضوية فرابط الدخول في طريقه إليك. يعمل مرة واحدة وتنتهي صلاحيته خلال ٣٠ دقيقة.',
      signedInAs: 'مسجّل الدخول باسم', member: 'عضو معتمد', signout: 'تسجيل الخروج', upcoming: 'القادمة', past: 'السابقة', none: 'لا توجد تسجيلات بعد.', browse: 'تصفّح البرنامج', ticket: 'عرض التذكرة', cancel: 'إلغاء التسجيل', claim: 'تأكيد مقعدي', claimBy: 'أكّد قبل {t}', cancelQ: 'إلغاء هذا التسجيل؟', cancelT: 'سيذهب مقعدك إلى الشخص التالي وتتوقف أي تذكرة عن العمل.', yesCancel: 'نعم، ألغِ', cancelled: 'تم إلغاء التسجيل.', claimed: 'تم تأكيد مقعدك، وأُرسلت التذكرة إلى بريدك.', claimGone: 'عذرًا — حُجز المقعد أو انتهت مدة العرض.', ticketNote: 'فتح التذكرة هنا يستبدل أي رابط تذكرة سابق.', desk: 'مكتب اللجنة', err: 'حدث خطأ ما. حاول مجددًا.',
      status: { interested: 'تم تسجيل الاهتمام (ليس حجزًا)', confirmed: 'مؤكد', waitlisted: 'في قائمة الانتظار', offered: 'عُرض عليك مقعد — أكّده', checked_in: 'تم تسجيل الحضور', cancelled: 'ملغى', expired: 'انتهى العرض', declined: 'مرفوض' },
      banner: { signed_in: 'تم تسجيل دخولك.', invalid: 'هذا الرابط غير صالح.', expired: 'انتهت صلاحية الرابط. اطلب رابطًا جديدًا أدناه.', used: 'استُخدم هذا الرابط من قبل — اطلب رابطًا جديدًا إن لم تكن مسجّل الدخول.' },
      evStatus: { proposed: 'مقترح', confirmed: '', postponed: 'مؤجل — التاريخ قيد التأكيد', cancelled: 'ملغاة', completed: '' } }
  };
  var s = S[lang];
  document.body.insertAdjacentHTML('afterbegin', O.header('account'));
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

  async function load(note) {
    var me;
    try { me = await O.api('/me'); } catch (e) { if (e.status === 401) return signin(note); app.innerHTML = '<p class="alert bad">' + esc(s.err) + '</p>'; return; }
    var now = new Date(), up = me.registrations.filter(function (r) { return new Date(r.event.endUtc) >= now; }), past = me.registrations.filter(function (r) { return new Date(r.event.endUtc) < now; }).reverse();
    var h = '<div class="app-head"><div><p class="eyebrow">' + esc(s.title) + '</p><h1>' + esc(s.title) + '</h1><p class="who">' + esc(s.signedInAs) + ' <b dir="ltr">' + esc(me.email) + '</b>' + (me.member ? ' · <span class="badge confirmed">' + esc(s.member) + '</span>' : '') + '</p></div><div class="rowc">' + (me.staff ? '<a class="btn btn-s btn-sm" href="' + base + '/admin/events/">' + esc(s.desk) + '</a>' : '') + '<button class="btn btn-s btn-sm" id="signout">' + esc(s.signout) + '</button></div></div>' + banner + (note || '');
    if (!me.registrations.length) h += '<div class="dir-empty"><p>' + esc(s.none) + '</p><a class="btn btn-p" href="' + base + '/events/">' + esc(s.browse) + '</a></div>';
    if (up.length) h += '<h2 class="eyebrow ev-sec">' + esc(s.upcoming) + '</h2><div class="stack">' + up.map(function (r) { return card(r, me); }).join('') + '</div>';
    if (past.length) h += '<h2 class="eyebrow ev-sec" style="margin-top:28px">' + esc(s.past) + '</h2><div class="stack">' + past.map(function (r) { return card(r, me); }).join('') + '</div>';
    if (me.registrations.some(function (r) { return r.status === 'confirmed' || r.status === 'checked_in'; })) h += '<p class="muted" style="font-size:13px;margin-top:18px">' + esc(s.ticketNote) + '</p>';
    app.innerHTML = h; banner = '';
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

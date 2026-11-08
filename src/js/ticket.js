/* /t/<token> — a ticket: event, attendee first name, QR code. The token in the address is the credential. */
(function () {
  'use strict';
  var O = window.OSS, $ = O.$, esc = O.esc, lang = O.lang, base = O.base;
  var S = {
    en: { eyebrow: 'Your ticket', valid: 'Valid — show at the door', used: 'Checked in', bad: 'Not valid', revoked: 'This ticket was replaced or cancelled.', cancelled: 'This registration was cancelled.', evCancelled: 'This event has been cancelled.', notFound: 'Ticket not found', notFoundP: 'This link is not a current ticket. Open your registrations to get a fresh one.', mine: 'My registrations', ics: 'Add to calendar', hint: 'Screenshot or save this page. The QR code carries only a random ticket number — no personal details.', checkedAt: 'Checked in at {t}', oxford: '(Oxford time)' },
    ar: { eyebrow: 'تذكرتك', valid: 'صالحة — أبرزها عند الدخول', used: 'تم تسجيل الحضور', bad: 'غير صالحة', revoked: 'استُبدلت هذه التذكرة أو أُلغيت.', cancelled: 'أُلغي هذا التسجيل.', evCancelled: 'أُلغيت هذه الفعالية.', notFound: 'التذكرة غير موجودة', notFoundP: 'هذا الرابط ليس تذكرة سارية. افتح تسجيلاتك للحصول على تذكرة جديدة.', mine: 'تسجيلاتي', ics: 'أضف إلى التقويم', hint: 'التقط لقطة شاشة أو احفظ هذه الصفحة. يحمل رمز QR رقمًا عشوائيًا للتذكرة فقط — دون أي بيانات شخصية.', checkedAt: 'سُجّل الحضور في {t}', oxford: '(بتوقيت أكسفورد)' }
  };
  var s = S[lang];
  document.body.insertAdjacentHTML('afterbegin', O.header('account'));
  var app = $('app');
  var token = location.pathname.replace(/^\/ar/, '').replace(/^\/t\//, '').replace(/\/$/, '');
  (async function () {
    var t;
    try { t = await O.api('/tickets/' + encodeURIComponent(token)); }
    catch (e) { app.innerHTML = '<div class="ticket"><p class="eyebrow">' + esc(s.eyebrow) + '</p><h1>' + esc(s.notFound) + '</h1><p class="alt">' + esc(s.notFoundP) + '</p><a class="btn btn-p" href="' + base + '/account/">' + esc(s.mine) + '</a></div>'; return; }
    var ev = t.event, title = O.L(ev.title), other = O.ar ? (ev.title.en || '') : (ev.title.ar || '');
    var state, cls, note = '';
    if (ev.eventStatus === 'cancelled') { state = s.bad; cls = 'bad'; note = s.evCancelled; }
    else if (t.status === 'checked_in') { state = s.used; cls = 'used'; note = s.checkedAt.replace('{t}', O.fmtStamp(t.checkedInAt)); }
    else if (t.valid) { state = s.valid; cls = 'ok'; }
    else { state = s.bad; cls = 'bad'; note = t.status === 'cancelled' ? s.cancelled : s.revoked; }
    app.innerHTML = '<div class="ticket"><p class="eyebrow">' + esc(s.eyebrow) + '</p><h1>' + esc(title) + '</h1><p class="alt" lang="' + (O.ar ? 'en' : 'ar') + '" dir="' + (O.ar ? 'ltr' : 'rtl') + '">' + esc(other) + '</p>' +
      '<p class="when"><b>' + esc(O.fmtLong(ev.startUtc)) + '</b><br>' + esc(O.fmtRange(ev.startUtc, ev.endUtc)) + ' ' + esc(s.oxford) + '<br>' + esc(O.L(ev.venue)) + '</p>' +
      (t.qrSvg ? '<div class="qr" aria-label="QR code">' + t.qrSvg + '</div>' : '<div class="qr" aria-hidden="true" style="opacity:.25"></div>') +
      '<p class="name">' + esc(t.attendee) + '</p><span class="state ' + cls + '">' + esc(state) + '</span>' + (note ? '<p class="alt" style="margin-top:10px">' + esc(note) + '</p>' : '') +
      '<div class="dash"></div><p class="code" dir="ltr">' + esc(token.slice(0, 6)) + '…' + esc(token.slice(-4)) + '</p><p class="foot">' + esc(s.hint) + '</p>' +
      '<p class="foot noprint"><a href="/api/events/' + esc(ev.id) + '/calendar.ics">' + esc(s.ics) + '</a> · <a href="' + base + '/account/">' + esc(s.mine) + '</a></p></div>';
    document.title = title + ' — ' + s.eyebrow;
  })();
})();

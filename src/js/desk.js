/* /admin/events/ — the committee desk: programme status, bookings, check-in, notices, members, staff, audit.
   Everything here is enforced again on the server; the page only shows what the signed-in role may do. */
(function () {
  'use strict';
  var O = window.OSS, $ = O.$, esc = O.esc, lang = O.lang, base = O.base, L = O.L;
  var S = {
    en: {
      title: 'Committee desk', sub: 'Membership & events', signinH: 'Staff sign-in', signinP: 'Enter your committee email and we will send you a sign-in link.', email: 'Email', send: 'Email me a sign-in link', sent: 'Check your email', sentP: 'If {email} is on the committee list, a sign-in link is on its way. It works once, within 30 minutes.', sentHelp: 'Nothing after a few minutes? Check junk or quarantine, then send a new link.', sentAgain: 'Use a different address or send again', notStaff: 'This address is not on the staff list. Ask a super admin to add you.',
      tabs: { membership: 'Membership', overview: 'Events', checkin: 'Check-in', mail: 'Email queue', members: 'Members', staff: 'Staff', audit: 'Audit log' }, back: '← Programme',
      th: { event: 'Event', when: 'When', status: 'Status', mode: 'Registration', cap: 'Capacity', interested: 'Interest', confirmed: 'Confirmed', waitlist: 'Waitlist', checkedIn: 'Checked in', actions: '' },
      st: { proposed: 'Proposed', confirmed: 'Confirmed', postponed: 'Postponed', cancelled: 'Cancelled', completed: 'Completed' },
      mode: { none: 'No booking', interest_only: 'Interest only', open: 'Open', waitlist_only: 'Waitlist only', closed: 'Closed' },
      state: { interest: 'Taking interest', soon: 'Opening soon', book: 'Booking open', waitlist: 'Waitlist open', full: 'Full', closed: 'Closed', none: 'No booking', cancelled: 'Cancelled', tbc: 'Date TBC', past: 'Past' },
      manage: 'Manage', roster: 'Bookings', checkin: 'Check-in', comms: 'Notices', unlimited: 'unlimited', publish: 'Publish site', publishHint: 'Rebuilds the public pages from the desk content (needs the build hook).', published: 'Publish started.',
      edit: 'Event settings', editP: 'Dates and venue are proposed until you confirm them. Registration can only open on a confirmed event; tickets are issued only then.',
      f: { status: 'Event status', mode: 'Registration mode', audience: 'Audience', capacity: 'Capacity (blank = unlimited)', waitlist: 'Waitlist when full', opens: 'Booking opens (Oxford time, optional)', closes: 'Booking closes (optional)', start: 'Starts (Oxford time)', end: 'Ends', venue: 'Venue', price: 'Price', reason: 'Reason / note for attendees (optional)', save: 'Save changes', saved: 'Saved.', public: 'All welcome', members: 'Members only', free: 'Free', tbd: 'To be announced', publishedF: 'Visible on the website' },
      previewH: 'This change notifies registered people', previewP: '{n} people will receive an email. The calendar entry version becomes {v}.', confirmSend: 'Apply and notify', cancelBtn: 'Go back',
      counts: { interested: 'Interest', confirmed: 'Confirmed', waitlisted: 'Waitlisted', offered: 'Offered', checked_in: 'Checked in', cancelled: 'Cancelled' },
      rosterH: 'Bookings & interest', search: 'Search name or email', all: 'All statuses', csv: 'Download CSV', none: 'No registrations match.', cancelReg: 'Cancel', resend: 'Resend ticket', cancelQ: 'Cancel this registration?', cancelT: 'The person is emailed; a freed seat goes to the waitlist.', reasonPrompt: 'Reason (sent to the person)', yes: 'Yes, cancel', done: 'Done.', page: 'Page {p} of {n}', prev: 'Previous', next: 'Next',
      rth: { name: 'Name', email: 'Email', status: 'Status', kind: 'Type', registered: 'Registered', member: 'Member', news: 'News opt-in', actions: '' }, kind: { interest: 'Interest', booking: 'Booking' },
      rst: { interested: 'Interested', confirmed: 'Confirmed', waitlisted: 'Waitlisted', offered: 'Offered', checked_in: 'Checked in', cancelled: 'Cancelled', expired: 'Expired', declined: 'Declined' },
      scanH: 'Scan tickets', scanP: 'Point the camera at the QR code. If the camera is unavailable, paste the ticket code or search by name.', startCam: 'Start camera', stopCam: 'Stop camera', noCam: 'Camera scanning is not supported in this browser — use the code field or name search.', codeF: 'Ticket code', admit: 'Admit', nameF: 'Find by name (3+ letters)', find: 'Find', manualAdmit: 'Admit manually', ready: 'Ready to scan', chooseEvent: 'Choose the event first',
      res: { admitted: 'Admitted', duplicate: 'Already checked in', invalid: 'Not a valid ticket', wrong_event: 'Ticket is for another event', revoked: 'Ticket cancelled or replaced', not_confirmed: 'Registration not confirmed' }, at: 'at {t}', tally: '{a} of {c} checked in',
      commsH: 'Notice to registered people', commsP: 'Write both languages; each person receives the language they registered in. Preview first.', to: 'Send to', seg: { confirmed: 'Confirmed attendees', waitlisted: 'Waitlist', interested: 'Registered interest', all_active: 'Everyone active' }, subject: 'Subject', body: 'Message', preview: 'Preview', sendN: 'Send to {n} people', queued: 'Queued {n} emails.',
      mailH: 'Email queue', mth: { when: 'Queued', kind: 'Type', to: 'To', subject: 'Subject', status: 'Status', attempts: 'Tries', error: 'Last error', actions: '' }, retry: 'Retry', process: 'Send queued now', filter: 'All', processed: 'Sent {s}, failed {f}.',
      membersH: 'Verified members', membersP: 'Members-only events check this list. Add people once their membership is approved; revoke when it lapses.', addH: 'Add or update a member', name: 'Name', tier: 'Membership type', validUntil: 'Valid until (optional)', mstatus: 'Status', mst: { approved: 'Approved', pending: 'Pending', revoked: 'Revoked', expired: 'Expired' }, add: 'Save member', bulkH: 'Paste a list', bulkP: 'One per line: email, name (optional). All are saved as approved.', bulkBtn: 'Import list', imported: 'Saved {n} members.', mth2: { email: 'Email', name: 'Name', status: 'Status', tier: 'Type', until: 'Valid until', by: 'Approved by' },
      staffH: 'Staff & roles', staffP: 'super_admin: everything · events_admin: edit events, bookings, notices, members · checkin_staff: check-in only (optionally limited to chosen events).', role: 'Role', events: 'Limit to events (optional)', addStaff: 'Save staff member', disable: 'Remove', sth: { email: 'Email', name: 'Name', role: 'Role', events: 'Events', status: 'Status' }, active: 'Active', disabled: 'Removed',
      auditH: 'Audit log', ath: { at: 'When', actor: 'Who', action: 'Action', resource: 'Resource', meta: 'Details' },
      err: 'Something went wrong.', errCodes: { capacity_below_seated: 'Capacity cannot be lower than the seats already taken.', confirm_before_opening: 'Confirm the event (status = Confirmed) before opening registration.', paid_not_enabled: 'Paid events are not enabled yet.', bad_times: 'The end must be after the start.', forbidden: 'Your role does not allow this.', rate_limited: 'Too many requests — wait a moment.', build_hook_not_configured: 'The publish hook is not configured yet (NETLIFY_BUILD_HOOK).', payment_required: 'Payment has not been confirmed. Under Checks, mark the fee as received (or waived) before approving.', eligibility_required: 'Eligibility has not been confirmed. A free membership becomes active only after the committee confirms the person’s Saudi nationality and Oxford connection.', eligibility_review_open: 'This application is awaiting an eligibility check. Decide that first, in the Eligibility box.', no_review_open: 'There is no open eligibility check on this application.' },
      signout: 'Sign out', who: 'Signed in as', editor: 'Website editor', editorHint: 'Edit the pages of the website. It signs in with GitHub.'
    },
    ar: {
      title: 'مكتب اللجنة', sub: 'العضوية والفعاليات', signinH: 'دخول أعضاء اللجنة', signinP: 'أدخل بريدك في اللجنة وسنرسل لك رابط دخول.', email: 'البريد الإلكتروني', send: 'أرسل لي رابط الدخول', sent: 'تحقّق من بريدك', sentP: 'إن كان {email} ضمن قائمة اللجنة فرابط الدخول في الطريق إليك، ويعمل مرة واحدة خلال ٣٠ دقيقة.', sentHelp: 'لم يصل شيء بعد بضع دقائق؟ تحقّق من البريد غير المرغوب فيه ثم اطلب رابطًا جديدًا.', sentAgain: 'استخدم بريدًا آخر أو أعد الإرسال', notStaff: 'هذا البريد ليس في قائمة الموظفين. اطلب من المشرف العام إضافتك.',
      tabs: { membership: 'العضوية', overview: 'الفعاليات', checkin: 'تسجيل الحضور', mail: 'قائمة البريد', members: 'الأعضاء', staff: 'الموظفون', audit: 'سجل التدقيق' }, back: '→ البرنامج',
      th: { event: 'الفعالية', when: 'الموعد', status: 'الحالة', mode: 'التسجيل', cap: 'السعة', interested: 'اهتمام', confirmed: 'مؤكد', waitlist: 'انتظار', checkedIn: 'حضر', actions: '' },
      st: { proposed: 'مقترحة', confirmed: 'مؤكدة', postponed: 'مؤجلة', cancelled: 'ملغاة', completed: 'منتهية' },
      mode: { none: 'بلا حجز', interest_only: 'اهتمام فقط', open: 'مفتوح', waitlist_only: 'قائمة انتظار فقط', closed: 'مغلق' },
      state: { interest: 'يستقبل الاهتمام', soon: 'يُفتح قريبًا', book: 'الحجز مفتوح', waitlist: 'قائمة الانتظار مفتوحة', full: 'مكتمل', closed: 'مغلق', none: 'بلا حجز', cancelled: 'ملغاة', tbc: 'التاريخ قيد التأكيد', past: 'منتهية' },
      manage: 'إدارة', roster: 'الحجوزات', checkin: 'الحضور', comms: 'الإشعارات', unlimited: 'غير محدود', publish: 'نشر الموقع', publishHint: 'يعيد بناء الصفحات العامة من محتوى المكتب (يتطلب رابط البناء).', published: 'بدأ النشر.',
      edit: 'إعدادات الفعالية', editP: 'التواريخ والأماكن مقترحة حتى تؤكدها. لا يُفتح التسجيل إلا لفعالية مؤكدة، ولا تُصدر التذاكر إلا حينها.',
      f: { status: 'حالة الفعالية', mode: 'وضع التسجيل', audience: 'الجمهور', capacity: 'السعة (فارغ = غير محدود)', waitlist: 'قائمة انتظار عند الاكتمال', opens: 'يُفتح الحجز (بتوقيت أكسفورد، اختياري)', closes: 'يُغلق الحجز (اختياري)', start: 'يبدأ (بتوقيت أكسفورد)', end: 'ينتهي', venue: 'المكان', price: 'الرسوم', reason: 'السبب / ملاحظة للحضور (اختياري)', save: 'حفظ التغييرات', saved: 'تم الحفظ.', public: 'مرحبًا بالجميع', members: 'للأعضاء فقط', free: 'مجاني', tbd: 'تُعلن لاحقًا', publishedF: 'ظاهرة على الموقع' },
      previewH: 'هذا التغيير يُشعر المسجّلين', previewP: 'سيصل بريد إلى {n} شخصًا. يصبح إصدار التقويم {v}.', confirmSend: 'تطبيق وإرسال', cancelBtn: 'رجوع',
      counts: { interested: 'اهتمام', confirmed: 'مؤكد', waitlisted: 'انتظار', offered: 'معروض', checked_in: 'حضر', cancelled: 'ملغى' },
      rosterH: 'الحجوزات والاهتمام', search: 'ابحث بالاسم أو البريد', all: 'كل الحالات', csv: 'تنزيل CSV', none: 'لا توجد نتائج مطابقة.', cancelReg: 'إلغاء', resend: 'إعادة إرسال التذكرة', cancelQ: 'إلغاء هذا التسجيل؟', cancelT: 'يُرسل بريد للشخص، ويذهب المقعد المحرر إلى قائمة الانتظار.', reasonPrompt: 'السبب (يُرسل للشخص)', yes: 'نعم، ألغِ', done: 'تم.', page: 'صفحة {p} من {n}', prev: 'السابق', next: 'التالي',
      rth: { name: 'الاسم', email: 'البريد', status: 'الحالة', kind: 'النوع', registered: 'سُجّل في', member: 'عضو', news: 'أخبار', actions: '' }, kind: { interest: 'اهتمام', booking: 'حجز' },
      rst: { interested: 'مهتم', confirmed: 'مؤكد', waitlisted: 'انتظار', offered: 'معروض', checked_in: 'حضر', cancelled: 'ملغى', expired: 'منتهٍ', declined: 'مرفوض' },
      scanH: 'مسح التذاكر', scanP: 'وجّه الكاميرا نحو رمز QR. إن لم تتوفر الكاميرا فألصق رمز التذكرة أو ابحث بالاسم.', startCam: 'تشغيل الكاميرا', stopCam: 'إيقاف الكاميرا', noCam: 'المسح بالكاميرا غير مدعوم في هذا المتصفح — استخدم حقل الرمز أو البحث بالاسم.', codeF: 'رمز التذكرة', admit: 'إدخال', nameF: 'ابحث بالاسم (٣ أحرف فأكثر)', find: 'بحث', manualAdmit: 'إدخال يدوي', ready: 'جاهز للمسح', chooseEvent: 'اختر الفعالية أولًا',
      res: { admitted: 'تم الإدخال', duplicate: 'سُجّل حضوره مسبقًا', invalid: 'تذكرة غير صالحة', wrong_event: 'التذكرة لفعالية أخرى', revoked: 'التذكرة ملغاة أو مستبدلة', not_confirmed: 'التسجيل غير مؤكد' }, at: 'في {t}', tally: 'حضر {a} من {c}',
      commsH: 'إشعار للمسجّلين', commsP: 'اكتب باللغتين؛ يصل كل شخص باللغة التي سجّل بها. عاين أولًا.', to: 'إرسال إلى', seg: { confirmed: 'الحضور المؤكدون', waitlisted: 'قائمة الانتظار', interested: 'المهتمون', all_active: 'الجميع' }, subject: 'الموضوع', body: 'الرسالة', preview: 'معاينة', sendN: 'إرسال إلى {n}', queued: 'أُدرج {n} بريدًا في القائمة.',
      mailH: 'قائمة البريد', mth: { when: 'أُدرج', kind: 'النوع', to: 'إلى', subject: 'الموضوع', status: 'الحالة', attempts: 'محاولات', error: 'آخر خطأ', actions: '' }, retry: 'إعادة', process: 'أرسل المنتظر الآن', filter: 'الكل', processed: 'أُرسل {s}، فشل {f}.',
      membersH: 'الأعضاء المعتمدون', membersP: 'تتحقق فعاليات الأعضاء من هذه القائمة. أضف الأشخاص بعد اعتماد عضويتهم، وألغِ عند انتهائها.', addH: 'إضافة أو تحديث عضو', name: 'الاسم', tier: 'نوع العضوية', validUntil: 'صالحة حتى (اختياري)', mstatus: 'الحالة', mst: { approved: 'معتمد', pending: 'قيد المراجعة', revoked: 'ملغى', expired: 'منتهٍ' }, add: 'حفظ العضو', bulkH: 'لصق قائمة', bulkP: 'سطر لكل شخص: البريد، الاسم (اختياري). يُحفظ الجميع كمعتمدين.', bulkBtn: 'استيراد القائمة', imported: 'حُفظ {n} عضوًا.', mth2: { email: 'البريد', name: 'الاسم', status: 'الحالة', tier: 'النوع', until: 'حتى', by: 'اعتمده' },
      staffH: 'الموظفون والأدوار', staffP: 'super_admin: كل شيء · events_admin: تعديل الفعاليات والحجوزات والإشعارات والأعضاء · checkin_staff: تسجيل الحضور فقط (يمكن حصره بفعاليات محددة).', role: 'الدور', events: 'حصر بفعاليات (اختياري)', addStaff: 'حفظ الموظف', disable: 'إزالة', sth: { email: 'البريد', name: 'الاسم', role: 'الدور', events: 'الفعاليات', status: 'الحالة' }, active: 'نشط', disabled: 'مُزال',
      auditH: 'سجل التدقيق', ath: { at: 'متى', actor: 'من', action: 'الإجراء', resource: 'المورد', meta: 'التفاصيل' },
      err: 'حدث خطأ ما.', errCodes: { capacity_below_seated: 'لا يمكن أن تقل السعة عن المقاعد المحجوزة.', confirm_before_opening: 'أكّد الفعالية (الحالة = مؤكدة) قبل فتح التسجيل.', paid_not_enabled: 'الفعاليات المدفوعة غير مفعّلة بعد.', bad_times: 'يجب أن تكون النهاية بعد البداية.', forbidden: 'دورك لا يسمح بهذا.', rate_limited: 'طلبات كثيرة — انتظر قليلًا.', build_hook_not_configured: 'رابط النشر غير مهيأ بعد (NETLIFY_BUILD_HOOK).', payment_required: 'لم يُؤكَّد السداد. سجّل الرسوم كمستلمة (أو معفاة) من قسم «التحقق» قبل الموافقة.', eligibility_required: 'لم تُؤكَّد الأهلية. لا تُفعَّل العضوية المجانية إلا بعد تأكيد اللجنة الجنسية السعودية والصلة بأكسفورد.', eligibility_review_open: 'هذا الطلب بانتظار التحقق من الأهلية. احسم ذلك أولًا من مربع «الأهلية».', no_review_open: 'لا يوجد تحقق أهلية مفتوح لهذا الطلب.' },
      signout: 'تسجيل الخروج', who: 'مسجّل الدخول باسم', editor: 'محرّر الموقع', editorHint: 'تعديل صفحات الموقع. يتم الدخول إليه عبر GitHub.'
    }
  };
  var s = S[lang];
  document.body.insertAdjacentHTML('afterbegin', O.header('desk'));
  var app = $('app');
  var me = null, overview = null;
  var errText = function (e) { return (e && e.data && s.errCodes[e.data.error]) || (e && e.status === 429 ? s.errCodes.rate_limited : s.err); };
  function flash(html, kind) { var el = $('flash'); if (!el) return; el.innerHTML = html ? '<p class="alert ' + (kind || 'ok') + '">' + html + '</p>' : ''; window.scrollTo({ top: 0, behavior: 'smooth' }); }
  var canEdit = function () { return me && (me.role === 'events_admin' || me.role === 'super_admin'); };

  function signin(note) {
    app.innerHTML = '<div class="app-head"><div><p class="eyebrow">' + esc(s.title) + '</p><h1>' + esc(s.signinH) + '</h1></div></div>' + (note || '') +
      '<form id="si" class="pane stack" style="max-width:520px" novalidate><p class="muted" style="margin:0">' + esc(s.signinP) + '</p><div class="f"><label class="lbl" for="si-email">' + esc(s.email) + '</label><input id="si-email" type="email" autocomplete="email" required dir="ltr"></div><div class="rowc"><button class="btn btn-p" type="submit" id="si-btn">' + esc(s.send) + '</button></div><p class="alert bad" id="si-err" hidden></p></form>';
    $('si').addEventListener('submit', async function (e) {
      e.preventDefault(); var email = $('si-email').value.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return;
      $('si-btn').disabled = true;
      try {
        await O.api('/auth/request-link', { method: 'POST', body: { email: email, lang: lang, redirect: location.pathname } });
        app.innerHTML = '<div class="app-head"><div><p class="eyebrow">' + esc(s.title) + '</p><h1>' + esc(s.sent) + '</h1></div></div>' +
          '<div class="pane stack" style="max-width:520px"><p style="margin:0">' + s.sentP.replace('{email}', '<b dir="ltr">' + esc(email) + '</b>') + '</p><p class="muted" style="margin:0">' + esc(s.sentHelp) + '</p>' +
          '<div class="rowc"><button class="btn btn-s" type="button" id="si-again">' + esc(s.sentAgain) + '</button></div></div>';
        $('si-again').addEventListener('click', function () { signin(); $('si-email').value = email; });
      }
      catch (ex) { $('si-err').textContent = errText(ex); $('si-err').hidden = false; $('si-btn').disabled = false; }
    });
  }

  function shell(tab, inner) {
    var tabs = ['membership', 'overview', 'checkin', 'mail', 'staff', 'audit'].filter(function (t) { if (t === 'staff') return me.role === 'super_admin'; if (t === 'mail' || t === 'membership' || t === 'audit') return canEdit(); return true; });
    app.innerHTML = '<div class="app-head"><div><p class="eyebrow">' + esc(s.sub) + '</p><h1>' + esc(s.title) + '</h1><p class="who">' + esc(s.who) + ' <b dir="ltr">' + esc(me.email) + '</b> · ' + esc(me.role) + '</p></div><div class="rowc">' + (canEdit() ? '<button class="btn btn-s btn-sm" id="publish" title="' + esc(s.publishHint) + '">' + esc(s.publish) + '</button>' : '') + (me.role === 'super_admin' ? '<a class="btn btn-s btn-sm" href="/admin/" title="' + esc(s.editorHint) + '">' + esc(s.editor) + '</a>' : '') + '<button class="btn btn-s btn-sm" id="signout">' + esc(s.signout) + '</button></div></div>' +
      '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<a class="chip" role="tab" href="#' + t + '" aria-selected="' + (t === tab) + '">' + esc(s.tabs[t]) + '</a>'; }).join('') + '</div><div id="flash"></div><div id="view">' + inner + '</div>';
    $('signout').addEventListener('click', async function () { try { await O.api('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ } location.reload(); });
    var pb = $('publish'); if (pb) pb.addEventListener('click', async function () { pb.disabled = true; try { await O.api('/admin/publish', { method: 'POST' }); flash(esc(s.published)); } catch (e) { flash(esc(errText(e)), 'bad'); } pb.disabled = false; });
  }
  var view = function () { return $('view'); };

  /* ── overview ─────────────────────────────────────────────────── */
  async function showOverview() {
    overview = await O.api('/admin/overview');
    var rows = overview.events.map(function (e) {
      var c = e.counts;
      return '<tr><td><a class="ev-link" href="#event/' + esc(e.id) + '">' + esc(L(e.title)) + '</a><div class="ln">' + esc(e.id) + ' · ' + esc(L(e.venue)) + (e.published ? '' : ' · hidden') + '</div></td><td class="nowrap">' + esc(O.fmtShort(e.startUtc)) + '<div class="ln">' + esc(O.fmtRange(e.startUtc, e.endUtc)) + '</div></td>' +
        '<td><span class="badge ' + esc(e.eventStatus) + '">' + esc(s.st[e.eventStatus] || e.eventStatus) + '</span></td><td>' + esc(s.mode[e.registrationMode]) + '<div class="ln">' + esc(s.state[e.state] || e.state) + '</div></td><td class="num">' + (e.capacity == null ? esc(s.unlimited) : O.num(c.seated) + ' / ' + O.num(e.capacity)) + '</td>' +
        '<td class="num">' + O.num(c.interested) + '</td><td class="num">' + O.num(c.confirmed + c.checked_in) + '</td><td class="num">' + O.num(c.waitlisted + c.offered) + '</td><td class="num">' + O.num(c.checked_in) + '</td>' +
        '<td><div class="rowc" style="justify-content:flex-end">' + (canEdit() ? '<a class="btn btn-s btn-sm" href="#event/' + esc(e.id) + '">' + esc(s.manage) + '</a>' : '') + '<a class="btn btn-s btn-sm" href="#roster/' + esc(e.id) + '">' + esc(s.roster) + '</a><a class="btn btn-s btn-sm" href="#checkin/' + esc(e.id) + '">' + esc(s.checkin) + '</a></div></td></tr>';
    }).join('');
    var tot = overview.events.reduce(function (a, e) { a.i += e.counts.interested; a.c += e.counts.confirmed + e.counts.checked_in; a.w += e.counts.waitlisted + e.counts.offered; return a; }, { i: 0, c: 0, w: 0 });
    var mailBad = (overview.mail.failed || 0) + (overview.mail.dead || 0);
    shell('overview', '<div class="kpis"><div class="kpi"><b>' + O.num(overview.events.length) + '</b><span>' + esc(s.tabs.overview) + '</span></div><div class="kpi"><b>' + O.num(tot.i) + '</b><span>' + esc(s.counts.interested) + '</span></div><div class="kpi"><b>' + O.num(tot.c) + '</b><span>' + esc(s.counts.confirmed) + '</span></div><div class="kpi"><b>' + O.num(tot.w) + '</b><span>' + esc(s.counts.waitlisted) + '</span></div>' + (canEdit() ? '<div class="kpi"><b>' + O.num(overview.mail.queued || 0) + (mailBad ? ' <small style="color:#f8d2d2;font-size:14px">+' + O.num(mailBad) + '</small>' : '') + '</b><span>' + esc(s.tabs.mail) + '</span></div>' : '') + '</div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + esc(s.th.event) + '</th><th>' + esc(s.th.when) + '</th><th>' + esc(s.th.status) + '</th><th>' + esc(s.th.mode) + '</th><th class="num">' + esc(s.th.cap) + '</th><th class="num">' + esc(s.th.interested) + '</th><th class="num">' + esc(s.th.confirmed) + '</th><th class="num">' + esc(s.th.waitlist) + '</th><th class="num">' + esc(s.th.checkedIn) + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>');
  }

  /* ── event settings ───────────────────────────────────────────── */
  async function showEvent(id) {
    var d = await O.api('/admin/events/' + id), e = d.event, c = e.counts;
    var opt = function (obj, cur) { return Object.keys(obj).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(obj[k]) + '</option>'; }).join(''); };
    var venueOpts = '<option value="">—</option>' + e.venues.map(function (v) { return '<option value="' + esc(v.key) + '"' + (v.key === e.venueKey ? ' selected' : '') + '>' + esc(L(v.name)) + '</option>'; }).join('');
    shell('overview', '<p><a class="lnk" href="#overview">' + esc(s.back) + '</a></p><div class="app-head"><div><p class="eyebrow">' + esc(s.edit) + '</p><h1 style="font-size:30px">' + esc(L(e.title)) + '</h1><p class="who">' + esc(e.id) + ' · <span class="badge ' + esc(e.eventStatus) + '">' + esc(s.st[e.eventStatus]) + '</span> · ' + esc(s.state[e.state]) + ' · v' + O.num(e.version) + '</p></div><div class="rowc"><a class="btn btn-s btn-sm" href="#roster/' + esc(e.id) + '">' + esc(s.roster) + '</a><a class="btn btn-s btn-sm" href="#checkin/' + esc(e.id) + '">' + esc(s.checkin) + '</a><a class="btn btn-s btn-sm" href="#comms/' + esc(e.id) + '">' + esc(s.comms) + '</a><a class="btn btn-s btn-sm" href="' + base + '/events/' + esc(e.slug) + '/" target="_blank" rel="noopener">↗</a></div></div>' +
      '<div class="kpis">' + ['interested', 'confirmed', 'waitlisted', 'offered', 'checked_in', 'cancelled'].map(function (k) { return '<div class="kpi"><b>' + O.num(c[k]) + '</b><span>' + esc(s.counts[k]) + '</span></div>'; }).join('') + '</div>' +
      '<form id="ef" class="grid2" novalidate><div class="pane"><p class="muted" style="margin:0 0 14px;font-size:14px">' + esc(s.editP) + '</p>' +
      '<div class="f"><label class="lbl" for="f-status">' + esc(s.f.status) + '</label><select id="f-status">' + opt(s.st, e.eventStatus) + '</select></div>' +
      '<div class="f"><label class="lbl" for="f-mode">' + esc(s.f.mode) + '</label><select id="f-mode">' + opt(s.mode, e.registrationMode) + '</select></div>' +
      '<div class="f"><label class="lbl" for="f-aud">' + esc(s.f.audience) + '</label><select id="f-aud"><option value="public"' + (e.audience === 'public' ? ' selected' : '') + '>' + esc(s.f.public) + '</option><option value="members"' + (e.audience === 'members' ? ' selected' : '') + '>' + esc(s.f.members) + '</option></select></div>' +
      '<div class="f"><label class="lbl" for="f-price">' + esc(s.f.price) + '</label><select id="f-price"><option value="free"' + (e.priceStatus === 'free' ? ' selected' : '') + '>' + esc(s.f.free) + '</option><option value="tbd"' + (e.priceStatus === 'tbd' ? ' selected' : '') + '>' + esc(s.f.tbd) + '</option></select></div>' +
      '<div class="f"><label class="lbl" for="f-cap">' + esc(s.f.capacity) + '</label><input id="f-cap" type="text" inputmode="numeric" value="' + (e.capacity == null ? '' : e.capacity) + '"></div>' +
      '<div class="f"><label class="chk-l"><input type="checkbox" id="f-wl"' + (e.waitlistEnabled ? ' checked' : '') + '><span>' + esc(s.f.waitlist) + '</span></label></div>' +
      '<div class="f"><label class="chk-l"><input type="checkbox" id="f-pub"' + (e.published !== false ? ' checked' : '') + '><span>' + esc(s.f.publishedF) + '</span></label></div></div>' +
      '<div class="pane"><div class="f"><label class="lbl" for="f-start">' + esc(s.f.start) + '</label><input id="f-start" type="datetime-local" value="' + esc(e.startLocal) + '"></div><div class="f"><label class="lbl" for="f-end">' + esc(s.f.end) + '</label><input id="f-end" type="datetime-local" value="' + esc(e.endLocal) + '"></div>' +
      '<div class="f"><label class="lbl" for="f-venue">' + esc(s.f.venue) + '</label><select id="f-venue">' + venueOpts + '</select></div>' +
      '<div class="f"><label class="lbl" for="f-opens">' + esc(s.f.opens) + '</label><input id="f-opens" type="datetime-local" value="' + esc(O.toLocalInput(e.bookingOpensAt)) + '"></div><div class="f"><label class="lbl" for="f-closes">' + esc(s.f.closes) + '</label><input id="f-closes" type="datetime-local" value="' + esc(O.toLocalInput(e.bookingClosesAt)) + '"></div>' +
      '<div class="f"><label class="lbl" for="f-reason">' + esc(s.f.reason) + '</label><input id="f-reason" type="text" maxlength="300"></div>' +
      '<div class="form-foot"><button class="btn btn-p" type="submit" id="f-save">' + esc(s.f.save) + '</button></div></div></form>');
    if (!canEdit()) view().querySelectorAll('input,select,button').forEach(function (x) { x.disabled = true; });
    var dl = function (v) { return v ? new Date(v + ':00' + offsetSuffix(v)).toISOString() : null; };
    function offsetSuffix(local) { // datetime-local in Oxford time → ISO with the right offset
      var guess = new Date(local + ':00Z'); var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/London', timeZoneName: 'longOffset' }).formatToParts(guess).forEach(function (x) { p[x.type] = x.value; }); var m = /GMT([+-]\d{2}:\d{2})?/.exec(p.timeZoneName || 'GMT'); return m && m[1] ? m[1] : '+00:00';
    }
    $('ef').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var body = { eventStatus: $('f-status').value, registrationMode: $('f-mode').value, audience: $('f-aud').value, priceStatus: $('f-price').value, capacity: $('f-cap').value.trim() === '' ? null : Number($('f-cap').value), waitlistEnabled: $('f-wl').checked, published: $('f-pub').checked, venueKey: $('f-venue').value, reason: $('f-reason').value.trim() };
      if ($('f-start').value !== e.startLocal || $('f-end').value !== e.endLocal) { body.startLocal = $('f-start').value; body.endLocal = $('f-end').value; }
      body.bookingOpensAt = dl($('f-opens').value); body.bookingClosesAt = dl($('f-closes').value);
      await save(body);
    });
    async function save(body) {
      $('f-save').disabled = true;
      try {
        var r = await O.api('/admin/events/' + id, { method: 'PATCH', body: body });
        if (r.preview) {
          var ok = await O.confirm(s.previewH, s.previewP.replace('{n}', O.num(r.affected)).replace('{v}', O.num(r.versionAfter)) + (r.changes.length ? '\n' + r.changes.map(function (x) { return x[lang]; }).join('\n') : ''), s.confirmSend);
          if (ok) return save(Object.assign({}, body, { confirm: true }));
          $('f-save').disabled = false; return;
        }
        await showEvent(id); flash(esc(s.f.saved) + (r.notified ? ' (' + O.num(r.notified) + ')' : ''));
      } catch (e2) { flash(esc(errText(e2)), 'bad'); $('f-save').disabled = false; }
    }
  }

  /* ── roster ───────────────────────────────────────────────────── */
  async function showRoster(id, params) {
    params = params || { page: 1, q: '', status: '' };
    var qs = '?page=' + params.page + (params.q ? '&q=' + encodeURIComponent(params.q) : '') + (params.status ? '&status=' + params.status : '');
    var d = await O.api('/admin/events/' + id + '/registrations' + qs);
    var pages = Math.max(1, Math.ceil(d.total / d.per));
    var rows = d.registrations.map(function (r) {
      var acts = canEdit() && ['interested', 'confirmed', 'waitlisted', 'offered'].indexOf(r.status) !== -1 ? '<button class="btn btn-s btn-sm btn-danger" data-cancel="' + esc(r.id) + '">' + esc(s.cancelReg) + '</button>' : '';
      if (canEdit() && r.status === 'confirmed') acts += ' <button class="btn btn-s btn-sm" data-resend="' + esc(r.id) + '">' + esc(s.resend) + '</button>';
      return '<tr><td>' + esc(r.name) + (r.requirements ? '<div class="ln">' + esc(r.requirements) + '</div>' : '') + '</td><td dir="ltr">' + esc(r.email) + '</td><td><span class="badge ' + esc(r.status) + '">' + esc(s.rst[r.status] || r.status) + '</span>' + (r.status === 'offered' && r.claim_expires_at ? '<div class="ln">' + esc(O.fmtStamp(r.claim_expires_at)) + '</div>' : '') + '</td><td>' + esc(s.kind[r.kind]) + '</td><td>' + esc(O.fmtStamp(r.created_at)) + '</td><td>' + (r.member_at_booking ? '✓' : '') + '</td><td>' + (r.marketing_opt_in ? '✓' : '') + '</td><td><div class="rowc" style="justify-content:flex-end">' + acts + '</div></td></tr>';
    }).join('');
    shell('overview', '<p><a class="lnk" href="#overview">' + esc(s.back) + '</a></p><div class="app-head"><div><p class="eyebrow">' + esc(s.rosterH) + '</p><h1 style="font-size:30px">' + esc(L(d.event.title)) + '</h1><p class="who">' + O.num(d.total) + '</p></div><div class="rowc">' + (canEdit() ? '<a class="btn btn-s btn-sm" href="/api/admin/events/' + esc(id) + '/registrations.csv">' + esc(s.csv) + '</a><a class="btn btn-s btn-sm" href="#event/' + esc(id) + '">' + esc(s.manage) + '</a>' : '') + '<a class="btn btn-s btn-sm" href="#checkin/' + esc(id) + '">' + esc(s.checkin) + '</a></div></div>' +
      '<form id="rf" class="rowc" style="margin-bottom:14px"><div class="f"><input id="r-q" type="text" placeholder="' + esc(s.search) + '" value="' + esc(params.q) + '"></div><div class="f" style="flex:0 1 200px"><select id="r-st"><option value="">' + esc(s.all) + '</option>' + Object.keys(s.rst).map(function (k) { return '<option value="' + k + '"' + (params.status === k ? ' selected' : '') + '>' + esc(s.rst[k]) + '</option>'; }).join('') + '</select></div><button class="btn btn-s btn-sm" type="submit">' + esc(s.find) + '</button></form>' +
      (d.registrations.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + esc(s.rth.name) + '</th><th>' + esc(s.rth.email) + '</th><th>' + esc(s.rth.status) + '</th><th>' + esc(s.rth.kind) + '</th><th>' + esc(s.rth.registered) + '</th><th>' + esc(s.rth.member) + '</th><th>' + esc(s.rth.news) + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="dir-empty">' + esc(s.none) + '</p>') +
      '<div class="pager"><span>' + esc(s.page.replace('{p}', O.num(d.page)).replace('{n}', O.num(pages))) + '</span>' + (d.page > 1 ? '<button class="btn btn-s btn-sm" id="pg-prev">' + esc(s.prev) + '</button>' : '') + (d.page < pages ? '<button class="btn btn-s btn-sm" id="pg-next">' + esc(s.next) + '</button>' : '') + '</div>');
    $('rf').addEventListener('submit', function (e) { e.preventDefault(); showRoster(id, { page: 1, q: $('r-q').value.trim(), status: $('r-st').value }); });
    if ($('pg-prev')) $('pg-prev').addEventListener('click', function () { showRoster(id, Object.assign({}, params, { page: params.page - 1 })); });
    if ($('pg-next')) $('pg-next').addEventListener('click', function () { showRoster(id, Object.assign({}, params, { page: params.page + 1 })); });
    view().querySelectorAll('[data-cancel]').forEach(function (b) { b.addEventListener('click', async function () { if (!(await O.confirm(s.cancelQ, s.cancelT, s.yes))) return; var reason = window.prompt(s.reasonPrompt, '') || ''; b.disabled = true; try { await O.api('/admin/registrations/' + b.getAttribute('data-cancel') + '/cancel', { method: 'POST', body: { reason: reason } }); await showRoster(id, params); flash(esc(s.done)); } catch (e) { flash(esc(errText(e)), 'bad'); b.disabled = false; } }); });
    view().querySelectorAll('[data-resend]').forEach(function (b) { b.addEventListener('click', async function () { b.disabled = true; try { await O.api('/admin/registrations/' + b.getAttribute('data-resend') + '/resend-ticket', { method: 'POST' }); flash(esc(s.done)); } catch (e) { flash(esc(errText(e)), 'bad'); } b.disabled = false; }); });
  }

  /* ── check-in ─────────────────────────────────────────────────── */
  var stream = null, scanTimer = null;
  function stopCam() { if (scanTimer) { clearInterval(scanTimer); scanTimer = null; } if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } var b = $('cam-btn'); if (b) b.textContent = s.startCam; }
  async function showCheckin(id) {
    stopCam();
    if (!overview) overview = await O.api('/admin/overview');
    var evs = overview.events;
    var sel = '<div class="f" style="max-width:520px"><label class="lbl" for="ci-ev">' + esc(s.th.event) + '</label><select id="ci-ev"><option value="">' + esc(s.chooseEvent) + '</option>' + evs.map(function (e) { return '<option value="' + esc(e.id) + '"' + (e.id === id ? ' selected' : '') + '>' + esc(L(e.title)) + ' — ' + esc(O.fmtShort(e.startUtc)) + '</option>'; }).join('') + '</select></div>';
    var ev = evs.find(function (e) { return e.id === id; });
    var tally = ev ? '<p class="who" id="tally">' + esc(s.tally.replace('{a}', O.num(ev.counts.checked_in)).replace('{c}', O.num(ev.counts.confirmed + ev.counts.checked_in))) + '</p>' : '';
    shell('checkin', '<div class="app-head"><div><p class="eyebrow">' + esc(s.tabs.checkin) + '</p><h1 style="font-size:30px">' + esc(s.scanH) + '</h1>' + tally + '</div></div>' + sel + (ev ? '<p class="muted" style="font-size:14px">' + esc(s.scanP) + '</p><div class="scan"><div><video id="cam" playsinline muted hidden></video><div class="rowc" style="margin-top:10px"><button class="btn btn-s btn-sm" id="cam-btn" type="button">' + esc(s.startCam) + '</button><span class="ln" id="cam-note"></span></div>' +
      '<form id="code-f" class="rowc" style="margin-top:14px"><div class="f"><label class="lbl" for="ci-code">' + esc(s.codeF) + '</label><input id="ci-code" type="text" autocomplete="off" dir="ltr"></div><button class="btn btn-p btn-sm" type="submit" style="align-self:flex-end">' + esc(s.admit) + '</button></form>' +
      '<form id="name-f" class="rowc" style="margin-top:14px"><div class="f"><label class="lbl" for="ci-name">' + esc(s.nameF) + '</label><input id="ci-name" type="text" autocomplete="off"></div><button class="btn btn-s btn-sm" type="submit" style="align-self:flex-end">' + esc(s.find) + '</button></form><ul class="results" id="ci-results"></ul></div>' +
      '<div class="scan-result" id="ci-res" aria-live="assertive"><span class="ln">' + esc(s.ready) + '</span></div></div>' : ''));
    $('ci-ev').addEventListener('change', function () { location.hash = '#checkin/' + $('ci-ev').value; });
    if (!ev) return;
    async function admit(body) {
      try {
        var r = await O.api('/admin/events/' + id + '/check-in', { method: 'POST', body: body });
        var cls = r.result === 'admitted' ? 'admitted' : r.result === 'duplicate' ? 'duplicate' : 'bad';
        $('ci-res').className = 'scan-result ' + cls;
        $('ci-res').innerHTML = '<b>' + esc(s.res[r.result] || r.result) + '</b>' + (r.name ? '<span class="nm">' + esc(r.name) + '</span>' : '') + (r.checkedInAt ? '<span class="ln">' + esc(s.at.replace('{t}', O.fmtStamp(r.checkedInAt))) + '</span>' : '');
        if (r.result === 'admitted') { ev.counts.checked_in++; if (ev.counts.confirmed > 0) ev.counts.confirmed--; var t = $('tally'); if (t) t.textContent = s.tally.replace('{a}', O.num(ev.counts.checked_in)).replace('{c}', O.num(ev.counts.confirmed + ev.counts.checked_in)); if (navigator.vibrate) navigator.vibrate(80); }
        return r;
      } catch (e) { $('ci-res').className = 'scan-result bad'; $('ci-res').innerHTML = '<b>' + esc(errText(e)) + '</b>'; }
    }
    $('code-f').addEventListener('submit', function (e) { e.preventDefault(); var v = $('ci-code').value.trim(); if (!v) return; var m = /\/t\/([A-Za-z0-9_-]+)/.exec(v); admit({ token: m ? m[1] : v }); $('ci-code').value = ''; });
    $('name-f').addEventListener('submit', async function (e) {
      e.preventDefault(); var q = $('ci-name').value.trim(); if (q.length < 3) return;
      try { var r = await O.api('/admin/events/' + id + '/check-in?q=' + encodeURIComponent(q)); $('ci-results').innerHTML = r.results.map(function (x) { return '<li><span>' + esc(x.name) + ' <span class="ln" dir="ltr">' + esc(x.email) + '</span> <span class="badge ' + esc(x.status) + '">' + esc(s.rst[x.status]) + '</span></span>' + (x.status === 'confirmed' ? '<button class="btn btn-p btn-sm" data-admit="' + esc(x.id) + '">' + esc(s.manualAdmit) + '</button>' : '') + '</li>'; }).join('') || '<li>' + esc(s.none) + '</li>';
        $('ci-results').querySelectorAll('[data-admit]').forEach(function (b) { b.addEventListener('click', function () { admit({ registrationId: b.getAttribute('data-admit'), manual: true }); b.disabled = true; }); });
      } catch (e2) { flash(esc(errText(e2)), 'bad'); }
    });
    var last = '', lastAt = 0;
    $('cam-btn').addEventListener('click', async function () {
      if (stream) { stopCam(); $('cam').hidden = true; return; }
      if (!('BarcodeDetector' in window) || !navigator.mediaDevices) { $('cam-note').textContent = s.noCam; return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        var video = $('cam'); video.srcObject = stream; video.hidden = false; await video.play(); $('cam-btn').textContent = s.stopCam;
        var det = new window.BarcodeDetector({ formats: ['qr_code'] });
        scanTimer = setInterval(async function () {
          try { var codes = await det.detect(video); if (!codes.length) return; var raw = codes[0].rawValue || ''; var m = /(?:OSS1:|\/t\/)([A-Za-z0-9_-]{20,})/.exec(raw); var tok = m ? m[1] : raw; if (tok === last && Date.now() - lastAt < 4000) return; last = tok; lastAt = Date.now(); admit({ token: tok }); } catch (e) { /* frame not ready */ }
        }, 400);
      } catch (e) { $('cam-note').textContent = s.noCam; stopCam(); }
    });
  }

  /* ── communications ───────────────────────────────────────────── */
  async function showComms(id) {
    var d = await O.api('/admin/events/' + id);
    shell('overview', '<p><a class="lnk" href="#event/' + esc(id) + '">' + esc(s.back) + '</a></p><div class="app-head"><div><p class="eyebrow">' + esc(s.commsH) + '</p><h1 style="font-size:30px">' + esc(L(d.event.title)) + '</h1></div></div><p class="muted" style="font-size:14px;max-width:70ch">' + esc(s.commsP) + '</p>' +
      '<form id="cf" class="grid2"><div class="pane"><div class="f"><label class="lbl" for="c-to">' + esc(s.to) + '</label><select id="c-to">' + Object.keys(s.seg).map(function (k) { return '<option value="' + k + '">' + esc(s.seg[k]) + '</option>'; }).join('') + '</select></div><div class="f"><label class="lbl" for="c-sen">' + esc(s.subject) + ' (EN)</label><input id="c-sen" type="text" maxlength="150" required></div><div class="f"><label class="lbl" for="c-ben">' + esc(s.body) + ' (EN)</label><textarea id="c-ben" required></textarea></div></div>' +
      '<div class="pane"><div class="f"><label class="lbl" for="c-sar">' + esc(s.subject) + ' (AR)</label><input id="c-sar" type="text" dir="rtl" maxlength="150"></div><div class="f"><label class="lbl" for="c-bar">' + esc(s.body) + ' (AR)</label><textarea id="c-bar" dir="rtl"></textarea></div><div class="form-foot"><button class="btn btn-p" type="submit" id="c-prev">' + esc(s.preview) + '</button></div></div></form><div id="c-out" style="margin-top:16px"></div>');
    $('cf').addEventListener('submit', async function (e) {
      e.preventDefault();
      var body = { to: $('c-to').value, subject: { en: $('c-sen').value.trim(), ar: $('c-sar').value.trim() }, body: { en: $('c-ben').value.trim(), ar: $('c-bar').value.trim() } };
      if (!body.subject.en || !body.body.en) return;
      try {
        var p = await O.api('/admin/events/' + id + '/notify', { method: 'POST', body: body });
        $('c-out').innerHTML = '<div class="pane"><h3>' + esc(s.preview) + ' — ' + O.num(p.affected) + ' (EN ' + O.num(p.byLang.en) + ' · AR ' + O.num(p.byLang.ar) + ')</h3><div class="grid2"><div class="preview" dir="ltr"><b>' + esc(p.sample.en.subject) + '</b>\n\n' + esc(p.sample.en.body) + '</div><div class="preview" dir="rtl"><b>' + esc(p.sample.ar.subject) + '</b>\n\n' + esc(p.sample.ar.body) + '</div></div><div class="form-foot"><button class="btn btn-p" id="c-send"' + (p.affected ? '' : ' disabled') + '>' + esc(s.sendN.replace('{n}', O.num(p.affected))) + '</button></div></div>';
        $('c-send').addEventListener('click', async function () { $('c-send').disabled = true; try { var r = await O.api('/admin/events/' + id + '/notify', { method: 'POST', body: Object.assign({ confirm: true }, body) }); $('c-out').innerHTML = ''; flash(esc(s.queued.replace('{n}', O.num(r.queued)))); } catch (e2) { flash(esc(errText(e2)), 'bad'); } });
      } catch (e3) { flash(esc(errText(e3)), 'bad'); }
    });
  }

  /* ── mail queue ───────────────────────────────────────────────── */
  async function showMail(status) {
    var d = await O.api('/admin/mail' + (status ? '?status=' + status : ''));
    var rows = d.mail.map(function (m) { return '<tr><td>' + esc(O.fmtStamp(m.created_at)) + '</td><td>' + esc(m.kind) + '</td><td dir="ltr">' + esc(m.to_email) + '</td><td>' + esc(m.subject) + '</td><td><span class="badge ' + (m.status === 'sent' ? 'confirmed' : m.status === 'queued' || m.status === 'sending' ? 'waitlisted' : 'cancelled') + '">' + esc(m.status) + '</span></td><td class="num">' + O.num(m.attempts) + '</td><td class="ln">' + esc(m.last_error || '') + '</td><td>' + (m.status === 'failed' || m.status === 'dead' ? '<button class="btn btn-s btn-sm" data-retry="' + esc(m.id) + '">' + esc(s.retry) + '</button>' : '') + '</td></tr>'; }).join('');
    shell('mail', '<div class="app-head"><div><p class="eyebrow">' + esc(s.tabs.mail) + '</p><h1 style="font-size:30px">' + esc(s.mailH) + '</h1></div><div class="rowc"><select id="m-st" class="chip" style="font:inherit;font-size:13.5px;padding:10px 14px;border:0;color:var(--ink)"><option value="">' + esc(s.filter) + '</option>' + ['queued', 'sent', 'failed', 'dead'].map(function (k) { return '<option value="' + k + '"' + (status === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select><button class="btn btn-s btn-sm" id="m-proc">' + esc(s.process) + '</button></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + esc(s.mth.when) + '</th><th>' + esc(s.mth.kind) + '</th><th>' + esc(s.mth.to) + '</th><th>' + esc(s.mth.subject) + '</th><th>' + esc(s.mth.status) + '</th><th class="num">' + esc(s.mth.attempts) + '</th><th>' + esc(s.mth.error) + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>');
    $('m-st').addEventListener('change', function () { showMail($('m-st').value); });
    $('m-proc').addEventListener('click', async function () { $('m-proc').disabled = true; try { var r = await O.api('/admin/mail/process', { method: 'POST' }); await showMail(status); flash(esc(s.processed.replace('{s}', O.num(r.sent)).replace('{f}', O.num(r.failed + r.dead)))); } catch (e) { flash(esc(errText(e)), 'bad'); } });
    view().querySelectorAll('[data-retry]').forEach(function (b) { b.addEventListener('click', async function () { b.disabled = true; try { await O.api('/admin/mail/' + b.getAttribute('data-retry') + '/retry', { method: 'POST' }); await showMail(status); } catch (e) { flash(esc(errText(e)), 'bad'); } }); });
  }

  /* ── members ──────────────────────────────────────────────────── */
  async function showMembers(q) {
    var d = await O.api('/admin/members' + (q ? '?q=' + encodeURIComponent(q) : ''));
    var rows = d.members.map(function (m) { return '<tr><td dir="ltr">' + esc(m.email) + '</td><td>' + esc(m.name || '') + '</td><td><span class="badge ' + (m.status === 'approved' ? 'confirmed' : m.status === 'pending' ? 'waitlisted' : 'cancelled') + '">' + esc(s.mst[m.status] || m.status) + '</span></td><td>' + esc(m.tier || '') + '</td><td>' + (m.valid_until ? esc(String(m.valid_until).slice(0, 10)) : '') + '</td><td class="ln">' + esc(m.approved_by || '') + '</td></tr>'; }).join('');
    shell('membership', '<p><a class="lnk" href="#membership">' + esc(MS.d.back) + '</a></p><div class="app-head"><div><p class="eyebrow">' + esc(s.tabs.members) + '</p><h1 style="font-size:30px">' + esc(s.membersH) + '</h1><p class="who">' + Object.keys(d.totals).map(function (k) { return esc(s.mst[k] || k) + ' ' + O.num(d.totals[k]); }).join(' · ') + '</p></div></div><p class="muted" style="font-size:14px;max-width:70ch">' + esc(s.membersP) + '</p>' +
      '<div class="grid2" style="margin-bottom:18px"><form id="mf" class="pane"><h3>' + esc(s.addH) + '</h3><div class="f"><label class="lbl" for="m-email">' + esc(s.email) + '</label><input id="m-email" type="email" required dir="ltr"></div><div class="f"><label class="lbl" for="m-name">' + esc(s.name) + '</label><input id="m-name" type="text"></div><div class="rowc"><div class="f"><label class="lbl" for="m-tier">' + esc(s.tier) + '</label><select id="m-tier"><option value="saudi">Saudi Oxford community</option><option value="student">Oxford student</option><option value="external">Other university student</option><option value="associate">Associate</option><option value="honorary">Honorary</option></select></div><div class="f"><label class="lbl" for="m-status">' + esc(s.mstatus) + '</label><select id="m-status">' + Object.keys(s.mst).map(function (k) { return '<option value="' + k + '">' + esc(s.mst[k]) + '</option>'; }).join('') + '</select></div></div><div class="f"><label class="lbl" for="m-until">' + esc(s.validUntil) + '</label><input id="m-until" type="date"></div><div class="form-foot"><button class="btn btn-p" type="submit">' + esc(s.add) + '</button></div></form>' +
      '<form id="bf" class="pane"><h3>' + esc(s.bulkH) + '</h3><p class="muted" style="font-size:13.5px;margin:0 0 10px">' + esc(s.bulkP) + '</p><div class="f"><textarea id="b-rows" dir="ltr" placeholder="name@ox.ac.uk, Full Name"></textarea></div><div class="form-foot"><button class="btn btn-s" type="submit">' + esc(s.bulkBtn) + '</button></div></form></div>' +
      '<form id="msf" class="rowc" style="margin-bottom:12px"><div class="f"><input id="ms-q" type="text" placeholder="' + esc(s.search) + '" value="' + esc(q || '') + '"></div><button class="btn btn-s btn-sm" type="submit">' + esc(s.find) + '</button></form>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + esc(s.mth2.email) + '</th><th>' + esc(s.mth2.name) + '</th><th>' + esc(s.mth2.status) + '</th><th>' + esc(s.mth2.tier) + '</th><th>' + esc(s.mth2.until) + '</th><th>' + esc(s.mth2.by) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
    $('mf').addEventListener('submit', async function (e) { e.preventDefault(); try { await O.api('/admin/members', { method: 'POST', body: { email: $('m-email').value, name: $('m-name').value, tier: $('m-tier').value, status: $('m-status').value, validUntil: $('m-until').value || null } }); await showMembers(q); flash(esc(s.done)); } catch (e2) { flash(esc(errText(e2)), 'bad'); } });
    $('bf').addEventListener('submit', async function (e) { e.preventDefault(); var rowsIn = $('b-rows').value.split(/\n+/).map(function (l) { var p = l.split(/[,;\t]/); return { email: (p[0] || '').trim(), name: (p[1] || '').trim(), status: 'approved' }; }).filter(function (r) { return r.email; }); if (!rowsIn.length) return; try { var r = await O.api('/admin/members', { method: 'POST', body: { rows: rowsIn } }); await showMembers(q); flash(esc(s.imported.replace('{n}', O.num(r.count)))); } catch (e2) { flash(esc(errText(e2)), 'bad'); } });
    $('msf').addEventListener('submit', function (e) { e.preventDefault(); showMembers($('ms-q').value.trim()); });
  }

  /* ── membership: queue, register, decisions ───────────────────── */
  var MS = {
    en: { h: 'Membership applications', hAll: 'Membership register', p: 'Applications are reviewed in order. Approving gives the person an active membership (members-only events open to them) and emails them; every decision is logged.',
      views: { queue: 'Review queue', approved: 'Active members', info_requested: 'Waiting for applicant', declined: 'Declined', revoked: 'Ended', all: 'Everyone' },
      th: { pos: '#', no: 'Membership no.', name: 'Name', type: 'Type', college: 'Institution / status', applied: 'Applied', email: 'Email', pay: 'Payment', nat: 'Nationality', status: 'Status' },
      st: { pending: 'Pending', info_requested: 'Question sent', approved: 'Active', declined: 'Declined', revoked: 'Ended', expired: 'Expired' },
      pay: { not_required: '—', due: 'Due', received: 'Received', waived: 'Waived', on_hold: 'On hold (eligibility check)' }, nat: { not_required: '—', pending: 'To confirm', submitted: 'Document to check', verified: 'Confirmed', rejected: 'Not accepted' },
      verified: 'verified', unverified: 'not verified yet', empty: 'Nothing here.', search: 'Search name, email or number', add: 'Add members manually',
      d: { back: '← Membership', email: 'Email', phone: 'Mobile', college: 'College / department', uni: 'University status', vol: 'Volunteering', heard: 'Heard about us', news: 'Event news by email', privacy: 'Privacy notice accepted', applied: 'Applied', verifiedAt: 'Email verified', decided: 'Decided', by: 'by', queue: 'Place in queue', valid: 'Valid until', yes: 'yes', no: 'no',
        qSent: 'Question sent', answer: 'Applicant’s answer', checks: 'Checks', payment: 'Payment', nationality: 'Saudi nationality', notes: 'Internal notes (not shown to the applicant)', save: 'Save checks & notes', saved: 'Saved.',
        evH: 'Proof of nationality', evNone: 'No document has been uploaded yet. The applicant uploads it from their membership page; it is never sent by email.', evHeld: 'Uploaded {when} · {type} · {size}', evSeen: 'Last opened {when} by {who}', evOpen: 'Open the document', evOk: 'Verified — delete the document', evNo: 'Not accepted — delete it and ask again', evP: 'Open it, check it, then record the result. The document is deleted the moment a result is recorded, and only the result is kept. Do not download, screenshot or forward it.', evNoQ: 'Record “not accepted”?', evNoT: 'The document is deleted and the applicant is emailed to upload a different one.', evDone: 'Result recorded and the document deleted.',
        actions: 'Decision', approve: 'Approve membership', approveP: 'Membership becomes active immediately and the applicant is emailed their confirmation. A fee-paying membership can be approved only once its payment is marked received (or waived); a free one only once eligibility is confirmed.', validUntil: 'Valid until (optional)',
        ask: 'Request more information', askP: 'The applicant is emailed this message and can answer from their account. Their place in the queue is kept.', templates: 'Templates', tNat: 'Proof of nationality', tPay: 'Payment', tUni: 'Status details',
        decline: 'Decline', declineP: 'The applicant is told by email. They can apply again later and keep the same number.', revoke: 'End membership', revokeP: 'Members-only access stops immediately; the member is told by email.', reinstate: 'Reinstate membership',
        reason: 'Reason (included in the email)', message: 'Message to the applicant', notify: 'Email the applicant', history: 'History', warnPay: 'The fee is not marked as received.', warnNat: 'By approving, you confirm that the committee has checked this person’s Saudi nationality and Oxford connection.', confirmElig: 'Confirm eligibility and approve?', warnEmail: 'The applicant has not confirmed their email address yet.', confirmApprove: 'Approve anyway?' },
      done: { approve: 'Approved — the member has been emailed.', 'request-info': 'Question sent.', decline: 'Application declined.', revoke: 'Membership ended.' } },
    ar: { h: 'طلبات العضوية', hAll: 'سجل الأعضاء', p: 'تُراجع الطلبات بحسب ترتيبها. الموافقة تفعّل العضوية (وتفتح فعاليات الأعضاء) وتُرسل بريدًا للعضو، وتُسجَّل كل الإجراءات.',
      views: { queue: 'قائمة المراجعة', approved: 'الأعضاء الفعّالون', info_requested: 'بانتظار ردّ المتقدم', declined: 'المرفوضون', revoked: 'المنتهية عضويتهم', all: 'الجميع' },
      th: { pos: '#', no: 'رقم العضوية', name: 'الاسم', type: 'النوع', college: 'الجهة / الصفة', applied: 'تاريخ الطلب', email: 'البريد', pay: 'الدفع', nat: 'الجنسية', status: 'الحالة' },
      st: { pending: 'قيد المراجعة', info_requested: 'أُرسل سؤال', approved: 'فعّال', declined: 'مرفوض', revoked: 'منتهية', expired: 'منتهية الصلاحية' },
      pay: { not_required: '—', due: 'مستحق', received: 'مستلم', waived: 'معفى', on_hold: 'معلّق (التحقق من الأهلية)' }, nat: { not_required: '—', pending: 'بانتظار التأكيد', submitted: 'مستند بانتظار التحقق', verified: 'تم التأكيد', rejected: 'لم يُقبل' },
      verified: 'مؤكد', unverified: 'لم يُؤكَّد بعد', empty: 'لا يوجد شيء هنا.', search: 'ابحث بالاسم أو البريد أو الرقم', add: 'إضافة أعضاء يدويًا',
      d: { back: '→ العضوية', email: 'البريد', phone: 'الجوال', college: 'الكلية / القسم', uni: 'الصفة الجامعية', vol: 'التطوّع', heard: 'كيف عرف بنا', news: 'أخبار الفعاليات بالبريد', privacy: 'إشعار الخصوصية المقبول', applied: 'تاريخ الطلب', verifiedAt: 'تأكيد البريد', decided: 'تاريخ القرار', by: 'بواسطة', queue: 'الترتيب في القائمة', valid: 'صالحة حتى', yes: 'نعم', no: 'لا',
        qSent: 'السؤال المرسل', answer: 'إجابة المتقدم', checks: 'التحقق', payment: 'الدفع', nationality: 'الجنسية السعودية', notes: 'ملاحظات داخلية (لا تظهر للمتقدم)', save: 'حفظ التحقق والملاحظات', saved: 'تم الحفظ.',
        evH: 'إثبات الجنسية', evNone: 'لم يُرفع أي مستند بعد. يرفعه المتقدم من صفحة عضويته، ولا يُرسل بالبريد الإلكتروني أبدًا.', evHeld: 'رُفع في {when} · {type} · {size}', evSeen: 'آخر اطّلاع {when} بواسطة {who}', evOpen: 'فتح المستند', evOk: 'تم التحقق — احذف المستند', evNo: 'لم يُقبل — احذفه واطلب غيره', evP: 'افتح المستند وتحقق منه ثم سجّل النتيجة. يُحذف المستند لحظة تسجيل النتيجة ولا يُحتفظ إلا بها. لا تنزّله ولا تصوّره ولا تُعد إرساله.', evNoQ: 'تسجيل «لم يُقبل»؟', evNoT: 'يُحذف المستند ويُرسل للمتقدم بريد يطلب رفع مستند آخر.', evDone: 'سُجّلت النتيجة وحُذف المستند.',
        actions: 'القرار', approve: 'الموافقة على العضوية', approveP: 'تُفعّل العضوية فورًا ويُرسل للمتقدم بريد التأكيد. لا تُعتمد العضوية برسوم إلا بعد تسجيل السداد كمستلم (أو معفى)، ولا العضوية المجانية إلا بعد تأكيد الأهلية.', validUntil: 'صالحة حتى (اختياري)',
        ask: 'طلب معلومات إضافية', askP: 'تُرسل هذه الرسالة للمتقدم بالبريد ويمكنه الرد من حسابه، ويحتفظ بترتيبه في القائمة.', templates: 'نماذج', tNat: 'إثبات الجنسية', tPay: 'الدفع', tUni: 'تفاصيل الصفة',
        decline: 'رفض', declineP: 'يُبلَّغ المتقدم بالبريد، ويمكنه التقديم لاحقًا بالرقم نفسه.', revoke: 'إنهاء العضوية', revokeP: 'يتوقف الوصول لفعاليات الأعضاء فورًا ويُبلَّغ العضو بالبريد.', reinstate: 'إعادة تفعيل العضوية',
        reason: 'السبب (يُذكر في البريد)', message: 'الرسالة إلى المتقدم', notify: 'إرسال بريد للمتقدم', history: 'السجل', warnPay: 'لم تُسجَّل الرسوم كمستلمة.', warnNat: 'بالموافقة تؤكد أن اللجنة تحققت من الجنسية السعودية لهذا الشخص ومن صلته بأكسفورد.', confirmElig: 'تأكيد الأهلية والموافقة؟', warnEmail: 'لم يؤكد المتقدم بريده الإلكتروني بعد.', confirmApprove: 'الموافقة على أي حال؟' },
      done: { approve: 'تمت الموافقة وأُرسل بريد للعضو.', 'request-info': 'أُرسل السؤال.', decline: 'رُفض الطلب.', revoke: 'أُنهيت العضوية.' } }
  }[lang];
  /* status and place labels: [English, Arabic] (the same keys as the join form) */
  var DST = { undergraduate: ['Undergraduate student', 'طالب بكالوريوس'], masters: ['Master’s student', 'طالب ماجستير'], doctoral: ['Doctoral student', 'طالب دكتوراه'], visiting_student: ['Visiting student', 'طالب زائر'], alumni: ['Alumnus', 'خريج'], academic_staff: ['Academic staff', 'عضو هيئة تدريس'], researcher: ['Researcher', 'باحث'], visiting_researcher: ['Visiting researcher', 'باحث زائر'],
    clinical_fellow: ['Clinical fellow', 'طبيب زمالة'], resident_doctor: ['Resident doctor', 'طبيب مقيم'], consultant: ['Consultant physician', 'طبيب استشاري'], healthcare: ['Healthcare professional', 'ممارس صحي'], university_employee: ['University employee', 'موظف جامعي'], oxford_professional: ['Oxford-based professional', 'موظف أو صاحب عمل في أكسفورد'], other_connection: ['Other Oxford connection', 'صلة أخرى بأكسفورد'],
    professional: ['Employee or professional', 'موظف أو مهني'], supporter: ['Friend or supporter', 'صديق أو داعم'], other: ['Other', 'أخرى'], brookes: ['Oxford Brookes', 'أكسفورد بروكس'], uk_university: ['Another UK university', 'جامعة أخرى داخل بريطانيا'], global_university: ['University outside the UK', 'جامعة خارج بريطانيا'] };
  var AREA = { events: ['Event organisation', 'تنظيم الفعاليات'], media: ['Media and design', 'الإعلام والتصميم'], photography: ['Photography and media coverage', 'التصوير والتغطية الإعلامية'], partnerships: ['Sponsorships and partnerships', 'الرعايات والشراكات'], welcome: ['Welcoming new students', 'استقبال ودعم الطلبة الجدد'], academic: ['Academic and professional programmes', 'البرامج الأكاديمية والمهنية'], admin: ['Administrative support', 'الدعم الإداري والتنظيمي'] };
  var VPLACE = { oxford: ['In Oxford', 'في أكسفورد'], remote: ['Remotely', 'عن بُعد'], both: ['Both', 'كلاهما'] };
  var L2 = function (en, ar) { return lang === 'ar' ? ar : en; };
  var uniL = function (k) { return DST[k] ? DST[k][lang === 'ar' ? 1 : 0] : (k || ''); };
  var uniR = function (r) { return [r.uni_place ? uniL(r.uni_place) : '', uniL(r.uni_status)].filter(Boolean).join(' · '); };
  var TIERL = { saudi: ['Saudi Oxford community', 'السعوديون في أكسفورد'], student: ['Oxford student', 'طالب في جامعة أكسفورد'], external: ['Other university student', 'طالب جامعة أخرى'], associate: ['Associate', 'منتسب'] };
  var tierL = function (k) { return TIERL[k] ? TIERL[k][lang === 'ar' ? 1 : 0] : (k || ''); };
  var ELIG = { review: ['Awaiting eligibility check', 'بانتظار التحقق من الأهلية'], confirmed: ['Eligibility confirmed', 'تم تأكيد الأهلية'], not_eligible: ['Not eligible for free membership', 'غير مؤهل للعضوية المجانية'] };
  var badgeCls = { pending: 'waitlisted', info_requested: 'offered', approved: 'confirmed', declined: 'cancelled', revoked: 'cancelled', expired: 'cancelled' };
  /* Fee codes: create a code, give it to the person, and their membership fee is waived when they enter it on the join form. */
  var FC = lang === 'ar' ? {
    h: 'رموز الخصم والإعفاء', p: 'أنشئ رمزًا وأعطه لمن تريد تخفيض رسوم عضويته أو إعفاءه منها. عند إدخاله في نموذج الانضمام مع عضوية برسوم يُقبل الرمز وتُخصم نسبته من الرسوم (١٠٠٪ = إعفاء كامل)، أو يُرفض إن لم يكن له سجل فعّال هنا: غير موجود أو موقوف أو منتهٍ أو مستنفد. يبقى الطلب خاضعًا لمراجعة اللجنة كالمعتاد.', pct: 'نسبة الخصم ٪ (١٠٠ = إعفاء كامل)', pctCol: 'الخصم',
    email: 'خصّصه لبريد إلكتروني واحد (اختياري — فلا يستطيع غيره استخدامه)', personal: 'خاص بـ ', newH: 'رمز جديد', label: 'لمن هذا الرمز؟ (ملاحظة داخلية)', max: 'عدد مرات الاستخدام (اتركه فارغًا لعدد غير محدود)', exp: 'ينتهي في (اختياري)', custom: 'رمز من اختيارك (اختياري — يُولَّد تلقائيًا إن تُرك فارغًا)', create: 'إنشاء الرمز', made: 'تم إنشاء الرمز: ',
    th: ['الرمز', 'لمن', 'الخصم', 'الاستخدام', 'ينتهي', 'الحالة', ''], on: 'فعّال', off: 'موقوف', expired: 'منتهٍ', full: 'مستنفد', disable: 'إيقاف', enable: 'تفعيل', none: 'لا توجد رموز بعد.', unlimited: 'غير محدود', copy: 'نسخ', copied: 'تم النسخ', exists: 'هذا الرمز موجود من قبل.', bad: 'تحقق من الحقول: الرمز الخاص ٦ أحرف أو أرقام على الأقل، والعدد ١ أو أكثر، ونسبة الخصم بين ١ و١٠٠، والبريد الإلكتروني كامل.'
  } : {
    h: 'Discount and exemption codes', p: 'Create a code and give it to someone whose membership fee you want to reduce or waive. When they enter it on the join form with a fee-paying membership, the code is accepted and its percentage comes off the fee (100% = full exemption) — or it is declined if it has no active record here: not found, switched off, expired or used up. The application is still reviewed by the committee as usual.', pct: 'Discount % (100 = full exemption)', pctCol: 'Discount', email: 'Reserve it for one email address (optional — nobody else can then use it)', personal: 'only for ',
    newH: 'New code', label: 'Who is it for? (internal note)', max: 'Number of uses (leave empty for unlimited)', exp: 'Expires on (optional)', custom: 'Your own wording instead (optional — a secure code is generated if left empty)', create: 'Create code', made: 'Code created: ',
    th: ['Code', 'For', 'Discount', 'Used', 'Expires', 'Status', ''], on: 'Active', off: 'Switched off', expired: 'Expired', full: 'Used up', disable: 'Switch off', enable: 'Switch on', none: 'No codes yet.', unlimited: 'unlimited', copy: 'Copy', copied: 'Copied', exists: 'That code already exists.', bad: 'Check the fields: your own wording needs at least 6 letters or digits, the number of uses must be 1 or more, the discount must be between 1 and 100, and the email address must be complete.'
  };
  async function showCodes(note) {
    var d = await O.api('/admin/fee-codes');
    var rows = d.codes.map(function (c) {
      var full = c.max_uses != null && c.used >= c.max_uses, st = c.disabled ? ['cancelled', FC.off] : c.expired ? ['waitlisted', FC.expired] : full ? ['waitlisted', FC.full] : ['confirmed', FC.on];
      return '<tr><td class="mono nowrap" dir="ltr"><b>' + esc(c.code) + '</b> <button type="button" class="btn btn-s btn-sm" data-copy="' + esc(c.code) + '">' + esc(FC.copy) + '</button></td><td>' + esc(c.label || '') + (c.email ? '<div class="ln">' + esc(FC.personal) + '<span dir="ltr">' + esc(c.email) + '</span></div>' : '') + '<div class="ln" dir="ltr">' + esc(c.created_by || '') + '</div></td><td class="nowrap">' + O.num(c.percent_off == null ? 100 : c.percent_off) + '%</td><td class="nowrap">' + O.num(c.used) + ' / ' + (c.max_uses == null ? esc(FC.unlimited) : O.num(c.max_uses)) + '</td><td class="nowrap">' + (c.expires_on ? esc(O.fmtShort(c.expires_on)) : '—') + '</td><td><span class="badge ' + st[0] + '">' + esc(st[1]) + '</span></td><td><button type="button" class="btn btn-s btn-sm" data-code="' + esc(c.code) + '" data-do="' + (c.disabled ? 'enable' : 'disable') + '">' + esc(c.disabled ? FC.enable : FC.disable) + '</button></td></tr>';
    }).join('');
    shell('membership', '<p><a class="lnk" href="#membership">' + esc(MS.d.back) + '</a></p><div class="app-head"><div><p class="eyebrow">' + esc(s.tabs.membership) + '</p><h1 style="font-size:30px">' + esc(FC.h) + '</h1><p class="muted" style="font-size:14px;max-width:75ch;margin:6px 0 0">' + esc(FC.p) + '</p></div></div>' +
      '<form id="fc-f" class="pane" style="max-width:640px;margin-bottom:18px"><h3>' + esc(FC.newH) + '</h3><div class="f"><label class="lbl" for="fc-label">' + esc(FC.label) + '</label><input id="fc-label" type="text" maxlength="120"></div><div class="rowc"><div class="f"><label class="lbl" for="fc-max">' + esc(FC.max) + '</label><input id="fc-max" type="number" min="1" step="1" inputmode="numeric" dir="ltr"></div><div class="f"><label class="lbl" for="fc-exp">' + esc(FC.exp) + '</label><input id="fc-exp" type="date"></div></div><div class="f"><label class="lbl" for="fc-pct">' + esc(FC.pct) + '</label><input id="fc-pct" type="number" min="1" max="100" step="1" value="100" inputmode="numeric" dir="ltr" style="max-width:160px"></div><div class="f"><label class="lbl" for="fc-email">' + esc(FC.email) + '</label><input id="fc-email" type="email" dir="ltr" autocomplete="off"></div><div class="f"><label class="lbl" for="fc-code">' + esc(FC.custom) + '</label><input id="fc-code" type="text" maxlength="24" dir="ltr" autocomplete="off" autocapitalize="characters" spellcheck="false"></div><div class="form-foot"><button class="btn btn-p" type="submit">' + esc(FC.create) + '</button></div></form>' +
      (d.codes.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + FC.th.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="dir-empty">' + esc(FC.none) + '</p>'));
    if (note) flash(note);
    $('fc-f').addEventListener('submit', async function (e) {
      e.preventDefault();
      try { var r = await O.api('/admin/fee-codes', { method: 'POST', body: { label: $('fc-label').value, maxUses: $('fc-max').value, expiresOn: $('fc-exp').value || null, percentOff: $('fc-pct').value === '' ? 100 : Number($('fc-pct').value), email: $('fc-email').value.trim(), code: $('fc-code').value } }); await showCodes(esc(FC.made) + '<b class="mono" dir="ltr">' + esc(r.created) + '</b>'); }
      catch (ex) { flash(esc(ex.status === 409 ? FC.exists : ex.status === 400 ? FC.bad : errText(ex)), 'bad'); }
    });
    view_().querySelectorAll('[data-code]').forEach(function (b) { b.addEventListener('click', async function () { b.disabled = true; try { await O.api('/admin/fee-codes/' + encodeURIComponent(b.getAttribute('data-code')) + '/' + b.getAttribute('data-do'), { method: 'POST', body: {} }); await showCodes(); } catch (ex) { b.disabled = false; flash(esc(errText(ex)), 'bad'); } }); });
    view_().querySelectorAll('[data-copy]').forEach(function (b) { b.addEventListener('click', function () { var c = b.getAttribute('data-copy'); var p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(c) : Promise.reject(); p.then(function () { b.textContent = FC.copied; setTimeout(function () { b.textContent = FC.copy; }, 1500); }, function () { flash('<b class="mono" dir="ltr">' + esc(c) + '</b>'); }); }); });
  }
  /* Volunteers: a register of its own. Registering to volunteer does not make someone a member. */
  async function showVolunteers() {
    var d = await O.api('/admin/volunteers'), i = lang === 'ar' ? 1 : 0;
    var rows = d.volunteers.map(function (v) {
      return '<tr><td><b>' + esc(v.name) + '</b>' + (v.name_ar ? '<div class="ln" dir="rtl">' + esc(v.name_ar) + '</div>' : '') + '</td><td><span dir="ltr">' + esc(v.email) + '</span> ' + (v.verified_at ? '✓' : '') + (v.phone ? '<div class="ln" dir="ltr">' + esc(v.phone) + '</div>' : '') + '</td><td>' + esc((v.areas || []).map(function (a) { return AREA[a] ? AREA[a][i] : a; }).join(L2(', ', '، '))) + '</td><td class="nowrap">' + esc(VPLACE[v.place] ? VPLACE[v.place][i] : v.place) + '</td><td>' + esc(v.whatsapp ? MS.d.yes : MS.d.no) + '</td><td class="nowrap">' + esc(O.fmtShort(v.created_at)) + '</td></tr>';
    }).join('');
    shell('membership', '<p><a class="lnk" href="#membership">' + esc(MS.d.back) + '</a></p><div class="app-head"><div><p class="eyebrow">' + esc(s.tabs.membership) + '</p><h1 style="font-size:30px">' + esc(L2('Volunteers', 'المتطوعون')) + '</h1><p class="muted" style="font-size:14px;max-width:75ch;margin:6px 0 0">' + esc(L2('People who registered to volunteer, newest first. This is separate from membership: it gives no membership rights, and each person can change or withdraw their registration from their own account. ✓ = email address confirmed.', 'من سجّلوا للتطوع، الأحدث أولًا. هذا السجل مستقل عن العضوية ولا يمنح حقوقها، ويستطيع كل شخص تعديل تسجيله أو سحبه من حسابه. ✓ = تم تأكيد البريد الإلكتروني.')) + '</p></div><div class="rowc"><a class="btn btn-s btn-sm" href="/api/admin/volunteers.csv">' + esc(L2('Download (CSV)', 'تنزيل (CSV)')) + '</a></div></div>' +
      (d.volunteers.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + [L2('Name', 'الاسم'), L2('Email / mobile', 'البريد / الجوال'), L2('Areas', 'المجالات'), L2('Where', 'المكان'), L2('WhatsApp', 'واتساب'), L2('Registered', 'تاريخ التسجيل')].map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="dir-empty">' + esc(L2('No volunteer registrations yet.', 'لا توجد طلبات تطوع بعد.')) + '</p>'));
  }
  async function showMembership(view, q) {
    var d = await O.api('/admin/membership?view=' + encodeURIComponent(view) + (q ? '&q=' + encodeURIComponent(q) : ''));
    var tot = d.totals || {}; var cnt = function (k) { return k === 'queue' ? (tot.pending || 0) + (tot.info_requested || 0) : k === 'all' ? Object.keys(tot).reduce(function (a, x) { return a + tot[x]; }, 0) : (tot[k] || 0); };
    var chips = Object.keys(MS.views).map(function (k) { return '<a class="chip" href="#membership/' + k + '" aria-selected="' + (k === view) + '">' + esc(MS.views[k]) + ' <span class="ln">' + O.num(cnt(k)) + '</span></a>'; }).join('');
    var rows = d.members.map(function (r) {
      return '<tr class="mrow" data-no="' + esc(r.member_no) + '" tabindex="0"><td class="num">' + (r.position ? '<b>' + O.num(r.position) + '</b>' : '') + '</td><td class="mono" dir="ltr">' + esc(r.member_no) + '</td><td><b>' + esc(r.name) + '</b>' + (r.name_ar ? '<div class="ln" dir="rtl">' + esc(r.name_ar) + '</div>' : '') + '</td><td>' + esc(tierL(r.tier)) + '</td><td>' + esc(r.detailText || '') + '<div class="ln">' + esc(uniR(r)) + (r.eligibility === 'review' ? ' · <b>' + esc(ELIG.review[lang === 'ar' ? 1 : 0]) + '</b>' : '') + '</div></td><td class="nowrap">' + esc(r.applied_at ? O.fmtShort(r.applied_at) : '') + '</td>' +
        '<td>' + (r.email_verified_at ? '✓' : '<span class="ln">—</span>') + '</td><td>' + esc(MS.pay[r.payment_status] || r.payment_status) + '</td><td>' + esc(MS.nat[r.nationality_status] || r.nationality_status) + '</td><td><span class="badge ' + (badgeCls[r.status] || '') + '">' + esc(MS.st[r.status] || r.status) + '</span></td></tr>';
    }).join('');
    shell('membership', '<div class="app-head"><div><p class="eyebrow">' + esc(s.tabs.membership) + '</p><h1 style="font-size:30px">' + esc(view === 'queue' ? MS.h : MS.hAll) + '</h1><p class="muted" style="font-size:14px;max-width:70ch;margin:6px 0 0">' + esc(MS.p) + '</p></div><div class="rowc"><a class="btn btn-s btn-sm" href="#membership-codes">' + esc(L2('Discount and exemption codes', 'رموز الخصم والإعفاء')) + '</a><a class="btn btn-s btn-sm" href="#membership-volunteers">' + esc(L2('Volunteers', 'المتطوعون')) + '</a><a class="btn btn-s btn-sm" href="/api/admin/subscribers.csv">' + esc(L2('Mailing list (CSV)', 'القائمة البريدية (CSV)')) + '</a><a class="btn btn-s btn-sm" href="#membership-add">' + esc(MS.add) + '</a></div></div>' +
      '<div class="tabs sub">' + chips + '</div><form id="ms-f" class="rowc" style="margin-bottom:12px"><div class="f"><input id="ms-q" type="text" placeholder="' + esc(MS.search) + '" value="' + esc(q || '') + '"></div><button class="btn btn-s btn-sm" type="submit">' + esc(s.find) + '</button></form>' +
      (d.members.length ? '<div class="tbl-wrap"><table class="tbl mtbl"><thead><tr><th class="num">' + esc(MS.th.pos) + '</th><th>' + esc(MS.th.no) + '</th><th>' + esc(MS.th.name) + '</th><th>' + esc(MS.th.type) + '</th><th>' + esc(MS.th.college) + '</th><th>' + esc(MS.th.applied) + '</th><th>' + esc(MS.th.email) + '</th><th>' + esc(MS.th.pay) + '</th><th>' + esc(MS.th.nat) + '</th><th>' + esc(MS.th.status) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="dir-empty">' + esc(MS.empty) + '</p>'));
    $('ms-f').addEventListener('submit', function (e) { e.preventDefault(); showMembership(view, $('ms-q').value.trim()); });
    view_().querySelectorAll('.mrow').forEach(function (tr) { var go = function () { location.hash = '#membership/' + encodeURIComponent(tr.getAttribute('data-no')); }; tr.addEventListener('click', go); tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); }); });
  }
  var view_ = function () { return $('view'); };
  function defaultValid() { var n = new Date(), y = n.getUTCFullYear() + (n.getUTCMonth() >= 9 ? 1 : 0); return y + '-09-30'; }
  function templates(mm) {
    var ar = mm.lang === 'ar', mail = SITE_EMAILS.membership, fee = '£' + (mm.amount_gbp || 0);
    return {
      nat: ar ? 'شكرًا لتقديمك. لتأكيد عضوية السعوديين في أكسفورد المجانية، يرجى إرسال صورة من جواز سفرك السعودي أو هويتك الوطنية (أو تأكيد الابتعاث من الملحقية الثقافية) إلى ' + mail + ' مع ذكر رقم عضويتك ' + mm.member_no + '. نحذف الصورة فور التحقق.' : 'Thank you for applying. To confirm your free Saudi Oxford Community Membership, please email a photo of your Saudi passport or national ID (or your Cultural Bureau scholarship confirmation) to ' + mail + ', quoting ' + mm.member_no + '. We delete it as soon as it has been checked.',
      pay: ar ? 'لم نتمكن بعد من مطابقة رسوم العضوية (' + fee + '). يرجى الدفع بالتحويل البنكي مع ذكر الرقم ' + mm.member_no + ' مرجعًا، أو أخبرنا هنا إن كنت قد دفعت بالفعل.' : 'We have not yet matched your membership fee of ' + fee + '. Please pay by bank transfer quoting ' + mm.member_no + ' as the reference, or tell us here if you have already paid.',
      uni: ar ? 'هل يمكنك تأكيد الجهة التي تنتسب إليها في أكسفورد (الجامعة أو الكلية أو القسم أو المستشفى أو جهة العمل) وصفتك فيها؟' : 'Could you confirm the Oxford institution you are connected with (university, college, department, hospital or employer) and your status there?'
    };
  }
  var SITE_EMAILS = { membership: '' };
  try { var st0 = JSON.parse((document.getElementById('site-settings') || {}).textContent || '{}'); SITE_EMAILS.membership = st0.membershipEmail || st0.email || ''; } catch (e) { /* none on the desk page */ }
  async function showMemberDetail(no) {
    var d = await O.api('/admin/membership/' + encodeURIComponent(no)), mm = d.member, D = MS.d;
    if (!SITE_EMAILS.membership) SITE_EMAILS.membership = (me && me.membershipEmail) || '';
    var open = mm.status === 'pending' || mm.status === 'info_requested';
    var kv = function (k, v) { return '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>'; };
    var info = '<dl class="kv mkv">' + kv(D.email, '<span dir="ltr">' + esc(mm.email) + '</span> ' + (mm.email_verified_at ? '<span class="badge confirmed">' + esc(MS.verified) + '</span>' : '<span class="badge waitlisted">' + esc(MS.unverified) + '</span>')) +
      (mm.phone ? kv(D.phone, '<span dir="ltr">' + esc(mm.phone) + '</span>') : '') + kv(L2('WhatsApp group', 'مجموعة واتساب'), esc(mm.whatsapp ? D.yes : D.no)) +
      kv(L2('Status', 'الصفة'), esc(uniR(mm) || '—')) + (mm.university ? kv(L2('Institution', 'الجهة'), esc(mm.university)) : '') + (mm.college ? kv(D.college, esc(mm.college)) : '') + (mm.department ? kv(L2('Department or research unit', 'القسم أو جهة البحث'), esc(mm.department)) : '') +
      (mm.job_role ? kv(L2('Role', 'الصفة الوظيفية'), esc(mm.job_role)) : '') + (mm.specialty ? kv(L2('Medical specialty', 'التخصص الطبي'), esc(mm.specialty)) : '') + (mm.subject ? kv(L2('Subject', 'التخصص الدراسي'), esc(mm.subject)) : '') + (mm.grad_year ? kv(L2('Graduated', 'سنة التخرج'), esc(mm.grad_year)) : '') +
      (mm.connection ? kv(L2('In their words', 'بكلماته'), esc(mm.connection)) : '') + (mm.sso_username ? kv(L2('Oxford SSO', 'اسم المستخدم (SSO)'), '<span class="mono" dir="ltr">' + esc(mm.sso_username) + '</span>') : '') +
      (mm.declared_saudi ? kv(L2('Nationality', 'الجنسية'), esc(L2('Stated Saudi nationality', 'أكّد أنه سعودي الجنسية'))) : '') + (ELIG[mm.eligibility] ? kv(L2('Eligibility', 'الأهلية'), '<b>' + esc(ELIG[mm.eligibility][lang === 'ar' ? 1 : 0]) + '</b>') : '') +
      (mm.fee_code ? kv(L2('Code used', 'الرمز المستخدم'), '<span class="mono" dir="ltr">' + esc(mm.fee_code) + '</span>' + (mm.amount_gbp > 0 ? ' · ' + esc(L2('fee now £', 'الرسوم الآن £')) + esc(mm.amount_gbp) : '')) : '') +
      kv(D.news, esc(mm.consent_news ? D.yes : D.no)) + kv(D.privacy, esc(mm.consent_privacy_version || '—')) +
      kv(D.applied, esc(mm.applied_at ? O.fmtStamp(mm.applied_at) : '—')) + (mm.position ? kv(D.queue, '<b>' + O.num(mm.position) + '</b>') : '') +
      (mm.decided_at ? kv(D.decided, esc(O.fmtStamp(mm.decided_at)) + ' ' + esc(D.by) + ' <span dir="ltr">' + esc(mm.decided_by || '') + '</span>') : '') + (mm.valid_until ? kv(D.valid, esc(O.fmtShort(mm.valid_until))) : '') +
      (mm.decision_reason ? kv(D.reason, esc(mm.decision_reason)) : '') + '</dl>';
    var qa = '';
    if (mm.info_request) qa += '<div class="pane"><h3>' + esc(D.qSent) + ' <span class="ln">' + esc(mm.info_requested_at ? O.fmtStamp(mm.info_requested_at) : '') + '</span></h3><p class="preview">' + esc(mm.info_request) + '</p>' + (mm.info_response ? '<h3 style="margin-top:12px">' + esc(D.answer) + ' <span class="ln">' + esc(O.fmtStamp(mm.info_response_at)) + '</span></h3><p class="preview">' + esc(mm.info_response) + '</p>' : '') + '</div>';
    var opt = function (obj, cur) { return Object.keys(obj).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(obj[k] === '—' ? (lang === 'ar' ? 'غير مطلوب' : 'Not required') : obj[k]) + '</option>'; }).join(''); };
    var checks = '<form class="pane" id="mchecks"><h3>' + esc(D.checks) + '</h3><div class="rowc"><div class="f"><label class="lbl" for="mc-pay">' + esc(D.payment) + (mm.amount_gbp ? ' (£' + mm.amount_gbp + ')' : '') + '</label><select id="mc-pay">' + opt(MS.pay, mm.payment_status) + '</select></div><div class="f"><label class="lbl" for="mc-nat">' + esc(D.nationality) + '</label><select id="mc-nat">' + opt(MS.nat, mm.nationality_status) + '</select></div></div>' +
      '<div class="f"><label class="lbl" for="mc-notes">' + esc(D.notes) + '</label><textarea id="mc-notes" maxlength="2000">' + esc(mm.notes || '') + '</textarea></div><div class="form-foot"><button class="btn btn-s" type="submit">' + esc(D.save) + '</button></div></form>';
    var evp = '';
    if (mm.evidence) { // only when a document is actually held (the upload is switched off for now)
      var evd = mm.evidence, kb = function (n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; };
      evp = '<div class="pane" id="mev"><h3>' + esc(D.evH) + ' <span class="badge ' + (mm.nationality_status === 'verified' ? 'confirmed' : mm.nationality_status === 'submitted' ? 'offered' : 'waitlisted') + '">' + esc(MS.nat[mm.nationality_status] || mm.nationality_status) + '</span></h3>';
      if (evd) evp += '<p class="ln">' + esc(D.evHeld.replace('{when}', O.fmtStamp(evd.uploadedAt)).replace('{type}', String(evd.mime || '').replace(/^.*\//, '').toUpperCase()).replace('{size}', kb(evd.bytes || 0))) + (evd.viewedAt ? '<br>' + esc(D.evSeen.replace('{when}', O.fmtStamp(evd.viewedAt)).replace('{who}', evd.viewedBy || '')) : '') + '</p><p class="muted" style="font-size:13.5px">' + esc(D.evP) + '</p><div class="rowc"><a class="btn btn-s btn-sm" target="_blank" rel="noopener noreferrer" href="/api/admin/membership/' + encodeURIComponent(mm.member_no) + '/evidence">' + esc(D.evOpen) + '</a><button type="button" class="btn btn-p btn-sm" data-ev="verified">' + esc(D.evOk) + '</button><button type="button" class="btn btn-s btn-sm btn-danger" data-ev="rejected">' + esc(D.evNo) + '</button></div>';
      else if (mm.nationality_status !== 'verified') evp += '<p class="muted" style="font-size:13.5px">' + esc(D.evNone) + '</p>';
      evp += '</div>';
    }
    var eligPane = '';
    if (open && mm.eligibility === 'review') {
      var isFree = mm.tier === 'saudi';
      eligPane = '<div class="pane" id="melig"><h3>' + esc(L2('Eligibility', 'الأهلية')) + ' <span class="badge offered">' + esc(ELIG.review[lang === 'ar' ? 1 : 0]) + '</span></h3><p class="muted" style="font-size:13.5px">' +
        esc(isFree ? L2('This person chose “Other Oxford connection”. Decide whether the connection they describe qualifies for the free membership. Living in Oxford alone does not: it must be an educational, clinical, research or professional connection.', 'اختار هذا الشخص «صلة أخرى بأكسفورد». قرّر هل تؤهله الصلة التي وصفها للعضوية المجانية. الإقامة في أكسفورد وحدها لا تكفي؛ يجب أن تكون الصلة دراسية أو سريرية أو بحثية أو مهنية.')
          : L2('This person applied for a fee-paying membership and asked to be assessed for the free Saudi Oxford Community Membership. No fee is asked while this is open. Eligible: the application becomes a free membership. Not eligible: it stays as it is and the fee is asked for.', 'تقدّم هذا الشخص لعضوية برسوم وطلب تقييم أهليته لعضوية السعوديين في أكسفورد المجانية. لا تُطلب أي رسوم ما دام هذا التحقق مفتوحًا. مؤهل: يصبح الطلب عضوية مجانية. غير مؤهل: يبقى كما هو وتُطلب الرسوم.')) +
        '</p><div class="rowc" style="margin-top:14px"><button type="button" class="btn btn-p btn-sm" data-elig="confirmed">' + esc(isFree ? L2('Connection accepted', 'الصلة مقبولة') : L2('Eligible — make it a free membership', 'مؤهل — اجعلها عضوية مجانية')) + '</button><button type="button" class="btn btn-s btn-sm btn-danger" data-elig="not_eligible">' + esc(isFree ? L2('Not eligible for free membership', 'غير مؤهل للعضوية المجانية') : L2('Not eligible — the fee applies', 'غير مؤهل — تُطبَّق الرسوم')) + '</button></div></div>';
    }
    var acts = '<div class="pane mact"><h3>' + esc(D.actions) + '</h3>';
    if (open || mm.status === 'declined' || mm.status === 'revoked' || mm.status === 'expired') acts += '<details class="mact-d" open><summary>' + esc(mm.status === 'revoked' || mm.status === 'expired' ? D.reinstate : D.approve) + '</summary><p class="muted">' + esc(D.approveP) + '</p><div class="f"><label class="lbl" for="ma-until">' + esc(D.validUntil) + '</label><input id="ma-until" type="date" value="' + esc(mm.valid_until ? String(mm.valid_until).slice(0, 10) : defaultValid()) + '"></div><div class="form-foot"><button class="btn btn-p" data-act="approve">' + esc(mm.status === 'revoked' || mm.status === 'expired' ? D.reinstate : D.approve) + '</button></div></details>';
    if (open) acts += '<details class="mact-d"><summary>' + esc(D.ask) + '</summary><p class="muted">' + esc(D.askP) + '</p><div class="rowc" style="margin-bottom:8px"><span class="ln">' + esc(D.templates) + ':</span><button type="button" class="btn btn-s btn-sm" data-tpl="nat">' + esc(D.tNat) + '</button><button type="button" class="btn btn-s btn-sm" data-tpl="pay">' + esc(D.tPay) + '</button><button type="button" class="btn btn-s btn-sm" data-tpl="uni">' + esc(D.tUni) + '</button></div><div class="f"><label class="lbl" for="ma-msg">' + esc(D.message) + '</label><textarea id="ma-msg" maxlength="2000" dir="' + (mm.lang === 'ar' ? 'rtl' : 'ltr') + '"></textarea></div><div class="form-foot"><button class="btn btn-p" data-act="request-info">' + esc(D.ask) + '</button></div></details>';
    if (open) acts += '<details class="mact-d"><summary>' + esc(D.decline) + '</summary><p class="muted">' + esc(D.declineP) + '</p><div class="f"><label class="lbl" for="ma-dec">' + esc(D.reason) + '</label><textarea id="ma-dec" maxlength="2000"></textarea></div><div class="form-foot"><button class="btn btn-s btn-danger" data-act="decline">' + esc(D.decline) + '</button></div></details>';
    if (mm.status === 'approved') acts += '<details class="mact-d"><summary>' + esc(D.revoke) + '</summary><p class="muted">' + esc(D.revokeP) + '</p><div class="f"><label class="lbl" for="ma-rev">' + esc(D.reason) + '</label><textarea id="ma-rev" maxlength="2000"></textarea></div><div class="form-foot"><button class="btn btn-s btn-danger" data-act="revoke">' + esc(D.revoke) + '</button></div></details>';
    acts += '<label class="chk-l" style="margin-top:10px"><input type="checkbox" id="ma-notify" checked><span>' + esc(D.notify) + '</span></label></div>';
    var hist = '<div class="pane"><h3>' + esc(D.history) + '</h3><ul class="results">' + d.history.map(function (h) { return '<li><span>' + esc(h.action.replace('membership.', '').replace(/_/g, ' ')) + (h.meta && h.meta.reason ? ' — ' + esc(h.meta.reason) : '') + '</span><span class="ln">' + esc(O.fmtStamp(h.at)) + ' · <span dir="ltr">' + esc(h.actor) + '</span></span></li>'; }).join('') + '</ul></div>';
    shell('membership', '<p><a class="lnk" href="#membership">' + esc(D.back) + '</a></p><div class="app-head"><div><p class="eyebrow mono" dir="ltr">' + esc(mm.member_no) + '</p><h1 style="font-size:30px">' + esc(mm.name) + (mm.name_ar ? ' <span class="ln" dir="rtl" style="font-size:20px">' + esc(mm.name_ar) + '</span>' : '') + '</h1><p class="who"><span class="badge ' + (badgeCls[mm.status] || '') + '">' + esc(MS.st[mm.status] || mm.status) + '</span> · ' + esc(mm.tierLabel) + '</p></div></div>' +
      '<div class="grid2 mgrid"><div class="stack"><div class="pane">' + info + '</div>' + qa + eligPane + evp + checks + '</div><div class="stack">' + acts + hist + '</div></div>');
    $('mchecks').addEventListener('submit', async function (e) { e.preventDefault(); try { await O.api('/admin/membership/' + encodeURIComponent(no) + '/update', { method: 'POST', body: { paymentStatus: $('mc-pay').value, nationalityStatus: $('mc-nat').value, notes: $('mc-notes').value } }); await showMemberDetail(no); flash(esc(D.saved)); } catch (ex) { flash(esc(errText(ex)), 'bad'); } });
    view_().querySelectorAll('[data-ev]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var v = b.getAttribute('data-ev');
        if (v === 'rejected' && !(await O.confirm(D.evNoQ, D.evNoT, D.evNo))) return;
        b.disabled = true;
        try { await O.api('/admin/membership/' + encodeURIComponent(no) + '/update', { method: 'POST', body: { nationalityStatus: v } }); await showMemberDetail(no); flash(esc(D.evDone)); } catch (ex) { b.disabled = false; flash(esc(errText(ex)), 'bad'); }
      });
    });
    view_().querySelectorAll('[data-elig]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var v = b.getAttribute('data-elig');
        if (!(await O.confirm(b.textContent + '?', L2('The applicant is emailed the decision.', 'يُبلَّغ المتقدم بالقرار بالبريد الإلكتروني.'), b.textContent))) return;
        b.disabled = true;
        try { await O.api('/admin/membership/' + encodeURIComponent(no) + '/update', { method: 'POST', body: { eligibility: v, notify: $('ma-notify').checked } }); await showMemberDetail(no); flash(esc(L2('Eligibility decision recorded.', 'سُجّل قرار الأهلية.'))); } catch (ex) { b.disabled = false; flash(esc(errText(ex)), 'bad'); }
      });
    });
    var tpl = templates(mm);
    view_().querySelectorAll('[data-tpl]').forEach(function (b) { b.addEventListener('click', function () { $('ma-msg').value = tpl[b.getAttribute('data-tpl')]; $('ma-msg').focus(); }); });
    view_().querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', async function (e) {
        e.preventDefault(); var act = b.getAttribute('data-act'), body = { notify: $('ma-notify').checked };
        if (act === 'approve') {
          body.validUntil = $('ma-until').value || null;
          if (open) { // nothing is activated before payment or eligibility is confirmed (the server refuses it as well)
            if (mm.eligibility === 'review' && mm.tier !== 'saudi') return flash(esc(s.errCodes.eligibility_review_open), 'bad');
            if (mm.amount_gbp > 0 && mm.payment_status !== 'received' && mm.payment_status !== 'waived') return flash(esc(s.errCodes.payment_required), 'bad');
            if (mm.tier === 'saudi' && mm.nationality_status !== 'verified') { if (!(await O.confirm(D.confirmElig, D.warnNat + (mm.email_verified_at ? '' : ' ' + D.warnEmail), D.approve))) return; body.eligibilityConfirmed = true; }
            else if (!mm.email_verified_at && !(await O.confirm(D.confirmApprove, D.warnEmail, D.approve))) return;
          }
        }
        if (act === 'request-info') { body.message = $('ma-msg').value.trim(); if (body.message.length < 5) { $('ma-msg').focus(); return; } }
        if (act === 'decline') body.reason = $('ma-dec').value.trim();
        if (act === 'revoke') { body.reason = $('ma-rev').value.trim(); if (!(await O.confirm(D.revoke + '?', D.revokeP, D.revoke))) return; }
        b.disabled = true;
        try { await O.api('/admin/membership/' + encodeURIComponent(no) + '/' + act, { method: 'POST', body: body }); await showMemberDetail(no); flash(esc(MS.done[act])); }
        catch (ex) { b.disabled = false; flash(esc(errText(ex)), 'bad'); }
      });
    });
  }

  /* ── staff ────────────────────────────────────────────────────── */
  async function showStaff() {
    var d = await O.api('/admin/staff');
    if (!overview) overview = await O.api('/admin/overview');
    var rows = d.staff.map(function (m) { return '<tr><td dir="ltr">' + esc(m.email) + '</td><td>' + esc(m.name || '') + '</td><td>' + esc(m.role) + '</td><td class="ln">' + esc(m.event_ids ? m.event_ids.join(', ') : '—') + '</td><td>' + (m.disabled ? '<span class="badge cancelled">' + esc(s.disabled) + '</span>' : '<span class="badge confirmed">' + esc(s.active) + '</span>') + '</td><td>' + (!m.disabled && m.email !== me.email ? '<button class="btn btn-s btn-sm btn-danger" data-dis="' + esc(m.email) + '">' + esc(s.disable) + '</button>' : '') + '</td></tr>'; }).join('');
    shell('staff', '<div class="app-head"><div><p class="eyebrow">' + esc(s.tabs.staff) + '</p><h1 style="font-size:30px">' + esc(s.staffH) + '</h1></div></div><p class="muted" style="font-size:14px;max-width:80ch">' + esc(s.staffP) + '</p>' +
      '<form id="sf" class="pane" style="margin-bottom:18px"><div class="rowc"><div class="f"><label class="lbl" for="s-email">' + esc(s.email) + '</label><input id="s-email" type="email" required dir="ltr"></div><div class="f"><label class="lbl" for="s-name">' + esc(s.name) + '</label><input id="s-name" type="text"></div><div class="f"><label class="lbl" for="s-role">' + esc(s.role) + '</label><select id="s-role"><option value="checkin_staff">checkin_staff</option><option value="events_admin">events_admin</option><option value="super_admin">super_admin</option></select></div></div><div class="f" style="margin-top:12px"><label class="lbl" for="s-ev">' + esc(s.events) + '</label><select id="s-ev" multiple size="4">' + overview.events.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.id) + ' — ' + esc(L(e.title)) + '</option>'; }).join('') + '</select></div><div class="form-foot"><button class="btn btn-p" type="submit">' + esc(s.addStaff) + '</button></div></form>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + esc(s.sth.email) + '</th><th>' + esc(s.sth.name) + '</th><th>' + esc(s.sth.role) + '</th><th>' + esc(s.sth.events) + '</th><th>' + esc(s.sth.status) + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>');
    $('sf').addEventListener('submit', async function (e) { e.preventDefault(); var ids = Array.prototype.slice.call($('s-ev').selectedOptions).map(function (o) { return o.value; }); try { await O.api('/admin/staff', { method: 'POST', body: { email: $('s-email').value, name: $('s-name').value, role: $('s-role').value, eventIds: ids } }); await showStaff(); flash(esc(s.done)); } catch (e2) { flash(esc(errText(e2)), 'bad'); } });
    view().querySelectorAll('[data-dis]').forEach(function (b) { b.addEventListener('click', async function () { try { await O.api('/admin/staff/' + encodeURIComponent(b.getAttribute('data-dis')), { method: 'DELETE' }); await showStaff(); } catch (e) { flash(esc(errText(e)), 'bad'); } }); });
  }

  /* ── audit ────────────────────────────────────────────────────── */
  async function showAudit() {
    var d = await O.api('/admin/audit?limit=300');
    shell('audit', '<div class="app-head"><div><p class="eyebrow">' + esc(s.tabs.audit) + '</p><h1 style="font-size:30px">' + esc(s.auditH) + '</h1></div></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + esc(s.ath.at) + '</th><th>' + esc(s.ath.actor) + '</th><th>' + esc(s.ath.action) + '</th><th>' + esc(s.ath.resource) + '</th><th>' + esc(s.ath.meta) + '</th></tr></thead><tbody>' +
      d.audit.map(function (a) { return '<tr><td>' + esc(O.fmtStamp(a.at)) + '</td><td dir="ltr">' + esc(a.actor) + '</td><td>' + esc(a.action) + '</td><td class="mono">' + esc(a.resource || '') + '</td><td class="mono">' + esc(a.meta ? JSON.stringify(a.meta) : '') + '</td></tr>'; }).join('') + '</tbody></table></div>');
  }

  /* ── router ───────────────────────────────────────────────────── */
  async function go() {
    stopCam();
    var h = (location.hash || '').replace(/^#/, '');
    if (!h && /\/checkin\/?$/.test(location.pathname)) h = 'checkin';
    var m = h.split('/'), v = m[0] || 'overview', id = m[1];
    try {
      if (v === 'event' && id) return await showEvent(id);
      if (v === 'roster' && id) return await showRoster(id);
      if (v === 'checkin') return await showCheckin(id);
      if (v === 'comms' && id) return await showComms(id);
      if (v === 'mail') return await showMail('');
      if (v === 'members') { location.hash = '#membership'; return; }
      if (v === 'membership-add') return await showMembers('');
      if (v === 'membership-codes') return await showCodes();
      if (v === 'membership-volunteers') return await showVolunteers();
      if (v === 'membership') return id && /^OSS-/i.test(id) ? await showMemberDetail(decodeURIComponent(id)) : await showMembership(id || 'queue', '');
      if (v === 'staff') return await showStaff();
      if (v === 'audit') return await showAudit();
      if (!h && canEdit()) return await showMembership('queue', '');
      return await showOverview();
    } catch (e) {
      if (e.status === 401) return signin();
      if (e.status === 403 && me) { flash(esc(s.errCodes.forbidden), 'bad'); return; }
      if (!$('view')) app.innerHTML = '<p class="alert bad">' + esc(errText(e)) + '</p>'; else flash(esc(errText(e)), 'bad');
    }
  }
  (async function () {
    try { me = await O.api('/admin/me'); } catch (e) { if (e.status === 401) return signin(); if (e.status === 403) return signin('<p class="alert warn">' + esc(s.notStaff) + '</p>'); app.innerHTML = '<p class="alert bad">' + esc(s.err) + '</p>'; return; }
    var p = new URLSearchParams(location.search); if (p.get('verified')) { p.delete('verified'); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash); }
    window.addEventListener('hashchange', go);
    go();
  })();
})();

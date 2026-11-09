/* Events: client behaviour for /events/ (filters, live status) and /events/<slug>/ (registration).
   Static HTML is the source of truth for content; /api/* (Netlify Functions) layers live state on top.
   Nothing here can claim a booking: every message about a seat comes from the server's response. */
(function () {
  'use strict';
  var lang = (document.documentElement.lang || 'en').slice(0, 2) === 'ar' ? 'ar' : 'en';
  var SITE = { lang: lang, email: '', privacyVersion: '2026-11' };
  try { var el0 = document.getElementById('site-settings'); if (el0) Object.assign(SITE, JSON.parse(el0.textContent)); } catch (e) { /* defaults */ }
  var API = (SITE.apiBase || '/api').replace(/\/$/, '');
  var TZ = 'Europe/London';
  var LOCALE = { en: 'en-GB', ar: 'ar-SA-u-ca-gregory-nu-arab' };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n) { return lang === 'ar' ? new Intl.NumberFormat('ar-SA-u-nu-arab').format(n) : String(n); }
  function fmt(d, opts) { return new Intl.DateTimeFormat(LOCALE[lang], Object.assign({ timeZone: TZ }, opts)).format(d); }
  function fmtPill(d) { var s = fmt(d, { day: 'numeric', month: 'short', year: 'numeric' }); return lang === 'ar' ? s : s.toUpperCase(); }
  function fmtTime(d) { return fmt(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  function fmtRange(a, b) { return fmtTime(a) + '–' + fmtTime(b); }
  function fmtLong(d) { return fmt(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function monthKey(d) { var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit' }).formatToParts(d).forEach(function (x) { p[x.type] = x.value; }); return p.year + '-' + p.month; }
  function norm(s) { return String(s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim(); }
  function timeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }
  async function api(path, opts) {
    var o = Object.assign({ method: 'GET', credentials: 'same-origin', headers: { 'Accept': 'application/json' } }, opts || {});
    if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers['Content-Type'] = 'application/json'; }
    var r = await timeout(fetch(API + path, o), 15000);
    var data = null; try { data = await r.json(); } catch (e) { data = null; }
    if (!r.ok) { var err = new Error((data && data.error) || ('http_' + r.status)); err.status = r.status; err.data = data; throw err; }
    return data;
  }

  var S = {
    en: {
      status: { proposed: 'Proposed — Not Confirmed', confirmed: 'Confirmed', cancelled: 'Event cancelled', postponed: 'Date to be confirmed', completed: 'Past event' },
      cta: { soon: 'Registration opens after confirmation', interest: 'Register interest', book: 'Book now', waitlist: 'Join waitlist', full: 'Fully booked', member: 'Sign in as a member', cancelled: 'Event cancelled', tbc: 'Date to be confirmed', closed: 'Registration closed', none: 'No booking required', past: 'This event has taken place' },
      count: function (n) { return n + ' event' + (n === 1 ? '' : 's'); },
      seats: function (n) { return n === 1 ? '1 place left' : n + ' places left'; }, waitOnly: 'Fully booked — waitlist open',
      kind: { interest: 'Register interest', book: 'Book your place', waitlist: 'Join the waitlist', login: 'Member sign-in' },
      intro: {
        interest: 'This event is not confirmed yet. Registering interest is not a booking or a guaranteed place — we will write to you when registration opens.',
        book: 'Your place is assigned when you confirm your email address. Seats are not held before you click the link we send.',
        waitlist: 'All places are taken. Join the waitlist and we will email you if a place opens; you will then have 24 hours to claim it.',
        login: 'This event is reserved for verified members. Enter the email address on your membership and we will send you a sign-in link.'
      },
      legal: {
        interest: 'We keep your name and email only to run this event. You can withdraw at any time from the link in our emails.',
        book: 'Tickets are issued only for confirmed events with open registration. You can cancel from your registrations page.',
        waitlist: 'Waitlist places are offered in order of joining. Declining or ignoring an offer releases it to the next person.',
        login: 'Sign-in links expire after 30 minutes and work once. No password is needed.'
      },
      submit: { interest: 'Register interest (not a booking)', book: 'Continue to email confirmation', waitlist: 'Join waitlist', login: 'Email me a sign-in link' },
      sending: 'Sending…',
      done: {
        pending_interest: ['Check your email', 'We have sent a link to {email}. Click it to confirm your interest. This is not a ticket or a guaranteed place.'],
        pending_book: ['Check your email', 'We have sent a confirmation link to {email}. Your place is assigned the moment you click it; nothing is reserved before then. The link expires in 60 minutes.'],
        pending_waitlist: ['Check your email', 'We have sent a link to {email}. Click it to join the waitlist for this event.'],
        interested: ['Interest registered', 'Thanks. You have registered your interest only. This is not a ticket or guaranteed place.'],
        confirmed: ['Registration confirmed', 'Your registration is confirmed. Your ticket and event details have been sent to your verified email.'],
        waitlisted: ['You are on the waitlist', 'We will email you if a place opens. You will then have 24 hours to claim it.'],
        full: ['Fully booked', 'All places were taken before your request completed.'],
        link_sent: ['Check your email', 'If {email} matches a membership or registration, a sign-in link is on its way. It works once and expires in 30 minutes.'],
        already: ['Already registered', 'This email already holds a place or a waitlist entry for this event. Sign in to see your registrations.']
      },
      err: {
        name: 'Enter your full name.', email: 'Enter a valid email address.', privacy: 'The privacy notice must be acknowledged.',
        member_required: 'This event is reserved for verified members. If you have applied, membership is confirmed by email once the committee has checked it.',
        not_open: 'Registration for this event is not open.', rate_limited: 'Too many attempts from this connection. Please try again in a few minutes.',
        unavailable: 'Registration is temporarily unavailable. Please try again shortly or email us', duplicate: 'This email already holds a place or a waitlist entry for this event.'
      },
      banner: {
        interest: 'Thanks. You have registered your interest only. This is not a ticket or guaranteed place.',
        confirmed: 'Your registration is confirmed. Your ticket and event details have been sent to your verified email.',
        waitlisted: 'You are on the waitlist. We will email you if a place opens; you will then have 24 hours to claim it.',
        full: 'All places were taken before you confirmed. You have not been registered.',
        expired: 'That link has expired. Please register again.', invalid: 'That link is not valid.', used: 'That link has already been used.',
        cancelled: 'Your registration has been cancelled.', signed_in: 'You are signed in.', claimed: 'Your waitlist place is confirmed. Your ticket has been emailed to you.', claim_gone: 'Sorry — that place was claimed by someone else or the offer expired.'
      },
      myRegs: 'My registrations', joinLink: 'Become a member', viewTicket: 'View my registrations', copied: 'Link copied', copyFail: 'Copy the address from your browser bar',
      wa: function (title, when, url) { return title + ' — ' + when + '\n' + url; }
    },
    ar: {
      status: { proposed: 'مبدئي — بانتظار التأكيد', confirmed: 'مؤكدة', cancelled: 'أُلغيت الفعالية', postponed: 'التاريخ قيد التأكيد', completed: 'فعالية سابقة' },
      cta: { soon: 'يُفتح التسجيل لاحقًا', interest: 'سجّل اهتمامك', book: 'احجز مقعدك', waitlist: 'انضم لقائمة الانتظار', full: 'اكتمل العدد', member: 'تسجيل دخول الأعضاء', cancelled: 'أُلغيت الفعالية', tbc: 'التاريخ قيد التأكيد', closed: 'أُغلق التسجيل', none: 'لا يتطلب التسجيل', past: 'انتهت هذه الفعالية' },
      count: function (n) { return n === 0 ? 'لا توجد فعاليات' : n === 1 ? 'فعالية واحدة' : n === 2 ? 'فعاليتان' : (n % 100 >= 3 && n % 100 <= 10) ? num(n) + ' فعاليات' : num(n) + ' فعالية'; },
      seats: function (n) { return n === 1 ? 'مقعد واحد متبقٍ' : 'المقاعد المتبقية: ' + num(n); }, waitOnly: 'اكتمل العدد — قائمة الانتظار مفتوحة',
      kind: { interest: 'تسجيل الاهتمام', book: 'حجز مقعد', waitlist: 'الانضمام لقائمة الانتظار', login: 'تسجيل دخول الأعضاء' },
      intro: {
        interest: 'هذه الفعالية لم تُؤكَّد بعد. تسجيل الاهتمام ليس حجزًا ولا ضمانًا للمقعد، وسنراسلك عند فتح التسجيل.',
        book: 'يُخصّص مقعدك عند تأكيد بريدك الإلكتروني. لا تُحجز المقاعد قبل الضغط على الرابط الذي نرسله.',
        waitlist: 'اكتملت المقاعد. انضم لقائمة الانتظار وسنراسلك إن توفّر مقعد، ويكون أمامك ٢٤ ساعة لتأكيده.',
        login: 'هذه الفعالية مخصصة لأعضاء الجمعية المعتمدين. أدخل بريد عضويتك وسنرسل لك رابط دخول.'
      },
      legal: {
        interest: 'نحتفظ باسمك وبريدك لإدارة هذه الفعالية فقط، ويمكنك الانسحاب في أي وقت عبر الرابط في رسائلنا.',
        book: 'تُصدر التذاكر فقط للفعاليات المؤكدة التي فُتح تسجيلها. يمكنك الإلغاء من صفحة تسجيلاتك.',
        waitlist: 'تُعرض المقاعد بحسب ترتيب الانضمام. تجاهل العرض أو رفضه يحوّله إلى الشخص التالي.',
        login: 'تنتهي صلاحية رابط الدخول بعد ٣٠ دقيقة ويعمل مرة واحدة. لا حاجة لكلمة مرور.'
      },
      submit: { interest: 'سجّل اهتمامك (ليس حجزًا مؤكدًا)', book: 'متابعة إلى تأكيد البريد', waitlist: 'انضم لقائمة الانتظار', login: 'أرسل لي رابط الدخول' },
      sending: 'جارٍ الإرسال…',
      done: {
        pending_interest: ['تحقّق من بريدك', 'أرسلنا رابطًا إلى {email}. اضغط عليه لتأكيد اهتمامك. هذا ليس تذكرة ولا ضمانًا للمقعد.'],
        pending_book: ['تحقّق من بريدك', 'أرسلنا رابط تأكيد إلى {email}. يُخصّص مقعدك لحظة الضغط عليه، ولا يُحجز شيء قبل ذلك. تنتهي صلاحية الرابط خلال ٦٠ دقيقة.'],
        pending_waitlist: ['تحقّق من بريدك', 'أرسلنا رابطًا إلى {email}. اضغط عليه للانضمام إلى قائمة الانتظار.'],
        interested: ['تم تسجيل اهتمامك', 'شكرًا لك. تم تسجيل اهتمامك فقط، ولا يُعد ذلك حجزًا أو ضمانًا للمقعد.'],
        confirmed: ['تم تأكيد التسجيل', 'تم تأكيد تسجيلك، وأُرسلت تفاصيل الفعالية والتذكرة إلى بريدك الإلكتروني المُتحقّق منه.'],
        waitlisted: ['أنت في قائمة الانتظار', 'سنراسلك إن توفّر مقعد، ويكون أمامك ٢٤ ساعة لتأكيده.'],
        full: ['اكتمل العدد', 'اكتملت المقاعد قبل إتمام طلبك.'],
        link_sent: ['تحقّق من بريدك', 'إذا كان {email} مرتبطًا بعضوية أو تسجيل، فرابط الدخول في طريقه إليك. يعمل مرة واحدة وتنتهي صلاحيته خلال ٣٠ دقيقة.'],
        already: ['مسجّل مسبقًا', 'هذا البريد يحمل مقعدًا أو مكانًا في قائمة الانتظار لهذه الفعالية. سجّل الدخول لعرض تسجيلاتك.']
      },
      err: {
        name: 'أدخل اسمك الكامل.', email: 'أدخل بريدًا إلكترونيًا صحيحًا.', privacy: 'الموافقة على إشعار الخصوصية مطلوبة.',
        member_required: 'هذه الفعالية مخصصة لأعضاء الجمعية المعتمدين. إن كنت قد تقدّمت بطلب، فستُؤكَّد عضويتك بالبريد بعد مراجعة اللجنة.',
        not_open: 'التسجيل لهذه الفعالية غير مفتوح.', rate_limited: 'محاولات كثيرة من هذا الاتصال. حاول مجددًا بعد دقائق.',
        unavailable: 'التسجيل غير متاح مؤقتًا. حاول لاحقًا أو راسلنا على', duplicate: 'هذا البريد يحمل مقعدًا أو مكانًا في قائمة الانتظار لهذه الفعالية.'
      },
      banner: {
        interest: 'شكرًا لك. تم تسجيل اهتمامك فقط، ولا يُعد ذلك حجزًا أو ضمانًا للمقعد.',
        confirmed: 'تم تأكيد تسجيلك، وأُرسلت تفاصيل الفعالية والتذكرة إلى بريدك الإلكتروني المُتحقّق منه.',
        waitlisted: 'أنت في قائمة الانتظار. سنراسلك إن توفّر مقعد، ويكون أمامك ٢٤ ساعة لتأكيده.',
        full: 'اكتملت المقاعد قبل تأكيدك، ولم يتم تسجيلك.',
        expired: 'انتهت صلاحية هذا الرابط. يرجى التسجيل مجددًا.', invalid: 'هذا الرابط غير صالح.', used: 'استُخدم هذا الرابط من قبل.',
        cancelled: 'تم إلغاء تسجيلك.', signed_in: 'تم تسجيل دخولك.', claimed: 'تم تأكيد مقعدك من قائمة الانتظار، وأُرسلت التذكرة إلى بريدك.', claim_gone: 'عذرًا — حُجز هذا المقعد لشخص آخر أو انتهت مدة العرض.'
      },
      myRegs: 'تسجيلاتي', joinLink: 'كن عضوًا', viewTicket: 'عرض تسجيلاتي', copied: 'تم نسخ الرابط', copyFail: 'انسخ العنوان من شريط المتصفح',
      wa: function (title, when, url) { return title + ' — ' + when + '\n' + url; }
    }
  };
  var s = S[lang];
  var base = lang === 'ar' ? '/ar' : '';

  /* ═══════════════════ index ═══════════════════ */
  var index = $('ev-index');
  if (index) (function () {
    var up = $('ev-upcoming'), past = $('ev-past'), upH = $('ev-up-h'), pastH = $('ev-past-h'), empty = $('ev-empty'), count = $('ev-count');
    var q = $('ev-q'), month = $('ev-month'), cat = $('ev-cat'), chips = Array.prototype.slice.call(index.querySelectorAll('.chip[data-f]')), clear = $('ev-clear');
    var cards = Array.prototype.slice.call(index.querySelectorAll('.evc'));
    cards.forEach(function (c) { c.setAttribute('data-search', norm(c.getAttribute('data-search'))); });
    var state = { q: '', month: '', cat: '', f: {} };
    // URL → state (shareable filters)
    try {
      var p = new URLSearchParams(location.search);
      state.q = p.get('q') || ''; state.month = p.get('month') || ''; state.cat = p.get('cat') || '';
      (p.get('f') || '').split(',').forEach(function (k) { if (k) state.f[k] = true; });
    } catch (e) { /* ignore */ }
    q.value = state.q; month.value = state.month; cat.value = state.cat;
    chips.forEach(function (b) { var on = !!state.f[b.getAttribute('data-f')]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });

    function matches(c) {
      var qq = norm(state.q);
      if (qq && c.getAttribute('data-search').indexOf(qq) === -1) return false;
      if (state.month && c.getAttribute('data-month') !== state.month) return false;
      if (state.cat && c.getAttribute('data-cat') !== state.cat) return false;
      if (state.f.public && c.getAttribute('data-aud') !== 'public') return false;
      if (state.f.members && c.getAttribute('data-aud') !== 'members') return false;
      if (state.f.free && c.getAttribute('data-fee') !== 'free') return false;
      if (state.f.booking && c.getAttribute('data-booking') !== '1') return false;
      return true;
    }
    function syncUrl() {
      try {
        var p = new URLSearchParams();
        if (state.q) p.set('q', state.q); if (state.month) p.set('month', state.month); if (state.cat) p.set('cat', state.cat);
        var f = Object.keys(state.f).filter(function (k) { return state.f[k]; }); if (f.length) p.set('f', f.join(','));
        var qs = p.toString(); history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      } catch (e) { /* ignore */ }
    }
    function apply() {
      var shown = 0, upShown = 0, pastShown = 0;
      cards.forEach(function (c) { var ok = matches(c); c.hidden = !ok; if (ok) { shown++; if (c.parentNode === past) pastShown++; else upShown++; } });
      count.textContent = s.count(shown);
      upH.hidden = upShown === 0; up.hidden = upShown === 0;
      pastH.hidden = pastShown === 0; past.hidden = pastShown === 0;
      empty.hidden = shown > 0;
      var active = !!(state.q || state.month || state.cat || Object.keys(state.f).some(function (k) { return state.f[k]; }));
      clear.hidden = !active;
      syncUrl();
    }
    // upcoming ↔ past regrouping at runtime (the HTML was grouped at build time)
    function regroup() {
      var now = Date.now();
      cards.forEach(function (c) {
        var ended = new Date(c.getAttribute('data-end')).getTime() < now;
        if (ended && c.parentNode !== past) past.appendChild(c);
        else if (!ended && c.parentNode !== up) up.appendChild(c);
      });
      // upcoming ascending, past most-recent first
      Array.prototype.slice.call(up.children).sort(function (a, b) { return a.getAttribute('data-start') < b.getAttribute('data-start') ? -1 : 1; }).forEach(function (c) { up.appendChild(c); });
      Array.prototype.slice.call(past.children).sort(function (a, b) { return a.getAttribute('data-start') > b.getAttribute('data-start') ? -1 : 1; }).forEach(function (c) { past.appendChild(c); });
    }
    q.addEventListener('input', function () { state.q = q.value; apply(); });
    month.addEventListener('change', function () { state.month = month.value; apply(); });
    cat.addEventListener('change', function () { state.cat = cat.value; apply(); });
    chips.forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-f'), on = !state.f[k];
        if (on && k === 'public') state.f.members = false; if (on && k === 'members') state.f.public = false; // mutually exclusive audience
        state.f[k] = on;
        chips.forEach(function (x) { var o = !!state.f[x.getAttribute('data-f')]; x.classList.toggle('on', o); x.setAttribute('aria-pressed', o ? 'true' : 'false'); });
        apply();
      });
    });
    function reset() { state = { q: '', month: '', cat: '', f: {} }; q.value = ''; month.value = ''; cat.value = ''; chips.forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); apply(); }
    clear.addEventListener('click', function () { reset(); q.focus(); });
    var change = $('ev-change'); if (change) change.addEventListener('click', function () { reset(); q.focus(); });
    // grid / list
    var seg = index.querySelector('.seg'), view = 'grid';
    try { view = localStorage.getItem('oss-ev-view') === 'list' ? 'list' : 'grid'; } catch (e) { /* ignore */ }
    function setView(v) {
      view = v; [up, past].forEach(function (g) { g.classList.toggle('list', v === 'list'); });
      seg.querySelectorAll('button').forEach(function (b) { var on = b.getAttribute('data-view') === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      try { localStorage.setItem('oss-ev-view', v); } catch (e) { /* ignore */ }
    }
    seg.addEventListener('click', function (e) { var b = e.target.closest('button[data-view]'); if (b) setView(b.getAttribute('data-view')); });
    setView(view);
    regroup(); apply();
    setInterval(function () { regroup(); apply(); }, 60000);

    // live state from the API (status, dates changed by the committee, capacity)
    api('/events').then(function (res) {
      var list = (res && res.events) || [];
      list.forEach(function (ev) {
        var c = index.querySelector('.evc[data-slug="' + ev.slug + '"]'); if (!c) return;
        if (ev.eventStatus && ev.eventStatus !== c.getAttribute('data-status')) {
          c.setAttribute('data-status', ev.eventStatus);
          var st = c.querySelector('.status'); if (st) { st.className = 'status s-' + ev.eventStatus; st.textContent = s.status[ev.eventStatus] || ev.eventStatus; }
        }
        if (ev.startUtc && ev.endUtc && (ev.startUtc !== c.getAttribute('data-start') || ev.endUtc !== c.getAttribute('data-end'))) {
          var a = new Date(ev.startUtc), b = new Date(ev.endUtc);
          c.setAttribute('data-start', a.toISOString()); c.setAttribute('data-end', b.toISOString()); c.setAttribute('data-month', monthKey(a));
          var pill = c.querySelector('.pill'); if (pill) { pill.textContent = fmtPill(a); pill.setAttribute('datetime', a.toISOString()); }
          var tm = c.querySelector('.evc-time'); if (tm) tm.textContent = fmtRange(a, b);
        }
      });
      regroup(); apply();
    }).catch(function () { /* static state stands */ });
  })();

  /* ═══════════════════ detail ═══════════════════ */
  var det = document.querySelector('.ev-detail');
  if (det) (function () {
    var slug = det.getAttribute('data-slug');
    var ev = { slug: slug, eventStatus: det.getAttribute('data-status'), registrationMode: det.getAttribute('data-mode'), audience: det.getAttribute('data-aud'), startUtc: det.getAttribute('data-start'), endUtc: det.getAttribute('data-end'), seatsLeft: null, waitlistEnabled: true, state: det.getAttribute('data-cta') };
    var me = null; // { email, member, registration }
    var title = (det.querySelector('.ev-title') || {}).textContent || document.title;
    var cta = $('reg-cta'), bar = $('cta-bar'), barBtn = bar ? bar.querySelector('button') : null, msg = $('reg-msg'), stateP = $('reg-state'), panel = $('reg-panel');
    var dlg = $('reg-dialog'), form = $('reg-form'), done = $('reg-done');
    var mode = 'interest';

    function render() {
      var key = ev.state;
      var actionable = key === 'interest' || key === 'book' || key === 'waitlist' || key === 'member';
      cta.setAttribute('data-key', key); cta.textContent = s.cta[key] || key;
      cta.disabled = !actionable; if (actionable) cta.removeAttribute('aria-disabled'); else cta.setAttribute('aria-disabled', 'true');
      if (barBtn) { barBtn.textContent = s.cta[key] || key; barBtn.disabled = !actionable; }
      panel.setAttribute('data-cta', key);
      var extra = '';
      if (key === 'book' && ev.seatsLeft != null && ev.seatsLeft > 0 && ev.seatsLeft <= 20) extra = s.seats(ev.seatsLeft);
      if (key === 'waitlist') extra = s.waitOnly;
      if (me && me.registration && me.registration.status) {
        var st = me.registration.status;
        if (st === 'confirmed') extra = s.done.confirmed[0]; else if (st === 'waitlisted') extra = s.done.waitlisted[0]; else if (st === 'interested') extra = s.done.interested[0]; else if (st === 'checked_in') extra = s.done.confirmed[0];
        if (st === 'confirmed' || st === 'waitlisted' || st === 'interested' || st === 'checked_in') { cta.disabled = true; cta.setAttribute('aria-disabled', 'true'); cta.textContent = extra; if (barBtn) { barBtn.disabled = true; barBtn.textContent = extra; } }
      }
      var link = $('reg-mine');
      if (me && !link) { link = document.createElement('a'); link.id = 'reg-mine'; link.className = 'lnk'; link.href = base + '/account/'; link.textContent = s.myRegs; var links = panel.querySelector('.reg-links'); if (links) links.appendChild(link); }
      if (extra && !(stateP.getAttribute('data-banner'))) { stateP.textContent = extra; }
      // status label + facts if the committee changed them after the build
      var st2 = det.querySelector('[data-status-label]');
      if (st2 && ev.eventStatus !== det.getAttribute('data-status')) { var bn = $('ev-banner'), pn = det.querySelector('[data-proposed-note]'); if (bn) bn.className = 'ev-banner s-' + ev.eventStatus; if (pn) pn.hidden = ev.eventStatus !== 'proposed'; st2.textContent = s.status[ev.eventStatus] || ev.eventStatus; det.setAttribute('data-status', ev.eventStatus); }
      if (ev.startUtc !== det.getAttribute('data-start') || ev.endUtc !== det.getAttribute('data-end')) {
        var a = new Date(ev.startUtc), b = new Date(ev.endUtc);
        var w = det.querySelector('[data-when]'), tm = det.querySelector('[data-time] '), pill = det.querySelector('.pill');
        if (w) w.textContent = fmtLong(a); if (pill) { pill.textContent = fmtPill(a); pill.setAttribute('datetime', a.toISOString()); }
        var tmEl = det.querySelector('[data-time]'); if (tmEl) { var small = tmEl.querySelector('small'); tmEl.textContent = fmtRange(a, b) + ' '; if (small) tmEl.appendChild(small); }
        det.setAttribute('data-start', a.toISOString()); det.setAttribute('data-end', b.toISOString());
      }
    }

    // `?verified=…` banner after an email link
    (function banner() {
      var p; try { p = new URLSearchParams(location.search); } catch (e) { return; }
      var v = p.get('verified') || p.get('result'); if (!v) return;
      var text = s.banner[v]; if (!text) return;
      stateP.textContent = text; stateP.setAttribute('data-banner', v); stateP.classList.add('is-' + (v === 'confirmed' || v === 'claimed' || v === 'signed_in' ? 'ok' : v === 'interest' || v === 'waitlisted' || v === 'cancelled' ? 'info' : 'warn'));
      if (v === 'confirmed' || v === 'claimed' || v === 'waitlisted' || v === 'signed_in') { var a = document.createElement('a'); a.className = 'lnk'; a.href = base + '/account/'; a.textContent = ' ' + s.viewTicket; stateP.appendChild(a); }
      p.delete('verified'); p.delete('result'); var qs = p.toString();
      try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) { /* ignore */ }
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    })();

    /* dialog */
    function setMode(m) {
      mode = m;
      $('reg-kind').textContent = s.kind[m]; $('reg-title').textContent = title; $('reg-intro').textContent = s.intro[m]; $('reg-legal').textContent = s.legal[m];
      $('reg-submit').textContent = s.submit[m];
      var nameF = $('reg-name').closest('.f'), newsF = $('reg-news').closest('.f');
      nameF.hidden = m === 'login'; newsF.hidden = m === 'login';
      var useP = form.querySelector('.reg-use'), reqF = $('reg-req-f');
      if (useP) useP.hidden = m === 'login';
      if (reqF) reqF.hidden = !(m === 'book' || m === 'waitlist'); // dietary / access notes only matter for an actual place
      $('reg-errs').classList.remove('on'); $('reg-errs').textContent = '';
      form.querySelectorAll('.f.err').forEach(function (f) { f.classList.remove('err'); });
      form.hidden = false; done.hidden = true;
    }
    function open(m) {
      setMode(m);
      if (me && me.email) $('reg-email').value = me.email;
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      setTimeout(function () { (m === 'login' ? $('reg-email') : $('reg-name')).focus(); }, 50);
    }
    function close() { if (dlg.open) dlg.close(); }
    function modeFor() {
      var key = ev.state;
      if (key === 'interest') return 'interest';
      if (key === 'book' || key === 'member' || key === 'waitlist') {
        if (ev.audience === 'members') {
          if (!me) return 'login';
          if (!me.member) return 'gate';
        }
        return key === 'waitlist' ? 'waitlist' : 'book';
      }
      return null;
    }
    function onCta() {
      var m = modeFor(); if (!m) return;
      if (m === 'gate') { showMsg(s.err.member_required + ' <a class="lnk" href="' + base + '/join/">' + esc(s.joinLink) + '</a>', 'warn'); return; }
      open(m);
    }
    cta.addEventListener('click', onCta); if (barBtn) barBtn.addEventListener('click', onCta);
    $('reg-close').addEventListener('click', close); $('reg-cancel').addEventListener('click', close); $('reg-done-close').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    function showMsg(html, kind) { msg.innerHTML = html; msg.hidden = false; msg.className = 'reg-sub msg-' + (kind || 'info'); }

    function setErr(id, on) { var f = $(id).closest('.f'); f.classList.toggle('err', !!on); $(id).setAttribute('aria-invalid', on ? 'true' : 'false'); }
    function validate() {
      var bad = [];
      if (mode !== 'login') { var n = $('reg-name').value.trim(); setErr('reg-name', n.length < 2); if (n.length < 2) bad.push('reg-name'); }
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($('reg-email').value.trim()); setErr('reg-email', !ok); if (!ok) bad.push('reg-email');
      var pv = $('reg-privacy').checked; setErr('reg-privacy', !pv); if (!pv) bad.push('reg-privacy');
      var errs = $('reg-errs'); errs.classList.toggle('on', bad.length > 0);
      errs.textContent = bad.length ? bad.map(function (id) { return s.err[id.replace('reg-', '')]; }).join(' ') : '';
      if (bad.length) $(bad[0]).focus();
      return bad.length === 0;
    }
    ['reg-name', 'reg-email', 'reg-privacy'].forEach(function (id) { $(id).addEventListener('input', function () { setErr(id, false); }); $(id).addEventListener('change', function () { setErr(id, false); }); });

    function showDone(key, vars, link) {
      var d = s.done[key] || s.done.pending_book;
      $('reg-done-title').textContent = d[0];
      $('reg-done-text').textContent = d[1].replace('{email}', (vars && vars.email) || '');
      $('reg-done-sub').textContent = (key === 'pending_interest' || key === 'interested') ? s.intro.interest.split('.')[0] + '.' : '';
      var a = $('reg-done-link'); if (link) { a.href = link.href; a.textContent = link.text; a.hidden = false; } else a.hidden = true;
      form.hidden = true; done.hidden = false; $('reg-done-close').focus();
    }
    var busy = false;
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); if (busy) return;
      if ($('reg-website').value) { close(); return; } // honeypot: pretend
      if (!validate()) return;
      var email = $('reg-email').value.trim(), name = $('reg-name').value.trim();
      var body = { email: email, lang: lang, website: '', consent_privacy: true, privacy_version: SITE.privacyVersion || '2026-11', redirect: location.pathname };
      if (mode !== 'login') { body.name = name; body.marketing_opt_in = $('reg-news').checked; }
      var path = mode === 'login' ? '/auth/request-link' : mode === 'interest' ? '/events/' + slug + '/interest' : '/events/' + slug + '/register';
      if (mode === 'waitlist') body.waitlist = true;
      if ((mode === 'book' || mode === 'waitlist') && $('reg-req') && $('reg-req').value.trim()) body.requirements = $('reg-req').value.trim().slice(0, 500);
      busy = true; var btn = $('reg-submit'), keep = btn.textContent; btn.disabled = true; btn.textContent = s.sending;
      try {
        var res = await api(path, { method: 'POST', body: body, headers: { 'Idempotency-Key': idem(slug, email, mode) } });
        var st = (res && res.status) || 'pending_verification';
        if (st === 'pending_verification') showDone(mode === 'interest' ? 'pending_interest' : mode === 'waitlist' ? 'pending_waitlist' : 'pending_book', { email: email });
        else if (st === 'link_sent') showDone('link_sent', { email: email });
        else if (st === 'confirmed') { showDone('confirmed', { email: email }, { href: base + '/account/', text: s.viewTicket }); ev.state = 'closed'; me = me || { email: email }; me.registration = { status: 'confirmed' }; render(); }
        else if (st === 'waitlisted') { showDone('waitlisted', { email: email }, { href: base + '/account/', text: s.viewTicket }); me = me || { email: email }; me.registration = { status: 'waitlisted' }; render(); }
        else if (st === 'interested') { showDone('interested', { email: email }); me = me || { email: email }; me.registration = { status: 'interested' }; render(); }
        else if (st === 'full') { showDone('full', { email: email }); ev.state = ev.waitlistEnabled ? 'waitlist' : 'full'; render(); }
        else if (st === 'already') showDone('already', { email: email }, { href: base + '/account/', text: s.viewTicket });
        else showDone('pending_book', { email: email });
      } catch (err) {
        var code = (err && err.data && err.data.error) || '', errs = $('reg-errs'); errs.classList.add('on');
        if (err.status === 403 && code === 'member_required') errs.innerHTML = esc(s.err.member_required) + ' <a href="' + base + '/join/">' + esc(s.joinLink) + '</a>';
        else if (err.status === 409 || code === 'duplicate') { showDone('already', { email: email }, { href: base + '/account/', text: s.viewTicket }); }
        else if (err.status === 429) errs.textContent = s.err.rate_limited;
        else if (err.status === 400 && code === 'not_open') errs.textContent = s.err.not_open;
        else if (err.status === 400 && err.data && err.data.fields) { errs.textContent = Object.keys(err.data.fields).map(function (k) { return s.err[k] || err.data.fields[k]; }).join(' '); Object.keys(err.data.fields).forEach(function (k) { if ($('reg-' + k)) setErr('reg-' + k, true); }); }
        else errs.innerHTML = esc(s.err.unavailable) + (SITE.email ? ' <a href="mailto:' + esc(SITE.email) + '">' + esc(SITE.email) + '</a>.' : '.');
      }
      busy = false; btn.disabled = false; btn.textContent = keep;
    });
    function idem(a, b, c) { var str = a + '|' + norm(b) + '|' + c + '|' + Math.floor(Date.now() / 600000); var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return 'web-' + (h >>> 0).toString(16) + '-' + str.length; }

    /* share */
    var copy = $('ev-copy'), wa = $('ev-share-wa');
    var url = location.origin + location.pathname;
    if (wa) { var whenTxt = fmtLong(new Date(ev.startUtc)) + ', ' + fmtRange(new Date(ev.startUtc), new Date(ev.endUtc)); wa.href = 'https://wa.me/?text=' + encodeURIComponent(s.wa(title, whenTxt, url)); }
    if (copy) copy.addEventListener('click', function () {
      var keep = copy.textContent, p = (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(url) : Promise.reject();
      p.then(function () { copy.textContent = copy.getAttribute('data-copied') || s.copied; }, function () { copy.textContent = s.copyFail; });
      setTimeout(function () { copy.textContent = keep; }, 2200);
    });

    /* phone CTA bar: appears once the registration panel scrolls out of view */
    if (bar && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) { var vis = entries[0].isIntersecting; bar.hidden = vis || cta.disabled; }, { threshold: 0.1 });
      io.observe(panel);
    }

    /* live state */
    render();
    api('/events/' + slug).then(function (res) {
      if (!res || !res.event) return;
      var e = res.event;
      ev.eventStatus = e.eventStatus || ev.eventStatus; ev.registrationMode = e.registrationMode || ev.registrationMode; ev.seatsLeft = e.seatsLeft; ev.waitlistEnabled = e.waitlistEnabled !== false;
      if (e.startUtc) ev.startUtc = new Date(e.startUtc).toISOString(); if (e.endUtc) ev.endUtc = new Date(e.endUtc).toISOString();
      if (e.state) ev.state = e.state;
      me = res.me || null;
      var ics = panel.querySelector('a[download]'); if (ics && e.id) ics.href = API + '/events/' + e.id + '/calendar.ics';
      render();
    }).catch(function () { /* the static page already shows the committee's published state */ });
  })();
})();

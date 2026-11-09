'use strict';
/* Events: static rendering of the programme (index + one page per event) in both languages.
   Content comes from src/content/events/*.json (the desk); live state (status, capacity, counts)
   is layered on at runtime by src/js/site.js from /api/events. Nothing here claims a booking. */
const fs = require('fs');
const path = require('path');
const T = require('../shared/time.cjs');

const SRC = path.join(__dirname, '..', 'src');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L = (obj, lang) => (obj && typeof obj === 'object') ? (obj[lang] || obj.en || '') : (obj || '');

const venues = fs.existsSync(path.join(SRC, 'content/venues.json')) ? readJson(path.join(SRC, 'content/venues.json')) : {};
const labels = fs.existsSync(path.join(SRC, 'content/event-labels.json')) ? readJson(path.join(SRC, 'content/event-labels.json')) : {};
const CATEGORY = {
  community: { en: 'Community', ar: 'فعاليات مجتمعية' }, culture: { en: 'Culture', ar: 'فعاليات ثقافية' }, 'culture-religion': { en: 'Culture & religion', ar: 'فعاليات ثقافية ودينية' },
  religion: { en: 'Religion', ar: 'مناسبات دينية' }, 'academic-careers': { en: 'Academic & careers', ar: 'فعاليات أكاديمية ومهنية' }, sports: { en: 'Sports', ar: 'أنشطة رياضية' },
};
const UI = {
  en: {
    eyebrow: 'Oxford Saudi Society · 2026—2027', h1: 'Events & Gatherings', h1sub: 'فعاليات وأنشطة الجمعية',
    lede: 'Student-led celebrations, community gatherings, research conversations and shared traditions in Oxford.',
    range: 'December 2026 – December 2027', notice: 'All dates and venues are provisional until confirmed. Registration opens only after an event is confirmed; until then you can register your interest.',
    programme: 'Our programme', nEvents: (n) => `${n} event${n === 1 ? '' : 's'}`, search: 'Search events', searchPh: 'Search by event or venue',
    month: 'Any month', category: 'All categories', clear: 'Clear filters', grid: 'Cards', list: 'List', view: 'View', upcoming: 'Upcoming', past: 'Past events',
    none: 'No events match', change: 'Change filters', details: 'View details', featured: 'Featured', next: 'Next on the programme',
    time: 'Time', date: 'Date', location: 'Location', about: 'About this event', agenda: 'Programme', agendaDraft: 'Draft programme', venue: 'Venue', organiser: 'Organiser & contact',
    access: 'Accessibility & questions', share: 'Share', copy: 'Copy link', copied: 'Link copied', ics: 'Add to calendar (.ics)', crumbHome: 'Home', crumbEvents: 'Events',
    proposedNote: 'The date and venue are provisional until the committee confirms them.',
    eid: 'Lunar-calendar observances may differ by a day; the committee will confirm any change.', dinner: 'Price and booking conditions to be announced.',
    venueUnconfirmed: 'The exact address and directions will be published here once the venue is confirmed.',
    venueOutdoor: 'An outdoor gathering; details of the meeting point follow once the plan is confirmed.',
    organiserText: 'Organised by the Oxford Saudi Society committee.', contact: 'Questions:', accessText: 'Tell us about any access requirements when you book; we will do what the venue allows. Prayer arrangements and family-friendly timings are considered for every gathering.',
    privacyLine: 'Registration asks only for your name and email; dietary or access requirements are optional when you book. See our', privacyLink: 'privacy notice', ticketNote: 'Tickets are issued only for confirmed events with open registration.',
    cta: { soon: 'Registration opens after confirmation', interest: 'Register interest', book: 'Book now', waitlist: 'Join waitlist', full: 'Fully booked', member: 'Sign in as a member', cancelled: 'Event cancelled', tbc: 'Date to be confirmed', closed: 'Registration closed', none: 'No booking required', past: 'This event has taken place' },
    interestNote: 'Registering interest is not a booking or a guaranteed place.',
    tagsAria: 'Access and price', statusAria: 'Status',
  },
  ar: {
    eyebrow: 'الجمعية السعودية في أكسفورد · ٢٠٢٦—٢٠٢٧', h1: 'فعاليات وأنشطة الجمعية', h1sub: '',
    lede: 'احتفالات ولقاءات مجتمعية وحوارات بحثية وتقاليد مشتركة يقودها الطلبة في أكسفورد.',
    range: 'ديسمبر ٢٠٢٦ – ديسمبر ٢٠٢٧', notice: 'جميع المواعيد والأماكن مبدئية إلى أن تُؤكَّد. يُفتح التسجيل بعد تأكيد الفعالية فقط، وحتى ذلك الحين يمكنك تسجيل اهتمامك.',
    programme: 'برنامجنا', nEvents: (n) => { const N = new Intl.NumberFormat('ar-SA-u-nu-arab').format(n); return n === 0 ? 'لا توجد فعاليات' : n === 1 ? 'فعالية واحدة' : n === 2 ? 'فعاليتان' : (n % 100 >= 3 && n % 100 <= 10) ? `${N} فعاليات` : `${N} فعالية`; }, search: 'ابحث في الفعاليات', searchPh: 'ابحث باسم الفعالية أو المكان',
    month: 'كل الأشهر', category: 'كل الفئات', clear: 'مسح الخيارات', grid: 'بطاقات', list: 'قائمة', view: 'العرض', upcoming: 'القادمة', past: 'فعاليات سابقة',
    none: 'لا توجد فعاليات مطابقة', change: 'غيّر خيارات البحث', details: 'تفاصيل الفعالية', featured: 'مميّزة', next: 'التالية في البرنامج',
    time: 'الوقت', date: 'التاريخ', location: 'المكان', about: 'عن الفعالية', agenda: 'البرنامج', agendaDraft: 'البرنامج المبدئي', venue: 'المكان', organiser: 'الجهة المنظمة والتواصل',
    access: 'إمكانية الوصول والأسئلة', share: 'مشاركة', copy: 'نسخ الرابط', copied: 'تم نسخ الرابط', ics: 'أضف إلى التقويم (.ics)', crumbHome: 'الرئيسية', crumbEvents: 'الفعاليات',
    proposedNote: 'التاريخ والمكان مبدئيان إلى أن تؤكدهما اللجنة.',
    eid: 'قد يختلف الموعد الهجري يومًا بحسب إعلان دخول الشهر، وستؤكد اللجنة أي تعديل.', dinner: 'تُعلن الرسوم وشروط الحجز لاحقًا.',
    venueUnconfirmed: 'سيُنشر هنا العنوان الدقيق وطريقة الوصول بعد تأكيد المكان.',
    venueOutdoor: 'لقاء في الهواء الطلق؛ تُعلن نقطة التجمّع بعد تأكيد الخطة.',
    organiserText: 'تنظّمه لجنة الجمعية السعودية في أكسفورد.', contact: 'للاستفسار:', accessText: 'أبلغنا بأي متطلبات تتعلق بإمكانية الوصول عند الحجز، وسنوفّر ما يسمح به المكان. تُراعى ترتيبات الصلاة والمواعيد المناسبة للعائلات في كل لقاء.',
    privacyLine: 'لا يطلب التسجيل سوى اسمك وبريدك الإلكتروني، وذكر المتطلبات الغذائية أو متطلبات إمكانية الوصول اختياري عند الحجز. راجع', privacyLink: 'إشعار الخصوصية', ticketNote: 'تُصدر التذاكر فقط للفعاليات المؤكدة التي فُتح تسجيلها.',
    cta: { soon: 'يُفتح التسجيل بعد تأكيد الفعالية', interest: 'سجّل اهتمامك', book: 'احجز مقعدك', waitlist: 'انضم لقائمة الانتظار', full: 'اكتمل العدد', member: 'تسجيل دخول الأعضاء', cancelled: 'أُلغيت الفعالية', tbc: 'التاريخ قيد التأكيد', closed: 'أُغلق التسجيل', none: 'لا يتطلب التسجيل', past: 'انتهت هذه الفعالية' },
    interestNote: 'تسجيل الاهتمام ليس حجزًا ولا ضمانًا للمقعد.',
    tagsAria: 'الدخول والرسوم', statusAria: 'الحالة',
  },
};

// Operational state from the live API (see build/fetch-live.js) overrides the content files' status fields.
const livePath = path.join(SRC, 'content/_live-events.json');
const live = fs.existsSync(livePath) ? (readJson(livePath).events || []) : [];
const liveById = new Map(live.map((e) => [e.id, e]));
function loadEvents() {
  const dir = path.join(SRC, 'content/events');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJson(path.join(dir, f)))
    .filter((e) => e.published !== false && e.visibility !== 'hidden')
    .map((e) => {
      const l = liveById.get(e.id);
      if (l) Object.assign(e, { eventStatus: l.eventStatus || e.eventStatus, registrationMode: l.registrationMode || e.registrationMode, audience: l.audience || e.audience, capacity: l.capacity, waitlistEnabled: l.waitlistEnabled, venueKey: l.venueKey || e.venueKey, version: l.version, startLocal: l.startUtc ? T.utcToZonedIso(l.startUtc) : e.startLocal, endLocal: l.endUtc ? T.utcToZonedIso(l.endUtc) : e.endLocal });
      const start = T.zonedToUtc(e.startLocal), end = T.zonedToUtc(e.endLocal);
      return Object.assign({}, e, { start, end, venue: venues[e.venueKey] || null, eid: /eid/i.test(e.slug) });
    })
    .filter((e) => e.start && e.end)
    .sort((a, b) => a.start - b.start || (a.order || 0) - (b.order || 0));
}

const label = (key, lang) => L(labels[key], lang) || key;
function tagsOf(e, lang) {
  const t = [];
  t.push({ k: e.audience === 'members' ? 'members' : 'public', text: label(e.audience === 'members' ? 'members' : 'public', lang) });
  if (e.price && e.price.status === 'free') t.push({ k: 'free', text: label('free', lang) });
  else if (e.price && e.price.status === 'tbd') t.push({ k: 'tbd', text: label('tbd', lang) });
  const bk = !e.bookingRequired ? 'no_booking' : (e.eventStatus === 'confirmed' || e.eventStatus === 'completed') ? 'booking' : 'booking_later';
  t.push({ k: bk, text: label(bk, lang) });
  return t;
}
const tagsHtml = (e, lang) => `<ul class="tags etags" aria-label="${esc(UI[lang].tagsAria)}">${tagsOf(e, lang).map((t) => `<li data-k="${t.k}">${esc(t.text)}</li>`).join('')}</ul>`;

function statusText(e, lang) {
  if (e.eventStatus === 'cancelled') return UI[lang].cta.cancelled;
  if (e.eventStatus === 'postponed') return UI[lang].cta.tbc;
  if (e.eventStatus === 'proposed') return label('proposed', lang);
  return lang === 'ar' ? 'مؤكدة' : 'Confirmed';
}

/* ── index ───────────────────────────────────────────────────────── */
function cardHtml(e, lang, urlFor) {
  const u = UI[lang];
  const href = urlFor('event:' + e.slug, lang);
  const otherLang = lang === 'ar' ? 'en' : 'ar';
  const venueName = e.venue ? L(e.venue.name, lang) : '';
  return `<article class="evc" data-slug="${esc(e.slug)}" data-start="${e.start.toISOString()}" data-end="${e.end.toISOString()}" data-month="${T.monthKey(e.start)}" data-cat="${esc(e.category)}" data-aud="${esc(e.audience)}" data-fee="${esc(e.price && e.price.status)}" data-booking="${e.bookingRequired ? '1' : '0'}" data-status="${esc(e.eventStatus)}" data-search="${esc((L(e.title, 'en') + ' ' + L(e.title, 'ar') + ' ' + venueName + ' ' + (e.venue ? L(e.venue.name, otherLang) : '')).toLowerCase())}">
  <div class="evc-img"><img src="${esc(e.image.thumb)}" width="440" height="440" loading="lazy" decoding="async" alt="${esc(L(e.image.alt, lang))}"></div>
  <div class="evc-body">
    <div class="evc-top"><time class="pill" datetime="${e.start.toISOString()}">${esc(T.fmtPill(e.start, lang))}</time><span class="status s-${esc(e.eventStatus)}" data-status-label>${esc(statusText(e, lang))}</span></div>
    <h3 class="evc-title">${esc(L(e.title, lang))}</h3>
    <p class="evc-title-alt" lang="${otherLang}" dir="${otherLang === 'ar' ? 'rtl' : 'ltr'}">${esc(L(e.title, otherLang))}</p>
    <p class="evc-meta"><span class="evc-time">${esc(T.fmtRange(e.start, e.end, lang))}</span>${venueName ? `<span class="evc-venue">${esc(venueName)}</span>` : ''}</p>
    ${tagsHtml(e, lang)}
    <a class="btn btn-s evc-cta" href="${href}" aria-label="${esc(u.details)}: ${esc(L(e.title, lang))}">${esc(u.details)}</a>
  </div>
</article>`;
}

function indexHtml(events, lang, urlFor, settings) {
  const u = UI[lang];
  const now = new Date();
  const upcoming = events.filter((e) => e.end >= now), past = events.filter((e) => e.end < now);
  const featured = upcoming[0] || events[0];
  const months = [...new Map(events.map((e) => [T.monthKey(e.start), T.fmtMonth(e.start, lang)])).entries()];
  const cats = [...new Set(events.map((e) => e.category))];
  const chips = [['public', label('public', lang)], ['free', label('free', lang)], ['booking', lang === 'ar' ? 'تتطلب التسجيل' : 'Registration needed'], ['members', label('members', lang)]];
  const hero = `
  <section class="band tint head ev-head">
    <div class="wrap ev-hero">
      <div class="ev-hero-copy">
        <p class="eyebrow">${esc(u.eyebrow)}</p>
        <h2>${esc(u.h1)}</h2>
        ${u.h1sub ? `<p class="h1-alt" lang="ar" dir="rtl">${esc(u.h1sub)}</p>` : ''}
        <hr class="gold-rule">
        <p class="lede">${esc(u.lede)}</p>
        <p class="ev-range">${esc(u.range)}</p>
      </div>
      ${featured ? `<a class="ev-feature" href="${urlFor('event:' + featured.slug, lang)}" aria-label="${esc(u.featured)}: ${esc(L(featured.title, lang))}">
        <img src="${esc(featured.image.web)}" width="1080" height="1080" alt="${esc(L(featured.image.alt, lang))}" fetchpriority="high">
        <span class="ev-feature-cap"><span class="pill">${esc(T.fmtPill(featured.start, lang))}</span><span class="ev-feature-title">${esc(L(featured.title, lang))}</span></span>
      </a>` : ''}
    </div>
  </section>`;
  const tools = `
  <section class="band">
    <div class="wrap">
      <p class="note ev-notice" role="note">${esc(u.notice)}</p>
      <div class="ev-tools" role="search" aria-label="${esc(u.search)}">
        <div class="f ev-q"><label class="lbl" for="ev-q">${esc(u.search)}</label><input id="ev-q" type="search" autocomplete="off" placeholder="${esc(u.searchPh)}"></div>
        <div class="f"><label class="lbl" for="ev-month">${esc(u.date)}</label><select id="ev-month"><option value="">${esc(u.month)}</option>${months.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
        <div class="f"><label class="lbl" for="ev-cat">${esc(lang === 'ar' ? 'الفئة' : 'Category')}</label><select id="ev-cat"><option value="">${esc(u.category)}</option>${cats.map((c) => `<option value="${c}">${esc(L(CATEGORY[c], lang) || c)}</option>`).join('')}</select></div>
        <div class="chips ev-chips" role="group" aria-label="${esc(u.tagsAria)}">${chips.map(([k, t]) => `<button type="button" class="chip" data-f="${k}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>
        <button type="button" class="lnk ev-clear" id="ev-clear">${esc(u.clear)}</button>
        <p class="ev-count" id="ev-count" aria-live="polite">${esc(u.nEvents(events.length))}</p>
        <div class="seg" role="group" aria-label="${esc(u.view)}"><button type="button" class="on" data-view="grid" aria-pressed="true">${esc(u.grid)}</button><button type="button" data-view="list" aria-pressed="false">${esc(u.list)}</button></div>
      </div>
      <h3 class="eyebrow ev-sec" id="ev-up-h">${esc(u.upcoming)}</h3>
      <div class="ev-grid" id="ev-upcoming" aria-labelledby="ev-up-h">${upcoming.map((e) => cardHtml(e, lang, urlFor)).join('')}</div>
      <h3 class="eyebrow ev-sec" id="ev-past-h"${past.length ? '' : ' hidden'}>${esc(u.past)}</h3>
      <div class="ev-grid ev-past" id="ev-past" aria-labelledby="ev-past-h"${past.length ? '' : ' hidden'}>${past.map((e) => cardHtml(e, lang, urlFor)).join('')}</div>
      <div class="dir-empty" id="ev-empty" hidden><p>${esc(u.none)}</p><button type="button" class="btn btn-s" id="ev-change">${esc(u.change)}</button></div>
    </div>
  </section>`;
  return hero + tools;
}

/* ── detail ──────────────────────────────────────────────────────── */
function ctaFor(e, lang) {
  const u = UI[lang].cta;
  const now = new Date();
  if (e.eventStatus === 'cancelled') return { key: 'cancelled', text: u.cancelled, on: false };
  if (e.eventStatus === 'postponed') return { key: 'tbc', text: u.tbc, on: false };
  if (e.end < now) return { key: 'past', text: u.past, on: false };
  if (!e.bookingRequired || e.registrationMode === 'none') return { key: 'none', text: u.none, on: false };
  if (e.eventStatus === 'proposed') return e.registrationMode === 'interest_only' ? { key: 'interest', text: u.interest, on: true } : { key: 'soon', text: u.soon, on: false };
  if (e.registrationMode === 'open') return { key: 'book', text: u.book, on: true };
  if (e.registrationMode === 'waitlist_only') return { key: 'waitlist', text: u.waitlist, on: true };
  return { key: 'closed', text: u.closed, on: false };
}

function detailHtml(e, lang, urlFor, settings) {
  const u = UI[lang];
  const otherLang = lang === 'ar' ? 'en' : 'ar';
  const cta = ctaFor(e, lang);
  const venueName = e.venue ? L(e.venue.name, lang) : (lang === 'ar' ? 'يُعلن لاحقًا' : 'To be announced');
  const venueNote = e.venue && e.venue.bookingStatus === 'confirmed' && e.venue.addressVerified ? esc(e.venue.addressVerified) : esc(e.venue && e.venue.type === 'outdoor' ? u.venueOutdoor : u.venueUnconfirmed);
  const agenda = (e.agenda && e.agenda[lang] && e.agenda[lang].length) ? `<section class="ev-block"><h3>${esc(e.eventStatus === 'confirmed' || e.eventStatus === 'completed' ? u.agenda : u.agendaDraft)}</h3><ol class="ev-agenda">${e.agenda[lang].map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>` : '';
  const email = settings.email ? `<a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a>` : `<span class="ph">[hello@address]</span>`;
  const notices = [];
  if (e.eid) notices.push(u.eid);
  if (e.price && e.price.status === 'tbd') notices.push(u.dinner);
  const icsHref = urlFor('event:' + e.slug, 'en').replace(/\/$/, '') + '/event.ics';
  return `
  <nav class="crumbs" aria-label="${esc(lang === 'ar' ? 'مسار الصفحة' : 'Breadcrumb')}"><a href="${urlFor('home', lang)}">${esc(u.crumbHome)}</a><span>/</span><a href="${urlFor('events', lang)}">${esc(u.crumbEvents)}</a><span>/</span><span aria-current="page">${esc(L(e.title, lang))}</span></nav>
  <div class="ev-detail" data-slug="${esc(e.slug)}" data-status="${esc(e.eventStatus)}" data-mode="${esc(e.registrationMode)}" data-aud="${esc(e.audience)}" data-start="${e.start.toISOString()}" data-end="${e.end.toISOString()}" data-cta="${cta.key}">
    <figure class="ev-art"><img src="${esc(e.image.web)}" width="1080" height="1080" alt="${esc(L(e.image.alt, lang))}" fetchpriority="high"></figure>
    <div class="ev-info">
      <div class="evc-top"><time class="pill" datetime="${e.start.toISOString()}">${esc(T.fmtPill(e.start, lang))}</time></div>
      <div class="ev-banner s-${esc(e.eventStatus)}" id="ev-banner" role="note"><b data-status-label>${esc(statusText(e, lang))}</b><span class="ev-banner-note" data-proposed-note${e.eventStatus === 'proposed' ? '' : ' hidden'}>${esc(u.proposedNote)}</span></div>
      <h2 class="ev-title">${esc(L(e.title, lang))}</h2>
      <p class="ev-title-alt" lang="${otherLang}" dir="${otherLang === 'ar' ? 'rtl' : 'ltr'}">${esc(L(e.title, otherLang))}</p>
      <dl class="ev-facts">
        <div><dt>${esc(u.date)}</dt><dd data-when>${esc(T.fmtDateLong(e.start, lang))}</dd></div>
        <div><dt>${esc(u.time)}</dt><dd data-time>${esc(T.fmtRange(e.start, e.end, lang))} <small>${esc(lang === 'ar' ? '(بتوقيت أكسفورد)' : '(Oxford time)')}</small></dd></div>
        <div><dt>${esc(u.location)}</dt><dd data-venue>${esc(venueName)}</dd></div>
      </dl>
      ${tagsHtml(e, lang)}
      ${notices.map((n) => `<p class="ev-note">${esc(n)}</p>`).join('')}
      <div class="reg-panel" id="reg-panel" data-cta="${cta.key}">
        <p class="reg-state" id="reg-state" aria-live="polite"></p>
        <button type="button" class="btn btn-p reg-cta" id="reg-cta" data-key="${cta.key}"${cta.on ? '' : ' disabled aria-disabled="true"'}>${esc(cta.text)}</button>
        ${cta.key === 'interest' ? `<p class="reg-sub">${esc(u.interestNote)}</p>` : ''}
        <p class="reg-sub" id="reg-msg" hidden></p>
        <div class="reg-links"><a class="lnk" href="${icsHref}" download="${esc(e.slug)}.ics">${esc(u.ics)}</a><button type="button" class="lnk" id="ev-copy" data-copied="${esc(u.copied)}">${esc(u.copy)}</button><a class="lnk" id="ev-share-wa" target="_blank" rel="noopener" href="#">WhatsApp</a></div>
        <p class="reg-privacy">${esc(u.privacyLine)} <a href="${urlFor('privacy', lang)}">${esc(u.privacyLink)}</a>. ${esc(u.ticketNote)}</p>
      </div>
    </div>
  </div>
  <div class="ev-more">
    <section class="ev-block"><h3>${esc(u.about)}</h3><p>${esc(L(e.description, lang))}</p></section>
    ${agenda}
    <section class="ev-block"><h3>${esc(u.venue)}</h3><p><strong>${esc(venueName)}</strong></p><p>${venueNote}</p></section>
    <section class="ev-block"><h3>${esc(u.organiser)}</h3><p>${esc(u.organiserText)} ${esc(u.contact)} ${email}</p></section>
    <section class="ev-block"><h3>${esc(u.access)}</h3><p>${esc(u.accessText)}</p></section>
  </div>
  <div class="cta-bar" id="cta-bar" hidden><span class="cta-bar-title">${esc(L(e.title, lang))}</span><button type="button" class="btn btn-p" data-key="${cta.key}">${esc(cta.text)}</button></div>`;
}

/* ── static ICS + JSON-LD ────────────────────────────────────────── */
function icsFor(e, base) {
  const status = e.eventStatus === 'cancelled' ? 'CANCELLED' : e.eventStatus === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE';
  const title = L(e.title, 'en') + (e.eventStatus === 'proposed' ? ' (proposed)' : '');
  const fold = (s) => s.replace(/(.{70})/g, '$1\r\n ');
  const escT = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Oxford Saudi Society//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${e.id}@oxsss.org`, `DTSTAMP:${T.icsUtc(new Date())}`, `DTSTART:${T.icsUtc(e.start)}`, `DTEND:${T.icsUtc(e.end)}`, `SEQUENCE:${e.version || 1}`, `STATUS:${status}`,
    fold(`SUMMARY:${escT(title)}`), fold(`DESCRIPTION:${escT(L(e.description, 'en') + (e.eventStatus === 'proposed' ? '\nDate and venue are proposed and not yet confirmed.' : '') + '\n' + base + '/events/' + e.slug + '/')}`),
    fold(`LOCATION:${escT(e.venue ? L(e.venue.name, 'en') + (e.eventStatus === 'proposed' ? ' (proposed)' : '') : 'To be announced')}`), `URL:${base}/events/${e.slug}/`, 'END:VEVENT', 'END:VCALENDAR'];
  return lines.join('\r\n') + '\r\n';
}
function jsonLd(e, lang, base, urlFor) {
  if (e.eventStatus !== 'confirmed') return ''; // only truthful structured data
  const d = { '@context': 'https://schema.org', '@type': 'Event', name: L(e.title, lang), startDate: e.start.toISOString(), endDate: e.end.toISOString(),
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', image: [base + e.image.web],
    description: L(e.description, lang), url: base + urlFor('event:' + e.slug, lang), organizer: { '@type': 'Organization', name: 'Oxford Saudi Society', url: base },
    location: { '@type': 'Place', name: e.venue ? L(e.venue.name, lang) : 'Oxford' } };
  return `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`;
}

function nextEvent(events, lang) {
  const now = new Date();
  const e = events.find((x) => x.end >= now) || null;
  if (!e) return null;
  return { e, title: L(e.title, lang), sub: `${T.fmtDate(e.start, lang)} · ${T.fmtRange(e.start, e.end, lang)}${e.venue ? ' · ' + L(e.venue.name, lang) : ''}${e.eventStatus === 'proposed' ? (lang === 'ar' ? ' · مبدئي' : ' · proposed') : ''}` };
}

module.exports = { loadEvents, indexHtml, detailHtml, icsFor, jsonLd, nextEvent, UI, CATEGORY, tagsOf, L };

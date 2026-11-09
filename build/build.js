#!/usr/bin/env node
/* Oxford Saudi Society — static site build.
   Reads src/template.html + src/content/*, writes dist/ with one page per route in English and Arabic.
   No framework: cheerio for HTML, plain Node. Run: npm run build */
'use strict';
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const EV = require('./events');
const FAQ = require('./faq');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

/* ── content ───────────────────────────────────────────────────── */
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const readDir = (dir) => fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJson(path.join(dir, f)))
  : [];
const settings = readJson(path.join(SRC, 'content/settings.json'));
const roles = readJson(path.join(SRC, 'content/roles.json'));
const committees = readDir(path.join(SRC, 'content/committees')).sort((a, b) => String(b.term).localeCompare(String(a.term)));
const events = EV.loadEvents();
const faq = FAQ.load();
const people = readDir(path.join(SRC, 'content/people')).filter((p) => p.name && p.published !== false).sort((a, b) => String(a.name).localeCompare(String(b.name)));
const BASE = (settings.domain || 'https://oxsss.org').replace(/\/$/, '');

/* ── routes ────────────────────────────────────────────────────── */
const ROUTES = [
  { id: 'home', path: '', title: { en: 'Oxford Saudi Society', ar: 'الجمعية السعودية في أكسفورد' },
    desc: { en: 'A home for Saudi culture in the heart of Oxford. Events, membership, volunteering and community for Saudi students, researchers, alumni and friends at the University of Oxford.',
            ar: 'ملتقى السعوديين وأصدقاء المملكة في أكسفورد. فعاليات وعضوية وتطوّع ومجتمع للطلبة والباحثين والخريجين والأصدقاء السعوديين في جامعة أكسفورد.' } },
  { id: 'about', path: 'about', title: { en: 'About', ar: 'عن الجمعية' }, desc: { en: 'Who we are, what we stand for and the committee behind the Oxford Saudi Society.', ar: 'من نحن وما نؤمن به واللجنة التي تقف خلف الجمعية السعودية في أكسفورد.' } },
  { id: 'events', path: 'events', title: { en: 'Events & Gatherings', ar: 'فعاليات وأنشطة الجمعية' }, desc: { en: 'The Oxford Saudi Society programme for 2026–27: celebrations, community gatherings, research conversations and shared traditions in Oxford. Dates and venues are proposed until confirmed.', ar: 'برنامج الجمعية السعودية في أكسفورد ٢٠٢٦–٢٠٢٧: احتفالات ولقاءات مجتمعية وحوارات بحثية وتقاليد مشتركة. المواعيد والأماكن مقترحة حتى تأكيدها.' } },
  { id: 'community', path: 'community', title: { en: 'Community', ar: 'مجتمعنا' }, desc: { en: 'Students, alumni and friends of the Oxford Saudi Society — a public directory of people who have chosen to be listed.', ar: 'طلبة وخريجون وأصدقاء الجمعية السعودية في أكسفورد — دليل عام لمن اختار الظهور فيه.' } },
  { id: 'ideas', path: 'ideas', title: { en: 'Ideas', ar: 'أفكار' }, desc: { en: 'Suggest, vote on and discuss ideas for the Oxford Saudi Society — the committee reviews the board every term.', ar: 'اقترح أفكاراً للجمعية السعودية في أكسفورد وصوّت عليها وناقشها — تراجع اللجنة اللوحة كل فصل دراسي.' } },
  { id: 'join', path: 'join', title: { en: 'Join', ar: 'انضم إلينا' }, desc: { en: 'Become a member of the Oxford Saudi Society. Free for Saudi students; a small annual fee for everyone else.', ar: 'كن عضواً في الجمعية السعودية في أكسفورد. مجاناً للطلبة السعوديين ورسم سنوي بسيط لغيرهم.' } },
  { id: 'faq', path: 'faq', title: { en: 'FAQ — studying and living in Oxford', ar: 'الأسئلة الشائعة — الدراسة والحياة في أكسفورد' }, desc: { en: 'Practical answers for Saudi students in Oxford: Safir and the Cultural Bureau, arrival and transport, housing, University services, daily life, prayer and health, and the Society itself.', ar: 'إجابات عملية للطلبة السعوديين في أكسفورد: سفير والملحقية، الوصول والتنقل، السكن، الخدمات الجامعية، الحياة اليومية، الصلاة والصحة، والجمعية نفسها.' } },
  { id: 'privacy', path: 'privacy', title: { en: 'Privacy notice', ar: 'إشعار الخصوصية' }, desc: { en: 'How the Oxford Saudi Society handles your information.', ar: 'كيف تتعامل الجمعية السعودية في أكسفورد مع بياناتك.' } },
  { id: 'terms', path: 'terms', title: { en: 'Terms of use', ar: 'شروط الاستخدام' }, desc: { en: 'Terms of use for the Oxford Saudi Society website.', ar: 'شروط استخدام موقع الجمعية السعودية في أكسفورد.' } },
  { id: 'past-committees', path: 'committees', title: { en: 'Committees', ar: 'مجالس إدارة الجمعية' }, desc: { en: 'The people who have served on the committees of the Oxford Saudi Society.', ar: 'من تولّى قيادة الجمعية السعودية في أكسفورد عبر الأعوام.' } },
];
// one page per event, in both languages
for (const e of events) {
  ROUTES.push({ id: 'event:' + e.slug, view: 'event', nav: 'events', path: 'events/' + e.slug, event: e,
    title: { en: e.title.en, ar: e.title.ar }, desc: { en: e.description.en, ar: e.description.ar }, og: e.image && e.image.web });
}
const urlFor = (routeId, lang) => {
  const r = ROUTES.find((x) => x.id === routeId);
  const p = r && r.path ? r.path + '/' : '';
  return (lang === 'ar' ? '/ar/' : '/') + p;
};

/* ── helpers ───────────────────────────────────────────────────── */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L = (obj, lang) => (obj && typeof obj === 'object') ? (obj[lang] || obj.en || '') : (obj || '');
const ph = (text) => `<span class="ph">${esc(text)}</span>`;
const GROUPS = { student: ['Current student', 'طالب حالي'], alumni: ['Alumni', 'خريج'], associate: ['Working in Oxford', 'يعمل في أكسفورد'], brookes: ['Oxford Brookes', 'أكسفورد بروكس'] };
const CATS = { exec: ['Executive', 'اللجنة التنفيذية'], events: ['Events', 'لجنة الفعاليات'], media: ['Media, PR & Outreach', 'الإعلام والعلاقات العامة'], other: ['Committee', 'اللجنة'] };
const TAGS = { free: ['Free', 'مجاناً'], open: ['All welcome', 'الكل مرحّب به'], booking: ['Booking', 'التسجيل مطلوب'], members: ['Members', 'للأعضاء'] };
const S = {
  en: { namePh: '[Name]', termTitle: (t) => `<bdi dir="ltr">${esc(t)}</bdi> Committee`, nMembers: (n) => `${n} members`, archiveH: 'Historical archive',
        archive: (email) => `We have not yet been able to document the committee members for earlier years. If you served on a past committee, or hold any of its records, email ${email} and we will add them.`,
        pastLink: 'Committees page →', dirEmpty: 'The members’ directory will be available soon.', book: 'Book a place',
        weekPh: '[Week]', datePh: '[Date]', venuePh: '[Venue]', nextPh: '[Event name]', nextSubPh: '[Date and time] · [Venue]', emailPh: '[hello@address]' },
  ar: { namePh: '[الاسم]', termTitle: (t) => `لجنة <bdi dir="ltr">${esc(t)}</bdi>`, nMembers: (n) => `${n} أعضاء`, archiveH: 'الأرشيف التاريخي',
        archive: (email) => `لم نتمكن بعد من توثيق أسماء أعضاء اللجان في الأعوام السابقة. إن كنت عضواً في لجنة سابقة أو لديك شيء من سجلاتها، راسلنا على ${email} لنضيفها.`,
        pastLink: 'صفحة مجالس الإدارة ←', dirEmpty: 'سيُتاح دليل الأعضاء قريبًا.', book: 'احجز مقعداً',
        weekPh: '[الأسبوع]', datePh: '[التاريخ]', venuePh: '[المكان]', nextPh: '[اسم الفعالية]', nextSubPh: '[التاريخ والوقت] · [المكان]', emailPh: '[hello@address]' },
};
const roleOf = (id) => roles.find((r) => r.id === id) || null;
const SILHOUETTE = '<svg viewBox="0 0 24 24" aria-hidden="true" class="sil"><circle cx="12" cy="8.5" r="4"/><path d="M4 20.5a8 8 0 0 1 16 0"/></svg>';
const initials = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase();
const safeHttp = (u) => { try { const x = new URL(String(u || '').trim()); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : ''; } catch (e) { return ''; } };
const linkedinUrl = (u) => { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; const s = safeHttp(u); if (!s) return ''; try { if (!/(^|\.)linkedin\.com$/i.test(new URL(s).hostname)) return ''; } catch (e) { return ''; } return s; };
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
const waDigits = (p) => { const d = String(p || '').replace(/[^\d]/g, ''); return d.length >= 8 && d.length <= 15 ? d : ''; };
const emailHtml = (lang) => settings.email ? `<a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a>` : ph(S[lang].emailPh);
const ICON = {
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 13.4a1 1 0 0 1 0-1.4l2.8-2.8a3 3 0 0 0-4.2-4.2L6.4 7.8a3 3 0 0 0 0 4.2 1 1 0 1 1-1.4 1.4 5 5 0 0 1 0-7L7.8 3.6a5 5 0 0 1 7 7l-2.8 2.8a1 1 0 0 1-1.4 0zm2.8-2.8a1 1 0 0 1 0 1.4l-2.8 2.8a3 3 0 1 0 4.2 4.2l2.8-2.8a3 3 0 0 0 0-4.2 1 1 0 1 1 1.4-1.4 5 5 0 0 1 0 7l-2.8 2.8a5 5 0 0 1-7-7l2.8-2.8a1 1 0 0 1 1.4 0z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 3.2V17h16V8.2l-8 5.3-8-5.3zM5.6 7l6.4 4.3L18.4 7H5.6z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3zm0 2a7 7 0 1 1-3.6 13l-.4-.2-2.3.6.6-2.2-.3-.4A7 7 0 0 1 12 5z"/></svg>',
};

/* ── renderers ─────────────────────────────────────────────────── */
function personCard(p, lang) {
  const g = GROUPS[p.group] || GROUPS.student;
  const photo = p.photo ? String(p.photo) : '';
  const search = [p.name, p.nameAr, L(p.headline, lang), p.college, p.years, L(p.bio, lang), (p.interests || []).join(' ')].join(' ').toLowerCase();
  let h = `<article class="pcard" data-group="${esc(p.group || '')}" data-search="${esc(search)}">`;
  h += `<div class="top"><div class="avatar">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" width="64" height="64">` : esc(initials(p.name))}</div><div>`;
  h += `<div class="nm" dir="auto">${esc(p.name)}</div>`;
  if (p.nameAr) h += `<div class="nm-ar">${esc(p.nameAr)}</div>`;
  h += `<span class="badge ${esc(p.group || '')}">${esc(g[lang === 'ar' ? 1 : 0])}</span></div></div>`;
  const hl = L(p.headline, lang); if (hl) h += `<p class="hl" dir="auto">${esc(hl)}</p>`;
  const meta = [p.college, p.years].filter(Boolean).join(' · '); if (meta) h += `<p class="meta" dir="auto">${esc(meta)}</p>`;
  const bio = L(p.bio, lang); if (bio) h += `<p class="bio" dir="auto">${esc(bio)}</p>`;
  if (p.interests && p.interests.length) h += `<div class="tags">${p.interests.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`;
  const links = []; const li = linkedinUrl(p.linkedin);
  if (li) links.push(`<a class="lnk in" href="${esc(li)}" target="_blank" rel="noopener">${ICON.link}LinkedIn</a>`);
  (p.emails || []).forEach((e) => { if (isEmail(e)) links.push(`<a class="lnk em" href="mailto:${esc(e)}">${ICON.mail}<span dir="ltr">${esc(e)}</span></a>`); });
  (p.phones || []).forEach((x) => { const d = waDigits(x); if (d) links.push(`<a class="lnk wa" href="https://wa.me/${d}" target="_blank" rel="noopener">${ICON.chat}<span dir="ltr">${esc(x)}</span></a>`); });
  if (links.length) h += `<div class="links">${links.join('')}</div>`;
  return h + '</article>';
}
function memberCard(m, lang) {
  const name = m.name || '', shown = name ? (lang === 'ar' && m.nameAr ? m.nameAr : name) : '';
  const r = roleOf(m.role); const role = r ? r[lang] || r.en : (m.role || '');
  const av = m.photo ? `<img src="${esc(m.photo)}" alt="" loading="lazy">` : (name ? esc(initials(name)) : SILHOUETTE);
  return `<div class="person"><div class="av">${av}</div><p class="nm">${shown ? esc(shown) : ph(S[lang].namePh)}</p><p class="rl">${esc(role)}${m.college ? ' · ' + esc(m.college) : ''}</p></div>`;
}
function committeeGrid(c, lang) {
  const groups = {}; const order = ['exec', 'events', 'media', 'other'];
  (c.members || []).forEach((m) => { const r = roleOf(m.role); const k = r ? (r.cat || 'other') : 'other'; (groups[k] = groups[k] || []).push(m); });
  return order.filter((k) => groups[k]).map((k) => `<div class="cat"><p class="lbl">${esc(CATS[k][lang === 'ar' ? 1 : 0])}</p><div class="grid4 cm-grid">${groups[k].map((m) => memberCard(m, lang)).join('')}</div></div>`).join('');
}
const currentTerm = () => committees.find((c) => c.current) || committees[0] || null;
function committeesHtml(lang) {
  const cur = currentTerm(); const s = S[lang]; let h = '';
  const startYear = (c) => { const m = /^(\d{4})/.exec(String(c.term || '')); return m ? +m[1] : 0; };
  const arDigits = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
  // The most recent verified committee carries a neutral heading: no "current" badge and no ordinal number,
  // because neither the current year's committee nor the historical sequence has been verified yet.
  if (cur) h += `<div class="term current"><div class="cur-head"><h3 class="disp">${s.termTitle(cur.term)}</h3></div>${committeeGrid(cur, lang)}</div>`;
  let decade = null;
  committees.filter((c) => c !== cur && (c.members || []).length).forEach((c) => {
    const n = c.members.length, dec = Math.floor(startYear(c) / 10) * 10;
    if (dec !== decade) { decade = dec; h += `<p class="lbl decade">${esc(lang === 'ar' ? arDigits(dec) + '–' + arDigits(dec + 9) : dec + 's')}</p>`; }
    h += `<div class="term"><details><summary><span class="yrs">${esc(c.term)}</span><span class="n">${esc(s.nMembers(n))}</span></summary>${committeeGrid(c, lang)}</details></div>`;
  });
  // one consolidated notice instead of an empty entry for every undocumented year
  h += `<div class="note archive-note"><b>${esc(s.archiveH)}:</b> <span>${s.archive(emailHtml(lang))}</span></div>`;
  return h;
}
/* ── page assembly ─────────────────────────────────────────────── */
const template = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');

function renderLang(lang) {
  const $ = cheerio.load(template);
  const s = S[lang];
  // language first, so settings placeholders inside Arabic strings are filled too
  if (lang === 'ar') {
    $('[data-ar]').each((i, el) => { $(el).html($(el).attr('data-ar')); $(el).removeAttr('data-ar'); });
    $('[data-ar-ph]').each((i, el) => { $(el).attr('placeholder', $(el).attr('data-ar-ph')); $(el).removeAttr('data-ar-ph'); });
    $('[data-ar-aria]').each((i, el) => { $(el).attr('aria-label', $(el).attr('data-ar-aria')); $(el).removeAttr('data-ar-aria'); });
    $('[data-ar-alt]').each((i, el) => { $(el).attr('alt', $(el).attr('data-ar-alt')); $(el).removeAttr('data-ar-alt'); });
    $('[data-en-only]').remove();
    $('html').attr({ lang: 'ar', dir: 'rtl' });
  } else {
    $('[data-en-only]').removeAttr('data-en-only');
    $('[data-ar]').removeAttr('data-ar'); $('[data-ar-ph]').removeAttr('data-ar-ph'); $('[data-ar-aria]').removeAttr('data-ar-aria'); $('[data-ar-alt]').removeAttr('data-ar-alt');
  }
  // data-driven regions
  $('#ev-index').html(EV.indexHtml(events, lang, urlFor, settings));
  $('#faq-page').html(FAQ.pageHtml(faq, lang, urlFor, settings));
  const ne = EV.nextEvent(events, lang);
  if (ne) { $('#next-title').html(`<a href="${urlFor('event:' + ne.e.slug, lang)}">${esc(ne.title)}</a>`); $('#next-sub').text(ne.sub); }
  else { $('#next-title').html(ph(s.nextPh)); $('#next-sub').html(ph(s.nextSubPh)); }
  const cur = currentTerm();
  $('#about-committee').html((cur ? `<p class="lbl term-label">${s.termTitle(cur.term)}</p>` + committeeGrid(cur, lang) : '') + `<p style="margin-top:6px"><a href="${urlFor('past-committees', lang)}">${esc(s.pastLink)}</a></p>`);
  $('#committees-list').html(committeesHtml(lang));
  $('#dir-grid').html(people.map((p) => personCard(p, lang)).join(''));
  if (!people.length) { $('#dir-empty').removeAttr('hidden').text(s.dirEmpty); $('#dir-tools').attr('hidden', ''); } else $('#dir-empty').attr('hidden', '').text('');
  const counts = { all: people.length }; Object.keys(GROUPS).forEach((g) => { counts[g] = people.filter((p) => p.group === g).length; });
  $('#dir-filters .cnt').each((i, el) => { const c = counts[$(el).attr('data-cnt')]; $(el).text(c ? String(c) : ''); });
  // settings-driven placeholders
  $('[data-price]').each((i, el) => {
    const k = $(el).attr('data-price'); const v = settings.fees && settings.fees[k];
    if (settings.fees && settings.fees.confirmed && v != null) $(el).removeClass('ph').text('£' + v); else $(el).text('[£' + (v == null ? '' : v) + ']');
  });
  $('[data-setting="email-link"]').each((i, el) => { if (settings.email) $(el).removeClass('ph').attr('href', 'mailto:' + settings.email).text(settings.email); });
  $('[data-setting="treasurer-link"]').each((i, el) => { const v = settings.treasurerEmail || settings.email; if (v) $(el).removeClass('ph').attr('href', 'mailto:' + v).text(v); });
  $('[data-setting="membership-link"]').each((i, el) => { const v = settings.membershipEmail || settings.email; if (v) $(el).removeClass('ph').attr('href', 'mailto:' + v).text(v); });
  $('[data-setting="founded"]').each((i, el) => { if (settings.founded) $(el).removeClass('ph').text(settings.founded); });
  $('[data-setting="subtitle"]').each((i, el) => { const v = settings.subtitle && settings.subtitle[lang]; if (v) $(el).text(v); });
  // settings for the script
  const site = { lang, email: settings.email || '', treasurerEmail: settings.treasurerEmail || '', membershipEmail: settings.membershipEmail || settings.email || '', fees: settings.fees || {}, payLinks: settings.payLinks || {}, bank: settings.bank || {}, ideas: settings.ideas || {}, privacyVersion: (settings.privacy && settings.privacy.version) || '2026-11', apiBase: settings.apiBase || '/api' };
  $('#site-settings').text(JSON.stringify(site).replace(/</g, '\\u003c'));
  // Cloudflare Web Analytics (cookie-free) — only when a token is set in settings
  if (settings.analytics && settings.analytics.cloudflareToken) {
    $('body').append(`<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: settings.analytics.cloudflareToken })}'></script>\n`);
  }
  return $.html();
}

function renderPage(langHtml, route, lang) {
  const $ = cheerio.load(langHtml);
  const s = S[lang];
  // keep one view
  const keep = route.view || route.id;
  $('.view').each((i, el) => { const id = $(el).attr('id').replace('v-', ''); if (id === keep) $(el).removeClass('view on').addClass('page'); else $(el).remove(); });
  if (route.event) $('#event-detail').html(EV.detailHtml(route.event, lang, urlFor, settings));
  if (keep !== 'events' && keep !== 'event') $('script[src="/js/events.js"]').remove();
  // link rewriting: #route → /route/, in-page anchors of other views → that page
  const viewIds = {}; // not needed after removal; map known ids
  const idToRoute = { 'join-form-band': 'join', 'join-form': 'join', profile: 'community', 'join-member': 'join', 'join-volunteer': 'join' };
  $('a[href^="#"]').each((i, el) => {
    const h = $(el).attr('href').slice(1);
    const r = ROUTES.find((x) => x.id === h);
    if (r) { $(el).attr('href', urlFor(r.id, lang)); return; }
    if (h === 'main') return;
    if (idToRoute[h] && idToRoute[h] !== route.id) $(el).attr('href', urlFor(idToRoute[h], lang) + '#' + h);
  });
  $('nav.main a[data-r], nav.tabbar a[data-r]').each((i, el) => {
    const on = $(el).attr('data-r') === (route.nav || route.id);
    $(el).toggleClass('on', on);
    if (on) $(el).attr('aria-current', 'page'); else $(el).removeAttr('aria-current');
  });
  // language switch
  $('#en').attr('href', urlFor(route.id, 'en')).toggleClass('on', lang === 'en');
  $('#ar').attr('href', urlFor(route.id, 'ar')).toggleClass('on', lang === 'ar');
  // head
  const siteName = settings.siteName[lang] || settings.siteName.en;
  const title = route.id === 'home' ? siteName : `${route.title[lang]} · ${siteName}`;
  $('title').text(title);
  $('meta[name="description"]').attr('content', route.desc[lang]);
  const canonical = BASE + urlFor(route.id, lang);
  const meta = [
    `<link rel="canonical" href="${canonical}">`,
    `<link rel="alternate" hreflang="en" href="${BASE + urlFor(route.id, 'en')}">`,
    `<link rel="alternate" hreflang="ar" href="${BASE + urlFor(route.id, 'ar')}">`,
    `<link rel="alternate" hreflang="x-default" href="${BASE + urlFor(route.id, 'en')}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(siteName)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(route.desc[lang])}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${BASE}${route.og || '/assets/og.png'}">`,
    route.event ? `<meta property="og:image:alt" content="${esc(L(route.event.image.alt, lang))}">` : '',
    `<meta property="og:locale" content="${lang === 'ar' ? 'ar_SA' : 'en_GB'}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="theme-color" content="#002147">`,
  ].join('\n');
  $('head').html($('head').html().replace('<!--PAGEMETA-->', meta.replace(/\n\n+/g, '\n') + (route.event ? '\n' + EV.jsonLd(route.event, lang, BASE, urlFor) : '')));
  $('body').attr('data-page', route.id);
  return '<!DOCTYPE html>\n' + $.html().replace(/^<!DOCTYPE html>\s*/i, '');
}

/* ── write ─────────────────────────────────────────────────────── */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const copyDir = (from, to) => { if (!fs.existsSync(from)) return; fs.mkdirSync(to, { recursive: true }); for (const f of fs.readdirSync(from)) { const a = path.join(from, f), b = path.join(to, f); if (fs.statSync(a).isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b); } };
copyDir(path.join(SRC, 'css'), path.join(DIST, 'css'));
copyDir(path.join(SRC, 'js'), path.join(DIST, 'js'));
copyDir(path.join(SRC, 'assets'), path.join(DIST, 'assets'));
copyDir(path.join(ROOT, 'admin'), path.join(DIST, 'admin'));
copyDir(path.join(SRC, 'apps'), path.join(DIST, ''));
for (const e of events) { const dir = path.join(DIST, 'events', e.slug); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'event.ics'), EV.icsFor(e, BASE)); }
if (fs.existsSync(path.join(SRC, 'assets/favicon.ico'))) fs.copyFileSync(path.join(SRC, 'assets/favicon.ico'), path.join(DIST, 'favicon.ico'));
const urls = [];
for (const lang of ['en', 'ar']) {
  const langHtml = renderLang(lang);
  for (const route of ROUTES) {
    const html = renderPage(langHtml, route, lang);
    const out = path.join(DIST, urlFor(route.id, lang).replace(/^\//, ''), 'index.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    urls.push(BASE + urlFor(route.id, lang));
  }
}
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n') + '\n</urlset>\n');
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${BASE}/sitemap.xml\n`);
/* Other society domains forward to the primary domain, keeping the path (oxsss.org/join/ → stemmania.ai/join/). Host rules go first. */
const PRIMARY = (settings.domain || '').replace(/\/$/, '');
const OLD_HOSTS = ['oxsss.org', 'www.oxsss.org', 'ousss.org', 'www.ousss.org'];
fs.writeFileSync(path.join(DIST, '_redirects'), [
  ...(PRIMARY ? OLD_HOSTS.flatMap((h) => [`https://${h}/*  ${PRIMARY}/:splat  301!`, `http://${h}/*  ${PRIMARY}/:splat  301!`]) : []),
  '/committee  /admin/  302', '/ar  /ar/  301',
  '/ideas/*  /ideas/index.html  200', '/ar/ideas/*  /ar/ideas/index.html  200',
  '/account/*  /account/index.html  200', '/ar/account/*  /account/index.html  200',
  '/t/*  /t/index.html  200', '/ar/t/*  /t/index.html  200',
  '/admin/events/*  /admin/events/index.html  200', '/ar/admin/events/*  /admin/events/index.html  200', '',
].join('\n'));
/* Cache-busting: every page asks for /js/x.js?v=<content hash> and /css/x.css?v=<hash>, so a new deploy
   always reaches browsers that visited before (a stale script against new markup breaks forms). */
{
  const crypto = require('crypto');
  const hashes = {};
  const hashOf = (rel) => {
    if (!(rel in hashes)) { const f = path.join(DIST, rel); hashes[rel] = fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 10) : null; }
    return hashes[rel];
  };
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      const a = path.join(dir, f);
      if (fs.statSync(a).isDirectory()) { walk(a); continue; }
      if (!f.endsWith('.html')) continue;
      const html = fs.readFileSync(a, 'utf8');
      const out = html.replace(/(\s(?:src|href)=")\/((?:js|css)\/[\w.-]+\.(?:js|css))(?:\?v=[\w]+)?"/g, (m, attr, rel) => { const h = hashOf(rel); return h ? `${attr}/${rel}?v=${h}"` : m; });
      if (out !== html) fs.writeFileSync(a, out);
    }
  };
  walk(DIST);
}
fs.writeFileSync(path.join(DIST, '_headers'), [
  '/*', '  X-Frame-Options: DENY', '  X-Content-Type-Options: nosniff', '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Permissions-Policy: camera=(self), microphone=(), geolocation=()',
  '/assets/*', '  Cache-Control: public, max-age=31536000, immutable',
  // scripts and styles: browsers re-check with the server on every visit (cheap 304 when unchanged)
  '/css/*', '  Cache-Control: public, max-age=0, must-revalidate', '/js/*', '  Cache-Control: public, max-age=0, must-revalidate', '',
].join('\n'));
require('./gen-content').generate();
console.log(`built ${urls.length} pages → dist/  (people: ${people.length}, events: ${events.length}, committees: ${committees.length})`);

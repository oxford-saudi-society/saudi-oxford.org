#!/usr/bin/env node
/* Oxford Saudi Society — static site build.
   Reads src/template.html + src/content/*, writes dist/ with one page per route in English and Arabic.
   No framework: cheerio for HTML, plain Node. Run: npm run build */
'use strict';
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

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
const events = readDir(path.join(SRC, 'content/events')).filter((e) => e.published !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
const people = readDir(path.join(SRC, 'content/people')).filter((p) => p.name && p.published !== false).sort((a, b) => String(a.name).localeCompare(String(b.name)));
const BASE = (settings.domain || 'https://saudi-oxford.org').replace(/\/$/, '');

/* ── routes ────────────────────────────────────────────────────── */
const ROUTES = [
  { id: 'home', path: '', title: { en: 'Oxford Saudi Society', ar: 'الجمعية السعودية في أكسفورد' },
    desc: { en: 'A home for Saudi culture in the heart of Oxford. Events, membership, volunteering and community for Saudi students, researchers, alumni and friends at the University of Oxford.',
            ar: 'بيت للثقافة السعودية في قلب أكسفورد. فعاليات وعضوية وتطوّع ومجتمع للطلبة والباحثين والخريجين والأصدقاء السعوديين في جامعة أكسفورد.' } },
  { id: 'about', path: 'about', title: { en: 'About', ar: 'عن الجمعية' }, desc: { en: 'Who we are, what we stand for and the committee behind the Oxford Saudi Society.', ar: 'من نحن وما نؤمن به واللجنة التي تقف خلف الجمعية السعودية في أكسفورد.' } },
  { id: 'events', path: 'events', title: { en: 'Events', ar: 'الفعاليات' }, desc: { en: 'What is on this term at the Oxford Saudi Society — cultural evenings, talks, socials and the annual dinner.', ar: 'ما الذي يجري هذا الفصل في الجمعية السعودية في أكسفورد — أمسيات ثقافية وندوات ولقاءات والعشاء السنوي.' } },
  { id: 'community', path: 'community', title: { en: 'Community', ar: 'مجتمعنا' }, desc: { en: 'Students, alumni and friends of the Oxford Saudi Society — a public directory of people who have chosen to be listed.', ar: 'طلبة وخريجون وأصدقاء الجمعية السعودية في أكسفورد — دليل عام لمن اختار الظهور فيه.' } },
  { id: 'ideas', path: 'ideas', title: { en: 'Ideas', ar: 'أفكار' }, desc: { en: 'Suggest, vote on and discuss ideas for the Oxford Saudi Society — the committee reviews the board every term.', ar: 'اقترح أفكاراً للجمعية السعودية في أكسفورد وصوّت عليها وناقشها — تراجع اللجنة اللوحة كل فصل دراسي.' } },
  { id: 'join', path: 'join', title: { en: 'Join', ar: 'انضم إلينا' }, desc: { en: 'Become a member of the Oxford Saudi Society. Free for Saudi students; a small annual fee for everyone else.', ar: 'كن عضواً في الجمعية السعودية في أكسفورد. مجاناً للطلبة السعوديين ورسم سنوي بسيط لغيرهم.' } },
  { id: 'faq', path: 'faq', title: { en: 'FAQ', ar: 'الأسئلة الشائعة' }, desc: { en: 'Answers to the questions we are asked most about membership, events and the Society.', ar: 'إجابات عن أكثر الأسئلة التي تصلنا حول العضوية والفعاليات والجمعية.' } },
  { id: 'privacy', path: 'privacy', title: { en: 'Privacy notice', ar: 'إشعار الخصوصية' }, desc: { en: 'How the Oxford Saudi Society handles your information.', ar: 'كيف تتعامل الجمعية السعودية في أكسفورد مع بياناتك.' } },
  { id: 'terms', path: 'terms', title: { en: 'Terms of use', ar: 'شروط الاستخدام' }, desc: { en: 'Terms of use for the Oxford Saudi Society website.', ar: 'شروط استخدام موقع الجمعية السعودية في أكسفورد.' } },
  { id: 'past-committees', path: 'committees', title: { en: 'Committees', ar: 'اللجان' }, desc: { en: 'The people who have led the Oxford Saudi Society, year by year.', ar: 'من قاد الجمعية السعودية في أكسفورد عبر السنين.' } },
];
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
  en: { namePh: '[Name]', curTerm: 'Current committee', nMembers: (n) => `${n} members`, tracing: 'Records being traced',
        trace: (email) => `We have not yet traced this year’s committee. If you served on it, email ${email} and we will add you.`,
        pastLink: 'See past committees →', dirEmpty: 'Profiles are being added — check back soon.', book: 'Book a place',
        weekPh: '[Week]', datePh: '[Date]', venuePh: '[Venue]', nextPh: '[Event name]', nextSubPh: '[Date and time] · [Venue]', emailPh: '[hello@address]' },
  ar: { namePh: '[الاسم]', curTerm: 'اللجنة الحالية', nMembers: (n) => `${n} أعضاء`, tracing: 'السجلات قيد التتبع',
        trace: (email) => `لم نتتبع لجنة هذه السنة بعد. إن كنت عضواً فيها، راسلنا على ${email} لنضيفك.`,
        pastLink: 'اللجان السابقة ←', dirEmpty: 'تجري إضافة الملفات — عد قريباً.', book: 'احجز مقعداً',
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
  const founded = parseInt(settings.founded, 10) || 0;
  const startYear = (c) => { const m = /^(\d{4})/.exec(String(c.term || '')); return m ? +m[1] : 0; };
  const termNo = (c) => { const y = startYear(c); return (y && founded && y >= founded) ? y - founded + 1 : 0; };
  const arDigits = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
  const ordinalEn = (n) => { const sfx = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (sfx[(v - 20) % 10] || sfx[v] || sfx[0]); };
  const noteOf = (c) => { const k = termNo(c); if (!k) return ''; return `<p class="term-note">${esc(lang === 'ar' ? 'اللجنة الإدارية رقم ' + arDigits(k) : ordinalEn(k) + ' committee')}</p>`; };
  if (cur) h += `<div class="term current"><div class="cur-head"><h3 class="disp">${esc(cur.term)}</h3><span class="badge">${esc(s.curTerm)}</span></div>${noteOf(cur)}${committeeGrid(cur, lang)}</div>`;
  let decade = null;
  committees.filter((c) => c !== cur).forEach((c) => {
    const n = (c.members || []).length, dec = Math.floor(startYear(c) / 10) * 10;
    if (dec !== decade) { decade = dec; h += `<p class="lbl decade">${esc(lang === 'ar' ? arDigits(dec) + 'ات' : dec + 's')}</p>`; }
    h += `<div class="term"><details><summary><span class="yrs">${esc(c.term)}</span><span class="n">${esc(n ? s.nMembers(n) : s.tracing)}</span></summary>`;
    h += noteOf(c) + (n ? committeeGrid(c, lang) : `<p class="trace">${s.trace(emailHtml(lang))}</p>`);
    h += '</details></div>';
  });
  return h;
}
function eventsHtml(lang) {
  const s = S[lang];
  return events.map((e) => {
    const tag = TAGS[e.tag] || null;
    const when = `<span class="${e.week ? '' : 'ph'}">${esc(e.week || s.weekPh)}</span><span class="${e.date ? '' : 'ph'}">${esc(e.date || s.datePh)}${e.time ? ' · ' + esc(e.time) : ''}</span>`;
    const venue = e.venue ? `<p class="meta">${esc(e.venue)}</p>` : '';
    const book = safeHttp(e.bookingUrl) ? `<a class="btn btn-s" style="padding:9px 16px;font-size:13px;margin-top:10px" href="${esc(safeHttp(e.bookingUrl))}" target="_blank" rel="noopener">${esc(s.book)}</a>` : '';
    return `<div class="ev"><div class="when">${when}</div><div><h3>${esc(L(e.title, lang))}</h3><p>${esc(L(e.description, lang))}</p>${venue}${book}</div><div>${tag ? `<span class="tag">${esc(tag[lang === 'ar' ? 1 : 0])}</span>` : ''}</div></div>`;
  }).join('');
}
function nextEvent(lang) {
  const s = S[lang]; const e = events.find((x) => x.date) || null;
  if (!e) return { title: ph(s.nextPh), sub: ph(s.nextSubPh) };
  return { title: esc(L(e.title, lang)), sub: esc([[e.date, e.time].filter(Boolean).join(' '), e.venue].filter(Boolean).join(' · ')) };
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
    $('html').attr({ lang: 'ar', dir: 'rtl' });
  } else {
    $('[data-ar]').removeAttr('data-ar'); $('[data-ar-ph]').removeAttr('data-ar-ph');
  }
  // data-driven regions
  $('#events-list').html(eventsHtml(lang));
  const ne = nextEvent(lang); $('#next-title').html(ne.title); $('#next-sub').html(ne.sub);
  const cur = currentTerm();
  $('#about-committee').html((cur ? committeeGrid(cur, lang) : '') + `<p style="margin-top:6px"><a href="${urlFor('past-committees', lang)}">${esc(s.pastLink)}</a></p>`);
  $('#committees-list').html(committeesHtml(lang));
  $('#dir-grid').html(people.map((p) => personCard(p, lang)).join(''));
  if (!people.length) $('#dir-empty').removeAttr('hidden').text(s.dirEmpty); else $('#dir-empty').attr('hidden', '').text('');
  const counts = { all: people.length }; Object.keys(GROUPS).forEach((g) => { counts[g] = people.filter((p) => p.group === g).length; });
  $('#dir-filters .cnt').each((i, el) => { const c = counts[$(el).attr('data-cnt')]; $(el).text(c ? String(c) : ''); });
  if (settings.showSupporters) $('#supporters').removeAttr('hidden');
  // settings-driven placeholders
  $('[data-price]').each((i, el) => {
    const k = $(el).attr('data-price'); const v = settings.fees && settings.fees[k];
    if (settings.fees && settings.fees.confirmed && v != null) $(el).removeClass('ph').text('£' + v); else $(el).text('[£' + (v == null ? '' : v) + ']');
  });
  $('[data-setting="email-link"]').each((i, el) => { if (settings.email) $(el).removeClass('ph').attr('href', 'mailto:' + settings.email).text(settings.email); });
  $('[data-setting="founded"]').each((i, el) => { if (settings.founded) $(el).removeClass('ph').text(settings.founded); });
  $('[data-setting="retention"]').each((i, el) => { if (settings.privacy && settings.privacy.retention) $(el).removeClass('ph').text(settings.privacy.retention); });
  $('[data-setting="hosting"]').each((i, el) => { if (settings.privacy && settings.privacy.hosting) $(el).removeClass('ph').text(settings.privacy.hosting); });
  $('[data-setting="instagram"]').each((i, el) => {
    const ig = settings.social && settings.social.instagram;
    if (ig) { const handle = ig.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '').replace(/^@/, ''); $(el).attr('href', 'https://instagram.com/' + handle).text('Instagram @' + handle); }
  });
  // settings for the script
  const site = { lang, email: settings.email || '', treasurerEmail: settings.treasurerEmail || '', fees: settings.fees || {}, payLinks: settings.payLinks || {}, bank: settings.bank || {}, ideas: settings.ideas || {}, formEndpoint: '/' };
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
  $('.view').each((i, el) => { const id = $(el).attr('id').replace('v-', ''); if (id === route.id) $(el).removeClass('view on').addClass('page'); else $(el).remove(); });
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
    const on = $(el).attr('data-r') === route.id;
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
    `<meta property="og:image" content="${BASE}/assets/og.png">`,
    `<meta property="og:locale" content="${lang === 'ar' ? 'ar_SA' : 'en_GB'}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="theme-color" content="#002147">`,
  ].join('\n');
  $('head').html($('head').html().replace('<!--PAGEMETA-->', meta));
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
fs.writeFileSync(path.join(DIST, '_redirects'), '/committee  /admin/  302\n/ar  /ar/  301\n/ideas/*  /ideas/index.html  200\n/ar/ideas/*  /ar/ideas/index.html  200\n');
fs.writeFileSync(path.join(DIST, '_headers'), [
  '/*', '  X-Frame-Options: DENY', '  X-Content-Type-Options: nosniff', '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
  '/assets/*', '  Cache-Control: public, max-age=31536000, immutable', '/css/*', '  Cache-Control: public, max-age=86400', '/js/*', '  Cache-Control: public, max-age=86400', '',
].join('\n'));
console.log(`built ${urls.length} pages → dist/  (people: ${people.length}, events: ${events.length}, committees: ${committees.length})`);

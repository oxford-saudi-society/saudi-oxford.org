'use strict';
/* FAQ: renders src/content/faq.json as one page per language — topic navigation, search box,
   accordion questions with official references, deep links (#question-id). */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L = (o, lang) => (o && typeof o === 'object') ? (o[lang] || o.en || '') : (o || '');

function load() {
  const p = path.join(SRC, 'content/faq.json');
  if (!fs.existsSync(p)) return { sections: [] };
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  d.sections = (d.sections || []).filter((s) => s && s.items && s.items.length);
  return d;
}

/* Minimal inline markup in answers: [text](url) links and paragraph breaks. Everything else is escaped. */
function inline(text) {
  const parts = String(text || '').split(/\n{2,}/);
  return parts.map((p) => '<p>' + esc(p).replace(/\[([^\]]+)\]\((#[a-z0-9-]+|https?:\/\/[^\s)]+)\)/g, (m, t, u) => `<a href="${u}"${u.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`) + '</p>').join('');
}
const searchText = (it) => (L(it.q, 'en') + ' ' + L(it.q, 'ar') + ' ' + L(it.a, 'en') + ' ' + L(it.a, 'ar')).toLowerCase();

const UI = {
  en: { eyebrow: 'Help & guidance', h1: 'Frequently asked questions', alt: 'الأسئلة الشائعة', search: 'Search the questions', ph: 'Search, e.g. Safir, housing, GP…', topics: 'Topics', expand: 'Expand all', collapse: 'Collapse all', count: (n) => `${n} question${n === 1 ? '' : 's'}`, refs: 'Official references', none: 'No questions match your search.', clear: 'Clear search', reviewed: 'Last reviewed', note: 'Procedures change; the linked providers are the authority. Tell us if something is out of date.', askH: 'Still have a question?', askP: 'Email the committee or raise it on the ideas board; useful answers are added here.', email: 'Email the committee', ideas: 'Ideas board', copy: 'Copy link', copied: 'Copied' },
  ar: { eyebrow: 'المساعدة والإرشاد', h1: 'الأسئلة الشائعة', alt: 'Frequently asked questions', search: 'ابحث في الأسئلة', ph: 'ابحث: سفير، السكن، طبيب الأسرة…', topics: 'الموضوعات', expand: 'فتح الكل', collapse: 'طيّ الكل', count: (n) => `${new Intl.NumberFormat('ar-SA-u-nu-arab').format(n)} ${n === 1 ? 'سؤال' : n === 2 ? 'سؤالان' : n <= 10 ? 'أسئلة' : 'سؤالًا'}`, refs: 'روابط رسمية', none: 'لا توجد أسئلة مطابقة لبحثك.', clear: 'مسح البحث', reviewed: 'آخر مراجعة', note: 'تتغيّر الإجراءات؛ والمرجع هو المواقع الرسمية المرتبطة. أخبرنا إن وجدت معلومة قديمة.', askH: 'لديك سؤال آخر؟', askP: 'راسل اللجنة أو اطرحه في لوحة الأفكار، وتُضاف الإجابات المفيدة هنا.', email: 'راسل اللجنة', ideas: 'لوحة الأفكار', copy: 'نسخ الرابط', copied: 'تم النسخ' },
};

function pageHtml(data, lang, urlFor, settings) {
  const u = UI[lang];
  const secs = data.sections;
  const total = secs.reduce((n, s) => n + s.items.length, 0);
  const reviewed = data.updated ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-arab' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(new Date(data.updated + 'T12:00:00Z')) : '';
  const hero = `
  <section class="band tint head faq-head">
    <div class="wrap">
      <div class="sec-head">
        <p class="eyebrow">${esc(u.eyebrow)}</p>
        <h2>${esc(u.h1)}</h2>
        <p class="h1-alt" lang="${lang === 'ar' ? 'en' : 'ar'}" dir="${lang === 'ar' ? 'ltr' : 'rtl'}">${esc(u.alt)}</p>
        <hr class="gold-rule">
        <p class="lede">${esc(L(data.intro, lang))}</p>
      </div>
      <div class="faq-tools" role="search">
        <div class="f faq-q"><label class="lbl" for="faq-q">${esc(u.search)}</label><input id="faq-q" type="search" autocomplete="off" placeholder="${esc(u.ph)}"></div>
        <p class="faq-count" id="faq-count" aria-live="polite">${esc(u.count(total))}</p>
        <button type="button" class="lnk faq-toggle" id="faq-toggle" data-expand="${esc(u.expand)}" data-collapse="${esc(u.collapse)}" aria-pressed="false">${esc(u.expand)}</button>
      </div>
      <nav class="faq-nav" aria-label="${esc(u.topics)}"><ul>${secs.map((s) => `<li><a class="chip" href="#faq-${esc(s.id)}" data-sec="${esc(s.id)}">${esc(L(s.title, lang))}<span class="n">${esc(new Intl.NumberFormat(lang === 'ar' ? 'ar-SA-u-nu-arab' : 'en-GB').format(s.items.length))}</span></a></li>`).join('')}</ul></nav>
    </div>
  </section>`;
  const body = `
  <section class="band faq-body">
    <div class="wrap">
      ${secs.map((s) => `
      <section class="faq-sec" id="faq-${esc(s.id)}" data-sec="${esc(s.id)}">
        <h3 class="faq-sec-title"><span>${esc(L(s.title, lang))}</span><small class="faq-sec-n" data-n="${s.items.length}">${esc(u.count(s.items.length))}</small></h3>
        <div class="faq-list">
          ${s.items.map((it) => `
          <details class="faq-item" id="${esc(it.id)}" data-search="${esc(searchText(it))}">
            <summary><span class="faq-qt">${esc(L(it.q, lang))}</span></summary>
            <div class="faq-a">${inline(L(it.a, lang))}${it.refs && it.refs.length ? `<p class="faq-refs"><span class="faq-refs-l">${esc(u.refs)}:</span> ${it.refs.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener" dir="ltr">${esc(r.label)}</a>`).join(' <span class="dot">·</span> ')}</p>` : ''}<button type="button" class="lnk faq-copy" data-copied="${esc(u.copied)}">${esc(u.copy)}</button></div>
          </details>`).join('')}
        </div>
      </section>`).join('')}
      <div class="dir-empty" id="faq-empty" hidden><p>${esc(u.none)}</p><button type="button" class="btn btn-s" id="faq-clear">${esc(u.clear)}</button></div>
      <div class="faq-foot">
        <div class="card tinted faq-ask"><h3>${esc(u.askH)}</h3><p>${esc(u.askP)}</p><div class="rowc">${settings.email ? `<a class="btn btn-p" href="mailto:${esc(settings.email)}">${esc(u.email)}</a>` : ''}<a class="btn btn-s" href="${urlFor('ideas', lang)}">${esc(u.ideas)}</a></div></div>
        <p class="faq-note">${reviewed ? `<b>${esc(u.reviewed)}:</b> ${esc(reviewed)}. ` : ''}${esc(u.note)}</p>
      </div>
    </div>
  </section>`;
  return hero + body;
}

module.exports = { load, pageHtml, inline, UI };

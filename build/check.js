#!/usr/bin/env node
/* Static checks over dist/: links resolve, every page is complete, nothing untranslated. Run after `npm run build`. */
'use strict';
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const DIST = path.join(__dirname, '..', 'dist');

const pages = [];
(function walk(dir) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f === 'index.html' && !p.includes(path.sep + 'admin' + path.sep) && !/[\\/](account|t)[\\/]index\.html$/.test(p)) pages.push(p); } })(DIST); // app shells (/account, /t, /admin) render client-side

const fails = [];
const fail = (page, msg) => fails.push(`${path.relative(DIST, page)}: ${msg}`);
const exists = (url) => {
  const clean = url.split('#')[0].split('?')[0];
  if (!clean.startsWith('/')) return true;
  const fp = path.join(DIST, clean);
  return fs.existsSync(fp) && (fs.statSync(fp).isFile() || fs.existsSync(path.join(fp, 'index.html')));
};
let checks = 0;
for (const page of pages) {
  const $ = cheerio.load(fs.readFileSync(page, 'utf8'));
  const rel = path.relative(DIST, page).replace(/index\.html$/, '');
  const isAr = rel.startsWith('ar' + path.sep) || rel === 'ar';
  const c = (ok, msg) => { checks++; if (!ok) fail(page, msg); };
  c($('.page').length === 1, `expected one .page, found ${$('.page').length}`);
  c($('.view').length === 0, 'stray .view left in page');
  c($('[data-ar]').length === 0 && $('[data-ar-ph]').length === 0, 'untranslated data-ar attributes left');
  c(($('html').attr('lang') === 'ar') === isAr, `html lang ${$('html').attr('lang')} does not match path`);
  c(($('html').attr('dir') === 'rtl') === isAr, 'html dir does not match language');
  c($('title').text().trim().length > 0, 'missing <title>');
  c($('link[rel="canonical"]').length === 1, 'missing canonical');
  c($('link[rel="alternate"][hreflang]').length === 3, 'expected 3 hreflang links');
  c($('meta[property="og:image"]').length === 1 && exists($('meta[property="og:image"]').attr('content').replace(/^https?:\/\/[^/]+/, '')), 'og:image missing or not built');
  const ids = new Set(); $('[id]').each((i, el) => ids.add($(el).attr('id')));
  $('a[href]').each((i, el) => {
    const h = $(el).attr('href');
    if (h.startsWith('#')) { c(ids.has(h.slice(1)) || h === '#', `broken in-page anchor ${h}`); return; }
    if (h.startsWith('/')) { c(exists(h), `broken link ${h}`); const frag = h.split('#')[1]; if (frag) { /* target page must contain the id */ const target = path.join(DIST, h.split('#')[0], 'index.html'); if (fs.existsSync(target)) c(fs.readFileSync(target, 'utf8').includes(`id="${frag}"`), `anchor #${frag} missing on ${h.split('#')[0]}`); } return; }
    if (/^https?:/.test(h)) { c($(el).attr('target') === '_blank' && /noopener/.test($(el).attr('rel') || ''), `external link without noopener: ${h}`); }
  });
  $('img[src]').each((i, el) => { const s = $(el).attr('src'); if (s.startsWith('/')) c(exists(s), `missing image ${s}`); });
  $('link[rel="stylesheet"][href^="/"], script[src^="/"]').each((i, el) => { const s = $(el).attr('href') || $(el).attr('src'); c(exists(s), `missing asset ${s}`); });
  const text = $('main').text();
  c(!/undefined|\[object|NaN\b/.test(text), 'suspicious text (undefined/[object/NaN)');
  const main = ['', 'about', 'events', 'community', 'ideas', 'join', 'faq'];
  let route = rel.replace(/^ar[\\/]?/, '').replace(/[\\/]$/, '');
  const isEventPage = /^events[\\/].+/.test(route);
  if (isEventPage) route = 'events'; // event pages highlight Events
  if (main.includes(route)) c($('nav.main a[data-r].on').length === 1, `nav highlight count ${$('nav.main a[data-r].on').length}`);
  const tabs = ['', 'events', 'community', 'ideas', 'join'];
  c($('nav.tabbar a[data-r]').length === 5, 'tab bar should have five tabs');
  c($('nav.tabbar a[data-r].on').length === (tabs.includes(route) ? 1 : 0), `tab highlight count ${$('nav.tabbar a[data-r].on').length}`);
  if (isEventPage) {
    c($('.ev-detail').length === 1 && $('.ev-art img[alt]').length === 1, 'event page needs one detail block with alt text');
    c($('#reg-cta').length === 1 && $('#reg-dialog').length === 1, 'event page needs the registration control and dialog');
    c(!/Your seat is confirmed|seat is confirmed/i.test(text), 'event page must not claim a confirmed seat');
    if ($('.ev-detail').attr('data-status') === 'proposed') { const all = $('#event-detail').text(); const n = (all.match(/Proposed — Not Confirmed|مبدئي — بانتظار التأكيد/g) || []).length;
      c(/Proposed — Not Confirmed|مبدئي — بانتظار التأكيد/.test($('#ev-banner').text()), 'proposed event must say so in its banner');
      c(n === 1, 'the proposed notice appears once per event page, not ' + n + ' times');
      c($('#event-detail .etags li[data-k="booking"]').length === 0, 'an unconfirmed event must not say booking is required');
      c(!/Concept artwork|صورة تصوّرية/.test(all), 'no concept-artwork label'); }
    c($('a[href$="/event.ics"]').length === 1 && exists($('a[href$="/event.ics"]').attr('href')), 'event page needs its .ics file');
  }
  if (route === 'events' && !isEventPage) {
    c($('.evc').length === 11, `events index should list 11 events, found ${$('.evc').length}`);
    c($('.evc-img img[alt]').length === 11 && $('.evc-img img').toArray().every((el) => $(el).attr('width') === $(el).attr('height')), 'event cards need square images with alt text');
    c($('#ev-q').length === 1 && $('.ev-chips .chip').length === 4 && $('#ev-clear').length === 1, 'events filters incomplete');
  }
  if (route === 'faq') {
    const faqData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src/content/faq.json'), 'utf8'));
    const want = faqData.sections.reduce((n, sec) => n + sec.items.length, 0);
    c($('.faq-sec').length === faqData.sections.length, `faq sections ${$('.faq-sec').length} ≠ ${faqData.sections.length}`);
    c($('.faq-item').length === want, `faq questions ${$('.faq-item').length} ≠ ${want}`);
    c($('.faq-item').toArray().every((el) => $(el).find('summary .faq-qt').text().trim() && $(el).find('.faq-a p').first().text().trim()), 'every faq item needs a question and an answer');
    const ids = $('.faq-item').toArray().map((el) => $(el).attr('id'));
    c(new Set(ids).size === ids.length && ids.every(Boolean), 'faq ids must be unique');
    c($('.faq-refs a').toArray().every((el) => /^https:\/\//.test($(el).attr('href')) && $(el).attr('rel') === 'noopener'), 'faq references must be https links opening safely');
    c($('.faq-nav .chip').length === faqData.sections.length && $('.faq-nav .chip').toArray().every((el) => $($(el).attr('href')).length === 1), 'faq topic chips must point at existing sections');
    c($('#faq-q').length === 1 && $('#faq-toggle').length === 1 && $('#faq-empty').length === 1, 'faq tools incomplete');
    const answers = $('.faq-a p:not(.faq-refs)').text();
    // whole sentences in the wrong language are a mix-up; quoted product names and Safir menu labels are not
    if (isAr) c(!/(?:[A-Za-z][a-z]+\s+){8,}/.test(answers), 'arabic faq must not contain english answers');
    else c(!/(?:[\u0600-\u06FF]+\s+){8,}/.test(answers), 'english faq must not contain arabic answers');
  }
  c($('#burger').length === 0 && $('nav.main .n').length === 0, 'old menu markup left behind');
  if (route === 'join') {
    c($('form#join-form[data-api="/api/membership/apply"]').length === 1, 'join form must submit to the membership API');
    c($('form#join-form[data-netlify]').length === 0, 'join form must not also be a Netlify form');
    c($('form#join-form input[name="website"]').length === 1, 'honeypot missing');
  }
  c($('#en').attr('href') && $('#ar').attr('href') && exists($('#en').attr('href')) && exists($('#ar').attr('href')), 'language switch links broken');
}
for (const f of ['sitemap.xml', 'robots.txt', '_redirects', '_headers', 'favicon.ico', 'admin/index.html', 'admin/config.yml']) { checks++; if (!fs.existsSync(path.join(DIST, f))) fails.push(`missing ${f}`); }
// every page (app shells included) must load scripts/styles by content-versioned URL, matching the file shipped
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (!f.endsWith('.html')) continue;
    const $ = cheerio.load(fs.readFileSync(p, 'utf8'));
    $('script[src^="/js/"], link[rel="stylesheet"][href^="/css/"]').each((i, el) => {
      const u = $(el).attr('src') || $(el).attr('href'); checks++;
      const m = /^(\/(?:js|css)\/[\w.-]+)\?v=([0-9a-f]{10})$/.exec(u);
      if (!m) { fails.push(`${path.relative(DIST, p)}: ${u} is not cache-busted`); return; }
      const want = require('crypto').createHash('sha256').update(fs.readFileSync(path.join(DIST, m[1]))).digest('hex').slice(0, 10);
      if (want !== m[2]) fails.push(`${path.relative(DIST, p)}: ${u} version does not match the file`);
    });
  }
})(DIST);
for (const h of ['oxsss.org', 'ousss.org']) { checks++; if (!new RegExp('^https://' + h.replace('.', '\\.') + '/\\*\\s+https://\\S+/:splat\\s+301!$', 'm').test(fs.readFileSync(path.join(DIST, '_redirects'), 'utf8'))) fails.push(`_redirects: ${h} must forward to the primary domain`); }
checks++; if (!/\/js\/\*\n\s+Cache-Control: public, max-age=0, must-revalidate/.test(fs.readFileSync(path.join(DIST, '_headers'), 'utf8'))) fails.push('_headers: /js/* must revalidate on every visit');
console.log(`${pages.length} pages, ${checks} checks, ${fails.length} failures`);
fails.forEach((f) => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);

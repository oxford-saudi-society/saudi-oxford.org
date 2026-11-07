#!/usr/bin/env node
/* Static checks over dist/: links resolve, every page is complete, nothing untranslated. Run after `npm run build`. */
'use strict';
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const DIST = path.join(__dirname, '..', 'dist');

const pages = [];
(function walk(dir) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f === 'index.html' && !p.includes(path.sep + 'admin' + path.sep)) pages.push(p); } })(DIST);

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
  const main = ['', 'about', 'events', 'community', 'join', 'faq'];
  const route = rel.replace(/^ar[\\/]?/, '').replace(/[\\/]$/, '');
  if (main.includes(route)) c($('nav.main a[data-r].on').length === 1, `nav highlight count ${$('nav.main a[data-r].on').length}`);
  if (route === 'join') {
    c($('form#join-form[data-netlify="true"]').length === 1, 'join form not marked for Netlify');
    c($('form#join-form input[name="form-name"][value="join"]').length === 1, 'join form missing form-name field');
    c($('form#join-form').attr('netlify-honeypot') === 'website', 'honeypot missing');
  }
  c($('#en').attr('href') && $('#ar').attr('href') && exists($('#en').attr('href')) && exists($('#ar').attr('href')), 'language switch links broken');
}
for (const f of ['sitemap.xml', 'robots.txt', '_redirects', '_headers', 'favicon.ico', 'admin/index.html', 'admin/config.yml']) { checks++; if (!fs.existsSync(path.join(DIST, f))) fails.push(`missing ${f}`); }
console.log(`${pages.length} pages, ${checks} checks, ${fails.length} failures`);
fails.forEach((f) => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);

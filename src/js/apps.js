/* Shared helpers for the account, ticket and committee-desk apps. Sets window.OSS. */
(function () {
  'use strict';
  var ar = /^\/ar(\/|$)/.test(location.pathname) || new URLSearchParams(location.search).get('lang') === 'ar';
  var lang = ar ? 'ar' : 'en';
  document.documentElement.lang = lang; document.documentElement.dir = ar ? 'rtl' : 'ltr';
  var TZ = 'Europe/London', LOCALE = { en: 'en-GB', ar: 'ar-SA-u-ca-gregory-nu-arab' };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function L(o) { return o && typeof o === 'object' ? (o[lang] || o.en || '') : (o || ''); }
  function fmt(d, o) { return new Intl.DateTimeFormat(LOCALE[lang], Object.assign({ timeZone: TZ }, o)).format(new Date(d)); }
  function fmtLong(d) { return fmt(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function fmtShort(d) { return fmt(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtTime(d) { return fmt(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  function fmtRange(a, b) { return fmtTime(a) + '–' + fmtTime(b); }
  function fmtStamp(d) { return fmt(d, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  function num(n) { return lang === 'ar' ? new Intl.NumberFormat('ar-SA-u-nu-arab').format(n) : String(n); }
  function toLocalInput(iso) { if (!iso) return ''; var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso)).forEach(function (x) { p[x.type] = x.value; }); return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute; }
  async function api(path, opts) {
    var o = Object.assign({ method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } }, opts || {});
    if (o.body !== undefined && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers['Content-Type'] = 'application/json'; }
    var r = await fetch('/api' + path, o);
    var data = null, ct = r.headers.get('content-type') || '';
    if (ct.indexOf('json') !== -1) { try { data = await r.json(); } catch (e) { data = null; } } else data = await r.text();
    if (!r.ok) { var err = new Error((data && data.error) || 'http_' + r.status); err.status = r.status; err.data = data; throw err; }
    return data;
  }
  function t(dict, key, vars) { var s = (dict[lang] && dict[lang][key] !== undefined) ? dict[lang][key] : dict.en[key]; if (typeof s === 'function') return s(vars); if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); }); return s; }
  var base = ar ? '/ar' : '';
  function header(active) {
    var C = { en: { events: 'Events', account: 'My account', desk: 'Committee desk', home: 'Home', toggle: 'ع', toggleAria: 'العربية' }, ar: { events: 'الفعاليات', account: 'حسابي', desk: 'مكتب اللجنة', home: 'الرئيسية', toggle: 'EN', toggleAria: 'English' } }[lang];
    var other = ar ? location.pathname.replace(/^\/ar/, '') || '/' : '/ar' + location.pathname;
    return '<header class="site"><div class="wrap bar"><a class="brand" href="' + base + '/"><img src="/assets/seal-880.webp" alt=""><span><span class="bn">' + (ar ? 'الجمعية السعودية' : 'Oxford Saudi Society') + '</span><br><span class="bs">' + (ar ? 'جامعة أكسفورد' : 'University of Oxford') + '</span></span></a>' +
      '<nav class="main" aria-label="Primary"><a href="' + base + '/"' + (active === 'home' ? ' class="on" aria-current="page"' : '') + '><span>' + C.home + '</span></a><a href="' + base + '/events/"' + (active === 'events' ? ' class="on" aria-current="page"' : '') + '><span>' + C.events + '</span></a><a href="' + base + '/account/"' + (active === 'account' ? ' class="on" aria-current="page"' : '') + '><span>' + C.account + '</span></a>' + (active === 'desk' ? '<a href="' + base + '/admin/events/" class="on" aria-current="page"><span>' + C.desk + '</span></a>' : '') + '</nav>' +
      '<div class="lang" role="group" aria-label="Language"><a id="en" lang="en"' + (ar ? ' href="' + esc(other + location.search) + '"' : ' class="on" href="' + esc(location.pathname + location.search) + '" aria-current="true"') + '>EN</a><a id="ar" lang="ar"' + (ar ? ' class="on" href="' + esc(location.pathname + location.search) + '" aria-current="true"' : ' href="' + esc(other + location.search) + '"') + '>ع</a></div></div></header>';
  }
  function confirmDialog(title, text, okLabel) {
    return new Promise(function (resolve) {
      var d = document.createElement('dialog'); d.className = 'confirm';
      d.innerHTML = '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><div class="form-foot"><button type="button" class="btn btn-p" data-ok>' + esc(okLabel) + '</button><button type="button" class="btn btn-s" data-no>' + (ar ? 'تراجع' : 'Keep') + '</button></div>';
      document.body.appendChild(d);
      d.querySelector('[data-ok]').addEventListener('click', function () { d.close(); resolve(true); });
      d.querySelector('[data-no]').addEventListener('click', function () { d.close(); resolve(false); });
      d.addEventListener('close', function () { d.remove(); resolve(false); });
      d.showModal();
    });
  }
  window.OSS = { lang: lang, ar: ar, base: base, $: $, esc: esc, L: L, fmtLong: fmtLong, fmtShort: fmtShort, fmtTime: fmtTime, fmtRange: fmtRange, fmtStamp: fmtStamp, num: num, toLocalInput: toLocalInput, api: api, t: t, header: header, confirm: confirmDialog };
})();

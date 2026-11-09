(function () {
  'use strict';
  var lang = (document.documentElement.lang || 'en').slice(0, 2) === 'ar' ? 'ar' : 'en';
  var SITE = { lang: lang, email: '', treasurerEmail: '', membershipEmail: '', fees: {}, payLinks: {}, bank: {}, apiBase: '/api' };
  try { var el0 = document.getElementById('site-settings'); if (el0) Object.assign(SITE, JSON.parse(el0.textContent)); } catch (e) {}
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var T = {
    en: {
      sumPaid: 'Fee: <b>{amount}</b> — payment details follow after you apply', sumFree: 'Nothing to pay',
      sumVerify: 'Free — the secretary will email you later if proof of nationality is needed',
      sumWaived: 'Nothing to pay — your fee is waived with your code',
      codeOk: 'Exemption code accepted — your membership fee is waived.', codeOkPersonal: 'Exemption code accepted. It is reserved for one email address, which is checked when you send the form.', codeChecking: 'Checking…', codeEmpty: 'Type the code first.',
      codeBad: { typo: 'That code has a typing mistake — please check it against the one you were given.', not_yours: 'Code declined — this code is reserved for a different email address.', invalid: 'Code declined — this code is not valid.', expired: 'Code declined — this code has expired.', used_up: 'Code declined — this code has already been used.', not_needed: 'This membership type is free, so no code is needed.', rate: 'Too many attempts. Please wait a few minutes and try again.', net: 'The code could not be checked just now. It is checked again when you send the form.' }, sumNone: 'Choose a membership type above',
      sending: 'Sending…',
      cardTitle: 'Pay by card', cardBtn: 'Pay {amount} by card',
      cardNote: 'Secure checkout opens in a new tab, handled by the payment provider. The Society never sees your card details.',
      bankTitle: 'Pay by bank transfer', acctName: 'Account name', sortCode: 'Sort code', acctNo: 'Account number', refK: 'Reference',
      dirNoMatch: 'No one matches that search.'
    },
    ar: {
      sumPaid: 'الرسوم: <b>{amount}</b> — تصلك تفاصيل الدفع بعد التقديم', sumFree: 'لا توجد رسوم',
      sumVerify: 'مجاناً — سيراسلك أمين السر لاحقاً إن لزم إثبات الجنسية',
      sumWaived: 'لا توجد رسوم — أُعفيت منها بموجب الرمز',
      codeOk: 'تم قبول رمز الإعفاء — أُعفيت من رسوم العضوية.', codeOkPersonal: 'تم قبول رمز الإعفاء. هذا الرمز مخصّص لبريد إلكتروني واحد، ويُتحقق منه عند إرسال النموذج.', codeChecking: 'جارٍ التحقق…', codeEmpty: 'اكتب الرمز أولاً.',
      codeBad: { typo: 'في الرمز خطأ كتابي — راجعه وقارنه بالرمز الذي استلمته.', not_yours: 'رُفض الرمز — هذا الرمز مخصّص لبريد إلكتروني آخر.', invalid: 'رُفض الرمز — هذا الرمز غير صحيح.', expired: 'رُفض الرمز — انتهت صلاحية هذا الرمز.', used_up: 'رُفض الرمز — استُخدم هذا الرمز من قبل.', not_needed: 'هذا النوع من العضوية مجاني، فلا حاجة إلى رمز.', rate: 'محاولات كثيرة. انتظر بضع دقائق ثم حاول مجدداً.', net: 'تعذّر التحقق من الرمز الآن. سيُتحقق منه مرة أخرى عند إرسال النموذج.' }, sumNone: 'اختر نوع العضوية أعلاه',
      sending: 'جارٍ الإرسال…',
      cardTitle: 'الدفع بالبطاقة', cardBtn: 'ادفع {amount} بالبطاقة',
      cardNote: 'تُفتح صفحة دفع آمنة في تبويب جديد عبر مزوّد الدفع. لا تطّلع الجمعية على بيانات بطاقتك أبداً.',
      bankTitle: 'الدفع بالتحويل البنكي', acctName: 'اسم الحساب', sortCode: 'رمز الفرع (Sort code)', acctNo: 'رقم الحساب', refK: 'المرجع',
      dirNoMatch: 'لا نتائج لهذا البحث.'
    }
  };
  function t(key, vars) { var s = (T[lang] && T[lang][key] !== undefined) ? T[lang][key] : T.en[key]; if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); }); return s; }
  function phOr(v, placeholder) { return v ? esc(v) : '<span class="ph">' + esc(placeholder) + '</span>'; }

  /* ── ideas board (Canny, or any embeddable board) ─────────────── */
  (function ideasBoard() {
    var board = $('ideas-board'); if (!board) return;
    var cfg = SITE.ideas || {}, linkCard = $('ideas-link'), mainLink = $('ideas-open-main');
    if (mainLink && cfg.url) mainLink.href = cfg.url;
    if (linkCard && !cfg.url) linkCard.hidden = true;
    if (cfg.cannyBoardToken) {
      /* Canny's loader, as published at developers.canny.io/install/widget/web */
      (function (w, d, i, s) { function l() { if (!d.getElementById(i)) { var f = d.getElementsByTagName(s)[0], e = d.createElement(s); e.type = 'text/javascript'; e.async = true; e.src = 'https://sdk.canny.io/sdk.js'; f.parentNode.insertBefore(e, f); } } if (typeof w.Canny !== 'function') { var c = function () { c.q.push(arguments); }; c.q = []; w.Canny = c; if (d.readyState === 'complete') l(); else w.addEventListener('load', l, false); } })(window, document, 'canny-jssdk', 'script');
      window.Canny('render', { boardToken: cfg.cannyBoardToken, basePath: location.pathname.replace(/\/$/, ''), ssoToken: null, theme: 'light' });
    } else if (cfg.embedUrl) {
      var fr = document.createElement('iframe'); fr.src = cfg.embedUrl; fr.title = lang === 'ar' ? 'لوحة الأفكار' : 'Ideas board'; fr.loading = 'lazy'; fr.setAttribute('allow', 'clipboard-write');
      board.appendChild(fr);
    }
  })();

  (function langSwitch() {
    function target(to) {
      var p = location.pathname, isAr = /^\/ar(\/|$)/.test(p);
      if (to === 'ar') return (isAr ? p : '/ar' + p) + location.search + location.hash;
      return (isAr ? (p.replace(/^\/ar/, '') || '/') : p) + location.search + location.hash;
    }
    ['en', 'ar'].forEach(function (id) {
      var a = $(id); if (!a) return;
      var known = a.getAttribute('href') || '';
      // only step in where the built link does not already name this exact page
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
        var want = target(id), base = want.split('?')[0].split('#')[0];
        if (known === base && !location.search && !location.hash) return;
        e.preventDefault(); location.href = want;
      });
    });
  })();

  /* ── header: compact capsule once the page scrolls ───────────── */
  (function compactHeader() {
    var hd = document.querySelector('header.site'); if (!hd) return;
    var tick = false;
    function apply() { hd.classList.toggle('scrolled', (window.scrollY || document.documentElement.scrollTop || 0) > 24); tick = false; }
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(apply); } }, { passive: true });
    apply();
  })();

  /* ── community directory: filter + search over server-rendered cards ── */
  var grid = $('dir-grid');
  if (grid) {
    var filter = 'all', q = '';
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.pcard'));
    var empty = $('dir-empty');
    function applyDir() {
      var shown = 0, qq = q.trim().toLowerCase();
      cards.forEach(function (c) { var ok = (filter === 'all' || c.getAttribute('data-group') === filter) && (!qq || (c.getAttribute('data-search') || '').indexOf(qq) !== -1); c.hidden = !ok; if (ok) shown++; });
      if (cards.length && empty) { empty.hidden = shown > 0; empty.textContent = t('dirNoMatch'); }
    }
    document.querySelectorAll('#dir-filters .chip').forEach(function (b) {
      b.addEventListener('click', function () { filter = b.getAttribute('data-g'); document.querySelectorAll('#dir-filters .chip').forEach(function (x) { x.classList.toggle('on', x === b); }); applyDir(); });
    });
    var qi = $('dir-q'); if (qi) qi.addEventListener('input', function () { q = this.value; applyDir(); });
  }

  /* ── FAQ: search, topic chips, expand/collapse, deep links ───────── */
  (function faq() {
    var page = $('faq-page'); if (!page || !page.children.length) return;
    var items = Array.prototype.slice.call(page.querySelectorAll('.faq-item'));
    var secs = Array.prototype.slice.call(page.querySelectorAll('.faq-sec'));
    var q = $('faq-q'), count = $('faq-count'), toggle = $('faq-toggle'), empty = $('faq-empty'), clear = $('faq-clear');
    var chips = Array.prototype.slice.call(page.querySelectorAll('.faq-nav .chip'));
    var total = items.length;
    var countText = function (n) { return lang === 'ar' ? new Intl.NumberFormat('ar-SA-u-nu-arab').format(n) + ' ' + (n === 1 ? 'سؤال' : n === 2 ? 'سؤالان' : n <= 10 ? 'أسئلة' : 'سؤالًا') : n + ' question' + (n === 1 ? '' : 's'); };
    function norm(x) { return String(x || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim(); }
    items.forEach(function (d) { d.setAttribute('data-search', norm(d.getAttribute('data-search'))); });
    var wasOpen = null; // remembered open state while a search is active
    function apply() {
      var qq = norm(q.value), shown = 0;
      if (qq && !wasOpen) { wasOpen = items.map(function (d) { return d.open; }); }
      items.forEach(function (d) { var ok = !qq || d.getAttribute('data-search').indexOf(qq) !== -1; d.hidden = !ok; if (ok) shown++; if (qq && ok && qq.length >= 2) d.open = true; });
      if (!qq && wasOpen) { items.forEach(function (d, i) { d.open = wasOpen[i]; }); wasOpen = null; }
      secs.forEach(function (sec) {
        var n = sec.querySelectorAll('.faq-item:not([hidden])').length; sec.hidden = n === 0;
        var lab = sec.querySelector('.faq-sec-n'); if (lab) lab.textContent = countText(n);
        var chip = chips.filter(function (c) { return c.getAttribute('data-sec') === sec.getAttribute('data-sec'); })[0]; if (chip) chip.hidden = n === 0;
      });
      count.textContent = countText(shown); empty.hidden = shown > 0;
      try { var p = new URLSearchParams(location.search); if (qq) p.set('q', q.value.trim()); else p.delete('q'); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash); } catch (e) { /* ignore */ }
      syncToggle();
    }
    function syncToggle() { var vis = items.filter(function (d) { return !d.hidden; }), allOpen = vis.length > 0 && vis.every(function (d) { return d.open; }); toggle.textContent = toggle.getAttribute(allOpen ? 'data-collapse' : 'data-expand'); toggle.setAttribute('aria-pressed', allOpen ? 'true' : 'false'); }
    toggle.addEventListener('click', function () { var vis = items.filter(function (d) { return !d.hidden; }), allOpen = vis.every(function (d) { return d.open; }); vis.forEach(function (d) { d.open = !allOpen; }); wasOpen = null; syncToggle(); });
    q.addEventListener('input', apply);
    clear.addEventListener('click', function () { q.value = ''; apply(); q.focus(); });
    try { var p0 = new URLSearchParams(location.search); if (p0.get('q')) { q.value = p0.get('q'); } } catch (e) { /* ignore */ }
    // deep links: open the question named in the hash; write the hash when a question is opened
    function openHash() { var id = decodeURIComponent((location.hash || '').slice(1)); if (!id) return; var d = document.getElementById(id); if (d && d.classList.contains('faq-item')) { d.open = true; setTimeout(function () { d.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); } }
    items.forEach(function (d) {
      d.addEventListener('toggle', function () { if (d.open && !q.value) { try { history.replaceState(null, '', location.pathname + location.search + '#' + d.id); } catch (e) { /* ignore */ } } syncToggle(); });
      var cp = d.querySelector('.faq-copy');
      if (cp) cp.addEventListener('click', function () { var url = location.origin + location.pathname + '#' + d.id, keep = cp.textContent; var pr = (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(url) : Promise.reject(); pr.then(function () { cp.textContent = cp.getAttribute('data-copied'); }, function () { cp.textContent = url; }); setTimeout(function () { cp.textContent = keep; }, 2200); });
    });
    window.addEventListener('hashchange', openHash);
    // topic chips: highlight the section in view
    if ('IntersectionObserver' in window) {
      var current = null;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) current = en.target.getAttribute('data-sec'); });
        chips.forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-sec') === current); });
      }, { rootMargin: '-120px 0px -60% 0px', threshold: 0 });
      secs.forEach(function (sec) { io.observe(sec); });
    }
    window.addEventListener('beforeprint', function () { items.forEach(function (d) { d.open = true; }); });
    apply(); openHash();
  })();

  /* ── join form ─────────────────────────────────────────────────── */
  var form = $('join-form'); if (!form) return;
  var done = $('join-done');
  var TIERS = [
    { id: 'saudi', price: 0, verify: true, en: 'Oxford University Saudi students', ar: 'الطلبة السعوديون في جامعة أكسفورد' },
    { id: 'student', price: SITE.fees.student != null ? SITE.fees.student : 10, en: 'Oxford University students membership', ar: 'عضوية طلبة جامعة أكسفورد' },
    { id: 'external', price: SITE.fees.external != null ? SITE.fees.external : 10, en: 'Non-Oxford University students', ar: 'طلبة الجامعات الأخرى' },
    { id: 'associate', price: SITE.fees.associate != null ? SITE.fees.associate : 15, en: 'Associate membership', ar: 'عضوية غير الطلبة' },
    { id: 'friend', price: 0, en: 'Mailing list & volunteering', ar: 'القائمة البريدية والتطوّع' }
  ];
  var STATUS = { undergraduate: 'Undergraduate', masters: "Taught postgraduate (Master's)", dphil: 'Research postgraduate (DPhil)', visiting: 'Visiting student or researcher', staff: 'University staff or researcher', alumni: 'Alumni', other: 'Other' };
  var VOL = { events: 'Events', media: 'Media & design', partnerships: 'Sponsorship & partnerships', welfare: 'Welfare & welcome', academic: 'Academic & careers' };
  var busy = false, last = null;
  /* College / department: the suggestions are drawn by the page in the same style as the field (a browser's own
     suggestion list cannot be styled). Typing filters them; an answer that is not on the list is still accepted. */
  (function collegeCombo() {
    var input = $('f-college'), data = $('colleges'); if (!input || !data) return;
    var all = Array.prototype.map.call(data.querySelectorAll('option'), function (o) { return o.value; }).filter(Boolean);
    if (!all.length) return;
    input.removeAttribute('list'); // switch the browser's list off; ours replaces it
    var wrap = document.createElement('div'); wrap.className = 'combo'; input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    var list = document.createElement('ul'); list.className = 'combo-list'; list.id = 'college-list'; list.hidden = true;
    list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', lang === 'ar' ? 'اقتراحات الكليات' : 'College suggestions');
    wrap.appendChild(list);
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', 'college-list'); input.setAttribute('aria-expanded', 'false');
    var shown = [], active = -1, picking = false;
    function norm(v) { return String(v || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim(); }
    function matches(q) {
      q = norm(q); if (!q) return all.slice();
      var first = [], rest = [];
      all.forEach(function (v) { var n = norm(v), i = n.indexOf(q); if (i === -1) return; if (i === 0 || /[\s(]/.test(n.charAt(i - 1))) first.push(v); else rest.push(v); }); // words that start with what was typed come first
      return first.concat(rest);
    }
    function mark(v, q) { q = norm(q); var i = q ? v.toLowerCase().indexOf(q) : -1; return i < 0 ? esc(v) : esc(v.slice(0, i)) + '<b>' + esc(v.slice(i, i + q.length)) + '</b>' + esc(v.slice(i + q.length)); }
    function setActive(i) {
      active = i;
      Array.prototype.forEach.call(list.children, function (li, k) { li.classList.toggle('on', k === i); li.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      if (i < 0) { input.removeAttribute('aria-activedescendant'); return; }
      input.setAttribute('aria-activedescendant', 'college-opt-' + i);
      var li = list.children[i], top = li.offsetTop, bottom = top + li.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top - 6; else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 6;
    }
    function close() { list.hidden = true; wrap.classList.remove('open'); input.setAttribute('aria-expanded', 'false'); setActive(-1); }
    function open() {
      var q = input.value; shown = matches(q);
      if (!shown.length || (shown.length === 1 && norm(shown[0]) === norm(q))) return close(); // nothing to suggest, or already chosen
      list.innerHTML = shown.map(function (v, i) { return '<li role="option" id="college-opt-' + i + '" aria-selected="false" data-i="' + i + '">' + mark(v, q) + '</li>'; }).join('');
      list.hidden = false; list.scrollTop = 0; wrap.classList.add('open'); input.setAttribute('aria-expanded', 'true'); setActive(-1);
    }
    function choose(i) {
      if (i < 0 || i >= shown.length) return;
      input.value = shown[i]; close();
      picking = true; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); picking = false;
    }
    input.addEventListener('input', function () { if (!picking) open(); });
    input.addEventListener('focus', open);
    input.addEventListener('click', function () { if (list.hidden) open(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (list.hidden) { open(); if (list.hidden) return; }
        var n = shown.length; setActive(e.key === 'ArrowDown' ? (active + 1) % n : (active <= 0 ? n - 1 : active - 1));
      } else if (e.key === 'Enter') { if (!list.hidden && active >= 0) { e.preventDefault(); choose(active); } }
      else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); close(); } }
      else if (e.key === 'Tab') close();
    });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep the cursor in the field while a suggestion is picked
    list.addEventListener('click', function (e) { var li = e.target.closest ? e.target.closest('li[data-i]') : null; if (li) { choose(+li.getAttribute('data-i')); input.focus(); } });
    input.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== input) close(); }, 150); });
    document.addEventListener('pointerdown', function (e) { if (!wrap.contains(e.target)) close(); });
  })();
  function tierOf(id) { for (var i = 0; i < TIERS.length; i++) if (TIERS[i].id === id) return TIERS[i]; return null; }
  function amountOf(tier) { return '£' + tier.price; }
  function amountHtml(tier) { var a = esc(amountOf(tier)); return '<bdi>' + (SITE.fees.confirmed ? a : '<span class="ph">[' + a + ']</span>') + '</bdi>'; }
  function selectedTier() { var r = form.querySelector('input[name="tier"]:checked'); return r ? tierOf(r.value) : null; }
  function syncTier() {
    var tier = selectedTier();
    document.querySelectorAll('#tiers .tier').forEach(function (l) { l.classList.toggle('sel', l.querySelector('input').checked); });
    $('email-hint').hidden = !(tier && (tier.id === 'student' || tier.id === 'saudi'));
    // A student of another university gives their university and subject; everyone else gives an Oxford college or
    // department (and, for the two Oxford student types, the SSO username). Step 2 offers the matching choices.
    var ext = isExternal(tier);
    [['sso', ext], ['college', ext], ['university', !ext], ['subject', !ext]].forEach(function (p) { var f = form.querySelector('[data-f="' + p[0] + '"]'); if (f) { f.hidden = p[1]; if (p[1]) setErr(p[0], false); } });
    $('f-college').required = !ext; $('f-university').required = ext; $('f-subject').required = ext;
    document.querySelectorAll('#statuses .stat').forEach(function (l) { var mine = (l.getAttribute('data-for') === 'external') === ext; l.hidden = !mine; var r = l.querySelector('input[name="status"]'); if (!mine && r.checked) r.checked = false; });
    var sh = $('status-h'); if (sh) sh.textContent = sh.getAttribute((lang === 'ar' ? 'data-ar-' : 'data-') + (ext ? 'external' : 'oxford')) || sh.textContent;
    syncStatus(false);
    var paidTier = !!(tier && tier.price), fc = $('fee-code');
    if (fc) { fc.hidden = !paidTier; if (!paidTier) codeState(null); }
    $('sum').innerHTML = !tier ? t('sumNone') : tier.price ? (feeOk ? t('sumWaived') : t('sumPaid', { amount: amountHtml(tier) })) : tier.verify ? t('sumVerify') : t('sumFree');
    // the Oxford SSO username is needed for the two student membership types only
    var needSso = ssoNeeded(tier), ssoIn = $('f-sso');
    if (ssoIn) { ssoIn.required = needSso; $('sso-req').hidden = !needSso; $('sso-opt').hidden = needSso; if (!needSso && (!ssoIn.value.trim() || SSO_RE.test(ssoIn.value.trim()))) setErr('sso', false); }
    if (tier) { $('tier-msg').style.display = 'none'; $('tiers').classList.remove('err'); }
  }
  /* Fee code: a code from the committee waives the fee on the fee-paying membership types. "Check code" answers at once
     (accepted or declined); the server checks it again when the form is sent, so nothing depends on this check. */
  var feeOk = false;
  /* A generated code looks like OSS-X26-7K4MQ-2XPDC: issuer, type and year, nine random characters and a final check
     character (Luhn mod 32 over an alphabet with no I, L, O or U). The page puts the dashes in as you type, reads a
     typed O as 0 and I or L as 1, and spots a typing mistake from the check character before asking the server. */
  var B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function codeCanon(v) {
    var raw = String(v || '').toUpperCase().replace(/[^A-Z0-9-]/g, ''), bare = raw.replace(/-/g, '');
    if (/^OSSX[0-9]{0,2}[0-9A-Z]{0,10}$/.test(bare) && bare.length > 3) { var body = bare.slice(6).replace(/O/g, '0').replace(/[IL]/g, '1'); return ['OSS', bare.slice(3, 6), body.slice(0, 5), body.slice(5, 10)].filter(function (x) { return x; }).join('-'); }
    return raw.slice(0, 24);
  }
  function codeTypo(code) { // true only for a complete generated-format code whose check character is wrong
    var bare = String(code).replace(/-/g, ''); if (!/^OSSX[0-9]{2}[0-9A-Z]{10}$/.test(bare)) return false;
    var p = bare.slice(3), factor = 1, sum = 0;
    for (var i = p.length - 1; i >= 0; i--) { var cp = B32.indexOf(p.charAt(i)); if (cp < 0) return true; var add = factor * cp; factor = factor === 2 ? 1 : 2; sum += Math.floor(add / 32) + (add % 32); }
    return sum % 32 !== 0;
  }
  function codeState(kind, text) { var p = $('fee-code-state'); if (!p) return; feeOk = kind === 'ok'; p.hidden = !kind; p.className = 'code-state' + (kind ? ' is-' + kind : ''); p.textContent = text || ''; if (kind !== 'bad') setErr('feeCode', false); }
  (function () {
    var inp = $('f-fee-code'), btn = $('fee-code-btn'); if (!inp || !btn) return;
    async function check() {
      var tier = selectedTier(), code = codeCanon(inp.value); inp.value = code;
      if (!code) { codeState('bad', t('codeEmpty')); inp.focus(); return; }
      if (codeTypo(code)) { codeState('bad', t('codeBad').typo); return; }
      var em = $('f-email').value.trim();
      btn.disabled = true; codeState('wait', t('codeChecking'));
      try {
        var r = await fetch((SITE.apiBase || '/api') + '/membership/code', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ code: code, tier: tier ? tier.id : '', email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em) ? em : '' }) });
        var d = null; try { d = await r.json(); } catch (e) { /* not json */ }
        if (r.status === 429) codeState('bad', t('codeBad').rate);
        else if (r.ok && d && d.ok) codeState('ok', t(d.personal && !em ? 'codeOkPersonal' : 'codeOk'));
        else if (r.ok && d) codeState('bad', t('codeBad')[d.reason] || t('codeBad').invalid);
        else codeState('wait', t('codeBad').net);
      } catch (e) { codeState('wait', t('codeBad').net); }
      btn.disabled = false; syncTier();
    }
    btn.addEventListener('click', check);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    inp.addEventListener('input', function (e) { var del = e && e.inputType && e.inputType.indexOf('delete') === 0; var v = del ? inp.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') : codeCanon(inp.value); if (v !== inp.value) inp.value = v; if (!$('fee-code-state').hidden) { codeState(null); syncTier(); } });
  })();
  var SSO_RE = /^[A-Za-z]{4}[0-9]{4}$/;
  function ssoNeeded(tier) { return !!tier && (tier.id === 'saudi' || tier.id === 'student'); }
  function isExternal(tier) { return !!tier && tier.id === 'external'; }
  (function () {
    var ssoIn = $('f-sso'); if (!ssoIn) return;
    // letters and digits only, lower case, as the username is written by the University
    ssoIn.addEventListener('input', function () { var v = ssoIn.value.replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 8); if (v !== ssoIn.value) ssoIn.value = v; if (!v || SSO_RE.test(v)) setErr('sso', false); });
    ssoIn.addEventListener('blur', function () { var v = ssoIn.value.trim(); if (v && !SSO_RE.test(v)) setErr('sso', true); });
  })();
  form.addEventListener('change', function (e) { if (e.target.name === 'tier') syncTier(); if (e.target.name === 'status') syncStatus(true); });
  /* Status cards: one tap selects; "Other" opens its own text box inside the card */
  function selectedStatus() { var r = form.querySelector('input[name="status"]:checked'); return r ? r.value : ''; }
  function syncStatus(fromUser) {
    var st = selectedStatus(), other = $('f-status-other');
    document.querySelectorAll('#statuses .stat').forEach(function (l) { l.classList.toggle('sel', l.querySelector('input[name="status"]').checked); });
    other.required = st === 'other';
    if (st === 'other' && fromUser) setTimeout(function () { other.focus(); }, 30);
    if (st && (st !== 'other' || other.value.trim())) setErr('status', false);
    var uni = $('f-university'); if (uni && fromUser) { var BR = 'Oxford Brookes University'; if (st === 'brookes' && !uni.value.trim()) { uni.value = BR; setErr('university', false); } else if (st !== 'brookes' && uni.value === BR) uni.value = ''; }
  }
  $('f-status-other').addEventListener('input', function () { if (this.value.trim()) setErr('status', false); });
  // typing in the Other box selects the Other card (and a click in the box must not be swallowed by the card)
  $('f-status-other').addEventListener('focus', function () { var r = form.querySelector('input[name="status"][value="other"]'); if (!r.checked) { r.checked = true; syncStatus(false); } });
  function setErr(name, on) { var f = form.querySelector('[data-f="' + name + '"]'); if (!f) return; f.classList.toggle('err', !!on); var inp = f.querySelector('input,select'); if (inp) inp.setAttribute('aria-invalid', on ? 'true' : 'false'); }
  function validate() {
    var bad = [], tier = selectedTier();
    $('tier-msg').style.display = tier ? 'none' : 'block'; $('tiers').classList.toggle('err', !tier); if (!tier) bad.push('tiers');
    var name = $('f-name').value.trim(), email = $('f-email').value.trim(), college = $('f-college').value.trim(), status = selectedStatus(), statusOther = $('f-status-other').value.trim(), consent = $('f-consent').checked;
    setErr('name', !name); if (!name) bad.push('f-name');
    var okMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email); setErr('email', !okMail); if (!okMail) bad.push('f-email');
    var ext = isExternal(tier);
    var sso = ext ? '' : $('f-sso').value.trim(), ssoBad = !ext && ((ssoNeeded(tier) && !sso) || (!!sso && !SSO_RE.test(sso)));
    setErr('sso', ssoBad); if (ssoBad) bad.push('f-sso');
    var noCollege = !ext && !college; setErr('college', noCollege); if (noCollege) bad.push('f-college');
    var noUni = ext && $('f-university').value.trim().length < 2; setErr('university', noUni); if (noUni) bad.push('f-university');
    var noSubj = ext && $('f-subject').value.trim().length < 2; setErr('subject', noSubj); if (noSubj) bad.push('f-subject');
    var badStatus = !status || (status === 'other' && !statusOther);
    setErr('status', badStatus); if (badStatus) bad.push(status === 'other' ? 'f-status-other' : 'statuses');
    setErr('consent', !consent); if (!consent) bad.push('f-consent');
    $('err-sum').classList.toggle('on', bad.length > 0);
    if (bad.length) { var el = $(bad[0]); if (el.focus) el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    return bad.length === 0;
  }
  ['f-name', 'f-email', 'f-college', 'f-university', 'f-subject', 'f-consent'].forEach(function (id) { var clear = function () { setErr(id.replace('f-', ''), false); }; $(id).addEventListener('input', clear); $(id).addEventListener('change', clear); });
  /* Submission goes to the society's own database (/api/membership/apply), which issues a permanent
     membership number and a place in the review queue. Nothing is claimed until the server answers. */
  var M = {
    en: {
      eyebrowNew: 'Application received', eyebrowUpdated: 'Application updated', eyebrowAgain: 'You have already applied', eyebrowMember: 'You are already a member',
      thanks: 'Thank you, {name}.', welcomeBack: 'Welcome back, {name}.',
      ledeNew: 'Your application is with the committee. Keep your membership number: quote it in anything you send us.',
      ledeAgain: 'We already have your application, so nothing new was submitted. Here is where it stands.', feeWaived: 'Your membership fee has been waived with your code. There is nothing to pay.',
      ledeUpdated: 'We already had an application from this email address, so we have updated it with your new answers. It keeps its number and its place in the queue.',
      changeHow: 'To change your answers, sign in on the My account page first (we email you a sign-in link), then send this form again.', changeBtn: 'Sign in to My account',
      ledeMember: 'This email address already belongs to an active membership.',
      org: 'Oxford Saudi Society', noLabel: 'Membership number', nameL: 'Name', typeL: 'Membership', appliedL: 'Applied', copy: 'Copy number', copied: 'Copied',
      st: { pending: 'Pending review', info_requested: 'Question from the committee', approved: 'Active member', declined: 'Not approved', revoked: 'Ended', expired: 'Expired' },
      qL: 'Your place in the review queue', qP: 'The committee reviews applications in the order they arrive. You will get an email as soon as yours is decided.',
      t1: 'Application received', t2: 'Committee review', t3pay: 'Payment of {amount}', t3verify: 'Nationality check, if needed', t4: 'Membership active',
      payH: 'Membership fee: {amount}', payP: 'Use your membership number as the payment reference so the treasurer can match it. Membership is approved once the payment is confirmed.', payLater: 'The treasurer will email you how to pay. Use your membership number as the payment reference; membership is approved once the payment is confirmed.',
      verifyH: 'Proof of Saudi nationality', verifyP: 'Nothing is needed from you now. The committee\u2019s secretary will email you later to ask for proof of Saudi nationality, if it is needed. Please do not send any identity document until you are asked.',
      mailNote: 'We have sent a confirmation to <b dir="ltr">{email}</b>. Its link lets you follow your application and answer any question from the committee.',
      track: 'Track my application', print: 'Save or print', again: 'Submit another application',
      failH: 'Your application was not submitted', fail: 'We could not reach the membership system just now. Your answers are still in the form: please press Submit again in a minute.', failMail: 'If it keeps failing, email {email}.',
      rate: 'Too many attempts from this connection. Please wait a few minutes and try again.'
    },
    ar: {
      eyebrowNew: 'تم استلام الطلب', eyebrowUpdated: 'تم تحديث الطلب', eyebrowAgain: 'لقد تقدّمت بطلب من قبل', eyebrowMember: 'أنت عضو بالفعل',
      thanks: 'شكرًا لك يا {name}.', welcomeBack: 'أهلًا بعودتك يا {name}.',
      ledeNew: 'طلبك الآن لدى اللجنة. احتفظ برقم عضويتك واذكره في أي مراسلة معنا.',
      ledeAgain: 'طلبك موجود لدينا، فلم يُرسل طلب جديد. هذا وضع طلبك الآن.', feeWaived: 'أُعفيت من رسوم العضوية بموجب الرمز الذي أدخلته، فلا يلزمك دفع شيء.',
      ledeUpdated: 'لدينا طلب سابق من هذا البريد الإلكتروني، فحدّثناه بإجاباتك الجديدة. يحتفظ الطلب برقمه وبترتيبه في قائمة المراجعة.',
      changeHow: 'لتعديل إجاباتك، سجّل الدخول أولًا من صفحة «حسابي» (نرسل لك رابط دخول بالبريد)، ثم أرسل هذا النموذج مرة أخرى.', changeBtn: 'سجّل الدخول إلى حسابي',
      ledeMember: 'هذا البريد مرتبط بعضوية فعّالة.',
      org: 'الجمعية السعودية في أكسفورد', noLabel: 'رقم العضوية', nameL: 'الاسم', typeL: 'العضوية', appliedL: 'تاريخ الطلب', copy: 'نسخ الرقم', copied: 'تم النسخ',
      st: { pending: 'قيد المراجعة', info_requested: 'سؤال من اللجنة', approved: 'عضو فعّال', declined: 'لم تتم الموافقة', revoked: 'منتهية', expired: 'منتهية الصلاحية' },
      qL: 'ترتيبك في قائمة المراجعة', qP: 'تراجع اللجنة الطلبات بحسب ترتيب وصولها، وستصلك رسالة بالبريد فور البت في طلبك.',
      t1: 'تم استلام الطلب', t2: 'مراجعة اللجنة', t3pay: 'دفع {amount}', t3verify: 'التحقق من الجنسية عند الحاجة', t4: 'تفعيل العضوية',
      payH: 'رسوم العضوية: {amount}', payP: 'اكتب رقم عضويتك مرجعًا للدفع ليتمكن أمين الصندوق من مطابقته. تُعتمد العضوية بعد تأكيد الدفعة.', payLater: 'سيراسلك أمين الصندوق بطريقة الدفع. اكتب رقم عضويتك مرجعًا للدفع، وتُعتمد العضوية بعد تأكيد الدفعة.',
      verifyH: 'إثبات الجنسية السعودية', verifyP: 'لا يلزمك فعل شيء الآن. سيراسلك أمين سر مجلس إدارة الجمعية لاحقًا لطلب إثبات الجنسية السعودية عند الحاجة. يرجى عدم إرسال أي وثيقة هوية قبل أن يُطلب منك ذلك.',
      mailNote: 'أرسلنا تأكيدًا إلى <b dir="ltr">{email}</b>، ويتيح لك الرابط فيه متابعة طلبك والإجابة عن أي سؤال من اللجنة.',
      track: 'تابع طلبي', print: 'حفظ أو طباعة', again: 'تقديم طلب آخر',
      failH: 'لم يُرسل طلبك', fail: 'تعذّر الوصول إلى نظام العضوية الآن. إجاباتك ما زالت في النموذج؛ اضغط «إرسال الطلب» مرة أخرى بعد دقيقة.', failMail: 'إن تكرر الخطأ فراسلنا على {email}.',
      rate: 'محاولات كثيرة من هذا الاتصال. انتظر بضع دقائق ثم حاول مجددًا.'
    }
  };
  function m(key, vars) { var v = (M[lang][key] !== undefined ? M[lang][key] : M.en[key]); if (typeof v === 'string' && vars) Object.keys(vars).forEach(function (k) { v = v.split('{' + k + '}').join(vars[k]); }); return v; }
  function fmtDay(d) { try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-arab' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }).format(new Date(d)); } catch (e) { return ''; } }
  function num(n) { return lang === 'ar' ? new Intl.NumberFormat('ar-SA-u-nu-arab').format(n) : String(n); }
  function collect() {
    var tier = selectedTier();
    return { tier: tier ? tier.id : '', name: $('f-name').value.trim(), nameAr: $('f-name-ar').value.trim(), email: $('f-email').value.trim(), sso: isExternal(tier) ? '' : $('f-sso').value.trim().toLowerCase(), feeCode: (tier && tier.price && $('f-fee-code')) ? $('f-fee-code').value.trim() : '', college: isExternal(tier) ? '' : $('f-college').value.trim(), university: isExternal(tier) ? $('f-university').value.trim() : '', subject: isExternal(tier) ? $('f-subject').value.trim() : '', status: selectedStatus(), statusOther: selectedStatus() === 'other' ? $('f-status-other').value.trim() : '', phone: $('f-phone').value.trim(),
      volunteer: Array.prototype.slice.call(form.querySelectorAll('input[name="volunteer"]:checked')).map(function (c) { return c.value; }),
      consent_privacy: $('f-consent').checked, consent_news: form.querySelector('input[name="consent_news"]').checked,
      privacy_version: SITE.privacyVersion || '', lang: lang, website: form.querySelector('input[name="website"]').value };
  }
  async function send(app) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    try {
      var r = await fetch((SITE.apiBase || '/api') + '/membership/apply', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(app), signal: ctl ? ctl.signal : undefined });
      var data = null; try { data = await r.json(); } catch (e) { /* not json */ }
      return { ok: r.ok, status: r.status, data: data };
    } catch (e) { return { ok: false, status: 0, data: null }; }
    finally { clearTimeout(timer); }
  }
  function showFail(res) {
    var box = $('join-fail');
    if (!box) { box = document.createElement('div'); box.id = 'join-fail'; box.className = 'err-sum on'; box.setAttribute('role', 'alert'); $('submit-btn').parentNode.parentNode.insertBefore(box, $('submit-btn').parentNode); }
    if (res.status === 400 && res.data && res.data.fields) {
      var map = { name: 'name', email: 'email', sso: 'sso', college: 'college', university: 'university', subject: 'subject', status: 'status', statusOther: 'status', consent: 'consent' };
      if (res.data.fields.feeCode) { codeState('bad', t('codeBad')[res.data.fields.feeCode] || t('codeBad').invalid); setErr('feeCode', true); syncTier(); $('fee-code').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      Object.keys(res.data.fields).forEach(function (k) { if (map[k]) setErr(map[k], true); if (k === 'tier') { $('tier-msg').style.display = 'block'; $('tiers').classList.add('err'); } });
      box.hidden = true; $('err-sum').classList.add('on'); return;
    }
    box.hidden = false;
    box.innerHTML = '<b>' + esc(m('failH')) + '</b> ' + esc(res.status === 429 ? m('rate') : m('fail')) + (res.status === 429 ? '' : ' ' + m('failMail', { email: SITE.email ? '<a href="mailto:' + esc(SITE.email) + '">' + esc(SITE.email) + '</a>' : '' }));
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  form.addEventListener('submit', async function (e) {
    e.preventDefault(); if (busy) return;
    if (form.querySelector('input[name="website"]').value) return;
    if (!validate()) return;
    busy = true; var btn = $('submit-btn'), lbl = $('submit-label'), keep = lbl.innerHTML; btn.disabled = true; lbl.textContent = t('sending');
    var app = null, res;
    // never leave the button stuck on "Sending…": any unexpected error ends in the visible failure message
    try { app = collect(); res = await send(app); } catch (err) { res = { ok: false, status: 0, data: null }; }
    finally { busy = false; btn.disabled = false; lbl.innerHTML = keep; }
    if (!res.ok || !res.data || !res.data.member) { showFail(res); return; }
    var f = $('join-fail'); if (f) f.hidden = true;
    last = { app: app, result: res.data.result, member: res.data.member, needsSignIn: !!res.data.needsSignIn }; renderDone();
  });
  function setSteps(stage) { document.querySelectorAll('#steps li').forEach(function (li) { li.classList.remove('on', 'done'); li.classList.add(stage === 'form' ? 'on' : 'done'); }); }
  function renderDone() {
    var app = last.app, mem = last.member, kind = last.result, tier = tierOf(mem.tier) || selectedTier() || TIERS[0];
    var first = esc((app.name || mem.name || '').split(/\s+/)[0]);
    var amount = '£' + (mem.amountGbp || 0), paid = mem.amountGbp > 0, verify = mem.tier === 'saudi' && (mem.nationalityStatus === 'pending' || mem.nationalityStatus === 'verified');
    var isMember = mem.status === 'approved';
    var h = '<p class="eyebrow">' + esc(m(kind === 'already_member' ? 'eyebrowMember' : kind === 'already' ? 'eyebrowAgain' : kind === 'updated' ? 'eyebrowUpdated' : 'eyebrowNew')) + '</p>';
    h += '<h2 class="done-h">' + esc(m(kind === 'received' ? 'thanks' : 'welcomeBack', { name: first })) + '</h2>';
    h += '<p class="lede done-lede">' + esc(m(kind === 'already_member' ? 'ledeMember' : kind === 'already' ? 'ledeAgain' : kind === 'updated' ? 'ledeUpdated' : 'ledeNew')) + '</p>';
    if (last.needsSignIn) h += '<p class="note">' + esc(m('changeHow')) + '</p>';
    // membership card
    h += '<div class="mcard" id="mcard"><div class="mcard-top"><span class="mcard-org">' + esc(m('org')) + '</span><span class="mstate s-' + esc(mem.status) + '">' + esc(m('st')[mem.status] || mem.status) + '</span></div>';
    h += '<span class="mk">' + esc(m('noLabel')) + '</span><span class="mno" dir="ltr" id="mno">' + esc(mem.memberNo) + '</span>';
    h += '<div class="mcard-meta"><div><span class="mk">' + esc(m('nameL')) + '</span><b>' + esc(mem.name || app.name) + '</b></div><div><span class="mk">' + esc(m('typeL')) + '</span><b>' + esc((mem.tierLabel && mem.tierLabel[lang]) || tier[lang]) + '</b></div><div><span class="mk">' + esc(m('appliedL')) + '</span><b>' + esc(fmtDay(mem.appliedAt)) + '</b></div></div>';
    h += '<button type="button" class="mcopy" id="mcopy">' + esc(m('copy')) + '</button></div>';
    if (!isMember && mem.position) h += '<div class="qtile"><span class="mk">' + esc(m('qL')) + '</span><b class="qno">' + esc(num(mem.position)) + '</b><p>' + esc(m('qP')) + '</p></div>';
    if (!isMember) {
      var third = paid ? m('t3pay', { amount: amount }) : verify ? m('t3verify') : null;
      var steps = [[m('t1'), 'done', fmtDay(mem.appliedAt)], [m('t2'), 'now', '']];
      if (third) steps.push([third, paid && mem.paymentStatus === 'received' ? 'done' : '', '']);
      steps.push([m('t4'), '', '']);
      h += '<ol class="track">' + steps.map(function (s, i) { return '<li class="' + s[1] + '"><span class="tk" aria-hidden="true">' + (s[1] === 'done' ? '✓' : '') + '</span><span class="tt">' + esc(s[0]) + (s[2] ? '<small>' + esc(s[2]) + '</small>' : '') + '</span></li>'; }).join('') + '</ol>';
    }
    if (!isMember && paid) {
      var link = (SITE.payLinks || {})[tier.id] || '', bank = SITE.bank || {}, hasBank = !!(bank.sortCode && bank.accountNumber);
      h += '<div class="nextpanel"><h3 class="disp">' + esc(m('payH', { amount: amount })) + '</h3><p>' + esc(m(link || hasBank ? 'payP' : 'payLater')) + '</p>';
      if (link || hasBank) {
        h += '<div class="paygrid">';
        if (link) h += '<div class="card tinted"><h3>' + esc(t('cardTitle')) + '</h3><p class="big">' + amountHtml(tier) + '</p><a class="btn btn-p" href="' + esc(link) + '" target="_blank" rel="noopener">' + t('cardBtn', { amount: esc(amount) }) + '</a><p style="margin-top:14px;font-size:13.5px">' + esc(t('cardNote')) + '</p></div>';
        if (hasBank) h += '<div class="card"><h3>' + esc(t('bankTitle')) + '</h3><dl class="kv"><dt>' + esc(t('acctName')) + '</dt><dd>' + esc(bank.accountName || 'Oxford Saudi Society') + '</dd><dt>' + esc(t('sortCode')) + '</dt><dd dir="ltr">' + esc(bank.sortCode) + '</dd><dt>' + esc(t('acctNo')) + '</dt><dd dir="ltr">' + esc(bank.accountNumber) + '</dd><dt>' + esc(t('refK')) + '</dt><dd><b dir="ltr">' + esc(mem.memberNo) + '</b></dd></dl></div>';
        h += '</div>';
      }
      h += '</div>';
    } else if (!isMember && verify && mem.nationalityStatus !== 'verified') {
      h += '<div class="nextpanel"><h3 class="disp">' + esc(m('verifyH')) + '</h3><p>' + esc(m('verifyP')) + '</p></div>';
    }
    if (mem.feeWaived && !isMember) h += '<p class="alert ok">' + esc(m('feeWaived')) + '</p>';
    h += '<p class="muted done-mail">' + m('mailNote', { email: esc(app.email) }) + '</p>';
    h += '<div class="done-actions"><a class="btn btn-p" href="' + (lang === 'ar' ? '/ar' : '') + '/account/">' + esc(m('track')) + '</a><button type="button" class="btn btn-s" id="done-print">' + esc(m('print')) + '</button></div>';
    h += '<p class="again"><a href="#join-form-band" id="again">' + esc(m('again')) + '</a></p>';
    done.innerHTML = h; done.hidden = false; form.hidden = true; setSteps('all');
    $('mcopy').addEventListener('click', function () { var b = this; var p = (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(mem.memberNo) : Promise.reject(); p.then(function () { b.textContent = m('copied'); setTimeout(function () { b.textContent = m('copy'); }, 2000); }, function () { var r = document.createRange(); r.selectNodeContents($('mno')); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }); });
    $('done-print').addEventListener('click', function () { window.print(); });
    $('again').addEventListener('click', function (ev) { ev.preventDefault(); last = null; form.reset(); syncStatus(false); done.hidden = true; form.hidden = false; $('err-sum').classList.remove('on'); form.querySelectorAll('.f.err').forEach(function (f) { f.classList.remove('err'); }); syncTier(); setSteps('form'); $('join-form-band').scrollIntoView({ behavior: 'smooth' }); });
    $('join-form-band').scrollIntoView({ behavior: 'smooth' });
  }
  syncTier(); setSteps('form');
})();

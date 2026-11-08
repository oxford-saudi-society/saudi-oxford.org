// Behaviour checks over the built static site (repo/dist) served by a local http server.
// usage: node repo-behaviour.js  (expects python3 -m http.server 8765 --directory /home/claude/repo/dist running)
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8765';
const R = { checks: 0, fails: [] };
const c = (ok, msg) => { R.checks++; if (!ok) R.fails.push(msg); };
const routes = ['', 'about', 'events', 'community', 'ideas', 'join', 'faq', 'privacy', 'terms', 'committees'];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const [w, h, mobile] of [[1280, 800, false], [390, 844, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('response', r => { if (r.status() >= 400 && !/\/api\//.test(r.url())) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); }); // /api/* is not served by the static harness; the pages must degrade silently
    p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)|example\.org/.test(r.url())) errors.push('request failed ' + r.url()); });
    for (const lang of ['en', 'ar']) {
      for (const r of routes) {
        const url = `${BASE}/${lang === 'ar' ? 'ar/' : ''}${r ? r + '/' : ''}`;
        const resp = await p.goto(url); await p.waitForTimeout(150);
        const tag = `[${w}] ${url.replace(BASE, '')}`;
        c(resp && resp.status() === 200, `${tag} status ${resp && resp.status()}`);
        const m = await p.evaluate(() => ({
          sw: document.documentElement.scrollWidth, iw: window.innerWidth,
          dir: document.documentElement.dir, lang: document.documentElement.lang,
          navOn: [...document.querySelectorAll('nav.main a[data-r].on')].map(a => a.dataset.r),
          tabOn: [...document.querySelectorAll('nav.tabbar a[data-r].on')].map(a => a.dataset.r),
          navShown: getComputedStyle(document.querySelector('nav.main')).display !== 'none',
          tabShown: getComputedStyle(document.querySelector('nav.tabbar')).display !== 'none',
          langShown: document.getElementById('ar').getBoundingClientRect().width > 0,
          field: getComputedStyle(document.body, '::before').position,
          glass: getComputedStyle(document.querySelector('header.site .bar')).backdropFilter,
          page: document.querySelectorAll('.page').length,
          enHref: document.getElementById('en').getAttribute('href'), arHref: document.getElementById('ar').getAttribute('href'),
        }));
        c(m.sw <= m.iw + 1, `${tag} horizontal overflow ${m.sw}>${m.iw}`);
        c((m.dir === 'rtl') === (lang === 'ar'), `${tag} dir`);
        c(m.page === 1, `${tag} page count`);
        const main = ['', 'about', 'events', 'community', 'ideas', 'join', 'faq'];
        c(main.includes(r) ? (m.navOn.length === 1 && m.navOn[0] === (r || 'home')) : m.navOn.length === 0, `${tag} nav highlight ${m.navOn}`);
        const tabs = ['', 'events', 'community', 'ideas', 'join'];
        c(tabs.includes(r) ? (m.tabOn.length === 1 && m.tabOn[0] === (r || 'home')) : m.tabOn.length === 0, `${tag} tab highlight ${m.tabOn}`);
        c(mobile ? (!m.navShown && m.tabShown) : (m.navShown && !m.tabShown), `${tag} nav/tabbar visibility nav=${m.navShown} tab=${m.tabShown}`);
        c(m.langShown, `${tag} language switch hidden`);
        c(m.field === 'fixed' && /blur/.test(m.glass), `${tag} glass styles not applied (${m.field}, ${m.glass})`);
        c(m.enHref === `/${r ? r + '/' : ''}` && m.arHref === `/ar/${r ? r + '/' : ''}`, `${tag} lang links ${m.enHref} ${m.arHref}`);
        // scrolled header
        await p.evaluate(() => window.scrollTo(0, 600)); await p.waitForTimeout(250);
        const sc = await p.evaluate(() => ({ s: document.querySelector('header.site').classList.contains('scrolled'), tall: document.documentElement.scrollHeight > 1400 }));
        c(!sc.tall || sc.s, `${tag} header did not compact on scroll`);
      }
      // join form: validation then a submit that posts to Netlify-style endpoint
      await p.route(`${BASE}/`, route => { if (route.request().method() === 'POST') { R.posted = route.request().postData(); route.fulfill({ status: 200, body: 'ok' }); } else route.continue(); });
      await p.goto(`${BASE}/${lang === 'ar' ? 'ar/' : ''}join/`); await p.waitForTimeout(150);
      await p.evaluate(() => document.getElementById('join-form').requestSubmit()); await p.waitForTimeout(200);
      const v = await p.evaluate(() => ({ tierErr: document.getElementById('tiers').classList.contains('err'), errs: document.querySelectorAll('#join-form .f.err').length, done: document.getElementById('join-done').hidden }));
      c(v.tierErr && v.errs === 5 && v.done, `[${w}/${lang}] join validation ${JSON.stringify(v)}`);
      await p.evaluate(() => {
        const f = document.getElementById('join-form');
        f.querySelector('input[name=tier][value=student]').click();
        f.name.value = 'Test Person'; f.email.value = 'test@sjc.ox.ac.uk'; f.college.value = 'Hertford College'; f.status.value = 'dphil'; f.consent_privacy.checked = true;
        f.requestSubmit();
      });
      await p.waitForTimeout(900);
      const d = await p.evaluate(() => ({ shown: !document.getElementById('join-done').hidden, text: document.getElementById('join-done').innerText.slice(0, 400), formHidden: document.getElementById('join-form').hidden }));
      c(d.shown && d.formHidden, `[${w}/${lang}] join confirmation not shown`);
      c(/OSS-[A-Z0-9]{7}/.test(d.text), `[${w}/${lang}] reference missing in confirmation`);
      c(R.posted && /form-name=join/.test(R.posted) && /name=Test\+Person/.test(R.posted), `[${w}/${lang}] Netlify post payload: ${String(R.posted).slice(0, 120)}`);
      await p.unroute(`${BASE}/`);
      // directory search box exists and filters do not throw
      await p.goto(`${BASE}/${lang === 'ar' ? 'ar/' : ''}community/`); await p.waitForTimeout(150);
      await p.click('#dir-filters .chip[data-g="alumni"]'); await p.waitForTimeout(100);
      const dirState = await p.evaluate(() => ({ on: document.querySelector('#dir-filters .chip.on').dataset.g, empty: !document.getElementById('dir-empty').hidden }));
      c(dirState.on === 'alumni', `[${w}/${lang}] chip did not activate`);
      // ideas: pending card without a token; Canny render with one; iframe with an embed link
      const ideasUrl = `${BASE}/${lang === 'ar' ? 'ar/' : ''}ideas/`;
      const html0 = await (await fetch(ideasUrl)).text();
      const withSettings = (patch) => html0.replace(/<script id="site-settings" type="application\/json">(.*?)<\/script>/s, (m, json) => `<script id="site-settings" type="application/json">${JSON.stringify(Object.assign(JSON.parse(json), patch))}</script>`);
      await p.goto(ideasUrl); await p.waitForTimeout(150);
      const i0 = await p.evaluate(() => ({ pending: document.getElementById('ideas-pending').hidden, link: !document.getElementById('ideas-link').hidden, open: !document.getElementById('ideas-open').hidden, href: document.getElementById('ideas-open-main').href, canny: !!document.getElementById('canny-jssdk') }));
      c(i0.pending && i0.link && i0.open && !i0.canny && i0.href === 'https://oxford-saudi-society.canny.io/ideas-or-events-suggestions', `[${w}/${lang}] ideas link-only state ${JSON.stringify(i0)}`);
      await p.route(ideasUrl, route => route.fulfill({ status: 200, contentType: 'text/html', body: withSettings({ ideas: { cannyBoardToken: '', url: '', embedUrl: '' } }) }));
      await p.goto(ideasUrl); await p.waitForTimeout(150);
      const iN = await p.evaluate(() => ({ pending: !document.getElementById('ideas-pending').hidden, link: document.getElementById('ideas-link').hidden, open: document.getElementById('ideas-open').hidden, mail: document.getElementById('ideas-pending-mail').textContent.length > 10 }));
      c(iN.pending && iN.link && iN.open && iN.mail, `[${w}/${lang}] ideas pending state ${JSON.stringify(iN)}`);
      await p.unroute(ideasUrl);
      await p.route(ideasUrl, route => route.fulfill({ status: 200, contentType: 'text/html', body: withSettings({ ideas: { cannyBoardToken: 'tok-123', url: 'https://example.canny.io/ideas' } }) }));
      await p.addInitScript(() => { window.Canny = function () { (window.__cannyCalls = window.__cannyCalls || []).push([].slice.call(arguments)); }; });
      await p.goto(ideasUrl); await p.waitForTimeout(200);
      const i1 = await p.evaluate(() => ({ calls: window.__cannyCalls, pending: document.getElementById('ideas-pending').hidden, link: document.getElementById('ideas-link').hidden, open: document.getElementById('ideas-open').hidden, href: document.getElementById('ideas-open').href, sdk: !!document.getElementById('canny-jssdk') }));
      const call = (i1.calls || [])[0] || [];
      c(call[0] === 'render' && call[1] && call[1].boardToken === 'tok-123' && call[1].basePath === (lang === 'ar' ? '/ar/ideas' : '/ideas') && call[1].theme === 'light', `[${w}/${lang}] Canny render call ${JSON.stringify(call)}`);
      c(i1.pending && !i1.open && i1.href === 'https://example.canny.io/ideas' && i1.link, `[${w}/${lang}] ideas with token: pending and link card hidden, open link shown ${JSON.stringify(i1)}`);
      await p.unroute(ideasUrl);
      await p.route(ideasUrl, route => route.fulfill({ status: 200, contentType: 'text/html', body: withSettings({ ideas: { embedUrl: 'https://example.org/board' } }) }));
      await p.route('https://example.org/board', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>board</p>' }));
      await p.goto(ideasUrl); await p.waitForTimeout(200);
      const i2 = await p.evaluate(() => { const f = document.querySelector('#ideas-board iframe'); return { frame: !!f, src: f && f.src, pending: document.getElementById('ideas-pending').hidden, h: f && f.getBoundingClientRect().height }; });
      c(i2.frame && i2.src === 'https://example.org/board' && i2.pending && i2.h >= 700, `[${w}/${lang}] ideas iframe fallback ${JSON.stringify(i2)}`);
      await p.unroute(ideasUrl); await p.unroute('https://example.org/board');
      // past committees: a details row opens and shows its note
      await p.goto(`${BASE}/${lang === 'ar' ? 'ar/' : ''}committees/`); await p.waitForTimeout(150);
      const pc = await p.evaluate(() => { const d = document.querySelectorAll('#committees-list details'); if (d[0]) d[0].open = true; return { n: d.length, open: d[0] && d[0].open, cur: document.querySelectorAll('#committees-list .term.current').length }; });
      c(pc.n === 44 && pc.open && pc.cur === 1, `[${w}/${lang}] committee history ${JSON.stringify(pc)}`);
    }
    c(errors.length === 0, `[${w}] console/page errors: ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(`${R.checks} checks, ${R.fails.length} failures`);
  R.fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(R.fails.length ? 1 : 0);
})();

// Static events pages: screenshots at 360/768/1280/1600 (EN + AR) and behaviour checks for the
// filters, view toggle, empty state and the registration dialog — with the API unavailable (404),
// which is how the pages must degrade. Run: node qa/events-static.js  (serves dist/ on :8766)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ics': 'text/calendar', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith('/api/')) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"not_found"}'); }
  let f = path.join(DIST, p); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('  FAIL', m); } };
(async () => {
  await new Promise((r) => srv.listen(8766, r));
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  for (const w of [360, 768, 1280, 1600]) {
    const phone = w < 600;
    const ctx = await b.newContext({ viewport: { width: w, height: phone ? 780 : 900 }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
    for (const lang of ['en', 'ar']) {
      const base = 'http://127.0.0.1:8766' + (lang === 'ar' ? '/ar' : '');
      const p = await ctx.newPage(); const errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(base + '/events/'); await p.waitForTimeout(400);
      const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, cards: document.querySelectorAll('.evc:not([hidden])').length, cols: getComputedStyle(document.getElementById('ev-upcoming')).gridTemplateColumns.split(' ').length, dir: document.documentElement.dir, count: document.getElementById('ev-count').textContent }));
      ok(m.sw <= m.iw, `${w}/${lang} overflow ${m.sw}>${m.iw}`);
      ok(m.cards === 11, `${w}/${lang} 11 cards visible (${m.cards})`);
      ok(w === 360 ? m.cols === 1 : w === 768 ? m.cols === 2 : m.cols === 3, `${w}/${lang} columns ${m.cols}`);
      ok(lang === 'ar' ? m.dir === 'rtl' : m.dir !== 'rtl', `${w}/${lang} dir`);
      await p.screenshot({ path: path.join(__dirname, 'shots', `ev-index-${lang}-${w}.png`), fullPage: true });
      if (w === 1280) {
        // search EN + AR, AND filters, clear, count, empty state
        await p.fill('#ev-q', 'eid'); await p.waitForTimeout(80);
        let v = await p.evaluate(() => document.querySelectorAll('.evc:not([hidden])').length); ok(v === 2, `${lang} search "eid" → 2 (${v})`);
        await p.fill('#ev-q', 'العيد'); await p.waitForTimeout(80);
        v = await p.evaluate(() => document.querySelectorAll('.evc:not([hidden])').length); ok(v === 2, `${lang} search "العيد" → 2 (${v})`);
        await p.fill('#ev-q', ''); await p.click('.chip[data-f="members"]'); await p.waitForTimeout(80);
        v = await p.evaluate(() => document.querySelectorAll('.evc:not([hidden])').length); ok(v === 3, `${lang} members → 3 (${v})`);
        await p.click('.chip[data-f="booking"]'); await p.waitForTimeout(80);
        v = await p.evaluate(() => document.querySelectorAll('.evc:not([hidden])').length); ok(v === 3, `${lang} members AND booking → 3 (${v})`);
        await p.click('.chip[data-f="free"]'); await p.waitForTimeout(80);
        v = await p.evaluate(() => document.querySelectorAll('.evc:not([hidden])').length); ok(v === 2, `${lang} members AND booking AND free → 2 (${v})`);
        const url1 = await p.evaluate(() => location.search); ok(/f=members/.test(url1) && /free/.test(url1), `${lang} url sync ${url1}`);
        await p.selectOption('#ev-cat', 'religion'); await p.waitForTimeout(80);
        v = await p.evaluate(() => ({ n: document.querySelectorAll('.evc:not([hidden])').length, empty: !document.getElementById('ev-empty').hidden }));
        ok(v.n === 0 && v.empty, `${lang} empty state (${JSON.stringify(v)})`);
        await p.screenshot({ path: path.join(__dirname, 'shots', `ev-empty-${lang}.png`), fullPage: false });
        await p.click('#ev-change'); await p.waitForTimeout(80);
        v = await p.evaluate(() => ({ n: document.querySelectorAll('.evc:not([hidden])').length, pressed: document.querySelectorAll('.chip[aria-pressed="true"]').length, q: document.activeElement && document.activeElement.id }));
        ok(v.n === 11 && v.pressed === 0 && v.q === 'ev-q', `${lang} clear resets (${JSON.stringify(v)})`);
        await p.selectOption('#ev-month', '2027-03'); await p.waitForTimeout(80);
        v = await p.evaluate(() => Array.from(document.querySelectorAll('.evc:not([hidden])')).map((c) => c.dataset.slug)); ok(v.length === 1 && v[0] === 'eid-al-fitr-celebration', `${lang} month filter ${v}`);
        await p.selectOption('#ev-month', ''); await p.click('.seg button[data-view="list"]'); await p.waitForTimeout(120);
        v = await p.evaluate(() => document.getElementById('ev-upcoming').classList.contains('list') && localStorage.getItem('oss-ev-view') === 'list'); ok(v, `${lang} list view`);
        await p.screenshot({ path: path.join(__dirname, 'shots', `ev-list-${lang}.png`), fullPage: true });
        await p.click('.seg button[data-view="grid"]');
        // keyboard: tab reaches the first card CTA
        const focusable = await p.evaluate(() => { const a = document.querySelector('.evc-cta'); a.focus(); return document.activeElement === a && getComputedStyle(a).outlineStyle !== undefined; }); ok(focusable, `${lang} card CTA focusable`);
      }
      ok(errors.length === 0, `${w}/${lang} index page errors: ${errors.join(' | ')}`);
      // detail page: interest (proposed), none (Saudi national day), members-only
      for (const slug of ['michaelmas-term-welcome', 'oxford-spring-gathering', 'annual-gathering-and-dinner']) {
        const errs = []; p.removeAllListeners('pageerror'); p.on('pageerror', (e) => errs.push(e.message));
        await p.goto(base + '/events/' + slug + '/'); await p.waitForTimeout(300);
        const d = await p.evaluate(() => { const c = document.getElementById('reg-cta'); return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, key: c.dataset.key, disabled: c.disabled, text: c.textContent, hasTicketClaim: /seat is confirmed|ticket is confirmed/i.test(document.body.textContent), barHidden: document.getElementById('cta-bar').hidden, notice: !!document.querySelector('.ev-note') }; });
        ok(d.sw <= d.iw, `${w}/${lang}/${slug} overflow ${d.sw}>${d.iw}`);
        ok(!d.hasTicketClaim, `${slug} no confirmed-ticket claim`);
        if (slug === 'michaelmas-term-welcome') ok(d.key === 'interest' && !d.disabled, `${slug} interest CTA (${d.key})`);
        if (slug === 'oxford-spring-gathering') ok(d.key === 'none' && d.disabled, `${slug} no-booking CTA (${d.key})`);
        if (slug === 'annual-gathering-and-dinner') ok(d.key === 'interest' && d.notice, `${slug} interest + price notice (${d.key})`);
        if (w === 360 || w === 1280) await p.screenshot({ path: path.join(__dirname, 'shots', `ev-${slug}-${lang}-${w}.png`), fullPage: true });
        if (slug === 'michaelmas-term-welcome' && (w === 360 || w === 1280)) {
          // open dialog, validate, submit against the dead API → graceful error
          await p.click('#reg-cta'); await p.waitForTimeout(200);
          let dd = await p.evaluate(() => ({ open: document.getElementById('reg-dialog').open, kind: document.getElementById('reg-kind').textContent, submit: document.getElementById('reg-submit').textContent, sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
          ok(dd.open, `${w}/${lang} dialog opens`); ok(/interest|اهتمام/i.test(dd.kind), `${lang} dialog kind "${dd.kind}"`); ok(/not a booking|ليس حجزًا/i.test(dd.submit), `${lang} submit label "${dd.submit}"`);
          await p.screenshot({ path: path.join(__dirname, 'shots', `ev-dialog-${lang}-${w}.png`), fullPage: false });
          await p.click('#reg-submit'); await p.waitForTimeout(150);
          dd = await p.evaluate(() => ({ errs: document.getElementById('reg-errs').textContent, invalid: document.querySelectorAll('#reg-form .f.err').length, focus: document.activeElement.id }));
          ok(dd.invalid === 3 && dd.focus === 'reg-name', `${lang} validation marks 3 fields, focuses name (${JSON.stringify(dd)})`);
          await p.fill('#reg-name', 'Test Person'); await p.fill('#reg-email', 'test@example.org'); await p.check('#reg-privacy');
          await p.click('#reg-submit'); await p.waitForTimeout(500);
          dd = await p.evaluate(() => ({ errs: document.getElementById('reg-errs').textContent, doneHidden: document.getElementById('reg-done').hidden }));
          ok(dd.doneHidden && /unavailable|غير متاح/.test(dd.errs), `${lang} API down → unavailable message, no false success (${dd.errs})`);
          await p.screenshot({ path: path.join(__dirname, 'shots', `ev-dialog-err-${lang}-${w}.png`), fullPage: false });
          await p.click('#reg-cancel'); await p.waitForTimeout(100);
          ok(!(await p.evaluate(() => document.getElementById('reg-dialog').open)), `${lang} dialog closes`);
          // ?verified= banner
          await p.goto(base + '/events/' + slug + '/?verified=interest'); await p.waitForTimeout(300);
          const bn = await p.evaluate(() => ({ t: document.getElementById('reg-state').textContent, url: location.search }));
          ok(/not a ticket|ليس حجزًا|ولا يُعد ذلك حجزًا/.test(bn.t) && bn.url === '', `${lang} verified banner + clean url (${bn.t.slice(0, 40)} | ${bn.url})`);
        }
        ok(errs.length === 0, `${w}/${lang}/${slug} page errors: ${errs.join(' | ')}`);
      }
      await p.close();
    }
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(`${n} checks, ${fails} failures`);
  process.exit(fails ? 1 : 0);
})();

// FAQ page: screenshots (EN/AR, 1280/360) and behaviour (search EN/AR, chips, expand all, deep link, copy).
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith('/api/')) { res.writeHead(404); return res.end(); }
  let f = path.join(DIST, p); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
let n = 0, fails = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log('  FAIL', m); } };
(async () => {
  await new Promise((r) => srv.listen(8769, r));
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const w of [360, 1280]) {
    const phone = w < 600;
    const ctx = await b.newContext({ viewport: { width: w, height: phone ? 780 : 900 }, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
    for (const lang of ['en', 'ar']) {
      const base = 'http://127.0.0.1:8769' + (lang === 'ar' ? '/ar' : '');
      const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(base + '/faq/'); await p.waitForTimeout(400);
      const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, items: document.querySelectorAll('.faq-item').length, secs: document.querySelectorAll('.faq-sec').length, chips: document.querySelectorAll('.faq-nav .chip').length, open: document.querySelectorAll('.faq-item[open]').length, count: document.getElementById('faq-count').textContent, dir: document.documentElement.dir }));
      ok(m.sw <= m.iw, `${w}/${lang} overflow ${m.sw}>${m.iw}`);
      ok(m.items === 57 && m.secs === 8 && m.chips === 8, `${w}/${lang} structure ${JSON.stringify(m)}`);
      ok(m.open === 0, `${w}/${lang} all collapsed on load (${m.open})`);
      ok(lang === 'ar' ? /٥٧/.test(m.count) : /57 questions/.test(m.count), `${w}/${lang} count "${m.count}"`);
      await p.screenshot({ path: path.join(__dirname, 'shots', `faq-${lang}-${w}.png`), fullPage: false });
      // search in both scripts
      await p.fill('#faq-q', lang === 'ar' ? 'سفير' : 'Safir'); await p.waitForTimeout(120);
      let v = await p.evaluate(() => ({ vis: document.querySelectorAll('.faq-item:not([hidden])').length, open: document.querySelectorAll('.faq-item:not([hidden])[open]').length, secs: document.querySelectorAll('.faq-sec:not([hidden])').length, url: location.search }));
      ok(v.vis >= 6 && v.vis <= 14 && v.open === v.vis && v.secs >= 1, `${w}/${lang} search safir → ${JSON.stringify(v)}`);
      await p.fill('#faq-q', lang === 'ar' ? 'طبيب الأسرة' : 'GP surgery'); await p.waitForTimeout(120);
      v = await p.evaluate(() => Array.from(document.querySelectorAll('.faq-item:not([hidden])')).map((d) => d.id));
      ok(v.includes('register-gp'), `${w}/${lang} search gp → ${v}`);
      await p.fill('#faq-q', 'zzzzqq'); await p.waitForTimeout(120);
      v = await p.evaluate(() => ({ vis: document.querySelectorAll('.faq-item:not([hidden])').length, empty: !document.getElementById('faq-empty').hidden }));
      ok(v.vis === 0 && v.empty, `${w}/${lang} empty state ${JSON.stringify(v)}`);
      if (w === 1280) await p.screenshot({ path: path.join(__dirname, 'shots', `faq-empty-${lang}.png`), fullPage: false });
      await p.click('#faq-clear'); await p.waitForTimeout(120);
      v = await p.evaluate(() => ({ vis: document.querySelectorAll('.faq-item:not([hidden])').length, open: document.querySelectorAll('.faq-item[open]').length, q: document.getElementById('faq-q').value }));
      ok(v.vis === 57 && v.open === 0 && v.q === '', `${w}/${lang} clear restores ${JSON.stringify(v)}`);
      // expand all / collapse all
      await p.click('#faq-toggle'); await p.waitForTimeout(120);
      v = await p.evaluate(() => ({ open: document.querySelectorAll('.faq-item[open]').length, label: document.getElementById('faq-toggle').textContent }));
      ok(v.open === 57 && /Collapse|طيّ/.test(v.label), `${w}/${lang} expand all ${JSON.stringify(v)}`);
      if (w === 1280) await p.screenshot({ path: path.join(__dirname, 'shots', `faq-expanded-${lang}.png`), fullPage: true });
      await p.click('#faq-toggle'); await p.waitForTimeout(120);
      ok((await p.evaluate(() => document.querySelectorAll('.faq-item[open]').length)) === 0, `${w}/${lang} collapse all`);
      // chip navigation
      await p.click('.faq-nav .chip[data-sec="housing"]'); await p.waitForTimeout(1400);
      v = await p.evaluate(() => { const r = document.getElementById('faq-housing').getBoundingClientRect(); return { top: r.top, hash: location.hash }; });
      ok(v.top >= 0 && v.top < 260 && v.hash === '#faq-housing', `${w}/${lang} chip scrolls to section ${JSON.stringify(v)}`);
      // deep link opens the question
      await p.goto(base + '/faq/#bench-fees'); await p.waitForTimeout(1400);
      v = await p.evaluate(() => { const d = document.getElementById('bench-fees'); return { open: d.open, top: d.getBoundingClientRect().top, refs: d.querySelectorAll('.faq-refs a').length }; });
      ok(v.open && v.top >= 0 && v.top < 300 && v.refs === 1, `${w}/${lang} deep link ${JSON.stringify(v)}`);
      if (w === 1280) await p.screenshot({ path: path.join(__dirname, 'shots', `faq-deeplink-${lang}.png`), fullPage: false });
      // opening a question writes the hash; answers are in the page language
      await p.evaluate(() => { document.getElementById('heathrow-to-oxford').open = true; });
      await p.waitForTimeout(100);
      v = await p.evaluate(() => location.hash); ok(v === '#heathrow-to-oxford', `${w}/${lang} hash follows opened question (${v})`);
      const txt = await p.evaluate(() => document.querySelector('#heathrow-to-oxford .faq-a p').textContent);
      ok(lang === 'ar' ? /هيثرو|أكسفورد/.test(txt) : /Heathrow/.test(txt), `${w}/${lang} answer language`);
      ok(errors.length === 0, `${w}/${lang} page errors ${errors.join(' | ')}`);
      await p.close();
    }
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(`${n} checks, ${fails} failures`); process.exit(fails ? 1 : 0);
})();

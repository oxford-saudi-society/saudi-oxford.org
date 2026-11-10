// Drives the three-step join form in a real browser (shared by the browser tests).
//   tier      one of saudi | student | external | associate | mailing | volunteer
//   place     for "external": brookes | uk_university | global_university
//   status    the step-2 card to pick (memberships)
//   areas / interests   step-2 switches (volunteer / mailing)
//   selects   { elementId: value }  — chosen first in step 3, because they decide which fields appear
//   fields    { elementId: text }
//   checks    [ elementId ]         — switches to turn on
//   submit    false to stop on step 3 without sending
async function join(p, base, lang, o) {
  await p.goto(base + (lang === 'ar' ? '/ar' : '') + '/join/'); await p.waitForTimeout(400);
  await toStep3(p, o);
  if (o.submit !== false) { await centre(p, '#submit-btn'); await p.click('#submit-btn'); await p.waitForTimeout(1500); }
  return done(p);
}
/* Bring a control to the middle of the screen before using it, so the fixed header or the phone's bottom bar never sits on top of it. */
const centre = (p, sel) => p.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
async function card(p, group, value) { const sel = `${group} label:has(input[value="${value}"])`; await centre(p, sel); await p.locator(sel).first().click(); }
async function tick(p, sel) { await centre(p, sel); await p.check(sel, { force: true }); }
async function next(p, n) { const sel = `#step-${n} [data-go=next]`; await centre(p, sel); await p.click(sel); await p.waitForTimeout(350); }
async function toStep3(p, o) {
  await card(p, '#tiers', o.tier);
  await next(p, 1);
  if (o.place) { await card(p, '#places', o.place); await p.waitForTimeout(150); }
  if (o.status) await card(p, '#statuses', o.status);
  for (const a of o.areas || []) await tick(p, `#areas input[value=${a}]`);
  for (const a of o.interests || []) await tick(p, `#interests input[value=${a}]`);
  await next(p, 2);
  await fill(p, o);
}
async function fill(p, o) {
  for (const [id, v] of Object.entries(o.selects || {})) { await centre(p, '#' + id); await p.selectOption('#' + id, v); await p.waitForTimeout(100); }
  for (const [id, v] of Object.entries(o.fields || {})) await p.fill('#' + id, v);
  for (const id of o.checks || []) await tick(p, '#' + id);
  await p.waitForTimeout(100);
}
const done = (p) => p.evaluate(() => {
  const d = document.getElementById('join-done');
  return {
    done: !d.hidden, text: d.innerText, no: (document.getElementById('mno') || {}).textContent || '', q: (document.querySelector('.qno') || {}).textContent || '', stage: (document.getElementById('mstage') || {}).textContent || '',
    step: [1, 2, 3].find((i) => !document.getElementById('step-' + i).hidden) || 0,
    errs: Array.from(document.querySelectorAll('#join-form .step:not([hidden]) .f.err')).map((f) => f.getAttribute('data-f')),
    fail: !!(document.getElementById('join-fail') && !document.getElementById('join-fail').hidden),
  };
});
/* The fields step 3 is showing right now, in order. */
const shown = (p) => p.evaluate(() => Array.from(document.querySelectorAll('#step-3 [data-f]')).filter((f) => !f.hidden).map((f) => f.getAttribute('data-f')));
module.exports = { join, toStep3, fill, done, shown, card, tick, next, centre };

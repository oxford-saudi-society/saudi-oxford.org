'use strict';
/* Pre-build step: when SITE_API_URL is set (e.g. https://saudi-oxford.org), fetch the live operational
   state of the programme (status, registration mode, dates the committee changed in the desk) and save it
   to src/content/_live-events.json so the static pages are rendered from the same truth the API serves.
   Without the variable (or if the API is unreachable) the build simply uses the content files. */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'src', 'content', '_live-events.json');
(async () => {
  const base = (process.env.SITE_API_URL || '').replace(/\/$/, '');
  if (!base) { if (fs.existsSync(OUT)) fs.unlinkSync(OUT); return; }
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(base + '/api/events', { signal: ctl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data || !Array.isArray(data.events)) throw new Error('unexpected payload');
    fs.writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), events: data.events }, null, 1));
    console.log(`live state: ${data.events.length} events from ${base}`);
  } catch (e) {
    console.warn(`live state unavailable (${e.message}); building from content files`);
    if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
  }
})();

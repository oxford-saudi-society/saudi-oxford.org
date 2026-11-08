'use strict';
/* Time helpers shared by the build (CommonJS) and the functions (ESM imports this file).
   All event times are Oxford civil time (Europe/London); instants are stored in UTC. */

const TZ = 'Europe/London';

// Offset of `tz` at a given instant, in minutes (e.g. London summer = 60).
function offsetAt(instant, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = {}; for (const { type, value } of dtf.formatToParts(instant)) p[type] = value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - instant.getTime()) / 60000);
}

// "2027-03-28T01:30:00" in tz → Date (UTC instant). Two-pass so DST transitions resolve correctly.
function zonedToUtc(localIso, tz = TZ) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(localIso || ''));
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  let off = offsetAt(new Date(guess), tz);
  let inst = guess - off * 60000;
  const off2 = offsetAt(new Date(inst), tz);
  if (off2 !== off) inst = guess - off2 * 60000;
  return new Date(inst);
}

// Date → "YYYY-MM-DDTHH:mm" in tz
function utcToZonedIso(instant, tz = TZ) {
  const d = instant instanceof Date ? instant : new Date(instant);
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = {}; for (const { type, value } of dtf.formatToParts(d)) p[type] = value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const LOCALE = { en: 'en-GB', ar: 'ar-SA-u-ca-gregory-nu-arab' };

function fmtDate(instant, lang, opts) {
  const d = instant instanceof Date ? instant : new Date(instant);
  return new Intl.DateTimeFormat(LOCALE[lang] || LOCALE.en, Object.assign({ timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, opts || {})).format(d);
}
function fmtDateLong(instant, lang) { return fmtDate(instant, lang, { weekday: 'long', month: 'long' }); }
function fmtTime(instant, lang) {
  const d = instant instanceof Date ? instant : new Date(instant);
  return new Intl.DateTimeFormat(LOCALE[lang] || LOCALE.en, { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
}
function fmtRange(start, end, lang) { return `${fmtTime(start, lang)}–${fmtTime(end, lang)}`; }
// "1 DEC 2026" style pill
function fmtPill(instant, lang) {
  const d = instant instanceof Date ? instant : new Date(instant);
  const s = new Intl.DateTimeFormat(LOCALE[lang] || LOCALE.en, { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  return lang === 'ar' ? s : s.toUpperCase();
}
function monthKey(instant) { return utcToZonedIso(instant).slice(0, 7); } // YYYY-MM in Oxford time
function fmtMonth(instant, lang) {
  const d = instant instanceof Date ? instant : new Date(instant);
  return new Intl.DateTimeFormat(LOCALE[lang] || LOCALE.en, { timeZone: TZ, month: 'long', year: 'numeric' }).format(d);
}
// ICS timestamp in UTC
function icsUtc(instant) { const d = instant instanceof Date ? instant : new Date(instant); return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }
// "Tuesday 1 December 2026, 18:00–21:00 (Oxford time)"
function fmtWhen(start, end, lang) {
  return lang === 'ar'
    ? `${fmtDateLong(start, 'ar')}، ${fmtRange(start, end, 'ar')} (بتوقيت أكسفورد)`
    : `${fmtDateLong(start, 'en')}, ${fmtRange(start, end, 'en')} (Oxford time)`;
}

module.exports = { TZ, offsetAt, zonedToUtc, utcToZonedIso, fmtDate, fmtDateLong, fmtTime, fmtRange, fmtPill, fmtMonth, fmtWhen, monthKey, icsUtc, LOCALE };

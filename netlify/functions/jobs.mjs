/* Scheduled housekeeping (every 10 minutes): deliver queued mail, expire waitlist offers and
   verification links, send reminders for confirmed events, mark finished events, apply retention. */
import { ready } from '../lib/db.mjs';
import { processOutbox, enqueue } from '../lib/mail.mjs';
import * as E from '../lib/events.mjs';

export const config = { schedule: '*/10 * * * *' };

export default async function handler() {
  const db = await ready();
  await E.ensureSeeded(db);
  const out = await runJobs(db, process.env.SITE_URL || process.env.URL || E.SETTINGS.domain || '');
  console.log('[jobs]', JSON.stringify(out));
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
}

export async function runJobs(db, site, now = new Date()) {
  const out = {};
  out.offersExpired = await E.expireOffers(db, site);
  out.pendingPurged = (await db.query(`DELETE FROM oss_pending WHERE (used_at IS NOT NULL AND used_at < now() - interval '7 days') OR (used_at IS NULL AND expires_at < now() - interval '7 days')`)).rowCount || 0;
  out.idempotencyPurged = (await db.query(`DELETE FROM oss_idempotency WHERE created_at < now() - interval '2 days'`)).rowCount || 0;
  out.rateWindowsPurged = (await db.query(`DELETE FROM oss_rate_limits WHERE window_start < now() - interval '1 day'`)).rowCount || 0;
  out.reminders = await sendReminders(db, site, now);
  out.completed = (await db.query(`UPDATE oss_events SET event_status = 'completed', updated_at = now() WHERE event_status = 'confirmed' AND end_utc < now() - interval '6 hours'`)).rowCount || 0;
  out.retention = await applyRetention(db, now);
  out.mail = await processOutbox(db, 50);
  return out;
}

/* 7 days and 1 day before a confirmed event, to confirmed attendees, once each. */
async function sendReminders(db, site, now) {
  let n = 0;
  const windows = [{ kind: 'reminder_7d', from: 6.5, to: 7.5, words: { en: 'in one week', ar: 'بعد أسبوع' } }, { kind: 'reminder_1d', from: 0.5, to: 1.5, words: { en: 'tomorrow', ar: 'غدًا' } }];
  for (const w of windows) {
    const evs = (await db.query(`SELECT * FROM oss_events WHERE event_status = 'confirmed' AND published AND start_utc BETWEEN $1 AND $2`, [new Date(now.getTime() + w.from * 86400000), new Date(now.getTime() + w.to * 86400000)])).rows;
    for (const ev of evs) {
      const regs = (await db.query(`SELECT r.* FROM oss_registrations r WHERE r.event_id = $1 AND r.status = 'confirmed' AND NOT EXISTS (SELECT 1 FROM oss_reminders m WHERE m.registration_id = r.id AND m.kind = $2)`, [ev.id, w.kind])).rows;
      for (const r of regs) {
        await db.tx(async (q) => {
          const ins = await q.query('INSERT INTO oss_reminders (registration_id, kind) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING registration_id', [r.id, w.kind]);
          if (!ins.rows.length) return;
          const token = await E.issueTicket(q, r.id);
          const u = E.urls(site, r.lang, ev);
          await enqueue(q, { kind: 'reminder', to: r.email, lang: r.lang, registrationId: r.id, eventId: ev.id, dedupeKey: `${w.kind}:${r.id}`, vars: Object.assign({ name: r.name, ev: E.titled(ev, r.lang), venue: E.venueName(ev, r.lang), inWords: w.words[r.lang], ticketUrl: `${site}/t/${token}` }, u) });
          n++;
        });
      }
    }
  }
  return n;
}

/* Retention (proposal from the package, owner-configurable): anonymise ordinary event PII N days after the event. */
async function applyRetention(db, now) {
  if ((process.env.RETENTION_ENABLED || '').toLowerCase() !== 'true') return { enabled: false };
  const days = Math.max(30, Number(process.env.RETENTION_DAYS || 90));
  const r = await db.query(`UPDATE oss_registrations r SET name = 'anonymised', email = 'anon-' || substr(md5(r.id::text), 1, 12) || '@anonymised.invalid', updated_at = now()
    FROM oss_events e WHERE e.id = r.event_id AND e.end_utc < $1 AND r.email NOT LIKE 'anon-%@anonymised.invalid' AND NOT (r.marketing_opt_in AND r.status IN ('confirmed','checked_in'))`, [new Date(now.getTime() - days * 86400000)]);
  const m = await db.query(`DELETE FROM oss_mail_outbox WHERE created_at < $1`, [new Date(now.getTime() - days * 86400000)]);
  return { enabled: true, days, anonymised: r.rowCount || 0, mailPurged: m.rowCount || 0 };
}

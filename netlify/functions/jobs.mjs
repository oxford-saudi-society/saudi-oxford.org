/* Scheduled housekeeping (every 10 minutes): deliver queued mail, expire waitlist offers and
   verification links, send reminders for confirmed events, mark finished events, apply the retention periods published in the privacy notice. */
import { ready } from '../lib/db.mjs';
import { processOutbox, enqueue } from '../lib/mail.mjs';
import * as E from '../lib/events.mjs';
import * as M from '../lib/membership.mjs';

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

/* Retention, exactly as published in the privacy notice (2026-11-09). It is always on.
   RETENTION_PAUSED=true stops every deletion (a legal hold on everything); oss_members.legal_hold protects one record.
   · dietary / accessibility notes ........ cleared 7 days after the event ends
   · event registration records ........... deleted 30 days after the event ends (anonymous totals stay on the event)
   · membership records ................... deleted 12 months after the membership ends (or an application lapses)
   · proof-of-nationality documents ....... deleted when the result is recorded; never kept beyond 30 days unchecked
   · delivered email ...................... the outbox is a delivery queue, not an archive: cleared after 30 days
   Financial transaction records are not held by this system (the treasurer keeps them, for six years where required). */
export const RETENTION = { requirementsDays: 7, registrationDays: 30, membershipMonths: 12, mailDays: 30 };
const ago = (now, days) => new Date(now.getTime() - days * 86400000);
const monthsAgo = (now, months) => { const d = new Date(now.getTime()); d.setUTCMonth(d.getUTCMonth() - months); return d; };

export async function applyRetention(db, now = new Date()) {
  if ((process.env.RETENTION_PAUSED || '').toLowerCase() === 'true') return { paused: true };
  const out = { paused: false };

  // 1 · dietary and accessibility information: within 7 days after the event
  out.requirementsCleared = (await db.query(`UPDATE oss_registrations r SET requirements = NULL, updated_at = now() FROM oss_events e
    WHERE e.id = r.event_id AND r.requirements IS NOT NULL AND e.end_utc < $1`, [ago(now, RETENTION.requirementsDays)])).rowCount || 0;
  out.pendingNotesCleared = (await db.query(`UPDATE oss_pending p SET payload = p.payload - 'requirements' FROM oss_events e
    WHERE e.id = p.event_id AND p.payload ? 'requirements' AND e.end_utc < $1`, [ago(now, RETENTION.requirementsDays)])).rowCount || 0;

  // 2 · event registration records: 30 days after the event
  out.registrationsDeleted = 0; out.subscribersKept = 0;
  const due = (await db.query(`SELECT e.id FROM oss_events e WHERE e.end_utc < $1 AND EXISTS (SELECT 1 FROM oss_registrations r WHERE r.event_id = e.id)`, [ago(now, RETENTION.registrationDays)])).rows;
  for (const ev of due) {
    await db.tx(async (q) => {
      const counts = Object.fromEntries((await q.query('SELECT status, count(*)::int AS n FROM oss_registrations WHERE event_id = $1 GROUP BY status', [ev.id])).rows.map((x) => [x.status, x.n]));
      await q.query('UPDATE oss_events SET final_counts = $2 WHERE id = $1', [ev.id, JSON.stringify(Object.assign({ deletedAt: now.toISOString() }, counts))]);
      // people who asked for Society news keep that one subscription (their consent), without the registration
      out.subscribersKept += (await q.query(`INSERT INTO oss_subscribers (email, name, lang, consent_at, source)
        SELECT DISTINCT ON (email) email, name, lang, COALESCE(marketing_opt_in_at, consent_at), 'event' FROM oss_registrations
        WHERE event_id = $1 AND marketing_opt_in AND status IN ('interested','confirmed','checked_in','waitlisted','offered') ORDER BY email, created_at DESC
        ON CONFLICT (email) DO NOTHING`, [ev.id])).rowCount || 0;
      const sub = 'SELECT id FROM oss_registrations WHERE event_id = $1';
      await q.query(`DELETE FROM oss_reminders WHERE registration_id IN (${sub})`, [ev.id]);
      await q.query(`DELETE FROM oss_checkins WHERE event_id = $1 OR registration_id IN (${sub})`, [ev.id]);
      await q.query(`DELETE FROM oss_ticket_tokens WHERE registration_id IN (${sub})`, [ev.id]);
      await q.query(`DELETE FROM oss_mail_outbox WHERE event_id = $1 OR registration_id IN (${sub})`, [ev.id]);
      await q.query(`DELETE FROM oss_pending WHERE event_id = $1 OR registration_id IN (${sub})`, [ev.id]);
      await q.query(`DELETE FROM oss_audit WHERE resource IN (SELECT 'registration:' || id::text FROM oss_registrations WHERE event_id = $1)`, [ev.id]);
      out.registrationsDeleted += (await q.query('DELETE FROM oss_registrations WHERE event_id = $1', [ev.id])).rowCount || 0;
      await q.query(`INSERT INTO oss_audit (actor, action, resource, meta) VALUES ('system', 'retention.registrations_deleted', $1, $2)`, ['event:' + ev.id, JSON.stringify(counts)]);
    });
  }

  // 3 · membership: a lapsed membership is marked expired, and the record goes 12 months after it ended
  out.membershipsExpired = (await db.query(`UPDATE oss_members SET status = 'expired', updated_at = now() WHERE status = 'approved' AND valid_until IS NOT NULL AND valid_until < $1::date`, [now])).rowCount || 0;
  const cut = monthsAgo(now, RETENTION.membershipMonths);
  const gone = (await db.query(`SELECT email, member_no, status FROM oss_members WHERE NOT legal_hold AND (
      (status IN ('declined','revoked') AND COALESCE(decided_at, updated_at) < $1)
      OR (status = 'expired' AND COALESCE(valid_until::timestamptz, decided_at, updated_at) < $1)
      OR (status IN ('pending','info_requested') AND GREATEST(COALESCE(applied_at, created_at), COALESCE(info_requested_at, created_at), COALESCE(info_response_at, created_at)) < $1))`, [cut])).rows;
  out.membersDeleted = 0;
  for (const m of gone) {
    await db.tx(async (q) => {
      await q.query('DELETE FROM oss_pending WHERE email = $1 AND event_id IS NULL', [m.email]);
      await q.query(`DELETE FROM oss_mail_outbox WHERE to_email = $1 AND kind LIKE 'membership%'`, [m.email]);
      await q.query('DELETE FROM oss_audit WHERE resource = $1', ['member:' + m.member_no]);
      await q.query('DELETE FROM oss_subscribers WHERE email = $1 AND source = $2', [m.email, 'membership']);
      out.membersDeleted += (await q.query('DELETE FROM oss_members WHERE email = $1', [m.email])).rowCount || 0; // the uploaded document, if any, goes with it (cascade)
      await q.query(`INSERT INTO oss_audit (actor, action, resource, meta) VALUES ('system', 'retention.member_deleted', NULL, $1)`, [JSON.stringify({ was: m.status })]);
    });
  }

  // 4 · proof-of-nationality documents nobody has checked
  out.evidenceExpired = await db.tx((q) => M.expireEvidence(q));

  // 5 · delivered (or abandoned) email
  out.mailPurged = (await db.query(`DELETE FROM oss_mail_outbox WHERE status IN ('sent','dead') AND created_at < $1`, [ago(now, RETENTION.mailDays)])).rowCount || 0;
  return out;
}

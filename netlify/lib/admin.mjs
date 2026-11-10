/* Committee desk (staff-only) operations. Every handler receives a staff row already loaded from oss_staff. */
import * as T from '../../shared/time.cjs';
import { fail, normEmail, validEmail, cleanName } from './http.mjs';
import { requireRole, rateLimit } from './auth.mjs';
import { enqueue } from './mail.mjs';
import { getEvent, counts, stateOf, publicEvent, titled, venueName, urls, audit, cancelRegistration, promoteWaitlist, revokeTickets, issueTicket, checkInByToken, checkInRegistration, displayName, maskEmail, ACTIVE, SEATED, VENUES, L } from './events.mjs';

const ISO = (v) => { if (v == null || v === '') return null; const d = new Date(v); if (isNaN(d)) fail(400, 'bad_date'); return d; };

export async function overview(q, staff) {
  requireRole(staff, 'checkin_staff');
  const evs = (await q.query('SELECT * FROM oss_events ORDER BY start_utc')).rows.filter((e) => staff.role === 'super_admin' || !Array.isArray(staff.event_ids) || !staff.event_ids.length || staff.event_ids.includes(e.id));
  const out = [];
  for (const ev of evs) {
    const c = await counts(q, ev.id);
    out.push(Object.assign(publicEvent(ev, c), { title: ev.content.title, venue: { en: venueName(ev, 'en'), ar: venueName(ev, 'ar') }, counts: c, published: ev.published, visibility: ev.visibility, startLocal: T.utcToZonedIso(ev.start_utc), endLocal: T.utcToZonedIso(ev.end_utc) }));
  }
  const mail = (await q.query(`SELECT status, count(*)::int AS n FROM oss_mail_outbox GROUP BY status`)).rows;
  return { events: out, mail: Object.fromEntries(mail.map((m) => [m.status, m.n])), me: { email: staff.email, role: staff.role, eventIds: staff.event_ids } };
}

export async function eventDetail(q, staff, id) {
  requireRole(staff, 'checkin_staff', id);
  const ev = await getEvent(q, id); if (!ev) fail(404, 'not_found');
  const c = await counts(q, ev.id);
  const recent = (await q.query(`SELECT id, status, kind, created_at FROM oss_registrations WHERE event_id = $1 ORDER BY created_at DESC LIMIT 10`, [ev.id])).rows;
  return { event: Object.assign(publicEvent(ev, c), { title: ev.content.title, counts: c, startLocal: T.utcToZonedIso(ev.start_utc), endLocal: T.utcToZonedIso(ev.end_utc), venues: Object.keys(VENUES).map((k) => ({ key: k, name: VENUES[k].name })) }), recent };
}

/* Edit the operational fields. Material changes (date/venue/postpone/cancel) with registrants require preview → confirm. */
export async function updateEvent(q, staff, id, body, site) {
  requireRole(staff, 'events_admin', id);
  const ev = await getEvent(q, id, { lock: true }); if (!ev) fail(404, 'not_found');
  const c = await counts(q, ev.id);
  const next = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  if (has('eventStatus')) { if (!['proposed', 'confirmed', 'postponed', 'cancelled', 'completed'].includes(body.eventStatus)) fail(400, 'bad_status'); next.event_status = body.eventStatus; }
  if (has('registrationMode')) { if (!['none', 'interest_only', 'open', 'waitlist_only', 'closed'].includes(body.registrationMode)) fail(400, 'bad_mode'); next.registration_mode = body.registrationMode; }
  if (has('audience')) { if (!['public', 'members'].includes(body.audience)) fail(400, 'bad_audience'); next.audience = body.audience; }
  if (has('priceStatus')) { if (!['free', 'tbd'].includes(body.priceStatus)) fail(400, 'paid_not_enabled'); next.price_status = body.priceStatus; }
  if (has('capacity')) { const cap = body.capacity === null || body.capacity === '' ? null : Number(body.capacity); if (cap != null && (!Number.isInteger(cap) || cap < 0 || cap > 100000)) fail(400, 'bad_capacity'); if (cap != null && cap < c.seated) fail(400, 'capacity_below_seated', { seated: c.seated }); next.capacity = cap; }
  if (has('waitlistEnabled')) next.waitlist_enabled = !!body.waitlistEnabled;
  if (has('bookingOpensAt')) next.booking_opens_at = ISO(body.bookingOpensAt);
  if (has('bookingClosesAt')) next.booking_closes_at = ISO(body.bookingClosesAt);
  if (has('startLocal') || has('endLocal')) {
    const s = has('startLocal') ? T.zonedToUtc(body.startLocal) : ev.start_utc, e = has('endLocal') ? T.zonedToUtc(body.endLocal) : ev.end_utc;
    if (!s || !e || e <= s) fail(400, 'bad_times');
    next.start_utc = s; next.end_utc = e;
  }
  if (has('venueKey')) { if (body.venueKey && !VENUES[body.venueKey]) fail(400, 'bad_venue'); next.venue_key = body.venueKey || null; }
  if (has('published')) next.published = !!body.published;
  const opening = (next.registration_mode === 'open' || next.registration_mode === 'waitlist_only') && (next.event_status || ev.event_status) !== 'confirmed';
  if (opening) fail(400, 'confirm_before_opening');
  // what changes, in words (both languages) for the notice
  const changes = [];
  const sameT = (a, b) => new Date(a).getTime() === new Date(b).getTime();
  if (next.start_utc && !(sameT(next.start_utc, ev.start_utc) && sameT(next.end_utc, ev.end_utc))) changes.push({ en: `Date/time: ${T.fmtWhen(ev.start_utc, ev.end_utc, 'en')} → ${T.fmtWhen(next.start_utc, next.end_utc, 'en')}`, ar: `الموعد: ${T.fmtWhen(ev.start_utc, ev.end_utc, 'ar')} ← ${T.fmtWhen(next.start_utc, next.end_utc, 'ar')}` });
  if (has('venueKey') && next.venue_key !== ev.venue_key) changes.push({ en: `Venue: ${venueName(ev, 'en')} → ${venueName(Object.assign({}, ev, next), 'en')}`, ar: `المكان: ${venueName(ev, 'ar')} ← ${venueName(Object.assign({}, ev, next), 'ar')}` });
  const statusChange = next.event_status && next.event_status !== ev.event_status ? next.event_status : null;
  const material = changes.length > 0 || statusChange === 'postponed' || statusChange === 'cancelled';
  const recipients = material ? (await q.query(`SELECT * FROM oss_registrations WHERE event_id = $1 AND status = ANY($2)`, [ev.id, statusChange === 'cancelled' ? ACTIVE : SEATED.concat(['waitlisted'])])).rows : [];
  if (material && recipients.length && !body.confirm) {
    return { preview: true, affected: recipients.length, changes, statusChange, versionAfter: ev.version + 1 };
  }
  if (!Object.keys(next).length) return { ok: true, unchanged: true };
  if (material) next.version = ev.version + 1;
  next.updated_at = new Date(); next.updated_by = staff.email;
  const keys = Object.keys(next);
  await q.query(`UPDATE oss_events SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [ev.id].concat(keys.map((k) => next[k])));
  const after = await getEvent(q, ev.id);
  const before = {}, afterMeta = {}; keys.filter((k) => k !== 'updated_at' && k !== 'updated_by').forEach((k) => { before[k] = ev[k]; afterMeta[k] = next[k]; });
  await audit(q, staff.email, 'event.updated', 'event:' + ev.id, { before, after: afterMeta, reason: body.reason || null, notified: recipients.length });
  // notices
  if (material && recipients.length) {
    const kind = statusChange === 'cancelled' ? 'event_cancelled' : statusChange === 'postponed' ? 'event_postponed' : 'event_changed';
    for (const r of recipients) {
      const u = urls(site, r.lang, after);
      await enqueue(q, { kind, to: r.email, lang: r.lang, registrationId: r.id, eventId: ev.id, dedupeKey: `${kind}:${r.id}:v${after.version}`,
        vars: Object.assign({ name: r.name, ev: titled(after, r.lang), venue: venueName(after, r.lang), changes: changes.map((x) => '• ' + x[r.lang]).join('\n'), reason: (body.reason || '').slice(0, 300) }, u) });
    }
  }
  if (statusChange === 'cancelled') {
    const seated = (await q.query(`SELECT id FROM oss_registrations WHERE event_id = $1 AND status = ANY($2)`, [ev.id, SEATED])).rows;
    for (const r of seated) await revokeTickets(q, r.id, 'event_cancelled');
  }
  let promoted = [];
  if (after.event_status === 'confirmed' && (after.registration_mode === 'open' || after.registration_mode === 'waitlist_only')) promoted = await promoteWaitlist(q, { ev: after, site });
  return { ok: true, event: publicEvent(after, await counts(q, after.id)), notified: recipients.length, promoted: promoted.length };
}

/* Roster: paginated, searchable; check-in staff see masked emails. */
export async function roster(q, staff, id, params) {
  requireRole(staff, 'checkin_staff', id);
  const ev = await getEvent(q, id); if (!ev) fail(404, 'not_found');
  const status = params.get('status') || '', qs = (params.get('q') || '').trim().toLowerCase(), page = Math.max(1, Number(params.get('page') || 1)), per = 50;
  const where = ['event_id = $1']; const args = [ev.id];
  if (status) { args.push(status); where.push(`status = $${args.length}`); }
  if (qs) { args.push('%' + qs.replace(/[%_]/g, '\\$&') + '%'); where.push(`(lower(name) LIKE $${args.length} OR email LIKE $${args.length})`); }
  const total = (await q.query(`SELECT count(*)::int AS n FROM oss_registrations WHERE ${where.join(' AND ')}`, args)).rows[0].n;
  args.push(per, (page - 1) * per);
  const rows = (await q.query(`SELECT id, name, email, kind, status, lang, member_at_booking, marketing_opt_in, consent_privacy_version, created_at, confirmed_at, checked_in_at, cancelled_at, offered_at, claim_expires_at, waitlist_seq, requirements FROM oss_registrations WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT $${args.length - 1} OFFSET $${args.length}`, args)).rows;
  const full = staff.role !== 'checkin_staff';
  return { event: { id: ev.id, slug: ev.slug, title: ev.content.title }, total, page, per, registrations: rows.map((r) => Object.assign({}, r, { email: full ? r.email : maskEmail(r.email), name: full ? r.name : displayName(r.name), requirements: full ? r.requirements : null })) };
}

const csvCell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; return s; };
/* People who asked for Society news (their consent): current members and applicants who ticked the box, plus event
   attendees whose opt-in was carried over when their registration was deleted. Withdrawals are removed by hand on request. */
export async function subscribersCsv(q, staff) {
  requireRole(staff, 'events_admin');
  await rateLimit(q, 'export', staff.email, 20, 3600);
  const rows = (await q.query(`SELECT email, name, lang, consent_at, source, array_to_string(interests, ' ') AS interests, (verified_at IS NOT NULL) AS confirmed, 0 AS ord FROM oss_subscribers
    UNION ALL SELECT email, name, lang, COALESCE(applied_at, created_at), 'membership', '', (email_verified_at IS NOT NULL), 1 FROM oss_members WHERE consent_news AND status IN ('pending','info_requested','approved')
    UNION ALL SELECT DISTINCT ON (email) email, name, lang, COALESCE(marketing_opt_in_at, consent_at), 'event', '', true, 2 FROM oss_registrations WHERE marketing_opt_in AND status IN ('interested','confirmed','checked_in','waitlisted','offered')
    ORDER BY 1, 8`)).rows;
  const seen = new Set(); const uniq = rows.filter((r) => (seen.has(r.email) ? false : (seen.add(r.email), true)));
  await audit(q, staff.email, 'subscribers.exported', null, { rows: uniq.length });
  const lines = ['email,name,language,consented_at,source,interests,email_confirmed'].concat(uniq.map((r) => [r.email, r.name, r.lang, r.consent_at, r.source, r.interests, r.confirmed ? 'yes' : 'no'].map((v) => csvCell(v instanceof Date ? v.toISOString() : v)).join(',')));
  return { filename: 'news-subscribers.csv', csv: '﻿' + lines.join('\r\n') + '\r\n' };
}
/* People who registered to volunteer (a register of its own: it gives no membership rights). */
export async function volunteersCsv(q, staff) {
  requireRole(staff, 'events_admin');
  await rateLimit(q, 'export', staff.email, 20, 3600);
  const rows = (await q.query(`SELECT email, name, name_ar, phone, array_to_string(areas, ' ') AS areas, place, whatsapp, lang, created_at, (verified_at IS NOT NULL) AS confirmed FROM oss_volunteers ORDER BY created_at`)).rows;
  await audit(q, staff.email, 'volunteers.exported', null, { rows: rows.length });
  const lines = ['email,name,name_arabic,mobile,areas,preferred_place,whatsapp_group,language,registered_at,email_confirmed'].concat(rows.map((r) => [r.email, r.name, r.name_ar, r.phone, r.areas, r.place, r.whatsapp ? 'yes' : 'no', r.lang, r.created_at, r.confirmed ? 'yes' : 'no'].map((v) => csvCell(v instanceof Date ? v.toISOString() : v)).join(',')));
  return { filename: 'volunteers.csv', csv: '﻿' + lines.join('\r\n') + '\r\n' };
}
export async function rosterCsv(q, staff, id) {
  requireRole(staff, 'events_admin', id);
  await rateLimit(q, 'export', staff.email, 20, 3600);
  const ev = await getEvent(q, id); if (!ev) fail(404, 'not_found');
  const rows = (await q.query(`SELECT name, email, kind, status, lang, member_at_booking, marketing_opt_in, consent_privacy_version, created_at, confirmed_at, checked_in_at, cancelled_at, requirements FROM oss_registrations WHERE event_id = $1 ORDER BY created_at`, [ev.id])).rows;
  await audit(q, staff.email, 'roster.exported', 'event:' + ev.id, { rows: rows.length });
  const head = ['name', 'email', 'kind', 'status', 'language', 'member_at_booking', 'marketing_opt_in', 'privacy_notice_version', 'registered_at', 'confirmed_at', 'checked_in_at', 'cancelled_at', 'dietary_or_access_requirements'];
  const lines = [head.join(',')].concat(rows.map((r) => [r.name, r.email, r.kind, r.status, r.lang, r.member_at_booking ? 'yes' : 'no', r.marketing_opt_in ? 'yes' : 'no', r.consent_privacy_version, r.created_at, r.confirmed_at, r.checked_in_at, r.cancelled_at, r.requirements].map((v) => csvCell(v instanceof Date ? v.toISOString() : v)).join(',')));
  return { filename: `${ev.slug}-registrations.csv`, csv: '﻿' + lines.join('\r\n') + '\r\n' };
}

export async function cancelByAdmin(q, staff, registrationId, body, site) {
  requireRole(staff, 'events_admin');
  const reg = (await q.query('SELECT * FROM oss_registrations WHERE id = $1 FOR UPDATE', [registrationId])).rows[0]; if (!reg) fail(404, 'not_found');
  requireRole(staff, 'events_admin', reg.event_id);
  const ev = await getEvent(q, reg.event_id, { lock: true });
  return cancelRegistration(q, { reg, ev, actor: staff.email, reason: cleanName(body.reason || ''), byAdmin: true, site });
}

export async function resendTicket(q, staff, registrationId, site) {
  requireRole(staff, 'events_admin');
  const reg = (await q.query('SELECT * FROM oss_registrations WHERE id = $1 FOR UPDATE', [registrationId])).rows[0]; if (!reg) fail(404, 'not_found');
  requireRole(staff, 'events_admin', reg.event_id);
  if (reg.status !== 'confirmed') fail(400, 'not_confirmed');
  const ev = await getEvent(q, reg.event_id);
  const token = await issueTicket(q, reg.id);
  const u = urls(site, reg.lang, ev);
  await enqueue(q, { kind: 'booking_confirmed', to: reg.email, lang: reg.lang, registrationId: reg.id, eventId: ev.id, vars: Object.assign({ name: reg.name, ev: titled(ev, reg.lang), venue: venueName(ev, reg.lang), ticketUrl: `${site}/t/${token}` }, u) });
  await audit(q, staff.email, 'ticket.reissued', 'registration:' + reg.id, { event: ev.id });
  return { ok: true };
}

/* Check-in (QR token or manual registration id). */
export async function checkIn(q, staff, id, body) {
  requireRole(staff, 'checkin_staff', id);
  await rateLimit(q, 'checkin', staff.email, 300, 600);
  const ev = await getEvent(q, id, { lock: true }); if (!ev) fail(404, 'not_found');
  if (body.token) return checkInByToken(q, { ev, token: String(body.token).slice(0, 200), staffEmail: staff.email });
  if (body.registrationId) { const r = await checkInRegistration(q, { ev, registrationId: String(body.registrationId), staffEmail: staff.email, method: 'manual' }); return r; }
  fail(400, 'token_or_registration_required');
}
export async function checkInSearch(q, staff, id, term) {
  requireRole(staff, 'checkin_staff', id);
  const ev = await getEvent(q, id); if (!ev) fail(404, 'not_found');
  const t = String(term || '').trim().toLowerCase(); if (t.length < 3) fail(400, 'query_too_short');
  await rateLimit(q, 'checkin_search', staff.email, 120, 600);
  const rows = (await q.query(`SELECT id, name, email, status, checked_in_at FROM oss_registrations WHERE event_id = $1 AND status IN ('confirmed','checked_in') AND (lower(name) LIKE $2 OR email LIKE $2) ORDER BY name LIMIT 10`, [ev.id, '%' + t.replace(/[%_]/g, '\\$&') + '%'])).rows;
  await audit(q, staff.email, 'checkin.search', 'event:' + ev.id, { term_len: t.length, results: rows.length });
  const full = staff.role !== 'checkin_staff';
  return { results: rows.map((r) => ({ id: r.id, name: full ? r.name : displayName(r.name), email: full ? r.email : maskEmail(r.email), status: r.status, checkedInAt: r.checked_in_at })) };
}

/* Communications: preview then send a custom notice to a segment. */
export async function notify(q, staff, id, body, site) {
  requireRole(staff, 'events_admin', id);
  const ev = await getEvent(q, id); if (!ev) fail(404, 'not_found');
  const seg = body.to || 'confirmed';
  const statuses = seg === 'confirmed' ? ['confirmed', 'checked_in'] : seg === 'waitlisted' ? ['waitlisted', 'offered'] : seg === 'interested' ? ['interested'] : seg === 'all_active' ? ACTIVE : null;
  if (!statuses) fail(400, 'bad_segment');
  const subj = body.subject || {}, text = body.body || {};
  if (!subj.en || !text.en) fail(400, 'subject_and_body_required');
  const recipients = (await q.query(`SELECT id, email, name, lang FROM oss_registrations WHERE event_id = $1 AND status = ANY($2)`, [ev.id, statuses])).rows;
  const sample = { en: { subject: subj.en, body: text.en }, ar: { subject: subj.ar || subj.en, body: text.ar || text.en } };
  if (!body.confirm) return { preview: true, affected: recipients.length, byLang: { en: recipients.filter((r) => r.lang === 'en').length, ar: recipients.filter((r) => r.lang === 'ar').length }, sample };
  const batch = Date.now().toString(36);
  let queued = 0;
  for (const r of recipients) {
    const idq = await enqueue(q, { kind: 'custom', to: r.email, lang: r.lang, registrationId: r.id, eventId: ev.id, dedupeKey: `custom:${batch}:${r.id}`, vars: { name: r.name, ev: titled(ev, r.lang), subject: sample[r.lang].subject, body: sample[r.lang].body, siteUrl: site } });
    if (idq) queued++;
  }
  await audit(q, staff.email, 'notify.sent', 'event:' + ev.id, { segment: seg, queued, subject: subj.en.slice(0, 120), batch });
  return { ok: true, queued, batch };
}

export async function mailQueue(q, staff, params) {
  requireRole(staff, 'events_admin');
  const status = params.get('status') || '';
  const args = []; let where = '';
  if (status) { args.push(status); where = 'WHERE status = $1'; }
  const rows = (await q.query(`SELECT id, kind, to_email, lang, subject, status, attempts, next_attempt_at, last_error, provider, created_at, sent_at, event_id FROM oss_mail_outbox ${where} ORDER BY created_at DESC LIMIT 200`, args)).rows;
  return { mail: rows.map((m) => Object.assign({}, m, { to_email: staff.role === 'checkin_staff' ? maskEmail(m.to_email) : m.to_email })) };
}
export async function mailRetry(q, staff, id) {
  requireRole(staff, 'events_admin');
  const r = await q.query(`UPDATE oss_mail_outbox SET status = 'queued', next_attempt_at = now(), last_error = NULL WHERE id = $1 AND status IN ('failed','dead') RETURNING id`, [id]);
  if (!r.rows.length) fail(404, 'not_found');
  await audit(q, staff.email, 'mail.retried', 'mail:' + id, null);
  return { ok: true };
}

export async function auditLog(q, staff, params) {
  requireRole(staff, 'events_admin');
  const limit = Math.min(500, Math.max(1, Number(params.get('limit') || 200)));
  return { audit: (await q.query('SELECT id, at, actor, action, resource, meta FROM oss_audit ORDER BY id DESC LIMIT $1', [limit])).rows };
}

/* Staff management (super admins). */
export async function staffList(q, staff) { requireRole(staff, 'super_admin'); return { staff: (await q.query('SELECT email, name, role, event_ids, disabled, created_at, created_by FROM oss_staff ORDER BY created_at')).rows }; }
export async function staffUpsert(q, staff, body) {
  requireRole(staff, 'super_admin');
  const email = normEmail(body.email); if (!validEmail(email)) fail(400, 'bad_email');
  if (!['super_admin', 'events_admin', 'checkin_staff'].includes(body.role)) fail(400, 'bad_role');
  const ids = Array.isArray(body.eventIds) && body.eventIds.length ? body.eventIds.map(String).slice(0, 100) : null;
  await q.query(`INSERT INTO oss_staff (email, name, role, event_ids, disabled, created_by) VALUES ($1,$2,$3,$4,false,$5) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, event_ids = EXCLUDED.event_ids, disabled = false`, [email, cleanName(body.name || ''), body.role, ids, staff.email]);
  await audit(q, staff.email, 'staff.upserted', 'staff:' + email, { role: body.role, eventIds: ids });
  return { ok: true };
}
export async function staffDisable(q, staff, email) {
  requireRole(staff, 'super_admin');
  const e = normEmail(email); if (e === staff.email) fail(400, 'cannot_disable_self');
  await q.query('UPDATE oss_staff SET disabled = true WHERE email = $1', [e]);
  await audit(q, staff.email, 'staff.disabled', 'staff:' + e, null);
  return { ok: true };
}

/* Members register: the authority the members-only gate checks. */
export async function membersList(q, staff, params) {
  requireRole(staff, 'events_admin');
  const t = (params.get('q') || '').trim().toLowerCase();
  const args = []; let where = '';
  if (t) { args.push('%' + t.replace(/[%_]/g, '\\$&') + '%'); where = 'WHERE (email LIKE $1 OR lower(coalesce(name, \'\')) LIKE $1)'; }
  const rows = (await q.query(`SELECT email, name, status, tier, valid_until, approved_at, approved_by, notes, created_at FROM oss_members ${where} ORDER BY created_at DESC LIMIT 200`, args)).rows;
  const total = (await q.query(`SELECT status, count(*)::int AS n FROM oss_members GROUP BY status`)).rows;
  return { members: rows, totals: Object.fromEntries(total.map((x) => [x.status, x.n])) };
}
export async function memberUpsert(q, staff, body) {
  requireRole(staff, 'events_admin');
  const rows = Array.isArray(body.rows) ? body.rows : [body];
  if (rows.length > 500) fail(400, 'too_many_rows');
  let n = 0;
  for (const row of rows) {
    const email = normEmail(row.email); if (!validEmail(email)) continue;
    const status = ['pending', 'approved', 'revoked', 'expired'].includes(row.status) ? row.status : 'approved';
    const until = row.validUntil ? ISO(row.validUntil) : null;
    await q.query(`INSERT INTO oss_members (email, name, status, tier, valid_until, approved_at, approved_by, notes) VALUES ($1,$2,$3,$4,$5, CASE WHEN $3 = 'approved' THEN now() ELSE NULL END, $6, $7)
      ON CONFLICT (email) DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name, ''), oss_members.name), status = EXCLUDED.status, tier = COALESCE(EXCLUDED.tier, oss_members.tier), valid_until = EXCLUDED.valid_until,
      approved_at = CASE WHEN EXCLUDED.status = 'approved' THEN now() ELSE oss_members.approved_at END, approved_by = $6, notes = COALESCE(NULLIF(EXCLUDED.notes, ''), oss_members.notes), updated_at = now()`,
      [email, cleanName(row.name || ''), status, row.tier ? String(row.tier).slice(0, 40) : null, until, staff.email, row.notes ? String(row.notes).slice(0, 500) : '']);
    n++;
  }
  await audit(q, staff.email, 'members.upserted', null, { count: n });
  return { ok: true, count: n };
}

export async function triggerPublish(q, staff) {
  requireRole(staff, 'events_admin');
  const hook = process.env.NETLIFY_BUILD_HOOK;
  if (!hook) fail(503, 'build_hook_not_configured');
  await rateLimit(q, 'publish', staff.email, 6, 3600);
  const r = await fetch(hook, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
  await audit(q, staff.email, 'site.publish_triggered', null, { status: r.status });
  if (!r.ok) fail(502, 'build_hook_failed');
  return { ok: true };
}

export { L, stateOf };

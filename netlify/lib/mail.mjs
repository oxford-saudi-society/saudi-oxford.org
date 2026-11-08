/* Transactional email: bilingual templates, a durable outbox and the provider adapter.
   A message is only ever marked `sent` after the provider accepted it. */
import { SETTINGS } from './content.generated.mjs';
import * as T from '../../shared/time.cjs';

const SITE_NAME = { en: (SETTINGS.siteName && SETTINGS.siteName.en) || 'Oxford Saudi Society', ar: (SETTINGS.siteName && SETTINGS.siteName.ar) || 'الجمعية السعودية في أكسفورد' };

/* ── templates ──────────────────────────────────────────────────── */
const C = {
  en: {
    hello: (n) => (n ? `Dear ${n},` : 'Hello,'),
    footer: (url) => `${SITE_NAME.en} · ${url}\nYou receive this email because this address was used on our events pages. Questions: ${SETTINGS.email || 'the committee'}.`,
    notBooking: 'This is not a ticket or a guaranteed place.',
    proposed: 'The date and venue are proposed and not yet confirmed.',
    when: (ev) => `${T.fmtWhen(ev.start_utc, ev.end_utc, 'en')}${ev.event_status === 'proposed' ? ' (proposed)' : ''}`,
    verify_interest: { s: (ev) => `Confirm your interest: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\nPlease confirm your email address to register your interest in “${v.ev.title}” (${C.en.when(v.ev)}):\n\n${v.link}\n\n${C.en.notBooking} ${C.en.proposed} We will write to you when registration opens.\n\nThe link expires in 60 minutes. If you did not request this, ignore this email.` },
    verify_booking: { s: (ev) => `Confirm your booking: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\nPlease confirm your email address to complete your booking for “${v.ev.title}” (${C.en.when(v.ev)}):\n\n${v.link}\n\nYour place is assigned the moment you click the link; nothing is reserved before then. If the event fills up first you will be offered the waitlist where available.\n\nThe link expires in 60 minutes. If you did not request this, ignore this email.` },
    verify_waitlist: { s: (ev) => `Confirm your waitlist request: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\nPlease confirm your email address to join the waitlist for “${v.ev.title}” (${C.en.when(v.ev)}):\n\n${v.link}\n\nThe link expires in 60 minutes.` },
    login_link: { s: () => `Your sign-in link — ${SITE_NAME.en}`, b: (v) => `Hello,\n\nUse this link to sign in and see your event registrations:\n\n${v.link}\n\nIt works once and expires in 30 minutes. If you did not request it, ignore this email — nothing happens unless the link is used.` },
    interest_received: { s: (ev) => `Interest registered (not a booking): ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\nThanks. You have registered your interest in “${v.ev.title}” (${C.en.when(v.ev)}). ${C.en.notBooking} ${C.en.proposed}\n\nWe will email you when registration opens. Event page: ${v.eventUrl}\n\nTo withdraw your interest, sign in at ${v.accountUrl}` },
    booking_confirmed: { s: (ev) => `Booking confirmed: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\nYour registration is confirmed.\n\nEvent: ${v.ev.title}\nWhen: ${C.en.when(v.ev)}\nWhere: ${v.venue}\nTicket: ${v.ticketUrl}\n\nShow the ticket (QR code) at the door. Add to calendar: ${v.icsUrl}\nTo cancel or view your registrations: ${v.accountUrl}` },
    booking_full: { s: (ev) => `Fully booked: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\nSorry — all places for “${v.ev.title}” were taken before your confirmation arrived, so no booking was made.${v.waitlist ? ' You can join the waitlist from the event page.' : ''}\n\n${v.eventUrl}` },
    waitlisted: { s: (ev) => `You are on the waitlist: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\nYou are on the waitlist for “${v.ev.title}” (${C.en.when(v.ev)}). If a place opens we will email you a claim link; you will then have 24 hours to confirm.\n\nYour registrations: ${v.accountUrl}` },
    waitlist_offer: { s: (ev) => `A place has opened: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\nA place has opened for “${v.ev.title}” (${C.en.when(v.ev)}). Claim it here within 24 hours (by ${v.expiresText}):\n\n${v.link}\n\nIf you no longer want the place, do nothing — it passes to the next person automatically.` },
    offer_expired: { s: (ev) => `Waitlist offer expired: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\nThe place we offered you for “${v.ev.title}” was not claimed within 24 hours and has been passed on. You are no longer on the waitlist; you can rejoin from the event page if places remain: ${v.eventUrl}` },
    registration_cancelled: { s: (ev) => `Registration cancelled: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\nYour registration for “${v.ev.title}” has been cancelled${v.byAdmin ? ' by the organisers' : ''} and any ticket is no longer valid. ${v.reason ? 'Reason: ' + v.reason + '\n\n' : ''}If this was a mistake you can register again from the event page while places remain: ${v.eventUrl}` },
    event_changed: { s: (ev) => `Updated details: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\nThe organisers have updated “${v.ev.title}”.\n\n${v.changes}\n\nNow: ${C.en.when(v.ev)}\nWhere: ${v.venue}\n\nYour registration stays valid. Updated calendar entry: ${v.icsUrl}\nIf you can no longer attend, please cancel so your place can go to someone else: ${v.accountUrl}` },
    event_postponed: { s: (ev) => `Postponed: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\n“${v.ev.title}” has been postponed and the new date will be confirmed later. ${v.reason ? 'Reason: ' + v.reason + ' ' : ''}Your registration is kept and we will write again once a date is set. If you prefer to cancel: ${v.accountUrl}` },
    event_cancelled: { s: (ev) => `Cancelled: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\n“${v.ev.title}” (${C.en.when(v.ev)}) has been cancelled. ${v.reason ? 'Reason: ' + v.reason + ' ' : ''}Any ticket is no longer valid. We are sorry for the change and hope to see you at another gathering: ${v.eventsUrl}` },
    reminder: { s: (ev) => `Reminder: ${ev.title}`, b: (v) => `${C.en.hello(v.name)}\n\nA reminder that “${v.ev.title}” is ${v.inWords}.\n\nWhen: ${C.en.when(v.ev)}\nWhere: ${v.venue}\nTicket: ${v.ticketUrl}\n\nCan't make it? Please cancel so your place can go to someone on the waitlist: ${v.accountUrl}` },
    custom: { s: (ev, v) => v.subject, b: (v) => `${C.en.hello(v.name)}\n\n${v.body}` },
  },
  ar: {
    hello: (n) => (n ? `عزيزي/عزيزتي ${n}،` : 'مرحبًا،'),
    footer: (url) => `${SITE_NAME.ar} · ${url}\nتصلك هذه الرسالة لأن هذا البريد استُخدم في صفحات فعالياتنا. للاستفسار: ${SETTINGS.email || 'اللجنة'}.`,
    notBooking: 'هذه ليست تذكرة ولا ضمانًا للمقعد.',
    proposed: 'التاريخ والمكان مقترحان ولم يُؤكّدا بعد.',
    when: (ev) => `${T.fmtWhen(ev.start_utc, ev.end_utc, 'ar')}${ev.event_status === 'proposed' ? ' (مقترح)' : ''}`,
    verify_interest: { s: (ev) => `تأكيد اهتمامك: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nيرجى تأكيد بريدك الإلكتروني لتسجيل اهتمامك بفعالية «${v.ev.title}» (${C.ar.when(v.ev)}):\n\n${v.link}\n\n${C.ar.notBooking} ${C.ar.proposed} سنراسلك عند فتح التسجيل.\n\nتنتهي صلاحية الرابط خلال ٦٠ دقيقة. إن لم تطلب ذلك فتجاهل هذه الرسالة.` },
    verify_booking: { s: (ev) => `تأكيد حجزك: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nيرجى تأكيد بريدك الإلكتروني لإتمام حجزك في «${v.ev.title}» (${C.ar.when(v.ev)}):\n\n${v.link}\n\nيُخصّص مقعدك لحظة الضغط على الرابط، ولا يُحجز شيء قبل ذلك. إن اكتملت المقاعد قبلها فسيُعرض عليك الانضمام إلى قائمة الانتظار حيثما توفّرت.\n\nتنتهي صلاحية الرابط خلال ٦٠ دقيقة. إن لم تطلب ذلك فتجاهل هذه الرسالة.` },
    verify_waitlist: { s: (ev) => `تأكيد طلب قائمة الانتظار: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nيرجى تأكيد بريدك الإلكتروني للانضمام إلى قائمة الانتظار لفعالية «${v.ev.title}» (${C.ar.when(v.ev)}):\n\n${v.link}\n\nتنتهي صلاحية الرابط خلال ٦٠ دقيقة.` },
    login_link: { s: () => `رابط الدخول — ${SITE_NAME.ar}`, b: (v) => `مرحبًا،\n\nاستخدم هذا الرابط لتسجيل الدخول وعرض تسجيلاتك في الفعاليات:\n\n${v.link}\n\nيعمل مرة واحدة وتنتهي صلاحيته خلال ٣٠ دقيقة. إن لم تطلبه فتجاهل هذه الرسالة؛ لا يحدث شيء ما لم يُستخدم الرابط.` },
    interest_received: { s: (ev) => `تم تسجيل اهتمامك (ليس حجزًا): ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nشكرًا لك. تم تسجيل اهتمامك بفعالية «${v.ev.title}» (${C.ar.when(v.ev)}). ${C.ar.notBooking} ${C.ar.proposed}\n\nسنراسلك عند فتح التسجيل. صفحة الفعالية: ${v.eventUrl}\n\nلسحب اهتمامك سجّل الدخول عبر ${v.accountUrl}` },
    booking_confirmed: { s: (ev) => `تم تأكيد الحجز: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nتم تأكيد تسجيلك.\n\nالفعالية: ${v.ev.title}\nالموعد: ${C.ar.when(v.ev)}\nالمكان: ${v.venue}\nالتذكرة: ${v.ticketUrl}\n\nأبرز التذكرة (رمز QR) عند الدخول. أضف إلى التقويم: ${v.icsUrl}\nللإلغاء أو عرض تسجيلاتك: ${v.accountUrl}` },
    booking_full: { s: (ev) => `اكتمل العدد: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nنعتذر — اكتملت مقاعد «${v.ev.title}» قبل وصول تأكيدك، فلم يتم الحجز.${v.waitlist ? ' يمكنك الانضمام إلى قائمة الانتظار من صفحة الفعالية.' : ''}\n\n${v.eventUrl}` },
    waitlisted: { s: (ev) => `أنت في قائمة الانتظار: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nأنت في قائمة الانتظار لفعالية «${v.ev.title}» (${C.ar.when(v.ev)}). إن توفّر مقعد فسنرسل لك رابط تأكيد، ويكون أمامك ٢٤ ساعة لتأكيده.\n\nتسجيلاتك: ${v.accountUrl}` },
    waitlist_offer: { s: (ev) => `توفّر مقعد: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nتوفّر مقعد في «${v.ev.title}» (${C.ar.when(v.ev)}). أكّده عبر هذا الرابط خلال ٢٤ ساعة (قبل ${v.expiresText}):\n\n${v.link}\n\nإن لم تعد ترغب في المقعد فلا تفعل شيئًا؛ سينتقل تلقائيًا إلى الشخص التالي.` },
    offer_expired: { s: (ev) => `انتهى عرض قائمة الانتظار: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nلم يُؤكَّد المقعد الذي عرضناه عليك في «${v.ev.title}» خلال ٢٤ ساعة، وقد انتقل إلى شخص آخر. لم تعد في قائمة الانتظار، ويمكنك الانضمام مجددًا من صفحة الفعالية إن بقيت مقاعد: ${v.eventUrl}` },
    registration_cancelled: { s: (ev) => `تم إلغاء التسجيل: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nتم إلغاء تسجيلك في «${v.ev.title}»${v.byAdmin ? ' من قبل المنظمين' : ''}، ولم تعد أي تذكرة صالحة. ${v.reason ? 'السبب: ' + v.reason + '\n\n' : ''}إن كان ذلك عن طريق الخطأ فيمكنك التسجيل مجددًا من صفحة الفعالية ما دامت المقاعد متاحة: ${v.eventUrl}` },
    event_changed: { s: (ev) => `تحديث في التفاصيل: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nحدّث المنظمون تفاصيل «${v.ev.title}».\n\n${v.changes}\n\nالموعد الآن: ${C.ar.when(v.ev)}\nالمكان: ${v.venue}\n\nتسجيلك ما زال ساريًا. تحديث التقويم: ${v.icsUrl}\nإن تعذّر حضورك فيرجى الإلغاء ليذهب مقعدك إلى شخص آخر: ${v.accountUrl}` },
    event_postponed: { s: (ev) => `تأجيل: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nتم تأجيل «${v.ev.title}» وسيُؤكَّد الموعد الجديد لاحقًا. ${v.reason ? 'السبب: ' + v.reason + ' ' : ''}تسجيلك محفوظ وسنراسلك عند تحديد الموعد. إن كنت تفضّل الإلغاء: ${v.accountUrl}` },
    event_cancelled: { s: (ev) => `إلغاء: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nأُلغيت فعالية «${v.ev.title}» (${C.ar.when(v.ev)}). ${v.reason ? 'السبب: ' + v.reason + ' ' : ''}لم تعد أي تذكرة صالحة. نعتذر عن هذا التغيير ونأمل أن نراك في اجتماع آخر: ${v.eventsUrl}` },
    reminder: { s: (ev) => `تذكير: ${ev.title}`, b: (v) => `${C.ar.hello(v.name)}\n\nنذكّرك بأن «${v.ev.title}» ${v.inWords}.\n\nالموعد: ${C.ar.when(v.ev)}\nالمكان: ${v.venue}\nالتذكرة: ${v.ticketUrl}\n\nلن تتمكن من الحضور؟ يرجى الإلغاء ليذهب مقعدك إلى شخص في قائمة الانتظار: ${v.accountUrl}` },
    custom: { s: (ev, v) => v.subject, b: (v) => `${C.ar.hello(v.name)}\n\n${v.body}` },
  },
};

const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toHtml(textBody, lang, siteUrl) {
  const paras = textBody.split(/\n\n+/).map((p) => '<p style="margin:0 0 14px">' + escHtml(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0b5d3a;word-break:break-all">$1</a>') + '</p>').join('');
  const dir = lang === 'ar' ? 'rtl' : 'ltr', align = lang === 'ar' ? 'right' : 'left';
  return `<!doctype html><html lang="${lang}" dir="${dir}"><body style="margin:0;background:#F6F4ED;font-family:'Noto Sans','Segoe UI',Arial,sans-serif;color:#1b2a3a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(0,33,71,.08)">
<tr><td style="background:#002147;color:#F6F4ED;padding:18px 24px;font-size:18px;font-weight:700;text-align:${align}">${escHtml(SITE_NAME[lang])}<span style="display:block;font-size:12px;font-weight:400;opacity:.85;margin-top:2px">University of Oxford</span></td></tr>
<tr><td style="padding:24px;font-size:15.5px;line-height:1.6;text-align:${align}">${paras}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e6e2d6;font-size:12px;color:#5a6673;text-align:${align}">${escHtml(C[lang].footer(siteUrl)).replace(/\n/g, '<br>')}</td></tr>
</table></td></tr></table></body></html>`;
}

/* Render a message. ev = { title, start_utc, end_utc, event_status } in the recipient's language. */
export function render(kind, lang, vars) {
  const L = C[lang] || C.en;
  const tpl = L[kind]; if (!tpl) throw new Error('unknown_template:' + kind);
  const subject = tpl.s(vars.ev || {}, vars);
  const body = tpl.b(vars) + '\n\n—\n' + L.footer(vars.siteUrl || SETTINGS.domain || '');
  return { subject, text: body, html: toHtml(tpl.b(vars), lang, vars.siteUrl || SETTINGS.domain || '') };
}

/* Queue a message inside the caller's transaction. */
export async function enqueue(q, { kind, to, lang, vars, registrationId, eventId, dedupeKey, attachments }) {
  const m = render(kind, lang, vars);
  const r = await q.query(
    `INSERT INTO oss_mail_outbox (kind, to_email, lang, subject, body_text, body_html, attachments, registration_id, event_id, dedupe_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
    [kind, to, lang, m.subject, m.text, m.html, attachments ? JSON.stringify(attachments) : null, registrationId || null, eventId || null, dedupeKey || null]);
  return r.rows.length ? r.rows[0].id : null;
}

/* ── providers ──────────────────────────────────────────────────── */
const captured = []; // test provider
export const _captured = captured;
export function providerName() {
  const p = (process.env.MAIL_PROVIDER || '').toLowerCase();
  if (p) return p;
  return process.env.RESEND_API_KEY ? 'resend' : 'log';
}
async function deliver(msg) {
  const p = providerName();
  if (p === 'resend') {
    const from = process.env.MAIL_FROM; if (!from) throw new Error('MAIL_FROM not set');
    const body = { from, to: [msg.to_email], subject: msg.subject, text: msg.body_text, html: msg.body_html || undefined, reply_to: process.env.MAIL_REPLY_TO || undefined,
      attachments: msg.attachments ? msg.attachments.map((a) => ({ filename: a.filename, content: a.content })) : undefined, headers: { 'X-Entity-Ref-ID': String(msg.id) } };
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'oss-' + msg.id }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('resend_' + r.status + ':' + ((data && (data.message || data.name)) || 'error'));
    return { id: data.id || null, provider: 'resend' };
  }
  if (p === 'capture') { captured.push(msg); return { id: 'cap-' + captured.length, provider: 'capture' }; }
  if (p === 'fail') throw new Error('simulated_provider_failure'); // tests: exercise the retry path
  if (p === 'file') {
    if (process.env.NETLIFY) throw new Error('file provider is for local development only');
    const fs = await import('node:fs');
    fs.appendFileSync(process.env.MAIL_FILE || '/tmp/oss-mail.jsonl', JSON.stringify({ id: msg.id, kind: msg.kind, to: msg.to_email, subject: msg.subject, text: msg.body_text, at: new Date().toISOString() }) + '\n');
    return { id: 'file-' + msg.id, provider: 'file' };
  }
  // 'log': prints and leaves the message queued (never a false "sent")
  console.log(`[mail:log] not delivered (no provider configured) → ${msg.to_email} :: ${msg.subject}`);
  throw new Error('no_mail_provider');
}

const BACKOFF_MIN = [2, 10, 30, 120, 360, 720];
/* Send what is due. Called after each request that queued mail and by the scheduled job. */
export async function processOutbox(db, limit = 20) {
  const claimed = await db.tx(async (q) => {
    const r = await q.query(`SELECT id FROM oss_mail_outbox WHERE status IN ('queued','failed') AND next_attempt_at <= now() ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED`, [limit]);
    const ids = r.rows.map((x) => x.id);
    if (ids.length) await q.query(`UPDATE oss_mail_outbox SET status = 'sending', attempts = attempts + 1 WHERE id = ANY($1::uuid[])`, [ids]);
    return ids;
  });
  const out = { sent: 0, failed: 0, dead: 0 };
  for (const id of claimed) {
    const msg = (await db.query('SELECT * FROM oss_mail_outbox WHERE id = $1', [id])).rows[0];
    try {
      const res = await deliver(msg);
      await db.query(`UPDATE oss_mail_outbox SET status = 'sent', sent_at = now(), provider = $2, provider_id = $3, last_error = NULL WHERE id = $1`, [id, res.provider, res.id]);
      out.sent++;
    } catch (e) {
      const dead = msg.attempts >= BACKOFF_MIN.length;
      const mins = BACKOFF_MIN[Math.min(msg.attempts - 1, BACKOFF_MIN.length - 1)];
      await db.query(`UPDATE oss_mail_outbox SET status = $2, last_error = $3, next_attempt_at = now() + make_interval(mins => $4) WHERE id = $1`, [id, dead ? 'dead' : 'failed', String(e.message || e).slice(0, 500), mins]);
      if (dead) out.dead++; else out.failed++;
    }
  }
  return out;
}

/* Membership: applications, permanent membership numbers, the review queue and committee decisions.
   oss_members is the single register: one row per email, also used by members-only events. */
import { randomBytes } from 'node:crypto';
import { SETTINGS } from './content.generated.mjs';
import { fail, normEmail, validEmail, cleanName } from './http.mjs';
import { requireRole, createPending } from './auth.mjs';
import { enqueue } from './mail.mjs';
import { audit } from './events.mjs';

export const TIERS = {
  saudi: { en: 'Saudi student membership', ar: 'عضوية الطلبة السعوديين', price: 0, verify: true },
  student: { en: 'Student membership', ar: 'عضوية الطلبة', price: null, verify: false },
  associate: { en: 'Associate membership', ar: 'عضوية غير الطلبة', price: null, verify: false },
  friend: { en: 'Friend of the Society (mailing list & volunteering)', ar: 'صديق الجمعية (القائمة البريدية والتطوّع)', price: 0, verify: false },
};
const UNI_STATUS = ['undergraduate', 'masters', 'dphil', 'visiting', 'staff', 'alumni', 'other'];
const HEARD = ['', 'freshers', 'friend', 'club', 'instagram', 'college', 'bureau', 'other'];
const VOLUNTEER = ['events', 'media', 'partnerships', 'welfare', 'academic'];
const SSO_RE = /^[a-z]{4}[0-9]{4}$/; // Oxford Single Sign-On username: four letters then four digits
const SSO_TIERS = ['saudi', 'student']; // needed for the student membership types only
const uniText = (row) => (row.uni_status === 'other' && row.uni_status_other ? 'Other: ' + row.uni_status_other : (UNI_LABEL[row.uni_status] || row.uni_status || ''));
const UNI_LABEL = { undergraduate: 'Undergraduate', masters: "Taught postgraduate (Master's)", dphil: 'Research postgraduate (DPhil)', visiting: 'Visiting student or researcher', staff: 'University staff or researcher', alumni: 'Alumni', other: 'Other' };
export const OPEN = ['pending', 'info_requested'];

export function priceOf(tier) {
  const t = TIERS[tier]; if (!t) return 0;
  if (t.price !== null) return t.price;
  const fees = SETTINGS.fees || {};
  return Number(fees[tier] != null ? fees[tier] : tier === 'student' ? 10 : 15) || 0;
}
/* ── fee codes ──────────────────────────────────────────────────────────────────────────────────────────────────
   The committee creates a code in the desk and gives it to someone who would normally pay. Entered on the join form
   with a fee-paying membership type, a valid code waives the fee (accepted); a wrong, expired, switched-off or
   used-up code is refused (declined) and the form is not sent. The application itself is still reviewed as usual. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I/L, so a code is easy to read out and type
export const cleanCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
function newCode() { const b = randomBytes(8); const ch = (i) => CODE_ALPHABET[b[i] % CODE_ALPHABET.length]; return 'OSS-' + [0, 1, 2, 3].map(ch).join('') + '-' + [4, 5, 6, 7].map(ch).join(''); }
async function checkCode(q, raw, lock) {
  const code = cleanCode(raw); if (code.length < 4) return { ok: false, reason: 'invalid' };
  const r = (await q.query(`SELECT code, max_uses, used, disabled, (expires_on IS NOT NULL AND expires_on < CURRENT_DATE) AS expired FROM oss_fee_codes WHERE code = $1${lock ? ' FOR UPDATE' : ''}`, [code])).rows[0];
  if (!r || r.disabled) return { ok: false, reason: 'invalid' };
  if (r.expired) return { ok: false, reason: 'expired' };
  if (r.max_uses != null && r.used >= r.max_uses) return { ok: false, reason: 'used_up' };
  return { ok: true, code };
}
/* The join form's "Check code" button: accepted or declined, nothing is saved or counted here. */
export async function codeStatus(q, body) {
  const tier = String(body.tier || '');
  if (!TIERS[tier] || !(priceOf(tier) > 0)) return { ok: false, reason: 'not_needed' };
  const c = await checkCode(q, body.code, false);
  return c.ok ? { ok: true } : { ok: false, reason: c.reason };
}
export async function codesList(q, staff) {
  requireRole(staff, 'events_admin');
  const rows = (await q.query(`SELECT code, label, max_uses, used, expires_on, disabled, created_at, created_by, (expires_on IS NOT NULL AND expires_on < CURRENT_DATE) AS expired FROM oss_fee_codes ORDER BY created_at DESC, code`)).rows;
  return { codes: rows };
}
export async function codeCreate(q, staff, body) {
  requireRole(staff, 'events_admin');
  let code = cleanCode(body.code);
  if (String(body.code || '').trim() && code.length < 4) fail(400, 'validation', { fields: { code: 'invalid' } });
  const label = String(body.label || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) || null;
  let max = body.maxUses === '' || body.maxUses == null ? null : parseInt(body.maxUses, 10);
  if (max !== null && (!Number.isFinite(max) || max < 1 || max > 100000)) fail(400, 'validation', { fields: { maxUses: 'invalid' } });
  const exp = body.expiresOn ? String(body.expiresOn).slice(0, 10) : null;
  if (exp && (!/^\d{4}-\d{2}-\d{2}$/.test(exp) || isNaN(new Date(exp)))) fail(400, 'validation', { fields: { expiresOn: 'invalid' } });
  for (let tries = 0; ; tries++) {
    const c = code || newCode();
    const ins = await q.query('INSERT INTO oss_fee_codes (code, label, max_uses, expires_on, created_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO NOTHING RETURNING code', [c, label, max, exp, staff.email]);
    if (ins.rows.length) { await audit(q, staff.email, 'fee_code.created', 'fee_code:' + c, { label, maxUses: max, expiresOn: exp }); return Object.assign({ created: c }, await codesList(q, staff)); }
    if (code || tries > 4) fail(409, 'code_exists');
  }
}
export async function codeSwitch(q, staff, raw, disabled) {
  requireRole(staff, 'events_admin');
  const code = cleanCode(raw);
  const r = await q.query('UPDATE oss_fee_codes SET disabled = $2 WHERE code = $1 RETURNING code', [code, !!disabled]);
  if (!r.rows.length) fail(404, 'not_found');
  await audit(q, staff.email, disabled ? 'fee_code.disabled' : 'fee_code.enabled', 'fee_code:' + code, null);
  return codesList(q, staff);
}

const tierLabel = (tier, lang) => (TIERS[tier] ? TIERS[tier][lang] || TIERS[tier].en : tier);
const urlsFor = (site, lang) => { const b = site + (lang === 'ar' ? '/ar' : ''); return { accountUrl: `${b}/account/`, eventsUrl: `${b}/events/`, deskUrl: `${site}/admin/events/#membership` }; };

/* Place in the review queue: open applications received at or before this one. */
export async function positionOf(q, row) {
  if (!row || !OPEN.includes(row.status)) return null;
  const r = await q.query(`SELECT count(*)::int AS n FROM oss_members o, (SELECT applied_at, member_no FROM oss_members WHERE email = $2) me
    WHERE o.status = ANY($1) AND (o.applied_at < me.applied_at OR (o.applied_at = me.applied_at AND o.member_no <= me.member_no))`, [OPEN, row.email]);
  return r.rows[0].n;
}
async function nextNumber(q) {
  const r = await q.query(`SELECT 'OSS-' || to_char(now() AT TIME ZONE 'Europe/London', 'YYYY') || '-' || lpad(n::text, greatest(4, length(n::text)), '0') AS no FROM (SELECT nextval('oss_member_seq') AS n) s`);
  return r.rows[0].no;
}

/* What the applicant sees about their own record. */
export async function publicView(q, row) {
  if (!row) return null;
  return {
    memberNo: row.member_no, status: row.status, tier: row.tier, tierLabel: { en: tierLabel(row.tier, 'en'), ar: tierLabel(row.tier, 'ar') },
    name: row.name, appliedAt: row.applied_at, decidedAt: row.decided_at, validUntil: row.valid_until,
    position: await positionOf(q, row), amountGbp: row.amount_gbp, paymentStatus: row.payment_status, nationalityStatus: row.nationality_status,
    infoRequest: row.status === 'info_requested' ? row.info_request : null, infoRequestedAt: row.status === 'info_requested' ? row.info_requested_at : null,
    infoResponse: row.info_response, infoResponseAt: row.info_response_at, emailVerified: !!row.email_verified_at,
    reason: row.status === 'declined' || row.status === 'revoked' ? row.decision_reason : null,
    evidence: await evidenceMeta(q, row.email).then((e) => (e ? { uploadedAt: e.uploadedAt } : null)), // the applicant sees only that a document is held
    canUploadProof: canUpload(row),
    feeWaived: row.payment_status === 'waived' && !!row.fee_code, // never the code itself
  };
}

/* ── proof of nationality: uploaded by the applicant, seen only by the committee, deleted once checked ──────────
   The file never travels by email. It sits in its own table, is opened through an audited desk route, and is removed
   the moment a result is recorded (or the application is decided, or 30 days pass). Only the result is kept. */
export const EVIDENCE_MAX_BYTES = 3 * 1024 * 1024;
export const EVIDENCE_KEEP_DAYS = 30;
const EVIDENCE_TYPES = { 'image/jpeg': [[0xff, 0xd8, 0xff]], 'image/png': [[0x89, 0x50, 0x4e, 0x47]], 'image/webp': [[0x52, 0x49, 0x46, 0x46]], 'application/pdf': [[0x25, 0x50, 0x44, 0x46]] };
async function evidenceMeta(q, email) {
  const r = (await q.query('SELECT mime, bytes, uploaded_at, viewed_at, viewed_by FROM oss_member_evidence WHERE email = $1', [email])).rows[0];
  return r ? { uploadedAt: r.uploaded_at, mime: r.mime, bytes: r.bytes, viewedAt: r.viewed_at, viewedBy: r.viewed_by } : null;
}
export async function deleteEvidence(q, email) {
  return (await q.query('DELETE FROM oss_member_evidence WHERE email = $1', [email])).rowCount || 0;
}
/* The upload is switched OFF for now (settings.nationalityUpload): the committee's secretary asks for proof by email
   when it is needed. With the switch off nothing can be uploaded, the pages do not offer it, and the scheduled job
   removes any document left over from when it was on. */
export const proofUploadEnabled = () => (process.env.NATIONALITY_UPLOAD || '').toLowerCase() === 'true' || SETTINGS.nationalityUpload === true;
const canUpload = (row) => proofUploadEnabled() && row && row.tier === 'saudi' && TIERS[row.tier].verify && OPEN.includes(row.status) && ['pending', 'submitted', 'rejected'].includes(row.nationality_status);
export async function uploadEvidence(q, email, body, site) {
  if (!proofUploadEnabled()) fail(404, 'not_found');
  const row = (await q.query('SELECT * FROM oss_members WHERE email = $1 FOR UPDATE', [email])).rows[0];
  if (!canUpload(row)) fail(400, 'not_needed');
  const mime = String(body.mime || '').toLowerCase();
  const sigs = EVIDENCE_TYPES[mime]; if (!sigs) fail(400, 'bad_type');
  const b64 = String(body.data || '').replace(/^data:[^,]*,/, '');
  if (!b64 || /[^A-Za-z0-9+/=]/.test(b64)) fail(400, 'bad_file');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 512) fail(400, 'bad_file');
  if (buf.length > EVIDENCE_MAX_BYTES) fail(413, 'file_too_large');
  if (!sigs.some((sig) => sig.every((v, i) => buf[i] === v))) fail(400, 'bad_type'); // the content must be what it says it is
  await q.query(`INSERT INTO oss_member_evidence (email, mime, bytes, data) VALUES ($1,$2,$3,$4)
    ON CONFLICT (email) DO UPDATE SET mime = EXCLUDED.mime, bytes = EXCLUDED.bytes, data = EXCLUDED.data, uploaded_at = now(), viewed_at = NULL, viewed_by = NULL`, [email, mime, buf.length, buf.toString('base64')]);
  const upd = (await q.query(`UPDATE oss_members SET nationality_status = 'submitted', updated_at = now() WHERE email = $1 RETURNING *`, [email])).rows[0];
  await audit(q, email, 'membership.evidence_uploaded', 'member:' + row.member_no, { mime, bytes: buf.length });
  await notifyCommittee(q, upd, await positionOf(q, upd), site, 'Proof of nationality uploaded');
  return publicView(q, upd);
}
export async function removeOwnEvidence(q, email) {
  const row = (await q.query('SELECT * FROM oss_members WHERE email = $1 FOR UPDATE', [email])).rows[0];
  if (!row) fail(404, 'not_found');
  const n = await deleteEvidence(q, email);
  let upd = row;
  if (n && row.nationality_status === 'submitted') upd = (await q.query(`UPDATE oss_members SET nationality_status = 'pending', updated_at = now() WHERE email = $1 RETURNING *`, [email])).rows[0];
  if (n) await audit(q, email, 'membership.evidence_removed', 'member:' + row.member_no, { by: 'applicant' });
  return publicView(q, upd);
}
/* Committee view of the document: every opening is written to the audit log. */
export async function viewEvidence(q, staff, no) {
  requireRole(staff, 'events_admin');
  const row = (await q.query('SELECT email, member_no FROM oss_members WHERE member_no = $1', [String(no || '').slice(0, 60)])).rows[0];
  if (!row) fail(404, 'not_found');
  const ev = (await q.query('SELECT mime, data FROM oss_member_evidence WHERE email = $1', [row.email])).rows[0];
  if (!ev) fail(404, 'no_document');
  await q.query('UPDATE oss_member_evidence SET viewed_at = now(), viewed_by = $2 WHERE email = $1', [row.email, staff.email]);
  await audit(q, staff.email, 'membership.evidence_viewed', 'member:' + row.member_no, null);
  return { mime: ev.mime, buffer: Buffer.from(ev.data, 'base64') };
}
/* Scheduled safety net: a document nobody has checked is not kept beyond the limit. */
export async function expireEvidence(q) {
  // switched off → nothing uploaded earlier is kept at all
  const old = (await q.query(`SELECT e.email, m.member_no FROM oss_member_evidence e JOIN oss_members m ON m.email = e.email WHERE $2 OR e.uploaded_at < now() - make_interval(days => $1)`, [EVIDENCE_KEEP_DAYS, !proofUploadEnabled()])).rows;
  for (const r of old) {
    await deleteEvidence(q, r.email);
    await q.query(`UPDATE oss_members SET nationality_status = 'pending', updated_at = now() WHERE email = $1 AND nationality_status IN ('submitted','rejected')`, [r.email]);
    await audit(q, 'system', 'membership.evidence_expired', 'member:' + r.member_no, { days: EVIDENCE_KEEP_DAYS });
  }
  return old.length;
}

function nextStepText(row, lang) {
  const waived = row.fee_code && row.payment_status === 'waived' ? (lang === 'ar' ? 'تم إعفاؤك من رسوم العضوية بموجب الرمز الذي أدخلته. ' : 'Your membership fee has been waived with the code you entered. ') : '';
  return waived + nextStepCore(row, lang);
}
function nextStepCore(row, lang) {
  const ar = lang === 'ar';
  if (row.amount_gbp > 0) {
    const bank = SETTINGS.bank || {};
    const bankLine = bank.sortCode && bank.accountNumber ? (ar ? `أو بالتحويل البنكي: ${bank.accountName || 'Oxford Saudi Society'}، رمز الفرع ${bank.sortCode}، الحساب ${bank.accountNumber}، المرجع ${row.member_no}.` : `Or by bank transfer: ${bank.accountName || 'Oxford Saudi Society'}, sort code ${bank.sortCode}, account ${bank.accountNumber}, reference ${row.member_no}.`) : (ar ? 'ستصلك تفاصيل الدفع من أمين الصندوق.' : 'The treasurer will send you payment details.');
    const link = (SETTINGS.payLinks || {})[row.tier];
    return ar ? `الخطوة التالية: رسوم العضوية £${row.amount_gbp}. ${link ? 'ادفع بالبطاقة: ' + link + ' ' : ''}${bankLine} اذكر رقم عضويتك مرجعًا للدفع.` : `Next step: the membership fee is £${row.amount_gbp}. ${link ? 'Pay by card: ' + link + ' ' : ''}${bankLine} Quote your membership number as the payment reference.`;
  }
  if (row.tier === 'saudi' && ['pending', 'rejected'].includes(row.nationality_status)) {
    if (!proofUploadEnabled()) return ar ? 'لا يلزمك فعل شيء الآن. سيراسلك أمين سر مجلس إدارة الجمعية لاحقًا لطلب إثبات الجنسية السعودية عند الحاجة. يرجى عدم إرسال أي وثيقة هوية قبل أن يُطلب منك ذلك.' : 'Nothing is needed from you now. The committee’s secretary will email you later to ask for proof of Saudi nationality, if it is needed. Please do not send any identity document until you are asked.';
    return ar ? 'الخطوة التالية: سجّل الدخول عبر الرابط أدناه وارفع من صفحة عضويتك مستندًا واحدًا يثبت الجنسية السعودية (صفحة الصورة في جواز السفر، أو الهوية الوطنية، أو تأكيد الابتعاث من الملحقية الثقافية). يُحذف المستند فور تحقق اللجنة منه. يرجى عدم إرسال وثائق الهوية بالبريد الإلكتروني.' : 'Next step: sign in with the link below and, on your membership page, upload one proof of Saudi nationality (the photo page of your passport, your national ID or your Cultural Bureau scholarship confirmation). It is deleted as soon as the committee has checked it. Please do not send identity documents by email.';
  }
  return ar ? 'لا يلزمك فعل شيء الآن؛ سنراسلك عند البت في طلبك.' : 'Nothing else is needed from you now; we will email you when the committee has decided.';
}

/* ── public: apply ──────────────────────────────────────────────── */
export async function apply(q, body, site, sessionEmail) {
  const email = normEmail(body.email), name = cleanName(body.name), lang = body.lang === 'ar' ? 'ar' : 'en';
  const tier = String(body.tier || ''), uni = String(body.status || ''), heard = String(body.heard || '');
  const fields = {};
  if (!TIERS[tier]) fields.tier = 'required';
  if (name.length < 2) fields.name = 'required';
  if (!validEmail(email)) fields.email = 'invalid';
  const college = cleanName(body.college).slice(0, 120); if (college.length < 2) fields.college = 'required';
  if (!UNI_STATUS.includes(uni)) fields.status = 'required';
  const uniOther = uni === 'other' ? cleanName(body.statusOther).slice(0, 80) : '';
  if (uni === 'other' && uniOther.length < 2) fields.statusOther = 'required';
  const sso = String(body.sso || '').trim().toLowerCase();
  if (SSO_TIERS.includes(tier) && !sso) fields.sso = 'required'; else if (sso && !SSO_RE.test(sso)) fields.sso = 'invalid';
  if (body.consent_privacy !== true) fields.consent = 'required';
  if (Object.keys(fields).length) fail(400, 'validation', { fields });
  const volunteer = (Array.isArray(body.volunteer) ? body.volunteer : []).map(String).filter((v) => VOLUNTEER.includes(v));
  const rec = {
    name, name_ar: cleanName(body.nameAr).slice(0, 120) || null, college, uni_status: uni, uni_status_other: uniOther || null, phone: String(body.phone || '').replace(/[^\d+()\s-]/g, '').slice(0, 30) || null,
    volunteer, heard: heard && HEARD.includes(heard) ? heard : null, lang, consent_privacy_version: String(body.privacy_version || SETTINGS.privacyVersion || '2026-11').slice(0, 40),
    sso_username: sso || null, fee_code: null, consent_news: body.consent_news === true, tier, amount_gbp: priceOf(tier), payment_status: priceOf(tier) > 0 ? 'due' : 'not_required', nationality_status: TIERS[tier].verify ? 'pending' : 'not_required',
  };
  const existing = (await q.query('SELECT * FROM oss_members WHERE email = $1 FOR UPDATE', [email])).rows[0];
  // Fee code — only for the membership types that carry a fee. Accepted → the fee is waived; declined → the form stops here.
  const codeIn = cleanCode(body.feeCode); let countCode = false;
  if (codeIn && priceOf(tier) > 0 && !(existing && existing.status === 'approved')) {
    const held = !!existing && existing.fee_code === codeIn && existing.tier === tier; // already theirs: not checked or counted twice
    if (!held) { const c = await checkCode(q, codeIn, true); if (!c.ok) fail(400, 'validation', { fields: { feeCode: c.reason } }); countCode = true; }
    Object.assign(rec, { amount_gbp: 0, payment_status: 'waived', fee_code: codeIn });
  }
  const useCode = async (no) => { if (!countCode) return; await q.query('UPDATE oss_fee_codes SET used = used + 1 WHERE code = $1', [codeIn]); await audit(q, email, 'membership.fee_code_used', 'member:' + no, { code: codeIn }); };
  if (existing && existing.status === 'approved') return { result: 'already_member', member: Object.assign(await publicView(q, existing), { evidence: null, canUploadProof: false }) };
  if (existing && OPEN.includes(existing.status)) {
    const same = existing.tier === tier && existing.name === rec.name && (existing.college || '') === rec.college && existing.uni_status === rec.uni_status && (existing.uni_status_other || null) === rec.uni_status_other && (existing.sso_username || null) === rec.sso_username && (rec.fee_code || existing.fee_code || null) === (existing.fee_code || null);
    if (same) return { result: 'already', member: Object.assign(await publicView(q, existing), { evidence: null, canUploadProof: false }) }; // the public form never says whether a document is held
    // The form was sent again with different answers (most often a different membership type): the open application
    // takes the new answers and keeps its number and its place in the queue, and the address owner is told by email.
    // Once the address has been confirmed, only its owner (signed in) can change the application this way.
    if (existing.email_verified_at && sessionEmail !== email) return { result: 'already', needsSignIn: true, member: Object.assign(await publicView(q, existing), { evidence: null, canUploadProof: false }) };
    const tierChanged = existing.tier !== tier;
    const keepWaiver = !rec.fee_code && !tierChanged && !!existing.fee_code && existing.payment_status === 'waived'; // an earlier code still stands for the same type
    if (keepWaiver) Object.assign(rec, { amount_gbp: 0, fee_code: existing.fee_code });
    const pay = rec.fee_code && !keepWaiver ? 'waived' : (tierChanged ? rec.payment_status : existing.payment_status);
    const nat = !TIERS[tier].verify ? 'not_required' : (tierChanged || existing.nationality_status === 'not_required' ? 'pending' : existing.nationality_status);
    const upd = (await q.query(`UPDATE oss_members SET name=$2, name_ar=$3, college=$4, uni_status=$5, uni_status_other=$6, phone=$7, volunteer=$8, lang=$9, consent_privacy_version=$10, consent_news=$11, tier=$12, amount_gbp=$13,
      payment_status=$14, nationality_status=$15, updated_at=now() WHERE email=$1 RETURNING *`, [email, rec.name, rec.name_ar, rec.college, rec.uni_status, rec.uni_status_other, rec.phone, rec.volunteer, rec.lang, rec.consent_privacy_version, rec.consent_news, rec.tier, rec.amount_gbp, pay, nat])).rows[0];
    await q.query('UPDATE oss_members SET sso_username = $2, fee_code = $3 WHERE email = $1', [email, rec.sso_username, rec.fee_code]); upd.sso_username = rec.sso_username; upd.fee_code = rec.fee_code;
    await useCode(upd.member_no);
    if (tierChanged) await deleteEvidence(q, email);
    const pos = await positionOf(q, upd), uu = urlsFor(site, lang);
    const tok = await createPending(q, { kind: 'login', email, lang, ttlMin: 1440, payload: { redirect: (lang === 'ar' ? '/ar' : '') + '/account/' } });
    await enqueue(q, { kind: 'membership_changed', to: email, lang, dedupeKey: `membership_changed:${upd.member_no}:${Date.now()}`,
      vars: Object.assign({ name: upd.name, memberNo: upd.member_no, tierLabel: tierLabel(tier, lang), position: pos, nextStep: nextStepText(upd, lang), link: `${site}/api/verify?t=${tok}`, membershipEmail: SETTINGS.membershipEmail || SETTINGS.email || '', siteUrl: site }, uu) });
    if (tierChanged) await notifyCommittee(q, upd, pos, site, 'Application changed to ' + tierLabel(tier, 'en'));
    await audit(q, email, 'membership.changed', 'member:' + upd.member_no, tierChanged ? { from: existing.tier, to: tier } : { details: true });
    return { result: 'updated', member: Object.assign(await publicView(q, upd), { evidence: null, canUploadProof: false }) };
  }
  let row;
  if (existing) { // re-application after a decline/revocation/expiry keeps the same membership number
    row = (await q.query(`UPDATE oss_members SET name=$2, name_ar=$3, college=$4, uni_status=$5, uni_status_other=$16, phone=$6, volunteer=$7, heard=$8, lang=$9, consent_privacy_version=$10, consent_news=$11, tier=$12, amount_gbp=$13,
      payment_status=$14, nationality_status=$15, status='pending', applied_at=now(), info_request=NULL, info_requested_at=NULL, info_response=NULL, info_response_at=NULL, decided_at=NULL, decided_by=NULL, decision_reason=NULL, valid_until=NULL, source='web', updated_at=now()
      WHERE email=$1 RETURNING *`, [email, rec.name, rec.name_ar, rec.college, rec.uni_status, rec.phone, rec.volunteer, rec.heard, rec.lang, rec.consent_privacy_version, rec.consent_news, rec.tier, rec.amount_gbp, rec.payment_status, rec.nationality_status, rec.uni_status_other])).rows[0];
  } else {
    const no = await nextNumber(q);
    row = (await q.query(`INSERT INTO oss_members (email, member_no, name, name_ar, college, uni_status, phone, volunteer, heard, lang, consent_privacy_version, consent_news, tier, amount_gbp, payment_status, nationality_status, status, applied_at, source, uni_status_other)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending',now(),'web',$17) RETURNING *`,
      [email, no, rec.name, rec.name_ar, rec.college, rec.uni_status, rec.phone, rec.volunteer, rec.heard, rec.lang, rec.consent_privacy_version, rec.consent_news, rec.tier, rec.amount_gbp, rec.payment_status, rec.nationality_status, rec.uni_status_other])).rows[0];
  }
  await q.query('UPDATE oss_members SET sso_username = $2, fee_code = $3 WHERE email = $1', [email, rec.sso_username, rec.fee_code]); row.sso_username = rec.sso_username; row.fee_code = rec.fee_code;
  await useCode(row.member_no);
  const position = await positionOf(q, row);
  const u = urlsFor(site, lang);
  const token = await createPending(q, { kind: 'login', email, lang, ttlMin: 1440, payload: { redirect: (lang === 'ar' ? '/ar' : '') + '/account/' } });
  await enqueue(q, { kind: 'membership_received', to: email, lang, dedupeKey: `membership_received:${row.member_no}:${new Date(row.applied_at).getTime()}`,
    vars: Object.assign({ name, memberNo: row.member_no, tierLabel: tierLabel(tier, lang), position, nextStep: nextStepText(row, lang), link: `${site}/api/verify?t=${token}`, siteUrl: site }, u) });
  await notifyCommittee(q, row, position, site, 'New membership application');
  await audit(q, email, existing ? 'membership.reapplied' : 'membership.applied', 'member:' + row.member_no, { tier });
  return { result: 'received', member: Object.assign(await publicView(q, row), { evidence: null, canUploadProof: false }) };
}

async function notifyCommittee(q, row, position, site, headline, response) {
  const to = SETTINGS.committeeNotifyEmail; if (!to) return;
  await enqueue(q, { kind: 'membership_committee', to, lang: 'en', dedupeKey: `committee:${headline}:${row.member_no}:${Date.now()}`,
    vars: { headline, memberNo: row.member_no, name: row.name, nameAr: row.name_ar, email: row.email, tierLabel: tierLabel(row.tier, 'en'), college: row.college || '', sso: row.sso_username || '', feeCode: row.payment_status === 'waived' ? row.fee_code || '' : '', uniStatus: uniText(row), position: position == null ? '—' : position, response, deskUrl: urlsFor(site, 'en').deskUrl, siteUrl: site } });
}

/* ── applicant: own record, answer an information request ──────── */
export async function mine(q, email) {
  const row = (await q.query('SELECT * FROM oss_members WHERE email = $1', [email])).rows[0];
  return publicView(q, row);
}
export async function respond(q, email, body, site) {
  const text = String(body.response || '').replace(/\u0000/g, '').trim().slice(0, 4000);
  if (text.length < 2) fail(400, 'validation', { fields: { response: 'required' } });
  const row = (await q.query('SELECT * FROM oss_members WHERE email = $1 FOR UPDATE', [email])).rows[0];
  if (!row || row.status !== 'info_requested') fail(400, 'no_open_question');
  const upd = (await q.query(`UPDATE oss_members SET status='pending', info_response=$2, info_response_at=now(), updated_at=now() WHERE email=$1 RETURNING *`, [email, text])).rows[0];
  await notifyCommittee(q, upd, await positionOf(q, upd), site, 'Applicant answered the committee', text);
  await audit(q, email, 'membership.responded', 'member:' + row.member_no, null);
  return publicView(q, upd);
}

/* ── committee desk ─────────────────────────────────────────────── */
const DESK_FIELDS = 'email, member_no, name, name_ar, sso_username, fee_code, college, uni_status, uni_status_other, phone, volunteer, heard, lang, consent_news, consent_privacy_version, tier, amount_gbp, payment_status, nationality_status, status, applied_at, email_verified_at, info_request, info_requested_at, info_response, info_response_at, decided_at, decided_by, decision_reason, valid_until, approved_at, approved_by, notes, source, created_at, updated_at';
export async function list(q, staff, params) {
  requireRole(staff, 'events_admin');
  const view = params.get('view') || 'queue';
  const term = (params.get('q') || '').trim().toLowerCase();
  const args = []; const where = [];
  if (view === 'queue') { args.push(OPEN); where.push(`status = ANY($${args.length})`); }
  else if (view !== 'all') { args.push(view); where.push(`status = $${args.length}`); }
  if (term) { args.push('%' + term.replace(/[%_]/g, '\\$&') + '%'); where.push(`(email LIKE $${args.length} OR lower(name) LIKE $${args.length} OR lower(coalesce(member_no,'')) LIKE $${args.length} OR lower(coalesce(name_ar,'')) LIKE $${args.length})`); }
  const order = view === 'queue' ? 'applied_at ASC, member_no ASC' : 'coalesce(applied_at, created_at) DESC';
  const rows = (await q.query(`SELECT ${DESK_FIELDS} FROM oss_members ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT 500`, args)).rows;
  const out = [];
  for (const r of rows) out.push(Object.assign({}, r, { position: await positionOf(q, r), tierLabel: tierLabel(r.tier, 'en') }));
  const totals = Object.fromEntries((await q.query('SELECT status, count(*)::int AS n FROM oss_members GROUP BY status')).rows.map((x) => [x.status, x.n]));
  return { members: out, totals };
}
async function load(q, no) {
  const r = (await q.query('SELECT * FROM oss_members WHERE member_no = $1 OR email = $1 FOR UPDATE', [String(no || '').slice(0, 254)])).rows[0];
  if (!r) fail(404, 'not_found');
  return r;
}
export async function detail(q, staff, no) {
  requireRole(staff, 'events_admin');
  const r = (await q.query(`SELECT ${DESK_FIELDS} FROM oss_members WHERE member_no = $1`, [no])).rows[0];
  if (!r) fail(404, 'not_found');
  const history = (await q.query(`SELECT at, actor, action, meta FROM oss_audit WHERE resource = $1 ORDER BY id`, ['member:' + r.member_no])).rows;
  return { member: Object.assign({}, r, { position: await positionOf(q, r), tierLabel: tierLabel(r.tier, 'en'), evidence: await evidenceMeta(q, r.email) }), history };
}
function mailVars(row, site) { return Object.assign({ name: row.name, memberNo: row.member_no, tierLabel: tierLabel(row.tier, row.lang), membershipEmail: SETTINGS.membershipEmail || SETTINGS.email || '', siteUrl: site }, urlsFor(site, row.lang)); }

export async function decide(q, staff, no, action, body, site) {
  requireRole(staff, 'events_admin');
  const row = await load(q, no);
  const reason = String(body.reason || body.message || '').replace(/\u0000/g, '').trim().slice(0, 2000);
  let upd, kind, extra = {};
  if (action === 'approve') {
    if (!OPEN.includes(row.status) && row.status !== 'revoked' && row.status !== 'declined' && row.status !== 'expired') fail(400, 'bad_state');
    let until = null;
    if (body.validUntil) { const d = new Date(body.validUntil); if (isNaN(d)) fail(400, 'bad_date'); until = body.validUntil.slice(0, 10); }
    upd = (await q.query(`UPDATE oss_members SET status='approved', valid_until=$2, approved_at=now(), approved_by=$3, decided_at=now(), decided_by=$3, decision_reason=NULL,
      nationality_status = CASE WHEN nationality_status = 'submitted' THEN 'verified' ELSE nationality_status END, updated_at=now() WHERE email=$1 RETURNING *`, [row.email, until, staff.email])).rows[0];
    kind = 'membership_approved';
    extra.validUntil = until ? new Intl.DateTimeFormat(row.lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-arab' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(new Date(until + 'T12:00:00Z')) : '';
  } else if (action === 'request-info') {
    if (!OPEN.includes(row.status)) fail(400, 'bad_state');
    if (reason.length < 5) fail(400, 'validation', { fields: { message: 'required' } });
    upd = (await q.query(`UPDATE oss_members SET status='info_requested', info_request=$2, info_requested_at=now(), info_response=NULL, info_response_at=NULL, updated_at=now() WHERE email=$1 RETURNING *`, [row.email, reason])).rows[0];
    kind = 'membership_info_request'; extra.message = reason;
  } else if (action === 'decline') {
    if (!OPEN.includes(row.status)) fail(400, 'bad_state');
    upd = (await q.query(`UPDATE oss_members SET status='declined', decided_at=now(), decided_by=$2, decision_reason=$3, updated_at=now() WHERE email=$1 RETURNING *`, [row.email, staff.email, reason || null])).rows[0];
    kind = 'membership_declined'; extra.reason = reason;
  } else if (action === 'revoke') {
    if (row.status !== 'approved') fail(400, 'bad_state');
    upd = (await q.query(`UPDATE oss_members SET status='revoked', decided_at=now(), decided_by=$2, decision_reason=$3, updated_at=now() WHERE email=$1 RETURNING *`, [row.email, staff.email, reason || null])).rows[0];
    kind = 'membership_revoked'; extra.reason = reason;
  } else fail(404, 'not_found');
  if (action !== 'request-info' && await deleteEvidence(q, row.email)) await audit(q, staff.email, 'membership.evidence_deleted', 'member:' + row.member_no, { because: action });
  if (body.notify !== false) await enqueue(q, { kind, to: row.email, lang: row.lang, dedupeKey: `${kind}:${row.member_no}:${Date.now()}`, vars: Object.assign(mailVars(upd, site), extra) });
  await audit(q, staff.email, 'membership.' + ({ approve: 'approved', 'request-info': 'info_requested', decline: 'declined', revoke: 'revoked' })[action], 'member:' + row.member_no, { from: row.status, to: upd.status, reason: reason ? reason.slice(0, 200) : null, notified: body.notify !== false });
  return detail(q, staff, row.member_no);
}

export async function update(q, staff, no, body, site) {
  requireRole(staff, 'events_admin');
  const row = await load(q, no);
  const set = {}; const meta = {};
  if (body.paymentStatus !== undefined) { if (!['not_required', 'due', 'received', 'waived'].includes(body.paymentStatus)) fail(400, 'bad_payment_status'); set.payment_status = body.paymentStatus; }
  if (body.nationalityStatus !== undefined) { if (!['not_required', 'pending', 'submitted', 'verified', 'rejected'].includes(body.nationalityStatus)) fail(400, 'bad_nationality_status'); if (body.nationalityStatus !== row.nationality_status) set.nationality_status = body.nationalityStatus; }
  if (body.notes !== undefined) set.notes = String(body.notes || '').slice(0, 2000);
  if (body.validUntil !== undefined) { set.valid_until = body.validUntil ? String(body.validUntil).slice(0, 10) : null; if (set.valid_until && isNaN(new Date(set.valid_until))) fail(400, 'bad_date'); }
  const keys = Object.keys(set); if (!keys.length) return detail(q, staff, row.member_no);
  await q.query(`UPDATE oss_members SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE email = $1`, [row.email].concat(keys.map((k) => set[k])));
  keys.forEach((k) => { meta[k] = k === 'notes' ? '(updated)' : set[k]; });
  // recording a result ends the need for the document: it is deleted in the same transaction
  if (set.nationality_status && set.nationality_status !== 'submitted') {
    if (await deleteEvidence(q, row.email)) meta.evidenceDeleted = true;
    if (set.nationality_status === 'rejected' && OPEN.includes(row.status) && body.notify !== false) {
      await enqueue(q, { kind: 'membership_proof_again', to: row.email, lang: row.lang, dedupeKey: `proof_again:${row.member_no}:${Date.now()}`, vars: mailVars(row, site || SETTINGS.domain || '') });
    }
  }
  await audit(q, staff.email, 'membership.updated', 'member:' + row.member_no, meta);
  return detail(q, staff, row.member_no);
}

/* Manual additions from the desk (e.g. existing members carried over) also receive a number. */
export async function addManual(q, staff, rows) {
  requireRole(staff, 'events_admin');
  let n = 0;
  for (const raw of rows) {
    const email = normEmail(raw.email); if (!validEmail(email)) continue;
    const status = ['pending', 'approved', 'revoked', 'expired'].includes(raw.status) ? raw.status : 'approved';
    const tier = TIERS[raw.tier] ? raw.tier : 'student';
    const exists = (await q.query('SELECT member_no FROM oss_members WHERE email = $1 FOR UPDATE', [email])).rows[0];
    if (exists) {
      await q.query(`UPDATE oss_members SET name = COALESCE(NULLIF($2, ''), name), status = $3, tier = $4, valid_until = $5, approved_at = CASE WHEN $3 = 'approved' THEN now() ELSE approved_at END, approved_by = $6, decided_at = now(), decided_by = $6, notes = COALESCE(NULLIF($7, ''), notes), updated_at = now() WHERE email = $1`,
        [email, cleanName(raw.name || ''), status, tier, raw.validUntil ? String(raw.validUntil).slice(0, 10) : null, staff.email, raw.notes ? String(raw.notes).slice(0, 500) : '']);
      await audit(q, staff.email, 'membership.updated_manually', 'member:' + exists.member_no, { status });
    } else {
      const no = await nextNumber(q);
      await q.query(`INSERT INTO oss_members (email, member_no, name, status, tier, valid_until, approved_at, approved_by, decided_at, decided_by, applied_at, source, notes, payment_status, nationality_status)
        VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $4 = 'approved' THEN now() ELSE NULL END, $7, now(), $7, now(), 'desk', $8, 'not_required', 'not_required')`,
        [email, no, cleanName(raw.name || '') || email, status, tier, raw.validUntil ? String(raw.validUntil).slice(0, 10) : null, staff.email, raw.notes ? String(raw.notes).slice(0, 500) : null]);
      await audit(q, staff.email, 'membership.added_manually', 'member:' + no, { status });
    }
    n++;
  }
  return { ok: true, count: n };
}

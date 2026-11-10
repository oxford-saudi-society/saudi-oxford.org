/* Membership: applications, permanent membership numbers, the review queue and committee decisions.
   oss_members is the single register: one row per email, also used by members-only events. */
import { randomBytes } from 'node:crypto';
import { SETTINGS } from './content.generated.mjs';
import { fail, normEmail, validEmail, cleanName } from './http.mjs';
import { requireRole, createPending } from './auth.mjs';
import { enqueue } from './mail.mjs';
import { audit } from './events.mjs';

/* ── the six registration categories ────────────────────────────────────────────────────────────────────────────
   Four are memberships and live in oss_members (one row per email). The mailing list and volunteer registration are
   separate registers (oss_subscribers, oss_volunteers): they carry no membership rights, and one person can hold a
   membership, a mailing-list subscription and a volunteer registration independently of each other. */
export const TIERS = {
  saudi: { en: 'Saudi Oxford Community Membership', ar: 'عضوية السعوديين في أكسفورد', price: 0, verify: true },
  student: { en: 'Oxford Student Membership', ar: 'عضوية طلبة جامعة أكسفورد', price: null, verify: false },
  external: { en: 'Other University Student Membership', ar: 'عضوية طلبة الجامعات الأخرى', price: null, verify: false },
  associate: { en: 'Associate Membership', ar: 'العضوية المنتسبة', price: null, verify: false },
};
export const REGISTERS = { mailing: { en: 'Mailing List', ar: 'القائمة البريدية' }, volunteer: { en: 'Volunteer Registration', ar: 'التسجيل للتطوع' } };
/* Step 2. Every status has a "kind", and the kind decides which details step 3 asks for (see details()). */
export const STATUS = {
  undergraduate: { kind: 'student', en: 'Undergraduate student', ar: 'طالب بكالوريوس' },
  masters: { kind: 'student', en: 'Master’s student', ar: 'طالب ماجستير' },
  doctoral: { kind: 'student', en: 'Doctoral student', ar: 'طالب دكتوراه' },
  visiting_student: { kind: 'student', en: 'Visiting student', ar: 'طالب زائر' },
  alumni: { kind: 'alumni', en: 'Oxford university alumnus', ar: 'خريج إحدى جامعات أكسفورد' },
  academic_staff: { kind: 'academic', en: 'Academic staff', ar: 'عضو هيئة تدريس' },
  researcher: { kind: 'academic', en: 'Researcher / postdoctoral researcher', ar: 'باحث أو باحث ما بعد الدكتوراه' },
  visiting_researcher: { kind: 'academic', en: 'Visiting researcher', ar: 'باحث زائر' },
  clinical_fellow: { kind: 'clinical', en: 'Clinical fellow', ar: 'طبيب زمالة' },
  resident_doctor: { kind: 'clinical', en: 'Resident doctor', ar: 'طبيب مقيم' },
  consultant: { kind: 'clinical', en: 'Consultant physician', ar: 'طبيب استشاري' },
  healthcare: { kind: 'health', en: 'Other healthcare professional', ar: 'ممارس صحي' },
  university_employee: { kind: 'employee', en: 'University or research-institution employee', ar: 'موظف في جامعة أو جهة بحثية' },
  oxford_professional: { kind: 'work', en: 'Oxford-based professional or business owner', ar: 'موظف أو صاحب عمل في مدينة أكسفورد' },
  other_connection: { kind: 'other', en: 'Other Oxford connection', ar: 'صلة أخرى بأكسفورد' },
  professional: { kind: 'work', en: 'Employee or professional', ar: 'موظف أو مهني' },
  supporter: { kind: 'none', en: 'Friend or supporter of the Society', ar: 'صديق أو داعم للجمعية' },
  other: { kind: 'other', en: 'Other', ar: 'أخرى' },
};
export const TIER_STATUS = {
  saudi: ['undergraduate', 'masters', 'doctoral', 'visiting_student', 'alumni', 'academic_staff', 'researcher', 'visiting_researcher', 'clinical_fellow', 'resident_doctor', 'consultant', 'healthcare', 'university_employee', 'oxford_professional', 'other_connection'],
  student: ['undergraduate', 'masters', 'doctoral', 'visiting_student'],
  external: ['undergraduate', 'masters', 'doctoral', 'visiting_student'], // the level of study; where they study is uni_place
  associate: ['academic_staff', 'researcher', 'visiting_researcher', 'university_employee', 'alumni', 'clinical_fellow', 'resident_doctor', 'consultant', 'healthcare', 'professional', 'supporter', 'other'],
};
/* The same status reads slightly differently in two of the lists. */
const STATUS_ALT = {
  associate: { researcher: { en: 'Researcher', ar: 'باحث' }, university_employee: { en: 'University employee', ar: 'موظف جامعي' }, alumni: { en: 'Alumnus', ar: 'خريج' } },
  external: { undergraduate: { en: 'Undergraduate', ar: 'بكالوريوس' }, masters: { en: 'Master’s', ar: 'ماجستير' }, doctoral: { en: 'Doctorate', ar: 'دكتوراه' } },
};
export const PLACES = { brookes: { en: 'Oxford Brookes University', ar: 'جامعة أكسفورد بروكس' }, uk_university: { en: 'Another UK university', ar: 'جامعة أخرى داخل بريطانيا' }, global_university: { en: 'University outside the UK', ar: 'جامعة خارج بريطانيا' } };
export const UNI_CHOICE = { oxford: { en: 'University of Oxford', ar: 'جامعة أكسفورد' }, brookes: { en: 'Oxford Brookes University', ar: 'جامعة أكسفورد بروكس' } }; // or "other", typed by the applicant
export const HOSPITALS = {
  jr: { en: 'John Radcliffe Hospital', ar: 'مستشفى جون رادكليف' }, churchill: { en: 'Churchill Hospital', ar: 'مستشفى تشرشل' }, noc: { en: 'Nuffield Orthopaedic Centre', ar: 'مركز نافيلد لجراحة العظام' },
  ouh_other: { en: 'Another Oxford University Hospitals site', ar: 'مستشفى آخر تابع لمستشفيات جامعة أكسفورد' }, other: { en: 'Another healthcare organisation in Oxford', ar: 'جهة صحية أخرى في أكسفورد' },
};
export const INTERESTS = ['cultural', 'social', 'academic', 'careers', 'all_news'];
export const AREAS = ['events', 'media', 'photography', 'partnerships', 'welcome', 'academic', 'admin'];
export const AREA_LABEL = { events: 'Event organisation', media: 'Media and design', photography: 'Photography and media coverage', partnerships: 'Sponsorships and partnerships', welcome: 'Welcoming and supporting new students', academic: 'Academic and professional programmes', admin: 'Administrative and organisational support' };
const VOL_PLACE = { oxford: 'In Oxford', remote: 'Remotely', both: 'Both' };
const SSO_RE = /^[a-z]{4}[0-9]{4}$/; // Oxford Single Sign-On username: four letters then four digits (always optional)
const clean = (v, max = 120) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const pick = (list, allowed) => [...new Set((Array.isArray(list) ? list : []).map(String).filter((v) => allowed.includes(v)))];
const phoneOf = (v) => String(v || '').replace(/[^\d+()\s-]/g, '').trim().slice(0, 30) || null; // any country: +44…, +966…
export const statusLabel = (tier, status, lang) => { const alt = (STATUS_ALT[tier] || {})[status], s = alt || STATUS[status]; return s ? s[lang] || s.en : (status || ''); };
/* Status as one line for the committee: "Doctoral student" or, for another university, "Oxford Brookes University · Master's". */
const uniText = (row) => [row.uni_place && PLACES[row.uni_place] ? PLACES[row.uni_place].en : '', statusLabel(row.tier, row.uni_status, 'en')].filter(Boolean).join(' · ');
export const OPEN = ['pending', 'info_requested'];

export function priceOf(tier) {
  const t = TIERS[tier]; if (!t) return 0;
  if (t.price !== null) return t.price;
  const fees = SETTINGS.fees || {};
  return Number(fees[tier] != null ? fees[tier] : tier === 'associate' ? 15 : 10) || 0;
}
const discounted = (price, percent) => Math.max(0, Math.round((price * (100 - percent)) / 100));
/* ── discount and exemption codes ───────────────────────────────────────────────────────────────────────────────
   The committee creates a code in the desk and gives it to someone who would normally pay. Entered on the join form
   with a fee-paying membership type, a valid code takes its percentage off the fee (100% = full exemption); a wrong,
   expired, switched-off or used-up code is refused and the form is not sent. The application is still reviewed.

   Whether a code works is decided ONLY by its record in oss_fee_codes: it exists, is switched on, has not expired, has
   uses left, and belongs to this person if it is reserved. Nothing depends on what the code looks like. A code is
   matched to its record by what it says, not by how it was typed: capitals or not, with or without dashes and spaces,
   and with the look-alikes O/0 and I/L/1 read as the same character.

   Codes the desk generates look like OSS-X26-7K4MQ-2XPDC (issuer, type and year of issue, nine characters from a secure
   random generator and a closing check character, over an alphabet without I, L, O and U). That shape is only a
   convenience for reading a code out; the committee can equally type its own wording. */
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function luhn32(payload) {
  let factor = 2, sum = 0;
  for (let i = payload.length - 1; i >= 0; i--) { let add = factor * B32.indexOf(payload[i]); factor = factor === 2 ? 1 : 2; add = Math.floor(add / 32) + (add % 32); sum += add; }
  return B32[(32 - (sum % 32)) % 32];
}
/* What is stored and shown: capitals, digits and single dashes. */
export const cleanCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
/* What two spellings of the same code have in common. */
const codeKey = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
const KEY_SQL = `translate(upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 'OIL', '011')`;
function newCode(now = new Date()) {
  const b = randomBytes(9); let body = ''; for (let i = 0; i < 9; i++) body += B32[b[i] & 31];
  const payload = 'X' + String(now.getUTCFullYear()).slice(-2) + body, full = payload + luhn32(payload);
  return 'OSS-' + full.slice(0, 3) + '-' + full.slice(3, 8) + '-' + full.slice(8);
}
async function checkCode(q, raw, lock, email) {
  const key = codeKey(raw); if (key.length < 4) return { ok: false, reason: 'invalid' };
  const r = (await q.query(`SELECT code, max_uses, used, disabled, email, percent_off, (expires_on IS NOT NULL AND expires_on < CURRENT_DATE) AS expired FROM oss_fee_codes WHERE ${KEY_SQL} = $1 ORDER BY created_at LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [key])).rows[0];
  if (!r || r.disabled) return { ok: false, reason: 'invalid' };
  if (r.expired) return { ok: false, reason: 'expired' };
  if (r.max_uses != null && r.used >= r.max_uses) return { ok: false, reason: 'used_up' };
  if (r.email && email && r.email !== email) return { ok: false, reason: 'not_yours' }; // reserved for one person
  return { ok: true, code: r.code, personal: !!r.email, percent: r.percent_off };
}
/* The join form's "Check code" button: accepted or declined, nothing is saved or counted here. */
export async function codeStatus(q, body) {
  const tier = String(body.tier || '');
  if (!TIERS[tier] || !(priceOf(tier) > 0)) return { ok: false, reason: 'not_needed' };
  const em = normEmail(body.email);
  const c = await checkCode(q, body.code, false, validEmail(em) ? em : null);
  return c.ok ? { ok: true, personal: c.personal, percent: c.percent, amountGbp: discounted(priceOf(tier), c.percent) } : { ok: false, reason: c.reason };
}
export async function codesList(q, staff) {
  requireRole(staff, 'events_admin');
  const rows = (await q.query(`SELECT code, label, email, max_uses, used, expires_on, disabled, percent_off, created_at, created_by, (expires_on IS NOT NULL AND expires_on < CURRENT_DATE) AS expired FROM oss_fee_codes ORDER BY created_at DESC, code`)).rows;
  return { codes: rows };
}
export async function codeCreate(q, staff, body) {
  requireRole(staff, 'events_admin');
  const code = cleanCode(body.code);
  if (String(body.code || '').trim() && codeKey(code).length < 6) fail(400, 'validation', { fields: { code: 'invalid' } });
  const forEmail = normEmail(body.email); if (forEmail && !validEmail(forEmail)) fail(400, 'validation', { fields: { email: 'invalid' } });
  if (forEmail && (body.maxUses === '' || body.maxUses == null)) body = Object.assign({}, body, { maxUses: 1 }); // a personal code is for one use unless told otherwise
  const label = String(body.label || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) || null;
  let max = body.maxUses === '' || body.maxUses == null ? null : parseInt(body.maxUses, 10);
  if (max !== null && (!Number.isFinite(max) || max < 1 || max > 100000)) fail(400, 'validation', { fields: { maxUses: 'invalid' } });
  const pct = body.percentOff === '' || body.percentOff == null ? 100 : Number(body.percentOff);
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) fail(400, 'validation', { fields: { percentOff: 'invalid' } });
  const exp = body.expiresOn ? String(body.expiresOn).slice(0, 10) : null;
  if (exp && (!/^\d{4}-\d{2}-\d{2}$/.test(exp) || isNaN(new Date(exp)))) fail(400, 'validation', { fields: { expiresOn: 'invalid' } });
  for (let tries = 0; ; tries++) {
    const c = code || newCode();
    const clash = (await q.query(`SELECT 1 FROM oss_fee_codes WHERE ${KEY_SQL} = $1`, [codeKey(c)])).rows.length > 0; // two spellings of one code are one code
    const ins = clash ? { rows: [] } : await q.query('INSERT INTO oss_fee_codes (code, label, max_uses, expires_on, created_by, email, percent_off) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (code) DO NOTHING RETURNING code', [c, label, max, exp, staff.email, forEmail || null, pct]);
    if (ins.rows.length) { await audit(q, staff.email, 'fee_code.created', 'fee_code:' + c, { label, maxUses: max, expiresOn: exp, percentOff: pct, personal: !!forEmail }); return Object.assign({ created: c }, await codesList(q, staff)); }
    if (code || tries > 4) fail(409, 'code_exists');
  }
}
export async function codeSwitch(q, staff, raw, disabled) {
  requireRole(staff, 'events_admin');
  const r = await q.query(`UPDATE oss_fee_codes SET disabled = $2 WHERE ${KEY_SQL} = $1 RETURNING code`, [codeKey(raw), !!disabled]);
  if (!r.rows.length) fail(404, 'not_found');
  await audit(q, staff.email, disabled ? 'fee_code.disabled' : 'fee_code.enabled', 'fee_code:' + r.rows[0].code, null);
  return codesList(q, staff);
}

const tierLabel = (tier, lang) => (TIERS[tier] ? TIERS[tier][lang] || TIERS[tier].en : REGISTERS[tier] ? REGISTERS[tier][lang] : tier);
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

/* What the applicant is told about where their application stands. */
export const STAGE_TEXT = {
  received: { en: 'Application received', ar: 'تم استلام الطلب' }, verifying: { en: 'Awaiting verification', ar: 'بانتظار التحقق' }, eligibility: { en: 'Awaiting eligibility check', ar: 'بانتظار التحقق من الأهلية' },
  awaiting_payment: { en: 'Awaiting payment', ar: 'بانتظار السداد' }, active: { en: 'Membership active', ar: 'العضوية فعّالة' }, needs_info: { en: 'More information needed', ar: 'يتطلب استكمال البيانات' },
  declined: { en: 'Not approved', ar: 'لم تتم الموافقة' }, revoked: { en: 'Ended', ar: 'منتهية' }, expired: { en: 'Expired', ar: 'منتهية الصلاحية' },
};
export function stageOf(row) {
  if (row.status === 'approved') return 'active';
  if (row.status === 'info_requested') return 'needs_info';
  if (row.status !== 'pending') return STAGE_TEXT[row.status] ? row.status : 'verifying'; // declined, revoked, expired
  if (row.eligibility === 'review') return 'eligibility'; // no fee is asked while this is open
  if (!row.email_verified_at) return 'received';
  if (row.amount_gbp > 0 && row.payment_status === 'due') return 'awaiting_payment';
  return 'verifying';
}
const arDigits = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
/* The fee as it is shown before sending and on the confirmation: Free, £10 per year, ١٠ جنيهات إسترلينية سنويًا … */
export function feeText(n, lang) {
  if (!(n > 0)) return lang === 'ar' ? 'مجانية' : 'Free';
  if (lang !== 'ar') return `£${n} per year`;
  if (n === 1) return 'جنيه إسترليني واحد سنويًا';
  if (n === 2) return 'جنيهان إسترلينيان سنويًا';
  return n <= 10 ? `${arDigits(n)} جنيهات إسترلينية سنويًا` : `${arDigits(n)} جنيهًا إسترلينيًا سنويًا`;
}

/* What the applicant sees about their own record. */
export async function publicView(q, row) {
  if (!row) return null;
  const stage = stageOf(row);
  const st = (lang) => [row.uni_place && PLACES[row.uni_place] ? PLACES[row.uni_place][lang] : '', statusLabel(row.tier, row.uni_status, lang)].filter(Boolean).join(lang === 'ar' ? ' · ' : ' · ');
  return {
    memberNo: row.member_no, status: row.status, stage, stageLabel: STAGE_TEXT[stage], tier: row.tier, tierLabel: { en: tierLabel(row.tier, 'en'), ar: tierLabel(row.tier, 'ar') },
    statusLabel: { en: st('en'), ar: st('ar') }, institution: row.university || null,
    name: row.name, appliedAt: row.applied_at, decidedAt: row.decided_at, validUntil: row.valid_until,
    position: await positionOf(q, row), amountGbp: row.amount_gbp, fee: { en: feeText(row.amount_gbp, 'en'), ar: feeText(row.amount_gbp, 'ar') }, paymentStatus: row.payment_status, nationalityStatus: row.nationality_status, eligibility: row.eligibility,
    infoRequest: row.status === 'info_requested' ? row.info_request : null, infoRequestedAt: row.status === 'info_requested' ? row.info_requested_at : null,
    infoResponse: row.info_response, infoResponseAt: row.info_response_at, emailVerified: !!row.email_verified_at,
    reason: row.status === 'declined' || row.status === 'revoked' ? row.decision_reason : null,
    evidence: await evidenceMeta(q, row.email).then((e) => (e ? { uploadedAt: e.uploadedAt } : null)), // the applicant sees only that a document is held
    canUploadProof: canUpload(row),
    feeWaived: row.payment_status === 'waived' && !!row.fee_code, feeDiscounted: !!row.fee_code && row.amount_gbp > 0, // never the code itself
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
  const ar = lang === 'ar';
  if (row.eligibility === 'review' && row.tier !== 'saudi') return ar ? 'حالة طلبك: بانتظار التحقق من الأهلية. ستراجع اللجنة أهليتك للعضوية المجانية للسعوديين في أكسفورد، ولن يُطلب منك دفع أي رسوم ما دام طلبك قيد المراجعة.' : 'Your application is marked “Awaiting eligibility check”. The committee will review whether you qualify for the free Saudi Oxford Community Membership. You will not be asked to pay anything while it is under review.';
  let code = '';
  if (row.fee_code && row.payment_status === 'waived') code = ar ? 'تم إعفاؤك من رسوم العضوية بموجب الرمز الذي أدخلته. ' : 'Your membership fee has been waived with the code you entered. ';
  else if (row.fee_code && row.amount_gbp > 0) code = ar ? 'طُبّق رمز الخصم الذي أدخلته على رسوم عضويتك. ' : 'The discount code you entered has been applied to your membership fee. ';
  return code + nextStepCore(row, lang);
}
function nextStepCore(row, lang) {
  const ar = lang === 'ar';
  if (row.amount_gbp > 0 && row.payment_status !== 'received') {
    const bank = SETTINGS.bank || {};
    const bankLine = bank.sortCode && bank.accountNumber ? (ar ? `أو بالتحويل البنكي: ${bank.accountName || 'Oxford Saudi Society'}، رمز الفرع ${bank.sortCode}، الحساب ${bank.accountNumber}، المرجع ${row.member_no}.` : `Or by bank transfer: ${bank.accountName || 'Oxford Saudi Society'}, sort code ${bank.sortCode}, account ${bank.accountNumber}, reference ${row.member_no}.`) : (ar ? 'ستصلك تفاصيل الدفع من أمين الصندوق.' : 'The treasurer will send you payment details.');
    const link = (SETTINGS.payLinks || {})[row.tier];
    return ar ? `الخطوة التالية: رسوم العضوية ${feeText(row.amount_gbp, 'ar')} (£${row.amount_gbp}). ${link ? 'ادفع بالبطاقة: ' + link + ' ' : ''}${bankLine} اذكر رقم عضويتك مرجعًا للدفع. تُفعَّل العضوية بعد تأكيد السداد.` : `Next step: the membership fee is £${row.amount_gbp} per year. ${link ? 'Pay by card: ' + link + ' ' : ''}${bankLine} Quote your membership number as the payment reference. Membership becomes active once the payment is confirmed.`;
  }
  if (row.tier === 'saudi' && ['pending', 'rejected'].includes(row.nationality_status)) {
    const other = row.eligibility === 'review' ? (ar ? 'حالة طلبك: بانتظار التحقق من الأهلية؛ ستراجع اللجنة صلتك بأكسفورد. ' : 'Your application is marked “Awaiting eligibility check”: the committee will review your connection to Oxford. ') : '';
    if (!proofUploadEnabled()) return other + (ar ? 'لا يلزمك فعل شيء الآن. سيراسلك أمين سر مجلس إدارة الجمعية لاحقًا لطلب إثبات الجنسية السعودية عند الحاجة. يرجى عدم إرسال أي وثيقة هوية قبل أن يُطلب منك ذلك. تُفعَّل العضوية المجانية بعد تأكيد الأهلية.' : 'Nothing is needed from you now. The committee’s secretary will email you later to ask for proof of Saudi nationality, if it is needed. Please do not send any identity document until you are asked. Free membership becomes active once eligibility is confirmed.');
    return other + (ar ? 'الخطوة التالية: سجّل الدخول عبر الرابط أدناه وارفع من صفحة عضويتك مستندًا واحدًا يثبت الجنسية السعودية (صفحة الصورة في جواز السفر، أو الهوية الوطنية، أو تأكيد الابتعاث من الملحقية الثقافية). يُحذف المستند فور تحقق اللجنة منه. يرجى عدم إرسال وثائق الهوية بالبريد الإلكتروني.' : 'Next step: sign in with the link below and, on your membership page, upload one proof of Saudi nationality (the photo page of your passport, your national ID or your Cultural Bureau scholarship confirmation). It is deleted as soon as the committee has checked it. Please do not send identity documents by email.');
  }
  return ar ? 'لا يلزمك فعل شيء الآن؛ سنراسلك عند البت في طلبك.' : 'Nothing else is needed from you now; we will email you when the committee has decided.';
}

/* ── what step 3 asks for ───────────────────────────────────────────────────────────────────────────────────────
   Only the details that apply to the chosen membership type and status are read; anything else in the request is
   ignored, so a hidden or left-over answer can neither block an application nor be stored with it. */
const DETAIL_COLS = ['uni_status', 'uni_status_other', 'uni_place', 'uni_choice', 'university', 'college', 'sso_username', 'department', 'job_role', 'specialty', 'subject', 'hospital', 'grad_year', 'connection'];
function details(tier, body, fields) {
  const out = Object.fromEntries(DETAIL_COLS.map((c) => [c, null]));
  const status = String(body.status || '');
  if (!(TIER_STATUS[tier] || []).includes(status)) { fields.status = 'required'; return out; }
  out.uni_status = status;
  const need = (key, col, min = 2, max = 120) => { const v = clean(body[key], max); if (v.length < min) fields[key] = 'required'; else out[col] = v; };
  const opt = (key, col, max = 120) => { const v = clean(body[key], max); if (v) out[col] = v; };
  const sso = () => { const v = String(body.sso || '').trim().toLowerCase(); if (v && !SSO_RE.test(v)) fields.sso = 'invalid'; else if (v) out.sso_username = v; };
  const uniChoice = () => { // one of the two Oxford universities, or another institution the applicant names
    const c = String(body.uniChoice || '');
    if (!UNI_CHOICE[c] && c !== 'other') { fields.uniChoice = 'required'; return ''; }
    out.uni_choice = c;
    if (c === 'other') need('org', 'university'); else out.university = UNI_CHOICE[c].en;
    return c;
  };
  if (tier === 'student') { out.uni_choice = 'oxford'; out.university = UNI_CHOICE.oxford.en; need('college', 'college'); sso(); return out; }
  if (tier === 'external') {
    const place = String(body.uniPlace || ''); if (!PLACES[place]) fields.uniPlace = 'required'; else out.uni_place = place;
    need('org', 'university'); opt('subject', 'subject'); return out;
  }
  const kind = STATUS[status].kind;
  if (kind === 'student') { if (uniChoice() === 'oxford') { need('college', 'college'); sso(); } }
  else if (kind === 'alumni') {
    uniChoice();
    const typed = String(body.gradYear == null ? '' : body.gradYear).trim(), y = parseInt(typed, 10);
    if (typed) { if (!/^\d{4}$/.test(typed) || y < 1950 || y > new Date().getUTCFullYear() + 1) fields.gradYear = 'invalid'; else out.grad_year = y; }
  }
  else if (kind === 'academic') { const c = uniChoice(); need('department', 'department'); if (c === 'oxford') sso(); }
  else if (kind === 'employee') { const c = uniChoice(); opt('department', 'department'); if (c === 'oxford') sso(); }
  else if (kind === 'clinical' || kind === 'health') {
    const h = String(body.hospital || '');
    if (!HOSPITALS[h]) fields.hospital = 'required';
    else { out.hospital = h; if (h === 'other') need('org', 'university'); else { const typed = clean(body.org); out.university = h === 'ouh_other' && typed.length >= 2 ? typed : HOSPITALS[h].en; } }
    need('role', 'job_role');
    if (kind === 'clinical') need('specialty', 'specialty'); else opt('specialty', 'specialty');
  }
  else if (kind === 'work') { need('org', 'university'); need('role', 'job_role'); }
  else if (kind === 'other') need('connection', 'connection', 5, 500);
  return out;
}
/* One line for the committee: where the person is and what they do there. */
const detailText = (row) => [row.university, row.college, row.department, row.job_role, row.specialty, row.subject, row.grad_year ? 'graduated ' + row.grad_year : '', row.connection].filter(Boolean).join(' · ');

const MEMBER_COLS = ['name', 'name_ar', 'phone', 'lang', 'consent_privacy_version', 'consent_news', 'tier', 'amount_gbp', 'payment_status', 'nationality_status', 'fee_code', 'whatsapp', 'declared_saudi', 'eligibility'].concat(DETAIL_COLS);
const SAME_COLS = ['tier', 'name'].concat(DETAIL_COLS);
const publicOnly = async (q, row) => Object.assign(await publicView(q, row), { evidence: null, canUploadProof: false }); // the public form never says whether a document is held

/* ── public: apply ──────────────────────────────────────────────── */
export async function apply(q, body, site, sessionEmail) {
  const tier = String(body.tier || '');
  if (tier === 'mailing') return subscribe(q, body, site, sessionEmail);
  if (tier === 'volunteer') return volunteerRegister(q, body, site, sessionEmail);
  const email = normEmail(body.email), name = cleanName(body.name), lang = body.lang === 'ar' ? 'ar' : 'en';
  const fields = {};
  if (!TIERS[tier]) fields.tier = 'required';
  if (name.length < 2) fields.name = 'required';
  if (!validEmail(email)) fields.email = 'invalid';
  const d = TIERS[tier] ? details(tier, body, fields) : {};
  const price = priceOf(tier);
  /* A fee-paying applicant may ask to be assessed for the free Saudi Oxford membership. Nobody has to state a
     nationality: it is asked only of those who choose the free category or ask for this assessment. */
  const assess = price > 0 && body.freeAssess === true;
  if ((tier === 'saudi' || assess) && body.confirm_saudi !== true) fields.confirmSaudi = 'required';
  if (body.consent_privacy !== true) fields.consent = 'required';
  if (Object.keys(fields).length) fail(400, 'validation', { fields });
  const review = assess || (tier === 'saudi' && d.uni_status === 'other_connection'); // eligibility cannot be established automatically
  const rec = Object.assign({
    name, name_ar: cleanName(body.nameAr) || null, phone: phoneOf(body.phone), lang, consent_privacy_version: String(body.privacy_version || SETTINGS.privacyVersion || '2026-11').slice(0, 40), consent_news: body.consent_news === true, tier,
    amount_gbp: price, payment_status: price > 0 ? (assess ? 'on_hold' : 'due') : 'not_required', nationality_status: TIERS[tier].verify ? 'pending' : 'not_required', fee_code: null,
    whatsapp: body.whatsapp === true, declared_saudi: tier === 'saudi' || assess, eligibility: review ? 'review' : 'not_required',
  }, d);
  const existing = (await q.query('SELECT * FROM oss_members WHERE email = $1 FOR UPDATE', [email])).rows[0];
  if (existing && existing.status === 'approved') return { result: 'already_member', kind: 'membership', member: await publicOnly(q, existing) };
  // Discount or exemption code — only for the membership types that carry a fee. Accepted → its percentage comes off the fee; declined → the form stops here.
  let countCode = null;
  if (codeKey(body.feeCode) && price > 0) {
    const held = !!existing && !!existing.fee_code && codeKey(existing.fee_code) === codeKey(body.feeCode) && existing.tier === tier; // already theirs: not checked or counted twice
    if (held) Object.assign(rec, { fee_code: existing.fee_code, amount_gbp: existing.amount_gbp });
    else { const c = await checkCode(q, body.feeCode, true, email); if (!c.ok) fail(400, 'validation', { fields: { feeCode: c.reason } }); countCode = c.code; Object.assign(rec, { fee_code: c.code, amount_gbp: discounted(price, c.percent) }); }
    if (rec.amount_gbp === 0) rec.payment_status = 'waived';
  }
  const useCode = async (no) => { if (!countCode) return; await q.query('UPDATE oss_fee_codes SET used = used + 1 WHERE code = $1', [countCode]); await audit(q, email, 'membership.fee_code_used', 'member:' + no, { code: countCode }); };
  const setSql = MEMBER_COLS.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const vals = () => MEMBER_COLS.map((c) => (rec[c] === undefined ? null : rec[c]));
  const alsoVolunteer = async () => { // a member may offer to volunteer on the same form: that is its own registration
    const areas = pick(body.volunteerAreas, AREAS); if (!areas.length) return;
    await saveVolunteer(q, { email, name, nameAr: rec.name_ar, phone: rec.phone, areas, place: VOL_PLACE[body.volunteerPlace] ? body.volunteerPlace : 'both', whatsapp: rec.whatsapp, lang, privacyVersion: rec.consent_privacy_version }, sessionEmail, site, true);
  };
  if (existing && OPEN.includes(existing.status)) {
    const asksNow = rec.eligibility === 'review', askedBefore = existing.eligibility !== 'not_required';
    const same = SAME_COLS.every((k) => (existing[k] == null ? null : existing[k]) === (rec[k] == null ? null : rec[k])) && (rec.fee_code || existing.fee_code || null) === (existing.fee_code || null) && asksNow === askedBefore;
    if (same) return { result: 'already', kind: 'membership', member: await publicOnly(q, existing) };
    // The form was sent again with different answers (most often a different membership type): the open application
    // takes the new answers and keeps its number and its place in the queue, and the address owner is told by email.
    // Once the address has been confirmed, only its owner (signed in) can change the application this way.
    if (existing.email_verified_at && sessionEmail !== email) return { result: 'already', kind: 'membership', needsSignIn: true, member: await publicOnly(q, existing) };
    const tierChanged = existing.tier !== tier;
    if (!tierChanged) {
      if (!rec.fee_code && existing.fee_code) { Object.assign(rec, { fee_code: existing.fee_code, amount_gbp: existing.amount_gbp }); if (existing.amount_gbp === 0) rec.payment_status = 'waived'; } // an earlier code still stands for the same type
      if (existing.payment_status === 'received') rec.payment_status = 'received';
      // a decision the committee has already made on eligibility stands while the answers it was made on are unchanged
      if (asksNow && ['confirmed', 'not_eligible'].includes(existing.eligibility) && existing.uni_status === rec.uni_status) { rec.eligibility = existing.eligibility; if (rec.payment_status === 'on_hold') rec.payment_status = 'due'; }
    }
    rec.nationality_status = !TIERS[tier].verify ? 'not_required' : (tierChanged || existing.nationality_status === 'not_required' ? 'pending' : existing.nationality_status);
    const upd = (await q.query(`UPDATE oss_members SET ${setSql}, updated_at = now() WHERE email = $1 RETURNING *`, [email].concat(vals()))).rows[0];
    await useCode(upd.member_no);
    if (tierChanged) await deleteEvidence(q, email);
    await alsoVolunteer();
    const pos = await positionOf(q, upd), uu = urlsFor(site, lang);
    const tok = await createPending(q, { kind: 'login', email, lang, ttlMin: 1440, payload: { redirect: (lang === 'ar' ? '/ar' : '') + '/account/' } });
    await enqueue(q, { kind: 'membership_changed', to: email, lang, dedupeKey: `membership_changed:${upd.member_no}:${Date.now()}`,
      vars: Object.assign({ name: upd.name, memberNo: upd.member_no, tierLabel: tierLabel(tier, lang), position: pos, nextStep: nextStepText(upd, lang), link: `${site}/api/verify?t=${tok}`, membershipEmail: SETTINGS.membershipEmail || SETTINGS.email || '', siteUrl: site }, uu) });
    if (tierChanged) await notifyCommittee(q, upd, pos, site, 'Application changed to ' + tierLabel(tier, 'en'));
    else if (upd.eligibility === 'review' && existing.eligibility !== 'review') await notifyCommittee(q, upd, pos, site, 'Eligibility check requested');
    await audit(q, email, 'membership.changed', 'member:' + upd.member_no, tierChanged ? { from: existing.tier, to: tier } : { details: true });
    return { result: 'updated', kind: 'membership', member: await publicOnly(q, upd) };
  }
  let row;
  if (existing) { // re-application after a decline/revocation/expiry keeps the same membership number
    row = (await q.query(`UPDATE oss_members SET ${setSql}, status = 'pending', applied_at = now(), info_request = NULL, info_requested_at = NULL, info_response = NULL, info_response_at = NULL, decided_at = NULL, decided_by = NULL, decision_reason = NULL, valid_until = NULL, source = 'web', updated_at = now()
      WHERE email = $1 RETURNING *`, [email].concat(vals()))).rows[0];
  } else {
    const no = await nextNumber(q);
    row = (await q.query(`INSERT INTO oss_members (email, member_no, status, applied_at, source, ${MEMBER_COLS.join(', ')}) VALUES ($1, $${MEMBER_COLS.length + 2}, 'pending', now(), 'web', ${MEMBER_COLS.map((c, i) => '$' + (i + 2)).join(', ')}) RETURNING *`, [email].concat(vals(), [no]))).rows[0];
  }
  await useCode(row.member_no);
  await alsoVolunteer();
  const position = await positionOf(q, row);
  const u = urlsFor(site, lang);
  const token = await createPending(q, { kind: 'login', email, lang, ttlMin: 1440, payload: { redirect: (lang === 'ar' ? '/ar' : '') + '/account/' } });
  await enqueue(q, { kind: 'membership_received', to: email, lang, dedupeKey: `membership_received:${row.member_no}:${new Date(row.applied_at).getTime()}`,
    vars: Object.assign({ name, memberNo: row.member_no, tierLabel: tierLabel(tier, lang), position, statusText: STAGE_TEXT[stageOf(row)][lang], nextStep: nextStepText(row, lang), link: `${site}/api/verify?t=${token}`, siteUrl: site }, u) });
  await notifyCommittee(q, row, position, site, row.eligibility === 'review' ? 'New membership application — eligibility check needed' : 'New membership application');
  await audit(q, email, existing ? 'membership.reapplied' : 'membership.applied', 'member:' + row.member_no, { tier });
  return { result: 'received', kind: 'membership', member: await publicOnly(q, row) };
}

async function notifyCommittee(q, row, position, site, headline, response) {
  const to = SETTINGS.committeeNotifyEmail; if (!to) return;
  await enqueue(q, { kind: 'membership_committee', to, lang: 'en', dedupeKey: `committee:${headline}:${row.member_no}:${Date.now()}`,
    vars: { headline, memberNo: row.member_no, name: row.name, nameAr: row.name_ar, email: row.email, tierLabel: tierLabel(row.tier, 'en'), college: detailText(row) || '—', sso: row.sso_username || '', feeCode: row.fee_code || '', amountGbp: row.amount_gbp, eligibility: row.eligibility === 'review', uniStatus: uniText(row), position: position == null ? '—' : position, response, deskUrl: urlsFor(site, 'en').deskUrl, siteUrl: site } });
}

/* ── the mailing list: an email address and an explicit opt-in, nothing else ─────────────────────────────────── */
async function addSubscriber(q, { email, name, lang, interests, source }, sessionEmail) {
  const had = (await q.query('SELECT email, verified_at FROM oss_subscribers WHERE email = $1 FOR UPDATE', [email])).rows[0];
  if (!had) { await q.query('INSERT INTO oss_subscribers (email, name, lang, source, interests) VALUES ($1,$2,$3,$4,$5)', [email, name || null, lang, source, interests || []]); return true; }
  // an address that has already been confirmed is only changed by its owner (signed in)
  if (interests && (!had.verified_at || sessionEmail === email)) await q.query(`UPDATE oss_subscribers SET name = COALESCE(NULLIF($2, ''), name), lang = $3, interests = $4 WHERE email = $1`, [email, name || '', lang, interests]);
  return false;
}
export async function subscribe(q, body, site, sessionEmail) {
  const email = normEmail(body.email), lang = body.lang === 'ar' ? 'ar' : 'en', name = cleanName(body.name);
  const fields = {};
  if (!validEmail(email)) fields.email = 'invalid';
  if (body.consent_news !== true) fields.consentNews = 'required'; // the subscription itself is the explicit opt-in
  if (body.consent_privacy !== true) fields.consent = 'required';
  if (Object.keys(fields).length) fail(400, 'validation', { fields });
  await addSubscriber(q, { email, name, lang, interests: pick(body.interests, INTERESTS), source: 'mailing_list' }, sessionEmail);
  const token = await createPending(q, { kind: 'login', email, lang, ttlMin: 1440, payload: { redirect: (lang === 'ar' ? '/ar' : '') + '/account/' } });
  await enqueue(q, { kind: 'mailing_welcome', to: email, lang, dedupeKey: `mailing_welcome:${email}:${new Date().toISOString().slice(0, 10)}`, // at most one a day, however often the form is sent
    vars: Object.assign({ name, link: `${site}/api/verify?t=${token}`, siteUrl: site }, urlsFor(site, lang)) });
  return { result: 'subscribed', kind: 'mailing', email }; // the same answer whether or not the address was already on the list
}

/* ── volunteer registration: its own register, no membership needed ─────────────────────────────────────────── */
const volView = (v) => (v ? { name: v.name, areas: v.areas || [], place: v.place, since: v.created_at } : null);
async function saveVolunteer(q, v, sessionEmail, site, quiet) {
  const had = (await q.query('SELECT * FROM oss_volunteers WHERE email = $1 FOR UPDATE', [v.email])).rows[0];
  if (had && had.verified_at && sessionEmail !== v.email) return { row: had, state: 'locked' }; // only the owner changes a confirmed registration
  const row = (await q.query(`INSERT INTO oss_volunteers (email, name, name_ar, phone, areas, place, whatsapp, lang, consent_privacy_version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, name_ar = EXCLUDED.name_ar, phone = EXCLUDED.phone, areas = EXCLUDED.areas, place = EXCLUDED.place, whatsapp = EXCLUDED.whatsapp, lang = EXCLUDED.lang, consent_privacy_version = EXCLUDED.consent_privacy_version, updated_at = now() RETURNING *`,
    [v.email, v.name, v.nameAr || null, v.phone || null, v.areas, v.place, !!v.whatsapp, v.lang, v.privacyVersion])).rows[0];
  const to = SETTINGS.committeeNotifyEmail;
  if (to) await enqueue(q, { kind: 'volunteer_committee', to, lang: 'en', dedupeKey: `volunteer_committee:${v.email}:${Date.now()}`,
    vars: { headline: had ? 'Volunteer registration updated' : 'New volunteer registration', name: row.name, nameAr: row.name_ar, email: row.email, phone: row.phone || '', areas: row.areas.map((a) => AREA_LABEL[a] || a).join(', '), place: VOL_PLACE[row.place] || row.place, viaMembership: !!quiet, deskUrl: `${site}/admin/events/#membership-volunteers`, siteUrl: site } });
  return { row, state: had ? 'updated' : 'new' };
}
export async function volunteerRegister(q, body, site, sessionEmail) {
  const email = normEmail(body.email), lang = body.lang === 'ar' ? 'ar' : 'en', name = cleanName(body.name);
  const areas = pick(body.areas, AREAS), place = String(body.place || '');
  const fields = {};
  if (name.length < 2) fields.name = 'required';
  if (!validEmail(email)) fields.email = 'invalid';
  if (!areas.length) fields.areas = 'required';
  if (!VOL_PLACE[place]) fields.place = 'required';
  if (body.consent_privacy !== true) fields.consent = 'required';
  if (Object.keys(fields).length) fail(400, 'validation', { fields });
  const saved = await saveVolunteer(q, { email, name, nameAr: cleanName(body.nameAr), phone: phoneOf(body.phone), areas, place, whatsapp: body.whatsapp === true, lang, privacyVersion: String(body.privacy_version || SETTINGS.privacyVersion || '2026-11').slice(0, 40) }, sessionEmail, site, false);
  if (saved.state === 'locked') return { result: 'volunteer_already', kind: 'volunteer', needsSignIn: true, volunteer: null };
  if (body.consent_news === true) await addSubscriber(q, { email, name, lang, source: 'volunteer' }, sessionEmail);
  const token = await createPending(q, { kind: 'login', email, lang, ttlMin: 1440, payload: { redirect: (lang === 'ar' ? '/ar' : '') + '/account/' } });
  await enqueue(q, { kind: 'volunteer_received', to: email, lang, dedupeKey: `volunteer_received:${email}:${Date.now()}`,
    vars: Object.assign({ name, areas: areas.map((a) => (lang === 'ar' ? AREA_LABEL_AR[a] : AREA_LABEL[a])).join(lang === 'ar' ? '، ' : ', '), place: (lang === 'ar' ? VOL_PLACE_AR : VOL_PLACE)[place], link: `${site}/api/verify?t=${token}`, siteUrl: site }, urlsFor(site, lang)) });
  return { result: saved.state === 'updated' ? 'volunteer_updated' : 'volunteer_received', kind: 'volunteer', volunteer: volView(saved.row) };
}
const AREA_LABEL_AR = { events: 'تنظيم الفعاليات', media: 'الإعلام والتصميم', photography: 'التصوير والتغطية الإعلامية', partnerships: 'الرعايات والشراكات', welcome: 'استقبال ودعم الطلبة الجدد', academic: 'البرامج الأكاديمية والمهنية', admin: 'الدعم الإداري والتنظيمي' };
const VOL_PLACE_AR = { oxford: 'في أكسفورد', remote: 'عن بُعد', both: 'كلاهما' };

/* ── the signed-in person: what they hold besides a membership, and how to leave it ─────────────────────────── */
export async function registers(q, email) {
  const sub = (await q.query('SELECT interests, consent_at FROM oss_subscribers WHERE email = $1', [email])).rows[0];
  const news = (await q.query(`SELECT 1 FROM oss_members WHERE email = $1 AND consent_news AND status IN ('pending','info_requested','approved')
    UNION ALL SELECT 1 FROM oss_registrations WHERE email = $1 AND marketing_opt_in AND status IN ('interested','confirmed','checked_in','waitlisted','offered') LIMIT 1`, [email])).rows.length > 0;
  const vol = (await q.query('SELECT * FROM oss_volunteers WHERE email = $1', [email])).rows[0];
  return { mailingList: sub || news ? { subscribed: true, interests: sub ? sub.interests || [] : [], since: sub ? sub.consent_at : null } : null, volunteer: volView(vol) };
}
/* Unsubscribing is complete: the list, and the news opt-ins given with a membership or an event registration. */
export async function unsubscribe(q, email) {
  await q.query('DELETE FROM oss_subscribers WHERE email = $1', [email]);
  await q.query('UPDATE oss_members SET consent_news = false, updated_at = now() WHERE email = $1 AND consent_news', [email]);
  await q.query('UPDATE oss_registrations SET marketing_opt_in = false, updated_at = now() WHERE email = $1 AND marketing_opt_in', [email]);
  return registers(q, email);
}
export async function volunteerWithdraw(q, email) {
  await q.query('DELETE FROM oss_volunteers WHERE email = $1', [email]);
  return registers(q, email);
}
/* Following an emailed link proves the address belongs to the person: note it on everything held under it. */
export async function markVerified(q, email) {
  await q.query('UPDATE oss_members SET email_verified_at = COALESCE(email_verified_at, now()) WHERE email = $1', [email]);
  await q.query('UPDATE oss_subscribers SET verified_at = COALESCE(verified_at, now()) WHERE email = $1', [email]);
  await q.query('UPDATE oss_volunteers SET verified_at = COALESCE(verified_at, now()) WHERE email = $1', [email]);
}
export async function volunteersList(q, staff) {
  requireRole(staff, 'events_admin');
  const rows = (await q.query('SELECT email, name, name_ar, phone, areas, place, whatsapp, lang, verified_at, created_at, updated_at FROM oss_volunteers ORDER BY created_at DESC LIMIT 1000')).rows;
  return { volunteers: rows, areaLabels: AREA_LABEL };
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
const DESK_FIELDS = 'email, member_no, name, name_ar, sso_username, fee_code, university, subject, college, department, job_role, specialty, hospital, uni_place, uni_choice, grad_year, connection, whatsapp, declared_saudi, eligibility, uni_status, uni_status_other, phone, volunteer, heard, lang, consent_news, consent_privacy_version, tier, amount_gbp, payment_status, nationality_status, status, applied_at, email_verified_at, info_request, info_requested_at, info_response, info_response_at, decided_at, decided_by, decision_reason, valid_until, approved_at, approved_by, notes, source, created_at, updated_at';
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
  for (const r of rows) out.push(Object.assign({}, r, { position: await positionOf(q, r), tierLabel: tierLabel(r.tier, 'en'), stage: stageOf(r), statusText: uniText(r), detailText: detailText(r) }));
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
  return { member: Object.assign({}, r, { position: await positionOf(q, r), tierLabel: tierLabel(r.tier, 'en'), stage: stageOf(r), statusText: uniText(r), hospitalName: r.hospital && HOSPITALS[r.hospital] ? HOSPITALS[r.hospital].en : null, evidence: await evidenceMeta(q, r.email) }), history };
}
function mailVars(row, site) { return Object.assign({ name: row.name, memberNo: row.member_no, tierLabel: tierLabel(row.tier, row.lang), membershipEmail: SETTINGS.membershipEmail || SETTINGS.email || '', siteUrl: site }, urlsFor(site, row.lang)); }

export async function decide(q, staff, no, action, body, site) {
  requireRole(staff, 'events_admin');
  const row = await load(q, no);
  const reason = String(body.reason || body.message || '').replace(/\u0000/g, '').trim().slice(0, 2000);
  let upd, kind, extra = {};
  if (action === 'approve') {
    if (!OPEN.includes(row.status) && row.status !== 'revoked' && row.status !== 'declined' && row.status !== 'expired') fail(400, 'bad_state');
    /* Nothing becomes active on trust: a fee-paying membership needs its payment confirmed (or waived by a code), a free
       one needs the committee's confirmation that the person is eligible, and an open eligibility check is settled first. */
    if (OPEN.includes(row.status)) {
      if (row.eligibility === 'review' && row.tier !== 'saudi') fail(400, 'eligibility_review_open');
      if (row.amount_gbp > 0 && !['received', 'waived'].includes(row.payment_status)) fail(400, 'payment_required');
      if (row.tier === 'saudi' && row.nationality_status !== 'verified' && body.eligibilityConfirmed !== true) fail(400, 'eligibility_required');
    }
    let until = null;
    if (body.validUntil) { const d = new Date(body.validUntil); if (isNaN(d)) fail(400, 'bad_date'); until = body.validUntil.slice(0, 10); }
    upd = (await q.query(`UPDATE oss_members SET status='approved', valid_until=$2, approved_at=now(), approved_by=$3, decided_at=now(), decided_by=$3, decision_reason=NULL,
      nationality_status = CASE WHEN tier = 'saudi' OR nationality_status = 'submitted' THEN 'verified' ELSE nationality_status END,
      eligibility = CASE WHEN tier = 'saudi' AND eligibility = 'review' THEN 'confirmed' ELSE eligibility END, updated_at=now() WHERE email=$1 RETURNING *`, [row.email, until, staff.email])).rows[0];
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
  if (body.paymentStatus !== undefined) { if (!['not_required', 'due', 'received', 'waived', 'on_hold'].includes(body.paymentStatus)) fail(400, 'bad_payment_status'); set.payment_status = body.paymentStatus; }
  /* The committee's answer to an eligibility check. Eligible → the application becomes a free Saudi Oxford Community
     Membership and nothing is owed. Not eligible → it carries on in its own category and the fee is asked for now. */
  let eligibilityMail = null;
  if (body.eligibility !== undefined) {
    if (!['confirmed', 'not_eligible'].includes(body.eligibility)) fail(400, 'bad_eligibility');
    if (row.eligibility !== 'review' || !OPEN.includes(row.status)) fail(400, 'no_review_open');
    set.eligibility = body.eligibility;
    if (body.eligibility === 'confirmed' && row.tier !== 'saudi') {
      Object.assign(set, { tier: 'saudi', amount_gbp: 0, payment_status: 'not_required', nationality_status: 'pending', declared_saudi: true });
      const map = { professional: 'oxford_professional', supporter: 'other_connection', other: 'other_connection' };
      if (map[row.uni_status]) set.uni_status = map[row.uni_status];
      if (row.tier === 'external') { set.uni_choice = row.uni_place === 'brookes' ? 'brookes' : 'other'; set.uni_place = null; }
    }
    if (body.eligibility === 'not_eligible' && row.payment_status === 'on_hold') set.payment_status = row.amount_gbp > 0 ? 'due' : 'waived';
    eligibilityMail = body.eligibility;
  }
  if (body.nationalityStatus !== undefined) { if (!['not_required', 'pending', 'submitted', 'verified', 'rejected'].includes(body.nationalityStatus)) fail(400, 'bad_nationality_status'); if (body.nationalityStatus !== row.nationality_status) set.nationality_status = body.nationalityStatus; }
  if (body.notes !== undefined) set.notes = String(body.notes || '').slice(0, 2000);
  if (body.validUntil !== undefined) { set.valid_until = body.validUntil ? String(body.validUntil).slice(0, 10) : null; if (set.valid_until && isNaN(new Date(set.valid_until))) fail(400, 'bad_date'); }
  const keys = Object.keys(set); if (!keys.length) return detail(q, staff, row.member_no);
  await q.query(`UPDATE oss_members SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE email = $1`, [row.email].concat(keys.map((k) => set[k])));
  keys.forEach((k) => { meta[k] = k === 'notes' ? '(updated)' : set[k]; });
  if (eligibilityMail && body.notify !== false) {
    const now = (await q.query('SELECT * FROM oss_members WHERE email = $1', [row.email])).rows[0], ar = now.lang === 'ar', eligible = eligibilityMail === 'confirmed';
    const next = !eligible && now.tier === 'saudi'
      ? (ar ? `يسعدنا انضمامك بالعضوية المنتسبة (${feeText(priceOf('associate'), 'ar')}): أرسل نموذج العضوية مرة أخرى واختر «العضوية المنتسبة»، وسيحتفظ طلبك برقمه.` : `You are welcome to join as an Associate Member (${feeText(priceOf('associate'), 'en')}): send the membership form again and choose Associate Membership. Your application keeps its number.`)
      : nextStepText(now, now.lang);
    await enqueue(q, { kind: 'membership_eligibility', to: row.email, lang: now.lang, dedupeKey: `eligibility:${row.member_no}:${Date.now()}`, vars: Object.assign(mailVars(now, site || SETTINGS.domain || ''), { eligible, nextStep: next }) });
  }
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

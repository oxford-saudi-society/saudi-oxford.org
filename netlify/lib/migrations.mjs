/* Schema for the events system. Every table is prefixed oss_ so it can share a database with anything else.
   Append new migrations; never edit an applied one. Statements are split on ";\n". */
export const MIGRATIONS = [
  {
    id: '0001_events_core',
    sql: `
CREATE TABLE IF NOT EXISTS oss_events (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  version integer NOT NULL DEFAULT 1,
  event_status text NOT NULL DEFAULT 'proposed' CHECK (event_status IN ('proposed','confirmed','postponed','cancelled','completed')),
  registration_mode text NOT NULL DEFAULT 'interest_only' CHECK (registration_mode IN ('none','interest_only','open','waitlist_only','closed')),
  audience text NOT NULL DEFAULT 'public' CHECK (audience IN ('public','members')),
  price_status text NOT NULL DEFAULT 'free' CHECK (price_status IN ('free','tbd','paid')),
  capacity integer CHECK (capacity IS NULL OR capacity >= 0),
  waitlist_enabled boolean NOT NULL DEFAULT true,
  start_utc timestamptz NOT NULL,
  end_utc timestamptz NOT NULL,
  venue_key text,
  booking_opens_at timestamptz,
  booking_closes_at timestamptz,
  published boolean NOT NULL DEFAULT true,
  visibility text NOT NULL DEFAULT 'published_as_proposal',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  seeded_from text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE TABLE IF NOT EXISTS oss_members (
  email text PRIMARY KEY,
  name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revoked','expired')),
  tier text,
  valid_until date,
  approved_at timestamptz,
  approved_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS oss_staff (
  email text PRIMARY KEY,
  name text,
  role text NOT NULL CHECK (role IN ('super_admin','events_admin','checkin_staff')),
  event_ids text[],
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);
CREATE TABLE IF NOT EXISTS oss_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL REFERENCES oss_events(id),
  email text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('interest','booking')),
  status text NOT NULL CHECK (status IN ('interested','confirmed','waitlisted','offered','checked_in','cancelled','expired','declined')),
  lang text NOT NULL DEFAULT 'en',
  member_at_booking boolean NOT NULL DEFAULT false,
  consent_privacy_version text NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  marketing_opt_in boolean NOT NULL DEFAULT false,
  marketing_opt_in_at timestamptz,
  source text NOT NULL DEFAULT 'web',
  waitlist_seq bigserial,
  offered_at timestamptz,
  claim_expires_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  checked_in_at timestamptz,
  event_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS oss_reg_one_active ON oss_registrations (event_id, email) WHERE status IN ('interested','confirmed','waitlisted','offered','checked_in');
CREATE INDEX IF NOT EXISTS oss_reg_event_status ON oss_registrations (event_id, status, created_at);
CREATE INDEX IF NOT EXISTS oss_reg_email ON oss_registrations (email);
CREATE TABLE IF NOT EXISTS oss_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('interest','booking','waitlist','login','claim','cancel')),
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  event_id text REFERENCES oss_events(id),
  registration_id uuid REFERENCES oss_registrations(id),
  lang text NOT NULL DEFAULT 'en',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oss_pending_exp ON oss_pending (expires_at) WHERE used_at IS NULL;
CREATE TABLE IF NOT EXISTS oss_ticket_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES oss_registrations(id),
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text
);
CREATE INDEX IF NOT EXISTS oss_ticket_reg ON oss_ticket_tokens (registration_id);
CREATE TABLE IF NOT EXISTS oss_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL UNIQUE REFERENCES oss_registrations(id),
  event_id text NOT NULL REFERENCES oss_events(id),
  staff_email text NOT NULL,
  method text NOT NULL CHECK (method IN ('qr','manual')),
  checked_in_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS oss_mail_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  to_email text NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  subject text NOT NULL,
  body_text text NOT NULL,
  body_html text,
  attachments jsonb,
  registration_id uuid REFERENCES oss_registrations(id),
  event_id text REFERENCES oss_events(id),
  dedupe_key text UNIQUE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed','dead')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  provider text,
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS oss_mail_due ON oss_mail_outbox (next_attempt_at) WHERE status IN ('queued','failed');
CREATE TABLE IF NOT EXISTS oss_audit (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL,
  resource text,
  meta jsonb
);
CREATE INDEX IF NOT EXISTS oss_audit_at ON oss_audit (at DESC);
CREATE TABLE IF NOT EXISTS oss_rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS oss_idempotency (
  key text PRIMARY KEY,
  status integer NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS oss_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE TABLE IF NOT EXISTS oss_reminders (
  registration_id uuid NOT NULL REFERENCES oss_registrations(id),
  kind text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (registration_id, kind)
);
`,
  },
  {
    id: '0002_membership',
    sql: `
CREATE SEQUENCE IF NOT EXISTS oss_member_seq START 1;
ALTER TABLE oss_members DROP CONSTRAINT IF EXISTS oss_members_status_check;
ALTER TABLE oss_members ADD CONSTRAINT oss_members_status_check CHECK (status IN ('pending','info_requested','approved','declined','revoked','expired'));
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS member_no text UNIQUE;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS name_ar text;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS college text;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS uni_status text;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS volunteer text[];
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS heard text;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'en';
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS consent_privacy_version text;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS consent_news boolean NOT NULL DEFAULT false;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_required';
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS amount_gbp integer NOT NULL DEFAULT 0;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS nationality_status text NOT NULL DEFAULT 'not_required';
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS info_request text;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS info_requested_at timestamptz;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS info_response text;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS info_response_at timestamptz;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS decided_by text;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS decision_reason text;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web';
UPDATE oss_members SET applied_at = created_at WHERE applied_at IS NULL;
UPDATE oss_members SET member_no = 'OSS-' || to_char(created_at AT TIME ZONE 'Europe/London', 'YYYY') || '-' || lpad(n::text, greatest(4, length(n::text)), '0') FROM (SELECT email AS e, nextval('oss_member_seq') AS n FROM oss_members WHERE member_no IS NULL ORDER BY created_at) x WHERE oss_members.email = x.e;
CREATE INDEX IF NOT EXISTS oss_members_queue ON oss_members (status, applied_at)
`,
  },
  {
    id: '0003_status_other',
    sql: `
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS uni_status_other text;
`,
  },
  {
    /* Privacy notice 2026-11-09: proof of nationality is uploaded (never emailed), held apart from the membership
       record and deleted the moment the check is recorded; dietary/access notes live with the registration and are
       cleared 7 days after the event; anonymous totals survive the deletion of an event's registrations. */
    id: '0004_privacy_retention',
    sql: `
CREATE TABLE IF NOT EXISTS oss_member_evidence (
  email text PRIMARY KEY REFERENCES oss_members(email) ON DELETE CASCADE,
  mime text NOT NULL,
  bytes integer NOT NULL,
  data text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  viewed_by text
);
ALTER TABLE oss_registrations ADD COLUMN IF NOT EXISTS requirements text;
ALTER TABLE oss_events ADD COLUMN IF NOT EXISTS final_counts jsonb;
ALTER TABLE oss_members ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS oss_subscribers (
  email text PRIMARY KEY,
  name text,
  lang text NOT NULL DEFAULT 'en',
  consent_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'event'
);
`,
  },
];

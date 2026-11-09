# Membership & events system — how it works and how to run it

## Membership

* Applying on `/join/` saves the application in the society's database and immediately gives the applicant a **permanent membership number** (`OSS-<year>-<sequence>`, e.g. `OSS-2026-0007`) and their **place in the review queue**. They get a confirmation email whose link signs them in and confirms their email address.
* The number is theirs for good: it is the payment reference for paid tiers, it is quoted on members-only bookings, and a re-application after a decline keeps it. It becomes an **active** membership only when the committee approves.
* Committee desk → **Membership**: the review queue in order (place, number, name, type, college, email confirmed, payment, nationality). Open an application to **approve** (optional "valid until" date), **request more information** (templates for proof of nationality, payment, university status — the applicant answers from *My account* and keeps their place), **decline** (with reason; they may re-apply), or later **end** a membership (members-only access stops at once). Payment and nationality checks and internal notes are recorded per applicant; every action is in the history and the audit log. Applicants are emailed at each step (can be switched off per action).
* New applications and applicants' answers are announced to the committee inbox in `settings → committeeNotifyEmail`.
* Proof of nationality is never uploaded to the site: the committee requests it by email, checks it, deletes it, and ticks "verified".

# Events

The events section is two things working together:

| Layer | Where | Who edits it |
|---|---|---|
| **Programme content** — titles (EN/AR), descriptions, agenda, artwork, proposed date/venue | `src/content/events/*.json`, edited in the desk at `/admin/` (Decap) | Committee (content) |
| **Operations** — confirmed/proposed, registration open/closed, capacity, waitlist, bookings, tickets, check-in, emails | PostgreSQL + `/api/*` (Netlify Functions), run from the **committee desk** at `/admin/events/` | Committee (staff roles) |

Static pages (`/events/`, `/events/<slug>/`, Arabic under `/ar/`) are built from the content and then *hydrated* in the browser from `/api/events`, so the live status, dates and the right button always show. Nothing on the page can claim a seat — every seat decision comes from the server inside a database transaction.

## Rules the system enforces

* Dates and venues are **proposed until the committee confirms them** in the desk. While proposed, the only action is **Register interest**, which is explicitly *not a booking*; no ticket exists.
* Registration can only be opened (`open` / `waitlist only`) on a **confirmed** event. Tickets are issued only for confirmed bookings.
* A seat is assigned **when the person clicks the link in the confirmation email** (or immediately if they are already signed in). Nothing is held before that.
* One active booking or waitlist entry per event and email. Duplicate requests return the existing status.
* Capacity is enforced with a row lock on the event; 20 simultaneous requests for the last seat produce exactly one confirmed booking (tested).
* **Members only** events check the **Members** register in the desk against the signed-in email — never a tick-box on the form.
* Waitlist is first come, first served. A freed seat is *offered* to the next person by email for 24 hours (`WAITLIST_CLAIM_HOURS`); unclaimed offers pass on automatically.
* QR tickets carry only a random code. The database stores a hash of it; the ticket page shows the attendee's first name only. Opening a ticket from *My registrations* rotates the code (old links stop working).
* Check-in is staff-only, scoped per event, single-use; a second scan says *Already checked in*.
* Postponing, cancelling or moving a confirmed event asks for a **preview → confirm**, bumps the calendar version (ICS `SEQUENCE`) and queues notices to everyone registered. Cancelling revokes tickets.
* Emails go through a durable **outbox**: a message is marked *sent* only after the provider accepted it; failures retry with back-off (2 min → 12 h) and then dead-letter, visible in **Email queue** with a *Retry* button.
* Everything staff do is in the **Audit log** (no attendee emails in the metadata). CSV exports are logged and formula-safe.
* Privacy: the form asks for name and email only, records the privacy-notice version accepted and keeps the *news* opt-in separate and unticked by default. A booking can carry an optional dietary/access note. Deletion follows the published privacy notice automatically (see *Data retention* below).

## Roles

| Role | Can |
|---|---|
| `super_admin` | everything, including Staff |
| `events_admin` | event settings, bookings, cancel/resend, notices, email queue, members, audit, CSV |
| `checkin_staff` | check-in (QR, code or name search) for the events they are limited to; sees masked emails |

Staff sign in at `/admin/events/` with an **email link** (no passwords). The first super admin(s) are the addresses in `ADMIN_BOOTSTRAP_EMAILS`; after that, add people in **Staff**.

## A normal event, step by step

1. Content desk (`/admin/`): write/adjust the event; it is published as *proposed*. People register interest.
2. Venue and date agreed → committee desk → **Manage** → status **Confirmed**, set **capacity**, **waitlist**, optional booking window → **Save**. Changing the date/venue of a confirmed event sends a change notice (you see a preview first).
3. Set **Registration mode = Open** → the public button becomes *Book now*. (Interested people are *not* auto-booked; tell them with **Notices → Registered interest**.)
4. Bookings arrive; **Bookings** tab shows the roster; **Download CSV** for the door list if needed.
5. On the day: **Check-in** → choose the event → *Start camera* (phone) or paste codes / search names. The tally updates live.
6. Afterwards the event becomes *completed* automatically. Dietary/access notes are cleared 7 days after the event and every registration is deleted 30 days after it (anonymous totals stay on the event). Export the attendee CSV within those 30 days if the committee needs it.

## Configuration (Netlify → Site configuration → Environment variables)

See `.env.example`. Required for the API to work at all: `DATABASE_URL` (or Netlify DB's `NETLIFY_DATABASE_URL`), `AUTH_SECRET`, `ADMIN_BOOTSTRAP_EMAILS`. Required for emails: either `GMAIL_APP_PASSWORD` (the society Gmail sends; app password from myaccount.google.com/apppasswords, needs 2-Step Verification; ~500/day; sender is the Gmail address) or `RESEND_API_KEY`, with the sending domain (oxsss.org) verified in Resend. The sender defaults to the site's public address (settings.email) and replies go to the same address; `MAIL_FROM` / `MAIL_REPLY_TO` override them. While no provider is configured, mail waits in the outbox untouched and goes out on the first run after the key is added. Until these are set, `/api/*` answers `503 database_not_configured` and the public pages show "Registration is temporarily unavailable".

**Database**: Netlify DB (Neon) via *Extensions → Neon* or `netlify db init`; or any PostgreSQL 14+. Tables are created automatically on first request (`oss_*`); the 11 events are seeded once from the content and never reset by a deploy. Back up with `pg_dump` (Neon also keeps point-in-time history); restore into an empty database and point `DATABASE_URL` at it.

**Scheduled job** (`netlify/functions/jobs.mjs`, every 10 minutes): sends queued mail, expires waitlist offers, sends 7-day and 1-day reminders for confirmed events, marks finished events completed, and applies the retention periods.

**Data retention** (always on; the same periods as the privacy notice — change both together):

| What | When it is deleted |
|---|---|
| Dietary / accessibility notes | 7 days after the event ends |
| Event registrations, tickets, check-ins, their emails and audit lines | 30 days after the event ends (totals by status are kept on the event; people who asked for news stay on the news list) |
| Membership records | 12 months after the membership ends: declined/ended by the committee, or the *valid until* date has passed (the record is first marked *expired*). Applications left unfinished for 12 months go too |
| Proof-of-nationality documents | The moment *Verified* or *Not accepted* is recorded, or the application is decided; never kept beyond 30 days unchecked |
| Delivered email in the outbox | 30 days |

Set `RETENTION_PAUSED=true` in Netlify to stop all deletion (for example during a legal claim); `oss_members.legal_hold = true` protects one record. Financial transaction records are not held by the website — the treasurer keeps them (six years where the law requires).

**Proof of nationality**: for now the committee's secretary asks for it by email when it is needed (from an @oxsss.org address), checks it, records *Verified* under *Membership → the applicant → Checks*, and deletes the email and its attachment straight away — that deletion is manual. The secure upload on the member's own page is built but switched off (`nationalityUpload: false` in `src/content/settings.json`); switching it on also needs the wording on the join page, FAQ and privacy notice changed back. While it is off, nothing can be uploaded and the scheduled job removes any document left from when it was on.

**Fee codes** (*Membership → Fee codes*): create a code — optionally with a note of who it is for, a number of uses and an expiry date — and give it to someone whose membership fee you want to waive. On the join form the code field appears for the fee-paying types only; *Check code* answers at once (accepted or declined) and the server checks again when the form is sent. An accepted code sets the fee to zero and the payment to *Waived*; the application still goes through the usual review, and the member's page in the desk shows which code was used. A code can be switched off at any time. Codes are kept in `oss_fee_codes`.

**Sending the form again**: if someone with an open application sends the join form again with different answers (usually a different membership type), the application is updated, keeps its number and place, and they are emailed. Once they have confirmed their address, only they (signed in) can change it.

**News subscribers**: *Membership → News subscribers (CSV)* lists everyone who ticked the news box.

**Build-time truth**: set `SITE_API_URL=https://oxsss.org` so each build reads the live event state and the static HTML matches the desk without waiting for JavaScript. Optional `NETLIFY_BUILD_HOOK` enables the *Publish site* button.

## Running locally / tests

```bash
npm install
npm run build && npm run check                 # static site + 2,500 structural checks
TEST_DATABASE_URL=postgres://user@host/postgres npm test   # 16 integration tests on a real PostgreSQL (PGlite fallback without the variable)
qa/dev-reset.sh                                # fresh DB + dev server on :8788 (emails land in /tmp/oss-mail.jsonl)
npm run e2e                                    # Playwright: static pages (186 checks) + full browser flow (29 checks)
```

## Not in this build (deliberately)

* Payments — the annual dinner stays *price to be announced*; `priceStatus=paid` is refused until a provider is approved.
* Dietary/accessibility fields — collected by email on request, not in the form (sensitive data).
* A content-security-policy header (fonts, Canny and the Cloudflare beacon need listing first).

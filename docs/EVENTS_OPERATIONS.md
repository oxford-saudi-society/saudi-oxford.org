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
* Privacy: the form asks for name and email only, records the privacy-notice version accepted and keeps the *news* opt-in separate and unticked by default. Optional retention job anonymises attendee data `RETENTION_DAYS` after each event (`RETENTION_ENABLED=true`).

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
6. Afterwards the event becomes *completed* automatically; retention (if enabled) anonymises data later.

## Configuration (Netlify → Site configuration → Environment variables)

See `.env.example`. Required for the API to work at all: `DATABASE_URL` (or Netlify DB's `NETLIFY_DATABASE_URL`), `AUTH_SECRET`, `ADMIN_BOOTSTRAP_EMAILS`. Required for emails: either `GMAIL_APP_PASSWORD` (the society Gmail sends; app password from myaccount.google.com/apppasswords, needs 2-Step Verification; ~500/day; sender is the Gmail address) or `RESEND_API_KEY`, with the sending domain (ousss.org) verified in Resend. The sender defaults to the site's public address (settings.email) and replies go to settings.committeeNotifyEmail; `MAIL_FROM` / `MAIL_REPLY_TO` override them. While no provider is configured, mail waits in the outbox untouched and goes out on the first run after the key is added. Until these are set, `/api/*` answers `503 database_not_configured` and the public pages show "Registration is temporarily unavailable".

**Database**: Netlify DB (Neon) via *Extensions → Neon* or `netlify db init`; or any PostgreSQL 14+. Tables are created automatically on first request (`oss_*`); the 11 events are seeded once from the content and never reset by a deploy. Back up with `pg_dump` (Neon also keeps point-in-time history); restore into an empty database and point `DATABASE_URL` at it.

**Scheduled job** (`netlify/functions/jobs.mjs`, every 10 minutes): sends queued mail, expires waitlist offers, sends 7-day and 1-day reminders for confirmed events, marks finished events completed, applies retention.

**Build-time truth**: set `SITE_API_URL=https://ousss.org` so each build reads the live event state and the static HTML matches the desk without waiting for JavaScript. Optional `NETLIFY_BUILD_HOOK` enables the *Publish site* button.

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

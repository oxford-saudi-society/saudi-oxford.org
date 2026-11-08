# saudi-oxford.org — the Oxford Saudi Society website

This folder **is** the website. Every page, name, event and setting lives here, in plain files, with a full history of changes. Nothing about the site depends on any one person or any one computer.

- Live site: https://saudi-oxford.org (English) · https://saudi-oxford.org/ar/ (Arabic)
- Committee desk (editing): https://saudi-oxford.org/admin/
- Hosting: Netlify · Content storage: GitHub · Email & DNS: Cloudflare · Payments: Stripe

## How it works, in one paragraph

The site is a *static* site: a small program (`build/build.js`) reads the content files in `src/content/` and the page template in `src/template.html`, and writes finished web pages into `dist/` — one page per section, in English and in Arabic. Netlify runs that program automatically every time something in this repository changes, and serves the result worldwide with HTTPS. The committee never touches the program; they edit content through the desk at `/admin/`, which saves into `src/content/` behind the scenes, which triggers a rebuild, which updates the live site about a minute later.

## What lives where

```
src/content/settings.json      fees, payment links, bank details, email, social accounts
src/content/events/*.json      one file per event
src/content/people/*.json      one file per community-directory profile (photos in src/assets/people/)
src/content/committees/*.json  one file per committee year (2025-26.json, 2024-25.json …); "current": true marks the sitting committee
src/content/roles.json         the list of committee roles (rarely changes)
src/template.html              the page design and all fixed wording (English + Arabic side by side)
src/css/site.css               the look (dark liquid-glass design, brand colours and type)
src/js/site.js                 the join form, the directory filter, the menu
src/assets/                    seal, share image, favicons, directory photos
admin/                         the committee desk (Decap CMS) and its configuration
build/build.js                 turns src/ into dist/
build/check.js                 checks the built site (links, translations, forms) — run before launch changes
netlify.toml                   tells Netlify how to build
```

## Editing content (committee)

Go to **https://saudi-oxford.org/admin/** and sign in with GitHub. You see four sections:

| Section | What it changes | Typical job |
|---|---|---|
| **Settings** | fees, Stripe links, bank details, society email, social handles, founded year, privacy wording | "Fees are confirmed" → tick *Fees confirmed* and the [brackets] disappear |
| **Events** | the Events page and the "Next event" box on the home page | each term: add the programme, set *Order*, untick *Published* when it's over |
| **Community directory** | public profiles | add a person **only with their consent** (tick the consent box); upload a square photo |
| **Committees** | the About page grid and the Committees history page | each new year: *New committee year* → term `2027–28` → tick *This is the current committee* → add names |

Click **Publish** in the desk; the live site updates within about a minute. Everything is written in both languages — fill in the Arabic fields too.

To give a new committee member access: add them as a collaborator on the GitHub repository (Settings → Collaborators) with *Write* access. Remove them when they leave the committee.

## One-time setup (done once, kept for the record)

The step-by-step runbook with screenshots-level detail lives with the committee ("saudi-oxford.org — go-live runbook"). In short:

1. **GitHub** — organisation `oxford-saudi-society`, **public** repository `saudi-oxford.org` (public keeps Netlify from counting every editor as a paid seat; nothing secret is in here). Committee members get *Write* access — that is what lets them use the desk. `admin/config.yml` line 5 must read `repo: oxford-saudi-society/saudi-oxford.org`.
2. **Netlify** — *Add new project → Import an existing project → GitHub → this repository*; build settings come from `netlify.toml`. Use the **Personal plan ($9/month)**: the Free plan is capped at 300 credits a month and every publish from the desk costs 15, after which the whole site goes offline until the next month. Then:
   - *Project configuration → Forms → Enable form detection*, trigger one deploy, then *Notifications → Form submission notifications → Email* → the society address.
   - *Domain management → Add a domain → saudi-oxford.org* (www is added automatically); make the bare domain primary; HTTPS is issued automatically once DNS resolves.
   - *Access & security → OAuth → Authentication providers → Install provider → GitHub*, using a GitHub OAuth App created **under the organisation** (Settings → Developer settings → OAuth Apps; homepage `https://saudi-oxford.org`, callback `https://api.netlify.com/auth/done`). This is what lets the desk sign people in.
3. **Cloudflare** (DNS, email, analytics; free) — add the domain, point GoDaddy's nameservers at Cloudflare, then records, all *DNS only* (grey cloud): `CNAME @ → apex-loadbalancer.netlify.com` (or `A @ → 75.2.60.5`), `CNAME www → saudi-oxford.netlify.app`. *Email → Email Routing*: `hello@`, `president@`, `treasurer@`, `secretary@`, `ideas@` → the committee Gmail; in Gmail, *Settings → Accounts → Send mail as* with `smtp.gmail.com`, port 587, the Gmail address and an App Password lets replies go out from those addresses. Set the SPF TXT to `v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all` and add `_dmarc` `v=DMARC1; p=none; rua=mailto:hello@saudi-oxford.org`. *Web Analytics → Add a site* gives a token; paste it in the desk under *Settings → Visitor analytics* and the cookie-free counter is added to every page.
4. **Stripe** — account in the society's name; two Payment Links (student, associate) with a required custom field "Application reference"; paste them into *Settings* in the desk.
5. **GoDaddy** — the domain registration. Keep auto-renew on and the card current; move the domain to the society account so it survives committee changes.

## The ideas board (Canny)

`/ideas/` embeds a Canny board: members post ideas, vote and comment; the committee sets a status on each (under review, planned, in progress, done) and replies. Until the board is connected the page shows a "opens soon" card.

1. Create the Canny account at canny.io in the society's name (committee Gmail), subdomain e.g. `oxford-saudi`. Create one board called **Ideas**, public.
2. Canny → *Settings → Widget* (or *Install*) shows the **board token**. Paste it in the desk under *Settings → Ideas board*, together with the hosted link (`https://oxford-saudi.canny.io/ideas`). Publishing the settings rebuilds the site and the board appears.
3. Add the committee as Canny admins (*Settings → Team*) so they can set statuses and reply.

Costs, plainly: Canny's **Free plan stops at 25 tracked users** — anyone who posts, votes or comments counts, so a society of 100+ members will outgrow it in a term; the next plan is around £60–80 a month (check canny.io/pricing). Two ways to handle that: (a) start on Free and watch the count, or (b) use a board from a provider whose free plan has no user cap and paste its embeddable link into *Other provider embed link* — the page works the same way. The Canny token wins if both are set.

## The join form

The form on `/join/` is a Netlify Form named `join`. Submissions appear under *Forms* in Netlify (export CSV) and are emailed to the address set in step 2. Each application carries a reference like `OSS-8MGVA0O`; the applicant quotes it when paying by bank transfer, and the treasurer matches payments against it. Saudi students pay nothing; the committee emails them for proof of nationality, checks it, and deletes the image.

If Netlify cannot accept a submission (outage, blocked network), the page falls back to a pre-filled email to the society address, so no application is lost.

## Running the build on a computer (developers)

```
npm install
npm run build     # writes dist/
npm run check     # verifies links, translations, forms
```
Open `dist/index.html` through a local web server (for example `python3 -m http.server -d dist 8080`).

## Handover checklist (every committee change)

- [ ] GitHub: new committee added as collaborators, old removed
- [ ] Netlify, Cloudflare, Stripe, GoDaddy: logins in the society password manager, 2-step verification on, recovery email = society address
- [ ] Domain auto-renew on, card valid
- [ ] *Committees* in the desk: new year added and marked current
- [ ] Privacy notice still true (what we collect, retention, who sees it)

## Things to finish before launch

Placeholders show on the site with a dotted gold underline until filled in the desk: fees (tick *confirmed*), society email, Stripe links, bank details, committee names, this term's events, Instagram handle, privacy retention period, and the ideas board token (see above). Review the privacy notice and terms once with someone who reads such things for a living.

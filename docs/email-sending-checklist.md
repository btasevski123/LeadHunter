# Email sending — go-live checklist

LeadHunter can already **generate** outreach emails (EN/MK) and **send** them over SMTP from the platform. This doc is what to do when your real company mailbox exists (e.g. `info@yourcompany.com`) and you want production-ready sending.

Do **not** commit real SMTP passwords to git. Keep them in `.env` only (already gitignored).

---

## How email drafts are generated

Outreach emails are filled from **fixed MK/EN templates** using facts from the website analyzer:

- 1 positive observation (if any)
- 1 primary issue (mobile / HTTPS / design / contact / etc.)
- Soft CTA in founder voice

No Gemini/OpenAI call is made for outreach drafts. Shape matches:

```
Здраво,

Го најдов {{company}} додека разгледував локални бизниси и го погледнав вашиот веб-сајт.

Забележав дека {{positive}}.

Имаше една работа која мислам дека би можела да се подобри:

{{issue}}

Сакав само да ви го споделам ова бидејќи веб-сајтот често е првата точка каде што некој се запознава со компанијата.

Доколку сакате, можам да ви испратам неколку конкретни предлози без никаква обврска.

Поздрав,
```

Full templates: `docs/email-templates.md`.

`generationSource` is always `"template"`.

---

## What is already implemented

| Piece | Status |
|-------|--------|
| Generate draft (English / Macedonian) via templates | Done |
| Analyzer facts → template slots | Done |
| SMTP send via Nodemailer (`POST /api/emails/:id/send`) | Done |
| Recipient from company email / contact / override | Done |
| Mark outreach `CONTACTED` + note after send | Done |
| Settings page shows SMTP status | Done |

Code: `apps/api/src/emails/`, `packages/audit-engine/src/email-generator.ts`, `packages/audit-engine/src/outreach-analysis.ts`, company detail + Settings UI.

---

## When you have the real company email

### 1. Create / confirm the mailbox

- Prefer a dedicated outreach address: `info@…`, `hello@…`, or `sales@…`
- If the domain uses **Google Workspace**: enable 2FA, then create an [App Password](https://myaccount.google.com/apppasswords) (do not use the normal login password)
- If the domain uses **cPanel / Outlook / Zoho / other**: get SMTP host, port, username, password from the host

### 2. Fill `.env` and restart the API

```bash
SMTP_HOST=smtp.gmail.com          # or your provider’s host
SMTP_PORT=587
SMTP_USER=info@yourcompany.com
SMTP_PASS=your-app-or-smtp-password
SMTP_FROM=info@yourcompany.com
SMTP_FROM_NAME=Your Company
SENDER_COMPANY=Your Company
```

For Google Workspace / Gmail custom domains, `SMTP_HOST=smtp.gmail.com` and port `587` are typical.  
For other hosts, set `SMTP_SECURE=true` if they require port `465`.

Restart `npm run dev` (or the API process) so env vars reload.

### 3. Smoke test before real clients

1. Open **Settings** → confirm “SMTP configured”
2. Open a test company that has **your personal email** as recipient (or use Send-to override)
3. Generate email (MK or EN) → **Send email**
4. Confirm delivery, From address, Reply-To, and spam folder behaviour

### 4. Domain reputation (before volume)

Complete these with your DNS host so mail does not land in spam:

- [ ] **SPF** — allow your SMTP provider to send for the domain
- [ ] **DKIM** — enable signing in Google Workspace / provider
- [ ] **DMARC** — start with `p=none`, then tighten once clean

Without these, even correct SMTP often fails for cold outreach.

---

## Still to implement for “full” email product

Use this list when you are ready to go beyond one-off Send:

### Product / UX

- [ ] Edit subject/body in the UI before send (today: regenerate or send as-is)
- [ ] FOLLOW_UP kind in the UI (API already supports it)
- [ ] Pick recipient from discovered contacts (dropdown), not only override field
- [ ] Confirm dialog: “Send to X as Y?”
- [ ] Sent / failed history page (filter by date, company, status)
- [ ] Suppress list: never email addresses that bounced or opted out

### Deliverability & compliance

- [ ] Bounce / soft-fail handling (parse provider webhook or IMAP)
- [ ] Unsubscribe / opt-out link and honour list (GDPR / ePrivacy for cold email)
- [ ] Daily send cap (e.g. 20–50/day) and per-domain throttling
- [ ] Warm-up plan for a new domain (start low volume)

### Automation (later)

- [ ] Queue sends (BullMQ) instead of sync HTTP request
- [ ] Schedule follow-up N days after CONTACTED if no reply
- [ ] Daily digest of “best leads to email today”
- [ ] Optional Gmail OAuth (send as user without App Password) if SMTP is blocked

### Ops

- [ ] Store SMTP secret in a secrets manager for production (not only local `.env`)
- [ ] Alert on send failure rate
- [ ] Document provider-specific setup (Workspace vs cPanel) in `docs/installation.md`

---

## Out of scope until you decide otherwise

- Bulk blast campaigns / marketing newsletters  
- Buying email lists  
- Scraping personal (non-business) inboxes  

LeadHunter is for **B2B outreach** to business contacts discovered or entered on the company record.

---

## Quick reference — API

```http
POST /api/emails/generate
{ "companyId": "...", "kind": "OUTREACH", "language": "mk" }

POST /api/emails/:templateId/send
{ "toEmail": "optional-override@client.com" }

GET /api/emails/status
```

---

## When you are ready

1. Real mailbox + App Password / SMTP credentials in `.env`  
2. DNS: SPF + DKIM (+ DMARC)  
3. Smoke test to yourself  
4. Then pick items from **Still to implement** (edit-before-send and send caps are usually first)

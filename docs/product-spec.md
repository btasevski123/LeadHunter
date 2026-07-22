# LeadHunter MK — Product Specification

## 1. Vision

LeadHunter MK is a lead-generation and business-intelligence platform for freelancers and agencies in North Macedonia. It discovers companies from public sources, audits their digital presence, scores opportunity quality, and provides a lightweight CRM for outreach.

**Primary user:** Solo freelancers / small agencies selling web development, redesign, SEO, and digital transformation services.

**Core value:** Continuously surface high-intent prospects (no website, outdated sites, poor mobile/SEO) and manage outreach in one place.

---

## 2. Product Name & Branding

| Item | Value |
|------|-------|
| Product name | LeadHunter MK |
| Tagline | Find businesses that need better websites |
| Market | North Macedonia |
| Language (UI) | English (primary), Macedonian-ready i18n hooks |

---

## 3. Problem Statement

Manual lead hunting in MK is slow: browsing directories, checking websites one-by-one, guessing who needs help, and tracking outreach in spreadsheets. LeadHunter MK automates discovery → audit → scoring → outreach tracking.

---

## 4. User Personas

### Persona A — Freelance Web Developer
- Needs a steady pipeline of local businesses with weak websites
- Wants scored leads with audit evidence (screenshots, issues)
- Uses CRM to track emails and follow-ups

### Persona B — Small Agency Owner
- Needs volume + filtering by industry/city
- Exports lead packs for sales team
- Configures scrapers and rate limits

---

## 5. Core Workflows

### 5.1 Discovery Pipeline
1. Providers scrape public directories (by industry/city)
2. Normalize company records
3. Deduplicate by name+city+website/phone/email
4. Persist to PostgreSQL

### 5.2 Enrichment Pipeline
1. Website discovery (if missing)
2. Contact discovery (email, phone, social)
3. Website audit (Lighthouse + heuristic checks)
4. Screenshots (desktop + mobile)
5. Lead scoring (0–100 with reasons)
6. Optional AI audit + outreach email generation

### 5.3 Operator Workflow
1. Review dashboard KPIs
2. Filter/sort companies or open Top Leads
3. Inspect company detail (audit, screenshots, contacts)
4. Move outreach status (Kanban or detail page)
5. Export CSV/Excel/PDF for offline use

---

## 6. Feature Requirements

### 6.1 Must Have (MVP → Production v1)
- Provider-based scraper with rate limiting, retries, logging
- Company CRUD + search/filter/pagination API
- Website audit engine (SSL, mobile, Lighthouse, content signals)
- Lead scoring with explanation JSON
- Screenshot capture (desktop + mobile)
- Contact discovery with confidence scores
- Dashboard home with KPIs + charts
- Companies table with filters
- Company detail page
- Top Leads page
- Outreach Kanban CRM
- Email template generation (AI-optional, rule-based fallback)
- Export CSV / Excel / PDF
- Settings for scraper/audit/API keys/rate limits
- CLI: scrape, audit, screenshots, discover-contacts, export, full-scan
- Docker Compose (postgres, api, web)

### 6.2 Explicit Non-Goals (v1)
- Multi-tenant SaaS billing
- Automated email sending (SMTP campaigns)
- Real-time collaborative editing
- Mobile native apps
- Legal entity registry scraping that violates ToS (providers must respect robots/rate limits)

---

## 7. Functional Modules

| Module | Responsibility |
|--------|----------------|
| Scraper Engine | Provider interface, orchestration, throttle, dedupe |
| Website Discovery | Find website / social when missing |
| Contact Discovery | Extract emails/phones/social with confidence |
| Audit Engine | Lighthouse + heuristic technical/content checks |
| Screenshot Engine | Playwright desktop/mobile captures |
| Lead Scoring | Deterministic 0–100 score + reasons |
| AI Audit | OpenAI-compatible recommendations (optional key) |
| Email Generator | Personalized outreach drafts |
| Export Engine | CSV, XLSX, PDF report packs |
| CRM | Outreach status, notes, follow-ups |
| Dashboard | Visualization + CRUD UX |
| Settings | Runtime config persisted in DB |

---

## 8. Lead Scoring Philosophy

| Score Band | Meaning |
|------------|---------|
| 90–100 | No website or inaccessible — highest opportunity |
| 80–89 | Very outdated / broken mobile / critical SSL issues |
| 70–79 | Poor SEO + weak mobile or major missing features |
| 60–69 | Missing important business functionality |
| 40–59 | Mixed quality — selective opportunity |
| 0–39 | Modern, healthy site — low priority |

Scoring must be **deterministic and explainable**. AI may enrich narrative but must not replace the numeric score.

---

## 9. Data Ethics & Compliance

- Scrape only publicly accessible directory pages
- Respect rate limits and polite delays
- Store only business contact data intended for B2B outreach
- Allow deletion of company records
- Do not store payment card data
- API keys encrypted at rest via env-backed secrets (never commit)

---

## 10. Success Metrics

- Companies discovered per week
- % with email found
- % audited
- Average lead score of “Top Leads”
- Outreach conversion (Contacted → Replied → Won)
- Time from scrape → audited lead < 24h for batch jobs

---

## 11. Acceptance Criteria (v1)

1. `docker compose up` starts postgres, api, web
2. `npm run full-scan` runs end-to-end pipeline against configured providers
3. Dashboard shows live KPIs from DB
4. Company detail shows audit, score reasons, screenshots paths, outreach
5. Outreach Kanban updates status via drag-and-drop
6. Export produces valid CSV, XLSX, and PDF
7. Settings page persists configuration
8. Documentation complete under `/docs`

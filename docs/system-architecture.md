# LeadHunter MK — System Architecture

## 1. Overview

LeadHunter MK is a Turborepo monorepo with a NestJS API, Next.js App Router dashboard, PostgreSQL via Prisma, and domain packages for scraping, auditing, scoring, and shared types.

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Operator (Browser)                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS
┌───────────────────────────────▼─────────────────────────────────┐
│  apps/web  (Next.js App Router + React Query + Zustand)          │
│  Dashboard · Companies · Top Leads · Outreach · Settings         │
└───────────────────────────────┬─────────────────────────────────┘
                                │ REST / JSON
┌───────────────────────────────▼─────────────────────────────────┐
│  apps/api  (NestJS)                                              │
│  Companies · Audits · Outreach · Exports · Jobs · Settings       │
│  CLI entrypoints (scrape / audit / screenshots / full-scan)      │
└───────┬───────────────┬───────────────┬───────────────┬─────────┘
        │               │               │               │
        ▼               ▼               ▼               ▼
 packages/        packages/       packages/       packages/
 scraper          audit-engine    lead-scoring    shared
        │               │
        ▼               ▼
 Playwright /     Lighthouse +
 Cheerio / Axios  Playwright
        │
        ▼
┌───────────────────────────────────────┐
│  packages/database (Prisma + Postgres) │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  Storage abstraction (local → S3)      │
│  screenshots/, exports/                │
└───────────────────────────────────────┘
```

---

## 2. Monorepo Layout

```text
/apps
  /web          Next.js 15 dashboard
  /api          NestJS API + CLI commands
/packages
  /database     Prisma schema, client, migrations
  /scraper      LeadProvider interface + providers + orchestrator
  /audit-engine Lighthouse, heuristics, screenshots, AI audit, contacts
  /lead-scoring Deterministic scoring
  /shared       Types, constants, Zod schemas, utils
/docker         Dockerfiles + compose overlays
/docs           Product & engineering docs
```

**Why Turborepo:** Shared TypeScript packages, cached builds, single dependency graph, consistent scripts for CI and local Docker builds.

---

## 3. Package Responsibilities

### 3.1 `@leadhunter/shared`
- Domain types (Company, Audit, OutreachStatus, ScoreResult)
- Zod validation schemas shared by API and web
- Constants (industries, cities, score bands)
- Pure utilities (normalize URL, normalize phone MK, email heuristics)

### 3.2 `@leadhunter/database`
- Single Prisma schema (source of truth)
- Generated Prisma Client re-exported for api/cli
- Seed script for demo settings + sample industries

### 3.3 `@leadhunter/scraper`
- `LeadProvider` interface
- Base provider with retry, throttle, axios/cheerio helpers
- Concrete providers (directory adapters)
- `ScraperOrchestrator` — run one/all providers, dedupe, persist callback
- Structured logging via pino-compatible logger interface

### 3.4 `@leadhunter/audit-engine`
- Website accessibility/SSL checks
- Lighthouse runner (Chrome headless)
- Content signal extraction (forms, maps, social, privacy, cookies)
- Screenshot service (desktop 1440×900, mobile 390×844)
- Contact discovery service
- Website discovery service
- AI audit service (OpenAI-compatible HTTP client; rule-based fallback)

### 3.5 `@leadhunter/lead-scoring`
- Pure function `scoreLead(audit, company) → { score, reasons }`
- Unit-testable; no I/O

### 3.6 `apps/api`
- NestJS modules mirroring domains
- Job runners invoked via HTTP admin endpoints and CLI
- File serving for screenshots/exports under `/storage`

### 3.7 `apps/web`
- App Router pages
- TanStack Table for companies
- Recharts for home widgets
- @dnd-kit for outreach Kanban
- shadcn/ui + next-themes (dark mode)

---

## 4. Runtime Architecture

### 4.1 Synchronous API
CRUD, filters, dashboard aggregates, settings — request/response.

### 4.2 Long-running Jobs
Scraping, audits, screenshots, full-scan run as **in-process job runners** with:
- Job record in DB (`JobRun` table)
- Progress counters
- Cancellation flag
- Idempotent per-company audit updates

v1 does **not** require Redis/Bull. Jobs run in the API process with concurrency limits. Architecture leaves a clear seam (`JobQueue` interface) for BullMQ later.

### 4.3 Storage Abstraction

```ts
interface StorageService {
  put(key: string, data: Buffer | Readable, contentType?: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  getPublicPath(key: string): string;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}
```

Implementations: `LocalStorageService` (default), `S3StorageService` (stub interface ready).

---

## 5. Scraper Provider Architecture

```ts
interface LeadProvider {
  readonly id: string;
  readonly name: string;
  readonly industries: string[];
  scrape(ctx: ScrapeContext): Promise<RawCompany[]>;
}

interface ScrapeContext {
  logger: Logger;
  throttle: Throttle;
  http: HttpClient; // axios with retry
  signal: AbortSignal;
  config: ProviderConfig;
}
```

**Orchestrator pipeline:**
1. Load enabled providers from settings
2. For each provider: scrape → normalize → dedupe (in-batch + against DB)
3. Upsert companies
4. Emit JobRun stats

**Deduplication keys (priority):**
1. Normalized website domain
2. Normalized phone (MK)
3. Normalized email
4. Fuzzy: `normalize(name) + city`

---

## 6. Audit & Enrichment Pipeline

```text
Company
  → discoverWebsite (if missing)
  → discoverContacts
  → auditWebsite (if URL)
  → captureScreenshots
  → scoreLead
  → optional generateAiAudit
  → persist WebsiteAudit + Screenshot + ContactCandidates
```

Concurrency: configurable worker pool (default 2) to protect CPU/Lighthouse.

---

## 7. API Surface (REST)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/dashboard/stats` | KPIs + chart series |
| GET | `/api/companies` | List + filters + pagination |
| GET | `/api/companies/:id` | Detail with relations |
| PATCH | `/api/companies/:id` | Update fields |
| DELETE | `/api/companies/:id` | Delete |
| POST | `/api/companies/:id/audit` | Queue single audit |
| GET | `/api/outreach` | List by status |
| PATCH | `/api/outreach/:id` | Update status/notes/dates |
| POST | `/api/outreach` | Create outreach for company |
| POST | `/api/emails/generate` | Generate outreach email |
| GET | `/api/emails` | List templates |
| POST | `/api/exports` | Create export job |
| GET | `/api/exports/:id/download` | Download file |
| GET/PUT | `/api/settings` | App settings |
| POST | `/api/jobs/scrape` | Start scrape |
| POST | `/api/jobs/audit` | Start batch audit |
| POST | `/api/jobs/screenshots` | Start screenshots |
| POST | `/api/jobs/discover-contacts` | Start contact discovery |
| POST | `/api/jobs/full-scan` | Full pipeline |
| GET | `/api/jobs` | List job runs |
| GET | `/api/jobs/:id` | Job status |

---

## 8. Frontend Architecture

- **Data fetching:** TanStack Query against Nest API (`NEXT_PUBLIC_API_URL`)
- **Client state:** Zustand for UI (sidebar, filters draft, Kanban optimistic)
- **Tables:** TanStack Table + server-side pagination
- **Charts:** Recharts
- **Theme:** `next-themes` + CSS variables (shadcn)
- **Auth (v1):** Optional simple API key header for dashboard; default open in local Docker for solo use. Seam ready for NextAuth later.

---

## 9. Docker Topology

```text
postgres:16  →  api:3001  →  web:3000
                 │
                 └─ volume: ./storage
```

Compose services: `postgres`, `api`, `web`. Migrations run on api startup.

---

## 10. Architecture Review — Weaknesses & Mitigations

### W1. In-process jobs block / crash risk
**Risk:** Long Lighthouse runs crash the API process.  
**Mitigation:** Separate Nest CLI application context for jobs; concurrency caps; JobRun heartbeats; try/catch per company; optional `JOB_MODE=worker` process in compose later. v1 ships CLI + HTTP triggers with isolation per-item.

### W2. Lighthouse + Playwright resource heavy
**Risk:** OOM in small Docker hosts.  
**Mitigation:** Default concurrency 1–2; Chromium shared; timeout budgets; skip Lighthouse if `AUDIT_LIGHTWEIGHT=true` (heuristics-only mode).

### W3. Scraper ToS / brittle HTML
**Risk:** Directory markup changes break providers.  
**Mitigation:** Provider adapters isolated; fixture-based unit tests; mock provider for demos; graceful empty results + JobRun errors; HTML selector maps in provider config.

### W4. Incomplete original schema for production ops
**Risk:** Original tables lack jobs, settings, contacts, score explanations, issues.  
**Mitigation:** Extended schema (see `database-design.md`): `JobRun`, `AppSetting`, `ContactCandidate`, `AuditIssue`, score `reasons` JSON, website discovery confidence.

### W5. No auth in solo MVP
**Risk:** Exposed API if deployed publicly.  
**Mitigation:** Document bind to localhost; optional `API_KEY` middleware; README security section. Not multi-tenant.

### W6. AI dependency
**Risk:** OpenAI key missing breaks audits/emails.  
**Mitigation:** Rule-based AI audit + email templates always available; OpenAI used when `OPENAI_API_KEY` set.

### W7. Deduplication false positives
**Risk:** Merging distinct companies with similar names.  
**Mitigation:** Prefer hard keys (domain/phone/email); soft match requires city + high name similarity; never auto-merge if both have different domains.

### W8. Screenshot/PDF storage growth
**Risk:** Disk fill.  
**Mitigation:** Local storage under `./storage` with path indexing; settings for retention; S3 abstraction for later.

### W9. EmailTemplate tied only to companyId
**Risk:** No global templates.  
**Mitigation:** `companyId` nullable; `EmailTemplate` supports global + per-company; add `kind` field (`OUTREACH` | `FOLLOW_UP`).

### W10. Missing outreach uniqueness
**Risk:** Multiple outreach rows per company.  
**Mitigation:** One `Outreach` per company (`companyId` unique); history via `OutreachNote` or notes field with timestamps appended.

---

## 11. Improved Design Decisions (Locked for Implementation)

1. Extend Prisma schema beyond the initial sketch (contacts, issues, jobs, settings, discovery confidence).
2. Jobs as DB-tracked runners with CLI parity.
3. Storage abstraction from day one (local impl).
4. Deterministic scoring package with no I/O.
5. AI features optional with rule-based fallbacks.
6. Provider registry pattern for scrapers.
7. Heuristics-only audit mode for low-resource environments.
8. Single outreach record per company + note history.
9. Shared Zod schemas for API ↔ web contract.
10. Docker Compose as the primary developer path.

---

## 12. Security Baseline

- Env-based secrets (`.env`, never committed)
- Helmet + CORS on API
- Input validation (Zod / class-validator)
- Path traversal guards for storage keys
- Rate limiting on public endpoints
- Sanitize HTML from scrapers before display

---

## 13. Observability

- Structured JSON logs (pino)
- JobRun progress for UI polling
- Health endpoint for compose healthchecks
- Per-provider scrape metrics in JobRun.result JSON

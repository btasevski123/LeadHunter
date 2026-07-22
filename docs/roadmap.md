# LeadHunter MK — Implementation Roadmap

## Phase 0 — Documentation & Architecture Lock (Done before code)
- [x] `/docs/product-spec.md`
- [x] `/docs/system-architecture.md` (includes weakness review)
- [x] `/docs/database-design.md`
- [x] `/docs/roadmap.md`
- Architecture weaknesses reviewed and schema/API decisions locked

## Phase 1 — Monorepo Scaffold
- Turborepo root (package.json, turbo.json, tsconfig)
- Workspace packages: shared, database, scraper, audit-engine, lead-scoring
- Apps: api (NestJS), web (Next.js)
- ESLint/Prettier baseline
- Docker Compose skeleton + `.env.example`

## Phase 2 — Database
- Full Prisma schema per database-design.md
- Client export package
- Seed defaults (settings)
- Migration init

## Phase 3 — Shared Domain
- Types, Zod schemas, constants (MK cities, industries)
- URL/phone/email normalization utilities
- Storage interface + local implementation

## Phase 4 — Lead Scoring
- Pure scoring engine with reasons
- Unit tests for score bands

## Phase 5 — Scraper Engine
- LeadProvider interface + base provider
- Throttle, retry, logger
- Orchestrator + dedupe
- Concrete providers:
  - MockDirectoryProvider (deterministic demo data for MK)
  - GenericHtmlDirectoryProvider (configurable selectors)
  - Industry-oriented provider configs (printing, manufacturing, construction, accounting, lawyers, dentists, services)

## Phase 6 — Audit Engine
- SSL / accessibility / content heuristics
- Lighthouse integration (optional lightweight mode)
- Screenshot engine (Playwright)
- Contact discovery
- Website discovery
- AI audit (OpenAI + fallback)

## Phase 7 — NestJS API
- Modules: companies, audits, outreach, emails, exports, jobs, settings, dashboard, storage
- Validation, CORS, health
- CLI commands wired to job services
- Export engine (CSV, XLSX, PDF)

## Phase 8 — Next.js Dashboard
- Layout, dark mode, navigation
- Home KPIs + charts
- Companies table (filters, sort, pagination)
- Company detail
- Top Leads
- Outreach Kanban (dnd)
- Settings
- React Query + Zustand integration

## Phase 9 — Docker & Integration
- Dockerfiles for api/web
- compose: postgres, api, web
- Storage volume
- `npm run full-scan` end-to-end
- README + install/dev/deploy docs
- Architecture & DB diagrams in docs

## Phase 10 — Hardening
- Seed sample companies for empty DB demo
- Error boundaries / empty states
- Healthchecks
- Final consistency pass

---

## Delivery Order (this build session)

1. Docs (this phase)
2. Scaffold + database + shared + scoring
3. Scraper + audit packages
4. API + CLI + exports
5. Web dashboard
6. Docker + final documentation

Each phase produces working, compilable code — not placeholders.

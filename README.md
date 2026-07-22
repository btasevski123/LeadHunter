# LeadHunter MK

Discover companies in North Macedonia, audit their digital presence, score web-development opportunities, and manage outreach in one place.

## Stack

- **Web:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn-style UI, TanStack Table/Query, Recharts, Zustand
- **API:** NestJS + TypeScript
- **DB:** PostgreSQL + Prisma
- **Engines:** Playwright, Cheerio, Axios, Lighthouse
- **Monorepo:** Turborepo (`apps/*`, `packages/*`)

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- Dashboard: http://localhost:3000
- API: http://localhost:3001/api/health

Then seed leads:

```bash
docker compose exec api npm run full-scan -w @leadhunter/api
```

Or from the host (with Node 20+):

```bash
npm install
npm run db:deploy
npm run db:seed
npm run full-scan
```

## Local development

```bash
cp .env.example .env
docker compose up postgres -d
npm install
npm run build -w @leadhunter/shared
npm run build -w @leadhunter/database
npm run db:deploy
npm run db:seed
npm run dev
```

CLI pipeline commands (from repo root):

| Command | Purpose |
|---------|---------|
| `npm run scrape` | Run enabled lead providers |
| `npm run audit` | Audit companies (Lighthouse/heuristics) |
| `npm run screenshots` | Capture desktop/mobile screenshots |
| `npm run discover-contacts` | Extract emails/phones/social |
| `npm run export` | Export CSV (or pass XLSX/PDF via API workspace) |
| `npm run full-scan` | Scrape → contacts → audit → screenshots |

## Documentation

- [Product spec](docs/product-spec.md)
- [System architecture](docs/system-architecture.md)
- [Database design](docs/database-design.md)
- [Roadmap](docs/roadmap.md)
- [Installation](docs/installation.md)
- [Development](docs/development.md)
- [Deployment](docs/deployment.md)
- [Architecture diagram](docs/architecture-diagram.md)
- [Database diagram](docs/database-diagram.md)

## Monorepo layout

```text
apps/web              Next.js dashboard
apps/api              NestJS API + CLI
packages/database     Prisma schema & client
packages/scraper      Provider-based lead scraping
packages/audit-engine Website audit, screenshots, contacts, AI
packages/lead-scoring Deterministic 0–100 scoring
packages/shared       Types, Zod schemas, storage abstraction
```

## Security notes

- Bind to localhost for solo use, or set `API_KEY` to require `x-api-key`
- Never commit `.env` or real OpenAI keys
- Scrapers must respect rate limits and public-data boundaries

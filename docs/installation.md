# Installation Guide

## Prerequisites

- Node.js 20+
- npm 10+
- Docker + Docker Compose (recommended)
- Optional: OpenAI API key for AI audits/emails

## Option A — Docker Compose (recommended)

1. Clone the repository and enter it.
2. Copy environment file:

```bash
cp .env.example .env
```

3. Start the stack:

```bash
docker compose up --build
```

4. Open http://localhost:3000

5. Populate data:

```bash
docker compose exec api sh -c "cd /app && npx tsx apps/api/src/cli.ts full-scan"
```

If the API image only has compiled output:

```bash
docker compose exec api node -e "console.log('use host CLI or npm run full-scan after npm install')"
```

Preferred host-side pipeline after `npm install` with compose postgres:

```bash
DATABASE_URL=postgresql://leadhunter:leadhunter@localhost:5432/leadhunter?schema=public \
AUDIT_LIGHTWEIGHT=true SKIP_SCREENSHOTS=true \
npm run full-scan
```

## Option B — Local Node + Docker Postgres

```bash
cp .env.example .env
docker compose up postgres -d
npm install
npm run build -w @leadhunter/shared
npm run build -w @leadhunter/lead-scoring
npm run build -w @leadhunter/scraper
npm run build -w @leadhunter/audit-engine
npm run build -w @leadhunter/database
npm run db:deploy
npm run db:seed
npx playwright install chromium
npm run dev
```

In another terminal:

```bash
npx playwright install chromium
AUDIT_LIGHTWEIGHT=true npm run full-scan
```

## Environment variables

See `.env.example` for the full list. Important ones:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string |
| `NEXT_PUBLIC_API_URL` | Browser-facing API base URL |
| `STORAGE_ROOT` | Local file storage root |
| `AUDIT_LIGHTWEIGHT` | `true` skips full Lighthouse (faster) |
| `SKIP_SCREENSHOTS` | `true` skips Playwright captures |
| `OPENAI_API_KEY` | Optional AI enrichment |
| `API_KEY` | Optional API auth |

## Verify

```bash
curl http://localhost:3001/api/health
```

Dashboard KPIs should update after scrape/audit jobs complete.

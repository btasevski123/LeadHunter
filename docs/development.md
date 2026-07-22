# Development Guide

## Workspace scripts

Root `package.json` wires Turborepo and convenience CLIs:

- `npm run dev` — API + web in watch mode
- `npm run build` — build all packages/apps
- `npm run scrape|audit|screenshots|discover-contacts|export|full-scan`

## Package dependency order

Build shared packages before apps:

1. `@leadhunter/shared`
2. `@leadhunter/lead-scoring`
3. `@leadhunter/scraper`
4. `@leadhunter/audit-engine`
5. `@leadhunter/database` (`prisma generate`)
6. `@leadhunter/api` / `@leadhunter/web`

## Adding a scraper provider

1. Create a class implementing `LeadProvider` in `packages/scraper/src/providers/`
2. Extend `BaseLeadProvider` for HTTP/retry/throttle helpers
3. Register it in `packages/scraper/src/registry.ts`
4. Enable the provider id in Settings → scraper.enabledProviders

## Audit modes

- **Full:** Lighthouse + heuristics + screenshots
- **Lightweight:** heuristics only (`AUDIT_LIGHTWEIGHT=true`) — preferred for local demos and full-scan defaults in Docker

## Database changes

```bash
cd packages/database
npx prisma migrate dev --name describe_change
npx prisma generate
```

## Frontend conventions

- App Router pages under `apps/web/src/app`
- Data fetching via TanStack Query + `src/lib/api.ts`
- UI primitives in `src/components/ui` (shadcn-compatible)
- Dark mode via `next-themes`

## Testing scoring

```bash
npm run test -w @leadhunter/lead-scoring
```

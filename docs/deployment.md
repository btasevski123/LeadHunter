# Deployment Guide

## Docker Compose production-ish deploy

1. Provision a host with Docker.
2. Copy `.env.example` → `.env` and set:
   - Strong Postgres password (update compose accordingly)
   - `API_KEY` for dashboard/API protection
   - `OPENAI_API_KEY` if using AI
   - `CORS_ORIGIN` to your public web origin
   - `NEXT_PUBLIC_API_URL` to the public API URL (rebuild web after changing)
3. Start:

```bash
docker compose up --build -d
```

4. Put a reverse proxy (Caddy/Nginx/Traefik) in front of ports 3000/3001 with TLS.
5. Schedule `full-scan` via cron:

```bash
0 3 * * * cd /opt/leadhunter && docker compose exec -T api node apps/api/dist/cli.js full-scan
```

> Note: compile CLI into dist or invoke via `npx tsx` in a worker container. For production, prefer a dedicated worker service running the Nest application context CLI.

## Storage

Screenshots and exports live in `./storage` (bind-mounted). For S3 later, implement `StorageService` and swap the factory in API services — interface already exists in `@leadhunter/shared`.

## Backups

- Postgres volume `postgres_data`
- `storage/` directory

## Scaling notes

- Keep audit concurrency low (1–2) unless the host has spare CPU/RAM
- Move jobs to a separate worker process when traffic grows (`JOB_MODE=worker` seam documented in architecture)
- Enable `API_KEY` whenever the API is reachable beyond localhost

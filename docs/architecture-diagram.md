# Architecture Diagram

```text
                    ┌──────────────────────────┐
                    │     Operator Browser     │
                    │   apps/web (Next.js)     │
                    └────────────┬─────────────┘
                                 │ REST JSON
                    ┌────────────▼─────────────┐
                    │   apps/api (NestJS)      │
                    │  Companies Audits CRM    │
                    │  Jobs Exports Settings   │
                    └─┬──────────┬──────────┬──┘
                      │          │          │
         ┌────────────▼──┐  ┌────▼────┐  ┌──▼──────────────┐
         │ scraper pkg   │  │ audit   │  │ lead-scoring    │
         │ providers +   │  │ engine  │  │ pure functions  │
         │ orchestrator  │  │ LH/PW   │  └─────────────────┘
         └───────┬───────┘  └────┬────┘
                 │               │
                 └───────┬───────┘
                         ▼
              ┌──────────────────────┐
              │ packages/database    │
              │ Prisma → PostgreSQL  │
              └──────────┬───────────┘
                         │
              ┌──────────▼───────────┐
              │ Local Storage        │
              │ screenshots/exports  │
              │ (S3-ready interface) │
              └──────────────────────┘
```

## Pipeline sequence

```text
Providers → Dedupe/Upsert → Discover website/contacts
         → Audit + Score → Screenshots → AI narrative (optional)
         → Dashboard / CRM / Export
```

# Database Diagram

```text
Company 1──* WebsiteAudit 1──* AuditIssue
   │
   │ 1──1 Screenshot
   │ 1──* ContactCandidate
   │ 1──* WebsiteDiscovery
   │ 1──1 Outreach 1──* OutreachNote
   │ 1──* EmailTemplate

AppSetting (key/value JSON)
JobRun 1──* ExportArtifact
```

## Core relationships

| Parent | Child | Cardinality | Notes |
|--------|-------|-------------|-------|
| Company | WebsiteAudit | 1:N | `isLatest` marks current |
| WebsiteAudit | AuditIssue | 1:N | severity-coded findings |
| Company | Screenshot | 1:1 | desktop + mobile paths |
| Company | Outreach | 1:1 | CRM status |
| Outreach | OutreachNote | 1:N | history |
| Company | ContactCandidate | 1:N | confidence scored |
| JobRun | ExportArtifact | 1:N | CSV/XLSX/PDF files |

See `docs/database-design.md` for column-level detail and `packages/database/prisma/schema.prisma` for the source of truth.

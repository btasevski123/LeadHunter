# LeadHunter MK — Database Design

## 1. Overview

PostgreSQL 16 + Prisma ORM. Schema lives in `packages/database/prisma/schema.prisma`.

Design goals:
- Support discovery → enrichment → CRM → export
- Keep scoring explainable (JSON reasons)
- Track jobs and settings
- Enable contact confidence scoring
- One outreach record per company

---

## 2. Entity Relationship Diagram

```text
┌──────────────┐       1:N        ┌─────────────────┐
│   Company    │──────────────────│  WebsiteAudit    │
│              │                  │  (latest flag)   │
└──────┬───────┘                  └────────┬────────┘
       │                                   │
       │ 1:1                               │ 1:N
       ▼                                   ▼
┌──────────────┐                  ┌─────────────────┐
│  Outreach    │                  │   AuditIssue     │
└──────┬───────┘                  └─────────────────┘
       │ 1:N
       ▼
┌──────────────┐
│ OutreachNote │
└──────────────┘

Company 1:1 Screenshot (latest paths)
Company 1:N ContactCandidate
Company 1:N EmailTemplate
Company 1:N WebsiteDiscovery

AppSetting (singleton / key-value)
JobRun (pipeline executions)
ExportArtifact (generated files)
```

---

## 3. Tables

### 3.1 Company

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | cuid/uuid |
| name | string | required |
| industry | string? | normalized slug/label |
| city | string? | |
| address | string? | |
| phone | string? | raw |
| phoneNormalized | string? | indexed for dedupe |
| email | string? | primary email |
| website | string? | |
| websiteDomain | string? | indexed |
| facebookUrl | string? | |
| linkedinUrl | string? | |
| instagramUrl | string? | |
| sourceUrl | string? | |
| sourceName | string? | provider id |
| nameNormalized | string | for soft dedupe |
| hasWebsite | boolean | denormalized |
| latestLeadScore | int? | denormalized for sorting |
| createdAt | datetime | |
| updatedAt | datetime | |

Indexes: `websiteDomain`, `phoneNormalized`, `email`, `(nameNormalized, city)`, `industry`, `city`, `latestLeadScore`, `hasWebsite`

### 3.2 WebsiteAudit

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| companyId | uuid FK | |
| websiteExists | boolean | |
| websiteAccessible | boolean | |
| sslEnabled | boolean | |
| mobileFriendly | boolean | |
| lighthousePerformance | float? | 0–100 |
| lighthouseSeo | float? | |
| lighthouseAccessibility | float? | |
| lighthouseBestPractices | float? | |
| hasContactForm | boolean | |
| hasGoogleMaps | boolean | |
| hasSocialLinks | boolean | |
| hasPrivacyPolicy | boolean | |
| hasCookieNotice | boolean | |
| designAgeEstimate | string? | e.g. `modern` / `aging` / `outdated` |
| leadScore | int | 0–100 |
| scoreReasons | json | string[] |
| auditSummary | text? | human summary |
| aiRecommendations | text? | AI or rule-based narrative |
| issuesCount | int | |
| isLatest | boolean | only one latest per company |
| auditedAt | datetime | |
| createdAt | datetime | |

### 3.3 AuditIssue

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| auditId | uuid FK | |
| code | string | e.: `NO_SSL` |
| severity | enum | LOW / MEDIUM / HIGH / CRITICAL |
| title | string | |
| description | string | |

### 3.4 Screenshot

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| companyId | uuid FK unique | one current set |
| desktopPath | string? | storage key |
| mobilePath | string? | storage key |
| capturedAt | datetime | |

### 3.5 ContactCandidate

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| companyId | uuid FK | |
| type | enum | EMAIL / PHONE / FACEBOOK / LINKEDIN / INSTAGRAM / OTHER |
| value | string | |
| sourceUrl | string? | |
| confidence | float | 0–1 |
| isPrimary | boolean | |
| createdAt | datetime | |

Unique: `(companyId, type, value)`

### 3.6 WebsiteDiscovery

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| companyId | uuid FK | |
| discoveredUrl | string | |
| kind | enum | WEBSITE / FACEBOOK / LINKEDIN / INSTAGRAM |
| confidence | float | |
| method | string | e.g. `search_heuristic` |
| createdAt | datetime | |

### 3.7 Outreach

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| companyId | uuid FK unique | one per company |
| status | enum | NOT_CONTACTED, CONTACTED, REPLIED, MEETING_SCHEDULED, WON, LOST |
| notes | text? | latest summary notes |
| contactDate | datetime? | |
| followUpDate | datetime? | |
| meetingDate | datetime? | |
| createdAt | datetime | |
| updatedAt | datetime | |

### 3.8 OutreachNote

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| outreachId | uuid FK | |
| body | text | |
| createdAt | datetime | |

### 3.9 EmailTemplate

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| companyId | uuid FK? | null = global |
| kind | enum | OUTREACH / FOLLOW_UP |
| subject | string | |
| content | text | |
| createdAt | datetime | |

### 3.10 AppSetting

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| key | string unique | |
| value | json | |
| updatedAt | datetime | |

Keys include: `scraper`, `audit`, `rateLimits`, `export`, `apiKeys` (secrets stored as env refs, not raw if possible).

### 3.11 JobRun

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| type | enum | SCRAPE, AUDIT, SCREENSHOTS, DISCOVER_CONTACTS, EXPORT, FULL_SCAN |
| status | enum | PENDING, RUNNING, COMPLETED, FAILED, CANCELLED |
| progress | int | 0–100 |
| totalItems | int | |
| processedItems | int | |
| successItems | int | |
| failedItems | int | |
| message | string? | |
| result | json? | |
| error | text? | |
| startedAt | datetime? | |
| finishedAt | datetime? | |
| createdAt | datetime | |

### 3.12 ExportArtifact

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| jobRunId | uuid FK? | |
| format | enum | CSV / XLSX / PDF |
| storagePath | string | |
| filters | json? | |
| createdAt | datetime | |

---

## 4. Enums

```prisma
enum OutreachStatus {
  NOT_CONTACTED
  CONTACTED
  REPLIED
  MEETING_SCHEDULED
  WON
  LOST
}

enum IssueSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ContactType {
  EMAIL
  PHONE
  FACEBOOK
  LINKEDIN
  INSTAGRAM
  OTHER
}

enum DiscoveryKind {
  WEBSITE
  FACEBOOK
  LINKEDIN
  INSTAGRAM
}

enum EmailKind {
  OUTREACH
  FOLLOW_UP
}

enum JobType {
  SCRAPE
  AUDIT
  SCREENSHOTS
  DISCOVER_CONTACTS
  EXPORT
  FULL_SCAN
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum ExportFormat {
  CSV
  XLSX
  PDF
}
```

---

## 5. Denormalization Strategy

For list/sort performance:
- `Company.hasWebsite` updated when website set
- `Company.latestLeadScore` updated when latest audit saved
- `WebsiteAudit.isLatest` toggled in a transaction

---

## 6. Migrations

- Prisma migrate in `packages/database`
- API container runs `prisma migrate deploy` on boot
- Seed creates default AppSettings + ensures outreach rows can be lazy-created

---

## 7. Deviations from Original Sketch (Intentional)

| Original | Improvement |
|----------|-------------|
| WebsiteAudit only | + AuditIssue, scoreReasons JSON, aiRecommendations, isLatest |
| Screenshot only paths | unique per company, capturedAt |
| Outreach multi-row risk | unique companyId + OutreachNote history |
| EmailTemplate company-only | nullable companyId + kind |
| No jobs/settings | JobRun, AppSetting, ExportArtifact |
| No contacts table | ContactCandidate with confidence |
| No discovery tracking | WebsiteDiscovery |

These changes keep the product goals while making the system operable in production.

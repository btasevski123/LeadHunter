-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('NOT_CONTACTED', 'CONTACTED', 'REPLIED', 'MEETING_SCHEDULED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('EMAIL', 'PHONE', 'FACEBOOK', 'LINKEDIN', 'INSTAGRAM', 'OTHER');

-- CreateEnum
CREATE TYPE "DiscoveryKind" AS ENUM ('WEBSITE', 'FACEBOOK', 'LINKEDIN', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "EmailKind" AS ENUM ('OUTREACH', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('SCRAPE', 'AUDIT', 'SCREENSHOTS', 'DISCOVER_CONTACTS', 'EXPORT', 'FULL_SCAN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'XLSX', 'PDF');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "city" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "email" TEXT,
    "website" TEXT,
    "websiteDomain" TEXT,
    "facebookUrl" TEXT,
    "linkedinUrl" TEXT,
    "instagramUrl" TEXT,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "nameNormalized" TEXT NOT NULL,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
    "latestLeadScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteAudit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "websiteExists" BOOLEAN NOT NULL DEFAULT false,
    "websiteAccessible" BOOLEAN NOT NULL DEFAULT false,
    "sslEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mobileFriendly" BOOLEAN NOT NULL DEFAULT false,
    "lighthousePerformance" DOUBLE PRECISION,
    "lighthouseSeo" DOUBLE PRECISION,
    "lighthouseAccessibility" DOUBLE PRECISION,
    "lighthouseBestPractices" DOUBLE PRECISION,
    "hasContactForm" BOOLEAN NOT NULL DEFAULT false,
    "hasGoogleMaps" BOOLEAN NOT NULL DEFAULT false,
    "hasSocialLinks" BOOLEAN NOT NULL DEFAULT false,
    "hasPrivacyPolicy" BOOLEAN NOT NULL DEFAULT false,
    "hasCookieNotice" BOOLEAN NOT NULL DEFAULT false,
    "designAgeEstimate" TEXT,
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "scoreReasons" JSONB NOT NULL,
    "auditSummary" TEXT,
    "aiRecommendations" TEXT,
    "issuesCount" INTEGER NOT NULL DEFAULT 0,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "auditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditIssue" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "AuditIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screenshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "desktopPath" TEXT,
    "mobilePath" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactCandidate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "ContactType" NOT NULL,
    "value" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteDiscovery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "discoveredUrl" TEXT NOT NULL,
    "kind" "DiscoveryKind" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteDiscovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outreach" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'NOT_CONTACTED',
    "notes" TEXT,
    "contactDate" TIMESTAMP(3),
    "followUpDate" TIMESTAMP(3),
    "meetingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachNote" (
    "id" TEXT NOT NULL,
    "outreachId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "kind" "EmailKind" NOT NULL DEFAULT 'OUTREACH',
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "successItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportArtifact" (
    "id" TEXT NOT NULL,
    "jobRunId" TEXT,
    "format" "ExportFormat" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "filters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_websiteDomain_idx" ON "Company"("websiteDomain");
CREATE INDEX "Company_phoneNormalized_idx" ON "Company"("phoneNormalized");
CREATE INDEX "Company_email_idx" ON "Company"("email");
CREATE INDEX "Company_nameNormalized_city_idx" ON "Company"("nameNormalized", "city");
CREATE INDEX "Company_industry_idx" ON "Company"("industry");
CREATE INDEX "Company_city_idx" ON "Company"("city");
CREATE INDEX "Company_latestLeadScore_idx" ON "Company"("latestLeadScore");
CREATE INDEX "Company_hasWebsite_idx" ON "Company"("hasWebsite");
CREATE INDEX "Company_createdAt_idx" ON "Company"("createdAt");

CREATE INDEX "WebsiteAudit_companyId_isLatest_idx" ON "WebsiteAudit"("companyId", "isLatest");
CREATE INDEX "WebsiteAudit_leadScore_idx" ON "WebsiteAudit"("leadScore");
CREATE INDEX "WebsiteAudit_auditedAt_idx" ON "WebsiteAudit"("auditedAt");

CREATE INDEX "AuditIssue_auditId_idx" ON "AuditIssue"("auditId");
CREATE INDEX "AuditIssue_code_idx" ON "AuditIssue"("code");

CREATE UNIQUE INDEX "Screenshot_companyId_key" ON "Screenshot"("companyId");

CREATE INDEX "ContactCandidate_companyId_idx" ON "ContactCandidate"("companyId");
CREATE INDEX "ContactCandidate_type_idx" ON "ContactCandidate"("type");
CREATE UNIQUE INDEX "ContactCandidate_companyId_type_value_key" ON "ContactCandidate"("companyId", "type", "value");

CREATE INDEX "WebsiteDiscovery_companyId_idx" ON "WebsiteDiscovery"("companyId");

CREATE UNIQUE INDEX "Outreach_companyId_key" ON "Outreach"("companyId");
CREATE INDEX "Outreach_status_idx" ON "Outreach"("status");
CREATE INDEX "Outreach_followUpDate_idx" ON "Outreach"("followUpDate");

CREATE INDEX "OutreachNote_outreachId_idx" ON "OutreachNote"("outreachId");

CREATE INDEX "EmailTemplate_companyId_idx" ON "EmailTemplate"("companyId");
CREATE INDEX "EmailTemplate_kind_idx" ON "EmailTemplate"("kind");

CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

CREATE INDEX "JobRun_type_idx" ON "JobRun"("type");
CREATE INDEX "JobRun_status_idx" ON "JobRun"("status");
CREATE INDEX "JobRun_createdAt_idx" ON "JobRun"("createdAt");

CREATE INDEX "ExportArtifact_format_idx" ON "ExportArtifact"("format");
CREATE INDEX "ExportArtifact_createdAt_idx" ON "ExportArtifact"("createdAt");

-- AddForeignKey
ALTER TABLE "WebsiteAudit" ADD CONSTRAINT "WebsiteAudit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditIssue" ADD CONSTRAINT "AuditIssue_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "WebsiteAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactCandidate" ADD CONSTRAINT "ContactCandidate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebsiteDiscovery" ADD CONSTRAINT "WebsiteDiscovery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Outreach" ADD CONSTRAINT "Outreach_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachNote" ADD CONSTRAINT "OutreachNote_outreachId_fkey" FOREIGN KEY ("outreachId") REFERENCES "Outreach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExportArtifact" ADD CONSTRAINT "ExportArtifact_jobRunId_fkey" FOREIGN KEY ("jobRunId") REFERENCES "JobRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

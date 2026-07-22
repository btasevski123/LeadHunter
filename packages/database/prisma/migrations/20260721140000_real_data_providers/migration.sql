-- AlterEnum JobType
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'SCRAPE_COMPANYWALL';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'SCRAPE_BIZNIS_MREZA';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'SCRAPE_YELLOW_PAGES';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'GOOGLE_DISCOVERY';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'SCRAPE_INDUSTRY_DIRECTORY';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'WEBSITE_AUDIT';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'CONTACT_DISCOVERY';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'GENERATE_REPORT';

-- AlterTable Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "municipality" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "googleMapsUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "sourceReferences" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "lastScrapedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Company_registrationNumber_idx" ON "Company"("registrationNumber");
CREATE INDEX IF NOT EXISTS "Company_municipality_idx" ON "Company"("municipality");
CREATE INDEX IF NOT EXISTS "Company_sourceName_idx" ON "Company"("sourceName");
CREATE INDEX IF NOT EXISTS "Company_verified_idx" ON "Company"("verified");
CREATE INDEX IF NOT EXISTS "Company_lastScrapedAt_idx" ON "Company"("lastScrapedAt");

CREATE TABLE IF NOT EXISTS "CompanySource" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanySource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanySource_companyId_sourceName_key" ON "CompanySource"("companyId", "sourceName");
CREATE INDEX IF NOT EXISTS "CompanySource_companyId_idx" ON "CompanySource"("companyId");
CREATE INDEX IF NOT EXISTS "CompanySource_sourceName_idx" ON "CompanySource"("sourceName");
CREATE INDEX IF NOT EXISTS "CompanySource_scrapedAt_idx" ON "CompanySource"("scrapedAt");

CREATE TABLE IF NOT EXISTS "ImportRun" (
    "id" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "companiesFound" INTEGER NOT NULL DEFAULT 0,
    "companiesCreated" INTEGER NOT NULL DEFAULT 0,
    "companiesUpdated" INTEGER NOT NULL DEFAULT 0,
    "duplicatesRemoved" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "industryFilter" TEXT,
    "jobRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ImportRun_providerName_idx" ON "ImportRun"("providerName");
CREATE INDEX IF NOT EXISTS "ImportRun_status_idx" ON "ImportRun"("status");
CREATE INDEX IF NOT EXISTS "ImportRun_createdAt_idx" ON "ImportRun"("createdAt");

DO $$ BEGIN
  ALTER TABLE "CompanySource" ADD CONSTRAINT "CompanySource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

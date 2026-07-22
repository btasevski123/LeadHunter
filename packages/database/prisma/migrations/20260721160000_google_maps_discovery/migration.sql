-- AlterEnum
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'GOOGLE_MAPS_DISCOVERY';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'COMPANYWALL_ENRICHMENT';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'DIRECTORY_DISCOVERY';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'COMPANY_NORMALIZATION';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "addressNormalized" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "googlePlaceId" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "googleRating" DOUBLE PRECISION;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "googleReviewsCount" INTEGER;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "googleCategory" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "googleBusinessStatus" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "googleOpeningHours" JSONB;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "googlePhotos" JSONB;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "googleLastUpdated" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "sourceQualityScore" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "Company_googlePlaceId_key" ON "Company"("googlePlaceId");
CREATE INDEX IF NOT EXISTS "Company_addressNormalized_idx" ON "Company"("addressNormalized");
CREATE INDEX IF NOT EXISTS "Company_sourceQualityScore_idx" ON "Company"("sourceQualityScore");
CREATE INDEX IF NOT EXISTS "Company_googlePlaceId_idx" ON "Company"("googlePlaceId");
CREATE INDEX IF NOT EXISTS "Company_googleRating_idx" ON "Company"("googleRating");
CREATE INDEX IF NOT EXISTS "Company_industry_city_idx" ON "Company"("industry", "city");
CREATE INDEX IF NOT EXISTS "Company_sourceName_industry_idx" ON "Company"("sourceName", "industry");

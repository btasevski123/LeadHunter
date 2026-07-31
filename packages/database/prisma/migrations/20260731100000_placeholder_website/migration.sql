-- AlterEnum
ALTER TYPE "LeadClassificationType" ADD VALUE 'PLACEHOLDER_WEBSITE';

-- AlterTable
ALTER TABLE "WebsiteAudit" ADD COLUMN "isPlaceholderSite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebsiteAudit" ADD COLUMN "placeholderSignals" TEXT[] DEFAULT ARRAY[]::TEXT[];

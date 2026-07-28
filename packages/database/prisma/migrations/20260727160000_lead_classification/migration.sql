-- CreateEnum
CREATE TYPE "LeadClassificationType" AS ENUM (
  'NO_WEBSITE',
  'WEBSITE_REDESIGN',
  'SEO_IMPROVEMENT',
  'BOOKING_SYSTEM',
  'ECOMMERCE_OPPORTUNITY',
  'CUSTOM_SOFTWARE',
  'NO_ACTION'
);

-- CreateTable
CREATE TABLE "LeadClassification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "classification" "LeadClassificationType" NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedService" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadClassification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadClassification_companyId_key" ON "LeadClassification"("companyId");

-- CreateIndex
CREATE INDEX "LeadClassification_classification_idx" ON "LeadClassification"("classification");

-- CreateIndex
CREATE INDEX "LeadClassification_confidence_idx" ON "LeadClassification"("confidence");

-- CreateIndex
CREATE INDEX "LeadClassification_updatedAt_idx" ON "LeadClassification"("updatedAt");

-- AddForeignKey
ALTER TABLE "LeadClassification" ADD CONSTRAINT "LeadClassification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

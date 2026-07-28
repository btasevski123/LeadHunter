-- AlterTable
ALTER TABLE "EmailTemplate" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "EmailTemplate" ADD COLUMN "toEmail" TEXT;
ALTER TABLE "EmailTemplate" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "EmailTemplate" ADD COLUMN "sentError" TEXT;

-- CreateIndex
CREATE INDEX "EmailTemplate_sentAt_idx" ON "EmailTemplate"("sentAt");

-- AlterEnum JobType: Google Places enrichment for missing websites
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'PLACES_ENRICHMENT';

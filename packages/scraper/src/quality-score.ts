import { COMPANY_SOURCES } from '@leadhunter/shared';

/** Source reliability weights for company quality score (0–100). */
export const SOURCE_QUALITY_WEIGHTS: Record<string, number> = {
  [COMPANY_SOURCES.CENTRAL_REGISTRY]: 30,
  [COMPANY_SOURCES.COMPANY_WALL]: 20,
  [COMPANY_SOURCES.GOOGLE_MAPS]: 20,
  [COMPANY_SOURCES.GOOGLE_DISCOVERY]: 15,
  [COMPANY_SOURCES.YELLOW_PAGES]: 12,
  [COMPANY_SOURCES.BIZNIS_MREZA]: 12,
  [COMPANY_SOURCES.INDUSTRY_DIRECTORY]: 10,
  [COMPANY_SOURCES.BUSINESS_DIRECTORY]: 10,
};

export function computeSourceQualityScore(input: {
  sourceReferences?: string[] | null;
  sourceName?: string | null;
  hasWebsite?: boolean;
  email?: string | null;
  phone?: string | null;
  googlePlaceId?: string | null;
}): number {
  const sources = new Set<string>([
    ...(input.sourceReferences || []),
    ...(input.sourceName ? [input.sourceName] : []),
  ]);

  let score = 0;
  for (const source of sources) {
    score += SOURCE_QUALITY_WEIGHTS[source] || 5;
  }
  if (input.googlePlaceId && !sources.has(COMPANY_SOURCES.GOOGLE_MAPS)) {
    score += SOURCE_QUALITY_WEIGHTS[COMPANY_SOURCES.GOOGLE_MAPS] || 20;
  }
  if (input.hasWebsite) score += 10;
  if (input.email) score += 10;
  if (input.phone) score += 10;

  return Math.min(100, Math.round(score));
}

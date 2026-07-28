import type { DesignAgeEstimate } from '@leadhunter/shared';

/**
 * Deterministic 0–100 design quality score from existing audit signals.
 * Lower = poorer design → redesign opportunity when < 50.
 */
export function computeDesignScore(input: {
  designAgeEstimate?: string | null;
  mobileFriendly?: boolean | null;
  sslEnabled?: boolean | null;
  lighthousePerformance?: number | null;
}): number | null {
  const age = (input.designAgeEstimate || 'unknown') as DesignAgeEstimate | string;
  if (age === 'unknown' && input.mobileFriendly == null && input.sslEnabled == null) {
    return null;
  }

  let score: number;
  switch (age) {
    case 'outdated':
      score = 25;
      break;
    case 'aging':
      score = 45;
      break;
    case 'modern':
      score = 80;
      break;
    default:
      score = 55;
  }

  if (input.mobileFriendly === false) score -= 15;
  if (input.sslEnabled === false) score -= 10;
  if (input.lighthousePerformance != null && input.lighthousePerformance < 50) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** SEO score maps directly from Lighthouse / heuristic SEO (0–100). */
export function computeSeoScore(lighthouseSeo?: number | null): number | null {
  if (lighthouseSeo == null || Number.isNaN(lighthouseSeo)) return null;
  return Math.max(0, Math.min(100, Math.round(lighthouseSeo)));
}

import type * as cheerio from 'cheerio';
import type { DesignAgeEstimate } from '@leadhunter/shared';

/**
 * Fixed vocabulary for outreach personalization.
 * Email generation may ONLY quote from these lists — never invent new items.
 */
export const POSITIVE_OBSERVATION_VOCAB = [
  'Contact information is easy to find',
  'Services are clearly explained',
  'Strong local brand presence',
  'Professional photography',
  'Simple navigation',
  'Works well on mobile',
  'Site loads over HTTPS',
  'Modern visual design',
] as const;

export const ISSUE_VOCAB = [
  'Not mobile friendly',
  'No HTTPS',
  'Outdated visual design',
  'No clear way to get in touch',
  'No active website',
  'Website is offline or unreachable',
  'Pages feel slow',
] as const;

export type PositiveObservation = (typeof POSITIVE_OBSERVATION_VOCAB)[number];
export type OutreachIssue = (typeof ISSUE_VOCAB)[number];

export interface OutreachWebsiteAnalysis {
  positive_observations: string[];
  issues: string[];
}

export interface OutreachAnalysisInput {
  websiteExists: boolean;
  websiteAccessible: boolean;
  sslEnabled: boolean;
  mobileFriendly: boolean;
  hasContactForm: boolean;
  hasGoogleMaps: boolean;
  hasSocialLinks: boolean;
  designAgeEstimate: DesignAgeEstimate;
  lighthousePerformance: number | null;
  hasPhone?: boolean;
  hasEmail?: boolean;
  /** Optional HTML signals from the live page parse. */
  htmlSignals?: {
    hasNav: boolean;
    serviceCopyLikely: boolean;
    imageCount: number;
  };
}

/** Deterministic analyzer used by audits and by email generation. */
export function analyzeWebsiteForOutreach(
  input: OutreachAnalysisInput,
): OutreachWebsiteAnalysis {
  const positive_observations: PositiveObservation[] = [];
  const issues: OutreachIssue[] = [];

  if (!input.websiteExists) {
    issues.push('No active website');
    if (input.hasGoogleMaps || input.hasPhone || input.hasEmail) {
      positive_observations.push('Strong local brand presence');
    }
    return { positive_observations, issues };
  }

  if (!input.websiteAccessible) {
    issues.push('Website is offline or unreachable');
    if (input.hasGoogleMaps) {
      positive_observations.push('Strong local brand presence');
    }
    return { positive_observations, issues };
  }

  // --- positives (only when evidence supports them) ---
  if (input.hasContactForm || input.hasPhone || input.hasEmail) {
    positive_observations.push('Contact information is easy to find');
  }
  if (input.htmlSignals?.serviceCopyLikely) {
    positive_observations.push('Services are clearly explained');
  }
  if (input.hasGoogleMaps || input.hasSocialLinks) {
    positive_observations.push('Strong local brand presence');
  }
  if ((input.htmlSignals?.imageCount ?? 0) >= 4) {
    positive_observations.push('Professional photography');
  }
  if (input.htmlSignals?.hasNav) {
    positive_observations.push('Simple navigation');
  }
  if (input.mobileFriendly) {
    positive_observations.push('Works well on mobile');
  }
  if (input.sslEnabled) {
    positive_observations.push('Site loads over HTTPS');
  }
  if (input.designAgeEstimate === 'modern') {
    positive_observations.push('Modern visual design');
  }

  // --- issues ---
  if (!input.mobileFriendly) {
    issues.push('Not mobile friendly');
  }
  if (!input.sslEnabled) {
    issues.push('No HTTPS');
  }
  if (input.designAgeEstimate === 'outdated' || input.designAgeEstimate === 'aging') {
    issues.push('Outdated visual design');
  }
  if (!input.hasContactForm && !input.hasPhone && !input.hasEmail) {
    issues.push('No clear way to get in touch');
  }
  if (input.lighthousePerformance !== null && input.lighthousePerformance < 50) {
    issues.push('Pages feel slow');
  }

  return {
    positive_observations: uniquePreserveOrder(positive_observations),
    issues: uniquePreserveOrder(issues),
  };
}

/** HTML heuristics used only during a live page audit. */
export function extractHtmlOutreachSignals(
  $: cheerio.CheerioAPI,
  html: string,
): NonNullable<OutreachAnalysisInput['htmlSignals']> {
  const lower = html.toLowerCase();
  const hasNav =
    $('nav a').length >= 3 ||
    $('header a').length >= 4 ||
    $('.menu a, .nav a, #menu a').length >= 3;

  const serviceCopyLikely =
    /услуг|services|what we do|наши услуги|производи|products|понуд/i.test(lower) ||
    $('a').filter((_, el) => /service|услуг|product|произв/i.test($(el).text())).length >= 2;

  const imageCount = $('img').length;

  return { hasNav, serviceCopyLikely, imageCount };
}

/**
 * Picks copy for email templates: exactly one positive (if any), one primary issue.
 * Never invents items outside the analyzer lists.
 */
export function pickOutreachEmailFacts(analysis: OutreachWebsiteAnalysis): {
  positive: string | null;
  issues: string[];
} {
  return {
    positive: analysis.positive_observations[0] ?? null,
    issues: analysis.issues.slice(0, 1),
  };
}

function uniquePreserveOrder<T extends string>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

import { clamp, type ScoreResult, type ScoringInput } from '@leadhunter/shared';

const HIGH_VALUE_INDUSTRIES = new Set([
  'PRINTING',
  'MANUFACTURING',
  'FACTORIES',
  'CONSTRUCTION',
  'FURNITURE',
  'METAL_INDUSTRY',
  'Printing',
  'Manufacturing',
  'Factories',
  'Construction',
  'Furniture',
  'Metal Industry',
]);

/**
 * Deterministic lead score 0–100.
 * Higher = stronger opportunity for web/dev services.
 */
export function scoreLead(input: ScoringInput): ScoreResult {
  const reasons: string[] = [];
  const highValueIndustry = Boolean(
    input.industry && HIGH_VALUE_INDUSTRIES.has(input.industry),
  );

  // Hot-lead path: no website + Google presence + contact channels
  if (!input.websiteExists) {
    let score = 88;
    reasons.push('No website');
    if (highValueIndustry) {
      score += 4;
      reasons.push('High-value industry');
    }
    if (input.hasGooglePresence) {
      score += 3;
      reasons.push('Google Maps presence');
    }
    if (input.hasPhone) {
      score += 2;
      reasons.push('Phone available');
    }
    if (input.hasEmail) {
      score += 2;
      reasons.push('Email available');
    } else {
      reasons.push('No email on record — contact discovery recommended');
    }
    return { score: clamp(score, 0, 100), reasons };
  }

  if (!input.websiteAccessible) {
    const reasonsOffline = ['Website inaccessible or offline'];
    let score = 92;
    if (highValueIndustry) {
      score += 2;
      reasonsOffline.push('High-value industry');
    }
    return { score: clamp(score, 0, 100), reasons: reasonsOffline };
  }

  let score = 35;

  if (highValueIndustry) {
    score += 6;
    reasons.push('High-value industry');
  }
  if (input.hasGooglePresence) {
    score += 4;
    reasons.push('Listed on Google Maps');
  }

  if (!input.sslEnabled) {
    score += 18;
    reasons.push('No SSL');
  }

  if (!input.mobileFriendly) {
    score += 16;
    reasons.push('Poor mobile responsiveness');
  }

  if (input.designAgeEstimate === 'outdated') {
    score += 22;
    reasons.push('Very outdated website design');
  } else if (input.designAgeEstimate === 'aging') {
    score += 12;
    reasons.push('Aging website design');
  }

  if (input.lighthousePerformance !== null && input.lighthousePerformance < 50) {
    score += 10;
    reasons.push('Slow website performance');
  } else if (input.lighthousePerformance !== null && input.lighthousePerformance < 70) {
    score += 5;
    reasons.push('Below-average performance');
  }

  if (input.lighthouseSeo !== null && input.lighthouseSeo < 60) {
    score += 12;
    reasons.push('Poor SEO');
  } else if (input.lighthouseSeo !== null && input.lighthouseSeo < 80) {
    score += 6;
    reasons.push('SEO needs improvement');
  }

  if (input.lighthouseAccessibility !== null && input.lighthouseAccessibility < 70) {
    score += 6;
    reasons.push('Accessibility issues');
  }

  if (!input.hasContactForm) {
    score += 8;
    reasons.push('No contact form');
  }

  if (!input.hasPrivacyPolicy) {
    score += 3;
    reasons.push('Missing privacy policy');
  }

  if (!input.hasCookieNotice) {
    score += 2;
    reasons.push('Missing cookie notice');
  }

  if (!input.hasSocialLinks) {
    score += 3;
    reasons.push('No social links');
  }

  if (!input.hasGoogleMaps) {
    score += 2;
    reasons.push('No Google Maps embed');
  }

  if (!input.hasEmail) {
    score += 4;
    reasons.push('No email discovered yet');
  }

  if (
    input.sslEnabled &&
    input.mobileFriendly &&
    input.designAgeEstimate === 'modern' &&
    (input.lighthouseSeo === null || input.lighthouseSeo >= 80) &&
    (input.lighthousePerformance === null || input.lighthousePerformance >= 70)
  ) {
    score = Math.min(score, 38);
    if (reasons.length === 0) {
      reasons.push('Modern website with solid fundamentals');
    }
  }

  if (reasons.length === 0) {
    reasons.push('Mixed digital presence — selective opportunity');
  }

  return {
    score: clamp(Math.round(score), 0, 100),
    reasons,
  };
}

export function scoreBandLabel(score: number): string {
  if (score >= 90) return 'Critical opportunity';
  if (score >= 80) return 'Very high';
  if (score >= 70) return 'High';
  if (score >= 60) return 'Medium-high';
  if (score >= 40) return 'Medium';
  return 'Low';
}

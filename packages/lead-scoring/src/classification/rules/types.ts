import type {
  ClassificationCompanyInput,
  ClassificationResult,
  LeadClassificationType,
} from '@leadhunter/shared';
import { KVADRA_SERVICE_BY_CLASSIFICATION } from '@leadhunter/shared';

export interface ClassificationRuleContext {
  company: ClassificationCompanyInput;
  hasWebsite: boolean;
  categoryHaystack: string;
  designScore: number | null;
  seoScore: number | null;
  hasBooking: boolean;
  hasEcommerce: boolean;
}

export interface ClassificationRuleMatch {
  classification: LeadClassificationType;
  confidence: number;
  reasons: string[];
}

/**
 * Priority-ordered classification rule.
 * First matching rule in the registry wins.
 */
export interface ClassificationRule {
  readonly id: string;
  readonly priority: number;
  evaluate(ctx: ClassificationRuleContext): ClassificationRuleMatch | null;
}

export function toClassificationResult(match: ClassificationRuleMatch): ClassificationResult {
  return {
    classification: match.classification,
    confidence: match.confidence,
    reasons: match.reasons,
    recommendedService: KVADRA_SERVICE_BY_CLASSIFICATION[match.classification],
  };
}

export function noActionResult(): ClassificationResult {
  return toClassificationResult({
    classification: 'NO_ACTION',
    confidence: 100,
    reasons: ['No matching opportunity rule'],
  });
}

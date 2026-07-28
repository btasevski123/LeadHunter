import type {
  ClassificationCompanyInput,
  ClassificationResult,
} from '@leadhunter/shared';
import { buildCategoryHaystack } from './category';
import { CLASSIFICATION_RULES } from './rules';
import {
  noActionResult,
  toClassificationResult,
  type ClassificationRuleContext,
} from './rules/types';

function hasWebsiteUrl(website?: string | null): boolean {
  return Boolean(website && String(website).trim());
}

function buildContext(company: ClassificationCompanyInput): ClassificationRuleContext {
  const audit = company.audit;
  return {
    company,
    hasWebsite: hasWebsiteUrl(company.website),
    categoryHaystack: buildCategoryHaystack(company),
    designScore: audit?.designScore ?? null,
    seoScore: audit?.seoScore ?? null,
    hasBooking: audit?.hasBooking ?? false,
    hasEcommerce: audit?.hasEcommerce ?? false,
  };
}

/**
 * Deterministic lead classification — first matching priority rule wins.
 * No AI. Predictable and explainable.
 */
export function classifyCompany(company: ClassificationCompanyInput): ClassificationResult {
  const ctx = buildContext(company);

  for (const rule of CLASSIFICATION_RULES) {
    const match = rule.evaluate(ctx);
    if (match) {
      return toClassificationResult(match);
    }
  }

  return noActionResult();
}

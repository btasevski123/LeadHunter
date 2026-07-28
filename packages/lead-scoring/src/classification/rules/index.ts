import { bookingSystemRule } from './booking-system';
import { customSoftwareRule } from './custom-software';
import { ecommerceOpportunityRule } from './ecommerce-opportunity';
import { noWebsiteRule } from './no-website';
import { seoImprovementRule } from './seo-improvement';
import type { ClassificationRule } from './types';
import { websiteRedesignRule } from './website-redesign';

/**
 * Ordered by priority (lowest number = highest priority).
 * Add new rules here — do not inline giant if/else chains.
 */
export const CLASSIFICATION_RULES: ClassificationRule[] = [
  noWebsiteRule,
  websiteRedesignRule,
  seoImprovementRule,
  bookingSystemRule,
  ecommerceOpportunityRule,
  customSoftwareRule,
].sort((a, b) => a.priority - b.priority);

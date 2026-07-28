export { classifyCompany } from './classify';
export { computeDesignScore, computeSeoScore } from './scores';
export {
  buildCategoryHaystack,
  matchesBookingCategory,
  matchesEcommerceCategory,
  matchesCustomSoftwareCategory,
} from './category';
export { CLASSIFICATION_RULES } from './rules';
export type {
  ClassificationRule,
  ClassificationRuleContext,
  ClassificationRuleMatch,
} from './rules/types';

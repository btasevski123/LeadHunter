import { matchesEcommerceCategory } from '../category';
import type { ClassificationRule, ClassificationRuleMatch } from './types';

export const ecommerceOpportunityRule: ClassificationRule = {
  id: 'ECOMMERCE_OPPORTUNITY',
  priority: 5,
  evaluate(ctx): ClassificationRuleMatch | null {
    if (!matchesEcommerceCategory(ctx.categoryHaystack)) return null;
    if (ctx.hasEcommerce) return null;
    return {
      classification: 'ECOMMERCE_OPPORTUNITY',
      confidence: 80,
      reasons: ['Products are sold but ecommerce is not available'],
    };
  },
};

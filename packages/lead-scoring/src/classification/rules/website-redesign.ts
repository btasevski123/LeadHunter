import type { ClassificationRule, ClassificationRuleMatch } from './types';

export const websiteRedesignRule: ClassificationRule = {
  id: 'WEBSITE_REDESIGN',
  priority: 3,
  evaluate(ctx): ClassificationRuleMatch | null {
    if (!ctx.hasWebsite) return null;
    if (ctx.designScore == null || ctx.designScore >= 50) return null;
    return {
      classification: 'WEBSITE_REDESIGN',
      confidence: 90,
      reasons: ['Outdated website design', 'Website modernization opportunity'],
    };
  },
};

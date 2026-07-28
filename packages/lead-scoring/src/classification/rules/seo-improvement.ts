import type { ClassificationRule, ClassificationRuleMatch } from './types';

export const seoImprovementRule: ClassificationRule = {
  id: 'SEO_IMPROVEMENT',
  priority: 3,
  evaluate(ctx): ClassificationRuleMatch | null {
    if (!ctx.hasWebsite) return null;
    if (ctx.seoScore == null || ctx.seoScore >= 50) return null;
    return {
      classification: 'SEO_IMPROVEMENT',
      confidence: 85,
      reasons: ['Poor SEO score', 'Organic visibility can be improved'],
    };
  },
};

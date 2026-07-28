import type { ClassificationRule, ClassificationRuleMatch } from './types';

export const noWebsiteRule: ClassificationRule = {
  id: 'NO_WEBSITE',
  priority: 1,
  evaluate(ctx): ClassificationRuleMatch | null {
    if (ctx.hasWebsite) return null;
    return {
      classification: 'NO_WEBSITE',
      confidence: 100,
      reasons: ['Company does not have a website'],
    };
  },
};

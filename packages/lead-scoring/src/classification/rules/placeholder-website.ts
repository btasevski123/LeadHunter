import type { ClassificationRule, ClassificationRuleMatch } from './types';

export const placeholderWebsiteRule: ClassificationRule = {
  id: 'PLACEHOLDER_WEBSITE',
  priority: 2,
  evaluate(ctx): ClassificationRuleMatch | null {
    if (!ctx.hasWebsite) return null;
    if (!ctx.isPlaceholderSite) return null;
    return {
      classification: 'PLACEHOLDER_WEBSITE',
      confidence: 95,
      reasons: [
        'Website is a placeholder or under construction',
        'Domain exists but site lacks real business content',
      ],
    };
  },
};

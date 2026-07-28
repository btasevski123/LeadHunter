import { matchesCustomSoftwareCategory } from '../category';
import type { ClassificationRule, ClassificationRuleMatch } from './types';

export const customSoftwareRule: ClassificationRule = {
  id: 'CUSTOM_SOFTWARE',
  priority: 6,
  evaluate(ctx): ClassificationRuleMatch | null {
    if (!matchesCustomSoftwareCategory(ctx.categoryHaystack)) return null;
    return {
      classification: 'CUSTOM_SOFTWARE',
      confidence: 75,
      reasons: ['Business processes could be automated'],
    };
  },
};

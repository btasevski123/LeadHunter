import { matchesBookingCategory } from '../category';
import type { ClassificationRule, ClassificationRuleMatch } from './types';

export const bookingSystemRule: ClassificationRule = {
  id: 'BOOKING_SYSTEM',
  priority: 4,
  evaluate(ctx): ClassificationRuleMatch | null {
    if (!matchesBookingCategory(ctx.categoryHaystack)) return null;
    if (ctx.hasBooking) return null;
    return {
      classification: 'BOOKING_SYSTEM',
      confidence: 90,
      reasons: ['Business could benefit from online booking'],
    };
  },
};

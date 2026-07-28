import { INDUSTRY_LABELS, type Industry } from '@leadhunter/shared';

const BOOKING_KEYWORDS = [
  'dentist',
  'dental',
  'clinic',
  'medical',
  'salon',
  'beauty',
  'barber',
  'hotel',
  'apartment',
  'accommodation',
  'spa',
  'fitness',
  'стоматолог',
  'клиник',
  'салон',
  'хотел',
  'апартман',
  'сместување',
  'фитнес',
  'теретан',
] as const;

const ECOMMERCE_KEYWORDS = [
  'shop',
  'store',
  'retail',
  'electronics',
  'fashion',
  'clothing',
  'furniture',
  'printing',
  'продавниц',
  'трговија',
  'мебел',
  'печат',
] as const;

const CUSTOM_SOFTWARE_KEYWORDS = [
  'manufacturing',
  'factory',
  'factories',
  'logistics',
  'transport',
  'warehouse',
  'construction',
  'производство',
  'фабрика',
  'логистик',
  'транспорт',
  'магацин',
  'градежн',
] as const;

function normalizeCategoryText(parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .map((p) => String(p).trim().toLowerCase())
    .join(' ');
}

function resolveIndustryLabel(industry?: string | null): string | null {
  if (!industry) return null;
  const key = industry as Industry;
  if (key in INDUSTRY_LABELS) {
    return INDUSTRY_LABELS[key];
  }
  return industry;
}

export function buildCategoryHaystack(input: {
  industry?: string | null;
  googleCategory?: string | null;
  category?: string | null;
}): string {
  return normalizeCategoryText([
    input.industry,
    resolveIndustryLabel(input.industry),
    input.googleCategory,
    input.category,
  ]);
}

export function categoryContainsAny(
  haystack: string,
  keywords: readonly string[],
): boolean {
  if (!haystack) return false;
  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

export function matchesBookingCategory(haystack: string): boolean {
  return categoryContainsAny(haystack, BOOKING_KEYWORDS);
}

export function matchesEcommerceCategory(haystack: string): boolean {
  return categoryContainsAny(haystack, ECOMMERCE_KEYWORDS);
}

export function matchesCustomSoftwareCategory(haystack: string): boolean {
  return categoryContainsAny(haystack, CUSTOM_SOFTWARE_KEYWORDS);
}

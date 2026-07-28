export type LeadClassificationType =
  | 'NO_WEBSITE'
  | 'WEBSITE_REDESIGN'
  | 'SEO_IMPROVEMENT'
  | 'BOOKING_SYSTEM'
  | 'ECOMMERCE_OPPORTUNITY'
  | 'CUSTOM_SOFTWARE'
  | 'NO_ACTION';

export const LEAD_CLASSIFICATION_TYPES: LeadClassificationType[] = [
  'NO_WEBSITE',
  'WEBSITE_REDESIGN',
  'SEO_IMPROVEMENT',
  'BOOKING_SYSTEM',
  'ECOMMERCE_OPPORTUNITY',
  'CUSTOM_SOFTWARE',
  'NO_ACTION',
];

export const KVADRA_SERVICE_BY_CLASSIFICATION: Record<LeadClassificationType, string> = {
  NO_WEBSITE: 'Business Website',
  WEBSITE_REDESIGN: 'Website Redesign',
  SEO_IMPROVEMENT: 'SEO Optimization',
  BOOKING_SYSTEM: 'Booking System Development',
  ECOMMERCE_OPPORTUNITY: 'E-Commerce Development',
  CUSTOM_SOFTWARE: 'Custom Software Development',
  NO_ACTION: 'None',
};

export const LEAD_CLASSIFICATION_LABELS: Record<LeadClassificationType, string> = {
  NO_WEBSITE: 'No website',
  WEBSITE_REDESIGN: 'Website redesign',
  SEO_IMPROVEMENT: 'SEO improvement',
  BOOKING_SYSTEM: 'Booking system',
  ECOMMERCE_OPPORTUNITY: 'E-commerce opportunity',
  CUSTOM_SOFTWARE: 'Custom software',
  NO_ACTION: 'No action',
};

export interface ClassificationResult {
  classification: LeadClassificationType;
  confidence: number;
  reasons: string[];
  recommendedService: string;
}

/** Audit signals used by classification rules (scores may be derived). */
export interface ClassificationAuditInput {
  designScore: number | null;
  seoScore: number | null;
  hasBooking: boolean;
  hasEcommerce: boolean;
}

export interface ClassificationCompanyInput {
  website?: string | null;
  industry?: string | null;
  googleCategory?: string | null;
  /** Free-text category from directories / Places */
  category?: string | null;
  audit?: ClassificationAuditInput | null;
}

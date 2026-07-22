import type { DesignAgeEstimate } from './types';

export interface ScoringInput {
  websiteExists: boolean;
  websiteAccessible: boolean;
  sslEnabled: boolean;
  mobileFriendly: boolean;
  lighthousePerformance: number | null;
  lighthouseSeo: number | null;
  lighthouseAccessibility: number | null;
  hasContactForm: boolean;
  hasGoogleMaps: boolean;
  hasSocialLinks: boolean;
  hasPrivacyPolicy: boolean;
  hasCookieNotice: boolean;
  designAgeEstimate: DesignAgeEstimate;
  hasEmail: boolean;
  /** Optional enrichment for lead opportunity scoring */
  hasPhone?: boolean;
  hasGooglePresence?: boolean;
  industry?: string | null;
  sourceQualityScore?: number | null;
}

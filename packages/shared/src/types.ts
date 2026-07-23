export type OutreachStatus =
  | 'NOT_CONTACTED'
  | 'CONTACTED'
  | 'REPLIED'
  | 'MEETING_SCHEDULED'
  | 'WON'
  | 'LOST';

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ContactType =
  | 'EMAIL'
  | 'PHONE'
  | 'FACEBOOK'
  | 'LINKEDIN'
  | 'INSTAGRAM'
  | 'OTHER';

export type DiscoveryKind = 'WEBSITE' | 'FACEBOOK' | 'LINKEDIN' | 'INSTAGRAM';

export type EmailKind = 'OUTREACH' | 'FOLLOW_UP';

export type JobType =
  | 'SCRAPE'
  | 'AUDIT'
  | 'SCREENSHOTS'
  | 'DISCOVER_CONTACTS'
  | 'EXPORT'
  | 'FULL_SCAN'
  | 'SCRAPE_COMPANYWALL'
  | 'SCRAPE_BIZNIS_MREZA'
  | 'SCRAPE_YELLOW_PAGES'
  | 'GOOGLE_DISCOVERY'
  | 'SCRAPE_INDUSTRY_DIRECTORY'
  | 'WEBSITE_AUDIT'
  | 'CONTACT_DISCOVERY'
  | 'GENERATE_REPORT'
  | 'GOOGLE_MAPS_DISCOVERY'
  | 'COMPANYWALL_ENRICHMENT'
  | 'DIRECTORY_DISCOVERY'
  | 'COMPANY_NORMALIZATION'
  | 'PLACES_ENRICHMENT';

export type JobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type ExportFormat = 'CSV' | 'XLSX' | 'PDF';

export type DesignAgeEstimate = 'modern' | 'aging' | 'outdated' | 'unknown';

export interface RawCompany {
  name: string;
  registrationNumber?: string | null;
  industry?: string | null;
  city?: string | null;
  municipality?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  googleMapsUrl?: string | null;
  googlePlaceId?: string | null;
  googleRating?: number | null;
  googleReviewsCount?: number | null;
  googleCategory?: string | null;
  googleBusinessStatus?: string | null;
  googleOpeningHours?: unknown;
  googlePhotos?: unknown;
  sourceUrl?: string | null;
  sourceName?: string | null;
  category?: string | null;
}

export interface CompanyFilters {
  search?: string;
  industry?: string;
  city?: string;
  hasWebsite?: boolean;
  hasEmail?: boolean;
  outreachStatus?: OutreachStatus;
  minScore?: number;
  maxScore?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'latestLeadScore' | 'name' | 'city' | 'industry' | 'createdAt' | 'updatedAt';
  sortDir?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  totalCompanies: number;
  companiesWithoutWebsite: number;
  highValueLeads: number;
  emailsFound: number;
  websitesAudited: number;
  averageLeadScore: number;
  byIndustry: { name: string; count: number }[];
  byCity: { name: string; count: number }[];
  bySource: { name: string; count: number }[];
  leadScoreDistribution: { bucket: string; count: number }[];
  websiteQualityDistribution: { name: string; count: number }[];
  outreachFunnel: { status: OutreachStatus; count: number }[];
  jobs: {
    running: number;
    completed: number;
    failed: number;
    pending: number;
  };
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

export interface AuditIssueInput {
  code: string;
  severity: IssueSeverity;
  title: string;
  description: string;
}

export interface WebsiteAuditResult {
  websiteExists: boolean;
  websiteAccessible: boolean;
  sslEnabled: boolean;
  mobileFriendly: boolean;
  lighthousePerformance: number | null;
  lighthouseSeo: number | null;
  lighthouseAccessibility: number | null;
  lighthouseBestPractices: number | null;
  hasContactForm: boolean;
  hasGoogleMaps: boolean;
  hasSocialLinks: boolean;
  hasPrivacyPolicy: boolean;
  hasCookieNotice: boolean;
  designAgeEstimate: DesignAgeEstimate;
  auditSummary: string;
  aiRecommendations: string;
  issues: AuditIssueInput[];
  score: ScoreResult;
}

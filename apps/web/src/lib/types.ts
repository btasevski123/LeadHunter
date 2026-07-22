export type CompanyListItem = {
  id: string;
  name: string;
  industry: string | null;
  city: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  hasWebsite: boolean;
  sourceName?: string | null;
  latestLeadScore: number | null;
  outreach: { id: string; status: string } | null;
  audits: { leadScore: number; designAgeEstimate: string | null }[];
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type DashboardStats = {
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
  outreachFunnel: { status: string; count: number }[];
  jobs: {
    running: number;
    completed: number;
    failed: number;
    pending: number;
  };
};

export type ImportRun = {
  id: string;
  providerName: string;
  providerId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  companiesFound: number;
  companiesCreated: number;
  companiesUpdated: number;
  duplicatesRemoved: number;
  errors: string[] | unknown;
  industryFilter: string | null;
  createdAt: string;
};

export type JobRun = {
  id: string;
  type: string;
  status: string;
  progress: number;
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

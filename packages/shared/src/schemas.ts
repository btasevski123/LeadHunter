import { z } from 'zod';
export const outreachStatusSchema = z.enum([
  'NOT_CONTACTED',
  'CONTACTED',
  'REPLIED',
  'MEETING_SCHEDULED',
  'WON',
  'LOST',
]);

export const companyFiltersSchema = z.object({
  search: z.string().optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  hasWebsite: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
  hasEmail: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
  outreachStatus: outreachStatusSchema.optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxScore: z.coerce.number().min(0).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z
    .enum(['latestLeadScore', 'name', 'city', 'industry', 'createdAt', 'updatedAt'])
    .default('latestLeadScore'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const updateOutreachSchema = z.object({
  status: outreachStatusSchema.optional(),
  notes: z.string().nullable().optional(),
  contactDate: z.string().datetime().nullable().optional(),
  followUpDate: z.string().datetime().nullable().optional(),
  meetingDate: z.string().datetime().nullable().optional(),
  noteBody: z.string().optional(),
});

export const generateEmailSchema = z.object({
  companyId: z.string().min(1),
  kind: z.enum(['OUTREACH', 'FOLLOW_UP']).default('OUTREACH'),
});

export const exportRequestSchema = z.object({
  format: z.enum(['CSV', 'XLSX', 'PDF']),
  companyIds: z.array(z.string()).optional(),
  filters: companyFiltersSchema.partial().optional(),
});

export const appSettingsSchema = z.object({
  scraper: z
    .object({
      enabledProviders: z
        .array(z.string())
        .default([
          'google-maps',
          'companywall',
          'yellow-pages',
          'business-directory',
          'biznismreza',
          'google-business',
          'industry-directory',
        ]),
      requestDelayMs: z.number().int().min(0).default(1200),
      maxRetries: z.number().int().min(0).default(3),
      timeoutMs: z.number().int().min(1000).default(30000),
      maxCompaniesPerProvider: z.number().int().min(1).default(2000),
      userAgent: z
        .string()
        .default(
          'LeadHunterMK/1.0 (+https://localhost; research bot for local lead discovery)',
        ),
    })
    .default({}),
  audit: z
    .object({
      lightweight: z.boolean().default(false),
      concurrency: z.number().int().min(1).max(8).default(2),
      lighthouseTimeoutMs: z.number().int().default(120000),
      captureScreenshots: z.boolean().default(true),
    })
    .default({}),
  rateLimits: z
    .object({
      httpMaxPerSecond: z.number().min(0.1).default(2),
      scrapeConcurrency: z.number().int().min(1).default(1),
    })
    .default({}),
  export: z
    .object({
      defaultFormat: z.enum(['CSV', 'XLSX', 'PDF']).default('CSV'),
      includeScreenshotsInPdf: z.boolean().default(true),
    })
    .default({}),
  apiKeys: z
    .object({
      openaiConfigured: z.boolean().default(false),
      geminiConfigured: z.boolean().default(false),
      dashboardApiKeyEnabled: z.boolean().default(false),
    })
    .default({}),
  email: z
    .object({
      smtpConfigured: z.boolean().default(false),
      fromEmail: z.string().nullable().optional(),
      fromName: z.string().nullable().optional(),
      host: z.string().nullable().optional(),
    })
    .default({}),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

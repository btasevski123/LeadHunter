import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultSettings = {
  scraper: {
    enabledProviders: [
      'google-maps',
      'companywall',
      'yellow-pages',
      'business-directory',
      'biznismreza',
      'google-business',
      'industry-directory',
    ],
    requestDelayMs: 1200,
    maxRetries: 3,
    timeoutMs: 30000,
    maxCompaniesPerProvider: 2000,
    userAgent:
      'LeadHunterMK/1.0 (+https://localhost; research bot for local lead discovery)',
  },
  audit: {
    lightweight: process.env.AUDIT_LIGHTWEIGHT === 'true',
    concurrency: Number(process.env.AUDIT_CONCURRENCY || 2),
    lighthouseTimeoutMs: 120000,
    captureScreenshots: true,
  },
  rateLimits: {
    httpMaxPerSecond: 2,
    scrapeConcurrency: Number(process.env.SCRAPE_CONCURRENCY || 1),
  },
  export: {
    defaultFormat: 'CSV',
    includeScreenshotsInPdf: true,
  },
  apiKeys: {
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    dashboardApiKeyEnabled: Boolean(process.env.API_KEY),
  },
};

async function main() {
  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  console.log('Seeded AppSetting defaults (real Macedonian providers enabled)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

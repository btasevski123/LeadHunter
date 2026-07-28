import path from 'node:path';
import fs from 'node:fs';
import { config as loadEnv } from 'dotenv';

function loadRootEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../../../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../../../.env'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      loadEnv({ path: file, override: false });
      return file;
    }
  }
  loadEnv();
  return null;
}

loadRootEnv();

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JobsService } from './jobs/jobs.service';
import { CompaniesService } from './companies/companies.service';
import {
  DedupeAuditService,
  formatDedupeAuditReport,
} from './companies/dedupe-audit.service';

function argValue(flag: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (idx < 0) return undefined;
  const token = process.argv[idx]!;
  if (token.includes('=')) return token.split('=').slice(1).join('=');
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.some((a) => a === flag || a.startsWith(`${flag}=`));
}

async function main() {
  const command = process.argv[2] || 'help';
  const industry = argValue('--industry');
  const city = argValue('--city');
  const maxCompanies = argValue('--max') ? Number(argValue('--max')) : undefined;
  const skipPipeline = hasFlag('--skip-pipeline');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing — check LeadHunter/.env');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const jobs = app.get(JobsService);
  const companies = app.get(CompaniesService);

  const scrapeOpts = {
    industry,
    city,
    maxCompaniesPerProvider: maxCompanies,
    runPipeline: !skipPipeline,
  };

  try {
    switch (command) {
      case 'scrape':
      case 'scrape:all':
        console.log(await jobs.runScrapeSync(scrapeOpts));
        break;
      case 'scrape:companywall':
        console.log(
          await jobs.runScrapeSync({ ...scrapeOpts, providerIds: ['companywall'] }),
        );
        break;
      case 'scrape:biznismreza':
        console.log(
          await jobs.runScrapeSync({ ...scrapeOpts, providerIds: ['biznismreza'] }),
        );
        break;
      case 'scrape:yellow-pages':
        console.log(
          await jobs.runScrapeSync({ ...scrapeOpts, providerIds: ['yellow-pages'] }),
        );
        break;
      case 'discover:google':
      case 'scrape:google':
      case 'scrape:google-maps':
        console.log(
          await jobs.runScrapeSync({ ...scrapeOpts, providerIds: ['google-maps'] }),
        );
        break;
      case 'scrape:business-directory':
        console.log(
          await jobs.runScrapeSync({
            ...scrapeOpts,
            providerIds: ['business-directory'],
          }),
        );
        break;
      case 'scrape:industry-directory':
        console.log(
          await jobs.runScrapeSync({
            ...scrapeOpts,
            providerIds: ['industry-directory'],
          }),
        );
        break;
      case 'normalize':
        console.log(await jobs.runNormalizationSync());
        break;
      case 'audit': {
        const limit = Number(process.argv[3] || 100);
        console.log(await jobs.runAuditSync({ limit }));
        break;
      }
      case 'screenshots': {
        const limit = Number(process.argv[3] || 50);
        console.log(await jobs.runScreenshotsSync(limit));
        break;
      }
      case 'discover-contacts': {
        const limit = Number(process.argv[3] || 200);
        console.log(await jobs.runDiscoverContactsSync(limit));
        break;
      }
      case 'enrich-places': {
        const limit = Number(process.argv[3] || 100);
        console.log(await jobs.runPlacesEnrichmentSync(limit));
        break;
      }
      case 'export': {
        const format = (process.argv[3] || 'CSV').toUpperCase() as 'CSV' | 'XLSX' | 'PDF';
        console.log(await jobs.runExportSync(format));
        break;
      }
      case 'dedupe':
        console.log(await companies.dedupeExistingCompanies());
        break;
      case 'dedupe:audit': {
        const report = await app.get(DedupeAuditService).run({
          sampleSize: argValue('--samples') ? Number(argValue('--samples')) : undefined,
        });
        if (hasFlag('--json')) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(formatDedupeAuditReport(report));
        }
        break;
      }
      case 'full-scan':
        console.log(await jobs.runFullScanSync(scrapeOpts));
        break;
      default:
        console.log(`LeadHunter MK CLI

Commands:
  scrape | scrape:all [--industry=PRINTING|HEALTHCARE|FOOD_BEVERAGE|LODGING|FITNESS|DENTAL|…] [--city=Скопје] [--max=2000] [--skip-pipeline]
  scrape:companywall
  scrape:biznismreza
  scrape:yellow-pages
  scrape:business-directory
  discover:google | scrape:google-maps
  scrape:industry-directory
  normalize
  dedupe
  dedupe:audit [--samples=25] [--json]   read-only dedupe health report
  audit [limit]
  screenshots [limit]
  discover-contacts [limit]
  enrich-places [limit]
  export [CSV|XLSX|PDF]
  full-scan
`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

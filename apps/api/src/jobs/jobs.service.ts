import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import type { JobType } from '@leadhunter/database';
import {
  ScraperOrchestrator,
  resolveProviders,
  type Logger as ScraperLogger,
} from '@leadhunter/scraper';
import { captureScreenshots } from '@leadhunter/audit-engine';
import { parseIndustry, type Industry } from '@leadhunter/shared';
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { createStorage } from '../storage/local-storage';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { SettingsService } from '../settings/settings.service';
import { ExportsService } from '../exports/exports.service';

const PROVIDER_JOB_MAP: Record<string, { providerId: string; jobType: JobType }> = {
  'google-maps': { providerId: 'google-maps', jobType: 'GOOGLE_MAPS_DISCOVERY' },
  companywall: { providerId: 'companywall', jobType: 'SCRAPE_COMPANYWALL' },
  'companywall-enrichment': { providerId: 'companywall', jobType: 'COMPANYWALL_ENRICHMENT' },
  biznismreza: { providerId: 'biznismreza', jobType: 'SCRAPE_BIZNIS_MREZA' },
  'yellow-pages': { providerId: 'yellow-pages', jobType: 'SCRAPE_YELLOW_PAGES' },
  'business-directory': { providerId: 'business-directory', jobType: 'DIRECTORY_DISCOVERY' },
  'google-business': { providerId: 'google-business', jobType: 'GOOGLE_DISCOVERY' },
  'industry-directory': {
    providerId: 'industry-directory',
    jobType: 'SCRAPE_INDUSTRY_DIRECTORY',
  },
  'central-registry': { providerId: 'central-registry', jobType: 'SCRAPE' },
};

export interface ScrapeOptions {
  providerIds?: string[];
  industry?: string;
  city?: string;
  maxCompaniesPerProvider?: number;
  runPipeline?: boolean;
}

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private running = new Set<string>();
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private redis: IORedis | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompaniesService) private readonly companies: CompaniesService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(ExportsService) private readonly exports: ExportsService,
  ) {
    void this.initQueue();
  }

  async onModuleInit() {
    await this.recoverOrphanedJobs();
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    this.redis?.disconnect();
  }

  /** Mark jobs left in RUNNING after a crash/restart so the UI is not stuck. */
  private async recoverOrphanedJobs() {
    const result = await this.prisma.jobRun.updateMany({
      where: { status: 'RUNNING' },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        message: 'Interrupted',
        error: 'Orphaned RUNNING job recovered on API startup',
      },
    });
    if (result.count > 0) {
      this.logger.warn(`Recovered ${result.count} orphaned RUNNING job(s)`);
    }
  }

  private async initQueue() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set — using in-process jobs (BullMQ disabled)');
      return;
    }
    try {
      this.redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
      this.queue = new Queue('leadhunter-jobs', { connection: this.redis });
      this.worker = new Worker(
        'leadhunter-jobs',
        async (job: Job) => this.handleQueueJob(job),
        { connection: this.redis, concurrency: 1 },
      );
      this.worker.on('failed', (job, err) => {
        this.logger.error(`BullMQ job failed ${job?.id}: ${err.message}`);
      });
      this.logger.log('BullMQ worker connected');
    } catch (err) {
      this.logger.warn(
        `BullMQ init failed, falling back to in-process: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.queue = null;
      this.worker = null;
    }
  }

  private async enqueue(name: string, data: Record<string, unknown>, jobRunId: string) {
    if (this.queue) {
      await this.queue.add(name, { ...data, jobRunId }, {
        removeOnComplete: 100,
        removeOnFail: 50,
      });
      return true;
    }
    return false;
  }

  private async handleQueueJob(job: Job) {
    const jobRunId = String(job.data.jobRunId);
    switch (job.name) {
      case 'scrape-companywall':
      case 'scrape-biznismreza':
      case 'scrape-yellow-pages':
      case 'google-discovery':
      case 'google-maps-discovery':
      case 'companywall-enrichment':
      case 'directory-discovery':
      case 'scrape-industry-directory':
      case 'scrape-all':
        await this.runScrape(jobRunId, job.data as ScrapeOptions);
        break;
      case 'company-normalization':
        await this.runNormalization(jobRunId);
        break;
      case 'website-audit':
        await this.runAudit(jobRunId, job.data);
        break;
      case 'places-enrichment':
        await this.runPlacesEnrichment(jobRunId, Number(job.data.limit || 100));
        break;
      case 'contact-discovery':
        await this.runDiscoverContacts(jobRunId, Number(job.data.limit || 200));
        break;
      case 'generate-report':
        await this.runExportSync('CSV');
        await this.markDone(jobRunId, { format: 'CSV' });
        break;
      default:
        this.logger.warn(`Unknown queue job ${job.name}`);
    }
  }

  list() {
    return this.prisma.jobRun.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async get(id: string) {
    const job = await this.prisma.jobRun.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async startScrape(opts: ScrapeOptions = {}) {
    const job = await this.createJob('SCRAPE', opts);
    const queued = await this.enqueue('scrape-all', opts as Record<string, unknown>, job.id);
    if (!queued) void this.runScrape(job.id, opts);
    return job;
  }

  async startProviderScrape(providerKey: string, opts: ScrapeOptions = {}) {
    const mapped = PROVIDER_JOB_MAP[providerKey];
    if (!mapped) throw new NotFoundException(`Unknown provider ${providerKey}`);
    const job = await this.createJob(mapped.jobType, {
      ...opts,
      providerIds: [mapped.providerId],
    });
    const queueName =
      providerKey === 'google-maps' || providerKey === 'google-business'
        ? providerKey === 'google-maps'
          ? 'google-maps-discovery'
          : 'google-discovery'
        : providerKey === 'business-directory'
          ? 'directory-discovery'
          : providerKey === 'companywall-enrichment'
            ? 'companywall-enrichment'
            : providerKey === 'industry-directory'
              ? 'scrape-industry-directory'
              : `scrape-${providerKey}`;
    const payload = { ...opts, providerIds: [mapped.providerId] };
    const queued = await this.enqueue(queueName, payload as Record<string, unknown>, job.id);
    if (!queued) void this.runScrape(job.id, payload);
    return job;
  }

  async startNormalization() {
    const job = await this.createJob('COMPANY_NORMALIZATION');
    const queued = await this.enqueue('company-normalization', {}, job.id);
    if (!queued) void this.runNormalization(job.id);
    return job;
  }

  async runNormalizationSync() {
    const job = await this.createJob('COMPANY_NORMALIZATION');
    await this.runNormalization(job.id);
    return this.get(job.id);
  }

  async startAudit(opts?: { companyIds?: string[]; limit?: number }) {
    const job = await this.createJob('WEBSITE_AUDIT');
    const queued = await this.enqueue('website-audit', (opts || {}) as Record<string, unknown>, job.id);
    if (!queued) void this.runAudit(job.id, opts);
    return job;
  }

  async startScreenshots(limit = 100) {
    const job = await this.createJob('SCREENSHOTS');
    void this.runScreenshots(job.id, limit);
    return job;
  }

  async startDiscoverContacts(limit = 200) {
    const job = await this.createJob('CONTACT_DISCOVERY');
    const queued = await this.enqueue('contact-discovery', { limit }, job.id);
    if (!queued) void this.runDiscoverContacts(job.id, limit);
    return job;
  }

  async startPlacesEnrichment(limit = 100) {
    const job = await this.createJob('PLACES_ENRICHMENT', { limit } as ScrapeOptions);
    const queued = await this.enqueue('places-enrichment', { limit }, job.id);
    if (!queued) void this.runPlacesEnrichment(job.id, limit);
    return job;
  }

  async runPlacesEnrichmentSync(limit = 100) {
    const job = await this.createJob('PLACES_ENRICHMENT', { limit } as ScrapeOptions);
    await this.runPlacesEnrichment(job.id, limit);
    return this.get(job.id);
  }

  async startFullScan(opts: ScrapeOptions = {}) {
    const job = await this.createJob('FULL_SCAN');
    void this.runFullScan(job.id, opts);
    return job;
  }

  async startGenerateReport() {
    const job = await this.createJob('GENERATE_REPORT');
    const queued = await this.enqueue('generate-report', {}, job.id);
    if (!queued) {
      await this.runExportSync('CSV');
      await this.markDone(job.id, { format: 'CSV' });
    }
    return job;
  }

  async runScrapeSync(opts: ScrapeOptions = {}) {
    const job = await this.createJob(
      opts.providerIds?.length === 1
        ? PROVIDER_JOB_MAP[opts.providerIds[0]!]?.jobType || 'SCRAPE'
        : 'SCRAPE',
      opts,
    );
    await this.runScrape(job.id, opts);
    return this.get(job.id);
  }

  async runAuditSync(opts?: { companyIds?: string[]; limit?: number }) {
    const job = await this.createJob('AUDIT');
    await this.runAudit(job.id, opts);
    return this.get(job.id);
  }

  async runScreenshotsSync(limit = 100) {
    const job = await this.createJob('SCREENSHOTS');
    await this.runScreenshots(job.id, limit);
    return this.get(job.id);
  }

  async runDiscoverContactsSync(limit = 200) {
    const job = await this.createJob('DISCOVER_CONTACTS');
    await this.runDiscoverContacts(job.id, limit);
    return this.get(job.id);
  }

  async runFullScanSync(opts: ScrapeOptions = {}) {
    const job = await this.createJob('FULL_SCAN');
    await this.runFullScan(job.id, opts);
    return this.get(job.id);
  }

  async runExportSync(format: 'CSV' | 'XLSX' | 'PDF' = 'CSV') {
    return this.exports.createExport(format);
  }

  private async createJob(type: JobType, opts?: ScrapeOptions) {
    return this.prisma.jobRun.create({
      data: {
        type,
        status: 'PENDING',
        message: 'Queued',
        result: opts ? (opts as object) : undefined,
      },
    });
  }

  private async markRunning(id: string, message: string) {
    this.running.add(id);
    return this.prisma.jobRun.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date(), message, progress: 0 },
    });
  }

  private async markProgress(
    id: string,
    data: {
      progress?: number;
      processedItems?: number;
      totalItems?: number;
      successItems?: number;
      failedItems?: number;
      message?: string;
    },
  ) {
    return this.prisma.jobRun.update({ where: { id }, data });
  }

  private async markDone(id: string, result?: unknown) {
    this.running.delete(id);
    return this.prisma.jobRun.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        progress: 100,
        finishedAt: new Date(),
        message: 'Completed',
        result: result as object,
      },
    });
  }

  private async markFailed(id: string, error: unknown) {
    this.running.delete(id);
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Job ${id} failed: ${message}`);
    return this.prisma.jobRun.update({
      where: { id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        message: 'Failed',
        error: message,
      },
    });
  }

  private scraperLogger(): ScraperLogger {
    return {
      info: (msg, meta) => this.logger.log(`${msg} ${meta ? JSON.stringify(meta) : ''}`),
      warn: (msg, meta) => this.logger.warn(`${msg} ${meta ? JSON.stringify(meta) : ''}`),
      error: (msg, meta) => this.logger.error(`${msg} ${meta ? JSON.stringify(meta) : ''}`),
      debug: (msg, meta) => this.logger.debug(`${msg} ${meta ? JSON.stringify(meta) : ''}`),
    };
  }

  private parseIndustryFilter(industry?: string): Industry[] | undefined {
    const parsed = parseIndustry(industry);
    return parsed ? [parsed] : undefined;
  }

  private async runScrape(jobId: string, opts: ScrapeOptions = {}) {
    const importRuns: string[] = [];
    try {
      await this.markRunning(jobId, 'Scraping providers');
      const scraperConfig = await this.settings.getScraperConfig();
      const providerIds = opts.providerIds?.length
        ? opts.providerIds
        : scraperConfig.enabledProviders;
      const providers = resolveProviders(providerIds);
      const industries = this.parseIndustryFilter(opts.industry);

      const results = [];
      for (const provider of providers) {
        const importRun = await this.prisma.importRun.create({
          data: {
            providerName: provider.name,
            providerId: provider.id,
            status: 'RUNNING',
            startedAt: new Date(),
            industryFilter: opts.industry || null,
            jobRunId: jobId,
          },
        });
        importRuns.push(importRun.id);

        const orchestrator = new ScraperOrchestrator({
          providers: [provider],
          config: {
            ...scraperConfig,
            maxCompaniesPerProvider:
              opts.maxCompaniesPerProvider || scraperConfig.maxCompaniesPerProvider || 2000,
            industries,
            industry: opts.industry,
            city: opts.city,
          },
          logger: this.scraperLogger(),
          persist: (company) => this.companies.upsertFromRaw(company),
          onProgress: (processed, total) => {
            void this.markProgress(jobId, {
              processedItems: processed,
              totalItems: total,
              progress: total ? Math.round((processed / total) * 100) : 0,
              message: `${provider.name}: ${processed}/${total}`,
            });
          },
        });

        const [result] = await orchestrator.run();
        if (result) results.push(result);

        await this.prisma.importRun.update({
          where: { id: importRun.id },
          data: {
            status: result?.errors.length && !result.scraped ? 'FAILED' : 'COMPLETED',
            completedAt: new Date(),
            companiesFound: result?.scraped || 0,
            companiesCreated: result?.created || 0,
            companiesUpdated: result?.updated || 0,
            duplicatesRemoved: result?.duplicatesRemoved || 0,
            errors: result?.errors || [],
          },
        });
      }

      const created = results.reduce((s, r) => s + r.created, 0);
      const updated = results.reduce((s, r) => s + r.updated, 0);
      await this.markProgress(jobId, {
        successItems: created + updated,
        failedItems: results.reduce((s, r) => s + r.errors.length, 0),
      });
      await this.markDone(jobId, { results, created, updated, importRuns });

      if (opts.runPipeline !== false && created + updated > 0) {
        void this.runPostImportPipeline(created + updated);
      }
    } catch (err) {
      for (const id of importRuns) {
        await this.prisma.importRun
          .update({
            where: { id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              errors: [err instanceof Error ? err.message : String(err)],
            },
          })
          .catch(() => undefined);
      }
      await this.markFailed(jobId, err);
    }
  }

  private async runNormalization(jobId: string) {
    try {
      await this.markRunning(jobId, 'Recomputing source quality scores');
      const pageSize = 500;
      let cursor: string | undefined;
      let processed = 0;
      let updated = 0;

      for (;;) {
        const batch = await this.prisma.company.findMany({
          take: pageSize,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
          select: {
            id: true,
            sourceReferences: true,
            sourceName: true,
            hasWebsite: true,
            email: true,
            phone: true,
            googlePlaceId: true,
            sourceQualityScore: true,
          },
        });
        if (!batch.length) break;

        for (const company of batch) {
          const { computeSourceQualityScore } = await import('@leadhunter/scraper');
          const score = computeSourceQualityScore({
            sourceReferences: company.sourceReferences,
            sourceName: company.sourceName,
            hasWebsite: company.hasWebsite,
            email: company.email,
            phone: company.phone,
            googlePlaceId: company.googlePlaceId,
          });
          if (score !== company.sourceQualityScore) {
            await this.prisma.company.update({
              where: { id: company.id },
              data: { sourceQualityScore: score },
            });
            updated += 1;
          }
          processed += 1;
        }

        cursor = batch[batch.length - 1]!.id;
        await this.markProgress(jobId, {
          processedItems: processed,
          successItems: updated,
          message: `Normalized ${processed} companies`,
          progress: Math.min(99, Math.round((processed / Math.max(processed, 1)) * 100)),
        });
        if (batch.length < pageSize) break;
      }

      await this.markDone(jobId, { processed, updated });
    } catch (err) {
      await this.markFailed(jobId, err);
    }
  }

  private async runPostImportPipeline(limitHint: number) {
    const limit = Math.min(Math.max(limitHint, 20), 100);
    try {
      this.logger.log(`Post-import pipeline starting for up to ${limit} companies`);
      // Website/Places first so contact crawl has URLs to work with
      const enrichJob = await this.createJob('PLACES_ENRICHMENT', { limit } as ScrapeOptions);
      await this.runPlacesEnrichment(enrichJob.id, limit);
      const auditJob = await this.createJob('WEBSITE_AUDIT');
      const prev = process.env.AUDIT_LIGHTWEIGHT;
      if (prev === undefined) process.env.AUDIT_LIGHTWEIGHT = 'true';
      await this.runAudit(auditJob.id, { limit });
      if (prev === undefined) delete process.env.AUDIT_LIGHTWEIGHT;
      else process.env.AUDIT_LIGHTWEIGHT = prev;
      const contactJob = await this.createJob('CONTACT_DISCOVERY');
      await this.runDiscoverContacts(contactJob.id, limit);
    } catch (err) {
      this.logger.warn(
        `Post-import pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async runPlacesEnrichment(jobId: string, limit: number) {
    try {
      await this.markRunning(jobId, 'Enriching missing websites from Google Places');
      const result = await this.companies.enrichMissingFromPlaces(limit);
      await this.markProgress(jobId, {
        totalItems: result.scanned,
        processedItems: result.scanned,
        successItems: result.enriched,
        failedItems: result.failed,
        progress: 100,
        message: `Enriched ${result.enriched} (${result.withWebsite} gained website)`,
      });
      await this.markDone(jobId, result);
    } catch (err) {
      await this.markFailed(jobId, err);
    }
  }

  private async runAudit(jobId: string, opts?: { companyIds?: string[]; limit?: number }) {
    try {
      await this.markRunning(jobId, 'Auditing companies');
      const limit = opts?.limit ?? 100;
      const companies = opts?.companyIds?.length
        ? await this.prisma.company.findMany({ where: { id: { in: opts.companyIds } } })
        : await this.prisma.company.findMany({
            // Prefer never-scored companies so enrichment closes the coverage gap
            where: { latestLeadScore: null },
            orderBy: [{ lastScrapedAt: 'desc' }, { createdAt: 'desc' }],
            take: limit,
          });

      await this.markProgress(jobId, { totalItems: companies.length });
      let success = 0;
      let failed = 0;

      for (let i = 0; i < companies.length; i++) {
        const company = companies[i]!;
        try {
          await this.companies.auditOne(company.id);
          success += 1;
        } catch (err) {
          failed += 1;
          this.logger.warn(
            `Audit failed for ${company.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        await this.markProgress(jobId, {
          processedItems: i + 1,
          successItems: success,
          failedItems: failed,
          progress: Math.round(((i + 1) / companies.length) * 100),
          message: `Audited ${i + 1}/${companies.length}`,
        });
      }

      await this.markDone(jobId, { success, failed });
    } catch (err) {
      await this.markFailed(jobId, err);
    }
  }

  private async runScreenshots(jobId: string, limit: number) {
    try {
      await this.markRunning(jobId, 'Capturing screenshots');
      const companies = await this.prisma.company.findMany({
        where: {
          website: { not: null },
          screenshot: null,
        },
        take: limit,
        orderBy: [{ latestLeadScore: 'desc' }, { updatedAt: 'desc' }],
      });
      const storage = createStorage();
      let success = 0;
      let failed = 0;
      await this.markProgress(jobId, { totalItems: companies.length });

      for (let i = 0; i < companies.length; i++) {
        const company = companies[i]!;
        try {
          const shots = await captureScreenshots(company.id, company.website, storage);
          await this.prisma.screenshot.upsert({
            where: { companyId: company.id },
            create: {
              companyId: company.id,
              desktopPath: shots.desktopPath,
              mobilePath: shots.mobilePath,
            },
            update: {
              desktopPath: shots.desktopPath,
              mobilePath: shots.mobilePath,
              capturedAt: new Date(),
            },
          });
          success += 1;
        } catch {
          failed += 1;
        }
        await this.markProgress(jobId, {
          processedItems: i + 1,
          successItems: success,
          failedItems: failed,
          progress: Math.round(((i + 1) / companies.length) * 100),
        });
      }
      await this.markDone(jobId, { success, failed });
    } catch (err) {
      await this.markFailed(jobId, err);
    }
  }

  private async runDiscoverContacts(jobId: string, limit: number) {
    try {
      await this.markRunning(jobId, 'Discovering contacts');
      const companies = await this.prisma.company.findMany({
        take: limit,
        orderBy: [{ lastScrapedAt: 'desc' }, { updatedAt: 'desc' }],
      });
      let success = 0;
      let failed = 0;
      await this.markProgress(jobId, { totalItems: companies.length });

      for (let i = 0; i < companies.length; i++) {
        try {
          await this.companies.discoverContactsForCompany(companies[i]!.id);
          success += 1;
        } catch {
          failed += 1;
        }
        await this.markProgress(jobId, {
          processedItems: i + 1,
          successItems: success,
          failedItems: failed,
          progress: Math.round(((i + 1) / companies.length) * 100),
        });
      }
      await this.markDone(jobId, { success, failed });
    } catch (err) {
      await this.markFailed(jobId, err);
    }
  }

  private async runFullScan(jobId: string, opts: ScrapeOptions = {}) {
    try {
      await this.markRunning(jobId, 'Full scan started');
      await this.markProgress(jobId, { message: 'Phase 1/5: scrape', progress: 5 });
      const scrapeJob = await this.createJob('SCRAPE', opts);
      await this.runScrape(scrapeJob.id, { ...opts, runPipeline: false });

      await this.markProgress(jobId, { message: 'Phase 2/5: Places enrichment', progress: 25 });
      const enrichJob = await this.createJob('PLACES_ENRICHMENT');
      await this.runPlacesEnrichment(enrichJob.id, 300);

      await this.markProgress(jobId, { message: 'Phase 3/5: audit', progress: 45 });
      const prev = process.env.AUDIT_LIGHTWEIGHT;
      if (prev === undefined) process.env.AUDIT_LIGHTWEIGHT = 'true';
      const auditJob = await this.createJob('WEBSITE_AUDIT');
      await this.runAudit(auditJob.id, { limit: 150 });
      if (prev === undefined) delete process.env.AUDIT_LIGHTWEIGHT;
      else process.env.AUDIT_LIGHTWEIGHT = prev;

      await this.markProgress(jobId, { message: 'Phase 4/5: discover contacts', progress: 70 });
      const contactJob = await this.createJob('CONTACT_DISCOVERY');
      await this.runDiscoverContacts(contactJob.id, 300);

      await this.markProgress(jobId, { message: 'Phase 5/5: screenshots', progress: 85 });
      if (process.env.SKIP_SCREENSHOTS !== 'true') {
        const shotJob = await this.createJob('SCREENSHOTS');
        await this.runScreenshots(shotJob.id, 50);
      }

      await this.markDone(jobId, {
        phases: ['scrape', 'places-enrichment', 'audit', 'discover-contacts', 'screenshots'],
      });
    } catch (err) {
      await this.markFailed(jobId, err);
    }
  }
}

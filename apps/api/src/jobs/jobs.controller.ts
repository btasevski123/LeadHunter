import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list() {
    return this.jobs.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.jobs.get(id);
  }

  @Post('scrape')
  scrape(
    @Body()
    body?: {
      providerIds?: string[];
      industry?: string;
      city?: string;
      maxCompaniesPerProvider?: number;
      runPipeline?: boolean;
    },
  ) {
    return this.jobs.startScrape(body || {});
  }

  @Post('scrape/:provider')
  scrapeProvider(
    @Param('provider') provider: string,
    @Body()
    body?: {
      industry?: string;
      city?: string;
      maxCompaniesPerProvider?: number;
      runPipeline?: boolean;
    },
  ) {
    return this.jobs.startProviderScrape(provider, body || {});
  }

  @Post('normalize')
  normalize() {
    return this.jobs.startNormalization();
  }

  @Post('audit')
  audit(@Body() body?: { companyIds?: string[]; limit?: number }) {
    return this.jobs.startAudit(body);
  }

  @Post('screenshots')
  screenshots(@Body() body?: { limit?: number }) {
    return this.jobs.startScreenshots(body?.limit);
  }

  @Post('discover-contacts')
  discover(@Body() body?: { limit?: number }) {
    return this.jobs.startDiscoverContacts(body?.limit);
  }

  @Post('enrich-places')
  enrichPlaces(@Body() body?: { limit?: number }) {
    return this.jobs.startPlacesEnrichment(body?.limit ?? 100);
  }

  @Post('full-scan')
  fullScan(
    @Body()
    body?: {
      industry?: string;
      maxCompaniesPerProvider?: number;
    },
  ) {
    return this.jobs.startFullScan(body || {});
  }

  @Post('generate-report')
  generateReport() {
    return this.jobs.startGenerateReport();
  }
}

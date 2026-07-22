import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SourcesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getStats() {
    const [bySource, importAgg, total] = await Promise.all([
      this.prisma.company.groupBy({
        by: ['sourceName'],
        _count: { _all: true },
        orderBy: { _count: { sourceName: 'desc' } },
      }),
      this.prisma.importRun.groupBy({
        by: ['providerId', 'providerName'],
        _sum: {
          companiesFound: true,
          companiesCreated: true,
          duplicatesRemoved: true,
        },
        _count: { _all: true },
      }),
      this.prisma.company.count(),
    ]);

    const importMap = new Map(
      importAgg.map((row) => [
        row.providerId,
        {
          providerId: row.providerId,
          providerName: row.providerName,
          runs: row._count._all,
          companiesFound: row._sum.companiesFound || 0,
          newCompanies: row._sum.companiesCreated || 0,
          duplicates: row._sum.duplicatesRemoved || 0,
        },
      ]),
    );

    const sources = bySource.map((s) => {
      const key = this.providerIdFromSource(s.sourceName);
      const imports = key ? importMap.get(key) : undefined;
      return {
        sourceName: s.sourceName || 'Unknown',
        label: this.label(s.sourceName),
        companiesFound: imports?.companiesFound || s._count._all,
        inDatabase: s._count._all,
        duplicates: imports?.duplicates || 0,
        newCompanies: imports?.newCompanies || s._count._all,
        runs: imports?.runs || 0,
      };
    });

    // Include providers that ran but have no companies yet
    for (const [providerId, row] of importMap) {
      if (sources.some((s) => this.providerIdFromSource(s.sourceName) === providerId)) continue;
      sources.push({
        sourceName: row.providerName,
        label: row.providerName,
        companiesFound: row.companiesFound,
        inDatabase: 0,
        duplicates: row.duplicates,
        newCompanies: row.newCompanies,
        runs: row.runs,
      });
    }

    return { total, sources };
  }

  private providerIdFromSource(sourceName?: string | null): string | null {
    if (!sourceName) return null;
    const map: Record<string, string> = {
      GOOGLE_MAPS: 'google-maps',
      GOOGLE_DISCOVERY: 'google-business',
      COMPANY_WALL: 'companywall',
      YELLOW_PAGES: 'yellow-pages',
      BIZNIS_MREZA: 'biznismreza',
      INDUSTRY_DIRECTORY: 'industry-directory',
      BUSINESS_DIRECTORY: 'business-directory',
      CENTRAL_REGISTRY: 'central-registry',
    };
    return map[sourceName] || sourceName.toLowerCase();
  }

  private label(sourceName?: string | null): string {
    const map: Record<string, string> = {
      GOOGLE_MAPS: 'Google Maps',
      GOOGLE_DISCOVERY: 'Google Web Discovery',
      COMPANY_WALL: 'CompanyWall',
      YELLOW_PAGES: 'Yellow Pages',
      BIZNIS_MREZA: 'BiznisMreza',
      INDUSTRY_DIRECTORY: 'Industry Directory',
      BUSINESS_DIRECTORY: 'Business Directory',
      CENTRAL_REGISTRY: 'Central Registry',
    };
    return (sourceName && map[sourceName]) || sourceName || 'Unknown';
  }
}

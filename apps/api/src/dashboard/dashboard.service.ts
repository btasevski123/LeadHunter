import { Injectable, Inject } from '@nestjs/common';
import {
  HIGH_VALUE_SCORE_THRESHOLD,
  OUTREACH_STATUSES,
  SCORE_BANDS,
  type DashboardStats,
  type OutreachStatus,
} from '@leadhunter/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    const [
      totalCompanies,
      companiesWithoutWebsite,
      highValueLeads,
      emailsFound,
      websitesAudited,
      avg,
      byIndustry,
      byCity,
      bySource,
      designAges,
      outreachGroups,
      scores,
      jobGroups,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { hasWebsite: false } }),
      this.prisma.company.count({
        where: { latestLeadScore: { gte: HIGH_VALUE_SCORE_THRESHOLD } },
      }),
      this.prisma.company.count({ where: { email: { not: null } } }),
      this.prisma.websiteAudit.count({ where: { isLatest: true } }),
      this.prisma.company.aggregate({ _avg: { latestLeadScore: true } }),
      this.prisma.company.groupBy({
        by: ['industry'],
        _count: { _all: true },
        orderBy: { _count: { industry: 'desc' } },
        take: 12,
      }),
      this.prisma.company.groupBy({
        by: ['city'],
        _count: { _all: true },
        orderBy: { _count: { city: 'desc' } },
        take: 12,
      }),
      this.prisma.company.groupBy({
        by: ['sourceName'],
        _count: { _all: true },
        orderBy: { _count: { sourceName: 'desc' } },
        take: 12,
      }),
      this.prisma.websiteAudit.groupBy({
        by: ['designAgeEstimate'],
        where: { isLatest: true },
        _count: { _all: true },
      }),
      this.prisma.outreach.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.company.findMany({
        where: { latestLeadScore: { not: null } },
        select: { latestLeadScore: true },
      }),
      this.prisma.jobRun.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const leadScoreDistribution = SCORE_BANDS.map((band) => ({
      bucket: band.key,
      count: scores.filter(
        (s) =>
          s.latestLeadScore !== null &&
          s.latestLeadScore >= band.min &&
          s.latestLeadScore <= band.max,
      ).length,
    }));

    const outreachMap = new Map(outreachGroups.map((g) => [g.status, g._count._all]));
    const outreachFunnel = OUTREACH_STATUSES.map((status) => ({
      status: status as OutreachStatus,
      count: outreachMap.get(status) || 0,
    }));

    const jobMap = new Map(jobGroups.map((g) => [g.status, g._count._all]));

    return {
      totalCompanies,
      companiesWithoutWebsite,
      highValueLeads,
      emailsFound,
      websitesAudited,
      averageLeadScore: Math.round((avg._avg.latestLeadScore || 0) * 10) / 10,
      byIndustry: byIndustry
        .filter((i) => i.industry)
        .map((i) => ({ name: i.industry || 'Other', count: i._count._all })),
      byCity: byCity
        .filter((i) => i.city)
        .map((i) => ({ name: i.city || 'Unknown', count: i._count._all })),
      bySource: bySource
        .filter((s) => s.sourceName)
        .map((s) => ({ name: s.sourceName || 'Unknown', count: s._count._all })),
      leadScoreDistribution,
      websiteQualityDistribution: designAges.map((d) => ({
        name: d.designAgeEstimate || 'unknown',
        count: d._count._all,
      })),
      outreachFunnel,
      jobs: {
        running: jobMap.get('RUNNING') || 0,
        completed: jobMap.get('COMPLETED') || 0,
        failed: jobMap.get('FAILED') || 0,
        pending: jobMap.get('PENDING') || 0,
      },
    };
  }
}

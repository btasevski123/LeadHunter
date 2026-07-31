import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import {
  classifyCompany as classifyCompanyRules,
  computeDesignScore,
  computeSeoScore,
} from '@leadhunter/lead-scoring';
import type { ClassificationCompanyInput, ClassificationResult } from '@leadhunter/shared';
import type { LeadClassificationType } from '@leadhunter/database';
import { PrismaService } from '../prisma/prisma.service';

type CompanyForClassification = {
  id: string;
  website: string | null;
  industry: string | null;
  googleCategory: string | null;
  audits?: Array<{
    designAgeEstimate: string | null;
    mobileFriendly: boolean;
    sslEnabled: boolean;
    lighthousePerformance: number | null;
    lighthouseSeo: number | null;
    isPlaceholderSite?: boolean;
  }>;
};

@Injectable()
export class LeadClassificationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Pure classification against a company (+ optional latest audit signals).
   * Deterministic — no AI.
   */
  classifyCompany(company: CompanyForClassification): ClassificationResult {
    const audit = company.audits?.[0];
    const input: ClassificationCompanyInput = {
      website: company.website,
      industry: company.industry,
      googleCategory: company.googleCategory,
      audit: audit
        ? {
            designScore: computeDesignScore({
              designAgeEstimate: audit.designAgeEstimate,
              mobileFriendly: audit.mobileFriendly,
              sslEnabled: audit.sslEnabled,
              lighthousePerformance: audit.lighthousePerformance,
            }),
            seoScore: computeSeoScore(audit.lighthouseSeo),
            // V1: booking / ecommerce detection not yet in audit pipeline
            hasBooking: false,
            hasEcommerce: false,
            isPlaceholderSite: Boolean(audit.isPlaceholderSite),
          }
        : null,
    };

    return classifyCompanyRules(input);
  }

  async getByCompanyId(companyId: string) {
    return this.prisma.leadClassification.findUnique({ where: { companyId } });
  }

  /** Classify and upsert stored result (supports recalculation). */
  async classifyAndStore(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        audits: {
          where: { isLatest: true },
          take: 1,
          select: {
            designAgeEstimate: true,
            mobileFriendly: true,
            sslEnabled: true,
            lighthousePerformance: true,
            lighthouseSeo: true,
            isPlaceholderSite: true,
          },
        },
      },
    });
    if (!company) throw new NotFoundException('Company not found');

    const result = this.classifyCompany(company);

    return this.prisma.leadClassification.upsert({
      where: { companyId },
      create: {
        companyId,
        classification: result.classification as LeadClassificationType,
        confidence: result.confidence,
        reasons: result.reasons,
        recommendedService: result.recommendedService,
      },
      update: {
        classification: result.classification as LeadClassificationType,
        confidence: result.confidence,
        reasons: result.reasons,
        recommendedService: result.recommendedService,
      },
    });
  }
}

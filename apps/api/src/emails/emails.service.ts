import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { generateOutreachEmail } from '@leadhunter/audit-engine';
import type { ScoreResult } from '@leadhunter/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(companyId?: string) {
    return this.prisma.emailTemplate.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async generate(companyId: string, kind: 'OUTREACH' | 'FOLLOW_UP') {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { audits: { where: { isLatest: true }, take: 1 } },
    });
    if (!company) throw new NotFoundException('Company not found');

    const audit = company.audits[0];
    const score: ScoreResult | null = audit
      ? {
          score: audit.leadScore,
          reasons: Array.isArray(audit.scoreReasons)
            ? (audit.scoreReasons as string[])
            : [],
        }
      : null;

    const generated = await generateOutreachEmail({
      companyName: company.name,
      industry: company.industry,
      city: company.city,
      website: company.website,
      score,
      auditSummary: audit?.auditSummary,
      kind,
    });

    return this.prisma.emailTemplate.create({
      data: {
        companyId,
        kind,
        subject: generated.subject,
        content: generated.content,
      },
    });
  }
}

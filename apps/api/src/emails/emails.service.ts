import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { generateOutreachEmail, type EmailLanguage } from '@leadhunter/audit-engine';
import type { ScoreResult } from '@leadhunter/shared';
import { PrismaService } from '../prisma/prisma.service';
import { readSmtpConfig, sendSmtpMail, smtpConfigured } from './smtp';

@Injectable()
export class EmailsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(companyId?: string) {
    return this.prisma.emailTemplate.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { company: { select: { id: true, name: true, email: true } } },
    });
  }

  status() {
    const config = readSmtpConfig();
    return {
      smtpConfigured: Boolean(config),
      fromEmail: config?.fromEmail || null,
      fromName: config?.fromName || null,
      host: config?.host || null,
    };
  }

  async generate(
    companyId: string,
    kind: 'OUTREACH' | 'FOLLOW_UP' = 'OUTREACH',
    language: EmailLanguage = 'en',
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        audits: { where: { isLatest: true }, take: 1 },
        classification: true,
        contacts: {
          where: { type: 'EMAIL' },
          orderBy: [{ isPrimary: 'desc' }, { confidence: 'desc' }],
          take: 5,
        },
      },
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

    const recipientEmail =
      company.email ||
      company.contacts.find((c) => c.type === 'EMAIL')?.value ||
      null;

    const generated = await generateOutreachEmail({
      companyName: company.name,
      industry: company.industry,
      city: company.city,
      website: company.website,
      recipientEmail,
      score,
      auditSummary: audit?.auditSummary,
      aiRecommendations: audit?.aiRecommendations,
      classification: company.classification?.classification || null,
      recommendedService: company.classification?.recommendedService || null,
      senderName: process.env.SMTP_FROM_NAME || null,
      senderCompany: process.env.SENDER_COMPANY || process.env.SMTP_FROM_NAME || null,
      kind,
      language,
    });

    return this.prisma.emailTemplate.create({
      data: {
        companyId,
        kind,
        language: generated.language,
        subject: generated.subject,
        content: generated.content,
        toEmail: recipientEmail,
      },
    });
  }

  async send(templateId: string, toEmail?: string) {
    if (!smtpConfigured()) {
      throw new BadRequestException(
        'SMTP is not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM to .env, then restart the API.',
      );
    }

    const template = await this.prisma.emailTemplate.findUnique({
      where: { id: templateId },
      include: {
        company: {
          include: {
            contacts: {
              where: { type: 'EMAIL' },
              orderBy: [{ isPrimary: 'desc' }, { confidence: 'desc' }],
              take: 5,
            },
            outreach: true,
          },
        },
      },
    });
    if (!template) throw new NotFoundException('Email template not found');

    const recipient =
      toEmail?.trim() ||
      template.toEmail ||
      template.company?.email ||
      template.company?.contacts.find((c) => c.type === 'EMAIL')?.value ||
      null;

    if (!recipient) {
      throw new BadRequestException(
        'No recipient email on this company. Add an email on the company or pass toEmail when sending.',
      );
    }

    try {
      await sendSmtpMail({
        to: recipient,
        subject: template.subject,
        text: template.content,
      });

      const updated = await this.prisma.emailTemplate.update({
        where: { id: template.id },
        data: {
          toEmail: recipient,
          sentAt: new Date(),
          sentError: null,
        },
      });

      if (template.companyId) {
        const outreach =
          template.company?.outreach ||
          (await this.prisma.outreach.upsert({
            where: { companyId: template.companyId },
            create: { companyId: template.companyId, status: 'CONTACTED', contactDate: new Date() },
            update: {},
          }));

        if (outreach.status === 'NOT_CONTACTED') {
          await this.prisma.outreach.update({
            where: { id: outreach.id },
            data: { status: 'CONTACTED', contactDate: new Date() },
          });
        }

        await this.prisma.outreachNote.create({
          data: {
            outreachId: outreach.id,
            body: `Email sent to ${recipient}: ${template.subject}`,
          },
        });
      }

      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.emailTemplate.update({
        where: { id: template.id },
        data: { sentError: message },
      });
      throw new BadRequestException(`Failed to send email: ${message}`);
    }
  }
}

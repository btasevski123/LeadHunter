import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import path from 'node:path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createStorage } from '../storage/local-storage';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.exportArtifact.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async createExport(format: 'CSV' | 'XLSX' | 'PDF', companyIds?: string[]) {
    const job = await this.prisma.jobRun.create({
      data: {
        type: 'EXPORT',
        status: 'RUNNING',
        startedAt: new Date(),
        message: `Exporting ${format}`,
      },
    });

    try {
      const companies = await this.prisma.company.findMany({
        where: companyIds?.length ? { id: { in: companyIds } } : undefined,
        include: {
          outreach: true,
          audits: { where: { isLatest: true }, take: 1, include: { issues: true } },
          screenshot: true,
        },
        orderBy: { latestLeadScore: { sort: 'desc', nulls: 'last' } },
        take: 500,
      });

      const storage = createStorage();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      let storagePath: string;
      let buffer: Buffer;

      if (format === 'CSV') {
        storagePath = path.posix.join('exports', `leads-${stamp}.csv`);
        buffer = Buffer.from(this.toCsv(companies), 'utf8');
      } else if (format === 'XLSX') {
        storagePath = path.posix.join('exports', `leads-${stamp}.xlsx`);
        buffer = await this.toXlsx(companies);
      } else {
        storagePath = path.posix.join('exports', `leads-${stamp}.pdf`);
        buffer = await this.toPdf(companies, storage);
      }

      await storage.put(storagePath, buffer);

      const artifact = await this.prisma.exportArtifact.create({
        data: {
          jobRunId: job.id,
          format,
          storagePath,
          filters: companyIds ? { companyIds } : {},
        },
      });

      await this.prisma.jobRun.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          finishedAt: new Date(),
          message: 'Export completed',
          successItems: companies.length,
          totalItems: companies.length,
          processedItems: companies.length,
          result: { artifactId: artifact.id, storagePath },
        },
      });

      return artifact;
    } catch (err) {
      await this.prisma.jobRun.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  async getFile(id: string) {
    const artifact = await this.prisma.exportArtifact.findUnique({ where: { id } });
    if (!artifact) throw new NotFoundException('Export not found');
    const storage = createStorage();
    const buffer = await storage.get(artifact.storagePath);
    const filename = path.basename(artifact.storagePath);
    const contentType =
      artifact.format === 'CSV'
        ? 'text/csv'
        : artifact.format === 'XLSX'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf';
    return { buffer, filename, contentType };
  }

  private toCsv(
    companies: Array<{
      name: string;
      industry: string | null;
      city: string | null;
      website: string | null;
      email: string | null;
      phone: string | null;
      latestLeadScore: number | null;
      outreach: { status: string } | null;
      audits: { auditSummary: string | null; leadScore: number }[];
    }>,
  ) {
    const headers = [
      'Name',
      'Industry',
      'City',
      'Website',
      'Email',
      'Phone',
      'Lead Score',
      'Outreach Status',
      'Audit Summary',
    ];
    const lines = [headers.join(',')];
    for (const c of companies) {
      const row = [
        c.name,
        c.industry || '',
        c.city || '',
        c.website || '',
        c.email || '',
        c.phone || '',
        String(c.latestLeadScore ?? c.audits[0]?.leadScore ?? ''),
        c.outreach?.status || '',
        c.audits[0]?.auditSummary || '',
      ].map(csvEscape);
      lines.push(row.join(','));
    }
    return lines.join('\n');
  }

  private async toXlsx(
    companies: Array<{
      name: string;
      industry: string | null;
      city: string | null;
      website: string | null;
      email: string | null;
      phone: string | null;
      latestLeadScore: number | null;
      outreach: { status: string } | null;
      audits: { auditSummary: string | null; leadScore: number }[];
    }>,
  ) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Leads');
    sheet.columns = [
      { header: 'Name', key: 'name', width: 32 },
      { header: 'Industry', key: 'industry', width: 18 },
      { header: 'City', key: 'city', width: 14 },
      { header: 'Website', key: 'website', width: 28 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Lead Score', key: 'score', width: 12 },
      { header: 'Outreach', key: 'outreach', width: 18 },
      { header: 'Audit Summary', key: 'summary', width: 50 },
    ];
    for (const c of companies) {
      sheet.addRow({
        name: c.name,
        industry: c.industry,
        city: c.city,
        website: c.website,
        email: c.email,
        phone: c.phone,
        score: c.latestLeadScore ?? c.audits[0]?.leadScore ?? '',
        outreach: c.outreach?.status || '',
        summary: c.audits[0]?.auditSummary || '',
      });
    }
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async toPdf(
    companies: Array<{
      name: string;
      industry: string | null;
      city: string | null;
      address: string | null;
      website: string | null;
      email: string | null;
      phone: string | null;
      latestLeadScore: number | null;
      outreach: { status: string } | null;
      audits: {
        auditSummary: string | null;
        leadScore: number;
        aiRecommendations: string | null;
        scoreReasons: unknown;
        issues: { title: string; severity: string }[];
      }[];
      screenshot: { desktopPath: string | null; mobilePath: string | null } | null;
    }>,
    storage: ReturnType<typeof createStorage>,
  ) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));

    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(20).text('LeadHunter MK — Lead Report', { underline: true });
    doc.moveDown();
    doc.fontSize(10).fillColor('#444').text(`Generated ${new Date().toISOString()}`);
    doc.text(`Companies: ${companies.length}`);
    doc.moveDown();

    for (const c of companies.slice(0, 40)) {
      const audit = c.audits[0];
      doc.fillColor('#000').fontSize(14).text(c.name, { continued: false });
      doc.fontSize(10).fillColor('#333');
      doc.text(`Industry: ${c.industry || 'n/a'} | City: ${c.city || 'n/a'}`);
      doc.text(`Website: ${c.website || 'none'} | Email: ${c.email || 'n/a'} | Phone: ${c.phone || 'n/a'}`);
      doc.text(
        `Lead score: ${c.latestLeadScore ?? audit?.leadScore ?? 'n/a'} | Outreach: ${c.outreach?.status || 'n/a'}`,
      );
      if (audit?.auditSummary) {
        doc.moveDown(0.3);
        doc.text(`Audit: ${audit.auditSummary}`);
      }
      if (audit?.scoreReasons && Array.isArray(audit.scoreReasons)) {
        doc.text(`Reasons: ${(audit.scoreReasons as string[]).join('; ')}`);
      }
      if (audit?.issues?.length) {
        doc.text(`Issues: ${audit.issues.map((i) => i.title).join(', ')}`);
      }
      if (audit?.aiRecommendations) {
        doc.moveDown(0.3);
        doc.text('Recommendations:', { underline: true });
        doc.text(audit.aiRecommendations.slice(0, 1200));
      }

      if (c.screenshot?.desktopPath) {
        try {
          const img = await storage.get(c.screenshot.desktopPath);
          doc.moveDown(0.4);
          doc.text('Desktop screenshot:');
          doc.image(img, { fit: [500, 220] });
        } catch {
          // skip missing image
        }
      }
      if (c.screenshot?.mobilePath) {
        try {
          const img = await storage.get(c.screenshot.mobilePath);
          doc.moveDown(0.3);
          doc.text('Mobile screenshot:');
          doc.image(img, { fit: [200, 360] });
        } catch {
          // skip
        }
      }

      doc.moveDown();
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ddd').stroke();
      doc.moveDown();
      if (doc.y > 700) doc.addPage();
    }

    doc.end();
    return done;
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

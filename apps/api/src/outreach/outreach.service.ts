import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { updateOutreachSchema, OUTREACH_STATUSES } from '@leadhunter/shared';
import type { OutreachStatus } from '@leadhunter/database';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OutreachService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(status?: string) {
    return this.prisma.outreach.findMany({
      where: status ? { status: status as OutreachStatus } : undefined,
      include: {
        company: {
          include: {
            audits: { where: { isLatest: true }, take: 1 },
          },
        },
        history: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async board() {
    const rows = await this.list();
    const board: Record<string, typeof rows> = {};
    for (const status of OUTREACH_STATUSES) {
      board[status] = [];
    }
    for (const row of rows) {
      board[row.status] = board[row.status] || [];
      board[row.status]!.push(row);
    }
    return board;
  }

  async ensure(companyId: string) {
    return this.prisma.outreach.upsert({
      where: { companyId },
      create: { companyId, status: 'NOT_CONTACTED' },
      update: {},
      include: { company: true },
    });
  }

  async update(id: string, body: Record<string, unknown>) {
    const parsed = updateOutreachSchema.parse(body);
    const existing = await this.prisma.outreach.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Outreach not found');

    const data: {
      status?: OutreachStatus;
      notes?: string | null;
      contactDate?: Date | null;
      followUpDate?: Date | null;
      meetingDate?: Date | null;
    } = {};

    if (parsed.status) data.status = parsed.status;
    if (parsed.notes !== undefined) data.notes = parsed.notes;
    if (parsed.contactDate !== undefined) {
      data.contactDate = parsed.contactDate ? new Date(parsed.contactDate) : null;
    }
    if (parsed.followUpDate !== undefined) {
      data.followUpDate = parsed.followUpDate ? new Date(parsed.followUpDate) : null;
    }
    if (parsed.meetingDate !== undefined) {
      data.meetingDate = parsed.meetingDate ? new Date(parsed.meetingDate) : null;
    }

    if (parsed.status === 'CONTACTED' && !existing.contactDate && !data.contactDate) {
      data.contactDate = new Date();
    }

    const updated = await this.prisma.outreach.update({
      where: { id },
      data,
      include: {
        company: true,
        history: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (parsed.noteBody) {
      await this.prisma.outreachNote.create({
        data: { outreachId: id, body: parsed.noteBody },
      });
    }

    return this.prisma.outreach.findUnique({
      where: { id },
      include: {
        company: true,
        history: { orderBy: { createdAt: 'desc' } },
      },
    }) ?? updated;
  }
}

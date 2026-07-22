import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ImportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(limit = 50) {
    return this.prisma.importRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async get(id: string) {
    const row = await this.prisma.importRun.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Import run not found');
    return row;
  }
}

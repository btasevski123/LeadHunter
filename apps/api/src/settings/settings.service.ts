import { Injectable, Inject } from '@nestjs/common';
import { appSettingsSchema, type AppSettings } from '@leadhunter/shared';
import { listProviders } from '@leadhunter/scraper';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getAll(): Promise<AppSettings & { availableProviders: { id: string; name: string; industries: string[] }[] }> {
    const rows = await this.prisma.appSetting.findMany();
    const map: Record<string, unknown> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    const parsed = appSettingsSchema.parse({
      scraper: map.scraper || {},
      audit: map.audit || {},
      rateLimits: map.rateLimits || {},
      export: map.export || {},
      apiKeys: {
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        dashboardApiKeyEnabled: Boolean(process.env.API_KEY),
        ...(typeof map.apiKeys === 'object' && map.apiKeys ? map.apiKeys : {}),
      },
      email: {
        smtpConfigured: Boolean(
          process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
        ),
        fromEmail: process.env.SMTP_FROM || process.env.SMTP_USER || null,
        fromName: process.env.SMTP_FROM_NAME || null,
        host: process.env.SMTP_HOST || null,
      },
    });

    return {
      ...parsed,
      availableProviders: listProviders().map((p) => ({
        id: p.id,
        name: p.name,
        industries: p.industries,
      })),
    };
  }

  async update(body: Record<string, unknown>) {
    const current = await this.getAll();
    const merged = appSettingsSchema.parse({
      scraper: { ...current.scraper, ...(body.scraper as object) },
      audit: { ...current.audit, ...(body.audit as object) },
      rateLimits: { ...current.rateLimits, ...(body.rateLimits as object) },
      export: { ...current.export, ...(body.export as object) },
      apiKeys: { ...current.apiKeys, ...(body.apiKeys as object) },
    });

    for (const key of ['scraper', 'audit', 'rateLimits', 'export', 'apiKeys'] as const) {
      await this.prisma.appSetting.upsert({
        where: { key },
        create: { key, value: merged[key] },
        update: { value: merged[key] },
      });
    }

    return this.getAll();
  }

  async getScraperConfig() {
    const all = await this.getAll();
    return all.scraper;
  }

  async getAuditConfig() {
    const all = await this.getAll();
    return all.audit;
  }
}

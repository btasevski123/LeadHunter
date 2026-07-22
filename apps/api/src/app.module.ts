import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { CompaniesModule } from './companies/companies.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { OutreachModule } from './outreach/outreach.module';
import { EmailsModule } from './emails/emails.module';
import { SettingsModule } from './settings/settings.module';
import { JobsModule } from './jobs/jobs.module';
import { ExportsModule } from './exports/exports.module';
import { StorageModule } from './storage/storage.module';
import { PrismaModule } from './prisma/prisma.module';
import { ImportsModule } from './imports/imports.module';
import { SourcesModule } from './sources/sources.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    CompaniesModule,
    DashboardModule,
    OutreachModule,
    EmailsModule,
    SettingsModule,
    JobsModule,
    ExportsModule,
    StorageModule,
    ImportsModule,
    SourcesModule,
  ],
})
export class AppModule {}

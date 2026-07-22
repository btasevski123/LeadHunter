import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { CompaniesModule } from '../companies/companies.module';
import { SettingsModule } from '../settings/settings.module';
import { ExportsModule } from '../exports/exports.module';

@Module({
  imports: [CompaniesModule, SettingsModule, ExportsModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}

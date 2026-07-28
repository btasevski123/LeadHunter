import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { DedupeAuditService } from './dedupe-audit.service';
import { ClassificationModule } from '../classification/classification.module';

@Module({
  imports: [ClassificationModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, DedupeAuditService],
  exports: [CompaniesService, DedupeAuditService],
})
export class CompaniesModule {}
